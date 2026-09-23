"""本地模型监督器（ARCH-028 W2 骨架）：分级探测 + 状态机防抖 + 事件账 + 快照。

分级探测（吸收 DeepTutor readiness 模式，调研判定见 PLAN 壳 W0）：
- T1 HTTP 存活：复用 monitor.probe_slot（5s 预算），失败即 down；
- T2 GPU 可见性：仅 vision×docker 渠道（`wsl -e docker exec nvidia-smi -L`），
  T1 绿但 T2 False → degraded（「活着但废了」——已知约束 7 WSL 挂起/GPU blocked 形态）；
  fail-closed：探测异常按不可见处理（宁标降级不误报就绪）。

状态机防抖：翻转需连续 DEBOUNCE_N 次同向观测（DeepTutor 熔断 5 次/60s 改小——
16GB 单机冷启动代价低但误翻转噪声高）；初始观测即时定态。翻转写结构化事件日志
（稳定 reason 文案，事件账 v1 走 8900 日志不建表）。api 来源槽位跳过不探测。

W3 受控恢复（用户裁决 2026-09-23）：非在飞自动 restart（默认经 operate_model，
独立派发线程不阻塞 tick），两次尝试间隔 recover_cooldown 个 tick 退避、每故障
Episode 上限 max_recoveries=3 次后转纯告警（翻回 ready 预算重置）；解析在飞
（8902 queued/running，REQ-085 约束 9）只告警不重启——8902 连不上视为不在飞，
判定异常保守按在飞；REQ-088 列表端点未上线时回退逐本 active_job_id 单查。
非就绪翻转触发掉线诊断包（docker 槽位：events + 日志尾 2000 行 + nvidia-smi -L，
写 8900 日志）。显存水位门在 W5。

设计关联（DesignRef）：docs/plans/2026-09-23-local-model-stability-round.md、
docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_llm_supervisor.py
"""

from __future__ import annotations

