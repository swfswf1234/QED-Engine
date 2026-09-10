"""
模块职责：守护 scripts/qed_web_service.py（8903 前端服务生命周期脚本）契约——
PID 文件路径、serve 命令、health 探测端口与子命令结构，防与 service-hosting.md 注册表
（`web` 单元）及 8900 service_manager 接入契约漂移；冷启动构建门禁
（start --build、dist 缺失自动兜底、失败不启动、restart 不构建）。
设计关联（DesignRef）：docs/design/service-hosting.md（REQ-03x：web 单元接入）
实现状态：Current
被测代码：scripts/qed_web_service.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "qed_web_service.py"


def test_web_service_script_exists():
    """qed_web_service.py 应存在（8900 `web` 单元 lifecycle_script 指向它）。"""
    assert SCRIPT.is_file(), "scripts/qed_web_service.py 不存在（service_manager web 单元依赖）"


def test_web_service_script_pid_file_and_serve_command():
    """PID 文件 = logs/qed-web.pid；serve 命令 = python scripts/serve_web.py（cwd=仓库根）。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "qed-web.pid" in src, "PID 文件应为 logs/qed-web.pid（_start_via_script 兜底同路径）"
    assert "scripts/serve_web.py" in src, "serve 命令应拉起 scripts/serve_web.py"


def test_web_service_script_health_probe_port():
    """health 探测端口默认 8903，端点 /api/v1/health（与 serve_web.py 内置端点一致）。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "8903" in src, "默认端口应为 8903"
    assert "/api/v1/health" in src, "健康探测端点应为 /api/v1/health"
    assert "QED_WEB_PORT" in src, "端口应可被 QED_WEB_PORT 环境变量覆盖"


def test_web_service_script_subcommands():
    """子命令齐全：start / stop / restart / status（与 QED-Tracker 脚本同构）。"""
    src = SCRIPT.read_text(encoding="utf-8")
    for cmd in ("start", "stop", "restart", "status"):
        assert cmd in src, f"脚本缺少子命令 {cmd}"


def test_web_service_script_exit_codes_documented():
    """退出码语义与 8900 接入契约一致（0 成功/幂等，1 运行失败，2 参数错误）。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "退出码：0" in src and "1 运行失败" in src and "2 参数错误" in src


def test_pid_is_alive_tolerates_non_utf8_stdout(monkeypatch):
    """中文 Windows 下 tasklist 输出 GBK（Python utf-8 解码失败 → stdout=None）时，
    _pid_is_alive 不得抛 TypeError，应返回 False（进程状态未知，走端口探测兜底）。"""
    import importlib.util
    import subprocess

    spec = importlib.util.spec_from_file_location("qed_web_service_mod", SCRIPT)
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


# --- 冷启动构建门禁（start --build，2026-09-04；测试属开发门禁不走启动流程） ---


def _load_script_module():
    """加载被测脚本模块（importlib，避免包导入路径依赖）。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_web_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _start_args(build=False):
    """构造 cmd_start 入参：默认无旗标、--wait 0（不阻塞健康等待）。"""
    import argparse

    return argparse.Namespace(port=8903, wait=0.0, build=build)


def test_web_service_script_build_gate_contract():
    """start --build 显式旗标 + npm run build 命令 + dist 缺失兜底（门禁契约）。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "--build" in src, "start 子命令应提供 --build 显式旗标"
    assert "--test" not in src, "启动测试门禁已取消（2026-09-04），脚本不得再提供 --test"
    assert '"run", "build"' in src, "构建命令应为 npm run build（tsc -b && vite build）"
    assert '"run", "test"' not in src, "启动流程不应执行 npm run test（测试属开发门禁）"
    assert "shutil.which" in src, "npm 探测应用 shutil.which"
    assert 'shutil.which("npm.cmd")' in src, (
        "Windows 应优先探测 npm.cmd——裸 `npm` 命中 POSIX sh 脚本，spawn 报 WinError 193"
    )
    assert "index.html" in src, "dist 缺失兜底判据应为 dist/index.html 存在性"


