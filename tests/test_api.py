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
    """
    from qed_engine.api import control as api_control

    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))


def _client(monkeypatch, *, qwen="", deepseek="", glm="", db_password="", tracker=None, axiom=None):
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


def test_startup_llm_check_probes_only_configured(monkeypatch):
    """启动自检：已配置 key 的供应商才探测（qwen/glm），未配置（deepseek）跳过。"""
    from qed_engine.api import control as api_control

    calls: list = []
    monkeypatch.setattr(
        api_control,
        "_probe_llm",
        lambda provider, key, url: calls.append((provider, url)) or (True, ""),
    )
    client = _client(monkeypatch, qwen="sk-qwen", glm="sk-glm")
    assert client.get("/api/v1/health").status_code == 200
    assert [c[0] for c in calls] == ["qwen", "glm"]


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


# ---------- 语义 API（数据域：catalogs / tasks / selections，8900 自有契约） ----------


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
    response = client.post("/api/v1/selections/cand_abc/confirm", json={})
    assert response.status_code == 409
    assert response.json()["detail"] == "状态机冲突：当前状态 downloading 不允许"


# ---------- 三表语义 API（selections / downloads / sources，downloads-three-table-model §3.2） ----------


def test_selections_list_via_semantic_api(monkeypatch):
    """GET /api/v1/selections：查询参数透传 8901（默认过滤由上游数据层保证）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/selections"
        assert dict(request.url.params) == {"course_id": "01_math_analysis", "status": "confirmed"}
        return httpx.Response(200, json=[{"selection_id": "cand_abc", "status": "confirmed"}])

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get(
        "/api/v1/selections",
        params={"course_id": "01_math_analysis", "status": "confirmed"},
    )
    assert response.status_code == 200
    assert response.json() == [{"selection_id": "cand_abc", "status": "confirmed"}]


