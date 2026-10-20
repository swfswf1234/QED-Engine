# 子仓库技能正本治理跨项目请求稿（Axiom-Flow 承接）（subproject-skills-canon-af-request）

状态：Completed
关闭结果：Partial（S1 达成＝其 todo `REQ-125` 入站承接行在位（由本会话经用户当令代登，六项口径由本壳「对接信息」表承载）；S2 形式达成＝R1／R2／R3 逐条均有取值与其门禁输出 640 passed／10 skipped ＋ ruff 全绿，但 R1／R2 的「落地」是根侧代执行的自我声明、R3 的「推后」是根侧判定，均**非对方回执**；S3 部分达成＝R1 白名单落地并已于 2026-10-20 随其 `570f0b2` 入库（`git ls-files .qoder/skills` 实测由 0 转 **4**）、R2 端专有名命中 0 且值长 212→190，R3 的骨架对齐与自查声明未做。按 task-lifecycle「关闭判定逐条对照 S 条目·有未做的核心项记 Partial，不看工作量大小」取 `Partial`，尾巴见「遗留与移交」第 3 条）
任务类型：A
最后更新：2026-10-20
关联 ADR：[ADR 0022](../../../adr/0022-task-chain-clarifications.md)（技能三层模型与 L2/L3 正本落点·决定 6）、[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）
关联设计：无（本请求不涉端口、协议、`.env`、数据布局与设计契约，只涉其 `.qoder/skills/` 的版本控制状态与技能文案）
关联 Tracker：docs/trackers/todo.md（REQ-125 登记，普通任务轮 ARCH-035 节）
归档判定：Retain（请求原文、取证锚点与回执口径属不可替代过程证据）

## 对接信息（跨项目协作规范·计划文档模板）

| 项 | 值 |
| --- | --- |
| 需求方 | QED-Engine 根仓库（工具层接线轮，2026-10-17） |
| 目标项目 | Axiom-Flow（8902） |
| 接口面 | 无端口／协议／`.env`／数据目录变化；只涉其 `.qoder/skills/`（L2 治理四件套**正本**）的版本控制状态、工具名口径与骨架一致性 |
| 评审方 | 用户 |
| 执行方 | Axiom-Flow 会话（其 `.gitignore`、其技能文件与其自身门禁） |
| 验收标准 | 逐条对照 todo.md `REQ-125` 行「成功标准」列（S1~S3） |

## 目标与成功标准

**目标**：把根仓库工具层接线轮（[ADR 0022](../../../adr/0022-task-chain-clarifications.md) 决定 6 的落地）中查出的、
属于 Axiom-Flow 的三项技能治理事项交给技能正本所有者执行；目标效果＝其 L2 治理四件套**有版本控制兜底**、
技能在 Qoder 单端**可直接执行**（2026-10-20 改判：opencode 工具层经用户授权取消，原「两端均可执行」口径作废，
见「过程与证据」2026-10-20 条），且与本仓库同名技能保持「骨架相同、差异受控」。

**成功标准正本在台账行**（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)）：逐条对照
todo.md `REQ-125` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：R1~R3 三项请求成文、逐条带实读证据锚点与兼容性判定，并按
[跨项目协作规范](../../../standards/cross-project-collaboration.md) 登记到根台账请求行；回执跟踪口径写本壳。

**非目标**：
- **不改对方代码**：其 `src/`、`tests/`、`.gitignore` 与技能文件的改动一律归对方会话执行，根侧只出请求稿与只读证据。
- **不改对方 todo 与 docs**：其承接行、其文档链路由对方按其文档治理规范登记。
- **不要求技能内容与本仓库逐字一致**：三层模型允许各仓库各自持正（ADR 0022 决定 6）；R2/R3 只要求工具名口径与骨架一致。
- 不涉 8902 解析管线行为与 `af_*` 知识库（另见 [REQ-099 请求稿](../../../plans/2026-09-26-req098-parsing-region-edit-typography-axiom-flow-request.md)）。

## 请求项

