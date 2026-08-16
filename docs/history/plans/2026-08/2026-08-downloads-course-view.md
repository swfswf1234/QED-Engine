# 2026-08 文档下载管理课程分页计划（downloads-course-view）

状态：Accepted
任务类型：B
最后更新：2026-08-07
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)
关联设计：[服务契约](../design/service-contracts.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-007 登记；REQ-006 承接执行）
归档判定：用户确认计划（转 Accepted）→ 前端门禁全绿 + 浏览器验收后 Completed，归档至 `history/plans/2026-08/`

## 前置条件

- 十四期已完成并提交（7b53c4b，141 passed + ruff clean + JS OK）。
- 服务运行中：8900（pid 6432）、8901（pid 9708）、8903（pid 24380，静态托管改动即时生效）。
- 用户 2026-08-07 提出重新整理「知识点」界面：
  1. **命名回退**：知识点只是界面左边栏的部分，界面应保持原名称「文档下载管理」；
  2. **默认数学领域**：进入文档下载管理时，界面默认查找数学领域；
  3. **课程分页**：QED-Tracker 已设计数学课程选课需求，未进入领域或未选定领域时默认显示
     前三门课程、可翻页，左右两栏应等高；
  4. **配套并排**：右侧栏按课程显示，联立的教材与对应习题集放置为同一行。

## 目标与成功标准

按用户 2026-08-07 第七轮裁决：

1. **命名回退**：侧边栏菜单与页面标题改回「文档下载管理」；树侧栏头保留「知识点」。
2. **默认选中数学领域**：进入 `#/admin/downloads` 时自动选中「数学」领域
   （`loadTree` 完成后若无既有选择则 `selectNode("domain", "数学")`，刷新树保留用户选择）。
3. **领域级课程分页**：选中领域（含默认数学）时右侧按课程分页，每页最多 3 门
   （`PAGE_SIZE = 3`，`coursePagerHtml` 翻页控件），左右两栏等高
   （`align-items: stretch`）；选中课程/书籍时保持现状。
4. **配套对并排**：同课程内 kind=book 与 kind=exercise 且作者集相同
   （排序后 join 相等、非空）→ 教材卡+习题集卡 `paired-row` 横向并排同一行；
   其余单卡单独展示。

成功标准：根仓库 `pytest tests -q` 全绿 + `ruff check src tests` 无错误 + node --check；
8903 curl token 实测（`文档下载管理` 在 index.html ≥2 处、`知识点` 保留树头、
`PAGE_SIZE = 3`/`renderPanelByCourses`/`pairedCourseTargets` 在 app.js）；浏览器验收。

## 决策记录（用户裁决，2026-08-07）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 命名分配 | 界面（菜单+标题）用「文档下载管理」，树侧栏头保留「知识点」 |
| D2 | 默认数学领域行为 | 进入时自动选中「数学」领域节点（树选中 + 筛选器联动 + 面板按领域渲染） |
| D3 | 分页生效范围 | 领域级按课程分页（每页 3 门、左右等高）；课程级（控制台+步骤条）与书籍级保持现状 |
| D4 | 配套判定标准 | 同课程内 book+exercise 作者集相同（排序后 join、非空）即配套并排 |

## 范围与非目标

范围内：
- `web/index.html`：菜单/标题改名「文档下载管理」。
- `web/app.js`：`PAGE_SIZE = 3`、`state.coursePage`、`renderPanelByCourses`
  （课程分组→分页切片→每课程一行）、`pairedCourseTargets`（配套判定）、
  `coursePagerHtml`（翻页控件）、`coursesOfSelectedDomain`（分页事件辅助）、
  `loadTree` 默认选中数学、`selectNode` 重置页码、分页事件委托。
- `web/style.css`：`.download-layout` 等高（align-items: stretch）、
  `.course-row`/`.course-row-head`/`.paired-row`/`.course-pager`/`.pager-page` 样式。
- `tests/test_web.py`：命名守护反转（「文档下载管理」要求存在）+ 新增
  test_default_select_math_domain / test_domain_course_pager / test_paired_course_targets。
- 文档同步：todo.md（ARCH-007 行 + REQ-006 证据）、plans/index.md、service-contracts.md。

非目标：
- 不动课程级控制台（① 搜索书籍 + 步骤条）与书籍级单本视图。
- 不动 catalog 数据与 QED-Tracker 接口（纯前端）。
- 不改「知识点梳理」学习入口页文案（该「知识点」指学习功能，非本界面）。
- 8900 无改动；Axiom-Flow 不动。

## 工作项

### Phase 1：守护测试更新（TDD 红态）

| 新增/变更 | 断言 |
| --- | --- |
| `ADMIN_MENU_TOKENS = ("仪表大盘", "文档下载管理", "文档解析进度", "原始文档对照")` | 「文档下载管理」在 index.html 菜单 |
| `KNOWLEDGE_TREE_TOKENS = ("知识点",)` + `REMOVED_TREE_TOKENS = ("领域 · 课程 · 书籍",)` | 「知识点」保留树头；「文档下载管理」从移除列表反转 |
| `test_knowledge_tree_naming` | html 含「文档下载管理」≥2 处（菜单+标题）、含「知识点」；app.js 含「知识点」；旧树副标题不在 |
| `DEFAULT_DOMAIN_TOKENS` + `test_default_select_math_domain` | `selectNode("domain", "数学")` 存在且位于 `renderTree()` 之后 |
| `COURSE_PAGER_TOKENS`/`PAIRED_ROW_TOKENS` + `test_domain_course_pager`/`test_paired_course_targets` | `PAGE_SIZE = 3`、`renderPanelByCourses`/`coursePagerHtml`/`pairedCourseTargets` 在 app.js；配套判定基于作者集排序后 join、区分 book/exercise；`paired-row`/`course-row` 类存在 |

### Phase 2：前端实现（TDD 绿态）

- `web/index.html`：菜单 `<span class="nav-text">知识点</span>` → 「文档下载管理」；
  标题 `<h2 class="section-title">知识点</h2>` → 「文档下载管理」；树侧栏头
  `<span>知识点</span>` 保留不动。
- `web/app.js`：
  - `state` 增加 `coursePage: 0`；
  - `loadTree` 的 `renderTree()` 后：`if (!state.selection) selectNode("domain", "数学");`
    （字符串严格 `selectNode("domain", "数学")` 供守护）；
  - `selectNode` 中 `state.coursePage = 0`（切换选择重置页码）；
  - `renderPanel` 中 `rangeTargets` 声明后插入领域分支：
    `if (sel && sel.kind === "domain" && rangeTargets) { renderPanelByCourses(items, rangeTargets); return; }`；
  - `initPopovers` 末尾加 resource-list 分页事件委托（`[data-pager]`，prev/next 翻页后
    `renderPanel()`）；
  - 新增 `PAGE_SIZE = 3`、`pairedCourseTargets`、`coursePagerHtml`、`coursesOfSelectedDomain`、
    `renderPanelByCourses`（按 COURSE_ORDER 排序 → 分页切片 → 每课程一行：
    配套对 `paired-row` 并排 + 非配套单卡 `card-grid`；行头 = 课程名 + 完成徽标；
    复用 `resourceCard` 与「待评估」占位卡逻辑）。
- `web/style.css`：`.download-layout` 的 `align-items: start` → `stretch`；
  新增 `.course-row`/`.course-row-head`/`.course-row-name`/`.paired-row`
  （grid auto-fit minmax(280px, 1fr)）/`.course-pager`/`.pager-page`。

### Phase 3：文档同步

- todo.md：ARCH-007 行登记；REQ-006 证据追加十五期（注意：追加文本不得含裸 `|`，
  行分隔符只保留行尾一个）。
- plans/index.md：活跃计划加 ARCH-007 行。
- service-contracts.md：8903 小节补十五期描述 + 契约引用行补十五期守护。

### Phase 4：验证

- 根仓库：`pytest tests -q`、`ruff check src tests`、`node --check web/app.js`、
  8903 curl token 实测。

## 风险与回退

- 十四期前端改动尚未提交：已先行单独提交（7b53c4b）作为本计划基线。
- REQ-006 行追加证据时误带行分隔符 `|` 曾致契约失败，已在实现中修复并回归。
- 纯前端改动，8903 静态托管无部署步骤，回滚即时生效。

## 验证与验收

- 根仓库：`pytest tests -q` 全绿（142 passed，含三个新守护）、`ruff check src tests`
  无错误、`node --check web/app.js` 通过；8903 curl token 实测：
  `文档下载管理` 在 index.html（菜单+标题）、`知识点` 保留树头、
  `coursePagerHtml`/`paired-row` 在 app.js。
- 浏览器验收要点：
  - 侧边栏菜单与页面标题为「文档下载管理」；树侧栏头仍为「知识点」；
  - 进入 #/admin/downloads 自动高亮「数学」领域节点，右侧显示数学领域课程分页视图
    （第 1 页 3 门课程：01 数学分析/02 线性代数/03 拓扑）；
  - 课程行内：01 陈纪修教材+习题集并排同一行（同作者）；02 Axler 教材+习题集并排；
    吉米多维奇单卡独立；
  - 翻页控件：◀ 上一页 / 1 / 5 / 下一页 ▶，共 5 页（13 门课程 / 3）；
  - 左树与右栏等高（底边对齐）；右栏超长时面板内滚动；
  - 选中课程：控制台+步骤条保持现状；选中书籍：单本视图保持现状。

## 回滚

- 前端改动全部可逆：Task 1~3 各自独立提交（fa3fbf4 / 8b5316f / 72713a4），可单独 `git revert`。
- 无后端/数据改动，无迁移；8903 静态托管回滚即时生效。

## 关闭与归档

- 关闭条件：门禁全绿 + 浏览器验收通过。
- 归档：ARCH-007 从 todo.md 移除并写入 completed.md；plans/index.md 移除该行；
  本计划文件移至 `docs/history/plans/2026-08/`（归档文件内相对链接改纯路径）。
