"""
模块职责：组件监控探测（monitor）契约测试：GPU/Qwen/mineru 各分支与响应形状。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
被测代码：backend/qed_engine/services/monitor.py
"""

import subprocess
import threading
import time

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
    # PDH 缺省 probe_pdh() 在本测试环境返回空映射 + None 利用率 → 利用率回落 nvidia-smi，source=nvidia-smi
    assert result == {
        "available": True,
        "name": "NVIDIA GeForce RTX 4080",
        "memory_total_mb": 16376,
        "memory_used_mb": 4096,
        "utilization_percent": 65,
        "utilization_source": "nvidia-smi",
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


def _qwen_settings():
    return Settings(_env_file=None)


def _mock_client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_qwen_ok_returns_models():
    """Qwen 可达：/v1/models 返回已加载模型列表。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/models"
        return httpx.Response(200, json={"data": [{"id": "qwen3-8b"}, {"id": "qwen3-27b"}]})

    result = monitor.probe_qwen(_qwen_settings(), client=_mock_client(handler))
    assert result == {
        "reachable": True,
        "base_url": "http://127.0.0.1:5001/v1",
        "models": ["qwen3-8b", "qwen3-27b"],
        "reason": "",
    }


def test_qwen_http_error_reports_reason():
    """Qwen 返回非 200 → reachable=false + HTTP 状态码。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={})

    result = monitor.probe_qwen(_qwen_settings(), client=_mock_client(handler))
    assert result["reachable"] is False
    assert result["reason"] == "HTTP 500"


def test_qwen_connect_error_reports_reason():
    """Qwen 未启动（连接失败）→ reachable=false + 异常类名。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    result = monitor.probe_qwen(_qwen_settings(), client=_mock_client(handler))
    assert result["reachable"] is False
    assert result["reason"] == "ConnectError"
    assert result["models"] == []


def test_qwen_token_header_passthrough():
    """LM Studio API 认证（W7 实测）：token 非空时 GET 带 Authorization；空时不带。"""
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("Authorization"))
        return httpx.Response(200, json={"data": []})

    result = monitor.probe_qwen(_qwen_settings(), client=_mock_client(handler), token="lm-secret")
    assert result["reachable"] is True
    assert seen == ["Bearer lm-secret"]
    seen.clear()
    monitor.probe_qwen(_qwen_settings(), client=_mock_client(handler))
    assert seen == [None]


def test_slot_text_lmstudio_passes_token():
    """probe_slot(text, lmstudio)：把 QED_LMSTUDIO_TOKEN 透传给探针请求。"""
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("Authorization"))
        return httpx.Response(200, json={"data": [{"id": "qwen3.8-27b", "state": "loaded"}]})

    settings = Settings(_env_file=None, qed_local_runtime="lmstudio",
                        qed_lmstudio_token="lm-secret")
    result = monitor.probe_slot(settings, "text", client=_mock_client(handler))
    assert result["reachable"] is True
    assert result["runtime"] == "lmstudio"
    assert seen == ["Bearer lm-secret"]


def test_qwen_url_override():
    """QED_MODEL_URL 覆盖探测目标。"""
    settings = Settings(_env_file=None, qed_model_url="http://127.0.0.1:9999/v1")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/models"
        return httpx.Response(200, json={"data": []})

    result = monitor.probe_qwen(settings, client=_mock_client(handler))
    assert result["base_url"] == "http://127.0.0.1:9999/v1"


def test_mineru_ok():
    """mineru 5002 健康端点 200 → reachable=True。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/health"
        return httpx.Response(200, json={"status": "ok"})

    result = monitor.probe_mineru(client=_mock_client(handler))
    assert result == {"reachable": True, "port": 5002, "reason": ""}


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


