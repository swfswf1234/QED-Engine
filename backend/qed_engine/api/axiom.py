"""数据域·Axiom-Flow 适配路由：parse-jobs / books / pages / manifest / parsing/tree 归 8900 所有。

前端（8903）只连 8900（ADR 0007）：解析进度与文档解析管理（左树右对照）数据统一由
本模块暴露，内部经 clients/axiom_client.py 适配 8902。契约按 Axiom-Flow
8902-integration-contract.md（V2-007 冻结草案）与 af-books-sync.md（REQ-042 同步开发）：
GET /books、GET /books/{id}/pages/{no}、GET /books/{id}/manifest、POST /parse-jobs、
GET /parse-jobs/{id}、POST /books/sync（聚合 8901 verified 书籍转发 8902 upsert）、
PUT/GET /books/{id}/pages/{no}/blocks/{index}/review（块判定）、
GET /parsing/tree（左侧树聚合：8900 共享表领域课程 + 8902 书目）。

错误映射：8902 返回 4xx（400 参数非法 / 404 book/page 不存在）→ 同码透传 detail；
连接失败/5xx → 503 + 明确提示（前端据此降级显示，独立性铁律：8902 离线不破坏其他界面）。
/books/sync 同时依赖 8901（取数）：8901 不可达 → 503 + 「QED-Tracker 服务不可达」提示。

设计关联（DesignRef）：docs/architecture/api-contracts.md（8902 契约草案事实源：
Axiom-Flow docs/design/8902-integration-contract.md）、docs/design/af-books-sync.md
实现状态：Current（契约草案阶段；V2-007 冻结后按回执微调）
关联测试：tests/test_api.py
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from qed_engine.clients.axiom_client import AxiomClient, AxiomError
from qed_engine.clients.tracker_client import TrackerClient, TrackerError

router = APIRouter(prefix="/api/v1", tags=["data"])

# 8902 返回 5xx 时统一映射 503（上游不可用），4xx 原样透传。
_UPSTREAM_UNAVAILABLE = 503


class ParseJobCreateBody(BaseModel):
    book_id: str
    pages: list[int] | None = None
    strategy: str = "hybrid"


class BlockReviewBody(BaseModel):
    verdict: str = Field(pattern="^(ok|bad)$")
    note: str = Field(default="", max_length=1000)


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


def _verified_books_from_tracker(request: Request) -> list[dict]:
    """聚合 8901 已验证（verified）书籍，归一化为 af_books 同步 payload。

    取数：/knowledge 列表 + 逐行 /knowledge/{id} 详情（书籍在详情内，书目少可 N+1）；
    课程名经 /catalogs/math-qe 映射（缺失时回退 course_id 原文）。
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
                    "authors": b.get("authors") or [],
                    "sha256": b.get("sha256") or "",
                    "relative_path": b.get("relative_path") or "",
                    "page_count": b.get("page_count"),
                }
            )
    return books


# --- 书目与产物 ---


@router.get("/books")
def list_books(request: Request) -> list:
    """书目列表（含解析进度与课程归属；8902 改读 af_books，REQ-042）。"""
    return _call(request, _axiom(request).list_books)


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
    """单页完整数据（原页图 URL + markdown + blocks，文档解析管理对照主数据源）。"""
    return _call(request, _axiom(request).get_book_page, book_id, page_no)


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


# --- 块判定（文档解析管理对照标注，REQ-042） ---


@router.put("/books/{book_id}/pages/{page_no}/blocks/{block_index}/review")
def put_block_review(
    book_id: str,
    page_no: int,
    block_index: int,
    body: BlockReviewBody,
    request: Request,
) -> dict:
    """块判定（一致 ok / 不一致 bad + 备注；upsert af_block_reviews）。"""
    return _call(
        request,
        _axiom(request).review_block,
        book_id,
        page_no,
        block_index,
        body.verdict,
        body.note,
    )


@router.get("/books/{book_id}/pages/{page_no}/blocks/{block_index}/review")
def get_block_review(book_id: str, page_no: int, block_index: int, request: Request) -> dict:
    """查询块判定（对照视图回显；无判定 → 8902 404 透传）。"""
    return _call(request, _axiom(request).get_block_review, book_id, page_no, block_index)


# --- 解析任务 ---


@router.post("/parse-jobs", status_code=202)
def create_parse_job(body: ParseJobCreateBody, request: Request) -> dict:
    """提交解析任务（book_id、pages、strategy）；返回任务状态（queued）。"""
    return _call(request, _axiom(request).create_parse_job, body.book_id, body.pages, body.strategy)


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
    # 按 domain_id + course_id 索引书目
    books_by_course: dict[str, list[dict]] = {}
    for book in books:
        domain_id = book.get("domain_id", "")
        course_id = book.get("course_id", "")
        key = f"{domain_id}:{course_id}"
        if key not in books_by_course:
            books_by_course[key] = []
        books_by_course[key].append(book)

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
            course_books = books_by_course.get(course_key, [])

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
