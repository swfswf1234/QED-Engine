# 文档下载管理界面优化（REQ-067 综合计划）

状态：In Progress
任务类型：B
最后更新：2026-08-30
关联 ADR：[ADR 0011](../history/adr/v0.1/0011-pending-design-location.md)（待评审设计随计划承载，确定后迁 design/ 固定文档）
关联设计：[2026-08-27-download-ux-flow.md](2026-08-27-download-ux-flow.md)（PLAN-023）
关联 Tracker：docs/trackers/todo.md（本计划行 PLAN-025；REQ-067）
归档判定：实现完成后归档 history/plans/2026-08/

> 本文档整合原 PLAN-026（布局优化）和 PLAN-027（右边栏展示），作为 REQ-067 的完整设计规范。
> 2026-08-30 重构：按实现状态分层——§A 已完成/已确认、§B 待开发、§C 待确认/待消解。

---

## 目标与成功标准

### 核心目标

1. **布局优化**：Fixed 布局（标题栏/筛选栏/左树固定，内容区独立滚动）
2. **右边栏展示**：5 个场景的展示逻辑（无领域空态→领域无课程→选择领域→选择课程→状态筛选）
3. **样式统一**：领域名称/课程名称样式统一，课程头居中+介绍左对齐
4. **探索流程重构**：领域探索改为无弹窗直接触发（QED-Tracker 驱动状态）；导入领域知识支持 JSON 文件选择

### 成功标准

**§A 已完成（已验证）：**
- [x] 标题栏、筛选栏、左树固定不动，内容区独立滚动
- [x] 左树内容溢出时独立滚动
- [x] 领域名称样式：大写+加粗+letter-spacing
- [x] 场景1：无领域/未选中 → 两种空态文案
- [x] 场景2：领域无课程 → 提示文案
- [x] 场景3：选择领域 → 领域卡→课程(按sort_order)→教程(按set_no)→书籍(4组排序)
- [x] 场景4：选择课程 → 课程头(居中+介绍左对齐)→教程→书籍
- [x] 场景5：状态筛选 → 教程级隐藏+课程级隐藏
- [x] 书籍排序：中文教材→中文习题集→英文教材→其余；组内册号递增
- [x] 课程名居中，课程介绍左对齐

**§B 待开发：**
- [ ] 领域右键菜单重构为 5 项（探索/导入/修改/新增课程/删除）
- [ ] 领域探索（自动）：无弹窗直接触发，状态由 QED-Tracker 驱动
- [ ] 导入领域知识：文件选择器 + JSON 校验 + QED-Tracker API
- [ ] 修改领域：分态（探索前仅描述；探索后可加学科知识+课程方向）
- [ ] 新增课程：前置条件（需完成探索/导入）+ 阶段/学术方向选项
- [ ] DomainInfoCard 探索按钮改为直接触发
- [ ] 名称确认 UI：DomainInfoCard 内嵌确认区域
- [ ] 探索状态追踪：exploration_stage 由 QED-Tracker 写入，前端轮询读取

---

## 范围与非目标

- **范围**：文档下载管理页（`#/admin/downloads`）前端展示层 + 领域右键菜单 + 探索触发流程
- **非目标**：8900 后端 API 本身（仅透传）；QED-Tracker 侧探索引擎/导入 API 实现（由对方建计划文档）

---

## 前置条件

- 前置计划：文档下载管理用户操作流程（[PLAN-023](2026-08-27-download-ux-flow.md)）——本计划承接其界面优化续
- 探索链路新架构已落地（PLAN-022 B1~B5 + F1~F5，2026-08-28 全量执行）
- 导入领域知识 API 契约待 QED-Tracker 回执（REQ-067-A / PLAN-026），§B3 依赖该回执
- 开发环境：见 [本地开发环境](../standards/local-dev.md)（机器 wenfu / UUID 2C6ECD2C-BBEE-11ED-8A95-F0D4154ABBA8）

---

## 工作项

工作项按实现状态分三层组织（下文 §A 已实现 / §B 待开发 / §C 待确认）：

