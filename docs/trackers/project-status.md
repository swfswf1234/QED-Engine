# 项目状态快照

设计状态：Accepted
实现状态：Implemented
最后更新：2026-10-23
关联代码：无（状态快照，不映射具体模块）
关联测试：无
关联 ADR：无

## 用途

本文件是 QED-Engine 三项目开发状态的单一事实源入口：Agent 进场先读本表，
30 秒掌握「项目现在到哪了」。具体任务状态以[任务台账](todo.md)为准，
未来方向以[能力路线图](roadmap.md)为准；本表只保存「当前实现状态」快照。

## 四服务状态

| 服务 | 仓库 | 端口 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| QED-Engine 前端 | 根仓库 `web-ui/`（构建产物 dist/ 由 serve_web.py 托管） | 8903 | 已运行 | 学习界面（建设中）+ 管理后台（控制台 / 仪表盘 / 文档下载管理 / 文档解析管理——**单屏「左书目树（纯选择）+ 右对照工作台」**：原页图 vs 解析还原对照、bbox 双向联动、块编辑+判定、单页/全本解析+进度、连续滚动、URL 恢复（2026-09-20 ARCH-020-G 定档，取代历轮左树进度/两级列表形态）；**React 重构主轮（ARCH-011）四界面已完成并切换**（2026-08-17 旧 web/ 退役，直接经 8903 调试）；**只连 8900**（ADR 0007）；**控制台 LLM 改造（ARCH-016，2026-08-20）**：四服务卡后 GPU 总览条 + 依赖组件三卡（MySQL/文字模型/图像模型，置灰 + 测试按钮）+ 「模型调用记录」检索页（`#/admin/llm-calls`）；**管理台展示优化（REQ-033，2026-09-24 五改收口）**：仪表盘三块（服务详情含「本地模型列表」两栏分节 / 文档下载课程格子进度+图例 / 文档解析 KPI+课程分组）+ 控制台「当前在跑」模型标注 + GPU 探测 SWR 提速与增量刷新（形态事实见 [design/admin-dashboard.md](../design/frontend/admin-dashboard.md)）；**解析编辑扩展（REQ-098，2026-09-26 首批落地，2026-09-29 收尾关闭）**：版式＝重新排版（替换原 bbox 定位形态：五号～一号字号阶梯＋标题级差自动推＋字体角色＋目录点线组＋页眉页脚默认隐藏，「排版」面板偏好持久）＋编辑模式双口径（框图＝8 手柄拉伸/移动即落库、画新框/删除/合并本地草稿待引擎承接；内容＝右栏只改文字）；**W8 顶栏四行重排（2026-09-28 实施并浏览器实测）**：书名独行／解析动作三态文案 + 全动作确认弹窗／视图行（编辑模式·单页连续·滚动同步·流式版式，**不设缩放控件**（W9 同日追改撤销）／编辑行两口径更名「框图修改」（新增=画框模式、合并，删除与修改走框右键菜单）与「解析修正」（逐块确认 + 整页确认，复用 verdict=ok）；**领域维护表单口径（REQ-103 根侧，2026-09-30）**：文档下载管理三处领域表单统一五字段顺序与标签（领域名→领域描述→学科知识→探索范围→学习阶段）＋默认句（描述随领域名插值、用户手改不再覆盖；学科知识默认「中文表述＋参照美国主流高校本科—硕士通行方案」边界；探索范围默认 本科-硕士；学习阶段默认四档），措辞正本在 `web-ui/src/components/domainFormDefaults.ts`、口径正文见 [design/downloads-ui.md](../design/frontend/downloads-ui.md) §3.1；四字段进探索提示词的真读取待对方 BUG-004 承接 |
| QED-Engine 后端 | 根仓库 `backend/qed_engine/` | 8900 | 已运行 | **三域组织（ARCH-012，2026-08-16 实施完成）**：控制域（配置五端点 + /services 启停托管 + /logs、/monitor/gpu、qwen、mineru、/self-restart 监控诊断）+ 数据域·QED-Tracker（catalogs/三表/tasks 适配 8901）+ 数据域·Axiom-Flow（预留）；密钥不下发。**2026-08-17：服务注册表扩为四单元（新增 web/8903）、tracker/web/axiom 三单元均走生命周期脚本（axiom 由 Popen 切换，REQ-039）、脚本单元停止/重启语义修复、serve_web.py 切 web-ui/dist**。**LLM 网关与模型管理（ARCH-016，2026-08-20 实施完成）**：三项目密钥约定（各 `.env` 自持 `API_KEY`，旧变量降级别名，`QED_API_SELECT` 选模式）+ 8900 LLM 网关端点（/llm/text、/llm/vision、/llm/test/*、/llm/calls、/database/test）+ 本地模型生命周期脚本（scripts/text-model/ + scripts/image-model/）+ 资源互斥（QED_RESOURCE_GUARD）+ qed_llm_calls 调用记录（单表三项目可写）；`--mode（api 或 local）` 启停。**密钥收敛（2026-08-20
  用户裁决）**：逐厂商 key（QWEN/DEEPSEEK/GLM_API_KEY）已取消，单一 `API_KEY` + `QED_API_PROVIDER`
  （qwen/deepseek/glm，默认 qwen）选厂商，`/config/keys` 改返回 `{provider, configured}` |
| QED-Tracker | `QED-Tracker/` 子仓库 | 8901 | 已服务化 | 发现/下载/校验/登记 + 资源状态机 + 后台任务轮询；全链路联调冒烟（QED-014）待开始 |
| Axiom-Flow | `Axiom-Flow/` 子仓库 | 8902 | 已实现 | 完整解析管线（PDF ingest / 引擎适配器 / 归一化 / 编排 / 产物落盘）+ 对照数据供给 + 人工编辑落库；**模型生命周期归 8900、解析直连模型服务**（ARCH-020，[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)）；设计已晋升定档（[parsing-flow.md](../design/parsing-flow.md)） |

## 三中心定位

- **学习中心**：前端主界面（`#/`）的最终形态——课程学习（按知识节点推进）+ 知识问答
  （多 Agent），规划中（[学习功能现状](../history/plans/2026-10/2026-09-10-learning-center-current-state.md)）。
  覆盖数学与计算机科学（AI 方向）双核心领域，当前以高等数学起步；资料类型含教材、
  习题集、论文、博客与官方文档，后续随需求扩展。
- **管理中心**：后台内容管理——文档下载管理 / 文档解析管理（单屏左书树纯选择 + 右对照
  工作台：原页 bbox 联动 + 块级编辑：判定/备注/文字/范围，设计见 [parsing-ui.md](../design/frontend/parsing-ui.md)；探索方向（切分与召回）规划见 [ARCH-025 滚动壳](../plans/2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md)）。
- **控制中心**：后台运行控制——**8900 服务域 /services 启停托管已实装（2026-08-11，ADR 0007 轮）**
  （[服务控制设计](../design/service-hosting.md)，Accepted / Implemented）；注册表含 config/
  tracker/axiom/**web** 四单元，8900 重启经 /self-restart、8903 前端启停经
  `scripts/qed_web_service.py`（2026-08-17）；**本地模型可操作**——控制台槽位卡五字段
  （来源/渠道/模型/备注/可用）启停/观测/验证，注册表统一身份与 runtime 路由
  （2026-09-21 ARCH-023 收口，见 [llm-gateway.md](../design/llm-gateway.md)）；向量库只进规划不展示。

## 当前主线
- 已完成（2026-10-23 收口，**Partial**，**REQ-119 共享表 `qed_domain`／`qed_course` 形状定档跨项目请求收尾（「是否已完成」判定＋收口）**）：用户问「REQ-119任务是否已经完成，如未完成还有哪些事项，准备收尾该任务」，结论＝**未完成但可收口**，全行判据缺口只有一枚＝**S2「对方逐条回执＋其门禁输出」从未出手**。**用户两裁（AskUserQuestion 原文）**＝收尾取值「Partial 收口（推荐）」、R5 的 `path_results` 半句「维持两列都删（不改判）」（＝保持 2026-10-18 复裁、不撤回、不交对方裁决；代价＝R5 必须走双仓同批窗口）。① **六项请求实况**（双源取证＝实读对方树内文件 ＋ `qed_test` 只读探针，脚本 `tmp/probe-req119.py` 只 `SELECT`／`information_schema`，读数落 UTF-8 文件不走 bash 管道）＝**R1 `meta` 扩展槽／R2 主外键宽度收 `varchar(64)`／R3「主键值不可改」条文／R4 `level`／`scope` 注释语义／R6 其文档快照改指根总纲五枚已成型**，**R5 未执行**＝两列实存（`qed_domain` 15 列／`qed_course` 17 列，行数 1／12 与总纲 §7.8 T2 一致）；**探针与实读都不据以声称对方已回执**（回执身份只能由对方出）。② **逐 S 对照**＝S1 达成（2026-10-18 根侧代登其 `todo.md` 的 `QED-080`＋其 v1 链承接节，只改其既有两份文件故不触其文档白名单）、S3 达成（R5 未执行 ⇒ 根侧读写矩阵与消费语义本批无变化可随步）、S4 达成（对方代码面一字未动）、**S2 未兑现**＝其 `QED-080` 至今 `Candidate／待开始`、其承接节验收标准行原样在位；取值判据＝task-lifecycle「有未做的核心项记 `Partial`，无论其去向」，**不适用** ADR 0022 移交型 `Achieved`（判例 REQ-125；本行是 S2 本身未兑现，非仅残余观察窗，与同日 REQ-132／REQ-120 的 Achieved 判据互不冲突）。③ **收尾新查出两件事**＝(a) **双仓耦合**：根侧 `backend/qed_engine/services/shared_tables.py:326` 的 `qed_domain` INSERT 列清单同样点名 `path_results`，先删一侧即断 8900 离线降级写 ⇒ R5 必须双仓同批，逐列改面清单（对方 9 组文件位置＋根侧 3 枚文件）写入壳「遗留与移交」并立规则「**根侧腿在对方落地前不得先行改**」；(b) 对方 `src/qed_tracker/db/schema.py:39-44` 的兜底 DDL 与定档形状**漂移**（缺 `meta`、缺索引、`provider` 无注释）＝对方自加的新尾巴，只登记不代改。④ **台账与归档**＝todo 行原子移除（**88 → 87**）＋ completed.md 新增 `Partial` 行；`docs/design/cross-project-contracts.md` §4 该枚由「在途登记」改为「`Partial` 收口＋契约面仍有效的两件事实」；壳判 **Retain** 物理移出 `docs/plans/` 至 `docs/history/plans/2026-10/`，出站内链按新深度重算 **38 处**、入站指针随步 **4 枚文件共 9 处**（同目录互指退为短名；`docs/plans/2026-09-29-ordinary-tasks-round.md:134` 的反引号字面量属历史叙述、不改）、`docs/plans/index.md` 归档节新增一条。⑤ **门禁**＝`pytest tests/contract -q` **88 passed／1 failed** ＋ 根全量 **875 passed／1 failed**（同一枚既存红＝并行模型轮遗留的 `scripts/image-model/.keepalive.pid`，`.gitignore:43` 已忽略，归因不修）＋ `ruff check backend tests` All checks passed。零代码改动、零 DDL、零库内写、零 git 提交（HEAD 仍 `1a0e14c`）；逐条取证＝[REQ-119 壳](../history/plans/2026-10/2026-10-16-shared-tables-tracker-request.md)「过程与证据」2026-10-23 收尾批条目。**残余归对方会话**＝催办 R5 与其 `QED-080` 行收敛（清单在壳「遗留与移交」），根侧不代出回执。**交人工项本轮实测归零**＝生产 `qed` 库两表经只读探针取证**已对齐定档形状**（`DATABASE()`＝`qed`／14 张表零 `qe_%`；`qed_domain` 15 列与 `qed_course` 17 列均含 `meta`、两枚主键 `varchar(64)` 且注释为「主键，创建后不可改值」、`level`／`scope` 为新语义），R1／R2／R4 **无待补 ALTER 语句**（2026-10-17 REQ-118 窗口的结构对齐已覆盖对方所属两表），唯一仍待人工＝R5 落地后在开发库与生产库同批 `DROP` 两列。
- 已完成（2026-10-23 收口，Achieved，**REQ-132＋REQ-120 两行同批过时判定与收尾（纯台账与归档面）**）：用户问「REQ-132任务是否已经过时，可以直接收尾？」，结论＝**过时且可直收**，依据＝该两行各自仅剩的未做工作项**对象已不存在**（W3 四张表随 ADR 0026 D1~D3 整表退役；W4 生产 `qed` 改名清单因该库 `qe_%` **零张**而无字面对象，其后继物是 REQ-137 壳「遗留与移交」的 B 段全量建表清单）。**用户两裁（AskUserQuestion 原文）**＝关闭取值「Achieved＋取代关系注记（推荐）」、前序行处置「同批一并裁定并收尾（推荐）」。① **逐 S 对照**（判据正本在行、写定不改）＝两行 S1~S5 全达成，其中 **REQ-132 S2 由三张定档后的形状兑现**（源码内旧名命中实测 1 枚＝`tests/contract/test_architecture_documents.py:121` 守护自身反向禁串）、**S5 属工作项而非本行 S 判据且窗口归人工排期**（不构成本行未做核心项，取值判据＝task-lifecycle「移交型关闭」，判例 REQ-098）；**REQ-120 S2 的 `af_*` 五表**于 2026-10-18 真实定档后经 Axiom-Flow PLAN-024 收为四张、**S3 的定档目标名两度作废**（`qed_learn_*` → `qe_learn_*` → `qe_*`），两处均在壳与 completed.md 写明取代关系并加「**不得读作七枚目标名已落库完成**」警示；REQ-120 壳的形态 A／B 两案与七条 `RENAME TABLE` 清单已加作废横幅。② **台账**＝todo 两行原子移除（90 → 88 行）＋ completed.md 新增两行 Achieved（含逐 S 证据与门禁数值）。③ **归档**＝两壳判 **Retain** 物理移出 `docs/plans/` 至 `docs/history/plans/2026-10/`（`test_plan_governance.py` 的 `_active_plans()` 对原位每枚文件断言在途态，Closed 留原必红），出站内链按新深度重算 **56 处**、入站指针随步 **9 枚**文件、`docs/plans/index.md` 于「已归档计划（2026-10）」按新到旧登记两处。④ **顺手修（越界披露）**＝`docs/trackers/completed.md:20` 的 REQ-126 行有一枚指向 Axiom-Flow 承接壳的 Markdown 链接随**对方归档**失效（`docs/plans/…` → `docs/history/plans/2026-10/…`），本批改指实际在位路径以使链接守护转绿；该红非本批引入，属他轮随步遗漏。⑤ **门禁**＝`pytest tests/contract -q` **88 passed／1 failed** ＋ 根全量 `pytest tests -q` **875 passed／1 failed**（两枚红同一＝并行模型轮遗留的 `scripts/image-model/.keepalive.pid` 散落脚本产物，`.gitignore:43` 已忽略，归因不修）＋ `ruff check backend tests` 净。零代码、零 DDL、零库内写、零 git 提交（HEAD 仍 `1a0e14c`，回退锚 tag `p0-req137-snapshot`）；逐条取证＝[REQ-132 壳](../history/plans/2026-10/2026-10-21-qe-family-rename-and-refactor.md)／[REQ-120 壳](../history/plans/2026-10/2026-10-16-root-private-prefix-and-four-part-design.md)「过程与证据」2026-10-23 条目。**本批之后 `docs/plans/` 内已无 `qe_*` 表族改名线的在途壳**；仍待人工＝暂停点③ 8903 真机验收、`/self-restart` 丢 pid 文件的缺陷定档、P7 生产 `qed` DDL 窗口。
- 已完成（2026-10-22 收口，Achieved，**REQ-137 v1.0 根私有表族定档与库内重建·收尾批（审核数据库变动与相关代码变动后关闭）**）：用户指令原文＝「审核数据库变动及相关代码变动，确认没有问题就将这一系列数据库变动任务收尾」。① **库形状面审核干净**＝只读对拍把**在跑的 `qed_test`** 的 `SHOW CREATE TABLE`／`information_schema` 实存与代码 DDL 正本逐列比对（列名／类型／列序／主键／具名索引／表级与列级 collation），三张 `qe_*` **逐字相等**、`fails=0`；两枚注记＝主表因 `ALTER` 只能追加致列序漂移、主表 collation 库 `utf8mb4_unicode_ci` vs 码 `utf8mb4_0900_ai_ci`（P1 三裁③明写不纳入本窗口），均经「`backend/` 零 SQL JOIN＋唯一 `SELECT *` 落在未动的 `qed_llm_calls`＋按行取值游标皆 `DictCursor`」取证判无害。② **代码面查出一枚本批引入的真缺陷并已修**＝`services/learn/knowledge.py` 的 `patch_point()` 新增 `meta` 合并腿仍用裸元组游标（`_connect()` 不设 `cursorclass`）却按列名下标取值，经 `api/learn.py:1220` 章级要点生成腿在真库上必 500；测试漏网因 `tests/test_learn_*.py` 走内存替身 store。归属由 `git show HEAD` 比对确认，修＝改 `DictCursor`、回归＝`test_mysql_patch_point_merges_meta_under_dict_cursor`、变异验证＝回退后复现 `TypeError`。③ **P5 黄金路径取证**＝API 面 23 枚请求**非预期 4xx／5xx＝0**（四枚 404 全是退役路径反向探针），链路段段成立（选课 → 权威知识点树 → 进度 → 出题 quiz＋flashcard → 到期队列 2 行 → 标 `done` 并写备注 → 作答判分得 `attempt_id=7` → 该题到期档由 `2026-10-14T12:44:41` 移到 `2026-10-22T15:28:13`＝D3 重放派生在真库兑现），**C 段复原逐值相等**（删 `attempt_id=7`、`qe_attempt` 回 6 行、`qe_learning` 回 course 2／kp 0、到期队列与取证前逐值相等、备注清空）；备注腿单独补证＝库行落库 ✓、经 `sequence.units[].learner` 可读回 ✓、撤销复原 ✓。**8903 四面浏览器实测**＝全部请求只指 8900（ADR 0007）、在跑包＝新构建哈希 `index-BU5Jjjpu.js`、JS 控制台零错；唯一 404 归因＝`mathanalysis-b05` 第 45~49 页**页产物缺失**，**直连 8902 同 404**（书元数据 200）⇒ 属子项目数据面、非本批，界面按设计降级出话术，**独立性核验以更强形式兑现**。④ **越界披露**＝执行批曾记「agent 侧不代跑写路径」，本轮为取证 B1／B2／B3 确实执行了写路径，补偿＝C 段复原取证、库内演示态未被污染；**P5 的人工验收（暂停点③）本身仍归用户**，agent 取证只作其验收材料。⑤ **门禁**＝根全量 **875 passed／1 failed**（较执行批 +1＝新回归；唯一红仍＝并行模型轮遗留的 `scripts/image-model/.keepalive.pid`）、`ruff check` 净、`tsc -b` 零错、vitest 串行 66 files／845 tests 全绿；8900 经脚本重启使修复生效（监听 PID 194828 → 227144、pid 文件在管）。⑥ **收口**＝S1~S5 逐条全达成记 `Achieved`，todo 行原子移入 `completed.md`、`docs/plans/index.md` 登记去处、壳判 **Retain** 移 `docs/history/plans/2026-10/`（相对链接按新深度重算）。**移交三枚（非判据、不降级）**＝`/self-restart` 丢 pid 文件的缺陷定档（交用户裁）、P7 生产 `qed` DDL（人工另开窗口，命令原文在壳「遗留与移交」第 5 条 B 段）、`mathanalysis-b05` 页产物缺失（Axiom-Flow 数据面）。零 git 提交（HEAD 仍 `1a0e14c`）；逐条取证＝[REQ-137 壳](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md)「过程与证据」收尾批条目。
- 已完成（2026-10-22 随收尾批关闭，**REQ-137 W1 的 P2～P4 执行＝`qed_test` 清空重建与两服务切换完成（用户改判原文＝「帮我直接执行到切换完成，目标是完成替换，可以直接清空数据重建（没有用数据）」）**）：执行者由「人工窗口」改判为 agent 直跑、P3 形态由「按映射搬迁」改判为**零迁移清空重建**，四条护栏仍守（回退锚 → 停机先于动库 → 核验先于重启 → 共享 `qed_*` 与 `af_*`／`qt_*` 零接触）。① **P2 回退锚**＝`dataset/backups/**` 对 agent 全拦，落点改 `tmp/`：12 张（根私有 11＋共享主表）的 `SHOW CREATE TABLE` 与全量行 INSERT＝**119,296 字节**，逐表 `COUNT(*)` 与 P1 读数**逐条相等**；黄金样本与旧列形另落 `tmp/p2-req137-old-shapes.json`。**暂停点②（备份确认）随该指令并入执行**。② **停机**＝`logs/qed-engine.pid` 已被上一轮 `POST /api/v1/self-restart` 弄丢、脚本据此判非托管拒停（`qed_engine_service.py:255-265` 退出码 3）；取证＝`Win32_Process` 父 PID 链显示 8900 与 8901／8902／8903 互不为父子且 8900 零子进程 ⇒ 补写 pid 文件走脚本自身停止路径，CTRL_BREAK 优雅生效、另三服务全程未动。**本轮新查出的缺陷（未修，交用户定档）**＝`/self-restart` 之后 8900 脱离脚本托管，`stop`／`status` 均退化到端口探针。③ **P3 重建（`tmp/p3a-rebuild.py` → `tmp/p3b-drop-and-verify.py`）**＝主表三列的列定义**逐字取自 `services/learn/knowledge.py` 的 `CREATE_TABLE_SQL`**、三张表**由模块 `ensure_tables()` 建**（与应用懒建同源，杜绝手打 CJK 注释造成漂移）⇒ 主表 22 → **25 列**、`qe_learning` 13／`qe_question` 24／`qe_attempt` 14；course 行逐行取 `course_ref.ref_id` 并在 `qed_course` 集合内校验后落笔（**2 行、零解析不出**）＋kp 行 0，候选池那行手写体会按 3c′ 折进主表 `angles`；练习两表 `RENAME` 让位后**按新旧列名交集回灌**（题 2 行自动丢 `course_label`／`learn_course_id`／`unit_id`＝C3＋D2；作答 6 行丢 `score_trend`＝C1、补 `owner='admin'`＝D7）再按新契约归位 flashcard／quiz 空值语义；**对拍改在 `DROP` 之前用工作树新代码直调 `MySQLPracticeStore._replay`**（该路径纯只读、不依赖重启）＝黄金 `target_kind='question'` 两行的 `interval_index`／`consecutive_correct`／`consecutive_wrong`／`due_at` **逐值相等**，kp 腿按 D3 预期消失不计红；随后单条 `DROP` 退役 **11 张**（九张在册退役表＋两枚 scratch），全库 25 → **17 张**，**12 项出口判据全绿**＝`qe_%` 恰三张且表级与列级 collation 全 `utf8mb4_0900_ai_ci`、主表 96 行＝95 outline＋1 point 零丢失、`qed_learn_%` 与 `qe_learn_%` 双双零存活、共享四张行数与基线逐条相等（1／12／96／116）。主表维持 `utf8mb4_unicode_ci`＝三裁③明写不计红。④ **P4 切换**＝`qed_engine_service.py start --wait`（不带 `--mode`，档位沿用上次）→ **只读冒烟 15 枚 GET 全 200**、四枚退役路径全 404（名单取自 `git show HEAD` 与本树的路由差集）、`/config/database` 仍回 `qed_test`、**startup 行之后日志零 `Traceback`**；业务读数＝到期队列恰 2 行且全为题目 ID、`…/narrative` 回 `available=false`＋悬空降级话术（长文正文实存按 P5 判据排除，AF 尚未产出）、point 行 `angles` 长度 1 已透到读面；8903＝`npm run build` ＋ `qed_web_service.py stop`／`start --build`（**不用 `restart`，它不构建**），首页 `<script src>` 哈希与磁盘包一致且取回 2,537,216 字节＝非「新进程＋旧包」混合态。**门禁**＝根全量 `pytest tests -q` **874 passed／1 failed**（唯一红仍＝`scripts/image-model/.keepalive.pid`，切换前后同红、非本批引入），测试未写运行库。**重启红线至此解除**。**后续（已由收尾批完成）**＝P5 黄金路径取证与真机四面复核、P6 收口（S1~S5 逐条核对记 `Achieved`、壳 Retain 归档）见上一条；**P7 生产 `qed`** 仍属人工另开窗口。零 git 提交（HEAD 仍 `1a0e14c`，回退锚 tag `p0-req137-snapshot`），改动全在工作树；逐条取证＝[REQ-137 壳](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md)「过程与证据」P2～P4 条目。
- 已完成（2026-10-22 随收尾批关闭，**REQ-137 v1.0 根私有表族定档·执行批（第六批裁决原文＝「A 全批同改」）**）：把上一条的判定批一次落成代码与文档正文，范围＝① **总纲定稿**＝`database-design.md` §五 三张逐列表 ＋ 幂等建表语句正文（`qe_learning` 13／`qe_question` 24／`qe_attempt` 14＝**51 列**，根私有族 116 → 51），四张判退表（`qe_course_state`／`qe_unit`／`qe_unit_progress`／`qe_review_task`）与 `qe_kp_detail` 的正文同批删除，§三 总览、§4.2~4.5、§7.8 随步；② **backend 改道**＝学习域三处 DDL 落到 `qe_learning`＋`qed_knowledge_point`（加 `aliases`／`narrative_ref`／`angles` 三列，22 → 25 列）＋练习域两表（`schedule_next`/`replay_due` 读时重放替掉调度表读写，`score_trend` 读时派生、`resolved` 改纯人工位）；③ **8900 端点族退役**＝编译族／单元族／候选池族与点赞腿整族下线，`/api/v1/learn/*` **36 → 27 枚**，新增 `GET /learn/knowledge-points/{kp_id}/narrative`（按 `narrative_ref` 读数据根 `parsed/**`，绝对路径与越根**双闸拒绝**）；④ **8903 三面改道**＝`LearnWorkbench` 推进读 `knowledge-points` 的 `sequence`、备注写 kp 行 `learner_note`、条级详解读主表 `angles` ＋长文走文件读腿，`LearnShelf` 徽标与进度改读 `derived`，`Practice` 选课值即 `learn_course_id`；⑤ **守护数值同批**＝端点清单 `len(inventory)` 21 → **16**、`MASTER_TABLES` 11 → 7、`ROOT_PRIVATE_TABLES` 七枚 → **三枚**、`COLLATE` 计数 9 → 5，退役面由正向断言改为**判退断言**（`CREATE_TABLE_SQL` 内零旧表名、路由表内零退役路径）；`learnPlaneCopy.test.tsx` 与 `helpPages.test.ts` 两张禁词表把「点赞／待整理／已保留／确认入库／候选／生成本条总结」等退场口径转为源码级禁现。**AF 形状最新事实**＝对方已定四表（`af_books` 22／`af_operations` 27／`af_pages` 11／`af_kp` 23），全库目标数据此直接为 **16 张**（共享 4 ＋ 根私有 3 ＋ `af_*` 4 ＋ `qt_*` 5），不走 17 的中间口径。**两处按「功能不退」取的一侧（agent 在 A 授权范围内处置，用户可改判）**＝`POST /learn/annotations/generate` 端点保留、条级腿改落主表 `angles` 数组追加（D10）；`…/kp-details/confirm` 退役、主表 point 行产面平移为 `POST /learn/knowledge-points` 直登记，AF 拉取腿日后成为同一张表的另一个产面。**两处功能缺口待用户复核**＝① 备注需该知识点**已有 kp 行**才存得下（无行时前端给下一步）；② **点赞（REQ-117 C19）与块级分组（C27）在 v1.0 无承载＝功能退出**，手册与界面文案已同步删除该口径。**门禁**＝契约 88 passed／1 failed ＋ 根全量 **874 passed／1 failed**（唯一红＝`scripts/image-model/.keepalive.pid` 散落脚本产物，属并行模型轮存量、非本轮引入）＋ `ruff check backend tests` 净 ＋ `tsc -b` 零错 ＋ `web-ui/` 内 vitest **串行 66 files／845 tests 全绿** ＋ `npm run build` ✓。**未做（归人工窗口，重启红线仍生效）**＝W1 demo 门（`qed_test` 库内按备份确认三步重建三张 ＋ 8903 一条黄金路径真机验收）与 W6 生产 `qed` 建表命令执行**均未开始**，**库内三张重建之前 8900 不得重启**（新表被懒建成空表、现网进度与知识点树立即不可见）——**该红线已随上一条的 P3 重建与 P4 切换达成而解除**；零 git 提交，改动全在工作树。逐列正本＝[database-design.md §五](../architecture/database-design.md)，决策＝[ADR 0026](../adr/0026-v1-root-table-family-freeze.md) D1~D10，取证与遗留＝[REQ-137 壳](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md)。**更新执行计划已成文**（用户
2026-10-22 指令原文＝「文档通过，现在制定更新计划代码+数据库如何更新，只做我们这块」）＝壳新增
「更新执行计划」节，把「代码＋数据库怎么更新」合成 **P0~P7 一条时间线＋五条顺序铁律＋三个暂停点**
（P0 取回退锚 → P1 只读预演与**映射预览清单** → P2 备份确认 → P3 **先停机再重建库** →
P4 重启 8900 与 8903 走 `start --build` → P5 真机 demo 门 → P6 收口 → P7 生产 `qed` 另窗口），**P0 已达成**＝用户裁「甲 快照锚点」，本轮**零 git 提交**，改为用临时索引合成整棵
工作树的快照提交（`be1ac057`）并打附注 tag `p0-req137-snapshot`（含 56 项未入库新文件与 19 项删除态，
真索引与工作树零改动）；不按轮切分提交的取证＝`web-ui/src/**` 上次入库止于 2026-10-09、
`docs/design/frontend/` 整目录未跟踪、`tests/test_web.py` 的 REQ-117 守护断言该目录内文件必存在，
只提本批文件会造出一枚自己判红的树。机理＝**原子切换**（旧名表 `DROP` 后旧代码即不可运行、新进程在旧库上启动会把新表懒建成空表），
范围只覆盖根侧（`af_*`／`qt_*` 零动作，8901 照常），并据 AF 尚未产出 `parsed/**/kp/*.md` 把
「长文正文实存」**排除出门判据**、只验悬空降级话术。**P1 已达成**（用户指令原文＝「现在进行下一步，
你可直接跑，现在开始执行」，故只读探针由 agent 直跑：经 backend `Settings`＋`_connect` 连库、只发 `SELECT`
与 `information_schema`、口令不进命令行、带中文读数落 UTF-8 文件不走 bash 管道）＝三项判据全绿
（本族 **11 张**、`qe_learning` 不存在、主表 **22 列**且三列不在位），并查出**四处与本文不符、已逐条更正**：
① **活表族是 `qe_learn_*` 而非 `qed_learn_*`**（原步骤 1 两套名字标反；取证＝HEAD 建表常量、库内最后写入
时间 2026-10-21 对 2026-10-15、两代各 95 行 `unit_id` 零重叠⇒10-18 改名是新建空表不是 `RENAME`），
据此 3c 映射源改为活表；② **练习三张 collation 仍是 `utf8mb4_unicode_ci`**（「已归一」为误记）、共享主表
两库亦 `unicode_ci` ⇒ 步骤 4 与 P3 的 collation 断言范围收窄到 `qe_%` 三张、主表不计红，且实测跨代 JOIN
直接抛 `ERROR 1267`（代码面不存在该两条表的同条 SQL，无此风险）；③ `qe_attempt` 六行回灌不撞新幂等键
（`review_date IS NULL` 在 MySQL 唯一索引中互异）；④ **到期对拍须剔除 kp 腿**（黄金样本 `id=4` 是
`target_kind='kp'`，而 `practice.py:813` 明写该腿随调度表退出，对拍只取 `question` 两行，否则 W7 硬门误触发
回退）。另两处新事实＝生产 `qed` 现测 **14 张**／`qe_%` 零张，主表 96 行＝95 行 `outline` ＋仅 1 行 `point`
（该 point 的 `summary`／`anchors` 与候选池 adopted 行逐字相同，故丢候选池零损失）。**暂停点① 同日达成＝用户三裁**
（原文＝「整代不迁，随 DROP 弃」／「折进主表 angles」／「不纳入，本窗口只加列」）⇒ 遗留快照四张零迁移、
候选池那行手写体会折进主表 `angles`（A 段新增步骤 **3c′**，SQL 正本已入壳）、主表 collation 归一不进本窗口；
**本窗口实际搬运规模＝`qe_learning` course 2 行（`math_analysis`／`linear_algebra`，零孤引零冲突）＋ kp 0 行
＋ `angles` 折 1 行**。其后续（P2～P4 已执行完毕）见上一条本轮条目。
- 已完成（2026-10-22 随收尾批关闭，**REQ-137 v1.0 根私有表族定档·文档面判定批**（其「判定不领先执行」口径与 17 张中间数已由上一条执行批覆盖并解除））：按用户裁决把根私有 `qe_*` 族由**七张收为三张**——`qe_learning`（学习记录单表，course 行＝选课与学习路径顺序／kp 行＝终态与质性门，单表继承跨角色是既有 R4 的明确例外）、`qe_question`、`qe_attempt`；整表退出四张（`qe_course_state`／`qe_unit`／`qe_unit_progress`／`qe_review_task`），其中 `qe_unit` 退出＝**编译链路整体退役**（D2），`qe_review_task` 退出＝调度态改由作答流水重放派生（D3）。配套定档＝学习课程取消独立 ID、`qe_learning.target_id` 直引 `qed_course.course_id`（D4）；共享主表 `qed_knowledge_point` 加 `aliases`／`narrative_ref`／`angles` 三列（D5，知识点长文正文落 `parsed/**/kp/<node_id>.md` 文件、**正文不入列也不入 `meta`**，落点在 ADR 0018 白名单既有区故**白名单不新增条目**）；根私有族加 `owner VARCHAR(64) NOT NULL DEFAULT 'admin'` 并把三枚唯一键改 owner 前缀（D7，`qe_question` 属题库共享面故不加 owner）；C1~C3 三处简化同批采纳（`qe_attempt.score_trend` 退列改读时派生／`resolved` 改判纯人工位／`qe_question.course_label` 退列），列数账＝根私有 116 → **51** 列、全库 21 → **17 张**（`af_*` 五→四随 REQ-136 对方随步后 16）。**本轮是判定批、非执行批**：受「DDL 围栏逐字相等」与「总览↔矩阵↔角色同集合且 `len(inventory)==21`」两组守护锁定，目标态 DDL 与逐列表格**不能内联进总纲**，故沿用既有 `qe_kp_detail` 判例的「**判定不领先执行**」范式＝DDL 正文一字不动，判定以 blockquote ＋ §三 备注列 ＋ §7.8 新增 T12 承载，逐列正本暂居 [REQ-137 壳](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md)，代码与 DDL 与三处守护数值（21→17／11→7／七枚→三枚）随 W1~W7 执行批同批改。规则级正本＝[ADR 0026](../adr/0026-v1-root-table-family-freeze.md)（D1~D9，含 D6 负面清单：不加 `is_canonical`、不加别名谱系列、不加用户表／笔记表／错题本表／知识点关系边表）。文档随步（架构与设计面六篇）＝总纲（约 16 处）、[api-contracts §⑥](../architecture/api-contracts.md)（整族退役 12 枚＋保留端点改换读源＋新增读文件腿）、[cross-project-contracts §4／§6](../design/cross-project-contracts.md)（**共享主表加列按 R3 通知、不发跨项目请求函**；提升腿列映射与两侧 `narrative_ref` 指针形态刻意不同）、[dataset-conventions](../design/dataset-conventions.md)（单一事实源表加一行）、[learning-practice-ui](../design/frontend/learning-practice-ui.md) 与 [knowledge-point-exploration-ui](../design/frontend/knowledge-point-exploration-ui.md)（两界面**本面契约零变化**，三列带来的检索命中别名与详解正文展示属新增信息面、另批承载）；`code-map.md` 映射现状代码故本批不改、随步归 W7。**在册壳与台账随步六处**＝[主链壳](../plans/2026-09-22-learning-design-mainline.md)「目标」节改判注记与关联 ADR 行、[REQ-132 壳](../history/plans/2026-10/2026-10-21-qe-family-rename-and-refactor.md) W5 判定表读法注记＋三处未裁项解答＋遗留第 1 条改判、[M2 练习轮壳](../plans/2026-10-18-practice-by-domain-and-progress.md) 概念表改判注记（本轮「三表冻结」非目标据此收窄）、[roadmap 第五轮行](roadmap.md)改判句、[todo REQ-137 行](todo.md) D1~D8→D1~D9。**本会话新查出三处待裁（不代用户决定，已记进壳与契约）**＝① `POST /learn/annotations/generate` 的条级注解腿随 `qe_kp_detail` 退出而断（章级两腿写主表 `summary`／`meta.chapter_key_points` 不受影响），建议保留端点、条级腿改落 `angles`，但此举扩了 D6 负面清单边界；② `…/kp-details/confirm` 是主表 point 行的**唯一产面**，替代它的「从 AF `af_kp` 单向拉取已确认知识点」同步腿**不在 W1~W7 范围内**且依赖对方 PLAN-024 落地，故候选池族退役**不得早于**该同步腿，否则 point 行断供、掌握门与练习归档一起空转；③ **编译端点族与 ARCH-027 主链行的 S 判据正面冲突**——该行 S2 判据原文即「链路编译…产出块序列」、S4 端到端含「注册→编译→学习→判分→推进→结课」，D2 判整链退役等于抽掉两枚判据的承载物；**改判他轮 S 判据属用户裁决范畴**（成功标准冻结，ADR 0022 决定 4），本批**未改 ARCH-027 行一字**，只落指针并在 REQ-137 壳遗留第 7 项给出三条选法，未裁前编译端点族不删。零代码、零 DDL、零库内写、零 git 提交；对方工作区全程只读。**未实测项（不得当作已核验）**＝库内行数取自 §7.8 T2 的既有文档记录，本轮只读探针因 `ERROR 1045`（未取得口令）未复算。
- 进行中（2026-10-21 本轮，**ARCH-025 轮线 2 的 REQ-136 跨项目综合请求立项＋`af_*` 面四枚出站请求并一＋REQ-128 取消**）：按用户裁决（原文＝「那么这个任务取消，然后将对Axiom-Flow的数据库修改请求挂成一个综合的todo任务到Axiom-Flow（V1.0）优化轮（解析 + 知识库）（ARCH-025）中，准备重构整个Axiom-Flow的专用版数据库结构，整合起来综合考虑一起1做」；AskUserQuestion 范围答复原文＝「并 123+129+133+135 四枚（推荐）」）把四枚在册 `af_*` 出站请求（`REQ-123` 书级三列自洽／`REQ-129` `af_parse_jobs` 保留期／`REQ-133` 结构梳理与迁移指针／`REQ-135` 档 B 整族重建＋知识点两表）合并为单枚 [REQ-136](../plans/2026-10-21-af-family-rebuild-consolidated-request.md)（挂 ARCH-025 轮线 2，R1~R5 一次谈定、只开一个回执窗口），逐列形状正本＝对方 PLAN-024（`Axiom-Flow/docs/plans/2026-10-21-af-table-family-rebuild.md`，同日定档；自家设计稿 [REQ-134](../plans/2026-10-21-af-table-architecture-design.md) 同日**退为指针**，保留作被否选项证据与取证锚）；三枚原请求稿壳按 ADR 0021 第 5 条**归并不删壳**移 [history/plans/2026-10/](../history/plans/2026-10/2026-10-21-af-family-rebuild-kp-tables-request.md) 并置 `状态：Superseded`，四条原存标准以 Not Applicable 入 [completed.md](completed.md) 并逐行写明取代关系。`REQ-128`（QED-Tracker 两张作业表保留期口径自定）同日取消、关闭结果 Not Applicable，两条依据＝① 根侧总纲 §7.9 的裁剪边界与「四类行不可裁剪」已成文，根侧既不代设数值也不代执行，发函无新增约束；② 代码查证推翻其立论前提——`qt_selections` 不是流水表而是**数据源表**（`QED-Tracker/src/qed_tracker/db/selection_repository.py:183-190` 以全表 `payload.downloads` 派生论文去重集，按时间清行即误删去重记忆）；总纲 §7.9 的立论据此更正，`REQ-129` 不随取消（已并入 REQ-136 R5）。口径随步面＝契约 §4 在途请求登记（另登 [BUGFIX-037](../plans/design-bugfix-log.md)）、总纲 §7.8 T8／§7.9、REQ-134／REQ-120／REQ-132／REQ-131 四壳指针、todo 与 completed、plans/index 归档登记、ARCH-025 壳线 2 条目与带日期戳过程行。零代码、零 DDL、零库内操作，对方工作区全程只读；对方台账两枚入站承接行（其 `todo.md:33`／`todo.md:44`）改指 REQ-136、Tracker 侧长期行 `QED-078` 的取消注记，均属发函窗口由对方自改。
- 已完成（2026-10-18 收口，Achieved，**普通任务轮 ARCH-035 第⑪行 DEFECT-017 课程侧探索失败原因落库**）：课程分支此前只写 `exploration_stage=失败`、失败原因丢弃，与领域分支不对称；本轮按用户裁决「只在线写，离线不落库」补写 `explore_pending={kind:'failed', error}`＝`tracker_client.update_course` 新增该透传且在 8901 不可达时**不降级**、直接抛错，`_write_failure` 写前读现值合并、保留同列其它 pending 键，`shared_tables.update_course` 不加该形参（课程列无直写腿，与总纲读写矩阵一致；S1 判据的直写腿半句据此改判）。顺带把 `explore_pending.kind` 值域在文档面补齐为四枚并存（8900 写 `failed`／`review_results`／`import_courses`，8901 写 `name_confirmation`／`error`）。回归＝`tests/test_explore_sessions.py` 两枚先红后绿（该文件 13 passed）。文档随步＝downloads-flow §3.1／§3.3／§5.2／§5.4（含新增成文段）、总纲读写矩阵该列改写、api-contracts 透传行、code-map 行 51。门禁＝契约 89 passed＋根全量 860 passed＋ruff 净。零 DDL、零库内写、未提交 git。
- 已完成（2026-10-18 收口，Achieved，**普通任务轮 ARCH-035 第⑧行 DEFECT-014 课程探索态越界写**）：课程 `exploration_stage` 的写路径接回对方契约＝`set_course_stage` 不再丢弃 `online`，改经 8901 `PATCH /courses` 在线写、8901 不可达或其写失败时才降级直写；新增按表分档值域闸 `_require_stage`（领域 6 态／课程 5 态），越界值抛 `ValueError`，探索采纳的课程终态由「已生成」改为「已完成」。**立项前提经实读对方代码改判**＝8901 早已透传本列（REQ-077 D3=B，仓储层 5 态校验、非法值 422），根侧 docstring 的「暂不支持」不成立，缺陷实为根侧在线写路径从未接上。两库只读实测 5 态外历史行 0 行，检出 SQL 成文于 downloads-flow §5.4；总纲读写矩阵／列注／7.8 T6、api-contracts 两处、code-map 与模块 docstring 六处同批随步。门禁＝契约 89 passed＋根全量 858 passed＋ruff 净。零 DDL、零库内写、未提交 git。
- 进行中（2026-10-18 移交，**普通任务轮 ARCH-035 第⑥行 REQ-119 四张共享表字段定档跨项目请求·本轮代登对方文档面**）：经用户放行，R1~R6 六项**同批发出**并代登进 QED-Tracker 文档面两处＝其 `docs/trackers/todo.md` 长期任务表新增 `QED-080` 承接行（Candidate／待开始，事项内逐条列出 R1~R6 与执行位）、其 `docs/plans/2026-09-24-v1-task-chain.md`「跨项目接口」节后新增「承载根仓库 REQ-119」节（**六项对接信息表**需求方／目标项目／接口面／评审方／执行方／验收标准 ＋ **R1~R6 逐条承接表**）。**代登形态**＝只改其既有两份文件、**不新建 md**，故其 `test_documentation.py` 的全量 md 等值白名单未触；「对方若另建专稿第一步须同步该白名单」写成条款留给对方。其门禁本会话代跑＝`tests/test_documentation.py` 9 passed、`pytest tests -q` 667 passed／1 skipped、`ruff check src tests scripts` All checks passed（含其窗口在树改动，未代提交、未动其代码）。**含破坏性一项**＝R5 删两枚死列 `qed_domain.path_results`／`qed_course.related_targets`（2026-10-18 用户复裁＝都删），按其 ADR 0006 表自愈形态须**择窗并先备份**。**S2／S3 未动**＝对方逐条回执与根侧 `shared_tables.py`／总纲消费语义随步仍在对方侧，本行保持 In Progress；S1 判据读法（一行承接＋逐 R 承接表 vs 严格六条 todo 行）已在承载壳「过程与证据」留痕待用户复核。

- 已完成（2026-10-18 收口，Achieved，**普通任务轮 ARCH-035 第⑤行 REQ-118 四张共享表字段定档轮·补复核＋收尾归档**）：四张共享表逐列定档与 `meta JSON` 扩展槽守则（只读不筛／不放密钥与个人信息／不放跨项目契约字段）已成文进总纲，根所属两表形状在 `qed_test` 与生产 `qed` 两库落地并零差；本轮零新代码零 DDL，只把该壳欠的两项复核补成实据＝8900 已进新代码后跑三链只读探针（知识点行 22 列无 `confirmed`／星图 200／LLM 账 116 行走三枚新索引）与库内形状核验（outline 95 行坐标非空 95/95、point 行 `book_ref` 为 NULL、去重索引已换 `idx_kp_course_kind_norm`）。**用户复裁一处**＝2026-10-15 对两枚死列的「保留（改判）」收回，`qed_domain.path_results` 与 `qed_course.related_targets` **都删**（原裁决 ③ 恢复生效），执行归 QED-Tracker，请求已写回 REQ-119 R5（R1~R6 编号不变）；`GET /llm/calls` 的 `meta` 透出本轮不补。S5「生产库 DDL 零执行」按 2026-10-17 授权执行的事实记改判、不改台账判据正文。壳按 Retain 归档 [history/plans/2026-10/](../history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md)，入站链接四处与 plans/index 同批改道。门禁＝契约 89 passed＋全量 819 passed＋ruff 净。**本轮未提交 git。**
- 已完成（2026-10-18 收口，Achieved，**普通任务轮 ARCH-035 第③行 REQ-112 开发流程演进轮·人工验收通过并归档**）：2026-10-14 三项流程裁决（1.0 前 schema 按数据可再生性分档豁免 ALTER 仪式＋备份临时制、大任务一壳一门 demo 先行、范围锁死＝文档未提及不加）已全部落进标准正文与技能指针——ADR 0024 立档、[database-design.md §7.3](../architecture/database-design.md) 四档重建档位表、task-lifecycle demo 门、development 六步第 4 步决策点、AGENTS 第一性原理半句、code-standards 范围锁死禁止项、根三技能各补指针句；零代码、零新增机械守护。壳按 Retain 归档 `history/plans/2026-10/`，ADR 0024 与 ARCH-035 壳 W21 指针同批改指。**唯一遗留**＝QED-Tracker `qed-db-alter-redline-window` 的档位指针移交单未回执（记在归档壳「遗留与移交」，可并入 REQ-124 附带处理）。
- 已完成（2026-10-18 收口，Achieved，**普通任务轮 ARCH-035 第②行 REQ-092 账本保留期策略·窄版成文＋出站请求 REQ-128／REQ-129 转达**）：四张只增不删的流水表（`qed_llm_calls`／`qt_tasks`／`qt_selections`／`af_parse_jobs`）此前全仓无清理与轮转规则也无保留期口径；本轮按用户裁决只成文口径、不写自动清理作业，落点＝总纲 [database-design.md §7.9](../architecture/database-design.md)——**取值方式＝不设固定天数、只给触发条件**（≥1 GB 或 ≥10 万行／消费端点延迟可辨识劣化／备份迁移窗口放不下，命中即另立任务），并写明三条分界（§7.9 管何时裁剪·§7.3 管能不能重建·storage-conventions 管盘上）与两条不变量（未终态行与被 `active_job_id`／`ref_id` 引用行永不裁剪；`qed_llm_calls` 可逐行 DELETE 绝不 DROP 重建）。立论取证＝现网 `qed_llm_calls` 116 行／1.5 MB、`qt_selections` 0 行、`af_parse_jobs` 7 行，无容量压力。跨项目侧两张 `qt_*` 表与 `af_parse_jobs` 的保留窗按所有权归对方自定，已发出站请求 REQ-128（QED-Tracker）／REQ-129（Axiom-Flow）并各有承接行。零代码零 DDL。**2026-10-21 随步**＝REQ-128 取消（两条依据见上方 10-21 行与本行末的 §7.9 更正）、REQ-129 并入综合请求 [REQ-136](../plans/2026-10-21-af-family-rebuild-consolidated-request.md) R5。
- 已完成（2026-10-18 收口，Achieved，**普通任务轮 ARCH-035 真机复核批·OPS-001 ＋ DEFECT-015／018／019 四行同轮关闭，跨项目请求 REQ-126／REQ-127 转达**）：控制中心停止语义改判落地＝`_stop()` 对生命周期脚本单元派发后按端口复核，外部实例（无 PID 文件而端口在听）不再返回裸 `stopping`，改 **409** 且原因给出端口反查到的监听 PID 与脚本回报原文（根侧不终止非本中心启动的进程）；四行共同的判据缺口都是「真机复核」，本轮并入用户手起服务的同一窗口一次收齐＝8903 构造外部实例形命中 409（进程全程未断、PID 文件测后原样还原）、8901/8902 经控制台 restart 后 `/services` 给出 `db_name=qed_test`／`db_source=injected`／`db_mismatch=false`、`/parsing/tree` 信封 `sources` 现网 `ok/ok`（离线与空态另有断言）、`/monitor/gpu` 连续 3 轮 200 且日志启动标记后零新增解码栈、qwen 停止路径退出 0 无 `AttributeError`。脚本层「端口兜底真停」按裁决转达两子项目并各有承接（Axiom-Flow `REQ-126`＋承接壳 `PLAN-023`，其门禁 640 passed；QED-Tracker 缺陷台账 `BUG-007`，其 `test_documentation.py` 9 passed）。设计随步 `docs/design/service-hosting.md`。门禁＝根契约 89 passed、根全量 814 passed、ruff 全绿（同轮修掉两枚由对方文档合并造成的存量死链）。
- 已完成（2026-10-18 收口，Achieved，**REQ-117 课程学习面重设计轮 ＋ 上游 REQ-070-LEARN ＋ DEFECT-016 三行同批关闭**）：
  ① **形态**＝课程学习面按总设计的生产者/消费者分工重划——目录生成·链路后台准备·知识点候选确认三件生产职责移交
  后台管理·文档分析处理（REQ-116 的 ③），学习面阅读单位改「**章 ＋ 知识点**」两级逐条推进（节层不显形，C15），
  中栏＝选中那一条的连续正文流（滚动即续），右栏＝学习交流三段（本章总结与学习要点／详解按块过滤／备注），
  推进＝正文末尾三枚（上一条／下一条／已掌握并下一条，同条再点即撤销），页头＝导航右上角使用手册／刷新／返回
  ＋课程名右侧返回书架（C22→C29 改判），左栏目录两档左缘由 `outlineRowStyle` 常量单一来源且不再显四类处理进度说明；
  ② **设计晋升**＝三界面的最后一面《课程学习》以 v2 本体一次晋升 [learning-course-ui.md](../design/frontend/learning-course-ui.md)
  （Accepted／In Progress／确认状态 暂定），至此 `design/frontend/` 三面详设齐备、学习链路唯一仍在 `plans/` 的稿＝REQ-116，
  总设计 §5 课程学习行压缩为指针（消除与详设的双写）并带动 `tests/test_web.py` 互指守护改指详设档；
  ③ **文案净化**＝`learnPlaneCopy.test.tsx` 三张禁词表 + 右栏必含词扫学习面在册源码，过程性技术术语源码级禁现；
  ④ **孤儿清扫**＝`TocConfirmPanel.tsx` 与其 8 例删除，`tocParse.ts` 经消费者取证**保留**（`stores/learnWorkbench.ts:25`
  仍消费进场自动定位，29 例在册）——用户令的删除范围按此收窄；
  ⑤ **归档**＝REQ-117 壳与 REQ-070-LEARN 壳按 Retain mv 至 `docs/history/plans/2026-10/`，入站 21 条／出站 24 条链接
  按新深度重算（含 `tech-stack.md` 两枚、`four-service-architecture.md`、`history/adr/v0.1/0004`、8 月归档壳两枚），
  `plans/index.md` 改归档形态条目。门禁＝契约 88 passed／1 failed ＋ 全量 813 passed／1 failed（唯一红＝并行
  REQ-120/121 共享表轮在途的 QED-Tracker 死链）＋ ruff 净 ＋ `tsc -b` 零错 ＋ vitest 串行 66 files／843 tests ＋ build 过。
  **不留尾按用户 2026-10-18 裁决**＝LLM 腿不入判据：提问后端功能腿与生成／点赞两腿的 8900 重启后真机取证（含复验残留
  `kpd-122bd665e6ad`）留挂 ARCH-027 主链 M-2/M-3，知识点生产腿归 REQ-116，教材卡书级两列待 REQ-121 回执。
  **本轮未提交 git，改动全在工作树。**
- 已完成（2026-10-17 收口，本轮＝**REQ-122 文档面：`database-design.md` 升为三项目数据库总正本**；纯文档＋契约守护，零代码零库内改动）：
  按 [ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md) 把
  [database-design.md](../architecture/database-design.md) 整篇重写为八段骨架（前言 → 遵循的规则 R1~R12 →
  全库总览 21 表 → 整体架构五节（访问拓扑／跨族数据主线／双 ER 关系视图／读写矩阵／表角色分类）→
  详细设计 11 表 → 他项目表族与同步契约 → 变更与运维规范 → 守护与验证），
  共享 `qed_*` 四表与根私有 `qe_*` 七表**逐列定义＋建表语句入文档**（根侧九表与代码渲染结果逐字对齐、
  受托两表按 QED-Tracker ORM 等价展示），`qt_*`／`af_*` 只在总览登记与路由，其同步口径由六章同步矩阵定
  （共享表以此为准、双向通知，专用表只在表级变更时同步表信息）；正文去过程化且**去任务编号引用**，
  一次性事实全落备注列与 7.8 的 T1~T9。守护四枚新增（DDL 逐字对齐／等价展示对齐／小节四件套／
  总览↔矩阵↔角色分类同集合）并逐枚变异验证打红后还原，`erDiagram` 守护保留、零建表语句断言删除。
  随步三处＝`architecture/index.md` 描述、`cross-project-contracts.md` §4 在途请求登记
  （REQ-122 → Tracker R1~R3／AF R4~R5）、REQ-120 壳补登库内双前缀与 `RENAME` 清单过期事实。
  **本行曾于同日按 Achieved 关闭，后因用户五点优化裁决（壳 W10）收回关闭，W10 落地后二次关闭**；壳已按 Retain 归档至 [history/plans/2026-10/](../history/plans/2026-10/2026-10-16-database-design-core-registry.md)。门禁＝契约 89 passed ＋ ruff 净 ＋ 全量 805 passed／5 failed（五枚归属并行窗口新增用例，其实现未落＝对方 TDD 先红，非本行引入）。**本轮未提交 git**；待办＝请求稿 R1~R5 转达、REQ-120 W4 库内批次与七表表名终定、`qt_*`／`af_*` 逐列晋升批次待排期。
- 已完成（2026-10-17 收口，**普通任务轮 ARCH-035 台账清理批·第①组六行同批关闭**）：纯台账与状态面（零业务代码改动）。OPS-002、ARCH-037、ARCH-038、ARCH-039、ARCH-040、ARCH-041 六行按 **Achieved** 移 [completed.md](completed.md)，壳 W15~W20 改已收口，逐 S 取证与收口门禁（后端定向 182 passed、web-ui 三档 vitest 64 passed、`tsc -b` 零错、`npm run build` 出最新 dist）写在 completed.md 六行与壳「过程与证据」2026-10-17 行。**用户裁决一处**＝ARCH-041 的「真机跨服务并发」加验项取消（同单元在飞期间该卡按钮不可点、形态在真机不可构造；用户确认不同服务卡并发操作互不影响），8903 `#/admin` 视觉复核通过。控制台可用性面（OPS-002 + ARCH-037~041）至此六行全关，同轮只剩 DEFECT-015（真机面待 8900 重启后复核）。本轮未提交 git。
- 已完成（2026-10-17 收口，**普通任务轮 ARCH-035 台账清理批·第③组待裁项 + 三行关闭**）：纯台账与文档面（零业务代码改动）。① 待裁项四项裁决落地＝REQ-091 按 Partial 关闭（S1 会话持久化与 `downloads-flow.md` §8 已知约束「不做持久化会话」冲突判为不做；S2 经实读 `services/explore_sessions.py:_write_failure` 确认为真实缺口，另登 **DEFECT-017** 支线行）、REQ-096 按 Not Applicable 关闭并迁入 [路线图](roadmap.md)「存储对账与库盘一致性只读核验」长期能力依赖、ARCH-039 S4 判据改判为「`admin-console.md` §3 与 §3.3 同文一致」（顺手修掉 §3「三槽位卡」与 §3.3「两卡」自相矛盾，登 BUGFIX-034）、ARCH-036 完成清理与真机复核后关闭；② 三行 Achieved 关闭＝**ARCH-036**（运行时产物与备份面规范化：ADR 0019 + `storage-conventions.md` 长期哨兵区 + `logs/` 二批清理删 61 枚零引用件、7 枚被文档认领证据件按用户裁决保留作例外并登记名单，壳 Retain 归档 `history/plans/2026-09/`）、**DEFECT-007**（8900 日志视图按实际写入点解析，重启后 `GET /services` 四单元 `log_path` 全部 exists=True 且 `/logs/*` 四路 200）、**DEFECT-009**（知识点两表懒挂载一次性闩改 60s 短窗降级 + 星图走统一挂载入口，`/learn/kp-details` 与 `/learn/star-map` 复核 200、`math_analysis` 行 `kp_confirmed=1` 不再假 0）；③ 真机复核由用户授权以**只读 HTTP 探针**完成（禁代理直连 127.0.0.1:8900，零写操作）；④ 门禁＝契约 83 passed，两枚存量红属并行窗口（`database-design` 逐列小节、`scripts/image-model/.keepalive.pid` 保活残留），归因不修。**本轮未提交 git，改动全在工作树**；`dataset/backups/` 清空仍是数据根 D 类人工步骤（agent 无权限核验）。
- 已完成（2026-10-17，本轮＝**REQ-123 移交 Axiom-Flow + DEFECT-015 实施（S1~S4）**；根侧有代码改动，真机面待 8900 重启后复核）：
  ① `REQ-123` W3 经用户评审放行 ⇒ W4 移交在对方文档面完成（其 `todo.md` 新增 `REQ-123` 支线行、其 PLAN-019 壳新增
  「承载 REQ-123」节与工作项 W10/W11；对方门禁本会话代跑 640 passed / 10 skipped + ruff 净），代码面执行与回执归对方窗口；
  ② `DEFECT-015` 四点全落＝8900 托管派发子服务时注入根解析的 `QED_DB_*`（只及子进程，根 `.env` 仍是唯一配置源、不新增变量）、
  `/services` 透出各单元 `db_name`/`db_source`/`db_mismatch` 并在不一致时向事件账记一次告警、
  `GET /parsing/tree` 改信封 `{nodes, sources}` 使「共享表为空」与「8902 离线」两种同形空态可区分（8903 左树按 `sources` 分话术）、
  口令与 `QED_DB_*` 键名经响应＋日志全文扫描零命中；文档随步五篇（api-contracts / service-hosting / parsing-flow §9 /
  project-configuration / parsing-ui）＋登 [BUGFIX-033](../plans/design-bugfix-log.md)（对方 `AXIOM_MYSQL_*` 别名在活源码零命中）。
