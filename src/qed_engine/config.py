"""统一配置：读取根 .env，集中管理供应商 API key 与模型选择。

设计关联（DesignRef）：docs/design/configuration-and-secrets.md、docs/design/config-center-api.md
实现状态：Current
关联测试：tests/test_config.py
"""

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """读取根 .env 的统一配置。空 key 视为未配置，服务保持可用。"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    deepseek_api_key: SecretStr = SecretStr("")
    qwen_api_key: SecretStr = SecretStr("")
    glm_api_key: SecretStr = SecretStr("")
    # 服务地址（全局端口规划 8900/8901/8902，可被 QED_*_URL 覆盖）
    qed_config_center_url: str = "http://127.0.0.1:8900"
    qed_tracker_url: str = "http://127.0.0.1:8901"
    qed_axiom_url: str = "http://127.0.0.1:8902"
    # 模型选择（单线路策略：一次只启用一条线路，当前 qwen 三用途；备选线路启用时恢复）
    qed_model: str = "qwen-plus"
    qed_ocr_model: str = "qwen-vl-plus"
    qed_embedding_model: str = "text-embedding-v4"
    # 统一数据库（MySQL 8 qed 库，ADR 0003；QED_DB_* 为三项目唯一事实源）
    qed_db_host: str = "127.0.0.1"
    qed_db_port: int = 3306
    qed_db_name: str = "qed"
    qed_db_user: str = "root"
    qed_db_password: SecretStr = SecretStr("")

    def has_configured(self, provider: str) -> bool:
        """指定供应商的 API key 是否已配置（空值视为未配置）。"""
        key = getattr(self, f"{provider}_api_key", None)
        if key is None:
            return False
        return key.get_secret_value() != ""
