# ADR 0020：任务收口节拍与薄登记上限（达成即收，过程叙述归壳）

状态：Accepted
日期：2026-09-29
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

[ADR 0016](0016-todo-registration-one-task-one-plan.md) 确立了「一任务一行一壳」与 todo 薄登记，
但只落了文档规则，**没有机械防线**，实际执行按惯性退化。2026-09-29 用户指认的现象是「不会主动收
TODO 任务，反而总是喜欢新建 TODO 任务，搞得很乱」，可复现的三条判例：

- **过程叙述沉积 todo**：ARCH-028 主线行「证据/下一条件」列 985 字符，把 W7~W12 逐批实施过程、
  裁决原文、缺陷修复细节全部抄进 todo，而其计划壳内已有同一内容的逐条登记——todo 成为第二事实源，
  两处必然漂移（0016 想消灭的正是这种双副本）。全表其余行中位数约 130 字符，上限缺失使长行无人拦。
- **状态列自造词**：DEFECT-005 状态列写「已实施」，不在 [task-lifecycle.md](../standards/task-lifecycle.md)
  「状态导航」的 todo 状态枚举内；其修复与回归用例（`test_concurrent_ensure_serialized_never_two_running`）
  已随 2026-09-26 增强批落地，却因状态列是自由文本而无人关行。
- **活跃壳无关闭节拍**：契约测试 `test_tracker_governance.py` 的状态镜像只对**带 plans 链接**的任务行
  生效（无链接的缺陷行、长期行完全不受约束），`test_plan_governance.py` 只校验元数据与章节齐备，
  不校验「工作项是否已全部达成而壳仍挂 In Progress」。因此轮次壳可以无限期滚动，关闭动作没有触发器，
  新工作便倾向新开一行。

后果是台账只增不减、状态失真、接手者无法从 todo 判断「哪些还活着」。

## 决定

1. **收口节拍（达成即收）**：计划壳「## 工作项」全部条目达成时，该壳**必须**转终态并写
   `关闭结果`，任务行原子移出 todo 写入 completed.md；不得以「滚动轮次」名义长期停留
   `In Progress`。残余工作只有两种合法出口：显式**移交**（在状态列写明移交去向与被移交流向的壳/行），
   或按已确认的**降级稳态**收口（判例：REQ-098 按 parsing-ui.md §4.5 降级稳态关闭、W5 移交 ARCH-025 线 1）。
   滚动轮次壳（主线轮/普通任务轮）以登记表中的「（待登记）」占位行声明滚动存续；占位行消失且条目全达成即等同无残余，须关闭。
   守护：`test_plan_governance.py::test_active_plans_close_once_every_work_item_is_settled`（G3）。
2. **todo 状态列枚举封闭**：todo「状态」列只允许**进行中态**——`待开始 / 进行中 / 待验收 /
   Accepted / In Progress / Blocked`。终态词（`已关闭 / 已完成 / 已实施 / 已达成 / Completed /
   Cancelled / Superseded` 等）**不得出现在 todo**：出现即表示该任务已终止，应写 completed.md 并
   移除该行。带 plans 链接的行仍额外受镜像规则约束（须等于壳状态且属活跃状态）。
   守护：`test_tracker_governance.py::test_todo_status_column_uses_open_status_enum_only`（G1，覆盖**全部**行，
   含无链接的缺陷行与长期行）。
3. **薄登记上限**：「证据/下一条件」列**不超过 400 字符**，内容口径为「当前状态一句话 +
   关闭条件或下一条件指针」；逐批过程叙述、裁决全文、缺陷取证细节一律由 `plans/` 壳承载
   （本条是 0016 薄登记规则的可执行化，不改变其语义）。超限不代表内容无价值，只代表落点错了。
   守护：`test_tracker_governance.py::test_todo_evidence_column_stays_within_thin_registration_cap`（G2）。
4. **长期线形态**：持续、无单一终态的工作（调试与优化、真机观察窗、复现取证类）以 `类别=长期`
   任务行 + 其唯一计划壳承载；该壳在元数据之后声明 **`长期滚动：无终态`**，据此豁免 G3（避免与
   「达成即收」冲突）。该声明**只允许被 长期 类别的任务行镜像**，主线/支线壳不得借它规避收口。
   长期行同样受 G1/G2 约束。守护：
   `test_tracker_governance.py::test_longterm_rolling_shells_are_mirrored_only_by_longterm_rows`。
5. **新建前先找承载**：新增工作先查是否有可承载的既有轮次/长期线（0016 第 3 条）——能在已有壳
   开登记表条目或挂支线行的，不另立新行；确需新增轮次/主线仍须用户确认。