| ID | 对象 | 请求 | 证据锚点（实读，非推断） | 兼容性 |
| --- | --- | --- | --- | --- |
| R1 | 其 `.qoder/skills/`（4 枚：`qed-intake`／`qed-plan`／`qed-implement`／`qed-closeout`） | **纳入版本控制**。当前这 4 枚技能只存在于工作区磁盘上：`git -C Axiom-Flow check-ignore -v .qoder` → `.gitignore:19:.qoder/`，`git ls-files .qoder/skills` 计数 **0** → 一旦工作区丢失不可恢复。请对方裁决形态：① 从 `.gitignore` 移除 `.qoder/` 整体纳入；② 改白名单（忽略其余 `.qoder/` 内容、放行 `.qoder/skills/**`）；③ 维持忽略并在其仓库文档中成文声明「技能离线维护」及其风险与重建口径 | 对照根仓库：`.qoder/skills` 已入库（`git -C QED-Engine ls-files .qoder/skills` 计数 **5**）。其 `.qoder/settings.json` 与技能同目录同忽略规则 | 加法（纳入版本控制不改任何代码行为）；仅需注意 `git status` 噪声与 `.gitignore` 行号变动 |
| R2 | 其 `qed-intake/SKILL.md` 第 8 行 | **工具名端无关化**：现写「用 `AskUserQuestion` 工具询问用户」，而 `AskUserQuestion` 是单一 agent 端的专有工具名。请改为概念名（2026-10-20 改判：原「概念名 + 两端映射」口径随 opencode 取消而作废，直接写「询问用户」即可），或直接统一写「提问工具」 | 实读其 `qed-intake/SKILL.md:8`：`… **未定级不实施**；无法判定时用 AskUserQuestion 工具询问用户。`；根仓库同名技能同位置原写作「用 question 工具询问用户」（同为端专有名，2026-10-20 根侧已一并改为「询问用户」） | 纯文案（frontmatter 一行 + 正文一行）；触发词覆盖面不受影响 |
| R3 | 其四件套（`qed-intake`／`qed-plan`／`qed-implement`／`qed-closeout`）骨架 | **保持「骨架相同、差异受控」**：与根仓库同名技能共享同一骨架（frontmatter 仅 `name` + `description`、步骤小节、`## 指针` 小节、判据只引概念不复述正文），差异只允许出现在①本仓库标准映射表名、②本仓库守护测试名、③本仓库特有判据条目。R3 为**对齐请求**，根仓库侧「技能最小契约」尚未定档，故本轮可先仅自查与声明；契约定档后按契约收敛 | 同 ID 技能已分叉：行数 root 43/34/28/44 vs flow 47/30/27/44（各自持正属设计内，ADR 0022 决定 6）；R2 命中项即「工具名口径」应落骨架层的一个实例 | 纯文案对齐；不改任何判据语义 |

## 端无关自查依据（R2/R3 的判据，随请求一并登记）

> 本节节名原为「两端工具映射」，2026-10-20 用户授权取消 opencode 工具层后改判为**单端**：下表只留概念名，
> 具体工具名属各端实现细节，技能正文不写。原 opencode 列（`question`／`subagent`／内置 browser 工具族／`grep`）
> 随该层取消而删除，备查位＝机器级备份目录 `~/.config/opencode.disabled-2026-10-20`。

| 概念（技能正文应使用的写法） | 说明 |
| --- | --- |
| 向用户提问 | 写「询问用户」，不写端专有提问工具名 |
| 派发子代理 | 写「派发一个独立上下文的子代理」，不写端专有代理工具名与类型枚举 |
| 浏览器验证 | 写概念动作（导航／取快照／读控制台／读网络／执行脚本／截屏）；本仓库 L3 技能 `qed-frontend-check` 已按此改注 |
| 检索 | 写「按符号或文本检索代码」，具体命令行工具（`rg`）可用，属端无关通用工具 |

**自查命令**：`rg -i 'AskUserQuestion|subagent_type|general-purpose|Agent tool|TodoWrite|browser-use|navigate_page|take_snapshot|WebSearch|WebFetch' <skill dir>`
命中即需改为概念名（端专有连接器名不算判据正文，只允许作为「本端实现」括注出现一次）。

## 前置条件

> 本节原写于 2026-10-17（opencode 接线层尚在），2026-10-20 按用户授权取消该层后就地改判，只保留 Qoder
> 单端口径；改动理由见「过程与证据」2026-10-20 条。

1. 工具层为 Qoder 单端（2026-10-20 起）：L1 通用技能正本在机器级 `~/.qoder/skills/`，由 Qoder 自动发现、
   无需技能清单配置；本仓 L2 四件套正本在 `Axiom-Flow/.qoder/skills/`，agent 端直读正本、零副本。
   原「`.opencode/skills` 联接指向本仓 `.qoder/skills`」的接线已随 opencode 取消而删除。
