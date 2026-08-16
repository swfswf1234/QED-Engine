"""
模块职责：组件监控探测（monitor）契约测试：GPU/LM Studio/mineru 各分支与响应形状。
设计关联（DesignRef）：docs/design/config-center-api.md
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
    """nvidia-smi 正常输出：字段齐全（型号/显存/利用率/进程）。"""
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
        "processes": [{"pid": 1234, "name": "LM Studio", "memory_mb": 4096}],
    }


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
        "base_url": "http://127.0.0.1:1234/v1",
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
        assert request.url.path == "/api/v1/health"
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
    monkeypatch.setenv("QED_MODEL", "qwen-plus")
    return TestClient(create_app())


def test_monitor_gpu_endpoint(monkeypatch):
    """GET /monitor/gpu：返回响应形状。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control,
        "probe_gpu",
        lambda: {"available": True, "name": "RTX 4080", "memory_total_mb": 16376,
                 "memory_used_mb": 4096, "utilization_percent": 65, "processes": []},
    )
    client = _client(monkeypatch)
    response = client.get("/api/v1/monitor/gpu")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "RTX 4080"
    assert body["utilization_percent"] == 65


def test_monitor_lmstudio_endpoint(monkeypatch):
    """GET /monitor/lmstudio：reachable + models。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control,
        "probe_lmstudio",
        lambda settings: {"reachable": True, "base_url": "http://127.0.0.1:1234/v1",
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
