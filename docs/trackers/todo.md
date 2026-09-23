# 任务台账

状态：Current
最后更新：2026-09-22

本文件登记根仓库未关闭任务，是活跃计划的镜像。详细计划见 [计划索引](../plans/index.md)；
已关闭任务见 [completed.md](completed.md)。

## 未关闭任务

### 第三轮主线·解析联调轮（ARCH-020）

推进顺序：准备（前端设计定稿已完成，晋升 design/parsing-ui.md；MinerU 模型已部署）→ 实现（ARCH-020-B/C/D）→ 验收（ARCH-020-E）→ 数据操作（ARCH-020-F）。
**2026-09-20 主线收口（Partial，用户裁决）**：实现面 B/C/D 与四轮界面迭代（UI/WB/G）全部
关闭归档；**E 已于 2026-09-22 部分验收关闭**（312 页生效版 `185a37d55985`，缺 5 页为 PDF 空白页，
根治留 REQ-087 独立跟踪，见 completed.md）；本区仅存续项独立跟踪——
F（axiom/xqfm 库删除剩余）、PLAN-044（剩余端点与联调承载）；**2026-09-23 REQ-086/087
收口（用户裁决 A＝以对方 PLAN-007 真机证据+回执为根侧关闭依据，Achieved 见 completed.md）**，
根侧业务口径全本实测（连带老代 `$$$` 产物数据侧自愈核验）转后续观察项，挂 ARCH-028 首次真机演练顺带做。

#### 准备（第一步）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| PLAN-044 | 支线 | 高 | In Progress | [文档解析管理·与 Axiom-Flow 交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md) | 8902 契约冻结 + 端到端验收；定稿后与 design/parsing-ui.md 合并评估归属（parsing-flow 位）；**2026-09-21 对方 REQ-001 复核材料读取登记（锚点 `95e1d37`）**：8902 af_* 新契约 + 版本布局回执已由本轮联调承接（生效指针/versions 语义/端点契约零变化见 REQ-080 行与 [api-contracts.md](../architecture/api-contracts.md)），对方关闭等用户转达 |

#### 验收与数据

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-020-F | 支线 | 中 | 进行中 | 数据操作（D 类）：qed 统一 + axiom/xqfm 库删除 + dataset 物理清理（axiom-flow/qed-tracker/math.rar/参考书籍） | 备份 + 演练 + 用户确认；**2026-09-20 dataset 清理已执行（用户裁决范围＝仅退役目录+meta 死数据）**：`dataset/axiom-flow/`、`dataset/qed-tracker/`（meta 11 JSON+marker）备份至 `dataset/backups/2026-09-20-arch020f/` 逐字节校验后删除，两 `.gitkeep` git rm 暂存（未提交）；math.rar（666MB）、tmp/参考书籍（1.2GB，用户自整理）、tmp 残留 `.download` 均保留不动；**剩余**：axiom/xqfm 库删除与 qed 统一待后续；**2026-09-20 移交登记**：QED-Tracker `config.py` `state_dir`（指向 `qed-tracker/meta/`）全仓库零消费者属死代码，请其随清理轮删除（Grep 证据见 [展示优化轮计划](../history/plans/2026-09/2026-09-20-parsing-display-round.md) W4） |

