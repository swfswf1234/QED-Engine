# 2026-08 文档下载管理三表统一轮（downloads-three-table）

状态：In Progress
任务类型：C
最后更新：2026-08-14
关联 ADR：无（数据库归属沿用 REQ-026/027 裁决）
关联设计：[三表模型设计](../../../design/downloads-three-table-model.md)（REQ-029/030 依据）
关联 Tracker：`docs/trackers/todo.md`（ARCH-010 登记；REQ-029/030 跨项目请求；REQ-006 承接执行）
归档判定：用户审阅两份设计文档与计划 → QED-Tracker 回执完成（QED-028/029）→ 根仓库侧
8900 适配 + 前端三表切换 + 知识点展示同步完成 → 联调验收后 Completed，归档至
`history/plans/2026-08/`

## 前置条件

- 用户 2026-08-13 裁决三表模型（qt_selections → qt_downloads → qt_sources）：
  候选=表1 生命周期、验收在表2 册级、superseded 旧版本、彻底隐藏 rejected/superseded、
  搜索产表1候选、存量一次性迁移合并、步骤条语义（进入展示表1 书单并做好教材↔习题集对应、
  评估时选定究竟要哪一份、下载完毕指示绝对路径人工审理）。
- 跨项目请求已登记：REQ-029（数据库重构，QED-Tracker QED-028 承接）、
  REQ-030（API 改造，QED-Tracker QED-029 承接）。
- 2026-08-13 用户已审阅两仓库设计文档与计划并裁决三项补充（D7 表2 candidate 态、D8 主链路
  JSON 迁移后删除、D9 backup 转正语义）；QED-Tracker 侧任务由其仓库自行执行，本仓库等待回执。
- 2026-08-14 状态更新：QED-Tracker 回执完成（QED-028/029 落地：三表 DDL/状态机/迁移/教程归并/
  数据修复/LLM 简介/Alembic 0004，8901 三表端点实测）；根仓库 Phase 2（8900 data.py 三表适配）
  与 Phase 3（前端三表切换）已落地，待浏览器联调验收。

## 目标与成功标准

1. 双轨统一：qt_resources 10 态状态机与主链路 JSON 六态合并为三表模型，
   旧存储退役（由 QED-Tracker 承接）。
2. 8900 data.py 数据域网关新增三表语义代理（selections/downloads/sources 端点适配，
   沿用 tracker_client + 错误映射模式）。
3. 8903 文档下载管理前端切换三表展示：树到套书（表1）、面板书单 + 册明细（表2）、
   详情弹窗来源（表3）、步骤条四步语义（选择/评估/下载/审理）、rejected/superseded
   彻底隐藏（数据层过滤，前端无查看入口）。
4. 知识点展示同步：树头保留「知识点」（方案 B：领域→课程→套书，册明细面板展开）。

成功标准：QED-Tracker 回执（QED-028/029 完成 + 8901 实测）；根仓库
`pytest tests -q` 全绿 + `ruff check src tests` 无错误 + `node --check web/app.js`；
8900/8903 curl token 实测；浏览器验收（书单展示/册明细/绝对路径审理/隐藏规则）。

## 决策记录（用户裁决，2026-08-13）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 双轨统一形态 | 三张表：表1 qt_selections（一条=一套书）→ 表2 qt_downloads（册级）→ 表3 qt_sources（渠道尝试），逐级一对多 |
| D2 | 生命周期归属 | 候选=表1 生命周期（candidate→三态 confirm/backup/reject→confirmed/backup/rejected）；验收（approve/reject）在表2 册级；表1 聚合完成度；旧版本 superseded |
| D3 | 后端细节归属 | 数据库详设落地 QED-Tracker（其 three-table-schema.md 为 DDL 事实源）；根仓库只做模型视图与契约 |
| D4 | 存量处置 | 一次性迁移合并（qt_resources + 主链路 JSON 映射导入三表），旧存储退役；过时/否定数据彻底隐藏（仅 DB 留痕，前端无查看入口） |
| D5 | 前端结构 | 沿用左树+面板；树三层（领域→课程→套书），册明细面板展开；树头保留「知识点」 |
| D6 | 步骤条语义 | 按课程区分：进入展示表1 书单（教材↔习题集对应关系）；评估时选定究竟要哪一份；下载完毕指示绝对路径人工审理是否达预期 |
| D7 | 表2 candidate 态 | 需 candidate（先登记再下载）：下载任务发起时落 candidate → downloading → downloaded（2026-08-13 补充裁决） |
| D8 | 主链路 JSON 处置 | 迁移并备份快照确认后旧文件物理删除；qt_resources 表与 meta/resources JSON 保留只读（2026-08-13 补充裁决） |
| D9 | backup 转正 | 表1 backup ⇄ confirmed 可逆，与旧 qt_resources 三态语义一致（2026-08-13 补充确认） |

## 范围与非目标

范围内（根仓库侧，QED-Tracker 回执后执行）：
- `backend/qed_engine/api/data.py` + 相关数据域模块：新增 selections/downloads/sources
  适配端点（对齐 [三表模型设计 §3.2](../../../design/downloads-three-table-model.md)）。
- `web/app.js` / `web/index.html` / `web/style.css`：树到套书、面板书单+册明细、
  详情弹窗来源、步骤条四步语义（含绝对路径审理提示）、册级验收操作。
