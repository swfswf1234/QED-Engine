"""数据域·Axiom-Flow 适配路由：parse-jobs / books / pages / manifest / parsing/tree 归 8900 所有。

前端（8903）只连 8900（ADR 0007）：解析进度与文档解析管理（左树右对照）数据统一由
本模块暴露，内部经 clients/axiom_client.py 适配 8902。契约按 Axiom-Flow
docs/architecture/api.md（v2 冻结契约）与其 REQ-001（8900 侧适配）：
GET /books、GET /books/{id}（单本详情）、GET /books/{id}/file（源 PDF inline 流，数据根边界校验）、
GET /books/{id}/pages/{no}（8900 补写 page_no、重写 image_url 为 8900 代理绝对地址）、
GET /books/{id}/manifest、POST /parse-jobs（engine 字段）、GET /parse-jobs（列表，book_id/status 过滤透传）、
GET /parse-jobs/{id}、
POST /books/sync（聚合 8901 verified 书籍，按 BookSyncItem 形状转发 8902 upsert）、
PUT/GET /books/{id}/pages/{no}/blocks/{index}/review（8900 对前端保持 /review 门面与
BlockReview 响应形状，内部转 8902 /edit + 页级 /edits 过滤）、
GET /parsing/tree（左侧树聚合信封：nodes ＋ sources 两种降级来源标记）。

④ 知识点梳理透传面（af_kp，REQ-141 W2／REQ-143 W6）：kp-jobs 提交与进度、books/{id}/kp 工作区、
kp/nodes/{id} 的 PATCH 与 confirm、kp/nodes/{id}/summary（单点重生成）、kp/nodes/{id}/narrative
的写与读（长文两条腿）、books/{id}/kp/outline、books/{id}/kp/export 十条腿
**一比一镜像** 8902 路径，状态码与正文原样回、请求体不预检（接口与库变更全归 Axiom-Flow，
判定序／闭集／列域正本都在 8902）；本组只映射「连接失败 → 503 不可达」。

错误映射：8902 返回 4xx（400 参数非法 / 404 book/page 不存在）→ 同码透传 detail；
连接失败/5xx → 503 + 明确提示（前端据此降级显示，独立性铁律：8902 离线不破坏其他界面）。
/books/sync 同时依赖 8901（取数）：8901 不可达 → 503 + 「QED-Tracker 服务不可达」提示。

设计关联（DesignRef）：docs/architecture/api-contracts.md（8902 透传组事实源：
Axiom-Flow docs/architecture/api.md）
实现状态：Current（联调对齐轮：/edit 门面、BookSyncItem、engine/id/progress、page_no 补写；af_kp 十条透传腿）
关联测试：tests/test_api.py
"""

from pathlib import Path
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from qed_engine.clients.axiom_client import API_PREFIX, AxiomClient, AxiomError
from qed_engine.clients.tracker_client import TrackerClient, TrackerError

router = APIRouter(prefix="/api/v1", tags=["data"])

# 8902 返回 5xx 时统一映射 503（上游不可用），4xx 原样透传。
_UPSTREAM_UNAVAILABLE = 503

# 单点重生成是同步腿（一次百秒级模型调用），30s 缺省超时先于模型返回就断；取 8902 网关自身
# 的 360s 上限为界——根侧再长也等不到，只会让上游已经写完的总结被本层当成失败。
_KP_SYNC_TIMEOUT = 360.0


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
    # 类型改判闭集正本在 8902 BlockType（十枚）；本门只挡形状，生效类型由 8902 读侧叠加到块序列
    corrected_type: str | None = Field(
        default=None,
        pattern="^(heading|paragraph|formula|table|image|list|caption|header|footer|page_number)$",
    )


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
    """块编辑门面（8902 /edit 原样语义）：判定/备注/文字修正/范围修正/类型改判，返回 EditRecord。"""
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
        body.corrected_type,
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


