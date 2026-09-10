# 文档下载管理界面共享表优化（REQ-067 综合计划补充）

状态：Completed
任务类型：B
关闭结果：Achieved
最后更新：2026-09-08
关联 ADR：[ADR 0007](../../adr/v0.1/0007-qed-engine-backend-gateway.md)（前端只连 8900，降级链路经此）
关联设计：[2026-08-27-download-ux-flow.md](../../../plans/2026-08-27-download-ux-flow.md)（PLAN-023）、[2026-08-29-req067-downloads-optimization.md](../2026-08/2026-08-29-req067-downloads-optimization.md)（PLAN-025）
关联 Tracker：docs/trackers/todo.md（本计划行 PLAN-028；REQ-067）
归档判定：实现完成后归档 history/plans/2026-09/（已执行 2026-09-08）

> **2026-09-08 关闭（Achieved）**：成功标准 8/8 达成，门禁全绿（pytest 353 + ruff clean + vitest 160 +
> build + 契约 52）；浏览器手动导入轮验收由用户清库后执行，发现问题以新 DEFECT/REQ 登记。

> 本文档是 REQ-067 的补充计划，聚焦共享表降级链路和确认流 UI。
> PLAN-025 承载布局/右键菜单/探索触发等前端展示层；本文档承接共享表 CRUD 降级、
> 领域信息确认流、导入降级和课程信息确认——均属 8900 后端数据层与前端确认流 UI。

---

## 目标与成功标准

### 核心目标

1. **共享表降级链路**：8901 离线时 8900 仍可直写共享表（`qed_domain` / `qed_course`），支持领域和课程的增删改查操作，覆盖整个前期探索工作所需的数据管理能力
2. **领域信息确认流**：新建领域后先确认信息（描述/范围/阶段/方向），确认后进入「已生成」状态，为后续探索或导入奠定基础
3. **导入降级**：8901 离线时 8900 直写共享表完成领域 JSON 导入，导入后领域置「已生成」；导入名称与原名不同时设 `explore_pending` 待用户确认
4. **课程信息确认流**：导入降级或 8901 生成课程后，用户确认课程体系（阶段/方向/介绍），确认后进入「已完成」

### 成功标准

- [x] `tracker_client` 8 个方法在 8901 离线时降级到 `shared_tables` 直写（`list_domains`、`create_domain`、`update_domain`、`delete_domain`、`import_domain`、`list_courses_system`、`update_course`、`set_course_stage`）
- [x] `import_domain_manual()` 函数实现 manual@v1 契约的降级直写：领域幂等 upsert + 课程按名称匹配建/更 + 领域置「已生成」（名称不同时设 `explore_pending` 待确认）
- [x] `effectiveStatus` 状态机正确拆分为 6 个状态（domain_confirm / course_confirm / pending / running / completed / reexplore + failed）
- [x] DomainConfirmModal：按钮文案「保存并确认」，提交后 `exploration_stage = '已生成'`
- [x] CourseConfirmModal：领域名只读、描述可编辑、课程表可编辑，提交后 `exploration_stage = '已完成'` + 仅 PATCH 有修改的课程
- [x] 前端 3 个新测试覆盖确认流状态机各分支
- [x] 后端 2 个新测试覆盖导入降级路径

---

## 范围与非目标

### 范围

- 8900 后端：`shared_tables.py` 降级 CRUD（import_domain_manual / update_domain / update_course / set_domain_stage / set_course_stage 等）
- 8900 后端：`tracker_client.py` 8 个方法的降级分支
- 8900 后端：`api/tracker.py` PATCH `/domains/{domain_id}` 路由（含 exploration_stage / scope / level / classic_tracks 字段）
- 前端：`DomainInfoCard` effectiveStatus 状态机（6 态）+ 按钮行为
- 前端：`DomainConfirmModal`（保存并确认 → 已生成）
- 前端：`CourseConfirmModal`（保存并确认 → 已完成）
- 前端：`Downloads.tsx` 确认流挂载与状态管理

### 非目标

- 8901 侧探索引擎实现（由 QED-Tracker 承接）
- 领域探索的实际执行（前端触发 → 8900 透传 → 8901 异步任务，降级模式下不可用）
- 前端布局优化/右键菜单/探索触发等（由 PLAN-025 承接）
- 数据库 schema 变更（`qed_course` UNIQUE 约束和 nullable 字段变更由 QED-Tracker 数据库迁移实现，根仓库只记录事实）

---

## 前置条件

- 前置计划：[PLAN-025](../2026-08/2026-08-29-req067-downloads-optimization.md)（REQ-067 主文档，§A 已完成/§B 待开发分层）
- 架构约束：[ADR 0007](../../adr/v0.1/0007-qed-engine-backend-gateway.md)（前端只连 8900，8901 离线时降级链路经 8900 共享表）
- 数据库前置：`qed_course` 表 `UNIQUE(domain_id, name)` 约索引存在（降级 import_domain_manual 按课程名幂等 upsert 的基础）
- 开发环境：见 [本地开发环境](../../../standards/local-dev.md)

