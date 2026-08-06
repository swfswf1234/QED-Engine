# QED-Engine

> 从公理到证明，重构你的数学认知边界。

QED-Engine 是一个个人高等数学学习系统，由三个独立项目组成：**QED-Tracker** 负责发现和下载
教材、习题集与论文，**Axiom-Flow** 负责把 PDF 一比一解析为可检索、可审阅、可追溯的结构化内容，
**QED-Engine** 提供学习界面与管理界面，并集中管理模型、API-key 与数据库配置。

```mermaid
flowchart LR
    A[QED-Tracker] -->|下载/登记原始 PDF| B[Axiom-Flow]
    B -->|解析产物/知识发布| C[QED-Engine 管理界面]
    C --> D[QED-Engine 学习界面]
    E[QED-Engine 后端<br/>统一配置中心] -.提供模型/API-key/数据库选择.-> A
    E -.提供模型/API-key/数据库选择.-> B
```

## 三个项目

| 项目 | 职责 | 形态 | 仓库 |
| --- | --- | --- | --- |
| QED-Tracker | 教材/习题集/论文的发现、下载、校验、登记 | Python CLI | [README](https://github.com/swfswf1234/QED-Tracker) |
| Axiom-Flow | PDF 解析、OCR、公式/图表还原、质量审阅 | FastAPI + Worker + Web 工作台 | [README](https://github.com/swfswf1234/Axiom-Flow) |
| QED-Engine | 学习界面、管理界面、统一配置中心 | 配置中心已落地：FastAPI（Python 3.12），端口 8900 | 本仓库 |

子项目为独立 git 仓库，嵌入本仓库目录下，可独立开发、独立部署。

## 四个服务与独立性

| 服务 | 职责 |
| --- | --- |
| QED-Engine 前端 | 学习界面（知识点/练习/温故知新）、管理界面（解析进度、原始文档对照、追溯） |
| QED-Engine 后端 | 统一配置中心：模型/API-key/数据库选择，向子项目提供接口 |
| Axiom-Flow 服务 | 解析、OCR、质量审阅与知识发布 |
| QED-Tracker 服务 | 下载、校验、登记与交付 |

**独立性**：Axiom-Flow 与 QED-Tracker 未启动时，QED-Engine 前端对话/展示必须正常；QED-Engine
后端离线时，前两者用本地默认配置降级运行。

## 快速开始

### QED-Engine 配置中心（本仓库）

```powershell
# 0. 使用 conda 环境（Python 3.12）；需要本机 MySQL 8 实例并创建三项目共用的 qed 库
conda activate QED_env

# 1. 准备密钥：复制模板并填入真实 API key 与 QED_DB_* 数据库配置
Copy-Item .env.example .env

# 2. 安装与启动（根仓库目录）
python -m pip install -e ".[dev]"
python -m uvicorn qed_engine.api.main:app --host 127.0.0.1 --port 8900

# 3. 验证
Invoke-RestMethod http://127.0.0.1:8900/api/v1/health
Invoke-RestMethod http://127.0.0.1:8900/api/v1/config/models

# 4. 真实调用验证各供应商 key（不打印密钥）
python scripts/check_api_keys.py
```

接口契约见 [配置中心 API 契约](docs/design/config-center-api.md)。

### QED-Engine 前端（8903）

原生静态单页应用（无构建步骤），浏览器直连 8900/8901 读取数据：

```powershell
# 在根仓库目录启动（QED_env 环境）
python -m http.server 8903 --directory web

# 打开 http://127.0.0.1:8903
# 主体学习界面 → 右上角"管理后台" → 后台管理（仪表盘 / 文件下载管理 / 解析进度 / 文档对照 / 追溯）
# 文件下载管理：候选清单（触发评估/确认/拒绝）、任务中心（1s 轮询）、验收台（PDF 预览+通过/删除）
# QED-Tracker（8901）未启动时页面降级显示离线提示，不影响配置横幅与页面渲染
```

前端信息架构、视觉规范与响应式说明见 [三项目对接规范](docs/design/service-contracts.md)「8903 QED-Engine 前端」小节。

### 两个子项目

```powershell
# QED-Tracker：安装与下载教材/论文（详见其 README）
cd QED-Tracker
python -m pip install -e ".[dev]"
qed-tracker --help

# Axiom-Flow：安装并启动解析服务（详见其 README，需 Python 3.12 + MySQL 8）
cd Axiom-Flow
Copy-Item .env.example .env
python -m pip install -r requirements.txt
python -m uvicorn axiom_flow.main:app --host 127.0.0.1 --port 8000
```

## 仓库结构

| 路径 | 职责 |
| --- | --- |
| `Axiom-Flow/` | 子项目（独立 git 仓库，解析与质量审阅） |
| `QED-Tracker/` | 子项目（独立 git 仓库，下载与文件管理） |
| `dataset/` | 共享数据目录：原始文档 + 解析产物（不入版本控制） |
| `src/qed_engine/` | 统一配置中心（FastAPI，端口 8900） |
| `web/` | QED-Engine 前端（8903，主体学习界面 + 后台管理，原生单页应用） |
| `scripts/` | 辅助脚本（如 load-env.ps1） |
| `tests/` | 配置中心测试（pytest + ruff 门禁） |
| `docs/` | 架构、设计、决策、规范、计划与学习资料 |
| `AGENTS.md` | Agent 执行总纲 |

## 文档

- [文档索引](docs/index.md)
- [任务台账](docs/trackers/todo.md)
- [能力路线图](docs/trackers/roadmap.md)

## License

MIT
