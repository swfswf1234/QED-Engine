# ADR 0012：AI 开发守则与变更分级边界

状态：Accepted
日期：2026-09-10
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

项目以文档控制代码，但 agent 执行边界此前分散：AGENTS.md 只给入口不给分级判据，
guides/development.md 只有环境与门禁没有工作流程；2026-09-09 会话实际发生了守则要阻止的
行为——AI 在 `docs/` 下创建 `superpowers/` 目录（未经人类同意、未立 todo 与计划），并留下
未登记的 plans 文档与未登记的已实现端点。需要把「何时必须立项、何时阻止、何时豁免」与
「开发工作流程模式」固化为守则，并明确守则正文的事实归属。

## 决定

1. **事实归属**：AI 开发守则拆两层——根 `AGENTS.md` 承载**指引与变更分级边界**（该文件
   在 doc-governance 中的定位由「只指引」放宽为「指引与边界」）；`guides/development.md`
   承载**工作流程细则**（六步模式：读必读文档→定边界→plans/todo→code-map 定位实现→
   测试总结→收尾清理）。guides/「人类文档、agent 不主动涉及」的既有约定对 development.md
   的守则节为例外，由人类直接授权维护。
2. **变更分级**（判据表落 AGENTS.md，治理规则落 doc-governance「变更分级」节）：
   - `docs/architecture/`（固定架构：总体/服务架构、API 设计、数据库设计、服务框架）改动
     属**大修改**：必须先建 todo 任务 + `plans/` 改造计划；
   - `docs/` 目录结构变化（新建/删除/移动目录或治理类目，如 `superpowers/`）**默认阻止**：
     仅人类明确同意且建 todo + plans 改造计划后方可执行；
   - `docs/design/` 大变更：todo + plans 计划，评审确认后晋升；design 小修改或 bug：登记
     长期滚动台账 `docs/plans/design-bugfix-log.md`（豁免计划治理，同知识收件箱机制）并
     补充设计文档，不单独立项；
   - 一般小改（措辞/链接/错别字/无行为修正）豁免；standards 实质规则变更仍按
     doc-governance「变更与取代」先立 ADR。
3. **任务分类器可重构**：`standards/task-lifecycle.md`（暂定）的 A/B/C/D 分类与准入规则
   可随守则演进调整，调整走 plans 计划，不视为固定架构。

## 后果

- agent 接到任务先定级再实施，未定级不实施（询问用户）；docs/ 目录结构变化有了明确
  阻止依据（superpowers/ 事件为判例）。
- design 小修/bug 有了固定去向（design-bugfix-log），不再与「缺陷不建计划」的旧规则冲突。
- 治理测试豁免清单从 1 项增至 2 项（ai-agent-knowledge-inbox.md、design-bugfix-log.md），
  由 test_plan_governance.py 与 test_tracker_governance.py 共同守护。
- 守则正文拆两处维护：AGENTS.md 与 development.md 需同步演进，边界表述以 AGENTS.md 为准。

## 关联

- 标准：[文档治理规范](../standards/doc-governance.md)（变更分级节、分类表 AGENTS/guides/plans 行）、
  [任务生命周期](../standards/task-lifecycle.md)（缺陷处理节）
- 指南：[开发指南·AI 开发工作流程](../guides/development.md)
- 台账：[设计类小修与 bug 修复台账](../plans/design-bugfix-log.md)
- 任务：REQ-069（todo 镜像）、REQ-062 体系优化阶段④
- 判例：`docs/superpowers/` 违规目录（2026-09-09 创建，2026-09-10 经用户确认删除）
