"""数据域·QED-Tracker 适配路由：catalogs / tasks / knowledge / books 归 8900 所有。

前端（8903）只连 8900（ADR 0007）：目录、任务、五层语义（教程 qt_knowledge / 书籍
qt_books / 渠道 qt_sources，QED-031 知识层次模型，取代三表 qt_selections/qt_downloads）
统一由本模块暴露，内部经 clients/tracker_client.py 适配 8901。路径与 8901 一致
（api-contracts.md 数据域章节）；三表历史契约原文已于 2026-09-10 REQ-070 删除，
可自 Git 历史查阅。

错误映射：8901 返回 4xx（如 409 状态机冲突）→ 同码透传 detail；连接失败/5xx → 503
+ 明确提示（前端据此降级显示，独立性铁律）。reject 缺 reason 由 8900 校验直接 422，
不请求 8901。

设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_api.py
"""

import tempfile
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from qed_engine.clients.tracker_client import TrackerClient, TrackerError
from qed_engine.services import shared_tables
from qed_engine.services.shared_tables import STAGE_PENDING

router = APIRouter(prefix="/api/v1", tags=["data"])

# 8901 返回 5xx 时统一映射 503（上游不可用），4xx 原样透传（前端既有 409 等处理生效）。
_UPSTREAM_UNAVAILABLE = 503


# --- 五层语义（QED-031）：教程 / 书籍 / 渠道 ---


class KnowledgeConfirmBody(BaseModel):
    textbook_ref: dict | None = None
    exercise_ref: dict | None = None
    textbook_intro: str = ""
    exercise_intro: str = ""


class KnowledgeUpdateBody(BaseModel):
    """教程更新请求体。"""
    name: str | None = None
    position: str | None = None
    intro: str | None = None
    set_no: str | None = None
    kind: str | None = None
    notes: str | None = None


class BookCreateBody(BaseModel):
    """书库化创建请求体（QED-060 目标契约）：book_id + title 必填，无 knowledge_id。"""
    book_id: str = ""
    title: str = ""
    original_title: str = ""
    part: str = ""
    authors: list[dict] = []
    publisher: str = ""
    edition: str = ""
    year: int | None = None
    language: str = ""
    roles: list[str] = []
    status: str = ""
    domain_id: str = ""
    notes: str = ""


class BookSourceBody(BaseModel):
    channel: str = "manual"
    provider_id: str = ""
    page_url: str = ""
    download_url: str = ""
    file_keywords: str = ""
    ok: bool = False
    note: str = ""


class BookRegisterBody(BaseModel):
    relative_path: str


def _tracker(request: Request) -> TrackerClient:
    return request.app.state.tracker_client


def _call(request: Request, fn, *args, _status_code: int = 200, _manual_maintenance: bool = False, **kwargs):
    """执行 8901 调用并做错误映射：4xx 透传（409 状态机冲突），其余统一 503。

    `_manual_maintenance=True`（仅 §8 手工维护五路由，REQ-059）：上游默认形态
    404/405（FastAPI 路由未实现/路径参数通配命中不同方法，如 GET /courses/{domain_id}
    吞掉 PATCH|DELETE）归一为结构化 404 UPSTREAM_NOT_IMPLEMENTED——前端据此统一降级
    提示；端点上线后业务 404 自带 {code,message} 结构自动绕过归一。
    """
    try:
        result = fn(*args, **kwargs)
        if _status_code != 200:
            return JSONResponse(content=result, status_code=_status_code)
        return result
    except TrackerError as exc:
        if _manual_maintenance and _is_default_not_implemented(exc):
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "UPSTREAM_NOT_IMPLEMENTED",
                    "message": "该手工维护端点 8901 尚未实现（REQ-059 承接中）",
                },
            ) from exc
        if exc.status_code is not None and 400 <= exc.status_code < 500:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        raise HTTPException(
            status_code=_UPSTREAM_UNAVAILABLE,
            detail=f"QED-Tracker 服务不可达：{exc}",
        ) from exc


def _is_default_not_implemented(exc: TrackerError) -> bool:
    """上游 404/405 且 detail 为框架默认字符串形态 → 判定为「端点未实现」。"""
    if exc.status_code not in (404, 405) or not isinstance(exc.detail, str):
        return False
    return "Not Found" in exc.detail or "Method Not Allowed" in exc.detail


# --- 领域只读/维护（REQ-059，QED-Tracker 承接端点，未上线 404 原样透传） ---

