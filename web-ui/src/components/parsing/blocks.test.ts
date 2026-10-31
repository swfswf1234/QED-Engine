import { describe, it, expect } from 'vitest';
import { renderMathInHtml, unwrapMathDelimiters } from './blocks';

describe('unwrapMathDelimiters（公式块定界符剥离，BUGFIX-011）', () => {
  it('剥成对 $$…$$（ARCH-018 前老代产物形态）', () => {
    expect(unwrapMathDelimiters('$$\nd (p, p ^ {\\prime}) < \\varepsilon\n$$'))
      .toBe('d (p, p ^ {\\prime}) < \\varepsilon');
  });

  it('剥 \\[…\\]', () => {
    expect(unwrapMathDelimiters('\\[E=mc^2\\]')).toBe('E=mc^2');
  });

  it('剥单 $…$', () => {
    expect(unwrapMathDelimiters('$x^2$')).toBe('x^2');
  });

  it('剥后内部仍含同种定界符 → 保留原文（可见异常不误剥）', () => {
    expect(unwrapMathDelimiters('$$a$$ b$$')).toBe('$$a$$ b$$');
  });

  it('裸 LaTeX（新代形态）原样返回', () => {
    expect(unwrapMathDelimiters('x^2+y^2=1')).toBe('x^2+y^2=1');
  });

  it('不成对不剥', () => {
    expect(unwrapMathDelimiters('$$x^2')).toBe('$$x^2');
  });

  it('空壳定界符不剥', () => {
    expect(unwrapMathDelimiters('$$')).toBe('$$');
  });
});

describe('renderMathInHtml（HTML 片段里的 $…$ 走 KaTeX＝表格与符号列的公式渲染）', () => {
  it('表格单元格里的 $I^k$ 渲成 katex 节点，字面定界符消失（b05 第 6 页符号表现网形态）', () => {
    const out = renderMathInHtml('<table><tr><td> $I^k$  k-方格</td><td>223</td></tr></table>');
    expect(out).toContain('class="katex"');
    expect(out).not.toContain('$I^k$');
    expect(out).toContain('223');
  });

  it('只改文本节点：标签与属性里的 $ 原样不动', () => {
    const out = renderMathInHtml('<table><tr><td title="$x^2$">a</td></tr></table>');
    expect(out).toContain('title="$x^2$"');
    expect(out).not.toContain('class="katex"');
  });

  it('无定界符的片段原样返回（不引入第二套解析）', () => {
    expect(renderMathInHtml('<table><tr><td>dx 基本k-形式</td></tr></table>'))
      .toContain('dx 基本k-形式');
  });
});
