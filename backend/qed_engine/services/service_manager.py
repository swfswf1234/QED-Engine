"""服务控制能力层（控制域）：8900 对 8901/8902 的启停托管、状态探测与自身重启。

前端（8903）只连 8900（ADR 0007）：/services 端点族契约见 docs/design/service-hosting.md；
本模块只暴露能力函数（无路由），路由与 HTTP 映射在 api/control.py。状态判定优先 HTTP
端口探测（3s 超时）；启停为同步轻量操作（Popen 创建/信号发送即返回），状态收敛由前端轮询
/services 观察（操作后 15s 过渡窗口）。错误以 ServiceError（含 status_code）表达。

设计关联（DesignRef）：docs/design/service-hosting.md
实现状态：Current
关联测试：tests/test_api.py、tests/test_self_restart.py
"""

import ctypes
import logging
import os
import signal
import socket
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import httpx

from qed_engine.config import Settings

LOG = logging.getLogger("qed_engine.services")

PROBE_CONNECT_TIMEOUT = 0.5  # socket 预检：未监听端口快速判定（Windows 防火墙丢包场景）
PROBE_TIMEOUT = 1.0  # HTTP 确认超时（端口已监听时健康检查）
TRANSITION_WINDOW = 15.0
STOP_GRACE_SECONDS = 5.0
# backend/qed_engine/services/service_manager.py → parents[3] = 仓库根（P1 目录迁移后 src/ → backend/）
ROOT = Path(__file__).resolve().parents[3]
LOG_DIR = ROOT / "logs"

NEW_PROCESS_GROUP = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
CTRL_BREAK_EVENT = getattr(signal, "CTRL_BREAK_EVENT", signal.SIGTERM)

RESTART_DELAY_SECONDS = 2.0  # 新进程延迟启动秒数（ping -n N 近似等待，N = delay+1）
RESTART_EXIT_DELAY_SECONDS = 1.0  # 旧进程延迟退出：先确认新进程 spawn 成功
SCRIPT_TIMEOUT_SECONDS = 30.0  # 子项目生命周期脚本调用超时（start 拉起即返 / stop 含 5s 宽限 + 强杀）
SCRIPT_EXIT_UNMANAGED = 3  # 脚本回报「端口由非本脚本启动的进程监听、只检测不杀」（DEFECT-020）

# PID 存活判定常量（Windows kernel32，口径同 scripts/qed_web_service.py:_proc_alive）
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
STILL_ACTIVE = 259  # 「进程尚未退出」的伪退出码
ERROR_ACCESS_DENIED = 5


@dataclass(frozen=True)
class ServiceSpec:
    """启停单元定义（服务注册表，service-hosting.md）。

    lifecycle_script：子项目自含生命周期脚本（REQ-017①，QED-Tracker
    `scripts/qed_tracker_service.py`）；存在时 start/stop 黑盒调用脚本，不持有 Popen。
    """

    name: str
    label: str
    port: int
    log_name: str
    commands: tuple[tuple[str, ...], ...]
    workdir: str
    lifecycle_script: str | None = None


@dataclass
class ManagedProcess:
    """8900 托管记录：进程对象 + PID + 启动时间 + 停止原因。

    process 在脚本模式下为 None（脚本自含生命周期，8900 只记 PID 用于前端展示）。
    """

    pid: int
    started_at: str
    process: subprocess.Popen | None
    extra_processes: list = field(default_factory=list)
    reason: str = ""


_SPECS: dict[str, ServiceSpec] = {}
_LOCKED: set[str] = set()
_OPS: dict[str, tuple[str, float]] = {}
_MANAGED: dict[str, ManagedProcess] = {}
_RESTARTING = False  # self-restart 并发防抖标志
# 根解析出的数据库配置（DEFECT-015 S1）：随 configure() 刷新，派发子服务时显式注入子进程环境。
# 根 .env 由 pydantic-settings 进程内读取、值从不进 os.environ，不注入时 8901/8902 各自按
# 「真实环境变量 > 自身 .env > 兜底默认」解析，可与根静默连到不同库。密码只进子进程环境，
# 绝不进 /services 响应、日志或异常文本。
_DB_ENV: dict[str, str] = {}
_LAUNCHED_DB: dict[str, str] = {}  # 单元名 → 最近一次经 8900 托管派发时注入的库名
_DB_WARNED: set[tuple[str, str, str]] = set()  # 已告警的（单元, 派发库名, 根库名）：轮询不刷屏


