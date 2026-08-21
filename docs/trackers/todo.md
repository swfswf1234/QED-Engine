# 任务台账

状态：Current
最后更新：2026-08-20

本文件登记根仓库未关闭任务，是活跃计划的镜像。详细计划见 [计划索引](../plans/index.md)；
已关闭任务见 [completed.md](completed.md)。

## 未关闭任务

### 第一轮主线·架构确定轮（ARCH-018）

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| ARCH-018 | 主线 | Plan | 高 | In Progress | [2026-08 文档规范与架构确定轮（docs-restructure-round）](../plans/2026-08-docs-restructure-round.md) | 计划状态 In Progress（2026-08-20 用户裁决：第一轮主线=文档规范、脚本、文档梳理、API 设计、数据库设计等架构设计确定，支线任务归入其下）；ADR 0010 已登记；执行中：architecture/ 固定化、guides 操作/开发拆分、trackers 主线归并（ARCH-011~017 归入本主线）、**API 文档按五类重构（REQ-046）**、**数据库总纲补 qed_llm_calls + 表清单总览**、**todo 按五轮主线分节排序（REQ-041/043 已关闭）**、长期任务 REQ-046/047 登记；门禁全绿（契约 50 + 全量 296 + ruff clean）待用户验收 |
| ARCH-011 | 支线 | Plan | 高 | Accepted | [2026-08 前端重构主轮（frontend-react-refactor）](../plans/2026-08-frontend-react-refactor.md) | 计划状态 Accepted（2026-08-16 用户裁决：前端重构最高优先级且**只做前端**，React+AntD 全家桶，分阶段门禁——每阶段用户验证后才进下一阶段）；ADR 0008 + 设计文档已落盘并通过用户验收；后端配套（原 Phase 3/7）已移出，由 [ARCH-012 后端三域拆分轮](../plans/2026-08-backend-domain-refactor.md) 并行承接；**Phase 0（web-ui 地基）开工前先提交文档基线** ；**归属 ARCH-018 第一轮主线**（2026-08-20 用户裁决：ARCH-011~014 归并为第一轮主线支线；015~017 同轮收尾） |
| ARCH-012 | 支线 | Plan | 高 | Accepted | [2026-08 后端三域拆分轮（backend-domain-refactor）](../plans/2026-08-backend-domain-refactor.md) | 计划状态 Accepted（2026-08-16 用户裁决：后端改造独立成轮与前端轮并行——维持三域、最小分层调整、迁移先行）；设计文档（backend-domain-split.md 深化版）已落盘；**实施完成（261 passed + ruff clean + 契约 46 passed）**；Task 18 真实环境验收**延后至前端完成后统一验收**（2026-08-16 用户裁决） ；**归属 ARCH-018 第一轮主线**（2026-08-20 用户裁决：ARCH-011~014 归并为第一轮主线支线；015~017 同轮收尾） |
| ARCH-013 | 支线 | Plan | 高 | Accepted | [2026-08 文档与数据边界整理轮（docs-data-boundary-round）](../plans/2026-08-docs-data-boundary-round.md) | 计划状态 Accepted（2026-08-16 用户裁决：后端文档按三域新模式梳理 + todo 清理合并 + database/dataset 边界按「dataset=数据资料、元数据入 DB」重梳；ARCH-012 验收延后至前端完成后）；**待用户确认后归档** ；**归属 ARCH-018 第一轮主线**（2026-08-20 用户裁决：ARCH-011~014 归并为第一轮主线支线；015~017 同轮收尾） |
| ARCH-014 | 支线 | Plan | 高 | Accepted | [2026-08 LLM 状态收敛与 DB 启动快照轮（llm-status-convergence）](../plans/2026-08-llm-status-convergence.md) | 计划状态 Accepted（2026-08-16 用户裁决：删除 /config/llm-status 端点（8900 启动检查一次）、/config/database 改启动快照、Axiom 端口 8902 已迁移、文档解析管理包含关系同步）；**实施完成（261 passed + ruff clean + 冒烟：database 200 快照 / llm-status 404）**；待前端完成后统一验收 ；**归属 ARCH-018 第一轮主线**（2026-08-20 用户裁决：ARCH-011~014 归并为第一轮主线支线；015~017 同轮收尾） |
| ARCH-015 | 支线 | Plan | 高 | In Progress | [2026-08 下载管理界面重构轮计划（downloads-manage-redesign）](../plans/2026-08-downloads-manage-redesign.md) | 计划状态 In Progress（2026-08-18 用户裁决：左树四层 高等数学→分类→课程→教程叶子+进度、右侧流程筛选 搜索/确认/下载/验收 + 保留三下拉、书行卡去 kind、书行排序、教程命名由 QED-Tracker 数据侧统一）；设计文档 downloads-manage-redesign.md 已落盘；**实施完成（2026-08-20：vitest 87 passed + tsc 无错 + build 成功）**；**REQ-041 回执已收到（2026-08-20，QED-Tracker QED-036，教程叶子数据侧命名规范已落地）**；待浏览器验收后关闭 ；**归属 ARCH-018 第一轮主线**（2026-08-20 用户裁决：ARCH-011~014 归并为第一轮主线支线；015~017 同轮收尾） |
| ARCH-016 | 支线 | Plan | 高 | Accepted | [2026-08 LLM 网关与模型管理实施轮（llm-gateway-and-model-management）](../plans/2026-08-llm-gateway-and-model-management.md) | 计划状态 Accepted（2026-08-20 用户裁决：三项目各自 `.env` 自持 key（`API_KEY` 统一 + 旧变量别名）、8900 LLM 网关端点、`qed_llm_calls` 调用记录单表三项目可写、MinerU 编排移交根仓库、本地模型资源互斥、控制台 GPU/依赖卡/调用检索页）；REQ-043 / REQ-044 已登记待对方执行；**Task 17 门禁收口完成（2026-08-20：后端 pytest 282 passed + ruff clean + 契约 48 passed；前端 vitest 100 + tsc 无错 + build 成功；api 模式真实冒烟通过）**；**REQ-043 回执已收到（2026-08-20，QED-Tracker QED-037，含真实冒烟：8901 --mode 切换 + local 直连 + 网关落库）**；待 REQ-044 回执后归档（local 模式冒烟因本机 LM Studio 开启鉴权跳过） ；**归属 ARCH-018 第一轮主线**（2026-08-20 用户裁决：ARCH-011~014 归并为第一轮主线支线；015~017 同轮收尾） |
| ARCH-017 | 支线 | 实现 | 高 | In Progress | 密钥收敛与厂商选择（2026-08-20 用户裁决：取消逐厂商 key，`API_KEY` + `QED_API_PROVIDER`）——逐厂商 key（QWEN/DEEPSEEK/GLM_API_KEY）正式取消，单一 `API_KEY` 唯一密钥 + `QED_API_PROVIDER`（qwen/deepseek/glm，默认 qwen，仅影响 api 模式）选厂商；`/config/keys` 契约改 `{provider, configured}`，`/config/models` 按厂商返回解析后生效模型（显式配置优先，否则厂商默认，deepseek 无视觉显示「（无视觉）」） | **文档同步 + 门禁完成（2026-08-20）**：`.env`/`.env.example`（删旧变量、增 QED_API_PROVIDER）、configuration-and-secrets.md、../architecture/api-contracts.md、llm-gateway-and-model-management.md、tech-stack.md、plan 顶部标注、project-status 登记；全量门禁（后端 pytest 294 passed + ruff clean + 契约 48 passed + 前端 vitest 100 + tsc 零错误）+ qwen api 模式冒烟通过；**QED-Tracker 侧回执（2026-08-20，QED-038）**：`llm_api_key()` 只读唯一 `API_KEY`，`QWEN_API_KEY`/`DASHSCOPE_API_KEY`/`DEEPSEEK_API_KEY`/`GLM_API_KEY` 别名全部取消无回退（.env 解析同样只认 API_KEY）；提交 8c65a5e；QED-Tracker 全量 238 passed + 3 skipped + ruff clean；待用户评审后关闭 ；**归属 ARCH-018 第一轮主线**（2026-08-20 用户裁决：ARCH-011~014 归并为第一轮主线支线；015~017 同轮收尾） |
| REQ-038 | 支线 | 实现 | 高 | 进行中 | 服务控制优化 + 仪表盘图表改版（2026-08-17 用户需求）：① 8900/8903 都能重启；② 修复 QED-Tracker 手动脚本启动后停止/重启无效；③ 8903 注册进服务注册表（web 单元）；④ 仪表盘改名、统计口径（教程数/目标书目）、下载进度双饼图；⑤ 启停/重启 **message 成功/失败提示**（只提示收敛结果，2026-08-17 裁决）；⑥ 课程完成度口径（≥2 套教程验收=完成，分母=catalog 课程数）；⑦ **旧 web/ 退役**（全套切换：删 web/、test_web.py 重写守护 web-ui/src、web-frontend.md v2、.env.production VITE_API_BASE=8900） | **实施完成**：四单元真实冒烟通过；课程完成度 1/13（真实数据验证）；启停 message 反馈 + 收敛判定落地；8903 生产直连 8900（dist 含 VITE_API_BASE）；后端 214 passed + ruff clean + 契约 48；前端 tsc + 76 passed；**待用户浏览器验收（控制台 message 反馈 + 仪表盘 1/13 + 8903 直连）后关闭** |
| REQ-039 | 支线 | 请求 | 中 | 进行中 | Axiom-Flow 服务优化（请求：Axiom-Flow，2026-08-17 用户需求 REQ-038 ③ 衍生）：仿 QED-Tracker 服务化模式，为 Axiom-Flow 提供生命周期脚本 `scripts/axiom_flow_service.py`（start/stop/restart/status，PID 文件 + 优雅停止 + 强杀兜底）——8902 单元（axiom）当前为 Popen 直管，缺少类似 tracker/web 的脚本化黑盒管理；8900 侧 service_manager 的 axiom 单元可后续切换到脚本调用 | 2026-08-17：Axiom-Flow 工作区已有同目标设计与实现（未提交，V2-011 In Progress）；**根仓库侧已接入**——service_manager 的 axiom 单元切为 `scripts/axiom_flow_service.py` 黑盒调用，8900 经 /services 停止/重启脚本启动的 8902 已冒烟通过；**待对方提交脚本后回执，回执后关闭** |
| REQ-040 | 支线 | 请求 | 高 | 进行中 | 生命周期脚本 `_pid_is_alive` 编码修复（请求：QED-Tracker + Axiom-Flow，2026-08-18 用户实测故障）：中文 Windows 下 `tasklist` 表头为 GBK（如「映像名称」，0xcf 是「像」首字节），Python 以 utf-8 解码抛 `UnicodeDecodeError` → `subprocess` readerthread 中断 → `result.stdout=None` → `str(pid) in result.stdout` 抛 `TypeError` → 脚本退出码 1 → 控制台「停止/重启」报「停止失败（脚本退出码 1）」。**根仓库 web 脚本同构缺陷已修复**（`scripts/qed_web_service.py` `_pid_is_alive` 加 `errors="replace"` + `(result.stdout or "")`，tests/test_qed_web_service.py 新增回归测试，全量 215 passed + ruff clean，8903 停止/重启实测通过）；tracker/axiom 脚本需对方仓库同构修复 | 2026-08-18 在对方仓库 docs/design/ 建修复设计文档 + todo 登记（QED-Tracker QED-035、Axiom-Flow V2-012）；根仓库侧已验证 web 修复范式（errors='replace' + stdout 兜底）；待对方执行回执后关闭 |
| REQ-044 | 支线 | 请求 | 高 | 待开始 | Axiom-Flow 模型模式与 MinerU 移交（请求：Axiom-Flow，设计见 [llm-gateway-and-model-management.md](../design/llm-gateway-and-model-management.md)）：① 调整自身 `.env`（`QED_API_SELECT=local` 默认、`API_KEY`（`AXIOM_API_KEY` 降为别名）、`QED_LLM_GATEWAY_URL`、`QED_DB_*`）；② 新增 `llm_client.py` 兼容层（local 直连 qwen-vl-ocr / qed-engine 经 8900 网关 `/llm/vision`；**MinerU 仅经网关可达**）；③ `scripts/axiom_flow_service.py` 增加 `--mode（local 或 qed-engine）`（重启可换模式）；④ **MinerU 编排移交**：`compose.yaml`/`infra-*.ps1`/`docker/Dockerfile` 迁出至根仓库 `scripts/image-model/`（根仓库侧先行落位后再移除，过渡期双份存在可接受），本地 mineru 直连调用删除；⑤ local 模式调用记录写 qed_llm_calls 表（`service=axiom_flow`） | 2026-08-20 登记（LLM 网关与模型管理轮 P0）；在 Axiom-Flow 仓库建设计文档+todo 任务，用户评审确认后由对方执行；回执后关闭 |
| REQ-045 | 支线 | 实现 | 低 | 待开始 | LLM 供应商客户端错误映射收敛（可选优化项，LLM 网关与模型管理轮收口登记）：`services/llm/clients.py` 中 lmstudio 探测 GET 与 mineru POST/GET 目前裸抛 httpx 异常，与 qwen 客户端的 RuntimeError（中文原因+状态码）映射不一致；网关层已捕获兜底可接受，登记为可选优化项 | 2026-08-20 登记（ARCH-016 轮收口跟随项）；后续轮次顺手处理，不阻塞 |
| REQ-022 | 支线 | 请求 | 低 | 待开始 | 治理契约范本对齐（请求：Axiom-Flow）：按根仓库 [governance-contract.md](../standards/governance-contract.md) 范本对齐治理契约测试（契约头六字段/守护面清单/编写约定） | 2026-08-09 用户确认范本化设计（ADR 0006）；**2026-08-10 已建设计文档（Axiom-Flow docs/design/governance-contract-alignment.md）并登记 ALN-008 承接**；用户评审确认后由其仓库执行，回执后关闭 |
| REQ-023 | 支线 | 请求 | 低 | 待开始 | 治理契约范本对齐（请求：QED-Tracker）：按根仓库 [governance-contract.md](../standards/governance-contract.md) 范本对齐治理契约测试（契约头六字段/守护面清单/编写约定） | 2026-08-09 用户确认范本化设计（ADR 0006）；**2026-08-10 已建设计文档（QED-Tracker docs/design/governance-contract-alignment.md）并登记 QED-022 承接**；用户评审确认后由其仓库执行，回执后关闭 |
| REQ-048 | 支线 | 请求 | 中 | 待开始 | 文档体系范本对齐（请求：Axiom-Flow，依据根仓库 [ADR 0010](../adr/0010-documentation-versioning.md)）：architecture/ 固定化（overview 服务架构 + **新增 8902 API 接口文档** + **新增 af_* 数据库设计文档** + code-map）、API 文档按 REQ-046 分类落位（生命周期+健康 / 数据查询 / 解析结果与 PDF 对照 / 未来 RAG·知识图谱预留）、adr/index 当前版本声明、design/ 三态梳理、契约测试同步 | 2026-08-20 已建设计文档（Axiom-Flow docs/design/docs-restructure-alignment.md）并登记 V2-015 承接；用户评审确认后由其仓库执行，回执后关闭 |
| REQ-049 | 支线 | 请求 | 中 | 待开始 | 文档体系范本对齐（请求：QED-Tracker，依据根仓库 [ADR 0010](../adr/0010-documentation-versioning.md)）：architecture/ 固定化（system-overview + main-line + **新增 8901 API 接口文档** + **database-schema.md 升级固定数据库文档** + code-map）、**project-status.md 移入 trackers/**、API 文档按 REQ-046 分类落位（生命周期+健康 / 数据查询 / LLM 检索课程教程·选书业务）、adr/index 当前版本声明、design/ 三态梳理、契约测试同步 | 2026-08-20 已建设计文档（QED-Tracker docs/design/docs-restructure-alignment.md）并登记 QED-027 承接；用户评审确认后由其仓库执行，回执后关闭 |

### 第二轮主线·课程下载轮（ARCH-019）

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| ARCH-019 | 主线 | 实现 | 高 | 待开始 | 第二轮主线：课程下载轮（基于 ARCH-002 扩展）——三门基础课（00 概率论与数理统计 / 01 数学分析 / 02 高等代数）下载，与 QED-Tracker 联动（QED-026 主链路），local 和 api 模式界面调试成功；探索按钮（写文档 / 打开文档 / 直接开始）→ LLM 检索最合适教程（教材 + 对应习题集，按规范）→ 结果界面用户选择（未选进待选）→ 确定后进入下载流程（QED-Tracker 自寻渠道，找不到列举渠道请求用户自下，用户下载完提供链接）→ 审核流程（QED-Tracker 审核后人工确认一次）；通过剩余两门基础课下载同步完成 | 前置：第一轮主线（ARCH-018）收尾 + QED-Tracker QED-026 三门课闭环 + QED-014 全链路联调冒烟；ARCH-002 验收并入本主线 |
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

### 长期任务

| ID | 类别 | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-002 | 长期 | 实现 | 中 | 进行中 | 文档治理与同步（**吸收 REQ-021/025，2026-08-16 ARCH-013 合并**）：标准/ADR/计划/台账与契约测试随需求同步更新（ADR 0001 已落地）；README/AGENTS 大变动同步（原 REQ-021）；四类设计文档（架构/API 契约/数据库/技术栈）先文档后实现同步（原 REQ-025） | 每次文档变更前运行 `tests/contract/` 门禁；大变动评审时同步 README/AGENTS |
| REQ-010 | 长期 | 流程 | 中 | 进行中 | 跨项目协作流程演练：向 Axiom-Flow/QED-Tracker 登记改造请求 todo | 双方回执并关闭其 todo 后完成 |
| REQ-046 | 长期 | 实现 | 高 | 进行中 | API 接口开发：先确定接口类型，按类型写 API 文档落入各自项目——① QED-Engine 前端无 API（静态页面只连 8900，声明于 [api-contracts](../architecture/api-contracts.md)）；② QED-Engine 后端三类（控制域启停/重启/健康、QED-Tracker 透传及相关处理、Axiom-Flow 透传及相关处理）；③ QED-Tracker 三类（自身生命周期+健康、数据库知识查询传递、LLM 检索课程教程/选书业务）；④ Axiom-Flow 四类（生命周期+健康、数据查询、解析结果与 PDF 对照、未来 RAG/知识图谱预留）；检查是否有遗漏；关联 ARCH-012（全流程跑通 + Axiom-Flow 完成前端验收 + 流程完整走完为止） | 第一步（接口类型确认 + QED-Engine 文档落位）随 ARCH-018 完成（architecture/api-contracts.md 已落位、前端无 API 已声明）；子项目 API 文档经请求由对方执行（Axiom-Flow / QED-Tracker todo 承接）；接口类型清单评审确认后按类型分别落各自项目 |
| REQ-047 | 长期 | 实现 | 高 | 进行中 | 数据库设计：QED-Engine [database-design](../architecture/database-design.md) 为总纲（qed_* 共享表族完整；qt_*/af_* 部分置空，提示先查子项目数据库文档）；QED-Tracker 定义自身完整数据库定义（docs/architecture/database-schema.md 唯一事实源，REQ-026 已回执）；Axiom-Flow 定义 af_* 完整数据库定义（REQ-027 承接中），通过文档 + 单独数据库管理体系管理 | QED-Engine 总纲随 ARCH-018 落位（2026-08-20，ADR 0010 版本机制）；子项目数据库文档由各自仓库维护（各项目 Alembic 独立初始化自己的表，qed_* 共享表所有权 QED-Tracker）；Axiom-Flow 侧待 REQ-027 回执后补登记 |

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
