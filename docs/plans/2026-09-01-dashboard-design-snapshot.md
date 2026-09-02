# 仪表盘（Dashboard）设计快照

状态：In Progress
最后更新：2026-09-01
任务类型：D
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0007](../history/adr/v0.1/0007-api-only-for-frontend.md)
关联设计：[前端架构](../architecture/frontend-architecture.md)、[数据库总纲](../architecture/database-schema.md)
关联 Tracker：docs/trackers/todo.md
归档判定：用户确认后迁入 design/ 固定文档，计划壳归档

## 目标与成功标准

记录仪表盘界面（`#/admin/dashboard`）的当前确定设计，作为后续 design/ 固定文档的预备。

成功标准：
1. 三卡片结构、聚合逻辑、API 链路完整记录
2. 无歧义：后续 REQ-033 优化可直接引用本文档

## 范围与非目标

**范围**：仪表盘页面的 UI 结构、数据流、Store 设计、聚合函数逻辑。
**非目标**：不涉及代码变更；不涉及其他管理页面；不涉及 REQ-033 优化方案。

## 前置条件

1. 仪表盘页面已实现并运行（`web-ui/src/pages/Dashboard.tsx`，193 行）
2. QED-Tracker 知识/书籍/Catalog 端点已就绪

## 一、定位

- 路由：`#/admin/dashboard`
- 代码注释明确标记：**"过渡形态，整体优化后置 (REQ-033)"**
- 定位：**只读数据看板**——文档下载进度 + 服务在线状态，不含操作按钮
- 与控制台的区别：仪表盘只展示数据，控制台含启停/测试操作

## 二、三卡片结构

### 卡片 1：服务在线

- 展示 4 服务状态徽章（只读）
- 数据来源：`useRuntimeStore.services`（AdminLayout mount 时预取，仪表盘无额外请求）
- 使用 `withWebServiceFallback()` 确保 8903 始终显示
- 组件：`StatusBadge`（绿=online，红=offline，黄=starting/stopping）

### 卡片 2：文档下载进度（核心卡片）

#### 2.1 课程下载完成度饼图（两段式）

| 维度 | 计算逻辑 |
| --- | --- |
| 分母（总课程数） | `catalogTargets` 中唯一 `course_id` 数量 |
| 分子（已完成课程数） | 满足条件的 `course_id` 数：至少 2 套教程的全部书籍 `status=verified` |
| 饼图 | 绿色 slice = 已完成，灰色 slice = 未完成 |
| 标题 | `课程下载完成度 X/Y` |

聚合函数：`buildCourseCompletion(catalogTargets, details)`

#### 2.2 教程下载工作量饼图

| 维度 | 计算逻辑 |
| --- | --- |
| 每个 slice | 一个教程（`knowledge_id`） |
| 值 | 该教程下 `status=downloaded` 或 `verified` 的书籍数 |
| 调色板 | 固定 7 色循环 |

聚合函数：`buildKnowledgeDownloadPie(details)`

#### 2.3 四个统计数字

| 指标 | 计算逻辑 |
| --- | --- |
| 教程数 | `details` 中 `kind=tutorial` 的条目数 |
| 目标书目 | 所有教程下 `books` 的总数 |
| 已下载 | `status=downloaded` 或 `verified` 的书籍数 |
| 已验收 | `status=verified` 的书籍数 |

聚合函数：`buildBookSummary(details)`

#### 2.4 降级态

| 异常场景 | 展示行为 |
| --- | --- |
| 8901 不可达 | 警告横幅 "QED-Tracker 数据不可达" + 错误信息 |
| Catalog 不可达 | 警告横幅 "课程清单不可达"（仅课程完成度图表降级） |
| 空数据 | 提示 "暂无教程数据" |

### 卡片 3：文档解析进度

- 当前占位：信息提示 "解析任务数据源后置"
- 未来接入 Axiom-Flow 的 `/parse-jobs` 端点
- 设计原则：**空态不占位**（未实现时显示简短提示，不占用大量空间）

## 三、Store 设计

### useDashboardStore（Zustand）

```
State:
  knowledge: KnowledgeRecord[]            // 教程列表（/knowledge）
  details: Record<string, KnowledgeDetail> // 教程详情缓存（knowledge_id → detail）
  catalogTargets: CatalogTarget[]          // 课程目录目标（/catalogs/math-qe）
  loading: boolean                         // 刷新按钮状态
  error: string | null                     // 全局错误（8900 不可达）
  dataError: string | null                 // 数据域错误（8901 不可达）
  catalogError: string | null              // 目录错误（catalog 不可达）

Actions:
  fetchAll() → 3 请求编排
```

### 纯聚合函数（dashboard.ts）

| 函数 | 输入 | 输出 | 用途 |
| --- | --- | --- | --- |
| `buildBookSummary(details)` | 所有教程详情 | `{total, downloaded, verified, remaining, tutorials}` | 4 个统计数字 |
| `buildCourseCompletion(catalogTargets, details)` | 目标 + 详情 | `{completed, total}` | 课程完成度饼图 |
| `buildKnowledgeDownloadPie(details)` | 所有教程详情 | `{name, value}[]` | 教程下载饼图 |

