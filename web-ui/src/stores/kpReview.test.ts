/**
 * 知识点梳理屏 store 用例（REQ-141 批次 F＋REQ-143 W9／W27・数据源＝8902 `af_kp` 透传）
 * 守护八件事：
 * ① **唯一事实源**：本屏的目录、总结、导读、提交批次一律走 `api/kp.ts` 的十条透传腿，
 *    根侧 §⑥（`/learn/*`）与 §模型（`/llm/*`）一条都不发——由 `learnLegs()` 逐条点名取证，不靠返回值暗示；
 * ② 教材入选项＝文档解析管理「已完成」（用户 2026-10-25 补充令，判据复用 `parseBookLabel` 不另造）；
 * ③ 完成判据＝`progressOfKpNodes` 的读时三数（目录行数／章节与知识点行自身总结空的数／遗留点行空总结数），
 *    `rejected` 行与认不到目录行的遗留点都不入账——对方工作区读腿按 `KA-19` 回全行，过滤是屏侧的活；
 * ④ 页区间＝读面派生两键（`KA-42`）优先、缺键退回 `anchors` 的最小／最大页，中栏按 8 页／批拼节且与逐页直读对账零丢字；
 * ⑤ 目录编辑只在本地缓冲成树（提交腿置灰），校验按对方 `af_kp` 口径出可见拒绝；
 * ⑥ **W9 一键解析／重新解析目录**（用户第三令第①段＋第四令弹窗形态＋第五令改判＋第九令⑤内容解析）：请求体＝`book_id`
 *    ＋可选页区间两键＋可选 `review_note`＋`stage`（`outline` 只跑目录、`content` 只补内容）；三枚钮同屏并列、
 *    **各自独立点亮**（`parseLitOf`：选了教材「解析目录」即亮，「重新解析目录」与「内容解析」另需目录非空），
 *    范围与备注只在弹窗里现取（两枚共用、只换 `stage`），屏上选中行不进请求体；
 *    三态推进读 `in_flight`／`ledger`（`KA-4`／`KA-9`：禁拿流水缺席当完成，禁拿读失败翻在飞判据）；
 *    **第七令（W16）**＝受理／拒绝／终态的反馈只出弹窗那一句，屏侧不常驻批次号与五格计数（`notice` 只剩保存／重生成那两路）；
 * ⑦ 详情写腿＝`PATCH /kp/nodes/{node_id}` 带 `if_rev`（乐观并发单点收口在屏侧），409／422 原样可见不降级；
 * ⑧ **W27 三型详情面**＝四值 `node_type` 只呈现；上一／下一只走同级行页序；习题／其他不写总结不取导读；
 *    知识点单点重生成走 `POST /kp/nodes/{node_id}/summary`（`KA-45`），章行点不出这一钮。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { message } from 'antd';
import { mockFetch } from '../test/setup';
import {
  COVER_PAGE, DISABLED_LEGS, KP_JOB_MAX_POLLS, KP_JOB_POLL_MS, KP_REVIEW_NOTE_MAX_LEN, MERGE_MIN_DONE_BOOKS,
  addLocalNode, bodyCutOf, bookDone, buildDraft, catalogOf, chapterAncestorOf, chapterRowOf, cutFromStart, normKey,
  pageOrderedDraft, parseLitOf, pickDefaultBook,
  pickDefaultCourse, progressOfKpNodes, sectionStatsOf, siblingRowsOf, useKpReviewStore, validateLocalTree,
} from './kpReview';
import type { CatalogDomain, DraftNode } from './kpReview';
import { PAGE_BATCH } from './learnWorkbench';
import { API_BASE } from '../api/client';
import type { Block, BookMeta, ParsingTreeNode } from '../api/axiom';
import type { KpJobProgress, KpNode, KpNodeKind } from '../api/kp';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const store = () => useKpReviewStore.getState();

/** 一次请求的账：`METHOD url`，供「除两枚在册写腿外零写入」逐条点名 */
let calls: string[] = [];
let patchBodies: Record<string, unknown>[] = [];
/** 提交批次（W9）的请求体账：四键形状由这里取证，不由屏上文案取证 */
let jobBodies: Record<string, unknown>[] = [];
/** 单点重生成（`KA-45`）的请求体账 */
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

/** 带起止页的目录行锚（`anchors` 最小／最大页＝行区间，屏侧不另造列） */
function pages(start: number, end: number) {
  return [{ kind: 'page', ref_id: 'b07', page: start, block_indexes: [0] }, { kind: 'page', ref_id: 'b07', page: end, block_indexes: [4] }];
}

function kpNodes(bookId: string = 'b07'): KpNode[] {
  return [
    kpNode({ node_id: 'afkp-c1', name: '第1章 实数', node_kind: 'outline', node_type: 'chapter', depth: 1, parent_id: null, order_hint: 1, anchors: pages(5, 20), book_id: bookId }),
    kpNode({ node_id: 'afkp-c1s1', name: '实数的有序性', node_kind: 'outline', node_type: 'point', depth: 2, parent_id: 'afkp-c1', order_hint: 2, anchors: pages(6, 12), book_id: bookId }),
    kpNode({ node_id: 'afkp-c1s2', name: '实数的完备性', node_kind: 'outline', node_type: 'point', depth: 2, parent_id: 'afkp-c1', order_hint: 3, anchors: pages(13, 20), book_id: bookId }),
    kpNode({ node_id: 'afkp-c2', name: '第2章 数列极限', node_kind: 'outline', node_type: 'chapter', depth: 1, parent_id: null, order_hint: 4, anchors: pages(21, 40), book_id: bookId }),
    // 让位的行：对方工作区读腿照发（KA-19 不藏行），屏侧必须过滤掉
    kpNode({ node_id: 'afkp-c9', name: '让位的一行', node_kind: 'outline', node_type: 'other', parent_id: null, order_hint: 5, gen_status: 'rejected', anchors: pages(41, 44), book_id: bookId }),
    // 遗留点行（T14 删行前的旧书形状）：只入空总结账，不再上屏
    kpNode({ node_id: 'afkp-p1', name: '确界原理', node_kind: 'point', parent_id: 'afkp-c1s1', depth: 3, order_hint: 1, type: 'concept', summary: '确界原理的总结', book_id: bookId }),
    kpNode({ node_id: 'afkp-p2', name: '单调有界原理', node_kind: 'point', parent_id: 'afkp-c1s2', depth: 3, order_hint: 1, type: 'concept', summary: '', book_id: bookId }),
    kpNode({ node_id: 'afkp-p3', name: '未归档的一条', node_kind: 'point', parent_id: null, depth: null, order_hint: 2, summary: '', book_id: bookId }),
    kpNode({ node_id: 'afkp-p9', name: '让位的一条', node_kind: 'point', parent_id: 'afkp-c1s2', depth: 3, order_hint: 2, gen_status: 'rejected', summary: '', book_id: bookId }),
  ];
}

/** 章节与知识点行自身总结齐＝同一棵树的「已梳理」样本 */
function kpNodesAllDone(bookId: string = 'b07'): KpNode[] {
  const done: Record<string, string> = {
    'afkp-c1': '第1章 实数的总结',
    'afkp-c1s1': '实数的有序性的总结',
    'afkp-c1s2': '实数的完备性的总结',
    'afkp-c2': '第2章 数列极限的总结',
    'afkp-p2': '单调有界原理的总结',
  };
  return kpNodes(bookId).map((row) => (done[row.node_id] ? { ...row, summary: done[row.node_id] } : row));
}

/** 书级结局＝`parseBookLabel` 的入参形状（补充令只认「已完成」，都不完成的样本靠空工作区造） */
function bookMeta(bookId: string, over: Partial<BookMeta> = {}): BookMeta {
  return {
    book_id: bookId, title: bookId, author: '', page_count: 439, sha256: '', strategy: 'hybrid',
    parse_status: 'pending', pages_done: 439, last_parse_result: 'completed',
    ingest_status: 'ingested', active_job_id: `job-${bookId}`, ...over,
  } as BookMeta;
}

function treeNodes(): ParsingTreeNode[] {
  return [
    {
      key: 'domain:math', type: 'domain', title: '数学', domainId: 'math',
      children: [
        {
          key: 'course:math:ma', type: 'course', title: '数学分析', courseId: 'ma', domainId: 'math',
          children: [
            { key: 'book:b07', type: 'book', title: '数学分析（上）', book: bookMeta('b07') },
            { key: 'book:b05', type: 'book', title: '数学分析（下）', book: bookMeta('b05') },
          ],
        },
        { key: 'course:math:cv', type: 'course', title: '复变函数', courseId: 'cv', domainId: 'math', children: [] },
      ],
    },
    { key: 'domain:cs', type: 'domain', title: '计算机科学', domainId: 'cs', children: [] },
  ];
}

