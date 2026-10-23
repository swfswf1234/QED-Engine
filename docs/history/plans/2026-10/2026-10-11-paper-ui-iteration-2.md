# 文档下载管理·论文线界面第二轮迭代（paper-ui-iteration-2）

状态：Closed（Achieved，2026-10-14 收口：S1~S6 全达成，判 Retain 归档）
任务类型：A
最后更新：2026-10-14
关联 ADR：`../adr/0016-todo-registration-one-task-one-plan.md`（一行一壳）、`../adr/0020-task-closure-cadence-and-thin-registration.md`（达成即收、不扩载）、`../adr/0023-todo-row-carries-scope-and-criteria.md`（判据正本在台账行）
关联设计：`2026-10-11-paper-explore-ui-and-papers-column.md`（**本行唯一设计事实源**：§11 第二轮界面迭代 +
I8~I12 实施清单；§1~§10 为第一轮基准）、`../architecture/api-contracts.md`（§③ papers 端点透传字段）、
`../design/downloads-flow.md`（§7 论文链路状态机事实源）
关联 Tracker：docs/trackers/todo.md（REQ-109 登记）；滚动跟踪挂
[ARCH-024 壳](../../../plans/2026-09-22-tracker-v1-continuous-optimization.md)线 2「论文探索和下载」条目
归档判定：Retain（收口时按当时里程碑归档 `history/plans/2026-10/`）

## 目标与成功标准

