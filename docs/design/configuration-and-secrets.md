# 统一配置与密钥规范

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-17
关联代码：根 `.env.example`、`backend/qed_engine/config.py`、`backend/qed_engine/cli.py`
关联测试：`tests/test_config.py`、`tests/test_api.py`、`tests/test_cli.py`（见[配置中心 API 契约](config-center-api.md)）
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)

## 目的与边界

本标准规定三个项目的 API key、模型选择与服务端口如何在根仓库集中管理。根 `.env` 是密钥的
唯一事实源；子项目直读根 `.env` 的 `QED_*` 变量（`scripts/load-env.ps1` 过渡映射层已于
2026-08-17 退役删除）。

子项目自身配置细节以其各自 `docs/design/` 为准；本文件只定义跨项目变量与映射。

## 变量总表

### 供应商 API Key（根 `.env` 唯一事实源）

| 变量 | 供应商 | 用途 | 映射到的子项目变量 |
| --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | deepseek | 推理/文本模型：QED-Engine 后端、解析文本模型（预留） | 无（预留） |
| `QWEN_API_KEY` | 阿里百炼 | OCR/视觉模型与百炼调用 | `AXIOM_API_KEY`（Axiom-Flow）、`DASHSCOPE_API_KEY`（QED-Tracker，Phase 2 后直读本变量，映射退役） |
| `GLM_API_KEY` | 智谱 | 备选/未来模型（预留） | 无（预留） |

### 模型选择（单线路：qwen 三用途）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_MODEL` | 主对话模型 | `qwen-plus` | 映射：Axiom-Flow/QED-Tracker 文本模型（对接轮启用） |
| `QED_OCR_MODEL` | OCR/视觉模型 | `qwen-vl-plus` | 映射：Axiom-Flow 读 `AXIOM_VISION_MODEL` |
| `QED_EMBEDDING_MODEL` | 嵌入/向量化模型 | `text-embedding-v4` | 三项目检索与知识库共用（RAG 轮启用） |

**单线路策略（2026-08-09 用户裁决）**：一次只启用一条模型线路（当前 qwen 三用途即全部模型选择），
暂不用备用线路。备选线路变量 `GLM_MODEL`/`GLM_OCR_MODEL`/`DEEPSEEK_MODEL` 已注释于 `.env.example`，
`/config/models` 只返回三个用途路由。后续需要备用线路时：恢复 `.env.example` 变量 → 在
`backend/qed_engine/config.py` 恢复字段与路由 → 同步本表与本契约 → 恢复测试断言。

### 服务端口与地址（默认值即全局端口规划，可环境变量覆盖）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_CONFIG_CENTER_URL` | 配置中心地址 | `http://127.0.0.1:8900` | 统一 CLI/前端使用 |
| `QED_TRACKER_URL` | QED-Tracker 服务地址 | `http://127.0.0.1:8901` | 统一 CLI/前端使用；服务启动端口见 `QED_TRACKER_PORT` |
| `QED_TRACKER_PORT` | QED-Tracker 服务监听端口 | `8901` | 服务化轮启用 |
| `QED_AXIOM_URL` | Axiom-Flow 服务地址 | `http://127.0.0.1:8902` | 取代 QED-Tracker 现状的 `axiom_url` 默认 8000 |
| `QED_LMSTUDIO_URL` | LM Studio 本地 LLM 地址 | `http://127.0.0.1:1234/v1` | 控制台 /monitor/lmstudio 探测目标 |

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
- 数据库配置状态由配置中心 `/config/database` 接口暴露（configured/reachable/reason，
  密码不下发），见[配置中心 API 契约](config-center-api.md)。

## 强制规则

- 根 `.env` 是密钥唯一事实源，不入库；根 `.env.example` 入库存模板，只放占位空值。
- 密钥不写入文档、日志、测试输出或提交信息。
- `.env` 中变量为空时，子项目使用自身降级默认值（离线可用），不因缺 key 阻塞启动；无根
  `.env` 时使用内置最小默认值并输出尾注提醒。
- 环境变量优先级：子项目自身覆盖（如 `QED_TRACKER_URL`）> 根 `.env` 导出 > 代码默认值。
- 新增供应商 key、模型变量或服务端口时，同步更新本表、`.env.example` 与配置中心路由。
- 新增数据库变量（`QED_DB_*`）或变更库名时，同步更新本表、`.env.example`、配置中心
  `/config/database` 接口契约与子项目数据库别名映射。

## 统一配置中心（QED-Engine 后端）

配置中心（`backend/qed_engine/`，端口 8900）读取根 `.env`，提供健康检查、模型路由表与数据库配置
状态，**密钥绝不下发**（详见[配置中心 API 契约](config-center-api.md)）。子项目获取 key 的路径：
直读根 `.env` 变量（`load-env.ps1` 过渡映射层已于 2026-08-17 退役）。中心接口变更不影响子项目启动。

## 执行与验证

- 修改 `.env.example` 或本表后，人工核对变量名一致（脚本 `check-env-consistency` 或人工对照）。
- 配置中心变更后：`pytest tests -q` 全绿、`ruff check src tests` 无错误、8900 端口五接口 200。
- 密钥与模型真实可用性以各服务实际调用为准（`scripts/check_api_keys.py` 已于 2026-08-17 退役；
  glm 曾返 429 余额不足属账户状态，不影响降级运行）。
