# 普通任务轮滚动记录（零散缺陷·小修·治理与规范化批次承载）（ordinary-tasks-round）

状态：In Progress
任务类型：B
最后更新：2026-09-30
关联 ADR：登记方式沿用 [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳；
W2 治理批次新增 [ADR 0020](../adr/0020-task-closure-cadence-and-thin-registration.md)；
W3 治理批次新增 [ADR 0021](../adr/0021-round-proliferation-cap-and-per-row-doc-anchor.md)
关联设计：[admin-console.md](../design/admin-console.md)（W1 落点：控制台破坏性操作确认框文案契约）、
[service-hosting.md](../design/service-hosting.md)（启停单元与状态判定口径）
关联 Tracker：docs/trackers/todo.md（ARCH-035 任务行，一任务一行一壳）
归档判定：Retain（滚动记录，轮次收口时按当时里程碑归档 history/plans/<year-month>/）

> 本壳是普通任务轮唯一滚动记录，也是台账的**默认承载轮**。承载：可复现缺陷（DEFECT-xxx）、
> `design/` 小修与文案修正（BUGFIX-xxx 台账承接）、单点小功能、经用户裁决挂入的**治理小批次**
> （ADR + `standards/` 单节修订 + 契约守护增量 + 台账梳理，判例 W2/W3）、**规范化批次**
> （落点/口径收口类，判例 W9），以及**已关闭轮次的残留支线**（判例 W4~W6、W7）。
> 每个条目在本壳登记表占一行，实施仍走 TDD 与既有门禁；跨模块或需要设计评审的工作按
> `AGENTS.md` 变更分级另立任务与壳，不进本轮（ADR 0021 第 1 条：轮次非必要不增设）。

## 目标与成功标准

**背景**（用户裁决 2026-09-29）：零散小修此前散挂在各主线轮次或仅留 design-bugfix-log，缺一个
可登记的收口位置。本轮作为普通任务的承载轮，使小改动也有台账与收口证据可查。

**目标**：零散缺陷/小修「有条目、有回归测试、有收口证据」，且不污染主线轮次的范围边界。

**成功标准**：正本在台账行 [todo.md](../trackers/todo.md)「普通任务轮（ARCH-035）」节的
`成功标准` 列（S1 每条工作在承载壳登记表有条目行／S2 代码修复有回归测试先红后绿并同步设计／
S3 关闭写 completed.md 不留尾行／S4 滚动存续由「（待登记）」占位行声明），本壳不复制判据条目
（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)）。各判据的验收手段见
「验证与验收」节，执行进展与取证见「过程与证据」节。

## 范围与非目标

- 范围：根仓库（8900 后端 / 8903 前端 / docs）内的零散缺陷与小修；**治理小批次**（ADR 登记、
  `standards/` 单节修订、契约守护增量、台账梳理）——2026-09-29 用户裁决扩入本轮承载（W2 判例），
  仍按变更分级先落裁决与计划再动文档；**规范化批次**与**已关闭轮次的残留支线**——2026-09-30 用户
  裁决扩入（W3~W9 判例，依据 [ADR 0021](../adr/0021-round-proliferation-cap-and-per-row-doc-anchor.md)
  第 1/2/5 条：轮次非必要不增设、关闭轮不留节、归并不删壳）；Axiom-Flow / QED-Tracker 侧问题按
  跨项目协作规范另发请求，不进本轮。
- 非目标：不承载架构/数据库契约的结构性重写、不承载跨模块重构；不为「凑数」接纳主线支线已有条目；
  **不复制被并入轮次的工作项正文**（承载关系条目只登记归属，执行与取证留在该轮自己的壳，W9）。

## 前置条件

- 条目具备可复现现象或明确的设计偏差描述（无复现路径的先取证再登记）。
- 前端条目需 8903 dist 可重建（`npm run build`）以便浏览器实测；后端条目用 QED_env 解释器跑门禁。

## 工作项

