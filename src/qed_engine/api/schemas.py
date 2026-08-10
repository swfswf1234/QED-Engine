"""
模块职责：配置中心 API 的请求与响应模型。
设计关联（DesignRef）：docs/design/config-center-api.md
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
    deepseek: bool
    qwen: bool
    glm: bool


class DatabaseResponse(BaseModel):
    host: str
    port: int
    name: str
    user: str
    configured: bool
    reachable: bool = False
    reason: str = ""


class LlmStatus(BaseModel):
    """单个供应商的 LLM 可达性（需真实探测，非配置布尔）。"""

    reachable: bool
    reason: str = ""
    checked_at: str


class LlmStatusResponse(BaseModel):
    qwen: LlmStatus
    glm: LlmStatus
    deepseek: LlmStatus
