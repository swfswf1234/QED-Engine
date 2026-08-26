# 操作指南

状态：Current
最后更新：2026-08-26

本指南保存 QED-Engine 四服务的**启停与日常操作步骤**（ADR 0010：guides/ 分操作文档与开发文档）。
开发（怎么写代码、门禁命令）见 [development.md](development.md)；服务接口契约见
[8900 API 接口文档](../architecture/api-contracts.md)；子项目的启停命令以各自
`docs/guides/operations.md` 为准（跨项目契约只链接不复制）。

## 服务总览

| 服务 | 端口 | 启停方式 | 日志 |
| --- | --- | --- | --- |
| QED-Engine 后端 | 8900 | 前台 uvicorn（唯一手动常驻服务） | `logs/qed-engine-8900.log` |
| QED-Engine 前端 | 8903 | `scripts/qed_web_service.py` 生命周期脚本 | `logs/qed-web-serve.log` |
| QED-Tracker | 8901 | 子项目脚本 / 8900 服务域托管 | `logs/tracker.log` |
| Axiom-Flow | 8902 | 子项目脚本 / 8900 服务域托管 | `logs/axiom.log` |

## 启动顺序建议

```powershell
# 1. 后端 8900（手动常驻；唯一需手动启动的服务，其余可经服务域托管）
#    必须在 backend/ 目录下执行（模块路径 qed_engine.api.main 相对 backend）
cd backend
conda run -n QED_env python -m uvicorn qed_engine.api.main:app --port 8900

# 2. （可选）子项目：8901 QED-Tracker → 8902 Axiom-Flow
Invoke-RestMethod -Method Post http://127.0.0.1:8900/api/v1/services/tracker/start
Invoke-RestMethod -Method Post http://127.0.0.1:8900/api/v1/services/axiom/start

# 3. 前端 8903（生命周期脚本）
python scripts/qed_web_service.py start --wait
```

- **配置读取与启动目录无关**（2026-08-26）：8900 经绝对定位读仓库根 `.env`——无论从
  根目录、backend/ 还是其他 CWD 启动，密钥/数据库等配置一致；改完 `.env` 或后端代码后
  必须重启 8900 才生效。
- 停止顺序与启动相反：先前端 → 子项目 → 后端；8903 也可在控制台点「停止」。
- 独立性铁律：8901/8902 **未启动时**前端必须正常（管理界面显示服务离线）；8900 离线时
  子项目用本地默认配置降级运行。

## 前端（8903）生命周期脚本

```powershell
python scripts/qed_web_service.py start --wait   # 启动；--wait 等待健康就绪
python scripts/qed_web_service.py status         # 查状态（PID 文件或端口探测）
python scripts/qed_web_service.py stop           # 优雅停止（超时 5s 后 taskkill 强杀兜底）
python scripts/qed_web_service.py restart        # 重启（也可加 --wait）
```

- 幂等保护：已运行（PID 存活或端口占用）时 `start` 返回 `already running`，不会重复拉起。
- PID 文件 `logs/qed-web.pid`；退出码 0 成功 / 1 运行失败 / 2 参数错误。
- 前台等价方式：`python scripts/serve_web.py`（无生命周期管理；托管 `web-ui/dist/`，
  8903 + `Cache-Control: no-store`，内置 `/api/v1/health`）。

## 后端（8900）

### 前台启动（官方方式，推荐首次学习）

```powershell
cd backend
conda run -n QED_env python -m uvicorn qed_engine.api.main:app --port 8900
```

- 前台运行终端被日志占用，`Ctrl+C` 停止。
- **`--mode（api 或 local）`**：经 `scripts/qed_engine_service.py` 启停时传
  （api=云端 LLM，local=本地模型；LLM 网关模式见 [LLM 网关设计](../design/llm-gateway-and-model-management.md)）。

### 后台启动 + 日志落盘