- §A 已完成：Fixed 布局（A1）、领域名样式（A2）、右边栏 5 场景（A3）、书籍排序（A4）、课程头样式（A5）
- §B 待开发：B1 领域右键菜单 5 项重构 / B2 探索无弹窗直接触发 / B3 导入领域知识 JSON / B4 修改领域分态 / B5 新增课程前置条件+扩展字段 / B6 DomainInfoCard 按钮改造 / B7 名称确认 UI / B8 探索状态追踪
- §C 待确认：C1 导入 API 契约（REQ-067-A）、C2 探索状态通知机制

---

## §A  已完成 / 已确认规范

> 以下 5 个 Task 已实现并通过验证。保留规范摘要与实现证据，供后续审计追溯。

### A1  Fixed 布局 ✅

**规范**：标题栏、筛选栏、左树固定不动，内容区独立滚动。

**实现证据**（`web-ui/src/downloads.css`）：
- `.dl-page`（4-12 行）：`height: 100vh; display: flex; flex-direction: column;`
- `.dl-header`（15-21 行）：`flex-shrink: 0;`
- `.dl-filter-bar`（194-200 行）：`flex-shrink: 0;`
- `.dl-layout`（30-37 行）：`flex: 1; overflow: hidden;`
- `.dl-tree-wrap`（41-52 行）：`flex-shrink: 0; overflow: hidden;`；内部 `.dl-tree`（54-60 行）`overflow-y: auto;`
- `.dl-content`（211-219 行）：`flex: 1; overflow-y: auto;`（独立滚动）

**验证**：✅ 浏览器确认固定布局 + 独立滚动正常

---

### A2  领域名称样式统一 ✅

**规范**：领域名称大写+加粗+letter-spacing，与课程名称样式统一。

**实现证据**（`web-ui/src/downloads.css:384-390`）：
```css
.dl-domain-name {
  text-transform: uppercase;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.5px;
  color: #1f1f1f;
}
```

**验证**：✅ 浏览器确认领域名称样式正确

---

### A3  右边栏展示逻辑（5 场景）✅

**规范**：右侧面板根据选择状态展示 5 个场景。

**实现证据**（`web-ui/src/pages/Downloads.tsx:695-866`，RightPanel 组件）：

| 场景 | 触发条件 | 实现行 |
|---|---|---|
| 场景1：空态 | `domains.length === 0 \|\| (selected === null && !selectedDomain)` | 796-805 行 |
| 场景2：无课程 | `selectedDomain && selectedDomain.courses.length === 0` | 808-815 行 |
| 场景3：领域+分组 | `hasDataWithDomain && !selectedCourse` | 818-861 行 |
| 场景4：课程头置顶 | `selectedCourse` 存在 | 824-829 行 |
| 场景5：筛选隐藏 | `filters.stage` 非空 → 无匹配教程的课程整组隐藏 | 742-745 行（过滤）+ 842-843 行（隐藏） |

**验证**：✅ 浏览器确认 5 个场景展示正确

---

### A4  书籍排序（4 组）✅

**规范**：中文教材→中文习题集→英文教材→其余；组内册号递增。

**实现证据**（`web-ui/src/stores/downloads.ts:78-95`）：
- `group()` 内部函数（79-85 行）：4 组索引 0-3
- `partNumber()` 辅助函数（60-71 行）：第一册→1 ... 第五册→5，上册→1，中册→2，下册→3，答案册→99
- 组内排序（86-94 行）：先 `partNumber` 升序，再 `title` 的 `localeCompare('zh-Hans-CN')` 稳定序

**测试覆盖**（`web-ui/src/stores/downloads.test.ts`）：4 个 sortBooks 测试用例（中文教材优先、组内册号递增、上下册+答案册、同册数稳定序）

**验证**：✅ 测试全绿 + 浏览器确认排序正确

---

### A5  课程头样式 ✅

**规范**：课程名居中，课程介绍左对齐。

**实现证据**（`web-ui/src/downloads.css`）：
- `.dl-course-head-name`（255-265 行）：`text-align: center; text-transform: uppercase; font-weight: 700;`
- `.dl-course-head-note`（267-274 行）：`text-align: left; color: #666; font-size: 13px; white-space: pre-wrap;`

