/**
 * 课程知识点·层级星图布局纯函数（设计：docs/design/knowledge-point-exploration-ui.md §9）
 * 版式＝**大知识点虚框自上而下按学习顺序堆叠、框内条目排行优先网格**（REQ-113）：
 * - 语义是两级知识粒度而非文档三级：outline depth1＝大知识点（虚框容器），
 *   outline depth2 与归入的 `point` 行都是**框内条目**（point 的父为节时归到该节所在的框），不另立第三层
 * - 归属只由虚框几何承载：`parent_kp_id` 仅参与归框计算，**不产生边集与归属文案**
 * - `parent_kp_id` 空／悬空的 point 与父悬空的节都不进图，也不补画虚拟框（学习面不出现「未归档」）
 * - 定序＝`order_hint` 升序 → 空值按来源锚最小页码（`source_ref.page_start`／`anchors[].page`）
 *   → 名称码点 → 行 id；确定性＝同输入同图（无随机无时间因子）
 * - 坐标＝**内容左上角为原点的数据坐标**（像素）：框宽由内容区实测宽扣掉画布留白推出，
 *   渲染层按同一留白外扩成画布，使 ECharts view 坐标系的套满系数为 1（框宽与圆点都按 authored 像素落画）
 */

/** 主表行在本布局只用到的投影列（outline 与 point 混排） */
export interface KpTreeRow {
  kp_id: string;
  name: string;
  node_kind?: string | null;
  parent_kp_id?: string | null;
  depth?: number | null;
  order_hint?: number | null;
  summary?: string;
  source_ref?: { kind?: string; ref_id?: string; page_start?: number; page_end?: number } | null;
  anchors?: unknown[] | null;
}

/** 画布四周留白：与渲染层 series 的 left/right/top/bottom 配对，是「数据坐标＝像素」的锚 */
export const KP_CANVAS_PAD = 20;
/** 内容区未测得（首帧／jsdom 宽度 0）时的框宽兜底 */
export const KP_BOX_MIN_W = 620;
/** 框与框的纵向间距（堆叠顺序＝学习顺序） */
export const KP_BOX_GAP = 22;
/** 框内顶部名称带高（虚框名称写在这一条里） */
export const KP_NAME_BAND_H = 34;
/** 条目区相对框边的内缩（上下各一份，左右各一份） */
export const KP_BOX_INSET = 14;
/** 条目格宽：一格＝发光圆点＋常驻名称标签 */
export const KP_CELL_W = 200;
/** 条目行高 */
export const KP_CELL_H = 36;
/** 条目圆点半径（大知识点由框承载，条目一律同尺寸） */
export const KP_ITEM_R = 5;

/** 大知识点虚框：坐标＝框中心（ECharts 符号以中心定位），w/h 为像素 */
export interface KpBoxNode {
  id: string;
  name: string;
  summary: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 框内条目（小知识点＝outline depth2，归入的知识点＝point） */
export interface KpItemNode {
  id: string;
  name: string;
  summary: string;
  x: number;
  y: number;
  r: number;
}

export interface KpTreeLayout {
  boxes: KpBoxNode[];
  items: KpItemNode[];
  /** 内容包围尺寸（不含画布留白；渲染层加 2×KP_CANVAS_PAD 得画布尺寸） */
  width: number;
  height: number;
}

const NO_ORDER = Number.MAX_SAFE_INTEGER;

/** 来源锚最小页码：outline 行取 `source_ref.page_start`，point 行取 `anchors[].page` 最小值 */
function minPage(row: KpTreeRow): number | null {
  const start = row.source_ref?.page_start;
  if (typeof start === 'number' && Number.isFinite(start)) return start;
  let best: number | null = null;
  for (const anchor of row.anchors ?? []) {
    const page = (anchor as { page?: unknown } | null)?.page;
    if (typeof page === 'number' && Number.isFinite(page) && (best === null || page < best)) best = page;
  }
  return best;
}

/** 定序键：order_hint 优先，空值按来源锚页序兜底，两者皆空排到最后 */
const orderKey = (row: KpTreeRow) =>
  (typeof row.order_hint === 'number' ? row.order_hint : minPage(row) ?? NO_ORDER);

function siblingCompare(a: KpTreeRow, b: KpTreeRow): number {
  const order = orderKey(a) - orderKey(b);
  if (order !== 0) return order;
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.kp_id < b.kp_id ? -1 : a.kp_id > b.kp_id ? 1 : 0;
}

interface Box {
  row: KpTreeRow;
  members: KpTreeRow[];
}

/**
 * 主入口：行数组（顺序无关）＋内容区实测宽 → 层级星图布局（虚框堆叠坐标＋条目网格坐标）。
 * 归不上框的行（无父／悬空父的 point、父悬空的节）按设计不进本面：既不补画虚拟框也不画该点。
 */
export function kpTreeLayout(rows: KpTreeRow[], contentWidth = 0): KpTreeLayout {
  const boxes: Box[] = [];
  const boxOf = new Map<string, Box>();
  const sectionOf = new Map<string, Box>();
  const orphans: KpTreeRow[] = [];

  for (const r of rows) {
    if (r.node_kind !== 'outline') orphans.push(r);
    else if (r.depth === 2) sectionOf.set(r.kp_id, null as unknown as Box);
    else {
      const box: Box = { row: r, members: [] };
      boxes.push(box);
      boxOf.set(r.kp_id, box);
    }
  }
  for (const r of rows) {
    if (r.node_kind !== 'outline' || r.depth !== 2) continue;
    const box = r.parent_kp_id ? boxOf.get(r.parent_kp_id) : undefined;
    if (!box) continue;
    sectionOf.set(r.kp_id, box);
    box.members.push(r);
  }
  for (const r of orphans) {
    if (!r.parent_kp_id) continue;
    const box = boxOf.get(r.parent_kp_id) ?? sectionOf.get(r.parent_kp_id) ?? null;
    // sectionOf 里未归框的节是 null：父挂在其下同样不进图
    if (box) box.members.push(r);
  }

  boxes.sort((a, b) => siblingCompare(a.row, b.row));
  boxes.forEach((box) => box.members.sort((a, b) => siblingCompare(a, b)));

  const boxW = Math.max(KP_BOX_MIN_W, contentWidth - 2 * KP_CANVAS_PAD);
  const cols = Math.max(1, Math.floor((boxW - 2 * KP_BOX_INSET) / KP_CELL_W));

  const outBoxes: KpBoxNode[] = [];
  const outItems: KpItemNode[] = [];
  let top = 0;
  for (const box of boxes) {
    const gridRows = Math.ceil(box.members.length / cols);
    const h = KP_NAME_BAND_H + 2 * KP_BOX_INSET + gridRows * KP_CELL_H;
    outBoxes.push({
      id: box.row.kp_id,
      name: box.row.name ?? '',
      summary: box.row.summary ?? '',
      x: boxW / 2,
      y: top + h / 2,
      w: boxW,
      h,
    });
    box.members.forEach((m, i) => {
      outItems.push({
        id: m.kp_id,
        name: m.name ?? '',
        summary: m.summary ?? '',
        x: KP_BOX_INSET + (i % cols) * KP_CELL_W + KP_ITEM_R,
        y: top + KP_NAME_BAND_H + KP_BOX_INSET + Math.floor(i / cols) * KP_CELL_H + KP_CELL_H / 2,
        r: KP_ITEM_R,
      });
    });
    top += h + KP_BOX_GAP;
  }

  return {
    boxes: outBoxes,
    items: outItems,
    width: boxW,
    height: outBoxes.length > 0 ? top - KP_BOX_GAP : 0,
  };
}
