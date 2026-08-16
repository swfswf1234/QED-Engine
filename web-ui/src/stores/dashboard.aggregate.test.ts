import { describe, it, expect } from 'vitest';
import {
  buildSelectionDistribution,
  buildDownloadSummary,
  buildCourseProgress,
} from './dashboard';
import type { SelectionRecord } from './index';

function sel(overrides: Partial<SelectionRecord>): SelectionRecord {
  return {
    selection_id: 's1',
    course_id: 'math',
    title: 't',
    authors: [],
    roles: ['textbook'],
    version: {},
    vols: [],
    set_no: '',
    evaluation: null,
    note: '',
    review_note: '',
    status: 'candidate',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    download_stats: { total: 0, downloaded: 0, approved: 0 },
    downloads: [],
    ...overrides,
  };
}

describe('仪表盘聚合（纯函数）', () => {
  it('表1 状态分布：按 status 计数，缺状态补零', () => {
    const selections = [
      sel({ status: 'candidate' }),
      sel({ status: 'candidate' }),
      sel({ status: 'confirmed' }),
      sel({ status: 'backup' }),
    ];
    const dist = buildSelectionDistribution(selections);
    expect(dist.find((d) => d.status === 'candidate')?.count).toBe(2);
    expect(dist.find((d) => d.status === 'confirmed')?.count).toBe(1);
    expect(dist.find((d) => d.status === 'backup')?.count).toBe(1);
    // 状态全集含零值项（图表稳定）
    expect(dist.map((d) => d.status)).toEqual(
      expect.arrayContaining(['candidate', 'confirmed', 'backup']),
    );
  });

  it('空列表 → 全零分布', () => {
    const dist = buildSelectionDistribution([]);
    expect(dist.every((d) => d.count === 0)).toBe(true);
  });

  it('表2 汇总：聚合 download_stats 的 total/downloaded/approved', () => {
    const selections = [
      sel({ download_stats: { total: 3, downloaded: 2, approved: 1 } }),
      sel({ download_stats: { total: 1, downloaded: 0, approved: 0 } }),
    ];
    const sum = buildDownloadSummary(selections);
    expect(sum).toEqual({ total: 4, downloaded: 2, approved: 1, remaining: 3 });
  });

  it('课程完成进度：按 course_id 分组，进度=非候选占比', () => {
    const selections = [
      sel({ course_id: 'math', status: 'candidate' }),
      sel({ course_id: 'math', status: 'candidate' }),
      sel({ course_id: 'math', status: 'confirmed' }),
      sel({ course_id: 'analysis', status: 'downloaded' }),
      sel({ course_id: 'analysis', status: 'verified' }),
    ];
    const progress = buildCourseProgress(selections);
    expect(progress).toHaveLength(2);
    const math = progress.find((p) => p.course_id === 'math')!;
    expect(math.total).toBe(3);
    expect(math.confirmed).toBe(1);
    expect(math.progress).toBeCloseTo(1 / 3);
    const analysis = progress.find((p) => p.course_id === 'analysis')!;
    expect(analysis.progress).toBe(1);
  });

  it('课程完成进度：空列表 → 空数组', () => {
    expect(buildCourseProgress([])).toEqual([]);
  });
});