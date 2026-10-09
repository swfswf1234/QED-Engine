# 论文展示行与行内探索·根侧实现（paper-display-row-root-impl）

状态：Closed（Achieved，2026-10-09 收口：S1～S5 全达成，判 Retain 归档）
任务类型：B
最后更新：2026-10-09
关联 ADR：[ADR 0007](../../../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（8900 唯一入口）、
[ADR 0016](../../../adr/0016-todo-registration-one-task-one-plan.md)、
[ADR 0017](../../../adr/0017-design-doc-structure-contract.md)（事实源唯一铁律——论文状态派生只落 downloads-flow）
关联设计：[downloads-flow.md](../../../design/downloads-flow.md)（W1 晋升论文行状态派生节的宿主）、
[downloads-ui.md](../../../design/downloads-ui.md)（W1 晋升论文展示行展示规范的宿主）、
[dataset-conventions.md](../../../design/dataset-conventions.md)（W1 增 kind=paper 落盘豁免注）、
[api-contracts.md](../../../architecture/api-contracts.md)（W2 透传端点登记宿主）、
[REQ-101 请求壳](../../../plans/2026-09-30-req101-paper-scope-books-adoption-request.md)（对方能力面 R1～R4 事实源指针）
关联 Tracker：docs/trackers/todo.md REQ-102；登记与跟踪由
[ARCH-024 滚动壳](../../../plans/2026-09-22-tracker-v1-continuous-optimization.md)线 2 条目承载
关联代码：backend/qed_engine/clients/tracker_client.py、backend/qed_engine/api/tracker.py、
web-ui/src/pages/Downloads.tsx、web-ui/src/components/{DomainCard,DownloadsTree,ExploreFlowModal}.tsx
归档判定：Retain（收口时按当时里程碑归档 history/plans/）

## 目标与成功标准

**目标**：在 8903 下载管理页把论文链路消费面补齐——**领域与课程各挂一行「前沿/核心论文」
展示行**（清单=该 refs 下 `kind=paper` 书行，复用书目卡与五层态；空则整行隐藏）；
探索**仅由领域入口发起**（领域右键 + 汇总行「论文探索」按钮 → 论文探索管理弹窗：
recommend 任务 → 5s 轮询 → 候选评审 + 逐条落位选择（领域|课程）→ 显式 pick 书本化 →
走既有自动下载/验证链）。设计取向：论文**不进入**领域 6 态/课程 5 态探索状态机，展示行状态由
任务态 × 报告态 × 书五层态派生（派生表晋升 downloads-flow 新节，唯一口径）。
8900 对 8901 保持纯透传+信任，前端只连 8900（ADR 0007）。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../../../trackers/todo.md)
`REQ-102` 行的「成功标准」列，本壳不复制判据条目；执行进展与证据见「过程与证据」节。

## 范围与非目标

**范围**：W1 设计五面晋升 → W2a 8900 论文枚举透传（上游=对方 A 步）/ W2b 8900 探索面透传
（上游=对方 B 步）→ W3 8903 清单展示行（静态版，
数据源=W2a 规划的 `/papers/books` 端点，端点未实装期间前端静默空态、组件形态先行）→
W4 8903 探索入口（依赖 REQ-101 R1/R2 落地）→
W5 真机回归与收口。

**非目标**：8901 侧一切改动（归 [REQ-101](../../../plans/2026-09-30-req101-paper-scope-books-adoption-request.md)，
本壳只消费其端点形状）；`exploration_stage` 状态机改动；教程附属资料（现有
qt_books kind=paper 挂 knowledge 的语义）不动、与发现论文书行共存于同一 kind 值域，
归属层级不同（knowledge refs vs domain/course refs）由 W1 设计节区分口径；
学习中心消费论文（归 ARCH-027 线）；课程级论文物理目录（2026-09-30 裁决＝逻辑分组）。

## 前置条件

1. 用户对 W1 设计节正文的评审确认（design/ 晋升前置，docs-first）；
2. W4 依赖 REQ-101 R1（scope）与 R2（书本化采纳）回执落地且对方 **B 步**（原 068-5/S4
   任务化端点，2026-09-30 复审改判为「探索服务化+书本化一次到位」）端点定稿——
   **未落地期间 W3 独立可交付**（清单展示静态版=组件+store+空态容错，
   数据挂点固定为 `/papers/books`，W2a 实装前静默隐藏）；W2a 只依赖对方 **A 步**
   （`qt_books` 加 `kind`/落位列 + 8901 books 枚举），可与 B 步解耦先行；
3. 8901 离线降级口径沿用既有透传规则（api-contracts 数据域·QED-Tracker 节）。

## 工作项（滚动登记表）

