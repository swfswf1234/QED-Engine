# 学习中心·知识点摘要写入通道（learn-outline-summary-channel）

状态：Completed
关闭结果：Achieved（行 S1~S4 逐条达成并留证；默认测试假库＋内存库双实现覆盖，真机 8900 冒烟含写回读一致与 422 守卫不脏数据）
任务类型：B
最后更新：2026-10-15
关联 ADR：`../../../adr/0022-task-chain-clarifications.md`（不扩载：新工作另登行另建壳）、`../../../adr/0023-todo-row-carries-scope-and-criteria.md`（判据正本在行、过程落壳）
关联设计：`../../../design/knowledge-point-exploration-ui.md`（设计正文正本，2026-10-15 晋升——本行影响其 §9/§10 的悬停与降级口径；七审过程稿＝`2026-10-11-learn-ui-knowledge-point-exploration.md`）、`../../../architecture/api-contracts.md`（学习域端点契约事实源）、`../../../architecture/database-design.md`（知识点主表字段事实源）
关联 Tracker：docs/trackers/todo.md（REQ-114 登记；消费方＝REQ-113 课程层重设计的悬停摘要）
归档判定：Retain（收口后本壳归档 history/plans/）

## 目标与成功标准

**目标**：把 8900 学习域的 **outline 行摘要写入通道补上**，让「大知识点／小知识点」两级都能有
一句话介绍可编辑、可直读——现表 `qed_knowledge_point.summary VARCHAR(1000)` 列已存在且读侧已透传，
但 outline 行写入侧被硬写空串、PATCH 白名单不含 `summary`，导致课程层虚框与条目的悬停提示
**只能显示名称**（REQ-113 的设计内降级行）。本行补的就是这一段：写入可给、读回可见。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-114` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：
1. `PUT /learn/courses/{course_id}/outline`：树节点新增**可选 `summary`**（≤1000 字符，
   超界 422）——`backend/qed_engine/api/learn.py:403-411` 的 `OutlineTreeBody` 与
   `_validate_outline_tree`（`:414-437`，节点是手工 dict 校验，长度须在此显式判）；
   服务层 `replace_outline`（`backend/qed_engine/services/learn/knowledge.py:495-555`）
   INSERT 分支把现写死的 `''`（`:527`）改为节点值，UPDATE 分支只在节点提交 `summary` 时写入
   （未提交保持原值，整树重写不得抹掉已写好的摘要）。
2. `PATCH /learn/knowledge-points/{kp_id}`：`PointPatchBody`（`api/learn.py:403-411`，`extra=forbid`）
   白名单补 `summary`（≤1000）；服务层 `update_point` 的 `sets` 白名单
   （`knowledge.py:579-592`）随之加分支。
3. 读侧回归：`GET /learn/courses/{id}/knowledge-points?include_outline=true` 的 outline 行带
   `summary`（序列化 `_point_out` 已透传全列，`_POINT_COLUMNS` 已含 `summary`，故本项是**断言补齐**
   而非新增字段）；`api-contracts.md` 学习域对应行同步。
4. 类型与契约文档：`web-ui/src/api/learn.ts` 的 `OutlineRow`（`:179-186`）补 `summary?: string`
   （前端消费归 REQ-113，本行只打通到类型层）；`database-design.md` 补一句「outline 行 `summary`
   可写（章／节级介绍），`type` 仍恒 NULL」。

**非目标**：**零迁移**（`summary` 列已在 DDL `knowledge.py:56`，只补读写语义）；不改
`qed_learn_kp_detail` 候选池与提升链路；不批量回填现网 95 行 outline 的摘要（属数据操作，
且内容生产未立项——通道落地后由用户另行发令）；不动 `order_hint` 的 NULL 口径（`confirm_detail`
仍写 NULL，REQ-113 用页序兜底）；不新增端点。

## 前置条件

1. 用户七审裁决（2026-10-15）第三项＝大知识点悬停信息「**先补后端 summary 通道**」，
   治理第四项＝另开新行新壳（用户选项文本为 REQ-112，该号已被并行窗口占用，实取 REQ-113／**REQ-114**）。
2. 缺口取证（只读检索）：outline 行 `summary` 恒 `''`、`type` 恒 NULL 源于
   `PUT /outline` 只收 `name/page_start/page_end/children`；真机 8900 `math_analysis` 96 行内
   outline 的 `summary` 填充率 0%。
3. DDL 语义已对齐七审读法：`node_kind` 列注释即「outline=目录节点(大知识点)／point=细知识点」
   （`knowledge.py:45`），本行不改 DDL 只开放写入。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 测试先行：`tests/test_learn_knowledge.py` 加三案——PUT 树带 `summary` 后读回一致、超 1000 字符 422、PATCH 改 `summary` 生效且未提交时整树重写不清空原值 | 已完成（2026-10-15，先红 5 failed 后绿；实落五案覆盖 S1×3＋S2＋S3） |
| W2 | 服务层：`replace_outline` INSERT/UPDATE 两分支的 `summary` 写入口径＋`patch_point` 白名单（MySQL 与内存两实现同改） | 已完成（2026-10-15） |
| W3 | API 层：`_validate_outline_tree` 长度校验（树节点是手工 dict，超限在此拦）与 `PointPatchBody` 补 `summary`（pydantic `max_length` 承载 422） | 已完成（2026-10-15） |
| W4 | 契约与类型同步：`api-contracts.md` 学习域三行（GET/PUT/PATCH）、`database-design.md` 一句口径、`web-ui/src/api/learn.ts` 的 PATCH body 类型（`OutlineRow` 经核已继承 `summary`，不需改） | 已完成（2026-10-15） |
| W5 | 回归与验收：定向 31 绿 → 全量 742 绿 → ruff 绿 → 契约 82 绿 → `tsc -b` exit=0 **已完成**；真机 8900 冒烟**待用户许可**（需重启 8900＋向运行库写一行摘要） | 已完成（2026-10-15，门禁＋真机 8900 冒烟均达成，见下条取证） |

## 过程与证据

- **2026-10-15 立项（七审第三项裁决的承接）**：用户裁「大知识点悬停信息＝先补后端 summary 通道」，
  故与设计口径改造（REQ-113）分成两行：本行是**数据通道**（B 类确定性实现），REQ-113 是**前端形态**。
  两行互为前置但不互相阻塞——REQ-113 在本行未落地时按设计稿 A §10 降级为「只显名称」，可独立验收。
- **2026-10-15 缺口定位（只读取证）**：`PointPatchBody`（`api/learn.py:403-411`）字段仅
  `parent_kp_id/name/order_hint`；`_validate_outline_tree`（`:414-437`）要求节点必含整数
  `page_start/page_end`，不读 `summary`；`replace_outline` INSERT 语句里 `summary` 位置写死 `''`
  （`services/learn/knowledge.py:527`）、UPDATE 分支 SET 列不含 `summary`（`:543-549`）；
  而读侧 `_POINT_COLUMNS`（`:98-102`）与 `_point_out`（`api/learn.py:505-509`）已把 `summary`
  原样带出——故**只需开写入面**，响应形状不变、零新增查询。
- **2026-10-15 八审裁决（本行范围确认，AskUserQuestion）**：**暂不做摘要录入面**——工作台目录确认
  面板 `web-ui/src/components/learning/TocConfirmPanel.tsx` 只提交 `name/page_start/page_end`，本轮
  不为其加摘要输入框，故本行判据与范围**一字不改**（录入面若将来立项另登行）；后果如实留痕＝
  现网 outline 行 `summary` 填充率 0%，REQ-113 悬停在本行落地后仍按设计稿 A §10「只显名称」降级，
  摘要内容生产（手填／批量生成）另议。**执行令**＝用户裁「先 REQ-114，再 REQ-113」并发令动码。
- **2026-10-15 授权状态**：八审前只落文档；八审发令后 W1~W5 开工（TDD 先红后绿）。
- **2026-10-15 W1 先红取证**：`tests/test_learn_knowledge.py` 追加五案（本行判据 S1×3、S2×1、S3×1）——
  `test_put_outline_writes_optional_summary`／`test_put_outline_rejects_over_long_summary`／
  `test_reimport_outline_keeps_unsubmitted_summary`／`test_patch_point_writes_summary_with_length_guard`／
  `test_course_points_with_outline_carry_summary`。改码前定向 `-k summary`＝**5 failed**
  （断言值＝`'' == '实数系的完备性，及其上极限运算的准备。'`，即写入面被硬写空串的现状）。
- **2026-10-15 W2~W3 实施**：`flatten_outline`（`services/learn/knowledge.py:147-173`）只在节点
  **显式提交** `summary` 时给展开行加该键（未提交＝无键，据此区分「保持原值」与「清空」）；
  MySQL `replace_outline` INSERT 的 `summary` 位由字面 `''` 改 `%(summary)s`（缺省 `node.get("summary", "")`），
  UPDATE 分支改按 `sets` 列表拼 SQL、仅当 `"summary" in node` 才进 SET；内存实现
  `knowledge_memory.py` 同口径（INSERT 字典取 `node.get("summary", "")`、重写后按键覆盖）；两库
  `patch_point` 白名单各加 `summary` 分支。API 层：`_validate_outline_tree` 增「`summary` 非字符串或
  >1000 字符 → 422」，`PointPatchBody` 补 `summary: str | None = Field(default=None, max_length=1000)`
  （超限由 pydantic 直接 422，与既有 `name` 的 min_length 同一条通道）。
- **2026-10-15 W4 契约与类型同步**：`api-contracts.md` 学习域三行改口径——`GET .../../../outline` 行内
  列清单补 `summary`、`PUT .../../../outline` 树节点形状改 `{name,page_start,page_end,summary?,children?}`
  并写明「未提交该键保持原值、显式空串才清空」＋422 原因补 `summary` 超 1000、
  `PATCH /learn/knowledge-points/{kp_id}` 白名单改 `{parent_kp_id,name,order_hint,summary}`；
  `database-design.md`「qed_knowledge_point」消费要点段补 `summary` 写入通道一句（outline 与 point 行
  都可写、学习面悬停只读这一列）。**类型层如实修正**：本壳原写「`OutlineRow` 补 `summary?: string`」，
  实际 `OutlineRow extends KnowledgePoint`、`KnowledgePoint.summary: string`（`web-ui/src/api/learn.ts:64`）
  早已在位，故本行真正缺的前端类型只有 `patchKnowledgePoint` 的 body——已补 `summary?: string`。
  零新增字段、零新查询（S3 的键集合断言＝outline 行与 point 行同形状，已通过）。
- **2026-10-15 W5 门禁取证**：`tests/test_learn_knowledge.py` 定向 **31 passed**（26 存量＋5 新增）→
  根侧全量 `pytest tests` **742 passed**（737＋5）→ `ruff check backend tests` **All checks passed** →
  契约门禁 `pytest tests/contract` **82 passed**；前端 `npx tsc -b` **exit=0**（只改 body 类型，无消费方）。
  **真机 8900 冒烟未做＝等用户许可**：8900 不热重载（旧进程仍在跑改动前代码），冒烟需重启 8900 并
  向运行库 `qed_test` 写一行 outline 摘要，属「重启共享服务＋写真实库」两类需逐次批准的动作；
  批准后动作＝`PATCH` 一行 outline 写摘要 → `GET .../../../knowledge-points?include_outline=true` 读回该值。
  默认测试面已覆盖同一判据（假库＋内存库双实现），真机只补「运行库读写通路」这一层。

- **2026-10-15 W5 真机 8900 冒烟（用户批准后执行）**：动作＝`POST /api/v1/self-restart` 重启 8900
  （旧进程跑改动前代码，不热重载）→ 以 openapi 的 `PointPatchBody` 属性含 `summary` 确认新进程在位
  → `PATCH /api/v1/learn/knowledge-points/kp-260957176289`（第1章 实数系和复数系，outline depth1）
  写 48 字摘要 → `GET .../../../knowledge-points?include_outline=true` 读回**逐字一致**（响应 96 行不变、
  仅该行 `summary` 由 `''` 变值）。**超限守卫真机复验**：同一行再 PATCH 1001 字符 →
  **HTTP 422**，`detail[0] = {type: string_too_long, loc: [body, summary]}`，且读回值仍为原 48 字
  （失败写不脏数据）。**目视验收（本行「验证与验收」末条）**：8903 课程层悬停第1章虚框名称带 →
  提示为「第1章 实数系和复数系」＋该摘要行，即 REQ-113 §10 的「有摘要才补摘要行」通路打通；
  现网另有 1 条 point 行（`kp-143c7992e77a` 收敛序列）本就带候选摘要，同批读回确认。
  写入值为本次冒烟留下的一行真实内容，回退已按 2026-10-15 用户裁决执行＝同一端点 PATCH `{"summary": ""}`（显式空串才清空），返 200、库侧 `LENGTH(summary)` 回 0，全库仅 2026-10-05 detail 导入行「收敛序列」仍带真实摘要。
  本行 S1~S4 逐条达成，待与 REQ-104／110／113 同批晋升 design/ 后收口。

- **2026-10-15 收口批（四行合一份晋升）**：本行不改设计形态，只把设计稿 A（现晋升为 `../../../design/knowledge-point-exploration-ui.md`）§9/§10 的「框与条目悬停带摘要」从设计内降级变为有数据通路。行判据逐条对照：S1 `PUT /outline` 节点可选 `summary`（≤1000）与 `PATCH` 白名单补该字段，落库读回一致（超 1000 → 422 `string_too_long`，真机同一行复验且原值未被脏写）；S2 未提交该键时整树重写保持原值、显式空串才清空（`test_reimport_outline_keeps_unsubmitted_summary`）；S3 读侧 `include_outline=true` 的 outline 行带 `summary` 且 `api-contracts.md` 三行／`database-design.md` 口径同步，响应形状与查询数不变；S4 门禁＝定向 31 passed、根侧全量 742 passed、ruff 全绿、契约全绿、`tsc -b` exit=0，真机冒烟另证 8903 课程层悬停第1章虚框出「名称＋48 字摘要」。运行库遗留＝`qed_test` 内一行 outline `summary`（`kp-260957176289`）是本次冒烟写入的真实内容，回退＝同一端点 PATCH `{"summary": ""}`。本壳 Retain 归档 ``。

## 验证与验收

- 行判据逐条对照 `REQ-114` 行「成功标准」列。
- S1 由 W1 三案覆盖（写入→读回、超界 422、不抹原值）；默认测试不触网、用临时库与假外部依赖
  （测试门禁规则见 `docs/standards/testing.md`）。
- S2 以 `include_outline=true` 响应的 outline 行断言 `summary` 等于写入值取证。
- S3 以 `api-contracts.md`／`database-design.md` 相应行与 `tests/contract` 全绿为准。
- 人工验收点：真机 8900 上给一行 outline 写摘要后，8903 课程层悬停可见（该目视验收随 REQ-113
  一并做，本行只保证端点侧读回一致）。

## 回滚

回滚＝`PointPatchBody`/`OutlineTreeBody` 去掉 `summary` 字段、`replace_outline` 与 `update_point`
恢复原 SET 列；DDL 无变更故不需回滚；文档随之回退。已写入的摘要值留在表内不影响旧行为
（旧代码不读该列的 outline 值）。

## 关闭与归档

关闭条件：W1~W5 全部达成且 `REQ-114` 行「成功标准」列逐条对照留证后，本壳按 `qed-closeout`
收口（Retain 归档 `history/plans/2026-10/`），该行移入 completed.md。
