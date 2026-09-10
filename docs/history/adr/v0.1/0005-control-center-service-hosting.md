# ADR 0005：控制中心服务托管规划

状态：Superseded
日期：2026-08-09
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

## 背景

三个 Python 服务（8900 配置中心、8901 QED-Tracker、8902 Axiom-Flow）启动方式散落在各项目
README 与指南中。2026-08-09 服务控制设计定稿（service-control.md，Accepted / Not Started）：
由 QED-Engine 配置中心（8900）承担控制中心职责，对 8901/8902 提供统一启停托管，并在前端
（8903）仪表盘提供服务控制区，集中管理服务运行状态。

## 决定

1. **控制中心归属**：8900 配置中心新增服务管理能力（`/services` 端点族），提供 8901/8902 的
   查询、启动、停止与状态托管；8903 前端仪表盘提供服务控制区（见服务控制设计）。
2. **进程单元**：Axiom-Flow 为 API + Worker 双进程单元（8902），托管按单元启停；QED-Tracker
   为单进程单元（8901）。
3. **停止语义**：停止使用优雅停止（CTRL_BREAK / 等效信号），由托管方负责进程生命周期管理；
   子项目自身不实现被托管逻辑，保持可手动独立启动。
4. **容器化边界**：MySQL / 向量库 / MinerU 等依赖以容器化方式规划，只进规划不展示于控制界面。
5. **独立性保持**：服务托管不影响三项目独立部署与独立启动；8900 离线时 8901/8902 仍可手动
   启动（独立性铁律不变）。

## 后果

- 8900 公开 API 扩展（服务管理端点），契约在实现轮冻结（服务控制设计为契约事实源）。
- 8903 前端新增服务控制区（后续轮）。
- 子项目无需配合改造；托管为根仓库侧行为，不侵入子项目代码。

## 关联

- 关联设计：[service-control.md](../../../design/service-hosting.md)（服务控制设计，Accepted / Not
  Started）
- 关联架构：[four-service-architecture.md](../../../architecture/four-service-architecture.md)
- 关联 ADR：[ADR 0002](0002-frontend-and-port-centralization.md)（全局端口规划）
