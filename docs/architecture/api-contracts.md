# 8900 API 接口文档

设计状态：Accepted
实现状态：Implemented
最后更新：2026-09-24
确认状态：已确认
关联代码：`backend/qed_engine/api/main.py`、`backend/qed_engine/api/schemas.py`、`backend/qed_engine/api/control.py`、`backend/qed_engine/api/tracker.py`、`backend/qed_engine/api/axiom.py`、`backend/qed_engine/clients/axiom_client.py`、`backend/qed_engine/services/log_viewer.py`、`backend/qed_engine/services/monitor.py`（探索会话与 LLM 网关模块的契约事实源见设计文档，归属见 [code-map.md](code-map.md)）
关联测试：`tests/test_api.py`、`tests/test_tracker_client.py`、`tests/test_web.py`、`tests/test_log_viewer.py`、`tests/test_monitor.py`、`tests/test_self_restart.py`、`tests/test_explore_sessions.py`、`tests/test_llm_gateway.py`、`tests/test_llm_endpoints.py`、`tests/contract/test_api_endpoint_inventory.py`
关联 ADR：`../history/adr/v0.1/0002-frontend-and-port-centralization.md`、`../history/adr/v0.1/0007-qed-engine-backend-gateway.md`、`../history/adr/v0.1/0008-frontend-react-refactor.md`、`../history/adr/v0.1/0010-documentation-versioning.md`、`../adr/0014-parsing-ownership-and-model-boundary.md`

> 本文件是 **QED-Engine 的固定 API 接口文档**（ADR 0010），按**接口类型**组织（REQ-046），
> 只描述**当前契约**：演进与退役规则见 [cross-project-contracts §10](../design/cross-project-contracts.md)，
> 历史过程叙事见 `docs/history/` 各计划壳与 Git 历史。
> **QED-Engine 前端无 API 接口**（静态页面 + 只连 8900，见 [frontend-architecture.md](frontend-architecture.md)），
> 本文件为 8900 全部对外端点的契约总表；8901 / 8902 的 API 文档以各自仓库
> `docs/architecture/` 为准（8900 只做透传适配）。版本末期确认更新后，前版本契约进 `history/`。

## 目的与边界

8900 是 QED-Engine 后端（三域组织见 [backend-architecture.md](backend-architecture.md)）的
**对外 API 契约总表**：读取根 `.env`，向 QED-Engine 前端与子项目提供健康检查、模型路由、
数据域语义 API、服务托管与监控诊断。**密钥绝不下发**——子项目不经过中心获取 key，而是直读
根 `.env`，中心只回答"用哪个模型、是否已配置"。

8900 是 `.env` 的唯一只读语义代理。接口按类型分为**五类**（共 85 端点，清单与状态见
「端点总表」，逐端点语义见对应分节）：

| 类型 | 范围 | 端点数 |
| --- | --- | --- |
| ① 服务管理类 | 健康检查、服务注册表、启停托管、8900 自身重启 | 6 |
| ② 配置语义类 | 模型路由表、供应商配置状态、统一数据库快照 | 3 |
| ③ 数据透传·QED-Tracker | 目录/任务/教程/书籍/领域课程 + 探索会话与领域探索门面（8900 自有） | 41 |
| ④ 数据透传·Axiom-Flow | 书目/单本详情/PDF 流/页/manifest/块编辑与判定/ingest/parse-jobs/parsing-tree | 16 |
| ⑤ 监控诊断与 LLM 网关 | 日志/GPU/槽位探针与启停/选择 + LLM 调用族 + MySQL 即时探测 | 19 |

**启动自检**：LLM 供应商可达性与 MySQL 连接在 8900 启动时各探测一次——LLM
结果写日志，MySQL 结果为 `/config/database` 启动快照；不提供按需探测端点（MySQL 的
控制台即时探测走 `POST /database/test`）。

## 服务信息

- 服务名：`qed-engine-config`（兼容名；FastAPI 标题 QED-Engine Backend）
- 端口：`8900`
- 前缀：`/api/v1`
- 启动（根仓库目录）：`python -m uvicorn qed_engine.api.main:app --host 127.0.0.1 --port 8900`

## 通用约定

- **版本与前缀**：`/api/v1` 为唯一版本前缀；契约的兼容/破坏分级与发布流程见
  [cross-project-contracts §10](../design/cross-project-contracts.md)。
- **无认证**：仅 localhost 回环访问、服务间无认证（部署与安全假设见
  [cross-project-contracts §12](../design/cross-project-contracts.md)），不得暴露公网。
- **成功响应**：资源 JSON 原样返回；透传层把上游 201/204 一律规整为 200，
  除非端点显式声明创建语义（201，如 `POST /books`）或发起语义（202）。
- **发起语义（202 + 轮询）**：一切长操作（下载 fetch、领域探索任务、探索会话、解析任务、
  模型启停）受理后立即 202 + 句柄（`task_id` / `session_id` / `job_id` / 槽位状态），
  状态收敛由前端轮询对应资源端点；唯一分钟级同步例外是 `POST /books/{book_id}/ingest`
  （范式统一声明与超时预算见 [cross-project-contracts §11](../design/cross-project-contracts.md)）。
- **错误包络**：业务透传错误为 `{"detail": {"code": "<UPPER_SNAKE>", "message": "<展示文案>"}}`，
  `code` 由 8901/8902 产生、8900 同码透出（message 即前端展示文案）；8900 自有校验与
  门面错误 `detail` 为中文纯文本；子服务不可达为 503 + `"<服务名> 服务不可达：…"` 纯文本。
  状态码语义见「状态码」表，透传码字典见「业务错误码字典」。
- **路径参数命名**：本文档路径参数名与 FastAPI 路由一致（`{book_id}` `{page_no}`
  `{block_index}` `{job_id}` `{session_id}` `{task_id}` `{course_id}` `{domain_id}`
  `{knowledge_id}` `{name}` `{slot}` `{service}` `{call_id}`）。
- **相对地址重写**：8902 产物中的相对资源 URL（原页图）由 8900 重写为 8900 代理绝对地址
  后返回（浏览器只连 8900，ADR 0007）。
- **密钥**：任何响应体、日志与异常信息不含密钥值（见「强制规则」）。

## 端点总表

本表与 FastAPI 实际路由由契约测试双向比对守护（`tests/contract/test_api_endpoint_inventory.py`，
增删端点必须同步本表）。状态：`在用`＝当前契约；`过渡`＝deprecated 兼容面，替代与处置见
「退役与过渡」。未实现的规划端点不入本表，见 §③/§④「规划契约」。

<!-- endpoint-registry:start -->

