# 2026-08 文档与数据边界整理轮（docs-data-boundary-round）

状态：Accepted
任务类型：B
最后更新：2026-08-16
关联 ADR：[ADR 0003](../adr/0003-shared-qed-database-independence.md)（qed_* 共享表族修订，工作区已改）、
[ADR 0009](../adr/0009-shared-qed-tables.md)（qed_* 共享表族）、[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)、
[ADR 0008](../adr/0008-frontend-react-refactor.md)
关联设计：[backend-domain-split.md](../design/backend-domain-split.md)（三域已实施）、
[../architecture/api-contracts.md](../architecture/api-contracts.md)、[service-control.md](../design/service-control.md)、
[service-contracts.md](../design/service-contracts.md)、[dataset-conventions.md](../design/dataset-conventions.md)、
[../architecture/database-design.md](../architecture/../architecture/database-design.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-013 登记；QED-031 同步、REQ-032 新登记）
归档判定：四工作项完成 + 契约门禁全绿 + 用户确认 → Completed，归档至 `history/plans/2026-08/`

## 前置条件

- 2026-08-16 用户裁决：前端完成后统一实施 ARCH-012 真实环境验收（Task 18 延后）；本轮先做
  文档整理——后端部分按三域新模式重新梳理；todo 过时清理、重合合并；database/dataset 边界
  按「dataset=数据资料、元数据默认入 DB」新模式重新梳理。
- QED-031 知识层次重构（QED-Tracker database-schema.md Accepted，五层模型 qed_domain/qed_course
  + qt_knowledge/qt_books/qt_sources 取代三表）已完成，根仓库登记同步属本轮范围。

## 目标与成功标准

1. 后端文档按三域新模式梳理完成：four-service-architecture（符合度表新路径 + 8900 监控诊断域）、
   config-center-api（定位段五合一 + 数据域 QED-031 标注）、service-control（Implemented）、
   service-contracts（qed_* 共享表只读约定 + 8901 新契约待冻结标注）、downloads-three-table-model
   （Superseded）、project-status/README/AGENTS/design-index（同步）。
2. todo 清理合并完成：9 条关闭归档（ARCH-004/006/007/009/010 + REQ-005/013/018/026/029/030）、
   3 条合并（REQ-002 吸收 REQ-021/025；REQ-004/014 验收并入 ARCH-002）、新登记
   （QED-031 根仓库同步、REQ-032 meta/ 退役、学习表族规划）。
3. database/dataset 边界按新模式更新：dataset-conventions（meta/ 退役、目录重定义）、
   database-design（QED-031 表清单 + 学习表族规划）、learning-center（进度落库登记规划）。
4. ARCH-012 验收延后标注（计划 + project-status）。

成功标准：`pytest tests -q` + `ruff check backend tests` + `pytest tests/contract -q` 全绿；
todo/completed 台账与 plans/index 一致；用户确认。

## 范围与非目标

范围内：
- 后端相关文档梳理（§工作项 1）；todo/completed 台账清理合并（§2）；database/dataset 边界
  文档更新（§3）；QED-031 根仓库同步登记（ADR 0003 修订纳入、database-design、todo）；
  ARCH-012 验收延后标注（§4）。

非目标：
- QED-Tracker 实现轮（迁移 0006 建表、meta/ 归档执行——由其仓库承接，REQ-032 登记请求）。
- Axiom-Flow 侧 af_* 表确认（REQ-027 保持，子项目承接）。
- 学习表族设计（M2 启动时裁决，本轮只登记规划）。
- ARCH-012 真实环境验收（前端完成后统一执行）。
- 不提交 git（遵循项目惯例，用户统一提交）。

## 决策记录（用户裁决，2026-08-16）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | ARCH-012 最终验收时机 | 延后至前端完成后统一验收（本轮不实施） |
| D2 | 旧前端验收轮次（ARCH-004/006/007/009/010） | 全部关闭归档（被 ARCH-011 前端重构 / QED-031 新表模型取代） |
| D3 | meta/ JSON 处置 | 退役，DB 为唯一元数据事实源（REQ-032 请求 QED-Tracker 迁移归档） |
| D4 | 学习表族归属 | 暂缓，database-design 登记规划，M2 启动时裁决 |
| D5 | 文档治理三任务（REQ-002/021/025） | 合并为 REQ-002「文档治理与同步」 |

## 工作项

### 1. 后端文档按三域新模式梳理

- 1.1 `four-service-architecture.md`：符合度表引用更新（api/tracker.py、services/service_manager.py、
  api/control.py）；8900 职责补监控诊断域；最后更新日期刷新。
- 1.2 `../architecture/api-contracts.md`：定位段重写（8900 五合一角色：配置语义代理 + 状态探测 + 数据域网关
  + 服务域 + 监控诊断域）；「监控与诊断域」章节已登记实现状态同步；数据域章节标注 QED-031
  取代三表契约（新契约待 QED-Tracker 实现轮冻结后更新）。
- 1.3 `service-control.md`：实现状态 In Progress → Implemented。
- 1.4 `service-contracts.md`：登记 qed_* 共享表 + 只读约定（ADR 0009）；8901 契约标注 QED-031
  实现轮后更新。
- 1.5 `downloads-three-table-model.md`：标注 Superseded（被 QED-031 database-schema.md 取代，
  保留只读留档）。
- 1.6 `../trackers/project-status.md`：四服务表 8900 行补监控诊断域；ARCH-012 条目改为实施完成待统一验收；
  当前主线补 ARCH-013 记录。
- 1.7 `README.md` / `AGENTS.md`（REQ-021 同步）：四服务表 8900 行补监控诊断域 + 三域组织。
- 1.8 `design/index.md`：后端相关文档状态位同步（backend-domain-split Implemented、
  learning-center In Progress、downloads-three-table-model Superseded、service-control Implemented）。

### 2. todo 清理与合并

- 2.1 关闭归档（写入 completed.md）：ARCH-004/006/007/009/010、REQ-005/013/018/026/029/030。
- 2.2 合并：REQ-021/025 并入 REQ-002（completed.md 记录合并）；REQ-004/014 验收并入 ARCH-002
  （行内体现，不新增条目）。
- 2.3 新登记：ARCH-013（本计划）；QED-031 根仓库同步（并入 ARCH-013 范围或独立 REQ 行）；
  REQ-032 meta/ 退役（请求：QED-Tracker）。
- 2.4 todo.md 规则段保持；plans/index.md 增 ARCH-013。

### 3. database/dataset 边界（新模式）

- 3.1 `dataset-conventions.md`：目录重定义——dataset=数据资料（qed-tracker/raw 原始数据 +
  axiom-flow/parsed 整理后数据资料）；meta/ 退役（DB 唯一事实源，存量由 QED-Tracker 迁移归档）；
  删除「资源登记双写」契约；补「元数据默认存数据库」原则。
- 3.2 `../architecture/database-design.md`：表清单更新为 QED-031 五表（qed_domain/qed_course 共享 +
  qt_knowledge/qt_books/qt_sources）+ af_*（规划）；meta/ 退役说明；登记「QED-Engine 学习表族
  规划」（课程进度/练习/问答，M2 启动时裁决归属）；REQ-026 回执状态。
- 3.3 `learning-center.md` §4：进度落库表述更新（qed 库学习表族规划，M2 裁决）。
- 3.4 ADR 0003 修订确认（工作区已改，纳入提交；ADR 0009 已立档）。

### 4. ARCH-012 验收延后标注

- 4.1 ARCH-012 计划文档：Task 18 标注「延后至前端完成后统一验收」。
- 4.2 ../trackers/project-status.md：ARCH-012 条目同步。

## 验证与验收

- 门禁：`pytest tests -q` + `ruff check backend tests` + `pytest tests/contract -q` 全绿。
- 台账一致性：todo/completed/plans/index 互查无悬空链接；契约测试守护格式。
- 用户确认后归档（history/plans/2026-08/）。

## 回滚

- 纯文档轮：git 历史可回；不触碰代码与测试逻辑（仅契约测试白名单/守护必要时微调）。

## 关闭与归档

- 归档判定见文档头；Closed 后归档至 `history/plans/2026-08/`，todo 移除 ARCH-013。
