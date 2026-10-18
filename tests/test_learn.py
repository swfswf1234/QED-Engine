"""学习域（/api/v1/learn/*）契约测试：M-1 三表语义 + 9 端点 + M-3 门两端点 + 错误码清单。

模块职责：守护学习设计轮主链 M-1/M-2 冻结契约（课程注册 kind 闭集与限长、单元树两级、
covered 学习者独占、编译状态机与两级确认门、派生进度只读）、主链 M-3 的知识点门态清单、质性门自评位（量化型 409 拒绝）与门游标扩字段。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/api/learn.py、backend/qed_engine/services/learn/
失效后果：学习域契约漂移，M1/M2 模块按错误形状联调
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

COURSE_BODY = {
    "name": "数学分析",
    "domain_ref": {"ref_id": "math-advanced", "label": "数学（高等数学）"},
    "course_ref": {"ref_id": "ma-course-01", "label": "数学分析"},
    "direction": "教材主线",
    "resources": [
        {"kind": "book", "ref_id": "mathanalysis-b05", "label": "数学分析原理"},
        {"kind": "af_version", "ref_id": "mathanalysis-b05", "label": "b05 生效版本"},
        {"kind": "knowledge", "ref_id": "k-001", "label": "教程套一"},
    ],
}

# 合法最深形态（section→unit→block 三级）；四级树在守卫测试内单独构造
VALID_TREE = [
    {
        "title": "第一章",
        "children": [
            {"title": "1.1 实数", "children": [{"title": "正文"}, {"title": "测验"}]},
            {"title": "1.2 序列", "children": [{"title": "正文"}]},
        ],
    }
]


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
    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_HOST", "127.0.0.1")
    monkeypatch.setenv("QED_DB_PORT", "3306")
    monkeypatch.setenv("QED_DB_NAME", "qed_test")
    monkeypatch.setenv("QED_DB_USER", "root")
    monkeypatch.setenv("QED_DB_PASSWORD", "")
    app = create_app(learn_store=InMemoryLearnStore())
    return TestClient(app)


@pytest.fixture()
def stall_compile(monkeypatch):
    """闸门：冻结骨架编译后台线程，制造确定的 running 窗口（在跑禁删 409 用）。"""
    import threading

    gate = threading.Event()
    store_cls = InMemoryLearnStore
    original = store_cls.finish_compile

    def _stalled(self, course_id):
        assert gate.wait(timeout=5), "测试未释放编译闸门"
        original(self, course_id)

    monkeypatch.setattr(store_cls, "finish_compile", _stalled)
    return gate


def _make_course(client) -> str:
    resp = client.post("/api/v1/learn/courses", json=COURSE_BODY)
    assert resp.status_code == 200, resp.text
    return resp.json()["learn_course_id"]


def _prepare_compilable(client, course_id: str) -> None:
    """propose → 写入合法两级树 → 逐级 confirmed（两级人工确认齐备）。"""
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/compile/propose",
        json={"page_windows": [{"start": 1, "end": 10}]},
    ).status_code == 200
    assert client.put(
        f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": VALID_TREE}
    ).status_code == 200
    units = client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"]
    for unit in units:
        assert client.patch(f"/api/v1/learn/units/{unit['unit_id']}", json={"confirmed": True}).status_code == 200


# ---------- 课程注册（表1 语义） ----------


def test_course_register_returns_id_and_defaults(client):
    course_id = _make_course(client)
    assert course_id
    detail = client.get(f"/api/v1/learn/courses/{course_id}").json()
    assert detail["compile_status"] is None
    assert detail["resources"][0]["kind"] == "book"
    assert detail["derived"]["status"] == "draft"
    assert client.get("/api/v1/learn/courses").json()["courses"][0]["learn_course_id"] == course_id


def test_course_register_rejects_unknown_kind(client):
    body = {**COURSE_BODY, "resources": [{"kind": "pdf", "ref_id": "x", "label": "y"}]}
    assert client.post("/api/v1/learn/courses", json=body).status_code == 422


def test_course_register_requires_resources(client):
    assert client.post("/api/v1/learn/courses", json={"name": "空素材"}).status_code == 422
    bad = {**COURSE_BODY, "resources": [{"kind": "book", "ref_id": "", "label": "l"}]}
    assert client.post("/api/v1/learn/courses", json=bad).status_code == 422


def test_channel_length_limit(client):
    body = {**COURSE_BODY, "instructions": "长" * 4001}
    assert client.post("/api/v1/learn/courses", json=body).status_code == 422
    course_id = _make_course(client)
    patch = client.patch(f"/api/v1/learn/courses/{course_id}", json={"agent_notes": "长" * 4001})
    assert patch.status_code == 422


def test_course_delete_and_404(client):
    course_id = _make_course(client)
    assert client.delete(f"/api/v1/learn/courses/{course_id}").status_code == 200
    assert client.get(f"/api/v1/learn/courses/{course_id}").status_code == 404
    assert client.patch(f"/api/v1/learn/courses/{course_id}", json={"name": "x"}).status_code == 404
    assert client.get("/api/v1/learn/units/nope").status_code == 404


def test_delete_blocked_while_compiling(client, stall_compile):
    course_id = _make_course(client)
    _prepare_compilable(client, course_id)
    assert client.post(f"/api/v1/learn/courses/{course_id}/compile/start").status_code == 202
    assert client.delete(f"/api/v1/learn/courses/{course_id}").status_code == 409
    stall_compile.set()


# ---------- 单元树（表2 语义） ----------


def test_propose_requires_page_windows(client):
    course_id = _make_course(client)
    assert client.post(f"/api/v1/learn/courses/{course_id}/compile/propose", json={}).status_code == 422
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/compile/propose", json={"page_windows": [{"start": 1}]}
    ).status_code == 422


def test_syllabus_rejects_over_three_level_tree(client):
    course_id = _make_course(client)
    client.post(f"/api/v1/learn/courses/{course_id}/compile/propose", json={"page_windows": [{"start": 1, "end": 5}]})
    four_level = [{"title": "章", "children": [{"title": "节", "children": [{"title": "块", "children": [{"title": "四级"}]}]}]}]
    assert client.put(
        f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": four_level}
    ).status_code == 422
    assert client.put(
        f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": [{"title": ""}]}
    ).status_code == 422
    assert client.put(
        f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": []}
    ).status_code == 422


def test_unit_patch_only_allowlist_fields(client):
    course_id = _make_course(client)
    client.post(f"/api/v1/learn/courses/{course_id}/compile/propose", json={"page_windows": [{"start": 1, "end": 5}]})
    assert client.put(
        f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": VALID_TREE}
    ).status_code == 200
    units = client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"]
    unit_id = units[-1]["unit_id"]
    assert client.patch(f"/api/v1/learn/units/{unit_id}", json={"payload": {}}).status_code == 422
    assert client.patch("/api/v1/learn/units/nope", json={"order": 5}).status_code == 404
    assert client.patch(f"/api/v1/learn/units/{unit_id}", json={"order": 5}).status_code == 200
    # covered 只能打在已 confirmed 的单元上（学习者勾选前提）
    assert client.get(f"/api/v1/learn/units/{unit_id}").json()["confirmed"] is False
    assert client.patch(f"/api/v1/learn/units/{unit_id}", json={"covered": True}).status_code == 409
    assert client.patch(f"/api/v1/learn/units/{unit_id}", json={"confirmed": False}).status_code == 200
    assert client.patch(f"/api/v1/learn/units/{unit_id}", json={"confirmed": True}).status_code == 200
    assert client.patch(f"/api/v1/learn/units/{unit_id}", json={"covered": True}).status_code == 200
    assert client.get(f"/api/v1/learn/units/{unit_id}").json()["covered"] is True


def test_units_level_filter_and_contract_fields(client):
    course_id = _make_course(client)
    _prepare_compilable(client, course_id)
    sections = client.get(f"/api/v1/learn/courses/{course_id}/units", params={"level": "section"}).json()["units"]
    assert len(sections) == 1
    both = client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"]
    assert {u["level"] for u in both} == {"section", "unit"}
    assert {"gen_status", "active", "confirmed", "covered", "type"} <= set(both[0])
    assert client.get("/api/v1/learn/courses/missing/units").status_code == 404
    # W5（§V2.3）：闭集扩为 section/unit/point——point 是读时投影，无知识点时给空态不报错
    point_rows = client.get(f"/api/v1/learn/courses/{course_id}/units", params={"level": "point"})
    assert point_rows.status_code == 200
    assert point_rows.json() == {"units": [], "chapters": []}
    assert client.get(
        f"/api/v1/learn/courses/{course_id}/units", params={"level": "bad"}
    ).status_code == 422


# ---------- 编译作业（D3：课程行自 carry） ----------


def test_compile_start_requires_two_level_confirmation(client):
    course_id = _make_course(client)
    assert client.post(f"/api/v1/learn/courses/{course_id}/compile/start").status_code == 409
    client.post(f"/api/v1/learn/courses/{course_id}/compile/propose", json={"page_windows": [{"start": 1, "end": 5}]})
    client.put(f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": VALID_TREE})
    # 有草稿树但未逐级 confirmed → 仍 409
    assert client.post(f"/api/v1/learn/courses/{course_id}/compile/start").status_code == 409


def test_compile_lifecycle_202_poll_and_units(client):
    course_id = _make_course(client)
    _prepare_compilable(client, course_id)
    assert client.post(f"/api/v1/learn/courses/{course_id}/compile/start").status_code == 202
    status = _await_compile(client, course_id)
    assert status["compile_status"] == "completed"
    assert status["done"] == status["total"] >= 3
    blocks = client.get(f"/api/v1/learn/courses/{course_id}/units", params={"level": "unit"}).json()["units"]
    assert blocks and all(b["gen_status"] == "generated" and b["active"] for b in blocks)
    assert blocks[0]["source_ref"]  # 块级溯源位存在


def _await_compile(client, course_id: str) -> dict:
    for _ in range(200):
        status = client.get(f"/api/v1/learn/courses/{course_id}/compile").json()
        if status["compile_status"] != "running":
            return status
        time.sleep(0.01)
    pytest.fail("compile 未收敛")


def test_compile_status_without_job_is_empty_state(client):
    course_id = _make_course(client)
    assert client.get(f"/api/v1/learn/courses/{course_id}/compile").json()["compile_status"] is None


# ---------- 派生进度（表3：只读、重算非累加） ----------


def test_progress_is_derived_and_readonly(client):
    """W5 口径：计数单位＝知识点行；旧 section/unit 行保留只读，不再承载进度。"""
    course_id = _make_course(client)
    _prepare_compilable(client, course_id)
    assert client.post(f"/api/v1/learn/courses/{course_id}/compile/start").status_code == 202
    _await_compile(client, course_id)
    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["total"] == 0 and prog["done"] == 0 and prog["percent"] == 0.0
    assert prog["current_unit_id"] is None
    # 编译计数仍按 unit 行（M-1 语义不动），与学习进度口径正交
    assert client.get(f"/api/v1/learn/courses/{course_id}/compile").json()["total"] >= 3
    unit_id = client.get(
        f"/api/v1/learn/courses/{course_id}/units", params={"level": "unit"}
    ).json()["units"][0]["unit_id"]
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": unit_id, "status": "done"}
    ).status_code == 409
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": "kp-missing", "status": "bogus"}
    ).status_code == 422
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": "kp-missing", "status": "done"}
    ).status_code == 404


# ---------- W5：推进单位＝知识点（§V2.3 读时投影 · 派生键 · 计数改口径） ----------

STUDY_COURSE = "math_analysis"  # 目录课程 ID（学习课程经 course_ref.ref_id 指向它）
DEFAULT_OUTLINE = [
    {
        "name": "第一章 实数",
        "page_start": 21,
        "page_end": 30,
        "children": [{"name": "1.1 实数的完备性", "page_start": 21, "page_end": 24}],
    }
]


def _study_client(
    monkeypatch,
    *,
    outline=None,
    book_ref="mathanalysis-b05",
    pages=None,
    knowledge_store=None,
    practice_store=None,
):
    """sync 出 math_analysis 学习课程 + 知识点两表同场，返回 (client, learn_course_id, outline 行)。"""
    client = _sync_client(
        monkeypatch,
        knowledge_store=knowledge_store or InMemoryKnowledgeStore(),
        pages=pages,
        practice_store=practice_store,
    )
    client.post("/api/v1/learn/courses/sync")
    course_id = _courses_by_ref(client)[STUDY_COURSE]["learn_course_id"]
    rows = client.put(
        f"/api/v1/learn/courses/{STUDY_COURSE}/outline",
        json={"book_ref": book_ref, "tree": outline or DEFAULT_OUTLINE},
    ).json()["outline"]
    return client, course_id, rows


def _outline_row(rows, name):
    return next(row for row in rows if row["name"] == name)


def _confirm_point(
    client, name, *, parent=None, anchors=None, order_hint=None, point_type="concept"
) -> str:
    """登记候选并人工确认提升（主表只存已确认行＝学习面唯一消费口径，C14）。"""
    body = {
        "course_id": STUDY_COURSE,
        "name": name,
        "narrative": f"{name}的叙述",
        "type": point_type,
        "anchors": anchors or [],
        "gen_batch": "w5-demo",
        "model_ref": "manual-demo",
    }
    if parent is not None:
        body["parent_kp_id"] = parent
    detail = client.post("/api/v1/learn/kp-details", json=body)
    assert detail.status_code == 200, detail.text
    confirmed = client.post(f"/api/v1/learn/kp-details/{detail.json()['detail_id']}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    kp_id = confirmed.json()["point"]["kp_id"]
    if order_hint is not None:
        patched = client.patch(f"/api/v1/learn/knowledge-points/{kp_id}", json={"order_hint": order_hint})
        assert patched.status_code == 200, patched.text
    return kp_id


def _point_units(client, course_id):
    return client.get(f"/api/v1/learn/courses/{course_id}/units", params={"level": "point"}).json()


def test_point_units_project_confirmed_points_without_writing(monkeypatch):
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    section = _outline_row(rows, "1.1 实数的完备性")
    first = _confirm_point(client, "确界原理", parent=section["kp_id"])
    second = _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])

    body = _point_units(client, course_id)
    units = body["units"]
    assert [u["unit_id"] for u in units] == [f"kp:{first}", f"kp:{second}"]  # 稳定派生键
    assert [u["kp_id"] for u in units] == [first, second]
    assert {u["level"] for u in units} == {"point"}
    assert units[0]["title"] == "确界原理"
    assert units[0]["parent_id"] == f"kp:{chapter['kp_id']}"  # 节层不下显：归属折到所属章（C15）
    assert units[0]["summary"] == "确界原理的叙述"
    assert units[0]["confirmed"] is True and units[0]["covered"] is False
    assert units[0]["window_source"] == "chapter"  # 知识点自身无页范围 → 整章页窗兜底
    assert units[0]["source_ref"]["ref_id"] == "mathanalysis-b05"
    assert units[0]["source_ref"]["page_start"] == 21 and units[0]["source_ref"]["page_end"] == 30

    chapters = body["chapters"]
    assert [c["unit_id"] for c in chapters] == [f"kp:{chapter['kp_id']}"]
    assert chapters[0]["name"] == "第一章 实数"
    assert chapters[0]["point_count"] == 2

    # 读时投影零写入：未落笔时单元表没有 point 行
    assert client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"] == []


def test_point_projection_falls_back_to_anchor_pages(monkeypatch):
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(
        client, "区间套定理", parent=chapter["kp_id"], anchors=[{"kind": "book", "ref_id": "mathanalysis-b07", "page": 88}]
    )
    unit = _point_units(client, course_id)["units"][0]
    assert unit["window_source"] == "anchor"
    assert unit["source_ref"]["ref_id"] == "mathanalysis-b07"
    assert unit["source_ref"]["page_start"] == unit["source_ref"]["page_end"] == 88
    assert unit["unit_id"] == f"kp:{kp_id}"


def test_point_projection_orders_by_chapter_sequence_then_hint(monkeypatch):
    client, course_id, rows = _study_client(
        monkeypatch,
        outline=[
            {"name": "第一章 实数", "page_start": 21, "page_end": 30},
            {"name": "第二章 极限", "page_start": 31, "page_end": 40},
        ],
    )
    ch1 = _outline_row(rows, "第一章 实数")
    ch2 = _outline_row(rows, "第二章 极限")
    _confirm_point(client, "未归档点")  # parent_kp_id NULL＝未归档池，不进推进序列
    _confirm_point(client, "章二后学", parent=ch2["kp_id"], order_hint=2)
    _confirm_point(client, "章二先学", parent=ch2["kp_id"], order_hint=1)
    _confirm_point(client, "章一无序甲", parent=ch1["kp_id"])
    _confirm_point(client, "章一有号", parent=ch1["kp_id"], order_hint=9)
    _confirm_point(client, "章一无序乙", parent=ch1["kp_id"])

    units = _point_units(client, course_id)["units"]
    assert [u["title"] for u in units] == [
        "章一有号",
        "章一无序甲",
        "章一无序乙",
        "章二先学",
        "章二后学",
    ]
    assert [u["sort_order"] for u in units] == sorted(u["sort_order"] for u in units)


def test_progress_on_derived_key_materializes_once_and_counts_points(monkeypatch):
    client, course_id, rows = _study_client(monkeypatch)
    chapter = _outline_row(rows, "第一章 实数")
    first = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    second = _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])
    units = _point_units(client, course_id)["units"]

    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert (prog["total"], prog["done"], prog["percent"]) == (2, 0, 0.0)
    assert prog["current_unit_id"] == units[0]["unit_id"]

    posted = client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": f"kp:{first}", "status": "done"}
    )
    assert posted.status_code == 200, posted.text
    assert posted.json()["derived"]["done"] == 1 and posted.json()["derived"]["percent"] == 50.0

    # 首次落笔才物化：重复勾选同一派生键不产生第二行
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": f"kp:{first}", "status": "done"}
    ).status_code == 200
    materialized = [
        u for u in client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"] if u["level"] == "point"
    ]
    assert len(materialized) == 1
    assert materialized[0]["unit_id"] == f"kp:{first}"
    assert materialized[0]["title"] == "确界原理"
    assert materialized[0]["parent_id"] == f"kp:{chapter['kp_id']}"

    # 投影行读回物化后的勾选位
    assert _point_units(client, course_id)["units"][0]["covered"] is True

    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": f"kp:{second}", "status": "skipped"}
    ).status_code == 200
    final = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert final["skipped"] == 1 and final["completed"] is True and final["percent"] == 50.0
    assert final["current_unit_id"] is None


def test_derived_status_and_books_count_knowledge_points(monkeypatch):
    client = _sync_client(monkeypatch, knowledge_store=InMemoryKnowledgeStore())
    client.post("/api/v1/learn/courses/sync")
    course_id = _courses_by_ref(client)[STUDY_COURSE]["learn_course_id"]
    b05 = client.put(
        f"/api/v1/learn/courses/{STUDY_COURSE}/outline",
        json={"book_ref": "mathanalysis-b05", "tree": [{"name": "第一章 实数", "page_start": 21, "page_end": 30}]},
    ).json()["outline"]
    chapter = b05[0]
    first = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": f"kp:{first}", "status": "done"}
    ).status_code == 200

    listed = client.get("/api/v1/learn/courses").json()["courses"]
    target = next(c for c in listed if c["learn_course_id"] == course_id)
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


# ---------- W1：learn 域三表存储懒挂载（消 503；判例 DEFECT-009） ----------


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
    """W1：首个 /learn/courses 请求幂等建三表并挂载，503 消除且只建一次。"""
    calls: list[object] = []
    client = _lazy_learn_client(monkeypatch, lambda settings: calls.append(settings))

    assert client.get("/api/v1/learn/courses").status_code == 200
    assert len(calls) == 1

    assert client.post("/api/v1/learn/courses", json=COURSE_BODY).status_code == 200
    courses = client.get("/api/v1/learn/courses").json()["courses"]
    assert courses[0]["name"] == "数学分析"
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


# ---------- M1 承接：单元树节点承载位（type / payload / source_ref 页窗） ----------


def test_syllabus_carries_node_type_payload_and_source_ref(client):
    """草稿整树写入保留节点级承载位（链路视图与真实正文渲染的数据源）。"""
    course_id = _make_course(client)
    tree = [
        {
            "title": "第一章 极限",
            "children": [
                {
                    "title": "1.1 数列极限",
                    "type": "text",
                    "source_ref": {"ref_id": "mathanalysis-b05", "page_start": 21, "page_end": 28},
                    "payload": {"text": "书内正文摘要"},
                },
                {"title": "1.2 图示", "type": "figure"},
            ],
        }
    ]
    assert client.put(
        f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": tree}
    ).status_code == 200
    units = client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"]
    by_title = {u["title"]: u for u in units}
    text_block = by_title["1.1 数列极限"]
    assert text_block["type"] == "text"
    assert text_block["source_ref"] == {
        "ref_id": "mathanalysis-b05",
        "page_start": 21,
        "page_end": 28,
    }
    assert text_block["payload"] == {"text": "书内正文摘要"}
    figure_block = by_title["1.2 图示"]
    assert figure_block["type"] == "figure"
    assert figure_block["source_ref"] is None
    assert figure_block["payload"] == {}


def test_syllabus_rejects_unknown_node_type(client):
    course_id = _make_course(client)
    bad = [{"title": "坏类型", "type": "video"}]
    assert client.put(
        f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": bad}
    ).status_code == 422
    assert client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"] == []


def test_skeleton_compile_preserves_declared_source_ref_and_payload(client):
    """骨架编译只补空位：已声明的溯源页窗与正文不被占位文本覆写。"""
    course_id = _make_course(client)
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/compile/propose",
        json={"page_windows": [{"start": 21, "end": 28}]},
    ).status_code == 200
    tree = [
        {
            "title": "第一章",
            "children": [
                {
                    "title": "1.1 已绑真实页",
                    "type": "text",
                    "source_ref": {"ref_id": "mathanalysis-b05", "page_start": 21, "page_end": 28},
                },
                {"title": "1.2 未绑页", "type": "text"},
            ],
        }
    ]
    assert client.put(
        f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": tree}
    ).status_code == 200
    for unit in client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"]:
        assert client.patch(f"/api/v1/learn/units/{unit['unit_id']}", json={"confirmed": True}).status_code == 200
    assert client.post(f"/api/v1/learn/courses/{course_id}/compile/start").status_code == 202
    assert _await_compile(client, course_id)["compile_status"] == "completed"
    blocks = {
        b["title"]: b
        for b in client.get(
            f"/api/v1/learn/courses/{course_id}/units", params={"level": "unit"}
        ).json()["units"]
    }
    bound = blocks["1.1 已绑真实页"]
    assert bound["gen_status"] == "generated"
    assert bound["source_ref"]["page_start"] == 21
    assert bound["payload"] == {}  # 不写占位正文，前端按页窗渲染真实解析产物
    unbound = blocks["1.2 未绑页"]
    assert unbound["source_ref"]["ref_id"] == "mathanalysis-b05"
    assert unbound["source_ref"]["page"] is None
    assert "骨架正文" in unbound["payload"]["text"]
def test_course_list_carries_unit_count_for_shelf_badge(client):
    """书架徽章口径：列表项与详情同带 unit_count（「待建链路／草稿」由链路节点数决定）。"""
    course_id = _make_course(client)
    listed = {
        c["learn_course_id"]: c for c in client.get("/api/v1/learn/courses").json()["courses"]
    }[course_id]
    assert listed["unit_count"] == 0
    assert listed["derived"]["status"] == "draft"

    assert client.put(
        f"/api/v1/learn/courses/{course_id}/syllabus", json={"tree": VALID_TREE}
    ).status_code == 200
    units = client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"]
    listed = {
        c["learn_course_id"]: c for c in client.get("/api/v1/learn/courses").json()["courses"]
    }[course_id]
    assert listed["unit_count"] == len(units)
    assert listed["course_ref"]["ref_id"] == COURSE_BODY["course_ref"]["ref_id"]


# ---------- REQ-117 W8：书架清单 v2（解析好即同步 + 教材级进度 + 教材级忽略位） ----------

# 8901 领域课程目录快照（正式名称取共享表：linear_algebra 的正名是「高等代数」）
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

# 8902 书目快照：b09 未解析（active_job_id 空）应 PASS；quantum 无课程归属应 PASS
# 8901 教程套（qt_knowledge）：书级两列现网不存在，展示元数据暂由套级字段联接
SYNC_KNOWLEDGE = [
    {"knowledge_id": "k-ma", "course_id": "math_analysis", "name": "数学分析教程",
     "intro": "面向数学专业本科一年级的教材套", "position": "beginner"},
    {"knowledge_id": "k-la", "course_id": "linear_algebra", "name": "高等代数教程",
     "intro": "面向数学专业高年级的深入教材套", "position": "advanced"},
]

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


def _env(monkeypatch) -> None:
    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_HOST", "127.0.0.1")
    monkeypatch.setenv("QED_DB_PORT", "3306")
    monkeypatch.setenv("QED_DB_NAME", "qed_test")
    monkeypatch.setenv("QED_DB_USER", "root")
    monkeypatch.setenv("QED_DB_PASSWORD", "")


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

    knowledge_store：W5 知识点投影用例的注入点（学习课程与知识点两表同场，仍不触真实库）。
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
        if "pages" in parts:  # /api/v1/books/{book_id}/pages/{page_no}（W9 取材腿）
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


def _courses_by_ref(client):
    return {
        c["course_ref"]["ref_id"]: c
        for c in client.get("/api/v1/learn/courses").json()["courses"]
    }


def test_sync_creates_courses_from_parsed_books_with_official_names(monkeypatch):
    """解析好即同步：只读物化为学习课程，正名取共享表，未解析/无归属者 PASS，二次调用幂等。"""
    client = _sync_client(monkeypatch)
    body = client.post("/api/v1/learn/courses/sync").json()
    assert body["created"] == ["linear_algebra", "math_analysis"]
    assert body["updated"] == []
    assert body["synced"] == 3

    courses = _courses_by_ref(client)
    assert courses["math_analysis"]["name"] == "数学分析"
    assert courses["linear_algebra"]["name"] == "高等代数"
    assert courses["math_analysis"]["domain_ref"] == {
        "ref_id": "math-advanced",
        "label": "数学（高等数学）",
    }
    refs = [r["ref_id"] for r in courses["math_analysis"]["resources"]]
    assert refs == ["mathanalysis-b05", "mathanalysis-b07"]
    assert courses["math_analysis"]["resources"][0]["kind"] == "book"
    assert courses["math_analysis"]["resources"][0]["label"] == "数学分析（第5版）上册"

    again = client.post("/api/v1/learn/courses/sync").json()
    assert again["created"] == [] and again["updated"] == []
    assert len(client.get("/api/v1/learn/courses").json()["courses"]) == 2


def test_sync_unions_new_books_and_preserves_dismissed_and_local_name(monkeypatch):
    """并集补入：新书只追加，不覆盖用户的教材级忽略位与自定课程名。"""
    books = [dict(b) for b in SYNC_BOOKS]
    client = _sync_client(monkeypatch, books)
    client.post("/api/v1/learn/courses/sync")
    course_id = _courses_by_ref(client)["math_analysis"]["learn_course_id"]

    assert client.patch(
        f"/api/v1/learn/courses/{course_id}",
        json={
            "name": "自定名",
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
    assert course["name"] == "自定名"
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


def test_patch_course_resources_persists_dismissed_and_rejects_bad_kind(client):
    """忽略位零 DDL：dismissed 落 resources JSON 键，整列提交可持久；kind 闭集仍守。"""
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
    """8901 教程套读不到不阻断同步：展示字段留空，课程物化照常。"""
    client = _sync_client(monkeypatch, knowledge_online=False)
    body = client.post("/api/v1/learn/courses/sync")
    assert body.status_code == 200
    assert body.json()["created"] == ["linear_algebra", "math_analysis"]
    meta = {b["ref_id"]: b for b in body.json()["books"]}
    assert meta["mathanalysis-b05"]["intro"] == ""
    assert meta["mathanalysis-b05"]["position"] == ""


# ---------- W9：注解面与按需生成腿（§V2.11 两端点，C18~C21） ----------

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
    """W9 用例场：学习课程＋目录＋已确认知识点＋书页可读同场，文字网关打桩（默认测试不调模型）。"""
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
    """章级总结＝写章行 summary（覆写、成品位单一），随 units 一次直读，前端不另取。"""
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
    assert _point_units(client, course_id)["chapters"][0]["summary"] == reply


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
    assert _point_units(client, course_id)["chapters"][0]["key_points"] == ["唯一要点"]
    assert len(calls) == 2


def test_generate_point_annotation_appends_candidate_versions(monkeypatch):
    """条级注解＝候选池多版本并存（不覆写），主表与确认位一律不动（C19 承 C14）。"""
    client, course_id, _rows, store, kp_id, _calls = _annotation_client(
        monkeypatch, reply=["第一版注解。", "第二版注解。"]
    )
    before = store.get_point(kp_id)
    body = {"course_id": course_id, "target_kind": "point", "kp_id": kp_id, "part": "annotation"}
    resp = _generate(client, body)
    assert resp.status_code == 200, resp.text
    detail = resp.json()["detail"]
    assert detail["gen_status"] == "candidate"
    assert detail["confirmed"] in (False, 0)
    assert detail["intent"] == "summary"
    assert detail["gen_batch"] == "learn-annotation"
    assert detail["model_ref"] == "call-1"
    assert detail["parent_kp_id"] == kp_id and detail["name"] == "确界原理"
    anchor = detail["anchors"][0]
    assert anchor["kind"] == "book" and anchor["ref_id"] == "mathanalysis-b05"
    assert anchor["page"] == 21 and ANNOTATION_TEXT in anchor["snippet"]
    again = _generate(client, body)
    assert again.status_code == 200, again.text
    pool = store.list_details(course_id=STUDY_COURSE, batch="learn-annotation")
    assert len(pool) == 2
    assert {row["narrative"] for row in pool} == {"第一版注解。", "第二版注解。"}
    point = store.get_point(kp_id)
    assert point["summary"] == before["summary"] and point["name"] == before["name"]


def test_chapter_generate_throttles_within_window_and_point_never_dedups(monkeypatch):
    """章级 60s 内重复＝回上次成品（不重烧模型）；条级不去重（每次都是新版本）。"""
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
    assert len(store.list_details(course_id=STUDY_COURSE, batch="learn-annotation")) == 2


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
    """上游失败＝502 且给「可以再点一次」；失败批次不写章行、不写候选池。"""
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
    assert store.list_details(course_id=STUDY_COURSE, batch="learn-annotation") == []


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


def test_generate_returns_503_when_knowledge_tables_unreachable(client):
    """知识点两表不可达＝503 降级话术，学习面其余功能不受影响（独立性铁律）。"""
    course_id = _make_course(client)
    resp = _generate(
        client, {"course_id": course_id, "target_kind": "chapter", "kp_id": "kp-1", "part": "summary"}
    )
    assert resp.status_code == 503
    assert "还没准备好" in resp.json()["detail"]


def test_like_writes_only_payload_flag(monkeypatch):
    """点赞＝payload.liked 置位（保留），gen_status/confirmed/主表一律不动（C19）。"""
    client, _course_id, _rows, store, kp_id, _calls = _annotation_client(monkeypatch)
    _before_parent = store.get_point(kp_id)["parent_kp_id"]
    detail = store.add_detail(
        course_id=STUDY_COURSE,
        name="确界原理",
        narrative="既有候选",
        gen_status="candidate",
        parent_kp_id=kp_id,
        payload={"definition": "原有批注载荷"},
    )
    resp = client.post(f"/api/v1/learn/kp-details/{detail['detail_id']}/like", json={"liked": True})
    assert resp.status_code == 200, resp.text
    row = resp.json()["detail"]
    assert row["payload"]["liked"] is True
    assert row["payload"]["definition"] == "原有批注载荷"
    assert row["gen_status"] == "candidate" and row["confirmed"] in (False, 0)
    point = store.get_point(kp_id)
    assert point["summary"] == "确界原理的叙述" and point["parent_kp_id"] == _before_parent
    off = client.post(
        f"/api/v1/learn/kp-details/{detail['detail_id']}/like", json={"liked": False}
    ).json()["detail"]
    assert off["payload"]["liked"] is False
    assert client.post("/api/v1/learn/kp-details/kpd-nope/like", json={"liked": True}).status_code == 404
    assert client.post(f"/api/v1/learn/kp-details/{detail['detail_id']}/like", json={}).status_code == 422


def test_mysql_knowledge_store_gains_annotation_methods():
    """两实现同形：注解腿的新方法在 MySQL 存储上必须存在（签名漂移即红）。"""
    import inspect

    from qed_engine.services.learn.knowledge import MySQLKnowledgeStore

    for name in ("patch_point", "set_detail_liked"):
        assert hasattr(MySQLKnowledgeStore, name), name
        assert hasattr(InMemoryKnowledgeStore, name), name
    memory = inspect.signature(InMemoryKnowledgeStore.set_detail_liked)
    mysql = inspect.signature(MySQLKnowledgeStore.set_detail_liked)
    assert list(memory.parameters) == list(mysql.parameters)


# ---------- 主链 M-3 W2：进度表质性门四列与门态读写面（两实现同形） ----------

GATE_COLUMNS = ("qualitative_passed", "qualitative_note", "assessed_by", "assessed_at")


def _gate_store():
    """只挂一个知识点行的课程：门态读写面的最小形态（不经 API，纯存储层）。"""
    store = InMemoryLearnStore()
    course = store.create_course(
        name="数学分析",
        resources=[{"kind": "book", "ref_id": "mathanalysis-b05", "label": "数学分析教程"}],
        course_ref={"ref_id": "ma-course-01", "label": "数学分析"},
    )
    course_id = str(course["learn_course_id"])
    store.ensure_point_unit(
        course_id,
        unit_id="kp-limit",
        kp_id="kp-limit",
        parent_id=None,
        title="极限的定义",
        sort_order=0,
        source_ref={"ref_id": "mathanalysis-b05", "page": 12},
        covered=False,
    )
    return store, course_id


def test_assess_qualitative_writes_gate_columns_and_keeps_status_pending():
    """D-M3-2 v1 自评位：质性判定落四列，终态位不受影响（派生计数不因判定而虚增）。"""
    from qed_engine.services.learn.base import LearnNotFound

    store, course_id = _gate_store()
    assert store.progress_rows(course_id) == {}  # 未落笔＝无行
    row = store.assess_qualitative(
        course_id, "kp-limit", passed=True, note="能用自己的话说清 ε-δ", assessed_by="learner"
    )
    assert row["unit_id"] == "kp-limit" and row["status"] == "pending"
    assert row["qualitative_passed"] is True
    assert row["qualitative_note"] == "能用自己的话说清 ε-δ"
    assert row["assessed_by"] == "learner" and row["assessed_at"]
    read = store.progress_rows(course_id)["kp-limit"]
    assert read["qualitative_passed"] is True and read["assessed_by"] == "learner"
    with pytest.raises(LearnNotFound):
        store.assess_qualitative("lc-missing", "kp-limit", passed=True, note="", assessed_by="learner")


def test_assess_qualitative_overwrites_and_preserves_terminal_status():
    """重复判定覆盖同一行（一知识点只留最新质性结论）；已有 done 终态不被抹掉。"""
    store, course_id = _gate_store()
    store.set_progress(course_id, "kp-limit", "done")
    first = store.assess_qualitative(
        course_id, "kp-limit", passed=True, note="讲清了", assessed_by="learner"
    )
    second = store.assess_qualitative(
        course_id, "kp-limit", passed=False, note="重讲仍含混", assessed_by="learner"
    )
    assert first["status"] == second["status"] == "done"
    assert second["qualitative_passed"] is False and second["qualitative_note"] == "重讲仍含混"
    assert store.progress_rows(course_id)["kp-limit"]["qualitative_passed"] is False


def test_set_progress_does_not_wipe_gate_columns():
    """勾选与质性判定分居两条通路：写终态位不得抹掉判定四列（MySQL ON DUPLICATE 同语义）。"""
    store, course_id = _gate_store()
    store.assess_qualitative(
        course_id, "kp-limit", passed=True, note="讲清了", assessed_by="learner"
    )
    store.set_progress(course_id, "kp-limit", "skipped")
    row = store.progress_rows(course_id)["kp-limit"]
    assert row["status"] == "skipped" and row["qualitative_passed"] is True


def test_assess_qualitative_rejects_non_point_rows():
    """门只挂知识点行：旧节/块行按 §V2.3 只读，落判定即 409（判例 set_progress）。"""
    from qed_engine.services.learn.base import LearnConflict

    store = InMemoryLearnStore()
    course = store.create_course(name="数学分析", resources=[{"kind": "knowledge", "ref_id": "k-001"}])
    course_id = str(course["learn_course_id"])
    store.replace_tree(course_id, [{"title": "第一章", "children": [{"title": "1.1 实数"}]}])
    for level in ("section", "unit"):
        unit_id = store.list_units(course_id, level)[0]["unit_id"]
        with pytest.raises(LearnConflict):
            store.assess_qualitative(
                course_id, unit_id, passed=True, note="不该落在这行", assessed_by="learner"
            )


def test_progress_gate_columns_are_declared_and_registered():
    """四列进建表 DDL，并进存量库补列注册表（判例 qed_llm_calls 的 _REQUIRED_COLUMNS）。"""
    from qed_engine.services.learn import base as learn_base

    block = learn_base.CREATE_TABLE_SQL[
        learn_base.CREATE_TABLE_SQL.index("qe_learn_unit_progress") :
    ]
    for column in GATE_COLUMNS:
        assert f"  {column} " in block, column
    assert set(learn_base.PROGRESS_GATE_COLUMNS) == set(GATE_COLUMNS)


def test_ensure_tables_adds_only_missing_gate_columns(monkeypatch):
    """存量库只 ALTER 缺的那一列；四列齐备后二次调用零 ALTER（幂等）。"""
    from types import SimpleNamespace

    from qed_engine.services.learn import base as learn_base
    from qed_engine.services.llm import call_log as llm_call_log

    existing = {
        "columns": [
            "id", "unit_id", "learn_course_id", "status",
            "qualitative_passed", "qualitative_note", "assessed_at", "updated_at",
        ]
    }
    executed: list[str] = []

    class _Cursor:
        _probe = False

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def execute(self, sql, params=None):
            executed.append(sql)
            self._probe = sql.startswith("SELECT COLUMN_NAME")

        def fetchall(self):
            return [(name,) for name in existing["columns"]] if self._probe else []

    class _Conn:
        def cursor(self):
            return _Cursor()

        def commit(self):
            pass

        def close(self):
            pass

    monkeypatch.setattr(llm_call_log, "_connect", lambda settings: _Conn())
    settings = SimpleNamespace(qed_db_name="qed_test")

    learn_base.ensure_tables(settings)
    alters = [sql for sql in executed if sql.startswith("ALTER TABLE")]
    assert len(alters) == 1 and "ADD COLUMN assessed_by" in alters[0]

    executed.clear()
    existing["columns"].append("assessed_by")
    learn_base.ensure_tables(settings)
    assert [sql for sql in executed if sql.startswith("ALTER TABLE")] == []

# ---------- 主链 M-3 W3：门态端点 · 质性判定端点 · progress 扩字段 ----------

MASTERY_ITEM_FIELDS = {
    "unit_id", "kp_id", "kp_type", "gate", "mastery", "threshold", "attempt_count",
    "provenance", "status", "qualitative_passed", "due_reviews",
}


def _attach_point_questions(client, kp_id, *, kp_type="procedure", count=1):
    """给知识点接题源（练习域 course_id＝目录课程 ID，现网口径）：返回题面 ID 列表。"""
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
    from qed_engine.clients import tracker_client
    from qed_engine.services.learn import base as learn_base
    from qed_engine.services.learn import practice as practice_base

    client = _sync_client(monkeypatch)
    assert client.get("/api/v1/learn/courses/lc-missing/mastery").status_code == 404
    assert client.post(
        "/api/v1/learn/courses/lc-missing/mastery/assess", json={"unit_id": "kp-x", "passed": True}
    ).status_code == 404

    _env(monkeypatch)
    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", lambda self: [])
    monkeypatch.setattr("qed_engine.api.main._startup_db_check", lambda settings: "mocked")
    monkeypatch.setattr(learn_base, "ensure_tables", lambda settings: None)
    monkeypatch.setattr(practice_base, "ensure_tables", lambda settings: None)
    offline = TestClient(create_app())
    assert offline.get("/api/v1/learn/courses/lc-1/mastery").status_code == 503
    assert offline.post(
        "/api/v1/learn/courses/lc-1/mastery/assess", json={"unit_id": "kp-1", "passed": True}
    ).status_code == 503


def test_qualitative_assess_records_learner_provenance_and_moves_cursor(monkeypatch):
    """D-M3-2 自评位过门＝learner provenance：门态即时派生，勾选位与 done 计数不受判定影响。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    first = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    second = _confirm_point(client, "单调有界定理", parent=chapter["kp_id"])

    posted = client.post(
        f"/api/v1/learn/courses/{course_id}/mastery/assess",
        json={"unit_id": f"kp:{first}", "passed": True, "note": "能用自己的话说清 ε-δ"},
    )
    assert posted.status_code == 200, posted.text
    item = posted.json()["item"]
    assert set(item) == MASTERY_ITEM_FIELDS
    assert item["status"] == "mastered" and item["provenance"] == "learner"
    assert item["qualitative_passed"] is True
    assert item["mastery"] == 1.0
    assert posted.json()["next_step"]["action"] == "probe"
    assert posted.json()["next_step"]["unit_id"] == f"kp:{second}"

    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["done"] == 0 and prog["percent"] == 0.0
    assert prog["mastered"] == 1
    assert prog["provenance"] == {"system": 0, "learner": 1}
    assert prog["current_unit_id"] == f"kp:{second}"
    states = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()["items"]
    assert states[0]["provenance"] == "learner" and states[1]["status"] == "new"
    assert states[0]["qualitative_passed"] is True  # W2 判定四列经投影读回


