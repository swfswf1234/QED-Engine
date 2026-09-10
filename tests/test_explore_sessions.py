"""探索会话端点契约测试（PLAN-022 B3，2026-08-28）：
- POST /api/v1/explore-sessions（202 + session_id，后台线程执行 8901 dry-run）
- GET /api/v1/explore-sessions/{id}（轮询 running/waiting_name_confirm/ready/failed）
- POST /api/v1/explore-sessions/{id}/confirm-name（名称确认重跑）
- POST /api/v1/explore-sessions/{id}/apply（领域=管理端点逐项 / 课程=knowledge 采纳）
- DELETE /api/v1/explore-sessions/{id}（放弃 + exploration_stage 回退）

设计关联（DesignRef）：docs/plans/2026-08-27-exploration-download-flow.md
实现状态：Current
被测代码：backend/qed_engine/api/explore.py、backend/qed_engine/services/explore_sessions.py

8901 经 MockTransport 模拟；exploration_stage 直写在测试中因 QED_DB_PASSWORD 为空自动跳过。
"""

import time

import httpx
from fastapi.testclient import TestClient

from tests.test_api import _client, _tracker_client


def _wait_status(client: TestClient, sid: str, statuses: set[str], timeout: float = 8.0) -> dict:
    """轮询直到会话进入目标状态集合（后台线程异步执行）。"""
    deadline = time.monotonic() + timeout
    last: dict = {}
    while time.monotonic() < deadline:
        resp = client.get(f"/api/v1/explore-sessions/{sid}")
        assert resp.status_code == 200, resp.text
        last = resp.json()
        if last["status"] in statuses:
            return last
        time.sleep(0.02)
    raise AssertionError(f"会话 {sid} 未在 {timeout}s 内进入 {statuses}，最后状态：{last['status']}")


# --- 领域探索会话 ---


def test_domain_session_lifecycle_ready(monkeypatch):
    """领域会话：POST 202 → 后台 dry-run → ready；成功后 PATCH exploration_stage=已生成。"""
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["path"] = request.url.path
        if request.method == "POST" and request.url.path == "/api/v1/prompt-explores/dry-run":
            body = request.read()
            assert body, "领域 dry-run 必须携带 domain_name"
            return httpx.Response(200, json={
                "dry_run": True, "confirmation_required": False,
                "report": {
                    "domain": {"final_name": "计算机科学", "description": "d", "level": "bachelor",
                               "classic_tracks": [], "entry_requirements": []},
                    "courses": [{"slug": "ds", "name": "数据结构", "aliases": [], "track": "t",
                                 "summary": "s", "tier": 1, "prerequisites": []}],
                    "path": {"notes": "", "edges": [], "graph_td": ""},
                },
                "calls": [{"step": "domain", "template_id": "domain-explore/domain@v2", "duration_ms": 1}],
            })
        if request.method == "PATCH" and request.url.path == "/api/v1/domains/d_cs":
            import json as _json
            seen["patch_body"] = _json.loads(request.content.decode("utf-8"))
            return httpx.Response(200, json={"domain_id": "d_cs", "exploration_stage": "已生成"})
        return httpx.Response(404, json={"detail": "unexpected"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/explore-sessions", json={
        "target": "domain", "domain_name": "计算机科学", "domain_id": "d_cs", "mode": "direct",
    })
    assert resp.status_code == 202, resp.text
    sid = resp.json()["session_id"]
    assert sid

    session = _wait_status(client, sid, {"ready"})
    assert session["target"] == "domain"
    assert session["report"]["domain"]["final_name"] == "计算机科学"
    assert len(session["report"]["courses"]) == 1
    assert session["steps"]  # 进度步记录透出
    # 在线路径：域存在 → PATCH exploration_stage=已生成
    assert seen.get("patch_body") == {"exploration_stage": "已生成"}


