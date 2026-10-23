# QED-Tracker V1.0 持续优化滚动记录（tracker-v1-continuous-optimization）

状态：In Progress
任务类型：A
最后更新：2026-10-14
关联 ADR：无新增（治理沿用 [ADR 0011](../history/adr/v0.1/0011-pending-design-location.md) 不确定文档暂居 plans/；跨项目执行边界见 standards/cross-project-collaboration.md）
关联设计：[downloads-flow.md](../design/downloads-flow.md)（下载/探索全链路）、
[api-contracts.md](../architecture/api-contracts.md)（8900↔8901 契约）、
[llm-gateway.md](../design/llm-gateway.md)（本地模型链路消费面）
关联 Tracker：docs/trackers/todo.md（ARCH-024 任务行，一任务一行一壳，ADR 0016）
归档判定：Retain（滚动记录，关闭时按当时里程碑归档 history/plans/）

## 目标与成功标准

**目标**：承载 ARCH-024「QED-Tracker（V1.0）持续优化轮」的**同步优化记录**——三线发现的
每一个优化项/bug 在本壳登记（现象、定位、方案、责任侧、状态），与 QED-Tracker 侧台账同步；
本壳是根侧唯一滚动记录，不为单项优化另立计划。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../trackers/todo.md)
`ARCH-024` 行的「成功标准」列，本壳不复制判据条目；收口手段见「验证与验收」节，
执行进展与证据见「过程与证据」节。

**范围边界（2026-09-22 用户裁决）**：QED-Tracker 只负责**知识/教材等探索与下载**；线 1 的
「本地模型链路」仅限服务其 LLM 检索/选书业务的模型调用环节，不外延到 8900 网关或渲染。

## 范围与非目标

**范围**：三线优化项的登记、评估与根侧承接修复记录——① **本地模型链路**（**仅限服务其
LLM 检索/选书业务**的模型调用：配置、稳定性与降级，是探索链路的内部环节）、② **论文探索
和下载**（arXiv/论文源适配器、批量探索与下载质量）、③ **下载链路评估与 bug 修复**（下载
校验/重试/失败面复盘）；8901 透传链路与 8903 下载管理界面消费面。优化项逐条发现即在本壳
登记，实施经用户确认排期。

**非目标**：解析与知识库面（归 [ARCH-025 滚动壳](2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md)）；
渲染优化（归 [学习设计轮 M1 壳](../history/plans/2026-10/2026-09-23-learning-ui-rendering.md)）；
不做第四/五轮主线功能（归 ARCH-027 重设计）；不代替 QED-Tracker 子仓库自身计划（其侧实施
在其仓库立项）。

## 前置条件

1. ARCH-024 任务行已在 todo 登记（2026-09-22，ADR 0016 改单行单壳）。
2. QED-Tracker 服务（8901）可达或其离线降级路径已知。

## 工作项（滚动登记表）

### 线 1：本地模型链路（8901 LLM 检索/选书）

| 条目 | 现象/动机 | 方案要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| （待登记） | — | — | — | — |

### 线 2：论文探索和下载