- `tests/test_web.py` + `backend/tests/`：三表端点守护、前端三表 token 守护。
- 文档同步：todo.md（ARCH-010、REQ-029/030 证据、REQ-006 证据）、plans/index.md、
  service-contracts.md、web-frontend.md、design 文档状态位。

非目标：
- 不直接修改 QED-Tracker 文件（DDL/状态机/迁移/8901 端点由其承接，见 REQ-029/030）。
- 旧端点 /resources 过渡期保留，退役时序由 QED-Tracker 决定。
- Axiom-Flow 不动。
- 学习中心（三中心远期演进）不在此轮。

## 工作项

### Phase 0：QED-Tracker 回执（前置）

- 用户审阅 REQ-029/030 两仓库设计文档与计划后，由 QED-Tracker 执行 QED-028/029；
  回执（8901 三表端点实测 + 迁移完成）后本计划转 Accepted。

### Phase 1：守护测试更新（TDD 红态，QED-Tracker 回执后）

| 新增/变更 | 断言 |
| --- | --- |
| `THREE_TABLE_ENDPOINT_TOKENS`（backend/tests 守护） | data.py 含 `/selections`、`/downloads`、`/resources/{id}/downloads`、`/sources` 适配 |
| `SELECTIONS_PANEL_TOKENS`（tests/test_web.py） | app.js 含套书卡渲染/册明细展开/三态操作/绝对路径提示 token；不可含查看 rejected/superseded 的入口 token |

### Phase 2：8900 数据域适配（TDD 绿态）

- `data.py`：新增 `GET /selections`、`GET /selections/{id}`、
  `POST /selections/{id}/confirm|backup|reject|supersede`（工厂端点，body 含 note/reason）、
  `GET /resources/{id}/downloads`、`POST /downloads/{id}/approve|reject`、
  `GET /downloads/{id}/sources`；错误映射沿用（8901 4xx 透传 detail、其余 503）。

### Phase 3：前端三表切换（TDD 绿态）

- 树：领域 → 课程 → 套书（表1 条目），册明细不进树；树头保留「知识点」。
- 面板：默认表1 书单（套书卡含版本摘要/roles 徽标/册完成度 x/y/套标记）；点套书展开
  表2 册明细（vol/文件信息/状态/下载与验收操作）；候选仅评估态出现（「待评估」占位卡保留）。
- 详情弹窗：套书详情（表1 全字段）+ 册详情（绝对路径 + 表3 来源 channel/page_url/attempted_at/ok）。
- 步骤条四步语义：① 选择（表1 书单，教材↔习题集对应）→ ② 评估（选定究竟要哪一份）→
  ③ 下载（表2 册级）→ ④ 审理（下载完毕显示绝对路径，人工审理后逐册 approve/reject）；
  完成判定沿用两套标准（≥2 套，每套 ≥1 教材+≥1 习题集册均 approved），数据源从 resources
  聚合改为表1/表2 聚合。

### Phase 4：文档同步 + 验证

- todo.md：ARCH-010 行登记；REQ-029/030 证据随回执更新；REQ-006 证据追加本轮（不得含裸 `|`）。
- plans/index.md：活跃计划加 ARCH-010 行。
- service-contracts.md / web-frontend.md：三表端点契约与前端对齐契约同步。
- 验证：`pytest tests -q`、`ruff check src tests`、`node --check web/app.js`、
  8900/8903 curl token 实测。

## 风险与回退

- QED-Tracker 侧改造大（DDL+迁移+API），回执周期长：本计划 Phase 1~3 全部依赖回执，
  不提前开工；前端先行实现存在数据源切换风险，故前端三表切换与回执同步启动。
- 迁移为一次性、可重放、幂等，由 QED-Tracker 保证；存量映射偏差在其迁移测试中覆盖。
- 彻底隐藏语义在数据层实现（默认过滤），前端不再依赖展示层过滤。

## 验证与验收

- QED-Tracker 回执：QED-028/029 completed + 8901 三表端点冒烟（selections 列表/
  详情/三态/supersede、downloads approve/reject/sources、register）。
- 根仓库：`pytest tests -q` 全绿、`ruff check src tests` 无错误、`node --check web/app.js`。
- 浏览器验收要点：
  - 进入文档下载管理默认展示表1 书单（数学领域课程，套书卡含 roles 徽标与册完成度）；
  - 点套书展开表2 册明细；下载完成显示绝对路径并提示人工审理；审理后逐册 approve/reject；
  - 任一界面不可见 rejected/superseded/backup 数据（除评估态外的 candidate）；
  - 树到套书三层、树头「知识点」；步骤条按课程显示四步。

## 回滚

- 根仓库侧全部可逆：8900 适配端点独立提交可 revert；前端改动即时生效（静态托管）。
- QED-Tracker 侧迁移回滚由其仓库保证（downgrade 迁移链）。

## 关闭与归档

- 关闭条件：QED-Tracker 回执 + 门禁全绿 + 浏览器验收通过。
- 归档：ARCH-010 从 todo.md 移除并写入 completed.md；plans/index.md 移除该行；
  REQ-029/030 关闭（回执）；本计划文件移至 `docs/history/plans/2026-08/`。