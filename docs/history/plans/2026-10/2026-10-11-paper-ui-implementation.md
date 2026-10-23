# 文档下载管理·论文线界面实施（paper-ui-implementation）

状态：Closed（Achieved，2026-10-14 收口：S1~S7 全达成，判 Retain 归档）
任务类型：A
最后更新：2026-10-14
关联 ADR：`../adr/0016-todo-registration-one-task-one-plan.md`（一行一壳）、`../adr/0020-task-closure-cadence-and-thin-registration.md`（达成即收、不扩载）、`../adr/0023-todo-row-carries-scope-and-criteria.md`（判据正本在台账行）
关联设计：`2026-10-11-paper-explore-ui-and-papers-column.md`（**本行的唯一设计事实源**：设计本体 §1~§10 +
实施清单 I1~I7 + 已交付现状基线）、`../design/downloads-flow.md`（§7 论文链路状态机事实源）、
`../architecture/api-contracts.md`（§③ papers 端点契约）、`../architecture/frontend-architecture.md`
关联 Tracker：docs/trackers/todo.md（REQ-108 登记）；滚动跟踪挂
[ARCH-024 壳](../../../plans/2026-09-22-tracker-v1-continuous-optimization.md)线 2「论文探索和下载」条目
归档判定：Retain（收口时按当时里程碑归档 `history/plans/2026-10/`）

## 目标与成功标准

