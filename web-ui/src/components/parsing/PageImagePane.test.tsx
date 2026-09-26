/**
 * 框编辑工作台交互（parsing-ui §10，REQ-098 W4b）：
 * 8 手柄拉伸、框体移动 → onBoxCommit；空白拖拽画新框 → onNewBox；
 * Ctrl/Shift 多选 → onMultiSelect；regionDraft 本地预览（新框虚线、删除淡出、合并并集）。
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPane(extra: Record<string, unknown> = {}) {
  return render(
    <PageImagePane
      bookId="b"
      pageNo={1}
      blocks={blocks}
      selectedIndex={0}
      hoveredIndex={-1}
      zoom={100}
      onSelect={() => {}}
      onHover={() => {}}
      boxEdit
      regionDraft={{ added: [], deleted: [], merged: [] }}
      onBoxCommit={vi.fn()}
      onNewBox={vi.fn()}
      onMultiSelect={vi.fn()}
      {...extra}
    />,
  );
}

describe('框编辑交互（口径=框图）', () => {
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

  it('Ctrl/Shift 点框 → onMultiSelect，不当作单选', () => {
    const onMultiSelect = vi.fn();
    const onSelect = vi.fn();
    renderPane({ onMultiSelect, onSelect });
    fireEvent.click(screen.getByLabelText('bbox 2'), { ctrlKey: true });
    expect(onMultiSelect).toHaveBeenCalledWith(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('空白拖拽画新框 → onNewBox(像素 bbox)；微动不算画框', () => {
    const onNewBox = vi.fn();
    const { container } = renderPane({ onNewBox });
    const pane = container.querySelector('[data-testid="page-image-1"]') as HTMLElement;
    fireEvent.mouseDown(pane, { clientX: 600, clientY: 600, button: 0 });
    fireEvent.mouseMove(window, { clientX: 700, clientY: 680 });
    fireEvent.mouseUp(window, { clientX: 700, clientY: 680 });
    expect(onNewBox.mock.calls[0][0]).toEqual([600, 600, 700, 680]);
    onNewBox.mockClear();
    fireEvent.mouseDown(pane, { clientX: 650, clientY: 650, button: 0 });
    fireEvent.mouseUp(window, { clientX: 651, clientY: 651 });
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

  it('口径非框图（boxEdit=false）：无手柄、拖拽不画新框', () => {
    const onNewBox = vi.fn();
    const { container } = render(
      <PageImagePane
        bookId="b"
        pageNo={1}
        blocks={blocks}
        selectedIndex={0}
        hoveredIndex={-1}
        zoom={100}
        onSelect={() => {}}
        onHover={() => {}}
        boxEdit={false}
        regionDraft={{ added: [], deleted: [], merged: [] }}
        onNewBox={onNewBox}
      />,
    );
    expect(screen.queryByTestId('handle-se')).toBeNull();
    const pane = container.querySelector('[data-testid="page-image-1"]') as HTMLElement;
    fireEvent.mouseDown(pane, { clientX: 600, clientY: 600, button: 0 });
    fireEvent.mouseMove(window, { clientX: 700, clientY: 700 });
    fireEvent.mouseUp(window, { clientX: 700, clientY: 700 });
    expect(onNewBox).not.toHaveBeenCalled();
  });
});
