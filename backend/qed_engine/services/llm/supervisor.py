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

W12 期望状态（用户裁决 2026-09-24）：槽位记 desired=running/stopped/未声明——观测到
ready 即采纳 running、operate_model start/restart 经 note_desired_active 上报 running、
stop 上报 stopped；自动恢复只对 desired=running 的故障 Episode 生效（人工停止=合法终态
永不复活，只发一次告警）；api 来源暂停观测时清空快照与期望（不冻结旧「就绪」，
api→local 切换不拉起模型）。

W7 启动宽限期 + W8 恢复闩锁（用户裁决 2026-09-24，演练证据 09-23 18:57:27 启动窗口
拒连×3 被防抖误定态 down）：operate_model 派发 start/restart 后经 note_starting_active
置槽位宽限窗口（QED_MODEL_START_GRACE_SECONDS 默认 180s）——窗口内 down/degraded 观测
不推进防抖、冻结恢复 tick（不消耗预算/不叠发第二发＝闩锁）、不触发诊断包；ready 观测
走正常防抖，翻回 ready 即解锁；期满仍未就绪转正常防抖翻 down。人工 stop（desired=
stopped）与 api 暂停即时清窗。快照在窗口内以 health_state="starting" 呈现（仪表盘徽章
「启动中」）。W10 补强：掉线诊断包增采 docker inspect（OOMKilled/ExitCode/RestartCount）。

