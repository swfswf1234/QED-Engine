# 文档下载管理 UI 设计（downloads-ui）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-10
确认状态：暂定
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
> 右侧四层展示、筛选规则、弹窗与状态口径。探索状态机、后端链路、写点矩阵、8901 移交清单
> 归 [downloads-flow.md](downloads-flow.md)；业务流程规则（课程收集五阶段）亦在其 §6。
> 2026-09-10（REQ-070 重组轮）自 downloads-ui.md 演进并收口 domain-explore §3。

## 1. 背景与演进

- 2026-08-18 用户裁决（downloads-manage-redesign 轮）：左树层级与命名、教程叶子只展示、
  流程筛选、书籍卡去 kind 标签、教程命名规范、书籍排序六项改造。
- 2026-09-08（PLAN-033，arch019-explore-ui-logic）：领域探索 UI 逻辑四项改造（R1~R4）
  + 前端改造六项（F1~F6）——**领域层演进为多领域**（共享表领域清单，DomainCard 恒显），
  原「高等数学唯一领域 + 分析/代数/概率分类分组」方案（DOMAIN_MAP/DOMAIN_NAME 常量）
  已被取代退役。
- 本文为两者的合并现状口径：冲突处以 2026-09-08 口径为准。

## 2. 左树结构（领域 → 课程 → 教程）

```
▸ <领域>（共享表领域清单，多领域；DomainCard 恒显不受筛选影响）
  ├─ <课程>（可折叠；点击 = 选中 + 联动筛选）
  │   ├─ 教程1：<书名>（<作者>）      [3/4 已验收]
  │   └─ 教程2：…                    [5/5 已验收]
  └─ …
```

- **领域**：来自 `GET /courses` 领域清单；名称/描述/阶段徽标/explore_pending 提示条由
  DomainCard 呈现（右侧恒显，见 §3.1）；左树支持右键维护（编辑/删除）。
- **课程**：点击选中 + 联立筛选；右键菜单（编辑/删除/课程探索/导入教程，按探索状态禁用，
  见 domain-explore §2 操作表）。
- **教程**：叶子节点，只展示 名称 + 验收进度数字（`verified 数/总数`），不可点击展开；
  书籍明细只在右侧栏/弹窗查看。
- 树宽拖拽（280–640px、localStorage）与默认展开/折叠状态保留。

## 3. 右侧栏

### 3.1 展示层级规范（领域/课程/教程/书目四层）

| 层 | 展示 | 承载 | 可用操作 |
| --- | --- | --- | --- |
| 领域 | 名称、描述、阶段徽标、explore_pending 提示条 | `DomainCard`（**无论筛选如何恒显**） | 探索/确认领域/确认课程（按 domain-explore §2 状态机）；失败态 danger 重试 |
| 课程 | 名称、描述 + **操作条：课程探索、导入教程** | 课程头（`dl-course-head`） | 编辑/删除（左树右键）；课程探索在 探索中/已完成 禁用 |
| 教程 | 名称（`.dl-knowledge-name`）、状态、**进度（下载 x/y 本）**、详情 | 教程行 | 详情（弹窗）、自动下载（candidate/decided/failed 可用）、删除（8901 无 DELETE /knowledge，禁用+Tooltip 移交 REQ-068） |
| 书目 | 书名、作者、语言、**版本标签**（中译本/英文版/苏版/其他，由 language 与书名/作者推导） | 书目卡（纯展示，无操作按钮） | 详情（只读弹窗）；导入/新增书目/否决书目在**教程详情弹窗**内 |

**教程详情弹窗**（`TutorialDetailModal`）：教程信息（修改入口因 8901 无 `PATCH /knowledge`
禁用+移交提示）、书目列表（书名/作者/语言/状态/操作）、**新增书目**（`POST /books` 书库化
创建：`book_id` 格式 `{abbr}-b{NN}` + 书名必填，归属由教程 refs 承载）、书行**导入**
（`POST /books/{id}/register`，数据根内相对路径）、**否决书目**（原因必填）。