- 已完成（2026-10-17，本轮＝**并库取证 + `qed` 库结构对齐与关键数据回灌 + 两笔登记**；零代码改动，
  8900 重启后的真机复核仍未跑）：① 归因结论——8903 文档下载管理／文档解析管理两页空数据不是界面缺陷，
  而是**库名分叉**（写入落 `qed`、读出连 `qed_test`）；三份 `.env` 实测钉库后按用户裁决收敛为
  **单一工作库 `qed_test`**（不新增环境变量键、保留「按根配置启停 8901/8902」的既有行为），两服务经 8900
  控制接口重启。② 生产 `qed` 库已完成结构对齐（14 表逐列零差）与关键数据回灌，可作生产库待命；
  根私有 `qe_*` 七表（库内现名仍为 `qed_learn_*`／作废名 `qe_learn_*`）**未**回灌（待 REQ-132 W4 的建表
  清单随发布批次执行后整族快照）。③ 两笔登记＝
  **DEFECT-015**（跨服务配置一致性：8900 托管子服务时并不注入根 `.env` 的数据库配置，当前两库一致属巧合；
  修向三条见行内 S1~S4，待开始）与 **REQ-123**（`af_books` 书级三列回写与跨库分叉归一，Axiom-Flow 承接
  请求稿，停在待用户评审放行移交；2026-10-21 该稿并入综合请求 [REQ-136](../plans/2026-10-21-af-family-rebuild-consolidated-request.md)）。④ 口径修正——`af_books.parse_status` 恒 `pending` 是 Axiom-Flow
  ADR 0007 决定 3 的**设计口径**（`parse_status` 只表进度、`last_parse_result` 表结局、就绪判据取
  `active_job_id` ＋页行），不是缺陷，本轮「8902 不回写状态」的原假设经复验撤回；因此查出的两处文档失真
  已修：[cross-project-contracts.md](../design/cross-project-contracts.md) §3 库名现状列（BUGFIX-031）、
  [parsing-flow.md](../design/parsing-flow.md) §9 降级矩阵漏记 `GET /parsing/tree` 在 8902 离线时仍返 200
  空书目这一支（BUGFIX-032）；承载壳见 [REQ-118](../history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md) 与
  [REQ-123](../history/plans/2026-10/2026-10-17-af-books-parse-status-request.md)。

