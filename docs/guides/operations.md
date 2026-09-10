# 操作指南

状态：Current
最后更新：2026-09-04

本指南保存 QED-Engine 四服务的**完整服务管理手册**：环境配置、启动（含后台）、停止、重启、
健康检测、日志监控与故障排查（ADR 0010：guides/ 分操作文档与开发文档）。开发（怎么写代码、
门禁命令）见 [development.md](development.md)；服务接口契约见
[8900 API 接口文档](../architecture/api-contracts.md)；机器环境权威事实（UUID/版本/路径）见
[本地开发环境](../standards/local-dev.md)；子项目的启停命令以各自 `docs/guides/operations.md`
为准（跨项目契约只链接不复制）。

## 操作总览

| 服务 | 端口 | 启停方式 | 日志（脚本后台模式） | PID 文件 | 健康端点 |
| --- | --- | --- | --- | --- | --- |
| QED-Engine 后端 | 8900 | `scripts/qed_engine_service.py`（推荐）或前台 uvicorn | `logs/qed-engine-serve.log` | `logs/qed-engine.pid` | `GET /api/v1/health` |
| QED-Tracker（子项目） | 8901 | 子项目脚本 / 8900 控制中心托管 | `logs/tracker.log` | 子项目自管 | `GET /api/v1/health` |
| Axiom-Flow（子项目） | 8902 | 子项目脚本 / 8900 控制中心托管 | `logs/axiom.log` | 子项目自管 | `GET /api/v1/health` |
| QED-Engine 前端 | 8903 | `scripts/qed_web_service.py` | `logs/qed-web-serve.log` | `logs/qed-web.pid` | `GET /api/v1/health` |

前端（8903）托管**构建产物 `web-ui/dist/`** 而非源码；前端代码改动后必须重建 dist（冷启动
`--build` 自动完成，见「服务启动」）。

### 生命周期脚本命令矩阵

两个本仓库生命周期脚本（start/stop/restart/status，退出码 0 成功/幂等、1 运行失败、2 参数错误）：

| 操作 | 后端 8900（`scripts/qed_engine_service.py`） | 前端 8903（`scripts/qed_web_service.py`） |
| --- | --- | --- |
| 冷启动（代码改动后/首次） | `start --wait` | `start --build --wait` |
| 快速启动（无代码改动） | `start --wait` | `start --wait` |
| 查状态 | `status` | `status` |
| 停止 | `stop` | `stop` |
| 重启 | `restart --wait` | `restart` |

- 后端 `start`/`restart` 额外支持 `--mode api|local`（api=云端 LLM API key，local=本地模型
  LM Studio / MinerU；LLM 网关见 [LLM 网关设计](../design/llm-gateway.md)）。
- 前端 `--build` 为**显式旗标**：默认 `start` 纯快启动（8900 控制台托管路径依赖此语义）；
  `dist/index.html` 缺失时任何启动方式都会自动兜底构建。前端测试（vitest）属开发门禁
  （见 [development.md](development.md)），启动流程不执行测试。
- 两个脚本均有幂等保护：已运行（PID 存活或端口占用）时 `start` 返回 `already running`。

### 启动与停止顺序

- **启动顺序**：8900 后端 → 8901 QED-Tracker → 8902 Axiom-Flow → 8903 前端。
- **停止顺序**：与启动相反——先前端 → 子项目 → 后端。
- **独立性铁律**：8901/8902 未启动时前端必须正常（管理界面显示服务离线）；8900 离线时
  子项目用本地默认配置降级运行。

## 环境配置详解

以下命令均为 PowerShell。版本号权威事实见[本地开发环境](../standards/local-dev.md)
（conda `QED_env`、Python 3.12、Node v24.16.0、npm 11.13.0）。

### 前置依赖自检

```powershell
conda env list                                   # 应包含 QED_env
conda run -n QED_env python --version            # 应输出 Python 3.12.x
node -v                                          # 应输出 v24.x
npm -v                                           # 应输出 11.x
```

任一缺失：conda/Anaconda 未安装则安装后 `conda create -n QED_env python=3.12`；
Node.js 未安装则安装 LTS 版本并重开终端（npm 必须在 PATH 中，前端构建门禁依赖它）。

