"""知识点两表存储的内存实现（M5 语义 + M6 层级）：契约测试注入 + 数据库未接入期降级。

模块职责：InMemoryKnowledgeStore——主表层级（outline 目录节点 / point 细知识点）、
候选明细池（可多版本多叙述）与人工确认提升（norm_key 去重 409）、目录整树幂等替换
（同名复用 kp_id、失父 point 归未归档池）的进程内实现，接口与 MySQLKnowledgeStore 同形。
隔离铁律：默认测试走本类，不写运行数据库。
设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
关联测试：tests/test_learn_knowledge.py
"""

from __future__ import annotations

import threading
import uuid
from datetime import UTC, datetime
from typing import Any

from qed_engine.services.learn.base import LearnConflict, LearnNotFound
from qed_engine.services.learn.knowledge import OPEN_STATUSES, flatten_outline, norm_key


def _now() -> str:
    return datetime.now(UTC).isoformat()


class InMemoryKnowledgeStore:
    """知识点主表（含 outline 层级）+ 候选明细池的进程内存储。"""

    def __init__(self) -> None:
        self.points: dict[str, dict[str, Any]] = {}
        self.details: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()

    # ---------- 候选明细池 ----------

    def add_detail(
        self,
        *,
        course_id: str,
        name: str,
        domain_id: str = "",
        course_label: str = "",
        domain_label: str = "",
        narrative: str = "",
        type: str | None = None,
        payload: Any = None,
        anchors: Any = None,
        gen_batch: str = "",
        map_seed: str | None = None,
        model_ref: str = "",
        dedup_of: str | None = None,
        gen_status: str = "candidate",
        parent_kp_id: str | None = None,
        intent: str = "explanation",
        book_ref: str = "",
    ) -> dict[str, Any]:
        detail_id = f"kpd-{uuid.uuid4().hex[:12]}"
        now = _now()
        row = {
            "detail_id": detail_id,
            "domain_id": domain_id,
            "domain_label": domain_label,
            "course_id": course_id,
            "course_label": course_label,
            "kp_id": None,
            "parent_kp_id": parent_kp_id,
            "intent": intent,
            "book_ref": book_ref,
            "name": name,
            "norm_key": norm_key(name),
            "type": type,
            "narrative": narrative,
            "payload": payload or {},
            "anchors": anchors or [],
            "gen_batch": gen_batch,
            "map_seed": map_seed,
            "model_ref": model_ref,
            "gen_status": gen_status,
            "dedup_of": dedup_of,
            "confirmed": False,
            "created_at": now,
            "updated_at": now,
        }
        with self._lock:
            self.details[detail_id] = row
        return dict(row)

    def get_detail(self, detail_id: str) -> dict[str, Any]:
        with self._lock:
            row = self.details.get(detail_id)
        if row is None:
            raise LearnNotFound(f"候选明细不存在：{detail_id}")
        return dict(row)

    def list_details(
        self,
        *,
        course_id: str | None = None,
        gen_status: str | None = None,
        batch: str | None = None,
        parent_kp_id: str | None = None,
        unarchived: bool = False,
        limit: int = 200,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        with self._lock:
            rows = [
                dict(row)
                for row in self.details.values()
                if (not course_id or row["course_id"] == course_id)
                and (not gen_status or row["gen_status"] == gen_status)
                and (not batch or row["gen_batch"] == batch)
                and (not parent_kp_id or row["parent_kp_id"] == parent_kp_id)
                and (not unarchived or not row["parent_kp_id"])
            ]
        rows.sort(key=lambda r: (r["course_id"], r["gen_batch"], r["created_at"], r["detail_id"]))
        return rows[offset : offset + limit]

    def confirm_detail(self, detail_id: str) -> dict[str, Any]:
        with self._lock:
            detail = self.get_detail(detail_id)
            if detail["gen_status"] == "adopted" and detail["kp_id"] and detail["kp_id"] in self.points:
                return dict(self.points[detail["kp_id"]])
            if detail["gen_status"] == "rejected":
                raise LearnConflict("候选已驳回，需重新登记后再确认")
            key = detail["norm_key"]
            if any(
                point["course_id"] == detail["course_id"]
                and point["norm_key"] == key
                and point["node_kind"] == "point"
                for point in self.points.values()
            ):
                raise LearnConflict(f"该课程下同名知识点已存在（norm_key={key}），请走合并")
            kp_id = f"kp-{uuid.uuid4().hex[:12]}"
            now = _now()
            point = {
                "kp_id": kp_id,
                "domain_id": detail["domain_id"],
                "domain_label": detail["domain_label"],
                "course_id": detail["course_id"],
                "course_label": detail["course_label"],
                "node_kind": "point",
                "parent_kp_id": detail["parent_kp_id"],
                "depth": None,
                "book_ref": "",
                "name": detail["name"],
                "norm_key": key,
                "type": detail["type"],
                "order_hint": None,
                "summary": (detail["narrative"] or "")[:1000],
                "source_ref": None,
                "anchors": detail["anchors"],
                "from_detail_id": detail_id,
                "confirmed": True,
                "created_at": now,
                "updated_at": now,
            }
            self.points[kp_id] = point
            self.details[detail_id] = {**detail, "gen_status": "adopted", "kp_id": kp_id, "confirmed": True, "updated_at": now}
            return dict(point)

    def reject_detail(self, detail_id: str) -> dict[str, Any]:
        with self._lock:
            detail = self.get_detail(detail_id)
            self.details[detail_id] = {
                **detail,
                "gen_status": "rejected",
                "kp_id": None,
                "confirmed": False,
                "updated_at": _now(),
            }
            return dict(self.details[detail_id])

    # ---------- 知识点主数据（point 行） ----------

    def get_point(self, kp_id: str) -> dict[str, Any]:
        with self._lock:
            row = self.points.get(kp_id)
        if row is None:
            raise LearnNotFound(f"知识点不存在：{kp_id}")
        return dict(row)

    def list_points(
        self,
        *,
        domain_id: str | None = None,
        course_id: str | None = None,
        type: str | None = None,
        q: str | None = None,
        kind: str | None = "point",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        needle = (q or "").lower()
        with self._lock:
            rows = [
                dict(row)
                for row in self.points.values()
                if (not kind or row["node_kind"] == kind)
                and (not domain_id or row["domain_id"] == domain_id)
                and (not course_id or row["course_id"] == course_id)
                and (not type or row["type"] == type)
                and (
                    not needle
                    or needle in row["name"].lower()
                    or needle in (row["summary"] or "").lower()
                )
            ]
        rows.sort(key=lambda r: (r["course_id"], r["name"], r["kp_id"]))
        return rows[offset : offset + limit], len(rows)

    def counts_by_course(self) -> dict[str, dict[str, int]]:
        counts: dict[str, dict[str, int]] = {}
        with self._lock:
            ids = {point["course_id"] for point in self.points.values()} | {
                detail["course_id"] for detail in self.details.values()
            }
            for course_id in ids:
                counts[course_id] = {"confirmed": 0, "candidates": 0}
            for point in self.points.values():
                if point["node_kind"] == "point":
                    counts[point["course_id"]]["confirmed"] += 1
            for detail in self.details.values():
                if detail["gen_status"] in OPEN_STATUSES:
                    counts[detail["course_id"]]["candidates"] += 1
        return counts

    def patch_point(self, kp_id: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            row = self.get_point(kp_id)
            if "name" in fields:
                row["name"] = fields["name"]
                row["norm_key"] = norm_key(fields["name"])
            if "order_hint" in fields:
                row["order_hint"] = fields["order_hint"]
            if "parent_kp_id" in fields:
                row["parent_kp_id"] = fields["parent_kp_id"]
            row["updated_at"] = _now()
            self.points[kp_id] = row
            return dict(row)

    # ---------- 章节目录树（outline 行） ----------

    def list_outline(self, course_id: str, book_ref: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            rows = [
                dict(row)
                for row in self.points.values()
                if row["node_kind"] == "outline"
                and row["course_id"] == course_id
                and (not book_ref or row["book_ref"] == book_ref)
            ]
            rows.sort(key=lambda r: (r["order_hint"] if r["order_hint"] is not None else 9999, r["kp_id"]))
            for row in rows:
                row["point_count"] = sum(
                    1
                    for point in self.points.values()
                    if point["node_kind"] == "point" and point["parent_kp_id"] == row["kp_id"]
                )
        return rows

    def replace_outline(self, course_id: str, book_ref: str, tree: list[dict[str, Any]]) -> dict[str, Any]:
        """整树幂等替换同 book_ref 的 outline 子树；point 行不删，失父者归未归档池。"""
        flat = flatten_outline(tree, book_ref)
        with self._lock:
            existing = {
                (row["parent_kp_id"], row["norm_key"]): row["kp_id"]
                for row in self.points.values()
                if row["node_kind"] == "outline" and row["course_id"] == course_id and row["book_ref"] == book_ref
            }
            reused: set[str] = set()
            now = _now()
            for index, node in enumerate(flat):
                node["parent_kp_id"] = (
                    None if node["parent_idx"] is None else flat[node["parent_idx"]]["kp_id"]
                )
                key = norm_key(node["name"])
                kp_id = existing.get((node["parent_kp_id"], key))
                if kp_id is None:
                    kp_id = f"kp-{uuid.uuid4().hex[:12]}"
                    self.points[kp_id] = {
                        "kp_id": kp_id,
                        "domain_id": "",
                        "domain_label": "",
                        "course_id": course_id,
                        "course_label": "",
                        "node_kind": "outline",
                        "parent_kp_id": node["parent_kp_id"],
                        "depth": node["depth"],
                        "book_ref": book_ref,
                        "name": node["name"],
                        "norm_key": key,
                        "type": None,
                        "order_hint": index + 1,
                        "summary": "",
                        "source_ref": node["source_ref"],
                        "anchors": [],
                        "from_detail_id": None,
                        "confirmed": True,
                        "created_at": now,
                        "updated_at": now,
                    }
                else:
                    reused.add(kp_id)
                    row = self.points[kp_id]
                    self.points[kp_id] = {
                        **row,
                        "parent_kp_id": node["parent_kp_id"],
                        "depth": node["depth"],
                        "name": node["name"],
                        "order_hint": index + 1,
                        "source_ref": node["source_ref"],
                        "confirmed": True,
                        "updated_at": now,
                    }
                node["kp_id"] = kp_id
            dropped = [kp for kp in existing.values() if kp not in reused]
            orphaned = 0
            for kp_id in dropped:
                del self.points[kp_id]
            for point in self.points.values():
                if point["node_kind"] == "point" and point["parent_kp_id"] in dropped:
                    point["parent_kp_id"] = None
                    point["updated_at"] = now
                    orphaned += 1
            return {
                "reused": len(reused),
                "created": len(flat) - len(reused),
                "dropped": len(dropped),
                "orphaned_points": orphaned,
            }