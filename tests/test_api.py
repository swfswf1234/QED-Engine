"""
模块职责：配置中心 API 契约测试：health、模型路由表与供应商配置状态，密钥值不泄露。
设计关联（DesignRef）：docs/design/config-center-api.md
实现状态：Current
被测代码：src/qed_engine/api/main.py、src/qed_engine/api/schemas.py
"""

from fastapi.testclient import TestClient

from qed_engine.api.main import create_app


def _client(monkeypatch, *, qwen="", deepseek="", glm="", db_password=""):
    monkeypatch.setenv("QWEN_API_KEY", qwen)
    monkeypatch.setenv("DEEPSEEK_API_KEY", deepseek)
    monkeypatch.setenv("GLM_API_KEY", glm)
    monkeypatch.setenv("QED_MODEL", "qwen-plus")
    monkeypatch.setenv("QED_OCR_MODEL", "qwen-vl-plus")
    monkeypatch.setenv("QED_EMBEDDING_MODEL", "text-embedding-v4")
    # 统一数据库：环境变量覆盖根 .env，保证测试确定性
    monkeypatch.setenv("QED_DB_HOST", "127.0.0.1")
    monkeypatch.setenv("QED_DB_PORT", "3306")
    monkeypatch.setenv("QED_DB_NAME", "qed")
    monkeypatch.setenv("QED_DB_USER", "root")
    monkeypatch.setenv("QED_DB_PASSWORD", db_password)
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
    """无任何 key 时：返回单线路（qwen）三个用途的推荐模型，configured 均为 False。"""
    client = _client(monkeypatch)
    response = client.get("/api/v1/config/models")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "default": {"model": "qwen-plus", "provider": "qwen", "configured": False},
        "ocr": {"model": "qwen-vl-plus", "provider": "qwen", "configured": False},
        "embedding": {"model": "text-embedding-v4", "provider": "qwen", "configured": False},
    }


def test_models_configured(monkeypatch):
    """qwen 配 key 后三个用途 configured=True；备选线路不进入模型路由表。"""
    client = _client(monkeypatch, qwen="sk-qwen")
    response = client.get("/api/v1/config/models")
    assert response.status_code == 200
    body = response.json()
    assert body["default"]["configured"] is True
    assert body["ocr"]["configured"] is True
    assert body["embedding"]["configured"] is True
    assert body["default"] == {"model": "qwen-plus", "provider": "qwen", "configured": True}
    assert "glm" not in body
    assert "deepseek" not in body


def test_keys_status(monkeypatch):
    """config/keys 返回布尔状态，绝不包含密钥值。"""
    client = _client(monkeypatch, qwen="sk-qwen", glm="sk-glm")
    response = client.get("/api/v1/config/keys")
    assert response.status_code == 200
    body = response.json()
    assert body == {"deepseek": False, "qwen": True, "glm": True}
    assert "sk-qwen" not in response.text
    assert "sk-glm" not in response.text


