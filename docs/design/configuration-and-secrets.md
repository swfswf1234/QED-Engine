# 统一配置与密钥规范

设计状态：Draft
实现状态：Current（配置中心已落地，子项目对接未开始）
最后更新：2026-08-04
关联代码：`scripts/load-env.ps1`、根 `.env.example`、`src/qed_engine/`
关联测试：`tests/`（pytest，见[配置中心 API 契约](config-center-api.md)）
关联 ADR：无

## 目的与边界

本标准规定三个项目的 API key 与通用配置如何在根仓库集中管理。根 `.env` 是密钥的唯一事实源，
子项目保持现有配置机制不变，通过环境变量接受根 `.env` 的取值；`scripts/load-env.ps1` 承担
变量映射，是当前"只改根仓库"前提下的对接层。

子项目自身配置细节以其各自 `docs/design/` 为准；本文件只定义跨项目变量与映射。

## 变量总表

### 供应商 API Key（根 `.env` 唯一事实源）

| 变量 | 供应商 | 用途 | 映射到的子项目变量 |
| --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | deepseek | 推理/文本模型：QED-Engine 后端、解析文本模型（预留） | 无（预留） |
| `QWEN_API_KEY` | 阿里百炼 | OCR/视觉模型与百炼调用 | `AXIOM_API_KEY`（Axiom-Flow）、`DASHSCOPE_API_KEY`（QED-Tracker） |
| `GLM_API_KEY` | 智谱 | 备选/未来模型（预留） | 无（预留） |

### 模型选择（每供应商推荐模型）

| 变量 | 用途 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QED_MODEL` | 主对话模型（当前生效档） | `qwen-plus` | 映射：Axiom-Flow/QED-Tracker 文本模型（对接轮启用） |
| `QED_OCR_MODEL` | OCR/视觉模型（当前生效档） | `qwen-vl-plus` | 映射：Axiom-Flow 读 `AXIOM_VISION_MODEL` |
| `QED_EMBEDDING_MODEL` | 嵌入/向量化模型 | `text-embedding-v4` | 三项目检索与知识库共用 |
| `GLM_MODEL` | GLM 对话推荐（切换档） | `glm-5.2` | GLM-5 系列旗舰，1M 上下文 |
| `GLM_OCR_MODEL` | GLM 专用文档 OCR（切换档） | `glm-ocr` | 走文档解析专用接口，Axiom-Flow 对接轮适配 |
| `DEEPSEEK_MODEL` | deepseek 对话推荐（占位档） | `deepseek-v4-flash` | `deepseek-chat` 已退役；key 配置后生效 |

切换策略：测试期用 qwen（三个 `QED_*` 变量）；正式操作期改 `QED_MODEL=glm-5.2`、
`QED_OCR_MODEL=glm-ocr` 即整体切换到 GLM；deepseek 接入仅需补 key。

## 强制规则

- 根 `.env` 是密钥唯一事实源，不入库；根 `.env.example` 入库存模板，只放占位空值。
- 密钥不写入文档、日志、测试输出或提交信息。
- `.env` 中变量为空时，子项目使用自身降级默认值（离线可用），不因缺 key 阻塞启动。
- 环境变量优先级：子项目自身配置（如 QED-Tracker TOML）> 根 `.env` 导出 > 代码默认值。
- `scripts/load-env.ps1` 是当前映射层：读取根 `.env`，导出供应商 key 与模型变量，
  并映射为子项目现状变量名。未来子项目改造为直读新变量后，映射层退役。
- 新增供应商 key 或模型变量时，同步更新本表、`.env.example` 与脚本映射（如适用）。

## 统一配置中心（QED-Engine 后端）

配置中心（`src/qed_engine/`，端口 8900）读取根 `.env`，提供健康检查与模型路由表，**密钥不下发**
（详见[配置中心 API 契约](config-center-api.md)）。子项目获取 key 的路径不变：现状经
`load-env.ps1` 映射，未来改造为直读根 `.env` 变量后映射层退役。中心接口变更不影响子项目启动。

## 执行与验证

- 修改 `.env.example` 或本表后，人工核对变量名一致（脚本 `check-env-consistency` 或人工对照）。
- `load-env.ps1` 变更后，在干净 PowerShell 会话执行一次并确认导出的子项目变量名存在。
- 配置中心变更后：`pytest tests -q` 全绿、`ruff check src tests` 无错误、8900 端口三接口 200。
- 密钥与模型真实可用性：`python scripts/check_api_keys.py`（不打印密钥；glm 429 余额不足属账户状态）。
