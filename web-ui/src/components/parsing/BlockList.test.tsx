/**
 * 版式重排版渲染断言（parsing-ui §9/§9.1，REQ-098 W4a）：
 * 重排流入纸面（非绝对定位复刻）、字号阶梯与字族、目录拆分、页眉页脚默认隐藏、文字不截断。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import BlockList from './BlockList';
import type { Block, BlockEdit, BlockEditInput } from '../../api/axiom';
import { DEFAULT_TYPOGRAPHY, levelPx, type TypographyPrefs } from './typography';

const mk = (type: string, extra: Partial<Block> = {}): Block => ({
  type, bbox: [50, 40, 744, 80], ...extra,
});

const blocks: Block[] = [
  mk('heading', { level: 1, text: '第一章 极限' }),
  mk('paragraph', { text: '这一段正文需要完整展示，即使非常非常长超过了原页高度也必须继续流动显示而不是被裁掉。' }),
  mk('heading', { level: 1, text: '目录' }),
  mk('list', { items: ['函数极限与连续性 ……… 12', '导数与微分……34'] }),
  mk('caption', { text: '图 1 示例图注' }),
  mk('header', { text: '页眉文字' }),
  mk('formula', { latex: 'x^2+y^2=1' }),
];

function renderLayout(prefs: Partial<TypographyPrefs> = {}, editMode = false, selectedIndex = -1) {
  return render(
    <BlockList
      bookId="b"
      pageNo={1}
      blocks={blocks}
      edits={{}}
      renderMode="layout"
      imageSize={{ w: 794, h: 1123 }}
      selectedIndex={selectedIndex}
      editMode={editMode}
      typography={{ ...DEFAULT_TYPOGRAPHY, ...prefs }}
      onSelect={() => {}}
      onSubmit={vi.fn(async () => true)}
    />,
  );
}

const roleEl = (role: string) => document.querySelector(`[data-block-role="${role}"]`) as HTMLElement;

afterEach(cleanup);

describe('版式=重排版渲染（§9.1）', () => {
  it('页眉默认隐藏；开关打开后显示', () => {
    renderLayout();
    expect(screen.queryByText('页眉文字')).toBeNull();
    renderLayout({ showFurniture: true });
    expect(screen.getByText('页眉文字')).toBeTruthy();
  });

  it('正文=默认五号（L0→14px）宋体族（Times 前置）', () => {
    renderLayout();
    const el = roleEl('body');
    expect(parseFloat(el.style.fontSize)).toBeCloseTo(levelPx(0), 5);
    expect(el.style.fontFamily).toContain('Times New Roman');
    expect(el.style.fontFamily).toContain('SimSun');
  });

  it('标题字号=正文级+4 推导、恒黑体', () => {
    renderLayout();
    const el = roleEl('heading');
    expect(parseFloat(el.style.fontSize)).toBeCloseTo(levelPx(4), 5);
    expect(el.style.fontFamily).toContain('SimHei');
  });

  it('正文级调高一档后标题跟随级差（联动推导）', () => {
    renderLayout({ bodyLevel: 2 });
    expect(parseFloat((roleEl('body') as HTMLElement).style.fontSize)).toBeCloseTo(levelPx(2), 5);
    expect(parseFloat((roleEl('heading') as HTMLElement).style.fontSize)).toBeCloseTo(levelPx(6), 5);
  });

  it('目录区=list 角色 toc：条目拆标题+页码、楷体正文级', () => {
    renderLayout();
    const toc = roleEl('toc');
    expect(toc.textContent).toContain('函数极限与连续性');
    const pageEl = toc.querySelector('[data-toc-page]');
    expect(pageEl?.textContent).toBe('12');
    expect(parseFloat((toc as HTMLElement).style.fontSize)).toBeCloseTo(levelPx(0), 5);
    expect(toc.style.fontFamily).toContain('KaiTi');
  });

  it('题注=正文级楷体', () => {
    renderLayout();
    const cap = roleEl('caption');
    expect(cap.style.fontFamily).toContain('KaiTi');
    expect(parseFloat(cap.style.fontSize)).toBeCloseTo(levelPx(0), 5);
  });

  it('重排流式布局：非绝对定位、无 overflow 裁剪（文字完整展示）', () => {
    renderLayout();
    for (const role of ['heading', 'body', 'toc', 'caption']) {
      const el = roleEl(role);
      expect(el.style.position).not.toBe('absolute');
      expect(el.style.overflow).not.toBe('hidden');
      expect(el.style.textOverflow).not.toBe('ellipsis');
    }
  });

  it('选中块高亮 + 编辑弹层仍可（内容口径由父级 editMode 传入）', () => {
    renderLayout({}, true, 1);
    const el = roleEl('body');
    expect(el.style.border).toContain('rgb(22, 119, 255)');
    expect(screen.getByLabelText('块文字修正')).toBeTruthy();
  });

  it('流式模式行为不变（不消费版式偏好）', () => {
    render(
      <BlockList
        bookId="b"
        pageNo={1}
        blocks={blocks}
        edits={{}}
        renderMode="stream"
        imageSize={null}
        selectedIndex={-1}
        editMode={false}
        typography={{ ...DEFAULT_TYPOGRAPHY, bodyLevel: 8 }}
        onSelect={() => {}}
        onSubmit={vi.fn(async () => true)}
      />,
    );
    expect(screen.getAllByRole('button').length).toBe(blocks.length);
    expect(screen.getByText('页眉文字')).toBeTruthy();
    expect(document.querySelector('[data-block-role]')).toBeNull();
  });
});

/** W7 块集：节题类标题（parsing-ui §9.1）+ 目录多行块 + 符号表组 + 空块 + 多行正文 */
const w7blocks: Block[] = [
  mk('paragraph', { text: '目录' }),
  mk('paragraph', { text: '第1章 实数系和复数系…… 1\n导引 …… 1' }),
  mk('paragraph', { text: '重要符号表' }),
  mk('paragraph', { text: '下表所列符号附以简短说明及其定义所在之页数。' }),
  mk('paragraph', { text: '∈ 属于 2\n∉ 不属于 2\nQ 有理数域 2' }),
  mk('paragraph', { text: '' }),
  mk('paragraph', { text: '第一行正文\n第二行正文' }),
];

