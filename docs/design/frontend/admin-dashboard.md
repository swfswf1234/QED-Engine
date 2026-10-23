# 管理后台仪表盘设计（admin-dashboard）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-24
确认状态：已确认
关联代码：`web-ui/src/pages/Dashboard.tsx`、`web-ui/src/stores/dashboard.ts`、`web-ui/src/components/dashboard/LocalModelStatus.tsx`、`web-ui/src/api/axiom.ts`、`web-ui/src/stores/runtime.ts`（后端透传端点见 [api-contracts](../../architecture/api-contracts.md)，不重复登记）
关联测试：`web-ui/src/pages/Dashboard.test.tsx`、`web-ui/src/stores/dashboard.aggregate.test.ts`
关联 ADR：[ADR 0002](../../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0007](../../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0017](../../adr/0017-design-doc-structure-contract.md)（本文档结构契约与事实源唯一铁律）
关联设计：[前端架构](../../architecture/frontend-architecture.md)、[数据库总纲](../../architecture/database-design.md)、[downloads-flow.md](../downloads-flow.md)（探索状态机口径）、[downloads-ui.md](downloads-ui.md)（筛选档状态口径）、[admin-console.md](admin-console.md)（控制台，服务数据共享方）
关联计划：[REQ-033 承载壳（已归档）](../../history/plans/2026-09/2026-09-24-req033-admin-display-optimization.md)；
界面演进经 git 历史与 `history/plans/` 各计划壳追溯

## 1. 定位与目标

本文档是管理后台**仪表盘页**（`#/admin/dashboard`）的 UI 设计事实源：**只读数据看板**，
自上而下固定三大块——

| 块 | 名称 | 备注小字（extra） |
| --- | --- | --- |
| 块一（一张卡上下两段） | 服务详情（含「本地模型列表」固定分节） | 「QED服务及本地模型启动详情」（用户原文 carve-out，全页唯一保留的 extra） |
| 块二 | 文档下载情况 | 无（不写任何说明小字） |
| 块三 | 文档解析情况 | 无（不写任何说明小字） |

- **标题层级（全局）**：三块卡标题（含块二大卡标题）一律 `Typography.Title level={4}`
  （与控制台「服务管理」同字体大小），不用 antd Card 默认 16px 卡头标题。
- **目标**：一屏只读回答「服务状态、下载主线水位、解析水位」三个问题，任一数据域
  不可达时按块独立降级；
- **成功标准**：三块结构完整、判定口径与 §4/§5 表一一对应；块一与控制台共享 runtime
  store 零额外请求；页面无操作按钮（一切操作归控制台）；
- 验收门禁：`cd web-ui && npm test`、`npx tsc --noEmit`、`npm run build` 通过，
  8903 打开 `#/admin/dashboard` 人工核验。

## 2. 范围与非目标

**范围**：仪表盘页面的三块结构、状态判定口径、Store 与聚合函数、降级矩阵。
**非目标**：不涉及其他管理页面；不承载服务启停操作（归控制台）。

本档**不**维护以下内容，逐条给出唯一事实源指针（[ADR 0017](../../adr/0017-design-doc-structure-contract.md) 事实源唯一铁律：UI 文档只写消费语义，不复制字段级契约）：

| 内容 | 唯一事实源 |
| --- | --- |
| `/knowledge`、`/knowledge/{id}`、`/courses`、`/books`、`/parse-jobs` 端点路径与响应形状 | [api-contracts.md](../../architecture/api-contracts.md)（数据域透传） |
| `af_books` 列语义（`parse_status` 进度 / `last_parse_result` 结局 / `active_job_id` 生效版本）与任务状态机 | Axiom-Flow 仓库 `docs/adr/0007-parse-status-semantics.md` 与 `docs/architecture/database-design.md`（本档 §5 只写 UI 消费口径） |
| `qt_*` / `qed_*` 表结构与记录字段定义 | QED-Tracker `docs/architecture/database-private-tables.md` / `database-shared-tables.md`；根侧登记见 [database-design.md](../../architecture/database-design.md) |
| 领域/课程探索状态机口径 | [downloads-flow.md](../downloads-flow.md) |
| 下载管理页展示层级与筛选档 | [downloads-ui.md](downloads-ui.md) |
| 服务启停/模型操作与显存/槽位展示 | [admin-console.md](admin-console.md) |

