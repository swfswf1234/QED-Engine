"""学习域·练习与复习三表存储（M2）：qed_learn_question + qed_learn_attempt + qed_learn_review_task。

模块职责：练习域三表的幂等建表、题干规范化去重（`stem_hash`）、批量入库（重复即跳过的幂等
语义）、间隔复习调度纯函数（`schedule_next` / `INTERVAL_SEQUENCES` / `TYPE_PRIORITY`）、
作答同事务落库（判分 + `score_trend`/`resolved` + 调度回写，缝 6）、错题本派生查询与统计、
到期队列构建；事实源＝M2 壳「练习域三表契约」「间隔复习调度规格」两节。
两段式口径：判分依据（`expected_answer`/`keywords`/`explanation`）只存服务端，任何读取面经
`public_question()` 投影剔除（缝 2），仅作答端点在判分完成后回传。
设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
关联测试：tests/test_learn_practice.py
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pymysql

from qed_engine.config import Settings
from qed_engine.services.learn.base import LearnConflict, LearnNotFound
from qed_engine.services.learn.grading import ISSUE_MISSING_EXPECTED, grade
from qed_engine.services.learn.knowledge import norm_key
from qed_engine.services.llm.call_log import _connect

logger = logging.getLogger("qed_engine.learn")

QUESTION_KINDS = ("quiz", "flashcard")
QUESTION_TYPES = ("choice", "short", "open")
DIFFICULTIES = ("easy", "medium", "hard")
SOURCE_KINDS = ("exercise_book", "textbook_chapter", "solutions_book", "manual", "generated")
ANSWER_SOURCES = ("same_page", "solution_section", "sibling_book", "manual", "llm", "none")
ATTEMPT_ORIGINS = ("new", "review", "manual")
SELF_RESULTS = ("correct", "again")
SCORE_TRENDS = ("new", "improved", "declined", "unchanged")
REVIEW_STATUSES = ("active", "archived")
RETIRED_FILTERS = ("active", "all", "only")

# 缝 2：判分依据三列，任何题面下发响应必须剔除
SENSITIVE_COLUMNS = ("expected_answer", "keywords", "explanation")

# 间隔序列与优先级（DeepTutor `learning/scheduler.py:13-98` 逐值直译；无秒级调试开关）
INTERVAL_SEQUENCES: dict[str, tuple[int, ...]] = {
    "memory": (0, 1, 3, 7, 14, 30, 60),
    "concept": (3, 7, 14, 30),
    "procedure": (3, 7, 14),
    "design": (14, 28),
}
TYPE_PRIORITY = {"memory": 2, "concept": 3, "procedure": 4, "design": 5}
WRONG_PRIORITY = 1
DEFAULT_KP_TYPE = "memory"
DEFAULT_MAX_TASKS = 5

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS qed_learn_question (
  question_id VARCHAR(64) PRIMARY KEY COMMENT '题目 ID（服务端生成 q-<hex12>）',
  course_id VARCHAR(64) NOT NULL COMMENT '课程坐标（逻辑引用 qed_course，与知识点主表/星图/M6 工作台同源）',
  course_label VARCHAR(255) DEFAULT '' COMMENT '课程名快照',
  learn_course_id VARCHAR(64) COMMENT '所属学习课程（逻辑引用 qed_learn_course；非编译链路出题=NULL）',
  unit_id VARCHAR(64) COMMENT '关联块（逻辑引用 qed_learn_unit；M-2 编译接线后启用，v1 可空）',
  kp_id VARCHAR(64) COMMENT '归属细知识点（逻辑引用 qed_knowledge_point 的 point 行；NULL=未归档题）',
  kind VARCHAR(16) NOT NULL DEFAULT 'quiz' COMMENT '闭集 quiz=判分题 / flashcard=记忆卡（自评，不判分；裁决 ⑨：answer_source=none 时强制本值）',
  question_type VARCHAR(16) COMMENT 'quiz 行判分闭集 choice/short/open（与 M-3 三类一一对应）；flashcard 行 NULL',
  stem TEXT NOT NULL COMMENT '题干（LaTeX/Markdown 原文，按 M1 UI-1 渲染基线回原样；flashcard 存正面）',
  stem_hash CHAR(64) NOT NULL COMMENT '去重键（题干规范化：全角转半角+空白折叠+小写后 sha256），重复入库幂等命中',
  options JSON COMMENT 'choice 题选项 [{label,body}]，label 恰 A/B/C/D；其余 NULL',
  answer_back MEDIUMTEXT COMMENT 'flashcard 背面（quiz 行 NULL；与 expected_answer 分列，判分路径不混用）',
  expected_answer TEXT COMMENT '服务端判分依据（quiz 行必填，题面下发响应剔除本列，缝 2）；flashcard 行 NULL',
  keywords JSON COMMENT 'open 题关键词列表（命中比判分依据；choice/short 为 NULL）',
  explanation TEXT COMMENT '答案解析（判分后才回传）',
  difficulty VARCHAR(16) NOT NULL DEFAULT 'medium' COMMENT '闭集 easy/medium/hard',
  kp_type VARCHAR(16) COMMENT '知识点四分类**快照** memory/concept/procedure/design（间隔序列依据；主表 type 后改不回溯，R-6）',
  source_kind VARCHAR(16) NOT NULL DEFAULT 'exercise_book' COMMENT '题源闭集 exercise_book=习题集 / textbook_chapter=教材课后习题 / solutions_book=题解书 / manual=人工录入 / generated=v2 生成',
  book_ref VARCHAR(64) NOT NULL DEFAULT '' COMMENT '来源书（qt_books.book_id，书目级稳定，判例 M6 裁决 R10）',
  source_ref JSON COMMENT '溯源 {page,block_indexes,answer_page?,section?}（页序=PDF 页序；题面所在页与答案所在页分开记）',
  answer_source VARCHAR(16) NOT NULL DEFAULT 'none' COMMENT '答案来源闭集 same_page=同页 / solution_section=书内答案节 / sibling_book=关联题解书（qt_knowledge.textbook_ref↔exercise_ref 配对）/ manual=人工录入 / llm=v2 生成 / none=无答案（⑨：强制 flashcard 自评）',
  gen_batch VARCHAR(64) NOT NULL DEFAULT '' COMMENT '入库批次（抽取或生成一次作业一批，整批可核销；v1 取代作业表）',
  model_ref VARCHAR(128) NOT NULL DEFAULT '' COMMENT '产出者标识（manual/extract/模型名；不含密钥）',
  meta JSON COMMENT '杂项 {issues:[…],angle,extraction:{rule,confidence},plan_index}（J1：只读不筛的字段一律进本列）',
  retired TINYINT(1) NOT NULL DEFAULT 0 COMMENT '坏题软删位（人工写，机器不写 1；作答复历保留，R-4）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  UNIQUE KEY uq_question_course_hash (course_id, stem_hash),
  KEY idx_question_course (course_id, kind, retired),
  KEY idx_question_kp (kp_id),
  KEY idx_question_book (book_ref),
  KEY idx_question_batch (gen_batch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='练习题库（根自建；一行=一道题/一张卡，expected_answer 只存服务端，所有权 QED-Engine）';

CREATE TABLE IF NOT EXISTS qed_learn_attempt (
  attempt_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '行 ID（自增主键，时序即事实序）',
  question_id VARCHAR(64) NOT NULL COMMENT '题目（逻辑引用 qed_learn_question）',
  course_id VARCHAR(64) NOT NULL COMMENT '冗余课程坐标（错题本与统计按课程聚合）',
  kp_id VARCHAR(64) COMMENT '冗余知识点（M-3 掌握门按 kp 取近因序列、复习错题优先级判定）',
  origin VARCHAR(16) NOT NULL DEFAULT 'new' COMMENT '闭集 new=首练 / review=复习队列 / manual=人工重做',
  review_date DATETIME COMMENT 'origin=review 时=当次 due_at（调度回写的幂等依据）',
  user_answer TEXT NOT NULL COMMENT '学习者作答原文（不清洗不截断，判分函数内部规范化）',
  is_correct TINYINT(1) NOT NULL DEFAULT 0 COMMENT '判分结果（**服务端确定性判分写入，不信任客户端**，缝 1；自评卡由 self_result 置位）',
  method VARCHAR(16) NOT NULL DEFAULT 'deterministic' COMMENT '闭集 deterministic/llm/self（open 题 LLM 批改与 flashcard 自评）',
  judge_note VARCHAR(1000) DEFAULT '' COMMENT '判分/批改说明（method=llm 时存模型意见；不含密钥）',
  score_trend VARCHAR(16) NOT NULL DEFAULT 'new' COMMENT '闭集 new/improved/declined/unchanged（该题先前无行=new，同=unchanged，翻转=improved/declined）',
  resolved TINYINT(1) NOT NULL DEFAULT 0 COMMENT '已解决位：本次对=1，历史对而过本次错=0，其余保留旧值（DeepTutor CASE 语义直译）',
  bookmarked TINYINT(1) NOT NULL DEFAULT 0 COMMENT '错题本收藏（人工位，机器不写）',
  answered_at DATETIME NOT NULL COMMENT 'UTC 作答时间（近因加权排序键）',
  UNIQUE KEY uq_attempt_idem (question_id, review_date, origin),
  KEY idx_attempt_question (question_id, answered_at),
  KEY idx_attempt_kp (kp_id, answered_at),
  KEY idx_attempt_course (course_id, answered_at),
  KEY idx_attempt_open (course_id, resolved, is_correct)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='答题事实明细（M-3 掌握门的唯一数据源；全量保留逐次行不做只留终态的合并，缝 4）';

CREATE TABLE IF NOT EXISTS qed_learn_review_task (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  target_kind VARCHAR(16) NOT NULL COMMENT '闭集 question=具体题/卡（错题重练与闪卡节律）/ kp=知识点整体节律（v2 按知识点推题时用）',
  target_id VARCHAR(64) NOT NULL COMMENT 'question_id 或 kp_id',
  course_id VARCHAR(64) NOT NULL COMMENT '课程坐标（到期队列按课程取）',
  kp_type VARCHAR(16) NOT NULL COMMENT '间隔序列依据（kp 目标取主表 type，question 目标取该行 kp_type 快照；无分类回落 memory 序列并记 meta）',
  interval_index TINYINT NOT NULL DEFAULT 0 COMMENT '当前档位（序列下标）',
  consecutive_correct TINYINT NOT NULL DEFAULT 0 COMMENT '连对计数（≥2 跳两档后清零）',
  consecutive_wrong TINYINT NOT NULL DEFAULT 0 COMMENT '连错计数（≥2 清零，档位已回退）',
  due_at DATETIME NOT NULL COMMENT 'UTC 到期时间（S2「重启不丢进度」的核验点）',
  status VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT '闭集 active/archived（知识点删除/题 retired → 归档不删行）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  UNIQUE KEY uq_review_target (target_kind, target_id),
  KEY idx_review_due (course_id, status, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='间隔复习调度态（L3 的 MySQL 化：从 state_json blob 列化，双粒度，重启不丢；所有权 QED-Engine）';
"""

