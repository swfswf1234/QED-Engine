"""探索会话路由（PLAN-022 B3，裁决 D3）：8900 自有探索会话端点，取代旧透传。

前端（8903）探索交互（ExploreFlowModal）经本模块发起/轮询/确认名称/应用/放弃；
管线执行体在 services/explore_sessions.py（内存会话 + 后台线程调 8901 dry-run）。

错误映射：未知会话 404；状态非法 409；参数非法 422；8901 管线错误已由会话
统一落 failed 状态（前端轮询可见），不在路由层重抛。

设计关联（DesignRef）：docs/design/downloads-flow.md
实现状态：Current
关联测试：tests/test_explore_sessions.py
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1", tags=["explore"])


def _manager(request: Request):
    return request.app.state.explore_sessions


class ExploreSessionCreateBody(BaseModel):
    target: str  # domain | course
    mode: str = "direct"  # direct | text | doc
    domain_name: str = ""  # target=domain 必填
    domain_id: str = ""  # 重探时携带（已有领域）
    course_id: str = ""  # target=course 必填
    ref_text: str = ""
    ref_doc_path: str = ""


class ConfirmNameBody(BaseModel):
    name_override: str


class ApplyBody(BaseModel):
    selected: list[dict]  # 领域=课程对象清单；课程=tutorial 套对象清单


@router.post("/explore-sessions", status_code=202)
def create_explore_session(body: ExploreSessionCreateBody, request: Request) -> dict:
    """发起探索会话（202 Accepted + session_id，后台线程执行管线）。"""
    if body.target not in ("domain", "course"):
        raise HTTPException(status_code=422, detail="target 必须为 domain/course")
    if body.mode not in ("direct", "text", "doc"):
        raise HTTPException(status_code=422, detail="mode 必须为 direct/text/doc")
    if body.target == "domain" and not body.domain_name.strip():
        raise HTTPException(status_code=422, detail="target=domain 时 domain_name 必填")
    if body.target == "course" and not body.course_id.strip():
        raise HTTPException(status_code=422, detail="target=course 时 course_id 必填")
    session = _manager(request).create(
        target=body.target,
        mode=body.mode,
        domain_name=body.domain_name.strip(),
        domain_id=body.domain_id.strip(),
        course_id=body.course_id.strip(),
        ref_text=body.ref_text,
        ref_doc_path=body.ref_doc_path,
    )
    return session.to_dict()


@router.get("/explore-sessions/{session_id}")
def get_explore_session(session_id: str, request: Request) -> dict:
    """轮询会话状态（running/waiting_name_confirm/ready/failed）。"""
    session = _manager(request).get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"探索会话不存在或已过期：{session_id}")
    return session.to_dict()


@router.post("/explore-sessions/{session_id}/confirm-name")
def confirm_session_name(session_id: str, body: ConfirmNameBody, request: Request) -> dict:
    """名称确认（waiting_name_confirm → 重跑管线）。"""
    if not body.name_override.strip():
        raise HTTPException(status_code=422, detail="name_override 必填")
    try:
        session = _manager(request).confirm_name(session_id, body.name_override)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"探索会话不存在或已过期：{session_id}") from None
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return session.to_dict()


@router.post("/explore-sessions/{session_id}/apply")
def apply_explore_session(session_id: str, body: ApplyBody, request: Request) -> dict:
    """应用所选变更（领域=逐项建领域/课程；课程=采纳教程）。"""
    if not isinstance(body.selected, list):
        raise HTTPException(status_code=422, detail="selected 必须为数组")
    try:
        return _manager(request).apply(session_id, body.selected)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"探索会话不存在或已过期：{session_id}") from None
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"QED-Tracker 服务不可达：{exc}") from exc


@router.delete("/explore-sessions/{session_id}")
def delete_explore_session(session_id: str, request: Request) -> dict:
    """放弃会话（exploration_stage 回退未开始）。"""
    if not _manager(request).delete(session_id):
        raise HTTPException(status_code=404, detail=f"探索会话不存在或已过期：{session_id}")
    return {"ok": True}
