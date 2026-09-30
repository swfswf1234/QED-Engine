# 学习设计轮 M3·本地模型适配层（local-model-adaptation）

状态：Accepted
任务类型：B
最后更新：2026-09-30
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

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../trackers/todo.md)
`ARCH-027-M3` 行的「成功标准」列，本壳不复制判据条目；判据的验证手段见「验证与验收」节，
执行进展与证据见「过程与证据（滚动）」节。原 G1~G3 判据编号由行内 S2/S3/S4 承接，
行 S1（A-5/A-6 全绿）是关闭范围按 2026-09-29 裁决收窄后的前置；本壳其余章节出现的
G 编号即指对应判据。

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
| A-1 | 本地 binding 能力表：四类后端 `supports_tools:False` 硬编码 + 探测兜底（`capabilities.py:229-256`） | **部分落地 2026-09-28**：硬编码表（local 无工具、JSON 模式三态未知）已入 `local_adapt.capabilities_for`；**启动探测兜底未做**，随 A-2 后置 |
| A-1b | （新，随 A-2）能力探测：启动/首调探 tools、json_mode 写入能力表 | **后置**（2026-09-29 裁决：随 A-2 整块） |
| A-2 | 文本工具协议：禁原生 tool calling，工具调用走文本协议解析回环 | **后置**（2026-09-29 裁决：v1 学习链路走纯结构化 JSON 调用、不经工具回环，整块移出其前置；重启条件＝出现必须工具调用的消费面） |
| A-3 | JSON 容错三件套 + 一次 repair（`utils/json_parser.py`）；不支持 JSON 模式剥 response_format + 运行时拉黑（`capabilities.py:489-535`） | **落地 2026-09-28**：`parse_json_reply`（直解→围栏→最外层切片+宽松修复，`repair` 回调一次，失败抛 `JsonParseError.raw`）+ gateway 注入/剥参数单次重试/进程态拉黑；模型修复调用本体归 A-5 接线 |
| A-4 | thinking/scratchpad 清洗（`llm/utils.py:180-202`） | **落地 2026-09-28**：`scrub_thinking`（成对/未闭合到文末/残缺标签残留）+ `is_reasoning_starved` 饥饿判定预留 A-5 |
| A-4b | （新）工具导出（scratchpad）清洗：工具召回段落割除 | **后置**（2026-09-29 裁决：随 A-2 整块） |
| A-5 | reasoning 预算饥饿降 effort 单次重试（`llm/structured_retry.py`） | 待开始（**M3 剩余两流之一**） |
| A-6 | task model 继承兜底（`model_selection/tasks.py`）：任务未配模型时继承会话模型 | 待开始（**M3 剩余两流之一**） |

## 过程与证据（滚动）

- **2026-09-28 首批（A-1 部分 + A-3 + A-4）落地**：新模块
  `backend/qed_engine/services/llm/local_adapt.py`；全局开关 `QED_LLM_LOCAL_ADAPT`
  （`Settings.qed_llm_local_adapt`，默认 true，false=全部旁路回退现行为，满足回滚铁律）；
  `gateway.call_text` 新增 `response_format='json'` 口径（local 按能力表+拉黑注入、
  `JsonModeUnsupported` 剥参数单次重试并拉黑；api 渠道报错不静默丢弃）；
  `clients.qwen_chat` 新增 `response_format` 透传。验证：`tests/test_llm_local_adapt.py` 18 绿
  （假 client，不触网触库）+ 存量 `test_llm_gateway/clients/registry` + `test_config` 99 绿。
  设计晋升：`llm-gateway.md`「本地模型适配层」节 + 端点行与模块布局、
  `api-contracts.md` `/llm/text` 行、`project-configuration.md` 与 `.env.example` 变量、code-map 三行。
  **未收口项**：A-1 探测兜底（A-1b）、A-2 文本工具协议（含 A-4b 工具导出清洗）、
  A-5（repair 回调接模型修复调用 + 降 effort 重试）、A-6。
- **2026-09-29 用户裁决（两项，M3 剩余收敛为 A-5 + A-6）**：
  ① **`/llm/text` 端点暂不对外暴露 `response_format`**——JSON 模式只作为网关内部
  `call_text` 参数存在（消费面＝主链 M-2 编译管线与 M2 出题管线），HTTP 请求体不加该字段；
  已按裁决回写 `llm-gateway.md` 端点表与适配层节、`api-contracts.md` `/llm/text` 行
  （代码本未暴露，无需改动；`tests/test_llm_local_adapt.py` 全部走网关层，不受影响）。
  ② **A-2 文本工具协议整块后置**——连带 A-1b 能力探测、A-4b 工具导出清洗一并移出当前排期；
  理由＝v1 学习链路调用全部是「一次输入→一段结构化 JSON」，不经工具回环。
  **重启条件**＝出现必须工具调用的消费面（如 M4 问答侧 agent 化）；届时随该需求重新排期，
  不作为 M3 关闭的阻塞项。M3 关闭条件随之收窄＝A-5 + A-6 落地 + G3 真机冒烟（G1 工具段除外）。
- **2026-09-30 台账结构改判（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)）**：
  G1~G3 判据正本移入 todo 行「成功标准」列（承接为行内 S2/S3/S4，行 S1＝收窄后的 A-5/A-6 前置），
  原行内「首批落地／A-2 后置／下一条件」叙述迁入本节；本节标题由「收口记录（滚动）」改为
  「过程与证据（滚动）」，主链壳内对它的引用同步改道。
- **2026-09-30 现状**：A-5/A-6 待开始（M3 剩余两流），G3 真机冒烟未做；A-1b/A-2/A-4b 后置，
  按裁决不阻塞本模块关闭。

## 验证与验收

- A-1~A-6 规则层纯单测（假 transport，不依赖真实模型与网络）；G3 真机冒烟在本地模型下执行并留记录。
- 每流收口：`tests/test_llm_*` 定向 + `tests/contract` 全绿。

## 回滚

纯记录文档；网关代码改动按各自提交独立回滚（能力表开关需可整体关闭回退现行为）。

## 关闭与归档

关闭条件＝G1~G3 验收通过（G1 的文本工具协议段随 A-2 后置不计入本壳关闭，2026-09-29 裁决；
G3 联测项随主链/M2 首个真实调用点收口），由用户裁决收口；
关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-027-M3 行。