def test_local_probes_self_built_client_disables_env_proxy(monkeypatch):
    """回归（2026-09-23 监督器 down 抖动）：未注入 client 自建时必须 trust_env=False。

    本机注册表代理经环境变量劫持 127.0.0.1 探测产生假 502/超时，监督器据此误判掉线。
    """
    captured = []

    class _StubClient:
        def __init__(self, **kwargs):
            captured.append(kwargs)

        def get(self, url, headers=None):
            return httpx.Response(200, json={"data": []})

        def close(self):
            pass

    monkeypatch.setattr(monitor.httpx, "Client", _StubClient)
    assert monitor.probe_qwen(_qwen_settings())["reachable"] is True
    assert monitor.probe_mineru()["reachable"] is True
    assert len(captured) == 2
    assert all(k.get("trust_env") is False for k in captured)


def _client(monkeypatch):
    from qed_engine.api import control as api_control
    from qed_engine.services.llm import call_log as llm_call_log

    monkeypatch.setenv("QED_MODEL", "qwen-plus")
    # 监督器关闭：不建常驻探测线程（隔离铁律；逻辑由 test_llm_supervisor.py 覆盖）
    monkeypatch.setenv("QED_MODEL_SUPERVISOR", "false")
    # 隔离 create_app() 启动自检（真实 .env 密钥/数据库不可控，同 test_api.py 模式）：
    # 探测与建表全 mock，避免真实网络请求与真实 CREATE TABLE 副作用
    monkeypatch.setattr(api_control, "_probe_llm", lambda provider, key, url: (True, ""))
    monkeypatch.setattr(api_control, "_probe_mysql", lambda settings: (True, ""))
    monkeypatch.setattr(llm_call_log, "ensure_table", lambda settings: None)
    return TestClient(create_app())


def test_monitor_gpu_endpoint(monkeypatch):
    """GET /monitor/gpu：返回响应形状（含 sys_memory_* 与 utilization_source 契约字段）。"""
    from qed_engine.api import control

    monkeypatch.setattr(control, "_gpu_probe_cache", None)
    monkeypatch.setattr(
        control,
        "probe_gpu",
        lambda **kwargs: {"available": True, "name": "RTX 4080", "memory_total_mb": 16376,
                          "memory_used_mb": 4096, "utilization_percent": 65, "utilization_source": "nvidia-smi",
                          "processes": [],
                          "sys_memory_total_mb": 32768, "sys_memory_used_mb": 15360, "sys_memory_percent": 45},
    )
    client = _client(monkeypatch)
    response = client.get("/api/v1/monitor/gpu")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "RTX 4080"
    assert body["utilization_percent"] == 65
    assert body["utilization_source"] == "nvidia-smi"
    assert body["sys_memory_percent"] == 45


def test_monitor_gpu_endpoint_cache_single_probe(monkeypatch):
    """REQ-033 性能：TTL 窗口内多客户端轮询只触发一次真实探针（合流）。"""
    from qed_engine.api import control

    calls = []
    def fake_probe(**kwargs):
        calls.append(1)
        return {"available": True, "name": "X", "memory_total_mb": 1, "memory_used_mb": 1,
                "utilization_percent": 1, "processes": [], "sys_memory_total_mb": 1,
                "sys_memory_used_mb": 1, "sys_memory_percent": 1}
    monkeypatch.setattr(control, "_gpu_probe_cache", None)
    monkeypatch.setattr(control, "probe_gpu", fake_probe)
    client = _client(monkeypatch)
    assert client.get("/api/v1/monitor/gpu").json()["name"] == "X"
    assert client.get("/api/v1/monitor/gpu").json()["name"] == "X"
    assert len(calls) == 1


def _gpu_payload(tag: str) -> dict:
    return {"available": True, "name": tag, "memory_total_mb": 1, "memory_used_mb": 1,
            "utilization_percent": 1, "processes": [], "sys_memory_total_mb": 1,
            "sys_memory_used_mb": 1, "sys_memory_percent": 1}


def _wait_refresh_idle(control, timeout: float = 5.0) -> None:
    """等待后台单飞刷新线程收尾（SWR 语义测试的确定性锚点）。"""
    deadline = time.monotonic() + timeout
    while control._gpu_probe_refreshing:
        if time.monotonic() > deadline:
            raise AssertionError("后台 GPU 刷新线程未在超时内收尾")
        time.sleep(0.01)


