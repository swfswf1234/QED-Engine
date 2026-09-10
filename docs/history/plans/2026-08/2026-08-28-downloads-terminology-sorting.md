# 文档下载管理界面术语统一与排序优化计划

状态：Superseded（已被 REQ-067 吸收）
任务类型：B
最后更新：2026-08-31
关联 ADR：[ADR 0011](../../adr/v0.1/0011-pending-design-location.md)（待评审设计随计划承载，确定后迁入 design/ 固定文档）
关联设计：[downloads-manage-redesign.md](../../../design/downloads-ui.md)、[web-frontend.md](../../../architecture/frontend-architecture.md)
关联 Tracker：docs/trackers/todo.md（本计划行 PLAN-024；REQ-068；ARCH-019）
归档判定：Delete 归档（纯前端一次性实现，完成后成果并入 design/web-frontend.md 与 downloads-manage-redesign.md，计划归档 history/plans/）

> **2026-08-31 归档说明**：本计划全部工作项已被 [REQ-067](2026-08-29-req067-downloads-optimization.md) 吸收。
> - Task 1（术语统一）→ REQ-067 §A 已完成
> - Task 2（默认选中）→ REQ-067 §A 已完成
> - Task 3（课程名样式）→ REQ-067 A5 已完成
> - Task 4（排序）→ REQ-067 A4 已完成
> - Task 5（设计文档同步）→ 随 REQ-067 §A 执行
> - Task 6（端到端验证）→ REQ-067 §A 验证清单覆盖
> - 跨项目 REQ-068 → 仍在跟踪，由 QED-Tracker 承接
>
> 本文档不再维护，仅保留为审计痕迹。

> 2026-08-28 合规化登记：本计划由用户投入（writing-plans 产出），按 task-lifecycle 标准
> 补齐元数据与章节；**执行时序裁决（2026-08-28 用户）**：探索重建（PLAN-022 B1~B5/F1~F5）
> 优先——两计划涉及同一批 web-ui 文件（Downloads.tsx / explore.ts / ExploreFlowModal.tsx），
> 术语统一在探索改造完成后执行，避免同文件冲突。

## 目标与成功标准

统一文档下载管理界面术语为「教程」，优化排序逻辑与默认选中行为。

成功标准：

- 界面与测试断言中「教程」术语全面替换为「教程」（rejected/superseded 隐藏语义转简洁中文）
- 进入页面默认选中第一个领域（除非为空）
- 点击领域时课程按学习顺序（sort_order）排序展示，课程名称大写+空隙样式
- 教程/课程/状态三种筛选下展示格式统一
- `npm run test:run`、`npx tsc --noEmit`、`npm run build` 全绿

## 范围与非目标

- **范围**：web-ui 展示层（Downloads.tsx / Downloads.test.tsx / DownloadsTree.tsx / downloads.ts / downloads.css）+ 跨项目教程命名规范登记（REQ-068）
- **非目标**：8900/8901 API 契约变更；QED-Tracker 数据侧改名实现（由对方承接，本计划只登记请求）；文档解析管理等其他界面

## 前置条件

- 探索重建（PLAN-022 B1~B5/F1~F5）已完成合并，避免同文件编辑冲突
- QED-Tracker GET /courses 体系数据可用（服务端 sort_order 排序保证）

## 工作项

### Task 1: 术语替换——「教程」→「教程」

**Files:**
- Modify: `web-ui/src/pages/Downloads.tsx`（注释、筛选结果文案、空态、错误横幅）
- Modify: `web-ui/src/pages/Downloads.test.tsx`（测试断言术语）
- Modify: `web-ui/src/components/DownloadsTree.tsx`（注释、弹窗文案）
- Modify: `web-ui/src/stores/downloads.ts`（注释）

- [ ] **Step 1: 修改 Downloads.tsx 中的术语**

```typescript
// 筛选结果文案
<Text type="secondary">筛选结果：{filtered.length} 个教程（已排除否定/过时项）</Text>
// 空态文案
<Text type="secondary">{knowledge.length === 0 ? '暂无教程数据（8901 离线或未启动）' : '无匹配筛选的教程'}</Text>
// 错误横幅
message="教程数据不可达"
```

- [ ] **Step 2: 更新测试断言**（Downloads.test.tsx：筛选结果 X 个教程（已排除否定/过时项）、教程数据不可达）

