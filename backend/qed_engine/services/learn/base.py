"""学习域（learn）存储服务基座：异常分层 + MySQL 三表幂等建表 + 三表 MySQL 存储。

模块职责：定义学习域三表（qe_learn_course / qe_learn_unit / qe_learn_unit_progress）
的存储契约与异常映射（NotFound→404、Conflict→409），并给出 MySQL 实现 `MySQLLearnStore`
（接口与 `InMemoryLearnStore` 同形，懒挂载见 api/learn.py）；表结构与派生口径事实源＝
学习设计轮主链壳「M-1/M-2 契约设计稿」节（实现收口后晋升 database-design.md 登记）。
设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
关联测试：tests/test_learn.py
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

import pymysql

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS qe_learn_course (
  learn_course_id VARCHAR(64) PRIMARY KEY COMMENT '学习课程 ID（服务端生成，≠共享表 qed_course）',
  name VARCHAR(255) NOT NULL COMMENT '课程名',
  domain_ref JSON COMMENT '领域坐标引用 {ref_id,label}（逻辑引用 qed_domain）',
  course_ref JSON COMMENT '课程坐标引用 {ref_id,label}（逻辑引用 qed_course）',
  direction VARCHAR(255) DEFAULT '' COMMENT '方向 label 快照（共享表无方向实体，仅存文本）',
  resources JSON NOT NULL COMMENT '素材引用列表 [{kind,ref_id,label}]，kind 闭集 book/af_version/knowledge',
  compile_status VARCHAR(16) COMMENT '编译作业态：NULL/proposed/running/completed/failed（D3：课程行自 carry）',
  compile_done INT NOT NULL DEFAULT 0 COMMENT '已生成活动块数',
  compile_total INT NOT NULL DEFAULT 0 COMMENT '活动块总数',
  failure_count INT NOT NULL DEFAULT 0 COMMENT '本作业块级失败计数（熔断判据，M-2 接线）',
  page_windows JSON COMMENT '人工页窗 [{start,end}]（propose 输入，不依赖检索）',
  compile_fingerprint VARCHAR(64) COMMENT '上次编译的源指纹（drift 判定）',
  instructions VARCHAR(4000) DEFAULT '' COMMENT '学习者通道（限长 4000）',
  agent_notes VARCHAR(4000) DEFAULT '' COMMENT 'agent 通道（限长 4000）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='学习课程注册表（引用式，所有权 QED-Engine，主链壳 M-1 契约）';

CREATE TABLE IF NOT EXISTS qe_learn_unit (
  unit_id VARCHAR(64) PRIMARY KEY COMMENT '单元 ID（服务端生成）',
  learn_course_id VARCHAR(64) NOT NULL COMMENT '所属学习课程（逻辑引用）',
  parent_id VARCHAR(64) COMMENT '父节点（unit→section；section 为 NULL）',
  level VARCHAR(16) NOT NULL COMMENT 'section=章节大纲节点 / unit=最小学习单元（块）/ point=知识点推进行（W5 §V2.3，kp 引用在 source_ref.kp_id）',
  title VARCHAR(500) NOT NULL COMMENT '标题',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '同级顺序',
  confirmed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '人工确认位（两级确认：section 与 unit 各自）',
  covered TINYINT(1) NOT NULL DEFAULT 0 COMMENT '学习者勾选位（agent/编译永不写）',
  type VARCHAR(16) COMMENT 'unit 行：text/formula/figure/quiz/flashcard',
  payload JSON COMMENT 'unit 行内容定义（quiz/flashcard 不含判分，判分归 M-3）',
  source_ref JSON COMMENT 'unit 行溯源 {ref_id,page,block_index}（逻辑引用素材页块）',
  gen_status VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending/generated/failed（断点续编位）',
  active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '当前编译版本位（重编不抹历史，旧行置 0）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  KEY idx_learn_unit_course (learn_course_id, level, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='学习单元树（章节树+块序列合一，主链壳 M-1/M-2 契约）';

CREATE TABLE IF NOT EXISTS qe_learn_unit_progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '行 ID（自增主键）',
  unit_id VARCHAR(64) NOT NULL COMMENT '单元 ID（逻辑引用 qe_learn_unit）',
  learn_course_id VARCHAR(64) NOT NULL COMMENT '冗余课程 ID（派生重算按课程聚合）',
  status VARCHAR(16) NOT NULL COMMENT 'done/skipped（pending=无行，读时派生重算非累加）',
  qualitative_passed TINYINT(1) NULL COMMENT '质性门结论（仅 concept/design 知识点有值；NULL=未判）',
  qualitative_note VARCHAR(1000) DEFAULT '' COMMENT '判读证据一句话（自评理由，不含密钥）',
  assessed_by VARCHAR(16) DEFAULT '' COMMENT 'provenance：learner=判定者（v1 自评位）／model=M-3b 预留',
  assessed_at DATETIME NULL COMMENT '最近一次质性判定 UTC 时刻',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  UNIQUE KEY uq_learn_progress_unit (unit_id),
  KEY idx_learn_progress_course (learn_course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='学习进度派生基（终态事实+质性门判定，进度与掌握分=读时重算，主链壳 M-1/M-3 契约）';
"""


