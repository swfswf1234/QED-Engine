"""QED-Engine 配置中心 API：健康检查与模型路由，密钥不下发。

设计关联（DesignRef）：docs/design/config-center-api.md
实现状态：Current
关联测试：tests/test_api.py
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from qed_engine import __version__
from qed_engine.api.schemas import HealthResponse, KeysResponse, ModelRoute, ModelsResponse
from qed_engine.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """组装 API；测试可注入确定性 Settings。"""
    resolved = settings or Settings()

    app = FastAPI(title="QED-Engine Config", version=__version__)
    app.state.settings = resolved
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:8000",
            "http://localhost:8000",
            "http://127.0.0.1:8900",
        ],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok", service="qed-engine-config", version=__version__)

    @app.get("/api/v1/config/models", response_model=ModelsResponse)
    def models() -> ModelsResponse:
        """模型路由表：各供应商/用途的推荐模型，子项目不感知密钥。"""
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
            glm=ModelRoute(
                model=resolved.glm_model,
                provider="glm",
                configured=resolved.has_configured("glm"),
            ),
            glm_ocr=ModelRoute(
                model=resolved.glm_ocr_model,
                provider="glm",
                configured=resolved.has_configured("glm"),
            ),
            deepseek=ModelRoute(
                model=resolved.deepseek_model,
                provider="deepseek",
                configured=resolved.has_configured("deepseek"),
            ),
        )

    @app.get("/api/v1/config/keys", response_model=KeysResponse)
    def keys() -> KeysResponse:
        """供应商配置状态（管理界面用），不含密钥值。"""
        return KeysResponse(
            deepseek=resolved.has_configured("deepseek"),
            qwen=resolved.has_configured("qwen"),
            glm=resolved.has_configured("glm"),
        )

    return app


app = create_app()
