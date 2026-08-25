# 任务台账

状态：Current
最后更新：2026-08-23

本文件登记根仓库未关闭任务，是活跃计划的镜像。详细计划见 [计划索引](../plans/index.md)；
已关闭任务见 [completed.md](completed.md)。

## 未关闭任务

### 第一轮主线·架构确定轮（ARCH-018）

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| DEFECT-001 | 支线 | 实现 | 低 | 待开始 | `test_services_restart_externally_running_script_unit` 环境依赖失败（2026-08-21 门禁发现）：8901 离线时测试必失败（409）——`control.py` 经 `from ... import _probe_http` 直接绑定原函数，测试仅 monkeypatch `sm._probe_http`，路由真实探测 8901=False 跳过 stop → 内部 `_start` 用被 patch 全局=True → 409；8901 在线时反而通过（历史 294 passed 记录时服务在线） | 修复方向：测试补 patch `control._probe_http`，或路由改经 `sm._probe_http` 取模块属性（保持对外契约）；后续轮次顺手修复，不阻塞 |

### 第二轮主线·课程下载轮（ARCH-019）

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| ARCH-019 | 主线 | 实现 | 高 | 进行中 | 第二轮主线：课程下载轮（基于 ARCH-002 扩展）——三门基础课（00 概率论与数理统计 / 01 数学分析 / 02 高等代数）下载，与 QED-Tracker 联动（QED-026 主链路），local 和 api 模式界面调试成功；探索按钮（写文档 / 打开文档 / 直接开始）→ LLM 检索最合适教程（教材 + 对应习题集，按规范）→ 结果界面用户选择（未选进待选）→ 确定后进入下载流程（QED-Tracker 自寻渠道，找不到列举渠道请求用户自下，用户下载完提供链接）→ 审核流程（QED-Tracker 审核后人工确认一次）；通过剩余两门基础课下载同步完成。**2026-08-23 启动**：数据前置轮已关闭（PLAN-019 归档 [arch019-data-foundation](../history/plans/2026-08/2026-08-arch019-data-foundation.md)，REQ-051/052 入 completed.md，快照库 qed_snapshot_20260823 留存清理前数据）；探索两计划已立（[exploration-ui](../plans/2026-08-arch019-exploration-ui.md) 活跃 / exploration-api 已按 Delete 判定移除——契约事实并入 [api-contracts](../architecture/api-contracts.md)）；上限规则固化：每课教程 ≤4、≥2 套审核完成后停探 | **前置调整（2026-08-23 用户裁决）**：清库重走一轮取代原「QED-026 三门闭环 + QED-014 冒烟」前置（旧数据备份后清理重走）；ARCH-002 验收并入本主线 |
| REQ-053 | 支线 | 实现 | 高 | 进行中 | 课程探索前端（计划 [exploration-ui](../plans/2026-08-arch019-exploration-ui.md)）：入口按钮（左树 🔍 + 树顶 ⊕）、参数 Modal 三模式、独立确认页（`#/admin/downloads/explore`，课程层+领域探索视图）、store/API 客户端、≤4/≥2 锁定交互、离线降级、使用手册节；**2026-08-23 用户指令启动实现**，QED-Tracker 未就绪部分 mock 先行留白待对接 | **实现完成（2026-08-23）待浏览器验收**：契约类型+8 端点函数、explore store（轮询/上限/颜色 selector/openRun 恢复）、mock 后端（dev 环境自动开启，显式设 0 关闭）、ExploreLaunchModal（三模式+领域变体）、Explore 页（状态机/推荐卡/勾选上限/历史/failed 重试/领域 diff 应用与 conflicts）、树 hover 🔍+色点三态、**左栏底部「添加领域」固定按钮（页头 ⊕ 已移除）**、右侧顶部同色按钮（锁定禁用+Tooltip）、路由+HELP 节+样式；**二轮反馈落地**：余量数字默认不展示（VITE_SHOW_EXPLORE_SLOTS=1 可开，上限禁用逻辑保留）、mock 采纳/应用本地注入下载树（草稿教程行+新课程目录，方案 A）；门禁：vitest 22 文件 150 passed + tsc 零错 + build 成功 + 根仓库 300 passed |
| PLAN-020 | 支线 | Plan | 高 | In Progress | [课程探索界面设计计划（ARCH-019·重点交付）](../plans/2026-08-arch019-exploration-ui.md) | 承载 REQ-053/054；2026-08-23 用户评审裁决 A~F 已并入（⊕=新建领域探索/双入口同色联动/仅勾选取舍/颜色规则）；用户指令启动实现（REQ-053 进行中，mock 先行）；确定后界面契约并入 web-frontend.md 与 course-acquisition-flow.md |
| REQ-057 | 支线 | 请求 | 中 | 进行中 | **请求：QED-Tracker / Axiom-Flow**——ADR 0011 规则同步回执（2026-08-23 用户指令同步，根仓库 agent 直接执行文档改动）：QED-Tracker 已建 `docs/adr/0003-pending-design-location.md` + adr/index 登记 + documentation.md design/plans 两行修订 + **tests/test_documentation.py 白名单补 1 行（属代码改动，登记移交对方审阅后自行提交）**，验证：test_documentation.py 8 passed、全量 249 passed/3 skipped；Axiom-Flow 已建 `docs/adr/0002-pending-design-location.md` + adr/index + documentation.md 两行修订（无测试白名单需求），验证：tests/contract 56 passed | 双方审阅接受并自行提交（或按各自治理调整）后回执关闭 |
| REQ-058 | 支线 | 请求 | 中 | 进行中 | **请求：QED-Tracker**——探索契约承接传递（2026-08-23 用户指令，契约已冻结）：根仓库 agent 在对方仓库建 `docs/plans/2026-08-exploration-api-adoption.md`（承接设计，引用冻结契约）+ todo QED-040/041 承接条目 + plans/index 登记；**tests/test_documentation.py REQUIRED_CURRENT_DOCS 补 1 行（属代码改动，移交对方审阅后自行提交）**；对方仓库门禁自验通过 | 对方评审接受（含白名单行）并自行提交后回执关闭 |
| ARCH-002 | 主线 | Plan | 高 | Accepted | [2026-08 教材下载轮计划（textbook-download-round）](../plans/2026-08-textbook-download-round.md) | 计划状态 Accepted；三线工作项由子项目 todo 承接（QED-008~016、ALN-001~007）；**QED-014 全链路联调冒烟与 QED-019（01 数学分析闭环）待执行**（REQ-004/013/014 验收已并入本主线，2026-08-16 ARCH-013 轮），联调验收后关闭 |
| REQ-017 | 支线 | 请求 | 高 | 进行中 | QED-Tracker 服务化遗留三缺口（请求：QED-Tracker）：① 仓库内提供正式启动入口（当前用临时 serve_tracker.py，README 无记录）；② 评估任务进度上报（当前仅 30%/100% 两档，长任务无法观察中间状态）；③ 服务重启后 running 任务恢复（当前需人工干预） | **①已完成并回执（2026-08-17，QED-032）**：`scripts/qed_tracker_service.py`（start/stop/restart/status，PID 文件 + 优雅停止 + taskkill 强杀兜底 + --wait 健康等待，退出码 0/1/2；设计 service-lifecycle.md Accepted/Implemented），tests/test_service_scripts.py 19 passed + ruff clean，真实 8901 冒烟通过（start→health 200→stop）；提交 40a1248（脚本+测试）、f6f219e（文档治理）及 SystemError 兜底修复；**8900 侧接入由根仓库执行（service_manager tracker 单元黑盒调脚本）**；②③ 仍待开始（②需长任务进度中间档，③需 running 任务恢复机制，均待 QED-Tracker 建 todo 承接） |
| REQ-019 | 支线 | 请求 | 中 | 待开始 | 版本核对（请求：QED-Tracker，设计见 [course-acquisition-flow.md](../design/course-acquisition-flow.md) 阶段 3）：下载验收的系统预检增加「登记版本 vs PDF 首页标题」自动核对，不一致提示人工确认（依赖登记数据含版本字段或可推导） | 用户 2026-08-09 确认设计（管理功能轮第 2 节，登记请求）；由其仓库承接，回执后关闭 |
| REQ-020 | 支线 | 请求 | 中 | 待开始 | 榜单数据收集（请求：QED-Tracker）：① 找资料权威性榜单（各教材/版本在数学社区权威性排序，服务第一轮评估选书）；② 找书找得率榜单（各来源渠道命中率/下载成功率实测，回填 QED-Tracker source-discovery 矩阵） | 用户 2026-08-09 确认（管理功能轮设计，见 [course-acquisition-flow.md](../design/course-acquisition-flow.md) 相关榜单小节，执行主体为 QED-Tracker）；产出回填阶段 1 选书规则，不单独建界面；由其仓库承接，回执后关闭 |
| REQ-028 | 支线 | 请求 | 中 | 待开始 | 套标记字段（请求：QED-Tracker，设计见 [course-acquisition-flow.md](../design/course-acquisition-flow.md) 前端对齐契约第 1 条）：catalog target 增加 `set_no` 可选字段（"1"~"4" 中文套 / "en" 英文对照套 / 留空无配套），math-qe.json 54 目标补齐，API 透出，支撑前端两套判定 | 2026-08-12 已建设计文档（QED-Tracker docs/design/catalog-set-field.md）并登记 QED-024 承接；用户评审确认后由其仓库执行；**前端侧已先行实现（对齐契约 1-3：两套判定 courseCompletion/setNoOf + 套数 x/2 进度文案、版本徽标 versionBadge（中译本/英文版/苏版/其他 + 苏版名单常量）、使用手册五阶段节，tests 185 passed）**；回执后前端两套判定联调验收，随本项关闭 |
| REQ-032 | 支线 | 请求 | 中 | 待开始 | meta/ JSON 退役（请求：QED-Tracker）：dataset/qed-tracker/meta/ 不再作为元数据事实源（**元数据默认存数据库**，2026-08-16 用户裁决），存量 JSON（resources/selections/transfers/tasks）由 QED-Tracker 迁移归档后退役；dataset-conventions.md 契约已同步 | 2026-08-16 ARCH-013 轮登记（D3 裁决）；在 QED-Tracker 仓库建设计文档+todo 任务，用户评审确认后由对方执行 |
| REQ-035 | 支线 | 实现 | 高 | 待开始 | 8900 数据域适配 QED-031 新契约（B 组联调前置，编排见 [integration-matrix.md](../design/integration-matrix.md)）：QED-Tracker 迁移 0006 落地后，api/tracker.py + clients/tracker_client.py 从三表端点切换为 qt_knowledge/qt_books/qt_sources 语义；课程体系数据源（courses/math.json → qed_course）切换；config-center-api 数据域章节与 service-contracts 8901 契约同步更新 | 2026-08-16 ARCH-014 轮登记（联调矩阵方案）；**2026-08-17 QED-Tracker 已回执 0006 落地**（alembic=0006_knowledge_schema；migrate 4 知识/12 书行/16 渠道 + qt_sources_legacy 备份；QED_DB_SMOKE 冒烟 + 8901 冒烟通过；database-schema.md 已 Accepted）——**前置解除，可启动执行** |
| REQ-037 | 支线 | 请求 | 中 | 待开始 | 8901 新增课程体系端点（请求：QED-Tracker，REQ-035 顺带项）：GET /courses 读 qed_domain/qed_course 共享表（QED-031 已落地，courses.py 已切表但 API 未暴露）——返回领域与课程列表（domain_id/name/stage/prerequisites/sort_order），支撑 REQ-035「课程体系数据源 courses/math.json → qed_course」切换与 8903 学习中心 courseMeta 内置常量退役（前端 listCourses 契约已预留） | 在 QED-Tracker 仓库建设计文档+todo 任务，用户评审确认后由对方执行；**不阻塞文档下载模块 B 组联调**（下载管理树结构来自 /catalogs/math-qe + /knowledge） |

