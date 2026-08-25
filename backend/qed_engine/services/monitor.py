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

# 模型进程名关键词白名单（REQ-038 GPU 饼图分类口径，2026-08-21 用户裁决）：
# 进程名小写包含任一关键词 → kind="model"，否则 "other"（前端饼图高亮非模型占用）。
# 覆盖：LM Studio（GUI 名含空格）、llama-server、qwen 推理、MinerU（WSL vmmem）、
# python 通用推理/训练进程、ollama；后续发现漏网之鱼在此追加。
MODEL_PROCESS_PATTERNS = (
    "lm studio",
    "lmstudio",
    "llama",
    "qwen",
    "mineru",
    "python",
    "vmmem",
    "ollama",
)

Runner = Callable[[list[str]], str]

# 利用率读数说明（2026-08-23 用户裁决）：WDDM 模式下 nvidia-smi 的 utilization.gpu
# 存在固有失真（低值与顶格 100% 间二值化跳变，实测对照性能计数器确认），但**超显存
# 判断不依赖它**——95% 警告以显存使用率（memory.used / memory.total，nvidia-smi 实测
# 准确）为准；利用率仅作参考展示，前端标注「仅供参考」。


def classify_process(name: str) -> str:
    """进程名 → kind：命中模型关键词白名单为 model，其余 other（大小写不敏感）。"""
    lowered = name.lower()
    return "model" if any(pattern in lowered for pattern in MODEL_PROCESS_PATTERNS) else "other"


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
            try:
                pid_num = int(pid)
            except ValueError:
                continue
            # Windows WDDM 模式下 used_memory 常为 [N/A]/[Insufficient Permissions]：
            # 显存数值拿不到，但进程清单与名称可得——保留行（memory_mb=None）供
            # 「非模型任务」清单识别（REQ-038 用户核心诉求），不参与前端 MB 聚合
            if mem in ("[N/A]", "[Insufficient Permissions]", ""):
                processes.append(
                    {"pid": pid_num, "name": pname, "memory_mb": None, "kind": classify_process(pname)}
                )
                continue
            processes.append(
                {"pid": pid_num, "name": pname, "memory_mb": int(float(mem)), "kind": classify_process(pname)}
            )
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