```powershell
Start-Process "D:\software\anaconda3\envs\QED_env\python.exe" `
  -ArgumentList "-m","uvicorn","qed_engine.api.main:app","--port","8900" `
  -WorkingDirectory "D:\coding\QED-Engine\backend" `
  -RedirectStandardOutput "D:\coding\QED-Engine\logs\qed-engine-8900.log" `
  -RedirectStandardError "D:\coding\QED-Engine\logs\qed-engine-8900.err.log" -WindowStyle Hidden
```

### 重启与诊断

- 8900 自身重启：`POST http://127.0.0.1:8900/api/v1/self-restart`（控制台「重启」按钮）。
- 服务日志：`GET http://127.0.0.1:8900/api/v1/logs/{service}`（tail/keyword 参数）。
- 组件监控：`GET /monitor/gpu`、`GET /monitor/lmstudio`、`GET /monitor/mineru`。
- 启动自检（ARCH-014）：LLM 供应商可达性与 MySQL 连接在 8900 **启动时**各探测一次
  （LLM 写启动日志；MySQL 结果读 `GET /config/database` 启动快照；`/config/llm-status` 已删除）。

## 子项目服务（8901 / 8902）

QED-Tracker 与 Axiom-Flow 为独立 git 仓库，两种启停方式：

1. **各自生命周期脚本**（在其仓库内）：`python scripts/qed_tracker_service.py start`、
   `python scripts/axiom_flow_service.py start`（start/stop/restart/status，均支持 `--mode`）。
2. **经 8900 控制中心托管**（推荐，前端「控制台」可视化启停）：
   `POST http://127.0.0.1:8900/api/v1/services/tracker/start`（或 `axiom`/`web`）。

## 前端构建（改版后必须）

```powershell
cd web-ui; npm run build; cd ..
# 或开发期走 Vite dev server：cd web-ui; npm run dev（5173 端口代理 8900）
```

- serve_web 托管**构建产物 dist/** 而非源码：改前端后必须先 `npm run build` 重建，
  8903 普通刷新即可生效（no-store 免 Ctrl+F5）。

## 健康检查与冒烟

- `GET http://127.0.0.1:8900/api/v1/health`（8900 存活）
- `GET http://127.0.0.1:8900/api/v1/config/models`（模型路由表）
- `GET http://127.0.0.1:8900/api/v1/config/keys`（供应商配置布尔，**不返回密钥值**）
- `GET http://127.0.0.1:8900/api/v1/services`（四服务状态）
- 8901 在线：`GET /catalogs/math-qe` 返回真实数据；8901 离线：503 且配置域不受影响。

## 启动故障排查清单

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `ModuleNotFoundError: qed_engine` | 不在 `backend/` 目录执行 | `cd backend` 后重跑 |
| `ModuleNotFoundError: fastapi/uvicorn` | 未使用 QED_env 环境 | 加 `conda run -n QED_env` 前缀或先 `conda activate QED_env` |
| `[Errno 10048] address already in use` | 端口 8900 已被占用（重复启动） | `Get-NetTCPConnection -LocalPort 8900` 查占用进程，停掉或换端口 |
| 前端改版后看不到变化 | 8903 托管构建产物，dist 未重建 | `cd web-ui; npm run build` 后刷新 |
| 控制台中文乱码 | Windows PowerShell 控制台 GBK 编码 | 不影响功能；日志用 `Get-Content -Encoding UTF8` 查看 |
| 8903 `start` 显示 already running 但仍打不开 | PID 文件指向已死进程 | `stop` 一次清理 stale PID 再 `start` |
| 8900 服务域显示 tracker/axiom offline | 子项目未启动 | 见上「子项目服务」两种方式任选 |
| 端口 8900-8903 全无监听 | 服务全部未启动 | 按「启动顺序建议」逐步拉起 |

> ⚠️ uvicorn **没有** 8903 生命周期脚本那样的「已运行检测」：重复启动会直接端口冲突。
> 启动 8900 前先确认端口空闲，或用 `GET /api/v1/health` 判断是否已在运行。