def test_cors_allowlist_covers_all_services(monkeypatch):
    """预检：8900/8901/8902/8903 与 8000 来源均被允许（全局端口规划）。"""
    client = _client(monkeypatch)
    for origin in (
        "http://127.0.0.1:8900",
        "http://127.0.0.1:8901",
        "http://127.0.0.1:8902",
        "http://127.0.0.1:8903",
        "http://localhost:8000",
    ):
        response = client.options(
            "/api/v1/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin


def test_cors_rejects_unknown_origin(monkeypatch):
    """未列入白名单的来源被拒绝预检，不返回 allow-origin 头。"""
    client = _client(monkeypatch)
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_database_unconfigured(monkeypatch):
    """无 QED_DB_PASSWORD 时：返回非敏感连接信息，configured=False，不发起探测。"""
    calls = _probe_mysql_calls(monkeypatch, lambda s: (True, ""))
    client = _client(monkeypatch)
    response = client.get("/api/v1/config/database")
    assert response.status_code == 200
    assert response.json() == {
        "host": "127.0.0.1",
        "port": 3306,
        "name": "qed",
        "user": "root",
        "configured": False,
        "reachable": False,
        "reason": "未配置",
    }
    assert calls == []


def test_database_configured_without_password_leak(monkeypatch):
    """密码已配置：configured=True，但响应体绝不包含密码值。"""
    _probe_mysql_calls(monkeypatch, lambda s: (True, ""))
    client = _client(monkeypatch, db_password="sk-db-pass")
    response = client.get("/api/v1/config/database")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is True
    assert body["host"] == "127.0.0.1"
    assert "sk-db-pass" not in response.text


def test_database_password_never_in_any_response(monkeypatch):
    """四个接口任何响应体都不含数据库密码。"""
    client = _client(monkeypatch, db_password="sk-super-db-secret")
    for path in ("/api/v1/health", "/api/v1/config/models", "/api/v1/config/keys", "/api/v1/config/database"):
        response = client.get(path)
        assert "sk-super-db-secret" not in response.text, path


def _probe_calls(monkeypatch, probe):
    """替换 _probe_llm 并记录调用，返回 (client, calls)。"""
    from qed_engine.api import main as api_main

    calls: list[tuple] = []
    monkeypatch.setattr(
        api_main,
        "_probe_llm",
        lambda provider, key, url: (calls.append((provider, url)) or probe(provider, key, url)),
    )
    return calls


def test_llm_status_unconfigured_skips_probing(monkeypatch):
    """无任何 key：全部 reachable=False reason=未配置，不发起真实探测。"""
    calls = _probe_calls(monkeypatch, lambda p, k, u: (True, ""))
    client = _client(monkeypatch)
    response = client.get("/api/v1/config/llm-status")
    assert response.status_code == 200
    body = response.json()
    assert calls == []
    for provider in ("qwen", "glm", "deepseek"):
        assert body[provider]["reachable"] is False, provider
        assert body[provider]["reason"] == "未配置", provider
        assert body[provider]["checked_at"]


def test_llm_status_probes_only_configured(monkeypatch):
    """已配置 key 的供应商才探测（qwen/glm），未配置（deepseek）跳过。"""
    calls = _probe_calls(monkeypatch, lambda p, k, u: (True, ""))
    client = _client(monkeypatch, qwen="sk-qwen", glm="sk-glm")
    response = client.get("/api/v1/config/llm-status")
    assert response.status_code == 200
    body = response.json()
    assert [c[0] for c in calls] == ["qwen", "glm"]
    assert body["qwen"]["reachable"] is True
    assert body["glm"]["reachable"] is True
    assert body["deepseek"] == {"reachable": False, "reason": "未配置", "checked_at": body["deepseek"]["checked_at"]}


def test_llm_status_probe_failure_reports_reason(monkeypatch):
    """探测失败（如超时）时 reachable=False 且 reason 非空，不中断其他供应商。"""
    calls = _probe_calls(
        monkeypatch,
        lambda p, k, u: (True, "") if p == "qwen" else (False, "超时"),
    )
    client = _client(monkeypatch, qwen="sk-qwen", glm="sk-glm")
    response = client.get("/api/v1/config/llm-status")
    body = response.json()
    assert body["qwen"]["reachable"] is True
    assert body["glm"]["reachable"] is False
    assert body["glm"]["reason"] == "超时"
    assert calls


def test_llm_status_cached_within_ttl(monkeypatch):
    """缓存生效：TTL 内重复请求不再触发探测；TTL 过期后重新探测。"""
    from qed_engine.api import main as api_main

    monkeypatch.setattr(api_main, "LLM_STATUS_TTL_SECONDS", 60.0)
    client = _client(monkeypatch, qwen="sk-qwen")
    calls = _probe_calls(monkeypatch, lambda p, k, u: (True, ""))
    client.get("/api/v1/config/llm-status")
    first = len(calls)
    assert first == 1
    client.get("/api/v1/config/llm-status")
    assert len(calls) == first, "TTL 内不应重新探测"
    monkeypatch.setattr(api_main, "LLM_STATUS_TTL_SECONDS", -1.0)
    client.get("/api/v1/config/llm-status")
    assert len(calls) == first + 1, "TTL 过期后应重新探测"


def test_llm_status_never_leaks_key_values(monkeypatch):
    """llm-status 响应体绝不包含任何密钥值。"""
    _probe_calls(monkeypatch, lambda p, k, u: (True, ""))
    client = _client(monkeypatch, qwen="sk-qwen-secret", glm="sk-glm-secret")
    response = client.get("/api/v1/config/llm-status")
    assert "sk-qwen-secret" not in response.text
    assert "sk-glm-secret" not in response.text


def _probe_mysql_calls(monkeypatch, probe):
    """替换 _probe_mysql 并记录调用，返回调用列表。"""
    from qed_engine.api import main as api_main

    calls: list = []
    monkeypatch.setattr(api_main, "_probe_mysql", lambda settings: (calls.append(settings) or probe(settings)))
    return calls


def test_database_unconfigured_skips_probe(monkeypatch):
    """无密码时不探测：reachable=False reason=未配置，_probe_mysql 未被调用。"""
    calls = _probe_mysql_calls(monkeypatch, lambda s: (True, ""))
    client = _client(monkeypatch)
    response = client.get("/api/v1/config/database")
    assert response.status_code == 200
    body = response.json()
    assert body["reachable"] is False
    assert body["reason"] == "未配置"
    assert calls == []


def test_database_probe_success(monkeypatch):
    """探测成功：reachable=True，reason 为空。"""
    _probe_mysql_calls(monkeypatch, lambda s: (True, ""))
    client = _client(monkeypatch, db_password="sk-db")
    response = client.get("/api/v1/config/database")
    body = response.json()
    assert body["reachable"] is True
    assert body["reason"] == ""
    assert body["configured"] is True


def test_database_probe_failure_reason_preserved(monkeypatch):
    """探测失败（如超时/认证失败）：reachable=False，reason 保留探测结果。"""
    _probe_mysql_calls(monkeypatch, lambda s: (False, "认证失败"))
    client = _client(monkeypatch, db_password="sk-db")
    response = client.get("/api/v1/config/database")
    body = response.json()
    assert body["reachable"] is False
    assert body["reason"] == "认证失败"


def test_database_cached_within_ttl(monkeypatch):
    """缓存生效：TTL 内重复请求不再探测；TTL 过期后重新探测。"""
    from qed_engine.api import main as api_main

    monkeypatch.setattr(api_main, "DB_STATUS_TTL_SECONDS", 60.0)
    client = _client(monkeypatch, db_password="sk-db")
    calls = _probe_mysql_calls(monkeypatch, lambda s: (True, ""))
    client.get("/api/v1/config/database")
    first = len(calls)
    assert first == 1
    client.get("/api/v1/config/database")
    assert len(calls) == first, "TTL 内不应重复探测"
    monkeypatch.setattr(api_main, "DB_STATUS_TTL_SECONDS", -1.0)
    client.get("/api/v1/config/database")
    assert len(calls) == first + 1, "TTL 过期后应重新探测"