- 已完成（2026-10-14 收口，Achieved，**REQ-107／REQ-108／REQ-109 论文线界面两轮＋设计晋升**）：8903
  文档下载管理的论文面从「黑盒检索＋行内展示」改为**可审阅界面**，设计正文已晋升
  [downloads-ui.md](../design/frontend/downloads-ui.md) §4.4（入口／弹窗五段／检索方向映射／待选区间／历史探索清单／
  领域论文栏／详情与按需回源／规则八节）与 [downloads-flow.md](../design/downloads-flow.md) §7。用户可见形态：
  ① 入口三处（领域右键／汇总行按钮／课程卡）同一个弹窗，按钮与汇总信息同排右靠齐，活动态徽标在按钮左侧；
  ② 弹窗五段＝检索方向 → 轮询 → 检索口径 → 候选评审 → 采纳回显，**检索口径段**把实际下发的年窗／抓取量／
  探索目标原样回显，模型计划走兜底时出警示徽标与逐条 `search_failures`；③ 检索方向四值（前沿／核心／深度／
  匹配）由根侧参数映射承载（`paperDirections.ts`：深度复用 `core` 且年窗不限、匹配复用 `frontier` 且近 10 年，
  8901 `RECIPES` 零改动），一次固定 5 篇且界面不露推荐上限入参；④ 段④只列**未采纳且达线**候选
  （`goal_fit ≥ 4` ∧ `score ≥ 80` ∧ 被推荐 ∧ 未在库），头部三段计数「候选 N｜待选区间 M（未达线 X）｜已剔除 J」，
  未入选逐条归因；⑤ 历史探索清单＝一个按钮（计数＝待决定报告数，为 0 时禁用），展开只列待评审报告且新在前、
  点行直达段④评审；⑥ 左树派生「论文」节点＋右栏**领域论文栏**卡片列，旧的两级论文展示行整行删除（铁律＝
  论文视图不读不写 `exploration_stage`）；⑦ 候选详情出标题／摘要／评审小结，已入库信息按需回源（点击才发、
  单领域、≤20 份、失败静默），引用数只留位不显示 0。**真机取证**＝四方向各发起一次真实探索（均经弹窗段①）：
  前沿 `ranked`（评估 23／推荐 5），核心／深度／匹配三份 `no_candidates`——归因在对方检索计划的分类越界
  （`math.RA`／`math.GR` 不在 `allowed_categories`）、模型计划响应 577 字符截断、兜底检索词为中文整句，
  **属机器／模型侧不是界面缺陷**；全程只 `POST /papers/recommend` 四次，未采纳未取书未写 `dataset/`。
  门禁＝`vitest` 串行 + `tsc -b` + `npm run build` 绿、根侧契约 + 全量 pytest + `ruff` 绿，浏览器 36 条请求
  全指 8900 且 200、控制台零消息（in-app viewport 0×0 ⇒ 未做像素级视觉验证，以几何度量＋DOM 快照留证）。
  **采纳＋取书端到端证据**沿用 REQ-102 W5（`mathadvanced-b19` 至 `verified`），本轮按用户裁决不重跑。
  **两枚界面口径缺口按用户裁决不登 todo**，候选修复写在归档壳「遗留与移交」＝段③年窗只读配方缺省值与方向
  覆盖值（深度 0／匹配 10）可能不符、汇总行徽标只按最新一份报告派生（一份 `no_candidates` 会让待决定报告
  失去提示）。执行与逐条对照见 [REQ-107 壳](../history/plans/2026-10/2026-10-11-paper-explore-ui-and-papers-column.md)、
  [REQ-108 壳](../history/plans/2026-10/2026-10-11-paper-ui-implementation.md)、
  [REQ-109 壳](../history/plans/2026-10/2026-10-11-paper-ui-iteration-2.md)（三壳 Retain 归档，本轮未提交 git）。