_QUESTION_COLUMNS = (
    "question_id, course_id, course_label, learn_course_id, unit_id, kp_id, kind, question_type, "
    "stem, stem_hash, options, answer_back, expected_answer, keywords, explanation, difficulty, "
    "kp_type, source_kind, book_ref, source_ref, answer_source, gen_batch, model_ref, meta, "
    "retired, created_at, updated_at"
)
_ATTEMPT_COLUMNS = (
    "attempt_id, question_id, course_id, kp_id, origin, review_date, user_answer, is_correct, "
    "method, judge_note, score_trend, resolved, bookmarked, answered_at"
)
_TASK_COLUMNS = (
    "id, target_kind, target_id, course_id, kp_type, interval_index, consecutive_correct, "
    "consecutive_wrong, due_at, status, created_at, updated_at"
)
_JSON_COLUMNS = ("options", "keywords", "meta", "source_ref")
_BOOL_COLUMNS = ("retired", "is_correct", "resolved", "bookmarked")
_DATETIME_COLUMNS = ("created_at", "updated_at", "answered_at", "due_at", "review_date")


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


def stem_hash(stem: str) -> str:
    """题面去重键：与知识点 `norm_key` 同口径规范化（全角转半角+空白折叠+小写）后取 sha256。"""
    return hashlib.sha256(norm_key(stem).encode("utf-8")).hexdigest()


