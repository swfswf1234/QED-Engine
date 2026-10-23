/**
 * 解析 store 框图编辑态与版式偏好单测（REQ-098 W4，parsing-ui §5）
 * api/axiom 全 mock：不触网、不依赖 8900。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../api/axiom', () => ({
  createParseJob: vi.fn(async () => ({ id: 'j1', status: 'queued', progress: { parsed: 0, total: 1 } })),
  getBook: vi.fn(async () => ({ book_id: 'b1', page_count: 10 })),
  getBookPage: vi.fn(async () => ({ page_no: 1, image_url: '', markdown: '', blocks: { page: 1, blocks: [] } })),
  getPageEdits: vi.fn(async () => []),
  getParsingTree: vi.fn(async () => ({ nodes: [], sources: { shared_tables: 'ok', axiom_flow: 'ok' } })),
  getParseJob: vi.fn(async () => null),
  ingestBook: vi.fn(async () => ({})),
  listBooks: vi.fn(async () => []),
  listParseJobs: vi.fn(async () => ({ jobs: [], total: 0, limit: 50, offset: 0 })),
  putBlockEdit: vi.fn(async (_b: string, _p: number, i: number, input: Record<string, unknown>) =>
    ({ book_id: 'b1', page_no: 1, block_index: i, ...input })),
  syncBooks: vi.fn(async () => ({ synced: 0, updated: 0, books: [] })),
}));

import { useParsingStore } from './parsing';
import { DEFAULT_TYPOGRAPHY, loadTypographyPrefs, TYPOGRAPHY_STORAGE_KEY } from '../components/parsing/typography';

const reset = () =>
  useParsingStore.setState({
    compareBookId: 'b1',
    comparePageNo: 1,
    pages: {},
    selectedBlock: -1,
    editMode: false,
    editPane: 'box',
    boxSelection: [],
    regionDraft: { added: [], deleted: [], merged: [] },
    drawMode: false,
    typography: { ...DEFAULT_TYPOGRAPHY },
    edits: {},
    tree: [],
    treeLoading: false,
    treeSources: null,
  });

describe('版式偏好接线（§5：store 状态 + localStorage 持久）', () => {
  beforeEach(() => {
    localStorage.clear();
    reset();
  });

  it('默认正文宋体五号、页眉页脚隐藏', () => {
    expect(useParsingStore.getState().typography).toEqual(DEFAULT_TYPOGRAPHY);
  });

  it('setTypography 合并写入并即时持久', () => {
    useParsingStore.getState().setTypography({ bodyLevel: 3 });
    expect(useParsingStore.getState().typography).toEqual({ bodyFont: 'SimSun', bodyLevel: 3, showFurniture: false });
    expect(loadTypographyPrefs().bodyLevel).toBe(3);
    expect(JSON.parse(localStorage.getItem(TYPOGRAPHY_STORAGE_KEY) ?? '{}').bodyLevel).toBe(3);
  });
});

describe('编辑口径与框图多选（§5：editPane / boxSelection）', () => {
  beforeEach(() => {
    localStorage.clear();
    reset();
  });

  it('默认口径=框图；setEditPane 切换', () => {
    expect(useParsingStore.getState().editPane).toBe('box');
    useParsingStore.getState().setEditPane('content');
    expect(useParsingStore.getState().editPane).toBe('content');
  });

  it('toggleBoxSelect 增删多选', () => {
    const s = () => useParsingStore.getState();
    s().toggleBoxSelect(2);
    expect(s().boxSelection).toEqual([2]);
    s().toggleBoxSelect(0);
    expect(s().boxSelection).toEqual([2, 0]);
    s().toggleBoxSelect(2);
    expect(s().boxSelection).toEqual([0]);
  });

  it('selectBlock 与多选无关（单选联动不污染 boxSelection）', () => {
    useParsingStore.getState().toggleBoxSelect(1);
    useParsingStore.getState().selectBlock(5);
    expect(useParsingStore.getState().selectedBlock).toBe(5);
    expect(useParsingStore.getState().boxSelection).toEqual([1]);
  });
});

describe('regionDraft 本地预览态（§10：删除/合并/新框，落库禁用）', () => {
  beforeEach(() => {
    localStorage.clear();
    reset();
  });

  it('addRegionDraft 追加新框', () => {
    useParsingStore.getState().addRegionDraft([10, 20, 30, 40]);
    expect(useParsingStore.getState().regionDraft.added).toEqual([[10, 20, 30, 40]]);
  });

  it('deleteRegion：逐框进 deleted（去重）、并从多选与选中剔除', () => {
    const s = () => useParsingStore.getState();
    s().toggleBoxSelect(1);
    s().toggleBoxSelect(3);
    s().deleteRegion(1);
    s().deleteRegion(3);
    s().deleteRegion(3);
    expect(s().regionDraft.deleted).toEqual([1, 3]);
    expect(s().boxSelection).toEqual([]);
  });

  it('restoreDeletedRegion 撤回复活', () => {
    const s = () => useParsingStore.getState();
    s().deleteRegion(2);
    s().restoreDeletedRegion(2);
    expect(s().regionDraft.deleted).toEqual([]);
  });

  it('mergeSelectedBlocks：<2 不组；≥2 记录组并清空选择', () => {
    const s = () => useParsingStore.getState();
    s().toggleBoxSelect(1);
    s().mergeSelectedBlocks();
    expect(s().regionDraft.merged).toEqual([]);
    s().toggleBoxSelect(4);
    s().mergeSelectedBlocks();
    expect(s().regionDraft.merged).toEqual([[1, 4]]);
    expect(s().boxSelection).toEqual([]);
  });

  it('resetRegionDraft 一键清空草稿', () => {
    const st = useParsingStore.getState();
    st.addRegionDraft([0, 0, 50, 50]);
    st.toggleBoxSelect(2);
    st.deleteRegion(2);
    useParsingStore.getState().resetRegionDraft();
    expect(useParsingStore.getState().regionDraft).toEqual({ added: [], deleted: [], merged: [] });
  });

  it('退出编辑模式清空多选与草稿（本地预览不落库）', () => {
    const st = useParsingStore.getState();
    st.setEditMode(true);
    st.addRegionDraft([0, 0, 50, 50]);
    st.toggleBoxSelect(1);
    useParsingStore.getState().setEditMode(false);
    const s = useParsingStore.getState();
    expect(s.boxSelection).toEqual([]);
    expect(s.regionDraft).toEqual({ added: [], deleted: [], merged: [] });
    expect(s.selectedBlock).toBe(-1);
  });

  it('切页清空多选与草稿、保留版式偏好', async () => {
    const st = useParsingStore.getState();
    st.setTypography({ bodyFont: 'KaiTi' });
    st.addRegionDraft([0, 0, 50, 50]);
    st.toggleBoxSelect(1);
    await useParsingStore.getState().loadPage(2);
    const s = useParsingStore.getState();
    expect(s.boxSelection).toEqual([]);
    expect(s.regionDraft).toEqual({ added: [], deleted: [], merged: [] });
    expect(s.typography.bodyFont).toBe('KaiTi');
  });
});

describe('画框模式与右键删除（REQ-098 W8：drawMode / deleteRegion）', () => {
  beforeEach(() => {
    localStorage.clear();
    reset();
  });

  it('setDrawMode 开合；切页与退出编辑模式自动关', async () => {
    useParsingStore.getState().setEditMode(true);
    useParsingStore.getState().setDrawMode(true);
    expect(useParsingStore.getState().drawMode).toBe(true);
    await useParsingStore.getState().loadPage(2);
    expect(useParsingStore.getState().drawMode).toBe(false);
    useParsingStore.getState().setDrawMode(true);
    useParsingStore.getState().setEditMode(false);
    expect(useParsingStore.getState().drawMode).toBe(false);
  });
});

describe('整页确认（REQ-098 W8：confirmPageBlocks 批量落 verdict=ok）', () => {
  beforeEach(() => {
    localStorage.clear();
    reset();
    useParsingStore.setState({
      edits: {
        'b1:1:0': {
          edit_id: 'e0', book_id: 'b1', page_no: 1, block_index: 0, block_type: 'paragraph',
          verdict: 'bad', note: '备注', corrected_text: '旧文', corrected_bbox: null,
        },
      },
    });
  });

  it('未确认块批量 ok（保留既有修正字段）；编辑中块跳过；已 ok 块不重复提交', async () => {
    const { putBlockEdit } = await import('../api/axiom');
    const r = await useParsingStore.getState().confirmPageBlocks(3, 1);
    const calls = vi.mocked(putBlockEdit).mock.calls;
    expect(calls.map((c) => c[2])).toEqual([0, 2]);
    expect(calls[0][3]).toEqual({ corrected_text: '旧文', note: '备注', verdict: 'ok' });
    expect(calls[1][3]).toEqual({ verdict: 'ok' });
    expect(r).toEqual({ confirmed: 2, skipped: 1 });
    expect(useParsingStore.getState().edits['b1:1:2']?.verdict).toBe('ok');
  });

  it('skipIndex=-1：全部未确认块提交', async () => {
    const { putBlockEdit } = await import('../api/axiom');
    vi.mocked(putBlockEdit).mockClear();
    const r = await useParsingStore.getState().confirmPageBlocks(2, -1);
    expect(r.confirmed).toBe(2);
    expect(r.skipped).toBe(0);
  });
});


describe('fetchTree 降级来源（DEFECT-015 S3：两种空态可区分）', () => {
  beforeEach(() => {
    reset();
  });

  it('共享表为空：tree 为空数组，treeSources 标 empty 且 8902 在线', async () => {
    const { getParsingTree } = await import('../api/axiom');
    vi.mocked(getParsingTree).mockResolvedValueOnce({
      nodes: [],
      sources: { shared_tables: 'empty', axiom_flow: 'ok' },
    } as never);

    await useParsingStore.getState().fetchTree();

    const s = useParsingStore.getState();
    expect(s.tree).toEqual([]);
    expect(s.treeSources).toEqual({ shared_tables: 'empty', axiom_flow: 'ok' });
  });

  it('8902 离线：领域→课程节点照常出，treeSources 标 offline', async () => {
    const { getParsingTree } = await import('../api/axiom');
    vi.mocked(getParsingTree).mockResolvedValueOnce({
      nodes: [{ key: 'domain:math', type: 'domain', title: '数学', children: [] }],
      sources: { shared_tables: 'ok', axiom_flow: 'offline' },
    } as never);

    await useParsingStore.getState().fetchTree();

    const s = useParsingStore.getState();
    expect(s.tree.map((n) => n.title)).toEqual(['数学']);
    expect(s.treeSources?.axiom_flow).toBe('offline');
  });
});