**测试覆盖**（`web-ui/src/pages/Downloads.test.tsx`）：第 10 个测试"课程头：右面板展示课程名+介绍"

**验证**：✅ 测试全绿 + 浏览器确认样式正确

---

## §B  待开发

> 以下为 REQ-067 剩余工作项。探索流程部分按 2026-08-30 用户新规范重写。

### B1  领域右键菜单重构

**目标**：将领域右键菜单从 4 项调整为 5 项，重新排序。

**当前**（`DownloadsTree.tsx:347-361`）：新增课程、修改领域、探索课程体系（初始/重探）、删除领域

**目标菜单**：

| # | Key | 标签 | 前置条件 | 行为 |
|---|---|---|---|---|
| 1 | `explore` | 领域探索（自动） | 无 | 直接调 API 启动探索（B2） |
| 2 | `import` | 导入领域知识 | 无 | 打开文件选择器（B3） |
| 3 | `edit` | 修改领域 | 无（字段受限，见 B4） | 打开修改弹窗 |
| 4 | `add-course` | 新增课程 | 需完成探索/导入 | 打开课程表单（B5） |
| 5 | `delete` | 删除领域 | 无课程 | 确认删除 |

**改动文件**：`web-ui/src/components/DownloadsTree.tsx`

---

### B2  领域探索（自动）— 无弹窗 + REST 驱动

**核心变更**：点击即启动探索，不经过 ExploreFlowModal 弹窗。8900 纯透传，QED-Tracker 接管全部状态流转。

**架构**：
```
前端 → POST /api/v1/domains/{id}/explore（8900 透传）→ 8901
  8901：立即写 exploration_stage='探索中' → 提交 domain_explore 后台任务
    ├─ 名称需确认 → exploration_stage='已生成' + explore_pending={kind:name_confirm, name_check}
    ├─ 直接通过 → apply（upsert 域字段+课程+path_results）→ exploration_stage='已完成'
    └─ 异常 → exploration_stage='失败' + explore_pending={kind:failed, error}
```

**前端轮询**：`GET /api/v1/courses/{domain_id}`（5s 间隔），读 `exploration_stage` + `explore_pending`，DomainInfoCard 实时更新。

**改动文件**：
- `backend/qed_engine/clients/tracker_client.py`：新增 `explore_domain()` + `confirm_domain_name()`
- `backend/qed_engine/api/tracker.py`：新增 2 个透传路由
- `web-ui/src/api/tracker.ts`：新增 `exploreDomain()` + `confirmDomainName()`
- `web-ui/src/components/DownloadsTree.tsx`：菜单 handler 改为调 `exploreDomain()`
- `web-ui/src/stores/downloads.ts`：新增 5s 轮询 exploration_stage 机制
- `web-ui/src/pages/Downloads.tsx`：DomainInfoCard 读 exploration_stage + explore_pending

---

### B3  导入领域知识

**流程**：
1. 用户右键领域 → 点击「导入领域知识」
2. 浏览器文件选择器（`<input type="file" accept=".json">`）
3. 前端校验：`JSON.parse` + 检查 `name`/`courses` 字段存在
4. 调 QED-Tracker 导入 API（端点契约见 §C3）
5. 成功后 `fetchAll()` 刷新树

**参考 JSON 结构**（`QED-Tracker/docs/knowledge/computer-science.json`）：
```json
{
  "domain": "computer-science",
  "name": "计算机科学与技术",
  "description": "...",
  "level": "本科",
  "stages": ["基础", "主干", "分支", "前沿"],
  "classic_tracks": [
    { "name": "程序设计与算法", "summary": "...", "kind": "main" }
  ],
  "courses": [
    { "slug": "c_programming", "name": "程序设计基础", "track": "...", "stage": "..." }
  ]
}
```

**改动文件**：
- `web-ui/src/components/DownloadsTree.tsx`：新增菜单 handler + 文件选择逻辑
- `web-ui/src/api/tracker.ts`：可能新增导入 API 调用

---

### B4  修改领域 — 分态

