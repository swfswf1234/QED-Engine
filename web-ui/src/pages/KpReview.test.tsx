/**
 * 知识点梳理屏页面用例（REQ-141 门 F・换源后的 v6 判据）
 * 守护六件事：① 三行骨架与三栏栏序——第三行＝重新解析目录／内容解析（两枚解析钮各自独立点亮，第五令＋第九令⑤）
 * ＋知识点合并梳理＋本课程已梳理教材读数＋刷新（第三令的按钮清单；范围与备注只在那枚弹窗里）；
 * ② 教材入选项一律＝文档解析管理「已完成」；
 * ③ 左栏纯净目录与编辑四操作（缓冲只在本地，PUT 零出网；第五令撤了入口钮，编辑态只由 store 置位驱动）；④ 中栏拼节读数与逐页直读对账；
 * ⑤ 右栏按四值类型三形（W27）：章节＝可改总结＋只读导读＋页脚三钮；知识点＝所属章的总结与导读只读＋本点总结可改＋
 *    「重新生成总结」；习题／其他＝只名称与类型标注（页脚三钮不可用）；「本章知识点」与两枚「一键」已撤。
 *    在册写腿三枚＝总结 `PATCH /kp/nodes/{node_id}`、批次 `POST /kp-jobs`、单点重生成 `POST /kp/nodes/{node_id}/summary`；
 *    批次三态的反馈只走弹窗那一句（第七令），第三行下方只剩「目录解析进行中」一句灰字，零数字零批次号；
 * ⑥ 唯一事实源＝屏上不發一条 `/learn/` 或 `/llm/` 请求（改判②换源的界面侧取证，判 URL 不判返回值）。
 * 数据源全部换成 `af_kp` 工作区读腿（`GET /books/{book_id}/kp`）：目录行身份是 `node_id`，
 * 行区间读派生两键（`KA-42`；夹具不带给的两枚时退回 anchors 最小／最大页），`rejected` 行屏侧不吃。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { _rs } from 'rc-resize-observer';
import KpReview from './KpReview';
import { mockFetch } from '../test/setup';
import { API_BASE } from '../api/client';
import {
  DISABLED_LEGS, KP_JOB_MAX_POLLS, KP_JOB_STOP_MESSAGE, KP_REVIEW_NOTE_MAX_LEN, useKpReviewStore,
} from '../stores/kpReview';
import { PAGE_BATCH } from '../stores/learnWorkbench';
import type { Block, BookMeta, ParsingTreeNode } from '../api/axiom';
import type { KpJobProgress, KpNode, KpNodeKind } from '../api/kp';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

let calls: string[] = [];
let patchBodies: Record<string, unknown>[] = [];
let jobBodies: Record<string, unknown>[] = [];
let regenerateBodies: Record<string, unknown>[] = [];

/** `af_kp` 一行的响应投影（`_kp_node_out` 形状：无 `norm_key`／`meta`） */
function kpNode(over: Partial<KpNode> & { node_id: string; name: string; node_kind: KpNodeKind }): KpNode {
  return {
    book_id: 'b07', job_id: 'afkp-job-1', parent_id: null, depth: 1, order_hint: 1,
    role: '', type: '', summary: '', links: [], narrative_ref: '',
    gen_status: 'candidate', gen_batch: 'afkp-b1', model_ref: 'local:mimo-v2-flash',
    confirmed: 0, rev: 3,
    anchors: [],
    ...over,
  };
}

/** 目录行锚＝起止两页（行区间由 anchors 的最小／最大页派生，不是列） */
function anchorPages(start: number, end: number) {
  return [{ kind: 'page', ref_id: 'b07', page: start, block_indexes: [0] }, { kind: 'page', ref_id: 'b07', page: end, block_indexes: [4] }];
}

function kpNodes(bookId: string = 'b07'): KpNode[] {
  return [
    kpNode({ node_id: 'afkp-c1', name: '第1章 实数', node_kind: 'outline', node_type: 'chapter', depth: 1, parent_id: null, order_hint: 1, anchors: anchorPages(5, 20), book_id: bookId }),
    kpNode({ node_id: 'afkp-c1s1', name: '实数的有序性', node_kind: 'outline', node_type: 'point', depth: 2, parent_id: 'afkp-c1', order_hint: 2, anchors: anchorPages(6, 12), book_id: bookId }),
    kpNode({ node_id: 'afkp-c1s2', name: '实数的完备性', node_kind: 'outline', node_type: 'point', depth: 2, parent_id: 'afkp-c1', order_hint: 3, anchors: anchorPages(13, 20), book_id: bookId }),
    kpNode({ node_id: 'afkp-c2', name: '第2章 数列极限', node_kind: 'outline', node_type: 'chapter', depth: 1, parent_id: null, order_hint: 4, anchors: anchorPages(21, 40), book_id: bookId }),
    // 让位的行（`rejected`）：对方读腿照发不藏行，屏侧必须过滤——目录与详情都不出现
    kpNode({ node_id: 'afkp-c9', name: '让位的一行', node_kind: 'outline', node_type: 'other', parent_id: null, order_hint: 5, gen_status: 'rejected', anchors: anchorPages(41, 44), book_id: bookId }),
    // T14 后现网点行已删净；这三枚遗留行留在夹具里守「旧书不因点行退役被误判完成、点行也不误入目录」
    kpNode({ node_id: 'afkp-p1', name: '确界原理', node_kind: 'point', parent_id: 'afkp-c1s1', depth: 3, order_hint: 1, type: 'concept', summary: '确界原理的总结', book_id: bookId }),
    kpNode({ node_id: 'afkp-p2', name: '单调有界原理', node_kind: 'point', parent_id: 'afkp-c1s2', depth: 3, order_hint: 1, type: 'concept', summary: '', book_id: bookId }),
    kpNode({ node_id: 'afkp-p3', name: '未归档的一条', node_kind: 'point', parent_id: null, depth: null, order_hint: 2, summary: '', book_id: bookId }),
    kpNode({ node_id: 'afkp-p9', name: '让位的一条', node_kind: 'point', parent_id: 'afkp-c1s2', depth: 3, order_hint: 2, gen_status: 'rejected', summary: '', book_id: bookId }),
  ];
}

/** 「已梳理」样本＝章节／知识点行自身总结齐（习题／其他按令不入账）；遗留点行的总结也齐 */
function kpNodesAllDone(bookId: string = 'b07'): KpNode[] {
  return kpNodes(bookId).map((row) => {
    if (row.node_id === 'afkp-p2') return { ...row, summary: '单调有界原理的总结' };
    if (row.node_kind === 'outline' && row.gen_status !== 'rejected') return { ...row, summary: `${row.name} 的总结` };
    return row;
  });
}

function blocksOfPage(page: number): Block[] {
  return [
    { type: 'heading', bbox: [10, 10, 300, 24], text: `第 ${page} 页标题`, level: 2 },
    { type: 'paragraph', bbox: [10, 30, 300, 120], text: `第 ${page} 页正文，含确界原理的叙述。` },
    { type: 'formula', bbox: [10, 130, 300, 150], latex: `\\sup_{x\\in S} x = a \\tag{${page}}` },
  ];
}

function charsOfRange(from: number, to: number): number {
  let sum = 0;
  for (let page = from; page <= to; page += 1) {
    sum += blocksOfPage(page).reduce((acc, block) => acc + String(block.text ?? block.latex ?? '').length, 0);
  }
  return sum;
}

function bookMeta(bookId: string, over: Partial<BookMeta> = {}): BookMeta {
  return {
    book_id: bookId, title: bookId, author: '', page_count: 439, sha256: '', strategy: 'hybrid',
    parse_status: 'pending', pages_done: 439, last_parse_result: 'completed',
    ingest_status: 'ingested', active_job_id: `job-${bookId}`, ...over,
  } as BookMeta;
}

/** 选书行的数据源＝解析管理同一棵树：b07 已完成、b05 部分生效（补充令下不入选） */
function treeNodes(): ParsingTreeNode[] {
  return [
    {
      key: 'domain:math', type: 'domain', title: '数学', domainId: 'math',
      children: [{
        key: 'course:math:ma', type: 'course', title: '数学分析', courseId: 'ma', domainId: 'math',
        children: [
          { key: 'book:b07', type: 'book', title: '数学分析（上）', book: bookMeta('b07') },
          { key: 'book:b05', type: 'book', title: '数学分析（下）', book: bookMeta('b05', { pages_done: 300 }) },
        ],
      }],
    },
  ];
}

const PROGRESS_RUNNING: KpJobProgress = {
  book_id: 'b07', gen_batch: 'afkp-new', in_flight: true,
  counts: { draft: 4, candidate: 0, rejected: 0, outline: 4, point: 3 }, ledger: null,
};
const PROGRESS_OK: KpJobProgress = {
  book_id: 'b07', gen_batch: 'afkp-new', in_flight: false,
  counts: { draft: 0, candidate: 9, rejected: 1, outline: 4, point: 6 },
  ledger: {
    gen_batch: 'afkp-new', book_id: 'b07', job_id: 'afkp-job-2', status: 'ok',
    page_start: 5, page_end: 20, review_note: '第 3 节的页区间切错了', result: { outline_rows: 4, reference_rows: 1 }, error: '',
  },
};
const PROGRESS_FAILED: KpJobProgress = {
  ...PROGRESS_OK,
  ledger: { ...PROGRESS_OK.ledger as NonNullable<KpJobProgress['ledger']>, status: 'failed', error: '模型调用失败：文本槽位未配置' },
};
const PROGRESS_NO_LEDGER: KpJobProgress = { ...PROGRESS_OK, ledger: null };

