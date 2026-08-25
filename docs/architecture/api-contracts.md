# 8900 API 接口文档

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-20
关联代码：`backend/qed_engine/api/main.py`、`backend/qed_engine/api/schemas.py`、`backend/qed_engine/api/tracker.py`、`backend/qed_engine/api/axiom.py`、`backend/qed_engine/api/control.py`、`backend/qed_engine/clients/axiom_client.py`、`backend/qed_engine/services/log_viewer.py`、`backend/qed_engine/services/monitor.py`（8901 客户端归属[服务契约](../design/service-contracts.md)；服务控制归属[服务控制设计](../design/service-control.md)；LLM 网关归属 [llm-gateway-and-model-management](../design/llm-gateway-and-model-management.md)；服务架构见 [backend-architecture.md](backend-architecture.md)）
关联测试：`tests/test_config.py`、`tests/test_api.py`、`tests/test_tracker_client.py`、`tests/test_web.py`
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)、[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)、[ADR 0008](../adr/0008-frontend-react-refactor.md)、[ADR 0010](../adr/0010-documentation-versioning.md)

> 本文件是 **QED-Engine 的固定 API 接口文档**（ADR 0010），按**接口类型**组织（REQ-046）：
> **QED-Engine 前端无 API 接口**（静态页面 + 只连 8900，见 [frontend-architecture.md](frontend-architecture.md)），
> 本文件为 8900 全部对外端点的契约总表；8901 / 8902 的 API 文档以各自仓库
> `docs/architecture/` 为准（8900 只做透传适配）。版本末期确认更新后，前版本契约进 `history/`。

## 目的与边界

8900 是 QED-Engine 后端（三域组织见 [backend-architecture.md](backend-architecture.md)）的
**对外 API 契约总表**：读取根 `.env`，向 QED-Engine 前端与子项目提供健康检查、模型路由、
数据域语义 API、服务托管与监控诊断。**密钥绝不下发**——子项目不经过中心获取 key，而是直读
根 `.env`，中心只回答"用哪个模型、是否已配置"。

8900 是 `.env` 的唯一只读语义代理。接口按类型分为**五类**（2026-08-20 梳理，REQ-046）：

| 类型 | 端点 | 语义 |
| --- | --- | --- |
| ① 服务管理类 | `GET /health`、`GET /services`、`POST /services/{name}/start\|stop\|restart`、`POST /self-restart` | 服务启停/重启/健康检测 |
| ② 配置语义类 | `GET /config/models`、`GET /config/keys`、`GET /config/database` | 模型路由、密钥布尔、DB 启动快照 |
| ③ 数据透传·QED-Tracker | `/catalogs/{course_id}`、`/tasks`、`/knowledge*`、`/books`(POST)、`/books/{id}/sources` | 8901 语义 API 透传 |
| ④ 数据透传·Axiom-Flow | `/books`(GET)、`/books/sync`、`/books/{id}/pages\|manifest\|image`、块判定、`/parse-jobs*` | 8902 语义 API 透传 |
| ⑤ 监控诊断与 LLM 网关 | `/logs/{service}`、`/monitor/gpu\|lmstudio\|mineru`、`/llm/text\|vision\|test/*\|calls`、`/database/test` | 日志、组件监控、LLM 调用 |

**启动自检**（ARCH-014）：LLM 供应商可达性与 MySQL 连接在 8900 启动时各探测一次——LLM
结果写日志，MySQL 结果为 `/config/database` 启动快照；不再提供按需探测端点。

## 服务信息

- 服务名：`qed-engine-config`（兼容名；FastAPI 标题 QED-Engine Backend）
- 端口：`8900`
- 前缀：`/api/v1`
- 启动（根仓库目录）：`python -m uvicorn qed_engine.api.main:app --host 127.0.0.1 --port 8900`

## ① 服务管理类

### GET /api/v1/health

存活检查，返回服务状态与版本。

```json
{"status": "ok", "service": "qed-engine-config", "version": "0.1.0"}
```

### GET /api/v1/services

服务注册表状态快照（config/tracker/axiom/web 四单元），含每单元运行态与离线原因。
契约事实源：[服务控制设计](../design/service-control.md)（服务注册表/过渡窗口/错误语义），
实现于 `services/service_manager.py`（能力层）与 `api/control.py`（路由层）。

### POST /api/v1/services/{name}/start|stop|restart

