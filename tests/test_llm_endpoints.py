"""
模块职责：LLM 网关端点契约测试：/llm/text、/llm/vision、/llm/embedding、/llm/test/*、
/llm/calls、/database/test、/models/{slot}（状态/选择/启停）、/monitor/{slot}。
设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
被测代码：backend/qed_engine/api/control.py
"""

import json

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


@pytest.fixture(autouse=True)
def _isolate_manifest(tmp_path, monkeypatch):
    """隔离运行态 manifest：默认指向空临时目录（避免读真实 model/<槽位>/manifest.json）。"""
    from qed_engine.services.llm import registry as llm_registry

    monkeypatch.setattr(llm_registry, "MANIFEST_ROOT", tmp_path)
    return tmp_path


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


# --- Task 5: /models/{name} 模型端点族 ---


def test_models_start_text_local(monkeypatch):
    """POST /models/qwen/start（local 模式）：model_manager.operate_model 被调用，返回 starting。"""
    from qed_engine.services.llm import model_manager as mm

    monkeypatch.setenv("QED_API_SELECT", "local")
    calls = []
    monkeypatch.setattr(mm, "operate_model", lambda name, op, settings, **kw: calls.append((name, op)))
    client = _client(monkeypatch)
    resp = client.post("/api/v1/models/qwen/start")
    assert resp.status_code == 200
    assert resp.json()["name"] == "qwen"
    assert resp.json()["status"] == "starting"
    assert calls == [("qwen", "start")]


def test_models_api_mode_rejects(monkeypatch):
    """POST /models/qwen/start（api 模式）：409（本地模型仅支持测试）。"""
    monkeypatch.setenv("QED_API_SELECT", "api")
    client = _client(monkeypatch)
    resp = client.post("/api/v1/models/qwen/start")
    assert resp.status_code == 409
    assert "api" in resp.json()["detail"]


def test_models_unknown_name_404(monkeypatch):
    """POST /models/unknown/start：404（model_manager 抛 ValueError）。"""
    monkeypatch.setenv("QED_API_SELECT", "local")
    client = _client(monkeypatch)
    resp = client.post("/api/v1/models/unknown/start")
    assert resp.status_code == 404


def test_models_stop_mineru_local(monkeypatch):
    """POST /models/mineru/stop（local 模式）：返回 stopping。"""
    from qed_engine.services.llm import model_manager as mm

    monkeypatch.setenv("QED_API_SELECT", "local")
    calls = []
    monkeypatch.setattr(mm, "operate_model", lambda name, op, settings, **kw: calls.append((name, op)))
    client = _client(monkeypatch)
    resp = client.post("/api/v1/models/mineru/stop")
    assert resp.status_code == 200
    assert resp.json()["status"] == "stopping"
    assert calls == [("mineru", "stop")]


def test_models_restart_text_local(monkeypatch):
    """POST /models/qwen/restart（local 模式）：返回 starting。"""
    from qed_engine.services.llm import model_manager as mm

    monkeypatch.setenv("QED_API_SELECT", "local")
    calls = []
    monkeypatch.setattr(mm, "operate_model", lambda name, op, settings, **kw: calls.append((name, op)))
    client = _client(monkeypatch)
    resp = client.post("/api/v1/models/qwen/restart")
    assert resp.status_code == 200
    assert resp.json()["status"] == "starting"
    assert calls == [("qwen", "restart")]


def test_models_start_slot_name(monkeypatch):
    """POST /models/text/start：槽位名直接可用（v2 泛化）。"""
    from qed_engine.services.llm import model_manager as mm

    monkeypatch.setenv("QED_API_SELECT", "local")
    calls = []
    monkeypatch.setattr(mm, "operate_model", lambda name, op, settings, **kw: calls.append((name, op)))
    client = _client(monkeypatch)
    resp = client.post("/api/v1/models/text/start")
    assert resp.status_code == 200
    assert calls == [("text", "start")]


# --- PLAN-046：/llm/embedding、GET /models/{slot}、/models/{slot}/select、/monitor/{slot} ---


