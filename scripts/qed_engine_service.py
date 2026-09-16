"""QED-Engine 8900 后端服务生命周期管理：start / stop / restart / status。

子进程 = `python -m uvicorn qed_engine.api.main:app`（继承当前解释器，天然落在 QED_env）；
PID 文件 logs/qed-engine.pid，子进程 stdout/stderr 落 logs/qed-engine-serve.log。
--mode api|local：覆盖 QED_API_SELECT 环境变量注入子进程（默认读根 .env），重启可换模式；
api 模式走 API key 调用，local 模式启用本地模型（Qwen / MinerU）。
健康探测端点：http://127.0.0.1:8900/api/v1/health。
契约见 docs/design/llm-gateway.md（2026-08-20）。

退出码：0 成功/幂等；1 运行失败（spawn 失败、health 超时、stop 无法终止）；2 参数错误（argparse）。
Windows 注意：os.kill(pid, 0) 会直接 TerminateProcess，进程存在性检测用 tasklist。

停止可靠性（2026-09-04 修复）：判活用 _proc_alive（ctypes OpenProcess，毫秒级）——tasklist
探测失败曾被当作「进程已死」导致假 stopped（实机复现：stop 回显 stopped 而 uvicorn 仍服务
8900）；优雅信号（CTRL_BREAK）在 conda run 等跨 console 语境下可能静默空放，一律以
_proc_alive 确认 + taskkill 强杀树兜底，终止失败显式报错退出 1。
"""

from __future__ import annotations

import argparse
import ctypes
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"
PID_FILE = LOG_DIR / "qed-engine.pid"
SERVE_LOG = LOG_DIR / "qed-engine-serve.log"

NEW_PROCESS_GROUP = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
CTRL_BREAK_EVENT = getattr(signal, "CTRL_BREAK_EVENT", signal.SIGTERM)

STOP_GRACE_SECONDS = 5.0
STOP_POLL_INTERVAL = 0.2
HEALTH_TIMEOUT_SECONDS = 30.0
HEALTH_INTERVAL_SECONDS = 0.5


def default_port() -> int:
    """health 探测端口：QED_CONFIG_CENTER_URL 端口解析，默认 8900。"""
    raw = os.getenv("QED_CONFIG_CENTER_URL", "")
    if raw:
        try:
            return int(raw.rstrip("/").rsplit(":", 1)[1])
        except (ValueError, IndexError):
            pass
    return 8900


def serve_command(port: int, mode: str | None = None) -> list[str]:
    """子进程命令：当前解释器 + uvicorn + 8900 API 应用（mode 仅经环境变量注入）。"""
    return [
        sys.executable, "-m", "uvicorn", "qed_engine.api.main:app",
        "--host", "127.0.0.1", "--port", str(port),
    ]


def _pid_is_alive(pid: int) -> bool:
    """Windows 进程存在性检测：tasklist（os.kill(pid, 0) 会直接 TerminateProcess）。
    注意（2026-08-18 修复）：中文 Windows tasklist 表头为 GBK（如「映像名称」），
    Python 以 utf-8 解码会抛 UnicodeDecodeError → readerthread 中断 → stdout=None →
    TypeError。修复：errors='replace' 容忍非 utf-8 输出 + stdout 空值兜底。
    """
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"],
            capture_output=True,
            text=True,
            errors="replace",
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return str(pid) in (result.stdout or "")


def read_pid() -> int | None:
    if not PID_FILE.is_file():
        return None
    try:
        return int(PID_FILE.read_text(encoding="utf-8").strip())
    except ValueError:
        return None


def _proc_alive(pid: int) -> bool:
    """进程存活判定（ctypes kernel32，毫秒级、无 WMI/GBK 依赖）——stop 路径专用。

    2026-09-04 修复：tasklist 版 _pid_is_alive 探测超时/失败返回 False，与「进程已死」
    语义混淆（tasklist timeout=10s 还大于优雅宽限 5s，满载时一次慢探测即耗尽全窗），
    曾致 stop 假成功（打印 stopped 而 uvicorn 存活）。此处句柄打开失败按错误码区分：
    ERROR_ACCESS_DENIED（存活但无权限查询）按存活，其余按死亡；GetExitCodeProcess
    查询失败按存活（未知 ≠ 已死：宁可多轮询/强杀，不可假成功）。
    """
    if os.name != "nt":
        return _pid_is_alive(pid)
    if pid <= 0:
        return False
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    STILL_ACTIVE = 259  # WAIT_TIMEOUT 值复用为「未退出」退出码
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        return ctypes.get_last_error() == 5  # ERROR_ACCESS_DENIED：无权限查询但确定存活
    try:
        exit_code = ctypes.c_ulong()
        if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
            return True  # 查询失败 ≠ 已死
        return exit_code.value == STILL_ACTIVE
    finally:
        kernel32.CloseHandle(handle)


def _port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


