"""练习域确定性判分（主链 M-3 规则层的首块，由 M2 契约稿「M-3 判分接口缝」缝 1 冻结）。

模块职责：`grade(question_row, user_answer)`——纯函数、无 LLM、无数据库，按闭集三型定档：
choice=去空白小写全等且 expected ∈ A/B/C/D；short=全等，否则 `SequenceMatcher.ratio() ≥ 0.85`
**且** `len(expected) ≤ 30`（长答案禁用模糊匹配）；open=expected 按 `[,;，；。\\n]+` 切词取
命中比 ≥ 0.6；未知判分型与空 `expected_answer` 一律判 False（不猜）。返回值只含
`{is_correct, method, note}`，`note` 为可展示的判分说明（不含密钥、不含模型意见）。
归属口径：规则本体的后续扩展（质性门、LLM 批改 prompt）仍归主链 M-3；本模块只承接 M2
作答端点所需的确定性判分，`method='llm'` 分支不在本文件（缝 3：v1 默认关闭）。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_learn_practice.py
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

CHOICE_LABELS = ("a", "b", "c", "d")
SHORT_FUZZY_MIN_RATIO = 0.85
SHORT_FUZZY_MAX_LENGTH = 30
OPEN_HIT_MIN_RATIO = 0.6
OPEN_TERM_SPLIT = re.compile(r"[,;，；。\n]+")
ISSUE_MISSING_EXPECTED = "expected_answer 缺失"

METHOD_DETERMINISTIC = "deterministic"


def _collapse(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").strip())


def _open_terms(expected: str) -> list[str]:
    return [term.strip() for term in OPEN_TERM_SPLIT.split(expected) if term.strip()]


def _verdict(is_correct: bool, note: str) -> dict[str, Any]:
    return {"is_correct": is_correct, "method": METHOD_DETERMINISTIC, "note": note}


def grade(question: dict[str, Any], user_answer: str) -> dict[str, Any]:
    """按题目的 `question_type` 定档判分；返回 `{is_correct, method, note}`。"""
    expected = str(question.get("expected_answer") or "").strip()
    needles = _collapse(user_answer).lower()
    question_type = question.get("question_type")

    if not expected:
        return _verdict(False, ISSUE_MISSING_EXPECTED)

    if question_type == "choice":
        want = expected.lower()
        if want not in CHOICE_LABELS:
            return _verdict(False, "expected_answer 非 A/B/C/D，无法判分")
        if needles == want:
            return _verdict(True, f"选项命中 {want.upper()}")
        return _verdict(False, f"应为 {want.upper()}")

    if question_type == "short":
        if needles == expected.lower():
            return _verdict(True, "全等命中")
        ratio = SequenceMatcher(None, needles, expected.lower()).ratio()
        if len(expected) <= SHORT_FUZZY_MAX_LENGTH and ratio >= SHORT_FUZZY_MIN_RATIO:
            return _verdict(True, f"近似命中（相似度 {ratio:.2f}）")
        if len(expected) > SHORT_FUZZY_MAX_LENGTH:
            return _verdict(False, f"长答案（{len(expected)} 字）禁用模糊匹配")
        return _verdict(False, f"相似度 {ratio:.2f} 未达 {SHORT_FUZZY_MIN_RATIO}")

    if question_type == "open":
        terms = _open_terms(expected) or [expected]
        hits = [term for term in terms if _collapse(term).lower() in needles]
        ratio = len(hits) / len(terms)
        missed = "、".join(term for term in terms if term not in hits)
        if ratio >= OPEN_HIT_MIN_RATIO:
            return _verdict(True, f"关键词命中 {len(hits)}/{len(terms)}")
        return _verdict(False, f"关键词命中 {len(hits)}/{len(terms)}，未命中：{missed}")

    return _verdict(False, f"未知判分型 {question_type}，不猜")
