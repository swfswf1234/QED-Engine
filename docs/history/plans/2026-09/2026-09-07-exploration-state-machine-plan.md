# 文档下载管理探索状态机实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 DownloadsTree.tsx，实现领域5态和课程3态探索状态机，包括右键菜单禁用逻辑和右侧按钮状态机

**Architecture:** 在现有代码基础上，通过 Zustand store 管理探索状态，创建独立的 DomainCard 组件显示右侧按钮状态机，修改右键菜单根据 exploration_stage 字段禁用/启用菜单项

**Tech Stack:** React 19 + TypeScript + AntD + Zustand

**设计文档:** [2026-09-07-exploration-state-machine.md](2026-09-07-exploration-state-machine.md)

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `web-ui/src/components/DownloadsTree.tsx` | 主组件：树、右键菜单、状态管理 | 修改 |
| `web-ui/src/components/DomainCard.tsx` | 领域信息卡：右侧按钮状态机 | 新建 |
| `web-ui/src/stores/downloads.ts` | Downloads store：状态管理 | 修改 |
| `web-ui/src/downloads.css` | 样式：按钮状态、禁用样式 | 修改 |
| `web-ui/src/components/DownloadsTree.state.test.tsx` | 状态机测试 | 新建 |

---

## Task 1: 创建 DomainCard 组件

**Files:**
- Create: `web-ui/src/components/DomainCard.tsx`
- Test: `web-ui/src/components/DownloadsTree.state.test.tsx`

- [ ] **Step 1: 创建 DomainCard 组件骨架**

