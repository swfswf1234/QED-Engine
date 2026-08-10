# 任务台账

状态：Current
最后更新：2026-08-11

本文件登记根仓库未关闭任务，是活跃计划的镜像。详细计划见 [计划索引](../plans/index.md)；
已关闭任务见 [completed.md](completed.md)。

## 未关闭任务

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| ARCH-002 | 主线 | Plan | 高 | Accepted | [2026-08 教材下载轮计划（textbook-download-round）](../plans/2026-08-textbook-download-round.md) | 计划状态 Accepted；三线工作项由子项目 todo 承接（QED-008~016、ALN-001~007），联调验收后关闭 |
| ARCH-004 | 支线 | Plan | 高 | Accepted | [2026-08 管理后台信息架构重设计（admin-redesign-v4）](../plans/2026-08-8903-admin-redesign.md) | 计划状态 Accepted；2026-08-06 用户确认（卡片墙/严格三领域/树主评估窄/详情评估视角）；**四期完成（119 passed + ruff clean + 8901 三态冒烟）**：卡片墙入口、三领域（拓扑/考前并入分析）、树拖拽记忆（qed-tree-w）、领域/课程/状态与任务筛选、详情评估视角；Phase 0（QED-017 提交 5f7c015 + 8901 重启 pid 6772）完成；待用户浏览器验收后归档 |
| ARCH-006 | 支线 | Plan | 高 | Accepted | [2026-08 人工评审优化轮（review-round-v6）](../plans/2026-08-review-round.md) | 计划状态 Accepted；2026-08-07 用户确认（同源去重/去尾部评估任务/人工建议落库/存量清理）；REQ-018 请求 QED-Tracker 承接；REQ-006 承接前端执行 |
| ARCH-007 | 支线 | Plan | 高 | Accepted | [2026-08 文档下载管理课程分页计划（downloads-course-view）](../plans/2026-08-downloads-course-view.md) | 计划状态 Accepted；2026-08-07 用户确认（界面名回退/默认数学领域/领域级课程分页每页 3 门/配套对并排）；REQ-006 承接执行；待用户浏览器验收后归档 |
| ARCH-009 | 支线 | 实现 | 高 | 进行中 | 后端网关化重构轮（ADR 0007）：前端唯一入口 8900——目录重整（backend/、database/、tmp/、scripts/）、数据域语义 API（data.py）、服务域 /services 实装（service_manager.py）、前端唯一入口切换（app.js）、文档同步 | **2026-08-11 P0-P5 全部完成并冒烟闭环（181 passed + ruff clean + node check）**：ADR 0007 落地；backend/ 迁移 + database/ 建库运维脚本 + start-all/stop-all；tracker_client 扩展（catalog/file/register + 409 detail）；code-map 登记两个新模块；服务管理测试 14 个（含 workdir 几何守护 + Popen 失败句柄守护）；唯一入口测试守护；文档同步（service-contracts/config-center-api/service-control/web-frontend/four-service-architecture/project-status/README/AGENTS/guides/development）；**真实冒烟验证**：数据域真实数据（catalog/30 资源/15 任务）、/services 启停托管闭环（start→online PID 984、窗口内重复 start 409、stop 优雅退出、restart→online PID 9244）、409/422/404 语义、修复 ROOT parents 层级错位（WinError 267）与 Popen 失败句柄泄漏；剩余：用户验收（浏览器 + 服务域操作）后归档 |
| REQ-001 | 支线 | 请求 | 高 | 待开始 | Axiom-Flow 端口 8000 → 8902 迁移（启动命令、README、指南、CORS）（请求：Axiom-Flow） | Axiom-Flow todo ALN-002 承接；用户已确认（2026-08-04），B 类计划 ALN-007 执行 |
| REQ-002 | 长期 | 实现 | 中 | 进行中 | 文档治理持续演进：标准/ADR/计划/台账与契约测试随需求同步更新（ADR 0001 已落地） | 每次文档变更前运行 `tests/contract/` 门禁 |
| REQ-003 | 支线 | 请求 | 高 | 待开始 | Axiom-Flow 数据目录指向根 dataset/axiom-flow/parsed、直读 QED_* 变量（含 QED_DB_*，qed 库）（请求：Axiom-Flow） | Axiom-Flow todo ALN-003 承接；用户已确认（2026-08-04），B 类计划 ALN-007 执行 |
| REQ-004 | 支线 | 请求 | 高 | 进行中 | QED-Tracker 服务化 8901：API + 后台任务 + 轮询；数据根迁 dataset/qed-tracker/（请求：QED-Tracker） | **2026-08 回执：服务化轮 QED-008~010 完成、8901 已服务化（写操作后台任务 + 轮询），数据根已迁 dataset/qed-tracker/（QED-009 落地）**；剩余：QED-014 全链路联调冒烟与根仓库 8901 客户端联调验收后关闭 |
| REQ-005 | 支线 | 实现 | 高 | 待开始 | Axiom-Flow web/ 前端迁入根仓库 web/，子项目退役 web/ | 用户评审 ADR 0002 后启动前端迁移轮 |
| REQ-006 | 主线 | 实现 | 中 | 进行中 | QED-Engine 前端（8903）：主体学习界面 + 后台管理（仪表盘/知识体系/解析进度/文档对照/追溯） | 三期完成（ARCH-003，111 passed）；**四期完成（ARCH-004，119 passed）**：卡片墙入口、严格三领域、树主评估窄+拖拽记忆、筛选栏、详情弹窗评估视角；**五期完成（ARCH-005，127 passed + ruff clean）**：入口页零后台痕迹（服务状态卡移入仪表盘）、内置使用手册弹窗、仪表盘四阶段流水线+服务健康分组面板（问题文案）、知识体系四级树（领域自适应+（N本）计数）、按钮弹层筛选器（浅底深字）；**六期调整（127 passed + ruff clean）**：取消「模块总览」卡片墙（#/admin 直达仪表盘）与「追溯」界面（#/admin/trace 及菜单移除），侧边栏收敛为 仪表盘/知识体系/解析进度/原始文档对照 四项独立界面；**七期（131 passed + ruff clean）**：修复管理视图互斥显示（.view 显隐规则 + 回归守护），界面改名 仪表大盘/文档下载管理/文档解析进度；**八期（131 passed + ruff clean）**：健康面板语义收敛——后台服务（QED-Tracker 文档下载服务/Axiom-Flow 文档解析服务/QED 管理服务 后台管理服务 备注）、LLM配置（只显示 /config/models 当前配置模型）、数据库配置（仅 MySQL，向量库占位移除，横幅同步）；**九期（132 passed + ruff clean）**：LLM配置 收敛为三个实际使用模型（主模型/视图模型/Embedding，切换档 GLM 与占位档 DeepSeek 不显示）、后台服务在线仅绿点+名称不写原因（离线附原因）；**十期（133 passed + ruff clean）**：仪表大盘流水线改为按课程统计——总课程数由 catalog targets 去重 course_id 动态计算（移除硬编码 13），发现下载=课程有任一资源（宽松，3/13）、评估确认=课程内候选全部评估完毕（严格，0/13），阶段数字显示「已完成 X / N 课程」；**十一期（136 passed + ruff clean）**：知识点界面改版——改名「知识点」、三层知识链路树（领域→课程→书籍，无总根）、课程按学习深度排序（COURSE_ORDER 表）、书籍类型徽标（教材/习题集/资料）、课程完成判定（≥1 教材+≥1 习题集均 approved）、PyCharm 式树交互（箭头展开/名称选中分离 + 缩进引导线）、树默认 400px 固定（28 寸优先，拖拽 280-640px）；**十二期（138 passed + ruff clean）**：面板展示范围全部书籍（未评估目标「待评估」占位卡）、树→筛选器单向联动（点领域/课程同步弹层筛选）、课程筛选项随领域收窄；**十三期（140 passed + ruff clean）**：控制台化——选中课程出现课程操作条（「① 搜索书籍」按课程发起 AI 搜索评估 + 搜索→确认→下载→验收 步骤进度条，1s 轮询刷新），工具栏全局「触发评估」移除；修复树行点击事件冒泡（点课程误选为领域 bug）；8900 角色评审结论（保留：配置语义代理/状态探测/子项目契约）记录于 service-contracts.md；8900/8901 实测在线；**十四期（ARCH-006，141 passed + ruff clean + JS OK）**：人工评审优化——① 知识点界面尾部「评估任务」区块（任务列表+三个筛选器）移除（课程操作条步骤条保留，任务数据仅用于步骤条）；② 资源卡三态按钮旁新增评审建议输入框（选填），随确定/备选/否定一并提交 note 落库（8901 confirm/backup/reject 增可选 note，qt_resources.review_note），卡片与详情展示既有建议；ARCH-005 归档（五期~十三期已提交 a5ce8c1 并验收）；待用户浏览器验收（无评估任务列表/步骤条保留/建议输入框提交）与 QED-Tracker REQ-018 回执后归档；**十五期（ARCH-007，150 passed + ruff clean）**：文档下载管理界面回归——① 菜单+标题改回「文档下载管理」（树头保留「知识点」）；② 进入默认选中「数学」领域；③ 领域级右侧按课程分页（每页 3 门、左右等高），课程级/书籍级保持现状；④ 同课程配套教材+习题集（同作者）并排同一行；待用户浏览器验收后归档 |
| REQ-008 | 支线 | 实现 | 中 | 待开始 | Axiom-Flow OCR 多后端：qwen-vl-plus → glm-ocr 适配（请求：Axiom-Flow） | 已补登记 Axiom-Flow todo ALN-005（跨项目），用户确认后由其仓库执行；**备选线路（2026-08-09 用户裁决：一次只用一个模型，GLM_MODEL/GLM_OCR_MODEL/DEEPSEEK_MODEL 暂注释于 .env.example），启用备用线路时恢复** |
| REQ-009 | 支线 | 实现 | 低 | 待开始 | deepseek 接入：DEEPSEEK_API_KEY 配置后启用 deepseek-v4-flash 路由 | 用户账户可用后处理 |
| REQ-010 | 长期 | 流程 | 中 | 进行中 | 跨项目协作流程演练：向 Axiom-Flow/QED-Tracker 登记改造请求 todo | 双方回执并关闭其 todo 后完成 |
| REQ-013 | 支线 | 请求 | 高 | 待开始 | QED-Tracker MySQL 资源登记与状态机：qt_resources 表（含 llm_evaluation/catalog_ref/留痕字段）+ confirm/reject/approve 同步端点 + /resources/{id}/file 预览（请求：QED-Tracker） | QED-Tracker todo QED-012/QED-016 承接；2026-08-04 用户裁决统一 qed 库；2026-08-05 人机协同闭环裁决（人工确认后下载、删除硬删+DB 留痕）；**2026-08-06 回执：QED-012/QED-015/QED-016 已实现、QED-017 三态（backup/转正/放弃）已提交 5f7c015 并重启 8901 实测**；剩余：8903/CLI 联调验收（QED-014 冒烟）随本项完成 |
| REQ-014 | 支线 | 请求 | 高 | 待开始 | 基础书单 math-qe-v2 + LLM 筛选评估：按课程批量评估任务（搜索源+LLM 评估+候选落库），前端人工确认后才下载（请求：QED-Tracker） | QED-Tracker todo QED-013/QED-015 承接；每课程两组、宁缺勿滥、中文书 pending_manual；候选级拒绝可跳过；**2026-08-06 回执：QED-013 已实现（13 门课程书单 + evaluate 按课程批量落候选）**；剩余：QED-014 全链路联调验收 |
| REQ-015 | 支线 | 请求 | 中 | 待开始 | Axiom-Flow 读取 dataset/qed-tracker/raw/ 的批量导入解析接口（Phase 2 前置；请求：Axiom-Flow） | Axiom-Flow todo ALN-006 承接；教材下载轮联调后确认，拆 B/D 类计划执行 |
| REQ-016 | 支线 | 实现 | 中 | 进行中 | LLM 可达性探测：8900 新增 `/config/llm-status`（真实探测 models 接口、5s 超时、60s 缓存、未配置不探测、密钥绝不下发），8903 横幅由 key 布尔改为可达性展示 | 2026-06 完成：端点+探测+缓存已实现（tests 105 passed、ruff 通过），8900 实测 qwen/glm 可达、deepseek 未配置；前端横幅已切换；契约见 docs/design/config-center-api.md；归档条件：用户浏览器验收 8903 横幅与详情弹窗 |
| REQ-017 | 支线 | 请求 | 高 | 待开始 | QED-Tracker 服务化遗留三缺口（请求：QED-Tracker）：① 仓库内提供正式启动入口（当前用临时 serve_tracker.py，README 无记录）；② 评估任务进度上报（当前仅 30%/100% 两档，长任务无法观察中间状态）；③ 服务重启后 running 任务恢复（当前需人工干预） | 在 QED-Tracker 仓库建设计文档+todo 任务，用户评审确认后由对方执行 |
| REQ-018 | 支线 | 请求 | 高 | 待开始 | 人工评审优化（请求：QED-Tracker）：① evaluate 同源去重——同 provider_id 命中多个目标只登记第一条，其余 skipped 报告（数学分析陈纪修 教材/习题集同 archive 条目重复登记问题）；② qt_resources 增加 review_note 字段，confirm/backup/reject 三接口接受可选 note 参数落库；③ 存量重复清理——陈纪修 exercise candidate（cand_c8977caa0b358ebd71dd0bd585341dd3）与教材 confirmed 同源（archive math_analysis_chenjixiu），经 reject 接口标记 rejected（原因注明重复，留痕） | QED-Tracker todo QED-020 承接；用户 2026-08-07 已确认方案（计划 docs/plans/2026-08-review-round.md）；在其仓库建设计文档+todo 请求，用户评审确认后由对方执行 |
| REQ-019 | 支线 | 请求 | 中 | 待开始 | 版本核对（请求：QED-Tracker，设计见 [course-acquisition-flow.md](../design/course-acquisition-flow.md) 阶段 3）：下载验收的系统预检增加「登记版本 vs PDF 首页标题」自动核对，不一致提示人工确认（依赖登记数据含版本字段或可推导） | 用户 2026-08-09 确认设计（管理功能轮第 2 节，登记请求）；由其仓库承接，回执后关闭 |
| REQ-020 | 支线 | 请求 | 中 | 待开始 | 榜单数据收集（请求：QED-Tracker）：① 找资料权威性榜单（各教材/版本在数学社区权威性排序，服务第一轮评估选书）；② 找书找得率榜单（各来源渠道命中率/下载成功率实测，回填 QED-Tracker source-discovery 矩阵） | 用户 2026-08-09 确认（管理功能轮设计，见 [course-acquisition-flow.md](../design/course-acquisition-flow.md) 相关榜单小节，执行主体为 QED-Tracker）；产出回填阶段 1 选书规则，不单独建界面；由其仓库承接，回执后关闭 |
| REQ-021 | 长期 | 流程 | 中 | 进行中 | 大变动同步：项目发生大的变动（架构/定位/服务形态变化）时，同步修订 README.md 与 AGENTS.md 的定位与状态表述，保持对外门面与现状一致 | 2026-08-09 用户决定登记；**2026-08-11 ADR 0007 轮已同步 README（四服务表/mermaid/快速开始/仓库结构）与 AGENTS（服务表后端三域）**；每次大变动评审时执行，与文档治理门禁（REQ-002）协同 |
| REQ-022 | 支线 | 请求 | 低 | 待开始 | 治理契约范本对齐（请求：Axiom-Flow）：按根仓库 [governance-contract.md](../standards/governance-contract.md) 范本对齐治理契约测试（契约头六字段/守护面清单/编写约定） | 2026-08-09 用户确认范本化设计（ADR 0006）；**2026-08-10 已建设计文档（Axiom-Flow docs/design/governance-contract-alignment.md）并登记 ALN-008 承接**；用户评审确认后由其仓库执行，回执后关闭 |
| REQ-023 | 支线 | 请求 | 低 | 待开始 | 治理契约范本对齐（请求：QED-Tracker）：按根仓库 [governance-contract.md](../standards/governance-contract.md) 范本对齐治理契约测试（契约头六字段/守护面清单/编写约定） | 2026-08-09 用户确认范本化设计（ADR 0006）；**2026-08-10 已建设计文档（QED-Tracker docs/design/governance-contract-alignment.md）并登记 QED-022 承接**；用户评审确认后由其仓库执行，回执后关闭 |
| REQ-025 | 长期 | 流程 | 中 | 进行中 | 四类设计文档实时同步：架构设计（four-service-architecture.md）、API 契约（config-center-api.md / service-contracts.md）、数据库设计（database-design.md）、技术栈选型（tech-stack.md）随实现状态与决策变化**先文档后实现**更新，变更后运行契约门禁；与 REQ-002（文档治理持续演进）协同，ARCH-008 重构轮完结后由本任务持续承接 | 2026-08-09 用户确认登记；**2026-08-11 ADR 0007 轮已同步四服务架构（mermaid/服务表/符合度）、config-center-api（数据域/服务域章节 + ADR 0007）、service-contracts（前端只连 8900 冻结）**；每次影响架构/API/数据库/技术栈的实现与决策变更时执行，project-status 当前主线同步记录 |
| REQ-026 | 支线 | 请求 | 中 | 待开始 | 数据库设计确认（请求：QED-Tracker）：qt_* 表结构（qt_resources 明细与后续新增表）由 QED-Tracker 确认并维护（其 docs/design/tracker-service.md），回执后根仓库 [database-design.md](../design/database-design.md) 按「指引与规划」收尾 | 2026-08-09 用户裁决（数据库设计先在各子项目确认，根仓库只做指引和规划）；**2026-08-10 已建设计文档（QED-Tracker docs/design/database-schema-ownership.md）并登记 QED-023 承接**；由其仓库确认与回执后关闭 |
| REQ-027 | 支线 | 请求 | 中 | 待开始 | 数据库设计确认（请求：Axiom-Flow）：af_* 表清单与结构由 Axiom-Flow 设计确认，确认后回执根仓库 [database-design.md](../design/database-design.md) 补登记表清单 | 2026-08-09 用户裁决（数据库设计先在各子项目确认，根仓库只做指引和规划）；**2026-08-10 已建设计文档（Axiom-Flow docs/design/database-schema-ownership.md）并登记 ALN-009 承接**；由其仓库确认与回执后关闭 |

## 规则

- 任务 ID 使用稳定格式 `前缀-三位序号`；类型包括 Plan、请求、实现、评审、验证、流程。
- **类别**只允许 `主线 / 支线 / 长期`：主线 = 大类目标（由活跃计划/大任务承载，聚合多条支线）；
  支线 = 主线任务的细则，可独立完成；长期 = 持续存在、无单一终态的任务。定义与归属原则见
  [任务生命周期](../standards/task-lifecycle.md)。
- 状态只允许 `待开始 / 进行中 / In Progress / Blocked / 已完成`；阻塞必须声明证据、恢复条件
  和责任位置。
- 优先级只允许 `高 / 中 / 低`。
- 涉及子项目改造的请求在根仓库登记并标注目标仓库（`请求：<目标仓库>`），子项目在自己的 todo
  承接；根仓库不直接修改子项目文件（见
  [跨项目协作流程](../standards/cross-project-collaboration.md)）。
- Plan 行镜像 `docs/plans/` 活跃计划正文（标题、链接、状态、关联 Tracker）。
- 任务终态时从本表原子移除并写入 completed.md。
