import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetch } from '../test/setup';
import { PAGE_BATCH, rangeOfNode, useLearnWorkbenchStore } from './learnWorkbench';
import type { OutlineRow } from '../api/learn';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const STAR = {
  domains: [{
    domain_id: 'math',
    name: '数学',
    level: 'undergrad',
    tracks: [{
      track: '分析学',
      kind: 'main',
      summary: '',
      courses: [{
        course_id: 'ma', name: '数学分析', track: '分析学', stage: '',
        sort_order: 1, kp_confirmed: 0, kp_candidates: 0,
      }],
    }],
  }],
  edges: [],
};

/** b01 未激活解析版本、b09 属别的课程 ⇒ 都不进工作台书列表 */
const BOOKS = [
  { book_id: 'b05', title: '数学分析原理', page_count: 317, course_id: 'ma', active_job_id: 'job-1' },
  { book_id: 'b01', title: '同课未激活', page_count: 100, course_id: 'ma', active_job_id: null },
  { book_id: 'b09', title: '别课的书', page_count: 50, course_id: 'cs', active_job_id: 'job-9' },
];

const OUTLINE = {
  course_id: 'ma',
  book_ref: 'b05',
  outline: [
    {
      kp_id: 'kp-c1', course_id: 'ma', node_kind: 'outline', name: '第1章 实数系和复数系',
      depth: 1, parent_kp_id: null, book_ref: 'b05', point_count: 2,
      source_ref: { kind: 'book', ref_id: 'b05', page_start: 7, page_end: 26 },
    },
    {
      kp_id: 'kp-s1', course_id: 'ma', node_kind: 'outline', name: '有序集',
      depth: 2, parent_kp_id: 'kp-c1', book_ref: 'b05', point_count: 1,
      source_ref: { kind: 'book', ref_id: 'b05', page_start: 8, page_end: 9 },
    },
  ],
};

const POOL = {
  details: [{
    detail_id: 'd1', course_id: 'ma', name: '确界原理', norm_key: '确界原理', type: 'concept',
    narrative: '非空有上界的实数集必有上确界', payload: {}, anchors: [], gen_batch: 'learn-workbench',
    model_ref: '', gen_status: 'candidate', kp_id: null, dedup_of: null, map_seed: null,
    parent_kp_id: 'kp-c1', intent: 'summary', book_ref: 'b05',
    domain_id: 'math', domain_label: '数学', course_label: '数学分析', confirmed: 0,
    created_at: '', updated_at: '',
  }],
  total: 1,
};

const calls: string[] = [];
let posted: Record<string, unknown> | null = null;

