# 配置中心 API 契约

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-16
关联代码：`backend/qed_engine/api/main.py`、`backend/qed_engine/api/schemas.py`、`backend/qed_engine/api/tracker.py`（8901 客户端与服务控制模块分别归属[服务契约](service-contracts.md)与[服务控制设计](service-control.md)；三域拆分与监控诊断端点见 [backend-domain-split.md](backend-domain-split.md)，ARCH-012 轮已实现）
关联测试：`tests/test_config.py`、`tests/test_api.py`、`tests/test_tracker_client.py`、`tests/test_web.py`
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)、[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)、[ADR 0008](../adr/0008-frontend-react-refactor.md)

## 目的与边界

8900 是 QED-Engine 后端（三域组织见 [backend-domain-split.md](backend-domain-split.md)）的
**对外 API 契约总表**：读取根 `.env`，向 QED-Engine 前端与子项目提供健康检查、模型路由、
数据域语义 API、服务托管与监控诊断。**密钥绝不下发**——子项目不经过中心获取 key，而是直读
根 `.env`（`scripts/load-env.ps1` 过渡映射层已于 2026-08-17 退役），中心只回答"用哪个模型、
是否已配置"。

**8900 五合一角色（2026-08-06 架构评审 + 2026-08-11 ADR 0007 网关化扩展 + 2026-08-16
ARCH-011/012/014 轮）**：浏览器无法直读 `.env` 且密钥不下发，8900 是 `.env` 的唯一只读语义代理；
角色收敛为：
① 配置语义代理（`/config/models` 模型路由表，前端与子项目「用哪个模型」的答案源；
`/config/keys` 供应商配置布尔）；
② **启动自检**（ARCH-014：LLM 供应商可达性与 MySQL 连接在 8900 启动时各探测一次——LLM
结果写日志，MySQL 结果为 `/config/database` 启动快照；不再提供按需探测端点）；
③ **数据域网关**（ADR 0007：catalogs / selections / downloads / tasks 语义 API 归 8900 所有，
内部经 TrackerClient 适配 8901，前端唯一入口）；
④ **服务域（控制中心）**（ADR 0007 / ADR 0005：/services 端点族启停托管，契约事实源为
[service-control.md](service-control.md)）；
⑤ **监控与诊断域**（ARCH-012 轮已实现：/logs 日志查看、/monitor/gpu、/monitor/lmstudio、
/monitor/mineru 组件监控、/self-restart 自身重启——支撑前端控制台）。当前子项目零消费
8900（直读 `.env`）。

## 服务信息

- 服务名：`qed-engine-config`（兼容名；FastAPI 标题 QED-Engine Backend）
- 端口：`8900`
- 前缀：`/api/v1`
- 启动（根仓库目录）：`python -m uvicorn qed_engine.api.main:app --host 127.0.0.1 --port 8900`

## 接口契约

### GET /api/v1/health

存活检查，返回服务状态与版本。

```json
{"status": "ok", "service": "qed-engine-config", "version": "0.1.0"}
```

### GET /api/v1/config/models

模型路由表（**单线路**：只返回当前生效用途，qwen 三用途；备选线路启用时恢复路由）：
`default`/`ocr`/`embedding` 为当前生效档（qwen）。子项目不感知密钥。

```json
{
  "default":   {"model": "qwen-plus",    "provider": "qwen",     "configured": true},
  "ocr":       {"model": "qwen-vl-plus", "provider": "qwen",     "configured": true},
  "embedding": {"model": "text-embedding-v4", "provider": "qwen", "configured": true}
}
```

- `configured`：对应供应商 key 是否已配置（空值视为未配置），子项目据此决定降级策略。
- 模型名全部来自根 `.env`（见[configuration-and-secrets.md](configuration-and-secrets.md) 变量表）。
- 备选线路（GLM 对话/专用文档 OCR、deepseek 对话）变量已注释于 `.env.example`，启用时恢复
  本接口对应路由；glm-ocr 文档解析专用接口（布局+文本提取，支持图片/PDF）的接入适配在
  Axiom-Flow 对接轮完成（REQ-008，备选线路启用时恢复）。

### GET /api/v1/config/keys

供应商配置状态（CLI/内部降级判断用），只返回布尔，**永不返回密钥值**。

```json
{"deepseek": true, "qwen": false, "glm": false}
```

> 说明：该布尔仅表示「key 是否已配置」，**不代表服务可达**。供应商可达性由 8900
> **启动自检**负责（ARCH-014，见下节），前端横幅不再展示。