| # | 工作项 | 责任侧 | 状态 |
| --- | --- | --- | --- |
| W1 | 设计五面晋升：downloads-flow 新增 §7「论文链路」（分段责任表 + 论文行展示态派生表 §7.2 + 写点/降级 §7.3，原 §7 已知约束顺延 §8）；downloads-ui 新增 §4.4「论文展示行与论文探索管理弹窗」＋§3 领域右键增「论文探索」＋§4.2 汇总行增 [论文探索] 按钮＋§5/§6 口径与降级补行；dataset-conventions 增发现论文书本化注（`_general/papers/` 树注 + 契约表行 + 逻辑分组 bullet）；api-contracts §③「规划契约」增 papers 四端点行（不进端点总表，实现后挪入）；cross-project-contracts §5 能力组表新增「论文发现（领域 scope）」行 | 根 | 完成 2026-09-30（契约门禁复跑见「过程与证据」） |
| W2a | 8900 论文枚举透传：`GET /api/v1/papers/books`（tracker_client + api/tracker.py），上游=对方 **A 步** 的 8901 `GET /books`（`kind`/`domain_id`/`course_id` 过滤）；响应行透传 `kind` 与落位字段供 W3 分桶；api-contracts 登记 + `tests/test_api.py`/`tests/test_tracker_client.py` 回归 | 根 | **上游已就绪**（对方 A 步 2026-10-01 交付：8901 `GET /api/v1/books` + `qt_books.kind`/`course_id`，真库只读冒烟 26 行全携带两新列）→ 根侧**完成 2026-10-03**：8900 `GET /api/v1/papers/books`（固定 `kind=paper` 透传 8901 `GET /books`，`domain_id`/`course_id` scope 过滤，行含两落位列） |
| W2b | 8900 探索面透传：recommend 202 任务提交（domain_id + recipe）、selections 列表/详情含 scope 过滤、adopt 采纳入口（逐条落位）；任务轮询复用现有 tasks 链；api-contracts 登记与两项定向测试回归 | 根 | **上游已就绪**（对方 B 步 2026-10-01 交付 8901 四端点：`POST /papers/recommend` 202 `paper_recommend`、`GET /papers/selections`（domain_id/recipe 过滤）、`GET /papers/selections/{id}`、`POST /papers/selections/{id}/adopt` 202 `paper_adopt`；错误面 422/404 `SELECTION_NOT_FOUND`/409 `TASK_ALREADY_RUNNING`）→ 根侧**完成 2026-10-03**：recommend/selections 列表与详情/adopt 四端点透传（纯透传不补默认 domain） |
| W3 | 8903 论文展示行·静态版：DomainCard 与课程头各挂一行，清单=`GET /api/v1/papers/books`（8900 W2a 规划端点；上游=REQ-101 R2 的 8901 books 枚举——8900 `GET /books` 已被 Axiom af_books 代理占用不可复用），渲染复用书目卡与五档筛选语义，行内只读+详情弹窗；空数据或端点未实装（404/失败）静默隐藏整行；vitest 用例 | 根 | 完成 2026-09-30（真机空态属设计内，W2a 落地后出数） |
| W4 | 8903 论文探索管理弹窗：入口两处（领域右键「论文探索」＋汇总行 [论文探索] 按钮，课程行无入口）；弹窗三段=发起（recipe 前沿\|核心）→ 5s 轮询 → 评审与落位（候选表 + 已在库去重标记 + 逐条落位选择器 领域\|该领域下课程 → adopt 显式采纳）；形态对齐 ExploreFlowModal | 根 | 根侧**完成 2026-10-05**：弹窗三段（发起→5s 轮询→评审落位→采纳回显）＋两处入口（领域右键／汇总行，课程行无入口）＋§7.2 徽标就地流转；采纳不自动下载（裁决 #5），取书由书目详情弹窗显式发 `POST /books/{id}/fetch`。真机已取证发起→轮询→失败回显（task `74502a7eced8`） |
| W5 | 真机回归与收口：8901 在线端到端一次（领域级+课程级各发起一次探索、pick 一单下载至 verified）、门禁全量+契约、前端浏览器实测 | 根 | 完成 2026-10-09（端到端两腿均 ranked→adopt→取书：领域级 `mathadvanced-b19` 经 8903「验证通过」至 `verified`、课程级 `b22` 至 `downloaded`、UI 侧 `b21` 落位渲染；取证全文见「过程与证据」2026-10-09 条）。历史留档：部分取证 2026-10-05（W4 发起→轮询→失败回显 + 两处入口与徽标态真机复验通过，全量门禁见「过程与证据」）；当时未达成项=8901 在线端到端一次（ranked 报告→评审→adopt→显式取书至 verified），卡点经 2026-10-07 取证改判=8900 网关在 local 渠道（LM Studio `qwen3.5-9b`）把思考段截断后的空正文记成 success 穿透（`sel-20261005T081444Z-156b6cb8`，非百炼；根侧透传与 UI 按原样工作，不绕过） |

## 过程与证据

- **2026-09-30 立项**：随论文链路对齐裁决立项（三项裁决全文见
  [REQ-101 壳](../../../plans/2026-09-30-req101-paper-scope-books-adoption-request.md)「过程与证据」节）；
  形态判断=书本化后论文即书行，根侧消费面大量复用 books 链，
  故 W3 与 W4 拆为可独立交付的两阶段。
- **2026-09-30 入口收敛裁决 + W1 落笔**：用户裁决论文探索**仅领域级发起**（领域右键
  「论文探索」＋汇总行 [论文探索] 按钮 → 管理弹窗），评审确认时逐条落位到领域或课程；
  据此完成五面设计晋升——downloads-flow §7（原已知约束顺延 §8，全仓无 §7 外链引用）、
  downloads-ui §4.4/§3/§4.1/§4.2/§5/§6、dataset-conventions（树注+逻辑分组 bullet+契约表行）、
  api-contracts §③ 规划契约 papers 四端点、cross-project-contracts §5「论文发现（领域 scope）」行；
  REQ-101 壳 R1/R2 与对方 068 壳 068-6a/6b 同步该口径。
  门禁：根 `pytest tests/contract` **82 passed**；对方 `tests/test_documentation.py` **9 passed**。
- **2026-09-30 W3 前置勘验与设计缺口修正（归因）**：原 W3 行 premise「books 链现成、
  不依赖对方」**不成立**——勘验证实 8900 `GET /api/v1/books` 为 Axiom af_books 代理
  （`api/axiom.py` list_books），tracker 数据域（`api/tracker.py`）只有 POST /books 与
  /books/{id}/… 动作面、无域级/课程级枚举；8901 亦无 HTTP books 列表端点（仅 db 层
  `list_books`）。修正口径=新增规划端点 `GET /api/v1/papers/books`（W2 实装，
  上游=REQ-101 R2 要求 8901 增 GET /books 枚举），W3 交付组件+store+静默空态
  （404/失败→整行隐藏），真机空态属设计内混合态直至 W2/R2 落地。
  已同步修正 downloads-ui §4.4 数据源句与 api-contracts §③ 规划契约表。
