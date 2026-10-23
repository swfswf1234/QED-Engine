/**
 * 手册弹窗承载例外守护（2026-10-16 用户改判，撤销同日 REQ-117 C12 的「深蓝底白字」）
 * 判据取性质不取色值字面：底必为浅色、外框必属深蓝家族、正文必为深字，
 * 弹层内不得残留白字/浅字；总册三条入口排在「使用说明」之后且文字左缘同列。
 */
import { render, screen } from '@testing-library/react';
import HelpModal from './HelpModal';
import { HELP_PAGES, type HelpPageKey } from '../help/sections';

const PAGES: HelpPageKey[] = ['center', 'knowledge', 'course', 'practice'];

/** 色值可能是 `rgb(...)` 也可能是 `#rrggbb`（jsdom 序列化不一），两式都归一成三通道 */
function channelsOf(value: string): number[] {
  const rgb = value.match(/rgba?\(([^)]+)\)/);
  if (rgb) return rgb[1].split(',').slice(0, 3).map((n) => Number(n.trim()));
  const hex = value.match(/#([0-9a-fA-F]{6})/);
  if (hex) return [0, 2, 4].map((i) => Number.parseInt(hex[1].slice(i, i + 2), 16));
  return [];
}

describe('手册弹窗蓝框白底深字', () => {
  it.each(PAGES)('%s 册弹层＝白底配深蓝框与深字，四册一致', (page) => {
    const { unmount } = render(<HelpModal open onClose={() => {}} page={page} />);
    const content = document.querySelector('.ant-modal-content') as HTMLElement;
    const body = document.querySelector('.ant-modal-body') as HTMLElement;
    expect(content).not.toBeNull();
    expect(body).not.toBeNull();

    const bg = channelsOf(content.style.background || content.style.backgroundColor);
    expect(bg.length).toBe(3);
    expect(Math.min(...bg)).toBeGreaterThan(0xc0); // 够浅：底必为白系，文字落在白底上

    expect(content.style.border).toMatch(/^2px\s+solid/);
    const frame = channelsOf(content.style.border);
    expect(frame.length).toBe(3);
    expect(Math.max(...frame)).toBeLessThan(0x80); // 框够暗
    expect(frame[2]).toBeGreaterThan(frame[0]); // 蓝高于红：深蓝家族而非灰黑

    const ink = channelsOf(body.style.color);
    expect(Math.max(...ink)).toBeLessThan(0x80); // 正文深字
    expect(content.style.color).toBe(body.style.color);

    // 深底白字残留＝违规：弹层内任何内联纯白字都红
    expect(body.innerHTML).not.toMatch(/color:\s*#fff/i);
    expect(body.innerHTML).not.toMatch(/color:\s*rgb\(255,\s*255,\s*255\)/i);

    expect(screen.getByRole('dialog')).toHaveTextContent(HELP_PAGES[page].title);
    unmount();
  });

  it('总册节序＝功能概览 → 使用说明（步骤） → 三条入口 → 状态与限制', () => {
    render(<HelpModal open onClose={() => {}} page="center" />);
    const body = document.querySelector('.ant-modal-body') as HTMLElement;
    const marks = Array.from(body.querySelectorAll('h5, ol, .help-entries')).map((el) =>
      el.tagName === 'H5' ? el.textContent : el.tagName === 'OL' ? 'steps' : 'entries',
    );
    expect(marks).toEqual(['功能概览', '使用说明', 'steps', 'entries', '状态与限制']);
    expect(document.querySelectorAll('.help-entry').length).toBe(HELP_PAGES.center.entries?.length);
  });

  it('入口卡＝箭头列定宽的两列栅格，名称行与说明行同列且为块级（左缘齐平）', () => {
    render(<HelpModal open onClose={() => {}} page="center" />);
    const first = document.querySelector('.help-entry') as HTMLElement;
    expect(first).not.toBeNull();
    expect(first.style.display).toBe('grid');
    expect(first.style.gridTemplateColumns).toMatch(/^18px\s+minmax\(0,\s*1fr\)$/); // 箭头列定宽、文本列吃余宽
    expect(first.children.length).toBe(2); // 箭头列 + 文本列
    const text = first.children[1] as HTMLElement;
    expect(text.style.display).toBe('block');
    expect(text.children.length).toBe(2); // 名称行 + 说明行
    for (const row of Array.from(text.children)) expect((row as HTMLElement).style.display).toBe('block');
  });

  it('子册不渲染入口卡，只留「学习中心总手册」返回', () => {
    render(<HelpModal open onClose={() => {}} page="course" />);
    expect(document.querySelector('.help-entries')).toBeNull();
    expect(screen.getByRole('button', { name: /学习中心总手册/ })).toBeInTheDocument();
  });
});
