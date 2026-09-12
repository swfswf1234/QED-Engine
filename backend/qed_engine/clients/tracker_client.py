"""QED-Tracker 服务客户端（数据域·QED-Tracker 适配层）：qed CLI 与前端工作台经 HTTP 调用 8901。

契约见 docs/design/cross-project-contracts.md 与 QED-Tracker docs/design/database-schema.md
（五层模型：qed_domain/qed_course 共享 + qt_knowledge/qt_books/qt_sources 私有，QED-031）。
transport 可注入（测试用 MockTransport）；非 2xx 与连接失败统一抛 TrackerError。
catalogs 与 register、raw 文件下载为语义 API（8900 数据域）提供能力。

设计关联（DesignRef）：docs/design/cross-project-contracts.md
实现状态：Current
关联测试：tests/test_tracker_client.py
"""

import time
from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from qed_engine.config import Settings

API_PREFIX = "/api/v1"


class TrackerError(RuntimeError):
    """8901 服务返回非 2xx、参数不合法或连接失败。

    status_code 在 8901 返回 4xx/5xx 时携带（语义 API 用于透传 409 等），连接失败为 None；
    detail 为上游 detail 文本（干净消息，语义 API 透传用；缺省回退为完整消息）。
    """

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        detail: str | dict | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail if detail is not None else message


