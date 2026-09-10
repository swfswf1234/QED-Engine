"""领域探索五态门面（5端点）：前端统一入口，委托 8901 原生任务链。

设计关联（DesignRef）：docs/design/downloads-flow.md
实现状态：Current

五态机：未开始→已生成→探索中→待确认→已完成（失败=异常态可重试）。
写点策略（PLAN-034 §3 终态写点矩阵）：任务链写点由 8901 原生完成——
  - domain_explore 任务成功 → 已生成（raw/{id}/domains.json 落盘）
  - POST /domains/{id}/confirm → 探索中（异步提交 courses@v8）
  - domain_explore_courses 任务成功 → 待确认（raw/{id}/courses.json 落盘）
  - POST /domains/{id}/apply-results → 已完成
8900 门面职责：透传 + 登记 task_id + 桥接唯一原生缺口（courses.json →
课程行：apply-results 只删不建）+ explore_pending 合成与降级直写。

端点：
- POST /domains/{domainId}/explore-knowledge：提交领域探索任务（→探索中，202）
- POST /domains/{domainId}/confirm-domain：确认领域（已生成→探索中；名称确认重提）
- POST /domains/{domainId}/confirm-knowledge：确认课程（待确认→已完成）
- POST /courses/{courseId}/explore-knowledge：课程探索（explore-sessions 通道）
- GET /domains/{domainId}/explore-status：领域探索状态轮询
"""

import json
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from qed_engine.clients.tracker_client import TrackerClient, TrackerError
from qed_engine.services import shared_tables
from qed_engine.services.shared_tables import (
    STAGE_COMPLETED,
    STAGE_GENERATED,
    STAGE_NOT_STARTED,
    STAGE_PENDING,
    STAGE_RUNNING,
)

logger = logging.getLogger("qed_engine.domain_explore")

router = APIRouter(prefix="/api/v1", tags=["domain-explore"])


class ExploreKnowledgeBody(BaseModel):
    """领域/课程探索请求体（mode 跟随 8901 任务契约；ref 字段仅会话通道使用）。"""

    mode: str = "direct"  # direct | web | text | doc


class ConfirmDomainBody(BaseModel):
    """确认领域请求体：名称确认挂起时可携带修正后的领域名。"""

    name: str | None = None


class ConfirmKnowledgeBody(BaseModel):
    """确认课程请求体：selected 为选中课程的 course_id/名称键；缺省=全部保留。"""

    selected: list[str] | None = None


def _upstream_error(exc: TrackerError) -> HTTPException:
    """TrackerError → HTTPException：上游状态码透传，连接失败按 502。"""
    status = exc.status_code if (exc.status_code and exc.status_code >= 400) else 502
    detail = exc.detail if exc.detail else str(exc)
    return HTTPException(status_code=status, detail=str(detail))


def _is_connection_failure(exc: TrackerError) -> bool:
    return exc.status_code is None


def _get_domain(settings, client: TrackerClient, domain_id: str) -> dict | None:
    """读领域行：在线走 8901，连接失败降级共享表（同一 MySQL，PLAN-022 D1 双链路）。"""
    try:
        for row in client.list_domains():
            if str(row.get("domain_id", "")) == domain_id:
                return row
        return None
    except TrackerError as exc:
        if not _is_connection_failure(exc):
            raise
        logger.info("8901 不可达，领域读取降级共享表：%s", exc)
        return shared_tables.get_domain(settings, domain_id)


def _parse_pending(domain: dict) -> dict | None:
    """explore_pending 归一：8901 返回 dict / 共享表返回 JSON 字符串。"""
    raw = domain.get("explore_pending")
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except ValueError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def _read_courses_file(settings, domain_id: str) -> list[dict]:
    """读共享数据根 raw/{domain_id}/courses.json（ARCH-019 共享布局，PLAN-022 认可）。

    8901 原生任务链在「待确认」时不写 explore_pending，课程清单以此文件为事实源；
    文件缺失/损坏返回 []（调用方转 409 提示）。
    """
    path = settings.data_root_path / "raw" / domain_id / "courses.json"
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        logger.warning("courses.json 读取失败（%s）：%s", path, exc)
        return []
    if isinstance(data, dict):
        courses = data.get("courses") or []
    elif isinstance(data, list):
        courses = data
    else:
        courses = []
    return [c for c in courses if isinstance(c, dict) and (c.get("name") or c.get("course_id"))]


