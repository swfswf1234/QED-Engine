# 课程探索 API 契约（ARCH-019·正式文档格式草案）

状态：Accepted
任务类型：B
最后更新：2026-08-23
关联 ADR：[ADR 0011](../adr/0011-pending-design-location.md)（本文档为待评审契约草案）、[ADR 0009](../adr/0009-shared-qed-tables.md)（共享表写入权）
关联设计：[service-contracts.md](../design/service-contracts.md)（对接规范）、
[exploration-ui 计划](2026-08-arch019-exploration-ui.md)（消费方）、QED-Tracker `docs/architecture/api.md`（端点落位后由对方同步）
关联 Tracker：docs/trackers/todo.md（主线 ARCH-019；本计划行 PLAN-021；支线 REQ-055、REQ-056）
归档判定：Delete 倾向（确定后并入 architecture/api-contracts.md 数据透传·Tracker 章，计划壳删除）

## 目标与成功标准

为课程下载轮产出**可冻结的探索 API 契约**：课程层探索（发起/轮询/采纳/放弃/历史）与全局层
体系变更（提议/应用）+ 手工维护端点，全部按正式 API 文档要素（方法、输入、输出、范例、错误
码）编写并标注确定度。成功标准：用户评审消解全部【待定】项完成契约冻结；QED-Tracker 按契约
实现并通过其门禁；8900 透传与前端消费联调通过。

## 范围与非目标

- 范围：§0 通用约定 + §1~8 端点契约 + 工作项编排。
- 非目标：LLM 提示词与检索质量（C 类实验，归 QED-Tracker 内部设计）；前端界面（见
  [exploration-ui 计划](2026-08-arch019-exploration-ui.md)）。

## 前置条件

- 用户对本契约的评审确认；QED-Tracker 侧接受请求（REQ-055/056 承接登记）。

> 用户评审通过后转 In Progress。徽记约定：**【确定】** = 本轮已与用户对齐、可直接实现；**【待定】** = 实现前需补充裁决。
> 执行边界：本组端点全部落在 QED-Tracker（8901）——LLM 探索业务归其接口类型③；
> QED-Engine 后端（8900）同路径纯透传；前端只连 8900。

## 0. 通用约定【确定】

- Base URL（前端视角）：`http://127.0.0.1:8900/api/v1`；8900 对下文全部端点**同路径透明转发**
  至 `QED_TRACKER_URL`，不改写请求/响应体。
- 内容类型：`application/json`（UTF-8）；鉴权：无（本机个人部署）。
- 错误响应统一结构：

```json
{ "detail": { "code": "CAPACITY_REACHED", "message": "该课程已有 4 个教程，达到上限" } }
```

- 错误码总表：

| HTTP | code | 语义 |
| --- | --- | --- |
| 400 | INVALID_PARAMS | 参数缺失/非法（含 ref_doc_path 不可读） |
| 404 | COURSE_NOT_FOUND / RUN_NOT_FOUND / DOMAIN_NOT_FOUND | 课程、运行记录或领域不存在 |
| 409 | CAPACITY_REACHED | 教程总数已达 4，拒绝新建探索或采纳 |
| 409 | COURSE_LOCKED | 该课 ≥2 套已审核完成，停止自动加入新教程 |
| 409 | RUN_STATE_CONFLICT | 运行非 ready 态却请求采纳/放弃等非法迁移 |
| 409 | RUN_ALREADY_RUNNING | 同对象已有 running 运行（幂等返回既有 run 时不用此码） |
| 409 | DOMAIN_NAME_CONFLICT | 新建领域探索应用时领域名已存在且非本次创建目标 |
| 503 | LLM_UNAVAILABLE | LLM 网关不可达或调用失败（可重试） |

- **探索参考文档规范位置【确定】**：`<QED_DATA_ROOT>/tmp/exploration/<对象名>探索.txt`
  （如 `dataset/tmp/exploration/高等数学探索.txt`）；存量范例（原 `QED-Tracker\tmp\*.txt`）
  已由根仓库迁入该位置。mode=doc 的 `ref_doc_path` 接受任意服务端可读绝对路径，规范位置
  仅作为界面默认提示与用户约定。

## 1. POST /api/v1/courses/{course_id}/explore —— 发起课程层探索【确定】

创建一次「为本课程检索最合适教程」的异步任务；服务端先执行上限校验再入队。

**输入**

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| course_id | path | string | 是 | 课程标识（如 `01_math_analysis`） |
| mode | body | string | 是 | `direct` 直接开始 / `text` 粘贴参考文本 / `doc` 指定文本文档路径 |
| ref_text | body | string | mode=text 时必填 | 选书偏好/范例说明文本（≤10000 字符） |
| ref_doc_path | body | string | mode=doc 时必填 | 服务端可读的文本文档绝对路径 |

请求范例：

```json
{ "mode": "text", "ref_text": "优先美版经典教材的中译本，配套习题集成套推荐" }
```

**输出**（202 Accepted）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| run_id | string | 探索运行记录 ID（后续查询/采纳凭据） |
| task_id | string | 8901 内部任务 ID（复用既有 tasks 机制） |
| status | string | 初始恒为 `running` |