### 学习设计轮（第五轮·2026-09-23 重划：主链路主任务 + M1~M4 模块各配固定壳；原名学习中心轮，2026-09-22 并轮自原 ARCH-022 + 原 ARCH-026）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-027 | 主线 | 高 | In Progress | [学习设计轮·主链路（课程注册·链路编译·判分推进）（learning-design-mainline）](../plans/2026-09-22-learning-design-mainline.md) —— 第五轮主任务：QED-Engine 只做学习链路的展示与编排（检索下载归 Tracker、知识整理归 Axiom-Flow），主链路＝课程注册→链路编译→块学习推进→判分与掌握门→派生进度结课（掌握门与判分入主链，用户裁决 2026-09-23）；目标 = 一条课程链路端到端可用并向学习中心形态收敛 | 2026-09-22 并轮立项（ARCH-022/026、PLAN-051 Superseded 见 completed.md）+ 2026-09-23 用户裁决重划改名学习设计轮：M-1~M-3 拆解、L1~L9/R1 判定表（含各条承接壳列）与「只排根仓库、暂不向子项目发请求」边界由本壳承载；模块工作流迁 M1~M4 各壳 |
| ARCH-027-M1 | 支线 | 高 | Accepted | [学习设计轮 M1·学习面 UI 与渲染基线（learning-ui-rendering）](../plans/2026-09-23-learning-ui-rendering.md) —— 8903 学习面（书架/链路视图/看板/错题本页面）+ 渲染基线滚动线（承接原 PLAN-051/ARCH-026 渲染线与原 W6） | 2026-09-23 重划建壳；UI-1 渲染基线无前置可立即滚动，UI-2~4 前置＝主链 M-1 契约冻结 + M-2 首本编译产物；L9 选区追问交互在本壳评估 |
| ARCH-027-M2 | 支线 | 中 | Accepted | [学习设计轮 M2·练习与复习（出题·间隔复习·错题本）（practice-review）](../plans/2026-09-23-practice-review.md) —— 课后练习面：出题管线（L6）+ 间隔复习调度（L3 MySQL 化）+ 错题双写题库与错题本端点 | 2026-09-23 重划建壳（切分裁决＝判分/掌握门留主链 M-3 单一事实源，本模块只管题从哪来、何时复、错在哪）；前置＝主链 M-1 表契约 + M-3 判分规则层；真实出题调用依赖 M3 开关 |
| ARCH-027-M3 | 支线 | 高 | Accepted | [学习设计轮 M3·本地模型适配层（local-model-adaptation）](../plans/2026-09-23-local-model-adaptation.md) —— 网关降级组合移植（L7）：本地 binding 能力表、文本工具协议、JSON 容错+一次 repair、thinking 清洗、饥饿降 effort 重试、task model 兜底 | 2026-09-23 重划建壳（承载原 W5）；无排程前置可立即滚动，地基＝ARCH-023 registry 已交付；本壳开关全绿是主链 M-2 与 M2 出题的验收前置；与 ARCH-028 稳定性轮分轮：那边管服务启停/探测/水位，这边管调用协议与容错 |
| ARCH-027-M4 | 支线 | 低 | Accepted | [学习设计轮 M4·知识探索（问答与召回消费面，后置）（knowledge-exploration）](../plans/2026-09-23-knowledge-exploration.md) —— 轻形态先行（知识体系浏览维持 + ask_questions 澄清访谈入主链提案），对话式 RAG 问答消费面后置 | 2026-09-23 重划建壳；E3 启动条件＝Axiom-Flow 检索端点（其 PLAN-009 线）就绪且用户发令联调，届时按跨项目协作规范另发请求；本轮不发请求（用户裁决 2026-09-22） |
| REQ-070-LEARN | 支线 | 高 | In Progress | [学习功能现状（知识探索/课程学习/课后练习）](../plans/2026-09-10-learning-center-current-state.md) | REQ-070 重组轮 learning-center.md 移入改造的现状承载（知识探索已固定 + 课程学习探索 + 课后练习无设计声明）；**2026-09-22 随重组轮收尾移挂本节**（重组轮节退役）：作为学习设计轮（ARCH-027 及 M1~M4）重设计的现状基座（REQ-089 已收口，判定表落主链壳），设计确定后按 ADR 0011 晋升 design/，本现状壳退役 |
| REQ-006 | 主线 | 中 | 进行中 | QED-Engine 前端（8903）：主体学习界面 + 后台管理（仪表盘/知识体系/解析进度/文档对照/追溯） | 期次里程碑：三期（ARCH-003，111 passed）→ 四期（ARCH-004，119）→ 五期~十三期（ARCH-005，127→140，a5ce8c1 已验收）→ 十四期（ARCH-006，141，人工评审优化）→ 十五期（ARCH-007，150，文档下载课程分页）；逐期界面细节见 project-status 前端行与 history/plans/；管理后台已随 web-ui React 重构落地（ARCH-011 已实施）；学习中心部分归学习设计轮收尾（界面实施在其 M1 模块） |
| REQ-031 | 支线 | 低 | 待开始 | 使用手册完善（前端 web-ui）：当前手册（HELP_SECTIONS 迁移六节）内容粗略，待学习中心各功能稳定后逐界面细化（操作截图/分步图文/FAQ 扩充/五阶段流程配图） | 2026-08-16 用户标注：使用手册还不完善，**低优先级**，等后续完善；暂不阻塞前端重构主轮 |
| REQ-033 | 支线 | 低 | 待开始 | 仪表盘整体优化（前端 web-ui）：当前为过渡形态（四服务摘要 + 下载/解析上下大盘），待整个后台服务正常后梳理优化（布局细化、数据源扩充、图表增强，如解析大盘接 parse-jobs 真数据） | 2026-08-16 用户标注：仪表盘具体梳理等整个后台服务正常后再优化，**低优先级**；本轮仅完成四服务摘要/上下布局/去副标题 |

