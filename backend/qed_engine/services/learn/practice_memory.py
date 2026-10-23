"""练习域两表存储的内存实现（M2）：契约测试注入 + 数据库未接入期降级。

模块职责：InMemoryPracticeStore——题库批量入库（`stem_hash` 幂等跳重、整批原子）、
作答的事务语义内存等价（先整批构造再落，被拒绝的作答不留痕）、到期态与趋势的
**读时流水重放**（`replay_due`，与 MySQL 实现共用同一纯函数）、错题本派生查询与统计的
进程内实现，接口与 MySQLPracticeStore 同形（公开方法由 parity 测试守护）。
调度表 `qe_review_task` 已随 ADR 0026 D3 退出，本类不再有第三份状态。
隔离铁律：默认测试走本类，不写运行数据库；时钟由参数注入（`now=`），不读 `time.time()`。
设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
关联测试：tests/test_learn_practice.py
"""

from __future__ import annotations

import threading
from datetime import datetime
from typing import Any

from qed_engine.services.learn.base import DEFAULT_OWNER, LearnConflict, LearnNotFound
from qed_engine.services.learn.grading import ISSUE_MISSING_EXPECTED, grade
from qed_engine.services.learn.practice import (
    DEFAULT_MAX_TASKS,
    _as_naive,
    _now,
    _record_issue,
    _serialize,
    build_question_row,
    derive_trend,
    filter_mistakes,
    is_unresolved,
    mistake_item,
    replay_due,
    replay_rows,
    stem_hash,
    task_view,
)


