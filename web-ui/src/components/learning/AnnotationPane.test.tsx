/**
 * 右栏「批注」四段闭集单测（REQ-144 W5·设计正本 §6）：
 * 段① 本章总结＝章行 `summary` 直读／段② 本章学习导读＝章行提升锚 `from_detail_id` 走 8900 透传读腿／
 * 段③ 知识点总结＝该 point 行 `summary`（选中整章不出现）／段④ 记录＝kp 行 `learner_note`（唯一可写段）。
 * 口径：缺位整段不渲染——零占位句、零下一步话术、零生成入口、零提问入口；
 * 段② 的门与取数键同一个锚，锚空即不发请求，透传回 `exists=false` 或读腿失败也整段不渲染。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import AnnotationPane from './AnnotationPane';
import AnnotationForm, { NOTE_MAX_LENGTH } from './AnnotationForm';
import ChapterNotePane from './ChapterNotePane';
import { theme } from '../../theme';
import { mockFetch } from '../../test/setup';
import { useLearnWorkbenchStore } from '../../stores/learnWorkbench';
import type { LearnCourse, PointChapter, PointUnit } from '../../api/learn';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

/** 章行：默认带提升锚（＝提升腿的成品），`from_detail_id: ''` 用于人工目录章 */
const CHAPTER: PointChapter = {
  node_kind: 'outline', unit_id: 'kp:c1', kp_id: 'c1', name: '第1章 实数', point_count: 2, book_ref: 'b05',
  source_ref: { ref_id: 'b05', page_start: 5, page_end: 20 }, summary: '', key_points: [],
  from_detail_id: 'afkp-c1',
};

function point(overrides: Partial<PointUnit> = {}): PointUnit {
  return {
    node_kind: 'point', unit_id: 'kp:p1', parent_id: 'kp:c1', chapter_kp_id: 'c1', kp_id: 'p1',
    name: '实数的运算', title: '实数的运算', sort_order: 0, type: 'concept', book_ref: 'b05',
    source_ref: { ref_id: 'b05', page_start: 5, page_end: 9 }, window_source: 'point',
    summary: '先定义绝对值，再列它的三条性质', angles: [], learner: {
      kp_id: 'p1', status: 'done', qualitative_passed: null, qualitative_note: '',
      assessed_by: 'learner', assessed_at: '', learner_note: '上次记的一句', updated_at: '2026-10-20T00:00:00',
    },
    ...overrides,
  };
}

const hub = {
  note: '上次记的一句',
  status: 'done' as 'done' | 'pending',
  posted: null as Record<string, unknown> | null,
  /** 段② 读腿回执：默认可读的章导读正文 */
  narrative: () => jsonResponse({
    node_id: 'afkp-c1', narrative_ref: 'intro.md', exists: true, content: '本章从实数的三条线讲起', bytes: 30, rev: 1,
  }),
};

const calls: string[] = [];

/** 写后重取（`reloadPoints`）的回执：learner 位跟着 hub.note／hub.status 走，记录段才有新值可回看 */
function pointWithLearner(): PointUnit {
  return point({
    learner: {
      kp_id: 'p1', status: hub.status, qualitative_passed: null, qualitative_note: '',
      assessed_by: 'learner', assessed_at: '', learner_note: hub.note, updated_at: '2026-10-21T00:00:00',
    },
  });
}

function routes() {
  calls.length = 0;
  hub.note = '上次记的一句';
  hub.status = 'done';
  hub.posted = null;
  hub.narrative = () => jsonResponse({
    node_id: 'afkp-c1', narrative_ref: 'intro.md', exists: true, content: '本章从实数的三条线讲起', bytes: 30, rev: 1,
  });
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.includes('/kp/nodes/')) return hub.narrative();
    if (url.includes('/learn/courses/ma/progress')) {
      if (init?.method === 'POST') {
        hub.posted = body;
        if (body.note !== undefined) hub.note = String(body.note);
        return jsonResponse({ kp_id: 'p1', status: body.status, derived: {} });
      }
      return jsonResponse({});
    }
    if (url.includes('/knowledge-points')) {
      return jsonResponse({
        course: { course_id: 'ma', name: '数学分析', track: '分析学', domain_id: 'math', description: '' },
        points: [pointWithLearner()], total: 1,
        sequence: { enrolled: true, units: [pointWithLearner()], chapters: [], kp_path: [] },
      });
    }
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