def test_domain_session_name_confirmation(monkeypatch):
    """领域会话：dry-run 返回 confirmation_required → waiting_name_confirm；confirm-name 重跑 → ready。"""
    calls: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json
        body = _json.loads(request.content.decode("utf-8")) if request.method == "POST" else {}
        calls.append(body)
        if calls and "confirm_name_override" in body:
            return httpx.Response(200, json={
                "dry_run": True, "confirmation_required": False,
                "report": {"domain": {"final_name": "人工智能", "description": "", "level": "",
                                      "classic_tracks": [], "entry_requirements": []},
                           "courses": [], "path": {"notes": "", "edges": [], "graph_td": ""}},
                "calls": [],
            })
        return httpx.Response(200, json={
            "dry_run": True, "confirmation_required": True,
            "name_check": {"valid": False, "reason": "名称过于宽泛", "suggested_name": "人工智能"},
        })

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/explore-sessions", json={
        "target": "domain", "domain_name": "AI", "mode": "direct",
    })
    sid = resp.json()["session_id"]
    session = _wait_status(client, sid, {"waiting_name_confirm"})
    assert session["name_check"]["suggested_name"] == "人工智能"

    resp = client.post(f"/api/v1/explore-sessions/{sid}/confirm-name", json={"name_override": "人工智能"})
    assert resp.status_code == 200
    session = _wait_status(client, sid, {"ready"})
    assert session["report"]["domain"]["final_name"] == "人工智能"
    assert any("confirm_name_override" in c for c in calls)


