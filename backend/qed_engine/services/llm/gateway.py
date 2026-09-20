"""LLM 网关：统一文字/视觉/向量调用入口，经注册表解析按全局渠道路由，落 qed_llm_calls。

2026-09-16（PLAN-046）：路由解析收口 registry.resolve(settings)——api 渠道走身份的
api 引用（厂商+模型名+端点，身份缺引用回退 QED_API_PROVIDER 厂商默认）；local 渠道走
身份的本地绑定（runtime 经 model_manager 单活仲裁启动，OpenAI 兼容调用发现式取已加载
模型）。向量槽位（call_embedding）仅 api（本地预留）。调用成功/失败均记录
（record_call 降级不抛）；失败返回 success=false + error。

设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
关联测试：tests/test_llm_gateway.py
"""

import json
import time

from qed_engine.config import Settings
from qed_engine.services.llm import call_log, clients, model_manager, registry


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
    """文字模型调用：api → 身份 api 引用；local → 本地 runtime（单活仲裁）。

    返回 {reply, call_id, success, error}。
    """
    started = time.monotonic()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    mode = settings.qed_api_select
    try:
        resolved = registry.resolve(settings)["text"]
        mode = resolved.channel  # 槽位来源运行态（manifest.source > 全局默认）
        if resolved.error:
            raise RuntimeError(f"文字槽位解析失败：{resolved.error}")
        if resolved.channel == "local":
            model_manager.ensure_local_ready(settings, "text")
            reply = clients.qwen_chat(
                base_url=resolved.base_url,
                messages=messages,
                timeout=settings.qed_llm_timeout,
                max_tokens=max_tokens,
                model=resolved.model,  # 注册表本地引用 = LM Studio 实际模型 id（单活已加载）
                api_key=settings.resolved_lmstudio_token(),  # LM Studio API 认证（空=不带头）
            )
        else:
            reply = clients.provider_text_chat(
                api_key=settings.resolved_api_key(), model=resolved.model,
                messages=messages, base_url=resolved.base_url,
                timeout=settings.qed_llm_timeout, max_tokens=max_tokens,
            )
        call_id = call_log.record_call(
            settings, service=service, mode=mode, provider=resolved.provider, model=resolved.model,
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
    max_tokens: int | None = None,
    service: str = "qed_engine",
) -> dict:
    """视觉模型调用：api → 身份 api 引用（图片 base64）；local → MinerU（PDF 解析）。

    local 模式仅支持 PDF（MinerU 语义）；传图片 base64 时返回明确错误。
    返回 {reply, call_id, success, error}。
    """
    started = time.monotonic()
    mode = settings.qed_api_select
    try:
        resolved = registry.resolve(settings)["vision"]
        mode = resolved.channel  # 槽位来源运行态（manifest.source > 全局默认）
        if resolved.error:
            raise RuntimeError(f"图像槽位解析失败：{resolved.error}")
        if resolved.channel == "local":
            if not pdf_bytes:
                raise RuntimeError("local 模式图像模型为 MinerU（PDF 解析），请提供 PDF（pdf_bytes）")
            model_manager.ensure_local_ready(settings, "vision")
            reply = clients.mineru_parse(
                base_url=resolved.base_url,
                file_bytes=pdf_bytes,
                filename=pdf_filename,
            )
        else:
            if not image_base64:
                raise RuntimeError("api 模式视觉调用需提供 image_base64")
            reply = clients.provider_vision_chat(
                api_key=settings.resolved_api_key(), model=resolved.model,
                image_base64=image_base64, prompt=prompt, base_url=resolved.base_url,
                timeout=settings.qed_llm_timeout, max_tokens=max_tokens,
            )
        call_id = call_log.record_call(
            settings, service=service, mode=mode, provider=resolved.provider, model=resolved.model,
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


def call_embedding(
    settings: Settings,
    *,
    input_texts: list[str],
    service: str = "qed_engine",
) -> dict:
    """向量模型调用（api text-embedding-v4；本地预留）。

    prompt 记 JSON 输入，response 记维度摘要（不存向量本体）。
    返回 {embeddings, call_id, success, error}。
    """
    started = time.monotonic()
    mode = settings.qed_api_select
    prompt_json = json.dumps(input_texts, ensure_ascii=False)
    try:
        resolved = registry.resolve(settings)["embedding"]
        mode = resolved.channel  # 槽位来源运行态（manifest.source > 全局默认）
        if resolved.error:
            raise RuntimeError(f"向量槽位解析失败：{resolved.error}")
        embeddings = clients.provider_embeddings(
            api_key=settings.resolved_api_key(), model=resolved.model,
            input_texts=input_texts, base_url=resolved.base_url,
            timeout=settings.qed_llm_timeout,
        )
        summary = f"{len(embeddings)} vectors, dim={len(embeddings[0]) if embeddings else 0}"
        call_id = call_log.record_call(
            settings, service=service, mode=mode, provider=resolved.provider, model=resolved.model,
            endpoint="embedding", prompt=prompt_json, response=summary,
            duration_ms=_duration_ms(started), status="success",
        )
        return {"embeddings": embeddings, "call_id": call_id, "success": True, "error": ""}
    except Exception as exc:
        error = str(exc)
        call_log.record_call(
            settings, service=service, mode=mode, provider="gateway", model="",
            endpoint="embedding", prompt=prompt_json, response="",
            duration_ms=_duration_ms(started), status="error", error=error[:500],
        )
        return {"embeddings": [], "call_id": None, "success": False, "error": error}
