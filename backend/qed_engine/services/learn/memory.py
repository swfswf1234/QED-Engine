"""学习记录单表的内存实现：契约测试注入 + 数据库未接入期降级。

模块职责：InMemoryLearnStore——`qe_learning` 单表继承（course 行＝选课与学习路径、
kp 行＝知识点终态与质性门）的进程内实现，接口与 base.MySQLLearnStore 同形，
投影与状态校验复用 base 的 `course_view` / `kp_view` / `_check_status`。
单元树 `qe_unit` 与编译作业列已随 ADR 0026 D2 退出：进度改为「知识点投影序列 × kp 行」
读时重算（派生纯函数在 base 尾部）。
隔离铁律：默认测试走本类，不写运行数据库。
设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
关联测试：tests/test_learn.py
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any

from qed_engine.services.learn.base import (
    _COURSE_UPDATABLE,
    ASSESSED_BY,
    COURSE_TARGET,
    DEFAULT_OWNER,
    KP_TARGET,
    LearnConflict,
    LearnNotFound,
    _check_status,
    _config,
    course_view,
    kp_view,
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


class InMemoryLearnStore:
    """`qe_learning` 单表的进程内存储（course 行 + kp 行，owner×目标唯一）。"""

    def __init__(self) -> None:
        self.rows: dict[tuple[str, str, str], dict[str, Any]] = {}
        self._lock = threading.RLock()

    # ---------- 行原语（与 MySQL 实现的 _row/_upsert/_delete 同语义） ----------

    def _row(self, owner: str, target_kind: str, target_id: str) -> dict[str, Any] | None:
        row = self.rows.get((owner, target_kind, str(target_id)))
        return dict(row) if row is not None else None

    def _put(self, row: dict[str, Any]) -> None:
        self.rows[(row["owner"], row["target_kind"], str(row["target_id"]))] = dict(row)

    def _delete(self, owner: str, target_kind: str, target_id: str) -> None:
        self.rows.pop((owner, target_kind, str(target_id)), None)

    def _kp_base_row(self, kp_id: str, owner: str) -> dict[str, Any]:
        existing = self._row(owner, KP_TARGET, kp_id) or {}
        return {
            **existing,
            "owner": owner,
            "target_kind": KP_TARGET,
            "target_id": str(kp_id),
            "status": existing.get("status") or "pending",
            "config": None,
            "qualitative_passed": existing.get("qualitative_passed"),
            "qualitative_note": existing.get("qualitative_note") or "",
            "assessed_by": existing.get("assessed_by") or "",
            "assessed_at": existing.get("assessed_at"),
            "learner_note": existing.get("learner_note"),
            "created_at": existing.get("created_at") or _now(),
            "updated_at": _now(),
        }

    # ---------- 选课（course 行） ----------

    def create_course(
        self,
        *,
        course_id: str,
        resources: list[dict[str, Any]],
        kp_path: Any = (),
        learner_note: str = "",
        owner: str = DEFAULT_OWNER,
    ) -> dict[str, Any]:
        if not str(course_id or "").strip():
            raise LearnConflict("course_id 不可为空（选课即引用共享 qed_course.course_id）")
        if not resources:
            raise LearnConflict("resources 至少一项")
        with self._lock:
            target_id = str(course_id)
            if self._row(owner, COURSE_TARGET, target_id) is not None:
                raise LearnConflict(f"该课程已在学习面：{course_id}")
            stamp = _now()
            row = {
                "owner": owner,
                "target_kind": COURSE_TARGET,
                "target_id": target_id,
                "status": "active",
                "config": _config(resources, kp_path),
                "qualitative_passed": None,
                "qualitative_note": "",
                "assessed_by": "",
                "assessed_at": None,
                "learner_note": learner_note,
                "created_at": stamp,
                "updated_at": stamp,
            }
            self._put(row)
            return course_view(row)

    def get_course(self, course_id: str, *, owner: str = DEFAULT_OWNER) -> dict[str, Any]:
        with self._lock:
            row = self._row(owner, COURSE_TARGET, course_id)
        if row is None:
            raise LearnNotFound(course_id)
        return course_view(row)

    def list_courses(self, *, owner: str = DEFAULT_OWNER) -> list[dict[str, Any]]:
        with self._lock:
            rows = [
                dict(row)
                for row in self.rows.values()
                if row["owner"] == owner and row["target_kind"] == COURSE_TARGET
            ]
        rows.sort(key=lambda r: str(r["created_at"]))
        return [course_view(row) for row in rows]

    def update_course(
        self, course_id: str, *, owner: str = DEFAULT_OWNER, **fields: Any
    ) -> dict[str, Any]:
        unknown = set(fields) - set(_COURSE_UPDATABLE)
        if unknown:
            raise LearnConflict(f"课程字段不可写：{sorted(unknown)}")
        course = self.get_course(course_id, owner=owner)
        if "status" in fields:
            course["status"] = _check_status(COURSE_TARGET, str(fields["status"]))
        if "resources" in fields:
            if not fields["resources"]:
                raise LearnConflict("resources 不可清空")
            course["resources"] = list(fields["resources"])
        if "kp_path" in fields:
            course["kp_path"] = [str(kp_id) for kp_id in (fields["kp_path"] or [])]
        if "learner_note" in fields:
            course["learner_note"] = str(fields["learner_note"] or "")
        with self._lock:
            row = self._row(owner, COURSE_TARGET, course_id) or {}
            self._put(
                {
                    **row,
                    "target_kind": COURSE_TARGET,
                    "status": course["status"],
                    "config": _config(course["resources"], course["kp_path"]),
                    "learner_note": course["learner_note"],
                    "updated_at": _now(),
                }
            )
        return self.get_course(course_id, owner=owner)

    def delete_course(self, course_id: str, *, owner: str = DEFAULT_OWNER) -> None:
        """只退选课行；kp 行是学习者对知识点的独立记录，跨课程共享，不随课程删除。"""
        with self._lock:
            if self._row(owner, COURSE_TARGET, course_id) is None:
                raise LearnNotFound(course_id)
            self._delete(owner, COURSE_TARGET, course_id)

    # ---------- 知识点终态与质性门（kp 行） ----------

    def kp_rows(self, *, owner: str = DEFAULT_OWNER) -> dict[str, dict[str, Any]]:
        with self._lock:
            rows = [
                dict(row)
                for row in self.rows.values()
                if row["owner"] == owner and row["target_kind"] == KP_TARGET
            ]
        return {str(row["target_id"]): kp_view(row) for row in rows}

    def get_kp_row(self, kp_id: str, *, owner: str = DEFAULT_OWNER) -> dict[str, Any]:
        with self._lock:
            row = self._row(owner, KP_TARGET, kp_id)
        if row is None:
            raise LearnNotFound(kp_id)
        return kp_view(row)

    def set_kp_status(
        self, kp_id: str, status: str, *, owner: str = DEFAULT_OWNER
    ) -> dict[str, Any]:
        """勾选落笔（done/skipped/pending）；`pending`＝撤销终态位，无质性判定痕迹时整行删除。"""
        _check_status(KP_TARGET, status)
        with self._lock:
            existing = self._row(owner, KP_TARGET, kp_id)
            if status == "pending":
                if existing is None:
                    return {"kp_id": str(kp_id), "status": "pending", "removed": True}
                if existing.get("qualitative_passed") is None:
                    self._delete(owner, KP_TARGET, kp_id)
                    return {"kp_id": str(kp_id), "status": "pending", "removed": True}
            self._put({**(existing or self._kp_base_row(kp_id, owner)), "status": status})
        return self.get_kp_row(kp_id, owner=owner)

    def assess_qualitative(
        self,
        kp_id: str,
        *,
        passed: bool,
        note: str = "",
        assessed_by: str = "learner",
        owner: str = DEFAULT_OWNER,
    ) -> dict[str, Any]:
        """质性门判定落 kp 行：只写判定四列，终态位 `status` 不动（门与勾选各写各的列）。"""
        if assessed_by not in ASSESSED_BY:
            raise LearnConflict(f"assessed_by 必须是 {ASSESSED_BY} 之一")
        with self._lock:
            merged = self._kp_base_row(kp_id, owner)
            merged.update(
                qualitative_passed=int(bool(passed)),
                qualitative_note=note,
                assessed_by=assessed_by,
                assessed_at=_now(),
            )
            self._put(merged)
        return self.get_kp_row(kp_id, owner=owner)

    def set_note(
        self, target_kind: str, target_id: str, text: str, *, owner: str = DEFAULT_OWNER
    ) -> dict[str, Any]:
        """学习者备注（人工位，R6）：course 行与 kp 行通用；行不存在不起新行（404）。"""
        kind = COURSE_TARGET if target_kind == COURSE_TARGET else KP_TARGET
        with self._lock:
            row = self._row(owner, kind, target_id)
            if row is None:
                raise LearnNotFound(target_id)
            merged = {**row, "learner_note": str(text or ""), "updated_at": _now()}
            self._put(merged)
        return course_view(merged) if kind == COURSE_TARGET else kp_view(merged)