function blocksOfPage(page: number): Block[] {
  return [
    { type: 'heading', bbox: [10, 10, 300, 24], text: `第 ${page} 页标题`, level: 2 },
    { type: 'paragraph', bbox: [10, 30, 300, 120], text: `第 ${page} 页正文，含确界原理的叙述。` },
    { type: 'formula', bbox: [10, 130, 300, 150], latex: `\\sup_{x\\in S} x = a \\tag{${page}}` },
  ];
}

/** 逐页直读的独立字符账（对账的另一侧：不经 store 的拼节路径） */
function charsOfRange(from: number, to: number): number {
  let sum = 0;
  for (let page = from; page <= to; page += 1) {
    sum += blocksOfPage(page).reduce((acc, block) => acc + String(block.text ?? block.latex ?? '').length, 0);
  }
  return sum;
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
  /** 当前书（b07）的工作区行 */
  nodes?: KpNode[];
  /** 第二本入选项教材（b05）的工作区行 */
  b05?: KpNode[];
  tree?: ParsingTreeNode[];
  /** 工作区回显的在飞批次号（`find_draft_batch`） */
  inFlight?: string | null;
  /** 进度腿的脚本：按轮次取，取完沿用最后一枚 */
  progress?: KpJobProgress[];
  submit?: { status: number; detail: string };
  patch?: { status: number; detail: string };
  /** 单点重生成（`KA-45`）的拒绝脚本 */
  regenerate?: { status: number; detail: string };
  /** 导读正文不在盘上（`exists=false` 的矛盾态） */
  missingNarrative?: boolean;
}

function wire(hub: Hub = {}) {
  calls = [];
  patchBodies = [];
  jobBodies = [];
  regenerateBodies = [];
  let pollIndex = 0;
  /** 写腿的落库面：现网服务端持久，读回必须带上新值（完成态就地刷新靠它取证） */
  const stored: Record<string, Record<string, unknown>> = {};
  const rowsOf = (bookId: string) => (bookId === 'b07' ? hub.nodes ?? kpNodes() : hub.b05 ?? []);
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
    const jobMatch = url.match(/\/books\/([^/]+)\/kp-jobs\/([^/?]+)$/);
    if (jobMatch) {
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
      const base = rowsOf('b07').find((row) => row.node_id === id) ?? kpNode({ node_id: id, name: id, node_kind: 'outline' });
      const out = { ...base, summary: `${base.name} 重新生成的总结`, rev: (base.rev ?? 0) + 1 } as unknown as KpNode;
      stored[id] = { summary: out.summary, rev: out.rev };
      return jsonResponse(out);
    }
    if (method === 'PATCH' && url.startsWith(`${API_BASE}/kp/nodes/`)) {
      const sent = body();
      patchBodies.push(sent);
      if (hub.patch) return jsonResponse({ detail: hub.patch.detail }, hub.patch.status);
      const id = url.slice(`${API_BASE}/kp/nodes/`.length);
      const base = rowsOf('b07').find((row) => row.node_id === id) ?? kpNode({ node_id: id, name: id, node_kind: 'point' });
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
      const bookId = workspaceMatch[1];
      const nodes = rowsOf(bookId).map((row) => ({ ...row, ...(stored[row.node_id] ?? {}) }));
      return jsonResponse({ book_id: bookId, in_flight_batch: hub.inFlight ?? null, nodes, review_flags: [] });
    }
    if (url.includes('/parsing/tree')) {
      return jsonResponse({ nodes: hub.tree ?? treeNodes(), sources: { shared_tables: 'ok', axiom_flow: 'ok' } });
    }
    const page = Number(url.match(/\/pages\/(\d+)/)?.[1] ?? 0);
    if (page) return jsonResponse({ page, source: 'mineru', blocks: blocksOfPage(page), image_url: null });
    return jsonResponse({});
  });
}

async function open(hub: Hub = {}, input?: { domain?: string; course?: string; book?: string }) {
  wire(hub);
  await store().enter(input ?? { course: 'ma', book: 'b07' });
}

