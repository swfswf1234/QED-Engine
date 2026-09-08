import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Form, Input, Modal, Select, Space, Switch, Tag, Typography,
} from 'antd';
import { ReloadOutlined, CloudServerOutlined, EyeOutlined } from '@ant-design/icons';
import DownloadsTree from '../components/DownloadsTree';
import ExploreFlowModal from '../components/ExploreFlowModal';
import DomainConfirmModal from '../components/DomainConfirmModal';
import CourseConfirmModal from '../components/CourseConfirmModal';
import { describeError } from '../api/client';
import DomainCard from '../components/DomainCard';
import { startDomainExplore, confirmDomainInfo, confirmCourseKnowledge } from '../api/explore-helpers';
import {
  confirmKnowledge, completeKnowledge, rejectKnowledge, supersedeKnowledge,
  createBook, decideBook, startBook, failBook, retryBook, verifyBook,
  rejectBook, supersedeBook, registerBook, listBookSources, addBookSource,
} from '../api/tracker';
import { STAGE_OPTIONS, bookInStage, sortBooks, tutorialLabel, useDownloadsStore } from '../stores/downloads';
import { useExploreUiStore } from '../stores/explore';
import type { BookRecord, CourseRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord, SourceRecord } from '../stores';
import '../downloads.css';

const { Title, Text } = Typography;

// --- 教程状态/角色中文映射（五层模型；状态筛选已收敛为书行阶段，见 store STAGE_OPTIONS） ---

const KNOWLEDGE_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: '探索中', color: 'default' },
  confirmed: { label: '已定稿', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
};

const KNOWLEDGE_KIND_LABELS: Record<string, string> = {
  tutorial: '教程套系',
  other_material: '延展资料',
};

const BOOK_KIND_LABELS: Record<string, string> = {
  textbook: '教材', exercise: '习题集', supplement: '配套资料', solutions: '题解', paper: '论文', blog: '博客', other: '其他',
};