### 后端环境搭建

```powershell
# 仓库根执行（根目录 pyproject.toml 与 backend/ 同配置，editable 安装）
cd D:\coding\QED-Engine
conda run -n QED_env python -m pip install -e ".[dev]"
```

- **editable 安装**：后端代码改动后无需构建，重启 8900 即生效；`qed_engine` 包全目录可导入
  （生命周期脚本从仓库根启动 uvicorn 依赖此安装）。
- **`.env` 配置**：8900 经绝对定位读仓库根 `.env`——无论从根目录、backend/ 还是其他 CWD
  启动，密钥/数据库等配置一致；密钥不下发前端。改完 `.env` 或后端代码后必须重启 8900 才生效。

### 前端环境搭建

```powershell
cd D:\coding\QED-Engine\web-ui
npm install        # 首次或 package.json 依赖变更后
npm run build      # tsc 类型检查 + vite 构建 → dist/（8903 托管的产物）
```

- 依赖已装过可跳过 `npm install`（`node_modules/` 已存在时）。
- **跳过构建 = 改动不生效**：8903 从 `dist/` 提供静态文件，不是 Vite dev server；改前端后
  必须重建（冷启动 `--build` 会自动做，或手动 `npm run build`）。开发期热更新可用
  Vite dev server：`npm run dev`（5173 端口代理 8900）。

## 服务启动

### 冷启动标准流程（首次 / 代码改动后）

```powershell
cd D:\coding\QED-Engine

# ① 后端 8900：后台启动 + 日志落盘 + 等待健康就绪
conda run -n QED_env python scripts/qed_engine_service.py start --wait

# ② 子项目（按需）：经 8900 控制中心托管启动
Invoke-RestMethod -Method Post http://127.0.0.1:8900/api/v1/services/tracker/start
Invoke-RestMethod -Method Post http://127.0.0.1:8900/api/v1/services/axiom/start

# ③ 前端 8903：构建门禁 + 后台启动（构建失败则服务不启动）
conda run -n QED_env python scripts/qed_web_service.py start --build --wait
```

`--build` 执行 `npm run build`（tsc + vite → dist/），失败退出码 1，不以坏 dist 上线。
前端测试（`npm run test` / vitest）属**开发门禁**（见 [development.md](development.md)），
启动流程不执行测试。

> 💡 **conda run 长命令实时输出**：conda 23.3.1 会把子进程输出缓冲到退出才一次性吐出
> （长命令期间控制台长时间无输出，像卡死；结束后 conda 自身还可能崩溃打印错误报告，
> 不影响已完成的子进程结果）。需要实时输出时改用
> `conda run --no-capture-output -n QED_env python …` 或直接调用解释器全路径
> `D:\software\anaconda3\envs\QED_env\python.exe scripts\qed_web_service.py …`
> （详见 [development.md](development.md) 已知坑 5）。

### 日常快速启动（无代码改动）

```powershell
conda run -n QED_env python scripts/qed_engine_service.py start --wait
conda run -n QED_env python scripts/qed_web_service.py start --wait
# dist/index.html 缺失时 start 会自动兜底构建，无需额外操作
```

### 后台启动说明

- **生命周期脚本即后台启动**：Popen 拉起子进程（新进程组）+ 日志落盘 + PID 文件，脚本
  本身立即返回；`--wait` 额外等待健康端点就绪（默认上限 30s）。
- **8900 Start-Process 备选**（早期方式，日志为 `logs/qed-engine-8900.log` / `.err.log`）：

  ```powershell
  Start-Process "D:\software\anaconda3\envs\QED_env\python.exe" `
    -ArgumentList "-m","uvicorn","qed_engine.api.main:app","--port","8900" `
    -WorkingDirectory "D:\coding\QED-Engine\backend" `
    -RedirectStandardOutput "D:\coding\QED-Engine\logs\qed-engine-8900.log" `
    -RedirectStandardError "D:\coding\QED-Engine\logs\qed-engine-8900.err.log" -WindowStyle Hidden
  ```

