"""学习域·知识点主表存储（M5）：`qed_knowledge_point`（共享主数据，25 列）。

模块职责：第四张共享表的幂等建表、norm_key 规范化、point 行直登记与检索聚合、outline
整树幂等替换与归属移动；事实源＝docs/architecture/database-design.md §五。
两段式口径不变：主表一行即一条**已确认**知识点（确认由「写入主表」这一动作承载，本表无
确认位列）。候选池 `qe_kp_detail` 与其五枚端点已随 ADR 0026 D1/D10 退出，point 行的产面
平移为 `add_point()`（`POST /learn/knowledge-points` 直登记）；多版本叙述改由主表
`angles` 索引 + `narrative_ref` 指针承载，正文落在数据根 `parsed/**`，不落库。
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
# 多角度叙述闭集（主表 `angles` 列内元素；ADR 0026 D5，复用退役候选池的既有六词，不新造）
ANGLE_KINDS = ("summary", "explanation", "definition", "theorem", "proof", "example")
# M6：主表一行 Either 目录节点（大知识点）或细知识点
NODE_KINDS = ("outline", "point")
# 审计列取值：写入方服务标识（与 qed_domain/qed_course 的 created_by/updated_by 同口径）
WRITER = "qed_engine"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS qed_knowledge_point (
  kp_id VARCHAR(64) PRIMARY KEY COMMENT '行 ID（服务端生成 kp-<hex12>，与梳理侧 af_kp.node_id 不同族）',
  domain_id VARCHAR(64) NOT NULL DEFAULT '' COMMENT '领域坐标（逻辑引用 qed_domain，标量列供检索与唯一键）',
  domain_label VARCHAR(255) DEFAULT '' COMMENT '领域名快照',
  course_id VARCHAR(64) NOT NULL COMMENT '课程坐标（逻辑引用 qed_course）',
  course_label VARCHAR(255) DEFAULT '' COMMENT '课程名快照',
  node_kind VARCHAR(16) NOT NULL DEFAULT 'point' COMMENT '闭集 outline=目录节点(大知识点) / point=细知识点',
  parent_kp_id VARCHAR(64) COMMENT 'outline：父 outline（章=NULL，节=章）；point：所属 outline（NULL=未归档池）',
  depth TINYINT COMMENT 'outline 层级：1=章 2=节；point 行 NULL',
  book_ref VARCHAR(64) COMMENT 'outline：来源书（qt_books.book_id，版本换代不碎树）；point 行 NULL（空串哨兵随 DEFECT-011 唯一键降级后撤销）',
  name VARCHAR(500) NOT NULL COMMENT '展示名（章名 / 知识点权威名，别名进 aliases）',
  aliases JSON COMMENT '同物异名列表 ["…"]（多教程对同一章节或知识点的不同称谓；name 恒为权威名，本列不表权威）',
  norm_key VARCHAR(200) NOT NULL COMMENT '去重键（全角转半角+空白折叠+小写）',
  type VARCHAR(16) COMMENT 'point 行四分类 memory/procedure/concept/design；outline 行必须 NULL',
  order_hint INT COMMENT '书内/课程内顺序（outline 行=目录前序序号，point 行=学习顺序提示，均可空）',
  summary VARCHAR(1000) DEFAULT '' COMMENT '一句话摘要（限长 1000）',
  narrative_ref VARCHAR(500) NOT NULL DEFAULT '' COMMENT '已确认长文正文的数据根相对路径（空串=无正文；正文不落库，读端点按本列取文件）',
  angles JSON COMMENT '多角度叙述索引 [{angle,note?}]（angle 闭集 summary/explanation/definition/theorem/proof/example；数组序=权威排序）',
  source_ref JSON COMMENT 'outline 正文位置 {kind,ref_id,page_start,page_end}（页序=PDF 页序）；point 行可空',
  anchors JSON COMMENT '来源锚点 [{kind,ref_id,page?,snippet?}]（DeepTutor K1 形状，降级不删）',
  from_detail_id VARCHAR(64) COMMENT '提升幂等锚=Axiom-Flow af_kp.node_id（梳理侧节点稳定身份，一经发放不可变）',
  meta JSON COMMENT '扩展槽：未定档字段先入本列（只读不筛）；定档后升为实体列并清空对应键',
  created_by VARCHAR(16) NOT NULL DEFAULT '' COMMENT '创建写入方标识（qed_engine）',
  updated_by VARCHAR(16) NOT NULL DEFAULT '' COMMENT '最近写入方标识（qed_engine）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  KEY idx_kp_course_kind_norm (course_id, node_kind, norm_key),
  KEY idx_kp_parent (parent_kp_id),
  KEY idx_kp_course_kind (course_id, node_kind),
  KEY idx_kp_domain (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='知识点主数据（领域→课程→章节(outline)→知识点(point) 层级；一行=一个人工确认的行，别名/长文指针/角度索引同表承载；结构由 QED-Engine 根定义）';
"""

