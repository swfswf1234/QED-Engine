"""
模块职责：QED-Tracker 服务客户端（8901）契约测试：方法/路径/请求体、错误响应与任务轮询。
设计关联（DesignRef）：docs/design/cross-project-contracts.md（五层模型，QED-031）
实现状态：Current
被测代码：backend/qed_engine/clients/tracker_client.py
"""

import json
import time

import httpx
import pytest
from qed_engine.clients.tracker_client import TrackerClient, TrackerError


def _client(handler) -> TrackerClient:
    transport = httpx.MockTransport(handler)
    return TrackerClient(base_url="http://tracker.test", transport=transport)


def _json_handler(payload):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    return handler


def test_get_and_list_tasks():
    client = _client(
        lambda request: httpx.Response(
            200,
            json={"task_id": "t-1", "status": "running"} if request.url.path.endswith("/t-1") else [{"task_id": "t-1"}],
        )
    )
    assert client.get_task("t-1")["status"] == "running"
    assert client.list_tasks() == [{"task_id": "t-1"}]


def test_error_response_raises_with_detail():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "非法状态迁移"})

    client = _client(handler)
    with pytest.raises(TrackerError) as exc_info:
        client.verify_book("bk_abc")
    assert "409" in str(exc_info.value)
    assert "非法状态迁移" in str(exc_info.value)


def test_connection_error_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(handler)
    with pytest.raises(TrackerError):
        client.get_task("t-1")


def test_wait_task_polls_until_succeeded(monkeypatch):
    responses = iter(
        [
            {"task_id": "t-1", "status": "queued"},
            {"task_id": "t-1", "status": "running", "progress": 50},
            {"task_id": "t-1", "status": "succeeded", "progress": 100},
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=next(responses))

    client = _client(handler)
    monkeypatch.setattr(time, "sleep", lambda seconds: None)
    task = client.wait_task("t-1", timeout=5.0)
    assert task["status"] == "succeeded"


def test_wait_task_stops_on_failed(monkeypatch):
    responses = iter(
        [
            {"task_id": "t-1", "status": "running"},
            {"task_id": "t-1", "status": "failed", "error": "下载失败"},
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=next(responses))

    client = _client(handler)
    monkeypatch.setattr(time, "sleep", lambda seconds: None)
    task = client.wait_task("t-1", timeout=5.0)
    assert task["status"] == "failed"
    assert task["error"] == "下载失败"


def test_wait_task_timeout(monkeypatch):
    state = {"calls": 0}

    def fake_monotonic() -> float:
        state["calls"] += 1
        return float(state["calls"])

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"task_id": "t-1", "status": "running"})

    client = _client(handler)
    monkeypatch.setattr(time, "sleep", lambda seconds: None)
    monkeypatch.setattr(time, "monotonic", fake_monotonic)
    with pytest.raises(TrackerError):
        client.wait_task("t-1", timeout=0.001)


def test_get_catalog_requests_catalog_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        return httpx.Response(200, json={"course_id": "math-qe", "title": "高等数学（上）"})

    client = _client(handler)
    result = client.get_catalog("math-qe")
    assert seen["path"] == "/api/v1/catalogs/math-qe"
    assert result["course_id"] == "math-qe"


def test_tracker_error_carries_status_code():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "状态机冲突：当前状态 downloading 不允许"})

    client = _client(handler)
    with pytest.raises(TrackerError) as exc_info:
        client.verify_book("bk_abc")
    assert exc_info.value.status_code == 409


# ---------- 教程客户端（qt_knowledge，五层模型 QED-031） ----------


def test_list_knowledge_sends_filters():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[{"knowledge_id": "kn_abc", "status": "confirmed"}])

    client = _client(handler)
    result = client.list_knowledge(course_id="01_math_analysis", status="confirmed")
    assert seen["path"] == "/api/v1/knowledge"
    assert seen["params"] == {"course_id": "01_math_analysis", "status": "confirmed"}
    assert result[0]["knowledge_id"] == "kn_abc"


def test_list_knowledge_omits_empty_filters():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[])

    client = _client(handler)
    client.list_knowledge()
    assert seen["params"] == {}


def test_get_knowledge_requests_detail_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        return httpx.Response(200, json={"knowledge_id": "kn_abc", "name": "数学分析 套一", "books": []})

    client = _client(handler)
    result = client.get_knowledge("kn_abc")
    assert seen["path"] == "/api/v1/knowledge/kn_abc"
    assert result["name"] == "数学分析 套一"