**目标**：按 REQ-107 壳 §11 与实施清单 I8~I12 对 8903 论文探索界面做第二轮迭代——段①改为
「检索方向四值（前沿／核心／深度／匹配）＋领域描述＋可选探索目标＋可选 arXiv 分类」且不露推荐上限、
一次探索固定 5 篇、「继续上次报告」换成历史探索清单、段④只列未采纳且达线并剔除已采纳／已在库；
**零新端点、零契约变化**。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-109` 行「成功标准」列，本壳不复制判据。
完成判据的正本在 REQ-107 壳 I8~I12 表（涉及面 + 可观察判据）与 §11 各节，本壳只登记执行序列、
红灯/绿灯证据与门禁输出。

## 范围与非目标

**范围**：I8~I12（方向映射纯函数、段①改造、历史探索清单、段④剔除口径、第二轮门禁与浏览器实测）
＋ I13~I14（2026-10-11 第二轮反馈追加：历史清单收成单按钮并直达评审、旧论文展示行整行删除——
同一目标下往本壳工作项加条目，行判据 S1~S6 未改写，裁决记录见「过程与证据」）。
**非目标**：不改 `backend/`（8900 原样透传）；不改 8901 契约、不改对方 `RECIPES` 值域、不提跨项目请求
（R8 已裁＝根侧参数映射）；不新增端点；不做引用数取数（Q1 已裁＝暂不做，界面仅留展示位）；
不晋升 `design/`（REQ-107 壳的晋升前置是 I1~I12 全做完 + 用户确认）；不关闭 REQ-108。

## 前置条件

1. REQ-107 壳 §11 与 I8~I12 已写定（2026-10-11），四项裁决已落（R7 领域描述／R8 根侧参数映射／
   R9 不展示推荐上限且 `top=5`／R10 未判别＝未采纳且达线）。
2. **用户明确说「开始执行」**——按「裁决先落文档、经人工审理后才动码」的口径，本壳立项后代码改动等待指令。
3. 工作树中并行在途的学习/星图线改动不属于本行：只碰下载管理与论文相关件，门禁红字须归因区分。
4. 8900 与 8903 在跑；浏览器实测前先 `npm run build`（8903 托管构建产物，不热更新）。

## 工作项（执行序列，判据见 REQ-107 壳 I8~I12）

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| I8 | `paperDirections.ts` 检索方向 → (`recipe`,`years_limit`,`limit`,`goal` 追加语) 映射 + 恒 `top=5`（先写失败测试） | 已达成（2026-10-14 收口） |
| I9 | 段①改造：标题带课程名括号、字段改名与顺序、删除 `top` 输入框、匹配方向内联提示并禁用发起 | 已达成（2026-10-14 收口） |
| I10 | 历史探索清单：store 动作按 `domain_id` 拉 ≤10 份摘要（失败静默）+ 段①渲染与点进段③，删除 `continue-report` | 已达成（2026-10-14 收口） |
| I11 | 段④只列未采纳且达线：`paperShortlist` 增 `excludedArxivIds`、三段计数行与 M＝0∧J＞0 空态 | 已达成（2026-10-14 收口） |
| I12 | 第二轮门禁（vitest 串行 + tsc -b + build；根侧契约 + 全量 pytest + ruff）与浏览器黄金路径复跑 | 已达成（2026-10-14 四方向真机探索已发起并取证；采纳／取书腿经用户裁决不补） |
| I13 | 历史探索清单收成单按钮（REQ-107 壳 §11.4 第二轮修订）：段①只一个按钮，点击展开**待决定**报告清单（新在前），点行**直达段④评审**；段③经「查看检索口径」可达；`k＝0` 禁用 | 已达成（2026-10-14 收口） |
| I14 | 旧论文展示行整行删除（§11.7，R5 改判）：删 `PaperBooksRow` 四处挂载与组件/测试/样式，领域活动态徽标迁入 E1 汇总行；**不删书行数据** | 已达成（2026-10-14 收口） |

## 过程与证据

- **2026-10-11 立项**：随 REQ-107 壳 §11「第二轮界面迭代」与实施清单 I8~I12 同批建立本行与本壳，状态 `Accepted`——按「裁决先落文档、经人工审理后才动码」口径，代码改动等待用户「开始执行」。同日四项裁决落定：R7 段①「领域目标」改名「领域描述」；R8 检索方向四值＝根侧参数映射（不改 8901 `RECIPES` 值域、不提跨项目请求）；R9 推荐上限不展示且一次探索固定 5 篇（`top=5`）；R10 段④「未判别」＝未采纳且达线（后端剔已入库 + 前端剔已采纳）。
- **2026-10-11 执行（用户「开始执行」后，I8~I12 同批落地）**：
  - I8：新建 `web-ui/src/paperDirections.ts` + `paperDirections.test.ts`（17 例，先红后绿）——四方向落
    (`recipe`,`years_limit`,`limit`,`goal` 追加语) 四元组、恒 `top=5`、匹配方向探索目标必填拦截、
    下发值不越 8901 边界（`limit`≤25／`years_limit`≥0／`top`≤20）。
  - I9：`PaperExploreModal.tsx` 段①改为「检索方向四值（含选中说明）→ 领域描述 → 探索目标 → arXiv 分类 →
    本次下发参数摘要 → 口径说明 → 历史探索清单」；删 `top` 输入框与 `PAPER_TOP_MIN/MAX`/`validateTop`；
    匹配空目标内联 `direction-error` 且「发起探索」禁用；标题 `论文探索 · 领域名（课程名）`，
    课程名由 `Downloads.tsx` 的 `openPaperExplore` 经 `openModal(domain_id, name, courseName)` 携带
    （`DownloadsTree.tsx` 领域／论文节点入口不带课程名＝无括号）。
  - I10：store 增 `history`/`loadHistory`/`openReport` 与 `PAPER_HISTORY_LIMIT=10`，段①挂载即拉本领域摘要
    （失败静默保留旧值），删 `continue-report` 按钮；历史行文案 `时间｜recipe 原样词｜状态中文｜达线 k 篇`。
    **偏差登记**：§11.4 原写「候选数」，但 8900 透传的摘要行只有 `recommendation_count`（＝推荐达线条数），
    无候选总数字段，为不夸大为「候选」改用「达线 k 篇」措辞；本轮零契约变化前提下不新增字段。
  - I11：`paperShortlist.ts` 入参增 `stockArxivIds`，达线且在库/已采纳进 `settled`（归因「已采纳／已在库」）、
    头部三段计数、M＝0∧J＞0 专门空态；段④折叠区渲染 `[...excluded, ...settled]`，`CandidateRow` 去掉
    `inStock` 置灰逻辑（在库条目不再进待选区间，无需禁用勾选）。
    **偏差登记**：§11.5 原写前端剔除的标识来源＝`GET /books/{id}/sources` 的 `channel==='arxiv'`，
    实现改用**标题归一匹配**本地 `kind==='paper'` 书行（`isCandidateInStock`，第一轮已交付的现成通路）——
    逐本拉 sources 会对每次开弹窗产生 N 次请求，违背「按需回源只在点击时发」纪律，且 `BookRecord` 无 arXiv 字段。
    `excluded_existing`（后端已取文件）与标题命中集取并集，不重复计。
  - 追加修复（真机取证暴露）：深度方向追加语与领域描述衔接时出现「…广泛应用。，侧重证明细节…」，
    `composePaperLaunch` 现先去基底尾随句读再以「，」衔接（`paperDirections.test.ts` 补 1 例）。
- **2026-10-11 门禁**（均在改动后运行）：
  - `web-ui`：`npx tsc -b` 无输出；`npx vitest run --no-file-parallelism` **723 passed（65 files）**；
    `npm run build` ✓ built（产物 `dist/assets/index-CA6OKInG.js`）。
  - 根侧：`tests/contract` **82 passed**；`pytest tests -q` **737 passed**；`ruff check backend tests` All checks passed。
    （工作树含并行学习/星图线在途改动，上述输出为其共存态，本行不代为归因或提交。）
- **2026-10-11 第二轮反馈裁决（用户答问确认，追加 I13/I14，行判据 S1~S6 未改写）**：
  R11 历史探索清单＝段①**单按钮**，不内联展示内容；点击展开**所有待决定**报告清单（新的在前），
  点任一行打开该报告继续确认／否定并查看论文信息（落点改段④评审）——I10 原实现「内联多行 + 点击只到段③」判为不合格。
  R12 旧论文展示行（`PaperBooksRow`，W3 交付）**整行删除**（领域级与课程级全删），论文只在领域全量卡片列出现，
  领域活动态徽标改挂汇总行「论文探索」按钮旁——第一轮 R5「与论文栏并存」改判作废。
  数据面不动：用户看到的「论文（2）」两条（`已完成`／`失败`）与「论文（4）」是同一批 `kind=paper` 书行的重复渲染，
  只删渲染不删库。

（下述为 I8~I12 首轮取证，历史清单部分已被 I13 覆盖，保留作红灯/绿灯基线。）

- **2026-10-11 浏览器实测（8903 托管新构建，`#/admin/downloads`）**：
  - 选中课程「数学分析」→ 论文探索入口 → 标题 `论文探索 · 数学（高等数学）（数学分析）`；
    段①四值单选齐备（默认前沿）＋选中说明＋「领域描述（本次探索目标缺省取此）」＋无「推荐上限」字样；
    参数摘要行 `本次下发：方向 前沿 ｜ 配方 frontier ｜ 年窗 随配方 ｜ 每组抓取 随配方 ｜ 一次推荐 5 篇`。
  - 切「深度」→ `年窗 不限（显式下发 0） ｜ 每组抓取 25`，实际目标串尾 `…广泛应用，侧重证明细节、方法论与理论深度`（衔接修复后无「。，」）；
    切「匹配」且不填目标 → `匹配方向需要填写本次探索目标` 内联可见且「发起探索」`disabled=true`。
  - 历史探索清单列出 9 条本领域记录（`10-09 11:33 ｜ frontier ｜ 待评审 ｜ 达线 10 篇` 等，含一条未识别状态
    `failed` 原样显示）；点第一条 → 段③「本次检索口径」渲染模型计划表（候选 30 篇、年窗 近 3 年、配方 frontier）。
  - 段③→「进入候选评审」→ 段④头部 `候选 30 篇 ｜ 待选区间 9 篇（未达线 20 篇） ｜ 已剔除 1 篇（已采纳／已在库）`；
    勾选框恰 9 个（默认全选，采纳按钮显示 (9)）；折叠区 21 行含被剔除那条带「已采纳／已在库」归因——
    该份报告 `excluded_existing` 为 0，说明剔除来自前端本地书行命中，R10 口径两条通路成立。
  - 控制台无报错；`performance` 资源条目里**无 8901/8902 直连**，请求全部指向 8900（含
    `/papers/selections?domain_id=math-advanced&limit=10` 与单份详情）；结束后关窗未落任何写操作。
  - **未做**：真机「发起探索」（四方向各一次真实任务，会调模型并在 8901 落报告）与「采纳＋取书」两腿——
    按纪律待用户逐次授权；M＝0∧J＞0 专门空态未在真机复现（真机总有未达线条目），由单测覆盖。

