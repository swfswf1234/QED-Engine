# 2026-08 人工评审优化轮（review-round-v6）

状态：Accepted
任务类型：B
最后更新：2026-08-07
关联 ADR：[ADR 0002](../../../history/adr/v0.1/0002-frontend-and-port-centralization.md)
关联设计：[服务契约](../../../design/service-contracts.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-006 登记；REQ-006 承接前端执行；REQ-018 跨项目请求 QED-Tracker）
归档判定：用户确认计划（转 Accepted）→ 跨项目请求由 QED-Tracker 承接执行 → 前端门禁全绿 + 浏览器验收后 Completed，归档至 `history/plans/2026-08/`

## 前置条件

- 十三期已完成并提交（a5ce8c1，140 passed + ruff clean + JS OK）。
- 服务运行中：8900（pid 6432）、8901（pid 9708）、8903（pid 24380，静态托管改动即时生效）。
- 用户浏览器验收十三期后提出两个优化点：
  1. **重复书问题**：数学分析（陈纪修）教材与习题集是同一本书（archive 条目
     `math_analysis_chenjixiu` 课本及答案合订），评估时登记成两条资源，下载两本不合理；
  2. **评估任务区块无意义**：知识点界面尾部「评估任务」列表不知用途，应去掉；
  3. **人工评审建议**：人工评估时给出建议，落库存储。

## 目标与成功标准

按用户 2026-08-07 第六轮裁决：

1. **同源去重（跨项目，QED-Tracker）**：`catalog_evaluate` 评估时同来源
   （provider_id 一致）命中多个目标只登记第一条资源，其余目标标记
   「同来源已由 <资源> 覆盖」跳过，不再创建重复资源。
2. **去尾部评估任务区块（前端）**：删除知识点界面底部「评估任务」列表
   （`#task-list`、任务状态/类型/课程三个筛选器、区块头）；课程操作条步骤条
   （搜索→确认→下载→验收）完整保留（后台任务数据仍拉取，仅不渲染列表）。
3. **人工建议落库（跨项目接口 + 前端卡片）**：`qt_resources` 增加 `review_note`
   字段；confirm/backup/reject 三接口接受可选 `note` 参数并落库；前端资源卡
   三态按钮旁加建议输入框（选填），随三态一并提交，卡片与详情展示既有建议。
4. **存量清理**：现有重复资源（陈纪修 exercise candidate 与教材 confirmed
   同源）一并清理。

成功标准：根仓库 `pytest tests -q` 全绿 + `ruff check src tests` 无错误 + node --check；
QED-Tracker 仓库门禁（pytest + ruff + wheel + CLI 冒烟）由其仓库执行；8903 curl token
实测；浏览器验收（知识点界面无评估任务区块、步骤条保留、资源卡建议输入与提交）。

## 决策记录（用户裁决，2026-08-07）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 重复书处理方式 | 评估去重：同来源只登记一条（后端 catalog_evaluate，仅评估环节） |
| D2 | 评估任务区块去留 | 只去尾部任务列表，保留课程操作条步骤条（搜索步骤保留） |
| D3 | 人工建议方式 | 人工可填建议，落库存储；随三态按钮一并提交 |
| D4 | 去重落地范围 | 后端去重仅评估环节；存量重复数据一并清理 |
| D5 | 清理方式 | 存量重复（陈纪修 exercise candidate 与教材同源）标记 rejected（保留留痕），由 QED-Tracker 执行 |

## 范围与非目标

范围内：
- 根仓库：前端去尾部任务列表（`web/index.html`、`web/app.js`、`web/style.css`）、
  资源卡建议输入框与展示、`tests/test_web.py` 守护更新、文档同步。
- 跨项目（QED-Tracker 承接）：`catalog_evaluate` 同源去重、`review_note` 字段与
  三接口 `note` 参数、存量清理。

非目标：
- 不去掉课程操作条步骤条（用户裁决保留）。
- 不改 LLM 评估流程本身（打分/verdict/summary 保留）。
- 不动 catalog 冻结目录数据（01-chenjixiu / 01-chenjixiu-exercises 两个目标保留，
  由评估去重避免重复登记）。
- 8900 无改动；Axiom-Flow 不动。

## 跨项目请求（QED-Tracker 承接）

在 QED-Tracker 仓库建设计文档与 todo 请求（需求方：QED-Engine；执行方：QED-Tracker）：

| 请求 | 内容 | 接口面 |
| --- | --- | --- |
| 同源去重 | evaluate 时同 provider_id 只登记第一条，其余 skipped 报告 | 无接口变化（任务报告加 skipped 条目） |
| review_note 字段 | `qt_resources.review_note`（String 1000，默认空） | `GET /resources` 返回字段；`POST /resources/{id}/confirm|backup|reject` 可选 `note` 参数 |
| 存量清理 | 陈纪修 exercise candidate（`cand_c8977...`）与教材同源，标记 rejected（原因注明重复），文件无（candidate 无文件） | 数据操作，经现有 reject 接口 |

验收回执：QED-Tracker 完成并关闭其 todo 后，本计划回填其提交号与测试输出。

## 工作项

### Phase 1：QED-Tracker 跨项目请求（先发起，评审确认后由其执行）

- 根仓库 `docs/trackers/todo.md` 登记 REQ-018（请求：QED-Tracker）。
- QED-Tracker 仓库 `docs/design/` 建设计文档 + `docs/trackers/todo.md` 请求条目。
- 用户评审确认。

### Phase 2：test_web.py 守护更新（TDD 红态）

| 新增/变更 | 断言 |
| --- | --- |
| `REMOVED_TASK_CENTER_TOKENS = ("评估任务", "task-list", "任务状态：全部", "任务类型：全部")` | 上述 token 不在 index.html/app.js（尾部任务列表与筛选器移除） |
| `CONSOLE_KEPT_TOKENS = ("course-console", "btn-course-search", "course-steps")` | 课程操作条与步骤条仍存在 |
| `REVIEW_NOTE_TOKENS = ("review_note", "评审建议", "note")` | 资源卡建议输入框与提交逻辑在 app.js（依赖 QED-Tracker 接口回执后定稿） |
| 既有测试回归 | test_course_console、test_pipeline_course_based 等不受影响 |

### Phase 3：前端实现（TDD 绿态）

- `web/index.html`：删除 `panel-section-head`（评估任务区块头）与 `#task-list` 容器及三个任务筛选器。
- `web/app.js`：
  - 删除 `renderTasks`/`taskCard` 及任务筛选渲染分支；`loadTasks` 保留数据拉取
    （步骤条搜索态依赖），不再渲染列表。
  - `resourceCard` 三态按钮区加建议输入框（`input.review-note`，占位「填一句评审建议（可选）…」）；
    confirm/backup/reject 提交时带 `note` 值；卡片已有 `review_note` 时展示。
  - 详情弹窗（`renderResourceDetail`）展示 `review_note`。
- `web/style.css`：`.review-note` 输入框样式。
- 文档：service-contracts.md 8903 小节 + 8901 契约行更新；todo 台账。

### Phase 4：验证

- 根仓库：`pytest tests -q`、`ruff check src tests`、`node --check web/app.js`、
  8903 curl token 实测。
- QED-Tracker 回执后：8901 实测 review_note 接口与存量清理结果，联调验收。

## 风险与回退

- QED-Tracker 接口未就绪时前端先做列表移除（不依赖新接口），建议输入框随接口
  回执后落地或先行上 UI（提交失败提示），保证独立性铁律。
- 存量清理由 QED-Tracker 经 reject 接口执行（保留留痕），不直接删数据。

## 验证与验收

- 根仓库：`pytest tests -q` 全绿（含 tests/test_web.py 新守护
  test_task_center_removed / test_review_note_present）、`ruff check src tests`
  无错误、`node --check web/app.js` 通过；8903 curl token 实测
  （REMOVED_TASK_CENTER_TOKENS 不在、CONSOLE_KEPT_TOKENS 在、REVIEW_NOTE_TOKENS 在）。
- QED-Tracker：其仓库门禁（pytest + ruff + wheel + CLI 冒烟）与定向测试
  （同源去重、review_note 接口）；8901 重启后实测存量清理结果。
- 浏览器验收：知识点界面无评估任务列表、课程操作条步骤条保留、资源卡建议
  输入框随三态提交、详情弹窗展示评审建议。

## 回滚

- 前端：git revert 本计划提交即可恢复（web/ 与 tests/test_web.py 单次提交）；
  8903 静态托管无部署步骤，回滚即时生效。
- 跨项目部分：QED-Tracker 侧由其仓库回滚（review_note 列可留空值，
  同源去重仅影响新评估任务，不破坏存量数据）。

## 关闭与归档

- 关闭条件：门禁全绿 + QED-Tracker 回执（REQ-018 关闭）+ 浏览器验收通过。
- 归档：计划文档移至 `docs/history/plans/2026-08/`，todo 台账 ARCH-006 行移除
  并写入 completed.md；REQ-018 收到回执后更新证据列。