function renderW7(prefs: Partial<TypographyPrefs> = {}, mode: 'stream' | 'layout' = 'layout') {
  return render(
    <BlockList
      bookId="b"
      pageNo={9}
      blocks={w7blocks}
      edits={{}}
      renderMode={mode}
      imageSize={{ w: 794, h: 1123 }}
      selectedIndex={-1}
      editMode={false}
      typography={{ ...DEFAULT_TYPOGRAPHY, ...prefs }}
      onSelect={() => {}}
      onSubmit={vi.fn(async () => true)}
    />,
  );
}

describe('W7 节题类标题/目录拆行/符号表三列/空块跳过/换行保真', () => {
  it('版式：白名单节题按一级标题渲染（黑体族 + 级差字号）', () => {
    renderW7();
    const el = [...document.querySelectorAll('[data-block-role="heading"]')].find((e) => e.textContent?.includes('目录'));
    expect(el).toBeTruthy();
    expect((el as HTMLElement).style.fontFamily).toContain('SimHei');
    expect(parseFloat((el as HTMLElement).style.fontSize)).toBeCloseTo(levelPx(4), 5);
  });

  it('版式：目录多行 paragraph 逐行拆为条目（页码 data-toc-page）', () => {
    renderW7();
    const toc = document.querySelector('[data-block-role="toc"]') as HTMLElement;
    expect(toc).toBeTruthy();
    const pages = [...toc.querySelectorAll('[data-toc-page]')].map((e) => e.textContent);
    expect(pages).toEqual(['1', '1']);
  });

  it('版式：黏行渲染为两条目录行（DEFECT-025 守则一展示面，不再只显首条）', () => {
    render(
      <BlockList
        bookId="b"
        pageNo={7}
        blocks={[mk('paragraph', { text: '目录' }), mk('paragraph', { text: '第4章 连续性 …… 73函数的极限 …… 73\n连续函数 …… 74' })]}
        edits={{}}
        renderMode="layout"
        imageSize={{ w: 794, h: 1123 }}
        selectedIndex={-1}
        editMode={false}
        typography={DEFAULT_TYPOGRAPHY}
        onSelect={() => {}}
        onSubmit={vi.fn(async () => true)}
      />,
    );
    const toc = document.querySelector('[data-block-role="toc"]') as HTMLElement;
    expect(toc.querySelectorAll('[data-toc-row]')).toHaveLength(3);
    expect([...toc.querySelectorAll('[data-toc-title]')].map((e) => e.textContent)).toEqual(['第4章 连续性', '函数的极限', '连续函数']);
    expect([...toc.querySelectorAll('[data-toc-page]')].map((e) => e.textContent)).toEqual(['73', '73', '74']);
    // 章／节层级区分（用户 2026-10-25 裁「甲・章加粗＋节缩进」）：章行加粗不缩进，节行缩进一档不加粗
    const rows = [...toc.querySelectorAll('[data-toc-row]')] as HTMLElement[];
    expect(rows.map((row) => row.getAttribute('data-toc-kind'))).toEqual(['chapter', 'section', 'section']);
    expect(rows.map((row) => row.style.fontWeight)).toEqual(['600', '', '']);
    expect(rows.map((row) => row.style.paddingLeft)).toEqual(['0px', '16px', '16px']);
  });

  it('版式：目录续页（本页无「目录」标题）也铺成目录行，章行加粗（b05 第 8 页实测形态）', () => {
    render(
      <BlockList
        bookId="b"
        pageNo={8}
        blocks={[mk('paragraph', { text: 'VII\n习题 …… 148\n第8章 一些特殊函数 …… 155\n幂级数 …… 155' })]}
        edits={{}}
        renderMode="layout"
        imageSize={{ w: 794, h: 1123 }}
        selectedIndex={-1}
        editMode={false}
        typography={DEFAULT_TYPOGRAPHY}
        onSelect={() => {}}
        onSubmit={vi.fn(async () => true)}
      />,
    );
    const toc = document.querySelector('[data-block-role="toc"]') as HTMLElement;
    expect(toc).toBeTruthy();
    const rows = [...toc.querySelectorAll('[data-toc-row]')] as HTMLElement[];
    expect([...toc.querySelectorAll('[data-toc-title]')].map((e) => e.textContent)).toEqual(['习题', '第8章 一些特殊函数', '幂级数']);
    expect(rows.map((row) => row.getAttribute('data-toc-kind'))).toEqual(['section', 'chapter', 'section']);
    expect(rows.map((row) => row.style.fontWeight)).toEqual(['', '600', '']);
  });

  it('版式：符号表组三列表式渲染，引言行仍正文角色', () => {
    renderW7();
    const table = document.querySelector('[data-testid="symbol-table"]');
    expect(table).toBeTruthy();
    expect(table?.querySelectorAll('[data-testid="symbol-row"]')).toHaveLength(3);
    expect([...table!.querySelectorAll('[data-symbol-page]')].map((e) => e.textContent)).toEqual(['2', '2', '2']);
    const intro = [...document.querySelectorAll('[data-block-role="body"]')].find((e) => e.textContent?.startsWith('下表所列'));
    expect(intro).toBeTruthy();
  });

  it('版式：符号列／目录行名／表格里的 $…$ 一律按公式渲染（用户令「数学符号要按照公式渲染好」）', () => {
    render(
      <BlockList
        bookId="b"
        pageNo={6}
        blocks={[
          mk('paragraph', { text: '重要符号表' }),
          mk('paragraph', { text: ' $\\mathscr{L}^2$  Lebesgue 可积的函数类 288\n∂ 边缘算子 245' }),
          mk('paragraph', { text: '目录' }),
          mk('paragraph', { text: '第11章 $\\mathscr{L}^2$ 类的函数 …… 296' }),
          mk('table', { html: '<table><tr><td> $I^k$  k-方格</td><td>223</td></tr></table>' }),
        ]}
        edits={{}}
        renderMode="layout"
        imageSize={{ w: 794, h: 1123 }}
        selectedIndex={-1}
        editMode={false}
        typography={DEFAULT_TYPOGRAPHY}
        onSelect={() => {}}
        onSubmit={vi.fn(async () => true)}
      />,
    );
    const symbolCol = document.querySelector('[data-symbol-col]') as HTMLElement;
    expect(symbolCol.querySelector('.katex')).toBeTruthy();
    const tocTitle = document.querySelector('[data-toc-title]') as HTMLElement;
    expect(tocTitle.querySelector('.katex')).toBeTruthy();
    expect(document.querySelector('table .katex')).toBeTruthy();
    // 字面定界符一律不再出现在屏上
    expect(document.body.textContent).not.toContain('$\\mathscr{L}^2$');
    expect(document.body.textContent).not.toContain('$I^k$');
  });

  it('版式：块级公式恒 display 模式（含 \\tag 的编号式不报错）', () => {
    render(
      <BlockList
        bookId="b"
        pageNo={31}
        blocks={[
          mk('paragraph', { text: '设 $S$ 为集合。' }),
          mk('formula', { latex: 'S = \\bigcup_ {a \\in A} E _ {a}.\\tag{1}' }),
        ]}
        edits={{}}
        renderMode="layout"
        imageSize={{ w: 794, h: 1123 }}
        selectedIndex={-1}
        editMode={false}
        typography={DEFAULT_TYPOGRAPHY}
        onSelect={() => {}}
        onSubmit={vi.fn(async () => true)}
      />,
    );
    // 块级公式走 display（.katex-display 恰一枚），行内 $S$ 不进 display
    expect(document.querySelectorAll('.katex-display')).toHaveLength(1);
    // 没有回落到「$$…$$ 原文」那条兜底路：KaTeX 没报解析错
    expect(document.querySelector('.katex-error')).toBeNull();
    expect(document.body.textContent).not.toContain('$$S =');
  });

  it('版式：空文本块不渲染（7 块只出 6 个角色元素）', () => {
    renderW7();
    expect(document.querySelectorAll('[data-block-role]')).toHaveLength(6);
  });

  it('版式与流式：多行正文块保留行结构（pre-wrap）', () => {
    renderW7();
    const bodyEl = [...document.querySelectorAll('[data-block-role="body"]')].find((e) => e.textContent?.includes('第一行正文'));
    expect(bodyEl?.querySelector('span[style*="pre-wrap"], span')?.textContent).toContain('第一行正文');
    const span = [...(bodyEl?.querySelectorAll('span') ?? [])].find((s) => s.style.whiteSpace === 'pre-wrap');
    expect(span).toBeTruthy();
    cleanup();
    renderW7({}, 'stream');
    const sSpan = [...document.querySelectorAll('span')].find((s) => s.style.whiteSpace === 'pre-wrap' && s.textContent?.includes('第一行正文'));
    expect(sSpan).toBeTruthy();
  });
});

