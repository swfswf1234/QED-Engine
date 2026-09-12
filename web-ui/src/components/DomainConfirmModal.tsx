import { useCallback, useEffect, useState } from 'react';
import {
  App, Alert, Button, Form, Input, Modal, Radio, Select, Space, Typography,
} from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { updateDomain } from '../api/tracker';
import { confirmDomainInfo } from '../api/explore-helpers';
import type { DomainSystem } from '../stores';
import { parseExplorePending, useDownloadsStore } from '../stores/downloads';
import { describeError } from '../api/client';

const { TextArea } = Input;
const { Text } = Typography;

interface DomainConfirmModalProps {
  domain: DomainSystem | null;
  open: boolean;
  onClose: () => void;
  /** 导入路径确认后回调：由页面层打开课程信息确认弹窗（PLAN-033 §4） */
  onAfterImport?: () => void;
}

/**
 * 领域信息确认界面（REQ-067；PLAN-033 §4 状态机对接）
 *
 * 功能：
 * 1. 导入名称变更时：顶部显示名称确认（采纳导入名称 / 保留当前名称）
 * 2. 名称确认挂起（LLM 探索）时：展示建议名称，可一键采纳后随确认重提探索
 * 3. 可编辑：描述（6行）、探索范围（3行）、学习阶段、课程方向（子表单）
 * 4. 状态流转（前端禁写 exploration_stage，PLAN-033 §2：写点归后端门面端点）：
 *    - 导入挂起（import_courses）：仅保存内容，确认后进入课程信息确认（离线收口）
 *    - 其余（已生成/名称确认挂起）：保存内容后调 confirm-domain 门面端点
 */