（后续执行期逐条追加：红灯→绿灯证据、门禁输出与浏览器取证写在本节。）

- **2026-10-11 执行 I13（历史清单收单按钮，TDD）**：
  - 红灯：`paperExplore.test.ts` 新增「只留待决定」「新的在前」「点行直达段④」三例先红
    （`expected ['old','new','mid'] to deeply equal ['new','mid','old']`、`expected 'plan' to be 'review'`），
    `PaperExploreModal.test.tsx` 段①两例改判后红（默认仍内联展开、点行落段③）——合计 6 红。
  - 绿灯：store 新增纯函数 `pendingDecisionRows`（过滤 `REVIEWABLE_REPORT_STATUSES`＝ranked/no_recommendations
    ＋ `created_at` 倒序 ＋ 截 `PAPER_HISTORY_LIMIT`），`loadHistory` 走它；`openReport` 按报告态落
    `stage: reviewable ? 'review' : 'plan'`；`PaperExploreModal.tsx` 段①改为单个
    `history-toggle`（文案 `历史探索清单（k）`，`k=0` 禁用并显示「本领域没有待决定的探索报告」），
    展开态由本地 `historyOpen` 控制且在重开弹窗/换领域时收起；段④头部加「查看检索口径」回段③。
    定向复跑 `paperExplore.test.ts` + `PaperExploreModal.test.tsx` → **71 passed**。