# 注：旧探索透传端点（/courses/{id}/explore、/explore-runs/*、/curriculum-explore、
# /curriculum-runs/*，PLAN-021 冻结契约 §1~§7.2）已删除——QED-Tracker migration 0013
# 废弃旧 explore-runs 契约；探索功能由 8900 自有 /explore-sessions 会话端点承接
# （PLAN-022 B1~B3，2026-08-28）。


class DomainUpdateBody(BaseModel):
    name: str | None = None
    description: str | None = None
    stages: list[str] | None = None
    exploration_stage: str | None = None  # PLAN-022 B4：探索状态流转（D2）
    scope: str | None = None
    level: str | None = None
    classic_tracks: list | None = None
    explore_pending: dict | None = None


@router.get("/domains")
def list_domains(request: Request) -> list:
    """领域列表（左树第一层数据源，透传 8901）。"""
    return _call(request, _tracker(request).list_domains)


class DomainCreateBody(BaseModel):
    name: str
    description: str | None = None
    stages: list[str] | None = None
    level: str | None = None
    classic_tracks: list | None = None
    scope: str | None = None


@router.post("/domains")
def create_domain(body: DomainCreateBody, request: Request):
    """手工新建领域（REQ-059 §8；domain_id 由上游生成；未上线前归一结构化 404）。"""
    return _call(
        request,
        _tracker(request).create_domain,
        name=body.name,
        description=body.description,
        stages=body.stages,
        level=body.level,
        classic_tracks=body.classic_tracks,
        scope=body.scope,
        _manual_maintenance=True,
    )


@router.patch("/domains/{domain_id}")
def update_domain(domain_id: str, body: DomainUpdateBody, request: Request):
    """修改领域描述/阶段/范围/方向/名称/explore_pending（透传 8901）。"""
    return _call(
        request,
        _tracker(request).update_domain,
        domain_id,
        name=body.name,
        description=body.description,
        stages=body.stages,
        exploration_stage=body.exploration_stage,
        scope=body.scope,
        level=body.level,
        classic_tracks=body.classic_tracks,
        explore_pending=body.explore_pending,
        _manual_maintenance=True,
    )


@router.delete("/domains/{domain_id}")
def delete_domain(domain_id: str, request: Request):
    """删除领域（有课程时上游 409 保护；§8 未上线前归一结构化 404）。"""
    return _call(request, _tracker(request).delete_domain, domain_id, _manual_maintenance=True)


class DomainImportBody(BaseModel):
    domain: dict  # manual@v1 全文（QED-050 契约）
    target_domain_id: str | None = None  # 用户在 UI 选择的目标领域 ID


@router.post("/domains/import")
def import_domain(body: DomainImportBody, request: Request):
    """手动领域 JSON 导入（REQ-067 B3；透传 8901 QED-050）。"""
    return _call(
        request,
        _tracker(request).import_domain,
        domain_data=body.domain,
        target_domain_id=body.target_domain_id,
        _manual_maintenance=True,
    )


@router.post("/domains/{domain_id}/commit-import")
def commit_import(domain_id: str, request: Request):
    """手动导入课程：从 domains.json 读取课程写入 qed_course（六步流程步骤 3）。"""
    return _call(
        request,
        _tracker(request).commit_import_courses,
        domain_id,
        _manual_maintenance=True,
    )


@router.get("/courses")
def list_course_system(request: Request) -> list:
    """领域课程体系（GET /courses，左树 v2 数据源，透传 8901 QED-033）。"""
    return _call(request, _tracker(request).list_courses_system)


class CourseCreateBody(BaseModel):
    name: str
    stage: str | None = None
    sort_order: int | None = None
    note: str | None = None
    description: str | None = None  # PLAN-022：探索 apply 与手工维护共用
    aliases: list[str] | None = None
    track: str | None = None
    prerequisites: list[str] | None = None


@router.post("/domains/{domain_id}/courses")
def create_course_for_domain(domain_id: str, body: CourseCreateBody, request: Request):
    """手工新增课程（REQ-059 §8；上游未上线前归一结构化 404）。"""
    return _call(
        request,
        _tracker(request).create_course_for_domain,
        domain_id,
        name=body.name,
        stage=body.stage,
        sort_order=body.sort_order,
        note=body.note,
        description=body.description,
        aliases=body.aliases,
        track=body.track,
        prerequisites=body.prerequisites,
        _manual_maintenance=True,
    )