### LLM 供应商启动自检（ARCH-014：/config/llm-status 端点已删除）

2026-08-16 用户裁决：供应商 LLM 可达性**不再提供按需探测端点**（原 `GET /config/llm-status`
已删除，返回 404）；8900 **启动时对已配置 key 的供应商探测一次**（models 列表接口，免费、
无 token 消耗，5s 超时），结果写启动日志（`启动自检：qwen LLM 可达=True（…）`）。未配置 key
的供应商不探测。**强制规则**：密钥只出现在探测请求头，绝不进入日志/异常信息。

### GET /api/v1/config/database

统一数据库配置与**连接状态**（2026-08-04 用户裁决：MySQL 8 新建 `qed` 库，三项目共用；
ARCH-014：语义改为**启动快照**——8900 启动时真实连接探测一次，本端点只读快照，不再按需
探测）。只返回主机/库名等非敏感信息与布尔配置状态，**密码值绝不下发**。

```json
{
  "host": "127.0.0.1", "port": 3306, "name": "qed", "user": "root",
  "configured": true, "reachable": true, "reason": ""
}
```

- `configured`：`QED_DB_PASSWORD` 是否已配置（空视为未配置），子项目据此决定数据库能力降级。
- `reachable`：**启动时真实连接验证**（pymysql 认证探测，3s 超时）的结果快照，
  不得以配置布尔冒充；未配置密码不探测（`reason="未配置"`）。
- `reason`：不可达原因——`未配置`（不探测）/ `超时` / `认证失败` / `连接失败`
  （错误摘要不含密码与主机细节）。
- 变量来源与别名映射见[configuration-and-secrets.md](configuration-and-secrets.md) 统一数据库小节。
- 字段变化（如新增库名列表）需同步更新本契约与 `backend/qed_engine/api/schemas.py`。

## 数据域语义 API（ADR 0007 新增：接口归 8900 自有契约）

前端（8903）只连 8900：目录/资源/任务契约归 8900 所有（数据域），路径与 8900 前端接入前
的 8901 路径一致（前端只换 BASE、零逻辑改动）；内部经 `tracker_client.py`（8901 客户端）
适配 8901，8901 契约正文以 [service-contracts.md](service-contracts.md) 为事实源。

| 端点 | 语义 | 内部适配 |
| --- | --- | --- |
| `GET /catalogs/{course_id}` | 课程目录（知识点树主数据源） | TrackerClient.get_catalog（8901 GET /catalogs/{course_id}） |
| `GET /tasks` / `GET /tasks/{id}` | 任务列表与轮询 | TrackerClient.list_tasks / get_task |

> 旧 `/resources` 清单/详情/预览/状态机端点与 `/tasks/catalog/evaluate`、`/tasks/books/download`
> 已随 QED-030（qt_resources 退役）移除，本表不再登记。

> **三表语义 API（qt_selections / qt_downloads / qt_sources）已随 QED-031 知识层次重构
> （qed_domain/qed_course 共享 + qt_knowledge/qt_books/qt_sources）退役（2026-08-17 五层落地）**：
> 下表端点登记为历史契约（Superseded 状态），8900 不再暴露；三表模型历史契约见
> [downloads-three-table-model.md](downloads-three-table-model.md)。

**五层语义 API（QED-031，2026-08-17 落地）**：知识行（qt_knowledge）draft→confirmed→completed；
书行（qt_books）candidate→decided→downloading→downloaded→verified；渠道（qt_sources）一次尝试
一条，ok 表达成败。路径与 8901 一致（透传）；`GET /books` 被数据域·Axiom 预留路由占用
（axiom.py，仅 GET，与 tracker 的 POST /books 不冲突），五层 GET 端点无此路径冲突。

