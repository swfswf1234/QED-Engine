import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Form, Input, Layout, Modal, Select, Space, Switch, Tag, Typography,
} from 'antd';
import { ReloadOutlined, CloudServerOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import AppHeader from '../components/AppHeader';
import DownloadsTree from '../components/DownloadsTree';
import { describeError } from '../api/client';
import {
  confirmKnowledge, completeKnowledge, rejectKnowledge, supersedeKnowledge,
  createBook, decideBook, startBook, failBook, retryBook, verifyBook,
  rejectBook, supersedeBook, registerBook, listBookSources, addBookSource,
} from '../api/tracker';
import {
  DOMAIN_NAME, DOMAIN_MAP, DOMAIN_ORDER, DOMAIN_OTHER, FLOW_OPTIONS, bookInFlow, sortBooks,
  tutorialLabel, useDownloadsStore,
} from '../stores/downloads';
import type { BookRecord, KnowledgeDetail, KnowledgeRecord, SourceRecord } from '../stores';
import '../downloads.css';

const { Title, Text } = Typography;

// --- 状态/角色中文映射（五层模型） ---

const KNOWLEDGE_STATUS_OPTIONS = [
  { value: 'draft', label: '探索中' },
  { value: 'confirmed', label: '已定稿' },
  { value: 'completed', label: '已完成' },
];

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

function domainOfCourse(courseId: string): string {
  return DOMAIN_MAP[courseId] ?? DOMAIN_OTHER;
}

// --- 筛选栏 ---

function FilterBar() {
  const filters = useDownloadsStore((s) => s.filters);
  const setFilter = useDownloadsStore((s) => s.setFilter);
  const catalogTargets = useDownloadsStore((s) => s.catalogTargets);
  const knowledge = useDownloadsStore((s) => s.knowledge);

  const courseOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const t of catalogTargets) ids.add(t.course_id);
    for (const k of knowledge) ids.add(k.course_id);
    const nameOf = (cid: string) => catalogTargets.find((t) => t.course_id === cid)?.course_name ?? cid;
    return [...ids].sort().map((cid) => ({ value: cid, label: nameOf(cid) }));
  }, [catalogTargets, knowledge]);

  const domainOptions = useMemo(() => {
    const used = new Set<string>();
    for (const t of catalogTargets) used.add(domainOfCourse(t.course_id));
    for (const k of knowledge) used.add(domainOfCourse(k.course_id));
    const options = [DOMAIN_NAME];
    for (const d of DOMAIN_ORDER) if (used.has(d)) options.push(d);
    if (used.has(DOMAIN_OTHER)) options.push(DOMAIN_OTHER);
    return options.map((d) => ({ value: d, label: d }));
  }, [catalogTargets, knowledge]);

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
        value={filters.status || undefined}
        options={KNOWLEDGE_STATUS_OPTIONS}
        onChange={(v) => setFilter('status', v ?? '')}
      />
      <Select
        allowClear placeholder="流程" style={{ width: 110 }} aria-label="流程筛选"
        value={filters.flow || undefined}
        options={[...FLOW_OPTIONS]}
        onChange={(v) => setFilter('flow', v ?? '')}
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
      title={`确认知识行：${knowledge ? tutorialLabel(knowledge) : ''}`}
      open={knowledge !== null}
      onCancel={onCancel}
      destroyOnClose
      onOk={() => form.validateFields().then(onSubmit)}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          tb_title: ref.title ?? '',
          tb_version: ref.version ?? '',
          ex_title: knowledge?.exercise_ref?.title ?? '',
          ex_version: knowledge?.exercise_ref?.version ?? '',
          textbook_intro: knowledge?.textbook_intro ?? '',
          exercise_intro: knowledge?.exercise_intro ?? '',
        }}
      >
        <Text type="secondary">定稿后进入已定稿状态，可继续组织书行下载。</Text>
        <Form.Item name="tb_title" label="教材决定引用 · 书名" style={{ marginTop: 12 }}>
          <Input placeholder="如：微积分学教程" />
        </Form.Item>
        <Form.Item name="tb_version" label="教材决定引用 · 版本">
          <Input placeholder="如：第 8 版" />
        </Form.Item>
        <Form.Item name="ex_title" label="习题集决定引用 · 书名">
          <Input placeholder="如：数学分析习题集" />
        </Form.Item>
        <Form.Item name="ex_version" label="习题集决定引用 · 版本">
          <Input placeholder="如：第 3 版" />
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