- 已完成（2026-10-16 收口，Achieved，**REQ-105 课程学习面 v1 轮**）：单屏三栏学习工作台（`#/learn/c/:courseId`，目录＋正文＋推进与批注同屏、无模式切换，R7）＋自动目录（进场扫 1–20 页定位并整树写入，置信不足降级「修改目录」，R8）＋多教材按注册顺序拼成一条目录（R9）＋书架信息面（领域下拉／星图 stage×主轨×sort_order 竖排／「学习进度 XX%」徽章）。S3 真机端到端全链取证＝另建临时演示课程走完 注册→自动目录 95 行→选节版式渲染→批注候选→驳回→勾选 1/86→撤销→补勾 85 节→真机点末节到「已结课 · 86/86 · 100%」，真实课程 `lc-3e6a94085b80` 零写入，请求账全指 8900；冒烟残留 95 行 outline 按用户裁决「备份后外科 DELETE」清退（备份 `logs/req105-smoke-residue-real-analysis.json`）。设计本体**留改不晋升**（用户 2026-10-15 裁决），随壳 Retain 归档 [REQ-105 壳](../history/plans/2026-10/2026-10-11-learn-ui-course-study.md)，[前端总设计 §5](../design/frontend/frontend-overview.md) 的课程学习指针改指 [REQ-117 重设计轮](../history/plans/2026-10/2026-10-15-learn-course-study-redesign.md)（登 BUGFIX-030）；三项冒烟新发现（首页卡「编译链路」措辞、`units` 重复取数与进场 86 次 `PATCH`、同 `course_ref` 双学习课程静默绑定）与两处实现/设计漂移同批移交 REQ-117（其 W7）。门禁＝契约 82 · 全量 746 · ruff 干净 · `tsc -b` exit 0 · vitest 串行 63 files/762 tests。**本轮未提交 git，改动全在工作树**（与 REQ-113/114 知识探索线并行在飞）。
- 已完成（2026-10-14 收口，Achieved，**REQ-106 课后练习独立面＋设计晋升**）：练习与复习脱离三栏
  工作台，独立面 `#/practice` 上线并真机全绿——页头课程选择器（选项值＝共享课程目录坐标
  `course_ref.ref_id`）＋今日面板（一行计数「今日到期 N／错题 M 未解决（共 K）」＋到期复习队列＋错题本，
  同屏两段无 Tabs，计数与队列走单请求 `max_tasks=100`）＋题源工作区（题源书＋页范围 → 抽取预览 →
  人工确认入库 → 本课题卡作答判分）；归属＝课级全量（题列表/队列/错题本都不传 `kp`、入库 `kp_id` 留空、
  题行 `kp_id` 只作归属标签），`gen_batch` 保持 `workbench-extract` 不改值；首页「课后练习」卡占位移除，
  三大入口卡齐备，本面与星图／工作台零跳转（**入口唯一**＝`Home.tsx` 一处 `href` ＋路由注册，跨面零出口
  由四份用例断言守护）。真机＝b05 页 45–47 抽取 29 草稿→确认入库 POST 载荷 `kp_id:null`→回执「入库 0 题
  （跳重 1）」（幂等）→作答「最近判分：判错·趋势 declined」＋错题 1→2；28 条请求全指 8900 全 200、控制台零报错。
  **设计晋升（按用户指令）**＝[learning-practice-ui.md](../design/frontend/learning-practice-ui.md)（`确认状态：暂定`，
  ADR 0017 骨架 §1~§9，§7 抽取纯函数 8 条规格为唯一正本），练习相关描述与约定收束于该档：
  `frontend-architecture.md` `#/practice` 条目压缩为路由行＋指针，`exerciseParse.ts`/`ExerciseConfirmPanel.tsx`
  「规格正本」改指新档。三面同批晋升的 1011 裁决据此**部分改判**：REQ-104/105 两面仍留 plans/ 待晋升，
  新档转正待人工评审。门禁＝`tsc -b` 0 错、vitest 63 files / 748 tests（串行）、build 成功、契约 82 +
  后端 737 passed、ruff 干净。执行与取证见 [REQ-106 壳（已归档）](../history/plans/2026-10/2026-10-11-learn-ui-practice.md)。
  **本轮未提交 git，改动全在工作树**（与 REQ-105 练习区移出并行在飞）。

