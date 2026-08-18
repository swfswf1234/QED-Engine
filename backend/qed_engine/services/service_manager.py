"""服务控制能力层（控制域）：8900 对 8901/8902 的启停托管、状态探测与自身重启。

前端（8903）只连 8900（ADR 0007）：/services 端点族契约见 docs/design/service-control.md；
本模块只暴露能力函数（无路由），路由与 HTTP 映射在 api/control.py。状态判定优先 HTTP
端口探测（3s 超时）；启停为同步轻量操作（Popen 创建/信号发送即返回），状态收敛由前端轮询
/services 观察（操作后 15s 过渡窗口）。错误以 ServiceError（含 status_code）表达。

设计关联（DesignRef）：docs/design/service-control.md
实现状态：Current
关联测试：tests/test_api.py、tests/test_self_restart.py
"""

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


@dataclass(frozen=True)
class ServiceSpec:
    """启停单元定义（服务注册表，service-control.md）。

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
    except OSError:
        return False
    try:
        with httpx.Client(timeout=PROBE_TIMEOUT) as client:
            response = client.get(f"http://127.0.0.1:{port}/api/v1/health")
        return response.status_code == 200
    except httpx.HTTPError:
        return False


def _op_status(spec: ServiceSpec) -> tuple[str, str] | None:
    """过渡态判定：操作后 15s 窗口内的 starting/stopping（返回 status/reason）。"""
    now = time.monotonic()
    op = _OPS.get(spec.name)
    if op is None:
        return None
    op_name, started = op
    if now - started >= TRANSITION_WINDOW:
        _OPS.pop(spec.name, None)
        return None
    if op_name in ("start", "restart"):
        return "starting", "启动中，等待端口就绪"
    return "stopping", "停止中"


def service_status(spec: ServiceSpec) -> dict:
    """单服务状态快照：config 恒 online；其余优先过渡态，其次 HTTP 探测。"""
    base = {
        "name": spec.name,
        "label": spec.label,
        "port": spec.port,
        "log_path": str(LOG_DIR / f"{spec.log_name}.log"),
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


def _parse_script_pid(stdout: str) -> int | None:
    """解析脚本 stdout 首行 `pid: <n>`；无匹配返回 None。"""
    for line in stdout.splitlines():
        line = line.strip()
        if line.startswith("pid:"):
            try:
                return int(line.split(":", 1)[1].strip())
            except ValueError:
                return None
    return None


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
            timeout=SCRIPT_TIMEOUT_SECONDS,
            env=os.environ.copy(),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ServiceError(f"{spec.label} 生命周期脚本执行失败：{exc}", status_code=500) from exc
    if result.returncode != 0:
        raise ServiceError(
            f"{spec.label} 启动失败（脚本退出码 {result.returncode}）：{result.stderr.strip()}",
            status_code=500,
        )
    pid = _parse_script_pid(result.stdout)
    if pid is None:
        pid = _read_pid_file(Path(spec.workdir) / "logs" / f"qed-{spec.name}.pid")
    if pid is None:
        raise ServiceError(f"{spec.label} 启动成功但未取得 PID（脚本输出异常）", status_code=500)
    return pid


def _stop_via_script(spec: ServiceSpec) -> None:
    """经脚本停止：优雅停止 + 强杀兜底由脚本自含（幂等退出 0）；失败抛 ServiceError(500)。"""
    script = spec.lifecycle_script
    assert script is not None
    try:
        result = subprocess.run(
            [sys.executable, script, "stop"],
            cwd=spec.workdir,
            capture_output=True,
            text=True,
            timeout=SCRIPT_TIMEOUT_SECONDS,
            env=os.environ.copy(),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ServiceError(f"{spec.label} 停止脚本执行失败：{exc}", status_code=500) from exc
    if result.returncode != 0:
        raise ServiceError(
            f"{spec.label} 停止失败（脚本退出码 {result.returncode}）：{result.stderr.strip()}",
            status_code=500,
        )


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
                log_file = open(LOG_DIR / f"{spec.log_name}.log", "ab")  # noqa: SIM115 - 随进程生命周期
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
            _stop_via_script(spec)
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
