/**
 * 练习域 store（课后练习独立面 `#/practice`：题源抽取 → 人工确认入库 → 题卡作答 → 今日到期队列与错题本）
 * - 归属口径＝**课级全量**（REQ-106 裁决 R2）：题列表/到期队列/错题本都不传 `kp`，也不做客户端过滤；
 *   入库 `kp_id` 一律留空（本面无章/节选择器），题行 `kp_id` 只在列表上作归属标签展示
 * - 到期队列＝**单请求** `max_tasks=`{@link REVIEW_QUEUE_MAX_TASKS}（裁决 R5）：同一响应给
 *   `total_due`（截断前全量，进 `totalDue`）与队列 `tasks`
 * - 题源＝现成书（`GET /learn/question-books`，roles 与课程归属过滤在 8900）**且已解析出页产物**
 *   （`parsed_pages>0`，否则逐页必然 404）＋ 页范围，抽取走 `exerciseParse` 纯函数
 * - 入库＝人工确认面板提交通过校验的草稿（`POST /learn/questions`，`(course_id, stem_hash)` 幂等跳重）
 * - 作答＝`POST /learn/attempts` 同事务判分，判分依据只在此响应回传（缝 2）；flashcard 走自评（裁决 ⑨）
 * - 写后整体重取，不做乐观更新（判例 stores/courseKnowledge、stores/learnWorkbench）
 * - 数据一律经 8900（ADR 0007）
 */
import { create } from 'zustand';
import { getBookPage, type PageData } from '../api/axiom';
import { ApiError, describeError } from '../api/client';
import { blocksOf } from '../components/parsing/CompareView';
import {
  addAttempt, addQuestions, getQuestionBooks, getReviewDue, listMistakes, listQuestions, patchAttempt,
  type AttemptResponse, type MistakeItem, type MistakeStats, type QuestionBook, type QuestionRow,
  type ReviewDueTask,
} from '../api/learn';
import {
  draftIssues, exerciseBlocksOf, parseAnswerIndex, parseExerciseBlocks, toQuestionPayload,
  type ExerciseSourceKind, type QuestionDraft,
  type UnrecognizedLine,
} from '../exerciseParse';

/** 单次抽取的页数上限（页范围过大时拒绝，避免整本扫描） */
export const EXTRACT_MAX_PAGES = 40;

/** 到期队列单请求条数＝服务端 `max_tasks` 上限（裁决 R5：一次请求同给计数与队列） */
export const REVIEW_QUEUE_MAX_TASKS = 100;

/** 练习区草稿批的 gen_batch 常量（题面溯源用，不随用户输入变化） */
export const PRACTICE_GEN_BATCH = 'workbench-extract';

export interface PageRange {
  start: number;
  end: number;
}

export interface AttemptInput {
  question_id: string;
  user_answer: string;
  origin?: 'new' | 'review' | 'manual';
  review_date?: string | null;
  self_result?: 'correct' | 'again';
}

const SOURCE_KIND_BY_ROLE: Record<string, ExerciseSourceKind> = {
  exercises: 'exercise_book',
  textbook: 'textbook_chapter',
  solutions: 'solutions_book',
};

/** 题源书 roles → `source_kind`（口径同后端 SOURCE_KINDS） */
export function sourceKindOfRoles(roles: readonly string[]): ExerciseSourceKind {
  for (const role of roles ?? []) {
    const mapped = SOURCE_KIND_BY_ROLE[role];
    if (mapped) return mapped;
  }
  return 'manual';
}

/** 合法页范围（起止齐备、不倒挂、不超上限），非法返回 null */
export function normalizeRange(range: PageRange | null): PageRange | null {
  if (!range) return null;
  const { start, end } = range;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 1 || end < start) return null;
  if (end - start + 1 > EXTRACT_MAX_PAGES) return null;
  return { start, end };
}

