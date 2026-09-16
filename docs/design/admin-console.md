# 管理后台 UI：控制台与模型调用记录（admin-console）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-10
确认状态：暂定
关联代码：`web-ui/src/pages/Console.tsx`、`web-ui/src/pages/LlmCalls.tsx`、`web-ui/src/components/GpuOverview.tsx`、`web-ui/src/components/StatusBadge.tsx`、`web-ui/src/components/AdminLayout.tsx`、`web-ui/src/stores/runtime.ts`、`web-ui/src/stores/llmCalls.ts`、`web-ui/src/api/services.ts`、`web-ui/src/api/llm.ts`（后端控制域路由与资源探测见 [api-contracts](../architecture/api-contracts.md)，不重复登记）
关联测试：`web-ui/src/pages/Console.test.tsx`、`web-ui/src/pages/LlmCalls.test.tsx`、`web-ui/src/stores/llmCalls.test.ts`、`web-ui/src/components/GpuOverview.test.tsx`、`web-ui/src/stores/runtime.test.ts`、`tests/test_monitor.py`、`tests/test_llm_endpoints.py`
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0008](../history/adr/v0.1/0008-frontend-react-refactor.md)
关联设计：[service-hosting.md](service-hosting.md)（服务托管）、[local-model-management.md](local-model-management.md)（本地模型生命周期）、[llm-gateway.md](llm-gateway.md)（模型网关/调用记录）、[api-contracts](../architecture/api-contracts.md)（固定 API）
关联计划：[2026-09-06-console-refactor](../history/plans/2026-09/2026-09-06-console-refactor.md)（本设计晋升来源）、[2026-08-req060-llm-call-review](../history/plans/2026-08/2026-08-req060-llm-call-review.md)（调用记录页来源）

## 背景与定位

本文件定义 QED-Engine 管理后台两份 UI 设计：

1. **控制台**（`#/admin`，AdminLayout 默认首页）：全局总览，两大职责——**服务生命周期
   管理** + **资源监控**，并提供本地模型生命周期的操作入口。
2. **模型调用记录页**（`#/admin/llm-calls`）：`qed_llm_calls` 表的检索与审核界面
   （REQ-060）。

- 与仪表盘（Dashboard，只读）的区别：控制台含操作按钮（启停/重启/测试/模型操作）。
- 全部数据与操作**一律经 8900 聚合**（ADR 0007）：8901/8902 未启动时前端降级不白屏；
  8900 离线时前端用本地判定 + 错误横幅。
- 服务托管细节（注册表/启停单元/生命周期脚本）归 [service-hosting.md](service-hosting.md)，
  本文件只定义 UI 侧的四区结构、Store、API 链路与资源监控口径。

## 四区结构（2026-09-06 用户裁决）

顺序固定：**服务管理 → 基础设施 → 资源总览 → 本地模型**。

### 区 1：服务管理（四服务卡，ServiceCard）

| 服务 | name | 端口 | 在线操作 | 离线操作 | 特殊逻辑 |
| --- | --- | --- | --- | --- | --- |
| QED 管理服务 | `config` | 8900 | 仅重启 | — | 重启走 `/self-restart`，不走 `/services` |
| QED-Tracker | `tracker` | 8901 | 启动/停止/重启 | 启动 | — |
| Axiom-Flow | `axiom` | 8902 | 启动/停止/重启 | 启动 | — |
| QED 前端服务 | `web` | 8903 | 重启 | — | **无启动**（前端不可达时启动无意义）；`withWebServiceFallback()` 硬编码兜底 |

每卡：状态徽章（online/offline/starting/stopping）、端口 + PID（离线时显示）、启动时间、
操作按钮（按上表规则动态渲染）。操作后前端轮询 `GET /services` 每 1 秒，最多 15 秒，
直到状态收敛到目标态；`operating` 字段防重入，操作期间禁用其他按钮。

### 区 2：基础设施（MySQL）

| 组件 | origin 逻辑 | 探针端点 | 测试按钮 |
| --- | --- | --- | --- |
| MySQL | 固定 local | `GET /config/database` | `POST /database/test` |

本期仅探测 + 测试（无启停）。

### 区 3：资源总览（GpuOverview）

展示 GPU 型号、VRAM 已用/总量、利用率、系统内存已用/总量、VRAM 构成饼图、进程列表。

**显存口径（2026-09-06 用户裁决，本机 WDDM 背景）**：

- 指标行（整卡）：`nvidia-smi` **物理驻留口径**（`used`/`total`）。
- 进程行与饼图：**PDH 计数器分配口径**（`\GPU Process Memory(*)\Dedicated Usage`，任务管理器同源），
  进程显存含真实值，不再出现「占比未知」；进程列表按 friendly name 聚合。
- 利用率：`\GPU Engine(*)\Utilization Percentage`（任务管理器同源），响应带 `utilization_source`
  （`pdh` | `nvidia-smi`），取代 WDDM 下失真的 nvidia-smi 利用率。