服务启停托管（8901/8902/8903；`config` 单元不可经此启停）。15s 过渡窗口、409 冲突语义、
脚本黑盒管理见[服务控制设计](../design/service-control.md)。

### POST /api/v1/self-restart

8900 自身重启（控制台「重启」按钮）：spawn 新进程（同启动命令+端口）→ 新进程健康
探测通过 → 旧进程退出。`config` 单元不可经 /services 启停的既有限制保持（本端点只
用于 8900 自身重启，不开放启停）。

```json
{"status": "restarting"}
```

- Windows 下 spawn/退出的技术风险实施期验证；失败时返回明确错误并提示人工重启。

## ② 配置语义类

### GET /api/v1/config/models

模型路由表（**单线路**：只返回当前生效用途，qwen 三用途；备选线路启用时恢复路由）：
`default`/`ocr`/`embedding` 为**解析后生效档**（按 `QED_API_PROVIDER` 路由）。子项目不感知密钥。

```json
{
  "default":   {"model": "qwen-plus",    "provider": "qwen",     "configured": true},
  "ocr":       {"model": "qwen-vl-plus", "provider": "qwen",     "configured": true},
  "embedding": {"model": "text-embedding-v4", "provider": "qwen", "configured": true}
}
```

- `provider`：当前 `QED_API_PROVIDER`（qwen / deepseek / glm）。
- `configured`：`API_KEY` 是否已配置（空值视为未配置），子项目据此决定降级策略。
- `default`/`ocr` 模型为**解析后生效值**：显式配置（`QED_MODEL`/`QED_OCR_MODEL`）优先，否则按厂商
  默认（`backend/qed_engine/services/llm/clients.py` `PROVIDERS` 注册表）；`embedding` 保持配置值
  （本轮推荐值 `text-embedding-v4`）。
- 厂商无视觉时（deepseek）：`ocr` 的 `model` 显示 `（无视觉）` 约定。
- 模型名配置来源见 [configuration-and-secrets.md](../design/configuration-and-secrets.md) 变量表。
- 备选线路（GLM 对话/专用文档 OCR、deepseek 对话）变量未恢复，启用时恢复本接口对应路由；
  glm-ocr 文档解析专用接口（布局+文本提取，支持图片/PDF）的接入适配在 Axiom-Flow 对接轮完成
  （REQ-008，备选线路启用时恢复）。

### GET /api/v1/config/keys

供应商配置状态（CLI/内部降级判断用）：单 key + 当前厂商选择 + 运行模式，只返回布尔与枚举，
**永不返回密钥值**。

```json
{"provider": "qwen", "configured": true, "mode": "api"}
```

- `provider`：当前 `QED_API_PROVIDER`（qwen / deepseek / glm）。
- `configured`：`API_KEY` 是否已配置。该布尔仅表示「key 是否已配置」，**不代表服务可达**。
  供应商可达性由 8900 **启动自检**负责（见下节），前端横幅不再展示。
- `mode`：当前 `QED_API_SELECT`（api / local，2026-08-24 契约扩展）。前端控制台依赖卡
  模式感知用——api 模式文字/图像模型为云端厂商（不探测 LM Studio/MinerU），local 模式
  探测本地服务。

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
- 变量来源与别名映射见[configuration-and-secrets.md](../design/configuration-and-secrets.md) 统一数据库小节。
- 字段变化（如新增库名列表）需同步更新本契约与 `backend/qed_engine/api/schemas.py`。

### LLM 供应商启动自检（ARCH-014：/config/llm-status 端点已删除）

2026-08-16 用户裁决：供应商 LLM 可达性**不再提供按需探测端点**（原 `GET /config/llm-status`
已删除，返回 404）；8900 **启动时对 `QED_API_PROVIDER` 对应厂商探测一次**（models 列表接口，
免费、无 token 消耗，5s 超时），结果写启动日志（`启动自检：qwen LLM 可达=True（…）`）。
未配置 key 不探测。**强制规则**：密钥只出现在探测请求头，绝不进入日志/异常信息。

## ③ 数据透传·QED-Tracker（8901 适配）

前端（8903）只连 8900：目录/资源/任务契约归 8900 所有（数据域），内部经
`clients/tracker_client.py`（8901 客户端）适配 8901；8901 契约正文以
[service-contracts.md](../design/service-contracts.md) 为事实源，路径与 8901 一致（透传）。

