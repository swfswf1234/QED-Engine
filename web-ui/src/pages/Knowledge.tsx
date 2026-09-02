import { useEffect, useMemo } from 'react';
import { Alert, Button, Layout, Space, Typography } from 'antd';
import { ReloadOutlined, LeftOutlined, ReadOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import CourseGraph from '../components/CourseGraph';
import { buildCourseGraph, KNOWLEDGE_DOMAINS, useKnowledgeStore } from '../stores/knowledge';
import { describeError } from '../api/client';

const { Title, Text } = Typography;

/** 左侧领域面板（当前数学单领域，未来多领域） */
function DomainPanel() {
  const domain = useKnowledgeStore((s) => s.domain);
  const selectDomain = useKnowledgeStore((s) => s.selectDomain);

  return (
    <div className="kn-domain-panel">
      <Text strong className="kn-domain-title">领域</Text>
      {KNOWLEDGE_DOMAINS.map((d) => (
        <div
          key={d}
          className={`kn-domain-item${domain === d ? ' active' : ''}`}
          onClick={() => selectDomain(d)}
          role="button"
        >
          {d}
        </div>
      ))}
    </div>
  );
}

/** 知识结构图态：选中课程的章节/知识点（空态，等解析产物管线） */
function KnowledgeStructure({ courseId }: { courseId: string }) {
  const catalogTargets = useKnowledgeStore((s) => s.catalogTargets);
  const selectCourse = useKnowledgeStore((s) => s.selectCourse);
  const name = catalogTargets.find((t) => t.course_id === courseId)?.course_name ?? courseId;

  return (
    <div className="kn-structure">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => selectCourse(null)}>
            返回课程结构
          </Button>
          <Title level={4} style={{ margin: 0 }}>《{name}》知识点梳理</Title>
        </Space>
        <div className="kn-empty">
          <ExperimentOutlined style={{ fontSize: 40, color: '#bbb' }} />
          <Text type="secondary" style={{ marginTop: 8 }}>
            知识点结构（定义/定理/证明/例题/习题）等待 Axiom-Flow 解析产物管线就绪后填充
          </Text>
        </div>
      </Space>
    </div>
  );
}

/**
 * 学习中心·知识结构浏览（`#/knowledge`，原型）
 * - 左：领域面板；右：课程结构图（stage 分层泡泡 + 先修依赖连线）⇄ 知识结构图（空态）
 * - 数据：/catalogs/math-qe（唯一后端依赖）；课程依赖/阶段过渡期前端常量
 * - 降级：catalog 不可达 → 课程图空态 + 重试
 */
export default function Knowledge() {
  const catalogTargets = useKnowledgeStore((s) => s.catalogTargets);
  const courseMetaMap = useKnowledgeStore((s) => s.courseMetaMap);
  const loading = useKnowledgeStore((s) => s.loading);
  const error = useKnowledgeStore((s) => s.error);
  const selectedCourseId = useKnowledgeStore((s) => s.selectedCourseId);
  const selectCourse = useKnowledgeStore((s) => s.selectCourse);
  const fetchAll = useKnowledgeStore((s) => s.fetchAll);
  const navigate = useNavigate();

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const graph = useMemo(() => buildCourseGraph(catalogTargets, courseMetaMap), [catalogTargets, courseMetaMap]);

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
      <Layout.Content style={{ padding: 32, maxWidth: 1400, width: '94%', margin: '0 auto' }}>
        <Space style={{ marginBottom: 16 }}>
          <ReadOutlined style={{ fontSize: 20, color: '#1677ff' }} />
          <Title level={2} style={{ margin: 0 }}>学习中心 · 知识结构浏览</Title>
          <Button size="small" onClick={() => navigate('/')}>返回主界面</Button>
        </Space>

        {error && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="课程目录数据不可达"
            description={`${describeError(error)}。8901 离线时展示降级，不阻塞其他界面。`}
          />
        )}

        <div className="kn-layout">
          <DomainPanel />
          <div className="kn-main">
            {selectedCourseId ? (
              <KnowledgeStructure courseId={selectedCourseId} />
            ) : (
              <div className="kn-graph">
                <CourseGraph graph={graph} selectedId={null} onSelect={(cid) => selectCourse(cid)} />
                {graph.courses.length > 0 && (
                  <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
                    点击泡泡进入知识点梳理；箭头方向为先修 → 后修
                  </Text>
                )}
              </div>
            )}
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
}