---

## 工作项

### B9  共享表降级链路（8900 直写）

**目标**：8901 离线时 8900 仍可操作领域和课程数据，覆盖前期探索所需的全部数据管理操作。

**覆盖操作**：

| 操作 | tracker_client 方法 | shared_tables 函数 | 降级行为 |
|------|---------------------|-------------------|---------|
| 添加领域 | `create_domain()` | `create_domain()` | 8901 失败 → 直写 `qed_domain`，生成 domain_id |
| 修改领域 | `update_domain()` | `update_domain()` | 8901 失败 → 直写 `qed_domain`，支持 description/stages/scope/level/classic_tracks/exploration_stage |
| 删除领域 | `delete_domain()` | `delete_domain()` | 8901 失败 → 直写 `qed_domain`（有课程时返回失败） |
| 导入领域知识 | `import_domain()` | `import_domain_manual()` | 8901 失败 → 领域幂等 upsert + 课程按名称匹配建/更 + 领域置「已生成」（名称不同时设 `explore_pending` 待确认） |
| 查询领域列表 | `list_domains()` | `list_domains_with_courses()` | 8901 失败 → 直读 `qed_domain` + 嵌套 `qed_course` |
| 新增课程 | `create_course()`（8901） | `create_course()` | 8901 失败 → 直写 `qed_course` |
| 修改课程 | `update_course()` | `update_course()` | 8901 失败 → 直写 `qed_course`，支持 stage/track/description/sort_order/aliases/prerequisites |
| 删除课程 | `delete_course()`（8901） | `delete_course()` | 8901 失败 → 直写 `qed_course` |
| 设置领域探索阶段 | `set_domain_stage()` | `direct_write_stage("qed_domain")` | 8901 失败 → 直写 exploration_stage |
| 设置课程探索阶段 | `set_course_stage()` | `direct_write_stage("qed_course")` | 8901 失败 → 直写 exploration_stage |

**降级判定逻辑**：`tracker_client` 方法 catch `TrackerError` → 检查 `self._settings` 是否存在 → 存在则降级到 `shared_tables` 对应函数 → 返回 `None` 转 503。

**关键决策**：降级模式下除实际领域探索和课程探索外，用户可完成整个前期探索工作——添加领域、导入领域知识、修改领域、新增课程、修改课程、删除课程、设置探索阶段，均可通过 8900 降级链路完成。

**B9 补充——降级创建领域状态补回**：
- 触发条件：8901 离线，通过 `create_domain` 降级路径创建领域
- 行为：创建成功后直接将 `exploration_stage` 设为「已生成」（`STAGE_GENERATED`）
- 原因：8901 在线时会从未开始→已生成（由 8901 管线驱动），降级时需补回此步骤
- 实现位置：`shared_tables.py` `create_domain()` 函数，INSERT 成功后 UPDATE exploration_stage

**实现证据**：
- `backend/qed_engine/clients/tracker_client.py`：8 个方法含降级分支（line 351-600）
- `backend/qed_engine/services/shared_tables.py`：`import_domain_manual()`（line 661-766）、`update_domain()`、`update_course()`、`create_course()`、`delete_course()` 等
- `backend/qed_engine/api/tracker.py`：`DomainUpdateBody` 含 exploration_stage/scope/level/classic_tracks（line 143-149）

---

### B10  领域信息确认流（保存并确认 → 已生成）

**目标**：新建领域后先确认信息，确认后进入「已生成」状态。

**状态机**：`effectiveStatus = 'domain_confirm'`——`exploration_stage ∈ {未开始, '', null}` 且 `courses.length === 0`。

**关键决策**：
- `domain_confirm` 只在 **未开始+无课程** 时触发——新建领域初始状态即命中
- 8901 在线时：确认信息后可探索，探索完成后自动流转到其他状态
- 8901 离线时：确认信息后可右键导入，导入后领域置「已生成」（名称不同时进入名称确认），进入课程信息确认
- 不自动进"探索中"——信息确认是用户操作，"探索中"是异步任务态须由 `exploreDomain()` 触发

**UI**：
- 按钮文案：`领域信息确认`（type=primary）
- Modal 标题：`领域信息确认 · {domain.name}`
- 按钮文案（Modal 内）：`保存并确认`（type=primary）
- 表单字段：领域名称（只读）、描述（必填）、探索范围、学习阶段（逗号分隔）、课程方向（逗号分隔）
- Hint 文本：`保存并确认后，领域将进入「已生成」阶段：无课程时可探索（8901 在线）或右键导入；已有课程时进入课程信息确认。`

