"""数据域·QED-Tracker 适配路由：catalogs / tasks / selections / downloads 归 8900 所有。

前端（8903）只连 8900（ADR 0007）：目录、任务四端点、三表语义（表1 选课表 / 表2 册级明细 /
表3 渠道来源）统一由本模块暴露，内部经 clients/tracker_client.py 适配 8901。路径与前端既有
token 一致，响应形状对齐 8901 当前结构（契约在 config-center-api.md 数据域章节登记；三表契约
见 downloads-three-table-model.md §3.2）。qt_resources 旧 /resources 端点已随 QED-030 退役。

错误映射：8901 返回 4xx（如 409 状态机冲突）→ 同码透传 detail；连接失败/5xx → 503
+ 明确提示（前端据此降级显示，独立性铁律）。

设计关联（DesignRef）：docs/design/config-center-api.md
实现状态：Current
关联测试：tests/test_api.py
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from qed_engine.clients.tracker_client import TrackerClient, TrackerError

router = APIRouter(prefix="/api/v1", tags=["data"])

# 8901 返回 5xx 时统一映射 503（上游不可用），4xx 原样透传（前端既有 409 等处理生效）。
_UPSTREAM_UNAVAILABLE = 503


# --- 三表（downloads-three-table-model §3.2）：表1 生命周期 / 表2 册级 / 表3 来源 ---


class SelectionStateBody(BaseModel):
    note: str | None = None


class SelectionRejectBody(BaseModel):
    reason: str
    note: str | None = None


class SupersedeBody(BaseModel):
    reason: str


class DownloadCreateBody(BaseModel):
    selection_id: str
    vol: str | None = None
    file_hint: str | None = None


class DownloadRejectBody(BaseModel):
    reason: str


class DownloadRegisterBody(BaseModel):
    relative_path: str


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


# --- 任务（后台任务 + 轮询） ---


@router.get("/tasks")
def list_tasks(request: Request) -> list:
    """任务列表（前端轮询任务面板）。"""
    return _call(request, _tracker(request).list_tasks)


@router.get("/tasks/{task_id}")
def get_task(task_id: str, request: Request) -> dict:
    """任务详情（前端轮询单任务状态）。"""
    return _call(request, _tracker(request).get_task, task_id)


# --- 三表（downloads-three-table-model §3.2）：选课表 / 册级明细 / 渠道来源 ---


@router.get("/selections")
def list_selections(
    request: Request,
    course_id: str | None = None,
    status: str | None = None,
) -> list:
    """表1 选课表列表（按课程/状态过滤）；rejected/superseded 彻底隐藏由上游数据层保证。"""
    return _call(request, _tracker(request).list_selections, course_id, status)


@router.get("/selections/{selection_id}")
def get_selection(selection_id: str, request: Request) -> dict:
    """表1 套书详情（含该条目表2 册明细列表）。"""
    return _call(request, _tracker(request).get_selection, selection_id)


@router.post("/selections/{selection_id}/confirm")
def confirm_selection(selection_id: str, body: SelectionStateBody, request: Request) -> dict:
    """表1 候选→确认入书单（可选评审建议 note）。"""
    return _call(request, _tracker(request).confirm_selection, selection_id, body.note)


@router.post("/selections/{selection_id}/backup")
def backup_selection(selection_id: str, body: SelectionStateBody, request: Request) -> dict:
    """表1 候选→备选（可选评审建议 note，可转正/放弃）。"""
    return _call(request, _tracker(request).backup_selection, selection_id, body.note)


@router.post("/selections/{selection_id}/reject")
def reject_selection(selection_id: str, body: SelectionRejectBody, request: Request) -> dict:
    """表1 否定（reason 必填 422，可选 note）；rejected 终态彻底隐藏。"""
    return _call(request, _tracker(request).reject_selection, selection_id, body.reason, body.note)


@router.post("/selections/{selection_id}/supersede")
def supersede_selection(selection_id: str, body: SupersedeBody, request: Request) -> dict:
    """表1 confirmed→superseded（被新版本替代，reason 必填）；旧版本前端不再可见。"""
    return _call(request, _tracker(request).supersede_selection, selection_id, body.reason)


@router.get("/resources/{selection_id}/downloads")
def list_selection_downloads(selection_id: str, request: Request) -> list:
    """表2 册级明细（按 selection_id 过滤）；rejected/failed 默认过滤由上游数据层保证。"""
    return _call(request, _tracker(request).list_selection_downloads, selection_id)


@router.post("/downloads")
def create_download_candidate(body: DownloadCreateBody, request: Request) -> list:
    """表2 新建候选册（下载预登记，先登记再下载）；vol 省略时上游按表1 vols 生成全部候选册。"""
    return _call(
        request,
        _tracker(request).create_download_candidate,
        body.selection_id,
        body.vol,
        body.file_hint,
    )


@router.post("/downloads/{download_id}/approve")
def approve_download(download_id: str, request: Request) -> dict:
    """表2 册级验收通过（审理达预期）。"""
    return _call(request, _tracker(request).approve_download, download_id)


@router.post("/downloads/{download_id}/reject")
def reject_download(download_id: str, body: DownloadRejectBody, request: Request) -> dict:
    """表2 册级否定（reason 必填 422，硬删 + 留痕）。"""
    return _call(request, _tracker(request).reject_download, download_id, body.reason)


@router.post("/downloads/{download_id}/register")
def register_download(download_id: str, body: DownloadRegisterBody, request: Request) -> dict:
    """表2 人工下载登记（数据根内相对路径，校验后 downloaded）。"""
    return _call(request, _tracker(request).register_download, download_id, body.relative_path)


@router.get("/downloads/{download_id}/sources")
def list_download_sources(download_id: str, request: Request) -> list:
    """表3 渠道尝试列表（详情弹窗）；失败尝试留痕不展示由上游过滤。"""
    return _call(request, _tracker(request).list_download_sources, download_id)
