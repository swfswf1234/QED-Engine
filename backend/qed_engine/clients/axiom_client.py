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
- ④ 知识点梳理（af_kp）十条腿经 kp_relay 一比一透传（kp-jobs / books/{id}/kp-jobs/{batch} /
  books/{id}/kp / kp/nodes/{id} 的 PATCH、confirm 与 summary 重生成 / kp/nodes/{id}/narrative 的写与读 /
  books/{id}/kp/outline / books/{id}/kp/export）：状态码与正文原样回，接口与库变更全归
  Axiom-Flow，本层不校验形状；重生成是同步的百秒级模型调用，由调用方显式放长超时

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
        """ingest（PDF→页图渲染，元数据落 af_books，不调模型）。返回 {book_id,page_count,sha256,ingest_status}。

        大书页图渲染可达分钟级 → 单请求超时放宽 300s（客户端默认 30s 不变）。
        """
        return self._request("POST", f"{API_PREFIX}/books/{book_id}/ingest", timeout=300.0)

    def edit_block(
        self,
        book_id: str,
        page_no: int,
        block_index: int,
        verdict: str | None = None,
        note: str = "",
        corrected_text: str | None = None,
        corrected_bbox: list | None = None,
        corrected_type: str | None = None,
    ) -> dict:
        """块编辑（upsert 意图行；verdict: ok/bad，重复编辑覆盖）。返回 EditRecord。

        `corrected_type`＝人工块类型改判（闭集正本在 8902 BlockType）；生效类型由 8902 读侧叠加，本仓不合并。
        """
        body: dict = {}
        if verdict is not None:
            body["verdict"] = verdict
        if note:
            body["note"] = note
        if corrected_text is not None:
            body["corrected_text"] = corrected_text
        if corrected_bbox is not None:
            body["corrected_bbox"] = corrected_bbox
        if corrected_type is not None:
            body["corrected_type"] = corrected_type
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

    def list_parse_jobs(
        self,
        status: list[str] | None = None,
        book_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """任务列表（REQ-088：status 过滤 + active 标记；8902 旧码无此端点抛 404）。"""
        params: dict = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        if book_id:
            params["book_id"] = book_id
        return self._request("GET", f"{API_PREFIX}/parse-jobs", params=params)

    # --- ④ 知识点梳理（af_kp）透传原语 ---

    def kp_relay(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        *,
        timeout: float | None = None,
    ) -> tuple[int, bytes, str]:
        """梳理面的唯一通路：把 8902 的 (状态码, 响应字节, content-type) 原样交回调用方。

        与 `_request` 的分别**是刻意的**：本方法只在连接失败时抛 AxiomError，4xx／5xx 不抛——
        梳理契约里 confirm 的 422 正文与 200 同形（`missing` 是要逐条显示的清单）、`if_rev`
        冲突的 409 先于形状校验、槽位未接入是上游主动的 503；把上游状态码读成异常再换成
        `{"detail": …}` 就丢了形状（REQ-141 W2）。路径由调用方按 8902 原样拼好，本层不别名。

        `timeout` 缺省沿用客户端 30s；只有单点重生成这类**同步的百秒级模型调用**由调用方显式放长
        （8902 网关自身另有 360s 上限，根侧不得超过它，否则先断的永远是本层）。
        """
        kwargs = {} if timeout is None else {"timeout": timeout}
        try:
            response = self._client.request(method, path, json=body, **kwargs)
        except httpx.HTTPError as exc:
            raise AxiomError(f"8902 连接失败：{exc}") from exc
        return response.status_code, response.content, response.headers.get("content-type") or "application/json"

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
