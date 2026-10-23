/**
 * 学习面文案禁现守护（REQ-117 B1）
 * 只扫用户可见字面量（剥注释后的引号／反引号字符串与 JSX 文本），后台口径词一律不许出现在学习面。
 * 判据与总设计 §3「两侧语气分离」同源：学习者看得见的字里不出现解析／链路／单元／管理面等服务侧概念，
 * 每条降级话术都要给下一步（缺下一步的口径由各自的界面用例守护，本用例只管词表）。
 */
import annotationFormSource from '../components/learning/AnnotationForm.tsx?raw';
import annotationPaneSource from '../components/learning/AnnotationPane.tsx?raw';
import advancePaneSource from '../components/learning/AdvancePane.tsx?raw';
import chapterNoteSource from '../components/learning/ChapterNotePane.tsx?raw';
import learnStoreSource from '../stores/learnWorkbench.ts?raw';
import shelfSource from '../pages/LearnShelf.tsx?raw';
import workbenchSource from '../pages/LearnWorkbench.tsx?raw';
import { describe, expect, it } from 'vitest';

/** 后台口径词表（学习面禁止出现；新增后台概念时先补本表再改文案） */
export const BANNED_BACKEND_TOKENS = [
  '解析', '链路', '编译', '单元', '登记', '注册', '管理面', 'source_ref',
  '未激活', '无页窗', '页窗', '投影', '镜像', '离线', '服务', 'LLM', '8900', '8902',
];

/** v2.1 改判后工作台不许残留的旧口径（书架清单仍按徽标口径显示进度，故只扫工作台一族） */
export const BANNED_V1_WORKBENCH_TOKENS = [
  '学习工作台', '修改目录', '推进与批注', '学习进度', '未就绪', '本节', '上一节', '下一节',
  // C25 改判随步（W11）：右栏推进段与批注「保留为候选」腿下线，推进只走正文末尾三枚
  '本条学完', '跳过本条', '撤销勾选', '回到断点', '保留为候选',
  // v1.0 三张化（ADR 0026 D10）：候选池与保留位随表退出，块级分组口径一并下线，不许回来
  '点赞', '待整理', '已保留', '确认入库', '驳回', '本条通用', '这一块', '候选', '生成本条总结',
];

/** 学习面在册文件（书架清单＋单屏工作台＋其右栏组件）：以源码原文参与守护断言 */
const PLANE_SOURCES: Array<[string, string]> = [
  ['pages/LearnShelf.tsx', shelfSource],
  ['pages/LearnWorkbench.tsx', workbenchSource],
  ['stores/learnWorkbench.ts', learnStoreSource],
  ['components/learning/AnnotationPane.tsx', annotationPaneSource],
  ['components/learning/AnnotationForm.tsx', annotationFormSource],
  ['components/learning/AdvancePane.tsx', advancePaneSource],
  ['components/learning/ChapterNotePane.tsx', chapterNoteSource],
];

/** 工作台一族（不含书架清单） */
const WORKBENCH_SOURCES = PLANE_SOURCES.filter(([name]) => !name.includes('LearnShelf'));

/** 右栏「学习交流」三段的必含口径词（缺一个就说明 v2 口径被改回旧话术） */
const RIGHT_PANE_REQUIRED = [
  '学习交流', '本章总结', '学习要点', '详解', '备注', '生成本条注解', '长文正文',
  '上一条', '下一条', '已掌握并下一条', '暂未开放',
];

/** 右栏一族（段题在工作台，段内容在三个组件） */
const RIGHT_PANE_SOURCES = [
  workbenchSource, chapterNoteSource, annotationPaneSource, annotationFormSource, advancePaneSource,
];

/** 目录禁现的四类「当前情况说明」（整理中／整理失败／无可读教材／章内零知识点）＝后台管理口径，REQ-117 C23 */
export const BANNED_TOC_STATUS_TOKENS = ['正在为您整理', '暂时没整理好', '还没有可读的教材', '知识点还在整理'];

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^[ \t]*\/\/.*$/gm;
const LITERAL = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g;
const JSX_TEXT = />([^<>{}]*)</g;
/** JSX 文本捕获会顺着箭头跨进代码：带代码形状的片段不是用户可见文案（全角标点不算） */
const CODE_SHAPED = /[;?]|=>|\bconst\b|\breturn\b/;

function visibleStrings(source: string): string[] {
  const body = source.replace(BLOCK_COMMENT, ' ').replace(LINE_COMMENT, ' ');
  const out: string[] = [];
  for (const match of body.matchAll(LITERAL)) out.push(match[1] ?? match[2] ?? match[3] ?? '');
  for (const match of body.matchAll(JSX_TEXT)) {
    if (!CODE_SHAPED.test(match[1])) out.push(match[1]);
  }
  return out.map((text) => text.trim()).filter(Boolean);
}

describe('学习面文案禁现守护（B1）', () => {
  it.each(PLANE_SOURCES)('%s 的用户可见字面量不含后台口径词', (_name, source) => {
    for (const text of visibleStrings(source)) {
      for (const token of BANNED_BACKEND_TOKENS) {
        expect(text, `学习面文案出现后台口径词「${token}」`).not.toContain(token);
      }
    }
  });
});

describe('工作台 v2.1 口径守护（REQ-117 W9）', () => {
  it.each(WORKBENCH_SOURCES)('%s 的用户可见字面量不含旧口径词', (_name, source) => {
    for (const text of visibleStrings(source)) {
      for (const token of BANNED_V1_WORKBENCH_TOKENS) {
        expect(text, `工作台文案出现旧口径词「${token}」`).not.toContain(token);
      }
    }
  });

  it('目录不承载处理进度：四类情况说明在工作台用户可见文案里源码级禁现（C23）', () => {
    const visible = visibleStrings(workbenchSource);
    for (const token of BANNED_TOC_STATUS_TOKENS) {
      for (const text of visible) {
        expect(text, `工作台出现处理进度说明「${token}」`).not.toContain(token);
      }
    }
  });

  it('右栏三段＝学习交流／详解／备注的口径词都在用户可见话术里：缺一句就说明改回旧话术（C25~C28）', () => {
    const visible = RIGHT_PANE_SOURCES.flatMap((source) => visibleStrings(source));
    for (const word of RIGHT_PANE_REQUIRED) {
      expect(visible.join('\n'), `右栏缺口径词「${word}」`).toContain(word);
    }
  });

  it('「注解」不再作栏题：工作台的标题字面里不许出现单独的「注解」（C25 改判）', () => {
    const visible = visibleStrings(workbenchSource);
    for (const text of visible) {
      expect(text, '工作台把「注解」当成了栏题').not.toBe('注解');
      expect(text).not.toBe('打开注解');
    }
  });
});
