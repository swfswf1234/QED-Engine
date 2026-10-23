/**
 * 右栏注解三段单测（v1.0 形态）：章级总结与学习要点 → 本条多角度注解与长文 → 备注。
 * 口径：章级成品挂章行、进场直读，缺位才出「生成」；条级注解＝主表 `angles`（数组序即权威排序，
 * 无候选池、无点赞保留位），长文按 `narrative_ref` 走独立读腿且悬空必给 reason；
 * 备注＝kp 行 `learner_note`，没有 kp 行时存不下（服务端不起新行）。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import AnnotationPane, { NarrativePane } from './AnnotationPane';
import AnnotationForm, { NOTE_MAX_LENGTH } from './AnnotationForm';
import ChapterNotePane from './ChapterNotePane';
import { theme } from '../../theme';
import { mockFetch } from '../../test/setup';
import { useLearnWorkbenchStore } from '../../stores/learnWorkbench';
import type { KpAngle, LearnCourse, PointChapter, PointUnit } from '../../api/learn';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const CHAPTER: PointChapter = {
  node_kind: 'outline', unit_id: 'kp:c1', kp_id: 'c1', name: '第1章 实数', point_count: 2, book_ref: 'b05',
  source_ref: { ref_id: 'b05', page_start: 5, page_end: 20 }, summary: '', key_points: [],
};

const ANGLES: KpAngle[] = [{ angle: 'summary', note: '非空有上界的实数集必有上确界' }];

function point(overrides: Partial<PointUnit> = {}): PointUnit {
  return {
    node_kind: 'point', unit_id: 'kp:p1', parent_id: 'kp:c1', chapter_kp_id: 'c1', kp_id: 'p1',
    name: '实数的运算', title: '实数的运算', sort_order: 0, type: 'concept', book_ref: 'b05',
    source_ref: { ref_id: 'b05', page_start: 5, page_end: 9 }, window_source: 'point',
    summary: '', angles: ANGLES, learner: {
      kp_id: 'p1', status: 'done', qualitative_passed: null, qualitative_note: '',
      assessed_by: 'learner', assessed_at: '', learner_note: '上次记的一句', updated_at: '2026-10-20T00:00:00',
    },
    ...overrides,
  };
}

const hub = {
  note: '上次记的一句',
  status: 'done' as 'done' | 'pending',
  angles: [...ANGLES],
  posted: null as Record<string, unknown> | null,
};

/** generate 回执夹具：默认给一条追加后的整行；章级用例按 body.part 自行改写 */
let generateReply: (body: Record<string, unknown>) => Promise<unknown> = () => jsonResponse({
  ok: true, target: { kind: 'point', kp_id: 'p1', name: '实数的运算' },
  point: point({ angles: [...hub.angles, { angle: 'explanation', note: '生成的本条注解正文' }] }),
});
let narrativeReply: () => Promise<unknown> = () => jsonResponse({
  kp_id: 'p1', narrative_ref: 'knowledge/p1.md', available: true, content: '长文正文第一段', reason: '',
});

const calls: string[] = [];

function routes() {
  calls.length = 0;
  hub.note = '上次记的一句';
  hub.status = 'done';
  hub.angles = [...ANGLES];
  hub.posted = null;
  generateReply = () => jsonResponse({
    ok: true, target: { kind: 'point', kp_id: 'p1', name: '实数的运算' },
    point: point({ angles: [...hub.angles, { angle: 'explanation', note: '生成的本条注解正文' }] }),
  });
  narrativeReply = () => jsonResponse({
    kp_id: 'p1', narrative_ref: 'knowledge/p1.md', available: true, content: '长文正文第一段', reason: '',
  });
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.includes('/learn/annotations/generate')) return generateReply(body);
    if (url.includes('/narrative')) return narrativeReply();
    if (url.includes('/learn/courses/ma/progress')) {
      if (init?.method === 'POST') {
        hub.posted = body;
        if (body.note !== undefined) hub.note = String(body.note);
        hub.status = body.status === 'pending' ? 'pending' : 'done';
        return jsonResponse({ kp_id: 'p1', status: body.status, derived: {} });
      }
      return jsonResponse({});
    }
    if (url.includes('/knowledge-points')) {
      return jsonResponse({
        course: { course_id: 'ma', name: '数学分析', track: '分析学', domain_id: 'math', description: '' },
        points: [point({ angles: hub.angles })], total: 1,
        sequence: {
          enrolled: true,
          units: [point({
            angles: hub.angles,
            learner: hub.status === 'pending' ? null : {
              kp_id: 'p1', status: hub.status, qualitative_passed: null, qualitative_note: '',
              assessed_by: 'learner', assessed_at: '', learner_note: hub.note, updated_at: '2026-10-21T00:00:00',
            },
          })],
          chapters: [CHAPTER], kp_path: [],
        },
      });
    }
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