function presetState(patch: Record<string, unknown> = {}) {
  useLearnWorkbenchStore.setState({
    courseId: 'ma', learnCourse: { learn_course_id: 'ma', name: '数学分析' } as LearnCourse,
    bookId: 'b05', selected: { kind: 'point', kpId: 'p1' }, selectedKpId: 'p1',
    selectedPoint: point(), pointUnits: [point()], chapters: [{ ...CHAPTER, summary: '本章把实数分成序与完备两条线' }],
    busy: false, notice: null,
    ...patch,
  });
}

function withProvider(node: React.ReactNode) {
  return render(<ConfigProvider theme={theme}>{node}</ConfigProvider>);
}

describe('段① 本章总结（直读章行 summary，缺位整段不渲染）', () => {
  beforeEach(() => {
    presetState();
    routes();
  });

  it('章行有总结即直读，段内不出现生成入口也不发生成请求', () => {
    withProvider(<ChapterNotePane />);
    expect(screen.getByText('本章总结')).toBeInTheDocument();
    expect(screen.getByTestId('chapter-summary')).toHaveTextContent('本章把实数分成序与完备两条线');
    expect(screen.queryByRole('button', { name: /生成/ })).toBeNull();
    expect(calls.filter((c) => c.includes('/annotations/generate'))).toHaveLength(0);
  });

  it('章行没有总结＝整段不渲染，不写「还没有总结」一类占位句', () => {
    presetState({ chapters: [{ ...CHAPTER, summary: '' }] });
    withProvider(<ChapterNotePane />);
    expect(screen.queryByText('本章总结')).toBeNull();
    expect(screen.queryByText(/还没有总结/)).toBeNull();
    expect(screen.queryByText(/先在左栏/)).toBeNull();
  });

  it('没选中任何一行＝右栏不渲染任何章级段，也不给归属话术', () => {
    presetState({ selected: null, selectedKpId: null, selectedPoint: null });
    withProvider(<ChapterNotePane />);
    expect(screen.queryByText('本章总结')).toBeNull();
    expect(screen.queryByText(/才有归属/)).toBeNull();
  });

  it('「学习要点」位退出本面：段内不再渲染要点清单', () => {
    presetState({ chapters: [{ ...CHAPTER, key_points: ['确界原理', '单调有界原理'] }] });
    withProvider(<ChapterNotePane />);
    expect(screen.queryByText('学习要点')).toBeNull();
    expect(screen.queryByTestId('chapter-key-points')).toBeNull();
  });
});

describe('段② 本章学习导读（取数键与门同为章行提升锚 `from_detail_id`）', () => {
  beforeEach(() => {
    presetState();
    routes();
  });

  it('锚在、正文在：按锚打透传读腿并渲染正文', async () => {
    withProvider(<ChapterNotePane />);
    expect(await screen.findByTestId('chapter-intro')).toHaveTextContent('本章从实数的三条线讲起');
    expect(calls.some((c) => c.includes('/kp/nodes/afkp-c1/narrative'))).toBe(true);
  });

  it('锚空（人工目录章）＝整段不渲染且零请求', async () => {
    presetState({ chapters: [{ ...CHAPTER, summary: '本章把实数分成序与完备两条线', from_detail_id: '' }] });
    withProvider(<ChapterNotePane />);
    await waitFor(() => expect(screen.getByTestId('chapter-summary')).toBeInTheDocument());
    expect(screen.queryByTestId('chapter-intro')).toBeNull();
    expect(calls.filter((c) => c.includes('/kp/nodes/'))).toHaveLength(0);
  });

  it('透传回 exists=false（指针悬空）＝整段不渲染，不显示矛盾正文', async () => {
    hub.narrative = () => jsonResponse({
      node_id: 'afkp-c1', narrative_ref: 'gone.md', exists: false, content: '', bytes: 0, rev: 1,
    });
    withProvider(<ChapterNotePane />);
    await waitFor(() => expect(screen.getByTestId('chapter-summary')).toBeInTheDocument());
    expect(screen.queryByTestId('chapter-intro')).toBeNull();
    expect(screen.queryByText('本章学习导读')).toBeNull();
  });

  it('读腿不可达＝整段不渲染、不白屏，本章总结照常', async () => {
    hub.narrative = () => jsonResponse({ detail: '无法连接' }, 503);
    withProvider(<ChapterNotePane />);
    await waitFor(() => expect(screen.getByTestId('chapter-summary')).toBeInTheDocument());
    expect(screen.queryByTestId('chapter-intro')).toBeNull();
  });
});

