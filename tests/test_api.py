"""
模块职责：配置中心 API 契约测试：health、模型路由表与供应商配置状态，密钥值不泄露。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/api/main.py、backend/qed_engine/api/schemas.py
"""

import json

import httpx
import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.clients.axiom_client import AxiomClient
from qed_engine.clients.tracker_client import TrackerClient


@pytest.fixture(autouse=True)
def _reset_service_manager(monkeypatch):
    """每个测试前重置服务托管全局状态（_OPS/_MANAGED/_LOCKED），避免跨测试污染。"""
    from qed_engine.services import service_manager as sm

    sm._OPS.clear()
    sm._MANAGED.clear()
    sm._LOCKED.clear()


@pytest.fixture(autouse=True)
def _mock_startup_llm_probe(monkeypatch):
    """8900 启动时对已配置供应商探测一次（写日志）；测试默认 mock 防真实网络请求。

    需要验证启动探测行为的测试自行覆盖 api_control._probe_llm。
    qed_llm_calls 启动建表同样 mock：测试不触碰真实 MySQL（建表逻辑由 test_llm_call_log.py 覆盖）。
    """
    from qed_engine.api import control as api_control
    from qed_engine.services.llm import call_log as llm_call_log

    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(llm_call_log, "ensure_table", lambda settings: None)


def _client(
    monkeypatch, *, api_key="", provider="qwen", db_password="", tracker=None, axiom=None, mode="api",
):
    monkeypatch.setenv("API_KEY", api_key)
    monkeypatch.setenv("QED_API_PROVIDER", provider)
    monkeypatch.setenv("QED_API_SELECT", mode)
    # 监督器关闭：测试不建常驻探测线程（隔离铁律，行为逻辑由 test_llm_supervisor.py 覆盖）
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_MODEL", "qwen-plus")
    monkeypatch.setenv("QED_OCR_MODEL", "qwen-vl-plus")
    monkeypatch.setenv("QED_EMBEDDING_MODEL", "text-embedding-v4")
    # 统一数据库：环境变量覆盖根 .env，保证测试确定性
    monkeypatch.setenv("QED_DB_HOST", "127.0.0.1")
    monkeypatch.setenv("QED_DB_PORT", "3306")
    monkeypatch.setenv("QED_DB_NAME", "qed")
    monkeypatch.setenv("QED_DB_USER", "root")
    monkeypatch.setenv("QED_DB_PASSWORD", db_password)
    return TestClient(create_app(tracker_client=tracker, axiom_client=axiom))


def test_health_ok(monkeypatch):
    client = _client(monkeypatch)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "qed-engine-config"
    assert body["version"]


def test_models_unconfigured(monkeypatch):
    """无 API_KEY 时：返回所选厂商（qwen）三个用途的生效模型，configured 均为 False。"""
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
    """API_KEY 配置后三个用途 configured=True；provider 为当前厂商选择。"""
    client = _client(monkeypatch, api_key="sk-qwen")
    response = client.get("/api/v1/config/models")
    assert response.status_code == 200
    body = response.json()
    assert body["default"]["configured"] is True
    assert body["ocr"]["configured"] is True
    assert body["embedding"]["configured"] is True
    assert body["default"] == {"model": "qwen-plus", "provider": "qwen", "configured": True}
    assert body["ocr"]["provider"] == "qwen"
    assert body["embedding"]["provider"] == "qwen"


def test_keys_status(monkeypatch):
    """config/keys 返回当前厂商、配置状态与运行模式（api/local），绝不包含密钥值。"""
    client = _client(monkeypatch, api_key="sk-qwen")
    response = client.get("/api/v1/config/keys")
    assert response.status_code == 200
    body = response.json()
    assert body == {"provider": "qwen", "configured": True, "mode": "api", "resource_guard": True}
    assert "sk-qwen" not in response.text


def test_keys_unconfigured(monkeypatch):
    """无 API_KEY：keys 返回 configured=False，provider 为默认 qwen。"""
    client = _client(monkeypatch)
    response = client.get("/api/v1/config/keys")
    assert response.status_code == 200
    assert response.json() == {"provider": "qwen", "configured": False, "mode": "api", "resource_guard": True}


def test_keys_glm_provider(monkeypatch):
    """QED_API_PROVIDER=glm：keys 返回对应厂商（注册表预留）。"""
    client = _client(monkeypatch, api_key="sk-glm", provider="glm")
    response = client.get("/api/v1/config/keys")
    assert response.status_code == 200
    assert response.json() == {"provider": "glm", "configured": True, "mode": "api", "resource_guard": True}


def test_keys_local_mode(monkeypatch):
    """QED_API_SELECT=local：mode=local（前端依赖卡模式感知：local 才探测 Qwen/MinerU）。"""
    client = _client(monkeypatch, api_key="sk-local", mode="local")
    response = client.get("/api/v1/config/keys")
    assert response.status_code == 200
    assert response.json() == {"provider": "qwen", "configured": True, "mode": "local", "resource_guard": True}


def test_keys_resource_guard_off(monkeypatch):
    """QED_RESOURCE_GUARD=false 下发：仪表盘状况卡据此渲染双卡并列（ARCH-028 W4 显隐判据）。"""
    monkeypatch.setenv("QED_RESOURCE_GUARD", "false")
    client = _client(monkeypatch, api_key="sk-local", mode="local")
    body = client.get("/api/v1/config/keys").json()
    assert body["resource_guard"] is False


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


# ---------- 启动自检（ARCH-014：/config/llm-status 端点已删除，改为 8900 启动时检查一次） ----------


def test_llm_status_endpoint_removed(monkeypatch):
    """GET /api/v1/config/llm-status 已删除 → 404（启动检查替代按需探测）。"""
    client = _client(monkeypatch)
    response = client.get("/api/v1/config/llm-status")
    assert response.status_code == 404


def test_startup_llm_check_unconfigured_skips_probing(monkeypatch):
    """启动自检：无任何 key 时不发起探测（仅日志）。"""
    from qed_engine.api import control as api_control

    calls: list = []
    monkeypatch.setattr(
        api_control,
        "_probe_llm",
        lambda provider, key, url: calls.append((provider, url)) or (True, ""),
    )
    client = _client(monkeypatch)
    assert client.get("/api/v1/health").status_code == 200
    assert calls == []


def test_startup_llm_check_probes_only_selected_provider(monkeypatch):
    """启动自检：仅探测 QED_API_PROVIDER 对应供应商（免费 models 接口，单次）。"""
    from qed_engine.api import control as api_control

    calls: list = []
    monkeypatch.setattr(
        api_control,
        "_probe_llm",
        lambda provider, key, url: calls.append((provider, url)) or (True, ""),
    )
    client = _client(monkeypatch, api_key="sk-qwen", provider="deepseek")
    assert client.get("/api/v1/health").status_code == 200
    assert calls == [("deepseek", "https://api.deepseek.com/models")]


def _probe_mysql_calls(monkeypatch, probe):
    """替换 _probe_mysql 并记录调用，返回调用列表。"""
    from qed_engine.api import control as api_control

    calls: list = []
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: calls.append(settings) or probe(settings))
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


def test_database_snapshot_probed_once_at_startup(monkeypatch):
    """启动快照：create_app 时探测一次，端点重复请求不再触发探测（ARCH-014）。"""
    from qed_engine.api import control as api_control

    calls: list = []
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: calls.append(settings) or (True, ""))
    client = _client(monkeypatch, db_password="sk-db")
    assert len(calls) == 1, "启动时应探测一次"
    client.get("/api/v1/config/database")
    client.get("/api/v1/config/database")
    assert len(calls) == 1, "端点只读快照，不应重复探测"


