# 学习设计轮 M6·书籍目录知识点树与三栏学习工作台（toc-knowledge-tree-and-learn-workbench）

状态：Completed
任务类型：B
最后更新：2026-10-05
关联 ADR：无新增（两表结构改判沿用 M5 判例 D6＝不新立 ADR，以 `database-design.md` 登记成文为准；
立项与一任务一行一壳沿用 [ADR 0016](../../../adr/0016-todo-registration-one-task-one-plan.md)）
关联设计：[learning-star-map.md](../../../design/learning-star-map.md)（星图徽标与课程节点下钻的受影响消费面）、
[parsing-ui.md](../../../design/parsing-ui.md)（§9 双栏对照与 §9.1 版式重排＝中栏渲染组件复用源）、
[learning-workbench-ui.md](../../../design/learning-workbench-ui.md)（本壳 W6 晋升＝工作台设计态事实源）、
[frontend-architecture.md](../../../architecture/frontend-architecture.md)（8903 只连 8900）
关联 Tracker：docs/trackers/todo.md（ARCH-027-M6 任务行；主链与 M1~M5 见
[学习设计轮主链壳](../../../plans/2026-09-22-learning-design-mainline.md)）
归档判定：Retain（滚动记录，模块收口时按当时里程碑归档 history/plans/）

> 本壳是学习设计轮 **M6 模块**的唯一固定记录：把「书籍目录 → 章节（大知识点）→ 细知识点」做成
> 一张层级化的知识点主表，并在 8903 出一张三栏学习工作台（左选择 / 中排版正文 / 右批注登记）。
> 起因＝用户 2026-10-01 对 M1 学习面板形态的裁决（「继续 ARCH-027-M1 轮，其面板……」），评审结论＝
> 三栏里**中栏与右栏的现有设计可直接用**，左栏「章节目录」与「章节↔页↔知识点」绑定是缺口，
> 故知识点两表按「可删除重建」授权重设计。数据契约改动落本壳，界面实施与主链 M1 的关系见「与 M1 的分工」。

## 目标与成功标准

**目标**：一门课的书打开后，能按**书籍目录**逐章顺序读（正文按已解析产物的排版回原样），读的过程中
把该章的**细知识点**以批注形式写下来（总结 / 详解两类），由用户决定去留；「留」即进候选池，
再经一次人工确认提升到共享知识点主表。大知识点＝目录章节，与细知识点同表分层。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../../../trackers/todo.md)
`ARCH-027-M6` 行的「成功标准」列，本壳不复制判据条目；验证手段见「验证与验收」节，
执行进展与证据见「过程与证据」节。

## 裁决登记（2026-10-01，用户）

| # | 裁决 | 采纳形态 |
| --- | --- | --- |
| ① | 三栏落点＝**新建** `#/learn/c/{courseId}` 路由（不在 `#/admin/parsing` 加只读模式） | 路由参数取**共享课程 ID**（`qed_course.course_id`，与星图下钻同源）；`qed_learn_course`（learn 族课程注册）本轮不引入，理由见「待裁点 R7」 |
| ② | 章节树来源＝**目录页文本纯函数解析 + 人工确认** | 8903 侧纯函数 `tocParse.ts`（规格见「目录解析规格」），不引 LLM、不等主链 M-2 编译 |
| ③ | **授权契约增补**：章节↔页范围的绑定落库 | 承载位改判＝知识点主表 outline 行的 `source_ref`（原评估稿里的 `qed_learn_unit` syllabus `source_ref` 方案**作废**，learn_unit 保持编译溯源语义不动） |
| ④ | 中栏「该章节知识点」＝**前端过滤**，不新增查询参数 | 归属由 `parent_kp_id` 表达，页范围 `source_ref` 作校验兜底 |
| ⑤ | **本轮不出 LLM 生成**（先人写叙述，生成等 M3 真机冒烟） | 右栏批注＝人工书写 `narrative` + 选区锚点；`/llm/text` 一键生成另批，前置＝ARCH-027-M3 行 S4 真机冒烟 |
| ⑥ | **大知识点落 `qed_knowledge_point`**（覆盖本壳评审期推荐 R6「章节只落 learn 单元树」）；知识点主表与候选 detail 表**均可删除重建** | 两表 v2 结构自由重设计：无数据搬迁、不做 ALTER、`ensure_tables` 幂等重建（生产 `qed` 库 DDL 属 D 类转人工，随发布批次） |
| ⑦ | **文档先行** | 本壳承载设计稿；代码改动等用户明确「开始执行」 |

## 范围与非目标

**范围**：知识点两表 v2（层级化主表 + 候选池）、outline 读写端点、目录解析纯函数、8903 三栏工作台与
批注登记闭环、learn 域存储懒挂载前置、星图与课程知识点页的消费口径回归修正、设计晋升。

**非目标**：学习进度 / `covered` 勾选 / 掌握态（归主链 M-3；M5 口径维持「主表不存掌握态」，
本轮不破坏）；链路编译（主链 M-2）；出题与复习（M2）；LLM 生成叙述（裁决 ⑤ 后置）；
块级编辑与判定（留 `#/admin/parsing`，工作台只做只读渲染）；对 Axiom-Flow / QED-Tracker 的代码改动
（Tracker 侧 `database-shared-tables.md` 的共享表登记行属对方文档面，按其追认节奏出）。

## 前置条件

1. **learn 域端点当前真机全 503**（实测 2026-10-01：`GET /api/v1/learn/courses` 503，
   `learn.py:116-120` 的 `_store()` 无生产挂载；对照知识点两表因有懒挂载返 200）。工作台若要 learn 面
   数据，W1 必须先做；本轮 outline 树**不落 learn 族**，故 W1 是「消 503」的独立前置，不阻塞 W2~W5。
2. **解析产物无章节结构**（实测：b05 抽样 80 页块类型＝header 76 / paragraph 1199 / formula 432 /
   page_number 69 / caption 2，**heading 0 个**；`parsing-flow.md` §6 schema 声明的 `heading+level`
   在现生效版本产物里没有实例）。⇒ 章节只能从**目录页文本**解析或人工录入，不能指望块类型。
3. 目录实态存在且可读（b05 实测 p4 前言、p5~p6 符号表、p7~p8 目录行「第1章 实数系统 … 1」）。
4. 中栏正文来源＝8900 门面的 `GET /api/v1/books/{book_id}/pages/{page_no}`（ADR 0007 不破）；
   渲染组件复用 `web-ui/src/components/parsing/BlockList.tsx` 与 `typography.ts`（parsing-ui §9.1）。
5. 右栏写面已冻结可用（`POST /learn/kp-details` → `/confirm` → `/reject`，
   `api/learn.ts:126/140/145` 前端函数已在）。

## 知识点两表 v2（重设计稿，2026-10-01）

**主表 `qed_knowledge_point`**（第四张共享表，结构由根定义；D1 批复的三项目可读口径不变）：

