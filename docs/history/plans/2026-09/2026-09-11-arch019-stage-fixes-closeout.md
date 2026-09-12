# 领域探索阶段修正与第二轮主线收尾（arch019-stage-fixes-closeout）

状态：Achieved
任务类型：B
最后更新：2026-09-11
关联 ADR：[ADR 0007](../../adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）
关联设计：[downloads-flow.md](../../../design/downloads-flow.md)、[downloads-ui.md](../../../design/downloads-ui.md)、[api-contracts.md](../../../architecture/api-contracts.md)
关联 Tracker：docs/trackers/todo.md（PLAN-041、ARCH-019、ARCH-002、REQ-035、REQ-068、REQ-068-PLAN）
归档判定：Merge（阶段口径并入 downloads-flow.md；计划壳 Retain 归档 `../history/plans/2026-09/`）

> 本计划修正 ARCH-019 浏览器验收发现的 2 处领域探索阶段缺陷，并在门禁全绿后收尾
> 第二轮主线（ARCH-019）及其下属全部计划。用户裁决（2026-09-11）：`未开始` 与 `已生成`
> **不启用「添加课程」**（其余操作可用）；跨项目请求（REQ-075~079）按「已确认完成」关闭；
> REQ-035 随本轮关闭；浏览器人工验收以门禁绿 + 用户已验收为准。

## 目标与成功标准

1. **`已生成` 可探索**：领域右键菜单「探索领域知识」在 `已生成` 可用（后端契约本已放行）。
2. **手工添加领域为 `未开始`**：离线降级 `create_domain` 不再误写 `已生成`；`未开始` 卡片显示
   「开始探索」且链路到 `POST /domains/{id}/explore-knowledge`；该阶段除「添加课程」外操作可用。
3. **导入冲突修复**：「已导入」路径不再触发 `courses/import` 409（去掉 `commit-import` 调用，
   由 `confirm-domain` 写 `courses.json` 并置 `待确认`，后续「课程知识确认」收口）。
4. **收尾**：ARCH-019 / ARCH-002 及 PLAN-022/037/038/039/040、REQ-068-PLAN 关闭归档；
   REQ-035 关闭；REQ-075~079 关闭；设计/状态文档同步。
5. 门禁全绿：后端 `pytest tests -q` + `ruff`、前端 `vitest` + `tsc` + `build`、`tests/contract`。

## 根因

| # | 现象 | 根因 |
| --- | --- | --- |
| 1a | `已生成` 不能探索 | 前端菜单 `DownloadsTree.tsx` `exploreEnabled` 漏 `已生成`（后端 `domain_explore.py` 仅拦「探索中」，`api-contracts.md` 契约已含 `已生成`） |
| 1b | 添加领域后为 `已生成` | 离线降级 `TrackerClient.create_domain` 误传 `STAGE_GENERATED`（在线 8901 默认 `未开始`；`shared_tables.create_domain` 默认 `未开始`） |
| 2 | 导入后 409 `状态冲突` | `DomainConfirmModal`「已导入」路径先 `confirm-domain`（8901 置 `待确认`）再 `commit-import`→8901 `courses/import`，守卫只收 `已生成/探索中` |

## 范围与非目标

- **范围**：`web-ui/src/components/DownloadsTree.tsx`、`DomainConfirmModal.tsx` 及其测试；
  `backend/qed_engine/clients/tracker_client.py` 及 `tests/test_tracker_client.py`；
  文档 `downloads-flow.md`、`downloads-ui.md`、`api-contracts.md`；台账与状态文档收尾。
- **非目标**：8901/QED-Tracker 代码；`GET /courses/{domain_id}` 透传（REQ-068 ③ 保留）；
  `explore_pending.kind` 中 `import_courses` 死分支清理（另行）；Axiom 解析链。

## 前置条件

- 8900/8901 可启动；ARCH-019 三门课闭环与浏览器验收已由用户确认（2026-09-11）。
- 8901 `POST /domains/{id}/confirm` 在 domains.json 含 courses 时写 courses.json 并置 `待确认`。

## 工作项

### W1 前端阶段门禁（DownloadsTree.tsx）

- `exploreEnabled = ['未开始','已生成','待确认','失败'].includes(stage)`。
- 「添加课程」维持 `未开始`/`已生成` 禁用（用户裁决），其余操作不变。

### W2 导入冲突修复（DomainConfirmModal.tsx）

- 「已导入」分支仅 `await confirmDomainInfo(domain.domain_id, nameOverride)`；删除 `commitImport`
  调用与其导入。`courses.json` 由 8901 `confirm` 生成、`待确认` 就位；课程行与 `已完成` 由
  后续 `confirm-knowledge` 桥接收口。
- 保留 `api/tracker.ts` `commitImport` 与 8900 `/domains/{id}/commit-import` 端点（契约不删）。

### W3 后端离线默认（tracker_client.py）

- `create_domain` 离线降级 `exploration_stage=STAGE_GENERATED` → `STAGE_NOT_STARTED`。

### W4 测试（先红后绿）

- `DownloadsTree.state.test.tsx`：`已生成` 断言「探索领域知识」可用；头注释口径更新。
- `DomainConfirmModal.test.tsx`：新增「已导入」提交断言——调用 `confirm-domain`、**不调用**
  `commit-import`（mock `../api/tracker` 与 `../api/explore-helpers`）。
- `tests/test_tracker_client.py`：离线 `create_domain` 落 `未开始`。

### W5 设计文档同步

- `downloads-flow.md`：§2.1/§2.3 `已生成` 加入「探索领域知识」起始状态；`未开始` 口径；
  §4.5 书籍状态机对齐标记完成。
- `downloads-ui.md`：右树领域菜单门禁口径（`已生成` 可探索、`未开始`/`已生成` 不可添加课程）。
- `api-contracts.md`：`commit-import` 标注「UI 不再调用，保留契约」。

### W6 收尾归档

- PLAN-022/037/038/039/040、REQ-068-PLAN → Achieved，归档 `history/plans/2026-09/`。
- REQ-068-PLAN：ISSUE-002 → Closed；新增 ISSUE-008（导入 409）→ Closed；全部 Closed。
- todo.md 移除关闭行；completed.md 新增 ARCH-019、ARCH-002、PLAN-022/037/038/039/040、
  REQ-068-PLAN、REQ-035、REQ-075~079。
- plans/index.md、history/index.md、project-status.md、roadmap.md 同步。

## 验证与验收

- 后端：`conda run -n QED_env python -m pytest tests -q` 全绿 + `ruff check backend tests` 干净。
- 前端：`cd web-ui && npm test` + `npx tsc --noEmit` + `npm run build` 全绿。
- 契约：`pytest tests/contract -q` 全绿。
- 人工验收：用户已验收（本轮豁免），以门禁绿为准。

## 回滚

- W1/W2/W3 可独立 revert；W6 文档改动由 Git 锚点恢复。

## 关闭与归档

- 关闭条件：成功标准 1~5 达成、门禁全绿。
- 归档动作：阶段口径并入 downloads-flow.md；计划壳 Retain 归档 `history/plans/2026-09/`；
  todo 行移除并在 plans/index.md 登记去处。