def test_confirm_knowledge_sends_refs_and_intros():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"knowledge_id": "kn_abc", "status": "confirmed"})

    client = _client(handler)
    client.confirm_knowledge(
        "kn_abc",
        textbook_ref={"title": "微积分学教程", "version": "第 8 版"},
        textbook_intro="经典教材",
    )
    assert seen["path"] == "/api/v1/knowledge/kn_abc/confirm"
    assert seen["body"] == {
        "textbook_ref": {"title": "微积分学教程", "version": "第 8 版"},
        "textbook_intro": "经典教材",
    }


def test_confirm_knowledge_omits_empty_fields():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8") or b"{}")
        return httpx.Response(200, json={"status": "confirmed"})

    client = _client(handler)
    client.confirm_knowledge("kn_abc")
    assert seen["body"] == {}


# ---------- 书籍客户端（qt_books / qt_sources，五层模型 QED-031） ----------


def test_create_book_posts_books():
    """create_book（QED-060 目标契约）：book_id + title，不再携带 knowledge_id。"""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(201, json={"book_id": "mathanalysis-b01", "status": "candidate"})

    client = _client(handler)
    result = client.create_book(
        "mathanalysis-b01",
        title="数学分析",
        original_title="Principles of Mathematical Analysis",
        roles=["textbook"],
        domain_id="math",
    )
    assert seen["path"] == "/api/v1/books"
    assert seen["body"] == {
        "book_id": "mathanalysis-b01",
        "title": "数学分析",
        "original_title": "Principles of Mathematical Analysis",
        "roles": ["textbook"],
        "domain_id": "math",
    }
    assert result["status"] == "candidate"


def test_book_sources_list_and_add():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json=[{"source_id": "src_1", "channel": "libgen_li", "ok": 1}])
        seen.append((request.url.path, json.loads(request.content.decode("utf-8"))))
        return httpx.Response(200, json={"source_id": "src_2", "channel": "manual", "ok": True})

    client = _client(handler)
    sources = client.list_book_sources("bk_abc")
    assert sources[0]["channel"] == "libgen_li"
    client.add_book_source("bk_abc", channel="manual", ok=True, note="人工下载")
    assert seen == [("/api/v1/books/bk_abc/sources", {"channel": "manual", "ok": True, "note": "人工下载"})]


def test_register_book_requests_register_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"book_id": "bk_abc", "status": "downloaded"})

    client = _client(handler)
    result = client.register_book("bk_abc", relative_path="raw/books/math-qe/01/v2.pdf")
    assert seen["path"] == "/api/v1/books/bk_abc/register"
    assert seen["body"] == {"relative_path": "raw/books/math-qe/01/v2.pdf"}
    assert result["status"] == "downloaded"


def test_register_book_requires_relative_path():
    client = _client(_json_handler({}))
    with pytest.raises(TrackerError):
        client.register_book("bk_abc", relative_path="")


def test_import_book_pdf_sends_file_path():
    """import_book_pdf：必须携带 file_path（此前漏传导致 8901 422）。"""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"book_id": "bk_abc", "holding": "owned", "status": "downloaded"})

    client = _client(handler)
    result = client.import_book_pdf("bk_abc", file_path="C:/tmp/upload.pdf")
    assert seen["path"] == "/api/v1/books/bk_abc/import"
    assert seen["body"] == {"file_path": "C:/tmp/upload.pdf"}
    assert result["status"] == "downloaded"


def test_import_book_pdf_includes_target_path_when_given():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"book_id": "bk_abc"})

    client = _client(handler)
    client.import_book_pdf(
        "bk_abc",
        file_path="C:/tmp/upload.pdf",
        target_path="raw/math/math_analysis/x.pdf",
    )
    assert seen["body"] == {
        "file_path": "C:/tmp/upload.pdf",
        "target_path": "raw/math/math_analysis/x.pdf",
    }


def test_import_book_pdf_requires_file_path():
    client = _client(_json_handler({}))
    with pytest.raises(TrackerError):
        client.import_book_pdf("bk_abc", file_path="")