def _course_key(course: dict) -> str:
    """课程选择键：course_id 优先，退回名称（与 courses.json 条目一一对应）。"""
    return str(course.get("course_id") or course.get("name") or "")


def _register_task(request: Request, domain_id: str, task_id: str) -> None:
    registry = getattr(request.app.state, "domain_explore_tasks", None)
    if registry is not None:
        registry[domain_id] = task_id


@router.post("/domains/{domain_id}/explore-knowledge", status_code=202)
async def explore_domain_knowledge(
    domain_id: str,
    body: ExploreKnowledgeBody,
    request: Request,
) -> dict:
    """提交领域探索任务（未开始/失败/已生成 → 探索中）。

    委托 8901 原生 domain_explore 任务：管线成功写 domains.json + 已生成；
    名称冲突挂起待确认 + name_confirmation；管线错误写待确认 + error。
    """
    settings = request.app.state.settings
    client: TrackerClient = request.app.state.tracker_client
    domain = _get_domain(settings, client, domain_id)
    if domain is None:
        raise HTTPException(status_code=404, detail=f"领域不存在：{domain_id}")
    if domain.get("exploration_stage") == STAGE_RUNNING:
        raise HTTPException(status_code=409, detail=f"领域正在探索中：{domain_id}")
    try:
        result = client.submit_task("domain_explore", {"domain_id": domain_id, "mode": body.mode})
    except TrackerError as exc:
        raise _upstream_error(exc) from exc
    task_id = str(result.get("task_id", ""))
    _register_task(request, domain_id, task_id)
    # 提交即置探索中（任务成功后由 8901 写已生成）
    shared_tables.set_domain_stage(settings, client, domain_id, STAGE_RUNNING, online=True)
    return {
        "domain_id": domain_id,
        "task_id": task_id,
        "exploration_stage": STAGE_RUNNING,
        "message": "领域探索任务已提交",
    }


@router.post("/domains/{domain_id}/confirm-domain", status_code=202)
async def confirm_domain_info(
    domain_id: str,
    body: ConfirmDomainBody,
    request: Request,
) -> dict:
    """确认领域（已生成→探索中；名称确认挂起时改名并重提探索任务）。

    在线：透传 8901 原生 confirm（upsert domain + 异步 courses@v8 任务）。
    连接失败降级：仅推进状态到探索中（离线导入路径的待确认数据已在
    explore_pending.import_courses，由 confirm-knowledge 离线收口）。
    """
    settings = request.app.state.settings
    client: TrackerClient = request.app.state.tracker_client
    domain = _get_domain(settings, client, domain_id)
    if domain is None:
        raise HTTPException(status_code=404, detail=f"领域不存在：{domain_id}")
    pending = _parse_pending(domain)
    if pending and pending.get("kind") == "name_confirmation":
        # 名称确认：改名（可选）后重提领域探索任务
        new_name = (body.name or "").strip()
        if new_name and new_name != domain.get("name"):
            try:
                client.update_domain(domain_id, name=new_name)
            except TrackerError as exc:
                raise _upstream_error(exc) from exc
        try:
            result = client.submit_task("domain_explore", {"domain_id": domain_id, "mode": "direct"})
        except TrackerError as exc:
            raise _upstream_error(exc) from exc
        task_id = str(result.get("task_id", ""))
        _register_task(request, domain_id, task_id)
        shared_tables.set_domain_stage(settings, client, domain_id, STAGE_RUNNING, online=True)
        return {
            "domain_id": domain_id,
            "task_id": task_id,
            "exploration_stage": STAGE_RUNNING,
            "message": "名称已确认，重新提交领域探索",
        }
    if domain.get("exploration_stage") != STAGE_GENERATED:
        raise HTTPException(
            status_code=409,
            detail=f"领域处于 {domain.get('exploration_stage')}，仅「已生成」可确认领域",
        )
    try:
        result = client.confirm_domain(domain_id)
    except TrackerError as exc:
        if _is_connection_failure(exc):
            logger.info("8901 不可达，确认领域降级为直写探索中：%s", exc)
            shared_tables.set_domain_stage(settings, client, domain_id, STAGE_RUNNING, online=True)
            return {
                "domain_id": domain_id,
                "task_id": None,
                "exploration_stage": STAGE_RUNNING,
                "degraded": True,
                "message": "8901 不可达：状态已推进，课程生成任务未提交",
            }
        raise _upstream_error(exc) from exc
    task_id = str((result or {}).get("task_id", ""))
    _register_task(request, domain_id, task_id)
    return {
        "domain_id": domain_id,
        "task_id": task_id,
        "exploration_stage": STAGE_RUNNING,
        "message": "领域信息已确认，课程探索任务已提交",
    }