def interval_sequence(kp_type: str | None) -> tuple[int, ...]:
    """间隔序列取值：无分类或未知分类一律回落 memory 序列（R-6 快照列可空）。"""
    return INTERVAL_SEQUENCES.get(str(kp_type or ""), INTERVAL_SEQUENCES[DEFAULT_KP_TYPE])


def schedule_next(state: dict[str, Any], correct: bool, now: datetime) -> dict[str, Any]:
    """间隔调度纯函数（DeepTutor `scheduler.py:45-70` 直译，时钟由参数注入）。

    答对：`consecutive_correct += 1`，满 2 跳两档并清零，否则进一档；答错：回退一档、
    连错满 2 清零；档位钳在 `[0, len(sequence)-1]`，`due_at = now + sequence[index]` 天。
    flashcard 自评映射（`correct`/`again`）走同一函数，不设第二套语义。
    """
    sequence = interval_sequence(state.get("kp_type"))
    index = int(state.get("interval_index") or 0)
    consecutive_correct = int(state.get("consecutive_correct") or 0)
    consecutive_wrong = int(state.get("consecutive_wrong") or 0)
    if correct:
        consecutive_wrong = 0
        consecutive_correct += 1
        if consecutive_correct >= 2:
            index += 2
            consecutive_correct = 0
        else:
            index += 1
    else:
        consecutive_correct = 0
        index = max(0, index - 1)
        consecutive_wrong += 1
        if consecutive_wrong >= 2:
            consecutive_wrong = 0
    index = max(0, min(index, len(sequence) - 1))
    return {
        "interval_index": index,
        "consecutive_correct": consecutive_correct,
        "consecutive_wrong": consecutive_wrong,
        "due_at": now + timedelta(days=sequence[index]),
    }


def resolve_trend(previous: dict[str, Any] | None, correct: bool) -> tuple[str, bool]:
    """`score_trend`/`resolved`（DeepTutor CASE 语义直译）：无历史=new，翻转=improved/declined。"""
    if previous is None:
        return ("new", correct)
    was_correct = bool(previous.get("is_correct"))
    if correct and not was_correct:
        return ("improved", True)
    if was_correct and not correct:
        return ("declined", False)
    return ("unchanged", correct or bool(previous.get("resolved")))


def public_question(row: dict[str, Any]) -> dict[str, Any]:
    """题面下发投影（缝 2）：剔除判分依据三列，其余原样回传。"""
    return {key: value for key, value in row.items() if key not in SENSITIVE_COLUMNS}