2. 由此产生的约束：技能正本是唯一被直读的源，故正本须端无关（R2/R3 即其落地）；`.qoder/` 需有版本控制兜底（R1）。
3. 根仓库侧 `docs/standards/` 尚未定「技能最小契约」；R3 不以其为前置（允许先声明、后收敛）。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 请求稿成文（本壳，R1~R3 逐条带证据锚点与兼容性判定）+ 根台账 `REQ-125` 请求行登记 + [plans/index.md](../../../plans/index.md) 条目 | 已完成（2026-10-17 成文并登记） |
| W2 | 移交对方：经用户转交本稿全文（R1~R3），由对方在其仓库内承接并按其门禁执行 | **已代执行（2026-10-20，用户放行「当前允许你直接操作子项目」＋裁决「只改文件，不代提交」）**：R1／R2 两项由根侧在其仓库内直接落地，其承接行按其「长期任务」表形态代登（沿 `REQ-129` 先例指文档不新建壳），其门禁由根侧代跑取证 |
| W3 | 回执跟踪：对方逐条回执（落地／推后／拒绝 + 其门禁输出）记入本壳「过程与证据」节 | 逐条已记（2026-10-20）＝**R1 落地／R2 落地／R3 推后**。R1、R2 的「落地」是根侧代执行的自我声明而非对方回执（与 [REQ-124 壳](2026-10-17-subproject-skills-canon-tracker-request.md) 由对方会话自写回执节不同）；R3 的「推后」同样**属根侧判定、未获对方认可**，理由与尾巴见「遗留与移交」第 3 条 |

## 过程与证据

- **2026-10-17 登记依据**：根仓库工具层接线轮验收时发现其三枚事项，按
  [跨项目协作规范](../../../standards/cross-project-collaboration.md)「用户口头指令不豁免」「先只读排查，后登记请求」，
  以请求稿形式发出，不由根侧代改其工作区文件。
- **2026-10-17 取证方式**（命令与输出摘要，符合「诊断三必查·禁止无证据归因」）：
  - R1：`git -C D:\coding\QED-Engine\Axiom-Flow check-ignore -v .qoder` → `.gitignore:19:.qoder/`；
    `git -C … ls-files .qoder/skills` → 0 条；对照根仓库同命令 → 5 条。
  - R2：`rg -n -i 'AskUserQuestion'` 在其技能目录命中 `qed-intake/SKILL.md:8`（唯一命中）；
    根仓库同名技能同位置为「question 工具」。
  - R3：`Get-Content … | Measure-Object` 实测行数（47/30/27/44）。
- **2026-10-17 移交通道未启动**：本稿暂只落根仓库侧；对方承接登记与其 TODO 由对方会话执行（W2）。
- **2026-10-20 台账清理第⑮行复验（用户裁决「跳过·保持 `In Progress`」）**：
  - **移交仍未发生**：`rg REQ-125 Axiom-Flow/docs` → **0 命中**（同目录 `REQ-123`/`REQ-126`/`REQ-129` 三行均在位，唯独本号未送到）；W2 仍待用户转交，执行与承载位置归对方。
  - **R1~R3 逐条复验仍成立、无漂移**：`git -C Axiom-Flow check-ignore -v .qoder/skills/qed-intake/SKILL.md` → `.gitignore:19:.qoder/`，`git ls-files .qoder` 计数 **0**；其技能目录 **4 枚**（无 L3——`qed-db-alter-redline-window` 已于 2026-10-14 迁正给 QED-Tracker）；`qed-intake/SKILL.md:8` 仍是唯一端专有工具名命中（`AskUserQuestion`），其余三枚零命中；行数 intake/plan/implement/closeout = **47/30/27/44**，与本壳 R3 记录逐枚一致。
  - **新事实只作观察项，不扩请求范围**（用户裁决 2026-10-20）：其 `qed-intake` 的 `description` **值长 212**，按第⑭行 REQ-124 刚定的「值长 ≤200」口径同样超阈（closeout 199／implement 181／plan 181 合规）。本壳 R2 只覆盖工具名端无关化，长度治理留待根侧「技能最小契约」立项时三仓同名技能一并收敛；根仓库自身 `qed-intake` 同值 212，届时同批处理。
  - **本轮未做面**：不改对方任何文件、不代跑其门禁、不代登其 todo。与第⑭行 QED-Tracker 代登判例的实质差别＝AF 无贴切的**既有**承载壳（其 `docs/plans/` 三份活跃壳全属解析／停服主题），而其入站请求行的「承载」列必填，且其 todo 卷首「入站请求号不单独立行（一任务一行，ADR 0011）」与 `REQ-123`/`126`/`129` 实际成行存在张力——承载形态属对方治理面，根侧不代定。