class CourseUpdateBody(BaseModel):
    stage: str | None = None
    sort_order: int | None = None
    note: str | None = None
    description: str | None = None
    track: str | None = None
    aliases: list[str] | None = None
    prerequisites: list[str] | None = None


@router.patch("/courses/{course_id}")
def update_course(course_id: str, body: CourseUpdateBody, request: Request):
    """修改课程阶段/排序/备注/描述/方向/别名/先修（name 锁死；仅提交显式字段）。"""
    return _call(
        request,
        _tracker(request).update_course,
        course_id,
        stage=body.stage,
        sort_order=body.sort_order,
        note=body.note,
        description=body.description,
        track=body.track,
        aliases=body.aliases,
        prerequisites=body.prerequisites,
        _manual_maintenance=True,
    )


@router.delete("/courses/{course_id}")
def delete_course(course_id: str, request: Request):
    """删除课程（有教程时上游 409 保护；§8 未上线前归一结构化 404）。"""
    return _call(request, _tracker(request).delete_course, course_id, _manual_maintenance=True)


class CourseKnowledgeBody(BaseModel):
    tutorials: list[dict] | None = None


@router.post("/courses/{course_id}/knowledge")
def import_course_knowledge(course_id: str, body: CourseKnowledgeBody, request: Request):
    """导入课程知识（tutorials JSON）。"""
    result = _call(
        request,
        _tracker(request).import_course_knowledge,
        course_id,
        body.model_dump(exclude_none=True),
        _manual_maintenance=True,
    )
    # 导入成功后，将课程状态从"未开始"写为"待确认"（PLAN-035 补齐）
    settings = request.app.state.settings
    shared_tables.set_course_stage(settings, None, course_id, STAGE_PENDING, online=False)
    return result


# --- 目录 ---


@router.get("/catalogs/{course_id}")
def get_catalog(course_id: str, request: Request) -> dict:
    """课程目录（知识点树，下载管理主数据源）。"""
    return _call(request, _tracker(request).get_catalog, course_id)


# --- 任务（后台任务 + 轮询） ---


@router.get("/tasks")
def list_tasks(request: Request) -> list:
    """任务列表（前端轮询任务面板）。"""
    return _call(request, _tracker(request).list_tasks)


@router.get("/tasks/{task_id}")
def get_task(task_id: str, request: Request) -> dict:
    """任务详情（前端轮询单任务状态）。"""
    return _call(request, _tracker(request).get_task, task_id)


# --- 教程（qt_knowledge，五层模型 QED-031） ---


@router.get("/knowledge")
def list_knowledge(
    request: Request,
    course_id: str | None = None,
    status: str | None = None,
) -> list:
    """教程列表（按课程/状态过滤）；rejected/superseded 彻底隐藏由上游数据层保证。"""
    return _call(request, _tracker(request).list_knowledge, course_id, status)


@router.get("/knowledge/{knowledge_id}")
def get_knowledge(knowledge_id: str, request: Request) -> dict:
    """教程详情（含所辖书籍列表）。"""
    return _call(request, _tracker(request).get_knowledge, knowledge_id)


@router.post("/knowledge/{knowledge_id}/confirm")
def confirm_knowledge(knowledge_id: str, body: KnowledgeConfirmBody, request: Request) -> dict:
    """教程 draft→confirmed（定稿：决定引用 {title, version} + 简介）。"""
    return _call(
        request,
        _tracker(request).confirm_knowledge,
        knowledge_id,
        body.textbook_ref,
        body.exercise_ref,
        body.textbook_intro,
        body.exercise_intro,
    )


@router.patch("/knowledge/{knowledge_id}")
def update_knowledge(knowledge_id: str, body: KnowledgeUpdateBody, request: Request) -> dict:
    """更新教程信息（name/position/intro/set_no/kind/notes）。"""
    return _call(
        request,
        _tracker(request).update_knowledge,
        knowledge_id,
        name=body.name,
        position=body.position,
        intro=body.intro,
        set_no=body.set_no,
        kind=body.kind,
        notes=body.notes,
    )


@router.delete("/knowledge/{knowledge_id}")
def delete_knowledge(knowledge_id: str, request: Request) -> dict:
    """删除教程（级联清理孤立书籍）。"""
    return _call(request, _tracker(request).delete_knowledge, knowledge_id)


# --- 书籍（qt_books，五层模型 QED-031） ---


