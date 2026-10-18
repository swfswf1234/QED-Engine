# 8900 API 接口文档

设计状态：Accepted
实现状态：Implemented
最后更新：2026-10-14
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

8900 是 `.env` 的唯一只读语义代理。接口按类型分为**六类**（共 106 端点，清单与状态见
「端点总表」，逐端点语义见对应分节）：

| 类型 | 范围 | 端点数 |
| --- | --- | --- |
| ① 服务管理类 | 健康检查、服务注册表、启停托管、8900 自身重启 | 6 |
| ② 配置语义类 | 模型路由表、供应商配置状态、统一数据库快照 | 3 |
| ③ 数据透传·QED-Tracker | 目录/任务/教程/书籍/领域课程 + 探索会话与领域探索门面（8900 自有） | 41 |
| ④ 数据透传·Axiom-Flow | 书目/单本详情/PDF 流/页/manifest/块编辑与判定/ingest/parse-jobs/parsing-tree | 16 |
| ⑤ 监控诊断与 LLM 网关 | 日志/GPU/槽位探针与启停/选择 + LLM 调用族 + MySQL 即时探测 | 19 |
| ⑥ 学习域（8900 自有） | 课程引用式注册/单元树/编译作业/派生进度（主链 M-1 契约骨架）+ 知识点体系与星图聚合（M5 两表） | 21 |

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
| GET | /api/v1/papers/books | ③ | 在用 |
| POST | /api/v1/papers/recommend | ③ | 在用 |
| GET | /api/v1/papers/selections | ③ | 在用 |
| GET | /api/v1/papers/selections/{selection_id} | ③ | 在用 |
| POST | /api/v1/papers/selections/{selection_id}/adopt | ③ | 在用 |
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
| GET | /api/v1/learn/courses | ⑥ | 在用 |
| POST | /api/v1/learn/courses | ⑥ | 在用 |
| POST | /api/v1/learn/courses/sync | ⑥ | 在用 |
| GET | /api/v1/learn/courses/{learn_course_id} | ⑥ | 在用 |
| PATCH | /api/v1/learn/courses/{learn_course_id} | ⑥ | 在用 |
| DELETE | /api/v1/learn/courses/{learn_course_id} | ⑥ | 在用 |
| GET | /api/v1/learn/courses/{learn_course_id}/units | ⑥ | 在用 |
| PUT | /api/v1/learn/courses/{learn_course_id}/syllabus | ⑥ | 在用 |
| PATCH | /api/v1/learn/units/{unit_id} | ⑥ | 在用 |
| GET | /api/v1/learn/units/{unit_id} | ⑥ | 在用 |
| POST | /api/v1/learn/courses/{learn_course_id}/compile/propose | ⑥ | 在用 |
| POST | /api/v1/learn/courses/{learn_course_id}/compile/start | ⑥ | 在用 |
| GET | /api/v1/learn/courses/{learn_course_id}/compile | ⑥ | 在用 |
| GET | /api/v1/learn/courses/{learn_course_id}/progress | ⑥ | 在用 |
| POST | /api/v1/learn/courses/{learn_course_id}/progress | ⑥ | 在用 |
| GET | /api/v1/learn/courses/{learn_course_id}/mastery | ⑥ | 在用 |
| POST | /api/v1/learn/courses/{learn_course_id}/mastery/assess | ⑥ | 在用 |
| GET | /api/v1/learn/star-map | ⑥ | 在用 |
| GET | /api/v1/learn/knowledge-points | ⑥ | 在用 |
| GET | /api/v1/learn/courses/{course_ref}/knowledge-points | ⑥ | 在用 |
| GET | /api/v1/learn/kp-details | ⑥ | 在用 |
| POST | /api/v1/learn/kp-details | ⑥ | 在用 |
| POST | /api/v1/learn/kp-details/{detail_id}/confirm | ⑥ | 在用 |
| POST | /api/v1/learn/kp-details/{detail_id}/reject | ⑥ | 在用 |
| POST | /api/v1/learn/annotations/generate | ⑥ | 在用 |
| POST | /api/v1/learn/kp-details/{detail_id}/like | ⑥ | 在用 |
| GET | /api/v1/learn/courses/{course_ref}/outline | ⑥ | 在用 |
| PUT | /api/v1/learn/courses/{course_ref}/outline | ⑥ | 在用 |
| PATCH | /api/v1/learn/knowledge-points/{kp_id} | ⑥ | 在用 |
| GET | /api/v1/learn/question-books | ⑥ | 在用 |
| POST | /api/v1/learn/questions | ⑥ | 在用 |
| GET | /api/v1/learn/questions | ⑥ | 在用 |
| PATCH | /api/v1/learn/questions/{question_id} | ⑥ | 在用 |
| POST | /api/v1/learn/attempts | ⑥ | 在用 |
| GET | /api/v1/learn/review/due | ⑥ | 在用 |
| GET | /api/v1/learn/mistakes | ⑥ | 在用 |
| PATCH | /api/v1/learn/attempts/{attempt_id} | ⑥ | 在用 |

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

