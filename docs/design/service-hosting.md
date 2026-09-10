# 服务托管与启停契约

设计状态：Accepted
实现状态：Implemented
最后更新：2026-09-10
确认状态：暂定
关联代码：`backend/qed_engine/services/service_manager.py`
关联测试：`tests/test_api.py`、`tests/test_web.py`、`tests/test_qed_web_service.py`
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0005](../history/adr/v0.1/0005-control-center-service-hosting.md)、[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0008](../history/adr/v0.1/0008-frontend-react-refactor.md)

## 目的与边界

控制中心是 QED-Engine 后台管理（管理中心 + 控制中心）的运行侧：通过 8900 配置中心代理
托管四个服务（8900 自身 / 8901 QED-Tracker / 8902 Axiom-Flow / 8903 前端）的启停与状态展示。
前端静态页无权限直接操作系统进程，8900 是唯一常驻后端，因此由 8900 新增服务管理端点，
前端仪表大盘提供「服务控制区」交互。

- **本期实现范围**：四服务的启动 / 停止 / 重启 / 状态展示（8900 自身只提供重启，
  不提供停止；8903 只提供启动/重启，不提供停止）。
- **只进规划、不实现、前端不展示**：MySQL 元数据管理、向量数据库、MinerU 服务后续容器化，
  经前端界面统一托管——仅在本文件「未来规划」登记方向，不建端点不占 UI 位。

## 服务注册表（启停单元）

| 单元名 | 服务 | 端口 | 探测 URL | 进程构成 | 启动命令（QED_env 环境） |
| --- | --- | --- | --- | --- | --- |
| `config` | QED 管理服务（配置中心） | 8900 | `/api/v1/health` | 单进程 | `python -m uvicorn qed_engine.api.main:app --host 127.0.0.1 --port 8900` |
| `tracker` | QED-Tracker 文档下载服务 | 8901 | `/api/v1/health` | 单进程 | `qed-tracker serve`（等价 `python -m qed_tracker.cli serve`）；**启停经生命周期脚本** `python scripts/qed_tracker_service.py start/stop/restart`（REQ-017①/QED-032，见「进程托管实现要点」） |
| `axiom` | Axiom-Flow 文档解析服务 | 8902 | `/api/v1/health` | **单进程**（v2 无独立 Worker；API 进程） | **启停经生命周期脚本** `python scripts/axiom_flow_service.py start/stop/restart`（2026-08-17 REQ-039：由 Popen 直管切换为脚本化，对齐 tracker/web 模式；`--wait` 健康等待 + PID 文件 + 优雅停止/强杀兜底） |
| `web` | QED 前端服务 | 8903 | `/api/v1/health`（`scripts/serve_web.py` 内建） | 单进程 | `python scripts/serve_web.py`；**启停经生命周期脚本** `python scripts/qed_web_service.py start/stop/restart`（2026-08-17 新增，仿 qed_tracker_service.py） |

规则：

- 端口与启动命令来自服务注册表配置，**以当前实际生效端口为准**：Axiom-Flow 端口迁移
  （8000 → 8902，Axiom-Flow ALN-002）已完成（2026-08-11），`axiom` 单元端口/探测 URL 为
  8902；8000 侧 CORS 兼容保留至前端迁移完成。`web` 单元端口取自 `qed_web_url`
  （默认 `http://127.0.0.1:8903`，可由 `.env` 覆盖）。

- `axiom` 作为**单一启停单元**（2026-08-17 起经生命周期脚本）：Axiom-Flow v2 无独立 Worker
  进程（v1 时代 `axiom_flow.worker` 已退役），脚本管理 API 单进程；启停/重启由脚本自含。
- 启动命令中的 Python 解释器、工作目录、环境变量注入由 8900 服务定义表配置；日志重定向到
  根仓库 `logs/<unit>.log`（Git 忽略），8900 启动时确保目录存在。
- 8900 自身由用户手动启动（终端/脚本）；控制中心对其**不提供启动/停止按钮**（避免自掘——
  停止 8900 即断掉整个控制中心），仅提供**重启**（经 `/self-restart`，见
  [../architecture/api-contracts.md](../architecture/api-contracts.md)）。8903 前端**不提供停止**（停止即断掉界面），
  在线→重启、离线→启动。
- **停止语义（2026-08-17 修复）**：生命周期脚本单元（tracker/web）不再以「8900 托管记录」
  为停止放行前提——凡端口探测在线即视为在管，直接 `_stop_via_script`（解决手动经脚本启动的
  服务在 8900 重启后「无法停止」问题）；探测离线且无托管记录 → 409。

## API 契约（8900 新增，前缀 /api/v1）

### GET /api/v1/services

四服务状态快照，同步返回。

