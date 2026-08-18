# 后端三域拆分设计（backend-domain-split）

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-16
关联代码：`web-ui/src/`（8903 前端 web-ui 版，唯一消费方；后端三域目标模块
`api/control.py`、`api/tracker.py`、`clients/tracker_client.py`、`services/service_manager.py`、
`services/log_viewer.py`、`services/monitor.py` 在实现轮落地后登记 [code-map](../architecture/code-map.md)）
关联测试：`tests/test_api.py`、`tests/test_tracker_client.py`（迁移后保持全绿；新增
`tests/test_log_viewer.py`、`tests/test_monitor.py`、`tests/test_self_restart.py`）
关联 ADR：[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)（8900 网关化）、
[ADR 0008](../adr/0008-frontend-react-refactor.md)（前端重构，后端改造独立成轮与之并行）

> 实现轮计划：[ARCH-012 后端三域拆分轮](../plans/2026-08-backend-domain-refactor.md)（Accepted，实施完成，待真实环境验收归档）。

## 目的与边界

本文件定义 8900 QED-Engine 后端**三域解耦**的代码组织目标态与模块级设计。驱动动机
（2026-08-16 用户方向裁决）：为后续开发解耦——「QED-Engine 自身管理与问答部分」与
「子项目交互部分（QED-Tracker 适配、Axiom-Flow 适配）」可**独立推进**，前端与后端也
独立演进，几部分互不阻塞。**对外契约不变**：全部 /api/v1 路径、响应形状与错误语义保持
不变，本轮是纯内部重组 + 新增监控诊断能力。

推进归属（2026-08-16 用户裁决）：后端改造**独立成轮**（ARCH-012），与前端重构轮
（ARCH-011，只做前端）并行推进、独立验收；ARCH-011 原 Phase 3/7 相应移除，指向本设计
与 ARCH-012 计划。

边界：本设计只约束根仓库 `backend/qed_engine/` 内部组织；子项目（Axiom-Flow、
QED-Tracker）各自独立，不共享代码。

## 三域目标结构

```
backend/qed_engine/
├── api/                       # 对外路由层（FastAPI routers，路径不变）
│   ├── main.py                # app 组装：CORS + include routers + state 注入（瘦身）
│   ├── schemas.py             # 响应模型（共享单一事实源：配置域既有 + 控制域新端点）
│   ├── control.py             # 控制域路由：配置五端点 + /services + /logs + /monitor/* + /self-restart
│   ├── tracker.py             # 数据域·QED-Tracker 适配路由（现 data.py 迁入改名）
│   └── axiom.py               # 数据域·Axiom-Flow 适配路由（后续轮建，本轮不落地）
├── clients/                   # 子项目 HTTP 客户端（适配层，transport 可注入测试）
│   ├── tracker_client.py      # 8901 客户端（迁移，零行为变化）
│   └── axiom_client.py        # 8902 客户端（后续轮按 v2 契约冻结）
├── services/                  # 能力服务（无路由，供控制域调用）
│   ├── service_manager.py     # 服务注册表 + 启停托管 + 探测 + 自身重启能力（迁移 + 路由剥离）
│   ├── log_viewer.py          # 日志查看（新增）
│   └── monitor.py             # GPU / LM Studio / mineru 探测（新增）
├── config.py                  # 统一配置（+ QED_LMSTUDIO_URL，见 configuration-and-secrets.md）
└── cli.py                     # 统一 CLI（import 路径调整，行为不动，`qed tracker` 保持直连 8901）
```

## 三域职责