**库名一致性字段（DEFECT-015 S2）**：响应顶层带 `db_name`（8900 自身生效库名），每单元另带三字段——
`db_name`（该单元最近一次经 8900 派发时注入的库名）、`db_source`（`injected`=本进程派发并注入 /
`unknown`=在线但非本进程派发或本进程无记录 / `self`=config 单元自身）、`db_mismatch`（派发库名≠当前
根库名，即旧库名进程仍在读写）。不一致时同步落一条 `db_mismatch` 告警到 `logs/config.log`（同一
「单元+派发库名+根库名」只记一次，轮询不刷屏）。口令与 `QED_DB_*` 键名不出现在任何字段、
日志或错误文本（S4；回归用例 `tests/test_api.py`）。

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
`GET /books` 被数据域·Axiom 预留路由占用（axiom.py，仅 GET，与 tracker 的 POST /books 不冲突）；书库按 kind/域/课枚举在 8901 侧为 `GET /books`，8900 论文面另以 `GET /papers/books` 承接（见「论文探索」节）。

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

### 论文探索（REQ-102 W2a 枚举 / W2b 探索面；上游=QED-068 A/B 步）

发现论文＝`qt_books` 中 `kind=paper` 且无教程归属的书行（2026-09-30 裁决①书本化采纳）。
**论文没有默认桶**——`domain_id` 必填且须为 `qed_domain` 已登记领域；8900 对论文面一律
**不补默认值、不做二次校验**，上游 422/404/409 原样透传给 8903 提示。链路分段责任与
展示态派生见 [downloads-flow §7](../design/downloads-flow.md)，UI 消费面见
[downloads-ui §4.4](../design/frontend/downloads-ui.md)。

#### `GET /api/v1/papers/books`

发现论文书行枚举（8903 领域论文栏数据源，见 downloads-ui §4.4.6）。固定以 `kind=paper` 透传 8901 `GET /books`
（调用方传入的 `kind` 被忽略）；**区别于 `GET /api/v1/books`**（Axiom af_books 代理，占用中不可复用）。

**查询参数：** `domain_id`（可选）、`course_id`（可选，AND 过滤；空=领域级）。

**返回：** 200 `QtBook.to_dict()` 全列数组（含 `kind`/`domain_id`/`course_id`＝8903 分桶唯一依据）；
无命中空数组。**错误：** 503 8901 不可达（前端据此静默空态、整行隐藏）。

#### `POST /api/v1/papers/recommend`

领域级论文探索任务提交（202，任务类型 `paper_recommend`）。请求体逐字段原样转发 8901。

**请求体：** `domain_id`（必填）、`recipe`（`frontier`\|`core`）、`goal`、`categories`、
`top`/`limit`/`years_limit`（缺省由 8901 配方决定）。

**返回：** 202 `{"task_id": "..."}`；进度经 `GET /api/v1/tasks/{task_id}` 轮询，
完成后经 `GET /api/v1/papers/selections/{selection_id}` 读报告。

**错误：** 422 领域缺失/不存在、`recipe` 非法、领域映射不到 arXiv 分类（须显式给 `categories`）；
409 同 scope 任务在跑（`TASK_ALREADY_RUNNING`）。

#### `GET /api/v1/papers/selections`

选书报告摘要列表（created_at 倒序）。**查询参数：** `domain_id`、`recipe`（AND 过滤，空值不过滤）、
`limit`。**返回：** 200 `{"selections": [{selection_id, domain_id, recipe, status, created_at,
recommendation_count}]}`。

#### `GET /api/v1/papers/selections/{selection_id}`

报告详情（候选 + 评分 + `status`）。**错误：** 404 `SELECTION_NOT_FOUND`。
评分理由只存报告侧（对方裁决 #3，书行 `notes` 不含模型判断）——8903 要显示「为什么推荐」须读本端点。

#### `POST /api/v1/papers/selections/{selection_id}/adopt`

显式 pick → 8901 建 `kind=paper` 书行（202，任务类型 `paper_adopt`）。

**请求体：** `picks: [{rank, domain_id, course_id}]` 逐条落位——`domain_id` 必填且须已登记，
`course_id` 空=领域级（课程归属为纯逻辑分组，物理仍落领域级 `_general/papers/`）。
**返回：** 202 `{"task_id": "...", "selection_id": "..."}`。
**错误：** 422 picks 为空/rank 不在推荐内/落位领域或课程不存在或课程不属该领域；
404 报告不存在；409 同报告任务在跑。

