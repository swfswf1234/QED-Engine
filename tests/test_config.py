"""
模块职责：统一配置读取测试：环境变量、默认值、SecretStr 与空值降级。
设计关联（DesignRef）：docs/design/configuration-and-secrets.md
实现状态：Current
被测代码：src/qed_engine/config.py
"""

from qed_engine.config import Settings


def test_defaults_when_no_env(monkeypatch):
    """无环境变量时：key 为空、各用途模型用默认推荐值（单线路 qwen）。"""
    for name in (
        "DEEPSEEK_API_KEY",
        "QWEN_API_KEY",
        "GLM_API_KEY",
        "QED_MODEL",
        "QED_OCR_MODEL",
        "QED_EMBEDDING_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None)
    assert settings.deepseek_api_key.get_secret_value() == ""
    assert settings.qwen_api_key.get_secret_value() == ""
    assert settings.glm_api_key.get_secret_value() == ""
    assert settings.qed_model == "qwen-plus"
    assert settings.qed_ocr_model == "qwen-vl-plus"
    assert settings.qed_embedding_model == "text-embedding-v4"


def test_env_override(monkeypatch):
    """环境变量覆盖默认值，字段名与变量名大小写不敏感（单线路 qwen 三用途）。"""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-deepseek-test")
    monkeypatch.setenv("QWEN_API_KEY", "sk-qwen-test")
    monkeypatch.setenv("GLM_API_KEY", "sk-glm-test")
    monkeypatch.setenv("QED_MODEL", "qwen-max")
    monkeypatch.setenv("QED_OCR_MODEL", "qwen-vl-max")
    monkeypatch.setenv("QED_EMBEDDING_MODEL", "text-embedding-v3")
    settings = Settings(_env_file=None)
    assert settings.deepseek_api_key.get_secret_value() == "sk-deepseek-test"
    assert settings.qwen_api_key.get_secret_value() == "sk-qwen-test"
    assert settings.glm_api_key.get_secret_value() == "sk-glm-test"
    assert settings.qed_model == "qwen-max"
    assert settings.qed_ocr_model == "qwen-vl-max"
    assert settings.qed_embedding_model == "text-embedding-v3"


def test_secret_not_leaked_in_repr():
    """SecretStr 不应在 repr/str 中泄露密钥值。"""
    settings = Settings(_env_file=None, deepseek_api_key="sk-secret-value")
    assert "sk-secret-value" not in repr(settings.deepseek_api_key)
    assert "sk-secret-value" not in str(settings.deepseek_api_key)


def test_secret_empty_detection(monkeypatch):
    """空 key 可被显式检测，用于 configured 状态。"""
    monkeypatch.delenv("QWEN_API_KEY", raising=False)
    settings = Settings(_env_file=None)
    assert settings.qwen_api_key.get_secret_value() == ""
    assert settings.has_configured("qwen") is False
    assert settings.has_configured("deepseek") is False


def test_service_url_defaults(monkeypatch):
    """无环境变量时：三服务地址使用全局端口规划默认值。"""
    for name in ("QED_CONFIG_CENTER_URL", "QED_TRACKER_URL", "QED_AXIOM_URL", "QED_TRACKER_PORT"):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_config_center_url == "http://127.0.0.1:8900"
    assert settings.qed_tracker_url == "http://127.0.0.1:8901"
    assert settings.qed_axiom_url == "http://127.0.0.1:8902"


def test_service_url_env_override(monkeypatch):
    """QED_*_URL 环境变量可覆盖默认服务地址（服务发现可配置）。"""
    monkeypatch.setenv("QED_CONFIG_CENTER_URL", "http://config.local:9999")
    monkeypatch.setenv("QED_TRACKER_URL", "http://tracker.local:9101")
    monkeypatch.setenv("QED_AXIOM_URL", "http://axiom.local:9102")
    settings = Settings(_env_file=None)
    assert settings.qed_config_center_url == "http://config.local:9999"
    assert settings.qed_tracker_url == "http://tracker.local:9101"
    assert settings.qed_axiom_url == "http://axiom.local:9102"


def test_db_defaults_when_no_env(monkeypatch):
    """无环境变量时：统一数据库使用默认值（qed 库，密码空）。"""
    for name in ("QED_DB_HOST", "QED_DB_PORT", "QED_DB_NAME", "QED_DB_USER", "QED_DB_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_db_host == "127.0.0.1"
    assert settings.qed_db_port == 3306
    assert settings.qed_db_name == "qed"
    assert settings.qed_db_user == "root"
    assert settings.qed_db_password.get_secret_value() == ""


def test_db_env_override(monkeypatch):
    """QED_DB_* 环境变量覆盖默认值（唯一事实源，端口为整数）。"""
    monkeypatch.setenv("QED_DB_HOST", "db.local")
    monkeypatch.setenv("QED_DB_PORT", "3307")
    monkeypatch.setenv("QED_DB_NAME", "qed_test")
    monkeypatch.setenv("QED_DB_USER", "qeduser")
    monkeypatch.setenv("QED_DB_PASSWORD", "sk-db-pass")
    settings = Settings(_env_file=None)
    assert settings.qed_db_host == "db.local"
    assert settings.qed_db_port == 3307
    assert settings.qed_db_name == "qed_test"
    assert settings.qed_db_user == "qeduser"
    assert settings.qed_db_password.get_secret_value() == "sk-db-pass"


def test_db_password_not_leaked_in_repr():
    """数据库密码为 SecretStr，repr/str 不泄露。"""
    settings = Settings(_env_file=None, qed_db_password="sk-db-secret")
    assert "sk-db-secret" not in repr(settings.qed_db_password)
    assert "sk-db-secret" not in str(settings.qed_db_password)


def test_lmstudio_url_default_and_override(monkeypatch):
    """LM Studio 监控探测地址：默认 1234/v1，QED_LMSTUDIO_URL 可覆盖。"""
    monkeypatch.delenv("QED_LMSTUDIO_URL", raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_lmstudio_url == "http://127.0.0.1:1234/v1"
    monkeypatch.setenv("QED_LMSTUDIO_URL", "http://127.0.0.1:9999/v1")
    settings = Settings(_env_file=None)
    assert settings.qed_lmstudio_url == "http://127.0.0.1:9999/v1"