def test_monitor_gpu_endpoint_cache_expiry_stale_then_refresh(monkeypatch):
    """REQ-033 性能 SWR：TTL 过期即回旧值（用户不为 PDH ≈2.4s 采样下限买单），
    后台单飞重采完成后，下一次请求拿到新值。"""
    from qed_engine.api import control

    calls = []
    def fake_probe(**kwargs):
        calls.append(1)
        return _gpu_payload(f"X{len(calls)}")
    monkeypatch.setattr(control, "_gpu_probe_refreshing", False)
    monkeypatch.setattr(control, "_gpu_probe_cache", (time.monotonic() - 999, _gpu_payload("X0")))
    monkeypatch.setattr(control, "GPU_PROBE_CACHE_TTL_S", 0.0)
    monkeypatch.setattr(control, "probe_gpu", fake_probe)
    client = _client(monkeypatch)
    assert client.get("/api/v1/monitor/gpu").json()["name"] == "X0"
    _wait_refresh_idle(control)
    assert len(calls) == 1
    assert client.get("/api/v1/monitor/gpu").json()["name"] == "X1"


def test_monitor_gpu_endpoint_cache_single_refresh_in_flight(monkeypatch):
    """REQ-033 性能：过期窗口内并发轮询只派生一个后台刷新（单飞合流），其余直接回旧值。"""
    from qed_engine.api import control

    calls = []
    gate = threading.Event()
    started = threading.Event()
    def fake_probe(**kwargs):
        calls.append(1)
        started.set()
        gate.wait(5)
        return _gpu_payload(f"X{len(calls)}")
    monkeypatch.setattr(control, "_gpu_probe_refreshing", False)
    monkeypatch.setattr(control, "_gpu_probe_cache", (time.monotonic() - 999, _gpu_payload("X0")))
    monkeypatch.setattr(control, "GPU_PROBE_CACHE_TTL_S", 0.0)
    monkeypatch.setattr(control, "probe_gpu", fake_probe)
    client = _client(monkeypatch)
    assert client.get("/api/v1/monitor/gpu").json()["name"] == "X0"
    assert started.wait(5)
    # 刷新在飞期间第二个请求：不等探针，直接回旧值，且不再派生线程
    assert client.get("/api/v1/monitor/gpu").json()["name"] == "X0"
    assert len(calls) == 1
    gate.set()
    _wait_refresh_idle(control)
    assert len(calls) == 1


def test_monitor_qwen_endpoint(monkeypatch):
    """GET /monitor/qwen：reachable + models。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control,
        "probe_qwen",
        lambda settings: {"reachable": True, "base_url": "http://127.0.0.1:5001/v1",
                          "models": ["qwen3-8b"], "reason": ""},
    )
    client = _client(monkeypatch)
    response = client.get("/api/v1/monitor/qwen")
    assert response.status_code == 200
    assert response.json()["models"] == ["qwen3-8b"]


def test_monitor_mineru_endpoint(monkeypatch):
    """GET /monitor/mineru：reachable=false 也 200（前端降级显示）。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control,
        "probe_mineru",
        lambda: {"reachable": False, "port": 5002, "reason": "mineru docker 容器未启动（请运行容器编排脚本启动）"},
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


# --- Task 1: Windows PDH 计数器（逐进程专用显存 + 利用率）---

def _fake_pdh(out: str):
    """模拟 PDH 合并探测 runner：单次 Get-Counter 调用返回打标输出。"""
    def runner(cmd, **kwargs):
        joined = " ".join(cmd)
        assert "GPU Process Memory" in joined and "GPU Engine" in joined, joined
        return out
    return runner


def test_pdh_process_memory_parses_and_aggregates():
    """\GPU Process Memory Dedicated Usage：按 pid 聚合（同 pid 多 luid/phys 取最大，CookedValue 字节转 MB）。"""
    # CookedValue 为字节（PERF_COUNTER_LARGE_RAWCOUNT），函数内转为 MB（÷1048576）
    # 使用能被 1048576 整除的字节值以避免浮点误差：316.5 MB=331874304, 1580.5 MB=1657274368
    out = (
        "pid_10396_luid_0x00000000_0x00010c6e_phys_0: 331874304\n"
        "pid_29052_luid_0x00000000_0x00010c6e_phys_0: 1657274368\n"
        "pid_10396_luid_0x00000000_0x00012c22_phys_0: 0\n"
    )
    got = monitor.parse_pdh_process_memory(out)
    assert got == {10396: 316.5, 29052: 1580.5}


