# 管理后台 UI：控制台与模型调用记录（admin-console）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-10-03
确认状态：已确认
关联代码：`web-ui/src/pages/Console.tsx`、`web-ui/src/pages/LlmCalls.tsx`、`web-ui/src/components/GpuOverview.tsx`、`web-ui/src/components/StatusBadge.tsx`、`web-ui/src/components/AdminLayout.tsx`、`web-ui/src/stores/runtime.ts`、`web-ui/src/stores/llmCalls.ts`、`web-ui/src/api/services.ts`、`web-ui/src/api/llm.ts`（后端控制域路由与资源探测见 [api-contracts](../architecture/api-contracts.md)，不重复登记）
关联测试：`web-ui/src/pages/Console.test.tsx`、`web-ui/src/pages/LlmCalls.test.tsx`、`web-ui/src/stores/llmCalls.test.ts`、`web-ui/src/components/GpuOverview.test.tsx`、`web-ui/src/stores/runtime.test.ts`、`tests/test_monitor.py`、`tests/test_llm_endpoints.py`
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0008](../history/adr/v0.1/0008-frontend-react-refactor.md)、[ADR 0017](../adr/0017-design-doc-structure-contract.md)（本文档结构契约与事实源唯一铁律）
关联设计：[service-hosting.md](service-hosting.md)（服务托管）、[local-model-management.md](local-model-management.md)（本地模型生命周期）、[llm-gateway.md](llm-gateway.md)（模型网关/调用记录）、[api-contracts](../architecture/api-contracts.md)（固定 API）
关联计划：[PLAN-046](../history/plans/2026-09/2026-09-16-llm-registry-unification.md)（槽位卡定档来源）；
界面演进经 git 历史与 `history/plans/` 各计划壳追溯

## 1. 定位与目标

本文档定义 QED-Engine 管理后台两份 UI 设计：

1. **控制台**（`#/admin`，AdminLayout 默认首页）：全局总览，两大职责——**服务生命周期
   管理** + **资源监控**，并提供本地模型生命周期的操作入口。
2. **模型调用记录页**（`#/admin/llm-calls`）：`qed_llm_calls` 表的检索与审核界面。

- **目标**：控制中心的「启停托管、资源水位、模型槽位操作、调用审核」全部在一个可操作
  界面完成，且任一依赖离线时界面可降级不白屏；
- **成功标准**：四服务/MySQL/GPU/三模型槽位的当前态与可执行操作在控制台一屏可判；
  调用记录页可按筛选定位任意一次调用并完成判定回写；操作均有防重入与收敛反馈。
- 与仪表盘（Dashboard，只读看板）的区别：控制台含操作按钮（启停/重启/测试/模型操作）。

## 2. 范围与非目标

本档**不**维护以下内容，逐条给出唯一事实源指针（[ADR 0017](../adr/0017-design-doc-structure-contract.md) 事实源唯一铁律）：

| 内容 | 唯一事实源 |
| --- | --- |
| 服务托管细节（注册表/启停单元/生命周期脚本） | [service-hosting.md](service-hosting.md) |
| 模型单活仲裁、启停与选择的后端行为 | [local-model-management.md](local-model-management.md) |
| 网关路由、调用记录表结构与写入方 | [llm-gateway.md](llm-gateway.md) |
| 控制域/网关端点路径与请求/响应形状（本档 §6 只登记消费链路） | [api-contracts.md](../architecture/api-contracts.md) |
| 8903 全局信息架构与视觉基线 | [frontend-architecture.md](../architecture/frontend-architecture.md) |

- 全部数据与操作**一律经 8900 聚合**（ADR 0007）：8901/8902 未启动时前端降级不白屏；
  8900 离线时前端用本地判定 + 错误横幅。

## 3. 三区结构

顺序固定：**服务管理 → 基础设施 → 资源监控（GPU 状态 + 文字/图像/向量三槽位卡）**。

### 3.1 区 1：服务管理（四服务卡，ServiceCard）

| 服务 | name | 端口 | 在线操作 | 离线操作 | 特殊逻辑 |
| --- | --- | --- | --- | --- | --- |
| QED 管理服务 | `config` | 8900 | 仅重启 | — | 重启走 `/self-restart`，不走 `/services` |
| QED-Tracker | `tracker` | 8901 | 启动/停止/重启 | 启动 | — |
| Axiom-Flow | `axiom` | 8902 | 启动/停止/重启 | 启动 | — |
| QED 前端服务 | `web` | 8903 | 重启 | — | **无启动**（前端不可达时启动无意义）；`withWebServiceFallback()` 硬编码兜底 |