### 端点表

| 端点 | 语义 | 内部适配 |
| --- | --- | --- |
| `GET /catalogs/{course_id}` | 课程目录（知识点树主数据源） | TrackerClient.get_catalog（8901 GET /catalogs/{course_id}） |
| `GET /tasks` / `GET /tasks/{id}` | 任务列表与轮询 | TrackerClient.list_tasks / get_task |
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

**五层语义说明（QED-031，2026-08-17 落地）**：知识行（qt_knowledge）draft→confirmed→completed；
书行（qt_books）candidate→decided→downloading→downloaded→verified；渠道（qt_sources）一次尝试
一条，ok 表达成败。`GET /books` 被数据域·Axiom 预留路由占用（axiom.py，仅 GET，与 tracker 的
POST /books 不冲突），五层 GET 端点无此路径冲突。

### 探索与领域课程体系端点（REQ-054/055/056/059，2026-08-24）

契约事实源：exploration-api 计划 §0~8（冻结 + REQ-059 增补，均已落地；该计划已按 Delete
判定移除，Git 锚点 0517e5d，本节为其承接事实源）。8901 未实现的手工维护端点按上游 404 结构化透传，前端降级提示。

| 端点 | 语义 | 内部适配 |
| --- | --- | --- |
| `GET /courses` | 领域课程体系 `DomainSystem[]`（领域含嵌套课程，服务端按 sort_order 有序；下载管理左树 v2 数据源，QED-033） | TrackerClient.list_courses_system |
| `GET /domains` | 领域列表（只读；REQ-059 R1，8901 承接中） | TrackerClient.list_domains |
| `PATCH /domains/{id}` `{"description","stages"}` | 修改领域描述/阶段（name 锁死不入请求体；REQ-059 R2） | TrackerClient.update_domain |
| `DELETE /domains/{id}` | 删除领域（有课程 409 保护） | TrackerClient.delete_domain |
| `POST /domains` `{"name","description","stages"}` | 手工新建领域（§8；domain_id 服务端生成为请求口径） | TrackerClient.create_domain |
| `POST /domains/{id}/courses` `{"name","stage","sort_order","note"}` | 手工新增课程（§8） | TrackerClient.create_course_for_domain |
| `PATCH /courses/{id}` `{"stage","sort_order","note"}` | 修改课程阶段/排序/备注（name 锁死） | TrackerClient.update_course |
| `DELETE /courses/{id}` | 删除课程（有知识行 409 保护） | TrackerClient.delete_course |
| `POST /courses/{id}/explore` | 发起课程层探索（202 Accepted；幂等 deduplicated） | TrackerClient.start_course_explore |
| `GET /explore-runs/{id}` | 课程探索运行轮询 | TrackerClient.get_explore_run |
| `POST /explore-runs/{id}/adopt` `{"selected"}` | 采纳所选推荐 → draft 知识行 | TrackerClient.adopt_explore_run |
| `POST /explore-runs/{id}/discard` | 放弃本次（幂等） | TrackerClient.discard_explore_run |
| `GET /courses/{id}/explore-runs?limit=&offset=` | 课程探索历史分页 | TrackerClient.list_explore_runs |
| `POST /curriculum-explore` | 发起领域课程体系探索（202；重探=目标领域已存在，apply 时 create_domain 跳过标记） | TrackerClient.start_curriculum_explore |
| `GET /curriculum-runs/{id}` | 领域探索运行详情（changes/conflicts） | TrackerClient.get_curriculum_run |
| `POST /curriculum-runs/{id}/apply` `{"selected"}` | 应用所选变更 → qed_domain/qed_course（applied/partially_applied） | TrackerClient.apply_curriculum_run |

成功态规整说明：上游 201/204 一律以 200 返回（透传层不做状态码直通）；发起类端点显式 202。
409 携带上游结构化 `detail: {code, message}` 原样透传（如 CAPACITY_REACHED/RUN_STATE_CONFLICT）。

> 历史：旧 `/resources` 清单/详情/预览/状态机端点与 `/tasks/catalog/evaluate`、
> `/tasks/books/download` 已随 QED-030（qt_resources 退役）移除；三表语义 API 已随 QED-031
> 知识层次重构退役，8900 不再暴露，历史契约见
> [downloads-three-table-model.md](../design/downloads-three-table-model.md)（Superseded）。

