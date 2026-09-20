"""llamacpp runtime：llama-server（OpenAI 兼容），生命周期复用 text-model 脚本。

设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_llm_model_manager.py
"""

from __future__ import annotations

from qed_engine.config import Settings
from qed_engine.services.llm.runtimes.base import LLAMACPP_SCRIPT, ScriptRuntime


def _health_url(settings: Settings) -> str:
    """llama-server 健康端点（OpenAI 兼容 GET /models）。"""
    return settings.qed_model_url.rstrip("/") + "/models"


runtime = ScriptRuntime(
    script=LLAMACPP_SCRIPT,
    label="text-model/qed_qwen_service.py",
    health_url=_health_url,
)
