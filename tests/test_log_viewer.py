"""
模块职责：日志查看能力（log_viewer）契约测试：白名单/tail 上限/keyword 过滤/越权/编码容错，
以及日志路径解析口径（按单元实际写入点，不按 logs/<log_name>.log 猜测，ADR 0019 第 3 条）。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/services/log_viewer.py、backend/qed_engine/services/service_manager.py
"""

import dataclasses
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.config import Settings
from qed_engine.services import service_manager as sm
from qed_engine.services.log_viewer import LogError, read_log

SCRIPT_MANAGED = ("tracker", "axiom", "web")


def _relocate_workdirs(tmp_path) -> None:
    """把注册表 workdir 指向 tmp 子目录：测试不读写真实仓库与子项目的 logs/（隔离铁律）。

    create_app() 会重新 configure() 覆盖注册表，故每次构建客户端后需再调一次。
    """
    for name, spec in list(sm._SPECS.items()):
        workdir = tmp_path / name
        (workdir / "logs").mkdir(parents=True, exist_ok=True)
        sm._SPECS[name] = dataclasses.replace(spec, workdir=str(workdir))


@pytest.fixture(autouse=True)
def _setup(tmp_path, monkeypatch):
    """确定性环境：注册表构建 + 日志目录指向 tmp_path（避免写真实 logs/ 与子仓库目录）。"""
    sm.configure(Settings())
    sm._OPS.clear()
    sm._MANAGED.clear()
    sm._LOCKED.clear()
    root_logs = tmp_path / "root" / "logs"
    root_logs.mkdir(parents=True)
    monkeypatch.setattr(sm, "LOG_DIR", root_logs)
    _relocate_workdirs(tmp_path)


def _unit_log(service: str) -> Path:
    """单元实际写入点（测试 workdir 下）：脚本托管＝<workdir>/logs/qed-<name>-serve.log。"""
    spec = sm._SPECS[service]
    return Path(spec.workdir) / "logs" / f"qed-{service}-serve.log"


def _write(service: str, lines: list[str]):
    log_file = _unit_log(service)
    log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return log_file


def test_unit_log_path_resolves_actual_write_location():
    """脚本托管单元（tracker/axiom/web）读各自生命周期脚本产物；8900 自身读 config.log。"""
    for name in SCRIPT_MANAGED:
        path = sm.unit_log_path(sm._SPECS[name])
        assert path.name == f"qed-{name}-serve.log", name
        assert path.parent == Path(sm._SPECS[name].workdir) / "logs", name
    config_path = sm.unit_log_path(sm._SPECS["config"])
    assert config_path == sm.LOG_DIR / "config.log"


def test_service_status_log_path_matches_unit_log_path():
    """`/services` 的 log_path 与读取路径同源（同一实际写入点），不再猜测命名。"""
    for name in ("config", *SCRIPT_MANAGED):
        status = sm.service_status(sm._SPECS[name])
        assert status["log_path"] == str(sm.unit_log_path(sm._SPECS[name])), name


def test_unknown_service_raises_log_error(monkeypatch):
    """白名单外服务名（越权）→ LogError。"""
    with pytest.raises(LogError):
        read_log("nonexistent")


def test_missing_log_file_returns_empty_lines():
    """服务从未启动（日志文件不存在）→ 空行列表，不报错。"""
    result = read_log("tracker")
    assert result["service"] == "tracker"
    assert result["lines"] == []
    assert result["log_path"] == str(_unit_log("tracker"))


def test_read_log_returns_tail_lines():
    """tail=3 时只返回后 3 行。"""
    _write("tracker", [f"line-{i}" for i in range(10)])
    result = read_log("tracker", tail=3)
    assert result["lines"] == ["line-7", "line-8", "line-9"]


def test_read_log_tail_capped_at_1000():
    """tail 超上限 1000 → 按 1000 截断（不报错）。"""
    _write("tracker", [f"line-{i}" for i in range(1010)])
    result = read_log("tracker", tail=2000)
    assert len(result["lines"]) == 1000


def test_read_log_default_tail_200():
    """未传 tail → 默认 200 行。"""
    _write("tracker", [f"line-{i}" for i in range(250)])
    result = read_log("tracker")
    assert len(result["lines"]) == 200


def test_read_log_keyword_filters():
    """keyword 子串过滤（过滤后仍取末 N 行）。"""
    _write("tracker", ["error: a", "info: b", "error: c", "info: d"])
    result = read_log("tracker", keyword="error")
    assert result["lines"] == ["error: a", "error: c"]


def test_read_log_utf8_tolerant():
    """非法 UTF-8 字节不抛异常（errors=replace 容错）。"""
    _unit_log("tracker").write_bytes(b"line-1\n\xff\xfe bad\n")
    result = read_log("tracker")
    assert len(result["lines"]) == 2


def test_read_log_tail_zero_returns_empty():
    """tail=0 或负值 → 空行列表（避免 lines[-0:] 返回全量）。"""
    _write("tracker", [f"line-{i}" for i in range(5)])
    assert read_log("tracker", tail=0)["lines"] == []
    assert read_log("tracker", tail=-3)["lines"] == []


def test_read_log_web_uses_root_logs():
    """web 单元 workdir 即仓库根 → 日志在根 logs/qed-web-serve.log（长期清单口径）。"""
    _write("web", ["served"])
    result = read_log("web")
    assert result["lines"] == ["served"]


def _client(monkeypatch, tmp_path):
    from qed_engine.api import control as api_control
    from qed_engine.services.llm import call_log as llm_call_log

    monkeypatch.setenv("QED_MODEL", "qwen-plus")
    # 监督器关闭：不建常驻探测线程（隔离铁律；逻辑由 test_llm_supervisor.py 覆盖）
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    # 隔离 create_app() 启动自检（真实 .env 密钥/数据库不可控，同 test_api.py 模式）：
    # 探测与建表全 mock，避免真实网络请求与真实 CREATE TABLE 副作用
    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: (True, ""))
    monkeypatch.setattr(llm_call_log, "ensure_table", lambda settings: None)
    client = TestClient(create_app())
    _relocate_workdirs(tmp_path)  # create_app 内 configure() 重建注册表后重新指向 tmp
    return client


def test_logs_endpoint_unknown_service_404(monkeypatch, tmp_path):
    """白名单外服务 → 404。"""
    client = _client(monkeypatch, tmp_path)
    response = client.get("/api/v1/logs/nonexistent")
    assert response.status_code == 404
    assert "日志服务不存在" in response.json()["detail"]


def test_logs_endpoint_returns_tail_lines(monkeypatch, tmp_path):
    """正常读取：响应形状 {service, log_path, lines}，tail 生效，路径为实际写入点。"""
    _write("tracker", [f"line-{i}" for i in range(5)])
    client = _client(monkeypatch, tmp_path)
    response = client.get("/api/v1/logs/tracker", params={"tail": 2})
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "tracker"
    assert body["lines"] == ["line-3", "line-4"]
    assert body["log_path"] == str(_unit_log("tracker"))


def test_logs_endpoint_keyword_query(monkeypatch, tmp_path):
    """keyword 查询参数透传。"""
    _write("tracker", ["error: a", "info: b"])
    client = _client(monkeypatch, tmp_path)
    response = client.get("/api/v1/logs/tracker", params={"keyword": "error"})
    assert response.status_code == 200
    assert response.json()["lines"] == ["error: a"]
