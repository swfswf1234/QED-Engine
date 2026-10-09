/**
 * 课程知识点详情 store（M5 demo：候选池 → 人工确认 → 提升主表）
 * - 数据源：GET /learn/courses/{id}/knowledge-points（已确认 + 同 norm_key 候选组）
 *           GET /learn/kp-details?course={id}（待选池全量，未归入已确认的叙述从这里出）
 * - 写面：POST /learn/kp-details（手工登记候选）、…/confirm（提升，重复 norm_key 409）、…/reject
 * - 任何写操作后整体重取，界面状态始终跟随服务端（demo 不做乐观更新）
 */
import { create } from 'zustand';
import {
  addKpDetail, confirmKpDetail, getCourseKnowledge, listKpDetails, rejectKpDetail,
  type KnowledgePoint, type KnowledgePointType, type KpDetailRow,
} from '../api/learn';
import { describeError } from '../api/client';

const OPEN_STATUSES = new Set(['draft', 'candidate']);

export interface LooseCandidate {
  detailId: string;
  name: string;
  type: KnowledgePointType | null;
  narrative: string;
  genStatus: string;
}

export interface CourseKnowledgeStore {
  courseId: string | null;
  course: { course_id: string; name: string; track: string; domain_id: string } | null;
  points: KnowledgePoint[];
  /** 待选池中尚未归入任何已确认知识点的叙述 */
  loose: LooseCandidate[];
  candidateTotal: number;
  loading: boolean;
  error: string | null;
  /** 最近一次写操作回执（成功提示或 409/503 文案） */
  notice: string | null;
  fetchCourse: (courseId: string) => Promise<void>;
  confirmCandidate: (detailId: string) => Promise<void>;
  rejectCandidate: (detailId: string) => Promise<void>;
  addCandidate: (input: { name: string; type?: KnowledgePointType; narrative: string }) => Promise<boolean>;
  clearNotice: () => void;
}

function toLoose(row: KpDetailRow): LooseCandidate {
  return {
    detailId: row.detail_id,
    name: row.name,
    type: row.type ?? null,
    narrative: row.narrative,
    genStatus: row.gen_status,
  };
}

export const useCourseKnowledgeStore = create<CourseKnowledgeStore>((set, get) => ({
  courseId: null,
  course: null,
  points: [],
  loose: [],
  candidateTotal: 0,
  loading: false,
  error: null,
  notice: null,

  fetchCourse: async (courseId) => {
    set({ loading: true, courseId });
    try {
      const [overview, pool] = await Promise.all([
        getCourseKnowledge(courseId),
        listKpDetails(courseId),
      ]);
      const claimed = new Set(overview.points.map((p) => p.norm_key));
      set({
        course: overview.course,
        points: overview.points,
        candidateTotal: overview.candidate_total,
        loose: pool.details
          .filter((row) => OPEN_STATUSES.has(row.gen_status) && !claimed.has(row.norm_key))
          .map(toLoose),
        error: null,
      });
    } catch (err) {
      set({ error: describeError(err) });
    } finally {
      set({ loading: false });
    }
  },

  confirmCandidate: async (detailId) => {
    try {
      const { point } = await confirmKpDetail(detailId);
      set({ notice: `已确认并提升：${point.name}` });
    } catch (err) {
      set({ notice: describeError(err) });
    }
    const id = get().courseId;
    if (id) await get().fetchCourse(id);
  },

  rejectCandidate: async (detailId) => {
    try {
      await rejectKpDetail(detailId);
      set({ notice: '已驳回（不落主表，可重新登记新候选）' });
    } catch (err) {
      set({ notice: describeError(err) });
    }
    const id = get().courseId;
    if (id) await get().fetchCourse(id);
  },

  addCandidate: async (input) => {
    try {
      await addKpDetail({
        course_id: get().courseId ?? '',
        name: input.name,
        type: input.type,
        narrative: input.narrative,
        gen_batch: 'manual-demo',
      });
      set({ notice: `候选已登记：${input.name}` });
      const id = get().courseId;
      if (id) await get().fetchCourse(id);
      return true;
    } catch (err) {
      set({ notice: describeError(err) });
      return false;
    }
  },

  clearNotice: () => set({ notice: null }),
}));
