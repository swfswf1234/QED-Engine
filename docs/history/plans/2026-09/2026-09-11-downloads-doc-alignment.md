# 文档下载管理全链路文档对齐轮（downloads-doc-alignment）

状态：Achieved
任务类型：B
最后更新：2026-09-11
关联 ADR：[ADR 0007](../../adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、[ADR 0010](../../adr/v0.1/0010-documentation-versioning.md)（文档版本机制）、[ADR 0011](../../adr/v0.1/0011-pending-design-location.md)（待评审设计位置）
关联设计：[downloads-flow.md](../../../design/downloads-flow.md)、[downloads-ui.md](../../../design/downloads-ui.md)、[admin-dashboard.md](../../../design/admin-dashboard.md)、[cross-project-contracts.md](../../../design/cross-project-contracts.md)、[api-contracts.md](../../../architecture/api-contracts.md)
关联 Tracker：docs/trackers/todo.md（PLAN-038、ARCH-019、REQ-068、REQ-076、REQ-077、REQ-078）
归档判定：Merge（设计事实并入 design/ 与 architecture/ 固定文档，计划壳 Retain 归档 `../history/plans/2026-09/`）

> 本计划为**纯文档对齐轮**：把探索 + 下载链路的既有文档收敛到单一事实源，并与
> QED-Tracker（2026-09-11 收口）契约对齐；不含代码改动。代码跟进项与 QED-Tracker
> 请求清单在文末登记，另行执行。

## 目标与成功标准

统一口径（2026-09-11 用户裁决）：

- 领域探索 **6 态**：未开始 / 已生成 / 探索中 / 待确认 / 已完成 / 失败。
- 课程探索 **5 态**：未开始 / 探索中 / 待确认 / 已完成 / 失败（**不与领域混用**，无「已生成」）。
- 书籍状态 **8 值**：选用 `candidate/decided/parallel/retired` + 生命周期
  `downloading/downloaded/verified/failed`。
- 书籍 UI 筛选 **5 档**：待下载(candidate+decided) / 下载中(downloading) / 待验证(downloaded)
  / 已完成(verified) / 失败(failed)；parallel 不计入筛选，retired 留痕隐藏。
- `explore_pending.kind` 归一为 `review_results` / `name_confirmation` / `error`
  （删除根仓库 `failed` 与 `import_courses` 双形态）。
- `active_session` 口径统一为 `exploration_stage == 探索中`。

成功标准：

1. 五份文档（downloads-flow / downloads-ui / admin-dashboard / cross-project-contracts /
   api-contracts）内部与相互之间零矛盾；`downloads-flow.md` 为探索 + 下载唯一事实源。
2. `cross-project-contracts.md` 的 8901 契约与 `api-contracts.md` §③ 的语义描述与
   QED-Tracker `docs/architecture/api.md`（2026-09-11）一致，明确标注 8900 路由集的
   待对齐项。
3. QED-Tracker 请求清单（REQ-076/077/078）与根仓库代码跟进清单登记入 todo。
4. `pytest tests/contract -q` 全绿（含端点清单、计划治理、设计元数据、Markdown 链接守护）。

## 范围与非目标

- **范围**：`docs/design/{downloads-flow,downloads-ui,admin-dashboard,cross-project-contracts,index}.md`、
  `docs/architecture/api-contracts.md`、`docs/plans/{2026-08-27-download-ux-flow,
  2026-09-10-downloads-interaction-spec,2026-08-27-exploration-download-flow}.md`、
  `docs/plans/index.md`、`docs/trackers/{todo,completed}.md`。
- **非目标**：任何代码改动（含 8900 路由/客户端、前端 store）；Axiom-Flow 解析链与
  `document-chunking-recall.md` 探索设计；8902 契约。

## 前置条件

- 用户裁决已确认：课程 5 态、书籍 UI 5 档、失败态纳入、`explore_pending.kind` 归一到
  QED-Tracker 形态、`active_session` 统一、PATCH /courses 走 QED-Tracker 支持（D1~D4）。
- 事实源：QED-Tracker `docs/architecture/api.md`、`database-shared-tables.md`、
  `database-private-tables.md`、`docs/design/{exploration-pipeline,download-pipeline,knowledge-import}.md`。

## 工作项

- **W1 状态机统一**（downloads-flow §2）：领域/课程分表；删除课程「3 态」错误口径；
  修正领域流转边（`探索中/待确认 → 失败`）。
- **W2 explore_pending 归一**（downloads-flow §4.2/§4.4）：统一 kind 与写点；删除
  `import_courses` 双形态叙述。
- **W3 UI 状态对齐**（downloads-ui §3.2/§4）：流程筛选改 5 档；三层口径表补
  `parallel/retired`；事实源文件改指 `database-private-tables.md`。
- **W4 仪表盘对齐**（admin-dashboard §四）：下载进度按生命周期派生。
- **W5 API 契约**（api-contracts §③）：语义描述对齐 QED-Tracker 新契约；保留 8900
  当前路由集（契约测试守护），补「待对齐」标注与跟进清单。
- **W6 跨项目契约**（cross-project-contracts）：8901 契约表整体重写；死链修正；
  Axiom 端口/映射层过时项清理；补 dataset JSON 例外。
- **W7 计划治理**：PLAN-023 标 Superseded 并归档；PLAN-037/022 对齐新口径。
- **W8 台账**：登记 PLAN-038；REQ-068 子项状态刷新；新增 REQ-076/077/078。
- **W9 门禁**：`pytest tests/contract -q` + 人工交叉核对清单。

## 验证与验收

- `conda run -n QED_env python -m pytest tests/contract -q` 全绿。
- 交叉核对清单（逐条勾选）：
  1. 领域 6 态 / 课程 5 态在 downloads-flow、api-contracts、PLAN-037 三处一致；
  2. 书籍 8 值 + UI 5 档在 downloads-ui、admin-dashboard、代码注释口径一致；
  3. `explore_pending.kind` 三形态在 downloads-flow、api-contracts、前端类型说明一致；
  4. 8901 端点集（含 start/fail/verify/cancel，不含 decide/retry/complete/reject/supersede）
     在 cross-project-contracts 与 QED-Tracker api.md 一致；
  5. QED-Tracker 请求与根仓库代码跟进清单均登记 todo。
- 用户审阅确认。

## 回滚

- 纯文档变更，由 Git 锚点恢复；各工作项独立提交，可单点 revert。
- PLAN-023 归档可经 Git 还原回 `docs/plans/` 并恢复 todo 行。

## 关闭与归档

- 关闭条件：成功标准 1~4 达成 + 用户审阅通过。
- 归档动作：设计事实并入 `design/` 与 `architecture/` 固定文档；本计划壳按 Retain 归档
  `../history/plans/2026-09/`；`todo.md` PLAN-038 行移除并在 `plans/index.md` 登记去处。

## 附：QED-Tracker 请求清单（跨项目）

| 请求 | 内容 | 目标文档 |
| --- | --- | --- |
| REQ-076 | 课程探索状态机 6 态 → **5 态**（删除课程「已生成」，仅领域保留）；`explore_pending.kind` 归一为 `review_results` / `name_confirmation` / `error` | `database-shared-tables.md`、`exploration-pipeline.md` |
| REQ-077 | `PATCH /courses/{course_id}` 支持 `exploration_stage` 字段（8900 课程阶段流转改经该端点，取消直写依赖） | `architecture/api.md` ②组 |
| REQ-078 | 确认探索产物 JSON（`domains.json`/`courses.json`/`tutorials.json`）写入 `raw/` 的 dataset 例外口径，供根仓库 `dataset-conventions.md` 同步 | `exploration-pipeline.md`、`knowledge-import.md` |

## 附：根仓库代码跟进清单（不在本轮）

1. 移除 `backend/qed_engine/services/explore_sessions.py` `_apply_course` 写课程 `已生成`
   （与课程 5 态冲突，改为不写或写 `待确认`）。
2. `explore_sessions.py` `_write_failure` 的 `kind:'failed'` → `kind:'error'`。
3. 8900 新增 `GET /api/v1/courses/{domain_id}` 透传（8901 已有）。
4. 8900 书籍组路由对齐 QED-Tracker：删 `decide/retry/complete/reject/supersede`，
   新增 `cancel`，`POST /books` 去 `knowledge_id`，`register/import` 改 `mark_owned` 语义。
5. 前端 `web-ui/src/api/tracker.ts` 清理已删端点并补 `cancelBook`；
   `stores/dashboard.ts` 聚合补 downloaded/verified/failed 生命周期。
