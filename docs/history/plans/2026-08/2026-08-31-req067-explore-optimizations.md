# REQ-067 领域探索优化（B9-B12）

状态：Draft
任务类型：B
最后更新：2026-08-31
关联 ADR：[ADR 0011](../../adr/v0.1/0011-pending-design-location.md)
关联设计：[2026-08-29-req067-downloads-optimization.md](../../../plans/2026-08-29-req067-downloads-optimization.md)
关联 Tracker：docs/trackers/todo.md（本计划行 REQ-067 §B 扩展）

> 本文档承接 REQ-067 §B，追加 4 项领域探索交互优化。§B 原有 B1-B8 不变。

---

## 优化点概览

| # | 标题 | 改动面 | 跨项目 |
|---|---|---|---|
| B9 | 已完成态禁用探索/导入菜单 | 前端 | 否 |
| B10 | 探索范围精确到单领域（修复多领域同时变探索中 bug） | 前端+8901 | 是 |
| B11 | 名称确认 UI 改为 DomainInfoCard 内展开 | 前端 | 否 |
| B12 | 探索完成不自动更新左树 +「查看结果」弹窗 | 前端+8901 | 是 |

---

## B9  已完成态禁用探索/导入菜单

**问题**：`exploration_stage === '已完成'` 时，右键菜单「领域探索（自动）」和「导入领域知识」仍可点击，逻辑上不应再探索。

**规范**：

| 菜单项 | disabled 条件 |
|---|---|
| 领域探索（自动） | `exploration_stage === '已完成'` |
| 导入领域知识 | `exploration_stage === '已完成'` |
| 新增课程 | 保持现有逻辑（需已完成或已生成） |
| 修改领域 | 始终可用 |
| 删除领域 | 保持现有逻辑（需无课程） |

**改动文件**：
- `web-ui/src/components/DownloadsTree.tsx`：`domainMenu` 函数（384-412 行）增加 disabled 条件

---

## B10  探索范围精确到单领域（修复 bug）

**问题**：点击一个领域探索后，多个领域同时变为「探索中」。

**根因排查**：代码链路分析确认每个环节都是单领域操作：
- 前端 `exploreDomain(d.domain_id)` → 8900 透传 → 8901 `POST /domains/{domain_id}/explore`
- 8901 `explore_domain` 端点（main.py:385-402）只操作指定 domain_id
- `run_domain_explore`（domain_explore.py:58-94）只处理单个 domain_id
- 轮询 `startPolling`（downloads.ts:347-384）是只读的，不触发写操作

**最可能根因**：数据库中存在「脏数据」——先前探索任务崩溃或后端重启后，`exploration_stage='探索中'` 残留未清理。轮询时 `listCourseSystem()` 返回全量领域，视觉上多个领域同时显示为「探索中」。

**修复方案**：

1. **前端增加脏状态检测**：轮询检测到 `exploration_stage='探索中'` 的领域时，如果该领域没有对应的进行中任务（可通过新增 `explore_started_at` 时间戳判断，超过阈值如 10 分钟视为脏），自动重置为 `'未开始'`
2. **8901 启动时清理**：`domain_explore.py` 增加启动清理逻辑——将所有 `'探索中'` 状态重置为 `'失败'`（有 explore_pending 错误信息提示"服务重启，探索中断"）
3. **8901 explore 端点增加幂等检查**：如果领域已经是 `'探索中'`，拒绝重复提交（当前已实现 409，但需要增加超时自动重置）

**改动文件**：
- `QED-Tracker/src/qed_tracker/application/domain_explore.py`：新增 `cleanup_stale_exploring()` 函数
- `QED-Tracker/src/qed_tracker/api/main.py`：app startup 事件中调用清理
- `web-ui/src/stores/downloads.ts`：轮询中增加脏状态检测（可选，作为双保险）

---

## B11  名称确认 UI 改为 DomainInfoCard 内展开

**问题**：当前名称确认用 `Alert` 内嵌两个小按钮（Downloads.tsx:703-718），交互不够明确。

**目标**：DomainInfoCard 按钮区根据状态切换显示，名称确认在卡片内展开。

**状态机变更**：

