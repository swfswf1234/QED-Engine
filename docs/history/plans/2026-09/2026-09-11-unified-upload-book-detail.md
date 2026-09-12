# 统一上传与书目详情界面优化（unified-upload-book-detail）

状态：Achieved
任务类型：B
最后更新：2026-09-11
关联 ADR：[ADR 0007](../../adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）
关联设计：[downloads-ui.md](../../../design/downloads-ui.md)、[downloads-flow.md](../../../design/downloads-flow.md)、[api-contracts.md](../../../architecture/api-contracts.md)
关联 Tracker：docs/trackers/todo.md（PLAN-039、ARCH-019、REQ-068）
归档判定：Merge（设计事实并入 downloads-ui.md 与 api-contracts.md，计划壳 Retain 归档 `../history/plans/2026-09/`）

> 本计划修复「上传书籍」链路缺陷并统一上传交互，同时重设计书目详情弹窗。
> 用户裁决（2026-09-11）：**上传一律打开文件管理器选择文件，不写路径**；书目详情
> 下载信息只需「是否下载成功 + 地址」，验证后确认/否定，或直接上传书籍。

## 根因分析（上传书籍为何失败）

证据链（代码位置）：

1. **前端依赖 Electron 属性**：`web-ui/src/pages/Downloads.tsx:714-739` 的
   `handleFileSelect` 读取 `(file as {path?}).path` 取绝对路径；应用运行在浏览器
   （8903 由 `serve_web.py` 托管，ADR 0007），`file.path` 恒为 `undefined` →
   直接报「无法获取文件路径，请确保在 Electron 环境中运行」，**请求从未发出**。
2. **8900 丢弃请求体**：`backend/qed_engine/api/tracker.py:485-488`
   `import_book_pdf(book_id, request)` **无 body 参数**；`TrackerClient.import_book_pdf`
   （`clients/tracker_client.py:174-176`）发往 8901 时不带任何 body。8901
   `POST /books/{id}/import` 期望 `{file_path, target_path?}` → **422/400**。
3. **路径文本输入未统一**：`Downloads.tsx:583-612` 教程内「导入书目文件」仍是手写路径
   输入框（绝对路径→import / 相对路径→register），与用户「不写路径」要求冲突。

结论：上传链路在「浏览器取路径」与「8900 透传请求体」两处断裂；修法是**改为浏览器
文件选择 + multipart 上传**，服务端落临时文件后调 8901 既有 import（8901 无需改动）。

## 目标与成功标准

1. **统一上传**：领域 JSON、课程 JSON、书籍 PDF 三类入口统一为「点击按钮 → 打开系统文件
   管理器 → 选择文件」；界面**不再出现任何文件路径输入框**。
2. **上传书籍可用**：浏览器选择 `.pdf` 后经 8900 multipart 上传 → 8901 校验并落
   `raw/<domain_id>/<course_id>/<slug>_<sha8>.pdf` + `holding=owned + status=downloaded`；
   返回登记结果并刷新弹窗。
3. **书目详情重设计**：按 §书目详情弹窗规格 实现——固定宽高、书目信息网格、下载信息
   只显示「成功与否 + 文件地址」、操作区「上传书籍 / 验证通过 / 否定」。
4. 门禁：后端 `pytest tests -q` + `ruff`、前端 `vitest` + `tsc` + `build`、契约 `tests/contract` 全绿。

## 范围与非目标

- **范围**：`backend/qed_engine/api/tracker.py`、`backend/qed_engine/clients/tracker_client.py`、
  `backend/qed_engine/api/schemas.py`（如需）、`tests/test_api.py`、`tests/test_tracker_client.py`；
  `web-ui/src/api/client.ts`（multipart 支持）、`web-ui/src/api/tracker.ts`、
  `web-ui/src/pages/Downloads.tsx`、`web-ui/src/components/DownloadsTree.tsx`、
  `web-ui/src/pages/Downloads.test.tsx`；文档 `docs/design/downloads-ui.md`、
  `docs/architecture/api-contracts.md` §③。
- **非目标**：8901 端点与 QED-Tracker 代码（import 已满足）；8900 书籍路由集其余对齐
  （decide/retry/complete/reject/supersede 删除、cancel 新增）见 PLAN-038 §③.9，另行排期；
  Axiom 解析链。

## 前置条件

- QED-Tracker `POST /books/{id}/import` 已支持 `{file_path, target_path?}`（2026-09-11 已就绪）。
- `python-multipart` 已在 QED_env 安装（0.0.28）；需补登记 `pyproject.toml` 依赖。

## 工作项

### W1 后端：8900 import 改 multipart（TDD）

- `POST /api/v1/books/{book_id}/import` 改为 `multipart/form-data`：
  - `file: UploadFile`（必填，`.pdf`）；`target_path: str | None = Form(None)`。
  - 8900 将上传字节写入系统临时文件（`tempfile`，后缀 `.pdf`）→ 调
    `TrackerClient.import_book_pdf(book_id, file_path=临时路径, target_path=...)` →
    `finally` 删除临时文件。
  - 错误：400（非 PDF/空文件）、404 `BOOK_NOT_FOUND`、422、503（8901 不可达）。
- `TrackerClient.import_book_pdf(book_id, file_path, target_path=None)` 发
  `{"file_path": ..., **({"target_path": ...} if target_path else {})}`。
- 测试（先红后绿）：`tests/test_api.py` 覆盖 multipart 成功转发（断言 8901 收到
  `file_path` 指向临时文件且内容一致）、非 PDF 400、8901 422 透传；
  `tests/test_tracker_client.py` 覆盖 body 组装与缺 file_path 校验。
- `pyproject.toml` 依赖补 `python-multipart`。

### W2 前端：统一上传（文件选择器，不写路径）

- `api/client.ts`：新增 `postForm<T>(path, form: FormData, opts?)`——**不设置**
  `Content-Type`（浏览器自动带 boundary），上传超时放宽（如 120s）。
- `api/tracker.ts`：`importBookPdf(bookId, file: File, targetPath?)` 改用 `FormData`。
- `Downloads.tsx`：
  - 删除 Electron `file.path` 依赖与「导入书目文件」路径输入弹窗；书行「上传」直接触发
    隐藏 `<input type="file" accept=".pdf">` → `importBookPdf(bookId, file)`。
  - `TutorialDetailModal` 的「导入」入口统一为文件选择。
- `DownloadsTree.tsx`：领域/课程 JSON 导入已为文件选择（`file.text()` + 内联提交），
  仅统一按钮文案与 loading/错误提示；确认无路径输入。
- 前端测试：更新 `Downloads.test.tsx`（原断言 `body.file_path` 改为断言 FormData 含
  `file`）；新增「无路径输入框」断言。

### W3 书目详情弹窗重设计（见 §书目详情弹窗规格）

- 重写 `BookDetailModal`：固定宽度、内容区滚动、信息网格、下载信息精简、操作区。
- 否定改 `retired` + `retire_reason`（对齐 QED-060；旧 `reject` 端点待 8900 对齐前，
  UI 用现有 `rejectBook` 或按 §③.9 对齐结果切换，实施时以 8901 实态为准）。
- 移除渠道原始列表为默认展示（改「查看渠道尝试」折叠，默认收起）。

### W4 文档同步

- `docs/design/downloads-ui.md`：新增/替换「书目详情弹窗」规范（尺寸、区块、操作、
  上传统一原则），删除路径输入相关描述。
- `docs/architecture/api-contracts.md` §③：`POST /books/{id}/import` 由「⚠ 待对齐」
  改为 multipart 契约；§③.9 移除 import 行。

## 书目详情弹窗规格

- **尺寸**：`width={760}`；内容区 `max-height: 68vh; overflow-y: auto`；窄屏 `max-width: 94vw`。
- **标题**：`书目详情 · {书名（含卷册）}`；标题右侧状态 Tag。
- **区块一 书目信息**（两列网格，label 灰 / value 主色）：
  书名、原版书名、卷册（part）、版本（edition）、作者（含 role）、出版社、出版年、
  语言、角色（roles）、页数。
- **区块二 下载信息**（只两行，满足「是否成功 + 地址」）：
  | 行 | 内容 |
  | --- | --- |
  | 下载状态 | 成功（`holding=owned` 且 `status ∈ {downloaded, verified}`）/ 失败（`status=failed`）/ 未下载（其余） |
  | 文件地址 | `file_path`（数据根相对路径）；无则 `absolute_path`；均无 → 「—」 |
  - 「查看渠道尝试（N）」折叠块（默认收起，含渠道/成败/链接，供排障）。
- **区块三 操作**（footer）：
  - `上传书籍`（secondary，任意状态可用）：打开文件管理器选 `.pdf`，上传登记。
  - `验证通过`（primary，仅 `status=downloaded`）：调 verify。
  - `否定`（danger，仅 `status=downloaded`）：填原因 → `retired` + `retire_reason`。
  - `关闭`（ghost）。
- **行为**：操作后 `fetchAll()`/`refreshDetail` 以服务端返回为准（禁乐观更新）；
  上传成功后就地更新弹窗为 `downloaded` 并提示。

## 验证与验收

- 后端：`conda run -n QED_env python -m pytest tests -q` 全绿 + `ruff check backend tests` 干净。
- 前端：`cd web-ui && npm test` + `npx tsc --noEmit` + `npm run build` 全绿。
- 契约：`pytest tests/contract -q` 全绿。
- 人工验收：浏览器（非 Electron）选择本地 PDF → 上传成功 → 弹窗显示「下载成功 + 地址」
  → 点「验证通过」→ 状态 verified；否定路径同样走通；三类上传入口均无路径输入框。

## 回滚

- 代码改动按 W1/W2/W3 独立提交，可单点 revert；8900 import 契约变更可回退为旧 JSON 形式
  （但旧形式本就不可用，回退仅用于隔离问题）。
- 文档改动由 Git 锚点恢复。

## 关闭与归档

- 关闭条件：成功标准 1~3 达成 + 人工验收通过。
- 归档动作：设计事实并入 `downloads-ui.md` 与 `api-contracts.md`；计划壳 Retain 归档
  `../history/plans/2026-09/`；todo PLAN-039 行移除并在 `plans/index.md` 登记去处。
