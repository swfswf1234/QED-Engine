"""
模块职责：LLM 网关（gateway）契约测试：api/local 路由、调用记录字段、失败记录。
设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
被测代码：backend/qed_engine/services/llm/gateway.py
"""

import pytest
from qed_engine.config import Settings
from qed_engine.services.llm import gateway
from qed_engine.services.llm import registry as llm_registry


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


@pytest.fixture(autouse=True)
def _isolate_manifest(tmp_path, monkeypatch):
    """隔离运行态 manifest：默认指向空临时目录（避免读真实 model/<槽位>/manifest.json）。"""
    monkeypatch.setattr(llm_registry, "MANIFEST_ROOT", tmp_path)
    return tmp_path


def test_call_text_api_mode(monkeypatch):
    """api 模式：文字走 provider_text_chat（身份 api 引用解析 base_url/模型）。"""
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
        _settings(qed_api_select="api", api_key="sk-x"),
        prompt="你好", prompt_template="t1",
    )
    assert result["reply"] == "API 回答"
    assert result["call_id"] == 1
    assert captured["model"] == "qwen-plus"  # 默认身份 qwen-plus 的 api 引用
    assert captured["base_url"] == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert captured["record"]["mode"] == "api"
    assert captured["record"]["provider"] == "qwen"
    assert captured["record"]["model"] == "qwen-plus"
    assert captured["record"]["endpoint"] == "text"


def test_call_text_api_provider_fallback_routing(monkeypatch):
    """api 模式：身份无 api 引用（qwen3.8-27b）→ 回退 QED_API_PROVIDER 厂商默认模型。"""
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
        _settings(qed_api_select="api", api_key="sk-x",
                  qed_api_provider="deepseek", qed_model="qwen3.8-27b"),
        prompt="hi",
    )
    assert result["reply"] == "DeepSeek 回答"
    assert captured["model"] == "deepseek-chat"
    assert captured["base_url"] == "https://api.deepseek.com/v1"


def test_call_text_local_mode(monkeypatch):
    """local 模式：先 ensure_local_ready(text) 再走本地 OpenAI 兼容调用（带 LM Studio token 与显式模型）。"""
    captured = {}

    def fake_ensure(settings, slot, script_runner=None, log=None):
        captured["ensure_slot"] = slot

    def fake_qwen(base_url, messages, **kw):
        captured["base_url"] = base_url
        captured["model"] = kw.get("model")
        captured["api_key"] = kw.get("api_key")
        return "本地回答"

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 2

    monkeypatch.setattr(gateway.model_manager, "ensure_local_ready", fake_ensure)
    monkeypatch.setattr(gateway.clients, "qwen_chat", fake_qwen)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_text(
        _settings(qed_api_select="local", qed_lmstudio_token="lm-secret"), prompt="hi",
    )
    assert result["reply"] == "本地回答"
    assert captured["ensure_slot"] == "text"
    assert captured["base_url"] == "http://127.0.0.1:5001/v1"
    assert captured["model"] == "qwen3.8-27b"  # 注册表本地引用（LM Studio 实际模型 id）
    assert captured["api_key"] == "lm-secret"
    assert captured["record"]["mode"] == "local"
    assert captured["record"]["provider"] == "lmstudio"
    assert captured["record"]["model"] == "qwen3.8-27b"


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
    """api 模式：视觉走 provider_vision_chat（身份 api 引用解析），记录 api/供应商/vision。"""
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
        _settings(qed_api_select="api", api_key="sk-x"),
        image_base64="aGVsbG8=",
    )
    assert result["reply"] == "OCR 结果"
    assert result["call_id"] == 1
    assert captured["api_key"] == "sk-x"
    assert captured["model"] == "qwen-vl-plus"
    assert captured["record"]["mode"] == "api"
    assert captured["record"]["provider"] == "qwen"
    assert captured["record"]["model"] == "qwen-vl-plus"
    assert captured["record"]["endpoint"] == "vision"


def test_call_vision_deepseek_no_vision_model(monkeypatch):
    """api 模式：身份无 api 引用（mineru）+ QED_API_PROVIDER=deepseek 无视觉端点 → 失败。"""
    captured = {}

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return None

    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_vision(
        _settings(qed_api_select="api", api_key="sk-x",
                  qed_api_provider="deepseek", qed_ocr_model="mineru"),
        image_base64="aGVsbG8=",
    )
    assert result["success"] is False
    assert "无该槽位" in result["error"]
    assert captured["record"]["status"] == "error"


