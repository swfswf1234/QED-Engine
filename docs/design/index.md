# 设计文档索引

状态：Current
最后更新：2026-10-18

本目录保存**相对确定的设计文档**，按职责分组：项目配置 / 模型管理 / 项目协同 /
**前端设计（`frontend/` 子目录）** / 后端全链路。每份职责边界单一，后续 plans/ 计划
以此为准选择晋升、合并或修补去向；三态梳理与 DesignRef 同步规则见
[文档治理规范](../standards/doc-governance.md)。

**前端设计集中在 `frontend/` 子目录**（REQ-115 前端设计整合轮）：一份总纲
[frontend-overview.md](frontend/frontend-overview.md) 以「以前端可见视角走通核心全流程」
定视觉正本 / 文案风格 / 核心全流程 / 学习中心·后台管理两部分分工与边界，各模块 UI 详设在
同目录挂指针；技术落地（技术栈 / 路由机制 / 端口 / 独立性降级）在
[frontend-architecture.md](../architecture/frontend-architecture.md)，两者不重叠。

**待晋升（设计稿暂居 `plans/`，评审确认后晋升）**：**文档分析处理**一面（
[REQ-116 设计稿](../plans/2026-10-15-doc-analysis-processing.md)，路由 `#/admin/analysis` 与中文名已由用户 2026-10-18 裁决，待 Axiom-Flow 承接稿回填后晋升 `frontend/doc-analysis.md`）；
学习中心三面**已全部晋升**——「课后练习」2026-10-14 晋升为
[learning-practice-ui.md](frontend/learning-practice-ui.md)（暂定），「知识探索」2026-10-15 以
REQ-104/110/113/114 四行合一份晋升为
[knowledge-point-exploration-ui.md](frontend/knowledge-point-exploration-ui.md)（暂定），
「课程学习」2026-10-18 由 REQ-117 重设计轮晋升为
[learning-course-ui.md](frontend/learning-course-ui.md)（暂定）；原两份晋升稿归档于 `history/plans/2026-10/`
（learning-star-map、learning-workbench-ui），课程学习 v1 稿随 REQ-105 归档同月目录
（2026-10-11-learn-ui-course-study）；
文档切分与召回（原「探索」组，REQ-082）已于 2026-09-22 随 ARCH-021 整合关闭，未来规划
（RAG 切片与检索 + 解析管线优化项目划分）见
[ARCH-025 滚动壳](../plans/2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md)「REQ-089
第一批调研承接」节（旧草案归档 history/plans/2026-08/），设计定稿后按 ADR 0011 晋升。

