# 控制中心：服务托管与启停契约

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-11
关联代码：`backend/qed_engine/api/service_manager.py`
关联测试：`tests/test_api.py`、`tests/test_web.py`
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)、[ADR 0005](../adr/0005-control-center-service-hosting.md)、[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)

## 目的与边界

控制中心是 QED-Engine 后台管理（管理中心 + 控制中心）的运行侧：通过 8900 配置中心代理
托管三个 Python 服务（8900 自身 / 8901 QED-Tracker / 8902 Axiom-Flow）的启停与状态展示。
前端静态页无权限直接操作系统进程，8900 是唯一常驻后端，因此由 8900 新增服务管理端点，
前端仪表大盘提供「服务控制区」交互。

- **本期实现范围**：三 Python 服务的启动 / 停止 / 重启 / 状态展示（8900 自身只显示状态，
  不提供停止）。
- **只进规划、不实现、前端不展示**：MySQL 元数据管理、向量数据库、MinerU 服务后续容器化，
  经前端界面统一托管——仅在本文件「未来规划」登记方向，不建端点不占 UI 位。

## 服务注册表（启停单元）

| 单元名 | 服务 | 端口 | 探测 URL | 进程构成 | 启动命令（QED_env 环境） |
| --- | --- | --- | --- | --- | --- |
| `config` | QED 管理服务（配置中心） | 8900 | `/api/v1/health` | 单进程 | `python -m uvicorn qed_engine.api.main:app --host 127.0.0.1 --port 8900` |
| `tracker` | QED-Tracker 文档下载服务 | 8901 | `/api/v1/health` | 单进程 | `qed-tracker serve`（等价 `python -m qed_tracker.cli serve`） |
| `axiom` | Axiom-Flow 文档解析服务 | 8902（迁移前 8000） | `/api/v1/health` | **双进程**（API + Worker） | `python -m uvicorn axiom_flow.main:app --host 127.0.0.1 --port 8902` + `python -m axiom_flow.worker` |

规则：

- 端口与启动命令来自服务注册表配置，**以当前实际生效端口为准**：Axiom-Flow 端口迁移
  （8000 → 8902，Axiom-Flow ALN-002）完成前，`axiom` 单元端口/探测 URL 为 8000，
  迁移完成后同步为 8902。

- `axiom` 作为**单一启停单元**：启动时 API 与 Worker 同时拉起，停止/重启时两者一起处理，
  前端不暴露 Worker 的独立控制。
- 启动命令中的 Python 解释器、工作目录、环境变量注入由 8900 服务定义表配置；日志重定向到
  根仓库 `logs/<unit>.log`（Git 忽略），8900 启动时确保目录存在。
- 8900 自身由用户手动启动（终端/脚本）；控制中心对其只探测状态并展示，不提供启停按钮
  （避免自掘——停止 8900 即断掉整个控制中心）。

## API 契约（8900 新增，前缀 /api/v1）

### GET /api/v1/services

三服务状态快照，同步返回。

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
    }
  ]
}
```

- `status`：`online`（端口探测通过）/ `offline`（未启动或探测失败）/ `starting`（启动中，
  启动后 15s 内探测窗口）/ `stopping`（停止中）。
- `pid`：8900 托管记录的主 PID（`axiom` 为 API 进程 PID；8900 重启后 PID 记录丢失，以端口
  探测为准，pid 可为 null）。
- `reason`：offline 的补充原因（未启动 / 连接失败 / 停止超时强杀）。
- 状态判定**优先 HTTP 端口探测**（3s 超时），不依赖 PID 文件；8900 自身被探测时永远 online。

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

### 错误语义

- 未知服务名 → 404；`config` 启停 → 409；重复启动（已 online/starting）→ 409；
  停止未运行服务 → 409。
- 启停为**同步轻量操作**：启动返回前完成 `Popen` 创建（不等待健康），停止返回前完成信号
  发送；状态收敛由前端轮询 `/services` 观察。

## 进程托管实现要点

1. **创建**：`subprocess.Popen(cmd, creationflags=CREATE_NEW_PROCESS_GROUP, cwd=服务工作目录,
   env=根 .env 注入环境, stdout/stderr=日志文件)`；模块级托管表（进程对象 + PID + 启动时间）。
2. **优雅停止**：`os.kill(pid, signal.CTRL_BREAK_EVENT)` 发送到进程组；uvicorn 捕获
   KeyboardInterrupt 触发优雅关闭；5s 宽限后 `taskkill /PID <pid> /T /F` 强杀兜底。
3. **状态探测**：`httpx.get(探测 URL, timeout=3)` 200 即 online；`starting`/`stopping` 为
   过渡态（操作后 15s 内探测仍失败则回落 offline 并附 reason）。
4. **8900 重启恢复**：8900 重启后子进程可能仍在运行——状态以端口探测为准（探测到 online
   即视为在管，重启按钮直接生效）；不持久化 PID 文件。
5. **并发安全**：同一服务同时启停返回 409；操作幂等（重复 stop 未运行返回 409 而非崩溃）。

## 前端：仪表大盘服务控制区

- 现有「服务健康」面板升级：`后台服务` 分组（8901/8902/8900）每行增加操作按钮：
  - online → `停止` + `重启`；offline → `启动`；starting/stopping → 按钮禁用 + 转圈文案。
  - 8900 行**无按钮**，仅状态点 + 名称（含「后台管理服务」备注，与八期语义一致）。
- 破坏性操作（停止/重启）弹确认框（复用现有 reason modal 模式，但无需填原因）；
  操作成功后 1s 轮询 `/services` 自动刷新（复用现有任务轮询机制）。
- LLM配置 / 数据库配置分组保持不变；8900 不可达时整个控制区离线提示（现有横幅语义）。

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
- 状态判定：config 恒 online；其余优先 15s 过渡窗口（starting/stopping），其次 HTTP 端口探测
  （3s 超时）；8900 重启后 PID 记录丢失，以探测为准（pid 可为 null）。
- 启停：Popen（CREATE_NEW_PROCESS_GROUP）+ 根 `.env` 环境继承；优雅停止 CTRL_BREAK 5s 宽限后
  taskkill 强杀（`停止超时强杀` reason）；同一服务 15s 窗口内重复同向操作 409；restart 先停后启
  （未托管时直接启动）；worker 目录为各子项目目录（`QED-Tracker/`、`Axiom-Flow/`）。
- 子进程环境注入细节（conda 环境解析、子项目直读 `.env`）在真实冒烟轮校准。

## 验证

- `pytest tests -q` 全绿；`ruff check backend tests` 无错误。
- 定向测试：服务注册表完整性、状态探测（注入假 transport）、启停端点（mock Popen/信号）、
  `config` 409、未知服务 404、并发 409。
- 真实冒烟（人工）：8900 在线时启动/停止/重启 8901（观察 8903 服务控制区状态流转与日志
  文件生成），再验证 8902 双进程单元一次。
