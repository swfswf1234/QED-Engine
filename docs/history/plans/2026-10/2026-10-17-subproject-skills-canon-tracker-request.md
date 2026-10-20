# 子仓库技能正本治理跨项目请求稿（QED-Tracker 承接）（subproject-skills-canon-tracker-request）

状态：Completed
关闭结果：Achieved（S1＝其 todo `QED-081` 承接行与其承载节六项声明在位；S2＝R1／R2／R3 逐条取值均为「落地」并附其门禁输出 668 passed／1 skipped ＋ ruff 全绿（回执与承接稿由根侧会话经用户当令在其仓库内代笔，非对方自写，见「关闭与归档」节）；S3＝R1 其 `.gitignore` 白名单落地并已于 2026-10-20 随其 `067d5b9` 入库——`git ls-files .qoder/skills` 实测由 0 转 **5**，R2 值长 393→188 与 212→190 且主触发词保留，R3 四件套逐枚对齐＋三类允许差异声明表见其回执节，且根侧对本请求零改动。关闭判定原按「残余仅提交动作」记 Achieved，该动作同日已执行）
任务类型：A
最后更新：2026-10-20
关联 ADR：[ADR 0022](../../../adr/0022-task-chain-clarifications.md)（技能三层模型与 L2/L3 正本落点·决定 6）、[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）
关联设计：无（本请求不涉端口、协议、`.env`、数据布局与设计契约，只涉其 `.qoder/skills/` 的版本控制状态与技能文案）
关联 Tracker：docs/trackers/todo.md（REQ-124 登记，普通任务轮 ARCH-035 节）
归档判定：Retain（请求原文、取证锚点与回执口径属不可替代过程证据）

## 对接信息（跨项目协作规范·计划文档模板）

| 项 | 值 |
| --- | --- |
| 需求方 | QED-Engine 根仓库（工具层接线轮，2026-10-17） |
| 目标项目 | QED-Tracker（8901） |
| 接口面 | 无端口／协议／`.env`／数据目录变化；只涉其 `.qoder/skills/`（L2 治理四件套 + L3 项目技能的**正本**）的版本控制状态、技能 `description` 长度与骨架一致性 |
| 评审方 | 用户 |
| 执行方 | QED-Tracker 会话（其 `.gitignore`、其技能文件与其自身门禁） |
| 验收标准 | 逐条对照 todo.md `REQ-124` 行「成功标准」列（S1~S3） |

## 目标与成功标准

**目标**：把根仓库工具层接线轮（[ADR 0022](../../../adr/0022-task-chain-clarifications.md) 决定 6 的落地）中查出的、
属于 QED-Tracker 的三项技能治理事项交给技能正本所有者执行；目标效果＝其 L2/L3 技能**有版本控制兜底**、
技能清单注入成本可控，且与本仓库同名技能保持「骨架相同、差异受控」。

**成功标准正本在台账行**（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)）：逐条对照
todo.md `REQ-124` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：R1~R3 三项请求成文、逐条带实读证据锚点与兼容性判定，并按
[跨项目协作规范](../../../standards/cross-project-collaboration.md) 登记到根台账请求行；回执跟踪口径写本壳。

**非目标**：
- **不改对方代码**：其 `src/`、`tests/`、`.gitignore` 与技能文件的改动一律归对方会话执行，根侧只出请求稿与只读证据。
- **不改对方 todo 与 docs**：其承接行、其文档链路由对方按其文档治理规范登记。
- **不要求技能内容与本仓库逐字一致**：三层模型允许各仓库各自持正（ADR 0022 决定 6）；R3 只要求骨架与工具名口径一致。
- 不涉 8901 运行行为、不涉 `qt_*` 表与共享库（另见 [REQ-119 请求稿](../../../plans/2026-10-16-shared-tables-tracker-request.md)）。

## 请求项

