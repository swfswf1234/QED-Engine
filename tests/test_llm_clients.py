"""
模块职责：LLM 供应商客户端契约测试：多厂商文字/视觉（OpenAI 兼容）、LM Studio、MinerU。
设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：In Progress
被测代码：backend/qed_engine/services/llm/clients.py
"""

import httpx
import pytest
from qed_engine.services.llm import clients


def _mock_client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_provider_text_chat_ok():
    """多厂商文字：POST /chat/completions，返回 choices[0].message.content。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/chat/completions")
        assert request.headers["Authorization"] == "Bearer sk-test"
        return httpx.Response(200, json={
            "choices": [{"message": {"content": "回答内容"}}],
        })

    with _mock_client(handler) as client:
        reply = clients.provider_text_chat(
            api_key="sk-test", model="qwen-plus", messages=[{"role": "user", "content": "你好"}],
            client=client,
        )
    assert reply == "回答内容"


def test_provider_text_chat_http_error():
    """多厂商文字：非 200 抛 RuntimeError（含状态码）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={})

    with _mock_client(handler) as client:
        with pytest.raises(RuntimeError, match="429"):
            clients.provider_text_chat(api_key="sk", model="m", messages=[], client=client)


def test_lmstudio_chat_uses_first_loaded_model(monkeypatch):
    """LM Studio：model 为空时探测 /v1/models 取第一个已加载模型。"""

    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path.endswith("/models"):
            return httpx.Response(200, json={"data": [{"id": "qwen3-8b"}]})
        return httpx.Response(200, json={"choices": [{"message": {"content": "本地回答"}}]})

    with _mock_client(handler) as client:
        reply = clients.lmstudio_chat(
            base_url="http://127.0.0.1:5001/v1", messages=[{"role": "user", "content": "hi"}],
            client=client,
        )
    assert reply == "本地回答"
    assert "/models" in calls[0]


def test_provider_vision_chat_sends_image():
    """多厂商视觉：请求体含 image_url data URI（base64 图片）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.read().decode("utf-8")
        assert "data:image/png;base64," in body
        return httpx.Response(200, json={"choices": [{"message": {"content": "OCR 结果"}}]})

    with _mock_client(handler) as client:
        reply = clients.provider_vision_chat(
            api_key="sk-test", model="qwen-vl-plus",
            image_base64="aGVsbG8=", prompt="识别内容", client=client,
        )
    assert reply == "OCR 结果"


def test_mineru_parse_polls_result():
    """MinerU：POST /file_parse 提交 → GET /get_task_results 轮询 → markdown。"""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/file_parse"):
            return httpx.Response(200, json={"task_id": "t-1"})
        return httpx.Response(200, json={
            "code": 200,
            "data": {"state": "done", "full_zip_url": "", "markdown": "## 标题\n正文"},
        })

    with _mock_client(handler) as client:
        reply = clients.mineru_parse(
            base_url="http://127.0.0.1:8002",
            file_bytes=b"pdf-bytes", filename="a.pdf", client=client,
            poll_interval=0.01, max_wait=1.0,
        )
    assert "标题" in reply


# ---------- max_tokens 透传（REQ-061：payload 非 None 时必须含 max_tokens） ----------


def test_provider_text_chat_sends_max_tokens():
    """多厂商文字：max_tokens 非 None 时写入请求体。"""
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(request.read().decode("utf-8"))
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    with _mock_client(handler) as client:
        clients.provider_text_chat(
            api_key="sk", model="m", messages=[{"role": "user", "content": "hi"}],
            client=client, max_tokens=1024,
        )
    assert '"max_tokens":1024' in bodies[0].replace(" ", "").replace("\n", "")


def test_provider_text_chat_omits_max_tokens_when_none():
    """多厂商文字：max_tokens 为 None 时请求体不含该键（不发送 null）。"""
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(request.read().decode("utf-8"))
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    with _mock_client(handler) as client:
        clients.provider_text_chat(api_key="sk", model="m", messages=[], client=client)
    assert "max_tokens" not in bodies[0]


def test_lmstudio_chat_sends_max_tokens():
    """LM Studio：max_tokens 非 None 时写入请求体（显式指定 model 免探测）。"""
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(request.read().decode("utf-8"))
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    with _mock_client(handler) as client:
        clients.lmstudio_chat(
            base_url="http://127.0.0.1:5001/v1", messages=[{"role": "user", "content": "hi"}],
            model="qwen3-8b", client=client, max_tokens=512,
        )
    assert '"max_tokens":512' in bodies[0].replace(" ", "").replace("\n", "")


def test_provider_vision_chat_sends_max_tokens():
    """多厂商视觉：max_tokens 非 None 时写入请求体。"""
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(request.read().decode("utf-8"))
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    with _mock_client(handler) as client:
        clients.provider_vision_chat(
            api_key="sk", model="qwen-vl-plus", image_base64="aGVsbG8=", prompt="识别",
            client=client, max_tokens=256,
        )
    assert '"max_tokens":256' in bodies[0].replace(" ", "").replace("\n", "")


# ---------- 厂商注册表解析（resolve_text / resolve_vision） ----------


def test_resolve_text_provider_default_when_unset():
    """resolve_text：configured_model 空 → 厂商默认模型与地址。"""
    base_url, model = clients.resolve_text("qwen", "")
    assert base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert model == "qwen-plus"


def test_resolve_text_explicit_model_preferred():
    """resolve_text：显式配置模型优先于厂商默认。"""
    base_url, model = clients.resolve_text("qwen", "qwen-max")
    assert model == "qwen-max"
    assert base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"


def test_resolve_text_deepseek_defaults():
    """resolve_text：deepseek 用其专属地址与默认模型。"""
    base_url, model = clients.resolve_text("deepseek", "")
    assert base_url == "https://api.deepseek.com/v1"
    assert model == "deepseek-chat"


def test_resolve_text_glm_defaults():
    """resolve_text：glm 用其专属地址与默认模型。"""
    base_url, model = clients.resolve_text("glm", "")
    assert base_url == "https://open.bigmodel.cn/api/paas/v4"
    assert model == "glm-4-plus"


def test_resolve_vision_qwen_provider_default():
    """resolve_vision：qwen 有视觉，用厂商默认视觉模型。"""
    base_url, model = clients.resolve_vision("qwen", "")
    assert base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert model == "qwen-vl-plus"


def test_resolve_vision_explicit_model_preferred():
    """resolve_vision：显式配置模型优先于厂商默认。"""
    base_url, model = clients.resolve_vision("qwen", "qwen-vl-max")
    assert model == "qwen-vl-max"
    assert base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"


def test_resolve_vision_deepseek_none():
    """resolve_vision：deepseek 无视觉 → None。"""
    assert clients.resolve_vision("deepseek", "") is None