def test_pdh_utilization_takes_max_nonzero():
    """\GPU Engine Utilization Percentage：取非零 sample 最大值。

    行格式为 PowerShell 实例名真实形状（pid_.._eng_N_engtype_X: 值）；
    旧实现按「luid=.. util=」假想格式解析，真机永不命中（REQ-033 性能轮顺带修正）。
    """
    out = (
        "pid_12084_luid_0x00000000_0x00012bb5_phys_0_eng_9_engtype_3d: 0\n"
        "pid_29052_luid_0x00000000_0x00010c6e_phys_0_eng_0_engtype_3d: 0.2\n"
    )
    got = monitor.parse_pdh_utilization(out)
    assert got == 0.2


def test_split_pdh_streams():
    """合并输出按 MEM|/UTIL| 前缀拆为两路流（REQ-033：单次 Get-Counter 双计数器）。"""
    out = (
        "MEM|pid_1_luid_0x0_phys_0|524288000.0\n"
        "UTIL|pid_1_luid_0x0_phys_0_eng_0_engtype_3d|12.0\n"
        "MEM|pid_2_luid_0x0_phys_0|1048576\n"
    )
    mem, util = monitor.split_pdh_streams(out)
    assert monitor.parse_pdh_process_memory(mem) == {1: 500.0, 2: 1.0}
    assert monitor.parse_pdh_utilization(util) == 12.0


def test_probe_pdh_runner_injected():
    """probe_pdh 注入 runner：单次调用解析 mem/util 两路（CookedValue 字节转 MB）。"""
    calls = []
    def runner(cmd, **kwargs):
        calls.append(cmd)
        return (
            "MEM|pid_1_luid_0x00000000_0x00010c6e_phys_0|524288000.0\n"
            "UTIL|pid_1_luid_0x00000000_0x00010c6e_phys_0_eng_0_engtype_3d|12.0\n"
        )
    assert monitor.probe_pdh(runner=runner) == {"processes_mb": {1: 500.0}, "utilization_percent": 12.0}
    assert len(calls) == 1, "PDH 必须合并为单次 PowerShell 调用（REQ-033）"


def test_probe_pdh_runner_error_degrades():
    """PDH 探测执行超时：尽力降级（空显存映射 + None 利用率），不抛 5xx。"""
    def runner(cmd, **kwargs):
        raise subprocess.TimeoutExpired(cmd, timeout=15)
    assert monitor.probe_pdh(runner=runner) == {"processes_mb": {}, "utilization_percent": None}


def test_probe_pdh_powershell_missing():
    """PowerShell 不存在（FileNotFoundError）：降级为空映射 + None 利用率。"""
    def runner(cmd, **kwargs):
        raise FileNotFoundError
    assert monitor.probe_pdh(runner=runner) == {"processes_mb": {}, "utilization_percent": None}


# --- Task 2: probe_gpu 集成 PDH（进程显存 PDH 值 + 利用率 PDH/利用率来源）---

def test_probe_gpu_integrates_pdh_memory_and_utilization():
    """probe_gpu 集成 PDH：进程 memory_mb 用 PDH（按 pid 匹配），利用率用 PDH，附 utilization_source。

    WDDM 下 nvidia-smi 逐进程显存为 [N/A]；PDH 分配口径补真实值。利用率切 PDH（任务管理器同源）。
    """
    runner = _fake_smi(
        "NVIDIA GeForce RTX 4080, 16376, 2705, 8",
        "1234, C:\\Program Files\\LM Studio\\LM Studio.exe, [N/A]\n"
        "29052, [Insufficient Permissions], [N/A]",
    )
    def pdh(**kw):
        return {"processes_mb": {1234: 207.5, 29052: 1580.5}, "utilization_percent": 0.4}
    result = monitor.probe_gpu(runner=runner, pdh_fn=pdh)
    assert result["utilization_percent"] == 0.4
    assert result["utilization_source"] == "pdh"
    by_pid = {p["pid"]: p for p in result["processes"]}
    assert by_pid[1234]["memory_mb"] == 207.5
    assert by_pid[29052]["memory_mb"] == 1580.5
    # [Insufficient Permissions] 名补全由 Task 3 处理；此处名称原样保留
    assert by_pid[29052]["name"] == "[Insufficient Permissions]"


