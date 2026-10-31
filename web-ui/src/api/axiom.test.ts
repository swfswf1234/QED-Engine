/**
 * 块编辑提交体的前端形状（REQ-142 W5）：`/edit` 门面按「带上的键才发」组装，
 * 类型改判走 `corrected_type` 一键——本层静默丢键＝人工改标注整条通路断掉，且 8900 无从察觉。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetch } from '../test/setup';
import { putBlockEdit } from './axiom';
import { API_BASE } from './client';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const sentBody = () => JSON.parse(String(mockFetch.mock.calls[0][1].body)) as Record<string, unknown>;

describe('putBlockEdit 提交体（键按需出现）', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => jsonResponse({ book_id: 'b1', page_no: 3, block_index: 2 }));
  });

  it('路径＝8900 门面逐字（PUT /books/{id}/pages/{no}/blocks/{i}/edit）', async () => {
    await putBlockEdit('b1', 3, 2, { corrected_type: 'header' });
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/books/b1/pages/3/blocks/2/edit`);
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
  });

  it('类型改判只带 corrected_type 一键，不夹带未提交的文字/范围', async () => {
    await putBlockEdit('b1', 3, 2, { corrected_type: 'header' });
    expect(sentBody()).toEqual({ corrected_type: 'header' });
  });

  it('不带 corrected_type 时该键不出现（PUT 整条替换，缺席＝不改判）', async () => {
    await putBlockEdit('b1', 3, 2, { corrected_text: '新文', note: '备注' });
    expect(sentBody()).toEqual({ note: '备注', corrected_text: '新文' });
  });
});
