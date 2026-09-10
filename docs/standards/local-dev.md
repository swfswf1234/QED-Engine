# 本地开发环境

状态：Current
最后更新：2026-09-04
确认状态：已确认
治理对象：本地机器标识、环境依赖、构建命令与开发约定

## 目的与边界

本文档标注 QED-Engine 项目本地开发环境的机器标识、依赖版本和构建约定，供开发者快速确认环境一致性。
本文档仅在 UUID 为 `2C6ECD2C-BBEE-11ED-8A95-F0D4154ABBA8` 的机器上生效；其他环境需复制并修改。

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

激活命令：
```bash
conda activate QED_env
```

## 前端环境

| 项目 | 值 |
|------|-----|
| Node.js | `v24.16.0` |
| npm | `11.13.0` |

## 代码改动后必做

**每次前端代码改动后，必须按顺序执行以下命令，否则 dist/ 不会更新，浏览器看不到变化：**

```bash
cd web-ui
npm run build    # 1. 必须！tsc 类型检查 + vite 构建到 dist/
npm test         # 2. 测试必须全绿
```

**每次后端代码改动后：**

```bash
conda run -n QED_env python -m pytest tests -q   # 仓库根执行（tests/ 在仓库根，backend/ 下无 tests）
```

**跳过构建 = 改动不生效。** 8903 服务从 `web-ui/dist/` 静态文件提供前端，不是 Vite dev server。
前端改动也可经生命周期脚本一步完成（构建 + 后台启动）：
`python scripts/qed_web_service.py start --build --wait`（测试属开发门禁，启动流程不执行），
完整流程见 [操作指南](../guides/operations.md)冷启动标准流程。

## 构建与验收

### 前端验收流程

```bash
cd web-ui
npm run build    # 执行 tsc -b && vite build
npm run test     # 执行 vitest run
```

### 服务端口速查

| 服务 | 端口 |
|------|------|
| QED-Engine 前端 | 8903 |
| QED-Engine 后端 | 8900 |
| Axiom-Flow | 8902 |
| QED-Tracker | 8901 |

## 变更与取代

环境变更时更新本文档对应字段；机器迁移时复制本文档并修改 UUID 和主机名。
