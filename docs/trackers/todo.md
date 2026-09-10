# 任务台账

状态：Current
最后更新：2026-09-10

本文件登记根仓库未关闭任务，是活跃计划的镜像。详细计划见 [计划索引](../plans/index.md)；
已关闭任务见 [completed.md](completed.md)。

## 未关闭任务

### 第一轮主线·架构确定轮（ARCH-018）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| DEFECT-001 | 支线 | 低 | 已完成 | `test_services_restart_externally_running_script_unit` 环境依赖失败（2026-08-21 门禁发现）：8901 离线时测试必失败（409）——`control.py` 经 `from ... import _probe_http` 直接绑定原函数，测试仅 monkeypatch `sm._probe_http`，路由真实探测 8901=False 跳过 stop → 内部 `_start` 用被 patch 全局=True → 409；8901 在线时反而通过（历史 294 passed 记录时服务在线） | 已修复（2026-09-04 确认）：control.py 改用 `sm._probe_http` 模块属性访问，monkeypatch 可正常生效，测试无论8901在线/离线均通过 |

### 第二轮主线·课程下载轮（ARCH-019）

#### 块 2：全流程交互逻辑（design 预备，先落地 plans/）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| PLAN-023 | 支线 | 高 | In Progress | [文档下载全流程交互规范（ARCH-019）](../plans/2026-08-27-download-ux-flow.md) | **主文档**：M1-M8 旅程 + 用户操作表 + 状态可视化 + 异常降级；2026-09-01 统一冲突：域探索改无弹窗直触（REQ-067 §B2）、状态机改 5 态（+失败）、8900 角色改纯透传。开发与验收以本文档为准；用户评审通过后按 checklist 驱动实现，确定后操作契约并入 design/ 固定文档 |
| PLAN-022 | 支线 | 高 | In Progress | [文档探索+下载全流程计划（ARCH-019·REQ-064 配套）](../plans/2026-08-27-exploration-download-flow.md) | 挂靠 PLAN-023：三端架构 + 数据访问双链路 + 降级策略；B1-B5/F1-F5 改造清单已全量执行（2026-08-28），REQ-064/065 已完成。保留为架构参考，交互规范以 PLAN-023 为准；开发完成后流程事实并入 design/ 固定文档 |