### 第三轮主线·解析联调轮（ARCH-020）

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| ARCH-020 | 主线 | 实现 | 高 | 待开始 | 第三轮主线：与 Axiom-Flow 联调（local 和 api 模式），不断优化解析效果直至用户确认（至少完成一个教程的解析） | 前置：第二轮主线（ARCH-019）课程下载闭环 + Axiom-Flow REQ-044 / REQ-042 回执；V2-013 执行回执后联调验收 |
| REQ-003 | 支线 | 请求 | 高 | 待开始 | Axiom-Flow 数据目录指向根 dataset/axiom-flow/parsed、直读 QED_* 变量（含 QED_DB_*，qed 库）（请求：Axiom-Flow） | Axiom-Flow todo ALN-003 承接；用户已确认（2026-08-04），B 类计划 ALN-007 执行 |
| REQ-015 | 支线 | 请求 | 中 | 待开始 | Axiom-Flow 读取 dataset/qed-tracker/raw/ 的批量导入解析接口（Phase 2 前置；请求：Axiom-Flow） | Axiom-Flow todo ALN-006 承接；教材下载轮联调后确认，拆 B/D 类计划执行 |
| REQ-034 | 支线 | 实现 | 中 | 进行中 | 数据域·Axiom 适配（C 组第二阶段前置，编排见 [integration-matrix.md](../design/integration-matrix.md)）：Axiom-Flow v2 契约冻结（V2-007 回执）后，建 api/axiom.py + clients/axiom_client.py（解析进度/原始文档对照端点） | 2026-08-16 ARCH-014 轮登记；**同步开发已实施**（backend 五端点 + 前端解析进度/对照两视图，269→271 pytest + 70 vitest passed）；**2026-08-16 联调冒烟通过**（8902 真实数据：01-rudin-trial 20 页 md + 页图 5.2MB 经 8900 代理加载）：契约偏差已适配——① image_url 为 8902 相对路径 → 8900 新增图片代理端点 GET /books/{id}/pages/{no}/image（浏览器只连 8900）；② BookMeta 无进度字段（实际 page_count/author/strategy）→ 前端 manifest 推导页进度（契约冻结后切换上游字段）；③ parse-jobs strategy 枚举 local/hybrid；V2-007 契约冻结后按回执微调 |
| REQ-036 | 支线 | 请求 | 高 | 待开始 | v2 服务建设与 V2-003 移交审阅（请求：Axiom-Flow，C 组联调前置）：① V2-003 ingest 代码已由根仓库侧误建在对方工作区（未提交，81 passed + ruff clean，含单元测试与文档同步）——请审阅后自行提交或调整；② V2-004/005/007（orchestrator / MinerU 接入 / API v1）按对方 todo 推进，8902 API 服务建立后回执根仓库（C 组第一阶段联调与 REQ-034 前置解除） | 2026-08-16 登记（亡羊补牢：误产生的代码改动登记移交，对方审阅后自行提交；V2 联调前置已在对方 todo 标注）；**对方承接回执后关闭** |
| REQ-042 | 支线 | 请求 | 高 | 进行中 | af_* 书目同步与块判定（请求：Axiom-Flow，2026-08-18 文档解析管理轮）：af_books / af_block_reviews 建表（Alembic）+ `POST /books/sync`（幂等 upsert，book_id 同源 qt_books）+ `/books` 改读 af_books（含课程/进度字段，空表回退文件系统）+ 块判定端点（PUT/GET review）+ parse-jobs 完成后回写 pages_done/parse_status | 2026-08-18 在对方仓库已建设计文档（af-books-sync.md）+ todo 登记（V2-013）；**根仓库侧同步开发已完成（2026-08-20）**：8900 sync/review 端点（tests/test_api.py 5 用例，全量 219 passed）+ 前端左树右对照重构（vitest 89 passed + tsc 无错 + build 成功，契约测试 61 passed）；**待 Axiom-Flow V2-013 执行回执后联调验收，回执后关闭** |

