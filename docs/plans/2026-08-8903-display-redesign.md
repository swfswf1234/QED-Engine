# 2026-08 前端展示重构（display-redesign-v5）

状态：Accepted
任务类型：B
最后更新：2026-08-06
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)
关联设计：[服务契约](../design/service-contracts.md)、[配置中心 API 契约](../design/config-center-api.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-005 登记；REQ-006 承接执行）
归档判定：用户确认计划（转 Accepted）→ REQ-006 执行 → 门禁全绿 + 浏览器验收后 Completed，归档至 `history/plans/2026-08/`

## 前置条件

- ARCH-004 四期已完成（120 passed + ruff clean，已提交 c4864d0）：卡片墙、三领域、树拖拽、筛选、详情弹窗。
- 8900 配置中心运行中（pid 19400）、8901 QED-Tracker 运行中（pid 6772，含 backup 端点）、
  8903 http.server 静态托管（改动即时生效无需重启）。
- 用户浏览器验收 ARCH-004 时提出新一轮展示问题：入口页暴露服务状态、仪表盘信息密度不够、
  知识体系树命名与计数不直观、筛选下拉文字不可读。

## 目标与成功标准

按用户 2026-08-06 第五轮裁决，对 8903 前端做展示重构，**面向学习用户**：

1. **入口页零后台痕迹**：`#/` 只保留学习入口（三学习卡）+「使用手册」入口；移除
   「配置中心/QED-Tracker/Axiom-Flow」三张服务状态卡（全部移入仪表盘）。
2. **使用手册**：内置弹窗（`help-modal`），全模块短步骤说明（学习界面/管理后台/仪表盘/知识体系树/三态评估），
   纯前端内容，不依赖后台服务。
3. **仪表盘 = 本期功能大盘**：四阶段流水线（发现下载 → 评估确认 → 解析 → 知识整理）+
   服务健康分组面板（服务开关 / LLM 联通 / 数据库联通，异常展开问题文案）；移除旧统计卡/环形图/条形图。
4. **知识体系树**：树侧栏标题与侧边栏菜单均改为「知识体系」；四级树
   （知识体系 → 领域 → 课程 → 书籍目标）；计数在名称标注栏内显示「（N本）」（如「泛函分析（4本）」），
   无资源不显示；领域自适应（catalog 数据驱动，前端不硬编码领域名）；默认 知识体系→领域 展开、课程收起。
5. **筛选器样式**：原生 select 改按钮弹层式筛选器（浅底深字，选中高亮），修复文字不可读问题。

成功标准：`pytest tests -q` 全绿 + `ruff check src tests` 无错误；8903 curl token 实测；
浏览器验收（入口页无服务状态、手册弹窗、流水线+健康面板、四级树计数、筛选弹层可读、三态按钮回归）。

## 决策记录（用户裁决，2026-08-06）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 入口页形态 | 三学习卡 + 右上角管理入口（保留）；移除服务状态卡 |
| D2 | 服务状态卡去向 | 全部移入仪表盘（健康分组面板），入口页不保留 |
| D3 | 手册形式 | 内置弹窗（全模块短步骤，纯前端） |
| D4 | 流程进度形态 | 四阶段流水线条（可用数据先展示，缺源标注「未启用」） |
| D5 | 健康面板组织 | 分组（服务开关/LLM/数据库）+ 异常展开问题文案 |
| D6 | 知识体系树 | 顶层固定「知识体系」，下一级领域自适应；四级树；计数「（N本）」标注栏 |
| D7 | 筛选器 | 按钮弹层（浅底深字），替代原生 select |
| D8 | 旧图表 | 环形图/条形图/统计卡移除（信息由流水线与筛选覆盖） |
| D9 | 树默认展开 | 知识体系→领域 展开、课程收起（计数不展开即可见） |

## 范围与非目标

范围内（全部根仓库 `web/` 与 `tests/test_web.py`、文档）：
- 前端：入口页重构、手册弹窗、仪表盘流水线+健康面板、知识体系四级树、按钮弹层筛选器。
- 文档：service-contracts 8903 小节 / todo 台账 / 计划索引。

非目标：
- 8901/8900 接口不变，无跨项目配合项；Axiom-Flow 不动。
- 不引入图表库/构建工具；解析/知识整理阶段数据源未就绪时显示「未启用」，不伪造数据。
- 学习三功能（知识点梳理/学习/刷题模式）仍为建设中，本期不实现其内容。

## 工作项

### Phase 1：test_web.py 守护更新（TDD 红态）

| 新增/变更 | 断言 |
| --- | --- |
| `MANUAL_TOKENS = ("使用手册", "help-modal")` | 手册入口与弹窗容器在 index.html；手册内容 token 在 app.js |
| `PIPELINE_TOKENS = ("pipeline", "发现下载", "评估确认", "解析", "知识整理")` | 流水线容器与阶段名在 index.html/app.js |
| `HEALTH_TOKENS = ("health-panel", "服务", "LLM", "数据库")` | 健康面板分组在 index.html/app.js |
| `KNOWLEDGE_TOKENS = ("知识体系",)` | 树标题与菜单在 index.html/app.js（旧「领域 · 课程 · 书籍」移除） |
| `FILTER_POPOVER_TOKENS = ("filter-popover",)` | 按钮弹层筛选在 index.html/app.js/style.css |
| `TREE_COUNT_TOKENS = ("（N本）"替代 token 或格式断言)` | app.js 计数渲染格式（名称 + （N本）） |
| 移除/调整 | `service-status` 卡片 token（hero-status）、`DASHBOARD_CHART_TOKENS`（donut/course-bars）、`HOME_ENTRY_TOKENS` 加「使用手册」 |

### Phase 2：前端实现（index.html / app.js / style.css）

1. **入口页**（index.html `page-home`）：
   - 删除 `hero-status` 服务卡区；Hero 保留标语 + 简述；
   - topbar 新增「使用手册」按钮（`btn-help`）；三学习卡保留「建设中」徽标；
   - 新增 `help-modal`（手册弹窗：标题 + 各模块短步骤列表 + 关闭）。
2. **仪表盘重写**（app.js `loadDashboard` 重写 + index.html `view-dashboard`）：
   - 四阶段流水线：`pipeline` 容器，每阶段块（名称/完成数/总数/百分比/小字说明）；
     数据源：阶段1 发现下载 = candidate+confirmed 数、阶段2 评估确认 = confirmed 数、
     阶段3 解析 = Axiom-Flow 未就绪 →「未启用」、阶段4 知识整理 = 无数据源 →「未启用」；
     8901 离线时流水线整体显示离线。
   - 健康面板：`health-panel` 三组（服务开关：tracker/axiom/config；LLM：8900 `/config/llm-status`
     逐 provider 可达性；数据库：8900 `/config/database` reachable + 向量库占位）；
     异常项展开问题文案（如「连接超时：无法访问 127.0.0.1:8902」）。
3. **知识体系树**：
   - 侧栏标题改「知识体系」（index.html `side-head`）；侧边栏菜单「文件下载管理」改「知识体系」
     （hash 路由 `#/admin/downloads` 保留不变）；
   - `renderTree` 四级结构：知识体系（根，总书数）→ 领域（自适应：catalog course_id 前缀推导或
     catalog 无领域字段时按现有 DOMAIN_MAP 分组为「数学」单一领域兜底）→ 课程 → 书籍目标；
     计数渲染 `名称（N本）` 于标注栏（无资源不显示）；
   - 默认展开：知识体系与领域层展开，课程收起（加载后仅课程层 `collapsed`）。
4. **按钮弹层筛选器**：
   - 资源筛选：`filter-domain`/`filter-course`/`filter-status` 三个按钮（显示当前值，点击弹层面板
     列出选项，浅底深字，选中项高亮）→ 替换原生 select（index.html 结构 + app.js 逻辑 + style.css）；
   - 任务筛选：`filter-task-status`/`filter-task-type`/`filter-task-course` 同机制；
   - 保留与树选择 AND 叠加逻辑与「触发评估」跟随课程筛选逻辑。
5. **手册内容**（app.js 常量数组）：学习界面 / 管理后台入口 / 仪表盘（流水线与健康怎么看）/
   知识体系树（筛选、三态评估：确定/备选/否定、转正/放弃、开始下载）/ 常见问题（离线提示含义）。

### Phase 3：文档同步

1. `docs/design/service-contracts.md` 8903 小节：入口页零后台痕迹、手册弹窗、仪表盘流水线+健康面板、
   知识体系四级树与计数格式、按钮弹层筛选器。
2. `docs/trackers/todo.md`：REQ-006 证据更新（五期）、ARCH-005 登记。
3. `docs/plans/index.md`：ARCH-005 链接登记。

### Phase 4：验证与部署

1. 全量 `pytest tests -q` + `ruff check src tests`。
2. 8903 静态验证：curl 逐项确认新 token（手册/流水线/健康/知识体系/弹层筛选）。
3. 用户浏览器验收：入口页无服务状态卡、手册弹窗可开、仪表盘流水线+健康面板（异常文案）、
   知识体系树（数学（N本）/泛函分析（4本））、筛选弹层文字可读、三态按钮回归。

## 测试守护一致性清单

### A 组：tests/test_web.py 变更（Phase 1 先行红态）

| 测试 | 断言 |
| --- | --- |
| `test_manual_modal_present`（新增） | `使用手册` 在 index.html；`help-modal` 在 index.html 与 app.js |
| `test_pipeline_present`（新增） | `PIPELINE_TOKENS` 在 index.html 与 app.js |
| `test_health_panel_present`（新增） | `HEALTH_TOKENS` 在 index.html 与 app.js |
| `test_knowledge_tree_naming`（新增） | `知识体系` 在 index.html 与 app.js；`领域 · 课程 · 书籍` 不在 index.html |
| `test_filter_popover_present`（新增） | `filter-popover` 在 index.html 与 app.js；浅底深字样式 token 在 style.css |
| `test_tree_count_format`（新增） | app.js 计数渲染包含 `（` `本）` 格式 token |
| `test_home_has_no_service_status`（新增） | `service-status`/`hero-status` 不在 index.html |
| `test_dashboard_charts_removed`（新增） | `donut-chart`/`course-bars` 不在 index.html 与 app.js |
| 既有测试 | `ROUTE_TOKENS`、`ADMIN_HOME_TOKENS`、`DOWNLOAD_LAYOUT_TOKENS`、三态/离线/横幅守护保留 |

### B 组：冒烟清单（浏览器验收）

| 项 | 预期 |
| --- | --- |
| `#/` 入口页 | 无服务状态卡；手册按钮弹窗；三学习卡 |
| `#/admin/dashboard` | 流水线四阶段（下载/确认有数、解析/整理未启用）+ 健康面板（tracker 在线、axiom 离线问题文案、LLM/数据库状态） |
| `#/admin/downloads` | 树标题「知识体系」；四级树；「数学（N本）」「泛函分析（4本）」计数；默认领域展开课程收起 |
| 筛选弹层 | 浅底深字可读，选中高亮，与树选择叠加过滤 |
| 三态按钮 | 确定/备选/否定/转正/放弃/开始下载 可用（8901 在线） |

## 验证与验收

- 根仓库门禁：`pytest tests -q` 全绿、`ruff check src tests` 无错误。
- 8903 静态验证：curl 逐项确认新 token。
- 浏览器验收清单见 B 组。

## 回滚

- 前端：静态页无构建，回滚 = git revert web/ 三文件 + tests/test_web.py。
- 流水线/健康面板数据源为 8900/8901 现有端点，无新增接口；离线时降级显示，不影响入口页与知识体系树。
- 弹层筛选器为纯前端交互替换，逻辑（AND 叠加/课程联动/任务过滤）不变。

## 关闭与归档

- 门禁全绿 + 用户浏览器验收后关闭：REQ-006 证据更新，本计划转 Completed，归档至 `history/plans/2026-08/`。
