"""
模块职责：组件监控探测（monitor）契约测试：GPU/LM Studio/mineru 各分支与响应形状。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/services/monitor.py
"""

import subprocess

import httpx
from fastapi.testclient import TestClient
from qed_engine.api.main import create_app
from qed_engine.config import Settings
from qed_engine.services import monitor


def _fake_smi(gpu_out: str, proc_out: str = ""):
    def runner(cmd):
        if "--query-compute-apps" in " ".join(cmd):
            return proc_out
        return gpu_out

    return runner


def test_gpu_ok_parses_fields():
    """nvidia-smi 正常输出：字段齐全（型号/显存/利用率/进程，进程带 kind 分类）。"""
    runner = _fake_smi(
        "NVIDIA GeForce RTX 4080, 16376, 4096, 65",
        "1234, LM Studio, 4096",
    )
    result = monitor.probe_gpu(runner=runner)
    assert result == {
        "available": True,
        "name": "NVIDIA GeForce RTX 4080",
        "memory_total_mb": 16376,
        "memory_used_mb": 4096,
        "utilization_percent": 65,
        "processes": [{"pid": 1234, "name": "LM Studio", "memory_mb": 4096, "kind": "model"}],
    }


def test_gpu_process_kind_classifies_model_vs_other():
    """进程 kind 分类（REQ-038 GPU 饼图）：模型白名单关键词 → model，其余 → other。

    口径（2026-08-21 用户裁决）：进程名小写包含 lmstudio/lm studio/llama/qwen/mineru/
    python/vmmem/ollama 任一关键词即视为模型相关进程；其余（如浏览器/训练脚本外的
    图形程序）标记 other，供前端饼图高亮「非模型任务占用」。
    """
    runner = _fake_smi(
        "NVIDIA GeForce RTX 4080, 16376, 12000, 90",
        # 模型类：LM Studio（GUI）、llama-server、python 推理、MinerU 容器（vmmem/WSL）
        "100, LM Studio, 5000\n"
        "101, llama-server.exe, 3000\n"
        "102, python.exe, 1500\n"
        "103, vmmemWSL, 800\n"
        # 非模型：浏览器硬件加速 + 陌生计算任务
        "200, chrome.exe, 600\n"
        "201, some_game.exe, 1100",
    )
    result = monitor.probe_gpu(runner=runner)
    kinds = {p["pid"]: p["kind"] for p in result["processes"]}
    assert kinds == {100: "model", 101: "model", 102: "model", 103: "model", 200: "other", 201: "other"}


def test_gpu_process_kind_case_insensitive():
    """kind 分类大小写不敏感（LLM STUDIO / Llama-Server 同样命中白名单）。"""
    runner = _fake_smi(
        "NVIDIA GeForce RTX 4080, 16376, 4096, 65",
        "300, LLM STUDIO, 2000\n301, Llama-Server, 2096",
    )
    result = monitor.probe_gpu(runner=runner)
    assert all(p["kind"] == "model" for p in result["processes"])


def test_gpu_wddm_na_processes_kept_with_null_memory():
    """WDDM 模式（每进程显存 [N/A]）：保留进程行 memory_mb=None + kind 分类（不丢弃清单）。

    本机实测（2026-08-21）：nvidia-smi --query-compute-apps 返回 LM Studio/chrome/explorer
    等进程名但 used_memory 全为 [N/A]——显存数值拿不到，进程清单正是「非模型任务识别」所需。
    """
    runner = _fake_smi(
        "NVIDIA GeForce RTX 4080, 16376, 4635, 62",
        "28252, C:\\Program Files\\LM Studio\\LM Studio.exe, [N/A]\n"
        "20216, C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe, [N/A]\n"
        "11156, [Insufficient Permissions], [N/A]",
    )
    result = monitor.probe_gpu(runner=runner)
    assert result["available"] is True
    by_pid = {p["pid"]: p for p in result["processes"]}
    assert by_pid[28252] == {
        "pid": 28252,
        "name": "C:\\Program Files\\LM Studio\\LM Studio.exe",
        "memory_mb": None,
        "kind": "model",
    }
    assert by_pid[20216]["kind"] == "other"
    assert by_pid[20216]["memory_mb"] is None
    # [Insufficient Permissions] 行同样保留（pid 可解析、名称原样）
    assert by_pid[11156]["memory_mb"] is None


def test_gpu_invalid_pid_row_skipped():
    """pid 非数字的异常行跳过，不影响其余行解析。"""
    runner = _fake_smi(
        "NVIDIA GeForce RTX 4080, 16376, 4096, 65",
        "notapid, weird.exe, 100\n1234, python.exe, 200",
    )
    result = monitor.probe_gpu(runner=runner)
    assert [p["pid"] for p in result["processes"]] == [1234]


