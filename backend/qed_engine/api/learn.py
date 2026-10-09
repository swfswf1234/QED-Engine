"""学习域路由（/api/v1/learn/*，32 端点）：主链 M-1 契约的 8900 自有域（非透传）。

模块职责：课程引用式注册（kind 闭集+双通道限长）、单元树两级草稿与人工位
（confirmed 两级确认 / covered 学习者独占）、编译作业（202+轮询，课程行自 carry）、
派生进度只读；M5 知识点体系（星图聚合、候选明细池、人工确认提升到共享主表）；
M6 章节目录层级（outline 行整树幂等替换、point 行归属移动、候选按章过滤）；M2 练习与复习（题源书目透传、批量入库幂等跳重、题面敏感列投影、作答同事务判分、间隔复习到期队列、错题本派生查询与人工位）。
错误包络：8900 自有校验=中文纯文本 detail（api-contracts 通用约定）。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_learn.py、tests/test_learn_knowledge.py、tests/test_learn_practice.py
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator
from qed_engine.services.learn.base import LearnConflict, LearnNotFound, fingerprint
from qed_engine.services.learn.knowledge import KP_TYPES, norm_key
from qed_engine.services.learn.practice import (
    ANSWER_SOURCES,
    ATTEMPT_ORIGINS,
    DEFAULT_MAX_TASKS,
    DIFFICULTIES,
    QUESTION_KINDS,
    QUESTION_TYPES,
    RETIRED_FILTERS,
    SCORE_TRENDS,
    SELF_RESULTS,
    SOURCE_KINDS,
    public_question,
)

logger = logging.getLogger("qed_engine.learn")

router = APIRouter(prefix="/api/v1/learn", tags=["learn"])

KINDS = ("book", "af_version", "knowledge")
UNIT_TYPES = ("text", "formula", "figure", "quiz", "flashcard")
CHANNEL_LIMIT = 4000
# 知识点两表懒挂载的重试窗口（DEFECT-009）
KNOWLEDGE_MOUNT_RETRY_SECONDS = 60.0
# 学习域三表懒挂载的重试窗口（同判例）
LEARN_MOUNT_RETRY_SECONDS = 60.0


class ResourceRef(BaseModel):
    kind: str
    ref_id: str
    label: str

    @field_validator("kind")
    @classmethod
    def _kind_closed(cls, v: str) -> str:
        if v not in KINDS:
            raise ValueError(f"kind 必须是 {KINDS} 之一")
        return v

    @field_validator("ref_id", "label")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("ref_id/label 不可为空")
        return v


class CoordinateRef(BaseModel):
    ref_id: str
    label: str = ""


class CourseCreateBody(BaseModel):
    name: str = Field(min_length=1)
    resources: list[ResourceRef] = Field(min_length=1)
    domain_ref: CoordinateRef | None = None
    course_ref: CoordinateRef | None = None
    direction: str = ""
    instructions: str = ""
    agent_notes: str = ""

    @field_validator("instructions", "agent_notes")
    @classmethod
    def _channel_limit(cls, v: str) -> str:
        if len(v) > CHANNEL_LIMIT:
            raise ValueError(f"通道超过限长 {CHANNEL_LIMIT}")
        return v


class CoursePatchBody(BaseModel):
    name: str | None = None
    domain_ref: CoordinateRef | None = None
    course_ref: CoordinateRef | None = None
    direction: str | None = None
    instructions: str | None = None
    agent_notes: str | None = None

    @field_validator("instructions", "agent_notes")
    @classmethod
    def _channel_limit(cls, v: str | None) -> str | None:
        if v is not None and len(v) > CHANNEL_LIMIT:
            raise ValueError(f"通道超过限长 {CHANNEL_LIMIT}")
        return v


class SyllabusBody(BaseModel):
    tree: list[dict[str, Any]] = Field(min_length=1)


class UnitPatchBody(BaseModel):
    """允许字段白名单（extra=forbid）：payload/type/gen_status 等永不开放给人工面。"""

    model_config = {"extra": "forbid"}

    title: str | None = None
    order: int | None = None
    confirmed: bool | None = None
    covered: bool | None = None


class ProposeBody(BaseModel):
    page_windows: list[dict[str, int]] = Field(min_length=1)


class ProgressBody(BaseModel):
    unit_id: str
    status: Literal["done", "skipped", "pending"]


def _store(request: Request) -> Any:
    store = getattr(request.app.state, "learn_store", None)
    if store is None:
        store = _mount_learn_store(request.app)
    if store is None:
        raise HTTPException(status_code=503, detail="学习域存储不可用（数据库离线且无注入存储）")
    return store


def _mount_learn_store(app: Any) -> Any | None:
    """学习域三表懒接入：首个 /learn 课程请求幂等建表并挂载（判例 DEFECT-009 知识点两表）。

    启动路径不触碰 MySQL（隔离铁律：测试 create_app 不连真实库）；未配置密码直接降级。
    建表失败只锁 `LEARN_MOUNT_RETRY_SECONDS` 秒：MySQL 瞬断恢复后无需重启进程即可自愈。
    """
    store = getattr(app.state, "learn_store", None)
    if store is not None:
        return store
    settings = app.state.settings
    if not settings.qed_db_password.get_secret_value():
        return None
    if time.monotonic() < getattr(app.state, "learn_store_retry_after", 0.0):
        return None
    from qed_engine.services.learn import base as learn_store_module

    try:
        learn_store_module.ensure_tables(settings)
    except Exception as exc:  # noqa: BLE001 - 数据库不可达：短窗降级，不阻塞其他端点
        app.state.learn_store_retry_after = time.monotonic() + LEARN_MOUNT_RETRY_SECONDS
        logger.warning(
            "学习域三表建表跳过（数据库不可达），%.0fs 后重试：%s",
            LEARN_MOUNT_RETRY_SECONDS,
            type(exc).__name__,
        )
        return None
    app.state.learn_store_retry_after = 0.0
    app.state.learn_store = learn_store_module.MySQLLearnStore(settings)
    return app.state.learn_store


def _guard(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except LearnNotFound as exc:
        raise HTTPException(status_code=404, detail=f"学习域实体不存在：{exc}") from exc
    except LearnConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


def _derived(store, course_id: str, course: dict[str, Any]) -> dict[str, Any]:
    prog = store.derived_progress(course_id)
    if course["compile_status"] == "running":
        status = "compiling"
    elif prog["completed"]:
        status = "completed"
    elif prog["done"] or course["compile_status"] == "completed":
        status = "learning"
    else:
        status = "draft"
    return {"status": status, **prog}


def _course_out(store, course_id: str, course: dict[str, Any]) -> dict[str, Any]:
    units = store.list_units(course_id)
    return {**course, "derived": _derived(store, course_id, course), "unit_count": len(units)}


@router.get("/courses")
def list_courses(request: Request) -> dict[str, Any]:
    store = _store(request)
    return {"courses": [_course_out(store, c["learn_course_id"], c) for c in store.list_courses()]}


@router.post("/courses")
def create_course(request: Request, body: CourseCreateBody) -> dict[str, Any]:
    store = _store(request)
    course = _guard(store.create_course, name=body.name, resources=[r.model_dump() for r in body.resources], **{
        k: v for k, v in body.model_dump(exclude={"name", "resources"}).items()
    })
    return _course_out(store, course["learn_course_id"], course)


@router.get("/courses/{course_id}")
def get_course(request: Request, course_id: str) -> dict[str, Any]:
    store = _store(request)
    course = _guard(store.get_course, course_id)
    return _course_out(store, course_id, course)


@router.patch("/courses/{course_id}")
def patch_course(request: Request, course_id: str, body: CoursePatchBody) -> dict[str, Any]:
    store = _store(request)
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    course = _guard(store.update_course, course_id, **fields)
    return _course_out(store, course_id, course)


@router.delete("/courses/{course_id}")
def delete_course(request: Request, course_id: str) -> dict[str, Any]:
    store = _store(request)
    course = _guard(store.get_course, course_id)
    if course["compile_status"] == "running":
        raise HTTPException(status_code=409, detail="编译在跑，禁止删除课程")
    _guard(store.delete_course, course_id)
    return {"deleted": course_id}


@router.get("/courses/{course_id}/units")
def list_units(
    request: Request, course_id: str, level: Literal["section", "unit"] | None = Query(default=None)
) -> dict[str, Any]:
    store = _store(request)
    course = _guard(store.get_course, course_id)
    rows = _guard(store.list_units, course_id, level)
    drift = bool(
        course["page_windows"]
        and course["compile_fingerprint"]
        and course["compile_fingerprint"] != fingerprint(course["page_windows"], course["resources"])
    )
    return {
        "units": [
            {**{k: v for k, v in r.items() if k != "sort_index"}, "drift": drift and r["level"] == "unit" and r["active"]}
            for r in rows
        ]
    }


@router.get("/units/{unit_id}")
def get_unit(request: Request, unit_id: str) -> dict[str, Any]:
    store = _store(request)
    return _guard(store.get_unit, unit_id)


def _validate_tree(nodes: list[Any], depth: int = 1) -> None:
    for node in nodes:
        if not isinstance(node, dict) or not str(node.get("title") or "").strip():
            raise HTTPException(status_code=422, detail="节点必须含非空 title")
        node_type = node.get("type")
        if node_type is not None and node_type not in UNIT_TYPES:
            raise HTTPException(status_code=422, detail=f"type 必须是 {UNIT_TYPES} 之一")
        children = node.get("children")
        if children is not None:
            if not isinstance(children, list):
                raise HTTPException(status_code=422, detail="children 必须为列表")
            if depth >= 3:
                raise HTTPException(status_code=422, detail="单元树最深三级（section→unit→block）")
            _validate_tree(children, depth + 1)


@router.put("/courses/{course_id}/syllabus")
def replace_syllabus(request: Request, course_id: str, body: SyllabusBody) -> dict[str, Any]:
    store = _store(request)
    _guard(store.get_course, course_id)
    _validate_tree(body.tree)
    _guard(store.replace_tree, course_id, body.tree)
    return {"tree": body.tree, "unit_count": len(store.list_units(course_id))}


@router.patch("/units/{unit_id}")
def patch_unit(request: Request, unit_id: str, body: UnitPatchBody) -> dict[str, Any]:
    store = _store(request)
    fields = {k: getattr(body, k) for k in body.model_fields_set}
    unit = _guard(store.patch_unit, unit_id, **fields)
    return unit


@router.post("/courses/{course_id}/compile/propose")
def propose(request: Request, course_id: str, body: ProposeBody) -> dict[str, Any]:
    store = _store(request)
    for window in body.page_windows:
        if not isinstance(window.get("start"), int) or not isinstance(window.get("end"), int):
            raise HTTPException(status_code=422, detail="page_windows 每项必须含整数 start/end")
        if window["start"] < 1 or window["end"] < window["start"]:
            raise HTTPException(status_code=422, detail="page_windows 范围非法（start≥1 且 end≥start）")
    course = _guard(store.get_course, course_id)
    _guard(
        store.update_course,
        course_id,
        compile_status="proposed",
        page_windows=body.page_windows,
        compile_fingerprint=fingerprint(body.page_windows, course["resources"]),
    )
    return {"compile_status": "proposed", "page_windows": body.page_windows}


@router.post("/courses/{course_id}/compile/start", status_code=202)
def compile_start(request: Request, course_id: str) -> dict[str, Any]:
    """两级确认齐备后受理编译：202 + 轮询（api-contracts 通用发起语义）；骨架编译=静态兜底出块。"""
    store = _store(request)
    _guard(store.start_compile, course_id)

    def _run() -> None:
        try:
            store.finish_compile(course_id)
        except Exception:  # noqa: BLE001 - 骨架线程兜底，失败态由计数体现
            pass

    threading.Thread(target=_run, daemon=True).start()
    return {"compile_status": "running", "learn_course_id": course_id}


@router.get("/courses/{course_id}/compile")
def compile_status(request: Request, course_id: str) -> dict[str, Any]:
    store = _store(request)
    course = _guard(store.get_course, course_id)
    return {
        "compile_status": course["compile_status"],
        "done": course["compile_done"],
        "total": course["compile_total"],
        "failure_count": course["failure_count"],
    }


@router.get("/courses/{course_id}/progress")
def get_progress(request: Request, course_id: str) -> dict[str, Any]:
    store = _store(request)
    _guard(store.get_course, course_id)
    return store.derived_progress(course_id)


@router.post("/courses/{course_id}/progress")
def set_progress(request: Request, course_id: str, body: ProgressBody) -> dict[str, Any]:
    store = _store(request)
    row = _guard(store.set_progress, course_id, body.unit_id, body.status)
    return {**row, "derived": store.derived_progress(course_id)}


# ---------- M5：知识点体系与知识梳理星图（qed_knowledge_point / qed_learn_kp_detail） ----------

DETAIL_STATUSES = ("draft", "candidate", "adopted", "rejected")
OPEN_STATUSES = ("draft", "candidate")
UNSORTED_TRACK = "未归类"


class DetailCreateBody(BaseModel):
    """候选明细登记（生成管线/人工共用写面；confirmed 与提升只能走 confirm）。"""

    course_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    domain_id: str = ""
    course_label: str = ""
    domain_label: str = ""
    narrative: str = ""
    type: str | None = None
    payload: dict[str, Any] | None = None
    anchors: list[dict[str, Any]] | None = None
    gen_batch: str = ""
    map_seed: str | None = None
    model_ref: str = ""
    dedup_of: str | None = None
    gen_status: Literal["draft", "candidate"] = "candidate"
    parent_kp_id: str | None = None
    intent: Literal["summary", "explanation"] = "explanation"
    book_ref: str = ""

    @field_validator("type")
    @classmethod
    def _type_closed(cls, v: str | None) -> str | None:
        if v is not None and v not in KP_TYPES:
            raise ValueError(f"type 必须是 {KP_TYPES} 之一")
        return v


class OutlineTreeBody(BaseModel):
    """目录整树写入（人工确认后的章/节树；页范围＝PDF 页序）。"""

    book_ref: str = Field(min_length=1)
    tree: list[dict[str, Any]] = Field(min_length=1)


class PointPatchBody(BaseModel):
    """知识点改列白名单（extra=forbid）：归属、展示名与顺序提示，不开放 confirmed/type。"""

    model_config = {"extra": "forbid"}

    parent_kp_id: str | None = None
    name: str | None = Field(default=None, min_length=1)
    order_hint: int | None = None


def _validate_outline_tree(nodes: list[Any], depth: int = 1) -> None:
    if depth > 2:
        raise HTTPException(status_code=422, detail="目录树最深两级（章→节）")
    # 主表 (course_id, book_ref, norm_key) 只有普通索引（DEFECT-011），重名去重由本校验承载
    seen: set[str] = set()
    for node in nodes:
        if not isinstance(node, dict) or not str(node.get("name") or "").strip():
            raise HTTPException(status_code=422, detail="目录节点必须含非空 name")
        key = norm_key(str(node["name"]))
        if key in seen:
            raise HTTPException(status_code=422, detail="同一父级下目录节点重名（同名节须挂不同章）")
        seen.add(key)
        start, end = node.get("page_start"), node.get("page_end")
        if not isinstance(start, int) or not isinstance(end, int):
            raise HTTPException(status_code=422, detail="目录节点必须含整数 page_start/page_end")
        if start < 1 or end < start:
            raise HTTPException(status_code=422, detail="页范围非法（page_start≥1 且 page_end≥page_start）")
        children = node.get("children")
        if children is not None:
            if not isinstance(children, list):
                raise HTTPException(status_code=422, detail="children 必须为列表")
            # 叶节点常以 children=[] 显式提交（前端目录面板口径），空列表不下探，否则深度虚高
            if children:
                _validate_outline_tree(children, depth + 1)


def _knowledge(request: Request) -> Any:
    store = getattr(request.app.state, "knowledge_store", None)
    if store is None:
        store = _mount_knowledge_store(request.app)
    if store is None:
        raise HTTPException(status_code=503, detail="知识点存储未接入（数据库不可达或未配置）")
    return store


def _mount_knowledge_store(app: Any) -> Any | None:
    """知识点存储懒接入：首次请求幂等建两表并挂载（判例 qed_llm_calls）。

    启动路径不触碰 MySQL（隔离铁律：测试 create_app 不连真实库）；未配置密码直接降级。
    建表失败只锁 `KNOWLEDGE_MOUNT_RETRY_SECONDS` 秒（DEFECT-009）：MySQL 瞬断恢复后无需重启
    进程即可自愈，窗口内不重复打库（否则每请求吃一次建表超时）。
    """
    store = getattr(app.state, "knowledge_store", None)
    if store is not None:
        return store
    settings = app.state.settings
    if not settings.qed_db_password.get_secret_value():
        return None
    if time.monotonic() < getattr(app.state, "knowledge_store_retry_after", 0.0):
        return None
    from qed_engine.services.learn import knowledge as knowledge_store_module

    try:
        knowledge_store_module.ensure_tables(settings)
    except Exception as exc:  # noqa: BLE001 - 数据库不可达：短窗降级，不阻塞其他端点
        app.state.knowledge_store_retry_after = time.monotonic() + KNOWLEDGE_MOUNT_RETRY_SECONDS
        logger.warning(
            "知识点两表建表跳过（数据库不可达），%.0fs 后重试：%s",
            KNOWLEDGE_MOUNT_RETRY_SECONDS,
            type(exc).__name__,
        )
        return None
    app.state.knowledge_store_retry_after = 0.0
    app.state.knowledge_store = knowledge_store_module.MySQLKnowledgeStore(settings)
    return app.state.knowledge_store


def _catalog(request: Request) -> list[dict[str, Any]]:
    """领域课程体系快照（8901 透传；离线时 tracker_client 内部降级共享表直读）。"""
    try:
        return request.app.state.tracker_client.list_courses_system() or []
    except Exception as exc:  # noqa: BLE001 - 目录不可达由端点降级为 503/空态
        raise HTTPException(status_code=503, detail=f"课程目录不可达：{exc}") from exc


def _course_index(domains: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """course_id → 课程行（附 domain_id / domain_label）。"""
    index: dict[str, dict[str, Any]] = {}
    for domain in domains:
        for course in domain.get("courses") or []:
            course_id = str(course.get("course_id") or "")
            if not course_id or course_id in index:
                continue
            index[course_id] = {
                **course,
                "domain_id": domain.get("domain_id") or course.get("domain_id") or "",
                "domain_label": domain.get("name") or "",
            }
    return index


def _point_out(point: dict[str, Any]) -> dict[str, Any]:
    out = dict(point)
    out["anchors"] = out.get("anchors") or []
    out["confirmed"] = bool(out.get("confirmed"))
    return out


def _candidate_out(detail: dict[str, Any]) -> dict[str, Any]:
    return {
        "detail_id": detail["detail_id"],
        "name": detail["name"],
        "type": detail.get("type"),
        "intent": detail.get("intent") or "explanation",
        "parent_kp_id": detail.get("parent_kp_id"),
        "narrative": detail.get("narrative") or "",
        "payload": detail.get("payload") or {},
        "anchors": detail.get("anchors") or [],
        "gen_batch": detail.get("gen_batch") or "",
        "model_ref": detail.get("model_ref") or "",
        "gen_status": detail["gen_status"],
    }


@router.get("/star-map")
def star_map(request: Request, domain: str | None = Query(default=None)) -> dict[str, Any]:
    """星图一次取全：领域 → track 星云 → 课程节点（含知识点计数）+ 先修边（标跨 track）。

    数据源＝qed_domain/qed_course（既有），不依赖 M5 新表；存储未接入时计数留 0。
    """
    domains = _catalog(request)
    if domain is not None:
        domains = [d for d in domains if d.get("domain_id") == domain]
        if not domains:
            raise HTTPException(status_code=404, detail=f"领域不存在：{domain}")
    store = _mount_knowledge_store(request.app)
    counts = store.counts_by_course() if store is not None else {}
    known: dict[str, str] = {}
    out_domains: list[dict[str, Any]] = []
    for row in domains:
        track_kinds = {
            str(t.get("name") or ""): str(t.get("kind") or "other") for t in row.get("classic_tracks") or []
        }
        track_summaries = {str(t.get("name") or ""): str(t.get("summary") or "") for t in row.get("classic_tracks") or []}
        clusters: dict[str, dict[str, Any]] = {}
        for course in row.get("courses") or []:
            course_id = str(course.get("course_id") or "")
            if not course_id:
                continue
            known[course_id] = str(course.get("track") or "").strip() or UNSORTED_TRACK
            track_name = known[course_id]
            cluster = clusters.setdefault(
                track_name,
                {
                    "track": track_name,
                    "kind": track_kinds.get(track_name, "other"),
                    "summary": track_summaries.get(track_name, ""),
                    "courses": [],
                },
            )
            count = counts.get(course_id) or {}
            cluster["courses"].append(
                {
                    "course_id": course_id,
                    "name": course.get("name") or course_id,
                    "track": track_name,
                    "stage": course.get("stage") or "",
                    "sort_order": course.get("sort_order"),
                    "kp_confirmed": int(count.get("confirmed") or 0),
                    "kp_candidates": int(count.get("candidates") or 0),
                }
            )
        ordered = sorted(
            clusters.values(), key=lambda c: (-len(c["courses"]), c["track"])
        )
        for cluster in ordered:
            cluster["courses"].sort(key=lambda n: (n["sort_order"] if n["sort_order"] is not None else 9999, n["course_id"]))
        out_domains.append(
            {
                "domain_id": row.get("domain_id") or "",
                "name": row.get("name") or row.get("domain_id") or "",
                "level": row.get("level") or "",
                "tracks": ordered,
            }
        )
    edges: list[dict[str, Any]] = []
    for row in domains:
        for course in row.get("courses") or []:
            course_id = str(course.get("course_id") or "")
            for pre in course.get("prerequisites") or []:
                if str(pre) not in known:
                    continue
                edges.append(
                    {
                        "from": str(pre),
                        "to": course_id,
                        "domain_id": row.get("domain_id") or "",
                        "cross_track": known.get(str(pre)) != known.get(course_id),
                    }
                )
    edges.sort(key=lambda e: (e["from"], e["to"]))
    return {"domains": out_domains, "edges": edges}


@router.get("/knowledge-points")
def list_knowledge_points(
    request: Request,
    domain: str | None = Query(default=None),
    course: str | None = Query(default=None),
    type: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """已确认知识点跨课程检索（主表只存采纳结果）。"""
    if type is not None and type not in KP_TYPES:
        raise HTTPException(status_code=422, detail=f"type 必须是 {KP_TYPES} 之一")
    store = _knowledge(request)
    points, total = store.list_points(
        domain_id=domain, course_id=course, type=type, q=q, limit=limit, offset=offset
    )
    return {"points": [_point_out(p) for p in points], "total": total}


@router.get("/courses/{course_id}/knowledge-points")
def course_knowledge_points(
    request: Request, course_id: str, include_outline: bool = Query(default=False)
) -> dict[str, Any]:
    """某课程的知识点总览：已确认主数据 + 同 norm_key 的待选叙述（多版本并存）。

    默认只出 point 行（章名不进知识点列表）；`include_outline=true` 时带目录节点行。
    """
    store = _knowledge(request)
    course = _course_index(_catalog(request)).get(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail=f"课程不存在：{course_id}")
    points, total = store.list_points(
        course_id=course_id, kind=None if include_outline else "point", limit=500
    )
    candidates = [
        d for d in store.list_details(course_id=course_id, limit=1000) if d["gen_status"] in OPEN_STATUSES
    ]
    by_norm: dict[str, list[dict[str, Any]]] = {}
    for detail in candidates:
        by_norm.setdefault(detail["norm_key"], []).append(_candidate_out(detail))
    return {
        "course": {
            "course_id": course_id,
            "name": course.get("name") or course_id,
            "track": str(course.get("track") or "").strip() or UNSORTED_TRACK,
            "domain_id": course.get("domain_id") or "",
        },
        "points": [
            {**_point_out(point), "candidates": by_norm.get(point["norm_key"], [])} for point in points
        ],
        "total": total,
        "candidate_total": len(candidates),
    }


@router.get("/kp-details")
def list_kp_details(
    request: Request,
    course: str | None = Query(default=None),
    gen_status: str | None = Query(default=None),
    batch: str | None = Query(default=None),
    parent: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """候选明细池浏览（可按课程/状态/批次/所属章节过滤；`parent=none` 取未归档池）。"""
    if gen_status is not None and gen_status not in DETAIL_STATUSES:
        raise HTTPException(status_code=422, detail=f"gen_status 必须是 {DETAIL_STATUSES} 之一")
    store = _knowledge(request)
    rows = store.list_details(
        course_id=course,
        gen_status=gen_status,
        batch=batch,
        parent_kp_id=None if parent in (None, "none") else parent,
        unarchived=parent == "none",
        limit=1000,
    )
    return {"details": rows[offset : offset + limit], "total": len(rows)}


@router.post("/kp-details")
def create_kp_detail(request: Request, body: DetailCreateBody) -> dict[str, Any]:
    """候选明细登记：坐标标签从课程目录补齐（目录不可达时按入参快照落库）。"""
    store = _knowledge(request)
    fields = body.model_dump()
    try:
        course = _course_index(_catalog(request)).get(fields["course_id"]) or {}
    except HTTPException:
        course = {}
    fields["domain_id"] = fields["domain_id"] or str(course.get("domain_id") or "")
    fields["domain_label"] = fields["domain_label"] or str(course.get("domain_label") or "")
    fields["course_label"] = fields["course_label"] or str(course.get("name") or "")
    return store.add_detail(**fields)


@router.post("/kp-details/{detail_id}/confirm")
def confirm_kp_detail(request: Request, detail_id: str) -> dict[str, Any]:
    """人工确认并提升到共享主表；同课程重复 norm_key → 409（合并走 dedup_of）。"""
    store = _knowledge(request)
    point = _guard(store.confirm_detail, detail_id)
    return {"point": _point_out(point), "detail": store.get_detail(detail_id)}


@router.post("/kp-details/{detail_id}/reject")
def reject_kp_detail(request: Request, detail_id: str) -> dict[str, Any]:
    """候选驳回：不落主表，可重新登记新候选。"""
    store = _knowledge(request)
    return {"detail": _guard(store.reject_detail, detail_id)}


# ---------- M6：章节目录树（outline 行）与知识点归属 ----------


def _require_catalog_course(request: Request, course_id: str) -> dict[str, Any]:
    course = _course_index(_catalog(request)).get(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail=f"课程不存在：{course_id}")
    return course


@router.get("/courses/{course_id}/outline")
def get_outline(
    request: Request, course_id: str, book: str | None = Query(default=None)
) -> dict[str, Any]:
    """章节树一次取全（前序平铺 + 每节点本章知识点计数），左栏按 depth 缩进渲染。"""
    store = _knowledge(request)
    _require_catalog_course(request, course_id)
    return {
        "course_id": course_id,
        "book_ref": book or "",
        "outline": store.list_outline(course_id, book),
    }


@router.put("/courses/{course_id}/outline")
def put_outline(request: Request, course_id: str, body: OutlineTreeBody) -> dict[str, Any]:
    """目录确认后的整树写入：幂等替换同 book_ref 的 outline 子树，写入即 confirmed=1。

    point 行一律不删；其父 outline 被替换掉时归未归档池（parent_kp_id=NULL）。
    """
    store = _knowledge(request)
    _require_catalog_course(request, course_id)
    _validate_outline_tree(body.tree)
    result = _guard(store.replace_outline, course_id, body.book_ref, body.tree)
    return {**result, "book_ref": body.book_ref, "outline": store.list_outline(course_id, body.book_ref)}


@router.patch("/knowledge-points/{kp_id}")
def patch_knowledge_point(request: Request, kp_id: str, body: PointPatchBody) -> dict[str, Any]:
    """人工面移动与改名：只开放归属、展示名与顺序提示（确认位与四分类不走本端点）。"""
    store = _knowledge(request)
    row = _guard(store.get_point, kp_id)
    fields = {k: getattr(body, k) for k in body.model_fields_set}
    if "parent_kp_id" in fields:
        _validate_parent(store, row, fields["parent_kp_id"])
    moved = _guard(store.patch_point, kp_id, **fields)
    return _point_out(moved)


def _validate_parent(store: Any, row: dict[str, Any], parent_kp_id: str | None) -> None:
    if parent_kp_id is None:
        return
    if parent_kp_id == row["kp_id"]:
        raise HTTPException(status_code=422, detail="不能把节点挂到自己下面")
    parent = _guard(store.get_point, parent_kp_id)
    if parent["node_kind"] != "outline":
        raise HTTPException(status_code=422, detail="只能挂在目录节点（章/节）下")
    if row["node_kind"] == "outline":
        cursor: dict[str, Any] = parent
        seen = {row["kp_id"]}
        while cursor.get("parent_kp_id"):
            if cursor["parent_kp_id"] in seen:
                raise HTTPException(status_code=422, detail="目录层级成环")
            seen.add(cursor["parent_kp_id"])
            cursor = _guard(store.get_point, cursor["parent_kp_id"])


# ---------- M2：练习与复习（qed_learn_question / qed_learn_attempt / qed_learn_review_task） ----------

# 练习域三表懒挂载的重试窗口（同判例 DEFECT-009）
PRACTICE_MOUNT_RETRY_SECONDS = 60.0
# 题源书目的可用角色（R-11 宽容读：qt_books.roles 数组含其一即认）
QUESTION_BOOK_ROLES = ("textbook", "exercises", "solutions")
# 三态过滤位取值（resolved / bookmarked / retired 共用；all=不过滤）
TRI_STATE_FILTERS = ("true", "false", "all")


def _enum_or_422(value: str | None, allowed: tuple[str, ...], label: str) -> None:
    """查询面闭集校验：None 表示不过滤，其余非闭集值一律 422。"""
    if value is not None and value not in allowed:
        raise HTTPException(status_code=422, detail=f"{label} 必须是 {allowed} 之一")


def _question_invariant_error(row: dict[str, Any]) -> str | None:
    """题面不变量单点判定（入库与改列共用）：违规返回说明，合规返回 None。

    裁决 ⑨＝`answer_source=none` 的题只能作 flashcard 自评（无答案不阻塞入库，也不进判分路径）。
    """
    if not str(row.get("stem") or "").strip():
        return "stem 不可为空"
    kind = row.get("kind") or "quiz"
    if kind == "quiz":
        if row.get("question_type") not in QUESTION_TYPES:
            return f"quiz 题的 question_type 必须是 {QUESTION_TYPES} 之一"
        if row.get("answer_source") == "none":
            return "answer_source=none 的题只能作 flashcard 自评（裁决 ⑨）"
        if not str(row.get("expected_answer") or "").strip():
            return "quiz 题必须有 expected_answer"
        if row.get("question_type") == "choice":
            labels = sorted(str((o or {}).get("label") or "").strip().upper() for o in row.get("options") or [])
            if labels != ["A", "B", "C", "D"]:
                return "choice 题的 options 必须是标签 A/B/C/D 恰好四项"
        if row.get("question_type") == "open" and not (row.get("keywords") or []):
            return "open 题必须有 keywords 关键词表"
    if kind == "flashcard" and not str(row.get("answer_back") or "").strip():
        return "flashcard 必须有背面内容 answer_back"
    return None


class QuestionItemBody(BaseModel):
    """入库项：结构闭集与裁决 ⑨ 在 API 面校验（缝 5 输入面；store 只兜空题干）。"""

    stem: str
    kind: str = "quiz"
    question_type: str | None = None
    options: list[dict[str, Any]] | None = None
    expected_answer: str | None = None
    keywords: list[str] | None = None
    explanation: str = ""
    answer_back: str = ""
    difficulty: str = "medium"
    kp_type: str | None = None
    source_kind: str = "exercise_book"
    answer_source: str = "none"
    book_ref: str = ""
    source_ref: dict[str, Any] | None = None
    kp_id: str | None = None
    unit_id: str | None = None
    course_label: str = ""
    meta: dict[str, Any] | None = None

    @field_validator("kind", "question_type", "difficulty", "source_kind", "answer_source", "kp_type")
    @classmethod
    def _closed_sets(cls, v: str | None, info: ValidationInfo) -> str | None:
        allowed = {
            "kind": QUESTION_KINDS,
            "question_type": QUESTION_TYPES,
            "difficulty": DIFFICULTIES,
            "source_kind": SOURCE_KINDS,
            "answer_source": ANSWER_SOURCES,
            "kp_type": KP_TYPES,
        }[info.field_name]
        if v is not None and v not in allowed:
            raise ValueError(f"{info.field_name} 必须是 {allowed} 之一")
        return v

    @model_validator(mode="after")
    def _invariants(self) -> QuestionItemBody:
        error = _question_invariant_error(self.model_dump())
        if error:
            raise ValueError(error)
        return self


class QuestionBatchBody(BaseModel):
    """批量入库请求体：一批一 `gen_batch`（抽取批次号），整批同事务（缝 6）。"""

    course_id: str = Field(min_length=1)
    gen_batch: str = ""
    model_ref: str = ""
    learn_course_id: str | None = None
    questions: list[QuestionItemBody] = Field(min_length=1)


class QuestionPatchBody(BaseModel):
    """题行人工面白名单（extra=forbid）：`gen_batch`/`model_ref`/`stem_hash`/`course_id` 等
    产出事实不可改；`answer_back` 随裁决 ⑨ 的升级路径开放（壳列表的补列）。"""

    model_config = {"extra": "forbid"}

    kind: str | None = None
    question_type: str | None = None
    stem: str | None = None
    options: list[dict[str, Any]] | None = None
    expected_answer: str | None = None
    keywords: list[str] | None = None
    explanation: str | None = None
    answer_back: str | None = None
    difficulty: str | None = None
    kp_id: str | None = None
    answer_source: str | None = None
    retired: bool | None = None

    @field_validator("kind", "question_type", "difficulty", "answer_source")
    @classmethod
    def _closed_sets(cls, v: str | None, info: ValidationInfo) -> str | None:
        allowed = {
            "kind": QUESTION_KINDS,
            "question_type": QUESTION_TYPES,
            "difficulty": DIFFICULTIES,
            "answer_source": ANSWER_SOURCES,
        }[info.field_name]
        if v is not None and v not in allowed:
            raise ValueError(f"{info.field_name} 必须是 {allowed} 之一")
        return v


class AttemptBody(BaseModel):
    """作答提交体：`origin` 闭集，`review_date` 与唯一键 (question_id, review_date, origin) 同义。"""

    question_id: str = Field(min_length=1)
    user_answer: str
    origin: str = "new"
    review_date: datetime | None = None
    self_result: str | None = None

    @field_validator("user_answer")
    @classmethod
    def _answer_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("user_answer 不可为空")
        return v

    @field_validator("origin")
    @classmethod
    def _origin_closed(cls, v: str) -> str:
        if v not in ATTEMPT_ORIGINS:
            raise ValueError(f"origin 必须是 {ATTEMPT_ORIGINS} 之一")
        return v

    @field_validator("self_result")
    @classmethod
    def _self_result_closed(cls, v: str | None) -> str | None:
        if v is not None and v not in SELF_RESULTS:
            raise ValueError(f"self_result 必须是 {SELF_RESULTS} 之一")
        return v


class AttemptPatchBody(BaseModel):
    """错题本人工位白名单（extra=forbid）：判分结果列（is_correct/method/score_trend）不可手改。"""

    model_config = {"extra": "forbid"}

    bookmarked: bool | None = None
    resolved: bool | None = None


def _practice(request: Request) -> Any:
    store = getattr(request.app.state, "practice_store", None)
    if store is None:
        store = _mount_practice_store(request.app)
    if store is None:
        raise HTTPException(status_code=503, detail="练习域存储未接入（数据库不可达或未配置）")
    return store


def _mount_practice_store(app: Any) -> Any | None:
    """练习域三表懒接入：首个练习请求幂等建表并挂载（判例 DEFECT-009 知识点两表）。

    启动路径不触碰 MySQL（隔离铁律：测试 create_app 不连真实库）；未配置密码直接降级。
    建表失败只锁 `PRACTICE_MOUNT_RETRY_SECONDS` 秒：MySQL 瞬断恢复后无需重启进程即可自愈。
    """
    store = getattr(app.state, "practice_store", None)
    if store is not None:
        return store
    settings = app.state.settings
    if not settings.qed_db_password.get_secret_value():
        return None
    if time.monotonic() < getattr(app.state, "practice_store_retry_after", 0.0):
        return None
    from qed_engine.services.learn import practice as practice_store_module

    try:
        practice_store_module.ensure_tables(settings)
    except Exception as exc:  # noqa: BLE001 - 数据库不可达：短窗降级，不阻塞其他端点
        app.state.practice_store_retry_after = time.monotonic() + PRACTICE_MOUNT_RETRY_SECONDS
        logger.warning(
            "练习域三表建表跳过（数据库不可达），%.0fs 后重试：%s",
            PRACTICE_MOUNT_RETRY_SECONDS,
            type(exc).__name__,
        )
        return None
    app.state.practice_store_retry_after = 0.0
    app.state.practice_store = practice_store_module.MySQLPracticeStore(settings)
    return app.state.practice_store


def _axiom_parse_index(request: Request) -> dict[str, dict[str, Any]]:
    """8902 书目解析态（独立性铁律：8902 离线时返回空表，由调用方按空值降级）。"""
    try:
        rows = request.app.state.axiom_client.list_books() or []
    except Exception as exc:  # noqa: BLE001 - 解析侧不可达不影响题源书目可读
        logger.warning("8902 书目不可达，题源书目的解析态留空：%s", type(exc).__name__)
        return {}
    return {str(row.get("book_id") or ""): row for row in rows}


@router.get("/question-books")
def list_question_books(
    request: Request,
    course: str | None = Query(default=None),
    role: str | None = Query(default=None),
) -> dict[str, Any]:
    """题源书目（R-10 根侧透传 8901 + 应用层 roles 过滤）：抽取管线的选书入口。

    `roles` 为数组，含 `textbook/exercises/solutions` 其一即认为题源可用（R-11 宽容读）；
    课程归属**先取书库行 `course_id`，空则回退解析表（af_books）同列**——现网书库行该列全空
    （2026-10-07 真机核验），透传过滤会恒返空表，故过滤在 8900 侧做；解析侧离线按空值降级。
    可抽取页数取 `parsed_pages`（`pages_done`）；`parse_status` 由解析侧维护、现网恒 `pending`，
    只作展示不作判据。
    """
    _enum_or_422(role, QUESTION_BOOK_ROLES, "role")
    if course is not None:
        _require_catalog_course(request, course)
    rows = request.app.state.tracker_client.list_books() or []
    parse_index = _axiom_parse_index(request)
    books: list[dict[str, Any]] = []
    for row in rows:
        roles = [str(item) for item in (row.get("roles") or [])]
        if not any(item in QUESTION_BOOK_ROLES for item in roles):
            continue
        if role is not None and role not in roles:
            continue
        book_id = str(row.get("book_id") or "")
        info = parse_index.get(book_id) or {}
        row_course = str(row.get("course_id") or info.get("course_id") or "")
        if course is not None and row_course != course:
            continue
        books.append(
            {
                "book_id": book_id,
                "title": row.get("title") or book_id,
                "roles": roles,
                "course_id": row_course,
                "parse_status": str(info.get("parse_status") or ""),
                "page_count": int(info.get("page_count") or 0),
                "parsed_pages": int(info.get("pages_done") or 0),
            }
        )
    books.sort(key=lambda item: item["book_id"])
    return {"course_id": course, "books": books}


@router.post("/questions")
def add_questions(request: Request, body: QuestionBatchBody) -> dict[str, Any]:
    """人工确认后的批量入库：`(course_id, stem_hash)` 命中即跳（幂等），整批同事务。"""
    store = _practice(request)
    result = store.add_questions(
        course_id=body.course_id,
        items=[item.model_dump() for item in body.questions],
        gen_batch=body.gen_batch,
        model_ref=body.model_ref,
        learn_course_id=body.learn_course_id,
    )
    return {
        "created": result["created"],
        "skipped_duplicates": result["skipped_duplicates"],
        "gen_batch": body.gen_batch,
        "model_ref": body.model_ref,
        "questions": [public_question(row) for row in result["questions"]],
    }


@router.get("/questions")
def list_questions(
    request: Request,
    course: str | None = Query(default=None),
    kp: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    question_type: str | None = Query(default=None),
    source_kind: str | None = Query(default=None),
    book: str | None = Query(default=None),
    retired: str = Query(default="active"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """题库浏览：题面投影剔除判分依据三列（缝 2），`retired=all/only` 控制退役行可见性。"""
    _enum_or_422(kind, QUESTION_KINDS, "kind")
    _enum_or_422(question_type, QUESTION_TYPES, "question_type")
    _enum_or_422(source_kind, SOURCE_KINDS, "source_kind")
    _enum_or_422(retired, RETIRED_FILTERS, "retired")
    store = _practice(request)
    rows, total = store.list_questions(
        course_id=course,
        kp_id=kp,
        kind=kind,
        question_type=question_type,
        source_kind=source_kind,
        book_ref=book,
        retired=retired,
        limit=limit,
        offset=offset,
    )
    return {"questions": [public_question(row) for row in rows], "total": total}


@router.patch("/questions/{question_id}")
def patch_question(request: Request, question_id: str, body: QuestionPatchBody) -> dict[str, Any]:
    """题行改列：白名单外的产出事实 422；合并后的题行必须重新通过入库不变量。"""
    store = _practice(request)
    row = _guard(store.get_question, question_id)
    fields = {key: getattr(body, key) for key in body.model_fields_set}
    merged = {**row, **{key: value for key, value in fields.items() if value is not None}}
    error = _question_invariant_error(merged)
    if error:
        raise HTTPException(status_code=422, detail=error)
    return public_question(_guard(store.patch_question, question_id, **fields))


@router.post("/attempts")
def add_attempt(request: Request, body: AttemptBody) -> dict[str, Any]:
    """提交作答：判分 + 作答行 + `score_trend/resolved` + 调度回写同事务（缝 6）。

    判分依据只在作答响应里回传（缝 2）；flashcard 走自评、不进判分路径（裁决 ⑨）。
    """
    store = _practice(request)
    question = _guard(store.get_question, body.question_id)
    if question["kind"] == "flashcard":
        if body.self_result is None:
            raise HTTPException(status_code=422, detail="flashcard 自评必须提交 self_result")
    elif body.self_result is not None:
        raise HTTPException(status_code=409, detail="self_result 只用于 flashcard 自评")
    result = _guard(
        store.add_attempt,
        question_id=body.question_id,
        user_answer=body.user_answer,
        origin=body.origin,
        review_date=body.review_date,
        self_result=body.self_result,
    )
    attempt = result["attempt"]
    return {
        "attempt_id": attempt["attempt_id"],
        "question_id": attempt["question_id"],
        "is_correct": attempt["is_correct"],
        "method": attempt["method"],
        "judge_note": attempt["judge_note"],
        "score_trend": attempt["score_trend"],
        "resolved": attempt["resolved"],
        "answered_at": attempt["answered_at"],
        "expected_answer": result["expected_answer"],
        "explanation": result["explanation"],
        "review": result["review"],
    }


@router.get("/review/due")
def review_due(
    request: Request,
    course: str | None = Query(default=None),
    max_tasks: int = Query(default=DEFAULT_MAX_TASKS, ge=1, le=100),
) -> dict[str, Any]:
    """到期队列：优先级即时派生（错题 1 先于类型档 2~5），`total_due` 为截断前的全量到期数。"""
    store = _practice(request)
    tasks = store.review_due(course, max_tasks=max_tasks)
    return {
        "course_id": course,
        "tasks": [
            {**task, "question": public_question(task["question"]) if task.get("question") else None}
            for task in tasks
        ],
        "total_due": store.count_review_due(course),
    }


@router.get("/mistakes")
def list_mistakes(
    request: Request,
    course: str | None = Query(default=None),
    kp: str | None = Query(default=None),
    book: str | None = Query(default=None),
    resolved: str = Query(default="false"),
    bookmarked: str | None = Query(default=None),
    trend: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """错题本（派生查询，不建表）：一题一行取最近作答，题面同样剔除判分依据（缝 2）。"""
    _enum_or_422(resolved, TRI_STATE_FILTERS, "resolved")
    _enum_or_422(bookmarked, TRI_STATE_FILTERS, "bookmarked")
    _enum_or_422(trend, SCORE_TRENDS, "trend")
    store = _practice(request)
    items, total = store.list_mistakes(
        course_id=course,
        kp_id=kp,
        book_ref=book,
        resolved=resolved,
        bookmarked=bookmarked,
        trend=trend,
        limit=limit,
        offset=offset,
    )
    return {
        "items": [{**item, "question": public_question(item["question"])} for item in items],
        "total": total,
        "stats": store.mistake_stats(course_id=course, kp_id=kp, book_ref=book),
    }


@router.patch("/attempts/{attempt_id}")
def patch_attempt(request: Request, attempt_id: int, body: AttemptPatchBody) -> dict[str, Any]:
    """错题本人工位（收藏/已解决）；判分结果列不在白名单（extra=forbid 直接 422）。"""
    store = _practice(request)
    fields = {key: getattr(body, key) for key in body.model_fields_set}
    if not fields:
        raise HTTPException(status_code=422, detail="没有可更新的字段")
    return _guard(store.patch_attempt, attempt_id, **fields)
