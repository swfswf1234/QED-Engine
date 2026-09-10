// web-ui/src/components/DownloadsTree.state.test.tsx
/**
 * DownloadsTree 状态机测试（口径：PLAN-033 §2.3/§2.5 操作×状态×接口统一表）
 * - 领域五态 + 失败异常态：探索触发=未开始/待确认（重探）/失败（重试）；
 *   探索中除删除外全部禁用；已生成走「确认领域」（卡片按钮）不重复探索
 * - 课程三态：探索课程在 探索中/已完成 禁用；导入课程知识在 已完成 禁用
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

/** 右键领域并等待菜单渲染完成 */
async function openDomainContextMenu(name: string) {
  fireEvent.contextMenu(screen.getByText(name));
  await new Promise((r) => setTimeout(r, 50));
}

/** 右键课程并等待菜单渲染完成 */
async function openCourseContextMenu(name: string) {
  fireEvent.contextMenu(screen.getByText(name));
  await new Promise((r) => setTimeout(r, 50));
}

function expectMenuItemDisabled(label: string, disabled: boolean) {
  const el = screen.getByText(label);
  if (disabled) {
    expect(el.closest('[role="menuitem"]')).toHaveAttribute('aria-disabled', 'true');
  } else {
    expect(el.closest('[role="menuitem"]')).not.toHaveAttribute('aria-disabled', 'true');
  }
}

describe('DownloadsTree 状态机', () => {
  beforeEach(() => {
    useDownloadsStore.setState({
      domains: [], knowledge: [], details: emptyDetails,
      systemError: null, knowledgeError: null, error: null,
      selected: null, treeWidth: 300,
    });
  });

  describe('领域右键菜单禁用逻辑（PLAN-033 §2.3）', () => {
    it('未开始状态：添加课程禁用，探索/导入可用', async () => {
      seed(domainFixture([], '未开始'), []);
      renderTree();

      await openDomainContextMenu('高等数学');

      expectMenuItemDisabled('添加课程', true);
      expectMenuItemDisabled('探索领域知识', false);
      expectMenuItemDisabled('导入领域知识', false);
    });

    it('已生成状态：添加课程禁用，探索禁用（确认领域走卡片按钮），导入可用', async () => {
      seed(domainFixture([], '已生成'), []);
      renderTree();

      await openDomainContextMenu('高等数学');

      expectMenuItemDisabled('添加课程', true);
      expectMenuItemDisabled('探索领域知识', true);
      expectMenuItemDisabled('导入领域知识', false);
    });

    it('探索中状态：除删除外全部禁用', async () => {
      seed(domainFixture([], '探索中'), []);
      renderTree();

      await openDomainContextMenu('高等数学');

      expectMenuItemDisabled('添加课程', true);
      expectMenuItemDisabled('探索领域知识', true);
      expectMenuItemDisabled('导入领域知识', true);
      expectMenuItemDisabled('编辑领域知识', true);
      expectMenuItemDisabled('删除领域', false);
    });

    it('待确认状态：探索（重探）/导入/添加课程可用（课程体系已产出，允许人工补充）', async () => {
      seed(domainFixture([], '待确认'), []);
      renderTree();

      await openDomainContextMenu('高等数学');

      expectMenuItemDisabled('添加课程', false);
      expectMenuItemDisabled('探索领域知识', false);
      expectMenuItemDisabled('导入领域知识', false);
    });

    it('已完成状态：探索/导入禁用，添加课程可用', async () => {
      seed(domainFixture([], '已完成'), []);
      renderTree();

      await openDomainContextMenu('高等数学');

      expectMenuItemDisabled('探索领域知识', true);
      expectMenuItemDisabled('导入领域知识', true);
      expectMenuItemDisabled('添加课程', false);
    });

    it('失败状态：菜单显示「重试探索」且可用，导入可用（失败=异常态可重试）', async () => {
      seed(domainFixture([], '失败'), []);
      renderTree();

      await openDomainContextMenu('高等数学');

      expectMenuItemDisabled('重试探索', false);
      expectMenuItemDisabled('导入领域知识', false);
      expectMenuItemDisabled('添加课程', false);
    });
  });

  describe('课程右键菜单禁用逻辑（PLAN-033 §2.5）', () => {
    it('未开始状态：探索课程可用', async () => {
      seed(domainFixture([course('c1', '微积分', { exploration_stage: '未开始' })]), []);
      renderTree();

      fireEvent.click(screen.getByText('高等数学'));

      await openCourseContextMenu('微积分');

      expectMenuItemDisabled('探索课程', false);
      expectMenuItemDisabled('导入课程知识', false);
    });

    it('探索中状态：探索课程禁用，导入课程知识可用', async () => {
      seed(domainFixture([course('c1', '微积分', { exploration_stage: '探索中' })]), []);
      renderTree();

      fireEvent.click(screen.getByText('高等数学'));

      await openCourseContextMenu('微积分');

      expectMenuItemDisabled('探索课程', true);
      expectMenuItemDisabled('导入课程知识', false);
    });

    it('已完成状态：探索课程和导入课程知识均禁用', async () => {
      seed(domainFixture([course('c1', '微积分', { exploration_stage: '已完成' })]), []);
      renderTree();

      fireEvent.click(screen.getByText('高等数学'));

      await openCourseContextMenu('微积分');

      expectMenuItemDisabled('探索课程', true);
      expectMenuItemDisabled('导入课程知识', true);
    });
  });
});
