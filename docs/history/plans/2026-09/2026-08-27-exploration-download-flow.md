# 文档探索+下载全流程计划（ARCH-019·REQ-064 配套）

状态：Achieved
任务类型：B
最后更新：2026-09-01
关联 ADR：[ADR 0011](../../adr/v0.1/0011-pending-design-location.md)（待评审流程设计随计划承载，确定后迁 design/ 固定文档）
关联设计：[downloads-flow.md](../../../design/downloads-flow.md)（五阶段流程已并入 REQ-070）、、QED-Tracker shared-tables.md（Accepted）、QED-Tracker 2026-08-api-design.md（Draft）、[api-contracts.md](../../../architecture/api-contracts.md)、[database-design.md](../../../architecture/database-design.md)
关联 Tracker：docs/trackers/todo.md（本计划行 PLAN-022；REQ-064、REQ-065、ARCH-019）
归档判定：Merge 倾向（开发完成后流程事实并入 docs/design/ 固定文档，计划壳归档 history/plans/）

> **挂靠说明（2026-09-11 修订）**：本文档为技术架构参考；PLAN-023 已 Superseded 并归档
> （[history/plans/2026-08](../../plans/2026-08/2026-08-27-download-ux-flow.md)），
> 状态机与交互事实源以 [design/downloads-flow.md](../../../design/downloads-flow.md) /
> [downloads-ui.md](../../../design/downloads-ui.md) 为准；本文档保留三端架构图、数据访问双链路、降级策略等技术事实。
>
> **口径说明**：本文档 exploration_stage 4 态模型、域探索弹窗流、8900 包装异步会话等内容已过时，
> 现行口径为：领域 6 态 / 课程 5 态、无弹窗直触（REQ-067 §B2）、8900 写点驱动 + 8901 原生任务链。
> 下方正文保留原始记录供架构参考。

> **2026-08-31 架构参考说明**：本文档保留为架构参考，核心内容：
> - 三端架构图（§三端架构）—— 唯一事实源
> - 数据访问双链路（D1-D4）+ 写权限矩阵（D2）—— 8900/8901 交互规范
> - 状态机定义（exploration_stage 4态 / 教程 / 书籍）—— 数据层规范（**注意**：4 态已被领域 6 态/课程 5 态取代，见 design/downloads-flow.md §2）
> - 降级策略（§降级策略）—— 运维参考
> - 探索流程时序（§探索流程）—— 架构参考（**注意**：域探索弹窗流已被无弹窗直触取代）
>
> §B（8900 侧改造）和 §F（前端侧改造）已被 [REQ-067](../../plans/2026-08/2026-08-29-req067-downloads-optimization.md) 吸收：
> - B1/B2 旧端点清理 + 新端点 → 已落地（explore/confirm-name/import 路由已实现）
> - B3 探索会话端点 → REQ-067 B2（REST 驱动，QED-Tracker 接管）
> - B4 共享表直读写 → REQ-067 B8（exploration_stage 5状态模型）
> - B5 api-contracts 更新 → 随 REQ-067 §C 执行
> - F1-F5 前端改造 → REQ-067 §B 全部吸收
>
> §C（核心状态机）中 exploration_stage 4 态模型已被取代（领域 6 态 / 课程 5 态），以 design/downloads-flow.md §2 为准。

> 2026-08-27 重写：对齐 REQ-064 共享表新架构，旧 explore-runs 轮询架构已废弃。
> 用户操作级流程规范曾由 PLAN-023 承载，该计划已 Superseded 归档；现行规范见
> [design/downloads-flow.md](../../../design/downloads-flow.md) / [downloads-ui.md](../../../design/downloads-ui.md)。

## 目标与成功标准

整合现有分散文档，提供"文档探索+下载"完整流程视图，为后续代码改造提供唯一流程依据。

成功标准：

- 前端/8900/8901 三端在新架构下的职责与数据流有唯一事实描述（本文档）；
- 三项用户裁决（D1 双链路 / D2 直写范围 / D3 探索会话模式）落档并可追溯；
- 8900 侧与前端侧改造清单落到端点/函数级，可直接转实现计划；
- 联调验收以本文档状态机与流程时序为对照基准。