| ID | 对象 | 请求 | 证据锚点（实读，非推断） | 兼容性 |
| --- | --- | --- | --- | --- |
| R1 | 其 `.qoder/skills/`（5 枚：`qed-intake`／`qed-plan`／`qed-implement`／`qed-closeout`／`qed-db-alter-redline-window`） | **纳入版本控制**。当前这 5 枚技能只存在于工作区磁盘上：`git -C QED-Tracker check-ignore -v .qoder` → `.gitignore:22:.qoder/`，`git ls-files .qoder/skills` 计数 **0** → 一旦工作区丢失（换机、清理、误删）不可恢复。请对方裁决形态：① 从 `.gitignore` 移除 `.qoder/` 整体纳入；② 改白名单（忽略其余 `.qoder/` 内容、放行 `.qoder/skills/**`）；③ 维持忽略并在其仓库文档中成文声明「技能离线维护」及其风险与重建口径 | 对照根仓库：`.qoder/skills` 已入库（`git -C QED-Engine ls-files .qoder/skills` 计数 **5**，且 `git status` 可见其修改）。其 `.qoder/settings.json` 与技能同目录同忽略规则 | 加法（纳入版本控制不改任何代码行为）；仅需注意 `git status` 噪声与 `.gitignore` 行号变动 |
| R2 | 其 `qed-db-alter-redline-window/SKILL.md` 与 `qed-intake/SKILL.md` 的 `description` | **瘦身到值长 ≤200 字符**（保留触发词）。现 `description` 值长 **393 字符**（整行 406），为其合规三枚（值长 181~199）的近两倍；**`qed-intake` 值长 212 亦超阈**（2026-10-18 补，故 R2 对象为两枚）；技能清单的 `description` 在**每次会话**随可用技能表全量注入上下文，属纯常驻成本 | 实测：`description:` 行 406 字符（`Use when adding or changing columns on QED private MySQL tables (qt_*) — the backup → ALTER → model sync → ensure_schema (0,0) window, … Not for shared audit tables …`）；同批实测（整行含前缀）其 `qed-intake` 225／`qed-closeout` 212／`qed-implement` 194／`qed-plan` 194 字符。2026-10-18 量法更正：上列均为**整行**长度（含 `description: ` 前缀 13 字符），只取**值长**为 db-alter 393／intake 212／closeout 199／implement 181／plan 181（五枚恒差 13，文件自 2026-10-17 起未变、**无数字漂移**）→ 超 200 者为 db-alter 与 intake 两枚 | 纯文案（frontmatter 一行）；触发词覆盖面若要收紧，建议保留「加列／ALTER／迁移脚本／生产库红线」四个主触发词 |
| R3 | 其四件套（`qed-intake`／`qed-plan`／`qed-implement`／`qed-closeout`）骨架 | **保持「骨架相同、差异受控」**：与根仓库同名技能共享同一骨架（frontmatter 仅 `name` + `description`、步骤小节、`## 指针` 小节、判据只引概念不复述正文），差异只允许出现在①本仓库标准映射表名、②本仓库守护测试名、③本仓库特有判据条目。R3 为**对齐请求**，根仓库侧「技能最小契约」尚未定档，故本轮可先仅自查与声明；契约定档后按契约收敛 | 同 ID 技能已分叉：行数 root 43/34/28/44 vs tracker 50/30/29/37（各自持正属设计内，ADR 0022 决定 6）；其 `qed-intake` 已含本仓库「变更分级」内联表（根仓库为独立标准文件），此为正例——差异落在标准映射表名上 | 纯文案对齐；不改任何判据语义 |

**端无关性自查清单（随请求一并登记）**：技能正文与 `description` 中**不得**直接引用单一 agent 端的专有工具名，
应使用概念名。（原「并按需给两端映射」口径已随 2026-10-20 opencode 工具层取消而作废——现只服务 Qoder 单端，
[Axiom-Flow 请求稿](2026-10-17-subproject-skills-canon-af-request.md)「两端工具映射」节同批改判。）其本轮已合规
（实读其 5 枚技能未命中 `AskUserQuestion`／`Agent tool`／`subagent_type`／`browser-use MCP`／`TodoWrite`
等专有名），此处作为**后续防线**登记。

## 前置条件

> 本节原写于 2026-10-17（opencode 接线层尚在），2026-10-20 按用户授权取消该层后已就地改判，正文只保留
> Qoder 单端口径；改动理由与执行记录见「过程与证据」2026-10-20 条。

1. 工具层为 Qoder 单端（2026-10-20 起）：L1 通用技能正本在机器级 `~/.qoder/skills/`，由 Qoder 自动发现、
   无需技能清单配置；各仓库 L2/L3 技能正本在该仓库 `.qoder/skills/`，agent 端直读正本、零副本。
   原「各仓库 `.opencode/skills` 联接指向本仓 `.qoder/skills`」的接线已随 opencode 取消而删除。
2. 由此产生的约束：技能正本是唯一被直读的源，故正本须端无关（对应上文自查清单）；`.qoder/` 需有版本控制
   兜底（对应 R1）。
