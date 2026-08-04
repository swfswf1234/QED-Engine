# ADR 0002：前端统一到 QED-Engine 与全局端口规划

状态：Accepted
日期：2026-08-04
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

Axiom-Flow 自带 `web/` 原生前端审阅工作台（721 行 app.js），QED-Engine 需要学习界面与管理
界面。现状服务端口不统一：Axiom-Flow 使用 8000，配置中心使用 8900。为让前端与全局配置统一在
QED-Engine 下，需要明确前端归属与端口规划。

## 决定

1. **前端统一**：最终所有前端（学习界面、管理界面、审阅工作台）统一维护在 QED-Engine 仓库
   `web/` 下；Axiom-Flow 的 `web/` 工作台迁入 QED-Engine 后退役，Axiom-Flow 只保留 API 与
   Worker。迁移分阶段执行：先登记规划与请求（本轮），代码迁移在后续轮次完成。
2. **全局端口规划**（8900-8903 段，统一归属；2026-08-04 用户裁决：8901 归 QED-Tracker 服务）：

   | 端口 | 服务 | 归属 |
   | --- | --- | --- |
   | 8900 | QED-Engine 配置中心 | 根仓库（已运行） |
   | 8901 | QED-Tracker 服务（API，后台任务 + 轮询） | 子仓库（服务化轮） |
   | 8902 | Axiom-Flow API + Worker | 子仓库（端口迁移轮） |
   | 8903 | QED-Engine 前端（学习+管理+审阅工作台） | 根仓库（规划） |

3. **最小配置与提醒**：无 `.env` 时使用代码默认值降级运行（既有行为）；配置中心
   `configured` 布尔与 `check_api_keys.py` 提供提醒；后续管理界面展示未配置横幅。
4. 子项目改造（端口迁移、直读 QED_* 变量、web/ 退役）通过根仓库 todo 请求 + 各子项目 todo
   登记的方式推进，在子项目仓库内实现并遵守其门禁。

## 后果

- Axiom-Flow 端口由 8000 改为 8902，涉及 CORS、README、指南与启动命令的同步更新（代码轮）。
- QED-Engine 配置中心 CORS 需允许 8901/8902 来源（代码轮）。
- 前端代码单一维护点，减少跨仓库前端重复。
- 迁移完成前 Axiom-Flow `web/` 继续可用，独立性铁律不受影响。

## 关联

- 关联设计：`docs/design/service-contracts.md`、`docs/design/configuration-and-secrets.md`、
  `docs/design/config-center-api.md`
- 关联架构：`docs/architecture/four-service-architecture.md`
- 关联计划：`docs/plans/2026-08-sync-alignment.md`
- 关联 ADR：[ADR 0001](0001-root-contract-tests.md)（同轮治理对齐）
