# 联调问题解决清单（QED-Engine ↔ QED-Tracker）

状态：In Progress
最后更新：2026-09-09
任务类型：B
关联 ADR：无（接口行为对齐，非架构决策）
关联设计：`../design/downloads-flow.md`、`../architecture/api-contracts.md`
关联 Tracker：docs/trackers/todo.md（REQ-068-PLAN、REQ-068、ARCH-019）
归档判定：所有 ISSUE 关闭后随主线归档至 `../history/plans/2026-09/`

## 目标与成功标准

登记并跟踪 QED-Engine（8900/8903）与 QED-Tracker（8901）联调过程中发现的接口行为不一致、
状态机缺口和数据形态差异问题。每个问题包含根因分析、影响范围和修复建议。

**成功标准**：所有登记 ISSUE 状态为 Closed，联调链路无阻塞性行为差异。

## 范围与非目标

**范围**：8900 门面端点与8901 原生端点之间的接口契约偏差、状态机不一致、数据形态双义问题。
**非目标**：8900 自有功能缺陷（如前端 UI 逻辑、降级策略本身的问题）；Axiom-Flow（8902）联调问题另文登记。

## 前置条件

8900/8901 服务可启动，基本联调环境就绪。

## 工作项

### ISSUE-001：explore_pending.kind 双形态导致手动导入走错路径

**发现日期**：2026-09-08
**严重程度**：高（手动导入功能完全失效）
**影响范围**：8901 在线时手动导入领域知识
**关联 REQ**：REQ-068 ④
**状态**：Open（待8901修复）；前端已绕行（Radio.Group 模式选择器，2026-09-08）

**根因**：`POST /domains/import` 端点在8901在线与离线时设置不同的 `explore_pending.kind`：

| 路径 | explore_pending.kind | 前端判断 `kind === 'import_courses'` |
|------|---------------------|--------------------------------------|
| 8901 在线 | `review_results` | **false** → 走 LLM 探索路径 |
| 8901 离线（8900 降级） | `import_courses` | true → 走手动导入路径 |

API 契约（`architecture/api-contracts.md:379`）明确规定手动导入时 `explore_pending=review_results`，
而8900降级路径（`shared_tables.py:738-743`）设置 `kind: 'import_courses'`。

前端 `DomainConfirmModal.tsx:117` 仅检查 `kind === 'import_courses'`：
```typescript
const imported = ep?.kind === 'import_courses';
```

**影响**：8901 在线时，手动导入领域JSON后：
1. 领域正确设置 `exploration_stage=已生成` + `explore_pending={kind:'review_results', courses:[...]}`
2. 用户点击"领域信息确认" → `DomainConfirmModal` 打开
3. `imported = ep?.kind === 'import_courses'` → **false**
4. 代码跳过导入分支，走 LLM 路径 → 调用 `confirmDomainInfo()`
5. `confirm-domain` 端点将 stage 改为 **"探索中"**
6. 用户卡在探索中，等待实际不需要的 LLM 课程生成任务

**修复方案**（方案B：8901 侧统一语义，用户裁决 2026-09-08）：
- 手动导入时设置 `kind: 'import_courses'`（与8900降级路径一致）
- LLM 探索课程审阅时保持 `kind: 'review_results'`
- 修改位置：8901 的 `POST /domains/import` 处理逻辑
- 交付形式：QED-Tracker 代码改动 + 回执

**验证方法**：
1. 8901 在线状态下导入领域 JSON
2. 确认 `explore_pending.kind` 为 `import_courses`
3. 点击"领域信息确认" → 应直接进入课程信息确认弹窗，不触发探索中状态

---

### ISSUE-002：手动导入路径 commit-import 调用了错误的8901端点

**发现日期**：2026-09-08（API 映射错误发现：2026-09-09）
**严重程度**：高（手动导入触发不需要的 LLM 任务）
**影响范围**：8901 在线时手动导入领域知识的 API 调用路径
**关联 REQ**：REQ-067 B3
**状态**：Open（双侧修复）

**根因**：QED-Engine `commit_import_courses()`（`tracker_client.py:448-455`）调用8901 `POST /domains/{id}/confirm`，
但该端点语义是"确认领域 → 异步提交 courses@v8 LLM 任务"（六步流程步骤 2）。手动导入路径应调用
`POST /domains/{id}/courses/import`（六步流程步骤 3：从 domains.json 同步写入课程行，无 LLM）。

