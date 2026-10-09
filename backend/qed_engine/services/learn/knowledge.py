"""学习域·知识点两表存储（M5）：qed_knowledge_point（共享主数据）+ qed_learn_kp_detail（候选池）。

模块职责：第四张共享表与根私有候选明细表的幂等建表、norm_key 规范化、候选提升
（人工确认 → 写主表）与检索聚合；事实源＝M5 壳「表契约草案」节。
两段式口径：主表只存**已确认**知识点（多版本叙述留在 detail 表），confirmed 只能由
人工确认端点置位，机器与生成管线永不写 1。
设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
关联测试：tests/test_learn_knowledge.py
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import uuid
from datetime import UTC, datetime
from typing import Any

import pymysql

from qed_engine.config import Settings
from qed_engine.services.learn.base import LearnConflict, LearnNotFound
from qed_engine.services.llm.call_log import _connect

logger = logging.getLogger("qed_engine.learn")

KP_TYPES = ("memory", "procedure", "concept", "design")
DETAIL_STATUSES = ("draft", "candidate", "adopted", "rejected")
# 未定态（可继续提升到主表）
OPEN_STATUSES = ("draft", "candidate")
# M6：主表一行 Either 目录节点（大知识点）或细知识点
NODE_KINDS = ("outline", "point")
# 批注用途（与 type 四分类正交）：总结 / 详解
INTENTS = ("summary", "explanation")

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS qed_knowledge_point (
  kp_id VARCHAR(64) PRIMARY KEY COMMENT '行 ID（服务端生成 kp-<hex12>，与候选 detail_id 不同族）',
  domain_id VARCHAR(64) NOT NULL DEFAULT '' COMMENT '领域坐标（逻辑引用 qed_domain，标量列供检索与唯一键）',
  domain_label VARCHAR(255) DEFAULT '' COMMENT '领域名快照',
  course_id VARCHAR(64) NOT NULL COMMENT '课程坐标（逻辑引用 qed_course）',
  course_label VARCHAR(255) DEFAULT '' COMMENT '课程名快照',
  node_kind VARCHAR(16) NOT NULL DEFAULT 'point' COMMENT '闭集 outline=目录节点(大知识点) / point=细知识点',
  parent_kp_id VARCHAR(64) COMMENT 'outline：父 outline（章=NULL，节=章）；point：所属 outline（NULL=未归档池）',
  depth TINYINT COMMENT 'outline 层级：1=章 2=节；point 行 NULL',
  book_ref VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'outline：来源书（qt_books.book_id，版本换代不碎树）；point 行空串（一课一名）',
  name VARCHAR(500) NOT NULL COMMENT '展示名（章名 / 知识点 canonical 名）',
  norm_key VARCHAR(200) NOT NULL COMMENT '去重键（全角转半角+空白折叠+小写）',
  type VARCHAR(16) COMMENT 'point 行四分类 memory/procedure/concept/design；outline 行必须 NULL',
  order_hint INT COMMENT '书内/课程内顺序（outline 行=目录前序序号，point 行=学习顺序提示，均可空）',
  summary VARCHAR(1000) DEFAULT '' COMMENT '一句话摘要（限长 1000）',
  source_ref JSON COMMENT 'outline 正文位置 {kind,ref_id,page_start,page_end}（页序=PDF 页序）；point 行可空',
  anchors JSON COMMENT '来源锚点 [{kind,ref_id,page?,snippet?}]（DeepTutor K1 形状，降级不删）',
  from_detail_id VARCHAR(64) COMMENT '提升来源明细（溯源 qed_learn_kp_detail）',
  confirmed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '人工确认位（机器永不写 1，提升/目录确认即置位）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  KEY idx_kp_course_book_norm (course_id, book_ref, norm_key),
  KEY idx_kp_parent (parent_kp_id),
  KEY idx_kp_course_kind (course_id, node_kind),
  KEY idx_kp_domain (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='知识点主数据（领域→课程→章节(outline)→知识点(point) 层级；一行=一个人工确认的行，结构由 QED-Engine 根定义）';

CREATE TABLE IF NOT EXISTS qed_learn_kp_detail (
  detail_id VARCHAR(64) PRIMARY KEY COMMENT '明细 ID（服务端生成 kpd-<hex12>）',
  domain_id VARCHAR(64) NOT NULL DEFAULT '' COMMENT '领域坐标（逻辑引用 qed_domain）',
  domain_label VARCHAR(255) DEFAULT '' COMMENT '领域名快照',
  course_id VARCHAR(64) NOT NULL COMMENT '课程坐标（逻辑引用 qed_course）',
  course_label VARCHAR(255) DEFAULT '' COMMENT '课程名快照',
  kp_id VARCHAR(64) COMMENT '采纳后指向主表（未采纳允许悬空候选）',
  parent_kp_id VARCHAR(64) COMMENT '所属 outline（本章候选列表据此过滤；提升时平移到主表）',
  intent VARCHAR(16) NOT NULL DEFAULT 'explanation' COMMENT '批注用途闭集 summary/explanation（与 type 正交）',
  book_ref VARCHAR(64) NOT NULL DEFAULT '' COMMENT '批注来源书（与主表 outline 同口径，提升后主表 point 行仍空串）',
  name VARCHAR(500) NOT NULL COMMENT '候选名（可含版本差异，不进唯一键）',
  norm_key VARCHAR(200) NOT NULL COMMENT '去重键（与主表同口径，提升时校验）',
  type VARCHAR(16) COMMENT '四分类闭集 memory/procedure/concept/design',
  narrative MEDIUMTEXT COMMENT '叙述正文（同一知识点可多条并存=多版本多叙述）',
  payload JSON COMMENT '分栏内容 {definition,theorem,proof,example...}（不含判分，判分归主链 M-3）',
  anchors JSON COMMENT '来源锚点列表（与主表同形状）',
  gen_batch VARCHAR(64) NOT NULL DEFAULT '' COMMENT '生成批次=版本组（一批候选可整批复核/清理）',
  map_seed VARCHAR(32) COMMENT '确定性种子（同批次同图稳定复现，DeepTutor K5）',
  model_ref VARCHAR(128) COMMENT '生成者标识（manual/模型名；不含密钥）',
  gen_status VARCHAR(16) NOT NULL DEFAULT 'candidate' COMMENT 'draft/candidate/adopted/rejected',
  dedup_of VARCHAR(64) COMMENT '指向既有 canonical kp_id（合并候选，不另立主表行）',
  confirmed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '人工确认位（置位才提升）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  KEY idx_kpd_course (course_id, gen_status),
  KEY idx_kpd_batch (gen_batch),
  KEY idx_kpd_parent (parent_kp_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='知识点候选明细池（根私有，8901/8902 不读；一行=一条叙述/版本，人工确认后提升到 qed_knowledge_point）';
"""