interface Hub {
  nodes?: KpNode[];
  tree?: ParsingTreeNode[];
  /** 工作区回显的在飞批次号（`find_draft_batch`）：非空即屏侧不叠批 */
  inFlight?: string | null;
  /** 进度腿脚本：按轮次取，取完沿用最后一枚（页面用例直接调 `pollKpJobOnce`，不靠假定时器） */
  progress?: KpJobProgress[];
  submit?: { status: number; detail: string };
  patch?: { status: number; detail: string };
  /** 单点重生成（`KA-45`）的拒绝脚本 */
  regenerate?: { status: number; detail: string };
  /** 导读正文不在盘上（`exists=false` 的矛盾态） */
  missingNarrative?: boolean;
  /** 逐页正文夹具替换（W24 用例要往页里放 header／footer／page_number 三类块） */
  pageBlocks?: (page: number) => Block[];
}

function wire(hub: Hub = {}) {
  calls = [];
  patchBodies = [];
  jobBodies = [];
  regenerateBodies = [];
  let pollIndex = 0;
  /** 写腿的落库面：现网服务端持久，读回必须带上新值（屏上回显靠这条取证） */
  const stored: Record<string, Record<string, unknown>> = {};
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    const body = () => JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    if (method === 'POST' && url === `${API_BASE}/kp-jobs`) {
      const sent = body();
      jobBodies.push(sent);
      if (hub.submit) return jsonResponse({ detail: hub.submit.detail }, hub.submit.status);
      return jsonResponse({
        book_id: String(sent.book_id), gen_batch: 'afkp-new', evidence_job_id: 'afkp-job-2',
        page_start: sent.page_start ?? 1, page_end: sent.page_end ?? 439, status: 'queued',
      }, 202);
    }
    if (url.match(/\/books\/([^/]+)\/kp-jobs\/([^/?]+)$/)) {
      const script = hub.progress ?? [PROGRESS_RUNNING];
      const out = script[Math.min(pollIndex, script.length - 1)];
      pollIndex += 1;
      return jsonResponse(out);
    }
    const summaryMatch = method === 'POST' ? url.match(/\/kp\/nodes\/([^/]+)\/summary$/) : null;
    if (summaryMatch) {
      const sent = body();
      regenerateBodies.push(sent);
      if (hub.regenerate) return jsonResponse({ detail: hub.regenerate.detail }, hub.regenerate.status);
      const id = summaryMatch[1];
      const base = (hub.nodes ?? kpNodes()).find((row) => row.node_id === id)
        ?? kpNode({ node_id: id, name: id, node_kind: 'outline' });
      const out = { ...base, summary: `${base.name} 重新生成的总结`, rev: (base.rev ?? 0) + 1 } as unknown as KpNode;
      stored[id] = { summary: out.summary, rev: out.rev };
      return jsonResponse(out);
    }
    if (method === 'PATCH' && url.startsWith(`${API_BASE}/kp/nodes/`)) {
      const sent = body();
      patchBodies.push(sent);
      if (hub.patch) return jsonResponse({ detail: hub.patch.detail }, hub.patch.status);
      const id = url.slice(`${API_BASE}/kp/nodes/`.length);
      const base = (hub.nodes ?? kpNodes()).find((row) => row.node_id === id)
        ?? kpNode({ node_id: id, name: id, node_kind: 'point' });
      const out = { ...base, ...sent, node_id: id, rev: (base.rev ?? 0) + 1 } as unknown as KpNode;
      delete (out as Record<string, unknown>).if_rev;
      stored[id] = { summary: out.summary, rev: out.rev };
      return jsonResponse(out);
    }
    const narrativeMatch = url.match(/\/kp\/nodes\/([^/]+)\/narrative$/);
    if (narrativeMatch) {
      const id = narrativeMatch[1];
      return jsonResponse({
        node_id: id, narrative_ref: hub.missingNarrative ? '' : `kp/${id}.md`,
        exists: !hub.missingNarrative, content: hub.missingNarrative ? '' : `${id} 的导读正文：先讲这一节做什么。`,
        bytes: hub.missingNarrative ? 0 : 30, rev: 1,
      });
    }
    const workspaceMatch = url.match(/\/books\/([^/]+)\/kp$/);
    if (workspaceMatch) {
      const nodes = (hub.nodes ?? kpNodes()).map((row) => ({ ...row, ...(stored[row.node_id] ?? {}) }));
      return jsonResponse({ book_id: workspaceMatch[1], in_flight_batch: hub.inFlight ?? null, nodes, review_flags: [] });
    }
    if (url.includes('/parsing/tree')) {
      return jsonResponse({ nodes: hub.tree ?? treeNodes(), sources: { shared_tables: 'ok', axiom_flow: 'ok' } });
    }
    const page = Number(url.match(/\/pages\/(\d+)/)?.[1] ?? 0);
    if (page) return jsonResponse({ page, source: 'mineru', blocks: (hub.pageBlocks ?? blocksOfPage)(page), image_url: null });
    return jsonResponse({});
  });
}

const writeCalls = () => calls.filter((c) => /^(POST|PUT|PATCH|DELETE) /.test(c));
/** 结构读腿（不含逐页正文）＝数据源换没换干净，看这一串 URL 就够 */
const structuralReads = () => calls.filter((c) => c.startsWith('GET ') && !/\/pages\//.test(c));
/** 换源前的两条旧腿（§⑥ 学习与 §模型）：本屏一条都不该再发 */
const learnLegs = () => calls.filter((c) => /\/learn\/|\/llm/.test(c));

function renderPage(width: number, route = '/admin/kp-review?course=ma&book=b07') {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin/kp-review" element={<KpReview />} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * 编辑态＝直接置 store（第五令撤了栏底入口钮：目录只由「一键解析」生成，编辑态代码与用例按令保留、
 * 屏上不可达）；随后选中一行（编辑器只展开在选中行上）
 */
async function enterEditMode(key: string) {
  // 先等页面把目录读回来再置位：进场装载会重置屏态，置早了会被读腿覆盖掉
  await focusRow(key);
  act(() => {
    useKpReviewStore.setState({ editMode: true });
  });
}

/** 选中一行，并等中栏那一节的正文到位 */
async function focusRow(key: string) {
  fireEvent.click(await screen.findByTestId(`outline-row-${key}`));
  await screen.findByTestId('section-stats');
}

/** 当前行序（同步 query，供 waitFor 内的顺序断言用；async query 返 Promise 不能直接 map） */
const rowOrder = () => screen.queryAllByTestId(/outline-row-/).map((row) => row.getAttribute('data-key'));

const rowNode = (key: string) => useKpReviewStore.getState().draft.find((r) => r.key === key);

/** 在弹窗里选一枚目录行（W21＝队头／队尾两框；antd Select＝mouseDown 展开，再按 option 文本前缀点） */
async function pickReparseRow(ariaName: string, labelStart: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: ariaName }));
  const option = await waitFor(() => {
    // 两枚下拉共用 body 挂载点：前一枚关窗时只挂 leave 动画、没有 hidden 类，
    // 取「非 leave 的最后那一枚」才是刚点开的这一枚，否则会选进上一枚的副本
    const open = [...document.querySelectorAll('.ant-select-dropdown')]
      .filter((el) => !el.classList.contains('ant-select-dropdown-hidden') && !el.className.includes('leave'));
    const dropdown = open[open.length - 1];
    expect(dropdown).toBeDefined();
    const el = [...(dropdown as HTMLElement).querySelectorAll('.ant-select-item-option-content')]
      .find((n) => (n.textContent ?? '').startsWith(labelStart));
    expect(el).toBeDefined();
    return el as HTMLElement;
  });
  fireEvent.click(option);
}

const pickReparseStart = (labelStart: string) => pickReparseRow('起始目录行', labelStart);
const pickReparseEnd = (labelStart: string) => pickReparseRow('结束目录行', labelStart);

/** 后随＝DOM 文档序在后者之后（栏序断言用；jsdom 支持 compareDocumentPosition） */
function follows(a: HTMLElement, b: HTMLElement) {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) === Node.DOCUMENT_POSITION_FOLLOWING;
}

/** 页面用例只驱动界面；轮询由 store 的那一枚动作手动推进（间隔 3s 的真实定时器不进用例） */
const poll = async () => useKpReviewStore.getState().pollKpJobOnce();

beforeEach(() => {
  useKpReviewStore.setState(useKpReviewStore.getInitialState());
  mockFetch.mockReset();
});

afterEach(() => {
  // 停表＋清在途记账：提交过的用例把模块定时器留在下一个用例里就是脏计数
  useKpReviewStore.getState().dismissJob();
});