| 条目 | 现象/动机 | 方案要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| REQ-101 论文链路 scope 化与书本化采纳请求（R1~R4） | 根侧设计需求：8903 领域/课程各挂前沿/核心论文展示行、探索由领域入口发起（2026-09-30 入口收敛裁决）；8901 现状无领域/课程维度、recommend/download 仅 CLI、发现论文不落库（QED-071 D2/D14 口径，2026-09-30 用户裁决改判） | 请求稿正文=根侧 [REQ-101 壳](2026-09-30-req101-paper-scope-books-adoption-request.md) + 对方 068 壳「根侧需求扩展」节；并入 QED-068（068-5 扩展 scope + 新增 068-6 书本化采纳） | 根→Tracker | Accepted，需求稿＋链路复审三步序列已落对方 068 壳（2026-09-30）；**A 步已交付（2026-10-01）**——R2 枚举面（8901 `GET /books` + `qt_books.kind`/`course_id`）与细节 #1/#4 落定，R1/R3 待 B 步、R4 待 D 步 |
| REQ-102 根侧消费面实现（8900 透传 + 8903 展示行） | 8900 契约无任何 papers 端点；8903 四层展示无论文挂载位 | [REQ-102 壳](../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md) W1~W5：设计五面晋升→papers 透传→静态清单行→探索管理弹窗→真机回归；静态清单行组件形态先行（数据挂点=规划端点 /papers/books，未实装静默空态） | 根 | 已收口 2026-10-09（Achieved，S1～S5 全达成）：W1~W5 全落＝设计五面晋升 + 8900 papers 透传五端点 + 8903 两级展示行与探索管理弹窗 + 真机端到端（`mathadvanced-b19` 至 `verified`）；壳 Retain 归档，取证见归档壳「过程与证据」2026-10-09 两条 |
| REQ-107 论文线合并设计与实施基准（E1~E5 设计本体 + 实施清单 I1~I7） | 用户 2026-10-11 梳理需求：现探索弹窗「设置→轮询→候选勾选」把模型检索计划藏在中段之后（用户要求先看怎么检索再谈采纳）；入口按钮靠左未与同排按钮平齐；无「4 分以上高相关才进待选」的成文判据；候选只有理由没有摘要/总结视图；已采纳论文只在领域/课程行内以文本条目呈现、左树无独立栏位 | 合并基准正文=[REQ-107 壳](../history/plans/2026-10/2026-10-11-paper-explore-ui-and-papers-column.md)（E1 入口形态、E2 弹窗五段含新增「检索口径」段、E3 待选区间判据 `recommended` ∧ `goal_fit≥4`、E4 详情标题/摘要/评审小结（已入库走 sources→selection 按需回源，零新端点）、E5 左树派生「论文」节点 + 右栏卡片列）；两个事实缺口「权威」「总结」上游无字段，处置已裁定（R3 界面不出现「权威」字样、R4 第三段定名「评审小结」）；引用数亦无数据源，Q1 已裁＝暂不做、界面仅预留展示位，**不提跨项目请求** | 根（本轮只出基准文档，不动码；实施按 I1~I7 另立 REQ-108 开发行） | 已收口 2026-10-14（Achieved，随 REQ-107／108／109 三行同批关闭）：正文按 R1~R12＋Q1 定稿并按用户 2026-10-11 裁定在 plans/ 合并为论文线唯一执行基准（实施清单 I1~I14）；I1~I7 由 REQ-108、I8~I14 由 REQ-109 实施完毕，按用户 2026-10-14 晋升令并入 `design/`（[downloads-ui.md](../design/frontend/downloads-ui.md) §4.4 整节重写＋§3/§4.1/§4.2/§5/§6/§8 与 [downloads-flow.md](../design/downloads-flow.md) §7 对齐）；三壳 Retain 归档 `history/plans/2026-10/` |
| REQ-108／REQ-109 论文线界面两轮实施（I1~I7 + I8~I14） | REQ-107 基准定稿后需按清单落地；第一轮后用户追加四项界面反馈（历史清单要成一个按钮、旧论文展示行删除、只留领域论文栏卡片列、四方向各真跑一次） | [REQ-108 壳](../history/plans/2026-10/2026-10-11-paper-ui-implementation.md) I1~I7（入口同排右靠齐／弹窗五段含检索口径段／待选区间双门槛与逐条归因／详情与按需回源／左树「论文」节点与卡片列）＋ [REQ-109 壳](../history/plans/2026-10/2026-10-11-paper-ui-iteration-2.md) I8~I14（检索方向四值根侧参数映射、段①不露推荐上限且恒 `top=5`、历史探索清单单按钮直达段④、段④只列未采纳且达线、旧展示行整行删除＋徽标进汇总行）；纯前端零新端点、8901 `RECIPES` 与 8900 端点零改动 | 根 | 已收口 2026-10-14（Achieved）：四方向真机探索已发起并取证（仅前沿 `ranked`，核心／深度／匹配三份 `no_candidates` 归因在对方检索计划分类越界与模型响应截断）；两枚界面口径缺口按用户裁决不登行、写在 REQ-109 归档壳「遗留与移交」；「采纳＋取书」腿按裁决不补，沿用 REQ-102 W5 |
| （待登记） | — | — | — | — |

### 线 3：下载链路评估与 bug 修复

| 条目 | 现象/动机 | 方案要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| （待登记） | — | — | — | — |