@router.post("/domains/{domain_id}/confirm-knowledge")
async def confirm_course_knowledge(
    domain_id: str,
    body: ConfirmKnowledgeBody,
    request: Request,
) -> dict:
    """确认课程（待确认→已完成）：唯一「已完成」收口写点。

    双分支：
    - import_courses（离线导入挂起）→ 共享表 commit_import_courses（建行+清 pending+已完成）
    - 原生待确认 → 桥接 courses.json→课程行（apply-results 只删不建）→ apply-results
      （selected 缺省全选；未选课程行由 8901 级联删除）
    """
    settings = request.app.state.settings
    client: TrackerClient = request.app.state.tracker_client
    domain = _get_domain(settings, client, domain_id)
    if domain is None:
        raise HTTPException(status_code=404, detail=f"领域不存在：{domain_id}")
    pending = _parse_pending(domain)
    if pending and pending.get("kind") == "import_courses":
        result = shared_tables.commit_import_courses(settings, domain_id)
        if result is None:
            raise HTTPException(
                status_code=409,
                detail="导入课程确认失败：共享表不可写或无待确认课程",
            )
        return {
            "domain_id": domain_id,
            "ok": True,
            "exploration_stage": STAGE_COMPLETED,
            "applied": result.get("committed", 0),
            "message": "导入课程已确认",
        }
    if domain.get("exploration_stage") != STAGE_PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"领域处于 {domain.get('exploration_stage')}，仅「待确认」可确认课程",
        )
    courses = (pending or {}).get("courses") if (pending or {}).get("kind") == "review_results" else None
    if not courses:
        courses = _read_courses_file(settings, domain_id)
    if not courses:
        raise HTTPException(
            status_code=409,
            detail="课程清单不可用（courses.json 缺失或为空），请重新确认领域生成",
        )
    selected_keys = {str(item) for item in (body.selected or [])}
    if selected_keys:
        to_apply = [c for c in courses if _course_key(c) in selected_keys]
    else:
        to_apply = courses
    if not to_apply:
        raise HTTPException(status_code=409, detail="选中课程与待确认清单不匹配")

    # 桥接：已存在的同名课程更新，缺失的建行（幂等；apply-results 只删不建）
    existing: dict[str, dict] = {}
    try:
        for entry in client.list_courses_system():
            if str(entry.get("domain_id", "")) != domain_id:
                continue
            for row in entry.get("courses") or []:
                if row.get("name"):
                    existing[str(row["name"])] = row
    except TrackerError as exc:
        if not _is_connection_failure(exc):
            raise _upstream_error(exc) from exc
        logger.info("8901 不可达，桥接跳过在线课程对账：%s", exc)

    applied_names: list[str] = []
    for course in to_apply:
        name = str(course.get("name") or "")
        if not name:
            continue
        try:
            if name in existing:
                client.update_course(
                    str(existing[name].get("course_id", "")),
                    description=str(course.get("description") or course.get("summary") or ""),
                    stage=str(course.get("stage") or ""),
                    track=str(course.get("track") or ""),
                )
            else:
                client.create_course_for_domain(
                    domain_id,
                    name=name,
                    stage=str(course.get("stage") or "") or None,
                    sort_order=int(course.get("tier", 0) or 0),
                    description=str(course.get("description") or course.get("summary") or ""),
                    aliases=[str(a) for a in (course.get("aliases") or [])],
                    track=str(course.get("track") or ""),
                    prerequisites=[str(p) for p in (course.get("prerequisites") or [])],
                )
            applied_names.append(name)
        except TrackerError as exc:
            raise _upstream_error(exc) from exc

    try:
        client.apply_domain_results(domain_id, [str(c.get("course_id") or c.get("name") or "") for c in to_apply])
    except TrackerError as exc:
        raise _upstream_error(exc) from exc
    return {
        "domain_id": domain_id,
        "ok": True,
        "exploration_stage": STAGE_COMPLETED,
        "applied": len(applied_names),
        "applied_courses": applied_names,
        "message": "课程名单已确认",
    }