const writeCalls = () => calls.filter((c) => /^(POST|PUT|PATCH|DELETE) /.test(c));
/** 结构读腿（不含逐页正文）＝数据源换没换干净，看这一串 URL 就够 */
const structuralReads = () => calls.filter((c) => c.startsWith('GET ') && !/\/pages\//.test(c));
/** 换源前的两条旧腿（§⑥ 学习与 §模型）：本屏一条都不该再发 */
const learnLegs = () => calls.filter((c) => /\/learn\/|\/llm/.test(c));

beforeEach(() => {
  useKpReviewStore.setState(useKpReviewStore.getInitialState());
  mockFetch.mockReset();
});

describe('教材入选项与完成判据（补充令＋af_kp 三数）', () => {
  it('catalogOf 只留「解析已完成」的书：部分生效／未激活／解析中／失败一律不入选', () => {
    const nodes: ParsingTreeNode[] = [
      {
        key: 'domain:math', type: 'domain', title: '数学', domainId: 'math',
        children: [{
          key: 'course:math:ma', type: 'course', title: '数学分析', courseId: 'ma', domainId: 'math',
          children: [
            { key: 'a', type: 'book', title: '已完成', book: bookMeta('a') },
            { key: 'b', type: 'book', title: '部分生效', book: bookMeta('b', { pages_done: 300 }) },
            { key: 'c', type: 'book', title: '页齐未激活', book: bookMeta('c', { active_job_id: null }) },
            { key: 'd', type: 'book', title: '解析中', book: bookMeta('d', { parse_status: 'parsing' }) },
            { key: 'e', type: 'book', title: '失败', book: bookMeta('e', { active_job_id: null, pages_done: 0, last_parse_result: 'failed' }) },
          ],
        }],
      },
    ];
    const catalog = catalogOf(nodes);
    expect(catalog[0].courses[0].books.map((row) => row.book_id)).toEqual(['a']);
    expect(catalog[0].courses[0].books[0]).toMatchObject({ label: '已完成', parse_label: '已完成' });
  });

  it('progressOfKpNodes 三数：章节与知识点行自身总结空即待办；rejected 行与未归档池都不入账', () => {
    const partial = progressOfKpNodes(kpNodes());
    expect(partial.get('b07')).toEqual({ rows: 4, pending: 4, emptySummaries: 1 });
    expect(bookDone(partial.get('b07'))).toBe(false);
    expect(bookDone(progressOfKpNodes(kpNodesAllDone()).get('b07'))).toBe(true);
    expect(progressOfKpNodes([]).size).toBe(0);
    expect(progressOfKpNodes(kpNodes()).size).toBe(1);
    expect(progressOfKpNodes(kpNodes().map((row) => ({ ...row, summary: '  ' }))).get('b07')?.emptySummaries).toBe(2);
  });

  it('习题与「其他」不写总结、不入账：只有章节与知识点行的空总结抬高 pending', () => {
    const typed = kpNodes().map((row) => {
      if (row.node_id === 'afkp-c1s1') return { ...row, node_type: 'exercise' as const, summary: '' };
      if (row.node_id === 'afkp-c2') return { ...row, node_type: 'other' as const, summary: '' };
      if (row.node_kind === 'outline') return { ...row, summary: '已有总结' };
      return row;
    });
    expect(progressOfKpNodes(typed).get('b07')).toEqual({ rows: 4, pending: 0, emptySummaries: 1 });
  });

  it('遗留点行的空总结沿父链认目录行归属：挂在点行下的子点算进这本书，认不到在册行的不算', () => {
    const nested = kpNodes().concat([
      kpNode({ node_id: 'afkp-p4', name: '子点', node_kind: 'point', parent_id: 'afkp-p1', depth: 4, summary: '' }),
    ]);
    expect(progressOfKpNodes(nested).get('b07')?.emptySummaries).toBe(2);
    const orphan = kpNode({ node_id: 'afkp-p5', name: '挂在别处的点', node_kind: 'point', parent_id: 'zzz', summary: '' });
    expect(progressOfKpNodes([...kpNodes(), orphan]).get('b07')).toEqual({ rows: 4, pending: 4, emptySummaries: 1 });
  });

  it('三框默认落位：第一个未完成的课程与教材；都完成回第一个；无可入选教材回 null（空态）', () => {
    const catalog = catalogOf(treeNodes());
    const math = catalog.find((row) => row.domain_id === 'math') as CatalogDomain;
    const progress = new Map([
      ['ma', new Map([['b07', progressOfKpNodes(kpNodesAllDone()).get('b07') as never], ['b05', progressOfKpNodes(kpNodes()).get('b07') as never]])],
      ['cv', new Map()],
    ]);
    expect(pickDefaultCourse(math, progress)?.course_id).toBe('ma');
    expect(pickDefaultBook(pickDefaultCourse(math, progress), progress)?.book_id).toBe('b05');
    const allDone = new Map([['ma', new Map([
      ['b07', progressOfKpNodes(kpNodesAllDone()).get('b07') as never],
      ['b05', progressOfKpNodes(kpNodesAllDone('b05')).get('b05') as never],
    ])]]);
    expect(pickDefaultBook(pickDefaultCourse(math, allDone), allDone)?.book_id).toBe('b07');
    const cv = math.courses.find((row) => row.course_id === 'cv');
    expect(cv?.books).toEqual([]);
    expect(pickDefaultBook(cv ?? null, new Map())).toBeNull();
  });

  it('MERGE_MIN_DONE_BOOKS 是「多个」的取值单点（点亮条件引用它，不各自写字面量）', () => {
    expect(MERGE_MIN_DONE_BOOKS).toBe(2);
  });

  it('完成态扫描＝逐本入选项教材各一次工作区读数：目录行齐但章节总结空＝不点亮', async () => {
    await open();
    expect(store().progress.get('ma')?.get('b07')).toEqual({ rows: 4, pending: 4, emptySummaries: 1 });
    expect(store().doneBooksInCourse).toBe(0);
  });

  it('章节与知识点行自身总结齐＝已梳理（T14 删净点行后的收紧口径）', async () => {
    await open({ nodes: kpNodesAllDone() });
    expect(store().progress.get('ma')?.get('b07')).toEqual({ rows: 4, pending: 0, emptySummaries: 0 });
    expect(store().doneBooksInCourse).toBe(1);
  });

  it('读数＝本课程口径（第四批问答改判）：两本都梳理完成才到合并阈值', async () => {
    await open({ nodes: kpNodesAllDone(), b05: kpNodesAllDone('b05') });
    expect(store().doneBooksInCourse).toBe(2);
  });

  it('存完一条总结就地刷新本书完成态（选书行「未梳理／已梳理」跟着走，不多发请求）', async () => {
    await open({ nodes: kpNodesAllDone().map((row) => (row.node_id === 'afkp-c1s2' ? { ...row, summary: '' } : row)) });
    expect(store().progress.get('ma')?.get('b07')?.pending).toBe(1);
    expect(store().doneBooksInCourse).toBe(0);
    await store().openDetail('afkp-c1s2');
    await store().setDetailSummary('实数的完备性的总结。');
    expect(await store().saveDetail()).toBe(true);
    expect(store().progress.get('ma')?.get('b07')).toEqual({ rows: 4, pending: 0, emptySummaries: 0 });
    expect(store().doneBooksInCourse).toBe(1);
    expect(calls.filter((c) => !c.startsWith('GET ') && !c.startsWith('PATCH '))).toEqual([]);
  });
});

describe('进场与默认落点（换源后的读腿清单）', () => {
  it('进场只走 af_kp 透传读腿：解析树＋逐本工作区＋本书工作区＋首行导读，learn／llm 一条都不发', async () => {
    await open();
    expect(structuralReads()).toEqual([
      `GET ${API_BASE}/parsing/tree`,
      `GET ${API_BASE}/books/b07/kp`,
      `GET ${API_BASE}/books/b05/kp`,
      `GET ${API_BASE}/books/b07/kp`,
      `GET ${API_BASE}/kp/nodes/afkp-c1/narrative`,
    ]);
    expect(learnLegs()).toEqual([]);
    expect(writeCalls()).toEqual([]);
    expect(store().domainId).toBe('math');
    expect(store().courseName).toBe('数学分析');
    expect(store().bookId).toBe('b07');
    expect(store().draft.map((row) => row.nodeId)).toEqual(['afkp-c1', 'afkp-c1s1', 'afkp-c1s2', 'afkp-c2']);
    expect(store().editMode).toBe(false);
  });

  it('工作区回全行（含 rejected 与遗留点行）：屏侧只吃在册目录行，点行不上屏', async () => {
    await open();
    expect(store().draft.map((row) => row.nodeId)).toEqual(['afkp-c1', 'afkp-c1s1', 'afkp-c1s2', 'afkp-c2']);
  });

  it('工作区带在飞批次＝进场只做账面呈现，不自发轮询（进度腿只在点过提交后才走）', async () => {
    await open({ inFlight: 'afkp-running' });
    expect(store().inFlightBatch).toBe('afkp-running');
    expect(calls.filter((c) => c.includes('/kp-jobs'))).toEqual([]);
  });

  it('未选中目录行＝中栏默认第 1 页（封面），sectionStats 出真实读数', async () => {
    await open();
    expect(store().selectedKey).toBeNull();
    expect(store().range).toBeNull();
    expect(Object.keys(store().pages).map(Number)).toEqual([COVER_PAGE]);
    expect(store().sectionStats).toEqual({ pages: 1, blocks: 3, chars: charsOfRange(1, 1) });
    expect(store().draft).toHaveLength(4);
  });

  it('零目录行＝合法空态（不报错、不白屏），空态文案由界面消费', async () => {
    await open({ nodes: [] });
    expect(store().outlineEmpty).toBe(true);
    expect(store().error).toBeNull();
    expect(store().draft).toEqual([]);
    expect(store().detail).toBeNull();
  });

  it('默认落位＝课程内第一本未完成（b07 已梳理→落 b05）；都完成回第一本', async () => {
    await open({ nodes: kpNodesAllDone(), b05: kpNodes() }, { course: 'ma' });
    expect(store().bookId).toBe('b05');
    await open({ nodes: kpNodesAllDone(), b05: kpNodesAllDone('b05') }, { course: 'ma' });
    expect(store().bookId).toBe('b07');
  });

  it('切教材只换本书工作区：缓冲与中栏一并重置、零写、备注不跨书残留', async () => {
    await open();
    const before = calls.length;
    await store().pickBook('b05');
    expect(calls.filter((c) => c === `GET ${API_BASE}/books/b05/kp`).length).toBeGreaterThanOrEqual(1);
    expect(calls.length).toBeGreaterThan(before);
    expect(store().selectedKey).toBeNull();
    expect(store().bookId).toBe('b05');
    expect(store().outlineEmpty).toBe(true);
    expect(writeCalls()).toEqual([]);
  });

  it('切课程＝换课程作用域（本课程无入选项教材＝空态，不编造 book_id）', async () => {
    await open();
    await store().pickCourse('cv');
    expect(store().courseId).toBe('cv');
    expect(store().bookId).toBeNull();
    expect(store().detail).toBeNull();
    expect(learnLegs()).toEqual([]);
  });

  it('换书换课换领域都清详情与在途记账：上一本书的章总结不得残留（真机暴露的跨课程残留）', async () => {
    await open();
    expect(store().detail?.nodeId).toBe('afkp-c1');
    await store().submitParseAll();
    expect(store().job).toMatchObject({ genBatch: 'afkp-new' });
    await store().pickCourse('cv');
    expect(store().detail).toBeNull();
    expect(store().detailError).toBeNull();
    expect(store().selectedKey).toBeNull();
    expect(store().job).toBeNull();
  });
});

describe('拼节与页区间（anchors 最小／最大页）', () => {
  it('中栏拼节按 8 页／批取数，块数与字符数与逐页直读对账相等（零丢字）', async () => {
    await open();
    await store().selectNode('kp:afkp-c1');
    expect(store().range).toEqual({ start: 5, end: 20 });
    expect(Object.keys(store().pages).map(Number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: PAGE_BATCH }, (_, i) => 5 + i),
    );
    expect(store().sectionStats).toEqual({
      pages: PAGE_BATCH,
      blocks: PAGE_BATCH * 3,
      chars: charsOfRange(5, 5 + PAGE_BATCH - 1),
    });
    expect(store().sectionStats).toEqual(sectionStatsOf(store().pages));
    await store().loadMorePages();
    expect(store().loadedThrough).toBe(20);
    expect(store().sectionStats).toEqual({ pages: 16, blocks: 48, chars: charsOfRange(5, 20) });
    expect(learnLegs()).toEqual([]);
  });

  it('起点块号切了正文＝读数随切后的块与字（W19② 的读数半边：报未切的数就是假读数）', async () => {
    await open({ nodes: kpNodes().map((row) => (row.node_id === 'afkp-c1'
      ? { ...row, anchors: [{ kind: 'page', ref_id: 'b07', page: 5, block_indexes: [2, 7] }, { kind: 'page', ref_id: 'b07', page: 20, block_indexes: [4] }] }
      : row)) });
    await store().selectNode('kp:afkp-c1');
    const cutAway = blocksOfPage(5).slice(0, 2).reduce((sum, block) => sum + String(block.text ?? block.latex ?? '').length, 0);
    expect(store().sectionStats).toEqual({
      pages: PAGE_BATCH,
      blocks: PAGE_BATCH * 3 - 2,
      chars: charsOfRange(5, 5 + PAGE_BATCH - 1) - cutAway,
    });
    await store().loadMorePages();
    expect(store().sectionStats).toMatchObject({ pages: 16, blocks: 48 - 2 });
    // 块号越界＝与渲染同形地回落整页，读数不把这一页计成零块
    expect(sectionStatsOf(store().pages, { page: 5, block: 99 })).toEqual({ pages: 16, blocks: 48, chars: charsOfRange(5, 20) });
  });

  it('bodyCutOf＝中栏切点的唯一判据（块号 0／缺失／没有起点页都不切，正块号才切）', () => {
    const row = buildDraft(kpNodes())[0];
    expect(bodyCutOf(null)).toBeNull();
    expect(bodyCutOf({ ...row, startBlock: 0 })).toBeNull();
    expect(bodyCutOf({ ...row, startBlock: null })).toBeNull();
    expect(bodyCutOf({ ...row, pageStart: null, startBlock: 3 })).toBeNull();
    expect(bodyCutOf({ ...row, startBlock: 3 })).toEqual({ page: row.pageStart, block: 3 });
  });

  it('cutFromStart＝起点页那一刀的唯一判据（块号 0／缺失／别的页／越界切空都原样整页，渲染与读数共用）', () => {
    const rows = blocksOfPage(6);
    expect(cutFromStart(rows, 6, null)).toEqual(rows);
    expect(cutFromStart(rows, 6, { page: 6, block: 0 })).toEqual(rows);
    expect(cutFromStart(rows, 7, { page: 6, block: 1 })).toEqual(rows);
    expect(cutFromStart(rows, 6, { page: 6, block: 99 })).toEqual(rows);
    expect(cutFromStart(rows, 6, { page: 6, block: 1 })).toEqual(rows.slice(1));
  });

  it('点目录行同时把右栏详情切到该行（章／点同一条腿，类型由读键给）', async () => {
    await open();
    await store().selectNode('kp:afkp-c1s2');
    expect(store().detail).toMatchObject({ nodeId: 'afkp-c1s2', nodeType: 'point', chapterNodeId: 'afkp-c1', index: 1 });
    expect(store().detail?.siblings).toEqual(['afkp-c1s1', 'afkp-c1s2']);
  });

  it('缓冲行的页区间缺 anchors 两键＝合法空（对方 KA-25：页区间可选，缺省整本）', () => {
    const rows = buildDraft(kpNodes().map((row) => ({ ...row, anchors: [] })));
    expect(rows[0]).toMatchObject({ pageStart: null, pageEnd: null });
    expect(rows.map((row) => row.nodeId)).toEqual(['afkp-c1', 'afkp-c1s1', 'afkp-c1s2', 'afkp-c2']);
  });
});