describe('三行骨架与第三行控件（F1・v6 按钮清单）', () => {
  it('第一行只有标题；第二行＝三框；第三行＝重新解析目录＋内容解析＋合并梳理＋读数＋刷新，解析钮不在第三行（W17）', async () => {
    wire();
    renderPage(1440);
    const titleRow = await screen.findByTestId('title-row');
    expect(titleRow.textContent).toBe('知识点梳理');
    expect(titleRow.querySelectorAll('button, .ant-select, input').length).toBe(0);
    const picker = screen.getByTestId('picker-row');
    expect(picker.querySelector('[data-testid="domain-picker"]')).toBeInTheDocument();
    expect(picker.querySelector('[data-testid="course-picker"]')).toBeInTheDocument();
    expect(picker.querySelector('[data-testid="book-picker"]')).toBeInTheDocument();

    const action = screen.getByTestId('action-row');
    // W17＝整本解析那枚钮从第三行撤下、挪进左栏目录下方
    expect(screen.queryByTestId('parse-all')).not.toBeInTheDocument();
    expect(action.querySelector('[data-testid="parse-outline"]')).toBeNull();
    expect(action.textContent).not.toContain('一键解析');
    const reparse = screen.getByTestId('reparse');
    expect(reparse).toBeInTheDocument();
    expect(reparse).toBeEnabled();
    // 词面（第五令）＝「重新解析目录」；data-testid 保持 reparse 不变
    expect(reparse.textContent).toBe('重新解析目录');
    expect(screen.queryByRole('button', { name: '重新解析' })).not.toBeInTheDocument();
    // 第九令⑤＝内容解析接上 8902 的 stage:'content'：目录非空即亮（同一枚弹窗、换 stage）
    const content = screen.getByTestId('parse-content');
    expect(content).toBeEnabled();
    expect(content).toHaveAttribute('data-lit', 'true');
    // 第三行零常驻备注框、零范围读数（两者都搬进「重新解析目录」弹窗）
    expect(action.querySelector('[data-testid="review-note"]')).toBeNull();
    expect(action.querySelector('[data-testid="reparse-modal"]')).toBeNull();
    expect(screen.getByTestId('merge-button')).toBeDisabled();
    expect(screen.getByTestId('done-books').textContent).toBe('本课程已梳理教材 0 本');
    const refresh = screen.getByRole('button', { name: /刷新/ });
    expect(action.contains(refresh)).toBe(true);
    expect(picker.contains(refresh)).toBe(false);
    // 视觉分行守护＝两枚行各占一行（antd Space 默认 inline-flex 会在宽视口黏成一行）
    expect(picker).toHaveStyle({ display: 'flex' });
    expect(action).toHaveStyle({ display: 'flex' });
    // 左侧目录栏底＝第五令撤下的「编辑」入口钮：初始条件下没有编辑钮可点
    expect(screen.queryByTestId('edit-toggle')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid^="editor-"]')).toHaveLength(0);
    // 不点击＝零写入
    expect(writeCalls()).toEqual([]);
  });

  it('解析目录＝常驻左栏目录下方（零行与非零行都在位），词面不再是「一键解析」（W17・用户裁「左栏下方常驻」）', async () => {
    wire();
    renderPage(1440);
    const pane = await screen.findByTestId('outline-pane');
    const parse = screen.getByTestId('parse-outline');
    expect(parse.textContent).toBe('解析目录');
    expect(pane.contains(parse)).toBe(true);
    expect(screen.queryByRole('button', { name: '一键解析' })).not.toBeInTheDocument();
    // 行下方＝文档序在最后一枚目录行之后
    const rows = screen.getAllByTestId(/outline-row-/);
    expect(parse.compareDocumentPosition(rows[0]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    // 目录非空也常驻（整本重跑仍点得动，只是这一枚不在第三行）
    fireEvent.click(parse);
    await waitFor(() => expect(jobBodies).toEqual([{ book_id: 'b07', stage: 'outline' }]));
    useKpReviewStore.getState().dismissJob();
  });

  it('目录零行＝左栏「解析目录」亮、第三行「重新解析目录」与「内容解析」灰（灰掉的点了不出弹窗、不出网）', async () => {
    wire({ nodes: [] });
    renderPage(1440);
    await screen.findByTestId('outline-empty');
    expect(screen.getByTestId('parse-outline')).toHaveAttribute('data-lit', 'true');
    expect(screen.getByTestId('reparse')).toHaveAttribute('data-lit', 'false');
    expect(screen.getByTestId('parse-content')).toHaveAttribute('data-lit', 'false');
    expect(screen.getByTestId('parse-content')).toBeDisabled();
    fireEvent.click(screen.getByTestId('reparse'));
    fireEvent.click(screen.getByTestId('parse-content'));
    expect(screen.queryByTestId('reparse-modal')).not.toBeInTheDocument();
    expect(writeCalls()).toEqual([]);
  });

  it('目录非空＝两枚都亮（第五令：整本重跑不因目录非空而灰，可再解析一轮）', async () => {
    wire();
    renderPage(1440);
    await screen.findByTestId('detail-name');
    expect(screen.getByTestId('parse-outline')).toHaveAttribute('data-lit', 'true');
    expect(screen.getByTestId('reparse')).toHaveAttribute('data-lit', 'true');
    fireEvent.click(screen.getByTestId('parse-outline'));
    await waitFor(() => expect(jobBodies).toEqual([{ book_id: 'b07', stage: 'outline' }]));
    useKpReviewStore.getState().dismissJob();
  });

  it('弹窗＝按下「重新解析目录」才出，里面才是起止两枚下拉与备注；出弹窗本身零写入', async () => {
    wire();
    renderPage(1440);
    await screen.findByTestId('detail-name');
    fireEvent.click(screen.getByTestId('reparse'));
    const modal = await screen.findByTestId('reparse-modal');
    expect(modal.querySelector('[data-testid="reparse-start"]')).toBeInTheDocument();
    expect(modal.querySelector('[data-testid="reparse-end"]')).toBeInTheDocument();
    expect(modal.querySelector('[data-testid="reparse-note"]')).toBeInTheDocument();
    expect(modal.querySelector('[data-testid="reparse-target"]')).toBeNull();
    // 弹窗标题同改词面（第五令：两处同改）
    expect(screen.getByText('重新解析目录', { selector: '.ant-modal-title' })).toBeInTheDocument();
    expect(writeCalls()).toEqual([]);
  });

  it('弹窗没选全起止两行就提交＝一枚「不能解析」弹窗、零 POST，弹窗不关（不替你猜整本）', async () => {
    const error = vi.spyOn(message, 'error');
    wire();
    renderPage(1440);
    await screen.findByTestId('detail-name');
    fireEvent.click(screen.getByTestId('reparse'));
    await screen.findByTestId('reparse-modal');
    fireEvent.click(screen.getByTestId('reparse-submit'));
    await waitFor(() => expect(error).toHaveBeenCalledWith('不能解析：还没有选全重新解析的起止两行。'));
    // 第七令＝界面不常驻拒绝条：原因只走弹窗那一句
    expect(screen.queryByTestId('job-error')).not.toBeInTheDocument();
    expect(jobBodies).toEqual([]);
    expect(screen.getByTestId('reparse-modal')).toBeInTheDocument();
  });

  it('队头在队尾之后＝一枚「不能解析」弹窗、零 POST（屏侧不替你换序）', async () => {
    const error = vi.spyOn(message, 'error');
    wire();
    renderPage(1440);
    await screen.findByTestId('detail-name');
    fireEvent.click(screen.getByTestId('reparse'));
    await screen.findByTestId('reparse-modal');
    await pickReparseStart('第2章 数列极限');
    await pickReparseEnd('实数的有序性');
    fireEvent.click(screen.getByTestId('reparse-submit'));
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining('倒挂')));
    expect(jobBodies).toEqual([]);
    expect(writeCalls()).toEqual([]);
    expect(screen.getByTestId('reparse-modal')).toBeInTheDocument();
  });

  it('教材入选项一律＝解析已完成：部分生效的书不出现在候选里（用户补充令）', async () => {
    wire();
    renderPage(1440);
    await screen.findByTestId('outline-pane');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '教材' }));
    const options = await waitFor(() => {
      const labels = [...document.querySelectorAll('.ant-select-item-option-content')]
        .map((el) => el.textContent ?? '');
      expect(labels.length).toBeGreaterThan(0);
      return labels;
    });
    expect(options.some((label) => label.includes('数学分析（上）'))).toBe(true);
    expect(options.some((label) => label.includes('数学分析（下）'))).toBe(false);
    expect(useKpReviewStore.getState().bookId).toBe('b07');
  });

  it('完成态就地进选书行标签：章节与知识点行总结齐＝「已梳理」，读数跟着到 1 本', async () => {
    wire({ nodes: kpNodesAllDone() });
    renderPage(1440);
    await screen.findByTestId('outline-pane');
    expect(screen.getByTestId('done-books').textContent).toBe('本课程已梳理教材 1 本');
    expect(screen.getByTestId('merge-button').getAttribute('data-lit')).toBe('false');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '教材' }));
    const labels = await waitFor(() => {
      const rows = [...document.querySelectorAll('.ant-select-item-option-content')].map((el) => el.textContent ?? '');
      expect(rows.length).toBeGreaterThan(0);
      return rows;
    });
    expect(labels.some((label) => label.endsWith('已梳理'))).toBe(true);
  });

  it('本课无入选项教材＝教材框出可见空态，两枚解析钮都不亮、点了不出弹窗也不出网', async () => {
    wire({
      tree: [{
        key: 'domain:math', type: 'domain', title: '数学', domainId: 'math',
        children: [{
          key: 'course:math:ma', type: 'course', title: '数学分析', courseId: 'ma', domainId: 'math',
          children: [{ key: 'book:b05', type: 'book', title: '数学分析（下）', book: bookMeta('b05', { pages_done: 300 }) }],
        }],
      }],
      nodes: [],
    });
    renderPage(1440);
    expect((await screen.findByTestId('book-empty-hint')).textContent).toBe('本课没有解析完成的教材');
    expect(useKpReviewStore.getState().bookId).toBeNull();
    expect(screen.getByTestId('body-no-book')).toBeInTheDocument();
    expect(screen.getByTestId('parse-outline')).toHaveAttribute('data-lit', 'false');
    expect(screen.getByTestId('reparse')).toHaveAttribute('data-lit', 'false');
    fireEvent.click(screen.getByTestId('parse-outline'));
    fireEvent.click(screen.getByTestId('reparse'));
    expect(screen.queryByTestId('reparse-modal')).not.toBeInTheDocument();
    // 没有 book_id 就没有提交目标（这一句的可见拒绝归 store 用例，屏上灰到点不动是更前的那道闸）
    expect(jobBodies).toEqual([]);
    expect(writeCalls()).toEqual([]);
  });
});