- 进程名：`[Insufficient Permissions]` 经 `resolve_process_name`（tasklist CSV）补全真实名。
- **非模型任务聚合**：单项占比 ≤10% 合并为「其他任务」，>10% 单独列示（`OTHER_AGG_THRESHOLD`）。

饼图分类：模型进程（蓝/绿）、非模型任务（橙，含聚合「其他任务」）、系统/图形（灰）、空闲（绿）。
告警：VRAM ≥ 95% 显示横幅并列出非模型任务进程。刷新：60 秒自动刷新，操作期间暂停。

### 区 4：本地模型（ModelCard，文字/图像）

| 模型 | name | 本地服务 | 脚本 | 模式行为 |
| --- | --- | --- | --- | --- |
| 文字模型 | `qwen` | Qwen / llama-server | `scripts/text-model/` | api 模式：仅测试 + 云端厂商名；local：启停/重启/测试 |
| 图像模型 | `mineru` | MinerU | `scripts/image-model/` | 同上 |

每卡：来源（云端厂商/本地服务）、探针结果（可达 + 备注）、**显存摘要**（模型进程 PDH 显存合计）、
测试按钮、操作按钮（按模式渲染）。操作经 `POST /models/{name}/{start|stop|restart}`（8900 聚合，
资源互斥在 model_manager，见 [local-model-management.md](local-model-management.md)）。
api 模式下启停按钮不渲染（只测试）。

## 模型调用记录页（`#/admin/llm-calls`，REQ-060 已实现）

`qed_llm_calls` 表（三项目可写，见 [llm-gateway.md](llm-gateway.md)）
的检索与审核界面；后端契约 `GET /llm/calls` + `PATCH /llm/calls/{id}/review`。

### 筛选栏

| 筛选项 | 控件 | 说明 |
| --- | --- | --- |
| 日期范围 | RangePicker | `start`/`end`（YYYY-MM-DD） |
| 服务 | Select（可清除） | `qed_engine` / `qed_tracker` / `axiom_flow` |
| 状态 | Select（可清除） | `success` / `error` |
| 模型 | AutoComplete（可输可选） | 候选项为当前已加载记录的 model 去重（最多 10 个），支持关键字过滤 |
| 审核状态 | Select（可清除） | `unreviewed` / `passed` / `rejected` |

「查询」应用草稿筛选并自动回第 1 页；「重置」清空草稿与生效筛选；页头「刷新」按钮带 loading。

### 表格（9 列 + 展开列）

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

### 展开行（详情）

- 元信息行：`task` / `step`（存在才显示）。
- **Prompt / Response 区块**：JSON 可解析则缩进两格美化；超过 500 字或 10 行折叠为前 10 行
  （`…（共 N 行）`尾注）+「展开全部（N 行 / N 字）/ 收起」按钮；区块标题行带**复制全文**按钮
  （复制原文非美化文）。折叠阈值 500 字/10 行（2026-08-25 用户反馈：超长单逻辑行折叠展示）。
- 错误区块（`error` 存在时）：红色 pre 展示失败原因。
- 底部操作行：端点、模板元信息 + **审核状态行内变更**（Select 仅提供 通过/驳回，
  经 `PATCH /llm/calls/{id}/review` 即时保存）+ 审核备注展示。

### Store 与 API（useLlmCallsStore）

```text
State:  items / total / page / size / loading / error / filters
Actions:
  fetch()      → GET /llm/calls（filters + page/size）
  setFilters() → 更新筛选并回第 1 页
  setPage()    → 翻页后重新 fetch
  reviewItem() → PATCH /llm/calls/{id}/review 后刷新
```

8900 不可达时整页 Alert（提示启动 8900 后刷新），独立于控制台全局错误。

## Store 设计（useRuntimeStore）

```text
State:
  services: ServiceStatus[]        // 4 服务状态数组
  dbStatus: DatabaseStatus | null  // MySQL 探测结果
  gpu: GpuStatus | null            // GPU + 系统内存（含 utilization_source）
  gpuError: string | null
  qwen: QwenStatus | null      // 文字模型探针
  qwenError: string | null
  mineru: MineruStatus | null      // 图像模型探针
  mineruError: string | null
  keys: KeysStatus | null          // 厂商配置 + 运行模式（keys.mode = api|local）
  loading: boolean                 // fetchAll 进行中标记
  error: string | null             // 全局错误（8900 不可达）
  dbError: string | null
  operating: string | null         // 当前操作（服务名/模型名 + 操作）
  testing: 'db' | 'text' | 'vision' | null

Actions:
  fetchAll()        → 6 并行请求，per-field 错误降级
  fetchGpu()        → 独立 GPU 刷新（60 秒间隔）
  operate(name, op) → 服务启停重启 + 轮询收敛（1s × 15）
  operateModel(name, op) → 模型操作 + 收敛轮询（探针 reachable 为目标态）
  testDatabase() / testText() / testVision() → 依赖测试

类型（stores/index.ts）：ModelName = 'qwen' | 'mineru'；ModelOp = 'start' | 'stop' | 'restart'；
ModelActionResponse { name; op; success; status; reason? }
```