import logging
import subprocess
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

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
    attempts: int = 0        # W3 本故障 Episode 已尝试恢复次数
    given_up: bool = False   # W3 达上限转纯告警
    ticks: int = 0           # W3 非就绪态累计 tick 数（退避节拍：ticks 为 recover_cooldown 整数倍时评估）


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
                 recover: Callable[[str], None] | None = None,
                 is_inflight: Callable[[str], bool] | None = None,
                 diagnostics: Callable[[str], None] | None = None,
                 axiom_client_factory: Callable[[], object] | None = None,
                 debounce: int = DEBOUNCE_N, interval: float = TICK_INTERVAL,
                 max_recoveries: int = 3, recover_cooldown: int = 4,
                 clock: Callable[[], datetime] = datetime.now):
        self.settings = settings
        self._probe_t1 = probe_t1 or self._default_probe_t1
        self._probe_gpu = probe_gpu or self._default_probe_gpu
        self._recover = recover or self._default_recover
        self._is_inflight = is_inflight or self._default_is_inflight
        self._diagnostics = diagnostics or self._default_diagnostics
        self._axiom_factory = axiom_client_factory
        self._max_recoveries = max_recoveries
        self._recover_cooldown = recover_cooldown
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
        """一轮全槽位观测 + 防抖状态机 + 受控恢复（守护线程体；测试直接调用驱动）。"""
        for slot in SUPERVISED_SLOTS:
            observed = self._observe(slot)
            if observed is None:
                continue
            if self._apply(slot, *observed):
                try:
                    self._diagnostics(slot)
                except Exception:
                    LOG.exception("掉线诊断包采集异常 slot=%s", slot)
            self._recover_step(slot)

    def _apply(self, slot: str, state: str, reason: str, gpu: bool | None) -> bool:
        """返回本 tick 是否翻转到非就绪态（诊断包触发判据）。"""
        with self._lock:
            s = self._states[slot]
            if s.state == "":
                self._flip(slot, s, state, reason, gpu)
                return state != READY
            if state == s.state:
                s.pending, s.pending_count = "", 0
                s.reason, s.gpu_visible = reason, gpu
                return False
            if state != s.pending:
                s.pending, s.pending_count = state, 1
            else:
                s.pending_count += 1
            if s.pending_count >= self._debounce:
                self._flip(slot, s, state, reason, gpu)
                return state != READY
            return False

    def _flip(self, slot: str, s: _SlotState, state: str, reason: str, gpu: bool | None) -> None:
        frm = s.state
        s.state, s.reason, s.gpu_visible = state, reason, gpu
        s.pending, s.pending_count = "", 0
        s.last_flip = self._clock().astimezone().isoformat(timespec="seconds")
        if state == READY:
            s.attempts, s.given_up, s.ticks = 0, False, 0
        # 事件账（结构化行，供日志检索与 W3 恢复决策；吸收 DeepTutor 稳定 reason 形态）
        LOG.info("模型监督事件 slot=%s %s->%s reason=%s", slot, frm or "∅", state, reason or "-")

    # --- W3 受控恢复 ---

    def _recover_step(self, slot: str) -> None:
        """非就绪槽位的恢复决策：在飞只告警；退避节拍（每 recover_cooldown 个 tick 评估一次）；上限次数后转纯告警。"""
        with self._lock:
            s = self._states[slot]
            if s.state not in (DOWN, DEGRADED) or s.given_up:
                return
            s.ticks += 1
            if s.ticks % self._recover_cooldown:
                return
        if self._is_inflight(slot):
            LOG.info("模型恢复跳过 slot=%s reason=解析在飞（REQ-085 约束 9）仅告警", slot)
            return
        with self._lock:
            s = self._states[slot]
            if s.state not in (DOWN, DEGRADED) or s.given_up:
                return
            if s.attempts >= self._max_recoveries:
                s.given_up = True
                LOG.warning("模型恢复放弃 slot=%s attempts=%d 转纯告警（翻回 ready 后重置）",
                            slot, s.attempts)
                return
            s.attempts += 1
            s.cooldown = self._recover_cooldown
            attempt = s.attempts
        LOG.info("模型恢复尝试 slot=%s attempt=%d/%d op=restart", slot, attempt, self._max_recoveries)
        try:
            self._recover(slot)
        except Exception:
            LOG.exception("模型恢复动作异常 slot=%s", slot)

    def _default_recover(self, slot: str) -> None:
        """生产恢复动作：operate_model restart，独立派发线程执行不阻塞 tick。"""
        from qed_engine.services.llm import model_manager

        def run() -> None:
            try:
                model_manager.operate_model(slot, "restart", self.settings)
            except Exception:
                LOG.exception("模型恢复 restart 失败 slot=%s", slot)

        threading.Thread(target=run, daemon=True, name=f"model-recover-{slot}").start()

    def _make_axiom_client(self):
        from qed_engine.clients.axiom_client import AxiomClient

        return AxiomClient(self.settings.qed_axiom_url, timeout=5.0)

    def _default_is_inflight(self, slot: str) -> bool:
        """解析在飞判定（仅 vision 适用）：REQ-088 列表端点优先，旧码回退逐本 active_job_id。

        失败语义：8902 连接失败=不可能有解析在跑→不在飞放行恢复；HTTP 异常无法判定
        保守按在飞（宁可不重启，不可杀在飞解析）。
        """
        from qed_engine.clients.axiom_client import AxiomError

        if slot != "vision":
            return False
        client = (self._axiom_factory or self._make_axiom_client)()
        try:
            data = client.list_parse_jobs(status=["queued", "running"], limit=1)
            return bool(data.get("jobs"))
        except AxiomError as exc:
            if exc.status_code is None:
                return False
            if exc.status_code in (404, 405):
                return self._inflight_via_active_jobs(client)
            LOG.warning("在飞判定异常 slot=%s status=%s 保守按在飞", slot, exc.status_code)
            return True
        except Exception:
            LOG.exception("在飞判定未知异常 slot=%s 保守按在飞", slot)
            return True

    def _inflight_via_active_jobs(self, client) -> bool:
        from qed_engine.clients.axiom_client import AxiomError

        try:
            books = client.list_books()
        except AxiomError as exc:
            return exc.status_code is not None
        for book in books:
            job_id = book.get("active_job_id") if isinstance(book, dict) else None
            if not job_id:
                continue
            try:
                if client.get_parse_job(str(job_id)).get("status") in ("queued", "running"):
                    return True
            except AxiomError as exc:
                return exc.status_code is not None
        return False

    def _default_diagnostics(self, slot: str) -> None:
        """掉线诊断包（W6 取证素材）：docker 槽位采 events + 日志尾 2000 行 + GPU 可见性。"""
        if registry.slot_runtime(self.settings, slot) != "docker":
            return
        captures = [
            ("docker-events", ["wsl", "-e", "docker", "events", "--since", "10m", "--until", "now",
                               "--format", "{{.Action}} {{.Status}} {{.Actor.Attributes.name}}"]),
            ("mineru-logs", ["wsl", "-e", "docker", "logs", "--tail", "2000", "mineru-api"]),
            ("gpu-probe", ["wsl", "-e", "docker", "exec", "mineru-api", "nvidia-smi", "-L"]),
        ]
        for name, cmd in captures:
            try:
                result = subprocess.run(cmd, capture_output=True, timeout=20, check=False)
                blob = (result.stdout or b"")[-8000:] + (result.stderr or b"")[-2000:]
                LOG.info("掉线诊断包 slot=%s %s rc=%s output=%s", slot, name,
                         getattr(result, "returncode", "?"),
                         blob.decode("utf-8", errors="replace"))
            except (OSError, subprocess.SubprocessError) as exc:
                LOG.warning("掉线诊断包 slot=%s %s 采集失败：%s", slot, name, exc)

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
