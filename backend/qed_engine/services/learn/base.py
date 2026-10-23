"""学习域（learn）存储服务基座：异常分层 + `qe_learning` 幂等建表 + 学习记录存储。

模块职责：定义学习记录单表 `qe_learning`（单表继承两型行：course 行＝选课与学习路径、
kp 行＝知识点终态与质性门）的存储契约与异常映射（NotFound→404、Conflict→409），并给出
MySQL 实现 `MySQLLearnStore`（接口与 `InMemoryLearnStore` 同形，懒挂载见 api/learn.py）。
课程百分比、结课态与教材级进度一律读时重算、不落列，派生入口在本模块尾部两个纯函数。
表结构与列面事实源＝docs/architecture/database-design.md §五（两侧 DDL 逐字相等，
由 tests/contract/test_architecture_documents.py 守护）。
设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
关联测试：tests/test_learn.py
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

import pymysql

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS qe_learning (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '行 ID（自增主键）',
  owner VARCHAR(64) NOT NULL DEFAULT 'admin' COMMENT '学习者标识（v1.0 恒 admin，多用户扩展位）',
  target_kind VARCHAR(16) NOT NULL COMMENT '闭集 course=学习课程行 / kp=知识点行（单表继承）',
  target_id VARCHAR(64) NOT NULL COMMENT 'course 行=共享 qed_course.course_id；kp 行=共享 qed_knowledge_point.kp_id（只引用不复制，不存名称快照）',
  status VARCHAR(16) NOT NULL COMMENT 'course 行：active/paused/done；kp 行：done/skipped/pending（pending＝只有质性判定或撤销痕迹，不计入完成数；未落笔=无行）',
  config JSON COMMENT 'course 行专用：{resources:[{kind,ref_id,label}],kp_path:[kp_id…]}；kp 行 NULL（整行读出、不内部筛选）',
  qualitative_passed TINYINT(1) NULL COMMENT 'kp 行专用：质性门结论 1/0，NULL=未判（仅 concept/design 知识点有值）',
  qualitative_note VARCHAR(1000) DEFAULT '' COMMENT 'kp 行专用：判读证据一句话（v1 只存学习者自评理由；不含密钥）',
  assessed_by VARCHAR(16) DEFAULT '' COMMENT 'kp 行专用：provenance learner=自评位／model=预留（本轮端点拒绝）',
  assessed_at DATETIME NULL COMMENT 'kp 行专用：最近一次质性判定 UTC 时刻',
  learner_note TEXT NULL COMMENT '学习者备注（课程级与知识点级通用；人工位，机器不写）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  UNIQUE KEY uq_learning_target (owner, target_kind, target_id),
  KEY idx_learning_course (owner, target_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='学习记录（owner×目标×状态单表：course 行=选课与学习路径，kp 行=终态与质性门；进度百分比与掌握分读时重算，所有权 QED-Engine）';
"""


DEFAULT_OWNER = "admin"
COURSE_TARGET = "course"
KP_TARGET = "kp"
COURSE_STATUSES = ("active", "paused", "done")
KP_STATUSES = ("done", "skipped", "pending")
ASSESSED_BY = ("learner", "model")

_LEARNING_COLUMNS = (
    "owner, target_kind, target_id, status, config, qualitative_passed, qualitative_note, "
    "assessed_by, assessed_at, learner_note, created_at, updated_at"
)
_LEARNING_FIELDS = tuple(_LEARNING_COLUMNS.replace(" ", "").split(","))
_COURSE_UPDATABLE = ("status", "resources", "kp_path", "learner_note")


class LearnNotFound(Exception):
    """实体不存在 → 404。"""


class LearnConflict(Exception):
    """状态机非法转移 → 409。"""


def ensure_tables(settings: Any) -> None:
    """幂等建表（R10：根侧不引迁移框架，首个端点请求懒建）；数据库不可达由调用方降级。"""
    from qed_engine.services.llm.call_log import _connect

    conn = _connect(settings)
    try:
        with conn.cursor() as cursor:
            for statement in CREATE_TABLE_SQL.split(";"):
                sql = statement.strip()
                if sql:
                    cursor.execute(sql)
        conn.commit()
    finally:
        conn.close()


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _iso(value: Any) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else (value or None)


def _to_json(value: Any) -> str | None:
    return None if value is None else json.dumps(value, ensure_ascii=False)


def _from_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


def _config(resources: list[dict[str, Any]], kp_path: Iterable[str]) -> dict[str, Any]:
    return {"resources": list(resources or []), "kp_path": [str(kp_id) for kp_id in kp_path or ()]}


def _check_status(target_kind: str, status: str) -> str:
    closed = COURSE_STATUSES if target_kind == COURSE_TARGET else KP_STATUSES
    if status not in closed:
        raise LearnConflict(f"{target_kind} 行 status 必须是 {closed} 之一，收到 {status!r}")
    return status


