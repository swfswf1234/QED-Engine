# 学习设计轮 M3·本地模型适配层（local-model-adaptation）

状态：Accepted
任务类型：B
最后更新：2026-10-18
关联 ADR：无新增（重划登记沿用 [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳）
关联设计：[llm-gateway.md](../design/llm-gateway.md)（网关与 registry 地基）、
[local-model-management.md](../design/local-model-management.md)（binding/槽位管理）
关联 Tracker：docs/trackers/todo.md（ARCH-027-M3 任务行；本壳承载原 W5 与判定表 L7 全量；2026-10-20 用户裁决把本行归并至[本地模型稳定性轮](2026-09-23-local-model-stability-round.md)节承载，行判据列不改）
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
3. **真机演练窗口前置（2026-10-20 归并裁定）**：行 S4 冒烟依赖 ARCH-028 本轮 W9 显存水位门与 W11 请求侧熔断到位，随其真机演练场同场执行（该壳 W13 归并承接条）。

## 工作项（滚动登记表）

| 流 | 内容（L7 对照） | 状态 |
| --- | --- | --- |
| A-1 | 本地 binding 能力表：四类后端 `supports_tools:False` 硬编码 + 探测兜底（`capabilities.py:229-256`） | **部分落地 2026-09-28**：硬编码表（local 无工具、JSON 模式三态未知）已入 `local_adapt.capabilities_for`；**启动探测兜底未做**，随 A-2 后置 |
| A-1b | （新，随 A-2）能力探测：启动/首调探 tools、json_mode 写入能力表 | **后置**（2026-09-29 裁决：随 A-2 整块） |
| A-2 | 文本工具协议：禁原生 tool calling，工具调用走文本协议解析回环 | **后置**（2026-09-29 裁决：v1 学习链路走纯结构化 JSON 调用、不经工具回环，整块移出其前置；重启条件＝出现必须工具调用的消费面） |
| A-3 | JSON 容错三件套 + 一次 repair（`utils/json_parser.py`）；不支持 JSON 模式剥 response_format + 运行时拉黑（`capabilities.py:489-535`） | **落地 2026-09-28**：`parse_json_reply`（直解→围栏→最外层切片+宽松修复，`repair` 回调一次，失败抛 `JsonParseError.raw`）+ gateway 注入/剥参数单次重试/进程态拉黑；模型修复调用本体归 A-5 接线 |
| A-4 | thinking/scratchpad 清洗（`llm/utils.py:180-202`） | **落地 2026-09-28**：`scrub_thinking`（成对/未闭合到文末/残缺标签残留）+ `is_reasoning_starved` 饥饿判定预留 A-5 |
| A-4b | （新）工具导出（scratchpad）清洗：工具召回段落割除 | **后置**（2026-09-29 裁决：随 A-2 整块） |
| A-5 | reasoning 预算饥饿降 effort 单次重试（落位改为 `gateway.call_text` + `local_adapt`，见过程证据）+ **网关空正文穿透修正**（2026-10-07 论文链取证承接，用户裁决并入本项、不占 DEFECT 编号：local 思考模型正文被截空时不得记 success，须携带 `finish_reason`/思考段供饥饿判定） | **落地 2026-10-07**（J-A5a~d 全绿 ＋ 真机单点取证；行状态 2026-10-18 随 A-6 批补正，此前误挂「待开始」） |
| A-6 | task model 继承兜底（`model_selection/tasks.py`）：任务未配模型时继承会话模型 | **落地 2026-10-18**（用户裁决形态 A＝槽位级继承兜底）：文字槽位在生效 runtime 取不到本地身份引用时不再判解析失败，`model` 留空由网关发现式继承单活 runtime 已加载模型；只覆盖文字槽位，`QED_LLM_LOCAL_ADAPT=false` 回退严格口径。根仓库无「任务级模型配置」面（registry 只有 text/vision/embedding 三槽位），故 L7 的「继承会话模型」落为「继承单活 runtime 已加载模型」 |

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
- **2026-10-07 论文链取证驱动 A-5 范围扩展（用户裁决：并入 A-5，不占 DEFECT 编号）**——现象与正本：[REQ-102 壳](../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md)「过程与证据」2026-10-07 条（8901 经 8900 网关调 local LM Studio `qwen/qwen3.5-9b`，`paper-plan/assess@v1`（prompt 6011/12444 字）两次 101~103s 后正文为空，`qed_llm_calls` 却记 `status=success`；`plan@v2` 同模板一次 23s 出合法 JSON、一次 101s 出空正文）。归因＝`clients._extract_content` 只取 `choices[0].message.content`，`finish_reason` 与 `reasoning_content` 全丢弃，思考段吃满 `max_tokens` 的截断响应在网关侧与正常响应不可分，`call_text` 于是把空正文记成 success 穿透（ARCH-016 的「空串不穿透」防线只覆盖 `success=false` 分支），调用方仅剩「JSON 解析失败」并把渠道误写为百炼。**待用户「开始执行」后按下列判据实施**：
  - J-A5a 规则层红测试先行（假 transport）：`content=""` 且 `finish_reason="length"` → 网关返回 `success=false`、`error` 含 `finish_reason` 与思考截断字样，`qed_llm_calls` 记 `status=error`；`content` 非空但 `finish_reason="length"` 同样按失败返回（截断正文不得作为结构化输入）。
  - J-A5b local 响应保留 `reasoning_content`（网关内部返回面/记录面携带，**不扩 `/llm/text` 对外字段**，遵守 2026-09-29 裁决①同族的端点最小面口径），使 `scrub_thinking`/`is_reasoning_starved` 在「正文空＋思考段在另一字段」形状上可判定（现 `is_reasoning_starved("")` 返回 False，须与新口径一致）。
  - J-A5c 饥饿降 effort 单次重试（`llm/structured_retry.py`）：判定饥饿后按降档参数重试一次，仍失败即报错，不得盲发二次长调用（本次 2×101s 空耗为反面证据）。
  - J-A5d `QED_LLM_LOCAL_ADAPT=false` 时其余适配按现行为回退，但**空正文仍不得记 success**（正确性修复不受适配开关旁路）。
  真机面：G3 冒烟须覆盖论文评分载荷（`paper-plan/assess`）或明确记录本地档不可用。
  **2026-10-07 用户裁决（两项）**：① 本项缺陷**并入 A-5 承接、不占 DEFECT 编号**；② 渠道＝**local 优先**（api 可切但 `qwen-plus` 无额度），本轮按裁决启动 local 重试 W5 端到端，A-5 代码改动待用户「开始执行」后再动。
- **2026-10-07 A-5 落地（用户裁决「先执行 A-5」，TDD 先红后绿）**：J-A5a~d 全部实现。
  - **落位偏差**（判据原文写 `llm/structured_retry.py`）：降档重试内联在 `gateway.call_text`，判定与饥饿口径落在 `local_adapt.classify_reply` / `is_starved_reply`，不新建模块——理由＝重试仅一次且与判定共用同一返回面，独立模块只会做透传不承载规则；判据的「单次、不得盲发二次长调用」语义完整保留。
  - `clients.py`：新增 `ChatReply(str)`（正文仍是 str 本体，附带 `finish_reason` / `reasoning_content`），`qwen_chat` 与 `provider_text_chat` 统一经 `_extract_reply` 返回（vision 仍用 `_extract_content`）；`qwen_chat` 增 `reasoning_effort` 参数，None 时不进请求体。
  - `local_adapt.py`：`is_reasoning_starved(reply, reasoning="")` 改形（空正文＋思考段在独立字段 → True，修掉旧 `is_reasoning_starved("")` 恒 False）；新增 `classify_reply()`（截断/空正文/全思考三段判据）与 `is_starved_reply()`。
  - `gateway.py`：local 与 api 两渠道都在记 success **之前**过判定，命中即抛 `模型响应不可用：<判据>` → 走既有异常分支落 `qed_llm_calls`（`status=error`、`provider=gateway`、`error` 带截断字样）；正文饥饿且开关开启时按 `reasoning_effort` **单次降档重试**（截断正文非空不追发）；判定不受 `QED_LLM_LOCAL_ADAPT` 旁路（J-A5d），`/llm/text` 对外字段不扩、`finish_reason`/`reasoning` 只在网关内部返回面（J-A5b）。
  - **降档档位实测取 `none`（非 `low`）**——真机 A/B（`tmp/w5_probe_effort_ab.py`，`qwen/qwen3.5-9b`，同一短问题、`max_tokens=1024`）：不带头 → `finish=length`、正文 0、思考 3687 字；`low` → `finish=length`、正文 0、思考 3431 字（**该档不降思考段**）；`none` → `finish=stop`、正文 68 字、思考 0。J-A5c 只约束「按降档参数重试一次」不锁值，故实现取 `none`，设计与映射同步（`llm-gateway.md` A-5 条、`code-map.md` gateway 行）。
  - **真机单点达成 J-A5a**（`tmp/w5_probe_a5_tiny.py`，经 8900 `/llm/text`、`max_tokens=8` 逼迫截断）：HTTP 200 + `{"success": false, "error": "模型响应不可用：思考截断致正文为空（finish_reason=length）"}`，`qed_llm_calls` 行 85 记 `status=error`＝空正文不再穿透。同时纠正一条旧的错误归因：10-07 重启后「网关无调用记录」不是写库降级，而是那四条 `/llm/text 200 OK` 属重启前的行 81–84，重启窗口内 8901 的请求根本没到 8900（当日即据此追出 2026-10-09 的系统代理劫持结论，见 [REQ-102 壳](../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md)）。
  - **门禁**：`pytest tests/contract tests/test_llm_local_adapt.py tests/test_llm_clients.py tests/test_llm_gateway.py tests/test_llm_endpoints.py tests/test_llm_call_log.py -q` → **201 passed**；`ruff check backend tests` → All checks passed。文档晋升＝`llm-gateway.md`「本地模型适配层」节标题改 A-1/A-3/A-4/A-5 + 新增 A-5 条、`code-map.md` 四行（gateway / clients / local_adapt + `test_llm_local_adapt.py` / `test_llm_clients.py` 概述）。
  - **仍开**：G3 真机冒烟的论文评分载荷面（`paper-plan/assess`）——10-09 复跑受阻于对方侧系统代理劫持 loopback（同上壳），A-5 自身判据已达成；A-6 未动。

- **2026-10-18 A-6 落地（用户裁决形态 A，TDD 先红后绿）**：
  - **形态取由**：用户裁决取 **A＝槽位级继承兜底**。判据＝根仓库没有「任务级模型」配置面
    （`registry` 只有 text/vision/embedding 三槽位，调用方不传模型），要按 L7 原文的「任务未配模型」
    一比一移植须先新建任务×模型映射，属扩面、与 2026-09-29「M3 剩余＝A-5＋A-6」裁决冲突；
    在本仓库里唯一等价的「会话模型」＝**单活 runtime 当前已加载模型**（显存互斥下同时只有一个
    本地模型在跑），故继承落在解析层。
  - **红→绿**：先写 4 例（`tests/test_llm_registry.py` J-A6a 继承态解析／J-A6b 运行态身份整体无本地引用
    同样继承且不影响 embedding／J-A6c 图像槽位不适用仍严格报错；`tests/test_llm_gateway.py` J-A6d 网关按
    发现式交接、记录 provider=runtime ＋ model 空）→ 首跑 **3 failed / 58 passed**（J-A6c 与开关关闭两例
    本就守护旧口径，天然绿）；实现只改 `registry._resolve_local` 的 `binding is None` 分支（新增文字槽位
    继承返回）→ llm 七文件定向 **213 passed**。
  - **口径改判登记**：原 `test_resolve_local_text_docker_runtime_error`（文字 × docker 必失败）改判为
    `QED_LLM_LOCAL_ADAPT=false` 时的回退面，改名 `..._when_adapt_off`；旧文案「文字槽位解析失败」保留为
    开关关闭态行为，由新增的 `test_call_text_local_unbound_fails_when_adapt_off` 守护。
  - **落位说明**（对照 L7 原文「继承会话模型」）：继承发生在解析层而非调用参数层——`resolved.model`
    留空即命中 `clients.qwen_chat` 既有的 `/v1/models` 发现式分支（该分支在册守护用例＝
    `tests/test_llm_clients.py::test_qwen_chat_uses_first_loaded_model`），因此 gateway／clients／model_manager 零逻辑改动，
    仅 `gateway.py` 一行注释补注。`ensure_local_ready` 在绑定缺失时仍只记 log 不启动（无引用可加载），
    端点上一个模型都没有时由 clients 抛「Qwen 未加载任何模型（请先加载 qwen 模型）」，失败文案仍可行动。
  - **已知表现差（按范围锁死不扩面）**：继承态 `GET /models/text` 的 `model` 为空串、`ready=False` →
    控制台槽位卡「可用性」显示**未就绪**（绑定探针无对象，属设计内）。继承标注走 `Resolved.notes` →
    `SlotStatus.notes`（既有字段，不动端点契约）已透出到响应；但控制台备注行取数优先序为
    `description ‖ error ‖ notes`，身份自带备注时继承标注被 description 遮住、不单独成行。把继承态
    在 UI 上显式区分属前端展示变更，本轮不采，若人工验收认为需要可见再另行立项。
  - **文档随步**：`llm-gateway.md`「本地模型适配层」节标题改 A-1/A-3/A-4/A-5/A-6 ＋ 新增 A-6 条 ＋
    解析规则第 3 条补文字/图像分岔与回归归属；`code-map.md` registry 行与 gateway 行各补 A-6 注；
    `project-configuration.md` 的 `QED_LLM_LOCAL_ADAPT` 行补继承兜底口径。
  - **门禁**：llm 七文件定向 **213 passed**；全量 `pytest tests` **819 passed**（＝本批前基线 814
    ＋ A-6 新增 5 例）；`ruff check backend tests` All checks passed。中途 `tests/contract` 一度三红
    （死链／todo↔plan 镜像／文档锚各中一次），归因＝并行会话把 REQ-118 的壳
    `2026-10-15-shared-tables-field-freeze.md` 归档进 `history/plans/2026-10/` 后其 todo 行仍指向
    `../plans/`，与本批无交集；该会话随后改掉行指向，复跑即全绿。
  - **M3 剩余**：行 S1（A-5＋A-6 落地且开关全绿）达成；S4 真机冒烟（local 下出题与判分链路各跑通一次、
    一键回退可验证）仍待主链 M-2 编译管线与 M2 出题管线的首个真实调用点，本壳不关闭。

- **2026-10-20 承载关系改判（归并不删壳，ADR 0021）**：用户裁决把本行与本地模型稳定性轮（ARCH-028）结合，评估后**不新立「本地模型优化轮」**，改为把本行自 todo「学习设计轮」节移入「本地模型稳定性轮（ARCH-028）」节，剩余 S4 真机冒烟随该轮演练场同场执行（该壳新增 W13 归并承接条）。本行「成功标准」列 S1~S4 **一字未改**；本壳判据、关闭条件与 A-2 后置裁决均不变。ARCH-027 行 S5「M-1/M-2/M-3 三子壳各自收口」的读法不受影响——本壳仍须自行收口，只是排期场域换到 ARCH-028 演练窗。取证与裁定正文见[集群总纲](2026-10-20-doc-knowledge-cluster-master-outline.md)「附」节。

## 验证与验收

- A-1~A-6 规则层纯单测（假 transport，不依赖真实模型与网络）；G3 真机冒烟在本地模型下执行并留记录。
- 每流收口：`tests/test_llm_*` 定向 + `tests/contract` 全绿。

## 回滚

纯记录文档；网关代码改动按各自提交独立回滚（能力表开关需可整体关闭回退现行为）。

## 关闭与归档

关闭条件＝G1~G3 验收通过（G1 的文本工具协议段随 A-2 后置不计入本壳关闭，2026-09-29 裁决；
G3 联测项随主链/M2 首个真实调用点收口），由用户裁决收口；
关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-027-M3 行（该行现挂本地模型稳定性轮 ARCH-028 节，2026-10-20 归并裁定）。