3. 根仓库侧 `docs/standards/` 尚未定「技能最小契约」；R3 不以其为前置（允许先声明、后收敛）。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 请求稿成文（本壳，R1~R3 逐条带证据锚点与兼容性判定）+ 根台账 `REQ-124` 请求行登记 + [plans/index.md](../../../plans/index.md) 条目 | 已完成（2026-10-17 成文并登记） |
| W2 | 移交对方：经用户转交本稿全文（R1~R3），由对方在其仓库内承接并按其门禁执行 | 已代登对方文档面（2026-10-18，用户裁决「本轮代登」；照 REQ-119/099 判例只改其既有文件、不新建 md） |
| W3 | 回执跟踪：对方逐条回执（落地／推后／拒绝 + 其门禁输出）记入本壳「过程与证据」节 | 已回执（2026-10-20，R1／R2／R3 三条均「落地」，其中 R1 **待本仓提交**；回执正文＝对方 [v1.0 后续任务链条梳理](../../../../QED-Tracker/docs/plans/2026-09-24-v1-task-chain.md)「REQ-124 逐条回执」节，其 todo `QED-081` 状态同步转「进行中」） |

## 过程与证据

- **2026-10-17 登记依据**：根仓库工具层接线轮验收时发现其三枚事项，按
  [跨项目协作规范](../../../standards/cross-project-collaboration.md)「用户口头指令不豁免」「先只读排查，后登记请求」，
  以请求稿形式发出，不由根侧代改其工作区文件。
- **2026-10-17 取证方式**（命令与输出摘要，符合「诊断三必查·禁止无证据归因」）：
  - R1：`git -C D:\coding\QED-Engine\QED-Tracker check-ignore -v .qoder` → `.gitignore:22:.qoder/`；
    `git -C … ls-files .qoder/skills` → 0 条；对照根仓库同命令 → 5 条。
  - R2：`description:` 行长度实测 406 字符（含前缀），四件套同批实测 194~225 字符。
  - R3：`Get-Content … | Measure-Object` 实测行数；`rg -i 'AskUserQuestion|Agent tool|subagent_type|browser-use|TodoWrite'`
    在其技能目录命中 0 条。
- **2026-10-17 移交通道未启动**：本稿暂只落根仓库侧；对方承接登记与其 TODO 由对方会话执行（W2）。
- **2026-10-18 台账清理第⑭行复验（量法更正 + 代登移交）**：
  - 只读取证：其 `.gitignore:22` 仍为 `.qoder/`、其 `.qoder/skills/` 五枚技能目录名未变（R1 证据仍成立）；
    `description` 值长实测见上表（推翻本壳先前对「406→393 数字漂移」的口头表述——系整行与值两种量法之差恒为 13 字符）。
  - 代登落点（用户裁决「本轮代登对方文档面」）：[QED-Tracker/docs/trackers/todo.md](../../../../QED-Tracker/docs/trackers/todo.md)「长期任务」表加 `QED-081` Candidate 承接行；其既有承载壳 [QED-Tracker/docs/plans/2026-09-24-v1-task-chain.md](../../../../QED-Tracker/docs/plans/2026-09-24-v1-task-chain.md)加「### 承载根仓库 REQ-124」节（镜像其 REQ-119 节形态）。**不新建 md**，避开其 `test_documentation.py` 全量 md 等值白名单。
  - 执行与门禁归对方，根侧不代改其技能文件与 `.gitignore`、不代提交其 git。
  - **代登后其门禁取证**（根侧代跑，只作「代登未破坏其仓库」的证据，不代表其验收）：
    `pytest tests/test_documentation.py -q` → 9 passed；`pytest tests -q` → 667 passed, 1 skipped in 54.32s；
    `ruff check src tests scripts` → All checks passed（解释器 `D:/software/anaconda3/envs/QED_env/python.exe`）。
    两文件均为**既有文件追加**，其文档清单白名单不受影响（此点由 `test_documentation` 绿证实）。
  - R3 未做整改：本壳只出对齐请求，根侧「技能最小契约」未定档，按其 todo `QED-081` 行口径先自查与声明。
  - **根侧门禁（本轮收尾取证）**：`pytest tests/contract -q` → 88 passed + 1 failed；`pytest tests -q` → 859 passed + 1 failed in 137.98s；`ruff check backend tests scripts` → All checks passed。唯一红＝
    `test_storage_conventions_governance::test_runtime_artifacts_only_under_logs_and_tmp`，`assert not ['scripts/image-model/.keepalive.pid']`。该 pid 文件属 2026-10-18 14:45 起的存活 wsl.exe 容器保活进程
    （PID 208256，`tasklist` 核实），其落点违反「运行时产物只进 `logs/` 与 `tmp/`」；与本轮文档改动无关——上一轮同门禁基线为 860 passed 零红，总数不变、仅此一枚转红。**属新发现缺陷，不在本行处置**，待单独立项。

