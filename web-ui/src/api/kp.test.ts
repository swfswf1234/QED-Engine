/**
 * `af_kp` 透传面的前端形状（REQ-141 批次 F・W3 契约形状腿）
 * 守护三件事：一比一镜像（路径与对方 8902 逐字等，本表与壳的镜像表同序，起别名即红）、
 * 只写人工可写的列（背书域白名单，缺席的键不出现）、乐观并发的两种用法
 * （`if_rev`＝比序号，缺省＝不比）。
 *
 * 本文件只钉形状与镜像，一条都不真打上游：8900 的十条透传腿已由 REQ-143 W6／W25 在册。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetch } from '../test/setup';
import {
  KP_MIRROR, confirmKpNode, createKpJob, getKpExport, getKpJobProgress, getKpNarrative,
  getKpWorkspace, patchKpNode, putKpNarrative, putKpOutline, regenerateKpSummary,
} from './kp';
import { API_BASE } from './client';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('af_kp 透传面（一比一镜像＋背书域白名单）', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('镜像表十条：方法＋路径逐字等（本表即壳的透传面镜像表）', () => {
    expect(KP_MIRROR.map((row) => `${row.method} ${row.path}`)).toEqual([
      'POST /api/v1/kp-jobs',
      'GET /api/v1/books/{book_id}/kp-jobs/{gen_batch}',
      'GET /api/v1/books/{book_id}/kp',
      'PATCH /api/v1/kp/nodes/{node_id}',
      'POST /api/v1/kp/nodes/{node_id}/confirm',
      'POST /api/v1/kp/nodes/{node_id}/summary',
      'PUT /api/v1/kp/nodes/{node_id}/narrative',
      'GET /api/v1/kp/nodes/{node_id}/narrative',
      'PUT /api/v1/books/{book_id}/kp/outline',
      'GET /api/v1/books/{book_id}/kp/export',
    ]);
  });

  it('提交批次不带 engine 与逐页键（引擎取服务端槽位，页区间只用起止两键）', async () => {
    mockFetch.mockImplementation(() => jsonResponse(
      { book_id: 'b05', gen_batch: 'afkp-2f1c', evidence_job_id: 'job-1', page_start: 1, page_end: 12, status: 'queued' },
      202,
    ));
    const out = await createKpJob({ book_id: 'b05', page_start: 1, page_end: 12 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/kp-jobs`);
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({ book_id: 'b05', page_start: 1, page_end: 12 });
    expect(out.gen_batch).toBe('afkp-2f1c');
  });

  it('人工评审备注原样上送（对方 PLAN-026 W11＝四键闭集里的 `review_note`；空备注不发这一键）', async () => {
    mockFetch.mockImplementation(() => jsonResponse(
      { book_id: 'b05', gen_batch: 'afkp-2f1c', evidence_job_id: 'job-1', page_start: 6, page_end: 12, status: 'queued' },
      202,
    ));
    await createKpJob({ book_id: 'b05', page_start: 6, page_end: 12, review_note: '第 3 章的节标题把书眉粘进来了' });
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body)))
      .toEqual({ book_id: 'b05', page_start: 6, page_end: 12, review_note: '第 3 章的节标题把书眉粘进来了' });
    await createKpJob({ book_id: 'b05' });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1].body))).toEqual({ book_id: 'b05' });
  });

  it('进度与整册工作区＝不分页的整册读面（空 nodes 是合法现状，不是 404）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({
      book_id: 'b05', gen_batch: 'afkp-2f1c', in_flight: true, counts: { draft: 3 },
      ledger: { gen_batch: 'afkp-2f1c', book_id: 'b05', job_id: 'job-1', status: 'ok', review_note: '剔掉书眉' },
    }));
    const progress = await getKpJobProgress('b05', 'afkp-2f1c');
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/books/b05/kp-jobs/afkp-2f1c`);
    expect(progress.in_flight).toBe(true);
    // 流水行的备注恒发（缺省空串）＝这一批人工说过什么，可指认（对方 `KA-31`）
    expect(progress.ledger?.review_note).toBe('剔掉书眉');
    mockFetch.mockImplementation(() => jsonResponse({ book_id: 'b05', in_flight_batch: null, nodes: [], review_flags: [] }));
    const workspace = await getKpWorkspace('b05');
    expect(mockFetch.mock.calls[1][0]).toBe(`${API_BASE}/books/b05/kp`);
    expect(workspace.in_flight_batch).toBeNull();
    expect(workspace.nodes).toEqual([]);
  });

  it('背书域写入只发被点名的键；parent_id 的显式 null 原样送出（＝退未归档池）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ node_id: 'afkp-1', name: '改名', confirmed: 0, rev: 2 }));
    await patchKpNode('afkp-1', { name: '改名', if_rev: 1 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/kp/nodes/afkp-1`);
    expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({ name: '改名', if_rev: 1 });
    await patchKpNode('afkp-1', { parent_id: null, role: 'core' });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1].body))).toEqual({ parent_id: null, role: 'core' });
  });

  it('确认置位与撤回同一条腿（422 与 200 同形 ⇒ 界面判 missing 不判状态码）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ node_id: 'afkp-1', confirmed: 0, rev: 1, missing: ['锚点页 999 不在取证版本的页集内'] }));
    const out = await confirmKpNode('afkp-1', { confirmed: true, if_rev: 1 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/kp/nodes/afkp-1/confirm`);
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({ confirmed: true, if_rev: 1 });
    expect(out.missing).toHaveLength(1);
    await confirmKpNode('afkp-1', { confirmed: false });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1].body))).toEqual({ confirmed: false });
  });

  it('单点重生成只送 if_rev（同步长调用，超时放宽到 360s 与 8900→8902 同界）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({
      node_id: 'afkp-1', summary: '重写过的总结', rev: 5,
    }));
    const out = await regenerateKpSummary('afkp-1', { if_rev: 4 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/kp/nodes/afkp-1/summary`);
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({ if_rev: 4 });
    expect(out.summary).toBe('重写过的总结');
    expect(out.rev).toBe(5);
    await regenerateKpSummary('afkp-1', {});
    expect(JSON.parse(String(mockFetch.mock.calls[1][1].body))).toEqual({});
  });

  it('长文两条腿：写腿只送 content 与 if_rev；读腿的缺文件是 exists=false 不是异常', async () => {
    mockFetch.mockImplementation(() => jsonResponse({
      node_id: 'afkp-1', narrative_ref: 'afkp-1.md', exists: true,
      content: '这一节先讲一致收敛的判别法。', bytes: 45, rev: 4, updated_at: null,
    }));
    const written = await putKpNarrative('afkp-1', { content: '这一节先讲一致收敛的判别法。', if_rev: 3 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/kp/nodes/afkp-1/narrative`);
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body)))
      .toEqual({ content: '这一节先讲一致收敛的判别法。', if_rev: 3 });
    expect(written.exists).toBe(true);
    expect(written.rev).toBe(4);
    mockFetch.mockImplementation(() => jsonResponse({
      node_id: 'afkp-1', narrative_ref: '', exists: false, content: '', bytes: 0, rev: 4, updated_at: null,
    }));
    const read = await getKpNarrative('afkp-1');
    expect(mockFetch.mock.calls[1][0]).toBe(`${API_BASE}/kp/nodes/afkp-1/narrative`);
    expect(mockFetch.mock.calls[1][1].method).toBe('GET');
    expect(read.exists).toBe(false);
    expect(read.content).toBe('');
  });

  it('目录整批声明的声明项只有身份与挂载（没有 depth／name）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ book_id: 'b05', outline: [], detached_points: 2 }));
    const out = await putKpOutline('b05', [
      { node_id: 'afkp-a', parent_id: null, order_hint: 1 },
      { node_id: 'afkp-b', parent_id: 'afkp-a', order_hint: 2 },
    ]);
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/books/b05/kp/outline`);
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({
      declarations: [
        { node_id: 'afkp-a', parent_id: null, order_hint: 1 },
        { node_id: 'afkp-b', parent_id: 'afkp-a', order_hint: 2 },
      ],
    });
    expect(out.detached_points).toBe(2);
  });

  it('已确认视图导出＝只读拉取面（空集 200＋total 0）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ book_id: 'b05', nodes: [], review_flags: [], total: 0 }));
    const out = await getKpExport('b05');
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/books/b05/kp/export`);
    expect(out.total).toBe(0);
  });
});
