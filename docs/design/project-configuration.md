# 项目配置：.env、密钥与脚本

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-23
确认状态：已确认
关联代码：根 `.env.example`、`backend/qed_engine/config.py`、`backend/qed_engine/cli.py`、`scripts/`
关联测试：`tests/test_config.py`、`tests/test_api.py`、`tests/test_cli.py`（见[配置中心 API 契约](../architecture/api-contracts.md)）
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)

## 目的与边界

本标准是三个项目协同的**配置唯一事实源**，规定：

1. **.env 与密钥**：API key、模型选择、模型来源与服务端口如何配置。**根 `.env` 为
   唯一事实源**：统一使用 `QED_API_SELECT`（来源选择）+ `API_KEY`（唯一密钥）+
   `QED_API_PROVIDER`（厂商选择）三个核心变量，公共变量只在仓库根 `.env` 维护一份。
2. **脚本目录**：根仓库 `scripts/` 的布局与各脚本职责（见下方「脚本目录管理」节）。

现状与分工：QED-Engine 后端 env_file 绝对定位仓库根（任何 CWD 一致）；子项目解析器
本就「CWD 起向上走查父目录 .env 兜底」，天然兼容根 .env——各自 `.env` 中与根重复的
公共键不保留，仅留真正私有键（精简进度见任务台账）。

模型网关、本地模型生命周期与资源互斥见 [llm-gateway.md](llm-gateway.md)
（Accepted）；本文件只定义跨项目变量、映射与脚本目录布局。

## 变量总表（四段式）

> `.env` 按 **① 全局配置 / ② API 调用配置 / ③ 本地模型配置 / ④ 元数据库配置** 四段组织；
> 根仓库本地模型私有变量统一命名（`QED_LOCAL_RUNTIME` / `QED_MODEL_URL` /
> `QED_OCR_MODEL_URL` / `QED_LMSTUDIO_TOKEN` / `QED_RESOURCE_GUARD`），文字模型地址合并为
> `QED_MODEL_URL`；图像模型端口 **5002**。

### 一、全局配置

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_API_SELECT` | 默认模型来源 | `api` | `api`（默认，API key 调用）/ `local`（本地模型）/ `qed-engine`（仅子项目，经 8900 网关）；**槽位未选择时的默认来源**（槽位级运行态 `manifest.source` 优先） |
| `QED_LLM_GATEWAY_URL` | 网关地址 | `http://127.0.0.1:8900` | 子项目 `qed-engine` 模式读取；api/local 模式忽略 |
| `QED_LLM_TIMEOUT` | LLM 上游调用超时秒数 | `300` | 网关向文字/视觉/向量上游透传；按需调大 |
| `QED_DATA_ROOT` | 三项目统一数据根目录 | `<进程工作目录>/dataset/` | 解析优先级：**真实环境变量 > 自身 `.env` > 向上走查父目录 `.env` > 内置默认**；顶层布局 `raw\|tmp\|parsed/<领域>/<课程>/`（派生路径表见 [dataset-conventions.md](dataset-conventions.md)）；推荐 `D:\coding\QED-Engine\dataset` |
| `QED_PROXY` | 本地代理 | 空 | 污染/限流的 archive.org、openlibrary.org 走代理（Clash 默认混合端口 `http://127.0.0.1:7890`） |

**服务端口与地址（同属全局，默认值即全局端口规划，可环境变量覆盖）**：

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_CONFIG_CENTER_URL` | 配置中心地址 | `http://127.0.0.1:8900` | 统一 CLI/前端使用 |
| `QED_TRACKER_URL` | QED-Tracker 服务地址 | `http://127.0.0.1:8901` | 统一 CLI/前端使用；服务启动端口见 `QED_TRACKER_PORT` |
| `QED_TRACKER_PORT` | QED-Tracker 服务监听端口 | `8901` | 服务化轮启用 |
| `QED_AXIOM_URL` | Axiom-Flow 服务地址 | `http://127.0.0.1:8902` | 取代 QED-Tracker 现状的 `axiom_url` 默认 8000 |