## 范围与非目标

- **范围**：探索流程（领域探索、课程层探索）、下载流程（教程状态机、书籍状态机）、三端交互与降级。
- **非目标**：文档解析（PDF解析/OCR/质量审阅，后续单独成文）；API 五要素细节（见 QED-Tracker api-design 与 api-contracts）；数据库 DDL（见 shared-tables.md 与 database-design.md）。

## 前置条件

- QED-Tracker migration 0011/0012/0013 已落地（2026-08-27，共享表扩展 + qt_explore_runs/qt_prompt_runs 删除）；
- REQ-035（8900 数据域适配 0006 契约）前置已解除；
- 课程层探索端点（REQ-065）待 QED-Tracker 承接——课程层探索联调以该端点回执为前置，其余工作项不阻塞。

## 关键裁决（2026-08-27 用户拍板）

| # | 裁决 | 内容 |
|---|---|---|
| D1 | 数据访问双链路 | 共享表以 8900 直读为主；子项目在线时也可经 8901 API 获取。两个链路都打通，先默认直读 |
| D2 | 8900 直写范围 | 子服务离线时 8900 可直写：领域/课程**维护字段**（name 除外——创建后不可改/description/stage/sort_order/stages/aliases）+ **exploration_stage 状态流转**；**探索产物**（level/scope/classic_tracks/path_results）只归 QED-Tracker 写 |
| D3 | 探索执行模式 | 8900 包装异步 + 前端轮询：8900 收到探索请求后开后台会话执行，前端每 3~5s 轮询 8900 查进度；不依赖 8901 任务队列；8901 离线时同样可用（8900 直调 LLM 网关 + 直读写共享表） |
| D4 | 课程层探索 | 确认为真实需求（ARCH-019 主线找书入口）；端点缺口已登记跨项目请求 REQ-065，由 QED-Tracker 暴露已有 tutorials@v1 管线 |

## 三端架构

### 架构图

```
┌────────────────────────────────────────────────────────────────────┐
│  8903 前端（web-ui/ React + Zustand）                                │
│  唯一出口：fetch() → 8900（ADR 0007），不直连 8901/8902               │
└────────────────────────┬───────────────────────────────────────────┘
                         │ HTTP（/api/v1）
                         ▼
┌────────────────────────────────────────────────────────────────────┐
│  8900 后端（FastAPI，三域路由）                                       │
│  ┌──────────────┐ ┌───────────────────┐ ┌──────────────────┐       │
│  │ 控制域        │ │ 数据域·Tracker     │ │ 数据域·Axiom      │       │
│  │ control.py   │ │ tracker.py        │ │ axiom.py         │       │
│  └──────────────┘ └───────┬───────────┘ └────────┬─────────┘       │
│                           │ httpx（API 链路）      │ httpx           │
│            ┌──────────────┘                      │                 │
│            │ MySQL 直连（共享表直读/直写链路，默认）   │                 │
└────────────┼─────────────────────────────────────┼─────────────────┘
             │                                     │
             │            ┌────────────────────────┼──────────────┐
             │            ▼                        ▼              │
             │  ┌────────────────────┐   ┌────────────────────┐   │
             │  │ 8901 QED-Tracker   │   │ 8902 Axiom-Flow    │   │
             │  │ 领域/课程探索管线    │   │ PDF解析/OCR/审阅    │   │
             │  │ 教程/书籍状态机    │   │ （本文档不涉及）     │   │
             │  └─────────┬──────────┘   └────────────────────┘   │
             │            │ MySQL                                  │
             ▼            ▼                                        │
   ┌──────────────────────────────────┐                             │
   │  qed 库（MySQL 8，共享实例）        │                             │
   │  qed_domain        共享·Tracker所有权（8900直读+限权直写）         │
   │  qed_course        共享·Tracker所有权（8900直读+限权直写）         │
   │  qed_llm_calls     共享·Engine所有权（三项目可写）                │
   │  qt_knowledge      Tracker 私有（仅经 8901 API）                │
   │  qt_books          Tracker 私有（仅经 8901 API）                │
   │  qt_sources        Tracker 私有（仅经 8901 API）                │
   │  af_books          Axiom 私有（仅经 8902 API）                  │
   └──────────────────────────────────┘                             │
```

