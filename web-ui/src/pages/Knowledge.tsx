import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, ConfigProvider, Layout, Select, Space, Typography, theme as antdTheme } from 'antd';
import { ReloadOutlined, LeftOutlined, QuestionCircleOutlined, StarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import HelpModal from '../components/HelpModal';
import StarMapGraph from '../components/StarMapGraph';
import { STARMAP_VIEW, starMapLayout } from '../components/starMapLayout';
import { useStarMapStore } from '../stores/starMap';
import { usePracticeStore } from '../stores/practice';
import { describeError } from '../api/client';
import '../knowledge.css';

const { Title } = Typography;

/** 按钮组白字描边（蓝底 Header 上的统一样式） */
const headerButtonStyle = { color: '#ffffff', borderColor: '#ffffff', background: 'transparent' };

/**
 * 学习中心 · 知识梳理星图（`#/knowledge`，M5）
 * - 信息面收窄：大标题 + 领域下拉，统计数与图例不进画面（图例归使用手册）
 * - 坐标系＝容器实测宽高（ResizeObserver）：星图套满画布，轨迹列框才持续套住课程卡
 * - 星图＝纯函数布局（starMapLayout）+ ECharts graph（裁决③：不引新依赖、不用 force）
 * - 数据＝GET /learn/star-map（qed_domain/qed_course；知识点计数来自 M5 两表，未接入时为 0）
 * - 复习入口＝按本课课程列表聚合 GET /learn/review/due?course=，条数写进课程节点提示行（0 条不写）
 * - 点击课程卡 → `#/knowledge/c/{course_id}` 知识点掌握详情
 * - 降级：8900 或课程目录不可达 → 提示 + 重试，不白屏
 */
export default function Knowledge() {
  const domains = useStarMapStore((s) => s.domains);
  const edges = useStarMapStore((s) => s.edges);
  const domainId = useStarMapStore((s) => s.domainId);
  const loading = useStarMapStore((s) => s.loading);
  const error = useStarMapStore((s) => s.error);
  const fetchStarMap = useStarMapStore((s) => s.fetchStarMap);
  const selectDomain = useStarMapStore((s) => s.selectDomain);
  const courseDueCounts = usePracticeStore((s) => s.courseDueCounts);
  const refreshCourseDueCounts = usePracticeStore((s) => s.refreshCourseDueCounts);
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [view, setView] = useState(STARMAP_VIEW);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchStarMap();
  }, [fetchStarMap]);

  // 容器尺寸 → 布局坐标系（尺寸未测得时留缺省视口兜底）
  useEffect(() => {
    const el = fieldRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 480 && rect.height >= 360) {
        setView({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const domain = useMemo(
    () => domains.find((d) => d.domain_id === domainId) ?? domains[0] ?? null,
    [domains, domainId],
  );
  const layout = useMemo(() => starMapLayout(domain, edges, view), [domain, edges, view]);

  const courseIds = useMemo(
    () => (domain?.tracks ?? []).flatMap((t) => t.courses.map((c) => c.course_id)),
    [domain],
  );
  useEffect(() => {
    if (courseIds.length > 0) void refreshCourseDueCounts(courseIds);
  }, [courseIds, refreshCourseDueCounts]);

  return (
    <Layout style={{ height: '100vh', background: '#070b1c', overflow: 'hidden' }}>
      <AppHeader
        actions={
          <Space>
            <Button icon={<QuestionCircleOutlined />} style={headerButtonStyle} onClick={() => setHelpOpen(true)}>
              使用手册
            </Button>
            <Button icon={<ReloadOutlined />} style={headerButtonStyle} loading={loading} onClick={() => void fetchStarMap()}>
              刷新
            </Button>
            <Button icon={<LeftOutlined />} style={headerButtonStyle} onClick={() => navigate('/')}>
              返回
            </Button>
          </Space>
        }
      />
      <Layout.Content className="kn-galaxy">
        <div className="kn-star-stage">
          <ConfigProvider theme={{ algorithm: antdTheme.darkAlgorithm }}>
            <div className="kn-star-body">
              <div className="kn-star-head">
                <Title level={2} style={{ margin: 0, color: '#f2f6ff' }}>
                  <StarOutlined /> 学习中心 · 知识梳理星图
                </Title>
                <Select
                  aria-label="领域"
                  className="kn-domain-select"
                  value={domain?.domain_id}
                  placeholder="暂无领域"
                  onChange={(id: string) => selectDomain(id)}
                  options={domains.map((d) => ({ value: d.domain_id, label: d.name }))}
                />
              </div>

              {error && (
                <Alert
                  type="warning" showIcon
                  message="星图数据不可达"
                  description={`${describeError(error)}。8900 / 课程目录离线时降级展示，不阻塞其他界面。`}
                  action={<Button size="small" onClick={() => void fetchStarMap()}>重试</Button>}
                />
              )}

              <div ref={fieldRef} className="kn-star-field">
                {layout.nodes.length > 0 ? (
                  <StarMapGraph
                    layout={layout}
                    height={view.height}
                    dueCounts={courseDueCounts}
                    onSelectCourse={(cid) => navigate(`/knowledge/c/${cid}`)}
                  />
                ) : (
                  !loading && (
                    <div className="kn-empty kn-empty-dark">
                      <Title level={5} style={{ color: '#a9bde3', fontWeight: 400 }}>
                        {error ? '课程目录暂不可达，星图无课程可展示' : '课程体系为空：请先在文档下载管理中登记领域与课程'}
                      </Title>
                    </div>
                  )
                )}
              </div>
            </div>
          </ConfigProvider>
        </div>
      </Layout.Content>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Layout>
  );
}
