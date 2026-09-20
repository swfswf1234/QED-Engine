"""Axiom-Flow 服务客户端（数据域·Axiom 适配层）：8900 前端工作台经 HTTP 调用 8902。

契约见 Axiom-Flow docs/architecture/api.md（8902 v2 契约事实源）与其 REQ-001 跨项目请求
（8900 侧适配：/review 已被页级编辑覆盖层 /edit + /edits 取代，parse-jobs 用 engine）：
- GET  /api/v1/books                    书目列表（BookOut：进度 + 课程归属）
- GET  /api/v1/books/{id}               单本详情（BookOut：file_path 数据根相对路径 + ingest/parse 状态）
- GET  /api/v1/books/{id}/pages/{no}    单页完整数据（PageData：blocks/markdown/image_url/edits，无 page_no 字段）
- GET  /api/v1/books/{id}/manifest      产物清单（文件路径/大小/哈希）
- POST /api/v1/books/sync               批量同步已验证书目（BookSyncItem 裸数组，file_path 为数据根相对路径）
- PUT  /api/v1/books/{id}/pages/{no}/blocks/{index}/edit   块编辑（upsert af_block_edits，含 verdict/note/corrected_*）
- GET  /api/v1/books/{id}/pages/{no}/edits                页级编辑记录列表
- POST /api/v1/parse-jobs               提交解析任务（book_id、pages、engine；响应主键 id、progress 为对象）
- GET  /api/v1/parse-jobs/{id}          任务状态与进度（queued/running/completed/failed）

transport 可注入（测试用 MockTransport）；非 2xx 与连接失败统一抛 AxiomError。
8902 离线时由 api/axiom.py 映射 503（独立性铁律）。

设计关联（DesignRef）：docs/architecture/api-contracts.md（8902 透传组事实源：
Axiom-Flow docs/architecture/api.md）
实现状态：Current
关联测试：tests/test_api.py（_axiom_client 用例）
"""

import httpx

API_PREFIX = "/api/v1"


class AxiomError(RuntimeError):
    """8902 服务返回非 2xx 或连接失败。

    status_code 在 8902 返回 4xx/5xx 时携带（透传用），连接失败为 None；
    detail 为上游 detail 文本（干净消息），缺省回退为完整消息。
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


class AxiomClient:
    """8902 服务客户端；方法返回解析后的 JSON（dict 或 list）。"""

    def __init__(
        self,
        base_url: str,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._client = httpx.Client(base_url=base_url.rstrip("/"), transport=transport, timeout=timeout, trust_env=False)

    def close(self) -> None:
        self._client.close()

    # --- 书目与产物 ---

    def list_books(self) -> list:
        """书目列表（含解析进度）。"""
        return self._request("GET", f"{API_PREFIX}/books")

    def get_book(self, book_id: str) -> dict:
        """单本详情（BookOut：file_path 数据根相对路径 + ingest/parse 状态，PDF 直显判定源）。"""
        return self._request("GET", f"{API_PREFIX}/books/{book_id}")

    def get_book_page(self, book_id: str, page_no: int) -> dict:
        """单页完整数据：原页图 URL + markdown + blocks（公式 LaTeX）。"""
        return self._request("GET", f"{API_PREFIX}/books/{book_id}/pages/{page_no}")

    def get_book_page_image(self, book_id: str, page_no: int) -> tuple[bytes, str]:
        """单页原图字节流（8900 图片代理：浏览器只连 8900，ADR 0007）。

        返回 (bytes, content_type)；8902 离线时抛 AxiomError（503 语义）。
        """
        try:
            response = self._client.get(f"{API_PREFIX}/books/{book_id}/pages/{page_no}/image")
        except httpx.HTTPError as exc:
            raise AxiomError(f"8902 连接失败：{exc}") from exc
        if response.status_code >= 400:
            detail = self._detail(response)
            raise AxiomError(
                f"8902 返回 {response.status_code}：{detail}",
                status_code=response.status_code,
                detail=detail,
            )
        return response.content, response.headers.get("content-type") or "image/png"

    def get_book_manifest(self, book_id: str) -> list:
        """产物清单（文件路径/大小/哈希）。"""
        return self._request("GET", f"{API_PREFIX}/books/{book_id}/manifest")

    def sync_books(self, books: list[dict]) -> dict:
        """批量同步已验证书目（upsert af_books；book_id 同源 qt_books，幂等）。"""
        return self._request("POST", f"{API_PREFIX}/books/sync", json=books)

    def ingest_book(self, book_id: str) -> dict:
        """ingest（PDF→页图渲染 + book.json，不调模型）。返回 {book_id,page_count,sha256,ingest_status}。"""
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/ingest")

    def edit_block(
        self,
        book_id: str,
        page_no: int,
        block_index: int,
        verdict: str | None = None,
        note: str = "",
        corrected_text: str | None = None,
        corrected_bbox: list | None = None,
    ) -> dict:
        """块编辑（upsert af_block_edits；verdict: ok/bad，重复编辑覆盖）。返回 EditRecord。"""
        body: dict = {}
        if verdict is not None:
            body["verdict"] = verdict
        if note:
            body["note"] = note
        if corrected_text is not None:
            body["corrected_text"] = corrected_text
        if corrected_bbox is not None:
            body["corrected_bbox"] = corrected_bbox
        return self._request(
            "PUT",
            f"{API_PREFIX}/books/{book_id}/pages/{page_no}/blocks/{block_index}/edit",
            json=body,
        )

    def get_page_edits(self, book_id: str, page_no: int) -> list:
        """页级块编辑记录列表（EditRecord[]；8902 无单块 GET 端点，单块回显由调用方过滤）。"""
        return self._request("GET", f"{API_PREFIX}/books/{book_id}/pages/{page_no}/edits")

    # --- 解析任务 ---

    def create_parse_job(
        self,
        book_id: str,
        pages: list[int] | None = None,
        engine: str = "mineru",
    ) -> dict:
        """提交解析任务（book_id、pages、engine）；缺省 pages 由上游按书目页数生成。

        响应 ParseJob：主键字段为 id（非 job_id），progress 为对象 {parsed,total,error}。
        """
        body: dict = {"book_id": book_id, "engine": engine}
        if pages:
            body["pages"] = pages
        return self._request("POST", f"{API_PREFIX}/parse-jobs", json=body)

    def get_parse_job(self, job_id: str) -> dict:
        """任务状态与进度（queued/running/completed/failed）。"""
        return self._request("GET", f"{API_PREFIX}/parse-jobs/{job_id}")

    def _request(self, method: str, path: str, **kwargs) -> dict | list:
        try:
            response = self._client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise AxiomError(f"8902 连接失败：{exc}") from exc
        if response.status_code >= 400:
            detail = self._detail(response)
            raise AxiomError(
                f"8902 返回 {response.status_code}：{detail}",
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
