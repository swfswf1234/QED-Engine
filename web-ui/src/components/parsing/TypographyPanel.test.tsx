import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TypographyPanel from './TypographyPanel';
import { DEFAULT_TYPOGRAPHY } from './typography';

afterEach(cleanup);

describe('版式样式面板（parsing-ui §9.1：仅三项控制）', () => {
  it('三控件齐备：正文字体（默认宋体）/正文字号（默认五号）/显示页眉页脚（默认关）', () => {
    render(<TypographyPanel prefs={DEFAULT_TYPOGRAPHY} onChange={vi.fn()} />);
    expect(screen.getByText('正文字体')).toBeTruthy();
    expect(screen.getByText('正文字号')).toBeTruthy();
    expect(screen.getByText(/五号/)).toBeTruthy();
    expect(screen.getByText(/宋体/)).toBeTruthy();
    const sw = screen.getByLabelText('显示页眉页脚');
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('开关切换 → onChange({showFurniture:true})', () => {
    const onChange = vi.fn();
    render(<TypographyPanel prefs={DEFAULT_TYPOGRAPHY} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('显示页眉页脚'));
    expect(onChange).toHaveBeenCalledWith({ showFurniture: true });
  });

  it('字号档位覆盖 五号～一号（最小五号最大一号硬界）', () => {
    render(<TypographyPanel prefs={{ ...DEFAULT_TYPOGRAPHY, bodyLevel: 8 }} onChange={vi.fn()} />);
    expect(screen.getByText(/一号/)).toBeTruthy();
  });
});