```sql
CREATE TABLE IF NOT EXISTS qed_knowledge_point (
  kp_id VARCHAR(64) PRIMARY KEY COMMENT '行 ID（kp-<hex12>）',
  domain_id VARCHAR(64) NOT NULL DEFAULT '' COMMENT '领域坐标（逻辑引用 qed_domain）',
  domain_label VARCHAR(255) DEFAULT '' COMMENT '领域名快照',
  course_id VARCHAR(64) NOT NULL COMMENT '课程坐标（逻辑引用 qed_course）',
  course_label VARCHAR(255) DEFAULT '' COMMENT '课程名快照',
  node_kind VARCHAR(16) NOT NULL DEFAULT 'point' COMMENT '闭集 outline=目录节点(大知识点) / point=细知识点',
  parent_kp_id VARCHAR(64) COMMENT 'outline：父 outline（章=NULL，节=章）；point：所属 outline（NULL=未归档池）',
  depth TINYINT COMMENT 'outline 层级：1=章 2=节（与目录实态两级对齐）；point 行 NULL',
  book_ref VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'outline：来源书（qt_books.book_id，书目级稳定，版本换代不碎树）；point 行默认空串',
  name VARCHAR(500) NOT NULL COMMENT '展示名（章名 / 知识点 canonical 名）',
  norm_key VARCHAR(200) NOT NULL COMMENT '去重键（全角转半角+空白折叠+小写）',
  type VARCHAR(16) COMMENT 'point 行四分类 memory/procedure/concept/design；outline 行必须 NULL',
  order_hint INT COMMENT 'point：课程内学习顺序；outline：由目录页码派生的书内顺序',
  summary VARCHAR(1000) DEFAULT '' COMMENT '一句话摘要（限长 1000）',
  source_ref JSON COMMENT 'outline 正文位置 {kind:"af_version"|"book", ref_id, page_start, page_end}（**PDF 页序**，非印刷页码）；point 行可空',
  anchors JSON COMMENT '来源锚点 [{kind,ref_id,page?,snippet?}]（point 行的溯源，形状沿用 DeepTutor K1）',
  from_detail_id VARCHAR(64) COMMENT '提升来源明细（溯源 qed_learn_kp_detail）',
  confirmed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '人工确认位（机器永不写 1；目录确认写入即置 1）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  UNIQUE KEY uq_kp_course_book_norm (course_id, book_ref, norm_key),
  KEY idx_kp_parent (parent_kp_id),
  KEY idx_kp_course_kind (course_id, node_kind),
  KEY idx_kp_domain (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='知识点主数据（领域→课程→章节(outline)→知识点(point) 层级；一行=一个人工确认的行，结构由 QED-Engine 根定义）';
```

> 排序沿用 `order_hint` + `depth`，**不新增** `sort_order` 列。

> **2026-10-05 DEFECT-011 改判（用户裁决）**：上方冻结稿的 `UNIQUE KEY uq_kp_course_book_norm` 在真机落地时被证明与真实教材目录冲突（b05 实测「级数」「积分」各出现于两章），已**降级为普通索引** `idx_kp_course_book_norm`；重名去重改由服务端显式校验承载（outline 同父级重名 422、point 提升同课程重名 409），跨章同名合法。DDL 正本＝`backend/qed_engine/services/learn/knowledge.py`，口径正本＝[database-design.md](../../../architecture/database-design.md)；详见「裁决登记三」与「缺陷登记」。
> 因此本节下方表格里的「改判为 `(course_id, book_ref, norm_key)`」一行读作**普通索引**（键组合不变）。

**相对 v1（M5 冻结版，`services/learn/knowledge.py:36-55`）的改动与理由**：

| 列 / 键 | 动作 | 为什么 |
| --- | --- | --- |
| `node_kind` | 新增（闭集 outline/point） | 大知识点与小知识点同表分层；所有「只数知识点」的查询按它过滤，避免章名污染计数与检索 |
| `parent_kp_id` | 新增 | 「该章节的细知识点」的唯一归属表达（裁决 ④ 前端过滤的依据）；同时给未归档池留 NULL |
| `depth` | 新增 | 左栏缩进与「章/节」区分不靠 parent 链递归，一次查询即渲染 |
| `book_ref` | 新增（标量，默认空串） | 一门课多本书并存（mathanalysis 有 b01…b18），章名跨书重名是常态；标量列参与唯一键与索引 |
| `source_ref` | 新增（JSON，outline 行） | 章节↔页范围的落库承载位＝裁决 ③ 的授权点；`page_start/page_end` 用 **PDF 页序**，印刷页码只在解析草稿里存在 |
| `type` 语义 | 改判 | outline 行必须 NULL（四分类只描述知识点不描述章节），否则星图与检索的四分类过滤失真 |
| `uq_kp_course_norm(course_id, norm_key)` | 改判为 `(course_id, book_ref, norm_key)` | 现键下两本同课书的「第1章 …」会撞唯一键；`book_ref` 空串参与键以保 point 行的课程级唯一（point 仍一课一名） |
| `idx_kp_parent` / `idx_kp_course_kind` | 新增 | 左栏取子树、中栏取该章知识点、徽标按 kind 聚合 |
| 其余列 | 保留不动 | 坐标四列 / `name` / `norm_key` 规范化 / `summary` / `anchors` / `from_detail_id` / `confirmed` 语义与 M5 批复一致 |

**候选明细表 `qed_learn_kp_detail`**（根私有，8901/8902 不读；v1 见 `knowledge.py:57-81`）：

| 列 | 动作 | 为什么 |
| --- | --- | --- |
| `parent_kp_id` | 新增 | 候选写的时候就挂在某章下；`/confirm` 提升时把它平移到主表同列，右栏「本章候选」列表据此过滤 |
| `intent` | 新增 VARCHAR(16) NOT NULL DEFAULT `'explanation'`，闭集 `summary` / `explanation` | 用户设想的「总结」与「详解」是两种用途的批注，与 `type` 四分类**正交**（一条 concept 可以是总结也可以是详解）；同池不同用途需要一列而非塞进 `payload` |
| `book_ref` | 新增（默认空串） | 与主表同口径，提升时唯一键校验要对齐（否则 outline 候选提升必撞键） |
| `narrative` / `payload` / `anchors` / `gen_batch` / `map_seed` / `model_ref` / `gen_status` / `dedup_of` / `confirmed` / 坐标四列 | 保留不动 | `gen_status` 闭集 draft/candidate/adopted/rejected 不变；`payload` 仍「不含判分」（判分归主链 M-3） |

**关系与生命周期**：
`qed_knowledge_point.outline` ← 目录解析+人确认写入（`confirmed=1`，不经 detail）；
`qed_learn_kp_detail` ← 右栏批注「保留」写入；`/confirm` → 主表 `point` 行（`from_detail_id` 溯源）。
两表均可 DROP 重建（裁决 ⑥）：qed_test 由 `ensure_tables` 幂等重建，生产 `qed` 库不 ALTER、随 1.0
重建节奏执行，DDL 操作属 D 类转人工（根侧不留生产库操作项）。