/** W8 单块确认（解析修正口径：确认=落 verdict=ok，保留既有修正字段） */
describe('单块确认按钮（REQ-098 W8）', () => {
  const mkEdit = (i: number, verdict: 'ok' | 'bad', extra: Partial<BlockEdit> = {}): BlockEdit => ({
    edit_id: `e${i}`, book_id: 'b', page_no: 1, block_index: i, block_type: 'paragraph',
    verdict, note: '', corrected_text: null, corrected_bbox: null, ...extra,
  });

  function renderStream(edits: Record<string, BlockEdit>, editMode: boolean, onSubmit: (i: number, input: BlockEditInput) => Promise<boolean>) {
    return render(
      <BlockList
        bookId="b" pageNo={1} blocks={blocks} edits={edits}
        renderMode="stream" imageSize={null} selectedIndex={-1} editMode={editMode}
        typography={DEFAULT_TYPOGRAPHY} onSelect={() => {}} onSubmit={onSubmit}
      />,
    );
  }

  it('未确认块有「确认」钮、已 ok 块无；点击提交合并 prev 字段 verdict=ok', () => {
    const onSubmit = vi.fn(async () => true);
    renderStream({ 'b:1:0': mkEdit(0, 'ok'), 'b:1:1': mkEdit(1, 'bad', { corrected_text: '旧文' }) }, true, onSubmit);
    expect(screen.queryByLabelText('确认块 1')).toBeNull();
    fireEvent.click(screen.getByLabelText('确认块 2'));
    expect(onSubmit).toHaveBeenCalledWith(1, { corrected_text: '旧文', verdict: 'ok' });
  });

  it('只读态无确认钮', () => {
    renderStream({}, false, vi.fn(async () => true));
    expect(screen.queryByLabelText('确认块 2')).toBeNull();
  });

  it('版式态同样逐块出确认钮', () => {
    renderLayout({}, true);
    expect(screen.getByLabelText('确认块 2')).toBeTruthy();
  });
});

