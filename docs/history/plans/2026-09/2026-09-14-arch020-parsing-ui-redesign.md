# 文档解析管理界面优化（ARCH-020 前端部分）

状态：In Progress
任务类型：A
最后更新：2026-09-14
关联 ADR：[ADR 0007](../../adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）
关联设计：[文档解析管理现状](2026-09-10-parsing-management-current-state.md)（当前实现基座）
关联 Tracker：docs/trackers/todo.md（ARCH-020 进行中）
归档判定：Retain（ARCH-020 第三轮主线前端部分，完成后归档 history/plans/2026-09/）

## 目标与成功标准

**目标**：优化文档解析管理界面（`#/admin/parsing`），实现：
1. 左侧树数据源改造：8900 共享表获取领域→课程结构 + 8902 获取书目，解耦对8902 的完全依赖
2. 8902 离线降级：仍能显示领域→课程（无书目）
3. 右侧对比视图预留：为后续原文档 vs 翻译文档对比做好结构准备

**成功标准**：
1. 左侧树正确显示领域→课程→书目层级（8902 在线时）
2. 8902 离线时，左侧树仍显示领域→课程（书目为空 + 降级提示）
3. 刷新按钮触发同步后重新加载树
4. 所有现有测试通过 + 新增测试覆盖
5. 前端构建成功 + vitest 通过

## 范围与非目标

**范围**：
- 后端：新增 `GET /api/v1/parsing/tree` 聚合端点
- 前端：`web-ui/src/stores/parsing.ts` 数据源改造
- 前端：`web-ui/src/pages/Parsing.tsx` 左侧树 + 降级逻辑
- 前端：`web-ui/src/api/axiom.ts` 新增类型定义

**非目标**：
- 右侧翻译文档对比视图（等 Axiom-Flow 提供接口后实现）
- 8902 侧代码改动
- 其他页面改动

## 前置条件

1. ARCH-019 课程下载闭环已完成（2026-09-11）
2. 8900 共享表 `list_domains_with_courses()` 函数可用
3. 8902 `/books` 端点可用（af_books 含 domain_id/course_id/course_name）

## 工作项

### Task 1：后端新增 `/parsing/tree` 端点

**目标**：聚合8900 共享表（领域→课程）+ 8902 书目，返回左侧树结构

**实现要点**：
- 路由：`GET /api/v1/parsing/tree`
- 数据源1：`shared_tables.list_domains_with_courses(settings)` → 领域→课程结构
- 数据源2：`axiom_client.list_books()` → 书目列表（失败时降级为空）
- 聚合逻辑：按 `domain_id + course_id` 匹配书目到课程
- 返回结构：`ParsingTreeNode[]`（key/type/title/domainId/courseId/book/children）

**降级逻辑**：
- 8902 离线 → `books = []`，仍返回领域→课程结构
- 8900 共享表为空 → 返回空列表

### Task 2：前端类型定义

**目标**：新增 `ParsingTreeNode` 接口和 `/parsing/tree` API 函数

**实现要点**：
- `web-ui/src/api/axiom.ts` 新增 `ParsingTreeNode` 接口
- 新增 `getParsingTree()` 函数调用 `/parsing/tree`
- 保留现有 `BookMeta` 等类型

### Task 3：前端 Store 改造

**目标**：`parsing.ts` 新增树数据状态和 `fetchTree` 方法

**实现要点**：
- 新增状态：`tree`, `treeLoading`, `treeError`
- 新增方法：`fetchTree()` → 调用 `getParsingTree()`
- 修改 `fetchBooks`：不再需要 `syncFirst` 逻辑（同步由刷新按钮触发）
- 保留 `openCompare`, `loadPage`, `submitReview` 等方法

### Task 4：前端 Parsing.tsx 改造

**目标**：左侧树数据源切换 + 降级显示

**实现要点**：
- 进入界面时调用 `fetchTree()` 而非 `fetchBooks()`
- 左侧树使用 `tree` 数据而非 `buildParsingTree(books)`
- 8902 离线时显示降级提示
- 刷新按钮：先调用 `syncBooks()`，再调用 `fetchTree()`
- 右侧对照视图暂保持现状（原页图 + 块级渲染）

### Task 5：测试与验证

**目标**：确保所有测试通过 + 手动验证降级

**验证项**：
- 后端：`pytest tests/test_api.py -v`（新增 parsing/tree 用例）
- 前端：`cd web-ui && npm test`（vitest 通过）
- 前端：`cd web-ui && npm run build`（构建成功）
- 手动：8902 在线时完整显示
- 手动：8902 离线时降级显示

## 验证与验收

### 自动化测试
- 后端 pytest 全量通过（含新增 parsing/tree 用例）
- 前端 vitest 全量通过
- 前端 tsc 零错
- 前端 build 成功

### 手动验收
1. 启动8900 + 8902，进入 `#/admin/parsing`
2. 左侧树显示领域→课程→书目（含解析进度）
3. 点击书目，右侧显示原页图 + 块级渲染
4. 停止8902，刷新页面
5. 左侧树仍显示领域→课程（书目为空 + 降级提示）
6. 点击刷新按钮，触发同步并重新加载

## 回滚

- 后端：删除 `/parsing/tree` 端点，恢复原 `/books` 端点
- 前端：恢复 `parsing.ts` 和 `Parsing.tsx` 到改造前状态
- 影响范围：仅文档解析管理页面，不影响其他页面

## 关闭与归档

关闭条件：
1. 所有自动化测试通过
2. 手动验收通过
3. 用户确认效果满意

归档：完成后归档至 `history/plans/2026-09/`
