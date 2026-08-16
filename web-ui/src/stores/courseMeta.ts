/**
 * 课程元数据（公共）：领域映射 / 课程排序 / 先修依赖 / 学习阶段
 * - 数据源：QED-Tracker catalog math-qe（课程名）+ courses/math.json（stage/prerequisites，冻结内置文件）
 * - 过渡期前端内置常量（对齐 ARCH-004 D2 前端映射契约模式）；元数据入 DB 后经 8900
 *   GET /api/v1/courses 响应切换（接口契约见 stores/knowledge.ts listCourses）
 */

// --- 领域（course_id → 领域名；ARCH-004 D2 前端映射契约） ---

export const DOMAIN_MAP: Record<string, string> = {
  '01_math_analysis': '分析',
  '03_topology': '分析',
  '04_real_analysis': '分析',
  '05_complex_analysis': '分析',
  '06_functional_analysis': '分析',
  '07_ode': '分析',
  '08_pde': '分析',
  '10_qe_prep': '分析',
  '02_linear_algebra': '代数',
  '09_abstract_algebra': '代数',
  '11_probability': '概率论与数理统计',
  '12_stochastic_processes': '概率论与数理统计',
  '13_high_dim_prob': '概率论与数理统计',
};

/** 领域稳定顺序 */
export const DOMAIN_ORDER = ['分析', '代数', '概率论与数理统计'];

/** 领域兜底（未在 DOMAIN_MAP 的课程） */
export const DOMAIN_OTHER = '其他';

/** 课程排序（catalog targets 课程去重后的稳定顺序；10_qe_prep 在末尾） */
export const COURSE_ORDER = [
  '01_math_analysis', '02_linear_algebra', '03_topology', '04_real_analysis',
  '05_complex_analysis', '06_functional_analysis', '07_ode', '08_pde',
  '09_abstract_algebra', '11_probability', '12_stochastic_processes',
  '13_high_dim_prob', '10_qe_prep',
];

export function domainOf(courseId: string): string {
  return DOMAIN_MAP[courseId] ?? DOMAIN_OTHER;
}

export function courseOrderCmp(a: string, b: string): number {
  const ia = COURSE_ORDER.indexOf(a);
  const ib = COURSE_ORDER.indexOf(b);
  return ((ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)) || a.localeCompare(b);
}

// --- 学习阶段（courses/math.json stages，对齐 2026-08 冻结） ---

export type CourseStage = 'basic' | 'advanced' | 'graduate' | 'qe';

export const STAGE_ORDER: CourseStage[] = ['basic', 'advanced', 'graduate', 'qe'];

export const STAGE_LABELS: Record<CourseStage, string> = {
  basic: '本科基础',
  advanced: '本科进阶',
  graduate: '研究生基础',
  qe: 'QE 冲刺',
};

/** course_id → 学习阶段（courses/math.json stage 对齐；catalog 13 门） */
export const COURSE_STAGE: Record<string, CourseStage> = {
  '01_math_analysis': 'basic',
  '02_linear_algebra': 'basic',
  '03_topology': 'basic',
  '07_ode': 'advanced',
  '04_real_analysis': 'graduate',
  '05_complex_analysis': 'graduate',
  '06_functional_analysis': 'graduate',
  '08_pde': 'graduate',
  '09_abstract_algebra': 'graduate',
  '11_probability': 'graduate',
  '12_stochastic_processes': 'graduate',
  '13_high_dim_prob': 'graduate',
  '10_qe_prep': 'qe',
};

// --- 先修依赖（courses/math.json prerequisites 对齐；catalog 13 门内闭合） ---

/** course_id → 先修课程 id 列表（先修 → 后修箭头） */
export const COURSE_PREREQUISITES: Record<string, string[]> = {
  '01_math_analysis': [],
  '02_linear_algebra': [],
  '03_topology': ['01_math_analysis', '02_linear_algebra'],
  '04_real_analysis': ['03_topology'],
  '05_complex_analysis': ['03_topology'],
  '06_functional_analysis': ['04_real_analysis', '05_complex_analysis'],
  '07_ode': ['01_math_analysis'],
  '08_pde': ['01_math_analysis', '07_ode'],
  '09_abstract_algebra': ['02_linear_algebra'],
  '10_qe_prep': [
    '01_math_analysis', '03_topology', '04_real_analysis', '05_complex_analysis',
    '06_functional_analysis', '07_ode', '08_pde', '09_abstract_algebra',
    '11_probability', '13_high_dim_prob',
  ],
  '11_probability': ['04_real_analysis'],
  '12_stochastic_processes': ['11_probability'],
  '13_high_dim_prob': ['11_probability'],
};
