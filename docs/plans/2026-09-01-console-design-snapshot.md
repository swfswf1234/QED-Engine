# 控制台（Console）设计快照

状态：In Progress
最后更新：2026-09-01
任务类型：D
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0007](../history/adr/v0.1/0007-api-only-for-frontend.md)
关联设计：[前端架构](../architecture/frontend-architecture.md)、[服务控制](../design/service-control.md)、[LLM 网关与模型管理](../design/llm-gateway-and-model-management.md)
关联 Tracker：docs/trackers/todo.md
归档判定：用户确认后迁入 design/ 固定文档，计划壳归档

## 目标与成功标准

记录控制台界面（`#/admin`）的当前确定设计，作为后续 design/ 固定文档的预备。

成功标准：
1. 三区块结构、API 链路、组件分工完整记录
2. 无歧义：后续实现或重构可直接引用本文档

## 范围与非目标

**范围**：控制台页面的 UI 结构、数据流、Store 设计、后端路由映射。
**非目标**：不涉及代码变更；不涉及其他管理页面（仪表盘/下载/解析/调用记录）。

## 前置条件

1. 控制台页面已实现并运行（`web-ui/src/pages/Console.tsx`，365 行）
2. 后端控制域路由已实现（`backend/qed_engine/api/control.py`，438 行）

## 一、定位

- 路由：`#/admin`（AdminLayout 默认首页）
- 定位：**全局总览**——服务生命周期管理 + GPU 资源监控 + 依赖组件连通性检测
- 与仪表盘的区别：控制台含操作按钮（启停/重启/测试），仪表盘只读

## 二、三区块结构

### 区块 1：资源总览（GpuOverview）

| 展示项 | 数据源 | 刷新策略 |
| --- | --- | --- |
| GPU 型号 | `GET /monitor/gpu` → `name` | 60 秒自动刷新 |
| VRAM 已用/总量 | `memory_used_mb` / `memory_total_mb` | 同上 |
| 利用率 % | `utilization_percent` | 同上 |
| 系统内存已用/总量 % | `sys_memory_used_mb` / `sys_memory_total_mb` / `sys_memory_percent` | 同上 |
| VRAM 构成饼图 | ECharts pie，按 `GpuProcess.kind` 分类 | 同上 |
| 进程列表 | `processes[]`，模型进程优先，按 friendly name 聚合 | 同上 |

饼图分类规则：
- 模型进程（`kind=model`）：蓝/绿色
- 非模型任务（`kind=other`）：橙色
- 系统/图形：灰色
- 空闲：绿色

告警规则：VRAM ≥ 95% 时显示横幅，列出非模型任务进程。

### 区块 2：服务管理（4 卡片网格）

按端口排序展示 4 个服务：

| 服务 | name | 端口 | 在线操作 | 离线操作 | 特殊逻辑 |
| --- | --- | --- | --- | --- | --- |
| QED 管理服务 | `config` | 8900 | 仅重启 | — | 重启走 `/self-restart`，不走 `/services` |
| QED-Tracker | `tracker` | 8901 | 启动/停止/重启 | 启动 | — |
| Axiom-Flow | `axiom` | 8902 | 启动/停止/重启 | 启动 | — |
| QED 前端服务 | `web` | 8903 | 重启 | 启动 | 无停止按钮；由 `withWebServiceFallback()` 硬编码兜底 |

每张卡片展示：
- 状态徽章（`StatusBadge`：online/offline/starting/stopping）
- 端口 + PID（离线时显示）
- 启动时间（`started_at`）
- 操作按钮（按上述规则动态渲染）

操作后行为：
- 前端轮询 `GET /services` 每 1 秒，最多 15 秒，直到状态收敛到目标态
- 防重入：`operating` 字段锁定，操作期间禁用其他按钮

### 区块 3：依赖组件（3 卡片）

| 组件 | origin 逻辑 | 探针端点 | 测试按钮 |
| --- | --- | --- | --- |
| MySQL | 固定 local | `GET /config/database` | `POST /database/test` |
| 文字模型 | `keys.mode=api` → cloud / `local` → LM Studio | `GET /monitor/lmstudio` | `POST /llm/test/text` |
| 图像模型 | `keys.mode=api` → cloud / `local` → MinerU | `GET /monitor/mineru` | `POST /llm/test/vision` |

mode 切换逻辑（`keys.mode`）：
- `api` 模式：卡片显示云端厂商名，可达性用云端探测结果
- `local` 模式：卡片显示本地服务名（LM Studio / MinerU），可达性用本地探针结果

## 三、Store 设计

### useRuntimeStore（Zustand）

```
State:
  services: ServiceStatus[]       // 4 服务状态数组
  dbStatus: DatabaseStatus | null // MySQL 探测结果
  gpu: GpuStatus | null           // GPU + 系统内存
  gpuError: string | null
  lmstudio: LmStudioStatus | null
  lmstudioError: string | null
  mineru: MineruStatus | null
  mineruError: string | null
  keys: KeysStatus | null         // 厂商配置 + 运行模式
  loading: boolean                // fetchAll 进行中标记
  error: string | null            // 全局错误（8900 不可达）
  dbError: string | null
  operating: string | null        // 当前操作中的服务名
  testing: 'db'|'text'|'vision'|null  // 测试按钮进行中

Actions:
  fetchAll()       → 6 并行请求，per-field 错误降级
  fetchGpu()       → 独立 GPU 刷新（60 秒间隔）
  operate(name, op) → 服务启停重启 + 轮询收敛
  testDatabase()   → MySQL 连通测试
  testText()       → 文字模型测试
  testVision()     → 图像模型测试
```

