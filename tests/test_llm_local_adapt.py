"""
模块职责：M3 本地模型适配层（A-1 能力表 / A-3 JSON 容错 / A-4 thinking 清洗）契约测试。
设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
被测代码：backend/qed_engine/services/llm/local_adapt.py
"""

import pytest
from qed_engine.api import schemas
from qed_engine.config import Settings
from qed_engine.services.llm import clients, gateway, local_adapt
from qed_engine.services.llm import registry as llm_registry


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


@pytest.fixture(autouse=True)
def _isolate_adapt_state(monkeypatch, tmp_path):
    """隔离适配层进程态拉黑清单与运行态 manifest 根（不读真实 model/）。"""
    local_adapt.clear_blacklist()
    monkeypatch.setattr(llm_registry, "MANIFEST_ROOT", tmp_path)
    yield
    local_adapt.clear_blacklist()


@pytest.fixture(autouse=True)
def _mock_record(monkeypatch):
    """网关调用记录降级为 no-op（隔离测试不触库）。"""
    monkeypatch.setattr(gateway.call_log, "record_call", lambda settings, **kwargs: 1)


# --- A-1 能力表（探测兜底归 A-2 轮，本批硬编码表）---

def test_local_runtime_capability_table():
    """本地后端（lmstudio/llamacpp/docker/ollama）能力表：无工具、无原生结构化输出。"""
    for runtime in ("lmstudio", "llamacpp", "docker", "ollama"):
        caps = local_adapt.capabilities_for("local", runtime)
        assert caps.supports_tools is False
        assert caps.supports_json_mode is None  # 未知：乐观尝试 + 失败拉黑（A-1 探测兜底口径）
        assert caps.scratchpad_tags == ("think",)


def test_api_channel_capability_table():
    """api 渠道：工具与 JSON 模式按端点能力表（dashscope 兼容模式两者均支持）。"""
    caps = local_adapt.capabilities_for("api", "qwen")
    assert caps.supports_tools is True
    assert caps.supports_json_mode is True


def test_supports_tools_false_for_local():
    assert local_adapt.supports_tools("local", "lmstudio") is False
    assert local_adapt.supports_tools("local", "ollama") is False
    assert local_adapt.supports_tools("api", "qwen") is True


# --- A-3 JSON 容错三件套 + 一次 repair ---

def test_parse_json_plain_and_fenced():
    assert local_adapt.parse_json_reply('{"a": 1}') == {"a": 1}
    assert local_adapt.parse_json_reply('说明文字\n```json\n{"a": 1}\n```\n尾巴') == {"a": 1}


def test_parse_json_slice_outermost():
    assert local_adapt.parse_json_reply('前置噪声 {"a": {"b": 2}} 后置噪声') == {"a": {"b": 2}}


def test_parse_json_repair_trailing_comma():
    assert local_adapt.parse_json_reply('{"a": [1, 2,],}') == {"a": [1, 2]}


def test_parse_json_repair_callback_once():
    calls = []

    def repair(raw: str) -> str:
        calls.append(raw)
        return '{"ok": true}'

    assert local_adapt.parse_json_reply("完全不是 json", repair=repair) == {"ok": True}
    assert len(calls) == 1  # 三件套失败后一次 repair，不循环


def test_parse_json_repair_callback_failure_still_raises():
    with pytest.raises(local_adapt.JsonParseError):
        local_adapt.parse_json_reply("彻底坏了", repair=lambda raw: "还是坏")


def test_parse_json_error_keeps_raw():
    with pytest.raises(local_adapt.JsonParseError) as exc:
        local_adapt.parse_json_reply("彻底坏了")
    assert "彻底坏了" in exc.value.raw
    assert "彻底坏了" in str(exc.value)


# --- A-3 response_format 注入与运行时拉黑（gateway 集成，假 client）---

def _capture_chat(monkeypatch, exc=None):
    captured = []

    def fake_chat(**kwargs):
        if exc:
            raise exc
        captured.append(kwargs.get("response_format"))
        return '{"ok": true}'

    monkeypatch.setattr(gateway.clients, "qwen_chat", fake_chat)
    monkeypatch.setattr(gateway.clients, "provider_text_chat", fake_chat)
    return captured


LOCAL = dict(qed_api_select="local", qed_model="qwen3.5-9b")


def test_local_json_call_injects_response_format(monkeypatch):
    captured = _capture_chat(monkeypatch)
    result = gateway.call_text(_settings(**LOCAL), prompt="生成", response_format="json")
    assert result["success"] is True
    assert captured == [{"type": "json_object"}]


