/**
 * 领域维护表单的默认值与标签口径（设计正文：docs/design/downloads-ui.md §3.1）
 * 三处入口（添加领域 / 编辑领域知识 / 领域确认弹窗）共用同一组措辞，组件内不再各写一份。
 */

export const DOMAIN_LABELS = {
  name: '领域名',
  description: '领域描述',
  scope: '学科知识',
  level: '探索范围',
  stages: '学习阶段',
} as const;

export const DOMAIN_LEVEL_DEFAULT = '本科-硕士';

export const DOMAIN_STAGES_DEFAULT = '基础,主干,分支,前沿';

export const DOMAIN_SCOPE_DEFAULT =
  '学科知识以中文记录与表述；知识体系、课程划分与前沿参照美国主流高校（本科至硕士）的通行方案，'
  + '教材与文献可保留英文原版，专业术语给出中英对照。默认覆盖本科—硕士阶段，'
  + '超出该范围的内容不进入本次梳理。';

/** 领域描述默认句：随领域名插值；领域名为空时表单不写值，只给占位提示 */
export function domainDescriptionDefault(name: string): string {
  return `${name}：本次新增的待探索领域。用户对该领域的既有认识见「学科知识」，`
    + '层级与阶段见下方参数；请据此梳理学科定位、研究对象与主干课程方向。';
}

export const DOMAIN_DESCRIPTION_PLACEHOLDER = domainDescriptionDefault('{领域名}');
