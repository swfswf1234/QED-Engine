"""学习域·知识点体系（M5 + M6 v2 层级化）契约测试：两表语义 + 10 端点 + 404/409/422/503 错误码清单。

模块职责：守护 M5/M6 壳冻结的知识点主数据（qed_knowledge_point）与候选明细池
（qed_learn_kp_detail）契约——星图聚合形状、norm_key 规范化去重、人工确认提升、
驳回不提升、存储未接入 503；M6 追加 outline 整树幂等替换（同名复用 kp_id、被弃章
的 point 归未归档池）、point 归属移动与父子校验、`node_kind` 过滤口径。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/api/learn.py、backend/qed_engine/services/learn/knowledge.py
失效后果：M5 星图与知识点页按错误形状联调，人工确认门失守
"""

import time

import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.services.learn import InMemoryKnowledgeStore

DEMO_COURSES = [
    {
        "course_id": "math_analysis",
        "name": "数学分析",
        "track": "分析学",
        "stage": "基础",
        "prerequisites": [],
        "sort_order": 1,
    },
    {
        "course_id": "linear_algebra",
        "name": "线性代数",
        "track": "代数学",
        "stage": "基础",
        "prerequisites": [],
        "sort_order": 2,
    },
    {
        "course_id": "real_analysis",
        "name": "实变函数",
        "track": "分析学",
        "stage": "主干",
        "prerequisites": ["math_analysis"],
        "sort_order": 3,
    },
    {
        "course_id": "probability",
        "name": "概率论",
        "track": "概率论与统计",
        "stage": "主干",
        "prerequisites": ["math_analysis", "linear_algebra"],
        "sort_order": 4,
    },
]

DEMO_DOMAINS = [
    {
        "domain_id": "math-advanced",
        "name": "数学（高等数学）",
        "classic_tracks": [
            {"kind": "main", "name": "分析学", "summary": "极限与连续"},
            {"kind": "main", "name": "代数学", "summary": "对称结构"},
        ],
        "courses": DEMO_COURSES,
    }
]


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
    return InMemoryKnowledgeStore()


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
    from qed_engine.clients import tracker_client

    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", lambda self: DEMO_DOMAINS)
    return TestClient(create_app(knowledge_store=store))