def test_cmd_start_build_then_spawn(monkeypatch, tmp_path):
    """start --build：npm run build 成功后 spawn（仅构建，不执行测试）。"""
    mod = _load_script_module()
    monkeypatch.setattr(mod, "PID_FILE", tmp_path / "qed-web.pid")
    monkeypatch.setattr(mod, "DIST_INDEX", tmp_path / "dist" / "index.html")
    monkeypatch.setattr(mod, "_pid_is_alive", lambda pid: False)
    monkeypatch.setattr(mod, "_port_open", lambda port: False)
    calls: list = []

    def fake_run_npm(npm, npm_args, timeout):
        calls.append(tuple(npm_args))
        return 0

    monkeypatch.setattr(mod, "_find_npm", lambda: "npm")
    monkeypatch.setattr(mod, "_run_npm", fake_run_npm)
    spawned: list = []
    monkeypatch.setattr(mod, "_spawn", lambda: spawned.append(1) or 0)
    assert mod.cmd_start(_start_args(build=True)) == 0
    assert calls == [("run", "build")], "应仅执行构建（测试属开发门禁）"
    assert len(spawned) == 1, "构建成功后才 spawn"


def test_cmd_start_build_failure_aborts(monkeypatch, tmp_path):
    """npm run build 失败 → 退出码 1，服务不启动（不以坏 dist 上线）。"""
    mod = _load_script_module()
    monkeypatch.setattr(mod, "PID_FILE", tmp_path / "qed-web.pid")
    monkeypatch.setattr(mod, "DIST_INDEX", tmp_path / "dist" / "index.html")
    monkeypatch.setattr(mod, "_pid_is_alive", lambda pid: False)
    monkeypatch.setattr(mod, "_port_open", lambda port: False)
    monkeypatch.setattr(mod, "_find_npm", lambda: "npm")
    monkeypatch.setattr(mod, "_run_npm", lambda npm, npm_args, timeout: 1)

    def _no_spawn():
        raise AssertionError("构建失败不应 spawn")

    monkeypatch.setattr(mod, "_spawn", _no_spawn)
    assert mod.cmd_start(_start_args(build=True)) == 1


def test_cmd_start_default_fast_when_dist_present(monkeypatch, tmp_path):
    """默认无旗标 + dist 存在：不触碰 npm（8900 控制台 30s 超时路径快启动）。"""
    mod = _load_script_module()
    monkeypatch.setattr(mod, "PID_FILE", tmp_path / "qed-web.pid")
    dist_file = tmp_path / "dist" / "index.html"
    dist_file.parent.mkdir()
    dist_file.write_text("<html></html>", encoding="utf-8")
    monkeypatch.setattr(mod, "DIST_INDEX", dist_file)
    monkeypatch.setattr(mod, "_pid_is_alive", lambda pid: False)
    monkeypatch.setattr(mod, "_port_open", lambda port: False)

    def _no_npm():
        raise AssertionError("dist 存在且无旗标时不应探测 npm")

    monkeypatch.setattr(mod, "_find_npm", _no_npm)

    def _no_run(*args, **kwargs):
        raise AssertionError("dist 存在且无旗标时不应执行 npm 命令")

    monkeypatch.setattr(mod, "_run_npm", _no_run)
    monkeypatch.setattr(mod, "_spawn", lambda: 0)
    assert mod.cmd_start(_start_args()) == 0


def test_cmd_start_auto_build_when_dist_missing(monkeypatch, tmp_path):
    """dist/index.html 缺失且无旗标：自动兜底构建（仅构建），随后启动。"""
    mod = _load_script_module()
    monkeypatch.setattr(mod, "PID_FILE", tmp_path / "qed-web.pid")
    monkeypatch.setattr(mod, "DIST_INDEX", tmp_path / "dist" / "index.html")  # 不存在
    monkeypatch.setattr(mod, "_pid_is_alive", lambda pid: False)
    monkeypatch.setattr(mod, "_port_open", lambda port: False)
    calls: list = []

    def fake_run_npm(npm, npm_args, timeout):
        calls.append(tuple(npm_args))
        return 0

    monkeypatch.setattr(mod, "_find_npm", lambda: "npm")
    monkeypatch.setattr(mod, "_run_npm", fake_run_npm)
    monkeypatch.setattr(mod, "_spawn", lambda: 0)
    assert mod.cmd_start(_start_args()) == 0
    assert calls == [("run", "build")], "兜底仅构建"