def course_view(row: dict[str, Any]) -> dict[str, Any]:
    """course 行归一投影（两实现同形）：`config` 摊平；`learn_course_id`＝共享课程 ID（ADR 0026 D4）。

    `owner` 列不进投影（D7）：它只承载唯一键前缀与多用户扩展位，本域契约面不收不回显。
    """
    config = row.get("config") or {}
    return {
        "learn_course_id": str(row["target_id"]),
        "status": str(row["status"]),
        "resources": list(config.get("resources") or []),
        "kp_path": [str(kp_id) for kp_id in (config.get("kp_path") or [])],
        "learner_note": str(row.get("learner_note") or ""),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
    }


def kp_view(row: dict[str, Any]) -> dict[str, Any]:
    """kp 行归一投影（两实现同形）：质性门 TINYINT→三态 bool/None，时刻→isoformat；`owner` 不出面（D7）。"""
    gate = row.get("qualitative_passed")
    return {
        "kp_id": str(row["target_id"]),
        "status": str(row["status"]),
        "qualitative_passed": None if gate is None else bool(gate),
        "qualitative_note": str(row.get("qualitative_note") or ""),
        "assessed_by": str(row.get("assessed_by") or ""),
        "assessed_at": _iso(row.get("assessed_at")),
        "learner_note": str(row.get("learner_note") or ""),
        "updated_at": _iso(row.get("updated_at")),
    }