| 条目 | 类别 | 内容（根因一句话 + 落点） | 状态与证据 |
| --- | --- | --- | --- |
| W1 / DEFECT-006 | 缺陷 | 控制台受控确认框正文三元链只特判 `op==='stop'` 与 `name==='config'`，`op==='start'` 落入兜底分支，导致离线服务点「启动」时弹窗正文显示「重启会中断当前运行中的任务。」（`web-ui/src/pages/Console.tsx` 确认框块） | 已修复（2026-09-29）：补 `start` 专属分支文案；回归用例两枚（启动分支 / 重启分支）先红后绿；设计正文晋升 admin-console.md §3.1「破坏性操作确认框」段；台账条目 BUGFIX-023。收口门禁（2026-09-29，QED_env 解释器）：全量 pytest 612 passed + 契约 68 passed + ruff 全绿（首跑的 database-design DDL 并行红复跑时已消除）；前端 vitest 356 passed + tsc -b 零错 + build 过；浏览器实测启动框正文逐字为启动语义。完整证据见 completed.md DEFECT-006 行 |
| W2 / 治理批次（任务收口纪律与 ARCH-028 梳理） | 治理（ADR + standards + 契约守护 + 台账） | 现象＝todo 行既沉积过程叙述又不主动收口：判例 ARCH-028 证据列 985 字符（W7~W12 全过程抄进 todo，壳内已有同一内容），DEFECT-005 状态列自造「已实施」（不在状态枚举）且代码与回归用例已落地却无人关行；根因＝ADR 0016 薄登记与「达成即收」两条**无机械防线**（`test_tracker_governance.py` 状态镜像只覆盖带 plans 链接的行，长度无上限）。落点＝新增 [ADR 0020](../adr/0020-task-closure-cadence-and-thin-registration.md)（部分补充 0016）+ `standards/task-lifecycle.md`「收口节拍与薄登记上限」节 + todo 规则节 + `tests/contract/test_tracker_governance.py`（G1 状态枚举全行、G2 证据列上限）与 `test_plan_governance.py`（G3 达成即收）+ ARCH-028 台账重构 | **已收口（2026-09-29）**：执行顺序按 TDD 全链走通——① 守护先红：G1 红在 DEFECT-005 状态列自造「已实施」（不在进行中态枚举）、G2 红在 ARCH-028 证据列 985 字符与 DEFECT-005 474 字符（阈值 400），G3 探测器以「全达成／混合／占位／含残余」四组合成壳自证有效后对 live 壳全绿；② [ADR 0020](../adr/0020-task-closure-cadence-and-thin-registration.md) Accepted 立档并登记 index（下一个可用编号→0021；原裁决号 0019 已被并行会话未提交的存储 ADR 占用，按编号全局唯一规则经用户裁决改号），与 ADR 0016 双向正文互链（0016 状态与决定不变）；③ 标准与入口同步：task-lifecycle.md 新增「收口节拍与薄登记上限」节（G1~G4 判据表）+ 状态导航枚举封闭 + evidence 列 400 上限与落点口径 + 长期线形态、todo 规则节、development.md 六步流程补一行、qed-intake/qed-plan/qed-closeout 薄触发；④ 台账重构转绿：ARCH-028 证据列瘦身至 276 字符并保留 W9 水位门 + W11 熔断（关闭不再等真崩）、W6/S3 掉线根因定谳观察窗整批移入新建长期线 REQ-100（壳 2026-09-29-local-model-debug-optimization-longterm.md，含「长期滚动：无终态」声明）、DEFECT-005 关闭写入 completed.md（Achieved）、project-status.md 随步。收口门禁（2026-09-29，QED_env 解释器）：根全量 pytest **547 passed 全绿** + ruff **All checks passed**；契约 75 passed + 2 failed——两红为 `test_storage_conventions_governance` 对盘上 `scripts/diag_watch_b05*.log` 与 `backups/` 的实况报红，归并行 ARCH-036 轮 W3~W6 清理面（其 W2 代码面已落地、`test_log_viewer` 两枚已转绿），本批次未触该面，归因不修 |
| W3 / 治理批次（轮次不增设与 todo 行文档锚） | 治理（ADR + standards + 契约守护 + 台账） | 现象＝台账「只建不收」的第二种形态与「无去处」的叙述：① 存储链路规范化轮（ARCH-032）已于 2026-09-26 关闭并把壳 Retain 归档 `history/plans/2026-09/`，但 todo 保留「存储链路规范化轮」整节，其下 REQ-091 / REQ-092 / REQ-096 三行挂在不存在的轮名上且**无任何文档链接**；② 全表共 8 行任务列无文档锚（REQ-006 / REQ-031 / REQ-096 / REQ-091 / REQ-092 / DEFECT-007 / REQ-050 / OPS-001，G5 先红实录），其勘察证据、修向与边界全部写在 todo 单元格内——G2 只限制长度，不要求给出落点，于是「不许写长」退化成「写短但仍写在 todo」；③ 2026-09-24 立 ARCH-032、2026-09-29 同日立 ARCH-035 与 ARCH-036，三族同为「规范化与零散收口」工作却各起一个主线轮节。根因＝轮次归属与文档锚两维零机械防线。落点＝新增 [ADR 0021](../adr/0021-round-proliferation-cap-and-per-row-doc-anchor.md)（轮次非必要不增设 / 关闭轮不留节 / 一行一文档锚 / 锚与镜像分工 / 归并不删壳）+ `standards/task-lifecycle.md`「收口节拍、薄登记上限与承载归属」表补 G5/G6 两行与三则守则、台账结构节补文档锚与分节标题规则 + `tests/contract/test_tracker_governance.py` 两枚守护 + 本壳承载面扩展 + 台账重构 | 已收口（2026-09-30）：执行顺序按 TDD 全链走通——① 守护先红取证：G5 红在上面 8 行无锚、G6 红在 ARCH-032 残留节；② [ADR 0021](../adr/0021-round-proliferation-cap-and-per-row-doc-anchor.md) Accepted 立档并登记 index（下一个可用编号→0022），0016 / 0020 各补反向正文关联（状态与决定不变）；③ 文档同步：task-lifecycle.md 节更名「收口节拍、薄登记上限与承载归属」并加 G5/G6 行 + 「分节标题与承载」规则、development.md 六步流程补守则一行、qed-intake / qed-plan / qed-closeout 三技能薄触发随步、todo 规则节加两条；④ 台账重构转绿：撤销 ARCH-032 节，REQ-091/092/096 瘦身并改行内锚挂本壳 W4~W6，ARCH-036 行按裁决降为**支线**并入本轮节（其壳保留执行面、正文不复制，见 W9），DEFECT-007 改行内锚，OPS-001 / REQ-031 入本壳 W7/W8 待开始条目，REQ-050 补文档治理锚，REQ-006 按「达成即收」关闭移 completed.md（Partial：管理后台面已随 ARCH-011 落地＝达成项，学习界面线移交 ARCH-027-M1 壳），roadmap 两行随之改指 ARCH-027 / ARCH-027-M1。收口门禁（2026-09-30，QED_env 解释器，串行）：契约 **79 passed 全绿** + 根全量 pytest **547 passed 全绿** + ruff **All checks passed**（W2 批遗留的 `test_storage_conventions_governance` 两红已随 ARCH-036 清理面消除，本批无需归因） |
| W4 / REQ-091 探索会话持久化 | 待开始条目（原 ARCH-032 残留支线） | `backend/qed_engine/services/explore_sessions.py:40` 明示纯内存态：服务重启即丢 report / steps / session_id，前端只能整轮重发；课程侧探索失败 error 无列落库（`shared_tables.py:306-309` 领域侧有 explore_pending，课程侧不对称）。修向＝会话态落库或可恢复快照 + 课程失败列补齐，属根仓库代码改动 | 待开始（排期待定；2026-09-24 随 ARCH-032 勘察登记，2026-09-30 按 ADR 0021 并入本轮承载） |
| W5 / REQ-092 账本保留期策略 | 待开始条目（原 ARCH-032 残留支线） | `qed_llm_calls`（MEDIUMTEXT prompt/response 只增）、`qt_tasks` / `qt_selections` / `af_parse_jobs` 均无清理或轮转规则（ARCH-032 勘察：全仓无 DELETE / 保留期代码）。需成文保留期与归档口径，平衡审计线索与磁盘/库容量；涉及跨项目表，策略先根侧成文再向对方发请求 | 待开始（排期待定；同上并入） |
| W6 / REQ-096 存储对账 doctor（前瞻） | 待开始条目（原 ARCH-032 残留支线） | 库↔盘双向只读核验：幻影记录（DB 有账盘无文件）、孤儿文件（盘有产物库无账）、manifest / `source_sha256` 哈希失配、file_path 三处（qt_books / af_books / book.json）漂移检测。ARCH-032 勘察结论＝双写面**没有任何对账机制**，漂移无人可发现。落点建议 8900 只读端点或 CLI，实施另立设计 | 待开始（2026-09-24 登记时只登记不进设计；原登记撞号 REQ-090→REQ-096，REQ-090 已由 learning/ 退役任务关闭，见 completed.md 与 ADR 0015；2026-09-30 并入本轮） |
| W7 / OPS-001 服务域 stop 对外部实例失效 | 待开始条目（缺陷，2026-09-22 长期审核改类） | 外部启动的 8901 被 `POST /services/tracker/stop` 时记录 pid=null，杀不到真进程（stop 返回 stopping 但端口仍监听），需直杀监听 PID 后由服务域 start 重新纳管。两次复现＝2026-08-26 REQ-061 验证轮 + Phase A 清库轮。修向＝stop 前先做端口探测补全 pid 记录（8900 控制域代码改动） | 待开始（排期待定） |
| W8 / REQ-031 使用手册完善 | 待开始条目（内容细化） | 当前手册（`web-ui/src/help/sections.ts` 的 HELP_SECTIONS 迁移六节）内容粗略，待学习中心各功能稳定后逐界面细化：操作截图、分步图文、FAQ 扩充、五阶段流程配图。2026-08-16 用户标注为低优先级、不阻塞前端重构主轮 | 待开始（前置＝学习中心界面稳定） |
| W9 / ARCH-036 承载关系（运行时产物与备份面规范化） | 规范化批次（其壳保留执行） | 按 ADR 0021 第 5 条「归并不删壳」承载：该轮的执行记录、工作项与取证**继续留在其自己的壳** [运行时产物与备份面规范化](2026-09-29-runtime-artifact-placement-round.md)（W1 治理落档 ADR 0019 + 标准补节 + 契约守护、W2 与 DEFECT-007 日志路径缺陷 TDD、W3~W5 清理、W6 文档同步、W7 日志轮转待裁决），本行不复制其正文。todo 侧变化＝ARCH-036 行类别由 主线 降为 支线 并移入普通任务轮节（镜像行与壳状态一致性不变），DEFECT-007 行改用行内链接取锚 | 待承接（随该壳自身 W2~W6 推进；本行只表达归属与承载关系，收口由该壳按其关闭条件执行） |
| W10 / 治理批次（任务链路口径澄清） | 治理（ADR + standards + AGENTS + 技能 + 台账措辞） | 现象＝链路梳理（2026-09-30，范围＝task-lifecycle + adr-governance + ADR 0016/0020/0021 + 六枚守护 + 四技能 + development/AGENTS）查出「规则互相打脸」四类：① 「B/C 类必须建独立计划」与「缺陷不单独建计划」对同一工作相反；② 移交型关闭取值无口径（REQ-098 记 Achieved、REQ-006 记 Partial）；③ 滚动壳的「目标与成功标准」被追加导致任务越滚越大（0020 管该收不收、0021 管该挂哪儿，无人管「一个任务能长多大」）；④ 改判他轮类别/归属节无准入（本批 W3 的 ARCH-036 归并靠会话裁决补位）。落点＝新增 [ADR 0022](../adr/0022-task-chain-clarifications.md) 七条决定 + `standards/task-lifecycle.md`（准入例外·两通道判据·关闭取值·成功标准冻结·归并须裁决·证据待提交）+ `doc-governance.md`（多壳任务改按子项 ID 一行一壳）+ 根 `AGENTS.md`（技能正本以 `.qoder/skills/` 为准 + 分通道/改判准入两条）+ `development.md` 六步口径行 + `qed-intake/plan/closeout` 三技能 + todo 规则节（ID 前缀清单注明非闭集） | 已收口（2026-09-30；门禁＝契约 79 passed + 全量 547 passed + ruff All checks passed，本批纯文档无代码改动）：批一措辞整改（A1 缺陷列·A2 多壳绑定·C3 标准示例去过程化·C4 重复行合并·C5 前缀非闭集·D4 六步表补 `qed-frontend-check`）已落；ADR 0022 Accepted 立档并登记 index（下一个可用编号→0023），0016/0020/0021 各补反向正文关联（状态与决定不变）。**用户裁决三条**：D1＝关闭结果按「本任务成功标准是否全达成」取值，并附「标准确认后不得随意改动、不得让一个 todo 任务承载越来越多东西」→ 落成 ADR 0022 决定 4 成功标准冻结；D3＝技能正本为 `.qoder/skills/`，其他 agent 侧副本不由本仓库维护；D5＝关闭证据允许「待提交」占位。**未纳入本批**：批三守护增量（任务列长度、G3 状态列分列、G6 覆盖 ####、G5 锚点条目校验、归并承载关系校验）与 C1（规则四处重述的收敛，动 standards 与 todo 规则节分工）——待用户另批 |
| W11 / C1 治理链路叙述收敛（唯一正文 + 指针化） | 治理（standards 边界声明 + 台账规则节与指南/入口/技能去重） | 现象＝同一条登记规则在四处各有一份**完整正文**（W10 只澄清语义、未做收敛，本条为承接的正文归一）：① `standards/task-lifecycle.md` 强制规则各节；② `docs/trackers/todo.md`「规则」节 10 条 bullets 全量复述①（含 ID 前缀清单、状态枚举、400 上限、达成即收、一行一锚、轮次不增设、镜像规则）；③ `docs/guides/development.md` 开发流程节三条 ADR 复述 bullets（0020/0021/0022 逐条）+ 分级判据复述；④ 根 `AGENTS.md`「变更分级与边界」两条与①重复的 bullets，加上四枚 `qed-*` 技能各自复述收口细则。附带三处断链/混杂：task-lifecycle:97 把 ID 前缀清单指回 todo 规则节（正文其实在本标准 ID 行，事实源指错）；`qed-closeout` 让 agent 跑「『验证门禁』节全部命令」而 development.md 无该节名（实名「门禁与证据」/「环境速查与命令矩阵」）；development.md 同文档内命令矩阵与「门禁与证据」代码块重复同一批命令。落点（分工表见 task-lifecycle「目的与边界」新增节）＝**登记与收口细则唯一正文在 task-lifecycle**，todo「规则」节改为「列 → 判据出处」指针表、development.md 只留六步与门禁命令、AGENTS.md 只留变更分级判据表、技能只留执行步骤与指针；删重述前先回填 todo 独有事实（阻塞声明、无锚即落点未定、跨项目行标注指针） | 已收口（2026-09-30；用户裁决＝批三守护增量不做、只做本条，「将文本流程归一（只有一个准确叙述没有其他混杂）且集成（在一个或少数几个文档）」）：①②③④ 四处正文全部收敛——task-lifecycle「目的与边界」分工表立为唯一
正文并回填 todo 独有事实（阻塞声明、无锚即落点未定、跨项目行标注指针）；todo「规则」节改「列 → 判据
出处」指针表；development.md 删三条 ADR 复述 bullets 与「门禁与证据」重复命令块（命令只在「环境速查
与命令矩阵」维护）、证据格式改指壳的过程与证据节；AGENTS.md 删两条重复 bullets 改指针 + 技能清单口径
与「技能正本」对齐；`qed-intake` / `qed-plan` / `qed-implement` / `qed-closeout` 四技能薄化为步骤 +
指针，`qed-closeout` 的断链指针改为「门禁与证据」+「环境速查与命令矩阵」两节名；附带 doc-governance
「任务与文档绑定」与 cross-project-collaboration 登记格式随新列改判。取证见「过程与证据」节 |
| W12 / 治理批次（台账行承载任务描述与固定成功标准） | 治理（ADR + standards + 契约守护 + 全量迁移 + 技能/指南去重） | 现象＝行形态与用户设计意图不符：todo 行既写「做什么」又写执行过程与证据，验收判据散在壳的「目标与成功标准」节且被逐轮追加（W10 决定 4 冻了壳、没冻行），导致「改一次进展改一次 todo、plans 少记过程、过程散布多点」。用户裁决（2026-09-30）＝**最关键的是任务描述（到底做什么）与成功标准（固定验收标准，怎么算完成）**，细节证据/下一条件写入 plans/设计文档只需指引到位。落点＝新增 [ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md) 七条决定（行 6 列且锚内嵌／成功标准正本在行且条目化 S1…／过程证据落壳 `## 过程与证据`／壳只留目标陈述 + 指针／G2 判据对象改判为该列并禁日期与进展词／新增 G7 守护带日期戳的过程节／标准冻结对象移到行）+ `standards/task-lifecycle.md` 全文随步（台账结构两列定义与分工、成功标准列格式、证据落点、G1~G7 表、关闭判定逐条对照）+ 0020/0021/0022 各补「被后续结构改判」关联（状态与决定不变）+ `tests/contract/`（G2 改造 `test_todo_success_criteria_column_is_fixed_and_bounded`、G7 `test_active_plans_carry_a_dated_process_log_section`、表头与 `PLAN_LINK` 随 6 列）+ todo 24 行整批迁移 + 14 个壳的判据表改指针并补带日期戳的「过程与证据」节 + W11 的③④去重 | 已收口（2026-09-30）：执行顺序按 TDD 全链走通——① 守护先红实录＝G2 改造后红在旧 6 列表头与各行证据内容含日期/进展词（探测器 `test_success_criteria_progress_detector_flags_narrative_not_criteria` 以「固定判据／含进展词／无 S 编号／超上限」四组合成样本自证），G7 `test_active_plans_carry_a_dated_process_log_section` 红在 14 个在途壳无 `## 过程与证据` 节（探测器 `test_process_log_detector_flags_dated_and_empty_sections` 自证）；② [ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md) Accepted 立档并登记 index（下一个可用编号→0024），0016/0020/0021/0022 各补「被后续结构改判」关联（决定与状态不变）；③ `standards/task-lifecycle.md` 全文随步（6 列结构、任务描述与成功标准两列分工、成功标准列格式、证据落点、G1~G7 表、关闭判定逐条对照 S 条目、doc-governance/cross-project 指针）；④ todo 24 行整批迁移 + 15 壳判据表改指针并补带日期戳的过程与证据节 + W11 的③④去重（development.md/AGENTS.md/四技能）。收口门禁（2026-09-30，QED_env 解释器，串行）：契约 **82 passed 全绿** + 根全量 pytest **641 passed 全绿** + ruff **All checks passed**（本批纯文档 + 契约测试，无业务代码改动；641 含并行窗口在途 learn/星图测试，其提交留对方窗口） |
| （待登记） | — | 后续零散缺陷、`design/` 小修、治理小批次、规范化批次与已关闭轮次残留支线随到随登（本行为本轮滚动存续声明；全条目收口且无后续承载时按 ADR 0020 关闭本壳） | — |

