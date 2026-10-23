/** 模块职责：左树空态话术判定（DEFECT-015 S3）——把「共享表为空」与「8902 离线」两种降级分开表述。 */

import type { ParsingTreeSources } from '../../api/axiom';

export interface TreeEmptyHintInput {
  treeError: string | null;
  /** 8900 `/parsing/tree` 信封的 sources；请求失败或未取到时为 null */
  sources: ParsingTreeSources | null;
  dataError: string | null;
}

export function treeEmptyHint({ treeError, sources, dataError }: TreeEmptyHintInput): string {
  if (treeError) return '加载失败，请点「刷新」重试';
  if (!sources) return dataError ? '8902 离线，暂无书目数据（领域和课程已加载）' : '暂无课程数据';
  const parts: string[] = [];
  if (sources.shared_tables === 'empty') parts.push('共享表暂无领域/课程登记');
  if (sources.axiom_flow === 'offline') parts.push('8902 离线，书目未加载');
  if (parts.length === 0) return '暂无书目数据';
  return `${parts.join('；')}（可点「刷新」重试）`;
}
