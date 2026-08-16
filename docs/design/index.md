# 设计文档索引

状态：Current
最后更新：2026-08-16

本目录保存当前契约与接口：服务间通信、dataset 目录约定、统一配置接口、失败语义和质量门槛。
文档分类与元数据规则见[文档规范](../standards/documentation.md)。

## 当前文档

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [service-contracts.md](service-contracts.md) | Accepted | In Progress | 三项目对接规范：对接点、统一 qed 库引用（qed_* 共享表只读）、8901 服务接口契约（QED-031 后待新契约冻结）、独立性约定与差距 |
| [web-frontend.md](web-frontend.md) | Accepted | Implemented | 8903 前端契约（当前实现，原生三文件版）：信息架构、交互、视觉、响应式与契约引用（test_web 守护；重构切换后重写 v2） |
| [frontend-react-refactor.md](frontend-react-refactor.md) | Accepted | Not Started | 前端重构设计（ARCH-011，ADR 0008）：React 全家桶 web-ui/、核心四界面契约、主题规范、控制台配套数据源、迁移与切换策略 |
| [backend-domain-split.md](backend-domain-split.md) | Accepted | Implemented | 后端三域拆分设计：控制域 / 数据域·Tracker / 数据域·Axiom（预留）、clients/ 与 services/ 结构、并行推进原则（ARCH-012 已实施） |
| [dataset-conventions.md](dataset-conventions.md) | Accepted | In Progress | 根 dataset 目录约定：数据资料（raw 原始 + parsed 整理后）与元数据入 DB 边界（meta/ 退役，REQ-032） |
| [configuration-and-secrets.md](configuration-and-secrets.md) | Accepted | In Progress | 统一配置与密钥：供应商 key、OCR 模型、QED_DB_* 统一数据库、映射、原则 |
| [config-center-api.md](config-center-api.md) | Accepted | In Progress | 8900 后端 API 契约（五合一角色）：配置域（health/models/keys/database 启动快照）/ 数据域语义 API / 服务域 / 监控与诊断域（/logs、/monitor/*、/self-restart），启动自检（LLM/MySQL），密钥不下发 |
| [service-control.md](service-control.md) | Accepted | Implemented | 控制中心：三 Python 服务启停托管（8900 代理）、服务注册表、监控诊断配套（ARCH-012 已实装） |
| [course-acquisition-flow.md](course-acquisition-flow.md) | Accepted | Not Started | 课程收集流程五阶段（先验体系→一轮评估→下载→二轮评估→完成）与 8903 对齐契约 |
| [learning-center.md](learning-center.md) | Draft | In Progress | 学习中心探索：课程学习 + 知识问答、工具链选型、知识节点模型、里程碑（框架已搭，2026-08-14） |
| [tech-stack.md](tech-stack.md) | Accepted | In Progress | 技术栈选型：三服务/前端/数据库/模型/解析/向量库选型记录 |
| [database-design.md](database-design.md) | Accepted | In Progress | 数据库设计：共享 qed 库命名空间（qed_* 共享 / qt_* / af_*）、QED-031 五表清单、学习表族规划、迁移、敏感字段规则 |
| [downloads-three-table-model.md](downloads-three-table-model.md) | Superseded | Implemented | 三表模型（qt_selections/qt_downloads/qt_sources）历史契约留档：被 QED-031 知识层次重构取代，唯一事实源见 QED-Tracker database-schema.md |
| [integration-matrix.md](integration-matrix.md) | Accepted | In Progress | 联调矩阵与契约冻结编排：A（前端↔8900）/B（8900↔8901）/C（8900↔8902）三组联调边界、契约事实源、前置与验收窗口；QED-031 与 Axiom v2 契约冻结节奏（REQ-033/034） |
