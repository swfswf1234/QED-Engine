"""组件监控探测能力（控制域监控诊断）：GPU（nvidia-smi）、Qwen（OpenAI 兼容）、mineru。

探测均为「尽力报告」：任何失败返回 available/reachable=false + 中文原因，不抛 5xx；
nvidia-smi 命令执行（runner）与 httpx transport 可注入（测试）。

设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_monitor.py
"""

import re
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


# --- Windows PDH 计数器（Task 1，2026-09-06）---
# 背景：WDDM 模式下 nvidia-smi 逐进程显存全为 [N/A]（驱动限制），导致控制台「占比未知」。
# 改用 Windows 性能计数器（任务管理器同源）：\\GPU Process Memory(*)\\Dedicated Usage 取逐进程
# 专用显存（分配口径），\\GPU Engine(*)\\Utilization Percentage 取真实利用率（WDDM 失真替代）。
# 本机实测（2026-08-21）：nvidia-smi utilization=8% 失真，GPU Engine 空闲 ≈0.2%；Dedicated Usage
# 按 pid 给显存（如 LM Studio 后端 pid=1580MB）。两口径（物理驻留 vs 分配）说明见计划文档。
PDH_MEM_PATH = r"\GPU Process Memory(*)\Dedicated Usage"
PDH_UTIL_PATH = r"\GPU Engine(*)\Utilization Percentage"