**消费面回归点（必须随步，否则把 M5 已交付的东西改坏）**：

| 位置 | 现状 | v2 处置 |
| --- | --- | --- |
| `services/learn/knowledge.py:380-395` `counts_by_course()` | 全表 `COUNT(*) GROUP BY course_id` | 加 `WHERE node_kind='point'`，否则章名进星图徽标数字 |
| `list_points()` 与 `GET /learn/knowledge-points` | 无 kind 过滤 | 默认只出 `point` 行（outline 走树端点），保持 `CourseKnowledge.tsx` 与检索页零回归 |
| `GET /learn/courses/{course_ref}/knowledge-points` | 返回课程全部主表行 + 同名候选 | 默认 `point` 行；新增 `?include_outline=true` 时才带 outline（星图/工作台取树用） |
| `/confirm` 提升校验 | 按 `(course_id, norm_key)` 查冲突 | 改按 `(course_id, book_ref, norm_key)`，并把 detail 的 `parent_kp_id`/`book_ref` 平移 |
| `design/learning-star-map.md` | 「层＝行 × 轨迹＝列」+ 徽标口径 | 只补一行「徽标只数 `point` 行」的口径注（随 W6 晋升批） |

## REST 契约增补（`/api/v1/learn/*`，8900 自有域）

| 端点 | 语义 | 错误 |
| --- | --- | --- |
| `GET /learn/courses/{course_ref}/outline` | 取章节树：`?book=` 过滤来源书 → `{outline:[{kp_id,name,depth,parent_kp_id,book_ref,source_ref,point_count}]}` | 404（课程无坐标行时按课程目录判定） |
| `PUT /learn/courses/{course_ref}/outline` | **整树写入**（人工确认后的目录树）`{book_ref, tree:[{name, page_start, page_end, children?}]}`；幂等替换同 `book_ref` 的 outline 子树，**point 行一律不删**（其父被替换时同名复用 `kp_id`，未复用者 `parent_kp_id` 置 NULL 归未归档池）；写入即 `confirmed=1` | 404；422（`book_ref` 空、树空、层级 >2、页范围倒置或越界、name 空） |
| `PATCH /learn/knowledge-points/{kp_id}` | 移动与改名：白名单 `{parent_kp_id, name, order_hint}`（extra 422） | 404；422（outline 行改 `parent_kp_id` 成环、point 挂 point） |
| `POST /learn/kp-details` | 既有端点**请求体扩** `parent_kp_id?`、`intent?`（默认 explanation）、`book_ref?` | 既有 422 口径不变 |
| 其余五端点 | 语义不变，内部按 `node_kind='point'` 过滤 | — |

- 错误码约定与「响应不含密钥 / 全端点走 8900」不变（主链壳 M-1 契约节口径）。
- 契约测试先行（S5）：`tests/contract` 端点与错误码清单 + `tests/test_learn_knowledge.py` 层级用例。

## 目录解析规格（`web-ui/src/tocParse.ts` 纯函数，裁决 ②）

输入＝目录页的 `blocks[].text`（或 markdown 行），实测样本 b05 p7/p8。

1. 行拆分：`title + 页码` 用「行尾数字」锚定（`(.+?)[\s.…_]*?(\d{1,4})$`），先去页眉页脚与「VII」类
   罗马页码行（目录页自身页码在 `page_number` 块里，不从文本猜）。
2. 定级：命中 `第?\s*[0-9一二三四五六七八九十百]+\s*章`（含 "Chapter"）判 depth=1；其余行挂最近一个
   depth=1 判 depth=2；**最深两级**（与主表 `depth` 口径一致）；前言/附录/习题/参考文献行剔除。
3. 印刷页码 → PDF 页序：`pdf_page = print_page + offset`。offset 由 UI 给一个整数，默认自动试算
   （取目录首章标题文本在正文侧首次出现的 PDF 页 − 其印刷页码），人工可改；落库只存 PDF 页序，
   相邻章首尾相接、末章取 `page_count`（b05=317）。
4. 未识别行进「未识别行」列表在确认面板里可见可改可删——**不静默丢弃**。
5. 输出＝`{tree:[{name, print_page, depth, children}], offset, unrecognized:[...]}`，
   夹具用 b05 实测文本（vitest）。

## 三栏工作台设计（8903，最小增量）

| 栏 | 内容 | 复用 / 新增 |
| --- | --- | --- |
| 左 | 领域→课程（星图同源目录）→ 书（`GET /api/v1/books` 按 `course_id` 过滤，取 `active_job_id` 非空者可读）→ **章节目录树**（outline 行按 depth 缩进 + 每章 point 计数）→「导入目录」入口 | 新增页面壳 + `BookTree.tsx` 选择交互先例；树数据＝`GET …/outline` |
| 中 | 该章正文＝`page_start..page_end` 逐页 `GET /books/{id}/pages/{n}`，**只读**排版渲染（字号阶梯 / 字体 / 目录点线等按 parsing-ui §9.1 版式规格），KaTeX/表格/图回原样 | 复用 `components/parsing/BlockList.tsx` + `typography.ts` + `MarkdownView.tsx`；**不带**判定/备注/范围编辑 affordance |
| 右 | 批注面板：中栏选中块（或选区）→「总结」或「详解」→ 人工书写 → 「保留」＝`POST /learn/kp-details`（`intent` 对应、`anchors` 带 `page`+`snippet`、`parent_kp_id`=当前章、`gen_status=candidate`）/「丢弃」＝不落库；下方按 `parent_kp_id` 列本章候选，「确认」＝`/confirm` 提升主表 | 复用 `api/learn.ts` 三函数；新增面板组件 + 一个 store 切片 |

- **页窗性能约束**：一章 ~20 页、全书 317 页 ⇒ 中栏按 8 页/批懒取，不整章一次拉完（登记为约束，不是待办）。
- 星图侧唯一改动＝课程节点加「进入学习」链接指向 `#/learn/c/{courseId}`。
- 本轮**不做**：进度条 / `covered` 勾选 / 掌握态（归主链 M-3）。

## 与 M1 的分工

M1（学习面 UI 与渲染基线）承载**渲染基线滚动线**（UI-1）与编译块序列形态（UI-2~UI-4，前置＝主链
M-1 存储接入 + M-2 编译产物）。本模块的三栏工作台**不等编译产物**：中栏直接消费解析产物，
渲染组件与 UI-1 共用一套（KaTeX/表格/图片/版面回原样的判据同样适用本模块 S3）。
两者不争同一行：M1 行判据不改写，本模块由 ARCH-027-M6 新行承载。

## 工作项（滚动登记表）