| 对比 | 当前调用 | 正确端点 |
|------|---------|---------|
| 8901 端点 | `/domains/{id}/confirm` | `/domains/{id}/courses/import` |
| 语义 | 确认领域 + 异步 LLM courses@v8 | 从 domains.json 同步写课程行 |
| 响应 | `{task_id, exploration_stage}` | `{domain_id, courses_created, courses_updated, exploration_stage}` |
| 副作用 | 触发 LLM 任务（浪费 + 可能覆盖手动数据） | 无 LLM，纯同步写库 |

附加问题：8901 `/courses/import` 状态守卫（`main.py:929`）要求 `exploration_stage == "探索中"`，
但手动导入步骤 1 后 stage = "已生成"，调用会返回 409。需放宽为接受 `"已生成" | "探索中"`。

**影响**：用户选择"已导入"确认后，触发不必要的 LLM courses@v8 任务；响应字段映射错误（`committed` 永远为 0）。

**修复方案**（双侧修复，2026-09-09）：

QED-Tracker 侧（1 行改动）：
- `main.py:929`：状态检查从 `!= "探索中"` 改为 `not in ("已生成", "探索中")`

QED-Engine 侧（3 个文件）：
- `tracker_client.py:448-455`：`commit_import_courses()` 改调 `/courses/import` 而非 `/confirm`
- `tracker.py:225`：端点 docstring 更新
- `web-ui/src/api/tracker.ts:89-97`：`CommitImportResult` 增加 `updated` 字段

**验证方法**：
1. 导入领域 JSON → stage = "已生成"
2. 点击"领域信息确认" → 选择"已导入" → 确认
3. 阶段变为"待确认" → "课程知识确认"按钮可用
4. 无 LLM 任务触发（检查8901日志无 courses@v8 任务提交）

---

### ISSUE-003：右侧栏课程描述映射错误 + 按钮位置问题

**发现日期**：2026-09-09
**严重程度**：中（UI展示不符合预期）
**影响范围**：文档下载管理页面右侧栏课程展示
**关联 REQ**：REQ-067（文档下载管理）
**状态**：Closed（已修复）

**根因**：

1. **课程描述映射错误**：右侧栏显示 `course.note`（课程简介），而非 `course.description`（课程描述）。`CourseRecord` 接口有两个相关字段：
   - `note?: string` — 课程简介（展示于课程栏）
   - `description?: string` — 课程描述
   右侧栏代码（`Downloads.tsx:856,888`）错误地显示了 `note` 而非 `description`。

2. **按钮位置错误**：`CourseOpsBar` 组件（含"课程探索"和"导入教程"按钮）在每个课程标题下渲染，而非在详情页面。

**影响**：
- 用户无法在右侧栏看到课程描述（以"计算机科学"→"程序设计基础"为例，期望显示完整课程描述）
- 操作按钮位置不符合用户预期

**修复方案**：

1. **右侧栏优化**（`Downloads.tsx`）：
   - 将 `dl-course-head-note` 从显示 `course.note` 改为显示 `course.description`
   - 移除 `CourseOpsBar` 组件的渲染（从右侧栏移除）

2. **新建课程详情页面**（`CourseDetailPage.tsx`）：
   - 创建独立的课程详情展示页面
   - 包含课程名称、描述、阶段、学术方向等完整信息
   - 包含"课程探索"和"导入教程"按钮
   - 更新路由配置，从右侧栏"详情"按钮跳转

**验证方法**：
1. 在"文档下载管理"页面选择领域，验证课程描述正确显示
2. 点击"详情"按钮，验证跳转到独立详情页面
3. 在详情页面验证"课程探索"和"导入教程"按钮功能正常

---

### ISSUE-004：前端"已导入"路径跳过 /confirm 端点导致六步流程断裂

**发现日期**：2026-09-09
**严重程度**：高（手动导入课程完全失效——courses.json 未生成，apply-results 无法执行）
**影响范围**：QED-Engine 前端手动导入领域知识的完整六步流程
**关联 REQ**：REQ-068 ④
**状态**：Fixed（前端修复已完成，待联调验证）
**来源**：QED-Tracker `docs/plans/2026-09-integration-issues.md` 问题 8

**根因**：

