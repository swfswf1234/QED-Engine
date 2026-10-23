import { describe, expect, it } from 'vitest';

import { treeEmptyHint } from './treeEmptyHint';

/** DEFECT-015 S3：左树两种降级必须给不同话术（旧版两者都只落「暂无课程数据」）。 */
describe('treeEmptyHint', () => {
  it('共享表为空且 8902 在线 → 说明是登记缺口，不是服务离线', () => {
    const hint = treeEmptyHint({ treeError: null, sources: { shared_tables: 'empty', axiom_flow: 'ok' }, dataError: null });
    expect(hint).toContain('共享表');
    expect(hint).not.toContain('离线');
  });

  it('共享表有登记且 8902 离线 → 说明书目为空、领域课程仍在', () => {
    const hint = treeEmptyHint({ treeError: null, sources: { shared_tables: 'ok', axiom_flow: 'offline' }, dataError: null });
    expect(hint).toContain('8902 离线');
    expect(hint).not.toContain('共享表');
  });

  it('两者同时 → 两句话都出', () => {
    const both = treeEmptyHint({ treeError: null, sources: { shared_tables: 'empty', axiom_flow: 'offline' }, dataError: null });
    expect(both).toContain('共享表');
    expect(both).toContain('8902 离线');
  });

  it('请求失败优先给重试话术；来源缺失时退回中性话术', () => {
    expect(treeEmptyHint({ treeError: 'boom', sources: null, dataError: null })).toContain('加载失败');
    expect(treeEmptyHint({ treeError: null, sources: null, dataError: null })).toBe('暂无课程数据');
  });
});
