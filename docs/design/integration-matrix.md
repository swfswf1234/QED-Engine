# 联调矩阵与契约冻结编排（integration-matrix）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-16
关联代码：—（本文件只做编排，不映射具体模块；契约事实源为各关联文档）
关联测试：—（分组独立性由既有契约测试守护：test_web / test_api / test_tracker_client）
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)（端口规划）、
[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、
[ADR 0008](../adr/0008-frontend-react-refactor.md)（前端重构）、
[ADR 0009](../adr/0009-shared-qed-tables.md)（qed_* 共享表族）

## 目的与边界

本文件编排 QED-Engine 三组联调（A：8903 前端 ↔ 8900 后端；B：8900 ↔ 8901 QED-Tracker；
C：8900 ↔ 8902 Axiom-Flow）的**分组边界、契约事实源、前置条件与验收窗口**，以及两处
**契约冻结节奏**（QED-031 新表契约、Axiom-Flow v2 契约）。

- 只做编排，**不复制契约正文**——各组契约事实源仍为各自的契约文档（config-center-api.md /
  service-contracts.md / service-control.md / QED-Tracker database-schema.md / Axiom-Flow v2）。
- 三组可**并行推进**：每组联调中非本组服务离线时功能降级正常（503 / 离线横幅 / 空态），
  独立性铁律由既有契约测试守护。
- 2026-08-16 用户裁决：各服务处于独立开发阶段，本文件先固化编排，联调验收随后续轮次执行。

## 分组矩阵

| 组 | 接口面 | 契约事实源 | 独立联调能力 | 前置条件 | 验收目标 |
| --- | --- | --- | --- | --- | --- |
| **A：前端 ↔ 8900** | 8903（web-ui）→ 8900 全部域（配置/数据域/服务域/监控诊断），只连 8900 | [config-center-api.md](config-center-api.md)、[service-control.md](service-control.md) | ✅ 已具备（8901/8902 离线 503 降级；Vite proxy） | 无（并行推进中，ARCH-011） | 前端统一验收：web-ui 四界面 + ARCH-012 Task 18 监控端点真实实测 + ARCH-014 启动快照/横幅 |
| **B：8900 ↔ 8901** | 数据域适配（api/tracker.py + clients/tracker_client.py）+ /services 托管启停 | [service-contracts.md](service-contracts.md)（**QED-031 冻结后更新**）、[database-design.md](database-design.md) | ✅（8901 离线 503 降级已守护） | QED-Tracker 迁移 0006 落地 + 新契约冻结（REQ-035 承接根仓库适配） | QED-014 全链路联调冒烟（ARCH-002 主线）；新契约下数据域真实数据闭环 |
| **C：8900 ↔ 8902** | 第一阶段：/services 托管 + /monitor/mineru + /logs；第二阶段：数据域·Axiom（api/axiom.py + clients/axiom_client.py） | [service-control.md](service-control.md)；Axiom-Flow v2 契约（**V2-007 冻结后**） | ✅ 第一阶段托管/监控已具备（8902 离线降级已守护） | 第一阶段：**执行方 = Axiom-Flow**（V2-003~007，含 V2-003 移交审阅 REQ-036）；根仓库侧只做文档/任务/联调准备，不写对方代码（2026-08-16 亡羊补牢）；第二阶段：v2 契约冻结（V2-007，REQ-034 承接） | 第一阶段：托管/监控真实闭环；第二阶段：解析进度/原始文档对照端点 |

## 契约冻结节奏

| 契约 | 冻结节点 | 归属仓库 | 根仓库承接 |
| --- | --- | --- | --- |
| QED-031 新表契约（8901：qed_domain/qed_course 共享 + qt_knowledge/qt_books/qt_sources） | QED-Tracker 迁移 0006 落地（database-schema.md 已 Accepted） | QED-Tracker | **REQ-035**：8900 数据域适配更新（api/tracker.py、clients/tracker_client.py、config-center-api 数据域章节、service-contracts 8901 契约）；课程体系数据源（courses/math.json → qed_course）切换 |
| Axiom-Flow v2 契约（8902：parse-jobs/books/pages/manifest） | 其 V2-007 回执（当前 V2-003~007 Open，API 服务未建，2026-08-16 同步） | Axiom-Flow | **REQ-034**：数据域·Axiom 适配（api/axiom.py、clients/axiom_client.py、解析进度/对照端点） |
| qed_* 共享表只读约定 | 随 0006 | QED-Tracker（建表维护） | 已登记（ADR 0009、database-design.md）；8903/8900 读取课程体系随 REQ-033 |

## 验收窗口

| 窗口 | 内容 | 触发时机 | 涉及组 |
| --- | --- | --- | --- |
| 前端统一验收 | web-ui 四界面 + 监控端点实测 + 启动快照/横幅 + 8903 全路由回归 | ARCH-011 完成后 | A |
| B 组联调验收 | QED-014 全链路冒烟（发现→评估→下载→登记→验收）+ 数据域新契约闭环 | QED-031 迁移 0006 冻结后 | B |
| C 组联调验收 | 托管/监控闭环（第一阶段）；解析对照端点（第二阶段） | Axiom-Flow v2 API 服务建立（第一阶段）；契约冻结（第二阶段） | C |

## 独立性验证

- 每组联调中，非本组服务离线时：前端显示离线横幅/503 降级、数据域返回 503 + 明确提示、
  监控端点返回 reachable=false + 原因——由既有契约测试守护（tests/test_api.py、
  tests/test_web.py、tests/test_tracker_client.py、tests/test_monitor.py）。
- 8900 自身离线时，8901/8902 用本地默认配置降级运行（独立性铁律）。

## 维护规则

- 契约冻结、联调状态或验收窗口变化时，更新本表与 [project-status](../architecture/project-status.md)
  当前主线；契约正文变更仍以各自契约文档为准（REQ-002 文档治理承接）。
