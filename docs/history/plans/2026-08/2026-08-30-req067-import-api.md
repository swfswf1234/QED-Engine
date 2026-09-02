# 导入领域知识 API 契约（REQ-067-A 配套）

状态：Accepted
任务类型：B
最后更新：2026-08-30
关联 ADR：[ADR 0011](../../adr/v0.1/0011-pending-design-location.md)（待评审设计随计划承载，确定后并入 architecture/ 固定文档）
关联设计：[2026-08-29-req067-downloads-optimization.md](../../../plans/2026-08-29-req067-downloads-optimization.md)（REQ-067 §B3）
关联 Tracker：docs/trackers/todo.md（本计划行 PLAN-026；REQ-067-A）
归档判定：契约确定后并入 architecture/api-contracts.md，计划壳归档 history/plans/2026-08/

> 本文档承载 QED-Tracker 侧「导入领域知识」API 的契约讨论与定义。
> 前端通过文件选择器选取本地 JSON 文件后，调用 QED-Tracker API 导入领域知识。
> 根仓库 agent 只写文档，不写 QED-Tracker 代码。

---

## 目标与成功标准

- 目标：确定「导入领域知识」API 契约（端点、校验、状态驱动、名称确认），支撑 REQ-067 §B3 前端实现。
- 成功标准：QED-Tracker 回执确认契约四要素（见「待确认契约项」）；根仓库侧按契约完成前端导入闭环并通过验证。

## 范围与非目标

- 范围：QED-Tracker「导入领域知识」API 契约定义与根仓库前端对接策略；仅文档，不写 QED-Tracker 代码。
- 非目标：探索引擎本身（8901 已有管线）；导出/批量导入等其他数据操作。

## 前置条件

- REQ-067 界面优化计划（[PLAN-025](../../../plans/2026-08-29-req067-downloads-optimization.md)）§B3 依赖本契约。
- 参考 JSON 结构与 `QED-Tracker/docs/knowledge/computer-science.json`（领域知识样例）。
- 前端文件选择器交互已确定（见「前端实现要点」）。

---

## 背景

REQ-067 §B3 要求在文档下载管理页支持「导入领域知识」功能：用户右键领域→点击「导入领域知识」→浏览器文件选择器选 JSON 文件→前端校验→调 API 导入。

参考 JSON 结构来自 `QED-Tracker/docs/knowledge/computer-science.json`：

```json
{
  "domain": "computer-science",
  "name": "计算机科学与技术",
  "description": "...",
  "level": "本科",
  "entry_requirements": "...",
  "stages": ["基础", "主干", "分支", "前沿"],
  "classic_tracks": [
    { "name": "程序设计与算法", "summary": "...", "kind": "main" }
  ],
  "anchor_courses": ["程序设计基础", "数据结构与算法"],
  "courses": [
    {
      "slug": "c_programming",
      "name": "程序设计基础",
      "track": "程序设计与算法",
      "stage": "基础",
      "aliases": ["C 程序设计"],
      "summary": "...",
      "prerequisites": []
    }
  ]
}
```

---

## 待确认契约项

### 1. 导入端点

**提案**：`POST /api/v1/domains/import`

**请求体**：multipart/form-data 或 JSON body

| 方案 | 优点 | 缺点 |
|---|---|---|
| JSON body（整个文件内容作为 request body） | 简单，前端 `FileReader.readAsText()` 后直接 POST | 大文件时 body 过大 |
| multipart/form-data（文件上传） | 标准文件上传方式，支持大文件 | 前端需要 FormData 构造 |

**建议**：JSON body（领域知识文件通常 <100KB，无需流式上传）

**请求格式**：
```
POST /api/v1/domains/import
Content-Type: application/json

{ 完整 JSON 文件内容 }
```

**响应**：
```json
{
  "domain_id": "d_xxx",
  "name": "计算机科学与技术",
  "courses_imported": 5,
  "stages": ["基础", "主干", "分支", "前沿"],
  "exploration_stage": "已完成"
}
```

### 2. JSON 校验规则