def test_probe_gpu_pdh_unavailable_falls_back_to_smi():
    """PDH 探测不可用（空映射 + None 利用率）：利用率回落 nvidia-smi 值，source=nvidia-smi。

    进程 memory_mb 无法从 PDH 取（空映射）→ 回落 None（WDDM [N/A] 语义）。
    """
    runner = _fake_smi(
        "NVIDIA GeForce RTX 4080, 16376, 2705, 8",
        "1234, LM Studio, [N/A]",
    )
    def pdh(**kw):
        return {"processes_mb": {}, "utilization_percent": None}
    result = monitor.probe_gpu(runner=runner, pdh_fn=pdh)
    assert result["utilization_percent"] == 8
    assert result["utilization_source"] == "nvidia-smi"
    assert result["processes"][0]["memory_mb"] is None


# --- Task 3: 进程名补全（[Insufficient Permissions] → 真实名）---

def test_resolve_process_name_uses_tasklist():
    """按 pid 经 tasklist CSV 取真实进程名（WDDM 下 nvidia-smi 显示 [Insufficient Permissions]）。"""
    tasklist_csv = (
        '"Image Name","PID","Session Name","Session#","Mem Usage"\n'
        '"LM Studio.exe","29052","Console","1","1,580,500 K"\n'
    )
    def runner(cmd, **kwargs):
        if "tasklist" in " ".join(cmd).lower():
            return tasklist_csv
        raise AssertionError(" ".join(cmd))
    assert monitor.resolve_process_name(29052, runner=runner) == "LM Studio.exe"


def test_resolve_process_name_not_found_returns_none():
    """tasklist 无该 pid：返回 None。"""
    def runner(cmd, **kwargs):
        return '"Image Name","PID","Session Name","Session#","Mem Usage"\n'
    assert monitor.resolve_process_name(99999, runner=runner) is None


def test_resolve_process_name_runner_error_returns_none():
    """tasklist 执行失败（OSError）：返回 None（不抛异常）。"""
    def runner(cmd, **kwargs):
        raise OSError("boom")
    assert monitor.resolve_process_name(1234, runner=runner) is None


def test_probe_gpu_resolves_insufficient_permissions_name():
    """probe_gpu 对 [Insufficient Permissions] 行按 pid 补全真实名（Task 3 集成）。"""
    runner = _fake_smi(
        "NVIDIA GeForce RTX 4080, 16376, 2705, 8",
        "29052, [Insufficient Permissions], [N/A]",
    )
    def name_runner(pid):
        return "LM Studio.exe" if pid == 29052 else None
    def pdh(**kw):
        return {"processes_mb": {29052: 1580.5}, "utilization_percent": 0.4}
    result = monitor.probe_gpu(runner=runner, pdh_fn=pdh, tasklist_fn=name_runner)
    assert result["processes"][0]["name"] == "LM Studio.exe"


# --- DEFECT-018：子进程输出容错解码（真机两栈＝解码异常逃逸 / stdout=None 崩溃）---

class _CompletedLike:
    """subprocess.CompletedProcess 替身：只暴露 returncode / stdout。"""

    def __init__(self, stdout, returncode=0):
        self.stdout = stdout
        self.returncode = returncode


