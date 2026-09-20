"""
模块职责：LLM 调用记录（qed_llm_calls）契约测试：建表 SQL、写入字段、分页检索、降级。
设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
被测代码：backend/qed_engine/services/llm/call_log.py
"""

from qed_engine.config import Settings
from qed_engine.services.llm import call_log


class FakeCursor:
    def __init__(self):
        self.executed = []
        self.fetchone_result = None
        self.fetchall_result = []
        self.lastrowid = None
        self.rowcount = 0
        self._closed = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self._closed = True  # 模拟 pymysql with 退出即关游标
        return False

    def execute(self, sql, params=None):
        if self._closed:
            raise RuntimeError("Cursor closed")
        self.executed.append((sql, params))
        if "INSERT INTO qed_llm_calls" in sql:
            self.lastrowid = 7
        if "UPDATE qed_llm_calls" in sql:
            # REQ-060：review_call 影响行数（ID 99999 视为不存在）
            self.rowcount = 0 if (params and params.get("id") == 99999) else 1

    def fetchone(self):
        return self.fetchone_result

    def fetchall(self):
        return self.fetchall_result


class FakeConn:
    def __init__(self, fetchone_result=None, fetchall_result=None):
        self.executed = []
        self._fetchone_result = fetchone_result
        self._fetchall_result = fetchall_result

    def cursor(self, *args):
        cursor = FakeCursor()
        cursor.executed = self.executed
        cursor.fetchone_result = self._fetchone_result
        cursor.fetchall_result = self._fetchall_result
        return cursor

    def commit(self):
        pass

    def close(self):
        pass


def _settings() -> Settings:
    return Settings(_env_file=None, qed_db_password="sk-test")


def test_ensure_table_creates_if_not_exists(monkeypatch):
    """建表 SQL：CREATE TABLE IF NOT EXISTS qed_llm_calls（幂等）。"""
    conn = FakeConn()
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    call_log.ensure_table(_settings())
    sql = conn.executed[0][0]
    assert "CREATE TABLE IF NOT EXISTS" in sql and "qed_llm_calls" in sql
    assert "prompt_template" in sql and "duration_ms" in sql and "created_at" in sql


def test_record_call_inserts_fields(monkeypatch):
    """写入：INSERT 含 service/mode/provider/model/endpoint/prompt/response/duration/status。"""
    conn = FakeConn()
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    call_id = call_log.record_call(
        _settings(),
        service="qed_engine", mode="api", provider="qwen", model="qwen-plus",
        endpoint="text", prompt="你好", response="你好！",
        duration_ms=123, status="success", error="", prompt_template="greeting",
    )
    assert call_id is not None
    assert call_id == 7
    sql, params = conn.executed[1]
    assert "INSERT INTO qed_llm_calls" in sql
    assert params["service"] == "qed_engine" and params["prompt"] == "你好"


def test_record_call_degrades_when_db_down(monkeypatch, caplog):
    """数据库不可达：降级返回 None，不抛异常（记日志）。"""
    import logging

    def boom(settings):
        raise RuntimeError("connect refused")

    monkeypatch.setattr(call_log, "_connect", boom)
    with caplog.at_level(logging.WARNING, logger="qed_engine.llm"):
        assert call_log.record_call(_settings(), service="qed_engine", mode="api",
                                    provider="qwen", model="m", endpoint="text",
                                    prompt="p", response="r", duration_ms=1,
                                    status="success", error="") is None


def test_search_calls_filters_and_paginates(monkeypatch):
    """检索：WHERE 过滤（service/status/时间）+ ORDER BY id DESC + LIMIT/OFFSET + COUNT。"""
    conn = FakeConn(fetchone_result={"n": 3}, fetchall_result=[{"id": 9, "service": "qed_engine"}])
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    result = call_log.search_calls(
        _settings(), service="qed_tracker", status="success",
        start="2026-08-01", end="2026-08-20", page=1, size=10,
    )
    assert result["total"] == 3
    assert result["items"][0]["id"] == 9
    sqls = [s for s, _ in conn.executed]
    assert any("COUNT(*)" in s for s in sqls)
    where_sql, params = conn.executed[-1]
    assert "service = %s" in where_sql and "LIMIT" in where_sql and "OFFSET" in where_sql
    assert params[0] == "qed_tracker" and params[1] == "success"
    assert len(params) >= 4  # service, status, start, end, limit, offset


def test_search_calls_bad_date_degrades():
    """非法日期（start="abc"）：不抛异常，降级返回空结果（与查询失败降级契约一致）。"""
    result = call_log.search_calls(_settings(), start="abc")
    assert result == {"items": [], "total": 0, "page": 1, "size": 20}


def test_search_calls_clamps_pagination(monkeypatch):
    """分页钳制：size 上限 200（0 归 20）、page 下限 1（0/负值归 1）。"""
    conn = FakeConn(fetchone_result={"n": 0})
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    result = call_log.search_calls(_settings(), page=0, size=0)
    assert (result["page"], result["size"]) == (1, 20)
    result = call_log.search_calls(_settings(), page=-3, size=999)
    assert (result["page"], result["size"]) == (1, 200)


# --- REQ-060：Schema 扩展 + 新过滤 + 审核 ---


