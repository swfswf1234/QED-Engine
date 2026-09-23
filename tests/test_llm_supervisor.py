"""
模块职责：ARCH-028 本地模型监督器单测——首观测即时定态、状态机防抖翻转（N 次同向）、
分级探测（T1 存活 + T2 容器内 GPU 可见性 → 降级态）、api 来源槽位跳过、快照契约，
以及 GET /models/{slot} 健康字段扩展（health_state / gpu_visible / last_flip）。
设计关联（DesignRef）：docs/plans/2026-09-23-local-model-stability-round.md、
docs/design/local-model-management.md
实现状态：Current
被测代码：backend/qed_engine/services/llm/supervisor.py、backend/qed_engine/api/control.py
"""

import pytest
from fastapi.testclient import TestClient
from qed_engine.config import Settings
from qed_engine.services.llm import supervisor

# --- 探针注入夹具 ---


def _settings(**kw):
    return Settings(_env_file=None, qed_api_select="local", **kw)


def _supervisor(probe_t1, probe_gpu=None, **kw):
    return supervisor.ModelSupervisor(
        _settings(),
        probe_t1=probe_t1,
        probe_gpu=probe_gpu or (lambda slot: None),
        **kw,
    )


def test_first_observation_sets_state_immediately():
    sup = _supervisor(lambda slot: (True, ""))
    sup.tick()
    snap = sup.snapshot("text")
    assert snap["state"] == supervisor.READY
    assert snap["last_flip"]


def test_down_flip_requires_debounce_consecutive():
    # 初态 ready（首观测）→ 两次 down 不翻转 → 第三次连续 down 翻转
    seen = {"ok": True, "reason": ""}

    def probe(slot):
        return (seen["ok"], seen["reason"])

    sup2 = _supervisor(probe, debounce=3)
    sup2.tick()  # 首观测 ready 定态
    seen.update(ok=False, reason="超时")
    sup2.tick()
    sup2.tick()
    assert sup2.snapshot("text")["state"] == supervisor.READY, "未达 N 次不翻转"
    sup2.tick()
    snap = sup2.snapshot("text")
    assert snap["state"] == supervisor.DOWN
    assert "超时" in snap["reason"]


def test_pending_counter_reset_by_recovery():
    # 序列只喂 text 槽位（vision 恒 ready 不干扰）：ready→down→down→ready(清零)→down = 1 次 < 3 不翻转
    seq = iter([(True, ""), (False, "超时"), (False, "超时"), (True, ""), (False, "超时")])

    def probe(slot):
        return next(seq) if slot == "text" else (True, "")

    sup = _supervisor(probe, debounce=3)
    for _ in range(5):
        sup.tick()
    assert sup.snapshot("text")["state"] == supervisor.READY


def test_gpu_invisible_degrades_slot():
    sup = _supervisor(lambda slot: (True, ""), probe_gpu=lambda slot: False)
    sup.tick()
    snap = sup.snapshot("vision")
    assert snap["state"] == supervisor.DEGRADED
    assert "GPU" in snap["reason"]


def test_gpu_probe_only_for_docker_vision():
    probed = []

    def probe_gpu(slot):
        probed.append(slot)
        return None

    sup = _supervisor(lambda slot: (True, ""), probe_gpu=probe_gpu)
    sup.tick()
    assert set(probed) == {"vision"}, "T2 仅适用 docker 图像槽位，text 不探"
    assert sup.snapshot("text")["state"] == supervisor.READY
    assert sup.snapshot("vision")["state"] == supervisor.READY, "None=不可判，按存活就绪"


def test_api_source_slots_are_skipped(monkeypatch):
    from qed_engine.services.llm import registry

    monkeypatch.setattr(registry, "configured_source", lambda settings, slot: "api")
    calls = []

    def probe(slot):
        calls.append(slot)
        return (False, "不该被调用")

    sup = _supervisor(probe)
    sup.tick()
    assert calls == []
    assert sup.snapshot("text")["state"] == ""


def test_snapshot_unknown_slot():
    sup = _supervisor(lambda slot: (True, ""))
    assert sup.snapshot("embedding") == {}
    assert sup.snapshot("nope") == {}


def test_flip_writes_event_log(caplog):
    import logging

    sup = _supervisor(lambda slot: (True, ""))
    with caplog.at_level(logging.INFO, logger="qed_engine.services"):
        sup.tick()
        sup.tick()  # 无翻转不记
    events = [r.message for r in caplog.records if "模型监督事件" in r.message]
    assert len(events) == 2, "初始定态各槽位记一条（text/vision）；同向不重复记"
    assert any("slot=text" in e for e in events)
    assert any("∅->ready" in e for e in events)


# --- W1 端点契约：GET /models/{slot} 健康字段 ---


@pytest.fixture(autouse=True)
def _isolate_manifest(tmp_path, monkeypatch):
    from qed_engine.services.llm import registry as llm_registry

    monkeypatch.setattr(llm_registry, "MANIFEST_ROOT", tmp_path)


@pytest.fixture(autouse=True)
def _mock_startup_side_effects(monkeypatch):
    from qed_engine.api import control as api_control
    from qed_engine.services.llm import call_log as llm_call_log
    from qed_engine.api.main import create_app as _ca

    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: (True, ""))
    monkeypatch.setattr(llm_call_log, "ensure_table", lambda settings: None)
    monkeypatch.setattr(llm_call_log, "ensure_comments", lambda settings: None)


class _StubSupervisor:
    def __init__(self, snap):
        self._snap = snap

    def snapshot(self, slot):
        return dict(self._snap)


def _client_with_stub(monkeypatch, snap):
    from qed_engine.api.main import create_app

    app = create_app(Settings(_env_file=None, qed_model_supervisor=False))
    app.state.model_supervisor = _StubSupervisor(snap)
    return TestClient(app)


def test_models_slot_exposes_health_fields(monkeypatch):
    client = _client_with_stub(
        monkeypatch,
        {"state": "degraded", "reason": "容器内 GPU 不可见", "gpu_visible": False,
         "last_flip": "2026-09-23T10:00:00+08:00"},
    )
    body = client.get("/api/v1/models/vision").json()
    assert body["health_state"] == "degraded"
    assert body["health_reason"] == "容器内 GPU 不可见"
    assert body["gpu_visible"] is False, "degraded=T1 存活+T2 GPU 不可见的归并呈现"
    assert body["last_flip"] == "2026-09-23T10:00:00+08:00"


def test_models_slot_health_empty_without_supervisor_state(monkeypatch):
    client = _client_with_stub(monkeypatch, {"state": "", "reason": "", "last_flip": ""})
    body = client.get("/api/v1/models/text").json()
    assert body["health_state"] == ""
    assert body["gpu_visible"] is None
    assert body["last_flip"] == ""
    # 控制台既有语义不受影响
    assert body["availability"] in ("可用", "未就绪", "不可用")


def test_create_app_wires_supervisor_by_default(monkeypatch):
    from qed_engine.api.main import create_app

    sup = _supervisor(lambda slot: (True, ""))
    monkeypatch.setattr(supervisor, "ModelSupervisor", lambda settings, **kw: sup)
    app = create_app(Settings(_env_file=None))
    assert app.state.model_supervisor is sup
    app2 = create_app(Settings(_env_file=None, qed_model_supervisor=False))
    assert app2.state.model_supervisor is None