#### 块 3：实际验证（三门课闭环 + 人工审核）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-019 | 主线 | 高 | 进行中 | 第二轮主线：课程下载轮——三门基础课（00 概率论与数理统计 / 01 数学分析 / 02 高等代数）下载闭环，与 QED-Tracker 联动（QED-026 主链路）。**验证标准**：三门课全部完成「探索→确认→下载→验收→登记」，人工审核通过 | **前置调整（2026-08-23 用户裁决）**：清库重走一轮；ARCH-002 验收并入本主线；上限规则：每课教程 ≤4、≥2 套审核完成后停探。**2026-09-07 QED-Tracker qed_test API 冒烟回执**：清库后纯 8901 API 链重放成功——POST /domains/import（math-advanced，courses_created 12）→ POST /courses/{01_math_analysis,02_linear_algebra,11_probability}/knowledge 采纳（11 套 draft、21 书行）→ POST /knowledge/{id}/confirm 逐套同意（11/11 confirmed）→ POST /books/{book_id}/import 验收登记 17 本（01 课程 11、02 三、11 三；holding=owned，落盘 raw/math/&lt;course&gt;/&lt;title&gt;_&lt;sha8&gt;.pdf，同 sha 幂等复用）→ 复核 mainline verify 17/17 [ok]，渠道 local_import 留痕 18 次全 ok。缺书：01ma-b02/b03（Apostol 两卷用户暂缓）、02la-b06 普罗斯库烈柯夫、11pb-b05 Casella & Berger（目录无 PDF）。基于 QED-Tracker 分支 feat/exploration-api（HEAD 1c2ede5 + 未提交工作区，含 QED-050-D/ADR 0006 实现与 docs/knowledge 01 json 修订 b15~b18）。正式库执行前置：课程 id 体系差异（ARCH-019 视角 00 概率论与数理统计 vs QED-Tracker 12 门体系的 11_probability）需正式执行时统一 |
| ARCH-002 | 主线 | 高 | Accepted | [教材下载轮计划（textbook-download-round）](../history/plans/2026-08/2026-08-05-textbook-download-round.md)（已归档至 history/plans/2026-08/） | 计划状态 Accepted；验收并入 ARCH-019；三线工作项由子项目 todo 承接（QED-008~016、ALN-001~007） |
| REQ-035 | 支线 | 高 | 待开始 | 8900 数据域适配 QED-031 新契约（联调前置）：api/tracker.py + clients/tracker_client.py 从三表端点切换为 qt_knowledge/qt_sources 语义；课程体系数据源（courses/math.json → qed_course）切换；config-center-api 数据域章节与 service-contracts 8901 契约同步更新 | **2026-08-17 QED-Tracker 已回执 0006 落地**——前置解除，可启动执行 |
| REQ-017 | 支线 | 高 | 进行中 | QED-Tracker 服务化遗留三缺口（请求：QED-Tracker）：① 仓库内提供正式启动入口（已完成，QED-032）；② 评估任务进度上报（待开始）；③ 服务重启后 running 任务恢复（待开始） | ① 已完成并回执；②③ 仍待 QED-Tracker 建 todo 承接 |
| REQ-019 | 支线 | 中 | 待开始 | 版本核对（请求：QED-Tracker）：下载验收的系统预检增加「登记版本 vs PDF 首页标题」自动核对 | 由 QED-Tracker 承接，回执后关闭 |
| REQ-020 | 支线 | 中 | 待开始 | 榜单数据收集（请求：QED-Tracker）：① 找资料权威性榜单；② 找书找得率榜单 | 由 QED-Tracker 承接，产出回填阶段 1 选书规则 |
| REQ-032 | 支线 | 中 | In Progress | [REQ-032 meta/ JSON 退役计划](../plans/2026-09-01-req032-meta-json-retirement.md) | 请求：QED-Tracker（对方承接中）——Phase 1+2 已完成（TaskStore→qt_tasks + SelectionStore→qt_selections，迁移 0016/0017，测试通过）；Phase 3（Inventory→qt_books）暂缓（用户确认 qt 系列表非当前范围） |
| REQ-068 | 支线 | 高 | 待开始 | QED-Tracker 领域探索四缺口移交（请求：QED-Tracker，来源 [domain-explore 设计](../design/downloads-flow.md) §4.5，原登记 [PLAN-034 §9](../history/plans/2026-09/2026-09-08-arch019-explore-backend-chain.md)）：① 书籍状态机 8 路由（decide/start/fail/retry/complete/verify/reject/supersede）8900 透传 404，书目操作 UI 无上游；② PATCH /courses 不支持 exploration_stage 字段，课程阶段流转直写与上游契约不一致；③ GET /api/v1/courses/{domain_id} 单领域课程体系 8900 未透传（树左列按领域增量刷新前置）；④ explore_pending.kind 双形态（在线 review_results / 离线 import_courses）语义归一 | 2026-09-08 登记（PLAN-034 §9 移交清单）；由 QED-Tracker 建 todo 承接，回执后关闭 |
| REQ-068-PLAN | 支线 | 高 | In Progress | [联调问题解决清单（QED-Engine ↔ QED-Tracker）](../plans/2026-09-08-integration-issues-checklist.md) | REQ-068 配套：ISSUE-001/002 已登记；所有 ISSUE 关闭后随主线归档 |

#### 补登记·详情交互计划（2026-09-10，REQ-069 治理轮迁正：原 2026-09-09 会话产物， PLAN-035 为 ISSUE-003 配套）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| PLAN-035/036 | 支线 | 中 | In Progress | [文档下载管理页面交互规范（课程详情+书目操作）](../plans/2026-09-10-downloads-interaction-spec.md) | 2026-09-10 合并（原 PLAN-035 课程详情弹窗状态机 + PLAN-036 书目详情确认下载链路）；规定和设计文档，不含 Task；实现已落地，待用户浏览器验收后关闭 |