- **2026-10-11 执行 I14（旧展示行整行删除，TDD）**：
  - 红灯：`Downloads.test.tsx` 两例先红（`expected <div class="dl-paper-row">… to be null`、
    `Unable to find [data-testid="paper-row-badge"]`）。
  - 绿灯：`Downloads.tsx` 删除四处 `<PaperBooksRow …/>` 挂载与 import，汇总行改为
    `Space.dl-summary-action` 内「徽标 Tag（`paper-row-badge`，`paperBadgeShowsInSummary` 只放行
    探索中/待评审/失败）＋论文探索按钮」；删除 `components/PaperBooksRow.tsx` 与其测试（用户裁决「全删」）、
    `downloads.css` 的 `.dl-paper-row*`/`.dl-paper-item*` 整段（按行号脚本删除，CJK 注释行 Edit 匹配失败已知坑）。
    课程视图与领域视图下「论文（k）」行不再出现，论文只剩 §8 领域全量卡片列；**书行数据与状态未动**。
  - 回归改写：`Downloads.test.tsx` 按需回源用例改从 `tree-papers-node` → 卡片点击进入详情（旧路径已不存在）。
- **2026-10-11 I13/I14 门禁**：`web-ui` 定向 `vitest`（Downloads/PaperColumn/DownloadsTree.papers）**43 passed**、
  全量 `npx vitest run --no-file-parallelism` → **726 passed｜18 failed（64 files）**；根侧 `tests/contract` → **82 passed**。
  **红字归因**：18 例失败与 `tsc -b` 的 17 条报错全部落在并行在途的学习/星图线
  （`src/pages/LearnWorkbench*.tsx`、`src/pages/LearnShelf.test.tsx`、`src/components/learning/AnnotationPane.test.tsx`），
  本行不代为修复、不代为提交；因 `npm run build`＝`tsc -b && vite build` 被其类型错误挡住，
  浏览器取证改用 `npx vite build` 出产物（`dist/assets/index-BEIA9QE5.js`），本行文件的类型检查经
  过滤确认**零报错**（`tsc -b` 输出中无 paper/download 相关条目）。