export interface PracticeStore {
  courseId: string | null;
  sourceBooks: QuestionBook[];
  sourceBookId: string | null;
  answerBookId: string | null;
  range: PageRange | null;
  answerRange: PageRange | null;
  extracting: boolean;
  drafts: QuestionDraft[];
  unrecognized: UnrecognizedLine[];
  extractNotices: string[];
  questions: QuestionRow[];
  dueTasks: ReviewDueTask[];
  mistakes: MistakeItem[];
  mistakeStats: MistakeStats | null;
  /** 服务端截断前的全量到期数（`total_due`），今日面板计数取它而非 `dueTasks.length` */
  totalDue: number;
  lastResult: AttemptResponse | null;
  loading: boolean;
  error: string | null;
  notice: string | null;

  openCourse: (courseId: string) => Promise<void>;
  setSourceBook: (bookId: string | null) => void;
  setAnswerBook: (bookId: string | null, start?: number | null, end?: number | null) => void;
  setRange: (start: number | null, end: number | null) => void;
  extract: () => Promise<void>;
  updateDraft: (index: number, patch: Partial<QuestionDraft>) => void;
  removeDraft: (index: number) => void;
  confirmImport: () => Promise<boolean>;
  loadCourse: (courseId: string) => Promise<void>;
  submitAttempt: (input: AttemptInput) => Promise<AttemptResponse | null>;
  setBookmark: (attemptId: number, bookmarked: boolean) => Promise<void>;
  setResolved: (attemptId: number, resolved: boolean) => Promise<void>;
  clearResult: () => void;
  clearNotice: () => void;
}

