import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Knowledge from './Knowledge';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useKnowledgeStore } from '../stores/knowledge';
import type { Catalog } from '../stores';

const catalogFixture: Catalog = {
  id: 'math-qe',
  name: '突破朗道位垒',
  description: '博士资格考试目录',
  status: 'frozen',
  targets: [
    { id: '01-rudin', course_id: '01_math_analysis', course_name: '数学分析', kind: 'book', title: '数学分析原理', authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'] },
    { id: '02-axler', course_id: '02_linear_algebra', course_name: '线性代数', kind: 'book', title: '线性代数应该这样学', authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'] },
    { id: '03-munkres', course_id: '03_topology', course_name: '点集拓扑', kind: 'book', title: 'Topology', authors: [], language: 'en', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'] },
  ],
};

function renderKnowledge() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}>
        <Knowledge />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('学习中心·知识结构浏览 Knowledge（原型）', () => {
  beforeEach(() => {
    useKnowledgeStore.setState({
      catalogTargets: [], loading: false, error: null,
      domain: '数学', selectedCourseId: null,
    });
  });

  it('渲染领域面板 + 课程泡泡图（分层 + 连线）', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/catalogs')) {
        return Promise.resolve(new Response(JSON.stringify(catalogFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/courses')) {
        // 返回含 stage/prerequisites 的课程数据
        return Promise.resolve(new Response(JSON.stringify([
          {
            domain_id: 'math', name: '高等数学', stages: ['本科基础', '研究生基础'],
            courses: [
              { course_id: '01_math_analysis', name: '数学分析', stage: '本科基础', prerequisites: [] },
              { course_id: '02_linear_algebra', name: '线性代数', stage: '本科基础', prerequisites: [] },
              { course_id: '03_topology', name: '点集拓扑', stage: '本科基础', prerequisites: ['01_math_analysis', '02_linear_algebra'] },
            ],
          },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderKnowledge();
    expect(await screen.findByText('学习中心 · 知识结构浏览')).toBeInTheDocument();
    // 领域面板
    expect(screen.getByText('领域')).toBeInTheDocument();
    expect(screen.getByText('数学')).toBeInTheDocument();
    // 泡泡节点（3 门课）
    const bubbles = await screen.findAllByRole('button', { name: /课程 / });
    expect(bubbles.length).toBeGreaterThanOrEqual(3);
    // 连线 SVG 存在（依赖边：03 点集拓扑 → 01/02）
    const svg = document.querySelector('svg[aria-label="课程依赖图"]');
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll('path').length).toBeGreaterThanOrEqual(2);
    // 层标签
    expect(screen.getByText('本科基础')).toBeInTheDocument();
    expect(screen.getByText('研究生基础')).toBeInTheDocument();
  });

  it('点击泡泡 → 知识结构图态（空态 + 返回）', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/catalogs')) {
        return Promise.resolve(new Response(JSON.stringify(catalogFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderKnowledge();
    const bubble = await screen.findByRole('button', { name: '课程 数学分析' });
    fireEvent.click(bubble);
    expect(useKnowledgeStore.getState().selectedCourseId).toBe('01_math_analysis');
    expect(await screen.findByText('《数学分析》知识点梳理')).toBeInTheDocument();
    expect(screen.getByText(/解析产物管线/)).toBeInTheDocument();
    // 返回课程结构图
    fireEvent.click(screen.getByRole('button', { name: /返回课程结构/ }));
    expect(useKnowledgeStore.getState().selectedCourseId).toBeNull();
    expect(await screen.findByRole('button', { name: '课程 线性代数' })).toBeInTheDocument();
  });

  it('catalog 不可达 → 降级横幅 + 课程图空态', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    renderKnowledge();
    expect(await screen.findByText('课程目录数据不可达')).toBeInTheDocument();
    expect(screen.getByText('暂无课程目录')).toBeInTheDocument();
  });
});