def test_book_state_transitions_paths():
    """下载生命周期端点（QED-060）：start/fail/verify/cancel 透传 8901。"""
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        return httpx.Response(200, json={"book_id": "bk_abc", "status": "changed"})

    client = _client(handler)
    client.start_book("bk_abc")
    client.fail_book("bk_abc")
    client.verify_book("bk_abc")
    client.cancel_book("bk_abc")
    assert seen == [
        "/api/v1/books/bk_abc/start",
        "/api/v1/books/bk_abc/fail",
        "/api/v1/books/bk_abc/verify",
        "/api/v1/books/bk_abc/cancel",
    ]


def test_create_domain_offline_defaults_not_started(monkeypatch):
    """离线降级 create_domain：新领域默认「未开始」（与在线 8901 默认一致，PLAN-041）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    captured: dict = {}

    def fake_create(settings, **kwargs):
        captured.update(kwargs)
        return {"domain_id": "dm1", "exploration_stage": kwargs.get("exploration_stage")}

    monkeypatch.setattr("qed_engine.services.shared_tables.create_domain", fake_create)
    client = TrackerClient(
        base_url="http://tracker.test",
        transport=httpx.MockTransport(handler),
        settings=object(),
    )
    result = client.create_domain(name="高等数学", description="desc")
    assert captured["exploration_stage"] == "未开始"
    assert result["exploration_stage"] == "未开始"


# 注：旧课程探索 API 契约测试（PLAN-021 冻结端点 §1~§7.2）已随 B2 删除——探索会话
# 由 8900 自有 explore_sessions 服务承接（PLAN-022），客户端不再透传这些端点。


# --- 领域只读/维护透传（REQ-059，GET /domains + PATCH /domains/{id}） ---


def test_list_domains():
    """GET /domains：领域列表。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[
            {"domain_id": "gao_deng_shu_xue", "name": "高等数学", "description": "...", "stages": []},
        ])

    client = _client(handler)
    result = client.list_domains()
    assert result[0]["domain_id"] == "gao_deng_shu_xue"


def test_update_domain_sends_patch():
    """PATCH /domains/{id}：仅 description/stages 可改，name 不在请求体。"""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"domain_id": "d1", "description": "新描述"})

    client = _client(handler)
    result = client.update_domain("d1", description="新描述", stages=["本科基础"])
    assert seen["method"] == "PATCH"
    assert seen["path"] == "/api/v1/domains/d1"
    assert seen["body"] == {"description": "新描述", "stages": ["本科基础"]}
    assert result["description"] == "新描述"


# --- 课程体系只读 + 手工维护透传（REQ-059，2026-08-24 左树 v2 数据源） ---


def test_list_courses_system():
    """GET /courses：领域课程体系（领域含嵌套课程，左树 v2 数据源）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[
            {
                "domain_id": "d1", "name": "高等数学", "description": "", "stages": [],
                "courses": [{"course_id": "c1", "name": "数学分析", "aliases": [], "stage": "", "prerequisites": []}],
            },
        ])

    client = _client(handler)
    result = client.list_courses_system()
    assert result[0]["courses"][0]["course_id"] == "c1"


def test_delete_domain_sends_delete():
    """DELETE /domains/{id}：删除领域（有课程时上游 409）。"""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["path"] = request.url.path
        return httpx.Response(204)

    client = _client(handler)
    assert client.delete_domain("d1") in (None, {}, [])
    assert seen["method"] == "DELETE"
    assert seen["path"] == "/api/v1/domains/d1"


def test_create_course_for_domain():
    """POST /domains/{id}/courses：手工新增课程。"""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(201, json={"course_id": "c9", "name": "复变函数"})

    client = _client(handler)
    result = client.create_course_for_domain("d1", name="复变函数", stage="本科二")
    assert seen["method"] == "POST"
    assert seen["path"] == "/api/v1/domains/d1/courses"
    assert seen["body"]["name"] == "复变函数"
    assert result["course_id"] == "c9"


def test_update_course_omits_unset_fields():
    """PATCH /courses/{id}：仅提交显式字段（sort_order 留空不入请求体）。"""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"course_id": "c1", "stage": "本科一"})

    client = _client(handler)
    client.update_course("c1", stage="本科一")
    assert seen["body"] == {"stage": "本科一"}


def test_delete_course_sends_delete():
    """DELETE /courses/{id}：删除课程（有教程时上游 409）。"""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["path"] = request.url.path
        return httpx.Response(204)

    client = _client(handler)
    client.delete_course("c1")
    assert seen["method"] == "DELETE"
    assert seen["path"] == "/api/v1/courses/c1"
