/**
 * 领域信息确认弹窗（课程探索完成后）
 *
 * 功能：
 * 1. 课程信息区：课程名称（不可编辑）、课程描述（不可编辑）
 * 2. 教程详情表格：教程名称（可编辑）、position定位（可编辑）、详情按钮、否定按钮
 * 3. 操作按钮：关闭（取消）、确认（进入已完成阶段）
 *
 * 依赖：
 * - GET /api/v1/courses/{course_id}：获取课程详情
 * - GET /api/v1/knowledge?course_id={course_id}：获取教程列表
 * - PATCH /api/v1/knowledge/{id}：更新教程（name、position、intro）
 * - DELETE /api/v1/knowledge/{id}：删除教程
 * - POST /api/v1/courses/{course_id}/confirm：确认课程（待确认→已完成）
 */
import { useCallback, useEffect, useState } from 'react';
import {
  App, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { describeError } from '../api/client';
import {
  listKnowledge, updateKnowledge, deleteKnowledge, confirmCourse,
} from '../api/tracker';
import type { CourseRecord, KnowledgeRecord } from '../stores';
import { useDownloadsStore } from '../stores/downloads';

const { Text } = Typography;

interface CourseKnowledgeConfirmModalProps {
  course: CourseRecord | null;
  open: boolean;
  onClose: () => void;
}

/** 教程详情弹窗（编辑intro、查看教材/习题集） */
function TutorialDetailEditModal({ knowledge, onClose, onUpdate }: {
  knowledge: KnowledgeRecord;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    if (knowledge) {
      form.setFieldsValue({
        name: knowledge.name,
        position: knowledge.position,
        intro: knowledge.intro,
      });
    }
  }, [knowledge, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await updateKnowledge(knowledge.knowledge_id, {
        name: values.name,
        position: values.position,
        intro: values.intro,
      });
      message.success('教程信息已更新');
      onUpdate();
      onClose();
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`教程详情 · ${knowledge.name}`}
      open={true}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>保存</Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="教程名称" name="name" rules={[{ required: true, message: '请输入教程名称' }]}>
          <Input placeholder="教程名称" />
        </Form.Item>
        <Form.Item label="Position 定位" name="position">
          <Select placeholder="请选择position">
            <Select.Option value="基础">基础</Select.Option>
            <Select.Option value="进阶">进阶</Select.Option>
            <Select.Option value="综合">综合</Select.Option>
            <Select.Option value="专题">专题</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="Intro 描述" name="intro">
          <Input.TextArea rows={4} placeholder="教程介绍（100~200字）" />
        </Form.Item>
        <div style={{ marginBottom: 16 }}>
          <Text strong>教材</Text>
          <div style={{ color: '#666', marginTop: 4 }}>
            {knowledge.textbook_ref ? JSON.stringify(knowledge.textbook_ref) : '无'}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong>习题集</Text>
          <div style={{ color: '#666', marginTop: 4 }}>
            {knowledge.exercise_ref ? JSON.stringify(knowledge.exercise_ref) : '无'}
          </div>
        </div>
      </Form>
    </Modal>
  );
}

/**
 * 领域信息确认弹窗
 *
 * 课程探索完成后，用户点击「确认领域信息」按钮打开此弹窗。
 * 弹窗内容：
 * 1. 课程信息区：课程名称（不可编辑）、课程描述（不可编辑）
 * 2. 教程详情表格：教程名称（可编辑）、position定位（可编辑）、详情按钮、否定按钮
 * 3. 操作按钮：关闭（取消）、确认（进入已完成阶段）
 */
export default function CourseKnowledgeConfirmModal({ course, open, onClose }: CourseKnowledgeConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeRecord[]>([]);
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeRecord | null>(null);
  const { message } = App.useApp();
  const fetchAll = useDownloadsStore((s) => s.fetchAll);

  const loadKnowledge = useCallback(async () => {
    if (!course) return;
    setLoading(true);
    try {
      // 获取该课程下的所有教程
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

  const columns = [
    {
      title: '教程名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: KnowledgeRecord) => (
        <Space>
          <span>{text}</span>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingKnowledge(record);
            }}
          >
            编辑
          </Button>
        </Space>
      ),
    },
    {
      title: 'Position',
      dataIndex: 'position',
      key: 'position',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          draft: { label: '草稿', color: 'default' },
          confirmed: { label: '已确认', color: 'blue' },
          completed: { label: '已完成', color: 'green' },
        };
        const s = statusMap[status] || { label: status, color: 'default' };
        return <span style={{ color: s.color === 'default' ? '#666' : s.color }}>{s.label}</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: KnowledgeRecord) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setEditingKnowledge(record);
            }}
          >
            详情
          </Button>
          <Popconfirm
            title="确定删除该教程吗？"
            onConfirm={() => void handleDeleteKnowledge(record.knowledge_id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              否定
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!course) return null;

  return (
    <>
      <Modal
        title={`课程知识确认 · ${course.name}`}
        open={open}
        onCancel={onClose}
        width={800}
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
        />
      </Modal>

      {editingKnowledge && (
        <TutorialDetailEditModal
          knowledge={editingKnowledge}
          onClose={() => {
            setEditingKnowledge(null);
          }}
          onUpdate={() => void loadKnowledge()}
        />
      )}
    </>
  );
}
