"""主链 M-3 门与判分规则层单测（纯函数，不依赖 LLM、网络与数据库）。

模块职责：守护承载壳 [学习设计轮主链](../docs/plans/2026-09-22-learning-design-mainline.md)
「M-3 门与判分契约设计稿」冻结的规则本体——近因加权正确率（权重 `(0.5,0.7,0.85,0.95,1.0)`
取最近 5 次）与防蒙对置信上限 `{1:0.5, 2:0.8}`、按知识点四分类分流的门阈
（memory/procedure=0.9，concept/design 走质性判定且显示值 1.0，空型回落 0.9 量化门）、
质性判定的类型 refusal、provenance `system`/`learner` 双通路区分（学习者勾选与自评位
可推进路线但不得冒充系统判定）、`new`/`learning`/`mastered` 三态，以及
「门就是游标」的推进优先级（到期复习 → 第一个未掌握 → 结课）。
批复口径：D-M3-1 门即游标、D-M3-2 质性门 v1 取学习者自评位、D-M3-3 读主表类型现值、
D-M3-4 无题源与未归档题一律「不猜」、D-M3-5 本轮只出后端。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/services/learn/mastery.py
失效后果：掌握门阈值被污染（单次蒙对即可过门）或学习者自评被报成系统判定，
          结课与断点按错误游标推进，主链行 S3 判据失效
"""

from __future__ import annotations

import pytest
from qed_engine.services.learn.mastery import (
    assess_refusal,
    build_state,
    compute_mastery,
    gate_kind,
    gate_threshold,
    mastery_summary,
    next_step,
)

# ---------- 量化门：近因加权与防蒙对上限（参照 learning/mastery.py:17,21,24-37） ----------


def test_compute_mastery_of_empty_sequence_is_zero():
    """D-M3-4 不猜：零作答返回 0.0，不返回 None、不默认及格。"""
    assert compute_mastery([]) == 0.0


def test_compute_mastery_caps_one_and_two_attempt_confidence():
    """单次蒙对封顶 0.5、两次全对封顶 0.8，都低于 0.9 门阈。"""
    assert compute_mastery([True]) == 0.5
    assert compute_mastery([True, True]) == 0.8


def test_compute_mastery_needs_three_attempts_to_clear_the_gate():
    """三次全对是过门下限：置信上限在 n≥3 解除。"""
    assert compute_mastery([True, True, True]) == 1.0


def test_compute_mastery_uses_the_last_five_attempts_only():
    """窗口只取最近 5 次：早期三次连错的拖累随窗口滑动而衰减。

    权重和＝`0.5+0.7+0.85+0.95+1.0＝4.0`。6 次作答 F·F·F·T·T·T 的最近 5 次是
    F·F·T·T·T，加权 `(0.85+0.95+1.0)/4.0＝0.7`；再往后两次把首个 `F` 挤出窗口，
    最近 5 次全对直接到 1.0。
    """
    assert compute_mastery([False, False, False, True, True, True]) == pytest.approx(0.7)
    assert compute_mastery([False, False, False, True, True, True, True, True]) == 1.0


def test_compute_mastery_weights_are_recency_ordered():
    """同样两次答对，靠近现在的两次得分更高（权重老→新递增）。"""
    early = compute_mastery([True, True, False, False, False])
    late = compute_mastery([False, False, False, True, True])
    assert early == pytest.approx(0.3)      # (0.5+0.7)/4.0
    assert late == pytest.approx(0.4875)    # (0.95+1.0)/4.0
    assert late > early


# ---------- 门阈与门型分流（参照 learning/policy.py:35-45,73-78） ----------


def test_gate_threshold_by_knowledge_type():
    assert gate_threshold("memory") == 0.9
    assert gate_threshold("procedure") == 0.9
    assert gate_threshold("concept") == 1.0
    assert gate_threshold("design") == 1.0


def test_gate_threshold_falls_back_to_quantitative_default():
    """D-M3-3：主表类型缺失（空串/None）按 0.9 量化门回落，不猜成质性门。"""
    assert gate_threshold("") == 0.9
    assert gate_threshold(None) == 0.9
    assert gate_kind("concept") == "qualitative"
    assert gate_kind("memory") == "quantitative"
    assert gate_kind(None) == "quantitative"


def test_assess_refusal_blocks_quantitative_types():
    """质性判定只收 concept/design；量化型给出可行动拒绝文案。"""
    assert assess_refusal("concept") == ""
    assert assess_refusal("design") == ""
    for kp_type in ("memory", "procedure", "", None):
        refusal = assess_refusal(kp_type)
        assert refusal and "量化" in refusal


# ---------- 门态行：三态、provenance 与显示分（参照 learning/policy.py:81-128） ----------


def test_build_state_below_gate_is_learning_not_mastered():
    """两次作答一对一错：加权 0.487（未过 0.9）→ learning，非掌握、无 provenance。"""
    state = build_state(unit_id="u1", kp_id="kp1", kp_type="memory", correctness=[True, False])
    assert state["gate"] == "quantitative" and state["threshold"] == 0.9
    assert state["attempt_count"] == 2 and state["mastery"] == 0.487
    assert state["assessed_mastered"] is False and state["mastered"] is False
    assert state["provenance"] == "" and state["status"] == "learning"


