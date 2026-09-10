/**
 * DownloadsTree 探索入口测试 v2（口径：PLAN-033 §2.3 统一表，2026-09-08 重写）
 * - hover 🔍 已移除：课程探索走右键菜单「探索课程」，无弹窗直触门面端点
 *   （课程 → POST /courses/{id}/explore-knowledge；领域 → POST /domains/{id}/explore-knowledge）
 * - 菜单标签与禁用矩阵对齐实现（编辑课程/添加课程/编辑领域知识）
 * - 状态色点：none(未探索)/insufficient(不足)/ready(达标) 三档 class 保留
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import DownloadsTree from './DownloadsTree';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useDownloadsStore } from '../stores/downloads';
import { useExploreUiStore } from '../stores/explore';
import type { BookRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from '../stores';

function course(courseId: string, name: string, overrides?: Partial<DomainSystem['courses'][0]>) {
  return { course_id: courseId, name, aliases: [], stage: '', prerequisites: [], ...overrides };
}

function domainFixture(courses: ReturnType<typeof course>[]): DomainSystem[] {
  return [{ domain_id: 'dm1', name: '高等数学', description: '', stages: [], courses }];
}

function kn(partial: Partial<KnowledgeRecord> & { knowledge_id: string; course_id: string }): KnowledgeRecord {
  return {
    domain_id: 'dm1', kind: 'tutorial', set_no: '', name: '', textbook_ref: null, exercise_ref: null,
    intro: '', status: 'draft',
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

/** 探索端点 202 受理，其余路由拒绝（fetchAll 降级仅错误提示，不影响断言） */
function stubExploreAccepted(): void {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('explore-knowledge')) {
      return Promise.resolve(new Response(
        JSON.stringify({ domain_id: 'dm1', task_id: 't1', exploration_stage: '探索中', message: '探索任务已提交' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      ));
    }
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

function exploreCalls(): Array<[string, RequestInit]> {
  return mockFetch.mock.calls.filter(([url]) => String(url).includes('explore-knowledge')) as Array<[string, RequestInit]>;
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
  return screen.findByText('探索课程');
}

describe('树节点探索入口与状态色 v2', () => {
  beforeEach(() => {
    useDownloadsStore.setState({ selected: null });
    useExploreUiStore.setState({ flowTarget: null, domainRunStatus: {} });
  });

  it('hover 探索按钮已移除；未锁定课程右键「探索课程」→ 直触课程探索端点', async () => {
    seed(domainFixture([course('01_math_analysis', '数学分析'), course('02_linear_algebra', '线性代数')]), []);
    stubExploreAccepted();
    renderTree();
    // hover 按钮不复存在
    expect(screen.queryByRole('button', { name: /探索课程：/ })).toBeNull();
    const item = await openCourseContextMenu('数学分析');
    fireEvent.click(item);
    await waitFor(() => {
      expect(exploreCalls().some(([url]) => url.includes('/courses/01_math_analysis/explore-knowledge'))).toBe(true);
    });
    expect(document.querySelector('.dl-tree-course .explore-dot-none')).not.toBeNull();
  });

  it('已完成课程 → 达标色点；右键「探索课程」禁用，点击不发起端点', async () => {
    seed(
      domainFixture([course('01_math_analysis', '数学分析', { exploration_stage: '已完成' })]),
      [
        kn({ knowledge_id: 'k1', course_id: '01_math_analysis', status: 'completed' }),
        kn({ knowledge_id: 'k2', course_id: '01_math_analysis', status: 'completed' }),
      ],
    );
    stubExploreAccepted();
    renderTree();
    expect(document.querySelector('.dl-tree-course .explore-dot-ready')).not.toBeNull();
    fireEvent.contextMenu(screen.getByText('数学分析'));
    await new Promise((r) => setTimeout(r, 50));
    const items = await screen.findAllByRole('menuitem');
    const exploreItem = items.find((el) => el.textContent?.includes('探索课程'));
    expect(exploreItem).toBeDefined();
    expect(exploreItem!).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(exploreItem!);
    expect(exploreCalls()).toHaveLength(0);
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
    stubExploreAccepted();
    renderTree();
    expect(document.querySelector('.dl-tree-course .explore-dot-insufficient')).not.toBeNull();
    const item = await openCourseContextMenu('数学分析');
    fireEvent.click(item);
    await waitFor(() => {
      expect(exploreCalls().some(([url]) => url.includes('/courses/01_math_analysis/explore-knowledge'))).toBe(true);
    });
  });

  it('领域右键菜单含 编辑领域知识/探索领域知识/导入领域知识/添加课程/删除领域；探索 → 直触领域探索端点', async () => {
    seed(domainFixture([]), []);
    stubExploreAccepted();
    renderTree();
    fireEvent.contextMenu(screen.getByText('高等数学'));
    expect(await screen.findByText('探索领域知识')).toBeInTheDocument();
    expect(screen.getByText('导入领域知识')).toBeInTheDocument();
    expect(screen.getByText('编辑领域知识')).toBeInTheDocument();
    expect(screen.getByText('添加课程')).toBeInTheDocument();
    expect(screen.getByText('删除领域')).toBeInTheDocument();
    // PLAN-033 §2.3：点击探索直触五态门面端点（无弹窗）
    fireEvent.click(screen.getByText('探索领域知识'));
    await waitFor(() => {
      expect(exploreCalls().some(([url]) => url.includes('/domains/dm1/explore-knowledge'))).toBe(true);
    });
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
    await screen.findByText('探索课程');
    // 课程菜单项在场
    expect(screen.getByText('编辑课程')).toBeInTheDocument();
    expect(screen.getByText('删除课程')).toBeInTheDocument();
    // 领域菜单项不得同时出现（contextmenu 冒泡已阻断）
    expect(screen.queryByText('添加课程')).toBeNull();
    expect(screen.queryByText('编辑领域知识')).toBeNull();
    expect(screen.queryByText('删除领域')).toBeNull();
    expect(screen.queryByText(/探索领域知识|导入领域知识/)).toBeNull();
  });

  it('添加课程菜单项：探索中时禁用（探索中除删除外禁用口径）', async () => {
    // 探索中 → 禁用
    const exploring = [{ ...domainFixture([])[0], domain_id: 'dm_exp', exploration_stage: '探索中' }] as DomainSystem[];
    seed(exploring, []);
    renderTree();
    fireEvent.contextMenu(screen.getByText('高等数学'));
    await new Promise((r) => setTimeout(r, 50));
    const items = await screen.findAllByRole('menuitem');
    const addBtn = items.find((el) => el.textContent === '添加课程');
    expect(addBtn).toBeDefined();
    expect(addBtn!).toHaveAttribute('aria-disabled', 'true');
  });
});