def _port_of(url: str, default: int) -> int:
    try:
        return int(url.rstrip("/").rsplit(":", 1)[1])
    except (ValueError, IndexError):
        return default


def configure(settings: Settings | None = None) -> None:
    """按 Settings（QED_*_URL 可覆盖端口）构建服务注册表并确保日志目录存在。"""
    resolved = settings or Settings()
    specs: dict[str, ServiceSpec] = {}
    config_port = _port_of(resolved.qed_config_center_url, 8900)
    specs["config"] = ServiceSpec(
        name="config",
        label="QED 管理服务（配置中心）",
        port=config_port,
        log_name="config",
        # 启动命令仅供 restart_self 使用；config 单元不可经 /services 启停（路由层 409）
        commands=(
            (
                "python",
                "-m",
                "uvicorn",
                "qed_engine.api.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(config_port),
            ),
        ),
        workdir=str(ROOT),
    )
    specs["tracker"] = ServiceSpec(
        name="tracker",
        label="QED-Tracker 文档下载服务",
        port=_port_of(resolved.qed_tracker_url, 8901),
        log_name="tracker",
        commands=(("python", "-m", "qed_tracker.cli", "serve"),),
        workdir=str(ROOT / "QED-Tracker"),
        # REQ-017①（QED-032）：启停交给子项目自含生命周期脚本（PID 文件 + 优雅停止 + 强杀兜底）
        lifecycle_script="scripts/qed_tracker_service.py",
    )
    axiom_port = _port_of(resolved.qed_axiom_url, 8902)
    specs["axiom"] = ServiceSpec(
        name="axiom",
        label="Axiom-Flow 文档解析服务",
        port=axiom_port,
        log_name="axiom",
        # 启动命令仅供展示/参照；axiom 单元启停经生命周期脚本（axiom_flow_service.py，
        # 2026-08-17 REQ-039：对齐 tracker/web 脚本化模式，8900 不再持有 Popen 句柄）
        commands=(("python", "scripts/axiom_flow_service.py", "start"),),
        workdir=str(ROOT / "Axiom-Flow"),
        lifecycle_script="scripts/axiom_flow_service.py",
    )
    web_port = _port_of(resolved.qed_web_url, 8903)
    specs["web"] = ServiceSpec(
        name="web",
        label="QED 前端服务",
        port=web_port,
        log_name="web",
        # 启动命令仅供展示/参照；web 单元启停经生命周期脚本（qed_web_service.py，REQ-03x）
        commands=(("python", "scripts/serve_web.py"),),
        workdir=str(ROOT),
        lifecycle_script="scripts/qed_web_service.py",
    )
    _SPECS.clear()
    _SPECS.update(specs)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    global _DB_ENV
    _DB_ENV = {
        "QED_DB_HOST": resolved.qed_db_host,
        "QED_DB_PORT": str(resolved.qed_db_port),
        "QED_DB_NAME": resolved.qed_db_name,
        "QED_DB_USER": resolved.qed_db_user,
        "QED_DB_PASSWORD": resolved.qed_db_password.get_secret_value(),
    }


# --- 状态判定 ---


