"""runtime 注册表：本地部署形态 → LocalRuntime 实例（PLAN-046 runtime 同化唯一入口）。

设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_llm_model_manager.py
"""

from __future__ import annotations

from qed_engine.services.llm.runtimes.base import LocalRuntime, RuntimeResult, ScriptRuntime
from qed_engine.services.llm.runtimes.docker import runtime as _docker_runtime
from qed_engine.services.llm.runtimes.llamacpp import runtime as _llamacpp_runtime
from qed_engine.services.llm.runtimes.lmstudio import LmStudioRuntime

RUNTIMES: dict[str, LocalRuntime] = {
    "lmstudio": LmStudioRuntime(),
    "llamacpp": _llamacpp_runtime,
    "docker": _docker_runtime,
}


def get_runtime(name: str) -> LocalRuntime:
    """按名取 runtime；未知名抛 ValueError（路由层映射 404）。"""
    if name not in RUNTIMES:
        raise ValueError(f"未知本地 runtime：{name}（支持 {' / '.join(RUNTIMES)}）")
    return RUNTIMES[name]


__all__ = ["RUNTIMES", "LocalRuntime", "RuntimeResult", "ScriptRuntime", "get_runtime"]