/** 图片面（ARCH-027-M1 判据 S1，用户裁决 2026-10-09）＝整页页图按块 bbox 内联裁切 */
describe('image 块＝页图 bbox 内联裁切（S1 图片面）', () => {
  const imageBlocks: Block[] = [
    mk('image', { bbox: [100, 200, 500, 400], text: '图 1 示意', path: 'pages/images/a.jpg' }),
  ];
  const PAGE_IMAGE = 'http://127.0.0.1:8900/api/v1/books/b/pages/32/image';

  function renderImage(pageImageUrl: string | null) {
    return render(
      <BlockList
        bookId="b" pageNo={32} blocks={imageBlocks} edits={{}}
        renderMode="layout" imageSize={null} selectedIndex={-1} editMode={false}
        typography={DEFAULT_TYPOGRAPHY} pageImageUrl={pageImageUrl}
        onSelect={() => {}} onSubmit={vi.fn(async () => true)}
      />,
    );
  }

  it('有页图地址：出内联图，量得页图自然尺寸后按百分比裁出 bbox 区域', () => {
    renderImage(PAGE_IMAGE);
    const img = screen.getByAltText('块图（页图裁切）') as HTMLImageElement;
    expect(img).toHaveAttribute('src', PAGE_IMAGE);
    Object.defineProperty(img, 'naturalWidth', { value: 1000, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 2000, configurable: true });
    fireEvent.load(img);
    // bbox 100,200→500,400＝宽 400 高 200；页图 1000×2000 → 放大 250%/1000%，偏移 −25%/−100%
    expect(img.style.width).toBe('250%');
    expect(img.style.height).toBe('1000%');
    expect(img.style.left).toBe('-25%');
    expect(img.style.top).toBe('-100%');
    const box = img.parentElement as HTMLElement;
    expect(box.style.overflow).toBe('hidden');
    expect(box.style.aspectRatio && parseFloat(box.style.aspectRatio)).toBeCloseTo(2, 5);
  });

  it('无页图地址（如书目面未回传）：回退题注文字，不出内联图', () => {
    renderImage(null);
    expect(screen.queryByAltText('块图（页图裁切）')).toBeNull();
    expect(screen.getByText('图 1 示意')).toBeTruthy();
  });

  it('bbox 缺失或非有限值时不裁切（回退题注，避免 NaN 样式）', () => {
    render(
      <BlockList
        bookId="b" pageNo={32} blocks={[mk('image', { bbox: null as unknown as [number, number, number, number], text: '无框图' })]}
        edits={{}} renderMode="layout" imageSize={null} selectedIndex={-1} editMode={false}
        typography={DEFAULT_TYPOGRAPHY} pageImageUrl={PAGE_IMAGE}
        onSelect={() => {}} onSubmit={vi.fn(async () => true)}
      />,
    );
    expect(screen.queryByAltText('块图（页图裁切）')).toBeNull();
    expect(screen.getByText('无框图')).toBeTruthy();
  });
});

