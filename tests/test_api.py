"""
模块职责：配置中心 API 契约测试：health、模型路由表与供应商配置状态，密钥值不泄露。
设计关联（DesignRef）：docs/design/config-center-api.md
实现状态：Current
被测代码：src/qed_engine/api/main.py、src/qed_engine/api/schemas.py
"""

from fastapi.testclient import TestClient

from qed_engine.api.main import create_app


def _client(monkeypatch, *, qwen="", deepseek="", glm=""):
    monkeypatch.setenv("QWEN_API_KEY", qwen)
    monkeypatch.setenv("DEEPSEEK_API_KEY", deepseek)
    monkeypatch.setenv("GLM_API_KEY", glm)
    monkeypatch.setenv("QED_MODEL", "qwen-plus")
    monkeypatch.setenv("QED_OCR_MODEL", "qwen-vl-plus")
    monkeypatch.setenv("QED_EMBEDDING_MODEL", "text-embedding-v4")
    monkeypatch.setenv("GLM_MODEL", "glm-5.2")
    monkeypatch.setenv("GLM_OCR_MODEL", "glm-ocr")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
    return TestClient(create_app())


def test_health_ok(monkeypatch):
    client = _client(monkeypatch)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "qed-engine-config"
    assert body["version"]


def test_models_unconfigured(monkeypatch):
    """无任何 key 时：返回各供应商推荐模型，configured 均为 False。"""
    client = _client(monkeypatch)
    response = client.get("/api/v1/config/models")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "default": {"model": "qwen-plus", "provider": "qwen", "configured": False},
        "ocr": {"model": "qwen-vl-plus", "provider": "qwen", "configured": False},
        "embedding": {"model": "text-embedding-v4", "provider": "qwen", "configured": False},
        "glm": {"model": "glm-5.2", "provider": "glm", "configured": False},
        "glm_ocr": {"model": "glm-ocr", "provider": "glm", "configured": False},
        "deepseek": {"model": "deepseek-v4-flash", "provider": "deepseek", "configured": False},
    }


def test_models_configured(monkeypatch):
    """qwen/glm 配 key 后对应路由 configured=True，deepseek 未配仍 False。"""
    client = _client(monkeypatch, qwen="sk-qwen", glm="sk-glm")
    response = client.get("/api/v1/config/models")
    assert response.status_code == 200
    body = response.json()
    assert body["default"]["configured"] is True
    assert body["ocr"]["configured"] is True
    assert body["embedding"]["configured"] is True
    assert body["glm"]["configured"] is True
    assert body["glm_ocr"]["configured"] is True
    assert body["deepseek"]["configured"] is False
    assert body["glm"] == {"model": "glm-5.2", "provider": "glm", "configured": True}


def test_keys_status(monkeypatch):
    """config/keys 返回布尔状态，绝不包含密钥值。"""
    client = _client(monkeypatch, qwen="sk-qwen", glm="sk-glm")
    response = client.get("/api/v1/config/keys")
    assert response.status_code == 200
    body = response.json()
    assert body == {"deepseek": False, "qwen": True, "glm": True}
    assert "sk-qwen" not in response.text
    assert "sk-glm" not in response.text