def test_gpu_no_processes_returns_empty_list():
    """无占用进程：processes 为空列表。"""
    runner = _fake_smi("NVIDIA GeForce RTX 4080, 16376, 4096, 65")
    result = monitor.probe_gpu(runner=runner)
    assert result["available"] is True
    assert result["processes"] == []


def test_gpu_smi_missing_reports_reason():
    """nvidia-smi 不存在（未装驱动）→ available=false + 中文原因。"""

    def runner(cmd):
        raise FileNotFoundError

    result = monitor.probe_gpu(runner=runner)
    assert result == {"available": False, "reason": "nvidia-smi 不存在（未安装 NVIDIA 驱动）"}


def test_gpu_no_gpu_reports_reason():
    """无 GPU/驱动不可用（空输出）→ available=false。"""
    result = monitor.probe_gpu(runner=_fake_smi(""))
    assert result["available"] is False
    assert "GPU" in result["reason"]


def test_gpu_parse_failure_reports_reason():
    """输出格式异常（解析失败）→ available=false，不抛异常。"""
    result = monitor.probe_gpu(runner=_fake_smi("corrupted,data,here"))
    assert result["available"] is False
    assert "解析失败" in result["reason"]


def test_gpu_execution_error_reports_reason():
    """nvidia-smi 执行异常（退出码非 0）→ available=false。"""

    def runner(cmd):
        raise OSError("nvidia-smi 退出码 4")

    result = monitor.probe_gpu(runner=runner)
    assert result["available"] is False
    assert "执行失败" in result["reason"]


def test_gpu_timeout_reports_reason():
    """nvidia-smi 执行超时（TimeoutExpired）→ available=false + 中文原因（不抛 5xx）。"""

    def runner(cmd):
        raise subprocess.TimeoutExpired(cmd, timeout=10)

    result = monitor.probe_gpu(runner=runner)
    assert result == {"available": False, "reason": "nvidia-smi 执行超时"}


def test_gpu_multi_gpu_parses_first_line():
    """多 GPU（多行输出）→ 解析首行型号，不因多行混拼解析失败。"""
    runner = _fake_smi(
        "NVIDIA GeForce RTX 4080, 16376, 4096, 65\nNVIDIA GeForce RTX 4090, 24564, 8192, 80",
    )
    result = monitor.probe_gpu(runner=runner)
    assert result["available"] is True
    assert result["name"] == "NVIDIA GeForce RTX 4080"
    assert result["memory_total_mb"] == 16376


def _lmstudio_settings():
    return Settings(_env_file=None)


def _mock_client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_lmstudio_ok_returns_models():
    """LM Studio 可达：/v1/models 返回已加载模型列表。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/models"
        return httpx.Response(200, json={"data": [{"id": "qwen3-8b"}, {"id": "qwen3-27b"}]})

    result = monitor.probe_lmstudio(_lmstudio_settings(), client=_mock_client(handler))
    assert result == {
        "reachable": True,
        "base_url": "http://127.0.0.1:5001/v1",
        "models": ["qwen3-8b", "qwen3-27b"],
        "reason": "",
    }


def test_lmstudio_http_error_reports_reason():
    """LM Studio 返回非 200 → reachable=false + HTTP 状态码。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={})

    result = monitor.probe_lmstudio(_lmstudio_settings(), client=_mock_client(handler))
    assert result["reachable"] is False
    assert result["reason"] == "HTTP 500"


def test_lmstudio_connect_error_reports_reason():
    """LM Studio 未启动（连接失败）→ reachable=false + 异常类名。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    result = monitor.probe_lmstudio(_lmstudio_settings(), client=_mock_client(handler))
    assert result["reachable"] is False
    assert result["reason"] == "ConnectError"
    assert result["models"] == []


def test_lmstudio_url_override():
    """QED_LMSTUDIO_URL 覆盖探测目标。"""
    settings = Settings(_env_file=None, qed_lmstudio_url="http://127.0.0.1:9999/v1")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/models"
        return httpx.Response(200, json={"data": []})

    result = monitor.probe_lmstudio(settings, client=_mock_client(handler))
    assert result["base_url"] == "http://127.0.0.1:9999/v1"


def test_mineru_ok():
    """mineru 8002 健康端点 200 → reachable=True。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/health"
        return httpx.Response(200, json={"status": "ok"})

    result = monitor.probe_mineru(client=_mock_client(handler))
    assert result == {"reachable": True, "port": 8002, "reason": ""}


