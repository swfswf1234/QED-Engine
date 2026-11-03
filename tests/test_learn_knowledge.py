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

import httpx
import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.clients.axiom_client import AxiomClient
from qed_engine.services.learn import InMemoryKnowledgeStore, InMemoryLearnStore

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
    # 两键分桶（ADR 0027 D4）：直登记即人已背书，故 total 与 confirmed 相等
    assert node["kp_total"] == 2 and node["kp_confirmed"] == 2
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
    assert point["confirm_state"] == "confirmed"  # 人工直登记＝人已背书（ADR 0027 D2①）
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


def test_course_points_read_cap_reports_truncation_honestly(client, monkeypatch):
    """P0-2 读量如实：整课一次取全的封顶是显式常量，被封顶时响应自证截断，不静默少给（REQ-147 W2）。"""
    from qed_engine.api import learn as learn_api

    # 封顶只能是常量：曾经的 500 是写死在调用行的魔法数，现网单课已近其半
    assert learn_api.KP_COURSE_READ_LIMIT >= 3000

    monkeypatch.setattr(learn_api, "KP_COURSE_READ_LIMIT", 2)
    for name in ("确界原理", "单调有界定理", "闭区间连续函数性质"):
        _add_point(client, name=name)

    body = client.get("/api/v1/learn/courses/math_analysis/knowledge-points").json()
    assert body["total"] == 3
    assert len(body["points"]) == 2
    assert body["truncated"] is True

    _add_point(client, course_id="real_analysis", name="勒贝格积分")
    other = client.get("/api/v1/learn/courses/real_analysis/knowledge-points").json()
    assert other["total"] == 1 and len(other["points"]) == 1
    assert other["truncated"] is False


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
    node = _star_course(client)
    assert node["kp_total"] == 1 and node["kp_confirmed"] == 1


def test_star_map_two_keys_tell_two_different_facts(client):
    """`kp_total`＝机器整理出来的点数、`kp_confirmed`＝人真背过的点数（ADR 0027 D4）。

    现网 93 行全 `unconfirmed`——若仍按旧义把 point 行数塞进 `kp_confirmed`，「已确认」就成了
    谎话；若反过来按 confirmed 过滤，REQ-147 刚点亮的整理度图元会整体熄灭。两键分开的正是这两头。
    """
    _put_outline(client)
    chapter = _get_outline(client)[0]["kp_id"]
    signed = _add_point(client, parent_kp_id=chapter, name="确界原理")
    withdrawn = _add_point(client, parent_kp_id=chapter, name="单调有界原理")
    client.patch(
        f"/api/v1/learn/knowledge-points/{signed['kp_id']}", json={"confirm_state": "unconfirmed"}
    )
    client.patch(
        f"/api/v1/learn/knowledge-points/{withdrawn['kp_id']}", json={"confirm_state": "rejected"}
    )
    node = _star_course(client)
    assert node["kp_total"] == 1, "驳回行不计数，未确认行照数——整理度与人工背书互不遮蔽"
    assert node["kp_confirmed"] == 0


def test_rejected_rows_leave_the_learner_reads(client):
    """D3 读面判据＝排除 `rejected` 其余照画：检索列表、课内总览、目录三处同闸；
    单行翻案不经本闸——被驳回者仍可按 `kp_id` PATCH 回来（人工通道要能触到驳回行）。"""
    _put_outline(client)
    chapter = _get_outline(client)[0]
    kept = _add_point(client, parent_kp_id=chapter["kp_id"], name="确界原理")
    dropped = _add_point(client, parent_kp_id=chapter["kp_id"], name="单调有界原理")
    client.patch(
        f"/api/v1/learn/knowledge-points/{dropped['kp_id']}", json={"confirm_state": "rejected"}
    )
    client.patch(
        f"/api/v1/learn/knowledge-points/{chapter['kp_id']}", json={"confirm_state": "rejected"}
    )

    listing = client.get("/api/v1/learn/knowledge-points?course=math_analysis").json()
    assert [p["kp_id"] for p in listing["points"]] == [kept["kp_id"]], "只剩未驳回那一条"
    assert listing["total"] == 1

    course_body = client.get("/api/v1/learn/courses/math_analysis/knowledge-points").json()
    assert {p["name"] for p in course_body["points"]} == {"确界原理"}
    assert course_body["total"] == 1
    with_outline = client.get(
        "/api/v1/learn/courses/math_analysis/knowledge-points?include_outline=true"
    ).json()
    assert "第1章 实数与函数" not in {p["name"] for p in with_outline["points"]}

    assert chapter["kp_id"] not in {row["kp_id"] for row in _get_outline(client)}
    assert _star_course(client)["kp_total"] == 1

    revived = client.patch(
        f"/api/v1/learn/knowledge-points/{dropped['kp_id']}",
        json={"confirm_state": "unconfirmed"},
    ).json()
    assert revived["confirm_state"] == "unconfirmed"
    assert client.get("/api/v1/learn/knowledge-points?course=math_analysis").json()["total"] == 2


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
    assert body["domains"][0]["tracks"][0]["courses"][0]["kp_total"] == 0