def _add_detail(client, *, course_id="math_analysis", name="确界原理", **kw):
    body = {
        "course_id": course_id,
        "name": name,
        "narrative": kw.get("narrative", "非空数集若有上界则必有上确界"),
        "type": kw.get("type", "concept"),
        "domain_id": kw.get("domain_id", "math-advanced"),
        "gen_batch": kw.get("gen_batch", "demo-001"),
        "model_ref": kw.get("model_ref", "manual-demo"),
        "anchors": kw.get("anchors", [{"kind": "book", "ref_id": "b05", "page": 7}]),
        "payload": kw.get("payload", {"definition": "设 S 为非空数集"}),
    }
    for key in ("parent_kp_id", "intent", "book_ref"):
        if key in kw:
            body[key] = kw[key]
    resp = client.post("/api/v1/learn/kp-details", json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _confirm(client, detail):
    resp = client.post(f"/api/v1/learn/kp-details/{detail['detail_id']}/confirm")
    assert resp.status_code == 200, resp.text
    return resp.json()["point"]


# ---------- 星图聚合（GET /learn/star-map） ----------


def test_star_map_aggregates_tracks_courses_and_counts(client, store):
    first = _add_detail(client)
    _confirm(client, first)
    _add_detail(client, name="单调有界定理")

    body = client.get("/api/v1/learn/star-map").json()
    domain = body["domains"][0]
    assert domain["domain_id"] == "math-advanced"
    tracks = {t["track"]: t for t in domain["tracks"]}
    assert set(tracks) == {"分析学", "代数学", "概率论与统计"}
    assert tracks["分析学"]["kind"] == "main"
    assert tracks["概率论与统计"]["kind"] == "other"
    assert tracks["分析学"]["summary"] == "极限与连续"
    assert {n["course_id"] for n in tracks["分析学"]["courses"]} == {"math_analysis", "real_analysis"}
    node = next(n for n in tracks["分析学"]["courses"] if n["course_id"] == "math_analysis")
    assert node["name"] == "数学分析"
    assert node["kp_confirmed"] == 1
    assert node["kp_candidates"] == 1
    assert node["stage"] == "基础" and node["sort_order"] == 1
    assert {(e["from"], e["to"], e["cross_track"]) for e in body["edges"]} == {
        ("math_analysis", "real_analysis", False),
        ("math_analysis", "probability", True),
        ("linear_algebra", "probability", True),
    }


def test_star_map_domain_filter_and_unknown_404(client):
    _add_detail(client, course_id="real_analysis", name="Lebesgue 积分")
    body = client.get("/api/v1/learn/star-map?domain=math-advanced").json()
    assert body["domains"][0]["domain_id"] == "math-advanced"
    assert client.get("/api/v1/learn/star-map?domain=nope").status_code == 404


def test_star_map_503_when_catalog_unavailable(client, monkeypatch):
    from qed_engine.clients import tracker_client

    def _boom(self):
        raise tracker_client.TrackerError("8901 离线")

    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", _boom)
    assert client.get("/api/v1/learn/star-map").status_code == 503


# ---------- 两表语义（候选池 → 人工确认 → 共享主表） ----------


def test_confirm_promotes_detail_into_shared_point(client, store):
    detail = _add_detail(client)
    point = _confirm(client, detail)
    assert point["confirmed"] is True
    assert point["from_detail_id"] == detail["detail_id"]
    assert point["norm_key"] == "确界原理"
    assert point["anchors"][0]["ref_id"] == "b05"
    assert store.points[point["kp_id"]]["course_id"] == "math_analysis"
    assert store.details[detail["detail_id"]]["gen_status"] == "adopted"
    assert store.details[detail["detail_id"]]["kp_id"] == point["kp_id"]


def test_confirm_rejects_duplicate_norm_key(client):
    _confirm(client, _add_detail(client))
    dup = _add_detail(client, name=" 确界原理 ")
    resp = client.post(f"/api/v1/learn/kp-details/{dup['detail_id']}/confirm")
    assert resp.status_code == 409
    assert "已存在" in resp.json()["detail"]
    assert client.get("/api/v1/learn/knowledge-points?course=math_analysis").json()["total"] == 1


def test_norm_key_normalises_fullwidth_whitespace_and_case(client):
    assert _add_detail(client, name="Ｂｏｒｅｌ  有限覆盖")["norm_key"] == "borel 有限覆盖"
    assert _add_detail(client, name="  Heine-Borel 定理 ")["norm_key"] == "heine-borel 定理"


def test_reject_never_promotes(client):
    detail = _add_detail(client, name="区间套定理")
    assert client.post(f"/api/v1/learn/kp-details/{detail['detail_id']}/reject").status_code == 200
    assert client.get("/api/v1/learn/knowledge-points").json()["points"] == []
    rows = client.get("/api/v1/learn/kp-details").json()["details"]
    assert next(r for r in rows if r["detail_id"] == detail["detail_id"])["gen_status"] == "rejected"


def test_confirmed_point_survives_detail_listing_filter(client):
    detail = _add_detail(client)
    _confirm(client, detail)
    only_pending = client.get("/api/v1/learn/kp-details?gen_status=candidate").json()["details"]
    assert only_pending == []
    adopted = client.get("/api/v1/learn/kp-details?gen_batch=demo-001").json()["details"]
    assert [d["gen_status"] for d in adopted] == ["adopted"]


# ---------- 知识点检索（GET /learn/knowledge-points） ----------


def test_list_points_filters_and_paginates(client):
    for name, typ in (("确界原理", "concept"), ("单调有界原理", "concept"), ("求极限步骤", "procedure")):
        _confirm(client, _add_detail(client, name=name, type=typ))
    assert client.get("/api/v1/learn/knowledge-points?type=concept").json()["total"] == 2
    assert client.get("/api/v1/learn/knowledge-points?q=单调").json()["total"] == 1
    assert client.get("/api/v1/learn/knowledge-points?domain=math-advanced").json()["total"] == 3
    paged = client.get("/api/v1/learn/knowledge-points?limit=2&offset=0").json()
    assert len(paged["points"]) == 2 and paged["total"] == 3
    assert client.get("/api/v1/learn/knowledge-points?type=nope").status_code == 422


def test_course_points_carry_candidate_narratives(client):
    detail = _add_detail(client, name="闭区间连续函数性质")
    point = _confirm(client, detail)
    second = _add_detail(client, name="闭区间连续函数性质", narrative="另一条叙述版本", gen_batch="demo-002")
    body = client.get("/api/v1/learn/courses/math_analysis/knowledge-points").json()
    assert body["course"] == {"course_id": "math_analysis", "name": "数学分析", "track": "分析学", "domain_id": "math-advanced"}
    row = body["points"][0]
    assert row["kp_id"] == point["kp_id"]
    assert [c["detail_id"] for c in row["candidates"]] == [second["detail_id"]]
    assert row["candidates"][0]["narrative"] == "另一条叙述版本"
    assert client.get("/api/v1/learn/courses/unknown_course/knowledge-points").status_code == 404


# ---------- 错误码与降级 ----------


def test_detail_errors_404_and_422(client):
    assert client.post("/api/v1/learn/kp-details/nope/confirm").status_code == 404
    assert client.post("/api/v1/learn/kp-details/nope/reject").status_code == 404
    assert client.get("/api/v1/learn/kp-details?gen_status=nope").status_code == 422
    assert client.post("/api/v1/learn/kp-details", json={"course_id": "", "name": "x"}).status_code == 422
    assert client.post(
        "/api/v1/learn/kp-details", json={"course_id": "c", "name": "n", "type": "nope"}
    ).status_code == 422


def test_knowledge_endpoints_503_without_store(monkeypatch):
    from qed_engine.clients import tracker_client

    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_PASSWORD", "")
    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", lambda self: DEMO_DOMAINS)
    orphan = TestClient(create_app(knowledge_store=None))
    assert orphan.get("/api/v1/learn/knowledge-points").status_code == 503
    assert orphan.get("/api/v1/learn/courses/math_analysis/knowledge-points").status_code == 503
    # 星图不依赖新表：目录可达即出图（未配置库时知识点计数降级为 0）
    body = orphan.get("/api/v1/learn/star-map").json()
    assert body["domains"][0]["tracks"][0]["courses"][0]["kp_confirmed"] == 0


class _FakeCountingStore:
    def counts_by_course(self) -> dict[str, dict[str, int]]:
        return {"math_analysis": {"confirmed": 2, "candidates": 3}}

    def list_points(self, **_kwargs):
        return [], 0


def _lazy_mount_client(monkeypatch, ensure_tables):
    """构造「未注入 store + 已配置库密码」的进程态：只替建表与存储类，不触真实 MySQL。"""
    from qed_engine.api import learn as learn_api
    from qed_engine.clients import tracker_client
    from qed_engine.services.learn import knowledge as knowledge_module

    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_PASSWORD", "test-pw")
    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", lambda self: DEMO_DOMAINS)
    monkeypatch.setattr("qed_engine.api.main._startup_db_check", lambda settings: "mocked")
    monkeypatch.setattr(knowledge_module, "ensure_tables", ensure_tables)
    monkeypatch.setattr(knowledge_module, "MySQLKnowledgeStore", lambda settings: _FakeCountingStore())
    return TestClient(create_app(knowledge_store=None)), learn_api


def test_knowledge_mount_retries_after_transient_db_failure(monkeypatch):
    """DEFECT-009：建表失败只锁一个短窗口，MySQL 恢复后不重启进程即自愈。"""
    attempts = {"n": 0}

    def flaky(settings):
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise OSError("mock: database unreachable")

    client, learn_api = _lazy_mount_client(monkeypatch, flaky)
    clock = {"t": 1000.0}
    monkeypatch.setattr(time, "monotonic", lambda: clock["t"])

    assert client.get("/api/v1/learn/knowledge-points").status_code == 503
    assert attempts["n"] == 1

    # 重试窗口内不再打库（避免每次请求都吃一次建表超时）
    clock["t"] += learn_api.KNOWLEDGE_MOUNT_RETRY_SECONDS / 2
    assert client.get("/api/v1/learn/knowledge-points").status_code == 503
    assert attempts["n"] == 1

    clock["t"] += learn_api.KNOWLEDGE_MOUNT_RETRY_SECONDS
    assert client.get("/api/v1/learn/knowledge-points").status_code == 200
    assert attempts["n"] == 2


def test_star_map_mounts_store_and_reports_counts(monkeypatch):
    """DEFECT-009 同根：星图直读 app.state 会漏触发懒挂载，计数长期假 0。"""
    client, _ = _lazy_mount_client(monkeypatch, lambda settings: None)

    body = client.get("/api/v1/learn/star-map").json()
    courses = body["domains"][0]["tracks"][0]["courses"]
    target = next(c for c in courses if c["course_id"] == "math_analysis")
    assert target["kp_confirmed"] == 2
    assert target["kp_candidates"] == 3


# ---------- M6：章节目录层级（outline 行）与三栏写面 ----------

OUTLINE_TREE = [
    {
        "name": "第1章 实数与函数",
        "page_start": 9,
        "page_end": 40,
        "children": [
            {"name": "1.1 实数及其运算", "page_start": 9, "page_end": 20},
            {"name": "1.2 数轴与绝对值", "page_start": 21, "page_end": 40},
        ],
    },
    {"name": "第2章 极限", "page_start": 41, "page_end": 90},
]


def _put_outline(client, tree=None, *, course="math_analysis", book="b05"):
    resp = client.put(
        f"/api/v1/learn/courses/{course}/outline",
        json={"book_ref": book, "tree": OUTLINE_TREE if tree is None else tree},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _get_outline(client, *, course="math_analysis", book="b05"):
    resp = client.get(f"/api/v1/learn/courses/{course}/outline?book={book}")
    assert resp.status_code == 200, resp.text
    return resp.json()["outline"]


def test_put_outline_writes_two_level_tree_as_confirmed_rows(client, store):
    _put_outline(client)
    rows = _get_outline(client)
    assert [r["name"] for r in rows] == [
        "第1章 实数与函数",
        "1.1 实数及其运算",
        "1.2 数轴与绝对值",
        "第2章 极限",
    ]
    first = rows[0]
    assert first["node_kind"] == "outline" and first["depth"] == 1
    assert first["parent_kp_id"] is None and first["confirmed"] is True
    assert first["book_ref"] == "b05"
    assert first["source_ref"] == {"kind": "book", "ref_id": "b05", "page_start": 9, "page_end": 40}
    child = rows[1]
    assert child["depth"] == 2 and child["parent_kp_id"] == first["kp_id"]
    assert all(r["type"] is None for r in rows)
    assert all(store.points[r["kp_id"]]["node_kind"] == "outline" for r in rows)


def test_outline_points_hang_on_chapter_and_count_per_node(client):
    _put_outline(client)
    chapters = {r["name"]: r["kp_id"] for r in _get_outline(client, book="b05")}
    detail = _add_detail(client, name="确界原理", parent_kp_id=chapters["第1章 实数与函数"], book_ref="b05")
    point = _confirm(client, detail)
    assert point["parent_kp_id"] == chapters["第1章 实数与函数"]
    assert point["node_kind"] == "point" and point["book_ref"] == ""

    rows = {r["kp_id"]: r for r in _get_outline(client)}
    assert rows[chapters["第1章 实数与函数"]]["point_count"] == 1
    assert rows[chapters["第2章 极限"]]["point_count"] == 0


def test_reimport_outline_reuses_kp_id_and_orphans_dropped_points(client):
    _put_outline(client)
    first = {r["name"]: r["kp_id"] for r in _get_outline(client)}
    detail = _add_detail(client, name="单调有界原理", parent_kp_id=first["第2章 极限"], book_ref="b05")
    point = _confirm(client, detail)

    _put_outline(
        client,
        [{"name": "第1章 实数与函数", "page_start": 9, "page_end": 30}],
    )
    rows = _get_outline(client)
    assert [r["name"] for r in rows] == ["第1章 实数与函数"]
    assert rows[0]["kp_id"] == first["第1章 实数与函数"]
    assert rows[0]["source_ref"]["page_end"] == 30

    kept = client.get("/api/v1/learn/knowledge-points?course=math_analysis").json()["points"]
    assert [p["kp_id"] for p in kept] == [point["kp_id"]]
    assert kept[0]["parent_kp_id"] is None


def test_outline_and_point_endpoints_error_codes(client):
    assert client.get("/api/v1/learn/courses/unknown_course/outline").status_code == 404
    assert client.put("/api/v1/learn/courses/unknown_course/outline", json={
        "book_ref": "b05", "tree": OUTLINE_TREE
    }).status_code == 404
    bad_bodies = [
        {"book_ref": "", "tree": OUTLINE_TREE},
        {"book_ref": "b05", "tree": []},
        {"book_ref": "b05", "tree": [{"name": " ", "page_start": 1, "page_end": 2}]},
        {"book_ref": "b05", "tree": [{"name": "第1章", "page_start": 9, "page_end": 3}]},
        {"book_ref": "b05", "tree": [{"name": "第1章", "page_start": 0, "page_end": 3}]},
        {"book_ref": "b05", "tree": [{"name": "第1章", "page_start": 1, "page_end": 3,
                                      "children": [{"name": "1.1", "page_start": 1, "page_end": 2,
                                                   "children": [{"name": "1.1.1", "page_start": 1,
                                                                 "page_end": 2}]}]}]},
    ]
    for body in bad_bodies:
        resp = client.put("/api/v1/learn/courses/math_analysis/outline", json=body)
        assert resp.status_code == 422, (body, resp.text)


def test_outline_leaf_accepts_empty_children_list(client):
    """目录面板每个节点都带 children 数组（叶＝[]），两级树必须写入成功。"""
    tree = [
        {
            "name": "第1章 实数系和复数系",
            "page_start": 9,
            "page_end": 28,
            "children": [
                {"name": "导引", "page_start": 9, "page_end": 9, "children": []},
                {"name": "有序集", "page_start": 10, "page_end": 11, "children": []},
            ],
        },
        {"name": "第2章 基础拓扑", "page_start": 29, "page_end": 48, "children": []},
    ]
    resp = client.put(
        "/api/v1/learn/courses/math_analysis/outline", json={"book_ref": "b05", "tree": tree}
    )
    assert resp.status_code == 200, resp.text
    rows = _get_outline(client)
    assert [r["name"] for r in rows] == ["第1章 实数系和复数系", "导引", "有序集", "第2章 基础拓扑"]
    assert [r["depth"] for r in rows] == [1, 2, 2, 1]


def test_patch_point_moves_between_chapters_and_rejects_bad_parent(client):
    _put_outline(client)
    rows = {r["name"]: r["kp_id"] for r in _get_outline(client)}
    detail = _add_detail(client, name="夹逼准则", parent_kp_id=rows["第2章 极限"])
    point = _confirm(client, detail)

    moved = client.patch(
        f"/api/v1/learn/knowledge-points/{point['kp_id']}",
        json={"parent_kp_id": rows["1.2 数轴与绝对值"], "order_hint": 3},
    ).json()
    assert moved["parent_kp_id"] == rows["1.2 数轴与绝对值"]
    assert moved["order_hint"] == 3

    assert client.patch(
        f"/api/v1/learn/knowledge-points/{point['kp_id']}", json={"parent_kp_id": point["kp_id"]}
    ).status_code == 422
    assert client.patch(
        f"/api/v1/learn/knowledge-points/{point['kp_id']}", json={"confirmed": True}
    ).status_code == 422
    assert client.patch("/api/v1/learn/knowledge-points/kp-nope", json={"name": "x"}).status_code == 404
    assert client.patch(
        f"/api/v1/learn/knowledge-points/{rows['第2章 极限']}", json={"parent_kp_id": point["kp_id"]}
    ).status_code == 422


def test_point_queries_exclude_outline_rows_by_default(client):
    _put_outline(client)
    chapters = {r["name"]: r["kp_id"] for r in _get_outline(client)}
    _confirm(client, _add_detail(client, name="闭区间性质", parent_kp_id=chapters["第1章 实数与函数"]))
    _confirm(client, _add_detail(client, name="数列极限", course_id="real_analysis"))

    searched = client.get("/api/v1/learn/knowledge-points").json()
    assert searched["total"] == 2
    assert {p["name"] for p in searched["points"]} == {"闭区间性质", "数列极限"}
    assert client.get("/api/v1/learn/knowledge-points?q=第1章").json()["total"] == 0

    course_body = client.get("/api/v1/learn/courses/math_analysis/knowledge-points").json()
    assert [p["name"] for p in course_body["points"]] == ["闭区间性质"]
    with_outline = client.get(
        "/api/v1/learn/courses/math_analysis/knowledge-points?include_outline=true"
    ).json()
    assert {p["name"] for p in with_outline["points"]} == {
        "闭区间性质", "第1章 实数与函数", "1.1 实数及其运算", "1.2 数轴与绝对值", "第2章 极限"
    }

    star = client.get("/api/v1/learn/star-map").json()
    node = next(
        c for t in star["domains"][0]["tracks"] for c in t["courses"] if c["course_id"] == "math_analysis"
    )
    assert node["kp_confirmed"] == 1


def test_detail_intent_closed_set_and_default(client, store):
    detail = _add_detail(client, name="极限运算法则")
    assert detail["intent"] == "explanation"
    assert detail["parent_kp_id"] is None
    summary = _add_detail(client, name="无穷小比较", intent="summary", book_ref="b05")
    assert summary["intent"] == "summary"
    assert store.details[summary["detail_id"]]["book_ref"] == "b05"
    assert client.post(
        "/api/v1/learn/kp-details", json={"course_id": "math_analysis", "name": "x", "intent": "nope"}
    ).status_code == 422


def test_details_filterable_by_parent_chapter(client):
    _put_outline(client)
    chapters = {r["name"]: r["kp_id"] for r in _get_outline(client)}
    _add_detail(client, name="本章候选", parent_kp_id=chapters["第1章 实数与函数"])
    _add_detail(client, name="别章候选", parent_kp_id=chapters["第2章 极限"])
    _add_detail(client, name="未归档候选")
    rows = client.get(
        f"/api/v1/learn/kp-details?course=math_analysis&parent={chapters['第1章 实数与函数']}"
    ).json()["details"]
    assert [r["name"] for r in rows] == ["本章候选"]
    unarchived = client.get(
        "/api/v1/learn/kp-details?course=math_analysis&parent=none"
    ).json()["details"]
    assert [r["name"] for r in unarchived] == ["未归档候选"]


CROSS_CHAPTER_TREE = [
    {
        "name": "第3章 级数与积分",
        "page_start": 100,
        "page_end": 130,
        "children": [
            {"name": "级数", "page_start": 100, "page_end": 110, "children": []},
            {"name": "积分", "page_start": 111, "page_end": 130, "children": []},
        ],
    },
    {
        "name": "第7章 级数的应用",
        "page_start": 200,
        "page_end": 230,
        "children": [
            {"name": "级数", "page_start": 200, "page_end": 215, "children": []},
            {"name": "积分", "page_start": 216, "page_end": 230, "children": []},
        ],
    },
]


def test_outline_allows_same_section_name_under_different_chapters(client):
    """跨章同名节合法（DEFECT-011：b05 实测「级数」「积分」各出现两章）。"""
    resp = client.put(
        "/api/v1/learn/courses/math_analysis/outline",
        json={"book_ref": "b05", "tree": CROSS_CHAPTER_TREE},
    )
    assert resp.status_code == 200, resp.text
    rows = _get_outline(client)
    jishu = [r for r in rows if r["name"] == "级数"]
    assert len(jishu) == 2
    assert len({r["kp_id"] for r in jishu}) == 2
    chapters = [r for r in rows if r["depth"] == 1]
    assert len(chapters) == 2
    assert len({r["parent_kp_id"] for r in jishu}) == 2


def test_outline_rejects_duplicate_name_under_same_parent(client):
    """同父级下重名整树被拒（422）：去重口径由服务端显式校验承载。"""
    tree = [
        {
            "name": "第1章 极限与连续",
            "page_start": 1,
            "page_end": 10,
            "children": [
                {"name": "上极限", "page_start": 1, "page_end": 5, "children": []},
                {"name": "上极限", "page_start": 6, "page_end": 10, "children": []},
            ],
        }
    ]
    resp = client.put(
        "/api/v1/learn/courses/math_analysis/outline",
        json={"book_ref": "b05", "tree": tree},
    )
    assert resp.status_code == 422, resp.text
    assert _get_outline(client) == []


def test_reimport_reuses_kp_id_per_parent_not_globally(client):
    """复用按「父级 + 名」建键：同父同名复用 kp_id，跨父同名各自成行。"""
    _put_outline(client, CROSS_CHAPTER_TREE)
    before = {(r["name"], r["parent_kp_id"]): r["kp_id"] for r in _get_outline(client)}

    resp = _put_outline(
        client,
        [
            {
                "name": "第3章 级数与积分",
                "page_start": 100,
                "page_end": 130,
                "children": [
                    {"name": "级数", "page_start": 100, "page_end": 110, "children": []},
                ],
            },
            {
                "name": "第7章 级数的应用",
                "page_start": 200,
                "page_end": 230,
                "children": [
                    {"name": "一致收敛", "page_start": 200, "page_end": 230, "children": []},
                ],
            },
        ],
    )
    assert (resp["reused"], resp["created"], resp["dropped"]) == (3, 1, 3)

    rows = _get_outline(client)
    chapters = {r["name"]: r["kp_id"] for r in rows if r["depth"] == 1}
    survivor = next(r for r in rows if r["name"] == "级数")
    assert survivor["parent_kp_id"] == chapters["第3章 级数与积分"]
    assert survivor["kp_id"] == before[("级数", chapters["第3章 级数与积分"])]
    assert all(r["name"] != "积分" for r in rows)