**规则**：根据 `exploration_stage` 决定可编辑字段。

| exploration_stage | 可编辑字段 | 不可编辑 |
|---|---|---|
| undefined / 探索中 / 失败 | 描述（description） | 学科知识、课程方向 |
| 已完成 / 已生成 | 描述 + 学科知识（classic_tracks）+ 课程方向（stages） | 名称（始终锁定） |

**表单扩展**（TreeFormModal `edit-domain` 模式）：
- 新增 `classic_tracks` 字段：JSON 编辑或标签式表单
- 新增 `stages` 字段：标签编辑（已有 `UpdateDomainBody.stages` 支持）

**改动文件**：
- `web-ui/src/components/DownloadsTree.tsx`：TreeFormModal 条件渲染
- API 已支持：`PATCH /domains/{id}` 已支持 `stages` 参数（`tracker.ts:55-62`）

---

### B5  新增课程 — 前置条件 + 扩展字段

**前置条件**：`domain.exploration_stage === '已完成'` 或 `exploration_stage === '已生成'`
- 满足前：菜单项禁用 + Tooltip："需先完成领域探索或导入领域知识"
- 满足后：正常点击

**表单扩展**（TreeFormModal `add-course` 模式）：
- 课程名（必填）—— 保持
- 阶段（Select）—— 选项从 `domain.stages` 取
- 学术方向（Select）—— 选项从 `domain.classic_tracks` 取（`classic_tracks[].name`）
- 描述（可选 TextArea）—— 保持

**改动文件**：
- `web-ui/src/components/DownloadsTree.tsx`：菜单禁用逻辑 + TreeFormModal 扩展

---

### B6  DomainInfoCard 探索按钮改造

**当前**：三个按钮状态全部调 `openFlow()` → 打开 ExploreFlowModal 弹窗

**目标**：全部改为直接触发探索（`exploreDomain()` → 8900 → 8901）

| 状态 | 当前行为 | 目标行为 |
|---|---|---|
| initial/reexplore | `openFlow()` → 弹窗 | 直接 `exploreDomain(domainId)` |
| pending（待确认） | `openFlow()` → 弹窗 | 显示名称确认 UI（B7） |
| running | 禁用按钮 | 保持禁用 |
| failed | 无 | 显示错误 + 重试按钮 |

**改动文件**：`web-ui/src/pages/Downloads.tsx`（DomainInfoCard 组件，641-692 行）

---

### B7  名称确认 UI — DomainInfoCard 内嵌

**当前**：弹窗内 `NameConfirmView` 裁决

**目标**：DomainInfoCard 内嵌确认区域

**触发条件**：`explore_pending?.kind === 'name_confirm'`（QED-Tracker 探索完成但需确认名称）

**数据源**：`DomainSystem.explore_pending`（从 GET /courses 或 GET /domains 返回）
```typescript
explore_pending?: {
  kind: 'name_confirm';
  name_check: { suggested_name: string; valid: boolean; reason: string };
} | {
  kind: 'failed';
  error: string;
} | null;
```

**UI 形态**：
- DomainInfoCard 内显示橙色 Alert 提示条："领域名称需要确认"
- 显示原名 vs 建议名（从 `explore_pending.name_check.suggested_name` 读取）
- 两个按钮：[采纳建议] → `confirmDomainName(domainId, {decision: 'accept'})`；[保留原名] → `confirmDomainName(domainId, {decision: 'retain'})`
- 点击后等待 exploration_stage 从 '已生成' 变为 '已完成'，然后刷新树

**改动文件**：`web-ui/src/pages/Downloads.tsx`（DomainInfoCard 组件内部）

---

### B8  探索状态追踪 — QED-Tracker 驱动 + 5s 轮询

**当前**：8900 经 `shared_tables.py` 直写 `exploration_stage`，前端轮询 session endpoint

**目标**：QED-Tracker 接管全部状态流转，前端轮询 `exploration_stage` + `explore_pending`