## 过程与证据

- **2026-09-22 立项**：QED-Tracker（V1.0）持续优化轮登记为 ARCH-024 主线行；同轮按
  [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 改单行单壳（原 ARCH-024 主线行 +
  PLAN-049 镜像行合并为本壳）。
- **2026-09-22 范围边界裁决**：QED-Tracker 只负责知识/教材的探索与下载，线 1「本地模型链路」
  不外延到 8900 网关或渲染。
- **2026-09-30 台账结构改判（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)）**：
  验收判据正本移入 todo 行「成功标准」列，原行内立项与合并叙述迁入本节。
- **2026-09-30 现状**：线 1/线 3 登记表仍为「（待登记）」占位，无条目落地；子项目侧实施归
  QED-Tracker 仓库，根侧只登记请求与跟踪（见[跨项目协作规范](../standards/cross-project-collaboration.md)）。
- **2026-09-30 线 2 首批条目立项（论文链路对齐轮）**：用户三项裁决——① 展示行数据来源=
  回归 `qt_books` kind=paper 书本化采纳（推翻 QED-071 D2/D14「发现论文不进库」口径）；
  ② 课程级论文落盘=逻辑分组（物理维持领域级 `raw/<domain>/_general/papers/`，不开课程级
  papers 目录）；③ 排期=并入对方 QED-068 本期计划（v1.0 主线②），对方不另开承接 ID。
  据此立项 [REQ-101（请求：QED-Tracker）](2026-09-30-req101-paper-scope-books-adoption-request.md)
  与 [REQ-102（根侧实现）](../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md)两行两壳，
  需求稿正文已写入对方 `docs/plans/2026-09-14-paper-pipeline-alignment.md`「根侧需求扩展」节
  （对方 git 提交留对方窗口）。裁决全文另见 REQ-101 壳「过程与证据」节。
- **2026-09-30 线 2 后续（入口收敛裁决 + REQ-102 W1 落笔）**：用户裁决论文探索**仅领域级
  发起**（领域右键＋汇总行 [论文探索] 按钮 → 管理弹窗），pick 评审时逐条落位领域或课程，
  课程行只展示；据此完成 REQ-102 W1 设计五面晋升（downloads-flow §7、downloads-ui §4.4、
  dataset-conventions、api-contracts §③ 规划契约、cross-project-contracts §5），
  REQ-101 R1/R2 与对方 068-6a/6b 同步口径；门禁根契约 82 绿、对方 test_documentation 9 绿。
- **2026-09-30 线 2 再后续（REQ-102 W3 静态展示行交付）**：W3 前置勘验证实「books 链现成」
  premise 不成立（8900 GET /books=Axiom af_books 代理，8901 无域级枚举端点），口径修正为
  规划端点 `GET /api/v1/papers/books`（W2 实装、上游=REQ-101 R2），已同步 downloads-ui §4.4
  数据源句与 api-contracts §③（新增第五行）；随后 TDD 交付 8903 论文展示行
  （groupPaperBooks/PaperBooksRow/store paperBooks+refreshPapers/四点位挂载+BookDetailModal 复用），
  vitest 定向 22 绿、全量 407 绿（唯一红与 tsc 两红均属并行 WIP 文件）、vite build 成功、
  浏览器实测空态静默+注入态分桶/排序/详情弹窗通过；取证全文见 REQ-102 壳「过程与证据」。
