"""
模块职责：守护 scripts/text-model/qed_qwen_service.py（本地文字模型生命周期）契约——
llama-server 启停、健康探测（QED_MODEL_URL / 默认 5001/v1）、manifest 读取、子命令结构。
设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
被测代码：scripts/text-model/qed_qwen_service.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "text-model" / "qed_qwen_service.py"
MANIFEST = ROOT / "model" / "qwen" / "manifest.json"


def test_qwen_script_exists():
    assert SCRIPT.is_file(), "scripts/text-model/qed_qwen_service.py 不存在"


def test_qwen_script_contract():
    """llama-server 命令 + 健康端点 + manifest 读取 + 子命令齐全。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "llama-server" in src, "应使用 llama-server"
    assert "/v1/models" in src, "健康探测应检查 /v1/models"
    assert "QED_MODEL_URL" in src, "应读取 QED_MODEL_URL 环境变量"
    assert "manifest" in src, "应读取 manifest.json"
    assert "5001" in src, "默认端口应为 5001"
    for cmd in ("start", "stop", "restart", "status"):
        assert cmd in src, f"脚本缺少子命令 {cmd}"


def test_qwen_manifest_exists():
    """model/qwen/manifest.json 应存在（W2 骨架）。"""
    assert MANIFEST.is_file(), "model/qwen/manifest.json 不存在"
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert "active" in data, "manifest 缺少 active 字段"
    assert "serve" in data, "manifest 缺少 serve 字段"


def test_qwen_health_probe(monkeypatch):
    """_health_ok：/v1/models 200 即就绪（默认 5001 尊重 QED_MODEL_URL）。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_qwen_service_mod", SCRIPT)
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


def test_qwen_start_without_llama_server(monkeypatch, capsys):
    """llama-server 未安装：cmd_start 返回 1 并给出明确提示。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_qwen_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    monkeypatch.setattr(mod, "_health_ok", lambda port: False)
    monkeypatch.setattr(mod, "_find_llama_server", lambda: None)
    args = type("A", (), {"port": 5001, "model": None, "wait": 0.0})()
    assert mod.cmd_start(args) == 1
    out = capsys.readouterr().out
    assert "llama-server 未安装" in out


def test_qwen_stop_no_process(capsys):
    """stop 未找到进程：返回 0 并提示。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_qwen_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # monkeypatch netstat to return empty
    import subprocess
    orig_run = subprocess.run

    def fake_run(cmd, **kwargs):
        class R:
            returncode = 0
            stdout = ""
        return R()

    subprocess.run = fake_run
    try:
        args = type("A", (), {"port": 5001})()
        assert mod.cmd_stop(args) == 0
    finally:
        subprocess.run = orig_run
