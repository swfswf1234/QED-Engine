/**
 * 课程知识点详情 store（REQ-104 W8 只读层级图数据源；REQ-110 W3 起作为同页内课程层视图的数据源）
 * - 数据源：GET /learn/courses/{id}/knowledge-points?include_outline=true
 *   （一次取全层级：章/节 outline 行 + 知识点 point 行，交由 kpTreeLayout 画层级关系图）
 * - 课程介绍＝qed_course.description 经 8900 端点透传（W7）；空则界面不留占位
 * - 404 与「数据不可达」分两态（notFound / error）：设计稿 A §10 单页降级口径要求文案可辨
 * - 读量如实（REQ-147 W2）：`total`／`truncated` 入 store，触顶时由视图出一行，不把「载入数」当「全量」
 * - 只读面（裁决④/§11）：候选确认/驳回/手工登记等写操作归课程学习工作台批注闭环，本 store 不承载
 */
import { create } from 'zustand';
import { getCourseKnowledge, type CourseKnowledgeResponse, type KnowledgePoint } from '../api/learn';
import { ApiError, describeError } from '../api/client';

export interface CourseKnowledgeStore {
  courseId: string | null;
  course: CourseKnowledgeResponse['course'] | null;
  /** 全层级主表行（node_kind=outline 的章节点 + node_kind=point 的知识点）＝本次载入的行 */
  rows: KnowledgePoint[];
  /** 该课主表全量行数与服务端封顶旗标（REQ-147 W2）：读量不满一格时必须让界面知道 */
  total: number;
  truncated: boolean;
  loading: boolean;
  error: string | null;
  /** ?course= 指向不存在/已下线的课程（端点 404） */
  notFound: boolean;
  fetchCourse: (courseId: string) => Promise<void>;
}

export const useCourseKnowledgeStore = create<CourseKnowledgeStore>((set) => ({
  courseId: null,
  course: null,
  rows: [],
  total: 0,
  truncated: false,
  loading: false,
  error: null,
  notFound: false,

  fetchCourse: async (courseId) => {
    // 切课先清旧课程：面包屑与《课程名》不能挂着上一门课的名字等新数据
    set({
      loading: true, courseId, course: null, rows: [], total: 0, truncated: false,
      error: null, notFound: false,
    });
    try {
      const overview = await getCourseKnowledge(courseId, true);
      set({
        course: overview.course,
        rows: overview.points ?? [],
        total: overview.total,
        truncated: overview.truncated,
        error: null,
        notFound: false,
      });
    } catch (err) {
      set({
        error: describeError(err),
        notFound: err instanceof ApiError && err.status === 404,
        rows: [],
        total: 0,
        truncated: false,
      });
    } finally {
      set({ loading: false });
    }
  },
}));
