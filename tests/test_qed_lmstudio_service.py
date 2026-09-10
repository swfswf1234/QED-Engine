"""
模块职责：守护 scripts/text-model/qed_lmstudio_service.py（本地文字模型生命周期）契约——
lms CLI 启停、健康探测（QED_LMSTUDIO_URL / 默认 5001/v1）、子命令结构。
设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：In Progress
被测代码：scripts/text-model/qed_lmstudio_service.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "text-model" / "qed_lmstudio_service.py"


def test_lmstudio_script_exists():
    assert SCRIPT.is_file(), "scripts/text-model/qed_lmstudio_service.py 不存在"


def test_lmstudio_script_contract():
    """lms CLI 命令 + 健康端点 + 子命令齐全。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "lms" in src, "应优先使用 LM Studio 官方 lms CLI"
    assert "/v1/models" in src, "健康探测应检查 /v1/models"
    assert "5001" in src, "默认端口应为 5001"
    for cmd in ("start", "stop", "restart", "status"):
        assert cmd in src, f"脚本缺少子命令 {cmd}"


def test_lmstudio_health_probe(monkeypatch):
    """_health_ok：/v1/models 200 即就绪（默认 5001 尊重 QED_LMSTUDIO_URL）。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_lmstudio_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    import urllib.request

    class FakeResp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    calls: dict = {}

    def fake_urlopen(url, timeout=1.0):
        calls["url"] = url
        return FakeResp()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    assert mod._health_ok(5001) is True
    assert "5001" in calls["url"] and "/v1/models" in calls["url"]


def test_lmstudio_start_without_lms_cli(monkeypatch, capsys):
    """lms CLI 缺失：cmd_start 返回 1 并给出明确提示。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_lmstudio_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    monkeypatch.setattr(mod, "_health_ok", lambda port: False)
    monkeypatch.setattr(mod, "_lms", lambda: None)
    args = type("A", (), {"port": 5001, "model": None, "wait": 0.0})()
    assert mod.cmd_start(args) == 1
    out = capsys.readouterr().out
    assert "lms CLI 未安装" in out
