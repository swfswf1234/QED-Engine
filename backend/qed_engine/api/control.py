"""控制域路由：服务域 /services + 配置四端点 + 监控诊断（/logs、/monitor/*、/self-restart）。

能力在 services/（service_manager.py / log_viewer.py / monitor.py），本模块只做参数解析、
领域异常 → HTTP 映射与 app.state 缓存访问。对外路径与错误语义保持既有契约不变。
LLM 供应商可达性与 MySQL 连接为 8900 **启动自检**（create_app 时探测一次，见
api/main.py），本模块保留探测函数供启动检查引用；/config/llm-status 端点已删除（ARCH-014）。

设计关联（DesignRef）：docs/architecture/api-contracts.md
（服务域契约见 docs/design/service-control.md；三域组织见 docs/design/backend-domain-split.md；
LLM 网关端点契约见 docs/design/llm-gateway-and-model-management.md）
实现状态：Current
关联测试：tests/test_api.py、tests/test_log_viewer.py、tests/test_monitor.py、tests/test_self_restart.py、
tests/test_llm_endpoints.py
"""

import base64
import binascii

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from qed_engine import __version__
from qed_engine.api.schemas import (
    CallLogItem,
    CallsResponse,
    DatabaseResponse,
    GpuStatus,
    HealthResponse,
    KeysResponse,
    LlmCallResponse,
    LlmTestResponse,
    LlmTextRequest,
    LlmVisionRequest,
    LmStudioStatus,
    LogsResponse,
    MineruStatus,
    ModelRoute,
    ModelsResponse,
    ReviewCallRequest,
    ReviewCallResponse,
)
from qed_engine.config import Settings
from qed_engine.services.llm import call_log as llm_call_log
from qed_engine.services.llm import clients as llm_clients
from qed_engine.services.llm import gateway as llm_gateway
from qed_engine.services.log_viewer import LogError, read_log
from qed_engine.services.monitor import probe_gpu, probe_lmstudio, probe_memory, probe_mineru
from qed_engine.services.service_manager import (
    _MANAGED,
    ServiceError,
    _probe_http,
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
    """先停后启（复用 stop → start 语义）；config 单元 409。

    生命周期脚本单元（tracker/web）：运行中（托管记录或端口探测在线，含外部/脚本手动
    启动）即先经脚本停止——脚本幂等，未托管但在线时同样生效（REQ-017① 契约）；离线则
    直接启动。Popen 单元维持原语义：仅托管记录存在时先停后启。
    """

    def _run():
        spec = require_service(name)
        if spec.name == "config":
            raise ServiceError("config（8900 自身）不可经控制中心启停")

        if spec.lifecycle_script:
            if _MANAGED.get(spec.name) is not None or _probe_http(spec.port):
                _stop(spec)
        else:
            if _MANAGED.get(spec.name) is not None:
                _stop(spec)
        return ActionResponse(**_start(spec))

    return _service_call(_run)


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="qed-engine-config", version=__version__)


@router.get("/config/models", response_model=ModelsResponse)
def models(request: Request) -> ModelsResponse:
    """模型路由表：按 QED_API_PROVIDER 路由，返回解析后生效模型（厂商默认兜底）。"""
    resolved: Settings = request.app.state.settings
    provider = resolved.qed_api_provider
    text_model = llm_clients.resolve_text(provider, resolved.qed_model)[1]
    vision = llm_clients.resolve_vision(provider, resolved.qed_ocr_model)
    return ModelsResponse(
        default=ModelRoute(
            model=text_model,
            provider=provider,
            configured=resolved.api_configured,
        ),
        ocr=ModelRoute(
            model=vision[1] if vision else "（无视觉）",
            provider=provider,
            configured=resolved.api_configured,
        ),
        embedding=ModelRoute(
            model=resolved.qed_embedding_model,
            provider=provider,
            configured=resolved.api_configured,
        ),
    )


