# 本地开发环境

状态：Current
最后更新：2026-09-11
确认状态：已确认
治理对象：本地机器标识、环境依赖、构建命令与开发约定

## 目的与边界

本文档标注 QED-Engine 项目本地开发环境的机器标识、依赖版本和构建约定，供开发者快速确认环境一致性。
本文档仅在 UUID 为 `2C6ECD2C-BBEE-11ED-8A95-F0D4154ABBA8` 的机器上生效；其他环境需复制并修改。

本文档是**环境事实的唯一维护位置**（机器标识、版本、路径、端口）；可复制命令的唯一维护位置是
[开发指南](../guides/development.md)「环境速查与命令矩阵」，本节不复制命令正文。

## 机器标识

| 项目 | 值 |
|------|-----|
| UUID | `2C6ECD2C-BBEE-11ED-8A95-F0D4154ABBA8` |
| 主机名 | `wenfu` |

## Git 配置

| 项目 | 值 |
|------|-----|
| 版本 | `git version 2.41.0.windows.1` |
| 用户名 | `swfswf1234` |
| 邮箱 | `812146364@qq.com` |

## Python 环境

| 项目 | 值 |
|------|-----|
| Conda 环境 | `QED_env` |
| 环境路径 | `D:\software\anaconda3\envs\QED_env` |
| Python 版本 | `3.12.0`（`pyproject.toml requires-python = ">=3.12"`） |

激活：`conda activate QED_env`（命令矩阵见[开发指南](../guides/development.md)）。

## 前端环境

| 项目 | 值 |
|------|-----|
| Node.js | `v24.16.0` |
| npm | `11.13.0` |

## 代码改动后必做

**每次前端代码改动后必须重建 `dist/`，否则 8903 提供的仍是旧产物、浏览器看不到变化；每次
后端代码改动后必须跑全量测试。** 8903 服务从 `web-ui/dist/` 静态文件提供前端，不是 Vite dev
server——跳过构建 = 改动不生效。前端改动也可经生命周期脚本一步完成（构建 + 后台启动），完整
流程见[操作指南](../guides/operations.md)冷启动标准流程。

具体命令见[开发指南](../guides/development.md)「环境速查与命令矩阵」。

## 构建与验收

前端验收 = 构建（tsc + vite）成功 + 测试（vitest）全绿；后端验收 = `pytest tests` + `ruff`
全绿。命令见[开发指南](../guides/development.md)「环境速查与命令矩阵」，分层与门禁规则见
[测试架构与门禁](testing.md)。

### 服务端口速查

| 服务 | 端口 |
|------|------|
| QED-Engine 前端 | 8903 |
| QED-Engine 后端 | 8900 |
| Axiom-Flow | 8902 |
| QED-Tracker | 8901 |

## 常见环境坑

以下为本机环境类陷阱（原 `guides/development.md`「已知坑清单」分流而来）：

1. **`conda run` 不支持多行 `python -c`**（报 `AssertionError: newlines not implemented`）：
   需要多行脚本时先写入临时文件再执行：
   ```powershell
   conda run -n QED_env python C:\Users\86182\AppData\Local\Temp\opencode\check_names.py
   ```
2. **`ModuleNotFoundError: fastapi/uvicorn`**：忘加 `conda run -n QED_env` 前缀或未激活环境；
   排查表见[操作指南](../guides/operations.md)故障排查节。
3. **PowerShell 无 Unix 工具**（`tail`/`grep`/`head` 不存在）：管道截断用 PowerShell 原生方式
   或直接依赖工具自身输出控制。
4. **`conda run`（23.3.1）输出缓冲 + 崩溃报错**（2026-09-04 实测）：子进程全部 stdout/stderr
   被缓冲到退出才一次性吐出——长命令期间控制台长时间无输出，像卡死；且子进程退出后 conda
   自身可能崩溃打印 "An unexpected error has occurred" 错误报告（不影响已完成的子进程结果）。
   需要实时输出时改用 `conda run --no-capture-output` 或直接调用解释器全路径
   `D:\software\anaconda3\envs\QED_env\python.exe`。

## 变更与取代

环境变更时更新本文档对应字段；机器迁移时复制本文档并修改 UUID 和主机名。
