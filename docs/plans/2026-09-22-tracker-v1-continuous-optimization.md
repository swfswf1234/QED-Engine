# QED-Tracker V1.0 持续优化滚动记录（tracker-v1-continuous-optimization）

状态：In Progress
任务类型：A
最后更新：2026-10-01
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

## 验证与验收

- 每条目修复/优化收口时：根侧改动跑对应定向测试与 `tests/contract`；子项目侧以对方回执为据。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯记录文档：删除本文件不影响代码与测试；登记表条目对应的代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件：三线连续一个版本周期无新增条目且遗留条目全部移交/关闭，由用户裁决收口；
关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-024 任务行。