def test_run_pdh_default_runner_decodes_non_utf8_bytes(monkeypatch):
    """PDH 默认 runner 字节捕获后容错解码：GBK 中文计数器名不得抛 UnicodeDecodeError。"""
    captured = {}

    def fake_run(cmd, **kwargs):
        captured.update(kwargs)
        return _CompletedLike("MEM|pid_1_图像扩展|524288000.0".encode("gbk"))

    monkeypatch.setattr(monitor.subprocess, "run", fake_run)
    out = monitor._run_pdh()
    assert isinstance(out, str) and "MEM|" in out and "524288000.0" in out
    assert captured.get("text") is not True and "encoding" not in captured, \
        "DEFECT-018：PDH runner 回到 text=True 文本模式即重犯"


def test_run_pdh_default_runner_none_stdout_degrades(monkeypatch):
    """PDH 默认 runner 取到空 stdout（None）时降级为空串，不抛异常。"""
    monkeypatch.setattr(monitor.subprocess, "run", lambda cmd, **kw: _CompletedLike(None))
    assert monitor._run_pdh() == ""


def test_resolve_process_name_default_runner_decodes_non_utf8_bytes(monkeypatch):
    """tasklist 默认 runner 容错解码：GBK 输出下仍按 pid 取到真实进程名。"""
    captured = {}

    def fake_run(cmd, **kwargs):
        captured.update(kwargs)
        return _CompletedLike('"python.exe","1234","Console","1","1,234 K"'.encode("gbk"))

    monkeypatch.setattr(monitor.subprocess, "run", fake_run)
    assert monitor.resolve_process_name(1234) == "python.exe"
    assert captured.get("text") is not True and "encoding" not in captured, \
        "DEFECT-018：tasklist runner 回到 text=True 文本模式即重犯"


def test_resolve_process_name_none_stdout_returns_none(monkeypatch):
    """stdout 为 None（原崩溃点＝无判空的 .splitlines()）时按未找到降级。"""
    monkeypatch.setattr(monitor.subprocess, "run", lambda cmd, **kw: _CompletedLike(None))
    assert monitor.resolve_process_name(1234) is None


def test_resolve_process_name_decode_error_returns_none(monkeypatch):
    """解码类异常（UnicodeDecodeError 属 ValueError）不得逃逸出探针。"""
    def fake_run(cmd, **kwargs):
        raise UnicodeDecodeError("utf-8", b"\xd0", 0, 1, "invalid continuation byte")

    monkeypatch.setattr(monitor.subprocess, "run", fake_run)
    assert monitor.resolve_process_name(1234) is None


def test_probe_gpu_pdh_gbk_output_does_not_escape(monkeypatch):
    """probe_gpu 集成面：PDH 中文输出不得使整卡探针抛异常（原象＝沿用旧缓存）。"""
    def fake_run(cmd, **kwargs):
        if "nvidia-smi" in cmd[0]:
            line = "NVIDIA GeForce RTX 4080, 16376, 2705, 8" if "--query-gpu=" in cmd[1] else ""
            return _CompletedLike(line.encode("utf-8"))
        return _CompletedLike("MEM|pid_1_图像扩展|524288000.0".encode("gbk"))

    monkeypatch.setattr(monitor.subprocess, "run", fake_run)
    result = monitor.probe_gpu()
    assert result["available"] is True
    assert result["utilization_source"] in ("pdh", "nvidia-smi")


def test_probe_gpu_tasklist_none_stdout_keeps_raw_name(monkeypatch):
    """逐进程名补全失败（stdout=None）时保留 nvidia-smi 原值，清单不整体崩溃。"""
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(cmd[0])
        if cmd[0] == "nvidia-smi":
            line = "" if "--query-gpu=" in cmd[1] else "29052, [Insufficient Permissions], [N/A]"
            if "--query-gpu=" in cmd[1]:
                line = "NVIDIA GeForce RTX 4080, 16376, 2705, 8"
            return _CompletedLike(line.encode("utf-8"))
        return _CompletedLike(None)

    monkeypatch.setattr(monitor.subprocess, "run", fake_run)
    result = monitor.probe_gpu(pdh_fn=lambda: {"processes_mb": {}, "utilization_percent": None})
    assert result["available"] is True
    assert [proc["pid"] for proc in result["processes"]] == [29052]
    assert result["processes"][0]["name"] == "[Insufficient Permissions]"
    assert "tasklist" in calls
