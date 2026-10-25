# （请求：QED-Tracker）论文链路领域/课程 scope 化与书本化采纳（paper-scope-books-adoption-request）

状态：Closed（**Achieved**，2026-10-24 收口：S1~S6 全达成；R4 由对方 2026-10-15 的 D 步裁决按「声明只读、不回填」分支给出答卷，原判据的「可转只读口径后单独关闭」与整行收口同时兑现，详见「关闭与归档」节；判 Retain 归档）
任务类型：A
最后更新：2026-10-24
关联 ADR：[ADR 0016](../../../adr/0016-todo-registration-one-task-one-plan.md)（一任务一行一壳）、
[ADR 0022](../../../adr/0022-task-chain-clarifications.md)（移交型关闭取值与回执口径）
关联设计：[downloads-flow.md](../../../design/downloads-flow.md)（探索状态机与课程收集五阶段）、
[downloads-ui.md](../../../design/frontend/downloads-ui.md)（四层展示规范——领域论文栏的挂载面）、
[dataset-conventions.md](../../../design/dataset-conventions.md)（论文落盘与内容身份口径）、
[cross-project-contracts.md](../../../design/cross-project-contracts.md)（8901 能力面与「写操作=后台任务」）
关联 Tracker：docs/trackers/todo.md REQ-101；登记与跟踪由
[ARCH-024 滚动壳](../../../plans/2026-09-22-tracker-v1-continuous-optimization.md)线 2 条目承载；
需求稿正文已写入 QED-Tracker `docs/plans/2026-09-14-paper-pipeline-alignment.md`
「根侧需求扩展」节（实施事实源在对方台账，根侧不双写）
归档判定：Retain（移交存根随 REQ-101 关闭归档）

## 目标与成功标准

**目标**：让 8901 论文探索链路具备**领域/课程 scope**，并把显式 pick 的论文**采纳为
`qt_books` 行（kind=paper）纳入书本下载链**，使根侧 8903 能在领域/课程下各挂一行
「前沿/核心论文」展示行——探索由领域入口发起（2026-09-30 入口收敛裁决），评审产物
逐条落位到领域或该领域下课程。需求定义方=根仓库用户（2026-09-30 三项裁决，
见「过程与证据」节），实施排期**并入 QED-068 本期计划**（v1.0 三主线口径主线②），
不另开对方任务 ID；**实施形态（表结构/内部编排/端点路径）由 QED-Tracker 侧自定**，
本稿只给能力需求与消费侧验收判据，对方台账为实施事实源。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../../../trackers/todo.md)
`REQ-101` 行的「成功标准」列，本壳不复制判据条目；R1～R4 能力需求逐条正文见
「能力需求清单」节，执行进展与证据见「过程与证据」节。

## 范围与非目标

**范围**：能力需求清单（R1～R4）＋承接与回执跟踪；对方侧落点为
QED-068 的 068-5（S4 任务化端点扩展 scope 参数）与新增子任务 068-6（书本化采纳，
编号由对方评审可调）。

**非目标（边界，不要求对方）**：不要求论文链引入 `exploration_stage` 状态机
（沿用对方 068 边界：报告快照+显式 pick 即审阅态）；不改变「模型不写资源事实」
「不自动下载」「默认测试零公网」「TLS 默认开启」约束；不改 assess 三项评分契约
（goal_fit/foundational_value/readability）；068-1/2/3 既有范围不重开；
根侧 8900 透传与 8903 展示行实现不在本请求内（归
[REQ-102 壳](../../../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md)）。

**改判说明**：本请求推翻 QED-071 D2/D14「发现论文不进 `qt_books`」口径（对方 2026-09-26
裁决），改由本会话 2026-09-30 用户裁决承接——同一裁决人、同本期计划内的改判，
对方侧需重写其 `docs/design/paper-discovery.md`「事实边界」节（对方治理面，由对方执行）。

## 能力需求清单

