"""控制域路由：服务域 /services + 配置四端点 + 监控诊断（/logs、/monitor/*、/self-restart）。

能力在 services/（service_manager.py / log_viewer.py / monitor.py），本模块只做参数解析、
领域异常 → HTTP 映射与 app.state 缓存访问。对外路径与错误语义保持既有契约不变。
LLM 供应商可达性与 MySQL 连接为 8900 **启动自检**（create_app 时探测一次，见
api/main.py），本模块保留探测函数供启动检查引用；/config/llm-status 端点已删除（ARCH-014）。

设计关联（DesignRef）：docs/design/config-center-api.md
（服务域契约见 docs/design/service-control.md；三域组织见 docs/design/backend-domain-split.md）
实现状态：Current
关联测试：tests/test_api.py、tests/test_log_viewer.py、tests/test_monitor.py、tests/test_self_restart.py
"""

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from qed_engine import __version__
from qed_engine.api.schemas import (
    DatabaseResponse,
    GpuStatus,
    HealthResponse,
    KeysResponse,
    LmStudioStatus,
    LogsResponse,
    MineruStatus,
    ModelRoute,
    ModelsResponse,
)
from qed_engine.config import Settings
from qed_engine.services.log_viewer import LogError, read_log
from qed_engine.services.monitor import probe_gpu, probe_lmstudio, probe_mineru
from qed_engine.services.service_manager import (
    _MANAGED,
    ServiceError,
    _start,
    _stop,
    get_specs,
    require_service,
    restart_self,
    service_status,
)

# LLM 可达性探测（启动自检用）：调各供应商 models 列表接口（免费、无 token 消耗），5s 超时。
PROBE_URLS = {
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
    "glm": "https://open.bigmodel.cn/api/paas/v4/models",
    "deepseek": "https://api.deepseek.com/models",
}
PROBE_TIMEOUT_SECONDS = 5.0

# MySQL 连接探测（启动自检用）：真实认证（pymysql），3s 超时；密码绝不下发。
DB_PROBE_TIMEOUT_SECONDS = 3.0

router = APIRouter(prefix="/api/v1", tags=["control"])


class ActionResponse(BaseModel):
    name: str
    status: str
    pid: int | None = None


def _service_call(fn, *args, **kwargs):
    """执行能力层调用并映射 ServiceError → HTTPException（404/409/500）。"""
    try:
        return fn(*args, **kwargs)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/services")
def list_services() -> dict:
    """三服务状态快照，同步返回（service-control.md 契约）。"""
    return {"services": [service_status(spec) for spec in get_specs().values()]}


@router.post("/services/{name}/start", response_model=ActionResponse)
def start_service(name: str) -> ActionResponse:
    """启动服务，后台托管；config 单元 409（不可经自身启停）。"""

    def _run():
        spec = require_service(name)
        if spec.name == "config":
            raise ServiceError("config（8900 自身）不可经控制中心启停")
        return ActionResponse(**_start(spec))

    return _service_call(_run)


@router.post("/services/{name}/stop", response_model=ActionResponse)
def stop_service(name: str) -> ActionResponse:
    """优雅停止：CTRL_BREAK 到进程组，5s 宽限后强杀兜底；config 单元 409。"""

    def _run():
        spec = require_service(name)
        if spec.name == "config":
            raise ServiceError("config（8900 自身）不可经控制中心启停")
        return ActionResponse(**_stop(spec))

    return _service_call(_run)


@router.post("/services/{name}/restart", response_model=ActionResponse)
def restart_service(name: str) -> ActionResponse:
    """先停后启（复用 stop → start 语义）；未托管时直接启动；config 单元 409。"""

    def _run():
        spec = require_service(name)
        if spec.name == "config":
            raise ServiceError("config（8900 自身）不可经控制中心启停")

        if _MANAGED.get(spec.name) is not None:
            _stop(spec)
        return ActionResponse(**_start(spec))

    return _service_call(_run)


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="qed-engine-config", version=__version__)


@router.get("/config/models", response_model=ModelsResponse)
def models(request: Request) -> ModelsResponse:
    """模型路由表：模型选择单线路（qwen 三用途），子项目不感知密钥。"""
    resolved: Settings = request.app.state.settings
    return ModelsResponse(
        default=ModelRoute(
            model=resolved.qed_model,
            provider="qwen",
            configured=resolved.has_configured("qwen"),
        ),
        ocr=ModelRoute(
            model=resolved.qed_ocr_model,
            provider="qwen",
            configured=resolved.has_configured("qwen"),
        ),
        embedding=ModelRoute(
            model=resolved.qed_embedding_model,
            provider="qwen",
            configured=resolved.has_configured("qwen"),
        ),
    )