_POINT_COLUMNS = (
    "kp_id, domain_id, domain_label, course_id, course_label, node_kind, parent_kp_id, depth, "
    "book_ref, name, norm_key, type, order_hint, summary, source_ref, anchors, from_detail_id, "
    "confirmed, created_at, updated_at"
)
_DETAIL_COLUMNS = (
    "detail_id, domain_id, domain_label, course_id, course_label, kp_id, parent_kp_id, intent, "
    "book_ref, name, norm_key, type, narrative, payload, anchors, gen_batch, map_seed, model_ref, "
    "gen_status, dedup_of, confirmed, created_at, updated_at"
)
_JSON_COLUMNS = ("anchors", "payload")


def norm_key(name: str) -> str:
    """去重键规范化：全角转半角 → 空白折叠 → 小写；超长退化为 前缀+摘要 保唯一容量。"""
    chars = []
    for ch in (name or "").strip():
        code = ord(ch)
        if code == 0x3000:
            code = 0x20
        elif 0xFF01 <= code <= 0xFF5E:
            code -= 0xFEE0
        chars.append(chr(code))
    key = re.sub(r"\s+", " ", "".join(chars)).lower()
    if len(key) <= 200:
        return key
    return f"{key[:180]}-{hashlib.sha256(key.encode('utf-8')).hexdigest()[:12]}"


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _to_json(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def _from_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


def flatten_outline(tree: list[dict[str, Any]], book_ref: str) -> list[dict[str, Any]]:
    """目录树前序展开为写库行（父指针按索引回指，两表存储与端点校验共用同一展开口径）。"""
    flat: list[dict[str, Any]] = []

    def _walk(nodes: list[Any], parent_idx: int | None, depth: int) -> None:
        for node in nodes:
            idx = len(flat)
            flat.append(
                {
                    "name": str(node["name"]),
                    "depth": depth,
                    "parent_idx": parent_idx,
                    "parent_kp_id": None,
                    "source_ref": {
                        "kind": "book",
                        "ref_id": book_ref,
                        "page_start": int(node["page_start"]),
                        "page_end": int(node["page_end"]),
                    },
                }
            )
            _walk(node.get("children") or [], idx, depth + 1)

    _walk(tree, None, 1)
    return flat


def _row_to_dict(row: dict[str, Any] | None) -> dict[str, Any]:
    if row is None:
        return {}
    out = dict(row)
    for column in _JSON_COLUMNS:
        if column in out:
            out[column] = _from_json(out[column]) or []
    if "source_ref" in out:
        out["source_ref"] = _from_json(out["source_ref"])
    for column in ("confirmed",):
        if column in out:
            out[column] = bool(out[column])
    for column in ("created_at", "updated_at"):
        if column in out and out[column] is not None:
            out[column] = out[column].isoformat()
    return out


class MySQLKnowledgeStore:
    """知识点两表 MySQL 存储（qed 库；qed_knowledge_point 共享 + qed_learn_kp_detail 私有）。"""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _connect(self) -> pymysql.Connection:
        return _connect(self._settings)

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
            "payload": _to_json(payload),
            "anchors": _to_json(anchors),
            "gen_batch": gen_batch,
            "map_seed": map_seed,
            "model_ref": model_ref,
            "gen_status": gen_status,
            "dedup_of": dedup_of,
            "confirmed": 0,
            "created_at": now,
            "updated_at": now,
        }
        columns = ", ".join(row)
        placeholders = ", ".join(f"%({key})s" for key in row)
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(f"INSERT INTO qed_learn_kp_detail ({columns}) VALUES ({placeholders})", row)
            conn.commit()
        return self.get_detail(detail_id)

    def get_detail(self, detail_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_DETAIL_COLUMNS} FROM qed_learn_kp_detail WHERE detail_id=%s", (detail_id,)
                )
                row = cursor.fetchone()
        if row is None:
            raise LearnNotFound(f"候选明细不存在：{detail_id}")
        return _row_to_dict(row)

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
        where: list[str] = []
        params: list[Any] = []
        if course_id:
            where.append("course_id=%s")
            params.append(course_id)
        if gen_status:
            where.append("gen_status=%s")
            params.append(gen_status)
        if batch:
            where.append("gen_batch=%s")
            params.append(batch)
        if parent_kp_id:
            where.append("parent_kp_id=%s")
            params.append(parent_kp_id)
        if unarchived:
            where.append("parent_kp_id IS NULL")
        clause = f"WHERE {' AND '.join(where)}" if where else ""
        params += [limit, offset]
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_DETAIL_COLUMNS} FROM qed_learn_kp_detail {clause} "
                    "ORDER BY course_id, gen_batch, created_at, detail_id LIMIT %s OFFSET %s",
                    params,
                )
                rows = cursor.fetchall()
        return [_row_to_dict(row) for row in rows]

    def confirm_detail(self, detail_id: str) -> dict[str, Any]:
        """人工确认并提升到共享主表（point 行）；重复 norm_key → LearnConflict（409）。"""
        now = _now()
        conn = self._connect()
        try:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_DETAIL_COLUMNS} FROM qed_learn_kp_detail WHERE detail_id=%s FOR UPDATE",
                    (detail_id,),
                )
                detail = cursor.fetchone()
                if detail is None:
                    raise LearnNotFound(f"候选明细不存在：{detail_id}")
                if detail["gen_status"] == "adopted" and detail["kp_id"]:
                    cursor.execute(
                        f"SELECT {_POINT_COLUMNS} FROM qed_knowledge_point WHERE kp_id=%s", (detail["kp_id"],)
                    )
                    point = cursor.fetchone()
                    if point:
                        return _row_to_dict(point)
                if detail["gen_status"] == "rejected":
                    raise LearnConflict("候选已驳回，需重新登记后再确认")
                key = detail["norm_key"]
                cursor.execute(
                    "SELECT kp_id FROM qed_knowledge_point "
                    "WHERE course_id=%s AND book_ref='' AND norm_key=%s",
                    (detail["course_id"], key),
                )
                if cursor.fetchone():
                    raise LearnConflict(f"该课程下同名知识点已存在（norm_key={key}），请走合并")
                kp_id = f"kp-{uuid.uuid4().hex[:12]}"
                cursor.execute(
                    "INSERT INTO qed_knowledge_point "
                    "(kp_id, domain_id, domain_label, course_id, course_label, node_kind, parent_kp_id, "
                    " depth, book_ref, name, norm_key, type, order_hint, summary, source_ref, anchors, "
                    " from_detail_id, confirmed, created_at, updated_at) "
                    "VALUES (%(kp_id)s, %(domain_id)s, %(domain_label)s, %(course_id)s, %(course_label)s, "
                    " 'point', %(parent_kp_id)s, NULL, '', %(name)s, %(norm_key)s, %(type)s, "
                    " %(order_hint)s, %(summary)s, NULL, %(anchors)s, %(from_detail_id)s, "
                    " %(confirmed)s, %(created_at)s, %(updated_at)s)",
                    {
                        "kp_id": kp_id,
                        "domain_id": detail["domain_id"],
                        "domain_label": detail["domain_label"],
                        "course_id": detail["course_id"],
                        "course_label": detail["course_label"],
                        "parent_kp_id": detail["parent_kp_id"],
                        "name": detail["name"],
                        "norm_key": key,
                        "type": detail["type"],
                        "order_hint": None,
                        "summary": (detail["narrative"] or "")[:1000],
                        "anchors": _to_json(_from_json(detail["anchors"]) or []),
                        "from_detail_id": detail_id,
                        "confirmed": 1,
                        "created_at": now,
                        "updated_at": now,
                    },
                )
                cursor.execute(
                    "UPDATE qed_learn_kp_detail SET gen_status='adopted', kp_id=%s, confirmed=1, "
                    "updated_at=%s WHERE detail_id=%s",
                    (kp_id, now, detail_id),
                )
            conn.commit()
        finally:
            conn.close()
        return self.get_point(kp_id)

    def reject_detail(self, detail_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT detail_id FROM qed_learn_kp_detail WHERE detail_id=%s", (detail_id,)
                )
                if not cursor.fetchone():
                    raise LearnNotFound(f"候选明细不存在：{detail_id}")
                cursor.execute(
                    "UPDATE qed_learn_kp_detail SET gen_status='rejected', kp_id=NULL, confirmed=0, "
                    "updated_at=%s WHERE detail_id=%s",
                    (_now(), detail_id),
                )
            conn.commit()
        return self.get_detail(detail_id)

    # ---------- 知识点主数据 ----------

    def get_point(self, kp_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(f"SELECT {_POINT_COLUMNS} FROM qed_knowledge_point WHERE kp_id=%s", (kp_id,))
                row = cursor.fetchone()
        if row is None:
            raise LearnNotFound(f"知识点不存在：{kp_id}")
        return _row_to_dict(row)

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
        where: list[str] = []
        params: list[Any] = []
        if kind:
            where.append("node_kind=%s")
            params.append(kind)
        if domain_id:
            where.append("domain_id=%s")
            params.append(domain_id)
        if course_id:
            where.append("course_id=%s")
            params.append(course_id)
        if type:
            where.append("type=%s")
            params.append(type)
        if q:
            where.append("(name LIKE %s OR summary LIKE %s)")
            params += [f"%{q}%", f"%{q}%"]
        clause = f"WHERE {' AND '.join(where)}" if where else ""
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(f"SELECT COUNT(*) AS n FROM qed_knowledge_point {clause}", params)
                total = int(cursor.fetchone()["n"])
                cursor.execute(
                    f"SELECT {_POINT_COLUMNS} FROM qed_knowledge_point {clause} "
                    "ORDER BY course_id, name, kp_id LIMIT %s OFFSET %s",
                    [*params, limit, offset],
                )
                rows = cursor.fetchall()
        return [_row_to_dict(row) for row in rows], total

    def counts_by_course(self) -> dict[str, dict[str, int]]:
        """星图节点徽标：{course_id: {confirmed, candidates}}（只数 point 行，章名不计入）。"""
        counts: dict[str, dict[str, int]] = {}
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT course_id, COUNT(*) AS n FROM qed_knowledge_point "
                    "WHERE node_kind='point' GROUP BY course_id"
                )
                for row in cursor.fetchall():
                    counts.setdefault(row["course_id"], {})["confirmed"] = int(row["n"])
                placeholders = ", ".join(["%s"] * len(OPEN_STATUSES))
                cursor.execute(
                    f"SELECT course_id, COUNT(*) AS n FROM qed_learn_kp_detail "
                    f"WHERE gen_status IN ({placeholders}) GROUP BY course_id",
                    list(OPEN_STATUSES),
                )
                for row in cursor.fetchall():
                    counts.setdefault(row["course_id"], {})["candidates"] = int(row["n"])
        for entry in counts.values():
            entry.setdefault("confirmed", 0)
            entry.setdefault("candidates", 0)
        return counts

    # ---------- 章节目录树（outline 行） ----------

    def list_outline(self, course_id: str, book_ref: str | None = None) -> list[dict[str, Any]]:
        where = ["node_kind='outline'", "course_id=%s"]
        params: list[Any] = [course_id]
        if book_ref:
            where.append("book_ref=%s")
            params.append(book_ref)
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_POINT_COLUMNS} FROM qed_knowledge_point "
                    f"WHERE {' AND '.join(where)} ORDER BY order_hint, kp_id",
                    params,
                )
                rows = [_row_to_dict(row) for row in cursor.fetchall()]
                cursor.execute(
                    "SELECT parent_kp_id, COUNT(*) AS n FROM qed_knowledge_point "
                    "WHERE node_kind='point' AND course_id=%s GROUP BY parent_kp_id",
                    (course_id,),
                )
                points = {row["parent_kp_id"]: int(row["n"]) for row in cursor.fetchall() if row["parent_kp_id"]}
        for row in rows:
            row["point_count"] = points.get(row["kp_id"], 0)
        return rows

    def replace_outline(self, course_id: str, book_ref: str, tree: list[dict[str, Any]]) -> dict[str, Any]:
        """整树幂等替换同 book_ref 的 outline 子树；point 行不删，失父者归未归档池。"""
        flat = flatten_outline(tree, book_ref)
        conn = self._connect()
        try:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT kp_id, parent_kp_id, norm_key FROM qed_knowledge_point "
                    "WHERE node_kind='outline' AND course_id=%s AND book_ref=%s",
                    (course_id, book_ref),
                )
                # 复用键含父级：跨章同名节各自成行（DEFECT-011 唯一键降级后由本映射承载口径）
                existing = {
                    (row["parent_kp_id"], row["norm_key"]): row["kp_id"] for row in cursor.fetchall()
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
                        cursor.execute(
                            "INSERT INTO qed_knowledge_point "
                            "(kp_id, domain_id, domain_label, course_id, course_label, node_kind, "
                            " parent_kp_id, depth, book_ref, name, norm_key, type, order_hint, summary, "
                            " source_ref, anchors, from_detail_id, confirmed, created_at, updated_at) "
                            "VALUES (%(kp_id)s, '', '', %(course_id)s, '', 'outline', %(parent)s, "
                            " %(depth)s, %(book_ref)s, %(name)s, %(norm_key)s, NULL, %(hint)s, '', "
                            " %(source_ref)s, NULL, NULL, 1, %(now)s, %(now)s)",
                            {
                                "kp_id": kp_id, "course_id": course_id, "parent": node["parent_kp_id"],
                                "depth": node["depth"], "book_ref": book_ref, "name": node["name"],
                                "norm_key": key, "hint": index + 1,
                                "source_ref": _to_json(node["source_ref"]), "now": now,
                            },
                        )
                    else:
                        reused.add(kp_id)
                        cursor.execute(
                            "UPDATE qed_knowledge_point SET parent_kp_id=%(parent)s, depth=%(depth)s, "
                            "name=%(name)s, order_hint=%(hint)s, source_ref=%(source_ref)s, "
                            "confirmed=1, updated_at=%(now)s WHERE kp_id=%(kp_id)s",
                            {
                                "kp_id": kp_id, "parent": node["parent_kp_id"], "depth": node["depth"],
                                "name": node["name"], "hint": index + 1,
                                "source_ref": _to_json(node["source_ref"]), "now": now,
                            },
                        )
                    node["kp_id"] = kp_id
                dropped = [kp for kp in existing.values() if kp not in reused]
                orphaned = 0
                if dropped:
                    marks = ", ".join(["%s"] * len(dropped))
                    orphaned = cursor.execute(
                        f"UPDATE qed_knowledge_point SET parent_kp_id=NULL, updated_at=%s "
                        f"WHERE node_kind='point' AND parent_kp_id IN ({marks})",
                        [now, *dropped],
                    )
                    cursor.execute(f"DELETE FROM qed_knowledge_point WHERE kp_id IN ({marks})", dropped)
            conn.commit()
        finally:
            conn.close()
        return {
            "reused": len(reused),
            "created": len(flat) - len(reused),
            "dropped": len(dropped),
            "orphaned_points": int(orphaned),
        }

    def patch_point(self, kp_id: str, **fields: Any) -> dict[str, Any]:
        """人工面白名单改列（parent_kp_id / name / order_hint），归属与改名不重开确认。"""
        now = _now()
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT kp_id FROM qed_knowledge_point WHERE kp_id=%s FOR UPDATE", (kp_id,)
                )
                if cursor.fetchone() is None:
                    raise LearnNotFound(f"知识点不存在：{kp_id}")
                sets, params = ["updated_at=%s"], [now]
                if "name" in fields:
                    sets += ["name=%s", "norm_key=%s"]
                    params += [fields["name"], norm_key(fields["name"])]
                if "order_hint" in fields:
                    sets.append("order_hint=%s")
                    params.append(fields["order_hint"])
                if "parent_kp_id" in fields:
                    sets.append("parent_kp_id=%s")
                    params.append(fields["parent_kp_id"])
                params.append(kp_id)
                cursor.execute(
                    f"UPDATE qed_knowledge_point SET {', '.join(sets)} WHERE kp_id=%s", params
                )
            conn.commit()
        finally:
            conn.close()
        return self.get_point(kp_id)


def ensure_tables(settings: Settings) -> None:
    """幂等建两表（判例 qed_llm_calls / qed_learn_*）；数据库不可达抛异常由调用方降级。"""
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


def build_store(settings: Settings) -> MySQLKnowledgeStore | None:
    """存储工厂：未配置数据库密码（测试/未配置环境）时返回 None → 端点 503。"""
    if not settings.qed_db_password.get_secret_value():
        return None
    return MySQLKnowledgeStore(settings)
