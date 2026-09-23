# 根仓库前端（8903）渲染优化滚动记录（web-ui-rendering-optimization）

状态：Superseded
任务类型：A
最后更新：2026-09-22
关联 ADR：无新增（治理沿用 [ADR 0011](../../adr/v0.1/0011-pending-design-location.md) 不确定文档暂居 plans/）
关联设计：[parsing-ui.md](../../../design/parsing-ui.md)（对照工作台与渲染消费面）、
[frontend-architecture.md](../../../architecture/frontend-architecture.md)（8903 服务架构）
关联 Tracker：docs/trackers/todo.md（原 ARCH-026 主线 + PLAN-051 镜像行，已随并轮移除）
归档判定：Retain（渲染边界裁决与滚动口径由取代壳承接；本壳留档承载 2026-09-22「渲染归前端，
Axiom-Flow 不做渲染」立项裁决的推导依据）

> **归档说明（2026-09-23 并轮收口）**：本壳随 ARCH-022 + ARCH-026 并轮 Superseded——渲染线
> 先归学习中心轮 W1，2026-09-23 重划为学习设计轮后由 **M1 壳 UI-1 渲染基线**承接
> （[learning-ui-rendering](../../../plans/2026-09-23-learning-ui-rendering.md)，
> 轮级判定表见 [主链壳](../../../plans/2026-09-22-learning-design-mainline.md)）
> （关闭时登记表为空，无遗留条目迁移）；todo 已移除 PLAN-051 与 ARCH-026 行（见
> completed.md 对应 Superseded 行）。以下为退役前正文快照。

## 目标与成功标准

**目标**：承载 ARCH-026「根仓库前端（8903）优化轮」的**同步优化记录**——渲染线发现的每一个
优化项/bug 在本壳登记（现象、定位、方案、状态）；本壳是渲染优化唯一滚动记录，不为单项
另立计划。

**范围边界（2026-09-22 用户裁决）**：渲染是根仓库 8903 前端的职责（Axiom-Flow 不做渲染），
本线只管**解析产物的渲染呈现**；产物数据侧缺陷归
[ARCH-025 滚动壳](../../../plans/2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md)。

**成功标准**：

1. 登记表条目状态与实际一致（现象 → 定位 → 修复 → 浏览器实测收口）；
2. 渲染侧防御项（如 [BUGFIX-011](../../../plans/design-bugfix-log.md) `$$$` 双包定界符剥离）随老代产物
   核销有明确收口记录；
3. 每条收口跑 web 面门禁（tsc + vitest + build）并按 qed-frontend-check 口径浏览器验证。

## 范围与非目标

**范围**：8903 渲染呈现优化——公式（KaTeX）/表格/图片/版面回原样、书页对照渲染、块编辑
与 bbox 联动的消费体验、渲染层对上游产物缺陷的防御与降级。

**非目标**：学习中心新功能与界面（归 ARCH-022，REQ-089 第二批重设计一并考虑）；后端与
子项目侧代码（8900 门面归各主线，Axiom-Flow 面归 ARCH-025 滚动壳）；8901 透传。

## 前置条件

1. ARCH-026 主线条已在 todo 登记（2026-09-22）。
2. web-ui 构建链可用（改动后 `npm run build` 方可浏览器验证，见 stale-service 备忘）。

## 工作项（滚动登记表）

### 线：渲染优化（产物回原样 + 消费体验）

| 条目 | 现象/动机 | 方案要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| （待登记） | — | — | — | — |

## 验证与验收

- 每条目收口：web 面门禁（tsc · vitest · build）+ 真实浏览器实测（qed-frontend-check 口径；
  内嵌浏览器验证受限项如实声明）。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯记录文档：删除本文件不影响代码与测试；登记表条目对应的代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件：连续一个版本周期无新增条目且遗留条目全部移交/关闭，由用户裁决收口；
关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 PLAN-051 与 ARCH-026 行。
