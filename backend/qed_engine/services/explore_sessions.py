"""探索会话管理（PLAN-022 B3，裁决 D3）：内存态会话 + 后台线程执行 8901 dry-run 管线。

模型：POST /explore-sessions 创建会话（202 + session_id）→ 后台线程调 8901
同步 dry-run（领域三步管线约 4 分钟 / 课程 tutorials@v1 约 90s，故异步必要）→
前端 3~5s 轮询 GET /explore-sessions/{id} → ready 后 apply/confirm-name。

状态机：
  running → waiting_name_confirm（名称确认挂起，confirm-name 重跑）
          → ready（报告产出）→ apply（同步应用，会话保留供查看后清理）
          → failed（管线错误透出，可新会话重试）
放弃：DELETE（exploration_stage 回退未开始）；TTL 过期惰性清理。

LLM 调用审计：管线内每步由 8901 落 qed_llm_calls（经 LLM 网关时 service=qed_tracker），
本服务不重复记录。

设计关联（DesignRef）：docs/plans/2026-08-27-exploration-download-flow.md
实现状态：Current
关联测试：tests/test_explore_sessions.py
"""

import logging
import secrets
import threading
import time
from dataclasses import dataclass, field

from qed_engine.clients.tracker_client import TrackerClient, TrackerError
from qed_engine.config import Settings
from qed_engine.services import shared_tables
from qed_engine.services.shared_tables import (
    STAGE_COMPLETED,
    STAGE_GENERATED,
    STAGE_NOT_STARTED,
    STAGE_RUNNING,
)

logger = logging.getLogger("qed_engine.explore")

# 会话存活时长（无持久化：进程重启即丢，前端刷新后重新发起即可——D3 内存态语义）
SESSION_TTL_S = 2 * 60 * 60
# 名称确认超时（waiting_name_confirm 状态超过此时长自动 failed，避免永久挂起）
WAITING_NAME_CONFIRM_TIMEOUT_S = 10 * 60  # 10 min
# dry-run 为同步长请求（LLM 管线数分钟），会话专用客户端放宽超时
DRY_RUN_TIMEOUT_S = 600.0

TERMINAL_STATUSES = {"ready", "failed", "waiting_name_confirm"}


@dataclass
class ExploreSession:
    """单个探索会话（内存态，线程安全由 manager 锁保证）。"""

    session_id: str
    target: str  # domain | course
    mode: str
    domain_name: str = ""
    domain_id: str = ""  # 重探时由前端携带（已有领域）
    course_id: str = ""
    ref_text: str = ""
    ref_doc_path: str = ""
    status: str = "running"
    report: dict | None = None
    name_check: dict | None = None
    error: str | None = None
    steps: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.monotonic)
    updated_at: float = field(default_factory=time.monotonic)

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "target": self.target,
            "status": self.status,
            "domain_name": self.domain_name,
            "domain_id": self.domain_id,
            "course_id": self.course_id,
            "mode": self.mode,
            "report": self.report,
            "name_check": self.name_check,
            "error": self.error,
            "steps": self.steps,
        }


