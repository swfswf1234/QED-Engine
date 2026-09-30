---
name: qed-plan
description: Use when a QED task needs an implementation plan in docs/plans/ — writes the plan following the task-lifecycle plan contract (metadata + sections). Trigger on 写计划, 建计划, plans, 实施计划.
---

# QED 实施计划编写

计划的格式与治理规则以当前仓库 `AGENTS.md`「标准映射」表中「任务生命周期」对应文件
（`docs/standards/task-lifecycle.md`）为准，本技能只给执行步骤与指针，不复制正文。

## 步骤

1. 确认任务已按 `qed-intake` 定级并登记 todo。
2. 在 `docs/plans/` 建计划文件，命名 `YYYY-MM-DD-<类型>-<slug>.md`（全小写连字符）。
3. 声明必需元数据、写入必需章节（含 `## 过程与证据`），清单与格式以 task-lifecycle
   「计划契约」节为准；状态枚举与 `Blocked` 三要素同见该节。
4. 在 `docs/trackers/todo.md` 由**该任务的唯一任务行**登记：`任务描述` 列写计划壳链接 +
   一句话「做什么 + 目标/效果」（锚内嵌，ADR 0021），`成功标准` 列写条目化固定判据
   `S1 …；S2 …`（正本在行，写定不改，ADR 0023）；`状态` 与壳一致，壳是状态事实源。
   一任务一行一壳（ADR 0016），不另设镜像行。
5. 壳不复制判据条目：「目标与成功标准」节只写目标陈述 + 指向台账行的指针；执行进展、
   取证与裁决记录逐条写入壳的 `## 过程与证据` 节（带日期戳）。

## 指针（细则正文在 task-lifecycle，此处不重述）

- 长期线形态与 `长期滚动：无终态` 声明、达成即收、成功标准冻结与不扩载、
  轮次非必要不增设、归并不删壳、改判他轮归属须用户裁决、缺陷登记通道（DEFECT-NNN 不建壳）
  → `docs/standards/task-lifecycle.md`「任务台账结构」「计划契约与状态」「收口节拍、薄登记上限
  与承载归属」节；决策记录见 ADR 0016 / 0020 / 0021 / 0022 / 0023。
- 上述判据的机械防线＝`tests/contract/test_tracker_governance.py`（G1/G2/G4/G5/G6）与
  `test_plan_governance.py`（G3/G7）；改标准正文前先改守护并使其先红。
- 计划只链接事实源，不复制通用命令、设计正文、实验结果或逐日工作日志；待评审设计内容随计划
  承载，用户确认后按 `docs/standards/doc-governance.md` 迁入 `docs/design/`。
- 关闭时按 `qed-closeout` 做 Retain/Delete 两态判定。
