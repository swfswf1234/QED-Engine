"""QED-Engine 8903 前端服务生命周期管理：start / stop / restart / status。

子进程 = `python scripts/serve_web.py`（继承当前解释器，天然落在 QED_env）；
PID 文件 logs/qed-web.pid，子进程 stdout/stderr 落 logs/qed-web-serve.log。
健康探测端点：http://127.0.0.1:8903/api/v1/health（serve_web.py 内置）。
接口契约（含 8900 控制中心接入方式）见 docs/design/service-hosting.md
（REQ-03x：8903 web 单元接入，仿 QED-Tracker scripts/qed_tracker_service.py）。

冷启动构建门禁（2026-09-04，显式旗标，默认不启用）：
- start --build：spawn 前执行 `npm run build`（tsc -b && vite build → dist/），
  失败退出码 1，服务不启动（不以坏 dist 上线）；前端测试属开发门禁
  （web-ui 下 npm run test，见 docs/guides/development.md），启动流程不执行；
- 兜底：dist/index.html 缺失时即使不带 --build 也自动构建（restart 亦生效）；
- 8900 控制台托管启动（service_manager._start_via_script）调 `start` 不带旗标 →
  纯快启动，30s 超时安全；`restart` 不构建（改前端代码后请走 start --build
  冷启动，见 docs/guides/operations.md）。

退出码：0 成功/幂等；1 运行失败（构建失败、spawn 失败、health 超时、stop 无法终止）；2 参数错误（argparse）。
Windows 注意：os.kill(pid, 0) 会直接 TerminateProcess，进程存在性检测用 tasklist。

停止可靠性（2026-09-04 修复）：判活用 _proc_alive（ctypes OpenProcess，毫秒级）——tasklist
探测失败曾被当作「进程已死」导致假 stopped；优雅信号（CTRL_BREAK）在 conda run 等跨 console
语境下可能静默空放，一律以 _proc_alive 确认 + taskkill 强杀树兜底，终止失败显式报错退出 1。
npm 构建超时同样 taskkill /T /F 杀整树（只杀包装层会留 node 孤儿，实测存活 27min）。
"""

from __future__ import annotations

import argparse
import ctypes
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"
PID_FILE = LOG_DIR / "qed-web.pid"
SERVE_LOG = LOG_DIR / "qed-web-serve.log"

WEB_UI_DIR = ROOT / "web-ui"
DIST_INDEX = WEB_UI_DIR / "dist" / "index.html"
NPM_BUILD_TIMEOUT_SECONDS = 1800.0  # tsc -b && vite build（天花板语义，防慢机误中止）

NEW_PROCESS_GROUP = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
CTRL_BREAK_EVENT = getattr(signal, "CTRL_BREAK_EVENT", signal.SIGTERM)

STOP_GRACE_SECONDS = 5.0
STOP_POLL_INTERVAL = 0.2
HEALTH_TIMEOUT_SECONDS = 30.0
HEALTH_INTERVAL_SECONDS = 0.5


def default_port() -> int:
    """health 探测端口：QED_WEB_PORT 环境变量，默认 8903。"""
    return int(os.getenv("QED_WEB_PORT", "8903"))


def serve_command() -> list[str]:
    """子进程命令：当前解释器 + serve_web.py（cwd=仓库根，config 由脚本内常量固定）。"""
    return [sys.executable, "scripts/serve_web.py"]


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
    语义混淆，曾致 stop 假成功（打印 stopped 而 uvicorn 存活）。此处句柄打开失败按
    错误码区分：ERROR_ACCESS_DENIED（存活但无权限查询）按存活，其余按死亡；
    GetExitCodeProcess 查询失败按存活（未知 ≠ 已死：宁可多轮询/强杀，不可假成功）。
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


