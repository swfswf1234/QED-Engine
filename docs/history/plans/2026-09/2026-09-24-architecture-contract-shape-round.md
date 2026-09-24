# 架构文档契约形态轮（architecture-contract-shape-round）

状态：Completed
任务类型：B
最后更新：2026-09-24
关联 ADR：`../../../adr/0017-design-doc-structure-contract.md`（事实源唯一铁律延伸到 architecture/）、`../../../history/adr/v0.1/0010-documentation-versioning.md`
关联设计：`docs/design/cross-project-contracts.md`（§4 schema 变更顺序、§10 契约演进）、`docs/plans/2026-09-10-learning-center-current-state.md`（不涉及）
关联 Tracker：docs/trackers/todo.md ARCH-031 行；关联长期线 REQ-046（API 接口文档）、REQ-047（数据库设计）的形态收口
归档判定：Retain（结构与守护变更，含 history 迁移与新增守护测试）

## 目标与成功标准

对照高星开源项目 API/DB 文档惯例（Stripe 式通用约定前置 + Changelog 分离、registry+pointer
数据库总纲、CI 级 doc↔实现校验），把 `api-contracts.md` 与 `database-design.md` 收口为
**只描述当前契约、事实源唯一、有门禁防漂移**的形态。

- S1：api-contracts 正文零过程叙事（⚠ 待对齐 / ✅ 已对齐 / 跟进清单 / PLAN-0xx 注记全部移
  `history/`），新增「通用约定」前置节、「退役与过渡」集中节、业务错误码字典、端点总表；
- S2：database-design 满足事实源唯一铁律——qed_* DDL/字段表快照删除改指针（用户裁决方案 A，
  与 af_* 处理对齐），「决策记录」节清理，新增 mermaid ER 图 + 表×项目读写矩阵；
- S3：新契约测试守护 api-contracts 端点总表 ↔ FastAPI `app.routes` 双向一致（实测 85 条路由，
  文档旧估算 71 条，漂移实锤必须先对齐）；
- S4：全量门禁绿（并行 WIP 红逐条归因豁免）；两文档「确认状态」转**已确认**（用户裁决 2026-09-24）。

## 范围与非目标

- 范围：`docs/architecture/api-contracts.md`、`docs/architecture/database-design.md`、
  过程内容迁入 `docs/history/` 新档、`tests/contract/` 新增守护、相关索引与台账。
- 非目标：不核对端点语义与代码行为的业务一致性（除路由清单存在性外）；不改子仓库文档；
  不做 OpenAPI 机器可读文档生成（守护测试比对 app.routes 即够）；不动 design/ 六篇。

## 前置条件

- 8900 路由实测清单（app.routes 枚举 85 条，含 method+path 精确参数名）；
- 并行 WIP 基线：6 条契约红（REQ-033 ×3、ARCH-028 code-map ×2、suite_governance ×1）不归本轮；
- 去过程化迁移目标文件为新建 `docs/history/` 文档（归档区，非 docs/ 结构变更阻止项范畴）。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | api-contracts：新增「通用约定」节（响应/错误包络、状态码语义、成功态规整 201/204→200、202+轮询范式、相对路径重写、无认证假设）+ 端点总表（85 行，method×path×域×状态，哨兵注释 `endpoint-registry:start/end` 包裹，守护解析锚点） | 已实施 |
| W2 | api-contracts 去过程化：§③.9 对齐跟进清单、「✅ 已对齐」块、「已删除端点」注记、「UI 不再调用」注记、各 ⚠ 待对齐标记 → 正文只留当前态（内容零丢失自证：§③.9 全文存于已归档壳 history/plans/2026-09/2026-09-11-book-route-alignment.md 与 Git 历史，**不另建 history 迁移档案**）；未落地目标（REQ-077、GET /courses/{domain_id}）以 §③「规划契约」表保留，不带 PLAN 叙事 | 已实施 |
| W3 | api-contracts：「退役与过渡」集中节（已删除面 5 组 + 过渡面 3 组→替代→处置策略，处置规则指针 cross-project-contracts §10）+ 业务错误码字典（12 码：产生方/状态码/触发条件/客户端应对；8900 自有门面错误为纯文本 detail 已声明） | 已实施 |
| W4 | database-design：删 qed_domain/qed_course 完整 DDL+字段表（总览表保留一行语义+指针，方案 A）；exploration_stage 状态机语义收敛到单一事实源（本文件保留写权限口径、结构语义指 QED-Tracker）；删「决策记录」节改 ADR 指针；新增 mermaid `erDiagram` + 表×项目读写矩阵；迁移节补 cross-project-contracts §4/§10 指针；「决策记录」→「决策依据」ADR 指针节 | 已实施（补 mermaid erDiagram 逻辑引用视图 + 表×项目读写矩阵） |
| W5 | **既有守护发现**：`tests/contract/test_api_endpoint_inventory.py` 已做正文端点↔路由双向比对（W2 重写即被其校验）。增量：同文件新增 `test_registry_table_matches_implemented_endpoints`（总表哨兵区独立二次比对 + 前缀/域/状态枚举校验），总表成为第二事实面；路径参数名全部对齐路由（{book_id}/{page_no}/{block_index}/{job_id}/{call_id}） | 已实施 |
| W6 | 两文档转**已确认**（用户裁决 2026-09-24）+ AGENTS.md 文档优先级指针同步；`test_architecture_documents.py` 新增 `test_database_design_is_registry_only_with_er_diagram`（零 CREATE TABLE + erDiagram 守护）；跨文档重复语义收敛：exploration_stage 状态机/写主体矩阵事实源定为 downloads-flow §5.2/§5.4 + Tracker shared-tables.md，database-design 只留指针与消费要点 | 已实施 |
| W7 | 门禁（tests/contract 全量 + 全量 pytest + ruff）+ 台账（todo/completed/plans-index/todo REQ-047 行措辞同步）+ qed-closeout 收口 | 已实施（见「关闭记录」） |