def test_call_vision_local_mode(monkeypatch):
    """local 模式：先 ensure_local_ready(vision) 再走 MinerU（PDF）；记录 local/mineru/vision。"""
    captured = {}

    def fake_ensure(settings, slot, script_runner=None, log=None):
        captured["ensure_slot"] = slot

    def fake_mineru(base_url, file_bytes, filename, **kw):
        captured["filename"] = filename
        return "## 标题\n正文"

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 2

    monkeypatch.setattr(gateway.model_manager, "ensure_local_ready", fake_ensure)
    monkeypatch.setattr(gateway.clients, "mineru_parse", fake_mineru)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_vision(
        _settings(qed_api_select="local"),
        pdf_bytes=b"pdf",
        pdf_filename="a.pdf",
    )
    assert "标题" in result["reply"]
    assert captured["ensure_slot"] == "vision"
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
    """local 模式：timeout/max_tokens 同样透传 qwen_chat（不因本地模式丢失）。"""
    captured = {}

    def fake_qwen(base_url, messages, timeout=None, max_tokens=None, **kw):
        captured["timeout"] = timeout
        captured["max_tokens"] = max_tokens
        return "ok"

    def fake_ensure(settings, slot, script_runner=None, log=None):
        pass

    def fake_record(settings, **kwargs):
        return 1

    monkeypatch.setattr(gateway.model_manager, "ensure_local_ready", fake_ensure)
    monkeypatch.setattr(gateway.clients, "qwen_chat", fake_qwen)
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


# ---------- 向量槽位（PLAN-046：/llm/embedding 数据源，仅 api） ----------


def test_call_embedding_api_mode(monkeypatch):
    """向量调用：provider_embeddings 返回向量；记录 endpoint=embedding + 维度摘要。"""
    captured = {}

    def fake_embeddings(api_key, model, input_texts, **kw):
        captured["api_key"] = api_key
        captured["model"] = model
        captured["input_texts"] = input_texts
        captured["base_url"] = kw.get("base_url")
        return [[0.1, 0.2], [0.3, 0.4]]

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 3

    monkeypatch.setattr(gateway.clients, "provider_embeddings", fake_embeddings)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_embedding(
        _settings(qed_api_select="api", api_key="sk-x"),
        input_texts=["你好", "世界"],
    )
    assert result["success"] is True
    assert result["embeddings"] == [[0.1, 0.2], [0.3, 0.4]]
    assert result["call_id"] == 3
    assert captured["model"] == "text-embedding-v4"
    assert captured["base_url"] == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert captured["record"]["endpoint"] == "embedding"
    assert captured["record"]["provider"] == "qwen"
    assert captured["record"]["status"] == "success"
    assert "2 vectors" in captured["record"]["response"]
    assert "dim=2" in captured["record"]["response"]
    assert "[0.1, 0.2]" not in captured["record"]["response"]  # 不存向量本体


def test_call_embedding_local_mode_still_api(monkeypatch):
    """向量槽位无本地候选：全局 local 模式仍走 api（不报错），记录 mode=api。"""
    captured = {}

    def fake_embeddings(api_key, model, input_texts, **kw):
        captured["model"] = model
        return [[0.1, 0.2]]

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 9

    monkeypatch.setattr(gateway.clients, "provider_embeddings", fake_embeddings)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_embedding(
        _settings(qed_api_select="local", api_key="sk-x"), input_texts=["hi"])
    assert result["success"] is True
    assert captured["model"] == "text-embedding-v4"
    assert captured["record"]["mode"] == "api"
    assert captured["record"]["endpoint"] == "embedding"


def test_call_embedding_failure_recorded(monkeypatch):
    """上游失败：仍记录 status=error + 中文原因，返回空向量。"""
    captured = {}

    def fake_embeddings(api_key, model, input_texts, **kw):
        raise RuntimeError("HTTP 429")

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return None

    monkeypatch.setattr(gateway.clients, "provider_embeddings", fake_embeddings)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_embedding(
        _settings(qed_api_select="api", api_key="sk-x"), input_texts=["hi"])
    assert result["success"] is False
    assert result["embeddings"] == []
    assert "HTTP 429" in captured["record"]["error"]