- **2026-09-30 线 2 复审（对方全链勘察 + 执行序列精简裁决）**：用户授权查阅并操作
  QED-Tracker，对其论文链做全链复审——检索/计划/报告三环已由其 S1~S3 交付，**入口/落盘/
  入库三环仍断**，八条代码事实（8901 论文面仅一条即时端点、HTTP 侧未注入 advisor、
  CLI 报告落 in-memory SQLite 进程退出即失、论文直写不进 `qt_books`/`qt_sources`、
  落盘 domain 硬编码 `math`、`qt_books` 无 `kind`/落位列、8901 无 books 枚举端点、
  论文 `book_id` 无 abbr 来源）与精简序列正本写入对方 068 壳
  「链路复审与执行序列精简」节（不新建其 md，规避文档白名单坑）。用户三裁决：
  ① 对方序列改 **A~D 三步**（A 最小出数=ALTER 加列+books 枚举端点+修 CLI 持久化与
  domain 传参；B 探索服务化+书本化一次到位=adopt 建书行并复用 `/books/{id}/fetch`，
  **不实现短命的 `paper_download` 直写端点**；C=068-4 安全件与文档收口；D=存量回填）；
  ② CLI 报告不落库缺陷并入 A 步修，不另开 DEFECT；③ 结论两侧都落笔。
  红线登记：`qt_books` 属对方私有表、列集漂移触发其 `db/schema.py` DROP+CREATE 自愈，
  加列必须先手工 ALTER 生产库（先例=QED-071 三列）。根侧随之把 REQ-102 W2 拆
  W2a（枚举透传，依赖 A 步，落地即让 W3 展示行出数）/W2b（探索面，依赖 B 步），
  REQ-101 R2 判据补「枚举响应行必须携带 `kind` 与落位字段」，api-contracts §③ 同步。
  门禁：对方 `tests/test_documentation.py` **9 passed**、根 `pytest tests/contract` **82 passed**。
- **2026-10-01 线 2 口径复确认（用户）**：论文链路=「搜索→确认→下载→验证」四步、单独主动
  探索触发、经「论文探索」界面进入一轮搜索与确认；「并非和领域书籍一块」经追问明确=
  **只指入口与状态机独立**（不共用领域 6 态/课程 5 态 `exploration_stage`，即
  downloads-flow §7.2 现状），**存储仍书本化**（`qt_books` kind=paper + 复用书本五层态链）、
  领域/课程沉淀展示行**保留现状**。故 0930 裁决①不改判，A~D 序列与根侧 W2a/W2b~W5
  口径继续有效，W3 交付物零返工。
- **2026-10-01 线 2 对方 A 步交付（用户发令「进行 A 步」，根会话在 QED-Tracker 内执行）**：
  按红线顺序完成四项——① `qt_books` 加列在 `qed_test` 执行（新增迁移件
  `scripts/qed068_alter_book_kind.py`：勘查 → `--dry-run` 出 SQL → 备份 26 行可重放 INSERT →
  ALTER → 复核；22→24 列、行数不变、两索引齐备、存量 `kind` 全 `book`），模型同步
  `BookKind`+`kind`/`course_id` 后 `ensure_schema → (0, 0)`；**生产 `qed` 库未执行**，
  未 ALTER 前不得启动新版服务（否则私有表自愈清空书库）；② 8901 新增 `GET /api/v1/books`
  （三参数 AND 过滤、行含 `kind`/`course_id`、非法 kind 422、无命中空数组），真库只读冒烟
  26 行全携带两新列、`kind=paper` 空集（B 步 adopt 前属正常）；③ F3 修复（CLI 在
  `db_configured` 时传 `session_factory`，引擎由 `PaperService.close()` 释放，无库仍
  in-memory 回落）；④ F5 修复（`download`/`download_selection` 增 `domain_id`，CLI `--domain`）。
  对方门禁：`ruff` 全绿、`pytest tests -q` **586 passed | 1 failed**（唯一红=存量
  `orchestration/evidence` 断言，该模块与其测试均未在本轮改动内）、`test_documentation.py` 9 绿。
  回执落定：落位字段=`course_id`（空串=领域级）+`domain_id`、类别=`kind`（`book`/`paper`），
  发现论文=`kind=paper` 且无 `knowledge_id` → 与 8903 W3 现实现一致、**W3 零改动**，
  REQ-102 W2a 上游依赖解除。新记 **F9**：真库唯一领域 `math-advanced`（书行落
  `raw/math-advanced/<course>/`）而论文默认桶 `DEFAULT_DOMAIN_ID='math'`，两者目录分裂——
  A 步只让 domain 显式可传、未改默认值，裁定留对方 B 步。证据正本=对方 068 壳
  「A 步交付（2026-10-01）」节。
