/**
 * 抽取式题源纯函数（M2 裁决 ⑥：题源＝现成习题集与教材课后题，不引 LLM、不等 M-2）。
 * 规格正本：docs/history/plans/2026-10/2026-09-23-practice-review.md「抽取式题源管线规格」（9 条规则逐条实现）。
 * 消费面：`#/learn/c/{courseId}` 中栏练习区 → 抽取预览 → 人工确认面板 → `POST /learn/questions`。
 * 判例同 `tocParse.ts`：解析不落库，未识别行可见可改可删，不静默丢弃。
 */

export type QuestionKind = 'quiz' | 'flashcard';
export type QuestionType = 'choice' | 'short' | 'open';
export type AnswerSource = 'same_page' | 'solution_section' | 'sibling_book' | 'manual' | 'llm' | 'none';
export type ExerciseSourceKind = 'exercise_book' | 'textbook_chapter' | 'solutions_book' | 'manual' | 'generated';
export type ExerciseKpType = 'memory' | 'procedure' | 'concept' | 'design';
export type UnrecognizedReason = 'excluded' | 'no-anchor' | 'answer-orphan';

export interface ExerciseBlockInput {
  page: number;
  index: number;
  type: string;
  text: string;
}

export interface ExerciseOption {
  label: 'A' | 'B' | 'C' | 'D';
  body: string;
}

export interface QuestionDraft {
  number: string;
  stem: string;
  kind: QuestionKind;
  question_type: QuestionType;
  options: ExerciseOption[] | null;
  expected_answer: string | null;
  keywords: string[] | null;
  answer_back: string | null;
  explanation: string;
  answer_source: AnswerSource;
  page: number;
  block_indexes: number[];
  answer_page: number | null;
  kp_type: ExerciseKpType;
  confidence: number;
  attachments: Array<Record<string, unknown>>;
}

export interface UnrecognizedLine {
  raw: string;
  reason: UnrecognizedReason;
  page: number;
  index: number;
}

export interface ExerciseParseResult {
  drafts: QuestionDraft[];
  unrecognized: UnrecognizedLine[];
  notices: string[];
}

export interface ExerciseParseOptions {
  kpType?: ExerciseKpType;
  /** 关联题解书答案（题号 → 答案原文，R-11 的 `qt_knowledge.textbook_ref ↔ exercise_ref` 配对） */
  siblingAnswers?: Record<string, string>;
}

export interface QuestionPayloadContext {
  book_ref: string;
  source_kind: ExerciseSourceKind;
  kp_id?: string | null;
  kp_type?: ExerciseKpType;
  difficulty?: 'easy' | 'medium' | 'hard';
  /** R-11 题解配对书（`answer_source=sibling_book` 时写进 `source_ref.answer_book_ref`） */
  answer_book_ref?: string | null;
}

export type QuestionPayloadItem = {
  stem: string;
  kind: QuestionKind;
  question_type: QuestionType;
  options: ExerciseOption[] | null;
  expected_answer: string | null;
  keywords: string[] | null;
  answer_back: string;
  explanation: string;
  difficulty: string;
  kp_type: ExerciseKpType;
  kp_id: string | null;
  source_kind: ExerciseSourceKind;
  book_ref: string;
  source_ref: Record<string, unknown>;
  answer_source: AnswerSource;
  meta: Record<string, unknown>;
}

const QUESTION_ANCHOR_RE = /^\s*(\d+(?:\.\d+)*)\s*[、.．)） 　]/;
const EXERCISE_HEADING_RE = /(习题|练习|课后题|补充题|problems?|exercises?)/i;
const ANSWER_HEADING_RE = /(答案与提示|参考答案|习题答案|解答与提示|solutions?)/i;
const ANSWER_PREFIX_RE = /^(答案|解答|答|解|提示)[：:]/;
const NON_QUESTION_BLOCKS = new Set(['header', 'footer', 'page_number']);
const ATTACHMENT_BLOCKS = new Set(['image', 'table']);
const OPTION_LABEL_RE = /(?:^|[\s（(、，,。])([A-D])[.．、)）]/g;
const KEYWORD_SPLIT_RE = /[,;，；。、\n]/;
const SECTION_HEADING_MAX = 40;

const CONFIDENCE_BY_SOURCE: Record<AnswerSource, number> = {
  manual: 1,
  same_page: 0.95,
  solution_section: 0.85,
  sibling_book: 0.6,
  llm: 0.5,
  none: 0.3,
};

interface RegionAnswer {
  text: string;
  page: number;
  index: number;
  matched: boolean;
}

/**
 * 解析页块 → 抽取输入块（与 `components/parsing/blocks.ts#blockText` 同取文本口径：
 * 公式取 LaTeX、表格取 HTML、列表换行拼接）。独立成函数是为了让 store 侧不引渲染依赖。
 */