### 错误映射

8901 返回 4xx（如 409 状态机冲突）→ 8900 同码透传上游 detail（前端既有 409 处理生效）；
8901 连接失败/5xx → 503 + `QED-Tracker 服务不可达：…`（前端据此降级显示，独立性铁律）。
reject/supersede 缺 reason 与 create/register/complete 缺必填字段由 8900 校验直接 422，
不请求 8901。结构化错误统一 `{detail: {code, message}}`，`message` 即前端展示文案
（api 客户端解包 detail.message；§8 手工维护端点未上线时归一码为 `UPSTREAM_NOT_IMPLEMENTED`，
REQ-059）。

## ④ 数据透传·Axiom-Flow（8902 适配）

前端（8903）只连 8900：Axiom-Flow 解析进度与原始文档对照数据归 8900 所有（数据域），
内部经 `clients/axiom_client.py`（8902 客户端）适配 8902。8902 契约草案事实源：
Axiom-Flow `docs/design/8902-integration-contract.md`（V2-007 冻结后按回执微调）；
af_* 书目同步与块判定契约草案：Axiom-Flow `docs/design/af-books-sync.md`（REQ-042，
V2-013 承接）。

### 端点表

| 端点 | 语义 | 内部适配 |
| --- | --- | --- |
| `GET /books` | 书目列表（af_books：课程归属 domain_id/course_id/course_name + 解析进度 pages_done/parse_status；契约冻结前空表回退文件系统） | AxiomClient.list_books |
| `POST /books/sync` | **同步已验证书目（REQ-042，2026-08-18）**：8900 聚合 8901 `/knowledge`（books status=verified，经 get_catalog 映射课程名）→ 8902 upsert af_books（幂等，book_id 同源 qt_books）；8901 不可达 → 503 `QED-Tracker 服务不可达：…`；8902 不可达 → 503 | AxiomClient.sync_books |
| `GET /books/{id}/pages/{no}` | 单页完整数据（原页图 URL + markdown + blocks，对照主数据源） | AxiomClient.get_book_page |
| `GET /books/{id}/pages/{no}/image` | 原页图代理（8902 image_url 为相对路径，浏览器只连 8900） | 透传流 |
| `GET /books/{id}/manifest` | 产物清单（文件路径/大小/哈希；契约冻结前前端据此推导页进度） | AxiomClient.get_book_manifest |
| `PUT /books/{id}/pages/{no}/blocks/{index}/review` `{"verdict","note"}` | **块判定写入（REQ-042）**：verdict 枚举 ok/bad（422 校验）；落库 af_block_reviews；8902 不可达 → 503 | AxiomClient.review_block |
| `GET /books/{id}/pages/{no}/blocks/{index}/review` | 块判定回显（无判定 → 404 透传） | AxiomClient.get_block_review |
| `POST /parse-jobs` `{"book_id","pages","strategy"}` | 提交解析任务（202；strategy 默认 hybrid）；完成后回写 af_books.pages_done/parse_status | AxiomClient.create_parse_job |
| `GET /parse-jobs/{id}` | 任务状态与进度（queued/running/completed/failed） | AxiomClient.get_parse_job |

### 错误映射

8902 返回 4xx（400 参数非法 / 404 book/page 不存在）→ 8900 同码透传上游 detail；
8902 连接失败/5xx → 503 + `Axiom-Flow 服务不可达：…`；8901 连接失败/5xx →
503 + `QED-Tracker 服务不可达：…`（前端据此降级显示，独立性铁律：8901/8902 离线不影响
其他界面）。

## ⑤ 监控诊断与 LLM 网关

支撑前端控制台的组件监控（GPU / LM Studio / mineru / 日志 / 8900 自身重启）与 LLM 网关。
实现于 `services/log_viewer.py`、`services/monitor.py` 与 `services/llm/`（网关/客户端/
模型管理器/调用记录），路由挂 `api/control.py`。

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

GPU 状态（nvidia-smi 解析 + 系统内存）：型号、显存总量/已用、利用率、占用进程列表
（含 kind 分类）、系统内存使用。

```json
{"available": true, "name": "NVIDIA GeForce RTX 4080", "memory_total_mb": 16376,
 "memory_used_mb": 4096, "utilization_percent": 65,
 "processes": [{"pid": 1234, "name": "LM Studio", "memory_mb": 4096, "kind": "model"}]}
```

