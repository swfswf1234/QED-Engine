# 统一配置与密钥规范

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-20
关联代码：根 `.env.example`、`backend/qed_engine/config.py`、`backend/qed_engine/cli.py`
关联测试：`tests/test_config.py`、`tests/test_api.py`、`tests/test_cli.py`（见[配置中心 API 契约](../architecture/api-contracts.md)）
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)

## 目的与边界

本标准规定三个项目的 API key、模型选择、模型模式与服务端口如何配置。**2026-08-20 起密钥
按项目分置**：三项目各自内置 `.env`、各负责自身配置，统一使用 `QED_API_SELECT`（模式选择）
+ `API_KEY`（唯一密钥）+ `QED_API_PROVIDER`（厂商选择）三个核心变量；QED-Tracker 与
Axiom-Flow 参照执行。原「根 `.env` 是密钥唯一事实源、子项目直读根 `.env` 的 `QED_*` 变量」
规则被本方案取代（`scripts/load-env.ps1` 过渡映射层已于 2026-08-17 退役删除）。

模型网关、本地模型生命周期与资源互斥见 [llm-gateway-and-model-management.md](llm-gateway-and-model-management.md)
（Accepted，2026-08-20）；本文件只定义跨项目变量与映射。

## 变量总表

### 供应商 API Key（三项目各自 `.env` 分置，统一变量）

| 变量 | 用途 | 说明 |
| --- | --- | --- |
| `API_KEY` | 唯一供应商密钥 | **唯一密钥变量**（逐厂商 key 已取消，无别名回退）；由 `QED_API_PROVIDER` 选择厂商；三项目各自 `.env` 各持一份，local 模式直连供应商用 |
| `QED_API_PROVIDER` | 厂商选择（api 模式） | 取值 `qwen`（默认，当前唯一启用）/ `deepseek` / `glm`（注册表预留，启用时验证真实可用性）；**仅影响 api 模式**；厂商地址表见 [llm-gateway-and-model-management.md](llm-gateway-and-model-management.md) |
| `AXIOM_API_KEY` | Axiom-Flow 旧变量（别名） | Axiom-Flow 侧保留兼容，由其执行侧按自身门禁决定退役 |
| `DASHSCOPE_API_KEY` | QED-Tracker 旧变量（别名） | QED-Tracker 侧保留兼容，由其执行侧按自身门禁决定退役 |

### 模型模式与 LLM 网关（2026-08-20 新增，详见 llm-gateway-and-model-management.md）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_API_SELECT` | 模型模式 | `api` | `api`（默认，API key 调用）/ `local`（本地模型）/ `qed-engine`（仅子项目，经 8900 网关） |
| `QED_LLM_GATEWAY_URL` | 网关地址 | `http://127.0.0.1:8900` | 子项目 `qed-engine` 模式读取；api/local 模式忽略 |
| `QED_LMSTUDIO_URL` | 本地文字模型地址 | `http://127.0.0.1:5001/v1` | local 模式文字模型（LM Studio，OpenAI 兼容）；默认值由 1234 调整为 5001（本机实际端口） |
| `QED_MINERU_URL` | 本地图像模型地址 | `http://127.0.0.1:8002` | local 模式图像模型（MinerU 容器） |
| `QED_RESOURCE_GUARD` | 资源互斥开关 | `true` | 启动一方本地模型前先停另一方（4080 16GB 显存约束）；`false` 时跳过 |

### 模型选择（单线路：当前 qwen 三用途）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_MODEL` | 主对话模型 | 空（厂商默认兜底） | 解析后生效值：显式配置优先，否则按 `QED_API_PROVIDER` 厂商默认；映射：Axiom-Flow/QED-Tracker 文本模型（对接轮启用） |
| `QED_OCR_MODEL` | OCR/视觉模型 | 空（厂商默认兜底） | 同上；deepseek 无视觉（`/config/models` 显示「（无视觉）」）；映射：Axiom-Flow 读 `AXIOM_VISION_MODEL` |
| `QED_EMBEDDING_MODEL` | 嵌入/向量化模型 | `text-embedding-v4` | 三项目检索与知识库共用（RAG 轮启用）；本轮保持推荐值，RAG 轮再解析 |

**单线路策略（2026-08-09 用户裁决 + 2026-08-20 收敛）**：单 key（`API_KEY`）+ `QED_API_PROVIDER`
选厂商；**当前只启用 qwen 线路**（三用途：主对话/OCR/Embedding）。deepseek/glm 已在
`backend/qed_engine/services/llm/clients.py` 的 `PROVIDERS` 注册表预留（含厂商地址与默认模型），
**启用时验证真实可用性**后切换 `QED_API_PROVIDER`；备选线路变量（`GLM_MODEL`/`GLM_OCR_MODEL`/
`DEEPSEEK_MODEL`）未恢复，切换厂商时同步本表与本契约。

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
- 数据库配置状态由配置中心 `/config/database` 接口暴露（configured/reachable/reason，
  密码不下发），见[配置中心 API 契约](../architecture/api-contracts.md)。

## 强制规则

- 密钥**按项目分置**：三项目各自 `.env` 持自身 `API_KEY`（**唯一密钥变量**，逐厂商 key 已取消），
  各 `.env` 不入库；各 `.env.example` 入库存模板，只放占位空值。QED-Tracker / Axiom-Flow 参照本约定
  执行（请求 REQ-043 / REQ-044）。
- 密钥不写入文档、日志、测试输出或提交信息。
- `.env` 中变量为空时，项目使用自身降级默认值（离线可用），不因缺 key 阻塞启动；无自身
  `.env` 时使用内置最小默认值并输出尾注提醒。
- 环境变量优先级：进程环境覆盖 > 项目自身 `.env` > 代码默认值。
- 新增供应商 key、模型变量或服务端口时，同步更新本表、`.env.example` 与配置中心路由。
- 新增数据库变量（`QED_DB_*`）或变更库名时，同步更新本表、`.env.example`、配置中心
  `/config/database` 接口契约与子项目数据库别名映射。

## 统一配置中心（QED-Engine 后端）

配置中心（`backend/qed_engine/`，端口 8900）读取根 `.env`，提供健康检查、模型路由表、数据库
配置状态与 **LLM 网关**（`/llm/text`、`/llm/vision`，见
[llm-gateway-and-model-management.md](llm-gateway-and-model-management.md)），**密钥绝不下发**
（详见[配置中心 API 契约](../architecture/api-contracts.md)）。子项目调用 LLM 的路径：local 模式用自身
`.env` 的 `API_KEY` 直连供应商；`qed-engine` 模式经网关调用（不接触密钥）。中心接口变更不
影响子项目启动。

## 执行与验证

- 修改 `.env.example` 或本表后，人工核对变量名一致（脚本 `check-env-consistency` 或人工对照）。
- 配置中心变更后：`pytest tests -q` 全绿、`ruff check src tests` 无错误、8900 端口五接口 200。
- 密钥与模型真实可用性以各服务实际调用为准（`scripts/check_api_keys.py` 已于 2026-08-17 退役；
  glm 曾返 429 余额不足属账户状态，不影响降级运行）。
