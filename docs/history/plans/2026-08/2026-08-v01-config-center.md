# 计划：QED-Engine 配置中心（最小版）

状态：Current
最后更新：2026-08-04
类型：实现
关联设计：docs/architecture/api-contracts.md、docs/design/configuration-and-secrets.md
关联任务：docs/trackers/todo.md（QED-Engine 后端：统一配置中心）

## 目标

在根仓库实现 QED-Engine 配置中心最小版：读取根 .env，提供健康检查与模型路由接口，
密钥不下发，仅本地 .env 读取，离线自启动。

## 范围

- 新包 `qed-engine`（src 布局），Python 3.12，FastAPI + pydantic-settings。
- 接口：`/api/v1/health`、`/api/v1/config/models`、`/api/v1/config/keys`。
- 配置项沿用现有 .env：DEEPSEEK/QWEN/GLM API key（SecretStr）+ QED_OCR_MODEL；解析模型代码默认
  `deepseek-chat`。
- 不含：密钥下发、数据库选择、前端、认证。

## 任务清单

1. pyproject.toml 与包骨架（src/qed_engine/、tests/）。
2. TDD：config 模块（读取/默认/SecretStr/空值降级）。
3. TDD：api 模块（三个接口，注入 Settings 测试）。
4. 门禁：pytest 全绿 + ruff clean。
5. 冒烟：uvicorn 启动，health 实测。
6. 文档同步：../architecture/api-contracts.md（契约）、design index、todo、README 快速开始。
7. 链接验证 + 提交。

## 验证门禁

- `pytest tests -q` 全绿。
- `ruff check src tests` 无错误。
- `uvicorn qed_engine.api.main:app --port 8900` 启动后 `/api/v1/health` 返回 200。
- 三份设计文档与 README 链接检查通过。
