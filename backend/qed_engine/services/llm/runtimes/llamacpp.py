"""llamacpp runtime：llama-server（LM Studio 自带后端与 GGUF）+ 端口互斥自动让位。

ARCH-033（2026-09-24）真做：二进制解析与模型引用复用 LM Studio 目录（本机零安装）；
加载参数由 8900 经 registry 身份表注入脚本旗标（--gguf/--ctx/--ngl/--fa）；启动前
探测常驻 LM Studio server 占用共用端口（5001）→ 自动 `lms unload --all` + `lms server stop`
让位（裁决 R3；W7 真机修正：单独 stop 不终止自带 worker，显存不释放）。

设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_llm_model_manager.py
"""

from __future__ import annotations

import time
from collections.abc import Callable

from qed_engine.config import Settings
from qed_engine.services.llm.runtimes import lmstudio
from qed_engine.services.llm.runtimes.base import LLAMACPP_SCRIPT, RuntimeResult, ScriptRuntime

_sleep = time.sleep

# 让位轮询（lms server stop 后端口释放通常秒级）
YIELD_TIMEOUT_S = 15.0
YIELD_POLL_INTERVAL_S = 1.0

# registry 身份表参数键 → 脚本 CLI 旗标（脚本再映射 llama-server 原生参数）
_PARAM_FLAGS = (("ctx", "--ctx"), ("ngl", "--ngl"), ("parallel", "--parallel"))


def _health_url(settings: Settings) -> str:
    """llama-server 健康端点（OpenAI 兼容 GET /models）。"""
    return settings.qed_model_url.rstrip("/") + "/models"


def _lmstudio_server_running(settings: Settings) -> bool:
    """REST v0 有应答 = 常驻 LM Studio server 占用共用端口（llama-server 无 v0 端点）。"""
    return lmstudio._loaded_ids(settings) is not None


class LlamaCppRuntime(ScriptRuntime):
    """脚本型 llamacpp runtime + LM Studio 让位前置（R3 自动 lms server stop）。"""

    def extra_start_args(self, model: str, params: dict) -> list[str]:
        args = ["--gguf", model] if model else []
        for key, flag in _PARAM_FLAGS:
            if params.get(key) is not None:
                args += [flag, str(params[key])]
        if params.get("fa"):
            args.append("--fa")
        return args

    def start(self, settings: Settings, model: str = "",
              log: Callable[[str], None] | None = None,
              script_runner: Callable | None = None,
              params: dict | None = None) -> RuntimeResult:
        log = log or (lambda _m: None)
        if _lmstudio_server_running(settings):
            log("LM Studio server 常驻占用端口，先 lms unload --all + lms server stop 让位（裁决 R3）")
            # W7 真机实测：单独 server stop 后 LM Studio 自带 llama-server worker 残驻占显存，
            # 必须先行全量卸载终止 worker
            if lmstudio._run_lms(["unload", "--all"]) != 0:
                return RuntimeResult(False, "LM Studio 模型卸载让位失败（lms unload --all rc≠0）")
            if lmstudio._run_lms(["server", "stop"]) != 0:
                return RuntimeResult(False, "LM Studio server 让位失败（lms server stop rc≠0）")
            deadline = time.monotonic() + YIELD_TIMEOUT_S
            while time.monotonic() < deadline:
                if not _lmstudio_server_running(settings):
                    break
                _sleep(YIELD_POLL_INTERVAL_S)
            else:
                return RuntimeResult(False, "LM Studio server 让位后端口仍未释放（超时）")
        return super().start(settings, model=model, log=log,
                             script_runner=script_runner, params=params)


runtime = LlamaCppRuntime(
    script=LLAMACPP_SCRIPT,
    label="text-model/qed_qwen_service.py",
    health_url=_health_url,
)
