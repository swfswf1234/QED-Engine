import { describe, it, expect } from 'vitest';
import {
  buildDomainProgress,
  buildCourseProgress,
  buildBookDownloadProgress,
  buildDashboardStats,
} from './dashboard';
import type { BookRecord, CourseRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from './index';

// --- 辅助工厂函数 ---

function domain(partial: Partial<DomainSystem> & { domain_id: string; name: string }): DomainSystem {
  return {
    courses: [],
    ...partial,
  } as DomainSystem;
}

function course(partial: Partial<CourseRecord> & { course_id: string; name: string }): CourseRecord {
  return {
    aliases: [],
    stage: '基础',
    prerequisites: [],
    ...partial,
  } as CourseRecord;
}

function kn(partial: Partial<KnowledgeRecord> & { knowledge_id: string; course_id: string }): KnowledgeRecord {
  return {
    domain_id: 'math',
    kind: 'tutorial',
    set_no: '',
    name: '',
    textbook_ref: null,
    exercise_ref: null,
    intro: '',
    status: 'draft',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    completed_at: null,
    ...partial,
  };
}

function book(partial: Partial<BookRecord> & { book_id: string }): BookRecord {
  return {
    title: 't',
    original_title: null,
    part: '',
    authors: [],
    publisher: '',
    edition: '',
    year: null,
    language: 'zh',
    roles: ['textbook'],
    status: 'candidate',
    retire_reason: '',
    holding: 'missing',
    file_path: null,
    priority: null,
    notes: null,
    domain_id: 'math',
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function detail(k: KnowledgeRecord, books: BookRecord[]): KnowledgeDetail {
  return { ...k, books };
}

// --- 测试 ---

describe('仪表盘聚合（2026-09-07 重构：三行图表 + 统计数字）', () => {
  describe('buildDomainProgress', () => {
    it('按 exploration_stage 聚合为新建/探索中/完成', () => {
      const cs: DomainSystem[] = [
        domain({ domain_id: 'math', name: '数学', exploration_stage: '未开始', courses: [] }),
        domain({ domain_id: 'cs', name: '计算机', exploration_stage: '探索中', courses: [] }),
        domain({ domain_id: 'phys', name: '物理', exploration_stage: '已完成', courses: [] }),
      ];
      const result = buildDomainProgress(cs);
      expect(result).toEqual([
        { name: '新建', value: 1 },
        { name: '探索中', value: 1 },
        { name: '完成', value: 1 },
      ]);
    });

    it('已生成/待确认 归入探索中', () => {
      const cs: DomainSystem[] = [
        domain({ domain_id: 'a', name: 'A', exploration_stage: '已生成', courses: [] }),
        domain({ domain_id: 'b', name: 'B', exploration_stage: '待确认', courses: [] }),
      ];
      const result = buildDomainProgress(cs);
      expect(result).toEqual([{ name: '探索中', value: 2 }]);
    });

    it('空 courseSystem → 空数组', () => {
      expect(buildDomainProgress([])).toEqual([]);
    });
  });

  describe('buildCourseProgress', () => {
    it('按领域分组，课程按探索状态+书籍持有分类', () => {
      const cs: DomainSystem[] = [
        domain({
          domain_id: 'math',
          name: '数学',
          exploration_stage: '已完成',
          courses: [
            course({ course_id: 'c1', name: '课程1', exploration_stage: '未开始' }),
            course({ course_id: 'c2', name: '课程2', exploration_stage: '已完成' }),
            course({ course_id: 'c3', name: '课程3', exploration_stage: '已完成' }),
          ],
        }),
      ];
      const details: Record<string, KnowledgeDetail> = {
        k1: detail(kn({ knowledge_id: 'k1', course_id: 'c2' }), [
          book({ book_id: 'b1', status: 'decided', holding: 'owned' }),
        ]),
        k2: detail(kn({ knowledge_id: 'k2', course_id: 'c3' }), [
          book({ book_id: 'b2', status: 'decided', holding: 'missing' }),
          book({ book_id: 'b3', status: 'decided', holding: 'owned' }),
        ]),
      };
      const result = buildCourseProgress(cs, details);
      expect(result['数学']).toEqual([
        { name: '探索中', value: 1 },   // c1 未完成探索
        { name: '下载中', value: 1 },   // c3 已完成 + 部分 owned
        { name: '完成', value: 1 },     // c2 已完成 + 全部 owned
      ]);
    });

    it('无书籍的已完成课程 → 探索完成', () => {
      const cs: DomainSystem[] = [
        domain({
          domain_id: 'a',
          name: 'A',
          courses: [course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' })],
        }),
      ];
      const result = buildCourseProgress(cs, {});
      expect(result['A']).toEqual([{ name: '探索完成', value: 1 }]);
    });

    it('空 courseSystem → 空对象', () => {
      expect(buildCourseProgress([], {})).toEqual({});
    });
  });

  describe('buildBookDownloadProgress', () => {
    it('按领域分组，书籍按 holding+status 分类', () => {
      const cs: DomainSystem[] = [
        domain({
          domain_id: 'math',
          name: '数学',
          courses: [
            course({ course_id: 'c1', name: 'C1' }),
            course({ course_id: 'c2', name: 'C2' }),
          ],
        }),
      ];
      const details: Record<string, KnowledgeDetail> = {
        k1: detail(kn({ knowledge_id: 'k1', course_id: 'c1' }), [
          book({ book_id: 'b1', status: 'candidate', holding: 'missing' }),
          book({ book_id: 'b2', status: 'decided', holding: 'missing' }),
          book({ book_id: 'b3', status: 'decided', holding: 'owned' }),
          book({ book_id: 'b4', status: 'parallel', holding: 'owned' }),
        ]),
      };
      const result = buildBookDownloadProgress(cs, details);
      expect(result['数学']).toEqual([
        { name: '未开始', value: 1 },   // b1 candidate + missing
        { name: '下载中', value: 1 },   // b2 decided + missing
        { name: '待确认', value: 1 },   // b3 decided + owned
        { name: '完成', value: 1 },     // b4 parallel + owned
      ]);
    });

    it('空数据 → 各领域空数组', () => {
      const cs: DomainSystem[] = [
        domain({ domain_id: 'a', name: 'A', courses: [] }),
      ];
      const result = buildBookDownloadProgress(cs, {});
      expect(result['A']).toEqual([]);
    });
  });

  describe('buildDashboardStats', () => {
    it('统计已探明领域数/课程数/书籍卷数/验收书目数', () => {
      const cs: DomainSystem[] = [
        domain({
          domain_id: 'math',
          name: '数学',
          exploration_stage: '已完成',
          courses: [course({ course_id: 'c1', name: 'C1' }), course({ course_id: 'c2', name: 'C2' })],
        }),
        domain({
          domain_id: 'cs',
          name: '计算机',
          exploration_stage: '未开始',
          courses: [course({ course_id: 'c3', name: 'C3' })],
        }),
      ];
      const details: Record<string, KnowledgeDetail> = {
        k1: detail(kn({ knowledge_id: 'k1', course_id: 'c1' }), [
          book({ book_id: 'b1', holding: 'owned' }),
          book({ book_id: 'b2', holding: 'missing' }),
        ]),
        k2: detail(kn({ knowledge_id: 'k2', course_id: 'c2' }), [
          book({ book_id: 'b3', holding: 'owned' }),
        ]),
      };
      const stats = buildDashboardStats(cs, details);
      expect(stats).toEqual({
        exploredDomains: 1,    // math 已完成，cs 未开始
        totalCourses: 3,       // math 2 + cs 1
        totalBooks: 3,         // b1 + b2 + b3
        verifiedBooks: 2,      // b1 + b3 holding=owned
      });
    });

    it('空数据 → 全零', () => {
      expect(buildDashboardStats([], {})).toEqual({
        exploredDomains: 0,
        totalCourses: 0,
        totalBooks: 0,
        verifiedBooks: 0,
      });
    });
  });
});
