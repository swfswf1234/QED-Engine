"""领域探索五态门面端点契约测试（PLAN-034，2026-09-08）：
- POST /api/v1/domains/{id}/explore-knowledge（202 提交原生任务 + 404/409/502）
- POST /api/v1/domains/{id}/confirm-domain（原生透传 / 名称确认重提 / 离线降级 / 409）
- POST /api/v1/domains/{id}/confirm-knowledge（courses.json 桥接 / import_courses 分支 / 409）
- GET /api/v1/domains/{id}/explore-status（pending 合成 + 任务登记）

设计关联（DesignRef）：docs/design/downloads-flow.md
实现状态：Current
被测代码：backend/qed_engine/api/domain_explore.py

8901 经 MockTransport 模拟；共享表直写在测试中因 QED_DB_PASSWORD 为空自动跳过
（降级分支需 DB 的路径以 monkeypatch 注入假实现验证分支逻辑）。
"""

import json

import httpx
from fastapi.testclient import TestClient

from tests.test_api import _client, _tracker_client


def _de_client(monkeypatch, *, tracker=None, data_root=None) -> TestClient:
    if data_root is not None:
        monkeypatch.setenv("QED_DATA_ROOT", str(data_root))
    return _client(monkeypatch, tracker=tracker)


def _connect_error(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError(f"refused: {request.url.path}")


def _write_courses_file(tmp_path, domain_id: str, courses: list[dict]) -> None:
    target = tmp_path / "raw" / domain_id
    target.mkdir(parents=True, exist_ok=True)
    (target / "courses.json").write_text(json.dumps({"courses": courses}), encoding="utf-8")


# --- explore-knowledge：提交领域探索任务 ---


def test_explore_knowledge_submits_task_and_registers(monkeypatch):
    """未开始领域：POST 202 + task_id；登记表记录 domain_id→task_id；阶段置探索中。"""
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["path"] = request.url.path
        if request.method == "GET" and request.url.path == "/api/v1/domains":
            return httpx.Response(200, json=[
                {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "未开始"},
            ])
        if request.method == "POST" and request.url.path == "/api/v1/tasks/domain_explore":
            seen["task_body"] = json.loads(request.content.decode("utf-8"))
            return httpx.Response(202, json={"task_id": "task_1", "status": "queued"})
        return httpx.Response(404, json={"detail": "unexpected"})

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_phy/explore-knowledge", json={"mode": "direct"})
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["task_id"] == "task_1"
    assert body["exploration_stage"] == "探索中"
    assert seen["task_body"] == {"domain_id": "d_phy", "mode": "direct"}
    assert client.app.state.domain_explore_tasks["d_phy"] == "task_1"


def test_explore_knowledge_unknown_domain_404(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_none/explore-knowledge", json={"mode": "direct"})
    assert resp.status_code == 404


def test_explore_knowledge_conflict_when_running(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[
            {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "探索中"},
        ])

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_phy/explore-knowledge", json={"mode": "direct"})
    assert resp.status_code == 409


def test_explore_knowledge_offline_surfaces_502(monkeypatch):
    """8901 离线且共享表无行（返回行以过 404 关）：任务提交连接失败 → 502 透出。"""
    from qed_engine.services import shared_tables

    monkeypatch.setattr(
        shared_tables, "get_domain",
        lambda settings, domain_id: {"domain_id": domain_id, "name": "物理学", "exploration_stage": "未开始"},
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return _connect_error(request)

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_phy/explore-knowledge", json={"mode": "direct"})
    assert resp.status_code == 502


# --- confirm-domain：确认领域 ---


def test_confirm_domain_native_passthrough(monkeypatch):
    """已生成领域：透传 8901 confirm，返回 task_id 并登记。"""
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/api/v1/domains":
            return httpx.Response(200, json=[
                {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "已生成"},
            ])
        if request.method == "POST" and request.url.path == "/api/v1/domains/d_phy/confirm":
            seen["confirmed"] = True
            return httpx.Response(200, json={"task_id": "task_2", "exploration_stage": "探索中"})
        return httpx.Response(404, json={"detail": "unexpected"})

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_phy/confirm-domain", json={})
    assert resp.status_code == 202, resp.text
    assert resp.json()["task_id"] == "task_2"
    assert seen["confirmed"]
    assert client.app.state.domain_explore_tasks["d_phy"] == "task_2"


def test_confirm_domain_wrong_stage_409(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[
            {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "未开始"},
        ])

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_phy/confirm-domain", json={})
    assert resp.status_code == 409


def test_confirm_domain_name_confirmation_resubmits(monkeypatch):
    """name_confirmation 挂起：改名 PATCH + 重提 domain_explore 任务。"""
    seen: dict = {"patches": []}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/api/v1/domains":
            return httpx.Response(200, json=[{
                "domain_id": "d_phy", "name": "物理", "exploration_stage": "待确认",
                "explore_pending": {"kind": "name_confirmation",
                                    "name_check": {"valid": False, "suggested_name": "物理学"}},
            }])
        if request.method == "PATCH" and request.url.path == "/api/v1/domains/d_phy":
            seen["patches"].append(json.loads(request.content.decode("utf-8")))
            return httpx.Response(200, json={"domain_id": "d_phy", "name": "物理学"})
        if request.method == "POST" and request.url.path == "/api/v1/tasks/domain_explore":
            seen["resubmitted"] = True
            return httpx.Response(202, json={"task_id": "task_3", "status": "queued"})
        return httpx.Response(404, json={"detail": "unexpected"})

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_phy/confirm-domain", json={"name": "物理学"})
    assert resp.status_code == 202, resp.text
    assert resp.json()["task_id"] == "task_3"
    # 改名 PATCH（后续另有探索中阶段的 stage PATCH）
    assert {"name": "物理学"} in seen["patches"]
    assert seen["resubmitted"]


def test_confirm_domain_offline_degrades_to_running(monkeypatch):
    """8901 离线（confirm 连接失败）：状态直写探索中 + degraded 标记（离线导入路径）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/api/v1/domains":
            return httpx.Response(200, json=[
                {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "已生成"},
            ])
        return _connect_error(request)

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_phy/confirm-domain", json={})
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["exploration_stage"] == "探索中"
    assert body["degraded"] is True
    assert body["task_id"] is None


# --- confirm-knowledge：确认课程 ---


def test_confirm_knowledge_bridges_courses_file(monkeypatch, tmp_path):
    """原生待确认（无 pending）：从 courses.json 合成清单；勾选 c1 只建/更 c1 行，再 apply。"""
    _write_courses_file(tmp_path, "d_phy", [
        {"course_id": "c1", "name": "力学", "summary": "经典力学", "tier": 1},
        {"course_id": "c2", "name": "热学", "summary": "热力学", "tier": 2},
    ])
    seen: dict = {"created": [], "applied": None}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/api/v1/domains":
            return httpx.Response(200, json=[
                {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "待确认"},
            ])
        if request.method == "GET" and request.url.path == "/api/v1/courses":
            return httpx.Response(200, json=[])
        if request.method == "POST" and request.url.path == "/api/v1/domains/d_phy/courses":
            seen["created"].append(json.loads(request.content.decode("utf-8"))["name"])
            return httpx.Response(200, json={"course_id": "c1", "name": "力学"})
        if request.method == "POST" and request.url.path == "/api/v1/domains/d_phy/apply-results":
            seen["applied"] = json.loads(request.content.decode("utf-8"))
            return httpx.Response(200, json={"ok": True, "exploration_stage": "已完成"})
        return httpx.Response(404, json={"detail": "unexpected"})

    client = _de_client(monkeypatch, tracker=_tracker_client(handler), data_root=tmp_path)
    resp = client.post("/api/v1/domains/d_phy/confirm-knowledge", json={"selected": ["c1"]})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["exploration_stage"] == "已完成"
    assert body["applied"] == 1
    assert seen["created"] == ["力学"]
    assert seen["applied"] == {"selected_courses": ["c1"]}


def test_confirm_knowledge_full_selection_by_default(monkeypatch, tmp_path):
    """selected 缺省 = 全部保留（manual 六步流程步骤 4 语义）。"""
    _write_courses_file(tmp_path, "d_phy", [
        {"course_id": "c1", "name": "力学"},
        {"course_id": "c2", "name": "热学"},
    ])
    seen: dict = {"created": [], "applied": None}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/api/v1/domains":
            return httpx.Response(200, json=[
                {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "待确认"},
            ])
        if request.method == "GET" and request.url.path == "/api/v1/courses":
            return httpx.Response(200, json=[])
        if request.method == "POST" and request.url.path == "/api/v1/domains/d_phy/courses":
            seen["created"].append(json.loads(request.content.decode("utf-8"))["name"])
            return httpx.Response(200, json={"course_id": "x", "name": "n"})
        if request.method == "POST" and request.url.path == "/api/v1/domains/d_phy/apply-results":
            seen["applied"] = json.loads(request.content.decode("utf-8"))
            return httpx.Response(200, json={"ok": True})
        return httpx.Response(404, json={"detail": "unexpected"})

    client = _de_client(monkeypatch, tracker=_tracker_client(handler), data_root=tmp_path)
    resp = client.post("/api/v1/domains/d_phy/confirm-knowledge", json={})
    assert resp.status_code == 200, resp.text
    assert sorted(seen["created"]) == ["力学", "热学"]
    assert sorted(seen["applied"]["selected_courses"]) == ["c1", "c2"]


def test_confirm_knowledge_import_courses_branch(monkeypatch):
    """explore_pending.kind=import_courses（离线导入挂起）→ 共享表收口分支。"""
    from qed_engine.services import shared_tables

    calls: list[str] = []

    def fake_commit(settings, domain_id):
        calls.append(domain_id)
        return {"committed": 3}

    monkeypatch.setattr(shared_tables, "commit_import_courses", fake_commit)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{
            "domain_id": "d_cs", "name": "计算机科学", "exploration_stage": "待确认",
            "explore_pending": {"kind": "import_courses", "courses": [{"name": "操作系统"}]},
        }])

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_cs/confirm-knowledge", json={})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["exploration_stage"] == "已完成"
    assert body["applied"] == 3
    assert calls == ["d_cs"]


def test_confirm_knowledge_wrong_stage_409(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[
            {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "探索中"},
        ])

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/domains/d_phy/confirm-knowledge", json={})
    assert resp.status_code == 409


def test_confirm_knowledge_missing_courses_file_409(monkeypatch, tmp_path):
    """待确认但 pending 与 courses.json 均不可用 → 409（不静默成功）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[
            {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "待确认"},
        ])

    client = _de_client(monkeypatch, tracker=_tracker_client(handler), data_root=tmp_path)
    resp = client.post("/api/v1/domains/d_phy/confirm-knowledge", json={})
    assert resp.status_code == 409
    assert "courses.json" in resp.json()["detail"]


def test_confirm_knowledge_offline_degraded_apply(monkeypatch):
    """8901 离线：课程行降级直写（共享表假实现）+ apply 降级直写 → 已完成。

    客户端须挂 Settings 才会启用降级分支（生产由 main.py 注入，测试显式构造）。
    """
    from qed_engine.clients.tracker_client import TrackerClient
    from qed_engine.config import Settings
    from qed_engine.services import shared_tables

    monkeypatch.setenv("QED_DB_PASSWORD", "")
    monkeypatch.setattr(
        shared_tables, "list_domains",
        lambda settings: [{
            "domain_id": "d_phy", "name": "物理学", "exploration_stage": "待确认",
            "explore_pending": {"kind": "review_results",
                                "courses": [{"course_id": "c1", "name": "力学"}]},
        }],
    )
    monkeypatch.setattr(
        shared_tables, "get_domain",
        lambda settings, domain_id: {
            "domain_id": domain_id, "name": "物理学", "exploration_stage": "待确认",
            "explore_pending": {"kind": "review_results",
                                "courses": [{"course_id": "c1", "name": "力学"}]},
        },
    )
    monkeypatch.setattr(
        shared_tables, "create_course",
        lambda settings, domain_id, name, **kw: {"course_id": "c1", "name": name},
    )
    monkeypatch.setattr(
        shared_tables, "update_domain",
        lambda settings, domain_id, **kw: {"domain_id": domain_id, "exploration_stage": "已完成"},
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return _connect_error(request)

    tracker = TrackerClient(
        base_url="http://tracker.test",
        transport=httpx.MockTransport(handler),
        settings=Settings(),
    )
    client = _de_client(monkeypatch, tracker=tracker)
    resp = client.post("/api/v1/domains/d_phy/confirm-knowledge", json={})
    assert resp.status_code == 200, resp.text
    assert resp.json()["exploration_stage"] == "已完成"


# --- explore-status：状态轮询 ---


def test_explore_status_synthesizes_pending_from_file(monkeypatch, tmp_path):
    """原生任务链成功时不写 pending：待确认阶段从 courses.json 合成 review_results。"""
    _write_courses_file(tmp_path, "d_phy", [{"course_id": "c1", "name": "力学"}])

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[
            {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "待确认"},
        ])

    client = _de_client(monkeypatch, tracker=_tracker_client(handler), data_root=tmp_path)
    client.app.state.domain_explore_tasks["d_phy"] = "task_9"
    resp = client.get("/api/v1/domains/d_phy/explore-status")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["exploration_stage"] == "待确认"
    assert body["active_session"] is False
    assert body["task_id"] == "task_9"
    assert body["explore_pending"] == {
        "kind": "review_results", "courses": [{"course_id": "c1", "name": "力学"}],
    }


def test_explore_status_running_active(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[
            {"domain_id": "d_phy", "name": "物理学", "exploration_stage": "探索中",
             "explore_pending": None},
        ])

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.get("/api/v1/domains/d_phy/explore-status")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["active_session"] is True
    assert body["explore_pending"] is None
    assert body["available"] is True


def test_explore_status_unknown_domain_degrades(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    client = _de_client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.get("/api/v1/domains/d_none/explore-status")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["exploration_stage"] == "未开始"
    assert body["available"] is False