### 二、API 调用配置

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_API_PROVIDER` | 厂商选择（api 来源） | `qwen` | 取值 `qwen`（默认，当前唯一启用）/ `deepseek` / `glm`（注册表预留，启用时验证真实可用性）；厂商地址表见 [llm-gateway.md](llm-gateway.md) |
| `API_KEY` | 唯一供应商密钥 | 空 | **唯一密钥变量**（逐厂商 key 已取消，无别名回退）；根 `.env` 维护一份，子项目经向上查找兜底；local 模式直连供应商用 |
| `QED_MODEL` | 文字槽位身份 | `qwen-plus` | 注册表身份名（见 [llm-gateway.md](llm-gateway.md)）；api 来源解析厂商模型，local 来源由控制台 `manifest.active` 覆盖 |
| `QED_OCR_MODEL` | 图像槽位身份 | `qwen-vl-plus` | 同上；deepseek 无视觉（`/config/models` 显示「（无视觉）」）；映射：Axiom-Flow 读 `AXIOM_VISION_MODEL` |
| `QED_EMBEDDING_MODEL` | 向量槽位身份 | `text-embedding-v4` | 三项目检索与知识库共用（RAG 轮启用） |
| `AXIOM_API_KEY` | Axiom-Flow 旧变量（别名） | 空 | Axiom-Flow 侧保留兼容，由其执行侧按自身门禁决定退役 |
| `DASHSCOPE_API_KEY` | QED-Tracker 旧变量（别名） | 空 | QED-Tracker 侧保留兼容，由其执行侧按自身门禁决定退役 |

**身份语义（值不分 api/local + 槽位级运行态）**：三个槽位变量值为**模型身份名**
（注册表身份目录见 [llm-gateway.md](llm-gateway.md)），不区分 api/local 两套；身份 → api 引用 /
本地引用的映射归注册表（`registry.resolve`：`manifest.active` > `.env` 身份变量 > 槽位默认）。
**来源与本地渠道同样支持槽位级运行态**（`manifest.source` / `manifest.runtime`，控制台选择写入，
见 [local-model-management.md](local-model-management.md)）：`.env` 的 `QED_API_SELECT` /
`QED_LOCAL_RUNTIME` 仅作槽位未选择时的默认值。api-only 身份在 api 来源按身份解析，本地身份在
api 来源回退槽位厂商默认模型（告警一次，不阻断）。

**单线路策略**：单 key（`API_KEY`）+ `QED_API_PROVIDER`
选厂商；**当前只启用 qwen 线路**（三用途：主对话/OCR/Embedding）。deepseek/glm 已在
`backend/qed_engine/services/llm/clients.py` 的 `PROVIDERS` 注册表预留（含厂商地址与默认模型），
**启用时验证真实可用性**后切换 `QED_API_PROVIDER`；备选线路变量（`GLM_MODEL`/`GLM_OCR_MODEL`/
`DEEPSEEK_MODEL`）未恢复，切换厂商时同步本表与本契约。

### 三、本地模型配置（根仓库私有）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_LOCAL_RUNTIME` | 默认本地渠道 | `lmstudio` | `lmstudio`（半托管，默认）/ `llamacpp`（llama-server）/ `docker`（MinerU）；**槽位未选择渠道时的默认值**（`manifest.runtime` 优先）；runtime 同化语义见 [local-model-management.md](local-model-management.md) |
| `QED_MODEL_URL` | 文字模型地址 | `http://127.0.0.1:5001/v1` | 文字槽位本地端点（OpenAI 兼容）；lmstudio 与 llamacpp **共用**（本机同为 5001）；LM Studio 端口以 `lms server status` 为准 |
| `QED_OCR_MODEL_URL` | 图像模型地址 | `http://127.0.0.1:5002` | 图像槽位本地端点（MinerU 容器，健康端点 `/health`） |
| `QED_LMSTUDIO_TOKEN` | LM Studio API 认证 token | 空 | 仅 lmstudio 渠道需鉴权（REST v0 与 OpenAI 调用均需 Bearer）；其余渠道留空。**密钥类，只存 .env，勿入库/日志** |
| `QED_RESOURCE_GUARD` | 单活仲裁开关 | `true` | 启动任一本地模型前先停其他在跑本地槽位（4080 16GB 显存约束，本地同时最多一个模型进 GPU）；`false` 时跳过 |

### 四、元数据库配置（MySQL 8，qed 库）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_DB_HOST` | 数据库主机 | `127.0.0.1` | 三个项目共用同一 MySQL 8 实例 |
| `QED_DB_PORT` | 数据库端口 | `3306` | — |
| `QED_DB_NAME` | 数据库名 | `qed` | 统一库：QED-Tracker 用 `qt_*` 表、Axiom-Flow 用 `af_*` 表（互不读对方表） |
| `QED_DB_USER` | 数据库用户 | `root` | — |
| `QED_DB_PASSWORD` | 数据库密码 | 空 | 密钥类变量，绝不下发、不打印 |

