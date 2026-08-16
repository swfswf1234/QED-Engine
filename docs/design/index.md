# 设计文档索引

状态：Current
最后更新：2026-08-16

本目录保存当前契约与接口：服务间通信、dataset 目录约定、统一配置接口、失败语义和质量门槛。
文档分类与元数据规则见[文档规范](../standards/documentation.md)。

## 当前文档

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [service-contracts.md](service-contracts.md) | Accepted | In Progress | 三项目对接规范：对接点、统一 qed 库引用、8901 服务接口契约、独立性约定与差距 |
| [web-frontend.md](web-frontend.md) | Accepted | Implemented | 8903 前端契约（当前实现，原生三文件版）：信息架构、交互、视觉、响应式与契约引用（test_web 守护；重构切换后重写 v2） |
| [frontend-react-refactor.md](frontend-react-refactor.md) | Accepted | Not Started | 前端重构设计（ARCH-011，ADR 0008）：React 全家桶 web-ui/、核心四界面契约、主题规范、控制台配套数据源、迁移与切换策略 |
| [backend-domain-split.md](backend-domain-split.md) | Accepted | Not Started | 后端三域拆分设计：控制域 / 数据域·Tracker / 数据域·Axiom（预留）、clients/ 与 services/ 目标结构、并行推进原则 |
| [dataset-conventions.md](dataset-conventions.md) | Accepted | In Progress | 根 dataset 目录约定：raw/parsed/meta 契约、资源登记双写 |
| [configuration-and-secrets.md](configuration-and-secrets.md) | Accepted | In Progress | 统一配置与密钥：供应商 key、OCR 模型、QED_DB_* 统一数据库、映射、原则 |
| [config-center-api.md](config-center-api.md) | Accepted | In Progress | 配置中心 API 契约：health / 模型路由 / 供应商与数据库状态 / 数据域语义 API / 服务域 / 监控与诊断域（/logs、/monitor/*、/self-restart 规划），密钥不下发 |
| [service-control.md](service-control.md) | Accepted | In Progress | 控制中心：三 Python 服务启停托管（8900 代理）、服务注册表、前端控制台增强规划（2026-08-16） |
| [course-acquisition-flow.md](course-acquisition-flow.md) | Accepted | Not Started | 课程收集流程五阶段（先验体系→一轮评估→下载→二轮评估→完成）与 8903 对齐契约 |
| [learning-center.md](learning-center.md) | Draft | Not Started | 学习中心探索：课程学习 + 知识问答、工具链选型、知识节点模型、里程碑 |
| [tech-stack.md](tech-stack.md) | Accepted | In Progress | 技术栈选型：三服务/前端/数据库/模型/解析/向量库选型记录 |
| [database-design.md](database-design.md) | Accepted | In Progress | 数据库设计：共享 qed 库命名空间、qt_*/af_* 表清单与关键字段、迁移、敏感字段规则 |
| [downloads-three-table-model.md](downloads-three-table-model.md) | Draft | Not Started | 文档下载管理三表模型：qt_selections/qt_downloads/qt_sources 模型视图、状态机、API 对齐、前端契约与一次性迁移 |
