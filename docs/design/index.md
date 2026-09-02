# 设计文档索引

状态：Current
最后更新：2026-08-20

本目录保存**相对确定的设计文档**：服务契约、dataset 约定、统一配置接口、失败语义和质量门槛
（ADR 0010）。相关任务完成后按三态梳理：合并进 `architecture/` 固定文档 / 归档 `history/` /
保持原状。**8900 固定 API 契约与数据库总纲已迁入 `architecture/`**（[api-contracts](../architecture/api-contracts.md)、
[database-design](../architecture/database-design.md)）。文档分类与元数据规则见
[文档治理规范](../standards/doc-governance.md)。

## 当前文档

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [service-contracts.md](service-contracts.md) | Accepted | In Progress | 三项目对接规范：对接点、统一 qed 库引用（qed_* 共享表只读）、8901 服务接口契约、独立性约定与差距 |
| [web-frontend.md](web-frontend.md) | Accepted | Implemented | 8903 前端契约（当前实现，React v2）：信息架构、交互、视觉、响应式与契约引用（前端架构见 [frontend-architecture](../architecture/frontend-architecture.md)） |
| [frontend-react-refactor.md](frontend-react-refactor.md) | Superseded | Implemented | 前端重构设计（ARCH-011，ADR 0008）：已完成使命，目标态契约并入 [frontend-architecture](../architecture/frontend-architecture.md) |
| [backend-domain-split.md](backend-domain-split.md) | Superseded | Implemented | 后端三域拆分设计（ARCH-012 已实施）：核心目标态并入 [backend-architecture](../architecture/backend-architecture.md) |
| [dataset-conventions.md](dataset-conventions.md) | Accepted | In Progress | 根 dataset 目录约定：数据资料（raw 原始 + parsed 整理后）与元数据入 DB 边界（meta/ 退役，REQ-032） |
| [configuration-and-secrets.md](configuration-and-secrets.md) | Accepted | In Progress | 统一配置与密钥：密钥按项目分置（API_KEY + QED_API_SELECT + QED_API_PROVIDER）、模型模式与 LLM 网关变量、QED_DB_* 统一数据库、映射、原则 |
| [llm-gateway-and-model-management.md](llm-gateway-and-model-management.md) | Accepted | Not Started | LLM 网关与模型管理：api/local 模式路由、本地模型生命周期脚本（text-model/ + image-model/）、资源互斥（QED_RESOURCE_GUARD）、qed_llm_calls 调用记录表、控制台 GPU 总览/依赖卡/调用检索 |
| [service-control.md](service-control.md) | Accepted | Implemented | 控制中心：三 Python 服务启停托管（8900 代理）、服务注册表、监控诊断配套（ARCH-012 已实装） |
| [course-acquisition-flow.md](course-acquisition-flow.md) | Accepted | Not Started | 课程收集流程五阶段（先验体系→一轮评估→下载→二轮评估→完成）与 8903 对齐契约 |
| [exploration.md](exploration.md) | Draft | Not Started | 探索设计（2026-08-18 登记）：文档切分 + 对话式召回验证，替换原始文档对照；解析管理闭环后启动（第四轮主线） |
| [learning-center.md](learning-center.md) | Draft | In Progress | 学习中心探索：课程学习 + 知识问答、工具链选型、知识节点模型、里程碑（框架已搭，2026-08-14；第五轮主线启动） |
| [tech-stack.md](tech-stack.md) | Accepted | In Progress | 技术栈选型：三服务/前端/数据库/模型/解析/向量库选型记录 |
| [downloads-three-table-model.md](downloads-three-table-model.md) | Superseded | Implemented | 三表模型（qt_selections/qt_downloads/qt_sources）历史契约留档：被 QED-031 知识层次重构取代，唯一事实源见 QED-Tracker database-schema.md |
| [integration-matrix.md](integration-matrix.md) | Accepted | In Progress | 联调矩阵与契约冻结编排：A（前端↔8900）/B（8900↔8901）/C（8900↔8902）三组联调边界、契约事实源、前置与验收窗口 |
| [downloads-manage-redesign.md](downloads-manage-redesign.md) | Accepted | Not Started | 下载管理界面重构：左树四层（高等数学→分类→课程→教程叶子+进度）、右侧流程筛选（搜索/确认/下载/验收）、书籍排序、教程命名规范（跨项目 QED-Tracker） |
