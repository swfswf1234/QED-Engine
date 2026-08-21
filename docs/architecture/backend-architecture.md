# QED-Engine 后端架构（8900）

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-20
关联代码：`web-ui/`（唯一消费方）、`scripts/qed_engine_service.py`（生命周期脚本）；
后端三域模块（`api/`、`services/`、`clients/`）受管清单见 [code-map.md](code-map.md)
关联测试：`tests/test_api.py`、`tests/test_tracker_client.py`、`tests/test_log_viewer.py`、
`tests/test_monitor.py`、`tests/test_self_restart.py`、`tests/test_llm_*.py`
关联 ADR：[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)（8900 网关化）、
[ADR 0005](../adr/0005-control-center-service-hosting.md)（控制中心托管）、
[ADR 0008](../adr/0008-frontend-react-refactor.md)（前端独立演进）

## 定位与边界

8900 是 QED-Engine 后端：**前端唯一入口**（ADR 0007），承载配置语义代理、服务托管、数据域
透传与监控诊断；**密钥绝不下发**（`/config/keys` 只返回布尔）。对外契约（全部 `/api/v1`
路径、响应形状与错误语义）见 [8900 API 接口文档](api-contracts.md)。

## 三域组织（ARCH-012，2026-08-16 实施）

| 域 | 组织 | 职责 |
| --- | --- | --- |
| 控制域 | `api/control.py` + `services/*` | **QED-Engine 自身域**：配置语义代理（health/models/keys/database 启动快照）、启动自检（LLM/MySQL 启动时各探测一次）、服务域 /services 启停托管、监控诊断（/logs、/monitor/gpu/lmstudio/mineru、/self-restart）、LLM 网关（/llm/*、/llm/calls、/database/test）与未来问答 |
| 数据域·QED-Tracker | `api/tracker.py` + `clients/tracker_client.py` | 下载/书目对接：catalogs、五层（qt_knowledge/qt_books/qt_sources）、tasks 语义透传 8901 |
| 数据域·Axiom-Flow | `api/axiom.py` + `clients/axiom_client.py` | 文档解析对接：books/pages/manifest/parse-jobs 透传 8902；图片代理 /books/{id}/pages/{no}/image |

**并行推进原则**：三域仅通过 `api/main.py` 组装与共享 `config.py`/`schemas.py` 解耦；
任一域改动不触碰其他域文件；前端独立目录演进，只依赖 8900 对外契约。

## 分层与依赖

```
backend/qed_engine/
├── api/            # 对外路由层（FastAPI routers，路径不变）
│   ├── main.py     # app 组装：CORS + include routers + state 注入
│   ├── schemas.py  # 响应模型（共享单一事实源）
│   ├── control.py  # 控制域路由
│   ├── tracker.py  # 数据域·QED-Tracker 适配路由
│   └── axiom.py    # 数据域·Axiom-Flow 适配路由
├── clients/        # 子项目 HTTP 客户端（transport 可注入测试）
├── services/       # 能力服务（无路由，供控制域调用）
│   ├── service_manager.py / log_viewer.py / monitor.py
│   └── llm/        # LLM 网关：gateway.py / clients.py / model_manager.py / call_log.py
├── config.py       # 统一配置（根 .env 唯一事实源）
└── cli.py          # 统一 CLI `qed`
```

依赖方向单向：`api/*` → `services/*` 与 `clients/*` → `config.py`；跨域禁止 import。
`services/service_manager.py` 的注册表（config/tracker/axiom/web 四单元）保持模块级全局。

## 生命周期与模式

- 生命周期脚本：`scripts/qed_engine_service.py`（start/stop/restart/status，
  **`--mode（api 或 local）`**——api 模式走云端 LLM，local 模式启用本地模型资源互斥）。
- 8900 重启经 `POST /self-restart`（自身不在 /services 启停范围）。
- LLM 网关与模型管理见 [设计文档](../design/llm-gateway-and-model-management.md)；
  资源互斥 `QED_RESOURCE_GUARD` 由 `services/llm/model_manager.py` 实施。

## 与三项目四服务的关系

- 服务托管：8900 经生命周期脚本黑盒管理 8901（tracker）、8902（axiom）、8903（web）单元。
- 数据域透传：8901/8902 契约事实源在各子项目仓库 `docs/architecture/`（QED-Tracker
  API 文档、Axiom-Flow API 文档），8900 只做语义适配与错误映射（4xx 透传、连接失败 503）。

## 验证

- 后端门禁：`pytest tests -q` + `ruff check backend tests` + `pytest tests/contract -q` 全绿。
- 真实冒烟：四服务启停托管、数据域真实数据（8901/8902 在线）、LLM 网关 api/local 模式。
- 独立性：8901/8902 离线时配置域端点仍可用（独立铁律见
  [三项目四服务总体架构](four-service-architecture.md)）。