### 第三轮主线·解析联调轮（ARCH-020）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-020 | 主线 | 高 | 待开始 | 第三轮主线：与 Axiom-Flow 联调（local 和 api 模式），不断优化解析效果直至用户确认（至少完成一个教程的解析） | 前置：第二轮主线（ARCH-019）课程下载闭环 + Axiom-Flow REQ-044 / REQ-042 回执；V2-013 执行回执后联调验收 |
| REQ-057 | 支线 | 中 | 进行中 | **请求：QED-Tracker / Axiom-Flow**——ADR 0011 规则同步回执（2026-08-23 用户指令同步，根仓库 agent 直接执行文档改动）：QED-Tracker 已完成（已建 `docs/adr/0003-pending-design-location.md` + adr/index 登记 + documentation.md design/plans 两行修订 + tests/test_documentation.py 白名单补 1 行，验证通过）；Axiom-Flow 已建文档但未审阅（已建 `docs/adr/0002-pending-design-location.md` + adr/index + documentation.md 两行修订，验证通过但未审阅） | Axiom-Flow 需完成文档审阅后回执关闭 |
| REQ-003 | 支线 | 高 | 待开始 | Axiom-Flow 数据目录指向根 dataset/axiom-flow/parsed、直读 QED_* 变量（含 QED_DB_*，qed 库）（请求：Axiom-Flow）**2026-08-26 并入**：根 .env 唯一事实源裁决（见 project-configuration.md）后，本项扩展为同口径 .env 精简——其自身 .env 删除与根重复的 API_KEY/QED_API_SELECT/QED_LLM_GATEWAY_URL，仅留 AXIOM_* 私有键；AXIOM_MYSQL_* → QED_DB_* 键名对齐属本项代码改动范围（其解析器已支持向上走查根 .env 兜底） | Axiom-Flow todo ALN-003 承接；用户已确认（2026-08-04），B 类计划 ALN-007 执行 |
| REQ-015 | 支线 | 中 | 待开始 | Axiom-Flow 读取 dataset/qed-tracker/raw/ 的批量导入解析接口（Phase 2 前置；请求：Axiom-Flow） | Axiom-Flow todo ALN-006 承接；教材下载轮联调后确认，拆 B/D 类计划执行 |
| REQ-034 | 支线 | 中 | 进行中 | 数据域·Axiom 适配（C 组第二阶段前置，编排见 [cross-project-contracts.md](../design/cross-project-contracts.md)）：Axiom-Flow v2 契约冻结（V2-007 回执）后，建 api/axiom.py + clients/axiom_client.py（解析进度/原始文档对照端点） | 2026-08-16 ARCH-014 轮登记；**同步开发已实施**（backend 五端点 + 前端解析进度/对照两视图，269→271 pytest + 70 vitest passed）；**2026-08-16 联调冒烟通过**（8902 真实数据：01-rudin-trial 20 页 md + 页图 5.2MB 经 8900 代理加载）：契约偏差已适配——① image_url 为 8902 相对路径 → 8900 新增图片代理端点 GET /books/{id}/pages/{no}/image（浏览器只连 8900）；② BookMeta 无进度字段（实际 page_count/author/strategy）→ 前端 manifest 推导页进度（契约冻结后切换上游字段）；③ parse-jobs strategy 枚举 local/hybrid；V2-007 契约冻结后按回执微调 |
| REQ-036 | 支线 | 高 | 待开始 | v2 服务建设与 V2-003 移交审阅（请求：Axiom-Flow，C 组联调前置）：① V2-003 ingest 代码已由根仓库侧误建在对方工作区（未提交，81 passed + ruff clean，含单元测试与文档同步）——请审阅后自行提交或调整；② V2-004/005/007（orchestrator / MinerU 接入 / API v1）按对方 todo 推进，8902 API 服务建立后回执根仓库（C 组第一阶段联调与 REQ-034 前置解除） | 2026-08-16 登记（亡羊补牢：误产生的代码改动登记移交，对方审阅后自行提交；V2 联调前置已在对方 todo 标注）；**对方承接回执后关闭** |
| REQ-042 | 支线 | 高 | 进行中 | af_* 书目同步与块判定（请求：Axiom-Flow，2026-08-18 文档解析管理轮）：af_books / af_block_reviews 建表（Alembic）+ `POST /books/sync`（幂等 upsert，book_id 同源 qt_books）+ `/books` 改读 af_books（含课程/进度字段，空表回退文件系统）+ 块判定端点（PUT/GET review）+ parse-jobs 完成后回写 pages_done/parse_status | 2026-08-18 在对方仓库已建设计文档（af-books-sync.md）+ todo 登记（V2-013）；**根仓库侧同步开发已完成（2026-08-20）**：8900 sync/review 端点（tests/test_api.py 5 用例，全量 219 passed）+ 前端左树右对照重构（vitest 89 passed + tsc 无错 + build 成功，契约测试 61 passed）；**待 Axiom-Flow V2-013 执行回执后联调验收，回执后关闭** |

