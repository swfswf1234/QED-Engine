"""
模块职责：8900 自身重启（self-restart）契约测试：spawn 延迟启动/失败语义/不破坏 /services。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/services/service_manager.py
"""

import pytest
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.config import Settings
from qed_engine.services import service_manager as sm
from qed_engine.services.service_manager import ServiceError


@pytest.fixture(autouse=True)
def _setup(tmp_path, monkeypatch):
    """确定性环境：注册表构建 + 日志目录指向 tmp_path。"""
    sm.configure(Settings())
    sm._OPS.clear()
    sm._MANAGED.clear()
    sm._LOCKED.clear()
    sm._RESTARTING = False
    monkeypatch.setattr(sm, "LOG_DIR", tmp_path)


def _patch_popen(monkeypatch, record=None):
    class FakeProcess:
        pid = 9999

        def poll(self):
            return None

        def kill(self):
            pass

    created: list = []

    def fake_popen(cmd, **kwargs):
        if record is not None:
            record.append(cmd)
        proc = FakeProcess()
        created.append(proc)
        return proc

    monkeypatch.setattr(sm.subprocess, "Popen", fake_popen)
    return created


def _patch_thread(monkeypatch):
    """捕获后台退出线程的 target，不真实启动（避免测试进程被 os._exit 杀死）。"""

    class FakeThread:
        def __init__(self, target, **kwargs):
            self.target = target

        def start(self):
            pass

    captured = []
    monkeypatch.setattr(
        sm.threading,
        "Thread",
        lambda target, **kw: captured.append(target) or FakeThread(target, **kw),
    )
    return captured


def test_restart_self_spawns_delayed_command_and_returns_restarting(monkeypatch):
    """spawn 延迟启动命令（ping 等待端口释放）成功 → 返回 {"status": "restarting"}。"""
    record = []
    _patch_popen(monkeypatch, record=record)
    _patch_thread(monkeypatch)
    result = sm.restart_self()
    assert result == {"status": "restarting"}
    assert "ping" in " ".join(record[0])
    assert "uvicorn" in " ".join(record[0])
    assert "8900" in " ".join(record[0])


def test_restart_self_ping_delay_uses_sys_executable(monkeypatch):
    """延迟启动命令：sys.executable 首元素（不依赖 PATH 上无 uvicorn 的 base python）+ ping 延迟。"""
    import sys

    record = []
    _patch_popen(monkeypatch, record=record)
    _patch_thread(monkeypatch)
    sm.restart_self()
    joined = " ".join(record[0])
    assert "timeout" not in joined
    assert "ping" in joined
    assert "uvicorn" in joined
    delayed, startup = joined.split(" && ", 1)
    assert startup.startswith(sys.executable)


def test_restart_self_concurrent_conflict(monkeypatch):
    """上一轮重启未退出期间重复请求 → ServiceError(409)。"""
    _patch_popen(monkeypatch)
    _patch_thread(monkeypatch)
    sm.restart_self()
    with pytest.raises(ServiceError) as excinfo:
        sm.restart_self()
    assert excinfo.value.status_code == 409


def test_restart_self_schedules_exit_thread(monkeypatch):
    """后台退出线程已登记（旧进程延迟 os._exit）。"""
    _patch_popen(monkeypatch)
    targets = _patch_thread(monkeypatch)
    sm.restart_self()
    assert len(targets) == 1


def test_restart_self_popen_failure_raises_service_error(monkeypatch):
    """新进程启动异常 → ServiceError(500) + 日志句柄关闭（Popen 失败句柄守护）。"""
    import builtins

    closed = []

    class FakeLogFile:
        def close(self):
            closed.append(True)

    monkeypatch.setattr(builtins, "open", lambda *a, **k: FakeLogFile())

    def boom(*args, **kwargs):
        raise OSError(267, "目录名无效")

    monkeypatch.setattr(sm.subprocess, "Popen", boom)
    with pytest.raises(ServiceError) as excinfo:
        sm.restart_self()
    assert excinfo.value.status_code == 500
    assert "人工重启" in excinfo.value.message
    assert closed, "Popen 失败后日志句柄应被关闭"


def _client(monkeypatch):
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
    return TestClient(create_app())


def test_self_restart_endpoint_returns_restarting(monkeypatch):
    """POST /self-restart：成功 → 200 {"status": "restarting"}。"""
    from qed_engine.api import control

    monkeypatch.setattr(control, "restart_self", lambda: {"status": "restarting"})
    client = _client(monkeypatch)
    response = client.post("/api/v1/self-restart")
    assert response.status_code == 200
    assert response.json() == {"status": "restarting"}


def test_self_restart_endpoint_failure_returns_500(monkeypatch):
    """spawn 失败 → 500 + 中文提示（人工重启）。"""
    from qed_engine.api import control

    def boom():
        raise ServiceError("8900 重启失败：新进程启动异常，请人工重启", status_code=500)

    monkeypatch.setattr(control, "restart_self", boom)
    client = _client(monkeypatch)
    response = client.post("/api/v1/self-restart")
    assert response.status_code == 500
    assert "人工重启" in response.json()["detail"]


def test_services_config_still_conflicts(monkeypatch):
    """self-restart 不影响 /services 语义：config 单元启停仍 409。"""
    client = _client(monkeypatch)
    for action in ("start", "stop", "restart"):
        response = client.post(f"/api/v1/services/config/{action}")
        assert response.status_code == 409, action