function routes() {
  calls.length = 0;
  posted = null;
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/learn/star-map')) return jsonResponse(STAR);
    if (url.includes('/learn/courses/ma/outline')) return jsonResponse(OUTLINE);
    if (url.includes('/learn/kp-details')) {
      if (init?.method === 'POST') posted = JSON.parse(String(init.body));
      return jsonResponse(POOL);
    }
    if (url.includes('/learn/kp-details/d1/confirm')) {
      return jsonResponse({ point: { ...POOL.details[0], gen_status: 'adopted', confirmed: true } });
    }
    if (url.includes('/pages/')) {
      const pageNo = Number(url.match(/\/pages\/(\d+)/)?.[1]);
      if (pageNo === 26) return jsonResponse({ detail: '该页无解析产物' }, 404);
      return jsonResponse({
        page_no: pageNo,
        image_url: '',
        markdown: '',
        blocks: { page: pageNo, blocks: [{ type: 'paragraph', bbox: [0, 0, 10, 10], text: `第 ${pageNo} 页正文` }] },
      });
    }
    if (url.includes('/api/v1/books')) return jsonResponse(BOOKS);
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

const store = () => useLearnWorkbenchStore.getState();

async function openWorkbench() {
  await store().fetchCourse('ma');
  await store().selectBook('b05');
  await store().selectNode('kp-c1');
}

describe('三栏学习工作台 store（M6：书 → 章节目录 → 正文分页 → 批注登记）', () => {
  beforeEach(() => {
    useLearnWorkbenchStore.setState({
      courseId: null, course: null, bookId: null, book: null, books: [], outline: [],
      selectedKpId: null, range: null, pages: {}, loadedThrough: 0, selectedBlock: null,
      candidates: [], loading: false, error: null, notice: null,
    });
    routes();
  });

  it('进课只列已激活解析版本且属本课的书', async () => {
    await store().fetchCourse('ma');
    expect(store().course?.name).toBe('数学分析');
    expect(store().books.map((b) => b.book_id)).toEqual(['b05']);
    expect(store().error).toBeNull();
  });

  it('选书拉 outline，选章按 source_ref 定页范围并首批懒取 8 页', async () => {
    await store().fetchCourse('ma');
    await store().selectBook('b05');
    expect(store().outline.map((n) => n.kp_id)).toEqual(['kp-c1', 'kp-s1']);
    await store().selectNode('kp-c1');
    expect(store().range).toEqual({ start: 7, end: 26 });
    expect(store().loadedThrough).toBe(7 + PAGE_BATCH - 1);
    expect(calls.filter((c) => c.includes('/pages/'))).toHaveLength(PAGE_BATCH);
    expect(store().pages[7]?.data).not.toBeNull();
  });

  it('继续加载推进批次，末批不足 8 页并封顶于章尾（26 页缺产物按未解析空态）', async () => {
    await openWorkbench();
    await store().loadMorePages();
    expect(store().loadedThrough).toBe(22);
    await store().loadMorePages();
    expect(store().loadedThrough).toBe(26);
    expect(store().pages[26]?.parsed).toBe(false);
    expect(store().pages[26]?.error).toBeNull();
    const before = calls.length;
    await store().loadMorePages();
    expect(calls.length).toBe(before);
  });

  it('批注登记＝candidate + intent + 页锚点 + 归属章（parent_kp_id），写后重取本章候选', async () => {
    await openWorkbench();
    store().selectBlock({ page: 8, index: 1, snippet: '有序集的定义' });
    const ok = await store().addAnnotation({
      name: '确界原理', narrative: '非空有上界实数集必有上确界', intent: 'summary', type: 'concept',
    });
    expect(ok).toBe(true);
    expect(posted).toMatchObject({
      course_id: 'ma',
      name: '确界原理',
      intent: 'summary',
      gen_status: 'candidate',
      parent_kp_id: 'kp-c1',
      book_ref: 'b05',
      anchors: [{ kind: 'book', ref_id: 'b05', page: 8, snippet: '有序集的定义' }],
    });
    expect(store().candidates.map((c) => c.detail_id)).toEqual(['d1']);
    expect(store().notice).toContain('候选已登记');
  });

  it('无章归属时不写 parent_kp_id 以外的归属（选节则挂节）', async () => {
    await store().fetchCourse('ma');
    await store().selectBook('b05');
    await store().selectNode('kp-s1');
    expect(store().range).toEqual({ start: 8, end: 9 });
    await store().addAnnotation({ name: '节的批注', narrative: '', intent: 'explanation' });
    expect(posted).toMatchObject({ parent_kp_id: 'kp-s1', intent: 'explanation', anchors: [] });
  });

  it('知识点名缺失时拒发请求并提示', async () => {
    await openWorkbench();
    const before = calls.filter((c) => c.startsWith('POST')).length;
    expect(await store().addAnnotation({ name: '  ', narrative: 'x', intent: 'summary' })).toBe(false);
    expect(calls.filter((c) => c.startsWith('POST')).length).toBe(before);
    expect(store().notice).toBe('知识点名必填');
  });

  it('确认提升后重取候选并刷新目录计数', async () => {
    await openWorkbench();
    await store().confirmCandidate('d1');
    expect(calls.filter((c) => c.includes('/kp-details/d1/confirm'))).toHaveLength(1);
    expect(store().outline).toHaveLength(2);
    expect(calls.filter((c) => c.includes('/learn/courses/ma/outline')).length).toBeGreaterThanOrEqual(2);
  });

  it('rangeOfNode 只认合法页范围（缺 source_ref 或起止倒挂＝中栏空态）', () => {
    const node = OUTLINE.outline[0] as OutlineRow;
    expect(rangeOfNode(node)).toEqual({ start: 7, end: 26 });
    expect(rangeOfNode({ ...node, source_ref: null })).toBeNull();
    expect(rangeOfNode({ ...node, source_ref: { page_start: 9, page_end: 8 } })).toBeNull();
    expect(rangeOfNode(null)).toBeNull();
  });
});