## 过程与证据（滚动）

> 本节是本轮各条目的执行与取证正本（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)
> 决定 5）：每条带日期戳，记录「做了什么、证据在哪、下一步条件」。台账行只写任务描述与固定
> 成功标准，进展不写回 todo。登记表「状态与证据」列的历史叙述保留作承证，不重复抄录。

| 日期 | 条目 | 过程与证据 |
| --- | --- | --- |
| 2026-09-29 | W1 / DEFECT-006 | 控制台启动确认框补 `start` 分支文案；两枚回归用例先红后绿；门禁与浏览器实测证据见该缺陷在 completed.md 的关闭行与本表 W1 行。 |
| 2026-09-29 | W2 / ADR 0020 批次 | 守护先红（G1 状态枚举、G2 证据列 985/474 字符、G3 合成壳四组合自证）→ ADR 0020 Accepted 立档 → task-lifecycle/development/三技能同步 → 台账重构转绿（ARCH-028 证据列 276 字符、W6/S3 观察窗移 REQ-100 长期线、DEFECT-005 关闭）。 |
| 2026-09-30 | W3 / ADR 0021 批次 | G5 红在 8 行无锚、G6 红在 ARCH-032 残留节 → ADR 0021 立档 → 标准补 G5/G6 与分节标题规则 → 撤 ARCH-032 节、REQ-091/092/096 挂本壳 W4~W6、ARCH-036 降支线、REQ-006 达成即收。串行门禁：契约 79 passed + 全量 547 passed + ruff 全绿。 |
| 2026-09-30 | W10 / ADR 0022 批次 | 链路梳理查出四类口径打脸 → 批一措辞整改（A1/A2/C3/C4/C5/D4）→ ADR 0022 Accepted 立档 + 三条用户裁决（关闭取值、技能正本 `.qoder/skills/`、证据允许「待提交」）落文档；批三守护增量与 C1 按裁决另批（C1 即 W11）。 |
| 2026-09-30 | W11 / C1 叙述收敛（四处正文归一，已收口） | ① `standards/task-lifecycle.md`「目的与边界」新增分工表：登记与收口细则唯一正文在本标准，todo/development/AGENTS/技能各自只留指针，并声明「同一规则正文出现在两处即视为漂移」；② `docs/trackers/todo.md`「规则」节 10 条 bullets 改「列 → 判据出处」指针表，删重述前回填 todo 独有事实（阻塞声明、无锚即落点未定、跨项目行标注指针）；③ `docs/guides/development.md` 删三条 ADR 复述 bullets（改一条指针 + 五份 ADR 链接）与「门禁与证据」内重复的命令块（命令只留「环境速查与命令矩阵」），证据格式改指壳的 `## 过程与证据` 节；④ 根 `AGENTS.md` 删「缺陷与小修分通道」「改判他轮归属须用户裁决」两条重复 bullets 改指针、技能清单口径与「技能正本＝`.qoder/skills/`」对齐；四枚 `qed-*` 技能重写为步骤 + 指针（`qed-closeout` 断链指针「验证门禁」→「门禁与证据」+「环境速查与命令矩阵」；`qed-implement` 补「每批取证写壳、不写回 todo」）；附带 `doc-governance.md`「任务与文档绑定」指针化（其独有事实「长期行载体不限于 plans 壳」先回填 task-lifecycle 再删）、`cross-project-collaboration.md` 登记格式与取证落点随新列改判、`project-status.md` 补本批主线行。 |
| 2026-09-30 | W12 / ADR 0023 批次（本轮重设计，已收口） | 用户裁决「最关键的是任务描述与成功标准，细节证据/下一条件写入 plans/设计文档」→ 守护先红：G2 改造为成功标准列判据（列名、条目化 `S1`、≤400、禁日期与进展词；配探测器合成样本自证），新增 G7 要求每个在途壳有带日期戳的 `## 过程与证据` 节（红在 14 个壳缺节；探测器同上）；ADR 0023 Accepted 立档并登记 index（下一个可用编号→0024），0016/0020/0021/0022 各补「被后续结构改判」关联（决定与状态不变）；task-lifecycle 全文随步；todo 24 行整批迁移至新 6 列（`ID｜类别｜优先级｜状态｜任务描述｜成功标准`）并把各壳判据表入行；14 个壳（含本壳与 ARCH-036、M5 星图两枚在途壳）判据表改指针 + 补过程与证据节，`最后更新` 随步。跨项目回执守护 `test_todo_request_rows_track_receipt_progress` 的判据对象从证据列改查承载壳（现况仅 REQ-099 一行请求，非空集）。收口门禁（串行，QED_env 解释器）：**契约 82 passed + 根全量 641 passed + ruff All checks passed**。 |

