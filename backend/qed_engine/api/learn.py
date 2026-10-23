"""学习域路由（/api/v1/learn/*，27 端点）：v1.0 三表口径的 8900 自有域（非透传）。

模块职责：课程引用式注册（course 行直接引用共享 `qed_course.course_id`，ADR 0026 D4）、
知识点终态与质性门（kp 行）、派生进度与门游标只读；知识点体系（星图聚合、point 行直登记
与跨课程检索、长文正文按 `narrative_ref` 读文件、章/条注解按需生成、outline 整树幂等替换
与归属移动）；练习与复习（题源书目透传、批量入库幂等跳重、题面敏感列投影、作答同事务判分、
到期队列由作答流水重放、错题本派生查询与纯人工位）。
单元树族与编译族、候选池族已随 ADR 0026 D1/D2 退出：知识点序列＝主表 point 行的读时投影
（派生键 `kp:{kp_id}`，零物化），多角度叙述与长文指针改由主表 `angles`／`narrative_ref` 承载。
错误包络：8900 自有校验=中文纯文本 detail（api-contracts 通用约定）。
设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current
关联测试：tests/test_learn.py、tests/test_learn_knowledge.py、tests/test_learn_practice.py
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator
from qed_engine.services.learn import annotations as learn_annotations
from qed_engine.services.learn import mastery
from qed_engine.services.learn.base import (
    KP_TARGET,
    LearnConflict,
    LearnNotFound,
    derive_books_progress,
    derive_progress,
)
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
# 教程套面向对象（qt_knowledge.position 五档）中文口径（书架清单卡片徽章）
POSITION_LABELS = {
    "beginner": "入门",
    "intermediate": "进阶",
    "advanced": "深入",
    "comprehensive": "综合",
    "elective": "选修",
}
# 星图未归 track 的兜底簇名
STARMAP_UNSORTED_TRACK = "未归类"
# 三域存储懒挂载的重试窗口（判例 DEFECT-009）：瞬断恢复后无需重启进程即可自愈
KNOWLEDGE_MOUNT_RETRY_SECONDS = 60.0
LEARN_MOUNT_RETRY_SECONDS = 60.0
PRACTICE_MOUNT_RETRY_SECONDS = 60.0
# 注解条级腿的新落点（ADR 0026 D10）：生成用途 → 主表 `angles[].angle`（六词闭集内的既有值）
PART_ANGLES: dict[str, str] = {"annotation": "explanation"}
# 长文正文双闸（D5）：只允许数据根内 `parsed/**`，正文不落库
NARRATIVE_ALLOWED_PREFIX = "parsed"
NARRATIVE_MAX_BYTES = 512_000


class ResourceRef(BaseModel):
    kind: str
    ref_id: str
    label: str
    dismissed: bool = False

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


class CourseCreateBody(BaseModel):
    """把学习课程加入学习面＝插一枚 course 行，`course_id` 即共享表主键（D4：无独立 ID）。

    `extra=forbid`＝owner 等存储列不可由请求侧指定（D7：所有权只由服务端注入）。
    """

    model_config = {"extra": "forbid"}

    course_id: str = Field(min_length=1)
    resources: list[ResourceRef] = Field(min_length=1)
    kp_path: list[str] = Field(default_factory=list)
    learner_note: str = ""


class CoursePatchBody(BaseModel):
    """课程行白名单（extra=forbid）：名称/领域/坐标列不在学习表，改这些归共享表写面。"""

    model_config = {"extra": "forbid"}

    status: Literal["active", "paused", "done"] | None = None
    resources: list[ResourceRef] | None = None
    kp_path: list[str] | None = None
    learner_note: str | None = None


class ProgressBody(BaseModel):
    """勾选落笔（kp 行终态位）：`pending`＝撤销，附带学习者备注。"""

    model_config = {"extra": "forbid"}

    kp_id: str = Field(min_length=1)
    status: Literal["done", "skipped", "pending"]
    note: str = Field(default="", max_length=2000)


# ---------- 学习域存储挂载与守卫 ----------


def _store(request: Request) -> Any:
    store = getattr(request.app.state, "learn_store", None)
    if store is None:
        store = _mount_learn_store(request.app)
    if store is None:
        raise HTTPException(status_code=503, detail="学习域存储不可用（数据库离线且无注入存储）")
    return store


def _optional_learn(request: Request) -> Any | None:
    """学习记录可得性探测（知识点面的读侧便利）：不可得返回 None，知识点面照常出主数据。"""
    store = getattr(request.app.state, "learn_store", None)
    if store is not None:
        return store
    try:
        return _mount_learn_store(request.app)
    except Exception:  # noqa: BLE001 - 学习腿只是序列与勾选位，不可达时不拦知识点检索
        return None


def _mount_learn_store(app: Any) -> Any | None:
    """`qe_learning` 懒接入：首个 /learn 课程请求幂等建表并挂载（判例 DEFECT-009）。

    启动路径不触碰 MySQL（隔离铁律：测试 create_app 不连真实库）；未配置密码直接降级。
    建表失败只锁 `LEARN_MOUNT_RETRY_SECONDS` 秒。
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
            "学习记录表建表跳过（数据库不可达），%.0fs 后重试：%s",
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


# ---------- 知识点序列的读时投影（§V2.3：派生键 `kp:{kp_id}`，零物化） ----------


def _order_key(row: dict[str, Any]) -> tuple[int, str, str]:
    """章序/知识点序统一口径：有 `order_hint` 者在前，其余按创建序。"""
    hint = row.get("order_hint")
    return (
        hint if isinstance(hint, int) else 9999,
        str(row.get("created_at") or ""),
        str(row.get("kp_id") or ""),
    )


