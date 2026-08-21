# 计划：配置中心 v02——每供应商推荐模型路由 + 密钥真实验证

状态：Current
最后更新：2026-08-04
类型：实现
关联设计：docs/architecture/api-contracts.md、docs/design/configuration-and-secrets.md
关联任务：docs/trackers/todo.md（QED-Engine 后端：统一配置中心）

## 目标

将配置中心 models 接口升级为每供应商推荐模型路由表（qwen 生效档 / GLM 切换档 / deepseek 占位档），
并以真实 API 调用验证各供应商 key。为三项目同步优化（子项目改造）铺路。

## 关键决策（用户拍板）

- GLM_OCR_MODEL 用 `glm-ocr`（专用文档 OCR，走文档解析接口，Axiom-Flow 对接轮适配）。
- 本轮完成后推送 GitHub（远程原仅 initial commit）。
- deepseek 用 `deepseek-v4-flash`（deepseek-chat 已退役），key 后配。

## 任务清单

1. .env / .env.example 新增 GLM_MODEL、GLM_OCR_MODEL、DEEPSEEK_MODEL。
2. TDD：config.py 新字段（qed_model/qed_embedding_model/glm_model/glm_ocr_model/deepseek_model）。
3. TDD：models 接口重构为路由表（default/ocr/embedding/glm/glm_ocr/deepseek）。
4. scripts/check_api_keys.py 真实调用验证（qwen chat/embedding、glm chat；glm-ocr 与 deepseek 跳过）。
5. 冒烟 8900 + 文档同步 + 链接检查 + 提交 + push。

## 验证结果（2026-08-04 实测）

- pytest 8 全绿；ruff clean。
- 8900 冒烟：models 路由表正确（qwen/glm configured=true，deepseek=false）。
- check_api_keys.py：qwen chat/embedding 真实调用 HTTP 200；glm 返回 429「余额不足或无可用资源包，
  请充值」（错误码 1113，属智谱账户状态，待用户处理）。