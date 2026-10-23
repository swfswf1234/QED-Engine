"""学习域（/api/v1/learn/*，27 端点）契约测试：v1.0 三表口径的课程面、门面与注解面。

模块职责：守护 ADR 0026 定档后的学习记录单表 `qe_learning` 语义——course 行＝引用共享
`qed_course.course_id` 的选课行（D4 不发独立 ID、D7 `owner` 列不出契约面）、kp 行＝知识点
终态位与质性门四列（勾选与判定分居两通路，`pending` 撤销无判定痕迹即删行）、推进序列＝主表
point 行的读时投影（派生键 `kp:{kp_id}`、零物化）、按需生成腿的章行覆写与条级 `angles` 追加
（D10）、三域存储懒挂载窗口（判例 DEFECT-009）。编译族／单元树族／候选池族随 D1/D2 退出，
其用例一并删除；知识点主表自身形状与星图见 tests/test_learn_knowledge.py，练习与复习见
tests/test_learn_practice.py。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/api/learn.py、backend/qed_engine/services/learn/
失效后果：学习域契约漂移，8903 学习面按错误形状联调
"""

import time

import httpx
import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.clients.axiom_client import AxiomClient
from qed_engine.clients.tracker_client import TrackerClient
from qed_engine.services.learn import (
    InMemoryKnowledgeStore,
    InMemoryLearnStore,
    InMemoryPracticeStore,
)

STUDY_COURSE = "math_analysis"  # 共享课程 ID＝学习课程 ID＝题库课程键（D4 之后一枚坐标）

COURSE_BODY = {
    "course_id": STUDY_COURSE,
    "resources": [
        {"kind": "book", "ref_id": "mathanalysis-b05", "label": "数学分析原理"},
        {"kind": "af_version", "ref_id": "mathanalysis-b05", "label": "b05 生效版本"},
        {"kind": "knowledge", "ref_id": "k-001", "label": "教程套一"},
    ],
}

BOOK_RESOURCE = {"kind": "book", "ref_id": "mathanalysis-b05", "label": "数学分析教程"}

# 章→节两级目录树（outline 行；页范围＝PDF 页序）
DEFAULT_OUTLINE = [
    {
        "name": "第一章 实数",
        "page_start": 21,
        "page_end": 30,
        "children": [{"name": "1.1 实数的完备性", "page_start": 21, "page_end": 24}],
    }
]

GATE_COLUMNS = ("qualitative_passed", "qualitative_note", "assessed_by", "assessed_at")

MASTERY_ITEM_FIELDS = {
    "unit_id", "kp_id", "kp_type", "gate", "mastery", "threshold", "attempt_count",
    "provenance", "status", "qualitative_passed", "due_reviews",
}


@pytest.fixture(autouse=True)
def _mock_startup_probes(monkeypatch):
    """隔离铁律：测试不触真实网络/MySQL（判例 test_api._mock_startup_llm_probe）。"""
    from qed_engine.api import control as api_control
    from qed_engine.services.llm import call_log as llm_call_log

    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(llm_call_log, "ensure_table", lambda settings: None)
    monkeypatch.setattr(llm_call_log, "ensure_comments", lambda settings: None)


@pytest.fixture()
def client(monkeypatch):
    _env(monkeypatch)
    return TestClient(create_app(learn_store=InMemoryLearnStore()))


def _make_course(client) -> str:
    resp = client.post("/api/v1/learn/courses", json=COURSE_BODY)
    assert resp.status_code == 200, resp.text
    return resp.json()["learn_course_id"]


# ---------- 选课（qe_learning 的 course 行，D4 引用式注册） ----------


def test_course_register_returns_shared_id_and_defaults(client):
    """学习课程 ID＝共享 `qed_course.course_id`（D4：本域不再发第二套 ID）。"""
    course_id = _make_course(client)
    assert course_id == STUDY_COURSE
    detail = client.get(f"/api/v1/learn/courses/{course_id}").json()
    assert detail["status"] == "active"
    assert detail["resources"][0]["kind"] == "book"
    assert detail["kp_path"] == [] and detail["learner_note"] == ""
    assert detail["unit_count"] == 0 and detail["derived"]["status"] == "draft"
    listed = client.get("/api/v1/learn/courses").json()["courses"][0]
    assert listed == detail  # 列表与详情共用同一课程投影
    assert listed["learn_course_id"] == course_id


def test_course_register_rejects_unknown_kind(client):
    body = {**COURSE_BODY, "resources": [{"kind": "pdf", "ref_id": "x", "label": "y"}]}
    assert client.post("/api/v1/learn/courses", json=body).status_code == 422


def test_course_register_requires_resources_and_course_id(client):
    assert client.post("/api/v1/learn/courses", json={"course_id": "x"}).status_code == 422
    assert client.post(
        "/api/v1/learn/courses", json={"course_id": "", "resources": [BOOK_RESOURCE]}
    ).status_code == 422
    bad = {**COURSE_BODY, "resources": [{"kind": "book", "ref_id": "", "label": "l"}]}
    assert client.post("/api/v1/learn/courses", json=bad).status_code == 422


def test_course_register_is_idempotent_on_shared_id(client):
    """同枚共享课程 ID 二次加入＝409（唯一键 owner×target_kind×target_id 的端点口径）。"""
    _make_course(client)
    again = client.post("/api/v1/learn/courses", json=COURSE_BODY)
    assert again.status_code == 409
    assert "已在学习面" in again.json()["detail"]


def test_patch_course_whitelist_keeps_names_off_the_learning_row(client):
    """课程行白名单（extra=forbid）：名称/领域/坐标列归共享表，本域改即 422（R5 引用不复制）。"""
    course_id = _make_course(client)
    for body in ({"name": "自定名"}, {"course_ref": {"ref_id": "x", "label": "y"}},
                 {"compile_status": "completed"}, {"status": "archived"}):
        assert client.patch(f"/api/v1/learn/courses/{course_id}", json=body).status_code == 422
    patched = client.patch(
        f"/api/v1/learn/courses/{course_id}",
        json={"status": "paused", "kp_path": ["kp-1"], "learner_note": "先修完线代"},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["status"] == "paused" and body["kp_path"] == ["kp-1"]
    assert body["learner_note"] == "先修完线代"


def test_course_delete_keeps_knowledge_point_rows(monkeypatch):
    """退课只删 course 行：kp 行是跨课程的学习者记录，不随退课蒸发（D4）。"""
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"kp_id": kp_id, "status": "done"}
    ).status_code == 200
    assert client.delete(f"/api/v1/learn/courses/{course_id}").status_code == 200
    assert client.get(f"/api/v1/learn/courses/{course_id}").status_code == 404
    assert client.patch(f"/api/v1/learn/courses/{course_id}", json={"status": "done"}).status_code == 404
    store = client.app.state.learn_store
    assert store.kp_rows()[kp_id]["status"] == "done"
    assert client.delete("/api/v1/learn/courses/never-enrolled").status_code == 404


def test_owner_never_leaves_the_contract_surface(monkeypatch):
    """D7：`owner` 只承载唯一键前缀与扩展位——本域端点不收、不回显。"""
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    assert client.post(
        "/api/v1/learn/courses", json={**COURSE_BODY, "owner": "mallory"}
    ).status_code == 422
    posted = client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"kp_id": kp_id, "status": "done"}
    )
    assert posted.status_code == 200, posted.text
    assert "owner" not in posted.json()
    for payload in (
        client.get(f"/api/v1/learn/courses/{course_id}").json(),
        client.get("/api/v1/learn/courses").json()["courses"][0],
        posted.json()["derived"],
    ):
        assert "owner" not in payload, payload
    learner = client.get(f"/api/v1/learn/courses/{course_id}/knowledge-points").json()[
        "sequence"
    ]["units"][0]["learner"]
    assert learner["status"] == "done" and "owner" not in learner


# ---------- kp 行存储面：单表继承、门四列与撤销语义（两实现同语义） ----------


