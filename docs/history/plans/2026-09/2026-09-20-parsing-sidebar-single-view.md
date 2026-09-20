# 解析界面单屏回调轮（parsing-sidebar-single-view）

状态：Closed（2026-09-20 关闭归档）
任务类型：B
（任务类型注记：B 确定性实现——用户 2026-09-20 裁决明确：D 轮「列表态⇄工作台态」两级视图
不符合预期，回到「左树+右对照」一屏；树纯选择；顶部筛选栏与模型选择全部去除；无实验决策内容）
最后更新：2026-09-20
关联 ADR：[ADR 0007](../../../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、[ADR 0014](../../../adr/0014-parsing-ownership-and-model-boundary.md)（解析管线归 Axiom-Flow）
关联设计：[design/parsing-ui.md](../../../design/parsing-ui.md)（本轮裁决已并入正文 §1/§2/§3/§4/§6/§7/§12/§13/§14）
关联 Tracker：ARCH-020-G（本计划镜像行）、ARCH-020-WB（前轮，其列表态设计被本轮取代）、ARCH-020-D（实现承接），镜像见 [docs/trackers/todo.md](../../../trackers/todo.md)
归档判定：Retain（设计裁决已并入 parsing-ui.md；G 轮实现完成并经用户浏览器确认后计划壳归档）

## 背景与用户裁决（2026-09-20，同日回调）

D 轮实现的「书目列表态 ⇄ 对照工作台态」两级视图经用户浏览器复核**不符合预期**。裁决：

1. **回到「左侧书目树 + 右侧对照」一屏完成**（同展示轮布局骨架）；
2. **树只做选择**：领域→课程→书三级，无状态徽标、无筛选行、无搜索框；
3. **顶部筛选栏全部去除**；**模型（engine）选择去除**（固定服务端默认引擎）；
4. **保留** D 轮对照能力：bbox 双向联动、块编辑弹层+判定、流式/版式、连续滚动、
   解析本页/全本/ingest + 进度、URL `?book&page` 恢复；
5. 书目列表态（BookList/BookTable + Table + 筛选那套）**完全去掉**；
6. 执行方式：**一次变动一部分，用户审核确认后再变下一部分**（R1 文档 → R2 骨架 →
   R3 顶栏精简 → R4 清理+实测）。

## 目标与成功标准

`#/admin/parsing` 恢复单屏「左树（lg=5）+ 右对照（lg=19）」，树纯选择、顶栏无返回/无模型
下拉、无列表态代码残留；对照功能零回归（联动/编辑/滚动/解析/进度/恢复全绿）。成功标准
= parsing-ui.md §13 验收 1~8 + 用户浏览器确认。

## 范围与非目标

- 范围：前端（Parsing.tsx / 新 BookTree.tsx / ParseToolbar.tsx / store / 测试）+ 设计文档
  （已并入 parsing-ui.md）；组件文件删除（BookList/BookTable，删除前列清单征得用户同意）。
- 非目标：后端契约零改动（ingest、/edit、parse-jobs 沿用）；不引入新契约；
  不改 CompareView/PageImagePane/BlockList/BlockEditor 的既有能力。

## 前置条件

- D 轮实现与浏览器实测已完成（parsing-workbench-redesign 计划壳 D 行）；
- `/parsing/tree`、`GET /books`、`POST /parse-jobs {pages}`、ingest/`/edit` 门面在位
  （8900 已重启加载）；无 API key/公网依赖。

## 工作项（分段执行，段间用户审核）

| # | 工作项 | 状态 |
| --- | --- | --- |
| R1 | 文档轮：parsing-ui.md 改单屏（§1 演进/§2 布局/§3 组件树/§4 状态模型/§5 契约注/§6 树/§7 顶栏/§10 降级/§11 视觉/§12 差异/§13 验收/§14 增强）+ 本壳 + todo 镜像行 + plans/index 登记 + 契约门禁 | 完成（2026-09-20，用户已审核） |
| R2 | 布局骨架：新建 `BookTree.tsx`（旧内联树迁移，纯选择）、`Parsing.tsx` 重写为单屏、store 去 view/filters/backToList、BookList/BookTable 摘除引用；tsc+vitest+build → **用户审核** | 代码+门禁+浏览器冒烟完成（2026-09-20，tsc 零错/vitest 192 全绿/build 成功；单屏落地、点树进对照、§8 404 分流、hash 恢复、bbox 双向联动、←/→ 翻页、请求全走 8900），待用户审核 |
| R3 | 顶栏精简：ParseToolbar 去「返回列表」与 engine Select；保留页码导航/滚动模式/同步/缩放/编辑开关/统计/解析按钮+进度/书页入库；测试同步 → **用户审核** | 代码+门禁完成（与 R2 同批实施与验证，待用户审核） |
| R4 | 清理与实测：git rm BookList/BookTable（清单确认）、测试全量适配、全套门禁、`qed-frontend-check` 浏览器实测 §13 1~8 → **用户审核** | 代码+门禁+实测完成（2026-09-20，详见下节），待用户审核 |
| R5 | 收尾：todo/project-status 收口、本壳与 WB 壳关闭归档（qed-closeout） | 完成（2026-09-20：G/WB/UI 三壳归档 history/plans/2026-09/，todo 四行（D/WB/G/UI）关闭迁 completed.md，project-status/parsing-ui/index 链接同步；全量门禁 498 + 契约 63 + ruff 全绿；未 git 提交，待用户指令） |

## R2/R3 审核附带增量（2026-09-20，用户三点裁决，已实施）

1. **界面文案全中文**：「ingest」→「书页入库」（含 tooltip：PDF 逐页转书页图并登记页数，
   解析前置步骤）；错误提示与 iframe 引导文案同步（ParseToolbar / store / CompareView / 测试）；
2. **移除「对照｜仅原文｜仅解析」视图模式切换**：恒为对照，未解析页由 §8 态分流只显示书页图；
   store `viewMode`/`setViewMode`/`ViewMode` 整体删除（ParseToolbar/CompareView/Parsing/测试同步）；
3. **对照框不对齐定级=解析侧缺陷**：取证（p7 `image_size=[1241,1755]` 与 PNG 实际像素一致、
   前端仅按自然尺寸 1:1 百分比定位；数据侧全部块 x1=1241、底部块 y1=1755 钳位、页码块 1×1）
   → 展示侧无改动，登记 **REQ-081 请求：Axiom-Flow**（bbox 坐标换算缺陷，嫌疑路径
   `normalize/blocks.py scale_bbox` / `engines/mineru.py page_size 配对`），待对方回执。

门禁：tsc 零错 · vitest 192 全绿 · build 成功 · 契约 63 全绿（REQ-081 行与 G 行补记）。

## R4 清理与实测（2026-09-20，完成，待用户审核）

- **组件退役**：`BookList.tsx` / `BookTable.tsx` 经用户确认删除（AskUserQuestion「确认删除」），
  删除前备份至 `%LOCALAPPDATA%/Temp/qed-backups/2026-09-20-arch020g-r4/parsing/`；
  两文件均为未跟踪新文件（D 轮产物），git 历史无锚点，备份即唯一回滚源。
- **store 过渡态剥离**：`BookStatusFilter`/`BookFilters`/`deriveBookStatus`/`filterBooks`/
  `bookFilters`/`setBookFilters` 及头部注释行全部删除；全库 Grep 零残余引用。
- **门禁**：tsc 零错 · vitest 192 全绿 · build 成功 · 契约 63 全绿。
- **§13 浏览器实测**（browser-use，8903）：1 单屏布局（左树纯选择+右对照）✅ ·
  2 点树进对照+hash 恢复 ✅ · 4 bbox 双向联动（内联样式取证：块蓝底/bbox 粗边框对称命中）✅ ·
  5 书页入库按钮中文文案+tooltip ✅ · 6 未 ingest iframe 直显+引导文案 ✅ ·
  7 连续滚动窗口+同步 ✅ · 网络请求 100% 指向 8900、控制台仅预期 404 ✅；
  3 真实解析任务未实发（避免在 REQ-080 版本隔离前覆盖现产物，任务流已在前轮 E2E 实证）；
  8 模型离线降级以 503 单测覆盖声明。**未做截图级视觉验证**（视口隐藏，无法截图）。

## R4 审核附带修正（2026-09-20，用户复审裁决，已实施）

用户复审追问「单一刷新按钮」裁决是否落全。审计结论：**设计文档无缺漏**
（parsing-ui.md §1/§2/§5/§6/§13 五处均已写「刷新」含同步书目），**实现违反设计**：

1. `Parsing.tsx` 顶部标题行曾并列「同步书目」+「刷新」两按钮（R2 重写时沿用旧形态）——
   已删除「同步书目」按钮，仅留单一「刷新」（`fetchBooks(true)` 同步→重拉书目 → `fetchTree()`，
   loading 合入 `syncing`；tooltip 说明含同步语义）；
2. 设计文档界面术语清扫：5 处指向按钮/引导文案的「ingest」统一为「书页入库」
   （§3 组件表 / §5 openWorkbench / §8 态分流 / §12 差异表 / §13 验收项 7；
   端点与状态字段 `ingest_*` 保留英文），登记 [design-bugfix-log](../../../plans/design-bugfix-log.md)。

门禁：tsc 零错 · vitest 192 全绿（含单按钮回归断言）· build 成功 · 契约 63 全绿；
浏览器实测：顶栏仅「刷新」单按钮（「同步书目」消失），点击后
`POST /books/sync → GET /books → GET /parsing/tree` 全 200、仅指向 8900、控制台零报错。

## 验证与验收

- 每段：`cd web-ui && npx tsc -b` 零错 + `npx vitest run` 全绿 + `npm run build` 成功；
  文档轮：`pytest tests/contract -q` 全绿。
- R4：浏览器实测（点树进对照、hash 恢复、解析按钮+进度、bbox 联动、判定落库回显、
  连续滚动、未 ingest iframe、降级横幅）。

## 回滚

- 前端改动集中在 parsing 组件与 store；回滚 = 还原 `git checkout` 前 HEAD 版本并恢复
  BookList/BookTable 文件（删除发生在 R4 且经确认，删除前 HEAD 即回滚锚点）。

## 关闭与归档

- R5 完成、用户浏览器确认后本壳关闭（Retain：裁决已并入 parsing-ui.md）；
  ARCH-020-WB 壳随本轮一并重评（其两级视图设计已被取代，实现产物部分保留部分退役）。