class _FakeCountingStore:
    def counts_by_course(self) -> dict[str, dict[str, int]]:
        return {"math_analysis": {"total": 3, "confirmed": 2}}

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
    assert target["kp_total"] == 3 and target["kp_confirmed"] == 2
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


def _star_course(client, course_id="math_analysis"):
    body = client.get("/api/v1/learn/star-map").json()
    return next(
        course
        for track in body["domains"][0]["tracks"]
        for course in track["courses"]
        if course["course_id"] == course_id
    )


def test_put_outline_writes_two_level_tree_as_unconfirmed_rows(client, store):
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
    # 整树写入只落结构，不替人签字：人工位由列默认落 unconfirmed（ADR 0027 D2）
    assert first["parent_kp_id"] is None and first["confirm_state"] == "unconfirmed"
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

    # 驳回行不进学习面（ADR 0027 D3）：目录计数同样不数它
    rejected = _add_point(client, name="待驳回的知识点", parent_kp_id=chapters["第1章 实数与函数"])
    assert client.patch(
        f"/api/v1/learn/knowledge-points/{rejected['kp_id']}",
        json={"confirm_state": "rejected"},
    ).status_code == 200
    rows = {r["kp_id"]: r for r in _get_outline(client)}
    assert rows[chapters["第1章 实数与函数"]]["point_count"] == 1


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


def test_patch_confirm_state_is_the_human_signing_path(client):
    """提升腿三通路之②＝PATCH 置位：可背书、可驳回、可翻案；闭集外取值与旧布尔键都 422（ADR 0027 D2②）。"""
    _put_outline(client)
    chapter = _get_outline(client)[0]
    row = _add_point(client, name="夹逼准则", parent_kp_id=chapter["kp_id"], type="concept")
    assert row["confirm_state"] == "confirmed"

    rejected = client.patch(
        f"/api/v1/learn/knowledge-points/{row['kp_id']}", json={"confirm_state": "rejected"}
    ).json()
    assert rejected["confirm_state"] == "rejected"
    downgraded = client.patch(
        f"/api/v1/learn/knowledge-points/{row['kp_id']}", json={"confirm_state": "unconfirmed"}
    ).json()
    assert downgraded["confirm_state"] == "unconfirmed"
    # 章行同样可被人工背书（本列两类行通用，学习面判据只看 rejected）
    assert client.patch(
        f"/api/v1/learn/knowledge-points/{chapter['kp_id']}", json={"confirm_state": "confirmed"}
    ).json()["confirm_state"] == "confirmed"

    assert client.patch(
        f"/api/v1/learn/knowledge-points/{row['kp_id']}", json={"confirm_state": "approved"}
    ).status_code == 422
    assert client.patch(
        f"/api/v1/learn/knowledge-points/{row['kp_id']}", json={"confirmed": 1}
    ).status_code == 422
    # null＝不改（NOT NULL 列没有清空语义）
    cleared = client.patch(
        f"/api/v1/learn/knowledge-points/{row['kp_id']}", json={"confirm_state": None, "order_hint": 4}
    ).json()
    assert cleared["order_hint"] == 4 and cleared["confirm_state"] == "unconfirmed"


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
    """DDL 定档：26 列含三枚 v1.0 新列与 `confirm_state`，去重索引按 (course_id,node_kind,norm_key)，book_ref 去空串哨兵，审计两列齐备。"""
    from qed_engine.services.learn.knowledge import _POINT_COLUMNS, CREATE_TABLE_SQL

    assert len(_POINT_COLUMNS.split(",")) == 26
    for column in (
        "aliases JSON",
        "narrative_ref VARCHAR(500) NOT NULL DEFAULT " + chr(39) + chr(39),
        "angles JSON",
        "confirm_state VARCHAR(16) NOT NULL DEFAULT " + chr(39) + "unconfirmed" + chr(39),
    ):
        assert column in CREATE_TABLE_SQL, column
    assert "KEY idx_kp_course_kind_norm (course_id, node_kind, norm_key)" in CREATE_TABLE_SQL
    assert "idx_kp_course_book_norm" not in CREATE_TABLE_SQL
    assert "created_by VARCHAR(16) NOT NULL DEFAULT " + chr(39) + chr(39) in CREATE_TABLE_SQL
    assert "updated_by VARCHAR(16) NOT NULL DEFAULT " + chr(39) + chr(39) in CREATE_TABLE_SQL
    assert "COLLATE=utf8mb4_0900_ai_ci" in CREATE_TABLE_SQL
    assert "DROP" not in CREATE_TABLE_SQL.upper()
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
    """D1/D10 退场守护：池表 DDL 与五枚端点不得复活，布尔确认键 `confirmed` 也不得复活。

    确认态自 ADR 0027 起由实列 `confirm_state` 承载（三值、可按列筛），
    「存在即已确认」的恒真位形态永远是退役态。
    """
    from qed_engine.services.learn import knowledge as knowledge_module

    assert "qe_kp_detail" not in knowledge_module.CREATE_TABLE_SQL
    assert not [p for p in {r.path for r in client.app.routes} if "kp-details" in p]
    _put_outline(client)
    point = _add_point(client, parent_kp_id=_get_outline(client)[0]["kp_id"])
    assert "confirmed" not in point and point["confirm_state"] == "confirmed"
    assert all("confirmed" not in row for row in _get_outline(client))
    assert all(
        "confirmed" not in row
        for row in client.get("/api/v1/learn/courses/math_analysis/knowledge-points").json()["points"]
    )