@router.get("/config/keys", response_model=KeysResponse)
def keys(request: Request) -> KeysResponse:
    """供应商配置状态（管理界面用），不含密钥值。"""
    resolved: Settings = request.app.state.settings
    return KeysResponse(
        deepseek=resolved.has_configured("deepseek"),
        qwen=resolved.has_configured("qwen"),
        glm=resolved.has_configured("glm"),
    )


@router.get("/config/database", response_model=DatabaseResponse)
def database(request: Request) -> DatabaseResponse:
    """统一数据库配置与连接状态（qed 库）：只含非敏感信息；密码绝不下发。

    8900 启动时真实连接探测一次（create_app → app.state.db_status 启动快照，ARCH-014），
    本端点只读快照，不再按需探测；未配置密码不探测（reachable=false, reason=未配置）。
    """
    resolved: Settings = request.app.state.settings
    snapshot = request.app.state.db_status
    return DatabaseResponse(
        host=resolved.qed_db_host,
        port=resolved.qed_db_port,
        name=resolved.qed_db_name,
        user=resolved.qed_db_user,
        configured=snapshot["configured"],
        reachable=snapshot["reachable"],
        reason=snapshot["reason"],
    )


def _probe_mysql(settings: Settings) -> tuple[bool, str]:
    """真实连接 qed 数据库：认证成功为可达；异常映射为简短原因（不含密码与主机细节）。"""
    import pymysql
    from pymysql import err

    password = settings.qed_db_password.get_secret_value()
    if not password:
        return False, "未配置"
    try:
        connection = pymysql.connect(
            host=settings.qed_db_host,
            port=settings.qed_db_port,
            user=settings.qed_db_user,
            password=password,
            database=settings.qed_db_name,
            connect_timeout=DB_PROBE_TIMEOUT_SECONDS,
        )
    except err.OperationalError as exc:
        code = exc.args[0] if exc.args else None
        if code == 1045:
            return False, "认证失败"
        if code == 2003:
            return False, "连接失败"
        if code == 2013:
            return False, "超时"
        return False, "连接失败"
    except Exception:
        return False, "连接失败"
    connection.close()
    return True, ""


def _probe_llm(provider: str, api_key: str, url: str) -> tuple[bool, str]:
    """真实探测供应商 models 接口：200 为可达；网络/HTTP 异常一律不可达（附原因）。

    密钥只出现在请求头，绝不进入返回值与任何响应体。
    """
    try:
        with httpx.Client() as client:
            response = client.get(
                url,
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=PROBE_TIMEOUT_SECONDS,
                follow_redirects=True,
            )
        if response.status_code == 200:
            return True, ""
        return False, f"HTTP {response.status_code}"
    except httpx.TimeoutException:
        return False, "超时"
    except httpx.HTTPError as exc:
        return False, type(exc).__name__


@router.get("/logs/{service}", response_model=LogsResponse)
def logs(service: str, tail: int = 200, keyword: str | None = None) -> LogsResponse:
    """服务日志查看（控制台诊断）：白名单 tail/keyword；未知服务 404。"""
    try:
        return LogsResponse(**read_log(service, tail, keyword))
    except LogError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/monitor/gpu", response_model=GpuStatus)
def monitor_gpu() -> GpuStatus:
    """GPU 状态（nvidia-smi 解析）；不可用也 200 + reason（控制台降级显示）。"""
    return GpuStatus(**probe_gpu())


@router.get("/monitor/lmstudio", response_model=LmStudioStatus)
def monitor_lmstudio(request: Request) -> LmStudioStatus:
    """本地 LLM（LM Studio）探测：可达性 + 已加载模型。"""
    return LmStudioStatus(**probe_lmstudio(request.app.state.settings))


@router.get("/monitor/mineru", response_model=MineruStatus)
def monitor_mineru() -> MineruStatus:
    """mineru 解析服务（8002）健康探测。"""
    return MineruStatus(**probe_mineru())


@router.post("/self-restart")
def self_restart() -> dict:
    """8900 自身重启（控制台「重启」按钮）：spawn 新进程 → 后台旧进程退出。

    config 单元不可经 /services 启停的既有限制保持；失败返回明确错误提示人工重启。
    """
    try:
        return restart_self()
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
