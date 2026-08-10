"""QED-Engine 数据域语义 API：catalogs / resources / tasks 契约归 8900 所有。

前端（8903）只连 8900（ADR 0007）：目录、资源清单/详情/状态机/PDF 预览、任务四端点
统一由本模块暴露，内部经 TrackerClient 适配 8901。路径与前端既有 token 一致，
响应形状对齐 8901 当前结构（契约在 config-center-api.md 数据域章节登记）。

错误映射：8901 返回 4xx（如 409 状态机冲突）→ 同码透传 detail；连接失败/5xx → 503
+ 明确提示（前端据此降级显示，独立性铁律）。

设计关联（DesignRef）：docs/design/config-center-api.md
实现状态：Current
关联测试：tests/test_api.py
"""

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from qed_engine.tracker_client import TrackerClient, TrackerError

router = APIRouter(prefix="/api/v1", tags=["data"])

# 8901 返回 5xx 时统一映射 503（上游不可用），4xx 原样透传（前端既有 409 等处理生效）。
_UPSTREAM_UNAVAILABLE = 503


class RejectBody(BaseModel):
    reason: str


class EvaluateBody(BaseModel):
    course_id: str | None = None


class DownloadBody(BaseModel):
    resource_id: str


def _tracker(request: Request) -> TrackerClient:
    return request.app.state.tracker_client


def _call(request: Request, fn, *args, **kwargs):
    """执行 8901 调用并做错误映射：4xx 透传（409 状态机冲突），其余统一 503。"""
    try:
        return fn(*args, **kwargs)
    except TrackerError as exc:
        if exc.status_code is not None and 400 <= exc.status_code < 500:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        raise HTTPException(
            status_code=_UPSTREAM_UNAVAILABLE,
            detail=f"QED-Tracker 服务不可达：{exc}",
        ) from exc


# --- 目录 ---


@router.get("/catalogs/{course_id}")
def get_catalog(course_id: str, request: Request) -> dict:
    """课程目录（知识点树，下载管理主数据源）。"""
    return _call(request, _tracker(request).get_catalog, course_id)


# --- 资源（清单 / 详情 / 预览 / 状态机） ---


@router.get("/resources")
def list_resources(
    request: Request,
    status: str | None = None,
    course_id: str | None = None,
    kind: str | None = None,
    language: str | None = None,
) -> list:
    """资源清单（按状态/课程/类型/语言过滤，候选视图主数据源）。"""
    return _call(request, _tracker(request).list_resources, status, course_id, kind, language)


@router.get("/resources/{resource_id}")
def get_resource(resource_id: str, request: Request) -> dict:
    """资源详情（详情面板）。"""
    return _call(request, _tracker(request).get_resource, resource_id)


@router.get("/resources/{resource_id}/file")
def resource_file(resource_id: str, request: Request) -> Response:
    """资源原文件（PDF 预览流）：content-type 透传，供 iframe 直读。"""
    tracker = _tracker(request)
    try:
        upstream = tracker.get_resource_file(resource_id)
    except TrackerError as exc:
        raise HTTPException(
            status_code=_UPSTREAM_UNAVAILABLE,
            detail=f"QED-Tracker 服务不可达：{exc}",
        ) from exc
    if upstream.status_code >= 400:
        status = upstream.status_code if upstream.status_code < 500 else _UPSTREAM_UNAVAILABLE
        detail = _upstream_detail(upstream)
        raise HTTPException(status_code=status, detail=detail)
    media_type = upstream.headers.get("content-type", "application/octet-stream")
    return Response(content=upstream.content, media_type=media_type)


def _upstream_detail(upstream: httpx.Response) -> str:
    try:
        body = upstream.json()
    except ValueError:
        return upstream.text
    detail = body.get("detail") if isinstance(body, dict) else None
    return detail if isinstance(detail, str) else upstream.text


def _state_endpoint(action: str):
    """状态机动作端点工厂：confirm / backup / approve / register。"""

    def endpoint(resource_id: str, request: Request) -> dict:
        return _call(request, getattr(_tracker(request), f"{action}_resource"), resource_id)

    return endpoint


for _action in ("confirm", "backup", "approve", "register"):
    router.add_api_route(
        f"/resources/{{resource_id}}/{_action}",
        _state_endpoint(_action),
        methods=["POST"],
        tags=["data"],
    )


@router.post("/resources/{resource_id}/reject")
def reject_resource(resource_id: str, body: RejectBody, request: Request) -> dict:
    """拒绝（候选级或验收级）：reason 必填（8900 校验 422），转发 8901 留痕。"""
    return _call(request, _tracker(request).reject_resource, resource_id, body.reason)


# --- 任务（后台任务 + 轮询） ---


@router.get("/tasks")
def list_tasks(request: Request) -> list:
    """任务列表（前端轮询任务面板）。"""
    return _call(request, _tracker(request).list_tasks)


@router.get("/tasks/{task_id}")
def get_task(task_id: str, request: Request) -> dict:
    """任务详情（前端轮询单任务状态）。"""
    return _call(request, _tracker(request).get_task, task_id)


@router.post("/tasks/catalog/evaluate")
def create_evaluate(body: EvaluateBody, request: Request) -> dict:
    """按课程批量评估任务；缺省=全目录。"""
    return _call(request, _tracker(request).create_evaluate, body.course_id)


@router.post("/tasks/books/download")
def create_download(body: DownloadBody, request: Request) -> dict:
    """创建下载任务；仅 confirmed 状态可触发（上游 409 透传）。"""
    return _call(request, _tracker(request).create_download, body.resource_id)