# ---------- 语义 API（数据域：catalogs / tasks / knowledge / books，8900 自有契约） ----------


def _tracker_client(handler) -> TrackerClient:
    return TrackerClient(base_url="http://tracker.test", transport=httpx.MockTransport(handler))


def test_catalogs_via_semantic_api(monkeypatch):
    """GET /api/v1/catalogs/{course_id}：前端目录树改经 8900 获取。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/catalogs/math-qe"
        return httpx.Response(200, json={"course_id": "math-qe", "nodes": []})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/catalogs/math-qe")
    assert response.status_code == 200
    assert response.json() == {"course_id": "math-qe", "nodes": []}


def test_tasks_endpoints_via_semantic_api(monkeypatch):
    """任务端点：列表与详情经 8900（创建任务走 8901 泛型端点，QED-030 后无 8900 专属任务端点）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/v1/tasks":
            return httpx.Response(200, json=[{"task_id": "t-1", "status": "succeeded"}])
        if path == "/api/v1/tasks/t-1":
            return httpx.Response(200, json={"task_id": "t-1", "status": "succeeded"})
        return httpx.Response(404, json={"detail": f"unexpected {path}"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    assert client.get("/api/v1/tasks").json() == [{"task_id": "t-1", "status": "succeeded"}]
    assert client.get("/api/v1/tasks/t-1").json()["status"] == "succeeded"


def test_upstream_conflict_passthrough(monkeypatch):
    """8901 返回 409（状态机冲突）：8900 同码透传 detail，前端既有 409 处理生效。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "状态机冲突：当前状态 downloading 不允许"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/books/bk_abc/verify")
    assert response.status_code == 409
    assert response.json()["detail"] == "状态机冲突：当前状态 downloading 不允许"


# ---------- 五层语义 API（knowledge / books / sources，cross-project-contracts.md 五层模型 QED-031） ----------


def test_knowledge_list_via_semantic_api(monkeypatch):
    """GET /api/v1/knowledge：查询参数透传 8901（默认过滤由上游数据层保证）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/knowledge"
        assert dict(request.url.params) == {"course_id": "01_math_analysis", "status": "confirmed"}
        return httpx.Response(200, json=[{"knowledge_id": "kn_abc", "status": "confirmed"}])

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get(
        "/api/v1/knowledge",
        params={"course_id": "01_math_analysis", "status": "confirmed"},
    )
    assert response.status_code == 200
    assert response.json() == [{"knowledge_id": "kn_abc", "status": "confirmed"}]


def test_knowledge_detail_via_semantic_api(monkeypatch):
    """GET /api/v1/knowledge/{id}：教程详情（含所辖书籍）经 8900。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/knowledge/kn_abc"
        return httpx.Response(200, json={"knowledge_id": "kn_abc", "name": "数学分析 套一", "books": []})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/knowledge/kn_abc")
    assert response.status_code == 200
    assert response.json()["name"] == "数学分析 套一"


def test_knowledge_confirm_via_semantic_api(monkeypatch):
    """POST /knowledge/{id}/confirm：引用与简介字段转发 8901。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/knowledge/kn_abc/confirm"
        assert json.loads(request.read()) == {
            "textbook_ref": {"title": "微积分学教程", "version": "第 8 版"},
            "textbook_intro": "经典教材",
        }
        return httpx.Response(200, json={"knowledge_id": "kn_abc", "status": "confirmed"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post(
        "/api/v1/knowledge/kn_abc/confirm",
        json={"textbook_ref": {"title": "微积分学教程", "version": "第 8 版"}, "textbook_intro": "经典教材"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


def test_book_create_via_semantic_api(monkeypatch):
    """POST /api/v1/books：书库化创建（book_id + title 必填，无 knowledge_id）→ 201。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books"
        assert json.loads(request.read()) == {
            "book_id": "mathanalysis-b01",
            "title": "数学分析",
            "original_title": "Principles of Mathematical Analysis",
            "roles": ["textbook"],
            "domain_id": "math",
        }
        return httpx.Response(201, json={"book_id": "mathanalysis-b01", "status": "candidate"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post(
        "/api/v1/books",
        json={
            "book_id": "mathanalysis-b01",
            "title": "数学分析",
            "original_title": "Principles of Mathematical Analysis",
            "roles": ["textbook"],
            "domain_id": "math",
        },
    )
    assert response.status_code == 201
    assert response.json()["status"] == "candidate"


def test_book_create_requires_book_id_and_title(monkeypatch):
    """POST /api/v1/books 缺 book_id/title：8900 直接 422。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("不应请求 8901")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    assert client.post("/api/v1/books", json={"title": "无编号书"}).status_code == 422
    assert client.post("/api/v1/books", json={"book_id": "mathanalysis-b01"}).status_code == 422


def test_book_sources_list_via_semantic_api(monkeypatch):
    """GET /books/{id}/sources：渠道尝试列表经 8900（详情弹窗）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/bk_abc/sources"
        return httpx.Response(200, json=[{"source_id": "src_1", "channel": "libgen_li", "ok": 1}])

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/books/bk_abc/sources")
    assert response.status_code == 200
    assert response.json()[0]["channel"] == "libgen_li"


def test_book_sources_add_via_semantic_api(monkeypatch):
    """POST /books/{id}/sources：登记一次渠道尝试经 8900。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/bk_abc/sources"
        assert json.loads(request.read()) == {
            "channel": "manual",
            "provider_id": "",
            "page_url": "",
            "download_url": "",
            "file_keywords": "",
            "ok": True,
            "note": "人工下载",
        }
        return httpx.Response(200, json={"source_id": "src_2", "channel": "manual", "ok": True})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post(
        "/api/v1/books/bk_abc/sources",
        json={"channel": "manual", "ok": True, "note": "人工下载"},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_book_register_via_semantic_api(monkeypatch):
    """POST /books/{id}/register：人工下载登记经 8900。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/bk_abc/register"
        assert json.loads(request.read()) == {"relative_path": "raw/books/math-qe/01/v2.pdf"}
        return httpx.Response(200, json={"book_id": "bk_abc", "status": "downloaded"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post(
        "/api/v1/books/bk_abc/register",
        json={"relative_path": "raw/books/math-qe/01/v2.pdf"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "downloaded"


def test_book_register_without_path_is_422(monkeypatch):
    """书籍 register 缺 relative_path：8900 直接 422。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("不应请求 8901")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/books/bk_abc/register", json={})
    assert response.status_code == 422


def test_book_import_multipart_forwards_file(monkeypatch):
    """POST /books/{id}/import：浏览器 multipart 上传 → 8900 落临时文件并透传 file_path。"""
    from pathlib import Path

    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/bk_abc/import"
        body = json.loads(request.content.decode("utf-8"))
        seen["body"] = body
        temp = Path(body["file_path"])
        assert temp.is_file(), "8900 应先落临时文件再调 8901"
        seen["content"] = temp.read_bytes()
        return httpx.Response(200, json={"book_id": "bk_abc", "holding": "owned", "status": "downloaded"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post(
        "/api/v1/books/bk_abc/import",
        files={"file": ("book.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "downloaded"
    assert seen["content"] == b"%PDF-1.4 test"
    assert not Path(seen["body"]["file_path"]).exists(), "临时文件应在请求结束后清理"


def test_book_import_rejects_non_pdf(monkeypatch):
    """非 .pdf 上传：8900 直接 400，不请求 8901。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("不应请求 8901")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post(
        "/api/v1/books/bk_abc/import",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400


def test_book_state_actions_via_semantic_api(monkeypatch):
    """POST /books/{id}/start|fail|verify|cancel：下载生命周期动作经 8900（QED-060）。"""
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.url.path, json.loads(request.content.decode("utf-8") or b"{}")))
        return httpx.Response(200, json={"book_id": "bk_abc", "status": "changed"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    for action in ("start", "fail", "verify", "cancel"):
        assert client.post(f"/api/v1/books/bk_abc/{action}").status_code == 200, action
    assert seen == [
        ("/api/v1/books/bk_abc/start", {}),
        ("/api/v1/books/bk_abc/fail", {}),
        ("/api/v1/books/bk_abc/verify", {}),
        ("/api/v1/books/bk_abc/cancel", {}),
    ]


def test_removed_book_endpoints_are_gone(monkeypatch):
    """旧八态下载机端点（decide/retry/complete/reject/supersede）已删除，8900 不再暴露。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"不应请求 8901：{request.url.path}")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    for action in ("decide", "retry", "complete", "reject", "supersede"):
        response = client.post(f"/api/v1/books/bk_abc/{action}", json={})
        assert response.status_code in (404, 405), (action, response.status_code)


def test_five_layer_offline_returns_503(monkeypatch):
    """8901 离线：五层端点同样 503 + 明确提示（前端降级显示依据）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    for path in (
        "/api/v1/knowledge",
        "/api/v1/knowledge/kn_abc",
        "/api/v1/books/bk_abc/sources",
    ):
        response = client.get(path)
        assert response.status_code == 503, path
        assert "QED-Tracker" in response.json()["detail"]
    # POST /books 走 tracker 数据域（注意 GET /api/v1/books 被 Axiom-Flow 预留路由占用）
    response = client.post(
        "/api/v1/books",
        json={"book_id": "mathanalysis-b01", "title": "测试书"},
    )
    assert response.status_code == 503
    assert "QED-Tracker" in response.json()["detail"]


# ---------- 服务域（控制中心 /services：service-hosting.md 契约） ----------


def test_services_spec_workdirs_and_log_dir_point_to_repo_root():
    """注册表几何守护：ROOT 必须解析到仓库根（P1 目录迁移 src/ → backend/ 后 parents 层级
曾错位导致 workdir 指向 backend/QED-Tracker，真实启动 WinError 267）。"""
    from pathlib import Path

    from qed_engine.config import Settings
    from qed_engine.services import service_manager as sm

    repo_root = Path(__file__).resolve().parents[1]
    sm.configure(Settings())
    for name in ("config", "tracker", "axiom", "web"):
        spec = sm._SPECS[name]
        assert Path(spec.workdir).is_dir(), f"{name} workdir 不存在：{spec.workdir}"
        assert str(Path(spec.workdir)).startswith(str(repo_root)), f"{name} workdir 应位于仓库根内"
    assert sm.LOG_DIR == repo_root / "logs"
    assert sm.LOG_DIR.is_dir()


def _patch_probe(monkeypatch, result):
    """注入状态探测：全部单元返回同一结果（config 固定 online 不受影响）。"""
    from qed_engine.services import service_manager as sm

    monkeypatch.setattr(sm, "_probe_http", lambda port: result)


def _patch_popen(monkeypatch, record=None, exit_on_signal=False):
    """注入 Popen/taskkill：
    - start 时记录 cmd 到 record，返回 FakeProcess（pid 自增）
    - exit_on_signal: os.kill(CTRL_BREAK) 后 poll 返回 0（模拟优雅退出）；否则一直存活
    """
    import subprocess

    from qed_engine.services import service_manager as sm

    class FakeProcess:
        def __init__(self, pid):
            self.pid = pid
            self._alive = True
            self._singled = False

        def poll(self):
            if self._singled and exit_on_signal:
                return 0
            return None if self._alive else 0

        def kill(self):
            self._alive = False

        def wait(self, timeout=None):
            return self.poll()

    created: list = []

    def fake_popen(cmd, **kwargs):
        if record is not None:
            record.append(cmd)
        proc = FakeProcess(8123 + len(created))
        created.append(proc)
        return proc

    monkeypatch.setattr(subprocess, "Popen", fake_popen)
    monkeypatch.setattr(subprocess, "run", lambda cmd, **kwargs: None)  # taskkill 兜底
    kill_calls: list = []

    def fake_kill(pid, sig):
        for proc in created:
            if proc.pid == pid:
                proc._singled = True
        kill_calls.append(pid)

    monkeypatch.setattr(sm.os, "kill", fake_kill)
    return created, kill_calls


def _patch_script(monkeypatch, record=None, exit_codes=None, stdout="pid: 8123\n"):
    """注入子项目生命周期脚本调用（subprocess.run → FakeCompletedProcess，REQ-017①）。

    exit_codes: dict{子命令: 退出码}（默认全部 0）；stdout 为 start 输出（首行 pid 行）。
    """
    import subprocess

    class FakeCompleted:
        def __init__(self, returncode, out, err=""):
            self.returncode = returncode
            self.stdout = out
            self.stderr = err

    def fake_run(cmd, **kwargs):
        if record is not None:
            record.append(cmd)
        sub = cmd[-1] if cmd else ""
        code = (exit_codes or {}).get(sub, 0)
        return FakeCompleted(code, stdout if sub == "start" else "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)


def test_probe_http_unlistened_port_fast_false():
    """未监听端口快速判定 offline：socket 预检兜底（不等 HTTP 超时）。

    本机 Windows 上未监听 loopback 端口可能被防火墙静默丢弃（非 RST），
    修复前 httpx 直连最坏 3s×2；修复后 socket 预检 0.5s 内返回。
    """
    import time

    from qed_engine.services import service_manager as sm

    start = time.monotonic()
    assert sm._probe_http(1) is False  # 端口 1 几乎必然未监听
    assert time.monotonic() - start < 2.0


class _FakeHttpx:
    def __init__(self, status_code: int):
        self._status_code = status_code

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get(self, url: str):
        class _Resp:
            status_code = self._status_code

        return _Resp()


def test_probe_http_socket_ok_then_http_decides(monkeypatch):
    """socket 预检通过后由 HTTP 健康确认：200 → online；非 200/异常 → offline。"""
    from qed_engine.services import service_manager as sm

    class FakeSock:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(sm.socket, "create_connection", lambda *a, **k: FakeSock())
    monkeypatch.setattr(sm.httpx, "Client", lambda **k: _FakeHttpx(200))
    assert sm._probe_http(8901) is True
    monkeypatch.setattr(sm.httpx, "Client", lambda **k: _FakeHttpx(503))
    assert sm._probe_http(8901) is False
    monkeypatch.setattr(sm.httpx, "Client", lambda **k: (_ for _ in ()).throw(httpx.ConnectError("down")))
    assert sm._probe_http(8901) is False


def test_services_snapshot_three_units_offline(monkeypatch):
    _patch_probe(monkeypatch, False)
    client = _client(monkeypatch)
    response = client.get("/api/v1/services")
    assert response.status_code == 200
    services = response.json()["services"]
    assert [s["name"] for s in services] == ["config", "tracker", "axiom", "web"]
    for service in services:
        for key in ("name", "label", "port", "status", "pid", "started_at", "log_path", "reason"):
            assert key in service, key
    by_name = {s["name"]: s for s in services}
    assert by_name["config"]["status"] == "online"
    assert by_name["config"]["port"] == 8900
    assert by_name["tracker"]["status"] == "offline"
    assert by_name["tracker"]["port"] == 8901
    assert by_name["tracker"]["reason"]
    assert by_name["axiom"]["status"] == "offline"
    assert by_name["axiom"]["port"] == 8902
    assert by_name["web"]["status"] == "offline"
    assert by_name["web"]["port"] == 8903
    assert by_name["web"]["reason"]


def test_services_snapshot_online_when_probe_ok(monkeypatch):
    """探测通过 → online（按端口区分单元）。"""
    from qed_engine.services import service_manager as sm

    monkeypatch.setattr(sm, "_probe_http", lambda port: port in (8901, 8903))
    client = _client(monkeypatch)
    services = client.get("/api/v1/services").json()["services"]
    by_name = {s["name"]: s for s in services}
    assert by_name["tracker"]["status"] == "online"
    assert by_name["axiom"]["status"] == "offline"
    assert by_name["web"]["status"] == "online"


def test_services_start_tracker_uses_lifecycle_script(monkeypatch):
    """tracker：经生命周期脚本 start（REQ-017① 接入契约），返回 starting + 脚本 PID。"""
    _patch_probe(monkeypatch, False)
    record = []
    _patch_script(monkeypatch, record=record)
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/tracker/start")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "tracker"
    assert body["status"] == "starting"
    assert body["pid"] == 8123
    assert record[0][-1] == "start"
    assert any("qed_tracker_service.py" in cmd for cmd in record[0])


def test_services_start_script_failure_returns_500(monkeypatch):
    """脚本 start 非 0 退出 → 500（后端稳定：启动失败明确报错，不伪成功）。"""
    _patch_probe(monkeypatch, False)
    _patch_script(monkeypatch, exit_codes={"start": 1})
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/tracker/start")
    assert response.status_code == 500


def test_services_start_axiom_uses_lifecycle_script(monkeypatch):
    """axiom：经生命周期脚本 start（2026-08-17 REQ-039 脚本化接入），返回 starting + 脚本 PID。

    原双进程 Popen 语义（API + Worker）已由 Axiom-Flow 生命周期脚本承接
    （axiom_flow_service.py，v2 无独立 worker）。
    """
    _patch_probe(monkeypatch, False)
    record = []
    _patch_script(monkeypatch, record=record)
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/axiom/start")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "axiom"
    assert body["status"] == "starting"
    assert body["pid"] == 8123
    assert record[0][-1] == "start"
    assert any("axiom_flow_service.py" in cmd for cmd in record[0])


def test_services_start_twice_within_window_conflicts(monkeypatch):
    """15s 窗口内重复启动 → 409（starting 过渡态）。"""
    _patch_probe(monkeypatch, False)
    _patch_script(monkeypatch)
    client = _client(monkeypatch)
    assert client.post("/api/v1/services/tracker/start").status_code == 200
    response = client.post("/api/v1/services/tracker/start")
    assert response.status_code == 409


def test_services_start_already_online_conflicts(monkeypatch):
    """探测已 online（外部/遗留进程）→ start 409。"""
    _patch_probe(monkeypatch, True)
    _patch_script(monkeypatch)
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/tracker/start")
    assert response.status_code == 409


def test_services_config_start_stop_restart_conflict(monkeypatch):
    """config 单元不可经自身启停 → 409。"""
    client = _client(monkeypatch)
    for action in ("start", "stop", "restart"):
        response = client.post(f"/api/v1/services/config/{action}")
        assert response.status_code == 409, action


def test_services_unknown_unit_404(monkeypatch):
    """未知服务名 → 404。"""
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/nonexistent/start")
    assert response.status_code == 404


def test_services_stop_not_running_conflicts(monkeypatch):
    """停止未托管服务 → 409（无 PID 记录且探测离线……以托管记录为准）。"""
    _patch_probe(monkeypatch, False)
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/tracker/stop")
    assert response.status_code == 409


def test_services_stop_calls_lifecycle_script(monkeypatch):
    """stop：经生命周期脚本 stop（优雅停止 + 强杀兜底由脚本自含）→ stopping。"""
    _patch_probe(monkeypatch, False)
    record = []
    _patch_script(monkeypatch, record=record)
    client = _client(monkeypatch)
    client.post("/api/v1/services/tracker/start")
    response = client.post("/api/v1/services/tracker/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "stopping"
    assert record[0][-1] == "start"
    assert record[1][-1] == "stop"


def test_services_stop_script_failure_returns_500(monkeypatch):
    """脚本 stop 失败（退出码 1）→ 500（不静默吞掉，后端稳定）。"""
    _patch_probe(monkeypatch, False)
    _patch_script(monkeypatch, exit_codes={"stop": 1})
    client = _client(monkeypatch)
    client.post("/api/v1/services/tracker/start")
    response = client.post("/api/v1/services/tracker/stop")
    assert response.status_code == 500


def test_services_transition_window_expires_to_probe_result(monkeypatch):
    """启动后 15s 窗口内显示 starting；窗口过后回落为探测结果。"""
    from qed_engine.services import service_manager as sm

    _patch_probe(monkeypatch, False)
    _patch_script(monkeypatch)
    fake_now = {"t": 1000.0}
    monkeypatch.setattr(sm.time, "monotonic", lambda: fake_now["t"])
    client = _client(monkeypatch)
    client.post("/api/v1/services/tracker/start")
    services = client.get("/api/v1/services").json()["services"]
    by_name = {s["name"]: s for s in services}
    assert by_name["tracker"]["status"] == "starting"
    fake_now["t"] += 30.0
    monkeypatch.setattr(sm, "_probe_http", lambda port: False)
    services = client.get("/api/v1/services").json()["services"]
    by_name = {s["name"]: s for s in services}
    assert by_name["tracker"]["status"] == "offline"


def test_services_restart_stops_then_starts(monkeypatch):
    """restart：经生命周期脚本先停后启（stop → start）。"""
    _patch_probe(monkeypatch, False)
    record = []
    _patch_script(monkeypatch, record=record)
    client = _client(monkeypatch)
    client.post("/api/v1/services/tracker/start")
    response = client.post("/api/v1/services/tracker/restart")
    assert response.status_code == 200
    assert response.json()["status"] == "starting"
    assert record[-2][-1] == "stop"  # 先停
    assert record[-1][-1] == "start"  # 后启


def test_services_stop_externally_running_script_unit(monkeypatch):
    """脚本单元外部运行中（探测在线、无托管记录，如手动经脚本启动）→ stop 200（REQ-017① 契约）。

    修复：_stop 曾以 _MANAGED 为唯一放行条件，手动启动的 tracker 停止返回 409「无托管记录」。
    """
    _patch_probe(monkeypatch, True)
    record = []
    _patch_script(monkeypatch, record=record)
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/tracker/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "stopping"
    assert record[0][-1] == "stop"


def test_services_restart_externally_running_script_unit(monkeypatch):
    """脚本单元外部运行中（探测在线、无托管记录）→ restart 200：先经脚本停再启。

    修复：restart 曾跳过 stop（无托管记录）后 _start 因端口在线 409，表现为「重启无效果」。
    模拟真实时序：脚本 stop 返回后端口释放（探测转离线），_start 方可通过。
    """
    import subprocess

    from qed_engine.services import service_manager as sm

    class FakeCompleted:
        returncode = 0
        stdout = "pid: 8123\n"
        stderr = ""

    state = {"online": True}
    record: list = []

    def fake_run(cmd, **kwargs):
        record.append(cmd)
        if cmd and cmd[-1] == "stop":
            state["online"] = False  # 脚本 stop 后端口释放
        return FakeCompleted()

    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setattr(sm, "_probe_http", lambda port: state["online"])
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/tracker/restart")
    assert response.status_code == 200
    assert response.json()["status"] == "starting"
    assert record[0][-1] == "stop"
    assert record[1][-1] == "start"


def test_services_start_web_uses_lifecycle_script(monkeypatch):
    """web（8903）：经生命周期脚本 start（scripts/qed_web_service.py，REQ-03x）。"""
    _patch_probe(monkeypatch, False)
    record = []
    _patch_script(monkeypatch, record=record)
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/web/start")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "web"
    assert body["status"] == "starting"
    assert body["pid"] == 8123
    assert record[0][-1] == "start"
    assert any("qed_web_service.py" in cmd for cmd in record[0])

# ---------- 数据域·Axiom（8902 适配，契约事实源 Axiom-Flow docs/architecture/api.md） ----------


def _axiom_client(handler) -> AxiomClient:
    return AxiomClient(base_url="http://axiom.test", transport=httpx.MockTransport(handler))


def test_axiom_books_via_gateway(monkeypatch):
    """GET /api/v1/books：书目列表（BookOut 形状：page_count/parse_status/ingest_status）经 8900 透传 8902。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books"
        return httpx.Response(
            200,
            json=[
                {
                    "book_id": "01-rudin",
                    "title": "Rudin",
                    "page_count": 20,
                    "pages_done": 20,
                    "ingest_status": "ingested",
                    "parse_status": "completed",
                }
            ],
        )

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books")
    assert response.status_code == 200
    assert response.json()[0]["book_id"] == "01-rudin"


def test_axiom_book_page_via_gateway(monkeypatch):
    """GET /books/{id}/pages/{no}：8902 PageData（无 page_no、相对 image_url）由 8900 补 page_no 并重写图片地址为 8900 绝对 URL。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/01-rudin/pages/3"
        return httpx.Response(
            200,
            json={
                "blocks": {"page": 3, "source": "mineru", "blocks": [], "quality": None},
                "markdown": "## 标题\n$$x^2$$",
                "image_url": "/api/v1/books/01-rudin/pages/3/image",
                "edits": [],
            },
        )

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/01-rudin/pages/3")
    assert response.status_code == 200
    data = response.json()
    assert data["markdown"].startswith("## 标题")
    # 8900 补写页号（8902 不返回 page_no）
    assert data["page_no"] == 3
    # 图片地址改写为 8900 的代理端点（ADR 0007：浏览器只连 8900；serve_web 无 /api 代理，相对路径在生产必断）
    assert data["image_url"].endswith("/api/v1/books/01-rudin/pages/3/image")
    assert data["image_url"].startswith("http")


def test_axiom_manifest_via_gateway(monkeypatch):
    """GET /api/v1/books/{id}/manifest：产物清单透传。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/01-rudin/manifest"
        return httpx.Response(200, json=[{"path": "p0001.md", "size": 1024, "sha256": "abc"}])

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    assert client.get("/api/v1/books/01-rudin/manifest").json()[0]["path"] == "p0001.md"


def test_axiom_page_image_proxy(monkeypatch):
    """GET /books/{id}/pages/{no}/image：8900 代理 8902 页图字节流（浏览器只连 8900）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/01-rudin/pages/3/image"
        return httpx.Response(200, content=b"\x89PNG-fake", headers={"content-type": "image/png"})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/01-rudin/pages/3/image")
    assert response.status_code == 200
    assert response.content == b"\x89PNG-fake"
    assert response.headers["content-type"] == "image/png"


def test_axiom_page_image_offline_maps_503(monkeypatch):
    """页图代理：8902 离线 → 503 降级（与页数据一致）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/01-rudin/pages/3/image")
    assert response.status_code == 503
    assert "Axiom-Flow 服务不可达" in response.json()["detail"]


def test_axiom_book_detail_via_gateway(monkeypatch):
    """GET /api/v1/books/{id}：单本详情透传 8902（BookOut 含 file_path/ingest_status，前端判断 PDF 直显）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/01-rudin"
        return httpx.Response(
            200,
            json={"book_id": "01-rudin", "file_path": "raw/math/01-rudin.pdf", "ingest_status": "ingested"},
        )

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/01-rudin")
    assert response.status_code == 200
    assert response.json()["file_path"] == "raw/math/01-rudin.pdf"


def _tmp_pdf_root(monkeypatch, tmp_path):
    """临时数据根 + 假 PDF（测试隔离：不读写真实 dataset 数据根）。"""
    pdf = tmp_path / "raw" / "math" / "01-rudin.pdf"
    pdf.parent.mkdir(parents=True)
    pdf.write_bytes(b"%PDF-1.4 fake")
    monkeypatch.setenv("QED_DATA_ROOT", str(tmp_path))
    return pdf


def test_axiom_book_file_streams_pdf(monkeypatch, tmp_path):
    """GET /books/{id}/file：af_books.file_path（数据根相对路径）解析后 inline PDF 流（原始文件优先直显）。"""
    _tmp_pdf_root(monkeypatch, tmp_path)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"book_id": "01-rudin", "file_path": "raw/math/01-rudin.pdf"})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/01-rudin/file")
    assert response.status_code == 200
    assert response.content == b"%PDF-1.4 fake"
    assert response.headers["content-type"] == "application/pdf"
    assert "inline" in response.headers.get("content-disposition", "")


def test_axiom_book_file_traversal_rejected(monkeypatch, tmp_path):
    """file_path 越出数据根（../）→ 400 阻止（数据根边界安全：不泄露根外文件）。"""
    _tmp_pdf_root(monkeypatch, tmp_path)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"book_id": "x", "file_path": "../../Windows/win.ini"})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/x/file")
    assert response.status_code == 400


def test_axiom_book_file_missing_404(monkeypatch, tmp_path):
    """file_path 为空 → 404（前端据此显示「源文件未登记」而非报错横幅）。"""
    _tmp_pdf_root(monkeypatch, tmp_path)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"book_id": "x", "file_path": ""})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/x/file")
    assert response.status_code == 404

    def missing_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"book_id": "x", "file_path": "raw/math/nope.pdf"})

    client2 = _client(monkeypatch, axiom=_axiom_client(missing_handler))
    assert client2.get("/api/v1/books/x/file").status_code == 404


def test_axiom_book_file_offline_maps_503(monkeypatch):
    """PDF 流端点：8902 离线 → 503 降级（独立性铁律，与其他 8902 端点一致）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/01-rudin/file")
    assert response.status_code == 503
    assert "Axiom-Flow 服务不可达" in response.json()["detail"]


def test_axiom_parse_job_create_and_query(monkeypatch):
    """POST /parse-jobs（202）+ GET /parse-jobs/{id}：8900 门面用 engine 字段，8902 响应主键 id + progress 对象，原样透传。"""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v1/parse-jobs" and request.method == "POST":
            body = json.loads(request.content)
            assert body["book_id"] == "01-rudin"
            assert body["engine"] == "mineru"
            assert body["pages"] == [1, 2]
            assert "strategy" not in body  # 8902 无 strategy 字段，不得再发
            return httpx.Response(
                202,
                json={"id": "j-1", "book_id": "01-rudin", "engine": "mineru", "status": "queued", "progress": {"parsed": 0, "total": 2}},
            )
        if request.url.path == "/api/v1/parse-jobs/j-1":
            return httpx.Response(
                200,
                json={"id": "j-1", "book_id": "01-rudin", "engine": "mineru", "status": "running", "progress": {"parsed": 1, "total": 2}},
            )
        return httpx.Response(404, json={"detail": f"unexpected {request.url.path}"})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    created = client.post("/api/v1/parse-jobs", json={"book_id": "01-rudin", "pages": [1, 2], "engine": "mineru"})
    assert created.status_code == 202
    assert created.json()["status"] == "queued"
    assert created.json()["id"] == "j-1"
    assert created.json()["progress"] == {"parsed": 0, "total": 2}
    queried = client.get("/api/v1/parse-jobs/j-1")
    assert queried.json()["status"] == "running"


def test_axiom_upstream_404_passthrough(monkeypatch):
    """8902 返回 404（book/page 不存在）：8900 同码透传 detail。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "书目不存在：01-unknown"})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/01-unknown/pages/1")
    assert response.status_code == 404
    assert response.json()["detail"] == "书目不存在：01-unknown"


def test_axiom_offline_maps_503(monkeypatch):
    """8902 离线（连接失败）：8900 统一 503，前端据此降级（独立性铁律）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books")
    assert response.status_code == 503
    assert "Axiom-Flow 服务不可达" in response.json()["detail"]


# --- 书目同步与块判定（REQ-042，af_* 契约草案 Axiom-Flow af-books-sync.md） ---


def _sync_tracker_handler(knowledge_rows, details):
    """8901 同步取数 handler：/knowledge 列表 + 详情 + catalog（课程名映射）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/v1/knowledge":
            return httpx.Response(200, json=knowledge_rows)
        if path.startswith("/api/v1/knowledge/"):
            kid = path.rsplit("/", 1)[-1]
            return httpx.Response(200, json=details.get(kid, {"books": []}))
        if path == "/api/v1/catalogs/math-qe":
            return httpx.Response(
                200,
                json={"targets": [{"course_id": "01_math_analysis", "course_name": "数学分析"}]},
            )
        return httpx.Response(404, json={"detail": f"unexpected {path}"})

    return handler


def test_axiom_sync_books_via_gateway(monkeypatch):
    """POST /api/v1/books/sync：聚合 8901 verified 书籍（仅 verified，课程名映射）→ 转发 8902。"""

    knowledge_rows = [
        {
            "knowledge_id": "kn_1",
            "domain_id": "math",
            "course_id": "01_math_analysis",
        },
        {
            "knowledge_id": "kn_2",
            "domain_id": "math",
            "course_id": "02_real_analysis",
        },
    ]
    details = {
        "kn_1": {
            "books": [
                {
                    "book_id": "bk_verified",
                    "title": "数学分析原理",
                    "part": "",
                    "display_title": "数学分析原理",
                    "authors": [{"name": "Rudin", "role": "author"}],
                    "sha256": "ab" * 32,
                    "relative_path": "raw/books/...",
                    "page_count": 342,
                    "status": "verified",
                },
                {
                    "book_id": "bk_downloaded",
                    "title": "未验证书",
                    "display_title": "未验证书",
                    "status": "downloaded",
                },
            ]
        },
        "kn_2": {"books": []},
    }

    def axiom_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/sync"
        body = json.loads(request.content)
        assert len(body) == 1  # 仅 verified
        assert body[0]["book_id"] == "bk_verified"
        assert body[0]["course_id"] == "01_math_analysis"
        assert body[0]["course_name"] == "数学分析"
        assert body[0]["domain_id"] == "math"
        assert body[0]["knowledge_id"] == "kn_1"
        # BookSyncItem 契约字段：file_path（数据根相对路径，8902 importer 语义），不再有 relative_path/sha256/page_count
        assert body[0]["file_path"] == "raw/books/..."
        assert "relative_path" not in body[0]
        assert "sha256" not in body[0]
        assert "page_count" not in body[0]
        assert body[0]["authors"] == [{"name": "Rudin", "role": "author"}]
        return httpx.Response(200, json={"synced": 1, "updated": 0, "books": []})

    client = _client(
        monkeypatch,
        tracker=_tracker_client(_sync_tracker_handler(knowledge_rows, details)),
        axiom=_axiom_client(axiom_handler),
    )
    response = client.post("/api/v1/books/sync")
    assert response.status_code == 200
    assert response.json()["synced"] == 1


def test_axiom_sync_books_tracker_offline_maps_503(monkeypatch):
    """同步取数：8901 离线（list_knowledge 连接失败）→ 503「QED-Tracker 服务不可达」。"""

    def tracker_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(
        monkeypatch,
        tracker=_tracker_client(tracker_handler),
        axiom=_axiom_client(lambda r: httpx.Response(500)),
    )
    response = client.post("/api/v1/books/sync")
    assert response.status_code == 503
    assert "QED-Tracker 服务不可达" in response.json()["detail"]


def test_axiom_sync_books_axiom_offline_maps_503(monkeypatch):
    """同步写入：8901 可取数但 8902 离线 → 503「Axiom-Flow 服务不可达」。"""

    knowledge_rows = [{"knowledge_id": "kn_1", "domain_id": "math", "course_id": "01_math_analysis"}]
    details = {
        "kn_1": {
            "books": [
                {
                    "book_id": "bk_1",
                    "title": "T",
                    "display_title": "T",
                    "status": "verified",
                }
            ]
        }
    }

    def axiom_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(
        monkeypatch,
        tracker=_tracker_client(_sync_tracker_handler(knowledge_rows, details)),
        axiom=_axiom_client(axiom_handler),
    )
    response = client.post("/api/v1/books/sync")
    assert response.status_code == 503
    assert "Axiom-Flow 服务不可达" in response.json()["detail"]


def test_axiom_sync_books_real_tracker_shape(monkeypatch):
    """真实 8901 形状（E2E 暴露）：书籍字段为 file_path、知识行 domain_id 可为 None → payload file_path 取真值、domain 回退空串。"""

    knowledge_rows = [{"knowledge_id": "kt-mathanalysis-1", "domain_id": None, "course_id": "math_analysis"}]
    details = {
        "kt-mathanalysis-1": {
            "books": [
                {
                    "book_id": "mathanalysis-b01",
                    "title": "微积分及其应用",
                    "part": "",
                    "display_title": None,
                    "authors": [{"name": "Bittinger", "role": "author"}],
                    "file_path": "raw/math-advanced/math_analysis/rudin_41ed7e1e.pdf",
                    "page_count": None,
                    "status": "verified",
                }
            ]
        }
    }

    def axiom_handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert body[0]["file_path"] == "raw/math-advanced/math_analysis/rudin_41ed7e1e.pdf"
        assert body[0]["domain_id"] == ""
        assert body[0]["course_id"] == "math_analysis"
        return httpx.Response(200, json={"synced": 1, "updated": 0, "books": []})

    client = _client(
        monkeypatch,
        tracker=_tracker_client(_sync_tracker_handler(knowledge_rows, details)),
        axiom=_axiom_client(axiom_handler),
    )
    response = client.post("/api/v1/books/sync")
    assert response.status_code == 200


def test_axiom_parsing_tree_course_only_fallback(monkeypatch):
    """真实数据 domain_id 为空（8901 知识行无领域）：书目仍按 course_id 回退挂到唯一匹配课程节点。"""
    import qed_engine.services.shared_tables as shared_tables

    monkeypatch.setattr(shared_tables, "list_domains_with_courses", lambda settings: _fake_shared_tree())

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {
                    "book_id": "mathanalysis-b01",
                    "domain_id": "",
                    "course_id": "01_math_analysis",
                    "title": "微积分及其应用",
                    "display_title": "",
                }
            ],
        )

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/parsing/tree")
    assert response.status_code == 200
    course = response.json()[0]["children"][0]
    assert course["children"][0]["book"]["book_id"] == "mathanalysis-b01"


def test_axiom_block_review_put_and_get(monkeypatch):
    """8900 /review 门面 → 8902 /edit + /edits（REQ-001 对齐）：请求转发与 EditRecord→BlockReview 映射。"""

    edit_record = {
        "edit_id": "e-1",
        "book_id": "01-rudin",
        "page_no": 3,
        "block_index": 2,
        "block_type": "formula",
        "verdict": "bad",
        "note": "公式渲染缺失",
        "corrected_text": None,
        "corrected_bbox": None,
        "edited_at": "2026-09-20T10:00:00",
        "updated_at": "2026-09-20T10:00:00",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/v1/books/01-rudin/pages/3/blocks/2/edit" and request.method == "PUT":
            body = json.loads(request.content)
            assert body["verdict"] == "bad"
            assert body["note"] == "公式渲染缺失"
            return httpx.Response(200, json=edit_record)
        if path == "/api/v1/books/01-rudin/pages/3/edits" and request.method == "GET":
            return httpx.Response(200, json=[edit_record])
        return httpx.Response(404, json={"detail": f"unexpected {path}"})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    put = client.put("/api/v1/books/01-rudin/pages/3/blocks/2/review", json={"verdict": "bad", "note": "公式渲染缺失"})
    assert put.status_code == 200
    assert put.json()["verdict"] == "bad"
    assert put.json()["note"] == "公式渲染缺失"
    assert put.json()["block_index"] == 2
    get = client.get("/api/v1/books/01-rudin/pages/3/blocks/2/review")
    assert get.status_code == 200
    assert get.json()["note"] == "公式渲染缺失"
    assert get.json()["block_type"] == "formula"


def test_axiom_block_review_get_missing_404(monkeypatch):
    """GET /review 回显：页级 /edits 中无该块记录 → 8900 返回 404（前端按无判定处理）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/01-rudin/pages/3/edits"
        return httpx.Response(200, json=[])

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/01-rudin/pages/3/blocks/2/review")
    assert response.status_code == 404


def test_axiom_block_review_verdict_validation(monkeypatch):
    """块判定 verdict 非法（非 ok/bad）→ 8900 直接 422，不请求 8902。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("8902 不应被调用")

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.put("/api/v1/books/01-rudin/pages/3/blocks/2/review", json={"verdict": "unknown"})
    assert response.status_code == 422


# --- ARCH-020-D 前置（B 轮并入）：ingest 透传 + /edit 门面 ---


def test_axiom_ingest_passthrough(monkeypatch):
    """POST /books/{id}/ingest 透传 8902（列表态「ingest」按钮硬依赖），响应原样返回。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/api/v1/books/01-rudin/ingest"
        return httpx.Response(
            200,
            json={
                "book_id": "01-rudin",
                "page_count": 408,
                "sha256": "ab" * 32,
                "ingest_status": "ingested",
            },
        )

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.post("/api/v1/books/01-rudin/ingest")
    assert response.status_code == 200
    body = response.json()
    assert body["ingest_status"] == "ingested"
    assert body["page_count"] == 408


def test_axiom_ingest_offline_maps_503(monkeypatch):
    """ingest 透传：8902 不可达 → 503（统一上游不可用语义）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"detail": "boom"})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.post("/api/v1/books/01-rudin/ingest")
    assert response.status_code == 503


def test_axiom_edit_facade_put_get(monkeypatch):
    """/edit 门面（设计 §5 目标形态）：PUT 转发 verdict/note/corrected_text/corrected_bbox，GET 页级编辑列表原样返回。"""

    edit_record = {
        "edit_id": "e-2",
        "book_id": "01-rudin",
        "page_no": 3,
        "block_index": 2,
        "block_type": "formula",
        "verdict": "bad",
        "note": "漏了上限",
        "corrected_text": "\\lim_{n\\to\\infty}",
        "corrected_bbox": [10, 20, 30, 40],
        "edited_at": "2026-09-20T12:00:00",
        "updated_at": "2026-09-20T12:00:00",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/v1/books/01-rudin/pages/3/blocks/2/edit" and request.method == "PUT":
            body = json.loads(request.content)
            assert body["verdict"] == "bad"
            assert body["note"] == "漏了上限"
            assert body["corrected_text"] == "\\lim_{n\\to\\infty}"
            assert body["corrected_bbox"] == [10, 20, 30, 40]
            return httpx.Response(200, json=edit_record)
        if path == "/api/v1/books/01-rudin/pages/3/edits" and request.method == "GET":
            return httpx.Response(200, json=[edit_record])
        return httpx.Response(404, json={"detail": f"unexpected {path}"})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    put = client.put(
        "/api/v1/books/01-rudin/pages/3/blocks/2/edit",
        json={
            "verdict": "bad",
            "note": "漏了上限",
            "corrected_text": "\\lim_{n\\to\\infty}",
            "corrected_bbox": [10, 20, 30, 40],
        },
    )
    assert put.status_code == 200
    assert put.json()["corrected_bbox"] == [10, 20, 30, 40]
    edits = client.get("/api/v1/books/01-rudin/pages/3/edits")
    assert edits.status_code == 200
    assert edits.json()[0]["edit_id"] == "e-2"


def test_axiom_edit_facade_partial_and_invalid(monkeypatch):
    """/edit 门面：仅文字修正（无 verdict）→ 不发送 verdict 字段；verdict 非法 → 422 不打上游。"""
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"book_id": "01-rudin", "page_no": 3, "block_index": 2})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    put = client.put(
        "/api/v1/books/01-rudin/pages/3/blocks/2/edit",
        json={"corrected_text": "正文修正"},
    )
    assert put.status_code == 200
    assert "verdict" not in seen[0]
    assert seen[0]["corrected_text"] == "正文修正"
    bad = client.put("/api/v1/books/01-rudin/pages/3/blocks/2/edit", json={"verdict": "maybe"})
    assert bad.status_code == 422


# --- /parsing/tree 聚合（ARCH-020；后端此前零用例） ---


def _fake_shared_tree() -> list:
    return [
        {
            "domain_id": "math",
            "name": "数学",
            "courses": [{"course_id": "01_math_analysis", "name": "数学分析"}],
        }
    ]


def test_axiom_parsing_tree_aggregates_books(monkeypatch):
    """GET /parsing/tree：共享表领域课程 + 8902 书目按 domain:course 挂到课程节点下。"""
    import qed_engine.services.shared_tables as shared_tables

    monkeypatch.setattr(shared_tables, "list_domains_with_courses", lambda settings: _fake_shared_tree())

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books"
        return httpx.Response(
            200,
            json=[
                {
                    "book_id": "01-rudin",
                    "domain_id": "math",
                    "course_id": "01_math_analysis",
                    "display_title": "数学分析原理",
                    "parse_status": "completed",
                    "pages_done": 20,
                }
            ],
        )

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/parsing/tree")
    assert response.status_code == 200
    tree = response.json()
    assert tree[0]["title"] == "数学"
    course = tree[0]["children"][0]
    assert course["title"] == "数学分析"
    assert course["children"][0]["book"]["book_id"] == "01-rudin"


def test_axiom_parsing_tree_degrades_without_axiom(monkeypatch):
    """8902 离线：/parsing/tree 仍 200，返回领域→课程、书目为空（独立性铁律）。"""
    import qed_engine.services.shared_tables as shared_tables

    monkeypatch.setattr(shared_tables, "list_domains_with_courses", lambda settings: _fake_shared_tree())

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/parsing/tree")
    assert response.status_code == 200
    tree = response.json()
    assert tree[0]["children"][0]["children"] == []


# 注：旧探索透传路由测试（PLAN-021 冻结端点 §1~§7.2）已随 B1 删除——8900 改由自有
# /explore-sessions 会话端点承接探索（PLAN-022），见 tests/test_explore_sessions.py。


# --- 领域只读/维护透传（REQ-059） ---


def test_list_domains_passthrough(monkeypatch):
    """GET /domains → 8901 透传。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{"domain_id": "d1", "name": "高等数学"}])

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.get("/api/v1/domains")
    assert resp.status_code == 200
    assert resp.json()[0]["domain_id"] == "d1"


def test_update_domain_passthrough(monkeypatch):
    """PATCH /domains/{id} → 8901 透传。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"domain_id": "d1", "description": "新"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.patch("/api/v1/domains/d1", json={"description": "新"})
    assert resp.status_code == 200
    assert resp.json()["description"] == "新"


def test_course_system_passthrough(monkeypatch):
    """GET /courses → 8901 领域课程体系透传（左树 v2 数据源）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[
            {"domain_id": "d1", "name": "高等数学", "courses": [
                {"course_id": "c1", "name": "数学分析"},
            ]},
        ])

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.get("/api/v1/courses")
    assert resp.status_code == 200
    assert resp.json()[0]["courses"][0]["name"] == "数学分析"


def test_delete_domain_passthrough(monkeypatch):
    """DELETE /domains/{id} → 8901 透传；409 保护原码转发。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": {"code": "DOMAIN_NOT_EMPTY", "message": "仍有课程"}})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.delete("/api/v1/domains/d1")
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "DOMAIN_NOT_EMPTY"


def test_create_course_for_domain_passthrough(monkeypatch):
    """POST /domains/{id}/courses → 8901 透传（成功态规整为 200）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(201, json={"course_id": "c9", "name": "复变函数"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d1/courses", json={"name": "复变函数"})
    assert resp.status_code == 200
    assert resp.json()["course_id"] == "c9"


def test_update_course_passthrough(monkeypatch):
    """PATCH /courses/{id} → 8901 透传。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"course_id": "c1", "note": "已更新"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.patch("/api/v1/courses/c1", json={"note": "已更新"})
    assert resp.status_code == 200
    assert resp.json()["note"] == "已更新"


def test_delete_course_passthrough(monkeypatch):
    """DELETE /courses/{id} → 8901 透传。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(204)

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.delete("/api/v1/courses/c1")
    assert resp.status_code in (200, 204)


def test_course_crud_upstream_404_forwarded(monkeypatch):
    """§8 未上线：上游默认形态 404/405 归一为结构化 404 UPSTREAM_NOT_IMPLEMENTED（前端降级提示）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "Not Found"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    for method, url, json_body in (
        ("post", "/api/v1/domains", {"name": "x"}),
        ("delete", "/api/v1/domains/d1", None),
        ("post", "/api/v1/domains/d1/courses", {"name": "x"}),
        ("patch", "/api/v1/courses/c1", {}),
        ("delete", "/api/v1/courses/c1", None),
    ):
        resp = client.request(method, url, json=json_body)
        assert resp.status_code == 404, f"{method} {url}"
        assert resp.json()["detail"]["code"] == "UPSTREAM_NOT_IMPLEMENTED"


def test_create_domain_passthrough(monkeypatch):
    """POST /domains → 8901 手工新建领域透传（§8）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"domain_id": "d9", "name": "高等数学", "description": ""})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains", json={"name": "高等数学", "description": ""})
    assert resp.status_code == 200
    assert resp.json()["domain_id"] == "d9"


def test_course_crud_upstream_405_normalized(monkeypatch):
    """§8 上游路径通配命中不同方法（如 8901 GET /courses/{domain_id} 吞掉 PATCH/DELETE）→ 405 归一结构化 404。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(405, json={"detail": "Method Not Allowed"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.patch("/api/v1/courses/c1", json={"stage": "本科一"})
    assert resp.status_code == 404
    body = resp.json()["detail"]
    assert body["code"] == "UPSTREAM_NOT_IMPLEMENTED"
    assert "REQ-059" in body["message"]


def test_structured_404_passthrough_not_rewritten(monkeypatch):
    """端点上线后的业务 404（带结构化 code）原样透传，不被归一改写。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": {"code": "DOMAIN_NOT_FOUND", "message": "领域不存在"}})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.delete("/api/v1/domains/d1")
    assert resp.status_code == 404
    assert resp.json()["detail"]["code"] == "DOMAIN_NOT_FOUND"


# ---------- 数据域·导入降级（PLAN-028：8901 离线时导入领域知识可用） ----------


def _manual_payload() -> dict:
    return {
        "domain": "computer-science",
        "name": "计算机",
        "description": "计算机科学领域",
        "stages": ["基础", "主干"],
        "courses": [{"name": "数据结构"}, {"name": "操作系统"}],
    }


def _degrading_tracker(monkeypatch, handler) -> TrackerClient:
    """带 settings 的 TrackerClient（降级分支依赖 self._settings 判定）。"""
    from qed_engine.config import Settings

    monkeypatch.setenv("QED_DB_PASSWORD", "test-password")
    return TrackerClient(
        base_url="http://tracker.test",
        transport=httpx.MockTransport(handler),
        settings=Settings(),
    )


def test_import_domain_degrades_to_shared_tables(monkeypatch):
    """POST /domains/import：8901 离线 → 降级 import_domain_manual 直写共享表（PLAN-028）。

    返回与 8901 契约同形 {domain_id, courses_created, courses_updated}；领域置「待确认」
    由 shared_tables 层完成（此处 mock 验证降级接线与结果透传）。
    """
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    captured: dict = {}

    def fake_import_manual(settings, data, *, target_domain_id=None):
        captured["data"] = data
        captured["target_domain_id"] = target_domain_id
        return {"domain_id": "computer-science", "courses_created": 2, "courses_updated": 0}

    monkeypatch.setattr(
        "qed_engine.services.shared_tables.import_domain_manual", fake_import_manual
    )
    client = _client(monkeypatch, tracker=_degrading_tracker(monkeypatch, handler))
    response = client.post("/api/v1/domains/import", json={"domain": _manual_payload()})
    assert response.status_code == 200
    assert response.json() == {
        "domain_id": "computer-science",
        "courses_created": 2,
        "courses_updated": 0,
    }
    assert captured["data"]["name"] == "计算机"


def test_import_domain_degrade_invalid_payload_is_400(monkeypatch):
    """导入降级路径：manual@v1 必需字段缺失 → 400（与 8901 契约一致，不写库）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(monkeypatch, tracker=_degrading_tracker(monkeypatch, handler))
    bad = _manual_payload()
    del bad["courses"]
    response = client.post("/api/v1/domains/import", json={"domain": bad})
    assert response.status_code == 400
