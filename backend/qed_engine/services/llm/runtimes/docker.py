"""docker runtime：MinerU 容器（WSL），生命周期复用 image-model 脚本（infra-*.ps1）。

设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_llm_model_manager.py
"""

from __future__ import annotations

from qed_engine.config import Settings
from qed_engine.services.llm.runtimes.base import DOCKER_SCRIPT, ScriptRuntime


def _health_url(settings: Settings) -> str:
    """MinerU 容器健康端点（GET /health）。"""
    return settings.qed_ocr_model_url.rstrip("/") + "/health"


runtime = ScriptRuntime(
    script=DOCKER_SCRIPT,
    label="image-model/qed_mineru_service.py",
    health_url=_health_url,
)