@router.post("/courses/{course_id}/explore-knowledge", status_code=202)
async def explore_course_knowledge(
    course_id: str,
    body: ExploreKnowledgeBody,
    request: Request,
) -> dict:
    """课程探索（explore-sessions 通用通道）：创建课程探索会话（未开始→探索中）。"""
    manager = request.app.state.explore_sessions
    try:
        session = manager.create(
            target="course",
            mode=body.mode,
            course_id=course_id,
        )
    except Exception as exc:  # noqa: BLE001 - 会话创建失败统一 500
        raise HTTPException(status_code=500, detail=f"创建课程探索会话失败：{exc}") from exc
    return {
        "session_id": session.session_id,
        "status": session.status,
        "message": "课程探索已开始",
    }


@router.post("/courses/{course_id}/confirm")
async def confirm_course(
    course_id: str,
    request: Request,
) -> dict:
    """课程探索确认：将课程状态从 "待确认" 写为 "已完成"（PLAN-035）。"""
    settings = request.app.state.settings
    course = shared_tables.get_course(settings, course_id)
    if not course:
        raise HTTPException(status_code=404, detail=f"课程 {course_id} 不存在")
    
    current_stage = course.get("exploration_stage")
    if current_stage != STAGE_PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"当前状态 {current_stage}，需要 {STAGE_PENDING}",
        )
    
    ok = shared_tables.set_course_stage(settings, None, course_id, STAGE_COMPLETED, online=False)
    if not ok:
        raise HTTPException(status_code=500, detail="课程状态写入失败")
    
    return {
        "course_id": course_id,
        "ok": True,
        "exploration_stage": STAGE_COMPLETED,
        "message": "课程已确认完成",
    }


@router.get("/domains/{domain_id}/explore-status")
async def get_domain_explore_status(
    domain_id: str,
    request: Request,
) -> dict:
    """领域探索状态轮询：阶段 + 活跃任务 + 待确认载荷合成。

    explore_pending 来源优先级：库内值 > courses.json 合成（原生任务链成功时
    不写 pending，仅在待确认阶段从共享文件合成 review_results）。
    """
    settings = request.app.state.settings
    client: TrackerClient = request.app.state.tracker_client
    try:
        domain = _get_domain(settings, client, domain_id)
    except TrackerError as exc:
        raise _upstream_error(exc) from exc
    if domain is None:
        return {
            "domain_id": domain_id,
            "name": None,
            "exploration_stage": STAGE_NOT_STARTED,
            "active_session": False,
            "task_id": None,
            "explore_pending": None,
            "available": False,
        }
    stage = str(domain.get("exploration_stage") or STAGE_NOT_STARTED)
    pending = _parse_pending(domain)
    if not pending and stage == STAGE_PENDING:
        courses = _read_courses_file(settings, domain_id)
        if courses:
            pending = {"kind": "review_results", "courses": courses}
    registry = getattr(request.app.state, "domain_explore_tasks", {})
    return {
        "domain_id": domain_id,
        "name": domain.get("name"),
        "exploration_stage": stage,
        "active_session": stage == STAGE_RUNNING,
        "task_id": registry.get(domain_id),
        "explore_pending": pending,
        "available": True,
    }
