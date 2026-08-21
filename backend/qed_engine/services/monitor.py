"""组件监控探测能力（控制域监控诊断）：GPU（nvidia-smi）、LM Studio（OpenAI 兼容）、mineru。

探测均为「尽力报告」：任何失败返回 available/reachable=false + 中文原因，不抛 5xx；
nvidia-smi 命令执行（runner）与 httpx transport 可注入（测试）。

设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_monitor.py
"""

import subprocess
import sys
from collections.abc import Callable

import httpx

from qed_engine.config import Settings

GPU_QUERY = "name,memory.total,memory.used,utilization.gpu"
PROC_QUERY = "pid,process_name,used_memory"
MINERU_URL = "http://127.0.0.1:8002"
MINERU_HEALTH_PATH = "/health"
PROBE_TIMEOUT = 5.0

Runner = Callable[[list[str]], str]


def _run_smi(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, timeout=10)
    if result.returncode != 0:
        raise OSError(f"nvidia-smi 退出码 {result.returncode}")
    return result.stdout.decode("utf-8", errors="replace")


def probe_memory() -> dict:
    """系统内存（Windows GlobalMemoryStatusEx；非 Windows 尽力报告失败原因）。"""
    if sys.platform != "win32":
        return {"available": False, "reason": "系统内存探测仅支持 Windows（本机部署平台）"}
    try:
        import ctypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.pointer(stat)):
            return {"available": False, "reason": "GlobalMemoryStatusEx 失败"}
        total_mb = stat.ullTotalPhys // (1024 * 1024)
        used_mb = (stat.ullTotalPhys - stat.ullAvailPhys) // (1024 * 1024)
        return {"available": True, "total_mb": total_mb, "used_mb": used_mb, "percent": stat.dwMemoryLoad}
    except Exception as exc:
        return {"available": False, "reason": f"内存探测失败：{type(exc).__name__}"}


def probe_gpu(runner: Runner | None = None, memory_fn: Callable[[], dict] | None = None) -> dict:
    """nvidia-smi 解析：available=false 附中文原因（不存在/无 GPU/解析失败）。"""
    runner = runner or _run_smi
    try:
        gpu_out = runner(["nvidia-smi", "--query-gpu=" + GPU_QUERY, "--format=csv,noheader,nounits"])
        proc_out = runner(["nvidia-smi", "--query-compute-apps=" + PROC_QUERY, "--format=csv,noheader,nounits"])
    except FileNotFoundError:
        return {"available": False, "reason": "nvidia-smi 不存在（未安装 NVIDIA 驱动）"}
    except OSError as exc:
        return {"available": False, "reason": f"nvidia-smi 执行失败：{type(exc).__name__}"}
    except subprocess.TimeoutExpired:
        return {"available": False, "reason": "nvidia-smi 执行超时"}
    if not gpu_out.strip():
        return {"available": False, "reason": "无 GPU 或驱动不可用"}
    try:
        first = gpu_out.strip().splitlines()[0]
        parts = [part.strip() for part in first.split(",")]
        name = parts[0]
        total_mb = int(float(parts[1]))
        used_mb = int(float(parts[2]))
        utilization = int(float(parts[3]))
        processes = []
        for line in proc_out.strip().splitlines():
            if not line.strip():
                continue
            cells = [cell.strip() for cell in line.split(",")]
            if len(cells) < 3:
                continue
            pid, pname, mem = cells[0], cells[1], cells[2]
            # Windows WDDM 模式下 used_memory 常为 [N/A]，跳过无效行
            if mem in ("[N/A]", "[Insufficient Permissions]", ""):
                continue
            processes.append({"pid": int(pid), "name": pname, "memory_mb": int(float(mem))})
    except (ValueError, IndexError):
        return {"available": False, "reason": "nvidia-smi 输出解析失败"}
    result = {
        "available": True,
        "name": name,
        "memory_total_mb": total_mb,
        "memory_used_mb": used_mb,
        "utilization_percent": utilization,
        "processes": processes,
    }
    if memory_fn is not None:
        mem = memory_fn()
        result.update(
            sys_memory_total_mb=mem.get("total_mb", 0),
            sys_memory_used_mb=mem.get("used_mb", 0),
            sys_memory_percent=mem.get("percent", 0),
        )
    return result


def probe_lmstudio(settings: Settings, client: httpx.Client | None = None) -> dict:
    """LM Studio（OpenAI 兼容）探测：/v1/models + 已加载模型列表（5s 超时）。"""
    base = settings.qed_lmstudio_url.rstrip("/")
    try:
        own = client is None
        http = client or httpx.Client(timeout=PROBE_TIMEOUT)
        try:
            response = http.get(f"{base}/models")
        finally:
            if own:
                http.close()
        if response.status_code != 200:
            return {"reachable": False, "base_url": base, "models": [], "reason": f"HTTP {response.status_code}"}
        data = response.json()
        models = [item.get("id", "") for item in data.get("data", []) if isinstance(item, dict)]
        return {"reachable": True, "base_url": base, "models": models, "reason": ""}
    except httpx.TimeoutException:
        return {"reachable": False, "base_url": base, "models": [], "reason": "超时"}
    except httpx.HTTPError as exc:
        return {"reachable": False, "base_url": base, "models": [], "reason": type(exc).__name__}


def probe_mineru(client: httpx.Client | None = None) -> dict:
    """mineru 解析服务（8002，WSL 容器）健康探测。

    容器未启动/WSL 不可达 → reachable=false + 中文原因（提示运行容器编排脚本），
    不泄漏堆栈。健康端点按 mineru 实际实现校准（默认沿 /api/v1/health 模式）。
    """
    try:
        own = client is None
        http = client or httpx.Client(timeout=PROBE_TIMEOUT)
        try:
            response = http.get(f"{MINERU_URL}{MINERU_HEALTH_PATH}")
        finally:
            if own:
                http.close()
        if response.status_code == 200:
            return {"reachable": True, "port": 8002, "reason": ""}
        return {"reachable": False, "port": 8002, "reason": f"HTTP {response.status_code}"}
    except httpx.TimeoutException:
        return {"reachable": False, "port": 8002, "reason": "超时"}
    except httpx.HTTPError:
        return {"reachable": False, "port": 8002, "reason": "mineru docker 容器未启动（请运行容器编排脚本启动）"}