### 本地模型稳定性轮（ARCH-028）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-028 | 主线 | 高 | In Progress | [本地模型稳定性轮滚动记录（仪表盘状况卡·监督器·掉线根因·批次水位）](../plans/2026-09-23-local-model-stability-round.md) —— 本地模型服务稳定性轮：仪表盘「本地模型状况」卡（api 模式隐藏、单活守卫下恒单卡跟踪当前占位模型）+ 8900 常驻监督器（分级探测/防抖事件账/非在飞自动重启在飞只告警/显存水位门/掉线诊断包）+ 50 页/窗批次（根 .env 配 `AXIOM_PARSE_WINDOW_SIZE=50`）+ 图像模型掉线根因定谳；目标 = 本地模型「看得见、管得住、喂不饱不死」 | 2026-09-23 立项（用户三裁决：另开稳定性轮不入 ARCH-027 适配层／批次走 .env 配置不向对方发 REQ／恢复策略=非在飞自动重启+在飞只告警）；W0~W6 拆解与界面/监督器设计蓝图全部由壳承载；仪表盘状况卡自本行起由本轮承接（REQ-033 余下大盘优化仍低优先）；真机演练前置=Docker Desktop 起（用户侧） |

### QED-Tracker（V1.0）持续优化轮（ARCH-024）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-024 | 主线 | 中 | In Progress | [QED-Tracker V1.0 持续优化滚动记录（tracker-v1-continuous-optimization）](../plans/2026-09-22-tracker-v1-continuous-optimization.md) —— QED-Tracker（V1.0）持续优化轮：为其探索/下载链路的三线优化（本地模型链路、论文探索和下载、下载链路评估与 bug 修复）做逐条登记与跟踪，目标 = 8901 检索/下载链路持续改进并向 V1.0 收敛 | 2026-09-22 立项 + 同轮按新登记方式改单行（ADR 0016，原 ARCH-024 主线行 + PLAN-049 镜像行合并；三线定义、范围边界与进度全部由壳承载）；子项目侧实施归 QED-Tracker 仓库（根侧只登记请求与跟踪，见跨项目协作规范） |

