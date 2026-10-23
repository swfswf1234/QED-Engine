/**
 * 左树「论文」派生视图节点测试（REQ-108 I6，壳 §8）
 * - 每个领域节点下、课程之后固定追加一个「论文」子节点：派生视图，不是课程、不落课程记录
 * - 计数＝该领域 kind=paper 书行数（含落位到课程的论文，一处看全）
 * - 铁律：节点不读也不写 exploration_stage，课程态/领域态都不影响它可点
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import DownloadsTree from './DownloadsTree';
import { theme } from '../theme';
import { useDownloadsStore } from '../stores/downloads';
import type { BookRecord, DomainSystem } from '../stores';

function paper(id: string, overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    book_id: id, title: `论文${id}`, original_title: null, part: '', authors: [], publisher: 'arXiv',
    edition: '', year: 2024, language: 'en', roles: [], status: 'verified', retire_reason: '',
    holding: 'owned', file_path: null, priority: null, notes: null, domain_id: 'dm1',
    created_at: '', updated_at: '', kind: 'paper', ...overrides,
  };
}

function seed(domains: DomainSystem[], paperBooks: BookRecord[]) {
  useDownloadsStore.setState({
    domains, knowledge: [], details: {}, systemError: null, knowledgeError: null, error: null,
    paperBooks, selected: null, filters: { domain: '', course: '', stage: '' },
  });
}

const domainWithCourses: DomainSystem[] = [{
  domain_id: 'dm1',
  name: '高等数学',
  description: '',
  stages: ['基础'],
  exploration_stage: '已完成',
  courses: [{ course_id: 'c1', name: '数学分析', aliases: [], stage: '基础', prerequisites: [] }],
}];

function renderTree() {
  return render(
    <ConfigProvider theme={theme}>
      <AntApp>
        <DownloadsTree />
      </AntApp>
    </ConfigProvider>,
  );
}

beforeEach(() => {
  seed(domainWithCourses, []);
});

describe('左树论文节点', () => {
  it('课程之后固定追加「论文」子节点，计数取领域全量（含课程落位）', () => {
    seed(domainWithCourses, [paper('p1'), paper('p2', { course_id: 'c1' }), paper('p3', { domain_id: 'cs' })]);
    renderTree();
    const node = screen.getByTestId('tree-papers-node');
    expect(node).toHaveTextContent('论文');
    expect(node).toHaveTextContent('2 篇');
    const courseEl = screen.getByText('数学分析');
    // 追加位置：课程分支之后
    expect(node.compareDocumentPosition(courseEl) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('点「论文」节点 → papers 选中（右栏进论文栏视图）', () => {
    seed(domainWithCourses, [paper('p1')]);
    renderTree();
    fireEvent.click(screen.getByTestId('tree-papers-node'));
    expect(useDownloadsStore.getState().selected).toEqual({ kind: 'papers', id: 'dm1' });
  });

  it('零论文也固定成节点（可点进空态视图，不因 exploration_stage 隐藏）', () => {
    seed([{ ...domainWithCourses[0], exploration_stage: '探索中' }], []);
    renderTree();
    const node = screen.getByTestId('tree-papers-node');
    expect(node).toHaveTextContent('0 篇');
    fireEvent.click(node);
    expect(useDownloadsStore.getState().selected).toEqual({ kind: 'papers', id: 'dm1' });
  });
});
