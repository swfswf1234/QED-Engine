"""本地模型资源管理器：按 QED_API_SELECT 判定是否需要本地模型，启动前执行资源互斥。

互斥规则（QED_RESOURCE_GUARD=true）：启动/调用本地文字模型前，若 MinerU 运行中先停止；
启动/调用本地图像模型前，若 LM Studio 运行中先停止。批处理方向：文字批处理期间图像模型
保持停止，反之亦然——互斥在模型服务启动时自动完成。
api 模式（默认）不启动任何本地模型，本模块直接放行。

设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
关联测试：tests/test_llm_model_manager.py
"""

import subprocess
import sys
import urllib.error
import urllib.request
from collections.abc import Callable
from pathlib import Path

from qed_engine.config import Settings

ROOT = Path(__file__).resolve().parents[4]  # services/llm/ → 仓库根
TEXT_SCRIPT = ROOT / "scripts" / "text-model" / "qed_lmstudio_service.py"
IMAGE_SCRIPT = ROOT / "scripts" / "image-model" / "qed_mineru_service.py"


def _probe_http(url: str) -> bool:
    """HTTP 健康探测：200 即就绪；异常 False。"""
    try:
        with urllib.request.urlopen(url, timeout=1.0) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _lmstudio_ready(settings: Settings) -> bool:
    return _probe_http(settings.qed_lmstudio_url.rstrip("/") + "/models")


def _mineru_ready(settings: Settings) -> bool:
    return _probe_http(settings.qed_mineru_url.rstrip("/") + "/api/v1/health")


def _run_script(script: Path, command: str, script_runner=None) -> int:
    """执行本地模型生命周期脚本（start/stop）；script_runner 可注入（测试）。"""
    runner = script_runner or subprocess.run
    try:
        result = runner(
            [sys.executable, str(script), command],
            capture_output=True,
            text=True,
            timeout=600,
        )
        return result.returncode
    except (OSError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        return 1


def ensure_text_ready(settings: Settings, script_runner=None, log: Callable[[str], None] | None = None) -> None:
    """确保本地文字模型就绪（local 模式）：未就绪时先停 MinerU（guard）再启动 LM Studio。

    api 模式直接放行；脚本失败经 log 回调上报 rc，不抛异常——调用链继续走 API 或报调用错误。
    """
    log = log or (lambda _m: None)
    if settings.qed_api_select != "local":
        return
    if _lmstudio_ready(settings):
        return
    if settings.qed_resource_guard:
        log("stop image-model/qed_mineru_service.py")
        if _run_script(IMAGE_SCRIPT, "stop", script_runner) != 0:
            log("stop image-model/qed_mineru_service.py 失败")
    log("start text-model/qed_lmstudio_service.py")
    if _run_script(TEXT_SCRIPT, "start", script_runner) != 0:
        log("start text-model/qed_lmstudio_service.py 失败")


def ensure_image_ready(settings: Settings, script_runner=None, log: Callable[[str], None] | None = None) -> None:
    """确保本地图像模型（MinerU）就绪（local 模式）：未就绪时先停 LM Studio（guard）再启动。

    api 模式直接放行；脚本失败经 log 回调上报 rc，不抛异常——调用链继续走 API 或报调用错误。
    """
    log = log or (lambda _m: None)
    if settings.qed_api_select != "local":
        return
    if _mineru_ready(settings):
        return
    if settings.qed_resource_guard:
        log("stop text-model/qed_lmstudio_service.py")
        if _run_script(TEXT_SCRIPT, "stop", script_runner) != 0:
            log("stop text-model/qed_lmstudio_service.py 失败")
    log("start image-model/qed_mineru_service.py")
    if _run_script(IMAGE_SCRIPT, "start", script_runner) != 0:
        log("start image-model/qed_mineru_service.py 失败")