- **前台备选**（官方方式，适合首次学习；终端被日志占用，`Ctrl+C` 停止）：

  ```powershell
  cd backend
  conda run -n QED_env python -m uvicorn qed_engine.api.main:app --port 8900
  ```

  > ⚠️ uvicorn 前台**没有**生命周期脚本那样的「已运行检测」：重复启动直接端口冲突
  > （`[Errno 10048]`）。启动前先 `GET http://127.0.0.1:8900/api/v1/health` 判断是否已在运行。

### 控制中心托管（推荐给子项目与前端）

前端「控制台」可视化启停，等价 API（`name` ∈ tracker / axiom / web）：

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8900/api/v1/services/tracker/start
Invoke-RestMethod -Method Post http://127.0.0.1:8900/api/v1/services/axiom/stop
Invoke-RestMethod -Method Post http://127.0.0.1:8900/api/v1/services/web/restart
Invoke-RestMethod -Method Get  http://127.0.0.1:8900/api/v1/services
```

- 托管启动经各自生命周期脚本（tracker/axiom 在子项目仓库内，web 在本仓库 `scripts/`）。
- **web 托管启动 = 纯快启动**（不带 --build）：改前端代码后请用命令行冷启动流程。
- config（8900 自身）不可经 `/services` 启停（路由层 409）。
- 子项目也可用各自脚本独立启停（在其仓库内，均支持 `--mode`）：
  `python scripts/qed_tracker_service.py start`、`python scripts/axiom_flow_service.py start`。

## 服务停止

```powershell
# 停止顺序：前端 → 子项目 → 后端
conda run -n QED_env python scripts/qed_web_service.py stop
Invoke-RestMethod -Method Post http://127.0.0.1:8900/api/v1/services/axiom/stop
Invoke-RestMethod -Method Post http://127.0.0.1:8900/api/v1/services/tracker/stop
conda run -n QED_env python scripts/qed_engine_service.py stop
```

- `stop` 幂等：未运行（无 PID 文件/ stale PID）也返回成功；优雅停止（CTRL_BREAK）5s 宽限后
  `taskkill /T /F` 强杀兜底。
- **停止可靠性语义**（2026-09-04）：判活用内核句柄探测（探测失败不再误判为「已死」）；
  优雅信号未生效由强杀兜底成功时回显 `stopped (forced)`；优雅+强杀后仍存活则退出码 1
  显式报 `stop failed`（绝不假 stopped，按提示手动 taskkill 后重试）。
- 8903 也可在控制台点「停止」；前台 uvicorn 用 `Ctrl+C`。

## 服务重启

```powershell
# 前端 8903：不构建（dist 缺失时仅自动兜底构建）；改前端代码后请走冷启动 --build
conda run -n QED_env python scripts/qed_web_service.py restart

# 后端 8900（可换 --mode）
conda run -n QED_env python scripts/qed_engine_service.py restart --wait
```

- **8900 自身重启**（无脚本场景）：`POST http://127.0.0.1:8900/api/v1/self-restart`
  （控制台「重启」按钮）——延迟启动新进程后旧进程退出。
- 改 `.env` 或后端代码后必须重启 8900 才生效；改前端代码后 8903 重启**不会**更新 dist，
  必须走 `start --build` 冷启动（或手动 `npm run build` 后刷新，no-store 免 Ctrl+F5）。

## 健康检测

| 服务 | 命令 | 就绪判据 |
| --- | --- | --- |
| 8900 后端 | `Invoke-RestMethod http://127.0.0.1:8900/api/v1/health` | HTTP 200 |
| 8903 前端 | `Invoke-RestMethod http://127.0.0.1:8903/api/v1/health` | `{"status":"ok","service":"qed-engine-web"}` |
| 8901 / 8902 | `Invoke-RestMethod http://127.0.0.1:8901/api/v1/health`（8902 同理） | HTTP 200 |
| 四服务汇总 | `Invoke-RestMethod http://127.0.0.1:8900/api/v1/services` | 各单元 `status: online` |
| 脚本查状态 | `python scripts/qed_web_service.py status`（8900 同） | `running (pid …)` |

冒烟检查：