**数据流**：
```
前端 → POST /domains/{id}/explore → 8900 透传 → 8901（异步任务）
  8901 写 exploration_stage + explore_pending
  前端 5s 轮询 GET /courses/{domain_id} → 读 DomainSystem.exploration_stage + explore_pending
  → DomainInfoCard 实时更新（探索中/待确认/已完成/失败）
```

**5 状态模型**：

| exploration_stage | 含义 | explore_pending |
|---|---|---|
| 未开始 | 默认/新建领域 | null |
| 探索中 | 8901 后台任务运行中 | null |
| 已生成 | 名称需确认 | `{kind: 'name_confirm', name_check: {...}}` |
| 已完成 | 探索完成+已应用 | null |
| 失败 | 探索异常 | `{kind: 'failed', error: '...'}` |

**前端轮询实现**：
- `stores/downloads.ts`：新增定时轮询（5s），读 `/courses/{domain_id}` 的 `exploration_stage` + `explore_pending`
- 当 exploration_stage 从 '探索中' 变为终态（已完成/已生成/失败）→ 刷新树 + 通知用户
- `useExploreUiStore.domainRunStatus` 保留作为瞬时 running 态乐观标记

**失败重试**：`explore_pending.kind === 'failed'` 时 DomainInfoCard 显示红色 Alert + [重试] 按钮 → 直接重新调 `exploreDomain()`

**改动文件**：
- `web-ui/src/stores/downloads.ts`：新增 5s 轮询机制
- `web-ui/src/pages/Downloads.tsx`：DomainInfoCard 读 explore_pending 处理 name_confirm/failed

---

## §C  待确认 / 待消解

> 以下项需要消解冲突或等待外部回执。

### C1  探索流程文案冲突

**问题**：REQ-067 原文说「基于整理好的文本探索→导入领域数据」；PLAN-023 §3.2 说「直接开始 / 基于整理好的文本探索」；当前实现为「直接开始探索 / 导入探索结果」——三方不一致。

**处理**：已被 §B 用户新规范（领域探索自动+导入领域知识）完全取代。此处留作审计痕迹，不再执行原文案修改。

---

### C2  场景 5 隐藏规则矛盾

**问题**：成功标准第 32 行写「教程级隐藏+课程级隐藏」；§场景 5（原 170-174 行）写「领域信息卡始终展示（不因筛选隐藏）」——后者暗示存在「领域级隐藏」概念。

**处理**：代码已正确实现课程级隐藏（`Downloads.tsx:842-843`：`if (tutorials.length === 0) return null`）。§场景 5 描述修正为与成功标准一致：领域信息卡始终展示（非隐藏规则），隐藏仅发生在教程级和课程级。

---

### C3  导入领域知识 API 契约

**问题**：导入 JSON 文件的 QED-Tracker 侧 API 端点尚未定义。

**当前状态**：已传递 QED-Tracker 项目，对方正在开发。

**待回执**：
- 导入端点 URL 与请求/响应格式
- JSON 校验规则（必需字段、可选字段）
- 错误码定义

**处理**：临时 todo 已登记（REQ-067-A），plans/ 文档已创建（`2026-08-30-req067-import-api.md`）。回执后更新 §B3。

---

### C4  "学科知识""课程方向"选项来源

**问题**：B5 新增课程的阶段/学术方向选项从哪里取？

**已确认**：从 `DomainSystem` 接口返回的 `classic_tracks` 和 `stages` 字段动态读取（`stores/index.ts:255-260`）。
- `stages?: string[]` — 阶段选项
- `classic_tracks?: unknown[]` — 学术方向选项（`classic_tracks[].name` 为显示值）

---

### C5  ExploreFlowModal 保留范围

**问题**：探索流程重构后，ExploreFlowModal 是否完全废弃？

**已确认**：保留 ExploreFlowModal 仅用于**课程探索**（`variant='course'`）。领域探索（`variant='curriculum'`）逻辑从 ExploreFlowModal 剥离，改为直接触发。ExploreFlowModal 中 curriculum 相关的表单/结果视图可逐步清理。

---

## 文件改动清单