| 流 | 内容 | 状态 |
| --- | --- | --- |
| W1 | learn 域存储懒挂载（照 DEFECT-009 判例：幂等建表 + 失败 60s 短窗重试，启动路径不碰 MySQL），`/learn/courses*` 出 200 | 已完成（2026-10-03 真机：8900 经 `/self-restart` 重启后 `GET /learn/courses` 200，懒挂载在 `qed_test` 建成 `qed_learn_course`/`qed_learn_unit`/`qed_learn_unit_progress` 三表） |
| W2 | 知识点两表 v2（DDL + 内存/MySQL 存储层 + 星图与检索口径回归修正 `node_kind` 过滤） | 已完成（2026-10-03；真机两表已按裁决 ⑥ DROP 重建为 v2 形态，列清单见 W6 过程节） |
| W3 | outline 三端点（GET/PUT/PATCH）+ `POST /kp-details` 请求体扩列 + 契约测试先行 | 已完成（2026-10-03；契约与 code-map 已同步） |
| W4 | `tocParse.ts` 纯函数 + vitest（b05 p7/p8 实测文本夹具）+ 目录确认面板（offset 与未识别行） | 已完成（2026-10-03；浏览器实测归 W6） |
| W5 | 三栏工作台页面 + store + 路由 `#/learn/c/:courseId` + 批注→候选→确认闭环 + 星图下钻链接 | 已完成（2026-10-03；8903 真机浏览器实测归 W6） |
| W6 | 收口：门禁（契约/全量/ruff + tsc·vitest·build）+ 8903 浏览器实测 + 设计晋升 `design/learning-workbench-ui.md` 与 database-design / api-contracts §⑥ / code-map 随步 | 已完成（2026-10-05：门禁全绿（契约 82 / 全量 721 / ruff + tsc·build·vitest）+ 设计晋升四处 + 8903 浏览器黄金路径真机通过（选书→目录导入→中栏 49–56 页排版正文→点块锚点→批注→候选→确认提升），期间修 DEFECT-010/011 两枚，见「缺陷登记」） |

## 过程与证据

- **2026-10-01**：评审与立项。起因＝用户对 M1 学习面板的三栏设想；评审取证（真机与真数据，非文档推断）＝
  ① `GET /api/v1/learn/courses` 真机 **503**（`learn.py:116-120` 无生产挂载）、`GET /api/v1/learn/kp-details`
  真机 **200**（知识点两表懒挂载可用）；② b05 抽样 80 页块类型统计＝header 76 / paragraph 1199 /
  formula 432 / page_number 69 / caption 2，**heading 0**（`parsing-flow.md` §6 声明的 heading+level
  在现产物里无实例）；③ b05 p4 前言 / p5~p6 符号表 / p7~p8 目录文本实读（「第1章 实数系统 … 1」式行）；
  ④ 主表 `counts_by_course()`（`knowledge.py:380-395`）现无 kind 过滤＝层级化后必改的回归点。
  用户批复七项裁决（①~⑦，含「大知识点落主表」「两表可删除重建」「文档先行」），本壳建壳并登记
  两表 v2、REST 增补、目录解析规格与三栏设计；todo 增 ARCH-027-M6 行，主链壳「模块壳一览」增 M6 行。
  **本批为纯文档，无代码改动**；门禁＝契约 + 全量 + ruff（文档面另证）。

- **2026-10-01（立项落位复核与门禁）**：
  - 四处登记复核为单点落位（`todo.md` 行 1 处、`plans/index.md` 条目 1 处、主链壳「模块壳一览」M6 行、
    M1 壳 `## 过程与证据` 指针条目），并修正两处自身笔误：`plans/index.md` 的 M6 条目原插在 M1~M5
    条目与其续行之间（已移到续行之后）、轮标题补「2026-10-01 增 M6」。
  - 台账行 G2 自证：6 列、成功标准 270 字符（上限 400）、以 `S1 ` 起始、无过程叙述与日期戳词。
  - 壳 `状态` 由 In Progress 改判 **Accepted**：实现未开工（等用户「开始执行」发令），与 M1~M4 同口径；
    该改判同时消解 `test_todo_plan_rows_exactly_mirror_active_plan_bodies` 的台账↔壳状态镜像红。
  - 门禁：`tests/contract` **82 passed**、全量 `pytest` **651 passed**、`ruff check .` **All checks passed**
    （解释器 QED_env 3.12，串行执行）。本批无前端改动，未跑 web 门禁与浏览器验证。
  - 待裁点 R7~R10 已提交用户拍板；未获批复前不动码（裁决 ⑦ 文档先行）。
- **2026-10-03（R7~R10 批复与开工发令）**：用户四项全按本壳推荐口径拍板——R7 路由参数取 `course_id`、
  R8 两级章节且允许 point 直挂章、R9 重复导入保留 point 行 + 同名 outline 复用 `kp_id`（未复用者归
  未归档池、point 不删）、R10 `book_ref` 取 `qt_books.book_id`。裁决 ⑦「文档先行」据此解除，
  W1~W6 进入实施；下方「待裁点」节改写为「裁决登记二（已批）」。


- **2026-10-03（W1+W2+W3 实施：两表 v2、outline 三端点、learn 三表懒挂载）**：
  - **W2/W3（层级化两表 v2 + 端点）**：契约测试先行——`tests/test_learn_knowledge.py` 新增 8 例（整树写入
    两级 confirmed 行、point 挂章与逐节点计数、重复导入复用 `kp_id` 且被弃章的 point 归未归档池、
    7 个 422 体 + 两处 404 错误码清单、`PATCH` 移动与非法父校验、默认查询不含 outline、`intent` 闭集与
    默认值、候选按章过滤）先红（8/14）后绿。实现＝`knowledge.py` 两表 v2 DDL 与 `MySQLKnowledgeStore`
    （`node_kind`/`parent_kp_id`/`depth`/`book_ref`/`source_ref`、唯一键 `(course_id, book_ref, norm_key)`、
    `flatten_outline` 前序展开、`replace_outline` 同名复用、`patch_point` 白名单、计数与列表 `kind` 过滤）＋
    `knowledge_memory.py` 同形重写；`api/learn.py` 21→**24 端点**（`GET/PUT /learn/courses/{course_id}/outline`、
    `PATCH /learn/knowledge-points/{kp_id}`、`include_outline`/`parent` 查询参数、`POST /kp-details` 入参扩列）。
  - **W1（消 learn 域 503）**：`services/learn/base.py` 补 `MySQLLearnStore`（三表 CRUD/整树覆写/编译 carry/
    派生进度，接口与 `InMemoryLearnStore` 同形，公开方法由 parity 测试守护）；`api/learn.py` 加
    `_mount_learn_store`＋`LEARN_MOUNT_RETRY_SECONDS = 60.0`（判例 DEFECT-009：首个 `/learn/courses` 请求建表挂载、
    失败只锁短窗、启动路径不碰 MySQL）。`tests/test_learn.py` 新增 4 例（首请求挂载且只建一次、瞬断重试窗口、
    未配置密码不建表直接 503、两实现同形）。
  - 契约登记：`api-contracts.md` 端点总表 +3 行与正文三条口径；`database-design.md` `qed_knowledge_point`
    小节改 v2 层级化（并链本壳）＋总表两行与学习表族 detail 行同步；`code-map.md` learn.py 24 端点、
    base.py/knowledge.py/knowledge_memory.py 三行改述。
  - 门禁（解释器 QED_env 3.12，串行）：`tests/contract` **82 passed**、全量 **663 passed**、`ruff check .`
    **All checks passed**。
  - 真机前置取证（只读）：8900 开发库＝`qed_test`，`qed_knowledge_point` 列＝v1（无 `node_kind` 等五列）、
    索引仍是 `uq_kp_course_norm(course_id,norm_key)`，`qed_learn_kp_detail` 同样 v1；**两表行数均为 0**
    ⇒ 按裁决 ⑥「可删除重建、无数据搬迁」重建即零数据损失。`qed_learn_course/_unit/_unit_progress`
    三表在 `qed_test` **不存在**，由 W1 懒挂载首次请求自动建。8900 现运行旧代码（不热重载），
    `/api/v1/learn/courses` 仍 503 ⇒ S5「学习域课程端点可达」的真机核验需 ①DROP+CREATE 两表 ②重启 8900，
    两项均已提交用户批准（破坏性/共享态操作，不擅自执行）。
  - **执行受阻（权限层）**：用户经问答批准，但 auto 权限分类器读不到问答批准，`DROP+CREATE`、
    `POST /services/axiom/start`、只读 `qed` 业务库取目录文本三次调用均被拦 ⇒ 三步转人工执行，
    命令原文见「遗留与移交」。v1 结构已备份到 `logs/kp-v1-ddl-backup-20261003.sql`（含两表
    `SHOW CREATE TABLE`，DROP 前导出，0 行）。