- 已完成（2026-10-09 收口，Achieved，**REQ-102 论文展示行与行内探索·根侧实现**）：8900 论文透传面五端点（`GET /papers/books` 固定 `kind=paper` + recommend / selections 列表与详情 / adopt，纯透传不补默认 domain）+ 8903 文档下载管理页**两级论文行**（领域级挂领域卡、课程级挂课程头，空则整行隐藏；五档状态徽标由「任务态 × 报告态 × 书五层态」派生，口径唯一事实源 [downloads-flow.md](../design/downloads-flow.md) §7.2）+ 论文探索管理弹窗三段（发起 recipe 前沿|核心 → 5s 轮询 → 候选评审与逐条落位（领域|该领域下课程）→ 采纳回显；入口两处＝领域右键与汇总行按钮、课程行无入口；采纳**不自动下载**，取书由书目详情显式 `POST /books/{id}/fetch`）。设计五面晋升（downloads-flow §7、[downloads-ui.md](../design/frontend/downloads-ui.md) §4.4、dataset-conventions、[api-contracts.md](../architecture/api-contracts.md) §③、cross-project-contracts §5）。**真机端到端取证（W5）**＝领域级 `sel-20261009T031317Z-8a886b24`（21 候选 / 4 推荐）与课程级 `sel-20261009T033359Z-62ac54a4`（30 候选 / recs 1-10）均 `plan_source=llm` → adopt 建 `mathadvanced-b19`~`b22`（其中 `b21` 由 8903 弹窗真实发起、落位 `probability`）→ 显式取书落盘两 PDF 带 sha256 → `b19` 经 8903「验证通过」按钮（人工验收）至 `verified`、`b22` 至 `downloaded`；同一屏领域行「论文（2）」与课程行「论文（1）」渲染、徽标覆盖 待下载／下载成功／已完成／失败。门禁＝根全量 pytest **734 passed**（三红全属并行学习线在途收口，无 papers 路径失败）+ `ruff check backend tests` All checks passed + `web-ui/` 内 vitest **624 passed / 58 files** + `tsc -b` 零红 + `npm run build` 成功；浏览器实测 `#/admin/downloads` 网络 73/73 全部指向 8900 且 200（ADR 0007）、控制台零报错，in-app viewport 0×0 ⇒ **未做像素级视觉验证**（证据＝结构快照 + 请求/任务/落盘记录）。W5 唯一硬卡点归因＝**机器侧**：8901 下载器按根 `.env` 的 `QED_PROXY` 指向本机已关闭的代理 → `[WinError 10061] 目标计算机积极拒绝`，用户重启该代理进程后零改动跑通（与「回环被系统代理劫持成假 502」是两个不同失败面）；对方 8901 网关客户端 `trust_env=False` 与 `llm_json` 围栏抽取两处修复同批真机验证生效。**不留尾**：8900 `POST /books/{book_id}/fetch` 透传返 200 而契约与 8901 均为 202（归属登记，是否立 DEFECT 待裁）；对方错误文案按渠道归因与另三份 advisor 容错对齐仍待裁。取证与逐条对照见 [REQ-102 壳（已归档）](../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md)。

