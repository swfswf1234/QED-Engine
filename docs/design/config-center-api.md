# 配置中心 API 契约

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-16
关联代码：`backend/qed_engine/api/main.py`、`backend/qed_engine/api/schemas.py`、`backend/qed_engine/api/data.py`（8901 客户端与服务控制模块分别归属[服务契约](service-contracts.md)与[服务控制设计](service-control.md)；三域拆分与监控诊断端点见 [backend-domain-split.md](backend-domain-split.md)，实现状态 Not Started）
关联测试：`tests/test_config.py`、`tests/test_api.py`、`tests/test_tracker_client.py`、`tests/test_web.py`
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)、[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)、[ADR 0008](../adr/0008-frontend-react-refactor.md)

## 目的与边界

配置中心是 QED-Engine 后端的最小落地版本：读取根 `.env`，向 QED-Engine 前端与子项目提供
健康检查与模型路由。**密钥绝不下发**——子项目不经过中心获取 key，而是直读根 `.env`（或经
`scripts/load-env.ps1` 映射），中心只回答"用哪个模型、是否已配置"。

**8900 角色（2026-08-06 架构评审 + 2026-08-11 ADR 0007 网关化扩展 + 2026-08-16 前端重构轮）**：
浏览器无法直读 `.env` 且密钥不下发，8900 是 `.env` 的唯一只读语义代理；角色收敛为：
① 配置语义代理（`/config/models` 模型路由表，前端与子项目「用哪个模型」的答案源）；
② 状态探测中心（`/config/llm-status`、`/config/database` 真实可达性探测）；
③ **数据域网关**（ADR 0007：catalogs / resources / tasks 语义 API 归 8900 所有，内部经
TrackerClient 适配 8901，前端唯一入口）；
④ **服务域（控制中心）**（ADR 0007 / ADR 0005：/services 端点族启停托管，契约事实源为
[service-control.md](service-control.md)）；
⑤ **监控与诊断域**（2026-08-16 规划：/logs 日志查看、/monitor/gpu、/monitor/lmstudio、
/monitor/mineru 组件监控、/self-restart 自身重启——支撑前端控制台，见
[backend-domain-split.md](backend-domain-split.md)）。当前子项目零消费 8900（直读 `.env`）。

## 服务信息

- 服务名：`qed-engine-config`（兼容名；FastAPI 标题 QED-Engine Backend）
- 端口：`8900`
- 前缀：`/api/v1`
- 启动（根仓库目录）：`python -m uvicorn qed_engine.api.main:app --host 127.0.0.1 --port 8900`
  （或 `scripts/start-all.ps1` 统一启停）

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

> 说明：该布尔仅表示「key 是否已配置」，**不代表服务可达**。前端横幅不再展示此接口，
> 可达性一律以 `/config/llm-status` 真实探测为准。

### GET /api/v1/config/llm-status

各供应商 **LLM 可达性**（2026-08-05 新增）：对已配置 key 的供应商真实探测 models 列表接口
（免费、无 token 消耗），5s 超时；未配置 key 的供应商不探测。结果缓存 60s。密钥值绝不下发。

```json
{
  "qwen":     {"reachable": true,  "reason": "",         "checked_at": "2026-08-05T16:30:00+00:00"},
  "glm":      {"reachable": false, "reason": "HTTP 401", "checked_at": "2026-08-05T16:30:00+00:00"},
  "deepseek": {"reachable": false, "reason": "未配置",    "checked_at": "2026-08-05T16:30:00+00:00"}
}
```

- `reachable`：经真实 HTTP 探测验证（200 即可达），不得以 key 配置布尔冒充。
- `reason`：不可达原因——`未配置`（不探测）/ `超时` / `HTTP <状态码>` / httpx 异常类名。
- 探测目标：qwen `dashscope.aliyuncs.com/compatible-mode/v1/models`、glm
  `open.bigmodel.cn/api/paas/v4/models`、deepseek `api.deepseek.com/models`。
- 强制规则：密钥只出现在探测请求头，绝不进入响应体/日志/异常信息。

### GET /api/v1/config/database

统一数据库配置与**连接状态**（管理界面展示用；2026-08-04 用户裁决：MySQL 8 新建 `qed` 库，
三项目共用；2026-08-06 增加真实连接探测）。只返回主机/库名等非敏感信息与布尔配置状态，
**密码值绝不下发**。

```json
{
  "host": "127.0.0.1", "port": 3306, "name": "qed", "user": "root",
  "configured": true, "reachable": true, "reason": ""
}
```

- `configured`：`QED_DB_PASSWORD` 是否已配置（空视为未配置），子项目据此决定数据库能力降级。
- `reachable`：**真实连接验证**（pymysql 认证探测，3s 超时、结果缓存 60s），
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