def test_local_adapt_disabled_drops_response_format(monkeypatch):
    captured = _capture_chat(monkeypatch)
    result = gateway.call_text(
        _settings(**LOCAL, qed_llm_local_adapt=False), prompt="生成", response_format="json")
    assert result["success"] is True
    assert captured == [None]  # 整体关闭 = 现行为透传（不注入）


def test_api_channel_never_injects(monkeypatch):
    captured = _capture_chat(monkeypatch)
    result = gateway.call_text(
        _settings(qed_api_select="api", api_key="sk-x"), prompt="生成", response_format="json")
    assert result["success"] is False  # api 渠道拒绝该参数（不静默丢弃），且不发起上游调用
    assert "api 渠道" in result["error"]
    assert captured == []


def test_blacklist_suppresses_response_format(monkeypatch):
    captured = _capture_chat(monkeypatch)
    local_adapt.blacklist("lmstudio", "qwen/qwen3.5-9b")
    gateway.call_text(_settings(**LOCAL), prompt="生成", response_format="json")
    assert captured == [None]


def test_json_mode_unsupported_retries_without_format(monkeypatch):
    calls = []

    def flaky_chat(**kwargs):
        calls.append(kwargs.get("response_format"))
        if kwargs.get("response_format"):
            raise local_adapt.JsonModeUnsupported("上游不认识 response_format")
        return '{"ok": true}'

    monkeypatch.setattr(gateway.clients, "qwen_chat", flaky_chat)
    result = gateway.call_text(_settings(**LOCAL), prompt="生成", response_format="json")
    assert result["success"] is True
    assert calls == [{"type": "json_object"}, None]  # 一次重试剥参数
    assert local_adapt.is_blacklisted("lmstudio", "qwen/qwen3.5-9b")
    # 拉黑生效：后续调用不再带 response_format
    calls.clear()
    gateway.call_text(_settings(**LOCAL), prompt="再生成", response_format="json")
    assert calls == [None]


def test_json_mode_unsupported_retried_only_once_when_disabled(monkeypatch):
    calls = []

    def always_fails(**kwargs):
        calls.append(kwargs.get("response_format"))
        raise local_adapt.JsonModeUnsupported("始终失败")

    monkeypatch.setattr(gateway.clients, "qwen_chat", always_fails)
    result = gateway.call_text(
        _settings(**LOCAL, qed_llm_local_adapt=False), prompt="生成", response_format="json")
    assert result["success"] is False
    assert len(calls) == 1  # 关闭态不重试、不拉黑（原样报错）


# --- A-4 thinking/scratchpad 清洗 ---

OPEN = "<" + "think>"
CLOSE = "</" + "think>"


def test_scrub_pair_and_unclosed():
    assert local_adapt.scrub_thinking(OPEN + "推理段落" + CLOSE + "正文") == "正文"
    assert local_adapt.scrub_thinking(OPEN + "推理到文末未闭合") == ""
    assert local_adapt.scrub_thinking("正文" + CLOSE) == "正文"


def test_parse_json_scrubs_unclosed_thinking_prefix():
    raw = OPEN + "较长推理段未闭合（正文紧跟）" + '{"a": 1}'
    assert local_adapt.parse_json_reply(raw) == {"a": 1}


# --- A-5 截断/空正文判失败 + 饥饿降档单次重试（J-A5a~d，REQ-102 W5 取证驱动）---


def _stub_local_chat(monkeypatch, replies):
    """local 文字调用按队列返回 ChatReply，并记录每次调用 kwargs（降档重试判据）。"""
    calls: list[dict] = []
    queue = list(replies)

    def fake_chat(**kwargs):
        calls.append(kwargs)
        return queue.pop(0) if queue else clients.ChatReply("")

    monkeypatch.setattr(gateway.clients, "qwen_chat", fake_chat)
    return calls


def _recorded_rows(monkeypatch):
    rows: list[dict] = []
    monkeypatch.setattr(
        gateway.call_log, "record_call",
        lambda settings, **kwargs: rows.append(kwargs) or 1)
    return rows


STARVED = clients.ChatReply("", finish_reason="length", reasoning_content="思考段吃满预算")


def test_starved_empty_body_reports_failure(monkeypatch):
    """J-A5a：正文空 + finish_reason=length → success=false，错误含截断判据，记录记 error。"""
    calls = _stub_local_chat(monkeypatch, [STARVED, STARVED])
    rows = _recorded_rows(monkeypatch)
    result = gateway.call_text(_settings(**LOCAL), prompt="生成", response_format="json")
    assert result["success"] is False
    assert "finish_reason=length" in result["error"]
    assert "思考截断" in result["error"]
    assert rows[-1]["status"] == "error"
    assert len(calls) == 2  # 原始一次 + 降档一次，不再盲发第三次