- **2026-10-03（W4 实施：目录解析纯函数 + 目录确认面板）**：
  - `web-ui/src/tocParse.ts`（新）＝「目录解析规格」的实现。行拆分**复用** `typography.ts` 的
    `tocItemParts`（不重造尾数正则）与 `isTocHeadingText`；罗马页码行（b05 p8 实测以 paragraph 块出现
    「VII」）先行剔除；章题 `第N章`（阿拉伯/中文数字、含空格）与 `Chapter N` 判 depth=1，其余挂最近章题
    判 depth=2，最深两级；未识别三类统一进 `unrecognized`（`excluded`＝前言/附录/习题/参考文献类设计内剔除、
    `no-page`＝拆不出页码、`no-parent`＝节题先于任何章题）——**不静默丢弃**。偏移＝`estimateTocOffset`
    （首章标题正文侧首次出现页 − 其印刷页，人工可覆盖）＋`toOutlinePayload`（相邻首尾相接、末章取
    `pageCount`、越界回夹，直出 PUT outline 的 `page_start/page_end`）。
  - `web-ui/src/components/learning/TocConfirmPanel.tsx`（新）＝目录行 TextArea（可改可删）＋偏移
    `InputNumber`（试算值提示 / 人工覆盖）＋未识别行逐条带 reason 标签＋章/节页范围预览＋确认＝
    `PUT /learn/courses/{id}/outline`（失败按 8900 错误包络给提示，不抛异常）。`api/learn.ts` 补
    `getOutline`/`putOutline`/`patchKnowledgePoint`，并把 M6 扩列接到既有写面
    （`addKpDetail` 的 `anchors`/`gen_status`/`parent_kp_id`/`intent`/`book_ref`、`listKpDetails` 按章过滤）。
  - 夹具＝**b05 目录页实测文本**（p7 全条、p8 左右栏各前 9 行，逐行原样）。8902 本轮不可达，实测文本从上一
    会话的块转储取证；**p8 尾章题在转储里被列边界截断**，故 p8 右栏按真实现场进 `no-parent` 用例，
    章题变体（`第 11 章`／中文数字／`Chapter`）标注合成。
  - 门禁（web 面，命令在 `web-ui/` 内执行）：`vitest run src/tocParse.test.ts` **18 passed**、
    `src/components/learning/TocConfirmPanel.test.tsx` **8 passed**、全量 `vitest run` **43 files / 436 passed**、
    `tsc -b` 无输出。后端未改动，本轮未重跑 pytest/ruff（W6 收口批统一跑）。
  - code-map 不增行＝`test_code_document_mapping` 的受管目录只有 `backend/qed_engine` + `tests`，
    `web-ui/src/**` 由 `frontend-architecture.md` 面承载。

- **2026-10-03（W5 实施：三栏工作台 + 批注闭环）**：
  - `web-ui/src/stores/learnWorkbench.ts`（新）＝书 → 章节目录 → 正文分页 → 批注四段状态。书列表只取
    `course_id` 属本课且 `active_job_id` 非空者（解析版本可读的唯一事实源）；章/节页范围由 `rangeOfNode`
    校验 `source_ref`（缺范围或起止倒挂＝中栏空态，不发页请求）；中栏按 `PAGE_BATCH=8` 从 `range.start`
    推进批次（`loadedThrough` 封顶于 `range.end`，末批不足 8 页）；页 404 记为「无解析产物」空态而非错误
    （`ApiError && status===404` → `error:null`）。写面 `addAnnotation`＝`POST /learn/kp-details`，
    带 `gen_status:candidate` + `intent` + `parent_kp_id`（选中章/节）+ `book_ref` + `anchors`
    （中栏点选块 → `{kind:'book', ref_id:book_id, page, snippet}`），写后整体重取本章候选（不做乐观更新）。
  - `web-ui/src/pages/LearnWorkbench.tsx`（新）＋`components/learning/AnnotationPane.tsx`（新）＋路由
    `/learn/c/:courseId`（`App.tsx`）。中栏**复用** parsing 面组件而不另造渲染器：`blocksOf`（CompareView）
    + `BlockList` 以 `editMode={false}` `renderMode="layout"` `imageSize={null}` 只读排版，
    版式偏好取 `loadTypographyPrefs()`；右栏=批注表单（总结/详解 + 四分类可空 + 正文）＋本章候选清单，
    确认/驳回沿用 M5 `/confirm` `/reject`。导入目录走 Modal：目录起页/止页/正文起页 → `getBookPage` 读块 →
    `tocLinesFromBlockTexts` 拆行 → `TocConfirmPanel` 解析预览与人工确认（裁决 ②），`onSaved` 里补
    `reloadOutline()` 让左栏随即见树。
  - **与壳内设计的偏差（1 处）**：星图课程节点的「进入学习」链接落在**课程知识点页页头按钮**
    （`CourseKnowledge.tsx` 加「进入学习工作台」），不在 ECharts 画布内加第二枚可点元素——画布内已承载
    选中/悬停/下钻三态，再加按钮会把徽标口径挤掉（星图渲染面改动归 ARCH-027-M5 线的界面反馈轮面）。
  - `tocParse.ts` 尾部补纯函数 `tocLinesFromBlockTexts`（多行块按 `\n` 拆行、空行剔除），供导入 Modal 把
    目录页 paragraph 块原文转成面板可编辑的目录行。
  - 门禁（web 面，命令在 `web-ui/` 内执行）：`vitest run` M6 相关 8 文件 **71 passed**
    （`tocParse` 21 = 18+3、`stores/learnWorkbench` 8、`AnnotationPane` 8、`LearnWorkbench` 8、
    `TocConfirmPanel` 8、`CourseKnowledge` 5、`Knowledge`/`App` 各随批）；全量 **44 files / 466 passed**、
    2 failed 全归并行轮 WIP（`Console.test.tsx` 与 `stores/runtime.test.ts`＝ARCH-038 分批刷新在途，
    `LlmCalls.test.tsx` 单跑通过＝并发压力下 5s 超时假红）。`npx tsc -b` 只剩 `runtime.test.ts` 三条
    TS2740（同上归 ARCH-038），M6 文件零错误；`npm run build` 因该并行 WIP 类型错误未产出 dist，
    故真机浏览器实测随 W6（前置＝用户批准的三步：qed_test 两表重建、起 8902、重启 8900）。
  - 测试取证教训（夹具 provenance）：目录导入用例首跑「未识别 4 行」＝mock 把同一份 p7 文本同时返给
    p7 与 p8，两块拼接后每行重复；已改为 p7/p8 各返自身文本（p8 续列含「VII」罗马页码行与第3章题），
    断言随之固定为三章 `9–28 / 29–32 / 33–317`。