@router.get("/parse-jobs")
def list_parse_jobs(
    request: Request,
    book_id: Annotated[str | None, Query()] = None,
    status: Annotated[list[str] | None, Query()] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """任务列表（透传 8902 GET /parse-jobs：book_id/status 过滤 + active 标记）。

    前端打开工作台时用它恢复服务端在飞任务（防止重开界面后重复建任务）。
    8902 旧码无此端点 → 4xx 原样透传，前端自行降级。
    """
    return _call(
        request,
        _axiom(request).list_parse_jobs,
        status=status,
        book_id=book_id,
        limit=limit,
        offset=offset,
    )


@router.get("/parse-jobs/{job_id}")
def get_parse_job(job_id: str, request: Request) -> dict:
    """任务状态与进度（queued/running/completed/failed）。"""
    return _call(request, _axiom(request).get_parse_job, job_id)


# --- ④ 知识点梳理透传面（af_kp，一比一镜像；REQ-141 W2／第三令职责边界） ---


def _seg(value: str) -> str:
    """路径段单段化（`%2F` 解码后仍是一枚段，不给 8902 的路由留重解释的余地）。"""
    return quote(value, safe="")


def _kp_relay(
    request: Request,
    method: str,
    path: str,
    body: dict | None = None,
    *,
    timeout: float | None = None,
) -> Response:
    """梳理腿的唯一通路：8902 回什么状态码与正文就回什么，只有连接失败合成 503。

    不复用 `_call`（解析面把 4xx 转写成 `{"detail": …}`）是刻意的：confirm 的 422 正文与 200
    同形、`if_rev` 冲突的 409 先于形状校验、槽位未接入是上游主动的 503——套一层 detail 就把
    形状丢了。请求体也不预检：闭集与列域正本都在 8902（`extra="forbid"`），在此再校验一份等于
    给同一形状维护第二处事实源，漂移只会藏进映射里。`timeout` 只给同步长腿用，缺省沿用客户端设置。
    """
    try:
        status_code, content, media_type = _axiom(request).kp_relay(
            method, path, body, timeout=timeout
        )
    except AxiomError as exc:
        raise HTTPException(
            status_code=_UPSTREAM_UNAVAILABLE,
            detail=f"Axiom-Flow 服务不可达：{exc}",
        ) from exc
    return Response(content=content, status_code=status_code, media_type=media_type)


@router.post("/kp-jobs")
def create_kp_job(request: Request, payload: dict) -> Response:
    """提交梳理批次（202 受理，批次号由 8902 发放）。

    请求体是 `book_id`、可选页区间与可选人工评审备注 `review_note`：**没有 `engine` 字段**（引擎取
    8902 槽位 `AXIOM_KP_ENGINE`），页区间给出即单章范围、缺省整本；备注由 8902 注入该轮 prompt 并随
    批次流水存档（`KA-31`），本层不解释也不校验。六道受理门（404／422／422／409／503／503）全判在
    写入前，本服务不重复判。
    """
    return _kp_relay(request, "POST", f"{API_PREFIX}/kp-jobs", payload)


@router.get("/books/{book_id}/kp-jobs/{gen_batch}")
def get_kp_job(book_id: str, gen_batch: str, request: Request) -> Response:
    """单批次进度与流水账面（`in_flight` 看本批 `draft` 行，不看流水 `status`）。"""
    return _kp_relay(
        request, "GET", f"{API_PREFIX}/books/{_seg(book_id)}/kp-jobs/{_seg(gen_batch)}"
    )


@router.get("/books/{book_id}/kp")
def get_kp_workspace(book_id: str, request: Request) -> Response:
    """整册梳理工作区（目录＋点＋未归档池＋复核标记，不分页）；空 `nodes` 是合法现状。"""
    return _kp_relay(request, "GET", f"{API_PREFIX}/books/{_seg(book_id)}/kp")


@router.patch("/kp/nodes/{node_id}")
def patch_kp_node(node_id: str, request: Request, payload: dict) -> Response:
    """人工背书域写入（只发被点名的键；显式 `null` 与缺席是两件事，本层不改写请求体）。"""
    return _kp_relay(request, "PATCH", f"{API_PREFIX}/kp/nodes/{_seg(node_id)}", payload)


@router.post("/kp/nodes/{node_id}/confirm")
def confirm_kp_node(node_id: str, request: Request, payload: dict) -> Response:
    """确认／撤回（置位跑可回指校验，撤回永远可执行；422 与 200 同形，界面判 `missing`）。"""
    return _kp_relay(
        request, "POST", f"{API_PREFIX}/kp/nodes/{_seg(node_id)}/confirm", payload
    )


@router.post("/kp/nodes/{node_id}/summary")
def regenerate_kp_summary(node_id: str, request: Request, payload: dict) -> Response:
    """知识点单点重生成（`KA-45`）＝详情面「重新生成总结」的落点。

    请求体只有 `if_rev`；「只有知识点可重生成」「在飞批次 409」「模型空回复不写」全判在 8902。
    这一腿同步等模型返回（一次百秒级调用），故显式放长上流超时；本层仍只搬状态码与正文，
    不预检、不重判。
    """
    return _kp_relay(
        request,
        "POST",
        f"{API_PREFIX}/kp/nodes/{_seg(node_id)}/summary",
        payload,
        timeout=_KP_SYNC_TIMEOUT,
    )


@router.put("/kp/nodes/{node_id}/narrative")
def put_kp_narrative(node_id: str, request: Request, payload: dict) -> Response:
    """长文写腿（正文落 8902 的书目录并写指针列，200 回显正文）。

    上限、判定序与是否落盘全判在 8902：本层连正文长度都不预览——在此再校一道等于给同一形状
    维护第二处事实源，而 409 那条**先于磁盘写入**的 detail 带着「当前 rev」，是要显示给人重发用的。
    """
    return _kp_relay(request, "PUT", f"{API_PREFIX}/kp/nodes/{_seg(node_id)}/narrative", payload)


@router.get("/kp/nodes/{node_id}/narrative")
def get_kp_narrative(node_id: str, request: Request) -> Response:
    """长文读回（8902 按派生路径读文件而不读列）；缺文件是 200 带 `exists=false`，不是 404。"""
    return _kp_relay(request, "GET", f"{API_PREFIX}/kp/nodes/{_seg(node_id)}/narrative")


@router.put("/books/{book_id}/kp/outline")
def put_kp_outline(book_id: str, request: Request, payload: dict) -> Response:
    """目录整批声明（缺席只降级、不删行、幂等）。"""
    return _kp_relay(request, "PUT", f"{API_PREFIX}/books/{_seg(book_id)}/kp/outline", payload)


@router.get("/books/{book_id}/kp/export")
def get_kp_export(book_id: str, request: Request) -> Response:
    """已确认视图（`confirmed=1`，目录先于点）＝根侧只读拉取面。"""
    return _kp_relay(request, "GET", f"{API_PREFIX}/books/{_seg(book_id)}/kp/export")


# --- 左侧树聚合（文档解析管理，ARCH-020） ---


@router.get("/parsing/tree")
def get_parsing_tree(request: Request) -> dict:
    """左侧树聚合端点（信封形状）：`{"nodes": [...], "sources": {...}}`。

    数据源：
    - 领域→课程结构：8900 共享表 list_domains_with_courses()（独立于 8902）
    - 书目列表：8902 GET /books（af_books，含解析进度）

    `sources` 把两种降级写成可区分的事实（DEFECT-015 S3）：修复前 8902 离线只把书目置空、
    共享表为空只落空数组，两者同形使「页面为什么是空的」无从判定；现在
    - `axiom_flow`：`ok`／`offline`（离线时 `nodes` 仍出领域→课程，只是课程下无书目）；
    - `shared_tables`：`ok`／`empty`（为空时整棵树为空数组，与管理库是否连通无关的登记缺口）。
    """
    from qed_engine.services.shared_tables import list_domains_with_courses

    settings = request.app.state.settings

    # 1. 从 8900 共享表获取领域→课程结构（独立于 8902）
    domains_with_courses = list_domains_with_courses(settings)

    # 2. 从 8902 获取书目列表（失败时降级为空，但仍如实回报来源）
    try:
        books = _axiom(request).list_books()
        axiom_flow = "ok"
    except AxiomError:
        books = []  # 8902 离线 → 书目为空，仍显示领域→课程
        axiom_flow = "offline"

    # 3. 聚合：按 domain_id + course_id 匹配书目到课程
    return {
        "nodes": _build_parsing_tree(domains_with_courses, books),
        "sources": {
            "shared_tables": "empty" if not domains_with_courses else "ok",
            "axiom_flow": axiom_flow,
        },
    }


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