前端 `DomainConfirmModal.tsx:129-139` 的"已导入"分支只调用了 `commitImport()`，
**缺少前置的 `confirmDomainInfo()` 调用**。

```typescript
// 当前代码（DomainConfirmModal.tsx:129-139）
if (imported) {
  try {
    await commitImport(domain.domain_id);  // 直接调用 commit-import
  } catch (commitErr) {
    message.warning(describeError(commitErr));
  }
  // 缺少：await confirmDomainInfo(domain.domain_id);
  return;
}
```

六步流程要求手动导入的正确顺序：

| 步骤 | 端点 | 作用 | 当前状态 |
|------|------|------|----------|
| 1 | `POST /domains/import` | 写入 JSON，stage→已生成 | ✅ 正常 |
| 2 | `POST /domains/{id}/confirm` | 有课程时直接写 courses.json，stage→待确认 | ❌ **被跳过** |
| 3 | `POST /domains/{id}/apply-results` | 从 courses.json 创建数据库记录，stage→已完成 | ❌ 因步骤 2 跳过而无法执行 |

当前前端在"已导入"路径中直接调用 `commitImport()`（→8901 `/courses/import`），
而非先调 `confirmDomainInfo()`（→8901 `/confirm`）。这导致：
1. `courses.json` 从未生成（步骤 2 被跳过）
2. 领域状态停留在"已生成"，未转换到"待确认"
3. 后续 `confirm-knowledge`（→8901 `/apply-results`）因无 courses.json 而失败

**影响**：
- 手动导入领域 JSON 后选择"已导入"确认 → 课程无法写入数据库
- 用户看到 `courses_kept=0` 或409错误

**修复方案**：

**文件**：`D:\coding\QED-Engine\web-ui\src\components\DomainConfirmModal.tsx`

**修改位置**：第 129-139 行的 `if (imported)` 分支

**修改内容**：在调用 `commitImport` 之前先调用 `confirmDomainInfo`（与 AI 探索路径统一）

```typescript
// 修改后：
if (imported) {
  // 先调 confirm-domain（与 AI 探索路径统一）
  const nameOverride = ep?.kind === 'import_courses' && ep.name_changed
    ? ep.imported_name
    : undefined;
  await confirmDomainInfo(domain.domain_id, nameOverride);
  
  // 再调 commitImport 提交课程
  try {
    await commitImport(domain.domain_id);
  } catch (commitErr) {
    message.warning(describeError(commitErr));
  }
  
  message.success('领域信息已保存，课程已确认');
  onClose();
  void fetchAll();
  return;
}
```

**修复后的流程**：
1. `POST /domains/import` → stage = "已生成"
2. `POST /domains/{id}/confirm-domain`（8900）→ 8901 `POST /domains/{id}/confirm` → stage = "待确认"（含 courses 时直接写 courses.json）
3. `POST /domains/{id}/commit-import`（8900）→ 8901 `POST /domains/{id}/courses/import` → 将 courses 写入数据库

**验证方法**：
1. 导入领域 JSON → stage = "已生成"
2. 点击"领域信息确认" → 选择"已导入" → 确认
3. 检查 stage 已变为"待确认"（confirm-domain 成功）
4. 检查 `courses.json` 已生成
5. 检查课程已写入数据库（commit-import 成功）
6. 无 LLM 任务触发（检查8901日志无 courses@v8 任务提交）

**关联文档**：
- QED-Tracker 问题分析：`QED-Tracker/docs/plans/2026-09-integration-issues.md` 问题 8
- 六步流程设计：`docs/architecture/api-contracts.md:376-381`
- 状态机分析：本清单 ISSUE-001

---

## 验证与验收

1. 每个 ISSUE 关闭前须通过对应验证方法
2. 全部 ISSUE 关闭后运行 `tests/contract/` 门禁确认文档一致性
3. 联调链路端到端验收（手动导入 + LLM 探索两条路径均正常）

---

### ISSUE-005：右侧栏教程按钮精简 + 教程简介字段映射错误

**发现日期**：2026-09-09
**严重程度**：中（UI 展示不符合预期 + 教程简介永远不显示）
**影响范围**：文档下载管理页面右侧栏教程展示
**关联 REQ**：REQ-067（文档下载管理）
**状态**：Fixed（前端修复已完成）

**根因**：