def test_ensure_columns_backfills_confirm_state_idempotently(monkeypatch):
    """追加式补列守护（ADR 0027 D7）：缺列才 ALTER、已存在零动作，绝不隐式 DROP。"""
    from types import SimpleNamespace

    from qed_engine.services.learn import knowledge as knowledge_module

    settings = SimpleNamespace(qed_db_name="qed_test")
    absent = _RecordingConn([])
    monkeypatch.setattr(knowledge_module, "_connect", lambda _settings: absent)
    assert knowledge_module.ensure_columns(settings) == ["confirm_state"]
    added = [sql for sql in absent.executed if sql.startswith("ALTER TABLE")]
    assert len(added) == 1
    assert "ADD COLUMN confirm_state VARCHAR(16) NOT NULL DEFAULT " + chr(39) + "unconfirmed" in added[0]

    present = _RecordingConn([("kp_id",), ("confirm_state",)])
    monkeypatch.setattr(knowledge_module, "_connect", lambda _settings: present)
    assert knowledge_module.ensure_columns(settings) == []
    assert not [sql for sql in present.executed if sql.startswith("ALTER TABLE")]


class _RecordingCursor:
    def __init__(self, conn: "_RecordingConn") -> None:
        self._conn = conn

    def __enter__(self) -> "_RecordingCursor":
        return self

    def __exit__(self, *exc: object) -> bool:
        return False

    def execute(self, sql: str, params: object = None) -> None:
        self._conn.executed.append(sql)

    def fetchall(self) -> list[tuple[str, ...]]:
        return self._conn.rows


class _RecordingConn:
    """假连接：只记录执行过的语句，供 `ensure_columns` 的幂等判据取证（不触真实库）。"""

    def __init__(self, rows: list[tuple[str, ...]]) -> None:
        self.rows = rows
        self.executed: list[str] = []

    def cursor(self) -> _RecordingCursor:
        return _RecordingCursor(self)

    def commit(self) -> None:
        pass

    def close(self) -> None:
        pass


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


# ---------- 提升同步腿（af_kp 在册成品 → 共享主表；REQ-144 裁乙） ----------

SYNC_BOOK_A = "mathanalysis-b05"
SYNC_BOOK_B = "mathanalysis-b12"
_UNSET = object()


def _af(
    node_id, name, *, depth, parent_id=None, kind="outline", status="candidate",
    role="knowledge", summary="", pages=(12, 14), anchors=_UNSET, narrative_ref="",
    order_hint=1, book=SYNC_BOOK_A, node_type=_UNSET, toc_kind="", confirmed=0,
):
    """造一枚 `af_kp` 工作区行（形状照现网 ④ 透传读数：锚的 ref_id 是页 id 不是书 id）。

    `node_type` 默认不发键（＝上游旧形态，供 ADR 0028 的回落判据用例）；显式给值时按现网
    ④ 派生键形状带上。`toc_kind` 默认空串（现网知识行为空，习题行取 `exercise`）。
    `confirmed`＝梳理侧人工位（现网读数全 0，ADR 0027 取证）。
    """
    start, end = pages if pages is not None else (None, None)
    if anchors is _UNSET:
        anchors = (
            []
            if pages is None
            else [{"kind": "page_block", "page": start, "ref_id": f"p{start:04d}", "snippet": name}]
        )
    row = {
        "node_id": node_id, "book_id": book, "job_id": "job-1", "node_kind": kind,
        "parent_id": parent_id, "depth": depth, "order_hint": order_hint, "name": name,
        "role": "", "type": "", "summary": summary, "links": [], "anchors": list(anchors),
        "narrative_ref": narrative_ref, "gen_status": status, "gen_batch": "afkp-batch-1",
        "model_ref": "rule:toc", "toc_role": role, "toc_kind": toc_kind, "confirmed": confirmed,
        "rev": 1,
        "created_at": "2026-10-29T17:10:29", "updated_at": "2026-10-29T17:31:34",
    }
    if node_type is not _UNSET:
        row["node_type"] = node_type
    if pages is not None:
        row["page_start"] = start
        row["page_end"] = end
    return row


