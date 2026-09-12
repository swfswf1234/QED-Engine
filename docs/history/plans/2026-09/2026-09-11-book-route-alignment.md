# 8900 书籍路由集对齐（book-route-alignment）

状态：Achieved
任务类型：B
最后更新：2026-09-11
关联 ADR：[ADR 0007](../../adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）
关联设计：[api-contracts.md](../../../architecture/api-contracts.md) §③/§③.9、[cross-project-contracts.md](../../../design/cross-project-contracts.md)、[downloads-flow.md](../../../design/downloads-flow.md)、[downloads-ui.md](../../../design/downloads-ui.md)
关联 Tracker：docs/trackers/todo.md（PLAN-040、REQ-068、REQ-079、ARCH-019）
归档判定：Merge（契约事实并入 api-contracts.md；计划壳 Retain 归档 `../history/plans/2026-09/`）

> 本计划把 8900 书籍路由集从「旧八态下载机过渡形态」对齐到 QED-Tracker QED-060
> 目标契约（api-contracts.md §③.9 书籍组）。QED-Tracker 原生端点已就绪，本轮只改 8900
> 适配层与前端调用，**不改 8901 代码**。

## 目标与成功标准

1. `POST /books` 换目标契约：`book_id` + `title` 必填（**无 `knowledge_id`**），可选
   `original_title/part/authors/publisher/edition/year/language/roles/status/domain_id/notes`；
   缺 `book_id`/`title` → 422；成功返回 **201**。
2. 新增 `POST /books/{book_id}/cancel`（`downloading → decided`），透传 8901。
3. 删除 8900 旧端点：`decide`、`retry`、`complete`、`reject`、`supersede`（含对应
   `TrackerClient` 方法与请求体模型）。
4. 前端 `tracker.ts` 删除 `decideBook/retryBook/rejectBook/supersedeBook`，新增 `cancelBook`；
   `Downloads.tsx` 移除「否定」按钮与「否决书目」流程（用户裁决，REQ-079 落地 retire 端点前
   无后端可调，保留即死按钮）。
5. 契约与文档同步：`api-contracts.md` §③ 去「⚠ 待对齐」、删 5 个旧端点标题、新增 cancel 标题、
   `POST /books` 按目标契约描述；§③.9 书籍组收敛为已完成。
6. 门禁：后端 `pytest tests -q` + `ruff`、前端 `vitest` + `tsc` + `build`、契约 `tests/contract` 全绿。

## 目标契约（事实源：QED-Tracker `docs/architecture/api.md` 书籍节）

| 端点 | 8900 目标行为 |
| --- | --- |
| `POST /books` | 201；body `book_id`+`title` 必填，其余可选；透传 8901 |
| `GET /books/{id}/sources` | 不变（透传） |
| `POST /books/{id}/sources` | 不变（透传） |
| `POST /books/{id}/register` | 不变（8901 `mark_owned`，8900 校验 `relative_path` 必填） |
| `POST /books/{id}/fetch` | 不变（202 任务） |
| `POST /books/{id}/import` | 不变（PLAN-039 multipart） |
| `POST /books/{id}/start` | 不变（透传，8901 新语义 `decided→downloading`） |
| `POST /books/{id}/fail` | 不变（透传，`downloading→failed`） |
| `POST /books/{id}/verify` | 不变（透传，`downloaded→verified`） |
| `POST /books/{id}/cancel` | **新增**（透传，`downloading→decided`） |
| `POST /books/{id}/decide` | **删除** |
| `POST /books/{id}/retry` | **删除** |
| `POST /books/{id}/complete` | **删除** |
| `POST /books/{id}/reject` | **删除**（退役 `retired` 待 REQ-079 端点） |
| `POST /books/{id}/supersede` | **删除** |

## 范围与非目标

- **范围**：`backend/qed_engine/api/tracker.py`、`backend/qed_engine/clients/tracker_client.py`、
  `tests/test_api.py`、`tests/test_tracker_client.py`；`web-ui/src/api/tracker.ts`、
  `web-ui/src/pages/Downloads.tsx`、`web-ui/src/pages/Downloads.test.tsx`；
  文档 `docs/architecture/api-contracts.md`、`docs/design/downloads-ui.md`（去否定按钮）、
  `docs/design/cross-project-contracts.md`（如有 8900 侧描述）。
- **非目标**：8901/QED-Tracker 代码；`register/start/fail/verify/fetch/sources` 行为变更
  （已符合目标契约，仅确认）；知识（tutorial）级 `reject/supersede` 端点（§③.9 未列，保持）；
  `retired` 写入路径（REQ-079）；Axiom 解析链。

## 前置条件

- QED-Tracker QED-060 已提供 `start/fail/verify/cancel` 并删除旧端点（2026-09-11 已就绪）。
- `POST /books` 目标契约字段与 8901 一致（见上表事实源）。

## 工作项

### W1 后端：8900 路由集对齐（TDD）

- `BookCreateBody` 换目标契约字段（去 `knowledge_id/kind/display_title/version/source/original_url`；
  加 `book_id/original_title/publisher/edition/year/status/domain_id/notes`）。
- `POST /books`：校验 `book_id` + `title` 必填 422；`_call(..., _status_code=201)`。
- 新增 `POST /books/{book_id}/cancel`（无 body，透传）。
- 删除 `POST /books/{book_id}/decide|retry|complete|reject|supersede` 路由及
  `BookCompleteBody/BookRejectBody/BookSupersedeBody` 模型。
- `TrackerClient`：`create_book(book_id, **kwargs)`（不再拼 `knowledge_id`）；新增 `cancel_book`；
  删除 `decide_book/retry_book/complete_book/reject_book/supersede_book`。
- 测试（先红后绿）：`tests/test_api.py` 覆盖 `POST /books` 201 + body 透传（不含 knowledge_id）、
  缺字段 422、`cancel` 透传；删除旧端点用例（改为 404/405 断言或移除）。
  `tests/test_tracker_client.py` 覆盖 `create_book` body 组装、`cancel_book` 路径、缺字段校验。

### W2 前端对齐

- `api/tracker.ts`：删 `decideBook/retryBook/rejectBook/supersedeBook`；新增 `cancelBook`；
  `CreateBookBody` 与 `createBook` 已符合目标契约（无需改）。
- `Downloads.tsx`：移除「否定」按钮、「否决书目」弹窗与 `rejectBook` 调用链（`rejectBook_` 状态、
  弹窗、`handleReject` 分支）；`BookDetailModal` footer 由 4 按钮收敛为
  「上传书籍 / 验证通过 / 自动下载 / 关闭」。
- `Downloads.test.tsx`：删除否定相关断言；其余保持。

### W3 文档同步

- `api-contracts.md` §③ 书籍节：删除 5 个旧端点标题（decide/retry/complete/reject/supersede）；
  新增 `POST /books/{id}/cancel` 标题；`POST /books` 去「⚠ 待对齐」并按目标契约定稿；
  register/start/fail/verify 去「⚠」；顶部「⚠ 待对齐（8900 路由集）」块收敛。
- `api-contracts.md` §③.9：书籍组标「✅ 已完成（PLAN-040）」，或整节收敛为已完成说明。
- `api-contracts.md`「成功态规整」注：补 `POST /books` 显式 201 的例外说明。
- `downloads-ui.md`：书目详情弹窗操作区去掉「否定」，4 按钮 → 3 按钮 + 关闭。

### W4 门禁与验收

见「验证与验收」。

## 验证与验收

- 后端：`conda run -n QED_env python -m pytest tests -q` 全绿 + `ruff check backend tests` 干净。
- 前端：`cd web-ui && npm test` + `npx tsc --noEmit` + `npm run build` 全绿。
- 契约：`pytest tests/contract -q` 全绿（端点清单双向一致、计划治理、链接）。
- 人工验收（可选，浏览器）：新建书目走新 body 成功（201）；对 `downloading` 书点取消可复位；
  详情弹窗不再出现「否定」。

## 回滚

- 代码按 W1/W2 独立提交可单点 revert；8900 路由删除可回退（但旧端点上游已删，回退仅隔离问题）。
- 文档改动由 Git 锚点恢复。

## 关闭与归档

- 关闭条件：成功标准 1~5 达成、门禁全绿。
- 归档动作：契约事实并入 `api-contracts.md`；计划壳 Retain 归档 `../history/plans/2026-09/`；
  todo PLAN-040 行移除并在 `plans/index.md` 登记去处；REQ-068 根仓库代码跟进部分可关闭。
