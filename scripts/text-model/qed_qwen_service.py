"""本地文字模型（llama-server / Qwen GGUF）生命周期管理：start / stop / restart / status。

启动 llama-server 加载 model/qwen/ 下的 GGUF 模型（OpenAI 兼容端口 5001）；
健康探测：GET {QED_MODEL_URL}/v1/models（QED_MODEL_URL 未设置时默认
http://127.0.0.1:5001/v1，OpenAI 兼容）。
由 services/llm/model_manager.py 调用（资源互斥编排），也可手动执行。
退出码：0 成功/幂等；1 运行失败；2 参数错误（argparse）。

设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_qed_qwen_service.py
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # scripts/text-model/ → 仓库根
QWEN_MODEL_DIR = ROOT / "model" / "qwen"
MANIFEST_PATH = QWEN_MODEL_DIR / "manifest.json"

HEALTH_TIMEOUT_SECONDS = 60.0
HEALTH_INTERVAL_SECONDS = 0.5


def _load_manifest() -> dict:
    """读取 model/qwen/manifest.json，返回 manifest 字典。"""
    if not MANIFEST_PATH.is_file():
        raise FileNotFoundError(f"manifest 不存在：{MANIFEST_PATH}")
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def default_base_url() -> str:
    """QED_MODEL_URL 环境变量，默认 http://127.0.0.1:5001/v1。"""
    return os.getenv("QED_MODEL_URL", "http://127.0.0.1:5001/v1").rstrip("/")


def _port_from_url(url: str) -> int:
    """从 URL 提取端口号，默认 5001。"""
    try:
        return int(url.rstrip("/").rsplit(":", 1)[1].split("/")[0])
    except (ValueError, IndexError):
        return 5001


def _health_ok(port: int) -> bool:
    base = default_base_url() if port == 5001 else f"http://127.0.0.1:{port}/v1"
    try:
        with urllib.request.urlopen(base + "/models", timeout=1.0) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _lmstudio_backends_dir() -> Path:
    """LM Studio 后端扩展目录（自带 llama.cpp 构建，ARCH-033 R2 回退来源）。"""
    return Path.home() / ".lmstudio" / "extensions" / "backends"


def _lmstudio_models_dir() -> Path:
    """LM Studio 模型下载目录（llamacpp 通道 GGUF 引用的落点）。"""
    return Path.home() / ".lmstudio" / "models"


def _backend_version(name: str) -> tuple[int, ...]:
    tail = name.rsplit("-", 1)[-1]
    return tuple(int(x) for x in tail.split(".")) if tail[:1].isdigit() else (0,)


def _find_llama_server() -> str | None:
    """llama-server 路径：PATH 优先 → LM Studio 自带后端（CUDA 变体优先、版本数值最大）。"""
    found = shutil.which("llama-server")
    if found:
        return found
    base = _lmstudio_backends_dir()
    if not base.is_dir():
        return None
    cands = [
        (exe, d.name)
        for d in base.glob("llama.cpp-*")
        if d.is_dir() and (exe := d / "llama-server.exe").is_file()
    ]
    if not cands:
        return None
    cuda = [c for c in cands if "nvidia-cuda" in c[1]]
    exe = max(cuda or cands, key=lambda c: _backend_version(c[1]))[0]
    return str(exe)


def _resolve_gguf_path(value: str) -> Path:
    """GGUF 引用解析：绝对路径直用；相对路径挂 ~/.lmstudio/models（缺失抛 FileNotFoundError）。"""
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = _lmstudio_models_dir() / path
    if not path.is_file():
        raise FileNotFoundError(f"GGUF 不存在：{path}")
    return path


def _resolve_model_path(manifest: dict) -> Path:
    """根据 manifest.active 定位模型文件。"""
    active = manifest.get("active", "")
    if not active:
        raise ValueError("manifest 缺少 active 字段（模型目录名）")
    model_dir = QWEN_MODEL_DIR / active
    if not model_dir.is_dir():
        raise FileNotFoundError(f"模型目录不存在：{model_dir}")
    # 查找 GGUF 文件（.gguf 后缀）
    gguf_files = list(model_dir.glob("*.gguf"))
    if not gguf_files:
        raise FileNotFoundError(f"模型目录无 .gguf 文件：{model_dir}")
    return gguf_files[0]