| # | 能力 | 需求描述（做什么） | 验收判据（消费侧观察） |
| --- | --- | --- | --- |
| R1 | **探索 scope 化** | 论文 recommend 入参增可选 `domain_id`/`course_id`（根侧**发起语境仅领域**——2026-09-30 入口收敛裁决；course_id 维度作 scope 过滤与落位表达保留，供 selections 查询）；goal 缺省时自动从 `qed_domain.description` / `qed_course` 名称+描述推导（profile 保留为全局模板，可被 scope 派生目标覆盖）；`qt_selections` 报告快照落 scope 字段 | 带 `domain_id=X` 提交 recommend → 返回报告含 scope；`GET /papers/selections?domain_id=X` 仅返回该范围报告；不带 scope 参数时现行为不变（兼容） |
| R2 | **书本化采纳** | 显式 pick 不再走 `ResourceService` 论文直写路径，改为：创建 `qt_books` 行（`kind=paper`、归属=**pick 时逐条落位的 refs**（domain_id 或该领域下 course_id，默认=发起领域）、内容标识=arXiv ID），后续下载/校验/验收走书本五层态链（candidate→…→verified，arXiv 为渠道适配器给 URL）；`excluded_existing` 查重口径从「资源记录」改为「书库标题/arXiv ID 命中」；论文 PDF 物理落盘维持领域级 `raw/<domain>/_general/papers/`（**`domain_id` 须真实传参且为 `qed_domain` 已登记领域——论文无默认桶，2026-10-01 用户裁定**），课程归属纯逻辑（2026-09-30 裁决「逻辑分组」） | pick 后书库出现 kind=paper 行且可被自动下载链拉取至 verified；同 arXiv ID 二次 pick 命中查重不重复建行；`GET /books?domain_id=&kind=paper` 与 `GET /books?course_id=&kind=paper` 可枚举（供 8903 展示行直读）；**枚举响应行必须携带 `kind` 与落位字段**（`domain_id` + 课程归属，课程为空即领域级）——8903 分桶的唯一依据，字段名以对方回执为准 |
| R3 | **前沿/核心两配方** | 任务请求体增 `recipe: frontier \| core`：frontier=现默认（relevance+years_limit 3）；core=years_limit 0 + `foundational_value` 阈值筛选（阈值与排序键对方定）；两配方共用现有评分契约，不新增模型调用 | recommend body 带 recipe 各跑一次：frontier 结果发布日集中于窗口内、core 结果含窗口外经典且 foundational_value 达标；非法 recipe 提交即 422 |
| R4 | **存量回填口径** | 已下载至 `_general/papers/` 的历史论文（现无书目行）给出处置口径：一次性补登记为 kind=paper 书行（按文件名 arXiv ID + sha8 对账），或声明维持只读不再展示；实施可为 D 类人工窗口，口径先行 | 对方回执明确二选一；选补登记时抽验 N 条与盘上文件一一对应、无幻影行 |

## 前置条件

1. 对方审阅 068 壳「根侧需求扩展」节并确认承接排期（**2026-09-30 复审后口径=A~D 精简三步**：
   R1/R3 与 R2 的服务化面并入 B 步、表结构与枚举端点前置为 A 步、R4=D 步人工窗口，
   正本见对方壳「链路复审与执行序列精简」节）；回执需覆盖四条待定夺实现细节
   （落位表达形态、论文 `book_id` abbr、评分理由留痕落点、`kind` 值域区分）；
   **不新增对方 md 文件**（扩展写在其白名单内既有壳文件，规避对方文档全集白名单坑）；
2. 根侧 design/ 节晋升（REQ-102 W1）与本改判口径同步：dataset-conventions 的 kind=paper
   落盘豁免注未晋升前，R2 不落实现；
3. 068-2/3 与 QED-072 G1 闸门排期不动——scope 参数形状在 B 步一次定稿，避免端点签名二次改；
   **A 步的 `qt_books` 加列须先手工 ALTER 生产库**（对方私有表自愈为 DROP+CREATE，
   直接改模型会清空书库），ALTER 窗口独立留痕。