describe('目录编辑只在本地缓冲（提交腿置灰）', () => {
  it('四操作即时生效且只标脏；整批提交置灰零出网（PUT 在册不放行）', async () => {
    await open();
    expect(store().renameDraft('kp:afkp-c2', '第2章 数列的极限')).toBe(true);
    expect(store().setDraftRange('kp:afkp-c2', 21, 39)).toBe(true);
    expect(store().setDraftParent('kp:afkp-c1s2', 'kp:afkp-c2')).toBe(true);
    expect(store().moveDraft('kp:afkp-c1s1', -1)).toBe(false);
    const c2 = store().draft.find((row) => row.nodeId === 'afkp-c2');
    expect(c2).toMatchObject({ name: '第2章 数列的极限', pageStart: 21, pageEnd: 39, dirty: true });
    expect(store().draft.find((row) => row.nodeId === 'afkp-c1s2')).toMatchObject({ parentKey: 'kp:afkp-c2', depth: 2, dirty: true });
    expect(store().draft.filter((row) => row.dirty).map((row) => row.nodeId)).toEqual(['afkp-c2', 'afkp-c1s2']);
    const before = calls.length;
    expect(store().submitOutline()).toContain('在册');
    expect(calls).toHaveLength(before);
    expect(writeCalls()).toEqual([]);
    expect(calls.some((c) => c.startsWith('PUT '))).toBe(false);
  });

  it('越界三形各出可见拒绝且不改动缓冲（三级／页区间倒挂／同父重名）', async () => {
    await open();
    expect(store().setDraftParent('kp:afkp-c1s1', 'kp:afkp-c1s2')).toBe(false);
    expect(store().draftError).toContain('最深两级');
    expect(store().setDraftRange('kp:afkp-c1', 20, 5)).toBe(false);
    expect(store().draftError).toContain('page_end');
    expect(store().setDraftRange('kp:afkp-c1', 0, 20)).toBe(false);
    expect(store().draftError).toContain('page_start');
    expect(store().renameDraft('kp:afkp-c2', '第1章　实数')).toBe(false);
    expect(store().draftError).toContain('重名');
    expect(store().draft.find((row) => row.nodeId === 'afkp-c2')).toMatchObject({
      name: '第2章 数列极限', pageStart: 21, pageEnd: 40, dirty: false,
    });
    expect(writeCalls()).toEqual([]);
  });

  it('重名判据与对方 norm_key 同口径（全角→半角、空白折叠、小写）', () => {
    expect(normKey('第1章　实数')).toBe(normKey('  第1章 实数 '));
    expect(normKey('Ab　C')).toBe('ab c');
    const withDup = addLocalNode(buildDraft(kpNodes()), null, '第2章  数列极限', { start: 21, end: 40 });
    expect(withDup).toHaveLength(5);
    expect(validateLocalTree(withDup)).toContain('同一父级下目录节点重名（同名节须挂不同章）');
    expect(validateLocalTree(addLocalNode(buildDraft(kpNodes()), 'kp:afkp-c2', '新的第一节', { start: 21, end: 30 }))).toEqual([]);
  });

  it('新增本地行进缓冲（origin=local），类型按挂点定：根下＝章节、章下＝知识点', async () => {
    await open();
    expect(store().addDraft('kp:afkp-c1')).toBe('local:1');
    expect(store().draft.find((row) => row.key === 'local:1')).toMatchObject({
      origin: 'local', nodeType: 'point', parentKey: 'kp:afkp-c1', depth: 2,
    });
    const rootKey = store().addDraft(null);
    expect(store().draft.find((row) => row.key === rootKey)).toMatchObject({
      origin: 'local', nodeType: 'chapter', parentKey: null, depth: 1,
    });
  });

  it('上一个／下一个只走同级行页序：章只与章序、点只与同父点序，不铺子树', async () => {
    await open();
    expect(siblingRowsOf(store().draft, null).map((row) => row.nodeId)).toEqual(['afkp-c1', 'afkp-c2']);
    expect(siblingRowsOf(store().draft, 'kp:afkp-c1').map((row) => row.nodeId)).toEqual(['afkp-c1s1', 'afkp-c1s2']);
    await store().selectNode('kp:afkp-c1s1');
    expect(store().detail).toMatchObject({ nodeId: 'afkp-c1s1', index: 0 });
    expect(store().detail?.siblings).toEqual(['afkp-c1s1', 'afkp-c1s2']);
  });

  it('删掉缓冲里的行＝只改缓冲，不发 DELETE（本轮零删行腿）', async () => {
    await open();
    expect(store().addDraft('kp:afkp-c1')).toBe('local:1');
    expect(store().removeDraft('local:1')).toBe(true);
    expect(store().draft.filter((row) => row.origin === 'local')).toHaveLength(0);
    expect(writeCalls()).toEqual([]);
  });
});