def test_assess_refuses_quantitative_gate_point(monkeypatch):
    """参照同款 refusal：量化型不接受质性判定（409），且不留判定行。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "极限运算法则", parent=chapter["kp_id"], point_type="procedure")

    response = client.post(
        f"/api/v1/learn/courses/{course_id}/mastery/assess",
        json={"unit_id": f"kp:{kp_id}", "passed": True, "note": "自评讲清了"},
    )
    assert response.status_code == 409, response.text
    assert "量化门" in response.json()["detail"]
    item = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()["items"][0]
    assert item["gate"] == "quantitative" and item["threshold"] == 0.9
    assert item["qualitative_passed"] is None and item["status"] == "new"


def test_assess_validates_body_and_targets(monkeypatch):
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    url = f"/api/v1/learn/courses/{course_id}/mastery/assess"
    assert client.post(url, json={"unit_id": f"kp:{kp_id}"}).status_code == 422
    assert client.post(url, json={"unit_id": f"kp:{kp_id}", "passed": "讲清了"}).status_code == 422
    assert client.post(
        url, json={"unit_id": f"kp:{kp_id}", "passed": True, "by": "model"}
    ).status_code == 422
    assert client.post(
        url, json={"unit_id": f"kp:{kp_id}", "passed": True, "note": "n" * 1001}
    ).status_code == 422
    assert client.post(url, json={"unit_id": "kp-missing", "passed": True}).status_code == 404


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
    assert client.get(f"/api/v1/learn/courses/{course_id}/units").json()["units"] == []  # 门不物化行


def test_single_correct_answer_does_not_clear_the_gate(monkeypatch):
    """防蒙对铁律：单次答对被置信上限钳到 0.5，量化门 0.9 不过，只进 learning。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    kp_id = _confirm_point(client, "极值判别法", parent=chapter["kp_id"], point_type="procedure")
    question_id = _attach_point_questions(client, kp_id, kp_type="procedure")[0]
    _answer_correctly(client, question_id, times=1)

    item = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()["items"][0]
    assert item["attempt_count"] == 1 and item["mastery"] == 0.5
    assert item["provenance"] == "" and item["status"] == "learning"
    assert "mastered" not in item  # 响应只出冻结字段清单，掌握位由 status 承载
    assert item["due_reviews"] >= 1  # 裁决 ⑧：首次作答即建 kp 粒度节律行，当日到期