- **2026-09-30 W3 静态展示行交付**（用户「W3 静态展示行开始执行」发令后 TDD）：
  先红（groupPaperBooks 4 例 + PaperBooksRow 组件用例，`groupPaperBooks is not a function`）
  后绿。交付面——`api/tracker.ts` `listPaperBooks()`→GET `/papers/books`；
  `stores/downloads.ts` 纯函数 `groupPaperBooks`（kind=paper·无 knowledge_id·排除 retired，
  course_id 非空进 byCourse 否则 byDomain，年倒序同年 book_id 稳定序）+ `paperStatusBadge`
  五档+平行读物 + store `paperBooks`/`refreshPapers`（fetchAll 并行拉取，失败静默空集）；
  组件 `PaperBooksRow.tsx`（stage 筛选后空则整行隐藏、data-testid=paper-books-row）；
  挂载四点位=DomainCard 底部（场景2/3/4）+ 选中课程头后 + 分组课程头后，条目点击复用
  `BookDetailModal`（onMutated=refreshPapers）；`downloads.css` 追加 `.dl-paper-row` 系样式。
  门禁：vitest 定向 22 passed；全量 **407 passed | 1 failed**（唯一红=并行 WIP 文件
  `DomainConfirmModal.test.tsx` 字段序断言，非本提交引入，归因其 W8/W9 未提交批次）；
  `tsc -b` 两枚红全在并行 WIP `DownloadsTree.domainForm.test.tsx`（seed 未存在的
  books/bookDetails 键），本会话文件零红；`vite build` 成功（8903 产物已重建）。
  浏览器实测（8903+8900 在跑）：真机空态=论文行隐藏、无错误横幅、页面只连 8900
  （控制台仅 `/papers/books` 404 资源日志=设计内静默降级）；注入 3 条发现论文后
  领域行「论文（2）」（已完成/待验证）与课程行「论文（1）」（待下载）分桶正确、
  年倒序正确，条目点击打开 BookDetailModal 全貌正常，复位后回到空态。
  根契约门禁复跑 **82 passed**（api-contracts §③ 已增 `/papers/books` 行，未进端点总表，
  W2 实装后挪入）。
- **2026-09-30 对方全链复审 → W2 拆分为 W2a/W2b（归因）**：用户授权查阅并操作 QED-Tracker
  后复审其论文链，证实断点全在对方侧三环（入口/落盘/入库），并裁決其序列改精简 A~D 三步
  （正本=对方 068 壳「链路复审与执行序列精简」节，八条代码事实 F1~F8 与四条待定夺实现细节
  同在该节；根侧摘要见 [REQ-101 壳](../../../plans/2026-09-30-req101-paper-scope-books-adoption-request.md)
  「过程与证据」）。据此本壳 W2 拆两项：W2a=论文枚举透传（只依赖对方 A 步：`qt_books` 加
  `kind`/落位列 + 8901 `GET /books` 枚举，落地即让已交付的 W3 展示行出数）；
  W2b=探索面透传（recommend/selections/adopt，依赖对方 B 步）。W3 交付物零改动。
  同步补记对方 A 步红线：`qt_books` 为私有表、列集漂移触发其 `db/schema.py` DROP+CREATE
  自愈，加列须先手工 ALTER 生产库（先例=QED-071 三列），否则书库会被清空。
- **2026-10-01 设计口径复确认（用户）**：论文链路=「搜索→确认→下载→验证」四步、单独主动
  探索触发、经「论文探索」界面进入一轮搜索与确认；追问后明确「并非和领域书籍一块」=
  **只指入口与状态机独立**（不共用 `exploration_stage`，即 downloads-flow §7.2 现状），
  **存储仍书本化**、领域/课程沉淀展示行**保留现状**。故 §7 设计正文与 W3 实现均无需改写，
  0930 裁决①不改判，W2a/W2b~W5 口径继续有效。

- **2026-10-01 对方 A 步交付 → W2a 上游就绪（用户授权根会话在 QED-Tracker 内执行）**：
  ① `qt_books` 加列已在 `qed_test` 按红线顺序执行（备份 → ALTER → 复核 → 模型同步 →
  `ensure_schema → (0, 0)`；生产 `qed` 库留独立上线窗口）；② 8901 新增 `GET /api/v1/books`
  （`kind`/`domain_id`/`course_id` AND 过滤、行含 `kind`+`course_id`、非法 kind 422、
  无命中空数组），真库只读冒烟 26 行全携带两新列、`kind=paper` 空集（B 步 adopt 前属正常）；
  ③ F3 修复=CLI 报告真落 `qt_selections`；④ F5 修复=落盘 domain 可显式传（`--domain`）。
  对方门禁 ruff 全绿 + `pytest tests -q` 586 passed（唯一红=存量 `orchestration/evidence`
  断言，与本步无交集）。**对本壳的影响**：W2a 上游依赖解除、可独立实装（落地即让 W3 展示行
  出数）；回执字段名与 W3 现实现一致（`kind`/`course_id`/`domain_id`，发现论文=`kind=paper`
  且无 `knowledge_id`）→ **W3 零改动**。新记 F9（真库领域为 `math-advanced`，而论文默认桶
  `DEFAULT_DOMAIN_ID='math'`，两者目录分裂）属对方 B 步裁定项，不影响根侧消费面。
  证据正本=对方 068 壳「A 步交付（2026-10-01）」节。

