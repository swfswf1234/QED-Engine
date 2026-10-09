"""本地模型适配层（M3·L7 移植）：能力表、JSON 容错三件套 + 一次 repair、thinking 清洗。

DeepTutor 验证过的本地后端降级组合移植进 8900 网关（ARCH-027-M3 第一批 A-1/A-3/A-4）：

- **A-1 能力表**（`capabilities_for`）：本地渠道（lmstudio/llamacpp/docker/ollama）硬编码
  `supports_tools=False`，`supports_json_mode` 为三态（local = None 未知悢规尝试，api 按端点表 True/False）；
  启动探测兜底归 A-2 轮。
- **A-3 JSON 容错**：`parse_json_reply` 三件套（直解 → 围栏抽取 → 最外层切片 + 尾逗号/控制
  字符修复），全失败时经调用方注入的 `repair` 回调做**一次**修复重解；response_format 注入
  门在 gateway（仅 local + 开关开启 + 能力表/拉黑允许），`JsonModeUnsupported` 触发剥参数
  单次重试与运行时拉黑（进程态，`blacklist` / `is_blacklisted`）。
- **A-4 清洗**：`scrub_thinking` 剥离 scratchpad 段（成对标签与未闭合到文末两种形态）+ 残缺
  标签残留；`parse_json_reply` 入口先清洗。

**全局开关** `Settings.qed_llm_local_adapt`（env `QED_LLM_LOCAL_ADAPT`，默认 true）：false =
能力表/注入/重试/拉黑全部旁路（response_format 不注入、剥参数不重试），回退现行为；三件套与
清洗为纯函数，由调用方（M-2 管线）自行决定是否消费。

设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
关联测试：tests/test_llm_local_adapt.py
"""

from __future__ import annotations

import json
import re
import threading
from dataclasses import dataclass

# 本地渠道 provider 全集（call_log.provider 的 local 取值 + ollama 级兼容后端预留位）
LOCAL_PROVIDERS = frozenset({"lmstudio", "llamacpp", "docker", "ollama"})

# api 端点能力表（当前仅 dashscope 兼容模式实际使用；工具与 JSON 模式均可用）
_API_CAPABILITIES = {"qwen": ("tools", "json_mode")}

_SCRATCHPAD_TAGS = ("think",)


@dataclass(frozen=True)
class LocalCapabilities:
    """渠道能力表条目：工具/结构化输出支持面与 scratchpad 标签。

    supports_json_mode 三态：True=端点确认支持；False=确认不支持或已被运行时拉黑；
    None=未知（本地服务端版本不一，乐观尝试一次，被拒即拉黑降级——A-1 探测兜底口径）。
    """

    supports_tools: bool
    supports_json_mode: bool | None
    scratchpad_tags: tuple[str, ...]


def capabilities_for(channel: str, provider: str) -> LocalCapabilities:
    """渠道 × provider → 能力表。local 一律无工具、JSON 模式未知；api 按端点表。"""
    if channel == "local":
        return LocalCapabilities(False, None, _SCRATCHPAD_TAGS)
    caps = _API_CAPABILITIES.get(provider, ())
    return LocalCapabilities("tools" in caps, "json_mode" in caps, ())


def supports_tools(channel: str, provider: str) -> bool:
    return capabilities_for(channel, provider).supports_tools


# --- 运行时拉黑（进程态：response_format 被上游拒绝后不再尝试）---

_blacklist_lock = threading.Lock()
_json_mode_blacklist: set[tuple[str, str]] = set()


def blacklist(provider: str, model: str) -> None:
    """拉黑 (provider, model) 的 JSON 模式能力（进程态，重启清零）。"""
    with _blacklist_lock:
        _json_mode_blacklist.add((provider, model))


def is_blacklisted(provider: str, model: str) -> bool:
    with _blacklist_lock:
        return (provider, model) in _json_mode_blacklist


def clear_blacklist() -> None:
    """清空拉黑清单（测试与运维复位用）。"""
    with _blacklist_lock:
        _json_mode_blacklist.clear()


def json_mode_allowed(channel: str, provider: str, model: str) -> bool:
    """response_format 注入判定：仅 local 渠道、未被运行时拉黑、能力表非「确认不支持」。

    local 的 JSON 模式能力为未知（None）时乐观尝试：上游拒绝由 gateway 捕获
    JsonModeUnsupported 拉黑后剥参数单次重试，此后不再注入（一次学习、长期生效）。
    """
    if channel != "local":
        return False
    if capabilities_for(channel, provider).supports_json_mode is False:
        return False
    return not is_blacklisted(provider, model)


class JsonModeUnsupported(RuntimeError):
    """上游拒绝 response_format（本地服务端不认识该参数）。"""


# --- A-4 thinking/scratchpad 清洗 ---