def _probe_http(port: int) -> bool:
    """端口 + HTTP 双重探测：socket 预检 → HTTP 200 确认。

    本机 Windows 上未监听端口的 connect 可能被防火墙静默丢弃（非 RST 拒绝），
    httpx 直连会等待到超时（曾实测最坏 3s×2）；socket 预检让未启动服务
    在 PROBE_CONNECT_TIMEOUT 内判定 offline。已监听端口再走 HTTP 健康确认。
    """
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=PROBE_CONNECT_TIMEOUT):
            pass
    except OSError as exc:
        LOG.debug("_probe_http(%d) socket failed: %s", port, exc)
        return False
    try:
        with httpx.Client(timeout=PROBE_TIMEOUT, trust_env=False) as client:
            response = client.get(f"http://127.0.0.1:{port}/api/v1/health")
        if response.status_code != 200:
            LOG.debug("_probe_http(%d) HTTP %d", port, response.status_code)
            return False
        return True
    except httpx.HTTPError as exc:
        LOG.debug("_probe_http(%d) httpx error: %s: %s", port, type(exc).__name__, exc)
        return False


def _pid_alive(pid: int) -> bool:
    """PID 存活判定（Windows 走 kernel32 句柄，毫秒级、无 WMI/GBK 依赖；其余 os.kill(0)）。

    句柄打开失败按错误码区分：ERROR_ACCESS_DENIED＝存活但无权限查询；其余按已退出。
    GetExitCodeProcess 查询失败按存活（未知 ≠ 已死：宁可多等一个窗口，不可误报失败）。
    """
    if pid <= 0:
        return False
    if os.name != "nt":
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        except OSError:
            return True
        return True
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        return ctypes.get_last_error() == ERROR_ACCESS_DENIED
    try:
        exit_code = ctypes.c_ulong()
        if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
            return True
        return exit_code.value == STILL_ACTIVE
    finally:
        kernel32.CloseHandle(handle)


def _managed_alive(managed: ManagedProcess) -> bool:
    """托管记录存活判定：Popen 单元看 poll()；脚本单元（process=None）看 PID。"""
    procs = [managed.process, *managed.extra_processes]
    if any(p is not None for p in procs):
        return any(p is not None and p.poll() is None for p in procs)
    return _pid_alive(managed.pid)


def _op_status(spec: ServiceSpec) -> tuple[str, str] | None:
    """过渡态判定：操作后 15s 窗口内的 starting/stopping（返回 status/reason）。

    OPS-002 提前收敛：启动派发后托管进程已退出（如 8902 建表失败自杀）时，窗口内立即结束
    过渡态并写实失败原因——不压满 15s 再降级成中性的「连接失败」。
    """
    now = time.monotonic()
    op = _OPS.get(spec.name)
    if op is None:
        return None
    op_name, started = op
    if now - started >= TRANSITION_WINDOW:
        _OPS.pop(spec.name, None)
        return None
    if op_name in ("start", "restart"):
        managed = _MANAGED.get(spec.name)
        if managed is not None and not _managed_alive(managed):
            _OPS.pop(spec.name, None)
            managed.reason = f"进程已退出（启动失败，见 {unit_log_path(spec)}）"
            LOG.warning("服务启动即退出 name=%s pid=%s 日志=%s", spec.name, managed.pid, unit_log_path(spec))
            return None
        return "starting", "启动中，等待端口就绪"
    return "stopping", "停止中"


def unit_log_path(spec: ServiceSpec) -> Path:
    """单元日志**实际写入点**（ADR 0019 第 3 条）：生命周期脚本托管的单元读其脚本产物
    `<workdir>/logs/qed-<name>-serve.log`（8901/8902 在各自仓库），其余按注册表命名落根
    `logs/<log_name>.log`；不按猜测命名读取，避免读到停更文件。"""
    if spec.lifecycle_script:
        return Path(spec.workdir) / "logs" / f"qed-{spec.name}-serve.log"
    return LOG_DIR / f"{spec.log_name}.log"


def root_db_name() -> str:
    """根（8900）当前解析到的数据库名——派发子服务时注入的即此值。"""
    return _DB_ENV.get("QED_DB_NAME", "")