def build_question_row(
    item: dict[str, Any],
    *,
    course_id: str,
    gen_batch: str = "",
    model_ref: str = "",
    learn_course_id: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """入库项 → 题行（两实现共用的唯一规范化点；结构闭集校验在 API 面，本函数只兜空题干）。"""
    stem = str(item.get("stem") or "")
    if not stem.strip():
        raise ValueError("stem 不可为空")
    stamp = now or _now()
    return {
        "question_id": f"q-{uuid.uuid4().hex[:12]}",
        "course_id": course_id,
        "course_label": item.get("course_label") or "",
        "learn_course_id": learn_course_id if learn_course_id else item.get("learn_course_id"),
        "unit_id": item.get("unit_id"),
        "kp_id": item.get("kp_id"),
        "kind": item.get("kind") or "quiz",
        "question_type": item.get("question_type"),
        "stem": stem,
        "stem_hash": stem_hash(stem),
        "options": item.get("options"),
        "answer_back": item.get("answer_back") or "",
        "expected_answer": item.get("expected_answer") or "",
        "keywords": item.get("keywords"),
        "explanation": item.get("explanation") or "",
        "difficulty": item.get("difficulty") or "medium",
        "kp_type": item.get("kp_type"),
        "source_kind": item.get("source_kind") or "exercise_book",
        "book_ref": item.get("book_ref") or "",
        "source_ref": item.get("source_ref"),
        "answer_source": item.get("answer_source") or "none",
        "gen_batch": gen_batch or "",
        "model_ref": model_ref or "",
        "meta": item.get("meta") or {},
        "retired": False,
        "created_at": stamp,
        "updated_at": stamp,
    }


def _record_issue(row: dict[str, Any], note: str) -> dict[str, Any]:
    """判分残余问题写进 `meta.issues`（J1：只读不筛的杂项进 meta，不建列）。"""
    if not note:
        return row
    meta = dict(row.get("meta") or {})
    issues = list(meta.get("issues") or [])
    if note not in issues:
        issues.append(note)
    meta["issues"] = issues
    row["meta"] = meta
    return row


def _serialize(row: dict[str, Any] | None) -> dict[str, Any]:
    """对外行：JSON 列反解、布尔位转 bool、时间列转 ISO 字符串（两实现共用）。"""
    if row is None:
        return {}
    out = dict(row)
    for column in _JSON_COLUMNS:
        if column in out:
            out[column] = _from_json(out[column])
            if column == "meta" and out[column] is None:
                out[column] = {}
    for column in _BOOL_COLUMNS:
        if column in out:
            out[column] = bool(out[column])
    for column in _DATETIME_COLUMNS:
        if column in out and isinstance(out[column], datetime):
            out[column] = out[column].isoformat()
    return out


def _as_naive(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if value.tzinfo is not None:
        value = value.astimezone(UTC).replace(tzinfo=None)
    return value


def _overdue_days(due_at: datetime, now: datetime) -> int:
    return max(0, int((now - due_at).total_seconds() // 86400))


def task_view(task: dict[str, Any], now: datetime, wrong: bool) -> dict[str, Any]:
    """到期队列行对外形状：优先级即时派生（不落列，J5），题面由调用方投影后挂 `question`。"""
    due_at = task["due_at"]
    kp_type = task["kp_type"]
    return {
        "target_kind": task["target_kind"],
        "target_id": task["target_id"],
        "course_id": task["course_id"],
        "kp_type": kp_type,
        "interval_index": int(task["interval_index"]),
        "due_at": due_at.isoformat() if isinstance(due_at, datetime) else due_at,
        "priority": WRONG_PRIORITY if wrong else TYPE_PRIORITY.get(
            str(kp_type or ""), TYPE_PRIORITY[DEFAULT_KP_TYPE]
        ),
        "reason": "wrong" if wrong else "type",
        "overdue_days": _overdue_days(due_at, now) if isinstance(due_at, datetime) else 0,
        "question": None,
    }


def filter_mistakes(
    items: list[dict[str, Any]], *, resolved: str, bookmarked: str | None, trend: str | None
) -> list[dict[str, Any]]:
    """错题本三过滤位（两实现共用）：resolved=未解决视角，bookmarked=题下任一收藏行。"""
    out = []
    for item in items:
        if resolved == "false" and item["resolved"]:
            continue
        if resolved == "true" and not item["resolved"]:
            continue
        if bookmarked == "true" and not item["bookmarked"]:
            continue
        if bookmarked == "false" and item["bookmarked"]:
            continue
        if trend and item["score_trend"] != trend:
            continue
        out.append(item)
    return out


class MySQLPracticeStore:
    """练习域三表 MySQL 存储（qed 库；判分/调度回写同事务，缝 6）。"""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _connect(self) -> pymysql.Connection:
        return _connect(self._settings)

    # ---------- 题库 ----------

    def add_questions(
        self,
        *,
        course_id: str,
        items: list[dict[str, Any]],
        gen_batch: str = "",
        model_ref: str = "",
        learn_course_id: str | None = None,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        """批量入库：`(course_id, stem_hash)` 命中即跳过（幂等）；整批同事务，一项非法整体回滚。"""
        stamp = _as_naive(now) or _now()
        created: list[dict[str, Any]] = []
        rows: list[dict[str, Any]] = []
        skipped = 0
        conn = self._connect()
        try:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                for item in items:
                    row = build_question_row(
                        item,
                        course_id=course_id,
                        gen_batch=gen_batch,
                        model_ref=model_ref,
                        learn_course_id=learn_course_id,
                        now=stamp,
                    )
                    cursor.execute(
                        "SELECT question_id FROM qed_learn_question WHERE course_id=%s AND stem_hash=%s",
                        (course_id, row["stem_hash"]),
                    )
                    hit = cursor.fetchone()
                    if hit:
                        skipped += 1
                        rows.append(self._question(cursor, hit["question_id"]))
                        continue
                    values = {key: _to_json(value) if key in _JSON_COLUMNS else value
                              for key, value in row.items()}
                    columns = ", ".join(values)
                    placeholders = ", ".join(f"%({key})s" for key in values)
                    cursor.execute(
                        f"INSERT INTO qed_learn_question ({columns}) VALUES ({placeholders})", values
                    )
                    self._ensure_task(
                        cursor, "question", row["question_id"], course_id,
                        row["kp_type"] or DEFAULT_KP_TYPE, stamp,
                    )
                    created.append(row)
                    rows.append(self._question(cursor, row["question_id"]))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return {
            "created": len(created),
            "skipped_duplicates": skipped,
            "questions": [_serialize(row) for row in rows],
            "gen_batch": gen_batch,
            "model_ref": model_ref,
        }

    def _question(self, cursor: Any, question_id: str) -> dict[str, Any]:
        cursor.execute(
            f"SELECT {_QUESTION_COLUMNS} FROM qed_learn_question WHERE question_id=%s", (question_id,)
        )
        row = cursor.fetchone()
        if row is None:
            raise LearnNotFound(f"题目不存在：{question_id}")
        return dict(row)

    def get_question(self, question_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                row = self._question(cursor, question_id)
        return _serialize(row)

    def list_questions(
        self,
        *,
        course_id: str | None = None,
        kp_id: str | None = None,
        kind: str | None = None,
        question_type: str | None = None,
        source_kind: str | None = None,
        book_ref: str | None = None,
        retired: str = "active",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        where: list[str] = []
        params: list[Any] = []
        for column, value in (
            ("course_id", course_id), ("kp_id", kp_id), ("kind", kind),
            ("question_type", question_type), ("source_kind", source_kind), ("book_ref", book_ref),
        ):
            if value:
                where.append(f"{column}=%s")
                params.append(value)
        if retired == "active":
            where.append("retired=0")
        elif retired == "only":
            where.append("retired=1")
        clause = f"WHERE {' AND '.join(where)}" if where else ""
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(f"SELECT COUNT(*) AS n FROM qed_learn_question {clause}", params)
                total = int(cursor.fetchone()["n"])
                cursor.execute(
                    f"SELECT {_QUESTION_COLUMNS} FROM qed_learn_question {clause} "
                    "ORDER BY created_at, question_id LIMIT %s OFFSET %s",
                    [*params, limit, offset],
                )
                rows = cursor.fetchall()
        return [_serialize(row) for row in rows], total

    def patch_question(self, question_id: str, **fields: Any) -> dict[str, Any]:
        """人工面白名单改列；`gen_batch`/`model_ref`/`stem_hash` 等产出事实不可改（API 面拦）。"""
        stamp = _now()
        conn = self._connect()
        try:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                self._question(cursor, question_id)
                sets: list[str] = ["updated_at=%s"]
                params: list[Any] = [stamp]
                for key, value in fields.items():
                    if key == "stem":
                        sets += ["stem=%s", "stem_hash=%s"]
                        params += [value, stem_hash(value)]
                    elif key in _JSON_COLUMNS:
                        sets.append(f"{key}=%s")
                        params.append(_to_json(value))
                    elif key == "retired":
                        sets.append("retired=%s")
                        params.append(int(bool(value)))
                    else:
                        sets.append(f"{key}=%s")
                        params.append(value)
                params.append(question_id)
                cursor.execute(
                    f"UPDATE qed_learn_question SET {', '.join(sets)} WHERE question_id=%s", params
                )
                if "retired" in fields:
                    status = "archived" if bool(fields["retired"]) else "active"
                    cursor.execute(
                        "UPDATE qed_learn_review_task SET status=%s, updated_at=%s "
                        "WHERE target_kind='question' AND target_id=%s",
                        (status, stamp, question_id),
                    )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return self.get_question(question_id)

    # ---------- 作答与判分（缝 1/2/6） ----------

    def add_attempt(
        self,
        *,
        question_id: str,
        user_answer: str,
        origin: str = "new",
        review_date: datetime | str | None = None,
        self_result: str | None = None,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        """同事务：判分 + 作答行 + `score_trend`/`resolved` + `schedule_next` 回写（缝 6）。"""
        stamp = _as_naive(now) or _now()
        review_when = _as_naive(review_date)
        conn = self._connect()
        try:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_QUESTION_COLUMNS} FROM qed_learn_question WHERE question_id=%s FOR UPDATE",
                    (question_id,),
                )
                question = cursor.fetchone()
                if question is None or bool(question["retired"]):
                    raise LearnNotFound(f"题目不存在：{question_id}")
                question = dict(question)
                cursor.execute(
                    "SELECT COUNT(*) AS n FROM qed_learn_attempt WHERE question_id=%s "
                    "AND review_date=%s AND origin=%s",
                    (question_id, review_when, origin),
                )
                if int(cursor.fetchone()["n"]):
                    raise LearnConflict(
                        f"同一题在同期望复习日（{origin} / {review_when}）已作答，不重复计"
                    )
                previous = self._latest_attempt(cursor, question_id)
                if question["kind"] == "flashcard":
                    correct = self_result == "correct"
                    verdict = {"is_correct": correct, "method": "self", "note": "自评记忆卡"}
                else:
                    verdict = grade(question, user_answer)
                    correct = bool(verdict["is_correct"])
                trend, resolved = resolve_trend(previous, correct)
                cursor.execute(
                    "INSERT INTO qed_learn_attempt "
                    "(question_id, course_id, kp_id, origin, review_date, user_answer, is_correct, "
                    " method, judge_note, score_trend, resolved, bookmarked, answered_at) "
                    "VALUES (%(question_id)s, %(course_id)s, %(kp_id)s, %(origin)s, %(review_date)s, "
                    " %(user_answer)s, %(is_correct)s, %(method)s, %(judge_note)s, %(score_trend)s, "
                    " %(resolved)s, 0, %(answered_at)s)",
                    {
                        "question_id": question_id,
                        "course_id": question["course_id"],
                        "kp_id": question["kp_id"],
                        "origin": origin,
                        "review_date": review_when,
                        "user_answer": user_answer,
                        "is_correct": int(correct),
                        "method": verdict["method"],
                        "judge_note": verdict["note"][:1000],
                        "score_trend": trend,
                        "resolved": int(resolved),
                        "answered_at": stamp,
                    },
                )
                attempt_id = cursor.lastrowid
                if verdict["note"] == ISSUE_MISSING_EXPECTED:
                    question = _record_issue(question, ISSUE_MISSING_EXPECTED)
                    cursor.execute(
                        "UPDATE qed_learn_question SET meta=%s, updated_at=%s WHERE question_id=%s",
                        (_to_json(question["meta"]), stamp, question_id),
                    )
                review = self._write_back(
                    cursor, question, question["kp_type"] or DEFAULT_KP_TYPE, correct, stamp
                )
                if question["kp_id"]:
                    self._ensure_task(cursor, "kp", question["kp_id"], question["course_id"],
                                      question["kp_type"] or DEFAULT_KP_TYPE, stamp)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        attempt = self.get_attempt(attempt_id)
        revealed = question["kind"] != "flashcard"
        return {
            "attempt": attempt,
            "grade": verdict,
            "review": review,
            "expected_answer": (question.get("expected_answer") or None) if revealed else None,
            "explanation": (question.get("explanation") or None) if revealed else None,
        }

    def _write_back(
        self,
        cursor: Any,
        question: dict[str, Any],
        kp_type: str,
        correct: bool,
        now: datetime,
    ) -> dict[str, Any]:
        """回写 question 粒度调度态并返回 `review` 响应块（缝 6 同事务）。"""
        cursor.execute(
            f"SELECT {_TASK_COLUMNS} FROM qed_learn_review_task "
            "WHERE target_kind='question' AND target_id=%s",
            (question["question_id"],),
        )
        task = cursor.fetchone() or {
            "target_kind": "question",
            "target_id": question["question_id"],
            "course_id": question["course_id"],
            "kp_type": kp_type,
            "interval_index": 0,
            "consecutive_correct": 0,
            "consecutive_wrong": 0,
            "due_at": now,
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        state = schedule_next(task, correct, now)
        cursor.execute(
            "INSERT INTO qed_learn_review_task "
            "(target_kind, target_id, course_id, kp_type, interval_index, consecutive_correct, "
            " consecutive_wrong, due_at, status, created_at, updated_at) "
            "VALUES (%(target_kind)s, %(target_id)s, %(course_id)s, %(kp_type)s, "
            " %(interval_index)s, %(consecutive_correct)s, %(consecutive_wrong)s, %(due_at)s, "
            " 'active', %(now)s, %(now)s) "
            "ON DUPLICATE KEY UPDATE interval_index=VALUES(interval_index), "
            "consecutive_correct=VALUES(consecutive_correct), consecutive_wrong=VALUES(consecutive_wrong), "
            "due_at=VALUES(due_at), status='active', updated_at=VALUES(updated_at)",
            {
                "target_kind": "question",
                "target_id": question["question_id"],
                "course_id": question["course_id"],
                "kp_type": task.get("kp_type") or kp_type,
                "now": now,
                **state,
            },
        )
        return {
            "target_kind": "question",
            "target_id": question["question_id"],
            "kp_type": task.get("kp_type") or kp_type,
            "interval_index": state["interval_index"],
            "due_at": state["due_at"].isoformat(),
            "next_due_at": state["due_at"].isoformat(),
        }

    def _ensure_task(
        self, cursor: Any, target_kind: str, target_id: str, course_id: str, kp_type: str,
        now: datetime,
    ) -> None:
        cursor.execute(
            "INSERT INTO qed_learn_review_task "
            "(target_kind, target_id, course_id, kp_type, interval_index, consecutive_correct, "
            " consecutive_wrong, due_at, status, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s, 0, 0, 0, %s, 'active', %s, %s) "
            "ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)",
            (target_kind, target_id, course_id, kp_type, now, now, now),
        )

    def _latest_attempt(self, cursor: Any, question_id: str) -> dict[str, Any] | None:
        cursor.execute(
            f"SELECT {_ATTEMPT_COLUMNS} FROM qed_learn_attempt WHERE question_id=%s "
            "ORDER BY answered_at DESC, attempt_id DESC LIMIT 1",
            (question_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_attempt(self, attempt_id: int) -> dict[str, Any]:
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_ATTEMPT_COLUMNS} FROM qed_learn_attempt WHERE attempt_id=%s",
                    (attempt_id,),
                )
                row = cursor.fetchone()
        if row is None:
            raise LearnNotFound(f"作答记录不存在：{attempt_id}")
        return _serialize(row)

    def patch_attempt(self, attempt_id: int, **fields: Any) -> dict[str, Any]:
        """错题本人工位（bookmarked/resolved）；判分结果列不在白名单。"""
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT attempt_id FROM qed_learn_attempt WHERE attempt_id=%s FOR UPDATE",
                    (attempt_id,),
                )
                if cursor.fetchone() is None:
                    raise LearnNotFound(f"作答记录不存在：{attempt_id}")
                sets: list[str] = []
                params: list[Any] = []
                for key, value in fields.items():
                    sets.append(f"{key}=%s")
                    params.append(int(bool(value)))
                params.append(attempt_id)
                cursor.execute(f"UPDATE qed_learn_attempt SET {', '.join(sets)} WHERE attempt_id=%s", params)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return self.get_attempt(attempt_id)

    # ---------- 复习队列（纯函数调度 + 持久态） ----------

    def review_due(
        self, course_id: str | None = None, max_tasks: int = DEFAULT_MAX_TASKS,
        now: datetime | None = None,
    ) -> list[dict[str, Any]]:
        when = _as_naive(now) or _now()
        where = ["status='active'", "due_at<=%s"]
        params: list[Any] = [when]
        if course_id:
            where.append("course_id=%s")
            params.append(course_id)
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_TASK_COLUMNS} FROM qed_learn_review_task "
                    f"WHERE {' AND '.join(where)} ORDER BY due_at, target_id",
                    params,
                )
                tasks = [dict(row) for row in cursor.fetchall()]
                wrong = self._wrong_targets(cursor, course_id)
                questions = self._question_map(cursor, [t["target_id"] for t in tasks
                                                        if t["target_kind"] == "question"])
        scored = [
            task_view(task, when, task["target_id"] in wrong)
            for task in tasks
        ]
        scored.sort(key=lambda t: (t["priority"], t["due_at"], t["target_id"]))
        for task in scored[:max_tasks]:
            row = questions.get(task["target_id"])
            task["question"] = _serialize(row) if row else None
        return scored[:max_tasks]

    def _wrong_targets(self, cursor: Any, course_id: str | None) -> set[str]:
        """未解决错题集合（判例 DeepTutor `error_records` status=active）：最近一次作答判错的题。"""
        where = ["retired=0"]
        params: list[Any] = []
        if course_id:
            where.append("course_id=%s")
            params.append(course_id)
        cursor.execute(
            f"SELECT q.question_id, q.kp_id FROM qed_learn_question q "
            f"WHERE {' AND '.join(where)}",
            params,
        )
        rows = cursor.fetchall()
        unresolved: set[str] = set()
        for row in rows:
            latest = self._latest_attempt(cursor, row["question_id"])
            if latest and not bool(latest["is_correct"]) and not bool(latest["resolved"]):
                unresolved.add(row["question_id"])
                if row["kp_id"]:
                    unresolved.add(row["kp_id"])
        return unresolved

    def _question_map(self, cursor: Any, question_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not question_ids:
            return {}
        marks = ", ".join(["%s"] * len(question_ids))
        cursor.execute(
            f"SELECT {_QUESTION_COLUMNS} FROM qed_learn_question WHERE question_id IN ({marks})",
            question_ids,
        )
        return {row["question_id"]: dict(row) for row in cursor.fetchall()}

    def count_review_due(self, course_id: str | None = None, now: datetime | None = None) -> int:
        when = _as_naive(now) or _now()
        where = ["status='active'", "due_at<=%s"]
        params: list[Any] = [when]
        if course_id:
            where.append("course_id=%s")
            params.append(course_id)
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM qed_learn_review_task WHERE {' AND '.join(where)}", params
                )
                return int(cursor.fetchone()[0])

    # ---------- 错题本（派生查询，不建表） ----------

    def _mistake_rows(
        self, *, course_id: str | None, kp_id: str | None, book_ref: str | None, now: datetime
    ) -> list[dict[str, Any]]:
        where = ["retired=0"]
        params: list[Any] = []
        for column, value in (("course_id", course_id), ("kp_id", kp_id), ("book_ref", book_ref)):
            if value:
                where.append(f"{column}=%s")
                params.append(value)
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_QUESTION_COLUMNS} FROM qed_learn_question "
                    f"WHERE {' AND '.join(where)} ORDER BY created_at, question_id",
                    params,
                )
                questions = [dict(row) for row in cursor.fetchall()]
                items: list[dict[str, Any]] = []
                for question in questions:
                    cursor.execute(
                        f"SELECT {_ATTEMPT_COLUMNS} FROM qed_learn_attempt WHERE question_id=%s "
                        "ORDER BY answered_at DESC, attempt_id DESC",
                        (question["question_id"],),
                    )
                    attempts = [dict(row) for row in cursor.fetchall()]
                    if not attempts:
                        continue
                    latest = attempts[0]
                    if all(bool(a["is_correct"]) for a in attempts):
                        continue
                    cursor.execute(
                        "SELECT COUNT(*) AS n FROM qed_learn_review_task "
                        "WHERE status='active' AND due_at<=%s AND target_kind='question' AND target_id=%s",
                        (now, question["question_id"]),
                    )
                    items.append(
                        {
                            "question": _serialize(question),
                            "last_attempt": _serialize(latest),
                            "attempt_count": len(attempts),
                            "wrong_count": sum(1 for a in attempts if not bool(a["is_correct"])),
                            "is_correct": bool(latest["is_correct"]),
                            "resolved": bool(latest["resolved"]),
                            "bookmarked": any(bool(a["bookmarked"]) for a in attempts),
                            "score_trend": latest["score_trend"],
                            "due_today": int(cursor.fetchone()["n"]) > 0,
                        }
                    )
        return items

    def list_mistakes(
        self,
        *,
        course_id: str | None = None,
        kp_id: str | None = None,
        book_ref: str | None = None,
        resolved: str = "false",
        bookmarked: str | None = None,
        trend: str | None = None,
        limit: int = 50,
        offset: int = 0,
        now: datetime | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        items = filter_mistakes(
            self._mistake_rows(course_id=course_id, kp_id=kp_id, book_ref=book_ref,
                               now=_as_naive(now) or _now()),
            resolved=resolved,
            bookmarked=bookmarked,
            trend=trend,
        )
        return items[offset : offset + limit], len(items)

    def mistake_stats(
        self,
        *,
        course_id: str | None = None,
        kp_id: str | None = None,
        book_ref: str | None = None,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        when = _as_naive(now) or _now()
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                where = ["retired=0"]
                params: list[Any] = []
                for column, value in (("course_id", course_id), ("kp_id", kp_id), ("book_ref", book_ref)):
                    if value:
                        where.append(f"{column}=%s")
                        params.append(value)
                cursor.execute(
                    f"SELECT COUNT(*) AS n FROM qed_learn_question WHERE {' AND '.join(where)}", params
                )
                total = int(cursor.fetchone()["n"])
        rows = self._mistake_rows(course_id=course_id, kp_id=kp_id, book_ref=book_ref, now=when)
        where = ["t.status='active'", "t.due_at<=%s", "t.target_kind='question'", "q.retired=0"]
        params: list[Any] = [when]
        for column, value in (("q.course_id", course_id), ("q.kp_id", kp_id), ("q.book_ref", book_ref)):
            if value:
                where.append(f"{column}=%s")
                params.append(value)
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT COUNT(*) AS n FROM qed_learn_review_task t "
                    "JOIN qed_learn_question q ON q.question_id=t.target_id "
                    f"WHERE {' AND '.join(where)}",
                    params,
                )
                due_today = int(cursor.fetchone()["n"])
        return {
            "total": total,
            "wrong": len({row["question"]["question_id"] for row in rows}),
            "unresolved": sum(1 for row in rows if not row["resolved"]),
            "bookmarked": sum(1 for row in rows if row["bookmarked"]),
            "due_today": due_today,
        }

def ensure_tables(settings: Settings) -> None:
    """幂等建三表（判例 qed_learn_*）；数据库不可达抛异常由调用方降级。"""
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


def build_store(settings: Settings) -> MySQLPracticeStore | None:
    """存储工厂：未配置数据库密码（测试/未配置环境）时返回 None → 端点 503。"""
    if not settings.qed_db_password.get_secret_value():
        return None
    return MySQLPracticeStore(settings)


__all__ = [
    "ANSWER_SOURCES",
    "ATTEMPT_ORIGINS",
    "DEFAULT_MAX_TASKS",
    "DIFFICULTIES",
    "INTERVAL_SEQUENCES",
    "MySQLPracticeStore",
    "QUESTION_KINDS",
    "QUESTION_TYPES",
    "RETIRED_FILTERS",
    "SCORE_TRENDS",
    "SELF_RESULTS",
    "SENSITIVE_COLUMNS",
    "SOURCE_KINDS",
    "TYPE_PRIORITY",
    "WRONG_PRIORITY",
    "build_store",
    "ensure_tables",
    "grade",
    "filter_mistakes",
    "interval_sequence",
    "task_view",
    "public_question",
    "resolve_trend",
    "schedule_next",
    "stem_hash",
]