- 已完成（2026-10-09 收口，Achieved，**ARCH-027-M1 学习面 UI 与渲染基线**）：**正式课程学习界面前后端调通**——8903 新增学习书架 `#/learn`（课程卡 + 状态徽章词本身承载口径「待建链路／草稿／在学 N%／已结课」+ 引用式注册弹窗），三栏工作台 `#/learn/c/:courseId` 加**「阅读／链路」双模式**；链路通路端到端＝`GET …/outline` 节级页窗 → `PUT …/syllabus` 写 `source_ref`（book + 页窗）→ 两级确认 → `POST …/compile/propose` + `…/compile/start` → 中栏按页窗复用解析管理版式渲染 8900 透传产物；推进＝学习者勾选（`POST …/progress` 的 done/skipped ＋ `PATCH /learn/units/{id}` 的 `covered`），断点与续学取 `derived.current_unit_id`，看板与结课面板**只读**消费 `GET …/courses/{lc}/progress`（读时派生重算，撤销勾选后数字自然回退）。渲染基线四面核销＝公式（b05 p.10–11 学习面出 KaTeX 260 节点，老代带 `$$…$$` 的 latex 正常渲染）·表格（p.36 表格块出真 `<table>`）·图片（用户裁决 ①＝整页页图 + 块 `bbox` 百分比内联裁切，无地址或无框回退题注；canvas 取样证 bbox 区 sd 57 vs 页边 sd 0）·版面（重排流入 A4 纸面、页眉页脚默认隐藏）。真机＝9 章 / 86 块全部有页窗且 `gen_status=generated`、进度 0/86→2/2 出「已结课」、「回到断点」正确选中、网络请求全指 8900、控制台零报错。本轮内关闭 **BUGFIX-026**＝书架把书目（8902 透传）与课程／星图同批取数，解析侧离线时整面报「书架数据不可达」违反独立性铁律 → 改书目独立取数 + 素材下拉降级文案（`LearnShelf.test.tsx` 8 绿）。门禁＝根全量 pytest **735 passed / 2 failed**（两红为并行 ARCH-027-M2 收口在飞件 `plans/2026-09-23-practice-review.md`，归因不修）+ `ruff` All checks passed；`web-ui/` 内 `tsc -b` 零错 + vitest **58 档 626 passed** + `npm run build` ✓。设计晋升＝[parsing-ui.md](../design/frontend/parsing-ui.md) §9（image 块页图裁切口径）+ [learning-workbench-ui.md](../history/plans/2026-10/learning-workbench-ui.md) §12/§13（书架与双模式、勾选式推进与只读看板结课、链路降级矩阵）+ [frontend-architecture.md](../architecture/frontend-architecture.md) 信息架构补 `#/learn` 与双模式行；D1~D4 全按推荐口径批复。**不留尾**：错题本页面归 ARCH-027-M2 判据、LLM 生成正文归主链 M-2、服务端掌握门归主链 M-3、UI-5 Little Tutor 选区追问归属待用户裁；取证与逐条对照见 [M1 壳（已归档）](../history/plans/2026-10/2026-09-23-learning-ui-rendering.md)。
- 已完成（2026-10-05 收口，Achieved）：**书籍目录知识点树与三栏学习工作台（ARCH-027-M6）**——知识点两表 v2 层级化（主表同表分层：`node_kind`＝outline 章/节 + point 细知识点，配 `parent_kp_id`/`depth`/`book_ref`/`source_ref`；候选池加 `intent`/`book_ref`）+ 目录页文本纯函数解析与整树写入（`api/learn.py` 21→24 端点）+ 8903 三栏工作台 `#/learn/c/:courseId` 与「批注→候选→确认」闭环。收口批修掉真机暴露的两枚缺陷＝**DEFECT-010**（叶节点显式 `children: []` 仍被下探，两级树判成三级，目录导入恒 422）与 **DEFECT-011**（用户裁决＝主表 `(course_id, book_ref, norm_key)` 唯一键**降级为普通索引** `idx_kp_course_book_norm`，跨章同名节合法——b05 实测「级数」「积分」各出现两章，去重改由服务端承载＝outline 同父级重名 422、point 提升重名 409；两实现复用键改「父级 + `norm_key`」）。门禁：契约 **82 passed** + 根全量 **721 passed** + `ruff` All checks passed；`web-ui/` 内 `tsc -b` 零错误 + `vitest run` 全量绿（M6 相关 8 文件 71 passed）+ `npm run build` 产出 dist。8903 真机黄金路径通过（选书 b05 → 目录导入 `PUT /outline` 200 `created=95` → 中栏第 3 章 49–56 页逐页 200 按版式渲染 → 点块出锚点 → 批注 `POST /learn/kp-details` 200 → `/confirm` 200 提升主表），58 条网络请求全指 8903 资产与 8900、无 4xx/5xx；`GET /api/v1/learn/courses` 由 503→**200**（W1 懒挂载，判例 DEFECT-009）；in-app 浏览器 viewport 0x0 ⇒ **未做像素级视觉验证**（证据＝结构快照 + 请求账 + 库面读数）。设计晋升 [learning-workbench-ui.md](../history/plans/2026-10/learning-workbench-ui.md)（Accepted / Implemented）并同步 database-design / api-contracts §⑥ / code-map；过程与七项裁决 + R7~R10 + DEFECT-011 改判见 [M6 壳（已归档）](../history/plans/2026-10/2026-10-01-toc-knowledge-tree-and-learn-workbench.md)。**不留尾**：LLM 一键生成叙述移交 ARCH-027-M3（前置＝其 S4 真机冒烟）、学习进度与掌握态归主链 M-3、生产 `qed` 库的 v2 DDL 与索引变更属 D 类转人工随发布批次执行。
- 已完成（2026-10-09 收口，Achieved，ARCH-027-M2 练习与复习；后端批 2026-10-05 + 前端批 2026-10-07 + 端到端批 2026-10-09）：**课后练习面 S1~S3 真机端到端跑通并整行收口**——
  后端＝练习域三表（`qe_question`/`attempt`/`review_task`，首个练习请求懒挂载）+ `MySQLPracticeStore`
  与同形 `InMemoryPracticeStore` + 确定性判分规则层 `services/learn/grading.py`（M-3 缝 1~7 由本壳冻结）
  + 8900 八端点（`api/learn.py` 24→32）+ `GET /learn/question-books` 透传 8901 `roles` 过滤；
  前端＝`exerciseParse.ts` 纯函数切题（答案来源六态、无答案题按裁决 ⑨ 回落闪卡自评）+ 中栏「练习」区
  （题源书与页范围→抽取预览→人工确认入库→题卡作答→判分后展开解析）+ 右栏 Tabs「批注与候选」/
  「本章练习」（到期复习 + 错题本人工位，错题本**不独立成页**）+ 复习入口（星图课程框悬停行「今日复习 N 条」
  与课程知识点页页头按钮）。判分依据不进题面（缝 2 投影剔除）。**题源可达性已核并修正**（2026-10-07：
  8901 `qt_books.course_id` 现网全空、`af_books.parse_status` 恒 pending ⇒ 端点改「8900 侧过滤 +
  课程归属回退解析表」并暴露 `parsed_pages`，前端题源面只列已解析书；重启后复验 `?course=math_analysis`
  由 0 本→10 本，唯一可抽题源＝教材 b05，7 本题源书全部未解析属人工批准的数据窗口）。生产 `qed` 库不 ALTER（D 类转人工）；
  **收口取证（2026-10-09 真机端到端）**＝`#/learn/c/math_analysis` 选书→章节「第 2 章 基础拓扑」→题源 b05
  页 45–47 → 抽取 **29 草稿** → 人工确认入库 **2 题** → 作答判分（判错、关键词命中 0/2，评分依据只在作答响应展开
  ＝缝 2 成立）→ 右栏到期 **3**／错题本 **1** → 队列内答对使错题 `resolved`、同题任务 `interval_index` 0→1
  且 `due_at` 顺延（判分 + 趋势 + 调度回写同事务＝缝 6）→ 闪卡「翻开背文→重来/记得」自评 → 人工位收藏
  （`PATCH /learn/attempts/3` 在事务外）→ 复习入口回跳（星图/课程知识点页「今日复习 1 条」）。库面三表
  2/5/3 行、重启后仍在（S2 进度不丢）。收口批修掉真机暴露的两枚语义缺陷（壳条目承载 + 回归锁用例，不另立
  todo 行，编号 DEFECT-012/013）＝**DEFECT-012** 闪卡自评沿用「判对/判错」文案（改「已记住/未记住」）、**DEFECT-013** 题卡随写后重取卸载导致
  判分反馈消失（右栏顶行新增持久「最近判分：〈口径〉·趋势〈trend〉」）。门禁：端到端批根全量 pytest **737 passed**、
  收口批复跑（除 `tests/contract`）**655 passed** + `ruff` All checks passed；`web-ui/` 内相关 5 文件 **30 passed**、
  全量 vitest **串行 58 文件 626 passed / 0 failed**（并行轮唯一红
  `components/parsing/BlockList.test.tsx` 单跑 20 passed、串行不复现＝jsdom 并发顺序污染，归 parsing 线）、`tsc -b` 零错、
  `npm run build` 成功；网络账 **90 条请求全部指向 8900 且全 200**、无 8901/8902 直连（ADR 0007）。in-app
  浏览器 viewport 0×0 ⇒ **未做像素级视觉验证**（证据＝结构快照 + 请求账 + 库面 SQL）。设计与取证见
  [M2 壳](../history/plans/2026-10/2026-09-23-practice-review.md)「过程与证据」各节；UI 口径晋升
  [learning-workbench-ui.md](../history/plans/2026-10/learning-workbench-ui.md) §8/§8.1/§9（含自评两套文案与最近判分持久行）与
  [learning-star-map.md](../history/plans/2026-10/learning-star-map.md) §8/§9/§10。**不留尾**：v2 两段式生成出题另立任务行；
  7 本习题集的下载与解析属 D 类数据窗口转人工（题源门槛 `parsed_pages>0` 随动，无需改码）；生产 `qed` 库三表
  DDL 随发布批次。
