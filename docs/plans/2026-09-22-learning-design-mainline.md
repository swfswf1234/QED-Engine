# 学习设计轮·主链路（课程注册·链路编译·判分推进）（learning-design-mainline）

状态：In Progress
任务类型：B
最后更新：2026-09-23
关联 ADR：无新增（重划分为台账裁决；登记方式沿用 [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳）
关联设计：[api-contracts.md](../architecture/api-contracts.md)（学习域契约承接位）、
[frontend-architecture.md](../architecture/frontend-architecture.md)（消费面指针，界面实施归 M1 壳）
关联 Tracker：docs/trackers/todo.md（ARCH-027 任务行＝主链路主任务；模块支线行 ARCH-027-M1~M4 各配固定壳；本壳承接原 ARCH-022 第五轮、原 ARCH-026/PLAN-051 渲染线与 REQ-089 第二批调研收口）
归档判定：Retain（滚动记录，轮次收口时按当时里程碑归档 history/plans/）

> 本壳是学习设计轮**主链路**（主架构主流程）的唯一滚动记录。轮名沿革：学习中心轮（2026-09-22
> 并轮立项）→ **学习设计轮**（2026-09-23 用户裁决重划）：主链路做主任务，其余按模块划分并各与
> 一份 plans/ 固定壳绑定（M1~M4，见「模块壳一览」）。切分裁决＝**掌握门与判分入主链**（推进由门
> 算出，状态机单一事实源），出题/复习/错题本剥离为 M2。
> **排期范围＝仅根仓库（8900/8903）**（用户裁决 2026-09-22）：不向 Axiom-Flow / QED-Tracker
> 发请求，实施中确有需要时再按跨项目协作规范另行提出。

## 目标与成功标准

**目标**：QED-Engine 在学习链路中的定位＝**只做数据展示与学习链路编排**（用户裁决 2026-09-22）：
课程素材的检索/下载归 QED-Tracker（ARCH-024 线）、知识整理归 Axiom-Flow（ARCH-025 线）。
主链路＝一门课从进到完的闭环驱动：**课程注册（引用式）→ 链路编译（两级确认→块序列）→
块学习推进 → 判分与掌握门 → 派生进度与结课**。本壳承载该状态机与 8900 学习域数据契约本身。

**成功标准**：

| # | 标准 | 判据 |
| --- | --- | --- |
| S1 | 契约先行：学习域表 + 8900 REST 契约（课程引用式注册表、syllabus 勾选权归人、进度派生）契约测试先行全绿 | `tests/contract` + 8900 定向测试 |
| S2 | 链路编译：任一课程可产出「大纲（两级人工确认）→ 块序列（text/公式/图/quiz/flashcard）」，断点续编、源漂移可标记 | 8900 定向测试 + 真机一书贯通 |
| S3 | 门与判分：四分类知识点 + 双门槛（量化 0.9 / 质性 Feynman）+ 确定性判分 + 服务端 expected_answer + 防蒙对权重，推进由门算出非游标 | 规则层纯单测（不依赖 LLM）+ 端到端契约测试 |
| S4 | 端到端贯通：现有生效版本产物 + 本地模型下，一门课「注册→编译→学习→判分→推进→结课」跑通（消费 M1 界面、M2 出题、M3 开关） | 真机走查 + M3 冒烟复跑 |

## REQ-089 第二批调研承接：DeepTutor 学习面判定表（2026-09-22）

> 来源＝REQ-089 第二批（学习中心面）三切片调研（课程面 / 练习与掌握面 / 记忆与本地模型适配），
> 只读参照 `D:\coding\demo_program\DeepTutor`（第三方开源项目，不引入依赖）。证据路径相对该仓库。
> 用户裁决：最有意义＝Book 活书编译器 + 练习与掌握面（可基于其开发）+ 本地模型适配层。
> 2026-09-23 重划后各条**承接壳**见末列。

| # | 机制 | 判定 | 依据（DeepTutor 证据） | 承接壳 |
| --- | --- | --- | --- | --- |
| L1 | 掌握三件套：知识点四分类 memory/procedure/concept/design；双门槛（量化门近因加权正确率 ≥0.9 `learning/policy.py:35-38`；质性门 Feynman+`mastery_assess` 布尔 `policy.py:41-45`）；防蒙对权重上限（`learning/mastery.py:17-37`）；推进由门算出非游标（`policy.py:206-288`） | **吸收（基于其开发）** | 全为规则与服务端状态，不吃模型能力 | 主链 M-3 |
| L2 | 确定性判分（choice 全等/short SequenceMatcher≥0.85/open 关键词命中≥0.6，`learning/grading.py:13-49`）+ 服务端 expected_answer 不经模型（`learning/models.py:189-232`）+「出题即结束回合、下回合先判分再 seed 裁决」（`capabilities/mastery/loop.py:305-406`） | **吸收** | 判题不可被模型污染，本地模型下依然可靠 | 主链 M-3（回合语义）+ M2（出题侧协议） |
| L3 | 间隔复习（按类型间隔表+连对升档/连错降档+错题 kp 最高优先，`learning/scheduler.py:13-98`）+ 错题双写题库（best-effort upsert，`tools.py:304-351`；题库 schema 含 user_answer/correct_answer/is_correct/score_trend，`sqlite_store.py:323-350`） | **吸收（MySQL 化）** | 我们 af_*/qed_* 同库体系，结构直译 | M2 |
| L4 | Book 活书编译：提案→章节树（Spine，两级用户确认）→按 ContentType 静态模板出 block 计划（如 THEORY 章=正文×3+FIGURE+CALLOUT+CODE+QUIZ×3+FLASH_CARDS×5，`book/agents/page_planner.py:73-93`）→逐块生成每块落盘、断点续编、失败熔断；源指纹 drift 标过期页（`book/kb_health.py:55-101`）；进度派生重算非累加（`book/progress.py:19-67`） | **吸收（改造为学习链路编译器）** | 「为课程编译学习链路」的用户裁决承载；自动全书文采生成后置 | 主链 M-2 |
| L5 | 课程＝引用式注册表（资源 kind 闭集只存 ref_id+label 快照；syllabus covered 只能学习者勾选；instructions/agent_notes 双通道限长，`services/courses.py:44-52,83-104`）+ 每回合 ≤3200 字符状态摘要注入 + 闭集 handoff、course_id 服务端注入（`capabilities/course_study/capability.py:352-377,412-420`） | **吸收（改造为 8900 表）** | 数据结构轻；状态摘要模式适配本地小模型 | 主链 M-1 |
| L6 | 出题三向位 Explore→Plan→每题 loop + 严格 JSON + normalize/校验/一次 repair（`agents/question/pipeline.py:619-1013`）；mimic 试卷仿题 | **吸收（后置实施）** | 依赖主链门/题库地基；repair 策略照抄 | M2 |
| L7 | 本地模型降级：能力表硬编码 ollama/lm_studio/vllm/llama_cpp `supports_tools:False`（`services/llm/capabilities.py:229-256`）；禁原生 tool calling→文本工具协议；不支持 JSON→剥 response_format+运行时拉黑（`capabilities.py:489-535`）；JSON 容错三件套（`utils/json_parser.py`）+ thinking 清洗（`llm/utils.py:180-202`）+ 预算饥饿降 effort 单次重试（`llm/structured_retry.py`）+ task model 继承兜底（`model_selection/tasks.py`） | **吸收** | 证明 Ollama 级后端可行 | M3 |
| L8 | 三层文件记忆 L1 trace/L2 策展/L3 综合 + 手动触发整合（`services/memory/`）；Learner profile/persona＝一段 prompt block（`learner_profile.py:38-49`） | **移植思想，后置** | 不排期；需要时轻量复刻 | 暂不配壳（roadmap 预留） |
| L9 | Little Tutor（选区追问）、ask_questions（澄清访谈） | **并入界面/探索评估** | 交互思想，非独立流 | M1（选区追问）+ M4（澄清访谈/问答） |
| R1 | Partner/IM 15 渠道、多用户、MCP/CLI Apps、YouTube 沉浸、GraphRAG 系 | **拒绝** | 超出个人图书馆边界（判例同第一批 R6） | — |

## 模块壳一览（2026-09-23 重划，一模块一行一壳）

| 模块 | 台账行 | 固定壳 | 承载原工作项 |
| --- | --- | --- | --- |
| M1 学习面 UI 与渲染基线 | ARCH-027-M1 | [2026-09-23-learning-ui-rendering.md](2026-09-23-learning-ui-rendering.md) | 原 W1（渲染基线，承接 PLAN-051）+ 原 W6（课程面 UI） |
| M2 练习与复习 | ARCH-027-M2 | [2026-09-23-practice-review.md](2026-09-23-practice-review.md) | 原 W4 拆出：出题管线（L6）+ 间隔复习/错题本（L3） |
| M3 本地模型适配层 | ARCH-027-M3 | [2026-09-23-local-model-adaptation.md](2026-09-23-local-model-adaptation.md) | 原 W5（L7 全量） |
| M4 知识探索 | ARCH-027-M4 | [2026-09-23-knowledge-exploration.md](2026-09-23-knowledge-exploration.md) | 问答/召回消费面（后置；L9 澄清访谈 + ARCH-025 检索线对接预留） |

## 范围与非目标

**范围（主链）**：8900 新增学习域端点与表（qed_* 族）——课程引用式注册表、链路编译器、
知识点/掌握门/确定性判分/推进派生，以及贯穿三者的契约先行与状态机。

**非目标**：界面与渲染（M1）、出题/复习/错题本（M2）、网关降级开关（M3）、问答与召回探索（M4）、
检索与下载（归 ARCH-024 线）、解析与知识整理（归 ARCH-025 线）、对本仓库外的代码改动与请求发起
（本轮只排根仓库，用户裁决 2026-09-22）、三层记忆与 Learner profile 实施（L8 后置）、
自动整书生成、知识图谱（暂不做，判例同第一批）。

## 前置条件

1. 本壳 + ARCH-027（主链）与 ARCH-027-M1~M4 共五行台账登记完成（2026-09-23 重划，判例
   ARCH-020 字母后缀支线行）。
2. M-1 契约设计先行（契约先行判例同对方 PLAN-008 口径，写入本壳后再实施）；M-2 编译前置
   M-1 表结构 + M3 开关。
3. M-2 输入面**不依赖检索、不依赖子项目新改动**（用户裁决）：v1 用现有生效版本产物
   （8900 透传既有 blocks/content_list）+ 人工圈定页窗。
4. 各流实施排期逐条经用户确认（本壳只立项登记）。

## 工作项（主链滚动登记表）

| 流 | 内容 | 归属 | 状态 |
| --- | --- | --- | --- |
| M-1 | 学习域数据契约（L5 移植）：课程＝引用式注册表（资源 kind 闭集指向 qt_*/af_* 既有书目/版本，只存 ref + label 快照）、syllabus 勾选权归人、instructions/agent_notes 双通道限长、进度派生重算；8900 REST 契约 + 404/422 约定 + 契约测试先行；8903 只连 8900（ADR 0007） | 根 8900+8903 | 待开始 |
| M-2 | 链路编译器（L4 移植）：提案→章节树两级人工确认→块序列生成（静态模板兜底、块级落盘断点续编、失败熔断）→源指纹 drift 标记；输入＝现有 blocks + 人工页窗，**不依赖检索** | 根 8900 | 待开始（前置 M-1 契约 + M3 开关） |
| M-3 | 门与判分（L1/L2 移植）：四分类知识点、双门槛（量化 0.9 近因加权 / 质性 Feynman+`mastery_assess`）、确定性判分（choice 全等 / SequenceMatcher≥0.85 / 关键词≥0.6）、服务端 expected_answer、防蒙对权重上限、「出题即结束回合、下回合先判分再裁决」回合语义、推进由门算出（进度游标禁止手改）；主观题单次 LLM 批改（判题不喂 RAG，判例 L2） | 根 8900 | 待开始（规则层可先于 M-2 单测；出题来源＝M2 题库） |

## 验证与验收

- 每流收口：8900 侧跑定向测试 + `tests/contract`；契约变化同步 api-contracts.md。
- M-3 规则层（判分/门槛/推进派生）为纯单测，不依赖 LLM 与网络；S4 端到端验收在本地模型下复跑
  （前置＝M3 开关全绿）。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯记录文档：删除本文件不影响代码与测试；登记表条目对应的代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件＝M-1~M-3 全部收口且 S1~S4 验收通过（S4 需 M1/M2/M3 协同到位），由用户裁决收口；
关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-027 任务行。
轮次整体收口＝本壳 + M1~M4 四壳全部关闭（原第五轮「学完一个教程」口径由 S1~S4 + 各壳标准承接）。