- **2026-10-11 I13/I14 浏览器实测（8903 托管新产物，`#/admin/downloads`）**：
  - 主面：领域视图与课程视图下 `.dl-paper-row` 计数均为 **0**，页面上「Gradient estimates…」不再重复渲染；
    左树「论文」节点 → `论文（4）` ＋「领域全量视图：含落位到本领域课程的论文」4 张卡片（唯一展示面）。
  - 汇总行：`当前选择：领域：数学（高等数学）筛选结果：15 个教程（已排除否定/过时项）待评审论文探索`
    ——「待评审」徽标（`paper-row-badge`）渲染在「论文探索」按钮左侧；切到课程节点仍带该徽标。
  - 段①：只有一个按钮 `历史探索清单（2）`，`history-row` 内联计数 0（原 9 条记录里 7 条已消费/无候选，被待决定过滤剔除）；
    点击展开 → `10-09 11:33 ｜ frontier ｜ 待评审 ｜ 达线 10 篇` 在前、`10-09 11:13 … 达线 4 篇` 在后（新的在前）。
  - 点第一条 → **直接落段④**：`候选 30 篇 ｜ 待选区间 9 篇（未达线 20 篇） ｜ 已剔除 1 篇（已采纳／已在库）`、勾选框 9 个，
    段③文案不出现；点「查看检索口径」→ 段③ `本次检索口径` ＋徽标「模型计划」＋「进入候选评审」出口仍在。
  - 控制台零消息；78 条网络请求全部指向 **8900**（含 `papers/selections?domain_id=math-advanced&limit=10` 与单份详情），
    无 8901/8902 直连；全程只读，未发出任何 POST（未采纳、未取书）。
- **2026-10-14 四方向真机探索（用户裁决「完成后再做四方向各发起一次真实探索」）**：领域 `math-advanced`，
  四腿全部经 8903 弹窗段①发起（不绕过界面直接打接口），逐条取数如下。
  - 前沿：段①下发 `recipe=frontier top=5`（年窗/抓取量随配方缺省＝3 年／15）→ task `c24b9f845168`
    → `sel-20261011T095924Z-dc9fc865`，**ranked**（评估 23 篇、推荐 5 篇）；本腿于上一工作日发起，本轮完成取证。
  - 核心：`recipe=core top=5` → task `d58cbc3778c3` → `sel-20261014T141756Z-911475df`，**no_candidates**，`plan_source=fallback`。
  - 深度：`recipe=core years_limit=0 limit=25 top=5`，goal 追加「侧重证明细节、方法论与理论深度」
    → task `cd7fd0775da8` → `sel-20261014T142101Z-46b731f6`，**no_candidates**，`plan_source=fallback`。
  - 匹配：`recipe=frontier years_limit=10 limit=20 top=5`，目标「偏微分方程解的正则性估计与极大值原理」
    → task `65d97a4b9754` → `sel-20261014T143208Z-3e8e4f1f`，**no_candidates**，`plan_source=fallback`。
- **界面面判定（本轮改动的验收点，全部按设计工作）**：段①四方向参数回显正确（深度显示「年窗 不限（显式下发 0）｜
  每组抓取 25」、匹配显示「近 10 年｜每组抓取 20」并在「实际下发的探索目标」原样回显中文目标；匹配空目标时按钮禁用＋
  内联提示）；段② 5 秒轮询自然进段③；段③ 对三份今日报告都出「兜底计划（模型计划生成失败，按领域关键词确定性检索）」
  徽标与「本次检索没有取回候选」区分文案（含「换检索方向（深度／匹配）再探」指引）；I13 单按钮 `历史探索清单（3）`
  展开后新在前（`10-11 17:59｜frontier｜待评审｜达线 5 篇` → `10-09 11:33…10 篇` → `10-09 11:13…4 篇`），
  本轮新增的三份 `no_candidates` 报告不进待决定清单（计数仍 3），符合 R11「所有待决定的报告」口径；
  汇总行徽标在跑动期间「探索中」、出报告后转「待评审」（`paper-row-badge`）。