错误隔离：全局错误（error）仅 8900 不可达；各依赖独立错误（dbError/gpuError/qwenError/
mineruError）独立降级。`withWebServiceFallback()`：8900 离线时 `/services` 缺 `web` 条目时硬编码
注入 8903 "online"，确保前端服务始终可见。

## API 链路

### 初始加载（fetchAll，6 并行）

| 前端调用 | 后端路由 | 方法 | 后端服务 |
| --- | --- | --- | --- |
| `listServices()` | `GET /services` | GET | `service_manager.get_specs()` + `service_status()` |
| `getDatabaseStatus()` | `GET /config/database` | GET | `app.state.db_status`（启动快照） |
| `monitorGpu()` | `GET /monitor/gpu` | GET | `monitor.probe_gpu()`（PDH + nvidia-smi）+ `probe_memory()` |
| `monitorQwen()` | `GET /monitor/qwen` | POST | `monitor.probe_qwen()` |
| `monitorMineru()` | `GET /monitor/mineru` | GET | `monitor.probe_mineru()` |
| `getKeys()` | `GET /config/keys` | GET | `app.state.settings` |

### 操作

| 操作 | 前端调用 | 后端路由 |
| --- | --- | --- |
| 服务启动/停止/重启 | `operateService(name, op)` | `POST /services/{name}/{start\|stop\|restart}` |
| 8900 自重启 | `selfRestart()` | `POST /self-restart` |
| 模型启动/停止/重启 | `operateModel(name, op)` | `POST /models/{name}/{start\|stop\|restart}` |
| MySQL 测试 | `databaseTest()` | `POST /database/test` |
| 文字/图像模型测试 | `llmTestText()` / `llmTestVision()` | `POST /llm/test/text`、`POST /llm/test/vision` |

### 请求链路

```text
Browser (8903)
  → Vite proxy (/api/v1)
    → Backend (8900)
      ├─ control.py: /services /config/* /monitor/* /self-restart
      ├─ control.py: /database/test /llm/test/* /models/*
      ├─ tracker.py: /knowledge /books（透传 8901）
      └─ axiom.py: /parse-jobs（透传 8902）
```

## 关键组件文件

| 文件 | 职责 |
| --- | --- |
| `web-ui/src/pages/Console.tsx` | 主页面：四区布局 + ServiceCard/ModelCard |
| `web-ui/src/components/GpuOverview.tsx` | 资源总览卡 + VRAM 饼图 + 非模型聚合（partitionOtherProcs） |
| `web-ui/src/components/StatusBadge.tsx` | 状态徽章 |
| `web-ui/src/components/AdminLayout.tsx` | 管理台骨架，mount 时触发 fetchAll |
| `web-ui/src/stores/runtime.ts` | Zustand store：fetchAll/operate/operateModel/test |
| `web-ui/src/stores/index.ts` | 类型定义（ServiceStatus/GpuStatus/KeysStatus/ModelName 等） |
| `web-ui/src/api/services.ts` | listServices/operateService/selfRestart |
| `web-ui/src/api/llm.ts` | getKeys/llmTestText/llmTestVision/databaseTest/operateModel |
| `web-ui/src/api/client.ts` | 统一 API 客户端（fetch + 超时 + 离线降级） |
| `backend/qed_engine/api/control.py` | 控制域路由（含 /models 端点族） |
| `backend/qed_engine/services/monitor.py` | probe_gpu（PDH 集成）/probe_pdh/resolve_process_name |

## 已知约束与约定

1. **防重入**：`fetchAll`/`operate`/`operateModel`/`testing` 状态互斥，防止重复请求。
2. **Modal.confirm 兼容**：React 19 下控制台使用受控 `<Modal>` 替代 `Modal.confirm`。
3. **空态不占位**：未实现的功能不显示占位卡片。
4. **独立性铁律**：8901/8902 离线 → 降级提示不白屏；8900 离线 → 本地判定 + 错误横幅。
5. **GPU 自动刷新**：60 秒间隔，操作期间暂停。
6. **web 服务兜底**：`withWebServiceFallback()` 确保 8903 始终在服务列表中。
7. **口径一致性**：指标行与进程/饼图显存口径不同（物理驻留 vs 分配），UI 以脚注说明来源；
   利用率必须展示 `utilization_source` 上下文。
8. **全部经 8900**（ADR 0007）：前端不直连 8901/8902/本地模型端口/数据库。

## 设计来源与演进

- 2026-09-01：控制台三区块快照（服务管理/依赖组件/资源总览，[2026-09-01-console-design-snapshot](../history/plans/2026-09/2026-09-01-console-design-snapshot.md)）。
- 2026-09-06：四区重构（服务管理 → 基础设施 → 资源总览 → 本地模型）、PDH 逐进程显存、
  利用率来源切换、非模型聚合、模型卡——见 [2026-09-06-console-refactor](../history/plans/2026-09/2026-09-06-console-refactor.md)。
- 2026-09-10：并入模型调用记录页设计（`#/admin/llm-calls`，REQ-060 实现反提），文件定位
  扩展为「管理后台 UI：控制台与模型调用记录」（REQ-070 文档体系重组轮）。
