# 四服务架构与边界

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-11
关联代码：根 `scripts/check_api_keys.py`、`scripts/load-env.ps1`（配置中心代码见[配置中心 API 契约](../design/config-center-api.md)）
关联测试：`tests/contract/test_architecture_documents.py`
关联 ADR：`docs/adr/0002-frontend-and-port-centralization.md`、`docs/adr/0003-shared-qed-database-independence.md`、`docs/adr/0004-personal-library-positioning.md`、`docs/adr/0005-control-center-service-hosting.md`、`docs/adr/0007-qed-engine-backend-gateway.md`

## 服务视图

QED-Engine 由四个独立服务组成，分别位于三个独立 git 仓库：

```mermaid
flowchart LR
    subgraph Root[QED-Engine 仓库]
        FE[QED-Engine 前端<br/>学习中心 + 管理后台 8903]
        CC[QED-Engine 后端 8900<br/>配置域 + 数据域网关 + 控制中心]
    end
    subgraph AF[QED-Engine 仓库/Axiom-Flow 子仓库]
        A[API + Worker 8902]
    end
    subgraph TR[QED-Engine 仓库/QED-Tracker 子仓库]
        T[下载/校验/登记服务 8901]
    end

    FE -->|唯一入口：配置/数据/服务域| CC
    CC -->|数据域适配 8901| T
    CC -->|服务托管与探测| T
    CC -->|服务托管与探测| A
    T -->|原始 PDF| R[(dataset/qed-tracker/raw)]
    A -->|解析产物| P[(dataset/axiom-flow/parsed)]
    P --> FE
```

## 服务职责与端口

| 服务 | 仓库 | 端口 | 职责 |
| --- | --- | --- | --- |
| QED-Engine 前端 | 根仓库 `web/` | 8903（已运行） | 学习中心（建设中）+ 管理后台四项（仪表大盘 / 文档下载管理 / 文档解析进度 / 原始文档对照）；**只连 8900**（ADR 0007） |
| QED-Engine 后端 | 根仓库 `backend/qed_engine/` | 8900（已运行） | 配置域（健康/模型/密钥/数据库/LLM 状态，密钥不下发）+ 数据域网关（catalogs/resources/tasks 适配 8901）+ 服务域（/services 启停托管，控制中心已实装，ADR 0005/0007） |
| Axiom-Flow | `Axiom-Flow/` 子仓库 | 8902（迁移中，当前 8000） | PDF 解析、OCR、质量审阅与知识发布；前端工作台迁入根仓库后只保留 API + Worker |
| QED-Tracker | `QED-Tracker/` 子仓库 | 8901（已服务化） | 教材/习题集/论文的发现、下载、校验、登记；写操作后台任务 + 轮询 |

端口规划（8900 配置中心 / 8901 QED-Tracker / 8902 Axiom-Flow / 8903 前端）见
[ADR 0002](../adr/0002-frontend-and-port-centralization.md)；前端唯一入口与 8900 网关化见
[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)；服务接口契约见
[服务契约](../design/service-contracts.md)。

## 三中心产品形态

- **学习中心**：前端主界面（`#/`）的最终形态——课程学习 + 知识问答，向用户展示的核心功能
  （[学习中心设计](../design/learning-center.md)，探索中）。
- **管理中心**：后台内容管理——文档下载管理 / 解析进度 / 原始文档对照（8903 已运行）。
- **控制中心**：后台运行控制——8900 对 8901/8902 服务启停托管
  （[服务控制设计](../design/service-control.md)，Accepted / **Implemented（2026-08-11，ADR 0007 轮）**；
  [ADR 0005](../adr/0005-control-center-service-hosting.md)；容器化依赖只进规划不展示）。

## 独立性铁律

- Axiom-Flow 与 QED-Tracker 未启动时，QED-Engine 前端对话/展示必须正常，管理界面显示服务离线。
- QED-Engine 配置中心离线时，Axiom-Flow 与 QED-Tracker 用本地默认配置降级运行。
- 三个项目各自独立部署、独立升级，不共享 Python 包或代码仓库；MySQL 例外为共享 `qed` 库实例
  （[ADR 0003](../adr/0003-shared-qed-database-independence.md)），以 `qt_*`/`af_*` 表命名空间
  隔离。
- 跨项目传递只通过：HTTP 接口、共享 dataset 目录、环境变量与表隔离的共享 qed 库（见
  [统一配置与密钥规范](../design/configuration-and-secrets.md)）。

## 前端统一路线

现状：

1. Axiom-Flow 自带 `web/` 原生工作台（8000 端口同源服务）。
2. QED-Engine 根仓库 `web/` 已建立并运行（8903），学习界面与管理后台共同维护
   （五期起零后台痕迹、四阶段仪表盘、十五期下载管理改版已完成，见[8903 前端契约](../design/web-frontend.md)）。

目标：

3. Axiom-Flow `web/` 迁入根仓库（API base 指向 8902），子项目退役 `web/`；两侧 CORS 调整
   （8903 已只连 8900，子项目 CORS 收窄为后续可选请求，ADR 0007 决定 6）。

端口：

4. Axiom-Flow 由 8000 迁移至 8902；QED-Tracker 已服务化使用 8901；QED-Engine 前端使用 8903。

## 架构符合度

| Accepted 约束 | 当前状态 | 证据与跟踪 |
| --- | --- | --- |
| 配置中心五接口任何时刻可用 | 符合 | `backend/qed_engine/api/main.py`，`tests/test_api.py`（health/models/keys/database/llm-status） |
| 密钥绝不下发 | 符合 | `tests/test_api.py` 验证响应无密钥值 |
| 前端唯一入口 8900（ADR 0007） | 符合 | `web/app.js` API_BASE + `/services`；`tests/test_web.py` 守护无 8901/8902 直连 |
| 数据域语义 API（8900 自有契约） | 符合 | `backend/qed_engine/api/data.py`，`tests/test_api.py`（透传/503/409/PDF 流） |
| 服务控制端实装（ADR 0005/0007） | 符合 | `backend/qed_engine/api/service_manager.py`，`tests/test_api.py`（启停/窗口/409/404） |
| Axiom-Flow 端口 8902 | 未迁移 | 当前仍为 8000，见 [任务台账](../trackers/todo.md) REQ-001 |
| QED-Tracker 服务化 8901 | 已服务化 | 2026-08 完成（子仓库 QED-008~010 服务化轮），写操作后台任务 + 轮询 |
| 前端统一于根仓库（8903） | 已运行 | REQ-006 十五期完成；Axiom web/ 迁移待 REQ-005 |
| 数据子域布局（dataset/qed-tracker、dataset/axiom-flow） | 骨架已建 | 见 [dataset 目录约定](../design/dataset-conventions.md) 与 REQ-003/REQ-004 |
| 三中心形态（学习/管理/控制） | 学习建设中 + 管理已运行 + 控制已实装 | [ADR 0004](../adr/0004-personal-library-positioning.md)；控制中心见 [服务控制设计](../design/service-control.md)（Implemented） |