- **2026-10-03（W6 实施：门禁 + 真机数据面 + 设计晋升 + 浏览器实测部分）**：
  - 门禁（后端，解释器＝`D:/software/anaconda3/envs/QED_env/python.exe`）：`pytest tests/contract -q`
    **82 passed / 0 failed**、`pytest -q` **665 passed / 0 failed**、`ruff check .` **All checks passed!**。
    首轮曾见同一枚红＝`test_runtime_artifacts_only_under_logs_and_tmp` 报
    `assert not ['scripts/image-model/.keepalive.pid']`（并行本地模型轮散落的运行时产物，非本会话引入），
    复跑时该产物已被其所属轮清走，故终值全绿。
  - 门禁（web 面，命令在 `web-ui/` 内执行）：`npx tsc -b` **零错误**、`npm run build` **通过并产出 dist**
    （此前挡住构建的 ARCH-038 并行 WIP 类型错误已由对方窗口修好）、`npx vitest run` **472 tests / 469 passed / 3 failed**，
    三枚失败（`DownloadsTree.form`、`Console`、`LlmCalls`）**逐文件单跑全部通过**＝并发内存压力下的 5s 超时假红
    （教训沿用：整批红必须先串行复跑再归因）。M6 相关 8 文件维持 71 passed。
  - 真机三步结果：① `qed_test` 两表 DROP 重建（DROP 前 `COUNT(*)` 双双＝0 才放行，v1 结构已备份
    `logs/kp-v1-ddl-backup-20261003.sql`）；③ 8900 经 `POST /api/v1/self-restart` 重启并加载 W1/W2/W3 代码。
    重启后 `GET /api/v1/learn/courses` 由 503 → **200**（W1 懒挂载真机达成，DEFECT-009 同型判例复现通过）。
    ② 起 8902 已派发但失败，见「遗留与移交」4。
  - S1 真机结构核验：重建后的 `qed_knowledge_point` 含 `node_kind/parent_kp_id/depth/book_ref/source_ref`，
    `qed_learn_kp_detail` 含 `parent_kp_id/intent/book_ref`——与两表 v2 设计一致（取证 `logs/dbafter.txt`）。
  - S5 真机端点核验（`qed_test`，课程 `math_analysis`）：`PUT /outline` 200 → 首次 `{reused:0,created:2}`、
    二次同名 `{reused:2,created:3,dropped:0,orphaned_points:0}`（R9 同名复用 `kp_id` 生效）；错误码齐备＝
    空树 422、`page_start>page_end` 422「页范围非法」、`book_ref` 空 422、三级树 422「目录树最深两级（章→节）」、
    未知课程 GET 404、`kp-details` 缺名 422、非法 `intent` 422。
  - S4 真机口径核验：确认提升后 `GET /knowledge-points` 默认**只出 point 行**（total=1，kinds=[point]），
    `?include_outline=true` 才带 outline 行（total=3）；`GET /outline` 只出 outline 行并带 `point_count`。
  - 设计晋升四处（S6）：新建 [learning-workbench-ui.md](../../../design/learning-workbench-ui.md)
    （Accepted / 实现状态 In Progress，目录解析七条规格由壳内晋升为设计态事实源）＋
    `docs/design/index.md` 学习中心表新增行与头部日期＋`tests/contract/test_design_documents.py` 的
    `CURRENT_DOCUMENTS` 登记（契约门禁复跑绿）＋`docs/architecture/frontend-architecture.md` 补
    `#/learn/c/:courseId` 路由条目与「最后更新」。`api-contracts.md` §⑥ 与 `database-design.md`、`code-map.md`
    的学习域行在 W2/W3 已随步，本轮终检无缺漏。§8 降级矩阵另补两行（解析服务离线经 8900 透传 503、
    有目录但未选书）＝浏览器实测所见形态回写设计。
  - 8903 浏览器实测（browser-use，真实 MySQL 数据）：`#/learn/c/math_analysis` 三栏骨架渲染正常，左栏显示真机
    outline 行（章 + 节 + 计数徽标），选中章后中栏标题出「正文 · 第 9–28 页」、右栏按 `parent_kp_id`
    拉本章候选 200；8902 离线时走设计内降级＝顶部「工作台数据不可达」+「重试」、左栏书目空态「本课暂无
    已激活解析版本的书」，**不白屏**。`list_network_requests` 全部指向 8900（ADR 0007 无违反）；
    `#/knowledge/c/math_analysis` 「已确认 1 · 待选 0」与「进入学习工作台」按钮可见且点击实测路由到工作台。
  - **黄金路径未完成（S3 待核）**：「选书→中栏按排版出正文→点块取锚点」需 8902 根视图供页数据，本轮 8902
    启动失败（原因见「遗留与移交」4），故该段**未做浏览器验证**，不以单元/契约绿冒充真机 UI 通过；
    本行因此**不关闭**，S3 待 8902 恢复后重跑 `qed-frontend-check` 黄金路径段。
  - 台账与文档同步：[项目状态快照](../../../trackers/project-status.md)「当前主线」新增 ARCH-027-M6 进行中条目（含门禁数值、真机 503→200、S1/S4/S5 核销、S3 阻塞与处置边界指针），`最后更新` 改 2026-10-03；同步后复跑 `pytest tests/contract -q`＝**82 passed / 0 failed**（文档守护绿）。
