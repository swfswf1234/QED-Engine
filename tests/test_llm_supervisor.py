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
    # W3 起 tick 带恢复决策：默认注入 no-op，保持单测零副作用；恢复用例显式覆盖
    defaults = {
        "recover": lambda slot: None,
        "is_inflight": lambda slot: False,
        "diagnostics": lambda slot: None,
    }
    defaults.update(kw)
    return supervisor.ModelSupervisor(
        _settings(),
        probe_t1=probe_t1,
        probe_gpu=probe_gpu or (lambda slot: None),
        **defaults,
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


# --- W3 受控恢复：在飞门 + 退避上限 + 诊断包 ---


def _down_probe():
    """每槽位首观测 ready 定态，其后恒 down（槽位独立计数）。"""
    n: dict[str, int] = {}

    def probe(slot):
        n[slot] = cnt = n.get(slot, 0) + 1
        return (True, "") if cnt == 1 else (False, "连接失败")

    return probe


def test_down_flip_triggers_recovery_restart():
    calls = []
    sup = _supervisor(_down_probe(), recover=calls.append)
    for _ in range(4):  # tick1 ready；tick2/3 pending；tick4 翻转 down（ticks=1 未到退避节拍）
        sup.tick()
    assert sup.snapshot("text")["state"] == supervisor.DOWN
    assert calls == []
    for _ in range(4):  # ticks=2~5；ticks=4（默认 recover_cooldown=4）→ 各槽位恢复第 1 次
        sup.tick()
    assert calls == ["text", "vision"]


def test_degraded_flip_triggers_recovery():
    calls = []
    sup = _supervisor(lambda slot: (True, ""),
                      probe_gpu=lambda slot: False if slot == "vision" else None,
                      recover=calls.append)
    for _ in range(4):  # 初始观测 degraded 定态 → ticks=4 到节拍触发恢复
        sup.tick()
    assert sup.snapshot("vision")["state"] == supervisor.DEGRADED
    assert calls == ["vision"]
    assert sup.snapshot("text")["state"] == supervisor.READY


def test_inflight_down_only_warns_no_restart(caplog):
    import logging

    calls = []
    sup = _supervisor(_down_probe(), recover=calls.append,
                      is_inflight=lambda slot: slot == "vision")
    with caplog.at_level(logging.INFO, logger="qed_engine.services"):
        for _ in range(8):  # tick4 翻转；tick7 ticks=4 评估：text 恢复、vision 在飞跳过
            sup.tick()
    assert calls == ["text"], "在飞槽位只告警不重启（REQ-085 约束 9），非在飞照常恢复"
    events = [r.message for r in caplog.records if "模型恢复跳过" in r.message]
    assert any("slot=vision" in e for e in events)


def test_recovery_backoff_cooldown_and_cap_three(caplog):
    import logging

    calls = []
    # recover_cooldown=3：非就绪 ticks 计数，3 的整数倍 tick 才评估
    sup = _supervisor(_down_probe(), recover=calls.append,
                      max_recoveries=3, recover_cooldown=3)
    with caplog.at_level(logging.WARNING, logger="qed_engine.services"):
        for _ in range(3):
            sup.tick()
        assert calls == [], "尚未翻转"
        sup.tick()  # tick4 翻转 down，ticks=1 不评估
        assert calls == []
        for _ in range(2):  # ticks=2,3 → 第 1 次
            sup.tick()
        assert len(calls) == 2
        for _ in range(3):  # ticks=6 → 第 2 次
            sup.tick()
        assert len(calls) == 4
        for _ in range(3):  # ticks=9 → 第 3 次
            sup.tick()
        assert len(calls) == 6
        for _ in range(12):  # ticks=12 评估 → 放弃转纯告警
            sup.tick()
        assert len(calls) == 6, "退避≤3 次后转纯告警，不再重启"
    warns = [r.message for r in caplog.records if "模型恢复放弃" in r.message]
    assert any("slot=text" in w for w in warns)


def test_ready_flip_resets_recovery_budget(caplog):
    calls = []
    state = {"down": True}
    sup = _supervisor(lambda slot: (False, "连接失败") if state["down"] else (True, ""),
                      recover=calls.append, recover_cooldown=1)
    sup.tick()  # 初始观测即翻 down，翻转 tick 即评估 → 各槽位第 1 次
    assert calls == ["text", "vision"]
    state["down"] = False
    for _ in range(3):  # 防抖期间状态仍 down，恢复继续尝试；翻回 ready 时预算清零
        sup.tick()
    assert sup.snapshot("text")["state"] == supervisor.READY
    before = len(calls)
    state["down"] = True
    for _ in range(3):  # 三次 down 防抖翻转 → 预算已重置，翻转 tick 再次尝试
        sup.tick()
    assert len(calls) == before + 2, "若不重置则 attempts 已达上限转放弃，不会再重启"
    logs = [r.message for r in caplog.records if "模型恢复尝试" in r.message]
    assert logs[-2] == "模型恢复尝试 slot=text attempt=1/3 op=restart"
    assert logs[-1] == "模型恢复尝试 slot=vision attempt=1/3 op=restart"

def test_diagnostics_captured_on_nonready_flip():
    seen = []
    sup = _supervisor(_down_probe(), diagnostics=seen.append)
    for _ in range(4):
        sup.tick()
    assert seen == ["text", "vision"], "初始 ready 不采集，翻转 down 采集"


def test_diagnostics_exception_does_not_break_tick():
    def boom(slot):
        raise RuntimeError("docker 不可达")

    sup = _supervisor(_down_probe(), diagnostics=boom)
    for _ in range(4):
        sup.tick()  # 不抛出即通过
    assert sup.snapshot("text")["state"] == supervisor.DOWN


def test_no_recovery_when_ready():
    calls = []
    sup = _supervisor(lambda slot: (True, ""), recover=calls.append)
    for _ in range(6):
        sup.tick()
    assert calls == []


# --- W3 在飞判定默认实现（假 client，不触网络；隔离铁律） ---


class _StubAxiomClient:
    def __init__(self, *, jobs=None, books=None, job_states=None, list_error=None, books_error=None):
        self._jobs = jobs if jobs is not None else {"jobs": [], "total": 0}
        self._books = books or []
        self._job_states = job_states or {}
        self._list_error = list_error
        self._books_error = books_error

    def list_parse_jobs(self, status=None, limit=50):
        if self._list_error:
            raise self._list_error
        return self._jobs

    def list_books(self):
        if self._books_error:
            raise self._books_error
        return self._books

    def get_parse_job(self, job_id):
        return {"id": job_id, "status": self._job_states.get(str(job_id), "completed")}


def _sup_with_client(client):
    return supervisor.ModelSupervisor(
        _settings(), axiom_client_factory=lambda: client,
        recover=lambda slot: None, diagnostics=lambda slot: None,
        probe_t1=lambda slot: (False, "x"), probe_gpu=lambda slot: None,
    )


def _axiom_err(code):
    from qed_engine.clients.axiom_client import AxiomError

    return AxiomError("stub", status_code=code)


def test_inflight_new_endpoint_jobs_present():
    sup = _sup_with_client(_StubAxiomClient(jobs={"jobs": [{"id": 7, "status": "running"}]}))
    assert sup._default_is_inflight("vision") is True
    sup2 = _sup_with_client(_StubAxiomClient(jobs={"jobs": []}))
    assert sup2._default_is_inflight("vision") is False


def test_inflight_old_code_falls_back_to_active_job_id():
    sup = _sup_with_client(_StubAxiomClient(
        list_error=_axiom_err(404),
        books=[{"book_id": "b1", "active_job_id": 12}, {"book_id": "b2", "active_job_id": None}],
        job_states={"12": "queued"},
    ))
    assert sup._default_is_inflight("vision") is True, "REQ-088 未上线：逐本 active_job_id 单查回退"


def test_inflight_old_code_fallback_all_terminal():
    sup = _sup_with_client(_StubAxiomClient(
        list_error=_axiom_err(404),
        books=[{"book_id": "b1", "active_job_id": 12}],
        job_states={"12": "completed"},
    ))
    assert sup._default_is_inflight("vision") is False


def test_inflight_8902_unreachable_means_not_inflight():
    sup = _sup_with_client(_StubAxiomClient(list_error=_axiom_err(None)))
    assert sup._default_is_inflight("vision") is False, "8902 连不上→不可能有解析在跑，允许恢复"


def test_inflight_server_error_conservative_true():
    sup = _sup_with_client(_StubAxiomClient(list_error=_axiom_err(500)))
    assert sup._default_is_inflight("vision") is True, "无法判定按在飞处理（宁不误杀解析）"


def test_inflight_text_slot_always_false():
    sup = _sup_with_client(_StubAxiomClient(jobs={"jobs": [{"id": 1}]}))
    assert sup._default_is_inflight("text") is False


# --- W3 真机观测补充：事件账落点（create_app 必须给 qed_engine logger 挂 INFO handler） ---


def _marked_handlers():
    import logging

    return [h for h in logging.getLogger("qed_engine").handlers
            if getattr(h, "qed_engine_stream", False)]


def test_create_app_wires_event_log_handler_once(monkeypatch):
    from qed_engine.api import control as api_control
    from qed_engine.api.main import create_app

    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: (True, ""))
    create_app(Settings(_env_file=None, qed_model_supervisor=False))
    create_app(Settings(_env_file=None, qed_model_supervisor=False))
    handlers = _marked_handlers()
    assert len(handlers) == 1, "幂等：多次 create_app 仍恰有一个事件账 handler"
    assert handlers[0].level <= __import__("logging").INFO


def test_supervisor_info_line_reaches_stderr(capsys, monkeypatch):
    from qed_engine.api import control as api_control
    from qed_engine.api.main import create_app

    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: (True, ""))
    create_app(Settings(_env_file=None, qed_model_supervisor=False))
    supervisor.LOG.info("模型监督事件 slot=test-emit")
    captured = capsys.readouterr()
    assert "slot=test-emit" in captured.err, "INFO 事件行不得被静默丢弃（事件账 v1 走 8900 日志）"
