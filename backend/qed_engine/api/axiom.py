"""数据域·Axiom-Flow 适配路由：parse-jobs / books / pages / manifest 归 8900 所有。

前端（8903）只连 8900（ADR 0007）：解析进度与原始文档对照数据统一由本模块暴露，
内部经 clients/axiom_client.py 适配 8902。契约按 Axiom-Flow 8902-integration-contract.md
（V2-007 冻结草案）：GET /books、GET /books/{id}/pages/{no}、GET /books/{id}/manifest、
POST /parse-jobs、GET /parse-jobs/{id}。

错误映射：8902 返回 4xx（400 参数非法 / 404 book/page 不存在）→ 同码透传 detail；
连接失败/5xx → 503 + 明确提示（前端据此降级显示，独立性铁律：8902 离线不破坏其他界面）。

设计关联（DesignRef）：docs/design/config-center-api.md（8902 契约草案事实源：
Axiom-Flow docs/design/8902-integration-contract.md）
实现状态：Current（契约草案阶段；V2-007 冻结后按回执微调）
关联测试：tests/test_api.py
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from qed_engine.clients.axiom_client import AxiomClient, AxiomError

router = APIRouter(prefix="/api/v1", tags=["data"])

# 8902 返回 5xx 时统一映射 503（上游不可用），4xx 原样透传。
_UPSTREAM_UNAVAILABLE = 503


class ParseJobCreateBody(BaseModel):
    book_id: str
    pages: list[int] | None = None
    strategy: str = "hybrid"


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


# --- 书目与产物 ---


@router.get("/books")
def list_books(request: Request) -> list:
    """书目列表（含解析进度）。"""
    return _call(request, _axiom(request).list_books)


@router.get("/books/{book_id}/pages/{page_no}")
def get_book_page(book_id: str, page_no: int, request: Request) -> dict:
    """单页完整数据（原页图 URL + markdown + blocks，原始文档对照主数据源）。"""
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


# --- 解析任务 ---


@router.post("/parse-jobs", status_code=202)
def create_parse_job(body: ParseJobCreateBody, request: Request) -> dict:
    """提交解析任务（book_id、pages、strategy）；返回任务状态（queued）。"""
    return _call(request, _axiom(request).create_parse_job, body.book_id, body.pages, body.strategy)


@router.get("/parse-jobs/{job_id}")
def get_parse_job(job_id: str, request: Request) -> dict:
    """任务状态与进度（queued/running/completed/failed）。"""
    return _call(request, _axiom(request).get_parse_job, job_id)