def test_ensure_table_includes_new_columns(monkeypatch):
    """建表 SQL 含 REQ-060 新列：task/step/review_status/review_note。"""
    conn = FakeConn()
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    call_log.ensure_table(_settings())
    sql = conn.executed[0][0]
    assert "task VARCHAR(64)" in sql
    assert "step VARCHAR(32)" in sql
    assert "review_status VARCHAR(16)" in sql
    assert "review_note VARCHAR(1000)" in sql
    assert "DEFAULT 'unreviewed'" in sql


def test_record_call_includes_new_fields(monkeypatch):
    """写入：INSERT 含 task/step/review_status/review_note。"""
    conn = FakeConn()
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    call_log.record_call(
        _settings(),
        service="qed_tracker", mode="api", provider="qwen", model="qwen-plus",
        endpoint="text", prompt="p", response="r", duration_ms=100,
        status="success", task="paper-plan", step="plan",
        review_status="unreviewed", review_note="",
    )
    sql, params = conn.executed[1]
    assert "task" in sql and "step" in sql and "review_status" in sql and "review_note" in sql
    assert params["task"] == "paper-plan" and params["step"] == "plan"
    assert params["review_status"] == "unreviewed"


def test_search_calls_new_filters(monkeypatch):
    """检索：task/step/prompt_template/review_status 过滤。"""
    conn = FakeConn(fetchone_result={"n": 1}, fetchall_result=[{"id": 5}])
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    result = call_log.search_calls(
        _settings(),
        task="paper-plan", step="assess",
        prompt_template="paper-plan", review_status="passed",
        page=1, size=10,
    )
    assert result["total"] == 1
    sql, params = conn.executed[-1]
    assert "task = %s" in sql
    assert "step = %s" in sql
    assert "prompt_template LIKE %s" in sql
    assert "review_status = %s" in sql
    assert "paper-plan" in params
    assert "%paper-plan%" in params
    assert "passed" in params


def test_review_call_updates(monkeypatch):
    """审核：review_call UPDATE 返回 True。"""
    conn = FakeConn()
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    ok = call_log.review_call(
        _settings(), call_id=42, review_status="passed", review_note="效果好",
    )
    assert ok is True
    sql, params = conn.executed[-1]
    assert "UPDATE qed_llm_calls" in sql
    assert "review_status" in sql and "review_note" in sql
    assert params["id"] == 42
    assert params["review_status"] == "passed"
    assert params["review_note"] == "效果好"


def test_review_call_not_found(monkeypatch):
    """审核：review_call 不存在 ID 返回 False。"""
    conn = FakeConn()
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    ok = call_log.review_call(
        _settings(), call_id=99999, review_status="rejected",
    )
    assert ok is False


# --- 表/列注释补齐（2026-08-28，与 shared-tables.md 表3 文案对齐）---


def test_create_table_sql_carries_comments():
    """建表 SQL 带表注释与列注释（新库直接带注释）。"""
    sql = call_log.CREATE_TABLE_SQL
    assert "COMMENT='LLM 调用审计表" in sql
    assert "COMMENT '调用方标识" in sql
    assert "COMMENT '调用模式" in sql
    assert "COMMENT '模板编号" in sql
    assert "COMMENT '审核态" in sql


def test_ensure_comments_alters_only_stale_columns(monkeypatch):
    """ensure_comments：只对注释缺失/不一致的非自增列 ALTER；一致列跳过。"""
    conn = FakeConn(fetchall_result=[
        # id（自增主键）不在返回中也应被跳过；service 注释缺失；mode 一致
        {"COLUMN_NAME": "service", "COLUMN_TYPE": "varchar(32)",
         "IS_NULLABLE": "NO", "COLUMN_DEFAULT": None, "COLUMN_COMMENT": ""},
        {"COLUMN_NAME": "mode", "COLUMN_TYPE": "varchar(16)",
         "IS_NULLABLE": "NO", "COLUMN_DEFAULT": None,
         "COLUMN_COMMENT": call_log._COLUMN_COMMENTS["mode"]},
    ])
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    altered = call_log.ensure_comments(_settings())
    assert altered == ["service"]
    alter_sqls = [s for s, _ in conn.executed if "MODIFY COLUMN" in s]
    assert len(alter_sqls) == 1
    assert "COMMENT '调用方标识" in alter_sqls[0]
    # 表注释幂等更新（无列级 ALTER 时也要校正表注释）
    assert any("ALTER TABLE qed_llm_calls COMMENT" in s for s, _ in conn.executed)


def test_ensure_comments_rebuilds_defaults(monkeypatch):
    """ensure_comments：重建列定义保留 NOT NULL 与字符串默认值。"""
    conn = FakeConn(fetchall_result=[
        {"COLUMN_NAME": "review_status", "COLUMN_TYPE": "varchar(16)",
         "IS_NULLABLE": "YES", "COLUMN_DEFAULT": "unreviewed", "COLUMN_COMMENT": "旧"},
    ])
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    altered = call_log.ensure_comments(_settings())
    assert altered == ["review_status"]
    sql = [s for s, _ in conn.executed if "MODIFY COLUMN" in s][0]
    assert "varchar(16)" in sql and "DEFAULT 'unreviewed'" in sql
    assert "COMMENT '审核态" in sql