每卡：状态徽章（online/offline/starting/stopping）、端口 + PID（离线时显示）、启动时间、
操作按钮（按上表规则动态渲染）。操作后前端轮询 `GET /services` 每 1 秒，最多 15 秒，
直到状态收敛到目标态；收敛判定**只看本单元**（对方服务仍在过渡不挡本服务落定）。

**四服务互不受限（ARCH-041）**：操作互斥按**单元**记账（`pendingOps` 集合，服务单元键
`svc:<name>`），任一单元在飞只挡**同一单元**的重复点击（回 `busy` 提示「该服务上一次操作
仍在收敛中」），跨单元并发启停/重启照常派发——与后端语义一致（`api/control.py` 各单元独立
派发，无跨服务互斥；资源守卫只作用本地模型槽位）。模型槽位单元（`model:<slot>`）按前缀
**整域互斥**（单活仲裁下跨槽并发启停彼此不安全），且服务域与槽位域互不阻塞。

**破坏性操作确认框**（受控 `<Modal>`，标题与确认按钮文案取操作中文名）：正文按操作给专属文案——
`start` 给启动语义（拉起对应端口进程，就绪后转在线）、`stop` 给停止语义（服务不可用、可随时重启）、
`restart` 给重启语义（中断当前运行中的任务），`config` 单元重启给自重启专属提示（约 3 秒自动刷新）。
四段文案互不复用：启动弹窗出现「重启」措辞即为缺陷。

### 3.2 区 2：基础设施（MySQL）

| 组件 | origin 逻辑 | 探针端点 | 测试按钮 |
| --- | --- | --- | --- |
| MySQL | 固定 local | `GET /config/database` | `POST /database/test` |

本期仅探测 + 测试（无启停）。

### 3.3 区 3：资源监控（GpuOverview + SlotCard 槽位卡）

展示 GPU 型号、VRAM 已用/总量、**本地模型显存占用**、**显存大户清单（≥10%）**、利用率、
系统内存已用/总量、VRAM 构成三片饼图（模型占用/其他/空闲，仅颜色图例），总显存 ≥95% 时
卡顶高位提示条。**占用视角是本卡唯一职责**：回答「谁在吃显存」；「在跑的是 API 还是本地」
由槽位卡的「来源」字段承担，本卡不设「当前在跑」行。**无逐任务占比展示**（REQ-038 用户
裁决「颜色图例即可」）。

**显存口径（本机 WDDM 背景）**：

- 指标行（整卡）：`nvidia-smi` **物理驻留口径**（`used`/`total`）。
- 饼图「模型占用/其他」两片的拆分：**PDH 计数器分配口径**（`\GPU Process Memory(*)\Dedicated Usage`，
  任务管理器同源），仅按比例分配到 nvidia-smi 驻留总量上，不改变总量。
- **WSL 容器模型**（如 Docker 内 mineru）：显存走驱动侧驻留，计入总量但**不出现在 PDH
  进程明细**，其占比无法从进程明细拆认，占用行如实标「容器内不可见，计入驱动驻留」（不报假 0）。
- 利用率：`\GPU Engine(*)\Utilization Percentage`（任务管理器同源），响应带 `utilization_source`
  （`pdh` | `nvidia-smi`），不使用 WDDM 下失真的 nvidia-smi 利用率。
- 显存与利用率两计数器合并为**单次** PowerShell `Get-Counter` 调用（PDH 冷启动 ~1.5s/次，
  合并省一次），实现见 `services/monitor.py` `probe_pdh`。
- 进程名：`[Insufficient Permissions]` 经 `resolve_process_name`（tasklist CSV）补全真实名。

饼图分类：模型占用（蓝）/ 其他（灰）/ 空闲（绿）三片聚合，仅颜色图例；「模型占用」片
tooltip 追加在跑身份名。刷新：60 秒自动刷新，操作期间暂停。

**本地模型占用行**（`buildModelShares`）：数据源为 store 既有 `slots` + `/monitor/gpu`
逐进程明细，**零新增请求**。

- 无 `source=local` 且 ready 的槽位（全 API / 未启用）→ **整行不渲染**。
- 宿主可见渠道（`lmstudio` / `llamacpp`）：占用 = `kind=model` 进程明细之和，渲染
  「身份名（GB／占总显存 %）」。
