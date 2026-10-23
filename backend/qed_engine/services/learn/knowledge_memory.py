"""知识点主表的内存实现（M5 语义 + M6 层级）：契约测试注入 + 数据库未接入期降级。

模块职责：InMemoryKnowledgeStore——主表层级（outline 目录节点 / point 细知识点）、
point 行直登记（`add_point`）、多角度索引追加（`append_angle`）与目录整树幂等替换
（同名复用 kp_id、失父 point 归未归档池）的进程内实现，接口与 MySQLKnowledgeStore 同形。
候选池 `qe_kp_detail` 及其六枚方法已随 ADR 0026 D1/D10 退出。
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
from qed_engine.services.learn.knowledge import (
    ANGLE_KINDS,
    KP_TYPES,
    WRITER,
    flatten_outline,
    norm_key,
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


class InMemoryKnowledgeStore:
    """知识点主表（outline + point 两层，含别名 / 长文指针 / 角度索引）的进程内存储。"""

    def __init__(self) -> None:
        self.points: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()

    # ---------- 知识点主数据（point 行） ----------

    def add_point(
        self,
        *,
        course_id: str,
        name: str,
        domain_id: str = "",
        domain_label: str = "",
        course_label: str = "",
        parent_kp_id: str | None = None,
        type: str | None = None,
        summary: str = "",
        aliases: list[str] | None = None,
        narrative_ref: str = "",
        anchors: Any = None,
        order_hint: int | None = None,
        from_detail_id: str = "",
    ) -> dict[str, Any]:
        """直登记一条 point 行＝候选池退役后主表的唯一产面（与 MySQL 实现同校验口径）。"""
        if not str(course_id or "").strip():
            raise LearnConflict("course_id 不可为空")
        if not str(name or "").strip():
            raise LearnConflict("name 不可为空")
        if type is not None and type not in KP_TYPES:
            raise LearnConflict(f"type 必须是 {KP_TYPES} 之一")
        key = norm_key(name)
        with self._lock:
            if parent_kp_id:
                parent = self.points.get(parent_kp_id)
                if parent is None:
                    raise LearnNotFound(f"父级知识点不存在：{parent_kp_id}")
                if parent["node_kind"] != "outline" or parent["course_id"] != course_id:
                    raise LearnConflict("point 行的父级必须是同课程下的 outline 行")
            if any(
                point["course_id"] == course_id
                and point["norm_key"] == key
                and point["node_kind"] == "point"
                for point in self.points.values()
            ):
                raise LearnConflict(f"该课程下同名知识点已存在（norm_key={key}），请走合并")
            kp_id = f"kp-{uuid.uuid4().hex[:12]}"
            now = _now()
            point = {
                "kp_id": kp_id,
                "domain_id": domain_id,
                "domain_label": domain_label,
                "course_id": course_id,
                "course_label": course_label,
                "node_kind": "point",
                "parent_kp_id": parent_kp_id,
                "depth": None,
                "book_ref": None,
                "name": name,
                "aliases": list(aliases or []),
                "norm_key": key,
                "type": type,
                "order_hint": order_hint,
                "summary": summary,
                "narrative_ref": narrative_ref or "",
                "angles": [],
                "source_ref": None,
                "anchors": anchors or [],
                "from_detail_id": from_detail_id or None,
                "meta": None,
                "created_by": WRITER,
                "updated_by": WRITER,
                "created_at": now,
                "updated_at": now,
            }
            self.points[kp_id] = point
            return dict(point)

    def append_angle(self, kp_id: str, angle: str, *, note: str = "") -> dict[str, Any]:
        """`angles` 追加一元素＝按需生成注解条级腿的新落点（同角不堆叠、只更新 note）。"""
        if angle not in ANGLE_KINDS:
            raise LearnConflict(f"angle 必须是 {ANGLE_KINDS} 之一")
        with self._lock:
            row = self.get_point(kp_id)
            angles = [dict(item) for item in (row["angles"] or []) if isinstance(item, dict)]
            entry = next((item for item in angles if item.get("angle") == angle), None)
            if entry is None:
                entry = {"angle": angle}
                angles.append(entry)
            if note:
                entry["note"] = note
            row["angles"] = angles
            row["updated_by"] = WRITER
            row["updated_at"] = _now()
            self.points[kp_id] = row
            return dict(row)

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
        """星图节点徽标：{course_id: {confirmed}}（只数 point 行，章名不计入；候选位随池表退出）。"""
        counts: dict[str, dict[str, int]] = {}
        with self._lock:
            for point in self.points.values():
                if point["node_kind"] == "point":
                    counts.setdefault(point["course_id"], {})["confirmed"] = (
                        counts.get(point["course_id"], {}).get("confirmed", 0) + 1
                    )
        for entry in counts.values():
            entry.setdefault("confirmed", 0)
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
            if "summary" in fields:
                row["summary"] = fields["summary"]
            if "meta" in fields:
                merged = dict(row.get("meta") or {})
                merged.update(fields["meta"] or {})
                row["meta"] = merged
            row["updated_by"] = WRITER
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

    def replace_outline(
        self,
        course_id: str,
        book_ref: str,
        tree: list[dict[str, Any]],
        *,
        domain_id: str = "",
        domain_label: str = "",
        course_label: str = "",
    ) -> dict[str, Any]:
        """整树幂等替换同 book_ref 的 outline 子树；point 行不删，失父者归未归档池。

        坐标由调用方传入，与 MySQLKnowledgeStore 同形（REQ-118 D1）。"""
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
                        "domain_id": domain_id,
                        "domain_label": domain_label,
                        "course_id": course_id,
                        "course_label": course_label,
                        "node_kind": "outline",
                        "parent_kp_id": node["parent_kp_id"],
                        "depth": node["depth"],
                        "book_ref": book_ref,
                        "name": node["name"],
                        "aliases": [],
                        "norm_key": key,
                        "type": None,
                        "order_hint": index + 1,
                        "summary": node.get("summary", ""),
                        "narrative_ref": "",
                        "angles": [],
                        "source_ref": node["source_ref"],
                        "anchors": [],
                        "from_detail_id": None,
                        "meta": None,
                        "created_by": WRITER,
                        "updated_by": WRITER,
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
                        "domain_id": domain_id,
                        "domain_label": domain_label,
                        "course_label": course_label,
                        "updated_by": WRITER,
                        "updated_at": now,
                    }
                if "summary" in node:
                    # 未提交 summary 的节点保持原值（REQ-114 S2）
                    self.points[kp_id]["summary"] = node["summary"]
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