describe('W5 版式渲染落码（§V2.4.1 层级左对齐 + §V2.4.2 跨页合并）', () => {
  const w5blocks: Block[] = [
    mk('heading', { text: '第一章 实数' }),
    mk('paragraph', { text: '实数完备性是分析学的基础。' }),
    mk('heading', { text: '1.1 有序域' }),
    mk('paragraph', { text: '设 F 为有序' }),
    mk('paragraph', { text: '域，则其上界性质可表述为：' }),
  ];

  function renderW5() {
    return render(
      <BlockList
        bookId="b"
        pageNo={3}
        blocks={w5blocks}
        edits={{}}
        renderMode="layout"
        imageSize={{ w: 794, h: 1123 }}
        selectedIndex={-1}
        editMode={false}
        typography={DEFAULT_TYPOGRAPHY}
        onSelect={() => {}}
        onSubmit={vi.fn(async () => true)}
      />,
    );
  }

  const unit = (text: string) =>
    [...document.querySelectorAll('[data-block-role]')].find(
      (e) => (e.textContent ?? '').startsWith(text),
    ) as HTMLElement;

  it('章题档 0、节题档 16px，正文随其上级标题同档', () => {
    renderW5();
    expect(unit('第一章 实数').style.marginLeft).toBe('0px');
    expect(unit('实数完备性').style.marginLeft).toBe('0px');
    expect(unit('1.1 有序域').style.marginLeft).toBe('16px');
    expect(unit('设 F 为有序').style.marginLeft).toBe('16px');
  });

  it('正文一律显式左对齐（不再依赖默认对齐造成层级错乱）', () => {
    renderW5();
    expect(unit('实数完备性').style.textAlign).toBe('left');
  });

  it('跨页断句合并为一段（两块文本相接，正文单元数由 3 降为 2）', () => {
    renderW5();
    expect(unit('设 F 为有序').textContent).toBe('设 F 为有序域，则其上界性质可表述为：');
    expect(document.querySelectorAll('[data-block-role="body"]')).toHaveLength(2);
  });
});