```typescript
// web-ui/src/components/DomainCard.tsx
/**
 * 领域信息卡：显示右侧按钮状态机
 * - 根据 exploration_stage 显示不同按钮
 * - 按钮禁用/loading 逻辑
 */
import { Button, Spin } from 'antd';
import { useDownloadsStore } from '../stores/downloads';
import type { DomainSystem } from '../stores';

interface DomainCardProps {
  domain: DomainSystem;
  onExplore: (domainId: string) => void;
  onConfirmDomain: (domainId: string) => void;
  onConfirmKnowledge: (domainId: string) => void;
}

interface ButtonState {
  label: string;
  disabled: boolean;
  loading: boolean;
  onClick?: () => void;
  type?: 'primary' | 'default' | 'dashed';
}

function getDomainButtonState(
  stage: string,
  onExplore: () => void,
  onConfirmDomain: () => void,
  onConfirmKnowledge: () => void,
): ButtonState {
  switch (stage) {
    case '未开始':
      return { 
        label: '开始探索', 
        disabled: false, 
        loading: false, 
        onClick: onExplore,
        type: 'primary',
      };
    case '已生成':
      return { 
        label: '领域信息确认', 
        disabled: false, 
        loading: false, 
        onClick: onConfirmDomain,
        type: 'primary',
      };
    case '探索中':
      return { 
        label: '探索中', 
        disabled: true, 
        loading: true,
        type: 'default',
      };
    case '待确认':
      return { 
        label: '课程知识确认', 
        disabled: false, 
        loading: false, 
        onClick: onConfirmKnowledge,
        type: 'primary',
      };
    case '已完成':
      return { 
        label: '探索完成', 
        disabled: true, 
        loading: false,
        type: 'default',
      };
    default:
      return { 
        label: '开始探索', 
        disabled: false, 
        loading: false, 
        onClick: onExplore,
        type: 'primary',
      };
  }
}

export default function DomainCard({ 
  domain, 
  onExplore, 
  onConfirmDomain, 
  onConfirmKnowledge 
}: DomainCardProps) {
  const stage = domain.exploration_stage || '未开始';
  
  const buttonState = getDomainButtonState(
    stage,
    () => onExplore(domain.domain_id),
    () => onConfirmDomain(domain.domain_id),
    () => onConfirmKnowledge(domain.domain_id),
  );

  return (
    <div className="dl-domain-card">
      <div className="dl-domain-card-header">
        <h3>{domain.name}</h3>
        <span className="dl-domain-card-stage">状态：{stage}</span>
      </div>
      <div className="dl-domain-card-info">
        <p>{domain.description || '暂无描述'}</p>
        <p>阶段：{domain.stages?.join('、') || '未设置'}</p>
        <p>课程数：{domain.courses.length}</p>
      </div>
      <div className="dl-domain-card-action">
        <Button
          type={buttonState.type}
          disabled={buttonState.disabled}
          loading={buttonState.loading}
          onClick={buttonState.onClick}
          block
        >
          {buttonState.label}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行测试验证组件创建**

Run: `cd web-ui && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/components/DomainCard.tsx
git commit -m "feat: add DomainCard component with button state machine"
```

---

## Task 2: 修改 DownloadsTree 右键菜单

**Files:**
- Modify: `web-ui/src/components/DownloadsTree.tsx:586-611` (domainMenu)
- Modify: `web-ui/src/components/DownloadsTree.tsx:114-142` (CourseBranch menu)

- [ ] **Step 1: 修改领域右键菜单禁用逻辑**

```typescript
// 在 DownloadsTree.tsx 中，修改 domainMenu 函数
const domainMenu = (d: DomainSystem): MenuProps => ({
  items: [
    { key: 'edit', label: '编辑领域知识' },
    { key: 'explore', label: '探索领域知识',
      disabled: d.exploration_stage === '已完成' },
    { key: 'import', label: '导入领域知识',
      disabled: d.exploration_stage === '已完成' },
    { key: 'add-course', label: '添加课程',
      disabled: d.exploration_stage === '未开始' || d.exploration_stage === '已生成' },
    { type: 'divider' },
    { key: 'delete', label: '删除领域', danger: true },
  ],
  onClick: ({ key }) => {
    if (key === 'explore') {
      // 无弹窗直触：立即调用探索接口
      if (d.exploration_stage === '未开始') {
        // 调用生成领域知识接口
        void startDomainExplore(d.domain_id);
      }
      // 已生成状态下点击无操作（等待领域信息确认）
      // 探索中状态下点击无操作
      // 待确认状态下点击 = 重新探索（调用生成领域知识接口）
      if (d.exploration_stage === '待确认') {
        void startDomainExplore(d.domain_id);
      }
    } else if (key === 'import') {
      // 导入领域知识：选择 JSON 文件
      importTargetRef.current = d.domain_id;
      fileInputRef.current?.click();
    } else if (key === 'add-course') {
      setFormAction({ kind: 'add-course', domain: d });
    } else if (key === 'edit') {
      setFormAction({ kind: 'edit-domain', domain: d });
    } else if (key === 'delete') {
      confirmDeleteDomain(d);
    }
  },
});
```

- [ ] **Step 2: 修改课程右键菜单禁用逻辑**

```typescript
// 在 DownloadsTree.tsx 中，修改 CourseBranch 组件的 menu
const menu: MenuProps = {
  items: [
    { key: 'edit', label: '编辑课程' },
    { key: 'explore', label: '探索课程',
      disabled: courseRecord?.exploration_stage === '已完成' },
    { key: 'import', label: '导入课程知识',
      disabled: courseRecord?.exploration_stage === '已完成' },
    { type: 'divider' },
    { key: 'delete', label: '删除课程', danger: true },
  ],
  onClick: ({ key }) => {
    if (key === 'edit') {
      if (courseRecord) onMenuAction({ kind: 'edit-course', course: courseRecord });
    } else if (key === 'delete') {
      confirmDelete();
    } else if (key === 'explore') {
      // 无弹窗直触：立即调用探索接口
      if (courseRecord?.exploration_stage !== '已完成') {
        void startCourseExplore(course.id);
      }
    } else if (key === 'import') {
      // 导入课程知识：选择 JSON 文件
      onImportKnowledge(course.id);
    }
  },
};
```

- [ ] **Step 3: 运行测试验证菜单修改**

Run: `cd web-ui && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/components/DownloadsTree.tsx
git commit -m "feat: update right-click menu disabled logic based on exploration_stage"
```

---

## Task 3: 创建探索接口函数

**Files:**
- Create: `web-ui/src/api/explore-helpers.ts`
- Modify: `web-ui/src/components/DownloadsTree.tsx`

- [ ] **Step 1: 创建探索接口辅助函数**

```typescript
// web-ui/src/api/explore-helpers.ts
/**
 * 探索接口辅助函数
 * - 封装探索领域知识、探索课程等接口调用
 */
import { useDownloadsStore } from '../stores/downloads';
import { useExploreUiStore } from '../stores/explore';
import { ApiError, describeError } from './client';

/**
 * 开始领域探索（生成领域知识）
 * - 未开始状态：调用接口后流转到已生成
 * - 待确认状态：调用接口后流转到探索中（重新探索）
 */
