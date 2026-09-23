# 文档下载管理 UI 设计（downloads-ui）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-23
确认状态：已确认
关联代码：`web-ui/src/pages/Downloads.tsx`、`web-ui/src/components/DownloadsTree.tsx`、
`web-ui/src/components/{DomainCard,DomainConfirmModal,CourseConfirmModal,ExploreFlowModal}.tsx`、
`web-ui/src/api/{tracker,explore-helpers}.ts`、`web-ui/src/stores/downloads.ts`、
`web-ui/src/stores/courseMeta.ts`、`web-ui/src/downloads.css`、
`web-ui/src/pages/Downloads.test.tsx`、`web-ui/src/stores/downloads.test.ts`
关联测试：`web-ui/` Vitest（downloads.test.ts / Downloads.test.tsx / DownloadsTree.state.test.tsx）、
`tests/contract/test_design_documents.py`（本文件入 CURRENT_DOCUMENTS）
关联 ADR：无（纯前端展示层，沿用 ADR 0007 唯一入口 8900 与 ADR 0008 React 选型）
关联设计：[downloads-flow.md](downloads-flow.md)（探索状态机与后端链路——本文件只管 UI，
状态机/写点/降级链路以其为准）

> **本文档定位**：文档下载管理页（`#/admin/downloads`）的 **UI 设计文档**——左树结构、
> 右侧四层展示、筛选规则、弹窗、状态口径，以及异常与降级的**用户可见表现**（§4）。
> 探索状态机、后端链路、写点矩阵与降级规则本身归 [downloads-flow.md](downloads-flow.md)；
> 业务流程规则（课程收集五阶段）亦在其 §5。

## 1. 左树结构（领域 → 课程 → 教程）

```
▸ <领域>（共享表领域清单，多领域；DomainCard 恒显不受筛选影响）
  ├─ <课程>（可折叠；点击 = 选中 + 联动筛选）
  │   ├─ 教程1：<书名>（<作者>）      [3/4 已验收]
  │   └─ 教程2：…                    [5/5 已验收]
  └─ …
```

- **领域**：来自 `GET /courses` 领域清单；名称/描述/阶段徽标/explore_pending 提示条由
  DomainCard 呈现（右侧恒显，见 §2.1）；左树支持右键维护（编辑/删除/探索领域知识/
  导入领域知识/添加课程）。右键菜单门禁：探索在 `未开始/已生成/待确认/失败`
  可用（`探索中` 除删除外全部禁用）；**添加课程在 `未开始`/`已生成` 禁用**，`待确认/已完成/失败` 可用。
- **课程**：点击选中 + 联立筛选；右键菜单（编辑/删除/课程探索/导入教程，按探索状态禁用，
  见 [downloads-flow.md](downloads-flow.md) §2.3 操作表）。
- **教程**：叶子节点，只展示 名称 + 验收进度数字（`verified 数/总数`），不可点击展开；
  书籍明细只在右侧栏/弹窗查看。
- 树宽拖拽（280–640px、localStorage）与默认展开/折叠状态保留。

## 2. 右侧栏

### 2.1 展示层级规范（领域/课程/教程/书目四层）

| 层 | 展示 | 承载 | 可用操作 |
| --- | --- | --- | --- |
| 领域 | 名称、描述、阶段徽标、explore_pending 提示条 | `DomainCard`（**无论筛选如何恒显**） | 探索/确认领域/确认课程（按 [downloads-flow.md](downloads-flow.md) §2 状态机）；失败态 danger 重试 |
| 课程 | 名称、描述 + **操作条：课程探索、导入教程** | 课程头（`dl-course-head`） | 编辑/删除（左树右键）；课程探索在 探索中/已完成 禁用 |
| 教程 | 名称（`.dl-knowledge-name`）、状态、**进度（下载 x/y 本）**、详情 | 教程行 | 详情（弹窗）、自动下载（candidate/decided/failed 可用）、删除（`DELETE /knowledge/{id}`） |
| 书目 | 书名、作者、语言、**版本标签**（中译本/英文版/苏版/其他，由 language 与书名/作者推导） | 书目卡（纯展示，无操作按钮） | 详情（弹窗：信息 + 下载信息 + 上传/验证/自动下载）；新增书目在**教程详情弹窗**内 |

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