- **2026-10-20 对方回执到齐（R1／R2／R3 三条均「落地」，其中 R1 待其提交）**：
  - 授权改判：用户本轮明示「当前允许你直接操作子项目」，并就四项给出裁决——执行深度「只改文件，不代提交」、
    R2「我起草并落笔」、R3「直接对齐骨架」、R1 前提改判「取消 opencode 接线，只考虑 Qoder 侧」。故本壳
    「根侧不代改其技能文件与 `.gitignore`」常规口径按例外执行，对方 todo 承载节原口径处已加更新注记。
  - R1 落地（形态②白名单）：其 `.gitignore` 第 22 行 `.qoder/` → `.qoder/*` ＋ `!.qoder/skills/`
    （目录模式必须先改内容模式，否则 Git 无法重新纳入被排除目录的子项）。实测
    `git check-ignore -v .qoder/skills/qed-intake/SKILL.md` → exit 1；`settings.json` 与 `.qoder/tmp/*`
    仍命中 `.gitignore:24:.qoder/*`；`git status --porcelain -uall .qoder` 列出五枚 `SKILL.md`；
    假想新增 `.qoder/skills/probe-new/SKILL.md` 同 exit 1（未来新技能文件不再被无声吞掉）。
    **S3 的 `git ls-files .qoder/skills` 非 0 仍待其提交**（`git add`／commit 按裁决归人工执行）。
  - R2 落地：db-alter 393→**188**、intake 212→**190**（主触发词各保留四枚）；五枚值长实测
    closeout 199／db-alter 188／implement 181／intake 190／plan 181，全部 ≤200。
  - R3 落地：四件套小节与其同名技能逐一对齐——intake 补 `## 指针` 并删除对本仓「变更分级与边界」表正文的
    五条复述；plan 的 `## 边界` 改 `## 指针`；implement 补「记录过程」步骤与步骤 1 的「文档控制代码」范围句；
    closeout §2 由「计划关闭两态判定」改题「逐条对照关闭」并把 Retain／Delete 收为子项、§3 补本仓守护自查。
    差异逐条落在三类允许项内，逐枚声明表见对方回执节；端无关复扫＝其五枚命中 0 条。
  - 对方门禁（解释器 `D:/software/anaconda3/envs/QED_env/python.exe`，cwd＝其仓库）：
    `pytest tests/test_documentation.py -q` → 9 passed；`pytest tests -q` → 667 passed, 1 skipped in 44.11s；
    `ruff check src tests scripts` → All checks passed。本轮零代码改动，其技能文件不在
    `test_documentation.py` 扫描面（该测试只扫 `README.md`／`AGENTS.md`／`docs/**`）。
  - 根侧门禁（本轮）：`pytest tests/contract -q` → 88 passed, 1 failed。唯一红＝既存
    `test_runtime_artifacts_only_under_logs_and_tmp`（`scripts/image-model/.keepalive.pid`，2026-10-18 起的
    容器保活进程产物），与本轮文档改动无关，已登记待单独立项。

## 验证与验收

- 请求稿自身：R1~R3 每条都有「对象／请求／证据锚点／兼容性」四列且锚点可核实；`tests/contract/` 全绿
  （含 `test_cross_project_collaboration` 的请求行标注与承载壳守护、`test_tracker_governance` 的镜像与文档锚守护）。
- 对方侧验收由其仓库门禁负责（其 pytest 全量 + ruff + 文档白名单）；**代登场景判例例外**（REQ-099/119）：根侧可代跑其文档门禁作**取证**，但不代改其代码、不代提交其 git。
- 根侧随步：R1 落地后根侧**无需任何改动**（路径不变，仅版本控制状态变化）；R2 落地后技能清单注入成本
  自动下降。（2026-10-20 补记：根侧同日自行落了同形白名单与 `settings.json` 放行，并把 `.qoder/` 版本控制
  口径写进根 `AGENTS.md`，属本壳「遗留与移交」第 3 条①的自处置。）

## 回滚

- 本壳与请求行：`git revert` 即撤稿；已发给对方的「撤回说明」写回对方台账，根侧不代改对方文件。

## 关闭与归档

- 关闭取值 `Achieved` 需 W1 达成且 **R1~R3 逐条有对方回执**（落地／推后／拒绝）；仅发出请求而回执未到 →
  状态保持 `In Progress`，长期挂起时按 `Blocked` 三要素（阻塞证据／恢复条件／责任位置）声明。