- **归因（不在本行界面面；属 8901 计划契约／本地模型输出面，转对方与模型线处理）**：
  1. 三份报告的 `model.plan_fallback_error` 都写「网关请求失败」，而 8900 `GET /api/v1/llm/calls` 侧
     id 104~107 四条 **status=success、HTTP 200**（单次 80~89s）——文案与真因不符，判据应区分「网关不可达」与「计划契约不合」。
  2. 真因两条：核心／深度的计划 JSON 可解析但用了**不在 `allowed_categories` 的分类**（id 104 `math.RA`、id 105 `math.GR`）被判非法；
     匹配的计划响应在 **577 字符处截断**（id 106 与其修复重试 id 107 字节完全一致、`response_sha256` 相同）解析失败，两次皆然。
  3. 兜底计划的检索词是**中文整句**（`reason=deterministic fallback`，如「偏微分方程解的正则性估计与极大值原理」），
     arXiv 全文检索 `fetched=0 kept=0` → `no_candidates`（10-09 那次 core 同型，非本轮偶发）。
  4. 界面口径缺口（本行后续候选，**待用户裁决**，未擅自改码）：段③「年窗」读 `selection.profile.years_limit`＝配方缺省 3，
     而匹配方向实际下发 10（`QED-Tracker/src/qed_tracker/api/main.py:467` 把显式值传进 `app.papers.recommend`，报告不回写生效值）
     → 段③ 显示的年窗可能与实际检索窗口不符；候选修复＝段③ 并显「本次下发」口径，或由 8901 在报告里回显生效参数。
- **2026-10-14 四方向跑完后的两处界面口径观察（只登记不擅改，待用户裁决）**：
  1. 汇总行徽标在四腿全部结束后**消失**（`.dl-paper-row` 计数 0、`paper-row-badge` 为 null）。派生链是既有设计：
     `refreshBadges` 只取该领域**最新一份**报告（`reportList.selections[0]`）判态，今天最新一份是
     `no_candidates` → 既不是 `ranked` 也不是失败 → 落 `sedimented`（已沉淀），而 I14 汇总行只渲染
     活动态（`paperBadgeShowsInSummary`＝running/review/failed）。后果＝**只要跑出一份无候选报告，
     清单里仍在等的 3 份待决定报告就没有任何入口提示**（按钮本身仍可用，历史清单仍显示「（3）」）。
     候选修复＝徽标改按「是否存在待决定报告」派生，与历史清单共用 `pendingDecisionRows` 口径。
  2. 同上一条第 4 点的年窗口径：段③只读 `profile.years_limit`，与方向覆盖值（匹配 10／深度 0）可能不一致。
- **纪律**：本轮只发出四次 `POST /papers/recommend`；**未采纳、未取书**（无 `/adopt`、无 `/books/{id}/fetch`），
  未写 `dataset/`；请求全部指向 8900（无 8901/8902 直连），控制台无新增报错。

## 遗留与移交

2026-10-14 用户裁决＝下列各项**都不新建 todo 行、不写进 `design/` 正文**，只在本归档壳留指针；
后续若要处理，按 task-lifecycle 重新进场定级。

1. **段③年窗与实际下发不一致**（界面口径缺口，未擅改码）：段③只读
   `selection.profile.years_limit`（配方缺省 3），而深度／匹配方向实际覆盖为 0／10——报告不回写
   生效参数（8901 侧 `QED-Tracker/src/qed_tracker/api/main.py:467` 已把显式值送进
   `app.papers.recommend`）。候选修复两条＝段③并显「本次下发」口径（根侧纯前端），或由 8901 在
   报告里回显生效参数（属对方线，需跨项目请求）。涉及面：
   `web-ui/src/components/PaperExploreModal.tsx` 段③年窗格（现读 `selection.profile?.years_limit`）、
   `web-ui/src/paperDirections.ts` 映射表。