def _kp_store() -> InMemoryLearnStore:
    store = InMemoryLearnStore()
    store.create_course(course_id="c1", resources=[BOOK_RESOURCE])
    return store


def test_kp_row_status_is_a_closed_set_and_pending_deletes_the_row():
    """kp 行 status 闭集 done/skipped/pending；`pending`＝撤销，无判定痕迹时整行删除（读时派生非累加）。"""
    from qed_engine.services.learn.base import LearnConflict, LearnNotFound

    store = _kp_store()
    with pytest.raises(LearnConflict):
        store.set_kp_status("kp-1", "active")  # course 行的态不得打在 kp 行上
    with pytest.raises(LearnConflict):
        store.set_kp_status("kp-1", "bogus")
    assert store.kp_rows() == {}  # 未落笔＝无行
    row = store.set_kp_status("kp-1", "done")
    assert row["kp_id"] == "kp-1" and row["status"] == "done"
    assert row["qualitative_passed"] is None and row["assessed_by"] == ""
    revoked = store.set_kp_status("kp-1", "pending")
    assert revoked["removed"] is True and store.kp_rows() == {}
    assert store.set_kp_status("kp-none", "pending")["removed"] is True
    with pytest.raises(LearnNotFound):
        store.get_kp_row("kp-none")


def test_pending_keeps_the_row_when_a_qualitative_trace_exists():
    """撤销终态位但有质性判定＝保留行、只把 status 打回 pending（判定四列不因撤销蒸发）。"""
    store = _kp_store()
    store.assess_qualitative("kp-2", passed=True, note="讲清了", assessed_by="learner")
    store.set_kp_status("kp-2", "done")
    row = store.set_kp_status("kp-2", "pending")
    assert "removed" not in row and row["status"] == "pending"
    assert row["qualitative_passed"] is True and row["assessed_by"] == "learner"


def test_assess_qualitative_writes_gate_columns_and_starts_pending():
    """D-M3-2 v1 自评位：判定落四列、终态位不受影响（派生计数不因判定而虚增）。"""
    store = _kp_store()
    row = store.assess_qualitative(
        "kp-limit", passed=True, note="能用自己的话说清 ε-δ", assessed_by="learner"
    )
    assert row["kp_id"] == "kp-limit" and row["status"] == "pending"
    assert row["qualitative_passed"] is True
    assert row["qualitative_note"] == "能用自己的话说清 ε-δ"
    assert row["assessed_by"] == "learner" and row["assessed_at"]
    read = store.kp_rows()["kp-limit"]
    assert read["qualitative_passed"] is True and read["assessed_by"] == "learner"


def test_assess_qualitative_overwrites_and_preserves_terminal_status():
    """重复判定覆盖同一行（一知识点只留最新质性结论）；已有 done 终态不被抹掉。"""
    store = _kp_store()
    store.set_kp_status("kp-limit", "done")
    first = store.assess_qualitative("kp-limit", passed=True, note="讲清了")
    second = store.assess_qualitative("kp-limit", passed=False, note="重讲仍含混")
    assert first["status"] == second["status"] == "done"
    assert second["qualitative_passed"] is False and second["qualitative_note"] == "重讲仍含混"
    assert store.kp_rows()["kp-limit"]["qualitative_passed"] is False
    assert len(store.kp_rows()) == 1


def test_assess_qualitative_rejects_unknown_assessed_by():
    """`assessed_by` 闭集 learner/model（model 判读腿属 M-3b，存储层先兜住）。"""
    from qed_engine.services.learn.base import LearnConflict

    store = _kp_store()
    with pytest.raises(LearnConflict):
        store.assess_qualitative("kp-1", passed=True, assessed_by="machine")


def test_set_kp_status_does_not_wipe_gate_columns():
    """勾选与质性判定分居两条通路：写终态位不得抹掉判定四列（MySQL ON DUPLICATE 同语义）。"""
    store = _kp_store()
    store.assess_qualitative("kp-1", passed=True, note="讲清了")
    row = store.set_kp_status("kp-1", "skipped")
    assert row["status"] == "skipped" and row["qualitative_passed"] is True
    assert row["qualitative_note"] == "讲清了" and row["assessed_by"] == "learner"


def test_learner_note_is_a_manual_column_on_both_row_kinds():
    """备注＝单列（course 行与 kp 行通用，R6 人工位）；行不存在不起新行。"""
    from qed_engine.services.learn.base import LearnNotFound

    store = InMemoryLearnStore()
    store.create_course(course_id="c1", resources=[BOOK_RESOURCE], learner_note="开课备注")
    assert store.get_course("c1")["learner_note"] == "开课备注"
    store.set_kp_status("kp-1", "done")
    assert store.set_note("kp", "kp-1", "这一条我的说法")["learner_note"] == "这一条我的说法"
    assert store.set_note("course", "c1", "改备注")["learner_note"] == "改备注"
    assert store.get_kp_row("kp-1")["learner_note"] == "这一条我的说法"
    with pytest.raises(LearnNotFound):
        store.set_note("kp", "kp-none", "无人行")


def test_owner_partition_isolates_rows_at_store_level():
    """D7 唯一键 owner 前缀：同一目标在不同 owner 下各自成行，读面按 owner 切分。"""
    store = InMemoryLearnStore()
    alice = store.create_course(course_id="c1", resources=[BOOK_RESOURCE], owner="alice")
    bob = store.create_course(course_id="c1", resources=[BOOK_RESOURCE], owner="bob")
    assert alice["learn_course_id"] == bob["learn_course_id"] == "c1"
    assert len(store.list_courses(owner="alice")) == 1
    assert store.list_courses(owner="carol") == []
    store.set_kp_status("kp-1", "done", owner="alice")
    assert set(store.kp_rows(owner="alice")) == {"kp-1"}
    assert store.kp_rows(owner="bob") == {}


def test_learning_ddl_declares_owner_gate_columns_and_unique_key():
    """列面进建表 DDL：`qe_learning` 单表继承两型行，四枚判定列与 owner 前缀唯一键齐备。"""
    from qed_engine.services.learn import base as learn_base

    ddl = learn_base.CREATE_TABLE_SQL
    assert "CREATE TABLE IF NOT EXISTS qe_learning" in ddl
    for column in ("owner", "target_kind", "target_id", "status", "config", "learner_note", *GATE_COLUMNS):
        assert f"  {column} " in ddl, column
    assert "UNIQUE KEY uq_learning_target (owner, target_kind, target_id)" in ddl
    assert "COLLATE=utf8mb4_0900_ai_ci" in ddl
    assert "PROGRESS_GATE_COLUMNS" not in dir(learn_base)  # 补列注册表随编译链退役


def test_mysql_learn_store_interface_matches_memory_store():
    """两实现同形：内存实现的公开方法在 MySQL 存储上缺一不可（签名漂移即红）。"""
    import inspect

    from qed_engine.services.learn.base import MySQLLearnStore

    def _api(cls):
        return {
            name
            for name, member in inspect.getmembers(cls, predicate=inspect.isfunction)
            if not name.startswith("_")
        }

    assert _api(InMemoryLearnStore) - _api(MySQLLearnStore) == set()


# ---------- 推进序列＝主表 point 行的读时投影（§V2.3 派生键，零物化） ----------


def _env(monkeypatch) -> None:
    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_HOST", "127.0.0.1")
    monkeypatch.setenv("QED_DB_PORT", "3306")
    monkeypatch.setenv("QED_DB_NAME", "qed_test")
    monkeypatch.setenv("QED_DB_USER", "root")
    monkeypatch.setenv("QED_DB_PASSWORD", "")


# 8901 领域课程目录快照（正式名称与领域坐标只在共享表，R5）
SYNC_DOMAINS = [
    {
        "domain_id": "math-advanced",
        "name": "数学（高等数学）",
        "courses": [
            {"course_id": "math_analysis", "name": "数学分析", "stage": "beginner"},
            {"course_id": "linear_algebra", "name": "高等代数", "stage": "advanced"},
        ],
    }
]