def test_llm_embedding_endpoint(monkeypatch):
    """POST /llm/embedding：input 文本列表 → embeddings + call_id。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control, "gateway_call_embedding",
        lambda settings, **kw: {"embeddings": [[0.1, 0.2]], "call_id": 9, "success": True, "error": ""},
    )
    client = _client(monkeypatch)
    resp = client.post("/api/v1/llm/embedding", json={"input": ["你好"]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True and body["embeddings"] == [[0.1, 0.2]] and body["call_id"] == 9


def test_llm_embedding_endpoint_empty_input(monkeypatch):
    """POST /llm/embedding：input 为空 → 422。"""
    client = _client(monkeypatch)
    resp = client.post("/api/v1/llm/embedding", json={"input": []})
    assert resp.status_code == 422


def test_llm_test_embedding_endpoint(monkeypatch):
    """POST /llm/test/embedding：小 input 真实调用，成功 → ok=True + 向量数摘要。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control, "gateway_call_embedding",
        lambda settings, **kw: {"embeddings": [[0.1, 0.2], [0.3, 0.4]], "call_id": 1,
                                 "success": True, "error": ""},
    )
    client = _client(monkeypatch)
    resp = client.post("/api/v1/llm/test/embedding")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "2 vectors" in body["detail"]


def test_models_get_status_api_mode(monkeypatch):
    """GET /models/text（api 来源）：source=api、channel=direct、厂商/模型/options；ready=API_KEY。"""
    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setenv("API_KEY", "sk-test")
    monkeypatch.setenv("QED_MODEL", "")
    client = _client(monkeypatch)
    resp = client.get("/api/v1/models/text")
    assert resp.status_code == 200
    body = resp.json()
    assert body["slot"] == "text" and body["source"] == "api" and body["channel"] == "direct"
    assert body["model"] == "qwen-plus" and body["provider"] == "qwen"
    assert body["ready"] is True and body["runtime"] == ""
    assert [o["value"] for o in body["options"]] == ["qwen-plus", "deepseek-v4-flash-0731"]
    assert body["description"]
    channel_status = {c["value"]: c["status"] for c in body["channel_options"]}
    assert channel_status["lmstudio"] == "available"
    assert channel_status["docker"] == "pending"


def test_models_get_status_local_mode(monkeypatch):
    """GET /models/text（local 来源）：source=local、channel=runtime、本地标识、ready=探针结果。"""
    from qed_engine.services.llm import runtimes as llm_runtimes

    monkeypatch.setenv("QED_API_SELECT", "local")
    monkeypatch.setenv("QED_LOCAL_RUNTIME", "lmstudio")
    monkeypatch.setattr(llm_runtimes.get_runtime("lmstudio"), "probe", lambda s, model="": True)
    client = _client(monkeypatch)
    resp = client.get("/api/v1/models/text")
    assert resp.status_code == 200
    body = resp.json()
    assert body["channel"] == "lmstudio" and body["runtime"] == "lmstudio"
    assert body["model"] == "qwen3.8-27b"
    assert body["ready"] is True
    assert body["source"] == "local"
    assert set(o["value"] for o in body["options"]) == {"qwen3.8-27b", "qwen3.5-9b"}


def test_models_get_unknown_slot_404(monkeypatch):
    """GET /models/bogus → 404。"""
    client = _client(monkeypatch)
    resp = client.get("/api/v1/models/bogus")
    assert resp.status_code == 404


def test_models_get_embedding_source_local_pending(monkeypatch):
    """GET /models/embedding：来源固定 api，本地部署待上线（status=pending）。"""
    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setenv("API_KEY", "sk-test")
    client = _client(monkeypatch)
    resp = client.get("/api/v1/models/embedding")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "api" and body["channel"] == "direct"
    sources = {o["value"]: o["status"] for o in body["source_options"]}
    assert sources == {"local": "pending", "api": "available"}