describe('数据源换净（F6・唯一事实源）', () => {
  it('进场只走 af_kp 透传读腿：解析树＋完成态扫描＋本书工作区＋首行导读，learn／llm 一条都不发', async () => {
    wire();
    renderPage(1440);
    await screen.findByTestId('detail-name');
    await waitFor(() => expect(calls.filter((c) => c.includes('/kp/nodes/'))).toHaveLength(1));
    expect(learnLegs()).toEqual([]);
    expect(structuralReads()).toEqual([
      `GET ${API_BASE}/parsing/tree`,
      `GET ${API_BASE}/books/b07/kp`,
      `GET ${API_BASE}/books/b07/kp`,
      `GET ${API_BASE}/kp/nodes/afkp-c1/narrative`,
    ]);
    expect(writeCalls()).toEqual([]);
  });

  it('置灰清单不进 DOM：编辑态与非编辑态都没有 disabled-leg 控件，也没有未接入按钮', async () => {
    wire();
    const { container } = renderPage(1440);
    await focusRow('kp:afkp-c1');
    expect(container.querySelectorAll('[data-disabled-leg]')).toHaveLength(0);
    act(() => {
      useKpReviewStore.setState({ editMode: true });
    });
    await screen.findByTestId('editor-name');
    expect(container.querySelectorAll('[data-disabled-leg]')).toHaveLength(0);
    for (const item of DISABLED_LEGS) {
      expect(screen.queryByTestId(`disabled-leg-${item.leg}`), item.leg).not.toBeInTheDocument();
    }
    for (const label of ['读工作区', '确认', '撤回', '逐条点名', '导出对照', '保存导读', '登记知识点', '提交目录']) {
      expect(screen.queryByRole('button', { name: label }), label).toBeNull();
    }
  });

  it('详情栏零指导话术＝批次／端点／放行范围一类句子都不出现在屏上', async () => {
    wire();
    const { container } = renderPage(1440);
    await focusRow('kp:afkp-c1');
    act(() => {
      useKpReviewStore.setState({ editMode: true });
    });
    const text = container.textContent ?? '';
    for (const needle of ['批次 B', '批次 F', '在册', '放行范围', '须人工发令', '端点', 'T8', 'T9', 'T10',
      '写入这一动作即承载确认', '空目录是合法现状', '非权威完成位', '文档解析管理', '透传']) {
      expect(text, needle).not.toContain(needle);
    }
  });
});