const BOOK_STATUS: Record<string, { label: string; color: string }> = {
  candidate: { label: '候选', color: 'default' },
  decided: { label: '已决定', color: 'blue' },
  downloading: { label: '下载中', color: 'orange' },
  downloaded: { label: '已下载', color: 'cyan' },
  verified: { label: '已验证', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

const ROLE_LABELS: Record<string, string> = {
  textbook: '教材', exercise: '习题', exercises: '习题集', solutions: '题解', reference: '参考', supplement: '配套资料',
};

const SOURCE_CHANNEL_OPTIONS = [
  { value: 'manual', label: '人工' },
  { value: 'libgen_li', label: '图书馆链接' },
  { value: 'internet_archive', label: '互联网档案馆' },
  { value: 'open_library', label: '开放图书馆' },
  { value: 'google_books', label: '谷歌图书' },
];

function roleLabel(roles: string[]): string {
  return (roles ?? []).map((r) => ROLE_LABELS[r] ?? r).join('&') || '书目';
}

function versionText(v: Record<string, unknown> | null | undefined): string {
  if (!v) return '';
  const edition = v.edition ? String(v.edition) : '';
  const year = v.year ? String(v.year) : '';
  return [edition, year].filter(Boolean).join(' · ');
}

/** 全部课程扁平视图（真实领域体系；FilterBar / 右面板名称回显共用） */
function useCourseIndex(): { byId: Map<string, CourseRecord & { domainId: string; domainName: string }>; domains: DomainSystem[] } {
  const domains = useDownloadsStore((s) => s.domains);
  return useMemo(() => {
    const byId = new Map<string, CourseRecord & { domainId: string; domainName: string }>();
    for (const d of domains) {
      for (const c of d.courses) byId.set(c.course_id, { ...c, domainId: d.domain_id, domainName: d.name });
    }
    return { byId, domains };
  }, [domains]);
}

// --- 筛选栏 ---

function FilterBar() {
  const filters = useDownloadsStore((s) => s.filters);
  const setFilter = useDownloadsStore((s) => s.setFilter);
  const knowledge = useDownloadsStore((s) => s.knowledge);
  const { byId, domains } = useCourseIndex();

  const courseOptions = useMemo(() => {
    const ids = new Set<string>(byId.keys());
    for (const k of knowledge) ids.add(k.course_id);
    return [...ids].sort().map((cid) => ({ value: cid, label: byId.get(cid)?.name ?? cid }));
  }, [byId, knowledge]);

  // 领域筛选项：真实体系领域优先，知识行残留域兜底（数据一致性边缘）
  const domainOptions = useMemo(() => {
    const options = domains.map((d) => ({ value: d.domain_id, label: d.name }));
    const known = new Set(domains.map((d) => d.domain_id));
    for (const k of knowledge) {
      if (!known.has(k.domain_id)) {
        known.add(k.domain_id);
        options.push({ value: k.domain_id, label: k.domain_id });
      }
    }
    return options;
  }, [domains, knowledge]);

  return (
    <Space size={8} wrap>
      <Text type="secondary">筛选</Text>
      <Select
        allowClear placeholder="领域" style={{ width: 130 }} aria-label="领域筛选"
        value={filters.domain || undefined}
        options={domainOptions}
        onChange={(v) => setFilter('domain', v ?? '')}
      />
      <Select
        allowClear placeholder="课程" style={{ width: 190 }} aria-label="课程筛选"
        value={filters.course || undefined}
        options={courseOptions}
        onChange={(v) => setFilter('course', v ?? '')}
      />
      <Select
        allowClear placeholder="状态" style={{ width: 120 }} aria-label="状态筛选"
        value={filters.stage || undefined}
        options={[...STAGE_OPTIONS]}
        onChange={(v) => setFilter('stage', v ?? '')}
      />
    </Space>
  );
}

// --- 通用弹窗 ---

/** 原因弹窗（reject / supersede 必填 reason；书行 reject 可选 note） */
function ReasonModal({ open, title, withNote, onCancel, onSubmit }: {
  open: boolean;
  title: string;
  withNote: boolean;
  onCancel: () => void;
  onSubmit: (reason: string, note?: string) => void;
}) {
  const [form] = Form.useForm();
  return (
    <Modal
      title={title} open={open} onCancel={onCancel} destroyOnClose
      onOk={() => {
        form.validateFields().then((values) => onSubmit(values.reason, values.note));
      }}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="reason" label="原因（必填，留痕可追溯）" rules={[{ required: true, message: '请填写原因' }]}>
          <Input.TextArea rows={2} placeholder="如：扫描缺页 / 版本过旧" />
        </Form.Item>
        {withNote && (
          <Form.Item name="note" label="审理备注（可选）">
            <Input.TextArea rows={2} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

/** 知识行确认弹窗（draft→confirmed：决定引用 + 简介） */
function KnowledgeConfirmModal({ knowledge, onCancel, onSubmit }: {
  knowledge: KnowledgeRecord | null;
  onCancel: () => void;
  onSubmit: (values: {
    textbook_ref?: Record<string, unknown>;
    exercise_ref?: Record<string, unknown>;
    textbook_intro?: string;
    exercise_intro?: string;
  }) => void;
}) {
  const [form] = Form.useForm();
  const ref = knowledge?.textbook_ref ?? {};
  return (
    <Modal
      title={`确认教程：${knowledge ? tutorialLabel(knowledge) : ''}`}
      open={knowledge !== null}
      onCancel={onCancel}
      destroyOnClose
      onOk={() =>
        form.validateFields().then((v: { tb_title?: string; ex_title?: string; textbook_intro?: string; exercise_intro?: string }) => {
          // 2026-08-24 用户裁决：版本字段取消；书名预填（后端 adopt 落库推荐值后自动带出，中文优先）
          // 修复：此前表单平铺字段从未映射为嵌套 ref，决定引用实际未被提交过
          const tb = v.tb_title?.trim() ? { title: v.tb_title.trim() } : undefined;
          const ex = v.ex_title?.trim() ? { title: v.ex_title.trim() } : undefined;
          onSubmit({
            ...(tb ? { textbook_ref: tb } : {}),
            ...(ex ? { exercise_ref: ex } : {}),
            textbook_intro: v.textbook_intro ?? '',
            exercise_intro: v.exercise_intro ?? '',
          });
        })
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          tb_title: (ref.title as string) ?? '',
          ex_title: (knowledge?.exercise_ref?.title as string) ?? '',
          textbook_intro: knowledge?.textbook_intro ?? '',
          exercise_intro: knowledge?.exercise_intro ?? '',
        }}
      >
        <Text type="secondary">定稿后进入已定稿状态，可继续组织书行下载。书名/简介默认取探索推荐（可修订）。</Text>
        <Form.Item name="tb_title" label="教材决定引用 · 书名" style={{ marginTop: 12 }}>
          <Input placeholder="如：数学分析（中文优先）" />
        </Form.Item>
        <Form.Item name="ex_title" label="习题集决定引用 · 书名">
          <Input placeholder="如：数学分析习题集（中文优先）" />
        </Form.Item>
        <Form.Item name="textbook_intro" label="教材简介">
          <Input.TextArea rows={2} placeholder="指引检索（LLM 预填 + 人工审）" />
        </Form.Item>
        <Form.Item name="exercise_intro" label="习题集简介">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** 登记下载弹窗（人工下载 → register） */
function RegisterModal({ book, onCancel, onSubmit }: {
  book: BookRecord | null;
  onCancel: () => void;
  onSubmit: (relativePath: string) => void;
}) {
  const [form] = Form.useForm();
  return (
    <Modal
      title={`人工下载登记：${book?.display_title ?? ''}`}
      open={book !== null}
      onCancel={onCancel}
      destroyOnClose
      onOk={() => form.validateFields().then((v) => onSubmit(v.relative_path))}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="relative_path" label="数据根内相对路径（必填，PDF 校验在 8901 侧）"
          rules={[{ required: true, message: '请填写数据根内相对路径' }]}
        >
          <Input placeholder="如：raw/books/math-qe/01_math_analysis/v1.pdf" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// --- 书行详情弹窗（4c：书行信息 + 渠道尝试列表 + 添加渠道） ---

function BookDetailModal({ book, onClose }: { book: BookRecord | null; onClose: () => void }) {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const loadSources = useCallback(async (bookId: string) => {
    setLoading(true);
    const [list, err] = await listBookSources(bookId)
      .then((s) => [s, null] as const)
      .catch((e) => [null, e] as const);
    setSources(list ?? []);
    setSourcesError(err ? describeError(err) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (book) void loadSources(book.book_id);
  }, [book, loadSources]);

  if (!book) return null;
  const v = { edition: book.edition, year: book.year };
  return (
    <Modal
      title={book.display_title}
      open onCancel={onClose} footer={null} width={720}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div>
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color={BOOK_STATUS[book.status]?.color}>{BOOK_STATUS[book.status]?.label ?? book.status}</Tag>
            <Tag>{book.kind && BOOK_KIND_LABELS[book.kind] ? BOOK_KIND_LABELS[book.kind] : book.kind}</Tag>
            <Tag>{roleLabel(book.roles)}</Tag>
          </Space>
          <div className="dl-book-meta">
            {book.authors?.length > 0 && <div>作者：{book.authors.join(' / ')}</div>}
            {versionText(v) && <div>版本：{versionText(v)}</div>}
            {book.language && <div>语言：{book.language}</div>}
            {book.page_count != null && <div>页数：{book.page_count}</div>}
            {book.sha256 && <div>sha256：<Text code>{book.sha256}</Text></div>}
            {book.relative_path && <div>数据根路径：{book.relative_path}</div>}
            {book.absolute_path && <div>绝对路径：{book.absolute_path}</div>}
            {book.reject_reason && <div>否定原因：{book.reject_reason}</div>}
            {book.review_note && <div>审理备注：{book.review_note}</div>}
            {book.original_url && <div>原始来源：<a href={book.original_url} target="_blank" rel="noreferrer">{book.original_url}</a></div>}
          </div>
        </div>

        <div>
          <Text strong>渠道尝试（{sources.length}）</Text>
          <Button size="small" style={{ marginLeft: 8 }} onClick={() => void loadSources(book.book_id)} loading={loading}>
            刷新
          </Button>
          {sourcesError && <div className="dl-book-meta" style={{ color: '#cf1322' }}>{sourcesError}</div>}
          {sources.length === 0 && !sourcesError && <div className="dl-books-empty">暂无渠道尝试记录</div>}
          {sources.map((s) => (
            <div key={s.source_id} className="dl-book-meta" style={{ marginTop: 4 }}>
              <Space size={6}>
                <Tag color={s.ok ? 'green' : 'default'}>{s.ok ? '成功' : '失败'}</Tag>
                <span>{SOURCE_CHANNEL_OPTIONS.find((c) => c.value === s.channel)?.label ?? s.channel}</span>
                {s.page_url && <a href={s.page_url} target="_blank" rel="noreferrer">页面</a>}
                {s.download_url && <a href={s.download_url} target="_blank" rel="noreferrer">下载链接</a>}
                {s.note && <span>（{s.note}）</span>}
              </Space>
            </div>
          ))}
        </div>

        <div>
          <Text strong>添加渠道尝试</Text>
          <Form
            form={form}
            layout="vertical"
            style={{ marginTop: 8 }}
            initialValues={{ channel: 'manual', ok: false }}
            onFinish={async (values) => {
              try {
                await addBookSource(book.book_id, {
                  channel: values.channel,
                  page_url: values.page_url ?? '',
                  download_url: values.download_url ?? '',
                  file_keywords: values.file_keywords ?? '',
                  ok: values.ok === true,
                  note: values.note ?? '',
                });
                message.success('渠道尝试已登记');
                form.resetFields();
                void loadSources(book.book_id);
              } catch (err) {
                message.error(describeError(err));
              }
            }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space wrap>
                <Form.Item name="channel" noStyle>
                  <Select style={{ width: 140 }} options={SOURCE_CHANNEL_OPTIONS} aria-label="渠道" />
                </Form.Item>
                <Form.Item name="ok" valuePropName="checked" noStyle>
                  <Switch checkedChildren="成功" unCheckedChildren="失败" aria-label="成败" />
                </Form.Item>
              </Space>
              <Form.Item name="page_url" noStyle><Input placeholder="页面地址 page_url" /></Form.Item>
              <Form.Item name="download_url" noStyle><Input placeholder="下载地址 download_url" /></Form.Item>
              <Form.Item name="file_keywords" noStyle><Input placeholder="检索关键词 file_keywords" /></Form.Item>
              <Form.Item name="note" noStyle><Input placeholder="备注 note" /></Form.Item>
              <Button type="primary" size="small" htmlType="submit">登记渠道</Button>
            </Space>
          </Form>
        </div>
      </Space>
    </Modal>
  );
}

// --- 书行卡片（4b） ---

function BookCard({ book, onAction, onDetail, onRegister }: {
  book: BookRecord;
  onAction: (action: 'decide' | 'start' | 'fail' | 'retry' | 'verify' | 'reject' | 'supersede') => void;
  onDetail: (book: BookRecord) => void;
  onRegister: (book: BookRecord) => void;
}) {
  const v = { edition: book.edition, year: book.year };
  return (
    <div className="dl-book-card">
      <div className="dl-book-title" title={book.display_title}>{book.display_title}</div>
      <div>
        <Space wrap size={4}>
          <Tag color={BOOK_STATUS[book.status]?.color} style={{ marginRight: 0 }}>
            {BOOK_STATUS[book.status]?.label ?? book.status}
          </Tag>
          <Tag style={{ marginRight: 0 }}>{roleLabel(book.roles)}</Tag>
        </Space>
      </div>
      <div className="dl-book-meta">
        {book.authors?.length > 0 && <div>{book.authors.join(' / ')}</div>}
        {versionText(v) && <div>{versionText(v)}</div>}
        {book.page_count != null && <div>页数：{book.page_count}</div>}
        {book.reject_reason && <div>否定原因：{book.reject_reason}</div>}
      </div>
      <div className="dl-book-actions">
        {book.status === 'candidate' && (
          <>
            <Button size="small" type="primary" ghost onClick={() => onAction('decide')}>决定</Button>
            <Button size="small" onClick={() => onRegister(book)}>登记下载</Button>
          </>
        )}
        {book.status === 'decided' && (
          <Button size="small" type="primary" ghost onClick={() => onAction('start')}>开始下载</Button>
        )}
        {book.status === 'downloading' && (
          <Button size="small" onClick={() => onAction('fail')}>标记失败</Button>
        )}
        {book.status === 'failed' && (
          <Button size="small" type="primary" ghost onClick={() => onAction('retry')}>重试</Button>
        )}
        {book.status === 'downloaded' && (
          <Button size="small" type="primary" ghost onClick={() => onAction('verify')}>验收</Button>
        )}
        {(book.status === 'candidate' || book.status === 'decided' || book.status === 'downloaded') && (
          <>
            <Button size="small" onClick={() => onAction('reject')}>否定</Button>
            <Button size="small" onClick={() => onAction('supersede')}>过时</Button>
          </>
        )}
        <Button size="small" icon={<EyeOutlined />} onClick={() => onDetail(book)}>详情</Button>
      </div>
    </div>
  );
}

// --- 教程行区（教程 + 书行卡片横排 + 操作闭环 4d） ---

function KnowledgeSection({ knowledge, detail, run }: {
  knowledge: KnowledgeRecord;
  detail: KnowledgeDetail | undefined;
  run: (p: Promise<unknown>, successText: string, knowledgeId: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [knReasonOpen, setKnReasonOpen] = useState(false);
  const [knReasonAction, setKnReasonAction] = useState<'reject' | 'supersede'>('reject');
  const [registerTarget, setRegisterTarget] = useState<BookRecord | null>(null);
  const [detailBook, setDetailBook] = useState<BookRecord | null>(null);
  const [bookReason, setBookReason] = useState<{ action: 'reject' | 'supersede'; book: BookRecord } | null>(null);

  /** 按决定引用生成候选书行（教材 kind=textbook / 习题集 kind=exercise）；返回生成数 */
  const genBooksFromRefs = async (): Promise<number> => {
    const tbTitle = String(knowledge.textbook_ref?.title ?? '').trim();
    const exTitle = String(knowledge.exercise_ref?.title ?? '').trim();
    let n = 0;
    if (tbTitle) {
      await createBook({ knowledge_id: knowledge.knowledge_id, title: tbTitle, kind: 'textbook', roles: ['textbook'], part: '', authors: [] });
      n += 1;
    }
    if (exTitle) {
      await createBook({ knowledge_id: knowledge.knowledge_id, title: exTitle, kind: 'exercise', roles: ['exercise'], part: '', authors: [] });
      n += 1;
    }
    return n;
  };

  const books = sortBooks(detail?.books ?? []);
  const stage = useDownloadsStore((s) => s.filters.stage);
  const shownBooks = stage ? books.filter((b) => bookInStage(b, stage)) : books;
  const st = KNOWLEDGE_STATUS[knowledge.status] ?? { label: knowledge.status, color: 'default' };
  const intro = knowledge.kind === 'other_material'
    ? knowledge.materials_intro
    : [knowledge.textbook_intro && `教材：${knowledge.textbook_intro}`, knowledge.exercise_intro && `习题集：${knowledge.exercise_intro}`]
      .filter(Boolean).join('\n');
  const refEmpty = !String(knowledge.textbook_ref?.title ?? '').trim() && !String(knowledge.exercise_ref?.title ?? '').trim();

  return (
    <div className="dl-knowledge-section">
      <div className="dl-knowledge-head">
        <span className="dl-knowledge-name">{tutorialLabel(knowledge)}</span>
        <Tag>{KNOWLEDGE_KIND_LABELS[knowledge.kind] ?? knowledge.kind}</Tag>
        <Tag color={st.color}>{st.label}</Tag>
        {knowledge.status === 'draft' && (
          <>
            <Button size="small" type="primary" ghost onClick={() => setConfirmOpen(true)}>确认</Button>
            <Button size="small" onClick={() => { setKnReasonAction('reject'); setKnReasonOpen(true); }}>否定</Button>
            <Button size="small" onClick={() => { setKnReasonAction('supersede'); setKnReasonOpen(true); }}>过时</Button>
          </>
        )}
        {knowledge.status === 'confirmed' && (
          <>
            <Button
              size="small" type="primary" ghost
              onClick={() => run(completeKnowledge(knowledge.knowledge_id), '教程已完成', knowledge.knowledge_id)}
            >
              完成
            </Button>
            <Button size="small" onClick={() => { setKnReasonAction('reject'); setKnReasonOpen(true); }}>否定</Button>
            <Button size="small" onClick={() => { setKnReasonAction('supersede'); setKnReasonOpen(true); }}>过时</Button>
          </>
        )}
        {knowledge.status === 'completed' && (
          <Button size="small" onClick={() => { setKnReasonAction('supersede'); setKnReasonOpen(true); }}>过时</Button>
        )}
        {/* 兜底（2026-08-25）：确认时自动生成失败或旧数据引用后补——非表单，一键按决定引用创建 */}
        {knowledge.status === 'confirmed' && shownBooks.length === 0 && !refEmpty && (
          <Button
            size="small" type="primary" ghost style={{ marginLeft: 4 }}
            onClick={() => run(genBooksFromRefs().then((n) => n), `已按决定引用生成书行候选`, knowledge.knowledge_id)}
          >
            按决定引用补建书行
          </Button>
        )}
      </div>

      {intro && <div className="dl-knowledge-intro">{intro}</div>}

      {detail === undefined ? (
        <div className="dl-books-empty">书行详情加载失败（该教程数据不可达）</div>
      ) : shownBooks.length === 0 ? (
        <div className="dl-books-empty">
          {knowledge.status === 'draft'
            ? '暂无书行。确认教程后将按决定引用自动生成候选册。'
            : refEmpty
              ? '暂无书行（该教程无决定引用，无法自动生成）。'
              : '暂无书行。点上方「按决定引用补建书行」登记候选册。'}
        </div>
      ) : (
        <div className="dl-books-row">
          {shownBooks.map((b) => (
            <BookCard
              key={b.book_id}
              book={b}
              onAction={(action) => {
                if (action === 'reject' || action === 'supersede') {
                  setBookReason({ action, book: b });
                } else {
                  run(bookActionPromise(action, b), '书行操作成功', knowledge.knowledge_id);
                }
              }}
              onDetail={setDetailBook}
              onRegister={setRegisterTarget}
            />
          ))}
        </div>
      )}

      {/* 教程确认 */}
      <KnowledgeConfirmModal
        knowledge={confirmOpen ? knowledge : null}
        onCancel={() => setConfirmOpen(false)}
        onSubmit={(values) => {
          const body: {
            textbook_ref?: Record<string, unknown>;
            exercise_ref?: Record<string, unknown>;
            textbook_intro?: string;
            exercise_intro?: string;
          } = {};
          if (values.textbook_ref) body.textbook_ref = values.textbook_ref;
          if (values.exercise_ref) body.exercise_ref = values.exercise_ref;
          if (values.textbook_intro) body.textbook_intro = values.textbook_intro;
          if (values.exercise_intro) body.exercise_intro = values.exercise_intro;
          // 确认即自动生成（2026-08-25 用户裁决）：定稿成功后按决定引用建候选册
          run(
            confirmKnowledge(knowledge.knowledge_id, body).then(() => genBooksFromRefs()),
            '教程已确认，书行候选已按决定引用生成',
            knowledge.knowledge_id,
          );
          setConfirmOpen(false);
        }}
      />

      {/* 教程 reject / supersede */}
      <ReasonModal
        open={knReasonOpen}
        title={`${knReasonAction === 'reject' ? '否定' : '标记过时'}教程：${tutorialLabel(knowledge)}`}
        withNote={false}
        onCancel={() => setKnReasonOpen(false)}
        onSubmit={(reason) => {
          run(
            knReasonAction === 'reject'
              ? rejectKnowledge(knowledge.knowledge_id, reason)
              : supersedeKnowledge(knowledge.knowledge_id, reason),
            '教程操作成功',
            knowledge.knowledge_id,
          );
          setKnReasonOpen(false);
        }}
      />

      {/* 人工下载登记 */}
      <RegisterModal
        book={registerTarget}
        onCancel={() => setRegisterTarget(null)}
        onSubmit={(path) => {
          if (registerTarget) {
            run(registerBook(registerTarget.book_id, path), '人工下载已登记', knowledge.knowledge_id);
            setRegisterTarget(null);
          }
        }}
      />

      {/* 书行 reject / supersede */}
      <ReasonModal
        open={bookReason !== null}
        title={bookReason ? `${bookReason.action === 'reject' ? '否定' : '标记过时'}：${bookReason.book.display_title}` : ''}
        withNote={bookReason?.action === 'reject'}
        onCancel={() => setBookReason(null)}
        onSubmit={(reason, note) => {
          if (bookReason) {
            run(
              bookReason.action === 'reject'
                ? rejectBook(bookReason.book.book_id, reason, note)
                : supersedeBook(bookReason.book.book_id, reason),
              '书行操作成功',
              knowledge.knowledge_id,
            );
            setBookReason(null);
          }
        }}
      />

      {/* 书行详情 */}
      <BookDetailModal book={detailBook} onClose={() => setDetailBook(null)} />
    </div>
  );
}

function bookActionPromise(action: 'decide' | 'start' | 'fail' | 'retry' | 'verify' | 'reject' | 'supersede', book: BookRecord): Promise<unknown> {
  switch (action) {
    case 'decide': return decideBook(book.book_id);
    case 'start': return startBook(book.book_id);
    case 'fail': return failBook(book.book_id);
    case 'retry': return retryBook(book.book_id);
    case 'verify': return verifyBook(book.book_id);
    default: return Promise.resolve(undefined);
  }
}

// --- 页面 ---

/** 右侧面板（4b 卡片区 + 4c/4d 操作闭环 + 领域探索按钮状态机） */
function RightPanel() {
  const filters = useDownloadsStore((s) => s.filters);
  const selected = useDownloadsStore((s) => s.selected);
  const knowledge = useDownloadsStore((s) => s.knowledge);
  const details = useDownloadsStore((s) => s.details);
  const domains = useDownloadsStore((s) => s.domains);
  const refreshDetail = useDownloadsStore((s) => s.refreshDetail);
  const { byId } = useCourseIndex();
  const { message } = App.useApp();

  const flowTarget = useExploreUiStore((s) => s.flowTarget);
  const selectedDomain = useMemo(() => {
    if (selected?.kind === 'domain') {
      return domains.find((d) => d.domain_id === selected.id) ?? null;
    }
    // 选择课程时，通过 byId 获取对应的领域
    if (selected?.kind === 'course') {
      const courseInfo = byId.get(selected.id);
      if (courseInfo) {
        return domains.find((d) => d.domain_id === courseInfo.domainId) ?? null;
      }
    }
    // 2026-08-26：右键菜单 openFlow 不设 selected → 用 flowTarget 兜底，否则 DomainInfoCard 不渲染
    if (flowTarget?.variant === 'curriculum') {
      return domains.find((d) => d.domain_id === flowTarget.domainId) ?? null;
    }
    return null;
  }, [selected, domains, flowTarget, byId]);

  const run = useCallback(async (p: Promise<unknown>, successText: string, knowledgeId: string) => {
    try {
      await p;
      message.success(successText);
      void refreshDetail(knowledgeId);
    } catch (err) {
      message.error(describeError(err));
    }
  }, [refreshDetail]);

  // 注意：knowledge 已按 course_id 分组，保持原有顺序
  const filtered = useMemo(
    () =>
      knowledge.filter((k) => {
        // 领域筛选存 domain_id（v2 真实体系）
        if (filters.domain && k.domain_id !== filters.domain) return false;
        if (filters.course && k.course_id !== filters.course) return false;
        // 状态筛选为书行阶段（2026-08-24 三栏收敛）：无匹配书行的教程行整行隐藏
        if (filters.stage) {
          const books = details[k.knowledge_id]?.books ?? [];
          if (!books.some((b) => bookInStage(b, filters.stage))) return false;
        }
        return true;
      }),
    [knowledge, filters, details],
  );

  // 按课程分组的教程列表（场景3/4展示用）
  const groupedByCourse = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const k of filtered) {
      const existing = groups.get(k.course_id) ?? [];
      existing.push(k);
      groups.set(k.course_id, existing);
    }
    return groups;
  }, [filtered]);

  const selectedLabel =
    selected?.kind === 'domain'
      ? `领域：${domains.find((d) => d.domain_id === selected.id)?.name ?? selected.id}`
      : selected?.kind === 'course'
        ? `课程：${byId.get(selected.id)?.name ?? selected.id}`
        : selected?.kind === 'tutorial'
          ? `教程：${knowledge.find((k) => selected.key.endsWith(`kn:${k.knowledge_id}`))?.name ?? selected.key}`
          : domains.length === 0 ? '未创建领域' : '未选中';

  // 课程头（2026-08-25 #3）：选中课程时置顶展示一次——课程名一行 + 课程介绍（note）一行
  const selectedCourse = selected?.kind === 'course' ? byId.get(selected.id) ?? null : null;

  // 场景1：无领域或未选中（必须先选领域）
  const isEmptyState = domains.length === 0 || (selected === null && !selectedDomain);

  // 场景2：选中领域但无课程
  const hasDomainNoCourses = selectedDomain && selectedDomain.courses.length === 0;

  // 场景3/4：有数据且选中了领域
  const hasDataWithDomain = !isEmptyState && !hasDomainNoCourses && selectedDomain;

  return (
    <div className="dl-right">
      <div className="dl-filter-bar">
        <FilterBar />
      </div>
      <div className="dl-summary">
        <Space direction="vertical" size={4}>
          <Text strong>当前选择：{selectedLabel}</Text>
          <Text type="secondary">筛选结果：{filtered.length} 个教程（已排除否定/过时项）</Text>
        </Space>
      </div>
      <div className="dl-content">
        {/* 场景1：无领域或未选中 */}
        {isEmptyState && (
          <div className="dl-placeholder">
            <CloudServerOutlined style={{ fontSize: 40, color: '#bbb' }} />
            <Text type="secondary">
              {domains.length === 0
                ? '暂无领域数据，请先在左侧创建领域'
                : '请先选择领域查看内容'}
            </Text>
          </div>
        )}

        {/* 场景2：选中领域但无课程 */}
        {hasDomainNoCourses && (
          <>
            {selected?.kind === 'domain' && selectedDomain && (
              <DomainCard
                domain={selectedDomain}
                onExplore={startDomainExplore}
                onConfirmDomain={confirmDomainInfo}
                onConfirmKnowledge={confirmCourseKnowledge}
              />
            )}
            <div className="dl-empty-course-hint">
              <Text type="secondary">该领域暂无课程。可通过探索课程体系创建，或手动导入已整理的课程数据。</Text>
            </div>
          </>
        )}

        {/* 场景3：选中领域有课程 / 场景4：选中课程 */}
        {hasDataWithDomain && (
          <>
            {/* 领域信息卡（选中领域时展示） */}
            {selected?.kind === 'domain' && selectedDomain && (
              <DomainCard
                domain={selectedDomain}
                onExplore={startDomainExplore}
                onConfirmDomain={confirmDomainInfo}
                onConfirmKnowledge={confirmCourseKnowledge}
              />
            )}

            {/* 课程头（选中课程时置顶展示） */}
            {selectedCourse && (
              <div className="dl-course-head">
                <div className="dl-course-head-name">{selectedCourse.name}</div>
                {selectedCourse.note && <div className="dl-course-head-note">{selectedCourse.note}</div>}
              </div>
            )}

            {/* 按课程分组展示教程 */}
            {filtered.length === 0 ? (
              <div className="dl-placeholder">
                <CloudServerOutlined style={{ fontSize: 40, color: '#bbb' }} />
                <Text type="secondary">
                  {knowledge.length === 0 ? '暂无教程数据（8901 离线或未启动）' : '无匹配筛选的教程'}
                </Text>
              </div>
            ) : (
              Array.from(groupedByCourse.entries()).map(([courseId, tutorials]) => {
                const course = byId.get(courseId);
                // 场景5：课程级隐藏（如果该课程下所有教程都被筛选隐藏，则不显示）
                if (tutorials.length === 0) return null;
                return (
                  <div key={courseId} className="dl-course-group">
                    {/* 课程头（选中领域时展示） */}
                    {!selectedCourse && course && (
                      <div className="dl-course-head">
                        <div className="dl-course-head-name">{course.name}</div>
                        {course.note && <div className="dl-course-head-note">{course.note}</div>}
                      </div>
                    )}
                    {/* 教程列表 */}
                    {tutorials.map((k) => (
                      <KnowledgeSection key={k.knowledge_id} knowledge={k} detail={details[k.knowledge_id]} run={run} />
                    ))}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 文档下载管理（`#/admin/downloads`，五层模型 + 2026-08-24 REQ-059 交互改版）
 * - 左树 v2（领域→课程→教程，真实体系；右键菜单管理/探索）+ 右侧筛选栏
 *   + 教程区（书行卡片横排）+ 领域信息卡（探索按钮状态机）
 * - 探索全弹窗流：ExploreFlowModal 挂载于页内（发起→轮询→结果→应用/采纳）
 * - 独立降级：8900 不可达 → 整体横幅；课程体系 / knowledge 各自失败 → 树区/汇总提示
 */
export default function Downloads() {
  const loading = useDownloadsStore((s) => s.loading);
  const error = useDownloadsStore((s) => s.error);
  const isDegraded = useDownloadsStore((s) => s.isDegraded);
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  const startPolling = useDownloadsStore((s) => s.startPolling);
  const stopPolling = useDownloadsStore((s) => s.stopPolling);
  const flowTarget = useExploreUiStore((s) => s.flowTarget);
  const closeFlow = useExploreUiStore((s) => s.closeFlow);
  const [confirmDomain, setConfirmDomain] = useState<DomainSystem | null>(null);
  const [confirmCourse, setConfirmCourse] = useState<DomainSystem | null>(null);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // REQ-067 B8：挂载时启动 exploration_stage 轮询，卸载时停止
  useEffect(() => {
    startPolling();
    return () => { stopPolling(); };
  }, [startPolling, stopPolling]);

  return (
    <div className="dl-page">
      {/* 标题栏（固定） */}
      <div className="dl-header">
        <Title level={2} style={{ margin: 0 }}>文档下载管理</Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchAll()}>
          刷新
        </Button>
      </div>

      {/* 错误横幅（固定在筛选栏上方） */}
      {error && (
        <Alert
          type="error" showIcon style={{ marginBottom: 12 }}
          message="文档下载管理数据获取失败"
          description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
        />
      )}
      {!error && isDegraded && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message="降级模式"
          description="由于当前 QED-Tracker 服务不可达，教程和书籍功能暂不可用，可进行领域和课程管理。"
        />
      )}

      {/* 内容区（左右分栏，独立滚动） */}
      <div className="dl-layout">
        <DownloadsTree />
        <RightPanel />
      </div>

      {/* 探索全弹窗流（左树右键 / 领域信息卡按钮共用入口） */}
      <ExploreFlowModal target={flowTarget} onClose={closeFlow} />

      {/* 领域信息确认弹窗 */}
      <DomainConfirmModal
        domain={confirmDomain}
        open={confirmDomain !== null}
        onClose={() => setConfirmDomain(null)}
      />

      {/* 课程信息确认弹窗 */}
      <CourseConfirmModal
        domain={confirmCourse}
        open={confirmCourse !== null}
        onClose={() => setConfirmCourse(null)}
      />
    </div>
  );
}