@router.get("/config/keys", response_model=KeysResponse)
def keys(request: Request) -> KeysResponse:
    """供应商配置状态（管理界面用）：单 key 布尔 + 当前厂商 + 运行模式，不含密钥值。"""
    resolved: Settings = request.app.state.settings
    return KeysResponse(
        provider=resolved.qed_api_provider,
        configured=resolved.api_configured,
        mode=resolved.qed_api_select,
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


def gateway_call_text(settings, **kwargs):
    return llm_gateway.call_text(settings, **kwargs)


def gateway_call_vision(settings, **kwargs):
    return llm_gateway.call_vision(settings, **kwargs)


def gateway_search_calls(settings, **kwargs):
    return llm_call_log.search_calls(settings, **kwargs)


def gateway_review_call(settings, **kwargs):
    return llm_call_log.review_call(settings, **kwargs)


@router.post("/llm/text", response_model=LlmCallResponse)
def llm_text(request: Request, payload: LlmTextRequest) -> LlmCallResponse:
    """文字模型调用（api/local 路由由网关处理，调用记录落 qed_llm_calls）。"""
    resolved: Settings = request.app.state.settings
    return LlmCallResponse(**gateway_call_text(
        resolved, prompt=payload.prompt, system=payload.system,
        prompt_template=payload.prompt_template, max_tokens=payload.max_tokens,
    ))


@router.post("/llm/vision", response_model=LlmCallResponse)
def llm_vision(request: Request, payload: LlmVisionRequest) -> LlmCallResponse:
    """视觉模型调用：api 模式收 image_base64；local 模式收 pdf_base64（MinerU）。"""
    if not payload.image_base64 and not payload.pdf_base64:
        raise HTTPException(status_code=422, detail="image_base64 与 pdf_base64 至少提供一个")
    resolved: Settings = request.app.state.settings
    pdf_bytes = None
    if payload.pdf_base64:
        try:
            pdf_bytes = base64.b64decode(payload.pdf_base64, validate=True)
        except binascii.Error:
            raise HTTPException(status_code=422, detail="pdf_base64 不是合法的 Base64 数据") from None
        if not pdf_bytes:
            raise HTTPException(status_code=422, detail="pdf_base64 不是合法的 Base64 数据")
    return LlmCallResponse(**gateway_call_vision(
        resolved, image_base64=payload.image_base64, pdf_bytes=pdf_bytes,
        pdf_filename=payload.pdf_filename, prompt=payload.prompt,
        prompt_template=payload.prompt_template, max_tokens=payload.max_tokens,
    ))


@router.post("/llm/test/text", response_model=LlmTestResponse)
def llm_test_text(request: Request) -> LlmTestResponse:
    """文字模型测试（控制台测试按钮）：小 prompt 真实调用，成功/失败 + 原因。"""
    resolved: Settings = request.app.state.settings
    result = gateway_call_text(resolved, prompt="请回复「OK」两个字。", prompt_template="test")
    return LlmTestResponse(ok=result["success"], detail=(result["error"] or "")[:200] or result["reply"][:200],
                           call_id=result["call_id"])


@router.post("/llm/test/vision", response_model=LlmTestResponse)
def llm_test_vision(request: Request) -> LlmTestResponse:
    """图像模型测试：api 模式用小图调 qwen-vl；local 模式做 MinerU 健康探测。"""
    resolved: Settings = request.app.state.settings
    if resolved.qed_api_select == "local":
        status = probe_mineru()
        return LlmTestResponse(ok=status["reachable"], detail=status["reason"] or "MinerU 可达")
    # api 模式：1x1 像素透明 PNG
    tiny_png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    )
    result = gateway_call_vision(resolved, image_base64=base64.b64encode(tiny_png).decode(), prompt="识别图片")
    return LlmTestResponse(ok=result["success"], detail=(result["error"] or "")[:200] or result["reply"][:200],
                           call_id=result["call_id"])


@router.get("/llm/calls", response_model=CallsResponse)
def llm_calls(
    request: Request,
    service: str | None = None,
    mode: str | None = None,
    model: str | None = None,
    status: str | None = None,
    start: str | None = None,
    end: str | None = None,
    task: str | None = None,
    step: str | None = None,
    prompt_template: str | None = None,
    review_status: str | None = None,
    page: int = 1,
    size: int = 20,
) -> CallsResponse:
    """调用记录检索（qed_llm_calls，按多维度过滤，倒序分页）。"""
    resolved: Settings = request.app.state.settings
    result = gateway_search_calls(
        resolved, service=service, mode=mode, model=model, status=status,
        start=start, end=end, task=task, step=step,
        prompt_template=prompt_template, review_status=review_status,
        page=page, size=size,
    )
    return CallsResponse(
        items=[CallLogItem(
            id=item["id"], service=item["service"], mode=item["mode"], provider=item["provider"],
            model=item["model"], endpoint=item["endpoint"], prompt_template=item.get("prompt_template"),
            prompt=item.get("prompt") or "", response=item.get("response") or "",
            duration_ms=item.get("duration_ms"),
            status=item["status"], error=item.get("error"),
            created_at=str(item["created_at"]),
            task=item.get("task"), step=item.get("step"),
            review_status=item.get("review_status") or "unreviewed",
            review_note=item.get("review_note") or "",
        ) for item in result["items"]],
        total=result["total"], page=result["page"], size=result["size"],
    )


@router.patch("/llm/calls/{call_id}/review", response_model=ReviewCallResponse)
def llm_calls_review(
    call_id: int,
    payload: ReviewCallRequest,
    request: Request,
) -> ReviewCallResponse:
    """审核标注（REQ-060）：更新 review_status/review_note；不存在返回 404。"""
    resolved: Settings = request.app.state.settings
    ok = gateway_review_call(
        resolved, call_id=call_id,
        review_status=payload.review_status, review_note=payload.review_note,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="记录不存在")
    return ReviewCallResponse(ok=True, call_id=call_id)


@router.post("/database/test", response_model=DatabaseResponse)
def database_test(request: Request) -> DatabaseResponse:
    """MySQL 即时连接探测（控制台测试按钮；/config/database 仍为启动快照）。"""
    resolved: Settings = request.app.state.settings
    reachable, reason = _probe_mysql(resolved)
    return DatabaseResponse(
        host=resolved.qed_db_host, port=resolved.qed_db_port, name=resolved.qed_db_name,
        user=resolved.qed_db_user, configured=resolved.qed_db_password.get_secret_value() != "",
        reachable=reachable, reason=reason,
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
    """GPU 状态（nvidia-smi 解析）+ 系统内存（GlobalMemoryStatusEx）；不可用也 200 + reason。"""
    return GpuStatus(**probe_gpu(memory_fn=probe_memory))


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