- **2026-10-01 同日追加两裁决对本壳的影响**：① **论文没有默认桶**（上一条 F9 待定项即此裁决）
  ——`domain_id` 必填且须在 `qed_domain` 已存在，对方 A 步已落地 ⑤′（服务侧必填+存在校验、
  CLI 落盘分支缺参返回码 2）；**对根侧的影响只在 W2b**：8900 `papers/recommend` 与
  `papers/selections/{id}/adopt` 透传时**不得补默认 domain**，缺失/领域不存在的 422 原样透传
  给 8903 提示（8903 发起语境恒为领域，天然满足）；W2a 枚举与 W3 展示行零影响。
  ② **生产 `qed` 库不做 ALTER、等 1.0 整体完成后重建**——根侧 8900/8903 走 `qed_test`
  （已加列），本壳各步骤不受该改判影响，仅真机回归（W5）须继续以 `qed_test` 为基准。
  正本=对方 068 壳「F9 裁定」与「生产库口径（2026-10-01 用户裁决改判）」两段。

- **2026-10-01 对方 B 步交付对本壳的影响（用户裁五项实现细节后发令「开始执行」）**：
  **W2b 上游依赖解除**——8901 四端点已实装（`POST /papers/recommend` 202 `paper_recommend`、
  `GET /papers/selections`（`domain_id`/`recipe` AND 过滤 + `limit`）、`GET /papers/selections/{id}`、
  `POST /papers/selections/{id}/adopt` 202 `paper_adopt`），透传形状与 W2b 规划一致；错误面
  422（领域缺失/不存在、recipe 非法、无 arXiv 分类映射、picks 非法或课程不属该领域）、
  404 `SELECTION_NOT_FOUND`、409 `TASK_ALREADY_RUNNING`（dedup：recommend＝domain+recipe+goal，
  adopt＝selection_id）——8900 侧原样透传，不补默认值。
  **W4 新增一条确定口径（裁决 #5）**：adopt **不**自动链式下载，书行停在 `candidate` 态，
  弹窗「下载」按钮须显式调既有取书面 `POST /books/{id}/fetch`（8900 透传面已具备，无新端点）。
  **W4 评审表可显示项收敛（裁决 #3）**：评分理由只存 `qt_selections` 报告，8903 若要显示
  「为什么推荐」须读报告详情端点（`GET /papers/selections/{id}`），不从书行 `notes` 取。
  **配方值域（裁决 #4）**：`recipe ∈ {frontier, core}`，映射不到 arXiv 分类的领域须由发起面
  显式给 `categories`（8903 发起表单需留该入口，否则 422）。W2a/W3 零影响。
  证据正本=对方 068 壳「B 步交付（2026-10-01，本仓执行）」节 + REQ-101 壳同日证据条。

- **2026-10-03 W2a + W2b 交付（用户「现在开始实施」发令，TDD 先红后绿）**：
  **W2a**——8900 新增 `GET /api/v1/papers/books`（`api/tracker.py`），以固定 `kind=paper`
  复用现成 `TrackerClient.list_books`（对方 A 步 8901 `GET /books` 枚举），`domain_id`/`course_id`
  AND 透传；**不改** `GET /api/v1/books`（Axiom af_books 代理，占用中）。8903 侧 `listPaperBooks()`
  自 2026-09-30 起即指向本路径，故 **W3 零改动**，展示行自此可出数（此前 404→静默空态）。
  **W2b**——`TrackerClient` 增 `recommend_papers` / `list_paper_selections` / `get_paper_selection` /
  `adopt_papers` 四方法（请求体与 scope 参数逐字段原样发出，空值不入参），`api/tracker.py` 增
  `POST /papers/recommend`（202）、`GET /papers/selections`、`GET /papers/selections/{id}`、
  `POST /papers/selections/{id}/adopt`（202）四路由；8900 **不补默认 domain、不做二次校验**
  （⑤′ 论文没有默认桶），上游 422 `INVALID_PARAMS`／404 `SELECTION_NOT_FOUND`／409
  `TASK_ALREADY_RUNNING` 经既有 `_call` 同码透传结构化 detail；任务进度复用 `GET /tasks/{id}` 链。
  采纳后不自动下载（对方裁决 #5）——W4 弹窗下载按钮显式调既有 `POST /books/{book_id}/fetch`。
  **文档晋升**：api-contracts.md §③ 新增「论文探索（REQ-102 W2a/W2b）」正文五端点节，规划契约表
  五行删除、端点总表登记五行（`test_api_endpoint_inventory` 双向守护通过）；code-map 两行概述同步；
  `api/tracker.py` 模块 docstring 面补 papers。
  门禁：`tests/test_api.py` + `tests/test_tracker_client.py` 论文定向 **17 passed**（先红 10 例）；
  根 `pytest tests -q` **713 passed | 4 failed**——四红全属并行 M2 练习轮在途 WIP
  （`/api/v1/learn/{questions,attempts,mistakes,question-books,review/due}` 八端点未登记总表、
  `services/learn/{practice,practice_memory,grading}.py` 未入 code-map、新根测试
  `tests/test_learn_practice.py` 未入 test_suite_governance 白名单；缺失清单内**无任何 papers 路径**）；
  `ruff check backend tests` 两红亦在同批 learn 文件（`api/learn.py` UP037、
  `tests/test_learn_practice.py` I001），本会话四文件 ruff 全绿。
  注：8900 不热重载，本批新路由须重启 8900 后方在真机生效（W5 前置）。