- 若对方选择推后或拒绝，本行以 `Achieved` 关闭并记录结论（请求已裁决即请求生命周期结束）。
- **2026-10-20 关闭判定＝`Achieved`**：三条请求的取值均为「落地」，回执与承接稿写在**对方仓库内**（其
  [v1.0 后续任务链条梳理](../../../../QED-Tracker/docs/plans/2026-09-24-v1-task-chain.md)「承载根仓库 REQ-124」
  与「REQ-124 逐条回执」两节）＋其 todo `QED-081` 承接行，S1／S2／S3 逐条达成。**作者身份如实记**＝
  两节与其技能文件均由**本会话（根侧）代笔并代执行**，依据＝用户当令「当前允许你直接操作子项目」＋
  「R2 我起草并落笔」＋「R3 直接对齐骨架」，**不是对方会话自写**；请求稿的判据原文「逐条有对方回执」按
  「回执写在对方事实源里并附对方门禁输出」解读达成，不据此声称对方自行评审过。与 [REQ-125 壳](2026-10-17-subproject-skills-canon-af-request.md)
  取 `Partial` 的差别＝AF 侧 R3 未做（其判据「R3 有自查声明」无承载物）。残余提交动作已于同日由本会话
  代执行（见「遗留与移交」第 1 条）。
- 归档判定 `Retain` → `history/plans/2026-10/`（请求原文与取证锚点不可替）。

## 遗留与移交

1. **已执行（原「交 QED-Tracker 的提交动作」）**：2026-10-20 由本会话按用户当令「那么就 git 重新上传更新掉
   即可」逐枚点名 stage 并提交＝其 `067d5b9`（9 枚文件＝`.gitignore` ＋ `.qoder/settings.json` ＋ `.qoder/skills`
   下五枚 `SKILL.md` ＋ `docs/guides/development.md` ＋ `docs/plans/2026-09-24-v1-task-chain.md`）。提交后其
   `git ls-files .qoder/skills` 实测 **5**（原 0）＝S3 首句达成；其门禁复跑＝`pytest tests -q` 668 passed／
   1 skipped ＋ ruff All checks passed（回执两处随之更正的随步提交＝其 `c8523d8`）。**未随批**＝其 `docs/trackers/todo.md`：该文件含并行窗口 QED-079 登记行，
   其计划正文尚未入树，整文件提交会在 HEAD 里留下断链，故 QED-081 承接行的提交归该轮会话（工作树内该行的
   请求稿链接已随本壳归档改指 `docs/history/plans/2026-10/`，否则其 `test_all_documentation_links_resolve` 即红）。
2. **已裁决（原「待用户裁决：R1 三形态」）**：取**形态②**白名单（`.qoder/*` ＋ `!.qoder/skills/` ＋
   `!.qoder/settings.json`）；用户同时改判前提「取消 opencode 接线，只考虑 Qoder 侧」，形态①（整体纳入）
   随之不再需要——`scratch/`、`tmp/`、缓存等本机面继续忽略。
3. **交根仓库后续轮（非本请求）**：① 根仓库自身 `.gitignore` 吞未来新增技能文件的问题——**已于 2026-10-20
   自处置**（三仓统一改为同一段三行白名单，实测 `skills/` 与 `settings.json` 放行、`scratch`／`tmp` 仍忽略）；
   ② ~~opencode 取消需另行定级立项~~——**已按用户 2026-10-20 显式授权执行且明确不立 ADR**：三仓
   `.opencode/skills` 联接与根 `opencode.json` 已删除，机器级 `~/.config/opencode` 改名停用为
   `~/.config/opencode.disabled-2026-10-20`（可逆备份、备查 8 件），相关描述同步取消（根 `AGENTS.md`、
   两仓 `docs/guides/development.md`、[ADR 0022](../../../adr/0022-task-chain-clarifications.md) 决定 6 与背景／
   后果节修订注记、本壳前置条件、REQ-125 壳「两端工具映射」口径），剩余动作只在**三仓提交**；
   ③ 根仓库侧「技能最小契约」（frontmatter 格式、行数与 `description` 上限、必须含指针小节、工具名用概念名）
   + 骨架一致性校验若获立项，本壳 R3 与 [REQ-125 壳](2026-10-17-subproject-skills-canon-af-request.md) R3
   随之收敛——**本壳关闭不消该尾巴**，立项时另登新行承载（判例＝REQ-125 壳「遗留与移交」第 3 条）。
