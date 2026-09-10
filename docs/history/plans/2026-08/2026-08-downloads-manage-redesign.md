# 2026-08 下载管理界面重构轮计划（downloads-manage-redesign）

状态：In Progress
任务类型：B
最后更新：2026-08-20
关联 ADR：无（纯前端展示层，沿用 ADR 0007/0008）
关联设计：[下载管理界面重构设计](../../../design/downloads-ui.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-015 登记；REQ-006 承接执行）
归档判定：用户确认计划（转 Accepted）→ 前端门禁全绿 + 浏览器验收 + QED-Tracker 命名
回执后 Completed，归档至 `history/plans/2026-08/`

## 前置条件

- web-ui 四界面已切换（2026-08-17，ARCH-011 实施完成）；下载管理为当前 React 版
  （web-ui/src/pages/Downloads.tsx + components/DownloadsTree.tsx + stores/downloads.ts）。
- 8901 在线（3 个教程行 01 数学分析：套1/套2/套3）；8900 在线。
- 用户 2026-08-18 裁决（设计文档 §1）：左树四层（高等数学→分类→课程→教程叶子+进度）、
  右侧流程筛选（搜索/确认/下载/验收）+ 保留原三个下拉、书籍卡去 kind、书籍排序、
  教程命名由 QED-Tracker 数据侧统一。

## 目标与成功标准

1. **左树四层**：领域=高等数学（固定、可折叠、点击=全量）；分类=分析/代数/概率（仅展示，
   不可点击）；课程=13 门（点击=选中+联动筛选，可折叠）；教程=叶子（只展示名称+验收进度
   「x/y 已验收」，不可点击不可展开）。
2. **右侧筛选栏**：四个下拉并存——领域（选项含 高等数学/分析/代数/概率）、课程、状态、
   流程（全部/搜索/确认/下载/验收），AND 叠加；流程=书籍级过滤，无匹配书籍的教程行隐藏。
3. **书籍卡**：去掉 kind 标签，保留 状态+roles+作者/版本/页数。
4. **书籍排序**：中文教材→中文习题集→其余；组内册数递增（第一册=1…上/中/下=1/2/3、
   单册=0 组首、答案册=99 组尾）。
5. **教程命名**：由 QED-Tracker 数据侧改为「教程N：书名（作者）」；前端 name 原样展示，
   name 空时兜底「教程{set_no}」；根仓库登记跨项目请求。

成功标准：`web-ui` tsc + vitest 全绿；根仓库 `pytest tests/contract -q` 全绿；
8900/8901 联调真实数据浏览器验收。

## 决策记录（用户裁决，2026-08-18）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 左树结构 | 领域=高等数学（唯一）→ 分类（分析/代数/概率，仅展示）→ 13 课程（可点击）→ 教程（叶子，只展示+进度） |
| D2 | 流程映射 | 搜索=候选 / 确认=已决定 / 下载=下载中+已下载+失败 / 验收=已验证 |
| D3 | 教程进度 | 验收进度数字「x/y 已验收」，不展开书籍 |
| D4 | 筛选栏 | 原三个下拉（领域/课程/状态）全保留 + 新增「流程」下拉（为容错） |
| D5 | 教程命名 | QED-Tracker 改数据命名「教程N：书名（作者）」，前端原样展示 |

## 范围与非目标

范围内（纯前端 web-ui，本仓库实现）：
- `web-ui/src/stores/courseMeta.ts`：领域常量 DOMAIN_NAME、分类名「概率论与数理统计」→「概率」。
- `web-ui/src/stores/downloads.ts`：buildTreeNodes 四层重构（领域→分类→课程→教程叶子）、
  `sortBooks` 排序纯函数、`FLOW_OPTIONS`/流程过滤纯函数、`tutorialLabel` 兜底。
- `web-ui/src/components/DownloadsTree.tsx`：新树渲染（领域可折叠/分类头/课程/教程叶子+进度）。
- `web-ui/src/pages/Downloads.tsx`：筛选栏四下拉（+流程）、书籍卡去 kind、排序应用、过滤逻辑。
- `web-ui/src/downloads.css`：分类头/进度徽标等新样式。
- 测试：`stores/downloads.test.ts` + `pages/Downloads.test.tsx` 同步。

非目标：
- 不请求 QED-Tracker 接口变更（命名由其数据侧执行，REQ-041 登记）。
- 不改后端 8900/8901；不动学习中心（Knowledge.tsx 用独立 KNOWLEDGE_DOMAINS）。
- 不拆分 en 套为独立教程行。

## 工作项

### Phase 1：课程元数据常量（TDD）

- `stores/courseMeta.ts`：新增 `export const DOMAIN_NAME = '高等数学'`；`DOMAIN_ORDER`
  改为 `['分析', '代数', '概率']`（概率论与数理统计 → 概率）。DOMAIN_MAP 映射值同步
  （11/12/13 → 概率）。
- `stores/downloads.test.ts` 同步：领域映射断言更新（三分类名）。
- `stores/knowledge.ts` 不动（KNOWLEDGE_DOMAINS=['数学'] 独立）。

### Phase 2：downloads store 纯函数（TDD）

- `buildTreeNodes` 重构：返回 `DomainNode { name:'高等数学', categories: CategoryNode[] }`；
  `CategoryNode { name, courses: CourseNode[] }`；课程含 `tutorials: TutorialNode[]`；
  `TutorialNode` 增 `verified: number`（books 中 status=verified 计数）与 `total: number`。
  教程按 set_no 升序（en 排后），仅 kind=tutorial 计数进度；other_material 归类同列教程。
- 新增 `sortBooks(books)` 纯函数（组序+册数排序）。
- 新增流程常量与 `bookInFlow(book, flow)` 过滤纯函数。
- `tutorialLabel`：name 空时 `教程{set_no}` 兜底。
- store 增 `filters.flow: string`、`setFilter('flow', v)`。

### Phase 3：DownloadsTree 渲染（TDD）

- 领域节点：可折叠（caret 可点）、点击选中+清课程筛选；显示「N 门课程」计数。
- 分类头：纯展示（不可点击），显示课程数；默认展开。
- 课程节点：可折叠、点击选中+联动筛选（保持现有逻辑）。
- 教程叶子：只展示 name + `x/y 已验收` 进度徽标，不可点击不可展开（去掉 caret 与书籍展开）。

### Phase 4：Downloads 页面（TDD）

- FilterBar：领域下拉选项改为 `['高等数学', '分析', '代数', '概率']`（DOMAIN_NAME 打头 +
  分类）；新增「流程」下拉（FLOW_OPTIONS）；课程/状态下拉保留。
- 过滤逻辑：filters.domain 匹配分类（高等数学=全部）；filters.flow 书籍级过滤——教程行内
  书籍过滤后为空则该行隐藏；汇总文案更新。
- BookCard：删除 kind 标签，保留 状态+roles。
- 书籍渲染顺序：`sortBooks(books)` 应用。

### Phase 5：样式

- `downloads.css`：分类头样式（.dl-tree-category）、教程叶子进度徽标、领域折叠态。

### Phase 6：跨项目登记与文档同步

- todo.md：ARCH-015 行登记；REQ-041（教程命名规范，请求：QED-Tracker）登记。
- plans/index.md：活跃计划加 ARCH-015 行。
- design/index.md 与 test_design_documents.py 已同步（设计文档先行落盘）。

### Phase 7：验证

- `web-ui`：`npx tsc --noEmit` + `npx vitest run` 全绿。
- 根仓库：`pytest tests/contract -q` 全绿。
- 8900/8901 真实数据浏览器验收（树结构/分类/进度/流程筛选/排序/无 kind）。

## 实施记录（2026-08-20）

- Phase 1~5 已按 TDD 完成：`courseMeta.ts`（DOMAIN_NAME/概率改名）、`downloads.ts`
  （四层树 + sortBooks + bookInFlow + tutorialLabel 兜底 + filters.flow）、
  `DownloadsTree.tsx`（领域可折叠/分类头/课程/教程叶子+进度）、`Downloads.tsx`
  （四下拉 + 书籍卡去 kind + 排序/流程过滤）、`downloads.css` 新样式。
- 测试：`web-ui` vitest 全量 **87 passed**；`tsc --noEmit` 无错；`npm run build` 成功。
- 契约：`pytest tests/contract -q` 当前 2 failed，均为**非本计划引入**的外部未提交改动
  （文档解析管理轮 REQ-042：`docs/design/exploration.md` 未入 CURRENT_DOCUMENTS、
  `docs/trackers/roadmap.md` 行 12 关联任务「文档解析管理轮」非任务 ID），待用户裁决处理。
- 待办：浏览器验收（8900/8901 真实数据）；REQ-041（QED-Tracker 教程命名）回执后联调确认。

## 风险与回退

- 契约测试对 docs/design 有 CURRENT_DOCUMENTS 断言：设计文档必须先入测试清单（已做）。
- 纯前端改动，web-ui/dist 由 serve_web.py 托管，构建后即时生效；回滚可单独 revert 各提交。

## 验证与验收

- web-ui：tsc 无错 + vitest 全绿（含新增 sortBooks/流程过滤/树结构断言）。
- 根仓库：`pytest tests/contract -q` 全绿。
- 浏览器验收要点：
  - 左树：高等数学 可折叠；分析/代数/概率 分类头不可点；13 课程可点可选；
    教程叶子显示「教程1：数学分析原理（Rudin）  [3/4 已验收]」样式、不可点；
  - 筛选栏：四下拉并存；选「验收」仅显示已验收书籍、无匹配教程行隐藏；
  - 书籍卡：无 kind 标签；套2 内 菲赫 3 卷（第一/二/三册）→ 谢惠民 上下册 排序正确；
    套1 内 Rudin 中译 → 吉米多维奇+题解 → Rudin 英文版 排序正确；
  - 教程命名：name 已由 QED-Tracker 改后显示「教程N：…」（未改前兜底「教程{set_no}」）。

## 回滚

- 各 Phase 独立提交，可单独 `git revert`；无后端/数据改动，8903 静态托管回滚即时生效。

## 关闭与归档

- 关闭条件：门禁全绿 + 浏览器验收通过；REQ-041（QED-Tracker 命名）回执后联调确认。
- 归档：ARCH-015 从 todo.md 移除并写入 completed.md；plans/index.md 移除该行；
  本计划文件移至 `docs/history/plans/2026-08/`（归档文件内相对链接改纯路径）。