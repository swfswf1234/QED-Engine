# 2026-08 管理后台信息架构重设计（admin-redesign-v4）

状态：Accepted
任务类型：B
最后更新：2026-08-06
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)
关联设计：[服务契约](../design/service-contracts.md)、[配置中心 API 契约](../design/config-center-api.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-004 登记；REQ-006 承接执行）
归档判定：用户确认计划（转 Accepted）→ REQ-006 执行 → 门禁全绿 + 浏览器验收后 Completed，归档至 `history/plans/2026-08/`

## 前置条件

- ARCH-003 三期已完成（111 passed）：横幅粗粒度化、主界面三卡、仪表盘 SVG 图表、领域树 + 事务面板、三模块空态。
- 8900 配置中心运行中（pid 19400，含 database 真实探测新代码）。
- 8901 QED-Tracker 运行中，但进程（pid 7124，11:34 启动）加载的是 fa3d10e 旧代码，**缺 `/backup` 端点**；
  工作区含 QED-017 未提交改动（backup 三态 + 状态机 + 测试 + 文档，16 文件 237 行）→ 需提交并重启 8901。
- 8903 http.server 静态托管，改动即时生效无需重启。

## 目标与成功标准

按用户 2026-08-06 裁决，对 8903 管理后台做第四轮改造，聚焦**知识结构完整性**与**人类评估辅助**：

1. **管理后台卡片墙**：`#/admin` 首页改为五张模块卡片（仪表盘/文件下载管理/解析进度/原始文档对照/追溯），
   点击进入各模块；文件下载管理卡占双栏（扩展一栏）。
2. **严格三领域**：领域 = 分析 / 代数 / 概率论与数理统计（高等数学三大领域）；点集拓扑与 QE 备考并入分析；
   移除「几何与拓扑」「方程」「概率统计」「备考」旧领域标签。
3. **领域树显示完整知识结构**：树默认全部展开（三领域 × 13 课程 × 全部书籍 target），占主空间
   （默认 60-70% 且可拖拽 240-560px，localStorage 记忆）；评估资源列表收窄为右侧边栏（320-380px）。
4. **任务详情 = 书籍评估辅助视角**（评估/下载任务统一）：标注 课程 → 书籍；书名/类型（book/exercise）/
   中英文（language）/来源（provider/page_url）；LLM 简介与评分；下载详情（状态/进度/relative_path/
   page_count/sha256）；是否适合作解析目标建议（verdict+score 徽标）。
5. **筛选栏**：领域 + 课程（联动）+ 状态，与树选择独立叠加；评估任务列表按 状态/类型/课程 前端过滤。

成功标准：`pytest tests -q` 全绿 + `ruff check src tests` 无错误；8901 重启后三态 API 冒烟
（confirm/backup/reject 各 200）；8903 浏览器验收卡片墙、三领域树完整展开、拖拽、筛选、详情弹窗。

## 决策记录（用户裁决，2026-08-06）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 管理后台五模块形态 | `#/admin` 卡片墙入口，点击进入各模块视图；下载管理卡占双栏 |
| D2 | 拓扑（03）与备考（10）归属 | 严格三领域：二者并入分析 |
| D3 | 树与评估面板空间 | 树主（默认 60-70%，可拖拽 240-560px 记忆）、评估窄（右侧边栏 320-380px） |
| D4 | 任务详情适用范围 | 统一评估视角，评估任务与下载任务都适用 |
| D5 | 按钮 404 处理 | QED-Tracker QED-017 实现就绪未提交 → 提交 + 重启 8901（本计划 Phase 0 配合请求） |
| D6 | 树宽度实现 | 拖拽手柄 + localStorage（`qed-tree-w`，240-560，默认 300/60%） |

严格三领域静态映射（前端常量 `DOMAIN_MAP`）：

| 领域 | 课程 |
| --- | --- |
| 分析 | 01_math_analysis、03_topology、04_real_analysis、05_complex_analysis、06_functional_analysis、07_ode、08_pde、10_qe_prep |
| 代数 | 02_linear_algebra、09_abstract_algebra |
| 概率论与数理统计 | 11_probability、12_stochastic_processes、13_high_dim_prob |

## 范围与非目标

范围内（全部根仓库 `web/` 与 `tests/test_web.py`、文档）：
- 前端：管理后台卡片墙、三领域映射、领域树完整展开 + 拖拽、评估窄栏、筛选栏（领域/课程/状态）、
  任务筛选（状态/类型/课程）、详情弹窗评估视角。
- 文档：service-contracts / todo 台账 / 计划索引；QED-Tracker 侧 QED-017 状态更新（配合请求）。

非目标：
- 8901 QED-Tracker 代码不在本仓库改动；QED-017 未提交改动（backup 端点等）由 QED-Tracker 提交并重启 8901
  （用户评审后执行，已授权代办）。
- 8902 Axiom-Flow 不动。
- 不引入图表库/构建工具；不新增后端端点；不改 8900。
- 卡片墙为前端导航重组，不改变各模块既有数据能力（解析/对照/追溯仍为空态容器）。

## 工作项

### Phase 0：跨项目配合请求（QED-Tracker QED-017 收尾）

1. QED-Tracker：更新 QED-017 状态为「实现就绪，待提交 + 重启验证」（其 tracker-service.md 已含 backup 契约，
   无需新建设计文档）。
2. 根仓库 todo.md 登记配合请求（REQ-006 关联）。
3. 用户评审后（已授权代办）执行：提交 QED-Tracker 16 文件改动（dev 分支）→ 重启 8901 → 三态冒烟
   （`POST /resources/{id}/confirm|backup|reject` 各 200；reject 需 reason body）。
4. 冒烟通过后通知前端联调按钮回归。

### Phase 1：test_web.py 守护更新（TDD 红态）

| 新增/变更 | 断言 |
| --- | --- |
| `ADMIN_HOME_TOKENS = ("admin-card-dashboard", "admin-card-downloads", "admin-card-parsing", "admin-card-compare", "admin-card-trace")` | 五张模块卡片容器在 index.html |
| `DOMAIN_LABELS = ("分析", "代数", "概率论与数理统计")` | 三领域标签出现在 app.js；旧标签（几何与拓扑/概率统计/备考）**不在** app.js |
| `FILTER_TOKENS = ("filter-domain", "filter-course")` | 筛选下拉在 index.html 与 app.js |
| `TASK_FILTER_TOKENS = ("filter-task-status", "filter-task-type", "filter-task-course")` | 任务筛选在 index.html 与 app.js |
| `TREE_RESIZE_TOKENS = ("tree-resizer", "qed-tree-w")` | 拖拽手柄在 index.html、样式/逻辑在 app.js |
| `DETAIL_EVAL_TOKENS = ("解析目标", "中英", "来源")` | 详情弹窗评估字段 token 在 app.js |
| 路由守护 | `#/admin`（卡片墙）+ 新增 `#/admin/dashboard`（仪表盘模块） |

### Phase 2：前端实现（index.html / app.js / style.css）

1. **卡片墙**（index.html `view-admin-home` 新增）：
   - 五张 `admin-card`（图标 + 标题 + 简介），`#/admin` 路由指向卡片墙；点击卡片跳转
     `#/admin/dashboard`、`#/admin/downloads`、`#/admin/parsing`、`#/admin/compare`、`#/admin/trace`。
   - 文件下载管理卡占双栏（`admin-card-downloads` 横跨两列）。
2. **三领域映射**（app.js）：`DOMAIN_MAP` 按决策表重写；`DOMAIN_ORDER = ["分析", "代数", "概率论与数理统计"]`；
   `courseCounts`/`renderTree`/`scopeMatches`/筛选共用。
3. **领域树完整显示**：
   - 树节点默认展开（`collapsed` 仅由用户手动折叠），加载后 `tree.children` 全部可见；
   - 树容器占满 `.download-layout` 主空间（CSS 变量 `--tree-w`，默认 60%），`overflow-y: auto` 完整滚动；
   - 拖拽手柄 `.tree-resizer`：mousedown → document mousemove（240-560 钳制）→ mouseup 存
     `localStorage("qed-tree-w")`；≤768px 单列隐藏手柄。
4. **评估窄栏**：`.download-panel` 固定 320-380px 右侧边栏；资源卡片精简（标题/状态/评分/三态按钮），
   移除旧 toolbar 与任务区分区改为纵向布局（筛选栏 → 面板上下文 → 资源列表 → 任务筛选 → 任务列表）。
5. **筛选栏**：`filter-domain`（全部 + 三领域）/ `filter-course`（全部 + 13 门，随领域联动）/ `filter-status`；
   `state.filters = {domain, course, status}` 与 `state.selection`（树）AND 叠加，`renderPanel()` 统一应用。
6. **任务筛选**：`filter-task-status`（全部/queued/running/succeeded/failed）、`filter-task-type`
   （全部/books/download/catalog/evaluate）、`filter-task-course`（全部 + 课程，取自 `params.course_id`）；
   `loadTasks()` 渲染时前端过滤。
7. **详情弹窗（书籍评估辅助视角）**：`renderTaskDetail`/`renderResourceDetail` 重写——
   - 头部：课程名（catalog 映射 course_id → course_name）→ 书籍名；
   - 字段：书名/作者/类型（book/exercise）/中英（language）/来源（provider + page_url）/版本年份；
   - LLM 简介与评分（summary/score/verdict）；
   - 下载详情：状态/进度/relative_path/page_count/sha256（下载任务 result）；
   - 解析目标建议徽标：verdict=recommend → 推荐（绿）；score<80 或 verdict 非 recommend → 条件/不推荐（黄/红）。

### Phase 3：文档同步

1. `docs/design/service-contracts.md` 8903 小节：卡片墙架构、三领域映射、树主布局、筛选栏、详情弹窗契约。
2. `docs/trackers/todo.md`：REQ-006 证据更新（四期完成记录）、ARCH-004 登记。
3. `docs/plans/index.md`：ARCH-004 链接登记。
4. QED-Tracker：QED-017 状态更新（Phase 0 完成项）。

### Phase 4：验证与部署

1. 全量 `pytest tests -q` + `ruff check src tests`。
2. 8901 重启后冒烟：`POST /resources/{id}/confirm|backup|reject` 各 200。
3. 8903 静态验证：curl 逐项确认新 token（卡片墙/三领域/筛选/树宽/详情字段）。
4. 用户浏览器验收：卡片墙、三领域树完整展开 + 拖拽、筛选、详情弹窗、按钮回归（确认/备选/否定可用）。

## 测试守护一致性清单

### A 组：tests/test_web.py 变更（前端守护，Phase 1 先行红态）

| 测试 | 断言 |
| --- | --- |
| `test_admin_home_cards_present`（新增） | `ADMIN_HOME_TOKENS` 全在 index.html |
| `test_domains_are_three`（新增） | `分析`/`代数`/`概率论与数理统计` 在 app.js；`几何与拓扑`/`概率统计`/`备考` 不在 app.js |
| `test_download_filters_present`（新增） | `FILTER_TOKENS` 在 index.html 与 app.js（含联动逻辑引用） |
| `test_task_filters_present`（新增） | `TASK_FILTER_TOKENS` 在 index.html 与 app.js |
| `test_tree_resizable`（新增） | `tree-resizer` 在 index.html；`qed-tree-w` 在 app.js 与 style.css |
| `test_detail_modal_eval_view`（新增） | `DETAIL_EVAL_TOKENS`（解析目标/中英/来源）在 app.js |
| `test_route_tokens`（更新） | `#/admin` 保留 + 新增 `#/admin/dashboard` |
| 既有测试 | `DOWNLOAD_LAYOUT_TOKENS`/`DASHBOARD_CHART_TOKENS`/`EMPTY_VIEW_TOKENS` 保留（结构沿用） |

### B 组：冒烟清单（8901 重启后手工/curl）

| 项 | 预期 |
| --- | --- |
| `POST /resources/{id}/confirm` | 200，状态 candidate → confirmed（选择真实候选 id） |
| `POST /resources/{id}/backup` | 200，状态 → backup（运行中进程必须含 backup 端点，验证重启生效） |
| `POST /resources/{id}/reject {reason}` | 200，状态 → rejected（reject_reason 非空） |
| 前端按钮回归 | 确认/备选/否定点击不再 404 |

## 验证与验收

- 根仓库门禁：`pytest tests -q` 全绿、`ruff check src tests` 无错误。
- 8901 三态冒烟通过（见 B 组）。
- 8903 静态验证：curl 逐项确认新 token（卡片墙/三领域/筛选/树宽/详情字段）。
- 浏览器验收：`#/admin` 卡片墙五卡（下载管理双栏）；`#/admin/downloads` 领域树完整展开三领域全部课程与
  书籍、拖拽调整宽度并刷新记忆；筛选栏（领域/课程/状态）与树选择叠加过滤；任务筛选生效；
  详情弹窗显示课程→书籍、类型/中英/来源、LLM 简介、下载详情、解析目标建议；确定/备选/否定按钮可用。

## 回滚

- 前端：静态页无构建，回滚 = git revert web/ 三文件 + tests/test_web.py。
- 领域映射为前端常量，替换为 catalog 字段时仅改 app.js。
- 8901 冒烟失败：QED-Tracker 回退提交或修复后重启，不影响 8903 静态页（树/筛选/详情降级展示）。

## 关闭与归档

- 门禁全绿 + 8901 冒烟通过 + 用户浏览器验收后关闭：REQ-006 证据更新，本计划转 Completed，
  归档至 `history/plans/2026-08/`。