| 字段 | 必需 | 类型 | 说明 |
|---|---|---|---|
| `name` | ✅ | string | 领域名称（创建后不可改） |
| `description` | ❌ | string | 领域描述 |
| `stages` | ❌ | string[] | 阶段列表（默认空） |
| `classic_tracks` | ❌ | array | 学术方向列表 |
| `classic_tracks[].name` | ✅（若 classic_tracks 非空） | string | 方向名称 |
| `courses` | ❌ | array | 课程列表 |
| `courses[].name` | ✅（若 courses 非空） | string | 课程名称 |
| `courses[].slug` | ❌ | string | 课程标识（缺省自动生成） |
| `courses[].track` | ❌ | string | 所属学术方向 |
| `courses[].stage` | ❌ | string | 所属阶段 |

**错误码**：

| HTTP | 含义 |
|---|---|
| 201 | 导入成功 |
| 400 | JSON 格式错误 / 必需字段缺失 |
| 409 | 领域名称已存在（重复导入） |
| 500 | 服务端内部错误 |

### 3. 领域探索状态驱动

**当前**：8900 经 `shared_tables.py` 直写 `exploration_stage`

**目标**：QED-Tracker 接管状态流转

| 事件 | exploration_stage 值 | 写入方 |
|---|---|---|
| 创建领域（手工） | 未开始（默认） | QED-Tracker |
| 启动探索 | 探索中 | QED-Tracker |
| 导入领域知识 | 已完成 | QED-Tracker |
| 探索完成（待确认） | 已生成 | QED-Tracker |
| 名称确认/应用完成 | 已完成 | QED-Tracker |
| 探索失败 | 失败 | QED-Tracker |

**前端读取方式**：轮询 `GET /api/v1/courses` 或 `GET /api/v1/domains`，从 `DomainSystem.exploration_stage` 字段读取。

**8900 侧变更**：`shared_tables.py` 中 exploration_stage 直写逻辑可逐步废弃，改为 QED-Tracker 通过 PATCH /domains/{id} 自行维护。

### 4. 名称确认机制

**流程**：
1. QED-Tracker 探索完成后，若建议改名，将 `exploration_stage` 设为 `已生成`
2. 前端检测到 `exploration_stage === '已生成'`，在 DomainInfoCard 内嵌确认区域
3. 用户点击 [采纳建议] 或 [保留原名]
4. 前端调用确认端点（待定义，可能是 `PATCH /api/v1/domains/{id}/confirm-name`）
5. QED-Tracker 更新领域名称 + `exploration_stage = '已完成'`

**待确认**：确认端点的请求/响应格式。

---

## 前端实现要点

### 文件选择器

```tsx
// DownloadsTree.tsx 新增
<input
  type="file"
  accept=".json"
  ref={fileInputRef}
  style={{ display: 'none' }}
  onChange={handleFileSelect}
/>
```

### 文件选择处理

```tsx
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // 1. 读取文件
  const text = await file.text();
  
  // 2. JSON 校验
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    message.error('文件不是有效的 JSON 格式');
    return;
  }
  
  // 3. 必需字段校验
  if (!data.name || typeof data.name !== 'string') {
    message.error('JSON 缺少必需字段：name');
    return;
  }
  
  // 4. 调 API 导入
  try {
    await importDomain(data);
    message.success('领域知识导入成功');
    void fetchAll(); // 刷新树
  } catch (err) {
    message.error(describeError(err));
  }
  
  // 5. 清空 input（允许重复选同一文件）
  e.target.value = '';
};
```

---

## 工作项

- 契约四要素确认（①端点/请求格式 ②校验规则 ③探索状态驱动 ④名称确认机制，见「待确认契约项」）
- 根仓库前端实现：文件选择器 → JSON 校验 → 调 API 导入 → 刷新树 → 清空 input（见「前端实现要点」）
- 契约落库：确定后并入 `architecture/api-contracts.md`

---

## 验证与验收

- QED-Tracker 回执契约项全部确认；前端导入功能按「前端实现要点」实现并通过 vitest 门禁。
- 手工验收：右键领域 → 导入领域知识 → 选 JSON → 校验通过/失败提示 → 树刷新。

---

## 回滚

- 纯文档契约，无代码回滚诉求；前端实现可连同改动一并 `git revert`。

---

## 关联任务

- REQ-067 §B3：导入领域知识前端实现
- REQ-067 §B8：探索状态追踪（QED-Tracker 驱动）
- REQ-067 §C3：导入 API 契约确认

---

## 关闭与归档

- 关闭条件：QED-Tracker 回执确认端点格式 + 根仓库前端实现完成。
- 归档判定：契约确定后并入 `architecture/api-contracts.md`，计划壳归档 `history/plans/2026-08/`。