describe('缓冲行形状（`af_kp` → DraftNode）', () => {
  it('buildDraft 把 anchors 的最小／最大页铺成行区间，层数优先读 depth 列、缺列按父链推', () => {
    const rows = buildDraft(kpNodes());
    expect(rows.map((row) => row.nodeId)).toEqual(['afkp-c1', 'afkp-c1s1', 'afkp-c1s2', 'afkp-c2']);
    expect(rows[0]).toMatchObject({ key: 'kp:afkp-c1', pageStart: 5, pageEnd: 20, depth: 1, origin: 'server', rev: 3, genStatus: 'candidate' });
    expect(rows[1]).toMatchObject({ pageStart: 6, pageEnd: 12, depth: 2, parentKey: 'kp:afkp-c1' });
    const noDepth = buildDraft(kpNodes().map((row) => ({ ...row, depth: null })));
    expect(noDepth[1].depth).toBe(2);
  });

  it('行带起点块号（W19②）＝起点页那枚锚的 block_indexes 最小值；块号缺失＝null，终点仍待对方派生两键', () => {
    const shifted = kpNodes().map((row) => (row.node_id === 'afkp-c1'
      ? { ...row, anchors: [{ kind: 'page', ref_id: 'b07', page: 5, block_indexes: [2, 7] }, { kind: 'page', ref_id: 'b07', page: 20, block_indexes: [4] }] }
      : row));
    expect(buildDraft(shifted)[0]).toMatchObject({ pageStart: 5, startBlock: 2 });
    // 夹具那枚起点锚块号是 0＝整页起，不是「没有块号」
    expect(buildDraft(kpNodes())[0].startBlock).toBe(0);
    const noBlocks = kpNodes().map((row) => (row.node_id === 'afkp-c1'
      ? { ...row, anchors: [{ kind: 'page', ref_id: 'b07', page: 5 }, { kind: 'page', ref_id: 'b07', page: 20, block_indexes: [4] }] }
      : row));
    expect(buildDraft(noBlocks)[0]).toMatchObject({ pageStart: 5, startBlock: null });
  });

  it('派生两键优先（`KA-42`）：读面切好的区间才是正文那段，锚点最小／最大页只是没有派生键时的退路', () => {
    const derived = kpNodes().map((row) => (row.node_id === 'afkp-c1'
      ? { ...row, page_start: 5, page_end: 24 }
      : row));
    expect(buildDraft(derived)[0]).toMatchObject({ pageStart: 5, pageEnd: 24 });
    // 缺派生键（在飞 `draft` 行、旧读面）才退回 anchors 两端
    expect(buildDraft(kpNodes())[0]).toMatchObject({ pageStart: 5, pageEnd: 20 });
    // 只有一枚派生键＝两枚都不认，仍退回锚点两端（不拼半个区间出来）
    const half = kpNodes().map((row) => (row.node_id === 'afkp-c1' ? { ...row, page_start: 5 } : row));
    expect(buildDraft(half)[0]).toMatchObject({ pageStart: 5, pageEnd: 20 });
  });

  it('pageOrderedDraft＝起点页升序（行序不等于页序），没有起点页的行排最后', () => {
    const rows = buildDraft([
      kpNode({ node_id: 'afkp-late', name: '后一段', node_kind: 'outline', order_hint: 1, anchors: pages(30, 40) }),
      kpNode({ node_id: 'afkp-early', name: '前一段', node_kind: 'outline', order_hint: 2, anchors: pages(5, 12) }),
      kpNode({ node_id: 'afkp-none', name: '没有锚页', node_kind: 'outline', order_hint: 3 }),
    ]);
    expect(pageOrderedDraft(rows).map((row) => row.nodeId)).toEqual(['afkp-early', 'afkp-late', 'afkp-none']);
  });

  it('nodeType＝读键 `node_type` 四值；旧读面缺键按层数退章节／知识点', () => {
    expect(buildDraft(kpNodes()).map((row) => row.nodeType)).toEqual(['chapter', 'point', 'point', 'chapter']);
    const legacy = buildDraft(kpNodes().map((row) => ({ ...row, node_type: undefined })));
    expect(legacy.map((row) => row.nodeType)).toEqual(['chapter', 'point', 'point', 'chapter']);
    const four = buildDraft(kpNodes().map((row) => (row.node_id === 'afkp-c2' ? { ...row, node_type: 'exercise' as const } : row)));
    expect(four.find((row) => row.nodeId === 'afkp-c2')?.nodeType).toBe('exercise');
  });

  it('siblingRowsOf＝同父行按页序（上一个／下一个唯一的序）；chapterAncestorOf 沿父链认章', () => {
    const rows = buildDraft(kpNodes());
    expect(siblingRowsOf(rows, 'kp:afkp-c1').map((row) => row.nodeId)).toEqual(['afkp-c1s1', 'afkp-c1s2']);
    expect(siblingRowsOf(rows, null).map((row) => row.nodeId)).toEqual(['afkp-c1', 'afkp-c2']);
    expect(chapterAncestorOf(rows, 'kp:afkp-c1s1')?.nodeId).toBe('afkp-c1');
    expect(chapterAncestorOf(rows, 'kp:afkp-c1')).toBeNull();
    expect(chapterRowOf({ chapterNodeId: 'afkp-c1' }, rows)?.key).toBe('kp:afkp-c1');
    expect(chapterRowOf({ chapterNodeId: null }, rows)).toBeNull();
  });
});

describe('右栏详情（四值类型三形・同级页序）', () => {
  it('进场即开第一枚目录行详情＝章走导读读腿（旧版「章级不发 narrative」的短路随 §⑥ 一起退役）', async () => {
    await open();
    expect(store().detail).toMatchObject({ nodeId: 'afkp-c1', name: '第1章 实数', nodeType: 'chapter', chapterNodeId: null, index: 0 });
    expect(store().detail?.siblings).toEqual(['afkp-c1', 'afkp-c2']);
    expect(calls.filter((c) => c === `GET ${API_BASE}/kp/nodes/afkp-c1/narrative`)).toHaveLength(1);
    expect(store().detailNarrative).toMatchObject({ loading: false, available: true });
    expect(store().detailNarrative.content).toContain('afkp-c1 的导读正文');
  });

  it('导读缺文件＝exists:false 出可见空态（上游判 200 不是 404，屏侧不得当「正文空着」）', async () => {
    await open({ missingNarrative: true });
    expect(store().detailNarrative).toMatchObject({ loading: false, available: false });
    expect(store().detailNarrative.reason).toContain('还没有导读');
    expect(store().detailNarrative.content).toBe('');
  });

  it('知识点详情＝所属章可认、导读取章的正文（不读本点自己的 narrative 腿）', async () => {
    await open();
    await store().openDetail('afkp-c1s1');
    expect(store().detail).toMatchObject({ nodeId: 'afkp-c1s1', name: '实数的有序性', nodeType: 'point', chapterNodeId: 'afkp-c1', index: 0 });
    expect(store().detail?.siblings).toEqual(['afkp-c1s1', 'afkp-c1s2']);
    expect(calls.filter((c) => c === `GET ${API_BASE}/kp/nodes/afkp-c1/narrative`)).toHaveLength(2);
    expect(calls.filter((c) => c === `GET ${API_BASE}/kp/nodes/afkp-c1s1/narrative`)).toHaveLength(0);
    expect(store().detailNarrative.content).toContain('afkp-c1 的导读正文');
  });

  it('所属章节行＝chapterRowOf 按 `chapterNodeId` 回缓冲认（章详情不出这一格）', async () => {
    await open();
    await store().openDetail('afkp-c1s1');
    expect(chapterRowOf(store().detail, store().draft)?.nodeId).toBe('afkp-c1');
    expect(chapterAncestorOf(store().draft, 'kp:afkp-c1s1')?.name).toBe('第1章 实数');
    await store().openDetail('afkp-c1');
    expect(chapterRowOf(store().detail, store().draft)).toBeNull();
  });

  it('章节详情上／下一个＝章级页序（c1→c2），两端出可见拒绝', async () => {
    await open();
    await store().stepDetail(1);
    expect(store().detail).toMatchObject({ nodeId: 'afkp-c2', nodeType: 'chapter', index: 1 });
    await store().stepDetail(1);
    expect(store().detailError).toContain('最后一条');
    expect(store().detail?.nodeId).toBe('afkp-c2');
    await store().stepDetail(-1);
    expect(store().detail?.nodeId).toBe('afkp-c1');
  });

  it('知识点详情上／下一个＝同父点序（c1s1→c1s2），不跨到别的章', async () => {
    await open();
    await store().openDetail('afkp-c1s1');
    await store().stepDetail(1);
    expect(store().detail).toMatchObject({ nodeId: 'afkp-c1s2', nodeType: 'point', chapterNodeId: 'afkp-c1', index: 1 });
    await store().stepDetail(1);
    expect(store().detailError).toContain('最后一条');
    expect(store().detail?.nodeId).toBe('afkp-c1s2');
    await store().stepDetail(-1);
    expect(store().detail?.nodeId).toBe('afkp-c1s1');
  });

  it('同级只有一行＝导航出可见拒绝、不发任何请求', async () => {
    await open({ nodes: [kpNode({ node_id: 'afkp-c1', name: '第1章 实数', node_kind: 'outline', node_type: 'chapter', anchors: pages(5, 20) })] });
    const before = calls.length;
    await store().stepDetail(1);
    expect(store().detailError).toContain('只有这一行');
    expect(calls).toHaveLength(before);
  });

  it('总结保存＝唯一在册写腿：一枚 PATCH，body 只有 summary＋if_rev（乐观并发在屏侧收口）', async () => {
    await open();
    await store().setDetailSummary('实数系的完备性叙述。');
    const before = calls.length;
    expect(await store().saveDetail()).toBe(true);
    expect(patchBodies).toEqual([{ summary: '实数系的完备性叙述。', if_rev: 3 }]);
    expect(writeCalls()).toEqual([`PATCH ${API_BASE}/kp/nodes/afkp-c1`]);
    expect(store().detail).toMatchObject({ summary: '实数系的完备性叙述。', rev: 4 });
    expect(store().detailError).toBeNull();
    expect(store().notice).toContain('已保存总结');
    expect(calls.length).toBeGreaterThan(before);
    expect(calls.filter((c) => c.startsWith('PUT '))).toEqual([]);
    expect(learnLegs()).toEqual([]);
  });

  it('409＝有人先改了这一行：原样可见、不自动重试、屏上现值不丢', async () => {
    await open();
    await store().setDetailSummary('要写的总结。');
    wire({ patch: { status: 409, detail: 'if_rev 与当前 rev 不符（并发修改）' } });
    expect(await store().saveDetail()).toBe(false);
    expect(store().detailError).toContain('并发');
    expect(store().detail?.summary).toBe('要写的总结。');
    expect(store().detailSaving).toBe(false);
  });

  it('422 由服务端原样可见（长度上限不在屏侧裁）', async () => {
    await open();
    await store().setDetailSummary('要写的总结。');
    wire({ patch: { status: 422, detail: 'summary 必须为不超过 2000 字符的字符串' } });
    expect(await store().saveDetail()).toBe(false);
    expect(store().detailError).toContain('2000 字符');
  });

  it('知识点「重新生成总结」＝一枚 POST summary 带 if_rev，回值覆盖本行并自增 rev；章行点不出这一腿', async () => {
    await open();
    expect(await store().regenerateSummary()).toBe(false);
    expect(store().detailError).toContain('只有知识点');
    expect(regenerateBodies).toEqual([]);
    await store().openDetail('afkp-c1s1');
    expect(await store().regenerateSummary()).toBe(true);
    expect(regenerateBodies).toEqual([{ if_rev: 3 }]);
    expect(writeCalls()).toEqual([`POST ${API_BASE}/kp/nodes/afkp-c1s1/summary`]);
    expect(store().detail).toMatchObject({ nodeId: 'afkp-c1s1', summary: '实数的有序性 重新生成的总结', rev: 4 });
    expect(store().notice).toContain('已重新生成总结');
  });

  it('重生成被拒（422 无取材）原样可见，屏上现值不丢', async () => {
    await open();
    await store().openDetail('afkp-c1s1');
    wire({ regenerate: { status: 422, detail: '这一行没有可取材的锚点' } });
    expect(await store().regenerateSummary()).toBe(false);
    expect(store().detailError).toContain('锚点');
    expect(store().detailSaving).toBe(false);
  });

  it('习题／「其他」＝不写总结、不取导读：保存与重生成都可见拒绝且零出网', async () => {
    await open({ nodes: kpNodes().map((row) => (row.node_id === 'afkp-c2' ? { ...row, node_type: 'exercise' as const } : row)) });
    const narrativeBefore = calls.filter((c) => c.includes('/narrative')).length;
    await store().openDetail('afkp-c2');
    expect(store().detail).toMatchObject({ nodeId: 'afkp-c2', nodeType: 'exercise', chapterNodeId: null });
    expect(calls.filter((c) => c.includes('/narrative')).length).toBe(narrativeBefore);
    expect(store().detailNarrative.available).toBe(false);
    const before = calls.length;
    expect(await store().saveDetail()).toBe(false);
    expect(store().detailError).toContain('不写总结');
    expect(await store().regenerateSummary()).toBe(false);
    expect(store().detailError).toContain('只有知识点');
    expect(calls).toHaveLength(before);
    expect(writeCalls()).toEqual([]);
  });

  it('详情栏未开＝保存与重生成都不发请求（无目标可写）', async () => {
    await open();
    useKpReviewStore.setState({ detail: null });
    const before = calls.length;
    expect(await store().saveDetail()).toBe(false);
    expect(await store().regenerateSummary()).toBe(false);
    expect(calls).toHaveLength(before);
  });
});

