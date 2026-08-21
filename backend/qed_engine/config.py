"""统一配置：读取根 .env，集中管理 API_KEY 与厂商/模型选择。

设计关联（DesignRef）：docs/design/configuration-and-secrets.md、docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_config.py
"""

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """读取根 .env 的统一配置。空 key 视为未配置，服务保持可用。

    2026-08-20（provider-registry）：API_KEY 为唯一密钥变量 + QED_API_PROVIDER 选择厂商；
    逐厂商 key（QWEN_API_KEY 等）已正式取消。
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 唯一密钥变量（API_KEY；逐厂商 key 已取消）
    api_key: SecretStr = SecretStr("")
    # 模型模式：api（默认，API key 调用）/ local（本地模型）
    qed_api_select: str = "api"
    # 厂商选择（api 模式路由）：qwen（默认，当前唯一使用）/ deepseek / glm（注册表预留）
    qed_api_provider: str = "qwen"
    # 服务地址（全局端口规划 8900/8901/8902/8903，可被 QED_*_URL 覆盖）
    qed_config_center_url: str = "http://127.0.0.1:8900"
    qed_tracker_url: str = "http://127.0.0.1:8901"
    qed_axiom_url: str = "http://127.0.0.1:8902"
    qed_web_url: str = "http://127.0.0.1:8903"
    # 本地 LLM（LM Studio，OpenAI 兼容）默认地址（QED_LMSTUDIO_URL 可覆盖；本机实测 5001）
    qed_lmstudio_url: str = "http://127.0.0.1:5001/v1"
    # 本地图像模型（MinerU 容器，WSL；编排见 scripts/image-model/）
    qed_mineru_url: str = "http://127.0.0.1:8002"
    # 资源互斥开关（默认开）：启动一方本地模型前先停另一方（4080 16GB 显存约束）
    qed_resource_guard: bool = True
    # LLM 网关地址（子项目 qed-engine 模式读取；api/local 模式忽略）
    qed_llm_gateway_url: str = "http://127.0.0.1:8900"
    # 模型选择（空=未配置，实际生效值由厂商注册表兜底；embedding 保持推荐值，RAG 轮再解析）
    qed_model: str = ""
    qed_ocr_model: str = ""
    qed_embedding_model: str = "text-embedding-v4"
    # 统一数据库（MySQL 8 qed 库，ADR 0003；QED_DB_* 为三项目唯一事实源）
    qed_db_host: str = "127.0.0.1"
    qed_db_port: int = 3306
    qed_db_name: str = "qed"
    qed_db_user: str = "root"
    qed_db_password: SecretStr = SecretStr("")

    @property
    def api_configured(self) -> bool:
        """API_KEY 是否已配置（空值视为未配置）。"""
        return self.api_key.get_secret_value() != ""

    def resolved_api_key(self) -> str:
        """唯一密钥（API_KEY），空字符串表示未配置。"""
        return self.api_key.get_secret_value()

    @model_validator(mode="after")
    def _validate_provider(self) -> "Settings":
        """QED_API_PROVIDER 仅支持注册厂商（qwen/deepseek/glm），非法值拒绝启动。"""
        if self.qed_api_provider not in {"qwen", "deepseek", "glm"}:
            raise ValueError(
                f"QED_API_PROVIDER 非法取值：{self.qed_api_provider!r}（仅支持 qwen / deepseek / glm）"
            )
        return self