### 数据访问双链路（裁决 D1）

| 数据 | 默认链路 | 备用链路 | 说明 |
|---|---|---|---|
| 共享表读 | 8900 直读 MySQL | 8901 API（GET /courses、/domains） | 子项目在线时可切换，前端无感 |
| 共享表维护字段写 | 8900 直写 MySQL | 8901 API（领域/课程管理端点） | 见写权限矩阵（D2） |
| 共享表探索产物写 | — | QED-Tracker 写（其管线执行时） | 8900 任何时候不写探索产物 |
| qt_* 专用表 | 8900 → 8901 API | 无 | 私有表永远走 API |
| af_* 专用表 | 8900 → 8902 API | 无 | 私有表永远走 API |
| LLM 调用 | 8900 LLM 网关（/llm/text 等）→ qed_llm_calls | 子项目 local 模式直连 | 三项目经 service 字段区分 |

### 写权限矩阵（裁决 D2，修订 shared-tables.md 待跨项目回执）

| 表 | 读 | 写（在线·API 链路） | 写（离线·直写降级） |
|---|---|---|---|
| qed_domain | 三项目 | QED-Tracker（领域管理端点+管线） | 8900 可直写：description/stages + exploration_stage；不可写：level/scope/classic_tracks/path_results |
| qed_course | 三项目 | QED-Tracker（课程管理端点+管线） | 8900 可直写：stage/sort_order/description/aliases + exploration_stage；不可写：track/related_targets |
| qed_llm_calls | 三项目 | 三项目可写（service 字段区分） | 同左（8900 建表维护） |
| qt_knowledge / qt_books / qt_sources | 经 8901 | QED-Tracker | 无离线降级——8901 离线时相关功能禁用 |
| af_books 等 af_* | 经 8902 | Axiom-Flow | 无离线降级 |

> **跨项目待办（X2）**：QED-Tracker `shared-tables.md` 当前规定 qed_domain/qed_course"其他项目只读"，与 D2 冲突。已并入 REQ-064 登记修订请求，待对方回执。

## 核心状态机

### exploration_stage（qed_domain / qed_course 共有列，探索流程主线）

```
未开始 ──→ 已生成 ──→ 探索中 ──→ 已完成
   │          │                        │
   │          └──（放弃/重探则回退）         └──（重探重新进入）
   └── 手动创建领域/课程时初始值
```

| 值 | 触发时机 | 说明 |
|---|---|---|
| 未开始 | 手动创建 | 初始状态；前端色点灰 |
| 已生成 | 探索管线产出待确认（dry-run 报告已返回 / tutorials@v1 完成） | 前端色点黄；等待用户勾选应用 |
| 探索中 | 正式探索会话启动（8900 异步会话执行中，D3） | 前端按钮置灰"探索进行中…" |
| 已完成 | 应用落库完成（领域=课程写入 qed_course；课程=教材采纳+验收完成） | 前端色点绿 |

### 教程状态机（qt_knowledge.status）

```
draft ──confirm──→ confirmed ──聚合触发──→ completed
  │                   │
  ├──reject──→ rejected（硬删+留痕）
  └──supersede──→ superseded（过时留痕）
```

- **confirm**：定稿决定引用（教材 textbook_ref / 习题集 exercise_ref）+ 简介；**确认即自动按决定引用生成候选书籍**（2026-08-25 用户裁决）。
- **completed**：聚合触发——该教程下所有书籍 verified 后自动完成。
- 兜底：确认时自动生成失败或旧数据引用后补，提供「按决定引用补建书籍」一键操作。

### 书籍状态机（qt_books.status）