## 3. 块一：服务详情（一张卡，含「本地模型列表」分节）

块一为**一张卡**、上下两段。卡标题「服务详情」，extra「QED服务及本地模型启动详情」
（用户原文 carve-out，见 §1 表）。

1. **服务徽章段**（上，恒在）：4 服务状态徽章（只读），数据源
   `useRuntimeStore.services`（AdminLayout mount 预取，仪表盘零额外请求），
   `withWebServiceFallback()` 保证 8903 自身恒显示；组件 `StatusBadge`
   （绿=online，红=offline，黄=starting/stopping）。
2. **「本地模型列表」分节**（下，恒在）：分节标题「本地模型列表」**居中**；
   文字模型、图像模型**左右两栏**（文字在左、图像在右），两栏恒在
   （取消旧单活守卫「只挑在跑槽位显示」与全 api 整卡隐藏，`LocalModelStatus`
   为常驻分节）。每栏内顺序固定：`槽位名 → 模型名称 → 状态徽章`，三列**固定列宽、
   内容增减不移动**（模型名列定宽 ellipsis 截断）。模型名 `slot.model`
   **非空即显示**（不限已加载态）。

**三态判据**（degraded 并入未加载、全 api 槽位恒显未加载）：

| 状态 | 颜色 | 判据 |
| --- | --- | --- |
| 已加载 | 绿（success） | `ready === true`（绑定模型探针就绪） |
| 未加载 | 灰（default） | `source === 'api'`（云端 API，无本地模型，tooltip 说明），或 `health_state ∈ {ready, degraded}` 且 `ready === false`（LM Studio 服务在跑、模型未起，或 GPU 降级） |
| 未启动 | 红（error） | `health_state === down`，或无观测且无绑定 |

栏内不显示 channel 标签（LM Studio/Docker/…）、「翻转于」时刻、显存读数、启动时间；
`health_reason` 与云端来源说明只进徽章 tooltip。

**不展示水位行**：MySQL 可达性、显存/利用率、当前在跑、解析服务水位归控制台
（[admin-console.md](admin-console.md)），仪表盘不重复。

## 4. 块二：文档下载情况

四统计数字 + **领域按钮行**（`Segmented` 退役；每按钮＝领域名 + 领域四态
小圆点，**超过 5 个领域折叠为前 5 + 「更多▾」下拉**，点选即切换领域、选中态高亮；
选项来自 `/courses` 领域列表，默认第一个，所选领域数据消失时回落第一个）+
**单领域一张大卡**（标题领域名 + 四态 Tag → 课程逐行四段格子进度 → 卡尾一行颜色图例）。

### 4.1 统计数字（全领域口径）

| 指标 | 计算逻辑 |
| --- | --- |
| 领域数 | 全部领域总数（全量口径，含未开始领域） |
| 课程数 | 所有领域下课程总数 |
| 书目数 | 所有教程详情中的 `books[]` 总数（按 `book_id` 去重） |
| 验收通过 | `holding === 'owned'` 的书籍数（按 `book_id` 去重） |

### 4.2 领域四态（按钮小圆点与大卡标题 Tag 同一口径）

由领域下课程与书籍状态聚合派生（`buildDomainDownloadState`，替代旧
`buildDomainStageLabel` 探索三态）：

| 状态 | 判据（按序取首个命中） |
| --- | --- |
| 未开始（新建） | 无任何课程进入探索 |
| 探索中 | 有课程进入探索，但还没有书开始下载 |
| 下载中 | 任一课程有书开始下载（`status ∈ {decided, downloading, downloaded, verified, failed}`），且未全部拿齐 |
| 下载完成 | 已有书开始下载，且全部课程均已探索完成、所有已决定书 `status ∈ {downloaded, verified}`（拿齐） |

### 4.3 领域大卡·课程段（逐课程一行，四段行）

每行只有四段：`课程名（ellipsis）｜ 课程状态 Tag ｜ 教程数（如有）｜ 进度格子`，其他不写。

**课程状态**（`courseProgressState`，按序取首个命中；行内彩色堆叠进度条与计数文本退役）：

| 状态 | 判据 |
| --- | --- |
| 未探索 | `exploration_stage` 为空或「未开始」 |
| 完成 | 探索已完成 且 课程可画格书目非空、全部 `verified` |
| 下载中 | 存在已开始下载的书（`status ∈ {decided, downloading, downloaded, verified, failed}`） |
| 探索中 | 其余 |

