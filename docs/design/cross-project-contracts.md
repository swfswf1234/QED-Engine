# 三项目协同与对接契约（cross-project-contracts）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-14
确认状态：暂定
关联代码：子项目各自仓库（`Axiom-Flow/`、`QED-Tracker/`）、`backend/qed_engine/clients/tracker_client.py`（8901 客户端实现）
关联测试：`tests/test_api.py`、`tests/test_config.py`、`tests/test_tracker_client.py`、`tests/test_web.py`；子项目各自契约测试
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)、[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md)、[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)

## 目的与边界

本文件定义 QED-Engine、Axiom-Flow、QED-Tracker 三个项目的对接点与边界。四服务各自的内部
细节以各项目自身文档为准；本文件只描述跨项目契约。8903 前端界面契约见
[前端架构](../architecture/frontend-architecture.md)。

## 服务与契约边界

四服务的结构、职责、端口与独立性铁律见[四服务架构与边界](../architecture/four-service-architecture.md)
（唯一事实源）；本文件只描述跨项目对接点与接口契约。

## 对接点

| 对接点 | 现状 | 目标 |
| --- | --- | --- |
| QED-Tracker → Axiom-Flow | HTTP handoff：`axiom push`（默认 `http://127.0.0.1:8902`，8000 兼容保留） | 冻结（`QED_AXIOM_URL` 配置注入） |
| QED-Tracker → dataset/raw | 已迁 `raw/<domain_id>/...`（QED-009 / ARCH-019）；探索产物与下载成品落 `raw/<domain_id>/<course_id>/` | 冻结（含 JSON 例外口径，REQ-078） |
| Axiom-Flow → dataset/parsed | 产物写入自身 `data/`（过渡） | 写入 `<QED_DATA_ROOT>/parsed/<domain_id>/<course_id>/<book_id>/`（ARCH-020，[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)） |
| Axiom-Flow → 本地模型服务 | 解析经 8900 `/llm/vision` 网关（v0.1） | **直连本地模型服务**（引擎适配器，MinerU 5002 等）；8900 只负责模型生命周期与探针（[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)） |
| QED-Engine 统一 CLI → 子项目 | 已落地：`qed tracker` 直连 8901（运维工具，保持直连） | HTTP 调用 8901/8902；地址默认 localhost 端口，可配置 |
| 8903 前端 → 子项目 | **已重构（ADR 0007）**：前端只连 8900，数据域/服务域由 8900 适配 8901/8902 | 冻结（前端唯一入口 8900） |
| QED-Engine 配置中心 → 子项目 | 子项目直读根 `.env`（`load-env.ps1` 映射层已于 2026-08-17 退役） | 冻结（子项目直读 `QED_*` 变量） |
| 三个项目 → MySQL | QED-Tracker 与 Axiom-Flow 均用 `qed` 库（ARCH-020 统一） | 统一 MySQL 8 `qed` 库：QED-Tracker `qt_*`、Axiom-Flow `af_*`、共享元数据 `qed_*`（只读），`QED_DB_*` 唯一事实源；遗留 `qed_test`（测试库）、`axiom`/`xqfm` 库由 ARCH-020-F 清理 |
| QED-Tracker → 资源登记 | 单资源 JSON `meta/resources/` + MySQL 知识层次五表登记（`qed_domain`/`qed_course` 共享 + `qt_knowledge`/`qt_books`/`qt_sources` 私有，QED-031；表结构见 QED-Tracker `docs/architecture/database-private-tables.md` 与 `database-shared-tables.md`） | **元数据默认存数据库**（2026-08-16 用户裁决）：meta/ JSON 退役（DB 为唯一事实源，存量迁移归档见 REQ-032）；dataset/ 只管理数据资料文件 |

## 统一数据库（MySQL 8，qed 库）

2026-08-04 用户裁决、[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md) 登记：新建
MySQL 8 `qed` 库，三个项目共用同一实例与库（表命名空间隔离，属独立性铁律的明确例外）。
2026-08-16 [ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md) 补充：新增 `qed_*` 共享前缀表族
（`qed_domain`/`qed_course` 课程体系元数据），所有权 QED-Tracker（建表维护），其他项目
**只读不写**；共享表不复制 JSON，QED-Tracker 侧 `courses/math.json` 退役。
表命名空间、表清单、关键字段、迁移与敏感字段规则见[数据库设计](../architecture/database-design.md)；
凭据与库名唯一事实源为根 `.env` 的 `QED_DB_*`（见
[project-configuration.md](project-configuration.md)），密码绝不下发到任何接口响应。

## QED-Tracker 服务接口契约（8901，Phase 2 落地）

