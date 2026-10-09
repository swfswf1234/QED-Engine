/**
 * 框编辑工作台交互（parsing-ui §10，REQ-098 W4b + W8）：
 * 8 手柄拉伸、框体移动 → onBoxCommit；**画框模式（drawMode）**下空白拖拽画新框 → onNewBox；
 * Ctrl/Shift 多选 → onMultiSelect；**右键框图菜单**（修改=选中显手柄 / 删除 / 恢复）→ onDeleteRegion/onRestoreRegion；
 * regionDraft 本地预览（新框虚线、删除淡出、合并并集）。
 * 页图尺寸口径（W9 追改）：容器宽＝宿主栏宽、高由 `aspect-ratio`（自然尺寸，未载入前 A4 回退）决定，
 * **不再有 zoom 驱动的固定像素宽高**（原实现的 `objectFit: fill` 拉伸属纯拉长，已撤除）。
 * jsdom 无真实布局：rect 统一 stub 为 794×1123（与 A4 回退基准 1:1，坐标换算不缩放）。
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import PageImagePane from './PageImagePane';
import type { Block } from '../../api/axiom';

const blocks: Block[] = [
  { type: 'paragraph', bbox: [100, 100, 300, 200] },
  { type: 'paragraph', bbox: [400, 300, 600, 400] },
];

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    left: 0, top: 0, width: 794, height: 1123, right: 794, bottom: 1123, x: 0, y: 0, toJSON: () => ({}),
  }) as DOMRect);
  // jsdom 图片不加载：给 HTMLImageElement 自然尺寸让页图尺寸就绪，才能走到「空白点击就近选块」分支
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 794 });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 1123 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalWidth;
  delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalHeight;
});

/** 触发 img onLoad（页图自然尺寸就绪） */
function settleImage(container: HTMLElement) {
  fireEvent.load(container.querySelector('img') as HTMLElement);
}

function renderPane(extra: Record<string, unknown> = {}) {
  return render(
    <PageImagePane
      bookId="b"
      pageNo={1}
      blocks={blocks}
      selectedIndex={0}
      hoveredIndex={-1}
      onSelect={() => {}}
      onHover={() => {}}
      boxEdit
      drawMode={false}
      regionDraft={{ added: [], deleted: [], merged: [] }}
      onBoxCommit={vi.fn()}
      onNewBox={vi.fn()}
      onMultiSelect={vi.fn()}
      onDeleteRegion={vi.fn()}
      onRestoreRegion={vi.fn()}
      {...extra}
    />,
  );
}

describe('页图尺寸口径（§4.6 追改：缩放撤除，按栏宽自适应）', () => {
  it('容器宽＝100% 宿主栏宽、高度交给 aspect-ratio（无固定像素宽高）；未载入按 A4 回退', () => {
    const { container } = renderPane();
    const pane = container.querySelector('[data-testid="page-image-1"]') as HTMLElement;
    expect(pane.style.width).toBe('100%');
    expect(pane.style.height).toBe('');
    expect(pane.style.aspectRatio).toBe('794 / 1123');
  });

  it('载入后按真实自然尺寸出比例（非 A4 比例的页图不再被拉长）', () => {
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 1240 });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 1600 });
    const { container } = renderPane();
    settleImage(container);
    const pane = container.querySelector('[data-testid="page-image-1"]') as HTMLElement;
    expect(pane.style.aspectRatio).toBe('1240 / 1600');
  });
});