def _db_view(spec: ServiceSpec) -> dict:
    """单元的生效库名视图（DEFECT-015 S2）：只透出库名与来源，绝不含主机/用户/口令。

    - `self`＝config 单元即 8900 自身，生效库名恒等于根库名；
    - `injected`＝本进程经生命周期脚本派发过该单元，注入值即其生效值（子服务配置链里真实
      环境变量优先级最高）；
    - `unknown`＝单元状态由端口探测得出但本进程无派发记录（人工/外部启动，或 8900 先重启），
      此时不谎报一致，只如实标不可验证；
    `db_mismatch` 仅在 `injected` 且派发库名≠当前根库名时为真（根 `.env` 改了库名而子服务
    仍是旧进程），同形态只写一次事件账，避免前端轮询刷屏。
    """
    current = root_db_name()
    if spec.name == "config":
        return {"db_name": current, "db_source": "self", "db_mismatch": False}
    launched = _LAUNCHED_DB.get(spec.name)
    if launched is None:
        return {"db_name": "", "db_source": "unknown", "db_mismatch": False}
    mismatch = launched != current
    if mismatch:
        key = (spec.name, launched, current)
        if key not in _DB_WARNED:
            _DB_WARNED.add(key)
            LOG.warning(
                "db_mismatch unit=%s launched_db=%s root_db=%s：该单元由旧库名派发且仍在运行，"
                "读写可落在不同库（重启该单元以重新派发）",
                spec.name,
                launched,
                current,
            )
    return {"db_name": launched, "db_source": "injected", "db_mismatch": mismatch}


def service_status(spec: ServiceSpec) -> dict:
    """单服务状态快照：config 恒 online；其余优先过渡态，其次 HTTP 探测。"""
    base = {
        "name": spec.name,
        "label": spec.label,
        "port": spec.port,
        "log_path": str(unit_log_path(spec)),
        **_db_view(spec),
    }
    if spec.name == "config":
        return {**base, "status": "online", "pid": None, "started_at": None, "reason": ""}

    transition = _op_status(spec)
    if transition:
        managed = _MANAGED.get(spec.name)
        return {
            **base,
            "status": transition[0],
            "pid": managed.pid if managed else None,
            "started_at": managed.started_at if managed else None,
            "reason": transition[1],
        }

    managed = _MANAGED.get(spec.name)
    if _probe_http(spec.port):
        return {
            **base,
            "status": "online",
            "pid": managed.pid if managed else None,
            "started_at": managed.started_at if managed else None,
            "reason": "",
        }
    if managed and managed.reason:
        reason = managed.reason
    elif managed is None:
        reason = "未启动"
    else:
        reason = "连接失败"
    return {**base, "status": "offline", "pid": managed.pid if managed else None, "started_at": None, "reason": reason}


# --- 能力层异常与公开接口 ---


class ServiceError(RuntimeError):
    """服务控制错误：status_code 语义（404 未知服务 / 409 操作冲突 / 500 自身重启失败）。"""

    def __init__(self, message: str, status_code: int = 409) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def require_service(name: str) -> ServiceSpec:
    """校验服务存在并返回 spec；未知服务抛 ServiceError(404)。"""
    spec = _SPECS.get(name)
    if spec is None:
        raise ServiceError(f"未知服务：{name}", status_code=404)
    return spec


def get_specs() -> dict[str, ServiceSpec]:
    """服务注册表快照（log_viewer 白名单等只读使用）。"""
    return dict(_SPECS)


# --- 进程托管 ---


# --- 子项目生命周期脚本接入（REQ-017①，QED-032 接入契约：service-lifecycle.md） ---


def _parse_script_pid(stdout: str | None) -> int | None:
    """解析脚本 stdout 首行 `pid: <n>`；无匹配返回 None。"""
    for line in (stdout or "").splitlines():
        line = line.strip()
        if line.startswith("pid:"):
            try:
                return int(line.split(":", 1)[1].strip())
            except ValueError:
                return None
    return None


