"""数据域·Axiom-Flow 适配路由：parse-jobs / books / pages / manifest / parsing/tree 归 8900 所有。

前端（8903）只连 8900（ADR 0007）：解析进度与文档解析管理（左树右对照）数据统一由
本模块暴露，内部经 clients/axiom_client.py 适配 8902。契约按 Axiom-Flow
docs/architecture/api.md（v2 冻结契约）与其 REQ-001（8900 侧适配）：
GET /books、GET /books/{id}（单本详情）、GET /books/{id}/file（源 PDF inline 流，数据根边界校验）、
GET /books/{id}/pages/{no}（8900 补写 page_no、重写 image_url 为 8900 代理绝对地址）、
GET /books/{id}/manifest、POST /parse-jobs（engine 字段）、GET /parse-jobs/{id}、
POST /books/sync（聚合 8901 verified 书籍，按 BookSyncItem 形状转发 8902 upsert）、
PUT/GET /books/{id}/pages/{no}/blocks/{index}/review（8900 对前端保持 /review 门面与
BlockReview 响应形状，内部转 8902 /edit + 页级 /edits 过滤）、
GET /parsing/tree（左侧树聚合：8900 共享表领域课程 + 8902 书目）。

错误映射：8902 返回 4xx（400 参数非法 / 404 book/page 不存在）→ 同码透传 detail；
连接失败/5xx → 503 + 明确提示（前端据此降级显示，独立性铁律：8902 离线不破坏其他界面）。
/books/sync 同时依赖 8901（取数）：8901 不可达 → 503 + 「QED-Tracker 服务不可达」提示。

设计关联（DesignRef）：docs/architecture/api-contracts.md（8902 透传组事实源：
Axiom-Flow docs/architecture/api.md）
实现状态：Current（联调对齐轮：/edit 门面、BookSyncItem、engine/id/progress、page_no 补写）
关联测试：tests/test_api.py
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from qed_engine.clients.axiom_client import AxiomClient, AxiomError
from qed_engine.clients.tracker_client import TrackerClient, TrackerError

router = APIRouter(prefix="/api/v1", tags=["data"])

# 8902 返回 5xx 时统一映射 503（上游不可用），4xx 原样透传。
_UPSTREAM_UNAVAILABLE = 503


class ParseJobCreateBody(BaseModel):
    book_id: str
    pages: list[int] | None = None
    engine: str = "mineru"


class BlockReviewBody(BaseModel):
    verdict: str = Field(pattern="^(ok|bad)$")
    note: str = Field(default="", max_length=1000)


class BlockEditBody(BaseModel):
    """块编辑（/edit 门面，设计 parsing-ui §5 目标形态）：verdict 可选（仅文字/范围修正时省略）。"""

    verdict: str | None = Field(default=None, pattern="^(ok|bad)$")
    note: str = Field(default="", max_length=1000)
    corrected_text: str | None = Field(default=None, max_length=20000)
    corrected_bbox: list[int] | None = Field(default=None, min_length=4, max_length=4)


def _axiom(request: Request) -> AxiomClient:
    return request.app.state.axiom_client


def _call(request: Request, fn, *args, **kwargs):
    """执行 8902 调用并做错误映射：4xx 透传，其余统一 503。"""
    try:
        return fn(*args, **kwargs)
    except AxiomError as exc:
        if exc.status_code is not None and 400 <= exc.status_code < 500:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        raise HTTPException(
            status_code=_UPSTREAM_UNAVAILABLE,
            detail=f"Axiom-Flow 服务不可达：{exc}",
        ) from exc


def _normalize_authors(raw: list) -> list[dict]:
    """8901 qt_books.authors 归一化为 8902 Author 对象形状（历史数据可能是字符串列表）。"""
    result: list[dict] = []
    for a in raw:
        if isinstance(a, str):
            result.append({"name": a, "role": ""})
        elif isinstance(a, dict):
            result.append({"name": a.get("name") or "", "role": a.get("role") or ""})
    return result


def _verified_books_from_tracker(request: Request) -> list[dict]:
    """聚合 8901 已验证（verified）书籍，归一化为 8902 BookSyncItem payload。

    取数：/knowledge 列表 + 逐行 /knowledge/{id} 详情（书籍在详情内，书目少可 N+1）；
    课程名经 /catalogs/math-qe 映射（缺失时回退 course_id 原文）。
    file_path = 8901 file_path（数据根相对路径，8902 importer 同语义；兼容旧键 relative_path）；
    BookSyncItem 无 sha256/page_count 字段，不发送。
    8901 不可达（list_knowledge 失败）→ TrackerError → 503 由调用方映射。
    """
    tracker: TrackerClient = request.app.state.tracker_client
    knowledge_rows = tracker.list_knowledge()
    course_names: dict[str, str] = {}
    try:
        catalog = tracker.get_catalog("math-qe")
        for t in catalog.get("targets", []):
            cid = t.get("course_id")
            if cid:
                course_names.setdefault(cid, t.get("course_name") or cid)
    except TrackerError:
        course_names = {}  # catalog 不可达不阻塞：课程名回退 course_id
    books: list[dict] = []
    for row in knowledge_rows:
        try:
            detail = tracker.get_knowledge(row["knowledge_id"])
        except TrackerError:
            continue  # 单行详情失败跳过，不阻塞整体同步
        cid = row.get("course_id") or ""
        for b in detail.get("books", []):
            if b.get("status") != "verified":
                continue
            books.append(
                {
                    "book_id": b["book_id"],
                    "domain_id": row.get("domain_id") or "",
                    "course_id": cid,
                    "course_name": course_names.get(cid, cid),
                    "knowledge_id": row.get("knowledge_id") or "",
                    "title": b.get("title") or "",
                    "part": b.get("part") or "",
                    "display_title": b.get("display_title") or "",
                    "authors": _normalize_authors(b.get("authors") or []),
                    "file_path": b.get("file_path") or b.get("relative_path") or "",
                }
            )
    return books


# --- 书目与产物 ---


@router.get("/books")
def list_books(request: Request) -> list:
    """书目列表（含解析进度与课程归属；8902 改读 af_books，REQ-042）。"""
    return _call(request, _axiom(request).list_books)


@router.get("/books/{book_id}")
def get_book(book_id: str, request: Request) -> dict:
    """单本详情（8902 BookOut：file_path/ingest_status 等，前端据此决定 PDF 直显还是降级）。"""
    return _call(request, _axiom(request).get_book, book_id)


@router.get("/books/{book_id}/file")
def get_book_file(book_id: str, request: Request) -> FileResponse:
    """源 PDF 流（原始文件优先直显）：af_books.file_path 数据根相对路径 → inline 返回。

    数据根边界：解析后路径必须仍在 data_root_path 内（`../` 穿越 → 400 阻止）；
    file_path 未登记或磁盘文件缺失 → 404（前端降级提示）；8902 离线 → 503。
    """
    book = _call(request, _axiom(request).get_book, book_id)
    rel = (book or {}).get("file_path") or ""
    if not rel:
        raise HTTPException(status_code=404, detail="该书目未登记源文件路径（file_path 为空）")
    root = Path(request.app.state.settings.data_root_path).resolve()
    path = Path(rel)
    if not path.is_absolute():
        path = root / path
    path = path.resolve()
    if not path.is_relative_to(root):
        raise HTTPException(status_code=400, detail="源文件路径越出数据根边界")
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"源文件不存在：{rel}")
    return FileResponse(
        path, media_type="application/pdf", content_disposition_type="inline", filename=path.name
    )


@router.post("/books/sync")
def sync_books(request: Request) -> dict:
    """同步已验证书目：聚合 8901 verified 书籍 → 8902 upsert af_books（幂等）。

    文档解析管理进入界面/点「同步书目」触发（REQ-042 用户裁决：前端触发同步）。
    """
    try:
        books = _verified_books_from_tracker(request)
    except TrackerError as exc:
        raise HTTPException(
            status_code=_UPSTREAM_UNAVAILABLE,
            detail=f"QED-Tracker 服务不可达（同步取数失败）：{exc}",
        ) from exc
    return _call(request, _axiom(request).sync_books, books)


@router.get("/books/{book_id}/pages/{page_no}")
def get_book_page(book_id: str, page_no: int, request: Request) -> dict:
    """单页完整数据（文档解析管理对照主数据源）。

    8902 PageData 无 page_no 且 image_url 是 8902 相对路径：8900 补写 page_no，
    并把 image_url 重写为本服务页图代理端点的绝对地址（ADR 0007：浏览器只连 8900；
    生产 serve_web.py 不代理 /api，相对路径在生产必断）。
    """
    data = _call(request, _axiom(request).get_book_page, book_id, page_no)
    if isinstance(data, dict):
        data["page_no"] = page_no
        data["image_url"] = str(
            request.url_for("get_book_page_image", book_id=book_id, page_no=page_no)
        )
    return data


@router.get("/books/{book_id}/manifest")
def get_book_manifest(book_id: str, request: Request) -> list:
    """产物清单（文件路径/大小/哈希）。"""
    return _call(request, _axiom(request).get_book_manifest, book_id)


@router.get("/books/{book_id}/pages/{page_no}/image")
def get_book_page_image(book_id: str, page_no: int, request: Request) -> Response:
    """单页原图代理：8902 页图 URL 为相对路径，浏览器只连 8900（ADR 0007），
    由本端点转发图片字节流（8902 离线 → 503 降级）。"""
    try:
        content, media_type = _axiom(request).get_book_page_image(book_id, page_no)
    except AxiomError as exc:
        if exc.status_code is not None and 400 <= exc.status_code < 500:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        raise HTTPException(
            status_code=_UPSTREAM_UNAVAILABLE,
            detail=f"Axiom-Flow 服务不可达：{exc}",
        ) from exc
    return Response(content=content, media_type=media_type)


# --- 块判定（文档解析管理对照标注；8900 /review 门面 → 8902 /edit + /edits，REQ-001） ---


def _review_from_edit(record: dict) -> dict:
    """EditRecord → 前端 BlockReview 形状（保持 8903 契约不变，联调最小改动）。"""
    return {
        "verdict": record.get("verdict") or "",
        "note": record.get("note") or "",
        "block_type": record.get("block_type") or "",
        "book_id": record.get("book_id") or "",
        "page_no": record.get("page_no"),
        "block_index": record.get("block_index"),
    }


@router.put("/books/{book_id}/pages/{page_no}/blocks/{block_index}/review")
def put_block_review(
    book_id: str,
    page_no: int,
    block_index: int,
    body: BlockReviewBody,
    request: Request,
) -> dict:
    """块判定（一致 ok / 不一致 bad + 备注；8902 upsert af_block_edits，重复覆盖）。"""
    record = _call(
        request,
        _axiom(request).edit_block,
        book_id,
        page_no,
        block_index,
        body.verdict,
        body.note,
    )
    return _review_from_edit(record)


@router.get("/books/{book_id}/pages/{page_no}/blocks/{block_index}/review")
def get_block_review(book_id: str, page_no: int, block_index: int, request: Request) -> dict:
    """查询块判定（对照视图回显）：8902 无单块端点，取页级 /edits 过滤；无记录 → 404。"""
    edits = _call(request, _axiom(request).get_page_edits, book_id, page_no)
    for record in edits or []:
        if record.get("block_index") == block_index:
            return _review_from_edit(record)
    raise HTTPException(status_code=404, detail=f"块判定记录不存在：block_index={block_index}")


# --- /edit 门面与 ingest（ARCH-020-B 前置并入 D 轮，2026-09-20） ---


@router.post("/books/{book_id}/ingest")
def ingest_book(book_id: str, request: Request) -> dict:
    """ingest 透传（PDF→页图渲染，不调模型）：列表态「ingest」按钮与工作台引导的硬依赖。"""
    return _call(request, _axiom(request).ingest_book, book_id)


@router.put("/books/{book_id}/pages/{page_no}/blocks/{block_index}/edit")
def put_block_edit(book_id: str, page_no: int, block_index: int, body: BlockEditBody, request: Request) -> dict:
    """块编辑门面（8902 /edit 原样语义）：判定/备注/文字修正/范围修正，返回 EditRecord。"""
    return _call(
        request,
        _axiom(request).edit_block,
        book_id,
        page_no,
        block_index,
        body.verdict,
        body.note,
        body.corrected_text,
        body.corrected_bbox,
    )


@router.get("/books/{book_id}/pages/{page_no}/edits")
def get_page_edits(book_id: str, page_no: int, request: Request) -> list:
    """页级块编辑记录列表（EditRecord[]，编辑态独立刷新）。"""
    return _call(request, _axiom(request).get_page_edits, book_id, page_no)


# --- 解析任务 ---


@router.post("/parse-jobs", status_code=202)
def create_parse_job(body: ParseJobCreateBody, request: Request) -> dict:
    """提交解析任务（book_id、pages、engine）；返回 8902 ParseJob 原样（主键 id、progress 对象）。"""
    return _call(request, _axiom(request).create_parse_job, body.book_id, body.pages, body.engine)


@router.get("/parse-jobs/{job_id}")
def get_parse_job(job_id: str, request: Request) -> dict:
    """任务状态与进度（queued/running/completed/failed）。"""
    return _call(request, _axiom(request).get_parse_job, job_id)


# --- 左侧树聚合（文档解析管理，ARCH-020） ---


@router.get("/parsing/tree")
def get_parsing_tree(request: Request) -> list:
    """左侧树聚合端点：8900 共享表领域课程 + 8902 书目。

    数据源：
    - 领域→课程结构：8900 共享表 list_domains_with_courses()（独立于8902）
    - 书目列表：8902 GET /books（af_books，含解析进度）

    降级逻辑：
    - 8902 离线 → 返回领域→课程（书目为空），前端据此显示降级提示
    - 8900 共享表为空 → 返回空列表
    """
    from qed_engine.services.shared_tables import list_domains_with_courses

    settings = request.app.state.settings

    # 1. 从8900 共享表获取领域→课程结构（独立于8902）
    domains_with_courses = list_domains_with_courses(settings)

    # 2. 从8902获取书目列表（失败时降级为空）
    try:
        books = _axiom(request).list_books()
    except AxiomError:
        books = []  # 8902 离线 → 书目为空，仍显示领域→课程

    # 3. 聚合：按 domain_id + course_id 匹配书目到课程
    return _build_parsing_tree(domains_with_courses, books)


def _build_parsing_tree(domains_with_courses: list, books: list) -> list:
    """构建左侧树结构：领域→课程→书目。"""
    # 按 domain_id + course_id 索引书目；domain 为空（8901 知识行无领域）另建
    # course_id 单键回退索引（课程 id 全库唯一）。
    books_by_course: dict[str, list[dict]] = {}
    books_by_course_only: dict[str, list[dict]] = {}
    for book in books:
        domain_id = book.get("domain_id") or ""
        course_id = book.get("course_id") or ""
        books_by_course.setdefault(f"{domain_id}:{course_id}", []).append(book)
        if not domain_id:
            books_by_course_only.setdefault(course_id, []).append(book)

    result = []
    for domain in domains_with_courses:
        domain_id = domain.get("domain_id", "")
        domain_node = {
            "key": f"domain:{domain_id}",
            "type": "domain",
            "title": domain.get("name", ""),
            "domainId": domain_id,
            "children": [],
        }

        for course in domain.get("courses", []):
            course_id = course.get("course_id", "")
            course_key = f"{domain_id}:{course_id}"
            course_books = books_by_course.get(course_key) or books_by_course_only.get(course_id, [])

            course_node = {
                "key": f"course:{course_key}",
                "type": "course",
                "title": course.get("name", ""),
                "courseId": course_id,
                "domainId": domain_id,
                "children": [
                    {
                        "key": f"book:{b.get('book_id', '')}",
                        "type": "book",
                        "title": b.get("display_title") or b.get("title") or b.get("book_id", ""),
                        "book": b,
                    }
                    for b in course_books
                ],
            }
            domain_node["children"].append(course_node)

        result.append(domain_node)

    return result
