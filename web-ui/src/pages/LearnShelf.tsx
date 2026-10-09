/**
 * 学习中心 · 课程书架（`#/learn`，M1 判据 S2 第一步＝书架）
 * - 列表＝`GET /api/v1/learn/courses`（学习课程 + 服务端派生进度），状态徽章承载口径文案
 * - 注册＝引用式（选共享课程与已激活解析版本的书，只存 ref_id + label 快照，主链 M-1 契约 L5）
 * - 进入＝`#/learn/c/{共享课程 id}`（三栏工作台：阅读／链路）
 * - 数据一律经 8900（ADR 0007）；8900 不可达时降级为空态不白屏
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Progress, Select, Space, Spin, Tag, Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { listBooks, type BookMeta } from '../api/axiom';
import { describeError } from '../api/client';
import {
  createLearnCourse, deleteLearnCourse, listLearnCourses, type LearnCourse,
} from '../api/learn';
import { getStarMap, type StarMapDomain } from '../api/learn';

const { Title, Text } = Typography;

/** 课程态徽章：词本身承载口径（draft 再按是否已有链路细分） */
export function statusBadge(course: LearnCourse): { label: string; color: string } {
  const status = course.derived.status;
  if (status === 'completed') return { label: '已结课', color: 'success' };
  if (status === 'compiling') return { label: '编译中', color: 'processing' };
  if (status === 'learning') return { label: `在学 ${course.derived.percent}%`, color: 'blue' };
  return (course.unit_count ?? 0) === 0
    ? { label: '待建链路', color: 'default' }
    : { label: '草稿', color: 'warning' };
}

/** 共享课程下拉项（领域 → 课程平铺，值用 `domainId::courseId` 回查领域坐标） */
export function courseOptions(domains: StarMapDomain[]) {
  return domains.flatMap((domain) => domain.tracks.flatMap((track) => track.courses.map((course) => ({
    value: `${domain.domain_id}::${course.course_id}`,
    label: `${domain.name} / ${course.name}`,
    domain_id: domain.domain_id,
    domain_label: domain.name,
    course_id: course.course_id,
    course_label: course.name,
  }))));
}

export default function LearnShelf() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<LearnCourse[]>([]);
  const [domains, setDomains] = useState<StarMapDomain[]>([]);
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<{ name: string; scope: string; book: string }>();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [courseList, star] = await Promise.all([listLearnCourses(), getStarMap()]);
      setCourses(courseList.courses);
      setDomains(star.domains);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
    // 书目走 8902 透传：解析侧离线只影响「选素材」，书架照常列出（独立性铁律）
    try {
      const allBooks = await listBooks();
      // 可选素材＝已激活解析版本的书（active_job_id 是「哪一版可读」唯一事实源）
      setBooks(allBooks.filter((book) => book.active_job_id));
      setBookError(null);
    } catch (err) {
      setBooks([]);
      setBookError(describeError(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const options = useMemo(() => courseOptions(domains), [domains]);

  const submit = async () => {
    const values = await form.validateFields();
    const picked = options.find((option) => option.value === values.scope);
    const book = books.find((item) => item.book_id === values.book);
    if (!picked || !book) return;
    setBusy(true);
    try {
      await createLearnCourse({
        name: values.name.trim(),
        domain_ref: { ref_id: picked.domain_id, label: picked.domain_label },
        course_ref: { ref_id: picked.course_id, label: picked.course_label },
        resources: [{ kind: 'book', ref_id: book.book_id, label: book.display_title || book.title || book.book_id }],
      });
      setCreateOpen(false);
      form.resetFields();
      await reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (course: LearnCourse) => {
    try {
      await deleteLearnCourse(course.learn_course_id);
      await reload();
    } catch (err) {
      setError(describeError(err));
    }
  };

  /** 工作台路由参数＝共享课程 id（章节目录与知识点按它归属；无 course_ref 者用学习课程 id） */
  const openWorkbench = (course: LearnCourse) => {
    navigate(`/learn/c/${course.course_ref?.ref_id || course.learn_course_id}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <AppHeader
        actions={
          <Space>
            <Button onClick={() => navigate('/knowledge')}>知识星图</Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>新建学习课程</Button>
          </Space>
        }
      />
      <div style={{ padding: '16px 24px' }}>
        <Title level={4} style={{ marginTop: 0 }}>课程书架</Title>
        <Text type="secondary">一门课从书目与章节目录出发，按章顺序学下去；进度由服务端派生。</Text>
        {error && (
          <Alert
            style={{ margin: '12px 0' }}
            type="warning"
            showIcon
            message="书架数据不可达"
            description={`${error}。8900 离线时本面降级为空态，其他界面不受影响。`}
            action={<Button size="small" onClick={() => void reload()}>重试</Button>}
          />
        )}
        {loading && <Spin style={{ display: 'block', margin: '24px auto' }} />}
        {!loading && courses.length === 0 && !error && (
          <Empty style={{ marginTop: 32 }} description="还没有学习课程：点右上「新建学习课程」从书目注册一门">
            <Button type="primary" onClick={() => setCreateOpen(true)}>新建学习课程</Button>
          </Empty>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
          {!loading && courses.map((course) => {
            const badge = statusBadge(course);
            const bookLabel = course.resources[0]?.label ?? '（未绑书）';
            return (
              <Card
                key={course.learn_course_id}
                size="small"
                title={course.name}
                style={{ width: 320 }}
                extra={<Tag color={badge.color}>{badge.label}</Tag>}
              >
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {course.domain_ref?.label ?? '未标领域'} · 素材 {bookLabel}
                  </Text>
                  <Progress percent={course.derived.percent} size="small" />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    已学 {course.derived.done}/{course.derived.total} 块 · 链路 {course.unit_count ?? 0} 节点
                  </Text>
                  <Space size={6}>
                    <Button size="small" type="primary" onClick={() => openWorkbench(course)}>进入学习</Button>
                    <Popconfirm
                      title="删除这门学习课程？"
                      description="单元树与进度行一并删除；书目与解析产物不受影响。"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => void remove(course)}
                    >
                      <Button size="small" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                </Space>
              </Card>
            );
          })}
        </div>
      </div>

      <Modal
        open={createOpen}
        title="新建学习课程（引用式注册）"
        okText="注册"
        confirmLoading={busy}
        onOk={() => void submit()}
        onCancel={() => setCreateOpen(false)}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="name" label="课程名" rules={[{ required: true, message: '请输入课程名' }]}>
            <Input placeholder="如：数学分析（教材主线）" />
          </Form.Item>
          <Form.Item name="scope" label="共享课程（领域 / 课程）" rules={[{ required: true, message: '请选择归属课程' }]}>
            <Select
              placeholder={options.length === 0 ? '星图数据不可达' : '选择领域下的课程'}
              options={options}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="book"
            label="主素材书（已激活解析版本）"
            rules={[{ required: true, message: '请选择书' }]}
          >
            <Select
              placeholder={
                bookError
                  ? '书目服务不可达（解析侧离线），暂不能选素材'
                  : books.length === 0
                    ? '没有已激活解析版本的书'
                    : '选择书'
              }
              showSearch
              optionFilterProp="label"
              options={books.map((book) => ({
                value: book.book_id,
                label: `${book.display_title || book.title || book.book_id}（${book.book_id}，${book.page_count ?? '?'} 页）`,
              }))}
            />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            注册只存引用与标签快照（不改书目）；章节目录与学习链路在工作台内生成。
          </Text>
        </Form>
      </Modal>
    </div>
  );
}
