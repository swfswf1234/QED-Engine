/**
 * 学习中心·知识结构浏览 store（课程依赖图 + 知识点结构）
 * - 数据源：
 *   ① /catalogs/math-qe（课程名/排序，唯一后端依赖；8901 离线 → 降级空态）
 *   ② GET /courses（领域课程体系，含 stage/prerequisites；qed_course 表驱动）
 * - 课程图纯函数 buildCourseGraph：stage 分层 + 先修→后修边
 * - 2026-09-01 REQ-035：stage/prerequisites 从 courses/math.json 硬编码切换为 DB 驱动
 */
import { create } from 'zustand';
import { listCatalog, listCourseSystem } from '../api/tracker';
import {
  STAGE_ORDER,
  stageKey,
} from './courseMeta';
import type { CatalogTarget, CourseRecord } from './index';
import type { CourseStage } from './courseMeta';

// --- 课程图纯函数 ---

export interface GraphCourse {
  id: string;
  name: string;
  stage: CourseStage;
  /** 先修课程 id 列表 */
  prerequisites: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface CourseGraph {
  courses: GraphCourse[];
  edges: GraphEdge[];
}

/**
 * 构建课程依赖图
 * @param catalogTargets - 课程名列表（来自 /catalogs/math-qe）
 * @param courseMetaMap - 课程元数据映射（来自 GET /courses，qed_course 表）
 *   - 若为空 Map，stage 兜底 'graduate'，先修为空（8901 离线降级）
 */
export function buildCourseGraph(
  catalogTargets: CatalogTarget[],
  courseMetaMap?: Map<string, CourseRecord>,
): CourseGraph {
  const byId = new Map<string, CatalogTarget>();
  for (const t of catalogTargets) {
    if (!byId.has(t.course_id)) byId.set(t.course_id, t);
  }
  const courses: GraphCourse[] = [...byId.values()]
    .map((t) => {
      const meta = courseMetaMap?.get(t.course_id);
      return {
        id: t.course_id,
        name: t.course_name || t.course_id,
        stage: meta ? stageKey(meta.stage) : 'graduate',
        prerequisites: meta?.prerequisites ?? [],
      };
    })
    .sort((a, b) => {
      // 按 stage 分层排序（basic → advanced → graduate → qe），同层按 id
      const si = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
      return si !== 0 ? si : a.id.localeCompare(b.id);
    });
  const edges: GraphEdge[] = [];
  for (const c of courses) {
    for (const pre of c.prerequisites) {
      if (byId.has(pre)) edges.push({ from: pre, to: c.id });
    }
  }
  return { courses, edges };
}

/** stage 分层索引（courseId → 层序号，STAGE_ORDER） */
export function stageIndexOf(stage: CourseStage): number {
  return STAGE_ORDER.indexOf(stage);
}

// --- store ---

export interface KnowledgeStore {
  catalogTargets: CatalogTarget[];
  /** 课程元数据映射（course_id → CourseRecord，来自 GET /courses） */
  courseMetaMap: Map<string, CourseRecord>;
  loading: boolean;
  error: string | null;
  /** 当前选中领域（学科级：数学；未来多领域） */
  domain: string;
  /** 当前选中课程（null = 课程结构图态；非 null = 知识结构图态） */
  selectedCourseId: string | null;
  selectDomain: (domain: string) => void;
  selectCourse: (courseId: string | null) => void;
  fetchAll: () => Promise<void>;
}

export const KNOWLEDGE_DOMAINS = ['数学'];

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  catalogTargets: [],
  courseMetaMap: new Map(),
  loading: false,
  error: null,
  domain: KNOWLEDGE_DOMAINS[0],
  selectedCourseId: null,

  selectDomain: (domain) => {
    set({ domain, selectedCourseId: null });
  },

  selectCourse: (courseId) => {
    set({ selectedCourseId: courseId });
  },

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });

    // 并行请求：catalog（课程名）+ courseSystem（stage/prerequisites）
    const [catalogResult, courseSystemResult] = await Promise.all([
      listCatalog()
        .then((c) => [c, null] as const)
        .catch((e) => [null, e] as const),
      listCourseSystem()
        .then((cs) => [cs, null] as const)
        .catch(() => [null, null] as const), // 离线降级：不报错，用空 Map
    ]);

    const [catalog, err] = catalogResult;

    // 构建 courseMetaMap：从 DomainSystem[] 展平为 Map<course_id, CourseRecord>
    const courseMetaMap = new Map<string, CourseRecord>();
    if (courseSystemResult[0]) {
      for (const domain of courseSystemResult[0]) {
        for (const course of domain.courses) {
          courseMetaMap.set(course.course_id, course);
        }
      }
    }

    set({
      catalogTargets: catalog?.targets ?? get().catalogTargets,
      courseMetaMap,
      error: err ? (err instanceof Error ? err.message : String(err)) : null,
    });
    set({ loading: false });
  },
}));