| 域 | 组织 | 职责 | 说明 |
| --- | --- | --- | --- |
| 控制域 | `api/control.py` + `services/*` | **QED-Engine 自身域**：配置语义代理（四端点：health/models/keys/database——database 为启动快照）、**启动自检**（LLM 供应商可达性 + MySQL 连接，8900 启动时各探测一次，ARCH-014）、服务发现与生命周期启停（/services）、日志诊断（/logs）、组件监控（/monitor/gpu、lmstudio、mineru）、自身重启（/self-restart）、后续 LLM 网关与问答 | 命名取「控制」但定义为「项目自身一切能力」：配置 + 控制 + 监控诊断 + 未来问答；与「数据域」对照成立 |
| 数据域·QED-Tracker | `api/tracker.py` + `clients/tracker_client.py` | 下载/书目对接：catalogs、三表（selections/downloads/sources）、tasks | 「子项目交互部分 ①」；8901 契约事实源为 [service-contracts.md](service-contracts.md) / [downloads-three-table-model.md](downloads-three-table-model.md) |
| 数据域·Axiom-Flow | `api/axiom.py` + `clients/axiom_client.py` | 文档解析对接：解析进度、原始文档对照（后续轮） | 「子项目交互部分 ②」；按 Axiom-Flow v2 设计契约冻结，8902 实现（其 V2-007）回执后闭环 |

**并行推进原则**：三域仅通过 `api/main.py` 组装与共享 `config.py`/`schemas.py` 解耦；
任一域的改动不触碰其他域文件；前端（web-ui/，见 [frontend-react-refactor.md](frontend-react-refactor.md)）
独立目录演进，只依赖 8900 对外契约。

## 域内分层与依赖

每域内部按「路由层（api/）→ 能力层（services/）→ 客户端层（clients/）」组织，依赖方向
单向：`api/*` 依赖 `services/*` 与 `clients/*`，`services/*` 依赖 `config.py`；跨域禁止
import（数据域客户端只被数据域路由与 cli.py 使用，控制域不依赖 clients/）。

状态注入约定（保持现状模式）：

- `create_app(settings, tracker_client)` 签名不变；`app.state` 保持挂载
  `settings` / `db_status`（启动快照，ARCH-014） / `tracker_client`。
- `services/service_manager.py` 的模块级注册表 `_SPECS`、托管表 `_MANAGED`、操作表 `_OPS`
  **保持模块级全局**（`configure(settings)` 注入模式不变），不迁入 app.state；
  `log_viewer` 经 `service_manager.get_specs()` 读白名单。
- 控制域路由经 `request.app.state` 取状态；能力层函数经参数接收 `settings` 或注册表。

## 本轮落地范围

本轮分两步（**迁移先行**，2026-08-16 用户裁决）：

### Phase A：三域迁移（对外零行为变化 + 最小分层调整）

1. **`tracker_client.py → clients/tracker_client.py`**：git mv + 头注更新；import 调整
   （`api/tracker.py`、`cli.py` 改 `qed_engine.clients.tracker_client`）。纯移动，零行为变化。
2. **`api/data.py → api/tracker.py`**：git mv + 改名 + 头注更新 + import 调整。纯移动。
3. **`api/service_manager.py` 最小分层调整**（对外契约不变，内部错误传递方式变）：
   - 能力层 `services/service_manager.py`：保留 `ServiceSpec`/`ManagedProcess`、注册表
     `configure`、状态判定（`service_status`）、启停托管（`_start`/`_stop`/`_stop_process`）、
     探测；路由与 `HTTPException` 剥离开。
   - 新增领域异常 `ServiceError(message, status_code=409)`：未知服务 → 404、操作冲突 →
     409、config 不可启停 → 409；能力层抛 `ServiceError`。
   - 路由层 `api/control.py`：`/services` 端点族（GET /services、POST /services/{name}/start|stop|restart），
     catch `ServiceError` → `HTTPException(status_code=exc.status_code, detail=exc.message)`。
   - 注册表白名单访问：能力层暴露 `get_specs() -> dict[str, ServiceSpec]`（log_viewer 用）。
   - 能力层公开接口承诺：`require_service`（404 校验）/ `get_specs`（白名单）/
     `service_status`（状态快照）/ `restart_self`（自身重启）；`_start`/`_stop`/`_MANAGED`
     等为 control.py 同域协作的私有符号（Python 同包惯例），不作公开承诺。
4. **配置端点拆出**：`api/main.py` 的 health/models/keys/database 端点与探测函数迁入
   `api/control.py`（ARCH-014：/config/llm-status 已删除，database 为启动快照，
   LLM/MySQL 探测为 8900 启动自检）。
