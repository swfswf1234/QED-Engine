/**
 * 学习中心 · 课后练习独立面（`#/practice`，REQ-106）
 * 设计：docs/design/learning-practice-ui.md（本面口径与降级矩阵的唯一正本）
 * - 页头：大标题 + 课程选择器 + 使用手册（落「课后练习」册）+ 返回主界面；选择器取 `GET /learn/courses`，
 *   值＝`learn_course_id`（D4 后＝共享 `qed_course.course_id`：练习三表、`GET /learn/question-books?course=`
 *   与课程目录坐标同源，一门学习课程只有一个坐标）；无该坐标的学习课程不进选项
 * - 课程层级唯一事实源＝URL（`?course=`，判例 #/knowledge）；未选课各分区给空态且不发练习请求
 * - 三区：今日面板（到期复习队列 + 错题本，同屏两段）/ 题源工作区 + 本课题卡（`PracticePane`）
 * - 面间零跳转：不放「去学正文」类按钮；数据一律经 8900（ADR 0007）
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Empty, Layout, Select, Space, Typography,
} from 'antd';
import { LeftOutlined, QuestionCircleOutlined, SolutionOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import ChapterPractice from '../components/practice/ChapterPractice';
import HelpModal from '../components/HelpModal';
import PracticePane from '../components/practice/PracticePane';
import { describeError } from '../api/client';
import { listLearnCourses, type LearnCourse } from '../api/learn';
import { usePracticeStore } from '../stores/practice';

const { Title } = Typography;

export default function Practice() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const courseId = searchParams.get('course') ?? '';
  const storeError = usePracticeStore((s) => s.error);
  const [courses, setCourses] = useState<LearnCourse[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const loadCourses = useCallback(async () => {
    setCoursesError(null);
    try {
      const result = await listLearnCourses();
      setCourses(result.courses);
    } catch (err) {
      setCoursesError(describeError(err));
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  /** 选课＝写查询参数，回退/分享都跟着 URL 走 */
  const selectCourse = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('course', id);
    setSearchParams(next);
  };

  const retry = () => {
    // 整块重挂：让题源与三张面的进面请求随课程列表一起重发
    setReloadKey((key) => key + 1);
    void loadCourses();
  };

  const courseOptions = courses
    .map((course) => ({ value: course.learn_course_id, label: course.name }))
    .filter((option) => option.value !== '');

  const dataError = coursesError ?? storeError;

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Space>
            <Button icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)}>
              使用手册
            </Button>
            <Button icon={<LeftOutlined />} onClick={() => navigate('/')}>
              返回
            </Button>
          </Space>
        }
      />
      <Layout.Content style={{ padding: 24, maxWidth: 1100, width: '96%', margin: '0 auto' }}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Space size={10} wrap align="center">
            <Title level={2} style={{ margin: 0 }}>
              <SolutionOutlined /> 学习中心·课后练习
            </Title>
            <Select
              aria-label="课程"
              style={{ minWidth: 240 }}
              placeholder={courses.length === 0 ? '暂无可选课程' : '选择课程'}
              value={courseId || undefined}
              onChange={selectCourse}
              options={courseOptions}
            />
          </Space>

          {dataError && (
            <Alert
              type="warning"
              showIcon
              message="练习数据不可达"
              description={`${dataError}。练习数据经 8900；不可达时本面降级为空态，不影响其他界面。`}
              action={<Button size="small" onClick={retry}>重试</Button>}
            />
          )}

          <div key={reloadKey}>
            <Card size="small" title="今日面板">
              {courseId ? (
                <ChapterPractice courseId={courseId} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先选一门课" />
              )}
            </Card>
            <div style={{ marginTop: 12 }}>
              {courseId ? (
                <PracticePane courseId={courseId} />
              ) : (
                <Card size="small" title="题源工作区">
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先选一门课" />
                </Card>
              )}
            </div>
          </div>
        </Space>
      </Layout.Content>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} page="practice" />
    </Layout>
  );
}