def test_models_select_writes_manifest(monkeypatch, tmp_path):
    """POST /models/text/select：写运行态 manifest.active（合并已有字段）。"""
    from qed_engine.services.llm import registry as llm_registry

    monkeypatch.setattr(llm_registry, "MANIFEST_ROOT", tmp_path)
    client = _client(monkeypatch)
    resp = client.post("/api/v1/models/text/select", json={"model": "qwen3.5-9b"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "selected"
    manifest = tmp_path / "qwen" / "manifest.json"
    assert json.loads(manifest.read_text(encoding="utf-8"))["active"] == "qwen3.5-9b"


def test_models_select_writes_source_and_runtime(monkeypatch, tmp_path):
    """POST /models/text/select（v3）：写 source / runtime / active 三字段。"""
    from qed_engine.services.llm import registry as llm_registry

    monkeypatch.setattr(llm_registry, "MANIFEST_ROOT", tmp_path)
    client = _client(monkeypatch)
    resp = client.post(
        "/api/v1/models/text/select",
        json={"source": "local", "runtime": "lmstudio", "model": "qwen3.8-27b"},
    )
    assert resp.status_code == 200
    data = json.loads((tmp_path / "qwen" / "manifest.json").read_text(encoding="utf-8"))
    assert data == {"source": "local", "runtime": "lmstudio", "active": "qwen3.8-27b"}


def test_models_select_invalid_source_422(monkeypatch, tmp_path):
    """POST /models/text/select：非法 source / 三项全空 → 422。"""
    from qed_engine.services.llm import registry as llm_registry

    monkeypatch.setattr(llm_registry, "MANIFEST_ROOT", tmp_path)
    client = _client(monkeypatch)
    assert client.post("/api/v1/models/text/select", json={"source": "bogus"}).status_code == 422
    assert client.post("/api/v1/models/text/select", json={}).status_code == 422


def test_models_start_409_by_slot_source_manifest(monkeypatch, tmp_path):
    """槽位来源运行态（manifest.source=api）→ 启停 409（即使全局 QED_API_SELECT=local）。"""
    from qed_engine.services.llm import registry as llm_registry

    monkeypatch.setenv("QED_API_SELECT", "local")
    monkeypatch.setattr(llm_registry, "MANIFEST_ROOT", tmp_path)
    (tmp_path / "qwen").mkdir(parents=True)
    (tmp_path / "qwen" / "manifest.json").write_text(
        json.dumps({"source": "api"}), encoding="utf-8")
    client = _client(monkeypatch)
    assert client.post("/api/v1/models/text/start").status_code == 409


def test_models_select_unknown_identity_404(monkeypatch, tmp_path):
    """POST /models/text/select：未知身份 → 404（不写文件）。"""
    from qed_engine.services.llm import registry as llm_registry

    monkeypatch.setattr(llm_registry, "MANIFEST_ROOT", tmp_path)
    client = _client(monkeypatch)
    resp = client.post("/api/v1/models/text/select", json={"model": "bogus"})
    assert resp.status_code == 404
    assert not (tmp_path / "qwen" / "manifest.json").exists()


def test_models_select_embedding_404(monkeypatch):
    """POST /models/embedding/select：向量槽位无运行态 manifest → 404。"""
    client = _client(monkeypatch)
    resp = client.post("/api/v1/models/embedding/select", json={"model": "text-embedding-v4"})
    assert resp.status_code == 404


def test_monitor_slot_text_endpoint(monkeypatch):
    """GET /monitor/text：槽位泛化探针透传（runtime/reachable/models）。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control, "probe_slot",
        lambda settings, slot: {"slot": slot, "runtime": "lmstudio", "reachable": True,
                                 "base_url": "http://127.0.0.1:1234/v1",
                                 "models": ["qwen3.8-27b"], "reason": ""},
    )
    client = _client(monkeypatch)
    resp = client.get("/api/v1/monitor/text")
    assert resp.status_code == 200
    body = resp.json()
    assert body["slot"] == "text" and body["runtime"] == "lmstudio" and body["reachable"] is True


def test_monitor_slot_unknown_404(monkeypatch):
    """GET /monitor/bogus → 404。"""
    client = _client(monkeypatch)
    resp = client.get("/api/v1/monitor/bogus")
    assert resp.status_code == 404