import { describe, it, expect } from 'vitest';
import { unwrapMathDelimiters } from './blocks';

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