**采纳不自动下载**（对方裁决 #5）：新行停在 `candidate`，取书须由调用方显式调
`POST /api/v1/books/{book_id}/fetch`（§③ 书籍面；8901 侧按 `kind=paper` 分叉直取 arXiv，
不做书名多渠道检索）。

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
课程确认经 `/courses/{course_id}/confirm` 收口（`exploration_stage` 走 8901 在线写，8901 不可达时降级直写）。
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
（`shared_tables.set_course_stage` 经 8901 `PATCH /courses` 在线写，8901 不可达时降级直写）。**返回 200：**
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

> 论文面五行已随 REQ-102 W2a/W2b 实装挪入 §③「论文探索」正文并登记端点总表；
> 上游（8901 侧）契约事实源=对方 `docs/architecture/api.md`「⑥ 论文探索」。

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
| `POST /books/{book_id}/ingest` | ingest 透传（8902 渲染页图，元数据落 af_books，不调模型）→ `{book_id,page_count,sha256,ingest_status}`（工作台/列表「书页入库」按钮硬依赖）；大书页图渲染分钟级 → 超时分层 8903 300s / 8900→8902 单请求 300s（通用约定的同步例外） | AxiomClient.ingest_book |
| `PUT /books/{book_id}/pages/{page_no}/blocks/{block_index}/edit` | **块编辑门面（本契约消费面一律走 `/edit`）**：`{verdict?, note?, corrected_text?, corrected_bbox?}` 字段全可选（verdict 枚举 ok/bad，非法 422），透传 8902 EditRecord 原样返回 | AxiomClient.edit_block |
| `GET /books/{book_id}/pages/{page_no}/edits` | 页级块编辑记录列表（EditRecord[]，进入页时合并回显） | AxiomClient.get_page_edits |
| `PUT /books/{book_id}/pages/{page_no}/blocks/{block_index}/review` | 块判定写入（verdict 枚举 ok/bad；422 校验）；**过渡门面**（状态=过渡），内部转 8902 `PUT …/edit`；替代与处置见「退役与过渡」 | AxiomClient.edit_block |
| `GET /books/{book_id}/pages/{page_no}/blocks/{block_index}/review` | 块判定回显；**过渡门面**（状态=过渡），内部走 8902 页级 `GET …/edits` 过滤 block_index，无记录 → 8900 合成 404 | AxiomClient.get_page_edits |
| `POST /parse-jobs` | 提交解析任务（202；pages 缺省全书；`engine` 缺省 mineru） | AxiomClient.create_parse_job |
| `GET /parse-jobs` | 任务列表（透传 8902 列表端点：`book_id`/重复 `status` 过滤 + `active` 标记；前端打开工作台恢复在飞任务防重复建任务） | AxiomClient.list_parse_jobs |
| `GET /parse-jobs/{job_id}` | 任务状态与进度（queued/running/completed/failed；8902 `ParseJob` 主键为 `id`，`progress` 为对象 `{parsed,total,error}`，8900 原样透传） | AxiomClient.get_parse_job |
| `GET /parsing/tree` | 左侧树聚合信封 `{nodes, sources}`：`nodes`＝8900 共享表（领域→课程）+ 8902 af_books；`sources`＝`{shared_tables: ok\|empty, axiom_flow: ok\|offline}` 标两种降级来源（DEFECT-015 S3），8902 离线时 `nodes` 仍含领域→课程且返 200 | 见 `api/axiom.py` `_build_parsing_tree` |

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

服务日志查看（错误诊断）：读取 `/services` 注册表单元的**实际写入日志**（生命周期脚本托管单元
读其脚本产物 `<workdir>/logs/qed-<unit>-serve.log`，8901/8902 在各自仓库、8903 在根 `logs/`；
8900 自身读根 `logs/config.log`；ADR 0019 第 3 条，**白名单**，越权 404；文件不存在返回空行）。

```json
{"service": "tracker", "log_path": "D:/coding/QED-Engine/QED-Tracker/logs/qed-tracker-serve.log",
 "lines": ["...", "..."]}
```

