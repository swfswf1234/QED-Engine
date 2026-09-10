"""
模块职责：统一配置读取测试：环境变量、默认值、SecretStr 与空值降级。
设计关联（DesignRef）：docs/design/project-configuration.md
实现状态：Current
被测代码：src/qed_engine/config.py
"""

import pytest
from pydantic import ValidationError
from qed_engine.config import Settings


def test_defaults_when_no_env(monkeypatch):
    """无环境变量时：key 为空、厂商默认 qwen、模型默认空（实际生效值由厂商注册表兜底）。"""
    for name in (
        "API_KEY",
        "QED_API_PROVIDER",
        "QED_MODEL",
        "QED_OCR_MODEL",
        "QED_EMBEDDING_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None)
    assert settings.api_key.get_secret_value() == ""
    assert settings.qed_api_provider == "qwen"
    assert settings.qed_model == ""
    assert settings.qed_ocr_model == ""
    assert settings.qed_embedding_model == "text-embedding-v4"


def test_env_override(monkeypatch):
    """环境变量覆盖默认值，字段名与变量名大小写不敏感（含厂商选择）。"""
    monkeypatch.setenv("API_KEY", "sk-unified-test")
    monkeypatch.setenv("QED_API_PROVIDER", "glm")
    monkeypatch.setenv("QED_MODEL", "qwen-max")
    monkeypatch.setenv("QED_OCR_MODEL", "qwen-vl-max")
    monkeypatch.setenv("QED_EMBEDDING_MODEL", "text-embedding-v3")
    settings = Settings(_env_file=None)
    assert settings.api_key.get_secret_value() == "sk-unified-test"
    assert settings.qed_api_provider == "glm"
    assert settings.qed_model == "qwen-max"
    assert settings.qed_ocr_model == "qwen-vl-max"
    assert settings.qed_embedding_model == "text-embedding-v3"


def test_secret_not_leaked_in_repr():
    """SecretStr 不应在 repr/str 中泄露密钥值。"""
    settings = Settings(_env_file=None, api_key="sk-secret-value")
    assert "sk-secret-value" not in repr(settings.api_key)
    assert "sk-secret-value" not in str(settings.api_key)


def test_provider_invalid_value_raises():
    """QED_API_PROVIDER 非法取值 → ValidationError（中文信息）。"""
    with pytest.raises(ValidationError, match="QED_API_PROVIDER"):
        Settings(_env_file=None, qed_api_provider="xxx")


def test_provider_deepseek_glm_allowed():
    """QED_API_PROVIDER 支持 deepseek/glm（注册表预留，不做深开发）。"""
    assert Settings(_env_file=None, qed_api_provider="deepseek").qed_api_provider == "deepseek"
    assert Settings(_env_file=None, qed_api_provider="glm").qed_api_provider == "glm"


def test_api_configured_false_when_no_key(monkeypatch):
    """API_KEY 空：api_configured 为 False。"""
    monkeypatch.delenv("API_KEY", raising=False)
    settings = Settings(_env_file=None)
    assert settings.api_configured is False


def test_api_configured_true_when_key_set(monkeypatch):
    """API_KEY 非空：api_configured 为 True。"""
    monkeypatch.setenv("API_KEY", "sk-x")
    settings = Settings(_env_file=None)
    assert settings.api_configured is True


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
    """LM Studio 探测地址：默认 5001/v1（本机实际端口），QED_LMSTUDIO_URL 可覆盖。"""
    monkeypatch.delenv("QED_LMSTUDIO_URL", raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_lmstudio_url == "http://127.0.0.1:5001/v1"
    monkeypatch.setenv("QED_LMSTUDIO_URL", "http://127.0.0.1:9999/v1")
    settings = Settings(_env_file=None)
    assert settings.qed_lmstudio_url == "http://127.0.0.1:9999/v1"


def test_api_key_env(monkeypatch):
    """API_KEY 环境变量即唯一密钥来源。"""
    monkeypatch.setenv("API_KEY", "sk-unified")
    settings = Settings(_env_file=None)
    assert settings.resolved_api_key() == "sk-unified"


def test_resolved_api_key_empty_when_unset(monkeypatch):
    """无 API_KEY → resolved_api_key 为空字符串。"""
    monkeypatch.delenv("API_KEY", raising=False)
    settings = Settings(_env_file=None)
    assert settings.resolved_api_key() == ""


def test_api_select_default_and_override(monkeypatch):
    """QED_API_SELECT：默认 api，可覆盖 local。"""
    monkeypatch.delenv("QED_API_SELECT", raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_api_select == "api"
    monkeypatch.setenv("QED_API_SELECT", "local")
    settings = Settings(_env_file=None)
    assert settings.qed_api_select == "local"


def test_env_file_binds_to_repo_root_absolute_path():
    """根 .env 绝对定位（2026-08-26 root-env-single-source）：任何 CWD 启动读同一份配置。

    回归背景：原 env_file=".env" 相对 CWD——手动 cd backend 启动时读 backend/.env
    （不存在）导致密钥空、DB 不可达；现必须绑定 <repo-root>/.env。
    """
    from pathlib import Path

    from qed_engine import config as config_module

    bound = Path(Settings.model_config["env_file"])
    assert bound.is_absolute(), f"env_file 必须为绝对路径，实际 {bound}"
    assert bound == config_module.ROOT_ENV
    assert (bound.parent / "pyproject.toml").is_file(), "env_file 应位于仓库根"


def test_llm_timeout_default_and_override(monkeypatch):
    """LLM 网关上游调用超时：默认 300s，QED_LLM_TIMEOUT 可覆盖（REQ-061：60s 硬编码导致长生成 ReadTimeout）。"""
    monkeypatch.delenv("QED_LLM_TIMEOUT", raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_llm_timeout == 300.0
    monkeypatch.setenv("QED_LLM_TIMEOUT", "120")
    settings = Settings(_env_file=None)
    assert settings.qed_llm_timeout == 120.0


def test_local_model_vars(monkeypatch):
    """本地模型变量：QED_LMSTUDIO_URL 默认 5001/v1、QED_MINERU_URL、QED_RESOURCE_GUARD、
    QED_LLM_GATEWAY_URL 默认 8900。"""
    for name in ("QED_LMSTUDIO_URL", "QED_MINERU_URL", "QED_RESOURCE_GUARD", "QED_LLM_GATEWAY_URL"):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_lmstudio_url == "http://127.0.0.1:5001/v1"
    assert settings.qed_mineru_url == "http://127.0.0.1:8002"
    assert settings.qed_resource_guard is True
    assert settings.qed_llm_gateway_url == "http://127.0.0.1:8900"
    monkeypatch.setenv("QED_RESOURCE_GUARD", "false")
    settings = Settings(_env_file=None)
    assert settings.qed_resource_guard is False