- 前缀 `/api/v1`；`GET /api/v1/health` 存活检查。
- 只读查询（搜索、资源列表、选择报告、目录）同步返回；8903 浏览器已不直连本服务
  （ADR 0007，经 8900 数据域语义 API 访问）；8900 后端服务端到服务端调用不受 CORS 限制。
- 两态知识模型（QED-031）+ 书库化（QED-050-D）+ 下载生命周期（QED-060）端点一览
  （2026-09-11 与 QED-Tracker `docs/architecture/api.md` 对齐）：

  | 端点 | 语义 |
  | --- | --- |
  | `GET /domains`、`GET /courses`、`GET /courses/{domain_id}` | 领域/课程体系只读（qed_* 共享表） |
  | `GET /domains/{id}` | 领域详情（已生成态优先回 domains.json） |
  | `POST /domains`、`PATCH /domains/{id}`、`DELETE /domains/{id}` | 领域维护 |
  | `POST /domains/import` | 手动领域 JSON 导入（只写 domains.json + 已生成；source 已退役） |
  | `POST /domains/{id}/confirm` | 确认领域（双分支：含 courses→写 courses.json/待确认；否则异步 courses@v8/探索中） |
  | `POST /domains/{id}/courses/import` | 从 domains.json 同步课程行（待确认） |
  | `POST /domains/{id}/apply-results` | 确认领域探索结果（待确认→已完成） |
  | `POST /domains/{id}/re-explore`、`POST /courses/{id}/re-explore` | 重探（→探索中，202） |
  | `POST /courses/{id}/knowledge` | 采纳推荐建 draft 教程 + decided/parallel 书行 |
  | `GET /knowledge?course_id=&status=`、`GET /knowledge/{id}` | 教程列表/详情（books[] 由 refs 聚合） |
  | `POST /knowledge/{id}/confirm`、`PATCH /knowledge/{id}`、`DELETE /knowledge/{id}` | 教程定稿/更新/删除 |
  | `POST /knowledge/{id}/fetch`、`POST /books/{id}/fetch` | 教程级/书级取书（202 后台任务） |
  | `POST /books` | 书库化创建（`book_id`+`title`，无 knowledge_id） |
  | `GET /books/{id}/sources`、`POST /books/{id}/sources` | 渠道尝试列表/登记（ok 表达成败） |
  | `POST /books/{id}/register`、`POST /books/{id}/import` | 原地登记/人工导入（`mark_owned` → owned+downloaded） |
  | `POST /books/{id}/start`、`/fail`、`/verify`、`/cancel` | 下载生命周期迁移（QED-060；非法迁移 409） |
  | `GET /books/search`、`GET /papers/search` | 教材/论文候选搜索（非主线） |
  | `GET /catalogs`、`GET /catalogs/{id}` | 内置 JSON 课程目录（math-qe） |
  | `GET /tasks`、`GET /tasks/{id}`、`POST /tasks/{type}` | 后台任务轮询/提交 |
  | `POST /prompt-explores/dry-run`、`POST /courses/{id}/prompt-explores/dry-run` | 探索评估（同步，不落库） |

  > **书籍端点变更（QED-060）**：旧八态端点 `decide/retry/complete/reject/supersede`
  > **已删除**；`start/fail/verify/cancel` 以新下载生命周期语义保留（`decided → downloading
  > → downloaded → verified`，`failed` 可重试，`cancel` 仅 downloading 复位 decided）。
  > 8900 路由集对齐见 [api-contracts §③.9](../architecture/api-contracts.md)。

  - `GET /catalogs`、`GET /catalogs/{id}`：内置 JSON 课程目录（math-qe），不受五表重构影响。
  - `/selections`、`/downloads`、`/resources` 等三表端点已随 QED-030/031 退役（8901 返回 404）；
    三表模型历史契约原文已删除（2026-09-10 REQ-070 重组轮，可自 Git 历史查阅，REQ-030/031 时期提交）。
  - 表结构事实源为 QED-Tracker `docs/architecture/database-private-tables.md`（qt_*）与
    `database-shared-tables.md`（qed_*）；8900 数据域同路径透传
    （契约见[8900 API 接口文档](../architecture/api-contracts.md)）。
- 写操作（下载、论文推荐、扫描、Axiom 推送）一律创建**后台任务**：
  - `POST /tasks/...` 立即返回 `task_id`；`GET /tasks/{id}` 轮询状态与结果；
  - 状态机 `queued → running → succeeded / failed`；进度字段 0–100；
  - 任务记录落盘 `qt_tasks` 表（REQ-032，迁移 0016 建，替代 `meta/tasks/` JSON 文件）；
  - 同 sha256 已登记时直接 `succeeded` 并复用既有记录（幂等）；
  - 旧 `POST /tasks/catalog/evaluate`（AI 搜索评估）与 `POST /tasks/books/download` 已随
    QED-030 退役；教材下载走目录运行/CLI 经 `BookService` 直接登记 qt_books（五层模型）。
