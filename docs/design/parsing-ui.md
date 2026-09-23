# 文档解析管理 UI 设计（parsing-ui）

设计状态：Accepted
实现状态：Implemented
最后更新：2026-09-23
确认状态：已确认
关联代码：`web-ui/src/pages/Parsing.tsx`、`web-ui/src/stores/parsing.ts`、`web-ui/src/api/axiom.ts`、
`web-ui/src/components/parsing/`（BookTree/ParseToolbar/CompareView/PageImagePane/BlockList/BlockEditor/ResourceWatch/blocks.ts）
关联测试：`web-ui/src/pages/Parsing.test.tsx`、`web-ui/src/components/parsing/ResourceWatch.test.tsx`、`tests/contract/test_design_documents.py`（本文件入 CURRENT_DOCUMENTS）
关联 ADR：[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)（解析能力归属与模型边界）、[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、[ADR 0017](../adr/0017-design-doc-structure-contract.md)（本文档结构契约与事实源唯一铁律）
关联设计：[frontend-architecture.md](../architecture/frontend-architecture.md)（8903 信息架构与视觉规范）、
[downloads-ui.md](downloads-ui.md)（左树与状态点风格参照）、
[local-model-management.md](local-model-management.md)（模型生命周期操作面）、
[parsing-flow.md](parsing-flow.md)（后端全链路设计）
关联计划：界面形态演进经 git 历史与 `history/plans/2026-09/` 各计划壳追溯

## 1. 定位与目标

本文档是「文档解析管理页」（`#/admin/parsing`）的 **UI 设计事实源**：信息架构、组件
拆分、状态模型、对照交互、bbox 联动、编辑与资源告警的用户可见表现。它回答的是
「用户在这页如何选书、入库、发起解析、对照阅读并逐块判定修正」。

- **目标**：单屏完成「选书 → 书页入库 → 解析 → 原页/解析双栏对照 → 逐块判定与修正」，
  交互现场即可感知资源与模型服务风险；
- **成功标准**：任一页面状态（未入库/已入库未解析/已解析/任务在飞/依赖离线/显存爆表）
  均有且只有一种明确的用户可见表现；对照与编辑操作不依赖后端内部结构，后端全链路
  演进（版本布局等）界面契约不变。

## 2. 范围与非目标

本档**不**维护以下内容，逐条给出唯一事实源指针（[ADR 0017](../adr/0017-design-doc-structure-contract.md) 事实源唯一铁律：UI 文档只写消费语义，不复制端点形状与数据契约）：

| 内容 | 唯一事实源 |
| --- | --- |
| 后端全链路职责、任务状态机、版本激活与续跑规则 | [parsing-flow.md](parsing-flow.md) |
| 端点路径与请求/响应形状（本档 §6 只登记消费要点） | [api-contracts.md](../architecture/api-contracts.md) §④ |
| `af_*` 表结构与 `parsed/` 产物布局 | [parsing-flow.md](parsing-flow.md) §2 指针表所列事实源 |
| blocks 产物 schema 与字段语义 | [parsing-flow.md](parsing-flow.md) §6 |
| 模型启停/探针/槽位生命周期设计 | [local-model-management.md](local-model-management.md) |
| 8903 全局信息架构与视觉基线 | [frontend-architecture.md](../architecture/frontend-architecture.md) |

## 3. 信息架构与路由（单屏：左树 + 右对照）

- 路由 `#/admin/parsing`（AdminLayout 嵌套，菜单项「文档解析管理」）；
- **一屏完成**：`Row`＝左 **书目树 lg=5**（§7，纯选择）＋ 右 **对照区 lg=19**（§8 顶栏 + §9 双栏）；
  点树中书名 → 右侧直接切到该书对照，**无列表态/工作台态切换**；
  URL hash 携带 `?book=<id>&page=<n>`，刷新/书签恢复；
- 页面容器：`Layout.Content`（`padding 24`、`maxWidth 2400`、`width 98%`、居中）
  + 顶部标题行（标题「文档解析管理」＋「刷新」（含同步书目））；
- **对照展示基准 = A4「Word 100%」纸面**（794×1123px @96dpi）：原文页与解析文档纸面
  同宽并排（各占对照区半幅），容器超宽出横向滚动条看全页；
- **原始文件优先**：未解析页隐藏解析模块、页图/PDF 直显（§9 态分流）。

## 4. 组件树与职责

```mermaid
flowchart TD
    P[Parsing.tsx 页面容器 单屏] --> BT[BookTree 左书目树 纯选择]
    P --> C[右对照区]
    P --> RW[ResourceWatch 资源告警弹窗 无 UI 输出]
    C --> TB[ParseToolbar 对照顶栏]
    C --> CV[CompareView 双栏容器]
    CV --> PI[PageImagePane 原文页 + bbox overlay]
    CV --> BL[BlockList 解析文档块渲染]
    BL --> BE[BlockEditor 单块编辑]
```

| 文件 | 职责 |
| --- | --- |
| `web-ui/src/pages/Parsing.tsx` | 页面容器：单屏布局（左树 + 右对照）、URL hash 同步、全局横幅（8900 错误 / 8902 降级 / 同步结果） |
| `web-ui/src/components/parsing/BookTree.tsx` | 左书目树：领域→课程→书三级（数据源 `/parsing/tree`），**纯选择**，无状态徽标/筛选 |
| `web-ui/src/components/parsing/ParseToolbar.tsx` | 对照顶栏：书名、页码导航、滚动模式、同步滚动、缩放、解析本页/全本、书页入库、任务进度、审阅统计（**无 engine 选择**） |
| `web-ui/src/components/parsing/CompareView.tsx` | 双栏容器：态分流（§9）、单页模式 / 连续滚动模式、滚动同步 |
| `web-ui/src/components/parsing/PageImagePane.tsx` | 原文页 + bbox overlay（hover/选中联动） |
| `web-ui/src/components/parsing/BlockList.tsx` | 解析文档渲染（流式/版式两模式，KaTeX/Markdown/表格）+ 选中联动 |
| `web-ui/src/components/parsing/BlockEditor.tsx` | 单块编辑：文字修正（公式为 LaTeX 源码）+ 范围数值修正 + 判定/备注 Popover |
| `web-ui/src/components/parsing/ResourceWatch.tsx` | 资源告警弹窗（§12）：10s 轮询 `/monitor/gpu` + `/models/vision`，显存 ≥95% 与模型服务中断各一路 notification，无自身界面 |
| `web-ui/src/components/parsing/blocks.ts` | 块渲染工具（`tryRenderKatex`/`renderInlineMath`/`blockText`/`TYPE_LABELS`） |
| `web-ui/src/stores/parsing.ts` | 树/选中书/页/任务/编辑状态与动作 |
| `web-ui/src/api/axiom.ts` | 8900 适配端点封装与类型 |

块渲染与判定为两套独立能力：渲染在 `BlockList`（+`blocks.ts`），判定/编辑在 `BlockEditor`。

## 5. 状态模型（stores/parsing.ts）

```ts
interface ParsingStore {
  // 书目树（数据源 /parsing/tree：领域→课程→书，纯选择）
  tree: ParsingTreeNode[];
  treeLoading: boolean;
  treeError: string | null;
  // 书目元数据（GET /books，用于选中书的 ingest/parse/file_path/page_count）
  books: BookMeta[];
  booksLoading: boolean;
  // 全局降级
  error: string | null;        // 8900 不可达
  dataError: string | null;    // 8902 离线（503）
  syncMessage: string | null;
  syncError: string | null;
  // 对照区选中
  compareBookId: string | null;
  comparePageNo: number;
  compareBook: BookMeta | null;
  pages: Record<number, PageEntry>;  // 页数据缓存（连续滚动窗口）
  selectedBlock: number;       // -1 无选中
  hoveredBlock: number;        // -1 无 hover
  editMode: boolean;           // 只读 / 编辑
  viewMode: 'compare' | 'original' | 'parsed';
  scrollMode: 'single' | 'continuous';
  renderMode: 'stream' | 'layout';
  syncScroll: boolean;
  zoom: number;
  // 解析任务
  activeJob: ParseJob | null;
  jobError: string | null;
  ingestBusy: Record<string, boolean>;
  edits: Record<string, BlockEdit>;   // editKey(bookId,pageNo,index)
  editSubmitting: boolean;
  engine: string;              // 固定默认（UI 不暴露选择）
  // 动作
  fetchTree: () => Promise<void>;
  fetchBooks: (sync?: boolean) => Promise<void>;  // 刷新按钮：sync=true 先 POST /books/sync
  openWorkbench: (bookId: string, pageNo?: number) => Promise<void>; // 点树选书（含未 ingest 态分流）
  loadPage: (pageNo: number) => Promise<void>;
  ensurePage: (pageNo: number) => Promise<void>;   // 连续滚动窗口预取
  gotoPage: (delta: number) => void;
  selectBlock: (index: number) => void;
  setEditMode: (on: boolean) => void;
  setViewMode / setScrollMode / setRenderMode / setSyncScroll / setZoom / setEngine;
  submitEdit: (blockIndex: number, input: BlockEditInput) => Promise<boolean>;
  ingestBook: (bookId: string) => Promise<void>;
  createParseJob: (pages?: number[]) => Promise<void>;  // 本页 [n] / 全本 undefined / 失败页 [..]
  clearCompare: () => void;
}
```

规则：

- 树中点选书即 `openWorkbench(bookId, pageNo)`，无视图态分支；
- 「刷新」按钮 = `fetchBooks(true)`（`POST /books/sync` → 重拉 `GET /books` → `fetchTree()`）：
  同步失败不阻塞查看（`syncError` 提示）；
- `openWorkbench`：`GET /books/{id}` 判 `ingest_status`，未 ingest 走 §9 分流
  （iframe PDF 直显 + 顶栏「书页入库」按钮）；
- `loadPage` 并发保护；404 = 未解析（非错误）；切页/切书清空 `selectedBlock` 并作废
  任务轮询令牌；
- **防重复建任务（三重闸门）**：`jobSubmitting`（POST 在途禁用「解析本页/全本」，与书页入库
  `ingestBusy` 同口径）+ store 内非终态 `activeJob` 直接拒绝再次提交 + **重开工作台恢复**：
  `openWorkbench` 经 `GET /parse-jobs?book_id=&status=queued&status=running` 查服务端在飞任务，
  有则回填 `activeJob` 并续轮询（列表端点不可用时保守降级为不回填）；
- 运行中任务轮询 `GET /parse-jobs/{id}`，终态自动刷新当前书 + 当前页（进度回显于顶栏）；
- 编辑提交后以响应合并回 `edits`（不整页重拉），保证回显；
- `compareBookId/comparePageNo` 双向同步 URL hash（`?book&page`），支持刷新恢复。

## 6. 数据契约（消费要点）

端点路径与请求/响应形状以 [api-contracts.md](../architecture/api-contracts.md) §④ 为
唯一事实源（本档不复制维护）；下表只登记 UI 消费口径——动作、判据与节奏。

| UI 动作 | 端点 | 消费要点（判据 / 节奏 / 超时） |
| --- | --- | --- |
| 书目元数据 / 打开书目 | `GET /books`、`GET /books/{id}` | `ingest_status`/`parse_status`/`pages_done`/`page_count`/`file_path` 是 ingest 与解析按钮态判据 |
| 同步书目（顶部「刷新」） | `POST /books/sync` | 成功后重拉 `GET /books` + 树；失败不阻塞查看 |
| 书目树数据 | `GET /parsing/tree` | 8902 离线 → 仅领域→课程（§12 降级行） |
| 书页入库（ingest） | `POST /books/{id}/ingest` | 页图渲染分钟级 → 请求超时 8903/8900→8902 均 300s |
| 载入页 / 原页图 | `GET /books/{id}/pages/{no}`（+ `/image`） | 404=未解析（非错误）；页图经 8900 代理，浏览器只连 8900 |
| 解析本页/全本/失败页 | `POST /parse-jobs` | 单页 `pages:[n]`、全本省略；提交期探活失败 503 **不建任务**（§12） |
| 轮询任务 / 重开恢复在飞 | `GET /parse-jobs/{id}`、`GET /parse-jobs?status=…` | 受理后轮询进度；重开工作台按在飞状态回填续轮询（§5 三重闸门） |
| 保存编辑 / 页内编辑列表 | `PUT …/blocks/{index}/edit`、`GET …/edits` | 提交后以响应合并回显；edits 列表用于独立刷新编辑态 |
| 显存水位 / 模型健康（告警） | `GET /monitor/gpu`、`GET /models/vision` | ResourceWatch 10s 轮询（§12 两行判据） |

- 类型封装收在 `api/axiom.ts`（`syncBooks`/`getParsingTree`/`getBook`/`ingestBook`/
  `getBookPage`/`putBlockEdit`/`getPageEdits`/`createParseJob`/`getParseJob`/`listParseJobs`；
  ResourceWatch 复用控制域既有封装 `monitorGpu`（`api/services.ts`）与 `getSlotStatus`（`api/llm.ts`））；
- UI 依赖的跨层口径（正文事实源见指针）：任务对象主键字段名为 `id`；块编辑判定三态
  `''/ok/bad`；空白页分显判据 `quality.blank_page`（[parsing-flow.md](parsing-flow.md) §6）；
- 8900 侧另有 `/review` 兼容门面（内部转 `/edit`），仅存量兼容，本设计消费面一律 `/edit`。

## 7. 左侧栏：书目树（BookTree，纯选择）

- 三级折叠树：**领域 → 课程 → 书目**，数据源 `GET /parsing/tree`（8902 离线时仅领域→课程，
  黄色降级横幅 + 树空态）；
- **只做选择**：点书名片段 → `openWorkbench(book_id)`，右侧对照区切换；当前选中书高亮；
  无状态 Tag、无进度徽标、无筛选行、无搜索框（侧栏保持干净）；
- 树样式沿用 `downloads.css` 的 `dl-tree-*` 类（与文档下载管理左树同风格）；
- **书节点展示名**（`parsingBookLabel`，顶栏 §8 同用）：`display_title` 非空直用（其契约= title + part），
  否则 `title + ' ' + part` 空格连接——保证「微积分学教程 Vol.1/2/3」「数分习题课讲义 上/下册」等
  同名多卷可区分（口径同下载管理 `bookDisplayName`）；
- 默认展开：第一个领域 + 其下所有课程；
- 「刷新」（含同步书目）按钮放在**页面顶部标题行**（不属于树本体）。

## 8. 对照区顶栏（ParseToolbar）

一行内完成（选中书后常驻；**无 engine/模型选择**——引擎固定服务端默认）：

- **书名**（§7 `parsingBookLabel` 口径，带卷标识）＋ **页码导航**：输入框「n / 总页数」（数字 + Enter 跳页）＋上一页/下一页按钮；
  键盘 `←`/`→` 翻页（编辑弹层打开时禁用）；连续滚动模式下页码随视口联动显示；
- **滚动模式** Segmented：`单页`（默认，翻页式）｜`连续`（整本书纵向页流，见 §9）；
  单页模式两列各自滚动 + **滚动同步** Switch；
- **渲染模式** Segmented：`流式`｜`版式`（§9）；
- **视图恒为对照**：无「仅原文/仅解析」切换——未解析页由 §9 态分流天然只显示书页图；
- **缩放** Slider：适配宽度 / 100%（A4 794px 基准）/ 自定义百分比；
- **解析操作区**（右侧）：**「书页入库」**（= ingest：PDF 逐页转书页图并登记页数，解析前置，
  界面文案全中文；未入库/失败时可点）＋「解析本页」（`POST /parse-jobs {pages:[当前页]}`）
  ＋「全本解析」（省略 pages）；提交后轮询 `GET /parse-jobs/{id}` 显示
  `progress.parsed/total` 进度条，完成自动刷新当前页；运行中禁用重复提交；失败显示错误
  文本 + 重试；
- **审阅统计**：「已判定 x / 共 y 块」（当前页）；编辑模式开关：只读 / 编辑（避免浏览时误改）。

## 9. 双栏对照区（CompareView）

态分流（**原始文件优先**；`pageParsed` = 页数据 200 且含 blocks；页图一律 URL 直构、
**不依赖页数据请求成功**）：

1. **已解析页** → 双栏对照：左原文页 + 右解析文档（各占半幅 A4 纸面）；
2. **已 ingest 未解析页**（页数据 404）→ 左原页图占满，**解析栏隐藏**、不出误导性错误横幅；
   顶栏「解析本页/全本解析」为主操作引导；
3. **未 ingest 有 `file_path`** → `iframe` 直显源 PDF（`GET /books/{id}/file`）+「书页入库」引导；
4. **无 `file_path`** → 明确空态「暂无原始文件（书目未登记 PDF 路径）」；
5. 页加载失败（非「未解析」404）：`Alert` + 重试。

**滚动模式**（§8 切换）：

- **单页模式**（默认）：当前页双栏并排，两列各自滚动，「滚动同步」开启时按容器高度比例联动；
- **连续滚动模式**：整本书页纵向流，每页一个「左原文页｜右解析文档」双栏单元（A4 纸面同宽）；
  懒加载预取当前视口 ±2 页 + 虚拟滚动（486 页量级不卡）；滚轮连续翻页，顶栏页码随视口
  所在页联动；未解析/未 ingest 页在其单元内按上述 2/3/4 态呈现。

`PageImagePane`：

- 原文页图（`GET /books/{id}/pages/{no}/image`）+ **bbox 方框叠加**（每块一框，按块类型着色）；
- hover 高亮、点击选中（与 `BlockList` **双向联动**：右栏 hover 块 → 左图高亮对应框；
  左页点击区域 → 右栏定位并选中最近块）。

`BlockList` + `BlockEditor`：

- **两种渲染模式**（顶栏切换）：**流式**=按块顺序排版（可读性优先）；
  **版式**=块按 bbox 绝对定位到页面尺寸（字号取 bbox 高度），呈现与原页接近的还原，
  便于逐块判定「解析文档是否准确还原原页」；
- 块级渲染复用 `blocks.ts`（heading 分级、formula KaTeX、table HTML、list、image、caption 等）；
  formula 块渲染前先经 `unwrapMathDelimiters` **剥成对数学定界符**（`$$…$$`/`\[…\]`/`$…$`）再交
  KaTeX——存量产物的 `latex` 字段可能自带引擎定界符，KaTeX 视 `$` 为解析错误、整块回退原文显示；
  剥后内部仍含同种定界符则保留原文不误剥；
- 点击块与左图联动选中；选中块高亮并滚动到可视区；
- `BlockEditor`：文字修正（公式编辑 LaTeX 源码）+ 范围修正（bbox 数值输入
  `x0,y0,x1,y1`）+ 判定/备注 Popover；
- 保存：`PUT /books/{id}/pages/{no}/blocks/{index}/edit`，
  `{verdict, note, corrected_text, corrected_bbox}`；
- 回显：进入页时拉取页数据（blocks + 已合并 edits），刷新后保持；有编辑的块显示标记
  （判定 Tag + 修正角标）。

## 10. bbox 规范

- **坐标系**：原页图像素坐标 `[x0, y0, x1, y1]`（左上原点），基准为 `pages/pXXXX.png`；
  overlay 用相对百分比定位（`left/top/width/height` = 坐标 / `image_size`），随图自适应缩放；
- **颜色**：按块类型固定色板（heading/paragraph/formula/table/image/…），半透明填充 + 实线边框；
  选中态加粗高亮（`#1677ff`），hover 态提升透明度；
- **编辑**：`editMode` 下经 `BlockEditor` 数值输入修改范围；提交前夹紧到
  `[0,0,image_size]`，最小尺寸约束（如 8px）防退化，保证 x0<x1、y0<y1；
  图上拖拽/缩放手柄为预留增强，未纳入当前设计；
- **无 bbox 块**：不在图上画框（仅列表可选中），标注「无坐标」。

## 11. 视觉规范

- 配色与对比度遵循[前端架构](../architecture/frontend-architecture.md)（蓝白主体、状态色配同色系浅底、
  字体与背景大区分、响应式栅格、theme token 统一）；
- bbox 方框按块类型固定色板，选中态加粗高亮；状态提示复用 downloads 的状态色 token；
- 左树沿用 `downloads.css` `dl-tree-*` 样式；对照两栏纸面 `overflowX auto`
  （沿用容器滚动条样式基调）。

## 12. 状态与降级矩阵

| 场景 | 判定 | 表现 |
| --- | --- | --- |
| 8900 不可达 | 请求失败（非上游 503） | 顶部错误横幅 + 「刷新」重试；树/页显示空态 |
| 8902 离线（503） | 数据域请求 503 | 黄色降级横幅；树仅显示领域→课程、对照不可用 |
| 8901 离线 | `POST /books/sync` 503 | 同步失败提示（不阻塞查看已同步书目） |
| 未入库（ingest） | `ingest_status != ingested` | 对照区 `iframe` 直显源 PDF、解析栏隐藏（§9）；顶栏「书页入库」按钮 |
| 未解析页 | `pageParsed=false`（页数据 404 / blocks 空） | **解析栏整体隐藏**，原页图占满，无错误横幅；解析入口在顶栏 |
| 解析任务进行中 | `activeJob.status ∈ queued/running` | 顶栏进度条 + 「已判定/页数据」完成后自动刷新；禁用重复提交 |
| 解析失败 | `pageError` / `job.status=failed` | 顶栏错误提示 + 重试入口 |
| 模型服务离线 | 提交期 8902 探活失败返回 503 | **不创建任务**（前端显示提交失败提示）；受理后故障才逐页失败、job 记 failed |
| 显存 ≥95% | `/monitor/gpu` 算得占比 | 右上角常驻警告弹窗「显存占用过高（NN%）」（<90% 自动撤下并复位，防抖） |
| 模型服务中断 | `/models/vision` `health_state=down` | 右上角常驻错误弹窗「本地模型服务中断」+ 原因与 `last_flip`；同一事故只弹一次，恢复即撤下 |

**资源告警（ResourceWatch）**：显存爆表与模型服务被打挂会直接导致解析任务逐页失败，
须在解析作业现场即时提醒（仪表盘属被动可见面，不构成提醒）。
`components/parsing/ResourceWatch.tsx` 挂载于页面容器、无自身 UI，10s 轮询 `/monitor/gpu` +
`/models/vision`，按上表两行以 `notification` 弹窗告警（`duration: 0` 常驻、可手动关闭，
`key` 去重）；轮询失败静默（8900 不可达由顶部错误横幅承接，不重复打扰）。

## 13. 已知约束与维护规则

- 端点增删与形状变化先落 [api-contracts.md](../architecture/api-contracts.md) §④，本档
  §6 只回核消费口径（超时/轮询/判据）是否仍成立；
- 任务状态机、版本激活与续跑语义以 [parsing-flow.md](parsing-flow.md) §4 为准，本档不
  复制状态定义；
- UI 无 engine 选择（固定服务端默认）；图上拖拽/缩放手柄为预留增强，未纳入当前设计。
