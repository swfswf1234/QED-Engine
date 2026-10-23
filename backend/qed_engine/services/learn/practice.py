"""学习域·练习与复习两表存储（M2）：`qe_question` + `qe_attempt`。

模块职责：练习域两表的幂等建表、题干规范化去重（`stem_hash`）、批量入库（重复即跳过的幂等
语义）、间隔复习调度纯函数（`schedule_next` / `INTERVAL_SEQUENCES` / `TYPE_PRIORITY`）与
**到期态读时重放**（`replay_due`；调度表 `qe_review_task` 整表随 ADR 0026 D3 退出，档位与
到期时刻都不落列）、作答同事务落库（判分 + 幂等 + `meta.issues` 残余，缝 6）、错题本派生
查询与统计；事实源＝docs/architecture/database-design.md §五 两节。
两段式口径：判分依据（`expected_answer`/`keywords`/`explanation`）只存服务端，任何读取面经
`public_question()` 投影剔除（缝 2），仅作答端点在判分完成后回传。
`score_trend` 同批退列（D9 C1）：趋势与到期都由流水读时派生，端点响应字段名不变、前端零扰动；
`resolved` 与 `bookmarked` 是纯人工位（R6），机器判分恒不写。
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
from qed_engine.services.learn.base import DEFAULT_OWNER, LearnConflict, LearnNotFound
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
CREATE TABLE IF NOT EXISTS qe_question (
  question_id VARCHAR(64) PRIMARY KEY COMMENT '题目 ID（服务端生成 q-<hex12>）',
  course_id VARCHAR(64) NOT NULL COMMENT '课程坐标（逻辑引用 qed_course，与知识点主表/星图/M6 工作台同源）',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='练习题库（根自建；一行=一道题/一张卡，expected_answer 只存服务端，所有权 QED-Engine）';

CREATE TABLE IF NOT EXISTS qe_attempt (
  attempt_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '行 ID（自增主键，时序即事实序）',
  owner VARCHAR(64) NOT NULL DEFAULT 'admin' COMMENT '学习者标识（v1.0 恒 admin，多用户扩展位；幂等键前缀）',
  question_id VARCHAR(64) NOT NULL COMMENT '题目（逻辑引用 qe_question）',
  course_id VARCHAR(64) NOT NULL COMMENT '冗余课程坐标（错题本与统计按课程聚合）',
  kp_id VARCHAR(64) COMMENT '冗余知识点（掌握门按 kp 取近因序列、复习错题优先级判定）',
  origin VARCHAR(16) NOT NULL DEFAULT 'new' COMMENT '闭集 new=首练 / review=复习队列 / manual=人工重做',
  review_date DATETIME COMMENT 'origin=review 时=当次到期时刻（重放幂等依据）',
  user_answer TEXT NOT NULL COMMENT '学习者作答原文（不清洗不截断，判分函数内部规范化）',
  is_correct TINYINT(1) NOT NULL DEFAULT 0 COMMENT '判分结果（**服务端确定性判分写入，不信任客户端**，缝 1；自评卡由 self_result 置位）',
  method VARCHAR(16) NOT NULL DEFAULT 'deterministic' COMMENT '闭集 deterministic/llm/self（open 题 LLM 批改与 flashcard 自评）',
  judge_note VARCHAR(1000) DEFAULT '' COMMENT '判分/批改说明（method=llm 时存模型意见；不含密钥）',
  resolved TINYINT(1) NOT NULL DEFAULT 0 COMMENT '已解决位（**纯人工位**：只由学习者在错题本工位置位，机器判分不写本列）',
  bookmarked TINYINT(1) NOT NULL DEFAULT 0 COMMENT '错题本收藏（人工位，机器不写）',
  answered_at DATETIME NOT NULL COMMENT 'UTC 作答时间（近因加权排序键）',
  UNIQUE KEY uq_attempt_idem (owner, question_id, review_date, origin),
  KEY idx_attempt_question (owner, question_id, answered_at),
  KEY idx_attempt_kp (owner, kp_id, answered_at),
  KEY idx_attempt_course (owner, course_id, answered_at),
  KEY idx_attempt_open (course_id, resolved, is_correct)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='答题事实明细（掌握门的唯一数据源；全量保留逐次行不做只留终态的合并，缝 4；趋势与到期档位读时重放不落列）';
"""