- 该接口同时供统一 CLI（等待模式，直连 8901）与 8900 数据域语义 API（适配层，契约见
  [配置中心 API 契约](../architecture/api-contracts.md)）调用；8903 前端只经 8900 访问。

## 8903 前端对接

8903 前端（`web-ui/`）的组成、信息架构、交互、视觉与响应式契约见[前端架构](../architecture/frontend-architecture.md)；
本文件只记录其对接要点：**前端只连 8900**（ADR 0007，QED-Engine 后端网关化）——配置域
（横幅/健康）、数据域（目录/资源/任务）、服务域（/services 服务状态）全部经 8900 获取，
浏览器不直连 8901/8902；子项目 CORS 收窄为可选后续请求（本轮不做）。8900 的接口族与角色
见[配置中心 API 契约](../architecture/api-contracts.md)。

## 联调编排约定

三组联调的**分组边界与并行规则**（原 integration-matrix.md 编排并入，2026-09-10）：

| 组 | 接口面 | 契约事实源 |
| --- | --- | --- |
| A：前端 ↔ 8900 | 8903（web-ui）→ 8900 全部域（配置/数据域/服务域/监控诊断），只连 8900 | [api-contracts](../architecture/api-contracts.md)、[service-hosting](service-hosting.md) |
| B：8900 ↔ 8901 | 数据域适配（api/tracker.py + clients/tracker_client.py）+ /services 托管启停 | 本文件（8901 契约）、[database-design](../architecture/database-design.md) |
| C：8900 ↔ 8902 | /services 托管 + /monitor/mineru + 数据域·Axiom（api/axiom.py + clients/axiom_client.py）；解析管线在 8902 直连模型服务 | [service-hosting](service-hosting.md)、[交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md)（8902 契约事实源）、[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md) |

- **只做编排，不复制契约正文**——各组契约事实源仍为上表契约文档。
- **三组可并行推进**：每组联调中非本组服务离线时功能降级正常（503 / 离线横幅 / 空态），
  独立性铁律由既有契约测试守护（tests/test_api.py、tests/test_web.py、
  tests/test_tracker_client.py、tests/test_monitor.py）。
- **契约冻结与验收**：跨仓库契约冻结（如 QED-031 新表契约、Axiom-Flow v2）以归属仓库
  回执为准；联调验收窗口与执行状态由[任务台账](../trackers/todo.md)与
  [project-status](../trackers/project-status.md) 跟踪，本文件不维护时序状态。

## 独立性约定

独立性铁律见[四服务架构与边界](../architecture/four-service-architecture.md)（唯一事实源）。
契约特有补充：QED-Engine 后端离线时，Axiom-Flow 与 QED-Tracker 用本地默认配置降级运行；
无根 `.env` 时使用内置最小默认值并输出提醒。跨项目传递只通过：HTTP 接口、共享 dataset 目录、
环境变量与表隔离的共享 qed 库（见[统一配置与密钥规范](project-configuration.md)）。

## 现状差距与后续改造

| 差距 | 影响 | 改造归属 |
| --- | --- | --- |
| 子项目数据目录指向自身 `data/` | 产物不集中 | QED-Tracker 侧已迁 `raw/`（QED-009）；Axiom-Flow 侧迁 `parsed/<domain>/<course>/<book_id>/`（ARCH-020-C） |
| Axiom-Flow 仍用遗留库（`axiom`/`xqfm`） | 无法集中登记与查询 | Axiom-Flow 侧统一 `qed` 库（ARCH-020-C/F），遗留库备份后删除；QED-Tracker 侧已落地（QED-012） |
| 8900 书籍路由集与 8901 新契约不一致 | 书目操作联调 404/语义偏差 | 根仓库代码跟进（[api-contracts §③.9](../architecture/api-contracts.md)，PLAN-038） |
| 探索产物 JSON 入 `raw/` 的 dataset 例外 | 与「dataset 不维护 JSON 状态事实源」口径并存 | REQ-078（请求：QED-Tracker），回执后同步 `dataset-conventions.md` |

## 执行与验证

- 对接点变更（协议、地址、字段、端口）必须先更新[四服务架构与边界](../architecture/four-service-architecture.md)
  与本文件，并登记 ADR。
- 验证子项目对接时，以各自 README 与测试门禁为准。