**提交逻辑**：`updateDomain(domain_id, { description, scope, stages, classic_tracks, exploration_stage: '已生成' })`

**实现证据**：
- `web-ui/src/components/DomainConfirmModal.tsx`（全文）
- `web-ui/src/pages/Downloads.tsx`：effectiveStatus 计算（line 654-672）、按钮渲染（line 713-717）、confirmDomain 状态（line 989）

---

### B11  导入降级（import_domain_manual → 已生成 + 名称确认）

**目标**：8901 离线时 8900 直写共享表完成领域 JSON 导入，导入后领域置「已生成」；导入名称与原名不同时设 `explore_pending` 待用户确认。

**流程**：
1. 用户右键领域 → 导入领域知识 → 选择 JSON 文件
2. 前端校验（JSON.parse + name/courses 字段存在）→ 调 `POST /domains/import`
3. 8900 `tracker_client.import_domain()` 尝试 8901 → 失败 → 降级调 `import_domain_manual()`
4. `import_domain_manual()`：校验 manual@v1 必需字段 → 领域幂等 upsert（INSERT ON DUPLICATE KEY UPDATE）→ 课程按名称匹配建/更 → 领域置「已生成」
5. **名称确认**：若导入 `name` 与已有领域 `name` 不同，设 `explore_pending = {kind: 'name_confirm', name_check: {suggested_name, valid: true, reason: '导入领域知识提供了新名称'}}`
6. 返回 `{domain_id, courses_created, courses_updated}`（与 8901 契约同形）
7. 前端 `fetchAll()` 刷新 → 名称不同时显示「领域名称需要确认」Alert（原名 vs 新名），用户选择「采纳建议」或「保留原名」；名称相同时直接显示「课程信息确认」按钮

**错误处理**：
- 必需字段缺失（domain/name/description/stages/courses）→ `ValueError` → 400
- `QED_DB_PASSWORD` 未配置 → 返回 `None` → 503
- 共享库不可达 → 返回 `None` → 503

**实现证据**：
- `backend/qed_engine/services/shared_tables.py`：`import_domain_manual()`（line 661-766）
- `backend/qed_engine/clients/tracker_client.py`：`import_domain()` 降级分支（line 450-474）
- `web-ui/src/pages/Downloads.tsx`：`pendingConfirm` UI（line 692-754）复用现有名称确认 Alert
- `tests/test_api.py`：2 个导入降级测试（line 1490-1555）

---

### B12  课程信息确认流（保存并确认 → 已完成）

**目标**：导入降级或 8901 生成课程后，用户确认课程体系，确认后进入「已完成」。

**状态机**：`effectiveStatus = 'course_confirm'`——两种触发路径：
1. `exploration_stage === '已生成'` + `courses.length > 0` + `explore_pending?.kind !== 'name_confirm'`（导入降级或 8901 生成课程待确认）
2. `exploration_stage === '已生成'` + `courses.length > 0` + `explore_pending?.kind !== 'review_results'`（8901 生成课程待确认）

**UI**：
- 按钮文案：`课程信息确认`（type=primary）
- Modal 标题：`课程信息确认 · {domain.name}`
- 按钮文案（Modal 内）：`保存并确认`（type=primary）
- 领域名称：只读（`<Text strong>`）
- 领域描述：可编辑（`<TextArea>`，controlled state）
- 课程表：Table，列——课程名（只读）、所属阶段（Input）、学术方向（Input）、课程介绍（Input）
- Hint 文本：`确认后，课程体系进入「已完成」阶段，可进行教程发现与下载。`

**提交逻辑**：
1. `updateDomain(domain_id, { description, exploration_stage: '已完成' })` — 课程体系确认完毕
2. 逐门 PATCH 有修改的课程（`changedCourses` 基于 stage/track/description 三字段与初始值 diff）
3. 无修改则不调 `updateCourse`

**实现证据**：
- `web-ui/src/components/CourseConfirmModal.tsx`（全文）
- `web-ui/src/pages/Downloads.tsx`：confirmCourse 状态（line 990）、CourseConfirmModal 挂载（line 1042-1047）、onConfirmCourse 传递（line 915, 926）
- `web-ui/src/api/tracker.ts`：`updateDomain()`（line 68-70）、`updateCourse()`（line 137）

---

### B13  DEFECT-001 修复（service_manager 模块属性访问）

**目标**：修复 `test_services_restart_externally_running_script_unit` 环境依赖失败。

**根因**：`control.py` 中 `_probe_http` / `_start` / `_stop` 等函数通过 `from ... import _probe_http` 绑定静态引用，测试 monkeypatch `sm._probe_http`（模块属性），路由内实际调用原函数绕过 patch → 409。

