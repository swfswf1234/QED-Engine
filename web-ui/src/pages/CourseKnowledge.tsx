/**
 * 知识探索·课程层级星图视图（REQ-113 W3~W4：七审改判，大知识点虚框＋框内小知识点条目）
 * - 设计：docs/design/knowledge-point-exploration-ui.md §9/§10
 *   （承载页面＝Knowledge.tsx 单页；本视图是被替换进主体的那一段，URL 形态 `#/knowledge?course={id}`）
 * - 主体只画虚框堆叠与框内条目网格，几何决策在 kpTreeLayout 纯函数；**归属由虚框承载，不画层级线**
 * - 画布宽＝内容区实测宽（由 Knowledge.tsx 的 ResizeObserver 传入），超高由外层纵向滚动
 * - 页头按钮、大标题与面包屑归 Knowledge.tsx：本视图零导航按钮，**不挂领域下拉**（换领域只经面包屑回领域层）
 * - 课程名行＝本视图唯一标题（《课程名》＋介绍），只显一处不与图区重复
 * - 无浅色卡：图区直接画在星空层上，控件与文字随页面级暗色 ConfigProvider（五审裁决 2026-10-14）
 * - 零写面（§11）：候选确认/驳回/登记归工作台批注闭环（M6），本视图不请求候选池
 */
import { useEffect, useMemo } from 'react';
import { Alert, Button, Spin, Typography } from 'antd';
import KpTreeGraph from '../components/KpTreeGraph';
import { kpTreeLayout } from '../components/kpTreeLayout';
import { useCourseKnowledgeStore } from '../stores/courseKnowledge';
import '../knowledge.css';

const { Title, Text, Paragraph } = Typography;

export default function CourseKnowledge({ courseId, contentWidth = 0 }: { courseId: string; contentWidth?: number }) {
  const course = useCourseKnowledgeStore((s) => s.course);
  const rows = useCourseKnowledgeStore((s) => s.rows);
  const loading = useCourseKnowledgeStore((s) => s.loading);
  const error = useCourseKnowledgeStore((s) => s.error);
  const notFound = useCourseKnowledgeStore((s) => s.notFound);
  const fetchCourse = useCourseKnowledgeStore((s) => s.fetchCourse);

  useEffect(() => {
    if (courseId) void fetchCourse(courseId);
  }, [courseId, fetchCourse]);

  const layout = useMemo(() => kpTreeLayout(rows, contentWidth), [rows, contentWidth]);

  return (
    <div className="kn-course">
      <Title level={4} style={{ marginTop: 0, marginBottom: course?.description ? 6 : 18, color: '#f2f6ff' }}>
        《{course?.name ?? courseId}》
      </Title>
      {course?.description && (
        <Paragraph style={{ marginBottom: 18, color: '#a9bde3', maxWidth: 920 }}>
          {course.description}
        </Paragraph>
      )}

      {error && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message={notFound ? '课程不存在或已下线' : '知识点数据不可达'}
          description={notFound ? '可通过上方面包屑返回知识探索，或换一门课程。' : error}
          action={notFound ? undefined : <Button size="small" onClick={() => void fetchCourse(courseId)}>重试</Button>}
        />
      )}

      {!error && (loading && rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>
      ) : layout.boxes.length > 0 ? (
        <KpTreeGraph layout={layout} />
      ) : (
        <div className="kn-empty kn-empty-dark">
          <Text style={{ color: '#a9bde3' }}>该课程暂无已确认知识点</Text>
        </div>
      ))}
    </div>
  );
}
