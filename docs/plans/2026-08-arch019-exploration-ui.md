# 课程探索界面设计计划（ARCH-019·重点交付）

状态：In Progress
任务类型：B
最后更新：2026-08-23
关联 ADR：[ADR 0011](../adr/0011-pending-design-location.md)（本文档承载待评审设计）、[ADR 0008](../adr/0008-frontend-react-refactor.md)（前端架构）
关联设计：[course-acquisition-flow.md](../design/course-acquisition-flow.md)（五阶段流程，本设计更新其阶段 1）、
[frontend-architecture](../architecture/frontend-architecture.md)、exploration-api 计划（消费契约；已按 Delete 判定移除，事实见 [api-contracts](../architecture/api-contracts.md)）
关联 Tracker：docs/trackers/todo.md（主线 ARCH-019；本计划行 PLAN-020；支线 REQ-053、REQ-054）
归档判定：Delete 倾向（确定后界面契约并入 web-frontend.md / course-acquisition-flow.md，计划壳删除）

> 用户评审通过后转 In Progress。

## 目标与成功标准

为两层探索提供完整前端工作流：**发起探索**（下载管理页内置入口）→ **确认采纳**
（独立页面）→ **回到下载流程**。成功标准：课程层与全局层的探索发起、进行中、结果确认、
采纳、历史回看、离线降级全链路可在浏览器完成；上限规则（≤4、≥2 锁定）在界面与服务端双重
生效；vitest 覆盖核心交互。

## 范围与非目标

- 范围：入口按钮、参数 Modal、独立确认页（课程层 + 全局层两视图）、store 与 API 客户端、
  降级与测试。
- 非目标：LLM 探索逻辑本身（QED-Tracker 承接）；解析对照页改造；学习中心界面。

## 前置条件

exploration-api 计划契约冻结（已移除，事实见 [api-contracts](../architecture/api-contracts.md)）；QED-Tracker 端点就绪前
以 mock 数据开发界面（不阻塞并行）。

## 设计正文（评审确定后并入 web-frontend.md 与 course-acquisition-flow.md）

### 1. 入口（下载管理页内置，双入口）

```
┌─ 左树 ─────────────────────────────┐   ┌─ 页头工具栏 ────────────────────┐
│ ⚙ 高等数学 (13 门课程)              │   │ [⟳刷新] [⊕ 新建领域探索]         │ ← 领域层
│  ├─ 分析                           │   │ [🔍 探索教程]（选中课程时同色）    │ ← 课程层
│  │   ├─ 00 概率论…          [🔍]    │  ← 课程节点 hover 出现「探索教程」图标
│  │   ├─ 01 数学分析(2 教程) [🔒]    │     锁定态：Tooltip 说明原因（≥2 完成/已满 4）
```

- **课程层 🔍**（左树 hover 与右侧顶部按钮**双入口**，状态同色联动）→ **参数 Modal**
  （`ExploreLaunchModal`），三选一：
  `直接开始` ／ `粘贴参考文本`（textarea，作为选书偏好输入）／ `指定文本文档路径`
  （默认提示规范位置 `<数据根>/dataset/tmp/exploration/<课程名>探索.txt`；
  路径校验失败 400 提示）。底部「开始探索」→ 跳转确认页并自动开始。
- **领域层 ⊕ = 新建领域探索（2026-08-23 用户裁决读法 1）**→ 同款 Modal 变体：
  填写**新领域名** + 提供探索过程文档路径（如 `dataset/tmp/exploration/高等数学探索.txt`
  的 领域/范围/备注 式）→ 跳转确认页「领域探索」视图 → LLM 提议课程体系 →
  勾选应用后写入 **qed_domain + qed_course** 并提示刷新左树。

### 2. 独立确认页（新路由 `#/admin/downloads/explore`）