@router.post("/books", status_code=201)
def create_book(body: BookCreateBody, request: Request) -> dict:
    """书库化创建（QED-060）：book_id + title 必填 422；归属由教程 refs 承载。"""
    if not body.book_id:
        raise HTTPException(status_code=422, detail="必须提供 book_id")
    if not body.title:
        raise HTTPException(status_code=422, detail="必须提供 title")
    optional = {
        "title": body.title,
        "original_title": body.original_title,
        "part": body.part,
        "authors": body.authors,
        "publisher": body.publisher,
        "edition": body.edition,
        "year": body.year,
        "language": body.language,
        "roles": body.roles,
        "status": body.status,
        "domain_id": body.domain_id,
        "notes": body.notes,
    }
    # 仅传非空项：8901 对 status 等字段做值域校验，空串会被判 422。
    kwargs = {k: v for k, v in optional.items() if v not in ("", None, [])}
    return _call(
        request,
        _tracker(request).create_book,
        body.book_id,
        _status_code=201,
        **kwargs,
    )


@router.get("/books/{book_id}/sources")
def list_book_sources(book_id: str, request: Request) -> list:
    """书籍渠道尝试列表（详情弹窗）；失败尝试留痕不展示由上游过滤。"""
    return _call(request, _tracker(request).list_book_sources, book_id)


@router.post("/books/{book_id}/sources")
def add_book_source(book_id: str, body: BookSourceBody, request: Request) -> dict:
    """登记一次渠道尝试（ok 表达成败）。"""
    return _call(
        request,
        _tracker(request).add_book_source,
        book_id,
        channel=body.channel,
        provider_id=body.provider_id,
        page_url=body.page_url,
        download_url=body.download_url,
        file_keywords=body.file_keywords,
        ok=body.ok,
        note=body.note,
    )


@router.post("/books/{book_id}/register")
def register_book(book_id: str, body: BookRegisterBody, request: Request) -> dict:
    """人工下载登记（数据根内相对路径，PDF 校验与改名落盘在 8901 侧）。"""
    if not body.relative_path:
        raise HTTPException(status_code=422, detail="必须提供数据根内相对路径（relative_path）")
    return _call(request, _tracker(request).register_book, book_id, body.relative_path)


@router.post("/books/{book_id}/fetch")
def fetch_book(book_id: str, request: Request) -> dict:
    """自动下载书籍（触发下载任务）。"""
    return _call(request, _tracker(request).fetch_book, book_id)


@router.post("/knowledge/{knowledge_id}/fetch")
def fetch_knowledge_books(knowledge_id: str, request: Request) -> dict:
    """批量下载教程所辖书籍（触发下载任务）。"""
    return _call(request, _tracker(request).fetch_knowledge_books, knowledge_id)


@router.post("/books/{book_id}/import")
def import_book_pdf(
    book_id: str,
    request: Request,
    file: Annotated[UploadFile, File()],
    target_path: Annotated[str | None, Form()] = None,
) -> dict:
    """人工导入书籍 PDF（浏览器 multipart 上传，PLAN-039）。

    8900 将上传字节落系统临时文件 → 调 8901 import（完整性校验/sha256/原子落盘/mark_owned）
    → 无论成败清理临时文件。用户无需提供服务器路径。
    """
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持上传 .pdf 文件")
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp_path = tmp.name
            tmp.write(file.file.read())
        return _call(
            request,
            _tracker(request).import_book_pdf,
            book_id,
            file_path=tmp_path,
            target_path=target_path or None,
        )
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)


@router.post("/books/{book_id}/start")
def start_book(book_id: str, request: Request) -> dict:
    """开始下载：decided → downloading（QED-060）。"""
    return _call(request, _tracker(request).start_book, book_id)


@router.post("/books/{book_id}/fail")
def fail_book(book_id: str, request: Request) -> dict:
    """标记下载失败：downloading → failed（holding 仍 missing）。"""
    return _call(request, _tracker(request).fail_book, book_id)


@router.post("/books/{book_id}/verify")
def verify_book(book_id: str, request: Request) -> dict:
    """人工验收通过：downloaded → verified（终态）。"""
    return _call(request, _tracker(request).verify_book, book_id)


@router.post("/books/{book_id}/cancel")
def cancel_book(book_id: str, request: Request) -> dict:
    """取消下载：downloading → decided（复位，不删除已落盘文件）。"""
    return _call(request, _tracker(request).cancel_book, book_id)