| effectiveStatus | 按钮区显示 | 展开区 |
|---|---|---|
| running | 「确认课程名称」按钮（仅 pending 时） / 「探索进行中…」置灰按钮 | — |
| pending + name_confirm | 「确认课程名称」按钮 | 内嵌确认区域（原名/建议名 + 采纳/保留/自定义） |
| pending + failed | — | 内嵌错误提示 + 重试按钮 |
| completed | 「查看结果」按钮（B12） | — |
| initial/reexplore | 「领域探索（自动）」/「重新探索」 | — |

**UI 形态**：

```
┌─────────────────────────────────────────────┐
│ 领域名  [3门课程] [基础] [主干]   [确认课程名称] │  ← pending 时显示此按钮
├─────────────────────────────────────────────┤
│ 领域名称需要确认                              │  ← 展开区域
│ 原名：数学 → 建议名：数学与应用数学            │
│ 原因：规范化学科命名                          │
│ [采纳建议] [保留原名] [自定义]                 │
└─────────────────────────────────────────────┘
```

**自定义名称交互**：
- 点击「自定义」→ 出现 Input 输入框 + 「确认」按钮
- 输入框预填原名，用户修改后点击确认 → `confirmDomainName(domainId, {decision: 'custom', name: customName})`

**改动文件**：
- `web-ui/src/pages/Downloads.tsx`：DomainInfoCard 组件（642-735 行）重构按钮区和展开区

---

## B12  探索完成不自动更新左树 +「查看结果」弹窗

**问题**：探索完成后轮询立即 `set({ domains: latest })` → 左树刷新 → 新课程直接出现。但用户还没确认这批课程是否合适。

**目标**：
1. 探索完成后不自动更新左树
2. 显示「查看结果」按钮
3. 弹窗展示课程详情（名称+描述），勾选哪些需要
4. 可修改领域描述 + 重新探索
5. 确认后才真正刷新左树

**8901 侧改动**：

新增 `exploration_stage = '待确认'` 状态（5态→6态）：

| exploration_stage | 含义 | explore_pending |
|---|---|---|
| 未开始 | 默认/新建领域 | null |
| 探索中 | 8901 后台任务运行中 | null |
| 已生成 | 名称需确认 | `{kind: 'name_confirm', name_check: {...}}` |
| **待确认** | **探索完成，等待用户审阅课程** | **`{kind: 'review_results', courses: [...], domain_report: {...}}`** |
| 已完成 | 用户确认应用 | null |
| 失败 | 探索异常 | `{kind: 'failed', error: '...'}` |

**状态流转**：
```
探索中 → 已生成（名称需确认）→ 探索中（确认后重跑）→ 待确认（用户审阅）
  待确认 → 已完成（用户确认应用）
  待确认 → 探索中（用户修改描述重新探索）
```

**8901 端点改动**：
- `domain_explore.py`：`run_domain_explore` 成功后不写 `'已完成'`，改为写 `'待确认'` + `explore_pending={kind: 'review_results', courses: [...], domain_report: {...}}`
- 新增 `POST /domains/{id}/apply-results`：用户确认后调用，将 `'待确认'` → `'已完成'`，清空 `explore_pending`
- 新增 `POST /domains/{id}/re-explore`：用户修改描述后重新探索（相当于调 explore 但保留已选课程）

**8900 侧改动**：
- `tracker_client.py`：新增 `apply_domain_results()` 和 `re_explore_domain()` 方法
- `api/tracker.py`：新增 2 个透传路由

**前端改动**：
- `api/tracker.ts`：新增 `applyDomainResults()` 和 `reExploreDomain()` 方法
- `stores/downloads.ts`：轮询检测到 `待确认` 时不更新左树，设置 `pendingReviewDomainId` 状态
- `pages/Downloads.tsx`：DomainInfoCard 在 `待确认` 时显示「查看结果」按钮
- 新增 `ExploreResultModal` 组件：
  - 展示探索产出的课程列表（名称+描述+阶段+方向）
  - 每行 Checkbox 可勾选/取消
  - 领域描述可编辑
  - 「确认应用」→ `applyDomainResults()` + `fetchAll()`
  - 「修改描述重新探索」→ 编辑描述 → `reExploreDomain()`