# 8901 教程套（qt_knowledge）：书级两列现网不存在，展示元数据暂由套级字段联接
SYNC_KNOWLEDGE = [
    {"knowledge_id": "k-ma", "course_id": "math_analysis", "name": "数学分析教程",
     "intro": "面向数学专业本科一年级的教材套", "position": "beginner"},
    {"knowledge_id": "k-la", "course_id": "linear_algebra", "name": "高等代数教程",
     "intro": "面向数学专业高年级的深入教材套", "position": "advanced"},
]

# 8902 书目快照：b09 未解析（active_job_id 空）应 PASS；quantum 无课程归属应 PASS
SYNC_BOOKS = [
    {"book_id": "mathanalysis-b05", "title": "数学分析", "display_title": "数学分析（第5版）上册",
     "course_id": "math_analysis", "knowledge_id": "k-ma", "active_job_id": "job-05", "page_count": 317},
    {"book_id": "mathanalysis-b07", "title": "数分习题", "display_title": "数学分析习题集",
     "course_id": "math_analysis", "knowledge_id": "k-ma", "active_job_id": "job-07", "page_count": 200},
    {"book_id": "mathanalysis-b09", "title": "未解析的书", "display_title": "未解析的书",
     "course_id": "math_analysis", "active_job_id": "", "page_count": 100},
    {"book_id": "quantum-b01", "title": "量子力学导论", "display_title": "量子力学导论",
     "course_id": "", "active_job_id": "job-q", "page_count": 90},
    {"book_id": "linearalgebra-b01", "title": "线性代数", "display_title": "线性代数（第六版）",
     "course_id": "linear_algebra", "knowledge_id": "k-la", "active_job_id": "job-01", "page_count": 486},
]


def _sync_client(
    monkeypatch,
    books=None,
    *,
    axiom_online=True,
    knowledge_online=True,
    knowledge_store=None,
    pages=None,
    practice_store=None,
):
    """8901/8902 双侧 MockTransport（判例 test_api）；books 传入可变列表以便同场改解析态。

    knowledge_store：投影序列用例的注入点（学习记录与知识点主表同场，仍不触真实库）。
    """
    _env(monkeypatch)
    rows = SYNC_BOOKS if books is None else books

    def _tracker_handler(request):
        if request.url.path.endswith("/knowledge"):
            if not knowledge_online:
                raise httpx.ConnectError("knowledge down", request=request)
            return httpx.Response(200, json=SYNC_KNOWLEDGE)
        return httpx.Response(200, json=SYNC_DOMAINS)

    tracker = TrackerClient(
        base_url="http://tracker.test", transport=httpx.MockTransport(_tracker_handler)
    )

    def _axiom_handler(request):
        if not axiom_online:
            raise httpx.ConnectError("axiom down", request=request)
        parts = request.url.path.split("/")
        if "pages" in parts:  # /api/v1/books/{book_id}/pages/{page_no}（注解取材腿）
            index = parts.index("pages")
            key = f"{parts[index - 1]}:{parts[index + 1]}"
            return httpx.Response(200, json=(pages or {}).get(key, {"blocks": []}))
        return httpx.Response(200, json=list(rows))

    axiom = AxiomClient(
        base_url="http://axiom.test", transport=httpx.MockTransport(_axiom_handler)
    )
    app = create_app(
        learn_store=InMemoryLearnStore(),
        tracker_client=tracker,
        axiom_client=axiom,
        knowledge_store=knowledge_store,
        practice_store=practice_store,
    )
    return TestClient(app)


def _study_client(
    monkeypatch,
    *,
    outline=None,
    book_ref="mathanalysis-b05",
    pages=None,
    knowledge_store=None,
    practice_store=None,
):
    """sync 出 math_analysis 学习课程 + 知识点主表同场，返回 (client, course_id, outline 行)。"""
    client = _sync_client(
        monkeypatch,
        knowledge_store=knowledge_store or InMemoryKnowledgeStore(),
        pages=pages,
        practice_store=practice_store,
    )
    client.post("/api/v1/learn/courses/sync")
    course_id = _courses_by_id(client)[STUDY_COURSE]["learn_course_id"]
    rows = client.put(
        f"/api/v1/learn/courses/{STUDY_COURSE}/outline",
        json={"book_ref": book_ref, "tree": outline or DEFAULT_OUTLINE},
    ).json()["outline"]
    return client, course_id, rows


def _outline_row(rows, name):
    return next(row for row in rows if row["name"] == name)


def _confirm_point(
    client, name, *, parent=None, anchors=None, order_hint=None, point_type="concept",
    summary=None, aliases=None, narrative_ref="",
) -> str:
    """直登记一条 point 行＝候选池退役后主表的唯一产面（写入这一动作即承载确认，D10）。"""
    body = {
        "course_id": STUDY_COURSE,
        "name": name,
        "type": point_type,
        "summary": summary if summary is not None else f"{name}的叙述",
        "anchors": anchors or [],
        "aliases": aliases or [],
        "narrative_ref": narrative_ref,
    }
    if parent is not None:
        body["parent_kp_id"] = parent
    if order_hint is not None:
        body["order_hint"] = order_hint
    resp = client.post("/api/v1/learn/knowledge-points", json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()["kp_id"]


def _courses_by_id(client):
    return {
        c["learn_course_id"]: c
        for c in client.get("/api/v1/learn/courses").json()["courses"]
    }


def _sequence(client, course_id):
    return client.get(f"/api/v1/learn/courses/{course_id}/knowledge-points").json()["sequence"]


def test_point_units_project_confirmed_points_without_writing(monkeypatch):
    """投影序列：已确认 point 行按章折叠、派生键 `kp:{kp_id}`，未落笔时 learner 全空（零物化）。"""
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    section = _outline_row(rows, "1.1 实数的完备性")
    first = _confirm_point(client, "确界原理", parent=section["kp_id"])
    second = _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])

    body = _sequence(client, course_id)
    units = body["units"]
    assert body["enrolled"] is True and body["kp_path"] == []
    assert [u["unit_id"] for u in units] == [f"kp:{first}", f"kp:{second}"]
    assert [u["kp_id"] for u in units] == [first, second]
    assert units[0]["title"] == "确界原理" and units[0]["summary"] == "确界原理的叙述"
    assert units[0]["parent_id"] == f"kp:{chapter['kp_id']}"  # 节层不下显：归属折叠到所属章
    assert units[0]["chapter_kp_id"] == chapter["kp_id"]
    assert units[0]["learner"] is None  # 未落笔＝无 kp 行
    assert units[0]["window_source"] == "chapter"  # 知识点自身无页范围 → 整章页窗兜底
    assert units[0]["source_ref"]["ref_id"] == "mathanalysis-b05"
    assert units[0]["source_ref"]["page_start"] == 21 and units[0]["source_ref"]["page_end"] == 30

    chapters = body["chapters"]
    assert [c["unit_id"] for c in chapters] == [f"kp:{chapter['kp_id']}"]
    assert chapters[0]["name"] == "第一章 实数"
    assert chapters[0]["point_count"] == 2

    assert client.app.state.learn_store.kp_rows() == {}


def test_point_projection_falls_back_to_anchor_pages(monkeypatch):
    """三级回落第二档：知识点自带锚点页优先于所属章页窗，ref 取锚点自己的书。"""
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(
        client, "区间套定理", parent=chapter["kp_id"],
        anchors=[{"kind": "book", "ref_id": "mathanalysis-b07", "page": 88}],
    )
    unit = _sequence(client, course_id)["units"][0]
    assert unit["window_source"] == "anchor"
    assert unit["source_ref"]["ref_id"] == "mathanalysis-b07"
    assert unit["source_ref"]["page_start"] == unit["source_ref"]["page_end"] == 88
    assert unit["unit_id"] == f"kp:{kp_id}"


