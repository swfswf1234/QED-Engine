/**
 * `af_kp` 梳理工作区的透传面封装（REQ-141 W3・一比一镜像）
 * 设计关联：docs/design/frontend/kp-review-ui.md（暂定）、docs/plans/2026-10-24-kp-review-screen-and-kp-passthrough.md
 * - **一比一镜像是刻意的**：路径与 Axiom-Flow 8902 逐字相同（`KP_MIRROR` 即壳的透传面镜像表），
 *   起别名或改形状等于把漂移藏进映射里；镜像守护见 `kp.test.ts`。
 * - 本文件是**形状腿**：十条腿的 8900 透传与真数据都已在册（REQ-143 W6 补齐长文两条腿、
 *   W25 补齐单点重生成腿）；`rev` 乐观并发的单点收口在 `stores/kpReview.ts`，不在本层记账。
 * - 只写人工可写的列：来源三列（`gen_batch`／`model_ref`／`gen_status`）与 `confirmed` 不出现在
 *   任何请求模型里（改不动是形状保证）；缺席与显式 `null` 是两件事，只发被点名的键。
 */
import { api } from './client';
import type { ApiRequestOptions } from './client';

/** 镜像表：`path` 用 8902 的原样（含 `/api/v1` 前缀），`client` 走相对 `API_BASE` 的同一形状 */
export const KP_MIRROR = [
  { method: 'POST', path: '/api/v1/kp-jobs', fn: 'createKpJob' },
  { method: 'GET', path: '/api/v1/books/{book_id}/kp-jobs/{gen_batch}', fn: 'getKpJobProgress' },
  { method: 'GET', path: '/api/v1/books/{book_id}/kp', fn: 'getKpWorkspace' },
  { method: 'PATCH', path: '/api/v1/kp/nodes/{node_id}', fn: 'patchKpNode' },
  { method: 'POST', path: '/api/v1/kp/nodes/{node_id}/confirm', fn: 'confirmKpNode' },
  { method: 'POST', path: '/api/v1/kp/nodes/{node_id}/summary', fn: 'regenerateKpSummary' },
  { method: 'PUT', path: '/api/v1/kp/nodes/{node_id}/narrative', fn: 'putKpNarrative' },
  { method: 'GET', path: '/api/v1/kp/nodes/{node_id}/narrative', fn: 'getKpNarrative' },
  { method: 'PUT', path: '/api/v1/books/{book_id}/kp/outline', fn: 'putKpOutline' },
  { method: 'GET', path: '/api/v1/books/{book_id}/kp/export', fn: 'getKpExport' },
] as const;

export type KpNodeKind = 'outline' | 'point';
/** 机器产物的三态（`draft`＝在飞、`candidate`＝待人工、`rejected`＝让位）；确认位不在本列 */
export type KpGenStatus = 'draft' | 'candidate' | 'rejected';
export type KpNodeRole = '' | 'core' | 'explainer' | 'example';
/** 四分类闭集：`''`＝未分；目录行恒空串（分类型属点，不属目录） */
export type KpNodeType = '' | 'memory' | 'procedure' | 'concept' | 'design';
export type KpLinkKind = 'prerequisite' | 'co_requisite' | 'explains' | 'exemplifies' | 'extends';

/** 一条关系边（`kind` 五种闭集；端点存在性与成环由服务端校验，违规 422 逐条点名） */
export interface KpLink {
  kind: KpLinkKind;
  to: string;
  note?: string;
}

/** 一条来源锚：页序＝PDF 页序，`block_indexes` 属该行 `job_id` 那一版的块序空间 */
export interface KpAnchorRef {
  kind?: string;
  ref_id?: string;
  page: number;
  block_indexes?: number[];
  snippet?: string;
}

/**
 * 四值展示类型（`KA-44` 读面派生，不落列）：`chapter`＝章节、`point`＝知识点、`exercise`＝习题、`other`＝其他。
 * 旧读面缺这一键时，屏侧按层数退「一层＝章节、其余＝知识点」（`stores/kpReview.ts` 的 `readNodeType`）。
 */
export type KpReadNodeType = 'chapter' | 'point' | 'exercise' | 'other';