- `docker` 渠道：按上条口径不可见 → 渲染「容器内不可见，计入驱动驻留」。
- 单活仲裁下同时最多一个模型进 GPU，可见合计只记给第一个宿主可见槽位（不重复计）。

**显存大户清单**（`buildHeavyProcesses`）：逐进程占总显存 ≥ `HEAVY_VRAM_SHARE_PCT`（10%）
的应用按占比降序列出「进程名（GB／%）」，名取可执行文件名（`processBasename`，Windows 全
路径与 WSL 路径均可）；**系统进程（dwm 等）照实列，不做白名单过滤**。

**高位提示**（`vramHighWater`）：`memory_used / memory_total ≥ VRAM_HIGH_WATER_PCT`（95%）
时卡顶出 warning 提示条「显存已用 NN%（≥95% 提示线），接近占满」。
**只提示、不做任何自动处置**——不进启停判定、不停服务、无撤下防抖（当次占比即当次结论）。
解析页 ResourceWatch 的「≥95% 弹警告 / <90% 撤下」是另一路带防抖的告警
（见 [parsing-ui.md](parsing-ui.md) §12），两者互不替代。

**模型槽位卡（SlotCard，五字段）**：数据源 `GET /models/{slot}`（SlotStatus，三槽位并行拉取）。

| 字段 | 内容 | 交互 |
| --- | --- | --- |
| **来源** | 本地部署 / API 调用（Select） | `POST /models/{slot}/select {source}` 写运行态，刷新选项 |
| **模型** | 按「来源 × 渠道」过滤的身份（Select，选项带一句话备注） | `POST /models/{slot}/select {model}` 写 `manifest.active`，选中后自动探针 |
| **渠道** | 本地：默认 / LM Studio / Docker / llama.cpp（待上线置灰）；API：直连（只读） | `POST /models/{slot}/select {runtime}` 写运行态 |
| **可用** | 探针自动判定：可用 / 不可用 / 未就绪；右侧「验证」按钮 | `POST /llm/test/{slot}` 真实小调用，反馈成功/失败 + 原因；验证窗口 `TEST_TIMEOUT_MS=60_000`（覆盖「冷启动加载 + 请求层限长生成」最坏耗时，短于启停收敛窗口 `MODEL_POLL_TIMEOUT_MS`） |
| **备注** | 当前身份 `description`（一句话介绍） | — |

| 槽位卡 | slot | 渠道选项（登记可用 → 可选） | 操作 |
| --- | --- | --- | --- |
| 文字模型 | `text` | 默认 / LM Studio / Docker(待上线) / llama.cpp(待上线) | 来源+模型+渠道 + 启停/重启 + 验证 |
| 图像模型 | `vision` | 默认(=Docker) / Docker / LM Studio(待上线) / llama.cpp(待上线) | 同上 |

- **向量槽位（`embedding`）不出卡**：界面只渲染文字/图像两卡；`/models/embedding` 仍随
  `fetchAll` 轮询入 store（`slots.embedding`），验证入口 `POST /llm/test/embedding` 保留在
  store 动作层，不占控制台版面。
- **来源 = local 才渲染**启停/重启按钮（`POST /models/{slot}/{start|stop|restart}`，单活仲裁在
  model_manager，见 [local-model-management.md](local-model-management.md)）；来源 = api 时仅验证。

- **启动受限的显式化（ARCH-040：前端预检 + 确认两段式）**：本地模型单活下，点一个槽位的「启动」
  会静默停掉另一个在跑的本地模型（后端仲裁行为，见 local-model-management.md）。用户裁决
  2026-10-03 取**前端预检 + 确认两段式**把该代价显式化：
  - **预检**＝点「启动」时读 store 现值判**对方槽位**（`text`↔`vision`）是否在跑，
    在跑判据＝`source === 'local' && ready === true`；**不发额外请求**（不用 `slots` 之外的探针）。
  - **受限分支**＝对方在跑时**不直接派发**，先弹既有受控 `<Modal>`（扩展 slot 分支），
    正文＝「受限：本地模型单活，启动本槽位需先停止「<对方槽位>」」；
    确认＝顺序两段派发 `stop`(对方) → `start`(本槽位)，**任一段失败即止并回该段原因**
    （对方停不下来时绝不继续启动，否则又回到静默夺显存）；取消＝一条请求都不发。
  - **非受限分支**＝对方未在跑（含对方来源为 api）维持**单击直发**，不加确认框、不改既有手感。
  - 后端 `ensure_local_ready` 的单活仲裁**不改行为**：保留作 runtime 自动链路兜底与并发竞态兜底，
    前端预检只是显式化，不承担正确性。互斥面按 ARCH-041 单元键：两段各占各的 `model:<slot>` 单元，
    包装动作自身**不占单元键**（否则第二段会被自己的域互斥挡回）。