响应范例：

```json
{ "run_id": "exp_9f31c2", "task_id": "tk_5b20a1", "status": "running" }
```

- 校验顺序：404 课程存在性 → 409 CAPACITY_REACHED（现有教程数 ≥4）→ 409 COURSE_LOCKED
  （已完成 ≥2 套）→ 入队。
- **同课程并发运行约束【确定】**：已存在 running 运行时**幂等返回既有 run_id**
  （响应附 `"deduplicated": true` 标记），不报错、不重复入队。
- LLM 调用由 QED-Tracker 自持（其 `.env API_KEY`），调用记录写 `qed_llm_calls`
  （service=`qed_tracker`）【确定】。

## 2. GET /api/v1/explore-runs/{run_id} —— 运行详情（轮询）【确定】

**输入**：`run_id`（path）。

**输出字段表**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| run_id / scope / course_id | string | 标识；scope 恒 `course` |
| status | string | `running / ready / adopted / discarded / failed` |
| params | object | `{mode, ref_text?, ref_doc_path?}` 参数快照 |
| proposals | array | 推荐（含待选）列表，结构见下方 Proposal |
| adopted_proposal_ids | array[string] | 已采纳 proposal_id |
| error | object\|null | `{code, message}`（failed 时） |
| created_at / updated_at | datetime | ISO 8601 |

**Proposal 结构**（字段与 qt_knowledge 的 textbook_ref/exercise_ref/intro 对齐，采纳即可落库）：

```json
{
  "proposal_id": "pp_a1b2c3",
  "set_name": "套一",
  "textbook": {
    "title": "Principles of Mathematical Analysis",
    "authors": ["Walter Rudin"],
    "version": { "edition": "中译本", "publisher": "机械工业出版社", "year": 2004 },
    "intro": "以度量空间上的分析为主线……"
  },
  "exercise": {
    "title": "吉米多维奇数学分析习题集",
    "version": { "edition": "", "publisher": "", "year": null },
    "intro": "……"
  },
  "reason": "顶尖名校数学系指定教材，中译本详尽便于自学"
}
```

响应范例（ready 态，节选）：

```json
{
  "run_id": "exp_9f31c2", "scope": "course", "course_id": "01_math_analysis",
  "status": "ready",
  "params": { "mode": "text", "ref_text": "优先美版经典教材…" },
  "proposals": [ { "proposal_id": "pp_a1b2c3", "set_name": "套一", "…": "…" } ],
  "adopted_proposal_ids": [], "error": null,
  "created_at": "2026-08-23T10:00:00", "updated_at": "2026-08-23T10:01:12"
}
```

- **进度中间档上报【确定】**：本轮不做，running 态仅状态轮转；阶段百分比依赖
  REQ-017②（长任务进度机制）落地后的后续轮扩展。

## 3. POST /api/v1/explore-runs/{run_id}/adopt —— 采纳所选【确定】

为勾选的每个 proposal 创建 draft `qt_knowledge` 行（kind=tutorial，含两段简介与决定引用），
运行态转 `adopted`。

**输入**

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| selected | body | array[string] | 是（≥1） | proposal_id 列表 |

请求范例：

```json
{ "selected": ["pp_a1b2c3"] }
```

**输出**（200）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| adopted | array | `[{knowledge_id, set_name}]` 新建教程行 |
| remaining_slots | int | 该课剩余可增教程数（4 − 现有） |
| run | object | 更新后的运行对象（同 §2 结构） |

响应范例：

```json
{
  "adopted": [ { "knowledge_id": "kn_77e0aa", "set_name": "套一" } ],
  "remaining_slots": 2,
  "run": { "run_id": "exp_9f31c2", "status": "adopted", "…": "…" }
}
```

- 服务端强校验：`选中数 ≤ remaining_slots` 否则 409 CAPACITY_REACHED；
  非 ready 态 409 RUN_STATE_CONFLICT【确定】。

## 4. POST /api/v1/explore-runs/{run_id}/discard —— 放弃本次【确定】

运行态转 `discarded`，不产生任何数据行；重复 discard 为幂等成功（200 返回终态对象）。
输入/输出同 §2 对象结构，无请求体。

## 5. GET /api/v1/courses/{course_id}/explore-runs —— 探索历史【确定】

**输入**：`course_id`（path）；`limit`（query，默认 20）/ `offset`（query）——
**分页形态【确定】**维持 limit+offset 现案。

**输出**（200）：运行对象摘要数组（不含 proposals 全量，仅计数 `proposal_count /
adopted_count`），按 created_at 倒序。

## 6. POST /api/v1/curriculum-explore —— 发起新建领域探索【确定】

**用户裁决（2026-08-23，读法 1）**：领域层 `+` = **新建领域探索**——用户填领域名 + 提供探索
过程文档（如 `高等数学探索.txt` 的 领域/范围/备注 式），LLM 提议该新领域的课程体系，
经 §7 确认后一次性写入 **qed_domain + qed_course**（这是课程新增的唯一入口之一，手工加课
见 §8）。提议不直接写共享表。

