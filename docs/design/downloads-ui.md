# 文档下载管理 UI 设计（downloads-ui）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-30
确认状态：已确认
关联代码：`web-ui/src/pages/Downloads.tsx`、`web-ui/src/components/DownloadsTree.tsx`、
`web-ui/src/components/{DomainCard,DomainConfirmModal,CourseConfirmModal,ExploreFlowModal}.tsx`、
`web-ui/src/api/{tracker,explore-helpers}.ts`、`web-ui/src/stores/downloads.ts`、
`web-ui/src/downloads.css`、
`web-ui/src/pages/Downloads.test.tsx`、`web-ui/src/stores/downloads.test.ts`
关联测试：`web-ui/` Vitest（downloads.test.ts / Downloads.test.tsx / DownloadsTree.state.test.tsx）、
`tests/contract/test_design_documents.py`（本文件入 CURRENT_DOCUMENTS）
关联 ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（唯一入口 8900）、[ADR 0008](../history/adr/v0.1/0008-frontend-react-refactor.md)（React 选型）、[ADR 0017](../adr/0017-design-doc-structure-contract.md)（本文档结构契约与事实源唯一铁律）
关联设计：[downloads-flow.md](downloads-flow.md)（探索状态机与后端链路——本文件只管 UI，
状态机/写点/降级链路以其为准）

## 1. 定位与目标

本文档是文档下载管理页（`#/admin/downloads`）的 **UI 设计事实源**：左树结构、右侧
四层展示、筛选与排序规则、弹窗、三层状态口径声明，以及异常与降级的**用户可见表现**。
它回答的是「用户在下载管理页看到什么层级、能做什么操作、依赖离线时页面怎样表现」。

- **目标**：领域→课程→教程→书目四层内容一屏可导航可维护，状态口径与后端状态机严格
  对齐、互不混用；
- **成功标准**：本页全部前端展示行为（含右键菜单门禁、筛选档、弹窗操作区、降级横幅）
  均有唯一口径可查；任何 UI 改动不混用 §5 三个状态体系的字段来源。

## 2. 范围与非目标

**范围内**：本页全部前端展示层（树/卡片/弹窗/筛选/排序/样式/异常降级表现）。
**非目标**：不涉及后端 8900/8901 改动；不请求 QED-Tracker 接口变更（教程命名由其数据侧
执行，前端 name 空值兜底见 §7）；不拆分 en 套为独立教程行（排序规则已置组尾）。

本档**不**维护以下内容，逐条给出唯一事实源指针（[ADR 0017](../adr/0017-design-doc-structure-contract.md) 事实源唯一铁律）：

| 内容 | 唯一事实源 |
| --- | --- |
| 探索状态机、终态写点矩阵、后端降级规则 | [downloads-flow.md](downloads-flow.md) |
| 端点路径与请求/响应形状 | [api-contracts.md](../architecture/api-contracts.md)；8901 原生契约归 QED-Tracker `docs/architecture/api.md` |
| 书籍状态机字段定义 | QED-Tracker `architecture/database-private-tables.md` |
| 业务流程规则（课程收集五阶段） | [downloads-flow.md](downloads-flow.md) §6 |

**跨项目协作**：教程命名规范（§7）与领域表单四字段的探索消费（§3.1 未接通面）为数据侧改动，按
[跨项目协作规范](../standards/cross-project-collaboration.md) 登记请求，对方建计划承接。

## 3. 左树结构（领域 → 课程 → 教程）

```
▸ <领域>（共享表领域清单，多领域；DomainCard 恒显不受筛选影响）
  ├─ <课程>（可折叠；点击 = 选中 + 联动筛选）
  │   ├─ 教程1：<书名>（<作者>）      [3/4 已验收]
  │   └─ 教程2：…                    [5/5 已验收]
  └─ …
```