def test_point_projection_orders_by_chapter_sequence_then_hint(monkeypatch):
    """序＝章序（order_hint 在前、其余按创建序）× 章内同口径；未归档池不进推进序列。"""
    client, course_id, rows = _study_client(
        monkeypatch,
        outline=[
            {"name": "第一章 实数", "page_start": 21, "page_end": 30},
            {"name": "第二章 极限", "page_start": 31, "page_end": 40},
        ],
    )
    ch1 = _outline_row(rows, "第一章 实数")
    ch2 = _outline_row(rows, "第二章 极限")
    _confirm_point(client, "未归档点")  # parent_kp_id NULL＝未归档池
    _confirm_point(client, "章二后学", parent=ch2["kp_id"], order_hint=2)
    _confirm_point(client, "章二先学", parent=ch2["kp_id"], order_hint=1)
    _confirm_point(client, "章一无序甲", parent=ch1["kp_id"])
    _confirm_point(client, "章一有号", parent=ch1["kp_id"], order_hint=9)
    _confirm_point(client, "章一无序乙", parent=ch1["kp_id"])

    body = client.get(f"/api/v1/learn/courses/{course_id}/knowledge-points").json()
    units = body["sequence"]["units"]
    assert [u["title"] for u in units] == [
        "章一有号",
        "章一无序甲",
        "章一无序乙",
        "章二先学",
        "章二后学",
    ]
    assert [u["sort_order"] for u in units] == sorted(u["sort_order"] for u in units)
    assert "未归档点" not in {u["title"] for u in units}
    assert body["total"] == 6  # 主数据面照出未归档池，只有推进序列排除它


def test_kp_path_reorders_the_projection_sequence(monkeypatch):
    """`kp_path`＝学习者给定的顺序：列入者按其序，未列入者按默认序垫尾。"""
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    first = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    second = _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])
    assert client.patch(
        f"/api/v1/learn/courses/{course_id}", json={"kp_path": [second]}
    ).status_code == 200

    body = _sequence(client, course_id)
    assert body["kp_path"] == [second]
    assert [u["kp_id"] for u in body["units"]] == [second, first]
    assert [u["sort_order"] for u in body["units"]] == [0, 1]


def test_progress_writes_kp_row_and_counts_points(monkeypatch):
    """勾选落笔＝写 kp 行终态位（首笔起行、重复幂等）；进度与结课态一律读时重算。"""
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    first = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    second = _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])
    units = _sequence(client, course_id)["units"]

    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert (prog["total"], prog["done"], prog["percent"]) == (2, 0, 0.0)
    assert prog["current_unit_id"] == units[0]["unit_id"]

    posted = client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"kp_id": first, "status": "done"}
    )
    assert posted.status_code == 200, posted.text
    assert posted.json()["status"] == "done"
    assert posted.json()["derived"]["done"] == 1 and posted.json()["derived"]["percent"] == 50.0

    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"kp_id": first, "status": "done"}
    ).status_code == 200
    store = client.app.state.learn_store
    assert set(store.kp_rows()) == {first}  # 重复勾选不起第二行
    assert _sequence(client, course_id)["units"][0]["learner"]["status"] == "done"

    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"kp_id": second, "status": "skipped"}
    ).status_code == 200
    final = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert final["skipped"] == 1 and final["completed"] is True and final["percent"] == 50.0
    assert final["current_unit_id"] is None

    revoked = client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"kp_id": second, "status": "pending"}
    )
    assert revoked.json()["removed"] is True and revoked.json()["derived"]["completed"] is False
    assert set(store.kp_rows()) == {first}


def test_progress_body_requires_kp_id_and_rejects_retired_names(monkeypatch):
    """入参闭集：`unit_id` 随单元树退役（extra=forbid → 422）；目标与课程不存在分别 404。"""
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    url = f"/api/v1/learn/courses/{course_id}/progress"
    assert client.post(url, json={"unit_id": f"kp:{kp_id}", "status": "done"}).status_code == 422
    assert client.post(url, json={"kp_id": kp_id}).status_code == 422
    assert client.post(url, json={"kp_id": kp_id, "status": "bogus"}).status_code == 422
    assert client.post(url, json={"kp_id": "kp-missing", "status": "done"}).status_code == 404
    assert client.post(
        "/api/v1/learn/courses/lc-missing/progress", json={"kp_id": kp_id, "status": "done"}
    ).status_code == 404
    assert client.app.state.learn_store.kp_rows() == {}


def test_progress_note_lands_on_the_learner_note_column(monkeypatch):
    """备注随勾选落 kp 行 `learner_note`（人工位，R6）；整行被撤销时备注随行作废。"""
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    posted = client.post(
        f"/api/v1/learn/courses/{course_id}/progress",
        json={"kp_id": kp_id, "status": "done", "note": "课本 p21 的定义更清楚"},
    )
    assert posted.status_code == 200, posted.text
    assert posted.json()["learner_note"] == "课本 p21 的定义更清楚"
    assert _sequence(client, course_id)["units"][0]["learner"]["learner_note"] == "课本 p21 的定义更清楚"
    revoked = client.post(
        f"/api/v1/learn/courses/{course_id}/progress",
        json={"kp_id": kp_id, "status": "pending", "note": "不该留下新行"},
    )
    assert revoked.json()["removed"] is True
    assert client.app.state.learn_store.kp_rows() == {}
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress",
        json={"kp_id": kp_id, "status": "done", "note": "n" * 2001},
    ).status_code == 422


def test_derived_status_and_books_count_knowledge_points(monkeypatch):
    """派生态三态与教材级进度同一口径（计数单位＝投影知识点行 × kp 行，读时重算）。"""
    client = _sync_client(monkeypatch, knowledge_store=InMemoryKnowledgeStore())
    client.post("/api/v1/learn/courses/sync")
    course_id = _courses_by_id(client)[STUDY_COURSE]["learn_course_id"]
    b05 = client.put(
        f"/api/v1/learn/courses/{STUDY_COURSE}/outline",
        json={"book_ref": "mathanalysis-b05", "tree": [{"name": "第一章 实数", "page_start": 21, "page_end": 30}]},
    ).json()["outline"]
    chapter = b05[0]
    first = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"kp_id": first, "status": "done"}
    ).status_code == 200

    target = _courses_by_id(client)[course_id]
    assert target["unit_count"] == 2
    assert target["derived"]["status"] == "learning"
    assert target["derived"]["total"] == 2 and target["derived"]["done"] == 1
    books = {b["ref_id"]: b for b in target["derived"]["books"]}
    assert books["mathanalysis-b05"]["total"] == 2
    assert books["mathanalysis-b05"]["done"] == 1
    assert books["mathanalysis-b05"]["percent"] == 50.0
    assert books["mathanalysis-b05"]["label"] == "数学分析（第5版）上册"
    assert books["mathanalysis-b07"]["total"] == 0
    assert books["mathanalysis-b07"]["percent"] == 0.0
    assert "mathanalysis-b09" not in books


# ---------- W1：learn 域存储懒挂载（消 503；判例 DEFECT-009） ----------


def _lazy_learn_client(monkeypatch, ensure_tables):
    """构造「未注入 learn_store + 已配置库密码」的进程态：只替建表与存储类，不触真实 MySQL。"""
    from qed_engine.clients import tracker_client
    from qed_engine.services.learn import base as learn_base

    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_PASSWORD", "test-pw")
    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", lambda self: [])
    monkeypatch.setattr("qed_engine.api.main._startup_db_check", lambda settings: "mocked")
    monkeypatch.setattr(learn_base, "ensure_tables", ensure_tables)
    monkeypatch.setattr(learn_base, "MySQLLearnStore", lambda settings: InMemoryLearnStore())
    return TestClient(create_app())