def _spawn() -> int:
    """拉起服务进程并写 PID 文件；返回退出码。"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = open(SERVE_LOG, "ab")  # noqa: SIM115 - 子进程继承句柄，随其生命周期
    try:
        proc = subprocess.Popen(
            serve_command(),
            cwd=str(ROOT),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            creationflags=NEW_PROCESS_GROUP,
            env=os.environ.copy(),
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


def _find_npm() -> str | None:
    """npm 可执行文件探测：优先 npm.cmd——Windows 下裸 `npm` 命中的是同名 POSIX sh 脚本
    （npm 安装目录同时含无扩展名脚本与 npm.cmd），spawn 它报 WinError 193；非 Windows
    回退 npm。缺失打印提示返回 None。"""
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if npm is None:
        print("npm not found: 请安装 Node.js 并确认 npm 在 PATH 中（版本见 docs/standards/local-dev.md）")
    return npm


def _run_npm(npm: str, npm_args: list[str], timeout: float) -> int:
    """web-ui/ 下执行 npm 命令（输出实时透传控制台）；非零退出/超时/执行异常返回 1。

    超时经 taskkill /T /F 杀整树：subprocess.run(timeout) 只杀直接子层
    （npm.cmd 包装），node/vitest 链会留孤儿占住 stdout 管道继续烧 CPU
    （2026-09-04 实测孤儿存活 27min、内存 3GB）。
    """
    printable = " ".join(npm_args)
    print(f"[qed-web] cd web-ui && npm {printable} ...")
    try:
        proc = subprocess.Popen([npm, *npm_args], cwd=str(WEB_UI_DIR))
    except OSError as exc:
        print(f"[qed-web] npm {printable} 执行失败：{exc}")
        return 1
    try:
        returncode = proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        print(f"[qed-web] npm {printable} 超时（>{timeout:g}s），taskkill 强杀进程树，中止启动")
        _kill_tree(proc.pid)
        proc.wait()
        return 1
    if returncode != 0:
        print(f"[qed-web] npm {printable} 失败（退出码 {returncode}），服务不启动")
        return 1
    return 0


def _run_checks(args: argparse.Namespace) -> int:
    """启动前构建门禁：--build 显式构建、dist 缺失自动兜底。

    构建失败返回 1（服务不启动，不以坏 dist 上线）；成功返回 0。
    """
    need_build = args.build or not DIST_INDEX.is_file()
    if need_build and not args.build:
        print("[qed-web] dist/index.html 缺失，自动兜底构建")
    npm = _find_npm()
    if npm is None:
        return 1
    if need_build and _run_npm(npm, ["run", "build"], NPM_BUILD_TIMEOUT_SECONDS) != 0:
        return 1
    return 0


def cmd_start(args: argparse.Namespace) -> int:
    port = args.port
    pid = read_pid()
    if pid is not None and _pid_is_alive(pid):
        print(f"already running (pid {pid})")
        return 0
    if _port_open(port):
        print(f"already running (port {port})")
        return 0
    if args.build or not DIST_INDEX.is_file():
        if _run_checks(args) != 0:
            return 1
    if _spawn() != 0:
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
    """重启：stop + start（不构建；dist 缺失的兜底构建仍生效，属异常恢复）。

    改前端代码后请走 `start --build` 冷启动门禁，勿依赖 restart 更新 dist。
    """
    cmd_stop(args)
    start_args = argparse.Namespace(**vars(args))
    start_args.build = False
    return cmd_start(start_args)


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
        prog="qed_web_service",
        description="QED-Engine 8903 前端服务生命周期管理（start/stop/restart/status）。",
    )
    parser.add_argument(
        "--port", type=int, default=None,
        help="health 探测端口（默认 QED_WEB_PORT 或 8903）",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("start", help="启动服务（默认立即返回，--wait 可选等待健康就绪）")
    start.add_argument(
        "--build", action="store_true",
        help="启动前执行 npm run build（tsc -b && vite build → dist/）；dist/index.html 缺失时自动兜底构建",
    )
    start.add_argument(
        "--wait", nargs="?", const=HEALTH_TIMEOUT_SECONDS, type=float, default=0.0,
        help=f"等待 /api/v1/health 就绪，默认 {HEALTH_TIMEOUT_SECONDS:g}s",
    )
    start.set_defaults(func=cmd_start)

    stop = subparsers.add_parser("stop", help="停止服务（优雅 + 强杀兜底）")
    stop.set_defaults(func=cmd_stop)

    restart = subparsers.add_parser("restart", help="重启服务")
    restart.add_argument(
        "--wait", nargs="?", const=HEALTH_TIMEOUT_SECONDS, type=float, default=0.0,
        help=f"等待 /api/v1/health 就绪，默认 {HEALTH_TIMEOUT_SECONDS:g}s",
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