export interface ParseableBlock {
  type?: string;
  text?: string;
  latex?: string;
  html?: string;
  items?: readonly string[];
}

export function exerciseBlocksOf(
  page: number,
  blocks: readonly ParseableBlock[],
): ExerciseBlockInput[] {
  return (blocks ?? []).map((block, index) => ({
    page,
    index,
    type: block.type ?? 'paragraph',
    text:
      block.type === 'formula'
        ? block.latex ?? ''
        : block.type === 'table'
          ? block.html ?? ''
          : block.type === 'list'
            ? (block.items ?? []).join('\n')
            : block.text ?? '',
  }));
}

/**
 * 题解书页块 → 题号答案索引（R-11 sibling_book 配对用）。
 * 只认题号锚行，剥离「答案/解答/答/解/提示」引导词；同题号多行空格拼接。
 */
export function parseAnswerIndex(
  blocks: readonly ExerciseBlockInput[],
): Record<string, string> {
  const index: Record<string, string> = {};
  for (const block of blocks ?? []) {
    const type = block.type ?? 'paragraph';
    if (NON_QUESTION_BLOCKS.has(type) || ATTACHMENT_BLOCKS.has(type)) continue;
    for (const rawLine of linesOf(block.text)) {
      const line = rawLine.trim();
      if (line === '') continue;
      const anchor = anchorOf(line);
      if (anchor === null) continue;
      const text = stripAnswerPrefix(anchor.rest);
      if (text === '') continue;
      index[anchor.number] = index[anchor.number] ? `${index[anchor.number]} ${text}` : text;
    }
  }
  return index;
}

/** 题号锚拆分（题号 + 去掉锚后的正文） */
function anchorOf(line: string): { number: string; rest: string } | null {
  const hit = QUESTION_ANCHOR_RE.exec(line);
  if (!hit) return null;
  return { number: hit[1], rest: line.slice(hit[0].length).trim() };
}

function isAnswerLead(text: string): boolean {
  return ANSWER_PREFIX_RE.test(text.trim());
}

/** 答案原文归一：剥「答：/解：」引导词与尾随句读 */
function stripAnswerPrefix(text: string): string {
  const bare = text.trim().replace(ANSWER_PREFIX_RE, '').trim();
  return bare.replace(/[。；;]\s*$/, '').trim();
}

/** 公式块保真入题面（老代自带定界符不重复包裹，判例 BUGFIX-011） */
function wrapFormula(text: string): string {
  const t = (text ?? '').trim();
  if (t === '') return '';
  if (t.startsWith('$$') && t.endsWith('$$') && t.length > 4 && !t.slice(2, -2).includes('$$')) return t;
  if (t.startsWith('$') && t.endsWith('$') && t.length > 2 && !t.slice(1, -1).includes('$')) {
    return `$$${t.slice(1, -1).trim()}$$`;
  }
  return `$$${t}$$`;
}

/** 行内 A/B/C/D 四项齐 → 选项段与剩余题面 */
function splitOptions(text: string): {
  options: ExerciseOption[] | null;
  stem: string;
  partial: boolean;
} {
  const marks: Array<{ label: string; start: number; end: number }> = [];
  OPTION_LABEL_RE.lastIndex = 0;
  let hit = OPTION_LABEL_RE.exec(text);
  while (hit !== null) {
    marks.push({ label: hit[1], start: hit.index, end: OPTION_LABEL_RE.lastIndex });
    hit = OPTION_LABEL_RE.exec(text);
  }
  if (marks.length === 0) return { options: null, stem: text, partial: false };
  const labels = marks.map((mark) => mark.label).join('');
  if (labels !== 'ABCD') return { options: null, stem: text, partial: true };
  const options = marks.map((mark, i) => {
    const next = marks[i + 1];
    const raw = text.slice(mark.end, next ? next.start : text.length);
    return { label: mark.label as ExerciseOption['label'], body: raw.replace(/[）)\s]+$/g, '').trim() };
  });
  if (options.some((option) => option.body === '')) return { options: null, stem: text, partial: true };
  const stem = text.slice(0, marks[0].start).replace(/[（(\s]+$/g, '').trim();
  return { options, stem, partial: false };
}

