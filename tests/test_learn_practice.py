"""学习域·练习与复习（M2）契约测试：三表语义 + 8 端点 + 404/409/422/503 清单 + 调度纯函数。

模块职责：守护 M2 壳 2026-10-03 冻结的练习域契约——题库批量入库（`stem_hash` 幂等跳重、
`answer_source=none` 强制 flashcard 即裁决 ⑨）、题面下发响应的敏感列投影（缝 2）、
人工面白名单与 ⑨ 的升级路径、作答同事务判分与 `score_trend/resolved`（缝 6）、
间隔复习双粒度调度（`schedule_next` 升降档/钳位、错题 priority=1、到期队列投影）、
主链 M-3 门的两张读入面（`attempts_by_kp` 全序作答序列、`due_counts_by_kp` 按知识点到期计数）、
错题本派生查询与统计、题源书目 `roles` 过滤；内存 store 承载，不写运行数据库。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/api/learn.py、backend/qed_engine/services/learn/practice.py
失效后果：M2 练习面按错误形状联调，判分依据随题面泄露，复习节律与错题事实漂移
"""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.services.learn import InMemoryKnowledgeStore, InMemoryPracticeStore
from qed_engine.services.learn.knowledge import norm_key
from qed_engine.services.learn.practice import schedule_next, stem_hash

DEMO_DOMAINS = [
    {
        "domain_id": "math-advanced",
        "name": "数学（高等数学）",
        "classic_tracks": [{"kind": "main", "name": "分析学", "summary": "极限与连续"}],
        "courses": [
            {
                "course_id": "math_analysis",
                "name": "数学分析",
                "track": "分析学",
                "stage": "基础",
                "prerequisites": [],
                "sort_order": 1,
            },
        ],
    }
]

DEMO_QT_BOOKS = [
    {"book_id": "mathanalysis-b05", "title": "数学分析教程", "roles": ["textbook"], "course_id": ""},
    {"book_id": "mathanalysis-b07", "title": "吉米多维奇习题集", "roles": ["exercises"], "course_id": ""},
    {"book_id": "mathanalysis-b11", "title": "吉米多维奇题解", "roles": ["solutions"], "course_id": ""},
    {"book_id": "mathanalysis-b99", "title": "无关期刊", "roles": [], "course_id": ""},
    {"book_id": "probability-b01", "title": "概率导论", "roles": ["textbook"], "course_id": ""},
]


def _tracker_books(self, *, course_id=None, **_kwargs):
    """镜像 8901 `/books` 的 `course_id` 过滤，并复刻现网事实：**书库行该列全空**（2026-10-07 真机核验）。

    ⇒ 透传过滤必然返回空表，课程归属只能在 8900 侧按解析表（af_books）兜底（回归锁）。
    """
    rows = list(DEMO_QT_BOOKS)
    if course_id:
        rows = [row for row in rows if row["course_id"] == course_id]
    return rows


SENSITIVE = ("expected_answer", "keywords", "explanation")


@pytest.fixture(autouse=True)
def _mock_startup_probes(monkeypatch):
    """隔离铁律：测试不触真实网络/MySQL（判例 test_learn._mock_startup_probes）。"""
    from qed_engine.api import control as api_control
    from qed_engine.services.llm import call_log as llm_call_log

    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(llm_call_log, "ensure_table", lambda settings: None)
    monkeypatch.setattr(llm_call_log, "ensure_comments", lambda settings: None)


@pytest.fixture()
def store():
    return InMemoryPracticeStore()


@pytest.fixture()
def client(monkeypatch, store):
    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_HOST", "127.0.0.1")
    monkeypatch.setenv("QED_DB_PORT", "3306")
    monkeypatch.setenv("QED_DB_NAME", "qed_test")
    monkeypatch.setenv("QED_DB_USER", "root")
    monkeypatch.setenv("QED_DB_PASSWORD", "")
    from qed_engine.clients import axiom_client, tracker_client

    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", lambda self: DEMO_DOMAINS)
    monkeypatch.setattr(tracker_client.TrackerClient, "list_books", _tracker_books)
    monkeypatch.setattr(
        axiom_client.AxiomClient,
        "list_books",
        lambda self: [
            {"book_id": "mathanalysis-b05", "course_id": "math_analysis", "parse_status": "pending",
             "last_parse_result": "completed", "pages_done": 317, "page_count": 317},
            {"book_id": "mathanalysis-b07", "course_id": "math_analysis", "parse_status": "pending",
             "last_parse_result": "", "pages_done": 0, "page_count": 439},
            {"book_id": "mathanalysis-b11", "course_id": "math_analysis", "parse_status": "pending",
             "last_parse_result": "", "pages_done": 0, "page_count": 0},
            {"book_id": "probability-b01", "course_id": "probability", "parse_status": "pending",
             "last_parse_result": "completed", "pages_done": 120, "page_count": 456},
        ],
    )
    return TestClient(create_app(practice_store=store, knowledge_store=InMemoryKnowledgeStore()))