# 存量库幂等补列注册表（判例 qed_llm_calls._REQUIRED_COLUMNS）：CREATE TABLE IF NOT EXISTS
# 不迁移已有表，M-3 质性门四列按 information_schema 比对逐列 ALTER。
PROGRESS_GATE_COLUMNS: dict[str, str] = {
    "qualitative_passed": "TINYINT(1) NULL",
    "qualitative_note": "VARCHAR(1000) DEFAULT ''",
    "assessed_by": "VARCHAR(16) DEFAULT ''",
    "assessed_at": "DATETIME NULL",
}


class LearnNotFound(Exception):
    """实体不存在 → 404。"""


class LearnConflict(Exception):
    """状态机非法转移 → 409。"""


def ensure_tables(settings: Any) -> None:
    """幂等建表 + 存量库补列（判例 qed_llm_calls）；数据库不可达由调用方降级。

    四列齐备后本函数零 ALTER（幂等）；生产 `qed` 库不在此路径 ALTER＝D 类转人工随发布批次。
    """
    from qed_engine.services.llm.call_log import _connect

    conn = _connect(settings)
    try:
        with conn.cursor() as cursor:
            for statement in CREATE_TABLE_SQL.split(";"):
                sql = statement.strip()
                if sql:
                    cursor.execute(sql)
            cursor.execute(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'qe_learn_unit_progress'",
                (settings.qed_db_name,),
            )
            existing = {row[0] for row in cursor.fetchall()}
            for column, column_ddl in PROGRESS_GATE_COLUMNS.items():
                if column not in existing:
                    cursor.execute(
                        f"ALTER TABLE qe_learn_unit_progress ADD COLUMN {column} {column_ddl}"
                    )
        conn.commit()
    finally:
        conn.close()


