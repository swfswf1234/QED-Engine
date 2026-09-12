# 课程详情弹窗状态机优化

状态：In Progress
最后更新：2026-09-10
任务类型：B
关联 ADR：无（UI 交互优化，非架构决策）
关联设计：`../design/downloads-flow.md`（领域探索状态机参考）
关联 Tracker：docs/trackers/todo.md（PLAN-035，REQ-068 ISSUE-003 配套）
归档判定：实现完成并经用户浏览器验收后随主线归档至 `../history/plans/2026-09/`

> 2026-09-10 补登记（REQ-069 治理轮）：后端确认端点与课程状态写入已落地
> （`domain_explore.py:372` confirm_course、`explore_sessions.py:356` `_write_course_stage`），
> 前端按钮分态逻辑已实现；待用户浏览器验收后关闭。

## 目标与成功标准

优化课程详情弹窗（CourseDetailModal）的操作按钮，实现完整的状态机流转，
与领域探索流程对齐，支持"探索→确认→完成"的完整生命周期。

**成功标准**：
1. 课程 `exploration_stage` 支持 5 种状态：未开始/探索中/待确认/已完成/失败
2. 按钮根据状态显示不同文案和行为
3. 课程探索成功后正确写入"待确认"状态
4. 新增课程确认 API，支持用户确认后写入"已完成"状态
5. 所有测试通过，构建成功

## 范围与非目标

**范围**：
- 后端：修复 `_finish_ready()` 写入课程状态 + 新增课程确认 API
- 前端：重构 `CourseDetailModal` 按钮逻辑

**非目标**：
- 轮询监控课程状态变化（后续优化）
- 课程探索结果详情展示（简化确认弹窗）

## 前置条件

1. 8900/8901 服务可启动
2. 现有课程探索功能正常工作

## 工作项

### Task 1：修复后端 `_finish_ready()` 写入课程状态

**文件**：`backend/qed_engine/services/explore_sessions.py`

**改动**：
1. 在 `_finish_ready()` 方法中添加课程状态写入逻辑
2. 新增 `_write_course_stage()` 辅助方法

**验证**：
- 课程探索成功后，数据库中 `exploration_stage` 应为 "待确认"

### Task 2：新增课程确认 API

**文件**：`backend/qed_engine/api/domain_explore.py`

**改动**：
1. 新增 `POST /courses/{course_id}/confirm` 端点
2. 检查课程当前状态是否为 "待确认"
3. 写入 "已完成" 状态

**验证**：
- 调用 API 后，课程状态变为 "已完成"
- 非 "待确认" 状态调用返回 409 错误

### Task 3：新增前端 API 函数

**文件**：`web-ui/src/api/tracker.ts`

**改动**：
1. 新增 `confirmCourse(courseId)` 函数

**验证**：
- TypeScript 类型检查通过

### Task 4：重构 CourseDetailModal 按钮逻辑

**文件**：`web-ui/src/pages/Downloads.tsx`

**改动**：
1. 根据 `exploration_stage` 显示不同按钮：
   - 未开始/失败 → "课程探索"（可点击）
   - 探索中 → "探索中"（灰色禁用）
   - 待确认 → "教程详情"（可点击）+ "导入教程"
   - 已完成 → "已完成"（灰色禁用）
2. 新增 `handleConfirmCourse()` 函数

**验证**：
- 按钮状态正确切换
- 点击"教程详情"调用确认 API

### Task 5：运行测试与构建

**验证命令**：
```bash
cd web-ui && npm run test
cd web-ui && npm run build
```

**预期结果**：
- 测试通过
- 构建成功

## 验证与验收

- 自动化：Task 5 门禁命令全绿；后端确认端点行为由 `tests/test_domain_explore.py` 覆盖。
- 人工验收：用户浏览器走查课程详情弹窗——探索/确认/完成状态流转真实操作。

## 回滚

撤销 `explore_sessions.py`、`domain_explore.py`、`tracker.ts`、`Downloads.tsx` 对应改动；
状态写入为幂等字段更新，无需数据回滚。

## 关闭与归档

后端与前端实现已落地（2026-09-09 会话）；关闭条件为用户浏览器验收通过；关闭后按归档
判定随主线归档。

## 状态流转图

```
┌─────────┐    用户点击     ┌─────────┐   探索完成    ┌─────────┐
│  未开始  │ ─────────────→ │  探索中  │ ───────────→ │  待确认  │
└─────────┘                └─────────┘              └─────────┘
                                │                        │
                                │ 失败                   │ 用户确认
                                ↓                        ↓
                           ┌─────────┐             ┌─────────┐
                           │   失败   │             │  已完成  │
                           └─────────┘             └─────────┘
                                │
                                │ 重试
                                ↓
                           ┌─────────┐
                           │  未开始  │
                           └─────────┘
```
