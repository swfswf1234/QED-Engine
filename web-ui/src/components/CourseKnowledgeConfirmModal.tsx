/**
 * 课程知识确认弹窗（课程探索完成后）
 *
 * 功能：
 * 1. 课程信息区：课程名称（不可编辑）、课程描述（不可编辑）
 * 2. 教程表格：教程名称、position定位（中文）、状态、下载情况展开、否定按钮
 * 3. 展开行 = 教材/习题集摘要文本
 * 4. 操作按钮：关闭（取消）、确认（进入已完成阶段）
 *
 * 依赖：
 * - GET /api/v1/courses/{course_id}：获取课程详情
 * - GET /api/v1/knowledge?course_id={course_id}：获取教程列表
 * - DELETE /api/v1/knowledge/{id}：删除教程
 * - POST /api/v1/courses/{course_id}/confirm：确认课程（待确认→已完成）
 */
import { useCallback, useEffect, useState } from 'react';
import {
  App, Button, Modal, Popconfirm, Table, Typography,
} from 'antd';
import { DeleteOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { describeError } from '../api/client';
import {
  listKnowledge, deleteKnowledge, confirmCourse,
} from '../api/tracker';
import type { CourseRecord, KnowledgeRecord } from '../stores';
import { useDownloadsStore } from '../stores/downloads';

const { Text } = Typography;

/** Position 英文→中文映射 */
const POSITION_MAP: Record<string, string> = {
  beginner: '新手入门',
  intermediate: '中级进阶',
  advanced: '深度研究',
  comprehensive: '全面系统',
  elective: '选修拓展',
};

interface CourseKnowledgeConfirmModalProps {
  course: CourseRecord | null;
  open: boolean;
  onClose: () => void;
}

/** 格式化教材/习题集引用为一句话摘要 */
function formatBookSummary(refs: Record<string, unknown>[] | null): string {
  if (!refs || refs.length === 0) return '无';
  return refs.map((ref) => {
    const title = String(ref.title || '');
    const authors = Array.isArray(ref.authors)
      ? (ref.authors as Array<{ name: string; role: string }>)
          .filter((a) => a.role === 'author')
          .map((a) => a.name)
          .join('/')
      : '';
    const translators = Array.isArray(ref.authors)
      ? (ref.authors as Array<{ name: string; role: string }>)
          .filter((a) => a.role === 'translator')
          .map((a) => a.name)
          .join('/')
      : '';
    const publisher = String(ref.publisher || '');
    const year = ref.year ? String(ref.year) : '';
    const language = ref.language === 'zh' ? '中文版' : ref.language === 'en' ? '英文版' : '';
    const part = ref.part ? String(ref.part) : '';

    const parts: string[] = [];
    if (title) parts.push(`《${title}》`);
    if (authors) parts.push(`${authors} 著`);
    if (translators) parts.push(`${translators} 译`);
    if (publisher) parts.push(publisher);
    if (year) parts.push(`${year}年`);
    if (language) parts.push(language);
    if (part) parts.push(part);

    return `（${parts.join('，')}）`;
  }).join('；');
}

export default function CourseKnowledgeConfirmModal({ course, open, onClose }: CourseKnowledgeConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeRecord[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const { message } = App.useApp();
  const fetchAll = useDownloadsStore((s) => s.fetchAll);

  const loadKnowledge = useCallback(async () => {
    if (!course) return;
    setLoading(true);
    try {
      const allKnowledge = await listKnowledge({ course_id: course.course_id });
      setKnowledgeList(allKnowledge);
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [course, message]);

  useEffect(() => {
    if (open && course) {
      void loadKnowledge();
    }
  }, [open, course, loadKnowledge]);

  const handleDeleteKnowledge = async (knowledgeId: string) => {
    try {
      await deleteKnowledge(knowledgeId);
      message.success('教程已删除');
      void loadKnowledge();
    } catch (err) {
      message.error(describeError(err));
    }
  };

  const handleConfirm = async () => {
    if (!course) return;
    setLoading(true);
    try {
      await confirmCourse(course.course_id);
      message.success('课程已确认完成');
      void fetchAll();
      onClose();
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const columns = [
    {
      title: '教程',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '教程定位',
      dataIndex: 'position',
      key: 'position',
      render: (position: string) => POSITION_MAP[position] || position || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          draft: { label: '草稿', color: '#666' },
          confirmed: { label: '已确认', color: '#1677ff' },
          completed: { label: '已完成', color: '#52c41a' },
        };
        const s = statusMap[status] || { label: status, color: '#666' };
        return <span style={{ color: s.color }}>{s.label}</span>;
      },
    },
    {
      title: '课程详情',
      key: 'expand',
      width: 100,
      render: (_: unknown, record: KnowledgeRecord) => (
        <Button
          type="link"
          size="small"
          icon={expandedKeys.has(record.knowledge_id) ? <DownOutlined /> : <RightOutlined />}
          onClick={() => toggleExpand(record.knowledge_id)}
        >
          展开
        </Button>
      ),
    },
    {
      title: '判断',
      key: 'action',
      width: 80,
      render: (_: unknown, record: KnowledgeRecord) => (
        <Popconfirm
          title="确定否定该教程吗？"
          onConfirm={() => void handleDeleteKnowledge(record.knowledge_id)}
          okText="否定"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            否定
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const expandedRowRender = (record: KnowledgeRecord) => (
    <div style={{ padding: '8px 0', background: '#fafafa', borderRadius: 4 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong>教材：</Text>
        <Text>{formatBookSummary(record.textbook_ref as Record<string, unknown>[] | null)}</Text>
      </div>
      <div>
        <Text strong>习题集：</Text>
        <Text>{formatBookSummary(record.exercise_ref as Record<string, unknown>[] | null)}</Text>
      </div>
      {record.intro && (
        <div style={{ marginTop: 8 }}>
          <Text strong>简介：</Text>
          <Text type="secondary">{record.intro}</Text>
        </div>
      )}
    </div>
  );

  if (!course) return null;

  return (
    <Modal
      title={`课程知识确认 · ${course.name}`}
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>关闭</Button>,
        <Button key="confirm" type="primary" loading={loading} onClick={handleConfirm}>确认</Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>课程描述</div>
        <div style={{ color: '#666' }}>{course.description || '暂无描述'}</div>
      </div>

      <Table
        columns={columns}
        dataSource={knowledgeList}
        rowKey="knowledge_id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: '暂无教程数据' }}
        expandable={{
          expandedRowKeys: Array.from(expandedKeys),
          expandedRowRender,
          showExpandColumn: false,
        }}
      />
    </Modal>
  );
}