| 端点 | 语义 | 内部适配 |
| --- | --- | --- |
| `GET /knowledge?course_id=&status=` | 知识行列表（rejected/superseded 彻底隐藏由上游数据层保证） | TrackerClient.list_knowledge |
| `GET /knowledge/{id}` | 知识行详情（含所辖书行列表） | TrackerClient.get_knowledge |
| `POST /knowledge/{id}/confirm` `{"textbook_ref","exercise_ref","textbook_intro","exercise_intro"}` | 知识行 draft→confirmed（定稿：引用 {title,version} + 简介，均可空） | TrackerClient.confirm_knowledge |
| `POST /knowledge/{id}/complete` | 知识行 confirmed→completed（所辖书行全部 verified 聚合触发） | TrackerClient.complete_knowledge |
| `POST /knowledge/{id}/reject` `{"reason"}` | 知识行否定（reason 必填 422；终态彻底隐藏） | TrackerClient.reject_knowledge |
| `POST /knowledge/{id}/supersede` `{"reason"}` | 知识行过时（被新版本替代，旧版本不再可见） | TrackerClient.supersede_knowledge |
| `POST /books` `{"knowledge_id","title",...}` | 新建书行候选（先登记再下载；knowledge_id+title 必填 422） | TrackerClient.create_book |
| `GET /books/{id}/sources` | 渠道尝试列表（详情弹窗；失败尝试留痕不展示由上游过滤） | TrackerClient.list_book_sources |
| `POST /books/{id}/sources` `{"channel",...}` | 登记一次渠道尝试（ok 表达成败） | TrackerClient.add_book_source |
| `POST /books/{id}/register` `{"relative_path"}` | 人工下载登记（candidate→downloaded 直转，PDF 校验在 8901 侧） | TrackerClient.register_book |
| `POST /books/{id}/decide` | 候选→决定（人工决定下载） | TrackerClient.decide_book |
| `POST /books/{id}/start` | 决定→下载中（任务运行） | TrackerClient.start_book |
| `POST /books/{id}/fail` / `retry` | 下载失败标记 / 失败重试 → downloading | TrackerClient.fail_book / retry_book |
| `POST /books/{id}/complete` `{"sha256","relative_path","page_count",...}` | 下载完成回填（sha256+relative_path 必填 422；服务端/自动下载链路调用） | TrackerClient.complete_book |
| `POST /books/{id}/verify` | 人工验收通过（downloaded→verified 终态） | TrackerClient.verify_book |
| `POST /books/{id}/reject` `{"reason","note"}` | 书行否定（reason 必填 422，硬删+留痕；note 可选审理备注） | TrackerClient.reject_book |
| `POST /books/{id}/supersede` `{"reason"}` | 书行过时（版本换代留痕） | TrackerClient.supersede_book |

**错误映射**：8901 返回 4xx（如 409 状态机冲突）→ 8900 同码透传上游 detail（前端既有 409
处理生效）；8901 连接失败/5xx → 503 + `QED-Tracker 服务不可达：…`（前端据此降级显示，
独立性铁律）。reject/supersede 缺 reason 与 create/register/complete 缺必填字段由 8900
校验直接 422，不请求 8901。

### 数据域·Axiom（8902 适配，2026-08-16 登记，REQ-034）

前端（8903）只连 8900：Axiom-Flow 解析进度与原始文档对照数据归 8900 所有（数据域），
内部经 `clients/axiom_client.py`（8902 客户端）适配 8902。8902 契约草案事实源：
Axiom-Flow `docs/design/8902-integration-contract.md`（V2-007 冻结后按回执微调）。

| 端点 | 语义 | 内部适配 |
| --- | --- | --- |
| `GET /books` | 书目列表（含解析进度） | AxiomClient.list_books |
| `GET /books/{id}/pages/{no}` | 单页完整数据（原页图 URL + markdown + blocks，原始文档对照主数据源） | AxiomClient.get_book_page |
| `GET /books/{id}/manifest` | 产物清单（文件路径/大小/哈希） | AxiomClient.get_book_manifest |
| `POST /parse-jobs` `{"book_id","pages","strategy"}` | 提交解析任务（202；strategy 默认 hybrid） | AxiomClient.create_parse_job |
| `GET /parse-jobs/{id}` | 任务状态与进度（queued/running/completed/failed） | AxiomClient.get_parse_job |

**错误映射**：8902 返回 4xx（400 参数非法 / 404 book/page 不存在）→ 8900 同码透传上游
detail；8902 连接失败/5xx → 503 + `Axiom-Flow 服务不可达：…`（前端据此降级显示，
独立性铁律：8902 离线不影响其他界面）。

## 服务域（/services，ADR 0007 落实 ADR 0005）

`GET /services` 与 `POST /services/{name}/start|stop|restart` 端点族由
[service-control.md](service-control.md) 契约事实源定义（服务注册表/过渡窗口/错误语义），
实现于 `backend/qed_engine/services/service_manager.py`（能力层）与 `backend/qed_engine/api/control.py`
（路由层，ARCH-012 三域拆分）；8903 服务健康面板改经 `GET /services`
获取三服务状态（不再直连 8901/8902 健康端点）。

## 监控与诊断域（2026-08-16 登记，ARCH-012 轮已实现）

