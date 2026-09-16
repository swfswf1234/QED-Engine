"""LLM 供应商客户端：多厂商（qwen/deepseek/glm 注册表路由）、Qwen（OpenAI 兼容）、MinerU。

全部函数接受可注入 httpx.Client（测试用 MockTransport）；网络/HTTP 异常映射为
RuntimeError（中文原因 + 状态码），由 gateway 层捕获并记录。

设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：In Progress
关联测试：tests/test_llm_clients.py
"""

import time

import httpx

# 客户端级兜底超时（仅直接调用 client 函数时生效）；网关一律透传 Settings.qed_llm_timeout
# （env QED_LLM_TIMEOUT，默认 300s——REQ-061：60s 对长生成不够）。
DEFAULT_TIMEOUT = 60.0

# 厂商注册表：api 模式路由的唯一事实源（地址/默认模型；deepseek/glm 为预留）。
# 视觉能力仅 qwen/glm（vision_base_url 非空）；deepseek 无视觉。
PROVIDERS: dict[str, dict] = {
    "qwen": {
        "label": "阿里百炼",
        "text_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "vision_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "text_default_model": "qwen-plus",
        "vision_default_model": "qwen-vl-plus",
    },
    "deepseek": {
        "label": "DeepSeek",
        "text_base_url": "https://api.deepseek.com/v1",
        "vision_base_url": None,
        "text_default_model": "deepseek-chat",
        "vision_default_model": None,
    },
    "glm": {
        "label": "智谱",
        "text_base_url": "https://open.bigmodel.cn/api/paas/v4",
        "vision_base_url": "https://open.bigmodel.cn/api/paas/v4",
        "text_default_model": "glm-4-plus",
        "vision_default_model": "glm-4v-plus",
    },
}


def resolve_text(provider: str, configured_model: str) -> tuple[str, str]:
    """返回 (base_url, model)：显式配置模型优先，否则用厂商默认。"""
    spec = PROVIDERS[provider]
    model = configured_model or spec["text_default_model"]
    return spec["text_base_url"], model


def resolve_vision(provider: str, configured_model: str) -> tuple[str, str] | None:
    """返回 (base_url, model)；厂商无视觉（deepseek）返回 None。"""
    spec = PROVIDERS[provider]
    if not spec.get("vision_base_url"):
        return None
    model = configured_model or spec["vision_default_model"]
    return spec["vision_base_url"], model


def _post_json(client: httpx.Client, url: str, headers: dict, payload: dict) -> dict:
    try:
        response = client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise RuntimeError(f"模型调用失败：{type(exc).__name__}") from exc
    if response.status_code != 200:
        raise RuntimeError(f"模型调用失败：HTTP {response.status_code}")
    return response.json()


def _extract_content(data: dict) -> str:
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("模型响应格式异常（缺 choices[0].message.content）") from exc


def provider_text_chat(
    api_key: str,
    model: str,
    messages: list[dict],
    client: httpx.Client | None = None,
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1",
    timeout: float = DEFAULT_TIMEOUT,
    max_tokens: int | None = None,
) -> str:
    """多厂商文字对话（OpenAI 兼容 chat/completions），base_url 由注册表解析后传入。

    max_tokens 非 None 时写入请求体（REQ-061：网关透传，不再静默丢弃）。
    """
    own = client is None
    http = client or httpx.Client(timeout=timeout)
    try:
        payload: dict = {"model": model, "messages": messages}
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        data = _post_json(
            http,
            f"{base_url.rstrip('/')}/chat/completions",
            {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            payload,
        )
        return _extract_content(data)
    finally:
        if own:
            http.close()


def qwen_chat(
    base_url: str,
    messages: list[dict],
    client: httpx.Client | None = None,
    model: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    max_tokens: int | None = None,
) -> str:
    """Qwen 本地文字（OpenAI 兼容）；model 为空时取 /v1/models 第一个已加载模型。

    max_tokens 非 None 时写入请求体（REQ-061：网关透传）。
    """
    own = client is None
    http = client or httpx.Client(timeout=timeout)
    try:
        if not model:
            response = http.get(f"{base_url.rstrip('/')}/models")
            if response.status_code != 200:
                raise RuntimeError(f"Qwen 模型列表获取失败：HTTP {response.status_code}")
            models = [item.get("id", "") for item in response.json().get("data", []) if isinstance(item, dict)]
            if not models:
                raise RuntimeError("Qwen 未加载任何模型（请先加载 qwen 模型）")
            model = models[0]
        payload: dict = {"model": model, "messages": messages}
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        data = _post_json(
            http,
            f"{base_url.rstrip('/')}/chat/completions",
            {"Content-Type": "application/json"},
            payload,
        )
        return _extract_content(data)
    finally:
        if own:
            http.close()


def provider_vision_chat(
    api_key: str,
    model: str,
    image_base64: str,
    prompt: str,
    client: httpx.Client | None = None,
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1",
    timeout: float = DEFAULT_TIMEOUT,
    max_tokens: int | None = None,
) -> str:
    """多厂商视觉（OCR）：图片 base64 以 data URI 形式随对话发送，base_url 由注册表解析后传入。

    max_tokens 非 None 时写入请求体（REQ-061：网关透传）。
    """
    own = client is None
    http = client or httpx.Client(timeout=timeout)
    try:
        payload: dict = {
            "model": model,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
                    {"type": "text", "text": prompt},
                ],
            }],
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        data = _post_json(
            http,
            f"{base_url.rstrip('/')}/chat/completions",
            {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            payload,
        )
        return _extract_content(data)
    finally:
        if own:
            http.close()


def mineru_parse(
    base_url: str,
    file_bytes: bytes,
    filename: str,
    client: httpx.Client | None = None,
    poll_interval: float = 5.0,
    max_wait: float = 300.0,
) -> str:
    """MinerU 文档解析：POST /file_parse（multipart）→ 轮询 /get_task_results → markdown。

    轮询超时抛 RuntimeError；解析失败（state=fail）抛 RuntimeError（附原因）。
    """
    own = client is None
    http = client or httpx.Client(timeout=30.0)
    try:
        files = {"files": (filename, file_bytes, "application/pdf")}
        response = http.post(f"{base_url.rstrip('/')}/file_parse", files=files)
        if response.status_code != 200:
            raise RuntimeError(f"MinerU 提交失败：HTTP {response.status_code}")
        task_id = response.json().get("task_id")
        if not task_id:
            raise RuntimeError("MinerU 提交失败：响应缺 task_id")

        deadline = time.monotonic() + max_wait
        while time.monotonic() < deadline:
            result = http.get(f"{base_url.rstrip('/')}/get_task_results/{task_id}")
            if result.status_code != 200:
                raise RuntimeError(f"MinerU 结果查询失败：HTTP {result.status_code}")
            data = result.json().get("data", {})
            state = data.get("state")
            if state == "done":
                markdown = data.get("markdown") or ""
                if not markdown:
                    raise RuntimeError("MinerU 解析完成但无 markdown 产物")
                return markdown
            if state in ("fail", "error"):
                raise RuntimeError(f"MinerU 解析失败：{data.get('err_msg', state)}")
            time.sleep(poll_interval)
        raise RuntimeError(f"MinerU 解析超时（>{max_wait:g}s）")
    finally:
        if own:
            http.close()
