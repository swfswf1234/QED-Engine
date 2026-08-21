"""本地文字模型（LM Studio）生命周期管理：start / stop / restart / status。

优先使用 LM Studio 官方 CLI（`lms server start|stop`，模型加载 `lms load <model>`）；
lms 不在 PATH 时 start 返回 1 并提示手动启动（LM Studio 为 GUI 应用，进程管理不稳定）。
健康探测：GET {QED_LMSTUDIO_URL}/models（QED_LMSTUDIO_URL 未设置时默认
http://127.0.0.1:5001/v1，OpenAI 兼容）；显式 --port 时按端口探测。
由 services/llm/model_manager.py 调用（资源互斥编排），也可手动执行。
退出码：0 成功/幂等；1 运行失败；2 参数错误（argparse）。
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # scripts/text-model/ → 仓库根
LOG_DIR = ROOT / "logs"

HEALTH_TIMEOUT_SECONDS = 30.0
HEALTH_INTERVAL_SECONDS = 0.5


def default_base_url() -> str:
    """QED_LMSTUDIO_URL 环境变量，默认 http://127.0.0.1:5001/v1。"""
    return os.getenv("QED_LMSTUDIO_URL", "http://127.0.0.1:5001/v1").rstrip("/")


def _base_from_port(port: int) -> str:
    return f"http://127.0.0.1:{port}/v1"


def _health_ok(port: int) -> bool:
    base = default_base_url() if port == 5001 else _base_from_port(port)
    try:
        with urllib.request.urlopen(base + "/models", timeout=1.0) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _lms() -> str | None:
    """lms CLI 路径；未安装返回 None。"""
    return shutil.which("lms")


def cmd_start(args: argparse.Namespace) -> int:
    port = args.port
    if _health_ok(port):
        print(f"already running (port {port})")
        return 0
    lms = _lms()
    if lms is None:
        print("lms CLI 未安装：请手动启动 LM Studio（加载 qwen 7b 模型，端口 5001）")
        return 1
    result = subprocess.run([lms, "server", "start"], capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f"lms server start failed: {result.stderr.strip()}")
        return 1
    if args.model:
        subprocess.run([lms, "load", args.model], capture_output=True, text=True, timeout=120)
    if args.wait and args.wait > 0:
        return _wait_healthy(port, args.wait)
    return 0


def cmd_stop(args: argparse.Namespace) -> int:
    lms = _lms()
    if lms is None:
        print("lms CLI 未安装：请在 LM Studio 界面手动停止服务")
        return 1
    subprocess.run([lms, "server", "stop"], capture_output=True, text=True, timeout=30)
    print("stopped")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    if _health_ok(args.port):
        print(f"running (port probe {args.port})")
        return 0
    print("stopped")
    return 0


def cmd_restart(args: argparse.Namespace) -> int:
    cmd_stop(args)
    return cmd_start(args)


def _wait_healthy(port: int, timeout: float) -> int:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _health_ok(port):
            print(f"healthy: http://127.0.0.1:{port}/v1/models")
            return 0
        time.sleep(HEALTH_INTERVAL_SECONDS)
    print(f"health not OK within {timeout:g}s")
    return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="qed_lmstudio_service",
        description="本地文字模型（LM Studio）生命周期管理（start/stop/restart/status）。",
    )
    parser.add_argument("--port", type=int, default=5001, help="健康探测端口（默认 5001）")
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("start", help="启动 LM Studio 服务（lms CLI）")
    start.add_argument("--model", default=None, help="lms load 的模型 id（可选）")
    start.add_argument("--wait", nargs="?", const=30.0, type=float, default=0.0,
                       help="等待 /v1/models 就绪，默认 30s")
    start.set_defaults(func=cmd_start)

    stop = subparsers.add_parser("stop", help="停止服务（lms server stop）")
    stop.set_defaults(func=cmd_stop)

    restart = subparsers.add_parser("restart", help="重启服务")
    restart.add_argument("--model", default=None)
    restart.add_argument("--wait", nargs="?", const=30.0, type=float, default=0.0)
    restart.set_defaults(func=cmd_restart)

    status = subparsers.add_parser("status", help="查询服务状态")
    status.set_defaults(func=cmd_status)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