```
candidate ──决定──→ decided ──开始下载──→ downloading ──┬─登记下载(人工)──→ downloaded ──验收──→ verified
                    │                    │              ├─complete(自动)──↗        │
                    │                    │              └─标记失败──→ failed ──重试──→ downloading
                    │                    └──否定──→ rejected（硬删+留痕）
                    ├──否定──→ rejected
                    └──过时──→ superseded（版本换代留痕）
```

| 状态 | 含义 | 前端徽标色 |
|---|---|---|
| candidate | 候选（确认教程时自动生成） | 默认 |
| decided | 已决定（纳入下载计划） | blue |
| downloading | 下载中 | orange |
| failed | 下载失败（可重试） | red |
| downloaded | 已下载（待验收） | cyan |
| verified | 已验收（终态，可同步 Axiom-Flow 解析） | green |
| rejected | 已否定（硬删+留痕，数据层隐藏） | — |
| superseded | 已过时（留痕，数据层隐藏） | — |

## 探索流程（新架构）

### 领域探索（课程体系探索，管线已实现）

**参与方**：前端 ExploreFlowModal → 8900（探索会话包装 + 直读写共享表 / 透传 8901）→ 8901 DomainPipeline（domain@v2 + courses@v4 + path@v4 三步管线）→ LLM 网关。

**时序**：

```
用户：右键领域/领域信息卡 → "探索课程体系" → 弹窗选模式（直接/参考文本/文档路径）→ 开始
  ↓
前端：POST /api/v1/explore-sessions（8900 新端点，见工作项清单）{target: domain, mode, ref_text|ref_doc_path}
  ↓
8900：创建探索会话（内存态），后台线程执行；立即返回 202 {session_id}
  ↓
8900 后台线程（每步落 qed_llm_calls，经 LLM 网关）：
  ① 名称校验步（domain@v2）：若 name_check.valid=false → 会话挂起「名称确认」
  ② courses@v4：课程发现（10~14 门）
  ③ path@v4：学习路径 DAG
  ↓
前端：每 3~5s GET /api/v1/explore-sessions/{session_id} 轮询
  ├─ 状态=waiting_name_confirm → 弹窗展示 name_check → 用户裁决保留原名/采纳建议名
  │    → POST /explore-sessions/{id}/confirm-name {name_override} → 管线以该名重跑贯穿
  ├─ 状态=running → 进度展示（已完成步数/当前步）
  └─ 状态=ready → 报告视图（领域信息/课程方向/课程清单/路径图）
  ↓
用户：勾选变更项 → "应用所选变更"
  ↓
前端：POST /explore-sessions/{id}/apply {selected}
  ↓
8900 应用链路（双链路，D1）：
  · 8901 在线 → 逐项调领域/课程管理端点（POST/PATCH/DELETE /domains、/courses）
  · 8901 离线 → 8900 直写共享表（仅维护字段；新增课程/领域走 INSERT）
  ↓
8900：更新 qed_domain.exploration_stage（未开始→已生成→[探索中]→已完成）
  ↓
前端：三态汇总展示（已应用/跳过·已存在/冲突·拒绝原因）→ fetchAll() 刷新左树
```

**失败与放弃**：

- 管线失败（LLM 超时/预算耗尽）→ 会话状态=failed + 错误信息 → 前端展示重试按钮（新会话重发）。
- 用户放弃 → DELETE /explore-sessions/{id}（或前端丢弃，会话超时自动清理）；共享表 exploration_stage 回退「未开始」。

**耗时参考**（qwen3.7-plus，实测）：domain 35s + courses 110s + path 78s ≈ 4 分钟；qwen-plus 基线约 70s。轮询模式（D3）因此必要——同步长请求在 60s 网关超时下不可行。

### 课程层探索（探索教程，端点待 QED-Tracker 补，裁决 D4）

**需求依据**：ARCH-019 主线核心链路「探索按钮 → LLM 检索最合适教程（教材+配套习题集，按版本偏好规范）→ 用户选择 → 进入下载流程」。QED-Tracker 已有 `course-explore/tutorials@v1` 模板与管线基础，仅缺 API 端点暴露。

