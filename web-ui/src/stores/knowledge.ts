/**
 * 学习中心·知识结构浏览 store（原型：课程依赖图 + 知识点结构空态）
 * - 数据源：/catalogs/math-qe（课程名/排序，唯一后端依赖；8901 离线 → 降级空态）
 * - 课程依赖（先修/stage）：过渡期前端常量（courseMeta，对齐 courses/math.json）；
 *   元数据入 DB 后经 8900 GET /api/v1/courses 响应切换（接口 listCourses 契约预留）
 * - 课程图纯函数 buildCourseGraph：stage 分层 + 先修→后修边
 */
import { create } from 'zustand';
import { listCatalog } from '../api/tracker';
import { api } from '../api/client';
import {
  COURSE_PREREQUISITES, COURSE_STAGE, STAGE_ORDER,
  courseOrderCmp,
} from './courseMeta';
import type { CatalogTarget } from './index';
import type { CourseStage } from './courseMeta';

/** 未来契约：8900 数据域·QED-Tracker 课程响应（元数据入 DB 后启用，当前未实现） */
export interface CourseMetaDto {
  course_id: string;
  name: string;
  domain_id: string;
  stage: string;
  prerequisites: string[];
}

/** 预留契约：GET /api/v1/courses（8900）；当前后端未实现 → 前端用 courseMeta 常量兜底 */
export async function listCourses(): Promise<CourseMetaDto[]> {
  return api.get<CourseMetaDto[]>('/courses');
}

// --- 课程图纯函数 ---

export interface GraphCourse {
  id: string;
  name: string;
  stage: CourseStage;
  /** 先修课程 id（对齐 courses/math.json prerequisites） */
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

/** catalog targets → 课程图（13 门课程 + 依赖边；stage 按 COURSE_STAGE，顺序按 COURSE_ORDER） */
export function buildCourseGraph(catalogTargets: CatalogTarget[]): CourseGraph {
  const byId = new Map<string, CatalogTarget>();
  for (const t of catalogTargets) {
    if (!byId.has(t.course_id)) byId.set(t.course_id, t);
  }
  const courses: GraphCourse[] = [...byId.values()]
    .map((t) => ({
      id: t.course_id,
      name: t.course_name || t.course_id,
      stage: COURSE_STAGE[t.course_id] ?? 'graduate',
      prerequisites: COURSE_PREREQUISITES[t.course_id] ?? [],
    }))
    .sort((a, b) => courseOrderCmp(a.id, b.id));
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
    const [catalog, err] = await listCatalog()
      .then((c) => [c, null] as const)
      .catch((e) => [null, e] as const);
    set({
      catalogTargets: catalog?.targets ?? get().catalogTargets,
      error: err ? (err instanceof Error ? err.message : String(err)) : null,
    });
    set({ loading: false });
  },
}));
