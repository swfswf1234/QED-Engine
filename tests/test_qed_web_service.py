"""
模块职责：守护 scripts/qed_web_service.py（8903 前端服务生命周期脚本）契约——
PID 文件路径、serve 命令、health 探测端口与子命令结构，防与 service-control.md 注册表
（`web` 单元）及 8900 service_manager 接入契约漂移。
设计关联（DesignRef）：docs/design/service-control.md（REQ-03x：web 单元接入）
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