## 工作项（滚动登记表）

| # | 工作项 | 责任侧 | 状态 |
| --- | --- | --- | --- |
| W1 | 根侧三项裁决记录 + 请求壳 + REQ-102 实现壳立项 | 根 | 完成 2026-09-30 |
| W2 | 需求稿正文写入对方 068 壳扩展节（含元数据裁决行） | 根 | 完成 2026-09-30 |
| W3 | 对方逐条回执 R1～R4（接受/改造/后置/拒绝 + 排期），根侧回填 | 对方 | 已收口 2026-10-24（R1／R3 与 R2 采纳面由 B 步 2026-10-01 交付、细节 #2／#3／#5 同批落定；R2 枚举面与细节 #1／#4 由 A 步 2026-10-01 交付；R4 由对方 2026-10-15 的 D 步裁决给出二选一答卷＝存量旧 PDF 只读、不补登记不搬迁；逐条答卷正本在其 068 归档计划「D 步裁决」节与本壳「过程与证据」2026-10-24 条） |
| W4 | ARCH-024 壳线 2 条目随回执/实施滚动更新 | 根 | 已收口 2026-10-24（线 2 的 REQ-101 条目状态单元格刷至终态；该枚是论文线最后一枚在册开放行，关闭后线 2 其余五条目早已 Achieved） |
| W5 | 联调：REQ-102 W4 探索入口端到端跑通取证 | 根 | 完成 2026-10-09（真机两腿 ranked→adopt→显式取书→验收：
  `b19` 至 `verified`，其中 `b21` 由 8903 弹窗发起；判据见归档壳「过程与证据」2026-10-09 条） |

## 过程与证据

- **2026-09-30 用户裁决（三项，本请求的依据）**：① 论文展示行数据来源=**回归
  `qt_books` kind=paper 书本化**（推翻 QED-071 D2/D14「发现论文不进库」）；
  ② 课程级论文物理落盘=**逻辑分组**（仍落领域级 `raw/<domain>/_general/papers/`，
  课程归属由书行 refs 表达，不开课程级 papers 目录、免 dataset 布局破坏性变更）；
  ③ 排期=**并入本期计划（v1.0）QED-068 任务**，对方不另开承接 ID。
- **2026-09-30 立项**：根 todo 登记 REQ-101（请求行）与
  [REQ-102（根侧实现行）](../../../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md)，
  ARCH-024 滚动壳线 2 登记首批条目（此前为「（待登记）」占位）。
- **2026-09-30 移交**：需求稿写入对方
  `docs/plans/2026-09-14-paper-pipeline-alignment.md`「根侧需求扩展」节
  （对方 git 提交留对方窗口；对方 workspace 只写文档、不产生代码改动）。
- **2026-09-30 探索入口收敛裁决（用户）**：论文探索**仅领域级可发起**——入口=领域右键
  「论文探索」+ 选择汇总行「论文探索」按钮（打开论文探索管理弹窗）；课程行只挂展示行、
  无探索入口；**确认（pick）后逐条落位**到领域或该领域下课程。R1/R2 口径与本裁决同步
  （recommend 发起语境=领域；落位 refs 由 adopt 请求逐条携带）；课程级不发起不影响对方
  能力形状（course scope 保留为过滤/表达维度）。设计正文见 downloads-flow §7 /
  downloads-ui §4.4（随 REQ-102 W1 晋升）。