5. **`api/main.py` 瘦身**：仅保留 `create_app` 组装（CORS + include_router(control_router,
   tracker_router) + state 注入）+ 模块级 `app` 实例。
6. **`cli.py`**：仅 import 路径调整，行为不动（`qed tracker` 保持直连 8901）。

**迁移安全阀**：每步执行后 `pytest tests -q` + `ruff check backend tests`；全部完成后
全量结果与迁移前一致（新增测试除外）。

### Phase B：控制域新增能力（路由挂 control.py，能力在 services/，TDD）

1. **`services/log_viewer.py`** + `GET /api/v1/logs/{service}`：
   - 白名单：`service_manager.get_specs()` 内各单元 `log_name`（config/tracker/axiom），
     日志文件为根 `logs/<log_name>.log`；未知服务名 → 404（越权）。
   - 查询参数：`tail`（返回行数，默认 200，**上限 1000，超过按 1000 截断**）、`keyword`
     （子串过滤，可选）。
   - 文件不存在（服务未启动过）→ `lines=[]`（不报错）；读取 UTF-8、`errors="replace"`
     容错；实现为 `read_log(service, tail, keyword)` 纯函数，路由层做参数解析与 404 映射。
   - 响应：`{"service", "log_path", "lines"}`（契约见
     [config-center-api.md](config-center-api.md) 监控与诊断域）。
2. **`services/monitor.py`** + 三个探测端点：
   - `probe_gpu()` → `GET /api/v1/monitor/gpu`：`nvidia-smi --query-gpu=name,memory.total,
     memory.used,utilization.gpu --format=csv,noheader,nounits` + `--query-compute-apps=pid,
     process_name,used_memory` 解析；`available=false` 附 `reason`（nvidia-smi 不存在/无 GPU/
     解析失败，中文原因不泄漏堆栈）；命令执行可注入（测试 mock subprocess.run）。
   - `probe_lmstudio(settings)` → `GET /api/v1/monitor/lmstudio`：GET
     `{qed_lmstudio_url}/models`（默认 `http://127.0.0.1:1234/v1`，`QED_LMSTUDIO_URL` 可
     覆盖），5s 超时（沿启动自检探测模式），返回 `reachable` + 已加载模型列表；
     httpx transport 可注入。
   - `probe_mineru()` → `GET /api/v1/monitor/mineru`：探测 8002 健康端点（实施期按 mineru
     实际健康端点校准，默认沿 `/api/v1/health` 模式）；容器未启动/WSL 不可达 →
     `reachable=false` + 中文原因（提示运行容器编排脚本）。
3. **`POST /api/v1/self-restart`**（能力在 `services/service_manager.py` 新增 `restart_self()`）：
   - 流程：spawn 新进程（同启动命令同端口，日志重定向 logs/config.log，解释器为
     `sys.executable`，命令经 `cmd /c ping -n <delay+1> 127.0.0.1 >nul && <启动命令>` 延迟
     绑定端口）→ 返回 `{"status": "restarting"}` → 后台旧进程 1s 后 `os._exit(0)` 释放端口。
   - **不做健康预确认**：同端口下无法在旧进程存活时先健康确认（新进程绑定必然失败），
     实现为「延迟启动（ping，与 stdin 无关；timeout 在重定向 stdin 下不可用）+ 定时退出」；
     失败路径由 config.log 暴露（新进程 uvicorn 报错）并人工重启兜底；spawn 失败同步抛
     ServiceError(500)（响应前可知）；上一轮重启未退出期间重复请求 409。
   - 不动既有 /services 语义（config 单元仍不可经 /services 启停）。
   - 响应：`{"status": "restarting"}`。

响应模型：控制域新端点模型并入 `api/schemas.py`（共享单一事实源，不拆 schemas 目录——
本轮模型量小，YAGNI）。

### 不在本轮

- `api/axiom.py` 与 `clients/axiom_client.py`（Axiom-Flow 适配层，随文档解析对照界面轮次落地）；
  本地 LLM 调用接口（LLM 网关，LM Studio 探索成熟后接入）。