def test_selection_detail_via_semantic_api(monkeypatch):
    """GET /api/v1/selections/{id}：套书详情（含册明细）经 8900。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/selections/cand_abc"
        return httpx.Response(200, json={"selection_id": "cand_abc", "title": "微积分学教程"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/selections/cand_abc")
    assert response.status_code == 200
    assert response.json()["title"] == "微积分学教程"


def test_selection_state_actions_via_semantic_api(monkeypatch):
    """POST /selections/{id}/confirm|backup|supersede：表1 生命周期动作经 8900。"""
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        return httpx.Response(200, json={"selection_id": "cand_abc", "status": "changed"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    for action in ("confirm", "backup", "supersede"):
        body = {"reason": "过时"} if action == "supersede" else {"note": "备注"}
        response = client.post(f"/api/v1/selections/cand_abc/{action}", json=body)
        assert response.status_code == 200, action
    assert seen == [
        "/api/v1/selections/cand_abc/confirm",
        "/api/v1/selections/cand_abc/backup",
        "/api/v1/selections/cand_abc/supersede",
    ]


def test_selection_reject_forwards_reason_and_note(monkeypatch):
    """POST /selections/{id}/reject：reason 必填 + note 转发 8901。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/selections/cand_abc/reject"
        assert json.loads(request.read()) == {"reason": "版本过旧", "note": "换新版"}
        return httpx.Response(200, json={"selection_id": "cand_abc", "status": "rejected"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/selections/cand_abc/reject", json={"reason": "版本过旧", "note": "换新版"})
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


def test_selection_reject_without_reason_is_422(monkeypatch):
    """表1 reject 缺 reason：8900 直接 422，不发 8901。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("不应请求 8901")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/selections/cand_abc/reject", json={})
    assert response.status_code == 422


def test_selection_downloads_list_via_semantic_api(monkeypatch):
    """GET /resources/{id}/downloads：表2 册明细（按 selection_id）经 8900。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/resources/cand_abc/downloads"
        return httpx.Response(200, json=[{"download_id": "download_1", "status": "downloaded"}])

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/resources/cand_abc/downloads")
    assert response.status_code == 200
    assert response.json() == [{"download_id": "download_1", "status": "downloaded"}]


def test_download_create_candidate_via_semantic_api(monkeypatch):
    """POST /api/v1/downloads：新建表2 候选册（vol/file_hint 可选）经 8900。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/downloads"
        assert json.loads(request.read()) == {"selection_id": "cand_abc", "vol": "v2", "file_hint": "第二卷"}
        return httpx.Response(200, json=[{"download_id": "download_1", "status": "candidate"}])

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/downloads", json={"selection_id": "cand_abc", "vol": "v2", "file_hint": "第二卷"})
    assert response.status_code == 200
    assert response.json()[0]["status"] == "candidate"


def test_download_create_candidate_requires_selection(monkeypatch):
    """POST /api/v1/downloads 缺 selection_id：8900 直接 422。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("不应请求 8901")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/downloads", json={})
    assert response.status_code == 422


def test_download_actions_via_semantic_api(monkeypatch):
    """POST /downloads/{id}/approve|reject|register：表2 册级动作经 8900。"""
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.url.path, json.loads(request.content.decode("utf-8") or b"{}")))
        return httpx.Response(200, json={"download_id": "download_1", "status": "changed"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    assert client.post("/api/v1/downloads/download_1/approve").status_code == 200
    assert client.post("/api/v1/downloads/download_1/reject", json={"reason": "扫描缺页"}).status_code == 200
    response = client.post(
        "/api/v1/downloads/download_1/register",
        json={"relative_path": "raw/books/math-qe/01/v2.pdf"},
    )
    assert response.status_code == 200
    assert seen == [
        ("/api/v1/downloads/download_1/approve", {}),
        ("/api/v1/downloads/download_1/reject", {"reason": "扫描缺页"}),
        ("/api/v1/downloads/download_1/register", {"relative_path": "raw/books/math-qe/01/v2.pdf"}),
    ]


def test_download_reject_without_reason_is_422(monkeypatch):
    """表2 reject 缺 reason：8900 直接 422。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("不应请求 8901")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.post("/api/v1/downloads/download_1/reject", json={})
    assert response.status_code == 422


def test_download_sources_via_semantic_api(monkeypatch):
    """GET /downloads/{id}/sources：表3 来源记录经 8900（详情弹窗）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/downloads/download_1/sources"
        return httpx.Response(200, json=[{"source_id": "src_1", "channel": "libgen_li", "ok": 1}])

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    response = client.get("/api/v1/downloads/download_1/sources")
    assert response.status_code == 200
    assert response.json()[0]["channel"] == "libgen_li"


def test_three_table_offline_returns_503(monkeypatch):
    """8901 离线：三表端点同样 503 + 明确提示（前端降级显示依据）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    for path in (
        "/api/v1/selections",
        "/api/v1/selections/cand_abc",
        "/api/v1/resources/cand_abc/downloads",
        "/api/v1/downloads/download_1/sources",
    ):
        response = client.get(path)
        assert response.status_code == 503, path
        assert "QED-Tracker" in response.json()["detail"]


# ---------- 服务域（控制中心 /services：service-control.md 契约） ----------


def test_services_spec_workdirs_and_log_dir_point_to_repo_root():
    """注册表几何守护：ROOT 必须解析到仓库根（P1 目录迁移 src/ → backend/ 后 parents 层级
    曾错位导致 workdir 指向 backend/QED-Tracker，真实启动 WinError 267）。"""
    from pathlib import Path

    from qed_engine.config import Settings
    from qed_engine.services import service_manager as sm

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

    from qed_engine.config import Settings
    from qed_engine.services import service_manager as sm

    sm.configure(Settings())
    spec = sm._SPECS["tracker"]
    monkeypatch.setattr(sm, "_probe_http", lambda port: False)  # noqa: SLF001 - 测试注入

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
    from qed_engine.services import service_manager as sm

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
    from qed_engine.services import service_manager as sm

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
    from qed_engine.services import service_manager as sm

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

# ---------- 数据域·Axiom（8902 适配，契约草案 Axiom-Flow 8902-integration-contract.md） ----------


def _axiom_client(handler) -> AxiomClient:
    return AxiomClient(base_url="http://axiom.test", transport=httpx.MockTransport(handler))


def test_axiom_books_via_gateway(monkeypatch):
    """GET /api/v1/books：书目列表（含解析进度）经 8900 透传 8902。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books"
        return httpx.Response(200, json=[{"book_id": "01-rudin", "title": "Rudin", "pages_total": 20, "pages_done": 20}])

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books")
    assert response.status_code == 200
    assert response.json()[0]["book_id"] == "01-rudin"


def test_axiom_book_page_via_gateway(monkeypatch):
    """GET /api/v1/books/{id}/pages/{no}：单页数据（原页图 URL + markdown + blocks）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/01-rudin/pages/3"
        return httpx.Response(200, json={"page_no": 3, "image_url": "/static/01-rudin/p0003.png", "markdown": "## 标题\n$$x^2$$", "blocks": []})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    response = client.get("/api/v1/books/01-rudin/pages/3")
    assert response.status_code == 200
    assert response.json()["markdown"].startswith("## 标题")


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


def test_axiom_parse_job_create_and_query(monkeypatch):
    """POST /parse-jobs（202）+ GET /parse-jobs/{id}：任务提交与状态查询。"""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v1/parse-jobs" and request.method == "POST":
            body = json.loads(request.content)
            assert body["book_id"] == "01-rudin"
            assert body["strategy"] == "qwen-vl-plus"
            return httpx.Response(202, json={"job_id": "j-1", "status": "queued", "progress": 0})
        if request.url.path == "/api/v1/parse-jobs/j-1":
            return httpx.Response(200, json={"job_id": "j-1", "status": "running", "progress": 5})
        return httpx.Response(404, json={"detail": f"unexpected {request.url.path}"})

    client = _client(monkeypatch, axiom=_axiom_client(handler))
    created = client.post("/api/v1/parse-jobs", json={"book_id": "01-rudin", "pages": [1, 2], "strategy": "qwen-vl-plus"})
    assert created.status_code == 202
    assert created.json()["status"] == "queued"
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
