# 管理后台仪表盘设计（admin-dashboard）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-10
确认状态：暂定
关联代码：`web-ui/src/pages/Dashboard.tsx`、`web-ui/src/stores/dashboard.ts`、`web-ui/src/components/EChart.tsx`、`web-ui/src/stores/runtime.ts`（后端透传端点见 [api-contracts](../architecture/api-contracts.md)，不重复登记）
关联测试：`web-ui/src/pages/Dashboard.test.tsx`、`web-ui/src/stores/dashboard.aggregate.test.ts`
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)
关联设计：[前端架构](../architecture/frontend-architecture.md)、[数据库总纲](../architecture/database-design.md)
来源：[仪表盘（Dashboard）设计快照](../history/plans/2026-09/2026-09-01-dashboard-design-snapshot.md)（2026-09-07 晋升）

## 目标与成功标准

记录仪表盘界面（`#/admin/dashboard`）的当前确定设计。
2026-09-07 用户裁决：文档下载进度重构为**三行图表 + 四统计数字**。

成功标准：
1. 服务在线情况 + 统计数字 + 三行图表（领域/课程/书籍）结构完整记录
2. 无歧义：后续 REQ-033 优化可直接引用本文档

## 范围与非目标

**范围**：仪表盘页面的 UI 结构、数据流、Store 设计、聚合函数逻辑。
**非目标**：不涉及代码变更；不涉及其他管理页面；不涉及 REQ-033 优化方案。

## 一、定位

- 路由：`#/admin/dashboard`
- 代码注释明确标记：**"过渡形态，整体优化后置 (REQ-033)"**
- 定位：**只读数据看板**——服务在线情况 + 统计数字 + 三行图表，不含操作按钮
- 与控制台的区别：仪表盘只展示数据，控制台含启停/测试操作

## 二、布局结构（2026-09-07）

### 区域 1：服务在线情况

- 标题：`服务在线情况`
- 展示 4 服务状态徽章（只读）
- 数据来源：`useRuntimeStore.services`（AdminLayout mount 时预取，仪表盘无额外请求）
- 使用 `withWebServiceFallback()` 确保 8903 始终显示
- 组件：`StatusBadge`（绿=online，红=offline，黄=starting/stopping）

### 区域 1.5：统计数字

- 位于服务在线情况之后、领域探索进度之前
- 四列横向排列：

| 指标 | 计算逻辑 |
| --- | --- |
| 已探明领域数 | `exploration_stage !== '未开始'` 的领域数 |
| 课程数 | 所有领域下课程总数 |
| 书籍卷数 | 所有教程详情中的 `books[]` 总数（去重） |
| 验收书目数 | `holding === 'owned'` 的书籍数 |

### 区域 2：领域探索进度（第一行，聚合单饼图）

- 单个饼图聚合所有领域
- 数据来源：`GET /courses` → `DomainSystem[]`
- 饼图状态（3 态）：

| 状态 | 颜色 | 计算逻辑 |
| --- | --- | --- |
| 新建 | 灰色 #d9d9d9 | `exploration_stage === '未开始'` |
| 探索中 | 绿色 #52c41a | `exploration_stage in ['已生成', '探索中', '待确认']` |
| 完成 | 蓝色 #1677ff | `exploration_stage === '已完成'` |

- 标题：`领域探索进度`（左对齐）
- 饼图位置偏左：`center: ['30%', '52%']`
- 聚合函数：`buildDomainProgress(courseSystem)` → `DownloadSlice[]`

### 区域 3：课程进度（第二行，按领域分组）

- 每个领域一张饼图卡片，最多 3 个并排，超过换行；无课程的领域不展示
- 数据来源：`GET /courses` → 每个领域的 `courses[]` + 书籍状态
- 饼图状态（4 态）：

| 状态 | 颜色 | 计算逻辑 |
| --- | --- | --- |
| 探索中 | 灰色 #d9d9d9 | `course.exploration_stage !== '已完成'` |
| 探索完成 | 绿色 #52c41a | `exploration_stage === '已完成'` 且该课程下无 owned 书籍 |
| 下载中 | 橙色 #faad14 | `exploration_stage === '已完成'` 且该课程下有 owned 书籍但非全部 |
| 完成 | 蓝色 #1677ff | `exploration_stage === '已完成'` 且该课程下所有已决定书籍均为 owned |

