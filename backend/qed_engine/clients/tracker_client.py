"""QED-Tracker 服务客户端（数据域·QED-Tracker 适配层）：qed CLI 与前端工作台经 HTTP 调用 8901。

契约见 docs/design/service-contracts.md（资源状态机、任务轮询、confirm/reject/approve）。
transport 可注入（测试用 MockTransport）；非 2xx 与连接失败统一抛 TrackerError。
calalog 与 register、raw 文件下载为语义 API（8900 数据域）提供能力。

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
        detail: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail if detail is not None else message


class TrackerClient:
    """8901 服务客户端；方法返回解析后的 JSON（dict 或 list）。"""

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

    # --- 三表（qt_selections / qt_downloads / qt_sources，downloads-three-table-model §3.1） ---

    def list_selections(
        self,
        course_id: str | None = None,
        status: str | None = None,
    ) -> list:
        """表1 选课表列表（按课程/状态过滤）；rejected/superseded 彻底隐藏由上游数据层保证。"""
        params = {}
        for key, value in (("course_id", course_id), ("status", status)):
            if value:
                params[key] = value
        return self._request("GET", f"{API_PREFIX}/selections", params=params)

    def get_selection(self, selection_id: str) -> dict:
        """表1 套书详情（含该条目表2 册明细列表）。"""
        return self._request("GET", f"{API_PREFIX}/selections/{selection_id}")

    def confirm_selection(self, selection_id: str, note: str | None = None) -> dict:
        """表1 候选→确认入书单（可选评审建议 note）。"""
        body = {"note": note} if note else {}
        return self._request("POST", f"{API_PREFIX}/selections/{selection_id}/confirm", json=body)

    def backup_selection(self, selection_id: str, note: str | None = None) -> dict:
        """表1 候选→备选（可选评审建议 note）。"""
        body = {"note": note} if note else {}
        return self._request("POST", f"{API_PREFIX}/selections/{selection_id}/backup", json=body)

    def reject_selection(self, selection_id: str, reason: str, note: str | None = None) -> dict:
        """表1 否定（reason 必填留痕，可选 note）；rejected 为终态稍后彻底隐藏。"""
        if not reason:
            raise TrackerError("拒绝必须提供原因（reason），保证留痕可追溯")
        body = {"reason": reason}
        if note:
            body["note"] = note
        return self._request("POST", f"{API_PREFIX}/selections/{selection_id}/reject", json=body)

    def supersede_selection(self, selection_id: str, reason: str) -> dict:
        """表1 confirmed→superseded（被新版本替代，reason 必填）；旧版本前端不再可见。"""
        if not reason:
            raise TrackerError("标记过时必须提供原因（reason）")
        return self._request(
            "POST",
            f"{API_PREFIX}/selections/{selection_id}/supersede",
            json={"reason": reason},
        )

    def list_selection_downloads(self, selection_id: str) -> list:
        """表2 册级明细（按 selection_id）；rejected/failed 默认过滤由上游数据层保证。"""
        return self._request("GET", f"{API_PREFIX}/resources/{selection_id}/downloads")

    def create_download_candidate(
        self,
        selection_id: str,
        vol: str | None = None,
        file_hint: str | None = None,
    ) -> list:
        """表2 新建候选册（下载预登记）；vol 省略时上游按表1 vols 生成全部候选册。"""
        body = {"selection_id": selection_id}
        if vol:
            body["vol"] = vol
        if file_hint:
            body["file_hint"] = file_hint
        return self._request("POST", f"{API_PREFIX}/downloads", json=body)

    def approve_download(self, download_id: str) -> dict:
        """表2 册级验收通过：downloaded → approved。"""
        return self._request("POST", f"{API_PREFIX}/downloads/{download_id}/approve")

    def reject_download(self, download_id: str, reason: str) -> dict:
        """表2 册级否定（reason 必填，硬删 + 留痕）。"""
        if not reason:
            raise TrackerError("拒绝必须提供原因（reason），保证留痕可追溯")
        return self._request(
            "POST",
            f"{API_PREFIX}/downloads/{download_id}/reject",
            json={"reason": reason},
        )

    def register_download(self, download_id: str, relative_path: str) -> dict:
        """表2 人工下载登记：candidate → downloaded（数据根内相对路径由人工输入）。"""
        if not relative_path:
            raise TrackerError("人工下载登记必须提供数据根内相对路径（relative_path）")
        return self._request(
            "POST",
            f"{API_PREFIX}/downloads/{download_id}/register",
            json={"relative_path": relative_path},
        )

    def list_download_sources(self, download_id: str) -> list:
        """表3 渠道尝试列表（详情弹窗用；失败尝试 ok=0 留痕不展示由上游过滤）。"""
        return self._request("GET", f"{API_PREFIX}/downloads/{download_id}/sources")

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
        return response.json()

    @staticmethod
    def _detail(response: httpx.Response) -> str:
        try:
            body = response.json()
        except ValueError:
            return response.text
        detail = body.get("detail")
        if isinstance(detail, str):
            return detail
        return str(body)