**修复**：`control.py` 改为 `from qed_engine.services import service_manager as sm` + 所有成员访问改为 `sm._probe_http` / `sm._start` / `sm._stop` 等（模块属性访问，monkeypatch 生效）。

**实现证据**：
- `backend/qed_engine/api/control.py`：service_manager 成员访问改为 `sm.` 前缀
- `tests/contract/test_tracker_governance.py`：`_table()` 支持 `####` 子分节（line 29-31）
- `tests/contract/test_cross_project_collaboration.py`：`_todo_rows()` 同上

---

## 验证与验收

### 已完成项（已验证）

**后端**：
- [x] `pytest tests/ -q`：**353 passed**（含 2 个导入降级新测试，TDD 先红后绿）
- [x] `ruff check`：All checks passed
- [x] 契约测试：**52 passed**（含 12 个此前失败的测试全部转绿）

**前端**：
- [x] `npm test`（vitest）：**160 passed**（21 文件，含 3 个新确认流测试）
- [x] `npm run build`：成功（chunk 大小警告为既有，非错误）

**确认流状态机**：
- [x] 未开始+无课程 → 「领域信息确认」按钮 → 保存并确认 → PATCH exploration_stage=已生成
- [x] 待确认/已生成+有课程 → 「课程信息确认」按钮 → 保存并确认 → PATCH exploration_stage=已完成 + 仅修改课程 PATCH
- [x] 已生成+无课程 + 8901 离线 → 「探索领域知识」按钮置灰

### 待验收

- [ ] 浏览器验收：创建「计算机」领域 → 领域信息确认（保存并确认）→ 已生成 → 探索按钮（降级置灰）→ 右键导入 JSON → 已生成（名称不同时显示名称确认）→ 课程信息确认 → 已完成
- [ ] 降级模式下添加/修改/删除领域和课程的完整操作流程
- [ ] 导入领域知识名称确认流程：导入名称与原名不同时 → 显示「领域名称需要确认」Alert → 采纳建议/保留原名

---

## 回滚

- §B9-B12 改动为 8900 后端降级分支 + 前端确认流 UI，可按 Task 粒度 `git revert`
- 共享表降级不影响 8901 在线路径（降级分支仅在 catch TrackerError 时触发）
- DomainConfirmModal / CourseConfirmModal 为独立组件，可单独移除

---

## 关闭与归档

- 关闭条件：§B9-B12 验收 checklist 全部通过 + 用户浏览器验收确认 + 门禁全绿
- 归档判定：Merge 倾向——确认流 UI 并入 `docs/design/downloads-manage-redesign.md`，计划壳归档 `docs/history/plans/2026-09/`，todo.md PLAN-028 行关闭归档

---

## 实施记录

### 批次 1（2026-09-02 前半）：共享表降级 + 基础路由

- `shared_tables.py`：新增 `import_domain_manual()`（manual@v1 契约降级直写）
- `tracker_client.py`：8 个方法降级分支 + `import_domain()` 降级逻辑
- `api/tracker.py`：`DomainUpdateBody` 扩展 exploration_stage/scope/level/classic_tracks
- `Downloads.tsx`：effectiveStatus 6 态 + DomainInfoCard 按钮
- 测试：后端 2 个导入降级测试 + 前端 3 个确认流测试

### 批次 2（2026-09-02 前半）：DEFECT-001 + 契约修复

- `control.py`：service_manager 成员访问改为 `sm.` 前缀
- `test_tracker_governance.py`：`_table()` 支持 `####` 子分节
- `test_cross_project_collaboration.py`：`_todo_rows()` 同上
- `task-lifecycle.md`、`testing.md`：确认状态→暂定
- 24 处失效链接修复 + 4 个计划外计划文档删除
- todo.md：4 条镜像行 + REQ-032 纯链接化 + PLAN-022/023 纯链接化

### 批次 3（2026-09-02 后半）：确认流 UI + 门禁收尾

- `DomainConfirmModal.tsx`：按钮文案改为「保存并确认」+ hint 文本
- `CourseConfirmModal.tsx`：新组件（领域名只读/描述可编辑/课程表可编辑/保存并确认）
- `Downloads.tsx`：confirmCourse 状态 + CourseConfirmModal 挂载
- `Downloads.test.tsx`：3 个新测试覆盖确认流状态机
- `tracker_client.py`：F821 修复（TYPE_CHECKING 导入 Settings）
- `shared_tables.py`：B905 zip strict=False + UP017 datetime.UTC
- `control.py`：I001 import 排序

### 最终门禁（2026-09-02 收尾）

| 门禁 | 结果 |
|------|------|
| pytest 全量 | **353 passed** |
| ruff | All checks passed |
| vitest | **160 passed**（21 文件） |
| npm run build | 成功 |
| 契约测试 | **52 passed** |