describe('段③ 知识点总结（仅选中知识点时出现，直读该 point 行 summary）', () => {
  beforeEach(() => {
    presetState();
    routes();
  });

  it('选中知识点且有总结＝渲染这一段的总结', () => {
    withProvider(<AnnotationPane />);
    expect(screen.getByText('知识点总结')).toBeInTheDocument();
    expect(screen.getByTestId('point-summary')).toHaveTextContent('先定义绝对值，再列它的三条性质');
  });

  it('整章阅读＝条级总结不出现', () => {
    presetState({ selected: { kind: 'chapter', kpId: 'c1' }, selectedPoint: null });
    withProvider(<AnnotationPane />);
    expect(screen.queryByText('知识点总结')).toBeNull();
  });

  it('该条没有总结＝整段不渲染，不出占位句也不出注解位', () => {
    presetState({ selectedPoint: point({ summary: '' }) });
    withProvider(<AnnotationPane />);
    expect(screen.queryByText('知识点总结')).toBeNull();
    expect(screen.queryByText(/还没有/)).toBeNull();
    expect(screen.queryByTestId('detail-list')).toBeNull();
  });

  it('「详解」与提问入口退出本面：angles 不再渲染、零提问输入框', () => {
    presetState({ selectedPoint: point({ angles: [{ angle: 'explanation', note: '一条旧注解' }] }) });
    withProvider(<AnnotationPane />);
    expect(screen.queryByText('详解')).toBeNull();
    expect(screen.queryByText('一条旧注解')).toBeNull();
    expect(screen.queryByLabelText('提问')).toBeNull();
    expect(screen.queryByText(/暂未开放/)).toBeNull();
  });
});

describe('段④ 记录（唯一可写段＝kp 行 learner_note·人工位）', () => {
  beforeEach(() => {
    presetState();
    routes();
  });

  it('进场直读已写过的记录：正文框预填同一句并在段内回看', () => {
    withProvider(<AnnotationForm />);
    expect(screen.getByText('记录')).toBeInTheDocument();
    expect(screen.getByLabelText('记录正文')).toHaveValue('上次记的一句');
    expect(screen.getByTestId('note-list')).toHaveTextContent('上次记的一句');
    expect(screen.getByRole('button', { name: '保存记录' })).toBeDisabled();
  });

  it('空态＝空白文本域，不写 placeholder 话术', () => {
    presetState({ selectedPoint: point({ learner: { ...point().learner!, learner_note: '' } }) });
    withProvider(<AnnotationForm />);
    expect(screen.getByLabelText('记录正文')).toHaveValue('');
    expect(screen.getByLabelText('记录正文')).not.toHaveAttribute('placeholder');
  });

  it('改一句再保存＝写 kp 行的 learner_note（带当前终态位整笔提交），写后回看', async () => {
    withProvider(<AnnotationForm />);
    fireEvent.change(screen.getByLabelText('记录正文'), { target: { value: '上确界是最小的那个上界' } });
    const save = screen.getByRole('button', { name: '保存记录' });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(hub.posted).not.toBeNull());
    expect(hub.posted).toMatchObject({ kp_id: 'p1', status: 'done', note: '上确界是最小的那个上界' });
    await waitFor(() => expect(screen.getByTestId('note-list')).toHaveTextContent('上确界是最小的那个上界'));
  });

  it('该条尚无 kp 行＝保存禁用、零请求、不给下一步话术（§10）', () => {
    presetState({ selectedPoint: point({ learner: null }) });
    withProvider(<AnnotationForm />);
    expect(screen.getByRole('button', { name: '保存记录' })).toBeDisabled();
    expect(screen.queryByText(/还没有学习记录/)).toBeNull();
    expect(calls.filter((c) => c.includes('/progress'))).toHaveLength(0);
  });

  it('未选中条目＝输入与保存都禁用，且不写归属话术', () => {
    presetState({ selected: null, selectedKpId: null, selectedPoint: null });
    withProvider(<AnnotationForm />);
    expect(screen.getByRole('button', { name: '保存记录' })).toBeDisabled();
    expect(screen.getByLabelText('记录正文')).toBeDisabled();
    expect(screen.queryByText(/才有归属/)).toBeNull();
  });

  it('没有知识点名输入与四分类选择器；正文框字数上限与后端同值', () => {
    withProvider(<AnnotationForm />);
    expect(screen.queryByLabelText('知识点名')).toBeNull();
    expect(screen.queryByRole('combobox', { name: '四分类' })).toBeNull();
    expect(screen.getByLabelText('记录正文')).toHaveAttribute('maxLength', String(NOTE_MAX_LENGTH));
  });
});