/**
 * 块类型人工改判（REQ-142 W6）：编辑弹层出十枚全集下拉，保存走 `/edit` 门面的 `corrected_type`，
 * 回显优先读改判值（生效类型正本在 8902 读侧回放，本地下拉只作即时反馈）。
 */
describe('块类型改判下拉（REQ-142 W6）', () => {
  const relabelBlocks: Block[] = [
    mk('heading', { level: 1, text: '第一章' }),
    mk('paragraph', { text: '高等数学 第 3 版' }),
  ];

  function renderEditor(
    onSubmit: (i: number, input: BlockEditInput) => Promise<boolean>,
    edits: Record<string, BlockEdit> = {},
    renderMode: 'layout' | 'stream' = 'layout',
  ) {
    return render(
      <BlockList
        bookId="b" pageNo={1} blocks={relabelBlocks} edits={edits}
        renderMode={renderMode} imageSize={null} selectedIndex={1} editMode
        typography={DEFAULT_TYPOGRAPHY} onSelect={() => {}} onSubmit={onSubmit}
      />,
    );
  }

  const pickType = async (label: string) => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '块类型' }));
    fireEvent.click(await screen.findByTitle(label));
  };

  const clickSave = async () => {
    const btn = (await screen.findByText('保存修正')).closest('button');
    fireEvent.click(btn as HTMLElement);
  };

  it('下拉出十枚闭集值，且回显当前生效类型', async () => {
    renderEditor(vi.fn(async () => true));
    expect(screen.getByText('段落')).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '块类型' }));
    await waitFor(() => expect(document.querySelectorAll('.ant-select-item-option-content')).toHaveLength(10));
    const labels = [...document.querySelectorAll('.ant-select-item-option-content')].map((el) => el.textContent);
    expect(labels).toEqual(['标题', '段落', '公式', '表格', '图片', '列表', '图注', '页眉', '页脚', '页码']);
  });

  it('改成页眉并保存：提交带 corrected_type，且不丢既有文字/备注修正', async () => {
    const onSubmit = vi.fn(async () => true);
    renderEditor(onSubmit, { 'b:1:1': { block_index: 1, book_id: 'b', page_no: 1, block_type: 'paragraph', note: '旧备注', corrected_text: '旧文' } });
    await pickType('页眉');
    await clickSave();
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(1, { corrected_text: '旧文', note: '旧备注', corrected_type: 'header' });
    });
  });

  it('未改动类型时保存不带 corrected_type 键（零多余意图行）', async () => {
    const onSubmit = vi.fn<(i: number, input: BlockEditInput) => Promise<boolean>>(async () => true);
    renderEditor(onSubmit);
    await clickSave();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [, input] = onSubmit.mock.calls[0] as [number, BlockEditInput];
    expect(input).not.toHaveProperty('corrected_type');
  });

  it('改判后的回显取改判值而非产物原类型（同页未刷新也不跳回段落）', async () => {
    renderEditor(vi.fn(async () => true), {
      'b:1:1': { block_index: 1, book_id: 'b', page_no: 1, block_type: 'paragraph', corrected_type: 'header' },
    });
    expect(screen.getByText('页眉')).toBeTruthy();
  });

  it('流式态同一条腿出下拉（两渲染模式共用编辑弹层）', () => {
    renderEditor(vi.fn(async () => true), {}, 'stream');
    expect(screen.getByRole('combobox', { name: '块类型' })).toBeTruthy();
  });
});
