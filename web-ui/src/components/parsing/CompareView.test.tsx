/**
 * 双栏对照区右栏接线守护（REQ-138 W2·P2）：解析栏的 image 块必须拿到 8900 页图地址做 bbox 内联裁切，
 * 而不是只出题注（「文字与图片按每页准确渲染」口径在对照视图右栏的断链）。
 * 判据只在「接线」一层：裁切本身的换算与回退由 BlockList.test.tsx 覆盖。
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CompareView from './CompareView';
import { bookPageImageUrl } from '../../api/axiom';
import type { BookMeta } from '../../api/axiom';
import { useParsingStore, type PageEntry } from '../../stores/parsing';

const book: BookMeta = {
  book_id: 'b05', title: '高等数学', author: '', page_count: 5, sha256: '', strategy: 'local',
  ingest_status: 'ingested', file_path: 'books/高数.pdf',
};

const entry: PageEntry = {
  data: {
    page_no: 32,
    image_url: bookPageImageUrl('b05', 32),
    markdown: '',
    blocks: [{ type: 'image', bbox: [100, 200, 500, 400], text: '图 1 示意' }],
  },
  parsed: true,
  loading: false,
  error: null,
};

const snapshot = useParsingStore.getState();

beforeEach(() => {
  useParsingStore.setState({
    pages: { 32: entry },
    compareBookId: 'b05',
    compareBook: book,
    comparePageNo: 32,
    selectedBlock: -1,
    editMode: false,
    editPane: 'content',
    regionDraft: { added: [], deleted: [], merged: [] },
    drawMode: false,
  });
});

afterEach(() => {
  cleanup();
  useParsingStore.setState(snapshot);
});

function renderPair(renderMode: 'stream' | 'layout') {
  return render(
    <CompareView
      book={book}
      pageNo={32}
      entry={entry}
      scrollMode="single"
      syncScroll={false}
      renderMode={renderMode}
    />,
  );
}

describe('解析栏 image 块＝8900 页图内联裁切（P2 接线）', () => {
  it('流式模式：右栏出裁切图，src 指向该书该页的 8900 页图端点', () => {
    const { container } = renderPair('stream');
    const crop = screen.getByTestId('block-image-crop');
    const img = container.querySelector('img[alt="块图（页图裁切）"]') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(bookPageImageUrl('b05', 32));
    expect(crop).toBeTruthy();
  });

  it('版式重排模式：同样出裁切图（两模式共用 blockBody）', () => {
    const { container } = renderPair('layout');
    expect(container.querySelector('img[alt="块图（页图裁切）"]')).toBeTruthy();
  });
});
