"""LLM 网关：统一文字/视觉调用入口，按 QED_API_SELECT 路由 api/local，落 qed_llm_calls。

- api 模式：按 QED_API_PROVIDER 路由厂商（qwen 默认；deepseek/glm 注册表预留），
  地址/生效模型经 clients 注册表解析；视觉仅 qwen/glm（deepseek 明确报错）。
- local 模式：文字 LM Studio（经 model_manager 资源互斥）、视觉 MinerU（同上）。
调用成功/失败均记录（record_call 降级不抛）；失败返回 reply="" + success=false + error。

设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
关联测试：tests/test_llm_gateway.py
"""

import time

from qed_engine.config import Settings
from qed_engine.services.llm import call_log, clients, model_manager


def _duration_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def call_text(
    settings: Settings,
    *,
    prompt: str,
    system: str | None = None,
    prompt_template: str | None = None,
    max_tokens: int | None = None,
    service: str = "qed_engine",
) -> dict:
    """文字模型调用：api → QED_API_PROVIDER 对应厂商；local → LM Studio（资源互斥）。返回 {reply, call_id, success, error}。"""
    started = time.monotonic()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    mode = settings.qed_api_select
    try:
        if mode == "local":
            model_manager.ensure_text_ready(settings)
            reply = clients.lmstudio_chat(
                base_url=settings.qed_lmstudio_url,
                messages=messages,
            )
            provider, model = "lmstudio", "local"
        else:
            provider = settings.qed_api_provider
            base_url, model = clients.resolve_text(provider, settings.qed_model)
            reply = clients.provider_text_chat(
                api_key=settings.resolved_api_key(), model=model,
                messages=messages, base_url=base_url,
            )
            # provider, model = provider, model（记录真实厂商与生效模型）
        call_id = call_log.record_call(
            settings, service=service, mode=mode, provider=provider, model=model,
            endpoint="text", prompt=prompt, response=reply,
            duration_ms=_duration_ms(started), status="success", prompt_template=prompt_template,
        )
        return {"reply": reply, "call_id": call_id, "success": True, "error": ""}
    except Exception as exc:
        error = str(exc)
        call_log.record_call(
            settings, service=service, mode=mode, provider="gateway", model="",
            endpoint="text", prompt=prompt, response="", duration_ms=_duration_ms(started),
            status="error", error=error[:500], prompt_template=prompt_template,
        )
        return {"reply": "", "call_id": None, "success": False, "error": error}


def call_vision(
    settings: Settings,
    *,
    image_base64: str | None = None,
    pdf_bytes: bytes | None = None,
    pdf_filename: str = "input.pdf",
    prompt: str = "识别并输出图片内容",
    prompt_template: str | None = None,
    service: str = "qed_engine",
) -> dict:
    """视觉模型调用：api → 厂商视觉模型（图片 base64）；local → MinerU（PDF 解析）。

    local 模式仅支持 PDF（MinerU 语义）；传图片 base64 时返回明确错误。
    返回 {reply, call_id, success, error}。
    """
    started = time.monotonic()
    mode = settings.qed_api_select
    try:
        if mode == "local":
            if not pdf_bytes:
                raise RuntimeError("local 模式图像模型为 MinerU（PDF 解析），请提供 PDF（pdf_bytes）")
            model_manager.ensure_image_ready(settings)
            reply = clients.mineru_parse(
                base_url=settings.qed_mineru_url,
                file_bytes=pdf_bytes,
                filename=pdf_filename,
            )
            provider, model = "mineru", "mineru"
        else:
            if not image_base64:
                raise RuntimeError("api 模式视觉调用需提供 image_base64")
            provider = settings.qed_api_provider
            resolved = clients.resolve_vision(provider, settings.qed_ocr_model)
            if resolved is None:
                raise RuntimeError(f"{provider} 无视觉模型（视觉仅 qwen / glm）")
            base_url, model = resolved
            reply = clients.provider_vision_chat(
                api_key=settings.resolved_api_key(), model=model,
                image_base64=image_base64, prompt=prompt, base_url=base_url,
            )
            # provider, model = provider, model（记录真实厂商与生效模型）
        call_id = call_log.record_call(
            settings, service=service, mode=mode, provider=provider, model=model,
            endpoint="vision", prompt=prompt, response=reply,
            duration_ms=_duration_ms(started), status="success", prompt_template=prompt_template,
        )
        return {"reply": reply, "call_id": call_id, "success": True, "error": ""}
    except Exception as exc:
        error = str(exc)
        call_log.record_call(
            settings, service=service, mode=mode, provider="gateway", model="",
            endpoint="vision", prompt=prompt, response="", duration_ms=_duration_ms(started),
            status="error", error=error[:500], prompt_template=prompt_template,
        )
        return {"reply": "", "call_id": None, "success": False, "error": error}
