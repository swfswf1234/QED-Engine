"""
模块职责：LLM 网关端点契约测试：/llm/text、/llm/vision、/llm/test/*、/llm/calls、/database/test。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：backend/qed_engine/api/control.py
"""

import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app


@pytest.fixture(autouse=True)
def _reset_service_manager(monkeypatch):
    """每个测试前重置服务托管全局状态（_OPS/_MANAGED/_LOCKED），避免跨测试污染。"""
    from qed_engine.services import service_manager as sm

    sm._OPS.clear()
    sm._MANAGED.clear()
    sm._LOCKED.clear()


@pytest.fixture(autouse=True)
def _mock_startup_side_effects(monkeypatch):
    """create_app() 启动自检的副作用全部 mock，避免触碰真实网络/MySQL（.env 未知内容）：

    - _probe_llm：供应商可达性探测（真实请求会慢且不可控）
    - _probe_mysql：数据库真实连接探测
    - llm_call_log.ensure_table：qed_llm_calls 建表（真实写库）
    """
    from qed_engine.api import control as api_control
    from qed_engine.services.llm import call_log as llm_call_log

    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: (True, ""))
    monkeypatch.setattr(llm_call_log, "ensure_table", lambda settings: None)


def _client(monkeypatch):
    return TestClient(create_app())


def test_llm_text_endpoint(monkeypatch):
    """POST /llm/text：返回 reply/call_id/success；网关调用被真实接线。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control, "gateway_call_text",
        lambda settings, **kw: {"reply": "你好！", "call_id": 7, "success": True, "error": ""},
    )
    client = _client(monkeypatch)
    response = client.post("/api/v1/llm/text", json={"prompt": "你好", "prompt_template": "greeting"})
    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "你好！" and body["call_id"] == 7 and body["success"] is True


def test_llm_vision_endpoint_requires_input(monkeypatch):
    """POST /llm/vision：无任何输入 → 422（校验错误）。"""
    client = _client(monkeypatch)
    response = client.post("/api/v1/llm/vision", json={})
    assert response.status_code == 422


def test_llm_vision_malformed_base64(monkeypatch):
    """POST /llm/vision：pdf_base64 非法 → 422（不 500）。"""
    client = _client(monkeypatch)
    response = client.post("/api/v1/llm/vision", json={"pdf_base64": "a"})
    assert response.status_code == 422


def test_llm_vision_image_and_pdf_api_mode(monkeypatch):
    """POST /llm/vision（api 模式）：同时传 image+pdf → pdf 被忽略仍 200。"""
    from qed_engine.api import control

    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setattr(
        control, "gateway_call_vision",
        lambda settings, **kw: {"reply": "OK", "call_id": 5, "success": True, "error": ""},
    )
    client = _client(monkeypatch)
    response = client.post(
        "/api/v1/llm/vision",
        json={"image_base64": "aGk=", "pdf_base64": "aGVsbG8="},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_llm_calls_endpoint(monkeypatch):
    """GET /llm/calls：检索结果透传。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control, "gateway_search_calls",
        lambda settings, **kw: {"items": [], "total": 0, "page": 1, "size": 20},
    )
    client = _client(monkeypatch)
    response = client.get("/api/v1/llm/calls?service=qed_tracker&page=1&size=20")
    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_llm_calls_bad_date_degrades(monkeypatch):
    """GET /llm/calls?start=abc：非法日期降级返回空结果，不 500。"""
    client = _client(monkeypatch)
    response = client.get("/api/v1/llm/calls?start=abc")
    assert response.status_code == 200
    assert response.json()["items"] == []


def test_database_test_endpoint(monkeypatch):
    """POST /database/test：即时连接探测（成功/失败均 200）。"""
    from qed_engine.api import control

    monkeypatch.setattr(control, "_probe_mysql", lambda settings: (True, ""))
    client = _client(monkeypatch)
    response = client.post("/api/v1/database/test")
    assert response.status_code == 200
    body = response.json()
    assert body["reachable"] is True and body["reason"] == ""


def test_llm_test_text_endpoint(monkeypatch):
    """POST /llm/test/text：小 prompt 真实调用，成功 → ok=True + call_id。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control, "gateway_call_text",
        lambda settings, **kw: {"reply": "OK", "call_id": 3, "success": True, "error": ""},
    )
    client = _client(monkeypatch)
    response = client.post("/api/v1/llm/test/text")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True and body["call_id"] == 3


def test_llm_test_text_endpoint_failure(monkeypatch):
    """POST /llm/test/text：调用失败 → ok=False + detail 含错误（截断 200）。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control, "gateway_call_text",
        lambda settings, **kw: {"reply": "", "call_id": None, "success": False,
                                "error": "dashscope: " + "e" * 500},
    )
    client = _client(monkeypatch)
    response = client.post("/api/v1/llm/test/text")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["detail"].startswith("dashscope: ")
    assert len(body["detail"]) == 200


def test_llm_test_vision_endpoint_api_mode(monkeypatch):
    """POST /llm/test/vision（api 模式）：小图调 qwen-vl，成功 → ok=True。"""
    from qed_engine.api import control

    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setattr(
        control, "gateway_call_vision",
        lambda settings, **kw: {"reply": "图", "call_id": 4, "success": True, "error": ""},
    )
    client = _client(monkeypatch)
    response = client.post("/api/v1/llm/test/vision")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_llm_test_vision_endpoint_local_mode(monkeypatch):
    """POST /llm/test/vision（local 模式）：MinerU 健康探测，失败 → ok=False + detail。"""
    from qed_engine.api import control

    monkeypatch.setenv("QED_API_SELECT", "local")
    monkeypatch.setattr(control, "probe_mineru", lambda: {"reachable": False, "reason": "连接失败"})
    client = _client(monkeypatch)
    response = client.post("/api/v1/llm/test/vision")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False and body["detail"] == "连接失败"


# --- REQ-060：新过滤参数 + 审核端点 ---


def test_llm_calls_new_filter_params(monkeypatch):
    """GET /llm/calls：task/step/prompt_template/review_status 透传。"""
    from qed_engine.api import control

    captured = {}
    def fake_search(settings, **kw):
        captured.update(kw)
        return {"items": [], "total": 0, "page": 1, "size": 20}

    monkeypatch.setattr(control, "gateway_search_calls", fake_search)
    client = _client(monkeypatch)
    resp = client.get(
        "/api/v1/llm/calls?task=paper-plan&step=assess&prompt_template=plan&review_status=passed"
    )
    assert resp.status_code == 200
    assert captured["task"] == "paper-plan"
    assert captured["step"] == "assess"
    assert captured["prompt_template"] == "plan"
    assert captured["review_status"] == "passed"


def test_llm_calls_review_endpoint(monkeypatch):
    """PATCH /llm/calls/{id}/review：审核标注成功 → ok=True。"""
    from qed_engine.api import control

    monkeypatch.setattr(control, "gateway_review_call", lambda settings, **kw: True)
    client = _client(monkeypatch)
    resp = client.patch(
        "/api/v1/llm/calls/42/review",
        json={"review_status": "passed", "review_note": "效果好"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True and body["call_id"] == 42


def test_llm_calls_review_not_found(monkeypatch):
    """PATCH /llm/calls/{id}/review：不存在 ID → 404。"""
    from qed_engine.api import control

    monkeypatch.setattr(control, "gateway_review_call", lambda settings, **kw: False)
    client = _client(monkeypatch)
    resp = client.patch(
        "/api/v1/llm/calls/99999/review",
        json={"review_status": "passed"},
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "记录不存在"