_POINT_COLUMNS = (
    "kp_id, domain_id, domain_label, course_id, course_label, node_kind, parent_kp_id, depth, "
    "book_ref, name, aliases, norm_key, type, order_hint, summary, narrative_ref, angles, "
    "source_ref, anchors, from_detail_id, meta, created_by, updated_by, created_at, updated_at"
)
_JSON_COLUMNS = ("anchors", "aliases", "angles")


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
            if node.get("summary") is not None:
                # 只有显式提交 summary 的节点才带该键：整树重写据此保持未提交节点原值
                flat[idx]["summary"] = str(node["summary"])
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
    if "meta" in out:
        out["meta"] = _from_json(out["meta"])
    for column in ("created_at", "updated_at"):
        if column in out and out[column] is not None:
            out[column] = out[column].isoformat()
    return out


class MySQLKnowledgeStore:
    """知识点主表 MySQL 存储（qed 库共享表 `qed_knowledge_point`，结构正本在总纲 §五）。"""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _connect(self) -> pymysql.Connection:
        return _connect(self._settings)

    # ---------- 知识点主数据 ----------

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
        """直登记一条 point 行＝候选池退役后主表的唯一产面（ADR 0026 D10）。

        父级只允许同课程的 outline 行或 NULL（未归档池）；同课程重复 `norm_key` 拒绝 409；
        「写入本表」这一动作即承载确认（R6：主表无确认位列）。
        """
        if not str(course_id or "").strip():
            raise LearnConflict("course_id 不可为空")
        if not str(name or "").strip():
            raise LearnConflict("name 不可为空")
        if type is not None and type not in KP_TYPES:
            raise LearnConflict(f"type 必须是 {KP_TYPES} 之一")
        key = norm_key(name)
        conn = self._connect()
        try:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                if parent_kp_id:
                    cursor.execute(
                        "SELECT node_kind, course_id FROM qed_knowledge_point WHERE kp_id=%s",
                        (parent_kp_id,),
                    )
                    parent = cursor.fetchone()
                    if parent is None:
                        raise LearnNotFound(f"父级知识点不存在：{parent_kp_id}")
                    if parent["node_kind"] != "outline" or parent["course_id"] != course_id:
                        raise LearnConflict("point 行的父级必须是同课程下的 outline 行")
                cursor.execute(
                    "SELECT kp_id FROM qed_knowledge_point "
                    "WHERE course_id=%s AND node_kind='point' AND norm_key=%s",
                    (course_id, key),
                )
                if cursor.fetchone():
                    raise LearnConflict(f"该课程下同名知识点已存在（norm_key={key}），请走合并")
                kp_id = f"kp-{uuid.uuid4().hex[:12]}"
                now = _now()
                cursor.execute(
                    "INSERT INTO qed_knowledge_point "
                    "(kp_id, domain_id, domain_label, course_id, course_label, node_kind, "
                    " parent_kp_id, depth, book_ref, name, aliases, norm_key, type, order_hint, "
                    " summary, narrative_ref, angles, source_ref, anchors, from_detail_id, meta, "
                    " created_by, updated_by, created_at, updated_at) "
                    "VALUES (%(kp_id)s, %(domain_id)s, %(domain_label)s, %(course_id)s, "
                    " %(course_label)s, 'point', %(parent_kp_id)s, NULL, NULL, %(name)s, "
                    " %(aliases)s, %(norm_key)s, %(type)s, %(order_hint)s, %(summary)s, "
                    " %(narrative_ref)s, NULL, NULL, %(anchors)s, %(from_detail_id)s, NULL, "
                    " %(writer)s, %(writer)s, %(now)s, %(now)s)",
                    {
                        "kp_id": kp_id,
                        "domain_id": domain_id,
                        "domain_label": domain_label,
                        "course_id": course_id,
                        "course_label": course_label,
                        "parent_kp_id": parent_kp_id,
                        "name": name,
                        "aliases": _to_json(list(aliases or [])),
                        "norm_key": key,
                        "type": type,
                        "order_hint": order_hint,
                        "summary": summary,
                        "narrative_ref": narrative_ref or "",
                        "anchors": _to_json(anchors or []),
                        "from_detail_id": from_detail_id or None,
                        "writer": WRITER,
                        "now": now,
                    },
                )
            conn.commit()
        finally:
            conn.close()
        return self.get_point(kp_id)

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
        """星图节点徽标：{course_id: {confirmed}}（只数 point 行，章名不计入；候选位随池表退出）。"""
        counts: dict[str, dict[str, int]] = {}
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT course_id, COUNT(*) AS n FROM qed_knowledge_point "
                    "WHERE node_kind='point' GROUP BY course_id"
                )
                for row in cursor.fetchall():
                    counts.setdefault(row["course_id"], {})["confirmed"] = int(row["n"])
        for entry in counts.values():
            entry.setdefault("confirmed", 0)
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

        坐标由调用方按课程目录传入（REQ-118 D1：历史上本函数把三枚坐标列硬编码成空串，
        与候选提升写入的 point 行两套口径，导致跨领域检索与 idx_kp_domain 对 outline 失效）。"""
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
                            " source_ref, anchors, from_detail_id, meta, "
                            " created_by, updated_by, created_at, updated_at) "
                            "VALUES (%(kp_id)s, %(domain_id)s, %(domain_label)s, %(course_id)s, "
                            " %(course_label)s, 'outline', %(parent)s, "
                            " %(depth)s, %(book_ref)s, %(name)s, %(norm_key)s, NULL, %(hint)s, %(summary)s, "
                            " %(source_ref)s, NULL, NULL, NULL, %(writer)s, %(writer)s, "
                            " %(now)s, %(now)s)",
                            {
                                "kp_id": kp_id, "course_id": course_id, "parent": node["parent_kp_id"],
                                "domain_id": domain_id, "domain_label": domain_label,
                                "course_label": course_label,
                                "depth": node["depth"], "book_ref": book_ref, "name": node["name"],
                                "norm_key": key,
                                "hint": index + 1,
                                "summary": node.get("summary", ""),
                                "source_ref": _to_json(node["source_ref"]), "now": now,
                                "writer": WRITER,
                            },
                        )
                    else:
                        reused.add(kp_id)
                        sets = [
                            "parent_kp_id=%(parent)s",
                            "depth=%(depth)s",
                            "name=%(name)s",
                            "order_hint=%(hint)s",
                            "source_ref=%(source_ref)s",
                            "domain_id=%(domain_id)s",
                            "domain_label=%(domain_label)s",
                            "course_label=%(course_label)s",
                            "updated_by=%(writer)s",
                            "updated_at=%(now)s",
                        ]
                        params = {
                            "kp_id": kp_id,
                            "parent": node["parent_kp_id"],
                            "domain_id": domain_id,
                            "domain_label": domain_label,
                            "course_label": course_label,
                            "depth": node["depth"],
                            "name": node["name"],
                            "hint": index + 1,
                            "source_ref": _to_json(node["source_ref"]),
                            "now": now, "writer": WRITER,
                        }
                        # 未提交 summary 的节点保持原值（REQ-114 S2：整树重写不抹已写好的摘要）
                        if "summary" in node:
                            sets.append("summary=%(summary)s")
                            params["summary"] = node["summary"]
                        cursor.execute(
                            f"UPDATE qed_knowledge_point SET {', '.join(sets)} WHERE kp_id=%(kp_id)s",
                            params,
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
        """人工面白名单改列（parent_kp_id / name / order_hint / summary），归属与改名不重开确认。

        `meta`＝扩展槽合并写入（REQ-117 C20：章级学习要点落 `meta.chapter_key_points`，零 DDL）；
        只覆盖给出的键，不开放给人工面端点。
        """
        now = _now()
        conn = self._connect()
        try:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT kp_id, meta FROM qed_knowledge_point WHERE kp_id=%s FOR UPDATE", (kp_id,)
                )
                existing = cursor.fetchone()
                if existing is None:
                    raise LearnNotFound(f"知识点不存在：{kp_id}")
                sets, params = ["updated_by=%s", "updated_at=%s"], [WRITER, now]
                if "name" in fields:
                    sets += ["name=%s", "norm_key=%s"]
                    params += [fields["name"], norm_key(fields["name"])]
                if "order_hint" in fields:
                    sets.append("order_hint=%s")
                    params.append(fields["order_hint"])
                if "parent_kp_id" in fields:
                    sets.append("parent_kp_id=%s")
                    params.append(fields["parent_kp_id"])
                if "summary" in fields:
                    sets.append("summary=%s")
                    params.append(fields["summary"])
                if "meta" in fields:
                    merged = dict(_from_json(existing["meta"]) or {})
                    merged.update(fields["meta"] or {})
                    sets.append("meta=%s")
                    params.append(_to_json(merged))
                params.append(kp_id)
                cursor.execute(
                    f"UPDATE qed_knowledge_point SET {', '.join(sets)} WHERE kp_id=%s", params
                )
            conn.commit()
        finally:
            conn.close()
        return self.get_point(kp_id)

    def append_angle(self, kp_id: str, angle: str, *, note: str = "") -> dict[str, Any]:
        """`angles` 追加一元素＝按需生成注解条级腿的新落点（ADR 0026 D10）。

        同角不堆叠、只更新 `note`；数组序即权威排序，正文本身不落库（R5）。
        """
        if angle not in ANGLE_KINDS:
            raise LearnConflict(f"angle 必须是 {ANGLE_KINDS} 之一")
        conn = self._connect()
        try:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT angles FROM qed_knowledge_point WHERE kp_id=%s FOR UPDATE", (kp_id,)
                )
                row = cursor.fetchone()
                if row is None:
                    raise LearnNotFound(f"知识点不存在：{kp_id}")
                angles = [item for item in (_from_json(row["angles"]) or []) if isinstance(item, dict)]
                entry = next((item for item in angles if item.get("angle") == angle), None)
                if entry is None:
                    entry = {"angle": angle}
                    angles.append(entry)
                if note:
                    entry["note"] = note
                cursor.execute(
                    "UPDATE qed_knowledge_point SET angles=%s, updated_by=%s, updated_at=%s "
                    "WHERE kp_id=%s",
                    (_to_json(angles), WRITER, _now(), kp_id),
                )
            conn.commit()
        finally:
            conn.close()
        return self.get_point(kp_id)


def ensure_tables(settings: Settings) -> None:
    """幂等建主表（判例 qed_llm_calls）；数据库不可达抛异常由调用方降级。"""
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