- 进行中（2026-09-30，挂普通任务轮 ARCH-035 W11/W12 治理批次）：**台账行承载「任务描述 + 成功标准」，过程与证据落壳（ADR 0023 七条决定 + C1 叙述收敛）**——用户裁决「最关键的是任务描述与成功标准（固定验收标准），细节证据/下一条件写入 plans/设计文档」：todo 表头六列改 `ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准`，原「证据/下一条件」列退役，24 行整批迁移（判据条目化 `S1…` ≤400 字符、禁日期与进展词）；壳侧「目标与成功标准」判据表改指针（正本在行），14 个在途壳补带日期戳的 `## 过程与证据` 节；守护随步＝G2 改判为 `test_todo_success_criteria_column_is_fixed_and_bounded`、新增 G7 `test_active_plans_carry_a_dated_process_log_section`、跨项目回执守护改查承载壳（`test_cross_project_collaboration`）。C1 叙述收敛（用户裁决「文本流程归一 + 集成，批三守护增量不做」）＝登记与收口细则唯一正文在 `task-lifecycle.md`，todo「规则」节改「列 → 判据出处」指针表，`development.md` 删三条 ADR 复述与重复命令块、AGENTS.md 删两条重复 bullets 改指针、doc-governance「任务与文档绑定」指针化、四枚 `qed-*` 技能薄化。ADR 0020/0021/0022 各补「被后续结构改判」关联（决定与状态不变），`adr/index.md` 下一个可用编号→0024。
- 进行中（2026-09-30，挂普通任务轮 ARCH-035 W10 治理批次）：**任务治理链路口径澄清入档（ADR 0022 七条决定）**——全链路梳理（task-lifecycle + adr-governance + ADR 0016/0020/0021 + 六枚契约守护 + 四枚 `qed-*` 技能 + development/AGENTS）后收口四类互相打脸的口径：① 缺陷登记是「B/C 类必须建独立计划」的已裁决例外（承载轮壳条目 + 回归测试）；② 缺陷与小修两通道判据（改代码行为 → DEFECT-NNN 入 todo；只改文档正文 → design-bugfix-log）；③ 关闭结果按「目标与成功标准是否全部达成」取值，移交型关闭的残余另登他轮行；④ **成功标准冻结与不扩载**——确认后即范围上限，只能加工作项条目或另登行/壳，改该节须用户确认 + 壳内裁决记录（长期壳只免收口不免范围）；⑤ 归并、降级与改判他轮归属须用户裁决；⑥ 技能正本为 `.qoder/skills/`，其他 agent 侧副本不计差异；⑦ 关闭证据允许「待提交」占位。落点＝ADR 0022 + index（下一个可用编号→0023）+ 0016/0020/0021 反向关联 + `task-lifecycle.md` / `doc-governance.md`（多壳任务改按子项 ID 一行一壳）/ 根 `AGENTS.md` / `development.md` / 三技能 + todo 规则节。**未纳入**：批三守护增量与规则重述收敛（C1）待另批。
- 进行中（2026-09-30，挂普通任务轮 ARCH-035 W3 治理批次）：**轮次承载纪律入档（ADR 0021：轮次不增设 + 一行一文档锚）**——新增两枚契约守护：G5 要求 todo 每行任务列必须链接一个仓库内文档（镜像链接或行内锚，链接文件须真实存在），G6 要求分节标题里出现的任务 ID 必须是台账活跃行（关闭轮不留节）；归并只动台账行与分节、**被归并的活跃轮壳保留执行与取证面（归并不删壳）**。首批判例整改＝撤销已关闭的「存储链路规范化轮（ARCH-032）」节，其残余支线 REQ-091/092/096 补行内锚并入普通任务轮；在途的「运行时产物与备份面规范化轮（ARCH-036）」按裁决**降级为支线并入同一节、其壳不动**；OPS-001 / REQ-031 入普通任务轮待开始条目，REQ-050 补文档治理锚；REQ-006（8903 主体学习界面 + 后台管理）按「达成即收」关闭——管理后台面已随 ARCH-011 落地为达成项，学习界面线移交 ARCH-027-M1 壳，roadmap 两行随之改指 ARCH-027 / ARCH-027-M1。普通任务轮自本批起声明为新增小任务的**默认落点**。
- 进行中（2026-09-29，挂普通任务轮 ARCH-035 W2 治理批次）：**任务收口纪律入档（ADR 0020）**——todo 状态列枚举封闭（终态词不得留行）、证据/下一条件列 ≤400 字符、活跃壳工作项全达成即须关闭「达成即收」，三条契约守护落地；无终态的调试/优化/观察窗工作改走 `类别=长期` 行 + 壳声明`长期滚动：无终态`。首批判例整改＝**本地模型线拆分为「稳定性轮主线 + 长期线」**：[ARCH-028 稳定性轮](../plans/2026-09-23-local-model-stability-round.md) 主线保留 W9 显存水位门 + W11 网关请求侧熔断（关闭不再等真崩），W6/S3 掉线根因定谳观察窗移交新建长期线 [REQ-100 本地模型调试与优化](../plans/2026-09-29-local-model-debug-optimization-longterm.md)（L1~L6 滚动：定谳取证、水位/宽限/退避标定、空闲驱逐观察、吞吐画像）；DEFECT-005 单活仲裁竞态已按新节拍关闭（进程级互斥 + 回归用例，真机复核观察移 REQ-100）。
- 进行中（2026-09-22 并轮立项，**2026-09-23 重划为学习设计轮**）：第五轮 ARCH-022（学习中心）与
  原 ARCH-026/PLAN-051（8903 渲染线）并轮后，按用户裁决改为「**主链路主任务 + 模块固定壳**」结构：
  主链 [learning-design-mainline](../plans/2026-09-22-learning-design-mainline.md)（课程注册→链路编译→
  判分与掌握门→派生推进结课，M-1~M-3；掌握门/判分入主链为单一事实源）+ 模块行各配壳
  （ARCH-027-M1 学习面 UI 与渲染基线 / M2 练习与复习 / M3 本地模型适配层 / M4 知识探索后置 /
  M5 知识点体系与知识梳理星图，2026-09-30 增）。
  QED-Engine 只做学习链路的展示与编排（检索下载归 Tracker、知识整理归 Axiom-Flow）；REQ-089 第二批
  （DeepTutor 学习面）调研收口，L1~L9/R1 判定表落主链壳（含各条承接壳列）；**本轮只排根仓库任务，
  暂不向 Axiom-Flow / QED-Tracker 发请求**；ARCH-022、ARCH-026、PLAN-051、REQ-089 四行
  Superseded/Achieved 关闭见 completed.md。
- 已完成（2026-10-01 收口，Achieved，挂普通任务轮 W13）：**文字模型（lmstudio 渠道）启停与验证链路修复（DEFECT-008）**——现象＝图像模型启停正常、文字模型控制台「验证」报请求超时且后台失败无原因。六处根因全修：① 回环探针显式禁代理（`runtimes/base.NO_PROXY_OPENER`，Windows 注册表代理会命中 127.0.0.1 把在线服务读成不可达）；② 启停过程与失败原因经 `log` 入事件账（派发/监督器恢复均带 `log`，`create_app` 补 `qed_engine` logger INFO 级别，否则子 logger 被 root WARNING 丢弃）；③ `/llm/test/text` 请求层限长 512（思考段实测 170~260+ token，256 档会把正文截空）；④ 前端验证窗口 15s→60s；⑤ `lms` 子进程输出按 UTF-8 解码（GBK 下中文 key 触发 reader 线程 `UnicodeDecodeError`）；⑥ qwen3.5-9b 加载上下文 16384→40960（实占 12879/16376 MiB，逐档实测）；设计晋升三处（local-model-management 已知约束 11/12 与参数档案、llm-gateway 验证限长、admin-console 验证窗口）。
- 已完成（2026-10-01 收口，Achieved）：**知识点体系与知识梳理星图（ARCH-027-M5）**——「领域→课程→
  知识点」三层数据面成立（第四张共享表 `qed_knowledge_point`＝已确认知识点主数据 + 根私有
  `qe_kp_detail`＝生成待选多版本明细池），学习中心 `#/knowledge` 由课程泡泡图原型改为**知识梳理
  星图**（星空图像底 + 「层＝行 × 轨迹＝列」森林 + 框间先修连线 + 下钻课程知识点页，纯函数布局配
  既有 echarts graph，不引新依赖）；D1~D6 于 2026-10-01 全按推荐口径批复，两表与端点契约**正式冻结**
  （`database-design.md` 四处 + `api-contracts.md` §⑥），星图 UI 设计晋升并确认
  （[learning-star-map.md](../history/plans/2026-10/learning-star-map.md)）。过程与三轮界面反馈证据见
  [M5 壳（已归档）](../history/plans/2026-10/2026-09-30-knowledge-point-star-map.md)；残余「知识点内容写入」移交主链 M-2 编译线 / M2 出题线，
  生产库 DDL 属 D 类转人工未执行。
- 已完成（2026-09-24 收口，挂 ARCH-028 稳定性轮支线）：**本地模型启动参数配置（ARCH-033）**——加载层参数（上下文长度等）挂 registry 身份表 `Identity.params` 并全链路生效（含监督器受控恢复）：lms load 带 `-c/--gpu/--parallel/--ttl` 且恒附 `-y` 非交互（歧义 key 防挂死，本地 key 唯一为消歧手段）；llamacpp 通道真做（复用 LM Studio 自带 llama-server 与 `~/.lmstudio/models` GGUF，零安装；PATH→backends 最新版回退 + mmproj 自动挂）；text 槽 5001 双向互斥自动让位（llamacpp 启动前 `lms unload --all` + `lms server stop`——单独 stop 不终止自带 worker 不释放显存）；参数档案 27B=8192（16GB 显存约束 R5 改判）/9B=16384 双渠道，两渠道真机读回生效 ctx 验证（9B 已于 2026-10-01 由 DEFECT-008 逐档实测改判 40960，见下）；设计事实晋升 [local-model-management.md](../design/local-model-management.md)「本地模型启动参数契约（加载层）」节；壳归档 history/plans/2026-09/。
- 已完成（文档收口，2026-09-22）：**ARCH-025 优化项下沉 Axiom-Flow 登记（用户裁决：这是其 1.0 版本任务）**——
  P1~P3/R1~R4 优化项以对方仓库自身治理形态登记进 `Axiom-Flow/docs/trackers/`：todo 新增 v1.0 主线节
  （聚合行 ARCH-021 + 支线行 ARCH-022/023 + PLAN-009 镜像行），承载壳为其
  `docs/plans/2026-09-22-v1-parsing-knowledge-optimization.md`（只立项不排期，前置＝其 PLAN-007 W6 / PLAN-008 收口）；
  根侧 ARCH-025 任务行与滚动壳转**消费/联调验证跟踪**（P/R 台账留档）。本轮只动双方文档，未碰子项目代码与 git；
  对方契约 100 全绿、全量 446 passed，根侧契约 63 全绿。
- 已完成（文档收口，2026-09-22）：**todo 登记方式修订（ADR 0016，一任务一行一壳）**——
  todo 任务行只写「做什么 + 目标/效果」（任务列链接计划壳，「——」后可追加一句话描述），
  进度、边界与细节一律由 plans/ 壳承载；取消独立 PLAN 镜像行与一任务两 ID（PLAN 前缀不再
  新发，存量保留至关闭）；新增轮次须用户确认，新小任务原则上并入已有轮次。已改造
  ARCH-024/PLAN-049 与 ARCH-025/PLAN-050 两对为单行（ARCH-026/PLAN-051 经用户裁决暂维持
  旧形态待重做）；task-lifecycle / doc-governance、qed-intake / qed-plan / qed-closeout 技能与
  `test_tracker_governance` 任务列镜像规则同步。本轮只动文档与契约测试清单。
- 已完成（文档收口，2026-09-22）：**learning/ 类目退役（ADR 0015，PLAN-052）**——用户裁决
  「个人学习笔记不再维护，直接看正式稳定文档」：`docs/learning/` 8 份文件整体删除（含
  《突破朗道位垒》.txt，靠 Git 历史找回），doc-governance 类目条款与契约目录清单摘除，
  tech-stack / downloads-flow / REQ-070-LEARN 现状壳引用改道；docs/ 治理类目收敛为八项。
  本轮只动文档与契约测试清单。
- 已完成（文档收口，2026-09-22）：**两轮文档体系梳理收尾 + 后续计划重组（范围边界与第四轮整合定档）**——
  ① Agent 开发文档体系轮退役：REQ-073 Achieved（对方 QED-058 09-11 完成在案）、REQ-074
  Partial 移交关闭（遗留三段文件头裁决挂对方 ARCH-010）；② 设计文档体系重组轮退役：
  存续行 REQ-070-LEARN（学习功能现状壳）移挂第五轮节作重设计现状基座；③ 新建三条不带
  轮次序号的持续优化主线（范围边界经用户裁决）：**ARCH-024 QED-Tracker（V1.0）持续优化轮**
  （只做知识/教材探索与下载：本地模型链路仅限其检索/选书环节、论文探索下载、下载链路评估
  三线，承载壳见 ARCH-024 任务行）、**ARCH-025 Axiom-Flow（V1.0）优化轮**（只做解析成大模型易消费 JSON +
  知识库面两线，承载壳见 ARCH-025 任务行；**启动门槛＝对方达 V1.0**；REQ-086/087 按裁决留第三轮存续项节）、
  **ARCH-026 根仓库前端（8903）优化轮**（渲染归前端，壳 PLAN-051）；④ **第四轮主线
  ARCH-021 整合关闭**（已有成熟参考 DeepTutor，REQ-089 第一批调研收口）：「文档解析管线 +
  RAG 切片和检索」优化项目划分（P1~P5/R1~R6）与 V1.0 目标形态落 ARCH-025 滚动壳
  「REQ-089 第一批调研承接」节，**知识图谱暂不做**（roadmap 预留），问答/课程效果面并入
  第五轮 ARCH-022；REQ-082 草案壳同批整合归档 history/plans/2026-08/；REQ-089 剩第二批
  （学习中心面）待启动。本轮只动文档，契约 63 全绿。
- 已完成：**design/ 文档整合轮（PLAN-047，2026-09-21）**——design/ 13 份去过程化：修订
  blockquote / 演进节 / 轮次标签 / 冒烟证据全部剥离（文末一行「关联计划」溯源），重点四份
  （parsing-ui / admin-console / llm-gateway / local-model-management）设计态重写，
  document-chunking-recall 草案按 ADR 0011 移回 plans/ 壳承载（REQ-082，Blocked），
  design/index 三处状态矛盾修正；契约 63 + 全量 500 + ruff 全绿；用户终验裁决
  design/ 全部 12 份「确认状态」晋升「已确认」（2026-09-21）。
- 已完成：**模型注册表与三接口统一轮（ARCH-023 / PLAN-046，2026-09-21 冒烟收口关闭）**——
  `services/llm/registry.py` 身份目录（text/vision/embedding 三槽位，含 2026-09-21 用户裁决
  新增云端身份 `deepseek-v4-flash-0731`）+ `runtimes/` 本地形态统一（LM Studio 半托管 /
  Docker / llama.cpp 待上线）+ 四段式 env（`QED_LOCAL_RUNTIME`/`QED_MODEL_URL`/
  `QED_OCR_MODEL_URL`/`QED_LMSTUDIO_TOKEN`/`QED_RESOURCE_GUARD`）+ 槽位级来源/渠道运行态
  （manifest `source`/`runtime`）+ 控制台五字段卡；`/models`、`/monitor` 端点槽位化。
  W7 真实冒烟四项全绿（LM Studio 文字链路、单活互斥双向、embedding api、text=api 混合，
  api 回退链尊重 `.env` 收 BUGFIX-008）+ W10 浏览器交互实测；设计事实并入
  [llm-gateway.md](../design/llm-gateway.md) 与 [local-model-management.md](../design/local-model-management.md)，
  壳归档 history/plans/2026-09/。未来 AGENT/MCP 统一配置以同一注册表为准（roadmap 预留）。
- 已完成：**本地模型部署轮（PLAN-045，2026-09-14）**——MinerU 去模型化镜像重建 +
  `model/mineru/` 卷挂载 + `/root/mineru.json` 路径校准（`MINERU_MODELS_DIR` 无效）+
  健康探针端点校准（`/health`，非 `/api/v1/health`）+ 8900 集成（`/monitor/mineru`、
  `/models/mineru/{start|stop|restart}`，local 模式）+ 真实 PNG 解析冒烟通过。
  Qwen 文字模型不在本轮范围。
- 已完成：**本地模型管理整理轮（PLAN-042，2026-09-14）**——修硬伤（TEXT_SCRIPT 指向
  已删除脚本）、Qwen 运行时切 llama-server、槽位目录 + manifest 约定、全量去 LM Studio
  命名、MinerU 清理核查。门禁全绿（413 pytest + ruff + 188 vitest + tsc + build）。
  部署另起 **PLAN-045 本地模型部署轮**（MinerU 先行；Qwen 文字模型按 2026-09-14 用户裁决
  不在该轮范围）。