2. **汇总行徽标只看最新一份报告**，一份 `no_candidates` 会让清单里仍在等的待决定报告失去提示
   （派生链＝`stores/paperExplore.ts` `refreshBadges` 取 `reportList.selections[0]` 判态 →
   `derivePaperRowBadge` 落 `sedimented`，而 I14 只渲染 `paperBadgeShowsInSummary`＝
   running/review/failed）。候选修复＝徽标改按「是否存在待决定报告」派生，与历史清单共用
   `pendingDecisionRows` 口径。历史清单按钮本身仍可用且计数正确，属提示缺失不是功能不可达。
3. **「采纳＋取书」真机腿本轮不补**（用户裁决）：端到端证据沿用 REQ-102 W5
   （`../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md`，`b19` 至 `verified`）。
4. **对方侧事实（不进根侧行）**：2026-10-14 四方向里三份报告未出候选，归因＝检索计划用了不在
   `allowed_categories` 的分类（`math.RA`/`math.GR`）、计划响应在 577 字符截断
   （`llm/calls` id 106 与其修复重试 107 `response_sha256` 相同）、兜底计划用中文整句检索
   `fetched=0`。这三条都在 8901／模型服务侧，由 ARCH-024 线 2「论文探索和下载」滚动条目跟踪，
   根侧不绕过宿主容量去调业务参数（判例＝机器侧问题归口）。
5. **未提交说明**：本轮代码与文档改动全部在工作树，`git commit`/`push` 由用户窗口执行；
   学习/星图线的在途改动不代修、不代提交。
- **2026-10-14（收口门禁复跑，本批为纯文档收口批＝零代码改动）**：`tests/contract` **82 passed**、根全量 `pytest tests` **737 passed**、`ruff check backend tests scripts` **All checks passed**；`web-ui/` 内 `npx tsc -b` **exit 0**、`npx vitest run --no-file-parallelism` **63 files / 756 tests passed**、`npm run build` ✓（8903 托管新 dist）。756 比 REQ-106 收口时的 748 多 8 例，增量全部来自并行在飞的学习线（REQ-105／110／111），本批未触其文件亦不代其提交。**本批未执行任何 git 操作**（用户未要求，改动全在工作树）。


## 验证与验收

- 每条 I8~I14 达成证据写进「过程与证据」，完成判据按 REQ-107 壳 I8~I14 表逐格核对。
- 界面验收点（浏览器实测）：标题 `论文探索 · 领域名（课程名）`；段①四值单选且无推荐上限入参；
  历史清单是**一个按钮**，展开后可点任一份待决定报告**直达段④评审**；段④头部三段计数与
  「已采纳／已在库」剔除可见；主面不再出现旧论文展示行，论文只在领域全量卡片列；全程网络只指 8900。
- 采纳＋取书的真机腿（会向真实书目与数据根写记录）仍须逐次获用户授权，未授权不执行。

## 回滚

纯前端改动，按文件回退到第一轮已交付态（REQ-108 取证态）：删除 `paperDirections.ts` 及其测试、
段①与段④组件改动回退、`paperShortlist` 去掉新增入参。数据与契约面无需回滚（本轮不落任何盘外副作用）。

## 关闭与归档

- 收口按 `qed-closeout`：逐条核对 todo.md `REQ-109` 行 S1~S6，全达成 → `Achieved`；壳按 doc-governance
  做 Retain/Delete 判定（默认 Retain，收口时归档 `history/plans/2026-10/`），todo 行移除并写 `completed.md`。
- 本轮不晋升 `design/`：晋升由 REQ-107 壳在 I1~I12 全做完且用户确认后统一执行。

2026-10-14 收口实况：I8~I14 全达成 + 四方向真机探索取证 + 全量门禁绿 ⇒ S1~S6 逐条达成，
本壳 `Closed（Achieved）`、判 Retain 归档 `history/plans/2026-10/`。S6 原文「不晋升 design/」
是立项时前置约束，其解除依据＝同日用户晋升裁决（晋升由 REQ-107 壳 W2 执行）；同句内
「不改 8901 契约与 8900 端点、不提跨项目请求」照旧达成（四方向只用现成透传字段）。
遗留项见上方「遗留与移交」，本壳无进行中态留尾。