export async function startDomainExplore(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // TODO: 调用实际的生成领域知识接口
    // await api.post(`/domains/${domainId}/explore`);
    
    // 模拟成功
    message.success('领域探索已开始');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 确认领域信息（生成课程知识）
 * - 已生成状态：调用接口后流转到探索中
 */
export async function confirmDomainInfo(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // TODO: 调用实际的生成课程知识接口
    // await api.post(`/domains/${domainId}/confirm`);
    
    // 模拟成功
    message.success('领域信息已确认，开始生成课程知识');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 确认课程知识
 * - 待确认状态：调用接口后流转到已完成
 */
export async function confirmCourseKnowledge(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // TODO: 调用实际的课程知识确认接口
    // await api.post(`/domains/${domainId}/knowledge-confirm`);
    
    // 模拟成功
    message.success('课程知识已确认');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 开始课程探索（生成课程知识）
 * - 未开始状态：调用接口后流转到探索中
 */
export async function startCourseExplore(courseId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // TODO: 调用实际的生成课程知识接口
    // await api.post(`/courses/${courseId}/explore`);
    
    // 模拟成功
    message.success('课程探索已开始');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}
```

- [ ] **Step 2: 在 DownloadsTree 中引入辅助函数**

```typescript
// 在 DownloadsTree.tsx 顶部添加导入
import {
  startDomainExplore,
  confirmDomainInfo,
  confirmCourseKnowledge,
  startCourseExplore,
} from '../api/explore-helpers';
```

- [ ] **Step 3: 运行测试验证函数创建**

Run: `cd web-ui && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/api/explore-helpers.ts web-ui/src/components/DownloadsTree.tsx
git commit -m "feat: add explore helper functions for domain and course exploration"
```

---

## Task 4: 集成 DomainCard 到 DownloadsTree

**Files:**
- Modify: `web-ui/src/components/DownloadsTree.tsx`
- Modify: `web-ui/src/downloads.css`

- [ ] **Step 1: 在 DownloadsTree 中添加 DomainCard**

```typescript
// 在 DownloadsTree 组件中，找到右侧面板区域，添加 DomainCard
// 假设右侧面板在 DownloadsPage 组件中，需要修改 DownloadsPage

// web-ui/src/pages/DownloadsPage.tsx 或类似文件
import DomainCard from '../components/DomainCard';
import { startDomainExplore, confirmDomainInfo, confirmCourseKnowledge } from '../api/explore-helpers';

// 在右侧面板中添加 DomainCard
{selected?.kind === 'domain' && selectedDomain && (
  <DomainCard
    domain={selectedDomain}
    onExplore={startDomainExplore}
    onConfirmDomain={confirmDomainInfo}
    onConfirmKnowledge={confirmCourseKnowledge}
  />
)}
```

- [ ] **Step 2: 添加 DomainCard 样式**

```css
/* 在 downloads.css 中添加 DomainCard 样式 */
.dl-domain-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.dl-domain-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.dl-domain-card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.dl-domain-card-stage {
  font-size: 12px;
  color: #666;
}

.dl-domain-card-info {
  margin-bottom: 16px;
}

.dl-domain-card-info p {
  margin: 4px 0;
  font-size: 14px;
  color: #333;
}

.dl-domain-card-action {
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}
```

- [ ] **Step 3: 运行测试验证集成**

Run: `cd web-ui && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/pages/DownloadsPage.tsx web-ui/src/downloads.css
git commit -m "feat: integrate DomainCard into DownloadsPage with styling"
```

---

## Task 5: 编写状态机测试

**Files:**
- Create: `web-ui/src/components/DownloadsTree.state.test.tsx`

- [ ] **Step 1: 创建状态机测试文件**

```typescript
// web-ui/src/components/DownloadsTree.state.test.tsx
/**
 * DownloadsTree 状态机测试
 * - 测试领域5态和课程3态的右键菜单禁用逻辑
 * - 测试右侧按钮状态机
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import DownloadsTree from './DownloadsTree';
import { theme } from '../theme';
import { useDownloadsStore } from '../stores/downloads';
import type { DomainSystem, KnowledgeDetail, KnowledgeRecord } from '../stores';

function course(courseId: string, name: string, overrides?: Partial<DomainSystem['courses'][0]>) {
  return { 
    course_id: courseId, 
    name, 
    aliases: [], 
    stage: '基础', 
    track: '分析学',
    description: '课程描述',
    prerequisites: [],
    exploration_stage: '未开始',
    ...overrides
  };
}

function domainFixture(
  courses: ReturnType<typeof course>[], 
  explorationStage: string = '未开始',
  classicTracks?: Array<{ name: string; summary?: string; kind?: string }>
): DomainSystem[] {
  return [{ 
    domain_id: 'dm1', 
    name: '高等数学', 
    description: '高等数学领域', 
    stages: ['基础', '主干', '分支', '前沿'],
    classic_tracks: classicTracks || [
      { name: '分析学', summary: '数学分析方向', kind: 'main' },
      { name: '代数学', summary: '线性代数方向', kind: 'main' },
    ],
    exploration_stage: explorationStage,
    courses 
  }];
}

const emptyDetails: Record<string, KnowledgeDetail> = {};

function seed(domains: DomainSystem[], knowledge: KnowledgeRecord[]) {
  useDownloadsStore.setState({
    domains, knowledge, details: emptyDetails,
    systemError: null, knowledgeError: null, error: null,
  });
}

function renderTree() {
  return render(
    <ConfigProvider theme={theme}>
      <AntApp>
        <DownloadsTree />
      </AntApp>
    </ConfigProvider>
  );
}

describe('DownloadsTree 状态机', () => {
  beforeEach(() => {
    useDownloadsStore.setState({
      domains: [], knowledge: [], details: emptyDetails,
      systemError: null, knowledgeError: null, error: null,
      selected: null, treeWidth: 300,
    });
  });

  describe('领域右键菜单禁用逻辑', () => {
    it('未开始状态：添加课程禁用，探索/导入可用', () => {
      seed(domainFixture([], '未开始'), []);
      renderTree();
      
      // 右键点击领域
      const domainNode = screen.getByText('高等数学');
      fireEvent.contextMenu(domainNode);
      
      // 验证菜单项禁用状态
      expect(screen.getByText('添加课程')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('探索领域知识')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByText('导入领域知识')).not.toHaveAttribute('aria-disabled');
    });

    it('已生成状态：添加课程禁用，探索/导入可用', () => {
      seed(domainFixture([], '已生成'), []);
      renderTree();
      
      const domainNode = screen.getByText('高等数学');
      fireEvent.contextMenu(domainNode);
      
      expect(screen.getByText('添加课程')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('探索领域知识')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByText('导入领域知识')).not.toHaveAttribute('aria-disabled');
    });

    it('探索中状态：所有菜单项可用', () => {
      seed(domainFixture([], '探索中'), []);
      renderTree();
      
      const domainNode = screen.getByText('高等数学');
      fireEvent.contextMenu(domainNode);
      
      expect(screen.getByText('添加课程')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByText('探索领域知识')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByText('导入领域知识')).not.toHaveAttribute('aria-disabled');
    });

    it('待确认状态：所有菜单项可用，探索领域知识可重新探索', () => {
      seed(domainFixture([], '待确认'), []);
      renderTree();
      
      const domainNode = screen.getByText('高等数学');
      fireEvent.contextMenu(domainNode);
      
      expect(screen.getByText('添加课程')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByText('探索领域知识')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByText('导入领域知识')).not.toHaveAttribute('aria-disabled');
    });

    it('已完成状态：探索/导入禁用，添加课程可用', () => {
      seed(domainFixture([], '已完成'), []);
      renderTree();
      
      const domainNode = screen.getByText('高等数学');
      fireEvent.contextMenu(domainNode);
      
      expect(screen.getByText('探索领域知识')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('导入领域知识')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('添加课程')).not.toHaveAttribute('aria-disabled');
    });
  });

  describe('课程右键菜单禁用逻辑', () => {
    it('未开始状态：所有菜单项可用', () => {
      seed(domainFixture([course('c1', '微积分', { exploration_stage: '未开始' })]), []);
      renderTree();
      
      // 展开领域
      const domainNode = screen.getByText('高等数学');
      fireEvent.click(domainNode);
      
      // 右键点击课程
      const courseNode = screen.getByText('微积分');
      fireEvent.contextMenu(courseNode);
      
      expect(screen.getByText('探索课程')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByText('导入课程知识')).not.toHaveAttribute('aria-disabled');
    });

    it('探索中状态：所有菜单项可用', () => {
      seed(domainFixture([course('c1', '微积分', { exploration_stage: '探索中' })]), []);
      renderTree();
      
      const domainNode = screen.getByText('高等数学');
      fireEvent.click(domainNode);
      
      const courseNode = screen.getByText('微积分');
      fireEvent.contextMenu(courseNode);
      
      expect(screen.getByText('探索课程')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByText('导入课程知识')).not.toHaveAttribute('aria-disabled');
    });

    it('已完成状态：探索/导入禁用', () => {
      seed(domainFixture([course('c1', '微积分', { exploration_stage: '已完成' })]), []);
      renderTree();
      
      const domainNode = screen.getByText('高等数学');
      fireEvent.click(domainNode);
      
      const courseNode = screen.getByText('微积分');
      fireEvent.contextMenu(courseNode);
      
      expect(screen.getByText('探索课程')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('导入课程知识')).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
```

- [ ] **Step 2: 运行测试验证**

Run: `cd web-ui && npm test -- DownloadsTree.state.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/components/DownloadsTree.state.test.tsx
git commit -m "test: add state machine tests for DownloadsTree"
```

---

## Task 6: 完善探索流程

**Files:**
- Modify: `web-ui/src/components/DownloadsTree.tsx`
- Modify: `web-ui/src/api/explore-helpers.ts`

- [ ] **Step 1: 完善领域探索流程**

```typescript
// 在 explore-helpers.ts 中完善 startDomainExplore 函数
export async function startDomainExplore(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // 调用实际的生成领域知识接口
    // 这里需要根据后端实际接口调整
    const response = await fetch(`/api/domains/${domainId}/explore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`探索失败: ${response.statusText}`);
    }
    
    message.success('领域探索已开始');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}
```

- [ ] **Step 2: 完善领域信息确认流程**

```typescript
// 在 explore-helpers.ts 中完善 confirmDomainInfo 函数
export async function confirmDomainInfo(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // 调用实际的生成课程知识接口
    const response = await fetch(`/api/domains/${domainId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`确认失败: ${response.statusText}`);
    }
    
    message.success('领域信息已确认，开始生成课程知识');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}
```

- [ ] **Step 3: 完善课程知识确认流程**

```typescript
// 在 explore-helpers.ts 中完善 confirmCourseKnowledge 函数
export async function confirmCourseKnowledge(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // 调用实际的课程知识确认接口
    const response = await fetch(`/api/domains/${domainId}/knowledge-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`确认失败: ${response.statusText}`);
    }
    
    message.success('课程知识已确认');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}
```

- [ ] **Step 4: 运行完整测试**

Run: `cd web-ui && npm test`
Expected: ALL PASS

- [ ] **Step 5: 构建验证**

Run: `cd web-ui && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/components/DownloadsTree.tsx web-ui/src/api/explore-helpers.ts
git commit -m "feat: complete exploration flow implementation"
```

---

## Task 7: 端到端验证

**Files:**
- None (验证任务)

- [ ] **Step 1: 启动开发服务器**

Run: `cd web-ui && npm run dev`
Expected: Server running at http://localhost:5173

- [ ] **Step 2: 手动测试领域探索流程**

1. 创建新领域 → 验证状态为"未开始"
2. 右键点击"探索领域知识" → 验证状态变为"已生成"
3. 点击右侧"领域信息确认" → 验证状态变为"探索中"
4. 等待探索完成 → 验证状态变为"待确认"
5. 点击右侧"课程知识确认" → 验证状态变为"已完成"

- [ ] **Step 3: 手动测试课程探索流程**

1. 在"未开始"状态下，右键点击"探索课程" → 验证状态变为"探索中"
2. 等待探索完成 → 验证状态变为"已完成"

- [ ] **Step 4: 验证右键菜单禁用逻辑**

1. 在"已完成"状态下，验证"探索领域知识"和"导入领域知识"禁用
2. 在"未开始"和"已生成"状态下，验证"添加课程"禁用

- [ ] **Step 5: 运行所有测试**

Run: `cd web-ui && npm test`
Expected: ALL PASS

- [ ] **Step 6: 最终构建**

Run: `cd web-ui && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 7: 提交代码**

```bash
git add -A
git commit -m "feat: implement exploration state machine for DownloadsTree"
```

---

## 自审检查清单

- [ ] Spec coverage: 领域5态和课程3态全部覆盖
- [ ] Placeholder scan: 无 TBD/TODO
- [ ] Type consistency: 所有类型定义一致
- [ ] 测试覆盖: 状态机测试完整
- [ ] 构建成功: tsc + vite 无错误
- [ ] 文档更新: 设计文档已创建

---

## 完成标准

1. ✅ 领域5态流转完整（未开始→已生成→探索中→待确认→已完成）
2. ✅ 课程3态流转完整（未开始→探索中→已完成）
3. ✅ 探索领域知识/探索课程无弹窗直触
4. ✅ 右侧按钮状态机正确（标签/禁用/loading）
5. ✅ 右键菜单禁用逻辑正确
6. ✅ 待确认状态下探索领域知识可重新进入探索中
7. ✅ 已完成状态下探索/导入禁用
8. ✅ 添加课程在未开始/已生成状态下禁用
9. ✅ vitest全绿 + tsc零错 + build成功
