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
MINERU_URL = "http://127.0.0.1:5002"
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


def _decode_console(blob: object) -> str:
    """控制台工具输出的容错解码（DEFECT-018）：字节按 UTF-8 替换解码，空值归一为空串。

    真机中文 Windows 下 tasklist / Get-Counter 以 GBK 落管道，`text=True` 的 reader 线程抛
    UnicodeDecodeError（ValueError 子类）并使 stdout=None。判例形态＝上方 `_run_smi`。
    """
    if not blob:
        return ""
    if isinstance(blob, bytes):
        return blob.decode("utf-8", errors="replace")
    return blob if isinstance(blob, str) else str(blob)


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


def _pdh_cmd() -> list[str]:
    """单次 Get-Counter 拉双计数器（REQ-033 性能：省一次 PowerShell 冷启动 ≈1.5s）。

    输出按 MEM|实例|值 / UTIL|实例|值 打标，供 split_pdh_streams 拆流。
    """
    script = (
        "$c = Get-Counter -Counter '" + PDH_MEM_PATH + "','" + PDH_UTIL_PATH + "'; "
        "$c.CounterSamples | ForEach-Object { "
        "if ($_.Path -match 'Dedicated Usage') { \"MEM|$($_.InstanceName)|$([math]::Round($_.CookedValue,1))\" } "
        "else { \"UTIL|$($_.InstanceName)|$([math]::Round($_.CookedValue,2))\" } }"
    )
    return ["powershell", "-NoProfile", "-Command", script]


def _run_pdh(runner=None) -> str:
    """执行合并 PDH 探测；超时/失败/输出不可解码或为空一律降级为空串（尽力降级，不抛异常）。

    DEFECT-018：默认 runner 按字节捕获后容错解码（不再用 `text=True`），并把 ValueError
    （含 UnicodeDecodeError）纳入降级——`Get-Counter` 中文计数器名解码失败曾逃逸出 `probe_gpu`。
    """
    run = runner or (
        lambda cmd, **kw: subprocess.run(cmd, capture_output=True, timeout=15).stdout
    )
    try:
        return _decode_console(run(_pdh_cmd()))
    except (FileNotFoundError, OSError, subprocess.SubprocessError, ValueError):
        return ""


def split_pdh_streams(out: str) -> tuple[str, str]:
    """合并打标输出 → (显存流, 利用率流)，各自还原为「实例: 值」行供解析。"""
    mem_lines: list[str] = []
    util_lines: list[str] = []
    for line in out.splitlines():
        tag, _, rest = line.partition("|")
        inst, _, value = rest.partition("|")
        if not value:
            continue
        if tag == "MEM":
            mem_lines.append(f"{inst}: {value}")
        elif tag == "UTIL":
            util_lines.append(f"{inst}: {value}")
    return "\n".join(mem_lines), "\n".join(util_lines)


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
    """解析 \GPU Engine Utilization Percentage：取非零 sample 最大值（代表 GPU 总体活动）。

    行形如 `pid_29052_luid_0x..._phys_0_eng_0_engtype_3d: 0.2`（PowerShell 实例名真实形状；
    旧实现按「luid=.. util=」假想格式解析，真机永不命中——REQ-033 性能轮顺带修正）。
    引擎分 3d/copy/video 等类型，任务管理器同源口径按物理 GPU 上下文取非零最大值。
    """
    vals: list[float] = []
    for line in out.splitlines():
        m = re.match(r"\s*pid_\d+_luid_.+?_eng_\d+_engtype_\w+:\s*([\d.]+)", line)
        if not m:
            continue
        vals.append(float(m.group(1)))
    return max(vals) if vals else None


def probe_pdh(runner=None) -> dict:
    """Windows PDH 合并探测：单次 Get-Counter 同时取逐进程专用显存（分配口径）+ 利用率。

    任一探测失败（PowerShell 缺失/超时/解析为空）尽力降级：processes_mb 为空、utilization None；
    不抛异常，供 probe_gpu 集成时回落 nvidia-smi 口径。runner 可注入（测试），收 _pdh_cmd() 命令表。
    """
    mem_out, util_out = split_pdh_streams(_run_pdh(runner))
    return {
        "processes_mb": parse_pdh_process_memory(mem_out),
        "utilization_percent": parse_pdh_utilization(util_out),
    }