class TrackerClient:
    """8901 服务客户端；方法返回解析后的 JSON（dict 或 list）。

    教程（qt_knowledge）两态：draft→confirmed（2026-09-03 裁决）；
    书籍（qt_books）选用四态：candidate→decided→parallel→retired，下载执行由 qt_sources 承载；
    渠道（qt_sources）一次尝试一条，ok 表达成败。

    降级支持：当8901不可用时，自动降级到直接查询共享表（qed_domain/qed_course）。
    """

    def __init__(
        self,
        base_url: str,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 30.0,
        settings: "Settings | None" = None,
    ) -> None:
        self._client = httpx.Client(base_url=base_url.rstrip("/"), transport=transport, timeout=timeout, trust_env=False)
        self._settings = settings

    def close(self) -> None:
        self._client.close()

    # --- 目录 ---

    def get_catalog(self, course_id: str) -> dict:
        """课程目录（知识点树，前端下载管理主数据源之一）。"""
        return self._request("GET", f"{API_PREFIX}/catalogs/{course_id}")

    # --- 任务（后台任务 + 轮询） ---

    def list_tasks(self) -> list:
        return self._request("GET", f"{API_PREFIX}/tasks")

    def get_task(self, task_id: str) -> dict:
        return self._request("GET", f"{API_PREFIX}/tasks/{task_id}")

    def wait_task(self, task_id: str, timeout: float = 120.0, interval: float = 1.0) -> dict:
        """轮询任务直到终态（succeeded/failed）；超时抛 TrackerError。"""
        deadline = time.monotonic() + timeout
        while True:
            task = self.get_task(task_id)
            if task.get("status") in ("succeeded", "failed"):
                return task
            if time.monotonic() > deadline:
                raise TrackerError(f"任务 {task_id} 等待超时（{timeout:.0f}s），当前状态：{task.get('status')}")
            time.sleep(interval)

    # --- 教程（qt_knowledge：一套教程/一组延展资料，五层模型 QED-031） ---

    def list_knowledge(
        self,
        course_id: str | None = None,
        status: str | None = None,
    ) -> list:
        """教程列表（按课程/状态过滤）；rejected/superseded 彻底隐藏由上游数据层保证。"""
        params = {}
        for key, value in (("course_id", course_id), ("status", status)):
            if value:
                params[key] = value
        return self._request("GET", f"{API_PREFIX}/knowledge", params=params)

    def get_knowledge(self, knowledge_id: str) -> dict:
        """教程详情（含所辖书籍列表）。"""
        return self._request("GET", f"{API_PREFIX}/knowledge/{knowledge_id}")

    def confirm_knowledge(
        self,
        knowledge_id: str,
        textbook_ref: dict | None = None,
        exercise_ref: dict | None = None,
        textbook_intro: str = "",
        exercise_intro: str = "",
    ) -> dict:
        """教程 draft→confirmed（定稿：决定引用 {title, version} + 简介，可空）。"""
        body: dict = {}
        if textbook_ref:
            body["textbook_ref"] = textbook_ref
        if exercise_ref:
            body["exercise_ref"] = exercise_ref
        if textbook_intro:
            body["textbook_intro"] = textbook_intro
        if exercise_intro:
            body["exercise_intro"] = exercise_intro
        return self._request("POST", f"{API_PREFIX}/knowledge/{knowledge_id}/confirm", json=body)

    def import_course_knowledge(self, course_id: str, data: dict) -> dict:
        """导入课程知识（tutorials JSON）。"""
        return self._request("POST", f"{API_PREFIX}/courses/{course_id}/knowledge", json=data)

    def update_knowledge(self, knowledge_id: str, **kwargs) -> dict:
        """更新教程信息（name/position/intro/set_no/kind/notes）。"""
        body = {k: v for k, v in kwargs.items() if v is not None}
        return self._request("PATCH", f"{API_PREFIX}/knowledge/{knowledge_id}", json=body)

    def delete_knowledge(self, knowledge_id: str) -> dict:
        """删除教程（级联清理孤立书籍）。"""
        return self._request("DELETE", f"{API_PREFIX}/knowledge/{knowledge_id}")

    # --- 书籍（qt_books：一册/一卷/一个快照） ---

    def create_book(self, book_id: str, **kwargs) -> dict:
        """书库化创建（QED-060）：book_id + title 必填；kwargs 透传 8901 /books 字段。

        行内无归属列（归属由教程 refs 承载），不再携带 knowledge_id。
        """
        body = {"book_id": book_id, **kwargs}
        return self._request("POST", f"{API_PREFIX}/books", json=body)

    def list_book_sources(self, book_id: str) -> list:
        """书籍渠道尝试列表（详情弹窗用；失败尝试 ok=0 留痕不展示由上游过滤）。"""
        return self._request("GET", f"{API_PREFIX}/books/{book_id}/sources")

    def add_book_source(self, book_id: str, **kwargs) -> dict:
        """登记一次渠道尝试（channel/provider_id/page_url/download_url/...）；ok 表达成败。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/sources", json=dict(kwargs))

    def register_book(self, book_id: str, relative_path: str) -> dict:
        """人工下载登记：candidate → downloaded 直转（数据根内相对路径，PDF 校验在 8901 侧）。"""
        if not relative_path:
            raise TrackerError("人工下载登记必须提供数据根内相对路径（relative_path）")
        return self._request(
            "POST",
            f"{API_PREFIX}/books/{book_id}/register",
            json={"relative_path": relative_path},
        )

    def fetch_book(self, book_id: str) -> dict:
        """自动下载书籍（触发下载任务）。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/fetch")

    def fetch_knowledge_books(self, knowledge_id: str) -> dict:
        """批量下载教程所辖书籍（触发下载任务）。"""
        return self._request("POST", f"{API_PREFIX}/knowledge/{knowledge_id}/fetch")

    def import_book_pdf(self, book_id: str, file_path: str, target_path: str | None = None) -> dict:
        """人工导入 PDF：file_path 为 8900 落盘的临时文件路径（可在数据根外）。

        8901 负责完整性校验、sha256 去重与原子落盘，并 mark_owned（owned + downloaded）。
        """
        if not file_path:
            raise TrackerError("人工导入必须提供 file_path")
        body: dict = {"file_path": file_path}
        if target_path:
            body["target_path"] = target_path
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/import", json=body)

    def start_book(self, book_id: str) -> dict:
        """开始下载：decided → downloading（QED-060 下载生命周期）。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/start")

    def fail_book(self, book_id: str) -> dict:
        """标记下载失败：downloading → failed（holding 仍 missing）。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/fail")

    def verify_book(self, book_id: str) -> dict:
        """人工验收通过：downloaded → verified（终态）。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/verify")

    def cancel_book(self, book_id: str) -> dict:
        """取消下载：downloading → decided（复位，不删除已落盘文件）。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/cancel")

    # --- 领域只读/维护（REQ-059，端点由 QED-Tracker 承接，未上线前 404 透传） ---
    # 注：旧探索方法（start_course_explore/get_explore_run/adopt/discard/list/
    # start_curriculum_explore/get_curriculum_run/apply_curriculum_run，PLAN-021
    # 冻结契约 §1~§7.2）已删除——QED-Tracker migration 0013 废弃旧 explore-runs
    # 契约；探索会话由 8900 自有 explore_sessions 服务承接（PLAN-022，2026-08-28）。

    # --- 探索 dry-run（PLAN-022 B2 补齐：8901 同步管线，会话后台线程调用） ---

    def dry_run_domain_explore(
        self,
        domain_name: str,
        *,
        mode: str,
        ref_text: str | None = None,
        ref_doc_path: str | None = None,
        confirm_name_override: str | None = None,
    ) -> dict:
        """POST /prompt-explores/dry-run：领域探索三步管线（同步，不写任何表）。"""
        body: dict = {"domain_name": domain_name, "mode": mode}
        if ref_text:
            body["ref_text"] = ref_text
        if ref_doc_path:
            body["ref_doc_path"] = ref_doc_path
        if confirm_name_override:
            body["confirm_name_override"] = confirm_name_override
        return self._request("POST", f"{API_PREFIX}/prompt-explores/dry-run", json=body)

    def dry_run_course_explore(
        self,
        course_id: str,
        *,
        mode: str,
        ref_text: str | None = None,
        ref_doc_path: str | None = None,
    ) -> dict:
        """POST /courses/{course_id}/prompt-explores/dry-run：课程教材探索（tutorials@v1，同步）。"""
        body: dict = {"mode": mode}
        if ref_text:
            body["ref_text"] = ref_text
        if ref_doc_path:
            body["ref_doc_path"] = ref_doc_path
        return self._request(
            "POST", f"{API_PREFIX}/courses/{course_id}/prompt-explores/dry-run", json=body
        )

    def adopt_course_knowledge(self, course_id: str, *, tutorials: list[dict]) -> dict:
        """POST /courses/{course_id}/knowledge：课程知识采纳（A2，每套建 draft 教程）。"""
        return self._request(
            "POST", f"{API_PREFIX}/courses/{course_id}/knowledge", json={"tutorials": tutorials}
        )

    def list_domains(self) -> list:
        """GET /domains：领域列表（树第一层数据源）。
        
        降级逻辑：当8901不可用时，自动降级到直接查询共享表。
        """
        try:
            return self._request("GET", f"{API_PREFIX}/domains")
        except TrackerError as exc:
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，降级直接查询共享表：%s", exc)
                from qed_engine.services.shared_tables import list_domains
                return list_domains(self._settings)
            raise

    def create_domain(
        self,
        *,
        name: str,
        description: str | None = None,
        stages: list[str] | None = None,
        level: str | None = None,
        classic_tracks: list[dict] | None = None,
        scope: str | None = None,
    ) -> dict:
        """POST /domains：手工新建领域（§8；domain_id 由上游服务端生成）。
        
        降级逻辑：当8901不可用时，自动降级到直接查询共享表。
        """
        try:
            body: dict = {"name": name}
            if description is not None:
                body["description"] = description
            if stages is not None:
                body["stages"] = stages
            if level is not None:
                body["level"] = level
            if classic_tracks is not None:
                body["classic_tracks"] = classic_tracks
            if scope is not None:
                body["scope"] = scope
            return self._request("POST", f"{API_PREFIX}/domains", json=body)
        except TrackerError as exc:
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，降级直接创建领域：%s", exc)
                from qed_engine.services.shared_tables import STAGE_NOT_STARTED, create_domain
                result = create_domain(
                    self._settings,
                    name=name,
                    description=description or "",
                    level=level or "本科",
                    stages=stages,
                    classic_tracks=classic_tracks,
                    scope=scope or "",
                    exploration_stage=STAGE_NOT_STARTED,
                )
                if result is None:
                    raise TrackerError("领域创建失败（降级模式）") from exc
                return result
            raise

    def update_domain(
        self,
        domain_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        stages: list[str] | None = None,
        exploration_stage: str | None = None,
        level: str | None = None,
        classic_tracks: list[dict] | None = None,
        scope: str | None = None,
        explore_pending: dict | None = None,
    ) -> dict:
        """PATCH /domains/{domain_id}：修改领域字段。
        
        降级逻辑：当8901不可用时，自动降级到直接查询共享表。
        """
        try:
            body: dict = {}
            if name is not None:
                body["name"] = name
            if description is not None:
                body["description"] = description
            if stages is not None:
                body["stages"] = stages
            if exploration_stage is not None:
                body["exploration_stage"] = exploration_stage
            if level is not None:
                body["level"] = level
            if classic_tracks is not None:
                body["classic_tracks"] = classic_tracks
            if scope is not None:
                body["scope"] = scope
            if explore_pending is not None:
                body["explore_pending"] = explore_pending
            return self._request("PATCH", f"{API_PREFIX}/domains/{domain_id}", json=body)
        except TrackerError as exc:
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，降级直接更新领域：%s", exc)
                from qed_engine.services.shared_tables import update_domain
                result = update_domain(
                    self._settings,
                    domain_id,
                    name=name,
                    description=description,
                    stages=stages,
                    exploration_stage=exploration_stage,
                    level=level,
                    classic_tracks=classic_tracks,
                    scope=scope,
                    explore_pending=explore_pending,
                )
                if result is None:
                    raise TrackerError("领域更新失败（降级模式）") from exc
                return result
            raise

    def delete_domain(self, domain_id: str) -> dict | list | None:
        """DELETE /domains/{domain_id}：删除领域（有课程时上游 409 保护）。
        
        降级逻辑：当8901不可用时，自动降级到直接查询共享表。
        """
        try:
            return self._request("DELETE", f"{API_PREFIX}/domains/{domain_id}")
        except TrackerError as exc:
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，降级直接删除领域：%s", exc)
                from qed_engine.services.shared_tables import delete_domain
                success = delete_domain(self._settings, domain_id)
                if not success:
                    raise TrackerError("领域删除失败（降级模式，可能有课程）") from exc
                return None
            raise

    def import_domain(self, domain_data: dict, target_domain_id: str | None = None) -> dict:
        """POST /domains/import：手动领域 JSON 导入（REQ-067 B3，QED-050）。

        降级逻辑：8901 不可用时 8900 直写共享表（import_domain_manual：以 target_domain_id
        为主键查找领域并更新；手动@v1 必需字段缺失转 400；共享库不可写转 503 语义）。
        """
        try:
            return self._request("POST", f"{API_PREFIX}/domains/import",
                                 json={"domain": domain_data, "target_domain_id": target_domain_id})
        except TrackerError as exc:
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，导入降级直写共享表：%s", exc)
                from qed_engine.services.shared_tables import import_domain_manual
                try:
                    result = import_domain_manual(self._settings, domain_data, target_domain_id=target_domain_id)
                except ValueError as ve:
                    raise TrackerError(str(ve), status_code=400, detail=str(ve)) from ve
                if result is None:
                    raise TrackerError(
                        "导入降级失败：共享表不可写（QED_DB_PASSWORD 未配置或数据库不可达）"
                    ) from exc
                return result
            raise

    def commit_import_courses(self, domain_id: str) -> dict:
        """POST /domains/{domain_id}/courses/import：手动导入课程（六步流程步骤 3）。

        透传 8901：读取 raw/{domain_id}/domains.json → 逐条 upsert QedCourse → 待确认。
        """
        result = self._request("POST", f"{API_PREFIX}/domains/{domain_id}/courses/import")
        return {
            "committed": result.get("courses_created", 0),
            "updated": result.get("courses_updated", 0),
        }

    def submit_task(self, task_type: str, payload: dict | None = None) -> dict:
        """POST /api/v1/tasks/{task_type}：通用异步任务提交（202，返回 task_id）。

        8901 原生任务链入口（domain_explore / domain_explore_courses 等）；任务执行
        与五态写点由 8901 完成，8900 仅登记 task_id。无降级——任务依赖 8901 管线
        进程，连接失败时按原错误透出（PLAN-034 §10：探索任务离线不可降级）。
        """
        return self._request("POST", f"{API_PREFIX}/tasks/{task_type}", json=payload or {})

    def confirm_domain(self, domain_id: str) -> dict:
        """POST /domains/{domain_id}/confirm：确认领域（已生成→探索中，手动六步流程步骤 2）。

        8901 原生语义：读 raw/{id}/domains.json → upsert domain → 异步提交
        courses@v8 任务 → 返回 {task_id, exploration_stage:"探索中"}；
        courses.json 落盘与「待确认」写点由 8901 任务完成。无降级（任务离线不可跑）。
        """
        return self._request("POST", f"{API_PREFIX}/domains/{domain_id}/confirm")

    def apply_domain_results(self, domain_id: str, selected_courses: list[str] | None = None) -> dict:
        """POST /domains/{id}/apply-results：应用课程名单（待确认→已完成，六步流程步骤 4）。

        selected_courses 省略/为空 = 全部保留；未选课程行由 8901 级联删除。
        降级逻辑：8901 不可用时直写共享表（已完成 + 清 explore_pending）；
        课程行由门面桥接先行建行，此处不再补删（离线尽力而为，PLAN-034 §10）。
        """
        try:
            body: dict = {}
            if selected_courses:
                body["selected_courses"] = selected_courses
            return self._request("POST", f"{API_PREFIX}/domains/{domain_id}/apply-results", json=body)
        except TrackerError as exc:
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，apply-results 降级直写共享表：%s", exc)
                from qed_engine.services.shared_tables import STAGE_COMPLETED, update_domain
                result = update_domain(
                    self._settings,
                    domain_id,
                    exploration_stage=STAGE_COMPLETED,
                    explore_pending="__CLEAR__",
                )
                if result is None:
                    raise TrackerError("应用课程名单失败（降级模式）") from exc
                return result
            raise

    def list_courses_system(self) -> list:
        """GET /courses：领域课程体系（领域含嵌套课程，左树 v2 数据源）。
        
        降级逻辑：当8901不可用时，自动降级到直接查询共享表。
        """
        try:
            return self._request("GET", f"{API_PREFIX}/courses")
        except TrackerError as exc:
            # 8901不可用，降级直接查询共享表
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，降级直接查询共享表：%s", exc)
                from qed_engine.services.shared_tables import list_domains_with_courses
                return list_domains_with_courses(self._settings)
            raise

    def create_course_for_domain(
        self,
        domain_id: str,
        *,
        name: str,
        stage: str | None = None,
        sort_order: int | None = None,
        note: str | None = None,
        description: str | None = None,
        aliases: list[str] | None = None,
        track: str | None = None,
        prerequisites: list[str] | None = None,
    ) -> dict:
        """POST /domains/{domain_id}/courses：新增课程（探索 apply 与手工维护共用）。
        
        降级逻辑：当8901不可用时，自动降级到直接查询共享表。
        """
        try:
            body: dict = {"name": name}
            if stage is not None:
                body["stage"] = stage
            if sort_order is not None:
                body["sort_order"] = sort_order
            if note is not None:
                body["note"] = note
            if description is not None:
                body["description"] = description
            if aliases is not None:
                body["aliases"] = aliases
            if track is not None:
                body["track"] = track
            if prerequisites is not None:
                body["prerequisites"] = prerequisites
            return self._request("POST", f"{API_PREFIX}/domains/{domain_id}/courses", json=body)
        except TrackerError as exc:
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，降级直接创建课程：%s", exc)
                from qed_engine.services.shared_tables import create_course
                result = create_course(
                    self._settings,
                    domain_id,
                    name=name,
                    description=description or "",
                    stage=stage or "",
                    track=track or "",
                    sort_order=sort_order or 0,
                    aliases=aliases,
                    prerequisites=prerequisites,
                )
                if result is None:
                    raise TrackerError("课程创建失败（降级模式）") from exc
                return result
            raise

    def update_course(
        self,
        course_id: str,
        *,
        stage: str | None = None,
        sort_order: int | None = None,
        note: str | None = None,
        description: str | None = None,
        track: str | None = None,
        aliases: list[str] | None = None,
        prerequisites: list[str] | None = None,
        exploration_stage: str | None = None,
    ) -> dict:
        """PATCH /courses/{course_id}：修改课程阶段/排序/备注（仅提交显式字段）。
        
        降级逻辑：当8901不可用时，自动降级到直接查询共享表。
        """
        try:
            body: dict = {}
            if stage is not None:
                body["stage"] = stage
            if sort_order is not None:
                body["sort_order"] = sort_order
            if note is not None:
                body["note"] = note
            if description is not None:
                body["description"] = description
            if track is not None:
                body["track"] = track
            if aliases is not None:
                body["aliases"] = aliases
            if prerequisites is not None:
                body["prerequisites"] = prerequisites
            if exploration_stage is not None:
                body["exploration_stage"] = exploration_stage
            return self._request("PATCH", f"{API_PREFIX}/courses/{course_id}", json=body)
        except TrackerError as exc:
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，降级直接更新课程：%s", exc)
                from qed_engine.services.shared_tables import update_course
                result = update_course(
                    self._settings,
                    course_id,
                    description=description,
                    stage=stage,
                    track=track,
                    sort_order=sort_order,
                    aliases=aliases,
                    prerequisites=prerequisites,
                    exploration_stage=exploration_stage,
                )
                if result is None:
                    raise TrackerError("课程更新失败（降级模式）") from exc
                return result
            raise

    def delete_course(self, course_id: str) -> dict | list | None:
        """DELETE /courses/{course_id}：删除课程（有教程时上游 409 保护）。
        
        降级逻辑：当8901不可用时，自动降级到直接查询共享表。
        """
        try:
            return self._request("DELETE", f"{API_PREFIX}/courses/{course_id}")
        except TrackerError as exc:
            if self._settings:
                import logging
                logger = logging.getLogger("qed_engine.tracker")
                logger.info("8901不可用，降级直接删除课程：%s", exc)
                from qed_engine.services.shared_tables import delete_course
                success = delete_course(self._settings, course_id)
                if not success:
                    raise TrackerError("课程删除失败（降级模式）") from exc
                return None
            raise

    def _request(self, method: str, path: str, **kwargs) -> dict | list:
        try:
            response = self._client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise TrackerError(f"8901 连接失败：{exc}") from exc
        if response.status_code >= 400:
            detail = self._detail(response)
            raise TrackerError(
                f"8901 返回 {response.status_code}：{detail}",
                status_code=response.status_code,
                detail=detail,
            )
        # 204/空 body（DELETE 等）→ None；非 JSON 空响应同样按无内容处理
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    @staticmethod
    def _detail(response: httpx.Response) -> str | dict:
        try:
            body = response.json()
        except ValueError:
            return response.text
        detail = body.get("detail")
        if isinstance(detail, (str, dict)):
            return detail
        return str(body)