/** 判分型回落（规格第 7 条）：短答案→short、可枚举→open、选项无字母→flashcard 自评 */
function classifyAnswer(
  answer: string,
  hasOptions: boolean,
): Pick<QuestionDraft, 'kind' | 'question_type' | 'expected_answer' | 'keywords' | 'answer_back'> {
  if (hasOptions) {
    const letter = /(?:^|[^\w])([A-D])(?:$|[^\w])/.exec(answer)?.[1] ?? null;
    if (letter !== null) {
      return { kind: 'quiz', question_type: 'choice', expected_answer: letter, keywords: null, answer_back: null };
    }
    return { kind: 'flashcard', question_type: 'short', expected_answer: null, keywords: null, answer_back: answer };
  }
  if (answer.length <= 30 && !/[。！？；;，]/.test(answer)) {
    return { kind: 'quiz', question_type: 'short', expected_answer: answer, keywords: null, answer_back: null };
  }
  const keywords = answer
    .split(KEYWORD_SPLIT_RE)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 6);
  if (keywords.length >= 2) {
    return { kind: 'quiz', question_type: 'open', expected_answer: answer, keywords, answer_back: null };
  }
  return { kind: 'flashcard', question_type: 'short', expected_answer: null, keywords: null, answer_back: answer };
}

