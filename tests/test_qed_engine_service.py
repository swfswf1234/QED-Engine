"""
模块职责：守护 scripts/qed_engine_service.py（8900 后端生命周期脚本）契约——
PID 文件路径、serve 命令、health 探测端口、--mode api|local 与子命令结构。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：scripts/qed_engine_service.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "qed_engine_service.py"


def test_engine_service_script_exists():
    """qed_engine_service.py 应存在。"""
    assert SCRIPT.is_file(), "scripts/qed_engine_service.py 不存在"


def test_engine_service_script_pid_file_and_serve_command():
    """PID 文件 = logs/qed-engine.pid；serve 命令 = python -m uvicorn qed_engine.api.main:app。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "qed-engine.pid" in src
    assert "qed_engine.api.main:app" in src


def test_engine_service_script_health_probe_port():
    """health 探测端口默认 8900，端点 /api/v1/health。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "8900" in src
    assert "/api/v1/health" in src


def test_engine_service_script_mode_support():
    """--mode api|local：QED_API_SELECT 环境变量注入子进程。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "--mode" in src and "api" in src and "local" in src
    assert "QED_API_SELECT" in src


def test_engine_service_script_subcommands():
    """子命令齐全：start / stop / restart / status。"""
    src = SCRIPT.read_text(encoding="utf-8")
    for cmd in ("start", "stop", "restart", "status"):
        assert cmd in src, f"脚本缺少子命令 {cmd}"


def test_mode_env_injected_into_child(monkeypatch, tmp_path):
    """start --mode local：子进程 env 含 QED_API_SELECT=local（local 模式启用）。"""
    import importlib.util
    import subprocess

    spec = importlib.util.spec_from_file_location("qed_engine_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    monkeypatch.setattr(mod, "PID_FILE", tmp_path / "qed-engine.pid")
    monkeypatch.setattr(mod, "SERVE_LOG", tmp_path / "serve.log")
    monkeypatch.setattr(mod, "LOG_DIR", tmp_path)
    captured: dict = {}

    def fake_popen(cmd, **kwargs):
        captured.update(kwargs)
        return type("P", (), {"pid": 4242})()

    monkeypatch.setattr(subprocess, "Popen", fake_popen)
    assert mod._spawn(mode="local") == 0
    assert captured["env"]["QED_API_SELECT"] == "local"


def test_pid_is_alive_gbk_output(monkeypatch):
    """中文 Windows 下 tasklist 输出 GBK（Python utf-8 解码失败 → stdout=None）时，
    _pid_is_alive 不得抛 TypeError，应返回 False（进程状态未知，走端口探测兜底）。"""
    import importlib.util
    import subprocess

    spec = importlib.util.spec_from_file_location("qed_engine_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # 场景 1：解码失败 → stdout 为 None（2026-08-18 真实故障复现：UnicodeDecodeError
    # 0xcf 为「像」GBK 首字节 → readerthread 中断 → result.stdout=None → TypeError）
    captured: dict = {}

    def fake_run(*args, **kwargs):
        captured.update(kwargs)
        return type("R", (), {"returncode": 0, "stdout": None})()

    monkeypatch.setattr(subprocess, "run", fake_run)
    assert mod._pid_is_alive(9999) is False, "stdout=None 时应返回 False 而非抛 TypeError"
    # 场景 2：应显式容忍非 utf-8 输出（errors=replace），否则 GBK 表头会中断读取
    assert captured.get("errors") == "replace", "subprocess.run 应带 errors='replace' 容忍 GBK 输出"

    # 场景 3：正常输出（utf-8 ASCII tasklist 表头）仍能判定存在
    def fake_run_ok(*args, **kwargs):
        return type("R", (), {
            "returncode": 0,
            "stdout": "\nImage Name                     PID Session Name\n... 9999 ...\n",
        })()

    monkeypatch.setattr(subprocess, "run", fake_run_ok)
    assert mod._pid_is_alive(9999) is True