| Method | Path | 域 | 状态 |
| --- | --- | --- | --- |
| GET | /api/v1/health | ① | 在用 |
| GET | /api/v1/services | ① | 在用 |
| POST | /api/v1/services/{name}/start | ① | 在用 |
| POST | /api/v1/services/{name}/stop | ① | 在用 |
| POST | /api/v1/services/{name}/restart | ① | 在用 |
| POST | /api/v1/self-restart | ① | 在用 |
| GET | /api/v1/config/models | ② | 在用 |
| GET | /api/v1/config/keys | ② | 在用 |
| GET | /api/v1/config/database | ② | 在用 |
| GET | /api/v1/catalogs/{course_id} | ③ | 在用 |
| GET | /api/v1/tasks | ③ | 在用 |
| GET | /api/v1/tasks/{task_id} | ③ | 在用 |
| GET | /api/v1/knowledge | ③ | 在用 |
| GET | /api/v1/knowledge/{knowledge_id} | ③ | 在用 |
| POST | /api/v1/knowledge/{knowledge_id}/confirm | ③ | 在用 |
| PATCH | /api/v1/knowledge/{knowledge_id} | ③ | 在用 |
| DELETE | /api/v1/knowledge/{knowledge_id} | ③ | 在用 |
| POST | /api/v1/books | ③ | 在用 |
| GET | /api/v1/books/{book_id}/sources | ③ | 在用 |
| POST | /api/v1/books/{book_id}/sources | ③ | 在用 |
| POST | /api/v1/books/{book_id}/register | ③ | 在用 |
| POST | /api/v1/books/{book_id}/fetch | ③ | 在用 |
| POST | /api/v1/books/{book_id}/import | ③ | 在用 |
| POST | /api/v1/books/{book_id}/start | ③ | 在用 |
| POST | /api/v1/books/{book_id}/fail | ③ | 在用 |
| POST | /api/v1/books/{book_id}/verify | ③ | 在用 |
| POST | /api/v1/books/{book_id}/cancel | ③ | 在用 |
| POST | /api/v1/knowledge/{knowledge_id}/fetch | ③ | 在用 |
| GET | /api/v1/courses | ③ | 在用 |
| GET | /api/v1/domains | ③ | 在用 |
| POST | /api/v1/domains | ③ | 在用 |
| POST | /api/v1/domains/import | ③ | 在用 |
| DELETE | /api/v1/domains/{domain_id} | ③ | 在用 |
| PATCH | /api/v1/domains/{domain_id} | ③ | 在用 |
| POST | /api/v1/domains/{domain_id}/courses | ③ | 在用 |
| POST | /api/v1/domains/{domain_id}/commit-import | ③ | 在用 |
| PATCH | /api/v1/courses/{course_id} | ③ | 在用 |
| DELETE | /api/v1/courses/{course_id} | ③ | 在用 |
| POST | /api/v1/courses/{course_id}/knowledge | ③ | 在用 |
| POST | /api/v1/explore-sessions | ③ | 在用 |
| GET | /api/v1/explore-sessions/{session_id} | ③ | 在用 |
| POST | /api/v1/explore-sessions/{session_id}/confirm-name | ③ | 在用 |
| POST | /api/v1/explore-sessions/{session_id}/apply | ③ | 在用 |
| DELETE | /api/v1/explore-sessions/{session_id} | ③ | 在用 |
| POST | /api/v1/domains/{domain_id}/explore-knowledge | ③ | 在用 |
| POST | /api/v1/domains/{domain_id}/confirm-domain | ③ | 在用 |
| POST | /api/v1/domains/{domain_id}/confirm-knowledge | ③ | 在用 |
| GET | /api/v1/domains/{domain_id}/explore-status | ③ | 在用 |
| POST | /api/v1/courses/{course_id}/explore-knowledge | ③ | 在用 |
| POST | /api/v1/courses/{course_id}/confirm | ③ | 在用 |
| GET | /api/v1/books | ④ | 在用 |
| GET | /api/v1/books/{book_id} | ④ | 在用 |
| POST | /api/v1/books/sync | ④ | 在用 |
| GET | /api/v1/books/{book_id}/pages/{page_no} | ④ | 在用 |
| GET | /api/v1/books/{book_id}/pages/{page_no}/image | ④ | 在用 |
| GET | /api/v1/books/{book_id}/file | ④ | 在用 |
| GET | /api/v1/books/{book_id}/manifest | ④ | 在用 |
| POST | /api/v1/books/{book_id}/ingest | ④ | 在用 |
| PUT | /api/v1/books/{book_id}/pages/{page_no}/blocks/{block_index}/edit | ④ | 在用 |
| GET | /api/v1/books/{book_id}/pages/{page_no}/edits | ④ | 在用 |
| PUT | /api/v1/books/{book_id}/pages/{page_no}/blocks/{block_index}/review | ④ | 过渡 |
| GET | /api/v1/books/{book_id}/pages/{page_no}/blocks/{block_index}/review | ④ | 过渡 |
| POST | /api/v1/parse-jobs | ④ | 在用 |
| GET | /api/v1/parse-jobs | ④ | 在用 |
| GET | /api/v1/parse-jobs/{job_id} | ④ | 在用 |
| GET | /api/v1/parsing/tree | ④ | 在用 |
| GET | /api/v1/logs/{service} | ⑤ | 在用 |
| GET | /api/v1/monitor/gpu | ⑤ | 在用 |
| GET | /api/v1/monitor/{slot} | ⑤ | 在用 |
| GET | /api/v1/monitor/qwen | ⑤ | 过渡 |
| GET | /api/v1/monitor/mineru | ⑤ | 过渡 |
| GET | /api/v1/models/{name} | ⑤ | 在用 |
| POST | /api/v1/models/{name}/start | ⑤ | 在用 |
| POST | /api/v1/models/{name}/stop | ⑤ | 在用 |
| POST | /api/v1/models/{name}/restart | ⑤ | 在用 |
| POST | /api/v1/models/{name}/select | ⑤ | 在用 |
| POST | /api/v1/llm/text | ⑤ | 在用 |
| POST | /api/v1/llm/vision | ⑤ | 在用 |
| POST | /api/v1/llm/embedding | ⑤ | 在用 |
| POST | /api/v1/llm/test/text | ⑤ | 在用 |
| POST | /api/v1/llm/test/vision | ⑤ | 在用 |
| POST | /api/v1/llm/test/embedding | ⑤ | 在用 |
| GET | /api/v1/llm/calls | ⑤ | 在用 |
| PATCH | /api/v1/llm/calls/{call_id}/review | ⑤ | 在用 |
| POST | /api/v1/database/test | ⑤ | 在用 |

<!-- endpoint-registry:end -->

## ① 服务管理类

### GET /api/v1/health

存活检查，返回服务状态与版本。

```json
{"status": "ok", "service": "qed-engine-config", "version": "0.1.0"}
```

### GET /api/v1/services

服务注册表状态快照（config/tracker/axiom/web 四单元），含每单元运行态与离线原因。
契约事实源：[服务控制设计](../design/service-hosting.md)（服务注册表/过渡窗口/错误语义），
实现于 `services/service_manager.py`（能力层）与 `api/control.py`（路由层）。

### POST /api/v1/services/{name}/start|stop|restart

服务启停托管（8901/8902/8903；`config` 单元不可经此启停）。15s 过渡窗口、409 冲突语义、
脚本黑盒管理见[服务控制设计](../design/service-hosting.md)。

### POST /api/v1/self-restart

8900 自身重启（控制台「重启」按钮）：spawn 新进程（同启动命令+端口）→ 新进程健康
探测通过 → 旧进程退出。`config` 单元不可经 /services 启停的既有限制保持（本端点只
用于 8900 自身重启，不开放启停）。

```json
{"status": "restarting"}
```

- Windows 下 spawn 失败时返回明确错误并提示人工重启。

## ② 配置语义类

### GET /api/v1/config/models

模型路由表（**单线路**：只返回当前生效用途，qwen 三用途）：
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
  （推荐值 `text-embedding-v4`）。