def test_mineru_http_error_reports_status():
    """mineru 返回非 200 → reachable=false + HTTP 状态码。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={})

    result = monitor.probe_mineru(client=_mock_client(handler))
    assert result["reachable"] is False
    assert result["reason"] == "HTTP 503"


def test_mineru_unreachable_reports_chinese_reason():
    """mineru 容器未启动（WSL 不可达）→ reachable=false + 中文原因（提示编排脚本）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    result = monitor.probe_mineru(client=_mock_client(handler))
    assert result["reachable"] is False
    assert "mineru" in result["reason"]
    assert "docker" in result["reason"]


def _client(monkeypatch):
    from qed_engine.api import control as api_control
    from qed_engine.services.llm import call_log as llm_call_log

    monkeypatch.setenv("QED_MODEL", "qwen-plus")
    # 隔离 create_app() 启动自检（真实 .env 密钥/数据库不可控，同 test_api.py 模式）：
    # 探测与建表全 mock，避免真实网络请求与真实 CREATE TABLE 副作用
    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: (True, ""))
    monkeypatch.setattr(llm_call_log, "ensure_table", lambda settings: None)
    return TestClient(create_app())


def test_monitor_gpu_endpoint(monkeypatch):
    """GET /monitor/gpu：返回响应形状（含 sys_memory_* 契约字段）。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control,
        "probe_gpu",
        lambda **kwargs: {"available": True, "name": "RTX 4080", "memory_total_mb": 16376,
                          "memory_used_mb": 4096, "utilization_percent": 65, "processes": [],
                          "sys_memory_total_mb": 32768, "sys_memory_used_mb": 15360, "sys_memory_percent": 45},
    )
    client = _client(monkeypatch)
    response = client.get("/api/v1/monitor/gpu")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "RTX 4080"
    assert body["utilization_percent"] == 65
    assert body["sys_memory_percent"] == 45


def test_monitor_lmstudio_endpoint(monkeypatch):
    """GET /monitor/lmstudio：reachable + models。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control,
        "probe_lmstudio",
        lambda settings: {"reachable": True, "base_url": "http://127.0.0.1:5001/v1",
                          "models": ["qwen3-8b"], "reason": ""},
    )
    client = _client(monkeypatch)
    response = client.get("/api/v1/monitor/lmstudio")
    assert response.status_code == 200
    assert response.json()["models"] == ["qwen3-8b"]


def test_monitor_mineru_endpoint(monkeypatch):
    """GET /monitor/mineru：reachable=false 也 200（前端降级显示）。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control,
        "probe_mineru",
        lambda: {"reachable": False, "port": 8002, "reason": "mineru docker 容器未启动（请运行容器编排脚本启动）"},
    )
    client = _client(monkeypatch)
    response = client.get("/api/v1/monitor/mineru")
    assert response.status_code == 200
    assert response.json()["reachable"] is False


def test_probe_memory_windows_ok(monkeypatch):
    """系统内存探测（Windows GlobalMemoryStatusEx）：字段齐全。"""
    import ctypes
    import sys

    monkeypatch.setattr(sys, "platform", "win32")

    class FakeStat:
        dwLength = 64
        dwMemoryLoad = 45
        ullTotalPhys = 32 * 1024**3
        ullAvailPhys = 17 * 1024**3
        ullTotalPageFile = 0
        ullAvailPageFile = 0
        ullTotalVirtual = 0
        ullAvailVirtual = 0
        ullAvailExtendedVirtual = 0

    fake = FakeStat()

    def fake_global_memory_status_ex(ptr):
        ptr.contents.dwMemoryLoad = fake.dwMemoryLoad
        ptr.contents.ullTotalPhys = fake.ullTotalPhys
        ptr.contents.ullAvailPhys = fake.ullAvailPhys
        return True

    monkeypatch.setattr(ctypes.windll.kernel32, "GlobalMemoryStatusEx", fake_global_memory_status_ex)
    result = monitor.probe_memory()
    assert result["available"] is True
    assert result["total_mb"] == 32768
    assert result["used_mb"] == 15360
    assert result["percent"] == 45


def test_probe_memory_non_windows_reports_reason(monkeypatch):
    """非 Windows 平台：available=false + 中文原因（不抛异常）。"""
    import sys

    monkeypatch.setattr(sys, "platform", "linux")
    result = monitor.probe_memory()
    assert result["available"] is False


def test_probe_gpu_attaches_memory_when_provided():
    """probe_gpu(memory_fn=...) 时响应附带 sys_memory_* 字段（端点注入）。"""
    runner = _fake_smi("NVIDIA GeForce RTX 4080, 16376, 4096, 65")
    result = monitor.probe_gpu(runner=runner, memory_fn=lambda: {"available": True, "total_mb": 32768, "used_mb": 15360, "percent": 45})
    assert result["sys_memory_total_mb"] == 32768
    assert result["sys_memory_used_mb"] == 15360
    assert result["sys_memory_percent"] == 45