### useRuntimeStore（只读）

- 仪表盘仅读取 `services` 字段（AdminLayout 预取）
- 不触发任何额外 API 调用

## 四、API 链路

### 初始加载（fetchAll，3 请求）

| 前端调用 | 后端路由 | 后端服务 | 用途 |
| --- | --- | --- | --- |
| `listKnowledge()` | `GET /knowledge` | 8900 → tracker.py → 8901 | 教程列表 |
| `getKnowledge(id)` ×N | `GET /knowledge/{id}` | 8900 → tracker.py → 8901 | 每个教程的详情+书籍（并行，Promise.allSettled） |
| `listCatalog()` | `GET /catalogs/math-qe` | 8900 → tracker.py → 8901 | 课程目录目标（完成度分母） |

### 请求链路

```
Browser (8903)
  → Vite proxy (/api/v1)
    → Backend (8900)
      → tracker.py (透传)
        → TrackerClient (httpx)
          → QED-Tracker (8901)
            → MySQL (qt_knowledge / qt_books / qt_sources)
```

### 错误处理

| 错误类型 | 处理方式 |
| --- | --- |
| 8900 不可达（`ApiError.kind=offline`） | 全局错误横幅 |
| 8901 不可达（HTTP 503） | `dataError` → 下载卡片降级 |
| 单个 `getKnowledge` 失败 | `Promise.allSettled` 静默跳过（部分降级） |
| Catalog 不可达 | `catalogError` → 仅课程完成度图表告警 |

## 五、关键组件文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `pages/Dashboard.tsx` | 193 | 主页面，3 卡片布局 |
| `pages/Dashboard.test.tsx` | 214 | 页面测试 |
| `stores/dashboard.ts` | 172 | Zustand store + 3 个纯聚合函数 |
| `stores/dashboard.aggregate.test.ts` | 152 | 聚合函数单元测试 |
| `stores/runtime.ts` | 289 | 共享 runtime store（只读 services） |
| `stores/index.ts` | 365 | 类型定义（KnowledgeRecord/BookRecord/CatalogTarget 等） |
| `api/tracker.ts` | 290 | API 客户端：listKnowledge/getKnowledge/listCatalog |
| `api/client.ts` | 135 | 统一 API 客户端 + describeError |
| `components/EChart.tsx` | 39 | ECharts 轻量封装（PieChart） |
| `components/StatusBadge.tsx` | 19 | 状态徽章 |
| `components/AdminLayout.tsx` | 82 | 管理台骨架 |
| `backend/api/tracker.py` | 502 | 后端 tracker 透传路由 |

## 六、核心数据类型

### KnowledgeRecord（教程）

```typescript
interface KnowledgeRecord {
  knowledge_id: string;    // 教程唯一 ID
  domain_id: string;       // 领域 ID
  course_id: string;       // 课程 ID
  kind: string;            // tutorial / other_material
  set_no: string;          // 套标记（1~4=中文套 / en=英文套 / ''=无配套）
  name: string;            // 教程名
  status: string;          // draft / confirmed / completed
  // ... 其他字段
}
```

### BookRecord（书籍）

```typescript
interface BookRecord {
  book_id: string;
  knowledge_id: string;
  kind: string;            // textbook / exercise / supplement / paper / blog / other
  title: string;
  status: string;          // candidate / decided / downloading / downloaded / verified / failed
  // ... 其他字段
}
```

### CatalogTarget（课程目标）

```typescript
interface CatalogTarget {
  id: string;
  course_id: string;       // 课程 ID（用于完成度分母去重）
  course_name: string;
  kind: string;            // book / exercise / supplement
  title: string;
  required: boolean;
  // ... 其他字段
}
```

## 七、已知约束与约定

1. **过渡形态**：当前为最小可用看板，REQ-033 将整体优化
2. **空态不占位**：解析进度卡片仅显示简短提示
3. **独立性铁律**：8901 离线 → 下载卡片降级，不影响服务在线卡片
4. **并行请求容错**：`Promise.allSettled` 确保单个教程失败不阻塞整体
5. **Catalog 独立降级**：目录请求失败只影响课程完成度图表，不影响教程级统计
6. **无操作按钮**：仪表盘纯只读，所有操作在控制台完成

## 验证与验收

1. `cd web-ui && npm test` 通过
2. `cd web-ui && npx tsc --noEmit` 无错
3. 人工验收：8903 打开 `#/admin/dashboard` 检查三卡片渲染、饼图数据、降级态

## 工作项

1. 搜集仪表盘页面源码（Dashboard.tsx / dashboard.ts / tracker.ts）
2. 搜集聚合函数逻辑（buildBookSummary / buildCourseCompletion / buildKnowledgeDownloadPie）
3. 整理三卡片结构、API 链路、Store 设计、降级策略
4. 记录核心数据类型（KnowledgeRecord / BookRecord / CatalogTarget）
5. 用户确认后迁入 design/ 固定文档

## 回滚

不涉及代码变更，无回滚需求。

## 关闭与归档

用户确认后迁入 `design/` 固定文档，计划壳归档至 `history/plans/2026-09/`。