describe('框编辑交互（口径=框图修改）', () => {
  it('选中块渲染 8 个缩放手柄', () => {
    renderPane();
    for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      expect(screen.getByTestId(`handle-${h}`)).toBeTruthy();
    }
  });

  it('se 手柄拖拽 → 松手 onBoxCommit(0, 拉伸后 bbox)', () => {
    const onBoxCommit = vi.fn();
    renderPane({ onBoxCommit });
    const h = screen.getByTestId('handle-se');
    fireEvent.mouseDown(h, { clientX: 300, clientY: 200, button: 0 });
    fireEvent.mouseMove(window, { clientX: 320, clientY: 230 });
    fireEvent.mouseUp(window, { clientX: 320, clientY: 230 });
    const args = onBoxCommit.mock.calls[0];
    expect(args[0]).toBe(0);
    expect(args[1]).toEqual([100, 100, 320, 230]);
    expect(args[2]).toEqual({ corrected_bbox: [100, 100, 320, 230] });
  });

  it('框体拖移 → onBoxCommit(0, 平移后 bbox)；纯点击不触发提交', () => {
    const onBoxCommit = vi.fn();
    const onSelect = vi.fn();
    renderPane({ onBoxCommit, onSelect, selectedIndex: 0 });
    const box = screen.getByLabelText('bbox 1');
    fireEvent.mouseDown(box, { clientX: 200, clientY: 150, button: 0 });
    fireEvent.mouseMove(window, { clientX: 250, clientY: 150 });
    fireEvent.mouseUp(window, { clientX: 250, clientY: 150 });
    const args = onBoxCommit.mock.calls[0];
    expect(args[0]).toBe(0);
    expect(args[1]).toEqual([150, 100, 350, 200]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('页图缩小渲染（屏 px < 自然 px）：2 屏 px 抖动不落库，8 屏 px 才算拖拽（位移判据按屏像素）', () => {
    // 宿主 rect 400×566 vs 自然 794×1123 → 1 屏 px ≈ 2 自然 px（W9 后页图按栏宽自适应，缩得比自然尺寸小）
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      left: 0, top: 0, width: 400, height: 566, right: 400, bottom: 566, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect);
    const onBoxCommit = vi.fn();
    renderPane({ onBoxCommit, selectedIndex: 0 });
    const box = screen.getByLabelText('bbox 1');
    fireEvent.mouseDown(box, { clientX: 200, clientY: 150, button: 0 });
    fireEvent.mouseMove(window, { clientX: 202, clientY: 152 });
    fireEvent.mouseUp(window, { clientX: 202, clientY: 152 });
    expect(onBoxCommit).not.toHaveBeenCalled();

    fireEvent.mouseDown(box, { clientX: 200, clientY: 150, button: 0 });
    fireEvent.mouseMove(window, { clientX: 208, clientY: 150 });
    fireEvent.mouseUp(window, { clientX: 208, clientY: 150 });
    expect(onBoxCommit).toHaveBeenCalledTimes(1);
    const nb = onBoxCommit.mock.calls[0][1] as number[];
    expect(nb[0]).toBeGreaterThan(100);
  });

  it('Ctrl/Shift 点框 → onMultiSelect，不当作单选', () => {
    const onMultiSelect = vi.fn();
    const onSelect = vi.fn();
    renderPane({ onMultiSelect, onSelect });
    fireEvent.click(screen.getByLabelText('bbox 2'), { ctrlKey: true });
    expect(onMultiSelect).toHaveBeenCalledWith(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('画框模式关（默认）：空白拖拽不画新框、光标非十字', () => {
    const onNewBox = vi.fn();
    const { container } = renderPane({ onNewBox, drawMode: false });
    const pane = container.querySelector('[data-testid="page-image-1"]') as HTMLElement;
    expect(pane.style.cursor).not.toBe('crosshair');
    fireEvent.mouseDown(pane, { clientX: 600, clientY: 600, button: 0 });
    fireEvent.mouseMove(window, { clientX: 700, clientY: 680 });
    fireEvent.mouseUp(window, { clientX: 700, clientY: 680 });
    expect(onNewBox).not.toHaveBeenCalled();
  });

  it('画框模式开：空白拖拽 → onNewBox(像素 bbox)；微动不算画框', () => {
    const onNewBox = vi.fn();
    const { container } = renderPane({ onNewBox, drawMode: true });
    const pane = container.querySelector('[data-testid="page-image-1"]') as HTMLElement;
    expect(pane.style.cursor).toBe('crosshair');
    fireEvent.mouseDown(pane, { clientX: 600, clientY: 600, button: 0 });
    fireEvent.mouseMove(window, { clientX: 700, clientY: 680 });
    fireEvent.mouseUp(window, { clientX: 700, clientY: 680 });
    expect(onNewBox.mock.calls[0][0]).toEqual([600, 600, 700, 680]);
    onNewBox.mockClear();
    fireEvent.mouseDown(pane, { clientX: 650, clientY: 650, button: 0 });
    fireEvent.mouseUp(window, { clientX: 651, clientY: 651 });
    expect(onNewBox).not.toHaveBeenCalled();
  });

  it('右键框图 → 菜单（修改/删除）；点删除 → onDeleteRegion(idx)', async () => {
    const onDeleteRegion = vi.fn();
    const onSelect = vi.fn();
    renderPane({ onDeleteRegion, onSelect, selectedIndex: -1 });
    fireEvent.contextMenu(screen.getByLabelText('bbox 2'));
    const del = await screen.findByText('删除');
    fireEvent.click(del);
    expect(onDeleteRegion).toHaveBeenCalledWith(1);
  });

  it('右键框图 → 菜单点「修改」= 选中该框（出 8 手柄）', async () => {
    const onSelect = vi.fn();
    renderPane({ onSelect, selectedIndex: -1 });
    fireEvent.contextMenu(screen.getByLabelText('bbox 2'));
    fireEvent.click(await screen.findByText('修改'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('已删除框右键 → 「恢复」→ onRestoreRegion(idx)', async () => {
    const onRestoreRegion = vi.fn();
    renderPane({
      selectedIndex: -1,
      regionDraft: { added: [], deleted: [1], merged: [] },
      onRestoreRegion,
    });
    fireEvent.contextMenu(screen.getByLabelText('bbox 2'));
    fireEvent.click(await screen.findByText('恢复'));
    expect(onRestoreRegion).toHaveBeenCalledWith(1);
  });

  it('页图空白点击 → 就近选块（自然尺寸就绪后）', () => {
    const onSelect = vi.fn();
    const { container } = renderPane({ onSelect, selectedIndex: -1 });
    settleImage(container);
    fireEvent.click(container.querySelector('[data-testid="page-image-1"]') as HTMLElement, { clientX: 600, clientY: 600 });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('菜单点「修改」只选中该框：点击不从弹层冒泡回页图（否则就近选块覆盖菜单动作）', async () => {
    const onSelect = vi.fn();
    const { container } = renderPane({ onSelect, selectedIndex: -1 });
    settleImage(container);
    fireEvent.contextMenu(screen.getByLabelText('bbox 2'));
    fireEvent.click(await screen.findByText('修改'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('菜单点「删除」不触发页图就近选中', async () => {
    const onDeleteRegion = vi.fn();
    const onSelect = vi.fn();
    const { container } = renderPane({ onDeleteRegion, onSelect, selectedIndex: -1 });
    settleImage(container);
    fireEvent.contextMenu(screen.getByLabelText('bbox 2'));
    fireEvent.click(await screen.findByText('删除'));
    expect(onDeleteRegion).toHaveBeenCalledWith(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('非编辑口径（boxEdit=false）：无手柄、右键无菜单、不画新框', () => {
    const onNewBox = vi.fn();
    const { container } = render(
      <PageImagePane
        bookId="b"
        pageNo={1}
        blocks={blocks}
        selectedIndex={0}
        hoveredIndex={-1}
        onSelect={() => {}}
        onHover={() => {}}
        boxEdit={false}
        drawMode
        regionDraft={{ added: [], deleted: [], merged: [] }}
        onNewBox={onNewBox}
      />,
    );
    expect(screen.queryByTestId('handle-se')).toBeNull();
    fireEvent.contextMenu(screen.getByLabelText('bbox 2'));
    expect(screen.queryByText('删除')).toBeNull();
    const pane = container.querySelector('[data-testid="page-image-1"]') as HTMLElement;
    fireEvent.mouseDown(pane, { clientX: 600, clientY: 600, button: 0 });
    fireEvent.mouseMove(window, { clientX: 700, clientY: 700 });
    fireEvent.mouseUp(window, { clientX: 700, clientY: 700 });
    expect(onNewBox).not.toHaveBeenCalled();
  });

  it('regionDraft 预览：新框虚线、删除淡出、合并并集框', () => {
    renderPane({
      regionDraft: {
        added: [[50, 50, 90, 90]],
        deleted: [1],
        merged: [[0, 1]],
      },
    });
    expect(screen.getByTestId('draft-added-0')).toBeTruthy();
    const deleted = screen.getByLabelText('bbox 2');
    expect(deleted.style.opacity).toBe('0.25');
    expect(deleted.style.borderStyle).toBe('dashed');
    const union = screen.getByTestId('draft-merged-0');
    expect(union).toBeTruthy();
    // 并集 [100,100,600,400] / 794×1123 → left/top 百分比
    expect((union as HTMLElement).style.left).toBe(`${(100 / 794) * 100}%`);
  });
});