def _clean_workspace(**overrides):
    """一本典型教材的在册成品：1 章（含导读指针）＋2 节，外加三类不进目录的行。"""
    ws = {
        SYNC_BOOK_A: [
            _af("afkp-ref", "前言", depth=1, role="reference", pages=(4, 4)),
            _af("afkp-ch1", "第1章 实数", depth=1, pages=(9, 40), summary="章总结甲",
                narrative_ref="afkp-ch1.md"),
            _af("afkp-p1", "确界原理", depth=2, parent_id="afkp-ch1", pages=(9, 9),
                summary="点总结一", order_hint=1),
            _af("afkp-p2", "单调有界原理", depth=2, parent_id="afkp-ch1", pages=(10, 12),
                summary="", order_hint=2),
            _af("afkp-rej", "被驳回的节", depth=2, parent_id="afkp-ch1", status="rejected"),
            _af("afkp-det", "挂在 reference 章下的节", depth=2, parent_id="afkp-ref"),
            _af("afkp-old", "内容批次遗留点行", kind="point", depth=None, parent_id="afkp-p1"),
        ],
        SYNC_BOOK_B: [],
    }
    ws.update(overrides)
    return ws


def _sync_client(monkeypatch, store, workspace=None, *, fail=None, offline=False, enroll=True,
                 book_roles=None):
    """学习记录＋主表＋8902 工作区三面同场（MockTransport，不触真实库与网络）。

    `book_roles`＝8901 书目腿的 `qt_books` 行（只喂角色判据用）；默认空表＝角色未知、
    提升腿不做过滤。真机 8901 在跑也不进测试（隔离铁律）。
    """
    from qed_engine.clients import tracker_client

    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("QED_API_SELECT", "api")
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    monkeypatch.setenv("QED_DB_PASSWORD", "")
    monkeypatch.setattr(
        tracker_client.TrackerClient, "list_courses_system", lambda self: DEMO_DOMAINS
    )
    monkeypatch.setattr(
        tracker_client.TrackerClient, "list_books", lambda self, **kw: book_roles or []
    )
    rows = _clean_workspace() if workspace is None else workspace
    errors = {} if fail is None else fail

    def _handler(request):
        if offline:
            raise httpx.ConnectError("axiom down", request=request)
        parts = request.url.path.split("/")
        book_id = parts[parts.index("books") + 1]
        if book_id in errors:
            return httpx.Response(errors[book_id], json={"detail": "上游点名"})
        return httpx.Response(200, json={"book_id": book_id, "nodes": rows.get(book_id, []),
                                         "in_flight_batch": None, "review_flags": []})

    learn_store = InMemoryLearnStore()
    client = TestClient(
        create_app(
            learn_store=learn_store,
            knowledge_store=store,
            axiom_client=AxiomClient(
                base_url="http://axiom.test", transport=httpx.MockTransport(_handler)
            ),
        )
    )
    if enroll:
        client.post(
            "/api/v1/learn/courses",
            json={
                "course_id": "math_analysis",
                "resources": [
                    {"kind": "book", "ref_id": SYNC_BOOK_A, "label": "数学分析（上）"},
                    {"kind": "book", "ref_id": SYNC_BOOK_B, "label": "数学分析（下）"},
                ],
            },
        )
    return client


def _sync(client, course_id="math_analysis"):
    resp = client.post(f"/api/v1/learn/courses/{course_id}/knowledge-points/sync")
    assert resp.status_code == 200, resp.text
    return resp.json()


def _sequence(client, course_id="math_analysis"):
    resp = client.get(f"/api/v1/learn/courses/{course_id}/knowledge-points")
    assert resp.status_code == 200, resp.text
    return resp.json()["sequence"]


def _promoted_points(store, book_ref):
    """某本教材在主表里的提升点行名（角色跳过腿的「零写入／不删存量」判据用）。"""
    return {
        str(row["name"]) for row in store.points.values()
        if row.get("node_kind") == "point"
        and str((row.get("source_ref") or {}).get("ref_id") or "") == book_ref
    }


def test_sync_promotes_only_clean_chapters_and_points(monkeypatch, store):
    body = _sync(_sync_client(monkeypatch, store))
    book = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_A)
    assert book["ok"] is True
    assert book["chapters"]["created"] == 1 and book["chapters"]["reused"] == 0
    assert book["points"]["created"] == 2
    assert book["excluded"] == {"rejected": 1, "reference": 1, "exercise": 0, "point_rows": 1}
    assert book["detached"] == 1

    assert [row["name"] for row in store.list_outline("math_analysis", SYNC_BOOK_A)] == [
        "第1章 实数"
    ]
    names = sorted(row["name"] for row in store.points.values() if row["node_kind"] == "point")
    assert names == ["单调有界原理", "确界原理"]


