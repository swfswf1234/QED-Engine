# 四服务架构与边界

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-09
关联代码：根 `scripts/check_api_keys.py`、`scripts/load-env.ps1`（配置中心代码见[配置中心 API 契约](../design/config-center-api.md)）
关联测试：`tests/contract/test_architecture_documents.py`
关联 ADR：`docs/adr/0002-frontend-and-port-centralization.md`、`docs/adr/0003-shared-qed-database-independence.md`、`docs/adr/0004-personal-library-positioning.md`、`docs/adr/0005-control-center-service-hosting.md`

## 服务视图

QED-Engine 由四个独立服务组成，分别位于三个独立 git 仓库：

```mermaid
flowchart LR
    subgraph Root[QED-Engine 仓库]
        FE[QED-Engine 前端<br/>学习中心 + 管理后台 8903]
        CC[配置中心 8900<br/>控制中心：服务托管规划]
    end
    subgraph AF[QED-Engine 仓库/Axiom-Flow 子仓库]
        A[API + Worker 8902]
    end
    subgraph TR[QED-Engine 仓库/QED-Tracker 子仓库]
        T[下载/校验/登记服务 8901]
    end

    FE -->|任务/查询接口| T
    T -->|原始 PDF| R[(dataset/qed-tracker/raw)]
    A -->|解析产物| P[(dataset/axiom-flow/parsed)]
    P --> FE
    CC -.模型/密钥状态.-> FE
    CC -.配置路由.-> A
    CC -.配置路由.-> T
    CC -.服务托管规划.-> A
    CC -.服务托管规划.-> T
```

## 服务职责与端口

| 服务 | 仓库 | 端口 | 职责 |
| --- | --- | --- | --- |
| QED-Engine 前端 | 根仓库 `web/` | 8903（已运行） | 学习中心（建设中）+ 管理后台四项（仪表大盘 / 文档下载管理 / 文档解析进度 / 原始文档对照） |
| QED-Engine 配置中心 | 根仓库 `src/qed_engine/` | 8900（已运行） | 读取根 `.env`，提供健康检查与模型路由，密钥不下发；控制中心服务托管规划中 |
| Axiom-Flow | `Axiom-Flow/` 子仓库 | 8902（迁移中，当前 8000） | PDF 解析、OCR、质量审阅与知识发布；前端工作台迁入根仓库后只保留 API + Worker |
| QED-Tracker | `QED-Tracker/` 子仓库 | 8901（已服务化） | 教材/习题集/论文的发现、下载、校验、登记；写操作后台任务 + 轮询 |

端口规划（8900 配置中心 / 8901 QED-Tracker / 8902 Axiom-Flow / 8903 前端）见
[ADR 0002](../adr/0002-frontend-and-port-centralization.md)；服务接口契约见
[服务契约](../design/service-contracts.md)。

## 三中心产品形态

- **学习中心**：前端主界面（`#/`）的最终形态——课程学习 + 知识问答，向用户展示的核心功能
  （[学习中心设计](../design/learning-center.md)，探索中）。
- **管理中心**：后台内容管理——文档下载管理 / 解析进度 / 原始文档对照（8903 已运行）。
- **控制中心**：后台运行控制——8900 对 8901/8902 服务启停托管
  （[服务控制设计](../design/service-control.md)，Accepted / Not Started；
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

3. Axiom-Flow `web/` 迁入根仓库（API base 指向 8902），子项目退役 `web/`；两侧 CORS 调整。

端口：

4. Axiom-Flow 由 8000 迁移至 8902；QED-Tracker 已服务化使用 8901；QED-Engine 前端使用 8903。

## 架构符合度

| Accepted 约束 | 当前状态 | 证据与跟踪 |
| --- | --- | --- |
| 配置中心五接口任何时刻可用 | 符合 | `src/qed_engine/api/main.py`，`tests/test_api.py`（health/models/keys/database/llm-status） |
| 密钥绝不下发 | 符合 | `tests/test_api.py` 验证响应无密钥值 |
| Axiom-Flow 端口 8902 | 未迁移 | 当前仍为 8000，见 [任务台账](../trackers/todo.md) REQ-001 |
| QED-Tracker 服务化 8901 | 已服务化 | 2026-08 完成（子仓库 QED-008~010 服务化轮），写操作后台任务 + 轮询 |
| 前端统一于根仓库（8903） | 已运行 | REQ-006 十五期完成；Axiom web/ 迁移待 REQ-005 |
| 数据子域布局（dataset/qed-tracker、dataset/axiom-flow） | 骨架已建 | 见 [dataset 目录约定](../design/dataset-conventions.md) 与 REQ-003/REQ-004 |
| 三中心形态（学习/管理/控制） | 学习建设中 + 管理已运行 | [ADR 0004](../adr/0004-personal-library-positioning.md)；控制中心见 [服务控制设计](../design/service-control.md)（Not Started） |
