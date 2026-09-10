# 知识API对接与exploration_stage修复 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对接QED-Tracker的教程更新/删除API，并修复导入课程知识后右侧栏仍显示"开始探索"按钮的问题

**Architecture:** 
1. 在QED-Engine后端（8900）添加PATCH/DELETE /knowledge/{id}的代理路由和client方法
2. 修复导入课程知识后exploration_stage未更新的问题（前端侧修复）

**Tech Stack:** Python FastAPI, TypeScript React, Zustand

---

## 问题分析

### 问题1：QED-Engine后端缺失API代理路由
- QED-Tracker（8901）已实现 `PATCH /knowledge/{id}` 和 `DELETE /knowledge/{id}`
- QED-Engine后端（8900）缺失这两个接口的代理路由
- 前端（web-ui）已有 `updateKnowledge` 和 `deleteKnowledge` 函数，但无法调用后端

### 问题2：导入课程知识后exploration_stage未更新
- 导入课程知识（`POST /courses/{id}/knowledge`）只创建tutorials，不更新`exploration_stage`
- `DomainCard`组件基于`domain.exploration_stage`决定显示"开始探索"按钮
- 当`exploration_stage`为`undefined`时，默认显示"开始探索"

---

## 任务1：对接PATCH/DELETE /knowledge/{id} API

### Task 1.1: 在tracker_client.py中添加client方法

**Files:**
- Modify: `D:\coding\QED-Engine\backend\qed_engine\clients\tracker_client.py:128-131`

- [ ] **Step 1: 添加update_knowledge方法**

在`import_course_knowledge`方法后添加：

```python
def update_knowledge(self, knowledge_id: str, **kwargs) -> dict:
    """更新教程信息（name/position/intro/set_no/kind/notes）。"""
    body = {k: v for k, v in kwargs.items() if v is not None}
    return self._request("PATCH", f"{API_PREFIX}/knowledge/{knowledge_id}", json=body)

def delete_knowledge(self, knowledge_id: str) -> dict:
    """删除教程（级联清理孤立书籍）。"""
    return self._request("DELETE", f"{API_PREFIX}/knowledge/{knowledge_id}")
```

- [ ] **Step 2: 运行测试验证**

Run: `cd D:\coding\QED-Engine\backend && python -m pytest tests/ -v -k tracker`
Expected: 现有测试通过

### Task 1.2: 在tracker.py中添加代理路由

**Files:**
- Modify: `D:\coding\QED-Engine\backend\qed_engine\api\tracker.py:363-375`

- [ ] **Step 1: 添加Pydantic模型**

在`KnowledgeConfirmBody`模型后添加：

```python
class KnowledgeUpdateBody(BaseModel):
    """教程更新请求体。"""
    name: str | None = None
    position: str | None = None
    intro: str | None = None
    set_no: str | None = None
    kind: str | None = None
    notes: str | None = None
```

- [ ] **Step 2: 添加PATCH路由**

在`confirm_knowledge`路由后添加：

```python
@router.patch("/knowledge/{knowledge_id}")
def update_knowledge(knowledge_id: str, body: KnowledgeUpdateBody, request: Request) -> dict:
    """更新教程信息（name/position/intro/set_no/kind/notes）。"""
    return _call(
        request,
        _tracker(request).update_knowledge,
        knowledge_id,
        name=body.name,
        position=body.position,
        intro=body.intro,
        set_no=body.set_no,
        kind=body.kind,
        notes=body.notes,
    )
```

- [ ] **Step 3: 添加DELETE路由**

在PATCH路由后添加：

```python
@router.delete("/knowledge/{knowledge_id}")
def delete_knowledge(knowledge_id: str, request: Request) -> dict:
    """删除教程（级联清理孤立书籍）。"""
    return _call(request, _tracker(request).delete_knowledge, knowledge_id)
```

- [ ] **Step 4: 运行测试验证**

Run: `cd D:\coding\QED-Engine\backend && python -m pytest tests/ -v -k tracker`
Expected: 现有测试通过，新增路由可访问

### Task 1.3: 验证前端API调用

**Files:**
- Read: `D:\coding\QED-Engine\web-ui\src\api\tracker.ts:169-177`
- Read: `D:\coding\QED-Engine\web-ui\src\components\CourseKnowledgeConfirmModal.tsx:154-162`

- [ ] **Step 1: 确认前端API函数已定义**

确认`tracker.ts`中已有：
```typescript
export function updateKnowledge(knowledgeId: string, body: { name?: string; position?: string; intro?: string }, opts?: ApiRequestOptions): Promise<KnowledgeRecord> {
  return api.patch<KnowledgeRecord>(`/knowledge/${knowledgeId}`, body, opts);
}

export function deleteKnowledge(knowledgeId: string, opts?: ApiRequestOptions): Promise<void> {
  return api.del<void>(`/knowledge/${knowledgeId}`, opts);
}
```

