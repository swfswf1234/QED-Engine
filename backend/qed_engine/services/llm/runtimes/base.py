"""runtime 同化基座：LocalRuntime 协议 + RuntimeResult + 脚本型 runtime 基类。

2026-09-16（PLAN-046）：本地三种部署形态（LM Studio / llama.cpp / docker）同化为统一
「本地模型」语义——probe（就绪 = 模型可用而非仅进程存活）/ start（幂等）/ stop（释放
显存或进程）。llamacpp 与 docker 复用 scripts/ 下既有生命周期脚本（脚本保留 CLI 入口）。

设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_llm_model_manager.py
"""

from __future__ import annotations

import subprocess
import sys
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from qed_engine.config import Settings

# 本地健康探测与读回一律不经环境代理：Windows 环境/注册表代理会截走 127.0.0.1 请求，
# 而 urllib 没有 loopback 自动 bypass（DEFECT-008 ①，与 monitor.py 探针 trust_env=False 同纪律）
NO_PROXY_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

# 子进程输出显式按 UTF-8 解码：脚本与 lms CLI 输出中文，跟随 Windows 本地编码（GBK）
# 会让 reader 线程抛 UnicodeDecodeError 吞掉返回码（DEFECT-008 ⑤）
CHILD_OUTPUT_ENCODING = "utf-8"

ROOT = Path(__file__).resolve().parents[5]  # services/llm/runtimes/ → 仓库根

# 生命周期脚本（v1 平移：脚本保留 CLI 入口，runtime 经 subprocess 调用）
LLAMACPP_SCRIPT = ROOT / "scripts" / "text-model" / "qed_qwen_service.py"
DOCKER_SCRIPT = ROOT / "scripts" / "image-model" / "qed_mineru_service.py"


@dataclass
class RuntimeResult:
    """runtime 操作结果：ok=False 时 detail 为明确中文原因。"""

    ok: bool
    detail: str = ""


class LocalRuntime(Protocol):
    """本地 runtime 统一协议（未来 AGENT/MCP 配置走同一入口）。"""

    def probe(self, settings: Settings, model: str = "") -> bool: ...

    def start(self, settings: Settings, model: str = "", log: Callable[[str], None] | None = None,
              script_runner: Callable | None = None,
              params: dict | None = None) -> RuntimeResult: ...

    def stop(self, settings: Settings, model: str = "", log: Callable[[str], None] | None = None,
             script_runner: Callable | None = None) -> RuntimeResult: ...


def probe_http(url: str) -> bool:
    """HTTP 健康探测：200 即就绪；异常 False（v1 model_manager._probe_http 平移）。"""
    try:
        with NO_PROXY_OPENER.open(url, timeout=1.0) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


def run_script(script: Path, command: str, script_runner: Callable | None = None,
               extra_args: tuple[str, ...] = ()) -> int:
    """执行本地模型生命周期脚本（start/stop）；script_runner 可注入（测试）。

    extra_args：加载参数旗标（ARCH-033，8900 由 registry 身份表注入脚本 CLI）。
    """
    runner = script_runner or subprocess.run
    try:
        result = runner(
            [sys.executable, str(script), command, *extra_args],
            capture_output=True,
            text=True,
            encoding=CHILD_OUTPUT_ENCODING,
            errors="replace",
            timeout=600,
        )
        return result.returncode
    except (OSError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        return 1


class ScriptRuntime:
    """脚本型 runtime 基类：生命周期复用既有脚本，probe 走各自健康端点。"""

    def __init__(self, script: Path, label: str, health_url: Callable[[Settings], str]):
        self.script = script
        self.label = label
        self.health_url = health_url

    def probe(self, settings: Settings, model: str = "") -> bool:
        """就绪 = 健康端点 200（模型标识不参与：脚本型 runtime 一脚本一模型）。"""
        return probe_http(self.health_url(settings))

    def start(self, settings: Settings, model: str = "", log: Callable[[str], None] | None = None,
              script_runner: Callable | None = None,
              params: dict | None = None) -> RuntimeResult:
        log = log or (lambda _m: None)
        log(f"start {self.label}")
        rc = run_script(self.script, "start", script_runner,
                        extra_args=tuple(self.extra_start_args(model, params or {})))
        if rc != 0:
            return RuntimeResult(False, f"start {self.label} 失败（rc={rc}）")
        return RuntimeResult(True, f"start {self.label} 完成")

    def extra_start_args(self, model: str, params: dict) -> list[str]:
        """子类钩子：加载参数 → 脚本 CLI 旗标（llamacpp 覆写；docker 无参数恒空）。"""
        return []

    def stop(self, settings: Settings, model: str = "", log: Callable[[str], None] | None = None,
             script_runner: Callable | None = None) -> RuntimeResult:
        log = log or (lambda _m: None)
        log(f"stop {self.label}")
        rc = run_script(self.script, "stop", script_runner)
        if rc != 0:
            return RuntimeResult(False, f"stop {self.label} 失败（rc={rc}）")
        return RuntimeResult(True, f"stop {self.label} 完成")
