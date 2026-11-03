# 知识点四分类生产与搬运链・质性门可生效（kp-type-production-and-carry-chain）

状态：Accepted
任务类型：B
最后更新：2026-11-03
关联 ADR：[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（B 类壳首工作项 demo 门）、
[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（判据正本在台账行、过程落本壳）、
[ADR 0026](../adr/0026-v1-root-table-family-freeze.md)（表族冻结：本行零新列零 DDL 的约束来源）、
[ADR 0029](../adr/0029-tracker-round-hierarchy-and-row-scope-cap.md)（本行＝知识点梳理模块的细则行，
登记在默认承载轮并回指模块总任务行 REQ-151）
关联设计：[database-design.md](../architecture/database-design.md) §五 `qed_knowledge_point.type`、
[api-contracts.md](../architecture/api-contracts.md) §④ 透传面与 §⑥ 学习面、
[cross-project-contracts.md](../design/cross-project-contracts.md) §6 提升腿口径、
[learning-course-ui.md](../design/frontend/learning-course-ui.md)（门的消费面）
关联 Tracker：docs/trackers/todo.md（REQ-152 任务行登记在普通任务轮（ARCH-035）节的知识点梳理模块
子分组；分线归属＝ARCH-025-L2；模块总任务行＝REQ-151）
归档判定：Retain（「`type` 无生产者」这一断链的取证与两侧改法的取舍，是任何后续掌握度判据工作的
前置事实；质性门为何对现网 82 枚点行永不生效的读数不可再生）

> **用户 2026-11-03 裁决（本行立项出处）**：知识点梳理全链审计的 F1-2 项「`type` 四分类断链」，
> 令文＝**「F1-2 允许修改」**。审计发现原文与文件行号见
> [REQ-151 模块总任务壳](2026-11-03-kp-curation-module-master-task.md) 的「现网取证」表 F1-2 行。
> 本行的**唯一目的**＝让「知识点属于哪一类」这件事在库里有值、并让已经写好的质性门真的能被读到。

## 目标与成功标准

**目标**＝知识点四分类（`memory`／`procedure`／`concept`／`design`）从「提示词里要求、回包里带着、
落库前被丢掉」变成一条贯通的生产与搬运链：生成腿产出它、提升腿带上它、掌握度门按它取门阈——
概念与设计类知识点第一次能走 Feynman 质性门，而不是全部按量化 0.9 过关。

条目化判据正本在台账行（ADR 0023）；行内 S1~S5 与本壳工作项的对应＝S1→W2、S2→W3、S3→W4、
S4→W5、S5→W1（demo 门）＋门禁。

## 范围与非目标

**范围内**：

- **生产腿（Axiom-Flow 侧）**＝内容批次（`stage:'content'`）回包草稿携带的 `type` 不再随「不再新建
  点行」一并丢弃；判据形态＝`content_only` 只撤**建行**，不撤**已有行的分类键回填**（与同批 `summary`
  写回 `set_outline_summary` 走同一条腿、同一条容错）；
- **搬运腿（根侧提升）**＝`_sync_book_knowledge` 写点行的字段集补 `type`，值域按主表闭集校验，
  闭集外**不写**（保持 null）而不是整批失败；零 DDL、不动逐列正本与列常量；
- **门的消费**＝已有 `gate_threshold`／`assess_refusal` 判据一字不动，本行只让它们的输入有值；
- **人工值优先**＝人工已改过分类的行不被机器覆写（只缺才补），与 REQ-148 确认位「只升不降」同一取向。

**非目标（各给指针）**：

- 提示词是否要重新教育模型产出更好的分类＝后置，本行只搬运已产出的值；
- 知识点级「合并梳理」＝REQ-145；确认位与「已整理」措辞＝REQ-148；习题不入序列＝REQ-149；
- 章级要点与内容面补齐＝REQ-150；屏上分类展示已有形态（W27 四值标签，REQ-143）零改；
- 本行不请求新列、新端点、不改 `patch_point` 白名单之外的任何写面。

## 现网取证（2026-11-03，只读）

| 读数 | 值 |
| --- | --- |
| AF 丢弃点 | `Axiom-Flow/src/axiom_flow/orchestrator/knowledge.py:1471-1472`——`if content_only: continue`，被丢弃的 `replied.drafts` 含模型回包的 `type` |
| 根侧提升字段集 | `backend/qed_engine/api/learn.py:1362-1368`——`parent_kp_id`／`order_hint`／`source_ref`／`anchors`，**无 `type`、无 `narrative_ref`** |
| 章行落库形状 | `backend/qed_engine/services/learn/knowledge.py:386+` 的 `replace_outline` 写入 `type NULL` |
| 门的判据 | `backend/qed_engine/services/learn/mastery.py:25-26,36,48`——`QUALITATIVE_TYPES={concept,design}`，`gate_threshold` 对 null 回落 `QUANTITATIVE_DEFAULT=0.9`，`assess_refusal` 对非 {concept,design} 拒质性自评 |
| 库侧后果 | 共享主表 82 枚点行 `type` 全 null ⇒ 质性门对现网每一枚知识点都不可达，全部按 0.9 量化门走 |

## 前置条件

1. **改码授权**＝用户 2026-11-03 令「F1-2 允许修改」，覆盖 Axiom-Flow 侧生产腿；该仓 git 提交与
   推送仍归对方窗口（项目总纲），本会话只在其未提交基线上**只加不改其行**并出逐文件清单。
2. **表族冻结**＝`type` 列已在册（ADR 0026 D5 之前既有），本行零 ALTER、零 DDL、不动逐列正本。
3. **两侧契约同批**＝若 AF 回包新增可读键，`api-contracts.md` §④ 与 `cross-project-contracts.md` §6
   随步，两侧测试同批改（不同批即红）。
4. **并行行**＝REQ-148 的 `confirm_state` 与本行在提升腿**不同字段**（本行只加 `type`），但同处
   `_sync_book_knowledge` 的字段集构造段，改动须串行、逐字段对拍。
5. **重启窗口**＝8900 不热重载，新字段要重启才出；与 REQ-147／148 的 `truncated`／`kp_total` 共窗，
   重启归人工批准。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | **demo 门＝一枚点行的分类从模型回包走到质性门**（ADR 0024 决定 2）：临时库内造/取一枚 `type='concept'` 的点行 → 提升后主表该值非空 → 质性自评端点对该点**不再 409** 且门阈按质性取 → 反例一枚 `type=null` 仍按量化 0.9；到门暂停待人工验收 | 未开始 |
| W2 | **生产腿（AF）**：`content_only` 分支保留草稿的 `type` 并回填到该节在册行，与同批 `summary` 写回同一条路径；回归用例先红（现形＝回包带 `type` 而库里仍 null），后绿；`KA` 条文随步 | 未开始 |
| W3 | **搬运腿（根侧）**：`_sync_book_knowledge` 点行字段集补 `type`，闭集外不写不炸；`replace_outline` 的章行 `type` 口径保持 null（章不参与门）；用例先红后绿 | 未开始 |
| W4 | **门的读数用例**：`type∈{concept,design}` 走质性门、`memory`／`procedure`／null 走量化 0.9 各一枚；`assess_refusal` 现有判据零改，只补「有值输入」那一侧的用例 | 未开始 |
| W5 | **现网对拍**：b05 一轮提升后主表点行 `type` 非空率按枚可读（只读取证脚本落 `tmp/`），零清洗脚本、存量不回填；读数记入本壳「过程与证据」 | 未开始 |
| W6 | **正本随步**：`database-design.md` 的 `type` 列语义句（「值由生成腿产出、提升腿搬运、无生产者」改判为生产者在册）、`api-contracts.md` §④／§⑥ 与 `cross-project-contracts.md` §6、`code-map.md` 映射行、对方 PLAN-026 同日行 | 未开始 |

## 过程与证据

- 2026-11-03｜立项（用户令「F1-2 允许修改」）：审计取证四条落本壳「现网取证」表；判据正本在台账
  REQ-152 行的成功标准列，本壳只承接拆解。归属随 [ADR 0029](../adr/0029-tracker-round-hierarchy-and-row-scope-cap.md)
  L2 落默认承载轮（普通任务轮节），并回指模块总任务行 REQ-151。
- 2026-11-03｜（待执行）W2／W3 两侧改法的逐文件清单、先红输出与门禁数字在此追加。

## 验证与验收

- AF 侧：`D:/software/anaconda3/envs/QED_env/python.exe -m pytest tests -q` ＋
  `ruff check src tests scripts`（先红后绿，`type` 回填用例覆盖 `content_only` 分支）；
- 根侧：`pytest tests/test_learn_knowledge.py tests/test_api.py -q` 定向先红后绿，收尾跑 `pytest tests -q`
  ＋ `pytest tests/contract -q` ＋ `ruff check backend tests`；
- 门：`pytest tests/test_learn_mastery.py -q` 零回归（本行不改其判据，只喂有值的输入）；
- 真机：demo 门（W1）到门暂停；8903 分类标签读数与改前一致（W27 形态零改）；
- 表族守护：`qed_knowledge_point` 逐列与 DDL 围栏逐字对齐守护保持绿（本行零 ALTER）。

## 回滚

- 三条独立退路：W3 搬运腿 revert 即回「不写 `type`」（列已存在、null 无害）；W2 生产腿 revert 即回
  「草稿整批丢弃」；W4/W6 属判据与文档，revert 即可；
- 不做数据清洗、不回填存量，故无数据回滚面；已带值的点行如需回退，人工经 `PATCH` 白名单改回 null
  属既有通路，本行不新开口子；
- 门阈行为随输入自然回退（null ⇒ 量化 0.9），无需额外开关。

## 关闭与归档

S1~S5 逐条对照台账行关闭（ADR 0023）；**AF 侧提交与推送归对方窗口**，本行关闭判据是「其未提交基线
上的改动清单＋其门禁输出＋两侧契约随步」三件齐，不以本仓提交为凭。存量点行的分类值随后续批次自然
带上，**「回填覆盖率」不入本行关闭前置**。归档判定 Retain。