- `available=false` 附 `reason`（nvidia-smi 不存在/无 GPU/解析失败）。
- **利用率读数说明（2026-08-23 用户裁决）**：Windows WDDM 模式下 `utilization.gpu` 存在
  固有失真（低值与顶格 100% 间二值化跳变），仅作参考展示；**95% 超显存警告以显存使用率
  （`memory.used` / `memory.total`）为准**——该读数经实测准确。
- `processes[].kind`（REQ-038，2026-08-21）：模型进程名关键词白名单
  （lmstudio/lm studio/llama/qwen/mineru/python/vmmem/ollama，大小写不敏感包含匹配）
  命中 → `"model"`，其余（浏览器/图形程序/陌生计算任务）→ `"other"`；前端饼图据此
  高亮「非模型任务占用」。
- Windows WDDM 模式下每进程显存为 `[N/A]`/`[Insufficient Permissions]` → 该行保留，
  `memory_mb=null`（清单供非模型任务识别，不参与 MB 聚合）；compute-apps 不含部分图形
  进程，前端以「总量 − Σ进程」呈现「系统·图形占用」片；全部无 MB 时饼图退化已用/空闲。
- 该数据用于控制台 GPU 总览条与显存构成饼图（≥95% 警告、60s 自动刷新）。

### GET /api/v1/monitor/lmstudio

本地 LLM（LM Studio，OpenAI 兼容）探测：服务可达性 + 已加载模型。

```json
{"reachable": true, "base_url": "http://127.0.0.1:5001/v1", "models": ["qwen3-8b"],
 "reason": ""}
```

- 探测目标与超时沿 `/config/llm-status` 模式（未配置不探测）；默认
  `http://127.0.0.1:5001/v1`（`QED_LMSTUDIO_URL` 可覆盖，变量表见
  [configuration-and-secrets.md](../design/configuration-and-secrets.md)）。

### GET /api/v1/monitor/mineru

mineru 解析服务（8002，WSL 容器）健康探测。

```json
{"reachable": true, "port": 8002, "reason": ""}
```

- 容器未启动/WSL 不可达 → `reachable=false` + 中文原因（提示运行容器编排脚本），
  不泄漏堆栈。

### LLM 网关（ARCH-016：/llm/* 端点族）

按 `QED_API_SELECT`（api/local）路由：api 按 `QED_API_PROVIDER` 选厂商（当前 qwen），
local 走本地模型（文字 LM Studio / 图像 MinerU，经 `QED_RESOURCE_GUARD` 互斥）。
密钥只在请求头，绝不下发、不入响应体；成功/失败均落 `qed_llm_calls` 记录表
（单表三项目可写）。详情契约事实源：[llm-gateway-and-model-management.md](../design/llm-gateway-and-model-management.md)。

| 端点 | 语义 |
| --- | --- |
| `POST /llm/text` | 文字模型调用：`{prompt, system?, prompt_template?, max_tokens?}` → 路由 api/local → `{reply, call_id}` |
| `POST /llm/vision` | 图像模型调用：`{image_url 或 base64, prompt?, prompt_template?}` → 路由 api/local（deepseek 无视觉）→ `{reply, call_id}` |
| `POST /llm/test/text` | 文字模型测试（控制台测试按钮）：小 prompt 真实调用，成功/失败 + 原因 |
| `POST /llm/test/vision` | 图像模型测试：健康探测 + 最小识别调用，成功/失败 + 原因 |
| `GET /llm/calls` | 调用记录检索：`service / mode / model / status / start / end / task / step / prompt_template / review_status / page / size`，分页返回（REQ-060 新增后 4 过滤） |
| `PATCH /llm/calls/{id}/review` | 审核标注（REQ-060）：`{review_status, review_note?}` → `{ok, call_id}`；不存在 404 |
| `POST /database/test` | MySQL 即时连接探测（控制台测试按钮，替代启动快照只读） |

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
- LLM 网关 api/local 模式真实冒烟（`/llm/test/text` ok=true、`qed_llm_calls` 落库）。
- 供应商 key 真实可用性以各服务实际调用为准（`scripts/check_api_keys.py` 已于 2026-08-17
  随 scripts/ 整理退役；glm 曾返 429 余额不足以智谱账户状态为准，不影响中心降级运行）。
