# 设计类小修与 bug 修复台账（design-bugfix-log）

状态：Current（长期滚动台账）
最后更新：2026-09-10
关联任务：REQ-069（见 [todo.md](../trackers/todo.md)）

> **定位声明**：本文档是**长期滚动台账**，不是一次性计划——**不随任务完成归档**
> （plans/ 归档规则的例外，本声明即依据，豁免清单见
> `tests/contract/test_plan_governance.py::STANDING_DOCS`）。承载 `design/` 文档的小修改
> 与 bug（行为与设计不符、错漏修正）：登记 → 修复 → 同步设计文档 → 关闭（ADR 0012）。
> 大修改不走本表，按根 `AGENTS.md`「变更分级与边界」建 todo + plans/ 计划。

## 记录格式

每条记录一个条目（`### BUGFIX-NNN：<一句话标题>`），字段：

| 字段 | 说明 |
| --- | --- |
| 发现日期 | 首次发现的日期（相对日期一律转绝对日期） |
| 设计文档 | 受影响的 `design/`（或 architecture/）文档路径 |
| 问题与根因 | 现象、与设计/预期的偏差、根因定位（文件：行号） |
| 修复与验证 | 修复方式、门禁证据（测试数字/构建结果） |
| 状态 | 待修复 / 已修复（附完成日期） |

条目关闭时同步检查对应设计文档是否需要补充措辞；设计文档本体随后更新，不在本表复制
设计正文。

## 台账

### BUGFIX-001：课程侧边栏误用 note 字段展示课程描述

- **发现日期**：2026-09-09
- **设计文档**：`../design/downloads-flow.md`（课程侧边栏展示）
- **问题与根因**：文档下载管理右侧栏课程条目展示 `course.note`（课程简介），而设计预期
  展示 `course.description`（课程描述），`CourseRecord` 两字段并存导致误用
  （`web-ui/src/pages/Downloads.tsx`）。
- **修复与验证**：右侧栏改用 `course.description`（`Downloads.tsx:267`、`Downloads.tsx:1092`）；
  vitest + tsc + build 通过（2026-09-09 会话）。
- **状态**：已修复（2026-09-09）
