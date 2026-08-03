# 统一配置与密钥规范

设计状态：Draft
实现状态：Not Started
最后更新：2026-08-04
关联代码：`scripts/load-env.ps1`、根 `.env.example`
关联测试：无（脚本由人工验证）
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

### 模型选择

| 变量 | 用途 | 默认值 | 映射到的子项目变量 |
| --- | --- | --- | --- |
| `QED_OCR_MODEL` | 统一指定 OCR/视觉模型，子项目不硬编码 | `qwen-vl-ocr` | `AXIOM_VISION_MODEL`（Axiom-Flow） |

## 强制规则

- 根 `.env` 是密钥唯一事实源，不入库；根 `.env.example` 入库存模板，只放占位空值。
- 密钥不写入文档、日志、测试输出或提交信息。
- `.env` 中变量为空时，子项目使用自身降级默认值（离线可用），不因缺 key 阻塞启动。
- 环境变量优先级：子项目自身配置（如 QED-Tracker TOML）> 根 `.env` 导出 > 代码默认值。
- `scripts/load-env.ps1` 是当前映射层：读取根 `.env`，导出供应商 key 与 `QED_OCR_MODEL`，
  并映射为子项目现状变量名。未来子项目改造为直读新变量后，映射层退役。
- 新增供应商 key 或模型变量时，同步更新本表、`.env.example` 与脚本映射。

## 执行与验证

- 修改 `.env.example` 或本表后，人工核对变量名一致（脚本 `check-env-consistency` 或人工对照）。
- `load-env.ps1` 变更后，在干净 PowerShell 会话执行一次并确认导出的子项目变量名存在。