def test_sync_mirrors_upstream_confirm_flag_up_only(monkeypatch, store):
    """提升腿三通路之③＝按上游 `af_kp.confirmed` 镜像且只升不降，机器路径永不写 rejected（ADR 0027 D2③）。"""
    ws = {
        SYNC_BOOK_A: [
            _af("afkp-ch1", "第1章 实数", depth=1, pages=(9, 40), confirmed=1),
            _af("afkp-p1", "确界原理", depth=2, parent_id="afkp-ch1", pages=(9, 9), confirmed=1),
            _af("afkp-p2", "单调有界原理", depth=2, parent_id="afkp-ch1", pages=(10, 12)),
        ],
        SYNC_BOOK_B: [],
    }
    _sync(_sync_client(monkeypatch, store, workspace=ws))
    chapter = store.list_outline("math_analysis", SYNC_BOOK_A)[0]
    points = {
        str(row["name"]): str(row["kp_id"])
        for row in store.points.values() if row["node_kind"] == "point"
    }
    assert chapter["confirm_state"] == "confirmed"
    assert store.get_point(points["确界原理"])["confirm_state"] == "confirmed"
    assert store.get_point(points["单调有界原理"])["confirm_state"] == "unconfirmed"

    # 上游人工位被撤回＝机器不得据此抹掉人的判定（现网读数全 0，存量因此一律 unconfirmed）
    for row in ws[SYNC_BOOK_A]:
        row["confirmed"] = 0
    _sync(_sync_client(monkeypatch, store, workspace=ws))
    assert store.get_point(chapter["kp_id"])["confirm_state"] == "confirmed"
    assert store.get_point(points["确界原理"])["confirm_state"] == "confirmed"
    assert all(row["confirm_state"] != "rejected" for row in store.points.values())


def test_demo_gate_machine_to_human_end_to_end(monkeypatch, store):
    """REQ-148 W1 demo 门＝一行知识点从「机器整理出来」走到「人真背过」再被驳回的整链读数。

    每步只换一个动作，判据一律从端点取（不读 store 内部）：提升腿（上游未背书）落
    `unconfirmed` → 星图两键 1/0 → `PATCH confirmed` → 两键 1/1 → `PATCH rejected` →
    学习面与两键一起退场 → `PATCH unconfirmed` 翻案回场（人工通道要能触到驳回行）。
    """
    client = _sync_client(monkeypatch, store, workspace={
        SYNC_BOOK_A: [
            _af("afkp-ch1", "第1章 实数", depth=1, pages=(9, 40)),
            _af("afkp-p1", "确界原理", depth=2, parent_id="afkp-ch1", pages=(9, 9)),
        ],
        SYNC_BOOK_B: [],
    })
    _sync(client)

    def _course_point(name):
        body = client.get(
            "/api/v1/learn/courses/math_analysis/knowledge-points?include_outline=true"
        ).json()
        return next(p for p in body["points"] if p["name"] == name)

    point = _course_point("确界原理")
    assert point["confirm_state"] == "unconfirmed", "机器提升、上游没背书＝不得自称已确认"
    node = _star_course(client)
    assert (node["kp_total"], node["kp_confirmed"]) == (1, 0), "整理度照数，背书数归零"

    signed = client.patch(
        f"/api/v1/learn/knowledge-points/{point['kp_id']}", json={"confirm_state": "confirmed"}
    ).json()
    assert signed["confirm_state"] == "confirmed"
    node = _star_course(client)
    assert (node["kp_total"], node["kp_confirmed"]) == (1, 1), "两键各说各事，人签字才进第二键"

    rejected = client.patch(
        f"/api/v1/learn/knowledge-points/{point['kp_id']}", json={"confirm_state": "rejected"}
    ).json()
    assert rejected["confirm_state"] == "rejected"
    assert client.get("/api/v1/learn/knowledge-points?course=math_analysis").json()["total"] == 0
    node = _star_course(client)
    assert (node["kp_total"], node["kp_confirmed"]) == (0, 0), "驳回行既不进列表也不进整理度"

    revived = client.patch(
        f"/api/v1/learn/knowledge-points/{point['kp_id']}", json={"confirm_state": "unconfirmed"}
    ).json()
    assert revived["confirm_state"] == "unconfirmed"
    node = _star_course(client)
    assert (node["kp_total"], node["kp_confirmed"]) == (1, 0), "翻案后回到未背书但照画的状态"
    assert _course_point("确界原理")["kp_id"] == point["kp_id"], "全链只动一列，行本身不换身份"


def test_sync_excludes_exercise_rows_by_node_type(monkeypatch, store):
    """ADR 0028 G3 主判据：`node_type=='exercise'` 的行不提升——即便形状正是 REQ-146 S1 将产的
    「父＝所属章的 depth2」（现网 0 污染属巧合，落闸后才是防线）。"""
    ws = {
        SYNC_BOOK_A: [
            _af("afkp-ch1", "第1章 实数", depth=1, pages=(9, 40)),
            _af("afkp-p1", "确界原理", depth=2, parent_id="afkp-ch1", pages=(9, 9)),
            _af("afkp-ex", "习题 1.2", depth=2, parent_id="afkp-ch1", pages=(38, 40),
                node_type="exercise", toc_kind="exercise"),
            _af("afkp-other", "总复习", depth=2, parent_id="afkp-ch1", pages=(41, 41),
                node_type="other"),
        ],
        SYNC_BOOK_B: [],
    }
    body = _sync(_sync_client(monkeypatch, store, workspace=ws))
    book = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_A)
    assert book["excluded"]["exercise"] == 1
    promoted = sorted(row["name"] for row in store.points.values() if row["node_kind"] == "point")
    assert promoted == ["总复习", "确界原理"]


