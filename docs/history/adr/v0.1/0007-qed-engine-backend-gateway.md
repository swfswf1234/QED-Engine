# ADR 0007：QED-Engine 后端网关化：前端统一入口 8900

状态：Superseded
日期：2026-08-10
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

## 背景

前端（8903）当前直连三个服务：8900（配置五端点）、8901 QED-Tracker（资源/任务/目录/状态机，
约 15 处调用）与 8902 Axiom-Flow（仅健康探测 1 处）。直连模式带来三个问题：跨源面扩散（子项目
CORS 需对 8903 开放）、子项目接口变化直接冲击前端、前端需要感知三个服务的地址与契约。服务控制
规划（ADR 0005、service-control.md）已决定 8900 承担控制中心职责但尚未实现。本轮同时进行目录
结构重整（后端/前端/脚本/数据库/日志/测试各归其位），一并解决。

## 决定

1. **前端唯一入口 8900**：8903 只与 8900 交互。8900 由「配置中心」升级为「QED-Engine 后端」，
   接口分三域：配置域（既有五端点：health / config/models / config/keys / config/database /
   config/llm-status）、数据域（语义 API，新增）、服务域（/services 端点族，新增）。
2. **数据域语义 API**：catalogs / resources（列表/详情/状态机 confirm-backup-approve-reject-
   register/PDF 预览流）/ tasks（列表/详情/评估/下载）契约归 8900 所有，路径 token 与前端现状
   一致（前端只换 BASE、零逻辑改动）；内部经 TrackerClient（扩展 register/catalogs 方法）适配
   8901。8902 数据代理后置：前端现仅健康探测 1 处，由服务域覆盖，解析进度/对照数据源后续
   接入 8900。
3. **服务域完整实现**：按 service-control.md 已定契约实现 /services 端点族（list/start/stop/
   restart，状态探测 3s、Popen 启动、CTRL_BREAK 优雅停止、config 启停 409、并发 409、幂等），
   落实 ADR 0005 的控制中心职责。
4. **目录结构**：后端代码由 src/qed_engine 迁移至 backend/qed_engine（包名 qed_engine 与
   import 不变，uvicorn 启动命令不变）；新建 database/（建库与运维脚本，表结构仍归子项目
   Alembic）、logs/ 与 tmp/（运行产物，gitignore）；scripts/ 补启停脚本；tests/ 保持根目录。
5. **CLI 保持直连**：`qed tracker` 子命令继续直连 8901（运维工具，不并入网关）。
6. **CORS 收窄后置**：8900 允许 8903 来源（既有白名单含 8903）；子项目 CORS 收窄属子项目
   改动，本轮不动，留待后续请求（低优先）。

## 后果

- 前端跨源面收缩为单一 8900 来源；浏览器不再直连 8901/8902。
- 8901/8902 接口变化只影响 8900 适配层（TrackerClient），前端与子项目解耦。
- 8900 公开契约扩展（数据域 + 服务域），../architecture/api-contracts.md 增章节登记，服务控制契约事实源
  为 service-control.md。
- backend/ 迁移影响 pyproject 打包配置、code-map 与文档路径引用（机械同步 + 门禁兜底）。
- 服务控制实现为根仓库侧行为，子项目保持可手动独立启动（独立性铁律不变）。

## 关联

- 关联 ADR：[ADR 0002](0002-frontend-and-port-centralization.md)（全局端口规划，本决策为
  8900 角色升级，不改变端口归属）、[ADR 0005](0005-control-center-service-hosting.md)（控制
  中心服务托管，本决策为其实施）
- 关联设计：`docs/design/service-control.md`、`docs/architecture/api-contracts.md`、
  `docs/design/service-contracts.md`
- 关联架构：`docs/architecture/four-service-architecture.md`