**书目详情弹窗**（`BookDetailModal`）只读展示：状态/kind/roles/作者/版本/语言/页数/sha256/
路径/渠道。书目卡**不再显示 kind 标签**（与 roles 语义重复，2026-08-18 裁决），保留
状态（阶段）+ roles + 作者/版本/页数。

### 3.2 筛选规则

| 筛选项 | 规则 |
| --- | --- |
| 领域筛选 | 树聚焦该领域；领域信息卡仍恒显 |
| 课程筛选 | 只显示匹配课程的下游内容 |
| 状态筛选（书籍阶段） | 无匹配书籍的教程整行隐藏；无匹配教程的课程整组隐藏 |
| 汇总行 | 「当前选择：领域/课程 ×」「筛选结果 N 条教程」（rejected/superseded 由数据层隐藏） |

**流程筛选 → 书籍状态映射**（2026-08-18 用户裁决，书籍级生命周期筛选）：

| 流程 | 书籍状态 |
| --- | --- |
| 搜索 | candidate |
| 确认 | decided |
| 下载 | downloading / downloaded / failed |
| 验收 | verified |

### 3.3 书籍排序（`sortBooks`，每教程行内）

1. 组序：① 中文教材（language=zh 且 kind=textbook）→ ② 中文习题集（language=zh 且
   kind=exercise）→ ③ 其余（英文教材、配套资料、论文等）。
2. 组内按册数递增：`part` 解析——第一册=1…第五册=5；上/中/下册=1/2/3；单册（part 空）=0
   排组首；答案册=99 排组尾。
3. 同册数按 title 稳定序。

## 4. 三层状态口径声明

下载管理页涉及三个状态体系，**层级不同、互不冲突**：

| 口径 | 层级 | 值域 | 事实源 |
| --- | --- | --- | --- |
| 探索状态机（六值） | 领域/课程探索流程 | 未开始/已生成/探索中/待确认/已完成/失败 | [downloads-flow.md](downloads-flow.md) §2 |
| 书籍状态机 | 单本书目生命周期 | candidate/decided/downloading/downloaded/failed/verified（rejected/superseded 留痕） | QED-Tracker database-schema（QED-050-D），8901 透传 |
| 仪表盘统计四态 | 书籍获取进度派生统计 | missing→decided→downloading→owned（holding×status 派生） | [admin-dashboard.md](admin-dashboard.md) |

流程筛选（§3.2）是书籍状态机在 UI 上的**分组视图**；仪表盘四态是 holding×status 的
**统计派生**。任何 UI 改动不得混用三者的字段来源。

## 5. 教程命名规范（跨项目，请求：QED-Tracker）

- 规范：tutorial 教程 `name = 教程{set_no}：{书名}（{作者}）`（书名作者取自教材决定
  引用 `textbook_ref`；en 套为「教程en：…」）；other_material 归类名不加「教程N」前缀。
- 前端兜底：`tutorialLabel` 在 name 为空时显示「教程{set_no}」。
- 使用手册需包含课程收集五阶段说明（业务流程见 domain-explore §6）。

## 6. 范围与协作

- **范围内**：本页全部前端展示层（树/卡片/弹窗/筛选/排序/样式）。
- **非目标**：不涉及后端 8900/8901 改动；不请求 QED-Tracker 接口变更（教程命名由其数据侧
  执行，前端 name 原样展示）；不拆分 en 套为独立教程行（排序规则已置组尾）。
- **跨项目协作**：教程命名规范为数据侧改动，按
  [跨项目协作规范](../standards/cross-project-collaboration.md) 登记请求，对方建计划承接。

## 7. 验证

- 前端：`tsc --noEmit` + Vitest 全量（downloads 树结构/排序/流程筛选纯函数单测 +
  Downloads.test.tsx 交互断言 + DownloadsTree.state.test.tsx 状态渲染）。
- 根仓库契约测试：`pytest tests/contract/ -q` 全绿。
- 浏览器验收：左树结构、教程叶子进度、四层展示、流程筛选、书籍排序、弹窗操作链路、
  无 kind 标签。