```
┌──────────────────────────────────────────────────────────────┐
│ 课程探索 · 01 数学分析                    [历史探索 ▾] [×关闭] │
├──────────────────────────────────────────────────────────────┤
│ 探索状态条：🔄 LLM 检索中… (任务 tk_xxx · 已运行 45s · 每 3s 轮询)│
├──────────────────────────────────────────────────────────────┤
│ 本次推荐 (3 套 · 上限余量 2)                    已勾选 1/2      │
│ ┌─☑─套A───────────────────────────────────────────────────┐  │
│ │ 教材：Principles of Mathematical Analysis (Rudin) 中译本  │  │
│ │ 习题集：配套习题集                        [版本徽标]       │  │
│ │ 简介摘要（展开全文）｜ 推荐理由：顶尖名校指定…             │  │
│ └───────────────────────────────────────────────────────────┘ │
│ ┌─☐─套B …─────────────────────────────────────────────────┐  │
│ ══ 待选区（本次未勾选，折叠；展开可改选）═══════════════════   │
│ [✔ 采纳所选(1)] [↻ 同参重探] [✖ 放弃本次]                      │
└──────────────────────────────────────────────────────────────┘
```

**状态机**：`launching → running(轮询) → ready → adopted | discarded | failed`；
ready 后展示推荐卡；adopted/discarded 后显示终态条并提供「返回下载管理（已筛该课程）」。

**关键交互规则**：

| 规则 | 行为 |
| --- | --- |
| 确认页编辑语义 | **仅勾选取舍，无内联编辑**（2026-08-23 用户裁决）——提议内容只读展示，修改诉求通过重新探索表达 |
| 勾选上限 | 可勾数 = 4 − 该课现有教程数（draft+confirmed+completed）；超选禁用复选框并提示 |
| 服务端锁定 | 已完成 ≥2 套或已有 4 教程时，探索端点 409——入口按钮置灰 + Tooltip；确认页对历史 ready 运行仍可查看但「采纳」置灰 |
| 待选持久化 | 未勾选推荐保留在探索记录（8901 DB）；「历史探索 ▾」可回看任意运行，ready 态可对待选补采纳（服务端仍校验 ≤4） |
| 放弃本次 | POST discard → 终态 discarded，不产生任何数据行 |
| 失败重试 | failed 显示错误原因 + 「重试」按钮（同参数重新创建运行） |

### 3. 领域探索视图（同页 Tab 切换：「领域探索」，⊕ 入口跳转至此）

- 展示 LLM 为**新建领域**提议的课程体系：顶部领域画像卡（名称/简介/方向划分）+
  **课程清单 diff 卡片列表**（每行 = `{动作: 新增课程, 对象, 变更内容摘要}`，带复选框）；
- **仅勾选取舍、无内联编辑**；「应用所选变更」→ 一次性写 qed_domain + qed_course
  （8901 执行）；部分冲突时展示 conflicts 清单（拒绝原因），已成功条目不回滚；
- 应用后提示跳转下载管理页刷新左树，新领域与课程即刻可见。

### 3.1 探索状态颜色规则（2026-08-23 用户裁决）

左树课程节点着色 + 选中课程时右侧顶部按钮同色显示：

| 颜色 | 状态 | 判定 |
| --- | --- | --- |
| ⚪ 灰 | 未探索 | 该课教程数 = 0 |
| 🟡 黄 | 探索不足 | 有教程但完成审核 <2 套 |
| 🟢 绿 | 已达标 | 完成审核 ≥2 套 |
| 🔒 锁标（叠加） | 已锁定 | 教程总数 = 4 或达标后停止自动探索 |

- 状态由 store selector 从下载树数据计算（教程计数 + 终态完成数），无需额外请求。

### 4. 技术改动清单

