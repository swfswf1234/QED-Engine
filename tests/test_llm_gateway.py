"""
模块职责：LLM 网关（gateway）契约测试：api/local 路由、调用记录字段、失败记录。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：backend/qed_engine/services/llm/gateway.py
"""

from qed_engine.config import Settings
from qed_engine.services.llm import gateway


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_call_text_api_mode(monkeypatch):
    """api 模式：文字走 provider_text_chat（按 QED_API_PROVIDER 解析 base_url/模型）。"""
    captured = {}

    def fake_chat(api_key, model, messages, **kw):
        captured["api_key"] = api_key
        captured["model"] = model
        captured["base_url"] = kw.get("base_url")
        return "API 回答"

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 1

    monkeypatch.setattr(gateway.clients, "provider_text_chat", fake_chat)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_text(
        _settings(qed_api_select="api", api_key="sk-x", qed_model="qwen-max"),
        prompt="你好", prompt_template="t1",
    )
    assert result["reply"] == "API 回答"
    assert result["call_id"] == 1
    assert captured["model"] == "qwen-max"
    assert captured["base_url"] == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert captured["record"]["mode"] == "api"
    assert captured["record"]["provider"] == "qwen"
    assert captured["record"]["model"] == "qwen-max"
    assert captured["record"]["endpoint"] == "text"


def test_call_text_api_provider_routing(monkeypatch):
    """api 模式：QED_API_PROVIDER=deepseek → 解析 deepseek 地址与默认模型。"""
    captured = {}

    def fake_chat(api_key, model, messages, **kw):
        captured["model"] = model
        captured["base_url"] = kw.get("base_url")
        return "DeepSeek 回答"

    def fake_record(settings, **kwargs):
        return 1

    monkeypatch.setattr(gateway.clients, "provider_text_chat", fake_chat)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_text(
        _settings(qed_api_select="api", api_key="sk-x", qed_api_provider="deepseek"),
        prompt="hi",
    )
    assert result["reply"] == "DeepSeek 回答"
    assert captured["model"] == "deepseek-chat"
    assert captured["base_url"] == "https://api.deepseek.com/v1"


def test_call_text_local_mode(monkeypatch):
    """local 模式：先 ensure_text_ready 再走 LM Studio；记录 local/lmstudio。"""
    captured = {}

    def fake_ensure(settings, script_runner=None, log=None):
        captured["ensure"] = True

    def fake_lmstudio(base_url, messages, **kw):
        return "本地回答"

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 2

    monkeypatch.setattr(gateway.model_manager, "ensure_text_ready", fake_ensure)
    monkeypatch.setattr(gateway.clients, "lmstudio_chat", fake_lmstudio)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_text(_settings(qed_api_select="local"), prompt="hi")
    assert result["reply"] == "本地回答"
    assert captured["ensure"] is True
    assert captured["record"]["mode"] == "local"
    assert captured["record"]["provider"] == "lmstudio"


def test_call_text_failure_recorded(monkeypatch):
    """调用失败：仍记录 status=error + error 原因，返回 reply=""。"""
    captured = {}

    def fake_chat(api_key, model, messages, **kw):
        raise RuntimeError("HTTP 429")

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return None

    monkeypatch.setattr(gateway.clients, "provider_text_chat", fake_chat)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_text(_settings(qed_api_select="api", api_key="sk-x"), prompt="p")
    assert result["reply"] == ""
    assert result["success"] is False
    assert captured["record"]["status"] == "error"
    assert "HTTP 429" in captured["record"]["error"]


def test_call_vision_api_mode(monkeypatch):
    """api 模式：视觉走 provider_vision_chat（按 QED_API_PROVIDER 解析），记录 api/供应商/vision。"""
    captured = {}

    def fake_vision(api_key, model, image_base64, prompt, **kw):
        captured["api_key"] = api_key
        captured["model"] = model
        captured["image_base64"] = image_base64
        return "OCR 结果"

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 1

    monkeypatch.setattr(gateway.clients, "provider_vision_chat", fake_vision)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_vision(
        _settings(qed_api_select="api", api_key="sk-x", qed_ocr_model="qwen-vl-max"),
        image_base64="aGVsbG8=",
    )
    assert result["reply"] == "OCR 结果"
    assert result["call_id"] == 1
    assert captured["api_key"] == "sk-x"
    assert captured["model"] == "qwen-vl-max"
    assert captured["record"]["mode"] == "api"
    assert captured["record"]["provider"] == "qwen"
    assert captured["record"]["model"] == "qwen-vl-max"
    assert captured["record"]["endpoint"] == "vision"


def test_call_vision_deepseek_no_vision_model(monkeypatch):
    """api 模式：QED_API_PROVIDER=deepseek 无视觉模型 → 失败 + 明确错误。"""
    captured = {}

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return None

    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_vision(
        _settings(qed_api_select="api", api_key="sk-x", qed_api_provider="deepseek"),
        image_base64="aGVsbG8=",
    )
    assert result["success"] is False
    assert "无视觉模型" in result["error"]
    assert captured["record"]["status"] == "error"