**目标**：按 REQ-107 壳「实施清单 I1~I7」把 8903 论文线从「一键出候选的黑盒」改造成可审阅界面，
并给已采纳论文独立栏位；纯前端实现，**零新端点、不改 8901 契约**。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-108` 行「成功标准」列，本壳不复制判据。
设计与完成判据的正本在 REQ-107 壳「实施清单 I1~I7」表（涉及文件 + 可观察判据），本壳只登记执行序列、
红灯/绿灯证据与门禁输出。

## 范围与非目标

**范围**：I1~I7 全部（前端类型扩展、E1 样式、E2 弹窗五段、E3 待选区间纯函数、E4 详情与按需回源、
E5 左树论文节点与卡片列、门禁与浏览器实测）。
**非目标**：不改 `backend/`（8900 透传与端点形状原样）；不改 8901 契约、不提跨项目请求；不晋升
`design/`（晋升待用户对本轮实施结果确认，另由 REQ-107 壳 W2 承载）；不做引用数取数（Q1 已裁＝暂不做，
界面仅预留展示位）；不新增第二条轮询定时器。

## 前置条件

1. REQ-107 壳已升为论文线唯一执行基准且 R1~R6＋Q1 已裁（2026-10-11）。
2. 工作树中并行在途的**学习/星图线**改动不属于本行：本行只碰下载管理与论文相关件，`git add` 与
   门禁红字归因须区分（并行 WIP 不代为修复、不代为提交）。
3. 8900 与 8903 在跑（浏览器实测前 `npm run build`，8903 托管构建产物）。

## 工作项（执行序列，判据见 REQ-107 壳 I1~I7）

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| I1 | 报告类型扩展（`PaperSelectionDetail` 增可选 `search_plan`/`plan_source`/`profile`/`candidates`/`excluded_existing`/`search_failures`） | 已完成 |
| I2 | E1 按钮右靠齐并与「当前选择」行同一排 | 已完成 |
| I3 | E2 弹窗五段（新增「检索口径」段）＋段① `top` 入参 | 已完成 |
| I4 | E3 待选区间门槛纯函数与逐条归因 | 已完成 |
| I5 | E4 论文详情（标题/摘要/评审小结）＋已入库按需回源 | 已完成 |
| I6 | E5 左树「论文」派生节点 + 右栏卡片列 | 已完成 |
| I7 | 门禁与浏览器实测（vitest 串行 + tsc -b + build + 契约 + pytest + ruff + 黄金路径） | 已达成（2026-10-11 全绿留证，2026-10-14 收口） |

## 过程与证据

### 2026-10-11 I1~I6 实现批次（TDD 先红后绿，纯前端，零新端点）

- **I1**：`stores/index.ts` 的 `PaperSelectionDetail` 增可选 `search_plan`/`plan_source`/`profile`/
  `candidates`/`excluded_existing`/`search_failures`；老报告缺字段不炸（用例覆盖无 `search_plan` 降级）。
- **I2**：`.dl-summary` 改 flex（左块 `dl-summary-main` `flex:1`，按钮 `dl-summary-action` 同排贴右）；
  课程语境仍置灰取所属领域（R2）。判据以「同一排 + 右端」为准，浏览器取证挂 I7。
- **I3**：`paperExplore.ts` 五段 `stage` 机（`settings`→`running`→`plan`→`review`→`adopting`）——
  任务 succeeded 先进段③「检索口径」（逐条计划表 + `plan_source` 徽标 + profile 年窗 + 排除/候选计数 +
  `search_failures`），`进入候选评审` 才到段④；`validateTop` 越界不发请求，`top` 随请求体提交；
  `openModal` 恒落 `stage:'settings'`（关闭不丢态由 store 承载）。定向 `paperExplore.test.ts` 38 绿、
  `PaperExploreModal.test.tsx` 19 绿。
- **I4**：新增纯函数文件 `web-ui/src/paperShortlist.ts`（壳建议名沿用）——`eligible = goal_fit ≥ 4 ∧
  score ≥ 80 ∧ recommended`，未入选按 相关度＜4 → 总分＜80 → 超出本次推荐上限 唯一归因；头部
  `候选 N ｜ 待选区间 M（未达线 K 篇）`，达线 0 给门槛取值空态 + 两个出口；界面不出现「权威」（R3）、
  不复制服务端权重/阈值到判定代码。四组用例先红后绿。
- **I5**：① 评审段条目展开详情抽成共用组件 `components/PaperCandidateDetail.tsx`（标题、摘要、
  **评审小结**＝`reason`+`risks`、三维分 + 总分 + 服务端推荐标记；引用数位不渲染，Q1）；② 已入库论文
  按需回源＝新组件 `components/PaperOriginSection.tsx` + store 动作 `tracePaperOrigin`
  （`sources` 取 `channel==='arxiv'` 的 `provider_id` → 本领域 `GET /papers/selections`（`limit=20`）→
  逐份详情匹配）：只在点击时发、单领域、失败静默、不缓存全量，命中/未命中/无 arXiv 标识三态文案齐备。
  `PaperOriginSection.test.tsx` 5 绿（含「挂载不发请求」「503 静默且 error 保持 null」），
  页级用例 3 条覆盖论文条目点开才回源。
- **I6**：`NodeSelection` 增 `{kind:'papers', id}`（id＝领域，不落课程记录）；`downloads.ts` 新纯函数
  `listDomainPapers`＝领域全量（含落位到本领域课程的论文，排除其他领域/知识点附属/retired），
  出版年倒序、同年 `book_id` 稳定序、空年排尾；`DownloadsTree.tsx` 课程之后固定追加叶子「论文」
  （`data-testid="tree-papers-node"`，计数取全量，**不读也不写 `exploration_stage`**）；
  新组件 `components/PaperColumn.tsx` 右栏卡片列（复用 `.dl-books-row` 同形：标题两行截断、五档徽标、
  课程落位带归属标签、年、首位作者、页数），空态「该领域还没有已采纳论文」+ `[发起论文探索]`，
  行内展示行保留（R5 并存）。定向：`downloads.test.ts` 20 绿、`PaperColumn.test.tsx` 5 绿、
  `DownloadsTree.papers.test.tsx` 3 绿、`Downloads.test.tsx` 35 绿（含论文栏三例）。
- **门禁状态**：`npx tsc -b`（在 `web-ui/` 目录内）已通过；全量 vitest 串行、`npm run build`、
  根侧契约/pytest/ruff 与浏览器黄金路径属 **I7**，输出待下条补登。
- **设计壳纠偏（随本批）**：REQ-107 壳 I5 涉及文件原写 `web-ui/src/components/BookDetailModal.tsx`，
  实际 `BookDetailModal` 定义在 `web-ui/src/pages/Downloads.tsx`，无独立组件文件，已按现状改正该格；
  I6 的「新 `PaperCard` 组件」实际落地为 `PaperColumn.tsx` + `downloads.css`，一并改正。
- **并行 WIP 归因**：工作树同时存在学习中心/星图线在途改动，不属本行——本行只碰下载管理与论文相关件，
  其红字不代修、不代提交；暂存与提交范围按文件点名。
- **未晋升声明**：`docs/design/` 本轮未动，晋升按用户确认后由 REQ-107 壳 W2 承载。

### 2026-10-11 I7 门禁与浏览器实测（含实测纠偏一枚）

- **前端**：`web-ui/` 目录内 `npx vitest run --no-file-parallelism`（串行）→ `Test Files 64 passed (64)`
  ／ `Tests 691 passed (691)`，exit 0；`npx tsc -b` 无输出通过；`npm run build` 成功
  （仅存量告警：antd 动态/静态混合导入提示、单 chunk >500 kB 提示，非本轮引入）。
- **根侧**（解释器 `D:/software/anaconda3/envs/QED_env/python.exe`）：`pytest tests/contract -q` →
  **82 passed**；`pytest tests -q` → **737 passed**；`ruff check backend tests` → All checks passed。
- **契约两轮红与归属（均本行，已修）**：首轮契约 2 红＝
  ① `test_plan_governance.py::test_active_plans_have_complete_metadata_and_sections` 点名本壳——
  「状态」字段写成中文态 `进行中`，须为裸枚举；② `test_tracker_governance.py::test_todo_plan_rows_exactly_mirror_active_plan_bodies`
  同因（todo 行状态与壳状态必须同值且在 `ACTIVE_STATUSES` 内）。全仓扫描确认仅此一枚壳非枚举，
  故两红都归本行；改正后本壳与 todo REQ-108 行均为 `In Progress`，契约转 82 绿。
- **浏览器实测（8903 托管重建后 dist，`#/admin/downloads`）**：
  - E1：注入 1440px 宽度后量得 `.dl-summary`（`display:flex`）内 `.dl-summary-main` 右缘 1270、
    `.dl-summary-action` 左 1282／右 1354，容器右缘 1371（差 17＝内边距），按钮与「当前选择」行**同一排**
    且贴右；课程语境入口保持置灰取所属领域（R2）。
  - E5：左树「论文」叶子渲染「论文 4 篇」；点选后右栏 `paper-column` 头＝`论文（4）领域全量视图：含落位到本领域课程的论文`，
    4 张卡片含状态徽标（已完成/失败/待下载）、课程落位归属标签（概率论与数理统计）、年与首位作者；
    切回领域节点后行内展示行 `.dl-paper-row` 恢复渲染（R5 并存成立），`当前选择` 文案在两种节点下分别为
    「论文：数学（高等数学）」／「领域：数学（高等数学）」。
  - E4＋按需回源：卡片点开书目详情出现「探索记录」小节；点「查看探索记录」才回源，命中态给出
    `来自报告 sel-20261009T031317Z-8a886b24` ＋摘要原文＋评审小结＋`相关度 5 ｜ 基础性 5 ｜ 可读性 4 ｜ 总分 96 ｜ 服务端推荐：是`；
    全页检索「引用」二字为 0（Q1 引用数只留位不渲染）。
  - E2/E3：段①含配方（前沿/核心）、领域目标、探索目标、arXiv 分类与「推荐上限（1–20，留空随配方）」入参，
    并有「继续上次报告（30 篇候选）」；段③渲染「本次检索口径／模型计划」＋年窗与配方＋本次目标＋领域要点＋
    分类列表＋`排除已在库 0 篇 ｜ 去重后候选 30 篇（服务端上限 40）`＋逐条计划表（关键词/分类/生成理由/抓取/保留）；
    段④头部 `候选 30 篇 ｜ 待选区间 10 篇（未达线 20 篇）`，达线 10 条默认勾选（在库那条不可勾，按钮显示 9），
    「查看未入选（20 篇，门槛不可勾选）」展开后归因按序唯一（相关度 1~3＜4／总分 68~76＜80／超出本次推荐上限），
    界面不出现「权威」二字。
  - 网络与控制台：本轮页内 36 条 xhr/fetch **全部指向 127.0.0.1:8900 且全 200**，无 8901/8902 直连、无 4xx/5xx；
    控制台零消息。
