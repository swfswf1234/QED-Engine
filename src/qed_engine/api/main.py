"""QED-Engine 配置中心 API：健康检查、模型路由与 LLM 可达性探测，密钥不下发。

设计关联（DesignRef）：docs/design/config-center-api.md
实现状态：Current
关联测试：tests/test_api.py
"""

from datetime import UTC, datetime

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from qed_engine import __version__
from qed_engine.api.schemas import (
    DatabaseResponse,
    HealthResponse,
    KeysResponse,
    LlmStatus,
    LlmStatusResponse,
    ModelRoute,
    ModelsResponse,
)
from qed_engine.config import Settings

# LLM 可达性探测：调各供应商 models 列表接口（免费、无 token 消耗），5s 超时，结果缓存 60s。
PROBE_URLS = {
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
    "glm": "https://open.bigmodel.cn/api/paas/v4/models",
    "deepseek": "https://api.deepseek.com/models",
}
PROBE_TIMEOUT_SECONDS = 5.0
LLM_STATUS_TTL_SECONDS = 60.0

# MySQL 连接探测：真实认证（pymysql），3s 超时，结果缓存 60s；密码绝不下发。
DB_PROBE_TIMEOUT_SECONDS = 3.0
DB_STATUS_TTL_SECONDS = 60.0


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


def create_app(settings: Settings | None = None) -> FastAPI:
    """组装 API；测试可注入确定性 Settings。"""
    resolved = settings or Settings()

    app = FastAPI(title="QED-Engine Config", version=__version__)
    app.state.settings = resolved
    app.state.llm_status_cache: dict = {}
    app.state.db_status_cache: dict = {}
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            # 全局端口规划（ADR 0002）：8900 配置中心 / 8901 QED-Tracker /
            # 8902 Axiom-Flow / 8903 前端；8000 为 Axiom-Flow 迁移前兼容
            "http://127.0.0.1:8000",
            "http://localhost:8000",
            "http://127.0.0.1:8900",
            "http://localhost:8900",
            "http://127.0.0.1:8901",
            "http://localhost:8901",
            "http://127.0.0.1:8902",
            "http://localhost:8902",
            "http://127.0.0.1:8903",
            "http://localhost:8903",
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
        """模型路由表：模型选择单线路（qwen 三用途），子项目不感知密钥。"""
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

    @app.get("/api/v1/config/keys", response_model=KeysResponse)
    def keys() -> KeysResponse:
        """供应商配置状态（管理界面用），不含密钥值。"""
        return KeysResponse(
            deepseek=resolved.has_configured("deepseek"),
            qwen=resolved.has_configured("qwen"),
            glm=resolved.has_configured("glm"),
        )

    @app.get("/api/v1/config/database", response_model=DatabaseResponse)
    def database() -> DatabaseResponse:
        """统一数据库配置与连接状态（qed 库）：只含非敏感信息；密码绝不下发。

        reachable 必须经真实连接验证（_probe_mysql），不能用配置布尔冒充；
        未配置密码不探测（reason=未配置）。
        """
        import time

        cache = app.state.db_status_cache
        now = time.monotonic()
        if cache.get("checked_at") is not None and now - cache["checked_at"] < DB_STATUS_TTL_SECONDS:
            return cache["payload"]

        configured = resolved.qed_db_password.get_secret_value() != ""
        reachable, reason = (False, "未配置") if not configured else _probe_mysql(resolved)
        payload = DatabaseResponse(
            host=resolved.qed_db_host,
            port=resolved.qed_db_port,
            name=resolved.qed_db_name,
            user=resolved.qed_db_user,
            configured=configured,
            reachable=reachable,
            reason=reason,
        )
        cache["checked_at"] = now
        cache["payload"] = payload
        return payload

    @app.get("/api/v1/config/llm-status", response_model=LlmStatusResponse)
    def llm_status() -> LlmStatusResponse:
        """各供应商 LLM 可达性（真实探测 models 接口；未配置不探测）。

        「可达」必须经过探测验证，不能用 key 配置布尔冒充；密钥不出现在任何响应。
        """
        import time

        cache = app.state.llm_status_cache
        now = time.monotonic()
        if cache.get("checked_at") is not None and now - cache["checked_at"] < LLM_STATUS_TTL_SECONDS:
            return cache["payload"]

        now_iso = datetime.now(UTC).isoformat()
        statuses: dict[str, LlmStatus] = {}
        for provider in ("qwen", "glm", "deepseek"):
            api_key = getattr(resolved, f"{provider}_api_key").get_secret_value()
            if not api_key:
                statuses[provider] = LlmStatus(reachable=False, reason="未配置", checked_at=now_iso)
                continue
            reachable, reason = _probe_llm(provider, api_key, PROBE_URLS[provider])
            statuses[provider] = LlmStatus(reachable=reachable, reason=reason, checked_at=now_iso)

        payload = LlmStatusResponse(**statuses)
        cache["checked_at"] = now
        cache["payload"] = payload
        return payload

    return app


app = create_app()