def _choice(**overrides):
    body = {
        "stem": "求极限 lim(x→0) sin x / x 的值。",
        "kind": "quiz",
        "question_type": "choice",
        "options": [
            {"label": "A", "body": "$0$"},
            {"label": "B", "body": "$1$"},
            {"label": "C", "body": "$\\infty$"},
            {"label": "D", "body": "不存在"},
        ],
        "expected_answer": "B",
        "explanation": "重要极限，答案为 B。",
        "difficulty": "easy",
        "source_kind": "exercise_book",
        "book_ref": "mathanalysis-b07",
        "source_ref": {"page": 12, "block_indexes": [3, 4]},
        "answer_source": "same_page",
    }
    body.update(overrides)
    return body


def _flashcard(**overrides):
    body = {
        "stem": "叙述确界原理。",
        "kind": "flashcard",
        "answer_back": "非空数集若有上界则必有上确界。",
        "difficulty": "medium",
        "source_kind": "textbook_chapter",
        "book_ref": "mathanalysis-b05",
        "source_ref": {"page": 7},
        "answer_source": "none",
    }
    body.update(overrides)
    return body


def _item(**overrides):
    """store 层入库项（不经 pydantic 校验，用于构造 API 面拒绝不了的形态）。"""
    body = {
        "stem": "store 层题面。",
        "kind": "quiz",
        "question_type": "short",
        "expected_answer": "A",
        "difficulty": "easy",
        "source_kind": "manual",
        "answer_source": "manual",
    }
    body.update(overrides)
    return body


def _post(client, questions, **overrides):
    body = {"course_id": "math_analysis", "gen_batch": "extract-001", "model_ref": "extract",
            "questions": questions}
    body.update(overrides)
    return client.post("/api/v1/learn/questions", json=body)


def _list(client, **params):
    response = client.get("/api/v1/learn/questions", params=params)
    assert response.status_code == 200, response.text
    return response.json()["questions"]


def _first_id(client, **params):
    return _list(client, **params)[0]["question_id"]


def _answer(client, question_id, user_answer, **extra):
    return client.post("/api/v1/learn/attempts",
                       json={"question_id": question_id, "user_answer": user_answer, **extra})


# ---------- 题库入库（POST /learn/questions） ----------


def test_add_questions_creates_rows_and_question_review_tasks(client, store):
    response = _post(client, [_choice(), _flashcard()])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == 2 and body["skipped_duplicates"] == 0
    assert body["gen_batch"] == "extract-001" and body["model_ref"] == "extract"
    rows = store.list_questions(course_id="math_analysis")[0]
    assert {row["kind"] for row in rows} == {"quiz", "flashcard"}
    tasks = store.review_due("math_analysis", max_tasks=10)
    assert {task["target_id"] for task in tasks} == {row["question_id"] for row in rows}
    assert all(task["target_kind"] == "question" for task in tasks)


def test_duplicate_stem_is_skipped_by_normalised_hash(client):
    assert _post(client, [_choice()]).json()["created"] == 1
    variant = _choice(stem="求极限  lim(x→0) SIN X / X 的值。")
    second = _post(client, [variant])
    assert second.status_code == 200, second.text
    assert second.json()["created"] == 0 and second.json()["skipped_duplicates"] == 1
    assert stem_hash(variant["stem"]) == stem_hash(_choice()["stem"])
    assert norm_key(variant["stem"]) == norm_key(_choice()["stem"])
    assert _post(client, [_choice(stem="第七题：求导数。")]).json()["created"] == 1


def test_batch_reports_created_and_skipped_together(client):
    _post(client, [_choice()])
    body = _post(client, [_choice(), _flashcard()]).json()
    assert body["created"] == 1 and body["skipped_duplicates"] == 1
    assert len(body["questions"]) == 2


def test_quiz_without_expected_answer_is_422(client):
    body = _choice()
    body.pop("expected_answer")
    assert _post(client, [body]).status_code == 422
    assert _post(client, [_choice(expected_answer="   ")]).status_code == 422


def test_answer_source_none_rejects_quiz_and_forces_flashcard(client):
    """裁决 ⑨：无答案题不阻塞入库，但只能作 flashcard 自评。"""
    assert _post(client, [_choice(expected_answer=None, answer_source="none")]).status_code == 422
    ok = _post(client, [_choice(kind="flashcard", question_type=None, options=None,
                                expected_answer=None, answer_back="重要极限。", answer_source="none")])
    assert ok.status_code == 200, ok.text
    assert ok.json()["questions"][0]["kind"] == "flashcard"


def test_closed_set_and_structure_validation(client):
    assert _post(client, [_choice(kind="essay")]).status_code == 422
    assert _post(client, [_choice(question_type="fill_in_blank")]).status_code == 422
    assert _post(client, [_choice(source_kind="web")]).status_code == 422
    assert _post(client, [_choice(answer_source="guess")]).status_code == 422
    assert _post(client, [_choice(difficulty="extreme")]).status_code == 422
    assert _post(client, [_choice(stem="   ")]).status_code == 422
    assert _post(client, []).status_code == 422
    assert _post(client, [_choice()]).status_code == 200