function presetState(patch: Record<string, unknown> = {}) {
  useLearnWorkbenchStore.setState({
    courseId: 'ma', learnCourse: { learn_course_id: 'ma', name: '数学分析' } as LearnCourse,
    bookId: 'b05', selected: { kind: 'point', kpId: 'p1' }, selectedKpId: 'p1',
    selectedPoint: point(), pointUnits: [point()], chapters: [CHAPTER],
    generating: false, busy: false, notice: null, generateError: null, generateTarget: null,
    ...patch,
  });
}

function withProvider(node: React.ReactNode) {
  return render(<ConfigProvider theme={theme}>{node}</ConfigProvider>);
}

describe('详解段 AnnotationPane（主表 angles：数组序即展示序，无点赞与入库入口）', () => {
  beforeEach(() => {
    presetState();
    routes();
  });

  it('按角度用途标注并直读正文，只读面零确认／驳回／点赞入口', () => {
    presetState({ selectedPoint: point({ angles: [ANGLES[0], { angle: 'explanation', note: '一列嵌套闭区间的交非空' }] }) });
    withProvider(<AnnotationPane />);
    expect(screen.getByTestId('annotation-summary')).toHaveTextContent('非空有上界的实数集必有上确界');
    expect(screen.getByTestId('annotation-explanation')).toHaveTextContent('一列嵌套闭区间的交非空');
    expect(screen.getByText('总结')).toBeInTheDocument();
    expect(screen.getByText('注解')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认入库' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /驳\s*回/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /点赞/ })).not.toBeInTheDocument();
  });

  it('没有正文的元素不算成品：只有带 note 的那些进这一面，顺序即数组序', () => {
    presetState({
      selectedPoint: point({
        angles: [
          { angle: 'definition', note: '定义正文' },
          { angle: 'theorem' },
          { angle: 'proof', note: '' },
          { angle: 'example', note: '例子正文' },
        ],
      }),
    });
    withProvider(<AnnotationPane />);
    const list = screen.getByTestId('detail-list');
    expect([...list.querySelectorAll('[data-testid^="annotation-"]')]
      .map((node) => node.getAttribute('data-testid')))
    .toEqual(['annotation-definition', 'annotation-example']);
  });

  it('零注解时给空态与下一步，不显示空列表', () => {
    presetState({ selectedPoint: point({ angles: [] }) });
    withProvider(<AnnotationPane />);
    expect(screen.getByText('这一条还没有注解：点「生成本条注解」先来一条。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /生成本条注解/ })).toBeInTheDocument();
  });

  it('生成一条：请求带本课/这一条与 part=annotation，回执整行合并回当前条即直读', async () => {
    presetState({ selectedPoint: point({ angles: [] }) });
    withProvider(<AnnotationPane />);
    fireEvent.click(screen.getByRole('button', { name: /生成本条注解/ }));
    await waitFor(() => expect(screen.getByText('生成的本条注解正文')).toBeInTheDocument());
    expect(calls.some((c) => c.startsWith('POST ') && c.includes('/learn/annotations/generate'))).toBe(true);
    expect(useLearnWorkbenchStore.getState().selectedPoint?.angles?.length).toBeGreaterThan(0);
  });

  it('生成失败只在本段说明这一句，另一段不重复', async () => {
    presetState({ selectedPoint: point({ angles: [] }) });
    generateReply = () => jsonResponse({ detail: '这一条的正文还没准备好，暂时生成不了' }, 503);
    withProvider(<AnnotationPane />);
    fireEvent.click(screen.getByRole('button', { name: /生成本条注解/ }));
    expect(await screen.findByText('这一条的正文还没准备好，暂时生成不了')).toBeInTheDocument();
    expect(useLearnWorkbenchStore.getState().generateTarget).toBe('point');
  });

  it('整章阅读时条级生成入口禁用：生成对象只能是知识点', () => {
    presetState({ selected: { kind: 'chapter', kpId: 'c1' }, selectedPoint: null });
    withProvider(<AnnotationPane />);
    expect(screen.getByRole('button', { name: /生成本条注解/ })).toBeDisabled();
    expect(calls.filter((c) => c.includes('/annotations/generate'))).toHaveLength(0);
  });

  it('没选中任何一条时段内禁用并给出归属提示', () => {
    presetState({ selected: null, selectedKpId: null, selectedPoint: null });
    withProvider(<AnnotationPane />);
    expect(screen.getByRole('button', { name: /生成本条注解/ })).toBeDisabled();
    expect(screen.getByText('先在左栏选中一条知识点，注解才有归属。')).toBeInTheDocument();
  });

  it('提问入口＝输入框＋置灰发送并注明暂未开放，本批零请求（C28）', () => {
    withProvider(<AnnotationPane />);
    fireEvent.change(screen.getByLabelText('提问'), { target: { value: '为什么上确界最小？' } });
    expect(screen.getByRole('button', { name: /发\s*送/ })).toBeDisabled();
    expect(screen.getByText('提问功能暂未开放')).toBeInTheDocument();
    expect(calls.filter((c) => c.startsWith('POST '))).toHaveLength(0);
  });
});

describe('长文读腿 NarrativePane（按 narrative_ref 取文件正文，悬空必给 reason）', () => {
  beforeEach(() => {
    presetState();
    routes();
  });

  it('没有指针时只说一句没有登记，不发请求', () => {
    withProvider(<NarrativePane point={point({ narrative_ref: '' })} />);
    expect(screen.getByText('这一条还没有长文正文。')).toBeInTheDocument();
    expect(calls.filter((c) => c.includes('/narrative'))).toHaveLength(0);
  });

  it('点一次读这一条：按 kp_id 打读腿并渲染正文', async () => {
    withProvider(<NarrativePane point={point({ narrative_ref: 'knowledge/p1.md' })} />);
    fireEvent.click(screen.getByRole('button', { name: /读这一条的正文/ }));
    expect(await screen.findByTestId('narrative-content')).toHaveTextContent('长文正文第一段');
    expect(calls.some((c) => c.includes('/learn/knowledge-points/p1/narrative'))).toBe(true);
  });

  it('指针悬空时明说原因，不静默显示空白', async () => {
    narrativeReply = () => jsonResponse({
      kp_id: 'p1', narrative_ref: 'knowledge/gone.md', available: false, content: '', reason: '正文文件不存在',
    });
    withProvider(<NarrativePane point={point({ narrative_ref: 'knowledge/gone.md' })} />);
    fireEvent.click(screen.getByRole('button', { name: /读这一条的正文/ }));
    expect(await screen.findByText('正文文件不存在')).toBeInTheDocument();
    expect(screen.queryByTestId('narrative-content')).not.toBeInTheDocument();
  });

  it('超长正文截断时交代取了多大一段', async () => {
    narrativeReply = () => jsonResponse({
      kp_id: 'p1', narrative_ref: 'knowledge/p1.md', available: true, content: '很长的正文开头',
      reason: '', bytes: 20480, truncated: true,
    });
    withProvider(<NarrativePane point={point({ narrative_ref: 'knowledge/p1.md' })} />);
    fireEvent.click(screen.getByRole('button', { name: /读这一条的正文/ }));
    expect(await screen.findByText('正文较长，这里只取了前 20 KB 之内的内容。')).toBeInTheDocument();
  });

  it('读腿不可达时给降级话术，不白屏', async () => {
    narrativeReply = () => jsonResponse({ detail: 'Not Found' }, 404);
    withProvider(<NarrativePane point={point({ narrative_ref: 'knowledge/p1.md' })} />);
    fireEvent.click(screen.getByRole('button', { name: /读这一条的正文/ }));
    expect(await screen.findByText(/Not Found|暂未能|不存在|404/)).toBeInTheDocument();
  });
});

describe('章级注解段 ChapterNotePane（本章总结＋学习要点：进场直读，缺位才生成）', () => {
  beforeEach(() => {
    presetState();
    routes();
  });

  it('章级两件齐备时直读，不再出「生成」入口也不发请求', () => {
    presetState({
      chapters: [{ ...CHAPTER, summary: '本章把实数分成序与完备两条线', key_points: ['确界原理', '单调有界原理'] }],
    });
    withProvider(<ChapterNotePane />);
    expect(screen.getByText('本章把实数分成序与完备两条线')).toBeInTheDocument();
    expect(screen.getByText('确界原理')).toBeInTheDocument();
    expect(screen.getByText('单调有界原理')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /生成本章/ })).not.toBeInTheDocument();
    expect(calls.filter((c) => c.includes('/annotations/generate'))).toHaveLength(0);
  });

  it('缺什么生成什么：先总结后要点，成品写回章行即可直读', async () => {
    const parts: string[] = [];
    // 模拟服务端 patch：每次只补一件，回执带章行合并后的完整成品
    const merged = { kp_id: 'c1', summary: '', key_points: [] as string[] };
    generateReply = (body) => {
      parts.push(String(body.part));
      if (body.part === 'summary') merged.summary = '本章把实数分成序与完备两条线';
      else merged.key_points = ['确界原理', '单调有界原理'];
      return jsonResponse({ ok: true, target: { kind: 'chapter', kp_id: 'c1', name: CHAPTER.name }, chapter: { ...merged } });
    };
    withProvider(<ChapterNotePane />);
    fireEvent.click(screen.getByRole('button', { name: /生成本章总结与学习要点/ }));
    expect(await screen.findByText('本章把实数分成序与完备两条线')).toBeInTheDocument();
    expect(screen.getByText('确界原理')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /生成本章总结与学习要点/ })).not.toBeInTheDocument();
    expect(parts).toEqual(['summary', 'key_points']);
  });

  it('整章阅读时生成对象就是这一章', async () => {
    presetState({ selected: { kind: 'chapter', kpId: 'c1' }, selectedPoint: null });
    generateReply = () => jsonResponse({
      ok: true,
      target: { kind: 'chapter', kp_id: 'c1', name: CHAPTER.name },
      chapter: { kp_id: 'c1', summary: '整章口径的本章总结', key_points: [] },
    });
    withProvider(<ChapterNotePane />);
    fireEvent.click(screen.getByRole('button', { name: /生成本章总结与学习要点/ }));
    expect(await screen.findByText('整章口径的本章总结')).toBeInTheDocument();
  });

  it('章级生成失败只在本段说明，条级段不受影响', async () => {
    generateReply = () => jsonResponse({ detail: '这一章的正文还没准备好，暂时生成不了' }, 503);
    withProvider(<ChapterNotePane />);
    fireEvent.click(screen.getByRole('button', { name: /生成本章总结与学习要点/ }));
    expect(await screen.findByText('这一章的正文还没准备好，暂时生成不了')).toBeInTheDocument();
    expect(useLearnWorkbenchStore.getState().generateTarget).toBe('chapter');
  });
});