def test_learn_courses_mount_store_on_first_request(monkeypatch):
    """首个 /learn/courses 请求幂等建表并挂载，503 消除且只建一次。"""
    calls: list[object] = []
    client = _lazy_learn_client(monkeypatch, lambda settings: calls.append(settings))

    assert client.get("/api/v1/learn/courses").status_code == 200
    assert len(calls) == 1

    assert client.post("/api/v1/learn/courses", json=COURSE_BODY).status_code == 200
    courses = client.get("/api/v1/learn/courses").json()["courses"]
    assert courses[0]["name"] == STUDY_COURSE  # 目录不可达时名称回落 course_id
    assert len(calls) == 1  # 挂载后不重复建表


def test_learn_store_mount_retries_after_transient_db_failure(monkeypatch):
    """DEFECT-009 同根：建表失败只锁短窗口，MySQL 恢复后不重启进程即自愈。"""
    from qed_engine.api import learn as learn_api

    attempts = {"n": 0}

    def flaky(settings):
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise OSError("mock: database unreachable")

    client = _lazy_learn_client(monkeypatch, flaky)
    clock = {"t": 1000.0}
    monkeypatch.setattr(time, "monotonic", lambda: clock["t"])

    assert client.get("/api/v1/learn/courses").status_code == 503
    assert attempts["n"] == 1

    clock["t"] += learn_api.LEARN_MOUNT_RETRY_SECONDS / 2
    assert client.get("/api/v1/learn/courses").status_code == 503
    assert attempts["n"] == 1  # 窗口内不再打库

    clock["t"] += learn_api.LEARN_MOUNT_RETRY_SECONDS
    assert client.get("/api/v1/learn/courses").status_code == 200
    assert attempts["n"] == 2


def test_learn_store_mount_skipped_without_db_password(monkeypatch):
    """未配置库密码：不建表、直接 503 降级（启动与请求路径都不碰 MySQL）。"""
    from qed_engine.clients import tracker_client
    from qed_engine.services.learn import base as learn_base

    calls: list[object] = []
    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_PASSWORD", "")
    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", lambda self: [])
    monkeypatch.setattr("qed_engine.api.main._startup_db_check", lambda settings: "mocked")
    monkeypatch.setattr(learn_base, "ensure_tables", lambda settings: calls.append(settings))

    client = TestClient(create_app())
    assert calls == []  # 启动路径不建表
    assert client.get("/api/v1/learn/courses").status_code == 503
    assert calls == []  # 未配置密码不尝试建表


# ---------- REQ-117 W8：书架清单 v2（解析好即同步 + 教材级忽略位） ----------


def test_sync_creates_courses_from_parsed_books_with_official_names(monkeypatch):
    """解析好即同步：只读物化为 course 行，正名与领域取共享表，未解析/无归属者 PASS，二次幂等。"""
    client = _sync_client(monkeypatch)
    body = client.post("/api/v1/learn/courses/sync").json()
    assert body["created"] == ["linear_algebra", "math_analysis"]
    assert body["updated"] == []
    assert body["synced"] == 3

    courses = _courses_by_id(client)
    assert courses["math_analysis"]["name"] == "数学分析"
    assert courses["linear_algebra"]["name"] == "高等代数"
    assert courses["math_analysis"]["domain_id"] == "math-advanced"
    assert courses["math_analysis"]["track"] == "未归类"
    refs = [r["ref_id"] for r in courses["math_analysis"]["resources"]]
    assert refs == ["mathanalysis-b05", "mathanalysis-b07"]
    assert courses["math_analysis"]["resources"][0]["kind"] == "book"
    assert courses["math_analysis"]["resources"][0]["label"] == "数学分析（第5版）上册"

    again = client.post("/api/v1/learn/courses/sync").json()
    assert again["created"] == [] and again["updated"] == []
    assert len(client.get("/api/v1/learn/courses").json()["courses"]) == 2


def test_sync_unions_new_books_and_preserves_the_dismissed_bit(monkeypatch):
    """并集补入：新书只追加，不覆盖用户的教材级忽略位；名称归共享表（学习行不复制）。"""
    books = [dict(b) for b in SYNC_BOOKS]
    client = _sync_client(monkeypatch, books)
    client.post("/api/v1/learn/courses/sync")
    course_id = _courses_by_id(client)["math_analysis"]["learn_course_id"]

    assert client.patch(
        f"/api/v1/learn/courses/{course_id}",
        json={
            "resources": [
                {"kind": "book", "ref_id": "mathanalysis-b05", "label": "数学分析（第5版）上册"},
                {"kind": "book", "ref_id": "mathanalysis-b07", "label": "数学分析习题集", "dismissed": True},
            ],
        },
    ).status_code == 200

    books[2]["active_job_id"] = "job-09"  # b09 解析好了 → 刷新即应补入
    body = client.post("/api/v1/learn/courses/sync").json()
    assert body["created"] == []
    assert body["updated"] == ["math_analysis"]

    course = client.get(f"/api/v1/learn/courses/{course_id}").json()
    assert course["name"] == "数学分析"
    by_ref = {r["ref_id"]: r for r in course["resources"]}
    assert set(by_ref) == {"mathanalysis-b05", "mathanalysis-b07", "mathanalysis-b09"}
    assert by_ref["mathanalysis-b07"]["dismissed"] is True
    assert by_ref["mathanalysis-b09"]["dismissed"] is False


def test_sync_returns_503_when_axiom_offline_and_course_list_still_works(monkeypatch):
    """独立性铁律：8902 离线只让同步 503，书架读既有课程不受影响（学面不白屏）。"""
    client = _sync_client(monkeypatch, axiom_online=False)
    assert client.get("/api/v1/learn/courses").status_code == 200
    response = client.post("/api/v1/learn/courses/sync")
    assert response.status_code == 503
    assert "解析" in response.json()["detail"]


def test_catalog_offline_degrades_names_without_breaking_the_shelf(monkeypatch):
    """8901 不可达＝读面降级（名称回落 course_id），写面 sync 明确 503 不静默。"""
    _env(monkeypatch)
    monkeypatch.setattr(
        TrackerClient, "list_courses_system",
        lambda self: (_ for _ in ()).throw(httpx.ConnectError("tracker down")),
    )
    axiom = AxiomClient(base_url="http://axiom.test", transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json=list(SYNC_BOOKS))
    ))
    client = TestClient(create_app(
        learn_store=InMemoryLearnStore(),
        tracker_client=TrackerClient(base_url="http://tracker.test", transport=httpx.MockTransport(
            lambda request: (_ for _ in ()).throw(httpx.ConnectError("tracker down"))
        )),
        axiom_client=axiom,
    ))
    listed = client.get("/api/v1/learn/courses").json()
    assert listed["courses"] == []
    assert client.post("/api/v1/learn/courses", json=COURSE_BODY).status_code == 200
    course = client.get(f"/api/v1/learn/courses/{STUDY_COURSE}").json()
    assert course["name"] == STUDY_COURSE
    assert course["domain_id"] == "" and course["track"] == "未归类"
    sync = client.post("/api/v1/learn/courses/sync")
    assert sync.status_code == 503 and "课程目录不可达" in sync.json()["detail"]


def test_patch_course_resources_persists_dismissed_and_rejects_bad_kind(client):
    """忽略位零 DDL：dismissed 落 `config.resources` 键，整列提交可持久；kind 闭集仍守。"""
    course_id = _make_course(client)
    patched = client.patch(
        f"/api/v1/learn/courses/{course_id}",
        json={"resources": [{"kind": "book", "ref_id": "mathanalysis-b05", "label": "数学分析原理", "dismissed": True}]},
    )
    assert patched.status_code == 200
    assert patched.json()["resources"][0]["dismissed"] is True
    reloaded = client.get(f"/api/v1/learn/courses/{course_id}").json()
    assert reloaded["resources"][0]["dismissed"] is True

    bad = client.patch(
        f"/api/v1/learn/courses/{course_id}",
        json={"resources": [{"kind": "pdf", "ref_id": "x", "label": "y"}]},
    )
    assert bad.status_code == 422
    assert client.patch(
        f"/api/v1/learn/courses/{course_id}", json={"resources": []}
    ).status_code == 409


