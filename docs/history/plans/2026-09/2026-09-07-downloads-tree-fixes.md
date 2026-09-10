# 文档下载管理界面修复计划

状态：Draft
最后更新：2026-09-07
关联代码：`web-ui/src/components/DownloadsTree.tsx`、`web-ui/src/stores/downloads.ts`
关联测试：前端测试（vitest）

## 目的与边界

本文档记录文档下载管理界面三个问题的修复计划：
1. 修改领域后课程方向内容变空
2. 修改课程时阶段、学术方向、前置课程应该是选项
3. 课程右键菜单缺少"导入课程知识"功能

## 问题分析

### 问题1：修改领域后课程方向内容变空

**现象**：打开编辑对话框后显示了内容，然后过了两秒左右内容就变空了。

**根本原因**：在`downloads.ts`的`startPolling`函数中，每隔5秒会调用`listCourseSystem()`来获取最新的领域数据，然后更新domains。这会导致`TreeFormModal`中的`initialValues`被重新计算，因为`action.domain.classic_tracks`被更新了。

**修复方案**：
- 在`TreeFormModal`组件中，当action变化时，只在第一次渲染时设置表单值
- 或者在轮询时保持表单数据不变，只更新其他字段

### 问题2：修改课程时阶段、学术方向、前置课程应该是选项

**现象**：在edit-course表单中，`stage`和`track`字段使用Input组件，而不是Select组件。

**修复方案**：
- 将`stage`字段改为Select组件，选项从`domain.stages`获取
- 将`track`字段改为Select组件，选项从`domain.classic_tracks`获取
- 将`prerequisites`字段改为Select组件，选项从当前领域下的其他课程获取

### 问题3：课程右键菜单缺少"导入课程知识"功能

**现象**：当前课程右键菜单只有"修改课程"、"探索教程"、"删除课程"，缺少"导入课程知识"功能。

**修复方案**：
- 在课程右键菜单中添加"导入课程知识"选项
- 创建新的导入对话框，支持导入单个课程
- 调用`POST /domains/import`接口导入课程

## 实现计划

### Task 1：修复问题1（轮询导致表单值被重置）

**修改文件**：
- `web-ui/src/components/DownloadsTree.tsx`

**修改内容**：
1. 在`TreeFormModal`组件中，使用`useRef`来跟踪是否已经初始化过表单值
2. 只在第一次渲染时设置表单值，后续的action变化不重新设置

**代码改动**：
```typescript
// 在TreeFormModal组件中添加
const initializedRef = useRef(false);

useEffect(() => {
  if (action) {
    if (!initializedRef.current) {
      form.resetFields();
      form.setFieldsValue(initialValues);
      initializedRef.current = true;
    }
  } else {
    initializedRef.current = false;
  }
}, [action, form, initialValues]);
```

### Task 2：修复问题2（阶段、学术方向、前置课程改为选项）

**修改文件**：
- `web-ui/src/components/DownloadsTree.tsx`

**修改内容**：
1. 在`TreeFormModal`组件中，将`stage`字段改为Select组件
2. 将`track`字段改为Select组件
3. 将`prerequisites`字段改为Select组件

**代码改动**：
```typescript
// 在edit-course表单中
<Form.Item name="stage" label="阶段（必填）" rules={[{ required: true, message: '请选择阶段' }]}>
  <Select placeholder="请选择阶段">
    {action.course.stage && <Select.Option value={action.course.stage}>{action.course.stage}</Select.Option>}
  </Select>
</Form.Item>

<Form.Item name="track" label="学术方向">
  <Select placeholder="请选择学术方向">
    {action.course.track && <Select.Option value={action.course.track}>{action.course.track}</Select.Option>}
  </Select>
</Form.Item>

<Form.Item name="prerequisites" label="前置课程（可选）">
  <Select mode="multiple" placeholder="请选择前置课程">
    {/* 从其他课程获取选项 */}
  </Select>
</Form.Item>
```

### Task 3：修复问题3（课程右键菜单添加"导入课程知识"）

**修改文件**：
- `web-ui/src/components/DownloadsTree.tsx`
- `web-ui/src/api/tracker.ts`（可能需要添加新接口）

**修改内容**：
1. 在课程右键菜单中添加"导入课程知识"选项
2. 创建新的导入对话框
3. 调用`POST /domains/import`接口导入课程

**代码改动**：
```typescript
// 在CourseBranch组件的menu中添加
const menu: MenuProps = {
  items: [
    { key: 'edit', label: '修改课程' },
    { key: 'explore', label: tutorialCount >= 4 ? `探索教程（已达上限 ${tutorialCount}/4）` : locked ? '探索教程（已完成 ≥2 套，锁定）' : '探索教程' },
    { key: 'import', label: '导入课程知识' },
    { type: 'divider' },
    { key: 'delete', label: '删除课程', danger: true },
  ],
  onClick: ({ key }) => {
    if (key === 'edit') {
      if (courseRecord) onMenuAction({ kind: 'edit-course', course: courseRecord });
    } else if (key === 'delete') {
      confirmDelete();
    } else if (key === 'explore') {
      // ... 现有逻辑
    } else if (key === 'import') {
      // 打开导入对话框
    }
  },
};
```

## 验证计划

1. **验证问题1修复**：
   - 打开编辑领域对话框
   - 等待5秒以上
   - 确认表单内容没有被重置

2. **验证问题2修复**：
   - 打开编辑课程对话框
   - 确认阶段、学术方向、前置课程都是下拉选项
   - 确认选项从领域配置获取

3. **验证问题3修复**：
   - 右键点击课程
   - 确认菜单中有"导入课程知识"选项
   - 点击"导入课程知识"，确认弹出导入对话框
   - 导入课程，确认课程被正确添加

## 依赖关系

- 问题1和问题2可以独立修复
- 问题3可能依赖于后端API的实现（`POST /domains/import`接口）

## 风险与缓解

1. **风险**：轮询逻辑可能影响其他功能
   - **缓解**：只修改TreeFormModal组件，不影响其他组件

2. **风险**：新接口可能需要后端支持
   - **缓解**：先实现前端UI，后端API可以在后续迭代中添加

3. **风险**：选项数据可能不完整
   - **缓解**：从当前领域配置获取选项，确保数据一致性