**教程数**＝`/knowledge` 中该课程 `kind === 'tutorial'` 记录数，显示「教程×N」，N=0 不显示。

**进度格子**＝每本书一个小方格（11 本就 11 格；`book_id` 去重、首现序），颜色按四桶
（`bookDownloadBucket`；`parallel`/`retired` 不画格），悬停 tooltip 显示书名；
未探索行无格子：

| 桶 | 书 status | 格子颜色 |
| --- | --- | --- |
| 未开始下载 | candidate | 灰 |
| 下载中（含失败） | decided / downloading / failed | 橙 |
| 下载完成 | downloaded（拿到未验收） | 蓝 |
| 验证完成 | verified | 绿 |

书籍归属链路不变：`books[] ← knowledge.course_id → courseSystem 反查 domain`。

### 4.4 领域大卡·图例行

卡底**一行四色图例恒在**：`■未开始下载 ■下载中(含失败) ■下载完成 ■验证完成`
（颜色与 §4.3 四桶一致），不写其他文字。退役：四桶计数文本（「未n·下n·完n·验n」式）、
「领域书籍 态×N」汇总行、课程彩色堆叠进度条。

## 5. 块三：文档解析情况

### 5.1 判定基座与 KPI

判定基座为 **`/books`（af_books 书目字段）**，`/parse-jobs` 仅用于「失败 N 页」
辅助展示（每书取 `created_at` 最新的 job）。书目字段语义与状态机以 Axiom-Flow
ADR 0007 为事实源，本档只写 UI 消费口径：**「已完成」＝存在生效版本且该版本覆盖
全书**（`pages_done` 描述的正是 `active_job_id` 所指版本），页数分母恒为全书
`page_count`，不以单次 job 的 progress 判书级结局。

KPI 四项（此序）：课程数（分组数）/ 书目数 / 解析中 / 已完成。卡内无任何说明性小字。

### 5.2 书级状态判定表（`parseBookLabel`，按序取首个命中）

| 序 | 状态 | 判据 |
| --- | --- | --- |
| 1 | 解析中 | `parse_status === 'parsing'`（进度态，优先于任何结局残留） |
| 2 | 已完成 | `active_job_id` 非空 且 `pages_done ≥ page_count`（生效版本覆盖全书；`page_count` 未知时视为覆盖） |
| 3 | 部分生效 | `active_job_id` 非空 但 `pages_done < page_count`（生效版本只覆盖部分页，如局部重解析版本） |
| 4 | 未生效 | 无生效版本 且 `pages_done ≥ page_count > 0` |
| 5 | partial / 失败 / 中断 | 无生效版本 且 `last_parse_result ∈ {partial, failed, interrupted}` |
| 6 | 未入库 | `ingest_status !== 'ingested'` 且 `page_count = 0` |
| 7 | 未开始 | 其余（已入库、从未有任务结局） |

生效版本在手时书级结局只按版本页覆盖判（序 2/3），不受后续失败任务残留的
`last_parse_result` 影响——`pages_done` 描述的是 `active_job_id` 所指版本
（Axiom-Flow database-design 口径）。

### 5.3 分组与分页

- 按 `course_id` 分组（组标题取 `course_name`，缺失归「未归属课程」），组序 =
  书目首次出现序；**有在飞书目的组置顶浮起**（组标题带 ● 标记）；
- 每页固定 **3 个课程组**，超出走 `Pagination`；
- 每书一行：书名（ellipsis）+ 状态 Tag + 三段堆叠条（done 蓝 / failed 红 / 剩余灰，
  分母 `page_count`）+ 「done/total 页 · 失败 N」辅助文本。

## 6. Store、聚合与数据流

### 6.1 useDashboardStore（Zustand）

```
State:
  knowledge / details / courseSystem      // 块二数据源（/knowledge ×N + /courses）
  parseBooks / parseJobs                  // 块三数据源（/books + /parse-jobs）
  loading / error / dataError / courseError / parseError
Actions:
  fetchAll()    // 块二三线并行独立拉取；tracker 线 = knowledge + 逐行 getKnowledge
                // (Promise.allSettled) + courses
  fetchParse()  // 仅重拉 /books + /parse-jobs；失败保留旧值只置 parseError
```

30s 保鲜轮询：tick 调 `fetchSlots + fetchParse`（块三在飞与块一状况保鲜；块二不轮询；
本页无 GPU 数据消费者，`fetchGpu` 不在轮询内），`document.hidden` 时跳过。

