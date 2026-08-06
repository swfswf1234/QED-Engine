"""
模块职责：QED-Tracker 服务客户端（8901）契约测试：方法/路径/请求体、错误响应与任务轮询。
设计关联（DesignRef）：docs/design/service-contracts.md
实现状态：Current
被测代码：src/qed_engine/tracker_client.py
"""

import json
import time

import httpx
import pytest

from qed_engine.tracker_client import TrackerClient, TrackerError


def _client(handler) -> TrackerClient:
    transport = httpx.MockTransport(handler)
    return TrackerClient(base_url="http://tracker.test", transport=transport)


def _json_handler(payload):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    return handler


def test_list_resources_sends_filters():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[{"resource_id": "sha256:abc"}])

    client = _client(handler)
    result = client.list_resources(status="candidate", course_id="01", kind="book", language="zh")
    assert seen["path"] == "/api/v1/resources"
    assert seen["params"] == {
        "status": "candidate",
        "course_id": "01",
        "kind": "book",
        "language": "zh",
    }
    assert result == [{"resource_id": "sha256:abc"}]


def test_list_resources_omits_empty_filters():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[])

    client = _client(handler)
    client.list_resources()
    assert seen["params"] == {}


def test_confirm_resource_posts_correct_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["path"] = request.url.path
        return httpx.Response(200, json={"resource_id": "sha256:abc", "status": "confirmed"})

    client = _client(handler)
    result = client.confirm_resource("sha256:abc")
    assert seen["method"] == "POST"
    assert seen["path"] == "/api/v1/resources/sha256:abc/confirm"
    assert result["status"] == "confirmed"


def test_reject_resource_sends_reason():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"resource_id": "sha256:abc", "status": "rejected"})

    client = _client(handler)
    client.reject_resource("sha256:abc", reason="版本不对")
    assert seen["body"] == {"reason": "版本不对"}


def test_reject_resource_requires_reason():
    client = _client(_json_handler({}))
    with pytest.raises(TrackerError):
        client.reject_resource("sha256:abc", reason="")


def test_approve_resource_posts_correct_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        return httpx.Response(200, json={"status": "approved"})

    client = _client(handler)
    client.approve_resource("sha256:abc")
    assert seen["path"] == "/api/v1/resources/sha256:abc/approve"


def test_backup_resource_posts_correct_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["path"] = request.url.path
        return httpx.Response(200, json={"resource_id": "sha256:abc", "status": "backup"})

    client = _client(handler)
    result = client.backup_resource("sha256:abc")
    assert seen["method"] == "POST"
    assert seen["path"] == "/api/v1/resources/sha256:abc/backup"
    assert result["status"] == "backup"


def test_create_download_payload():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"task_id": "t-1"})

    client = _client(handler)
    client.create_download("sha256:abc")
    assert seen["body"] == {"resource_id": "sha256:abc"}


def test_create_evaluate_with_and_without_course():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content.decode("utf-8"))
        seen["path"] = request.url.path
        return httpx.Response(200, json={"task_id": "t-eval"})

    client = _client(handler)
    client.create_evaluate()
    assert seen["path"] == "/api/v1/tasks/catalog/evaluate"
    assert seen["body"] == {}
    client.create_evaluate(course_id="03")
    assert seen["body"] == {"course_id": "03"}


def test_get_and_list_tasks():
    client = _client(
        lambda request: httpx.Response(
            200,
            json={"task_id": "t-1", "status": "running"}
            if request.url.path.endswith("/t-1")
            else [{"task_id": "t-1"}],
        )
    )
    assert client.get_task("t-1")["status"] == "running"
    assert client.list_tasks() == [{"task_id": "t-1"}]


def test_error_response_raises_with_detail():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "非法状态迁移"})

    client = _client(handler)
    with pytest.raises(TrackerError) as exc_info:
        client.confirm_resource("sha256:abc")
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