def test_choice_options_must_be_exactly_abcd(client):
    broken = _choice(options=[{"label": "A", "body": "1"}, {"label": "B", "body": "2"},
                              {"label": "C", "body": "3"}, {"label": "E", "body": "4"}])
    assert _post(client, [broken]).status_code == 422
    short = _choice(options=[{"label": "A", "body": "1"}, {"label": "B", "body": "2"}])
    assert _post(client, [short]).status_code == 422
    duplicate = _choice(options=[{"label": "A", "body": "1"}, {"label": "A", "body": "2"},
                                 {"label": "C", "body": "3"}, {"label": "D", "body": "4"}])
    assert _post(client, [duplicate]).status_code == 422


def test_open_type_requires_keywords(client):
    assert _post(client, [_choice(question_type="open", keywords=None)]).status_code == 422
    assert _post(client, [_choice(question_type="open", keywords=[])]).status_code == 422
    ok = _post(client, [_choice(question_type="open", keywords=["连续", "可导"])])
    assert ok.status_code == 200, ok.text


# ---------- 敏感列投影（缝 2） ----------


def test_read_and_write_responses_strip_sensitive_columns(client):
    created = _post(client, [_choice()])
    assert all(key not in created.json()["questions"][0] for key in SENSITIVE)
    row = _list(client, course="math_analysis")[0]
    assert all(key not in row for key in SENSITIVE)
    assert {"stem", "kind", "question_type", "options", "difficulty", "kp_type", "book_ref",
            "answer_source", "gen_batch", "retired", "source_ref", "meta"} <= set(row)
    due = client.get("/api/v1/learn/review/due", params={"course": "math_analysis"}).json()
    assert all(key not in due["tasks"][0]["question"] for key in SENSITIVE)
    _answer(client, row["question_id"], "C")
    mistakes = client.get("/api/v1/learn/mistakes", params={"course": "math_analysis"}).json()
    for item in mistakes["items"]:
        assert all(key not in item["question"] for key in SENSITIVE)
        assert "expected_answer" not in item["last_attempt"]


def test_list_questions_filters_and_paging(client):
    _post(client, [_choice(kp_id="kp-a", kp_type="concept"), _flashcard(kp_id="kp-b")])
    assert len(_list(client, kind="quiz")) == 1
    assert len(_list(client, kp="kp-a")) == 1
    assert len(_list(client, book="mathanalysis-b05")) == 1
    assert len(_list(client, source_kind="textbook_chapter")) == 1
    assert len(_list(client, question_type="choice")) == 1
    page = client.get("/api/v1/learn/questions", params={"limit": 1})
    assert page.status_code == 200 and len(page.json()["questions"]) == 1
    assert page.json()["total"] == 2
    assert client.get("/api/v1/learn/questions", params={"kind": "essay"}).status_code == 422
    assert client.get("/api/v1/learn/questions", params={"limit": 5000}).status_code == 422


# ---------- 人工面 PATCH /learn/questions/{id} ----------


def test_patch_question_whitelist_rejects_product_facts(client):
    _post(client, [_choice()])
    question_id = _first_id(client)
    for field in ("gen_batch", "stem_hash", "course_id", "model_ref", "created_at"):
        assert client.patch(f"/api/v1/learn/questions/{question_id}", json={field: "x"}).status_code == 422
    assert client.patch(f"/api/v1/learn/questions/{question_id}",
                        json={"difficulty": "hard"}).status_code == 200


