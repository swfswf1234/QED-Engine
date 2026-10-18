"""学习面注解的按需生成腿（REQ-117 W9）：取材 → 拼 prompt → 网关文字槽 → 成品清洗。

模块职责：把「这一条／这一章还没有注解 → 点生成」落到 `services/llm/gateway.call_text`
这一条通道上（前端不拼 prompt、不直调 `/llm/*`），产出可落库的成品（章级总结、章级学习要点、
条级注解），并持有章级 60s 节流的键位与缓存（重复点按钮不重烧模型）。
纯函数面（prompt 拼装与成品清洗）不碰数据库、不发网络；调用与节流由本模块持有供 API 层使用。
设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
关联测试：tests/test_learn.py
"""

from __future__ import annotations

import re
from time import monotonic  # noqa: SC200 - 测试注入假钟的接缝（章级节流窗）
from typing import Any

from qed_engine.config import Settings
from qed_engine.services.llm.gateway import call_text

# 生成用途闭集：章级总结／章级学习要点／条级总结与注解（§V2.11）
ANNOTATION_PARTS = ("summary", "key_points", "annotation")
# 目标层闭集与其可用 part（章＝总结与要点、条＝注解；其余组合 422）
PART_TARGETS: dict[str, str] = {"summary": "chapter", "key_points": "chapter", "annotation": "point"}
THROTTLE_SECONDS = 60.0
GEN_BATCH = "learn-annotation"
# 要点条数与单条限长（学习要点 3~6 条；超出按前 6 条截，落库前已清洗）
KEY_POINT_MAX_ITEMS = 6
KEY_POINT_MAX_CHARS = 160
SUMMARY_MAX_CHARS = 1000  # 章行 summary 列 VARCHAR(1000)
ANNOTATION_MAX_CHARS = 2000
_MODEL_REF_LIMIT = 120

SYSTEM = "你是教材学习注解助手。只依据用户提供的教材正文作答，不编造外部结论，不使用Markdown标记。"

_SPECS: dict[str, dict[str, Any]] = {
    "summary": {
        "max_tokens": 700,
        "source_chars": 6000,
        "max_pages": 12,
        "instruction": (
            "请为下面这一章写一段章节总结，说清这一章讲了什么、主线是什么，"
            "150~250 字，一段话，不要分点，不要标题。"
        ),
    },
    "key_points": {
        "max_tokens": 900,
        "source_chars": 6000,
        "max_pages": 12,
        "instruction": (
            "请从下面这一章的正文里列出 3~6 条学习要点，每行一条，"
            "行首不要编号、项目符号或星号，每条不超过 60 字。"
        ),
    },
    "annotation": {
        "max_tokens": 700,
        "source_chars": 3000,
        "max_pages": 6,
        "instruction": (
            "请针对下面这个知识点写一段学习注解，先说它是什么、再说它为什么重要或怎么用，"
            "120~200 字，一段话，不要标题。"
        ),
    },
}

_BULLET = re.compile(r"^\s*(?:[-*·・•]|\d+[.、)]|[一二三四五六七八九十]+[、.)）])\s*")
_FENCE = re.compile(r"^\s*```[a-zA-Z]*\s*$")
_WHITESPACE = re.compile(r"\s+")


def build_prompt(part: str, name: str, source_text: str) -> dict[str, Any]:
    """拼装网关请求参数（限长在此定档：取材截断 + max_tokens 分档）。"""
    spec = _SPECS[part]
    label = "这一章" if PART_TARGETS[part] == "chapter" else "这个知识点"
    prompt = (
        f"# {label}：{name}\n\n{spec['instruction']}\n\n"
        f"# 教材正文（节选，最多 {spec['source_chars']} 字）\n{source_text[: spec['source_chars']]}\n"
    )
    return {"system": SYSTEM, "prompt": prompt, "max_tokens": spec["max_tokens"]}


def source_page_limit(part: str) -> int:
    """取材页数上限（章级 12 页／条级 6 页）：读侧有界，避免整本正文进 prompt。"""
    return int(_SPECS[part]["max_pages"])


def _clean_line(text: str) -> str:
    return _WHITESPACE.sub(" ", text).strip()


def compose(part: str, reply: str) -> Any:
    """模型输出 → 可落库成品：章级/条级总结＝单段清洗文本；学习要点＝去编号的条目数组。"""
    if part != "key_points":
        limit = SUMMARY_MAX_CHARS if part == "summary" else ANNOTATION_MAX_CHARS
        lines = [
            _clean_line(_FENCE.sub("", line))
            for line in (reply or "").splitlines()
            if _clean_line(line) and not _FENCE.match(line)
        ]
        return _clean_line(" ".join(lines))[:limit]
    items: list[str] = []
    for raw in (reply or "").splitlines():
        line = _clean_line(_BULLET.sub("", _FENCE.sub("", raw).strip()))
        if not line or _FENCE.match(raw):
            continue
        items.append(line[:KEY_POINT_MAX_CHARS])
        if len(items) >= KEY_POINT_MAX_ITEMS:
            break
    return items


def source_snippet(source_text: str, limit: int = 160) -> str:
    """候选锚点摘要＝取材正文首句截断（落 anchors[].snippet）。"""
    return _clean_line(source_text)[:limit]


def clean_reason(reason: str) -> str:
    """失败原因进用户话术前压平并截断（不入密钥、URL 或多行堆栈）。"""
    return (_WHITESPACE.sub(" ", reason or "").strip() or "没有返回内容")[:120]


def generate(settings: Settings, part: str, name: str, source_text: str) -> dict[str, Any]:
    """调用文字槽并清洗；返回 {ok, text|items, model_ref, reason}，失败不抛异常。"""
    args = build_prompt(part, name, source_text)
    try:
        result = call_text(
            settings,
            prompt=args["prompt"],
            system=args["system"],
            max_tokens=args["max_tokens"],
            service="learn_annotation",
        )
    except Exception as exc:  # noqa: BLE001 - 上游异常一律降级为可重试话术，不把堆栈带给界面
        return {"ok": False, "model_ref": "", "reason": clean_reason(str(exc))}
    if not result.get("success"):
        return {"ok": False, "model_ref": "", "reason": clean_reason(str(result.get("error") or ""))}
    composed = compose(part, str(result.get("reply") or ""))
    if not composed:
        return {"ok": False, "model_ref": "", "reason": "没有返回可用的内容"}
    payload_key = "items" if part == "key_points" else "text"
    return {
        "ok": True,
        payload_key: composed,
        "model_ref": str(result.get("call_id") or result.get("model") or "")[:_MODEL_REF_LIMIT],
        "reason": "",
    }


# ---------- 章级节流（60s 窗口；条级不去重） ----------

_throttle: dict[tuple[str, str, str, str], tuple[float, dict[str, Any]]] = {}


def throttle_key(course_id: str, target_kind: str, kp_id: str, part: str) -> tuple[str, str, str, str]:
    return (course_id, target_kind, kp_id, part)


def cached(key: tuple[str, str, str, str]) -> dict[str, Any] | None:
    hit = _throttle.get(key)
    if hit is None:
        return None
    stamp, response = hit
    if monotonic() - stamp > THROTTLE_SECONDS:
        _throttle.pop(key, None)
        return None
    return response


def remember(key: tuple[str, str, str, str], response: dict[str, Any]) -> None:
    _throttle[key] = (monotonic(), response)


def clear_throttle() -> None:
    _throttle.clear()