## 验证与验收

- 各判据的验收手段（判据正文见 todo 行 ARCH-035 `成功标准` 列）：S1＝登记表行数与条目一致；
  S2＝对应测试文件用例 + `design/` 文档段落；S3＝completed.md 行 + 契约测试绿；S4＝占位行存在性。
- 前端条目：`npx vitest run` + `npx tsc -b` + `npm run build`，并在真实浏览器（8903 dist）复核
  修复路径；in-app 视口限制以结构断言为证。
- 治理条目：新增契约守护须**先红后绿**（红态在被守护的真实漂移样本上证明有效，再修台账转绿）；
  standards 实质规则变更先落 ADR 再改标准正文与契约常量。
- 文档：受影响 `design/` 段落同步 + `docs/plans/design-bugfix-log.md` 登记。
- 收口：`tests/contract/` 全绿（计划元数据与 todo 镜像守护）+ 根全量 pytest + ruff。

## 回滚

- 单条工作项独立提交，回滚即还原对应文件（本轮无数据迁移、无配置变更、无对外契约改动）。
- 文案类改动回滚不影响接口行为（端点与状态机未变）。
- 治理批次（W2）回滚＝还原 ADR/standards/契约测试/台账四类文件；已关闭任务行需同时回到 todo。

## 关闭与归档

- 单条工作项完成即从登记表标为已修复，并在 completed.md 落该缺陷行（关闭结果 Achieved）。
- 轮次本身滚动存续；当用户发令收口时按归档判定 Retain 移 `history/plans/<year-month>/`，
  ARCH-035 主线行随之移入 completed.md。
