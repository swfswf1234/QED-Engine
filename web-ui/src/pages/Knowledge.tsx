import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Breadcrumb, Button, ConfigProvider, Layout, Select, Space, Typography, theme as antdTheme } from 'antd';
import { ReloadOutlined, LeftOutlined, QuestionCircleOutlined, StarOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import HelpModal from '../components/HelpModal';
import StarMapGraph from '../components/StarMapGraph';
import CourseKnowledge from './CourseKnowledge';
import { STARMAP_VIEW, starMapLayout } from '../components/starMapLayout';
import { useStarMapStore } from '../stores/starMap';
import { useCourseKnowledgeStore } from '../stores/courseKnowledge';
import { describeError } from '../api/client';
import '../knowledge.css';

const { Title } = Typography;

/** 按钮组白字描边（蓝底 Header 上的统一样式） */
const headerButtonStyle = { color: '#ffffff', borderColor: '#ffffff', background: 'transparent' };

/**
 * 学习中心·知识探索（`#/knowledge`，REQ-110 起为单页两级视图）
 * - 一个页面承载「领域星图」与「课程层级星图」两级：点课程卡就地下钻（`?course={id}`），
 *   回退只走面包屑；层级状态的唯一事实源＝URL，组件内不存私有层级态
 * - 信息面收窄：大标题 + 面包屑 + 领域下拉（**只属领域层**，五审裁决 2026-10-14），统计数与图例不进画面
 * - 面包屑两级「知识探索 / {课程名}」，不含领域名；课程层左上角只显课程名行（归 CourseKnowledge 视图）
 * - 坐标系＝容器实测尺寸（ResizeObserver，两视图都罩）：星图套满画布，课程层虚框宽＝内容区实测宽
 * - 星图＝纯函数布局（starMapLayout）+ ECharts graph（裁决③：不引新依赖、不用 force）
 * - 数据＝GET /learn/star-map（qed_domain/qed_course）；课程层＝GET /learn/courses/{id}/knowledge-points
 * - 独立面（裁决 ④）：无通往学习/练习的出口，不消费复习域（/learn/review/due 聚合已移除）
 * - 降级：8900 或课程目录不可达 → 提示 + 重试，不白屏；刷新只重取当前视图数据
 */
export default function Knowledge() {
  const domains = useStarMapStore((s) => s.domains);
  const edges = useStarMapStore((s) => s.edges);
  const domainId = useStarMapStore((s) => s.domainId);
  const loading = useStarMapStore((s) => s.loading);
  const error = useStarMapStore((s) => s.error);
  const fetchStarMap = useStarMapStore((s) => s.fetchStarMap);
  const selectDomain = useStarMapStore((s) => s.selectDomain);
  const course = useCourseKnowledgeStore((s) => s.course);
  const courseLoading = useCourseKnowledgeStore((s) => s.loading);
  const fetchCourse = useCourseKnowledgeStore((s) => s.fetchCourse);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const courseId = searchParams.get('course') ?? '';
  const [helpOpen, setHelpOpen] = useState(false);
  const [view, setView] = useState(STARMAP_VIEW);
  const [courseWidth, setCourseWidth] = useState(0);
  const fieldRef = useRef<HTMLDivElement>(null);
  const courseBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchStarMap();
  }, [fetchStarMap]);

  // 容器尺寸 → 布局坐标系（尺寸未测得时留缺省视口兜底）
  useEffect(() => {
    if (courseId) return undefined;
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
  }, [courseId]);

  // 课程层取景（REQ-113 W4）：虚框宽＝内容区实测宽，故画布宽度同样取自容器观测
  // （clientWidth 不含滚动条，避免滚动条出现→宽度重算→重画的往复）
  useEffect(() => {
    if (!courseId) return undefined;
    const el = courseBodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      if (width >= 480) setCourseWidth(Math.round(width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [courseId]);

  const domain = useMemo(
    () => domains.find((d) => d.domain_id === domainId) ?? domains[0] ?? null,
    [domains, domainId],
  );
  const layout = useMemo(() => starMapLayout(domain, edges, view), [domain, edges, view]);

  /** 层级只由查询参数承载：进课程层写 ?course=，回领域层清该参数 */
  const setCourseParam = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('course', id);
    else next.delete('course');
    setSearchParams(next);
  };

  const refresh = () => {
    if (courseId) void fetchCourse(courseId);
    else void fetchStarMap();
  };

  const breadcrumbItems = courseId
    ? [{ title: <Link to="/knowledge">知识探索</Link> }, { title: course?.name ?? courseId }]
    : [{ title: '知识探索' }];

  return (
    <Layout style={{ height: '100vh', background: '#070b1c', overflow: 'hidden' }}>
      <AppHeader
        actions={
          <Space>
            <Button icon={<QuestionCircleOutlined />} style={headerButtonStyle} onClick={() => setHelpOpen(true)}>
              使用手册
            </Button>
            <Button icon={<ReloadOutlined />} style={headerButtonStyle} loading={courseId ? courseLoading : loading} onClick={refresh}>
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
                  <StarOutlined /> 学习中心·知识探索
                </Title>
                <Breadcrumb aria-label="面包屑" className="kn-breadcrumb" items={breadcrumbItems} />
                {/* 领域下拉只属领域层（五审裁决 2026-10-14）：课程层左上角只显课程名，换领域先经面包屑回退 */}
                {!courseId && (
                  <Select
                    aria-label="领域"
                    className="kn-domain-select"
                    value={domain?.domain_id}
                    placeholder="暂无领域"
                    onChange={selectDomain}
                    options={domains.map((d) => ({ value: d.domain_id, label: d.name }))}
                  />
                )}
              </div>

              {!courseId && error && (
                <Alert
                  type="warning" showIcon
                  message="星图数据不可达"
                  description={`${describeError(error)}。8900 / 课程目录离线时降级展示，不阻塞其他界面。`}
                  action={<Button size="small" onClick={() => void fetchStarMap()}>重试</Button>}
                />
              )}

              {courseId ? (
                <div ref={courseBodyRef} className="kn-course-body">
                  <CourseKnowledge courseId={courseId} contentWidth={courseWidth} />
                </div>
              ) : (
                <div ref={fieldRef} className="kn-star-field">
                  {layout.nodes.length > 0 ? (
                    <StarMapGraph layout={layout} height={view.height} onSelectCourse={setCourseParam} />
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
              )}
            </div>
          </ConfigProvider>
        </div>
      </Layout.Content>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} page="knowledge" />
    </Layout>
  );
}