describe('三栏栏序与 Splitter 边栏形态（承 v4／v5 裁，与换源无关）', () => {
  it('三栏 DOM 序＝目录 → 知识展示 → 知识点详情；目录与正文任何宽度都常驻', async () => {
    for (const width of [1440, 1200, 860]) {
      wire();
      const view = renderPage(width);
      const body = await screen.findByTestId('body-pane');
      const outline = screen.getByTestId('outline-pane');
      const detail = screen.getByTestId('detail-pane');
      expect(follows(outline, body)).toBe(true);
      expect(follows(body, detail)).toBe(true);
      expect(document.querySelector('.ant-drawer')).toBeNull();
      expect(screen.queryByRole('button', { name: /^打开/ })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('三栏＝antd Splitter：三块面板＋两条 separator，自造拖柄与竖排窄条撤场', async () => {
    wire();
    renderPage(1440);
    await screen.findByTestId('outline-pane');
    expect(document.querySelector('.ant-splitter')).toBeTruthy();
    const panels = document.querySelectorAll('.ant-splitter-panel');
    expect(panels).toHaveLength(3);
    expect(panels[0].querySelector('[data-testid="outline-pane"]')).toBeTruthy();
    expect(panels[1].querySelector('[data-testid="body-pane"]')).toBeTruthy();
    expect(panels[2].querySelector('[data-testid="detail-pane"]')).toBeTruthy();
    const bars = Array.from(document.querySelectorAll('.ant-splitter-bar'));
    expect(bars).toHaveLength(2);
    expect(bars.every((bar) => bar.getAttribute('role') === 'separator')).toBe(true);
    expect(bars.every((bar) => bar.querySelector('.ant-splitter-bar-dragger') !== null)).toBe(true);
    expect(screen.queryByTestId('outline-resize')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-collapse')).not.toBeInTheDocument();
    expect(screen.getByTestId('outline-card').style.width).toBe('');
  });

  it('折叠箭头＝量出容器宽才挂载；点它详情栏收到零宽，目录与正文不动', async () => {
    wire();
    renderPage(1440);
    await screen.findByTestId('outline-pane');
    const splitterEl = document.querySelector('.ant-splitter') as HTMLElement;
    Object.defineProperty(splitterEl, 'offsetWidth', { configurable: true, value: 1440 });
    _rs([{ target: splitterEl } as unknown as ResizeObserverEntry]);

    const foldOf = (barIndex: number) =>
      Array.from(document.querySelectorAll('.ant-splitter-bar')[barIndex].querySelectorAll('.ant-splitter-bar-collapse-bar'));
    await waitFor(() => expect(foldOf(1).length).toBeGreaterThan(0));
    expect(foldOf(0)).toHaveLength(0);
    expect(foldOf(1).every((el) => el.className.includes('collapse-bar-always-visible'))).toBe(true);

    fireEvent.click(foldOf(1)[0]);
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-splitter-panel')[2].className).toContain('ant-splitter-panel-hidden'));
    const panels = document.querySelectorAll('.ant-splitter-panel');
    expect(panels[0].className).not.toContain('ant-splitter-panel-hidden');
    expect(panels[1].className).not.toContain('ant-splitter-panel-hidden');
    expect(screen.getByTestId('detail-card')).toBeInTheDocument();
  });

  it('窄容器＝三栏按 340｜420｜360 的比例一起缩，正文栏不被挤成缝', async () => {
    wire();
    renderPage(1050);
    await screen.findByTestId('outline-pane');
    const splitterEl = document.querySelector('.ant-splitter') as HTMLElement;
    Object.defineProperty(splitterEl, 'offsetWidth', { configurable: true, value: 811 });
    _rs([{ target: splitterEl } as unknown as ResizeObserverEntry]);
    const basisPx = (index: number) =>
      parseFloat((document.querySelectorAll('.ant-splitter-panel')[index] as HTMLElement).style.flexBasis);
    await waitFor(() => expect(basisPx(1)).toBeGreaterThan(0));
    expect(basisPx(0)).toBeGreaterThanOrEqual(200);
    expect(basisPx(1)).toBeGreaterThanOrEqual(240);
    expect(basisPx(2)).toBeGreaterThanOrEqual(260);
    expect(basisPx(1)).toBeGreaterThan(basisPx(0));
  });
});

describe('左栏目录（纯净态・行瘦身）', () => {
  it('目录行＝缩进＋名称：页区间、点计数与状态 Tag 一律不在行内；rejected 行不出现', async () => {
    wire();
    renderPage(1440);
    const rows = await screen.findAllByTestId(/outline-row-/);
    expect(rows.map((row) => row.getAttribute('data-key')))
      .toEqual(['kp:afkp-c1', 'kp:afkp-c1s1', 'kp:afkp-c1s2', 'kp:afkp-c2']);
    expect(rows[0].getAttribute('data-depth')).toBe('1');
    expect((await screen.findByTestId('outline-name-kp:afkp-c1')).textContent).toBe('第1章 实数');
    expect(rows[1].getAttribute('data-depth')).toBe('2');
    expect(screen.getByTestId('outline-name-kp:afkp-c1s1').textContent).toBe('实数的有序性');
    expect(rows.every((row) => row.querySelectorAll('.ant-tag').length === 0)).toBe(true);
    expect(rows.map((row) => row.textContent).join('')).not.toMatch(/5–20|2 点|缺起止页/);
    expect(screen.queryByTestId('outline-row-kp:afkp-c9')).not.toBeInTheDocument();
  });

  it('中栏未选中目录行＝默认第 1 页（封面）：标题与读数都出真实内容', async () => {
    wire();
    renderPage(1440);
    expect((await screen.findByTestId('body-title')).textContent).toContain('第 1 页（封面）');
    expect(screen.getByTestId('section-stats').textContent).toBe(`1 页 · 3 块 · ${charsOfRange(1, 1)} 字`);
    expect(calls.some((c) => /\/pages\/1$/.test(c))).toBe(true);
    expect(writeCalls()).toEqual([]);
  });

  it('非编辑模式＝纯净目录：不渲染任何编辑控件，且屏上没有编辑入口钮（第五令）', async () => {
    wire();
    const { container } = renderPage(1440);
    await focusRow('kp:afkp-c1');
    expect(container.querySelectorAll('[data-testid^="editor-"]')).toHaveLength(0);
    expect(screen.queryByTestId('footer-add-root')).not.toBeInTheDocument();
    // 第五令撤下的栏底「编辑」入口钮：初始条件下没有编辑钮可点，目录只由「一键解析」生成
    expect(screen.queryByTestId('edit-toggle')).not.toBeInTheDocument();
    expect((await screen.findByTestId('outline-row-kp:afkp-c1')).querySelector('input')).toBeNull();
  });

  it('编辑态（store 置位・屏上不可达）才出四操作控件；「提交目录」界面位仍撤出，复位即回到纯净目录', async () => {
    wire();
    const { container } = renderPage(1440);
    await enterEditMode('kp:afkp-c1');
    expect(screen.getByTestId('editor-name')).toBeInTheDocument();
    expect(screen.getByTestId('footer-add-root')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交目录' })).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="disabled-leg-outline.submit"]')).toBeNull();
    act(() => {
      useKpReviewStore.setState({ editMode: false });
    });
    await waitFor(() => expect(screen.queryByTestId('editor-name')).not.toBeInTheDocument());
  });

  it('零目录行＝显式合法空态：一句读数、不报错、不白屏', async () => {
    wire({ nodes: [] });
    renderPage(1440);
    expect((await screen.findByTestId('outline-empty')).textContent).toBe('这本书还没有目录行');
    expect(screen.queryByText(/不可达/)).not.toBeInTheDocument();
    expect(screen.getByTestId('body-pane')).toBeInTheDocument();
  });

  it('屏上目录套版式面同一枚清洗（丙案・先展示净，零写库）：剥引导点与残留页码、黏行铺成多行', async () => {
    const base = kpNodes();
    const rename = (id: string, name: string) => base.map((row) => (row.node_id === id ? { ...row, name } : row));
    wire({
      nodes: rename('afkp-c1', '第1章 实数系和复数系……1')
        .map((row) => (row.node_id === 'afkp-c1s1' ? { ...row, name: '第4章 连续性 …… 73函数的极限 …… 73' } : row))
        .map((row) => (row.node_id === 'afkp-c1s2' ? { ...row, name: '第11章 $\\mathscr{L}^2$ 类的函数 …… 296' } : row)),
    });
    renderPage(1440);
    await screen.findAllByTestId(/outline-row-/);

    const entriesOf = (key: string) =>
      Array.from(screen.getByTestId(`outline-row-${key}`).querySelectorAll('[data-outline-entry]'));
    expect(entriesOf('kp:afkp-c1').map((el) => el.textContent)).toEqual(['第1章 实数系和复数系']);
    expect(entriesOf('kp:afkp-c1s1').map((el) => el.textContent)).toEqual(['第4章 连续性', '函数的极限']);
    expect(entriesOf('kp:afkp-c1s2')[0].querySelector('.katex')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[…·•]{2,}/);
    expect(document.body.textContent).not.toContain('$\\mathscr{L}^2$');

    // 拆出来的两行都指向同一条库里行：点第二行选中的仍是这一行，中栏正文与标题也跟着它
    fireEvent.click(entriesOf('kp:afkp-c1s1')[1]);
    await screen.findByTestId('section-stats');
    expect(screen.getByTestId('outline-row-kp:afkp-c1s1').style.borderLeft).not.toContain('transparent');
    expect((await screen.findByTestId('body-title')).textContent).toBe('第4章 连续性');
    expect(writeCalls()).toEqual([]);
  });

  it('编辑态的目录行回到库里原样名（清洗只治屏上展示，不改写数据）', async () => {
    wire({ nodes: kpNodes().map((row) => (row.node_id === 'afkp-c1s1'
      ? { ...row, name: '第4章 连续性 …… 73函数的极限 …… 73' } : row)) });
    renderPage(1440);
    await focusRow('kp:afkp-c1s1');
    act(() => {
      useKpReviewStore.setState({ editMode: true });
    });
    const raw = '第4章 连续性 …… 73函数的极限 …… 73';
    expect((await screen.findByTestId('outline-name-kp:afkp-c1s1')).textContent).toBe(raw);
    expect(screen.getByTestId('editor-name')).toHaveValue(raw);
  });
});

describe('目录四操作与越界三形（缓冲只在本地・PUT 零出网）', () => {
  it('四操作即时生效且只写本地缓冲：一条 PUT／POST 都不发', async () => {
    wire();
    renderPage(1440);
    await enterEditMode('kp:afkp-c2');

    fireEvent.change(screen.getByTestId('editor-name'), { target: { value: '第2章 数列的极限' } });
    fireEvent.blur(screen.getByTestId('editor-name'));
    expect((await screen.findByTestId('outline-row-kp:afkp-c2')).textContent).toContain('数列的极限');
    expect(rowNode('kp:afkp-c2')?.dirty).toBe(true);

    fireEvent.change(screen.getByTestId('editor-end'), { target: { value: '39' } });
    fireEvent.blur(screen.getByTestId('editor-end'));
    await waitFor(() => expect(rowNode('kp:afkp-c2')).toMatchObject({ pageStart: 21, pageEnd: 39 }));

    await focusRow('kp:afkp-c1s1');
    fireEvent.click(screen.getByTestId('editor-down'));
    await waitFor(() => expect(rowOrder())
      .toEqual(['kp:afkp-c1', 'kp:afkp-c1s2', 'kp:afkp-c1s1', 'kp:afkp-c2']));

    await focusRow('kp:afkp-c1s2');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '改挂父级' }));
    fireEvent.click(await screen.findByTitle('第2章 数列的极限'));
    await waitFor(() => expect(rowNode('kp:afkp-c1s2')?.parentKey).toBe('kp:afkp-c2'));

    expect(writeCalls()).toEqual([]);
  });

  it('越界三形各出可见拒绝且缓冲不落（三级／页区间倒挂／同父重名）', async () => {
    wire();
    renderPage(1440);
    await enterEditMode('kp:afkp-c1');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '改挂父级' }));
    fireEvent.click(await screen.findByTitle('第2章 数列极限'));
    expect(await screen.findByTestId('draft-error')).toHaveTextContent('最深两级');
    expect(rowNode('kp:afkp-c1')?.parentKey).toBeNull();

    fireEvent.change(screen.getByTestId('editor-end'), { target: { value: '4' } });
    fireEvent.blur(screen.getByTestId('editor-end'));
    expect(await screen.findByTestId('draft-error')).toHaveTextContent('页范围非法');
    expect(rowNode('kp:afkp-c1')).toMatchObject({ pageStart: 5, pageEnd: 20 });

    await focusRow('kp:afkp-c2');
    fireEvent.change(screen.getByTestId('editor-name'), { target: { value: '第1章 实数' } });
    fireEvent.blur(screen.getByTestId('editor-name'));
    expect(await screen.findByTestId('draft-error')).toHaveTextContent('重名');
    expect(screen.getByTestId('outline-row-kp:afkp-c2').textContent).toContain('第2章 数列极限');
    expect(writeCalls()).toEqual([]);
  });

  it('新增子节进缓冲（继承父级页窗），删除带子目录的章时可见拒绝', async () => {
    wire();
    renderPage(1440);
    await enterEditMode('kp:afkp-c1');
    fireEvent.click(screen.getByTestId('editor-add-child'));
    expect(await screen.findByTestId('outline-row-local:1')).toBeInTheDocument();
    expect(rowOrder()).toHaveLength(5);
    expect(screen.getByTestId('outline-row-local:1').getAttribute('data-depth')).toBe('2');
    expect(screen.getByTestId('outline-name-local:1').textContent).toBe('未命名目录 1');
    expect(rowNode('local:1')).toMatchObject({ pageStart: 5, pageEnd: 20, origin: 'local' });

    await focusRow('kp:afkp-c1');
    fireEvent.click(screen.getByTestId('editor-remove'));
    expect(await screen.findByTestId('draft-error')).toHaveTextContent('还有子目录');
    expect(writeCalls()).toEqual([]);
  });
});

