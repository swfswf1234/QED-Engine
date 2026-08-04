# 任务台账

状态：Current
最后更新：2026-08-04

本文件登记根仓库未关闭任务。详细计划见 [计划索引](../plans/index.md)，已关闭任务见
completed.md（按需创建）。

## 未关闭任务

| 任务 | 类型 | 状态 | 计划 | 备注 |
| --- | --- | --- | --- | --- |
| 三份契约文档评审并转 Accepted | 评审 | 待开始 | — | service-contracts / dataset-conventions / configuration-and-secrets（config-center-api 已 Accepted） |
| 总控制-数据库选择配置 | 实现 | 待开始 | 待写 | QED_DB_* 变量 + 配置中心接口，三项目统一数据库选择 |
| 总控制-管理界面 | 实现 | 待开始 | 待写 | 配置中心可视化（模型/密钥状态），归属 QED-Engine 前端轮 |
| 子项目改造（三项目同步优化）：数据目录指向根 dataset/、直读 QED_ 变量、load-env.ps1 退役 | 实现 | 待开始 | 待写 | 在各子项目仓库内进行，遵守其门禁；配置中心接口已就绪（8900） |
| Axiom-Flow OCR 多后端适配：qwen-vl-plus（现状）→ glm-ocr 文档解析接口 | 实现 | 待开始 | 待写 | 在 Axiom-Flow 仓库内进行；glm-ocr 已登记路由 |
| deepseek 接入（阶段 C）：补 DEEPSEEK_API_KEY 后启用 deepseek-v4-flash 路由 | 实现 | 待开始 | — | 用户付费账户 pro 更新后处理 |

## 已完成任务

| 任务 | 完成日期 | 提交 |
| --- | --- | --- |
| 文档治理体系：文档规范 + docs 骨架 + README + AGENTS.md 总纲 | 2026-08-04 | `ffd6362` |
| 第一轮交付：三份设计文档（Draft）+ .env.example + load-env.ps1（已脚本验证） | 2026-08-04 | `a1d563d` |
| QED-Engine 后端：统一配置中心（根 .env 读取、health/模型路由/供应商状态，TDD 8 测试全绿 + 8900 冒烟） | 2026-08-04 | 本轮提交 |
| 配置中心 v02：每供应商推荐模型路由表（qwen 生效档/GLM 切换档/deepseek 占位档）+ check_api_keys.py（qwen 真实调用通过；glm 429 余额不足待用户充值） | 2026-08-04 | 本轮提交 |

## 规则

- 任务按类型分类（设计/实现/验证/发布），状态只允许 `待开始 / 进行中 / 已完成 / 阻塞`。
- 阻塞必须声明证据、恢复条件和责任位置。