- 查询参数：`tail`（返回行数，默认 200，上限 1000）、`keyword`（子串过滤，可选）。
- 白名单 = 服务注册表（service-hosting.md）内各单元 name；未知服务 404。

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
| `health_state` | 监督器防抖定态（ARCH-028 W1/W7）：`ready` \| `degraded` \| `down` \| `starting` \| `""`（未观测/监督器关闭）；`starting`＝start/restart 派发后的启动宽限窗口内（`QED_MODEL_START_GRACE_SECONDS` 默认 180s），窗口内不判掉线 |
| `health_reason` | 定态原因稳定文案（含水位/宽限等），进仪表盘徽章 tooltip |
| `gpu_visible` | T2 容器内 GPU 可见性（`true`/`false`；不适用＝`null`） |
| `last_flip` | 最后状态翻转 ISO 时刻 |
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
| `POST /llm/text` | 文字模型调用：`{prompt, system?, prompt_template?, max_tokens?}` → 注册表解析（身份 × 槽位来源/渠道）路由 api/local → `{reply, success, call_id?}`；超时经 `QED_LLM_TIMEOUT`（默认 300s）透传上游，`max_tokens` 非 None 时透传写入请求体（REQ-061）。**`response_format` 暂不对外暴露**（用户裁决 2026-09-29）：JSON 模式只是网关内部 `call_text` 参数，经 M3 适配层按能力表与运行时拉黑注入（开关 `QED_LLM_LOCAL_ADAPT`），语义见 [llm-gateway.md](../design/llm-gateway.md)「本地模型适配层」节 |
| `POST /llm/vision` | 图像模型调用：`{image_base64 或 pdf_base64+pdf_filename, prompt?, prompt_template?, max_tokens?}` → 注册表解析路由 api/local → `{reply, success, call_id?}`；超时与 `max_tokens` 语义同 text（REQ-061） |
| `POST /llm/embedding` | 向量模型调用（仅 api）：`{input: [str]}` → `{embeddings, success, call_id?}`（顺序与 input 一致）；空 input 422；调用记录 prompt 记 JSON 输入、response 记维度摘要（不存向量本体） |
| `POST /llm/test/text` | 文字模型测试（控制台测试按钮）：小 prompt 真实调用，成功/失败 + 原因 |
| `POST /llm/test/vision` | 图像模型测试：健康探测 + 最小识别调用，成功/失败 + 原因 |
| `POST /llm/test/embedding` | 向量模型测试（控制台测试按钮）：小 input 真实调用，成功/失败 + 原因 |
| `GET /llm/calls` | 调用记录检索：`service / mode / model / status / start / end / task / step / prompt_template / review_status / page / size`，分页返回（REQ-060） |
| `PATCH /llm/calls/{call_id}/review` | 审核标注（REQ-060）：`{review_status, review_note?}` → `{ok, call_id}`；不存在 404 |
| `POST /database/test` | MySQL 即时连接探测（控制台测试按钮）；`/config/database` 保持启动快照语义不受影响 |

## ⑥ 学习域（8900 自有：主链 M-1 契约骨架 + M5 知识点体系 + M2 练习与复习）

学习链路（课程引用式注册→单元树→编译作业→派生进度）的 8900 自有域，非透传；表语义与
裁决（D1~D4）事实源＝[学习设计轮主链壳](../plans/2026-09-22-learning-design-mainline.md)
「M-1/M-2 契约设计稿」节。当前为 M-1 骨架形态：编译=静态兜底出块（编译链不含 LLM 生成，M-2
接线），存储未接入时（生产 MySQL 存储随 M-2 落地）整域 503。错误包络=8900 自有中文纯文本。
**2026-10-17 用户裁决 C18 改判注记**（REQ-117 W9）：学习面的**注解按需生成**属本域业务端点
（`POST /learn/annotations/generate`，服务端经网关文字槽编排），不改变「静态出块不含 LLM」与
「知识点自动抽取/确认入库归文档分析处理面」两条口径；前端不拼 prompt、不直调 `/llm/*`。

M5 知识点两表（`qed_knowledge_point` 第四张共享表 + `qed_learn_kp_detail` 根私有候选池）由**首个
知识点端点**懒建表挂载（判例 `qed_llm_calls`，启动路径不触碰 MySQL），数据库不可达时该族端点 503；
星图端点只读课程目录（8901 透传，离线降级共享表直读），不依赖新表。语义事实源＝
[M5 知识点体系与星图壳](../history/plans/2026-10/2026-09-30-knowledge-point-star-map.md)。

**知识点主表行序列化形状（REQ-118 逐列定档，2026-10-16）**：本域所有返回主表行的端点
（`GET /learn/knowledge-points`、`GET /learn/courses/{course_ref}/knowledge-points`、
`.../outline`、`POST /learn/kp-details/{detail_id}/confirm`、`PATCH /learn/knowledge-points/{kp_id}`）
的行形状＝`{kp_id, domain_id, domain_label, course_id, course_label, node_kind, parent_kp_id, depth,
book_ref, name, norm_key, type, order_hint, summary, source_ref, anchors, from_detail_id, meta,
created_by, updated_by, created_at, updated_at}`——**无 `confirmed` 键**（人工确认位只在候选池行）；
`book_ref` 对 point 行为 `null`（空串哨兵已随定档撤销，来源书只在 outline 行与候选池）；
`meta`＝扩展槽（只读不筛，读方按可缺省处理，守则见
[database-design.md](database-design.md)「meta 扩展槽守则」节）；`created_by`/`updated_by`＝写入方
服务标识（根侧恒 `qed_engine`）。