- 映射：Axiom-Flow `AXIOM_MYSQL_*`（存量别名，默认库名随之改为 `qed`，改造后别名退役）；QED-Tracker 服务化轮直接读取本组变量。
- `qed` 库由各项目 Alembic 独立初始化自己的表，互不影响；库面统一现状：MySQL 上仅业务库
  `qed` 与测试库 `qed_test`（隔离真实数据，保留），遗留库已收敛清零（执行与备份记录见
  trackers/completed.md 数据操作行）。
- 数据库配置状态由配置中心 `/config/database` 接口暴露（configured/reachable/reason，
  密码不下发），见[配置中心 API 契约](../architecture/api-contracts.md)。

## 强制规则

- 密钥**根 `.env` 唯一事实源**：公共键（`API_KEY`、`QED_DB_*`、
  来源/网关变量等）只在仓库根 `.env` 维护一份，各 `.env` 不入库；`.env.example` 入库存模板，
  只放占位空值。子项目经「向上走查父目录 .env」由根兜底，自身 `.env` 仅存真正私有键
  （QED-Tracker / Axiom-Flow 参照执行，请求 REQ-043 / REQ-044）。
- 密钥不写入文档、日志、测试输出或提交信息。
- `.env` 中变量为空时，项目使用自身降级默认值（离线可用），不因缺 key 阻塞启动；无自身
  `.env` 时使用内置最小默认值并输出尾注提醒。
- 环境变量优先级：进程环境覆盖 > 项目自身 `.env` > 向上走查父目录 `.env` > 代码默认值。
- 新增供应商 key、模型变量或服务端口时，同步更新本表、`.env.example` 与配置中心路由。
- 新增数据库变量（`QED_DB_*`）或变更库名时，同步更新本表、`.env.example`、配置中心
  `/config/database` 接口契约与子项目数据库别名映射。

## 脚本目录管理

根仓库 `scripts/` 集中存放服务生命周期与本地模型编排脚本：

```
scripts/
├── qed_engine_service.py        # 8900 后端生命周期 start/stop/restart/status --mode api|local
├── qed_web_service.py           # 8903 前端生命周期（静态服务，运行期不需要 .env）
├── serve_web.py                 # 前端开发态服务（构建期配置在 web-ui/.env.production）
├── text-model/
│   └── qed_qwen_service.py      # Qwen 启停/重启/状态（优先 lms CLI，兜底进程管理）
└── image-model/
    ├── qed_mineru_service.py    # MinerU 容器启停/重启/状态（WSL 5002）
    ├── compose.yaml             # MinerU 容器编排（自 Axiom-Flow 迁入）
    ├── infra-up.ps1 / infra-down.ps1 / infra-status.ps1
    ├── download-models.py       # 模型下载辅助
    └── docker/Dockerfile        # MinerU 镜像构建
```

- **生命周期脚本范式**：PID 文件 / 优雅停止 / 强杀兜底，`--mode` 参数默认读根 `.env`
  的 `QED_API_SELECT`，CLI 传入时覆盖（写入运行状态，重启可换模式）。
- **前端脚本不需要 .env**：8903 是纯静态文件服务，运行期无密钥/配置需求；构建期配置在
  `web-ui/.env.production`。
- 新增脚本时在本节登记布局与职责；脚本内读取的 `.env` 变量必须已在「变量总表」登记。

## 统一配置中心（QED-Engine 后端）

配置中心（`backend/qed_engine/`，端口 8900）读取根 `.env`，提供健康检查、模型路由表、数据库
配置状态与 **LLM 网关**（`/llm/text`、`/llm/vision`、`/llm/embedding` 三接口，见
[llm-gateway.md](llm-gateway.md)），**密钥绝不下发**
（详见[配置中心 API 契约](../architecture/api-contracts.md)）。子项目调用 LLM 的路径：local 模式用自身
`.env` 的 `API_KEY` 直连供应商；`qed-engine` 模式经网关调用（不接触密钥）。中心接口变更不
影响子项目启动。

## 执行与验证

- 修改 `.env.example` 或本表后，人工核对变量名一致（脚本 `check-env-consistency` 或人工对照）。
- 配置中心变更后：`pytest tests -q` 全绿、`ruff check src tests` 无错误、8900 端口五接口 200。
- 密钥与模型真实可用性以各服务实际调用为准。