def _health_ok(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/v1/health", timeout=1.0) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _spawn(port: int | None = None, mode: str | None = None) -> int:
    """拉起服务进程并写 PID 文件；mode 非空时注入 QED_API_SELECT 环境变量。"""
    if port is None:
        port = default_port()
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = open(SERVE_LOG, "ab")  # noqa: SIM115 - 子进程继承句柄，随其生命周期
    env = os.environ.copy()
    if mode:
        env["QED_API_SELECT"] = mode
    try:
        proc = subprocess.Popen(
            serve_command(port, mode),
            cwd=str(ROOT),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            creationflags=NEW_PROCESS_GROUP,
            env=env,
        )
    except Exception as exc:
        log_file.close()
        print(f"spawn failed: {exc}")
        return 1
    PID_FILE.write_text(str(proc.pid), encoding="utf-8")
    print(f"pid: {proc.pid}")
    print(f"log: {SERVE_LOG}")
    return 0


def _wait_healthy(port: int, timeout: float) -> int:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _health_ok(port):
            print(f"healthy: http://127.0.0.1:{port}/api/v1/health")
            return 0
        time.sleep(HEALTH_INTERVAL_SECONDS)
    print(f"health not OK within {timeout:g}s")
    return 1


def cmd_start(args: argparse.Namespace) -> int:
    port = args.port
    pid = read_pid()
    if pid is not None and _pid_is_alive(pid):
        print(f"already running (pid {pid})")
        return 0
    if _port_open(port):
        print(f"already running (port {port})")
        return 0
    if _spawn(port, args.mode) != 0:
        return 1
    if args.wait and args.wait > 0:
        return _wait_healthy(port, args.wait)
    return 0


def _kill_tree(pid: int) -> bool:
    """taskkill 强杀进程树（优雅停止超时后的兜底）；返回是否确认成功。

    2026-09-04 修复：不再静默吞错——失败输出直接打印，调用方以 _proc_alive
    复核，两腿都失效时 cmd_stop 显式退出码 1（假 stopped 不再可能）。
    """
    try:
        result = subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            text=True,
            errors="replace",
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        print(f"[kill] taskkill /PID {pid} 执行异常：{exc}")
        return False
    if result.returncode == 0:
        return True
    detail = " ".join(
        part.strip() for part in (result.stdout or "", result.stderr or "") if part.strip()
    )
    print(f"[kill] taskkill /PID {pid} 失败（退出码 {result.returncode}）：{detail}")
    return False


def cmd_stop(args: argparse.Namespace) -> int:
    pid = read_pid()
    if pid is None:
        print("not running (no pid file)")
        return 0
    if not _proc_alive(pid):
        PID_FILE.unlink(missing_ok=True)
        print("not running (stale pid file)")
        return 0
    forced = False
    try:
        os.kill(pid, CTRL_BREAK_EVENT)
    except (OSError, SystemError):
        # 无交互控制台环境（服务/管道）下 GenerateConsoleCtrlEvent 抛 WinError 87，
        # CPython 包装为 SystemError；跨 console 语境还可能静默空放——
        # 一律走 taskkill 强杀兜底，后续以 _proc_alive 复核。
        if _kill_tree(pid):
            forced = True
    deadline = time.monotonic() + STOP_GRACE_SECONDS
    while time.monotonic() < deadline and _proc_alive(pid):
        time.sleep(STOP_POLL_INTERVAL)
    if _proc_alive(pid):
        # 优雅信号未生效（空放/被忽略）→ taskkill 强杀树；判活用 _proc_alive，
        # 探测失败不会再被误判为已死（2026-09-04 假 stopped 根因修复）。
        forced = True
        _kill_tree(pid)
        deadline = time.monotonic() + STOP_GRACE_SECONDS
        while time.monotonic() < deadline and _proc_alive(pid):
            time.sleep(STOP_POLL_INTERVAL)
    if _proc_alive(pid):
        print(f"stop failed: pid {pid} 优雅停止与 taskkill 强杀后仍存活，请手动 taskkill /PID {pid} /T /F")
        return 1
    PID_FILE.unlink(missing_ok=True)
    print("stopped" + (" (forced)" if forced else ""))
    return 0


def cmd_restart(args: argparse.Namespace) -> int:
    cmd_stop(args)
    return cmd_start(args)


def cmd_status(args: argparse.Namespace) -> int:
    pid = read_pid()
    if pid is not None and _pid_is_alive(pid):
        print(f"running (pid {pid})")
        return 0
    if pid is not None:
        PID_FILE.unlink(missing_ok=True)
    if _port_open(args.port) and _health_ok(args.port):
        print(f"running (port probe {args.port})")
        return 0
    print("stopped")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="qed_engine_service",
        description="QED-Engine 8900 后端服务生命周期管理（start/stop/restart/status）。",
    )
    parser.add_argument(
        "--port", type=int, default=None,
        help="health 探测端口（默认 QED_CONFIG_CENTER_URL 端口或 8900）",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("start", help="启动服务（默认立即返回，--wait 可选等待健康就绪）")
    start.add_argument(
        "--wait", nargs="?", const=HEALTH_TIMEOUT_SECONDS, type=float, default=0.0,
        help=f"等待 /api/v1/health 就绪，默认 {HEALTH_TIMEOUT_SECONDS:g}s",
    )
    start.add_argument(
        "--mode", choices=["api", "local"], default=None,
        help="模型模式：api（默认，API key）/ local（本地模型）；覆盖 QED_API_SELECT 注入子进程",
    )
    start.set_defaults(func=cmd_start)

    stop = subparsers.add_parser("stop", help="停止服务（优雅 + 强杀兜底）")
    stop.set_defaults(func=cmd_stop)

    restart = subparsers.add_parser("restart", help="重启服务")
    restart.add_argument(
        "--wait", nargs="?", const=HEALTH_TIMEOUT_SECONDS, type=float, default=0.0,
        help=f"等待 /api/v1/health 就绪，默认 {HEALTH_TIMEOUT_SECONDS:g}s",
    )
    restart.add_argument(
        "--mode", choices=["api", "local"], default=None,
        help="模型模式：api（默认，API key）/ local（本地模型）；覆盖 QED_API_SELECT 注入子进程",
    )
    restart.set_defaults(func=cmd_restart)

    status = subparsers.add_parser("status", help="查询服务状态")
    status.set_defaults(func=cmd_status)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.port is None:
        args.port = default_port()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())