错误隔离策略：
- 全局错误（`error`）：8900 不可达时设置
- 独立错误（`dbError` / `gpuError` / `lmstudioError` / `mineruError`）：各依赖独立降级

### withWebServiceFallback()

当 8900 离线时，`/services` 响应可能不含 `web` 条目。此函数硬编码注入 8903 "online" 条目，确保前端服务始终可见。

## 四、API 链路

### 初始加载（fetchAll，6 并行）

| 前端调用 | 后端路由 | 方法 | 后端服务 |
| --- | --- | --- | --- |
| `listServices()` | `GET /services` | GET | `service_manager.get_specs()` + `service_status()` |
| `getDatabaseStatus()` | `GET /config/database` | GET | `app.state.db_status`（启动快照） |
| `monitorGpu()` | `GET /monitor/gpu` | GET | `services.monitor.probe_gpu()` + `probe_memory()` |
| `monitorLmstudio()` | `GET /monitor/lmstudio` | POST | `services.monitor.probe_lmstudio()` |
| `monitorMineru()` | `GET /monitor/mineru` | GET | `services.monitor.probe_mineru()` |
| `getKeys()` | `GET /config/keys` | GET | `app.state.settings` |

### 服务操作

| 操作 | 前端调用 | 后端路由 |
| --- | --- | --- |
| 启动/停止/重启 | `operateService(name, op)` | `POST /services/{name}/{start\|stop\|restart}` |
| 8900 自重启 | `selfRestart()` | `POST /self-restart` |

### 依赖测试

| 测试 | 前端调用 | 后端路由 |
| --- | --- | --- |
| MySQL | `databaseTest()` | `POST /database/test` |
| 文字模型 | `llmTestText()` | `POST /llm/test/text` |
| 图像模型 | `llmTestVision()` | `POST /llm/test/vision` |

### 请求链路

```
Browser (8903)
  → Vite proxy (/api/v1)
    → Backend (8900)
      ├─ control.py: /services, /config/*, /monitor/*, /self-restart
      ├─ control.py: /database/test, /llm/test/*
      ├─ tracker.py: /knowledge, /books (透传 8901)
      └─ axiom.py: /parse-jobs (透传 8902)
```

## 五、关键组件文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `pages/Console.tsx` | 365 | 主页面，含 ServiceCard/DependencyCard 内联组件 |
| `pages/Console.test.tsx` | — | 页面测试 |
| `stores/runtime.ts` | 289 | Zustand store：fetchAll/operate/test 逻辑 |
| `stores/index.ts` | 365 | 类型定义（ServiceStatus/GpuStatus/KeysStatus 等） |
| `api/services.ts` | 54 | API 客户端：listServices/operateService/selfRestart |
| `api/llm.ts` | 48 | API 客户端：getKeys/llmTestText/llmTestVision/databaseTest |
| `api/client.ts` | 135 | 统一 API 客户端（fetch 封装 + 超时 + 离线降级） |
| `components/GpuOverview.tsx` | 266 | GPU 总览卡片 + VRAM 饼图 |
| `components/EChart.tsx` | 39 | ECharts 轻量封装 |
| `components/StatusBadge.tsx` | 19 | 状态徽章 |
| `components/AdminLayout.tsx` | 82 | 管理台骨架，mount 时触发 fetchAll |
| `backend/api/control.py` | 438 | 后端控制域全部路由 |
| `backend/api/main.py` | 113 | 后端应用组装 + 路由注册 |

## 六、已知约束与约定

1. **防重入**：`fetchAll` 和 `operate` 检查 `loading`/`operating` 状态，防止重复请求
2. **Modal.confirm 兼容**：React 19 下 `Modal.confirm` 有 bug，控制台使用受控 `<Modal>` 替代
3. **空态不占位**：未实现的功能不显示占位卡片
4. **独立性铁律**：8901/8902 离线 → 降级提示不白屏；8900 离线 → 本地判定 + 错误横幅
5. **GPU 自动刷新**：60 秒间隔，操作期间暂停
6. **web 服务兜底**：`withWebServiceFallback()` 确保 8903 始终在服务列表中

## 验证与验收

1. `cd web-ui && npm test` 通过
2. `cd web-ui && npx tsc --noEmit` 无错
3. 人工验收：8903 打开 `#/admin` 检查三区块渲染、启停反馈、依赖测试

## 工作项

1. 搜集控制台页面源码（Console.tsx / runtime.ts / api/*.ts）
2. 搜集后端控制域路由（control.py）
3. 整理三区块结构、API 链路、Store 设计、组件分工
4. 记录已知约束与约定
5. 用户确认后迁入 design/ 固定文档

## 回滚

不涉及代码变更，无回滚需求。

## 关闭与归档

用户确认后迁入 `design/` 固定文档，计划壳归档至 `history/plans/2026-09/`。