- 选择（来源/渠道/模型）均写运行态 `manifest.json`（`source`/`runtime`/`active`，重启保留）；
  渠道「待上线」置灰不可选；「默认」= 全局 `QED_API_SELECT` / `QED_LOCAL_RUNTIME` 默认值。

## 4. 模型调用记录页（`#/admin/llm-calls`）

`qed_llm_calls` 表（三项目可写，见 [llm-gateway.md](llm-gateway.md)）
的检索与审核界面；后端契约 `GET /llm/calls` + `PATCH /llm/calls/{id}/review`。

### 4.1 筛选栏

| 筛选项 | 控件 | 说明 |
| --- | --- | --- |
| 日期范围 | RangePicker | `start`/`end`（YYYY-MM-DD） |
| 服务 | Select（可清除） | `qed_engine` / `qed_tracker` / `axiom_flow` |
| 状态 | Select（可清除） | `success` / `error` |
| 模型 | AutoComplete（可输可选） | 候选项为当前已加载记录的 model 去重（最多 10 个），支持关键字过滤 |
| 审核状态 | Select（可清除） | `unreviewed` / `passed` / `rejected` |

「查询」应用草稿筛选并自动回第 1 页；「重置」清空草稿与生效筛选；页头「刷新」按钮带 loading。

### 4.2 表格（9 列 + 展开列）

| 列 | 内容 |
| --- | --- |
| ID / 时间 | 记录主键 / `created_at` |
| service | 调用方标识 |
| 模型 | `provider / model` 复合显示 |
| 模板 | `prompt_template` Tag，空显示 `-` |
| 耗时 | `duration_ms`（ms） |
| 状态 | Tag：成功（绿）/ 失败（红） |
| 审核 | Tag：未审核（默认）/ 通过（绿）/ 驳回（红） |
| 内容预览 | Prompt 的**前两个非空行**（单行 100 字截断），hover 显示前 500 字 |

展开图标置于表格末列；分页 `showTotal` 显示总数。

### 4.3 展开行（详情）

- 元信息行：`task` / `step`（存在才显示）。
- **Prompt / Response 区块**：JSON 可解析则缩进两格美化；超过 500 字或 10 行折叠为前 10 行
  （`…（共 N 行）`尾注）+「展开全部（N 行 / N 字）/ 收起」按钮；区块标题行带**复制全文**按钮
  （复制原文非美化文）。
- 错误区块（`error` 存在时）：红色 pre 展示失败原因。
- 底部操作行：端点、模板元信息 + **审核状态行内变更**（Select 仅提供 通过/驳回，
  经 `PATCH /llm/calls/{id}/review` 即时保存）+ 审核备注展示。

### 4.4 Store 与 API（useLlmCallsStore）

```text
State:  items / total / page / size / loading / error / filters
Actions:
  fetch()      → GET /llm/calls（filters + page/size）
  setFilters() → 更新筛选并回第 1 页
  setPage()    → 翻页后重新 fetch
  reviewItem() → PATCH /llm/calls/{id}/review 后刷新
```

8900 不可达时整页 Alert（提示启动 8900 后刷新），独立于控制台全局错误。

## 5. Store 设计（useRuntimeStore）