def test_sync_excludes_exercise_rows_by_toc_kind_fallback(monkeypatch, store):
    """ADR 0028 G3 回落判据：上游少发 `node_type` 时按 `toc_kind=='exercise'` 仍拦住——
    闸不许因上游收窄键而静默失效。"""
    ws = {
        SYNC_BOOK_A: [
            _af("afkp-ch1", "第1章 实数", depth=1, pages=(9, 40)),
            _af("afkp-ex", "习题", depth=2, parent_id="afkp-ch1", pages=(38, 40),
                toc_kind="exercise"),
        ],
        SYNC_BOOK_B: [],
    }
    body = _sync(_sync_client(monkeypatch, store, workspace=ws))
    book = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_A)
    assert book["excluded"]["exercise"] == 1
    assert _promoted_points(store, SYNC_BOOK_A) == set()


def test_sync_exercise_gate_keeps_survivor_counts_and_response_shape(monkeypatch, store):
    """端到端：闸落在 `reference` 之后、不改章与点的幸存计数口径，响应 `excluded` 出四枚键。"""
    ws = {
        SYNC_BOOK_A: [
            _af("afkp-ref", "前言", depth=1, role="reference", pages=(4, 4)),
            _af("afkp-ch1", "第1章 实数", depth=1, pages=(9, 40)),
            _af("afkp-p1", "确界原理", depth=2, parent_id="afkp-ch1", pages=(9, 9)),
            _af("afkp-ex", "习题 1.2", depth=2, parent_id="afkp-ch1", pages=(38, 40),
                node_type="exercise"),
            _af("afkp-rej", "被驳回的节", depth=2, parent_id="afkp-ch1", status="rejected",
                node_type="point"),
        ],
        SYNC_BOOK_B: [],
    }
    body = _sync(_sync_client(monkeypatch, store, workspace=ws))
    book = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_A)
    assert book["excluded"] == {"rejected": 1, "reference": 1, "exercise": 1, "point_rows": 0}
    assert book["chapters"]["created"] == 1
    assert book["points"]["created"] == 1
    assert [row["name"] for row in store.list_outline("math_analysis", SYNC_BOOK_A)] == [
        "第1章 实数"
    ]


def test_sync_sequence_reads_promoted_rows_with_book_scoped_window(monkeypatch, store):
    client = _sync_client(monkeypatch, store)
    _sync(client)
    sequence = _sequence(client)
    chapters = sequence["chapters"]
    assert [chapter["name"] for chapter in chapters] == ["第1章 实数"]
    # 段① 本章总结＝章行 summary 直读；段② 导读腿的取数键＝章行提升锚
    assert chapters[0]["summary"] == "章总结甲"
    assert chapters[0]["from_detail_id"] == "afkp-ch1"
    units = sequence["units"]
    assert [unit["title"] for unit in units] == ["确界原理", "单调有界原理"]
    assert units[0]["source_ref"] == {
        "kind": "book", "ref_id": SYNC_BOOK_A, "page_start": 9, "page_end": 9
    }
    assert units[0]["window_source"] == "point"
    assert units[0]["book_ref"] == SYNC_BOOK_A  # 归本位随投影给出（T4 按书切的取数依据）
    # 页两键缺失者回落锚派生，且锚的 ref_id 已归一为书 id（不是 p0009 页 id）
    assert units[0]["anchors"][0]["ref_id"] == SYNC_BOOK_A
    assert units[0]["summary"] == "点总结一"
    assert units[1]["summary"] == ""


def test_rejected_points_leave_the_course_sequence(monkeypatch, store):
    """学习序列走同一道读闸：驳回的知识点不进推进单元，其余照排（机器提升与人工驳回同判据）。"""
    client = _sync_client(monkeypatch, store)
    _sync(client)
    assert [unit["title"] for unit in _sequence(client)["units"]] == ["确界原理", "单调有界原理"]
    rejected = next(row for row in store.points.values() if row["name"] == "单调有界原理")
    store.patch_point(rejected["kp_id"], confirm_state="rejected")
    assert [unit["title"] for unit in _sequence(client)["units"]] == ["确界原理"]