1. **按钮精简**：右侧栏教程区显示三个按钮（删除、详情、自动下载），用户要求只保留详情按钮。
   - 删除按钮（`Downloads.tsx:591-595`）已禁用（QED-Tracker 未实现教程删除）
   - 自动下载按钮（`Downloads.tsx:597-605`）可正常工作，但用户不需要

2. **教程简介字段映射错误**：后端 `qt_knowledge` 表只有一个 `intro` 字段（套级简介，120~350 字），
   但前端 `KnowledgeRecord` 接口定义了三个字段（`textbook_intro`、`exercise_intro`、`materials_intro`），
   这三个字段在后端 API 响应中不存在（返回 undefined）。

   | 后端字段 | 前端字段 | 映射关系 |
   |----------|----------|----------|
   | `intro` | `textbook_intro` | ❌ 不匹配 |
   | `intro` | `exercise_intro` | ❌ 不匹配 |
   | `intro` | `materials_intro` | ❌ 不匹配 |

   影响：`TutorialDetailModal` 第 266-272 行的简介展示逻辑永远返回空，教程简介永远不显示。

**修复方案**：

1. **按钮精简**（`Downloads.tsx:590-605`）：
   - 移除删除按钮（行 591-595）
   - 移除自动下载按钮（行 597-605）
   - 只保留详情按钮（行 596）

2. **教程简介字段映射**（`stores/index.ts:142-162` + `Downloads.tsx:266-272`）：
   - 修改 `KnowledgeRecord` 接口：移除 `textbook_intro`、`exercise_intro`、`materials_intro` 字段，添加 `intro` 字段
   - 修改 `TutorialDetailModal` 简介展示逻辑：直接使用 `knowledge.intro` 字段

**修改文件**：
- `web-ui/src/stores/index.ts`：修改 `KnowledgeRecord` 接口
- `web-ui/src/pages/Downloads.tsx`：移除按钮 + 修改简介展示逻辑

**验证方法**：
1. 在"文档下载管理"页面选择领域，验证教程区只显示详情按钮
2. 点击详情按钮，验证教程简介正确显示（内容来自后端 `intro` 字段）
3. 运行 `npm run build` 和 `npm test` 验证无类型错误

---

### ISSUE-006：书目详情页缺少确认按钮 + 渠道选择交互

**发现日期**：2026-09-09
**严重程度**：高（用户无法选择版本下载）
**影响范围**：文档下载管理页面书目详情弹窗
**关联 REQ**：REQ-067（文档下载管理）
**状态**：Fixed（前端修复已完成）

**根因**：

`BookDetailModal`（`Downloads.tsx:454-527`）是只读展示弹窗，无操作按钮。
渠道尝试区只显示成功/失败状态和链接，无选择功能。

用户需求流程：展示书目数据 → 展示成功渠道 → 确认按钮选择版本下载

**修复方案**：

1. **添加渠道选择交互**（`Downloads.tsx:505-523`）：
   - 在每个成功渠道（`s.ok === true`）旁添加"选择此版本"按钮
   - 点击按钮后调用下载 API（`fetchBook(book.book_id)` + 渠道参数）
   - 添加加载状态和成功/失败反馈

2. **添加确认按钮**：
   - 在渠道列表下方添加"确认下载"按钮
   - 选中渠道后高亮显示
   - 点击确认按钮执行下载操作

**修改文件**：
- `web-ui/src/pages/Downloads.tsx`：修改 `BookDetailModal` 组件

**验证方法**：
1. 在"文档下载管理"页面选择领域，点击教程详情
2. 在书目列表中点击详情按钮，验证 `BookDetailModal` 打开
3. 验证渠道尝试区显示成功渠道的"选择此版本"按钮
4. 点击按钮，验证下载任务提交成功
5. 运行 `npm run build` 和 `npm test` 验证无类型错误

---

### ISSUE-007：书目详情页字段映射错误

**发现日期**：2026-09-09
**严重程度**：中（UI 展示不符合预期）
**影响范围**：文档下载管理页面书目详情弹窗
**关联 REQ**：REQ-067（文档下载管理）
**状态**：Fixed（前端修复已完成）

**根因**：

`BookDetailModal`（`Downloads.tsx:490-502`）展示的字段与用户要求不符。
用户要求保留的字段：`book.title`、`book.part`、`book.edition`、`book.authors`、`book.role`、`book.language`、`book.roles`、`book.page_count`、`book.absolute_path`、`book.status`