- **领域**：来自 `GET /courses` 领域清单；名称/描述/阶段徽标/explore_pending 提示条由
  DomainCard 呈现（右侧恒显，见 §4.1）；左树支持右键维护（编辑/删除/探索领域知识/
  导入领域知识/添加课程/**论文探索**）。右键菜单门禁：探索在 `未开始/已生成/待确认/失败`
  可用（`探索中` 除删除外全部禁用）；**添加课程在 `未开始`/`已生成` 禁用**，`待确认/已完成/失败` 可用；
  **论文探索不受 exploration_stage 门禁约束**，仅在该领域有在跑论文任务时禁用（§4.4）。
- **课程**：点击选中 + 联立筛选；右键菜单（编辑/删除/课程探索/导入教程，按探索状态禁用，
  见 [downloads-flow.md](downloads-flow.md) §3.3 操作表）。
- **教程**：叶子节点，只展示 名称 + 验收进度数字（`verified 数/总数`），不可点击展开；
  书籍明细只在右侧栏/弹窗查看。
- 树宽拖拽（280–640px、localStorage）与默认展开/折叠状态保留。

### 3.1 领域维护表单（字段口径与默认值）

三处入口（左树底「添加领域」、右键「编辑领域知识」、领域确认弹窗）字段集合与顺序统一：

| 顺序 | 字段 | UI 标签 | 添加时默认值 | 口径 |
| --- | --- | --- | --- | --- |
| 1 | `name` | 领域名（必填；创建后不可改） | 空 | 领域探索的强输入 |
| 2 | `description` | 领域描述 | 默认句（随领域名插值，见下） | 用户对该领域的既有定位说明；**用户写过的描述是权威内容，领域探索结果不得覆盖** |
| 3 | `scope` | 学科知识 | 默认句（见下） | 探索的范围边界；用户填写值优先于内置默认边界 |
| 4 | `level` | 探索范围 | `本科-硕士` | 默认学习层级与范围，兼作课程体系梳理的范围提示 |
| 5 | `stages` | 学习阶段 | `基础,主干,分支,前沿` | 阶段序列，与 QED-Tracker 侧四档阶段常量同值域 |

默认句正文（前端预填与此处一致，不在代码侧另写措辞）：

- `description`：`{领域名}：本次新增的待探索领域。用户对该领域的既有认识见「学科知识」，
  层级与阶段见下方参数；请据此梳理学科定位、研究对象与主干课程方向。`
- `scope`：`学科知识以中文记录与表述；知识体系、课程划分与前沿参照美国主流高校（本科至硕士）
  的通行方案，教材与文献可保留英文原版，专业术语给出中英对照。默认覆盖本科—硕士阶段，
  超出该范围的内容不进入本次梳理。`

- **五字段一律是领域探索的输入**；标签里的「可选」只表示留空由默认值承担，不表示可忽略。
- **标签唯一口径**：「探索范围」只用于 `level`，`scope` 一律称「学科知识」，两处不得互换；
  领域确认弹窗与两个维护表单使用同一组标签。`name` 行的差异只有后缀提示：添加表单为
  「领域名（必填；创建后不可改）」，两个维护/确认表单为只读的「领域名」（领域已建，改名不在此处发生）。
- **描述可空**：三处表单的 `description` 均为非必填（空值由探索生成或保留默认句），
  领域卡对空描述显示「（暂无描述，可点『探索领域知识』生成）」。

**消费现状（未接通面）**：8901 领域探索后台任务当前只把领域名送入 domain 提示词，
`description/scope/level/stages` 既不进入提示词，库中值还被探索结果就地覆盖（`description`、
`stages` 恒被输出替换，`level` 仅输出缺失时回退）；`scope` 全程无人消费。四字段的真读取与
「用户写过的描述不被覆盖」已按跨项目请求登记（见 [todo.md](../trackers/todo.md) 请求行与
QED-Tracker 滚动缺陷台账）。接通前，本表单默认值只决定入库初值与领域卡展示，不影响探索输出；
设计正文描述的是目标态契约。

## 4. 右侧栏

### 4.1 展示层级规范（领域/课程/教程/书目四层）

| 层 | 展示 | 承载 | 可用操作 |
| --- | --- | --- | --- |
| 领域 | 名称、描述、阶段徽标、explore_pending 提示条 | `DomainCard`（**无论筛选如何恒显**） | 探索/确认领域/确认课程（按 [downloads-flow.md](downloads-flow.md) §3 状态机）；失败态 danger 重试 |
| 课程 | 名称、描述 + **操作条：课程探索、导入教程** | 课程头（`dl-course-head`） | 编辑/删除（左树右键）；课程探索在 探索中/已完成 禁用 |
| 教程 | 名称（`.dl-knowledge-name`）、状态、**进度（下载 x/y 本）**、详情 | 教程行 | 详情（弹窗）、自动下载（candidate/decided/failed 可用）、删除（`DELETE /knowledge/{id}`） |
| 书目 | 书名、作者、语言、**版本标签**（中译本/英文版/苏版/其他，由 language 与书名/作者推导） | 书目卡（纯展示，无操作按钮） | 详情（弹窗：信息 + 下载信息 + 上传/验证/自动下载）；新增书目在**教程详情弹窗**内 |

四层之外另有第五个展示组——**论文展示行**（领域级挂 DomainCard 底部、课程级挂课程头，
见 §4.4）；教程行内的书目卡 kind 标签与排序规则不受其影响。

**教程详情弹窗**（`TutorialDetailModal`）：教程信息（修改入口经 `PATCH /knowledge/{id}`）、
书目列表（书名/作者/语言/状态/操作）、**新增书目**（`POST /books` 书库化创建：`book_id`
格式 `{abbr}-b{NN}` + 书名必填，归属由教程 refs 承载）、书行**上传**
（浏览器文件选择器 → `POST /books/{id}/import` multipart，**不写路径**）。

**书目详情弹窗**（`BookDetailModal`）：

- 尺寸：宽 `760px`，内容区 `max-height:68vh` 滚动，窄屏 `max-width:94vw`。
- 标题：`书目详情 · {书名（含卷册）}` + 状态 Tag。
- 区块一「书目信息」：两列网格——书名 / 原版书名 / 卷册 / 版本 / 作者 / 出版社 / 出版年 /
  语言 / 角色 / 页数。
- 区块二「下载信息」（**只两行**）：下载状态（成功 = `holding=owned` 且 `status ∈
  {downloaded, verified}` ｜ 失败 = `status=failed` ｜ 未下载）+ 文件地址（`file_path`，
  无则 `absolute_path`，均无「—」）。
- 渠道尝试折叠块「查看渠道尝试（N）」，默认收起（排障用）。
- 操作区（footer）：`上传书籍`（文件选择器，任意状态）｜ `自动下载`
  （candidate/decided/failed）｜ `验证通过`（downloaded）｜ `关闭`。
- 行为：操作后以服务端返回为准（禁乐观更新）；上传成功就地更新为 `downloaded`。

**统一上传原则**：领域 JSON / 课程 JSON / 书籍 PDF 三类入口一律用
浏览器文件选择器，界面不出现文件路径输入框。书目卡**不显示 kind 标签**（与 roles 语义重复）。

### 4.2 筛选规则

| 筛选项 | 规则 |
| --- | --- |
| 领域筛选 | 树聚焦该领域；领域信息卡仍恒显 |
| 课程筛选 | 只显示匹配课程的下游内容 |
| 状态筛选（书籍阶段） | 无匹配书籍的教程整行隐藏；无匹配教程的课程整组隐藏 |
| 汇总行 | 「当前选择：领域/课程 ×」「筛选结果 N 条教程」与 **[论文探索] 按钮**（§4.4；rejected/superseded 由数据层隐藏） |

**流程筛选 → 书籍状态映射**（**5 档**；与代码
`stores/downloads.ts` `bookInStage` 一致）：

| 筛选档 | 书籍状态 |
| --- | --- |
| 待下载 | candidate / decided |
| 下载中 | downloading |
| 待验证 | downloaded |
| 已完成 | verified |
| 失败 | failed |

`parallel`（平行读物）不计入筛选，`retired`（退役）留痕隐藏。

### 4.3 书籍排序（`sortBooks`，每教程行内）

1. 组序：① 中文教材（language=zh 且 kind=textbook）→ ② 中文习题集（language=zh 且
   kind=exercise）→ ③ 其余（英文教材、配套资料、论文等）。
2. 组内按册数递增：`part` 解析——第一册=1…第五册=5；上/中/下册=1/2/3；单册（part 空）=0
   排组首；答案册=99 排组尾。
3. 同册数按 title 稳定序。

### 4.4 论文展示行与论文探索管理弹窗

**语义切分**：本节「论文展示行」承载**发现论文**——领域级探索、pick 落位的
`qt_books` kind=paper 行且 **refs=domain_id/course_id**；教程挂靠的论文
（refs=knowledge_id）属教程附属资料，仍按 §4.1 口径显示在教程行内。两类以 refs 区分，
互不混列。链路、状态派生与写点口径的唯一事实源是
[downloads-flow.md](downloads-flow.md) §7，本节只规定展示形态。

**数据源**：论文展示行清单经 `GET /api/v1/papers/books` 枚举（8900 规划透传面，
登记于 [api-contracts.md](../architecture/api-contracts.md) §③；上游=REQ-101 R2 的
8901 books 枚举能力；8900 `GET /books` 为 Axiom af_books 代理，不可复用）。端点未实装
或拉取失败（含 404）时**静默按空集处理→整行隐藏**，不进错误横幅、不打扰用户。

**挂载与形态（空则整行隐藏）**：

- **领域级**：DomainCard 底部「论文（k）」行——该领域 refs 下 kind=paper 书行清单
  （标题 + 年 + 五档状态徽标），条目点击复用现有 `BookDetailModal`（零新弹窗）；
- **课程级**：课程头（`dl-course-head`）操作条后挂同形态「论文（k）」行；
  课程行**只展示、无探索入口**——论文探索仅由领域发起，课程论文来自 pick 落位；
- **入口两处**：① 领域右键菜单「论文探索」（§3，不受 exploration_stage 门禁）；
  ② 汇总行「当前选择」处 **[论文探索]** 按钮——打开当前所选领域（课程选中时取其所属领域）
  的管理弹窗；未选择任何领域/课程时置灰。

**论文探索管理弹窗**（新组件，与 ExploreFlowModal 同族观感，单弹窗三段流转）：

1. **发起**：配方切换 前沿|核心（默认前沿）→ 提交 `POST /papers/recommend`（202 返回
   task_id）→ 弹窗转入轮询、领域/课程论文行出现「探索中」徽标；
2. **轮询**：每 5s 读任务与报告态（tasks 链复用）；报告 `ranked` 进入评审段；
3. **评审与落位**：候选表（标题/作者/年/arXiv ID/相关度/goal_fit/总分，已在库条目
   带「已在库」去重标记且默认不勾）＋勾选框＋**每条落位选择器：领域 | 该领域下任一课程**
   →「确认采纳」调 adopt 显式落库→展示采纳计数，回显领域/课程论文行（新位即出书行，
   可继续走既有自动下载/验证操作）。

**规则**：

- 论文行**参与 §4.2 流程筛选**（本质是书行，五档映射照用）；不参与 §4.3 sortBooks
  三组组序，组内按出版年倒序、同年按 arXiv ID 稳定序；
- 论文行展示态（隐藏/探索中/待评审/已沉淀 k 篇/失败）按 downloads-flow §7.2 派生，
  徽标文案与派生条件对齐，**不得**读 exploration_stage 字段；
- 「待评审」时领域行/课程行徽标点击直达管理弹窗评审段（幂等重开，不重复发起任务）。

## 5. 三层状态口径声明

下载管理页涉及三个状态体系，**层级不同、互不冲突**：

| 口径 | 层级 | 值域 | 事实源 |
| --- | --- | --- | --- |
| 探索状态机（六值） | 领域/课程探索流程 | 未开始/已生成/探索中/待确认/已完成/失败 | [downloads-flow.md](downloads-flow.md) §3 |
| 书籍状态机 | 单本书目选用 + 生命周期 | 选用 `candidate/decided/parallel/retired` + 生命周期 `downloading/downloaded/verified/failed`（UI 5 档见 §4.2） | QED-Tracker `architecture/database-private-tables.md`（QED-050-D/QED-060），8901 透传 |
| 仪表盘统计四态 | 书籍获取进度派生统计 | missing→decided→downloading→owned（holding×status 派生） | [admin-dashboard.md](admin-dashboard.md) |

流程筛选（§4.2）是书籍状态机在 UI 上的**分组视图**；仪表盘四态是 holding×status 的
**统计派生**。任何 UI 改动不得混用三者的字段来源。

**论文展示行不是第四套口径**：它是书籍状态机 + 论文任务/报告态的派生视图
（派生表唯一事实源 [downloads-flow.md](downloads-flow.md) §7.2），徽标只读
任务态×报告态×书行态三源，禁读 `exploration_stage`。

## 6. 状态与降级矩阵（异常与降级的用户可见表现）

后端降级规则本身（8900 如何处理）见 [downloads-flow.md](downloads-flow.md) §5.4；
本节只规定**前端呈现**：

| 场景 | 用户可见行为 |
| --- | --- |
| 8900 不可达 | 页面顶部错误横幅 + 重试 |
| 8901 离线 | 「降级模式」横幅；树/领域维护/导入可用，探索与教程/书目操作禁用 |
| 探索会话失效 | `active_session=false` → 提示「探索会话已失效，请重试」 |
| 管线失败 | `explore_pending.kind='error'` → DomainCard 红色提示条 + 失败原因 + 重试 |
| 刷新页面 | 未终态领域由 5s 轮询直读共享表恢复感知 |
| API 失败 | toast 透出服务端 detail；乐观更新禁用，以服务端返回为准 |
| 8901 离线（论文面） | 论文展示行仍显示书行清单（DB 直读）；[论文探索] 入口与弹窗提交禁用 |
| 论文任务失败 | 行徽标「失败」；弹窗评审段显示 error 与重试（不自动重发） |

`explore_pending.kind` 值域（后端写点契约，事实源见
[downloads-flow.md](downloads-flow.md) §5.4）：`review_results` / `name_confirmation` / `error`。

## 7. 教程命名规范（跨项目，请求：QED-Tracker）

- 规范：tutorial 教程 `name = 教程{set_no}：{书名}（{作者}）`（书名作者取自教材决定
  引用 `textbook_ref`；en 套为「教程en：…」）；other_material 归类名不加「教程N」前缀。
- 前端兜底：`tutorialLabel` 在 name 为空时显示「教程{set_no}」。
- 使用手册需包含课程收集五阶段说明（业务流程见 [downloads-flow.md](downloads-flow.md) §6）。

## 8. 已知约束与维护规则

- 状态口径变化（探索状态机、书籍状态机）先改各自事实源文档，本档 §5 声明表与 §4.2
  筛选映射回核即可；端点形状变化归 api-contracts/QED-Tracker 契约，本档不复制。