- **2026-10-05 W4 交付（用户「现在开始实施」发令的续批，TDD 先红后绿）**：8903 论文探索管理弹窗
  与两处入口落地。交付面——`api/tracker.ts` 增 `recommendPapers`/`listPaperSelections`/
  `getPaperSelection`/`adoptPapers`/`getTask`/`listTasks` 与 `listPaperBooks` scope 参数；
  `stores/index.ts` 增 `TaskRecord`/`PaperSelectionSummary`/`PaperCandidateEntry`/
  `PaperSelectionDetail`/`PaperPick`/`PaperAdoptedRow` 类型；**新 store** `stores/paperExplore.ts`
  （三段流转 start→5s 轮询→评审→adopt、§7.2 徽标派生 `derivePaperRowBadge`、弹窗阶段
  `paperFlowPhase`、`isCandidateInStock` 标题归一查重、连续 3 次轮询失败本地转失败并停表，
  关闭弹窗不打断后台轮询）；**新组件** `PaperExploreModal.tsx`（配方 前沿|核心 + 可选目标 +
  可选 arXiv 分类；running 显示进度/会话号；评审行=勾选（仅 `recommended` 且不在库）+ 总分/
  相关度/理由 + 逐条落位 `Select`（本领域|该领域下课程）；采纳结果段明示「停在待下载、
  取书在书目详情弹窗显式发起」=裁决 #5）；入口两处=领域右键「论文探索」
  （`DownloadsTree.tsx`，不受 `exploration_stage` 门禁、仅该领域有在跑论文任务时禁用）＋
  汇总行 [论文探索] 按钮（`Downloads.tsx`，无领域置灰），课程行不带入口（裁决：课程不独立发起）；
  `PaperBooksRow.tsx` 接 §7.2 徽标（活动态即使零书行也成行、待评审/失败徽标可点直达弹窗）。
  **实机验证中发现并修掉四处**：① zustand v5 选择器返回 `?? []` 新数组触发
  `Maximum update depth exceeded`（弹窗常驻挂载后全页崩）→ 选择器只取稳定 state，
  课程列表改组件内 `useMemo` 派生；② 徽标回灌按对象身份挂依赖，被左树 5s 轮询的新
  `domains` 数组带出多余 `/tasks`+`/papers/selections` → 改按书行数**内容签名**触发
  （真机请求列表已复验：轮询节拍只剩 `/courses`）；③ 发起后领域徽标不即时转「探索中」
  （右键菜单因此不禁用）→ store 记 `counts` 快照并在 start/终态/重开时就地改徽标，
  `refreshBadges` 回读不得擦掉本地在跟任务；④ 选中课程时该课程论文行在课程头与分组头
  重复渲染两遍（W3 遗留，被本次注入态暴露）→ 分组头行按 `course_id` 去重。
  **验证（`qed-frontend-check`，8903 产物 `index-BSWyWHMN.js` + 8900 在跑）**：真机领域
  `math-advanced` 走通「发起→轮询→失败回显」——弹窗发起后进入
  `探索进行中 · 30% / 每 5 秒轮询 · 会话 74502a7eced8 / 规划检索计划`，8901 任务转
  `failed` 后弹窗即时进失败段并原样显示上游 error（`PaperSelectionError: 论文推荐失败；
  报告 sel-20261005T081444Z-156b6cb8：百炼结构化响应无效：Expecting value: line 1 column 1
  (char 0)`），页内论文行按 §7.2 出「失败」态行、右键「论文探索」保持可用（非禁用），
  刷新重开回到发起段（幂等，不重复发任务）；网络全部指向 8900（ADR 0007 无越权直连）、
  控制台零报错；截图仍受内嵌视口 0×0 限制（`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`），
  取证以结构快照 + 请求/任务记录为准。**门禁**：vitest 定向 5 文件 **77 passed**
  （新增 `paperExplore.test.ts` 23 例含徽标就地流转四条、`PaperExploreModal.test.tsx` 8 例，
  页面/树/行用例同步）；`tsc -b` 本会话文件零红（余 5 红全在并行 M2 练习轮未跟踪文件
  `src/stores/practice.ts`、`src/exerciseParse.ts`、`src/pages/LearnWorkbench.tsx`）；
  `vite build` 成功；根 `pytest tests -q` **716 passed | 5 failed**（五红全属并行 M2 壳
  `2026-10-01-toc-knowledge-tree-and-learn-workbench.md` 未登记/已挪归档所致，无 papers 路径）、
  `ruff check backend tests` **All checks passed**。文档同步：downloads-flow §7.2 补派生优先级
  与徽标点击口径句，`DownloadsTree.tsx` 头注菜单清单补「论文探索」。
  **W5 待发（本轮不绕过）**： ranked→评审→adopt→显式 `POST /books/{id}/fetch` 端到端一次尚未
  取得——卡在上游模型服务返回空结构化响应（当时记为百炼侧，见下条 1007 改判）。
- **2026-10-07 W5 卡点归因改判（取证脚本 `QED-Tracker/tmp/probe_w5_llm_calls.py`，只读查
  `qed_test`）**：链路走的**不是百炼**——8901 `api_select=qed-engine`，文字调用经 8900 网关路由到
  **local 渠道 LM Studio `qwen/qwen3.5-9b`**（`qed_llm_calls` 行 74/75/76/77 `service=qed_engine`、
  `mode=local`、`provider=lmstudio`），错误文案「百炼结构化响应无效」是 `bailian.py` 在网关模式下的
  **误导性措辞**，导致 0 正文故障被误记为外部服务面问题。事实三条：
  ① 网关把**空正文记成 `status=success`**（74/76/77 `resp_len=0`、`error=''`）后原样穿透，
  调用方只剩 `json.loads("")` 报错，账日志反而显示成功；
  ② 截断特征与已实测记录一致——`paper-plan/plan@v2`（prompt 1237 字）耗时 101s 出空正文，
  同模板 23s 出 542 字合法 JSON（行 75）；`assess@v1`（prompt 6011/12444 字）两次均 101~103s 出空正文，
  即思考段吃满 `max_tokens=4096` 后正文为空（同 `control.py:460` DEFECT-008 ③ 记录的现象）；
  ③ arXiv 检索与候选装配**已跑通**（assess 拿到真实候选），W5 断点只在评分一环。
  **归属**：①=根侧网关缺陷（`clients._extract_content` 只取 `message.content`，丢弃 `finish_reason`
  与 `reasoning_content`，使 M3 适配层 `scrub_thinking`/`is_reasoning_starved` 与 A-5 降 effort 重试
  在网关调用面上无从生效）；②=本地 9B 思考模型在论文评分载荷下的容量档，按机器侧守则不调业务参数绕开；
  ③=对方 8901 错误文案归因渠道。**2026-10-07 用户裁决（两项）**：① api 可切但 `qwen-plus` 无额度 →
  **启动 local 再试**（本轮不改渠道配置）；② 网关空正文穿透缺陷**并入 ARCH-027-M3 的 A-5 承接、不占 DEFECT 编号**（判据 J-A5a~d 见 [M3 壳](../../../plans/2026-09-23-local-model-adaptation.md)「过程与证据」2026-10-07 条，代码待用户「开始执行」）。两条都不构成根侧透传面与 8903 UI 的缺陷（W4 真机取证仍有效）。