| 层 | 改动 |
| --- | --- |
| 路由 | `App.tsx` 新增 `/admin/downloads/explore`（AdminLayout 子路由） |
| 页面 | 新建 `pages/Explore.tsx`（课程层/领域探索两视图 + 状态机轮询） |
| 组件 | 新建 `components/ExploreLaunchModal.tsx`（课程层三模式 + 领域层变体：领域名+文档路径）、`ProposalCard.tsx`、`ChangeCard.tsx`（领域 diff 行）；`DownloadsTree.tsx` 课程节点 hover 按钮 + 锁定态 + **状态着色**；Downloads 页头补 ⊕ 与选中课程探索按钮（同色联动） |
| store | 新建 `stores/explore.ts`（runs 列表、当前 run、轮询定时器管理、上限计算 selector）；`stores/downloads.ts` 补课程教程计数暴露 + **每课探索状态 selector（驱动颜色）** |
| API 客户端 | `api/tracker.ts` 补 explore 五函数 + curriculum 两函数（见 API 计划 §端点） |
| 使用手册 | HELP_SECTIONS 增加「课程探索」节（三模式说明 + 上限与颜色规则 + 探索文档规范位置 `<数据根>/dataset/tmp/exploration/`） |

> 范围注记：手工加课服务端能力已冻结于 API 契约 §8（POST /domains/{id}/courses），
> UI 入口本轮不加，后续按需补充。

### 5. 降级与容错（独立性铁律）

- 8901 不可达：确认页顶部错误横幅 + 手动重试（沿用 loadTree 加固模式，杜绝无限转圈）；
- 轮询连续失败 3 次转 failed 态（保留 run_id 供恢复查询）；
- 探索功能完全依赖后端时，下载管理页其余功能不受影响（按钮级隔离）。

## 工作项

1. store/API 客户端层（explore slice + tracker 函数）+ 单测。
2. ExploreLaunchModal + 入口按钮（含锁定态）。
3. Explore 页面课程层视图（状态机/推荐卡/采纳/待选/历史）。
4. 全局层 diff 视图 + 应用变更流。
5. 使用手册节 + 契约测试同步。
6. mock 数据先行自测，端点就绪后联调（REQ-054 透传 + QED-Tracker 回执）。

## 验证与验收

- vitest：Explore 页各状态渲染、勾选上限约束、锁定 Tooltip、discard 流、离线横幅；
- tsc 零错 + build 成功 + 契约测试全绿；
- 人工验收：真实 8901 下完成一次「探索 → 确认页采纳 → 回到下载管理看到新 draft 教程」闭环。

## 回滚

纯前端增量改动（新文件为主），回滚 = 移除新增组件/路由/store 分支；无数据迁移。

## 交互改版 v2（2026-08-24 REQ-059，用户批准并已实施）

真实联调验收暴露的交互问题（左树仍读冻结目录、确认页白屏无兜底、手工建域误绑探索流）
经两轮评审定稿改版，本节为**当前生效形态**（上方 §1~§3 的双入口/独立确认页设计被取代）：

### 改版裁决要点

1. **左树真实数据源**：领域 → 课程 → 教程三层，来自 `GET /courses` 领域课程体系；
   math-qe 冻结目录退出下载管理 UI（学习中心暂不动）。
2. **右键菜单体系**：领域 = 新增课程｜修改领域｜探索课程体系（重探入口）｜删除；
   课程 = 修改课程｜探索教程｜删除；hover 🔍 取消，色点三态保留；删除 409 保护提示。
3. **添加领域解耦**：树底「＋添加领域」= 纯手工表单（POST /domains），与探索流无关；
   创建后经右面板「探索课程体系」发起 LLM 提议。
4. **全弹窗流**：ExploreFlowModal 取代「发起 Modal + 独立确认页」双跳转——
   发起（三模式）→ 轮询 → 结果清单（采纳/放弃/应用所选）均在弹窗内完成；
   关闭不打断后台轮询，同目标重开直接进结果视图。
5. **右侧领域信息卡 + 探索按钮状态机**：idle 可点「探索」/ running 置灰 /
   ready「查看探索结果」可点 / applied 终态置灰（会话内状态，服务端幂等启动兜底刷新丢失）。