M2 练习与复习（`qed_learn_question` / `qed_learn_attempt` / `qed_learn_review_task` 三表 + 8 端点）
由**首个练习端点请求**懒建表挂载（同判例，短窗重试 `PRACTICE_MOUNT_RETRY_SECONDS`）。v1 题源＝**抽取式**
（现成习题集与教材课后题，`POST /learn/questions` 批量入库），LLM 两段式出题与 `POST /learn/questions/generate`
归 v2（不在本域登记）；判分＝确定性规则三型（choice/short/open），`method=llm` 分支默认关闭；
无答案题按裁决 ⑨ 只作 flashcard 自评。语义事实源＝
[学习设计轮 M2 壳](../history/plans/2026-10/2026-09-23-practice-review.md)。

| 端点 | 语义 |
| --- | --- |
| `GET /learn/courses` | 课程列表（含派生态 `derived`；`derived.books`＝按单元行 `source_ref.ref_id` 归集的**教材级进度** `[{ref_id,label,total,done,percent}]`，无单元行的教材 `total=0`／`percent=0`——REQ-117 W8/C9） |
| `POST /learn/courses` | 注册课程：`{name, resources:[{kind,ref_id,label}]≥1, domain_ref?, course_ref?, direction?, instructions?, agent_notes?}`；kind 闭集 `book/af_version/knowledge`；双通道限长 4000；422 |
| `POST /learn/courses/sync` | **解析好即同步**：读 `af_books`（`active_job_id` 非空且 `course_id` 非空）按课程分组，回查 `qed_course` 取领域与**正式名称**；`course_ref.ref_id` 命中既有学习课程（多门取 `created_at` 最早）只并集补入新书（不覆盖 `dismissed`、不改 `name`），未命中则建行（`name`＝正式名称）；坐标查不到者 PASS 不猜归属 → `{synced,created,updated,courses,books}`；`books`＝教材卡展示元数据 `[{ref_id,label,course_id,knowledge_id,intro,position,position_label,page_count}]`，其中「简介/面向对象」由 `af_books.knowledge_id` 联接 `qt_knowledge` 套级 `intro`/`position`（五档→入门/进阶/深入/综合/选修）——书级两列现网尚不存在，已按跨项目请求登记 QED-Tracker （REQ-117 W8/C10），落地后本联接改读列；8901 教程套不可达时两字段留空、不阻断同步；解析侧不可达 503（学面降级为列既有课程）——REQ-117 W8/C9 |
| `GET /learn/courses/{learn_course_id}` | 详情聚合（课程行 + derived + unit_count）；404 |
| `PATCH /learn/courses/{learn_course_id}` | 改元数据与双通道（限长 422、不存在 404）；白名单含 `resources`（整列提交，元素 `{kind,ref_id,label,dismissed?}`——`dismissed`＝书架面教材级忽略位，JSON 列内键、零 DDL，REQ-117 W8/C11） |
| `DELETE /learn/courses/{learn_course_id}` | 删除（级联清单元树与进度）；编译在跑 409 |
| `GET /learn/courses/{learn_course_id}/units` | 单元树消费：`?level=section\|unit\|point` 视图过滤（`point`＝已确认知识点的**读时投影**：派生键 `unit_id=kp:{kp_id}`、零写入，首次勾选/跳过才物化——REQ-117 §V2.3）；`level=point` 时同响应带 `chapters`＝章行 `{unit_id,kp_id,name,point_count,book_ref,source_ref,summary,key_points}`，其 `summary` 与 `key_points`（＝章行 `meta.chapter_key_points`）＝学习面注解段的章级成品位，进场一次直读；行含 `gen_status/active/confirmed/covered/drift` ＋投影行 `kp_id/window_source/summary`（`window_source ∈ point|anchor|chapter|''`＝取材页窗三级回落来源）；422（level 非法）、404 |
| `PUT /learn/courses/{learn_course_id}/syllabus` | 整树草稿覆写 `{tree:[{title,order?,children?}]}`；最深三级（section→unit→block），空标题/空树 422 |
| `PATCH /learn/units/{unit_id}` | 字段白名单 `{title,order,confirmed,covered}`（extra 422）；covered 前提=已 confirmed（否则 409，勾选权归学习者） |
| `GET /learn/units/{unit_id}` | 单元回显；404 |
| `POST /learn/courses/{learn_course_id}/compile/propose` | 提案入参登记 `{page_windows:[{start,end}]≥1}`（范围非法 422），置 `proposed` 并记源指纹 |
| `POST /learn/courses/{learn_course_id}/compile/start` | 发起编译 **202**：要求树非空且全节点 confirmed（两级确认齐备，否则 409）；作业态挂课程行（D3 裁决） |
| `GET /learn/courses/{learn_course_id}/compile` | 作业轮询：`{compile_status, done, total, failure_count}`；无作业=空态（status null） |
| `GET /learn/courses/{learn_course_id}/progress` | 派生进度（读时重算非累加）：`{total,done,skipped,percent,current_unit_id,completed,mastered,next_unit_id,provenance}`——**原五字段口径不动**（计数源仍是学习者勾选位），主链 M-3 增三字段：`mastered`＝过门知识点行数（任一 provenance）、`provenance`＝`{system,learner}` 分布、`next_unit_id`＝`next_step` 指向的行；`current_unit_id` 由「第一个未勾选行」改判为**第一个未掌握知识点行**（门就是游标，裁决 D-M3-1；`skipped`＝学习者显式让位，不停靠）；`POST` 响应的 `derived` 与本行同形状、`GET /learn/courses` 的`derived` 同源（主链壳 M-3 W3） |
| `POST /learn/courses/{learn_course_id}/progress` | 记学习事件 `{unit_id, status:done\|skipped\|pending}`（pending=撤销该行）；跨课程 unit 404、非 unit 行 409 |
| `GET /learn/courses/{learn_course_id}/mastery` | 逐知识点门态（主链 M-3）：只出投影的知识点行 → `{items:[{unit_id,kp_id,kp_type,gate,mastery,threshold,attempt_count,provenance,status,qualitative_passed,due_reviews}],next_step:{unit_id,kp_id,action,reason},summary:{total,mastered,learning,new}}`；门型按 `qed_knowledge_point.type` **现值**分流（`memory`/`procedure`＝量化门 0.9、`concept`/`design`＝质性门显示 1.0、空或未知型回落 0.9 不猜——D-M3-3）；分数＝近因加权正确率（最近 5 次、权重 `0.5/0.7/0.85/0.95/1.0`、置信上限 1 次 0.5／2 次 0.8）由 `services/learn/mastery.py` 读时派生、**不落列**，门态清单不物化单元行；`due_reviews`＝该知识点到期复习数（题行＋知识点粒度行两路归集，未归档题不进门）；练习腿不可达＝按零作答派生、不 503（D-M3-4）；404（课程不存在）、503（学习域存储未接入） |
| `POST /learn/courses/{learn_course_id}/mastery/assess` | 质性门记录（v1＝学习者自评位，D-M3-2；`model` 判读腿属 M-3b）`{unit_id,passed:bool,note?≤1000,by:learner=learner}`（extra 422）→ 只写进度行判定四列（首次落笔才物化知识点行，已勾位不被抹）＋回显 `{item:<门态行>, next_step:{...}}`；量化型（`memory`/`procedure`/空型）拒绝 **409**（参照同款 refusal：量化型按答题序列过门）；404（课程或投影行不存在）、422（`passed` 缺失或非布尔、`by` 越界、`note` 超长）、503 |
| `GET /learn/star-map` | 星图一次取全：`?domain=` 过滤（未知领域 404）→ `{domains:[{domain_id,name,level,tracks:[{track,kind:main\|branch\|other,summary,courses:[{course_id,name,track,stage,sort_order,description,kp_confirmed,kp_candidates}]}]}], edges:[{from,to,domain_id,cross_track}]}`；簇内按 `sort_order`→`course_id` 稳定排序、簇间按成员数降序；`description`＝`qed_course.description` 透传（星图课程卡悬停叙述，REQ-110 W2），无介绍时空串；目录不可达 503 |
| `GET /learn/knowledge-points` | 已确认知识点跨课程检索：`?domain=&course=&type=&q=&limit=50&offset=0`（type 闭集非法 422，limit 1..500）→ `{points,total}`；**只出 `node_kind=point` 行**（M6 目录节点不进检索面） |
| `GET /learn/courses/{course_ref}/knowledge-points` | 课程知识点总览 → `{course:{course_id,name,track,domain_id,description}（`description`＝`qed_course.description` 直读透传，无介绍时空串，REQ-104 W7）, points:[主表行+`candidates`（同 `norm_key` 待选叙述，多版本并存）], total, candidate_total}`；默认只出 point 行，`?include_outline=true` 时带目录节点行；课程不存在 404、存储未接入 503 |
| `GET /learn/kp-details` | 候选明细池浏览：`?course=&gen_status=&batch=&parent=&limit=100&offset=0`（gen_status 闭集非法 422；`parent=<kp_id>` 取该章候选、`parent=none` 取未归档池；`gen_status` 过滤**可选**——缺省连 `draft` 一起返回，学习面「备注」据此读回自己写的行）→ `{details,total}` |
| `POST /learn/kp-details` | 登记候选（生成管线与人工共用写面）`{course_id,name,domain_id?,course_label?,domain_label?,narrative?,type?,payload?,anchors?,gen_batch?,map_seed?,model_ref?,dedup_of?,gen_status:draft\|candidate,parent_kp_id?,intent:summary\|explanation=explanation,book_ref?}`；空 course_id/name、type 或 intent 非法 422；坐标标签缺省从课程目录补齐；**永不写 confirmed**。锚点形状 `anchors=[{kind:book,ref_id,page,block_index?,snippet}]`——`block_index`＝书页内块序（REQ-117 C27：学习面「详解」按页＋块序精确命中排「这一块」，缺位的老行退化按页并入）。学习面「备注」＝本写面打标一行 `gen_batch=learn-note`、`gen_status=draft`、`payload.kind=note`、`name`＝正文首行截 40 字（REQ-117 C26：复用候选池零 DDL、8900 零改动）；`note` 行**不作知识点提升来源**，确认面归 REQ-116 后台管理 |
| `POST /learn/kp-details/{detail_id}/confirm` | **人工确认并提升**到共享主表（人工确认位只在候选池行、且只能由本端点置位；主表无确认列——REQ-118 定档）→ `{point,detail}`；同课程重复 `norm_key` 409（合并走 `dedup_of`）、已驳回 409、不存在 404；重复确认幂等返回既有主表行 |
| `POST /learn/kp-details/{detail_id}/reject` | 候选驳回（不落主表，可重新登记新候选）→ `{detail}`；不存在 404 |
| `POST /learn/annotations/generate` | **按需生成注解**（REQ-117 W9／C18）：`{course_id,target_kind:point|chapter,kp_id,part:summary|key_points|annotation}`，用途与目标层配对闭集（章＝`summary`/`key_points`，条＝`annotation`），不匹配 422。服务端编排＝按知识点自带 `source_ref` → 来源锚点 → 所属章三级回落取页窗，经书页读面取块文本（限页＝章 12 页／条 6 页，限字与 `max_tokens` 随 `part` 定档）→ 拼 prompt → `services/llm/gateway.call_text(service=learn_annotation)`；**前端不拼 prompt、不直调 `/llm/*`**。落库两式：章＝**覆写**章行 `summary` 或 `meta.chapter_key_points`（成品位单一，零 DDL）；条＝候选池新增一行 `gen_status=candidate`、`intent=summary`、`gen_batch=learn-annotation`、`model_ref=调用标识`、`anchors=[{kind:book,ref_id,page,snippet}]`、`parent_kp_id=本条 kp_id`（多版本并存不覆写、永不写 `confirmed`——入库腿仍归 `…/confirm`）。响应 `{ok,target:{kind,kp_id,name},chapter?:{kp_id,summary,key_points},detail?:<候选整行>}`。章级同一 `(course_id,target_kind,kp_id,part)` 60s 内重复＝直接回上次成品（不重烧模型），条级不去重。错误口径（中文纯文本、过学习面话术净化）：取材零可用页 503、上游失败或空成品 502、目标不在投影序列 404、课程不存在 404、知识点两表不可达 503 |
| `POST /learn/kp-details/{detail_id}/like` | **点赞＝保留**（REQ-117 C19）：`{liked:boolean}` → 只写候选行 `payload.liked`，`gen_status`／`confirmed`／主表一律不动 → `{detail:<候选整行>}`；与 `…/confirm`、`…/reject` 同形状；不存在 404、`liked` 缺失或非法 422 |
| `GET /learn/courses/{course_ref}/outline` | 章节树一次取全（M6）：`?book=` 按来源书过滤 → `{course_id,book_ref,outline:[{kp_id,name,depth,parent_kp_id,book_ref,source_ref,point_count,node_kind,type,summary,...}]}`（前序平铺，左栏按 `depth` 缩进；`summary`＝该知识点／目录节点的一句话介绍，与 point 行同一列同一序列化通道）；课程不存在 404、目录不可达 503 |
| `PUT /learn/courses/{course_ref}/outline` | 目录确认后**整树幂等替换**同 `book_ref` 的 outline 子树 `{book_ref,tree:[{name,page_start,page_end,summary?,children?}]}`（页范围＝**PDF 页序**；叶节点常显式带 `children:[]`，空列表不下探层级；`summary` 可选＝该节点介绍，≤1000 字符，**整树重写时未提交该键的节点保持库内原值**、显式提交空串才清空——REQ-114）；**同父级下**同名节点复用 `kp_id`（跨章同名节各自成行——主表该组合只有普通索引，DEFECT-011 裁决）、未复用旧节点删除，其下 point 行不删而归未归档池（`parent_kp_id=NULL`）；写入即视为已确认（主表无人工确认列，进表这一动作承载确认——REQ-118） → `{reused,created,dropped,orphaned_points,book_ref,outline}`；404；422（`book_ref` 空、树空、name 空、页范围非法、层级 >2、同一父级下重名、`summary` 超 1000 字符） |
| `PATCH /learn/knowledge-points/{kp_id}` | 人工面移动、改名与介绍：白名单 `{parent_kp_id,name,order_hint,summary}`（extra 422；`parent_kp_id=null`=移入未归档池；`summary` ≤1000 字符，超限由 pydantic 422；outline 行同样可编辑自身介绍）→ 主表行；404；422（自挂、父非 outline 行、目录成环） |
| `GET /learn/question-books` | 题源书目（R-10 根侧透传 8901 书库＋8900 应用层过滤）：`?course=&role=` → `{course_id,books:[{book_id,title,roles,course_id,parse_status,page_count,parsed_pages}]}`（`roles` 含 `textbook/exercises/solutions` 其一即认＝R-11 宽容读；**课程归属先取书库行 `course_id`，空则回退解析表 `af_books` 同列**——现网书库行该列全空，故过滤在 8900 侧做、不把 `course_id` 传给 8901；`parsed_pages`＝已解析出产物的页数（取 `pages_done`），`parse_status` 由解析侧维护、现网恒 `pending` 只作展示；解析侧离线按空值降级）；422（role 非闭集）、404（课程无坐标行）、503（目录不可达） |
| `POST /learn/questions` | 人工确认后**批量入库** `{course_id,gen_batch?,model_ref?,learn_course_id?,questions:[{stem,kind,question_type,options,expected_answer,keywords,explanation,answer_back,difficulty,kp_type,kp_id?,source_kind,book_ref,source_ref,answer_source}]≥1}` → `{created,skipped_duplicates,gen_batch,model_ref,questions}`；`(course_id,stem_hash)` 命中即跳＝幂等，整批同事务（缝 6）；422（stem 空、闭集越界、quiz 缺 expected_answer、choice 选项非 A/B/C/D 四项、open 缺 keywords、`answer_source=none` 配 quiz＝裁决 ⑨）；503 |
| `GET /learn/questions` | 题库浏览 `?course=&kp=&kind=&question_type=&source_kind=&book=&retired=active\|all\|only&limit=50&offset=0` → `{questions,total}`；**题面投影剔除 `expected_answer`/`keywords`/`explanation`（缝 2）**；422（闭集非法、limit 越界）；503 |
| `PATCH /learn/questions/{question_id}` | 人工面白名单 `{kind,question_type,stem,options,expected_answer,keywords,explanation,answer_back,difficulty,kp_id,answer_source,retired}`（extra 422）→ 题行投影；**裁决 ⑨ 的升级路径＝补 `expected_answer` + `answer_source=manual` + `kind=quiz`**；合并后的题行必须重新通过入库不变量（否则 422）；`gen_batch/model_ref/stem_hash/course_id/created_at` 不在白名单（产出事实不可改）；404 |
| `POST /learn/attempts` | 提交作答 `{question_id,user_answer,origin=new\|review\|manual,review_date?,self_result?}` → **同事务**（缝 6）判分＋作答行＋`score_trend/resolved`＋`schedule_next` 回写 → `{attempt_id,question_id,is_correct,method,judge_note,score_trend,resolved,answered_at,expected_answer,explanation,review:{target_kind,target_id,kp_type,interval_index,due_at,next_due_at}}`（判分依据只在作答响应回传＝缝 2）；422（user_answer 空、origin 非闭集、flashcard 缺 `self_result`）；404（题不存在或已 retired）；409（quiz 传 `self_result`、同 `(question_id,review_date,origin)` 重复作答） |
| `GET /learn/review/due` | 到期队列（`due_at<=now` 且 `status=active`）`?course=&max_tasks=5`（1..100）→ `{course_id,tasks:[{target_kind,target_id,course_id,kp_type,interval_index,due_at,priority,reason:wrong\|type,overdue_days,question}],total_due}`；排序 `(priority,due_at,target_id)`，`total_due`＝截断前全量到期数；422（max_tasks 越界）；503 |
| `GET /learn/mistakes` | 错题本（J5 读时派生，**不建表**）`?course=&kp=&book=&resolved=true\|false\|all&bookmarked=&trend=&limit=50&offset=0` → `{items:[{question(投影),last_attempt,attempt_count,wrong_count,is_correct,resolved,bookmarked,score_trend,due_today}],total,stats:{total,wrong,unresolved,bookmarked,due_today}}`；候选＝有判错作答历史的题，`resolved`/`trend` 作用在最近一次作答行，`bookmarked` 为题下任一收藏行；422（trend/resolved/bookmarked 非闭集）；503 |
| `PATCH /learn/attempts/{attempt_id}` | 错题本人工位白名单 `{bookmarked,resolved}`（extra 422）→ 作答行；`is_correct/method/score_trend/user_answer` 不在白名单（判分结果不可手改）；404；422（空体） |

- 源漂移（drift）：`GET …/units` 读时以「页窗+素材引用」源指纹与上次编译比对，失配时活动
  块行标 `drift=true`（M-2 接线后并入 active_job_id 指纹）。

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