### 第四轮主线·探索轮（ARCH-021）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-021 | 主线 | 高 | 待开始 | 第四轮主线：与 Axiom-Flow 联调探索——RAG + 知识图谱 + chat 问答，确保课程效果，成熟后作为课程学习部分（完成一个教程）；learning/ 学习探索同步启动（QED-Engine 独有） | 前置：第三轮主线（ARCH-020）解析效果确认；探索设计见 [design/document-chunking-recall.md](../design/document-chunking-recall.md) |
| REQ-027 | 支线 | 中 | 待开始 | 数据库设计确认（请求：Axiom-Flow）：af_* 表清单与结构由 Axiom-Flow 设计确认，确认后回执根仓库 [../architecture/database-design.md](../architecture/../architecture/database-design.md) 补登记表清单 | 2026-08-09 用户裁决（数据库设计先在各子项目确认，根仓库只做指引和规划）；**2026-08-10 已建设计文档（Axiom-Flow docs/design/database-schema-ownership.md）并登记 ALN-009 承接**；由其仓库确认与回执后关闭 |

### 第五轮主线·学习中心轮（ARCH-022）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-022 | 主线 | 高 | 待开始 | 第五轮主线：学习中心轮——用户同步学习，开始知识探索、课程学习和课后练习，直至学完一个教程（学习功能现状文档 2026-09-10-learning-center-current-state.md 启动） | 前置：第四轮主线（ARCH-021）课程内容成熟 |
| REQ-006 | 主线 | 中 | 进行中 | QED-Engine 前端（8903）：主体学习界面 + 后台管理（仪表盘/知识体系/解析进度/文档对照/追溯） | 期次里程碑：三期（ARCH-003，111 passed）→ 四期（ARCH-004，119）→ 五期~十三期（ARCH-005，127→140，a5ce8c1 已验收）→ 十四期（ARCH-006，141，人工评审优化）→ 十五期（ARCH-007，150，文档下载课程分页）；逐期界面细节见 project-status 前端行与 history/plans/；管理后台已随 web-ui React 重构落地（ARCH-011 已实施）；学习中心部分归第五轮主线（ARCH-022）收尾 |
| REQ-031 | 支线 | 低 | 待开始 | 使用手册完善（前端 web-ui）：当前手册（HELP_SECTIONS 迁移六节）内容粗略，待学习中心各功能稳定后逐界面细化（操作截图/分步图文/FAQ 扩充/五阶段流程配图） | 2026-08-16 用户标注：使用手册还不完善，**低优先级**，等后续完善；暂不阻塞前端重构主轮 |
| REQ-033 | 支线 | 低 | 待开始 | 仪表盘整体优化（前端 web-ui）：当前为过渡形态（四服务摘要 + 下载/解析上下大盘），待整个后台服务正常后梳理优化（布局细化、数据源扩充、图表增强，如解析大盘接 parse-jobs 真数据） | 2026-08-16 用户标注：仪表盘具体梳理等整个后台服务正常后再优化，**低优先级**；本轮仅完成四服务摘要/上下布局/去副标题 |

