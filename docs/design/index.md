# 设计文档索引

状态：Current
最后更新：2026-09-10

本目录保存**相对确定的设计文档**，按五组固定职责（REQ-070 重组轮，2026-09-10）：
项目配置 / 模型管理 / 项目协同 / 后台管理 / 探索。每份职责边界单一，后续 plans/ 计划
以此为准选择晋升、合并或修补去向；三态梳理与 DesignRef 同步规则见
[文档治理规范](../standards/doc-governance.md)。

**置空两类**（现状文档暂居 `plans/`，设计确定后按 ADR 0011 晋升）：文档解析管理、
学习功能（课程学习/课后练习）——现状基座见
[parsing-management-current-state](../plans/2026-09-10-parsing-management-current-state.md)
与 [learning-center-current-state](../plans/2026-09-10-learning-center-current-state.md)。

**已迁出 design/** 的固定契约：8900 对外 API 总纲与数据库总纲在
[api-contracts](../architecture/api-contracts.md) 与
[database-design](../architecture/database-design.md)；前端信息架构与视觉规范在
[frontend-architecture](../architecture/frontend-architecture.md)。

## 项目配置

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [project-configuration.md](project-configuration.md) | Accepted | In Progress | 项目配置：三项目 .env 统一变量与密钥规范（根 .env 唯一事实源）+ scripts/ 目录与 config 配置管理细则 |

## 模型管理

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [llm-gateway.md](llm-gateway.md) | Accepted | In Progress | LLM 统一网关·调用面：/llm/* 端点、api/local 模式路由、调用拓扑、qed_llm_calls 调用记录；其他项目不感知模型配置（控制台 UI 见 [admin-console.md](admin-console.md)，本地模型操作面见 [local-model-management.md](local-model-management.md)） |
| [local-model-management.md](local-model-management.md) | Accepted | In Progress | 本地模型管理·操作面：模型注册表、/models/{name} 端点族（operate_model 统一入口）、model/ 模型文件目录、MinerU 容器外迁（卷挂载）、资源互斥衔接 |

## 项目协同

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [cross-project-contracts.md](cross-project-contracts.md) | Accepted | In Progress | 三项目协同与对接契约：对接点总表、qed 库共享约定（qed_* 共享表只读）、8901 原生契约正文、独立性约定与差距、联调编排约定（原 integration-matrix 并入） |
| [service-hosting.md](service-hosting.md) | Accepted | Implemented | 服务托管：8900 控制中心对三 Python 服务的注册表/探测/进程管理启停（ARCH-012 已实装） |
| [dataset-conventions.md](dataset-conventions.md) | Accepted | In Progress | 三项目共享数据根约定：dataset/ raw 原始 + parsed 整理后两区，元数据入 DB（meta/ 退役，REQ-032） |
| [tech-stack.md](tech-stack.md) | Accepted | In Progress | 跨项目技术选型结论与理由：FastAPI 三服务、React 19 + AntD 前端、MySQL 8 共享 qed 库、单线路模型、MinerU 解析 |

## 后台管理

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [admin-console.md](admin-console.md) | Accepted | In Progress | 管理后台·控制台与模型调用记录页 UI（`#/admin` 四区结构 + `#/admin/llm-calls` 检索与审核，REQ-060 已实现） |
| [admin-dashboard.md](admin-dashboard.md) | Accepted | In Progress | 管理后台·仪表盘只读看板 UI（`#/admin/dashboard`：服务在线 + 文档下载进度双饼图 + 解析进度，统计四态 = holding×status 派生） |
| [downloads-ui.md](downloads-ui.md) | Accepted | In Progress | 文档下载管理·UI 设计（`#/admin/downloads`：左树领域→课程→教程、右侧四层展示、流程筛选与排序、三层状态口径声明） |
| [downloads-flow.md](downloads-flow.md) | Accepted | Implemented | 文档下载管理·后台全链路：领域 6 态 / 课程 5 态状态机、8900 五态门面 6 端点、终态写点矩阵、课程收集五阶段规则（原 course-acquisition-flow 并入）、8901 对齐缺口 |

## 探索

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [document-chunking-recall.md](document-chunking-recall.md) | Draft | Not Started | 文档切分与召回草案（对话式探索验证，替换已删除的原始文档对照；解析管理闭环后启动） |

## 治理说明

- 新增/调整 design/ 文档须走 REQ（AGENTS.md 变更分级：design/ 大变更须 todo + plans/
  计划先行），文件名使用稳定功能语义名；契约测试 `tests/contract/test_design_documents.py`
  守护本清单与各文档元数据全集。
- 联调节奏、契约冻结等时效性编排不在 design/ 固定文档中（属活动非设计），由任务台账
  跟踪（见 cross-project-contracts.md「联调编排约定」节）。