- **2026-09-30 全链复审 + 执行序列精简裁决（用户）**：授权查阅并操作 QED-Tracker 后对
  论文链做全链复审，结论=检索/计划/报告三环已由对方 S1~S3 交付，**入口/落盘/入库三环仍断**
  （F1~F8 八条代码事实，正本写入对方 068 壳「链路复审与执行序列精简」节）：8901 论文面只有
  一条即时查询端点、HTTP 侧 `PaperService` 未注入 advisor、CLI 报告落 in-memory SQLite
  进程退出即失、论文直写不进 `qt_books`/`qt_sources`、落盘 domain 硬编码 `math`、
  `qt_books` 无 `kind`/落位列、8901 无 books 枚举端点、论文 `book_id` 无 abbr 来源。
  三项裁决：① 对方序列改**精简三步 A~D**（A 最小出数=ALTER 加列 + books 枚举端点 + 修 CLI
  持久化与 domain 传参；B 探索服务化+书本化一次到位=adopt 建书行并复用 `/books/{id}/fetch`，
  **不再实现短命的 `paper_download` 直写端点**；C=068-4 安全件与文档收口；D=068-6d 存量回填）；
  ② CLI 报告不落库缺陷**并入 A 步修**（不另开 DEFECT）；③ 结论**两侧都落笔**
  （对方 068 壳新节 + 根侧本壳与 REQ-102 壳）。另记前置红线：`qt_books` 为私有表、列集漂移
  会触发对方 `db/schema.py` 的 DROP+CREATE 自愈，加列必须先手工 ALTER 生产库
  （先例=QED-071 三列），ALTER 窗口独立于实现提交。R2 验收判据同批补「枚举响应行必须携带
  `kind` 与落位字段」（8903 分桶唯一依据）；另有四条实现细节待对方回执定夺
  （落位表达形态、论文 `book_id` abbr 约定、评分理由留痕落点、`kind` 值域与教程附属论文的区分）。
- **2026-10-01 设计口径复确认（用户）**：论文链路=「搜索 → 确认 → 下载 → 验证」四步、
  **单独主动探索触发**、经「论文探索」界面进入一轮搜索与确认；「并非和领域书籍一块」经追问
  明确=**只指入口与状态机独立**（不共用领域 6 态/课程 5 态 `exploration_stage`，已是
  downloads-flow §7.2 现状），**存储仍书本化**（`qt_books` kind=paper + 复用书本五层态链），
  领域/课程下的沉淀展示行**保留现状**。故 2026-09-30 裁决①不改判，上述 A~D 序列与
  REQ-102 W2~W4 口径继续有效，无返工。

- **2026-10-01 对方 A 步交付（用户授权根会话在 QED-Tracker 内执行）**：R2 的**枚举面判据已满足**——
  ① `qt_books` 加列已在 `qed_test` 执行（`scripts/qed068_alter_book_kind.py`：备份 →
  ALTER → 复核；22→24 列、26 行不变、两索引齐备、存量 `kind` 全 `book`），**生产 `qed` 库未执行**
  （独立上线窗口；未 ALTER 前该库不得启动新版服务，否则私有表自愈 DROP+CREATE 清空书库）；
  ② 模型同步 `BookKind` + `kind`/`course_id`，`ensure_schema → (0, 0)` 已核验；
  ③ 新增 `GET /api/v1/books`（`kind`/`domain_id`/`course_id` AND 过滤、行含两新列、
  非法 kind 422、无命中空数组），真库只读冒烟：26 行全携带 `kind`/`course_id`、
  `kind=paper` 返回空（B 步 adopt 前属正常）；④ F3 修复（CLI 在 `db_configured` 时传
  `session_factory`，引擎由 `PaperService.close()` 释放；无库仍 in-memory 回落）；
  ⑤ F5 修复（`download`/`download_selection` 增 `domain_id`，CLI `--domain`）。
  对方门禁：`ruff` 全绿、`pytest tests -q` 586 passed（唯一红=存量 `orchestration/evidence`
  断言，与本步无交集）、`test_documentation.py` 9 绿。
  **回执字段名确定**：落位字段=`course_id`（空串=领域级）+ `domain_id`，类别字段=`kind`
  （值域 `book`/`paper`，`blog` 预留未实现）；发现论文判定=`kind=paper`（`qt_books` 无
  `knowledge_id` 列，教程归属仍由 refs 承载）→ 8903 W3 现实现口径**无需改动**。
  四条待裁细节中 #1（落位表达形态）与 #4（`kind` 值域）随 A 步落定，#2（论文 `book_id` abbr）
  与 #3（评分理由留痕落点）留 B 步。**新增事实 F9**：真库唯一领域为 `math-advanced`
  （书行落 `raw/math-advanced/<course>/`），而 `DEFAULT_DOMAIN_ID='math'` → 论文默认桶
  `raw/math/_general/papers/` 与书库领域目录分裂；A 步只让 domain 显式可传、未改默认值，
  裁定（默认取 `qed_domain` 单行／强制显式／对齐 `math-advanced`）留 B 步。
  证据正本=对方 068 壳「A 步交付（2026-10-01）」节。
