# AI 开发守则整合轮（REQ-069）

状态：Completed
关闭结果：Achieved（2026-09-10 关闭：成功标准 1-6 全达成，契约 52 passed + 全量 401 passed + ruff clean）
最后更新：2026-09-10
任务类型：A
关联 ADR：`../../../adr/0012-ai-development-conduct.md`
关联设计：`../../../standards/doc-governance.md`、`../../../standards/task-lifecycle.md`、根 `AGENTS.md`、`../../../guides/development.md`
关联 Tracker：docs/trackers/todo.md（REQ-069，已移入 completed.md；挂靠 REQ-062 体系优化阶段④）
归档判定：Retain（守则建立轮为治理里程碑证据）——已归档至本目录（history/plans/2026-09/）

## 目标与成功标准

按用户裁决（2026-09-10 对话）整合根 `AGENTS.md` 与 `guides/development.md`，建立 AI 开发守则：
AGENTS.md 承载指引与边界，开发手册承载细则与具体流程。项目以文档控制代码；任务分类器
（task-lifecycle.md，暂定）可随守则调整。

**成功标准**：
1. AGENTS.md 新增「变更分级与边界」节：architecture/ 改动=大修改（todo+plans）、docs/ 目录
   结构变化=阻止（人类同意且 todo+plans 方可）、design/ 大改=todo+plans、design/ 小修/bug=
   长期 bug 修复台账+补充设计文档、一般小改=豁免。
2. guides/development.md 新增「AI 开发工作流程」节：读必读文档→定边界→plans/todo→code-map
   定位实现→测试总结→收尾清理六步细则。
3. 新增长期滚动台账 `docs/plans/design-bugfix-log.md` 并同步两处治理测试豁免清单
   （test_plan_governance.py / test_tracker_governance.py）。
4. doc-governance.md 与 task-lifecycle.md 衔接修订（AGENTS/guides 事实归属、design 分流、
   缺陷处理补台账路径）。
5. 同轮治理 2026-09-09 会话遗留：删除违规目录 `docs/superpowers/`（用户已确认）、
   PLAN-035/PLAN-036 补登记（plans/index.md + todo 镜像 + 元数据补齐）、
   api-contracts.md 补登记已实现端点 `POST /api/v1/courses/{course_id}/confirm`。
6. 契约测试（tests/contract）与全量 pytest、ruff 全绿。

## 范围与非目标

**范围**：根 `AGENTS.md`、`docs/guides/development.md`、`docs/standards/doc-governance.md`、
`docs/standards/task-lifecycle.md`、`docs/plans/design-bugfix-log.md`（新建）、
`docs/adr/0012-ai-development-conduct.md`（新建）、`tests/contract/` 两处豁免清单、
遗留治理补登记（PLAN-035/036、api-contracts.md、plans/index.md、todo.md）。

**非目标**：不改动 `docs/architecture/` 其余固定文档正文（仅 api-contracts 补登记已实现端点，
属契约同步义务 REQ-046）；不改 web-ui 与后端行为代码；不改子项目文件。

## 前置条件

1. 用户已拍板三项决策（2026-09-10 对话）：superpowers/ 直接删除；遗留缺口一并治理；
   task-lifecycle 可随守则调整。
2. 契约基线已知：5 failed / 47 passed（遗留缺口所致），本轮回收至全绿。
3. 本轮自身按治理流程登记（本计划 + REQ-069 todo 行 + ADR 0012），即新守则首次实践。

## 工作项

1. 登记：本计划、todo REQ-069 行、ADR 0012、adr/index 登记。
2. AGENTS.md「变更分级与边界」节（指引+边界，细则指向 development.md）。
3. guides/development.md「AI 开发工作流程」节（六步模式细则）。
4. 新建 `docs/plans/design-bugfix-log.md`（长期滚动台账，头部声明豁免依据，种子条目
   BUGFIX-001 取自 superpowers 规格中的 course.description 显示修复）。
5. doc-governance.md：AGENTS/guides/plans 分类表行更新 + 「变更分级」小节 + 日期。
6. task-lifecycle.md：缺陷处理节补设计类小修/bug 台账路径 + 日期。
7. 治理测试：test_plan_governance.py 与 test_tracker_governance.py 豁免清单加
   design-bugfix-log.md。
8. 遗留治理：删除 `docs/superpowers/`；PLAN-036 重写为治理格式（补元数据与必需章节）；
   PLAN-035 状态 Draft→In Progress 并补必需章节；plans/index.md 与 todo 镜像补登记；
   api-contracts.md 补 `POST /api/v1/courses/{course_id}/confirm` 端点（领域探索门面
   五端点→六端点）。
9. 门禁与收尾：tests/contract + 全量 pytest + ruff；REQ-069 关闭归档（Retain）。

## 验证与验收

- `conda run -n QED_env python -m pytest tests/contract -q` 全绿（基线 5 failed 清零）。
- `conda run -n QED_env python -m pytest tests -q` 全量通过；`ruff check backend tests` 干净。
- 人工复核：AGENTS.md 边界表与 development.md 流程节语义完整；design-bugfix-log 头部
  豁免声明齐备；todo/plan/index 三方镜像一致。
- 用户对本轮产出（守则文本 + ADR）评审确认后转正（ADR 状态已按用户既定裁决记 Accepted）。

## 回滚

全部为文档与治理测试改动，无行为代码：`git checkout` 恢复已跟踪文件；新建文件
（design-bugfix-log.md、ADR 0012、本计划）直接删除；`docs/superpowers/` 删除不可逆
（用户已确认，工作成果已在代码与提交历史中）。

## 关闭与归档

关闭条件：成功标准 1-6 全部达成且门禁全绿。关闭结果记 Achieved；本计划按归档判定
Retain 移入 `../history/plans/2026-09/`，todo 移除 REQ-069 行并写入 completed.md，
plans/index.md 登记去处。
