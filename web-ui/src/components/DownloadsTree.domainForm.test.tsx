/**
 * 领域维护表单口径测试（downloads-ui.md §3.1，2026-09-30 用户裁决）
 * - 三处入口字段集合与顺序统一：领域名 → 领域描述 → 学科知识 → 探索范围 → 学习阶段
 * - 默认值：描述随领域名插值（未输领域名时留空带占位提示）、学科知识默认句、
 *   探索范围 本科-硕士、学习阶段四档
 * - 标签唯一口径：「探索范围」只用于 level，scope 一律称「学科知识」；描述三处非必填
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import DownloadsTree from './DownloadsTree';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useDownloadsStore } from '../stores/downloads';
import type { DomainSystem } from '../stores';

const FIELD_ORDER = ['领域名', '领域描述', '学科知识', '探索范围', '学习阶段'];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function domainFixture(overrides?: Partial<DomainSystem>): DomainSystem {
  return {
    domain_id: 'dm1',
    name: '高等数学',
    description: '',
    scope: '',
    level: '本科',
    stages: ['基础'],
    classic_tracks: [],
    courses: [],
    exploration_stage: '未开始',
    explore_pending: null,
    ...overrides,
  } as DomainSystem;
}

function seed(domains: DomainSystem[]) {
  useDownloadsStore.setState({
    domains, knowledge: [], details: {}, paperBooks: [],
    systemError: null, knowledgeError: null, error: null, selected: null,
  });
}

function renderTree() {
  return render(
    <ConfigProvider theme={theme}><AntApp><DownloadsTree /></AntApp></ConfigProvider>,
  );
}

/** 字段顺序断言：五个标签在 DOM 中依序出现（-1 表示缺失） */
function assertFieldOrder(scope: HTMLElement) {
  const texts = Array.from(scope.querySelectorAll('label')).map((l) => l.textContent ?? '');
  const idx = FIELD_ORDER.map((word) => texts.findIndex((t) => t.includes(word)));
  expect(idx.includes(-1), `缺失字段：${FIELD_ORDER.join('/')} → ${JSON.stringify(texts)}`).toBe(false);
  for (let i = 1; i < idx.length; i += 1) {
    expect(idx[i]).toBeGreaterThan(idx[i - 1]);
  }
}

function domainPostBodies(): Record<string, unknown>[] {
  return mockFetch.mock.calls
    .filter(([url, init]) => String(url).endsWith('/domains') && (init as RequestInit)?.method === 'POST')
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
}

describe('添加领域弹窗（§3.1 字段口径与默认值）', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith('/domains') && init?.method === 'POST') {
        return Promise.resolve(json({ domain_id: 'dm9', name: '新领域' }));
      }
      return Promise.resolve(json([]));
    });
  });

  it('字段集合与顺序＝领域名→领域描述→学科知识→探索范围→学习阶段，且无「探索范围（scope）」撞名', async () => {
    seed([]);
    renderTree();
    fireEvent.click(screen.getByRole('button', { name: '添加领域' }));
    const dialog = await screen.findByRole('dialog');
    assertFieldOrder(dialog);
    expect(dialog.textContent).not.toContain('探索范围（scope）');
  });

  it('默认值：探索范围 本科-硕士、学习阶段四档、学科知识默认句、描述留空并给占位模板', async () => {
    seed([]);
    renderTree();
    fireEvent.click(screen.getByRole('button', { name: '添加领域' }));
    await screen.findByRole('dialog');
    expect((screen.getByLabelText(/探索范围/) as HTMLInputElement).value).toBe('本科-硕士');
    expect((screen.getByLabelText(/学习阶段/) as HTMLInputElement).value).toBe('基础,主干,分支,前沿');
    const scope = screen.getByLabelText(/学科知识/) as HTMLTextAreaElement;
    expect(scope.value).toContain('美国主流高校');
    expect(scope.value).toContain('本科—硕士');
    const desc = screen.getByLabelText(/领域描述/) as HTMLTextAreaElement;
    expect(desc.value).toBe('');
    expect(desc.placeholder).toContain('{领域名}');
  });

  it('领域描述随领域名插值自动填充；用户手改后不再被覆盖', async () => {
    seed([]);
    renderTree();
    fireEvent.click(screen.getByRole('button', { name: '添加领域' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText(/领域名/), { target: { value: '抽象代数' } });
    const desc = screen.getByLabelText(/领域描述/) as HTMLTextAreaElement;
    expect(desc.value.startsWith('抽象代数：本次新增的待探索领域')).toBe(true);

    fireEvent.change(desc, { target: { value: '我自己写的定位说明' } });
    fireEvent.change(screen.getByLabelText(/领域名/), { target: { value: '抽象代数与拓扑' } });
    expect((screen.getByLabelText(/领域描述/) as HTMLTextAreaElement).value).toBe('我自己写的定位说明');
  });

  it('描述非必填：仅填领域名即可创建，提交体带四字段默认值', async () => {
    seed([]);
    renderTree();
    fireEvent.click(screen.getByRole('button', { name: '添加领域' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText(/领域名/), { target: { value: '复分析' } });
    fireEvent.click(screen.getByRole('button', { name: /创\s*建/ }));
    await waitFor(() => {
      expect(domainPostBodies().length).toBeGreaterThan(0);
    });
    const body = domainPostBodies()[0];
    expect(body.name).toBe('复分析');
    expect(String(body.description).startsWith('复分析：本次新增的待探索领域')).toBe(true);
    expect(body.level).toBe('本科-硕士');
    expect(body.stages).toEqual(['基础', '主干', '分支', '前沿']);
    expect(String(body.scope)).toContain('美国主流高校');
  });
});

describe('右键「编辑领域知识」弹窗（同口径）', () => {
  beforeEach(() => {
    mockFetch.mockImplementation(() => Promise.resolve(json({ domain_id: 'dm1' })));
  });

  it('字段顺序与添加弹窗一致，探索范围回填 level、学科知识回填 scope', async () => {
    seed([domainFixture({ level: '本科-硕士', scope: '用户自定义边界' })]);
    renderTree();
    fireEvent.contextMenu(screen.getByText('高等数学'));
    fireEvent.click(await screen.findByText('编辑领域知识'));
    const dialog = await screen.findByRole('dialog');
    assertFieldOrder(dialog);
    expect((screen.getByLabelText(/探索范围/) as HTMLInputElement).value).toBe('本科-硕士');
    expect((screen.getByLabelText(/学科知识/) as HTMLTextAreaElement).value).toBe('用户自定义边界');
    expect(dialog.textContent).not.toContain('探索范围（scope）');
  });
});