class InMemoryPracticeStore:
    """练习域两表的进程内存储（题/卡 + 作答事实；调度态读时重放）。"""

    def __init__(self) -> None:
        self._questions: dict[str, dict[str, Any]] = {}
        self._attempts: list[dict[str, Any]] = []
        self._attempt_seq = 0
        self._lock = threading.RLock()

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
        """批量入库：先整批构造（一项非法即抛、整批不落＝缝 6 的内存等价），再逐行落库。"""
        stamp = now or _now()
        built = [
            build_question_row(item, course_id=course_id, gen_batch=gen_batch,
                               model_ref=model_ref, now=stamp)
            for item in items
        ]
        created = 0
        skipped = 0
        rows: list[dict[str, Any]] = []
        with self._lock:
            seen: dict[str, str] = {}
            for row in built:
                hit = self._find_by_hash(row["course_id"], row["stem_hash"]) or seen.get(
                    row["stem_hash"]
                )
                if hit is not None:
                    skipped += 1
                    rows.append(_serialize(self._questions[hit]))
                    continue
                self._questions[row["question_id"]] = row
                seen[row["stem_hash"]] = row["question_id"]
                created += 1
                rows.append(_serialize(row))
        return {
            "created": created,
            "skipped_duplicates": skipped,
            "questions": rows,
            "gen_batch": gen_batch,
            "model_ref": model_ref,
        }

    def _find_by_hash(self, course_id: str, digest: str, *, exclude: str = "") -> str | None:
        for question in self._questions.values():
            if (
                question["course_id"] == course_id
                and question["stem_hash"] == digest
                and question["question_id"] != exclude
            ):
                return str(question["question_id"])
        return None

    def get_question(self, question_id: str) -> dict[str, Any]:
        with self._lock:
            row = self._questions.get(question_id)
            serialized = _serialize(row) if row else None
        if serialized is None:
            raise LearnNotFound(f"题目不存在：{question_id}")
        return serialized

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
        filters = {
            "course_id": course_id,
            "kp_id": kp_id,
            "kind": kind,
            "question_type": question_type,
            "source_kind": source_kind,
            "book_ref": book_ref,
        }
        with self._lock:
            rows = [
                _serialize(row)
                for row in self._questions.values()
                if all(not value or row[key] == value for key, value in filters.items())
                and (
                    retired == "all"
                    or (retired == "only" and bool(row["retired"]))
                    or (retired == "active" and not bool(row["retired"]))
                )
            ]
        rows.sort(key=lambda r: (r["created_at"], r["question_id"]))
        return rows[offset : offset + limit], len(rows)

    def patch_question(self, question_id: str, **fields: Any) -> dict[str, Any]:
        """人工面白名单改列（闭集与不变式在 API 面校验）；改题干重算去重键，撞库 409。"""
        with self._lock:
            row = self._questions.get(question_id)
            if row is None:
                raise LearnNotFound(f"题目不存在：{question_id}")
            if "stem" in fields:
                digest = stem_hash(fields["stem"] or "")
                clash = self._find_by_hash(row["course_id"], digest, exclude=question_id)
                if clash:
                    raise LearnConflict(f"题干与既有题目重复（{clash}），改题干前先合并")
            updated = {**row, **fields}
            if "stem" in fields:
                updated["stem_hash"] = stem_hash(fields["stem"] or "")
            updated["updated_at"] = _now()
            self._questions[question_id] = updated
            return _serialize(updated)

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
        """判分 + 作答行落库：任一步抛出即不留作答（缝 6 的内存等价）；`review` 与趋势读时派生。"""
        stamp = now or _now()
        review_when = _as_naive(review_date)
        with self._lock:
            question = self._questions.get(question_id)
            if question is None or bool(question["retired"]):
                raise LearnNotFound(f"题目不存在：{question_id}")
            if review_when is not None and any(
                attempt["owner"] == owner
                and attempt["question_id"] == question_id
                and attempt["origin"] == origin
                and attempt["review_date"] == review_when
                for attempt in self._attempts
            ):
                raise LearnConflict(
                    f"同一题在同期望复习日（{origin} / {review_when.isoformat()}）已作答，不重复计"
                )
            if question["kind"] == "flashcard":
                correct = self_result == "correct"
                verdict = {"is_correct": correct, "method": "self", "note": "自评记忆卡"}
            else:
                verdict = grade(question, user_answer)
                correct = bool(verdict["is_correct"])
            if verdict["note"] == ISSUE_MISSING_EXPECTED:
                self._questions[question_id] = _record_issue(dict(question), ISSUE_MISSING_EXPECTED)
                question = self._questions[question_id]
            self._attempt_seq += 1
            attempt = {
                "attempt_id": self._attempt_seq,
                "owner": owner,
                "question_id": question_id,
                "course_id": question["course_id"],
                "kp_id": question["kp_id"],
                "origin": origin,
                "review_date": review_when,
                "user_answer": user_answer,
                "is_correct": correct,
                "method": verdict["method"],
                "judge_note": (verdict["note"] or "")[:1000],
                "resolved": False,
                "bookmarked": False,
                "answered_at": stamp,
            }
            self._attempts.append(attempt)
            attempts = self._attempt_stream(question_id, owner)
            state = replay_due(question, attempts, stamp)
            revealed = question["kind"] != "flashcard"
            return {
                "attempt": {**_serialize(attempt), "score_trend": derive_trend(attempts)},
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

    def _attempt_stream(self, question_id: str, owner: str) -> list[dict[str, Any]]:
        """单题流水（事实序升序）。"""
        return sorted(
            (
                attempt
                for attempt in self._attempts
                if attempt["question_id"] == question_id and attempt["owner"] == owner
            ),
            key=lambda a: (a["answered_at"], a["attempt_id"]),
        )

    def get_attempt(self, attempt_id: int, *, owner: str = DEFAULT_OWNER) -> dict[str, Any]:
        with self._lock:
            for attempt in self._attempts:
                if attempt["attempt_id"] == attempt_id and attempt["owner"] == owner:
                    return _serialize(attempt)
        raise LearnNotFound(f"作答记录不存在：{attempt_id}")

    def patch_attempt(
        self, attempt_id: int, *, owner: str = DEFAULT_OWNER, **fields: Any
    ) -> dict[str, Any]:
        """错题本人工位（bookmarked/resolved）；判分结果列不在白名单（API 面拦）。"""
        with self._lock:
            for attempt in self._attempts:
                if attempt["attempt_id"] == attempt_id and attempt["owner"] == owner:
                    attempt.update({key: bool(value) for key, value in fields.items()})
                    return _serialize(attempt)
        raise LearnNotFound(f"作答记录不存在：{attempt_id}")

    # ---------- 到期队列与错题本（流水重放） ----------

    def attempts_by_kp(
        self, course_id: str, *, owner: str = DEFAULT_OWNER
    ) -> dict[str, list[bool]]:
        """与 MySQL 存储同语义的门输入面：全序事实，`kp_id` 空的未归档题不进门。"""
        with self._lock:
            rows = sorted(
                (
                    attempt
                    for attempt in self._attempts
                    if attempt["owner"] == owner
                    and attempt["course_id"] == course_id
                    and attempt["kp_id"]
                ),
                key=lambda attempt: (str(attempt["kp_id"]), attempt["answered_at"], attempt["attempt_id"]),
            )
        sequences: dict[str, list[bool]] = {}
        for attempt in rows:
            sequences.setdefault(str(attempt["kp_id"]), []).append(bool(attempt["is_correct"]))
        return sequences

    def _replay(
        self, course_id: str | None, owner: str, now: datetime
    ) -> list[tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]]:
        """未软删题行 × 流水 → 重放态（队列、计数、到期档位与错题本共用一次装配）。"""
        with self._lock:
            questions = sorted(
                (
                    dict(question)
                    for question in self._questions.values()
                    if not question["retired"] and (not course_id or question["course_id"] == course_id)
                ),
                key=lambda q: (str(q["created_at"]), q["question_id"]),
            )
            grouped: dict[str, list[dict[str, Any]]] = {}
            for attempt in sorted(self._attempts, key=lambda a: (a["answered_at"], a["attempt_id"])):
                if attempt["owner"] != owner:
                    continue
                grouped.setdefault(str(attempt["question_id"]), []).append(dict(attempt))
        return replay_rows(questions, grouped, now)

    def review_due(
        self,
        course_id: str | None = None,
        max_tasks: int = DEFAULT_MAX_TASKS,
        now: datetime | None = None,
        *,
        owner: str = DEFAULT_OWNER,
    ) -> list[dict[str, Any]]:
        when = now or _now()
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
        when = now or _now()
        return sum(1 for _q, _a, state in self._replay(course_id, owner, when) if state["due_at"] <= when)

    def due_counts_by_kp(
        self, course_id: str, now: datetime | None = None, *, owner: str = DEFAULT_OWNER
    ) -> dict[str, int]:
        """与 MySQL 存储同语义的复习腿：到期题行按所属知识点归集，未归档题不计。"""
        when = now or _now()
        counts: dict[str, int] = {}
        for question, _attempts, state in self._replay(course_id, owner, when):
            if state["due_at"] > when or not question["kp_id"]:
                continue
            kp_id = str(question["kp_id"])
            counts[kp_id] = counts.get(kp_id, 0) + 1
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
            if (kp_id and question["kp_id"] != kp_id) or (book_ref and question["book_ref"] != book_ref):
                continue
            if not attempts or all(bool(a["is_correct"]) for a in attempts):
                continue
            items.append(mistake_item(question, attempts, state, now))
        items.sort(key=lambda item: item["question"]["created_at"])
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
                now=now or _now(), owner=owner,
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
        when = now or _now()
        scoped = [
            (question, attempts, state)
            for question, attempts, state in self._replay(course_id, owner, when)
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
