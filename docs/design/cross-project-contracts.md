# 三项目协同与对接契约（cross-project-contracts）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-10
确认状态：暂定
关联代码：子项目各自仓库（`Axiom-Flow/`、`QED-Tracker/`）、`backend/qed_engine/clients/tracker_client.py`（8901 客户端实现）
关联测试：`tests/test_api.py`、`tests/test_config.py`、`tests/test_tracker_client.py`、`tests/test_web.py`；子项目各自契约测试
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)、[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md)

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
| QED-Tracker → Axiom-Flow | HTTP handoff：`axiom push`（默认 `http://127.0.0.1:8000`） | 地址默认 `http://127.0.0.1:8902`，由配置注入（`QED_AXIOM_URL`） |
| QED-Tracker → dataset/raw | 已迁 `dataset/qed-tracker/`（QED-009） | 冻结（Phase 2 落地） |
| Axiom-Flow → dataset/parsed | 产物写入自身 `data/` | 写入 `dataset/axiom-flow/parsed/`（Phase 3，ALN-003） |
| QED-Engine 统一 CLI → 子项目 | 已落地：`qed tracker` 直连 8901（运维工具，保持直连） | HTTP 调用 8901/8902；地址默认 localhost 端口，可配置 |
| 8903 前端 → 子项目 | **已重构（ADR 0007）**：前端只连 8900，数据域/服务域由 8900 适配 8901/8902 | 冻结（前端唯一入口 8900） |
| QED-Engine 配置中心 → 子项目 | 密钥直读根 `.env`（`load-env.ps1` 映射层已退役，2026-08-17） | 子项目直读 `QED_*` 变量 |
| 三个项目 → MySQL | Axiom-Flow 用 `xqfm11` 库；QED-Tracker 已用 `qed` 库 | 统一 MySQL 8 `qed` 库：QED-Tracker `qt_*`、Axiom-Flow `af_*`、共享元数据 `qed_*`（只读），`QED_DB_*` 唯一事实源 |
| QED-Tracker → 资源登记 | 单资源 JSON `meta/resources/` + MySQL 知识层次五表登记（`qed_domain`/`qed_course` 共享 + `qt_knowledge`/`qt_books`/`qt_sources` 私有，QED-031，取代三表 qt_selections/qt_downloads；表结构见 QED-Tracker `docs/design/database-schema.md`） | **元数据默认存数据库**（2026-08-16 用户裁决）：meta/ JSON 退役（DB 为唯一事实源，存量迁移归档见 REQ-032）；dataset/ 只管理数据资料文件 |

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
- 两态知识模型（QED-031，2026-09-03 重构）与书库化（QED-050）端点一览：

  | 端点 | 语义 |
  | --- | --- |
  | `GET /knowledge?course_id=&status=` | 教程列表（draft/confirmed，废弃行由 notes 记录） |
  | `GET /knowledge/{id}` | 教程详情（含 books[] 由 refs 数组聚合） |
  | `POST /knowledge/{id}/confirm` | 教程 draft→confirmed（无 body，回填 confirmed_at） |
  | `POST /books` `{"knowledge_id","title",...}` | 新建书籍候选（candidate 态） |
  | `GET /books/{id}/sources` | 渠道尝试列表（失败留痕不展示由上游过滤） |
  | `POST /books/{id}/sources` `{"channel",...}` | 登记一次渠道尝试（ok 表达成败） |
  | `POST /books/{id}/register` `{"relative_path"}` | 人工下载登记（candidate/decided → downloaded） |
  | `POST /books/{id}/import` `{"file_path","target_path?"}` | 手动导入 PDF（QED-050，校验+拷入+登记） |
  | `POST /books/{id}/decide` | 候选→决定（candidate → decided） |
  | `POST /books/{id}/start` | 决定→下载中（decided → downloading） |
  | `POST /books/{id}/fail` | 下载失败（downloading → failed） |
  | `POST /books/{id}/retry` | 失败重试（failed → downloading） |
  | `POST /books/{id}/complete` `{"sha256","relative_path",...}` | 下载完成回填（downloading → downloaded） |
  | `POST /books/{id}/verify` | 人工验收（downloaded → verified 终态） |
  | `POST /books/{id}/reject` `{"reason","note?"}` | 书籍否定（reason 必填，硬删+留痕） |
  | `POST /books/{id}/supersede` `{"reason"}` | 书籍过时（版本换代留痕） |
  | `POST /books/{id}/cancel` `{"note?"}` | 取消复位（downloading → decided） |
  | `POST /books/{id}/fetch` | 自动取书（提交 book_download 任务，202） |

  > 书籍端点过渡期标注：选用四态（candidate→decided→parallel→retired）已落地，旧八态
  > 下载机端点（start/fail/retry/complete/verify）仍可用但待 QED-050-D 重规划。

  - `GET /catalogs`、`GET /catalogs/{id}`：内置 JSON 课程目录（math-qe），不受五表重构影响。
  - `/selections`、`/downloads`、`/resources` 等三表端点已随 QED-030/031 退役（8901 返回 404）；
    三表模型历史契约原文已删除（2026-09-10 REQ-070 重组轮，可自 Git 历史查阅，REQ-030/031 时期提交）。
  - 表结构事实源为 QED-Tracker `docs/design/database-schema.md`；8900 数据域同路径透传
    （契约见[配置中心 API 契约](../architecture/api-contracts.md)）。
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
| C：8900 ↔ 8902 | /services 托管 + /monitor/mineru + 数据域·Axiom（api/axiom.py + clients/axiom_client.py） | [service-hosting](service-hosting.md)、Axiom-Flow v2 契约（V2-007 冻结后） |

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
| 子项目数据目录指向自身 `data/` | 产物不集中 | QED-Tracker 侧已迁 `dataset/qed-tracker/`（QED-009）；Axiom-Flow 侧待 ALN-003 |
| Axiom-Flow 端口 8000 | 端口段不统一 | Axiom-Flow 侧（ALN-002），见 REQ-001 |
| 密钥经 `load-env.ps1` 映射 | 双变量名并存 | QED-Tracker 直读 `QED_*` 已落地（QED-009）；映射层已退役（2026-08-17，scripts/ 整理） |
| Axiom-Flow 仍用 `xqfm11` 库 | 无法集中登记与查询 | Axiom-Flow 侧统一 `qed` 库（ALN-003），存量库不迁移；QED-Tracker 侧已落地（QED-012） |

## 执行与验证

- 对接点变更（协议、地址、字段、端口）必须先更新[四服务架构与边界](../architecture/four-service-architecture.md)
  与本文件，并登记 ADR。
- 验证子项目对接时，以各自 README 与测试门禁为准。
