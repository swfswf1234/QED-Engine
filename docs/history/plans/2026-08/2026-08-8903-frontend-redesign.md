# 2026-08 8903 前端三期改造计划（frontend-redesign-v3）

状态：Accepted
任务类型：B
最后更新：2026-08-06
关联 ADR：[ADR 0002](../../../history/adr/v0.1/0002-frontend-and-port-centralization.md)
关联设计：[服务契约](../../../design/cross-project-contracts.md)、[配置中心 API 契约](../../../architecture/api-contracts.md)、[统一配置与密钥规范](../../../design/project-configuration.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-003 登记；REQ-006 承接执行）
归档判定：用户确认计划（转 Accepted）→ REQ-006 执行 → 门禁全绿 + 浏览器验收后 Completed，归档至 `history/plans/2026-08/`

## 前置条件

- 8903 二期已落地：蓝黑风格 + hash 路由 + 下载管理三视图 + 详情弹窗 + llm-status（105 passed）。
- 8900 配置中心运行中（用户进程，pid 10700）；后端变更后需重启，执行时先请示或由用户重启。
- 8901 QED-Tracker 运行中，`/catalogs/math-qe` 与 `/resources` 可用（catalog 无领域字段，由前端映射兜底）。
- QED_env 可安装新依赖（pymysql，纯 Python）。

## 目标与成功标准

按用户 2026-08-06 裁决，对 8903 前端做第三轮改造，聚焦**信息粗粒度化**与**业务聚焦**：

1. 横幅不透露细节：只显示「LLM评估模块连接：OK」「MySQL数据库连接：OK」（后续向量数据库同模式），移除 provider 名、host:port 等细节。
2. 主界面收敛为三项：知识点梳理 / 学习 / 刷题模式。
3. 仪表盘 = 整体效果：总体数字 + 图表（状态分布环形图、课程分布条形图），无明细细节。
4. 文件下载管理重设计为「领域-课程-书籍」三级树 + 事务面板，成为主要使用界面。
5. 解析进度 / 原始文档对照 / 追溯：只展示各自事务数据，无数据时置空（移除宣传性占位）。

成功标准：`pytest tests -q` 全绿 + `ruff check src tests` 无错误；8900 实测 `/config/database` 返回真实连接结果；8903 浏览器验收横幅/仪表盘/领域树符合上述语义。

## 决策记录（用户裁决，2026-08-06）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 「领域」层级数据来源（catalog 仅课程→书籍两层） | 前端静态映射 `DOMAIN_MAP`（course_id → 领域），后续 QED-Tracker catalog 加字段再替换 |
| D2 | 「LLM评估模块连接：OK」判定标准 | 任一已配置供应商可达即 OK；无配置显示「未配置」；有配置全不可达显示「不可用」 |
| D3 | MySQL 连接验证方式 | 8900 增加 pymysql 依赖做真实认证探测（3s 超时、60s 缓存、密码绝不下发） |
| D4 | 仪表盘图表实现 | 手写 SVG/CSS（无外部依赖，离线可用） |
| D5 | 追溯模块去留 | 保留，按空态处理（与解析进度/文档对照一致） |
| D6 | 文件下载管理交互形态 | 领域树（左）+ 事务面板（右） |

领域静态映射（D1，前端常量 `DOMAIN_MAP`）：

| 领域 | 课程 |
| --- | --- |
| 分析 | 01_math_analysis、04_real_analysis、05_complex_analysis、06_functional_analysis |
| 代数 | 02_linear_algebra、09_abstract_algebra |
| 几何与拓扑 | 03_topology |
| 方程 | 07_ode、08_pde |
| 概率统计 | 11_probability、12_stochastic_processes、13_high_dim_prob |
| 备考 | 10_qe_prep |

## 范围与非目标

范围内（全部根仓库 `src/qed_engine/` 与 `web/`）：
- 后端：`/config/database` 增加真实连接探测（pymysql + 缓存）；`schemas.py` 扩展。
- 前端：横幅、主界面、仪表盘、文件下载管理、三个空态模块。
- 文档：config-center-api / service-contracts / code-map / todo 台账。

非目标：
- 8901 QED-Tracker 不改（catalog 领域字段属跨项目请求，另行登记；本计划用前端映射兜底）。
- 8902 Axiom-Flow 不动（离线时相关视图显示空态）。
- 不引入图表库/构建工具；不新增后端端点（database 端点扩展字段，llm-status 保持原契约）。

## 工作项

### Phase 1：后端 MySQL 真实连接探测（TDD 红→绿）

1. `pyproject.toml` 增加 `pymysql>=1.1`，并安装到 QED_env。
2. `src/qed_engine/api/main.py`：
   - 新增 `DB_STATUS_TTL_SECONDS = 60.0` 与 `_probe_mysql(settings) -> tuple[bool, str]`：
     `pymysql.connect(host, port, user, password, db, connect_timeout=3)`；成功即 `close()` 返回 `(True, "")`；
     异常映射为简短原因（`超时` / `认证失败` / `连接失败`），**错误信息不含密码与主机细节**。
   - `/config/database` 增加 `reachable`、`reason` 字段，按缓存逻辑探测（独立于 llm-status 缓存）。
3. `src/qed_engine/api/schemas.py`：`DatabaseResponse` 增加 `reachable: bool`、`reason: str = ""`。
4. `tests/test_api.py` 新增 4 测试（见「测试守护一致性清单」A 组），monkeypatch `api_main._probe_mysql` 与 `DB_STATUS_TTL_SECONDS`。

### Phase 2：前端改造（TDD：先改 test_web.py 守护 → 红 → 实现 → 绿）

1. **横幅**（index.html 容器不变，app.js 重写渲染）：
   - `LLM评估模块连接：OK / MySQL数据库连接：OK / 向量数据库连接：—`
   - LLM 聚合：`configured = 任一 provider 的 reason !== "未配置"`；`ok = configured && 任一 reachable`；
     展示 `OK`（绿）/ `不可用`（红）/ `未配置`（灰）。
   - 数据库：`db.reachable → OK`；`db.configured && !reachable → 连接失败`；`!db.configured → 未配置`。
   - 移除：provider 逐个展示、host:port、密钥布尔。
2. **主界面**（index.html feature-grid 三卡重命名与语义调整）：
   - 知识点梳理（教材解析产物的知识结构梳理）/ 学习（按知识点的学习路径）/ 刷题模式（按知识点温故刷题）。
3. **仪表盘**：
   - 数字卡保留（候选 / 已确认 / 已下载 / 已验收 / 任务进行中）。
   - 新增 `dashboard-charts` 区：`donut-chart`（资源状态分布环形图，SVG stroke-dasharray）+ `course-bars`（课程分布横向条形图）。
   - 无数据 → 图表区显示「暂无数据」空态。
4. **文件下载管理重设计**（替换候选/任务/验收三 Tab 结构）：
   - `download-layout`：左侧 `domain-tree`（领域 → 课程 → 书籍，节点含 `tree-badge` 计数：
     候选/已下载/已验收），右侧 `download-panel` 事务区。
   - 面板：选中节点（领域/课程/书籍）范围资源列表（复用 resourceCard + 详情弹窗 + 确认/拒绝/验收）；
     顶部保留状态筛选下拉与「触发评估」（按课程或全目录）；任务列表并入面板任务区块（保留 1s 自动刷新）。
   - 数据源：8901 `/catalogs/math-qe`（targets）+ `/resources`。
5. **三个空态模块**（解析进度 / 原始文档对照 / 追溯）：
   - 移除 parsing-flow / compare-layout / trace-chain 宣传占位。
   - 各视图保留数据容器（`parsing-data` / `compare-data` / `trace-data`），无数据源时显示
     「暂无数据（数据管线就绪后展示）」空态。
6. `web/style.css`：领域树、事务面板、图表、空态样式（沿用蓝黑风格与响应式断点）。

### Phase 3：文档同步

1. `docs/architecture/api-contracts.md`：`/config/database` 增加 reachable/reason 契约、pymysql 探测与 TTL 说明。
2. `docs/design/service-contracts.md`：8903 前端小节更新（横幅粗粒度语义、主界面三项、仪表盘图表、领域树、空态模块）。
3. `docs/architecture/code-map.md`：database 行描述更新。
4. `docs/trackers/todo.md`：REQ-006 证据更新（三期完成记录）。

### Phase 4：验证与部署

1. 全量 `pytest tests -q` + `ruff check src tests`。
2. **重启 8900**（后端变更需重启生效；8900 为用户启动进程 pid 10700，执行时先请示或由用户重启）。
3. 实测：`/config/database` 返回 reachable/reason（未配置/超时/认证失败各分支）；8903 静态资源逐项 curl 验证 token。
4. 用户浏览器验收：横幅文案、仪表盘图表、领域树导航、主界面三卡。

## 测试守护一致性清单

### A 组：tests/test_api.py 新增（后端数据库探测）

| 测试 | 断言 |
| --- | --- |
| `test_database_unconfigured_skips_probe` | 无密码 → `reachable=False, reason="未配置"`，`_probe_mysql` 未被调用 |
| `test_database_probe_success` | monkeypatch 探测成功 → `reachable=True, reason=""` |
| `test_database_probe_failure_reason_preserved` | 探测失败（如"超时"）→ reason 保留 |
| `test_database_cached_within_ttl` | TTL 内第二次请求不重探（monkeypatch `DB_STATUS_TTL_SECONDS` 负值验证重探） |

注：database 既有测试若断言精确响应结构需同步扩展；字段新增向后兼容。

### B 组：tests/test_web.py 变更（前端守护）

| 现有项 | 变更 |
| --- | --- |
| `HOME_ENTRY_TOKENS = ("知识点", "练习", "温故知新", "管理后台")` | → `("知识点梳理", "学习", "刷题模式", "管理后台")` |
| `test_index_references_app_and_style` 断言 `("候选", "任务", "验收")` | 三 Tab 移除 → 改为守护新结构 token（`domain-tree` / `download-panel` / `tree-node`） |
| `test_admin_views_are_differentiated` 断言 `parsing-flow / compare-layout / trace-chain` | → 改为守护空态容器（`parsing-data` / `compare-data` / `trace-data` + `empty-state`） |
| 新增 `test_dashboard_has_charts` | `dashboard-charts` / `donut-chart` / `course-bars` 出现在 index.html 与 app.js |
| 新增 `test_banner_coarse_grained` | 横幅只含粗粒度文案：`LLM评估模块连接` / `MySQL数据库连接`；**不含** provider 名单（`qwen`/`glm`/`deepseek` 拼接展示）与 host:port 模式 |
| `CONFIG_ENDPOINT_TOKENS` | 保留不变（llm-status 端点仍被横幅聚合逻辑引用） |
| `ROUTE_TOKENS` / `ADMIN_MENU_TOKENS` | 不变（路由与菜单项保留，追溯保留） |
| `test_detail_modal_present` | 不变（详情弹窗保留） |

## 验证与验收

- 根仓库门禁：`pytest tests -q` 全绿、`ruff check src tests` 无错误。
- 8900 实测：`/config/database` 三分支（未配置/成功/失败）返回正确 reachable 与 reason；llm-status 不受影响。
- 8903 静态验证：curl 逐项确认新 token（领域树/图表/横幅/空态）。
- 独立性：8901/8902 离线时横幅仍可显示（LLM 来自 8900 自身探测），三空态模块不报错。

## 回滚

- 后端：`/config/database` 字段扩展向后兼容（新增字段非破坏）；回滚 = 移除 reachable/reason 字段与 pymysql 依赖。
- 前端：静态页无构建，回滚 = git revert web/ 三文件。
- 领域映射为前端常量，替换为 catalog 字段时仅改 app.js。

## 关闭与归档

- 门禁全绿 + 用户浏览器验收后关闭：REQ-006 证据更新，本计划转 Completed，归档至 `history/plans/2026-08/`。
