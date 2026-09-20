# 解析界面工作台重设计轮（parsing-workbench-redesign）

状态：Closed（2026-09-20 关闭归档）
任务类型：B
（任务类型注记：B 确定性实现——用户 2026-09-20 四点裁决明确：「翻译」=解析还原可渲染文档、
列表数据源=数据库表（af_books）、单页改造、设计先行并入 ARCH-020-D 实现；无实验决策内容）
最后更新：2026-09-20
关联 ADR：[ADR 0007](../../../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、[ADR 0014](../../../adr/0014-parsing-ownership-and-model-boundary.md)（解析管线归 Axiom-Flow）
关联设计：[design/parsing-ui.md](../../../design/parsing-ui.md)（本轮设计裁决已并入其正文）、[architecture/api-contracts.md](../../../architecture/api-contracts.md) §④
关联 Tracker：ARCH-020-WB（本计划镜像行）、ARCH-020-D（实现承接）、ARCH-020-B（`POST /books/{id}/ingest` 透传升为高优先）、PLAN-044（parse-jobs `pages` 契约），镜像见 [docs/trackers/todo.md](../../../trackers/todo.md)
归档判定：Retain（设计裁决已并入 design/parsing-ui.md；D 轮实现完成后计划壳归档）

## 背景与用户裁决（2026-09-20）

用户提出解析管理界面重设计三点需求：①列表查看当前目录及已下载文件、点击进入文档；
②展开原文与「翻译文档」对比；③单页/全本翻译按钮、页码滚动、对照操作。

四点裁决（本轮问答确认）：

1. **「翻译」= 将 PDF 解析为可渲染出来的准确文档**（解析产物渲染，非 AI 翻译，无新链路）；
2. **列表数据源 = 数据库表数据**（af_books，经 8900 `GET /books`），不扫描 dataset 目录；
3. **单页改造**：保持 `#/admin/parsing` 一路由，页内「列表态 ⇄ 工作台态」两级视图切换；
4. **设计先行，并入 ARCH-020-D 轮实现**；设计裁决直接修订 parsing-ui.md。

链路事实（已核实，零新契约即可支撑核心交互）：

- `POST /parse-jobs {book_id, pages?, engine}`（`backend/qed_engine/api/axiom.py`）→
  单页解析 = `pages:[n]`，全本 = 省略 pages，失败页重解析 = `pages:[失败页列表]`；
- `GET /books` 透传 af_books 列表（ingest_status/parse_status/pages_done/page_count/file_path）；
- `BlockView.tsx` 已有 KaTeX（行内+块级）/表格/图片渲染——「准确渲染」地基在，D 轮升级版式布局；
- 缺口：8900 `POST /books/{id}/ingest` 透传未做（列表「ingest」按钮硬依赖 → ARCH-020-B 高优先）；
  8902 running jobs 列表端点未确认（未有前前端本地记录已提交 job_id 轮询）。

## 目标与成功标准

解析管理界面重设计定稿并入 `design/parsing-ui.md`：单页两级——**书目列表态**（数据库表
af_books 数据、点击进入文档）⇄ **对照工作台态**（原文 vs 解析还原文档双栏、单页/全本解析、
页码导航、单页/连续滚动、对照操作、bbox 双向联动），完整覆盖用户三点需求。成功标准即
「验证与验收」V1~V2 全绿 + 用户确认设计（实现归 ARCH-020-D，验收标准 §13）。

## 设计定稿要点（正文见 parsing-ui.md 对应节）

1. **单页两级**（§2）：列表态 L 默认落地，行点击进工作台态 C；URL hash 带 `?book&page` 可恢复。
2. **列表态**（§6）：顶部同步/刷新 + 进行中任务胶囊；领域/课程级联筛选（复用 `/parsing/tree`）+
   关键词 + 状态筛选；Table 列＝书名/归属/页数/ingest Tag/解析 Tag+进度/源文件/更新时间/操作
   （进入对照｜ingest｜全本解析）；左树布局退役为筛选器。
3. **工作台态**（§7/§8）：顶栏＝返回＋页码导航（输入跳页+上下页+键盘 ←/→）＋视图模式
   （对照/仅原文/仅解析）＋滚动模式（单页/连续）＋滚动同步＋缩放＋engine 选择＋解析本页/全本＋
   进度轮询＋审阅统计；主体＝A4 双栏（bbox overlay 双向联动 + 流式/版式两渲染模式）；
   连续滚动 = 页纵向流、双栏单元、预取 ±2 页 + 虚拟化。
4. **态分流**（§8）：原始文件优先不变，叠加解析动作引导（未解析→解析本页/全本；未 ingest→ingest）。
5. **增强清单**（§14）：任务中心抽屉、失败页可视化与重解析、批量 ingest/解析、质量信号展示、
   页内搜索（暂缓）、URL 可恢复（D 轮）。

## 范围与非目标

- 范围（本轮）：设计并入 parsing-ui.md、本计划壳、todo 范围注记（D 行/B 行）。
- 范围（D 轮实现承接）：8903 组件拆分与两级视图（见 parsing-ui.md §3/§12 checklist）。
- 非目标：AI 翻译链路（用户裁决不需要）；dataset 目录扫描端点；8902/8900 新契约
  （ingest 透传归 ARCH-020-B）；ARCH-020-UI 关闭（仍待用户浏览器确认）。

## 前置条件

- `GET /books` 列表透传与 `POST /parse-jobs {pages}` 已在位（2026-09-20 联调最小打通轮实证，
  `backend/qed_engine/api/axiom.py`）；
- BlockView KaTeX/表格渲染地基在位；展示轮 A4 纸面基准已落地（parsing-ui.md §2）；
- 无 API key / 公网 / 真实数据根依赖（本轮纯文档）。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| S1 | 设计裁决并入 `docs/design/parsing-ui.md`（§1 演进/§2 单页两级/§3 组件树/§4 状态模型/§6 列表态/§7 工作台顶栏/§8 对比区/§10 降级矩阵/§12 差异/§13 验收/§14 增强） | 完成（2026-09-20） |
| S2 | 计划壳 + plans/index.md 活跃计划登记 + todo（D 行补重设计范围、B 行标 ingest 透传高优先） | 完成（2026-09-20） |
| S3 | 契约门禁 `pytest tests/contract -q` 全绿（纯文档轮） | 完成（2026-09-20：契约 63 passed + 全量 494 passed） |
| D 轮 checklist | 组件拆分（BookTable/ParseToolbar/CompareView/PageImagePane/BlockList/BlockEditor/blocks.ts）、两级视图与 URL 恢复、bbox overlay 双向联动、连续滚动+页窗口预取、流式/版式渲染、/review→/edit 切换、任务轮询进度、store/api 按 §4/§5 改造；验收 tsc+vitest+build+浏览器 | **实施完成（2026-09-20）**：`components/parsing/` 八件套落地、`BlockView.tsx` 退役；8900 侧 ingest 透传 + `/edit` 门面提前自 B 轮实施（test_api.py 96→含新增 4 用例）。门禁：tsc 零错 / vitest 194 passed（Parsing 10 例）/ build 成功 / 后端全量 498 passed / 契约 63 passed / ruff clean。偏差：bbox 拖拽手柄与「重解析失败页」暂缓（parsing-ui.md §12 D 轮实施实况）。**浏览器实测完成（2026-09-20，真机 8903+8900+8902）**：列表→工作台→hash 恢复/刷新→连续滚动页窗→单页解析提交（202+轮询+终态自动刷新，真实产出第 7 页 7 块）→bbox overlay 双向联动（点页选块 / 选块高亮框）→版式模式弹编辑层→「一致」PUT /edit 真实落库回显（已判定 1/7）→失败任务错误提示呈现。实测驱动修补 2 处：①BlockList 版式分支缺编辑 Popover（补回归用例）；②挂载时 store→URL 清空与恢复竞态致 hash 丢失（params 入依赖自愈）。截图与指针级验证因 in-app 面板 viewport=0x0 不可用，以 DOM 结构断言 + 网络面板（全部指向 8900，ADR 0007 合规；console 零报错）替代，像素级视觉确认待用户浏览器复核 |

## 验证与验收

- V1 `tests/contract` 全绿（计划治理/文档元数据/镜像）。
- V2 设计自审：parsing-ui.md 修订后与用户三点需求逐项对照——列表（§6）、对比展开（§8）、
  单页/全本按钮+页码滚动+对照操作（§7/§8）均已覆盖。
- D 轮实现验收：`qed-frontend-check` 浏览器实测（列表点击进工作台、单页/全本解析提交与进度、
  页码导航与连续滚动、bbox 联动、ingest 引导）。

## 回滚

- 本轮纯文档：还原 parsing-ui.md、todo.md、plans/index.md 并删除本壳即可；不影响代码。

## 关闭与归档

- S1~S3 完成即设计部分收口；本壳随 ARCH-020-D 实现完成、浏览器验收后一并关闭归档
  （Retain：设计已并入 parsing-ui.md）。
