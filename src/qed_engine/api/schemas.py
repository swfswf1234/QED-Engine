"""API 响应模型。"""

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