def _child_env() -> dict[str, str]:
    """派发子进程的环境：`os.environ` 副本 + 根解析出的 `QED_DB_*`（DEFECT-015 S1）。

    真实环境变量在两个子服务的配置链里优先级最高，故注入即钉定其生效库名；只写在这份副本里，
    根进程 `os.environ` 不被改（配置正本仍是根 `.env`，不新增环境变量键）。
    """
    return {**os.environ, **_DB_ENV}


def _read_pid_file(path: Path) -> int | None:
    """读取脚本 PID 文件（纯 PID 文本）；缺失/非法返回 None。"""
    try:
        return int(path.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return None


def _start_via_script(spec: ServiceSpec) -> int:
    """经子项目生命周期脚本启动：`python <script> start`（workdir=子项目仓库根）。

    脚本拉起子进程后立即返回；PID 取 stdout 首行 `pid: <n>`，兜底读脚本 PID 文件
    （`logs/qed-<name>.pid`，如 tracker→qed-tracker.pid、web→qed-web.pid），仅用于
    前端展示。脚本失败抛 ServiceError(500)。
    """
    script = spec.lifecycle_script
    assert script is not None
    try:
        result = subprocess.run(
            [sys.executable, script, "start"],
            cwd=spec.workdir,
            capture_output=True,
            text=True,
            errors="replace",  # DEFECT-019: GBK console output must not kill the reader thread
            timeout=SCRIPT_TIMEOUT_SECONDS,
            env=_child_env(),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ServiceError(f"{spec.label} 生命周期脚本执行失败：{exc}", status_code=500) from exc
    if result.returncode != 0:
        raise ServiceError(
            f"{spec.label} 启动失败（脚本退出码 {result.returncode}）：{(result.stderr or "").strip()}",
            status_code=500,
        )
    _LAUNCHED_DB[spec.name] = _DB_ENV.get("QED_DB_NAME", "")
    pid = _parse_script_pid(result.stdout)
    if pid is None:
        pid = _read_pid_file(Path(spec.workdir) / "logs" / f"qed-{spec.name}.pid")
    if pid is None:
        raise ServiceError(f"{spec.label} 启动成功但未取得 PID（脚本输出异常）", status_code=500)
    return pid


def _stop_via_script(spec: ServiceSpec) -> str:
    """经脚本停止：优雅停止 + 强杀兜底由脚本自含（幂等退出 0）；失败抛 ServiceError(500)。

    返回脚本 stdout 供停止后复核使用——脚本对「无 PID 文件」的实例只打印提示并退出 0，
    根侧自有脚本（8903 web / 8900 engine）在该形另以 `SCRIPT_EXIT_UNMANAGED`（3）回报，
    两者都只说明「脚本没动过进程」，不足以判定停止是否生效，故一并交端口复核裁决。
    """
    script = spec.lifecycle_script
    assert script is not None
    try:
        result = subprocess.run(
            [sys.executable, script, "stop"],
            cwd=spec.workdir,
            capture_output=True,
            text=True,
            errors="replace",  # DEFECT-019: GBK console output must not kill the reader thread
            timeout=SCRIPT_TIMEOUT_SECONDS,
            env=_child_env(),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ServiceError(f"{spec.label} 停止脚本执行失败：{exc}", status_code=500) from exc
    if result.returncode not in (0, SCRIPT_EXIT_UNMANAGED):
        raise ServiceError(
            f"{spec.label} 停止失败（脚本退出码 {result.returncode}）：{(result.stderr or "").strip()}",
            status_code=500,
        )
    return result.stdout or ""


def _parse_netstat_pid(text: str, port: int) -> int | None:
    """从 `netstat -ano` 文本取该端口 LISTENING 行的 PID；无匹配返回 None。"""
    suffix = f":{port}"
    for line in text.splitlines():
        cols = line.split()
        if len(cols) < 5 or cols[0] != "TCP" or cols[3] != "LISTENING":
            continue
        if cols[1].endswith(suffix):
            try:
                return int(cols[4])
            except ValueError:
                return None
    return None


def _listening_pid(port: int) -> int | None:
    """端口反查监听进程 PID（OPS-001 只读诊断，根侧不据此终止任何进程）。

    形态同 `monitor._run_smi`：字节捕获 + 容错解码（本机 netstat 走 GBK 管道）；
    命令不可用或输出无法解析时返回 None，由调用方降级为「未取得监听 PID」。
    """
    try:
        result = subprocess.run(["netstat", "-ano"], capture_output=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return None
    blob = result.stdout
    text = blob.decode("utf-8", errors="replace") if isinstance(blob, bytes) else (blob or "")
    return _parse_netstat_pid(text, port)


def _start(spec: ServiceSpec) -> dict:
    now = time.monotonic()
    op = _OPS.get(spec.name)
    if op and op[0] in ("start", "restart") and now - op[1] < TRANSITION_WINDOW:
        raise ServiceError("服务正在启动（过渡窗口内），请稍后再试")
    if _probe_http(spec.port):
        raise ServiceError(f"服务已在线（端口 {spec.port} 探测通过），不可重复启动")
    _LOCKED.add(spec.name)
    try:
        if spec.lifecycle_script:
            pid = _start_via_script(spec)
            managed = ManagedProcess(pid=pid, started_at=datetime.now(UTC).isoformat(), process=None)
        else:
            procs = []
            for cmd in spec.commands:
                log_file = open(unit_log_path(spec), "ab")  # noqa: SIM115 - 随进程生命周期
                try:
                    proc = subprocess.Popen(
                        list(cmd),
                        cwd=spec.workdir,
                        stdout=log_file,
                        stderr=subprocess.STDOUT,
                        creationflags=NEW_PROCESS_GROUP,
                        env=os.environ.copy(),
                    )
                except Exception:
                    log_file.close()  # Popen 失败时不泄漏日志句柄（如 workdir 无效 WinError 267）
                    raise
                procs.append(proc)
            started_at = datetime.now(UTC).isoformat()
            managed = ManagedProcess(pid=procs[0].pid, started_at=started_at, process=procs[0])
            if len(procs) > 1:
                managed.extra_processes = procs[1:]
    finally:
        _LOCKED.discard(spec.name)

    _MANAGED[spec.name] = managed
    _OPS[spec.name] = ("start", time.monotonic())
    return {"name": spec.name, "status": "starting", "pid": managed.pid}


def _stop_process(proc: subprocess.Popen) -> str | None:
    """优雅停止：CTRL_BREAK 发送到进程组，5s 宽限后 taskkill 强杀兜底。

    返回强杀原因，优雅退出返回 None。
    """
    if proc.poll() is None:
        try:
            os.kill(proc.pid, CTRL_BREAK_EVENT)
        except OSError:
            try:
                proc.kill()
            except Exception:
                pass
    deadline = time.monotonic() + STOP_GRACE_SECONDS
    while time.monotonic() < deadline and proc.poll() is None:
        time.sleep(0.1)
    if proc.poll() is None:
        try:
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True, timeout=10)
        except Exception:
            proc.kill()
        return "停止超时强杀"
    return None


def _stop(spec: ServiceSpec) -> dict:
    now = time.monotonic()
    op = _OPS.get(spec.name)
    if op and op[0] in ("stop", "restart") and now - op[1] < TRANSITION_WINDOW:
        raise ServiceError("服务正在停止（过渡窗口内），请稍后再试")
    managed = _MANAGED.get(spec.name)
    if managed is None:
        # 生命周期脚本单元：脚本自含 PID 文件，不依赖 8900 托管记录（REQ-017① 契约）——
        # 探测在线（外部/脚本手动启动）即可经脚本停止；离线且未托管仍 409。
        if spec.lifecycle_script and _probe_http(spec.port):
            pass
        else:
            raise ServiceError("服务未由控制中心托管（无 PID 记录），无法托管停止")
    _LOCKED.add(spec.name)
    try:
        if spec.lifecycle_script:
            script_stdout = _stop_via_script(spec)
            # OPS-001：脚本对「无 PID 文件」的实例只打印提示并以 0 退出，退出码不足以判定停止
            # 生效。派发后按端口复核——脚本回报未纳管而端口仍监听时如实报错（原因给出端口反查
            # 到的监听 PID），不返回裸 stopping、不置过渡标记；根侧不终止非本中心启动的进程。
            if _probe_http(spec.port):
                pid = _listening_pid(spec.port)
                who = f"监听 PID {pid}" if pid is not None else "监听 PID 未取得"
                raise ServiceError(
                    f"{spec.label} 未经本控制中心纳管，停止未生效（端口 {spec.port} 仍监听，"
                    f"{who}，脚本回报：{(script_stdout or '').strip() or '无输出'}）；"
                    "控制中心不终止非本中心启动的进程，请用该服务自身的生命周期脚本或人工停止",
                    status_code=409,
                )
            _LAUNCHED_DB.pop(spec.name, None)
        else:
            procs = [managed.process, *managed.extra_processes]
            reason = ""
            for proc in procs:
                if proc is not None and proc.poll() is None:
                    if _stop_process(proc):
                        reason = "停止超时强杀"
            managed.reason = reason
    finally:
        _LOCKED.discard(spec.name)
    _OPS[spec.name] = ("stop", time.monotonic())
    return {"name": spec.name, "status": "stopping", "pid": None}


# --- 8900 自身重启（self-restart） ---


def restart_self() -> dict:
    """8900 自身重启：延迟启动新进程（同命令同端口）→ 返回 restarting → 后台旧进程退出。

    Windows 时序：新进程以 `cmd /c ping -n <delay+1> 127.0.0.1 >nul && <启动命令>` 延迟绑定
    端口（ping 延迟与 stdin 无关；timeout 在重定向 stdin 下不可用），旧进程 1s 后
    os._exit(0) 释放端口。同端口下无法在旧进程存活时先健康确认（新进程绑定必然失败），
    失败路径由 config.log 暴露（新进程 uvicorn 报错）并人工重启兜底；spawn 失败同步抛
    ServiceError(500)（响应前可知）。并发防抖：上一轮重启未退出期间重复请求 409。
    不动既有 /services 语义（config 单元仍不可经 /services 启停）。
    """
    global _RESTARTING  # 模块级防抖标志（定义见模块级状态区）
    spec = _SPECS.get("config")
    if spec is None or not spec.commands:
        raise ServiceError("8900 重启失败：config 注册表未初始化，请人工重启", status_code=500)
    if _RESTARTING:
        raise ServiceError("8900 正在重启（过渡窗口内），请稍后再试")
    base_cmd = list(spec.commands[0])
    base_cmd[0] = sys.executable  # PATH 的 python 可能是无 uvicorn 的 base 环境（C1）
    ping_wait = int(RESTART_DELAY_SECONDS) + 1
    delayed_cmd = [
        "cmd",
        "/c",
        f"ping -n {ping_wait} 127.0.0.1 >nul && " + " ".join(base_cmd),
    ]
    log_file = None
    try:
        log_file = open(LOG_DIR / "config.log", "ab")  # noqa: SIM115 - 随进程生命周期
        subprocess.Popen(
            delayed_cmd,
            cwd=spec.workdir,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            creationflags=NEW_PROCESS_GROUP,
            env=os.environ.copy(),
        )
    except Exception:
        if log_file is not None:
            log_file.close()  # Popen 失败不泄漏日志句柄
        raise ServiceError("8900 重启失败：新进程启动异常，请人工重启", status_code=500) from None

    _RESTARTING = True  # 模块级防抖标志（定义见模块级状态区）

    def _exit_old() -> None:
        global _RESTARTING  # 函数内赋值模块级标志需 global
        try:
            time.sleep(RESTART_EXIT_DELAY_SECONDS)
            os._exit(0)
        finally:
            _RESTARTING = False  # 仅在测试 mock 下可达（真实环境 os._exit 终止进程）

    threading.Thread(target=_exit_old, daemon=True).start()
    return {"status": "restarting"}