- 厂商无视觉时（deepseek）：`ocr` 的 `model` 显示 `（无视觉）` 约定。
- 模型名配置来源见 [project-configuration.md](../design/project-configuration.md) 变量表。
- 备选线路（GLM 对话/专用文档 OCR、deepseek 对话）变量启用时恢复本接口对应路由；
  glm-ocr 文档解析专用接口的接入适配在 Axiom-Flow 对接轮完成（REQ-008）。

### GET /api/v1/config/keys

供应商配置状态（CLI/内部降级判断用）：单 key + 当前厂商选择 + 运行模式，只返回布尔与枚举，
**永不返回密钥值**。

```json
{"provider": "qwen", "configured": true, "mode": "api"}
```

- `provider`：当前 `QED_API_PROVIDER`（qwen / deepseek / glm）。
- `configured`：`API_KEY` 是否已配置。该布尔仅表示「key 是否已配置」，**不代表服务可达**。
  供应商可达性由 8900 **启动自检**负责（见下节）。
- `mode`：当前 `QED_API_SELECT`（api / local）。前端控制台依赖卡模式感知用——api 模式
  文字/图像模型为云端厂商（不探测 Qwen/MinerU），local 模式探测本地服务。

### GET /api/v1/config/database

统一数据库配置与**连接状态**（MySQL 8 共享 `qed` 库，见
[database-design.md](database-design.md)）。语义为**启动快照**——8900 启动时真实连接探测
一次，本端点只读快照，不按需探测。只返回主机/库名等非敏感信息与布尔配置状态，
**密码值绝不下发**。

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
- 变量来源与别名映射见[project-configuration.md](../design/project-configuration.md) 统一数据库小节。
- 字段变化（如新增库名列表）需同步更新本契约与 `backend/qed_engine/api/schemas.py`。
- 控制台**即时**连接探测走 `POST /database/test`（⑤），本端点始终保持启动快照语义。

### LLM 供应商启动自检

8900 **启动时对 `QED_API_PROVIDER` 对应厂商探测一次**（models 列表接口，免费、无 token
消耗，5s 超时），结果写启动日志（`启动自检：qwen LLM 可达=True（…）`）。未配置 key 不探测。
**强制规则**：密钥只出现在探测请求头，绝不进入日志/异常信息。

## ③ 数据透传·QED-Tracker（8901 适配）

前端（8903）只连 8900：目录/任务/教程/书籍契约归 8900 所有（数据域），内部经
`clients/tracker_client.py`（8901 客户端）适配 8901；8901 契约正文以 QED-Tracker
`docs/architecture/api.md` 为事实源，路径与 8901 一致（透传）。
8900 侧能力面分组语义（不构成端点契约）见
[cross-project-contracts §5](../design/cross-project-contracts.md)。

**五层语义（QED-031 两态 + QED-050/060 书库化）**：教程（qt_knowledge）draft→confirmed
（两态终态）；书籍（qt_books）为域级书库——选用态 `candidate/decided/parallel/retired` +
持有态 `owned/missing` + 下载生命周期 `downloading/downloaded/verified/failed`（QED-060），
归属由教程 refs 承载；渠道（qt_sources）一次尝试一条，`ok` 表达成败。
`GET /books` 被数据域·Axiom 预留路由占用（axiom.py，仅 GET，与 tracker 的 POST /books 不冲突）。

### 目录与任务

#### `GET /api/v1/catalogs/{course_id}`

课程目录（知识点树，下载管理主数据源）。

**路径参数：** `course_id` — 课程目录标识。

**错误：** 404 未知目录、503 8901 不可达。

#### `GET /api/v1/tasks`

任务列表（前端任务面板轮询）。**返回：** `TaskRecord[]`。

#### `GET /api/v1/tasks/{task_id}`

任务详情（前端轮询单任务状态）。**路径参数：** `task_id`。**错误：** 404 任务不存在。

### 教程

#### `GET /api/v1/knowledge`

教程列表。默认过滤 rejected/superseded/failed（上游数据层保证）。

**查询参数：** `course_id`（可选）、`status`（可选）。

#### `GET /api/v1/knowledge/{knowledge_id}`

教程详情（含 `books[]` 所辖书籍列表）。**路径参数：** `knowledge_id`。
**错误：** 404 不存在。

#### `POST /api/v1/knowledge/{knowledge_id}/confirm`

教程 draft→confirmed（定稿，无 body，回填 `confirmed_at`）。
**错误：** 404 不存在、409 非法状态迁移。

#### `PATCH /api/v1/knowledge/{knowledge_id}`

更新教程信息。**路径参数：** `knowledge_id`。
**请求体（字段均可选，仅传非空项）：** `name`、`position`、`intro`、`set_no`、`kind`、`notes`。
**返回：** 200 更新后的教程详情（含 `books[]`）。**错误：** 404 不存在。

#### `DELETE /api/v1/knowledge/{knowledge_id}`

物理删除教程及其孤立书籍数据（仍被其他教程引用的书保留）。**路径参数：** `knowledge_id`。
**返回：** 200 `{"ok": "true"}`。**错误：** 404 不存在。

### 书籍（QED-060 书库化）

#### `POST /api/v1/books`

书库化创建（201）：域级书库登记一本书（**无 `knowledge_id`**，归属由教程 refs 承载）。
必填 `book_id` + `title`；其余字段可选，8900 仅转发非空项。

**请求体：**
```json
{
  "book_id": "mathanalysis-b01",
  "title": "数学分析",
  "original_title": "Principles of Mathematical Analysis",
  "part": "",
  "authors": [{"name": "Rudin", "role": "author"}],
  "publisher": "高等教育出版社",
  "edition": "第3版",
  "year": 2006,
  "language": "zh",
  "roles": ["textbook"],
  "status": "candidate",
  "domain_id": "math",
  "notes": ""
}
```

**错误：** 409 `BOOK_ALREADY_EXISTS`；422 `INVALID_PARAMS`（book_id 格式错误/缺 title/值域错误）。

#### `GET /api/v1/books/{book_id}/sources`

书籍渠道尝试列表（详情弹窗，含失败留痕 `ok=0`，消费方自行过滤）。
**路径参数：** `book_id`。**错误：** 404 书籍不存在。

#### `POST /api/v1/books/{book_id}/sources`

登记一次渠道尝试（`ok` 表达成败；`channel` 默认 `manual`）。

**请求体：**
```json
{
  "channel": "internet_archive",
  "provider_id": "ia-12345",
  "page_url": "https://...",
  "download_url": "https://...",
  "file_keywords": "filename.pdf",
  "ok": true,
  "note": "可用"
}
```

#### `POST /api/v1/books/{book_id}/register`

原地登记（数据根内已有文件）：经 `mark_owned` 落 `holding=owned + file_path + status=downloaded`
（跳过初筛门槛，保留完整性校验）。**请求体：** `{"relative_path"}`。

**错误：** 400 路径不在数据根内/PDF 校验失败、404 文件/书籍不存在、422 缺路径。

#### `POST /api/v1/books/{book_id}/fetch`

书级自动取书（完整五阶段：检索→确认→下载→staging 机器验收→`mark_owned` 登记）。
**返回：** 202 `{"task_id": "...", "book_id": "..."}`。

#### `POST /api/v1/knowledge/{knowledge_id}/fetch`

教程级批量取书（refs 聚合去重 → 排除已 owned → 默认仅 decided；顺序逐书，部分失败不中断）。
**返回：** 202 `{"task_id": "...", "knowledge_id": "..."}`。

