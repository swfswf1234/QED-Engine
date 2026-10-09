/**
 * 版式重排版渲染断言（parsing-ui §9/§9.1，REQ-098 W4a）：
 * 重排流入纸面（非绝对定位复刻）、字号阶梯与字族、目录拆分、页眉页脚默认隐藏、文字不截断。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

  it('版式：符号表组三列表式渲染，引言行仍正文角色', () => {
    renderW7();
    const table = document.querySelector('[data-testid="symbol-table"]');
    expect(table).toBeTruthy();
    expect(table?.querySelectorAll('[data-testid="symbol-row"]')).toHaveLength(3);
    expect([...table!.querySelectorAll('[data-symbol-page]')].map((e) => e.textContent)).toEqual(['2', '2', '2']);
    const intro = [...document.querySelectorAll('[data-block-role="body"]')].find((e) => e.textContent?.startsWith('下表所列'));
    expect(intro).toBeTruthy();
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