- **2026-10-01 线 2 同日追加两裁决（改判上一条的两处口径）**：① **论文没有默认桶**——上一条
  留 B 步裁的 F9 就此裁定：取消论文链路一切 `DEFAULT_DOMAIN_ID` 兜底，`domain_id` 必填且须在
  `qed_domain` 已存在，缺失/不存在即拒绝落盘与建书行；对方 A 步随即落地 ⑤′（`PaperService`
  必填关键字参数 + `_require_domain` 校验、可注入 `domain_exists` 由 `KnowledgeRepository.get_domain`
  装配、CLI `--domain` 默认空串且落盘分支缺参返回码 2），对方门禁复跑 `ruff` 全绿 +
  `pytest tests -q` **589 passed | 1 failed**（唯一红不变）+ `test_documentation.py` 9 绿；
  ② **生产 `qed` 库不做本次 ALTER**（取代上一条「未 ALTER 前不得启动新版服务」的上线红线口径）
  ——等 1.0 整体完成后走**重建**窗口（重建后重导书目 + D 步处置论文存量），在此之前不得把本版
  代码指向 `qed` 长期运行；根侧 8900/8903 走 `qed_test`（已加列）不受影响。
  根侧同步=downloads-flow §7.1 无默认桶守则、dataset-conventions 发现论文条目、
  api-contracts §③ `recommend`/`adopt` 必填与存在性、REQ-101 R2 条目与两壳证据节。
  正本=对方 068 壳「F9 裁定」「生产库口径（2026-10-01 用户裁决改判）」两段。

- **2026-10-01 线 2 对方 B 步交付（用户裁五项实现细节后发令「开始执行」）**：论文探索服务化
  与书本化采纳一次到位——8901 新增四端点（`GET /papers/selections`、`GET /papers/selections/{id}`、
  `POST /papers/recommend` 202 `paper_recommend`、`POST /papers/selections/{id}/adopt` 202
  `paper_adopt`），scope 折 `qt_selections.model.scope`（零表结构改动），新增 `paper_recipes.py`
  配方层（`frontier`/`core` → arXiv 分类封闭映射，映射不到即 422），`adopt_paper` 建 `candidate` 态
  `kind=paper` 书行 + `qt_sources(channel=arxiv)` 身份（同 arXiv ID 二次采纳 `duplicated`），
  `book_fetch._fetch_paper` 分叉直取（不跑书名检索，内容校验＝ID 解析到的即匹配），落盘
  `raw/<domain>/_general/papers/<year>/<arxiv_id>_<sha8>.pdf` 且领域缺失即拒；CLI
  `papers recommend`/`selections list|show|adopt` 转 8901 HTTP，`selections download` 与
  `PaperService.download_selection` 退役（下载唯一路径＝`books fetch`）。五项裁决：#1 B 案分叉、
  #2 领域 abbr + 域内 `-bNN`、#3 评分理由只留 `qt_selections`、#4 配方封闭映射、
  #5 **adopt 不自动下载**（→ REQ-102 W4 pick 后须显式 `/books/{id}/fetch`）。
  对方门禁：`ruff` 全绿 + 论文链定向 114 passed + `pytest tests -q` **629 passed | 1 failed**
  （唯一红仍=存量 `orchestration/evidence`，QED-067 线在途）+ `test_documentation.py` 9 绿；
  对方文档同步 README/`api.md`「⑥ 论文探索」/`code-map.md` 八行。
  正本=对方 068 壳「B 步交付（2026-10-01，本仓执行）」节 + REQ-101 壳同日证据条。