### 2.2 筛选规则

| 筛选项 | 规则 |
| --- | --- |
| 领域筛选 | 树聚焦该领域；领域信息卡仍恒显 |
| 课程筛选 | 只显示匹配课程的下游内容 |
| 状态筛选（书籍阶段） | 无匹配书籍的教程整行隐藏；无匹配教程的课程整组隐藏 |
| 汇总行 | 「当前选择：领域/课程 ×」「筛选结果 N 条教程」（rejected/superseded 由数据层隐藏） |

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

### 2.3 书籍排序（`sortBooks`，每教程行内）

1. 组序：① 中文教材（language=zh 且 kind=textbook）→ ② 中文习题集（language=zh 且
   kind=exercise）→ ③ 其余（英文教材、配套资料、论文等）。
2. 组内按册数递增：`part` 解析——第一册=1…第五册=5；上/中/下册=1/2/3；单册（part 空）=0
   排组首；答案册=99 排组尾。
3. 同册数按 title 稳定序。

## 3. 三层状态口径声明

下载管理页涉及三个状态体系，**层级不同、互不冲突**：

| 口径 | 层级 | 值域 | 事实源 |
| --- | --- | --- | --- |
| 探索状态机（六值） | 领域/课程探索流程 | 未开始/已生成/探索中/待确认/已完成/失败 | [downloads-flow.md](downloads-flow.md) §2 |
| 书籍状态机 | 单本书目选用 + 生命周期 | 选用 `candidate/decided/parallel/retired` + 生命周期 `downloading/downloaded/verified/failed`（UI 5 档见 §2.2） | QED-Tracker `architecture/database-private-tables.md`（QED-050-D/QED-060），8901 透传 |
| 仪表盘统计四态 | 书籍获取进度派生统计 | missing→decided→downloading→owned（holding×status 派生） | [admin-dashboard.md](admin-dashboard.md) |

流程筛选（§2.2）是书籍状态机在 UI 上的**分组视图**；仪表盘四态是 holding×status 的
**统计派生**。任何 UI 改动不得混用三者的字段来源。

## 4. 异常与降级表现（用户可见行为）

后端降级规则本身（8900 如何处理）见 [downloads-flow.md](downloads-flow.md) §4.4；
本节只规定**前端呈现**：

| 场景 | 用户可见行为 |
| --- | --- |
| 8900 不可达 | 页面顶部错误横幅 + 重试 |
| 8901 离线 | 「降级模式」横幅；树/领域维护/导入可用，探索与教程/书目操作禁用 |
| 探索会话失效 | `active_session=false` → 提示「探索会话已失效，请重试」 |
| 管线失败 | `explore_pending.kind='error'` → DomainCard 红色提示条 + 失败原因 + 重试 |
| 刷新页面 | 未终态领域由 5s 轮询直读共享表恢复感知 |
| API 失败 | toast 透出服务端 detail；乐观更新禁用，以服务端返回为准 |

`explore_pending.kind` 值域（后端写点契约，事实源见
[downloads-flow.md](downloads-flow.md) §4.4）：`review_results` / `name_confirmation` / `error`。

## 5. 教程命名规范（跨项目，请求：QED-Tracker）

- 规范：tutorial 教程 `name = 教程{set_no}：{书名}（{作者}）`（书名作者取自教材决定
  引用 `textbook_ref`；en 套为「教程en：…」）；other_material 归类名不加「教程N」前缀。
- 前端兜底：`tutorialLabel` 在 name 为空时显示「教程{set_no}」。
- 使用手册需包含课程收集五阶段说明（业务流程见 [downloads-flow.md](downloads-flow.md) §5）。

## 6. 范围与协作

- **范围内**：本页全部前端展示层（树/卡片/弹窗/筛选/排序/样式/异常降级表现）。
- **非目标**：不涉及后端 8900/8901 改动；不请求 QED-Tracker 接口变更（教程命名由其数据侧
  执行，前端 name 原样展示）；不拆分 en 套为独立教程行（排序规则已置组尾）。
- **跨项目协作**：教程命名规范为数据侧改动，按
  [跨项目协作规范](../standards/cross-project-collaboration.md) 登记请求，对方建计划承接。