- **2026-10-01 追加两裁决（同日，用户）**：① **论文没有默认桶**（关闭上一条 F9 待定项）——
  取消论文链路一切 `DEFAULT_DOMAIN_ID` 兜底，`domain_id` 必填且在 `qed_domain` **必须存在**，
  缺失/不存在即拒绝（不落盘、不建书行）；对方 A 步随即落地（⑤′）：`PaperService.download`/
  `download_selection` 的 `domain_id` 改必填关键字参数 + 服务侧 `_require_domain` 校验（可注入
  `domain_exists`，CLI 由 `KnowledgeRepository.get_domain` 装配），CLI `--domain` 默认空串、
  落盘分支缺参在构造服务前返回码 2；对方门禁复跑 `ruff` 全绿 + `pytest tests -q`
  **589 passed**（唯一红仍=存量 `orchestration/evidence`）+ `test_documentation.py` 9 绿。
  根侧承接=downloads-flow §7.1 新增「论文无默认桶」守则、dataset-conventions 发现论文条目、
  api-contracts §③ `recommend`/`adopt` 行的必填与存在性口径，R2 需求条目同步；
  ② **生产 `qed` 库不做本次 ALTER**，等 1.0 整体完成后走**重建**窗口——原「ALTER 未执行前
  不得启动新版服务」的上线红线改判为「本版代码不得指向 `qed` 长期运行，重建窗口重导书目 +
  D 步处置论文存量」，`qed_test`（根侧 8900/8903 走此库）已 ALTER 完毕不受影响；
  对方 `scripts/qed068_alter_book_kind.py` 保留备「增量加列」替代方案。
  正本=对方 068 壳「生产库口径（2026-10-01 用户裁决改判）」段。
- **2026-10-01 对方 B 步设计节点落笔（仅文档，未动码）**：R1/R2/R3 的服务化契约已在对方 068 壳
  「B 步设计节点（2026-10-01 落笔）」节展开（四端点形状与错误码、`paper_recommend`/`paper_adopt`
  任务面、`Application.papers` 同批注入 advisor（F2）+ `domain_exists`（⑤′）、scope 折
  `qt_selections` JSON 零表结构改动、adopt 建 `kind=paper` 书行 + `qt_sources(channel=arxiv)`
  承载 arXiv 身份、查重并联书库、`book_fetch` 目录/命名分叉、CLI 转 HTTP、TDD 先红清单）。
  该节末尾列**五项待裁**（下载承接形态／论文 `book_id` abbr／评分理由留痕落点／`recipe`→arXiv
  分类来源／adopt 是否自动链式下载），根侧建议值已随条注明；用户裁决前对方不进入 B 步实现。
  根侧影响：#5 若裁「不自动下载」，REQ-102 W4 探索弹窗 pick 后需**显式**触发既有书籍取书链
  （`/books/{id}/fetch` 透传面已具备，无新端点）。