- **2026-10-07 local 重试取证（W5 端到端驱动 `tmp/w5_run_recommend.py`）**：`POST /api/v1/models/text/start` → `starting`（派发宽限不判掉线），就绪后经 8900 `/llm/text` 以小 prompt 结构化调用 **16.9s 出合法 JSON**（`qed_llm_calls` 行 78 `success`）＝链路本身可用，失败面只在长 prompt 的评分环节；随后按 UI 默认参数（`domain_id=math-advanced`、`recipe=frontier`）重跑 `POST /papers/recommend` 端到端，任务态与报告态见下。
- **2026-10-07 W5 重跑结论：卡点真因＝对方 `_structured` 无 JSON 围栏抽取（代码侧，可修）**。任务 `8ce87c22bfb9` 约 2 分钟转 `succeeded`，但报告 `sel-20261007T054356Z-4a835e78` 为 `no_candidates`、`model.plan_source="fallback"`、`plan_fallback_error="百炼结构化响应无效：Expecting value: line 1 column 1 (char 0)"`——即检索计划并非模型给出，而是**确定性回退**（回退词 `"数学"` 中文单term × math.FA 三组，arXiv `fetched=0/kept=0` ⇒ 必然无候选）。取证链（`qed_llm_calls`，`qed_test`）：行 78 小 prompt 16.9s 出合法 JSON；**行 79 `paper-plan/plan@v2`（prompt 1237 字）39.6s 出 528 字、内容完全合规**（4 组英文 terms + 在册分类），但形态是 ` ```json ` **围栏包裹**；对方 `providers/bailian.py::_structured` 直接 `json.loads(content)`，围栏文本在 char 0 即解析失败 ⇒ 触发 repair 二次长调用（行 80，prompt 1776 字，71.6s 后正文空）⇒ 抛错走回退计划。根侧 `local_adapt.parse_json_reply` 早有三件套（直解→**围栏抽取**→最外层切片），对方四份 advisor（`bailian.py`、`providers/book_advisor.py`、`providers/explore_advisor.py`、`main_line/advisor.py`）均各自 `json.loads`，**同一容错在子仓库缺位**；1005 的三次空正文（行 74/76/77）才是思考截断形态，两类失败被同一条错误文案混在一起。修向与判据（待用户「开始执行」）：① 对方 `_structured` 解析前先做围栏抽取 + 最外层切片，围栏正文**不得**触发 repair 长调用（假响应回归：围栏 JSON→直接过校验；纯文本→按契约失败）；② 根侧网关空正文按失败返回＝A-5 承接（J-A5a~d，见 [M3 壳](../../../plans/2026-09-23-local-model-adaptation.md)）；③ 错误文案按实际渠道归因（网关模式不得写「百炼」）。W5 端到端在 ①+② 后重跑取 ranked→评审→adopt→显式取书。
- **2026-10-07 ① 已交付（用户裁决范围＝先只修围栏抽取）**：对方仓新模块 `src/qed_tracker/llm_json.py::loads_model_json`（直解→剥 ` ``` ` 围栏→最外层 `{}`/`[]` 引号感知切片，三档全失败抛 `ValueError`）+ `providers/bailian.py::_structured` 首解析与 repair 后解析均改走它；**错误文案与另三处 advisor 未动**（不在本轮授权范围，留后续承接）。TDD：`tests/test_llm_json.py` 8 例 + `tests/test_bailian_advisor.py` 5 例（围栏 plan/assess 一次过且 `calls==1`、散文包裹切片、纯文本仍 repair 一次、**围栏内越界分类仍按契约失败**）先红后绿。门禁：论文链定向 67 passed、`ruff check src tests` All checks passed、全量 **642 passed | 1 failed | 1 skipped**（唯一红＝存量 `test_orchestration.py` QED-067 在途线）、`test_documentation.py` 9 绿。文档同步＝对方 `paper-discovery.md`「百炼边界」补容错一句、`code-map.md` 新增 `llm_json.py` 行、068 壳新增「W5 取证与围栏抽取交付」节。**8901 需重启才在真机加载**（agent 触发重启被权限层拦下，转人工执行），重启后按 UI 默认参数重跑 `POST /papers/recommend` 取 ranked，再走评审→adopt→显式取书（W5）。
- **2026-10-09 W5 端到端再取证：新的硬卡点＝对方 8901 的网关客户端被 Windows 系统代理劫持 loopback（机器侧配置 + 对方代码，非根侧缺陷）**。当日四服务全停，按 operations.md 起 8900（`start --mode local --wait`）→ 8901（经 8900 `/services/tracker/start`）→ local 文字模型（`/models/text/start`，就绪 `ready=true`），再跑 `POST /papers/recommend`（`domain_id=math-advanced`、`recipe=frontier`）：任务 `1383b037c8ea` **15s** 转 `succeeded`，报告 `sel-20261009T025958Z-e8dc0004` 仍 `no_candidates` / `plan_source=fallback`，`plan_fallback_error="网关返回 HTTP 502"`；同一时刻 `qed_llm_calls` **零新增行**（max id 仍 85）＝请求根本没进 8900 网关。
  - **对照实验（同一请求体，三轮）**：`trust_env=False` → HTTP 200 + `success=true`（落库行 86）；默认（`trust_env=True`）→ **HTTP 502、空正文、无 `server` 头**；显式 `proxy='http://127.0.0.1:7890'` → 同样 502。`urllib.request.getproxies()` 返回 `{'http': 'http://127.0.0.1:7890', 'https': ..., 'ftp': ...}`（Windows 注册表系统代理；进程环境里没有任何代理类变量）。⇒ 502 由本地代理生成，根侧 8900 全程健康（同 body 直连即 200）。
  - **同族坑与约定差**：根侧 httpx 客户端一律 `trust_env=False`（网关 `clients.py`、监控、生命周期脚本皆如此，故行 86 能落库）；8901 调 8900 的网关客户端未带该参数 ⇒ 走系统代理，而该代理对 loopback 返 502。这条也回溯解释了 10-07 的「网关请求失败」——同一条路径，代理在/不在两种状态交替（当日 06:14–06:17 的行 81–84 证明那时请求确实到达 8900，06:34 起就不到）。
  - **归属与待裁（两条都不动根侧代码）**：① **机器侧**＝把 `127.0.0.1` / `localhost` 加进系统代理绕过表（或临时关代理）后重启 8901，即可零改动跑通 ranked→评审→adopt→显式取书全链——转人工执行，注册表写入不在 agent 权限与职责内；② **对方代码侧**＝8901 的 8900 网关客户端补 `trust_env=False` 以对齐跨项目约定，属子项目代码改动，跨项目铁律下需用户明确授权或按移交登记由其会话执行。二者任一达成即解除 W5 阻塞。
  - **A-5 已达成对 W5 的意义**：截断空正文不再被记成 success 穿透给 8901（真机行 85 为证），失败面在 8901 侧显式可见；9B 在 `plan@v2` 长载荷上的思考截断仍是容量档问题，按机器侧守则不调业务参数绕开，待代理解除后再取一次 ranked 实测。根侧透传面（`/papers/*` 四端点）与 8903 UI 本轮无新增缺陷。