```json
{
  "services": [
    {
      "name": "tracker", "label": "QED-Tracker 文档下载服务", "port": 8901,
      "status": "online", "pid": 6772, "started_at": "2026-08-09T10:00:00+08:00",
      "log_path": "D:/coding/QED-Engine/logs/tracker.log", "reason": ""
    },
    {
      "name": "axiom", "label": "Axiom-Flow 文档解析服务", "port": 8902,
      "status": "offline", "pid": null, "started_at": null,
      "log_path": "D:/coding/QED-Engine/logs/axiom.log", "reason": "未启动"
    },
    {
      "name": "web", "label": "QED 前端服务", "port": 8903,
      "status": "online", "pid": 2341, "started_at": "2026-08-17T10:00:00+08:00",
      "log_path": "D:/coding/QED-Engine/logs/web.log", "reason": ""
    }
  ]
}
```

- `status`：`online`（端口探测通过）/ `offline`（未启动或探测失败）/ `starting`（启动中，
  启动后 15s 内探测窗口）/ `stopping`（停止中）。
- `pid`：8900 托管记录的主 PID（`axiom` 为 API 进程 PID；8900 重启后 PID 记录丢失，以端口
  探测为准，pid 可为 null）。
- `reason`：offline 的补充原因（未启动 / 连接失败 / 停止超时强杀）。
- 状态判定**优先端口探测**（socket 预检 0.5s + HTTP 确认 1s，双重探测：未监听端口快速
  判定 offline，已监听端口再 HTTP 健康确认），不依赖 PID 文件；8900 自身被探测时永远
  online。注：Windows 上未监听 loopback 端口可能被防火墙静默丢弃（非 RST），曾致 httpx
  直连等待 3s×2；socket 预检使未启动服务 0.5s/单元内返回（2026-08-16 修复）。

### POST /api/v1/services/{name}/start

启动服务，后台托管。`config` 返回 409（不可经自身启停）。

```json
{"name": "tracker", "status": "starting", "pid": 8123}
```

### POST /api/v1/services/{name}/stop

优雅停止：向进程组发送 `CTRL_BREAK_EVENT`（uvicorn 按 KeyboardInterrupt 优雅收尾），
5s 超时未退出则强杀（`taskkill /PID <pid> /T /F`）。`config` 返回 409。

```json
{"name": "tracker", "status": "stopping"}
```

### POST /api/v1/services/{name}/restart

先停后启（复用 stop → start 语义）。`config` 返回 409。
**2026-08-17 语义修订**：生命周期脚本单元（tracker/web）「运行中即停」——无论是否
8900 托管，凡 `_MANAGED` 有记录或端口探测在线即先 `_stop`，随后 `_start`
（修复此前未托管时跳过 stop、`_start` 又因端口在线 409「服务已在线」导致重启无效果）。

### POST /api/v1/self-restart

8900 自身重启（监控与诊断域，见 [../architecture/api-contracts.md](../architecture/api-contracts.md)）：
延迟 2s 绑定端口 + 后台 1s 后旧进程退出，规避 Windows 端口占用；失败 500 提示人工重启。
控制台「QED 管理服务」卡的重启按钮即调此端点，成功后约 3s 自动刷新页面。

### 错误语义

- 未知服务名 → 404；`config` 启停 → 409（重启经 `/self-restart`，不走 /services）；
  重复启动（已 online/starting）→ 409；停止未运行服务 → 409。
- 启停为**同步轻量操作**：启动返回前完成 `Popen` 创建（不等待健康），停止返回前完成信号
  发送；状态收敛由前端轮询 `/services` 观察。

## 进程托管实现要点

1. **创建（Popen 单元）**：`subprocess.Popen(cmd, creationflags=CREATE_NEW_PROCESS_GROUP,
   cwd=服务工作目录, env=根 .env 注入环境, stdout/stderr=日志文件)`；模块级托管表
   （进程对象 + PID + 启动时间）。适用于 `config`（自身重启用）；2026-08-17 起其余单元
   均已走生命周期脚本（tracker/axiom/web）。
2. **生命周期脚本单元（tracker，REQ-017①/QED-032；axiom、web，2026-08-17）**：启停经子项目
   自含脚本黑盒调用：
   - tracker：`python scripts/qed_tracker_service.py start|stop|restart`（cwd=QED-Tracker 仓库根）；
   - axiom：`python scripts/axiom_flow_service.py start|stop|restart`（cwd=Axiom-Flow 仓库根，REQ-039）；
   - web：`python scripts/qed_web_service.py start|stop|restart`（cwd=根仓库）。
   PID 取脚本 stdout 首行 `pid: <n>`（兜底读 `logs/qed-{name}.pid`，tracker/axiom/web 同名
   规则），仅用于前端展示；优雅停止/强杀兜底由脚本自含，8900 不再持有 Popen 句柄；脚本非 0
   退出 → 500。tracker 契约见 QED-Tracker `docs/design/service-lifecycle.md`，axiom 契约见
   Axiom-Flow `docs/design/service-lifecycle.md`。
3. **优雅停止（Popen 单元）**：`os.kill(pid, signal.CTRL_BREAK_EVENT)` 发送到进程组；
   uvicorn 捕获 KeyboardInterrupt 触发优雅关闭；5s 宽限后 `taskkill /PID <pid> /T /F`
   强杀兜底。
4. **状态探测**：socket 预检（0.5s 超时）→ HTTP 健康确认（1s 超时，200 即 online）；
   `starting`/`stopping` 为过渡态（操作后 15s 内探测仍失败则回落 offline 并附 reason）。
