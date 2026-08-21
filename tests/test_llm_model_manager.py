"""
模块职责：本地模型资源互斥（model_manager）契约测试：api 模式不启动本地、
local 模式启动前先停对方、guard=false 跳过互斥、已就绪不重复启动。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：backend/qed_engine/services/llm/model_manager.py
"""

from qed_engine.config import Settings
from qed_engine.services.llm import model_manager


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


def _noop_runner():
    class P:
        def __init__(self, *a, **k):
            self.returncode = 0

    return P


def test_api_mode_never_starts_local():
    """api 模式：本地模型完全不参与（不探测、不启动）。"""
    calls = []
    runner = _noop_runner()
    model_manager.ensure_text_ready(_settings(qed_api_select="api"), script_runner=runner, log=calls.append)
    model_manager.ensure_image_ready(_settings(qed_api_select="api"), script_runner=runner, log=calls.append)
    assert calls == []


def test_local_text_stops_mineru_before_start(monkeypatch):
    """local 文字：LM Studio 未就绪 → guard=true 先停 mineru 再启动 text-model。"""
    settings = _settings(qed_api_select="local")
    commands = []
    runner = _noop_runner()

    def fake_probe(port, url_path=""):
        return False  # 均未就绪

    monkeypatch.setattr(model_manager, "_probe_http", fake_probe)
    model_manager.ensure_text_ready(settings, script_runner=runner, log=commands.append)
    assert commands == ["stop image-model/qed_mineru_service.py", "start text-model/qed_lmstudio_service.py"]


def test_local_text_without_guard_skips_stop(monkeypatch):
    """guard=false：启动文字模型前不自动停 mineru。"""
    settings = _settings(qed_api_select="local", qed_resource_guard=False)
    commands = []
    runner = _noop_runner()

    def fake_probe(port, url_path=""):
        return False

    monkeypatch.setattr(model_manager, "_probe_http", fake_probe)
    model_manager.ensure_text_ready(settings, script_runner=runner, log=commands.append)
    assert commands == ["start text-model/qed_lmstudio_service.py"]


def test_local_text_ready_skips_start(monkeypatch):
    """local 文字：LM Studio 已就绪 → 不重复启动。"""
    settings = _settings(qed_api_select="local")
    commands = []
    runner = _noop_runner()
    monkeypatch.setattr(model_manager, "_probe_http", lambda port, url_path="": True)
    model_manager.ensure_text_ready(settings, script_runner=runner, log=commands.append)
    assert commands == []


def test_local_image_stops_text_before_start(monkeypatch):
    """local 图像：MinerU 未就绪 → guard=true 先停 text 再启动 image。"""
    settings = _settings(qed_api_select="local")
    commands = []
    runner = _noop_runner()
    monkeypatch.setattr(model_manager, "_mineru_ready", lambda s: False)
    model_manager.ensure_image_ready(settings, script_runner=runner, log=commands.append)
    assert commands == ["stop text-model/qed_lmstudio_service.py", "start image-model/qed_mineru_service.py"]


def test_local_image_without_guard_skips_stop(monkeypatch):
    """guard=false：启动图像模型前不自动停 LM Studio。"""
    settings = _settings(qed_api_select="local", qed_resource_guard=False)
    commands = []
    runner = _noop_runner()
    monkeypatch.setattr(model_manager, "_mineru_ready", lambda s: False)
    model_manager.ensure_image_ready(settings, script_runner=runner, log=commands.append)
    assert commands == ["start image-model/qed_mineru_service.py"]


def test_local_image_ready_skips_start(monkeypatch):
    """local 图像：MinerU 已就绪 → 不重复启动。"""
    settings = _settings(qed_api_select="local")
    commands = []
    runner = _noop_runner()
    monkeypatch.setattr(model_manager, "_mineru_ready", lambda s: True)
    model_manager.ensure_image_ready(settings, script_runner=runner, log=commands.append)
    assert commands == []
