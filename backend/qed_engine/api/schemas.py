"""
模块职责：配置中心 API 的请求与响应模型。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
"""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class ModelRoute(BaseModel):
    model: str
    provider: str
    configured: bool


class ModelsResponse(BaseModel):
    """模型路由表（单线路：qwen 三用途；备选线路启用时恢复字段）。"""

    default: ModelRoute
    ocr: ModelRoute
    embedding: ModelRoute


class KeysResponse(BaseModel):
    """供应商密钥状态：单 key + 当前厂商选择 + 运行模式（不含密钥值）。"""

    provider: str
    configured: bool
    # 运行模式：api（云端厂商）/ local（本地 Qwen / MinerU）；前端依赖卡模式感知用
    mode: str = "api"


class DatabaseResponse(BaseModel):
    host: str
    port: int
    name: str
    user: str
    configured: bool
    reachable: bool = False
    reason: str = ""


class LogsResponse(BaseModel):
    service: str
    log_path: str
    lines: list[str]


class GpuStatus(BaseModel):
    available: bool
    name: str = ""
    memory_total_mb: int = 0
    memory_used_mb: int = 0
    utilization_percent: int = 0
    processes: list[dict] = []
    sys_memory_total_mb: int = 0
    sys_memory_used_mb: int = 0
    sys_memory_percent: int = 0
    reason: str = ""


class QwenStatus(BaseModel):
    reachable: bool
    base_url: str = ""
    models: list[str] = []
    reason: str = ""


class MineruStatus(BaseModel):
    reachable: bool
    port: int = 8002
    reason: str = ""


class LlmTextRequest(BaseModel):
    prompt: str
    system: str | None = None
    prompt_template: str | None = None
    max_tokens: int | None = None


class LlmVisionRequest(BaseModel):
    image_base64: str | None = None
    pdf_base64: str | None = None
    pdf_filename: str = "input.pdf"
    prompt: str = "识别并输出图片内容"
    prompt_template: str | None = None
    max_tokens: int | None = None


class LlmCallResponse(BaseModel):
    reply: str
    call_id: int | None = None
    success: bool
    error: str = ""


class LlmTestResponse(BaseModel):
    ok: bool
    detail: str = ""
    call_id: int | None = None


class CallLogItem(BaseModel):
    id: int
    service: str
    mode: str
    provider: str
    model: str
    endpoint: str
    prompt_template: str | None = None
    prompt: str
    response: str
    duration_ms: int | None = None
    status: str
    error: str | None = None
    created_at: str
    task: str | None = None
    step: str | None = None
    review_status: str = "unreviewed"
    review_note: str = ""


class CallsResponse(BaseModel):
    items: list[CallLogItem]
    total: int
    page: int
    size: int


class ReviewCallRequest(BaseModel):
    review_status: str
    review_note: str = ""


class ReviewCallResponse(BaseModel):
    ok: bool
    call_id: int