/** 新建书行弹窗（POST /books） */
function CreateBookModal({ knowledge, onCancel, onSubmit }: {
  knowledge: KnowledgeRecord | null;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [form] = Form.useForm();
  return (
    <Modal
      title={`新建书行：${knowledge ? tutorialLabel(knowledge) : ''}`}
      open={knowledge !== null}
      onCancel={onCancel}
      destroyOnClose
      onOk={() => form.validateFields().then(onSubmit)}
    >
      <Form form={form} layout="vertical" initialValues={{ kind: 'textbook', roles: ['textbook'] }}>
        <Form.Item name="title" label="书名（必填）" rules={[{ required: true, message: '请填写书名' }]}>
          <Input placeholder="如：微积分学教程" />
        </Form.Item>
        <Form.Item name="part" label="卷标识">
          <Input placeholder="如：第一册 / 上册（单册留空）" />
        </Form.Item>
        <Form.Item name="kind" label="类型">
          <Select
            options={[
              { value: 'textbook', label: '教材' },
              { value: 'exercise', label: '习题集' },
              { value: 'supplement', label: '配套资料' },
              { value: 'paper', label: '论文' },
              { value: 'blog', label: '博客' },
            ]}
          />
        </Form.Item>
        <Form.Item name="roles" label="角色">
          <Select
            mode="multiple" allowClear
            options={[
              { value: 'textbook', label: '教材' },
              { value: 'exercise', label: '习题' },
              { value: 'solutions', label: '题解' },
              { value: 'reference', label: '参考' },
              { value: 'supplement', label: '配套资料' },
            ]}
          />
        </Form.Item>
        <Form.Item name="authors" label="作者（逗号分隔）">
          <Input placeholder="如：菲赫金哥尔茨" />
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
  const v = book.version ?? {};
  return (
    <Modal
      title={book.display_title}
      open onCancel={onClose} footer={null} width={720}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div>
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color={BOOK_STATUS[book.status]?.color}>{BOOK_STATUS[book.status]?.label ?? book.status}</Tag>
            <Tag>{BOOK_KIND_LABELS[book.kind] ?? book.kind}</Tag>
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
  const v = book.version ?? {};
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

// --- 教程行区（知识行 + 书行卡片横排 + 操作闭环 4d） ---

function KnowledgeSection({ knowledge, detail, run }: {
  knowledge: KnowledgeRecord;
  detail: KnowledgeDetail | undefined;
  run: (p: Promise<unknown>, successText: string, knowledgeId: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [knReasonOpen, setKnReasonOpen] = useState(false);
  const [knReasonAction, setKnReasonAction] = useState<'reject' | 'supersede'>('reject');
  const [createOpen, setCreateOpen] = useState(false);
  const [registerTarget, setRegisterTarget] = useState<BookRecord | null>(null);
  const [detailBook, setDetailBook] = useState<BookRecord | null>(null);
  const [bookReason, setBookReason] = useState<{ action: 'reject' | 'supersede'; book: BookRecord } | null>(null);

  const books = sortBooks(detail?.books ?? []);
  const flow = useDownloadsStore((s) => s.filters.flow);
  const shownBooks = flow ? books.filter((b) => bookInFlow(b, flow)) : books;
  const st = KNOWLEDGE_STATUS[knowledge.status] ?? { label: knowledge.status, color: 'default' };
  const intro = knowledge.kind === 'other_material'
    ? knowledge.materials_intro
    : [knowledge.textbook_intro && `教材：${knowledge.textbook_intro}`, knowledge.exercise_intro && `习题集：${knowledge.exercise_intro}`]
      .filter(Boolean).join('\n');

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
              onClick={() => run(completeKnowledge(knowledge.knowledge_id), '知识行已完成', knowledge.knowledge_id)}
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
        <Button
          size="small" icon={<PlusOutlined />} style={{ marginLeft: 4 }}
          onClick={() => setCreateOpen(true)}
        >
          新建书行
        </Button>
      </div>

      {intro && <div className="dl-knowledge-intro">{intro}</div>}

      {detail === undefined ? (
        <div className="dl-books-empty">书行详情加载失败（该知识行数据不可达）</div>
      ) : shownBooks.length === 0 ? (
        <div className="dl-books-empty">
          暂无书行，点「新建书行」登记候选册（先登记再下载）。
          {knowledge.status === 'draft' && ' 也可先「确认」定稿知识行。'}
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

      {/* 知识行确认 */}
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
          run(confirmKnowledge(knowledge.knowledge_id, body), '知识行已确认（定稿）', knowledge.knowledge_id);
          setConfirmOpen(false);
        }}
      />

      {/* 知识行 reject / supersede */}
      <ReasonModal
        open={knReasonOpen}
        title={`${knReasonAction === 'reject' ? '否定' : '标记过时'}知识行：${tutorialLabel(knowledge)}`}
        withNote={false}
        onCancel={() => setKnReasonOpen(false)}
        onSubmit={(reason) => {
          run(
            knReasonAction === 'reject'
              ? rejectKnowledge(knowledge.knowledge_id, reason)
              : supersedeKnowledge(knowledge.knowledge_id, reason),
            '知识行操作成功',
            knowledge.knowledge_id,
          );
          setKnReasonOpen(false);
        }}
      />

      {/* 新建书行 */}
      <CreateBookModal
        knowledge={createOpen ? knowledge : null}
        onCancel={() => setCreateOpen(false)}
        onSubmit={(values) => {
          const authors = typeof values.authors === 'string'
            ? (values.authors as string).split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
            : (values.authors as string[] | undefined) ?? [];
          run(
            createBook({
              knowledge_id: knowledge.knowledge_id,
              title: String(values.title),
              kind: String(values.kind ?? 'textbook'),
              roles: (values.roles as string[] | undefined) ?? [],
              part: String(values.part ?? ''),
              authors,
            }),
            '书行候选已登记',
            knowledge.knowledge_id,
          );
          setCreateOpen(false);
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

/** 右侧面板（4b 卡片区 + 4c/4d 操作闭环） */
function RightPanel() {
  const filters = useDownloadsStore((s) => s.filters);
  const selected = useDownloadsStore((s) => s.selected);
  const knowledge = useDownloadsStore((s) => s.knowledge);
  const details = useDownloadsStore((s) => s.details);
  const refreshDetail = useDownloadsStore((s) => s.refreshDetail);
  const { message } = App.useApp();

  const run = useCallback(async (p: Promise<unknown>, successText: string, knowledgeId: string) => {
    try {
      await p;
      message.success(successText);
      void refreshDetail(knowledgeId);
    } catch (err) {
      message.error(describeError(err));
    }
  }, [refreshDetail]);

  const filtered = useMemo(
    () =>
      knowledge.filter((k) => {
        // 领域=高等数学 → 不过滤（分类筛选才过滤）
        if (filters.domain && filters.domain !== DOMAIN_NAME && domainOfCourse(k.course_id) !== filters.domain) return false;
        if (filters.course && k.course_id !== filters.course) return false;
        if (filters.status && k.status !== filters.status) return false;
        // 流程筛选为书行级：无匹配书行的教程行整行隐藏
        if (filters.flow) {
          const books = details[k.knowledge_id]?.books ?? [];
          if (!books.some((b) => bookInFlow(b, filters.flow))) return false;
        }
        return true;
      }),
    [knowledge, filters, details],
  );

  const selectedLabel =
    selected?.kind === 'domain'
      ? `领域：${selected.id}`
      : selected?.kind === 'course'
        ? `课程：${selected.id}`
        : selected?.kind === 'tutorial'
          ? `教程：${selected.key}`
          : '未选中';

  return (
    <div className="dl-right">
      <div className="dl-filter-bar"><FilterBar /></div>
      <div className="dl-summary">
        <Space direction="vertical" size={4}>
          <Text strong>当前选择：{selectedLabel}</Text>
          <Text type="secondary">筛选结果：{filtered.length} 条知识行（rejected/superseded 由数据层隐藏）</Text>
        </Space>
      </div>
      <div className="dl-content">
        {filtered.length === 0 ? (
          <div className="dl-placeholder">
            <CloudServerOutlined style={{ fontSize: 40, color: '#bbb' }} />
            <Text type="secondary">{knowledge.length === 0 ? '暂无知识行数据（8901 离线或未启动）' : '无匹配筛选的知识行'}</Text>
          </div>
        ) : (
          filtered.map((k) => (
            <KnowledgeSection key={k.knowledge_id} knowledge={k} detail={details[k.knowledge_id]} run={run} />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * 下载管理（`#/admin/downloads`，Phase 4a + 五层化 4b/4c/4d）
 * - 左树（领域→课程→教程[知识行]）+ 右侧筛选栏 + 知识行区（书行卡片横排）
 * - 4b 卡片区：教程行横排书行卡片；4c 详情弹窗（书行信息 + 渠道列表 + 添加渠道）；
 *   4d 操作闭环：知识行 confirm/complete/reject/supersede + 书行全生命周期 + 新建书行
 * - 独立降级：8900 不可达 → 整体横幅；catalog / knowledge 各自失败 → 树区/汇总提示
 */
export default function Downloads() {
  const loading = useDownloadsStore((s) => s.loading);
  const error = useDownloadsStore((s) => s.error);
  const knowledgeError = useDownloadsStore((s) => s.knowledgeError);
  const fetchAll = useDownloadsStore((s) => s.fetchAll);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Button
            type="primary" ghost icon={<ReloadOutlined />} loading={loading}
            style={{ color: '#ffffff', borderColor: '#ffffff' }} onClick={() => void fetchAll()}
          >
            刷新
          </Button>
        }
      />
      <Layout.Content style={{ padding: 32, maxWidth: 1500, width: '94%', margin: '0 auto' }}>
        <Title level={2} style={{ marginTop: 0 }}>文档下载管理</Title>

        {error && (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message="下载管理数据获取失败"
            description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
          />
        )}
        {!error && knowledgeError && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="知识行数据不可达"
            description={`${describeError(knowledgeError)}。8901 离线时展示降级，不阻塞树目录。`}
          />
        )}

        <div className="dl-layout">
          <DownloadsTree />
          <RightPanel />
        </div>
      </Layout.Content>
    </Layout>
  );
}