> 三表语义 API（qt_selections / qt_downloads / qt_sources）契约事实源为
> [downloads-three-table-model.md](downloads-three-table-model.md) §3.2，本表登记其 8900 端点。

| 端点 | 语义 | 内部适配 |
| --- | --- | --- |
| `GET /selections?course_id=&status=` | 表1 选课表列表（rejected/superseded 彻底隐藏由上游数据层保证） | TrackerClient.list_selections |
| `GET /selections/{id}` | 表1 套书详情（含表2 册明细） | TrackerClient.get_selection |
| `POST /selections/{id}/confirm` `{"note"}` | 表1 候选→确认入书单 | TrackerClient.confirm_selection |
| `POST /selections/{id}/backup` `{"note"}` | 表1 候选→备选（可转正/放弃） | TrackerClient.backup_selection |
| `POST /selections/{id}/reject` `{"reason","note"}` | 表1 否定（reason 必填 422；终态彻底隐藏） | TrackerClient.reject_selection |
| `POST /selections/{id}/supersede` `{"reason"}` | 表1 confirmed→superseded（被新版本替代） | TrackerClient.supersede_selection |
| `GET /resources/{id}/downloads` | 表2 册级明细（按 selection_id；rejected/failed 默认过滤） | TrackerClient.list_selection_downloads |
| `POST /downloads` `{"selection_id","vol","file_hint"}` | 表2 新建候选册（下载预登记；vol 省略按表1 vols 生成） | TrackerClient.create_download_candidate |
| `POST /downloads/{id}/approve` | 表2 册级验收通过 | TrackerClient.approve_download |
| `POST /downloads/{id}/reject` `{"reason"}` | 表2 册级否定（reason 必填 422，硬删+留痕） | TrackerClient.reject_download |
| `POST /downloads/{id}/register` `{"relative_path"}` | 表2 人工下载登记（candidate→downloaded） | TrackerClient.register_download |
| `GET /downloads/{id}/sources` | 表3 渠道尝试列表（详情弹窗） | TrackerClient.list_download_sources |

**错误映射**：8901 返回 4xx（如 409 状态机冲突）→ 8900 同码透传上游 detail（前端既有 409
处理生效）；8901 连接失败/5xx → 503 + `QED-Tracker 服务不可达：…`（前端据此降级显示，
独立性铁律）。reject 缺 reason 由 8900 校验直接 422，不请求 8901。

## 服务域（/services，ADR 0007 落实 ADR 0005）

`GET /services` 与 `POST /services/{name}/start|stop|restart` 端点族由
[service-control.md](service-control.md) 契约事实源定义（服务注册表/过渡窗口/错误语义），
实现于 `backend/qed_engine/api/service_manager.py`；8903 服务健康面板改经 `GET /services`
获取三服务状态（不再直连 8901/8902 健康端点）。

## 监控与诊断域（2026-08-16 登记，实施后续轮）

支撑前端控制台的组件监控（GPU / LM Studio / mineru / 日志 / 8900 自身重启）。
**本域不在前端重构轮实施**（2026-08-16 用户裁决：本轮只做前端部分，控制台只用既有
端点）；契约先行登记，实施随后端三域拆分轮（[backend-domain-split.md](backend-domain-split.md)）
落地，实现于 `services/log_viewer.py` 与 `services/monitor.py`，路由挂 `api/control.py`。

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
  [configuration-and-secrets.md](configuration-and-secrets.md)，待登记）。

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

- 五端点（配置域）任何时刻都必须可用（离线自启动）：缺 `.env` 或 key/密码为空时按未配置降级，
  不报错。
- 数据域/服务域在 8901/8902 离线时返回 503/409 等明确语义，**不影响配置域五端点**。
- 密钥值（API key、数据库密码）不得出现在任何响应体、日志或异常信息中。
- 子项目不依赖本中心获取 key；中心接口变更不影响子项目启动与降级运行。
- CORS 白名单按全局端口规划（ADR 0002）：允许 8900（配置中心自身）、8901（QED-Tracker）、
  8902（Axiom-Flow）、8903（前端）及 8000（Axiom-Flow 迁移前兼容）的 127.0.0.1/localhost
  来源；白名单外来源拒绝预检（400）。子项目 CORS 收窄为后续可选请求（ADR 0007 决定 6）。

## 验证

- `pytest tests -q` 全绿；`ruff check backend tests` 无错误。
- uvicorn 启动后五个配置域接口均返回 200（`/config/llm-status` 与 `/config/database` 首次请求
  3-5s 内返回，之后走缓存）。
- 8901 在线时 `/catalogs/math-qe`、`/resources` 返回真实数据；8901 离线时返回 503 且配置域
  不受影响（独立性铁律）。
- `python scripts/check_api_keys.py` 真实调用验证各供应商 key（不打印密钥；
  glm 当前返回 429 余额不足时以智谱账户状态为准，不影响中心降级运行）。
