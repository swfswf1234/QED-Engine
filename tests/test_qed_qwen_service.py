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


# ---------- llama-server 回退与参数构建（ARCH-033 W3） ----------


def _load_script_mod():
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_qwen_service_w3", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_find_llama_server_prefers_cuda_and_numeric_version(tmp_path, monkeypatch):
    """PATH 无 llama-server 时回退 LM Studio backends：CUDA 变体优先，版本按数值比较。"""
    mod = _load_script_mod()
    monkeypatch.setattr(mod.shutil, "which", lambda _n: None)
    base = tmp_path / "backends"
    for name in ("llama.cpp-win-x86_64-avx2-2.5.0",
                 "llama.cpp-win-x86_64-nvidia-cuda12-avx2-2.44.0",
                 "llama.cpp-win-x86_64-avx2-2.41.0"):
        d = base / name
        d.mkdir(parents=True)
        (d / "llama-server.exe").write_text("")
    monkeypatch.setattr(mod, "_lmstudio_backends_dir", lambda: base)
    assert mod._find_llama_server() == str(
        base / "llama.cpp-win-x86_64-nvidia-cuda12-avx2-2.44.0" / "llama-server.exe")
    (base / "llama.cpp-win-x86_64-nvidia-cuda12-avx2-2.44.0" / "llama-server.exe").unlink()
    assert mod._find_llama_server() == str(
        base / "llama.cpp-win-x86_64-avx2-2.41.0" / "llama-server.exe")
    monkeypatch.setattr(mod, "_lmstudio_backends_dir", lambda: tmp_path / "missing")
    assert mod._find_llama_server() is None


def test_build_server_cmd_cli_params_beat_manifest(tmp_path):
    """CLI 参数 > manifest serve 兼容回退；fa/parallel/mmproj 兄弟文件入令。"""
    mod = _load_script_mod()
    model = tmp_path / "q.gguf"
    model.write_text("")
    (tmp_path / "mmproj-F16.gguf").write_text("")
    manifest = {"serve": {"ctx": 8192, "n_gpu_layers": -1}}
    cmd = mod._build_server_cmd(manifest, 5001, model,
                                cli={"ctx": 16384, "ngl": -1, "fa": True, "parallel": 2})
    assert cmd[cmd.index("--ctx-size") + 1] == "16384"
    assert cmd[cmd.index("--n-gpu-layers") + 1] == "-1"
    assert cmd[cmd.index("--flash-attn") + 1] == "on"  # 真机 llama-server 需取值（裸旗标吞后续参数）
    assert cmd[cmd.index("--parallel") + 1] == "2"
    assert cmd[cmd.index("--mmproj") + 1] == str(tmp_path / "mmproj-F16.gguf")


def test_build_server_cmd_manifest_fallback_without_cli(tmp_path):
    """无 CLI 参数时保持旧行为：manifest serve 兼容读取，无 fa/parallel/mmproj。"""
    mod = _load_script_mod()
    model = tmp_path / "q.gguf"
    model.write_text("")
    cmd = mod._build_server_cmd({"serve": {"ctx": 8192, "n_gpu_layers": -1}}, 5001, model)
    assert cmd[cmd.index("--ctx-size") + 1] == "8192"
    assert "--flash-attn" not in cmd and "--parallel" not in cmd and "--mmproj" not in cmd


def test_resolve_gguf_ref_under_lmstudio_models(tmp_path, monkeypatch):
    """GGUF 引用解析：相对路径挂 ~/.lmstudio/models，绝对路径直用，缺失报 FileNotFoundError。"""
    mod = _load_script_mod()
    models = tmp_path / "models"
    (models / "pub").mkdir(parents=True)
    (models / "pub" / "q.gguf").write_text("")
    monkeypatch.setattr(mod, "_lmstudio_models_dir", lambda: models)
    assert mod._resolve_gguf_path("pub/q.gguf") == models / "pub" / "q.gguf"
    assert mod._resolve_gguf_path(str(models / "pub" / "q.gguf")) == models / "pub" / "q.gguf"
    try:
        mod._resolve_gguf_path("pub/none.gguf")
    except FileNotFoundError:
        pass
    else:
        raise AssertionError("缺失 GGUF 应抛 FileNotFoundError")


def test_cmd_start_uses_gguf_ref_and_param_flags(tmp_path, monkeypatch):
    """cmd_start：--gguf 引用 + 参数旗标进 llama-server 命令；manifest 缺失不阻塞。"""
    import types as _types

    mod = _load_script_mod()
    models = tmp_path / "models"
    (models / "pub").mkdir(parents=True)
    gguf = models / "pub" / "q.gguf"
    gguf.write_text("")
    monkeypatch.setattr(mod, "_lmstudio_models_dir", lambda: models)
    monkeypatch.setattr(mod, "_health_ok", lambda port: False)
    monkeypatch.setattr(mod, "_find_llama_server", lambda: str(tmp_path / "llama-server.exe"))
    captured = {}

    class _P:
        pid = 42

    def fake_popen(cmd, **_kw):
        captured["cmd"] = cmd
        return _P()

    monkeypatch.setattr(mod.subprocess, "Popen", fake_popen)
    args = _types.SimpleNamespace(port=5001, wait=0.0, gguf="pub/q.gguf",
                                  ctx="16384", ngl="-1", fa=True, parallel=None)
    assert mod.cmd_start(args) == 0
    cmd = captured["cmd"]
    assert cmd[0] == str(tmp_path / "llama-server.exe")
    assert cmd[cmd.index("--model") + 1] == str(gguf)
    assert cmd[cmd.index("--ctx-size") + 1] == "16384"
    assert cmd[cmd.index("--flash-attn") + 1] == "on"


# ---------- DEFECT-019：netstat 输出容错解码（GBK 表头击穿 text=True → stdout=None） ----------


def test_qwen_stop_declares_tolerant_decode_and_survives_none_stdout(monkeypatch, capsys):
    """DEFECT-019 S1：`netstat -ano` 调用带 errors="replace"，输出不可用时降级为「无进程」。"""
    mod = _load_script_mod()
    captured: dict = {}

    class _R:
        returncode = 0
        stdout = None

    def fake_run(cmd, **kwargs):
        captured["cmd"] = cmd
        captured.update(kwargs)
        return _R()

    monkeypatch.setattr(mod.subprocess, "run", fake_run)
    args = type("A", (), {"port": 5001})()

    assert mod.cmd_stop(args) == 0
    assert captured.get("errors") == "replace", "subprocess.run 应带 errors='replace' 容忍 GBK 输出"
    assert "no llama-server process found" in capsys.readouterr().out