- `GET http://127.0.0.1:8900/api/v1/config/models`（模型路由表）
- `GET http://127.0.0.1:8900/api/v1/config/keys`（供应商配置布尔，**不返回密钥值**）
- 8901 在线：`GET /catalogs/math-qe` 返回真实数据；8901 离线：503 且配置域不受影响。
- 启动自检（ARCH-014）：LLM 供应商可达性与 MySQL 连接在 8900 **启动时**各探测一次
  （LLM 写启动日志；MySQL 结果读 `GET /config/database` 启动快照）。

## 日志与监控

| 目标 | 位置 / 命令 |
| --- | --- |
| 后端 8900（脚本启动） | `logs/qed-engine-serve.log`（Start-Process 备选为 `qed-engine-8900.log`/`.err.log`） |
| 前端 8903 | `logs/qed-web-serve.log` |
| 子项目 | `logs/tracker.log`、`logs/axiom.log` |
| 经 8900 查看日志 | `GET /api/v1/logs/{service}?tail=200&keyword=…`（`service` ∈ config/tracker/axiom/web） |
| 组件监控 | `GET /monitor/gpu`、`GET /monitor/lmstudio`、`GET /monitor/mineru` |

本地模型模式（`--mode local`）配套脚本：`scripts/text-model/qed_lmstudio_service.py`
（LM Studio，`lms` CLI，默认 5001）、`scripts/image-model/qed_mineru_service.py`
（MinerU WSL Docker 容器，8002）——由 8900 模型管理器资源互斥编排调用，也可手动执行。

## 启动故障排查清单

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `ModuleNotFoundError: qed_engine`（前台 uvicorn） | 未做 editable 安装且不在 `backend/` 目录执行 | `cd backend` 后重跑，或 `conda run -n QED_env python -m pip install -e ".[dev]"` |
| `ModuleNotFoundError: fastapi/uvicorn` | 未使用 QED_env 环境 | 加 `conda run -n QED_env` 前缀或先 `conda activate QED_env` |
| `[Errno 10048] address already in use` | 端口已被占用（重复启动） | `Get-NetTCPConnection -LocalPort 8900` 查占用进程，停掉或换端口 |
| `npm not found`（构建门禁） | Node 未安装或 npm 不在 PATH | 安装 Node.js（版本见 local-dev.md）并重开终端 |
| `npm run build` 失败（tsc 报错） | 前端代码类型错误 | 修复后重试；服务不会以坏 dist 启动（退出码 1） |
| `dist/index.html 缺失，自动兜底构建` 提示 | 首次启动或 dist 被清理 | 正常现象，等待构建完成再启动 |
| `start --build` 卡住/超时（>1800s 天花板） | npm 网络或依赖损坏 | `cd web-ui; npm install` 后单独跑 `npm run build` 看输出；超时会 taskkill 杀整树，不留 node 孤儿 |
| `conda run` 包着脚本长时间无输出，结束后打印 conda 错误报告 | conda 23.3.1 输出缓冲到子进程退出 + 自身崩溃报错（development.md 已知坑 5） | 不影响结果；要实时输出见「冷启动标准流程」注（`--no-capture-output` 或直接解释器路径） |
| `stop` 回显 `stopped (forced)` | 优雅信号（CTRL_BREAK）未生效（conda run 等跨 console 语境常见），taskkill 强杀兜底成功 | 正常现象，无需处理 |
| `stop` 回显 `stop failed: pid …` | 优雅停止与 taskkill 强杀后进程仍存活 | 按提示手动 `taskkill /PID <pid> /T /F`，确认后重试 stop 清理 PID 文件 |
| 前端改版后看不到变化 | dist 未重建 | `cd web-ui; npm run build` 后刷新（no-store 免 Ctrl+F5） |
| 控制台中文乱码 | Windows PowerShell 控制台 GBK 编码 | 不影响功能；日志用 `Get-Content -Encoding UTF8` 查看 |
| 8903 `start` 显示 already running 但仍打不开 | PID 文件指向已死进程 | `stop` 一次清理 stale PID 再 `start` |
| 8900 服务域显示 tracker/axiom offline | 子项目未启动 | 见「控制中心托管」两种方式任选 |
| 端口 8900-8903 全无监听 | 服务全部未启动 | 按「冷启动标准流程」逐步拉起 |
