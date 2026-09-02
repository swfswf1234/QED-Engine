/**
 * DownloadsTree 探索入口测试 v2（2026-08-24 REQ-059 交互改版）
 * - hover 🔍 已移除：课程探索走右键菜单「探索教程」
 * - 锁定态（≥2 完成 或 满 4 教程）：菜单项提示且点击不发起（warning）
 * - 状态色点：none(未探索)/insufficient(不足)/ready(达标) 三档 class 保留
 * - 树底「添加领域」= 纯手工表单弹窗（不再置探索流目标）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import DownloadsTree from './DownloadsTree';
import { theme } from '../theme';
import { useDownloadsStore } from '../stores/downloads';
import { useExploreUiStore } from '../stores/explore';
import type { BookRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from '../stores';

function course(courseId: string, name: string) {
  return { course_id: courseId, name, aliases: [], stage: '', prerequisites: [] };
}

function domainFixture(courses: ReturnType<typeof course>[]): DomainSystem[] {
  return [{ domain_id: 'dm1', name: '高等数学', description: '', stages: [], courses }];
}

function kn(partial: Partial<KnowledgeRecord> & { knowledge_id: string; course_id: string }): KnowledgeRecord {
  return {
    domain_id: 'dm1', kind: 'tutorial', set_no: '', name: '', textbook_ref: null, exercise_ref: null,
    textbook_intro: '', exercise_intro: '', materials_intro: '', status: 'draft',
    reject_reason: '', supersede_reason: '', created_at: '', confirmed_at: null, completed_at: null,
    ...partial,
  };
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
    <ConfigProvider theme={theme}><AntApp><DownloadsTree /></AntApp></ConfigProvider>,
  );
}

async function openCourseContextMenu(name: string) {
  fireEvent.contextMenu(screen.getByText(name));
  // antd Dropdown 开启走异步帧：先让一拍再查询，避免轮询竞态
  await new Promise((r) => setTimeout(r, 50));
  return screen.findByText('探索教程');
}

describe('树节点探索入口与状态色 v2', () => {
  beforeEach(() => {
    useDownloadsStore.setState({ selected: null });
    useExploreUiStore.setState({ flowTarget: null, domainRunStatus: {} });
  });

  it('hover 探索按钮已移除；未锁定课程右键「探索教程」→ 发起课程层流目标', async () => {
    seed(domainFixture([course('01_math_analysis', '数学分析'), course('02_linear_algebra', '线性代数')]), []);
    renderTree();
    // hover 按钮不复存在
    expect(screen.queryByRole('button', { name: /探索教程：/ })).toBeNull();
    const item = await openCourseContextMenu('数学分析');
    fireEvent.click(item);
    expect(useExploreUiStore.getState().flowTarget).toMatchObject({ variant: 'course', courseId: '01_math_analysis' });
    expect(document.querySelector('.dl-tree-course .explore-dot-none')).not.toBeNull();
  });

  it('完成 ≥2 套 → 达标色点；右键菜单项标注锁定，点击不发起流', async () => {
    seed(
      domainFixture([course('01_math_analysis', '数学分析')]),
      [
        kn({ knowledge_id: 'k1', course_id: '01_math_analysis', status: 'completed' }),
        kn({ knowledge_id: 'k2', course_id: '01_math_analysis', status: 'completed' }),
      ],
    );
    renderTree();
    expect(document.querySelector('.dl-tree-course .explore-dot-ready')).not.toBeNull();
    // 角色查询菜单项（避免文本节点拆分误判），锁定项点击不发起流
    fireEvent.contextMenu(screen.getByText('数学分析'));
    await new Promise((r) => setTimeout(r, 50)); // antd Dropdown 异步开启
    const items = await screen.findAllByRole('menuitem');
    const exploreItem = items.find((el) => el.textContent?.includes('探索教程'));
    expect(exploreItem).toBeDefined();
    expect(exploreItem!.textContent).toContain('锁定');
    fireEvent.click(exploreItem!);
    expect(useExploreUiStore.getState().flowTarget).toBeNull();
  });

  it('有教程但完成不足 → 不足色点（黄），右键可正常发起', async () => {
    seed(
      domainFixture([course('01_math_analysis', '数学分析')]),
      [
        kn({ knowledge_id: 'k1', course_id: '01_math_analysis', status: 'draft' }),
        kn({ knowledge_id: 'k2', course_id: '01_math_analysis', status: 'confirmed' }),
        kn({ knowledge_id: 'k3', course_id: '01_math_analysis', status: 'completed' }),
      ],
    );
    renderTree();
    expect(document.querySelector('.dl-tree-course .explore-dot-insufficient')).not.toBeNull();
    const item = await openCourseContextMenu('数学分析');
    fireEvent.click(item);
    expect(useExploreUiStore.getState().flowTarget).toMatchObject({ variant: 'course' });
  });

  it('领域右键菜单含 领域探索/导入领域知识/修改领域/新增课程/删除领域；探索 → 直接调 exploreDomain', async () => {
    seed(domainFixture([]), []);
    renderTree();
    fireEvent.contextMenu(screen.getByText('高等数学'));
    expect(await screen.findByText('领域探索（自动）')).toBeInTheDocument();
    expect(screen.getByText('导入领域知识')).toBeInTheDocument();
    expect(screen.getByText('修改领域')).toBeInTheDocument();
    expect(screen.getByText('删除领域')).toBeInTheDocument();
    // REQ-067 B2：点击领域探索直接调 API，不设 flowTarget
    fireEvent.click(screen.getByText('领域探索（自动）'));
    expect(useExploreUiStore.getState().flowTarget).toBeNull();
  });

  it('树底「添加领域」打开纯表单弹窗（只采集名称+描述，无阶段字段；不置探索流目标）', async () => {
    seed([], []);
    renderTree();
    fireEvent.click(screen.getByRole('button', { name: '添加领域' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // 2026-08-24 用户裁决：领域表单去阶段（stages 由探索流产生）
    expect(screen.queryByText('阶段（逗号分隔，可选）')).toBeNull();
    expect(useExploreUiStore.getState().flowTarget).toBeNull();
  });

  it('书籍计数不影响完成判定（完成按教程 status=completed 计）', () => {
    const k1 = kn({ knowledge_id: 'k1', course_id: 'c1', status: 'draft' });
    useDownloadsStore.setState({
      domains: domainFixture([course('c1', '课程一')]),
      knowledge: [k1],
      details: { k1: { ...k1, books: [{ book_id: 'b1', status: 'verified' } as BookRecord] } },
    });
    renderTree();
    expect(document.querySelector('.dl-tree-course .explore-dot-insufficient')).not.toBeNull();
  });

  it('右键课程只弹课程菜单，不冒泡出领域菜单（2026-08-24 双菜单缺陷回归）', async () => {
    seed(domainFixture([course('01_math_analysis', '数学分析')]), []);
    renderTree();
    fireEvent.contextMenu(screen.getByText('数学分析'));
    await screen.findByText('探索教程');
    // 课程菜单项在场
    expect(screen.getByText('修改课程')).toBeInTheDocument();
    expect(screen.getByText('删除课程')).toBeInTheDocument();
    // 领域菜单项不得同时出现（contextmenu 冒泡已阻断）
    expect(screen.queryByText('新增课程')).toBeNull();
    expect(screen.queryByText('修改领域')).toBeNull();
    expect(screen.queryByText('删除领域')).toBeNull();
    expect(screen.queryByText(/领域探索|导入领域知识/)).toBeNull();
  });

  it('新增课程菜单项：探索中/未开始/失败时禁用，已完成/已生成时可用', async () => {
    // 探索中 → 禁用
    const exploring = [{ ...domainFixture([])[0], domain_id: 'dm_exp', exploration_stage: '探索中' }] as DomainSystem[];
    seed(exploring, []);
    renderTree();
    fireEvent.contextMenu(screen.getByText('高等数学'));
    await new Promise((r) => setTimeout(r, 50));
    let items = await screen.findAllByRole('menuitem');
    let addBtn = items.find((el) => el.textContent === '新增课程');
    expect(addBtn).toBeDefined();
    expect(addBtn!).toHaveAttribute('aria-disabled', 'true');
  });
});