def _unclosed_tag_pattern(tag: str) -> re.Pattern[str]:
    return re.compile(rf"<{tag}>.*$", re.DOTALL | re.IGNORECASE)


def scrub_thinking(text: str) -> str:
    """剥离 scratchpad：成对标签段、未闭合标签到文末、残缺 `<think` 残留。"""
    cleaned = text
    for tag in _SCRATCHPAD_TAGS:
        cleaned = re.compile(rf"<{tag}>.*?</{tag}>", re.DOTALL | re.IGNORECASE).sub("", cleaned)
        cleaned = _unclosed_tag_pattern(tag).sub("", cleaned)
    cleaned = re.sub(r"<\s*think[^>]*>?", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"</\s*think\s*>", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def is_reasoning_starved(reply: str, reasoning: str = "") -> bool:
    """预算饥饿判定：正文非空但清洗后为空，或正文空而思考段在另一字段（A-5 J-A5b）。"""
    if not (reply or "").strip():
        return bool((reasoning or "").strip())
    return not scrub_thinking(reply)


def classify_reply(content: str, finish_reason: str = "", reasoning: str = "") -> str:
    """响应可用性判定 → 不可用原因标签（'' = 可作结构化输入）。

    A-5 正确性防线（不受适配开关旁路）：`finish_reason=length` 的截断响应不得作成功正文，
    空正文一律不可用——思考段吃满 max_tokens 时 content 为 0 字，旧口径把它记成 success
    穿透给调用方，调用方只剩「JSON 解析失败」并把渠道误判为外部服务。
    """
    text = (content or "").strip()
    if finish_reason == "length":
        return "思考截断致正文为空（finish_reason=length）" if not text else \
            "响应被 max_tokens 截断（finish_reason=length）"
    if not text:
        if (reasoning or "").strip():
            return f"正文为空、思考段在独立字段（{len(reasoning)} 字，finish_reason={finish_reason or '无'}）"
        return f"模型正文为空（finish_reason={finish_reason or '无'}）"
    if is_reasoning_starved(content, reasoning):
        return "正文全为思考段，清洗后无正文"
    return ""


def is_starved_reply(content: str) -> bool:
    """降档重试适用面：仅「正文为空」形状（截断正文重试无意义，不再追发调用）。"""
    return not (content or "").strip()


# --- A-3 JSON 容错三件套 + 一次 repair ---

class JsonParseError(ValueError):
    """三件套 + repair 均失败；raw 保留原文供上层 repair/记录。"""

    def __init__(self, message: str, raw: str) -> None:
        super().__init__(f"{message}：{raw[:200]}")
        self.raw = raw


_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)
_TRAILING_COMMA = re.compile(r",\s*([}\]])")


def _candidate_slices(text: str) -> list[str]:
    """三件套第二/三件的候选：最外层 {..} / [..] 括号匹配切片（字符串感知，跳过引号内括号）。"""
    candidates = []
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        while start != -1:
            slice_ = _match_braces(text, start, opener, closer)
            if slice_:
                candidates.append(slice_)
                break
            start = text.find(opener, start + 1)
    return candidates


def _match_braces(text: str, start: int, opener: str, closer: str) -> str:
    depth, in_string, escape = 0, False, False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                return text[start:index + 1]
    return ""


def _relaxed_loads(candidate: str) -> object:
    """对候选片段做宽松修复：去尾逗号 + 剥裸控制字符（字符串内真实换行等）。"""
    fixed = _TRAILING_COMMA.sub(r"\1", candidate)
    fixed = re.sub(r"[\x00-\x08\x0b-\x1f]", " ", fixed)
    return json.loads(fixed)


def parse_json_reply(text: str, repair=None) -> object:
    """容错三件套 + 一次 repair：清洗 → 直解 → 围栏抽取 → 最外层切片（含宽松修复）→ repair 回调。

    repair 为调用方注入的一次性修复函数（如模型修复调用，A-5 轮接线）；全部失败抛
    JsonParseError（raw 携原文）。
    """
    cleaned = scrub_thinking(text or "")
    if not cleaned and text:
        cleaned = text.strip()  # 未闭合标签会吃掉尾部正文：回退原文交给三件套切片
    candidates = [cleaned]
    candidates.extend(match.group(1).strip() for match in _FENCE.finditer(cleaned))
    candidates.extend(_candidate_slices(cleaned))
    for candidate in candidates:
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except ValueError:
            try:
                return _relaxed_loads(candidate)
            except ValueError:
                continue
    if repair is not None:
        try:
            return json.loads(repair(cleaned))
        except ValueError as exc:
            raise JsonParseError(f"JSON 修复调用后仍不可解析（{exc}）", text) from exc
    raise JsonParseError("模型回复无法解析为 JSON", text)