#### `POST /api/v1/books/{book_id}/import`

人工导入书籍 PDF（**multipart/form-data**）：8900 将上传字节落系统临时文件 →
调 8901 import（完整性校验 / sha256 去重 / 原子落盘 → `raw/<domain>/<course>/<slug>_<sha8>.pdf`
+ `mark_owned`）→ 清理临时文件。**浏览器文件选择器上传，用户无需提供服务器路径。**

**请求体（multipart）：** `file`（必填，`.pdf`）+ `target_path`（可选，数据根相对路径；
缺省经 refs 反查课程目录，反查不到 422）。

**返回：** 200 登记结果（`{book_id, holding, file_path}`）。
**错误：** 400（非 PDF/空文件）、404 `BOOK_NOT_FOUND`、422、503。

#### `POST /api/v1/books/{book_id}/start`

开始下载（`decided → downloading`，QED-060）。**错误：** 404、409 `INVALID_TRANSITION`。

#### `POST /api/v1/books/{book_id}/fail`

标记下载失败（`downloading → failed`，holding 仍 missing）。失败后可再次 `fetch` 重试。

#### `POST /api/v1/books/{book_id}/verify`

验收通过（`downloaded → verified` 下载终态）。

#### `POST /api/v1/books/{book_id}/cancel`

取消下载（`downloading → decided` 复位，不删除已落盘文件）；用于解除卡死的 `downloading`。
**错误：** 404、409（仅 `downloading` 可 cancel）。

### 领域与课程体系（REQ-059，8901 承接）

领域/课程管理端点透传 8901。

#### `GET /api/v1/courses`

领域课程体系 `DomainSystem[]`（领域含嵌套课程，服务端按 sort_order 有序；下载管理左树 v2
数据源，QED-033；领域/课程行含 exploration_stage 探索状态）。

#### `GET /api/v1/domains`

领域列表（含 exploration_stage/level/classic_tracks/path_results）。

#### `POST /api/v1/domains`

手工新建领域。**请求体：**
`{"name","description?","stages?","level?","scope?","classic_tracks?"}`。

**错误：** 409 `DOMAIN_NAME_CONFLICT`（name 或 domain_id 已存在）、422 `INVALID_PARAMS`。

#### `PATCH /api/v1/domains/{domain_id}`

修改领域字段（name/domain_id 不可变；空 body = no-op）。
**可改字段：** `description/stages/level/scope/classic_tracks/path_results/exploration_stage`。

**错误：** 404 `DOMAIN_NOT_FOUND`。

#### `DELETE /api/v1/domains/{domain_id}`

删除领域（有课程 409 保护）。

**错误：** 404 `DOMAIN_NOT_FOUND`、409 `DOMAIN_NOT_EMPTY`。

#### `POST /api/v1/domains/{domain_id}/courses`

新增课程（手工维护与探索 apply 共用；course_id 缺省服务端生成）。**请求体：**
`{"name","stage?","sort_order?","description?","aliases?","track?","prerequisites?"}`。

**错误：** 404 `DOMAIN_NOT_FOUND`、409 `COURSE_ALREADY_EXISTS`、422 `INVALID_PARAMS`。

#### `PATCH /api/v1/courses/{course_id}`

修改课程（name/course_id 不可变；仅提交显式字段）。
**可改字段：** `stage/sort_order/description/aliases/track/prerequisites`。

**错误：** 404 `COURSE_NOT_FOUND`。

#### `DELETE /api/v1/courses/{course_id}`

删除课程（有教程 409 保护）。

**错误：** 404 `COURSE_NOT_FOUND`、409 `COURSE_HAS_KNOWLEDGE`。

#### `POST /api/v1/courses/{course_id}/knowledge`

导入/采纳课程知识（tutorials JSON，每套 = `set_no/name/position/intro/textbook_ref/
exercise_ref/parallel_ref`）：建 **draft** 教程行 + `status=decided` 书行（parallel_ref 建
`status=parallel`）并回填 `book_id`。**请求体：** `{"tutorials": [...]}`。

**返回：** 透传 8901 采纳结果体（形状以 8901 契约为准）；8900 在成功后把课程
`exploration_stage` 从未开始写为**待确认**。
**错误：** 404 `COURSE_NOT_FOUND`、409 `SET_NO_CONFLICT`、422 `INVALID_PARAMS`。

#### `POST /api/v1/domains/import`

手动领域 JSON 导入（六步流程第 1 步）：校验 manual@v1 → 写
`raw/{domain_id}/domains.json` → 既有领域置 `exploration_stage=已生成`。**只写文件不落库**
（课程由 confirm 双分支 / `courses/import` 承接）。

**请求体：** `{"domain": {...manual@v1 全文...}, "target_domain_id?": "..."}`。

**返回：** 200 `{"domain_id","file_path","exploration_stage":"已生成","message"}`。
**错误：** 400 `INVALID_PARAMS`（校验失败/文件不可读）、404 `DOMAIN_NOT_FOUND`（领域须先创建）、422 缺 domain。

#### `POST /api/v1/domains/{domain_id}/commit-import`

手动导入课程（六步流程第 3 步）：透传 8901 `POST /domains/{domain_id}/courses/import`，
从 `raw/{domain_id}/domains.json` 读 courses → upsert `qed_course` → 状态置 **待确认**。

**返回：** `{"domain_id","courses_created":N,"courses_updated":M,"exploration_stage":"待确认"}`。
**错误：** 400（domains.json 无课程）、404、409 `INVALID_TRANSITION`（状态须为 已生成/探索中）。

- 端点保留供离线/手动场景；前端「已导入」路径经 `confirm-domain` + `confirm-knowledge`
  桥接收口，`待确认` 状态下调本端点必 409（守卫只收 `已生成/探索中`）。

### 探索会话（8900 自有）

会话态内存存储（进程重启即失，前端刷新后重新发起），TTL 2 小时惰性清理；管线执行中 8901
同步 dry-run（领域两步约 4 分钟/课程 tutorials@v2 约 90 秒），故 202+轮询必要；LLM 调用审计
由 8901 管线落 qed_llm_calls（经网关时 service=qed_tracker）。

#### `POST /api/v1/explore-sessions`

发起探索会话（202 + session_id + status；后台线程执行）。**请求体：**
`{"target":"domain"|"course","mode","domain_name?","domain_id?","course_id?","ref_text?","ref_doc_path?"}`。

**错误：** 422 target/mode 非法、target=domain 缺 domain_name、target=course 缺 course_id。

#### `GET /api/v1/explore-sessions/{session_id}`

轮询会话（status: running/waiting_name_confirm/ready/failed；ready 含 report + steps）。

**错误：** 404 会话不存在或已过期。

#### `POST /api/v1/explore-sessions/{session_id}/confirm-name`

名称确认（waiting_name_confirm → 以规范名重跑管线）。**请求体：** `{"name_override"}`。

**错误：** 404、422 缺 name_override、409 非 waiting 态。

#### `POST /api/v1/explore-sessions/{session_id}/apply`

应用所选（同步）：
- 领域 = POST /domains + 逐课 POST /domains/{id}/courses + exploration_stage=待确认（终态由 confirm-knowledge 收口）；
- 课程 = POST /courses/{id}/knowledge 采纳 draft 教程 + 课程 exploration_stage=待确认。

**请求体：** `{"selected":[...]}`。

