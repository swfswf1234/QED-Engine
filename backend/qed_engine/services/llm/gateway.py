"""LLM 网关：统一文字/视觉/向量调用入口，经注册表解析按全局渠道路由，落 qed_llm_calls。

2026-09-16（PLAN-046）：路由解析收口 registry.resolve(settings)——api 渠道走身份的
api 引用（厂商+模型名+端点，身份缺引用回退 QED_API_PROVIDER 厂商默认）；local 渠道走
身份的本地绑定（runtime 经 model_manager 单活仲裁启动，OpenAI 兼容调用发现式取已加载
模型）。向量槽位（call_embedding）仅 api（本地预留）。调用成功/失败均记录
（record_call 降级不抛）；失败返回 success=false + error。

2026-09-28（ARCH-027-M3 首批）：call_text 增加 response_format='json' 口径——仅 local 渠道
经适配层（local_adapt）按能力表与运行时拉黑注入；api 渠道拒绝该参数（首批口径，不静默
丢弃）；上游拒 response_format 时剥参数单次重试并拉黑。整体开关 QED_LLM_LOCAL_ADAPT。

2026-10-07（M3 A-5，REQ-102 W5 取证驱动）：文字调用返回正文前过 `local_adapt.classify_reply`
截断/空正文判定——`finish_reason=length` 与空正文一律 `success=false` 并记 `status=error`
（旧口径把思考段吃满 max_tokens 的空正文记成 success 穿透给调用方）。local 正文饥饿按
`reasoning_effort='none'` 降档**单次**重试（截断正文不追发；真机 A/B 证 `low` 档不降思考段）；
判定不受开关旁路，降档重试受 QED_LLM_LOCAL_ADAPT 旁路。`reasoning`/`finish_reason` 只在网关内部
返回面携带，`/llm/text` 对外字段不扩。

设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
关联测试：tests/test_llm_gateway.py、tests/test_llm_local_adapt.py
"""

import json
import time

from qed_engine.config import Settings
from qed_engine.services.llm import call_log, clients, local_adapt, model_manager, registry


def _duration_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def _qwen_chat_with_adapt(settings, resolved, messages, max_tokens, response_format,
                          reasoning_effort=None):
    """local 文字调用（M3 适配层接线）：能力表 + 拉黑决定 response_format 注入；开关关闭=不注入。

    reasoning_effort 非 None 时为 A-5 饥饿降档重试的那一次调用（正文空才追发，单次）。
    """
    fmt = None
    if settings.qed_llm_local_adapt and response_format == "json":
        fmt = {"type": "json_object"} if local_adapt.json_mode_allowed(
            resolved.channel, resolved.provider, resolved.model) else None
    return clients.qwen_chat(
        base_url=resolved.base_url,
        messages=messages,
        timeout=settings.qed_llm_timeout,
        max_tokens=max_tokens,
        model=resolved.model,  # 注册表本地引用 = LM Studio 实际模型 id；空 = A-6 继承兜底（clients 发现式取已加载模型）
        api_key=settings.resolved_lmstudio_token(),  # LM Studio API 认证（空=不带头）
        response_format=fmt,
        reasoning_effort=reasoning_effort,
    )


def _reply_fields(reply) -> tuple[str, str]:
    """ChatReply 的截断判据；旧式纯 str 返回面按无判据处理。"""
    return (getattr(reply, "finish_reason", "") or "",
            getattr(reply, "reasoning_content", "") or "")


def call_text(
    settings: Settings,
    *,
    prompt: str,
    system: str | None = None,
    prompt_template: str | None = None,
    max_tokens: int | None = None,
    response_format: str | None = None,  # 'json' = 请求 JSON 对象输出（M3 适配层按渠道处置）
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
            try:
                reply = _qwen_chat_with_adapt(
                    settings, resolved, messages, max_tokens, response_format)
            except local_adapt.JsonModeUnsupported:
                # 运行时拉黑（M3 A-3）：服务端拒 response_format → 剥参数单次重试，此后不再尝试
                if not (settings.qed_llm_local_adapt and response_format):
                    raise
                local_adapt.blacklist(resolved.provider, resolved.model)
                reply = _qwen_chat_with_adapt(
                    settings, resolved, messages, max_tokens, None)
            finish_reason, reasoning = _reply_fields(reply)
            reason = local_adapt.classify_reply(str(reply), finish_reason, reasoning)
            # A-5 J-A5c：正文饥饿按降 effort 单次重试（截断正文不追发）；开关关闭即旁路。
            # 档位取 none：真机 A/B 证 low 不降思考段（仍 finish=length 空正文）。
            if (reason and settings.qed_llm_local_adapt
                    and local_adapt.is_starved_reply(str(reply))):
                reply = _qwen_chat_with_adapt(
                    settings, resolved, messages, max_tokens, response_format,
                    reasoning_effort="none")
                finish_reason, reasoning = _reply_fields(reply)
                reason = local_adapt.classify_reply(str(reply), finish_reason, reasoning)
        elif response_format:
            raise RuntimeError("api 渠道暂不经网关注入 response_format（M3 首批口径）")
        else:
            reply = clients.provider_text_chat(
                api_key=settings.resolved_api_key(), model=resolved.model,
                messages=messages, base_url=resolved.base_url,
                timeout=settings.qed_llm_timeout, max_tokens=max_tokens,
            )
            finish_reason, reasoning = _reply_fields(reply)
            reason = local_adapt.classify_reply(str(reply), finish_reason, reasoning)
        if reason:
            raise RuntimeError(f"模型响应不可用：{reason}")
        call_id = call_log.record_call(
            settings, service=service, mode=mode, provider=resolved.provider, model=resolved.model,
            endpoint="text", prompt=prompt, response=reply,
            duration_ms=_duration_ms(started), status="success", prompt_template=prompt_template,
        )
        return {"reply": reply, "call_id": call_id, "success": True, "error": "",
                "finish_reason": finish_reason, "reasoning": reasoning}
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