- 已完成：**第二轮主线·课程下载轮（ARCH-019，2026-09-11 关闭）**——同轮立 ADR 0011
  （待评审设计先入 plans/，确定后落 design/）并同步两子仓库；用户裁决清库重走（原
  QED-026/QED-014 前置被取代）。**数据前置轮已关闭**（2026-08-23）：五表备份+恢复演练、
  存量 PDF 迁移新结构（12 文件 sha256 全比对一致）、五表清空、8901 空态正常、
  `QED_DATA_ROOT` 落地根仓库侧；常驻快照库 `qed_snapshot_20260823` 留存清理前数据；
  PLAN-019 归档 history/plans/2026-08/，REQ-051/052 入 completed.md。
  **前端改造完成（2026-09-08）**：REQ-067 §A/§B 与共享表优化全量落地（PLAN-025/028/033/034
  关闭归档），设计事实晋升 [downloads-flow.md](../design/downloads-flow.md)。
  **2026-09-11 收尾**：三门课下载闭环 + 浏览器验收通过；PLAN-022/037/038/039/040/041 与
  REQ-068-PLAN 全部关闭归档（[completed.md](completed.md)）；领域探索阶段 2 缺陷修正
  （`已生成` 可探索、离线添加领域 `未开始`、导入 409）；跨项目请求 REQ-075~079 用户确认完成。
  其后的第三轮主线·解析联调轮（ARCH-020）已于 2026-09-23 全部收口（见下方专项条目与 completed.md）。
- 已完成：**第一轮主线·文档规范与架构确定轮（ARCH-018，ADR 0010，2026-08-21 关闭）**——
  文档体系重构为「确定文档 / 相对确定 / 实时状态」三层：architecture/ 只放确定文档（总体架构
  four-service-architecture + 服务架构 frontend/backend-architecture + 固定 API 文档
  api-contracts + 数据库总纲 database-design + code-map，project-status 移入 trackers/）；
  guides 拆分 operations（操作）+ development（开发）；trackers 归并——ARCH-011~017 归为
  第一轮主线支线、登记长期任务 REQ-046（API 接口开发）/REQ-047（数据库设计）、roadmap 登记
  五轮主线（ARCH-018~022）；**API 文档按五类重构**（服务管理/配置语义/数据透传·Tracker/
  数据透传·Axiom/监控诊断与 LLM 网关，REQ-046）；**数据库总纲补登记 qed_llm_calls**（ARCH-016）
  并加表清单总览；**todo 按五轮主线分节排序**、REQ-041/043 关闭归档 completed.md；
  **门禁全绿（契约 50 + 全量 296 + ruff clean）**；子项目范本调整经请求由对方执行
  （REQ-048/049 → V2-015/QED-027）。**同轮收尾关闭**：ARCH-012（后端三域拆分轮，三域迁移 +
  监控诊断端点全绿，Task 18 真实环境验收随前端控制台真实消费覆盖）、ARCH-013（文档与数据边界
  整理轮，三域文档梳理 + todo 清理合并 + dataset/dataset 边界新模式）、ARCH-014（LLM 状态收敛
  与 DB 启动快照轮，端点删除 + 快照实施 + 冒烟通过）、ARCH-017（密钥收敛与厂商选择，文档 +
  门禁 + QED-Tracker 回执）；**「每次版本更新重新梳理文档体系」登记长期任务 REQ-050**。
  计划归档至 history/plans/2026-08/。
- 已完成：**LLM 网关与模型管理轮（ARCH-016，2026-08-23 关闭）**——三项目密钥约定
  （各 `.env` 自持 `API_KEY` 统一变量，旧变量降级别名；`QED_API_SELECT` 选 api/local 模式）、
  8900 LLM 网关端点（/llm/text、/llm/vision、/llm/test/*、/llm/calls、/database/test）、
  qed_llm_calls 调用记录（单表三项目可写，DB 不可达降级）、本地模型生命周期脚本
  （scripts/text-model/ + scripts/image-model/，MinerU 编排迁入）、资源互斥（QED_RESOURCE_GUARD）、
  控制台 GPU 总览条 / 依赖组件三卡 / 模型调用记录检索页；Task 17 门禁收口（后端 282 + ruff +
  契约 48、前端 vitest 100 + tsc + build、api 模式真实冒烟 qed_llm_calls 落库）；**子项目回执
  齐备**：REQ-043（QED-Tracker QED-037）+ REQ-044（Axiom-Flow V2-014，fcb9eb9..9573fb0，
  T6 网关冒烟 call_id=17）；local 模式根仓库侧冒烟经用户裁决由日常使用自然覆盖。
  计划归档至 history/plans/2026-08/。**同日关闭跨项目支线**：REQ-039（Axiom-Flow 服务化脚本，
  V2-011 f5d9355 + 根仓库 axiom 单元黑盒接入）、REQ-044（V2-014）、REQ-040（生命周期脚本
  `_pid_is_alive` 编码修复三方落地：根仓库 web + QED-Tracker QED-035 + Axiom-Flow V2-012 729d208）。
- 已完成：**前端重构主轮（ARCH-011，2026-08-21 关闭）**——React 19 + AntD 全家桶
  重建 8903（web-ui/），核心四界面（主界面/控制台/仪表盘/下载管理）Phase 0~5 全部通过
  浏览器验证；serve_web.py 指向 dist、旧 web/ 退役、test_web.py 守护迁移至 web-ui/src 源码；
  门禁全绿（build + vitest 100 + tsc 零错 + pytest 296）；ADR 0008 + frontend-architecture.md
  已落盘。计划归档至 history/plans/2026-08/。
- 已完成：**下载管理界面重构轮（ARCH-015，2026-08-21 关闭）**——左树四层（高等数学→
  分类→课程→教程叶子+进度）、右侧流程筛选（搜索/确认/下载/验收+保留三下拉）、书籍卡去
  kind、书籍排序；REQ-041 回执已收到（QED-Tracker QED-036）；浏览器验证通过。
- 已完成：**v0.1 版本目标对齐——[文档与架构重构轮（ARCH-008）](../history/plans/2026-08/2026-08-docs-refactor-round.md)**
  （2026-08-10 归档，Achieved）：docs/ 九节逐节梳理完成（W1 adr/ 至 W9 ADR 清理 + REQ-024），
  **文档基线定格**——ADR 六份（领域枚举收敛为工程治理/架构与边界）、标准/设计/计划/台账
  与契约测试一致，151 passed + ruff clean；跨项目设计级请求（REQ-022/023/026/027）已在
  两个子仓库建设计文档与承接登记（ALN-008/009、QED-022/023），待用户评审。
  **架构轮（ARCH-009，ADR 0007，2026-08-11 冒烟闭环）**：前端唯一入口 8900——目录重整（backend/
  database/tmp/scripts）、数据域语义 API（data.py）、服务域 /services 实装（service_manager.py）、
  前端唯一入口切换（app.js），P0-P5 完成，**真实冒烟闭环（8900/8901 联调：数据域真实数据 + /services 启停托管 start/stop/restart + 409 窗口 + 优雅停止），181 passed + ruff clean**，修复 ROOT 路径错位（parents 层级）与 Popen 失败句柄泄漏，归档待用户验收。
- 进行中：**联调矩阵与契约冻结编排（2026-08-16 立档，[cross-project-contracts.md](../design/cross-project-contracts.md)）**——
  三组并行联调：A 前端↔8900（并行推进中）/ B 8900↔8901（**QED-031 迁移 0006 已冻结**——
  2026-08-17 QED-Tracker 回执：alembic=0006、五表落库（4 知识/12 书籍/16 渠道）、真实冒烟
  通过，REQ-035 前置解除）/ C 8900↔8902（根仓库侧托管/监控已具备；**Axiom-Flow v2 已交付**——
  V2-003~007 全落地，误建 ingest 代码对方已审阅并自行提交（其 `d019777`，2026-08-20）；
  8902 API 经 ARCH-020-C/E 多轮真机联调；REQ-036 已 2026-09-21 收口，REQ-034 前置随其 09-14 Not Applicable 关闭而失效）；
  各服务独立开发阶段，验收窗口见矩阵文档。
- 已完成（2026-09-14 立项重构，**2026-09-23 全部收口归档**）：**第三轮主线·解析联调轮（ARCH-020）**——「文档解析管理」核心交付：[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md) 确立**模型生命周期归
  8900、解析管线归 Axiom-Flow（引擎适配器直连模型服务）**；设计正文两份
  [解析管理 UI 设计](../design/frontend/parsing-ui.md)（左树进度 + 原页 bbox 对比 +
  块级编辑：判定/备注/文字/范围；PLAN-043 已晋升）与
  [文档解析管理·全链路设计](../design/parsing-flow.md)（全链路数据流 +
  产物布局 + 统一 blocks schema；PLAN-044 晋升；af_* 结构与 8902 契约事实源在 Axiom-Flow，指针见其 §2）。  **本轮为文档重构**（Phase A 根仓库 / Phase B Axiom-Flow）；
  实现按「准备 → 实现 → 验收」推进：准备 = [解析管理 UI 设计](../design/frontend/parsing-ui.md)（PLAN-043 已晋升）
  + MinerU 模型已部署（PLAN-045 已关闭）；
  实现拆 ARCH-020-B/C/D（8900/8902/8903），验收 ARCH-020-E，数据操作
  （qed 统一 + axiom/xqfm 删除 + dataset 清理）为 ARCH-020-F。
  旧形态（REQ-034/042、af_block_reviews、`dataset/axiom-flow/`）随重构取代。
  **2026-09-20 联调最小打通轮完成**：8900 单向追 8902 v2 契约（/review 门面转 /edit、sync
  file_path、parse-jobs engine/`id`/progress 对象、page_no 与 image_url 补写、树 domain 空
  课程回退），qed 库 af_* 四表已迁移（alembic 20260917_0001）；E2E 实证 sync（4 本
  file_path 非空）→ ingest（486 页）→ 页图代理 → 树/前端渲染全通；**剩余阻塞**：REQ-075
  扩充——8902 MinerU 引擎轮询 `/get_task_results` 对容器 3.4.4（实际 `/tasks/{id}/result`）
  404，解析产物待其对齐后 ARCH-020-E 方可验收。**2026-09-20 ARCH-020-C 收尾**：af_* 四表已落地
  （迁移 20260917_0001），根仓库 [数据库总纲](../architecture/database-design.md) af_* 转正
  （规划→已落地），REQ-027 关闭（以迁移落地为回执）；当前聚焦两份设计文档
  （[parsing-ui](../design/frontend/parsing-ui.md) / [parsing-flow](../design/parsing-flow.md)）
  随联调与实现持续优化至初版（发现偏差续登 [design-bugfix-log](../plans/design-bugfix-log.md)）。
  **2026-09-20 解析界面四轮收口（UI 展示轮 → WB 重设计 → D 实现 → G 单屏回调，全部关闭归档）**：
  最终形态定档**单屏「左书目树（纯选择）+ 右对照工作台」**——bbox 双向联动、块编辑+判定、
  单页/全本解析+进度、连续滚动、URL `?book&page` 恢复全保留；界面全中文（「ingest」→
  「书页入库」、顶部单一「刷新」含同步书目）；两级列表态（BookList/BookTable）退役删除。
  四份计划壳并入 [parsing-ui.md](../design/frontend/parsing-ui.md) 后归档 `history/plans/2026-09/`。
  **遗留**：REQ-080（产物版本划分）与 REQ-081（bbox 坐标钳位缺陷）待 Axiom-Flow 回执，
  回执后按 §13 复测对照对齐；ARCH-020-E 端到端验收仍阻塞于 REQ-075（Rudin b05/b11 尚未入库）。
  **2026-09-20 主线收口（用户裁决 Partial）**：B/C/D 与界面四轮全部关闭归档（见
  [completed.md](completed.md)），E/F/REQ-075/080/081/PLAN-044 留 todo 独立跟踪。
  **2026-09-22 E 收口（用户裁决部分验收）**：REQ-075/080/081/083 已全消化（见 completed.md），
  b05 生效版 `185a37d55985`（312/317 页，缺 5 页为 PDF 空白页被判失败）经 8903 工作台浏览器
  实测通过关闭 E；全本激活根治留 REQ-087、分块提交留 REQ-086 独立跟踪；**2026-09-23
  REQ-086/087 收口（用户裁决 A＝以对方 PLAN-007 真机证据+回执关闭，Achieved 见 completed.md；
  根侧业务口径全本实测连带老代 `$$$` 产物数据侧自愈核验转后续观察项，挂 ARCH-028 首次真机演练）**；
  **同日 ARCH-020-F 收口（备份+还原演练后 DROP axiom/xqfm 已执行，Achieved 见 completed.md；根 `.env` `QED_DB_NAME=qed_test` 为演练期保留，用户裁决不动）**；
  **第三轮全部收口（2026-09-23 PLAN-044 收口，设计晋升 [parsing-flow.md](../design/parsing-flow.md)，见 completed.md）**。
- 进行中：8903 前端十五期（文档下载管理课程分页，ARCH-007，待用户浏览器验收后归档）；
  文档基线之上的主线推进为**课程收集主线（ARCH-002）**——QED-Tracker QED-019（01 数学分析
  闭环）与 QED-014 全链路联调冒烟待执行，回执后在 8903 展示验收；前端后续十六期与
  **学习中心（双目标：知识学习 + AI 技术学习实践场）** 按 roadmap 排队。
- 2026-08-14（二十二期续）：主界面**学习中心框架**已搭——领域→课程→章节/知识点浏览
  （数学试点，章节空态等解析产物管线，学习功能现状文档更新 Partially Implemented）；
  管理后台树加载加固（loadTree 全函数 try/catch + 离线横幅 + 自动重试，杜绝无限转圈/空白）。
- 待开始：REQ-018 人工评审优化（QED-020 已实现待 8901 重启回执）。（原「REQ-022/023 治理契约
  对齐」「REQ-026/027 数据库设计确认」均已关闭，见 [completed.md](completed.md)。）
- 详情见[任务台账](todo.md)。

## 维护规则

- 服务实现状态、端口或当前主线变化时，更新本表并刷新「最后更新」日期。
- 本表不保存任务细节与未来规划（分别见 todo.md / roadmap.md）；与四服务架构的静态
  描述不一致时，以本表当前状态为准并回修[四服务架构](../architecture/four-service-architecture.md)。