**错误：** 404、422 selected 非数组、409 状态非法、503 8901 不可达。

#### `DELETE /api/v1/explore-sessions/{session_id}`

放弃会话（exploration_stage 回退未开始；会话即删）。

**错误：** 404。

### 领域探索五态门面（8900 自有）

`api/domain_explore.py` 六端点，定位为五态状态机门面：领域链路委托 8901 原生任务链
（`domain_explore`/`domain_explore_courses` 异步任务 + confirm/apply-results 端点，
六步流程含手动导入同链），8900 负责 task_id 内存登记、courses.json→课程行桥接
（apply-results 只删不建）与离线降级直写；课程探索保留 explore-sessions 会话通道，
课程确认经 `/courses/{course_id}/confirm` 离线直写收口。
终态写点矩阵与降级规则见
[domain-explore 设计](../design/downloads-flow.md) §5.2/§5.4。

#### `POST /api/v1/domains/{domain_id}/explore-knowledge`

提交领域探索任务（未开始/失败/已生成→探索中，成功后由 8901 写已生成）：
校验领域存在后提交 8901 原生 `domain_explore` 任务；名称冲突时任务挂起待确认 +
`explore_pending.kind="name_confirmation"`（经 confirm-domain 重提）。
**请求体：** `{"mode":"direct"|"web"}`。
**返回 202：** `{"domain_id","task_id","exploration_stage":"探索中","message"}`；task_id 登记内存表
（进程重启失效，8901 侧任务不受影响）。
**错误：** 404 领域不存在、409 探索进行中、502/上游码透出（探索任务离线不可降级）。

#### `POST /api/v1/domains/{domain_id}/confirm-domain`

确认领域（已生成→探索中）：透传 8901 原生 confirm（upsert domain + 异步 courses@v8 任务，
成功后写 courses.json + 待确认）。`explore_pending.kind="name_confirmation"` 挂起时改为
改名（可选）并重提领域探索任务。
**请求体：** `{"name?"}`。**返回 202：** `{"domain_id","task_id","exploration_stage":"探索中","message"}`。
**错误：** 404、409 非「已生成」且非名称确认挂起。
**降级：** 8901 连接失败→共享表直写探索中 + `"degraded":true`（离线路径：任务未提交，
手动导入数据在 `domains.json`/`courses.json`，由 confirm-knowledge 收口）。

#### `POST /api/v1/domains/{domain_id}/confirm-knowledge`

确认课程（待确认→已完成）：唯一「已完成」收口写点。桥接 `raw/{id}/courses.json`→课程行
（同名更新、缺失建行）后调 8901 apply-results（未选课程行由 8901 级联删除）；手动导入
（六步流程）同路径。`explore_pending` 不承载导入挂起（kind 统一为 `review_results` /
`name_confirmation` / `error`）。
**请求体：** `{"selected?":[course_id|名称]}`（缺省全选，manual 六步流程步骤 4 语义）。
**返回：** `{"domain_id","ok":true,"exploration_stage":"已完成","applied":N,...}`。
**错误：** 404、409 非「待确认」/课程清单不可用（courses.json 缺失或为空）/选中不匹配、
降级失败 502（共享表不可写）。

#### `POST /api/v1/courses/{course_id}/explore-knowledge`

发起课程探索（目标态：探索中）：创建 `target=course` 会话（explore-sessions 通道）。
**请求体：** 同 explore-knowledge。**返回 202：** `{"session_id","status","message"}`。
**错误：** 500（课程存在性由会话管线校验）。

#### `POST /api/v1/courses/{course_id}/confirm`

课程探索确认：课程 `exploration_stage` 从「待确认」写为「已完成」
（`shared_tables.set_course_stage` 离线直写）。**返回 200：**
`{"course_id","ok":true,"exploration_stage":"已完成","message"}`。
**错误：** 404（课程不存在）、409（当前状态非「待确认」）、500（状态写入失败）。

#### `GET /api/v1/domains/{domain_id}/explore-status`

领域探索状态轮询：返回
`{"domain_id","name","exploration_stage","active_session","task_id","explore_pending","available"}`。
`active_session = (exploration_stage=="探索中")`；`task_id` 取内存登记表（重启后 null，
前端按阶段轮询不受影响）；`explore_pending` 取库内值，待确认且库内无值时从
courses.json 合成 `{"kind":"review_results","courses":[...]}`（原生任务链成功不写 pending）。
领域不存在或查询异常时降级返回 `available:false` + `exploration_stage="未开始"`（200，不抛错）。

### 规划契约（8900 待实施）

> 未实现面不入端点总表；跟进经[任务台账](../trackers/todo.md)对应 REQ 行。

| 规划端点 | 方法 | 语义 | 依赖 |
| --- | --- | --- | --- |
| `/courses/{domain_id}` | GET | 透传 8901 单领域课程详情 | 无（8901 已就绪） |
| `/courses/{course_id}` | PATCH | 支持 `exploration_stage` 字段（课程阶段流转经本端点，取消 8900 共享表直写依赖） | 8901 支持（REQ-077） |

### 错误映射（③ 数据透传·QED-Tracker）

8901 返回 4xx（如 409 状态机冲突）→ 8900 同码透传上游 detail（前端既有 409 处理生效）；
8901 连接失败/5xx → 503 + `QED-Tracker 服务不可达：…`（前端据此降级显示，独立性铁律）。
create/register 缺必填字段由 8900 校验直接 422，不请求 8901。

## ④ 数据透传·Axiom-Flow（8902 适配）

前端（8903）只连 8900：Axiom-Flow 解析管理数据归 8900 所有（数据域），内部经
`clients/axiom_client.py`（8902 客户端）适配 8902。8902 契约事实源：Axiom-Flow
`docs/architecture/api.md`；8900 侧能力面分组语义（不构成端点契约）见
[cross-project-contracts §6](../design/cross-project-contracts.md)；职责边界与全链路数据流见根仓库设计
[文档解析管理·全链路设计](../design/parsing-flow.md)（按
[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md) 确立）。
**解析管线在 Axiom-Flow 直连模型服务，不经 8900 网关**（见 §⑤ 说明）。

### 端点表（已实现）