**输入**

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| domain_name | body | string | 是 | 新建领域名（应用时若重名返回 409 DOMAIN_NAME_CONFLICT） |
| mode | body | string | 是 | 语义同 §1（direct/text/doc） |
| ref_text / ref_doc_path | body | string | 按 mode | 探索过程参考（推荐 doc 模式指向规范位置探索文档） |

请求范例：

```json
{ "domain_name": "高等数学", "mode": "doc", "ref_doc_path": "D:/coding/QED-Engine/dataset/tmp/exploration/高等数学探索.txt" }
```

**输出**：同 §1（run_id/task_id/status；scope 恒 `curriculum`）。上限类 409 不适用
（新领域无存量教程）。

## 7. GET /api/v1/curriculum-runs/{run_id} 与 apply —— 全局层详情与应用

### 7.1 GET /api/v1/curriculum-runs/{run_id}【确定】

结构与 §2 相同，`proposals` 替换为 `changes`（新建领域探索的典型动作序列：先 `create_domain`
一条，随后该领域下若干 `create_course`；update/delete 保留枚举完整性但本流程不产生）：

```json
{
  "change_id": "ch_01",
  "action": "create_domain | create_course | update_course | delete_course",
  "entity": "domain | course",
  "target_id": "cs_ai",
  "payload": {
    "name": "计算机科学（AI 方向）",
    "stage": "本科基础",
    "prerequisites": [],
    "sort_order": 14,
    "note": "深度学习/机器学习基础课群"
  },
  "reason": "对照 Top CS 课程体系，建议增设…"
}
```

- update_course 的 payload 为**部分字段**（PATCH 语义）；delete_course 的 payload 仅含
  target_id，reason 必述影响【确定】。

### 7.2 POST /api/v1/curriculum-runs/{run_id}/apply【确定】

**输入**：`{ "selected": ["ch_01", "ch_02"] }`。
**输出**：`{ "applied": [{change_id, entity, target_id}], "conflicts": [{change_id, reason}],
"run": {…} }`；全部成功运行态转 `applied`，存在 conflict 转 `partially_applied`。

- 写权限归属：QED-Tracker 以共享表唯一写方身份执行（ADR 0009）；应用后 qed_domain/qed_course
  变更对三项目立即可见【确定】。
- **变更冲突处理【确定，2026-08-23 用户裁决】**：应用时目标实体已被并发修改/创建
  （领域重名、课程 id 已存在等）→ **拒绝该条并在 conflicts 标记原因**——安全优先，
  不静默覆盖，也不整体回滚已成功条目。

## 8. 手工维护端点（不经 LLM 的直接管理）

| 方法/路径 | 作用 | 状态 |
| --- | --- | --- |
| `POST /api/v1/domains` | 手工新增领域（domain_id/name/description/stages） | 【确定】 |
| `POST /api/v1/domains/{domain_id}/courses` | 手工新增课程（course_id/name/stage/sort_order/prerequisites/aliases/note）——**2026-08-23 用户裁决保留**（手工加课允许，与领域探索同为课程新增入口） | 【确定】 |
| `PATCH /api/v1/courses/{course_id}` | 修改课程（部分字段） | 【确定】 |
| `DELETE /api/v1/courses/{course_id}` | 删除课程；**存在关联教程（qt_knowledge 非终态行）时 409**，需先处置教程 | 【确定】 |
| `DELETE /api/v1/domains/{domain_id}` | 删除空领域；含课程时 409 | 【确定】 |

- 字段校验细则（stages 枚举、sort_order 冲突、aliases 格式）：**随 QED-Tracker 承接设计文档
  细化，不阻塞本契约冻结**（2026-08-23 用户确认）。
- 共享表 schema 变更（若需新列）：按 ADR 0009 先在根仓库 database-design.md 登记【确定】。

> **契约冻结记录**：2026-08-23 用户评审裁决 A~F 全部并入，§1~8 无【待定】残留——契约冻结，
> 可进入双侧实现。

## 工作项

1. 用户评审本契约，消解【待定】项 → 契约冻结。
2. 在 QED-Tracker 仓库建设计文档（引用本文档）+ todo 登记 QED-04x 承接（REQ-055/056）。
3. 根仓库 8900 透传路由与 tracker_client 扩展（REQ-054，可与 2 并行开发）。
4. 回执后按 [integration-matrix](../design/integration-matrix.md) B 组窗口联调。

## 验证与验收

- QED-Tracker 侧：pytest 契约用例覆盖每端点（含 409 三态、adopt 强校验）；ruff clean。
- 根仓库侧：透传路由契约测试；前端 mock 联调通过。
- 真实冒烟：一门课完成「explore → ready → adopt → qt_knowledge 出现 draft 行」闭环。

## 回滚

端点均为新增，无存量行为变更；透传路由移除即恢复原状。

## 关闭与归档

- 关闭条件：契约冻结 + 双侧实现回执 + B 组联调验收。
- 确定后本文档内容并入 `architecture/api-contracts.md`（数据透传·Tracker 章），计划壳删除。
