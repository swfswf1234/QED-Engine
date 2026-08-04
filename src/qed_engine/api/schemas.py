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
    default: ModelRoute
    ocr: ModelRoute
    embedding: ModelRoute
    glm: ModelRoute
    glm_ocr: ModelRoute
    deepseek: ModelRoute


class KeysResponse(BaseModel):
    deepseek: bool
    qwen: bool
    glm: bool
