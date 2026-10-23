# 前端设计整合轮（design/frontend/ 子目录·核心全流程总设计·UI 文档迁入）（frontend-design-consolidation）

状态：Completed
关闭结果：Achieved（S1~S6 逐条达成；S4 括号内「web-ui 注释」子面经用户 2026-10-15 裁决列为遗留移交项，非本轮承接且不受契约与链接门禁守护，不计本行未做核心项）
任务类型：B
最后更新：2026-10-15
关联 ADR：[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（demo 门与范围锁死纪律适用本轮）；本轮为 `design/` 结构重组，按 AGENTS.md 分级走 REQ + 计划壳，不新立 ADR
关联设计：[design/index.md](../../../design/index.md)、[frontend-architecture.md](../../../architecture/frontend-architecture.md)；迁入 `design/frontend/` 的五份 UI 文档（admin-console / admin-dashboard / downloads-ui / parsing-ui / learning-practice-ui）与本轮新增前端总设计（文档分析处理详设拆出为 [REQ-116](../../../plans/2026-10-15-doc-analysis-processing.md)）
关联 Tracker：docs/trackers/todo.md（REQ-115 登记，普通任务轮节；2026-10-15 收口原子移出入 completed.md）
归档判定：Retain（结构重组 + 五份文档迁移 + 31 份 history 冻结归档链接改道 + 守护递归改造，属不可替代过程证据）

## 目标与成功标准

以前端与 UI 为核心重组 `design/` 的前端设计文档：新建 `design/frontend/` 子目录，落一份**前端总设计文档**（视觉 / 文案 / 全流程 / 模块划分 / 分工 / 边界，视觉规范单一正本自 `frontend-architecture.md` 迁入）（**文档分析处理模块详设已拆出为 [REQ-116](../../../plans/2026-10-15-doc-analysis-processing.md)**），并把既有五份 UI 文档迁入子目录、同步全仓引用与守护。目标 = 前端设计有统一总纲 + 一模块一详设 + 单一事实源；学习中心（只展示已成品、辅助学习、零过程性内容）与后台管理（专业、管下载→解析→分析→问题定位全过程链路、不辅助学习）分工明确。

成功标准正本在 todo REQ-115 行 S1~S6（写定不改）。

## 范围与非目标

**范围**：① `design/frontend/` 子目录建立；② 前端总设计文档（新）；③ 文档分析处理模块的**流程定位 + 边界**（详设拆出为 REQ-116）；④ `frontend-architecture.md` 收敛为纯技术架构（视觉规范迁出、信息架构改指针）；⑤ 既有五份 UI 文档迁入子目录；⑥ 全仓引用同步（31 份 history 冻结归档 + ~15 处 web-ui 源码 DesignRef 注释 + architecture / adr / standards / trackers / plans / AGENTS + design/index 结构）；⑦ 守护改造（`test_design_documents.py` 递归扫描 + `CURRENT_DOCUMENTS` 子路径 + `test_web.py` token + 链接门禁）；⑧ 全量门禁不回归。

**非目标**：① 不整合学习中心「知识探索 / 课程学习」两面详设——它们仍在 `plans/` 待晋升，且今日（2026-10-15）有并行会话在动（`learn-outline-summary-channel`、`learn-ui-course-kp-boxmap`），本轮总文档只写其**流程定位 + 边界**，详设指针引 `plans/` 稿（用户裁决 2026-10-15）；② 不改前端运行代码行为——`web-ui/src` 只改 DesignRef 注释里的文档路径，不动逻辑；③ 不改后台管理各模块的既有设计口径——只迁位置、不改内容；④ 不新立 ADR；⑤ 不承载文档分析处理详设——已拆出为 [REQ-116](../../../plans/2026-10-15-doc-analysis-processing.md)（`plans/` 待晋升、细节移交 Axiom-Flow）。

## 前置条件

- 用户 2026-10-15 四项裁决：目录形态＝子目录且既有五份**全迁入**（方案 C）；视觉正本＝视觉 + 流程落新总文档、`frontend-architecture.md` 收敛为纯技术架构；学习面＝只写流程定位 + 边界、详设指针引 `plans/` 稿；文档分析处理＝本轮建独立详设文档。
- 用户已知悉方案 C 的 blast radius（31 份 history 冻结归档链接 + ~15 处 web-ui 源码注释 + `test_web` token 风险 + 并行 WIP 壳）并明确「现在开始执行」。
- demo 门纪律（ADR 0024 决定 2）：本轮为多工作项 B 类壳，**W2＝demo 门**（总设计骨架 + 文档分析处理详设＝核心价值最短验证路径），到门暂停待人工验收后才进 W3~W6 迁移批次。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 立项：本壳 + todo REQ-115 镜像行（design/index 重组留 W5） | 已完成（2026-10-15） |
| W2 | **demo 门**：建 `design/frontend/` 子目录；写前端总设计文档（以前端可见视角走通核心全流程 + 视觉 / 文案 / 模块划分 / 分工边界，确定项填实、待定项标注）；文档分析处理详设拆出为 REQ-116 plans 稿 | 已完成（2026-10-15，用户验收通过：三项待定裁决 + 授权迁入批次） |
| W3 | `frontend-architecture.md` 收敛为纯技术架构：视觉规范节迁出至总设计文档、信息架构调整为指针，元数据与守护同步（architecture/ 大修改） | 已完成（2026-10-15） |
| W4 | 迁移 UI 文档 → `design/frontend/`（admin-console / admin-dashboard / downloads-ui / parsing-ui / learning-practice-ui 五份 + 用户追加指令迁入并行晋升的 knowledge-point-exploration-ui，共六份），逐份重算链接深度、全仓 `](…)` 引用改道 | 已完成（2026-10-15，每份 `tests/contract` 82 passed） |
| W5 | 引用面同步 + 守护递归改造：design/index 增「前端设计」分组 + `test_design_documents.py` 递归扫描与 `CURRENT_DOCUMENTS` `frontend/` 子路径（7 份纳入守护）+ 全仓 md 链接由迁移逐份改道 | 已完成（2026-10-15，index + 递归守护 82 passed；10 处 web-ui 源码 DesignRef 注释随并行会话 WIP 树改道，非本轮承接：契约不强制、且 `git status` 实测这些文件多为未提交 `M` 态，改则撞车，移交属主会话） |
| W6 | 全量门禁不回归：契约（含递归守护 + 链接门禁）+ `test_web` + web-ui tsc/vitest + ruff + pytest 全绿 | 待关闭确认（五族门禁在当前树全绿：契约 82 / `test_web` 13 / pytest 742 / ruff 全过 / tsc 无错 / vitest 63 files·760 tests passed；无红需归因他方；仅余本壳关闭动作待用户确认） |

## 过程与证据

- 2026-10-15：勘察定案——`design/` 现有五份 UI 文档（admin-console 334 / admin-dashboard 250 / downloads-ui 386 / parsing-ui 419 / learning-practice-ui 228 行，均带元数据、受 `test_design_documents.py` 守护）；`frontend-architecture.md` 现承载「主题与视觉规范」+「信息架构」；`test_design_documents.py:51` 为扁平假设（`design/*.md` 顶层恰好 = index + 14 份），子目录纳入守护须改递归扫描。引用 blast radius 实测：`docs/history/` **31 份**冻结归档链到这五份（链接门禁全仓扫 history）、`web-ui/src` **~15 处** DesignRef 注释、architecture / adr / standards / trackers / plans / AGENTS 十余处、`code-map.md` **零命中**（无需改）。用户四项裁决 + 明知 C 成本仍选 C 并发令执行（见前置条件）。
- 2026-10-15：W1 立项——本壳建立、todo REQ-115 镜像行插普通任务轮节末（标题 = 壳 H1、状态 In Progress、S1~S6）。design/index 结构重组随 W5 落。
- 2026-10-15：W2 demo 门落盘——建 `design/frontend/` 子目录，写两份新文档：① `frontend-overview.md`（前端总设计：定位与两部分分工铁律、视觉总则正本（自 frontend-architecture 迁入的蓝白黑/简洁/对比度门禁/缩放自适应/一致性/星图暗色唯一例外）、文案与语言风格（中文+术语一致+徽章承载口径+两侧语气分离+过程性隔离）、前端视角全流程①下载②解析③文档分析处理④学习中心消费、模块划分与详设索引（学习中心3+后台管理4，各挂指针）、边界铁律、7 条待定项）；② `doc-analysis.md`（文档分析处理新模块：定位=解析产物到成品的内容加工桥接、三职责（登记确认知识点/编排课本学习链路/关联课后习题讲解）、输入输出表、与 parsing-ui 及学习中心的不重叠边界、前端展示占位、6 条待定项）。两份对未迁移的五份 UI 文档暂用 `../X.md`（W4 迁移后改同目录）。门禁：`pytest tests/contract` **82 passed**（链接门禁 rglob 已递归扫到 design/frontend/ 并通过，14 个引用目标独立核验存在；子目录文档对 test_design_documents 顶层 glob 不可见，W5 迁移+递归改造后纳入守护）。**到 demo 门暂停，待人工验收总设计与文档分析处理两份草案后，再进 W3~W6 迁移批次。**
- 2026-10-15：demo 门产物按用户裁决调整——① 总设计 reframe 为「以前端可见视角走通核心全流程 + 完善整个界面」（H1 / 引言 / §4③ 改）；② 配色定案（本文只定蓝白黑 + 简洁方向、色值正本 `theme.ts`，不列令牌表）；③ 系统问题定位不做单独模块（忽略）；④ **文档分析处理详设拆出 REQ-115**、独立为 REQ-116 `plans/2026-10-15-doc-analysis-processing.md` 设计稿（A 类、待晋升、驱动＝LLM 自动 + 人工确认、后续细节移交 Axiom-Flow），原 `design/frontend/doc-analysis.md` 内容迁入该壳并移除、总设计 §5 指针改指 REQ-116。REQ-115 标题 / 范围 / S2 随之收敛（立项 demo 门内的用户裁决细化，非执行期改写）。
- 2026-10-15：W2 验收通过 + W4/W5 迁入批次——用户裁三项待定（文案 §3 原则先执行、知识探索已晋升由并行处理、暗色星图＝知识探索单独设计唯一例外）后授权逐份迁移。用可复用脚本 `tmp/migrate_frontend_doc.py` 逐份把 UI 文档移入 `design/frontend/`，每份「迁入 + 全仓 `](…)` 链接改道 + 从 `test_design_documents.CURRENT_DOCUMENTS` 摘除」后即跑契约（admin-dashboard 15 入/17 出、admin-console 28/21、downloads-ui 39/25、parsing-ui 44/20、learning-practice-ui 11/12、knowledge-point-exploration-ui 9/15），六份全 `tests/contract` 82 passed、`tests/test_web.py` 13 passed。W5 收尾：`test_design_documents.py` 由 `glob("*.md")` 改 `rglob` 相对路径比较、`CURRENT_DOCUMENTS` 加回 6 份 `frontend/` 子路径 + `frontend/frontend-overview.md`（共 7 份纳入递归守护，`scripts/serve_web.py` 经 PATH_REFERENCE 核验存在），`design/index.md` 重构为「项目配置 / 模型管理 / 项目协同 / 前端设计（frontend/）/ 后端全链路」并新增总纲行与课程学习待晋升说明。
- 2026-10-15：W3 未做、并行归属让位——`frontend-architecture.md` 的「主题与视觉规范」节尚未迁出改指针（现与总设计 §2 并存=重复正本，须 W3 收敛）；用户 AskUserQuestion 裁决「课程学习（REQ-105）暂缓晋升、转 W5」——其线 In Progress、由并行会话持收口权、REQ-115 非目标①明令本轮不整合，故课程学习设计文档不进 `frontend/`，`frontend-overview.md` §5 对其保持 `plans/` 指针。

- 2026-10-15：W3 落笔——`frontend-architecture.md` 的「主题与视觉规范」整节（配色 `#1677ff`/对比度门禁/缩放自适应/一致性/D5 暗色承载例外）删除，原位改为「视觉与文案」一节，只留一句指针到 [frontend-overview.md §2/§3](../../../design/frontend/frontend-overview.md)（视觉规范唯一正本自本架构文迁出，本文收敛为纯技术架构）；「信息架构（hash 路由）」路由表保留不动（技术关注点）；元数据设计状态/实现状态/确认状态/关联代码/关联测试/关联 ADR 全部不动（`test_architecture_documents.py` 只校验这些字段，不锁章节名，故删节安全）；最后更新 2026-10-11→2026-10-15。契约 `pytest tests/contract -q` **82 passed**（新指针链接经链接门禁解析通过）。

- 2026-10-15：W6 代码级门禁在当前树复跑（用户指定选项①）——`cd web-ui && npx tsc -b` 无输出（类型零错）；`npx vitest run --no-file-parallelism`（串行取可信）**63 test files / 760 tests passed**，duration 267s，唯一 stderr 为存量 antd v5/React 19 兼容警告（非失败）；当前树含并行 WIP 亦全绿，无需归因他方红。

- 2026-10-15：W3/W5/W6 收口批次——W3 见上节；W5 判定 10 处 web-ui 源码 DesignRef 注释**移交属主会话**（实测 `web-ui/src` 十余文件处未提交 `M` 态，本轮 docs-only 改动不触碰源码注释，且该类注释不受`test_code_document_mapping`（只扫 `backend/qed_engine`+`tests`）与 `test_markdown_links`（只扫 `.md`）守护）；W6 docs 范围门禁串行全绿：`pytest tests/contract` **82 passed** · `tests/test_web.py` **13 passed** · `pytest`（`-p no:cacheprovider`）**742 passed** · `ruff check .` **All checks passed**。web-ui tsc/vitest 因整树处并行在途 WIP、本轮零改源码，标注待干净窗口复跑不阻塞本壳 docs 收口。

- 2026-10-15：用户发令 qed-closeout 收口——逐条对照 todo REQ-115 行 S1~S6：S1 `design/frontend/` 子目录建立 + 前端总设计文档（视觉单一正本 `frontend-overview.md §2`）达成；S2 总设计走通核心全流程（下载→解析→文档分析处理→学习中心消费）、两部分分工定死、文档分析处理拆出 REQ-116 达成；S3 `frontend-architecture.md` 视觉节删除改指针、无双事实源达成；S4 六份 UI 文档迁入且全仓 md 引用（history/architecture/adr/standards/trackers/plans/AGENTS + design/index）改道、链接门禁 82 绿零死链达成——唯括号内「web-ui 注释」子面按用户裁决列遗留移交项（非契约/链接门禁守护、属主文件处并行未提交 WIP）；S5 守护递归改造（`test_design_documents.py` rglob + `CURRENT_DOCUMENTS` 7 份 `frontend/` 子路径 + `test_web` token + 链接门禁）全绿达成；S6 全量门禁（契约 82 / `test_web` 13 / pytest 742 / ruff / `tsc` 零错 / vitest 63 files·760 passed）不回归达成。关闭结果记 Achieved（S4 web-ui 注释子面为显式移交遗留）。

## 验证与验收

- **W2 demo 门**：总设计文档骨架 + 文档分析处理详设交用户验收（核心价值最短路径），验收通过后才进 W3~W6。
- W3~W6 每批落笔后跑 `pytest tests/contract -q`（守护 + 链接门禁）；W4 迁移前先 .bak 备份；W6 全量门禁（契约 + `test_web` + web-ui tsc/vitest + ruff + pytest）**串行**、QED_env 解释器（`D:/software/anaconda3/envs/QED_env/python.exe`）。
- 并行 WIP 壳（knowledge-point-exploration / course-study / boxmap / outline-summary）若致门禁红，只归因不代改。

## 回滚

- 迁移前对五份文档与所有待改引用文件做 `.bak` 备份（`tmp/` 下）；任一环节门禁红且无法就地修复，按 `.bak` 逐份还原（**不用 `git checkout --`** 以免吞并行会话未提交改动）。
- `design/frontend/` 子目录若需整体撤销：删目录 + 还原五份文档原位 + 还原守护与全仓引用。

## 关闭与归档

- 2026-10-15 用户发令收口，本壳 Retain 归档 `history/plans/2026-10/`（相对链接按新深度 +2 重算）；todo REQ-115 行原子移出 → `completed.md`（Achieved + 门禁证据）；`plans/index.md` 增已归档行；`design/index.md` 已重组为「前端设计（design/frontend/）」分组、`frontend-architecture.md` 视觉节已收敛为指针。
- 遗留移交项（不计本行未做，属主会话承接）＝10 处 `web-ui/src` DesignRef 注释仍指旧 `docs/design/<ui>.md`，待并行树干净窗口改道至 `docs/design/frontend/`；课程学习（REQ-105）待其线自收口后另行晋升 `design/frontend/`；文档分析处理详设归 REQ-116（其确认后晋升 `design/frontend/doc-analysis.md`）。
