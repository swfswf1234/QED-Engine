"""学习域存储的内存实现：契约测试与联调降级用（接口与 MySQL 实现同形）。

模块职责：InMemoryLearnStore——三表语义（课程 carry 编译作业、单元树两级、进度派生基）
的进程内实现；线程锁保护编译后台线程读写。生产默认走 MySQL（qe_learn_*），
测试注入本类（隔离铁律：默认测试不写运行数据库）。
设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
关联测试：tests/test_learn.py
"""

from __future__ import annotations

import threading
import uuid
from datetime import UTC, datetime
from typing import Any

from qed_engine.services.learn.base import (
    LearnConflict,
    LearnNotFound,
    _progress_view,
    has_page_window,
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


class InMemoryLearnStore:
    """学习域三表内存存储。"""

    def __init__(self) -> None:
        self.courses: dict[str, dict[str, Any]] = {}
        self.units: dict[str, dict[str, Any]] = {}
        self.progress: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()

    # ---------- 课程 ----------

    def create_course(self, *, name: str, resources: list[dict[str, str]], **fields: Any) -> dict[str, Any]:
        with self._lock:
            course_id = f"lc-{uuid.uuid4().hex[:12]}"
            row = {
                "learn_course_id": course_id,
                "name": name,
                "domain_ref": fields.get("domain_ref"),
                "course_ref": fields.get("course_ref"),
                "direction": fields.get("direction", ""),
                "resources": resources,
                "compile_status": None,
                "compile_done": 0,
                "compile_total": 0,
                "failure_count": 0,
                "page_windows": None,
                "compile_fingerprint": None,
                "instructions": fields.get("instructions", ""),
                "agent_notes": fields.get("agent_notes", ""),
                "created_at": _now(),
                "updated_at": _now(),
            }
            self.courses[course_id] = row
            return dict(row)

    def get_course(self, course_id: str) -> dict[str, Any]:
        with self._lock:
            row = self.courses.get(course_id)
            if row is None:
                raise LearnNotFound(course_id)
            return dict(row)

    def list_courses(self) -> list[dict[str, Any]]:
        with self._lock:
            return sorted((dict(r) for r in self.courses.values()), key=lambda r: r["created_at"])

    def update_course(self, course_id: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            row = self.get_course(course_id)
            row.update(fields)
            row["updated_at"] = _now()
            self.courses[course_id] = row
            return dict(row)

    def delete_course(self, course_id: str) -> None:
        with self._lock:
            self.get_course(course_id)
            del self.courses[course_id]
            unit_ids = {u for u, r in self.units.items() if r["learn_course_id"] == course_id}
            for u in unit_ids:
                self.units.pop(u, None)
                self.progress.pop(u, None)

    # ---------- 单元树 ----------

    def _course_units(self, course_id: str) -> list[dict[str, Any]]:
        rows = [r for r in self.units.values() if r["learn_course_id"] == course_id]
        return sorted(rows, key=lambda r: (r["sort_index"],))

    def replace_tree(self, course_id: str, nodes: list[dict[str, Any]]) -> None:
        """整树草稿覆写：旧行连同进度一并清除（重编换代归 M-2 版本位负责，此处是草稿态）。"""
        with self._lock:
            self.get_course(course_id)
            for u in [x for x in list(self.units) if self.units[x]["learn_course_id"] == course_id]:
                self.units.pop(u, None)
                self.progress.pop(u, None)
            seq = 0

            def _insert(node: dict[str, Any], parent: str | None, level: str) -> None:
                nonlocal seq
                seq += 1
                unit_id = f"lu-{uuid.uuid4().hex[:12]}"
                self.units[unit_id] = {
                    "unit_id": unit_id,
                    "learn_course_id": course_id,
                    "parent_id": parent,
                    "level": level,
                    "title": node["title"],
                    "sort_order": node.get("order", seq),
                    "sort_index": seq,
                    "confirmed": bool(node.get("confirmed", False)),
                    "covered": False,
                    "type": str(node.get("type") or "text"),
                    "payload": dict(node.get("payload") or {}),
                    "source_ref": dict(node["source_ref"]) if node.get("source_ref") else None,
                    "gen_status": "pending",
                    "active": True,
                    "created_at": _now(),
                    "updated_at": _now(),
                }
                for child in node.get("children") or []:
                    # 深度守卫在路由层（≤3 级）：L1=section，L2/L3=unit（块）
                    _insert(child, unit_id, "unit")

            for n in nodes:
                _insert(n, None, "section")

    def get_unit(self, unit_id: str) -> dict[str, Any]:
        with self._lock:
            row = self.units.get(unit_id)
            if row is None:
                raise LearnNotFound(unit_id)
            return dict(row)

    def patch_unit(self, unit_id: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            row = self.get_unit(unit_id)
            if fields.get("covered") is True and not row["confirmed"]:
                raise LearnConflict("未 confirmed 的单元不可勾选 covered")
            row.update(fields)
            row["updated_at"] = _now()
            self.units[unit_id] = row
            return dict(row)

    def list_units(self, course_id: str, level: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            self.get_course(course_id)
            rows = self._course_units(course_id)
            if level:
                rows = [r for r in rows if r["level"] == level]
            return [dict(r) for r in rows]

    # ---------- 编译作业（课程行自 carry，D3 裁决） ----------

    def active_units(self, course_id: str) -> list[dict[str, Any]]:
        with self._lock:
            return [r for r in self._course_units(course_id) if r["level"] == "unit" and r["active"]]

    def start_compile(self, course_id: str) -> dict[str, Any]:
        with self._lock:
            course = self.get_course(course_id)
            if course["compile_status"] == "running":
                raise LearnConflict("已有编译在跑")
            rows = self._course_units(course_id)
            if not rows:
                raise LearnConflict("两级确认未齐备（树为空）")
            if not all(r["confirmed"] for r in rows):
                raise LearnConflict("两级确认未齐备（存在未确认节点）")
            course = self.update_course(course_id, compile_status="running", failure_count=0)
            self._recount(course_id)
            return dict(course)

    def finish_compile(self, course_id: str) -> None:
        """M-1 骨架编译：活动 unit 行逐一置 generated，只补空位不覆写已声明的承载位。"""
        with self._lock:
            ref_id = (self.courses[course_id]["resources"] or [{}])[0].get("ref_id")
            for row in self.active_units(course_id):
                row = self.units[row["unit_id"]]
                row["gen_status"] = "generated"
                if not row["source_ref"]:
                    row["source_ref"] = {"ref_id": ref_id, "page": None, "block_index": None}
                if not has_page_window(row["source_ref"]) and not str(row["payload"].get("text") or ""):
                    row["payload"] = {"text": f"「{row['title']}」骨架正文（M-1 占位，M-2 接生成管线）"}
            self._recount(course_id)
            self.update_course(course_id, compile_status="completed")

    def _recount(self, course_id: str) -> None:
        rows = self.active_units(course_id)
        self.courses[course_id]["compile_total"] = len(rows)
        self.courses[course_id]["compile_done"] = sum(1 for r in rows if r["gen_status"] == "generated")

    # ---------- 进度派生基 ----------

    def ensure_point_unit(
        self,
        course_id: str,
        *,
        unit_id: str,
        kp_id: str,
        parent_id: str | None,
        title: str,
        sort_order: int,
        source_ref: dict[str, Any] | None,
        covered: bool,
    ) -> dict[str, Any]:
        """知识点派生键首次落笔才物化（与 MySQL 实现同语义，§V2.3 读时投影）。"""
        with self._lock:
            self.get_course(course_id)
            row = {
                "unit_id": unit_id,
                "learn_course_id": course_id,
                "parent_id": parent_id,
                "level": "point",
                "title": title,
                "sort_order": sort_order,
                "sort_index": sort_order,
                "confirmed": True,
                "covered": bool(covered),
                "type": None,
                "payload": {},
                "source_ref": {**(source_ref or {}), "kp_id": kp_id},
                "gen_status": "generated",
                "active": True,
                "created_at": _now(),
                "updated_at": _now(),
            }
            existing = self.units.get(unit_id)
            self.units[unit_id] = {**existing, **row} if existing else row
            return dict(self.units[unit_id])

    def set_progress(self, course_id: str, unit_id: str, status: str) -> dict[str, Any]:
        with self._lock:
            row = self.get_unit(unit_id)
            if row["learn_course_id"] != course_id:
                raise LearnNotFound(unit_id)
            if row["level"] != "point":
                raise LearnConflict("进度只可打在知识点行上（旧节/块行保留只读，§V2.3）")
            self.progress[unit_id] = {
                **self.progress.get(unit_id, {}),  # 勾选只写终态位，不抹质性门四列
                "unit_id": unit_id,
                "learn_course_id": course_id,
                "status": status,
                "updated_at": _now(),
            }
            return dict(self.progress[unit_id])

    def progress_rows(self, course_id: str) -> dict[str, dict[str, Any]]:
        with self._lock:
            return {
                str(row["unit_id"]): _progress_view(row)
                for row in self.progress.values()
                if row["learn_course_id"] == course_id
            }

    def assess_qualitative(
        self,
        course_id: str,
        unit_id: str,
        *,
        passed: bool,
        note: str = "",
        assessed_by: str = "learner",
    ) -> dict[str, Any]:
        """与 MySQL 实现同语义：判定四列独立成写，终态位缺省为 pending。"""
        with self._lock:
            row = self.get_unit(unit_id)
            if row["learn_course_id"] != course_id:
                raise LearnNotFound(unit_id)
            if row["level"] != "point":
                raise LearnConflict("质性判定只可打在知识点行上（旧节/块行保留只读，§V2.3）")
            stamp = _now()
            self.progress[unit_id] = {
                **self.progress.get(unit_id, {}),
                "unit_id": unit_id,
                "learn_course_id": course_id,
                "status": self.progress.get(unit_id, {}).get("status") or "pending",
                "qualitative_passed": bool(passed),
                "qualitative_note": note,
                "assessed_by": assessed_by,
                "assessed_at": stamp,
                "updated_at": stamp,
            }
            return _progress_view(self.progress[unit_id])

    def derived_progress(self, course_id: str, units: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        with self._lock:
            rows = self.active_units(course_id) if units is None else units
            total = len(rows)
            done = sum(1 for r in rows if self.progress.get(r["unit_id"], {}).get("status") == "done")
            skipped = sum(1 for r in rows if self.progress.get(r["unit_id"], {}).get("status") == "skipped")
            current = None
            for r in rows:
                if self.progress.get(r["unit_id"], {}).get("status") not in ("done", "skipped"):
                    current = r["unit_id"]
                    break
            return {
                "total": total,
                "done": done,
                "skipped": skipped,
                "percent": round(100.0 * done / total, 1) if total else 0.0,
                "current_unit_id": current,
                "completed": total > 0 and done + skipped == total,
            }

    def books_progress(self, course_id: str, units: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
        """教材级进度（与 MySQL 实现同语义）：计数单位行按 source_ref.ref_id 归集。"""
        with self._lock:
            rows = self.active_units(course_id) if units is None else units
            grouped: dict[str, dict[str, int]] = {}
            for row in rows:
                ref_id = str((row.get("source_ref") or {}).get("ref_id") or "")
                if not ref_id:
                    continue
                bucket = grouped.setdefault(ref_id, {"total": 0, "done": 0})
                bucket["total"] += 1
                if self.progress.get(row["unit_id"], {}).get("status") == "done":
                    bucket["done"] += 1
            return [
                {
                    "ref_id": ref_id,
                    "total": bucket["total"],
                    "done": bucket["done"],
                    "percent": round(100.0 * bucket["done"] / bucket["total"], 1),
                }
                for ref_id, bucket in grouped.items()
            ]
