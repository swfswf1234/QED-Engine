# 学习设计轮 M3·本地模型适配层（local-model-adaptation）

状态：Accepted
任务类型：B
最后更新：2026-09-23
关联 ADR：无新增（重划登记沿用 [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳）
关联设计：[llm-gateway.md](../design/llm-gateway.md)（网关与 registry 地基）、
[local-model-management.md](../design/local-model-management.md)（binding/槽位管理）
关联 Tracker：docs/trackers/todo.md（ARCH-027-M3 任务行；本壳承载原 W5 与判定表 L7 全量）
归档判定：Retain（滚动记录，模块收口时按当时里程碑归档 history/plans/）

> 本壳是学习设计轮 **M3 模块**（本地模型适配层）的唯一固定滚动记录。定位＝学习链路的**地基**：
> 主链编译（M-2）与出题/主观批改（M2）的全部 LLM 调用都要在 Ollama 级本地后端上可靠工作，
> 本壳的开关全绿是它们的验收前置（判定表 L7「证明 Ollama 级后端可行」）。
> 排期范围＝仅根仓库（用户裁决 2026-09-22）。

## 目标与成功标准

**目标**：把 DeepTutor 验证过的本地模型降级组合（L7）移植进 8900 `services/llm/` 网关，
使工具调用、结构化输出与长推理在本地 binding 下不炸。

| # | 标准 | 判据 |
| --- | --- | --- |
| G1 | 能力表 + 降级路径：本地 binding（ollama/lm_studio/vllm/llama_cpp）标记 `supports_tools:False`，走文本工具协议；不支持 JSON 模式→剥 response_format + 运行时拉黑 | 定向单测（假 transport） |
| G2 | 容错三件套：JSON 修复（一次 repair）、thinking/scratchpad 清洗、reasoning 预算饥饿降 effort 单次重试 | 定向单测（坏样本驱动） |
| G3 | 真实冒烟：本地文字模型下编译与出题链路各跑通一例（与主链/M2 联测） | 真机冒烟记录 |

## 范围与非目标

**范围**：`backend/qed_engine/services/llm/` 网关层的能力表、协议降级、JSON 容错、清洗与重试、
task model 继承兜底。

**非目标**：模型注册表/槽位启停本体（ARCH-023 已收口，维持现状）、评测与基准、
任何业务语义（编译/判分规则归主链壳）。

## 前置条件

1. 无排程前置，可立即滚动（原 W5 口径）；地基为 ARCH-023 registry/runtimes（已交付）。
2. G3 联测项需主链 M-2 编译器与 M2 出题管线至少各有一处最小调用点（可先用临时脚本触发）。

## 工作项（滚动登记表）

| 流 | 内容（L7 对照） | 状态 |
| --- | --- | --- |
| A-1 | 本地 binding 能力表：四类后端 `supports_tools:False` 硬编码 + 探测兜底（`capabilities.py:229-256`） | 待开始 |
| A-2 | 文本工具协议：禁原生 tool calling，工具调用走文本协议解析回环 | 待开始 |
| A-3 | JSON 容错三件套 + 一次 repair（`utils/json_parser.py`）；不支持 JSON 模式剥 response_format + 运行时拉黑（`capabilities.py:489-535`） | 待开始 |
| A-4 | thinking/scratchpad 清洗（`llm/utils.py:180-202`） | 待开始 |
| A-5 | reasoning 预算饥饿降 effort 单次重试（`llm/structured_retry.py`） | 待开始 |
| A-6 | task model 继承兜底（`model_selection/tasks.py`）：任务未配模型时继承会话模型 | 待开始 |

## 验证与验收

- A-1~A-6 规则层纯单测（假 transport，不依赖真实模型与网络）；G3 真机冒烟在本地模型下执行并留记录。
- 每流收口：`tests/test_llm_*` 定向 + `tests/contract` 全绿。

## 回滚

纯记录文档；网关代码改动按各自提交独立回滚（能力表开关需可整体关闭回退现行为）。

## 关闭与归档

关闭条件＝G1~G3 验收通过（G3 联测项随主链/M2 首个真实调用点收口），由用户裁决收口；
关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-027-M3 行。