_QUESTION_COLUMNS = (
    "question_id, course_id, kp_id, kind, question_type, stem, stem_hash, options, answer_back, "
    "expected_answer, keywords, explanation, difficulty, kp_type, source_kind, book_ref, "
    "source_ref, answer_source, gen_batch, model_ref, meta, retired, created_at, updated_at"
)
_ATTEMPT_COLUMNS = (
    "attempt_id, owner, question_id, course_id, kp_id, origin, review_date, user_answer, "
    "is_correct, method, judge_note, resolved, bookmarked, answered_at"
)
_JSON_COLUMNS = ("options", "keywords", "meta", "source_ref")
_BOOL_COLUMNS = ("retired", "is_correct", "resolved", "bookmarked")
_DATETIME_COLUMNS = ("created_at", "updated_at", "answered_at", "review_date")


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


def seed_state(question: dict[str, Any], now: datetime) -> dict[str, Any]:
    """重放起点：未作答题即建题时刻到期、档位 0（与退役调度表的建行口径同值）。"""
    return {
        "kp_type": str(question.get("kp_type") or DEFAULT_KP_TYPE),
        "interval_index": 0,
        "consecutive_correct": 0,
        "consecutive_wrong": 0,
        "due_at": _as_naive(question.get("created_at")) or now,
    }


