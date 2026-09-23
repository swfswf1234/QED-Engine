# ADR 0017：设计文档结构契约与事实源唯一铁律

状态：Accepted
日期：2026-09-23
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

design/ 六篇已确认文档（admin-console、admin-dashboard、downloads-flow、downloads-ui、
parsing-ui、parsing-flow）三要素覆盖不齐：仅 admin-dashboard 有「目标与成功标准」与
「范围与非目标」；章节编号三种风格并存（无编号 / 中文数字 / 阿拉伯数字）；定位语以
blockquote、专节或两者并存三种形态。同时存在**契约事实源二次维护**：parsing-flow §5 维护
`af_*` 全量 DDL 快照（结构事实源应为 Axiom-Flow database-design.md 与其 Alembic 迁移）、
§6 维护 8902 端点表（契约事实源应为 Axiom-Flow api.md；8900 面向前端的端点表事实源为
api-contracts.md §④）、parsing-ui §4 维护 14 行端点映射表、admin-console 与 admin-dashboard
各维护「API 链路」整表。双份维护已产生实际漂移（database-design 与 api-contracts 的指针
在两份事实源间摇摆）。触发事件：2026-09-23 解析管理文档族确定性梳理（BUGFIX-016）后，
用户裁决 parsing-flow 不含 API/数据库设计（该类内容属 architecture/），并要求六篇按统一
规范梳理。

## 决定

1. **design/ 模块设计文档统一骨架**（正文节名与顺序固定，规则正文落 doc-governance.md）：
   §1 定位与目标（是什么/为谁/解决什么 + 成功标准；「背景」与「定位」并入，不再
   blockquote 与专节并存）→ §2 范围与非目标（本档不管什么，逐条给事实源改指指针）→
   §3..N 设计本体（按设计对象自定：信息架构/状态机/数据流/交互/产物 schema…）→
   状态与降级矩阵（UI 与 flow 文档必备）→ 已知约束与维护规则（可合并置尾）。
   章节编号统一阿拉伯数字（`## 1. …`）；头部元数据契约不变（test_design_documents.py 护）。
2. **事实源唯一铁律**：design 文档可陈述**消费语义**（哪个动作调哪个端点、超时/轮询节奏、
   状态判据），但**不得复制维护端点表、DDL 或字段级契约**；契约形状事实源唯一——根侧
   surface 归 `architecture/api-contracts.md` / `architecture/database-design.md`，子项目侧
   归其仓库文档，design 文档一律指针代替复制。本铁律是既有头部「不重复登记」惯例的
   正文规则化。
3. **存量六篇执行适用**（2026-09-23 用户四裁决）：parsing-flow §5/§6 删除且根侧引用指针
   改指（不搬入根 architecture/ 二次维护）；铁律六篇全执行（含 parsing-ui §4、admin 两篇
   API 链路表压缩为消费要点）；梳理力度＝补缺+统一编号，设计本体内容不重排；规范正文
   落 doc-governance.md 并先立本 ADR。

考虑过的替代方案与排除原因：①端点表/DDL 搬进根 architecture/ 承接——排除，根内仍与
Axiom-Flow 双份，漂移复发，且 architecture/ 对 af_*/8902 的正确形态已是「登记清单+指针」
（REQ-047 部分置空裁决）；②规范只写 design/index.md 治理说明——排除，属标准级强制规则，
不进 standards/ 即无约束力，与 REQ-062 晋升体系相悖，standards/ 实质规则变更按变更分级
须先立 ADR；③只定规范不动存量——排除，六篇恰是漂移重灾区，双标并存令读者无所适从；
④六篇全量重排对齐 admin-dashboard——排除，该篇自身「目标与成功标准」与「一、定位」
重复，全量重写成本高、易引入内容损失，故采最小改动（补缺+统一编号）。

## 后果

- **正面**：看到任一篇 design 文档即知「这是什么设计、目标是什么、边界在哪」；契约形状
  单点维护，跨仓漂移消除；design/architecture 分工与 AGENTS 变更分级表（architecture=
  API/数据库设计）重新对齐。
- **负面/代价**：六篇各有一次结构性改动（已确认文档，经本 ADR + PLAN-053 评审承接）；
  DDL/端点表从根仓库文档消失后，查形状需跨仓（以指针与 REQ-047 清单导航）。
- **中性**：plans/ 壳、completed.md 与 history/ 中的历史引用保留原文不改（历史资料不能
  覆盖当前实现）；未来若需机器强制骨架（契约测试断言节名），另议，本 ADR 不强制。

## 关联

- PLAN-053 计划壳（Achieved 2026-09-24 按归档判定 Delete 移除——todo「设计文档结构契约轮
  （ARCH-029）」行与 W1~W9 执行记录见 [completed.md](../trackers/completed.md) ARCH-029 行）；
- [文档治理规范](../standards/doc-governance.md)「设计文档结构契约」节（本决策正文落点）；
- [ADR 0014](0014-parsing-ownership-and-model-boundary.md)（解析能力归属——parsing-flow
  删除的两节内容按其边界归 Axiom-Flow 事实源）；[ADR 0016](0016-todo-registration-one-task-one-plan.md)（本轮登记方式）；
- 验收：doc-governance 新节存在；六篇 §1/§2 骨架齐备且阿拉伯编号；全仓 `af_*` DDL 与
  8902 端点表无二次维护、parsing-flow §5/§6 引用清零（history/ 与 completed.md 除外）；
  根契约门禁全绿（并行会话归因红项除外）。