def test_build_state_clears_gate_with_system_provenance():
    state = build_state(unit_id="u1", kp_id="kp1", kp_type="procedure",
                        correctness=[True, True, True])
    assert state["assessed_mastered"] is True and state["mastered"] is True
    assert state["provenance"] == "system" and state["status"] == "mastered"


def test_untouched_knowledge_point_reports_new_and_zero():
    """D-M3-4 零题源知识点：门型与门阈照给，分数 0.0，状态 new，不冒充判定。"""
    state = build_state(unit_id="u1", kp_id="kp1", kp_type="memory")
    assert state["mastery"] == 0.0 and state["attempt_count"] == 0
    assert state["status"] == "new" and state["provenance"] == ""
    assert state["mastered"] is False and state["qualitative_passed"] is None


def test_learner_claim_advances_the_route_without_claiming_the_gate():
    """学习者勾选可推进，但 `assessed_mastered` 与 provenance 不得冒充系统判定。"""
    state = build_state(unit_id="u1", kp_id="kp1", kp_type="memory",
                        correctness=[True], learner_claimed=True)
    assert state["assessed_mastered"] is False
    assert state["mastered"] is True and state["provenance"] == "learner"
    assert state["status"] == "mastered"


def test_qualitative_self_assessment_is_learner_provenance_in_v1():
    """D-M3-2 v1：自评讲清＝质性门过，显示分定 1.0，来源记 learner。"""
    state = build_state(unit_id="u2", kp_id="kp2", kp_type="concept",
                        qualitative_passed=True, assessed_by="learner")
    assert state["gate"] == "qualitative" and state["threshold"] == 1.0
    assert state["mastery"] == 1.0 and state["mastered"] is True
    assert state["provenance"] == "learner" and state["status"] == "mastered"


def test_qualitative_model_judgement_is_system_provenance():
    """M-3b 预留：`assessed_by=model` 才计系统判定。"""
    state = build_state(unit_id="u2", kp_id="kp2", kp_type="design",
                        qualitative_passed=True, assessed_by="model")
    assert state["assessed_mastered"] is True and state["provenance"] == "system"


def test_failed_qualitative_assessment_still_counts_as_seen():
    """判不过的质性尝试留痕：状态 learning（非 new），且未掌握。"""
    state = build_state(unit_id="u2", kp_id="kp2", kp_type="concept",
                        qualitative_passed=False, assessed_by="learner")
    assert state["mastered"] is False and state["status"] == "learning"
    assert state["mastery"] == 0.0


# ---------- 门即游标：推进优先级（参照 learning/policy.py:206-288） ----------


def test_next_step_prefers_due_review_even_on_mastered_point():
    states = [
        build_state(unit_id="u1", kp_id="kp1", kp_type="memory", correctness=[True] * 5),
        build_state(unit_id="u2", kp_id="kp2", kp_type="memory",
                    correctness=[True] * 3, due_reviews=2),
    ]
    step = next_step(states)
    assert step["action"] == "review" and step["unit_id"] == "u2"


def test_next_step_skips_mastered_and_names_the_gate_action():
    """D-M3-1 批复 A：掌握即跳过，游标＝第一个未掌握知识点行；动作按状态与门型取。"""
    mastered = build_state(unit_id="u1", kp_id="kp1", kp_type="memory", correctness=[True] * 5)
    practice = build_state(unit_id="u2", kp_id="kp2", kp_type="procedure", correctness=[False])
    step = next_step([mastered, practice])
    assert (step["unit_id"], step["action"]) == ("u2", "practice")
    untouched = build_state(unit_id="u3", kp_id="kp3", kp_type="concept")
    assert next_step([mastered, untouched])["action"] == "probe"
    assessed = build_state(unit_id="u4", kp_id="kp4", kp_type="concept",
                           qualitative_passed=False, assessed_by="learner")
    assert next_step([mastered, assessed])["action"] == "assess"


def test_next_step_completes_when_every_point_is_mastered():
    states = [
        build_state(unit_id="u1", kp_id="kp1", kp_type="memory", correctness=[True] * 5),
        build_state(unit_id="u2", kp_id="kp2", kp_type="concept", learner_claimed=True),
    ]
    assert next_step(states) == {"action": "complete", "unit_id": "", "kp_id": "",
                                 "reason": "全部知识点已掌握且无到期复习"}
    assert next_step([])["action"] == "complete"


def test_mastery_summary_counts_the_three_states():
    states = [
        build_state(unit_id="u1", kp_id="kp1", kp_type="memory", correctness=[True] * 5),
        build_state(unit_id="u2", kp_id="kp2", kp_type="memory", correctness=[False]),
        build_state(unit_id="u3", kp_id="kp3", kp_type="concept"),
    ]
    assert mastery_summary(states) == {"total": 3, "mastered": 1, "learning": 1, "new": 1}