- **2026-10-01 五项裁决落定 + 对方 B 步交付（用户「确认接受你的建议，开始执行」）**：
  五项实现细节全部按根侧建议落定——#1 下载承接＝**B 案**（`book_fetch._fetch_paper` 分叉：
  不跑书名多渠道检索，按 `qt_sources(channel=arxiv)` 身份直取，内容校验＝「ID 解析到的即匹配」）；
  #2 论文 `book_id`＝**领域 abbr + 域内 `-bNN`（max+1）**；#3 评分理由**只留 `qt_selections`**
  （书行 `notes` 不进模型判断 → 8903 展示行不显示「为什么推荐」，需要时另立项）；
  #4 `recipe`→arXiv 分类＝新增 `paper_recipes.py` **封闭映射**（`frontier`/`core`），映射不到即 422
  要求显式 `categories`，不静默降级；#5 adopt **不**自动链式下载 → **REQ-102 W4 影响确定**：
  探索弹窗 pick 后须显式触发 `POST /books/{id}/fetch`（透传面已具备，无新端点）。
  **R1 已交付**（recommend 带 `domain_id` 必填 + `recipe`，scope 折 `qt_selections.model.scope`
  零表结构改动，`GET /papers/selections?domain_id=&recipe=` AND 过滤）；**R3 已交付**
  （两配方缺省量 `recipe_defaults`，非法 recipe 422）；**R2 采纳面已交付**（adopt 建 `candidate` 态
  `kind=paper` 行 + `qt_sources(channel=arxiv, ok=False)` 身份留痕、同 arXiv ID 二次采纳
  `duplicated` 不重复建行、下载/校验/验收走书本五层态链、落盘 `raw/<domain>/_general/papers/<year>/
  <arxiv_id>_<sha8>.pdf`、领域缺失即拒）；**R4 仍留 D 步**人工窗口。
  对方 8901 新增四端点（根侧 8900 透传待 REQ-102 W2a/W2b）：`GET /api/v1/papers/selections`、
  `GET /api/v1/papers/selections/{id}`、`POST /api/v1/papers/recommend`（202，任务
  `paper_recommend`）、`POST /api/v1/papers/selections/{id}/adopt`（202，任务 `paper_adopt`）；
  错误面＝422（领域缺失/不存在、recipe 非法、无分类映射、picks 非法或课程不属该领域）、
  404 `SELECTION_NOT_FOUND`、409 `TASK_ALREADY_RUNNING`（dedup：recommend＝domain+recipe+goal，
  adopt＝selection_id），全部校验在提交任务之前（失败不建任务、不盘写）。
  CLI 同步：`papers recommend --domain --recipe`、`papers selections list|show|adopt` 转 8901
  HTTP 客户端；`selections download` 子命令与 `PaperService.download_selection` **退役**
  （论文下载唯一路径＝`books fetch <book_id>`；`papers search --download`/`papers get` 单条手动
  直写通道保留且仍需显式 `--domain`）。
  对方门禁：`ruff check src tests scripts` 全绿、论文链定向 **114 passed**、`pytest tests -q`
  **629 passed / 1 failed / 1 skipped**（唯一红＝存量 `test_orchestration.py::test_evidence_packer_trims…`，
  QED-067-2/3 编排在途，与本步无交集）、`test_documentation.py` 9 绿；对方文档同步
  `README.md` 论文命令段 + `api.md` 新增「⑥ 论文探索」节（含索引四行与 404 错误码）+
  `code-map.md`（`paper_recipes.py` 新行 + 七行改写）。
  正本=对方 068 壳「B 步交付（2026-10-01，本仓执行）」节。
