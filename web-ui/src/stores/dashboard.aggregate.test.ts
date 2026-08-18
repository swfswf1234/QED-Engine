import { describe, it, expect } from 'vitest';
import {
  buildBookSummary,
  buildCourseCompletion,
  buildKnowledgeDownloadPie,
} from './dashboard';
import type { BookRecord, CatalogTarget, KnowledgeDetail, KnowledgeRecord } from './index';

function kn(partial: Partial<KnowledgeRecord> & { knowledge_id: string; course_id: string }): KnowledgeRecord {
  return {
    domain_id: 'math',
    kind: 'tutorial',
    set_no: '',
    name: '',
    textbook_ref: null,
    exercise_ref: null,
    textbook_intro: '',
    exercise_intro: '',
    materials_intro: '',
    status: 'draft',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    completed_at: null,
    ...partial,
  };
}

function book(partial: Partial<BookRecord> & { book_id: string; knowledge_id: string }): BookRecord {
  return {
    kind: 'textbook',
    roles: ['textbook'],
    title: 't',
    part: '',
    display_title: 't',
    file_name: '',
    authors: [],
    language: '',
    version: {},
    source: null,
    original_url: '',
    sha256: null,
    relative_path: '',
    absolute_path: '',
    page_count: null,
    status: 'candidate',
    reject_reason: '',
    supersede_reason: '',
    review_note: '',
    created_at: '',
    decided_at: null,
    downloaded_at: null,
    verified_at: null,
    ...partial,
  };
}

function detail(k: KnowledgeRecord, books: BookRecord[]): KnowledgeDetail {
  return { ...k, books };
}

describe('仪表盘聚合（纯函数，五层模型）', () => {
  it('书行汇总：聚合详情缓存 books 的 total/downloaded/verified/remaining/tutorials', () => {
    const k1 = kn({ knowledge_id: 'k1', course_id: 'math' });
    const k2 = kn({ knowledge_id: 'k2', course_id: 'math', kind: 'other_material' });
    const details: Record<string, KnowledgeDetail> = {
      k1: detail(k1, [
        book({ book_id: 'b1', knowledge_id: 'k1', status: 'downloaded' }),
        book({ book_id: 'b2', knowledge_id: 'k1', status: 'verified' }),
        book({ book_id: 'b3', knowledge_id: 'k1', status: 'failed' }),
      ]),
      k2: detail(k2, []),
    };
    const sum = buildBookSummary(details);
    // downloaded 含 verified；remaining = total - verified；tutorials 只计 kind=tutorial
    expect(sum).toEqual({ total: 3, downloaded: 2, verified: 1, remaining: 2, tutorials: 1 });
  });

  it('书行汇总：无详情缓存 → 全零', () => {
    expect(buildBookSummary({})).toEqual({ total: 0, downloaded: 0, verified: 0, remaining: 0, tutorials: 0 });
  });

  it('课程下载完成度：分母=catalog 课程数，分子=≥2 套教程全部验收的课程数', () => {
    const catalogTargets = [
      { course_id: 'math', name: '数学分析' },
      { course_id: 'math', name: '数学分析英文' },
      { course_id: 'analysis', name: '实分析' },
      { course_id: 'algebra', name: '代数' },
    ] as unknown as CatalogTarget[];
    // math 下两套教程全部 verified → 完成；analysis 仅一套 verified → 未完成；algebra 无知识行
    const t1 = kn({ knowledge_id: 't1', course_id: 'math', kind: 'tutorial' });
    const t2 = kn({ knowledge_id: 't2', course_id: 'math', kind: 'tutorial' });
    const a1 = kn({ knowledge_id: 'a1', course_id: 'analysis', kind: 'tutorial' });
    const details: Record<string, KnowledgeDetail> = {
      t1: detail(t1, [book({ book_id: 'b1', knowledge_id: 't1', status: 'verified' })]),
      t2: detail(t2, [book({ book_id: 'b2', knowledge_id: 't2', status: 'verified' })]),
      a1: detail(a1, [book({ book_id: 'b3', knowledge_id: 'a1', status: 'verified' })]),
    };
    expect(buildCourseCompletion(catalogTargets, details)).toEqual({ total: 3, completed: 1 });
  });

  it('课程下载完成度：教程书行未全验收 / 不足 2 套 → 不计完成', () => {
    const catalogTargets = [
      { course_id: 'math', name: '数学分析' },
      { course_id: 'analysis', name: '实分析' },
    ] as unknown as CatalogTarget[];
    const t1 = kn({ knowledge_id: 't1', course_id: 'math', kind: 'tutorial' });
    const t2 = kn({ knowledge_id: 't2', course_id: 'math', kind: 'tutorial' });
    const a1 = kn({ knowledge_id: 'a1', course_id: 'analysis', kind: 'tutorial' });
    const details: Record<string, KnowledgeDetail> = {
      // math 两套但 t1 未全验收（b1 verified + b2 downloaded）→ math 不算完成
      t1: detail(t1, [
        book({ book_id: 'b1', knowledge_id: 't1', status: 'verified' }),
        book({ book_id: 'b2', knowledge_id: 't1', status: 'downloaded' }),
      ]),
      t2: detail(t2, [book({ book_id: 'b3', knowledge_id: 't2', status: 'verified' })]),
      // analysis 仅一套教程 → 不算完成（需 ≥2 套）
      a1: detail(a1, [book({ book_id: 'b4', knowledge_id: 'a1', status: 'verified' })]),
    };
    expect(buildCourseCompletion(catalogTargets, details)).toEqual({ total: 2, completed: 0 });
  });

  it('课程下载完成度：无 catalog → 分母 0；无详情 → 全零', () => {
    expect(buildCourseCompletion([], {})).toEqual({ total: 0, completed: 0 });
  });

  it('下载进度饼图（按教程）：每教程一块，值=已下载书行数；name 回退 knowledge_id', () => {
    const k1 = kn({ knowledge_id: 'k1', course_id: 'math', name: '数学分析 套一' });
    const k2 = kn({ knowledge_id: 'k2', course_id: 'math' });
    const details: Record<string, KnowledgeDetail> = {
      k1: detail(k1, [
        book({ book_id: 'b1', knowledge_id: 'k1', status: 'downloaded' }),
        book({ book_id: 'b2', knowledge_id: 'k1', status: 'verified' }),
        book({ book_id: 'b3', knowledge_id: 'k1', status: 'candidate' }),
      ]),
      k2: detail(k2, [book({ book_id: 'b4', knowledge_id: 'k2', status: 'downloaded' })]),
    };
    expect(buildKnowledgeDownloadPie(details)).toEqual([
      { name: '数学分析 套一', value: 2 },
      { name: 'k2', value: 1 },
    ]);
  });

  it('下载进度饼图（按教程）：无已下载 → 空数组', () => {
    const k1 = kn({ knowledge_id: 'k1', course_id: 'math' });
    const details: Record<string, KnowledgeDetail> = {
      k1: detail(k1, [book({ book_id: 'b1', knowledge_id: 'k1', status: 'candidate' })]),
    };
    expect(buildKnowledgeDownloadPie(details)).toEqual([]);
  });
});
