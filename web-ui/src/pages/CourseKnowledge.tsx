import { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Layout, List, Select, Space, Tag, Typography } from 'antd';
import { LeftOutlined, CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useCourseKnowledgeStore } from '../stores/courseKnowledge';
import { usePracticeStore } from '../stores/practice';
import type { KnowledgePointType } from '../api/learn';
import '../knowledge.css';

const { Title, Text, Paragraph } = Typography;

const TYPE_LABELS: Record<KnowledgePointType, string> = {
  memory: '记忆性',
  procedure: '程序性',
  concept: '概念性',
  design: '设计性',
};

const TYPE_OPTIONS = (Object.keys(TYPE_LABELS) as KnowledgePointType[]).map((value) => ({
  value,
  label: TYPE_LABELS[value],
}));

function typeTag(type: KnowledgePointType | null | undefined) {
  if (!type) return null;
  return <Tag>{TYPE_LABELS[type] ?? type}</Tag>;
}

/**
 * 课程知识点掌握详情（`#/knowledge/c/:courseId`，M5 demo）
 * - 上：已确认知识点（qed_knowledge_point）+ 同 norm_key 的多版本待选叙述
 * - 下：待选池未归入已确认的叙述，逐条人工确认（提升主表）/ 驳回
 * - 右：手工登记候选（POST /learn/kp-details，demo 写面；正式生成管线后续复用同一写面）
 * - 复习入口：今日到期条数（GET /learn/review/due?course= 聚合）为 0 时不显示，>0 时进学习工作台
 * - 降级：知识点存储未接入 → 503 提示，星图仍可浏览
 */
