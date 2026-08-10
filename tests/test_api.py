"""
模块职责：配置中心 API 契约测试：health、模型路由表与供应商配置状态，密钥值不泄露。
设计关联（DesignRef）：docs/design/config-center-api.md
实现状态：Current
被测代码：backend/qed_engine/api/main.py、backend/qed_engine/api/schemas.py
"""
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.tracker_client import TrackerClient


@pytest.fixture(autouse=True)
def _reset_service_manager(monkeypatch):
    """每个测试前重置服务托管全局状态（_OPS/_MANAGED/_LOCKED），避免跨测试污染。"""
    from qed_engine.api import service_manager as sm

    sm._OPS.clear()
    sm._MANAGED.clear()
    sm._LOCKED.clear()


def _client(monkeypatch, *, qwen="", deepseek="", glm="", db_password="", tracker=None):
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
    return TestClient(create_app(tracker_client=tracker))


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


# ---------- 语义 API（数据域：catalogs / resources / tasks，8900 自有契约） ----------


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


def test_resources_list_forwards_filters(monkeypatch):
    """GET /api/v1/resources：查询参数透传 8901（状态/课程/类型/语言）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/resources"
        assert dict(request.url.params) == {"status": "candidate", "kind": "book"}
        return httpx.Response(200, json=[{"resource_id": "sha256:abc", "status": "candidate"}])

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/resources", params={"status": "candidate", "kind": "book"})
    assert response.status_code == 200
    assert response.json() == [{"resource_id": "sha256:abc", "status": "candidate"}]


def test_resource_state_actions_via_semantic_api(monkeypatch):
    """POST /resources/{id}/confirm|backup|approve|register：状态机操作经 8900。"""
    seen = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["count"] += 1
        return httpx.Response(200, json={"resource_id": "sha256:abc", "status": "changed"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    for action in ("confirm", "backup", "approve", "register"):
        response = client.post(f"/api/v1/resources/sha256:abc/{action}")
        assert response.status_code == 200, action
        assert response.json()["resource_id"] == "sha256:abc"
    assert seen["count"] == 4


def test_reject_forwards_reason_via_semantic_api(monkeypatch):
    """POST /resources/{id}/reject：reason 必填并转发 8901（留痕可追溯）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/resources/sha256:abc/reject"
        assert json.loads(request.read()) == {"reason": "缺页"}
        return httpx.Response(200, json={"resource_id": "sha256:abc", "status": "rejected"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/resources/sha256:abc/reject", json={"reason": "缺页"})
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


def test_reject_without_reason_via_semantic_api(monkeypatch):
    """reject 缺 reason：8900 直接 422（FastAPI 校验），不发 8901。"""
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("不应请求 8901")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/resources/sha256:abc/reject", json={})
    assert response.status_code == 422


def test_tasks_endpoints_via_semantic_api(monkeypatch):
    """任务四端点：列表/详情/评估创建/下载创建。"""
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/v1/tasks":
            return httpx.Response(200, json=[{"task_id": "t-1", "status": "succeeded"}])
        if path == "/api/v1/tasks/t-1":
            return httpx.Response(200, json={"task_id": "t-1", "status": "succeeded"})
        if path == "/api/v1/tasks/catalog/evaluate":
            assert json.loads(request.read()) == {"course_id": "01"}
            return httpx.Response(200, json={"task_id": "t-e", "status": "running"})
        if path == "/api/v1/tasks/books/download":
            assert json.loads(request.read()) == {"resource_id": "sha256:abc"}
            return httpx.Response(200, json={"task_id": "t-d", "status": "running"})
        return httpx.Response(404, json={"detail": f"unexpected {path}"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    assert client.get("/api/v1/tasks").json() == [{"task_id": "t-1", "status": "succeeded"}]
    assert client.get("/api/v1/tasks/t-1").json()["status"] == "succeeded"
    response = client.post("/api/v1/tasks/catalog/evaluate", json={"course_id": "01"})
    assert response.status_code == 200
    assert response.json()["task_id"] == "t-e"
    response = client.post("/api/v1/tasks/books/download", json={"resource_id": "sha256:abc"})
    assert response.status_code == 200
    assert response.json()["task_id"] == "t-d"


def test_task_get_resource_via_semantic_api(monkeypatch):
    """GET /resources/{id}：资源详情（详情面板）经 8900。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/resources/sha256:abc"
        return httpx.Response(200, json={"resource_id": "sha256:abc", "title": "高等数学"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/resources/sha256:abc")
    assert response.status_code == 200
    assert response.json() == {"resource_id": "sha256:abc", "title": "高等数学"}


def test_resource_file_preview_via_semantic_api(monkeypatch):
    """GET /resources/{id}/file：PDF 预览流经 8900 转发（content-type 透传）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/resources/sha256:abc/file"
        return httpx.Response(200, content=b"%PDF-1.4", headers={"content-type": "application/pdf"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/resources/sha256:abc/file")
    assert response.status_code == 200
    assert response.content == b"%PDF-1.4"
    assert response.headers["content-type"] == "application/pdf"


def test_tracker_offline_returns_503(monkeypatch):
    """8901 离线：数据域端点返回 503 + 明确提示（前端降级显示依据）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/resources")
    assert response.status_code == 503
    assert "QED-Tracker" in response.json()["detail"]


def test_upstream_conflict_passthrough(monkeypatch):
    """8901 返回 409（状态机冲突）：8900 同码透传 detail，前端既有 409 处理生效。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "状态机冲突：当前状态 downloading 不允许"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/resources/sha256:abc/confirm")
    assert response.status_code == 409
    assert response.json()["detail"] == "状态机冲突：当前状态 downloading 不允许"


# ---------- 服务域（控制中心 /services：service-control.md 契约） ----------


def test_services_spec_workdirs_and_log_dir_point_to_repo_root():
    """注册表几何守护：ROOT 必须解析到仓库根（P1 目录迁移 src/ → backend/ 后 parents 层级
    曾错位导致 workdir 指向 backend/QED-Tracker，真实启动 WinError 267）。"""
    from pathlib import Path

    from qed_engine.api import service_manager as sm
    from qed_engine.config import Settings

    repo_root = Path(__file__).resolve().parents[1]
    sm.configure(Settings())
    for name in ("config", "tracker", "axiom"):
        spec = sm._SPECS[name]
        assert Path(spec.workdir).is_dir(), f"{name} workdir 不存在：{spec.workdir}"
        assert str(Path(spec.workdir)).startswith(str(repo_root)), f"{name} workdir 应位于仓库根内"
    assert sm.LOG_DIR == repo_root / "logs"
    assert sm.LOG_DIR.is_dir()


def test_services_start_popen_failure_closes_log_handle(monkeypatch):
    """Popen 启动失败（如 workdir 无效 WinError 267）时不得泄漏日志文件句柄（资源守护）。"""
    import builtins
    import subprocess

    from qed_engine.api import service_manager as sm
    from qed_engine.config import Settings

    sm.configure(Settings())
    spec = sm._SPECS["tracker"]
    sm._probe_http = lambda port: False  # noqa: SLF001 - 测试注入

    closed: list = []

    class FakeLogFile:
        def close(self):
            closed.append(True)

    monkeypatch.setattr(builtins, "open", lambda *a, **k: FakeLogFile())

    def boom_popen(*args, **kwargs):
        raise OSError(267, "目录名无效")

    monkeypatch.setattr(subprocess, "Popen", boom_popen)
    with pytest.raises(OSError):
        sm._start(spec)
    assert closed, "Popen 失败后日志句柄应被关闭"


def _patch_probe(monkeypatch, result):
    """注入状态探测：全部单元返回同一结果（config 固定 online 不受影响）。"""
    from qed_engine.api import service_manager as sm

    monkeypatch.setattr(sm, "_probe_http", lambda port: result)


def _patch_popen(monkeypatch, record=None, exit_on_signal=False):
    """注入 Popen/taskkill：
    - start 时记录 cmd 到 record，返回 FakeProcess（pid 自增）
    - exit_on_signal: os.kill(CTRL_BREAK) 后 poll 返回 0（模拟优雅退出）；否则一直存活
    """
    import subprocess

    from qed_engine.api import service_manager as sm

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


def test_services_snapshot_three_units_offline(monkeypatch):
    """三单元快照：字段齐全；8900 自身永远 online；探测失败 → offline + reason。"""
    _patch_probe(monkeypatch, False)
    client = _client(monkeypatch)
    response = client.get("/api/v1/services")
    assert response.status_code == 200
    services = response.json()["services"]
    assert [s["name"] for s in services] == ["config", "tracker", "axiom"]
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


def test_services_snapshot_online_when_probe_ok(monkeypatch):
    """探测通过 → online（按端口区分单元）。"""
    from qed_engine.api import service_manager as sm

    monkeypatch.setattr(sm, "_probe_http", lambda port: port == 8901)
    client = _client(monkeypatch)
    services = client.get("/api/v1/services").json()["services"]
    by_name = {s["name"]: s for s in services}
    assert by_name["tracker"]["status"] == "online"
    assert by_name["axiom"]["status"] == "offline"


def test_services_start_tracker_returns_starting(monkeypatch):
    """start：后台 Popen + 返回 starting + pid；命令指向子项目模块。"""
    _patch_probe(monkeypatch, False)
    record = []
    created, _ = _patch_popen(monkeypatch, record=record)
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/tracker/start")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "tracker"
    assert body["status"] == "starting"
    assert body["pid"] == created[0].pid
    assert record[0][0] == "python"
    assert "qed_tracker.cli" in " ".join(record[0])


def test_services_start_axiom_launches_two_processes(monkeypatch):
    """axiom 双进程单元：一次启动拉起 API + Worker。"""
    _patch_probe(monkeypatch, False)
    record = []
    created, _ = _patch_popen(monkeypatch, record=record)
    client = _client(monkeypatch)
    response = client.post("/api/v1/services/axiom/start")
    assert response.status_code == 200
    assert len(created) == 2
    assert any("axiom_flow.main" in " ".join(cmd) for cmd in record)
    assert any("axiom_flow.worker" in " ".join(cmd) for cmd in record)


def test_services_start_twice_within_window_conflicts(monkeypatch):
    """15s 窗口内重复启动 → 409（starting 过渡态）。"""
    _patch_probe(monkeypatch, False)
    _patch_popen(monkeypatch)
    client = _client(monkeypatch)
    assert client.post("/api/v1/services/tracker/start").status_code == 200
    response = client.post("/api/v1/services/tracker/start")
    assert response.status_code == 409


def test_services_start_already_online_conflicts(monkeypatch):
    """探测已 online（外部/遗留进程）→ start 409。"""
    _patch_probe(monkeypatch, True)
    _patch_popen(monkeypatch)
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


def test_services_stop_sends_graceful_signal(monkeypatch):
    """stop：向进程组发 CTRL_BREAK 优雅停止 → stopping。"""
    _patch_probe(monkeypatch, False)
    created, kill_calls = _patch_popen(monkeypatch, exit_on_signal=True)
    client = _client(monkeypatch)
    client.post("/api/v1/services/tracker/start")
    response = client.post("/api/v1/services/tracker/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "stopping"
    assert kill_calls == [created[0].pid]


def test_services_stop_force_kills_on_timeout(monkeypatch):
    """优雅停止超时（5s 内未退出）→ taskkill 强杀兜底 + 执行期 reason 记录。"""
    import subprocess

    _patch_probe(monkeypatch, False)
    created, _ = _patch_popen(monkeypatch, exit_on_signal=False)
    from qed_engine.api import service_manager as sm

    monkeypatch.setattr(sm.time, "sleep", lambda seconds: None)
    taskkill_calls: list = []
    original_run = subprocess.run
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda cmd, **kwargs: taskkill_calls.append(cmd) if "taskkill" in cmd else original_run(cmd, **kwargs),
    )
    client = _client(monkeypatch)
    client.post("/api/v1/services/tracker/start")
    response = client.post("/api/v1/services/tracker/stop")
    assert response.status_code == 200
    assert any("taskkill" in cmd[0] for cmd in taskkill_calls)


def test_services_transition_window_expires_to_probe_result(monkeypatch):
    """启动后 15s 窗口内显示 starting；窗口过后回落为探测结果。"""
    from qed_engine.api import service_manager as sm

    _patch_probe(monkeypatch, False)
    _patch_popen(monkeypatch)
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
    """restart：先停后启（复用 stop → start 语义）。"""
    _patch_probe(monkeypatch, False)
    created, kill_calls = _patch_popen(monkeypatch, exit_on_signal=True)
    client = _client(monkeypatch)
    client.post("/api/v1/services/tracker/start")
    response = client.post("/api/v1/services/tracker/restart")
    assert response.status_code == 200
    assert response.json()["status"] == "starting"
    assert kill_calls == [created[0].pid]  # 优雅停止信号已发送