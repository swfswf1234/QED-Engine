/**
 * 使用手册四册的形态守护（REQ-031 二批改判 2026-10-16 用户裁决）
 * 守护三件事：四册节次同构、册名与界面字面一致、正文不写服务与运维口径。
 */
import { describe, expect, it } from 'vitest';
import { HELP_BLOCK_TITLES, HELP_PAGES, type HelpPageKey } from './sections';

const PAGE_KEYS: HelpPageKey[] = ['center', 'knowledge', 'course', 'practice'];

describe('使用手册四册形态守护', () => {
  it('四册节次恒为功能概览／使用说明／状态与限制（总册无愿景节，子册不多节）', () => {
    for (const key of PAGE_KEYS) {
      expect(HELP_PAGES[key].blocks.map((block) => block.kind)).toEqual(['overview', 'usage', 'notes']);
    }
  });

  it('节名唯一取自 kind 映射，且映射里没有愿景／后续规划', () => {
    expect(Object.values(HELP_BLOCK_TITLES)).toEqual(['功能概览', '使用说明', '状态与限制']);
  });

  it('手册正文不写服务与运维口径（只讲用户看得见、点得动的东西）', () => {
    const banned = ['8900', '服务', '离线', '降级', '不可达', '端口'];
    const text = PAGE_KEYS
      .map((key) => `${HELP_PAGES[key].title}\n${JSON.stringify(HELP_PAGES[key].blocks)}`)
      .join('\n');
    for (const token of banned) {
      expect(text, `手册正文出现运维口径「${token}」`).not.toContain(token);
    }
  });

  it('每册使用说明都是可执行步骤，概览与限制都是段落', () => {
    for (const key of PAGE_KEYS) {
      const [overview, usage, notes] = HELP_PAGES[key].blocks;
      expect(overview.paragraphs?.length).toBeGreaterThan(0);
      expect(usage.steps?.length).toBeGreaterThan(0);
      expect(usage.paragraphs).toBeUndefined();
      expect(notes.paragraphs?.length).toBeGreaterThan(0);
    }
  });

  it('四册册名与界面字面一致（面名统一为「知识探索」，2026-10-16 裁决）', () => {
    expect(HELP_PAGES.center.title).toBe('学习中心');
    expect(HELP_PAGES.knowledge.title).toBe('知识探索');
    expect(HELP_PAGES.course.title).toBe('课程学习');
    expect(HELP_PAGES.practice.title).toBe('课后练习');
    const crumbs = HELP_PAGES.knowledge.blocks[1].steps ?? [];
    expect(crumbs.some((step) => step.includes('面包屑「知识探索」'))).toBe(true);
  });

  it('课程学习册说的是书架清单 v2 口径，不残留旧新建流程与过程性术语（REQ-117 W8 / S4）', () => {
    const text = JSON.stringify(HELP_PAGES.course.blocks);
    for (const token of ['新建学习课程', '注册', '链路', '编译', '解析', '同步', '单元', '删除']) {
      expect(text, `课程学习册出现「${token}」`).not.toContain(token);
    }
    const steps = HELP_PAGES.course.blocks[1].steps ?? [];
    expect(steps.some((step) => step.includes('「刷新」'))).toBe(true);
    expect(steps.some((step) => step.includes('忽略'))).toBe(true);
    expect(steps.some((step) => step.includes('领域'))).toBe(true);
  });

  it('课程学习册与总册都是学习交流 v2 口径：两级目录、末尾三枚、学习交流三段（REQ-117 W11＋v1.0 三张化）', () => {
    const text = JSON.stringify([HELP_PAGES.course.blocks, HELP_PAGES.center.blocks]);
    for (const token of [
      '学习工作台', '推进与批注', '修改目录', '本节学完', '继续加载', '本章候选', '确认入库',
      '本条学完', '跳过本条', '撤销勾选', '回到断点', '保留为候选', '这一条的总结与注解',
      // v1.0（ADR 0026 D10）：候选池与保留位随表退出，块级分组口径一并下线
      '点赞', '待整理', '已保留', '本条通用', '这一块', '生成本条总结', '出处页码',
    ]) {
      expect(text, `课程学习册或总册出现 v1 口径「${token}」`).not.toContain(token);
    }
    const overview = HELP_PAGES.course.blocks[0].paragraphs ?? [];
    expect(overview.some((p) => p.includes('章下就是您要逐条读完的知识点'))).toBe(true);
    const steps = HELP_PAGES.course.blocks[1].steps ?? [];
    for (const phrase of ['学习交流', '本章总结', '学习要点', '详解', '备注', '生成本条注解', '已掌握并下一条', '下一条', '暂未开放']) {
      expect(steps.some((step) => step.includes(phrase)), `课程学习册使用说明缺「${phrase}」`).toBe(true);
    }
    const notes = HELP_PAGES.course.blocks[2].paragraphs ?? [];
    expect(notes.some((p) => p.includes('整章阅读记不进进度'))).toBe(true);
    expect(HELP_PAGES.center.blocks[1].steps?.some((step) => step.includes('已掌握并下一条'))).toBe(true);
  });

  it('总册三条入口的说明句就是首页三卡的一句话（同源不漂移）', () => {
    const entries = HELP_PAGES.center.entries ?? [];
    expect(entries.map((entry) => entry.name)).toEqual(['知识探索', '课程学习', '课后练习']);
    expect(entries.map((entry) => entry.page)).toEqual(['knowledge', 'course', 'practice']);
    expect(entries[0].desc).toContain('知识星图');
    expect(entries[1].desc).toContain('对比多种教材');
    expect(entries[2].desc).toContain('检验您的学习进度');
  });
});
