"""
模块职责：QED-Tracker 服务客户端（8901）契约测试：方法/路径/请求体、错误响应与任务轮询。
设计关联（DesignRef）：docs/design/service-contracts.md（五层模型，QED-031）
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
        client.decide_book("bk_abc")
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
        client.decide_book("bk_abc")
    assert exc_info.value.status_code == 409


# ---------- 知识行客户端（qt_knowledge，五层模型 QED-031） ----------


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


def test_knowledge_complete_requests_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        return httpx.Response(200, json={"knowledge_id": "kn_abc", "status": "completed"})

    client = _client(handler)
    result = client.complete_knowledge("kn_abc")
    assert seen["path"] == "/api/v1/knowledge/kn_abc/complete"
    assert result["status"] == "completed"


def test_knowledge_reject_sends_reason():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"knowledge_id": "kn_abc", "status": "rejected"})

    client = _client(handler)
    client.reject_knowledge("kn_abc", reason="非目标体系")
    assert seen["body"] == {"reason": "非目标体系"}


def test_knowledge_reject_requires_reason():
    client = _client(_json_handler({}))
    with pytest.raises(TrackerError):
        client.reject_knowledge("kn_abc", reason="")


def test_knowledge_supersede_sends_reason():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"knowledge_id": "kn_abc", "status": "superseded"})

    client = _client(handler)
    result = client.supersede_knowledge("kn_abc", reason="被新版替代")
    assert seen["path"] == "/api/v1/knowledge/kn_abc/supersede"
    assert seen["body"] == {"reason": "被新版替代"}
    assert result["status"] == "superseded"


# ---------- 书行客户端（qt_books / qt_sources，五层模型 QED-031） ----------


def test_create_book_posts_books():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"book_id": "bk_abc", "status": "candidate"})

    client = _client(handler)
    result = client.create_book(
        "kn_abc",
        kind="textbook",
        roles=["textbook"],
        title="微积分学教程",
        part="第一册",
        authors=["菲赫金哥尔茨"],
    )
    assert seen["path"] == "/api/v1/books"
    assert seen["body"] == {
        "knowledge_id": "kn_abc",
        "kind": "textbook",
        "roles": ["textbook"],
        "title": "微积分学教程",
        "part": "第一册",
        "authors": ["菲赫金哥尔茨"],
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


def test_book_state_transitions_paths():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        return httpx.Response(200, json={"book_id": "bk_abc", "status": "changed"})

    client = _client(handler)
    client.decide_book("bk_abc")
    client.start_book("bk_abc")
    client.fail_book("bk_abc")
    client.retry_book("bk_abc")
    client.verify_book("bk_abc")
    assert seen == [
        "/api/v1/books/bk_abc/decide",
        "/api/v1/books/bk_abc/start",
        "/api/v1/books/bk_abc/fail",
        "/api/v1/books/bk_abc/retry",
        "/api/v1/books/bk_abc/verify",
    ]


def test_complete_book_sends_required_fields():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"book_id": "bk_abc", "status": "downloaded"})

    client = _client(handler)
    client.complete_book(
        "bk_abc",
        sha256="a" * 64,
        relative_path="raw/books/math-qe/01/v2.pdf",
        page_count=600,
    )
    assert seen["body"] == {
        "sha256": "a" * 64,
        "relative_path": "raw/books/math-qe/01/v2.pdf",
        "page_count": 600,
        "absolute_path": "",
        "file_name": "",
    }


def test_complete_book_requires_sha256_and_path():
    client = _client(_json_handler({}))
    with pytest.raises(TrackerError):
        client.complete_book("bk_abc", sha256="", relative_path="")


def test_reject_book_sends_reason_and_note():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"book_id": "bk_abc", "status": "rejected"})

    client = _client(handler)
    client.reject_book("bk_abc", reason="扫描缺页", note="建议换源")
    assert seen["body"] == {"reason": "扫描缺页", "note": "建议换源"}


def test_reject_book_requires_reason():
    client = _client(_json_handler({}))
    with pytest.raises(TrackerError):
        client.reject_book("bk_abc", reason="")


def test_supersede_book_sends_reason():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"book_id": "bk_abc", "status": "superseded"})

    client = _client(handler)
    result = client.supersede_book("bk_abc", reason="被第 9 版替代")
    assert seen["path"] == "/api/v1/books/bk_abc/supersede"
    assert seen["body"] == {"reason": "被第 9 版替代"}
    assert result["status"] == "superseded"
