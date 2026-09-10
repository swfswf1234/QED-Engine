"""
模块职责：守护 scripts/qed_engine_service.py（8900 后端生命周期脚本）契约——
PID 文件路径、serve 命令、health 探测端口、--mode api|local 与子命令结构。
设计关联（DesignRef）：docs/design/llm-gateway.md
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


# --- 停止可靠性（2026-09-04 假 stopped 根因修复，与 qed_web_service.py 同构） ---


def _load_script_module():
    """加载被测脚本模块（importlib，避免包导入路径依赖）。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_engine_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_proc_alive_real_process_liveness():
    """_proc_alive 真实判定：当前进程 True；已退出子进程 False；pid<=0 False。"""
    import os
    import subprocess
    import sys

    mod = _load_script_module()
    assert mod._proc_alive(os.getpid()) is True, "当前进程应判定存活"
    victim = subprocess.Popen([sys.executable, "-c", "pass"])
    victim.wait()
    assert mod._proc_alive(victim.pid) is False, "已退出进程应判定死亡"
    assert mod._proc_alive(0) is False and mod._proc_alive(-1) is False


def test_kill_tree_visible_failure_and_success(monkeypatch):
    """_kill_tree 返回 bool：成功 True；taskkill 失败/异常打印诊断返回 False（不静默吞错）。"""
    mod = _load_script_module()
    captured: dict = {}

    def fake_run_ok(cmd, **kwargs):
        captured.update(cmd=cmd, **kwargs)
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    monkeypatch.setattr(mod.subprocess, "run", fake_run_ok)
    assert mod._kill_tree(123) is True
    assert captured["cmd"] == ["taskkill", "/PID", "123", "/T", "/F"], "必须 /T /F 强杀整树"

    monkeypatch.setattr(
        mod.subprocess, "run",
        lambda cmd, **kw: type("R", (), {"returncode": 128, "stdout": "错误: 拒绝访问。", "stderr": ""})(),
    )
    assert mod._kill_tree(123) is False

    def fake_run_boom(cmd, **kwargs):
        raise mod.subprocess.SubprocessError("taskkill vanished")

    monkeypatch.setattr(mod.subprocess, "run", fake_run_boom)
    assert mod._kill_tree(123) is False, "taskkill 异常不得抛出、必须返回 False"


def test_cmd_stop_never_fakes_success(monkeypatch, tmp_path, capsys):
    """缺陷①回归：优雅+强杀两腿都失效时，stop 必须退出码 1 报错，绝不打印假 stopped
    （2026-09-04 实机故障：stop 回显 stopped 而 uvicorn 7364 仍服务 8900）。"""
    mod = _load_script_module()
    pid_file = tmp_path / "qed-engine.pid"
    pid_file.write_text("7364", encoding="utf-8")
    monkeypatch.setattr(mod, "PID_FILE", pid_file)
    monkeypatch.setattr(mod, "_proc_alive", lambda pid: True)  # 模拟目标始终存活
    monkeypatch.setattr(mod, "_kill_tree", lambda pid: False)  # 模拟强杀失效
    monkeypatch.setattr(mod, "STOP_GRACE_SECONDS", 0.1)
    monkeypatch.setattr(mod.os, "kill", lambda pid, sig: None)
    assert mod.cmd_stop(type("A", (), {})()) == 1
    out = capsys.readouterr().out
    assert "stop failed" in out, "两腿失效必须显式报错"
    assert "stopped" not in out.replace("stop failed", ""), "绝不打印假 stopped"
    assert pid_file.exists(), "失败时不清理 PID 文件（保留现场供手动恢复）"


def test_cmd_stop_forced_when_graceful_signal_ignored(monkeypatch, tmp_path, capsys):
    """CTRL_BREAK 空放场景：宽限后 taskkill 强杀生效 → stopped (forced) + 清理 PID 文件。"""
    mod = _load_script_module()
    pid_file = tmp_path / "qed-engine.pid"
    pid_file.write_text("7364", encoding="utf-8")
    monkeypatch.setattr(mod, "PID_FILE", pid_file)
    monkeypatch.setattr(mod, "STOP_GRACE_SECONDS", 0.1)
    monkeypatch.setattr(mod.os, "kill", lambda pid, sig: None)  # 信号发出但被忽略
    alive = {"flag": True}

    def fake_kill_tree(pid):
        alive["flag"] = False
        return True

    monkeypatch.setattr(mod, "_proc_alive", lambda pid: alive["flag"])
    monkeypatch.setattr(mod, "_kill_tree", fake_kill_tree)
    assert mod.cmd_stop(type("A", (), {})()) == 0
    out = capsys.readouterr().out
    assert "stopped (forced)" in out, "CTRL_BREAK 未生效走强杀时应标注 (forced)"
    assert not pid_file.exists(), "成功停止后应清理 PID 文件"
