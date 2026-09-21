# design/ 文档整合轮（design-docs-consolidation）

状态：Completed
任务类型：B
（任务类型注记：B 确定性实现——整理判据来自 doc-governance 既有条款，范围与去向已由用户
2026-09-21 四问四裁确认，无 C 类实验内容）
最后更新：2026-09-21
关联 ADR：[ADR 0011](../../../history/adr/v0.1/0011-pending-design-location.md)（待评审设计留 plans/——W4 迁移依据）、[ADR 0010](../../../history/adr/v0.1/0010-documentation-versioning.md)（文档三层与版本机制）
关联设计：本计划即对 [design/ 目录](../../../design/index.md) 各文档的整理，判据正文见 [doc-governance](../../../standards/doc-governance.md)（唯一事实源、归档条款）与 [design/index](../../../design/index.md)「时效性编排不在 design/」注记
关联 Tracker：docs/trackers/todo.md（PLAN-047 登记；REQ-002/REQ-050 文档治理长期任务口径承接）
归档判定：Retain（重写原则与逐文档剥离清单有追溯价值，关闭后壳归档 history/plans/2026-09/）

## 背景与用户裁决（2026-09-21）

UI 侧（解析工作台单屏左树+右对照、控制台五字段卡）与模型侧（注册表三接口）定档后，
design/ 文档堆积了大量轮次修订记录、裁决叙事、冒烟证据与计划壳活引用，已呈"过程文档"形态
（parsing-ui.md 与 llm-gateway.md 约三分之一篇幅为过程内容；admin-console.md 出现「四区」残留
与「三区」标题自相矛盾）。用户裁决四项：① 范围＝重点四份 + UI 关联 + 轻症顺带扫；
② 过程内容彻底删除，design 文档文末仅留一行「关联计划」溯源链接，历史靠 git log 与
history/plans/ 壳追溯；③ document-chunking-recall.md（Draft 驻 design/ 违 ADR 0011）移回 plans/；
④ 前置：PLAN-046 收口批次先提交（已于 5dc2d0d / e1f73b9 完成）。

## 重写原则（设计态判据）

- **保留**：元数据头（设计/实现/确认状态照实）＋定位与分工＋契约本体（布局、组件树、store、
  端点映射、状态机、目录契约、强制规则、降级矩阵）。
- **删除**：头部修订 blockquote 与晋升注记；「背景与演进 / 设计来源与演进」整节；正文内嵌
  轮次标签（v2/v3/X 轮/PLAN-xxx 叙事）与裁决日期注——除非该日期本身构成当前契约事实
  （如「端口 5002」「2026-09-20 建表」照写，不讲迁移史）；改造清单/实况记账/冒烟证据/
  验收口径/回滚节；划线退役行与 ✅ 缺口追踪表（任务追踪归 todo）。
- **迁移**：仍有前瞻价值的内容外迁——增强候补清单→roadmap 或 todo 证据列；被取代形态说明
  一律删除（history/plans/ 已承载）。
- **唯一事实源**：端点契约以 api-contracts.md 为准、身份目录以 registry 与其主设计为准，
  其余文档只链接不复制。
- 文体范本：tech-stack.md（只保存结论与理由，过程不驻正文）。

## 目标与成功标准

1. design/ 全部文档去除过程化内容，成为"描述系统应当是什么样"的设计文档；W5 终检 grep
   过程关键词（修订 blockquote/轮次标签/演进节/冒烟证据）零非法命中。
2. 修复三处状态自相矛盾（design/index vs parsing-ui 实现状态、admin-console 四区/三区、
   chunking-recall 目录归属）。
3. 契约测试全绿（链接零断、计划镜像、治理枚举），后端全量 500 与 ruff 不受影响。
4. 重写后 parsing-ui.md / admin-console.md 与 web-ui 现实现逐点一致，不新增设计声明。

## 范围与非目标

- **范围**：docs/design/ 13 份文档的正文整理与 design/index.md；document-chunking-recall.md
  移至 docs/plans/；todo/roadmap/plans index 的连带引用；parsing-ui §14 增强清单外迁。
- **非目标**：不改代码与 web-ui；不动 architecture/ 固定文档（code-map L34、api-contracts
  三处过程句留待后续文档治理轮，仅当契约测试牵连时做链接级最小修）；不新增端点/状态机/
  交互设计；不批量变更各文档「确认状态」（晋升「已确认」由用户在终验时另行裁决）。

## 前置条件

- W0 收口批次提交完成（已达成：5dc2d0d、e1f73b9，工作区干净）。
- 本壳与 todo 镜像行建立、契约绿。

## 工作项

| # | 工作项 | 产物 | 状态 |
| --- | --- | --- | --- |
| W0 | 前置提交 PLAN-046 收口批次（两笔） | 5dc2d0d / e1f73b9 | 已完成（2026-09-21） |
| W1 | 立项：本壳 + todo PLAN-047 镜像节 + plans/index 活跃条目 | 三处登记 + 契约绿 | 已完成（2026-09-21） |
| W2 | 重点四份设计态重写：parsing-ui、admin-console、llm-gateway、local-model-management | 四份正文 + 逐份契约复跑 | 已完成（2026-09-21） |
| W3 | UI 关联整理：downloads-flow、downloads-ui、dataset-conventions；轻扫 project-configuration、service-hosting、admin-dashboard、cross-project-contracts | 七份修订 | 已完成（2026-09-21） |
| W4 | document-chunking-recall.md 移回 plans/（git mv + 状态字段按镜像规则定）+ 全库引用改链 + 两 index 调整 | 迁移 + 扫面 | 已完成（2026-09-21，壳设 Blocked 挂 todo REQ-082 镜像行） |
| W5 | design/index.md 一致性修正（三处矛盾）+ 全目录过程关键词终检 | 索引刷新 + grep 输出 | 已完成（2026-09-21，终检四命中均已剥离或判合法） |
| W6 | 门禁 + 收尾：全量测试、壳关闭归档、completed 登记、确认状态裁决征询 | 收口记录 | 已完成（2026-09-21：契约 63 + 全量 500 + ruff 全绿；用户终验裁决 design/ 全部文档晋升「已确认」） |

## 验证与验收

- 每份改写后：`D:/software/anaconda3/envs/QED_env/python.exe -m pytest tests/contract -q`。
- 终检：`pytest tests -q`（500）+ `ruff check backend tests` + `rg` 过程关键词零命中清单展示。
- 抽查：重写后的布局/交互/契约描述与 `web-ui/src/pages/Parsing.tsx`、Console 槽位卡及
  `services/llm/registry.py` 实际行为一致（读码比对，不跑浏览器）。
- 用户验收：确认剥离尺度与是否晋升「已确认」。

## 回滚

纯文档轮，逐 W 段 git commit 隔离（每段一批，经用户批准提交）；任一段验收不过即 revert
该段提交，无数据与代码副作用。

## 关闭与归档

W6 完成且用户确认后：设计事实无新增（本为整理），壳按 Retain 移 history/plans/2026-09/，
todo 镜像行移除并写入 completed.md（Achieved），刷新 project-status.md 与 design/index.md
状态行。