describe('解析目录／重新解析目录（W9・第三令第①段＋第四令弹窗形态＋第八令 W17／W21）', () => {
  it('点亮律＝三枚各自独立判：选了教材「解析目录」即亮；「重新解析目录」与「内容解析」另需目录非空；无教材都不亮', () => {
    expect(parseLitOf('b07', true)).toEqual({ all: true, reparse: false, content: false });
    expect(parseLitOf('b07', false)).toEqual({ all: true, reparse: true, content: true });
    expect(parseLitOf(null, true)).toEqual({ all: false, reparse: false, content: false });
    expect(parseLitOf(null, false)).toEqual({ all: false, reparse: false, content: false });
  });

  it('内容解析＝同一枚弹窗、`stage` 换成 content（区间与备注同形；只补内容，不重发目录）', async () => {
    await open();
    store().openReparseModal('content');
    expect(store().reparseStage).toBe('content');
    store().setReparseTarget('start', 'kp:afkp-c1s1');
    store().setReparseTarget('end', 'kp:afkp-c1s2');
    expect(await store().submitReparse()).toBe(true);
    expect(jobBodies).toEqual([{ book_id: 'b07', page_start: 6, page_end: 20, stage: 'content' }]);
    store().dismissJob();
    // 不传 stage 的老入口仍跑目录腿（默认值是一条显式契约，不是碰巧）
    store().openReparseModal();
    expect(store().reparseStage).toBe('outline');
  });

  it('倒挂判据按页序：行序与页序相反时，起点页在前的那一行仍是合法队头', async () => {
    await open({ nodes: [
      kpNode({ node_id: 'afkp-late', name: '后一段', node_kind: 'outline', order_hint: 1, anchors: pages(30, 40) }),
      kpNode({ node_id: 'afkp-early', name: '前一段', node_kind: 'outline', order_hint: 2, anchors: pages(5, 12) }),
    ] });
    store().openReparseModal('content');
    store().setReparseTarget('start', 'kp:afkp-early');
    store().setReparseTarget('end', 'kp:afkp-late');
    expect(await store().submitReparse()).toBe(true);
    expect(jobBodies).toEqual([{ book_id: 'b07', page_start: 5, page_end: 40, stage: 'content' }]);
    store().dismissJob();
  });

  it('进场不点按钮＝零写请求（提交腿只在点击时出网）', async () => {
    await open();
    expect(writeCalls()).toEqual([]);
    expect(store().job).toBeNull();
  });

  it('重新解析＝区间由弹窗内现选的两枚目录行给（W21：从队头那行的起点页到队尾那行的终点页，屏上选中行不算）', async () => {
    await open();
    await store().selectNode('kp:afkp-c1s2');
    store().openReparseModal();
    expect(store().reparseModalOpen).toBe(true);
    expect(store().reparseStartKey).toBeNull();
    expect(store().reparseEndKey).toBeNull();
    store().setReparseTarget('start', 'kp:afkp-c1s1');
    store().setReparseTarget('end', 'kp:afkp-c2');
    expect(await store().submitReparse()).toBe(true);
    expect(jobBodies).toEqual([{ book_id: 'b07', page_start: 6, page_end: 40, stage: 'outline' }]);
    expect(writeCalls()).toEqual([`POST ${API_BASE}/kp-jobs`]);
    expect(store().job).toMatchObject({ phase: 'running', genBatch: 'afkp-new' });
  });

  it('两枚同一行也是合法区间（一行自己重跑），不因为起止同键就拒', async () => {
    await open();
    store().openReparseModal();
    store().setReparseTarget('start', 'kp:afkp-c1s1');
    store().setReparseTarget('end', 'kp:afkp-c1s1');
    expect(await store().submitReparse()).toBe(true);
    expect(jobBodies).toEqual([{ book_id: 'b07', page_start: 6, page_end: 12, stage: 'outline' }]);
    store().dismissJob();
  });

  it('关弹窗＝清掉弹窗里的两枚选择（下一次打开是空态，不回显上一轮）', async () => {
    await open();
    store().openReparseModal();
    store().setReparseTarget('start', 'kp:afkp-c1');
    store().setReparseTarget('end', 'kp:afkp-c2');
    store().closeReparseModal();
    expect(store().reparseModalOpen).toBe(false);
    expect(store().reparseStartKey).toBeNull();
    expect(store().reparseEndKey).toBeNull();
    expect(writeCalls()).toEqual([]);
  });

  it('解析目录＝整本（不带页区间两键）・备注不随这一枚上送（第四令：备注只在弹窗里）', async () => {
    await open();
    store().setReviewNote('这句话只属于重新解析');
    expect(await store().submitParseAll()).toBe(true);
    expect(jobBodies).toEqual([{ book_id: 'b07', stage: 'outline' }]);
  });

  it('两枚下拉只选全一枚就提交＝可见拒绝，不偷偷降级成整本', async () => {
    await open();
    store().openReparseModal();
    await store().selectNode('kp:afkp-c1');
    store().setReparseTarget('start', 'kp:afkp-c1');
    expect(await store().submitReparse()).toBe(false);
    expect(store().jobError).toContain('选全');
    expect(writeCalls()).toEqual([]);
    store().setReparseTarget('start', null);
    store().setReparseTarget('end', 'kp:afkp-c2');
    expect(await store().submitReparse()).toBe(false);
    expect(store().jobError).toContain('选全');
    expect(writeCalls()).toEqual([]);
  });

  it('队头在队尾之后＝可见拒绝、零 POST（屏侧不替你换序，也不替你裁掉超出的一截）', async () => {
    await open();
    store().openReparseModal();
    store().setReparseTarget('start', 'kp:afkp-c2');
    store().setReparseTarget('end', 'kp:afkp-c1s1');
    expect(await store().submitReparse()).toBe(false);
    expect(store().jobError).toContain('倒挂');
    expect(writeCalls()).toEqual([]);
  });

  it('选了没有锚页的行＝可见拒绝，文案只说发生了什么（不写端点、不指另一枚钮）', async () => {
    await open({ nodes: kpNodes().concat([kpNode({ node_id: 'afkp-c0', name: '没有锚页的一行', node_kind: 'outline' })]) });
    store().openReparseModal();
    store().setReparseTarget('start', 'kp:afkp-c0');
    store().setReparseTarget('end', 'kp:afkp-c2');
    expect(await store().submitReparse()).toBe(false);
    expect(store().jobError).toContain('锚页');
    expect(store().jobError).not.toContain('anchors');
    expect(store().jobError).not.toContain('解析目录');
    expect(writeCalls()).toEqual([]);
  });

  it('人工评审备注＝去空白后原样上送；空白不发这一键；上限 2000 与对方 KA-31 同值', async () => {
    await open();
    store().openReparseModal();
    store().setReparseTarget('start', 'kp:afkp-c1');
    store().setReparseTarget('end', 'kp:afkp-c1');
    store().setReviewNote('  第 3 节的页区间切错了，请重切  ');
    expect(await store().submitReparse()).toBe(true);
    expect(jobBodies[0]).toEqual({ book_id: 'b07', page_start: 5, page_end: 20, review_note: '第 3 节的页区间切错了，请重切', stage: 'outline' });
    // 第二次提交前把在途记账清掉：不叠批的守卫另有用例，这一条只取备注形状
    // 受理成功会关掉弹窗并清选择（备注一批一带，不留着下一批误发），所以这里重新选一行
    useKpReviewStore.setState({ job: null, inFlightBatch: null });
    store().setReparseTarget('start', 'kp:afkp-c1');
    store().setReparseTarget('end', 'kp:afkp-c1');
    store().setReviewNote('   ');
    jobBodies.length = 0;
    expect(await store().submitReparse()).toBe(true);
    expect(jobBodies[0]).toEqual({ book_id: 'b07', page_start: 5, page_end: 20, stage: 'outline' });
    expect(KP_REVIEW_NOTE_MAX_LEN).toBe(2000);
  });

  it('备注超长＝就地可见拒绝、一条请求都不发；上限的判据正本在 8902，界面不写参数规则', async () => {
    await open();
    store().openReparseModal();
    store().setReparseTarget('start', 'kp:afkp-c1');
    store().setReparseTarget('end', 'kp:afkp-c1');
    store().setReviewNote('长'.repeat(KP_REVIEW_NOTE_MAX_LEN + 1));
    expect(await store().submitReparse()).toBe(false);
    expect(store().jobError).toContain('太长');
    expect(store().jobError).not.toContain('422');
    expect(store().jobError).not.toContain('2000');
    expect(writeCalls()).toEqual([]);
  });

  it('在途不重复提交：running 时第二枚按钮点了不出网（KA-4 在飞判据只认在飞批次）', async () => {
    await open();
    await store().submitParseAll();
    const before = calls.length;
    expect(await store().submitParseAll()).toBe(false);
    expect(store().jobError).toContain('在飞');
    expect(calls).toHaveLength(before);
  });

  it('工作区报在飞批次＝同样不重复提交，并把批次号写进那一句拒绝（第七令：只进弹窗，不进界面）', async () => {
    await open({ inFlight: 'afkp-running' });
    expect(store().inFlightBatch).toBe('afkp-running');
    const before = calls.length;
    expect(await store().submitParseAll()).toBe(false);
    expect(store().jobError).toContain('afkp-running');
    expect(calls).toHaveLength(before);
  });

  it('三态推进：在飞→running＋本批计数；落账→ok、回读一次工作区、流水备注可读回', async () => {
    await open({ progress: [PROGRESS_RUNNING, PROGRESS_OK] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    expect(store().job).toMatchObject({ phase: 'running', counts: { draft: 4, candidate: 0, rejected: 0, outline: 4, point: 3 } });
    expect(store().job?.phase).toBe('running');
    const before = calls.filter((c) => c === `GET ${API_BASE}/books/b07/kp`).length;
    await store().pollKpJobOnce();
    expect(store().job).toMatchObject({ phase: 'ok', genBatch: 'afkp-new', reviewNote: '第 3 节的页区间切错了' });
    expect(calls.filter((c) => c === `GET ${API_BASE}/books/b07/kp`).length).toBe(before + 1);
  });

  it('流水失败＝原样显 error，不降级成「已完成」', async () => {
    await open({ progress: [PROGRESS_FAILED] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    expect(store().job?.phase).toBe('failed');
    expect(store().job?.message).toContain('模型调用失败');
  });

  it('不在飞但流水未写出＝显式说「流水未写出」（KA-9：禁拿缺席当完成）', async () => {
    await open({ progress: [{ ...PROGRESS_OK, ledger: null }] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    expect(store().job?.phase).toBe('ok');
    expect(store().job?.message).toContain('流水未写出');
  });

  it('受理被拒（503＝8902 不可达）原样可见且不进轮询：没有批次号可轮', async () => {
    await open({ submit: { status: 503, detail: 'Axiom-Flow 服务不可达' } });
    expect(await store().submitParseAll()).toBe(false);
    expect(store().jobError).toContain('Axiom-Flow 服务不可达');
    expect(store().job).toBeNull();
    expect(calls.filter((c) => c.includes('/kp-jobs/'))).toEqual([]);
  });

  it('受理冲突（409＝对方已有在飞批次）原样可见，不静默不重试', async () => {
    await open({ submit: { status: 409, detail: '这本书已有在飞批次 afkp-x，不能叠批' } });
    expect(await store().submitParseAll()).toBe(false);
    expect(store().jobError).toContain('afkp-x');
    expect(store().job).toBeNull();
  });

  it('进度腿被拒＝保持 running（在飞判据不因一次读失败翻转），失败原因进读数', async () => {
    await open({ progress: [PROGRESS_RUNNING] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    mockFetch.mockImplementation(() => jsonResponse({ detail: 'Axiom-Flow 服务不可达' }, 503));
    await store().pollKpJobOnce();
    expect(store().job).toMatchObject({ phase: 'running' });
    expect(store().job?.message).toContain('Axiom-Flow 服务不可达');
    useKpReviewStore.setState({ job: null });
  });

  it('轮询超限＝停表但保持 running、文案指「刷新」（崩掉的批次仍留 draft 行，不能判成失败）', async () => {
    await open({ progress: [PROGRESS_RUNNING] });
    await store().submitParseAll();
    for (let i = 0; i < KP_JOB_MAX_POLLS; i += 1) await store().pollKpJobOnce();
    expect(store().job).toMatchObject({ phase: 'running', polls: KP_JOB_MAX_POLLS });
    expect(store().job?.message).toContain('刷新');
    const before = calls.length;
    await store().pollKpJobOnce();
    expect(calls).toHaveLength(before);
    expect(KP_JOB_POLL_MS).toBe(3000);
    expect(KP_JOB_MAX_POLLS).toBe(400);
  });

  it('零教材＝两枚提交按钮都不发请求（没有 book_id 就没有提交目标）', async () => {
    await open({ tree: [] });
    expect(store().bookId).toBeNull();
    expect(await store().submitParseAll()).toBe(false);
    expect(await store().submitReparse()).toBe(false);
    expect(writeCalls()).toEqual([]);
    expect(store().jobError).toContain('教材');
  });

  it('换教材＝停表并清在途记账、备注与弹窗（上一本书的批次号与选择不得残留）', async () => {
    await open();
    await store().submitParseAll();
    store().openReparseModal();
    store().setReparseTarget('start', 'kp:afkp-c1');
    store().setReparseTarget('end', 'kp:afkp-c2');
    store().setReviewNote('给下一本书的话');
    await store().pickBook('b05');
    expect(store().job).toBeNull();
    expect(store().reviewNote).toBe('');
    expect(store().reparseModalOpen).toBe(false);
    expect(store().reparseStartKey).toBeNull();
    expect(store().reparseEndKey).toBeNull();
    expect(writeCalls()).toEqual([`POST ${API_BASE}/kp-jobs`]);
  });
});

describe('提交与终态的弹窗出口（W16・第七令：批次号与五格计数不进界面）', () => {
  it('受理＝一枚 success 说「已开始解析（批次 …）」，且不再写常驻 notice（批次号从此只出现在这一句里）', async () => {
    const success = vi.spyOn(message, 'success');
    await open({ progress: [PROGRESS_RUNNING] });
    expect(await store().submitParseAll()).toBe(true);
    expect(success).toHaveBeenLastCalledWith('已开始解析（批次 afkp-new）');
    expect(store().notice).toBeNull();
    store().dismissJob();
  });

  it('四类拒绝各出一枚 error 并以「不能解析：」起头，原因原文不被吞（无教材／工作区在飞／受理 503／弹窗没选全两行）', async () => {
    const error = vi.spyOn(message, 'error');
    await open({ tree: [] });
    expect(await store().submitParseAll()).toBe(false);
    expect(String(error.mock.calls.at(-1)?.[0])).toMatch(/^不能解析：/);
    expect(String(error.mock.calls.at(-1)?.[0])).toContain('教材');

    await open({ inFlight: 'afkp-running' });
    expect(await store().submitParseAll()).toBe(false);
    expect(String(error.mock.calls.at(-1)?.[0])).toContain('afkp-running');

    await open({ submit: { status: 503, detail: 'Axiom-Flow 服务不可达' } });
    expect(await store().submitParseAll()).toBe(false);
    expect(String(error.mock.calls.at(-1)?.[0])).toContain('Axiom-Flow 服务不可达');

    await open();
    store().openReparseModal();
    expect(await store().submitReparse()).toBe(false);
    expect(String(error.mock.calls.at(-1)?.[0])).toBe('不能解析：还没有选全重新解析的起止两行。');
    // 一形一句：四枚拒绝不得叠出第五条
    expect(error).toHaveBeenCalledTimes(4);
  });

  it('在途不叠批那句也走弹窗：第二枚按下只出一句，不静默', async () => {
    const error = vi.spyOn(message, 'error');
    await open({ progress: [PROGRESS_RUNNING] });
    await store().submitParseAll();
    expect(await store().submitParseAll()).toBe(false);
    expect(String(error.mock.calls.at(-1)?.[0])).toMatch(/^不能解析：/);
    expect(String(error.mock.calls.at(-1)?.[0])).toContain('afkp-new');
    store().dismissJob();
  });

  it('收口＝一枚 success「解析完成：目录 N 行」，N 取流水 `result.outline_rows`', async () => {
    const success = vi.spyOn(message, 'success');
    await open({ progress: [PROGRESS_OK] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    expect(success).toHaveBeenLastCalledWith('解析完成：目录 4 行');
    // 受理一句＋收口一句，终态不多发报喜
    expect(success).toHaveBeenCalledTimes(2);
    store().dismissJob();
  });

  it('流水没带 `result.outline_rows`＝N 退回本批计数的 `outline`（拿到什么报什么，不写 0 行）', async () => {
    const success = vi.spyOn(message, 'success');
    const noResult: KpJobProgress = {
      ...PROGRESS_OK,
      counts: { ...PROGRESS_OK.counts, outline: 7 },
      ledger: { ...PROGRESS_OK.ledger as NonNullable<KpJobProgress['ledger']>, result: null },
    };
    await open({ progress: [noResult] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    expect(success).toHaveBeenLastCalledWith('解析完成：目录 7 行');
    store().dismissJob();
  });

  it('流水失败＝一枚 error「解析失败：<流水原文>」，不降级成已完成', async () => {
    const error = vi.spyOn(message, 'error');
    const success = vi.spyOn(message, 'success');
    await open({ progress: [PROGRESS_FAILED] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    expect(error).toHaveBeenLastCalledWith('解析失败：模型调用失败：文本槽位未配置');
    expect(success).toHaveBeenCalledTimes(1);
    store().dismissJob();
  });

  it('流水未写出＝一枚 warning 且不报喜（`KA-9`：禁拿缺席当完成）', async () => {
    const warning = vi.spyOn(message, 'warning');
    const success = vi.spyOn(message, 'success');
    await open({ progress: [PROGRESS_NO_LEDGER] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(String(warning.mock.calls[0][0])).toContain('流水未写出');
    expect(success).toHaveBeenCalledTimes(1);
    expect(store().job?.phase).toBe('ok');
    store().dismissJob();
  });

  it('停表＝恰一枚 warning，那一句与灰字后缀都零数字（批次号与计数不进界面）', async () => {
    const warning = vi.spyOn(message, 'warning');
    await open({ progress: [PROGRESS_RUNNING] });
    await store().submitParseAll();
    for (let i = 0; i < KP_JOB_MAX_POLLS; i += 1) await store().pollKpJobOnce();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(String(warning.mock.calls[0][0])).not.toMatch(/[0-9]/);
    expect(store().job).toMatchObject({ phase: 'running', polls: KP_JOB_MAX_POLLS });
    expect(store().job?.message).toContain('刷新');
    expect(store().job?.message).not.toMatch(/[0-9]/);
    const before = calls.length;
    await store().pollKpJobOnce();
    expect(calls).toHaveLength(before);
    expect(warning).toHaveBeenCalledTimes(1);
    store().dismissJob();
  });

  it('逐轮读失败＝只进 `job.message`，不每轮弹窗（在飞判据不因一次读失败翻转，也不敲人）', async () => {
    const error = vi.spyOn(message, 'error');
    const warning = vi.spyOn(message, 'warning');
    await open({ progress: [PROGRESS_RUNNING] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    mockFetch.mockImplementation(() => jsonResponse({ detail: 'Axiom-Flow 服务不可达' }, 503));
    await store().pollKpJobOnce();
    await store().pollKpJobOnce();
    expect(store().job).toMatchObject({ phase: 'running' });
    expect(store().job?.message).toContain('Axiom-Flow 服务不可达');
    expect(error).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
    store().dismissJob();
  });

  it('弹窗那一句不带五格计数与备注原文（账面撤下＝这些串从此不进界面）', async () => {
    const success = vi.spyOn(message, 'success');
    await open({ progress: [PROGRESS_RUNNING, PROGRESS_OK] });
    await store().submitParseAll();
    await store().pollKpJobOnce();
    await store().pollKpJobOnce();
    for (const [text] of success.mock.calls) expect(String(text)).not.toMatch(/draft|candidate|rejected/);
    expect(success).toHaveBeenLastCalledWith('解析完成：目录 4 行');
    store().dismissJob();
  });
});

describe('置灰清单（文案单点・第二令甲案）', () => {
  it('五条腿：全是在册端点但属本批放行范围外（生成腿已由 W25③ 单点重生成补齐）', () => {
    expect(DISABLED_LEGS.map((leg) => leg.leg)).toEqual([
      'outline.submit', 'kp.confirm', 'kp.review_flags', 'kp.export', 'narrative.write',
    ]);
    expect(DISABLED_LEGS.every((row) => row.kind === 'out-of-scope')).toBe(true);
    // 在册的不得写成「未接入」
    expect(store().disabledText('outline.submit')).toContain('在册');
    expect(store().disabledText('outline.submit')).not.toContain('未接入');
  });

  it('重生成只对知识点放行：章行点了零出网、屏不拼 prompt', async () => {
    await open();
    const before = calls.length;
    expect(await store().regenerateSummary()).toBe(false);
    expect(calls).toHaveLength(before);
    expect(writeCalls()).toEqual([]);
  });
});

describe('缓冲类型面（页面按这些字段消费，改名即断）', () => {
  it('DraftNode 带 node_id／rev／gen_status／nodeType 与起点块号：乐观并发、机器态、类型与中栏起点在屏上有据可读', () => {
    const row: DraftNode = buildDraft(kpNodes())[0];
    expect(Object.keys(row).sort()).toEqual([
      'confirmed', 'depth', 'dirty', 'genStatus', 'key', 'name', 'nodeType', 'orderHint', 'origin', 'pageEnd',
      'pageStart', 'parentKey', 'rev', 'nodeId', 'startBlock', 'summary',
    ].sort());
    expect(row).toMatchObject({ nodeId: 'afkp-c1', rev: 3, genStatus: 'candidate', confirmed: 0, nodeType: 'chapter' });
  });
});