- 标题：仅显示领域名（如"数学"），不加后缀
- 聚合函数：`buildCourseProgress(courseSystem, details)` → `DomainCoursesSlice`

### 区域 4：文档下载进度（第三行，按领域分组）

- 每个领域一张饼图卡片，按 3 列换行
- 数据来源：`knowledge` details 中的 `books[]`，按 `domain_id` 分组
- 饼图状态（**5 态**，对齐书籍生命周期 QED-060，与 `downloads-ui.md` §3.2 筛选档一致）：

| 状态 | 颜色 | 计算逻辑 |
| --- | --- | --- |
| 未开始 | 灰色 #d9d9d9 | `status === 'candidate'` |
| 下载中 | 橙色 #faad14 | `status in ('decided', 'downloading')` |
| 待验证 | 青色 #13c2c2 | `status === 'downloaded'` |
| 完成 | 蓝色 #1677ff | `status === 'verified'` |
| 失败 | 红色 #ff4d4f | `status === 'failed'` |

`parallel` 与 `retired` 不计入下载进度（`parallel` 为平行读物、`retired` 为退役留痕）。

- 标题：仅显示领域名（如"数学"），不加后缀
- 聚合函数：`buildBookDownloadProgress(courseSystem, details)` → `DomainCoursesSlice`

### 降级态

| 异常场景 | 展示行为 |
| --- | --- |
| 8901 不可达 | 警告横幅 "QED-Tracker 数据不可达" + 错误信息 |
| Courses 不可达 | 警告横幅 "课程体系不可达"（三行图表降级） |
| 空数据 | 提示 "暂无数据" |

## 三、Store 设计

### useDashboardStore（Zustand）

```
State:
  knowledge: KnowledgeRecord[]            // 教程列表（/knowledge）
  details: Record<string, KnowledgeDetail> // 教程详情缓存（knowledge_id → detail）
  courseSystem: DomainSystem[]             // 领域课程体系（/courses）
  loading: boolean                         // 刷新按钮状态
  error: string | null                     // 全局错误（8900 不可达）
  dataError: string | null                 // 数据域错误（8901 不可达）
  courseError: string | null               // 课程体系错误（courses 不可达）

Actions:
  fetchAll() → 3 请求编排（knowledge + knowledge/{id} × N + courses）
```

### 纯聚合函数（dashboard.ts）

| 函数 | 输入 | 输出 | 用途 |
| --- | --- | --- | --- |
| `buildDomainProgress(courseSystem)` | 领域课程体系 | `DownloadSlice[]` | 领域探索进度饼图（聚合单饼图） |
| `buildCourseProgress(courseSystem, details)` | 领域课程体系 + 教程详情 | `DomainCoursesSlice` | 课程进度饼图（按领域分组） |
| `buildBookDownloadProgress(courseSystem, details)` | 领域课程体系 + 教程详情 | `DomainCoursesSlice` | 文档下载进度饼图（按领域分组） |
| `buildDashboardStats(courseSystem, details)` | 领域课程体系 + 教程详情 | `DashboardStats` | 4 个统计数字 |

### useRuntimeStore（只读）

- 仪表盘仅读取 `services` 字段（AdminLayout 预取）
- 不触发任何额外 API 调用

## 四、API 链路

### 初始加载（fetchAll，3 请求）

| 前端调用 | 后端路由 | 后端服务 | 用途 |
| --- | --- | --- | --- |
| `listKnowledge()` | `GET /knowledge` | 8900 → tracker.py → 8901 | 教程列表 |
| `getKnowledge(id)` ×N | `GET /knowledge/{id}` | 8900 → tracker.py → 8901 | 每个教程的详情+书籍（并行，Promise.allSettled） |
| `listCourseSystem()` | `GET /courses` | 8900 → tracker.py → 8901 | 领域课程体系（领域/课程/探索状态） |