### 第四轮主线·探索轮（ARCH-021）

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| ARCH-021 | 主线 | 实现 | 高 | 待开始 | 第四轮主线：与 Axiom-Flow 联调探索——RAG + 知识图谱 + chat 问答，确保课程效果，成熟后作为课程学习部分（完成一个教程）；learning/ 学习探索同步启动（QED-Engine 独有） | 前置：第三轮主线（ARCH-020）解析效果确认；探索设计见 [design/exploration.md](../design/exploration.md) |
| REQ-027 | 支线 | 请求 | 中 | 待开始 | 数据库设计确认（请求：Axiom-Flow）：af_* 表清单与结构由 Axiom-Flow 设计确认，确认后回执根仓库 [../architecture/database-design.md](../architecture/../architecture/database-design.md) 补登记表清单 | 2026-08-09 用户裁决（数据库设计先在各子项目确认，根仓库只做指引和规划）；**2026-08-10 已建设计文档（Axiom-Flow docs/design/database-schema-ownership.md）并登记 ALN-009 承接**；由其仓库确认与回执后关闭 |

### 第五轮主线·学习中心轮（ARCH-022）

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| ARCH-022 | 主线 | 实现 | 高 | 待开始 | 第五轮主线：学习中心轮——用户同步学习，开始知识探索、课程学习和课后练习，直至学完一个教程（learning-center.md 启动） | 前置：第四轮主线（ARCH-021）课程内容成熟 |
| REQ-006 | 主线 | 实现 | 中 | 进行中 | QED-Engine 前端（8903）：主体学习界面 + 后台管理（仪表盘/知识体系/解析进度/文档对照/追溯） | 期次里程碑：三期（ARCH-003，111 passed）→ 四期（ARCH-004，119）→ 五期~十三期（ARCH-005，127→140，a5ce8c1 已验收）→ 十四期（ARCH-006，141，人工评审优化）→ 十五期（ARCH-007，150，文档下载课程分页）；逐期界面细节见 project-status 前端行与 history/plans/；管理后台已随 web-ui React 重构落地（ARCH-011 已实施）；学习中心部分归第五轮主线（ARCH-022）收尾 |
| REQ-031 | 支线 | 实现 | 低 | 待开始 | 使用手册完善（前端 web-ui）：当前手册（HELP_SECTIONS 迁移六节）内容粗略，待学习中心各功能稳定后逐界面细化（操作截图/分步图文/FAQ 扩充/五阶段流程配图） | 2026-08-16 用户标注：使用手册还不完善，**低优先级**，等后续完善；暂不阻塞前端重构主轮 |
| REQ-033 | 支线 | 实现 | 低 | 待开始 | 仪表盘整体优化（前端 web-ui）：当前为过渡形态（四服务摘要 + 下载/解析上下大盘），待整个后台服务正常后梳理优化（布局细化、数据源扩充、图表增强，如解析大盘接 parse-jobs 真数据） | 2026-08-16 用户标注：仪表盘具体梳理等整个后台服务正常后再优化，**低优先级**；本轮仅完成四服务摘要/上下布局/去副标题 |

