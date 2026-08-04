"""
模块职责：统一配置读取测试：环境变量、默认值、SecretStr 与空值降级。
设计关联（DesignRef）：docs/design/configuration-and-secrets.md
实现状态：Current
被测代码：src/qed_engine/config.py
"""

from qed_engine.config import Settings


def test_defaults_when_no_env(monkeypatch):
    """无环境变量时：key 为空、各用途模型用默认推荐值。"""
    for name in (
        "DEEPSEEK_API_KEY",
        "QWEN_API_KEY",
        "GLM_API_KEY",
        "QED_MODEL",
        "QED_OCR_MODEL",
        "QED_EMBEDDING_MODEL",
        "GLM_MODEL",
        "GLM_OCR_MODEL",
        "DEEPSEEK_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None)
    assert settings.deepseek_api_key.get_secret_value() == ""
    assert settings.qwen_api_key.get_secret_value() == ""
    assert settings.glm_api_key.get_secret_value() == ""
    assert settings.qed_model == "qwen-plus"
    assert settings.qed_ocr_model == "qwen-vl-plus"
    assert settings.qed_embedding_model == "text-embedding-v4"
    assert settings.glm_model == "glm-5.2"
    assert settings.glm_ocr_model == "glm-ocr"
    assert settings.deepseek_model == "deepseek-v4-flash"


def test_env_override(monkeypatch):
    """环境变量覆盖默认值，字段名与变量名大小写不敏感。"""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-deepseek-test")
    monkeypatch.setenv("QWEN_API_KEY", "sk-qwen-test")
    monkeypatch.setenv("GLM_API_KEY", "sk-glm-test")
    monkeypatch.setenv("QED_MODEL", "qwen-max")
    monkeypatch.setenv("QED_OCR_MODEL", "qwen-vl-max")
    monkeypatch.setenv("QED_EMBEDDING_MODEL", "text-embedding-v3")
    monkeypatch.setenv("GLM_MODEL", "glm-5")
    monkeypatch.setenv("GLM_OCR_MODEL", "glm-5v-turbo")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-v4-pro")
    settings = Settings(_env_file=None)
    assert settings.deepseek_api_key.get_secret_value() == "sk-deepseek-test"
    assert settings.qwen_api_key.get_secret_value() == "sk-qwen-test"
    assert settings.glm_api_key.get_secret_value() == "sk-glm-test"
    assert settings.qed_model == "qwen-max"
    assert settings.qed_ocr_model == "qwen-vl-max"
    assert settings.qed_embedding_model == "text-embedding-v3"
    assert settings.glm_model == "glm-5"
    assert settings.glm_ocr_model == "glm-5v-turbo"
    assert settings.deepseek_model == "deepseek-v4-pro"


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