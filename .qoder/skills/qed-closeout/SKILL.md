---
name: qed-closeout
description: Use when a QED task is implemented and gates pass — runs the full gate, closes the plan (Retain/Delete), moves todo to completed.md, and syncs design/architecture docs. Trigger on 收尾, 关闭任务, 任务完成, 收口.
---

# QED 任务收尾（门禁 → 关闭 → 同步）

声称完成前先调用 `verification-before-completion`，本技能负责流程性收尾。

## 1. 门禁全绿

运行当前仓库 `AGENTS.md`「标准映射」表中「开发/联调门禁」对应指南的「验证门禁」节全部命令，保留真实输出（各仓库命令不同，以本仓库指南为准）。

## 2. 计划关闭两态判定

按标准映射「文档治理」的归档与删除节：

- **Retain**：记录已执行数据操作、迁移/发布里程碑、事故复盘或不可替代外部证据 → 归档 `history/` 对应目录。
- **Delete**：事实已并入固定文档或同步于 tracker，且 Git 锚点有效 → 删除计划壳。
- 用户在任务关闭时可指定；未指定时按默认规则建议，经用户确认后执行。
- 两态均从 todo 移除该任务的唯一任务行（一任务一行一壳，ADR 0016），并在 `plans/index.md` 登记去处。

## 3. 台账与文档同步

- 完成任务从 `todo.md` 原子移除并写入 `completed.md`（关闭结果 + 证据）。
- 检查涉及模块的 `architecture/`、`design/` 文档是否需增改删；契约变化同步对应文档。
- `design/` 三态梳理（Superseded 删除 / 存档移 `history/` / 有效保持）。
- 主线任务另按标准映射「文档治理」做文档一致性梳理。

## 4. 跨项目回执

跨项目任务向需求方回执：本仓库提交号 + 门禁输出 + 联调结果（按标准映射「跨项目协作」）。

## 5. git

未获用户明确要求不提交、不推送、不打标签。