def _resolve_window(
    point: dict[str, Any], chain: list[dict[str, Any]], default_ref_id: str
) -> tuple[dict[str, Any] | None, str]:
    """取材页窗三级回落：知识点自身 → 来源锚点页 → 所属章页窗（整章呈现由 window_source 标注）。"""
    ref = point.get("source_ref") or {}
    if ref.get("page_start") or ref.get("page_end"):
        return {**ref, "ref_id": ref.get("ref_id") or default_ref_id}, "point"
    anchors = [a for a in (point.get("anchors") or []) if isinstance(a, dict) and a.get("page")]
    if anchors:
        pages = [int(a["page"]) for a in anchors]
        return (
            {
                "kind": "book",
                "ref_id": anchors[0].get("ref_id") or default_ref_id,
                "page_start": min(pages),
                "page_end": max(pages),
            },
            "anchor",
        )
    for node in reversed(chain):
        src = node.get("source_ref") or {}
        if src.get("page_start") or src.get("page_end"):
            return {**src, "ref_id": src.get("ref_id") or default_ref_id}, "chapter"
    return None, ""


def _point_and_chain(
    point: dict[str, Any], by_kp: dict[str, dict[str, Any]]
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    chain: list[dict[str, Any]] = []
    parent = point.get("parent_kp_id")
    while parent:
        node = by_kp.get(str(parent))
        if node is None:
            break
        chain.append(node)
        if node.get("depth") == 1:
            break
        parent = node.get("parent_kp_id")
    return point, chain


def _course_tree(
    request: Request, store: Any, course: dict[str, Any]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """课程学习序列＝共享主表 point 行 × 章(outline) 的读时投影 + kp 行落笔态。

    三级形态沿用 M6：知识点归属折叠到所属章（`parent_kp_id` 为空的未归档知识点不进推进序列，
    整理归文档分析处理面）；`kp_path` 非空时按学习者给定的顺序重排，未列入者按默认序垫尾。
    """
    rows = store.kp_rows()
    knowledge = _optional_knowledge(request)
    course_id = str(course["learn_course_id"])
    if knowledge is None:
        return [], [], rows
    outline_rows = knowledge.list_outline(course_id)
    by_kp = {str(row["kp_id"]): row for row in outline_rows}
    points, _total = knowledge.list_points(course_id=course_id, kind="point", limit=1000)
    book_refs = [
        str(r.get("ref_id") or "")
        for r in (course.get("resources") or [])
        if str(r.get("kind") or "") == "book"
    ]
    course_ref = book_refs[0] if book_refs else ""
    chapters = sorted((row for row in outline_rows if row.get("depth") == 1), key=_order_key)
    nested = [
        (
            chapter,
            sorted(
                [
                    (point, chain)
                    for point, chain in (_point_and_chain(p, by_kp) for p in points)
                    if chain and chain[-1]["kp_id"] == chapter["kp_id"]
                ],
                key=lambda pair: _order_key(pair[0]),
            ),
        )
        for chapter in chapters
    ]
    units: list[dict[str, Any]] = []
    chapter_out: list[dict[str, Any]] = []
    seq = 0
    for chapter, members in nested:
        chapter_key = f"kp:{chapter['kp_id']}"
        chapter_out.append(
            {
                **_point_out(chapter),
                "unit_id": chapter_key,
                "point_count": len(members),
                # 章级注解成品位：进场一次随目录直读，缺失由前端出「生成」入口
                "key_points": list((chapter.get("meta") or {}).get("chapter_key_points") or []),
            }
        )
        for point, chain in members:
            default_ref = str(chapter.get("book_ref") or "") or course_ref
            source_ref, window_source = _resolve_window(point, chain, default_ref)
            units.append(
                {
                    **_point_out(point),
                    "unit_id": f"kp:{point['kp_id']}",
                    "parent_id": chapter_key,
                    "chapter_kp_id": chapter["kp_id"],
                    "title": point["name"],
                    "sort_order": seq,
                    "source_ref": source_ref,
                    "window_source": window_source,
                }
            )
            seq += 1
    kp_path = [str(kp_id) for kp_id in (course.get("kp_path") or [])]
    if kp_path:
        rank = {kp_id: index for index, kp_id in enumerate(kp_path)}
        units.sort(key=lambda unit: rank.get(str(unit["kp_id"]), len(rank) + unit["sort_order"]))
        for index, unit in enumerate(units):
            unit["sort_order"] = index
    return units, chapter_out, rows


def _tree_or_404(units: list[dict[str, Any]], kp_id: str) -> dict[str, Any]:
    """投影序列里没有这一条＝404（未归档池与别课知识点都不给落笔、不给生成）。"""
    unit = next((row for row in units if str(row.get("kp_id") or "") == kp_id), None)
    if unit is None:
        raise HTTPException(status_code=404, detail=f"学习域实体不存在：{kp_id}")
    return unit


def _books_out(
    units: list[dict[str, Any]], rows: dict[str, dict[str, Any]], course: dict[str, Any]
) -> list[dict[str, Any]]:
    """教材级进度（书架清单卡片用）：book 素材逐个给出，无计数单位者 total=0。

    归集口径与 `derived.total/done` 同源（投影行的取材 `source_ref.ref_id`），故素材外但
    知识点行引用了的 ref 也补入，标签回落 ref_id。
    """
    progress = {str(row["ref_id"]): row for row in derive_books_progress(units, rows)}
    labels: dict[str, str] = {}
    ordered: list[str] = []
    for res in course.get("resources") or []:
        ref_id = str(res.get("ref_id") or "")
        if not ref_id:
            continue
        labels.setdefault(ref_id, str(res.get("label") or ""))
        if str(res.get("kind") or "") == "book" and ref_id not in ordered:
            ordered.append(ref_id)
    for ref_id in progress:
        if ref_id not in ordered:
            ordered.append(ref_id)
    return [
        {
            "ref_id": ref_id,
            "label": labels.get(ref_id) or ref_id,
            "total": int(progress.get(ref_id, {}).get("total") or 0),
            "done": int(progress.get(ref_id, {}).get("done") or 0),
            "percent": float(progress.get(ref_id, {}).get("percent") or 0.0),
        }
        for ref_id in ordered
    ]


# ---------- 主链 M-3：门与判分（门态清单 · 质性判定 · 游标） ----------

MASTERY_ITEM_FIELDS = (
    "unit_id",
    "kp_id",
    "kp_type",
    "gate",
    "mastery",
    "threshold",
    "attempt_count",
    "provenance",
    "status",
    "qualitative_passed",
    "due_reviews",
)


class MasteryAssessBody(BaseModel):
    """质性门判定（D-M3-2：v1 只有学习者自评位，`model` 判读腿属 M-3b）。"""

    model_config = {"extra": "forbid"}

    kp_id: str = Field(min_length=1)
    passed: bool
    note: str = Field(default="", max_length=1000)
    by: Literal["learner"] = "learner"


def _mastery_item_out(state: dict[str, Any]) -> dict[str, Any]:
    """门态行的响应投影：只出冻结字段（`assessed_mastered`/`assessed_by` 留内部判定用）。"""
    return {key: state[key] for key in MASTERY_ITEM_FIELDS}


def _mastery_view(
    request: Request,
    store: Any,
    course: dict[str, Any],
    units: list[dict[str, Any]],
    rows: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """投影序列 × kp 行 × 练习域事实 → 门态序列（分数与结论读时派生，不落列）。

    D4 之后学习课程与题库共用同一枚 `qed_course.course_id`，故作答与到期和 kp 行同键取数，
    不再有两套课程坐标的分裂。
    """
    course_id = str(course["learn_course_id"])
    practice = _optional_practice(request)
    attempts: dict[str, list[bool]] = {}
    due: dict[str, int] = {}
    if practice is not None and course_id:
        attempts = practice.attempts_by_kp(course_id)
        due = practice.due_counts_by_kp(course_id)
    states = []
    for row in units:
        kp_id = str(row.get("kp_id") or "")
        gate_row = rows.get(kp_id, {})
        states.append(
            mastery.build_state(
                unit_id=str(row["unit_id"]),
                kp_id=kp_id,
                kp_type=row.get("type"),
                correctness=attempts.get(kp_id, []),
                qualitative_passed=gate_row.get("qualitative_passed"),
                assessed_by=gate_row.get("assessed_by") or "",
                learner_claimed=gate_row.get("status") == "done",
                due_reviews=int(due.get(kp_id, 0)),
            )
        )
    return {"states": states, "rows": rows}


def _gate_cursor(view: dict[str, Any]) -> str | None:
    """门就是游标（D-M3-1）：第一个未掌握知识点行；`skipped`＝学习者显式让位，不停靠。"""
    for state in view["states"]:
        if state["mastered"]:
            continue
        if view["rows"].get(state["kp_id"], {}).get("status") == "skipped":
            continue
        return str(state["unit_id"])
    return None


def _progress_out(
    request: Request,
    store: Any,
    course: dict[str, Any],
    units: list[dict[str, Any]],
    rows: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """进度响应＝原五字段口径不动（kp 行终态位仍是计数源）＋门态三字段，游标改判为门游标。"""
    view = _mastery_view(request, store, course, units, rows)
    provenance = {mastery.PROVENANCE_SYSTEM: 0, mastery.PROVENANCE_LEARNER: 0}
    for state in view["states"]:
        if state["provenance"] in provenance:
            provenance[state["provenance"]] += 1
    base = derive_progress(units, rows)
    step = mastery.next_step(view["states"])
    return {
        **base,
        "current_unit_id": _gate_cursor(view),
        "mastered": sum(1 for state in view["states"] if state["mastered"]),
        "next_unit_id": step["unit_id"] or None,
        "provenance": provenance,
    }


def _derived(
    request: Request, store: Any, course: dict[str, Any], units: list[dict[str, Any]],
    rows: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """课程派生态一律按知识点投影行计数；编译态随链路退役（只剩三态）。"""
    prog = _progress_out(request, store, course, units, rows)
    if prog["completed"]:
        status = "completed"
    elif prog["done"] or prog["skipped"]:
        status = "learning"
    else:
        status = "draft"
    return {"status": status, **prog, "books": _books_out(units, rows, course)}


def _course_out(request: Request, store: Any, course: dict[str, Any]) -> dict[str, Any]:
    """课程响应＝kp 行 + 目录正式名称（名称/领域/track 只在共享 `qed_course`，R5 引用不复制）。"""
    course_id = str(course["learn_course_id"])
    catalog = _catalog_index_safe(request).get(course_id) or {}
    units, _chapters, rows = _course_tree(request, store, course)
    return {
        **course,
        "name": str(catalog.get("name") or course_id),
        "domain_id": str(catalog.get("domain_id") or ""),
        "track": str(catalog.get("track") or "").strip() or STARMAP_UNSORTED_TRACK,
        "description": str(catalog.get("description") or ""),
        "unit_count": len(units),
        "derived": _derived(request, store, course, units, rows),
    }


# ---------- 课程（qe_learning 的 course 行） ----------


@router.get("/courses")
def list_courses(request: Request) -> dict[str, Any]:
    store = _store(request)
    return {"courses": [_course_out(request, store, c) for c in store.list_courses()]}


@router.post("/courses")
def create_course(request: Request, body: CourseCreateBody) -> dict[str, Any]:
    """把一门共享课程加入学习面：插 course 行；已在学习面 409、素材为空 409、目录外不校验。"""
    store = _store(request)
    course = _guard(
        store.create_course,
        course_id=body.course_id,
        resources=[r.model_dump() for r in body.resources],
        kp_path=body.kp_path,
        learner_note=body.learner_note,
    )
    return _course_out(request, store, course)


def _book_label(row: dict[str, Any]) -> str:
    """教材显示名：解析侧 `display_title`（含分册）优先，回落 `title`，再回落 book_id。"""
    return str(row.get("display_title") or row.get("title") or row.get("book_id") or "")


def _knowledge_meta(request: Request) -> dict[str, dict[str, Any]]:
    """knowledge_id → 教程套行（取 `intro` 简介 + `position` 面向对象）。

    书级两列现网尚不存在（跨项目请求已登记 QED-Tracker），故书架展示元数据暂由
    `af_books.knowledge_id` 联接套级字段；8901 读不到按空值降级，不阻断同步。
    """
    try:
        rows = request.app.state.tracker_client.list_knowledge() or []
    except Exception as exc:  # noqa: BLE001 - 展示元数据缺失不影响课程物化
        logger.warning("教程套不可达，书架展示元数据留空：%s", type(exc).__name__)
        return {}
    return {
        str(row.get("knowledge_id") or ""): row
        for row in rows
        if str(row.get("knowledge_id") or "")
    }


@router.post("/courses/sync")
def sync_courses(request: Request) -> dict[str, Any]:
    """解析好即同步（REQ-117 W8/C9）：`af_books` 生效版本 → 学习面 course 行 + 教材素材。

    判据＝`active_job_id` 非空且 `course_id` 能在课程目录（8901）回查；查不到归属者 PASS、不猜。
    建行键＝共享 `qed_course.course_id`（D4 后与课程坐标同源，不再有两套 ID）。命中既有课程行
    只并集补入新书——不动已有素材的 `dismissed` 位（名称归共享表，本行不复制）。
    8902 不可达 503（书架降级为只读既有课程），8901 不可达由 `_catalog` 抛 503。
    """
    store = _store(request)
    index = _course_index(_catalog(request))
    try:
        books = request.app.state.axiom_client.list_books() or []
    except Exception as exc:  # noqa: BLE001 - 解析侧不可达：同步是写操作，明确报错不静默
        raise HTTPException(
            status_code=503, detail=f"解析侧书目不可达，同步未执行：{type(exc).__name__}"
        ) from exc

    parsed_by_course: dict[str, list[dict[str, Any]]] = {}
    for row in books:
        book_id = str(row.get("book_id") or "")
        course_id = str(row.get("course_id") or "")
        if not book_id or not str(row.get("active_job_id") or "") or course_id not in index:
            continue
        parsed_by_course.setdefault(course_id, []).append(row)

    existing = {str(course["learn_course_id"]): course for course in store.list_courses()}
    created: list[str] = []
    updated: list[str] = []
    for course_id, rows in sorted(parsed_by_course.items()):
        resource_rows = [
            {
                "kind": "book",
                "ref_id": str(row.get("book_id")),
                "label": _book_label(row),
                "dismissed": False,
            }
            for row in rows
        ]
        target = existing.get(course_id)
        if target is None:
            existing[course_id] = _guard(
                store.create_course, course_id=course_id, resources=resource_rows
            )
            created.append(course_id)
            continue
        have = list(target.get("resources") or [])
        known = {str(res.get("ref_id") or "") for res in have}
        added = [res for res in resource_rows if str(res["ref_id"]) not in known]
        if added:
            existing[course_id] = _guard(
                store.update_course, course_id, resources=have + added
            )
            updated.append(course_id)

    courses = [_course_out(request, store, c) for c in store.list_courses()]
    knowledge = _knowledge_meta(request)
    book_meta: list[dict[str, Any]] = []
    for course_id, rows in sorted(parsed_by_course.items()):
        for row in rows:
            meta_row = knowledge.get(str(row.get("knowledge_id") or "")) or {}
            position = str(meta_row.get("position") or "")
            book_meta.append(
                {
                    "ref_id": str(row.get("book_id")),
                    "label": _book_label(row),
                    "course_id": course_id,
                    "knowledge_id": str(row.get("knowledge_id") or ""),
                    "intro": str(meta_row.get("intro") or ""),
                    "position": position,
                    "position_label": POSITION_LABELS.get(position, position),
                    "page_count": int(row.get("page_count") or 0),
                }
            )
    return {
        "synced": sum(len(rows) for rows in parsed_by_course.values()),
        "created": created,
        "updated": updated,
        "courses": courses,
        "books": book_meta,
    }


@router.get("/courses/{course_id}")
def get_course(request: Request, course_id: str) -> dict[str, Any]:
    store = _store(request)
    return _course_out(request, store, _guard(store.get_course, course_id))


@router.patch("/courses/{course_id}")
def patch_course(request: Request, course_id: str, body: CoursePatchBody) -> dict[str, Any]:
    store = _store(request)
    fields = {key: getattr(body, key) for key in body.model_fields_set}
    if "resources" in fields and fields["resources"] is not None:
        fields["resources"] = [r.model_dump() for r in fields["resources"]]
    course = _guard(store.update_course, course_id, **fields)
    return _course_out(request, store, course)


@router.delete("/courses/{course_id}")
def delete_course(request: Request, course_id: str) -> dict[str, Any]:
    """退课只删 course 行；kp 行是学习者对知识点的独立记录，跨课程共享，不随课程删除（D4）。"""
    store = _store(request)
    _guard(store.get_course, course_id)
    _guard(store.delete_course, course_id)
    return {"deleted": course_id}


@router.get("/courses/{course_id}/progress")
def get_progress(request: Request, course_id: str) -> dict[str, Any]:
    store = _store(request)
    course = _guard(store.get_course, course_id)
    units, _chapters, rows = _course_tree(request, store, course)
    return _progress_out(request, store, course, units, rows)


@router.post("/courses/{course_id}/progress")
def set_progress(request: Request, course_id: str, body: ProgressBody) -> dict[str, Any]:
    """勾选落笔＝写 kp 行终态位（首笔即起行，零物化）；`pending`＝撤销，无质性痕迹时整行删除。

    `note` 写学习者备注列（人工位，R6：机器不写）；整行被撤销删除时备注随行作废，不起新行。
    """
    store = _store(request)
    course = _guard(store.get_course, course_id)
    units, _chapters, rows = _course_tree(request, store, course)
    _tree_or_404(units, body.kp_id)
    row = _guard(store.set_kp_status, body.kp_id, body.status)
    if body.note and not row.get("removed"):
        row = _guard(store.set_note, KP_TARGET, body.kp_id, body.note)
    units, _chapters, rows = _course_tree(request, store, course)
    return {**row, "derived": _progress_out(request, store, course, units, rows)}


@router.get("/courses/{course_id}/mastery")
def course_mastery(request: Request, course_id: str) -> dict[str, Any]:
    """逐知识点门态（主链 M-3）：只出投影的知识点行，过门结论与三态一律读时重算。"""
    store = _store(request)
    course = _guard(store.get_course, course_id)
    units, _chapters, rows = _course_tree(request, store, course)
    view = _mastery_view(request, store, course, units, rows)
    return {
        "items": [_mastery_item_out(state) for state in view["states"]],
        "next_step": mastery.next_step(view["states"]),
        "summary": mastery.mastery_summary(view["states"]),
    }


@router.post("/courses/{course_id}/mastery/assess")
def assess_mastery(request: Request, course_id: str, body: MasteryAssessBody) -> dict[str, Any]:
    """质性门记录：只写 kp 行判定四列、不取代勾选通路（D-M3-1）；量化型拒绝（409）。"""
    store = _store(request)
    course = _guard(store.get_course, course_id)
    units, _chapters, rows = _course_tree(request, store, course)
    unit = _tree_or_404(units, body.kp_id)
    refusal = mastery.assess_refusal(unit.get("type"))
    if refusal:
        raise HTTPException(status_code=409, detail=refusal)
    row = _guard(
        store.assess_qualitative,
        body.kp_id,
        passed=body.passed,
        note=body.note,
        assessed_by=body.by,
    )
    view = _mastery_view(request, store, course, units, store.kp_rows())
    state = next(item for item in view["states"] if item["kp_id"] == body.kp_id)
    return {"item": _mastery_item_out(state), "kp_row": row,
            "next_step": mastery.next_step(view["states"])}


# ---------- 知识点体系（qed_knowledge_point 共享主表） ----------


class OutlineTreeBody(BaseModel):
    """目录整树写入（人工确认后的章/节树；页范围＝PDF 页序）。"""

    book_ref: str = Field(min_length=1)
    tree: list[dict[str, Any]] = Field(min_length=1)


class PointPatchBody(BaseModel):
    """知识点改列白名单（extra=forbid）：归属、展示名、顺序提示与介绍。

    `node_kind`/`type` 分类列与 `narrative_ref`/`angles` 的产面不在人工面（确认由「写入主表」
    这一动作承载，长文与角度归生成与梳理腿）。
    """

    model_config = {"extra": "forbid"}

    parent_kp_id: str | None = None
    name: str | None = Field(default=None, min_length=1)
    order_hint: int | None = None
    # 摘要＝知识点一句话介绍（学习者可见）；上限对齐列宽 VARCHAR(1000)
    summary: str | None = Field(default=None, max_length=1000)


class PointCreateBody(BaseModel):
    """point 行直登记（候选池退役后主表的唯一产面，ADR 0026 D10）。

    父级只允许同课程的 outline 行或 NULL（未归档池）；`from_detail_id`＝梳理侧节点稳定身份
    （提升幂等锚），一经发放不可变。
    """

    course_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    domain_id: str = ""
    domain_label: str = ""
    course_label: str = ""
    parent_kp_id: str | None = None
    type: str | None = None
    summary: str = Field(default="", max_length=1000)
    aliases: list[str] = Field(default_factory=list)
    narrative_ref: str = Field(default="", max_length=500)
    anchors: list[dict[str, Any]] = Field(default_factory=list)
    order_hint: int | None = None
    from_detail_id: str = ""

    @field_validator("type")
    @classmethod
    def _type_closed(cls, v: str | None) -> str | None:
        if v is not None and v not in KP_TYPES:
            raise ValueError(f"type 必须是 {KP_TYPES} 之一")
        return v


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
        summary = node.get("summary")
        if summary is not None and (
            not isinstance(summary, str) or len(summary) > 1000
        ):
            raise HTTPException(status_code=422, detail="summary 必须为不超过 1000 字符的字符串")
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
    """知识点主表懒接入：首次请求幂等建表并挂载（判例 qed_llm_calls）。

    启动路径不触碰 MySQL（隔离铁律：测试 create_app 不连真实库）；未配置密码直接降级。
    建表失败只锁 `KNOWLEDGE_MOUNT_RETRY_SECONDS` 秒（DEFECT-009）：窗口内不重复打库。
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
            "知识点主表建表跳过（数据库不可达），%.0fs 后重试：%s",
            KNOWLEDGE_MOUNT_RETRY_SECONDS,
            type(exc).__name__,
        )
        return None
    app.state.knowledge_store_retry_after = 0.0
    app.state.knowledge_store = knowledge_store_module.MySQLKnowledgeStore(settings)
    return app.state.knowledge_store


def _optional_knowledge(request: Request) -> Any | None:
    """知识点主表可得性探测（投影序列的取材面）：不可得返回 None，让课程面出空序列而不是 503。"""
    store = getattr(request.app.state, "knowledge_store", None)
    if store is not None:
        return store
    try:
        return _mount_knowledge_store(request.app)
    except Exception:  # noqa: BLE001 - 投影只是读侧便利，知识点腿不可达时课程面照常工作
        return None


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


def _catalog_index_safe(request: Request) -> dict[str, dict[str, Any]]:
    """课程目录的可降级读取（独立性铁律）：8901 离线时返回空表，课程名回落 course_id。"""
    try:
        return _course_index(_catalog(request))
    except HTTPException:
        return {}


def _point_out(point: dict[str, Any]) -> dict[str, Any]:
    out = dict(point)
    out["anchors"] = out.get("anchors") or []
    return out


@router.get("/star-map")
def star_map(request: Request, domain: str | None = Query(default=None)) -> dict[str, Any]:
    """星图一次取全：领域 → track 星云 → 课程节点（含已确认知识点数）+ 先修边（标跨 track）。

    数据源＝qed_domain/qed_course（既有）；候选位数随候选池退役一并摘除。
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
            known[course_id] = str(course.get("track") or "").strip() or STARMAP_UNSORTED_TRACK
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
                    "description": str(course.get("description") or ""),
                    "kp_confirmed": int(count.get("confirmed") or 0),
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
    """已确认知识点跨课程检索（主表只存采纳结果；`node_kind=point` 才进检索面）。"""
    if type is not None and type not in KP_TYPES:
        raise HTTPException(status_code=422, detail=f"type 必须是 {KP_TYPES} 之一")
    store = _knowledge(request)
    points, total = store.list_points(
        domain_id=domain, course_id=course, type=type, q=q, limit=limit, offset=offset
    )
    return {"points": [_point_out(p) for p in points], "total": total}


@router.post("/knowledge-points")
def create_knowledge_point(request: Request, body: PointCreateBody) -> dict[str, Any]:
    """point 行直登记＝候选池退役后主表的唯一产面（写入本表这一动作即承载确认）。

    坐标标签缺省时从课程目录补齐（目录不可达按入参快照落库）；父级非 outline 或跨课程 409、
    父级不存在 404、同课程重复 `norm_key` 409（合并走 `aliases`）。
    """
    store = _knowledge(request)
    fields = body.model_dump()
    course = _catalog_index_safe(request).get(fields["course_id"]) or {}
    fields["domain_id"] = fields["domain_id"] or str(course.get("domain_id") or "")
    fields["domain_label"] = fields["domain_label"] or str(course.get("domain_label") or "")
    fields["course_label"] = fields["course_label"] or str(course.get("name") or "")
    return _point_out(_guard(store.add_point, **fields))


@router.get("/courses/{course_id}/knowledge-points")
def course_knowledge_points(
    request: Request, course_id: str, include_outline: bool = Query(default=False)
) -> dict[str, Any]:
    """某课程知识点总览：主数据行 + 学习序列（投影行 × kp 行）一次取全。

    默认只出 point 行（章名不进知识点列表）；`include_outline=true` 时带目录节点行。
    `sequence`＝该课程在工作台里的推进序列，`units[].learner` 携勾选与质性门态，未加入学习面
    时 `enrolled=false` 且序列为空（主数据照常出）。
    """
    store = _knowledge(request)
    course = _require_catalog_course(request, course_id)
    points, total = store.list_points(
        course_id=course_id, kind=None if include_outline else "point", limit=500
    )
    sequence: dict[str, Any] = {
        "enrolled": False, "units": [], "chapters": [], "kp_path": [],
    }
    learn = _optional_learn(request)
    course_row = None
    if learn is not None:
        try:
            course_row = learn.get_course(course_id)
        except LearnNotFound:
            course_row = None
    if course_row is not None:
        units, chapters, rows = _course_tree(request, learn, course_row)
        sequence = {
            "enrolled": True,
            "units": [{**unit, "learner": rows.get(str(unit["kp_id"]))} for unit in units],
            "chapters": chapters,
            "kp_path": list(course_row.get("kp_path") or []),
        }
    return {
        "course": {
            "course_id": course_id,
            "name": course.get("name") or course_id,
            "track": str(course.get("track") or "").strip() or STARMAP_UNSORTED_TRACK,
            "domain_id": course.get("domain_id") or "",
            "description": str(course.get("description") or ""),
        },
        "points": [_point_out(point) for point in points],
        "total": total,
        "sequence": sequence,
    }


# ---------- 长文正文读文件腿（ADR 0026 D5：正文不落库，按 `narrative_ref` 取） ----------


def _narrative_path(settings: Any, ref: str) -> Path:
    """双闸：拒绝绝对路径、拒绝越数据根、只允许 `parsed/` 前缀（数据根内的既有白名单区）。"""
    pure = PurePosixPath(ref.replace("\\", "/"))
    if pure.is_absolute() or (len(ref) > 1 and ref[1] == ":"):
        raise HTTPException(status_code=422, detail="正文指针必须是数据根相对路径，不接受绝对路径")
    parts = [str(part) for part in pure.parts]
    if not parts or parts[0] != NARRATIVE_ALLOWED_PREFIX:
        raise HTTPException(
            status_code=422, detail=f"正文指针只能指向数据根内 {NARRATIVE_ALLOWED_PREFIX}/ 目录"
        )
    if ".." in parts:
        raise HTTPException(status_code=422, detail="正文指针不得越出数据根")
    root = Path(settings.data_root_path).resolve()
    target = (root / Path(*parts)).resolve()
    if not target.is_relative_to(root):
        raise HTTPException(status_code=422, detail="正文指针不得越出数据根")
    return target


@router.get("/knowledge-points/{kp_id}/narrative")
def get_point_narrative(request: Request, kp_id: str) -> dict[str, Any]:
    """按主表 `narrative_ref` 取长文正文；指针悬空＝可见降级（明示缺失，不静默回落空串）。"""
    store = _knowledge(request)
    row = _guard(store.get_point, kp_id)
    ref = str(row.get("narrative_ref") or "")
    base = {"kp_id": kp_id, "narrative_ref": ref}
    if not ref:
        return {**base, "available": False, "content": "",
                "reason": "这条知识点还没有登记正文指针"}
    path = _narrative_path(request.app.state.settings, ref)
    if not path.is_file():
        return {**base, "available": False, "content": "",
                "reason": "指针指向的正文文件不在数据根里（可能已被移动或删除）"}
    data = path.read_bytes()
    truncated = len(data) > NARRATIVE_MAX_BYTES
    return {
        **base,
        "available": True,
        "content": data[:NARRATIVE_MAX_BYTES].decode("utf-8", errors="replace"),
        "truncated": truncated,
        "bytes": len(data),
        "reason": "",
    }


# ---------- REQ-117 W9：注解按需生成腿（§V2.11；生成经网关，前端不拼 prompt、不直调 /llm/*） ----------


class AnnotationGenerateBody(BaseModel):
    course_id: str = Field(min_length=1)
    target_kind: Literal["point", "chapter"]
    kp_id: str = Field(min_length=1)
    part: Literal["summary", "key_points", "annotation"]


def _page_block_text(data: Any) -> str:
    """书页 → 取材文本（与前端 `blockText` 同口径：公式取 latex、表取 html、列表取 items）。"""
    if not isinstance(data, dict):
        return ""
    blocks = data.get("blocks")
    if isinstance(blocks, dict):
        blocks = blocks.get("blocks")
    out: list[str] = []
    for block in blocks or []:
        if not isinstance(block, dict):
            continue
        kind = str(block.get("type") or "")
        if kind == "formula":
            text = str(block.get("latex") or "")
        elif kind == "table":
            text = str(block.get("html") or "")
        elif kind == "list":
            text = "\n".join(str(item) for item in (block.get("items") or []))
        else:
            text = str(block.get("text") or "")
        if text.strip():
            out.append(text.strip())
    return "\n".join(out)


def _annotation_source(request: Request, window: Any, part: str) -> tuple[str, int, str]:
    """按页窗取取材正文（经既有 8900 书页读面）；返回 (文本, 首个可用页, ref_id)。"""
    window = window if isinstance(window, dict) else {}
    ref_id = str(window.get("ref_id") or "")
    try:
        start = int(window.get("page_start") or 0)
        end = int(window.get("page_end") or start)
    except (TypeError, ValueError):
        return "", 0, ref_id
    client = getattr(request.app.state, "axiom_client", None)
    if not ref_id or start <= 0 or end < start or client is None:
        return "", 0, ref_id
    limit = learn_annotations.source_page_limit(part)
    chunks: list[str] = []
    first_page = 0
    for page in range(start, min(end, start + limit - 1) + 1):
        try:
            text = _page_block_text(client.get_book_page(ref_id, page))
        except Exception:  # noqa: BLE001 - 单页取不到即跳过，全窗零文本由调用方降 503
            continue
        if not text:
            continue
        first_page = first_page or page
        chunks.append(text)
    return "\n".join(chunks), first_page, ref_id


def _annotation_target(
    request: Request, store: Any, course: dict[str, Any], body: AnnotationGenerateBody
) -> tuple[dict[str, Any], dict[str, Any]]:
    """目标定位：投影行给取材页窗（章＝章行／条＝point 行），主表行给名称与坐标。

    知识点主表不可达＝503，投影序列里没有这一条＝404（未归档池与别课知识点都不给生成）。
    """
    knowledge = _optional_knowledge(request)
    if knowledge is None:
        raise HTTPException(status_code=503, detail="知识点数据还没准备好，暂时生成不了")
    units, chapters, _rows = _course_tree(request, store, course)
    rows = chapters if body.target_kind == "chapter" else units
    projected = next((row for row in rows if str(row.get("kp_id") or "") == body.kp_id), None)
    if projected is None:
        raise HTTPException(status_code=404, detail=f"学习域实体不存在：{body.kp_id}")
    return _guard(knowledge.get_point, body.kp_id), projected


@router.post("/annotations/generate")
def generate_annotation(request: Request, body: AnnotationGenerateBody) -> dict[str, Any]:
    """按需生成注解（C18）：章级覆写章行 `summary`／`meta.chapter_key_points`，条级追加
    主表 `angles` 一元素（同角不堆叠，ADR 0026 D10）；两者的正文长文都仍只由 `narrative_ref` 指。
    """
    if learn_annotations.PART_TARGETS[body.part] != body.target_kind:
        raise HTTPException(
            status_code=422, detail="生成用途与目标层不匹配：章＝章节总结／学习要点，条＝总结与注解"
        )
    store = _store(request)
    course = _guard(store.get_course, body.course_id)
    row, projected = _annotation_target(request, store, course, body)
    text, _first_page, _ref_id = _annotation_source(request, projected.get("source_ref"), body.part)
    if not text:
        label = "章" if body.target_kind == "chapter" else "条"
        raise HTTPException(status_code=503, detail=f"这一{label}的正文还没准备好，暂时生成不了")
    key = learn_annotations.throttle_key(body.course_id, body.target_kind, body.kp_id, body.part)
    if body.target_kind == "chapter":
        hit = learn_annotations.cached(key)
        if hit is not None:
            return hit
    outcome = learn_annotations.generate(
        request.app.state.settings, body.part, str(row["name"]), text
    )
    if not outcome["ok"]:
        raise HTTPException(status_code=502, detail=f"生成没能完成：{outcome['reason']}，可以再点一次")
    target = {"kind": body.target_kind, "kp_id": body.kp_id, "name": str(row["name"])}
    knowledge = _knowledge(request)
    if body.target_kind == "chapter":
        fields: dict[str, Any] = (
            {"summary": outcome["text"]}
            if body.part == "summary"
            else {"meta": {"chapter_key_points": outcome["items"]}}
        )
        saved = _guard(knowledge.patch_point, body.kp_id, **fields)
        chapter = {
            "kp_id": body.kp_id,
            "summary": saved.get("summary") or "",
            "key_points": list((saved.get("meta") or {}).get("chapter_key_points") or []),
        }
        response = {"ok": True, "target": target, "chapter": chapter}
    else:
        angle = PART_ANGLES[body.part]
        saved = _guard(
            knowledge.append_angle, body.kp_id, angle, note=str(outcome["text"] or "")
        )
        response = {"ok": True, "target": target, "point": _point_out(saved)}
    if body.target_kind == "chapter":
        learn_annotations.remember(key, response)
    return response


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
    """目录确认后的整树写入：幂等替换同 book_ref 的 outline 子树，写入即视为已确认。

    point 行一律不删；其父 outline 被替换掉时归未归档池（parent_kp_id=NULL）。
    坐标列按课程目录补全（REQ-118 D1）。
    """
    store = _knowledge(request)
    course = _require_catalog_course(request, course_id)
    _validate_outline_tree(body.tree)
    result = _guard(
        store.replace_outline,
        course_id,
        body.book_ref,
        body.tree,
        domain_id=str(course.get("domain_id") or ""),
        domain_label=str(course.get("domain_label") or ""),
        course_label=str(course.get("name") or ""),
    )
    return {**result, "book_ref": body.book_ref, "outline": store.list_outline(course_id, body.book_ref)}


@router.patch("/knowledge-points/{kp_id}")
def patch_knowledge_point(request: Request, kp_id: str, body: PointPatchBody) -> dict[str, Any]:
    """人工面移动与改名：开放归属、展示名、顺序提示与摘要（确认位与四分类不走本端点）。"""
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


# ---------- 练习与复习（qe_question / qe_attempt；到期态由流水重放） ----------


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
    """入库项：结构闭集与裁决 ⑨ 在 API 面校验（缝 5 输入面；store 只兜空题干）。

    `unit_id`／`course_label` 随单元树与列面收敛退役（ADR 0026 D2/D9），多余键一律忽略。
    """

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
    """批量入库请求体：一批一 `gen_batch`（抽取批次号），整批同事务（缝 6）。

    课程键只有共享 `qed_course.course_id` 一枚（D4：`learn_course_id` 随学习课程独立 ID 退役）。
    """

    course_id: str = Field(min_length=1)
    gen_batch: str = ""
    model_ref: str = ""
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
    """作答提交体：`origin` 闭集，`review_date` 与唯一键 (owner, question_id, review_date, origin) 同义。

    `extra=forbid`＝`owner` 等所有权列不可由请求侧指定（D7：只由服务端注入）。
    """

    model_config = {"extra": "forbid"}

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
    """错题本人工位白名单（extra=forbid）：判分结果列不可手改；`resolved` 现为纯人工位（D9 C2）。"""

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


def _optional_practice(request: Request) -> Any | None:
    """练习域事实可得性探测（门的输入面）：不可得返回 None，门按零作答派生而不是 503（D-M3-4）。"""
    store = getattr(request.app.state, "practice_store", None)
    if store is not None:
        return store
    try:
        return _mount_practice_store(request.app)
    except Exception:  # noqa: BLE001 - 门只是读侧派生，练习腿不可达时学习面照常推进
        return None


def _mount_practice_store(app: Any) -> Any | None:
    """练习域两表懒接入：首个练习请求幂等建表并挂载（判例 DEFECT-009 知识点两表）。

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
            "练习域两表建表跳过（数据库不可达），%.0fs 后重试：%s",
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
    """提交作答：判分 + 作答行同事务（缝 6）；`review` 段与 `score_trend` 都由流水读时重放派生。

    判分依据只在作答响应里回传（缝 2）；flashcard 走自评、不进判分路径（裁决 ⑨）。
    机器不写 `resolved`/`bookmarked`（R6 纯人工位，D9 C2）。
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
    """到期队列（D3）：由 `qe_attempt` 流水重放派生，不落调度列；优先级即时派生
    （错题 1 先于类型档 2~5），`total_due` 为截断前的全量到期数。"""
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