def test_sync_returns_book_meta_with_intro_and_position(monkeypatch):
    """展示元数据（简介/面向对象）：af_books.knowledge_id 联接 qt_knowledge，随 sync 一次返回。"""
    client = _sync_client(monkeypatch)
    body = client.post("/api/v1/learn/courses/sync").json()
    meta = {b["ref_id"]: b for b in body["books"]}
    assert set(meta) == {"mathanalysis-b05", "mathanalysis-b07", "linearalgebra-b01"}
    assert meta["mathanalysis-b05"]["intro"] == "面向数学专业本科一年级的教材套"
    assert meta["mathanalysis-b05"]["position"] == "beginner"
    assert meta["mathanalysis-b05"]["position_label"] == "入门"
    assert meta["mathanalysis-b05"]["page_count"] == 317
    assert meta["linearalgebra-b01"]["position_label"] == "深入"


def test_sync_degrades_when_knowledge_unreachable(monkeypatch):
    """8901 教程套读不到不阻断同步：展示字段留空，课程行照常物化。"""
    client = _sync_client(monkeypatch, knowledge_online=False)
    body = client.post("/api/v1/learn/courses/sync")
    assert body.status_code == 200
    assert body.json()["created"] == ["linear_algebra", "math_analysis"]
    meta = {b["ref_id"]: b for b in body.json()["books"]}
    assert meta["mathanalysis-b05"]["intro"] == ""
    assert meta["mathanalysis-b05"]["position"] == ""


# ---------- W9：注解面与按需生成腿（§V2.11 一端点，D10 改道主表） ----------

ANNOTATION_TEXT = "设 S 是非空有上界的数集，则 S 必有上确界。"
GEN = "/api/v1/learn/annotations/generate"


def _annotation_pages():
    """默认取材面：b05 第 21~30 页（＝DEFAULT_OUTLINE 的整章页窗）各有正文块。"""
    return {
        f"mathanalysis-b05:{page}": {"blocks": [{"type": "text", "text": ANNOTATION_TEXT}]}
        for page in range(21, 31)
    }


def _annotation_client(
    monkeypatch, *, pages=None, reply="这是生成结果。", success=True, error="", clock=None
):
    """注解用例场：学习课程＋目录＋已确认知识点＋书页可读同场，文字网关打桩（默认测试不调模型）。"""
    from qed_engine.services.learn import annotations

    store = InMemoryKnowledgeStore()
    client, course_id, rows = _study_client(
        monkeypatch, pages=_annotation_pages() if pages is None else pages, knowledge_store=store
    )
    kp_id = _confirm_point(client, "确界原理", parent=_outline_row(rows, "1.1 实数的完备性")["kp_id"])
    calls: list[dict] = []
    replies = reply if isinstance(reply, list) else [reply]

    def _fake_call_text(settings, **kwargs):
        calls.append(kwargs)
        return {
            "reply": replies[min(len(calls) - 1, len(replies) - 1)],
            "call_id": "call-1",
            "success": success,
            "error": "" if success else error,
        }

    annotations.clear_throttle()
    monkeypatch.setattr(annotations, "call_text", _fake_call_text)
    if clock is not None:
        monkeypatch.setattr(annotations, "monotonic", lambda: clock[0])
    return client, course_id, rows, store, kp_id, calls


def _generate(client, body):
    return client.post(GEN, json=body)