def test_domain_session_apply_new_domain(monkeypatch):
    """领域 apply（新领域）：POST /domains → 逐课 POST /domains/{id}/courses → PATCH stage=已完成。"""
    report = {
        "domain": {"final_name": "计算机科学", "description": "d", "level": "",
                   "classic_tracks": [], "entry_requirements": []},
        "courses": [
            {"slug": "ds", "name": "数据结构", "aliases": ["DS"], "track": "t",
             "summary": "s1", "tier": 1, "prerequisites": []},
            {"slug": "os", "name": "操作系统", "aliases": [], "track": "t",
             "summary": "s2", "tier": 2, "prerequisites": ["ds"]},
        ],
        "path": {"notes": "", "edges": [], "graph_td": ""},
    }
    seen: list[tuple[str, str, dict]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json
        body = _json.loads(request.content.decode("utf-8")) if request.method in ("POST", "PATCH") else {}
        seen.append((request.method, request.url.path, body))
        if request.method == "POST" and request.url.path == "/api/v1/prompt-explores/dry-run":
            return httpx.Response(200, json={
                "dry_run": True, "confirmation_required": False, "report": report, "calls": [],
            })
        if request.method == "POST" and request.url.path == "/api/v1/domains":
            return httpx.Response(201, json={"domain_id": "d_cs", "name": "计算机科学"})
        if request.method == "POST" and request.url.path == "/api/v1/domains/d_cs/courses":
            return httpx.Response(201, json={"course_id": f"c_{body['name']}", "name": body["name"]})
        if request.method == "PATCH" and request.url.path == "/api/v1/domains/d_cs":
            return httpx.Response(200, json={"domain_id": "d_cs"})
        return httpx.Response(404, json={"detail": "unexpected"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/explore-sessions", json={
        "target": "domain", "domain_name": "计算机科学", "mode": "direct",
    })
    sid = resp.json()["session_id"]
    _wait_status(client, sid, {"ready"})

    resp = client.post(f"/api/v1/explore-sessions/{sid}/apply", json={
        "selected": report["courses"],
    })
    assert resp.status_code == 200, resp.text
    result = resp.json()
    assert len(result["applied"]) == 3  # 1 领域 + 2 课程
    assert result["conflicts"] == []

    # 领域创建体
    domain_calls = [b for m, p, b in seen if m == "POST" and p == "/api/v1/domains"]
    assert domain_calls[0]["name"] == "计算机科学"
    # 课程创建体：tier→sort_order、summary→description 透传
    course_calls = [b for m, p, b in seen if m == "POST" and p == "/api/v1/domains/d_cs/courses"]
    assert course_calls[0] == {"name": "数据结构", "stage": "", "sort_order": 1,
                               "description": "s1", "aliases": ["DS"], "track": "t", "prerequisites": []}
    # 完成态写回（PLAN-034 §3 写点矩阵：会话 apply 落「待确认」，终态由 confirm-knowledge 收口）
    assert any(m == "PATCH" and b == {"exploration_stage": "待确认"} for m, p, b in seen)


def test_domain_session_failed(monkeypatch):
    """领域会话：8901 5xx → 会话 failed + 错误信息。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(502, json={"detail": {"code": "PIPELINE_ERROR", "message": "boom"}})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/explore-sessions", json={
        "target": "domain", "domain_name": "X", "mode": "direct",
    })
    sid = resp.json()["session_id"]
    session = _wait_status(client, sid, {"failed"})
    assert "boom" in session["error"] or "boom" in str(session["error"]) or session["error"]


# --- 课程探索会话 ---


def test_course_session_lifecycle_and_apply(monkeypatch):
    """课程会话：dry-run tutorials → ready → apply 采纳 POST /courses/{id}/knowledge。"""
    seen: dict = {}
    tutorials = [
        {"proposal_id": "pp_1", "set_no": "1", "set_name": "套一",
         "textbook": {"title": "数据结构（C语言版）", "authors": ["严蔚敏"], "version": {}, "intro": "i"},
         "exercise": None, "reason": "r"},
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json
        seen["method"] = request.method
        seen["path"] = request.url.path
        if request.method == "POST" and "prompt-explores/dry-run" in request.url.path:
            return httpx.Response(200, json={
                "dry_run": True, "report": {"course": {"course_id": "c_ds"}, "tutorials": tutorials},
                "calls": [{"step": "tutorials", "template_id": "course-explore/tutorials@v1", "duration_ms": 2}],
            })
        if request.method == "POST" and request.url.path == "/api/v1/courses/c_ds/knowledge":
            seen["knowledge_body"] = _json.loads(request.content.decode("utf-8"))
            return httpx.Response(201, json={"created": [{"knowledge_id": "kn_1", "set_name": "套一"}]})
        return httpx.Response(404, json={"detail": "unexpected"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/explore-sessions", json={
        "target": "course", "course_id": "c_ds", "mode": "direct",
    })
    assert resp.status_code == 202
    sid = resp.json()["session_id"]
    session = _wait_status(client, sid, {"ready"})
    assert session["report"]["tutorials"][0]["proposal_id"] == "pp_1"

    resp = client.post(f"/api/v1/explore-sessions/{sid}/apply", json={
        "selected": [tutorials[0]],
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["applied"] == [{"knowledge_id": "kn_1", "set_name": "套一"}]
    assert seen["knowledge_body"] == {"tutorials": tutorials}


# --- 放弃与异常 ---


def test_delete_session_rolls_back_stage(monkeypatch):
    """DELETE 会话：已存在的领域回退 exploration_stage=未开始；会话不可再查。"""
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/api/v1/prompt-explores/dry-run":
            return httpx.Response(200, json={
                "dry_run": True, "confirmation_required": False,
                "report": {"domain": {"final_name": "X", "description": "", "level": "",
                                      "classic_tracks": [], "entry_requirements": []},
                           "courses": [], "path": {"notes": "", "edges": [], "graph_td": ""}},
                "calls": [],
            })
        if request.method == "PATCH" and request.url.path.startswith("/api/v1/domains/"):
            import json as _json
            seen["patch_body"] = _json.loads(request.content.decode("utf-8"))
            return httpx.Response(200, json={"domain_id": "d_x"})
        return httpx.Response(404, json={"detail": "unexpected"})

    client = _client(monkeypatch, tracker=_tracker_client(handler))
    resp = client.post("/api/v1/explore-sessions", json={
        "target": "domain", "domain_name": "X", "domain_id": "d_x", "mode": "direct",
    })
    sid = resp.json()["session_id"]
    _wait_status(client, sid, {"ready"})

    resp = client.delete(f"/api/v1/explore-sessions/{sid}")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert client.get(f"/api/v1/explore-sessions/{sid}").status_code == 404
    # 回退写：最后一次 PATCH 为 未开始（第一次为 已生成）
    assert seen["patch_body"] == {"exploration_stage": "未开始"}


def test_unknown_session_404(monkeypatch):
    client = _client(monkeypatch, tracker=_tracker_client(lambda r: httpx.Response(404)))
    assert client.get("/api/v1/explore-sessions/nope").status_code == 404
    assert client.delete("/api/v1/explore-sessions/nope").status_code == 404
    assert client.post(
        "/api/v1/explore-sessions/nope/confirm-name", json={"name_override": "X"}
    ).status_code == 404
    assert client.post("/api/v1/explore-sessions/nope/apply", json={"selected": []}).status_code == 404


def test_invalid_target_422(monkeypatch):
    client = _client(monkeypatch, tracker=_tracker_client(lambda r: httpx.Response(404)))
    resp = client.post("/api/v1/explore-sessions", json={"target": "book", "mode": "direct"})
    assert resp.status_code == 422


def test_domain_requires_name_course_requires_id_422(monkeypatch):
    client = _client(monkeypatch, tracker=_tracker_client(lambda r: httpx.Response(404)))
    assert client.post("/api/v1/explore-sessions", json={"target": "domain", "mode": "direct"}).status_code == 422
    assert client.post("/api/v1/explore-sessions", json={"target": "course", "mode": "direct"}).status_code == 422
