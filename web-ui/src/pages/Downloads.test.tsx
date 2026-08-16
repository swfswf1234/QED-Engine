import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Downloads from './Downloads';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useDownloadsStore } from '../stores/downloads';
import type { Catalog, SelectionRecord } from '../stores';

const catalogFixture: Catalog = {
  id: 'math-qe',
  name: '突破朗道位垒',
  description: '博士资格考试目录',
  status: 'frozen',
  targets: [
    { id: '01-rudin', course_id: '01_math_analysis', course_name: '数学分析', kind: 'book', title: '数学分析原理', authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'] },
    { id: '02-axler', course_id: '02_linear_algebra', course_name: '线性代数', kind: 'book', title: '线性代数应该这样学', authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'] },
  ],
};

function sel(partial: Partial<SelectionRecord> & { selection_id: string; course_id: string }): SelectionRecord {
  return {
    title: '书目', authors: [], roles: ['textbook'], version: {}, vols: [], set_no: '',
    evaluation: null, note: '', review_note: '', status: 'candidate', reject_reason: '',
    supersede_reason: '', created_at: '', confirmed_at: null,
    download_stats: { total: 0, downloaded: 0, approved: 0 }, downloads: [],
    ...partial,
  };
}

const selectionsFixture: SelectionRecord[] = [
  sel({ selection_id: 's1', course_id: '01_math_analysis', set_no: '1', status: 'confirmed', title: 'Rudin 中译', downloads: [{ download_id: 'd1', selection_id: 's1', vol: 'v1', roles: ['textbook'], file_hint: '', sha256: null, relative_path: '', page_count: null, status: 'approved', reject_reason: '', rejected_by: '' }] }),
  sel({ selection_id: 's2', course_id: '01_math_analysis', status: 'candidate', title: '候选书目' }),
  sel({ selection_id: 's3', course_id: '02_linear_algebra', status: 'candidate', title: '线性代数候选' }),
];

function mockApi(routes: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => {
    const hit = Object.keys(routes).find((k) => url.includes(k));
    if (!hit) return Promise.reject(new TypeError(`no route: ${url}`));
    return Promise.resolve(
      new Response(JSON.stringify(routes[hit]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });
}

function renderDownloads() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}>
        <Downloads />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('下载管理 Downloads（Phase 4a）', () => {
  beforeEach(() => {
    useDownloadsStore.setState({
      catalogTargets: [], selections: [], loading: false, error: null,
      catalogError: null, selectionsError: null,
      filters: { domain: '', course: '', status: '' }, selected: null, treeWidth: 400,
    });
  });

  it('渲染左树：领域常驻展开、课程默认折叠、套1 教程含条目', async () => {
    mockApi({ '/catalogs/math-qe': catalogFixture, '/selections': selectionsFixture });
    renderDownloads();
    expect(await screen.findByText('文档下载管理')).toBeInTheDocument();
    // 领域（常驻展开）与课程名
    expect(await screen.findByText('分析')).toBeInTheDocument();
    expect(screen.getByText('代数')).toBeInTheDocument();
    // 课程默认折叠：套1 条目不可见，点击课程名展开
    expect(screen.queryByText('套1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('数学分析'));
    expect(await screen.findByText('套1')).toBeInTheDocument();
    // 套1 展开显示条目书名 + 册明细数
    expect(screen.getByText('候选书目')).toBeInTheDocument();
    fireEvent.click(screen.getByText('套1'));
    expect(await screen.findByText('《Rudin 中译》')).toBeInTheDocument();
    expect(screen.getByText('1 册明细')).toBeInTheDocument();
  });

  it('领域点击 → 选中 + 联动筛选（领域筛选，清课程）', async () => {
    mockApi({ '/catalogs/math-qe': catalogFixture, '/selections': selectionsFixture });
    renderDownloads();
    await screen.findByText('分析');
    fireEvent.click(screen.getByText('分析'));
    const st = useDownloadsStore.getState();
    expect(st.selected).toEqual({ kind: 'domain', id: '分析' });
    expect(st.filters).toEqual({ domain: '分析', course: '', status: '' });
    expect(await screen.findByText('筛选结果：2 条表1 书目（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
  });

  it('课程点击 → 展开 + 选中 + 联动课程筛选（领域同步）', async () => {
    mockApi({ '/catalogs/math-qe': catalogFixture, '/selections': selectionsFixture });
    renderDownloads();
    await screen.findByText('分析');
    fireEvent.click(screen.getByText('数学分析'));
    const st = useDownloadsStore.getState();
    expect(st.selected).toEqual({ kind: 'course', id: '01_math_analysis' });
    expect(st.filters).toEqual({ domain: '分析', course: '01_math_analysis', status: '' });
    expect(await screen.findByText('筛选结果：2 条表1 书目（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
  });

  it('筛选栏：状态筛选与树选择独立叠加 AND', async () => {
    mockApi({ '/catalogs/math-qe': catalogFixture, '/selections': selectionsFixture });
    renderDownloads();
    await screen.findByText('分析');
    // 树选课程（筛选 course=01_math_analysis）
    fireEvent.click(screen.getByText('数学分析'));
    // 手动改状态筛选 → confirmed
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '状态筛选' }));
    fireEvent.click(await screen.findByTitle('确认'));
    await waitFor(() => {
      expect(useDownloadsStore.getState().filters.status).toBe('confirmed');
    });
    expect(await screen.findByText('筛选结果：1 条表1 书目（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
  });

  it('8901 不可达（/selections 503）→ 表1 降级提示，树目录正常', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/catalogs/math-qe')) {
        return Promise.resolve(
          new Response(JSON.stringify(catalogFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/selections')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'QED-Tracker 服务不可达' }), { status: 503, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderDownloads();
    expect(await screen.findByText('表1 数据不可达')).toBeInTheDocument();
    // 树仍可用（catalog 正常）
    expect(screen.getByText('分析')).toBeInTheDocument();
    expect(screen.getByText('代数')).toBeInTheDocument();
    // 无整体错误横幅
    expect(screen.queryByText('下载管理数据获取失败')).not.toBeInTheDocument();
  });

  it('8900 不可达 → 整体错误横幅 + 树区空态', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    renderDownloads();
    expect(await screen.findByText('下载管理数据获取失败')).toBeInTheDocument();
    expect(await screen.findByText('课程目录数据不可达（8900 离线或服务未启动）')).toBeInTheDocument();
  });
});