def test_cmd_restart_never_builds(monkeypatch, tmp_path):
    """restart 不构建：解析器无 --build 旗标，注入 build=False 后走 cmd_start。"""
    mod = _load_script_module()
    parser_args = mod.build_parser().parse_args(["restart"])
    assert not hasattr(parser_args, "build"), "restart 子命令不应提供 --build 旗标"
    dist_file = tmp_path / "dist" / "index.html"
    dist_file.parent.mkdir()
    dist_file.write_text("<html></html>", encoding="utf-8")
    monkeypatch.setattr(mod, "DIST_INDEX", dist_file)
    monkeypatch.setattr(mod, "_pid_is_alive", lambda pid: False)
    monkeypatch.setattr(mod, "_port_open", lambda port: False)

    def _no_npm():
        raise AssertionError("restart 不应触碰 npm")

    monkeypatch.setattr(mod, "_find_npm", _no_npm)
    monkeypatch.setattr(mod, "PID_FILE", tmp_path / "qed-web.pid")
    stopped: list = []
    monkeypatch.setattr(mod, "cmd_stop", lambda a: stopped.append(1))
    captured: dict = {}

    def fake_cmd_start(ns):
        captured.update(build=ns.build)
        return 0

    monkeypatch.setattr(mod, "cmd_start", fake_cmd_start)
    parser_args.port = 8903
    assert mod.cmd_restart(parser_args) == 0
    assert stopped, "restart 应先 stop"
    assert captured["build"] is False, "restart 应注入 build=False"


def test_run_npm_invocation_and_failure(monkeypatch):
    """_run_npm：cwd=web-ui、命令=[npm, *args]；非零退出/spawn 失败返回 1，全绿返回 0。"""
    mod = _load_script_module()
    captured: dict = {}

    def fake_popen_ok(cmd, **kwargs):
        captured.update(cmd=cmd, **kwargs)
        return type("P", (), {"pid": 1, "wait": lambda self, timeout=None: 0})()

    monkeypatch.setattr(mod.subprocess, "Popen", fake_popen_ok)
    assert mod._run_npm("npm", ["run", "build"], 600.0) == 0
    assert captured["cmd"] == ["npm", "run", "build"]
    assert captured["cwd"] == str(mod.WEB_UI_DIR)

    monkeypatch.setattr(
        mod.subprocess, "Popen",
        lambda cmd, **kw: type("P", (), {"pid": 1, "wait": lambda self, timeout=None: 2})(),
    )
    assert mod._run_npm("npm", ["run", "build"], 600.0) == 1, "非零退出应返回 1"

    def fake_popen_boom(cmd, **kwargs):
        raise OSError("spawn failed")

    monkeypatch.setattr(mod.subprocess, "Popen", fake_popen_boom)
    assert mod._run_npm("npm", ["run", "build"], 600.0) == 1, "spawn 失败应返回 1"


def test_run_npm_timeout_kills_tree(monkeypatch):
    """_run_npm 超时必须 taskkill /T /F 杀整树（防 npm.cmd → node 孤儿占管道），返回 1。"""
    mod = _load_script_module()
    spawned: list = []
    killed: list = []

    class FakeProc:
        pid = 4321

        def wait(self, timeout=None):
            if timeout is not None:
                raise mod.subprocess.TimeoutExpired("npm", timeout)
            return 0

    def fake_popen(cmd, **kwargs):
        spawned.append(cmd)
        return FakeProc()

    monkeypatch.setattr(mod.subprocess, "Popen", fake_popen)
    monkeypatch.setattr(mod, "_kill_tree", lambda pid: killed.append(pid) or True)
    assert mod._run_npm("npm", ["run", "build"], 600.0) == 1, "超时应返回 1"
    assert spawned == [["npm", "run", "build"]]
    assert killed == [4321], "超时后应 taskkill 杀整树而非留孤儿"


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


def test_cmd_stop_never_fakes_success(monkeypatch, tmp_path, capsys):
    """缺陷①回归：优雅+强杀两腿都失效时，stop 必须退出码 1 报错，绝不打印假 stopped。"""
    mod = _load_script_module()
    pid_file = tmp_path / "qed-web.pid"
    pid_file.write_text("4242", encoding="utf-8")
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
    pid_file = tmp_path / "qed-web.pid"
    pid_file.write_text("4242", encoding="utf-8")
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