function confidenceOf(source: AnswerSource, attachments: number): number {
  const value = CONFIDENCE_BY_SOURCE[source] - (attachments > 0 ? 0.15 : 0);
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

/** 配对答案并定型（题面选项已在上文拆出，此处只按选项位存在与否回落） */
function applyAnswer(draft: QuestionDraft, answer: string, answerPage: number, source: AnswerSource): void {
  if (answer === '') return;
  const decided = classifyAnswer(answer, draft.options !== null);
  draft.kind = decided.kind;
  draft.question_type = decided.question_type;
  draft.expected_answer = decided.expected_answer;
  draft.keywords = decided.keywords;
  draft.answer_back = decided.answer_back;
  draft.answer_page = answerPage;
  draft.answer_source = source;
}

function linesOf(text: string): string[] {
  return (text ?? '').split('\n');
}

export function parseExerciseBlocks(
  blocks: readonly ExerciseBlockInput[],
  options: ExerciseParseOptions = {},
): ExerciseParseResult {
  const kpType = options.kpType ?? 'memory';
  const drafts: QuestionDraft[] = [];
  const unrecognized: UnrecognizedLine[] = [];
  const notices: string[] = [];
  const byNumber = new Map<string, QuestionDraft>();
  const region = new Map<string, RegionAnswer>();
  let inAnswers = false;
  let current: QuestionDraft | null = null;

  const ordered = [...(blocks ?? [])].sort((a, b) => a.page - b.page || a.index - b.index);

  const mergeRegion = (number: string, text: string, page: number, index: number): void => {
    const exist = region.get(number);
    if (exist) {
      exist.text = `${exist.text} ${text}`.trim();
      return;
    }
    region.set(number, { text, page, index, matched: false });
  };

  for (const block of ordered) {
    const type = block.type ?? 'paragraph';
    if (NON_QUESTION_BLOCKS.has(type)) {
      unrecognized.push({ raw: (block.text ?? '').trim(), reason: 'excluded', page: block.page, index: block.index });
      continue;
    }
    if (type === 'formula') {
      const wrapped = wrapFormula(block.text);
      if (wrapped === '') continue;
      if (current) {
        current.stem = `${current.stem}\n${wrapped}`.trim();
        if (!current.block_indexes.includes(block.index)) current.block_indexes.push(block.index);
      } else {
        unrecognized.push({ raw: wrapped, reason: 'no-anchor', page: block.page, index: block.index });
      }
      continue;
    }
    if (ATTACHMENT_BLOCKS.has(type)) {
      if (current) {
        current.attachments.push({ kind: type, page: block.page, index: block.index });
      } else {
        unrecognized.push({ raw: (block.text ?? '').trim(), reason: 'no-anchor', page: block.page, index: block.index });
      }
      continue;
    }

    for (const rawLine of linesOf(block.text)) {
      const line = rawLine.trim();
      if (line === '') continue;

      const anchor = anchorOf(line);

      if (anchor === null && (type === 'heading' || line.length <= SECTION_HEADING_MAX)) {
        if (ANSWER_HEADING_RE.test(line)) {
          inAnswers = true;
          current = null;
          continue;
        }
        if (EXERCISE_HEADING_RE.test(line)) {
          inAnswers = false;
          current = null;
          continue;
        }
      }

      if (inAnswers) {
        if (anchor === null) {
          unrecognized.push({ raw: line, reason: 'answer-orphan', page: block.page, index: block.index });
          continue;
        }
        mergeRegion(anchor.number, stripAnswerPrefix(anchor.rest), block.page, block.index);
        continue;
      }

      if (anchor !== null && (isAnswerLead(anchor.rest) || isAnswerLead(line))) {
        const target = byNumber.get(anchor.number) ?? null;
        const text = stripAnswerPrefix(anchor.rest);
        if (target !== null && target.answer_source === 'none') {
          applyAnswer(target, text, block.page, 'same_page');
          current = target;
        } else {
          mergeRegion(anchor.number, text, block.page, block.index);
        }
        continue;
      }

      if (anchor === null && isAnswerLead(line) && current !== null) {
        applyAnswer(current, stripAnswerPrefix(line), block.page, 'same_page');
        continue;
      }

      if (anchor !== null) {
        const parts = splitOptions(anchor.rest);
        const draft: QuestionDraft = {
          number: anchor.number,
          stem: parts.stem,
          kind: 'flashcard',
          question_type: parts.options ? 'choice' : 'short',
          options: parts.options,
          expected_answer: null,
          keywords: null,
          answer_back: null,
          explanation: '',
          answer_source: 'none',
          page: block.page,
          block_indexes: [block.index],
          answer_page: null,
          kp_type: kpType,
          confidence: CONFIDENCE_BY_SOURCE.none,
          attachments: [],
        };
        if (parts.partial) notices.push(`题 ${anchor.number} 选项不齐（未认作 choice）`);
        drafts.push(draft);
        current = draft;
        if (!byNumber.has(anchor.number)) byNumber.set(anchor.number, draft);
        const pending = region.get(anchor.number);
        if (pending) {
          applyAnswer(draft, pending.text, pending.page, 'solution_section');
          pending.matched = true;
        }
        continue;
      }

      if (current !== null) {
        current.stem = `${current.stem}\n${line}`.trim();
        if (!current.block_indexes.includes(block.index)) current.block_indexes.push(block.index);
        continue;
      }
      unrecognized.push({ raw: line, reason: 'no-anchor', page: block.page, index: block.index });
    }
  }

  for (const draft of drafts) {
    if (draft.answer_source !== 'none') continue;
    const pending = region.get(draft.number);
    if (pending) {
      applyAnswer(draft, pending.text, pending.page, 'solution_section');
      pending.matched = true;
      continue;
    }
    const sibling = options.siblingAnswers?.[draft.number];
    if (sibling) {
      applyAnswer(draft, stripAnswerPrefix(sibling), draft.page, 'sibling_book');
      continue;
    }
    notices.push(`题 ${draft.number} 未配对答案（按裁决 ⑨ 转闪卡自评）`);
  }

  for (const [number, item] of region) {
    if (!item.matched) {
      unrecognized.push({ raw: `${number}、${item.text}`, reason: 'answer-orphan', page: item.page, index: item.index });
    }
  }

  for (const draft of drafts) {
    draft.confidence = confidenceOf(draft.answer_source, draft.attachments.length);
  }
  return { drafts, unrecognized, notices };
}

export function toQuestionPayload(
  draft: QuestionDraft,
  context: QuestionPayloadContext,
): QuestionPayloadItem {
  const sourceRef: Record<string, unknown> = {
    page: draft.page,
    block_indexes: [...draft.block_indexes],
  };
  if (draft.answer_page !== null && draft.answer_page !== draft.page) sourceRef.answer_page = draft.answer_page;
  if (draft.answer_source === 'sibling_book' && context.answer_book_ref) {
    sourceRef.answer_book_ref = context.answer_book_ref;
  }
  return {
    stem: draft.stem,
    kind: draft.kind,
    question_type: draft.question_type,
    options: draft.options,
    expected_answer: draft.expected_answer,
    keywords: draft.keywords,
    answer_back: draft.answer_back ?? '',
    explanation: draft.explanation,
    difficulty: context.difficulty ?? 'medium',
    kp_type: context.kp_type ?? draft.kp_type,
    kp_id: context.kp_id ?? null,
    source_kind: context.source_kind,
    book_ref: context.book_ref,
    source_ref: sourceRef,
    answer_source: draft.answer_source,
    meta: { attachments: draft.attachments, number: draft.number, confidence: draft.confidence },
  };
}

/** 面板侧入库前校验（镜像后端 `_question_invariant_error`，避免整批 422） */
export function draftIssues(draft: QuestionDraft): string[] {
  const issues: string[] = [];
  if (!draft.stem.trim()) issues.push('stem');
  if (draft.kind === 'quiz' && !draft.expected_answer?.trim()) issues.push('expected_answer');
  if (draft.kind === 'flashcard' && !draft.answer_back?.trim()) issues.push('answer_back');
  if (draft.answer_source === 'none' && draft.kind !== 'flashcard') issues.push('answer_source');
  if (draft.question_type === 'open' && (draft.keywords ?? []).length === 0) issues.push('keywords');
  if (draft.options !== null && draft.options.length > 0) {
    const labels = draft.options.map((option) => option.label).join('');
    if (labels !== 'ABCD' || draft.options.some((option) => !option.body.trim())) issues.push('options');
  }
  if (draft.question_type === 'choice' && draft.options === null) issues.push('options');
  return issues;
}