**目标交互**（与领域探索对称）：

```
用户：右键课程 → "探索教程"（锁定条件：≥2 套已完成锁定 / ≥4 套上限锁定）→ 弹窗选模式 → 开始
  ↓
前端：POST /api/v1/explore-sessions {target: course, course_id, mode, ...} → 202 {session_id}
  ↓
8900 后台会话：调 8901 POST /courses/{id}/prompt-explores/dry-run（待对方实现，暴露 tutorials@v1）
  · 8901 离线 → 按登记的降级策略处理（端点补齐后定义，暂定禁用+提示）
  ↓
前端：轮询 → ready → 推荐卡列表（每卡 = 一套：教材 + 配套习题集 + 推荐理由）
  ↓
用户：勾选（受 ≤4 上限约束）→ "采纳所选"
  ↓
8900：调 8901 创建 draft 教程（qt_knowledge，含教材/习题集决定引用）
  · 私有表必须经 API——8901 离线时本步不可用，会话挂起等待
  ↓
8900：更新 qed_course.exploration_stage = 已生成
  ↓
前端：fetchAll() → 新 draft 教程出现在左树课程下
```

> **跨项目请求已登记（X1）**：REQ-065，QED-Tracker 新增 `POST /api/v1/courses/{course_id}/prompt-explores/dry-run`。联调前置该端点回执。

## 下载流程

### 端到端主链路

```
课程层探索采纳 → qt_knowledge (draft)
  ↓ 用户「确认」（定稿决定引用+简介，自动生成候选书籍）
qt_knowledge (confirmed) + qt_books (candidate) ×N
  ↓ 用户「决定」
qt_books (decided)
  ↓ 用户「开始下载」（QED-Tracker 自寻渠道；qt_sources 记录每次渠道尝试）
qt_books (downloading)
  ├─ 自动下载成功 → POST /books/{id}/complete（sha256 + relative_path 校验）
  ├─ 找不到渠道 → 列举渠道请求用户自下 → 用户「登记下载」（人工 PDF 路径校验）
  └─ 失败 → failed →「重试」
qt_books (downloaded)
  ↓ 用户「验收」（人工确认版本：书名/语言/版次/完整性）
qt_books (verified) ← 终态
  ↓ 该教程下全部书籍 verified
qt_knowledge (completed) ← 聚合触发
  ↓ 课程下 ≥2 套 completed
qed_course.exploration_stage = 已完成（一门课程收集闭环）
```

### 规则约束

- **套数规则**：每课程教程 ≤4（硬上限）、≥2 套 completed 即完成（锁定探索）。
- **验收留痕**：否定（reject）硬删+留痕；过时（supersede）版本换代留痕；两者需填原因。
- **渠道审计**：每次下载渠道尝试落 qt_sources（channel/page_url/download_url/ok）。

## 数据库表概览

### 共享表

**qed_domain（领域表，0011 已扩展）**

| 列 | 说明 |
|---|---|
| domain_id / name | PK（如 math）/ 显示名（创建后不可改） |
| description | 学科介绍（LLM 生成，人工审） |
| level / scope | 探索范围标签（本科-硕士）/ 学科知识（管线暂置空）——探索产物 |
| exploration_stage | 探索状态机（见上） |
| classic_tracks | JSON：课程方向 [{name,summary}] 0~4 项——探索产物 |
| stages | JSON：学习阶段顺序（["本科基础",…]）——维护字段 |
| path_results | JSON：学习流程（notes/edges/graph_td）——探索产物 |
| created_by / updated_by / created_at / updated_at | 审计 |

**qed_course（课程表，0012 已扩展）**

| 列 | 说明 |
|---|---|
| course_id / name | PK（如 01_math_analysis）/ 规范名（创建后不可改） |
| domain_id | FK → qed_domain |
| sort_order / stage | 学习顺序（DAG 拓扑序）/ 所属阶段（qed_domain.stages 之一） |
| aliases | JSON：别名列表——维护字段 |
| track / related_targets | 学术方向（管线输出）/ 已验收关联目标——探索产物 |
| description / exploration_stage | 课程介绍（原 note 改名）/ 探索状态机 |
| prerequisites | JSON：先修 course_id 数组 |

