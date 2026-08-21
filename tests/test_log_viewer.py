"""
模块职责：日志查看能力（log_viewer）契约测试：白名单/tail 上限/keyword 过滤/越权/编码容错。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/services/log_viewer.py
"""

import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.config import Settings
from qed_engine.services import service_manager as sm
from qed_engine.services.log_viewer import LogError, read_log


@pytest.fixture(autouse=True)
def _setup(tmp_path, monkeypatch):
    """确定性环境：注册表构建 + 日志目录指向 tmp_path（避免写真实 logs/）。"""
    sm.configure(Settings())
    sm._OPS.clear()
    sm._MANAGED.clear()
    sm._LOCKED.clear()
    monkeypatch.setattr(sm, "LOG_DIR", tmp_path)


def _write(monkeypatch, lines):
    log_file = sm.LOG_DIR / "tracker.log"
    log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return log_file


def test_unknown_service_raises_log_error(monkeypatch):
    """白名单外服务名（越权）→ LogError。"""
    with pytest.raises(LogError):
        read_log("nonexistent")


def test_missing_log_file_returns_empty_lines(monkeypatch):
    """服务从未启动（日志文件不存在）→ 空行列表，不报错。"""
    result = read_log("tracker")
    assert result["service"] == "tracker"
    assert result["lines"] == []
    assert result["log_path"].endswith("tracker.log")


def test_read_log_returns_tail_lines(monkeypatch):
    """tail=3 时只返回后 3 行。"""
    _write(monkeypatch, [f"line-{i}" for i in range(10)])
    result = read_log("tracker", tail=3)
    assert result["lines"] == ["line-7", "line-8", "line-9"]


def test_read_log_tail_capped_at_1000(monkeypatch):
    """tail 超上限 1000 → 按 1000 截断（不报错）。"""
    _write(monkeypatch, [f"line-{i}" for i in range(1010)])
    result = read_log("tracker", tail=2000)
    assert len(result["lines"]) == 1000


def test_read_log_default_tail_200(monkeypatch):
    """未传 tail → 默认 200 行。"""
    _write(monkeypatch, [f"line-{i}" for i in range(250)])
    result = read_log("tracker")
    assert len(result["lines"]) == 200


def test_read_log_keyword_filters(monkeypatch):
    """keyword 子串过滤（过滤后仍取末 N 行）。"""
    _write(monkeypatch, ["error: a", "info: b", "error: c", "info: d"])
    result = read_log("tracker", keyword="error")
    assert result["lines"] == ["error: a", "error: c"]


def test_read_log_utf8_tolerant(monkeypatch):
    """非法 UTF-8 字节不抛异常（errors=replace 容错）。"""
    (sm.LOG_DIR / "tracker.log").write_bytes(b"line-1\n\xff\xfe bad\n")
    result = read_log("tracker")
    assert len(result["lines"]) == 2


def test_read_log_tail_zero_returns_empty(monkeypatch):
    """tail=0 或负值 → 空行列表（避免 lines[-0:] 返回全量）。"""
    _write(monkeypatch, [f"line-{i}" for i in range(5)])
    assert read_log("tracker", tail=0)["lines"] == []
    assert read_log("tracker", tail=-3)["lines"] == []


def _client(monkeypatch):
    from qed_engine.api import control as api_control
    from qed_engine.services.llm import call_log as llm_call_log

    monkeypatch.setenv("QED_MODEL", "qwen-plus")
    # 隔离 create_app() 启动自检（真实 .env 密钥/数据库不可控，同 test_api.py 模式）：
    # 探测与建表全 mock，避免真实网络请求与真实 CREATE TABLE 副作用
    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: (True, ""))
    monkeypatch.setattr(llm_call_log, "ensure_table", lambda settings: None)
    return TestClient(create_app())


def test_logs_endpoint_unknown_service_404(monkeypatch):
    """白名单外服务 → 404。"""
    client = _client(monkeypatch)
    response = client.get("/api/v1/logs/nonexistent")
    assert response.status_code == 404
    assert "日志服务不存在" in response.json()["detail"]


def test_logs_endpoint_returns_tail_lines(monkeypatch):
    """正常读取：响应形状 {service, log_path, lines}，tail 生效。"""
    _write(monkeypatch, [f"line-{i}" for i in range(5)])
    client = _client(monkeypatch)
    response = client.get("/api/v1/logs/tracker", params={"tail": 2})
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "tracker"
    assert body["lines"] == ["line-3", "line-4"]
    assert body["log_path"].endswith("tracker.log")


def test_logs_endpoint_keyword_query(monkeypatch):
    """keyword 查询参数透传。"""
    _write(monkeypatch, ["error: a", "info: b"])
    client = _client(monkeypatch)
    response = client.get("/api/v1/logs/tracker", params={"keyword": "error"})
    assert response.status_code == 200
    assert response.json()["lines"] == ["error: a"]
