"""学习域·知识点主表契约测试：`qed_knowledge_point` 单表语义 + 8 端点 + 404/409/422/503 清单。

模块职责：守护 ADR 0026 定档后的共享主数据面——星图聚合与课程计数、point 行直登记
（`POST /learn/knowledge-points` 是候选池退役后主表的唯一产面，D10）、norm_key 规范化去重、
父级与课程坐标校验、outline 整树幂等替换与归属移动、v1.0 三列（`aliases`／`narrative_ref`／
`angles`）的形状与读写通道、长文正文按指针读数据根的双闸降级、存储懒挂载重试窗（DEFECT-009）。
候选池 `qe_kp_detail` 与其五枚端点、恒真确认位列随 D1/D2 退出，多版本叙述改由主表索引承载。
设计关联（DesignRef）：docs/architecture/api-contracts.md、docs/architecture/database-design.md
实现状态：Current
被测代码：backend/qed_engine/api/learn.py、backend/qed_engine/services/learn/knowledge.py
失效后果：星图与知识点页按错误形状联调，主表直登记门与长文指针闸失守
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
        "description": "极限、连续与一元微积分",
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


def _make_client(monkeypatch, store):
    from qed_engine.clients import tracker_client

    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_HOST", "127.0.0.1")
    monkeypatch.setenv("QED_DB_PORT", "3306")
    monkeypatch.setenv("QED_DB_NAME", "qed_test")
    monkeypatch.setenv("QED_DB_USER", "root")
    monkeypatch.setenv("QED_DB_PASSWORD", "")
    monkeypatch.setattr(
        tracker_client.TrackerClient, "list_courses_system", lambda self: DEMO_DOMAINS
    )
    return TestClient(create_app(knowledge_store=store))


@pytest.fixture()
def client(monkeypatch, store):
    return _make_client(monkeypatch, store)


def _add_point(client, *, course_id="math_analysis", name="确界原理", **kw):
    """point 行直登记＝候选池退役后主表的唯一产面（写入这一动作即承载确认，D10）。"""
    body = {"course_id": course_id, "name": name, "type": kw.pop("type", "concept")}
    for key in (
        "parent_kp_id", "summary", "aliases", "narrative_ref", "anchors", "order_hint",
        "from_detail_id", "domain_id", "domain_label", "course_label",
    ):
        if key in kw:
            body[key] = kw.pop(key)
    assert not kw, f"未知入参：{sorted(kw)}"
    resp = client.post("/api/v1/learn/knowledge-points", json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------- 星图聚合（GET /learn/star-map） ----------


def test_star_map_aggregates_tracks_courses_and_counts(client):
    _add_point(client)
    _add_point(client, name="单调有界定理")

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
    assert node["kp_confirmed"] == 2
    # 候选位随候选池退出：星图节点只剩「已登记知识点数」一枚计数
    assert "kp_candidates" not in node
    assert node["stage"] == "基础" and node["sort_order"] == 1
    # REQ-110 W2：课程卡悬停要读课程叙述，course 对象须透传 qed_course.description
    assert node["description"] == "极限、连续与一元微积分"
    no_desc = next(n for n in tracks["代数学"]["courses"] if n["course_id"] == "linear_algebra")
    assert no_desc["description"] == ""
    assert {(e["from"], e["to"], e["cross_track"]) for e in body["edges"]} == {
        ("math_analysis", "real_analysis", False),
        ("math_analysis", "probability", True),
        ("linear_algebra", "probability", True),
    }


def test_star_map_domain_filter_and_unknown_404(client):
    _add_point(client, course_id="real_analysis", name="Lebesgue 积分")
    body = client.get("/api/v1/learn/star-map?domain=math-advanced").json()
    assert body["domains"][0]["domain_id"] == "math-advanced"
    assert client.get("/api/v1/learn/star-map?domain=nope").status_code == 404


def test_star_map_503_when_catalog_unavailable(client, monkeypatch):
    from qed_engine.clients import tracker_client

    def _boom(self):
        raise tracker_client.TrackerError("8901 离线")

    monkeypatch.setattr(tracker_client.TrackerClient, "list_courses_system", _boom)
    assert client.get("/api/v1/learn/star-map").status_code == 503


# ---------- 主表直登记（POST /learn/knowledge-points） ----------


def test_point_registration_lands_in_shared_main_table(client, store):
    point = _add_point(
        client, anchors=[{"kind": "book", "ref_id": "b05", "page": 7}], from_detail_id="af-node-01"
    )
    assert "confirmed" not in point  # 主表一行即一条已确认知识点（R6：无恒真确认位列）
    assert point["node_kind"] == "point" and point["depth"] is None
    assert point["norm_key"] == "确界原理"
    assert point["anchors"][0]["ref_id"] == "b05"
    assert point["from_detail_id"] == "af-node-01"
    assert point["parent_kp_id"] is None  # 未归档池：登记不要求先有目录树
    assert store.points[point["kp_id"]]["course_id"] == "math_analysis"


def test_point_registration_fills_coords_from_catalog(client):
    """坐标三列只在缺省时由课程目录补齐（R5 引用不复制）：跨领域检索与 idx_kp_domain 才可信。"""
    point = _add_point(client)
    assert (point["domain_id"], point["domain_label"]) == ("math-advanced", "数学（高等数学）")
    assert point["course_label"] == "数学分析"
    explicit = _add_point(
        client,
        course_id="linear_algebra",
        name="矩阵秩",
        domain_id="hand",
        domain_label="自封领域名",
    )
    assert (explicit["domain_id"], explicit["domain_label"]) == ("hand", "自封领域名")
    assert explicit["course_label"] == "线性代数"  # 未提交的那一列仍由目录补齐
    half = _add_point(client, course_id="real_analysis", name="勒贝格测度", domain_id="hand")
    assert half["domain_id"] == "hand" and half["domain_label"] == "数学（高等数学）"
    assert half["course_label"] == "实变函数"


def test_point_registration_rejects_duplicate_norm_key(client):
    _add_point(client)
    dup = client.post(
        "/api/v1/learn/knowledge-points",
        json={"course_id": "math_analysis", "name": " 确界原理 "},
    )
    assert dup.status_code == 409
    assert "已存在" in dup.json()["detail"]
    assert client.get("/api/v1/learn/knowledge-points?course=math_analysis").json()["total"] == 1
    # 去重按课程分桶：另一门课的同名知识点合法（跨教材同名不同义）
    assert _add_point(client, course_id="real_analysis")["course_id"] == "real_analysis"


def test_norm_key_normalises_fullwidth_whitespace_and_case(client):
    assert _add_point(client, name="Ｂｏｒｅｌ  有限覆盖")["norm_key"] == "borel 有限覆盖"
    assert _add_point(client, name="  Heine-Borel 定理 ")["norm_key"] == "heine-borel 定理"


def test_point_closed_sets_and_required_fields(client):
    assert client.post(
        "/api/v1/learn/knowledge-points", json={"course_id": "", "name": "x"}
    ).status_code == 422
    assert client.post(
        "/api/v1/learn/knowledge-points", json={"course_id": "math_analysis", "name": ""}
    ).status_code == 422
    assert client.post(
        "/api/v1/learn/knowledge-points", json={"course_id": "math_analysis", "name": "   "}
    ).status_code == 409  # 空白名过不了存储侧非空校验
    assert client.post(
        "/api/v1/learn/knowledge-points",
        json={"course_id": "math_analysis", "name": "n", "type": "nope"},
    ).status_code == 422
    assert client.post(
        "/api/v1/learn/knowledge-points",
        json={"course_id": "math_analysis", "name": "n", "summary": "长" * 1001},
    ).status_code == 422
    # type 可空：分类未定档时由门层按量化门回落，登记面不猜
    assert _add_point(client, name="未分类点", type=None)["type"] is None


def test_point_parent_must_be_outline_in_same_course(client):
    _put_outline(client)
    _put_outline(client, course="linear_algebra")
    chapter = _get_outline(client)[0]["kp_id"]
    alien = _get_outline(client, course="linear_algebra")[0]["kp_id"]

    assert client.post(
        "/api/v1/learn/knowledge-points",
        json={"course_id": "math_analysis", "name": "a", "parent_kp_id": "kp-nope"},
    ).status_code == 404
    point = _add_point(client, name="确界原理", parent_kp_id=chapter)
    assert _add_point(client, name="实数完备性别名", parent_kp_id=chapter)["parent_kp_id"] == chapter
    assert client.post(
        "/api/v1/learn/knowledge-points",
        json={"course_id": "math_analysis", "name": "b", "parent_kp_id": point["kp_id"]},
    ).status_code == 409  # 父级是 point 行
    assert client.post(
        "/api/v1/learn/knowledge-points",
        json={"course_id": "math_analysis", "name": "c", "parent_kp_id": alien},
    ).status_code == 409  # 跨课程归属


# ---------- v1.0 三列：别名 / 长文指针 / 多角度索引 ----------


def test_point_carries_aliases_narrative_ref_and_angles(client):
    """D5 三列入形状：别名可写、长文只留指针、角度索引登记时为空数组。"""
    point = _add_point(
        client,
        aliases=["确界存在定理", "完备性公理"],
        narrative_ref="parsed/math_analysis/kp-shouquan.md",
    )
    assert point["aliases"] == ["确界存在定理", "完备性公理"]
    assert point["narrative_ref"] == "parsed/math_analysis/kp-shouquan.md"
    assert point["angles"] == []
    listed = client.get("/api/v1/learn/knowledge-points?q=确界").json()["points"][0]
    assert listed["aliases"] == ["确界存在定理", "完备性公理"]
    assert listed["angles"] == []
    assert _add_point(client, name="无别名点")["narrative_ref"] == ""


def test_append_angle_updates_same_angle_only(store):
    """条级注解新落点（D10）：同角不堆叠只更新 note，数组序＝权威排序。"""
    point = store.add_point(course_id="math_analysis", name="确界原理")
    first = store.append_angle(point["kp_id"], "explanation", note="第一版注解")
    assert first["angles"] == [{"angle": "explanation", "note": "第一版注解"}]
    second = store.append_angle(point["kp_id"], "theorem")
    assert [a["angle"] for a in second["angles"]] == ["explanation", "theorem"]
    third = store.append_angle(point["kp_id"], "explanation", note="第二版注解")
    assert len(third["angles"]) == 2
    assert next(a for a in third["angles"] if a["angle"] == "explanation")["note"] == "第二版注解"
    # 未提交 note 时不写空键：角度位可以先占位，正文由生成腿后补
    assert store.append_angle(point["kp_id"], "summary")["angles"][-1] == {"angle": "summary"}


def test_append_angle_rejects_unknown_kind(store):
    from qed_engine.services.learn.base import LearnConflict

    point = store.add_point(course_id="math_analysis", name="确界原理")
    with pytest.raises(LearnConflict):
        store.append_angle(point["kp_id"], "vibes")


def test_manual_patch_whitelist_excludes_generated_columns(client):
    """人工面白名单只有归属/展示名/顺序/摘要：别名与生成列不在 PATCH（长文与角度归梳理与生成腿）。"""
    point = _add_point(client, aliases=["旧别名"])
    for field in ("aliases", "narrative_ref", "angles", "type", "node_kind", "meta"):
        assert client.patch(
            f"/api/v1/learn/knowledge-points/{point['kp_id']}", json={field: "x"}
        ).status_code == 422, field
    assert client.patch(
        f"/api/v1/learn/knowledge-points/{point['kp_id']}", json={"name": "改名合法"}
    ).status_code == 200


# ---------- 长文正文读文件腿（GET /learn/knowledge-points/{kp_id}/narrative） ----------


def _narrative_client(monkeypatch, tmp_path, store):
    """数据根指向临时目录（隔离铁律：绝不读写真实 `dataset/`）。"""
    monkeypatch.setenv("QED_DATA_ROOT", str(tmp_path))
    return _make_client(monkeypatch, store)


def _write_narrative(tmp_path, rel, text):
    target = tmp_path / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return rel


def test_narrative_reads_pointer_from_data_root(monkeypatch, tmp_path, store):
    client = _narrative_client(monkeypatch, tmp_path, store)
    rel = _write_narrative(tmp_path, "parsed/math_analysis/kp.md", "上确界是最小上界。")
    point = _add_point(client, narrative_ref=rel)
    body = client.get(f"/api/v1/learn/knowledge-points/{point['kp_id']}/narrative").json()
    assert body == {
        "kp_id": point["kp_id"],
        "narrative_ref": rel,
        "available": True,
        "content": "上确界是最小上界。",
        "truncated": False,
        "bytes": len("上确界是最小上界。".encode()),
        "reason": "",
    }


def test_narrative_pointer_never_stored_as_content(client, store):
    """正文不落库：主表只有指针，列宽 500 装不下长文也不打算装。"""
    point = _add_point(client, narrative_ref="parsed/a/b.md")
    assert "content" not in point
    assert store.points[point["kp_id"]]["narrative_ref"] == "parsed/a/b.md"


def test_narrative_dangling_pointer_is_visible_degradation(monkeypatch, tmp_path, store):
    """指针悬空＝明示缺失（不静默回落空串，界面据此提示而不是显示空白）。"""
    client = _narrative_client(monkeypatch, tmp_path, store)
    no_pointer = _add_point(client, name="无指针点")
    body = client.get(f"/api/v1/learn/knowledge-points/{no_pointer['kp_id']}/narrative").json()
    assert body["available"] is False and body["content"] == ""
    assert "还没有登记" in body["reason"]

    missing = _add_point(client, name="悬空点", narrative_ref="parsed/gone/missing.md")
    dangling = client.get(f"/api/v1/learn/knowledge-points/{missing['kp_id']}/narrative").json()
    assert dangling["available"] is False and dangling["narrative_ref"] == "parsed/gone/missing.md"
    assert "不在数据根里" in dangling["reason"]


def test_narrative_pointer_gate_rejects_escapes(monkeypatch, tmp_path, store):
    """双闸：绝对路径、盘符、非 `parsed/` 前缀、`..` 越根一律 422（数据根其余区域不可读）。"""
    client = _narrative_client(monkeypatch, tmp_path, store)
    needles = [
        str(tmp_path / "parsed" / "x.md"),
        "C:/Windows/win.ini",
        "/etc/passwd",
        "raw/math_analysis/private.md",
        "parsed/../../dataset/private.md",
    ]
    for index, ref in enumerate(needles):
        point = _add_point(client, name=f"闸点{index}", narrative_ref=ref)
        resp = client.get(f"/api/v1/learn/knowledge-points/{point['kp_id']}/narrative")
        assert resp.status_code == 422, (ref, resp.text)


def test_narrative_caps_oversized_file(monkeypatch, tmp_path, store):
    from qed_engine.api.learn import NARRATIVE_MAX_BYTES

    client = _narrative_client(monkeypatch, tmp_path, store)
    rel = _write_narrative(tmp_path, "parsed/big.md", "x" * (NARRATIVE_MAX_BYTES + 10))
    point = _add_point(client, name="超长点", narrative_ref=rel)
    body = client.get(f"/api/v1/learn/knowledge-points/{point['kp_id']}/narrative").json()
    assert body["available"] is True and body["truncated"] is True
    assert body["bytes"] == NARRATIVE_MAX_BYTES + 10
    assert len(body["content"]) == NARRATIVE_MAX_BYTES


def test_narrative_404_for_unknown_point(client):
    assert client.get("/api/v1/learn/knowledge-points/kp-nope/narrative").status_code == 404


# ---------- 知识点检索与课程总览 ----------


def test_list_points_filters_and_paginates(client):
    for name, typ in (("确界原理", "concept"), ("单调有界原理", "concept"), ("求极限步骤", "procedure")):
        _add_point(client, name=name, type=typ)
    assert client.get("/api/v1/learn/knowledge-points?type=concept").json()["total"] == 2
    assert client.get("/api/v1/learn/knowledge-points?q=单调").json()["total"] == 1
    assert client.get("/api/v1/learn/knowledge-points?domain=math-advanced").json()["total"] == 3
    paged = client.get("/api/v1/learn/knowledge-points?limit=2&offset=0").json()
    assert len(paged["points"]) == 2 and paged["total"] == 3
    assert client.get("/api/v1/learn/knowledge-points?type=nope").status_code == 422


def test_course_points_shape_and_sequence_flag(client):
    point = _add_point(client, name="闭区间连续函数性质")
    body = client.get("/api/v1/learn/courses/math_analysis/knowledge-points").json()
    assert body["course"] == {
        "course_id": "math_analysis",
        "name": "数学分析",
        "track": "分析学",
        "domain_id": "math-advanced",
        "description": "极限、连续与一元微积分",
    }
    assert [p["kp_id"] for p in body["points"]] == [point["kp_id"]]
    assert body["total"] == 1
    # 未加入学习面：主数据照常出，序列给空态而不是报错
    assert body["sequence"]["enrolled"] is False
    assert body["sequence"]["units"] == []
    # 目录行无 description 时吐空串（课程页不留占位）
    body_linalg = client.get("/api/v1/learn/courses/linear_algebra/knowledge-points").json()
    assert body_linalg["course"]["description"] == ""
    assert client.get("/api/v1/learn/courses/unknown_course/knowledge-points").status_code == 404


def test_point_queries_exclude_outline_rows_by_default(client):
    _put_outline(client)
    chapters = {r["name"]: r["kp_id"] for r in _get_outline(client)}
    _add_point(client, name="闭区间性质", parent_kp_id=chapters["第1章 实数与函数"])
    _add_point(client, name="数列极限", course_id="real_analysis")

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


def test_star_map_counts_only_point_rows_not_outline(client):
    """章名行（outline）不进知识点数：星图徽标＝可登记的细知识点数。"""
    _put_outline(client)
    _add_point(client, parent_kp_id=_get_outline(client)[0]["kp_id"])
    body = client.get("/api/v1/learn/star-map").json()
    node = next(
        c for t in body["domains"][0]["tracks"] for c in t["courses"] if c["course_id"] == "math_analysis"
    )
    assert node["kp_confirmed"] == 1


# ---------- 错误码与降级（503 三态） ----------


def test_knowledge_endpoints_503_without_store(monkeypatch):
    from qed_engine.clients import tracker_client

    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_PASSWORD", "")
    monkeypatch.setattr(
        tracker_client.TrackerClient, "list_courses_system", lambda self: DEMO_DOMAINS
    )
    orphan = TestClient(create_app(knowledge_store=None))
    assert orphan.get("/api/v1/learn/knowledge-points").status_code == 503
    assert orphan.get("/api/v1/learn/courses/math_analysis/knowledge-points").status_code == 503
    assert orphan.get("/api/v1/learn/courses/math_analysis/outline").status_code == 503
    assert orphan.put("/api/v1/learn/courses/math_analysis/outline", json={
        "book_ref": "b05", "tree": [{"name": "第1章", "page_start": 1, "page_end": 2}]
    }).status_code == 503
    # 星图不依赖新表：目录可达即出图（未配置库时知识点计数降级为 0）
    body = orphan.get("/api/v1/learn/star-map").json()
    assert body["domains"][0]["tracks"][0]["courses"][0]["kp_confirmed"] == 0


class _FakeCountingStore:
    def counts_by_course(self) -> dict[str, dict[str, int]]:
        return {"math_analysis": {"confirmed": 2}}

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
    monkeypatch.setattr(
        tracker_client.TrackerClient, "list_courses_system", lambda self: DEMO_DOMAINS
    )
    monkeypatch.setattr("qed_engine.api.main._startup_db_check", lambda settings: "mocked")
    monkeypatch.setattr(knowledge_module, "ensure_tables", ensure_tables)
    monkeypatch.setattr(
        knowledge_module, "MySQLKnowledgeStore", lambda settings: _FakeCountingStore()
    )
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
    assert "kp_candidates" not in target


# ---------- 章节目录层级（outline 行）与写面 ----------

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
    assert first["parent_kp_id"] is None and "confirmed" not in first
    assert first["book_ref"] == "b05"
    assert first["source_ref"] == {"kind": "book", "ref_id": "b05", "page_start": 9, "page_end": 40}
    child = rows[1]
    assert child["depth"] == 2 and child["parent_kp_id"] == first["kp_id"]
    assert all(r["type"] is None for r in rows)
    assert all(r["aliases"] == [] and r["angles"] == [] for r in rows)
    assert all(store.points[r["kp_id"]]["node_kind"] == "outline" for r in rows)


def test_outline_points_hang_on_chapter_and_count_per_node(client):
    _put_outline(client)
    chapters = {r["name"]: r["kp_id"] for r in _get_outline(client, book="b05")}
    point = _add_point(client, name="确界原理", parent_kp_id=chapters["第1章 实数与函数"])
    assert point["parent_kp_id"] == chapters["第1章 实数与函数"]
    assert point["node_kind"] == "point" and point["book_ref"] is None

    rows = {r["kp_id"]: r for r in _get_outline(client)}
    assert rows[chapters["第1章 实数与函数"]]["point_count"] == 1
    assert rows[chapters["第2章 极限"]]["point_count"] == 0


def test_reimport_outline_reuses_kp_id_and_orphans_dropped_points(client):
    _put_outline(client)
    first = {r["name"]: r["kp_id"] for r in _get_outline(client)}
    point = _add_point(client, name="单调有界原理", parent_kp_id=first["第2章 极限"])

    _put_outline(client, [{"name": "第1章 实数与函数", "page_start": 9, "page_end": 30}])
    rows = _get_outline(client)
    assert [r["name"] for r in rows] == ["第1章 实数与函数"]
    assert rows[0]["kp_id"] == first["第1章 实数与函数"]
    assert rows[0]["source_ref"]["page_end"] == 30

    kept = client.get("/api/v1/learn/knowledge-points?course=math_analysis").json()["points"]
    assert [p["kp_id"] for p in kept] == [point["kp_id"]]
    assert kept[0]["parent_kp_id"] is None  # 失父 → 归未归档池，不删学习痕迹


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
    point = _add_point(client, name="夹逼准则", parent_kp_id=rows["第2章 极限"])

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


# ---------- outline／point 摘要（summary）写入通道 ----------

CHAPTER_TREE_WITH_SUMMARY = [
    {
        "name": "第1章 实数与函数",
        "page_start": 9,
        "page_end": 40,
        "summary": "实数系的完备性，及其上极限运算的准备。",
        "children": [
            {
                "name": "1.1 实数及其运算",
                "page_start": 9,
                "page_end": 20,
                "summary": "有理数稠密性、确界原理与实数四则运算。",
            },
            {"name": "1.2 数轴与绝对值", "page_start": 21, "page_end": 40},
        ],
    },
]


def test_put_outline_writes_optional_summary(client):
    """S1：PUT 目录树节点可带 `summary`，落库后 GET 读回一致。"""
    _put_outline(client, CHAPTER_TREE_WITH_SUMMARY)
    rows = {r["name"]: r for r in _get_outline(client)}
    assert rows["第1章 实数与函数"]["summary"] == "实数系的完备性，及其上极限运算的准备。"
    assert rows["1.1 实数及其运算"]["summary"] == "有理数稠密性、确界原理与实数四则运算。"
    # 未提交 summary 的节点保持列默认空串（响应形状不变，不缺列也不多列）
    assert rows["1.2 数轴与绝对值"]["summary"] == ""


def test_put_outline_rejects_over_long_summary(client):
    """S1：`summary` 超 1000 字符 → 422，且整树不部分写入。"""
    tree = [
        {
            "name": "第1章 实数与函数",
            "page_start": 9,
            "page_end": 40,
            "summary": "长" * 1001,
        }
    ]
    resp = client.put(
        "/api/v1/learn/courses/math_analysis/outline",
        json={"book_ref": "b05", "tree": tree},
    )
    assert resp.status_code == 422, resp.text
    assert _get_outline(client) == []


def test_reimport_outline_keeps_unsubmitted_summary(client):
    """S2：整树重写时未提交 `summary` 的节点保持原值；显式提交空串才清空。"""
    _put_outline(client, CHAPTER_TREE_WITH_SUMMARY)
    written = {r["name"]: r["summary"] for r in _get_outline(client)}
    assert written["第1章 实数与函数"] and written["1.1 实数及其运算"]

    # 第二轮只改页范围、全部节点不提交 summary → 已写好的摘要不得被抹掉
    _put_outline(
        client,
        [
            {
                "name": "第1章 实数与函数",
                "page_start": 9,
                "page_end": 45,
                "children": [
                    {"name": "1.1 实数及其运算", "page_start": 9, "page_end": 20},
                    {"name": "1.2 数轴与绝对值", "page_start": 21, "page_end": 45},
                ],
            }
        ],
    )
    rows = {r["name"]: r for r in _get_outline(client)}
    assert rows["第1章 实数与函数"]["summary"] == written["第1章 实数与函数"]
    assert rows["1.1 实数及其运算"]["summary"] == written["1.1 实数及其运算"]
    assert rows["第1章 实数与函数"]["source_ref"]["page_end"] == 45

    # 显式提交 ""＝清空该节点，同轮未提交的子节点仍保持原值
    _put_outline(
        client,
        [
            {
                "name": "第1章 实数与函数",
                "page_start": 9,
                "page_end": 45,
                "summary": "",
                "children": [
                    {"name": "1.1 实数及其运算", "page_start": 9, "page_end": 20},
                ],
            }
        ],
    )
    rows = {r["name"]: r for r in _get_outline(client)}
    assert rows["第1章 实数与函数"]["summary"] == ""
    assert rows["1.1 实数及其运算"]["summary"] == written["1.1 实数及其运算"]


def test_patch_point_writes_summary_with_length_guard(client):
    """S1：PATCH 白名单带 `summary`（outline 行同样可编辑介绍），超 1000 字符 422。"""
    _put_outline(client)
    chapter = {r["name"]: r["kp_id"] for r in _get_outline(client)}["第1章 实数与函数"]
    resp = client.patch(
        f"/api/v1/learn/knowledge-points/{chapter}",
        json={"summary": "章级介绍：实数系与函数。"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["summary"] == "章级介绍：实数系与函数。"
    assert (
        {r["kp_id"]: r["summary"] for r in _get_outline(client)}[chapter]
        == "章级介绍：实数系与函数。"
    )

    over = client.patch(
        f"/api/v1/learn/knowledge-points/{chapter}", json={"summary": "长" * 1001}
    )
    assert over.status_code == 422, over.text
    assert {r["kp_id"]: r["summary"] for r in _get_outline(client)}[chapter] == "章级介绍：实数系与函数。"


def test_course_points_with_outline_carry_summary(client):
    """S3：`include_outline=true` 的 outline 行带 `summary`，且与 point 行同形状（零新增字段）。"""
    _put_outline(client, CHAPTER_TREE_WITH_SUMMARY)
    point = _add_point(
        client,
        name="确界原理",
        parent_kp_id={r["name"]: r["kp_id"] for r in _get_outline(client)}["第1章 实数与函数"],
    )
    resp = client.get(
        "/api/v1/learn/courses/math_analysis/knowledge-points?include_outline=true"
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()["points"]
    outline_rows = [r for r in rows if r["node_kind"] == "outline"]
    point_rows = [r for r in rows if r["node_kind"] == "point"]
    assert outline_rows and point_rows
    assert {r["name"]: r["summary"] for r in outline_rows}["第1章 实数与函数"] == (
        "实数系的完备性，及其上极限运算的准备。"
    )
    # 同一序列化通道：outline 行与 point 行的键集合一致，形状不因本行变化
    assert set(outline_rows[0]) == set(point_rows[0])
    assert point_rows[0]["kp_id"] == point["kp_id"]


# ---------- v1.0 形状定档：三列入表、候选池退场 ----------


def test_put_outline_fills_domain_and_course_coords(client, store):
    """坐标补全：整树写入必须带领域/课程坐标，与 point 直登记同口径（跨领域检索可信）。"""
    _put_outline(client)
    rows = _get_outline(client)
    assert rows
    assert {r["domain_id"] for r in rows} == {"math-advanced"}
    assert {r["domain_label"] for r in rows} == {"数学（高等数学）"}
    assert {r["course_label"] for r in rows} == {"数学分析"}
    assert {store.points[r["kp_id"]]["domain_id"] for r in rows} == {"math-advanced"}


def test_point_and_outline_share_coords(client):
    """同一课程下 outline 行与 point 行的坐标列一致（历史上 outline 恒空、point 有值）。"""
    _put_outline(client)
    chapter = _get_outline(client)[0]
    point = _add_point(client, parent_kp_id=chapter["kp_id"])
    assert (point["domain_id"], point["domain_label"]) == (
        chapter["domain_id"],
        chapter["domain_label"],
    )
    assert point["course_label"] == chapter["course_label"]


def test_main_table_ddl_declares_v1_shape():
    """DDL 定档：25 列含三枚 v1.0 新列，去重索引按 (course_id,node_kind,norm_key)，book_ref 去空串哨兵，审计两列齐备。"""
    from qed_engine.services.learn.knowledge import _POINT_COLUMNS, CREATE_TABLE_SQL

    assert len(_POINT_COLUMNS.split(",")) == 25
    for column in (
        "aliases JSON",
        "narrative_ref VARCHAR(500) NOT NULL DEFAULT " + chr(39) + chr(39),
        "angles JSON",
    ):
        assert column in CREATE_TABLE_SQL, column
    assert "KEY idx_kp_course_kind_norm (course_id, node_kind, norm_key)" in CREATE_TABLE_SQL
    assert "idx_kp_course_book_norm" not in CREATE_TABLE_SQL
    assert "created_by VARCHAR(16) NOT NULL DEFAULT " + chr(39) + chr(39) in CREATE_TABLE_SQL
    assert "updated_by VARCHAR(16) NOT NULL DEFAULT " + chr(39) + chr(39) in CREATE_TABLE_SQL
    assert "COLLATE=utf8mb4_0900_ai_ci" in CREATE_TABLE_SQL
    book_line = next(
        ln for ln in CREATE_TABLE_SQL.splitlines() if ln.strip().startswith("book_ref")
    )
    assert "NOT NULL" not in book_line


def test_point_row_carries_null_book_ref_not_empty_sentinel(client):
    """去哨兵落地：point 行 book_ref＝NULL（来源书留在 anchors，主表不再用空串表意）。"""
    _put_outline(client)
    point = _add_point(client, parent_kp_id=_get_outline(client)[0]["kp_id"],
                       anchors=[{"kind": "book", "ref_id": "b05", "page": 21}])
    assert point["node_kind"] == "point"
    assert point["book_ref"] is None
    assert point["anchors"][0]["ref_id"] == "b05"


def test_candidate_pool_table_and_routes_are_retired(client):
    """D1/D10 退场守护：池表 DDL、五枚端点与主表确认位列一律不得复活（复活即契约漂移）。"""
    from qed_engine.services.learn import knowledge as knowledge_module

    assert "qe_kp_detail" not in knowledge_module.CREATE_TABLE_SQL
    assert not [p for p in {r.path for r in client.app.routes} if "kp-details" in p]
    _put_outline(client)
    point = _add_point(client, parent_kp_id=_get_outline(client)[0]["kp_id"])
    assert "confirmed" not in point
    assert all("confirmed" not in row for row in _get_outline(client))
    assert all(
        "confirmed" not in row
        for row in client.get("/api/v1/learn/courses/math_analysis/knowledge-points").json()["points"]
    )


def test_point_rows_carry_meta_extension_slot(client):
    """扩展槽定档：主表行形状带 meta（只读不筛，未写入回 None），与 anchors 等 JSON 列同样解码。"""
    _put_outline(client)
    assert _get_outline(client)[0]["meta"] is None
    assert _add_point(client)["meta"] is None
    assert client.get("/api/v1/learn/knowledge-points").json()["points"][0]["meta"] is None


def test_outline_and_point_rows_carry_audit_columns(client):
    """审计列落地：主表两维行都带 created_by/updated_by（与 qed_domain/qed_course 同口径＝写入方标识）。"""
    _put_outline(client)
    outline = _get_outline(client)[0]
    assert outline["created_by"] == "qed_engine" and outline["updated_by"] == "qed_engine"
    point = _add_point(client, parent_kp_id=outline["kp_id"])
    assert point["created_by"] == "qed_engine" and point["updated_by"] == "qed_engine"
    patched = client.patch(
        f"/api/v1/learn/knowledge-points/{point['kp_id']}", json={"summary": "改过的摘要"}
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["created_by"] == "qed_engine"
    assert patched.json()["updated_by"] == "qed_engine"


def test_mysql_knowledge_store_interface_matches_memory_store():
    """两实现同形：内存实现的公开方法在 MySQL 存储上缺一不可（签名漂移即红）。"""
    import inspect

    from qed_engine.services.learn.knowledge import MySQLKnowledgeStore

    def _api(cls):
        return {
            name
            for name, member in inspect.getmembers(cls, predicate=inspect.isfunction)
            if not name.startswith("_")
        }

    assert _api(InMemoryKnowledgeStore) - _api(MySQLKnowledgeStore) == set()


def test_mysql_patch_point_merges_meta_under_dict_cursor(monkeypatch):
    """回归：`patch_point` 的 `meta` 合并腿必须取字典行。

    pymysql 默认游标返回元组，以列名下标即 TypeError ⇒ 章级学习要点生成腿（唯一传 `meta`
    的调用方）在真库上 500；内存实现查不出该差异，故用「默认元组／显式 DictCursor 才字典」
    的假连接复刻真游标语义。
    """
    import json

    from pymysql.cursors import DictCursor
    from qed_engine.config import Settings
    from qed_engine.services.learn import knowledge as knowledge_module

    class _Cursor:
        def __init__(self, conn, as_dict):
            self._conn, self._as_dict = conn, as_dict
            self._row = None

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def execute(self, sql, params=None):
            if sql.lstrip().upper().startswith("SELECT"):
                self._row = ("kp-1", '{"chapter_key_points": ["旧要点"]}')
                if self._as_dict:
                    self._row = {"kp_id": "kp-1", "meta": self._row[1]}
                return
            self._conn.writes.append((sql, params))

        def fetchone(self):
            return self._row

    class _Conn:
        def __init__(self):
            self.writes = []

        def cursor(self, cls=None):
            return _Cursor(self, cls is DictCursor)

        def commit(self):
            pass

        def close(self):
            pass

    conn = _Conn()
    monkeypatch.setattr(knowledge_module, "_connect", lambda settings: conn)
    store = knowledge_module.MySQLKnowledgeStore(Settings())
    monkeypatch.setattr(store, "get_point", lambda kp_id: {"kp_id": kp_id})

    store.patch_point("kp-1", meta={"note": "补充"})

    sql, params = conn.writes[-1]
    assert "meta=%s" in sql
    # 参数尾序＝… meta 值、WHERE kp_id
    merged = json.loads(params[-2])
    assert merged == {"chapter_key_points": ["旧要点"], "note": "补充"}