def test_call_vision_local_mode(monkeypatch):
    """local 模式：先 ensure_image_ready 再走 MinerU（PDF）；记录 local/mineru/vision。"""
    captured = {}

    def fake_ensure(settings, script_runner=None, log=None):
        captured["ensure"] = True

    def fake_mineru(base_url, file_bytes, filename, **kw):
        captured["filename"] = filename
        return "## 标题\n正文"

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 2

    monkeypatch.setattr(gateway.model_manager, "ensure_image_ready", fake_ensure)
    monkeypatch.setattr(gateway.clients, "mineru_parse", fake_mineru)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_vision(
        _settings(qed_api_select="local"),
        pdf_bytes=b"pdf",
        pdf_filename="a.pdf",
    )
    assert "标题" in result["reply"]
    assert captured["ensure"] is True
    assert captured["filename"] == "a.pdf"
    assert captured["record"]["mode"] == "local"
    assert captured["record"]["provider"] == "mineru"
    assert captured["record"]["endpoint"] == "vision"


def test_call_vision_local_requires_pdf(monkeypatch):
    """local 模式无 pdf_bytes：明确错误，失败记录 status=error。"""
    captured = {}

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return None

    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_vision(_settings(qed_api_select="local"), image_base64="aGVsbG8=")
    assert result["success"] is False
    assert "PDF" in result["error"]
    assert captured["record"]["status"] == "error"
    assert captured["record"]["provider"] == "gateway"


# ---------- 超时与 max_tokens 透传（REQ-061：网关必须向上游透传，不得静默丢弃） ----------


def test_call_text_api_passes_timeout_and_max_tokens(monkeypatch):
    """api 模式：timeout 取 QED_LLM_TIMEOUT 配置、max_tokens 透传 provider_text_chat。"""
    captured = {}

    def fake_chat(api_key, model, messages, base_url=None, timeout=None, max_tokens=None):
        captured["timeout"] = timeout
        captured["max_tokens"] = max_tokens
        return "ok"

    def fake_record(settings, **kwargs):
        return 1

    monkeypatch.setattr(gateway.clients, "provider_text_chat", fake_chat)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    settings = _settings(qed_api_select="api", api_key="sk-x", qed_llm_timeout=120.0)
    result = gateway.call_text(settings, prompt="hi", max_tokens=2048)
    assert result["success"] is True
    assert captured["timeout"] == 120.0
    assert captured["max_tokens"] == 2048


def test_call_text_local_passes_timeout_and_max_tokens(monkeypatch):
    """local 模式：timeout/max_tokens 同样透传 lmstudio_chat（不因本地模式丢失）。"""
    captured = {}

    def fake_lmstudio(base_url, messages, timeout=None, max_tokens=None, **kw):
        captured["timeout"] = timeout
        captured["max_tokens"] = max_tokens
        return "ok"

    def fake_ensure(settings, script_runner=None, log=None):
        pass

    def fake_record(settings, **kwargs):
        return 1

    monkeypatch.setattr(gateway.model_manager, "ensure_text_ready", fake_ensure)
    monkeypatch.setattr(gateway.clients, "lmstudio_chat", fake_lmstudio)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    settings = _settings(qed_api_select="local", qed_llm_timeout=90.0)
    result = gateway.call_text(settings, prompt="hi", max_tokens=512)
    assert result["success"] is True
    assert captured["timeout"] == 90.0
    assert captured["max_tokens"] == 512


def test_call_text_default_timeout_from_settings(monkeypatch):
    """未显式配置时：timeout 使用 Settings 默认值（300s）。"""
    captured = {}

    def fake_chat(api_key, model, messages, base_url=None, timeout=None, max_tokens=None):
        captured["timeout"] = timeout
        return "ok"

    def fake_record(settings, **kwargs):
        return 1

    monkeypatch.delenv("QED_LLM_TIMEOUT", raising=False)
    monkeypatch.setattr(gateway.clients, "provider_text_chat", fake_chat)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_text(_settings(qed_api_select="api", api_key="sk-x"), prompt="hi")
    assert result["success"] is True
    assert captured["timeout"] == 300.0


def test_call_vision_passes_timeout_and_max_tokens(monkeypatch):
    """api 模式视觉：timeout/max_tokens 透传 provider_vision_chat（REQ-061 一并纳入）。"""
    captured = {}

    def fake_vision(api_key, model, image_base64, prompt, base_url=None, timeout=None, max_tokens=None):
        captured["timeout"] = timeout
        captured["max_tokens"] = max_tokens
        return "ok"

    def fake_record(settings, **kwargs):
        return 1

    monkeypatch.setattr(gateway.clients, "provider_vision_chat", fake_vision)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    settings = _settings(qed_api_select="api", api_key="sk-x", qed_llm_timeout=150.0)
    result = gateway.call_vision(settings, image_base64="aGVsbG8=", max_tokens=256)
    assert result["success"] is True
    assert captured["timeout"] == 150.0
    assert captured["max_tokens"] == 256