**qed_llm_calls（LLM 调用审计，8900 建表维护，三项目可写）**

| 关键列 | 说明 |
|---|---|
| service / mode / provider / model | 调用方（qed_engine/qed_tracker/axiom_flow）/ api·local / 厂商 / 模型 |
| prompt_template | 模板编号 `{task}/{step}@v{n}`（如 domain-explore/courses@v4） |
| task / step / review_status / review_note | 任务/步骤标识与审核态（REQ-060 扩展，控制台「模型调用记录」消费） |

### QED-Tracker 专用表

| 表 | 用途 | 关键列 |
|---|---|---|
| qt_knowledge | 教程（教程套） | knowledge_id, domain_id, course_id, kind, set_no, name, textbook_ref, exercise_ref, status |
| qt_books | 书籍（一册/一卷） | book_id, knowledge_id, kind, title, roles, status, sha256, relative_path, language, version |
| qt_sources | 渠道尝试 | source_id, book_id, channel, provider_id, page_url, download_url, ok, note |

> 0013 迁移已删除 qt_explore_runs + qt_prompt_runs——探索运行数据改由 exploration_stage（状态）+ qed_llm_calls（痕迹）替代。

### 关系

```
qed_domain (1) ──→ (N) qed_course (1) ──→ (N) qt_knowledge (1) ──→ (N) qt_books (1) ──→ (N) qt_sources
       ▲                    ▲                                          │
       └── exploration_stage │（探索状态直接存共享列）                      │ verified 后经 8900 sync
qed_llm_calls（探索痕迹，经 prompt_template/task/step 关联）                  ▼
                                                              af_books（解析侧，本文档不涉及）
```

## 工作项（断链现状与改造清单）

### 当前断链（2026-08-27 核实）

**时间线**（佐证返工合理性）：2026-08-24/25 根仓库冻结旧探索契约（REQ-055/056）→ QED-Tracker QED-040/041 按旧契约实现完成并冒烟通过 → 2026-08-26 对方 prompt-optimization 设计 Accepted（P1 独立并行不受旧契约约束）→ 2026-08-27 对方 migration 0013 删表 + 旧探索端点全部下线。即：**QED-Tracker 已自行推翻旧契约**，根仓库侧旧实现为随之产生的返工面。