**已迁出 design/** 的固定契约：8900 对外 API 总纲与数据库总纲在
[api-contracts](../architecture/api-contracts.md) 与
[database-design](../architecture/database-design.md)；前端信息架构与技术落地在
[frontend-architecture](../architecture/frontend-architecture.md)。

## 项目配置

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [project-configuration.md](project-configuration.md) | Accepted | In Progress | 项目配置：三项目 .env 统一变量与密钥规范（根 .env 唯一事实源）+ scripts/ 目录与 config 配置管理细则 |

## 模型管理

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [llm-gateway.md](llm-gateway.md) | Accepted | In Progress | LLM 统一网关·调用面：/llm/* 端点、api/local 模式路由、调用拓扑、qed_llm_calls 调用记录；其他项目不感知模型配置（控制台 UI 见 [admin-console.md](frontend/admin-console.md)，本地模型操作面见 [local-model-management.md](local-model-management.md)） |
| [local-model-management.md](local-model-management.md) | Accepted | In Progress | 本地模型服务维护·操作面（只管模型服务本身，不含 prompt）：模型注册表、/models/{name} 端点族（operate_model 统一入口）、model/ 模型文件目录、MinerU 容器外迁（卷挂载）、资源互斥衔接、健康监督 supervisor（ARCH-028） |

## 项目协同

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [cross-project-contracts.md](cross-project-contracts.md) | Accepted | In Progress | 三项目协同与对接契约（总指引层）：运行与验证矩阵（单项目态/合并态双基准）、契约演进规则（兼容/破坏二分）、错误超时与离线透传、对接点总表、qed 库共享约定（qed_* 共享表只读）、8901/8902 能力面契约（端点形状指针在子仓库与 api-contracts）、8903 前端对接、独立性约定 |
| [service-hosting.md](service-hosting.md) | Accepted | Implemented | 服务托管：8900 控制中心对三 Python 服务的注册表/探测/进程管理启停（ARCH-012 已实装） |
| [dataset-conventions.md](dataset-conventions.md) | Accepted | In Progress | 三项目共享数据根约定：dataset/ raw 原始 + parsed 整理后两区，元数据入 DB（meta/ 退役，REQ-032） |
| [tech-stack.md](tech-stack.md) | Accepted | In Progress | 跨项目技术选型结论与理由：FastAPI 三服务、React 19 + AntD 前端、MySQL 8 共享 qed 库、单线路模型、MinerU 解析 |

## 前端设计（`design/frontend/`）

以**前端可见视角**组织：一份总纲 + 每模块一 UI 详设（主管前端展示，QED-Engine 部分）。

### 总纲

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [frontend-overview.md](frontend/frontend-overview.md) | Draft | In Progress | 前端总设计：视觉正本（蓝白黑 + 简洁，色值以 `web-ui/src/theme.ts` 为唯一正本、本文只定方向）、文案与语言风格、核心全流程（①下载 ②解析 ③文档分析处理 ④学习中心消费）、学习中心·后台管理两部分分工与边界铁律、各模块详设索引 |

### 学习中心 UI（只展示成品、协助学习，零过程性内容）

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [knowledge-point-exploration-ui.md](frontend/knowledge-point-exploration-ui.md) | Accepted | Implemented | 学习中心·知识探索单面 UI（`#/knowledge` 同页两视图：领域星图「层＝行 × 轨迹＝列」森林 ＋ 课程层大知识点虚框与框内条目层级星图，含 `starMapLayout.ts`／`kpTreeLayout.ts` 布局几何唯一正本、悬停与降级矩阵、零跨界出口与零写面硬边界。**暂定**，待人工评审转正） |
| [learning-practice-ui.md](frontend/learning-practice-ui.md) | Accepted | In Progress | 学习中心·课后练习独立面 UI（`#/practice`：课程选择＋今日面板/到期队列/错题本＋题源抽取→人工确认入库→题卡作答判分，含 `exerciseParse.ts` 抽取规格唯一正本与降级矩阵。**暂定**，待人工评审转正） |
| [learning-course-ui.md](frontend/learning-course-ui.md) | Accepted | In Progress | 学习中心·课程学习两屏 UI（`#/learn` 书架清单 ＋ `#/learn/c/:learnCourseId?book=` 单屏工作台：阅读单位＝「章 ＋ 知识点」两级、左栏零处理进度说明、中栏跨页正文流与两档左缘、右栏「学习交流」三段（本章总结与要点／详解（块级）／备注）、推进三枚落正文末尾、按需生成与点赞的消费语义、文案禁现矩阵与降级矩阵。**暂定**，待人工评审转正） |

三面（知识探索／课程学习／课后练习）已全部晋升 `frontend/`；「三面同批晋升」的 2026-10-11 拆分裁决
按 2026-10-14（课后练习先行）、2026-10-15（知识探索四行合一份）、2026-10-18（课程学习随 REQ-117 重设计轮）
分批执行完毕。

### 后台管理 UI（管理全过程链路，专业面向，不辅助学习）

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [admin-console.md](frontend/admin-console.md) | Accepted | In Progress | 管理后台·控制台与模型调用记录页 UI（`#/admin` 三区结构：服务管理/基础设施/资源监控 + `#/admin/llm-calls` 检索与审核） |
| [admin-dashboard.md](frontend/admin-dashboard.md) | Accepted | In Progress | 管理后台·仪表盘只读看板 UI（`#/admin/dashboard`：服务在线 + 文档下载进度双饼图 + 解析进度，统计四态 = holding×status 派生） |
| [downloads-ui.md](frontend/downloads-ui.md) | Accepted | In Progress | 文档下载管理·UI 设计（`#/admin/downloads`：左树领域→课程→教程→论文节点、右侧四层展示 + 领域论文栏、流程筛选与排序、论文探索弹窗五段与检索口径、三层状态口径声明、异常与降级的用户可见表现） |
| [parsing-ui.md](frontend/parsing-ui.md) | Accepted | Implemented | 文档解析管理·UI 设计（`#/admin/parsing`：单屏左书目树（纯选择）+ 右对照区，原页 bbox 双向联动 + 块编辑：判定/备注/文字/范围；资源告警弹窗；后端全链路见 [parsing-flow.md](parsing-flow.md)） |

## 后端全链路（`design/` 顶层·过程与状态机）

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [downloads-flow.md](downloads-flow.md) | Accepted | Implemented | 文档下载管理·后台全链路：领域 6 态 / 课程 5 态状态机、8900 五态门面 6 端点、终态写点矩阵、课程收集五阶段规则（原 course-acquisition-flow 并入）、8901 对齐缺口 |
| [parsing-flow.md](parsing-flow.md) | Accepted | Implemented | 文档解析管理·后端全链路（8900/8902/模型服务三方职责边界 + 全链路数据流（窗口分块/续跑/空白页/版本激活）、统一 blocks schema、产物布局、引擎适配、状态与降级；af_* 结构与 8902 契约唯一事实源在 Axiom-Flow，本档 §2 指针表登记去处） |

## 治理说明

- 新增/调整 design/ 文档须走 REQ（AGENTS.md 变更分级：design/ 大变更须 todo + plans/
  计划先行），文件名使用稳定功能语义名；契约测试 `tests/contract/test_design_documents.py`
  守护本清单与各文档元数据全集（递归覆盖 `frontend/` 子目录）。
- 联调节奏、契约冻结等时效性编排不在 design/ 固定文档中（属活动非设计），由任务台账跟踪。