- [ ] **Step 2: 确认前端已使用这些函数**

确认`CourseKnowledgeConfirmModal.tsx`中已调用`deleteKnowledge`函数

- [ ] **Step 3: 手动测试教程编辑/删除功能**

启动服务后，在前端测试：
1. 打开文档下载管理
2. 选择一个有教程的课程
3. 点击"课程知识确认"
4. 测试编辑教程名称
5. 测试删除教程

---

## 任务2：修复exploration_stage显示问题

### Task 2.1: 分析问题根因

**问题分析：**
- 导入课程知识后，`fetchAll()`刷新数据
- 但`domain.exploration_stage`仍为`undefined`
- `DomainCard`组件：`const stage = domain.exploration_stage || '未开始';`
- 默认显示"开始探索"按钮

**解决方案选择：**
- 方案A：后端侧 - 在导入课程知识后自动更新`exploration_stage`
- 方案B：前端侧 - 改变`DomainCard`的显示逻辑

**推荐方案B（前端侧修复）：**
- 不改变后端行为，保持`exploration_stage`仅由探索流程控制
- 在`DomainCard`中增加条件：如果域下有已导入知识的课程，显示不同的状态

### Task 2.2: 修改DomainCard组件

**Files:**
- Modify: `D:\coding\QED-Engine\web-ui\src\components\DomainCard.tsx:134`

- [ ] **Step 1: 修改stage取值逻辑**

将：
```typescript
const stage = domain.exploration_stage || '未开始';
```

改为：
```typescript
// 如果域下有课程且有教程，显示"已导入"状态
const hasCoursesWithKnowledge = domain.courses?.some(
  (c: CourseRecord) => c.knowledge && c.knowledge.length > 0
);
const stage = domain.exploration_stage || (hasCoursesWithKnowledge ? '已导入' : '未开始');
```

- [ ] **Step 2: 添加"已导入"状态到按钮状态机**

在`getDomainButtonState`函数的switch语句中添加：

```typescript
case '已导入':
  return { label: '查看课程', disabled: false, loading: false, onClick: onExplore, type: 'default' };
```

- [ ] **Step 3: 运行前端测试**

Run: `cd D:\coding\QED-Engine\web-ui && npm run test`
Expected: 现有测试通过

### Task 2.3: 修改Downloads.tsx中的CourseStatusBar

**Files:**
- Modify: `D:\coding\QED-Engine\web-ui\src\pages\Downloads.tsx:277`

- [ ] **Step 1: 修改courseStage取值逻辑**

将：
```typescript
const courseStage = course.exploration_stage || '未开始';
```

改为：
```typescript
// 如果课程有教程，显示"已导入"状态
const hasKnowledge = course.knowledge && course.knowledge.length > 0;
const courseStage = course.exploration_stage || (hasKnowledge ? '已导入' : '未开始');
```

- [ ] **Step 2: 添加"已导入"状态到课程按钮状态机**

在`getButtonState`函数的switch语句中添加：

```typescript
case '已导入':
  return { label: '查看教程', disabled: false, loading: false, onClick: onConfirm, type: 'default' };
```

- [ ] **Step 3: 运行前端测试**

Run: `cd D:\coding\QED-Engine\web-ui && npm run test`
Expected: 现有测试通过

### Task 2.4: 验证修复效果

- [ ] **Step 1: 手动测试导入课程知识流程**

1. 启动QED-Tracker（8901）
2. 启动QED-Engine后端（8900）
3. 启动QED-Engine前端（8903）
4. 创建一个领域和课程
5. 右键课程 → "导入课程知识" → 选择JSON文件
6. 验证导入后右侧栏显示"查看课程"而非"开始探索"

- [ ] **Step 2: 验证其他场景**

1. 验证未导入知识的课程仍显示"开始探索"
2. 验证探索流程中的状态显示正常
3. 验证已有探索流程的域不受影响

---

## 完成检查

1. QED-Engine后端（8900）已添加PATCH/DELETE /knowledge/{id}路由
2. 前端教程编辑/删除功能可正常使用
3. 导入课程知识后，右侧栏显示"查看课程"而非"开始探索"
4. 所有现有测试通过
5. 未影响现有探索流程的状态机

---

## 相关文件

| 文件 | 修改内容 |
|------|----------|
| `backend/qed_engine/clients/tracker_client.py` | 添加update_knowledge/delete_knowledge方法 |
| `backend/qed_engine/api/tracker.py` | 添加PATCH/DELETE /knowledge/{id}路由 |
| `web-ui/src/components/DomainCard.tsx` | 修改stage取值逻辑，添加"已导入"状态 |
| `web-ui/src/pages/Downloads.tsx` | 修改courseStage取值逻辑，添加"已导入"状态 |