### 设计文档体系重组轮（2026-09-10）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| REQ-070-PARS | 支线 | 高 | In Progress | [文档解析管理现状（Parsing）](../plans/2026-09-10-parsing-management-current-state.md) | REQ-070 重组轮 design/ 解析管理位置空的现状承载（8900 适配层 + Parsing 页 + REQ-034/042 进展）；功能设计确定后按 ADR 0011 晋升 design/，本现状壳退役 |
| REQ-070-LEARN | 支线 | 高 | In Progress | [学习功能现状（知识探索/课程学习/课后练习）](../plans/2026-09-10-learning-center-current-state.md) | REQ-070 重组轮 learning-center.md 移入改造的现状承载（知识探索已固定 + 课程学习探索 + 课后练习无设计声明）；设计确定后按 ADR 0011 晋升 design/，本现状壳退役 |

### 长期任务

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| REQ-062 | 长期 | 中 | 进行中 | **AI 开发指引优化（2026-08-26 登记，同日用户裁决改收件箱机制）**：四段式——① **捕获**：大任务完成后把 agent 利用经验写入 [ai-agent-knowledge-inbox.md](../plans/ai-agent-knowledge-inbox.md)（长期滚动收件箱，不随任务归档；可手动要求补充）；② **审核**：三判据（复用价值/非瞬时状态/未被正式文档覆盖）逐条过，任一不满足不入池；③ **批量晋升触发**：待评审 ≥10 条或单主题聚集 ≥3 条或每月例行（先到为准）；④ **体系优化**：分析轮聚类产出结构性结论，修订正式文档乃至开发流程。首批内容已落 development.md「环境准备（AI 开发速查）」节 | 收件箱已建立 + 首批 1 条待评审（8900 改码后须重启）；持续进行无单一终态；每次入池/晋升后运行 tests/contract 门禁；**2026-09-10 体系优化轮执行**：REQ-069 AI 开发守则整合轮（AGENTS.md 变更分级边界 + development.md 六步流程 + design-bugfix-log 台账，ADR 0012） |
| REQ-002 | 长期 | 中 | 进行中 | 文档治理与同步（**吸收 REQ-021/025，2026-08-16 ARCH-013 合并**）：标准/ADR/计划/台账与契约测试随需求同步更新（ADR 0012 已落地）；README/AGENTS 大变动同步（原 REQ-021）；四类设计文档（架构/API 契约/数据库/技术栈）先文档后实现同步（原 REQ-025） | 每次文档变更前运行 `tests/contract/` 门禁；大变动评审时同步 README/AGENTS |
| REQ-010 | 长期 | 中 | 进行中 | 跨项目协作规范演练：向 Axiom-Flow/QED-Tracker 登记改造请求 todo | 双方回执并关闭其 todo 后完成 |
| REQ-046 | 长期 | 高 | 进行中 | API 接口开发：先确定接口类型，按类型写 API 文档落入各自项目——① QED-Engine 前端无 API（静态页面只连 8900，声明于 [api-contracts](../architecture/api-contracts.md)）；② QED-Engine 后端三类（控制域启停/重启/健康、QED-Tracker 透传及相关处理、Axiom-Flow 透传及相关处理）；③ QED-Tracker 三类（自身生命周期+健康、数据库知识查询传递、LLM 检索课程教程/选书业务）；④ Axiom-Flow 四类（生命周期+健康、数据查询、解析结果与 PDF 对照、未来 RAG/知识图谱预留）；检查是否有遗漏；关联 ARCH-012（全流程跑通 + Axiom-Flow 完成前端验收 + 流程完整走完为止） | 第一步（接口类型确认 + QED-Engine 文档落位）随 ARCH-018 完成（architecture/api-contracts.md 已落位、前端无 API 已声明）；子项目 API 文档经请求由对方执行（Axiom-Flow / QED-Tracker todo 承接）；**2026-08-31 范本化重排**：api-contracts.md 按 QED-Tracker api.md 结构重排（概述分类表 + 逐端点请求/返回/错误 + 统一错误码表），补齐 REQ-067 `/domains/import`、`/domains/{id}/explore`、`/domains/{id}/confirm-name`，删过时注记、修正 8902 契约事实源引用，转正已确认 |
| REQ-047 | 长期 | 高 | 进行中 | 数据库设计：QED-Engine [database-design](../architecture/database-design.md) 为总纲（qed_* 共享表族完整；qt_*/af_* 部分置空，提示先查子项目数据库文档）；QED-Tracker 定义自身完整数据库定义（docs/architecture/database-schema.md 唯一事实源，REQ-026 已回执）；Axiom-Flow 定义 af_* 完整数据库定义（REQ-027 承接中），通过文档 + 单独数据库管理体系管理 | QED-Engine 总纲随 ARCH-018 落位（2026-08-20，ADR 0010 版本机制）；子项目数据库文档由各自仓库维护（各项目 Alembic 独立初始化自己的表，qed_* 共享表所有权 QED-Tracker）；**2026-08-31 范本化 + af_* 补登记**：database-design.md 对齐范本骨架（需求方/唯一事实源声明/决策记录），af_* 行刷新为由 Axiom-Flow database-design.md 登记（V2-013 规划契约），关联代码补 qed_llm_calls 建表方，转正已确认 |
| REQ-050 | 长期 | 中 | 进行中 | 版本更新文档体系重新梳理（2026-08-21 ARCH-018 收尾登记，ADR 0010 版本机制）：每次版本更新（用户确认升版本时）按 ADR 0010 重新梳理三项目文档体系——architecture/ 固定化维护（总体/服务架构/API/数据库/code-map）、guides 操作与开发文档、trackers 主线归并（完成→completed.md）、design 三态梳理、plans 归档、子项目范本对齐跟进（REQ-048/049 同源） | 随 ARCH-018 关闭登记；每次版本末期触发，不单独设排期；子项目对齐经请求由对方执行 |
| OPS-001 | 长期 | 低 | 待开始 | 服务域 stop 对外部实例失效（2026-08-26 两次复现：REQ-061 验证轮 + Phase A 清库轮）：外部启动的 8901 被 POST /services/tracker/stop 时记录 pid=null，杀不到真进程（stop 返回 stopping 但端口仍监听）；需直杀监听 PID 后服务域 start 重新纳管 | 复现条件：8901 非经服务域启动（如手动 python -m uvicorn 或脚本单元启停语义缺陷导致的孤儿进程）；修复方向：stop 前先做端口探测补全 pid 记录（属 8900 控制域代码改动，需排期） |

## 规则

- 任务 ID 使用稳定格式 `前缀-三位序号`；前缀自然表达任务类型（ARCH=主线实现、REQ=请求、PLAN=计划、DEFECT=缺陷）。
- **类别**只允许 `主线 / 支线 / 长期`：主线 = 大类目标（由活跃计划/大任务承载，聚合多条支线）；
  支线 = 主线任务的细则，可独立完成；长期 = 持续存在、无单一终态的任务。定义与归属原则见
  [任务生命周期](../standards/task-lifecycle.md)。
- 状态只允许 `待开始 / 进行中 / In Progress / Blocked / 已完成`；阻塞必须声明证据、恢复条件
  和责任位置。
- 优先级只允许 `高 / 中 / 低`。
- 涉及子项目改造的请求在根仓库登记并标注目标仓库（`请求：<目标仓库>`），子项目在自己的 todo
  承接；根仓库不直接修改子项目文件（见
  [跨项目协作规范](../standards/cross-project-collaboration.md)）。
- Plan 行镜像 `docs/plans/` 活跃计划正文（标题、链接、状态、关联 Tracker）。
- 任务终态时从本表原子移除并写入 completed.md。
