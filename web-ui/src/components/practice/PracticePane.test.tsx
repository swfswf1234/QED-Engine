/**
 * 中栏练习区单测（题源选择 → 抽取预览 → 确认入库 → 题卡作答，全程只走 mock fetch）。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PracticePane from './PracticePane';
import { mockFetch } from '../../test/setup';
import { usePracticeStore } from '../../stores/practice';
import type { QuestionRow } from '../../api/learn';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const BOOKS = {
  course_id: 'ma',
  books: [
    { book_id: 'b07', title: '习题选', roles: ['exercises'], course_id: 'ma', parse_status: 'pending', page_count: 400, parsed_pages: 400 },
    { book_id: 'b05', title: '教材', roles: ['textbook'], course_id: 'ma', parse_status: 'pending', page_count: 317, parsed_pages: 317 },
  ],
};

const PAGE = {
  page_no: 12,
  image_url: '',
  markdown: '',
  blocks: {
    page: 12,
    blocks: [
      { type: 'paragraph', bbox: [0, 0, 10, 10], text: '1、求极限 lim(x→0) sin x / x（A．1 B．0 C．不存在 D．∞）。' },
      { type: 'paragraph', bbox: [0, 0, 10, 10], text: '1、解：B。' },
    ],
  },
};

const ROW: QuestionRow = {
  question_id: 'q-1', course_id: 'ma', kind: 'quiz', question_type: 'choice',
  stem: '求极限 lim(x→0) sin x / x', options: null, answer_back: '', difficulty: 'medium',
  kp_type: 'concept', kp_id: 'kp-c1', source_kind: 'exercise_book', book_ref: 'b07',
  source_ref: null, answer_source: 'same_page', gen_batch: 'workbench-extract', model_ref: '',
  meta: {}, retired: false, created_at: '', updated_at: '',
};

const calls: string[] = [];
let posted: Record<string, unknown> | null = null;

beforeEach(() => {
  calls.length = 0;
  posted = null;
  usePracticeStore.setState({
    courseId: null, kpId: null, sourceBooks: [], sourceBookId: null, answerBookId: null,
    range: null, answerRange: null, extracting: false, drafts: [], unrecognized: [],
    extractNotices: [], questions: [], dueTasks: [], mistakes: [], mistakeStats: null,
    lastResult: null, loading: false, error: null, notice: null, courseDueCounts: {},
  });
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/learn/question-books')) return jsonResponse(BOOKS);
    if (url.includes('/pages/')) return jsonResponse(PAGE);
    if (url.includes('/learn/questions') && init?.method === 'POST') {
      posted = JSON.parse(String(init.body));
      return jsonResponse({
        created: 1, skipped_duplicates: 0, gen_batch: 'workbench-extract', model_ref: '', questions: [ROW],
      });
    }
    if (url.includes('/learn/questions')) return jsonResponse({ questions: [ROW], total: 1 });
    if (url.includes('/learn/review/due')) return jsonResponse({ course_id: 'ma', tasks: [], total_due: 0 });
    if (url.includes('/learn/mistakes')) {
      return jsonResponse({ items: [], total: 0, stats: { total: 0, wrong: 0, unresolved: 0, bookmarked: 0, due_today: 0 } });
    }
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
});

describe('中栏练习区 PracticePane', () => {
  it('进面拉题源书目并加载本章题，未填页范围时抽取按钮禁用', async () => {
    render(<PracticePane courseId="ma" kpId="kp-c1" />);
    expect(await screen.findByText('本章练习（1）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /抽取题目/ })).toBeDisabled();
    expect(screen.getByText(/v1 抽取式/)).toBeInTheDocument();
  });

  it('选题源书 + 页范围后抽取：出现确认面板与草稿，本章题列表随后端重取刷新', async () => {
    render(<PracticePane courseId="ma" kpId="kp-c1" />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '题源书' }));
    fireEvent.click(await screen.findByText('习题选（exercises）'));
    fireEvent.change(screen.getByLabelText('抽取起页'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('抽取止页'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /抽取题目/ }));
    expect(await screen.findByText('抽取预览（人工确认后入库）')).toBeInTheDocument();
    expect(screen.getByLabelText('题 1 题面')).toBeInTheDocument();
  });

  it('确认入库提交 course_id / kp_id / source_kind，并按题源 roles 定型', async () => {
    render(<PracticePane courseId="ma" kpId="kp-c1" />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '题源书' }));
    fireEvent.click(await screen.findByText('习题选（exercises）'));
    fireEvent.change(screen.getByLabelText('抽取起页'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('抽取止页'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /抽取题目/ }));
    fireEvent.click(await screen.findByRole('button', { name: /确认入库/ }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ course_id: 'ma', gen_batch: 'workbench-extract' });
    const items = (posted?.questions ?? []) as Array<Record<string, unknown>>;
    expect(items[0]).toMatchObject({ kp_id: 'kp-c1', source_kind: 'exercise_book', book_ref: 'b07' });
    expect(await screen.findByText('入库 1 题（跳重 0）')).toBeInTheDocument();
  });

  it('本章无题时给明确空态与下一步指引', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/learn/question-books')) return jsonResponse(BOOKS);
      if (url.includes('/learn/questions')) return jsonResponse({ questions: [], total: 0 });
      if (url.includes('/learn/review/due')) return jsonResponse({ course_id: 'ma', tasks: [], total_due: 0 });
      if (url.includes('/learn/mistakes')) {
        return jsonResponse({ items: [], total: 0, stats: { total: 0, wrong: 0, unresolved: 0, bookmarked: 0, due_today: 0 } });
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    render(<PracticePane courseId="ma" kpId="kp-c1" />);
    expect(await screen.findByText(/本章还没有题/)).toBeInTheDocument();
    expect(screen.getByText('本章练习（0）')).toBeInTheDocument();
  });
});