def derive_progress(units: list[dict[str, Any]], rows: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """课程进度＝知识点投影序列 × kp 行读时重算（非累加）；`pending` 行既不计 done 也不计 skipped。"""
    statuses = [rows.get(str(unit.get("kp_id") or ""), {}).get("status") for unit in units]
    total = len(units)
    done = sum(1 for status in statuses if status == "done")
    skipped = sum(1 for status in statuses if status == "skipped")
    current = next(
        (
            str(unit["unit_id"])
            for unit, status in zip(units, statuses, strict=True)
            if status not in ("done", "skipped")
        ),
        None,
    )
    return {
        "total": total,
        "done": done,
        "skipped": skipped,
        "percent": round(100.0 * done / total, 1) if total else 0.0,
        "current_unit_id": current,
        "completed": total > 0 and done + skipped == total,
    }


def derive_books_progress(
    units: list[dict[str, Any]], rows: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """教材级进度：计数单位行按取材 `source_ref.ref_id` 归集（书架清单卡片，REQ-117 W8/C9）。"""
    grouped: dict[str, dict[str, int]] = {}
    for unit in units:
        ref_id = str((unit.get("source_ref") or {}).get("ref_id") or "")
        if not ref_id:
            continue
        bucket = grouped.setdefault(ref_id, {"total": 0, "done": 0})
        bucket["total"] += 1
        if rows.get(str(unit.get("kp_id") or ""), {}).get("status") == "done":
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


class MySQLLearnStore:
    """学习记录 `qe_learning` 的 MySQL 存储（单表继承：course 行 + kp 行）。

    接口与 `InMemoryLearnStore` 同形（公开方法签名由契约测试守护）；百分比与掌握分不落列，
    调用方取投影序列 × `kp_rows()` 走 `derive_progress` 重算。
    """

    def __init__(self, settings: Any) -> None:
        self._settings = settings

    def _connect(self):
        from qed_engine.services.llm.call_log import _connect

        return _connect(self._settings)

    def _row(self, owner: str, target_kind: str, target_id: str) -> dict[str, Any] | None:
        sql = (
            f"SELECT id, {_LEARNING_COLUMNS} FROM qe_learning "
            "WHERE owner=%s AND target_kind=%s AND target_id=%s"
        )
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(sql, (owner, target_kind, target_id))
                row = cursor.fetchone()
        if row is None:
            return None
        return {**row, "config": _from_json(row.get("config"))}

    def _upsert(self, row: dict[str, Any]) -> None:
        params = tuple(
            _to_json(row.get(column)) if column == "config" else row.get(column)
            for column in _LEARNING_FIELDS
        )
        assignments = ", ".join(
            f"{column}=VALUES({column})"
            for column in ("status", "config", "qualitative_passed", "qualitative_note", "assessed_by", "assessed_at", "learner_note", "updated_at")
        )
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    f"INSERT INTO qe_learning ({_LEARNING_COLUMNS}) VALUES "
                    f"({', '.join(['%s'] * len(_LEARNING_FIELDS))}) ON DUPLICATE KEY UPDATE {assignments}",
                    params,
                )
            conn.commit()

    def _delete(self, owner: str, target_kind: str, target_id: str) -> None:
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM qe_learning WHERE owner=%s AND target_kind=%s AND target_id=%s",
                    (owner, target_kind, target_id),
                )
            conn.commit()

    def _kp_base_row(self, kp_id: str, owner: str) -> dict[str, Any]:
        existing = self._row(owner, KP_TARGET, kp_id) or {}
        return {
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
        kp_path: Iterable[str] = (),
        learner_note: str = "",
        owner: str = DEFAULT_OWNER,
    ) -> dict[str, Any]:
        if not str(course_id or "").strip():
            raise LearnConflict("course_id 不可为空（选课即引用共享 qed_course.course_id）")
        if not resources:
            raise LearnConflict("resources 至少一项")
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
        self._upsert(row)
        return course_view(row)

    def get_course(self, course_id: str, *, owner: str = DEFAULT_OWNER) -> dict[str, Any]:
        row = self._row(owner, COURSE_TARGET, course_id)
        if row is None:
            raise LearnNotFound(course_id)
        return course_view(row)

    def list_courses(self, *, owner: str = DEFAULT_OWNER) -> list[dict[str, Any]]:
        sql = (
            f"SELECT id, {_LEARNING_COLUMNS} FROM qe_learning "
            "WHERE owner=%s AND target_kind=%s ORDER BY created_at"
        )
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(sql, (owner, COURSE_TARGET))
                rows = cursor.fetchall()
        return [
            course_view({**row, "config": _from_json(row.get("config"))}) for row in rows
        ]

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
        row = self._row(owner, COURSE_TARGET, course_id) or {}
        self._upsert(
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
        if self._row(owner, COURSE_TARGET, course_id) is None:
            raise LearnNotFound(course_id)
        self._delete(owner, COURSE_TARGET, course_id)

    # ---------- 知识点终态与质性门（kp 行） ----------

    def kp_rows(self, *, owner: str = DEFAULT_OWNER) -> dict[str, dict[str, Any]]:
        """全部 kp 行（`kp_id` → 归一投影）；未落笔的知识点无键，读侧按投影序列取用。"""
        sql = (
            f"SELECT id, {_LEARNING_COLUMNS} FROM qe_learning "
            "WHERE owner=%s AND target_kind=%s"
        )
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(sql, (owner, KP_TARGET))
                rows = cursor.fetchall()
        return {str(row["target_id"]): kp_view(row) for row in rows}

    def get_kp_row(self, kp_id: str, *, owner: str = DEFAULT_OWNER) -> dict[str, Any]:
        row = self._row(owner, KP_TARGET, kp_id)
        if row is None:
            raise LearnNotFound(kp_id)
        return kp_view(row)

    def set_kp_status(
        self, kp_id: str, status: str, *, owner: str = DEFAULT_OWNER
    ) -> dict[str, Any]:
        """勾选落笔（done/skipped/pending）；`pending`＝撤销终态位，无质性判定痕迹时整行删除。"""
        _check_status(KP_TARGET, status)
        existing = self._row(owner, KP_TARGET, kp_id)
        if status == "pending":
            if existing is None:
                return {"kp_id": str(kp_id), "status": "pending", "removed": True}
            if existing.get("qualitative_passed") is None:
                self._delete(owner, KP_TARGET, kp_id)
                return {"kp_id": str(kp_id), "status": "pending", "removed": True}
        self._upsert({**(existing or self._kp_base_row(kp_id, owner)), "status": status})
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
        """质性门判定落 kp 行：只写判定四列，终态位 `status` 不动（门与勾选各写各的列，D-M3-1）。

        行不存在时以 `status='pending'` 起行（pending 既不计 done 也不计 skipped）。
        """
        if assessed_by not in ASSESSED_BY:
            raise LearnConflict(f"assessed_by 必须是 {ASSESSED_BY} 之一")
        merged = self._kp_base_row(kp_id, owner)
        merged.update(
            qualitative_passed=int(bool(passed)),
            qualitative_note=note,
            assessed_by=assessed_by,
            assessed_at=_now(),
        )
        self._upsert(merged)
        return self.get_kp_row(kp_id, owner=owner)

    def set_note(
        self, target_kind: str, target_id: str, text: str, *, owner: str = DEFAULT_OWNER
    ) -> dict[str, Any]:
        """学习者备注（人工位，R6）：course 行与 kp 行通用；行不存在不起新行（404）。"""
        kind = COURSE_TARGET if target_kind == COURSE_TARGET else KP_TARGET
        row = self._row(owner, kind, target_id)
        if row is None:
            raise LearnNotFound(target_id)
        merged = {**row, "learner_note": str(text or ""), "updated_at": _now()}
        self._upsert(merged)
        return course_view(merged) if kind == COURSE_TARGET else kp_view(merged)