/** `af_kp` 一行的响应投影（`norm_key` 与 `meta` 不外发） */
export interface KpNode {
  node_id: string;
  book_id: string;
  /** 取证版本；`''`＝人工直填行，无锚可解释 */
  job_id: string;
  node_kind: KpNodeKind;
  parent_id?: string | null;
  depth?: number | null;
  order_hint?: number | null;
  name: string;
  role?: KpNodeRole | string;
  type?: KpNodeType | string;
  summary?: string;
  links?: KpLink[];
  anchors?: KpAnchorRef[];
  /** 读面派生（`KA-44`）：章节／知识点／习题／其他四值；旧读面缺键时屏侧按层数退两值 */
  node_type?: KpReadNodeType | '';
  /** 读面派生（`KA-42`）：目录行＝切分区间（到下一枚目录行起点前 −1 页），点行＝自己锚点两端；缺＝`null` */
  page_start?: number | null;
  page_end?: number | null;
  narrative_ref?: string;
  gen_status: KpGenStatus;
  gen_batch?: string;
  model_ref?: string;
  confirmed: number;
  rev: number;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

/** 一条复核标记（只标记、只点名，不改写、不删行、不拦截） */
export interface KpReviewFlag {
  node_id: string;
  page: number;
  reason: string;
}

/** 整册工作区：目录＋点＋未归档池一次给全，不分页（翻页会把结构切成两屏） */
export interface KpWorkspace {
  book_id: string;
  /** 在飞批次号（无在飞为 `null`）；界面据此禁用提交 */
  in_flight_batch: string | null;
  nodes: KpNode[];
  review_flags: KpReviewFlag[];
}

/** 受理成功的批次身份（此后只用 `gen_batch` 轮询） */
export interface KpJobAccepted {
  book_id: string;
  gen_batch: string;
  evidence_job_id: string;
  page_start: number;
  page_end: number;
  status: 'queued';
}

/** 一行批次流水：只答「这一批发生过什么」，禁作当前态判据 */
export interface KpLedger {
  gen_batch: string;
  book_id: string;
  job_id: string;
  status: 'ok' | 'failed';
  page_start?: number | null;
  page_end?: number | null;
  /** 本批的人工评审意见恒发（缺省空串＝这一批没人留话）；取自流水 `payload`，对方判据 `KA-31` */
  review_note?: string;
  result?: Record<string, unknown> | null;
  error?: string;
  created_at?: string | null;
}

export interface KpJobProgress {
  book_id: string;
  gen_batch: string;
  /** 本批还有 `draft` 行就是在飞（不看流水行 `status`） */
  in_flight: boolean;
  /** 作用域是本批而非整册；五键恒发（缺格记 0） */
  counts: Record<string, number>;
  /** `null`＝流水还没写出（批次仍在跑或执行期自止） */
  ledger: KpLedger | null;
}

/** 人工背书域（白名单闭集：来源三列与确认位不在其中） */
export interface KpNodePatchInput {
  name?: string;
  /** 显式 `null`＝退未归档池；只写列、不校验父是否存在 */
  parent_id?: string | null;
  order_hint?: number | null;
  links?: KpLink[];
  anchors?: KpAnchorRef[];
  role?: KpNodeRole;
  type?: KpNodeType;
  summary?: string;
  /** 乐观并发：与当前 `rev` 不符即 409（缺省＝不比序号） */
  if_rev?: number;
}

/** 确认／撤回的结果：422 与 200 同形，故界面判 `missing` 而非判状态码 */
export interface KpConfirmResult {
  node_id: string;
  confirmed: number;
  rev: number;
  missing: string[];
}

/** 长文两条腿的响应：正文在磁盘上（列只存单段文件名），`exists=false` 是要显示出来的矛盾态 */
export interface KpNarrative {
  node_id: string;
  /** 文件在位时＝派生名单段名；缺文件时＝该列的原值（可能空串） */
  narrative_ref: string;
  /** `false`＝节点在、正文不在——上游判 200 而非 404，界面据此出中文空态 */
  exists: boolean;
  content: string;
  bytes: number;
  rev: number;
  updated_at?: string | null;
}

/** 目录声明的一项：只有身份与挂载两列（层数与名不是声明面能改的东西） */
export interface KpOutlineDeclaration {
  node_id: string;
  parent_id?: string | null;
  order_hint?: number;
}

export interface KpOutlineDeclareResult {
  book_id: string;
  /** 按声明序回显（界面不需要再排一次） */
  outline: KpNode[];
  /** 本次退池的点行数（写在之前算，不是「现在池里有几行」） */
  detached_points: number;
}

/** 只读导出面＝根侧拉取面：只给 `confirmed=1`，目录先于点 */
export interface KpExport {
  book_id: string;
  nodes: KpNode[];
  review_flags: KpReviewFlag[];
  total: number;
}

/**
 * `POST /api/v1/kp-jobs`：提交梳理批次（引擎取服务端槽位，缺配即 503，请求体点不了名）。
 * `review_note`＝人工评审意见（对方 PLAN-026 W11／`KA-31`）：≤2000 字、超限 422 不截断，
 * 由 8902 注入该轮两阶段 prompt 并随批次流水存档；8900 与本层都不解释它，空备注不发这一键。
 * `stage`＝本批跑哪几条腿（对方 `KA-34`／`KA-43`）：`outline` 只跑目录、知识点阶段整条不发起；
 * `content` 只补内容（须该书已有在册目录行）；值域判据正本在 8902，本层只定类型不重复校验。
 */
export function createKpJob(
  input: { book_id: string; page_start?: number; page_end?: number; review_note?: string; stage?: 'full' | 'outline' | 'content' },
  opts?: ApiRequestOptions,
): Promise<KpJobAccepted> {
  return api.post<KpJobAccepted>('/kp-jobs', input, opts);
}

/** `GET /api/v1/books/{book_id}/kp-jobs/{gen_batch}`：单批次进度与流水账面 */
export function getKpJobProgress(
  bookId: string,
  genBatch: string,
  opts?: ApiRequestOptions,
): Promise<KpJobProgress> {
  return api.get<KpJobProgress>(`/books/${bookId}/kp-jobs/${genBatch}`, opts);
}

/** `GET /api/v1/books/{book_id}/kp`：整册工作区（左栏目录与右栏点列表的唯一来源，含复核标记） */
export function getKpWorkspace(bookId: string, opts?: ApiRequestOptions): Promise<KpWorkspace> {
  return api.get<KpWorkspace>(`/books/${bookId}/kp`, opts);
}

/** `PATCH /api/v1/kp/nodes/{node_id}`：人工背书域写入（只发被点名的键，回显整行且 `rev` 已自增） */
export function patchKpNode(
  nodeId: string,
  input: KpNodePatchInput,
  opts?: ApiRequestOptions,
): Promise<KpNode> {
  return api.patch<KpNode>(`/kp/nodes/${nodeId}`, input, opts);
}

/** `POST /api/v1/kp/nodes/{node_id}/confirm`：确认置位跑可回指校验，撤回永远可执行 */
export function confirmKpNode(
  nodeId: string,
  input: { confirmed: boolean; if_rev?: number },
  opts?: ApiRequestOptions,
): Promise<KpConfirmResult> {
  return api.post<KpConfirmResult>(`/kp/nodes/${nodeId}/confirm`, input, opts);
}

/** 单点重生成的超时：一次同步的百秒级模型调用，与 8900→8902 的 360s 上限同界（再多也等不到） */
export const KP_REGENERATE_TIMEOUT_MS = 360_000;

/** `POST /api/v1/kp/nodes/{node_id}/summary`：知识点单点重生成（覆盖 `summary` 并自增 `rev`） */
export function regenerateKpSummary(
  nodeId: string,
  input: { if_rev?: number },
  opts?: ApiRequestOptions,
): Promise<KpNode> {
  return api.post<KpNode>(`/kp/nodes/${nodeId}/summary`, input, {
    timeoutMs: KP_REGENERATE_TIMEOUT_MS,
    ...opts,
  });
}

/** `PUT /api/v1/kp/nodes/{node_id}/narrative`：长文写腿（收一篇**已成文**的正文，回显同一篇） */
export function putKpNarrative(
  nodeId: string,
  input: { content: string; if_rev?: number },
  opts?: ApiRequestOptions,
): Promise<KpNarrative> {
  return api.put<KpNarrative>(`/kp/nodes/${nodeId}/narrative`, input, opts);
}

/** `GET /api/v1/kp/nodes/{node_id}/narrative`：长文读回（缺文件＝200 带 `exists=false`，不是 404） */
export function getKpNarrative(nodeId: string, opts?: ApiRequestOptions): Promise<KpNarrative> {
  return api.get<KpNarrative>(`/kp/nodes/${nodeId}/narrative`, opts);
}

/** `PUT /api/v1/books/{book_id}/kp/outline`：目录整批声明（缺席只降级、不删行、幂等） */
export function putKpOutline(
  bookId: string,
  declarations: KpOutlineDeclaration[],
  opts?: ApiRequestOptions,
): Promise<KpOutlineDeclareResult> {
  return api.put<KpOutlineDeclareResult>(`/books/${bookId}/kp/outline`, { declarations }, opts);
}

/** `GET /api/v1/books/{book_id}/kp/export`：已确认视图（提升腿的读面，根侧只读不写） */
export function getKpExport(bookId: string, opts?: ApiRequestOptions): Promise<KpExport> {
  return api.get<KpExport>(`/books/${bookId}/kp/export`, opts);
}