def test_generate_chapter_summary_persists_on_chapter_row(monkeypatch):
    """章级总结＝覆写章行 `summary`（成品位单一），随 knowledge-points 的 chapters 一次直读。"""
    reply = "本章从实数的完备性出发，串起确界原理与单调有界原理的等价链条。"
    client, course_id, rows, store, _kp, calls = _annotation_client(monkeypatch, reply=reply)
    chapter = _outline_row(rows, "第一章 实数")
    resp = _generate(
        client,
        {"course_id": course_id, "target_kind": "chapter", "kp_id": chapter["kp_id"], "part": "summary"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["chapter"] == {"kp_id": chapter["kp_id"], "summary": reply, "key_points": []}
    assert store.get_point(chapter["kp_id"])["summary"] == reply
    assert len(calls) == 1
    assert calls[0]["max_tokens"] > 0
    assert ANNOTATION_TEXT in calls[0]["prompt"]  # 取材正文进 prompt（前端不拼 prompt）
    assert chapter["name"] in calls[0]["prompt"]
    assert _sequence(client, course_id)["chapters"][0]["summary"] == reply


def test_generate_chapter_key_points_overwrites_meta_slot(monkeypatch):
    """章级学习要点＝章行扩展槽 meta.chapter_key_points（零 DDL）；重复生成覆写不并存。"""
    clock = [0.0]
    client, course_id, rows, store, _kp, calls = _annotation_client(
        monkeypatch,
        reply=["一、确界原理是完备性的表述\n二、单调有界数列必收敛\n- 区间套定理：闭集套交非空", "唯一要点"],
        clock=clock,  # 假钟：越出 60s 节流窗，才看得见第二次真生成
    )
    chapter = _outline_row(rows, "第一章 实数")
    body = {
        "course_id": course_id,
        "target_kind": "chapter",
        "kp_id": chapter["kp_id"],
        "part": "key_points",
    }
    first = _generate(client, body)
    assert first.status_code == 200, first.text
    assert first.json()["chapter"]["key_points"] == [
        "确界原理是完备性的表述",
        "单调有界数列必收敛",
        "区间套定理：闭集套交非空",
    ]
    assert store.get_point(chapter["kp_id"])["meta"]["chapter_key_points"] == [
        "确界原理是完备性的表述",
        "单调有界数列必收敛",
        "区间套定理：闭集套交非空",
    ]
    clock[0] = 61.0
    second = _generate(client, body)
    assert second.json()["chapter"]["key_points"] == ["唯一要点"]
    assert store.get_point(chapter["kp_id"])["meta"]["chapter_key_points"] == ["唯一要点"]
    assert _sequence(client, course_id)["chapters"][0]["key_points"] == ["唯一要点"]
    assert len(calls) == 2


def test_generate_point_annotation_appends_angle_note(monkeypatch):
    """条级注解＝主表 `angles` 追加/覆写同角 note（候选池退役后的新落点，D10）；主表其余列不动。"""
    client, course_id, _rows, store, kp_id, _calls = _annotation_client(
        monkeypatch, reply=["第一版注解。", "第二版注解。"]
    )
    before = store.get_point(kp_id)
    body = {"course_id": course_id, "target_kind": "point", "kp_id": kp_id, "part": "annotation"}
    resp = _generate(client, body)
    assert resp.status_code == 200, resp.text
    point = resp.json()["point"]
    assert point["kp_id"] == kp_id and point["name"] == "确界原理"
    assert point["angles"] == [{"angle": "explanation", "note": "第一版注解。"}]
    assert point["summary"] == before["summary"]
    again = _generate(client, body)
    assert again.status_code == 200, again.text
    assert again.json()["point"]["angles"] == [{"angle": "explanation", "note": "第二版注解。"}]
    stored = store.get_point(kp_id)
    assert len(stored["angles"]) == 1  # 同角不堆叠：数组序＝权威序，一形态只留最新成品
    assert stored["summary"] == before["summary"] and stored["name"] == before["name"]
    assert stored["narrative_ref"] == before["narrative_ref"]  # 长文指针只由人工登记腿改


def test_chapter_generate_throttles_within_window_and_point_always_regenerates(monkeypatch):
    """章级 60s 内重复＝回上次成品（不重烧模型）；条级不去重（每次真生成，同角覆写成品）。"""
    client, course_id, rows, store, kp_id, calls = _annotation_client(
        monkeypatch, reply=["章总结。", "条注解一。", "条注解二。"]
    )
    chapter = _outline_row(rows, "第一章 实数")
    chapter_body = {
        "course_id": course_id,
        "target_kind": "chapter",
        "kp_id": chapter["kp_id"],
        "part": "summary",
    }
    first = _generate(client, chapter_body)
    cached = _generate(client, chapter_body)
    assert cached.status_code == 200
    assert cached.json() == first.json()
    assert len(calls) == 1
    point_body = {"course_id": course_id, "target_kind": "point", "kp_id": kp_id, "part": "annotation"}
    assert _generate(client, point_body).status_code == 200
    assert _generate(client, point_body).status_code == 200
    assert len(calls) == 3
    assert store.get_point(kp_id)["angles"] == [{"angle": "explanation", "note": "条注解二。"}]


def test_generate_without_readable_pages_returns_503_and_calls_nothing(monkeypatch):
    """正文零可用页＝503 且给下一步；话术不得出现后台口径词；不烧模型、不落库。"""
    client, course_id, rows, store, _kp, calls = _annotation_client(monkeypatch, pages={})
    chapter = _outline_row(rows, "第一章 实数")
    resp = _generate(
        client,
        {"course_id": course_id, "target_kind": "chapter", "kp_id": chapter["kp_id"], "part": "summary"},
    )
    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert "还没准备好" in detail
    for banned in ("LLM", "服务", "离线", "解析", "链路", "网关", "模型"):
        assert banned not in detail
    assert calls == []
    assert (store.get_point(chapter["kp_id"])["summary"] or "") == ""


def test_generate_upstream_failure_returns_502_without_writing(monkeypatch):
    """上游失败＝502 且给「可以再点一次」；失败批次不写章行、不追加 angles。"""
    client, course_id, rows, store, kp_id, calls = _annotation_client(
        monkeypatch, success=False, error="请求超时"
    )
    chapter = _outline_row(rows, "第一章 实数")
    bad = _generate(
        client,
        {"course_id": course_id, "target_kind": "chapter", "kp_id": chapter["kp_id"], "part": "summary"},
    )
    assert bad.status_code == 502
    assert "生成没能完成" in bad.json()["detail"] and "请求超时" in bad.json()["detail"]
    assert len(calls) == 1
    assert (store.get_point(chapter["kp_id"])["summary"] or "") == ""
    point_bad = _generate(
        client,
        {"course_id": course_id, "target_kind": "point", "kp_id": kp_id, "part": "annotation"},
    )
    assert point_bad.status_code == 502
    assert store.get_point(kp_id)["angles"] == []


def test_generate_rejects_bad_combinations_and_unknown_targets(monkeypatch):
    """组合闭集：章＝summary/key_points、条＝annotation；其余 422。目标不存在＝404，零调用。"""
    client, course_id, rows, _store, kp_id, calls = _annotation_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    assert _generate(
        client, {"course_id": course_id, "target_kind": "point", "kp_id": chapter["kp_id"], "part": "key_points"}
    ).status_code == 422
    assert _generate(
        client, {"course_id": course_id, "target_kind": "chapter", "kp_id": chapter["kp_id"], "part": "annotation"}
    ).status_code == 422
    assert _generate(
        client, {"course_id": course_id, "target_kind": "chapter", "kp_id": chapter["kp_id"], "part": "poem"}
    ).status_code == 422
    assert _generate(
        client, {"course_id": course_id, "target_kind": "chapter", "kp_id": "kp-nope", "part": "summary"}
    ).status_code == 404
    assert _generate(
        client, {"course_id": "lc-nope", "target_kind": "chapter", "kp_id": chapter["kp_id"], "part": "summary"}
    ).status_code == 404
    assert _generate(client, {"course_id": course_id, "target_kind": "chapter", "part": "summary"}).status_code == 422
    assert calls == []


def test_generate_returns_503_when_knowledge_table_unreachable(client):
    """知识点主表不可达＝503 降级话术，学习面其余功能不受影响（独立性铁律）。"""
    course_id = _make_course(client)
    resp = _generate(
        client, {"course_id": course_id, "target_kind": "chapter", "kp_id": "kp-1", "part": "summary"}
    )
    assert resp.status_code == 503
    assert "还没准备好" in resp.json()["detail"]


def test_course_surfaces_stay_readable_without_the_knowledge_leg(monkeypatch):
    """知识点腿不可达（未注入主表）＝课程面出空序列而不是 503：投影只是读侧便利。"""
    client = _sync_client(monkeypatch)  # knowledge_store=None
    client.post("/api/v1/learn/courses/sync")
    course = client.get(f"/api/v1/learn/courses/{STUDY_COURSE}").json()
    assert course["unit_count"] == 0 and course["derived"]["total"] == 0
    assert course["derived"]["status"] == "draft"
    body = client.get(f"/api/v1/learn/courses/{STUDY_COURSE}/knowledge-points")
    assert body.status_code == 503  # 主数据面自己才要 503


# ---------- 主链 M-3 W3：门态端点 · 质性判定端点 · progress 扩字段 ----------


def _attach_point_questions(client, kp_id, *, kp_type="procedure", count=1):
    """给知识点接题源（练习域 course_id＝同一枚共享课程坐标）：返回题面 ID 列表。"""
    items = [
        {
            "stem": f"门态用例 {kp_id} 第 {index} 题：求极限 lim(x→0) sin x / x。",
            "kind": "quiz",
            "question_type": "choice",
            "options": [
                {"label": "A", "body": "0"},
                {"label": "B", "body": "1"},
                {"label": "C", "body": "无穷大"},
                {"label": "D", "body": "不存在"},
            ],
            "expected_answer": "B",
            "answer_source": "same_page",
            "source_kind": "manual",
            "difficulty": "easy",
            "kp_type": kp_type,
            "kp_id": kp_id,
        }
        for index in range(count)
    ]
    response = client.post(
        "/api/v1/learn/questions",
        json={"course_id": STUDY_COURSE, "gen_batch": "m3-w3", "model_ref": "case", "questions": items},
    )
    assert response.status_code == 200, response.text
    return [row["question_id"] for row in response.json()["questions"]]


def _answer_correctly(client, question_id, *, times=3):
    """同题按日错开作答（唯一键含 review_date）：喂给近因加权窗口的正确序列。"""
    for index in range(times):
        response = client.post(
            "/api/v1/learn/attempts",
            json={
                "question_id": question_id,
                "user_answer": "B",
                "origin": "new",
                "review_date": f"2026-10-{10 + index:02d}T09:00:00",
            },
        )
        assert response.status_code == 200, response.text


def test_mastery_lists_gate_states_and_degrades_without_practice(monkeypatch):
    """门态清单＝投影知识点行逐条给门；练习腿不可达按零作答派生，不给降级旁路也不 503（D-M3-4）。"""
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    first = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    second = _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])

    body = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()
    assert [item["unit_id"] for item in body["items"]] == [f"kp:{first}", f"kp:{second}"]
    item = body["items"][0]
    assert set(item) == MASTERY_ITEM_FIELDS
    assert item["kp_id"] == first and item["kp_type"] == "concept"
    assert item["gate"] == "qualitative" and item["threshold"] == 1.0
    assert item["mastery"] == 0.0 and item["attempt_count"] == 0
    assert item["provenance"] == "" and item["status"] == "new"
    assert item["qualitative_passed"] is None and item["due_reviews"] == 0
    assert body["summary"] == {"total": 2, "mastered": 0, "learning": 0, "new": 2}
    assert body["next_step"]["action"] == "probe"
    assert body["next_step"]["unit_id"] == f"kp:{first}"

    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["mastered"] == 0
    assert prog["provenance"] == {"system": 0, "learner": 0}
    assert prog["current_unit_id"] == f"kp:{first}" and prog["next_unit_id"] == f"kp:{first}"