6. **同步义务与首批判例整改**：修订 [task-lifecycle.md](../standards/task-lifecycle.md)
   （新增「收口节拍与薄登记上限」节、状态导航补枚举封闭口径、evidence 列格式补上限与落点口径）与
   [任务台账](../trackers/todo.md) 规则节；同批改写 `docs/guides/development.md` 开发流程节与
   `qed-intake` / `qed-closeout` 技能指路。判例整改（2026-09-29 用户四裁决）：ARCH-028 取「主线轮
   保留（W9 水位门 + W11 网关熔断）＋新建长期行 REQ-100（本地模型调试与优化）」，W6/S3 掉线根因
   定谳观察窗整体移交该长期线，主线关闭不再依赖真实崩溃；DEFECT-005 按新节拍关闭移入 completed.md，
   其真机复核观察项移交 REQ-100。

## 后果

- todo 只表达「现在什么活着、下一步条件是什么」；历史与过程回到壳与 completed.md，双副本漂移消失。
- 存量首批整改（与本 ADR 同批）：ARCH-028 证据列瘦身至上限内、DEFECT-005 关行、REQ-100 与其
  长期壳新建。后续任何行超限都必须挪进壳而不是放宽阈值。
- G3 的探测器把 `待 / 部分 / 未开始 / 后置 / 移交 / 阻塞 / 降级 / —` 判为未收口，因此**移交与降级
  必须显式写在状态列**才能保持壳活跃；「写了才算移交」正是本决策要的形状。
- 长期壳获得合法豁免，但豁免面被 G4 类别校验锁死在 `类别=长期` 行，主线轮无法用它长期赖账。
- 不取代任何现行 ADR：0016 的决定（一任务一行一壳、薄登记、轮次须用户确认）全部保留且不变，
  本 ADR 只为其补充机械执行防线与收口节拍，属[ADR 治理](../standards/adr-governance.md)意义上的
  **部分补充**（正文关联，0016 状态保持 Accepted）；亦不改动
  [ADR 0012](0012-ai-development-conduct.md) 的变更分级框架。

## 关联

- 部分补充：[ADR 0016](0016-todo-registration-one-task-one-plan.md)（正文关联，不改变其状态与决定）
- 被后续部分补充：[ADR 0021](0021-round-proliferation-cap-and-per-row-doc-anchor.md)（G2 上限之外另补
  「一行一文档锚」G5 与「关闭轮不留节」G6，不改变本 ADR 的决定与状态）
- 被后续部分补充：[ADR 0022](0022-task-chain-clarifications.md)（为本 ADR 的收口节拍补「关闭结果按
  成功标准是否全达成取值」「成功标准冻结不扩载」与「关闭证据允许待提交占位」，不改变本 ADR 的
  决定与状态）
- 被后续结构改判：[ADR 0023](0023-todo-row-carries-scope-and-criteria.md)（本 ADR 的收口节拍、G1/G3/G4
  守护与「达成即收」判定全部保留；G2 的判据对象从「证据/下一条件」列改判为「成功标准」列，
  过程叙述的落点由「壳与证据列」收敛为壳的「过程与证据」节，并另补 G7，不改变本 ADR 的
  决定与状态）
- 标准：[任务生命周期](../standards/task-lifecycle.md)（新增「收口节拍与薄登记上限」节；
  （勘误：2026-09-30 该节因 [ADR 0021](0021-round-proliferation-cap-and-per-row-doc-anchor.md) 补 G5/G6
  更名为「收口节拍、薄登记上限与承载归属」，本 ADR 的决定内容不变））、
  [ADR 治理](../standards/adr-governance.md)、[文档治理规范](../standards/doc-governance.md)
- 测试：`tests/contract/test_tracker_governance.py`（G1 状态枚举全行、G2 证据列上限、长期声明类别校验）、
  `tests/contract/test_plan_governance.py`（G3 达成即收 + 探测器有效性自证用例）
  （勘误：2026-09-30 [ADR 0023](0023-todo-row-carries-scope-and-criteria.md) 将 G2 判据对象改为
  「成功标准」列（S 编号 + 禁过程叙述 + ≤400），计划守护另增 G7 过程与证据节，本 ADR 的决定内容不变）
- 任务：ARCH-028（主线保留 W9/W11）、REQ-100（新建长期线）、DEFECT-005（按新节拍关闭）、
  ARCH-035（W2 治理批次承载，见[任务台账](../trackers/todo.md)）
- 壳：[普通任务轮滚动记录](../plans/2026-09-29-ordinary-tasks-round.md)、
  [本地模型稳定性轮](../plans/2026-09-23-local-model-stability-round.md)、
  [本地模型调试与优化（长期滚动）](../plans/2026-09-29-local-model-debug-optimization-longterm.md)
