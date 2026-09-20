---
name: qed-plan
description: Use when a QED task needs an implementation plan in docs/plans/ — writes the plan following the task-lifecycle plan contract (metadata + sections). Trigger on 写计划, 建计划, plans, 实施计划.
---

# QED 实施计划编写

计划的格式与治理以当前仓库 `AGENTS.md`「标准映射」表中「任务生命周期」对应文件为准，本技能只给执行步骤，不复制正文。

## 步骤

1. 确认任务已按 `qed-intake` 定级并登记 todo。
2. 在 `docs/plans/` 建计划文件，命名 `YYYY-MM-DD-<类型>-<slug>.md`（类型如 `req067`，全小写连字符）。
3. 声明必需元数据：`状态`、`任务类型`、`最后更新`、`关联 ADR`、`关联设计`、`关联 Tracker`、`归档判定`。
4. 写入必需章节：目标与成功标准、范围与非目标、前置条件、工作项、验证与验收、回滚、关闭与归档。
5. 计划状态只用 `Accepted / In Progress / Blocked / Completed / Cancelled / Superseded`；`Blocked` 必须写阻塞证据、恢复条件、责任位置。
6. 在 `docs/trackers/todo.md` 镜像标题、链接与状态（计划正文是状态事实源）。

## 边界

- 计划只链接事实源，不复制通用命令、设计正文、实验结果或逐日工作日志。
- 待评审设计内容随计划承载；用户确认后按标准映射「文档治理」以稳定名称迁入 `docs/design/`。
- 关闭时按 `qed-closeout` 做 Retain/Delete 两态判定。