def replay_due(question: dict[str, Any], attempts: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    """作答流水 → 调度态的确定性重放（ADR 0026 D3：调度表退出，本函数是其唯一替代）。

    `attempts` 须按事实序升序，逐次喂给 `schedule_next`、时钟取该行自己的作答时刻——
    与旧表逐次回写的结果逐值相等（黄金样本对拍判据）。
    """
    state = seed_state(question, now)
    for attempt in attempts:
        state = {
            **state,
            **schedule_next(
                state, bool(attempt["is_correct"]), _as_naive(attempt["answered_at"]) or now
            ),
        }
    return state


def resolve_trend(previous: dict[str, Any] | None, correct: bool) -> str:
    """趋势分支（DeepTutor CASE 语义直译）：无历史=new，翻转=improved/declined，其余=unchanged。"""
    if previous is None:
        return "new"
    was_correct = bool(previous.get("is_correct"))
    if correct and not was_correct:
        return "improved"
    if was_correct and not correct:
        return "declined"
    return "unchanged"


def derive_trend(attempts: list[dict[str, Any]]) -> str:
    """`score_trend` 读时派生（D9 C1 退列后仍按原字段名回传）：末次相对上一次的四分支。"""
    if not attempts:
        return "new"
    return resolve_trend(attempts[-2] if len(attempts) > 1 else None, bool(attempts[-1]["is_correct"]))


def public_question(row: dict[str, Any]) -> dict[str, Any]:
    """题面下发投影（缝 2）：剔除判分依据三列，其余原样回传。"""
    return {key: value for key, value in row.items() if key not in SENSITIVE_COLUMNS}


def build_question_row(
    item: dict[str, Any],
    *,
    course_id: str,
    gen_batch: str = "",
    model_ref: str = "",
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
    """对外行：JSON 列反解、布尔位转 bool、时间列转 ISO 字符串（两实现共用）。

    `qe_attempt.owner` 在此退掉（D7：只承载幂等键前缀与扩展位，契约面不收不回显）。
    """
    if row is None:
        return {}
    out = dict(row)
    out.pop("owner", None)
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


def task_view(
    question: dict[str, Any], state: dict[str, Any], now: datetime, wrong: bool
) -> dict[str, Any]:
    """到期队列行对外形状：由重放态即时派生（不落列，J5），题面由调用方投影后挂 `question`。"""
    due_at = state["due_at"]
    kp_type = state["kp_type"]
    return {
        "target_kind": "question",
        "target_id": question["question_id"],
        "course_id": question["course_id"],
        "kp_id": question.get("kp_id"),
        "kp_type": kp_type,
        "interval_index": int(state["interval_index"]),
        "due_at": due_at.isoformat() if isinstance(due_at, datetime) else due_at,
        "priority": WRONG_PRIORITY if wrong else TYPE_PRIORITY.get(
            str(kp_type or ""), TYPE_PRIORITY[DEFAULT_KP_TYPE]
        ),
        "reason": "wrong" if wrong else "type",
        "overdue_days": _overdue_days(due_at, now) if isinstance(due_at, datetime) else 0,
        "question": None,
    }


def is_unresolved(attempts: list[dict[str, Any]]) -> bool:
    """未解决错题（判例 DeepTutor `error_records` status=active）：末次判错且人工位未置。"""
    if not attempts:
        return False
    latest = attempts[-1]
    return not bool(latest["is_correct"]) and not bool(latest["resolved"])


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


def mistake_item(
    question: dict[str, Any], attempts: list[dict[str, Any]], state: dict[str, Any], now: datetime
) -> dict[str, Any]:
    """错题本一行（两实现共用）：`attempts` 按事实序升序，行内取末次、计数与派生态。"""
    latest = attempts[-1]
    return {
        "question": _serialize(question),
        "last_attempt": _serialize(latest),
        "attempt_count": len(attempts),
        "wrong_count": sum(1 for a in attempts if not bool(a["is_correct"])),
        "is_correct": bool(latest["is_correct"]),
        "resolved": bool(latest["resolved"]),
        "bookmarked": any(bool(a["bookmarked"]) for a in attempts),
        "score_trend": derive_trend(attempts),
        "due_today": state["due_at"] <= now,
    }


def replay_rows(
    questions: list[dict[str, Any]], attempts_by_question: dict[str, list[dict[str, Any]]], now: datetime
) -> list[tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]]:
    """题行 × 流水 → `(题行, 事实序流水, 重放态)`（两实现共用的取数装配）。"""
    return [
        (
            question,
            attempts_by_question.get(str(question["question_id"]), []),
            replay_due(
                question, attempts_by_question.get(str(question["question_id"]), []), now
            ),
        )
        for question in questions
    ]


class MySQLPracticeStore:
    """练习域两表 MySQL 存储（qed 库；判分同事务，缝 6；调度态读时重放，ADR 0026 D3）。"""

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
                        now=stamp,
                    )
                    cursor.execute(
                        "SELECT question_id FROM qe_question WHERE course_id=%s AND stem_hash=%s",
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
                        f"INSERT INTO qe_question ({columns}) VALUES ({placeholders})", values
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
            f"SELECT {_QUESTION_COLUMNS} FROM qe_question WHERE question_id=%s", (question_id,)
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
                cursor.execute(f"SELECT COUNT(*) AS n FROM qe_question {clause}", params)
                total = int(cursor.fetchone()["n"])
                cursor.execute(
                    f"SELECT {_QUESTION_COLUMNS} FROM qe_question {clause} "
                    "ORDER BY created_at, question_id LIMIT %s OFFSET %s",
                    [*params, limit, offset],
                )
                rows = cursor.fetchall()
        return [_serialize(row) for row in rows], total

    def patch_question(self, question_id: str, **fields: Any) -> dict[str, Any]:
        """人工面白名单改列；`gen_batch`/`model_ref`/`stem_hash` 等产出事实不可改（API 面拦）。

        `retired` 即软删位，队列与错题本读时按 `retired=0` 过滤，不再有调度态同步（D3）。
        """
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
                    f"UPDATE qe_question SET {', '.join(sets)} WHERE question_id=%s", params
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
        owner: str = DEFAULT_OWNER,
    ) -> dict[str, Any]:
        """同事务：判分 + 作答行落库（缝 6）；`review` 段与 `score_trend` 都是流水读时派生。

        机器不写 `resolved`/`bookmarked`（R6 纯人工位）；到期档位不落列，重放见 `replay_due`。
        """
        stamp = _as_naive(now) or _now()
        review_when = _as_naive(review_date)
        conn = self._connect()
        try:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_QUESTION_COLUMNS} FROM qe_question WHERE question_id=%s FOR UPDATE",
                    (question_id,),
                )
                question = cursor.fetchone()
                if question is None or bool(question["retired"]):
                    raise LearnNotFound(f"题目不存在：{question_id}")
                question = dict(question)
                if review_when is not None:
                    cursor.execute(
                        "SELECT attempt_id FROM qe_attempt "
                        "WHERE owner=%s AND question_id=%s AND origin=%s AND review_date=%s",
                        (owner, question_id, origin, review_when),
                    )
                    if cursor.fetchone():
                        raise LearnConflict(
                            f"同一题在同期望复习日（{origin} / {review_when}）已作答，不重复计"
                        )
                if question["kind"] == "flashcard":
                    correct = self_result == "correct"
                    verdict = {"is_correct": correct, "method": "self", "note": "自评记忆卡"}
                else:
                    verdict = grade(question, user_answer)
                    correct = bool(verdict["is_correct"])
                cursor.execute(
                    "INSERT INTO qe_attempt "
                    "(owner, question_id, course_id, kp_id, origin, review_date, user_answer, "
                    " is_correct, method, judge_note, resolved, bookmarked, answered_at) "
                    "VALUES (%(owner)s, %(question_id)s, %(course_id)s, %(kp_id)s, %(origin)s, "
                    " %(review_date)s, %(user_answer)s, %(is_correct)s, %(method)s, %(judge_note)s, "
                    " 0, 0, %(answered_at)s)",
                    {
                        "owner": owner,
                        "question_id": question_id,
                        "course_id": question["course_id"],
                        "kp_id": question["kp_id"],
                        "origin": origin,
                        "review_date": review_when,
                        "user_answer": user_answer,
                        "is_correct": int(correct),
                        "method": verdict["method"],
                        "judge_note": verdict["note"][:1000],
                        "answered_at": stamp,
                    },
                )
                if verdict["note"] == ISSUE_MISSING_EXPECTED:
                    question = _record_issue(question, ISSUE_MISSING_EXPECTED)
                    cursor.execute(
                        "UPDATE qe_question SET meta=%s, updated_at=%s WHERE question_id=%s",
                        (_to_json(question["meta"]), stamp, question_id),
                    )
                attempts = self._attempts(cursor, [question_id], owner)[question_id]
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        state = replay_due(question, attempts, stamp)
        revealed = question["kind"] != "flashcard"
        return {
            "attempt": {**_serialize(attempts[-1]), "score_trend": derive_trend(attempts)},
            "grade": verdict,
            "review": {
                "target_kind": "question",
                "target_id": question_id,
                "kp_type": state["kp_type"],
                "interval_index": state["interval_index"],
                "due_at": state["due_at"].isoformat(),
                "next_due_at": state["due_at"].isoformat(),
            },
            "expected_answer": (question.get("expected_answer") or None) if revealed else None,
            "explanation": (question.get("explanation") or None) if revealed else None,
        }

    def _attempts(
        self, cursor: Any, question_ids: list[str], owner: str
    ) -> dict[str, list[dict[str, Any]]]:
        """按题归集的作答流水（事实序升序）；空集不发 SQL。"""
        grouped: dict[str, list[dict[str, Any]]] = {qid: [] for qid in question_ids}
        if not question_ids:
            return grouped
        marks = ", ".join(["%s"] * len(question_ids))
        cursor.execute(
            f"SELECT {_ATTEMPT_COLUMNS} FROM qe_attempt "
            f"WHERE owner=%s AND question_id IN ({marks}) "
            "ORDER BY question_id, answered_at, attempt_id",
            [owner, *question_ids],
        )
        for row in cursor.fetchall():
            grouped[str(row["question_id"])].append(dict(row))
        return grouped

    def get_attempt(self, attempt_id: int, *, owner: str = DEFAULT_OWNER) -> dict[str, Any]:
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_ATTEMPT_COLUMNS} FROM qe_attempt WHERE attempt_id=%s AND owner=%s",
                    (attempt_id, owner),
                )
                row = cursor.fetchone()
        if row is None:
            raise LearnNotFound(f"作答记录不存在：{attempt_id}")
        return _serialize(row)

    def patch_attempt(
        self, attempt_id: int, *, owner: str = DEFAULT_OWNER, **fields: Any
    ) -> dict[str, Any]:
        """错题本人工位（bookmarked/resolved）；判分结果列不在白名单（API 面拦）。"""
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT attempt_id FROM qe_attempt WHERE attempt_id=%s AND owner=%s FOR UPDATE",
                    (attempt_id, owner),
                )
                if cursor.fetchone() is None:
                    raise LearnNotFound(f"作答记录不存在：{attempt_id}")
                sets: list[str] = []
                params: list[Any] = []
                for key, value in fields.items():
                    sets.append(f"{key}=%s")
                    params.append(int(bool(value)))
                params.append(attempt_id)
                cursor.execute(f"UPDATE qe_attempt SET {', '.join(sets)} WHERE attempt_id=%s", params)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return self.get_attempt(attempt_id, owner=owner)

    def attempts_by_kp(
        self, course_id: str, *, owner: str = DEFAULT_OWNER
    ) -> dict[str, list[bool]]:
        """主链 M-3 门的输入面：按知识点取近因作答序列（全序，时序＝`answered_at` 升序、同刻按行 ID）。

        `kp_id` 为 NULL 的未归档题不进门；最近 5 次窗口与置信上限钳制归规则层
        `services/learn/mastery.py`，本方法只给事实序，不做任何折算。
        """
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT kp_id, is_correct FROM qe_attempt "
                    "WHERE owner=%s AND course_id=%s AND kp_id IS NOT NULL "
                    "ORDER BY kp_id, answered_at, attempt_id",
                    (owner, course_id),
                )
                rows = cursor.fetchall()
        sequences: dict[str, list[bool]] = {}
        for row in rows:
            sequences.setdefault(str(row["kp_id"]), []).append(bool(row["is_correct"]))
        return sequences

    # ---------- 到期队列与错题本（流水重放，不建表） ----------

    def _replay(
        self, course_id: str | None, owner: str, now: datetime
    ) -> list[tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]]:
        where = ["retired=0"]
        params: list[Any] = []
        if course_id:
            where.append("course_id=%s")
            params.append(course_id)
        with self._connect() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    f"SELECT {_QUESTION_COLUMNS} FROM qe_question "
                    f"WHERE {' AND '.join(where)} ORDER BY created_at, question_id",
                    params,
                )
                questions = [dict(row) for row in cursor.fetchall()]
                grouped = self._attempts(cursor, [q["question_id"] for q in questions], owner)
        return replay_rows(questions, grouped, now)

    def review_due(
        self,
        course_id: str | None = None,
        max_tasks: int = DEFAULT_MAX_TASKS,
        now: datetime | None = None,
        *,
        owner: str = DEFAULT_OWNER,
    ) -> list[dict[str, Any]]:
        when = _as_naive(now) or _now()
        scored = [
            (task_view(question, state, when, is_unresolved(attempts)), question)
            for question, attempts, state in self._replay(course_id, owner, when)
            if state["due_at"] <= when
        ]
        scored.sort(key=lambda pair: (pair[0]["priority"], pair[0]["due_at"], pair[0]["target_id"]))
        out = []
        for task, question in scored[:max_tasks]:
            task["question"] = _serialize(question)
            out.append(task)
        return out

    def count_review_due(
        self, course_id: str | None = None, now: datetime | None = None, *,
        owner: str = DEFAULT_OWNER,
    ) -> int:
        """`total_due`＝截断前的全量到期数，与 `review_due` 同一次重放口径。"""
        when = _as_naive(now) or _now()
        return sum(1 for _q, _a, state in self._replay(course_id, owner, when) if state["due_at"] <= when)

    def due_counts_by_kp(
        self, course_id: str, now: datetime | None = None, *, owner: str = DEFAULT_OWNER
    ) -> dict[str, int]:
        """门游标的复习腿：到期题行按所属知识点归集（`target_kind='kp'` 腿随调度表退出）。

        到期口径与 `review_due` 同源；未归档题（`kp_id` IS NULL）不进任何门（裁决 D-M3-4）。
        """
        when = _as_naive(now) or _now()
        counts: dict[str, int] = {}
        for question, _attempts, state in self._replay(course_id, owner, when):
            if state["due_at"] > when or not question["kp_id"]:
                continue
            counts[str(question["kp_id"])] = counts.get(str(question["kp_id"]), 0) + 1
        return counts

    def _mistake_rows(
        self,
        *,
        course_id: str | None,
        kp_id: str | None,
        book_ref: str | None,
        now: datetime,
        owner: str,
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for question, attempts, state in self._replay(course_id, owner, now):
            if kp_id and question["kp_id"] != kp_id:
                continue
            if book_ref and question["book_ref"] != book_ref:
                continue
            if not attempts or all(bool(a["is_correct"]) for a in attempts):
                continue
            items.append(mistake_item(question, attempts, state, now))
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
        owner: str = DEFAULT_OWNER,
    ) -> tuple[list[dict[str, Any]], int]:
        items = filter_mistakes(
            self._mistake_rows(
                course_id=course_id, kp_id=kp_id, book_ref=book_ref,
                now=_as_naive(now) or _now(), owner=owner,
            ),
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
        owner: str = DEFAULT_OWNER,
    ) -> dict[str, Any]:
        when = _as_naive(now) or _now()
        replay = self._replay(course_id, owner, when)
        scoped = [
            (question, attempts, state)
            for question, attempts, state in replay
            if (not kp_id or question["kp_id"] == kp_id)
            and (not book_ref or question["book_ref"] == book_ref)
        ]
        rows = [
            mistake_item(question, attempts, state, when)
            for question, attempts, state in scoped
            if attempts and not all(bool(a["is_correct"]) for a in attempts)
        ]
        return {
            "total": len(scoped),
            "wrong": len({row["question"]["question_id"] for row in rows}),
            "unresolved": sum(1 for row in rows if not row["resolved"]),
            "bookmarked": sum(1 for row in rows if row["bookmarked"]),
            "due_today": sum(1 for _q, _a, state in scoped if state["due_at"] <= when),
        }


def ensure_tables(settings: Settings) -> None:
    """幂等建两表（判例 qe_*）；数据库不可达抛异常由调用方降级。"""
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
    "build_question_row",
    "build_store",
    "derive_trend",
    "ensure_tables",
    "filter_mistakes",
    "grade",
    "interval_sequence",
    "is_unresolved",
    "mistake_item",
    "public_question",
    "replay_due",
    "replay_rows",
    "resolve_trend",
    "schedule_next",
    "seed_state",
    "stem_hash",
    "task_view",
]