describe('中栏拼节（anchors 派生的页区间）', () => {
  it('按 8 页／批拼节，块数与字符数与逐页直读对账相等；读完后续取置灰', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1');
    expect(screen.getByTestId('section-stats').textContent).toBe(
      `${PAGE_BATCH} 页 · ${PAGE_BATCH * 3} 块 · ${charsOfRange(5, 5 + PAGE_BATCH - 1)} 字`,
    );
    expect(screen.getByTestId('load-more')).toBeEnabled();
    fireEvent.click(screen.getByTestId('load-more'));
    await waitFor(() => expect(screen.getByTestId('section-stats').textContent).toContain('16 页 · 48 块'));
    await waitFor(() => expect(screen.getByTestId('load-more')).toBeDisabled());
  });

  it('渲染走 BlockList 的版式分支（不自造段落流），块文本一条不丢', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1s2');
    expect((await screen.findAllByTestId('layout-flow')).length).toBeGreaterThan(0);
    expect(screen.getByText('第 13 页正文，含确界原理的叙述。')).toBeInTheDocument();
    expect(screen.getByText('第 20 页正文，含确界原理的叙述。')).toBeInTheDocument();
  });

  it('眉脚默认隐藏（W24）：解析屏存了 showFurniture=true 也不带到梳理屏，中栏只出正文', async () => {
    localStorage.setItem('qed.parsing.typography', JSON.stringify({ bodyFont: 'SimSun', bodyLevel: 0, showFurniture: true }));
    try {
      wire({
        pageBlocks: (page) => [
          { type: 'header', bbox: [10, 2, 300, 10], text: `第 ${page} 页眉线` },
          { type: 'paragraph', bbox: [10, 30, 300, 120], text: `第 ${page} 页正文，含确界原理的叙述。` },
          { type: 'footer', bbox: [10, 200, 300, 210], text: `第 ${page} 页脚线` },
          { type: 'page_number', bbox: [160, 212, 180, 220], text: `— ${page} —` },
        ],
      });
      renderPage(1440);
      await focusRow('kp:afkp-c1');
      const body = screen.getByTestId('body-pane');
      expect(body.textContent).toContain('第 5 页正文，含确界原理的叙述。');
      expect(body.textContent).not.toContain('页眉线');
      expect(body.textContent).not.toContain('页脚线');
      expect(body.textContent).not.toContain('— 5 —');
    } finally {
      localStorage.removeItem('qed.parsing.typography');
    }
  });

  it('起点块号之前的块不进中栏（W19②・第八令「把之前内容也写进来」的屏侧半边）：起点页切块、后续页整页', async () => {
    wire({ nodes: kpNodes().map((row) => (row.node_id === 'afkp-c1s1'
      ? { ...row, anchors: [{ kind: 'page', ref_id: 'b07', page: 6, block_indexes: [1] }, { kind: 'page', ref_id: 'b07', page: 12, block_indexes: [4] }] }
      : row)) });
    renderPage(1440);
    await focusRow('kp:afkp-c1s1');
    expect(screen.queryAllByText(/第 6 页标题/)).toHaveLength(0);
    expect(screen.getAllByText(/第 6 页正文/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/第 7 页标题/).length).toBeGreaterThan(0);
    // 中栏读数随切后的块数（每页夹具三块・起点页少一块），不报未切的假数
    const stats = screen.getByTestId('section-stats').textContent ?? '';
    const pagesShown = Number(/(\d+) 页/.exec(stats)?.[1] ?? -1);
    const blocksShown = Number(/(\d+) 块/.exec(stats)?.[1] ?? -1);
    expect(pagesShown).toBeGreaterThan(0);
    expect(blocksShown).toBe(pagesShown * 3 - 1);
  });

  it('起点块号＝0 与没有块号都从整页起（夹具那枚 [0] 不是「缺块号」），零行内状态标', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1s1');
    expect(screen.getAllByText(/第 6 页标题/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/第 6 页正文/).length).toBeGreaterThan(0);
  });

  it('起点块号超出这一页的块数＝回落整页，不把正文清成空屏', async () => {
    wire({ nodes: kpNodes().map((row) => (row.node_id === 'afkp-c1s1'
      ? { ...row, anchors: [{ kind: 'page', ref_id: 'b07', page: 6, block_indexes: [99] }, { kind: 'page', ref_id: 'b07', page: 12, block_indexes: [4] }] }
      : row)) });
    renderPage(1440);
    await focusRow('kp:afkp-c1s1');
    expect(screen.getAllByText(/第 6 页标题/).length).toBeGreaterThan(0);
    const stats = screen.getByTestId('section-stats').textContent ?? '';
    const pagesShown = Number(/(\d+) 页/.exec(stats)?.[1] ?? -1);
    expect(Number(/(\d+) 块/.exec(stats)?.[1] ?? -1)).toBe(pagesShown * 3);
  });

  it('选中块只出高亮不静默吞点击，也不发任何写请求', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1s1');
    const flow = (await screen.findAllByTestId('layout-flow'))[0];
    const block = (flow.querySelectorAll('[data-block-role]') as NodeListOf<HTMLElement>).item(1) as HTMLElement;
    expect(block.textContent).toContain('第 6 页正文');
    expect(block.style.backgroundColor).toBe('transparent');
    fireEvent.click(block);
    await waitFor(() => expect(block.style.backgroundColor).toBe('rgb(230, 244, 255)'));
    expect(writeCalls()).toEqual([]);
  });

  it('没有锚页的目录行＝一句「发生了什么」，正文栏不报错、行内不打状态标', async () => {
    wire({ nodes: kpNodes().map((row) => (row.node_id === 'afkp-c2' ? { ...row, anchors: [] } : row)) });
    renderPage(1440);
    await focusRow('kp:afkp-c1');
    fireEvent.click(screen.getByTestId('outline-row-kp:afkp-c2'));
    expect(await screen.findByTestId('body-no-range')).toHaveTextContent('这一节还没有页区间');
    expect(screen.getByTestId('body-no-range').textContent).not.toContain('编辑');
    expect(screen.getByTestId('outline-row-kp:afkp-c2').textContent).toBe('第2章 数列极限');
  });
});

describe('右栏＝四值类型与三型详情面（W27：章写总结与导读・点读章并写自家总结・习题其他只标注）', () => {
  it('章节型＝名称／「章节」标／可改总结／导读／页脚三钮；「本章知识点」与两枚「一键」整块撤出', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1');
    expect((await screen.findByTestId('detail-name')).textContent).toBe('第1章 实数');
    expect(screen.getByTestId('detail-kind').textContent).toBe('章节');
    expect(screen.getByTestId('detail-summary')).toHaveValue('');
    expect(screen.getByTestId('detail-save')).toBeDisabled();
    expect((await screen.findByTestId('detail-narrative')).textContent).toContain('afkp-c1 的导读正文');
    // 章不列所属章节、没有「重新生成总结」；页脚三枚＝上一个／保存结果／下一个
    expect(screen.queryByTestId('detail-chapter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-regenerate')).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-prev')).toBeEnabled();
    expect(screen.getByTestId('detail-next')).toBeEnabled();
    // 第四批的「本章知识点」列表与两枚「一键」置灰钮按令撤出（撤整块＝不再铺任何点行）
    expect(screen.queryByTestId('chapter-points')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(/point-row-/)).toHaveLength(0);
    expect(screen.queryByTestId('detail-generate-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-generate-narrative')).not.toBeInTheDocument();
  });

  it('旁路面一律不在 DOM＝未归档池、「另有 N 条」、直登记表单、rejected 目录行', async () => {
    wire();
    const { container } = renderPage(1440);
    await focusRow('kp:afkp-c1');
    await screen.findByTestId('detail-name');
    for (const testid of ['pool-group', 'points-outside', 'register-form', 'register-name']) {
      expect(container.querySelector(`[data-testid="${testid}"]`), testid).toBeNull();
    }
    expect(screen.queryByTestId('point-row-afkp-p3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('outline-row-kp:afkp-c9')).not.toBeInTheDocument();
  });

  it('导读缺文件＝exists:false 出可见空态（上游判 200 不是 404，屏侧不当「正文空着」）', async () => {
    wire({ missingNarrative: true });
    renderPage(1440);
    await focusRow('kp:afkp-c1');
    expect(screen.queryByTestId('detail-narrative')).not.toBeInTheDocument();
    expect((await screen.findByTestId('detail-narrative-empty')).textContent).toContain('还没有导读正文');
  });

  it('同级行页序＝章只与章互跳（第1章→第2章），越界出可见拒绝不静默', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1');
    fireEvent.click(screen.getByTestId('detail-next'));
    await waitFor(() => expect(screen.getByTestId('detail-name').textContent).toBe('第2章 数列极限'));
    expect(screen.getByTestId('detail-kind').textContent).toBe('章节');
    fireEvent.click(screen.getByTestId('detail-next'));
    expect(await screen.findByTestId('detail-error')).toHaveTextContent('最后一条');
    expect(screen.getByTestId('detail-name').textContent).toBe('第2章 数列极限');
    fireEvent.click(screen.getByTestId('detail-prev'));
    await waitFor(() => expect(screen.getByTestId('detail-name').textContent).toBe('第1章 实数'));
    fireEvent.click(screen.getByTestId('detail-prev'));
    expect(await screen.findByTestId('detail-error')).toHaveTextContent('第一条');
    expect(screen.getByTestId('detail-name').textContent).toBe('第1章 实数');
    expect(writeCalls()).toEqual([]);
  });

  it('知识点型＝读所属章的总结与导读（只读）＋本点总结可改＋「重新生成总结」', async () => {
    wire({ nodes: kpNodes().map((row) => (row.node_id === 'afkp-c1' ? { ...row, summary: '实数章的总结。' } : row)) });
    renderPage(1440);
    await focusRow('kp:afkp-c1s1');
    expect((await screen.findByTestId('detail-kind')).textContent).toBe('知识点');
    expect(screen.getByTestId('detail-name').textContent).toBe('实数的有序性');
    // 所属章节＝最近一级章行；章总结原样只读呈现，归属行不给任何输入控件
    expect(screen.getByTestId('detail-chapter').textContent).toContain('第1章 实数');
    expect(screen.getByTestId('detail-chapter-summary').textContent).toBe('实数章的总结。');
    expect(screen.getByTestId('detail-chapter').querySelectorAll('textarea, input, button')).toHaveLength(0);
    // 导读＝所属章的正文；本点自己没有导读文件，一条点级读腿都不发
    expect((await screen.findByTestId('detail-narrative')).textContent).toContain('afkp-c1 的导读正文');
    expect(calls.some((c) => c.includes('/afkp-c1s1/narrative'))).toBe(false);
    // 本点总结可改、可重生成
    expect(screen.getByTestId('detail-summary')).toHaveValue('');
    expect(screen.getByTestId('detail-regenerate')).toBeEnabled();
    expect(screen.getByTestId('detail-save')).toBeDisabled();
  });

  it('章总结空位＝空态话术（不把空串当总结）', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1s1');
    await waitFor(() => expect(screen.getByTestId('detail-kind').textContent).toBe('知识点'));
    expect(screen.getByTestId('detail-chapter-summary').textContent).toContain('还没有总结');
  });

  it('同级行页序＝点只与同父的点互跳（有序性→完备性），跨不进章也不进遗留点行', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1s1');
    fireEvent.click(screen.getByTestId('detail-next'));
    await waitFor(() => expect(screen.getByTestId('detail-name').textContent).toBe('实数的完备性'));
    fireEvent.click(screen.getByTestId('detail-next'));
    expect(await screen.findByTestId('detail-error')).toHaveTextContent('最后一条');
    expect(screen.getByTestId('detail-name').textContent).toBe('实数的完备性');
    fireEvent.click(screen.getByTestId('detail-prev'));
    await waitFor(() => expect(screen.getByTestId('detail-name').textContent).toBe('实数的有序性'));
    fireEvent.click(screen.getByTestId('detail-prev'));
    expect(await screen.findByTestId('detail-error')).toHaveTextContent('第一条');
    expect(writeCalls()).toEqual([]);
  });

  it('总结保存＝本屏在册写腿之一：只发一枚 PATCH 到 af_kp 节点，body 只有 summary＋if_rev', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1');
    fireEvent.change(screen.getByTestId('detail-summary'), { target: { value: '实数系的完备性叙述。' } });
    await waitFor(() => expect(screen.getByTestId('detail-save')).toBeEnabled());
    fireEvent.click(screen.getByTestId('detail-save'));
    await waitFor(() => expect(writeCalls()).toEqual([`PATCH ${API_BASE}/kp/nodes/afkp-c1`]));
    expect(patchBodies).toEqual([{ summary: '实数系的完备性叙述。', if_rev: 3 }]);
    expect(await screen.findByTestId('notice')).toHaveTextContent('已保存总结');
    expect(calls.filter((c) => /^(PUT|DELETE|POST) /.test(c))).toEqual([]);
    // 读回＝工作区回显带上新值（完成态就地刷新靠这一条）
    await waitFor(() => expect(screen.getByTestId('detail-summary')).toHaveValue('实数系的完备性叙述。'));
    expect(learnLegs()).toEqual([]);
  });

  it('保存被拒＝409 的原文进界面，不改乐观序号也不静默回落', async () => {
    wire({ patch: { status: 409, detail: 'rev 冲突：当前 5，请求 3' } });
    renderPage(1440);
    await focusRow('kp:afkp-c1');
    fireEvent.change(screen.getByTestId('detail-summary'), { target: { value: '改一笔。' } });
    fireEvent.click(screen.getByTestId('detail-save'));
    expect(await screen.findByTestId('detail-error')).toHaveTextContent('rev 冲突');
    expect(screen.getByTestId('detail-summary')).toHaveValue('改一笔。');
    expect(screen.getByTestId('detail-save')).toBeEnabled();
  });

  it('「重新生成总结」＝第三枚在册写腿：POST 该点的 /summary，body 只有 if_rev，不回 PATCH', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c1s1');
    fireEvent.click(screen.getByTestId('detail-regenerate'));
    await waitFor(() => expect(regenerateBodies).toEqual([{ if_rev: 3 }]));
    expect(writeCalls()).toEqual([`POST ${API_BASE}/kp/nodes/afkp-c1s1/summary`]);
    expect(await screen.findByTestId('notice')).toHaveTextContent('已重新生成总结');
    await waitFor(() => expect(screen.getByTestId('detail-summary')).toHaveValue('实数的有序性 重新生成的总结'));
    expect(screen.getByTestId('detail-save')).toBeEnabled();
    expect(patchBodies).toEqual([]);
    expect(learnLegs()).toEqual([]);
  });

  it('习题／其他型＝只名称与类型标注：零总结框、零导读、零重生成，页脚三钮一律不可用', async () => {
    const nodes = kpNodes().map((row) => {
      if (row.node_id === 'afkp-c1s2') return { ...row, name: '习题 1.2', node_type: 'exercise' as const };
      if (row.node_id === 'afkp-c2') return { ...row, name: '参考书目', node_type: 'other' as const };
      return row;
    });
    wire({ nodes });
    renderPage(1440);
    await focusRow('kp:afkp-c1s2');
    expect((await screen.findByTestId('detail-kind')).textContent).toBe('习题');
    expect(screen.getByTestId('detail-name').textContent).toBe('习题 1.2');
    expect(screen.queryByTestId('detail-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-regenerate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-narrative')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-narrative-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-prev')).toBeDisabled();
    expect(screen.getByTestId('detail-save')).toBeDisabled();
    expect(screen.getByTestId('detail-next')).toBeDisabled();
    expect(calls.some((c) => c.includes('/afkp-c1s2/narrative'))).toBe(false);

    fireEvent.click(screen.getByTestId('outline-row-kp:afkp-c2'));
    await waitFor(() => expect(screen.getByTestId('detail-kind').textContent).toBe('其他'));
    expect(screen.getByTestId('detail-name').textContent).toBe('参考书目');
    expect(screen.queryByTestId('detail-summary')).not.toBeInTheDocument();
    expect(calls.some((c) => c.includes('/afkp-c2/narrative'))).toBe(false);
    expect(writeCalls()).toEqual([]);
  });
});