5. **8900 重启恢复**：8900 重启后子进程可能仍在运行——状态以端口探测为准（探测到 online
   即视为在管，重启按钮直接生效）；不持久化 PID 文件。
6. **并发安全**：同一服务同时启停返回 409；操作幂等（重复 stop 未运行返回 409 而非崩溃）。

## 前端呈现（指向）

服务控制区在管理后台的 UI 呈现（四服务卡、依赖组件卡、操作按钮与确认交互）由
[admin-console.md](admin-console.md)「管理后台·控制台」承载，本文件只定义后端托管契约，不再重复
前端设计。要点对照：`config`（8900）仅重启（`/self-restart`）；`tracker`/`axiom`
在线→停止+重启、离线→启动；`web`（8903）不提供停止（避免自掘断界面）。

## 未来规划（不实现）

| 依赖 | 形态 | 说明 |
| --- | --- | --- |
| MySQL 8（qed 库） | 容器化 | 随容器化部署统一托管，纳入服务控制区（只读状态 + 启停） |
| 向量数据库 | 容器化 | 学习中心 RAG 链路启用后纳入 |
| MinerU 解析服务 | 容器化 | Axiom-Flow OCR 备用链路启用后纳入 |

容器化统一托管方案（端口/健康检查/日志/编排）在容器化轮单独设计，本期不占 UI。

## 实现注记（2026-08-11，ADR 0007 轮）

- 端点族实现于 `backend/qed_engine/api/service_manager.py`，接入 `backend/qed_engine/api/main.py`；
  服务注册表自 `Settings`（QED_*_URL）解析端口（config 8900 / tracker 8901 / axiom 8902，均可
  被 `.env` 覆盖），日志落根 `logs/<unit>.log`（启动时确保目录存在）。
- 状态判定：config 恒 online；其余优先 15s 过渡窗口（starting/stopping），其次双重端口
  探测（socket 0.5s + HTTP 1s）；8900 重启后 PID 记录丢失，以探测为准（pid 可为 null）。
- 启停：Popen（CREATE_NEW_PROCESS_GROUP）+ 根 `.env` 环境继承；优雅停止 CTRL_BREAK 5s 宽限后
  taskkill 强杀（`停止超时强杀` reason）；同一服务 15s 窗口内重复同向操作 409；restart 先停后启
  （未托管时直接启动）；worker 目录为各子项目目录（`QED-Tracker/`、`Axiom-Flow/`）。
- 子进程环境注入细节（conda 环境解析、子项目直读 `.env`）在真实冒烟轮校准。
- 2026-08-16（ARCH-012）：service_manager 迁至 services/（能力层，抛 ServiceError 无路由），
  路由挂 api/control.py；config 单元启动命令补充（仅供 /self-restart 延迟 spawn 使用，
  不可经 /services 启停的限制不变）；/self-restart 落地（延迟 2s 绑定端口 + 后台 1s 后
  os._exit，Windows 端口占用规避，失败 500 提示人工重启）。
- 2026-08-17：① web 单元注册（`qed_web_url` 默认 8903，`scripts/qed_web_service.py`
  生命周期脚本 + `serve_web.py` 内建 `/api/v1/health`，否则探测恒 404 判离线）；
  ② `_start_via_script` PID 兜底泛化为 `logs/qed-{name}.pid`；③ **脚本单元停止放行修复**：
  `_stop` 原以 `_MANAGED` 为唯一前提，手动脚本启动的 tracker/web 无记录 → 停止 409；
  改为探测在线即放行 `_stop_via_script`（离线未托管仍 409）；④ **restart 修复**：
  脚本单元「运行中即停」后 `_start`；⑤ 前端控制台 8900 卡接 `/self-restart`（成功
  3s 自动刷新）、8903 卡在线重启/离线启动（无停止），后端离线时本地判定兜底 + 去重；
  ⑥ **axiom 单元脚本化（REQ-039）**：由 Popen 直管（双进程 API+Worker）切换为
  `scripts/axiom_flow_service.py` 黑盒调用（Axiom-Flow v2 无独立 Worker），8900 可经
  /services 停止/重启脚本启动的 8902；`serve_web.py` 目录由旧 `web/` 切到 `web-ui/dist/`
  （前端重构切换）；`scripts/` 整理（start-all/stop-all/load-env/check_api_keys 退役，仅留
  qed_web_service.py + serve_web.py）。

## 验证

- `pytest tests -q` 全绿；`ruff check backend tests` 无错误。
- 定向测试：服务注册表完整性（四单元含 web）、状态探测（注入假 transport）、启停端点
  （mock Popen/信号）、`config` 409、未知服务 404、并发 409、脚本单元外部运行停止/重启
  （`tests/test_api.py`）、web 生命周期脚本契约（`tests/test_qed_web_service.py`）、
  serve_web health 端点（`tests/test_web.py`）。
- 前端：`npx tsc -b` + vitest 全绿（72 passed）。
- 真实冒烟（人工）：8900 在线时启动/停止/重启 8901（观察 8903 控制台状态流转与日志
  文件生成），再验证 8902 双进程单元与 8903 前端单元一次。