| 文件 | 改动类型 | 状态 | 说明 |
|------|---------|------|------|
| `web-ui/src/downloads.css` | 修改 | ✅ 已完成 | Fixed 布局 + 课程头样式 + 领域名样式 |
| `web-ui/src/pages/Downloads.tsx` | 修改 | ✅ 已完成（场景逻辑）/ ⏳ 待开发（B6/B7/B8） | RightPanel 5 场景 + DomainInfoCard 改造 |
| `web-ui/src/stores/downloads.ts` | 修改 | ✅ 已完成 / ⏳ 待开发（B8 轮询） | sortBooks() 4 组排序 + 5s 轮询 |
| `web-ui/src/components/DownloadsTree.tsx` | 修改 | ⏳ 待开发（B1/B3/B4/B5） | 领域右键菜单重构 |
| `web-ui/src/api/tracker.ts` | 新增 | ⏳ 待开发（B2） | `exploreDomain()` + `confirmDomainName()` |
| `web-ui/src/stores/index.ts` | 修改 | ⏳ 待开发（B2） | `DomainSystem` 加 `explore_pending` |
| `backend/qed_engine/clients/tracker_client.py` | 新增 | ⏳ 待开发（B2） | `explore_domain()` + `confirm_domain_name()` |
| `backend/qed_engine/api/tracker.py` | 新增 | ⏳ 待开发（B2） | 2 个透传路由 |
| `web-ui/src/components/ExploreFlowModal.tsx` | 保留 | C5 | 仅用于课程探索（variant='course'） |

---

## 验证与验收

### §A 已完成项（已验证）

- [x] Fixed 布局：标题栏/筛选栏/左树固定，内容区独立滚动
- [x] 左树溢出独立滚动
- [x] 领域名称样式：大写+加粗+letter-spacing
- [x] 场景1 空态文案
- [x] 场景2 领域无课程提示
- [x] 场景3 展示顺序（领域→课程→教程→书籍）
- [x] 场景4 课程头置顶
- [x] 场景5 筛选隐藏（教程级+课程级）
- [x] 书籍排序：4 组 + 册号递增
- [x] 课程名居中 + 介绍左对齐
- [x] `npx tsc --noEmit` 零错
- [x] `npm test` 全绿
- [x] `npm run build` 成功

### §B 待开发项（待验收）

- [ ] B1：领域右键菜单 5 项，顺序与标签正确
- [ ] B2：领域探索（自动）→ POST /domains/{id}/explore → 8900 透传 → 8901
- [ ] B2：后端新增 explore_domain + confirm_domain_name 透传
- [ ] B2：exploration_stage 5 状态 + explore_pending 由 QED-Tracker 驱动
- [ ] B3：导入领域知识——文件选择器弹出，JSON 校验通过后调 API
- [ ] B4：修改领域——探索前仅描述，探索后可加学科知识+课程方向
- [ ] B5：新增课程——前置条件检查（需完成探索/导入），阶段/学术方向选项正确
- [ ] B6：DomainInfoCard 探索按钮直接触发（不走弹窗）
- [ ] B7：名称确认——DomainInfoCard 内嵌确认区域，读 explore_pending
- [ ] B7：名称确认→confirmDomainName→等待 exploration_stage 变化
- [ ] B8：探索状态追踪——5s 轮询 exploration_stage + explore_pending
- [ ] B8：失败重试——explore_pending.kind='failed' 时显示错误+重试按钮
- [ ] `npx tsc --noEmit` 零错
- [ ] `npm test` 全绿
- [ ] `npm run build` 成功
- [ ] `pytest` 后端全绿
- [ ] 浏览器人工验收全流程

---

## 回滚

- §A 已完成部分无需回滚（已验证稳定）。
- §B 改动为纯前端展示层 + 探索触发逻辑，可按 Task 粒度 `git revert`。
- QED-Tracker 侧变更由对方仓库管理。

---

## 关闭与归档

- 关闭条件：§B 验收 checklist 全部通过 + 用户浏览器验收确认 + QED-Tracker 回执齐备。
- 归档判定：Merge 倾向——展示规范并入 `docs/design/downloads-manage-redesign.md`，计划壳归档 `docs/history/plans/2026-08/`，todo.md REQ-067 行关闭归档。