- **2026-10-20 W29 单端化批次直接落地（R1／R2 成、R3 推后）**：
  - 授权＝用户当令「当前允许你直接操作子项目」＋「opencode 取消不走 ADR 并取消这部分的描述，在三个项目
    中都是，我授权；现在确认 `.qoder/` 配置一套 skill，整体来配置完全，包括 C 盘的部分」＋执行深度
    「只改文件，不代提交」。本壳「不改对方 todo 与 docs」常规口径按该例外执行，对方侧改动全部可逆。
  - **R1 落地（形态②白名单）**：其 `.gitignore` 的 `.qoder/` 目录模式改为三行 `.qoder/*` ＋
    `!.qoder/skills/` ＋ `!.qoder/settings.json`（与根／Tracker 同形；根因＝目录模式一旦排除目录，其子项
    无法用 `!` 重新纳入，必须改内容模式）。实测 `git status --porcelain -uall .qoder` 列出**五枚**未跟踪件＝
    四枚 `SKILL.md` ＋ `settings.json`；提交前 `git ls-files .qoder/skills` 实测 **0**，故 S3 首句待提交成立。
  - **物理层同批**：其 `.opencode/skills` 联接删除并 `rmdir` 空 `.opencode`（删除前后其正本计数不变＝4 枚，
    联接目标与正本同路径，删的是接线不是内容）。
  - **R2 落地**：`qed-intake/SKILL.md:8` 的 `AskUserQuestion 工具` 改「询问用户」，同枚 `description` 值长
    212→**190**（三仓 `qed-intake` 现同一句文案）；端无关复扫（全套端专有名 `rg -i`）在其四枚技能目录命中
    **0**；其 4 枚 `description` 值长实测 181~199，全部 ≤200。
  - **承接代登**：其 `docs/trackers/todo.md`「长期任务」表加 `REQ-125 长期 低 In Progress` 入站请求行，承载列
    指 `docs/guides/development.md`（照其 `REQ-129` 先例——入站请求行指文档而**不新建 md**，因其计划镜像守护
    要求每份 `docs/plans/*.md` 有 PLAN- 行）；其 `docs/guides/development.md`「标准映射机制」重写为
    「单端正本＋白名单入库＋`description` ≤200」三条口径。
  - **门禁（根侧代跑取证，解释器 `QED_env`，cwd＝其仓库）**：`pytest tests -q` → **640 passed, 10 skipped**；
    `ruff check src tests` → All checks passed。本轮在其仓库零代码改动（只动 `.gitignore`、`qed-intake`
    一枚技能与两份治理文档）。
  - **R3 推后（未做，且属根侧判定、非对方回执）**：四件套骨架逐枚对齐与「自查声明」两项均未执行——根仓库
    「技能最小契约」尚未定档，判据未固定就对齐等于把未定形态钉死；本轮实测其四枚行数 intake／plan／implement／
    closeout 仍为 **47/30/27/44**（与本壳 R3 锚点逐枚一致，即该文件本轮零改动）。尾巴移交「遗留与移交」第 3 条。
  - 根侧同批随步（非本请求范围，属 W29 自处置）：根 `AGENTS.md`「协作流程」重写、
    [ADR 0022](../../../adr/0022-task-chain-clarifications.md) 背景／决定 6／后果三处修订注记、本壳「目标／R2／
    端无关自查依据／前置条件」改单端、根 `qed-intake` 与 `qed-frontend-check` 去端专有名、机器级
    `~/.config/opencode` 改名停用为 `~/.config/opencode.disabled-2026-10-20`（可逆备份）、
    `dispatching-parallel-agents` 提升入 `~/.qoder/skills/`（L1 由 6 枚增至 7 枚，Qoder 自动发现实证）。

## 验证与验收

