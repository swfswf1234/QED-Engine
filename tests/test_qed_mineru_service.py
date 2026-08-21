"""
模块职责：守护 scripts/image-model/qed_mineru_service.py（本地图像模型 MinerU 生命周期）契约——
infra-*.ps1 编排调用、健康探测（8002 /api/v1/health）、子命令结构。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：scripts/image-model/qed_mineru_service.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "image-model" / "qed_mineru_service.py"


def test_mineru_script_exists():
    assert SCRIPT.is_file(), "scripts/image-model/qed_mineru_service.py 不存在"


def test_mineru_script_contract():
    """infra 编排脚本引用 + 健康端点 + 子命令齐全。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "infra-up.ps1" in src and "infra-down.ps1" in src and "infra-status.ps1" in src
    assert "8002" in src and "/api/v1/health" in src
    for cmd in ("start", "stop", "restart", "status"):
        assert cmd in src, f"脚本缺少子命令 {cmd}"


def test_mineru_health_probe(monkeypatch):
    """_health_ok：8002 /api/v1/health 200 即就绪。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_mineru_service_mod", SCRIPT)
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
    assert mod._health_ok(8002) is True
    assert "/api/v1/health" in calls["url"]


def test_mineru_run_infra_timeout(monkeypatch):
    """_run_infra：subprocess 超时/异常 → 返回 1 而非裸 traceback。"""
    import importlib.util
    import subprocess

    spec = importlib.util.spec_from_file_location("qed_mineru_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    def boom(*args, **kwargs):
        raise subprocess.TimeoutExpired(cmd=["powershell"], timeout=600)

    monkeypatch.setattr(subprocess, "run", boom)
    assert mod._run_infra("infra-up.ps1") == 1


def test_mineru_default_port_from_env(monkeypatch):
    """default_port：QED_MINERU_URL 端口解析；空时默认 8002。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_mineru_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    monkeypatch.setenv("QED_MINERU_URL", "http://127.0.0.1:9999")
    assert mod.default_port() == 9999
    monkeypatch.delenv("QED_MINERU_URL", raising=False)
    assert mod.default_port() == 8002


def test_mineru_health_probe_honors_env_on_default_port(monkeypatch):
    """_health_ok(8002)：QED_MINERU_URL 完整地址（host 含端口）被尊重。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_mineru_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    import urllib.request

    calls: dict = {}

    class FakeResp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def fake_urlopen(url, timeout=1.0):
        calls["url"] = url
        return FakeResp()

    monkeypatch.setenv("QED_MINERU_URL", "http://127.0.0.1:9999")
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    assert mod._health_ok(8002) is True
    assert "127.0.0.1:9999" in calls["url"] and "/api/v1/health" in calls["url"]