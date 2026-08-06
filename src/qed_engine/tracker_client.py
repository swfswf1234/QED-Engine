"""QED-Tracker 服务客户端：qed CLI 与前端工作台经 HTTP 调用 8901。

契约见 docs/design/service-contracts.md（资源状态机、任务轮询、confirm/reject/approve）。
transport 可注入（测试用 MockTransport）；非 2xx 与连接失败统一抛 TrackerError。

设计关联（DesignRef）：docs/design/service-contracts.md
实现状态：Current
关联测试：tests/test_tracker_client.py
"""

import time

import httpx

API_PREFIX = "/api/v1"


class TrackerError(RuntimeError):
    """8901 服务返回非 2xx、参数不合法或连接失败。"""


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

    # --- 资源（人机协同闭环：candidate→confirmed→downloaded→approved/rejected） ---

    def list_resources(
        self,
        status: str | None = None,
        course_id: str | None = None,
        kind: str | None = None,
        language: str | None = None,
    ) -> list:
        """资源清单（按状态/课程/类型/语言过滤，前端候选视图主数据源）。"""
        params = {}
        for key, value in (
            ("status", status),
            ("course_id", course_id),
            ("kind", kind),
            ("language", language),
        ):
            if value:
                params[key] = value
        return self._request("GET", f"{API_PREFIX}/resources", params=params)

    def get_resource(self, resource_id: str) -> dict:
        return self._request("GET", f"{API_PREFIX}/resources/{resource_id}")

    def confirm_resource(self, resource_id: str) -> dict:
        """人工确认下载：candidate → confirmed。"""
        return self._request("POST", f"{API_PREFIX}/resources/{resource_id}/confirm")

    def backup_resource(self, resource_id: str) -> dict:
        """人工评估「备选」：candidate/pending_manual → backup（不下载，可转正/放弃）。"""
        return self._request("POST", f"{API_PREFIX}/resources/{resource_id}/backup")

    def reject_resource(self, resource_id: str, reason: str) -> dict:
        """拒绝（候选级或验收级）；reason 必填，downloaded 拒绝时服务侧硬删文件留痕。"""
        if not reason:
            raise TrackerError("拒绝必须提供原因（reason），保证留痕可追溯")
        return self._request("POST", f"{API_PREFIX}/resources/{resource_id}/reject", json={"reason": reason})

    def approve_resource(self, resource_id: str) -> dict:
        """验收通过：downloaded → approved（待 Axiom-Flow 解析）。"""
        return self._request("POST", f"{API_PREFIX}/resources/{resource_id}/approve")

    # --- 任务（后台任务 + 轮询） ---

    def create_download(self, resource_id: str) -> dict:
        """创建下载任务；仅 confirmed 状态可触发（否则 8901 返回 409）。"""
        return self._request(
            "POST",
            f"{API_PREFIX}/tasks/books/download",
            json={"resource_id": resource_id},
        )

    def create_evaluate(self, course_id: str | None = None) -> dict:
        """按课程批量评估任务（搜索源 → LLM 评估 → 候选落库）；缺省=全目录。"""
        body = {"course_id": course_id} if course_id else {}
        return self._request("POST", f"{API_PREFIX}/tasks/catalog/evaluate", json=body)

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

    def _request(self, method: str, path: str, **kwargs) -> dict | list:
        try:
            response = self._client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise TrackerError(f"8901 连接失败：{exc}") from exc
        if response.status_code >= 400:
            raise TrackerError(f"8901 返回 {response.status_code}：{self._detail(response)}")
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