- **实测纠偏（先红后绿）**：真机发现段④条目行的 arXiv 标识是纯文本，未达 I5 判据「作者 · 年 · arXiv 链接」。
  先在 `PaperExploreModal.test.tsx` 补一枚红用例（`getByRole('link', {name:'arXiv: 2401.00001'})`）→
  定向跑该文件确认 `1 failed | 19 skipped` → 改 `PaperExploreModal.tsx` 行内 meta 行为
  `<a href={candidate.page_url || 'https://arxiv.org/abs/'+id} target="_blank" rel="noopener noreferrer">` →
  该文件 20 绿；重建 dist 后真机复验 10 条达线行各带链接，首条 `href=http://arxiv.org/abs/2606.11607v2`、
  `target=_blank`、`rel=noopener noreferrer`。仅断言属性，不做外访（I5 判据「page_url 外访不进自动化测试」）。
- **黄金路径的采纳／取书两腿（本轮未实跑，需用户裁决）**：探索→检索口径→待选区间→详情→回源→论文栏已真机走通；
  「采纳所选」与「显式取书」两腿只跑了单元与交互覆盖（`adopt` 发 picks、422 留段内提示、采纳按钮文案
  「采纳所选（不自动下载）」）。原因是这两腿会向真实书目与 `dataset/` 数据根写入新记录，属真实数据动作；
  本轮零契约改动，该链路的端到端证据沿用 REQ-102 W5（b19 至 `verified`，见已归档壳）。若需本轮再补一次真机
  采纳＋取书，请用户授权后再跑。
- **截图限制**：Qoder 内置浏览器面板不可见（`viewport=0x0`，`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`），
  `take_screenshot` 不可用；视觉证据以几何度量数值＋DOM 结构文本留痕替代，需像素级截图时请打开可见浏览器面板。