### Axiom-Flow（V1.0）优化轮（解析 + 知识库）（ARCH-025）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-025 | 主线 | 中 | In Progress | [Axiom-Flow（V1.0）解析与知识库优化滚动记录（axiom-flow-v1-parsing-knowledge-optimization）](../plans/2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md) —— Axiom-Flow（V1.0）优化轮（解析 + 知识库）：对解析产物「大模型易消费 JSON」与知识库面（af_* 演进、RAG 切片和检索预留）两线优化做逐条登记与跟踪，目标 = 解析管线与知识库面向 V1.0 收敛（优化项目划分 P1~P5/R1~R6 与 V1.0 目标形态见壳） | 2026-09-22 立项 + 同日裁决（**启动门槛＝对方达 V1.0**；整合承接原 ARCH-021 的 RAG 切片与检索规划；**知识图谱暂不做**）+ 同轮按新登记方式改单行（ADR 0016，原 ARCH-025 主线行 + PLAN-050 镜像行合并；范围边界、渲染归学习设计轮（ARCH-027-M1，原 ARCH-026）、REQ-086/087 复测三前置等细节全部由壳承载）；子项目侧实施归 Axiom-Flow 仓库；2026-09-22 用户裁决：优化项 P1~P3/R1~R4 已下沉 Axiom-Flow 登记为其 1.0 版本任务（该仓库 ARCH-021/022/023 + PLAN-009，只立项不排期），本壳转消费/联调验证跟踪 |

### 长期任务

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| REQ-062 | 长期 | 中 | 进行中 | **AI 开发指引优化（2026-08-26 登记，同日用户裁决改收件箱机制）**：四段式——① **捕获**：大任务完成后把 agent 利用经验写入 [ai-agent-knowledge-inbox.md](../plans/ai-agent-knowledge-inbox.md)（长期滚动收件箱，不随任务归档；可手动要求补充）；② **审核**：三判据（复用价值/非瞬时状态/未被正式文档覆盖）逐条过，任一不满足不入池；③ **批量晋升触发**：待评审 ≥10 条或单主题聚集 ≥3 条或每月例行（先到为准）；④ **体系优化**：分析轮聚类产出结构性结论，修订正式文档乃至开发流程。首批内容已落 development.md「环境准备（AI 开发速查）」节 | 收件箱已建立 + 首批 1 条待评审（8900 改码后须重启）；持续进行无单一终态；每次入池/晋升后运行 tests/contract 门禁；**2026-09-10 体系优化轮执行**：REQ-069 AI 开发守则整合轮（AGENTS.md 变更分级边界 + development.md 六步流程 + design-bugfix-log 台账，ADR 0012） |
| REQ-046 | 长期 | 高 | 进行中 | API 接口开发：先确定接口类型，按类型写 API 文档落入各自项目——① QED-Engine 前端无 API（静态页面只连 8900，声明于 [api-contracts](../architecture/api-contracts.md)）；② QED-Engine 后端三类（控制域启停/重启/健康、QED-Tracker 透传及相关处理、Axiom-Flow 透传及相关处理）；③ QED-Tracker 三类（自身生命周期+健康、数据库知识查询传递、LLM 检索课程教程/选书业务）；④ Axiom-Flow 四类（生命周期+健康、数据查询、解析结果与 PDF 对照、未来 RAG/知识图谱预留）；检查是否有遗漏；关联 ARCH-012（全流程跑通 + Axiom-Flow 完成前端验收 + 流程完整走完为止） | 第一步（接口类型确认 + QED-Engine 文档落位）随 ARCH-018 完成（architecture/api-contracts.md 已落位、前端无 API 已声明）；子项目 API 文档经请求由对方执行（Axiom-Flow / QED-Tracker todo 承接）；**2026-08-31 范本化重排**：api-contracts.md 按 QED-Tracker api.md 结构重排（概述分类表 + 逐端点请求/返回/错误 + 统一错误码表），补齐 REQ-067 `/domains/import`、`/domains/{id}/explore`、`/domains/{id}/confirm-name`，删过时注记、修正 8902 契约事实源引用，转正已确认；**2026-09-14 ARCH-020 重构**：Axiom 数据透传组随新契约修订（规划端点见 [交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md)） |
| REQ-047 | 长期 | 高 | 进行中 | 数据库设计：QED-Engine [database-design](../architecture/database-design.md) 为总纲（qed_* 共享表族完整；qt_*/af_* 部分置空，提示先查子项目数据库文档）；QED-Tracker 定义自身完整数据库定义（docs/architecture/database-private-tables.md（qt_*）与 database-shared-tables.md（qed_*）唯一事实源，REQ-026 已回执）；Axiom-Flow 定义 af_* 完整数据库定义（REQ-027 已关闭，2026-09-20），通过文档 + 单独数据库管理体系管理 | QED-Engine 总纲随 ARCH-018 落位（2026-08-20，ADR 0010 版本机制）；子项目数据库文档由各自仓库维护（各项目 Alembic 独立初始化自己的表，qed_* 共享表所有权 QED-Tracker）；**2026-08-31 范本化 + af_* 补登记**：database-design.md 对齐范本骨架（需求方/唯一事实源声明/决策记录），af_* 行刷新为由 Axiom-Flow database-design.md 登记（V2-013 规划契约），关联代码补 qed_llm_calls 建表方，转正已确认；**2026-09-14 ARCH-020 重构**：af_* 重定义为四表（af_books/af_parse_jobs/af_pages/af_block_edits），总纲登记 |
| REQ-050 | 长期 | 中 | 进行中 | 版本更新文档体系重新梳理（2026-08-21 ARCH-018 收尾登记，ADR 0010 版本机制）：每次版本更新（用户确认升版本时）按 ADR 0010 重新梳理三项目文档体系——architecture/ 固定化维护（总体/服务架构/API/数据库/code-map）、guides 操作与开发文档、trackers 主线归并（完成→completed.md）、design 三态梳理、plans 归档、子项目范本对齐跟进（REQ-048/049 同源） | 随 ARCH-018 关闭登记；每次版本末期触发，不单独设排期；子项目对齐经请求由对方执行 |
| OPS-001 | 支线 | 低 | 待开始 | 服务域 stop 对外部实例失效（2026-09-22 长期审核改类：实缺陷待排期非无终态流程，类别长期→支线，暂留本节便于排期）（2026-08-26 两次复现：REQ-061 验证轮 + Phase A 清库轮）：外部启动的 8901 被 POST /services/tracker/stop 时记录 pid=null，杀不到真进程（stop 返回 stopping 但端口仍监听）；需直杀监听 PID 后服务域 start 重新纳管 | 复现条件：8901 非经服务域启动（如手动 python -m uvicorn 或脚本单元启停语义缺陷导致的孤儿进程）；修复方向：stop 前先做端口探测补全 pid 记录（属 8900 控制域代码改动，需排期） |