- **2026-10-09 W5 端到端达成（用户裁决＝「你起 Clash，我重试」，根侧零代码/零配置改动）**：机器侧系统代理绕过与对方 8901 网关客户端 `trust_env=False`（用户授权的子项目改动）两条均落地后，`POST /papers/recommend` 两腿都取到 ranked，并走完 adopt→显式取书。
  - **领域级**：报告 `sel-20261009T031317Z-8a886b24`（21 candidates / 4 recommendations、`plan_source=llm`）→ adopt 得 `mathadvanced-b19`、`b20` → 显式 `POST /books/mathadvanced-b19/fetch` 落盘 `raw/math-advanced/_general/papers/2026/2604.14366_ac3527f8.pdf`（sha256 `ac3527f8…`）→ 经 **8903 书目详情「验证通过」按钮**（人工验收，非自动链）转 `verified`，页内行徽章「已完成」+ toast「验证通过，书目已完成」；`b20` 停留 `failed`（上游下载失败），行内出「失败」态且「论文探索」入口保持可用——五档徽标在真机同时覆盖到 待下载 / 下载成功 / 已完成 / 失败。
  - **课程级**：`recipe=core` 首跑 `no_candidates`（规划查询命中空 arXiv 页，负样本留档，非缺陷），按 UI 默认口径改 `frontier` + 英文 goal → `sel-20261009T033359Z-62ac54a4`（30 candidates / recs 1-10、`plan_source=llm`）→ adopt 落位 `course_id=partial_differential_equations` 得 `mathadvanced-b22` → fetch 落盘 `2606.11607_441aa00c.pdf`（sha256 `441aa00c…`）→ `downloaded`。自动链止于 `downloaded` 有代码依据（对方 `application/book_fetch.py:322/463` `mark_owned(..., status="downloaded")`），`verified` 只由人工验收置位。
  - **前后端真机联调**：8903 探索弹窗内完成一次真实 adopt → 创建 `mathadvanced-b21`（`course_id=probability`）；落位下拉＝本领域 + 12 门课程，已在库与未达推荐线的行按 §7.2 正确禁用；课程头论文行随即渲染该条并出「待下载」徽章（`PaperBooksRow`，downloads-ui.md §4.4）。`npm run build` 绿后按 qed-frontend-check 实测：73/73 网络请求全部指向 8900 且 200（ADR 0007 无越权直连），控制台零报错；截图仅 `tmp/w5_browser_domain_paper_row.png` 一张成功（领域卡 + 论文（2）行 + 失败徽章），余下受内嵌视口 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE` 限制，取证以结构快照 + 任务/报告/落盘记录为准。
  - **本轮唯一硬卡点＝机器侧代理（fetch 10061）**：任务 `f96546ae9117`、`93c37d44edc7` 转 `failed`，`下载失败：[WinError 10061] 目标计算机积极拒绝`。排除链：① 重启 8901 后重投仍 10061 ⇒ 非陈旧客户端；② 同 URL 直连 `arxiv.org/pdf/...` 200 / 2.23 MB（`trust_env` 两态均可）⇒ 公网可用；③ `settings.proxy='http://127.0.0.1:7890'` 来源＝**根 `.env` 的 `QED_PROXY`**（对方 config 优先级「真实环境变量 > 自身 .env > 根 .env」且空值跳过 ⇒ 以空 env 遮蔽不可行），而 7890 未监听（Clash 已关）。用户自选「起 Clash」路径后，7890 恢复监听，两条 fetch 零改动即成功。**与 loopback 坑分层**：公网下载走显式 `QED_PROXY`，代理进程下线即 10061；loopback 走系统代理劫持即假 502——同一台机器上的两个不同失败面，已分别入本机坑档。
  - **根侧在途契约偏差（归属登记，不在 REQ-102 范围，是否立 DEFECT 待用户裁）**：8900 `POST /books/{book_id}/fetch` 走通用 `_call`（`backend/qed_engine/api/tracker.py:465-468`）返回 **200**，而 `docs/architecture/api-contracts.md` 该端点与 8901 实际均为 **202**（uvicorn 访问日志为证）；另 `GET /papers/books` 投影中 `arxiv_id`/`pages` 为 null，书目详情弹窗却显示页数 26（前端另源展示），展示行不消费该两字段故无用户可见影响。
  - **W5 判定**：成功标准「8901 在线端到端一次（领域级+课程级各发起一次探索、pick 一单下载至 verified）」**达成**——两腿各发起一次探索且均 `plan_source=llm` ranked，`b19` 经 UI 验收至 `verified`，`b22`/`b21` 覆盖课程级落位与 `downloaded`/`candidate` 渲染。驱动脚本留档 `tmp/w5_run_course_leg.py`、`tmp/w5_course_adopt.py`、`tmp/w5_fetch_to_verified.py`（ADR 0011 临时面，日志 `tmp/w5_*.log`）。

## 验证与验收

- W1：文档门禁与契约测试全绿（design/architecture 链接与结构守护）；
- W2a/W2b：定向测试 `tests/test_api.py`、`tests/test_tracker_client.py` 先红后绿 + 契约；
- W3/W4：`web-ui` vitest + `tsc -b` + build，且按 qed-frontend-check 浏览器实测
  （8903 为构建产物托管，验证前 `npm run build`）；
- W5：全量门禁 + 真机取证落本节。

## 回滚

W1 文档节独立可回退（design-bugfix-log 或 git revert）；W2a/W2b 透传端点为新增面，
回滚=摘除路由与客户端方法；W3/W4 UI 行为展示行组件独立提交，逐提交回滚。
- **2026-10-09 S 条目逐条对照（关闭判定＝Achieved）**：
  - **S1 设计五面节成文且文档门禁绿**——达成 2026-09-30（W1）：downloads-flow §7（含 §7.2 派生表、§7.3 写点与降级）、downloads-ui §4.4 与 §3 领域右键、§4.2 汇总行按钮、dataset-conventions `_general/papers/` 注、api-contracts §③ papers 四端点行、cross-project-contracts §5 能力组行；本轮文档契约随全量门禁复跑无 papers 路径失败。
  - **S2 8900 透传有实现且定向回归绿**——达成 2026-10-03：`GET /papers/books`（固定 `kind=paper`）+ recommend / selections 列表与详情 / adopt 四端点（`backend/qed_engine/api/tracker.py`、`clients/tracker_client.py`）；`tests/test_api.py`、`tests/test_tracker_client.py` 随全量 **734 passed** 通过。
  - **S3 8903 领域/课程两级 `kind=paper` 书行渲染、空隐藏、浏览器实测**——达成 2026-09-30（静态版）与 2026-10-05（徽标态），并于 2026-10-09 在**有数**真机复验：领域级「论文（2）」与课程级「论文（1）」同屏渲染（`b19`/`b20` 挂领域、`b21` 挂 `probability`），五档徽标真机覆盖 待下载／下载成功／已完成／失败，空数据整行隐藏；`#/admin/downloads` 控制台零报错、73/73 请求只指 8900（ADR 0007）。
  - **S4 探索→轮询→评审→pick 书本化→下载→验收真机端到端**——达成 2026-10-09（上条 W5）：`mathadvanced-b19` 经 8903 书目详情「验证通过」至 `verified`（落盘带 sha256），`b22` 至 `downloaded`，8903 探索弹窗内完成一次真实 adopt 建 `b21`；前置 REQ-101 R1/R2 已由对方 A/B 步交付。
  - **S5 论文行不混入 `exploration_stage` 六/五态机、状态由任务态×报告态×书五层态派生**——达成：论文行只读 `/papers/books` 与派生徽标（`stores/paperExplore.ts` 的 `counts` 快照 + `paperStatusBadge`），六/五态字段零写入；`paperExplore.test.ts` 用例守护派生优先级与徽标就地流转，口径唯一事实源在 downloads-flow §7.2。
  - **门禁取证时点（2026-10-09 收口前）**：`tests/contract` **80 passed | 2 failed**、全量 `pytest tests -q` **734 passed | 3 failed**、`ruff check backend tests` **All checks passed**、`web-ui` vitest **624 passed / 58 files** + `npx tsc -b` 零红 + `npm run build` 成功。三红全部归因并行学习线的在途收口（`2026-09-23-learning-ui-rendering.md` 已置 Closed 但壳未挪、todo 行仍 Accepted ⇒ 元数据与镜像两红；roadmap 引用 `ARCH-027-M2` 未登记 ⇒ 第三红），与本任务 papers／前端面无交集；本壳归档随 `REQ-102` 行移除不新增亦不消除该三红。
  - **归属登记（不本任务修）**：8900 `POST /books/{book_id}/fetch` 透传返 200 而契约与 8901 均为 202（`api/tracker.py:465-468` 通用 `_call`）——是否立 DEFECT 待用户裁。

## 关闭与归档

关闭条件：S 条目全达成（W4 若因 REQ-101 被拒/长期后置，按移交型关闭取值规则处理，
判据见 task-lifecycle「关闭判定」节）；关闭时本壳 Retain 归档，REQ-102 行移 completed.md。

**关闭结论（2026-10-09）**：S1～S5 全达成（逐条对照见「过程与证据」），结果取 `Achieved`；本壳按判定的 Retain 归档至 `docs/history/plans/2026-10/`（相对链接按归档深度重算），`REQ-102` 行移 `docs/trackers/completed.md`，`docs/plans/index.md` 登记去处；遗留两面对本任务无阻塞＝fetch 200/202 契约偏差归属登记、对方错误文案与另三份 advisor 容错（10-07 ③，仍待裁）。