| 端点 | 语义 | 内部适配 |
| --- | --- | --- |
| `GET /books` | 书目列表（af_books：课程归属 domain_id/course_id/course_name + ingest/解析进度） | AxiomClient.list_books |
| `GET /books/{book_id}` | 单本详情（8902 `BookOut` 原样透传：`file_path` 数据根相对路径 + `ingest_status`/`page_count`，前端 PDF 直显判定源） | AxiomClient.get_book |
| `POST /books/sync` | 同步已验证书目：8900 聚合 8901 verified 书目 → 8902 upsert af_books（幂等，book_id 同源 qt_books）；payload 按 8902 `BookSyncItem`（`file_path`=8901 relative_path、`authors` 为 `{name,role}` 对象数组，不发 sha256/page_count） | AxiomClient.sync_books |
| `GET /books/{book_id}/pages/{page_no}` | 单页完整数据（原页图 URL + markdown + blocks + 编辑合并）；8902 `PageData` 无 `page_no`，由 8900 用路径参数补写，并把相对 `image_url` 重写为 8900 页图代理绝对地址（serve_web 不代理 /api） | AxiomClient.get_book_page |
| `GET /books/{book_id}/pages/{page_no}/image` | 原页图代理（8902 image_url 为相对路径，浏览器只连 8900） | 透传流 |
| `GET /books/{book_id}/file` | **源 PDF inline 流（8900 本地端点，不透传 8902 内容）**：经 `GET /books/{book_id}` 取 `af_books.file_path`（数据根相对路径）→ 在 `QED_DATA_ROOT` 下解析并做包含性校验（越界 400）→ FileResponse inline；`file_path` 空或文件缺失 → 404（前端降级），8902 离线 → 503 | AxiomClient.get_book + FileResponse |
| `GET /books/{book_id}/manifest` | 产物清单（文件路径/大小/哈希） | AxiomClient.get_book_manifest |
| `POST /books/{book_id}/ingest` | ingest 透传（8902 渲染页图 + book.json，不调模型）→ `{book_id,page_count,sha256,ingest_status}`（工作台/列表「书页入库」按钮硬依赖）；大书页图渲染分钟级 → 超时分层 8903 300s / 8900→8902 单请求 300s（通用约定的同步例外） | AxiomClient.ingest_book |
| `PUT /books/{book_id}/pages/{page_no}/blocks/{block_index}/edit` | **块编辑门面（本契约消费面一律走 `/edit`）**：`{verdict?, note?, corrected_text?, corrected_bbox?}` 字段全可选（verdict 枚举 ok/bad，非法 422），透传 8902 EditRecord 原样返回 | AxiomClient.edit_block |
| `GET /books/{book_id}/pages/{page_no}/edits` | 页级块编辑记录列表（EditRecord[]，进入页时合并回显） | AxiomClient.get_page_edits |
| `PUT /books/{book_id}/pages/{page_no}/blocks/{block_index}/review` | 块判定写入（verdict 枚举 ok/bad；422 校验）；**过渡门面**（状态=过渡），内部转 8902 `PUT …/edit`；替代与处置见「退役与过渡」 | AxiomClient.edit_block |
| `GET /books/{book_id}/pages/{page_no}/blocks/{block_index}/review` | 块判定回显；**过渡门面**（状态=过渡），内部走 8902 页级 `GET …/edits` 过滤 block_index，无记录 → 8900 合成 404 | AxiomClient.get_page_edits |
| `POST /parse-jobs` | 提交解析任务（202；pages 缺省全书；`engine` 缺省 mineru） | AxiomClient.create_parse_job |
| `GET /parse-jobs` | 任务列表（透传 8902 列表端点：`book_id`/重复 `status` 过滤 + `active` 标记；前端打开工作台恢复在飞任务防重复建任务） | AxiomClient.list_parse_jobs |
| `GET /parse-jobs/{job_id}` | 任务状态与进度（queued/running/completed/failed；8902 `ParseJob` 主键为 `id`，`progress` 为对象 `{parsed,total,error}`，8900 原样透传） | AxiomClient.get_parse_job |
| `GET /parsing/tree` | 左侧树聚合：8900 共享表（领域→课程）+ 8902 af_books；8902 离线降级为领域→课程 | 见 `api/axiom.py` `_build_parsing_tree` |

### 规划契约（8902 已实现、8900 透传待实施）

> 下列端点 **8902 已全部实现**（契约事实源 Axiom-Flow `docs/architecture/api.md`），
> 8900 透传与前端消费未排期；未实现面不入端点总表。

| 规划端点 | 方法 | 语义 |
| --- | --- | --- |
| `/books/{book_id}` | PATCH | 修改书目（notes 等） |
| `/books/{book_id}` | DELETE | 删除 af_books 行（`?purge=true` 连产物） |
| `/books/{book_id}/versions` | GET | 解析版本列表（只读；对比/回滚另议） |
| `/books/{book_id}/chunks` | GET | 块集读取（RAG 切片预留） |

> 完整契约以 Axiom-Flow `docs/architecture/api.md` 为事实源；全链路语义与根侧消费要点见
[文档解析管理·全链路设计](../design/parsing-flow.md)。

### 错误映射（④ 数据透传·Axiom-Flow）

8902 返回 4xx（400 参数非法 / 404 book/page 不存在）→ 8900 同码透传上游 detail；
8902 连接失败/5xx → 503 + `Axiom-Flow 服务不可达：…`；8901 连接失败/5xx →
503 + `QED-Tracker 服务不可达：…`（前端据此降级显示，独立性铁律：8901/8902 离线不影响
其他界面）。`/books/sync` 同时依赖 8901（取数），8901 不可达 → 503
`QED-Tracker 服务不可达（同步取数失败）：…`。

## ⑤ 监控诊断与 LLM 网关

支撑前端控制台的组件监控（GPU / 模型槽位 / 日志 / 8900 自身重启）与 LLM 网关。
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
- 白名单 = 服务注册表（service-hosting.md）内各单元 log_name；未知服务 404。

### GET /api/v1/monitor/gpu

GPU 状态（nvidia-smi 解析 + Windows 性能计数器 + 系统内存）：型号、显存总量/已用、
利用率、占用进程列表（含 kind 分类）、系统内存使用。

```json
{"available": true, "name": "NVIDIA GeForce RTX 4080", "memory_total_mb": 16376,
 "memory_used_mb": 4096, "utilization_percent": 65,
 "processes": [{"pid": 1234, "name": "LM Studio", "memory_mb": 4096, "kind": "model"}]}
```

- `available=false` 附 `reason`（nvidia-smi 不存在/无 GPU/解析失败）。
- **双口径**：利用率取 Windows 性能计数器
  `\GPU Engine(*)\Utilization Percentage`（任务管理器同源），响应带 `utilization_source`；
  逐进程 `memory_mb` 用 `\GPU Process Memory(*)\Dedicated Usage`（分配口径）按 pid 匹配，
  缺失回落 `None`。nvidia-smi 整卡 `memory.used/total` 保持物理驻留口径——
  两口径定义不同（分配 vs 物理驻留），前端以脚注说明。
- **同源差异提示**：PDH 分配口径总和与 nvidia-smi 物理驻留可能不一致，属定义差异非 bug；
  前端饼图剩余片用 `max(0, used − Σ进程)` 兜底并标注。
- `processes[].kind`：模型进程名关键词白名单
  （lm studio/lmstudio/llama/qwen/mineru/python/vmmem/ollama，大小写不敏感包含匹配）
  命中 → `"model"`，其余 → `"other"`；前端饼图据此高亮「非模型任务占用」。
- Windows WDDM 模式下每进程显存为 `[N/A]`/`[Insufficient Permissions]` → 该行保留，
  `memory_mb` 由 PDH 补（取不到则为 `None`）；`[Insufficient Permissions]` 进程名按 pid 经
  tasklist 补全真实名；compute-apps 不含部分图形进程，前端以「总量 − Σ进程」呈现
  「系统·图形占用」片；全部无 MB 时饼图退化已用/空闲。
- 该数据用于控制台 GPU 总览条与显存构成饼图（≥95% 警告、60s 自动刷新）。

### POST /api/v1/models/{name}/start

本地模型槽位启动，经 `model_manager.operate_model`（**单活仲裁**：`QED_RESOURCE_GUARD`
启用时启动前先停其他在跑槽位）。`name ∈ {text, vision}`，旧名 `qwen`/`mineru` 为别名
（状态=过渡，见「退役与过渡」）。

```json
{"name": "text", "status": "starting"}
```

