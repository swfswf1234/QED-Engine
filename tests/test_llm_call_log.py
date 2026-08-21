"""
模块职责：LLM 调用记录（qed_llm_calls）契约测试：建表 SQL、写入字段、分页检索、降级。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
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

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))
        if "INSERT INTO qed_llm_calls" in sql:
            self.lastrowid = 7

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
    assert "service = %(service)s" in where_sql and "LIMIT" in where_sql and "OFFSET" in where_sql
    assert params["service"] == "qed_tracker" and params["status"] == "success"
    assert "start" in params and "end" in params


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