- 测试文件大拆分：迁移阶段 `tests/test_api.py` 不拆（减少变量，只改 import）；新端点测试
  按模块新增独立文件。

## 错误语义（新端点）

- 未知日志服务名 → 404（`日志服务不存在：{service}`）；tail 超上限按 1000 截断（不 422）。
- /monitor/* 一律返回 `available/reachable=false` + `reason`，**不抛 5xx**（监控端点自身
  不可用也要有响应形状，前端据此降级显示）。
- self-restart 失败 → 500 + 中文原因（提示人工重启）；成功 → 200 + `{"status": "restarting"}`。
- 密钥值（API key、数据库密码）不得出现在任何响应体、日志或异常信息中（沿既有强制规则）。

## 契约登记

新端点契约登记于 [config-center-api.md](config-center-api.md)「监控与诊断域」章节；
服务域 /services 契约与注册表规则保持 [service-control.md](service-control.md) 事实源；
`QED_LMSTUDIO_URL` 变量登记于 [configuration-and-secrets.md](configuration-and-secrets.md)
（config.py 同步新增 `qed_lmstudio_url`，默认 `http://127.0.0.1:1234/v1`）。

## 测试策略

- **迁移安全阀（Phase A）**：每步后 `pytest tests -q` + ruff 全绿；全量结果与迁移前
  **完全一致**（新增测试除外）——既有 `tests/test_api.py`（配置端点/服务域/数据域路由）、
  `tests/test_tracker_client.py`、`tests/test_cli.py` 只改 import 不动断言。
- **新端点（Phase B，TDD 先写测试）**：
  - `tests/test_log_viewer.py`：白名单/未知服务 404/tail 默认与上限/keyword 过滤/文件不存在
    空行/UTF-8 容错（tmp_path 日志文件）。
  - `tests/test_monitor.py`：三个探测注入（mock subprocess.run / mock transport），
    available=false 各分支原因、响应形状。
  - `tests/test_self_restart.py`：mock Popen/健康探测的启动成功、探测超时失败语义；
    确认不动 /services 语义（config 仍 409）。
  - 控制域路由级测试（TestClient + create_app）并入上述新文件或 test_api.py，覆盖
    HTTP 映射（404/409/500）。
- **真实环境验证（人工）**：nvidia-smi 解析（本机 4080 真实数据）；LM Studio 未启动 →
  reachable=false；mineru 容器未启动 → false + 中文原因；日志查看真实文件；
  self-restart 冒烟（8900 重启后新进程健康、旧进程退出）。
- 门禁：`pytest tests -q` + `ruff check backend tests` + `pytest tests/contract -q` 全绿。

## 文档同步清单

- `configuration-and-secrets.md`：登记 `QED_LMSTUDIO_URL`（默认 1234/v1）。
- `config-center-api.md`：监控诊断域契约核对（QED_LMSTUDIO_URL 链接变量表）。
- `service-control.md`：实现注记更新（service_manager 迁移至 services/，self-restart 回执）。
- [code-map](../architecture/code-map.md)：登记 `api/control.py`、`api/tracker.py`、
  `clients/tracker_client.py`、`services/service_manager.py`、`services/log_viewer.py`、
  `services/monitor.py`；注销 `api/data.py`、顶层 `tracker_client.py`。
- `four-service-architecture.md` 符合度表与 [project-status](../architecture/project-status.md)
  当前主线同步。
- ARCH-011 计划：Phase 3/7 移除并指向本设计 + ARCH-012（todo 已更新为「只做前端」）。

## 验证

- 设计门禁：`pytest tests/contract -q` 全绿。
- 实施门禁：迁移后 `pytest tests -q` + ruff clean 与迁移前完全一致；
  新端点 mock 单测（log_viewer 白名单/tail/搜索/越权、monitor 三个探测注入、
  self-restart 冒烟）；真实环境验证 nvidia-smi 解析与 8903 控制台联调（前端轮并行）。
- code-map 与文档引用（config-center-api / service-control / four-service-architecture
  符合度表 / project-status）随迁移同步更新。