export default function CourseKnowledge() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const course = useCourseKnowledgeStore((s) => s.course);
  const points = useCourseKnowledgeStore((s) => s.points);
  const loose = useCourseKnowledgeStore((s) => s.loose);
  const loading = useCourseKnowledgeStore((s) => s.loading);
  const error = useCourseKnowledgeStore((s) => s.error);
  const notice = useCourseKnowledgeStore((s) => s.notice);
  const fetchCourse = useCourseKnowledgeStore((s) => s.fetchCourse);
  const confirmCandidate = useCourseKnowledgeStore((s) => s.confirmCandidate);
  const rejectCandidate = useCourseKnowledgeStore((s) => s.rejectCandidate);
  const addCandidate = useCourseKnowledgeStore((s) => s.addCandidate);
  const clearNotice = useCourseKnowledgeStore((s) => s.clearNotice);
  const courseDueCounts = usePracticeStore((s) => s.courseDueCounts);
  const refreshCourseDueCounts = usePracticeStore((s) => s.refreshCourseDueCounts);

  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<KnowledgePointType | undefined>();
  const [draftNarrative, setDraftNarrative] = useState('');

  useEffect(() => {
    if (courseId) void fetchCourse(courseId);
  }, [courseId, fetchCourse]);

  useEffect(() => {
    if (courseId) void refreshCourseDueCounts([courseId]);
  }, [courseId, refreshCourseDueCounts]);

  const submitDraft = async () => {
    const name = draftName.trim();
    if (!name) return;
    if (await addCandidate({ name, type: draftType, narrative: draftNarrative.trim() })) {
      setDraftName('');
      setDraftNarrative('');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Space>
            <Button onClick={() => navigate(`/learn/c/${courseId}`)}>进入学习工作台</Button>
            <Button icon={<LeftOutlined />} onClick={() => navigate('/knowledge')}>返回知识星图</Button>
          </Space>
        }
      />
      <Layout.Content style={{ padding: 32, maxWidth: 1320, width: '94%', margin: '0 auto' }}>
        <Space align="baseline" size={12} wrap style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>《{course?.name ?? courseId}》知识点梳理</Title>
          {course?.track && <Tag color="blue">轨迹：{course.track}</Tag>}
          <Text type="secondary">
            已确认 {points.length} · 待选 {loose.length}
          </Text>
          {(courseDueCounts[courseId] ?? 0) > 0 && (
            <Button size="small" type="primary" onClick={() => navigate(`/learn/c/${courseId}`)}>
              {`今日复习 ${courseDueCounts[courseId]} 条`}
            </Button>
          )}
        </Space>

        {error && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="知识点数据不可达"
            description={error}
            action={<Button size="small" onClick={() => void fetchCourse(courseId)}>重试</Button>}
          />
        )}
        {notice && (
          <Alert type="info" showIcon closable style={{ marginBottom: 16 }} message={notice} onClose={clearNotice} />
        )}

        <div className="kp-layout">
          <div className="kp-main">
            <Card size="small" title={`已确认知识点（${points.length}）`} style={{ marginBottom: 16 }}>
              {points.length === 0 ? (
                <Text type="secondary">还没有已确认知识点：可在待选池确认后自动落入这里。</Text>
              ) : (
                <List
                  dataSource={points}
                  rowKey={(p) => p.kp_id}
                  renderItem={(point) => (
                    <List.Item style={{ alignItems: 'flex-start' }}>
                      <div style={{ width: '100%' }}>
                        <Space size={8} wrap>
                          <Text strong>{point.name}</Text>
                          {typeTag(point.type)}
                          {(point.candidates?.length ?? 0) > 0 && (
                            <Tag color="gold">同名词候选 {point.candidates!.length} 版</Tag>
                          )}
                        </Space>
                        {point.summary && (
                          <Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                            {point.summary}
                          </Paragraph>
                        )}
                        {(point.candidates ?? []).map((c) => (
                          <div key={c.detail_id} className="kp-variant">
                            <Text type="secondary">{`同名词另一版：${c.narrative || c.name}`}</Text>
                            <Space size={6}>
                              <Button size="small" icon={<CheckOutlined />} onClick={() => void confirmCandidate(c.detail_id)}>
                                改用此版
                              </Button>
                              <Button size="small" icon={<CloseOutlined />} onClick={() => void rejectCandidate(c.detail_id)}>
                                驳回
                              </Button>
                            </Space>
                          </div>
                        ))}
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>

            <Card size="small" title={`待选池 · 未归入已确认（${loose.length}）`}>
              {loose.length === 0 ? (
                <Text type="secondary">
                  待选池为空：生成管线接入前可在右侧手工登记候选，确认后才进入知识点主表。
                </Text>
              ) : (
                <List
                  dataSource={loose}
                  rowKey={(c) => c.detailId}
                  renderItem={(item) => (
                    <List.Item
                      style={{ alignItems: 'flex-start' }}
                      actions={[
                        <Button
                          key="confirm" size="small" type="primary" icon={<CheckOutlined />}
                          loading={loading} onClick={() => void confirmCandidate(item.detailId)}
                        >
                          确认
                        </Button>,
                        <Button key="reject" size="small" icon={<CloseOutlined />} onClick={() => void rejectCandidate(item.detailId)}>
                          驳回
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<Space size={8}>{item.name}{typeTag(item.type)}</Space>}
                        description={item.narrative || <Text type="secondary">（无叙述正文）</Text>}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </div>

          <Card size="small" title="手工登记候选（demo 写面）" className="kp-draft">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Input
                aria-label="候选名称"
                placeholder="知识点名称（如：确界的极限唯一性）"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
              <Select
                aria-label="候选类型"
                placeholder="类型（可空）"
                style={{ width: '100%' }}
                allowClear
                value={draftType}
                onChange={(v: KnowledgePointType) => setDraftType(v)}
                options={TYPE_OPTIONS}
              />
              <Input.TextArea
                aria-label="候选叙述"
                placeholder="一段叙述（确认后成为知识点摘要）"
                autoSize={{ minRows: 3, maxRows: 8 }}
                value={draftNarrative}
                onChange={(e) => setDraftNarrative(e.target.value)}
              />
              <Button
                type="primary" icon={<PlusOutlined />} block loading={loading}
                disabled={!draftName.trim()} onClick={() => void submitDraft()}
              >
                登记候选
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                登记只进候选池（qed_learn_kp_detail），确认后才提升为共享主表知识点。
              </Text>
            </Space>
          </Card>
        </div>
      </Layout.Content>
    </Layout>
  );
}