def _build_server_cmd(manifest: dict, port: int, model_path: Path,
                      cli: dict | None = None) -> list[str]:
    """构建 llama-server 启动命令：CLI 参数 > manifest serve 兼容回退（ARCH-033，
    参数事实源已移 registry 身份表，8900 经旗标注入；脚本直跑仍可读 manifest）。"""
    serve = manifest.get("serve", {})
    cli = cli or {}
    cmd = [
        "llama-server",
        "--model", str(model_path),
        "--port", str(port),
        "--host", "0.0.0.0",
    ]
    ctx = cli.get("ctx", serve.get("ctx"))
    if ctx is not None:
        cmd += ["--ctx-size", str(ctx)]
    ngl = cli.get("ngl", serve.get("n_gpu_layers"))
    if ngl is not None:
        cmd += ["--n-gpu-layers", str(ngl)]
    if cli.get("fa"):
        cmd += ["--flash-attn", "on"]  # 真机需取值；裸旗标会吞后续参数致解析失败
    if cli.get("parallel") is not None:
        cmd += ["--parallel", str(cli["parallel"])]
    mmproj = next(iter(sorted(model_path.parent.glob("mmproj-*.gguf"))), None)
    if mmproj is not None:
        cmd += ["--mmproj", str(mmproj)]
    return cmd


def cmd_start(args: argparse.Namespace) -> int:
    port = args.port or _port_from_url(default_base_url())
    if _health_ok(port):
        print(f"already running (port {port})")
        return 0
    llama = _find_llama_server()
    if llama is None:
        print("llama-server 未安装：请先安装 llama.cpp（https://github.com/ggml-org/llama.cpp）"
              "或安装 LM Studio（自带后端）")
        return 1
    cli = {
        "ctx": getattr(args, "ctx", None),
        "ngl": getattr(args, "ngl", None),
        "fa": getattr(args, "fa", None),
        "parallel": getattr(args, "parallel", None),
    }
    cli = {k: v for k, v in cli.items() if v is not None}
    try:
        if getattr(args, "gguf", None):
            model_path = _resolve_gguf_path(args.gguf)
            try:
                manifest = _load_manifest()
            except (FileNotFoundError, json.JSONDecodeError, ValueError):
                manifest = {}  # CLI 参数在场时 manifest 仅兼容回退，不阻塞（ARCH-033）
        else:
            manifest = _load_manifest()
            model_path = _resolve_model_path(manifest)
    except (FileNotFoundError, json.JSONDecodeError, ValueError) as exc:
        print(f"manifest/模型错误：{exc}")
        return 1
    cmd = _build_server_cmd(manifest, port, model_path, cli)
    cmd[0] = llama  # 替换为实际路径
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        print(f"llama-server started (pid={proc.pid}, port={port})")
        if args.wait and args.wait > 0:
            return _wait_healthy(port, args.wait)
        return 0
    except (OSError, subprocess.SubprocessError) as exc:
        print(f"llama-server 启动失败：{exc}")
        return 1


def cmd_stop(args: argparse.Namespace) -> int:
    port = args.port or _port_from_url(default_base_url())
    # 按端口查找占用进程并终止
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True, timeout=5,
            errors="replace",  # DEFECT-019: netstat GBK header must not kill reader thread
        )
        for line in (result.stdout or "").splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                pid = int(parts[-1])
                os.kill(pid, signal.SIGTERM)
                print(f"stopped (pid={pid})")
                return 0
    except (OSError, subprocess.SubprocessError, ValueError, PermissionError):
        pass
    print("no llama-server process found")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    port = args.port or _port_from_url(default_base_url())
    if _health_ok(port):
        print(f"running (port probe {port})")
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


def _add_serve_args(parser: argparse.ArgumentParser) -> None:
    """加载层参数旗标（8900 经 registry 身份表注入；缺省回退 manifest serve）。"""
    parser.add_argument("--gguf", default=None,
                        help="GGUF 路径（绝对路径或 ~/.lmstudio/models 相对引用）")
    parser.add_argument("--ctx", type=int, default=None, help="上下文长度（--ctx-size）")
    parser.add_argument("--ngl", type=int, default=None, help="GPU 卸载层数（--n-gpu-layers）")
    parser.add_argument("--fa", action="store_true", default=None, help="启用 flash-attn")
    parser.add_argument("--parallel", type=int, default=None, help="并行槽数")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="qed_qwen_service",
        description="本地文字模型（llama-server / Qwen GGUF）生命周期管理（start/stop/restart/status）。",
    )
    parser.add_argument("--port", type=int, default=None,
                        help="健康探测端口（默认 QED_MODEL_URL 解析或 5001）")
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("start", help="启动 llama-server（加载 GGUF）")
    start.add_argument("--wait", nargs="?", const=HEALTH_TIMEOUT_SECONDS, type=float, default=0.0,
                       help="等待 /v1/models 就绪，默认 60s")
    _add_serve_args(start)
    start.set_defaults(func=cmd_start)

    stop = subparsers.add_parser("stop", help="停止 llama-server")
    stop.set_defaults(func=cmd_stop)

    restart = subparsers.add_parser("restart", help="重启服务")
    restart.add_argument("--wait", nargs="?", const=HEALTH_TIMEOUT_SECONDS, type=float, default=0.0)
    _add_serve_args(restart)
    restart.set_defaults(func=cmd_restart)

    status = subparsers.add_parser("status", help="查询服务状态")
    status.set_defaults(func=cmd_status)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.port is None:
        args.port = _port_from_url(default_base_url())
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