describe('备注段 AnnotationForm（备注＝kp 行 learner_note，随当前终态位整笔提交·C26）', () => {
  beforeEach(() => {
    presetState();
    routes();
  });

  it('进场直读已写过的备注：正文框预填同一句并在段内回看', () => {
    withProvider(<AnnotationForm />);
    expect(screen.getByLabelText('备注正文')).toHaveValue('上次记的一句');
    expect(screen.getByTestId('note-list')).toHaveTextContent('上次记的一句');
    expect(screen.getByRole('button', { name: '保存备注' })).toBeDisabled();
  });

  it('改一句再保存＝写 kp 行的 learner_note，写后重取即回显', async () => {
    withProvider(<AnnotationForm />);
    fireEvent.change(screen.getByLabelText('备注正文'), { target: { value: '上确界是最小的那个上界' } });
    const save = screen.getByRole('button', { name: '保存备注' });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(hub.posted).not.toBeNull());
    expect(hub.posted).toMatchObject({ kp_id: 'p1', status: 'done', note: '上确界是最小的那个上界' });
    expect(calls.filter((c) => c.includes('/kp-details'))).toHaveLength(0);
    await waitFor(() => expect(screen.getByTestId('note-list')).toHaveTextContent('上确界是最小的那个上界'));
  });

  it('这一条还没有学习记录时保存禁用并给下一步话术：零 progress 写入', () => {
    presetState({ selectedPoint: point({ learner: null }) });
    withProvider(<AnnotationForm />);
    expect(screen.getByText('这一条还没有学习记录：先用正文末尾记上位置，备注就存得下了。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存备注' })).toBeDisabled();
    expect(calls.filter((c) => c.includes('/progress'))).toHaveLength(0);
  });

  it('没有知识点名输入与四分类选择器；未选中条时禁用并给归属话术（C26）', () => {
    presetState({ selected: null, selectedKpId: null, selectedPoint: null });
    withProvider(<AnnotationForm />);
    expect(screen.queryByLabelText('知识点名')).toBeNull();
    expect(screen.queryByRole('combobox', { name: '四分类' })).toBeNull();
    expect(screen.getByRole('button', { name: '保存备注' })).toBeDisabled();
    expect(screen.getByLabelText('备注正文')).toBeDisabled();
    expect(screen.getByText('先在左栏选中一条知识点，备注才有归属。')).toBeInTheDocument();
  });

  it('正文框的字数上限与后端 note 的 max_length 同值', () => {
    withProvider(<AnnotationForm />);
    expect(screen.getByLabelText('备注正文')).toHaveAttribute('maxLength', String(NOTE_MAX_LENGTH));
  });
});