def test_mastery_endpoints_report_unknown_course_and_unmounted_store(monkeypatch):
    client = _sync_client(monkeypatch)
    assert client.get("/api/v1/learn/courses/lc-missing/mastery").status_code == 404
    assert client.post(
        "/api/v1/learn/courses/lc-missing/mastery/assess", json={"kp_id": "kp-x", "passed": True}
    ).status_code == 404

    _env(monkeypatch)
    from qed_engine.clients import tracker_client
    from qed_engine.services.learn import base as learn_base
    from qed_engine.services.learn import practice as practice_base

    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", lambda self: [])
    monkeypatch.setattr("qed_engine.api.main._startup_db_check", lambda settings: "mocked")
    monkeypatch.setattr(learn_base, "ensure_tables", lambda settings: None)
    monkeypatch.setattr(practice_base, "ensure_tables", lambda settings: None)
    offline = TestClient(create_app())
    assert offline.get("/api/v1/learn/courses/lc-1/mastery").status_code == 503
    assert offline.post(
        "/api/v1/learn/courses/lc-1/mastery/assess", json={"kp_id": "kp-1", "passed": True}
    ).status_code == 503


def test_qualitative_assess_records_learner_provenance_and_moves_cursor(monkeypatch):
    """D-M3-2 自评位过门＝learner provenance：门态即时派生，勾选位与 done 计数不受判定影响。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    first = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    second = _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])

    posted = client.post(
        f"/api/v1/learn/courses/{course_id}/mastery/assess",
        json={"kp_id": first, "passed": True, "note": "能用自己的话说清 ε-δ"},
    )
    assert posted.status_code == 200, posted.text
    item = posted.json()["item"]
    assert set(item) == MASTERY_ITEM_FIELDS
    assert item["status"] == "mastered" and item["provenance"] == "learner"
    assert item["qualitative_passed"] is True
    assert item["mastery"] == 1.0
    assert "owner" not in posted.json()["kp_row"]
    assert posted.json()["next_step"]["action"] == "probe"
    assert posted.json()["next_step"]["unit_id"] == f"kp:{second}"

    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["done"] == 0 and prog["percent"] == 0.0
    assert prog["mastered"] == 1
    assert prog["provenance"] == {"system": 0, "learner": 1}
    assert prog["current_unit_id"] == f"kp:{second}"
    states = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()["items"]
    assert states[0]["provenance"] == "learner" and states[1]["status"] == "new"
    assert states[0]["qualitative_passed"] is True  # 判定四列经投影读回


def test_assess_refuses_quantitative_gate_point(monkeypatch):
    """量化型不接受质性判定（409），且不留判定行（kp 行只在受理后起）。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "极限运算法则", parent=chapter["kp_id"], point_type="procedure")

    response = client.post(
        f"/api/v1/learn/courses/{course_id}/mastery/assess",
        json={"kp_id": kp_id, "passed": True, "note": "自评讲清了"},
    )
    assert response.status_code == 409, response.text
    assert "量化门" in response.json()["detail"]
    item = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()["items"][0]
    assert item["gate"] == "quantitative" and item["threshold"] == 0.9
    assert item["qualitative_passed"] is None and item["status"] == "new"
    assert client.app.state.learn_store.kp_rows() == {}


def test_assess_validates_body_and_targets(monkeypatch):
    """判定入参闭集：缺 passed／类型错／by=model／超长 note／白名单外键＝422；未知目标＝404。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    url = f"/api/v1/learn/courses/{course_id}/mastery/assess"
    assert client.post(url, json={"kp_id": kp_id}).status_code == 422
    assert client.post(url, json={"kp_id": kp_id, "passed": "讲清了"}).status_code == 422
    assert client.post(url, json={"kp_id": kp_id, "passed": True, "by": "model"}).status_code == 422
    assert client.post(url, json={"kp_id": kp_id, "passed": True, "note": "n" * 1001}).status_code == 422
    assert client.post(url, json={"unit_id": kp_id, "passed": True}).status_code == 422
    assert client.post(url, json={"kp_id": "kp-missing", "passed": True}).status_code == 404


def test_attempt_sequence_over_gate_sets_system_provenance(monkeypatch):
    """量化门过门＝system provenance：勾选一位未动，游标已由门推进（门就是游标，D-M3-1）。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    drilled = _confirm_point(client, "极值判别法", parent=chapter["kp_id"], point_type="procedure")
    untouched = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    question_id = _attach_point_questions(client, drilled, kp_type="procedure")[0]
    _answer_correctly(client, question_id, times=3)

    states = {item["kp_id"]: item for item in client.get(
        f"/api/v1/learn/courses/{course_id}/mastery").json()["items"]}
    assert states[drilled]["attempt_count"] == 3
    assert states[drilled]["gate"] == "quantitative" and states[drilled]["threshold"] == 0.9
    assert states[drilled]["mastery"] == 1.0
    assert states[drilled]["provenance"] == "system" and states[drilled]["status"] == "mastered"
    assert states[untouched]["status"] == "new"
    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["done"] == 0 and prog["mastered"] == 1
    assert prog["provenance"] == {"system": 1, "learner": 0}
    assert prog["current_unit_id"] == f"kp:{untouched}"
    # 门过≠勾选：判分不写 kp 行（kp 行只承载人工落笔的终态位与质性判定）
    assert client.app.state.learn_store.kp_rows() == {}
    assert all(u["learner"] is None for u in _sequence(client, course_id)["units"])


def test_single_correct_answer_does_not_clear_the_gate(monkeypatch):
    """防蒙对铁律：单次答对被置信上限钳到 0.5，量化门 0.9 不过，只进 learning。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "极值判别法", parent=chapter["kp_id"], point_type="procedure")
    question_id = _attach_point_questions(client, kp_id, kp_type="procedure")[0]

    before = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()["items"][0]
    assert before["due_reviews"] == 1  # D3：未作答的题按入库时刻即到期（流水重放）
    _answer_correctly(client, question_id, times=1)

    item = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()["items"][0]
    assert item["attempt_count"] == 1 and item["mastery"] == 0.5
    assert item["provenance"] == "" and item["status"] == "learning"
    assert "mastered" not in item  # 响应只出冻结字段清单，掌握位由 status 承载
    assert item["due_reviews"] == 0  # procedure 序列答对进档（+3→+7 天），当日不再到期


def test_due_review_pulls_next_step_before_the_cursor(monkeypatch):
    """到期复习优先于推进：游标停在第一个未掌握行，next_step 先把它拽回去复习。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    drilled = _confirm_point(client, "极值判别法", parent=chapter["kp_id"], point_type="procedure")
    later = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    drilled_q, still_due = _attach_point_questions(client, drilled, kp_type="procedure", count=2)
    _answer_correctly(client, drilled_q, times=1)
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"kp_id": drilled, "status": "done"}
    ).status_code == 200
    assert still_due  # 第二题未作答＝仍有到期腿

    body = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()
    assert body["items"][0]["due_reviews"] == 1
    assert body["items"][0]["provenance"] == "learner"
    assert body["next_step"]["action"] == "review"
    assert body["next_step"]["unit_id"] == f"kp:{drilled}"
    assert body["next_step"]["kp_id"] == drilled

    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["current_unit_id"] == f"kp:{later}" and prog["next_unit_id"] == f"kp:{drilled}"


def test_skipped_rows_do_not_stop_the_gate_cursor(monkeypatch):
    """跳过＝学习者显式让位：不进门（未掌握），也不停游标。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    skipped = _confirm_point(client, "已跳过点", parent=chapter["kp_id"])
    pending = _confirm_point(client, "待学点", parent=chapter["kp_id"])
    for kp_id, status in ((skipped, "skipped"), (pending, "pending")):
        assert client.post(
            f"/api/v1/learn/courses/{course_id}/progress", json={"kp_id": kp_id, "status": status}
        ).status_code == 200
    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["skipped"] == 1 and prog["mastered"] == 0
    assert prog["current_unit_id"] == f"kp:{pending}"
