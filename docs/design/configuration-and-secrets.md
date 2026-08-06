# 统一配置与密钥规范

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-04
关联代码：`scripts/load-env.ps1`（待退役）、根 `.env.example`、`src/qed_engine/config.py`、`src/qed_engine/cli.py`
关联测试：`tests/test_config.py`、`tests/test_api.py`、`tests/test_cli.py`（见[配置中心 API 契约](config-center-api.md)）
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)

## 目的与边界

本标准规定三个项目的 API key、模型选择与服务端口如何在根仓库集中管理。根 `.env` 是密钥的
唯一事实源；子项目直读根 `.env` 的 `QED_*` 变量。过渡期 `scripts/load-env.ps1` 承担变量映射，
子项目改造完成后退役。

子项目自身配置细节以其各自 `docs/design/` 为准；本文件只定义跨项目变量与映射。

## 变量总表

### 供应商 API Key（根 `.env` 唯一事实源）

| 变量 | 供应商 | 用途 | 映射到的子项目变量 |
| --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | deepseek | 推理/文本模型：QED-Engine 后端、解析文本模型（预留） | 无（预留） |
| `QWEN_API_KEY` | 阿里百炼 | OCR/视觉模型与百炼调用 | `AXIOM_API_KEY`（Axiom-Flow）、`DASHSCOPE_API_KEY`（QED-Tracker，Phase 2 后直读本变量，映射退役） |
| `GLM_API_KEY` | 智谱 | 备选/未来模型（预留） | 无（预留） |

### 模型选择（每供应商推荐模型）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_MODEL` | 主对话模型（当前生效档） | `qwen-plus` | 映射：Axiom-Flow/QED-Tracker 文本模型（对接轮启用） |
| `QED_OCR_MODEL` | OCR/视觉模型（当前生效档） | `qwen-vl-plus` | 映射：Axiom-Flow 读 `AXIOM_VISION_MODEL` |
| `QED_EMBEDDING_MODEL` | 嵌入/向量化模型 | `text-embedding-v4` | 三项目检索与知识库共用（RAG 轮启用） |
| `GLM_MODEL` | GLM 对话推荐（切换档） | `glm-5.2` | GLM-5 系列旗舰，1M 上下文 |
| `GLM_OCR_MODEL` | GLM 专用文档 OCR（切换档） | `glm-ocr` | 走文档解析专用接口，Axiom-Flow 对接轮适配 |
| `DEEPSEEK_MODEL` | deepseek 对话推荐（占位档） | `deepseek-v4-flash` | `deepseek-chat` 已退役；key 配置后生效 |

切换策略：测试期用 qwen（三个 `QED_*` 变量）；正式操作期改 `QED_MODEL=glm-5.2`、
`QED_OCR_MODEL=glm-ocr` 即整体切换到 GLM；deepseek 接入仅需补 key。

### 服务端口与地址（默认值即全局端口规划，可环境变量覆盖）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_CONFIG_CENTER_URL` | 配置中心地址 | `http://127.0.0.1:8900` | 统一 CLI/前端使用 |
| `QED_TRACKER_URL` | QED-Tracker 服务地址 | `http://127.0.0.1:8901` | 统一 CLI/前端使用；服务启动端口见 `QED_TRACKER_PORT` |
| `QED_TRACKER_PORT` | QED-Tracker 服务监听端口 | `8901` | 服务化轮启用 |
| `QED_AXIOM_URL` | Axiom-Flow 服务地址 | `http://127.0.0.1:8902` | 取代 QED-Tracker 现状的 `axiom_url` 默认 8000 |

### 统一数据库（MySQL 8，qed 库；2026-08-04 用户裁决）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_DB_HOST` | 数据库主机 | `127.0.0.1` | 三个项目共用同一 MySQL 8 实例 |
| `QED_DB_PORT` | 数据库端口 | `3306` | — |
| `QED_DB_NAME` | 数据库名 | `qed` | 统一库：QED-Tracker 用 `qt_*` 表、Axiom-Flow 用 `af_*` 表（互不读对方表） |
| `QED_DB_USER` | 数据库用户 | `root` | — |
| `QED_DB_PASSWORD` | 数据库密码 | 空 | 密钥类变量，绝不下发、不打印 |

- 映射：Axiom-Flow `AXIOM_MYSQL_*`（存量别名，默认库名随之改为 `qed`，改造后别名退役）；QED-Tracker 服务化轮直接读取本组变量。
- 存量库（Axiom-Flow `xqfm11`）不迁移、不改名；`qed` 库由各项目 Alembic 独立初始化（建表与迁移见各自仓库门禁）。
- 数据库配置状态由配置中心 `/config/database` 接口暴露（布尔，密码不下发），见[配置中心 API 契约](config-center-api.md)。

## 强制规则

- 根 `.env` 是密钥唯一事实源，不入库；根 `.env.example` 入库存模板，只放占位空值。
- 密钥不写入文档、日志、测试输出或提交信息。
- `.env` 中变量为空时，子项目使用自身降级默认值（离线可用），不因缺 key 阻塞启动；无根
  `.env` 时使用内置最小默认值并输出尾注提醒。
- 环境变量优先级：子项目自身覆盖（如 `QED_TRACKER_URL`）> 根 `.env` 导出 > 代码默认值。
- `scripts/load-env.ps1` 是过渡映射层：读取根 `.env`，导出供应商 key 与模型变量，并映射为
  子项目现状变量名。子项目改造为直读新变量后，映射层退役并从本表移除映射列。
- 新增供应商 key、模型变量或服务端口时，同步更新本表、`.env.example`、配置中心路由与
  `check_api_keys.py`（如适用）。
- 新增数据库变量（`QED_DB_*`）或变更库名时，同步更新本表、`.env.example`、配置中心
  `/config/database` 接口契约与子项目数据库别名映射。

## 统一配置中心（QED-Engine 后端）

配置中心（`src/qed_engine/`，端口 8900）读取根 `.env`，提供健康检查、模型路由表与数据库配置
状态，**密钥绝不下发**（详见[配置中心 API 契约](config-center-api.md)）。子项目获取 key 的路径：
现状经 `load-env.ps1` 映射，Phase 2/3 改造为直读根 `.env` 变量后映射层退役。中心接口变更不影响子项目启动。

## 执行与验证

- 修改 `.env.example` 或本表后，人工核对变量名一致（脚本 `check-env-consistency` 或人工对照）。
- `load-env.ps1` 变更后，在干净 PowerShell 会话执行一次并确认导出的子项目变量名存在。
- 配置中心变更后：`pytest tests -q` 全绿、`ruff check src tests` 无错误、8900 端口三接口 200。
- 密钥与模型真实可用性：`python scripts/check_api_keys.py`（不打印密钥；glm 429 余额不足属账户状态）。
