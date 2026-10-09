"""学习域（/api/v1/learn/*）契约测试：M-1 三表语义 + 9 端点 + 404/409/422/202 错误码清单。

模块职责：守护学习设计轮主链 M-1/M-2 冻结契约（课程注册 kind 闭集与限长、单元树两级、
covered 学习者独占、编译状态机与两级确认门、派生进度只读）。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/api/learn.py、backend/qed_engine/services/learn/
失效后果：学习域契约漂移，M1/M2 模块按错误形状联调
"""

import time

import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.services.learn import InMemoryLearnStore

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
    course_id = _make_course(client)
    _prepare_compilable(client, course_id)
    _await_compile(client, course_id)
    prog = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog["total"] >= 3 and prog["done"] == 0 and prog["percent"] == 0.0
    unit_id = client.get(
        f"/api/v1/learn/courses/{course_id}/units", params={"level": "unit"}
    ).json()["units"][0]["unit_id"]
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": unit_id, "status": "done"}
    ).status_code == 200
    prog2 = client.get(f"/api/v1/learn/courses/{course_id}/progress").json()
    assert prog2["done"] == 1
    assert prog2["current_unit_id"] != unit_id  # 派生：current=首个未计账单元（重算非累加）
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": unit_id, "status": "bogus"}
    ).status_code == 422
    assert client.post(
        f"/api/v1/learn/courses/{course_id}/progress", json={"unit_id": "missing", "status": "done"}
    ).status_code == 404


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