def test_sync_sequence_rows_belong_to_their_own_book(monkeypatch, store):
    """两本混排时每行归本＝所属章的 `book_ref`（工作台按书切 T4 的取数依据，主表 point 行本身不带）。"""
    book_b = [
        _af("afkp-b-ch", "第2章 极限", depth=1, pages=(41, 90), book=SYNC_BOOK_B),
        _af("afkp-b-p1", "数列极限", depth=2, parent_id="afkp-b-ch", pages=(41, 41),
            summary="点总结乙", book=SYNC_BOOK_B),
    ]
    client = _sync_client(monkeypatch, store, workspace={**_clean_workspace(), SYNC_BOOK_B: book_b})
    _sync(client)
    sequence = _sequence(client)
    book_of_chapter = {row["kp_id"]: row["book_ref"] for row in sequence["chapters"]}
    assert set(book_of_chapter.values()) == {SYNC_BOOK_A, SYNC_BOOK_B}
    assert {unit["book_ref"] for unit in sequence["units"]} == {SYNC_BOOK_A, SYNC_BOOK_B}
    for unit in sequence["units"]:
        assert unit["book_ref"] == book_of_chapter[unit["chapter_kp_id"]]
    assert [unit["title"] for unit in sequence["units"] if unit["book_ref"] == SYNC_BOOK_B] == [
        "数列极限"
    ]


def test_sync_is_idempotent_and_refreshes_summaries(monkeypatch, store):
    workspace = _clean_workspace()
    client = _sync_client(monkeypatch, store, workspace)
    _sync(client)
    chapter_id = store.list_outline("math_analysis", SYNC_BOOK_A)[0]["kp_id"]
    point_ids = {
        row["from_detail_id"]: row["kp_id"]
        for row in store.points.values()
        if row["node_kind"] == "point"
    }

    second = _sync(client)
    book = next(item for item in second["books"] if item["book_ref"] == SYNC_BOOK_A)
    assert book["chapters"] == {"created": 0, "reused": 1, "dropped": 0, "orphaned_points": 0}
    assert book["points"]["created"] == 0 and book["points"]["reused"] == 2
    assert store.list_outline("math_analysis", SYNC_BOOK_A)[0]["kp_id"] == chapter_id
    assert {
        row["from_detail_id"]: row["kp_id"]
        for row in store.points.values()
        if row["node_kind"] == "point"
    } == point_ids

    workspace[SYNC_BOOK_A][1]["summary"] = "章总结乙"
    workspace[SYNC_BOOK_A][2]["summary"] = "点总结二"
    _sync(client)
    assert store.get_point(chapter_id)["summary"] == "章总结乙"
    assert store.get_point(point_ids["afkp-p1"])["summary"] == "点总结二"


def test_sync_drops_chapter_removed_upstream_and_orphans_its_points(monkeypatch, store):
    workspace = _clean_workspace()
    client = _sync_client(monkeypatch, store, workspace)
    _sync(client)
    point = next(row for row in store.points.values() if row["name"] == "确界原理")
    assert point["parent_kp_id"] is not None

    workspace[SYNC_BOOK_A][1]["gen_status"] = "rejected"
    body = _sync(client)
    book = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_A)
    assert book["chapters"]["dropped"] == 1 and book["chapters"]["orphaned_points"] == 2
    assert store.get_point(point["kp_id"])["parent_kp_id"] is None
    assert _sequence(client)["units"] == []


def test_sync_skips_cross_book_name_collision_without_failing_batch(monkeypatch, store):
    workspace = _clean_workspace()
    workspace[SYNC_BOOK_B] = [
        _af("afkp-b-ch", "第2章 极限", depth=1, pages=(41, 90), book=SYNC_BOOK_B),
        _af("afkp-b-p1", "确界原理", depth=2, parent_id="afkp-b-ch", pages=(41, 42),
            summary="另一本的同号节", book=SYNC_BOOK_B),
        _af("afkp-b-p2", "子列", depth=2, parent_id="afkp-b-ch", pages=(43, 44),
            book=SYNC_BOOK_B),
    ]
    client = _sync_client(monkeypatch, store, workspace)
    body = _sync(client)
    book_b = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_B)
    assert book_b["points"] == {"created": 1, "reused": 0, "skipped": 1}
    assert book_b["detached"] == 0
    rows = [row for row in store.points.values() if row["node_kind"] == "point"]
    assert {row["name"] for row in rows} == {"确界原理", "单调有界原理", "子列"}
    assert all(row["name"] != "确界原理" or row["from_detail_id"] == "afkp-p1" for row in rows)


def test_sync_isolates_book_without_workspace_and_503_when_upstream_offline(monkeypatch, store):
    client = _sync_client(monkeypatch, store, fail={SYNC_BOOK_B: 404})
    body = _sync(client)
    book_b = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_B)
    assert book_b["ok"] is False and book_b["status"] == 404
    assert store.list_outline("math_analysis", SYNC_BOOK_B) == []
    assert len([row for row in store.points.values() if row["node_kind"] == "point"]) == 2

    offline = _sync_client(monkeypatch, store, offline=True)
    resp = offline.post("/api/v1/learn/courses/math_analysis/knowledge-points/sync")
    assert resp.status_code == 503
    assert "梳理侧" in resp.json()["detail"]


