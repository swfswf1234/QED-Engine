# 后端三域拆分设计（backbone-domain-split）

设计状态：Accepted
实现状态：Not Started
最后更新：2026-08-16
关联代码：`web/app.js`、`web/index.html`（8903 前端现状契约，唯一消费方；后端三域目标模块
`api/control.py`、`api/tracker.py`、`clients/tracker_client.py`、`services/service_manager.py`、
`services/log_viewer.py`、`services/monitor.py` 在实现轮落地后登记 [code-map](../architecture/code-map.md)）
关联测试：`tests/test_api.py`、`tests/test_tracker_client.py`（迁移后保持全绿）
关联 ADR：[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)（8900 网关化）、
[ADR 0008](../adr/0008-frontend-react-refactor.md)（前端重构，本拆分与之同轮落地）

## 目的与边界

本文件定义 8900 QED-Engine 后端**三域解耦**的代码组织目标态。驱动动机（2026-08-16
用户方向裁决）：为后续开发解耦——「QED-Engine 自身管理与问答部分」与「子项目交互
部分（QED-Tracker 适配、Axiom-Flow 适配）」可**独立推进**，前端与后端也独立演进，
几部分互不阻塞。**对外契约不变**：全部 /api/v1 路径、响应形状与错误语义保持不变，
本轮是纯内部重组 + 新增监控诊断能力。

边界：本设计只约束根仓库 `backend/qed_engine/` 内部组织；子项目（Axiom-Flow、
QED-Tracker）各自独立，不共享代码。

## 三域目标结构

```
backend/qed_engine/
├── api/                       # 对外路由层（FastAPI routers，路径不变）
│   ├── main.py                # app 组装：CORS + include routers + state 注入（瘦身）
│   ├── schemas.py             # 响应模型（既有，配置域）
│   ├── control.py             # 控制域路由：配置五端点 + /services + /logs + /monitor/*
│   ├── tracker.py             # 数据域·QED-Tracker 适配路由（现 data.py 迁入改名）
│   └── axiom.py               # 数据域·Axiom-Flow 适配路由（后续轮建，本轮不落地）
├── clients/                   # 子项目 HTTP 客户端（适配层，transport 可注入测试）
│   ├── tracker_client.py      # 8901 客户端（迁移，零行为变化）
│   └── axiom_client.py        # 8902 客户端（后续轮按 v2 契约冻结）
├── services/                  # 能力服务（无路由，供控制域调用）
│   ├── service_manager.py     # 服务注册表 + 启停托管 + 探测（迁移）
│   ├── log_viewer.py          # 日志查看（新增）
│   └── monitor.py             # GPU / LM Studio / mineru 探测（新增）
├── config.py                  # 统一配置（不动）
└── cli.py                     # 统一 CLI（不动，`qed tracker` 保持直连 8901）
```

## 三域职责

| 域 | 组织 | 职责 | 说明 |
| --- | --- | --- | --- |
| 控制域 | `api/control.py` + `services/*` | 项目自身管理与运行控制：配置五端点、服务发现（声明式注册表 + HTTP 探测）、生命周期启停、日志诊断、GPU/LM Studio/mineru 监控、LLM 状态 | 「QED-Engine 自身管理」；后续本地 LLM 调用（LLM 网关）与问答能力也归此域 |
| 数据域·QED-Tracker | `api/tracker.py` + `clients/tracker_client.py` | 下载/书目对接：catalogs、三表（selections/downloads/sources）、tasks | 「子项目交互部分 ①」；8901 契约事实源为 [service-contracts.md](service-contracts.md) / [downloads-three-table-model.md](downloads-three-table-model.md) |
| 数据域·Axiom-Flow | `api/axiom.py` + `clients/axiom_client.py` | 文档解析对接：解析进度、原始文档对照（后续轮） | 「子项目交互部分 ②」；按 Axiom-Flow v2 设计契约冻结，8902 实现（其 V2-007）回执后闭环 |

**并行推进原则**：三域仅通过 `api/main.py` 组装与共享 `config.py`/`schemas.py` 解耦；
任一域的改动不触碰其他域文件；前端（web-ui/，见 [frontend-react-refactor.md](frontend-react-refactor.md)）
独立目录演进，只依赖 8900 对外契约。

## 本轮落地范围

1. **机械迁移（零行为变化）**：`api/data.py → api/tracker.py`（改名 + 头注更新）、
   `tracker_client.py → clients/tracker_client.py`、`api/service_manager.py →
   services/service_manager.py`；配置五端点从 `api/main.py` 拆至 `api/control.py`;
   import 调整；既有测试全绿作为安全阀。
2. **控制域新增能力**（路由挂 control.py，能力在 services/）：
   - `services/log_viewer.py` + `GET /api/v1/logs/{service}`（白名单 tail/keyword）；
   - `services/monitor.py` + `GET /monitor/gpu`（nvidia-smi 解析）、`/monitor/lmstudio`
     （OpenAI 兼容 /v1/models 探测 + 已加载模型）、`/monitor/mineru`（8002 健康探测）；
   - `POST /api/v1/self-restart`（8900 自身重启：spawn 新进程 → 新进程健康 → 旧进程退出；
     Windows 下技术风险实施期验证，失败语义明确回滚为提示人工重启）。
3. **不在本轮**：`api/axiom.py` 与 `clients/axiom_client.py`（Axiom-Flow 适配层，随
   文档解析对照界面轮次落地）；本地 LLM 调用接口（LLM 网关，LM Studio 探索成熟后接入）。

## 契约登记

新端点契约登记于 [config-center-api.md](config-center-api.md)「监控与诊断域」章节；
服务域 /services 契约与注册表规则保持 [service-control.md](service-control.md) 事实源。

## 验证

- 设计门禁：`pytest tests/contract -q` 全绿。
- 实施门禁：迁移后 `pytest tests -q` + ruff clean 与迁移前完全一致；
  新端点 mock 单测（log_viewer 白名单/tail/搜索/越权、monitor 三个探测注入 transport、
  self-restart 冒烟）；真实环境验证 nvidia-smi 解析与 8903 控制台联调。
- code-map 与文档引用（config-center-api / service-control / four-service-architecture
  符合度表 / project-status）随迁移同步更新。