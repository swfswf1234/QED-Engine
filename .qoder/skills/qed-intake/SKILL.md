---
name: qed-intake
description: Use when starting any task in the QED-Engine / QED-Tracker / Axiom-Flow repos — reads required docs, classifies the change level (变更分级), and sets up todo/plans before implementation. Trigger on 接任务, 任务开始, 定级, 立项.
---

# QED 任务进场（读必读 → 定级 → 立项）

任务动手前的统一入口。**未定级不实施**；无法判定时用 question 工具询问用户。

## 1. 读必读文档

读当前仓库 `AGENTS.md`，按其「标准映射」表定位并阅读：

1. 项目状态快照（现状）
2. 本地环境（环境与命令）
3. 文档治理（文档链路）
4. 任务生命周期（任务分类与计划准入）
5. 涉及契约：对应 `architecture/` 文档与模块映射（code-map）

## 2. 变更分级

按当前仓库 `AGENTS.md`「变更分级与边界」表定级：

- `architecture/` 改动、`design/` 大变更 → 大修改：先建 todo + `plans/` 计划
- `docs/` 目录结构变更 → **默认阻止**，仅用户明确同意且建 todo + 计划后执行
- `design/` 小修/bug → 登记对应长期台账并补设计文档
- 一般小改（措辞/链接/错别字/无行为修正）→ 豁免
- `standards/` 实质规则变更 → 先立 ADR

## 3. 立项

- 大修改：在 `docs/trackers/todo.md` 建任务条目，在 `docs/plans/` 建计划（见 `qed-plan`）。
- 缺陷：按标准映射「任务生命周期」的缺陷处理节登记，不单独建计划。
- 跨项目需求：按标准映射「跨项目协作」承接登记。
- 豁免级：直接实施，以差异与验证记录承接。

定级与立项完成后，进入实现（`qed-implement`）。
