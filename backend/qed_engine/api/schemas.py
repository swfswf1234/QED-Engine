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
    port: int = 5002
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


class LlmEmbeddingRequest(BaseModel):
    """向量调用请求（PLAN-046：input 文本列表，顺序即返回顺序）。"""

    input: list[str]


class LlmEmbeddingResponse(BaseModel):
    embeddings: list[list[float]]
    call_id: int | None = None
    success: bool
    error: str = ""


class LlmTestResponse(BaseModel):
    ok: bool
    detail: str = ""
    call_id: int | None = None


class ModelSelectRequest(BaseModel):
    """槽位运行态选择（控制台五字段卡）：写 manifest source / runtime / active（至少一项）。

    - source：`api` | `local`；runtime：`lmstudio` | `llamacpp` | `docker` | `default`；
      model：注册表身份名。`{model}` 单字段向后兼容（v2 契约）。
    """

    source: str | None = None
    runtime: str | None = None
    model: str | None = None


class SourceOption(BaseModel):
    """来源下拉选项（本地部署 / API 调用）：status = available / pending（待上线置灰）。"""

    value: str
    label: str
    status: str = "available"


class ChannelOption(BaseModel):
    """渠道下拉选项：status = available（登记可用）/ pending（待上线，置灰）。"""

    value: str
    label: str
    status: str


class SlotOption(BaseModel):
    """模型下拉选项（按来源 × 渠道过滤）。"""

    value: str
    label: str
    description: str = ""


class SlotStatus(BaseModel):
    """槽位状态（GET /models/{slot}，控制台五字段卡数据源）。

    - source：生效来源 api|local；channel：api → `direct`（直连），local → runtime 名。
    - description：当前身份一句话备注（「备注」行）；availability：可用/不可用/未就绪。
    - source_options / channel_options / options：三个下拉的数据源。
    """

    slot: str
    source: str
    channel: str
    runtime: str = ""
    identity: str = ""
    model: str = ""
    provider: str = ""
    base_url: str = ""
    description: str = ""
    ready: bool = False
    availability: str = ""
    source_options: list[SourceOption] = []
    channel_options: list[ChannelOption] = []
    options: list[SlotOption] = []
    notes: list[str] = []
    error: str = ""


class SlotMonitorResponse(BaseModel):
    """槽位泛化探针（GET /monitor/{slot}）：text 按 runtime 探 OpenAI 兼容端点，
    vision 探 MinerU，embedding 无本地 runtime。"""

    slot: str
    runtime: str = ""
    reachable: bool
    base_url: str = ""
    models: list[str] = []
    reason: str = ""


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
