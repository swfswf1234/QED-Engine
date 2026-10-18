"""主链 M-3 门与判分规则层（纯函数，无 LLM、无数据库、无网络）。

模块职责：把知识点作答序列折算成掌握门结论与推进游标。规则本体一比一直译只读参照
DeepTutor（证据行号见承载壳「M-3 门与判分契约设计稿」对照表）：近因加权正确率取最近
5 次、权重 `(0.5,0.7,0.85,0.95,1.0)`（老→新），防蒙对置信上限 `{1:0.5, 2:0.8}`（故
单次蒙对永不过 0.9 门，≥3 次作答才可能过门）；门阈按知识点四分类分流——
`memory`/`procedure` 走量化门（0.9），`concept`/`design` 走质性判定（显示值 1.0），
类型缺失按 0.9 量化门回落，不猜。provenance 区分 `system`（服务端判定过门）与
`learner`（学习者勾选或自评讲清）：两条通路都可推进路线，但对外报告不得把自评冒充
系统判定。推进＝「门就是游标」（到期复习 → 第一个未掌握知识点 → 结课），无手改进度游标。
判分不在本文件：阈值与三型定档归 `grading.py`（M2 壳缝 1），本模块只消费 `is_correct` 序列。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_learn_mastery.py
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

RECENCY_WEIGHTS: tuple[float, ...] = (0.5, 0.7, 0.85, 0.95, 1.0)
CONFIDENCE_CAP: dict[int, float] = {1: 0.5, 2: 0.8}
QUANTITATIVE_GATE: dict[str, float] = {"memory": 0.9, "procedure": 0.9}
QUANTITATIVE_DEFAULT = 0.9
QUALITATIVE_TYPES = frozenset({"concept", "design"})
QUALITATIVE_PASS_DISPLAY = 1.0

PROVENANCE_SYSTEM = "system"
PROVENANCE_LEARNER = "learner"
ASSESSED_BY_MODEL = "model"
ASSESSED_BY_LEARNER = "learner"


def is_qualitative(kp_type: str | None) -> bool:
    return (kp_type or "") in QUALITATIVE_TYPES


def gate_kind(kp_type: str | None) -> str:
    """门型：`qualitative`（概念/设计类）或 `quantitative`（其余含未分类）。"""
    return "qualitative" if is_qualitative(kp_type) else "quantitative"


def gate_threshold(kp_type: str | None) -> float:
    """该类型的门阈；质性类型返回其显示值，供调用方始终拿到一个可展示的数。"""
    if is_qualitative(kp_type):
        return QUALITATIVE_PASS_DISPLAY
    return QUANTITATIVE_GATE.get((kp_type or ""), QUANTITATIVE_DEFAULT)


def compute_mastery(correctness: Iterable[bool]) -> float:
    """近因加权正确率（0..1）：只取最近 5 次，并按作答次数钳置信上限；空序列 0.0。"""
    outcomes = list(correctness)
    if not outcomes:
        return 0.0
    recent = outcomes[-len(RECENCY_WEIGHTS):]
    weights = RECENCY_WEIGHTS[-len(recent):]
    score = sum(w * (1.0 if c else 0.0) for c, w in zip(recent, weights, strict=True)) / sum(weights)
    return min(score, CONFIDENCE_CAP.get(len(recent), 1.0))


def assess_refusal(kp_type: str | None) -> str:
    """质性判定不适用于该类型时的拒绝文案（空串＝可受理，端点据此转 409）。"""
    if is_qualitative(kp_type):
        return ""
    return f"{kp_type or '未分类'} 是量化门知识点，按答题判分序列过门，不接受质性判定"


def build_state(
    *,
    unit_id: str,
    kp_id: str = "",
    kp_type: str | None = None,
    correctness: Iterable[bool] = (),
    qualitative_passed: bool | None = None,
    assessed_by: str = "",
    learner_claimed: bool = False,
    due_reviews: int = 0,
) -> dict[str, Any]:
    """一个知识点的门态行（分数与结论一律即时派生，不落列）。"""
    outcomes = list(correctness)
    kind = gate_kind(kp_type)
    threshold = gate_threshold(kp_type)
    score = compute_mastery(outcomes)
    passed = bool(qualitative_passed) if qualitative_passed is not None else False

    if kind == "qualitative":
        assessed_mastered = passed
        display = QUALITATIVE_PASS_DISPLAY if passed else score
        system_mastered = passed and assessed_by == ASSESSED_BY_MODEL
    else:
        assessed_mastered = score >= threshold
        display = score
        system_mastered = assessed_mastered

    learner_mastered = learner_claimed or (kind == "qualitative" and passed)
    provenance = PROVENANCE_SYSTEM if system_mastered else (
        PROVENANCE_LEARNER if learner_mastered else ""
    )
    seen = bool(outcomes) or qualitative_passed is not None
    status = "mastered" if provenance else ("learning" if seen else "new")
    return {
        "unit_id": unit_id,
        "kp_id": kp_id,
        "kp_type": kp_type or "",
        "gate": kind,
        "threshold": round(threshold, 3),
        "attempt_count": len(outcomes),
        "mastery": round(display, 3),
        "assessed_mastered": assessed_mastered,
        "mastered": bool(provenance),
        "provenance": provenance,
        "status": status,
        "qualitative_passed": qualitative_passed,
        "assessed_by": assessed_by,
        "due_reviews": due_reviews,
    }


def next_step(states: Sequence[dict[str, Any]]) -> dict[str, Any]:
    """推进游标＝第一个未掌握的知识点行（门就是游标，无手改游标列）。

    优先级照参照 `policy.next_objective`，pending 态按 M2 壳缝 5 已裁不移植：
    到期复习 → 第一个未掌握 → 结课。
    """
    for state in states:
        if state.get("due_reviews"):
            return {"action": "review", "unit_id": state["unit_id"], "kp_id": state["kp_id"],
                    "reason": "该知识点有到期复习任务，先复习再推进"}
    for state in states:
        if state["mastered"]:
            continue
        if state["status"] == "new":
            return {"action": "probe", "unit_id": state["unit_id"], "kp_id": state["kp_id"],
                    "reason": "该知识点尚未作答，先探查是否已经会了"}
        if state["gate"] == "qualitative":
            return {"action": "assess", "unit_id": state["unit_id"], "kp_id": state["kp_id"],
                    "reason": "质性门未过：用自己的话讲一遍并记录判定"}
        return {"action": "practice", "unit_id": state["unit_id"], "kp_id": state["kp_id"],
                "reason": "量化门未过：继续答题直到近因加权正确率过门"}
    return {"action": "complete", "unit_id": "", "kp_id": "", "reason": "全部知识点已掌握且无到期复习"}


def mastery_summary(states: Sequence[dict[str, Any]]) -> dict[str, int]:
    """三态计数（读时派生，随勾选与判分即时变化，不做累加）。"""
    counts = {"total": len(states), "mastered": 0, "learning": 0, "new": 0}
    for state in states:
        counts[state["status"]] += 1
    return counts


__all__ = [
    "ASSESSED_BY_LEARNER",
    "ASSESSED_BY_MODEL",
    "CONFIDENCE_CAP",
    "PROVENANCE_LEARNER",
    "PROVENANCE_SYSTEM",
    "QUALITATIVE_TYPES",
    "RECENCY_WEIGHTS",
    "assess_refusal",
    "build_state",
    "compute_mastery",
    "gate_kind",
    "gate_threshold",
    "is_qualitative",
    "mastery_summary",
    "next_step",
]