## 门禁输出（2026-09-24）

- `tests/contract`：**65 passed**（含本轮新增 2 守护：总表比对 + 零 DDL/ER 图）。
- 全量 pytest（除 contract）：**480 passed / 1 failed**——唯一红
  `tests/test_web.py::test_dashboard_course_completion_semantics` 归并行 REQ-033 WIP
  （其新断言 `buildDomainDownloadBars` 尚未落 dashboard.ts，工作区并存其未提交代码改动），非本轮文件。
- ruff：2 错全部落并行 WIP 文件（`api/axiom.py` B008、`services/llm/supervisor.py` F722）；
  本轮触碰的 2 个测试文件单独 ruff 全过。
- S1 残留扫描：api-contracts 正文 `待对齐|已对齐|跟进清单|PLAN-0|用户裁决|UI 不再调用` 命中 = 0。
- 端点实测：app.routes 85 条业务路由全部入总表（旧文档估算 71 条的缺口为 ①start/stop/restart
  拆分计数与 §③ 未逐一列举的探索门面/课程域端点）。
- 确认状态翻转后 AGENTS.md「文档优先级」指针同步（four-service/code-map/api-contracts/database-design 已确认）。

## 验证与验收

- S1/S2 由人工 diff 评审 + 残留 grep 清零（`已对齐|待对齐|跟进清单|决策记录` 于正文命中数=0，
  哨兵区与 history 档案除外）；
- S3 由 `test_api_contract_registry.py` 绿自证；
- S4 门禁输出全量贴壳；转已确认后 `test_architecture_documents` 全绿。

## 回滚

纯文档 + 新增测试轮：`git revert` 本任务提交即可；新守护测试删除即回退，无数据副作用。

## 关闭与归档

- 关闭条件：W1~W7 完成 + S1~S4 证据入本壳；
- 归档判定：Retain；收口时按 doc-governance 归档规则移 `history/plans/2026-09/`。

## 关闭记录（2026-09-24）

- 收口复跑门禁：`tests/contract` **68 passed**（较立项时 65 多 3 条为 ARCH-032 轮新增守护，
  本轮 2 守护均绿）；全量 pytest **483 passed / 0 failed**——立项时唯一红
  `test_dashboard_course_completion_semantics` 已由并行 REQ-033 会话落码修绿，豁免自动消除；
  ruff 剩 3 错全部归并行 WIP（`api/axiom.py` B008、`services/llm/supervisor.py` F722、
  `scripts/diag_watch_b05.py` F401），非本轮文件不动。
- 用户 2026-09-24 发令执行收口；本壳转 Completed 后归档 `docs/history/plans/2026-09/`，
  todo ARCH-031 行移除、completed.md 登 Achieved、plans/index.md 登记去处。
- 收口动作复跑时工作区并存并行 ARCH-033（模型启动参数轮）在飞改动，新增红逐条归因豁免、
  非本轮文件：镜像守护 1 红（其 todo 行 `Accepted` ↔ 壳 `In Progress` 未同步）+
  `tests/test_llm_registry.py` 4 红（其 lmstudio 参数线未落码）；本轮触碰面（归档移动、
  todo 删节、completed/index 插入、REQ-090→096 改号）零红自证。