def test_due_review_pulls_next_step_before_the_cursor(monkeypatch):
    """到期复习优先于推进：游标停在第一个未掌握行，next_step 先把它拽回去复习。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    drilled = _confirm_point(client, "极值判别法", parent=chapter["kp_id"], point_type="procedure")
    later = _confirm_point(client, "确界原理", parent=chapter["kp_id"])
    question_id = _attach_point_questions(client, drilled, kp_type="procedure")[0]
    _answer_correctly(client, question_id, times=1)
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": f"kp:{drilled}", "status": "done"}
    ).status_code == 200

    mastery = client.get(f"/api/v1/learn/courses/{course_id}/mastery").json()
    assert mastery["items"][0]["due_reviews"] >= 1
    assert mastery["items"][0]["provenance"] == "learner"
    assert mastery["next_step"]["action"] == "review"
    assert mastery["next_step"]["unit_id"] == f"kp:{drilled}"
    assert mastery["next_step"]["kp_id"] == drilled

    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["current_unit_id"] == f"kp:{later}" and prog["next_unit_id"] == f"kp:{drilled}"


def test_skipped_rows_do_not_stop_the_gate_cursor(monkeypatch):
    """跳过＝学习者显式让位：不进门（未掌握），也不停游标（勾稽旧口径）。"""
    client, course_id, rows = _study_client(monkeypatch, practice_store=InMemoryPracticeStore())
    chapter = _outline_row(rows, "第一章 实数")
    skipped = _confirm_point(client, "已跳过点", parent=chapter["kp_id"])
    pending = _confirm_point(client, "待学点", parent=chapter["kp_id"])
    for unit_id, status in ((f"kp:{skipped}", "skipped"), (f"kp:{pending}", "pending")):
        assert client.post(
            f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": unit_id, "status": status}
        ).status_code == 200
    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["skipped"] == 1 and prog["mastered"] == 0
    assert prog["current_unit_id"] == f"kp:{pending}"
