"""服务控制：8900 对 8901/8902 的启停托管与状态展示（控制中心，service-control.md 契约）。

前端（8903）只连 8900（ADR 0007）：/services 端点族查询/启动/停止/重启三 Python 服务；
8900 自身（config 单元）只显示状态不可经自身启停（避免自掘）。状态判定优先 HTTP 端口
探测（3s 超时）；启停为同步轻量操作（Popen 创建/信号发送即返回），状态收敛由前端轮询
/services 观察（操作后 15s 过渡窗口）。

设计关联（DesignRef）：docs/design/service-control.md
实现状态：Current
关联测试：tests/test_api.py
"""

import os
import signal
import subprocess
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from qed_engine.config import Settings

router = APIRouter(prefix="/api/v1", tags=["services"])

PROBE_TIMEOUT = 3.0
TRANSITION_WINDOW = 15.0
STOP_GRACE_SECONDS = 5.0
# backend/qed_engine/api/service_manager.py → parents[3] = 仓库根（P1 目录迁移后 src/ → backend/）
ROOT = Path(__file__).resolve().parents[3]
LOG_DIR = ROOT / "logs"

NEW_PROCESS_GROUP = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
CTRL_BREAK_EVENT = getattr(signal, "CTRL_BREAK_EVENT", signal.SIGTERM)


@dataclass(frozen=True)
class ServiceSpec:
    """启停单元定义（服务注册表，service-control.md）。"""

    name: str
    label: str
    port: int
    log_name: str
    commands: tuple[tuple[str, ...], ...]
    workdir: str


@dataclass
class ManagedProcess:
    """8900 托管记录：进程对象 + PID + 启动时间 + 停止原因。"""

    pid: int
    started_at: str
    process: subprocess.Popen
    extra_processes: list = field(default_factory=list)
    reason: str = ""


_SPECS: dict[str, ServiceSpec] = {}
_LOCKED: set[str] = set()
_OPS: dict[str, tuple[str, float]] = {}
_MANAGED: dict[str, ManagedProcess] = {}


def _port_of(url: str, default: int) -> int:
    try:
        return int(url.rstrip("/").rsplit(":", 1)[1])
    except (ValueError, IndexError):
        return default


def configure(settings: Settings | None = None) -> None:
    """按 Settings（QED_*_URL 可覆盖端口）构建服务注册表并确保日志目录存在。"""
    resolved = settings or Settings()
    specs: dict[str, ServiceSpec] = {}
    specs["config"] = ServiceSpec(
        name="config",
        label="QED 管理服务（配置中心）",
        port=_port_of(resolved.qed_config_center_url, 8900),
        log_name="config",
        commands=(),
        workdir=str(ROOT),
    )
    specs["tracker"] = ServiceSpec(
        name="tracker",
        label="QED-Tracker 文档下载服务",
        port=_port_of(resolved.qed_tracker_url, 8901),
        log_name="tracker",
        commands=(("python", "-m", "qed_tracker.cli", "serve"),),
        workdir=str(ROOT / "QED-Tracker"),
    )
    axiom_port = _port_of(resolved.qed_axiom_url, 8902)
    specs["axiom"] = ServiceSpec(
        name="axiom",
        label="Axiom-Flow 文档解析服务",
        port=axiom_port,
        log_name="axiom",
        commands=(
            (
                "python",
                "-m",
                "uvicorn",
                "axiom_flow.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(axiom_port),
            ),
            ("python", "-m", "axiom_flow.worker"),
        ),
        workdir=str(ROOT / "Axiom-Flow"),
    )
    _SPECS.clear()
    _SPECS.update(specs)
    LOG_DIR.mkdir(parents=True, exist_ok=True)


# --- 状态判定 ---


def _probe_http(port: int) -> bool:
    """HTTP 端口探测：/api/v1/health 200 即 online（3s 超时，测试可注入）。"""
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


# --- 进程托管 ---


def _require(name: str) -> ServiceSpec:
    spec = _SPECS.get(name)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"未知服务：{name}")
    return spec


def _conflict(message: str):
    raise HTTPException(status_code=409, detail=message)


def _start(spec: ServiceSpec) -> dict:
    now = time.monotonic()
    op = _OPS.get(spec.name)
    if op and op[0] in ("start", "restart") and now - op[1] < TRANSITION_WINDOW:
        _conflict("服务正在启动（过渡窗口内），请稍后再试")
    if _probe_http(spec.port):
        _conflict(f"服务已在线（端口 {spec.port} 探测通过），不可重复启动")
    _LOCKED.add(spec.name)
    try:
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
    finally:
        _LOCKED.discard(spec.name)

    started_at = datetime.now(UTC).isoformat()
    managed = ManagedProcess(pid=procs[0].pid, started_at=started_at, process=procs[0])
    if len(procs) > 1:
        managed.extra_processes = procs[1:]
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
        _conflict("服务正在停止（过渡窗口内），请稍后再试")
    managed = _MANAGED.get(spec.name)
    if managed is None:
        _conflict("服务未由控制中心托管（无 PID 记录），无法托管停止")
    assert managed is not None
    _LOCKED.add(spec.name)
    try:
        procs = [managed.process, *managed.extra_processes]
        reason = ""
        for proc in procs:
            if proc is not None and proc.poll() is None:
                if _stop_process(proc):
                    reason = "停止超时强杀"
    finally:
        _LOCKED.discard(spec.name)
    managed.reason = reason
    _OPS[spec.name] = ("stop", time.monotonic())
    return {"name": spec.name, "status": "stopping", "pid": None}


# --- 端点 ---


class ActionResponse(BaseModel):
    name: str
    status: str
    pid: int | None = None


@router.get("/services")
def list_services() -> dict:
    """三服务状态快照，同步返回。"""
    return {"services": [service_status(spec) for spec in _SPECS.values()]}


@router.post("/services/{name}/start", response_model=ActionResponse)
def start_service(name: str) -> ActionResponse:
    spec = _require(name)
    if spec.name == "config":
        _conflict("config（8900 自身）不可经控制中心启停")
    return ActionResponse(**_start(spec))


@router.post("/services/{name}/stop", response_model=ActionResponse)
def stop_service(name: str) -> ActionResponse:
    spec = _require(name)
    if spec.name == "config":
        _conflict("config（8900 自身）不可经控制中心启停")
    return ActionResponse(**_stop(spec))


@router.post("/services/{name}/restart", response_model=ActionResponse)
def restart_service(name: str) -> ActionResponse:
    """先停后启（复用 stop → start 语义）；未托管时直接启动。"""
    spec = _require(name)
    if spec.name == "config":
        _conflict("config（8900 自身）不可经控制中心启停")
    managed = _MANAGED.get(spec.name)
    if managed is not None:
        _stop(spec)
    return ActionResponse(**_start(spec))