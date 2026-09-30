---
name: qed-intake
description: Use when starting any task in the QED-Engine / QED-Tracker / Axiom-Flow repos — reads required docs, classifies the change level (变更分级), and sets up todo/plans before implementation. Trigger on 接任务, 任务开始, 定级, 立项.
---

# QED 任务进场（读必读 → 定级 → 立项）

任务动手前的统一入口。**未定级不实施**；无法判定时用 question 工具询问用户。
登记与收口细则的唯一正文是 `docs/standards/task-lifecycle.md`，本技能只给步骤与指针。

## 1. 读必读文档

读当前仓库 `AGENTS.md`，按其「标准映射」表定位并阅读：项目状态快照、本地环境、文档治理、
任务生命周期，以及本任务涉及的 `architecture/` 文档与模块映射（code-map）。

## 2. 定级

按 `AGENTS.md`「变更分级与边界」表判定变更对象属于大修改 / 阻止项 / 小修改 / 先立 ADR / 豁免；
判据只在该表，本技能不复述。无法判定或涉及新增轮次、改判他轮归属时问用户。

## 3. 立项

1. **先找承载再新建**：能在既有行/壳加条目就不加行，能挂支线就不开轮次；默认落点是
   `普通任务轮` 壳的登记表条目（判据：task-lifecycle「收口节拍、薄登记上限与承载归属」节）。
2. **一任务一行一壳**（ADR 0016）：在 `docs/trackers/todo.md` 建一个任务行并在 `docs/plans/`
   建其唯一计划壳（见 `qed-plan`）；不设独立 PLAN 镜像行、不为一个任务发两个 ID。
3. 行的写法：`任务描述` 列＝壳链接 + 一句话「做什么 + 目标/效果」且含仓库内文档锚（G5）；
   `成功标准` 列＝条目化固定判据 `S1 …`（正本在行、写定不改，G2）；`状态` 列只用进行中态（G1）。
   执行进展与证据不写进行——落壳的 `## 过程与证据` 节（G7）。
4. 缺陷（改代码行为）登记 `DEFECT-NNN`，以承载轮壳条目 + 回归测试替代独立计划；只改文档正文的
   小修入 `docs/plans/design-bugfix-log.md`，不入 todo（两通道判据见 task-lifecycle）。
5. 跨项目需求按 `docs/standards/cross-project-collaboration.md` 登记承接与回执口径。
6. 豁免级直接实施，以差异与验证记录承接。

定级与立项完成后进入实现（`qed-implement`）。

## 指针

- 判据正文：`docs/standards/task-lifecycle.md`（任务台账结构、计划契约与状态、缺陷处理、
  收口节拍与承载归属）；决策记录 ADR 0016 / 0020 / 0021 / 0022 / 0023。
- 机械守护：`tests/contract/test_tracker_governance.py`（G1/G2/G4/G5/G6）、
  `test_plan_governance.py`（G3/G7）。