**改动文件**：
- `QED-Tracker/src/qed_tracker/application/domain_explore.py`：状态机改动
- `QED-Tracker/src/qed_tracker/api/main.py`：新增端点
- `QED-Tracker/src/qed_tracker/db/knowledge_repository.py`：explore_pending 写入
- `backend/qed_engine/clients/tracker_client.py`：新增方法
- `backend/qed_engine/api/tracker.py`：新增路由
- `web-ui/src/api/tracker.ts`：新增方法
- `web-ui/src/stores/downloads.ts`：轮询逻辑调整 + pendingReview 状态
- `web-ui/src/stores/index.ts`：DomainSystem.explore_pending 类型扩展
- `web-ui/src/pages/Downloads.tsx`：DomainInfoCard 改造 + 新增 ExploreResultModal
- `web-ui/src/pages/Downloads.test.tsx`：更新测试

---

## 文件改动清单

| 文件 | 改动类型 | 涉及优化 | 说明 |
|------|---------|---------|------|
| `web-ui/src/components/DownloadsTree.tsx` | 修改 | B9 | 菜单 disabled 条件 |
| `web-ui/src/pages/Downloads.tsx` | 修改 | B11, B12 | DomainInfoCard 重构 + 新增 ExploreResultModal |
| `web-ui/src/pages/Downloads.test.tsx` | 修改 | B11, B12 | 更新测试 |
| `web-ui/src/stores/downloads.ts` | 修改 | B10, B12 | 轮询脏状态检测 + pendingReview 逻辑 |
| `web-ui/src/stores/index.ts` | 修改 | B12 | explore_pending 类型扩展 |
| `web-ui/src/api/tracker.ts` | 修改 | B12 | 新增 apply/reExplore 方法 |
| `backend/qed_engine/clients/tracker_client.py` | 修改 | B12 | 新增透传方法 |
| `backend/qed_engine/api/tracker.py` | 修改 | B12 | 新增透传路由 |
| `QED-Tracker/src/qed_tracker/application/domain_explore.py` | 修改 | B10, B12 | 状态机改动 + 启动清理 |
| `QED-Tracker/src/qed_tracker/api/main.py` | 修改 | B12 | 新增端点 |
| `QED-Tracker/src/qed_tracker/db/knowledge_repository.py` | 修改 | B12 | explore_pending 扩展 |

---

## 跨项目协调

| # | 事项 | 优先级 | 说明 |
|---|---|---|---|
| X1 | 8901 新增 `待确认` 状态 | 高 | B12 前置 |
| X2 | 8901 新增 `POST /domains/{id}/apply-results` | 高 | B12 前置 |
| X3 | 8901 新增 `POST /domains/{id}/re-explore` | 中 | B12 需要 |
| X4 | 8901 启动清理脏 `exploration_stage` | 高 | B10 前置 |

---

## 验证与验收

- [ ] B9：已完成领域右键菜单，探索和导入置灰
- [ ] B10：点击一个领域探索，只有该领域变为探索中
- [ ] B10：后端重启后，脏探索状态被清理
- [ ] B11：名称确认时 DomainInfoCard 显示「确认课程名称」按钮
- [ ] B11：点击按钮展开确认区域，三个选项（采纳/保留/自定义）正常工作
- [ ] B12：探索完成后左树不自动刷新
- [ ] B12：DomainInfoCard 显示「查看结果」按钮
- [ ] B12：弹窗展示课程列表，可勾选/取消
- [ ] B12：可修改领域描述并重新探索
- [ ] B12：确认后左树刷新，只保留勾选的课程
- [ ] `npm test` 全绿
- [ ] `npm run build` 成功
- [ ] `npx tsc --noEmit` 零错

---

## 实施顺序

1. **B9**（前端，无依赖）— 30 分钟
2. **B10**（8901 启动清理 + 前端脏状态检测）— 1 小时
3. **B11**（前端 UI 重构）— 1 小时
4. **B12**（8901 状态机 + 前端弹窗）— 3-4 小时（含跨项目协调）

B9 和 B11 可并行开发（不涉及跨项目），B10 和 B12 需要先与 QED-Tracker 协调。