def _run_pdh(path: str, runner=None) -> str:
    """subprocess 调 PowerShell Get-Counter（5.1 参数名 -Counter）取计数样例；失败尽力返回 ""。

    runner 注入约定与 _run_smi 一致：返回输出字符串（真实 subprocess.run 内部取 stdout，
    测试直接返回伪字符串）。超时/失败返回空串。
    """
    run = runner or subprocess.run
    try:
        result = run(
            ["powershell", "-NoProfile", "-Command",
             f"$c = Get-Counter -Counter '{path}'; "
             f"$c.CounterSamples | ForEach-Object {{ \"$($_.InstanceName): $([math]::Round($_.CookedValue,1))\" }}"],
            capture_output=True, text=True, timeout=10,
        )
        return result.stdout if isinstance(result, subprocess.CompletedProcess) else result
    except (FileNotFoundError, OSError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        return ""


def parse_pdh_process_memory(out: str) -> dict[int, float]:
    """解析 \\GPU Process Memory Dedicated Usage：按 pid 聚合并取同 pid 各 luid/phys 实例最大值。

    CookedValue 单位为字节（Windows PERF_COUNTER_LARGE_RAWCOUNT），本函数转为 MB 输出。
    输出行形如：`pid_10396_luid_0x00000000_0x00010c6e_phys_0: 331485696.0`（字节，Get-Counter Round 到 1 位）。
    同 pid 可能有多 luid/phys 实例（如 0x00010c6e 主 GPU 上下文中非零、其它上下文为 0）——取最大。
    """
    BYTES_PER_MB = 1024 * 1024
    per_pid: dict[int, float] = {}
    for line in out.splitlines():
        m = re.match(r"\s*pid_(\d+)_luid_.+?_phys_\d+:\s*([\d.]+)", line)
        if not m:
            continue
        pid, raw_bytes = int(m.group(1)), float(m.group(2))
        per_pid[pid] = max(per_pid.get(pid, 0.0), raw_bytes / BYTES_PER_MB)
    return per_pid


def parse_pdh_utilization(out: str) -> float | None:
    """解析 \\GPU Engine Utilization Percentage：取非零 sample 最大值（代表 GPU 总体活动）。

    输出行形如：`luid=pid_29052_luid_0x00000000_0x00010c6e_phys_0_eng_0_engtype_3d util=0.2`。
    引擎分 3d/copy/video 等类型，任务管理器同源口径按物理 GPU 上下文取非零最大值。
    """
    vals: list[float] = []
    for line in out.splitlines():
        m = re.match(r"\s*luid=pid_\d+_luid_.+?_phys_\d+_eng_\d+_engtype_\w+ util=([\d.]+)", line)
        if not m:
            continue
        vals.append(float(m.group(1)))
    return max(vals) if vals else None


def probe_pdh(runner=None) -> dict:
    """Windows PDH：逐进程专用显存（分配口径映射）+ GPU 利用率（任务管理器同源）。

    任一探测失败（PowerShell 缺失/超时/解析为空）尽力降级：processes_mb 为空、utilization None；
    不抛异常，供 probe_gpu 集成时回落 nvidia-smi 口径。
    """
    return {
        "processes_mb": parse_pdh_process_memory(_run_pdh(PDH_MEM_PATH, runner)),
        "utilization_percent": parse_pdh_utilization(_run_pdh(PDH_UTIL_PATH, runner)),
    }


def resolve_process_name(pid: int, runner=None) -> str | None:
    """按 pid 经 tasklist CSV 补全进程真实名（Windows）；失败/未找到返回 None。

    背景（Task 3，2026-09-06）：WDDM 下 nvidia-smi 对系统/受限进程显示 `[Insufficient Permissions]`，
    tasklist 能按 pid 取真实名（如 LM Studio.exe）。runner 可注入（测试）；失败不抛异常。
    """
    run = runner or subprocess.run
    try:
        result = run(["tasklist", "/FO", "CSV", "/NH", "/FI", f"PID eq {pid}"],
                     capture_output=True, text=True, timeout=10)
    except (FileNotFoundError, OSError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        return None
    stdout = result.stdout if isinstance(result, subprocess.CompletedProcess) else result
    for line in stdout.splitlines():
        parts = line.split('","')
        if len(parts) >= 2 and parts[1].strip('"') == str(pid):
            return parts[0].strip('"')
    return None


def probe_gpu(runner: Runner | None = None, memory_fn: Callable[[], dict] | None = None,
              pdh_fn: Callable[[], dict] | None = None,
              tasklist_fn: Callable[[int], str | None] | None = None) -> dict:
    """nvidia-smi 解析 + PDH 集成：available=false 附中文原因（不存在/无 GPU/解析失败）。

    PDH 集成（2026-09-06，Task 2）：进程 memory_mb 用 PDH 分配口径（按 pid 匹配，缺失回落 None），
    利用率用 PDH（任务管理器同源，WDDM 失真替代），响应带 utilization_source。PDH 不可用时回落
    nvidia-smi 口径。pdh_fn 可注入（测试）；缺省 probe_pdh。
    """
    runner = runner or _run_smi
    pdh_runner = pdh_fn or probe_pdh
    try:
        gpu_out = runner(["nvidia-smi", "--query-gpu=" + GPU_QUERY, "--format=csv,noheader,nounits"])
        proc_out = runner(["nvidia-smi", "--query-compute-apps=" + PROC_QUERY, "--format=csv,noheader,nounits"])
        pdh_result = pdh_runner()
        proc_mb = pdh_result.get("processes_mb", {})
        pdh_util = pdh_result.get("utilization_percent")
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
            # Task 3（2026-09-06）：[Insufficient Permissions] 名补全为真实进程名（tasklist 按 pid）。
            # 补全结果影响后续 append 的 name 与 kind 分类（真实名才能正确归类模型进程）。
            if pname == "[Insufficient Permissions]":
                resolved = (tasklist_fn or resolve_process_name)(pid_num)
                if resolved:
                    pname = resolved
            # Windows WDDM 模式下 used_memory 常为 [N/A]/[Insufficient Permissions]：
            # 显存数值拿不到，但进程清单与名称可得——保留行（memory_mb=None）供
            # 「非模型任务」清单识别（REQ-038 用户核心诉求），不参与前端 MB 聚合
            # PDH 集成（Task 2）：memory_mb 用 PDH 分配口径按 pid 匹配，缺失回落 None
            pdh_mb = proc_mb.get(pid_num)
            if pdh_mb is not None:
                processes.append(
                    {"pid": pid_num, "name": pname, "memory_mb": pdh_mb, "kind": classify_process(pname)}
                )
            elif mem in ("[N/A]", "[Insufficient Permissions]", ""):
                processes.append(
                    {"pid": pid_num, "name": pname, "memory_mb": None, "kind": classify_process(pname)}
                )
            else:
                processes.append(
                    {"pid": pid_num, "name": pname, "memory_mb": int(float(mem)), "kind": classify_process(pname)}
                )
    except (ValueError, IndexError):
        return {"available": False, "reason": "nvidia-smi 输出解析失败"}
    # 利用率：PDH 优先（任务管理器同源，WDDM 失真替代）；PDH 不可用回落 nvidia-smi
    utilization_source = "pdh" if pdh_util is not None else "nvidia-smi"
    if pdh_util is not None:
        utilization = pdh_util
    result = {
        "available": True,
        "name": name,
        "memory_total_mb": total_mb,
        "memory_used_mb": used_mb,
        "utilization_percent": utilization,
        "utilization_source": utilization_source,
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


def probe_qwen(settings: Settings, client: httpx.Client | None = None) -> dict:
    """Qwen 本地模型（OpenAI 兼容）探测：/v1/models + 已加载模型列表（5s 超时）。"""
    base = settings.qed_qwen_url.rstrip("/")
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
    不泄漏堆栈。健康端点 `/health`（MinerU 实际实现，容器 healthcheck 与日志证实）。
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