describe('解析目录／重新解析目录与批次反馈的弹窗出口（W17・W21・W16 形态）', () => {
  it('解析目录＝整本只目录批次：body 有 book_id＋stage（不发页区间、不发备注）・受理只出一句弹窗', async () => {
    const success = vi.spyOn(message, 'success');
    wire({ nodes: [] });
    renderPage(1440);
    await screen.findByTestId('outline-empty');
    fireEvent.click(screen.getByTestId('parse-outline'));
    await waitFor(() => expect(jobBodies).toEqual([{ book_id: 'b07', stage: 'outline' }]));
    await waitFor(() => expect(success).toHaveBeenCalledWith('已开始解析（批次 afkp-new）'));
    // 第七令＝批次号与五格计数不再进界面，第三行下方只剩一句灰字
    expect(screen.queryByTestId('job-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('job-dismiss')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notice')).not.toBeInTheDocument();
    expect(screen.getByTestId('job-running').textContent).toBe('目录解析进行中');
    // 受理之后才轮询；用例里由 pollKpJobOnce 手动推进
    expect(calls.filter((c) => /\/kp-jobs\//.test(c))).toEqual([]);

    await poll();
    expect(screen.getByTestId('job-running').textContent).toBe('目录解析进行中');
    expect(document.body.textContent).not.toContain('draft 4');
  });

  it('弹窗里选的两枚行给区间（屏上选中行不算）・备注随这一枚上送・成功即关弹窗且只发一次 POST', async () => {
    wire();
    renderPage(1440);
    await focusRow('kp:afkp-c2');
    fireEvent.click(screen.getByTestId('reparse'));
    await screen.findByTestId('reparse-modal');
    await pickReparseStart('实数的有序性');
    await pickReparseEnd('实数的完备性');
    fireEvent.change(screen.getByTestId('reparse-note'), { target: { value: '  第 3 节的页区间切错了  ' } });
    fireEvent.click(screen.getByTestId('reparse-submit'));
    // 区间＝弹窗里那两行（c1s1 起点 6 页 → c1s2 终点 20 页），不是屏上选中的 c2（21–40）；两枚钮都只跑目录
    await waitFor(() => expect(jobBodies).toEqual([{
      book_id: 'b07', page_start: 6, page_end: 20, review_note: '第 3 节的页区间切错了', stage: 'outline',
    }]));
    expect(writeCalls()).toEqual([`POST ${API_BASE}/kp-jobs`]);
    await waitFor(() => expect(screen.queryByTestId('reparse-modal')).not.toBeInTheDocument());
    useKpReviewStore.getState().dismissJob();

    // 空白备注＝不发这一键（形状与「留空」同义，不送上空串）
    jobBodies = [];
    fireEvent.click(screen.getByTestId('reparse'));
    await screen.findByTestId('reparse-modal');
    await pickReparseStart('第2章 数列极限');
    await pickReparseEnd('第2章 数列极限');
    fireEvent.click(screen.getByTestId('reparse-submit'));
    await waitFor(() => expect(jobBodies).toEqual([{
      book_id: 'b07', page_start: 21, page_end: 40, stage: 'outline',
    }]));
  });

  it('内容解析＝同一枚弹窗换 stage：body 带 stage:\'content\' 与在册区间（只补内容，不重发目录腿）', async () => {
    wire();
    renderPage(1440);
    await screen.findByTestId('detail-name');
    fireEvent.click(screen.getByTestId('parse-content'));
    const modal = await screen.findByTestId('reparse-modal');
    expect(modal).toHaveAttribute('data-stage', 'content');
    expect(screen.getByText('内容解析', { selector: '.ant-modal-title' })).toBeInTheDocument();
    await pickReparseStart('实数的有序性');
    await pickReparseEnd('实数的完备性');
    fireEvent.click(screen.getByTestId('reparse-submit'));
    await waitFor(() => expect(jobBodies).toEqual([{
      book_id: 'b07', page_start: 6, page_end: 20, stage: 'content',
    }]));
    await waitFor(() => expect(screen.queryByTestId('reparse-modal')).not.toBeInTheDocument());
    useKpReviewStore.getState().dismissJob();
  });

  it('弹窗两枚下拉按页序排：行序（order_hint）与正文页序相反时，前一段仍排在前面（第九令③）', async () => {
    wire({ nodes: [
      kpNode({ node_id: 'afkp-late', name: '后一段', node_kind: 'outline', order_hint: 1, anchors: anchorPages(30, 40) }),
      kpNode({ node_id: 'afkp-early', name: '前一段', node_kind: 'outline', order_hint: 2, anchors: anchorPages(5, 12) }),
    ] });
    renderPage(1440);
    await screen.findByTestId('detail-name');
    fireEvent.click(screen.getByTestId('reparse'));
    await screen.findByTestId('reparse-modal');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '起始目录行' }));
    const labels = await waitFor(() => {
      const open = [...document.querySelectorAll('.ant-select-dropdown')]
        .filter((el) => !el.classList.contains('ant-select-dropdown-hidden') && !el.className.includes('leave'));
      const dropdown = open[open.length - 1];
      expect(dropdown).toBeDefined();
      const rows = [...(dropdown as HTMLElement).querySelectorAll('.ant-select-item-option-content')]
        .map((el) => el.textContent ?? '');
      expect(rows.length).toBeGreaterThan(0);
      return rows;
    });
    expect(labels[0]).toContain('前一段（第 5–12 页）');
    expect(labels[1]).toContain('后一段（第 30–40 页）');
  });

  it('弹窗内的备注框上限与 8902 同值；超长出一枚「不能解析」弹窗、一条请求都不发', async () => {
    const error = vi.spyOn(message, 'error');
    wire();
    renderPage(1440);
    await screen.findByTestId('detail-name');
    fireEvent.click(screen.getByTestId('reparse'));
    await screen.findByTestId('reparse-modal');
    await pickReparseStart('第1章 实数');
    await pickReparseEnd('第1章 实数');
    const note = screen.getByTestId('reparse-note') as HTMLTextAreaElement;
    expect(note.maxLength).toBe(KP_REVIEW_NOTE_MAX_LEN);
    fireEvent.change(note, { target: { value: '长'.repeat(KP_REVIEW_NOTE_MAX_LEN + 1) } });
    fireEvent.click(screen.getByTestId('reparse-submit'));
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringMatching(/^不能解析：/)));
    expect(String(error.mock.calls.at(-1)?.[0])).toContain('太长');
    expect(jobBodies).toEqual([]);
    expect(screen.getByTestId('reparse-modal')).toBeInTheDocument();
  });

  it('取消＝关掉弹窗且零写入；重开是空态（不沿用上一轮的选择，整本退路仍不给）', async () => {
    const error = vi.spyOn(message, 'error');
    wire();
    renderPage(1440);
    await screen.findByTestId('detail-name');
    fireEvent.click(screen.getByTestId('reparse'));
    await screen.findByTestId('reparse-modal');
    fireEvent.click(screen.getByTestId('reparse-cancel'));
    await waitFor(() => expect(screen.queryByTestId('reparse-modal')).not.toBeInTheDocument());
    expect(writeCalls()).toEqual([]);

    fireEvent.click(screen.getByTestId('reparse'));
    await screen.findByTestId('reparse-modal');
    fireEvent.click(screen.getByTestId('reparse-submit'));
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining('选全')));
    expect(jobBodies).toEqual([]);
  });

  it('三态推进＝在飞→已收：收口出一句「解析完成：目录 N 行」，工作区只回读一次', async () => {
    const success = vi.spyOn(message, 'success');
    wire({ nodes: [], progress: [PROGRESS_RUNNING, PROGRESS_OK] });
    renderPage(1440);
    await screen.findByTestId('outline-empty');
    fireEvent.click(screen.getByTestId('parse-outline'));
    await screen.findByTestId('job-running');
    const workspaceReads = () => calls.filter((c) => c === `GET ${API_BASE}/books/b07/kp`).length;
    const readsBefore = workspaceReads();
    await poll();
    await poll();
    await waitFor(() => expect(success).toHaveBeenLastCalledWith('解析完成：目录 4 行'));
    expect(useKpReviewStore.getState().job?.phase).toBe('ok');
    // 收口后灰字撤下（在飞痕迹只在在飞期间），五格计数与备注回读都不再进界面
    expect(screen.queryByTestId('job-running')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('candidate 9');
    expect(document.body.textContent).not.toContain('第 3 节的页区间切错了');
    // 进度腿只走两轮；终态回读工作区恰好一次（不多发）
    expect(calls.filter((c) => /\/kp-jobs\//.test(c))).toHaveLength(2);
    expect(workspaceReads()).toBe(readsBefore + 1);
  });

  it('停表＝灰字换成带「刷新」那一句且仍零数字，超限只敲一枚 warning（不每轮敲人）', async () => {
    const warning = vi.spyOn(message, 'warning');
    wire({ nodes: [], progress: [PROGRESS_RUNNING] });
    renderPage(1440);
    await screen.findByTestId('outline-empty');
    fireEvent.click(screen.getByTestId('parse-outline'));
    await screen.findByTestId('job-running');
    useKpReviewStore.setState((state) => ({ job: state.job ? { ...state.job, polls: KP_JOB_MAX_POLLS - 1 } : null }));
    await poll();
    expect(warning).toHaveBeenCalledTimes(1);
    const line = screen.getByTestId('job-running').textContent ?? '';
    expect(line).toContain(KP_JOB_STOP_MESSAGE);
    expect(line).not.toMatch(/[0-9]/);
    // 再点一次轮询腿＝停表后不再重复敲弹窗，也不发请求
    const before = calls.length;
    await poll();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(before);
    useKpReviewStore.getState().dismissJob();
  });

  it('批次失败＝流水里的原文进弹窗（不吞不改写），账面判 failed 仍回读工作区', async () => {
    const error = vi.spyOn(message, 'error');
    wire({ nodes: [], progress: [PROGRESS_FAILED] });
    renderPage(1440);
    await screen.findByTestId('outline-empty');
    fireEvent.click(screen.getByTestId('parse-outline'));
    await screen.findByTestId('job-running');
    await poll();
    await waitFor(() => expect(error).toHaveBeenCalledWith('解析失败：模型调用失败：文本槽位未配置'));
    expect(useKpReviewStore.getState().job?.phase).toBe('failed');
    expect(document.body.textContent).not.toContain('rejected 1');
  });

  it('流水缺席≠完成＝draft 行清空但流水还没写出时出一枚 warning，不报「解析完成」', async () => {
    const success = vi.spyOn(message, 'success');
    const warning = vi.spyOn(message, 'warning');
    wire({ nodes: [], progress: [PROGRESS_NO_LEDGER] });
    renderPage(1440);
    await screen.findByTestId('outline-empty');
    fireEvent.click(screen.getByTestId('parse-outline'));
    await screen.findByTestId('job-running');
    await poll();
    await waitFor(() => expect(warning).toHaveBeenCalledWith(expect.stringContaining('流水未写出')));
    // success 只被受理那一句调用过（终态不得报喜）
    expect(success).toHaveBeenCalledTimes(1);
  });

  it('受理被拒不进轮询＝503 与 422 的原文各出一枚「不能解析」弹窗，一条进度腿都不发', async () => {
    const error = vi.spyOn(message, 'error');
    wire({ nodes: [], submit: { status: 503, detail: 'Axiom-Flow 服务不可达' } });
    renderPage(1440);
    await screen.findByTestId('outline-empty');
    fireEvent.click(screen.getByTestId('parse-outline'));
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringMatching(/^不能解析：/)));
    expect(String(error.mock.calls.at(-1)?.[0])).toContain('Axiom-Flow 服务不可达');
    expect(screen.queryByTestId('job-running')).not.toBeInTheDocument();
    expect(calls.filter((c) => /\/kp-jobs\//.test(c))).toHaveLength(0);
    expect(jobBodies).toHaveLength(1);

    // 第二枚受理拒绝＝配置缺配那类 4xx：原文进弹窗，同样不产生在飞痕迹与轮询
    wire({ nodes: [], submit: { status: 422, detail: '页范围非法：page_end 超出总页数' } });
    fireEvent.click(screen.getByTestId('parse-outline'));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(2));
    expect(String(error.mock.calls[1][0])).toContain('page_end 超出总页数');
    expect(screen.queryByTestId('job-running')).not.toBeInTheDocument();
    expect(calls.filter((c) => /\/kp-jobs\//.test(c))).toHaveLength(0);
  });

  it('工作区仍有 draft 行＝这本书有在飞批次，屏侧不叠批（一枚「不能解析」弹窗，不发 POST）', async () => {
    const error = vi.spyOn(message, 'error');
    wire({ nodes: [], inFlight: 'afkp-run' });
    renderPage(1440);
    // 第七令＝在飞痕迹只有这一句灰字，批次号不进界面
    expect((await screen.findByTestId('job-running')).textContent).toBe('目录解析进行中');
    fireEvent.click(screen.getByTestId('parse-outline'));
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringMatching(/^不能解析：/)));
    expect(String(error.mock.calls.at(-1)?.[0])).toContain('afkp-run');
    expect(jobBodies).toEqual([]);
  });

  it('切教材＝停表并清在途记账、备注与弹窗：上一本书的批次号与选择不得残留', async () => {
    wire({ nodes: [] });
    renderPage(1440);
    await screen.findByTestId('outline-empty');
    fireEvent.click(screen.getByTestId('parse-outline'));
    await screen.findByTestId('job-running');
    expect(useKpReviewStore.getState().job?.genBatch).toBe('afkp-new');
    useKpReviewStore.getState().openReparseModal();
    useKpReviewStore.getState().setReparseTarget('start', 'kp:afkp-c1');
    useKpReviewStore.getState().setReparseTarget('end', 'kp:afkp-c2');
    useKpReviewStore.getState().setReviewNote('这一本的备注');
    await useKpReviewStore.getState().pickBook('b07');
    expect(useKpReviewStore.getState().job).toBeNull();
    expect(useKpReviewStore.getState().reviewNote).toBe('');
    expect(useKpReviewStore.getState().reparseModalOpen).toBe(false);
    expect(useKpReviewStore.getState().reparseStartKey).toBeNull();
    expect(useKpReviewStore.getState().reparseEndKey).toBeNull();
    expect(screen.queryByTestId('job-running')).not.toBeInTheDocument();
  });
});