## 规则

- 任务 ID 使用稳定格式 `前缀-三位序号[-后缀]`（后缀可选，用于子项分组，如 `REQ-070-PARS`）；前缀自然表达任务类型（ARCH=主线实现、REQ=请求、PLAN=计划、DEFECT=缺陷；ADR 0016 起 `PLAN` 前缀不再新发用于任务行，存量行保留至关闭）。
- **类别**只允许 `主线 / 支线 / 长期`：主线 = 大类目标（由活跃计划/大任务承载，聚合多条支线）；
  支线 = 主线任务的细则，可独立完成；长期 = 持续存在、无单一终态的任务。定义与归属原则见
  [任务生命周期](../standards/task-lifecycle.md)。
- 状态只允许 `待开始 / 进行中 / In Progress / Blocked / 已完成`；阻塞必须声明证据、恢复条件
  和责任位置。
- 优先级只允许 `高 / 中 / 低`。
- 涉及子项目改造的请求在根仓库登记并标注目标仓库（`请求：<目标仓库>`），子项目在自己的 todo
  承接；根仓库不直接修改子项目文件（见
  [跨项目协作规范](../standards/cross-project-collaboration.md)）。
- 每个活跃计划由其**唯一任务行**镜像 `docs/plans/` 计划正文（标题、链接、状态、关联 Tracker）；
  任务列链接后可用「——」追加一句话任务定义/目标效果，不再另设 PLAN 镜像行（ADR 0016，
  一任务一行一壳；进度与细节由计划壳承载）。
- 任务终态时从本表原子移除并写入 completed.md。