支撑前端控制台的组件监控（GPU / LM Studio / mineru / 日志 / 8900 自身重启）。
**本域不在前端重构轮实施**（2026-08-16 用户裁决：本轮只做前端部分，控制台只用既有
端点）；契约先行登记，ARCH-012 轮落地，实现于 `services/log_viewer.py` 与
`services/monitor.py`（ARCH-012 轮落地），路由挂 `api/control.py`。

### GET /api/v1/logs/{service}

服务日志查看（错误诊断）：读取 `/services` 注册表声明日志文件（logs/<log_name>.log，
**白名单**，越权 404）。

```json
{"service": "tracker", "log_path": "D:/coding/QED-Engine/logs/tracker.log",
 "lines": ["...", "..."]}
```

- 查询参数：`tail`（返回行数，默认 200，上限 1000）、`keyword`（子串过滤，可选）。
- 白名单 = 服务注册表（service-control.md）内各单元 log_name；未知服务 404。

### GET /api/v1/monitor/gpu

GPU 状态（nvidia-smi 解析，本地 4080）：型号、显存总量/已用、利用率、占用进程列表。

```json
{"available": true, "name": "NVIDIA GeForce RTX 4080", "memory_total_mb": 16376,
 "memory_used_mb": 4096, "utilization_percent": 65,
 "processes": [{"pid": 1234, "name": "LM Studio", "memory_mb": 4096}]}
```

- `available=false` 附 `reason`（nvidia-smi 不存在/无 GPU/解析失败）。
- 该数据用于控制台「本地 LLM 与 mineru 不能同时进 GPU」的显存提示。

### GET /api/v1/monitor/lmstudio

本地 LLM（LM Studio，OpenAI 兼容）探测：服务可达性 + 已加载模型。

```json
{"reachable": true, "base_url": "http://127.0.0.1:1234/v1", "models": ["qwen3-8b"],
 "reason": ""}
```

- 探测目标与超时沿 `/config/llm-status` 模式（未配置不探测）；默认
  `http://127.0.0.1:1234/v1`（`QED_LMSTUDIO_URL` 可覆盖，变量表见
  [configuration-and-secrets.md](configuration-and-secrets.md)）。

### GET /api/v1/monitor/mineru

mineru 解析服务（8002，WSL 容器）健康探测。

```json
{"reachable": true, "port": 8002, "reason": ""}
```

- 容器未启动/WSL 不可达 → `reachable=false` + 中文原因（提示运行容器编排脚本），
  不泄漏堆栈。

### POST /api/v1/self-restart

8900 自身重启（控制台「重启」按钮）：spawn 新进程（同启动命令+端口）→ 新进程健康
探测通过 → 旧进程退出。`config` 单元不可经 /services 启停的既有限制保持（本端点只
用于 8900 自身重启，不开放启停）。

```json
{"status": "restarting"}
```

- Windows 下 spawn/退出的技术风险实施期验证；失败时返回明确错误并提示人工重启。

## 强制规则

- 配置域端点（health / models / keys / database）任何时刻都必须可用（离线自启动）：缺 `.env`
  或 key/密码为空时按未配置降级，不报错。
- 数据域/服务域在 8901/8902 离线时返回 503/409 等明确语义，**不影响配置域端点**。
- 密钥值（API key、数据库密码）不得出现在任何响应体、日志或异常信息中（含启动自检日志）。
- 子项目不依赖本中心获取 key；中心接口变更不影响子项目启动与降级运行。
- CORS 白名单按全局端口规划（ADR 0002）：允许 8900（配置中心自身）、8901（QED-Tracker）、
  8902（Axiom-Flow）、8903（前端）及 8000（Axiom-Flow 迁移前兼容）的 127.0.0.1/localhost
  来源；白名单外来源拒绝预检（400）。子项目 CORS 收窄为后续可选请求（ADR 0007 决定 6）。

## 验证

- `pytest tests -q` 全绿；`ruff check backend tests` 无错误。
- uvicorn 启动后：配置域四接口均返回 200；启动日志含 LLM 启动自检与 MySQL 快照信息；
  `/config/llm-status` 返回 404（ARCH-014 已删除）；`/config/database` 返回启动快照
  （`reachable`/`reason` 与启动时一致，不再按需探测）。
- 8901 在线时 `/catalogs/math-qe` 返回真实数据；8901 离线时返回 503 且配置域
  不受影响（独立性铁律）。
- 供应商 key 真实可用性以各服务实际调用为准（`scripts/check_api_keys.py` 已于 2026-08-17
  随 scripts/ 整理退役；glm 曾返 429 余额不足以智谱账户状态为准，不影响中心降级运行）。