- **2026-10-09 联调通过（以 REQ-102 W5 端到端为据；本行只余 R4 回执未收）**：真机一次跑通全链＝领域级 `sel-20261009T031317Z-8a886b24`（21 候选 / 4 推荐）与课程级 `sel-20261009T033359Z-62ac54a4`（30 候选 / recs 1-10）均 `plan_source=llm`（对方围栏抽取 `llm_json.loads_model_json` 与网关客户端 `trust_env=False` 两处修复同批验证生效）→ adopt 建 `mathadvanced-b19`~`b22`（`b21` 由 8903 探索弹窗发起、落位 `probability`；`b22` 由 API 落位 `partial_differential_equations`）→ 显式 `books fetch` 落盘两 PDF 带 sha256 → `b19` 经 8903 书目详情「验证通过」至 `verified`。R1/R2/R3 与四条实现细节在消费侧（8900 透传 + 8903 两级展示行）全部取得落地证据，全文见 [REQ-102 归档壳](../../../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md)「过程与证据」2026-10-09 两条。**本行仍开放**＝S5（R4 存量回填口径回执：`_general/papers/` 历史论文补登记或声明只读）未收，按本壳关闭条件（R4 可转只读口径后单独关闭）与 W3「R4 待 D 步人工窗口」留对方窗口；负样本留档＝越界 rank 采纳 422 且不落任务不落盘（提交前全量校验成立）。
- **2026-10-24 收口批（整行 `Achieved`；本批零代码、零 DDL、零库内写、零 git）**：上一条所记「本行仍开放＝S5（R4 回执）未收」，其关闭事实**已在对方台账存在九日而根侧未跟读**——QED-Tracker 的 068 归档计划
  [`docs/history/baselines/2026-09-14-paper-pipeline-alignment.md`](../../../../QED-Tracker/docs/history/baselines/2026-09-14-paper-pipeline-alignment.md)
  「D 步裁决：存量不回填（2026-10-15，用户裁决）」节给出 R4 所要求的**二选一答卷**＝按「**声明只读、不再展示**」分支关闭，
  不补登记、不搬迁、不注销；同批免除两笔子账（历史 `qt_selections.downloads` 带尾部版本号 arXiv ID 与 068-3 剥版口径的失配对账、
  F9 老 `raw/math/_general/papers/` 的跨目录搬迁），并显式接受代价＝遗留 PDF 不进书库、不进五层态、不参与采纳查重，
  同一 arXiv ID 再次采纳会重复落盘一份。对方该轮整体已关闭（其 `docs/trackers/completed.md` 的 `QED-068` 行，2026-10-15，
  收尾轮全量 665 passed／1 skipped／1 failed＝在册存量红 BUG-002 编排线，`ruff` 净、`test_documentation.py` 9 绿）。
  **逐 S 核对（判据正本在台账行、写定不改）＝S1~S6 全达成**＝S1 R1~R4 逐条有对方答卷（R1／R3＝B 步交付，R2＝A 步枚举面＋B 步采纳面，
  R4＝D 步裁决「不回填」）且 ARCH-024 壳线 2 条目状态本批刷至终态；S2 R1 落地（`recommend` 带 `domain_id`、scope 折 `qt_selections.model.scope`、
  `GET /papers/selections?domain_id=&recipe=` AND 过滤、不带参数行为兼容）；S3 R2 落地（`adopt` 建 `candidate` 态 `kind=paper` 书行＋
  `qt_sources(channel=arxiv)` 身份留痕、同 arXiv ID 二次采纳 `duplicated`、下载/校验/验收走书本五层态链，2026-10-09 真机 `b19`~`b22` 四行、
  `b19` 至 `verified`）；S4 R3 落地（`recipe` 两配方进任务体、非法值 422、`paper_recipes.py` 封闭映射不到即 422 要求显式 `categories`）；
  S5 R4 存量口径有回执（本条上述，取「声明只读」分支，判据原文的「或」另一支不追）；S6 落地事实源全程在对方台账、根侧零双写（本壳只回填状态）。
  **本批查出的登记缺口三处（全是文档面，同批改定）**＝① 本壳 W3／W4 两枚工作项状态单元格停在 2026-10-01 读数；② ARCH-024 壳线 2 的 REQ-101 条目状态单元格
  仍写「R1／R3 待 B 步、R4 待 D 步」，而该表正是 S1 判据要求的可跟踪面；③ REQ-107 归档壳「上游与遗留指针」节仍写回填口径待对方 D 步窗口。
  **一条须留痕的常设口径（不随本行关闭失效）**＝「**论文没有默认桶**」＝`domain_id` 必填且在 `qed_domain` 必须存在，缺失或不存在即拒绝
  （2026-10-01 追加裁决①），正文已在 downloads-flow §7.1、dataset-conventions 发现论文条目与 api-contracts §③ 三处成文。
  **不占本行判据的相邻尾账（去向写明、不另立轮次，ADR 0021 第 1 条）**＝① 8900 `POST /books/{book_id}/fetch` 返 200 而契约与 8901 为 202，
  是否立 DEFECT 仍待用户裁（REQ-102 关闭时的归属登记，`backend/qed_engine/api/tracker.py:465-468` 通用 `_call`）；② 生产 `qed` 库的 `qt_books`
  加列从未 ALTER，按 2026-10-01 追加裁决②改判为 1.0 整体完成后走**重建窗口**重导书目（D 类人工窗口，不占 agent 行）；③ 对方 `BUG-005`
  （加密拒收口径）经其裁决不阻塞 QED-068 关闭，在其缺陷台账继续滚动。
  **执行身份**＝R1~R4 的答卷由对方台账出具（A／B／C／D 四步逐节在册），其中 A／B 步代码系根会话经用户授权在 QED-Tracker 工作区内代执行、
  身份已在对方 068 壳与本壳逐条披露、对方可复核改判；本批对方工作区**只读**，未改其任何文件。