- **并行 WIP 归因**：根侧 737 绿与契约 82 绿均在当前工作树（含学习/星图线在途改动）上取得，无该线红字混入；
  `docs/design/` 与学习线文件的改动不属本行，本行未代修、未代提交。
- **本壳状态**：I1~I7 均已完成且门禁全绿、实测留证；工作项表 I7 格写「已完成，待按反馈迭代后收口」——G3（达成即收）护卫视「全部条目达成 + 状态仍 In Progress」为违规，故在用户裁决（直接 Achieved 收口 / 先补一次真机采纳＋取书 / 继续改界面）前保持进行中态并如实标注，不把未闭环的收口动作提前写成达成。

### 2026-10-11 用户裁决：本行不收口、设计稿不晋升，按界面反馈迭代

- 裁决①（收口）＝**先不收口**：REQ-108 行与本壳保持进行中态，等用户看过 8903 界面提出改动后一并处理；
  「采纳＋取书」两腿本轮不补真机（避免向真实书目与 `dataset/` 写新记录），该证据沿用 REQ-102 W5。
- 裁决②（晋升）＝**暂不晋升**：`docs/design/` 继续不动，REQ-107 壳保持 `Accepted` 进行中态，
  晋升待用户对实施结果确认后再由其 W2 承载。
- 因此本壳保持 G3 兼容的「条目达成＋待迭代」写法（工作项表存在未完成语义，状态仍为 `In Progress`），
  后续每轮界面反馈以新日期条目追加在本节，判据变化只改 todo 行的固定 S 条目（ADR 0023）。

### 2026-10-14 收口（用户晋升裁决后阶段性关闭）

- 2026-10-11 裁决「先不收口、暂不晋升」由 2026-10-14 用户指令替换为「将文档确定内容晋升，
  本任务阶段性完成，现在开始收尾探索性工作」⇒ 本轮界面反馈迭代（I8~I14）已由 REQ-109 行承载
  并完成，四方向真机探索亦在 REQ-109 壳取证；本行 S1~S7 逐条达成，关闭结果 `Achieved`。
- **S7 中「不晋升 design/」子句的解除**：该子句是立项时的前置约束（晋升须待用户确认）；
  2026-10-14 用户发晋升令，晋升动作由 REQ-107 壳 W2 承载执行（downloads-ui §3/§4.1/§4.4 重写 +
  downloads-flow §7 对齐）。同一行内「不改 8901 契约与 8900 端点」子句仍达成且未被改动。
- 「采纳＋取书」真机腿按用户裁决**本轮不补**，端到端证据沿用 REQ-102 W5（`b19` 至 `verified`）；
  该项不计入 S 条目缺口（S6 判据是黄金路径与网络只指 8900，已于 2026-10-11 留证）。
- 三壳判 Retain 归档 `history/plans/2026-10/`；todo 三行移除并写 completed.md。
- **2026-10-14（收口门禁复跑，本批为纯文档收口批＝零代码改动）**：`tests/contract` **82 passed**、根全量 `pytest tests` **737 passed**、`ruff check backend tests scripts` **All checks passed**；`web-ui/` 内 `npx tsc -b` **exit 0**、`npx vitest run --no-file-parallelism` **63 files / 756 tests passed**、`npm run build` ✓（8903 托管新 dist）。756 比 REQ-106 收口时的 748 多 8 例，增量全部来自并行在飞的学习线（REQ-105／110／111），本批未触其文件亦不代其提交。**本批未执行任何 git 操作**（用户未要求，改动全在工作树）。


## 验证与验收

- 前端：`cd web-ui && npx vitest run`（串行）＋ `npx tsc -b` ＋ `npm run build`。
- 根侧：`tests/contract` ＋ 全量 `pytest tests -q` ＋ `ruff check backend tests`（解释器
  `D:/software/anaconda3/envs/QED_env/python.exe`）。
- 浏览器：按 `qed-frontend-check` 跑黄金路径（探索→检索口径→待选区间→采纳→取书→论文栏→详情），
  网络面板确认**只指 8900**。
- 并行 WIP 归因：学习/星图线的红字不计入本行门禁结论，须在证据条点名。

## 回滚

代码改动按 I1~I7 分批，任一批可独立回退（纯前端）；文档面只涉及本壳、todo REQ-108 行与
ARCH-024 线 2 表行，`design/` 未动故无需回滚。

## 关闭与归档

关闭条件：I1~I7 全达成 + 门禁全绿 + 浏览器实测留证；关闭结果按 task-lifecycle「关闭判定」取值，
壳 Retain 归档。本行**不含**晋升动作——晋升由 REQ-107 壳 W2 在用户确认后执行，不在本壳留尾。

2026-10-14 实况：晋升令已发、REQ-107 壳 W2 已执行完毕，本壳关闭无留尾；界面口径缺口的去向
登记在 REQ-109 壳「遗留与移交」（用户裁决＝不登 todo 行）。