def resolve_process_name(pid: int, runner=None) -> str | None:
    """按 pid 经 tasklist CSV 补全进程真实名（Windows）；失败/未找到/输出为空返回 None。

    背景（Task 3，2026-09-06）：WDDM 下 nvidia-smi 对系统/受限进程显示 `[Insufficient Permissions]`，
    tasklist 能按 pid 取真实名（如 LM Studio.exe）。runner 可注入（测试）；失败不抛异常。

    DEFECT-018（2026-10-17）：改为字节捕获 + 容错解码并把 ValueError 纳入降级——真机 tasklist 的
    GBK 输出在 `text=True` 下解码失败使 stdout=None，原代码未判空即 `.splitlines()` 抛
    AttributeError，显存监控因此长期沿用旧缓存。
    """
    run = runner or subprocess.run
    try:
        result = run(["tasklist", "/FO", "CSV", "/NH", "/FI", f"PID eq {pid}"],
                     capture_output=True, timeout=10)
    except (FileNotFoundError, OSError, subprocess.SubprocessError, subprocess.TimeoutExpired,
            ValueError):
        return None
    stdout = _decode_console(getattr(result, "stdout", result))
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


def probe_qwen(settings: Settings, client: httpx.Client | None = None,
               base_url: str | None = None, token: str = "") -> dict:
    """Qwen 本地模型（OpenAI 兼容）探测：/v1/models + 已加载模型列表（5s 超时）。

    base_url 可覆盖（PLAN-046 槽位泛化：/monitor/text 传文字模型端点）；缺省用 QED_MODEL_URL。
    token 为 LM Studio API 认证（W7 实测：本机开启认证需 Bearer；空=不带头，llama-server 无认证时传空）。
    """
    base = (base_url or settings.qed_model_url).rstrip("/")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        own = client is None
        http = client or httpx.Client(timeout=PROBE_TIMEOUT, trust_env=False)
        try:
            response = http.get(f"{base}/models", headers=headers)
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


def probe_mineru(client: httpx.Client | None = None, base_url: str | None = None) -> dict:
    """mineru 解析服务（5002，WSL 容器）健康探测。

    容器未启动/WSL 不可达 → reachable=false + 中文原因（提示运行容器编排脚本），
    不泄漏堆栈。健康端点 `/health`（MinerU 实际实现，容器 healthcheck 与日志证实）。
    base_url 可覆盖（PLAN-046 槽位泛化）；缺省用内置 5002。
    """
    base = (base_url or MINERU_URL).rstrip("/")
    port = httpx.URL(base).port or 5002
    try:
        own = client is None
        http = client or httpx.Client(timeout=PROBE_TIMEOUT, trust_env=False)
        try:
            response = http.get(f"{base}{MINERU_HEALTH_PATH}")
        finally:
            if own:
                http.close()
        if response.status_code == 200:
            return {"reachable": True, "port": port, "reason": ""}
        return {"reachable": False, "port": port, "reason": f"HTTP {response.status_code}"}
    except httpx.TimeoutException:
        return {"reachable": False, "port": port, "reason": "超时"}
    except httpx.HTTPError:
        return {"reachable": False, "port": port, "reason": "mineru docker 容器未启动（请运行容器编排脚本启动）"}


def probe_slot(settings: Settings, slot: str, client: httpx.Client | None = None) -> dict:
    """槽位泛化探针（PLAN-046 /monitor/{slot}）：text 按槽位渠道探文字模型端点，
    vision 探 MinerU，embedding 无本地 runtime。归一化返回 slot/runtime/reachable。"""
    if slot == "vision":
        result = probe_mineru(client, base_url=settings.qed_ocr_model_url)
        runtime_key = "docker"
    elif slot == "text":
        # 延迟导入：monitor 不依赖注册表内部结构，仅取槽位生效渠道（manifest.runtime > 全局默认）
        from qed_engine.services.llm import registry

        runtime_key = registry.slot_runtime(settings, "text")
        # LM Studio 本机开启 API 认证（W7 实测）：探针带 QED_LMSTUDIO_TOKEN
        token = settings.resolved_lmstudio_token() if runtime_key == "lmstudio" else ""
        result = probe_qwen(settings, client, base_url=settings.qed_model_url, token=token)
    else:  # embedding：无本地候选
        return {"slot": slot, "runtime": "", "reachable": False, "base_url": "",
                "models": [], "reason": "向量槽位仅 api（本地预留）"}
    return {"slot": slot, "runtime": runtime_key,
            "reachable": result["reachable"], "reason": result["reason"],
            "base_url": result.get("base_url", ""), "models": result.get("models", [])}
