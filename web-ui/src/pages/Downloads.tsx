import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, App, Button, Form, Input, Modal, Select, Space, Table, Tag, Tooltip, Typography,
} from 'antd';
import { ReloadOutlined, CloudServerOutlined, EyeOutlined, PlusOutlined, DownOutlined, RightOutlined, UploadOutlined } from '@ant-design/icons';
import DownloadsTree from '../components/DownloadsTree';
import ExploreFlowModal from '../components/ExploreFlowModal';
import DomainConfirmModal from '../components/DomainConfirmModal';
import CourseConfirmModal from '../components/CourseConfirmModal';
import CourseKnowledgeConfirmModal from '../components/CourseKnowledgeConfirmModal';
import { describeError } from '../api/client';
import DomainCard from '../components/DomainCard';
import { startDomainExplore } from '../api/explore-helpers';
import {
  createBook, importBookPdf,
  listBookSources, fetchBook,
  exploreCourseKnowledge, verifyBook,
  updateCourse,
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
  candidate: { label: '待下载', color: 'default' },
  decided: { label: '待下载', color: 'default' },
  downloading: { label: '下载中', color: 'orange' },
  downloaded: { label: '待验证', color: 'cyan' },
  verified: { label: '已完成', color: 'green' },
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

/** 组合书名+卷标识，生成展示标题（title + part，part 非空时用空格连接） */
function bookDisplayName(book: { title: string; part?: string }): string {
  return [book.title, book.part].filter(Boolean).join(' ');
}

/** 全部课程扁平视图（真实领域体系；FilterBar / 右面板名称回显共用） */
export function useCourseIndex(): { byId: Map<string, CourseRecord & { domainId: string; domainName: string }>; domains: DomainSystem[] } {
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

  // 领域筛选项：真实体系领域优先（qt_knowledge 无 domain_id，仅展示课程体系领域）
  const domainOptions = useMemo(() => {
    return domains.map((d) => ({ value: d.domain_id, label: d.name }));
  }, [domains]);

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

/** 知识行确认弹窗与人工登记弹窗已随 2026-09-08 教程行精简移除：
    教程确认属「教程确认轮」（下一轮），人工导入并入教程详情书目操作（TutorialDetailModal）。 */

// --- 课程编辑弹窗（统一窗口：打开即编辑表单，不切换查看/编辑模式） ---

export function CourseDetailModal({ course, onClose }: {
  course: (CourseRecord & { domainId?: string; domainName?: string }) | null;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  const domains = useDownloadsStore((s) => s.domains);

  // 打开即填充表单（hooks 必须在 early return 之前）
  useEffect(() => {
    if (!course) return;
    form.setFieldsValue({
      description: course.description ?? '',
      stage: course.stage ?? '',
      track: course.track ?? '',
      aliases: course.aliases?.join(', ') ?? '',
      prerequisites: course.prerequisites?.join(', ') ?? '',
    });
  }, [course, form]);

  if (!course) return null;

  // 获取当前领域数据（用于 stage/track 选项）
  const currentDomain = domains.find(d => d.courses.some(c => c.course_id === course.course_id));

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        description: String(values.description ?? ''),
        stage: String(values.stage ?? ''),
        track: String(values.track ?? ''),
      };
      if (values.aliases) body.aliases = String(values.aliases).split(',').map((s: string) => s.trim()).filter(Boolean);
      if (values.prerequisites) body.prerequisites = String(values.prerequisites).split(',').map((s: string) => s.trim()).filter(Boolean);
      await updateCourse(course.course_id, body);
      message.success('课程已更新');
      await fetchAll();
      onClose();
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`修改课程 · ${course.name}`}
      open onCancel={onClose} width={640}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => void handleSave(v)}>
        <Form.Item label="课程名">
          <Input value={course.name} disabled />
        </Form.Item>
        <Form.Item name="description" label="课程描述" rules={[{ required: true, message: '请填写课程描述' }]}>
          <Input.TextArea rows={3} placeholder="课程介绍" />
        </Form.Item>
        <Form.Item name="stage" label="学习阶段" rules={[{ required: true, message: '请选择阶段' }]}>
          <Select placeholder="请选择阶段">
            {currentDomain?.stages?.map(stage => (
              <Select.Option key={stage} value={stage}>{stage}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="track" label="学术方向">
          <Select placeholder="请选择学术方向">
            {currentDomain?.classic_tracks?.map(track => (
              <Select.Option key={track.name} value={track.name}>{track.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="aliases" label="别名（可选，逗号分隔）">
          <Input placeholder="如：复变,复变函数论" />
        </Form.Item>
        <Form.Item name="prerequisites" label="依赖课程（可选）">
          <Input placeholder="如：微积分,线性代数" />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>保存</Button>
            <Button onClick={onClose}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// --- 课程状态栏（右面板课程头旁，与领域信息卡对齐） ---

function CourseStatusBar({ course, onConfirm }: {
  course: CourseRecord;
  onConfirm: () => void;
}) {
  const [exploring, setExploring] = useState(false);
  const { message } = App.useApp();
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  
  // 如果课程有教程，显示"已导入"状态
  const hasKnowledge = course.knowledge && course.knowledge.length > 0;
  const courseStage = course.exploration_stage || (hasKnowledge ? '已导入' : '未开始');

  const handleStartExplore = async () => {
    setExploring(true);
    try {
      const result = await exploreCourseKnowledge(course.course_id);
      message.success(result.message);
      // §6.5 禁止乐观更新：操作后 fetchAll 以服务端返回为准
      await fetchAll();
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setExploring(false);
    }
  };

  // 5 态状态机（未开始/探索中/待确认/已完成/失败），与后端 exploration_stage 对齐
  const getButtonState = () => {
    switch (courseStage) {
      case '未开始':
        return {
          label: '开始探索',
          disabled: false,
          loading: exploring,
          onClick: handleStartExplore,
          type: 'primary' as const,
        };
      case '探索中':
        return {
          label: '探索中…',
          disabled: true,
          loading: true,
          type: 'default' as const,
        };
      case '待确认':
        return {
          label: '确认课程知识',
          disabled: false,
          loading: false,
          onClick: onConfirm,
          type: 'primary' as const,
        };
      case '已导入':
        return {
          label: '查看教程',
          disabled: false,
          loading: false,
          onClick: onConfirm,
          type: 'default' as const,
        };
      case '已完成':
        return {
          label: '探索完成',
          disabled: true,
          loading: false,
          type: 'default' as const,
        };
      case '失败':
        return {
          label: '重试探索',
          disabled: false,
          loading: false,
          onClick: handleStartExplore,
          type: 'primary' as const,
          danger: true,
        };
      default:
        return {
          label: '开始探索',
          disabled: false,
          loading: false,
          onClick: handleStartExplore,
          type: 'primary' as const,
        };
    }
  };

  const buttonState = getButtonState();

  return (
    <Button
      type={buttonState.type}
      danger={buttonState.danger}
      disabled={buttonState.disabled}
      loading={buttonState.loading}
      onClick={buttonState.onClick}
      size="small"
    >
      {buttonState.label}
    </Button>
  );
}

// --- 教程详情弹窗（用户裁决 2026-09-08 项 3：信息展示 + 书目操作集 导入/新增/下载/否决） ---
// 教程信息修改依赖 PATCH /knowledge——8901 未实现（已移交）：入口禁用 + 提示

function TutorialDetailModal({ knowledge, detail, run, onClose }: {
  knowledge: KnowledgeRecord;
  detail: KnowledgeDetail | undefined;
  run: (p: Promise<unknown>, successText: string, knowledgeId: string) => void;
  onClose: () => void;
}) {
  const refreshDetail = useDownloadsStore((s) => s.refreshDetail);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detailBook, setDetailBook] = useState<BookRecord | null>(null);
  const [expandedBookKeys, setExpandedBookKeys] = useState<Set<string>>(new Set());
  const { message } = App.useApp();
  const books = useMemo(() => sortBooks(detail?.books ?? []), [detail]);

  const toggleBookExpand = (key: string) => {
    setExpandedBookKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** 统一上传：打开文件管理器选 PDF → multipart 上传登记（不写路径） */
  const triggerUpload = (bookId: string) => {
    uploadTargetRef.current = bookId;
    uploadInputRef.current?.click();
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const bookId = uploadTargetRef.current;
    e.target.value = '';
    uploadTargetRef.current = null;
    if (!file || !bookId) return;
    setUploading(true);
    try {
      await importBookPdf(bookId, file);
      message.success('书籍已上传并登记');
      void refreshDetail(knowledge.knowledge_id);
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title={`教程详情 · ${tutorialLabel(knowledge)}`}
      open onCancel={onClose} footer={null} width={860}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space wrap>
          <Tag>{KNOWLEDGE_KIND_LABELS[knowledge.kind] ?? knowledge.kind}</Tag>
          <Tag color={KNOWLEDGE_STATUS[knowledge.status]?.color}>
            {KNOWLEDGE_STATUS[knowledge.status]?.label ?? knowledge.status}
          </Tag>
          <Tooltip title="QED-Tracker 未实现教程信息修改（已移交）">
            <Button size="small" disabled icon={<EyeOutlined />}>修改信息</Button>
          </Tooltip>
        </Space>
        {knowledge.intro && <div className="dl-knowledge-intro">{knowledge.intro}</div>}

        <div>
          <Space wrap style={{ marginBottom: 8 }}>
            <Text strong>书目（{books.length}）</Text>
            <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              新增书目
            </Button>
          </Space>
          {detail === undefined ? (
            <div className="dl-books-empty">书行详情加载失败（该教程数据不可达）</div>
          ) : books.length === 0 ? (
            <div className="dl-books-empty">该教程暂无书目（可点「新增书目」手工登记）</div>
          ) : (
            <Table
              size="small"
              rowKey="book_id"
              dataSource={books}
              pagination={false}
              columns={[
                {
                  title: '书名',
                  render: (_: unknown, b: BookRecord) => {
                    const displayName = bookDisplayName(b);
                    return <span title={displayName}>{displayName}</span>;
                  },
                },
                {
                  title: '作者',
                  width: 150,
                  render: (_: unknown, b: BookRecord) => (b.authors?.length > 0 ? b.authors.map((a) => a.name).join(' / ') : '—'),
                },
                { title: '语言', dataIndex: 'language', width: 56, render: (l: string) => l || '—' },
                {
                  title: '状态',
                  width: 76,
                  render: (_: unknown, b: BookRecord) => (
                    <Tag color={BOOK_STATUS[b.status]?.color} style={{ marginRight: 0 }}>
                      {BOOK_STATUS[b.status]?.label ?? b.status}
                    </Tag>
                  ),
                },
                {
                  title: '详情',
                  key: 'expand',
                  width: 60,
                  render: (_: unknown, b: BookRecord) => (
                    <Button
                      type="link"
                      size="small"
                      icon={expandedBookKeys.has(b.book_id) ? <DownOutlined /> : <RightOutlined />}
                      onClick={() => toggleBookExpand(b.book_id)}
                    />
                  ),
                },
                {
                  title: '下载方式',
                  key: 'download',
                  width: 120,
                  render: (_: unknown, b: BookRecord) => (
                    <Space size={4}>
                      {['candidate', 'decided', 'failed'].includes(b.status) && (
                        <Button size="small" type="link" style={{ padding: 0 }}
                          onClick={() => run(fetchBook(b.book_id), '下载任务已提交', knowledge.knowledge_id)}
                        >
                          探索
                        </Button>
                      )}
                      <Button size="small" type="link" style={{ padding: 0 }}
                        loading={uploading}
                        onClick={() => triggerUpload(b.book_id)}
                      >
                        上传
                      </Button>
                    </Space>
                  ),
                },
                {
                  title: '判断',
                  key: 'action',
                  width: 100,
                  render: (_: unknown, b: BookRecord) => (
                    <Space size={0}>
                      {b.status === 'downloaded' && (
                        <Button size="small" type="link" style={{ padding: 0 }}
                          onClick={() => run(verifyBook(b.book_id), '书籍已确认', knowledge.knowledge_id)}
                        >
                          确认
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]}
              expandable={{
                expandedRowKeys: Array.from(expandedBookKeys),
                expandedRowRender: (b: BookRecord) => (
                  <div style={{ padding: '8px 0', background: '#f5f5f5', borderRadius: 4 }}>
                    {b.edition && <div>版本：{b.edition}</div>}
                    {b.publisher && <div>出版社：{b.publisher}</div>}
                    {b.year && <div>出版年：{b.year}</div>}
                    {b.page_count != null && <div>页数：{b.page_count}</div>}
                    {b.original_title && <div>原版书名：{b.original_title}</div>}
                  </div>
                ),
                showExpandColumn: false,
              }}
            />
          )}
        </div>
      </Space>

      {/* 新增书目（POST /books 书库化创建）：book_id + 书名必填；归属由教程 refs 承载 */}
      <Modal
        title={`新增书目 · ${tutorialLabel(knowledge)}`}
        open={addOpen} onCancel={() => setAddOpen(false)} width={480}
        destroyOnHidden
        onOk={async () => {
          const values = await addForm.validateFields();
          try {
            await createBook({
              book_id: values.book_id.trim(),
              title: values.title.trim(),
              roles: [values.kind],
              domain_id: knowledge.domain_id,
              authors: String(values.authors ?? '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
                .map((name) => ({ name, role: 'author' })),
            });
            message.success('书目行已创建');
            setAddOpen(false);
          } catch (err) {
            message.error(describeError(err));
          }
        }}
        okText="创建" cancelText="取消"
      >
        <Form form={addForm} layout="vertical" initialValues={{ kind: 'textbook' }}>
          <Form.Item
            label="书目编号" name="book_id"
            rules={[
              { required: true, message: '请输入书目编号（如 01ma-b05）' },
              { pattern: /^[a-z][a-z0-9_]*-b\d{2,}$/, message: '格式应为 {缩写}-b{编号}，如 01ma-b05' },
            ]}
            extra="须与教程书目引用中的编号一致才会显示在本教程下；引用中已删书籍的编号可直接重建"
          >
            <Input placeholder="如 01ma-b05" autoComplete="off" />
          </Form.Item>
          <Form.Item label="书名" name="title" rules={[{ required: true, message: '请输入书名' }]}>
            <Input placeholder="书名（含卷册可写全）" />
          </Form.Item>
          <Form.Item label="类型" name="kind">
            <Select options={Object.entries(BOOK_KIND_LABELS).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item label="作者（逗号分隔）" name="authors">
            <Input placeholder="如：W. Rudin, 赵慈庚" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 统一上传：隐藏文件选择器（书籍 PDF → multipart 导入，不写路径） */}
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={(e) => void handleUploadFile(e)}
      />

      {/* 书目详情（只读全貌，用户裁决 2026-09-08 项 4） */}
      <BookDetailModal
        book={detailBook}
        onClose={() => setDetailBook(null)}
        onMutated={() => void refreshDetail(knowledge.knowledge_id)}
      />
    </Modal>
  );
}

// --- 书目详情弹窗（PLAN-039 重设计：信息网格 + 下载信息精简 + 上传/验证/自动下载） ---

/** 下载状态派生：是否下载成功（holding × status） */
function bookDownloadState(b: BookRecord): { label: string; color: string } {
  if (b.holding === 'owned' && ['downloaded', 'verified'].includes(b.status)) {
    return { label: '下载成功', color: 'green' };
  }
  if (b.status === 'failed') return { label: '下载失败', color: 'red' };
  return { label: '未下载', color: 'default' };
}

function BookDetailModal({ book, onClose, onMutated }: {
  book: BookRecord | null;
  onClose: () => void;
  onMutated: () => void;
}) {
  const [current, setCurrent] = useState<BookRecord | null>(book);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [operating, setOperating] = useState<string | null>(null);

  // book prop 变化时同步本地「当前书」（组件在 book=null 时已挂载，靠此 effect 同步）
  useEffect(() => {
    setCurrent(book);
  }, [book]);

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

  const { message } = App.useApp();

  const handleVerify = async () => {
    if (!current) return;
    setOperating('verify');
    try {
      const updated = await verifyBook(current.book_id);
      setCurrent(updated);
      message.success('验证通过，书目已完成');
      onMutated();
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setOperating(null);
    }
  };

  const handleAutoDownload = async () => {
    if (!current) return;
    setOperating('fetch');
    try {
      await fetchBook(current.book_id);
      message.success('下载任务已提交，完成后可在本弹窗查看结果');
      onMutated();
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setOperating(null);
    }
  };

  /** 统一上传：文件管理器选 PDF → multipart（不写路径） */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !current) return;
    setUploading(true);
    try {
      const updated = await importBookPdf(current.book_id, file);
      setCurrent(updated);
      message.success('上传成功，书目已登记为待验证');
      onMutated();
      void loadSources(current.book_id);
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setUploading(false);
    }
  };

  if (!book || !current) return null;
  const download = bookDownloadState(current);
  const address = current.file_path || current.absolute_path || '—';
  const metaRows: Array<[string, string]> = [
    ['书名', current.title || '—'],
    ['原版书名', current.original_title || '—'],
    ['卷册', current.part || '—'],
    ['版本', current.edition || '—'],
    ['作者', current.authors?.length ? current.authors.map((a) => a.name).join(' / ') : '—'],
    ['出版社', current.publisher || '—'],
    ['出版年', current.year != null ? String(current.year) : '—'],
    ['语言', current.language || '—'],
    ['角色', current.roles?.length ? current.roles.join(' / ') : '—'],
    ['页数', current.page_count != null ? String(current.page_count) : '—'],
  ];
  const canVerify = current.status === 'downloaded';
  const canAutoDownload = ['candidate', 'decided', 'failed'].includes(current.status);

  return (
    <Modal
      title={`书目详情 · ${bookDisplayName(current)}`}
      open onCancel={onClose}
      width={760}
      style={{ maxWidth: '94vw' }}
      styles={{ body: { maxHeight: '68vh', overflowY: 'auto' } }}
      footer={[
        <Button key="upload" icon={<UploadOutlined />} loading={uploading} onClick={() => fileInputRef.current?.click()}>
          上传书籍
        </Button>,
        canAutoDownload && (
          <Button key="fetch" loading={operating === 'fetch'} onClick={() => void handleAutoDownload()}>
            自动下载
          </Button>
        ),
        canVerify && (
          <Button key="verify" type="primary" loading={operating === 'verify'} onClick={() => void handleVerify()}>
            验证通过
          </Button>
        ),
        <Button key="close" type="text" onClick={onClose}>关闭</Button>,
      ]}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <Tag color={BOOK_STATUS[current.status]?.color}>{BOOK_STATUS[current.status]?.label ?? current.status}</Tag>
          <Tag>{roleLabel(current.roles)}</Tag>
        </Space>

        <div>
          <Text strong>书目信息</Text>
          <div className="dl-book-detail-grid">
            {metaRows.map(([k, v]) => (
              <div key={k} className="dl-book-detail-item">
                <span className="dl-book-detail-label">{k}</span>
                <span className="dl-book-detail-value" title={v}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Text strong>下载信息</Text>
          <div className="dl-book-meta" style={{ marginTop: 4 }}>
            <div>
              下载状态：<Tag color={download.color} style={{ marginRight: 0 }}>{download.label}</Tag>
            </div>
            <div>文件地址：<span title={address}>{address}</span></div>
          </div>
        </div>

        <div>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setShowSources((v) => !v)}>
            查看渠道尝试（{sources.length}）{showSources ? ' ▲' : ' ▼'}
          </Button>
          {showSources && (
            <div style={{ marginTop: 4 }}>
              <Button size="small" onClick={() => void loadSources(current.book_id)} loading={loading}>刷新</Button>
              {sourcesError && <div className="dl-book-meta" style={{ color: '#cf1322' }}>{sourcesError}</div>}
              {sources.length === 0 && !sourcesError && <div className="dl-books-empty">暂无渠道尝试记录</div>}
              {sources.map((s) => (
                <div key={s.source_id} className="dl-book-meta" style={{ marginTop: 4, padding: '4px 8px', borderRadius: 4 }}>
                  <Space size={6}>
                    <Tag color={s.ok ? 'green' : 'default'}>{s.ok ? '成功' : '失败'}</Tag>
                    <span>{SOURCE_CHANNEL_OPTIONS.find((c) => c.value === s.channel)?.label ?? s.channel}</span>
                    {s.page_url && <a href={s.page_url} target="_blank" rel="noreferrer">页面</a>}
                    {s.download_url && <a href={s.download_url} target="_blank" rel="noreferrer">下载链接</a>}
                  </Space>
                  {s.note && <div style={{ color: s.ok ? 'inherit' : '#cf1322', fontSize: 12 }}>{s.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Space>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={(e) => void handleUpload(e)}
      />
    </Modal>
  );
}

// --- 书行卡片（用户裁决 2026-09-08 项 4：纯展示——名称/作者/语言等 + 只读详情，无操作按钮） ---

function BookCard({ book, onDetail }: {
  book: BookRecord;
  onDetail: (book: BookRecord) => void;
}) {
  const v = { edition: book.edition, year: book.year };
  const displayName = bookDisplayName(book);
  return (
    <div className="dl-book-card">
      <div className="dl-book-title" title={displayName}>{displayName}</div>
      <div>
        <Space wrap size={4}>
          <Tag color={BOOK_STATUS[book.status]?.color} style={{ marginRight: 0 }}>
            {BOOK_STATUS[book.status]?.label ?? book.status}
          </Tag>
          <Tag style={{ marginRight: 0 }}>{roleLabel(book.roles)}</Tag>
        </Space>
      </div>
      <div className="dl-book-meta">
        {book.authors?.length > 0 && <div>{book.authors.map((a) => a.name).join(' / ')}</div>}
        {book.language && <div>语言：{book.language}</div>}
        {versionText(v) && <div>{versionText(v)}</div>}
        {book.page_count != null && <div>页数：{book.page_count}</div>}
      </div>
      <div className="dl-book-actions">
        <Button size="small" icon={<EyeOutlined />} onClick={() => onDetail(book)}>详情</Button>
      </div>
    </div>
  );
}

// --- 教程行区（用户裁决 2026-09-08 项 2/3：名称/状态/进度 + 删除(移交)/详情/自动下载 + 纯展示书目卡） ---

function KnowledgeSection({ knowledge, detail, run }: {
  knowledge: KnowledgeRecord;
  detail: KnowledgeDetail | undefined;
  run: (p: Promise<unknown>, successText: string, knowledgeId: string) => void;
}) {
  const [detailBook, setDetailBook] = useState<BookRecord | null>(null);
  const [tutorialDetailOpen, setTutorialDetailOpen] = useState(false);

  const books = sortBooks(detail?.books ?? []);
  // 进度（项 2）：下载完成数/总本数（排除已否决/过时；downloaded+verified 计完成）
  const liveBooks = books.filter((b) => b.status !== 'rejected' && b.status !== 'superseded');
  const downloadedCount = liveBooks.filter((b) => b.status === 'downloaded' || b.status === 'verified').length;
  const stage = useDownloadsStore((s) => s.filters.stage);
  const refreshDetail = useDownloadsStore((s) => s.refreshDetail);
  const shownBooks = stage ? liveBooks.filter((b) => bookInStage(b, stage)) : liveBooks;
  const st = KNOWLEDGE_STATUS[knowledge.status] ?? { label: knowledge.status, color: 'default' };

  return (
    <div className="dl-knowledge-section">
      <div className="dl-knowledge-head">
        <span className="dl-knowledge-name">{tutorialLabel(knowledge)}</span>
        <Tag color={st.color} style={{ marginRight: 0 }}>{st.label}</Tag>
        {liveBooks.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>下载 {downloadedCount}/{liveBooks.length} 本</Text>
        )}
        <span style={{ flex: 1 }} />
        <Button size="small" icon={<EyeOutlined />} onClick={() => setTutorialDetailOpen(true)}>下载情况</Button>
      </div>

      {detail === undefined ? (
        <div className="dl-books-empty">书行详情加载失败（该教程数据不可达）</div>
      ) : shownBooks.length === 0 ? (
        <div className="dl-books-empty">暂无书目（教程详情内可「新增书目」或下载生成候选册）</div>
      ) : (
        <div className="dl-books-row">
          {shownBooks.map((b) => (
            <BookCard key={b.book_id} book={b} onDetail={setDetailBook} />
          ))}
        </div>
      )}

      {/* 教程详情（信息展示 + 书目操作集：导入/新增/下载/否决） */}
      {tutorialDetailOpen && (
        <TutorialDetailModal
          knowledge={knowledge}
          detail={detail}
          run={run}
          onClose={() => setTutorialDetailOpen(false)}
        />
      )}

      {/* 书目详情（只读全貌） */}
      <BookDetailModal
        book={detailBook}
        onClose={() => setDetailBook(null)}
        onMutated={() => void refreshDetail(knowledge.knowledge_id)}
      />
    </div>
  );
}

// --- 页面 ---

/** 右侧面板（4b 卡片区 + 4c/4d 操作闭环 + 领域探索按钮状态机） */
function RightPanel({ onConfirmDomain, onConfirmCourse, detailCourse, onDetailCourseChange }: {
  onConfirmDomain: (domain: DomainSystem) => void;
  onConfirmCourse: (domain: DomainSystem) => void;
  detailCourse: (CourseRecord & { domainName?: string }) | null;
  onDetailCourseChange: (course: (CourseRecord & { domainName?: string }) | null) => void;
}) {
  const filters = useDownloadsStore((s) => s.filters);
  const selected = useDownloadsStore((s) => s.selected);
  const knowledge = useDownloadsStore((s) => s.knowledge);
  const details = useDownloadsStore((s) => s.details);
  const domains = useDownloadsStore((s) => s.domains);
  const refreshDetail = useDownloadsStore((s) => s.refreshDetail);
  const { byId } = useCourseIndex();
  const { message } = App.useApp();
  // 课程详情弹窗由父组件管理
  // 课程知识确认弹窗
  const [knowledgeConfirmCourse, setKnowledgeConfirmCourse] = useState<CourseRecord | null>(null);

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

  const handleCourseConfirm = useCallback(async (courseId: string) => {
    // 打开课程知识确认弹窗
    const course = domains.flatMap(d => d.courses).find(c => c.course_id === courseId);
    if (course) {
      setKnowledgeConfirmCourse(course);
    }
  }, [domains]);

  // 领域筛选：qt_knowledge 无 domain_id 列，通过课程归属反查领域
  const domainCourseIds = useMemo(() => {
    if (!filters.domain) return null;
    const domain = domains.find((d) => d.domain_id === filters.domain);
    if (!domain) return null;
    return new Set(domain.courses.map((c) => c.course_id));
  }, [domains, filters.domain]);

  // 注意：knowledge 已按 course_id 分组，保持原有顺序
  const filtered = useMemo(
    () =>
      knowledge.filter((k) => {
        // 领域筛选：通过课程 ID 归属判断（qt_knowledge 无 domain_id）
        if (domainCourseIds && !domainCourseIds.has(k.course_id)) return false;
        if (filters.course && k.course_id !== filters.course) return false;
        // 状态筛选为书行阶段（2026-08-24 三栏收敛）：无匹配书行的教程行整行隐藏
        if (filters.stage) {
          const books = details[k.knowledge_id]?.books ?? [];
          if (!books.some((b) => bookInStage(b, filters.stage))) return false;
        }
        return true;
      }),
    [knowledge, filters, details, domainCourseIds],
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
            {/* 领域信息卡恒显（PLAN-033 §3：无论筛选/选中层级如何始终渲染） */}
            {selectedDomain && (
              <DomainCard
                domain={selectedDomain}
                onExplore={startDomainExplore}
                onConfirmDomain={() => onConfirmDomain(selectedDomain)}
                onConfirmKnowledge={() => onConfirmCourse(selectedDomain)}
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
            {/* 领域信息卡恒显（PLAN-033 §3：无论筛选/选中层级如何始终渲染） */}
            {selectedDomain && (
              <DomainCard
                domain={selectedDomain}
                onExplore={startDomainExplore}
                onConfirmDomain={() => onConfirmDomain(selectedDomain)}
                onConfirmKnowledge={() => onConfirmCourse(selectedDomain)}
              />
            )}

            {/* 课程头（选中课程时置顶展示） */}
            {selectedCourse && (
              <div className="dl-course-head">
                <div className="dl-course-head-row">
                  <div className="dl-course-head-name">
                    {selectedCourse.name}
                    <Button
                      size="small" type="link" icon={<EyeOutlined />}
                      onClick={() => onDetailCourseChange(selectedCourse)}
                    >
                      详情
                    </Button>
                  </div>
                  <div className="dl-course-status-bar">
                    <CourseStatusBar
                      course={selectedCourse}
                      onConfirm={() => void handleCourseConfirm(selectedCourse.course_id)}
                    />
                  </div>
                </div>
                {selectedCourse.description && <div className="dl-course-head-note">{selectedCourse.description}</div>}
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
                        <div className="dl-course-head-row">
                          <div className="dl-course-head-name">
                            {course.name}
                            <Button
                              size="small" type="link" icon={<EyeOutlined />}
                              onClick={() => onDetailCourseChange(course)}
                            >
                              详情
                            </Button>
                          </div>
                          <div className="dl-course-status-bar">
                            <CourseStatusBar
                              course={course}
                              onConfirm={() => void handleCourseConfirm(course.course_id)}
                            />
                          </div>
                        </div>
                        {course.description && <div className="dl-course-head-note">{course.description}</div>}
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
      {/* 课程编辑弹窗（打开即编辑表单） */}
      <CourseDetailModal
        course={detailCourse}
        onClose={() => onDetailCourseChange(null)}
      />
      {/* 课程知识确认弹窗 */}
      <CourseKnowledgeConfirmModal
        course={knowledgeConfirmCourse}
        open={knowledgeConfirmCourse !== null}
        onClose={() => setKnowledgeConfirmCourse(null)}
      />
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
  // 左树「编辑课程」→ 统一弹窗（打开即编辑表单）
  const [editCourse, setEditCourse] = useState<(CourseRecord & { domainName?: string }) | null>(null);

  const handleEditCourseFromTree = useCallback((course: CourseRecord) => {
    // 从 domains 计算 domainName
    const { domains } = useDownloadsStore.getState();
    let domainName: string | undefined;
    for (const d of domains) {
      if (d.courses.some(c => c.course_id === course.course_id)) {
        domainName = d.name;
        break;
      }
    }
    setEditCourse({ ...course, domainName });
  }, []);

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
        <DownloadsTree onEditCourse={handleEditCourseFromTree} />
        <RightPanel
          onConfirmDomain={(d) => setConfirmDomain(d)}
          onConfirmCourse={(d) => setConfirmCourse(d)}
          detailCourse={editCourse}
          onDetailCourseChange={setEditCourse}
        />
      </div>

      {/* 探索全弹窗流（左树右键 / 领域信息卡按钮共用入口） */}
      <ExploreFlowModal target={flowTarget} onClose={closeFlow} />

      {/* 领域信息确认弹窗（导入路径确认后进入课程信息确认，PLAN-033 §4） */}
      <DomainConfirmModal
        domain={confirmDomain}
        open={confirmDomain !== null}
        onClose={() => setConfirmDomain(null)}
        onAfterImport={() => setConfirmCourse(confirmDomain)}
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
