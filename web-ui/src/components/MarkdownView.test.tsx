import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownView from './MarkdownView';

describe('MarkdownView（原始文档对照渲染）', () => {
  it('标题与段落分段渲染', () => {
    render(<MarkdownView markdown={'# 第一章\n\n这是第一段。\n\n## 1.1 小节\n\n第二段。'} />);
    expect(screen.getByRole('heading', { name: '第一章' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1.1 小节' })).toBeInTheDocument();
    expect(screen.getByText('这是第一段。')).toBeInTheDocument();
    expect(screen.getByText('第二段。')).toBeInTheDocument();
  });

  it('公式块 $$...$$ 渲染为 KaTeX 输出（span 内）', () => {
    const { container } = render(<MarkdownView markdown={'$$\nE = mc^2\n$$'} />);
    // KaTeX 渲染产物含 .katex 类
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('公式解析失败 → 原样 LaTeX 文本降级（不崩溃）', () => {
    render(<MarkdownView markdown={'$$\n\\frac{a}{b \\begin{nope} x\n$$'} />);
    expect(screen.getByText(/\\frac\{a\}/)).toBeInTheDocument();
  });

  it('行内公式 $x^2$ 渲染', () => {
    const { container } = render(<MarkdownView markdown={'函数 $f(x)=x^2$ 是连续的。'} />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(screen.getByText(/是连续的/)).toBeInTheDocument();
  });

  it('空 markdown → 无渲染内容', () => {
    const { container } = render(<MarkdownView markdown="" />);
    expect(container.querySelector('.md-view')?.children.length ?? 0).toBe(0);
  });
});