/** 取一页块数据（404＝该页无解析产物，返回 null 由调用方提示） */
async function pageBlocks(bookId: string, pageNo: number): Promise<PageData | null> {
  try {
    return await getBookPage(bookId, pageNo);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export const usePracticeStore = create<PracticeStore>((set, get) => {
  /** 逐页取块并归一为抽取输入 */
  const collect = async (bookId: string, range: PageRange, missing: string[]) => {
    const blocks = [];
    for (let pageNo = range.start; pageNo <= range.end; pageNo += 1) {
      const data = await pageBlocks(bookId, pageNo);
      if (data === null) {
        missing.push(`第 ${pageNo} 页无解析产物（跳过）`);
        continue;
      }
      blocks.push(...exerciseBlocksOf(pageNo, blocksOf(data)));
    }
    return blocks;
  };

  /** 本课三张面（题 / 到期队列 / 错题本）整体重取——一律课级全量，不传 `kp`（裁决 R2） */
  const reloadCourse = async () => {
    const { courseId } = get();
    if (!courseId) return;
    try {
      const [questionPool, due, mistakePool] = await Promise.all([
        listQuestions({ course: courseId }),
        getReviewDue(courseId, REVIEW_QUEUE_MAX_TASKS),
        listMistakes({ course: courseId }),
      ]);
      set({
        questions: questionPool.questions,
        dueTasks: due.tasks,
        mistakes: mistakePool.items,
        mistakeStats: mistakePool.stats,
        totalDue: due.total_due,
      });
    } catch (err) {
      set({ notice: describeError(err) });
    }
  };

  return {
    courseId: null,
    sourceBooks: [],
    sourceBookId: null,
    answerBookId: null,
    range: null,
    answerRange: null,
    extracting: false,
    drafts: [],
    unrecognized: [],
    extractNotices: [],
    questions: [],
    dueTasks: [],
    mistakes: [],
    mistakeStats: null,
    totalDue: 0,
    lastResult: null,
    loading: false,
    error: null,
    notice: null,

    openCourse: async (courseId) => {
      set({ courseId, loading: true, error: null });
      try {
        const result = await getQuestionBooks(courseId);
        set({
          // 可选题源＝有角色 **且** 有解析产物（parsed_pages=0 的书逐页必 404，选了也抽不出题）
          sourceBooks: result.books.filter((book) => (book.roles ?? []).length > 0 && book.parsed_pages > 0),
          sourceBookId: null,
          answerBookId: null,
        });
      } catch (err) {
        set({ error: describeError(err), sourceBooks: [] });
      } finally {
        set({ loading: false });
      }
    },

    setSourceBook: (bookId) => set({ sourceBookId: bookId, drafts: [], unrecognized: [], extractNotices: [] }),

    setAnswerBook: (bookId, start, end) => set({
      answerBookId: bookId,
      answerRange: bookId && typeof start === 'number' && typeof end === 'number' ? { start, end } : null,
    }),

    setRange: (start, end) => set({
      range: typeof start === 'number' && typeof end === 'number' ? { start, end } : null,
    }),

    extract: async () => {
      const { sourceBookId, range, answerBookId, answerRange } = get();
      const valid = normalizeRange(range);
      if (!sourceBookId || valid === null) {
        set({
          notice: `页范围不合法（需选择题源书，起止页齐备、不倒挂且不超过 ${EXTRACT_MAX_PAGES} 页）`,
          drafts: [],
          unrecognized: [],
          extractNotices: [],
        });
        return;
      }
      set({ extracting: true, notice: null, range: valid });
      const missing: string[] = [];
      try {
        const blocks = await collect(sourceBookId, valid, missing);
        const answerBlocks = answerBookId && normalizeRange(answerRange)
          ? await collect(answerBookId, normalizeRange(answerRange) as PageRange, missing)
          : [];
        const result = parseExerciseBlocks(blocks, {
          siblingAnswers: answerBlocks.length > 0 ? parseAnswerIndex(answerBlocks) : undefined,
        });
        set({
          drafts: result.drafts,
          unrecognized: result.unrecognized,
          extractNotices: [...missing, ...result.notices],
        });
      } catch (err) {
        set({ notice: describeError(err), drafts: [], unrecognized: [], extractNotices: [] });
      } finally {
        set({ extracting: false });
      }
    },

    updateDraft: (index, patch) => set((state) => ({
      drafts: state.drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    })),

    removeDraft: (index) => set((state) => ({ drafts: state.drafts.filter((_, i) => i !== index) })),

    confirmImport: async () => {
      const { courseId, sourceBookId, drafts } = get();
      const book = get().sourceBooks.find((item) => item.book_id === sourceBookId) ?? null;
      if (!courseId || !book) {
        set({ notice: '缺少课程或题源书' });
        return false;
      }
      const accepted = drafts.filter((draft) => draftIssues(draft).length === 0);
      if (accepted.length === 0) {
        set({ notice: '没有可入库的题（每题需题面 + 判分依据或闪卡背文，请补齐或删除）' });
        return false;
      }
      const answerBook = get().answerBookId
        ? get().sourceBooks.find((item) => item.book_id === get().answerBookId) ?? null
        : null;
      const questions = accepted.map((draft) =>
        toQuestionPayload(draft, {
          book_ref: book.book_id,
          source_kind: sourceKindOfRoles(book.roles),
          // 课级归属（裁决 R2）：本面无章/节选择器，入库 kp_id 一律留空
          kp_id: null,
          answer_book_ref: answerBook?.book_id ?? null,
        }),
      );
      try {
        const result = await addQuestions({ course_id: courseId, gen_batch: PRACTICE_GEN_BATCH, questions });
        set({
          drafts: drafts.filter((draft) => !accepted.includes(draft)),
          notice: `入库 ${result.created} 题（跳重 ${result.skipped_duplicates}）`,
        });
        await reloadCourse();
        return true;
      } catch (err) {
        set({ notice: describeError(err) });
        return false;
      }
    },

    loadCourse: async (courseId) => {
      set({ courseId });
      try {
        const [questionPool, due, mistakePool] = await Promise.all([
          listQuestions({ course: courseId }),
          getReviewDue(courseId, REVIEW_QUEUE_MAX_TASKS),
          listMistakes({ course: courseId }),
        ]);
        set({
          questions: questionPool.questions,
          dueTasks: due.tasks,
          mistakes: mistakePool.items,
          mistakeStats: mistakePool.stats,
          totalDue: due.total_due,
        });
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    submitAttempt: async (input) => {
      try {
        const result = await addAttempt(input);
        set({ lastResult: result });
        await reloadCourse();
        return result;
      } catch (err) {
        set({ notice: describeError(err) });
        return null;
      }
    },

    setBookmark: async (attemptId, bookmarked) => {
      try {
        await patchAttempt(attemptId, { bookmarked });
        await reloadCourse();
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    setResolved: async (attemptId, resolved) => {
      try {
        await patchAttempt(attemptId, { resolved });
        await reloadCourse();
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    clearResult: () => set({ lastResult: null }),
    clearNotice: () => set({ notice: null }),
  };
});