设计关联（DesignRef）：docs/design/local-model-management.md、
docs/plans/2026-09-23-local-model-stability-round.md
实现状态：Current
关联测试：tests/test_llm_supervisor.py
"""

from __future__ import annotations

import logging
import subprocess
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from qed_engine.config import Settings
from qed_engine.services.llm import registry

LOG = logging.getLogger("qed_engine.services")

READY, DEGRADED, DOWN = "ready", "degraded", "down"
STARTING = "starting"  # W7 宽限窗口内的快照呈现态（非状态机定态）
# 观测槽位（embedding 无本地候选，天然不入状态机）
SUPERVISED_SLOTS = ("text", "vision")
# T2 GPU 可见性适用槽位（当前仅 docker-MinerU；LM Studio/llama.cpp 显存归宿主，探针不适用）
GPU_PROBE_SLOTS = ("vision",)

DEBOUNCE_N = 3
TICK_INTERVAL = 30.0
GPU_PROBE_TIMEOUT = 15.0


@dataclass
class _SlotState:
    state: str = ""       # "" = 未观测（api 来源 / 尚未 tick / 暂停清位）
    reason: str = ""
    gpu_visible: bool | None = None
    pending: str = ""
    pending_count: int = 0
    last_flip: str = ""
    attempts: int = 0        # W3 本故障 Episode 已尝试恢复次数
    given_up: bool = False   # W3 达上限转纯告警
    ticks: int = 0           # W3 非就绪态累计 tick 数（退避节拍：ticks 为 recover_cooldown 整数倍时评估）
    desired: str = ""        # W12 在跑期望：running/stopped/""=未声明（观测采纳或人工上报）
    alerted: bool = False    # W12 本 Episode 非期望态告警只发一次
    starting_until: float = 0.0  # W7 启动宽限截止（time.monotonic 时基；0=无窗口）


# 活跃实例（create_app 接线 start() 时登记；多实例后起者接管意图上报）
_ACTIVE: ModelSupervisor | None = None


def note_desired_active(slot: str, desired: str) -> None:
    """外部模块（model_manager）上报槽位在跑期望；监督器未启用时静默忽略。"""
    if _ACTIVE is not None:
        _ACTIVE.note_desired(slot, desired)


def note_starting_active(slot: str) -> None:
    """外部模块（model_manager 派发 start/restart 时）上报槽位进入启动宽限窗口。"""
    if _ACTIVE is not None:
        _ACTIVE.note_starting(slot)


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
                 start_grace: float | None = None,
                 mono: Callable[[], float] = time.monotonic,
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
        # W7 启动宽限窗口秒数（QED_MODEL_START_GRACE_SECONDS，默认 180；<=0 关闭）
        self._start_grace = (getattr(settings, "qed_model_start_grace_seconds", 180.0)
                             if start_grace is None else start_grace)
        self._mono = mono
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
        """单次分级观测 → (state, reason, gpu_visible)；None=本槽位不观测（api 来源，暂停清位）。"""
        if registry.configured_source(self.settings, slot) != "local":
            self._pause(slot)
            return None
        ok, reason = self._probe_t1(slot)
        if not ok:
            return DOWN, reason or "探活失败", None
        gpu = self._probe_gpu(slot) if slot in GPU_PROBE_SLOTS else None
        if gpu is False:
            return DEGRADED, "容器内 GPU 不可见（已知约束 7：唤醒 WSL 后重启 mineru-api 恢复）", False
        return READY, "", gpu

    def _pause(self, slot: str) -> None:
        """api 来源暂停观测：清快照与在跑期望（不冻结旧「就绪」、不携带意图跨切换模式）。"""
        with self._lock:
            s = self._states[slot]
            s.starting_until = 0.0  # W7：未定态也可能在宽限窗口内，暂停一律清窗
            if s.state == "":
                return
            LOG.info("模型监督事件 slot=%s %s->∅ reason=观察暂停（api 来源）", slot, s.state)
            s.state, s.reason, s.gpu_visible = "", "", None
            s.pending, s.pending_count = "", 0
            s.desired, s.alerted = "", False
            s.attempts, s.given_up, s.ticks = 0, False, 0

    def tick(self) -> None:
        """一轮全槽位观测 + 宽限门 + 防抖状态机 + 受控恢复（守护线程体；测试直接调用驱动）。"""
        for slot in SUPERVISED_SLOTS:
            observed = self._observe(slot)
            if observed is None:
                continue
            state, reason, gpu = observed
            if not self._grace_step(slot, state):
                continue
            if self._apply(slot, state, reason, gpu):
                try:
                    self._diagnostics(slot)
                except Exception:
                    LOG.exception("掉线诊断包采集异常 slot=%s", slot)
            self._recover_step(slot)

    def _grace_step(self, slot: str, state: str) -> bool:
        """W7 宽限门：False=本观测抑制（不推进防抖/不触发诊断）。

        窗口内仅 ready 观测放行（走正常防抖，翻回 ready 即解锁）；down/degraded 一律
        抑制；期满清窗并放行后续观测转正常防抖（对照 09-23 18:57:27 启动窗口误判）。
        """
        with self._lock:
            s = self._states[slot]
            if not s.starting_until:
                return True
            if self._mono() >= s.starting_until:
                s.starting_until = 0.0
                LOG.info("模型启动宽限期满 slot=%s 转正常防抖", slot)
                return True
            if state == READY:
                if s.state == READY:
                    s.starting_until = 0.0  # 冗余 start：目标本就就绪定态，即时清窗不遮蔽
                return True
            return False

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
        s.alerted = False  # 新 Episode 告警位重置
        if state == READY:
            s.attempts, s.given_up, s.ticks = 0, False, 0
            s.starting_until = 0.0  # W8：翻回 ready 即解除宽限/闩锁
            if s.desired != "stopped":
                s.desired = "running"  # 观测到在跑即采纳期望；人工 stopped 优先级更高
        # 事件账（结构化行，供日志检索与 W3 恢复决策；吸收 DeepTutor 稳定 reason 形态）
        LOG.info("模型监督事件 slot=%s %s->%s reason=%s", slot, frm or "∅", state, reason or "-")

    def note_starting(self, slot: str) -> None:
        """W7 启动宽限声明入口（operate_model 派发 start/restart 经 note_starting_active 上报）。"""
        if slot not in self._states or self._start_grace <= 0:
            return
        with self._lock:
            self._states[slot].starting_until = self._mono() + self._start_grace
        LOG.info("模型启动宽限 slot=%s 窗口=%ds（窗口内拒连观测不判掉线）",
                 slot, int(self._start_grace))

    def note_desired(self, slot: str, desired: str) -> None:
        """W12 在跑期望声明入口（operate_model 经 note_desired_active 上报；测试可直调）。"""
        if slot not in self._states or desired not in ("running", "stopped"):
            return
        with self._lock:
            self._states[slot].desired = desired
            if desired == "stopped":
                self._states[slot].starting_until = 0.0  # 人工停止＝合法终态，不留「启动中」
        LOG.info("模型期望状态 slot=%s desired=%s", slot, desired)

    # --- W3 受控恢复 ---

    def _recover_step(self, slot: str) -> None:
        """非就绪槽位恢复决策：期望≠running 只告警；在飞只告警；退避节拍评估；上限后转纯告警。"""
        with self._lock:
            s = self._states[slot]
            if s.state not in (DOWN, DEGRADED):
                return
            if s.starting_until and self._mono() < s.starting_until:
                return  # W7/W8：宽限窗口冻结恢复 tick 与派发（不消耗预算、不叠发第二发）
            if s.desired != "running":
                if not s.alerted:
                    s.alerted = True
                    LOG.info("模型监督告警 slot=%s state=%s 期望=%s（人工停止/未声明在跑）"
                             "不自动恢复，仅告警", slot, s.state, s.desired or "未声明")
                return
            if s.given_up:
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
                model_manager.operate_model(slot, "restart", self.settings,
                                            log=lambda msg: LOG.info("模型恢复过程 slot=%s：%s", slot, msg))
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
        """掉线诊断包（W6 取证素材）：docker 槽位采 events + 日志尾 2000 行 + GPU 可见性 + inspect。"""
        if registry.slot_runtime(self.settings, slot) != "docker":
            return
        now = int(time.time())
        captures = [
            # epoch 整数 since/until + 仅现存字段：{{.Status}} 与「--until now」在真机
            # 分别 rc=64 / rc=1（09-24 取证），旧写法 events 段实际采空
            ("docker-events", ["wsl", "-e", "docker", "events",
                               "--since", str(now - 600), "--until", str(now),
                               "--format", "{{.Action}} {{.Type}} {{.Actor.Attributes.name}}"]),
            ("mineru-logs", ["wsl", "-e", "docker", "logs", "--tail", "2000", "mineru-api"]),
            ("gpu-probe", ["wsl", "-e", "docker", "exec", "mineru-api", "nvidia-smi", "-L"]),
            # W10 补强：「被外部杀」与「vLLM OOM」两假设现场直接定谳，不等复现
            ("docker-inspect", ["wsl", "-e", "docker", "inspect", "mineru-api",
                                "--format",
                                "{{.State.OOMKilled}} {{.State.ExitCode}} {{.RestartCount}}"]),
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
        """受监督槽位恒返回完整 dict（未观测时 state=""）；非受监督槽位返回 {}。

        W7：宽限窗口内以 state="starting" 覆盖呈现（含底层旧定态），供仪表盘「启动中」徽章。
        """
        with self._lock:
            s = self._states.get(slot)
            if s is None:
                return {}
            if s.starting_until and self._mono() < s.starting_until:
                return {"state": STARTING, "reason": "启动派发宽限中（不判掉线）",
                        "gpu_visible": None, "last_flip": s.last_flip}
            return {"state": s.state, "reason": s.reason,
                    "gpu_visible": s.gpu_visible, "last_flip": s.last_flip}

    # --- 线程生命周期 ---

    def start(self) -> None:
        """起守护线程（先等 interval 再首 tick，测试进程快速建/拆 app 不触发探测）；登记为活跃实例。"""
        global _ACTIVE
        if self._thread is not None:
            return
        _ACTIVE = self
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
