"""练习域三表存储的内存实现（M2）：契约测试注入 + 数据库未接入期降级。

模块职责：InMemoryPracticeStore——题库批量入库（`stem_hash` 幂等跳重、整批原子）、
作答的事务语义内存等价（先整批构造再落，被拒绝的作答不留痕）、间隔复习双粒度调度态
（`(target_kind, target_id)` 一行）与到期队列、错题本派生查询与统计的进程内实现，
接口与 MySQLPracticeStore 同形（公开方法由 parity 测试守护）。
隔离铁律：默认测试走本类，不写运行数据库；时钟由参数注入（`now=`），不读 `time.time()`。
设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
关联测试：tests/test_learn_practice.py
"""

from __future__ import annotations

import threading
from datetime import datetime
from typing import Any

from qed_engine.services.learn.base import LearnConflict, LearnNotFound
from qed_engine.services.learn.grading import ISSUE_MISSING_EXPECTED, grade
from qed_engine.services.learn.practice import (
    DEFAULT_KP_TYPE,
    DEFAULT_MAX_TASKS,
    _as_naive,
    _now,
    _record_issue,
    _serialize,
    build_question_row,
    filter_mistakes,
    resolve_trend,
    schedule_next,
    stem_hash,
    task_view,
)


class InMemoryPracticeStore:
    """练习域三表的进程内存储（题/卡 + 作答事实 + 复习调度态）。"""

    def __init__(self) -> None:
        self._questions: dict[str, dict[str, Any]] = {}
        self._attempts: list[dict[str, Any]] = []
        self._review_tasks: dict[tuple[str, str], dict[str, Any]] = {}
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
        learn_course_id: str | None = None,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        """批量入库：先整批构造（一项非法即抛、整批不落＝缝 6 的内存等价），再逐行落库。"""
        stamp = now or _now()
        built = [
            build_question_row(
                item,
                course_id=course_id,
                gen_batch=gen_batch,
                model_ref=model_ref,
                learn_course_id=learn_course_id,
                now=stamp,
            )
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
                self._ensure_task("question", row["question_id"], course_id,
                                  row["kp_type"] or DEFAULT_KP_TYPE, stamp)
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
            if "retired" in fields:
                task = self._review_tasks.get(("question", question_id))
                if task is not None:
                    task["status"] = "archived" if bool(fields["retired"]) else "active"
                    task["updated_at"] = _now()
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
    ) -> dict[str, Any]:
        """判分 + 作答行 + 趋势/解决位 + 调度回写：任一步抛出即不留作答、不动调度态。"""
        stamp = now or _now()
        review_when = _as_naive(review_date)
        with self._lock:
            question = self._questions.get(question_id)
            if question is None or bool(question["retired"]):
                raise LearnNotFound(f"题目不存在：{question_id}")
            if review_when is not None and any(
                attempt["question_id"] == question_id
                and attempt["origin"] == origin
                and attempt["review_date"] == review_when
                for attempt in self._attempts
            ):
                raise LearnConflict(
                    f"同一题在同期望复习日（{origin} / {review_when.isoformat()}）已作答，不重复计"
                )
            previous = self._latest_attempt(question_id)
            if question["kind"] == "flashcard":
                correct = self_result == "correct"
                verdict = {"is_correct": correct, "method": "self", "note": "自评记忆卡"}
            else:
                verdict = grade(question, user_answer)
                correct = bool(verdict["is_correct"])
            trend, resolved = resolve_trend(previous, correct)
            self._attempt_seq += 1
            attempt = {
                "attempt_id": self._attempt_seq,
                "question_id": question_id,
                "course_id": question["course_id"],
                "kp_id": question["kp_id"],
                "origin": origin,
                "review_date": review_when,
                "user_answer": user_answer,
                "is_correct": correct,
                "method": verdict["method"],
                "judge_note": (verdict["note"] or "")[:1000],
                "score_trend": trend,
                "resolved": resolved,
                "bookmarked": False,
                "answered_at": stamp,
            }
            if verdict["note"] == ISSUE_MISSING_EXPECTED:
                self._questions[question_id] = _record_issue(dict(question), ISSUE_MISSING_EXPECTED)
                question = self._questions[question_id]
            self._attempts.append(attempt)
            kp_type = question["kp_type"] or DEFAULT_KP_TYPE
            self._ensure_task("question", question_id, question["course_id"], kp_type, stamp)
            review = self._write_back(question_id, question["course_id"], kp_type, correct, stamp)
            if question["kp_id"]:
                self._ensure_task("kp", question["kp_id"], question["course_id"], kp_type, stamp)
            revealed = question["kind"] != "flashcard"
            return {
                "attempt": _serialize(attempt),
                "grade": verdict,
                "review": review,
                "expected_answer": (question.get("expected_answer") or None) if revealed else None,
                "explanation": (question.get("explanation") or None) if revealed else None,
            }

    def _latest_attempt(self, question_id: str) -> dict[str, Any] | None:
        rows = [attempt for attempt in self._attempts if attempt["question_id"] == question_id]
        if not rows:
            return None
        return max(rows, key=lambda a: (a["answered_at"], a["attempt_id"]))

    def _write_back(
        self, question_id: str, course_id: str, kp_type: str, correct: bool, now: datetime
    ) -> dict[str, Any]:
        task = self._review_tasks[("question", question_id)]
        state = schedule_next(task, correct, now)
        task.update(state)
        task["updated_at"] = now
        return {
            "target_kind": "question",
            "target_id": question_id,
            "course_id": course_id,
            "kp_type": task["kp_type"],
            "interval_index": state["interval_index"],
            "due_at": state["due_at"].isoformat(),
            "next_due_at": state["due_at"].isoformat(),
        }

    def _ensure_task(
        self, target_kind: str, target_id: str, course_id: str, kp_type: str, now: datetime
    ) -> None:
        key = (target_kind, target_id)
        if key in self._review_tasks:
            return
        self._review_tasks[key] = {
            "target_kind": target_kind,
            "target_id": target_id,
            "course_id": course_id,
            "kp_type": kp_type,
            "interval_index": 0,
            "consecutive_correct": 0,
            "consecutive_wrong": 0,
            "due_at": now,
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }

    def get_attempt(self, attempt_id: int) -> dict[str, Any]:
        with self._lock:
            for attempt in self._attempts:
                if attempt["attempt_id"] == attempt_id:
                    return _serialize(attempt)
        raise LearnNotFound(f"作答记录不存在：{attempt_id}")

    def patch_attempt(self, attempt_id: int, **fields: Any) -> dict[str, Any]:
        """错题本人工位（bookmarked/resolved）；判分结果列不在白名单（API 面拦）。"""
        with self._lock:
            for attempt in self._attempts:
                if attempt["attempt_id"] == attempt_id:
                    attempt.update({key: bool(value) for key, value in fields.items()})
                    return _serialize(attempt)
        raise LearnNotFound(f"作答记录不存在：{attempt_id}")

    # ---------- 复习队列（纯函数调度 + 持久态） ----------

    def review_due(
        self,
        course_id: str | None = None,
        max_tasks: int = DEFAULT_MAX_TASKS,
        now: datetime | None = None,
    ) -> list[dict[str, Any]]:
        when = now or _now()
        with self._lock:
            wrong = self._wrong_targets(course_id)
            tasks = [
                task_view(task, when, task["target_id"] in wrong)
                for task in self._review_tasks.values()
                if task["status"] == "active"
                and task["due_at"] <= when
                and (not course_id or task["course_id"] == course_id)
            ]
            tasks.sort(key=lambda t: (t["priority"], t["due_at"], t["target_id"]))
            for task in tasks[:max_tasks]:
                if task["target_kind"] == "question":
                    row = self._questions.get(task["target_id"])
                    task["question"] = _serialize(row) if row else None
        return tasks[:max_tasks]

    def _wrong_targets(self, course_id: str | None) -> set[str]:
        """未解决错题（判例 DeepTutor `error_records` status=active）：最近一次作答判错的题与其 kp。"""
        unresolved: set[str] = set()
        for question in self._questions.values():
            if question["retired"] or (course_id and question["course_id"] != course_id):
                continue
            latest = self._latest_attempt(question["question_id"])
            if latest and not latest["is_correct"] and not latest["resolved"]:
                unresolved.add(question["question_id"])
                if question["kp_id"]:
                    unresolved.add(question["kp_id"])
        return unresolved

    def count_review_due(self, course_id: str | None = None, now: datetime | None = None) -> int:
        when = now or _now()
        with self._lock:
            return sum(
                1
                for task in self._review_tasks.values()
                if task["status"] == "active"
                and task["due_at"] <= when
                and (not course_id or task["course_id"] == course_id)
            )

    # ---------- 错题本（派生查询，不建表） ----------

    def _mistake_rows(
        self, *, course_id: str | None, kp_id: str | None, book_ref: str | None, now: datetime
    ) -> list[dict[str, Any]]:
        scope = (("course_id", course_id), ("kp_id", kp_id), ("book_ref", book_ref))
        with self._lock:
            items: list[dict[str, Any]] = []
            for question in self._questions.values():
                if question["retired"] or any(value and question[key] != value for key, value in scope):
                    continue
                attempts = [a for a in self._attempts if a["question_id"] == question["question_id"]]
                if not attempts:
                    continue
                attempts.sort(key=lambda a: (a["answered_at"], a["attempt_id"]), reverse=True)
                latest = attempts[0]
                if all(bool(a["is_correct"]) for a in attempts):
                    continue
                items.append(
                    {
                        "question": _serialize(question),
                        "last_attempt": _serialize(latest),
                        "attempt_count": len(attempts),
                        "wrong_count": sum(1 for a in attempts if not a["is_correct"]),
                        "is_correct": bool(latest["is_correct"]),
                        "resolved": bool(latest["resolved"]),
                        "bookmarked": any(bool(a["bookmarked"]) for a in attempts),
                        "score_trend": latest["score_trend"],
                        "due_today": self._is_due_today(question["question_id"], now),
                    }
                )
        items.sort(key=lambda item: item["question"]["created_at"])
        return items

    def _is_due_today(self, question_id: str, now: datetime) -> bool:
        task = self._review_tasks.get(("question", question_id))
        return bool(task and task["status"] == "active" and task["due_at"] <= now)

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
            self._mistake_rows(
                course_id=course_id, kp_id=kp_id, book_ref=book_ref, now=now or _now()
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
    ) -> dict[str, Any]:
        when = now or _now()
        scope = (("course_id", course_id), ("kp_id", kp_id), ("book_ref", book_ref))
        with self._lock:
            questions = [
                question
                for question in self._questions.values()
                if not question["retired"]
                and all(not value or question[key] == value for key, value in scope)
            ]
            due_today = sum(1 for question in questions
                            if self._is_due_today(question["question_id"], when))
        rows = self._mistake_rows(course_id=course_id, kp_id=kp_id, book_ref=book_ref, now=when)
        return {
            "total": len(questions),
            "wrong": len(rows),
            "unresolved": sum(1 for row in rows if not row["resolved"]),
            "bookmarked": sum(1 for row in rows if row["bookmarked"]),
            "due_today": due_today,
        }