```text
State:
  services: ServiceStatus[]        // 4 服务状态数组
  dbStatus: DatabaseStatus | null  // MySQL 探测结果
  gpu: GpuStatus | null            // GPU + 系统内存（含 utilization_source）
  gpuError: string | null
  slots: Record<SlotName, SlotStatus | null>      // text/vision/embedding 三槽位状态
  slotErrors: Record<SlotName, string | null>     // 槽位独立错误
  keys: KeysStatus | null          // 厂商配置 + 运行模式（keys.mode = api|local；resource_guard 单活守卫开关）
  modelsConfig: ModelsConfig | null // 模型注册表运行态（manifest 摘要，PLAN-046）
  loading: boolean                 // fetchAll 防重入旗标（**不**作界面转圈依据，见分批刷新）
  pendingRoutes: RouteKey[]        // 在飞拉取路集合（八路键，逐路落定逐路移除）
  error: string | null             // 全局错误（8900 不可达）
  dbError: string | null
  pendingOps: string[]             // 在飞启停单元键（svc:<name> / model:<slot>），落定即移除
  testing: 'db' | 'text' | 'vision' | 'embedding' | null

Actions:
  fetchAll()        → 8 路并行请求（services/database/gpu/三槽位/keys/modelsConfig），
                      逐路**增量提交**：每路回包即 set 对应字段（快路不被 /monitor/gpu
                      慢探针拖累），失败仅置对应字段错误并保留旧值；keys/modelsConfig
                      失败静默；每路落定同时出 pendingRoutes；全部落定后清 loading
                      （有在飞操作时不覆盖）。防重入＝loading 或任一操作在飞时直接跳过
  fetchGpu()        → 独立 GPU 刷新（60 秒间隔），只标/清 gpu 一路
  fetchSlots()      → 三槽位状态重拉（选择模型/模型操作后刷新），只标/清 slot:* 三路
  operate(name, op) → 服务启停重启 + 轮询收敛（1s × 15）；互斥按单元（svc:<name>），
                      收敛判定只看本单元 → 四服务并发启停互不受限（ARCH-041）
  operateModel(slot, op) → 模型槽位操作 + 收敛轮询（GET /models/{slot}.ready 为目标态）
  startLocalModel(slot, otherSlot) → 受限启动两段式（ARCH-040）：顺序 await
                      operateModel(otherSlot, 'stop') → operateModel(slot, 'start')，
                      前段失败即止并透回原因；包装层不自占 model: 单元键（见 §3.3）；
                      互斥取 model: 前缀整域（跨槽并发不安全），与服务单元互不阻塞
  selectModel(slot, patch) → POST /models/{slot}/select（patch = {source?|runtime?|model?}）+ fetchSlots
  testDatabase() / testText() / testVision() / testEmbedding() → 依赖/槽位测试

**分批刷新（分区级转圈）**：八路拉取各有键（`RouteKey`＝`services | db | gpu | slot:text |
slot:vision | slot:embedding | keys | models`），在飞集合为 `pendingRoutes`，逐路落定逐路清除。
分区归属由 `ZONE_ROUTES` 固定，`isZonePending(pendingRoutes, zone)` 聚合出该分区是否转圈：

| 分区 | 归属路 | 界面表现 |
| --- | --- | --- |
| 服务管理 | `services` | 标题右侧小 Spin |
| 基础设施 | `db` | 同上 |
| 资源监控 | `gpu` + 三槽位 + `keys` + `models` | 同上 |

- 慢路（真机 `/models/vision` ≈1.1s、gpu 探针上限 `GPU_TIMEOUT_MS` 8s）**只让自己分区转圈**，
  已落定分区立即静置；粒度取分区级，不做卡片级。
- 「刷新」按钮不挂全局 `loading`：按钮恒可点，是否叠加拉取由 store 的防重入判定
  （`loading`/`pendingOps` 非空即跳过）。操作收敛轮询期间同样不叠加拉取（原语义保留）。

类型（stores/index.ts）：SlotName = 'text' | 'vision' | 'embedding'；ModelSlot = 'text' | 'vision'；
ModelOp = 'start' | 'stop' | 'restart'；Source = 'api' | 'local'；
SlotStatus { slot; source; channel; runtime?; identity?; model?; provider?; base_url?;
description?; availability?; ready; source_options?; channel_options?;
options: {value,label,description}[]; notes?; error? }
```

错误隔离：全局错误（error）仅 8900 不可达；各依赖独立错误（dbError/gpuError/slotErrors）
独立降级。`withWebServiceFallback()`：8900 离线时 `/services` 缺 `web` 条目时硬编码
注入 8903 "online"，确保前端服务始终可见。

## 6. API 链路（消费要点）

控制域端点路径与请求/响应形状以 [api-contracts.md](../architecture/api-contracts.md) 为
唯一事实源（本档不复制维护）；此处只登记消费链路与节奏：