- **槽位来源 = api（`manifest.source` > `QED_API_SELECT`）→ 409**（云端无启停语义）；
  来源 = local 允许启停（按**槽位生效来源**判定）。
- 未知 `name` → 404（槽位校验同步完成）。
- **派发即返回**：启停操作在 8900 后台线程执行（local 模型加载可达分钟级），HTTP 响应不被
  操作本体阻塞；同槽位已有操作进行中 → 409（槽位级 in-flight 互斥，操作结束自动释放）。
- 状态收敛由前端轮询 `GET /models/{name}` 的 `ready` 字段判定（轮询窗口模型侧为 300s）。

### POST /api/v1/models/{name}/stop

停止本地模型槽位（lmstudio=卸载模型保留 server；docker=停生命周期脚本）；
槽位来源 = api → 409；未知 name 404；派发即返回 + in-flight 409（同 start）。

```json
{"name": "vision", "status": "stopping"}
```

### POST /api/v1/models/{name}/restart

重启本地模型槽位（先停后启，单活仲裁经 model_manager）；槽位来源 = api → 409；未知 name 404；
派发即返回 + in-flight 409（同 start）。

```json
{"name": "text", "status": "starting"}
```

### POST /api/v1/models/{name}/select

槽位运行态选择：`{source?, runtime?, model?}`（至少一项）写入
`model/<槽位>/manifest.json` 的对应字段（重启保留，解析优先级最高）：

| 字段 | 取值 | 写入 |
| --- | --- | --- |
| `source` | `api` \| `local` | `manifest.source`（槽位来源） |
| `runtime` | `lmstudio` \| `llamacpp` \| `docker` \| `default` | `manifest.runtime`（`default` = 清空回退全局默认） |
| `model` | 注册表身份名 | `manifest.active`（向后兼容 `{model}` 单字段） |

槽位名支持旧名别名（状态=过渡）；`embedding` 无运行态 manifest → 404；未知槽位/身份/runtime → 404；
`source`/`runtime` 非法取值 → 422。select 不受来源限制（两来源均可写）。

```json
{"name": "text", "status": "selected"}
```

### GET /api/v1/models/{name}

槽位状态（控制台三卡数据源）：

| 字段 | 说明 |
| --- | --- |
| `source` | 生效来源 `api` \| `local`（`manifest.source` > `QED_API_SELECT`；无本地候选的 embedding 固定 `api`） |
| `channel` | 生效渠道：api → `direct`（直连）；local → runtime 名 |
| `runtime` | local 时 `lmstudio`/`llamacpp`/`docker`；api 空 |
| `identity` / `model` / `provider` / `base_url` | 生效身份 / 模型 / 提供方 / 端点 |
| `description` | 当前身份一句话备注（控制台「备注」行） |
| `ready` | api=API_KEY 已配置；local=绑定模型探针就绪 |
| `availability` | 可用性文本：可用 / 不可用 / 未就绪 |
| `source_options` | 来源下拉：`[{value,label,status}]`（status = available / pending；embedding 的本地部署为 pending） |
| `channel_options` | 渠道下拉：`[{value,label,status}]`（status = available / pending；`default` 为全局默认） |
| `options` | 模型下拉（按来源 × 渠道过滤）：`[{value,label,description}]` |
| `notes` / `error` | 回退告警 / 解析失败原因 |

未知槽位 → 404。

```json
{"slot": "text", "source": "local", "channel": "lmstudio", "runtime": "lmstudio",
 "identity": "qwen3.8-27b", "model": "qwen3.8-27b", "provider": "lmstudio",
 "base_url": "http://127.0.0.1:5001/v1", "description": "Qwen3.8 27B，本机 LM Studio 已下载",
 "ready": true, "availability": "可用",
 "source_options": [{"value": "local", "label": "本地部署"}, {"value": "api", "label": "API 调用"}],
 "channel_options": [{"value": "default", "label": "默认", "status": "available"},
                     {"value": "lmstudio", "label": "LM Studio", "status": "available"},
                     {"value": "docker", "label": "Docker", "status": "pending"},
                     {"value": "llamacpp", "label": "llama.cpp", "status": "pending"}],
 "options": [{"value": "qwen3.8-27b", "label": "qwen3.8-27b",
              "description": "Qwen3.8 27B，本机 LM Studio 已下载"}],
 "notes": [], "error": ""}
```

### GET /api/v1/monitor/{slot}

槽位泛化探针：`text` 按槽位渠道探 OpenAI 兼容端点（`QED_MODEL_URL`）；
`vision` 探 MinerU `/health`（`QED_OCR_MODEL_URL`）；`embedding` 无本地 runtime
（恒 `reachable=false` + 原因）。未知槽位 → 404。
旧名 `/monitor/qwen`、`/monitor/mineru` 为过渡别名（状态=过渡，见「退役与过渡」）。

```json
{"slot": "text", "runtime": "lmstudio", "reachable": true,
 "base_url": "http://127.0.0.1:5001/v1", "models": ["qwen3.8-27b"], "reason": ""}
```

### GET /api/v1/monitor/qwen

**状态=过渡**（替代：`GET /monitor/{slot}` 之 `text`）。本地 LLM（Qwen，OpenAI 兼容）探测：
服务可达性 + 已加载模型。

```json
{"reachable": true, "base_url": "http://127.0.0.1:5001/v1", "models": ["qwen3-8b"],
 "reason": ""}
```

- 探测目标与超时沿启动自检模式（未配置不探测）；默认
  `http://127.0.0.1:5001/v1`（`QED_MODEL_URL` 可覆盖，变量表见
  [project-configuration.md](../design/project-configuration.md)）。

### GET /api/v1/monitor/mineru

**状态=过渡**（替代：`GET /monitor/{slot}` 之 `vision`）。mineru 解析服务（5002，WSL 容器）
健康探测。

```json
{"reachable": true, "port": 5002, "reason": ""}
```

- 容器未启动/WSL 不可达 → `reachable=false` + 中文原因（提示运行容器编排脚本），
  不泄漏堆栈。

### LLM 网关（`/llm/*` 端点族）

按**槽位来源**路由（`manifest.source` > `QED_API_SELECT` 默认）：api 按 `QED_API_PROVIDER` 选厂商
（当前 qwen），local 走本地模型（文字槽位渠道 runtime / 图像 MinerU，经 `QED_RESOURCE_GUARD`
互斥）。密钥只在请求头，绝不下发、不入响应体；成功/失败均落 `qed_llm_calls` 记录表
（单表三项目可写）。详情契约事实源：[llm-gateway.md](../design/llm-gateway.md)。

> **解析与网关边界（[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)）**：
> 文档解析不经 `/llm/vision` 网关——Axiom-Flow 解析管线经引擎适配器直连本地模型服务
> （MinerU 5002 等）；8900 只负责模型生命周期（`/models/{name}`）、探针与资源互斥。
> `/llm/vision` 保留为控制台测试与通用视觉用途；`/models/{name}` 的 `name` 按引擎注册
> （`qwen`/`mineru` 旧名过渡别名 → `text`/`vision`，PaddleOCR-VL 接入时新增 `paddleocr`）。