| 端 | 现状 |
|---|---|
| 8901 | 旧探索端点已删除（/courses/{id}/explore、/explore-runs/*、/curriculum-explore、/curriculum-runs/* 全部 404）；只剩 POST /prompt-explores/dry-run（同步，领域管线三步一体） |
| 8900 tracker.py | 仍注册 7 个旧探索端点并透传 8901 → 调用必 404 |
| 前端 explore.ts / ExploreFlowModal | 仍按旧模型：202+run_id → 3s 轮询 → adopt/apply |

**结论：探索功能当前端到端不可用**，需按以下清单改造。

### 8900 侧改造清单

| # | 改造 | 说明 |
|---|---|---|
| B1 | 删除旧探索透传端点 ×7 | tracker.py：/courses/{id}/explore、/explore-runs/{id}、/explore-runs/{id}/adopt、/explore-runs/{id}/discard、/courses/{id}/explore-runs、/curriculum-explore、/curriculum-runs/{id}/apply |
| B2 | tracker_client.py 同步清理 | 删除对应 7 个方法；补 dry-run 调用方法 |
| B3 | 新增探索会话端点（D3） | POST /explore-sessions（202+session_id）、GET /explore-sessions/{id}（轮询）、POST /explore-sessions/{id}/confirm-name、POST /explore-sessions/{id}/apply、DELETE /explore-sessions/{id}；会话态内存存储 + 后台线程执行 |
| B4 | 共享表直读写层 | 领域/课程维护字段 + exploration_stage 的直读写实现（在线时优先走 8901 API，离线降级直写，D1/D2） |
| B5 | api-contracts.md 同步 | 数据透传·Tracker 章节端点表更新（删旧 7 端点、增会话端点与领域/课程管理透传） |

### 前端侧改造清单

| # | 改造 | 说明 |
|---|---|---|
| F1 | tracker.ts 探索 API 重接 | 删旧 8 函数；新增 explore-sessions 五函数 + 领域/课程管理 CRUD 函数 |
| F2 | explore store 改造 | run_id 轮询 → session_id 轮询；adopt/apply → apply(selected)；增加名称确认状态处理 |
| F3 | ExploreFlowModal 适配 | 发起/轮询/名称确认视图/报告勾选/三态汇总结果；关闭不打断轮询、刷新恢复语义保留 |
| F4 | 探索状态读取切换 | 课程色点与领域按钮状态机改为从共享表 exploration_stage 读取（经 GET /courses 响应字段），不再依赖 knowledge 完成度推断 |
| F5 | mock 后端同步 | explore.mock.ts 切换到 session 模型 |

### 跨项目登记事项

| # | 事项 | 状态 |
|---|---|---|
| X1 | QED-Tracker 新增 POST /api/v1/courses/{course_id}/prompt-explores/dry-run（暴露已有 tutorials@v1 管线，QED-043 记载实现完成 378 passed） | 已登记 REQ-065 |
| X2 | shared-tables.md 写权限表修订（qed_domain/qed_course 增加"8900 离线直写维护字段+exploration_stage"例外）+ **exploration_stage 写主体澄清**（消解对方"已生成=dry-run 完成"与"dry-run 不写任何表"的文档矛盾：8900 负责状态流转写入——会话启动=探索中 / dry-run 返回=已生成 / apply 落库=已完成；课程"已完成"由 8901 验收聚合时自写） | 并入 REQ-064 ④⑤ 登记 |
| X3 | 课程层探索的 8901 离线降级语义（私有表写必须经 API，离线时挂起或禁用待定） | 随 X1 设计文档确认 |
| X4 | api-design GET /courses 响应领域行补 exploration_stage/level/classic_tracks/path_results 四字段（前端探索状态直读 F4 与领域路径图渲染必需；api-design 尚 Draft，正是修改窗口，否则双链路数据不一致） | 并入 REQ-064 ② 登记 |

> **2026-08-27 ARCH-019 冲突排查结论**（用户裁决通过）：REQ-053 探索链路部分按 F1~F5 返工（其余成果保留）；PLAN-020 探索流程正文被本计划与 PLAN-023 取代（界面交互裁决仍有效）；REQ-058 关闭（Rejected，旧契约已被对方自行推翻）；REQ-037 关闭（Not Applicable，被 api-design ③ 覆盖）。

## 降级策略

| 场景 | 行为 |
|---|---|
| 8901 离线 | 领域探索：8900 直调 LLM 网关 + 直写共享表，功能可用（D1/D2/D3）；教程/书籍功能禁用（qt_* 私有表不可达），前端显示降级横幅不阻塞树目录；课程层探索不可用（X3 待定） |
| 8902 离线 | 解析管理 503（本文档不涉及）；下载流程不受影响 |
| 8900 离线 | 前端整体横幅；子项目用本地默认配置降级运行（读根 .env） |
| 数据库不可达 | 8901 五层端点返回 409；8900 直写链路报错并提示 |
| LLM 失败/超时 | 探索会话 failed + 错误透出；qed_llm_calls 记录 error；前端可重试 |

## 关键文件索引

### 前端
| 文件 | 职责 |
|---|---|
| `web-ui/src/pages/Downloads.tsx` | 下载管理主页面（左树+右面板+领域信息卡+教程区） |
| `web-ui/src/stores/downloads.ts` | 下载管理状态（fetchAll/buildTreeNodes） |
| `web-ui/src/stores/explore.ts` | 探索状态（轮询/采纳/放弃）——待切 session 模型 |
| `web-ui/src/stores/exploreRules.ts` | 上限/锁定/状态计算 |
| `web-ui/src/components/ExploreFlowModal.tsx` | 探索全弹窗流 |
| `web-ui/src/components/DownloadsTree.tsx` | 左树三层+右键菜单+添加领域 |
| `web-ui/src/api/tracker.ts` | 数据域端点封装——待重接 |
| `web-ui/src/stores/explore.mock.ts` | mock 后端 |

### 后端
| 文件 | 职责 |
|---|---|
| `backend/qed_engine/api/main.py` | FastAPI app 组装（三域路由） |
| `backend/qed_engine/api/tracker.py` | 8901 透传+轻量校验——待删旧探索端点 |
| `backend/qed_engine/clients/tracker_client.py` | 8901 httpx 客户端——待同步清理 |
| `backend/qed_engine/api/axiom.py` / `clients/axiom_client.py` | 8902 透传（解析侧，本文档不涉及） |

### 子项目（只读参考，改动经跨项目流程）
| 文件 | 职责 |
|---|---|
| `QED-Tracker/src/qed_tracker/api/main.py` | 8901 全部端点（685 行） |
| `QED-Tracker/src/qed_tracker/prompt_lab/templates.py` | 探索模板注册表（domain@v2/courses@v4/path@v4/tutorials@v1） |
| `QED-Tracker/docs/design/shared-tables.md` | 共享表 DDL 唯一事实源 |
| `QED-Tracker/docs/plans/2026-08-api-design.md` | 8901 16 端点五要素设计 |

## 相关文档

| 文档 | 位置 | 说明 |
|---|---|---|
| 用户操作流程设计 | 本目录 `2026-08-27-download-ux-flow.md` | 同轮配套，操作级流程规范（PLAN-023） |
| 共享表设计 | QED-Tracker `docs/design/shared-tables.md`（Accepted） | 三共享表 DDL/列语义/状态机/写权限 |
| 8901 API 设计 | QED-Tracker `docs/plans/2026-08-api-design.md`（Draft） | 16 端点五要素 |
| 课程收集流程 | `docs/design/downloads-flow.md` | 五阶段课程收集设计（REQ-070 并入） |
| 三表模型 | Git 历史（原 docs/design/downloads-three-table-model.md，REQ-070 删除） | 历史三表→五层演进 |
| API 契约 | `docs/architecture/api-contracts.md` | 8900 固定 API 契约（B5 待更新） |
| 数据库总纲 | `docs/architecture/database-design.md` | 共享库总纲 |
| 三项目对接规范 | `docs/design/cross-project-contracts.md` | 跨项目契约+独立性铁律 |

## 验证与验收

- `python -m pytest tests\contract -q` 全绿（本计划文档自身的治理契约）；
- 改造项逐项验收：B1~B5 / F1~F5 完成后，按「核心状态机」与「探索流程时序」做联调对照；
- 联调门禁：8901 冒烟 + 契约测试 + 前端 vitest/tsc/build 全绿；
- 操作级验收走配套 UX 文档 checklist（PLAN-023 §验证与验收）。

## 回滚

- 本计划为纯文档轮，无代码回滚面；
- 后续按本计划实施代码改造时，各工作项（B1~B5/F1~F5）独立成 commit，可按项 revert；
- 8900 探索会话端点（B3）为新增路由，回滚=移除路由注册，不影响既有端点。

## 关闭与归档

- 关闭条件：改造清单全部完成 + 联调验收通过 + REQ-064/REQ-065 回执闭环；
- 归档动作：本文档流程事实按归档判定并入 `docs/design/` 固定文档（已由 REQ-070 并入 downloads-flow.md），计划壳移入 `docs/history/plans/2026-08/`，todo.md Plan 行与 REQ 行同步收口。

---
*本文档为流程梳理；API 五要素见 QED-Tracker api-design 与根仓库 api-contracts，DDL 见 shared-tables.md 与 database-design.md。开发顺序：本流程文档评审定稿 → UX 流程文档（PLAN-023）→ 代码改造。*