6. **双层 ErrorBoundary**：根组件 + 弹窗内容级，渲染异常不再整页白屏。
7. **降级**：GET /courses 失败 → 树区「课程体系数据不可达」空态；§8 手工维护端点
   上游 404 → 操作报错并提示「REQ-059 承接中」，不阻塞浏览与探索。

### 实施记录

- 前端：stores/downloads v2、DownloadsTree v2、ExploreFlowModal（新）、ErrorBoundary（新）、
  删除 pages/Explore(.test).tsx 与 ExploreLaunchModal(.test).tsx 及其路由；HELP 重写为
  「领域与课程探索」节。门禁：vitest 21 文件 148 passed / tsc 零错 / build 成功。
- 后端透传：tracker_client +6 方法、api/tracker +6 路由（POST|DELETE /domains(+/{id})、
  GET /courses、POST /domains/{id}/courses、PATCH/DELETE /courses）；**§8 未上线降级归一**：
  上游默认形态 404/405 → 结构化 404 UPSTREAM_NOT_IMPLEMENTED（含修复 POST /domains
  漏注册致「添加领域」405 的缺陷，2026-08-24 用户验收反馈）；pytest 340 passed；
  live 冒烟：GET /courses `[]` 200、POST /domains 与 PATCH /courses/x 均得结构化 404；
  领域表单去 stages（用户裁决：只采集名称+描述，阶段随探索产生）。
- **curriculum 字段名对齐修复（2026-08-24 用户验收反馈）**：前端 `CurriculumRun` 误用
  `changes`/`applied_change_ids`，服务端实为 `proposals`/`adopted_proposal_ids`——类型断言
  掩盖不匹配，探索弹窗永远空列表、应用禁用。修复 stores/index.ts + explore.ts +
  ExploreFlowModal.tsx + explore.mock.ts 及两处测试；vitest 21 文件 149 passed +
  tsc 零错 + build 成功；真实冒烟：domain_name=数学 探索 ready（5 提议）→ selected 全选
  apply 落库（数学 + 高级数学分析/线性代数/概率论与数理统计/抽象代数）。
- **第二轮验收修复（2026-08-24 用户反馈四项）**：① 右键课程双菜单——课程节点嵌套在领域
  Dropdown 内，contextmenu 冒泡致两菜单同弹；CourseBranch/TutorialLeaf 根部阻断冒泡
  （vitest 回归断言）。② 探索无响应——用户浏览器残留 `qed-explore-mock=1`，探索走内存
  mock 零网络请求（8900 日志佐证）；ExploreFlowModal 顶部加 mock 启用警示横幅。
  ③ §8 手工维护端点——对方提交 9b4fda3 已含五端点但运行实例未重启；重启 8901 后
  openapi 确认全量上线（domains GET/POST/PATCH/DELETE、courses POST/PATCH/DELETE），
  添加领域/删除即刻可用。④ 「高级数学分析」命名——LLM 自创课名，经正规 API 流程重建为
  数学分析（POST 新课 → PATCH 迁移前置 → DELETE 旧课）；prompt 命名约束登记对方
  QED-043。vitest 21 文件 150 passed / contract 50 passed / build 成功。
  上游缺陷两项已登记对方 QED-043：GET /courses/{domain_id} 被 405 遮蔽；
  PATCH /courses prerequisites 不生效（本次悬空引用经 SQL 修正）。
- 跨项目：REQ-059 已登记 QED-Tracker（adoption「REQ-059 增补」章 + api-design §11 +
  QED-041 注记，对方 test_documentation 8 passed），待对方承接回执后适配 skipped 展示。

## 关闭与归档

- 关闭条件：工作项 1~6 完成、门禁全绿、用户浏览器验收。
- 确定后：§设计正文并入 web-frontend.md（界面契约）与 course-acquisition-flow.md（阶段 1
  更新），本计划壳删除（ADR 0011 流转规则）。