class ExploreSessionManager:
    """会话注册表 + 后台执行 + 应用链路（8901 在线 API / 直写降级双链路 D1/D2）。"""

    def __init__(
        self,
        settings: Settings,
        tracker_client: TrackerClient | None = None,
        dry_run_client: TrackerClient | None = None,
    ) -> None:
        self._settings = settings
        self._tracker = tracker_client or TrackerClient(base_url=settings.qed_tracker_url)
        # dry-run 长请求独立客户端（默认 30s 超时不够 LLM 管线）
        self._dry_run = dry_run_client or TrackerClient(
            base_url=settings.qed_tracker_url, timeout=DRY_RUN_TIMEOUT_S
        )
        self._sessions: dict[str, ExploreSession] = {}
        self._threads: dict[str, threading.Thread] = {}
        self._lock = threading.Lock()

    # --- 创建与查询 ---

    def create(
        self,
        *,
        target: str,
        mode: str,
        domain_name: str = "",
        domain_id: str = "",
        course_id: str = "",
        ref_text: str = "",
        ref_doc_path: str = "",
    ) -> ExploreSession:
        self._cleanup_expired()
        session = ExploreSession(
            session_id=f"es_{secrets.token_hex(8)}",
            target=target,
            mode=mode,
            domain_name=domain_name,
            domain_id=domain_id,
            course_id=course_id,
            ref_text=ref_text,
            ref_doc_path=ref_doc_path,
        )
        with self._lock:
            self._sessions[session.session_id] = session
        # 领域会话启动即置「探索中」（已有领域；新领域无行可写，跳过）
        if target == "domain" and domain_id:
            self._write_domain_stage(session, STAGE_RUNNING)
        thread = threading.Thread(target=self._run_pipeline, args=(session,), daemon=True)
        with self._lock:
            self._threads[session.session_id] = thread
        thread.start()
        return session

    def get(self, session_id: str) -> ExploreSession | None:
        self._cleanup_expired()
        with self._lock:
            return self._sessions.get(session_id)

    def delete(self, session_id: str) -> bool:
        """放弃会话：已有领域/课程的 exploration_stage 回退「未开始」。"""
        with self._lock:
            session = self._sessions.pop(session_id, None)
            self._threads.pop(session_id, None)
        if session is None:
            return False
        if session.target == "domain" and session.domain_id:
            self._write_domain_stage(session, STAGE_NOT_STARTED)
        elif session.target == "course" and session.course_id:
            shared_tables.set_course_stage(
                self._settings, self._tracker, session.course_id, STAGE_NOT_STARTED, online=True
            )
        return True

    # --- 名称确认（领域管线 P12 阶段二） ---

    def confirm_name(self, session_id: str, name_override: str) -> ExploreSession:
        session = self.get(session_id)
        if session is None:
            raise KeyError(session_id)
        if session.status != "waiting_name_confirm":
            raise ValueError(f"会话状态 {session.status} 不处于名称确认")
        session.domain_name = name_override.strip()
        session.status = "running"
        session.name_check = None
        session.error = None
        session.report = None
        session.updated_at = time.monotonic()
        thread = threading.Thread(target=self._run_pipeline, args=(session, True), daemon=True)
        with self._lock:
            self._threads[session.session_id] = thread
        thread.start()
        return session

    # --- 应用链路（D1 双链路） ---

    def apply(self, session_id: str, selected: list[dict]) -> dict:
        """应用所选变更：领域=管理端点逐项；课程=knowledge 采纳。同步执行。"""
        session = self.get(session_id)
        if session is None:
            raise KeyError(session_id)
        if session.status != "ready":
            raise ValueError(f"会话状态 {session.status} 不可应用（需 ready）")
        if session.target == "domain":
            return self._apply_domain(session, selected)
        return self._apply_course(session, selected)

    def _apply_domain(self, session: ExploreSession, selected: list[dict]) -> dict:
        applied: list[dict] = []
        conflicts: list[dict] = []
        domain_id = session.domain_id
        # 领域不存在（新建）：POST /domains；同名冲突 → 查现 id 复用（重探语义）
        if not domain_id:
            try:
                row = self._tracker.create_domain(
                    name=session.domain_name,
                    description=str((session.report or {}).get("domain", {}).get("description", "")),
                    stages=[],
                )
                domain_id = str(row.get("domain_id", ""))
                applied.append({"entity": "domain", "target_id": domain_id, "name": session.domain_name})
            except TrackerError as exc:
                if exc.status_code == 409:
                    domain_id = self._find_domain_id_by_name(session.domain_name)
                    if not domain_id:
                        return {"applied": applied, "conflicts": [
                            {"name": session.domain_name, "reason": str(exc.detail)}]}
                else:
                    raise
        if domain_id:
            session.domain_id = domain_id
        # 逐课创建（tier→sort_order、summary→description 直映射）
        for course in selected:
            name = str(course.get("name", "")).strip()
            if not name:
                conflicts.append({"name": "", "reason": "课程名缺失"})
                continue
            try:
                row = self._tracker.create_course_for_domain(
                    domain_id,
                    name=name,
                    stage=str(course.get("stage", "") or ""),
                    sort_order=int(course.get("tier", 0) or 0),
                    description=str(course.get("summary", "")),
                    aliases=list(course.get("aliases", []) or []),
                    track=str(course.get("track", "")),
                    prerequisites=list(course.get("prerequisites", []) or []),
                )
                applied.append({"entity": "course", "target_id": row.get("course_id", ""), "name": name})
            except TrackerError as exc:
                conflicts.append({"name": name, "reason": str(exc.detail)})
        # 应用完成 → exploration_stage=已完成
        if domain_id:
            self._write_domain_stage(session, STAGE_COMPLETED)
        session.updated_at = time.monotonic()
        return {"applied": applied, "conflicts": conflicts}

    def _apply_course(self, session: ExploreSession, selected: list[dict]) -> dict:
        result = self._tracker.adopt_course_knowledge(session.course_id, tutorials=selected)
        created = result.get("created", [])
        # 采纳落库 → 课程 exploration_stage=已生成（直写，REQ-064 ④）
        shared_tables.set_course_stage(
            self._settings, self._tracker, session.course_id, STAGE_GENERATED, online=True
        )
        session.updated_at = time.monotonic()
        return {"applied": created, "conflicts": []}

    def _find_domain_id_by_name(self, name: str) -> str:
        try:
            for row in self._tracker.list_domains():
                if row.get("name") == name:
                    return str(row.get("domain_id", ""))
        except TrackerError:
            pass
        return ""

    # --- 后台管线执行 ---

    def _run_pipeline(self, session: ExploreSession, confirm_override: bool = False) -> None:
        try:
            if session.target == "domain":
                self._run_domain(session, confirm_override)
            else:
                self._run_course(session)
        except Exception as exc:  # noqa: BLE001 - 会话失败统一落状态
            with self._lock:
                session.status = "failed"
                session.error = str(exc)[:500]
                session.updated_at = time.monotonic()
            logger.warning("探索会话 %s 失败：%s", session.session_id, exc)

    def _run_domain(self, session: ExploreSession, confirm_override: bool) -> None:
        result = self._dry_run.dry_run_domain_explore(
            session.domain_name,
            mode=session.mode,
            ref_text=session.ref_text or None,
            ref_doc_path=session.ref_doc_path or None,
            confirm_name_override=session.domain_name if confirm_override else None,
        )
        if result.get("confirmation_required"):
            with self._lock:
                session.status = "waiting_name_confirm"
                session.name_check = result.get("name_check")
                session.updated_at = time.monotonic()
            return
        self._finish_ready(session, result)

    def _run_course(self, session: ExploreSession) -> None:
        result = self._dry_run.dry_run_course_explore(
            session.course_id,
            mode=session.mode,
            ref_text=session.ref_text or None,
            ref_doc_path=session.ref_doc_path or None,
        )
        self._finish_ready(session, result)

    def _finish_ready(self, session: ExploreSession, result: dict) -> None:
        with self._lock:
            session.report = result.get("report")
            session.steps = list(result.get("calls", []) or [])
            session.status = "ready"
            session.updated_at = time.monotonic()
        # dry-run 产出待确认 → exploration_stage=已生成（已有领域才可写）
        if session.target == "domain" and session.domain_id:
            self._write_domain_stage(session, STAGE_GENERATED)

    def _write_domain_stage(self, session: ExploreSession, stage: str) -> None:
        ok = shared_tables.set_domain_stage(
            self._settings, self._tracker, session.domain_id, stage, online=True
        )
        if not ok:
            logger.debug("领域 %s stage=%s 直写跳过/失败（会话 %s）", session.domain_id, stage, session.session_id)

    def _cleanup_expired(self) -> None:
        now = time.monotonic()
        with self._lock:
            # 1) TTL 过期：直接移除
            expired = [
                sid for sid, s in self._sessions.items() if now - s.created_at > SESSION_TTL_S
            ]
            for sid in expired:
                self._sessions.pop(sid, None)
                self._threads.pop(sid, None)
            # 2) waiting_name_confirm 超时：标记 failed 后移除（避免永久挂起）
            stale_confirm = [
                sid for sid, s in self._sessions.items()
                if s.status == "waiting_name_confirm"
                and now - s.updated_at > WAITING_NAME_CONFIRM_TIMEOUT_S
            ]
            for sid in stale_confirm:
                s = self._sessions.pop(sid, None)
                self._threads.pop(sid, None)
                if s is not None:
                    s.status = "failed"
                    s.error = f"名称确认超时（{WAITING_NAME_CONFIRM_TIMEOUT_S // 60} 分钟无操作）"
                    logger.warning("探索会话 %s 名称确认超时，自动标记 failed", sid)