| 端点 | 语义 |
| --- | --- |
| `POST /llm/text` | 文字模型调用：`{prompt, system?, prompt_template?, max_tokens?}` → 注册表解析（身份 × 槽位来源/渠道）路由 api/local → `{reply, success, call_id?}`；超时经 `QED_LLM_TIMEOUT`（默认 300s）透传上游，`max_tokens` 非 None 时透传写入请求体（REQ-061） |
| `POST /llm/vision` | 图像模型调用：`{image_base64 或 pdf_base64+pdf_filename, prompt?, prompt_template?, max_tokens?}` → 注册表解析路由 api/local → `{reply, success, call_id?}`；超时与 `max_tokens` 语义同 text（REQ-061） |
| `POST /llm/embedding` | 向量模型调用（仅 api）：`{input: [str]}` → `{embeddings, success, call_id?}`（顺序与 input 一致）；空 input 422；调用记录 prompt 记 JSON 输入、response 记维度摘要（不存向量本体） |
| `POST /llm/test/text` | 文字模型测试（控制台测试按钮）：小 prompt 真实调用，成功/失败 + 原因 |
| `POST /llm/test/vision` | 图像模型测试：健康探测 + 最小识别调用，成功/失败 + 原因 |
| `POST /llm/test/embedding` | 向量模型测试（控制台测试按钮）：小 input 真实调用，成功/失败 + 原因 |
| `GET /llm/calls` | 调用记录检索：`service / mode / model / status / start / end / task / step / prompt_template / review_status / page / size`，分页返回（REQ-060） |
| `PATCH /llm/calls/{call_id}/review` | 审核标注（REQ-060）：`{review_status, review_note?}` → `{ok, call_id}`；不存在 404 |
| `POST /database/test` | MySQL 即时连接探测（控制台测试按钮）；`/config/database` 保持启动快照语义不受影响 |

## 状态码

| 状态码 | 含义 |
| --- | --- |
| 200 | 成功（透传层把上游 201/204 规整为 200，除非端点声明创建/发起语义） |
| 202 | 任务已接受（后台执行，轮询收敛，见通用约定） |
| 400 | 请求格式错误 |
| 404 | 资源不存在（未知服务日志、探索会话不存在/过期、上游 404 透传、`UPSTREAM_NOT_IMPLEMENTED`） |
| 409 | 冲突（状态机非法迁移、服务窗口冲突、名称/唯一键冲突，码见字典） |
| 422 | 参数校验失败（缺必填字段、格式错误、枚举值非法） |
| 500 | 服务端错误 |
| 503 | 子项目服务不可达（8901/8902 连接失败/5xx → 纯文本 detail） |

## 业务错误码字典

`code` 由产生方给出，8900 同码透传（除标注 8900 产生外）；`message` 为可直接展示的中文文案。
8900 自有门面（domain_explore / explore-sessions / 配置域）错误为**纯文本 detail**，
不产出结构化码。

| code | 状态码 | 产生方 | 触发条件 | 客户端应对 |
| --- | --- | --- | --- | --- |
| `BOOK_ALREADY_EXISTS` | 409 | 8901 | `POST /books` book_id 已存在 | 改走详情/编辑，不重复建 |
| `BOOK_NOT_FOUND` | 404 | 8901 | 书籍行不存在（register/import 等） | 刷新书库列表 |
| `INVALID_PARAMS` | 422 | 8901 | book_id 格式错、缺 title、值域错误 | 表单标红 message |
| `INVALID_TRANSITION` | 409 | 8901/8902 | 状态机非法迁移（start/cancel/verify、commit-import 前置态不符） | 重新拉当前态后禁用按钮 |
| `DOMAIN_NAME_CONFLICT` | 409 | 8901 | `POST /domains` name 或 domain_id 已存在 | 改名或进既有领域 |
| `DOMAIN_NOT_FOUND` | 404 | 8901 | 领域不存在 | 刷新领域树 |
| `DOMAIN_NOT_EMPTY` | 409 | 8901 | 删除有课程的领域 | 先清课程 |
| `COURSE_ALREADY_EXISTS` | 409 | 8901 | 新增课程冲突 | 进既有课程 |
| `COURSE_NOT_FOUND` | 404 | 8901 | 课程不存在 | 刷新课程树 |
| `COURSE_HAS_KNOWLEDGE` | 409 | 8901 | 删除含教程的课程 | 先清教程 |
| `SET_NO_CONFLICT` | 409 | 8901 | 采纳教程 set_no 冲突 | 调整 set_no 重提 |
| `UPSTREAM_NOT_IMPLEMENTED` | 404 | 8900 | 手工维护端点 8901 尚未实现（REQ-059 承接中） | 提示升级/走规划路径 |

## 退役与过渡

处置策略按 [cross-project-contracts §10](../design/cross-project-contracts.md)：退役＝直接删除
（请求返回 404/405，不保留 410 壳）；过渡面随存量消费面退役删除。过程细节可自
`docs/history/` 计划壳与 Git 历史追溯。

### 已删除（请求返回 404/405）

| 旧端点面 | 后继 |
| --- | --- |
| `/books/{book_id}/decide·retry·complete·reject·supersede`（POST，旧八态下载机） | 下载生命周期 `start/fail/verify/cancel` + 五阶段编排内部 `mark_owned`（QED-060）；候选→决定由采纳端点 `POST /courses/{id}/knowledge` 建 decided 行；退役写入面待 REQ-079（QED-Tracker） |
| `/config/llm-status`（GET） | 启动自检 + `GET /config/keys`（可达性不再按需探测） |
| `/resources` 清单/详情/预览/状态机族、`/tasks/catalog/evaluate`、`/tasks/books/download` | qt_resources 退役（QED-030），五层模型端点承接 |
| 三表语义 API 族 | QED-031 知识层次重构退役（历史契约原文自 Git 历史查阅） |
| `/domains/{domain_id}/explore`、`/domains/{domain_id}/confirm-name`（POST） | 领域探索与名称确认由 ExploreFlowModal（`/explore-sessions` 通道）承接 |

### 过渡面（在册，状态=过渡）

| 端点/入参 | 替代 | 处置 |
| --- | --- | --- |
| `GET/PUT /books/{book_id}/pages/{page_no}/blocks/{block_index}/review` | `PUT …/edit` + `GET …/edits`（8902 原生形状） | 8900 门面兼容旧前端契约；存量消费面迁完后删除 |
| `GET /monitor/qwen`、`GET /monitor/mineru` | `GET /monitor/{slot}`（text/vision） | 别名兼容期，前端切槽位探针后删除 |
| 槽位旧名 `qwen`/`mineru`（`/models/{name}/*`、`/monitor/{slot}`、select） | `text`/`vision` | 别名解析保留，消费方迁移后删除 |

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

- `tests/contract/test_api_endpoint_inventory.py`：端点总表 ↔ FastAPI `app.routes` 双向一致
  （本文件增删端点必须同步总表，否则契约门禁红）。
- `pytest tests -q` 全绿；`ruff check backend tests` 无错误。
- uvicorn 启动后：配置域四接口均返回 200；启动日志含 LLM 启动自检与 MySQL 快照信息；
  `/config/llm-status` 返回 404（已退役）；`/config/database` 返回启动快照
  （`reachable`/`reason` 与启动时一致，不按需探测）。
- 8901 在线时 `/catalogs/math-qe` 返回真实数据；8901 离线时返回 503 且配置域
  不受影响（独立性铁律）。
- LLM 网关 api/local 模式真实冒烟（`/llm/test/text` ok=true、`qed_llm_calls` 落库）。
- 供应商 key 真实可用性以各服务实际调用为准（glm 曾返 429 余额不足，属账户状态，
  不影响中心降级运行）。
