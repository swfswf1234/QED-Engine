# 配置中心 API 契约

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-05
关联代码：`src/qed_engine/api/main.py`、`src/qed_engine/api/schemas.py`
关联测试：`tests/test_config.py`、`tests/test_api.py`
关联 ADR：无

## 目的与边界

配置中心是 QED-Engine 后端的最小落地版本：读取根 `.env`，向 QED-Engine 前端与子项目提供
健康检查与模型路由。**密钥绝不下发**——子项目不经过中心获取 key，而是直读根 `.env`（或经
`scripts/load-env.ps1` 映射），中心只回答"用哪个模型、是否已配置"。

**8900 角色判定（2026-08-06 架构评审结论：保留）**：浏览器无法直读 `.env` 且密钥不下发，
8900 是 `.env` 的唯一只读语义代理；角色收敛为三——① 配置语义代理（`/config/models` 模型路由表，
前端与子项目「用哪个模型」的答案源）；② 状态探测中心（`/config/llm-status`、`/config/database`
真实可达性探测）；③ 子项目对接契约（未来 Axiom-Flow OCR 多后端 REQ-008 / QED-Tracker 服务化
经 `/config/models` 取路由，不感知密钥）。当前子项目零消费 8900（直读 `.env`），
最小保留面为现有五端点。

## 服务信息

- 服务名：`qed-engine-config`
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

模型路由表：返回各供应商/用途的推荐模型，子项目不感知密钥。`default`/`ocr`/`embedding`
为当前生效档（qwen），`glm`/`glm_ocr` 为切换档（改 `QED_MODEL`/`QED_OCR_MODEL` 两个
变量即整体切换），`deepseek` 为占位档（key 配置后生效）。

```json
{
  "default":   {"model": "qwen-plus",    "provider": "qwen",     "configured": true},
  "ocr":       {"model": "qwen-vl-plus", "provider": "qwen",     "configured": true},
  "embedding": {"model": "text-embedding-v4", "provider": "qwen", "configured": true},
  "glm":       {"model": "glm-5.2",      "provider": "glm",      "configured": true},
  "glm_ocr":   {"model": "glm-ocr",      "provider": "glm",      "configured": true},
  "deepseek":  {"model": "deepseek-v4-flash", "provider": "deepseek", "configured": false}
}
```

- `configured`：对应供应商 key 是否已配置（空值视为未配置），子项目据此决定降级策略。
- 模型名全部来自根 `.env`（见[configuration-and-secrets.md](configuration-and-secrets.md) 变量表）。
- `glm_ocr`（glm-ocr）走智谱文档解析专用接口（布局+文本提取，支持图片/PDF），与
  qwen-vl 的 chat-completions 形态不同，接入适配在 Axiom-Flow 对接轮完成。

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
- 字段变化（如新增库名列表）需同步更新本契约与 `src/qed_engine/api/schemas.py`。

## 强制规则

- 五个接口任何时刻都必须可用（离线自启动）：缺 `.env` 或 key/密码为空时按未配置降级，不报错。
- 密钥值（API key、数据库密码）不得出现在任何响应体、日志或异常信息中。
- 子项目不依赖本中心获取 key；中心接口变更不影响子项目启动与降级运行。
- CORS 白名单按全局端口规划（ADR 0002）：允许 8900（配置中心自身）、8901（QED-Tracker）、
  8902（Axiom-Flow）、8903（前端）及 8000（Axiom-Flow 迁移前兼容）的 127.0.0.1/localhost
  来源；白名单外来源拒绝预检（400）。

## 验证

- `pytest tests -q` 全绿；`ruff check src tests` 无错误。
- uvicorn 启动后五个接口均返回 200（`/config/llm-status` 与 `/config/database` 首次请求
  3-5s 内返回，之后走缓存）。
- `python scripts/check_api_keys.py` 真实调用验证各供应商 key（不打印密钥；
  glm 当前返回 429 余额不足时以智谱账户状态为准，不影响中心降级运行）。
