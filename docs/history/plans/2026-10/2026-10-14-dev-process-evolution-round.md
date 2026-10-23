# 开发流程演进轮（schema 重建档位·demo 门·范围锁死）（dev-process-evolution-round）

状态：Completed
任务类型：B
最后更新：2026-10-18
关联 ADR：`../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md`（本轮三项裁决的决策记录）、`../../../adr/0019-runtime-artifact-placement-and-no-long-term-backups.md`（备份临时制、验收即清）、`../../../adr/0023-todo-row-carries-scope-and-criteria.md`（判据正本在行、过程落壳）、`../../../adr/0021-round-proliferation-cap-and-per-row-doc-anchor.md`（demo 门不新设轮次）
关联设计：`../../../architecture/database-design.md`（「迁移」节＝重建档位唯一事实源，W2 待落笔）、`../../../standards/task-lifecycle.md`（「计划准入与分拆」节＝demo 门正文，W3 待落笔）、`../../../standards/code-standards.md`（「允许与禁止清单」＝范围锁死禁止项，W4 待落笔）、`../../../guides/development.md`（六步表第 4 步人类决策点，W3 待落笔）
关联 Tracker：docs/trackers/todo.md（REQ-112 登记，普通任务轮节；ARCH-035 壳登记表 W21 条目指向本壳）
归档判定：Retain（承载三项流程裁决的执行记录与移交单，收口后归档 history/plans/）

## 目标与成功标准