- **初始加载**：`fetchAll` 并行 8 请求——`/services`、`/config/database`、`/monitor/gpu`、
  `/models/{slot}` ×3、`/config/keys`、`/config/models`；逐路增量提交、per-field 错误独立
  降级（§5）；`/monitor/gpu` 在 8900 侧带 ~10s TTL + **SWR** 缓存（PDH 单次 Get-Counter
  采样下限 ≈2.4s：过期请求立即回旧值并派生**后台单飞**重采，仅进程首采同步），
  合流控制台 60s / 仪表盘 30s / 解析页 ResourceWatch 10s 多轮询器；
- **操作面**：服务启停重启（`/services/{name}/{op}`；8900 自身走 `/self-restart`）、模型槽位
  启停重启（`/models/{slot}/{op}`）与选择（`/models/{slot}/select`）、MySQL 测试
  （`/database/test`）、三槽位验证（`/llm/test/{slot}`）、调用记录检索与审核
  （`/llm/calls`、`/llm/calls/{id}/review`）；启停类操作后 1s×15 轮询收敛，模型操作以
  `ready` 达目标态为收敛判据；
- **请求链路**（全部经 8900，ADR 0007）：

```text
Browser (8903)
  → Vite proxy (/api/v1)
    → Backend (8900)
      ├─ control.py: /services /config/* /monitor/* /self-restart
      ├─ control.py: /database/test /llm/test/* /models/*
      ├─ tracker.py: /knowledge /books（透传 8901）
      └─ axiom.py: /parse-jobs（透传 8902）
```

## 7. 关键组件文件

| 文件 | 职责 |
| --- | --- |
| `web-ui/src/pages/Console.tsx` | 主页面：三区布局 + ServiceCard/SlotCard（五字段：来源/模型/渠道/可用/备注） |
| `web-ui/src/components/GpuOverview.tsx` | 资源监控 GPU 卡：指标行 + 本地模型占用行（buildModelShares）+ 显存大户清单（buildHeavyProcesses）+ ≥95% 高位提示（vramHighWater）+ 三片显存饼图（buildVramSlices，PDH 比例拆分） |
| `web-ui/src/components/StatusBadge.tsx` | 状态徽章 |
| `web-ui/src/components/AdminLayout.tsx` | 管理台骨架，mount 时触发 fetchAll |
| `web-ui/src/stores/runtime.ts` | Zustand store：fetchAll/fetchSlots/operate/operateModel/selectModel/test |
| `web-ui/src/stores/index.ts` | 类型定义（ServiceStatus/GpuStatus/KeysStatus/SlotName/SlotStatus 等） |
| `web-ui/src/api/services.ts` | listServices/operateService/selfRestart |
| `web-ui/src/api/llm.ts` | getKeys/llmTestText/llmTestVision/llmTestEmbedding/databaseTest/operateModel/getSlotStatus/selectSlotModel |
| `web-ui/src/api/client.ts` | 统一 API 客户端（fetch + 超时 + 离线降级） |
| `backend/qed_engine/api/control.py` | 控制域路由（含 /models 端点族） |
| `backend/qed_engine/services/monitor.py` | probe_gpu（PDH 集成）/probe_pdh/resolve_process_name |

## 8. 已知约束与约定

1. **防重入**：`fetchAll` 与操作收敛轮询互斥（`pendingOps` 非空不叠加拉取）；启停操作按
   **单元**互斥（`svc:<name>` 各挡自己、`model:*` 整域互斥），跨单元并发不受限（ARCH-041）；
   `testing` 单标记防止同一测试按钮重复触发。
2. **Modal.confirm 兼容**：React 19 下控制台使用受控 `<Modal>` 替代 `Modal.confirm`。
3. **空态不占位**：未实现的功能不显示占位卡片。
4. **独立性铁律**：8901/8902 离线 → 降级提示不白屏；8900 离线 → 本地判定 + 错误横幅。
5. **GPU 自动刷新**：60 秒间隔，操作期间暂停。
6. **web 服务兜底**：`withWebServiceFallback()` 确保 8903 始终在服务列表中。
7. **口径一致性**：指标行与进程/饼图显存口径不同（物理驻留 vs 分配），利用率必须展示
   `utilization_source` 上下文（WDDM 下 nvidia-smi 利用率失真）。
8. **全部经 8900**（ADR 0007）：前端不直连 8901/8902/本地模型端口/数据库。
9. **维护规则**：端点增删与形状变化先落 [api-contracts.md](../architecture/api-contracts.md)，
   本档 §6 只回核消费链路与收敛节奏是否仍成立。
