"""本地图像模型（MinerU 容器，WSL）生命周期管理：start / stop / restart / status。

经 PowerShell 编排脚本（scripts/image-model/infra-*.ps1，WSL Docker Compose，端口 8002）
执行启停；健康探测：GET http://127.0.0.1:8002/health（QED_MINERU_URL 可覆盖）。
由 services/llm/model_manager.py 调用（资源互斥编排），也可手动执行。
退出码：0 成功/幂等；1 运行失败；2 参数错误（argparse）。
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # scripts/image-model/ → 仓库根
IMAGE_MODEL_DIR = ROOT / "scripts" / "image-model"

HEALTH_TIMEOUT_SECONDS = 120.0
HEALTH_INTERVAL_SECONDS = 0.5


def default_port() -> int:
    """健康探测端口：QED_MINERU_URL 端口解析，默认 8002。"""
    raw = os.getenv("QED_MINERU_URL", "")
    if raw:
        try:
            return int(raw.rstrip("/").rsplit(":", 1)[1])
        except (ValueError, IndexError):
            pass
    return 8002


def default_base_url() -> str:
    """QED_MINERU_URL 环境变量完整地址（含端口），默认 http://127.0.0.1:8002。"""
    return os.getenv("QED_MINERU_URL", "http://127.0.0.1:8002").rstrip("/")


def _base_from_port(port: int) -> str:
    return f"http://127.0.0.1:{port}"


def _health_ok(port: int) -> bool:
    # 默认端口 8002 时尊重 QED_MINERU_URL（完整地址含 host）；显式其它端口按 127.0.0.1 构造
    base = default_base_url() if port == 8002 else _base_from_port(port)
    try:
        with urllib.request.urlopen(base + "/health", timeout=1.0) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _run_infra(script: str) -> int:
    """执行编排脚本：powershell -ExecutionPolicy Bypass -File <script>。"""
    try:
        result = subprocess.run(
            ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(IMAGE_MODEL_DIR / script)],
            cwd=str(ROOT),
            timeout=600,
            check=False,
        )
        return result.returncode
    except (OSError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        return 1


def _wait_healthy(port: int, timeout: float) -> int:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _health_ok(port):
            print(f"healthy: http://127.0.0.1:{port}/health")
            return 0
        time.sleep(HEALTH_INTERVAL_SECONDS)
    print(f"health not OK within {timeout:g}s")
    return 1


def cmd_start(args: argparse.Namespace) -> int:
    port = args.port
    if _health_ok(port):
        print(f"already running (port {port})")
        return 0
    if _run_infra("infra-up.ps1") != 0:
        print("infra-up.ps1 失败（WSL/容器不可达？）")
        return 1
    if args.wait and args.wait > 0:
        return _wait_healthy(port, args.wait)
    return 0


def cmd_stop(args: argparse.Namespace) -> int:
    if _run_infra("infra-down.ps1") != 0:
        print("infra-down.ps1 失败")
        return 1
    print("stopped")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    _run_infra("infra-status.ps1")
    if _health_ok(args.port):
        print(f"running (port probe {args.port})")
        return 0
    print("stopped")
    return 0


def cmd_restart(args: argparse.Namespace) -> int:
    cmd_stop(args)
    return cmd_start(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="qed_mineru_service",
        description="本地图像模型（MinerU 容器）生命周期管理（start/stop/restart/status）。",
    )
    parser.add_argument("--port", type=int, default=None,
                        help="健康探测端口（默认 QED_MINERU_URL 解析或 8002）")
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("start", help="启动 MinerU 容器（infra-up.ps1）")
    start.add_argument("--wait", nargs="?", const=HEALTH_TIMEOUT_SECONDS, type=float, default=0.0,
                       help="等待 /health 就绪，默认 120s")
    start.set_defaults(func=cmd_start)

    stop = subparsers.add_parser("stop", help="停止容器（infra-down.ps1）")
    stop.set_defaults(func=cmd_stop)

    restart = subparsers.add_parser("restart", help="重启服务")
    restart.add_argument("--wait", nargs="?", const=HEALTH_TIMEOUT_SECONDS, type=float, default=0.0)
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