当前展示的字段：
- 作者（`book.authors`）✅
- 版本（`book.edition` + `book.year`）✅
- 语言（`book.language`）✅
- 出版社（`book.publisher`）❌ 用户未要求
- 页数（`book.page_count`）✅
- sha256（`book.sha256`）❌ 用户未要求
- 数据根路径（`book.relative_path`）❌ 用户未要求
- 绝对路径（`book.absolute_path`）✅
- 否定原因（`book.reject_reason`）❌ 用户未要求
- 审理备注（`book.review_note`）❌ 用户未要求
- 原始来源（`book.original_url`）❌ 用户未要求

缺失的字段：
- 书名（`book.title`）❌ 未展示
- 部分（`book.part`）❌ 未展示
- 角色（`book.roles`）❌ 未展示（当前只展示角色标签，非字段）
- 状态（`book.status`）❌ 未展示（当前只展示状态标签，非字段）

**修复方案**：

修改 `BookDetailModal`（`Downloads.tsx:490-502`）的字段展示：

```tsx
<div className="dl-book-meta">
  <div>书名：{book.title}</div>
  {book.part && <div>部分：{book.part}</div>}
  {book.edition && <div>版本：{book.edition}</div>}
  {book.authors?.length > 0 && <div>作者：{book.authors.join(' / ')}</div>}
  {book.roles?.length > 0 && <div>角色：{book.roles.join(' / ')}</div>}
  {book.language && <div>语言：{book.language}</div>}
  {book.page_count != null && <div>页数：{book.page_count}</div>}
  {book.absolute_path && <div>绝对路径：{book.absolute_path}</div>}
  <div>状态：{BOOK_STATUS[book.status]?.label ?? book.status}</div>
</div>
```

**修改文件**：
- `web-ui/src/pages/Downloads.tsx`：修改 `BookDetailModal` 组件的字段展示

**验证方法**：
1. 在"文档下载管理"页面选择领域，点击教程详情
2. 在书目列表中点击详情按钮，验证 `BookDetailModal` 打开
3. 验证字段展示符合用户要求：书名、部分、版本、作者、角色、语言、页数、绝对路径、状态
4. 运行 `npm run build` 和 `npm test` 验证无类型错误

## 回滚

单个 ISSUE 回滚：撤销8901对应代码改动，恢复 `explore_pending` 原始行为。
整体回滚：回退8901至联调前版本。

## 关闭与归档

所有 ISSUE 状态为 Closed 后，本文档随主线任务归档至 `../history/plans/2026-09/`。
归档前确认：① 所有修复已回执；② 联调验收通过；③ `tests/contract/` 门禁全绿。

## 变更记录

| 日期 | 变更 |
|------|------|
| 2026-09-08 | 初始版本，登记 ISSUE-001（explore_pending.kind 双形态） |
| 2026-09-08 | ISSUE-002 登记（前端缺少 commit-import 调用） |
| 2026-09-09 | ISSUE-002 更新：发现 commit-import 调用了错误的8901端点（/confirm 应为 /courses/import）；登记双侧修复方案 |
| 2026-09-09 | ISSUE-003 登记：右侧栏课程描述映射错误 + 按钮位置问题 |
| 2026-09-09 | ISSUE-003 关闭：修复课程描述映射（note→description），创建独立详情页面，移除右侧栏 CourseOpsBar |
| 2026-09-09 | ISSUE-004 登记：前端"已导入"路径跳过 /confirm 端点导致六步流程断裂 |
| 2026-09-09 | ISSUE-004 修复：DomainConfirmModal.tsx 已导入路径添加 confirmDomainInfo 调用 |
| 2026-09-09 | ISSUE-005 登记：右侧栏教程按钮精简 + 教程简介字段映射错误 |
| 2026-09-09 | ISSUE-006 登记：书目详情页缺少确认按钮 + 渠道选择交互 |
| 2026-09-09 | ISSUE-007 登记：书目详情页字段映射错误 |
| 2026-09-09 | ISSUE-005 修复：右侧栏教程按钮精简 + 教程简介字段映射错误 |
| 2026-09-09 | ISSUE-006 修复：书目详情页添加确认按钮 + 渠道选择交互 |
| 2026-09-09 | ISSUE-007 修复：书目详情页字段映射调整 |