### prompt 优化轮（2026-08-24）

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-061 | 支线 | 实现 | 高 | 待开始 | **LLM 网关缺陷修复（2026-08-24 QED-043 真实评估发现，与 REQ-060 不同源；根仓库自办）**：① `services/llm/clients.py` `DEFAULT_TIMEOUT=60.0` 硬编码且 `gateway.call_text` 未向 provider_text_chat/lmstudio_chat 透传超时——qwen3.8-2.4t-a95b 生成长 JSON（课程清单 4000+ 字符）实测 >60s 必现 ReadTimeout（证据：qed_llm_calls call_id 62/64~65/68~69/71~72，duration_ms≈60100、error=模型调用失败 ReadTimeout）；② `gateway.call_text` 收了 `max_tokens` 形参但函数体未使用、provider_text_chat 无 max_tokens 入参——调用方 max_tokens 静默失效。请求：超时可配置（env 或参数，建议默认 ≥300s 或按 endpoint 区分）+ max_tokens 透传上游 | 由根仓库实现；回执 = 提交号 + 长生成复测输出（QED-Tracker 将用 courses 步骤真实 prompt 复测网关链路）；关联 todo QED-043 Phase B0 |

### 长期任务

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-002 | 长期 | 实现 | 中 | 进行中 | 文档治理与同步（**吸收 REQ-021/025，2026-08-16 ARCH-013 合并**）：标准/ADR/计划/台账与契约测试随需求同步更新（ADR 0001 已落地）；README/AGENTS 大变动同步（原 REQ-021）；四类设计文档（架构/API 契约/数据库/技术栈）先文档后实现同步（原 REQ-025） | 每次文档变更前运行 `tests/contract/` 门禁；大变动评审时同步 README/AGENTS |
| REQ-010 | 长期 | 流程 | 中 | 进行中 | 跨项目协作流程演练：向 Axiom-Flow/QED-Tracker 登记改造请求 todo | 双方回执并关闭其 todo 后完成 |
| REQ-046 | 长期 | 实现 | 高 | 进行中 | API 接口开发：先确定接口类型，按类型写 API 文档落入各自项目——① QED-Engine 前端无 API（静态页面只连 8900，声明于 [api-contracts](../architecture/api-contracts.md)）；② QED-Engine 后端三类（控制域启停/重启/健康、QED-Tracker 透传及相关处理、Axiom-Flow 透传及相关处理）；③ QED-Tracker 三类（自身生命周期+健康、数据库知识查询传递、LLM 检索课程教程/选书业务）；④ Axiom-Flow 四类（生命周期+健康、数据查询、解析结果与 PDF 对照、未来 RAG/知识图谱预留）；检查是否有遗漏；关联 ARCH-012（全流程跑通 + Axiom-Flow 完成前端验收 + 流程完整走完为止） | 第一步（接口类型确认 + QED-Engine 文档落位）随 ARCH-018 完成（architecture/api-contracts.md 已落位、前端无 API 已声明）；子项目 API 文档经请求由对方执行（Axiom-Flow / QED-Tracker todo 承接）；接口类型清单评审确认后按类型分别落各自项目 |
| REQ-047 | 长期 | 实现 | 高 | 进行中 | 数据库设计：QED-Engine [database-design](../architecture/database-design.md) 为总纲（qed_* 共享表族完整；qt_*/af_* 部分置空，提示先查子项目数据库文档）；QED-Tracker 定义自身完整数据库定义（docs/architecture/database-schema.md 唯一事实源，REQ-026 已回执）；Axiom-Flow 定义 af_* 完整数据库定义（REQ-027 承接中），通过文档 + 单独数据库管理体系管理 | QED-Engine 总纲随 ARCH-018 落位（2026-08-20，ADR 0010 版本机制）；子项目数据库文档由各自仓库维护（各项目 Alembic 独立初始化自己的表，qed_* 共享表所有权 QED-Tracker）；Axiom-Flow 侧待 REQ-027 回执后补登记 |
| REQ-050 | 长期 | 实现 | 中 | 进行中 | 版本更新文档体系重新梳理（2026-08-21 ARCH-018 收尾登记，ADR 0010 版本机制）：每次版本更新（用户确认升版本时）按 ADR 0010 重新梳理三项目文档体系——architecture/ 固定化维护（总体/服务架构/API/数据库/code-map）、guides 操作与开发文档、trackers 主线归并（完成→completed.md）、design 三态梳理、plans 归档、子项目范本对齐跟进（REQ-048/049 同源） | 随 ARCH-018 关闭登记；每次版本末期触发，不单独设排期；子项目对齐经请求由对方执行 |

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