- 请求稿自身：R1~R3 每条都有「对象／请求／证据锚点／兼容性」四列且锚点可核实；`tests/contract/` 全绿
  （含 `test_cross_project_collaboration` 的请求行标注与承载壳守护、`test_plan_governance` 的计划契约守护）。
- 对方侧验收由其仓库门禁负责（其 pytest 全量 + ruff + 文档白名单），根仓库不代跑、不代声明。
- 根侧随步：R1 落地后根侧**无需任何改动**（路径不变，仅版本控制状态变化）；R2 落地后其 `qed-intake`
  不再依赖任何端专有工具名即可执行。（2026-10-20 补记：根侧同日自行落了同形白名单与 `settings.json` 放行，
  并把 `.qoder/` 版本控制口径写进根 `AGENTS.md`。）

## 回滚

- 本壳与请求行：`git revert` 即撤稿；已发给对方的「撤回说明」写回对方台账，根侧不代改对方文件。

## 关闭与归档

- 关闭取值 `Achieved` 需 W1 达成且 **R1~R3 逐条有对方回执**（落地／推后／拒绝）；仅发出请求而回执未到 →
  状态保持 `In Progress`，长期挂起时按 `Blocked` 三要素（阻塞证据／恢复条件／责任位置）声明。
- 若对方选择推后或拒绝，本行以 `Achieved` 关闭并记录结论（请求已裁决即请求生命周期结束）。
- **2026-10-20 关闭判定＝`Partial`**：R1／R2 达成（根侧代执行＋其门禁取证）、其承接行与其文档口径已落地，
  但 **R3 四件套骨架对齐与自查声明未做**——属「有未做的核心项」，按
  [任务生命周期](../../../standards/task-lifecycle.md)「关闭判定」取 `Partial` 而非 `Achieved`，理由＝本条第 2 行的
  「对方选择推后」不成立（推后由根侧判定、对方未表态），不能借用该出口。未做项连同其前置（根侧「技能最小
  契约」未定档）作为长期尾巴移交，见「遗留与移交」第 3 条。
- 归档判定 `Retain` → `history/plans/2026-10/`（请求原文与取证锚点不可替）。

## 遗留与移交

1. **已执行（原「交 Axiom-Flow 的提交动作」）**：2026-10-20 由本会话按用户当令「那么就 git 重新上传更新掉
   即可」逐枚点名 stage 并提交＝其 `570f0b2`（7 枚文件＝`.gitignore` ＋ `.qoder/settings.json` ＋ `.qoder/skills`
   下四枚 `SKILL.md` ＋ `docs/guides/development.md`）。提交后其 `git ls-files .qoder/skills` 实测 **4**（原 0）
   ＝S3 首句达成；其门禁复跑＝`pytest tests -q` 640 passed／10 skipped ＋ ruff All checks passed。**未随批**＝
   其 `docs/trackers/todo.md`：该文件含并行窗口在飞多行（REQ-123／REQ-126／REQ-129／PLAN-023 与 PLAN-018 进度句，
   其中 PLAN-023 行的计划正文尚未入树，整文件提交会在 HEAD 里留下断链），REQ-125 承接行的提交归该轮会话。
2. **已裁决（原「待用户裁决：R1 三形态」）**：取**形态②**白名单并扩展放行 `settings.json`（与根／Tracker
   三仓同形）；形态①（`.qoder/` 整体纳入）随 opencode 层取消与本机面 `scratch`／`tmp` 忽略需求而不采。
3. **R3 尾巴（本行 `Partial` 的唯一未做项）**：其四件套骨架对齐＋自查声明，前置＝根仓库侧「技能最小契约」
   （frontmatter 两字段、行数与 `description` 值长上限、必须含 `## 指针` 小节、工具名用概念名）定档并配骨架
   一致性校验；定档后按契约收敛，届时本壳 R3 才真正闭合。该立项**不消本行**（本行已随关闭移出 todo），
   由契约轮另登新行承载——判例＝[REQ-124 壳](2026-10-17-subproject-skills-canon-tracker-request.md)「遗留与移交」
   第 3 条同项。
4. **同轮已知差异（不计缺陷，ADR 0022 决定 6「副本差异不计缺陷」的同类口径）**：其无 L3 技能（
   `qed-db-alter-redline-window` 已于 2026-10-14 迁正给 QED-Tracker）；其 `.gitignore` 另有 `:10` 的 `.ev`
   疑似 `.env.*` 笔误，本轮未动、待其裁决。