def fingerprint(windows: list[dict[str, int]], resources: list[dict[str, str]]) -> str:
    """源指纹＝页窗+素材引用摘要（drift 判定输入，M-2 接线后并入 active_job_id）。"""
    import hashlib

    payload = json.dumps({"w": windows, "r": resources}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


_COURSE_JSON_COLUMNS = ("domain_ref", "course_ref", "resources", "page_windows")
_UNIT_JSON_COLUMNS = ("payload", "source_ref")
_COURSE_COLUMNS = (
    "learn_course_id, name, domain_ref, course_ref, direction, resources, compile_status, "
    "compile_done, compile_total, failure_count, page_windows, compile_fingerprint, "
    "instructions, agent_notes, created_at, updated_at"
)
_UNIT_COLUMNS = (
    "unit_id, learn_course_id, parent_id, level, title, sort_order, confirmed, covered, type, "
    "payload, source_ref, gen_status, active, created_at, updated_at"
)
_COURSE_FIELDS = tuple(_COURSE_COLUMNS.replace(" ", "").split(","))
_UNIT_FIELDS = tuple(_UNIT_COLUMNS.replace(" ", "").split(","))
_COURSE_UPDATABLE = (
    "name", "domain_ref", "course_ref", "direction", "resources", "compile_status", "compile_done",
    "compile_total", "failure_count", "page_windows", "compile_fingerprint", "instructions",
    "agent_notes",
)
_UNIT_UPDATABLE = ("title", "sort_order", "confirmed", "covered", "type", "payload", "gen_status", "active")


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _iso(value: Any) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else (value or None)


def _progress_view(row: dict[str, Any]) -> dict[str, Any]:
    """进度行归一投影（两实现同形）：质性门 TINYINT→三态 bool/None，时刻→isoformat。"""
    gate = row.get("qualitative_passed")
    return {
        "unit_id": str(row["unit_id"]),
        "status": str(row["status"]),
        "qualitative_passed": None if gate is None else bool(gate),
        "qualitative_note": str(row.get("qualitative_note") or ""),
        "assessed_by": str(row.get("assessed_by") or ""),
        "assessed_at": _iso(row.get("assessed_at")),
        "updated_at": _iso(row.get("updated_at")),
    }


def has_page_window(source_ref: Any) -> bool:
    """节点已声明页窗（目录导入的块）＝编译不写占位正文，正文由解析产物按页窗渲染。"""
    return bool(isinstance(source_ref, dict) and (source_ref.get("page_start") or source_ref.get("page_end")))


def _to_json(value: Any) -> str | None:
    return None if value is None else json.dumps(value, ensure_ascii=False)


def _from_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


def _row_to_course(row: dict[str, Any] | None) -> dict[str, Any]:
    if row is None:
        return {}
    out = dict(row)
    for column in _COURSE_JSON_COLUMNS:
        if column in out:
            out[column] = _from_json(out[column])
    for column in ("created_at", "updated_at"):
        if out.get(column) is not None:
            out[column] = out[column].isoformat()
    return out


def _row_to_unit(row: dict[str, Any] | None) -> dict[str, Any]:
    if row is None:
        return {}
    out = dict(row)
    for column in _UNIT_JSON_COLUMNS:
        if column in out:
            out[column] = _from_json(out[column])
    for column in ("confirmed", "covered", "active"):
        if column in out:
            out[column] = bool(out[column])
    for column in ("created_at", "updated_at"):
        if out.get(column) is not None:
            out[column] = out[column].isoformat()
    return out


class MySQLLearnStore:
    """学习域三表 MySQL 存储（qe_learn_course / _unit / _unit_progress）。

    接口与 `InMemoryLearnStore` 同形（公开方法签名由契约测试守护）；派生进度读时重算、
    课程行自 carry 编译作业态（D3）。
    """

    def __init__(self, settings: Any) -> None:
        self._settings = settings

    def _connect(self):
        from qed_engine.services.llm.call_log import _connect

        return _connect(self._settings)

    # ---------- 课程 ----------

    def create_course(self, *, name: str, resources: list[dict[str, str]], **fields: Any) -> dict[str, Any]:
        course_id = f"lc-{uuid.uuid4().hex[:12]}"
        stamp = _now()
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
            "page_windows": fields.get("page_windows"),
            "compile_fingerprint": None,
            "instructions": fields.get("instructions", ""),
            "agent_notes": fields.get("agent_notes", ""),
            "created_at": stamp,
            "updated_at": stamp,
        }
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    f"INSERT INTO qe_learn_course ({_COURSE_COLUMNS}) VALUES "
                    f"({', '.join(['%s'] * len(_COURSE_FIELDS))})",
                    tuple(
                        _to_json(row[column]) if column in _COURSE_JSON_COLUMNS else row[column]
                        for column in _COURSE_FIELDS
                    ),
                )
            conn.commit()
        return _row_to_course(row)

    def get_course(self, course_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_COURSE_COLUMNS} FROM qe_learn_course WHERE learn_course_id=%s",
                    (course_id,),
                )
                row = cursor.fetchone()
        if row is None:
            raise LearnNotFound(course_id)
        return _row_to_course(row)

    def list_courses(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(f"SELECT {_COURSE_COLUMNS} FROM qe_learn_course ORDER BY created_at")
                rows = cursor.fetchall()
        return [_row_to_course(row) for row in rows]

    def update_course(self, course_id: str, **fields: Any) -> dict[str, Any]:
        columns = [key for key in fields if key in _COURSE_UPDATABLE]
        unknown = set(fields) - set(columns)
        if unknown:
            raise LearnConflict(f"课程字段不可写：{sorted(unknown)}")
        self.get_course(course_id)
        if columns:
            assignments = ", ".join(f"{column}=%s" for column in columns)
            params = [
                _to_json(fields[column]) if column in _COURSE_JSON_COLUMNS else fields[column]
                for column in columns
            ]
            with self._connect() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        f"UPDATE qe_learn_course SET {assignments}, updated_at=%s WHERE learn_course_id=%s",
                        (*params, _now(), course_id),
                    )
                conn.commit()
        return self.get_course(course_id)

    def delete_course(self, course_id: str) -> None:
        self.get_course(course_id)
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM qe_learn_unit_progress WHERE learn_course_id=%s", (course_id,))
                cursor.execute("DELETE FROM qe_learn_unit WHERE learn_course_id=%s", (course_id,))
                cursor.execute("DELETE FROM qe_learn_course WHERE learn_course_id=%s", (course_id,))
            conn.commit()

    # ---------- 单元树 ----------

    def replace_tree(self, course_id: str, nodes: list[dict[str, Any]]) -> None:
        """整树草稿覆写：旧行连同进度一并清除（与内存实现同语义，重编换代归 M-2 版本位）。"""
        self.get_course(course_id)
        stamp = _now()
        rows: list[tuple[Any, ...]] = []
        seq = 0

        def _collect(node: dict[str, Any], parent: str | None, level: str) -> None:
            nonlocal seq
            seq += 1
            unit_id = f"lu-{uuid.uuid4().hex[:12]}"
            rows.append(
                (
                    unit_id, course_id, parent, level, str(node["title"]),
                    int(node.get("order", seq)), 1 if node.get("confirmed") else 0, 0,
                    str(node.get("type") or "text"), _to_json(node.get("payload") or {}),
                    _to_json(node["source_ref"]) if node.get("source_ref") else None,
                    "pending", 1, stamp, stamp,
                )
            )
            for child in node.get("children") or []:
                # 深度守卫在路由层（≤3 级）：L1=section，L2/L3=unit（块）
                _collect(child, unit_id, "unit")

        for n in nodes:
            _collect(n, None, "section")

        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM qe_learn_unit_progress WHERE learn_course_id=%s", (course_id,))
                cursor.execute("DELETE FROM qe_learn_unit WHERE learn_course_id=%s", (course_id,))
                if rows:
                    cursor.executemany(
                        f"INSERT INTO qe_learn_unit ({_UNIT_COLUMNS}) VALUES ("
                        + ", ".join(["%s"] * len(rows[0]))
                        + ")",
                        rows,
                    )
            conn.commit()

    def get_unit(self, unit_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_UNIT_COLUMNS} FROM qe_learn_unit WHERE unit_id=%s", (unit_id,)
                )
                row = cursor.fetchone()
        if row is None:
            raise LearnNotFound(unit_id)
        return _row_to_unit(row)

    def patch_unit(self, unit_id: str, **fields: Any) -> dict[str, Any]:
        if "order" in fields:
            fields["sort_order"] = fields.pop("order")
        columns = [key for key in _UNIT_UPDATABLE if key in fields]
        unknown = set(fields) - set(columns)
        if unknown:
            raise LearnConflict(f"单元字段不可写：{sorted(unknown)}")
        row = self.get_unit(unit_id)
        if fields.get("covered") is True and not row["confirmed"]:
            raise LearnConflict("未 confirmed 的单元不可勾选 covered")
        if columns:
            assignments = ", ".join(f"{column}=%s" for column in columns)
            params = [
                _to_json(fields[column]) if column in _UNIT_JSON_COLUMNS else fields[column]
                for column in columns
            ]
            with self._connect() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        f"UPDATE qe_learn_unit SET {assignments}, updated_at=%s WHERE unit_id=%s",
                        (*params, _now(), unit_id),
                    )
                conn.commit()
        return self.get_unit(unit_id)

    def list_units(self, course_id: str, level: str | None = None) -> list[dict[str, Any]]:
        self.get_course(course_id)
        sql = f"SELECT {_UNIT_COLUMNS} FROM qe_learn_unit WHERE learn_course_id=%s"
        params: list[Any] = [course_id]
        if level:
            sql += " AND level=%s"
            params.append(level)
        sql += " ORDER BY sort_order"
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(sql, tuple(params))
                rows = cursor.fetchall()
        return [_row_to_unit(row) for row in rows]

    def active_units(self, course_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_UNIT_COLUMNS} FROM qe_learn_unit "
                    "WHERE learn_course_id=%s AND level='unit' AND active=1 ORDER BY sort_order",
                    (course_id,),
                )
                rows = cursor.fetchall()
        return [_row_to_unit(row) for row in rows]

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
        """知识点派生键首次落笔才物化（§V2.3 读时投影；零 DDL＝level='point' + kp 引用入 source_ref）。"""
        self.get_course(course_id)
        stamp = _now()
        ref = {**(source_ref or {}), "kp_id": kp_id}
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO qe_learn_unit "
                    "(unit_id, learn_course_id, parent_id, level, title, sort_order, confirmed, covered, "
                    " type, payload, source_ref, gen_status, active, created_at, updated_at) "
                    "VALUES (%s, %s, %s, 'point', %s, %s, 1, %s, NULL, NULL, %s, 'generated', 1, %s, %s) "
                    "ON DUPLICATE KEY UPDATE parent_id=VALUES(parent_id), title=VALUES(title), "
                    "sort_order=VALUES(sort_order), covered=VALUES(covered), source_ref=VALUES(source_ref), "
                    "updated_at=VALUES(updated_at)",
                    (
                        unit_id,
                        course_id,
                        parent_id,
                        title,
                        sort_order,
                        int(covered),
                        _to_json(ref),
                        stamp,
                        stamp,
                    ),
                )
            conn.commit()
        return self.get_unit(unit_id)

    # ---------- 编译作业（课程行自 carry，D3 裁决） ----------

    def start_compile(self, course_id: str) -> dict[str, Any]:
        course = self.get_course(course_id)
        if course["compile_status"] == "running":
            raise LearnConflict("已有编译在跑")
        rows = self.list_units(course_id)
        if not rows:
            raise LearnConflict("两级确认未齐备（树为空）")
        if not all(r["confirmed"] for r in rows):
            raise LearnConflict("两级确认未齐备（存在未确认节点）")
        self.update_course(course_id, compile_status="running", failure_count=0)
        self._recount(course_id)
        return self.get_course(course_id)

    def finish_compile(self, course_id: str) -> None:
        """M-1 骨架编译：活动 unit 行逐一置 generated，只补空位不覆写人工/目录已声明的承载位。"""
        course = self.get_course(course_id)
        ref_id = (course["resources"] or [{}])[0].get("ref_id")
        with self._connect() as conn:
            with conn.cursor() as cursor:
                for row in self.active_units(course_id):
                    source_ref = row["source_ref"] or {"ref_id": ref_id, "page": None, "block_index": None}
                    payload = row["payload"] or {}
                    if not has_page_window(source_ref) and not str(payload.get("text") or ""):
                        payload = {"text": f"「{row['title']}」骨架正文（M-1 占位，M-2 接生成管线）"}
                    cursor.execute(
                        "UPDATE qe_learn_unit SET gen_status='generated', payload=%s, source_ref=%s, "
                        "updated_at=%s WHERE unit_id=%s",
                        (_to_json(payload), _to_json(source_ref), _now(), row["unit_id"]),
                    )
            conn.commit()
        self._recount(course_id)
        self.update_course(course_id, compile_status="completed")

    def _recount(self, course_id: str) -> None:
        rows = self.active_units(course_id)
        self.update_course(
            course_id,
            compile_total=len(rows),
            compile_done=sum(1 for r in rows if r["gen_status"] == "generated"),
        )

    # ---------- 进度派生基 ----------

    def set_progress(self, course_id: str, unit_id: str, status: str) -> dict[str, Any]:
        row = self.get_unit(unit_id)
        if row["learn_course_id"] != course_id:
            raise LearnNotFound(unit_id)
        if row["level"] != "point":
            raise LearnConflict("进度只可打在知识点行上（旧节/块行保留只读，§V2.3）")
        stamp = _now()
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO qe_learn_unit_progress (unit_id, learn_course_id, status, updated_at) "
                    "VALUES (%s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE status=VALUES(status), updated_at=VALUES(updated_at)",
                    (unit_id, course_id, status, stamp),
                )
            conn.commit()
        return {"unit_id": unit_id, "learn_course_id": course_id, "status": status, "updated_at": stamp.isoformat()}

    def derived_progress(self, course_id: str, units: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        """学习进度＝读时重算；`units` 传入投影好的知识点行（缺省回落旧活动 unit 行）。"""
        rows = self.active_units(course_id) if units is None else units
        total = len(rows)
        statuses: dict[str, str] = {}
        if rows:
            placeholders = ", ".join(["%s"] * total)
            with self._connect() as conn:
                with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                    cursor.execute(
                        "SELECT unit_id, status FROM qe_learn_unit_progress "
                        f"WHERE unit_id IN ({placeholders})",
                        tuple(r["unit_id"] for r in rows),
                    )
                    statuses = {row["unit_id"]: row["status"] for row in cursor.fetchall()}
        done = sum(1 for r in rows if statuses.get(r["unit_id"]) == "done")
        skipped = sum(1 for r in rows if statuses.get(r["unit_id"]) == "skipped")
        current = next(
            (r["unit_id"] for r in rows if statuses.get(r["unit_id"]) not in ("done", "skipped")), None
        )
        return {
            "total": total,
            "done": done,
            "skipped": skipped,
            "percent": round(100.0 * done / total, 1) if total else 0.0,
            "current_unit_id": current,
            "completed": total > 0 and done + skipped == total,
        }

    def progress_rows(self, course_id: str) -> dict[str, dict[str, Any]]:
        """主链 M-3 门的读入面：按课程取进度行原值（`unit_id` → 归一投影），未落笔的知识点无键。"""
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT unit_id, status, qualitative_passed, qualitative_note, assessed_by, "
                    "assessed_at, updated_at FROM qe_learn_unit_progress WHERE learn_course_id=%s",
                    (course_id,),
                )
                rows = cursor.fetchall()
        return {str(row["unit_id"]): _progress_view(row) for row in rows}

    def assess_qualitative(
        self,
        course_id: str,
        unit_id: str,
        *,
        passed: bool,
        note: str = "",
        assessed_by: str = "learner",
    ) -> dict[str, Any]:
        """质性门判定落进度行（扩列即等于落知识点）：只写判定四列，终态位 `status` 不动。

        行不存在时以 `status='pending'` 起行（pending＝派生计数视为无行）；门是新增的 system
        通路，不取代勾选通路（裁决 D-M3-1），故本方法与 set_progress 各写各的列。
        """
        row = self.get_unit(unit_id)
        if row["learn_course_id"] != course_id:
            raise LearnNotFound(unit_id)
        if row["level"] != "point":
            raise LearnConflict("质性判定只可打在知识点行上（旧节/块行保留只读，§V2.3）")
        stamp = _now()
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO qe_learn_unit_progress "
                    "(unit_id, learn_course_id, status, qualitative_passed, qualitative_note, "
                    "assessed_by, assessed_at, updated_at) "
                    "VALUES (%s, %s, 'pending', %s, %s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE qualitative_passed=VALUES(qualitative_passed), "
                    "qualitative_note=VALUES(qualitative_note), assessed_by=VALUES(assessed_by), "
                    "assessed_at=VALUES(assessed_at), updated_at=VALUES(updated_at)",
                    (unit_id, course_id, int(bool(passed)), note, assessed_by, stamp, stamp),
                )
            conn.commit()
        return self.progress_rows(course_id)[unit_id]

    def books_progress(self, course_id: str, units: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
        """教材级进度：计数单位行按 `source_ref.ref_id` 归集（书架清单卡片进度）。

        `units` 传入投影好的知识点行（缺省回落旧活动 unit 行）。
        只反映已进链路的教材；素材行有而单元行无的教材由路由层补 `total=0`。
        """
        rows = self.active_units(course_id) if units is None else units
        statuses: dict[str, str] = {}
        if rows:
            placeholders = ", ".join(["%s"] * len(rows))
            with self._connect() as conn:
                with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                    cursor.execute(
                        "SELECT unit_id, status FROM qe_learn_unit_progress "
                        f"WHERE unit_id IN ({placeholders})",
                        tuple(r["unit_id"] for r in rows),
                    )
                    statuses = {row["unit_id"]: row["status"] for row in cursor.fetchall()}
        grouped: dict[str, dict[str, int]] = {}
        for row in rows:
            ref_id = str((row.get("source_ref") or {}).get("ref_id") or "")
            if not ref_id:
                continue
            bucket = grouped.setdefault(ref_id, {"total": 0, "done": 0})
            bucket["total"] += 1
            if statuses.get(row["unit_id"]) == "done":
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