### 域归属链路

```
books[] (from knowledge details)
  → knowledge.course_id
    → courseSystem[domain].courses[course]
      → domain_id (从 DomainSystem 嵌套结构反查)
```

### 请求链路

```
Browser (8903)
  → Vite proxy (/api/v1)
    → Backend (8900)
      → tracker.py (透传)
        → TrackerClient (httpx)
          → QED-Tracker (8901)
            → MySQL (qed_domain / qed_course / qt_knowledge / qt_books)
```

### 错误处理

| 错误类型 | 处理方式 |
| --- | --- |
| 8900 不可达（`ApiError.kind=offline`） | 全局错误横幅 |
| 8901 不可达（HTTP 503） | `dataError` → 下载卡片降级 |
| 单个 `getKnowledge` 失败 | `Promise.allSettled` 静默跳过（部分降级） |
| Courses 不可达 | `courseError` → 三行图表全部降级 |

## 五、关键组件文件

| 文件 | 职责 |
| --- | --- |
| `pages/Dashboard.tsx` | 主页面，服务在线情况 + 统计数字 + 三行图表 |
| `pages/Dashboard.test.tsx` | 页面测试 |
| `stores/dashboard.ts` | Zustand store + 4 个纯聚合函数 |
| `stores/dashboard.aggregate.test.ts` | 聚合函数单元测试 |
| `stores/runtime.ts` | 共享 runtime store（只读 services） |
| `stores/index.ts` | 类型定义（DomainSystem/BookRecord 等） |
| `api/tracker.ts` | API 客户端：listKnowledge/getKnowledge/listCourseSystem |
| `api/client.ts` | 统一 API 客户端 + describeError |
| `components/EChart.tsx` | ECharts 轻量封装（PieChart） |
| `components/StatusBadge.tsx` | 状态徽章 |
| `components/AdminLayout.tsx` | 管理台骨架 |

## 六、核心数据类型

### BookRecord（对齐 qt_books 书库化重构 QED-050-D）

```typescript
interface BookRecord {
  book_id: string;
  title: string;
  original_title: string | null;  // 外文原版书名
  part: string;                    // 卷标识
  authors: Array<{name: string; role: string}>;
  publisher: string;
  edition: string;
  year: number | null;
  language: string;                // zh / en
  roles: string[];                 // textbook / exercises / solutions
  status: string;                  // 选用 decided/parallel/candidate/retired + 生命周期 downloading/downloaded/verified/failed
  retire_reason: string;
  holding: string;                 // owned / missing
  file_path: string | null;
  priority: number | null;
  notes: string | null;
  domain_id: string;
  created_at: string;
  updated_at: string;
}
```

### DomainSystem

```typescript
interface DomainSystem {
  domain_id: string;
  name: string;
  exploration_stage?: string;  // 未开始/已生成/探索中/待确认/已完成/失败
  courses: CourseRecord[];     // 嵌套课程列表
  // ... 其他字段
}
```

### DashboardStats

```typescript
interface DashboardStats {
  exploredDomains: number;   // 已探明领域数
  totalCourses: number;      // 课程数
  totalBooks: number;        // 书籍卷数
  verifiedBooks: number;     // 验收书目数
}
```

## 七、已知约束与约定

1. **空态不占位**：无数据时显示简短提示，不占用大量空间
2. **独立性铁律**：8901 离线 → 三行图表降级，不影响服务在线情况卡片
3. **并行请求容错**：`Promise.allSettled` 确保单个教程失败不阻塞整体
4. **Courses 独立降级**：courses 请求失败 → 三行图表全部降级
5. **无操作按钮**：仪表盘纯只读，所有操作在控制台完成
6. **域归属反查**：books 通过 knowledge.course_id → courseSystem 反查 domain_id

## 验证与验收

1. `cd web-ui && npm test` 通过
2. `cd web-ui && npx tsc --noEmit` 无错
3. `cd web-ui && npm run build` 成功
4. 人工验收：8903 打开 `#/admin/dashboard` 检查服务在线情况 + 统计数字 + 三行图表