def test_sync_leaves_unreviewed_book_subtree_untouched(monkeypatch, store):
    """未梳理（零纯净章）的教材整本跳过：不动它已有的人工目录子树。"""
    client = _sync_client(monkeypatch, store, workspace={SYNC_BOOK_A: [], SYNC_BOOK_B: []})
    client.put(
        "/api/v1/learn/courses/math_analysis/outline",
        json={"book_ref": SYNC_BOOK_B, "tree": [{"name": "人工整理的章", "page_start": 1,
                                                 "page_end": 9}]},
    )
    body = _sync(client)
    book_b = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_B)
    assert book_b["ok"] is True and book_b["skipped_empty"] is True
    assert [row["name"] for row in store.list_outline("math_analysis", SYNC_BOOK_B)] == [
        "人工整理的章"
    ]


def test_sync_leaves_half_reviewed_book_subtree_untouched(monkeypatch, store):
    """只出前置后置行的半梳理态同属「本腿还没落笔」：章层零纯净章 ⇒ 整本跳过，不抹人工子树。"""
    half = [_af("afkp-ref", "前言", depth=1, role="reference", pages=(4, 4))]
    client = _sync_client(
        monkeypatch, store, workspace={SYNC_BOOK_A: [], SYNC_BOOK_B: half}
    )
    client.put(
        "/api/v1/learn/courses/math_analysis/outline",
        json={"book_ref": SYNC_BOOK_B, "tree": [{"name": "人工整理的章", "page_start": 1,
                                                 "page_end": 9}]},
    )
    body = _sync(client)
    book_b = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_B)
    assert book_b["skipped_empty"] is True
    assert book_b["excluded"] == {"rejected": 0, "reference": 1, "exercise": 0, "point_rows": 0}
    assert [row["name"] for row in store.list_outline("math_analysis", SYNC_BOOK_B)] == [
        "人工整理的章"
    ]


def test_sync_skips_exercise_book_whole_and_writes_nothing(monkeypatch, store):
    """习题集整本不进课程学习面（T5）：判据落服务端一处，跳过腿零写入，别本照常提升、总数不含它。"""
    client = _sync_client(
        monkeypatch, store, book_roles=[{"book_id": SYNC_BOOK_B, "roles": ["exercises"]}]
    )
    body = _sync(client)
    book_b = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_B)
    assert book_b["ok"] is True and book_b["skipped_role"] is True
    assert book_b["skipped_empty"] is False
    assert book_b["chapters"] == {"created": 0, "reused": 0, "dropped": 0, "orphaned_points": 0}
    assert store.list_outline("math_analysis", SYNC_BOOK_B) == []
    book_a = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_A)
    assert book_a["chapters"]["created"] == 1
    assert body["totals"]["chapters"]["created"] == 1
    assert body["totals"]["points"]["created"] == 2


def test_role_skip_does_not_drop_existing_promoted_rows(monkeypatch, store):
    """角色判据只管新笔：既有提升行不随跳过删除（存量清理另案 W10，判据本身不做删除动作）。"""
    promoted = [_af("afkp-b-ch", "第2章 极限", depth=1, pages=(41, 90), book=SYNC_BOOK_B),
                _af("afkp-b-p1", "数列极限", depth=2, parent_id="afkp-b-ch", pages=(41, 41),
                    book=SYNC_BOOK_B)]
    first = _sync_client(monkeypatch, store, workspace={SYNC_BOOK_A: [], SYNC_BOOK_B: promoted})
    _sync(first)
    assert len(store.list_outline("math_analysis", SYNC_BOOK_B)) == 1
    assert _promoted_points(store, SYNC_BOOK_B) == {"数列极限"}

    second = _sync_client(
        monkeypatch, store,
        workspace={SYNC_BOOK_A: [], SYNC_BOOK_B: promoted},
        book_roles=[{"book_id": SYNC_BOOK_B, "roles": ["exercises"]}],
    )
    body = _sync(second)
    book_b = next(item for item in body["books"] if item["book_ref"] == SYNC_BOOK_B)
    assert book_b["skipped_role"] is True
    assert len(store.list_outline("math_analysis", SYNC_BOOK_B)) == 1
    assert _promoted_points(store, SYNC_BOOK_B) == {"数列极限"}


def test_sync_404_when_course_not_enrolled(monkeypatch, store):
    client = _sync_client(monkeypatch, store, enroll=False)
    resp = client.post("/api/v1/learn/courses/math_analysis/knowledge-points/sync")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "学习域实体不存在：math_analysis"


def test_machine_only_keys_stay_closed_on_human_faces(client):
    """提升锚与页窗只由同步腿写：POST 静默忽略 source_ref、PATCH 白名单不含两枚机器键。"""
    created = client.post(
        "/api/v1/learn/knowledge-points",
        json={"course_id": "math_analysis", "name": "手工登记的点", "type": "concept",
              "source_ref": {"kind": "book", "ref_id": "b05", "page_start": 1, "page_end": 2}},
    ).json()
    assert created["source_ref"] is None

    rejected = client.patch(
        f"/api/v1/learn/knowledge-points/{created['kp_id']}",
        json={"from_detail_id": "afkp-x"},
    )
    assert rejected.status_code == 422
    assert "from_detail_id" in rejected.text