def test_patch_question_promotes_flashcard_to_quiz(client):
    _post(client, [_flashcard()])
    """裁决 ⑨ 的升级路径：补 expected_answer + answer_source=manual + kind=quiz。"""
    question_id = _first_id(client, kind="flashcard")
    response = client.patch(f"/api/v1/learn/questions/{question_id}",
                            json={"kind": "quiz", "question_type": "short",
                                  "expected_answer": "有上界必有上确界", "answer_source": "manual"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["kind"] == "quiz" and body["answer_source"] == "manual"
    assert "expected_answer" not in body
    assert _answer(client, question_id, "有上界必有上确界").json()["is_correct"] is True


def test_patch_question_keeps_invariants(client):
    _post(client, [_choice()])
    question_id = _first_id(client)
    assert client.patch(f"/api/v1/learn/questions/{question_id}",
                        json={"expected_answer": ""}).status_code == 422
    assert client.patch(f"/api/v1/learn/questions/{question_id}",
                        json={"question_type": "open", "keywords": []}).status_code == 422
    assert client.patch(f"/api/v1/learn/questions/{question_id}",
                        json={"kind": "flashcard", "answer_back": ""}).status_code == 422
    assert client.patch(f"/api/v1/learn/questions/{question_id}",
                        json={"answer_source": "none"}).status_code == 422
    assert client.patch("/api/v1/learn/questions/q-missing",
                        json={"difficulty": "hard"}).status_code == 404


def test_retire_hides_question_and_blocks_answers(client):
    _post(client, [_choice()])
    question_id = _first_id(client)
    assert client.patch(f"/api/v1/learn/questions/{question_id}",
                        json={"retired": True}).status_code == 200
    assert client.get("/api/v1/learn/questions").json()["total"] == 0
    all_rows = client.get("/api/v1/learn/questions", params={"retired": "all"}).json()
    assert all_rows["total"] == 1 and all_rows["questions"][0]["retired"] is True
    assert _answer(client, question_id, "B").status_code == 404


# ---------- 作答与判分（POST /learn/attempts，缝 1/2/6） ----------


def test_attempt_returns_grade_and_reveals_answer_afterwards(client):
    _post(client, [_choice()])
    question_id = _first_id(client)
    response = _answer(client, question_id, " B ")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["is_correct"] is True and body["method"] == "deterministic"
    assert body["question_id"] == question_id
    assert body["expected_answer"] == "B" and "重要极限" in body["explanation"]
    assert body["score_trend"] == "new" and body["resolved"] is True
    assert body["attempt_id"] > 0 and body["answered_at"]
    assert body["review"]["target_kind"] == "question"
    assert body["review"]["interval_index"] == 1
    assert body["review"]["next_due_at"] > body["answered_at"]


def test_attempt_wrong_then_correct_flips_trend_and_resolved(client):
    _post(client, [_choice()])
    question_id = _first_id(client)
    first = _answer(client, question_id, "C").json()
    assert first["is_correct"] is False and first["resolved"] is False and first["score_trend"] == "new"
    second = _answer(client, question_id, "B", origin="manual").json()
    assert second["score_trend"] == "improved" and second["resolved"] is True
    third = _answer(client, question_id, "D", origin="review",
                    review_date="2026-10-03T10:00:00").json()
    assert third["score_trend"] == "declined" and third["resolved"] is False
    fourth = _answer(client, question_id, "A", origin="review",
                     review_date="2026-10-04T10:00:00").json()
    assert fourth["is_correct"] is False and fourth["score_trend"] == "unchanged"
    fifth = _answer(client, question_id, "B").json()
    assert fifth["score_trend"] == "improved" and fifth["resolved"] is True


def test_short_fuzzy_threshold(client):
    question_id = _post(client, [_choice(question_type="short", options=None,
                                         expected_answer="单调有界必收敛", keywords=None)]).json()[
        "questions"][0]["question_id"]
    punctual = _answer(client, question_id, "单调有界必收敛。").json()
    assert punctual["is_correct"] is True  # 全等失败但 ratio 2*8/17≈0.94 ≥ 0.85 且 expected ≤30 字
    far = _answer(client, question_id, "完全不相干的长答案说明文本内容").json()
    assert far["is_correct"] is False


def test_long_expected_answer_disables_fuzzy_match(client):
    long_expected = "上确界定义" + "：" + "非空数集若有上界则必有最小上界" * 2
    question_id = _post(client, [_choice(question_type="short", options=None,
                                         expected_answer=long_expected, keywords=None)]).json()[
        "questions"][0]["question_id"]
    near = _answer(client, question_id, long_expected[:-1]).json()
    assert len(long_expected) > 30 and near["is_correct"] is False


def test_open_keyword_hit_ratio(client):
    question_id = _post(client, [_choice(question_type="open", options=None,
                                         expected_answer="连续；可导；导函数连续",
                                         keywords=["连续", "可导", "导函数连续"])]).json()["questions"][0][
        "question_id"]
    two_of_three = _answer(client, question_id, "函数连续且可导").json()
    assert two_of_three["is_correct"] is True  # 命中比 2/3 ≥ 0.6
    one_of_three = _answer(client, question_id, "连续" + "无关文本" * 20).json()
    assert one_of_three["is_correct"] is False  # 1/3 < 0.6


def test_unknown_question_type_is_never_correct(client, store):
    """缝 1：未知判分类型不猜（store 层直插，API 面闭集拒绝该值）。"""
    question_id = store.add_questions(course_id="math_analysis", items=[
        _item(stem="论述题面。", question_type="essay", expected_answer="论述")])["questions"][0][
        "question_id"]
    result = store.add_attempt(question_id=question_id, user_answer="论述")
    assert result["attempt"]["is_correct"] is False
    assert result["grade"]["note"]
    assert store.review_due("math_analysis", max_tasks=10)


def test_missing_expected_answer_is_recorded_as_issue(client, store):
    """缝 1：expected_answer 为空判 False 且把问题记进 question.meta.issues。"""
    question_id = store.add_questions(course_id="math_analysis", items=[
        _item(stem="缺答案的历史题。", expected_answer="")])["questions"][0]["question_id"]
    graded = store.add_attempt(question_id=question_id, user_answer="随便写")
    assert graded["attempt"]["is_correct"] is False
    assert "expected_answer 缺失" in graded["attempt"]["judge_note"]
    assert "expected_answer 缺失" in store.get_question(question_id)["meta"]["issues"]


def test_attempt_validation_and_conflicts(client):
    _post(client, [_choice(), _flashcard()])
    quiz_id = _first_id(client, kind="quiz")
    card_id = _first_id(client, kind="flashcard")
    assert _answer(client, quiz_id, "  ").status_code == 422
    assert _answer(client, quiz_id, "B", origin="daily").status_code == 422
    assert _answer(client, card_id, "我想起来了").status_code == 422
    assert _answer(client, card_id, "记得", self_result="maybe").status_code == 422
    assert _answer(client, quiz_id, "B", self_result="correct").status_code == 409
    assert _answer(client, "q-missing", "B").status_code == 404


def test_flashcard_self_grade_has_no_judging(client):
    card_id = _post(client, [_flashcard(kp_type="memory")]).json()["questions"][0]["question_id"]
    again = _answer(client, card_id, "心里答了一遍", self_result="again").json()
    assert again["method"] == "self" and again["is_correct"] is False
    assert again["expected_answer"] is None and again["explanation"] is None
    assert again["review"]["interval_index"] == 0
    remembered = _answer(client, card_id, "记得", self_result="correct").json()
    assert remembered["method"] == "self" and remembered["is_correct"] is True
    assert remembered["score_trend"] == "improved"


def test_repeat_review_same_date_is_conflict(client):
    """唯一键 (question_id, review_date, origin)：复习同日不重复计，新题无 review_date 可重复练。"""
    _post(client, [_choice()])
    question_id = _first_id(client)
    first = _answer(client, question_id, "B", origin="review", review_date="2026-10-05T09:00:00")
    assert first.status_code == 200
    second = _answer(client, question_id, "C", origin="review", review_date="2026-10-05T09:00:00")
    assert second.status_code == 409
    for _ in range(2):
        assert _answer(client, question_id, "B").status_code == 200


# ---------- 复习调度（纯函数 + GET /learn/review/due） ----------


def _state(index=0, correct=0, wrong=0, kp_type="memory"):
    return {"kp_type": kp_type, "interval_index": index, "consecutive_correct": correct,
            "consecutive_wrong": wrong}


def test_schedule_next_promotion_demotion_and_clamp():
    now = datetime(2026, 10, 3, 12, 0, 0)
    one = schedule_next(_state(), True, now)
    assert one["interval_index"] == 1 and one["consecutive_correct"] == 1
    assert one["due_at"] == now + timedelta(days=1)  # memory [0,1,3,7,14,30,60]

    jump = schedule_next(_state(correct=1), True, now)  # 连对第 2 次 ⇒ 跳两档（+2）并清零
    assert jump["interval_index"] == 2 and jump["consecutive_correct"] == 0
    assert jump["due_at"] == now + timedelta(days=3)

    top = schedule_next(_state(index=6), True, now)
    assert top["interval_index"] == 6 and top["due_at"] == now + timedelta(days=60)

    demote = schedule_next(_state(index=3, correct=2), False, now)
    assert demote["interval_index"] == 2 and demote["consecutive_correct"] == 0
    assert demote["consecutive_wrong"] == 1 and demote["due_at"] == now + timedelta(days=3)

    floor = schedule_next(_state(), False, now)
    assert floor["interval_index"] == 0 and floor["due_at"] == now  # 0 天＝当日再练

    twice_wrong = schedule_next(_state(index=2, wrong=1), False, now)
    assert twice_wrong["consecutive_wrong"] == 0 and twice_wrong["interval_index"] == 1
    assert twice_wrong["due_at"] == now + timedelta(days=1)


def test_schedule_next_sequence_by_type_and_default():
    now = datetime(2026, 10, 3, 12, 0, 0)
    assert schedule_next(_state(kp_type="concept"), True, now)["due_at"] == now + timedelta(days=7)
    assert schedule_next(_state(kp_type="procedure"), True, now)["due_at"] == now + timedelta(days=7)
    assert schedule_next(_state(index=1, kp_type="design"), True, now)["due_at"] == now + timedelta(days=28)
    assert schedule_next(_state(index=1, kp_type="design"), True, now)["interval_index"] == 1  # 钳在末档
    assert schedule_next(_state(kp_type=None), True, now)["due_at"] == now + timedelta(days=1)
    assert schedule_next(_state(kp_type="unknown"), True, now)["due_at"] == now + timedelta(days=1)


def test_review_due_queue_shape_priority_and_reason(client):
    _post(client, [_choice(kp_type="concept"), _flashcard(kp_type="memory"),
                   _choice(stem="第三题面：求导数。", kp_id="kp-mem", kp_type="memory")])
    response = client.get("/api/v1/learn/review/due", params={"course": "math_analysis"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_due"] == 3 and len(body["tasks"]) == 3
    task = body["tasks"][0]
    assert {"target_kind", "target_id", "course_id", "kp_type", "interval_index", "due_at",
            "priority", "reason", "overdue_days", "question"} <= set(task)
    assert task["priority"] == 2 and task["reason"] == "type"  # memory 优先于 concept
    assert task["question"]["question_id"] == task["target_id"]

    # 错题优先只作用于队列内部：concept 档答错退到 3 天后（不在队），memory 档答错留当日
    memory_quiz_id = _first_id(client, kp="kp-mem")
    _answer(client, memory_quiz_id, "C")
    after = client.get("/api/v1/learn/review/due", params={"course": "math_analysis"}).json()
    assert {task["target_id"] for task in after["tasks"][:2]} == {memory_quiz_id, "kp-mem"}
    assert all(task["priority"] == 1 and task["reason"] == "wrong" for task in after["tasks"][:2])


def test_review_due_overdue_days_and_max_tasks(client):
    store = InMemoryPracticeStore()
    store.add_questions(course_id="math_analysis", items=[_item(stem="超期题面。")], now=datetime(2026, 9, 1, 0, 0, 0))
    tasks = store.review_due("math_analysis", max_tasks=5, now=datetime(2026, 10, 3, 0, 0, 0))
    assert tasks[0]["overdue_days"] == 32
    _post(client, [_choice(), _flashcard(), _choice(stem="第二题面：求导数。")])
    default = client.get("/api/v1/learn/review/due", params={"course": "math_analysis"}).json()
    assert len(default["tasks"]) == 3
    capped = client.get("/api/v1/learn/review/due",
                        params={"course": "math_analysis", "max_tasks": 2}).json()
    assert len(capped["tasks"]) == 2 and capped["total_due"] == 3
    assert client.get("/api/v1/learn/review/due", params={"max_tasks": 0}).status_code == 422


def test_answered_questions_leave_today_queue(client):
    _post(client, [_choice()])
    quiz_id = _first_id(client)
    due_before = client.get("/api/v1/learn/review/due").json()["tasks"]
    assert [task["target_id"] for task in due_before] == [quiz_id]
    _answer(client, quiz_id, "B")
    assert client.get("/api/v1/learn/review/due").json() == {"course_id": None, "tasks": [], "total_due": 0}


def test_kp_granularity_task_is_created_on_first_answer(client, store):
    """裁决 ⑧：知识点粒度行在该 point 首次被作答时建。"""
    _post(client, [_choice(kp_id="kp-demo")])
    quiz_id = _first_id(client)
    _answer(client, quiz_id, "B")
    targets = {(task["target_kind"], task["target_id"])
               for task in store.review_due("math_analysis", max_tasks=20)}
    assert ("kp", "kp-demo") in targets
    assert ("question", quiz_id) not in targets  # 答对后档位推进，已出当日队列
    store.add_attempt(question_id=quiz_id, user_answer="C", origin="manual")
    again = client.get("/api/v1/learn/review/due").json()["tasks"]
    assert ("kp", "kp-demo") in {(task["target_kind"], task["target_id"]) for task in again}


# ---------- 错题本（派生查询 + PATCH 人工位） ----------


def test_mistakes_are_derived_and_stats_report(client):
    _post(client, [_choice(), _flashcard()])
    quiz_id = _first_id(client, kind="quiz")
    _answer(client, quiz_id, "C")
    response = client.get("/api/v1/learn/mistakes", params={"course": "math_analysis"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["question"]["question_id"] == quiz_id
    assert item["attempt_count"] == 1 and item["wrong_count"] == 1
    assert item["is_correct"] is False and item["resolved"] is False and item["bookmarked"] is False
    assert item["score_trend"] == "new" and item["last_attempt"]["user_answer"] == "C"
    assert body["stats"] == {"total": 2, "wrong": 1, "unresolved": 1, "bookmarked": 0, "due_today": 2}
    assert client.get("/api/v1/learn/mistakes", params={"trend": "improved"}).json()["total"] == 0
    assert client.get("/api/v1/learn/mistakes", params={"trend": "new"}).json()["total"] == 1
    assert client.get("/api/v1/learn/mistakes", params={"trend": "bogus"}).status_code == 422


def test_mistakes_latest_only_and_bookmark_patch(client):
    _post(client, [_choice()])
    quiz_id = _first_id(client)
    attempt_id = _answer(client, quiz_id, "C").json()["attempt_id"]
    assert client.get("/api/v1/learn/mistakes").json()["total"] == 1
    _answer(client, quiz_id, "B")
    assert client.get("/api/v1/learn/mistakes").json()["total"] == 0
    resolved_all = client.get("/api/v1/learn/mistakes", params={"resolved": "all"}).json()
    assert resolved_all["total"] == 1 and resolved_all["items"][0]["attempt_count"] == 2
    patched = client.patch(f"/api/v1/learn/attempts/{attempt_id}", json={"bookmarked": True})
    assert patched.status_code == 200 and patched.json()["bookmarked"] is True
    assert patched.json()["is_correct"] is False
    bookmarked = client.get("/api/v1/learn/mistakes",
                            params={"resolved": "all", "bookmarked": "true"}).json()
    assert bookmarked["total"] == 1 and bookmarked["stats"]["bookmarked"] == 1
    assert client.get("/api/v1/learn/mistakes", params={"bookmarked": "false"}).json()["total"] == 0
    for field in ("is_correct", "method", "score_trend", "user_answer"):
        assert client.patch(f"/api/v1/learn/attempts/{attempt_id}",
                           json={field: "x"}).status_code == 422
    assert client.patch("/api/v1/learn/attempts/999999",
                        json={"bookmarked": True}).status_code == 404


def test_wrong_answer_reappears_after_resolve(client):
    _post(client, [_choice()])
    quiz_id = _first_id(client)
    _answer(client, quiz_id, "C")
    _answer(client, quiz_id, "B")
    assert client.get("/api/v1/learn/mistakes").json()["total"] == 0
    _answer(client, quiz_id, "D", origin="review", review_date="2026-10-06T08:00:00")
    body = client.get("/api/v1/learn/mistakes").json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["attempt_count"] == 3 and item["wrong_count"] == 2
    assert item["score_trend"] == "declined" and item["resolved"] is False


def test_mistakes_filter_by_kp_and_book(client, store):
    _post(client, [_choice(kp_id="kp-x"), _flashcard(kp_id="kp-y")])
    _answer(client, _first_id(client, kind="quiz"), "C")
    assert client.get("/api/v1/learn/mistakes", params={"kp": "kp-x"}).json()["total"] == 1
    assert client.get("/api/v1/learn/mistakes", params={"kp": "kp-y"}).json()["total"] == 0
    assert client.get("/api/v1/learn/mistakes", params={"book": "mathanalysis-b05"}).json()["total"] == 0


# ---------- 题源书目（GET /learn/question-books，R-10 透传） ----------


def test_question_books_filters_roles_and_joins_parse_status(client):
    response = client.get("/api/v1/learn/question-books", params={"course": "math_analysis"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["course_id"] == "math_analysis"
    books = {row["book_id"]: row for row in body["books"]}
    # 书库行 `course_id` 现网全空 ⇒ 课程归属按解析表（af_books）兜底，他课书目不得混入
    assert set(books) == {"mathanalysis-b05", "mathanalysis-b07", "mathanalysis-b11"}
    assert books["mathanalysis-b07"]["roles"] == ["exercises"]
    assert books["mathanalysis-b07"]["course_id"] == "math_analysis"
    # 可抽取页数取 `pages_done`（`parse_status` 由解析侧维护、现网恒 pending，不作判据）
    assert books["mathanalysis-b05"]["parsed_pages"] == 317
    assert books["mathanalysis-b05"]["parse_status"] == "pending"
    assert books["mathanalysis-b07"]["parsed_pages"] == 0
    assert books["mathanalysis-b07"]["page_count"] == 439
    assert books["mathanalysis-b11"]["parsed_pages"] == 0


def test_question_books_without_course_lists_all_role_books(client):
    books = client.get("/api/v1/learn/question-books").json()["books"]
    assert {row["book_id"] for row in books} == {
        "mathanalysis-b05",
        "mathanalysis-b07",
        "mathanalysis-b11",
        "probability-b01",
    }
    assert {row["course_id"] for row in books} == {"math_analysis", "probability"}


def test_question_books_role_narrowing_and_errors(client):
    body = client.get("/api/v1/learn/question-books",
                      params={"course": "math_analysis", "role": "exercises"}).json()
    assert [row["book_id"] for row in body["books"]] == ["mathanalysis-b07"]
    assert client.get("/api/v1/learn/question-books",
                      params={"course": "no_such_course"}).status_code == 404
    assert client.get("/api/v1/learn/question-books",
                      params={"course": "math_analysis", "role": "comic"}).status_code == 422


def test_question_books_503_when_catalog_unreachable(client, monkeypatch):
    from qed_engine.clients import tracker_client

    def _boom(self):
        raise RuntimeError("8901 down")

    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", _boom)
    assert client.get("/api/v1/learn/question-books",
                      params={"course": "math_analysis"}).status_code == 503


# ---------- 存储未接入与两实现同形 ----------


def test_practice_domain_is_503_without_mounted_store(monkeypatch):
    from qed_engine.services.learn import base as learn_base
    from qed_engine.services.learn import practice as practice_base

    calls = []
    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_PASSWORD", "")
    monkeypatch.setattr("qed_engine.api.main._startup_db_check", lambda settings: "mocked")
    monkeypatch.setattr(learn_base, "ensure_tables", lambda settings: calls.append(settings))
    monkeypatch.setattr(practice_base, "ensure_tables", lambda settings: calls.append(settings))
    client = TestClient(create_app())
    assert client.get("/api/v1/learn/questions").status_code == 503
    assert client.post("/api/v1/learn/questions",
                       json={"course_id": "c", "questions": [_choice()]}).status_code == 503
    assert client.get("/api/v1/learn/review/due").status_code == 503
    assert client.get("/api/v1/learn/mistakes").status_code == 503
    assert calls == []  # 未配置密码不尝试建表（隔离铁律）


def test_mysql_practice_store_interface_matches_memory_store():
    """两实现同形：内存实现的公开方法在 MySQL 存储上缺一不可（判例 test_learn.py）。"""
    import inspect

    from qed_engine.services.learn.practice import MySQLPracticeStore

    def _api(cls):
        return {name for name, member in inspect.getmembers(cls, predicate=inspect.isfunction)
                if not name.startswith("_")}

    assert _api(InMemoryPracticeStore) - _api(MySQLPracticeStore) == set()


def test_add_questions_is_atomic_on_validation_failure(store):
    """缝 6 同事务的内存等价断言：一批里有一项非法则整批不落。"""
    with pytest.raises(ValueError):
        store.add_questions(course_id="math_analysis", items=[
            _item(stem="合法题面。"),
            _item(stem="   "),
        ])
    assert store.list_questions(course_id="math_analysis") == ([], 0)
    assert store.review_due("math_analysis", max_tasks=10) == []


def test_clock_is_injected_for_scheduler_tests(store):
    """DeepTutor 的 time.time() 直取时钟不移植：入库与回写都用注入时钟。"""
    question_id = store.add_questions(course_id="math_analysis", items=[_item(stem="时钟注入题面。")],
                                      now=datetime(2026, 12, 1, 8, 0, 0))["questions"][0]["question_id"]
    result = store.add_attempt(question_id=question_id, user_answer="A", origin="new",
                               now=datetime(2026, 12, 1, 9, 0, 0))
    assert store._review_tasks[("question", question_id)]["due_at"] == datetime(2026, 12, 2, 9, 0, 0)
    assert result["review"]["next_due_at"] == "2026-12-02T09:00:00"
    assert result["attempt"]["answered_at"] == "2026-12-01T09:00:00"


def test_attempt_leaves_no_trace_when_rejected(client, store):
    """同事务：拒绝的作答既不落 attempt 也不回写调度态。"""
    question_id = _post(client, [_choice()]).json()["questions"][0]["question_id"]
    before = store.review_due("math_analysis", max_tasks=10)[0]
    assert _answer(client, question_id, " ").status_code == 422
    assert _answer(client, question_id, "B", self_result="correct").status_code == 409
    after = store.review_due("math_analysis", max_tasks=10)[0]
    assert after["interval_index"] == before["interval_index"] == 0
    assert after["due_at"] == before["due_at"]
    assert store._attempts == []


# ---------- 主链 M-3 W2：掌握门的输入面（近因序列按知识点取，两实现同形） ----------


def test_attempts_by_kp_returns_chronological_sequences(store):
    """门的输入＝该知识点的近因序列：按作答时序而非入库序，跨课程不串，未归档题不进门。"""
    stamp = datetime(2026, 10, 18, 8, 0, 0)
    batch = store.add_questions(course_id="math_analysis", items=[
        _item(stem="kpA 第一题。", kp_id="kp-limit", kp_type="memory", expected_answer="存在"),
        _item(stem="kpA 第二题。", kp_id="kp-limit", kp_type="memory", expected_answer="存在"),
        _item(stem="kpB 题。", kp_id="kp-continuity", kp_type="procedure", expected_answer="连续"),
        _item(stem="未归档题。", expected_answer="存在"),
    ])
    a1, a2, b1, loose = (row["question_id"] for row in batch["questions"])
    store.add_attempt(question_id=a2, user_answer="存在", now=stamp + timedelta(minutes=1))
    store.add_attempt(question_id=a1, user_answer="不存在", now=stamp + timedelta(minutes=2))
    store.add_attempt(question_id=a1, user_answer="存在", now=stamp + timedelta(minutes=4))
    store.add_attempt(question_id=b1, user_answer="连续", now=stamp + timedelta(minutes=3))
    store.add_attempt(question_id=loose, user_answer="存在", now=stamp)

    sequences = store.attempts_by_kp("math_analysis")
    assert sequences["kp-limit"] == [True, False, True]  # 时序：分钟 1→2→4
    assert sequences["kp-continuity"] == [True]
    assert set(sequences) == {"kp-limit", "kp-continuity"}
    assert store.attempts_by_kp("other_course") == {}


def test_attempts_by_kp_returns_the_whole_history(store):
    """缝 4 全量保留在读侧的体现：本方法给全序，最近 5 次窗口与置信上限钳制归规则层。"""
    stamp = datetime(2026, 10, 18, 8, 0, 0)
    question_id = store.add_questions(course_id="math_analysis", items=[
        _item(stem="kpA 八次作答。", kp_id="kp-limit", expected_answer="存在"),
    ])["questions"][0]["question_id"]
    for index in range(8):
        store.add_attempt(
            question_id=question_id,
            user_answer="存在" if index == 7 else "不存在",
            now=stamp + timedelta(minutes=index),
        )
    sequence = store.attempts_by_kp("math_analysis")["kp-limit"]
    assert len(sequence) == 8 and sequence[-1] is True and sequence[0] is False


# ---------- 主链 M-3 W3：门输入面（按知识点到期计数） ----------

def test_due_counts_by_kp_groups_question_and_kp_granularity_tasks(client, store):
    """门游标的复习腿：到期任务按知识点归集（题行＋裁决 ⑧ 的 kp 粒度行两路都算，未归档题不进门）。"""
    _post(client, [_choice(kp_id="kp-m3", kp_type="procedure")])
    quiz_id = _first_id(client, kp="kp-m3")
    assert store.due_counts_by_kp("math_analysis") == {"kp-m3": 1}  # 题行当日到期
    _answer(client, quiz_id, "B")
    # 答对后题行退到 7 天后，kp 粒度行由首次作答建、当日到期：计数仍归到该知识点
    assert store.due_counts_by_kp("math_analysis") == {"kp-m3": 1}
    assert store.due_counts_by_kp("other_course") == {}
    _post(client, [_choice(stem="未归档题面：求导数。")])  # kp_id 空＝不进任何门（裁决 D-M3-4）
    assert store.due_counts_by_kp("math_analysis") == {"kp-m3": 1}