## 验证与验收

- 判据以「能力需求清单」表验收判据列为准，消费侧（8900/8903）实测取证；
- 对方侧实施验收以对方仓库门禁与回执为据（跨项目协作规范：子项目实施在对方仓库完成）；
- 本壳不要求与对方双写：对方 todo/壳为实施事实源，根侧只回填回执状态。

## 回滚

纯请求文档：关闭本行不影响对方代码；对方若不承接，仅本行按 Rejected/Not Applicable 关闭
并在 ARCH-024 壳线 2 条目留去向。REQ-102 根侧改动独立回滚（按各自提交）。

## 关闭与归档

关闭条件：R1～R3 回执落地且与 REQ-102 W4 联调通过（R4 可转只读口径后单独关闭）；
或用户裁决整行拒绝/移交。关闭时本壳 Retain 归档（存根），REQ-101 行移 completed.md。
- **关闭判定（2026-10-24）＝整行 `Achieved`**：原判据的两个分支同时兑现——R1~R3 回执落地且与 REQ-102 W4/W5 真机联调通过（2026-10-09），
  R4 由对方 2026-10-15 的 D 步裁决按「**声明只读**」分支给出答卷，故判据所说的「可转只读口径后单独关闭」并**不需要另立单独关闭**，整行一并收口。
  用户本批指令原文＝「那么我们就把登记这块补上然后收尾该任务」。**关闭时残余＝零**（S 判据层面）；三笔相邻尾账的去向逐条写在
  「过程与证据」2026-10-24 条末项，均不占本行判据、不另立轮次（ADR 0021 第 1 条）。
- **归档判定 Retain**：R1~R4 逐条需求原文、A~D 三步序列的裁决沿革与两条口径红线（论文无默认桶、生产 `qed` 库走重建窗口而非 ALTER）
  属不可替代证据，按 ADR 0009 移 `docs/history/plans/2026-10/`；出站内链按新深度重算、入站指针同批随步（清单见 2026-10-24 条）。
- **收口门禁**（本批文档写定后串行跑，2026-10-24，QED_env 解释器）＝`pytest tests/contract -q` **89 passed／0 failed** ＋
  根全量 `pytest tests -q` **878 passed／0 failed**（182.93s）＋ `ruff check backend tests scripts` **All checks passed**。
  本批零代码改动、只动 `docs/**`，故全量数值与 REQ-136 收口批的 877／1 failed 相比 **+1 passed、−1 failed**＝同一枚既存红
  （并行模型轮遗留的 `scripts/image-model/.keepalive.pid`，`test_storage_conventions_governance.py:164`）已由并行窗口清除，
  非本批引入亦非本批修复。链接守护（`test_local_markdown_links_resolve`）与计划治理守护（G3／G7／index 只做导航）随该 89 passed 全绿。
