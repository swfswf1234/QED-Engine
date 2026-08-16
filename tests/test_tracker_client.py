"""
模块职责：QED-Tracker 服务客户端（8901）契约测试：方法/路径/请求体、错误响应与任务轮询。
设计关联（DesignRef）：docs/design/service-contracts.md
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
        client.confirm_selection("cand_abc")
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
        client.confirm_selection("cand_abc")
    assert exc_info.value.status_code == 409


# ---------- 三表客户端（qt_selections / qt_downloads / qt_sources，downloads-three-table-model §3） ----------


def test_list_selections_sends_filters():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[{"selection_id": "cand_abc", "status": "confirmed"}])

    client = _client(handler)
    result = client.list_selections(course_id="01_math_analysis", status="confirmed")
    assert seen["path"] == "/api/v1/selections"
    assert seen["params"] == {"course_id": "01_math_analysis", "status": "confirmed"}
    assert result[0]["selection_id"] == "cand_abc"


def test_list_selections_omits_empty_filters():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[])

    client = _client(handler)
    client.list_selections()
    assert seen["params"] == {}


def test_get_selection_requests_detail_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        return httpx.Response(200, json={"selection_id": "cand_abc", "title": "微积分学教程"})

    client = _client(handler)
    result = client.get_selection("cand_abc")
    assert seen["path"] == "/api/v1/selections/cand_abc"
    assert result["title"] == "微积分学教程"


def test_selection_confirm_backup_send_note():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.url.path, json.loads(request.content.decode("utf-8"))))
        return httpx.Response(200, json={"selection_id": "cand_abc", "status": "confirmed"})

    client = _client(handler)
    client.confirm_selection("cand_abc", note="首选")
    client.backup_selection("cand_abc", note="备选")
    assert seen == [
        ("/api/v1/selections/cand_abc/confirm", {"note": "首选"}),
        ("/api/v1/selections/cand_abc/backup", {"note": "备选"}),
    ]


def test_reject_selection_sends_reason_and_note():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"selection_id": "cand_abc", "status": "rejected"})

    client = _client(handler)
    client.reject_selection("cand_abc", reason="版本过旧", note="换新版")
    assert seen["body"] == {"reason": "版本过旧", "note": "换新版"}


def test_reject_selection_requires_reason():
    client = _client(_json_handler({}))
    with pytest.raises(TrackerError):
        client.reject_selection("cand_abc", reason="")


def test_supersede_selection_sends_reason():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"selection_id": "cand_abc", "status": "superseded"})

    client = _client(handler)
    result = client.supersede_selection("cand_abc", reason="被第三版替代")
    assert seen["path"] == "/api/v1/selections/cand_abc/supersede"
    assert seen["body"] == {"reason": "被第三版替代"}
    assert result["status"] == "superseded"


def test_list_selection_downloads_requests_resources_downloads_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        return httpx.Response(200, json=[{"download_id": "download_1", "status": "downloaded"}])

    client = _client(handler)
    result = client.list_selection_downloads("cand_abc")
    assert seen["path"] == "/api/v1/resources/cand_abc/downloads"
    assert result[0]["download_id"] == "download_1"


def test_create_download_candidate_posts_downloads():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json=[{"download_id": "download_1", "status": "candidate"}])

    client = _client(handler)
    result = client.create_download_candidate("cand_abc", vol="v2", file_hint="第二卷")
    assert seen["path"] == "/api/v1/downloads"
    assert seen["body"] == {"selection_id": "cand_abc", "vol": "v2", "file_hint": "第二卷"}
    assert result[0]["status"] == "candidate"


def test_approve_reject_register_download():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.url.path, json.loads(request.content.decode("utf-8") or b"{}")))
        return httpx.Response(200, json={"download_id": "download_1", "status": "ok"})

    client = _client(handler)
    client.approve_download("download_1")
    client.reject_download("download_1", reason="扫描缺页")
    client.register_download("download_1", relative_path="raw/books/math-qe/01/v2.pdf")
    assert seen == [
        ("/api/v1/downloads/download_1/approve", {}),
        ("/api/v1/downloads/download_1/reject", {"reason": "扫描缺页"}),
        ("/api/v1/downloads/download_1/register", {"relative_path": "raw/books/math-qe/01/v2.pdf"}),
    ]


def test_reject_download_requires_reason():
    client = _client(_json_handler({}))
    with pytest.raises(TrackerError):
        client.reject_download("download_1", reason="")


def test_list_download_sources_requests_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        return httpx.Response(200, json=[{"source_id": "src_1", "channel": "libgen_li", "ok": 1}])

    client = _client(handler)
    result = client.list_download_sources("download_1")
    assert seen["path"] == "/api/v1/downloads/download_1/sources"
    assert result[0]["channel"] == "libgen_li"
