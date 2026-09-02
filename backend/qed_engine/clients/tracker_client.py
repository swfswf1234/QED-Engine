"""QED-Tracker 服务客户端（数据域·QED-Tracker 适配层）：qed CLI 与前端工作台经 HTTP 调用 8901。

契约见 docs/design/service-contracts.md 与 QED-Tracker docs/design/database-schema.md
（五层模型：qed_domain/qed_course 共享 + qt_knowledge/qt_books/qt_sources 私有，QED-031）。
transport 可注入（测试用 MockTransport）；非 2xx 与连接失败统一抛 TrackerError。
catalogs 与 register、raw 文件下载为语义 API（8900 数据域）提供能力。

设计关联（DesignRef）：docs/design/service-contracts.md
实现状态：Current
关联测试：tests/test_tracker_client.py
"""

import time

import httpx

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

    五层端点（QED-031）语义：教程（qt_knowledge）draft→confirmed→completed；
    书籍（qt_books）candidate→decided→downloading→downloaded→verified，rejected/superseded
    终态彻底隐藏由上游数据层保证；渠道（qt_sources）一次尝试一条，ok 表达成败。
    """

    def __init__(
        self,
        base_url: str,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._client = httpx.Client(base_url=base_url.rstrip("/"), transport=transport, timeout=timeout)

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

    def complete_knowledge(self, knowledge_id: str) -> dict:
        """教程 confirmed→completed（所辖书籍全部 verified 后聚合触发）。"""
        return self._request("POST", f"{API_PREFIX}/knowledge/{knowledge_id}/complete")

    def reject_knowledge(self, knowledge_id: str, reason: str) -> dict:
        """教程否定（reason 必填留痕）；rejected 终态彻底隐藏。"""
        if not reason:
            raise TrackerError("拒绝必须提供原因（reason），保证留痕可追溯")
        return self._request(
            "POST",
            f"{API_PREFIX}/knowledge/{knowledge_id}/reject",
            json={"reason": reason},
        )

    def supersede_knowledge(self, knowledge_id: str, reason: str) -> dict:
        """教程过时（被新版本替代，reason 必填）；旧版本前端不再可见。"""
        if not reason:
            raise TrackerError("标记过时必须提供原因（reason）")
        return self._request(
            "POST",
            f"{API_PREFIX}/knowledge/{knowledge_id}/supersede",
            json={"reason": reason},
        )

    # --- 书籍（qt_books：一册/一卷/一个快照） ---

    def create_book(self, knowledge_id: str, **kwargs) -> dict:
        """新建书籍候选（先登记再下载）：candidate 态；kwargs 透传 8901 /books 字段。"""
        body = {"knowledge_id": knowledge_id, **kwargs}
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

    def decide_book(self, book_id: str) -> dict:
        """候选→决定（人工决定下载）。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/decide")

    def start_book(self, book_id: str) -> dict:
        """决定→下载中（任务运行）。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/start")

    def fail_book(self, book_id: str) -> dict:
        """下载失败标记（可 retry）。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/fail")

    def retry_book(self, book_id: str) -> dict:
        """失败重试 → downloading。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/retry")

    def complete_book(
        self,
        book_id: str,
        sha256: str,
        relative_path: str,
        page_count: int | None = None,
        absolute_path: str = "",
        file_name: str = "",
    ) -> dict:
        """下载完成回填：sha256 + 数据根相对路径必填（服务端/自动下载链路调用）。"""
        if not sha256 or not relative_path:
            raise TrackerError("下载完成必须提供 sha256 与 relative_path")
        body = {
            "sha256": sha256,
            "relative_path": relative_path,
            "page_count": page_count,
            "absolute_path": absolute_path,
            "file_name": file_name,
        }
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/complete", json=body)

    def verify_book(self, book_id: str) -> dict:
        """人工验收通过：downloaded → verified（终态）。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/verify")

    def reject_book(self, book_id: str, reason: str, note: str | None = None) -> dict:
        """书籍否定（reason 必填，文件硬删留痕；可选审理备注 note）。"""
        if not reason:
            raise TrackerError("拒绝必须提供原因（reason），保证留痕可追溯")
        body: dict = {"reason": reason}
        if note:
            body["note"] = note
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/reject", json=body)

    def supersede_book(self, book_id: str, reason: str) -> dict:
        """书籍过时（版本换代留痕，reason 必填）。"""
        if not reason:
            raise TrackerError("标记过时必须提供原因（reason）")
        return self._request(
            "POST",
            f"{API_PREFIX}/books/{book_id}/supersede",
            json={"reason": reason},
        )

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
        """GET /domains：领域列表（树第一层数据源）。"""
        return self._request("GET", f"{API_PREFIX}/domains")

    def create_domain(
        self,
        *,
        name: str,
        description: str | None = None,
        stages: list[str] | None = None,
    ) -> dict:
        """POST /domains：手工新建领域（§8；domain_id 由上游服务端生成）。"""
        body: dict = {"name": name}
        if description is not None:
            body["description"] = description
        if stages is not None:
            body["stages"] = stages
        return self._request("POST", f"{API_PREFIX}/domains", json=body)

    def update_domain(
        self,
        domain_id: str,
        *,
        description: str | None = None,
        stages: list[str] | None = None,
        exploration_stage: str | None = None,
    ) -> dict:
        """PATCH /domains/{domain_id}：修改领域描述/阶段/exploration_stage（name 不可变）。"""
        body: dict = {}
        if description is not None:
            body["description"] = description
        if stages is not None:
            body["stages"] = stages
        if exploration_stage is not None:
            body["exploration_stage"] = exploration_stage
        return self._request("PATCH", f"{API_PREFIX}/domains/{domain_id}", json=body)

    def delete_domain(self, domain_id: str) -> dict | list | None:
        """DELETE /domains/{domain_id}：删除领域（有课程时上游 409 保护）。"""
        return self._request("DELETE", f"{API_PREFIX}/domains/{domain_id}")

    def explore_domain(
        self,
        domain_id: str,
        *,
        mode: str = "direct",
        ref_text: str = "",
        ref_doc_path: str = "",
    ) -> dict:
        """POST /domains/{domain_id}/explore：启动领域探索（202 异步任务，REQ-067 B2）。"""
        body: dict = {"mode": mode}
        if ref_text:
            body["ref_text"] = ref_text
        if ref_doc_path:
            body["ref_doc_path"] = ref_doc_path
        return self._request("POST", f"{API_PREFIX}/domains/{domain_id}/explore", json=body)

    def confirm_domain_name(
        self,
        domain_id: str,
        *,
        decision: str,
        name: str = "",
    ) -> dict:
        """POST /domains/{domain_id}/confirm-name：确认领域名称（REQ-067 B7）。"""
        body: dict = {"decision": decision}
        if name:
            body["name"] = name
        return self._request("POST", f"{API_PREFIX}/domains/{domain_id}/confirm-name", json=body)

    def import_domain(self, domain_data: dict) -> dict:
        """POST /domains/import：手动领域 JSON 导入（REQ-067 B3，QED-050）。"""
        return self._request("POST", f"{API_PREFIX}/domains/import", json={"domain": domain_data})

    def list_courses_system(self) -> list:
        """GET /courses：领域课程体系（领域含嵌套课程，左树 v2 数据源）。"""
        return self._request("GET", f"{API_PREFIX}/courses")

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
        """POST /domains/{domain_id}/courses：新增课程（探索 apply 与手工维护共用）。"""
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

    def update_course(
        self,
        course_id: str,
        *,
        stage: str | None = None,
        sort_order: int | None = None,
        note: str | None = None,
    ) -> dict:
        """PATCH /courses/{course_id}：修改课程阶段/排序/备注（仅提交显式字段）。"""
        body: dict = {}
        if stage is not None:
            body["stage"] = stage
        if sort_order is not None:
            body["sort_order"] = sort_order
        if note is not None:
            body["note"] = note
        return self._request("PATCH", f"{API_PREFIX}/courses/{course_id}", json=body)

    def delete_course(self, course_id: str) -> dict | list | None:
        """DELETE /courses/{course_id}：删除课程（有教程时上游 409 保护）。"""
        return self._request("DELETE", f"{API_PREFIX}/courses/{course_id}")

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