### 6.2 纯聚合函数（dashboard.ts，独立可测）

| 函数 | 输入 | 用途 |
| --- | --- | --- |
| `buildDashboardStats` | courseSystem + details | §4.1 四统计数字 |
| `buildDomainDownloadDetail` | courseSystem + details + domainId + knowledge | §4.3/§4.4 领域大卡（四态 + 课程四段行格子 + 图例） |
| `buildDomainDownloadState` | 领域课程/书籍态 | §4.2 领域四态（按钮圆点与标题 Tag） |
| `courseProgressState` | 单课程 + 其书籍 | §4.3 课程状态词（未探索/探索中/下载中/完成） |
| `bookDownloadBucket` | 单本书 | §4.3 格子四桶着色（`courseDownloadBuckets` 计数桶退役） |
| `parseBookLabel` | 单条 af_books 记录 | §5.2 书级判定 |
| `buildParseGroups` | books + jobs | §5.1/§5.3 分组、KPI、失败页装饰 |

退役聚合名（勿复活）：`buildDomainStageLabel`、`bookDownloadSlices`、`courseProgressRow`、
`buildCourseProgress`、`buildDomainProgress`、
`buildBookDownloadProgress`（三行饼图）、`buildDomainDownloadBars`、
`buildParseProgress`（一版双条/按最新 job 判定）；`courseDownloadBuckets`/`DownloadSlice`/
`summarySlices`/`bucketCounts` 计数文本（四改桶计数形态，五改格子替代）。

### 6.3 关键组件文件

| 文件 | 职责 |
| --- | --- |
| `pages/Dashboard.tsx` | 三块布局（卡标题 Title level 4）、块二领域按钮（>5 更多▾折叠）与大卡（格子+图例）、块三分组分页与进度条 |
| `stores/dashboard.ts` | Zustand store + §6.2 聚合函数 |
| `stores/runtime.ts` | 共享 runtime store（块一 services 只读消费） |
| `components/dashboard/LocalModelStatus.tsx` | 块一「本地模型列表」常驻分节（居中标题、文字/图像左右两栏恒在、槽位名→模型名→三态徽章固定列宽） |
| `api/axiom.ts` | `/books`、`/parse-jobs` 客户端（BookMeta 消费 af_books 字段） |
| `api/tracker.ts` | `/knowledge`、`/courses` 客户端 |

本页面**不**使用 ECharts（图表形态已退役，`components/EChart.tsx` 服务其他页面）。

## 7. 状态与降级矩阵

| 异常场景 | 展示行为 |
| --- | --- |
| 8900 不可达（offline） | 整体错误横幅「仪表盘数据获取失败」 |
| 8901 不可达（/knowledge 503） | 块二降级提示「QED-Tracker 数据不可达」；块一块三照常 |
| /courses 不可达 | 块二降级提示「课程体系不可达」 |
| 8902 不可达（/books、/parse-jobs） | 块三独立降级横幅「文档解析数据不可达」；块一块二照常；块一徽章行按 services 显示 axiom 离线 |
| 单教程详情失败 | `allSettled` 静默跳过（部分降级） |
| 空数据 | 各块短句提示，不占位 |

## 8. 已知约束与维护规则

1. **只读铁律**：仪表盘无任何操作按钮，一切操作归控制台；
2. **独立性铁律**：8901/8902 离线只降级对应块，不阻塞其他块；8900 离线才有整体横幅；
3. **零额外请求**：块一数据全部来自共享 runtime store（AdminLayout/控制台轮询已供），
   仪表盘自身不发 `/services`；
4. **完成语义**：块三「已完成」= 生效版本覆盖全书（ADR 0007 + `pages_done` 版本口径），
   生效版本仅覆盖部分页显示「部分生效」，页齐未激活显示「未生效」而非「已完成」，
   不得用单次 job 状态冒充书级结局；
5. **备注文案**：全页仅块一保留 extra「QED服务及本地模型启动详情」（用户原文
   carve-out）；块二/块三无 extra、卡内不写任何说明性小字，判定细节只认本档；
6. **维护规则**：上游字段口径变化（Tracker 表重构、Axiom-Flow 状态机演进）先改各自
   事实源文档，本档 §4/§5 判定表回核 UI 消费口径是否仍成立。