- **2026-10-05（W6 收尾：8902 恢复 → 黄金路径真机通过，期间修 DEFECT-010/011 两枚）**：
  - 前置解除：「遗留与移交」4 的 8902 启动失败由 Axiom-Flow 窗口按其迁移节拍补列后恢复（根侧未代改、未代提交），页数据面经 8900 恢复可读。
  - **DEFECT-010**（黄金路径首轮阻塞）：工作台「导入目录」确认后 `PUT /learn/courses/{id}/outline` 回 422「目录树最深两级（章→节）」。根因＝`_validate_outline_tree` 对前端目录面板显式提交的 `children: []` 仍递归下探，两级树的叶节点被算成第三级。修法＝空 children 不下探；回归守护＝`tests/test_learn_knowledge.py::test_outline_leaf_accepts_empty_children_list`（先红后绿）。
  - **DEFECT-011**（同一轮真机暴露）：整树落库时同书**不同章的同名节**（b05 实测「级数」「积分」各两见）撞主表唯一键 `(course_id, book_ref, norm_key)` → 1062 Duplicate。用户裁决修法＝**唯一键降级为普通索引**（口径见「裁决登记三」）。实施＝`knowledge.py` DDL 改 `KEY idx_kp_course_book_norm`、`replace_outline` 与内存实现的复用键改「父级 + `norm_key`」（跨章同名各自成行、重导入不再互相吞并）、`learn.py` 校验补「同一父级下重名422」；`point` 提升去重仍由 `confirm_detail` 的显式 SELECT → 409 承载。回归守护＝新增三例（跨章同名节 200 各成行 / 同父重名 422 且零落库 / 重导入按父级复用 `kp_id` 断言 `reused:3,created:1,dropped:3`），该文件 **26 passed**。
  - 文档随步（改码前落笔）：`database-design.md` 第四张共享表的键行改判、`api-contracts.md` §⑥ PUT 行补「同父级复用 `kp_id`＋同一父级下重名 422」与 `children:[]` 口径、`learning-workbench-ui.md` §6 补重名口径。
  - `qed_test` 两表按裁决 ⑥ 再次 DROP 重建（**重建前行数已备份 `logs/kp_backup.json`**＝主表 6 行 / detail 1 行，系 10-03 演示数据；新 DDL 取证 `logs/kp_rebuild.txt`）＋ 8900 经 `POST /api/v1/self-restart` 重启加载新代码（8900 不热重载）。
  - 8903 浏览器黄金路径（browser-use，真实 MySQL 数据，`qed-frontend-check`）：`#/learn/c/math_analysis` 选书 b05 → 目录导入（p7/p8 页文本 → 确认面板）→ `PUT /outline` **200** `{reused:0,created:95,dropped:0,orphaned_points:0}`（`book_ref=mathanalysis-b05`，跨章同名节各自成行）→ 左栏章/节树带 `point_count` 徽标 → 中栏第 3 章 **49–56 页逐页 200 按版式渲染**（KaTeX／表格／图回原样）→ 点块出锚点回显 → 右栏批注 `POST /learn/kp-details` **200**（`kpd-60b14cc1aece`）→ `/confirm` **200** 提升主表（`kp-143c7992e77a`）→ 课程知识点页「已确认 1 · 待选 0」、星图 `kp_confirmed=1 / kp_candidates=0`。`list_network_requests` 58 条全部指向 8903 资产与 8900（ADR 0007 无违反）且无 4xx/5xx；`list_console_messages` 零消息。库面终检（`logs/kp_after.txt`）＝主表 96 行、四组跨章同名节父级互异、`SHOW INDEX` 的 `idx_kp_course_book_norm` `Non_unique=1`。**S3 真机达成。**
  - 门禁终值（收口批，串行复跑）：后端 `pytest tests/contract -q` **82 passed / 0 failed**、`pytest -q` **721 passed / 0 failed**、`ruff check .` **All checks passed**；web 面（命令在 `web-ui/` 内执行）`npx tsc -b` 零错误、`npm run build` 产出 dist、`npx vitest run` 全量绿（M6 相关 8 文件维持 71 passed）。首轮 `ruff check .` 曾报并行会话散落在仓库根的 `.tmp_close_arch040.py` 非 ASCII 语法红，复跑时该文件已被其所属窗口清走，非本会话引入、未代改。
  - 取证边界：in-app 浏览器 viewport 为 0x0（`take_screenshot` 回 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`），故本轮**未做视觉／像素级验证**，证据＝结构快照 + 请求账 + 库面读数；交互一律经 `evaluate_script` 派发真实事件。

## 裁决登记二（R7~R10，2026-10-03 用户批复：四项均按本壳推荐口径）

| # | 议题 | 批复口径 |
| --- | --- | --- |
| R7 | 路由参数取 `course_id` 还是 `learnCourseId` | **`course_id`**（与星图下钻、知识点主表组织同源）；`qed_learn_course` 注册面本轮不引入 |
| R8 | 章节层级与细知识点归属 | **两级**（`depth` 1=章 / 2=节）**＋允许 point 直挂章**（`parent_kp_id` 不校验 depth） |
| R9 | 同书重复导入时已登记 point 行的处置 | **保留 + 同名 outline 复用 `kp_id`**；未被新树复用的旧 outline 归未归档池（`parent_kp_id=NULL`），`point` 行一律不删 |
| R10 | `book_ref` 取书目级 `book_id` 还是 af 解析版本 `job_id` | **`qt_books.book_id`**（书目级稳定，版本换代不碎树）；正文页范围始终按当前生效版本解释 |


## 裁决登记三（2026-10-05，用户：DEFECT-011 修法与实施节奏）

| # | 议题 | 批复口径 |
| --- | --- | --- |
| ① | 主表 `(course_id, book_ref, norm_key)` 与真实教材目录跨章同名节冲突的修法 | **唯一键降级为普通索引** `idx_kp_course_book_norm`；重名去重改由服务端显式校验承载（outline 同父级重名 422、point 提升同课程重名 409），跨章同名合法。索引变更只落 `qed_test` 的删除重建（裁决 ⑥）；生产 `qed` 库不 ALTER，属 D 类转人工随发布批次 |
| ② | 登记与实施节奏 | **文档随步后立即改码**：三处口径先落笔（database-design 键行 / api-contracts §⑥ PUT 行 / 本壳裁决与缺陷登记）→ 改 DDL + 两实现复用键 + API 校验 + 三枚回归测试 → `qed_test` 重建两表 → 重跑浏览器黄金路径；全程不提交 git |

## 缺陷登记（DEFECT-010 / 011：2026-10-05 真机黄金路径暴露，均本壳承载、不另立 todo 行）

| ID | 现象 | 根因 | 修法 | 回归守护 | 关闭结果 |
| --- | --- | --- | --- | --- | --- |
| DEFECT-010 | 目录确认后 `PUT /outline` 恒 422「目录树最深两级（章→节）」，工作台导入目录走不通 | 校验器对前端叶节点显式提交的 `children: []` 仍递归下探，两级树被算成三级 | 空 children 列表不下探层级 | `test_outline_leaf_accepts_empty_children_list` | Achieved（2026-10-05 真机 200） |
| DEFECT-011 | 整树落库 1062 Duplicate：b05「级数」「积分」等节名跨章重复；重导入时同名节互相吞并 | 唯一键假定「一课一书内名称全局唯一」，与真实教材目录不符；`replace_outline` 复用键不含父级 | 唯一键降级为普通索引（裁决三 ①）；两实现复用键改「父级 + `norm_key`」；API 补同父重名 422 | 新增三例（跨章同名成行 / 同父重名 422 零落库 / 重导入按父级复用） | Achieved（2026-10-05 真机 created=95 且库面 `Non_unique=1`） |

## 遗留与移交

1. **真机三步（2026-10-03：① ③ 已按用户既往批准在本会话执行完毕；② 已派发但失败，见第 4 条）**：
   ```bash
   # ① 开发库两表按裁决 ⑥ 删除重建（0 行，DROP 前结构已备份 logs/kp-v1-ddl-backup-20261003.sql）
   cd /d/coding/QED-Engine && "D:/software/anaconda3/envs/QED_env/python.exe" -c "
   import sys; sys.path.insert(0,'backend')
   from qed_engine.config import Settings
   from qed_engine.services.llm.call_log import _connect
   from qed_engine.services.learn import knowledge
   s=Settings(); conn=_connect(s); cur=conn.cursor()
   cur.execute('SELECT COUNT(*) FROM qed_knowledge_point'); a=cur.fetchone()[0]
   cur.execute('SELECT COUNT(*) FROM qed_learn_kp_detail'); b=cur.fetchone()[0]
   assert (a,b)==(0,0), f'abort: rows {a}/{b}'
   cur.execute('DROP TABLE IF EXISTS qed_learn_kp_detail'); cur.execute('DROP TABLE IF EXISTS qed_knowledge_point')
   conn.commit(); conn.close(); knowledge.ensure_tables(s); print('qed_test v2 ready')"
   # ② 起 8902（W4 目录文本夹具与 W5 中栏正文的前置）
   curl -s -X POST http://127.0.0.1:8900/api/v1/services/axiom/start
   # ③ 重启 8900 加载 W1/W2 代码（不热重载）
   curl -s -X POST http://127.0.0.1:8900/api/v1/self-restart
   ```
   三步后预期：`GET /api/v1/learn/courses` 200（W1 懒挂载建三表）、
   `PUT /api/v1/learn/courses/{course_id}/outline` 可写 v2 行（W2/W3）。
2. **DEFECT-009 S4 真机核验**同批随 ③ 完成（同为一进程重启）。
3. `qed_test` 与生产 `qed` 库**未做任何 ALTER**（裁决 ⑥＝删除重建；生产库迁移红线归对方治理面）。
4. **8902 启动失败（跨项目阻塞，归 Axiom-Flow 治理面）**：`POST /services/axiom/start` 已派发（pid 199628）， 进程在 SQLAlchemy 启动查询处崩溃退出：`pymysql.err.OperationalError (1054, "Unknown column `af_parse_jobs.parser_signature` in `field list`")`——对方代码要求 `parser_signature` 列，而共享业务库 `qed.af_parse_jobs`（6 行，含 b05 全本作业）实测列集为 `job_id,book_id,pages,engine,status,progress,error, created_at,started_at,finished_at,source_sha256,page_count,failed_pages`，缺该列。 取证＝`Axiom-Flow/logs/qed-axiom-serve.log` 尾部 + `information_schema` 只读探查。
   处置边界：`af_*` 是对方表、`qed` 是对方业务库，补列走其红线窗口（备份 → ALTER → 模型同步 → ensure_schema），   **根侧 agent 不代改、不代提交**；请 Axiom-Flow 窗口按自身迁移节拍补列（或回退该列依赖）。   其恢复后本会话只需重跑 `qed-frontend-check` 的黄金路径段即可核 S3。**2026-10-05 已解除**：对方窗口补列后 8902 启动成功，本会话黄金路径段重跑通过，S3 达成（见「过程与证据」2026-10-05 条）。
5. **真机演示数据留在 `qed_test`（可自由清理，不影响判据）**：2026-10-05 黄金路径取证后的现状＝主表 96 行（`math_analysis` / `book_ref=mathanalysis-b05` 的两级目录树 95 行 + 1 条已确认 point）+ detail 表 1 行（已提升）+ 学习课程行 `lc-b358f633aac1`（名「高等数学 M6」）。10-03 那批含错字章名的演示行在本轮 DROP 重建前已备份 `logs/kp_backup.json`；重放 `PUT /outline` 即整树覆写（R9 同名复用 `kp_id`），不必删表。生产 `qed` 库本轮零操作。

## 验证与验收

- 各判据的验收手段（判据正文见 todo 行 `ARCH-027-M6` 的「成功标准」列）：
  S1/S2＝`tests/contract` + `tests/test_learn_knowledge.py` 定向 + `tocParse` vitest 夹具；
  S3＝8903 浏览器实测（qed-frontend-check，真实 b05 数据）；S4＝星图与课程知识点页回归用例；
  S5＝端点错误码契约清单；S6＝文档门禁（`test_design_documents.py` / `test_code_document_mapping.py`）。
- 隔离铁律不变：默认测试不写运行数据库、不访问公网、不要求 API key；层级与页范围用例走内存 store。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

设计稿阶段：删除本文件不影响代码与测试。实施阶段：两表按裁决 ⑥ 可 DROP 重建，界面与端点改动
按各自提交独立回滚；outline 行删除不影响 point 行（未归档池语义兜住）。

## 关闭与归档

关闭条件＝S1~S6 达成且登记表无在途条目（W1 若作为独立前置先行收口，需在其条目行内注明去处），
由用户裁决收口；关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-027-M6 行。
LLM 一键生成（裁决 ⑤ 后置）与学习进度/掌握态（主链 M-3）**不在本行判据内**，关闭时以指针移交，
不留待做项。

- **2026-10-05 收口（用户裁决关闭，关闭结果 Achieved）**：S1~S6 全达成（S3 本轮真机达成）、登记表 W1~W6 无在途条目。
  本壳 Retain 归档 `docs/history/plans/2026-10/`，todo 移除 ARCH-027-M6 行并写入 `completed.md`；DEFECT-010/011 在本壳「缺陷登记」行内关闭（回归测试绿即达成，不另立 todo 行）。
  以指针移交、不留待做项：LLM 一键生成叙述（裁决 ⑤ 后置，前置＝ARCH-027-M3 行 S4 真机冒烟）、学习进度与掌握态（主链 M-3）、生产 `qed` 库的 v2 DDL 与索引变更（D 类转人工，随发布批次）。
