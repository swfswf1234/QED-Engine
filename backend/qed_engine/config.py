"""统一配置：读取仓库根 `.env`（绝对定位），集中管理 API_KEY 与厂商/模型选择。

设计关联（DesignRef）：docs/design/project-configuration.md、docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_config.py

2026-08-26（root-env-single-source）：env_file 由相对路径改为绝对定位仓库根——
原 `env_file=".env"` 相对 CWD 解析，导致同一服务两种启动方式读到不同配置
（脚本启动 cwd=根 → 根 .env；手动 cd backend 启动 → backend/.env 不存在 → 密钥空）。
现任何 CWD 一致读 `<repo-root>/.env`；部署脱离仓库结构时文件缺失按「未配置」降级，
符合独立性铁律。
"""

from pathlib import Path

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# 仓库根 .env 唯一事实源（backend/qed_engine/config.py → parents[2] = 仓库根；
# 与子项目服务脚本的 __file__ 绝对定位先例一致）
ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """读取仓库根 .env 的统一配置。空 key 视为未配置，服务保持可用。

    2026-08-20（provider-registry）：API_KEY 为唯一密钥变量 + QED_API_PROVIDER 选择厂商；
    逐厂商 key（QWEN_API_KEY 等）已正式取消。
    """

    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV),
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
    # 本地模型加载方式（2026-09-16 四段式）：lmstudio（默认）/ llamacpp / docker
    qed_local_runtime: str = "lmstudio"
    # 文字模型地址（lmstudio 与 llamacpp 共用；OpenAI 兼容，默认 5001）
    qed_model_url: str = "http://127.0.0.1:5001/v1"
    # 图像模型地址（MinerU 容器，健康端点 /health，默认 5002）
    qed_ocr_model_url: str = "http://127.0.0.1:5002"
    # LM Studio API 认证 token（W7 实测：本机开启认证，REST v0 与 OpenAI 调用需 Bearer；空=不带头）
    qed_lmstudio_token: SecretStr = SecretStr("")
    # 资源互斥开关（默认开）：单活仲裁，启动一方本地模型前先停其他在跑本地模型（4080 16GB 约束）
    qed_resource_guard: bool = True
    # LLM 网关地址（子项目 qed-engine 模式读取；api/local 模式忽略）
    qed_llm_gateway_url: str = "http://127.0.0.1:8900"
    # LLM 上游调用超时秒数（QED_LLM_TIMEOUT 可覆盖；REQ-061：原 60s 硬编码导致长生成 ReadTimeout）
    qed_llm_timeout: float = 300.0
    # 模型选择（空=未配置，实际生效值由厂商注册表兜底；embedding 保持推荐值，RAG 轮再解析）
    qed_model: str = ""
    qed_ocr_model: str = ""
    qed_embedding_model: str = "text-embedding-v4"
    # 统一数据根（ARCH-019：与 QED-Tracker 共用 QED_DATA_ROOT；raw/{domain_id}/ 下
    # domains.json / courses.json 为共享布局。相对路径锚定仓库根，避免 CWD 漂移）
    qed_data_root: str = "dataset"
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

    def resolved_lmstudio_token(self) -> str:
        """LM Studio API 认证 token（QED_LMSTUDIO_TOKEN），空字符串表示未开启认证。"""
        return self.qed_lmstudio_token.get_secret_value()

    @property
    def data_root_path(self) -> Path:
        """数据根绝对路径：相对值锚定仓库根（与脚本启动 CWD=仓库根一致）。"""
        path = Path(self.qed_data_root).expanduser()
        if not path.is_absolute():
            path = (ROOT_ENV.parent / path).resolve()
        return path

    @model_validator(mode="after")
    def _validate_provider(self) -> "Settings":
        """QED_API_PROVIDER 仅支持注册厂商（qwen/deepseek/glm），非法值拒绝启动。"""
        if self.qed_api_provider not in {"qwen", "deepseek", "glm"}:
            raise ValueError(
                f"QED_API_PROVIDER 非法取值：{self.qed_api_provider!r}（仅支持 qwen / deepseek / glm）"
            )
        return self

    @model_validator(mode="after")
    def _validate_local_runtime(self) -> "Settings":
        """QED_LOCAL_RUNTIME 仅支持注册 runtime（lmstudio/llamacpp/docker），非法值拒绝启动。"""
        if self.qed_local_runtime not in {"lmstudio", "llamacpp", "docker"}:
            raise ValueError(
                f"QED_LOCAL_RUNTIME 非法取值：{self.qed_local_runtime!r}"
                "（仅支持 lmstudio / llamacpp / docker）"
            )
        return self
