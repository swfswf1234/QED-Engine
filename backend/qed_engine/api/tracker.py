"""数据域·QED-Tracker 适配路由：catalogs / tasks / knowledge / books 归 8900 所有。

前端（8903）只连 8900（ADR 0007）：目录、任务、五层语义（教程 qt_knowledge / 书籍
qt_books / 渠道 qt_sources，QED-031 知识层次模型，取代三表 qt_selections/qt_downloads）
统一由本模块暴露，内部经 clients/tracker_client.py 适配 8901。路径与 8901 一致
（api-contracts.md 数据域章节）；三表历史契约见 downloads-three-table-model.md
（Superseded）。

错误映射：8901 返回 4xx（如 409 状态机冲突）→ 同码透传 detail；连接失败/5xx → 503
+ 明确提示（前端据此降级显示，独立性铁律）。reject 缺 reason 由 8900 校验直接 422，
不请求 8901。

设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_api.py
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from qed_engine.clients.tracker_client import TrackerClient, TrackerError

router = APIRouter(prefix="/api/v1", tags=["data"])

# 8901 返回 5xx 时统一映射 503（上游不可用），4xx 原样透传（前端既有 409 等处理生效）。
_UPSTREAM_UNAVAILABLE = 503


# --- 五层语义（QED-031）：教程 / 书籍 / 渠道 ---


class KnowledgeConfirmBody(BaseModel):
    textbook_ref: dict | None = None
    exercise_ref: dict | None = None
    textbook_intro: str = ""
    exercise_intro: str = ""


class KnowledgeRejectBody(BaseModel):
    reason: str


class BookCreateBody(BaseModel):
    knowledge_id: str
    kind: str = "textbook"
    roles: list[str] = []
    title: str
    part: str = ""
    display_title: str = ""
    authors: list[str] = []
    language: str = ""
    version: dict | None = None
    source: dict | None = None
    original_url: str = ""


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


class BookCompleteBody(BaseModel):
    sha256: str
    relative_path: str
    page_count: int | None = None
    absolute_path: str = ""
    file_name: str = ""


class BookRejectBody(BaseModel):
    reason: str
    note: str | None = None


class BookSupersedeBody(BaseModel):
    reason: str


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


def _require_reason(reason: str) -> None:
    """reject/supersede 缺 reason：8900 直接 422，不请求 8901。"""
    if not reason:
        raise HTTPException(status_code=422, detail="必须提供原因（reason）")


# --- 领域只读/维护（REQ-059，QED-Tracker 承接端点，未上线 404 原样透传） ---

# 注：旧探索透传端点（/courses/{id}/explore、/explore-runs/*、/curriculum-explore、
# /curriculum-runs/*，PLAN-021 冻结契约 §1~§7.2）已删除——QED-Tracker migration 0013
# 废弃旧 explore-runs 契约；探索功能由 8900 自有 /explore-sessions 会话端点承接
# （PLAN-022 B1~B3，2026-08-28）。


class DomainUpdateBody(BaseModel):
    description: str | None = None
    stages: list[str] | None = None
    exploration_stage: str | None = None  # PLAN-022 B4：探索状态流转（D2）


@router.get("/domains")
def list_domains(request: Request) -> list:
    """领域列表（左树第一层数据源，透传 8901）。"""
    return _call(request, _tracker(request).list_domains)


class DomainCreateBody(BaseModel):
    name: str
    description: str | None = None
    stages: list[str] | None = None


@router.post("/domains")
def create_domain(body: DomainCreateBody, request: Request):
    """手工新建领域（REQ-059 §8；domain_id 由上游生成；未上线前归一结构化 404）。"""
    return _call(
        request,
        _tracker(request).create_domain,
        name=body.name,
        description=body.description,
        stages=body.stages,
        _manual_maintenance=True,
    )


@router.patch("/domains/{domain_id}")
def update_domain(domain_id: str, body: DomainUpdateBody, request: Request):
    """修改领域描述/阶段（name 锁死不在请求体，透传 8901）。"""
    return _call(
        request,
        _tracker(request).update_domain,
        domain_id,
        description=body.description,
        stages=body.stages,
        exploration_stage=body.exploration_stage,
        _manual_maintenance=True,
    )


@router.delete("/domains/{domain_id}")
def delete_domain(domain_id: str, request: Request):
    """删除领域（有课程时上游 409 保护；§8 未上线前归一结构化 404）。"""
    return _call(request, _tracker(request).delete_domain, domain_id, _manual_maintenance=True)


class DomainExploreBody(BaseModel):
    mode: str = "direct"
    ref_text: str | None = None
    ref_doc_path: str | None = None


@router.post("/domains/{domain_id}/explore")
def explore_domain(domain_id: str, body: DomainExploreBody, request: Request):
    """启动领域探索（REQ-067 B2；202 异步任务，透传 8901）。"""
    return _call(
        request,
        _tracker(request).explore_domain,
        domain_id,
        mode=body.mode,
        ref_text=body.ref_text or "",
        ref_doc_path=body.ref_doc_path or "",
        _manual_maintenance=True,
    )


class DomainConfirmNameBody(BaseModel):
    decision: str  # accept | custom | retain
    name: str | None = None


@router.post("/domains/{domain_id}/confirm-name")
def confirm_domain_name(domain_id: str, body: DomainConfirmNameBody, request: Request):
    """确认领域名称（REQ-067 B7；透传 8901）。"""
    return _call(
        request,
        _tracker(request).confirm_domain_name,
        domain_id,
        decision=body.decision,
        name=body.name or "",
        _manual_maintenance=True,
    )


class DomainImportBody(BaseModel):
    domain: dict  # manual@v1 全文（QED-050 契约）


@router.post("/domains/import")
def import_domain(body: DomainImportBody, request: Request):
    """手动领域 JSON 导入（REQ-067 B3；透传 8901 QED-050）。"""
    return _call(
        request,
        _tracker(request).import_domain,
        domain_data=body.domain,
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


@router.patch("/courses/{course_id}")
def update_course(course_id: str, body: CourseUpdateBody, request: Request):
    """修改课程阶段/排序/备注（name 锁死；仅提交显式字段）。"""
    return _call(
        request,
        _tracker(request).update_course,
        course_id,
        stage=body.stage,
        sort_order=body.sort_order,
        note=body.note,
        _manual_maintenance=True,
    )


@router.delete("/courses/{course_id}")
def delete_course(course_id: str, request: Request):
    """删除课程（有教程时上游 409 保护；§8 未上线前归一结构化 404）。"""
    return _call(request, _tracker(request).delete_course, course_id, _manual_maintenance=True)


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


@router.post("/knowledge/{knowledge_id}/complete")
def complete_knowledge(knowledge_id: str, request: Request) -> dict:
    """教程 confirmed→completed（所辖书籍全部 verified 聚合触发）。"""
    return _call(request, _tracker(request).complete_knowledge, knowledge_id)


@router.post("/knowledge/{knowledge_id}/reject")
def reject_knowledge(knowledge_id: str, body: KnowledgeRejectBody, request: Request) -> dict:
    """教程否定（reason 必填 422）；rejected 终态彻底隐藏。"""
    _require_reason(body.reason)
    return _call(request, _tracker(request).reject_knowledge, knowledge_id, body.reason)


@router.post("/knowledge/{knowledge_id}/supersede")
def supersede_knowledge(knowledge_id: str, body: KnowledgeRejectBody, request: Request) -> dict:
    """教程过时（reason 必填 422）；旧版本前端不再可见。"""
    _require_reason(body.reason)
    return _call(request, _tracker(request).supersede_knowledge, knowledge_id, body.reason)


# --- 书籍（qt_books，五层模型 QED-031） ---


@router.post("/books")
def create_book(body: BookCreateBody, request: Request) -> dict:
    """新建书籍候选（先登记再下载）；knowledge_id + title 必填 422。"""
    if not body.knowledge_id:
        raise HTTPException(status_code=422, detail="必须提供 knowledge_id")
    if not body.title:
        raise HTTPException(status_code=422, detail="必须提供 title")
    return _call(
        request,
        _tracker(request).create_book,
        body.knowledge_id,
        kind=body.kind,
        roles=body.roles,
        title=body.title,
        part=body.part,
        display_title=body.display_title,
        authors=body.authors,
        language=body.language,
        version=body.version,
        source=body.source,
        original_url=body.original_url,
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


@router.post("/books/{book_id}/decide")
def decide_book(book_id: str, request: Request) -> dict:
    """候选→决定（人工决定下载）。"""
    return _call(request, _tracker(request).decide_book, book_id)


@router.post("/books/{book_id}/start")
def start_book(book_id: str, request: Request) -> dict:
    """决定→下载中（任务运行）。"""
    return _call(request, _tracker(request).start_book, book_id)


@router.post("/books/{book_id}/fail")
def fail_book(book_id: str, request: Request) -> dict:
    """下载失败标记（可 retry）。"""
    return _call(request, _tracker(request).fail_book, book_id)


@router.post("/books/{book_id}/retry")
def retry_book(book_id: str, request: Request) -> dict:
    """失败重试 → downloading。"""
    return _call(request, _tracker(request).retry_book, book_id)


@router.post("/books/{book_id}/complete")
def complete_book(book_id: str, body: BookCompleteBody, request: Request) -> dict:
    """下载完成回填：sha256 + relative_path 必填 422（服务端/自动下载链路调用）。"""
    if not body.sha256 or not body.relative_path:
        raise HTTPException(status_code=422, detail="sha256 与 relative_path 必填")
    return _call(
        request,
        _tracker(request).complete_book,
        book_id,
        body.sha256,
        body.relative_path,
        body.page_count,
        body.absolute_path,
        body.file_name,
    )


@router.post("/books/{book_id}/verify")
def verify_book(book_id: str, request: Request) -> dict:
    """人工验收通过：downloaded → verified（终态）。"""
    return _call(request, _tracker(request).verify_book, book_id)


@router.post("/books/{book_id}/reject")
def reject_book(book_id: str, body: BookRejectBody, request: Request) -> dict:
    """书籍否定（reason 必填 422，硬删 + 留痕；可选 note）。"""
    _require_reason(body.reason)
    return _call(request, _tracker(request).reject_book, book_id, body.reason, body.note)


@router.post("/books/{book_id}/supersede")
def supersede_book(book_id: str, body: BookSupersedeBody, request: Request) -> dict:
    """书籍过时（版本换代留痕，reason 必填 422）。"""
    _require_reason(body.reason)
    return _call(request, _tracker(request).supersede_book, book_id, body.reason)