def test_starved_retry_once_with_lowered_effort(monkeypatch):
    """J-A5c：判定饥饿后按降档参数重试一次，重试正文可用即成功。

    档位取 `none`：2026-10-07 真机 A/B（`tmp/w5_probe_effort_ab.py`）证 `low` 不降思考段
    （reasoning 3431 字仍 finish=length），`none` 才直出正文（finish=stop）。
    """
    calls = _stub_local_chat(
        monkeypatch, [STARVED, clients.ChatReply('{"ok": true}', finish_reason="stop")])
    result = gateway.call_text(_settings(**LOCAL), prompt="生成", response_format="json")
    assert result["success"] is True
    assert result["reply"] == '{"ok": true}'
    assert len(calls) == 2
    assert calls[0].get("reasoning_effort") is None
    assert calls[1]["reasoning_effort"] == "none"


def test_truncated_body_with_length_finish_not_accepted(monkeypatch):
    """J-A5a：正文非空但 finish_reason=length 同样按失败返回（截断正文不得作结构化输入）。"""
    calls = _stub_local_chat(
        monkeypatch, [clients.ChatReply('{"a": [1,', finish_reason="length")])
    result = gateway.call_text(_settings(**LOCAL), prompt="生成", response_format="json")
    assert result["success"] is False
    assert "finish_reason=length" in result["error"]
    assert len(calls) == 1  # 截断正文不属饥饿形状，不追发降档调用


def test_blank_content_without_length_finish_still_fails(monkeypatch):
    """J-A5d：空正文一律不得记 success（与 finish_reason 无关）。"""
    _stub_local_chat(monkeypatch, [clients.ChatReply("   ", finish_reason="stop")])
    result = gateway.call_text(_settings(**LOCAL), prompt="生成")
    assert result["success"] is False
    assert "正文为空" in result["error"]


def test_adapt_disabled_starved_reports_failure_without_retry(monkeypatch):
    """J-A5d：QED_LLM_LOCAL_ADAPT=false 时降档重试旁路，但空正文仍不记 success。"""
    calls = _stub_local_chat(monkeypatch, [STARVED])
    rows = _recorded_rows(monkeypatch)
    result = gateway.call_text(
        _settings(**LOCAL, qed_llm_local_adapt=False), prompt="生成", response_format="json")
    assert result["success"] is False
    assert len(calls) == 1
    assert rows[-1]["status"] == "error"


def test_api_channel_blank_content_not_success(monkeypatch):
    """api 渠道同规则：空正文不记 success，且不经网关降档重试（降档只作用本地渠道）。"""
    calls: list[dict] = []

    def fake_chat(**kwargs):
        calls.append(kwargs)
        return clients.ChatReply("", finish_reason="stop")

    monkeypatch.setattr(gateway.clients, "provider_text_chat", fake_chat)
    rows = _recorded_rows(monkeypatch)
    result = gateway.call_text(_settings(qed_api_select="api", api_key="sk-x"), prompt="hi")
    assert result["success"] is False
    assert len(calls) == 1  # api 渠道不追发降档调用
    assert rows[-1]["status"] == "error"


def test_gateway_internal_surface_keeps_truncation_fields(monkeypatch):
    """J-A5b：网关内部返回面携带 finish_reason/reasoning，供清洗与饥饿判定消费。"""
    _stub_local_chat(
        monkeypatch, [clients.ChatReply("正文", finish_reason="stop", reasoning_content="思考段")])
    result = gateway.call_text(_settings(**LOCAL), prompt="生成")
    assert result["success"] is True
    assert result["finish_reason"] == "stop"
    assert result["reasoning"] == "思考段"


def test_llm_text_endpoint_does_not_expose_truncation_fields():
    """J-A5b：`/llm/text` 对外字段不扩（截断判据只到网关内部面）。"""
    assert not {"finish_reason", "reasoning"} & set(schemas.LlmCallResponse.model_fields)


def test_reasoning_starved_detection():
    assert local_adapt.is_reasoning_starved(OPEN + "全部推理" + CLOSE) is True
    assert local_adapt.is_reasoning_starved(OPEN + "推理" + CLOSE + "正文") is False
    assert local_adapt.is_reasoning_starved("") is False  # 空回复不算饥饺（另有错误路径）
    # J-A5b：正文空＋思考段在另一字段＝饥饿（旧口径只看单字段，判不出该形状）
    assert local_adapt.is_reasoning_starved("", reasoning="一段吃满预算的思考") is True