export default function DomainConfirmModal({
  domain, open, onClose, onAfterImport,
}: DomainConfirmModalProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  const [loading, setLoading] = useState(false);

  // 名称确认状态（explore_pending 可能来自共享表 JSON 字符串，统一归一）
  const ep = domain ? parseExplorePending(domain.explore_pending) : null;
  const needNameConfirm = open && ep?.kind === 'import_courses' && ep.name_changed;
  const [nameChosen, setNameChosen] = useState<'accept' | 'retain' | null>(null);
  // LLM 探索名称确认：是否采纳建议名称（随 confirm-domain 重提）
  const suggestedName = ep?.kind === 'name_confirmation' ? ep.name_check?.suggested_name : undefined;
  const [adoptSuggested, setAdoptSuggested] = useState(false);
  // 确认模式：'explore' = AI探索（调 confirm-domain），'import' = 已导入（走 onAfterImport）
  const [confirmMode, setConfirmMode] = useState<'explore' | 'import'>('explore');

  // 初始化表单值
  useEffect(() => {
    if (domain && open) {
      form.setFieldsValue({
        description: domain.description || '',
        scope: domain.scope || '',
        stages: (domain.stages || []).join('、'),
        classic_tracks: (domain.classic_tracks || []).map((t) => ({
          name: t.name || '',
          summary: t.summary || '',
          kind: t.kind || 'main',
        })),
      });
      setNameChosen(null);
      setAdoptSuggested(false);
      setConfirmMode('explore');
    }
  }, [domain, open, form]);

  // 名称确认：采纳导入名称
  const handleAcceptName = useCallback(async () => {
    if (!domain || !ep || ep.kind !== 'import_courses') return;
    try {
      await updateDomain(domain.domain_id, {
        name: ep.imported_name,
        explore_pending: { ...ep, name_changed: false },
      });
      setNameChosen('accept');
      message.success(`已采纳导入名称「${ep.imported_name}」`);
      void fetchAll();
    } catch (err) {
      message.error(describeError(err));
    }
  }, [domain, ep, message, fetchAll]);

  // 名称确认：保留当前名称
  const handleRetainName = useCallback(async () => {
    if (!domain || !ep || ep.kind !== 'import_courses') return;
    try {
      await updateDomain(domain.domain_id, {
        explore_pending: { ...ep, name_changed: false },
      });
      setNameChosen('retain');
      message.success('已保留当前名称');
      void fetchAll();
    } catch (err) {
      message.error(describeError(err));
    }
  }, [domain, ep, message, fetchAll]);

  // 保存领域信息
  const handleConfirm = useCallback(async () => {
    if (!domain) return;
    try {
      const values = await form.validateFields();
      setLoading(true);

      const stages = values.stages
        ? values.stages.split(/[,、]/).map((s: string) => s.trim()).filter(Boolean)
        : [];
      const classic_tracks = (values.classic_tracks || [])
        .filter((t: { name?: string }) => t.name?.trim())
        .map((t: { name: string; summary?: string; kind?: string }) => ({
          name: t.name.trim(),
          summary: (t.summary || '').trim(),
          kind: t.kind || 'main',
        }));

      const imported = confirmMode === 'import';
      // 仅保存内容字段：exploration_stage/explore_pending 写点归后端（PLAN-033 §2 前端禁写）
      await updateDomain(domain.domain_id, {
        description: values.description,
        scope: values.scope,
        stages,
        classic_tracks,
      });

      if (imported) {
        // 导入路径：仅调 confirm-domain（写 courses.json + stage→待确认）。
        // 不再调 commit-import：8901 courses/import 守卫只收 已生成/探索中，而 confirm 已置
        // 待确认 → 必 409（PLAN-041）。课程行与「已完成」由后续「课程知识确认」桥接收口。
        const nameOverride = ep?.kind === 'import_courses' && ep.name_changed
          ? ep.imported_name
          : undefined;
        await confirmDomainInfo(domain.domain_id, nameOverride);
        message.success('领域信息已保存，请继续确认课程');
        onClose();
        void fetchAll();
        return;
      }
      // 探索路径：确认领域（已生成→探索中；名称确认挂起时携带建议名重提）
      const nameOverride = ep?.kind === 'name_confirmation' && adoptSuggested
        ? ep.name_check?.suggested_name
        : undefined;
      await confirmDomainInfo(domain.domain_id, nameOverride);
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return;
      }
      message.error(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [domain, form, confirmMode, ep, adoptSuggested, message, onClose, onAfterImport]);

  return (
    <Modal
      title={`领域信息确认 · ${domain?.name || ''}`}
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={loading} onClick={handleConfirm}>
            保存并确认
          </Button>
        </Space>
      }
      width={960}
      destroyOnHidden
    >
      {domain && (
        <Form form={form} layout="vertical">
          {/* 导入名称确认区域（仅在 name_changed 时显示） */}
          {needNameConfirm && ep?.kind === 'import_courses' && (
            <Alert
              type="warning" showIcon
              style={{ marginBottom: 16 }}
              message="导入领域名称需要确认"
              description={
                <Space direction="vertical" size={8}>
                  <span>
                    当前名称：<Text strong>{domain.name}</Text>
                    {' → '}
                    导入名称：<Text strong>{ep.imported_name}</Text>
                  </span>
                  {!nameChosen ? (
                    <Space size={8}>
                      <Button size="small" type="primary" onClick={handleAcceptName}>
                        采纳导入名称
                      </Button>
                      <Button size="small" onClick={handleRetainName}>
                        保留当前名称
                      </Button>
                    </Space>
                  ) : (
                    <Text type="success">
                      {nameChosen === 'accept' ? `已采纳「${ep.imported_name}」` : '已保留当前名称'}
                    </Text>
                  )}
                </Space>
              }
            />
          )}

          {/* 探索名称确认区域（LLM 探索建议名，PLAN-033 §4） */}
          {!needNameConfirm && suggestedName && (
            <Alert
              type="info" showIcon
              style={{ marginBottom: 16 }}
              message="探索建议领域名称"
              description={
                <Space direction="vertical" size={8}>
                  <span>
                    当前名称：<Text strong>{domain.name}</Text>
                    {' → '}
                    建议名称：<Text strong>{suggestedName}</Text>
                    {ep?.kind === 'name_confirmation' && ep.name_check?.reason
                      ? `（${ep.name_check.reason}）`
                      : null}
                  </span>
                  {!adoptSuggested ? (
                    <Button size="small" type="primary" onClick={() => setAdoptSuggested(true)}>
                      采纳建议名称
                    </Button>
                  ) : (
                    <Text type="success">
                      确认后将使用建议名称「{suggestedName}」重新提交探索
                    </Text>
                  )}
                </Space>
              }
            />
          )}

          {/* 领域名称（不可修改） */}
          <Form.Item label="领域名称">
            <Input
              value={nameChosen === 'accept' && ep?.kind === 'import_courses'
                ? ep.imported_name
                : domain.name}
              disabled
            />
          </Form.Item>

          {/* 描述 */}
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入领域描述' }]}
          >
            <TextArea rows={6} placeholder="请输入领域描述（200字以内为佳）" />
          </Form.Item>

          {/* 探索范围 */}
          <Form.Item name="scope" label="探索范围（scope）">
            <TextArea rows={3} placeholder="学科知识边界描述" />
          </Form.Item>

          {/* 学习阶段 */}
          <Form.Item name="stages" label="学习阶段">
            <Input placeholder="基础、主干、分支、前沿（逗号分隔）" />
          </Form.Item>

          {/* 课程方向（子表单） */}
          <Form.Item label="课程方向（classic tracks）">
            <Form.List name="classic_tracks">
              {(fields, { add, remove }) => (
                <div>
                  {fields.map((field) => (
                    <div key={field.key} style={{
                      display: 'flex', gap: 8, marginBottom: 8,
                      padding: '8px 12px', background: '#fafafa', borderRadius: 6,
                      alignItems: 'flex-start',
                    }}>
                      <Form.Item {...field} name={[field.name, 'name']} noStyle
                        rules={[{ required: true, message: '方向名称必填' }]}>
                        <Input placeholder="方向名称" style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'summary']} noStyle>
                        <TextArea rows={2} placeholder="方向描述（可选）" style={{ flex: 1 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'kind']} noStyle>
                        <Select style={{ width: 100 }} options={[
                          { value: 'main', label: '主干' },
                          { value: 'branch', label: '分支' },
                        ]} />
                      </Form.Item>
                      <MinusCircleOutlined
                        style={{ marginTop: 8, color: '#999' }}
                        onClick={() => remove(field.name)}
                      />
                    </div>
                  ))}
                  <Button type="dashed" onClick={() => add({ name: '', summary: '', kind: 'main' })} block
                    icon={<PlusOutlined />}>
                    添加课程方向
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>

          {/* 确认模式选择（ISSUE-001 修复：用户显式选择 AI 探索或已导入） */}
          <Form.Item label="确认后操作">
            <Radio.Group
              value={confirmMode}
              onChange={(e) => setConfirmMode(e.target.value)}
            >
              <Space direction="vertical">
                <Radio value="explore">
                  <Text>AI 探索</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    提交课程体系探索任务，AI 自动生成课程列表后进入审阅
                  </Text>
                </Radio>
                <Radio value="import">
                  <Text>已导入</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    使用已导入的课程数据，直接进入课程信息确认
                  </Text>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {/* 当前状态预览 */}
          <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
            <Text type="secondary">
              {confirmMode === 'import'
                ? '保存后进入课程信息确认：导入课程将写入数据库并完成领域探索。'
                : '保存并确认后开始课程体系探索：课程生成完成后进入课程信息确认。'}
            </Text>
          </div>
        </Form>
      )}
    </Modal>
  );
}
