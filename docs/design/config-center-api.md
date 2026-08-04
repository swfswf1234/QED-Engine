# 配置中心 API 契约

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-04
关联代码：`src/qed_engine/api/main.py`、`src/qed_engine/api/schemas.py`
关联测试：`tests/test_config.py`、`tests/test_api.py`
关联 ADR：无

## 目的与边界

配置中心是 QED-Engine 后端的最小落地版本：读取根 `.env`，向 QED-Engine 前端与子项目提供
健康检查与模型路由。**密钥绝不下发**——子项目不经过中心获取 key，而是直读根 `.env`（或经
`scripts/load-env.ps1` 映射），中心只回答"用哪个模型、是否已配置"。

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

供应商配置状态（管理界面展示用），只返回布尔，**永不返回密钥值**。

```json
{"deepseek": true, "qwen": false, "glm": false}
```

## 强制规则

- 三个接口任何时刻都必须可用（离线自启动）：缺 `.env` 或 key 为空时按未配置降级，不报错。
- 密钥值不得出现在任何响应体、日志或异常信息中。
- 子项目不依赖本中心获取 key；中心接口变更不影响子项目启动与降级运行。
- CORS 白名单按全局端口规划（ADR 0002）：允许 8900（配置中心自身）、8901（QED-Tracker）、
  8902（Axiom-Flow）、8903（前端）及 8000（Axiom-Flow 迁移前兼容）的 127.0.0.1/localhost
  来源；白名单外来源拒绝预检（400）。

## 验证

- `pytest tests -q` 全绿；`ruff check src tests` 无错误。
- uvicorn 启动后三接口均返回 200。
- `python scripts/check_api_keys.py` 真实调用验证各供应商 key（不打印密钥；
  glm 当前返回 429 余额不足时以智谱账户状态为准，不影响中心降级运行）。
