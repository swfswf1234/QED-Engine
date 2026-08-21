"""服务日志查看能力（控制域监控诊断）：读取服务注册表白名单日志文件。

白名单 = service_manager 注册表内各单元（config/tracker/axiom），日志文件为根
logs/<log_name>.log；未知服务名抛 LogError（路由层映射 404，越权）；文件不存在视为
空日志（服务未启动过）。tail 默认 200、上限 1000（超限截断）；keyword 为子串过滤；
读取 UTF-8 容错（errors=replace）。

设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_log_viewer.py
"""

from pathlib import Path

from qed_engine.services import service_manager

DEFAULT_TAIL = 200
MAX_TAIL = 1000


class LogError(RuntimeError):
    """未知日志服务（越权）→ 路由层映射 404。"""


def _log_path(service: str) -> Path:
    try:
        spec = service_manager.require_service(service)
    except service_manager.ServiceError as exc:
        raise LogError(f"日志服务不存在：{service}") from exc
    return service_manager.LOG_DIR / f"{spec.log_name}.log"


def read_log(service: str, tail: int = DEFAULT_TAIL, keyword: str | None = None) -> dict:
    """读取日志尾部行；未知服务抛 LogError；文件不存在返回空行。"""
    path = _log_path(service)
    if not path.is_file():
        return {"service": service, "log_path": str(path), "lines": []}
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    if keyword:
        lines = [line for line in lines if keyword in line]
    tail = min(max(tail, 0), MAX_TAIL)
    return {"service": service, "log_path": str(path), "lines": lines[-tail:] if tail > 0 else []}
