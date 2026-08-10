# 三项目对接规范

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-11
关联代码：子项目各自仓库（`Axiom-Flow/`、`QED-Tracker/`）、`scripts/load-env.ps1`、`backend/qed_engine/tracker_client.py`（8901 客户端实现）
关联测试：`tests/test_api.py`、`tests/test_config.py`、`tests/test_tracker_client.py`、`tests/test_web.py`；子项目各自契约测试
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)、[ADR 0003](../adr/0003-shared-qed-database-independence.md)、[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)

## 目的与边界

本文件定义 QED-Engine、Axiom-Flow、QED-Tracker 三个项目的对接点与边界。四服务各自的内部
细节以各项目自身文档为准；本文件只描述跨项目契约。8903 前端界面契约见
[8903 前端契约](web-frontend.md)。

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
| QED-Engine 配置中心 → 子项目 | 密钥直读根 `.env`（经 `load-env.ps1` 映射） | 子项目直读 `QED_*` 变量，映射层退役 |
| 三个项目 → MySQL | Axiom-Flow 用 `xqfm11` 库；QED-Tracker 已用 `qed` 库 | 统一 MySQL 8 `qed` 库：QED-Tracker `qt_*`、Axiom-Flow `af_*`，`QED_DB_*` 唯一事实源 |
| QED-Tracker → 资源登记 | JSON `meta/resources/` + MySQL `qt_resources` 双写（QED-012 已落地） | JSON 保留文件状态事实 + MySQL 查询索引（双写契约见[数据库设计](database-design.md)） |

## 统一数据库（MySQL 8，qed 库）

2026-08-04 用户裁决、[ADR 0003](../adr/0003-shared-qed-database-independence.md) 登记：新建
MySQL 8 `qed` 库，三个项目共用同一实例与库（表命名空间隔离，属独立性铁律的明确例外）。
表命名空间、表清单、关键字段、迁移与敏感字段规则见[数据库设计](database-design.md)；
凭据与库名唯一事实源为根 `.env` 的 `QED_DB_*`（见
[configuration-and-secrets.md](configuration-and-secrets.md)），密码绝不下发到任何接口响应。

## QED-Tracker 服务接口契约（8901，Phase 2 落地）

- 前缀 `/api/v1`；`GET /api/v1/health` 存活检查。
- 只读查询（搜索、资源列表、选择报告、目录）同步返回；8903 浏览器已不直连本服务
  （ADR 0007，经 8900 数据域语义 API 访问）；8900 后端服务端到服务端调用不受 CORS 限制。
- 资源清单与状态机（2026-08-05 用户裁决，人机协同闭环；2026-08-06 QED-017 增补人工评估三态；
  2026-08-07 QED-020 增补评审建议）：
  - `GET /resources?status=&course_id=&kind=&language=`、`GET /resources/{id}` 同步查询；
  - 状态机 `candidate → confirmed → downloading → downloaded → approved / rejected`
    （+ `failed` 终态可重试；`pending_manual`/`not_found` 为登记辅助状态；
    `backup` 备选态：candidate→backup→{confirmed,rejected}，pending_manual 可直接转 backup）；
  - `GET /resources/{id}/file` 返回 PDF 预览流（仅 downloaded/approved 可访问，供 8903 验收台）；
  - `POST /resources/{id}/confirm`（candidate/backup→confirmed）、`POST /resources/{id}/backup`
    （candidate/pending_manual→backup，人工评估"备选"）、`POST /resources/{id}/approve`
    （downloaded→approved）、`POST /resources/{id}/reject {reason}`（candidate/backup 或
    downloaded→rejected；reason 必填；后者同步硬删文件，DB 记录保留留痕）——同步轻量写操作；
    confirm/backup/reject 三接口接受可选 `note` 参数（人工评审建议，落 `qt_resources.review_note`，
    资源查询返回该字段）；
  - 人工评估三态：**确定**=confirm、**备选**=backup（不下载，可转正/放弃）、**否定**=reject；
    中文教材候选确定优先，中文不可得时英文候选由人工决定；评估与下载后验收分离。
- 写操作（下载、论文推荐、目录批处理、扫描、Axiom 推送、**评估**）一律创建**后台任务**：
  - `POST /tasks/...` 立即返回 `task_id`；`GET /tasks/{id}` 轮询状态与结果；
  - 状态机 `queued → running → succeeded / failed`；进度字段 0–100；
  - 任务记录落盘 `meta/tasks/<task-id>.json`，服务重启后历史可见；
  - 下载任务完成后 `result.relative_path` 指向 `dataset/qed-tracker/raw/` 内成品路径；
  - 同 sha256 已登记时直接 `succeeded` 并复用既有记录（幂等）；
  - `POST /tasks/catalog/evaluate {course_id?}`：按课程批量评估任务（搜索源 → qwen 评估 →
    候选落库，candidate 状态；course_id 缺省=全目录；缺模型密钥时降级跳过评估仅落候选）；
    已评估目标（backup/approved/rejected 行）跳过不重复推荐。
- 该接口同时供统一 CLI（等待模式，直连 8901）与 8900 数据域语义 API（适配层，契约见
  [配置中心 API 契约](config-center-api.md)）调用；8903 前端只经 8900 访问。

## 8903 前端对接

8903 前端（`web/`）的组成、信息架构、交互、视觉与响应式契约见[8903 前端契约](web-frontend.md)；
本文件只记录其对接要点：**前端只连 8900**（ADR 0007，QED-Engine 后端网关化）——配置域
（横幅/健康）、数据域（目录/资源/任务）、服务域（/services 服务状态）全部经 8900 获取，
浏览器不直连 8901/8902；子项目 CORS 收窄为可选后续请求（本轮不做）。8900 的接口族与角色
见[配置中心 API 契约](config-center-api.md)。

## 独立性约定

独立性铁律见[四服务架构与边界](../architecture/four-service-architecture.md)（唯一事实源）。
契约特有补充：QED-Engine 后端离线时，Axiom-Flow 与 QED-Tracker 用本地默认配置降级运行；
无根 `.env` 时使用内置最小默认值并输出提醒。跨项目传递只通过：HTTP 接口、共享 dataset 目录、
环境变量与表隔离的共享 qed 库（见[统一配置与密钥规范](configuration-and-secrets.md)）。

## 现状差距与后续改造

| 差距 | 影响 | 改造归属 |
| --- | --- | --- |
| 子项目数据目录指向自身 `data/` | 产物不集中 | QED-Tracker 侧已迁 `dataset/qed-tracker/`（QED-009）；Axiom-Flow 侧待 ALN-003 |
| Axiom-Flow 端口 8000 | 端口段不统一 | Axiom-Flow 侧（ALN-002），见 REQ-001 |
| 密钥经 `load-env.ps1` 映射 | 双变量名并存 | QED-Tracker 直读 `QED_*` 已落地（QED-009）；映射层退役待 Axiom-Flow 侧（ALN-003） |
| Axiom-Flow 仍用 `xqfm11` 库 | 无法集中登记与查询 | Axiom-Flow 侧统一 `qed` 库（ALN-003），存量库不迁移；QED-Tracker 侧已落地（QED-012） |

## 执行与验证

- 对接点变更（协议、地址、字段、端口）必须先更新[四服务架构与边界](../architecture/four-service-architecture.md)
  与本文件，并登记 ADR。
- 验证子项目对接时，以各自 README 与测试门禁为准。