- [ ] **Step 3: 更新 DownloadsTree.tsx 注释**（`该课程下还有 N 个教程，上游将拒绝删除（409 保护）。请先处理教程。`）

- [ ] **Step 4: 更新 downloads.ts 注释**（`教程节点 label：教程 name 优先（QED-Tracker 侧统一命名），空则「教程N」兜底`）

- [ ] **Step 5: 运行测试验证**（`cd web-ui && npm run test:run`，Expected: PASS）

### Task 2: 默认选中第一个领域

**Files:**
- Modify: `web-ui/src/stores/downloads.ts`（fetchAll 末尾初始选中）
- Modify: `web-ui/src/pages/Downloads.tsx`（初始选中 effect）

- [ ] **Step 1: store 新增 getDefaultSelection（domains 为空返回 null，否则选中第一个领域）并在 fetchAll 末尾 currentSelected === null 时应用**

- [ ] **Step 2: Downloads.tsx 添加初始领域选中 effect（selected === null && domains.length > 0）**

- [ ] **Step 3: 运行测试验证**（PASS）

### Task 3: 课程名称样式优化（大写+空隙）

**Files:**
- Modify: `web-ui/src/downloads.css`

- [ ] **Step 1: 添加 .dl-course-head-name（18px/700/uppercase/letter-spacing 0.5px/下边框分隔）与 .dl-course-head-note 样式**

- [ ] **Step 2: 浏览器验收：点击领域后课程名称大写样式、上下空隙生效**

### Task 4: 点击领域时按课程学习顺序排序

**Files:**
- Modify: `web-ui/src/stores/downloads.ts`（buildTreeNodes 注释固化排序契约）
- Modify: `web-ui/src/pages/Downloads.tsx`（RightPanel filtered 保持服务端排序序）

- [ ] **Step 1: buildTreeNodes 注释固化（课程按 sort_order 服务端保证，前端保持返回序；教程按 course_id 归组，不虚构兜底节点）**

- [ ] **Step 2: RightPanel filtered 保持 knowledge 原序（course_id 分组）**

- [ ] **Step 3: 运行测试验证**（PASS）

### Task 5: 设计文档同步与跨项目登记

**Files:**
- Modify: `docs/design/downloads-manage-redesign.md`（教程命名规范节）
- Modify: `docs/trackers/todo.md`（REQ-068 已随本计划合规化登记）

- [ ] **Step 1: 更新 downloads-manage-redesign.md 教程命名节（name = 教程{set_no}：{书名}（{作者}）；存量 01 数学分析 3 行改名；前端兜底「教程{set_no}」）**

- [ ] **Step 2: REQ-068 跨项目请求由 QED-Tracker 承接（数据侧 tutorial 教程 name 规范化 + migrate_knowledge/cli 默认命名同步）**

- [ ] **Step 3: 运行 `pytest tests/contract/ -q`（PASS）**

### Task 6: 端到端验证

- [ ] **Step 1: `cd web-ui && npm run test:run`（PASS）**
- [ ] **Step 2: `cd web-ui && npx tsc --noEmit`（PASS）**
- [ ] **Step 3: `cd web-ui && npm run build`（PASS）**
- [ ] **Step 4: 浏览器验收清单**（默认选中第一领域 / 教程筛选文案 / 课程学习顺序排序 / 大写样式 / 展示格式统一 / 空态错误文案）

## 验证与验收

- web-ui 三件套全绿（test:run / tsc --noEmit / build）
- 根仓库契约测试全绿（pytest tests/contract）
- 浏览器验收清单逐项通过（Task 6 Step 4）
- 跨项目：REQ-068 由 QED-Tracker 承接回执后关闭

## 回滚

纯前端展示层改动，无数据迁移与 API 契约变更：按文件逐个 revert 即可完全回退；样式回退仅涉及 downloads.css。

## 关闭与归档

- 验收清单全部通过 + REQ-068 回执 → REQ-068/PLAN-024 关闭
- 本计划按 Delete 归档判定移入 history/plans/，成果并入 design/web-frontend.md 与 downloads-manage-redesign.md

## 跨项目协调说明

本计划涉及前端术语统一，跨项目任务已登记 todo（REQ-068）。QED-Tracker 数据侧的教程命名规范变更需由对方项目执行，根仓库 agent 只负责：读取对方当前命名状态 → todo 登记请求 → 等待对方回执。根据 AGENTS.md 跨项目协作规范，根仓库 agent 不得在 QED-Tracker 工作区产生代码改动。
