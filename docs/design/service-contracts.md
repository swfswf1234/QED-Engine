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
| QED-Tracker → 资源登记 | 单资源 JSON `meta/resources/` + MySQL 三表 `qt_selections`/`qt_downloads`/`qt_sources`（QED-028/029 落地；qt_resources 已退役 QED-030） | JSON 保留文件状态事实 + MySQL 册级明细登记（三表契约见[三表模型](downloads-three-table-model.md)） |

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
- 三表语义契约（QED-028/029；qt_resources 时代的人机协同闭环已随 QED-030 退役）：
  - 表1 选课 `GET /selections?course_id=&status=`（详情 `GET /selections/{id}`，rejected/superseded
    彻底隐藏）、状态机 `candidate → confirmed / backup / rejected / superseded`；
  - 表2 册级明细 `GET /resources/{id}/downloads`、`POST /downloads`（新建候选册）、
    `POST /downloads/{id}/approve|reject|register`（`{relative_path}` 人工下载登记）；
  - 表3 渠道尝试 `GET /downloads/{id}/sources`（失败留痕不展示）；
  - 完整契约与状态机见[三表模型](downloads-three-table-model.md) §3；`InvalidTransition` 返回 409 透传。
- 写操作（下载、论文推荐、扫描、Axiom 推送）一律创建**后台任务**：
  - `POST /tasks/...` 立即返回 `task_id`；`GET /tasks/{id}` 轮询状态与结果；
  - 状态机 `queued → running → succeeded / failed`；进度字段 0–100；
  - 任务记录落盘 `meta/tasks/<task-id>.json`，服务重启后历史可见；
  - 下载任务完成后 `result.relative_path` 指向 `dataset/qed-tracker/raw/` 内成品路径；
  - 同 sha256 已登记时直接 `succeeded` 并复用既有记录（幂等）；
  - 旧 `POST /tasks/catalog/evaluate`（AI 搜索评估）与 `POST /tasks/books/download` 已随
    QED-030 退役；教材下载走目录运行/CLI 经 `BookService` 直接切三表登记。
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