**目标**：把 2026-10-14 用户三项流程裁决（① 1.0 前 schema 演进按数据可再生性分档豁免
ALTER 仪式、备份临时制验收即清；② 大任务一壳一门 demo 先行、人工验收后再扩展；③ 范围
锁死＝文档未提及的功能不加，第一性原理熔进 demo 门不独立成条）落进标准正文、AGENTS.md
与技能指针，使 1.0 前迭代提速且数据保护判据与真实风险对齐。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-112` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：
1. ADR 0024 立档 + adr/index 登记 + 本壳与 todo 行（W1，本轮立项批已完成）。
2. database-design.md「迁移」节增「1.0 前 schema 重建档位」条（W2）。
3. task-lifecycle「计划准入与分拆」节增 demo 门条 + development.md 六步表第 4 步人类决策点
   补「demo 验收」+ AGENTS.md 决策机制行补第一性原理半句（W3）。
4. code-standards「允许与禁止清单」增范围锁死禁止项（W4）。
5. 技能指针同步：根 `qed-intake` / `qed-plan` / `qed-implement` 各加一句；Tracker
   `qed-db-alter-redline-window` 头部档位指针以**移交单**登记（其正本归 Tracker 窗口，
   根侧不改其技能文件）（W5）。
6. 全量门禁 + 既有守护不回归（W6）。

**非目标**：不新增机械守护（ADR 0024 明文）；不改任何代码与端点；不废除 db-alter 四步
窗口（适用面收窄为备份确认档 + 生产窗口）；不动生产库红线与 REQ-093 裁决；不代替
Tracker 窗口改其技能与私有表文档（只出移交单）；demo 门不追溯改造已收口或在飞的既有壳
（自本轮收口后新建/新批的大任务壳起适用）。

## 前置条件

1. 用户三项裁决（2026-10-14，会话内多选确认）：提案 1「基本没有问题，但是备份要固定删，
   完成之后确认后要全部清理完毕不要残留，测试库不需要备份、LLM 调用账不需要备份」；
   提案 2「确认默认一壳一门、壳过大按 S 条目分里程碑」；提案 3「确认可以接受『不独立成条、
   熔进 demo 门 + AGENTS.md 半句』」。
2. 变更分级＝「standards/ 实质规则变更 → 先立 ADR」：ADR 0024 已立（W1），正文落笔待用户
   发令「开始执行」（裁决先落笔纪律，development.md）。
3. 档位归属的事实盘点（W2 落笔时核定）：`qed_test` 全库、`qed_llm_calls` 入自由重建档；
   `af_*` 解析产物登记、`qt_*` 下载登记入备份确认档；`qed` 生产库不适用（红线）。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 裁决登记 + ADR 0024 立档 + adr/index 登记 + 本壳 + todo REQ-112 行 + ARCH-035 壳 W21 登记条目 | 已完成（2026-10-14，同批验收） |
| W2 | database-design.md「迁移」节增「1.0 前 schema 重建档位」条：两档判据 + 表族档位归属清单 + 备份临时制（引 ADR 0019 决定 4，验收即清不留残留）+ 生产红线指针 + 1.0 宣布后另立 ADR 收口本条 | 已完成（2026-10-18 用户人工验收通过） |
| W3 | task-lifecycle「计划准入与分拆」节增 demo 门条（一壳一门默认、壳过大按 S 条目分里程碑、核心价值最短验证路径界定范围、到门暂停待人工验收、结论落壳过程与证据节）+ development.md 六步表第 4 步人类决策点补「demo 验收」+ AGENTS.md 决策机制行补「方向取舍以核心价值为准绳（第一性原理，非强制）」 | 已完成（2026-10-18 用户人工验收通过） |
| W4 | code-standards「允许与禁止清单」禁止列增「实现超出 design/ 文档与已批计划壳范围的功能（缺失功能先回文档面补设计再裁决）」 | 已完成（2026-10-18 用户人工验收通过） |
| W5 | 技能指针同步：根 qed-intake（立项时判 demo 门适用性）、qed-plan（壳首工作项＝demo 门）、qed-implement（实现前对照设计范围、到门暂停）各加一句；Tracker db-alter 技能移交单登记（头部加档位指针 + 适用面收窄声明），移交对方窗口执行 | 已完成（2026-10-18 用户人工验收通过） |
| W6 | 全量门禁：pytest tests/contract + pytest tests + ruff 全绿，G1~G7 与 storage-conventions 守护不回归；链接门禁绿 | 已完成（2026-10-18 用户人工验收通过） |

## 过程与证据

- 2026-10-14：用户会话内提出三条流程优化并发令探索评估（允许推翻）；agent 评估后推翻两处
  （提案 1 判据由版本号改数据可再生性分档；提案 3 不独立成条、熔进 demo 门），用户同日
  拍板三项裁决（原文见「前置条件」1），并追加两处修正：备份临时制（用后确认即全清不留
  残留）、测试库与 LLM 调用账免备份。
- 2026-10-14：W1 执行完毕——ADR 0024 立档（`docs/adr/0024-preschema-rebuild-tiers-and-demo-gate.md`，
  含三项决定、两条排除方案、档位误判缓解）；adr/index.md 登记 0024 行、下一个可用编号改
  0025、最后更新改 2026-10-14（Python 字面替换三处锚点各 1 命中，CRLF 保持）；本壳建立；
  todo.md REQ-112 行与普通任务轮节登记、ARCH-035 壳登记表 W21 条目同批（见该壳）。
  标准正文（W2~W4）与技能指针（W5）按「裁决先落笔」纪律待用户发令「开始执行」。
- 2026-10-15：W1 登记批实际落盘并验证——`tmp/req112_register.py` 四处字面替换（本壳 H1 补 slug `（dev-process-evolution-round）`、todo REQ-112 行插普通任务轮节末、ARCH-035 壳登记表 W21 承载关系条目、plans/index 普通任务轮节登记）各 1 命中、LF 保持、成功标准列 374 字符（≤400 上限）；契约门禁 `pytest tests/contract` **82 passed**（镜像/G2/G5/G6/计划治理全绿）。W2~W6 仍按「裁决先落笔」纪律待用户发令「开始执行」。
- 2026-10-15：用户发令「开始执行 W2~W6」后落标准正文与技能指针——W2 `database-design.md`「迁移」节增「1.0 前 schema 重建档位」子节（三档表：自由重建档＝测试库 `qed_test`＋LLM 调用账 `qed_llm_calls` 免备份／备份确认档＝`af_*`·`qt_*` 临时备份验收即清／生产 `qed` 库红线不适用；备份临时制引 ADR 0019 决定 4、误判先按备份确认档、1.0 宣布后另立 ADR 收口），「决策依据」补 ADR 0024；W3 `task-lifecycle.md`「计划准入与分拆」节增 demo 门条、`development.md` 六步表第 4 步人类决策点补「大任务到 demo 门暂停待人工验收」、`AGENTS.md` 决策机制行补「方向取舍以核心价值为准绳（第一性原理，非强制）」半句；W4 `code-standards.md`「允许与禁止清单」增范围锁死禁止行（实现超出 design/ 与已批壳范围）；W5 根 `qed-intake`（立项判 demo 门适用性）／`qed-plan`（壳首工作项＝demo 门）／`qed-implement`（实现前对照设计范围、到门暂停）各补一句指针。契约门禁 `pytest tests/contract` **82 passed**（W2~W4 后 + W5 后各一次），链接门禁绿。
- 2026-10-15：W5 Tracker `qed-db-alter-redline-window` **移交单**（按跨项目纪律移交对方窗口执行，根侧不改其技能文件；回执前作为遗留事项，收口若未回执写进归档壳「遗留与移交」）——请在该技能头部加一句适用面收窄声明＋档位指针：「适用面收窄（ADR 0024，根仓库 REQ-112 移交）：本四步窗口自 2026-10-14 起只适用于**备份确认档**（`af_*`/`qt_*` 等再生昂贵数据）与**生产 `qed` 库红线**场景；**自由重建档**（测试库 `qed_test`、LLM 调用账 `qed_llm_calls` 等可低成本再生数据）的 schema 变更免本窗口、免备份，直接改模型 → 删表重建或 `ensure_schema` 自愈。档位归属判据唯一事实源在根仓库 `docs/architecture/database-design.md`「迁移」节「1.0 前 schema 重建档位」表，本技能头部加指针指向该表、不复制档位表；1.0 宣布后另立 ADR 收口。」
- 2026-10-15：W6 全量门禁（QED_env 解释器，串行）——`ruff check backend tests` **All checks passed**；`pytest tests`（全量）**737 passed**（本轮纯文档＋技能 markdown、无 Python 改动，后端用例数与上一提交持平）；`pytest tests/contract` 在 W2~W4 后与 W5 后各 **82 passed**（G1~G7、storage、链接门禁全绿，自证本轮改动不回归）。**收尾复跑 contract 出现 2 红，归因均为并行会话在途 WIP、非本轮引入**：① `test_active_plans_have_complete_metadata_and_sections` 红在 `2026-10-14-learn-ui-course-star-graph.md` 状态被并行会话改为 `Completed`（REQ-111 收口在途、终态壳尚未归档）；② `test_todo_plan_rows_exactly_mirror_active_plan_bodies` 红在并行会话新建 `2026-10-15-learn-ui-course-kp-boxmap.md` 壳但 todo 镜像行未落（set 右侧多一项）。两文件均非本轮触碰，按「并行在途 WIP 只归因不代改」纪律不修；本轮 shell 与 todo REQ-112 行在状态已为 In Progress 的那次复跑里 metadata＋mirror 均绿，自证不回归。待并行壳收口/补行后 contract 复绿。
- 2026-10-15：本轮收口后用户追加两处小订正（保持现状，不新增 MCP/SKILL）——① `qed-intake`「2. 定级」节补 prior-art 指针（用户说不清形态时用 WebSearch / WebFetch / browser-use 挖 GitHub 成熟项目作借鉴，产出＝设计提案交用户裁决、不直接落码，遵 ADR 0024 范围锁死）；② `AGENTS.md`「Qoder 侧工具层」行订正原「GitHub MCP 配在 user 全局」的过期断言为本会话实测事实（GitHub MCP 未接入、`gh` CLI 未安装、全局配置不可读未核实，故不作可用品依赖，探索以 WebSearch / WebFetch / browser-use 为可用品）。`tmp/req112_ptr_and_agents.py` 两处字面替换各 1 命中（AGENTS CRLF、SKILL LF 保持）；契约门禁复跑 `pytest tests/contract` **82 passed**（此前 2 枚并行壳红已复绿）。

- 2026-10-18：**人工验收通过并收口（用户当令「验收通过，收尾并归档壳」）**——逐条对照 todo `REQ-112`
  行 S1~S6 复验：S1=`docs/adr/0024-preschema-rebuild-tiers-and-demo-gate.md` 实存且
  `adr/index.md` 第 29 行登记 Accepted；S2=`database-design.md` §7.3 四档表齐备（自由重建档／
  有外部写方例外档／备份确认档／生产红线）＋备份临时制＋误判缓解，本轮 REQ-092 的 §7.9 直接挂在
  其下成文，等于该档位在实操中被复用一次；S3=`task-lifecycle.md`:125 demo 门条、
  `development.md`:59 第 4 步 demo 验收、`AGENTS.md`:137 第一性原理半句三处 grep 命中；
  S4=`code-standards.md`:73 范围锁死禁止行在列；S5=根 `qed-intake`/`qed-plan`/`qed-implement`
  三技能各含 ADR 0024 指针句（grep 到行），Tracker db-alter 档位指针按纪律以移交单登记（见「遗留与移交」节）；
  S6=本轮复跑 `tests/contract` **89 passed**、全量 **814 passed**、`ruff check backend tests
  scripts` **All checks passed**。todo 行原子移除 → `completed.md` 登记 Achieved；本壳按 Retain
  归档 `history/plans/2026-10/`，元数据反引号路径按新深度重算，`plans/index.md` 活跃条目删除、
  已归档节加行；ARCH-035 壳 W21 条目随步指向归档路径。

## 验证与验收

- W2~W4 每处落笔后跑 `pytest tests/contract -q`（文档守护 + 链接门禁）；W6 全量门禁
  （命令原文以 development.md「环境速查与命令矩阵」为准）。
- 验收＝逐条对照 todo 行 S1~S6，证据（含移交单文本）落本壳「过程与证据」节。

## 回滚

- 本轮只改文档与技能指针，无代码与数据操作；回滚＝git 还原本轮各提交（文档批次独立提交，
  不与他轮混批）。ADR 0024 若被推翻按 adr-governance 立后续 ADR 取代，不删档。

## 遗留与移交

- **移交单未回执（唯一遗留）**：W5 对 QED-Tracker `qed-db-alter-redline-window` 技能的档位指针＋
  适用面收窄声明（全文见上节 2026-10-15 行）按跨项目纪律只出文本、根侧不改其技能文件；
  截至本壳归档，对方窗口未回执。**责任位置**=QED-Tracker 会话；**恢复条件**=对方在其技能头部
  加指针句并回执，或明确拒绝留档；根侧不代改、不追改（REQ-124 已就其技能正本治理另发请求，
  本移交单可作为其附带事项一并处理，无需重复发单）。
- 除此之外无遗留：三项裁决全部落正文，非目标面（不新增机械守护、不改代码、不废四步窗口、
  不追溯改造既有壳）逐条保持未越界。

## 关闭与归档

- S1~S6 全达成且用户确认关闭后：todo 行原子移除 → completed.md 登记（关闭结果 + 证据摘要）；
  本壳按 Retain 归档 `history/plans/` 当月目录，plans/index.md 与 ARCH-035 壳 W21 条目同步
  去处；移交单若未被 Tracker 窗口回执，作为遗留事项写进归档壳「遗留与移交」注记。
- **2026-10-18 已按上述执行完毕**：todo REQ-112 行摘除、completed.md Achieved 登记、本壳归档
  `history/plans/2026-10/`、plans/index 两节随步、ARCH-035 壳 W21 随步、状态快照加行；
  移交单未回执已按预设写入「遗留与移交」，不阻塞关闭。