- **2026-10-11 线 2 追加（论文界面梳理轮，REQ-107 立项）**：用户要求把论文探索从「一键出候选」改为「先看怎么检索、再谈采纳」并给已采纳论文独立栏位，本轮只梳理文档。勘查定住的事实基座（带行号，详见 REQ-107 壳「过程与证据」）：入口实有三处（树右键／汇总行／行内链接）且 `.dl-summary` 无 flex 致按钮未右靠齐；`GET /papers/selections/{id}` 经 8900 纯透传已带回 `search_plan`（terms·category·reason·fetched·kept）、`plan_source`、`profile`、`candidates[].abstract` 与三维分，故「检索口径段」与「摘要详情」均为纯前端可达；`top`/`limit`/`years_limit` 请求可覆盖（top 1..20）⇒ 待选区间容量不需向对方提 REQ；两处上游缺口——arXiv 适配器未映射 `journal_ref`/`doi`/`comment`/`primary_category`（无权威信号）、报告无总结生成节（只有 `assessment.reason`+`risks`）；`qt_books` 无 arXiv 列、身份在 `qt_sources(channel=arxiv)`，8900 已透传 `GET /books/{id}/sources` ⇒ 已入库论文详情按需回源可行。设计稿与待裁 R1~R6 见 REQ-107 壳；`design/` 本轮未动，晋升待用户裁定。
- **2026-10-11 线 2 六项裁定（REQ-107 设计本体按此定稿）**：R1 汇总行内右靠齐且与「当前选择：领域／课程名」文本行同一排（页头动作组形态作废；补充勘查＝该行文本实态为 `领域：X`/`课程：Y`/`教程：Z`，`Downloads.tsx:1003-1010`）；R2 课程语境保持取所属领域、无则置灰；R3 「权威」不进门槛、界面不出现该字样，引用数改「只展示不筛选」——但全仓复核无任何论文计数数据源（`rg -i citation|引用数|semantic_scholar|openalex` 只命中教材资源引用数组与编排 evidence_refs），故记为悬留项 Q1、界面仅预留展示位；R4 详情第三段定名「评审小结」（`reason` + `risks`）；R5 论文栏与行内展示行并存（栏＝领域全量含课程落位）；R6 双门槛 `goal_fit ≥ 4` ∧ `score ≥ 80` ∧ 服务端 `recommended`（用户口径「先只要少部分」），未入选区逐条唯一归因、段① `top`（≤20）给容量出口。
- **2026-10-11 线 2 合并基准裁定（REQ-107 由设计稿升为论文线唯一执行基准）**：用户裁「现在还不到晋升的程度，先在 plans/ 文档合并并梳理成一个文档，按照这个文档做完然后等确认后再晋升；Q1 引用数——① 暂不做、只留位」。据此 REQ-107 壳改为「文档下载管理·论文线合并设计与实施基准」：新增「合并说明」表（REQ-102 归档壳只并「不可回退面」清单、`downloads-flow.md` §7 与 `downloads-ui.md` §4.4 走**指针引用不复制**、REQ-101 请求壳**不并**只在「上游与遗留指针」挂未决项）、「已交付现状基线」表（8900 五端点透传 / 行内展示行与五档徽标保留 / 弹窗三段扩五段 / 采纳链不自动下载 / 真机数据面 b19·b20·b21 / stores 单一轮询沿用）与「实施清单 I1~I7」（每项带涉及文件与可观察完成判据，动码前按 ADR 0016 另立唯一开发行 REQ-108）；Q1 关闭口径＝界面仅预留引用数展示位、字段缺失整位不显示（不显示 0）、不取数、不提跨项目请求，本文档无悬留项；`design/` 全程未动，晋升＝I1~I7 实施完成 + 用户确认之后的动作（W2）。

- **2026-10-14 线 2 论文界面两轮收口＋设计晋升（REQ-107／108／109 三行 Achieved）**：用户令「将文档确定内容晋升，本任务阶段性完成，现在开始收尾」，四项裁决＝① 晋升落点按 REQ-107 壳「晋升清单」全表（`downloads-ui.md` §3／§4.1／§4.4 整节重写、`downloads-flow.md` §7.2 补派生视图口径；经核 `code-map.md` 无需增行），② 三行全 Achieved 收口且三壳 Retain 归档 `history/plans/2026-10/`，③ 两枚界面口径缺口（段③年窗读配方缺省值、汇总行徽标只按最新一份报告派生）都不登 todo 只留归档壳「遗留与移交」，④ 不补「采纳＋取书」真机腿（端到端证据沿用 REQ-102 W5 的 `mathadvanced-b19` 至 `verified`）。台账连锁＝todo 三行移除并写 `completed.md`、`plans/index.md` 补三条已归档行、本壳 REQ-107 条目状态格改判并加上表实施条目、`project-status.md` 当前主线加论文线收口条；**本批未提交 git**（用户未要求，改动全在工作树）。

## 验证与验收

- 每条目修复/优化收口时：根侧改动跑对应定向测试与 `tests/contract`；子项目侧以对方回执为据。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯记录文档：删除本文件不影响代码与测试；登记表条目对应的代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件：三线连续一个版本周期无新增条目且遗留条目全部移交/关闭，由用户裁决收口；
关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-024 任务行。
