"""本地模型监督器（ARCH-028 W2 骨架）：分级探测 + 状态机防抖 + 事件账 + 快照。

分级探测（吸收 DeepTutor readiness 模式，调研判定见 PLAN 壳 W0）：
- T1 HTTP 存活：复用 monitor.probe_slot（5s 预算），失败即 down；
- T2 GPU 可见性：仅 vision×docker 渠道（`wsl -e docker exec nvidia-smi -L`），
  T1 绿但 T2 False → degraded（「活着但废了」——已知约束 7 WSL 挂起/GPU blocked 形态）；
  fail-closed：探测异常按不可见处理（宁标降级不误报就绪）。

状态机防抖：翻转需连续 DEBOUNCE_N 次同向观测（DeepTutor 熔断 5 次/60s 改小——
16GB 单机冷启动代价低但误翻转噪声高）；初始观测即时定态。翻转写结构化事件日志
（稳定 reason 文案，事件账 v1 走 8900 日志不建表）。自动恢复与水位门在 W3 接入
（本模块只观测不处置）。api 来源槽位跳过不探测。

设计关联（DesignRef）：docs/plans/2026-09-23-local-model-stability-round.md、
docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_llm_supervisor.py
"""

from __future__ import annotations

import logging
import subprocess
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from qed_engine.config import Settings
from qed_engine.services.llm import registry

LOG = logging.getLogger("qed_engine.services")

READY, DEGRADED, DOWN = "ready", "degraded", "down"
# 观测槽位（embedding 无本地候选，天然不入状态机）
SUPERVISED_SLOTS = ("text", "vision")
# T2 GPU 可见性适用槽位（当前仅 docker-MinerU；LM Studio/llama.cpp 显存归宿主，探针不适用）
GPU_PROBE_SLOTS = ("vision",)

DEBOUNCE_N = 3
TICK_INTERVAL = 30.0
GPU_PROBE_TIMEOUT = 15.0


@dataclass
class _SlotState:
    state: str = ""       # "" = 未观测（api 来源 / 尚未 tick）
    reason: str = ""
    gpu_visible: bool | None = None
    pending: str = ""
    pending_count: int = 0
    last_flip: str = ""


def docker_gpu_visible(runner: Callable = subprocess.run) -> bool:
    """MinerU 容器内 GPU 可见性（rc==0 即见）；异常/非零一律 False（fail-closed）。"""
    try:
        result = runner(
            ["wsl", "-e", "docker", "exec", "mineru-api", "nvidia-smi", "-L"],
            capture_output=True, timeout=GPU_PROBE_TIMEOUT, check=False,
        )
        return getattr(result, "returncode", 1) == 0
    except (OSError, subprocess.SubprocessError):
        return False


class ModelSupervisor:
    """常驻监督器：start() 起守护线程周期 tick；逻辑全在 tick()，可注入探针手动驱动（测试/W3）。"""

    def __init__(self, settings: Settings,
                 probe_t1: Callable[[str], tuple[bool, str]] | None = None,
                 probe_gpu: Callable[[str], bool | None] | None = None,
                 debounce: int = DEBOUNCE_N, interval: float = TICK_INTERVAL,
                 clock: Callable[[], datetime] = datetime.now):
        self.settings = settings
        self._probe_t1 = probe_t1 or self._default_probe_t1
        self._probe_gpu = probe_gpu or self._default_probe_gpu
        self._debounce = debounce
        self._interval = interval
        self._clock = clock
        self._states: dict[str, _SlotState] = {slot: _SlotState() for slot in SUPERVISED_SLOTS}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # --- 默认探针（测试注入替换即不触网络/子进程） ---

    def _default_probe_t1(self, slot: str) -> tuple[bool, str]:
        from qed_engine.services import monitor  # 延迟导入：monitor 反向引用 llm registry

        result = monitor.probe_slot(self.settings, slot)
        return bool(result["reachable"]), str(result.get("reason") or "")

    def _default_probe_gpu(self, slot: str) -> bool | None:
        """None=不适用/不可判（按存活放行）；False=确认不可见（degraded 判据）。"""
        if registry.slot_runtime(self.settings, slot) != "docker":
            return None
        return docker_gpu_visible()

    # --- 状态机 ---

    def _observe(self, slot: str) -> tuple[str, str, bool | None] | None:
        """单次分级观测 → (state, reason, gpu_visible)；None=本槽位不观测（api 来源）。"""
        if registry.configured_source(self.settings, slot) != "local":
            return None
        ok, reason = self._probe_t1(slot)
        if not ok:
            return DOWN, reason or "探活失败", None
        gpu = self._probe_gpu(slot) if slot in GPU_PROBE_SLOTS else None
        if gpu is False:
            return DEGRADED, "容器内 GPU 不可见（已知约束 7：唤醒 WSL 后重启 mineru-api 恢复）", False
        return READY, "", gpu

    def tick(self) -> None:
        """一轮全槽位观测 + 防抖状态机（守护线程体；测试直接调用驱动）。"""
        for slot in SUPERVISED_SLOTS:
            observed = self._observe(slot)
            if observed is not None:
                self._apply(slot, *observed)

    def _apply(self, slot: str, state: str, reason: str, gpu: bool | None) -> None:
        with self._lock:
            s = self._states[slot]
            if s.state == "":
                self._flip(slot, s, state, reason, gpu)
                return
            if state == s.state:
                s.pending, s.pending_count = "", 0
                s.reason, s.gpu_visible = reason, gpu
                return
            if state != s.pending:
                s.pending, s.pending_count = state, 1
            else:
                s.pending_count += 1
            if s.pending_count >= self._debounce:
                self._flip(slot, s, state, reason, gpu)

    def _flip(self, slot: str, s: _SlotState, state: str, reason: str, gpu: bool | None) -> None:
        frm = s.state
        s.state, s.reason, s.gpu_visible = state, reason, gpu
        s.pending, s.pending_count = "", 0
        s.last_flip = self._clock().astimezone().isoformat(timespec="seconds")
        # 事件账（结构化行，供日志检索与 W3 恢复决策；吸收 DeepTutor 稳定 reason 形态）
        LOG.info("模型监督事件 slot=%s %s->%s reason=%s", slot, frm or "∅", state, reason or "-")

    # --- 快照（GET /models/{slot} 健康字段数据源） ---

    def snapshot(self, slot: str) -> dict:
        """受监督槽位恒返回完整 dict（未观测时 state=""）；非受监督槽位返回 {}。"""
        with self._lock:
            s = self._states.get(slot)
            if s is None:
                return {}
            return {"state": s.state, "reason": s.reason,
                    "gpu_visible": s.gpu_visible, "last_flip": s.last_flip}

    # --- 线程生命周期 ---

    def start(self) -> None:
        """起守护线程（先等 interval 再首 tick，测试进程快速建/拆 app 不触发探测）。"""
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, daemon=True, name="model-supervisor")
        self._thread.start()

    def _loop(self) -> None:
        while not self._stop.wait(self._interval):
            try:
                self.tick()
            except Exception:  # 观测异常只记日志，监督线程不退出（恢复处置在 W3 接入）
                LOG.exception("模型监督 tick 异常（slot 观测失败不中断循环）")

    def stop(self) -> None:
        self._stop.set()
