# 学习设计轮 M2·练习与复习（出题·间隔复习·错题本）（practice-review）

状态：Completed
任务类型：B
最后更新：2026-10-09
关联 ADR：无新增（重划切分由用户裁决 2026-09-23：掌握门与判分入主链，出题/复习/错题本剥离为本模块）
关联设计：[api-contracts.md](../../../architecture/api-contracts.md)（练习域端点契约承接位，§⑥ 练习域 8 端点已登记）、
[database-design.md](../../../architecture/database-design.md)（`qed_learn_*` 学习表族节，练习域三表承接位）、
[llm-gateway.md](../../../design/llm-gateway.md)（M3 适配层：结构化 JSON 调用与一次 repair 的地基，v2 生成形态用）、
[M6 壳（已归档）](../2026-10/2026-10-01-toc-knowledge-tree-and-learn-workbench.md)（知识点两表 v2、`tocParse` 判例与三栏工作台＝本模块的输入面与 UI 落点）
关联 Tracker：docs/trackers/todo.md（ARCH-027-M2 任务行；判分与掌握门状态机见 [学习设计轮主链壳](../../../plans/2026-09-22-learning-design-mainline.md) M-3）
归档判定：Retain（滚动记录，模块收口时按当时里程碑归档 history/plans/）

> 本壳是学习设计轮 **M2 模块**（课后练习面：题源与出题 + 间隔复习 + 错题本）的唯一固定滚动记录，
> 承载原 W4 拆出的出题/复习部分（判定表 L3/L6）。**判分内核与掌握门不在本壳**（主链 M-3，
> 单一事实源）；本模块消费其门输出与判分规则，只拥有「题从哪来、何时复、错在哪」三件事。
> 排期范围＝仅根仓库（用户裁决 2026-09-22）。
> **2026-10-03 起本壳是练习域契约设计稿的载体**，本轮只出设计稿、不动码与 architecture 面（裁决 ④）。
> **v1＝抽取式题源**（现成习题集与教材课后习题直接入库，裁决 ⑥）；**v2＝生成式出题**
> （两段式·服务端装配 LLM 管线，裁决 ②）分期保留设计，不在 v1 实施。

## 目标与成功标准

**目标**：为学习链路供给 quiz/flashcard 题目源，并让错题与知识点按间隔节律回流复习。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../../../trackers/todo.md)
`ARCH-027-M2` 行的「成功标准」列，本壳不复制判据条目；判据的验证手段见「验证与验收」节，
执行进展与证据见「过程与证据」节。原 T1~T3 编号由行内 S1~S3 按序承接（分别对应工作项
P-1、P-3、P-4）。**行内 S1 的「三向位 Explore/Plan/Verify loop」与 S3 的「best-effort upsert」
两处措辞已被裁决 ②③ 与缝 6 改判**，属成功标准冻结项，改判需用户批复（待裁点 R-A/R-B）。
**2026-10-03 用户批复「按照你的推荐确认」⇒ R-A/R-B 改判成立，台账行 S1/S3 已按新口径重写**
（原措辞作废，见「裁决登记」末与「过程与证据」）。

## 裁决登记（2026-10-03，用户）

| # | 裁决 | 采纳形态 |
| --- | --- | --- |
| ① | 题库/复习/答题表**新挂 `qed_learn_*` 族** | 落 MySQL 元数据库（共享 `qed` 库；开发侧 8900＝`qed_test`）；所有权 QED-Engine，根侧幂等建表（判例 `qed_llm_calls` / `services/learn/base.py`），**不引入根 Alembic**；8901/8902 不读；生产库 DDL 属 D 类转人工，随发布批次 |
| ② | 出题管线（v2 生成形态）＝**两段式·服务端装配**，放弃工具回环 | 段 1 出「选料与知识点分配 JSON」，服务端据此装配，段 2 逐题出严格 JSON + 每题最多一次 repair；**不引入文本工具协议**（与 2026-09-29 M3「A-2 整块后置、v1 走纯结构化 JSON」一致），DeepTutor Explore 工具段（`agents/question/pipeline.py:619-703`，最多 8 轮 + 每次召回额外压缩调用）不移植 |
| ③ | 本契约稿**连带写 M-3 的判分接口缝** | 「M-3 判分接口缝」节定缝不定规则；规则正文唯一事实源仍在主链 M-3（ADR 0022） |
| ④ | **本轮只出设计稿** | 纯文档批次：只改本壳；`api-contracts.md`/`database-design.md`/`code-map.md`/`frontend-architecture.md` 四处同步与 DDL/端点实施，等待裁点批复并发令「开始执行」后再做 |
| ⑤ | 输入面按 M5/M6 已交付现实走 | 输入＝知识点主表 `point` 行（`type` 四分类、`anchors`/`source_ref`）+ 人工页窗 + 8900 门面既有解析产物 blocks；**不等主链 M-2 编译产物** |
| ⑥ | **题源＝已有题库**：教材课后习题 + 已下载习题集，直接用现成的 | v1 改为**抽取式**（从解析产物 blocks 行法切题 → 人工确认 → 入题库），**不烧模型、同步返回**；LLM 生成（裁决 ② 形态）降为 v2 分期，协议设计保留 |
| ⑦ | **表能少最好**：按判据重新收敛，作业表不建 | v1 三表（题库 + 答题事实 + 复习调度）；**取消 `qed_learn_gen_job`**（抽取同步化，批次用 `question.gen_batch` 字符串整批核销）；预留**一张通用异步作业表 `qed_learn_job`** 承担所有线的杂项批次（v1 不建，触发条件见「杂项承载纪律」） |
| ⑧ | 复习调度**双粒度**（题/卡 + 知识点） | 保留 `qed_learn_review_task`（`target_kind` ∈ question/kp），3 表成立 |
| ⑨ | **无答案题不阻塞入库** | `answer_source=none` 时 `kind` 强制 `flashcard` 且只走自评（`method=self`），不进判分与选择题队列；人工经 `PATCH /learn/questions/{id}` 补 `expected_answer` 后升级为 quiz |

## 判表判据（本壳的收敛依据，J1~J5）

| # | 判据 | 不满足时的处置 |
| --- | --- | --- |
| J1 | 该信息是否有**必须被 `WHERE/ORDER BY/JOIN` 的谓词**（到期、未解决、按课程聚合、按知识点取近因序列） | 只读不筛的进 JSON 列（`meta`/`params`/`source_ref`），不建列不建表 |
| J2 | 一行是否= 一个**独立对象**（独立生命周期与唯一键） | 与已有表同生命周期同粒度 → 并列为该表的列或行 |
| J3 | **写入者与事务**是否不同族（机器判分写 / 人工位 / 一次性快照） | 同事务同写者 → 并表 |
| J4 | **换代要不要保留**（重编译、重导入、解析版本切换会不会抹掉它） | 会被抹的必须与不可被抹的分表（M-1 三表判例） |
| J5 | 能否**读时派生** | 能派生的不落表不落列（`qed_learn_unit_progress` 判例；错题本因此不是表） |

**跑一遍的结果**（为什么恰好是三张）：

| 表 | 判据 | 处置 |
| --- | --- | --- |
| `qed_learn_question` | J1 全中（按课程/kp/kind 过滤、`stem_hash` 去重键） | **建** |
| `qed_learn_attempt` | J1+J3+J4（逐次作答序列＝M-3 近因加权输入，不可压缩；判分事务与人工位分离；重导入不丢） | **建** |
| `qed_learn_review_task` | 裁决 ⑧ 双粒度：`target_kind=kp` 时一个知识点一行，与题库表**不同粒度**（一 kp 对多题）→ J2 成立 | **建**（题粒度行的调度列本可并进 question，双粒度下不能并） |
| `qed_learn_gen_job` | v1 抽取式同步（不烧模型）→ J1/J2 均不成立 | **不建**，并入通用作业表面向 v2 |
| 错题本 | J5（题目 + 最近作答 + `resolved=false` 谓词的派生查询） | **不是表** |
| 知识点级掌握态 | J5（由 attempt 实时算，缝 4） | **不在本壳建表**（M-3 进度行扩列归主链） |

## 范围与非目标

**范围（v1）**：练习域三表契约 + 抽取式题源管线（纯函数切题 + 人工确认面板 + 批量入库）+
`answer_source` 六态口径 + 间隔复习双粒度调度规格（纯函数 + MySQL 持久态）+ 错题本查询端点 +
M-3 判分接口缝 + 8903 练习面与错题本落点。

**范围（v2，设计保留不实施）**：两段式 LLM 生成管线（裁决 ②）、通用异步作业表 `qed_learn_job`、
mimic 试卷仿题（P-5）。

**非目标**：判分/门槛/推进状态机**规则本体**（主链 M-3，只定接口缝）、
界面实施（本壳只定落点与口径，裁决 ④）、LLM 降级开关本体（M3）、
检索式出题与自主找料工具面（依赖 ARCH-025 线与 M3 的 A-2，均不启用）、
会话式练习的 pending 回合状态机（缝 5：不引入）、
题目向 `qed_learn_unit.payload` 的写回（M-2 编译线落地时由其自行引用 `question_ids`，本壳不代写 unit 行）。

## 前置条件

1. **原前置①改判**：壳 0923 版写「前置＝主链 M-1 表契约（题目/题库/复习计划表挂 qed_* 族）」，
   经 2026-10-03 复核**落空**——M-1 冻结的是 `qed_learn_course`/`_unit`/`_unit_progress`
   （`services/learn/base.py:21-72`），quiz/flashcard 只是 `qed_learn_unit` 的 `type` 值与 `payload`
   （「不含判分」），无题目/题库/复习表。⇒ 练习域表契约**由本壳自持**，M-1 三表不动。
2. **题源分类器不是 `kind`**（取证 2026-10-03）：`qt_books.kind` 闭集只有 `book`/`paper`
   （`QED-Tracker/src/qed_tracker/db/models.py:56-63`，注释明写 `book=教材/习题集/题解等书本`），
   习题集靠 **`qt_books.roles` JSON 数组**（同文件 :212-215，值域 `textbook/exercises/solutions`）。
   ⇒ JSON 列不能进唯一键与索引谓词，「取本课程习题集书目」只能在 8901 侧或应用层过滤（待裁点 R-10）。
3. **8900 无带课程过滤的书目端点**：`GET /api/v1/books`（`api/axiom.py:138-141`）读 `af_books`，
   **不暴露 `course_id`/`roles` 参数**；带过滤的 `GET /books?course_id=` 只在 8901（`api/main.py:1390`）
   且未透传。⇒ 二选一：根侧补一条透传（不改子项目），或沿用 M6 判例前端全量拉回过滤（R-10）。
4. **解析产物无「习题块/答案块」**：`BlockType` 10 值闭集
   `heading/paragraph/formula/table/image/list/caption/header/footer/page_number`
   （`Axiom-Flow/src/axiom_flow/schemas.py:46-58`），页文本不在库而在盘
   （`versions/<job_id>/pages/pXXXX.blocks.json`，经 `GET /api/v1/books/{book_id}/pages/{page_no}`
   门面读，`api/axiom.py:191-192`）⇒ 题面切分只能做 `tocParse` 式**纯函数 + 人工确认面板**。
5. **题源真机可用性已核（2026-10-07，经 8900 只读 HTTP 门面，不需 SQL）**：书库 25 本中 7 本
   `roles` 含 exercises/solutions（`mathanalysis-b07/b11/b15/b16/b17`、`linearalgebra-b06`、`ode-b05`），
   但**全部无解析产物**（`active_job_id=None`、`pages_done=0`）；有产物的只有 `mathanalysis-b05`
   （317/317，textbook）与 `linearalgebra-b01`（3 页）。⇒ v1 题源按预案**退回教材课后习题单源**；
   习题集的解析属人工批准的数据窗口（见「遗留与移交」），不在本行判据内。
   同批另核得两处数据面事实：`qt_books.course_id` 现网全空、`af_books.parse_status` 恒 `pending`
   （题源选择面与可抽判据据此改走 8900 侧归属回退 + `parsed_pages`）。
6. 真实出题调用（v2）依赖 M3 行 S4 真机冒烟（A-5/A-6 两流未完）；v1 抽取式**不吃模型**，
   因此 P-1/P-2/P-3/P-4 全部可在 M3 收口前实施——这是 ⑥ 改判带来的排期解放。
7. M5/M6 两表 v2（`node_kind/type/parent_kp_id`）已实施（2026-10-03），题目按 `point` 行挂 `kp_id`。
8. `qed_learn_*` 三表在 `qed_test` 由 M6 W1 懒挂载自动建（真机待人工批准）；练习域三表随本模块
   实施同批懒挂载（判例 DEFECT-009：首个请求建表挂载、失败只锁 60s 短窗、启动路径不碰 MySQL）。
9. 逐条实施排期经用户确认（本壳只立项与设计登记）。

## 练习域三表契约（v1 设计稿，2026-10-03）

> 收缩原则＝上一节 J1~J5。DDL 落点（待裁点 R-8）：新建 `backend/qed_engine/services/learn/practice.py`
> 与 `practice_memory.py`，与 `knowledge.py` 同层，各持 `CREATE_TABLE_SQL` + `ensure_tables()`。

**表 1 `qed_learn_question`（题库；一行=一道题或一张卡）**

```sql
CREATE TABLE IF NOT EXISTS qed_learn_question (
  question_id VARCHAR(64) PRIMARY KEY COMMENT '题目 ID（服务端生成 q-<hex12>）',
  course_id VARCHAR(64) NOT NULL COMMENT '课程坐标（逻辑引用 qed_course，与知识点主表/星图/M6 工作台同源）',
  course_label VARCHAR(255) DEFAULT '' COMMENT '课程名快照',
  learn_course_id VARCHAR(64) COMMENT '所属学习课程（逻辑引用 qed_learn_course；非编译链路出题=NULL）',
  unit_id VARCHAR(64) COMMENT '关联块（逻辑引用 qed_learn_unit；M-2 编译接线后启用，v1 可空）',
  kp_id VARCHAR(64) COMMENT '归属细知识点（逻辑引用 qed_knowledge_point 的 point 行；NULL=未归档题）',
  kind VARCHAR(16) NOT NULL DEFAULT 'quiz' COMMENT '闭集 quiz=判分题 / flashcard=记忆卡（自评，不判分；裁决 ⑨：answer_source=none 时强制本值）',
  question_type VARCHAR(16) COMMENT 'quiz 行判分闭集 choice/short/open（与 M-3 三类一一对应）；flashcard 行 NULL',
  stem TEXT NOT NULL COMMENT '题干（LaTeX/Markdown 原文，按 M1 UI-1 渲染基线回原样；flashcard 存正面）',
  stem_hash CHAR(64) NOT NULL COMMENT '去重键（题干规范化：全角转半角+空白折叠+小写后 sha256），重复入库幂等命中',
  options JSON COMMENT 'choice 题选项 [{label,body}]，label 恰 A/B/C/D；其余 NULL',
  answer_back MEDIUMTEXT COMMENT 'flashcard 背面（quiz 行 NULL；与 expected_answer 分列，判分路径不混用）',
  expected_answer TEXT COMMENT '服务端判分依据（quiz 行必填，题面下发响应剔除本列，缝 2）；flashcard 行 NULL',
  keywords JSON COMMENT 'open 题关键词列表（命中比判分依据；choice/short 为 NULL）',
  explanation TEXT COMMENT '答案解析（判分后才回传）',
  difficulty VARCHAR(16) NOT NULL DEFAULT 'medium' COMMENT '闭集 easy/medium/hard',
  kp_type VARCHAR(16) COMMENT '知识点四分类**快照** memory/concept/procedure/design（间隔序列依据；主表 type 后改不回溯，R-6）',
  source_kind VARCHAR(16) NOT NULL DEFAULT 'exercise_book' COMMENT '题源闭集 exercise_book=习题集 / textbook_chapter=教材课后习题 / solutions_book=题解书 / manual=人工录入 / generated=v2 生成',
  book_ref VARCHAR(64) NOT NULL DEFAULT '' COMMENT '来源书（qt_books.book_id，书目级稳定，判例 M6 裁决 R10）',
  source_ref JSON COMMENT '溯源 {page,block_indexes,answer_page?,section?}（页序=PDF 页序；题面所在页与答案所在页分开记）',
  answer_source VARCHAR(16) NOT NULL DEFAULT 'none' COMMENT '答案来源闭集 same_page=同页 / solution_section=书内答案节 / sibling_book=关联题解书（qt_knowledge.textbook_ref↔exercise_ref 配对）/ manual=人工录入 / llm=v2 生成 / none=无答案（⑨：强制 flashcard 自评）',
  gen_batch VARCHAR(64) NOT NULL DEFAULT '' COMMENT '入库批次（抽取或生成一次作业一批，整批可核销；v1 取代作业表）',
  model_ref VARCHAR(128) NOT NULL DEFAULT '' COMMENT '产出者标识（manual/extract/模型名；不含密钥）',
  meta JSON COMMENT '杂项 {issues:[…],angle,extraction:{rule,confidence},plan_index}（J1：只读不筛的字段一律进本列）',
  retired TINYINT(1) NOT NULL DEFAULT 0 COMMENT '坏题软删位（人工写，机器不写 1；作答复历保留，R-4）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  UNIQUE KEY uq_question_course_hash (course_id, stem_hash),
  KEY idx_question_course (course_id, kind, retired),
  KEY idx_question_kp (kp_id),
  KEY idx_question_book (book_ref),
  KEY idx_question_batch (gen_batch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='练习题库（根自建；一行=一道题/一张卡，expected_answer 只存服务端，所有权 QED-Engine）';
```

**表 2 `qed_learn_attempt`（答题事实；一行=一次作答）**

```sql
CREATE TABLE IF NOT EXISTS qed_learn_attempt (
  attempt_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '行 ID（自增主键，时序即事实序）',
  question_id VARCHAR(64) NOT NULL COMMENT '题目（逻辑引用 qed_learn_question）',
  course_id VARCHAR(64) NOT NULL COMMENT '冗余课程坐标（错题本与统计按课程聚合）',
  kp_id VARCHAR(64) COMMENT '冗余知识点（M-3 掌握门按 kp 取近因序列、复习错题优先级判定）',
  origin VARCHAR(16) NOT NULL DEFAULT 'new' COMMENT '闭集 new=首练 / review=复习队列 / manual=人工重做',
  review_date DATETIME COMMENT 'origin=review 时=当次 due_at（调度回写的幂等依据）',
  user_answer TEXT NOT NULL COMMENT '学习者作答原文（不清洗不截断，判分函数内部规范化）',
  is_correct TINYINT(1) NOT NULL DEFAULT 0 COMMENT '判分结果（**服务端确定性判分写入，不信任客户端**，缝 1；自评卡由 self_result 置位）',
  method VARCHAR(16) NOT NULL DEFAULT 'deterministic' COMMENT '闭集 deterministic/llm/self（open 题 LLM 批改与 flashcard 自评）',
  judge_note VARCHAR(1000) DEFAULT '' COMMENT '判分/批改说明（method=llm 时存模型意见；不含密钥）',
  score_trend VARCHAR(16) NOT NULL DEFAULT 'new' COMMENT '闭集 new/improved/declined/unchanged（该题先前无行=new，同=unchanged，翻转=improved/declined）',
  resolved TINYINT(1) NOT NULL DEFAULT 0 COMMENT '已解决位：本次对=1，历史对而过本次错=0，其余保留旧值（DeepTutor CASE 语义直译）',
  bookmarked TINYINT(1) NOT NULL DEFAULT 0 COMMENT '错题本收藏（人工位，机器不写）',
  answered_at DATETIME NOT NULL COMMENT 'UTC 作答时间（近因加权排序键）',
  UNIQUE KEY uq_attempt_idem (question_id, review_date, origin),
  KEY idx_attempt_question (question_id, answered_at),
  KEY idx_attempt_kp (kp_id, answered_at),
  KEY idx_attempt_course (course_id, answered_at),
  KEY idx_attempt_open (course_id, resolved, is_correct)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='答题事实明细（M-3 掌握门的唯一数据源；全量保留逐次行不做只留终态的合并，缝 4）';
```

**表 3 `qed_learn_review_task`（复习调度态；一行=一个复习对象，裁决 ⑧ 双粒度）**

```sql
CREATE TABLE IF NOT EXISTS qed_learn_review_task (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  target_kind VARCHAR(16) NOT NULL COMMENT '闭集 question=具体题/卡（错题重练与闪卡节律）/ kp=知识点整体节律（v2 按知识点推题时用）',
  target_id VARCHAR(64) NOT NULL COMMENT 'question_id 或 kp_id',
  course_id VARCHAR(64) NOT NULL COMMENT '课程坐标（到期队列按课程取）',
  kp_type VARCHAR(16) NOT NULL COMMENT '间隔序列依据（kp 目标取主表 type，question 目标取该行 kp_type 快照；无分类回落 memory 序列并记 meta）',
  interval_index TINYINT NOT NULL DEFAULT 0 COMMENT '当前档位（序列下标）',
  consecutive_correct TINYINT NOT NULL DEFAULT 0 COMMENT '连对计数（≥2 跳两档后清零）',
  consecutive_wrong TINYINT NOT NULL DEFAULT 0 COMMENT '连错计数（≥2 清零，档位已回退）',
  due_at DATETIME NOT NULL COMMENT 'UTC 到期时间（S2「重启不丢进度」的核验点）',
  status VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT '闭集 active/archived（知识点删除/题 retired → 归档不删行）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  UNIQUE KEY uq_review_target (target_kind, target_id),
  KEY idx_review_due (course_id, status, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='间隔复习调度态（L3 的 MySQL 化：从 state_json blob 列化，双粒度，重启不丢；所有权 QED-Engine）';
```

- **优先级不落列**（J5）：「错题最高优先」由 `qed_learn_attempt` 的 `is_correct=0 AND resolved=0`
  实时 EXISTS 派生，不在本表存 `priority` 列（对齐 `qed_learn_unit_progress`「派生重算非累加」判例）。
- **任务产生口径**：`question` 粒度行在题目**入库时**建（`due_at=now`，立即进当日队列）；
  `kp` 粒度行在该 `point` 行首次被作答时建。重复入库不重复建（唯一键幂等）。

**杂项承载纪律（裁决 ⑦ 的落点）**

| 载体 | 承载 | 说明 |
| --- | --- | --- |
| `question.meta` / `source_ref` / `attempt.judge_note` | 抽取规则与置信、校验残余问题、答案页、批改意见 | J1：只读不筛的不建列 |
| `question.gen_batch` | 批次整批核销 | v1 用它取代作业表 |
| **`qed_learn_job`（预留，v1 不建）** | 所有线的**异步批次杂项**：`kind` 闭集 `question_gen`（v2 两段式出题）/ `kp_narration`（知识点叙述生成）/ `mimic`（P-5 仿题）/ `import`（书目批量抽取）；列骨架 `job_id/kind/scope JSON/params JSON/status/stage/done/total/failure_count/notices JSON/result_refs JSON` | **建表触发条件写死**：一旦出现「分钟级不可同步返回」或「需断点续跑」的消费面（即 v2 生成形态实施那一轮）即建**这一张**，此后各线复用，不再逐线加作业表 |

**MySQL 化差异（DeepTutor SQLite → 本设计，逐条，S2 判据落点）**

| DeepTutor 现状 | 不能直译的原因 | 本设计处置 |
| --- | --- | --- |
| `progress.repetition_states` 存 `state_json` blob（`learning/storage.py:377-461`） | blob 里的调度态不可查询不可索引，「重启不丢进度」无法用 SQL 核验 | 列化为 `qed_learn_review_task`，索引 `(course_id, status, due_at)` |
| `UNIQUE ... WHERE status IN (...)` 偏唯一索引（`storage.py:413-415`） | MySQL 无 partial unique index | **随缝 5 一起不移植**（无 pending interaction 即无此约束需求） |
| `INSERT ... ON CONFLICT(a,b,c) DO UPDATE` | 方言 | `ON DUPLICATE KEY UPDATE` + `VALUES()`；`resolved` CASE 翻转单条语句（不再复制 DeepTutor 为保图片列手写的两条重复分支） |
| `REAL` unix float、`INTEGER` 当 bool | 与 `qed_*` 族口径不一致 | `DATETIME`（UTC 无 tzinfo，判例 `knowledge.py:_now()`）+ `TINYINT(1)` |
| `notebook_entries` 单表混存题面+作答+趋势 | 一题多答会重复存题面、判分依据被作答行复制 | 拆 question（题面正本）+ attempt（作答事实），`score_trend/resolved` 留作答行 |
| 会话作用域 `UNIQUE(session_id,turn_id,question_id)` | 我们无 session/turn 体系（缝 5） | 改 `UNIQUE(question_id, review_date, origin)`：新题可重复练（无 `review_date` 时 MySQL 唯一键允许多 NULL，天然不拦），复习同日不重复计 |
| `asyncio.wait_for(5.0)` 吞异常 best-effort 双写（`tools.py:304-351`） | 三服务共享 MySQL，丢一次判分事实会**永久污染掌握门输入** | 缝 6 改同事务；台账行 S3「best-effort」措辞由此改判（R-A） |
| `time.time()` 直接取时钟（`scheduler.py:45-70`） | P-3 纯函数单测要求时钟可注入 | `schedule_next(state, correct, now)` 显式传 `now`，调度器不读 DB/时钟 |

## 抽取式题源管线规格（v1，裁决 ⑥）

形态＝与 M6 `tocParse.ts` **完全同判例**：前端纯函数 + 人工确认面板 + 确认后批量入库，
不引 LLM、不等 M-2、不烧模型。

**输入**：题源书（按 `qt_books.roles` 过滤 `exercises`/`solutions`，或教材 `textbook` 的章末节）+
页范围（章的 `source_ref.page_start..page_end`，M6 outline 行已有）→ 逐页
`GET /api/v1/books/{book_id}/pages/{page_no}` 取 `blocks[]`。

**切题规则（纯函数，`web-ui/src/exerciseParse.ts`，夹具用真实习题集页文本）**

1. **题号锚**：`^\s*(\d+(\.\d+)*)[、.． 　)]` 起新题；连续行无题号 → 粘连上一题（同一题干的多行/公式）。
2. **节题白名单**：命中 `习题| exercises |课后| problems |补充习题` 视为题区开始；命中
   `答案与提示| 习题答案 | solutions |答` 视为答案区开始（答案区的行**不再当题面**，转 `answer_source` 判定）。
3. **公式保真**：`formula` 块整块原样入 `stem`（不重排、不降级为文本），`$…$`/`$$…$$` 定界符
   维持 BUGFIX-011 防御口径；`table`/`image` 块按原类型入 `options` 或 `meta.attachments`。
4. **子题**：`(1)(2)` 或 `①②` 起子题，同题 `stem` 内保留换行，不拆成多题（判分要整题）。
5. **选项识别**：行内 `A．|A.|A、` 四项齐 → `question_type=choice` + `options`；不齐则保持 `short/open`。
6. **答案配对**（`answer_source` 判定，按序命中即止）：同页有「答：/解：」→ `same_page`；
   书内答案节按题号命中 → `solution_section`（`source_ref.answer_page` 记位）；
   同教程套关联题解书（`qt_knowledge.textbook_ref ↔ exercise_ref` 配对）→ `sibling_book`；
   皆不中 → **`none`，`kind` 强制 `flashcard`（裁决 ⑨）**。
7. **判分型回落**：答案 ≤30 字符且形如单一表达式/数值 → `short`；答案含多个可枚举关键词 → `open` +
   `keywords`；纯论述/证明 → `open` 且 `keywords` 取答案里的关键步骤词（人工确认面板可改）。
8. **未识别行进「未识别」列表**，面板里可见可改可删——**不静默丢弃**（M6 目录解析第 4 条同口径）。
9. 输出 `{drafts:[{stem, options?, expected_answer?, keywords?, question_type, kind, page,
   block_indexes, answer_source, confidence}], unrecognized:[…], notices:[…]}`；
   `drafts` 不落库，人工确认后 `POST /learn/questions` 批量入库（`stem_hash` 幂等跳重）。

**v2 生成形态（两段式·服务端装配，裁决 ② 保留设计，本轮不实施）**

- 调用面＝`gateway.call_text(..., response_format="json")` → `local_adapt.parse_json_reply`
  （直解→围栏→最外层切片+宽松修复，一次 `repair` 回调）→ `scrub_thinking`；受 `QED_LLM_LOCAL_ADAPT`
  开关控制可整体旁路。**不经工具回环、不注入文本工具协议**。
- **段 1 assign**（每批 1 次）：输入＝已确认 `point` 行（`kp_id/name/type/summary`）+ 页窗 blocks
  （**每知识点 ≤800 字符、每页窗 ≤1500 字符、总 ≤3200 字符**，对齐判定表 L5 的每回合状态摘要口径）+
  既有题干摘要。输出严格 JSON `{analysis, materials:[{kp_id,page,block_indexes,use}],
  plans:[{kp_id,question_type,difficulty,angle}]}`；校验＝`kp_id` 越集丢弃记 `notices`、
  页/块越界钳位、`plans` 数量≠quota 按 quota 截断或补齐（补齐走知识点循环，不二次调模型）、
  类型/难度非闭集回落 `short`/`medium`；`plans` 空 ⇒ 作业 `failed` + `plan_unusable`（DeepTutor 判例）。
- **段 2 quiz**（每题 1 次 + 最多 1 次 repair）：输入＝单条 plan + 精确装配 blocks + 同 `kp_id` 既有题干
  （去重指令）。输出 `{kp_id,question_type,difficulty,stem,options,answer_back,expected_answer,keywords,explanation}`；
  残余问题**不丢题**，`correct_answer/explanation` 落 `"N/A"`、问题清单进 `meta.issues`，
  且缺 `expected_answer` 的题按 ⑨ 走 flashcard 自评、不进判分队列。
- 异步承载＝`POST /learn/questions/generate` **202** + 轮询，作业态落**通用 `qed_learn_job`**（建表触发条件即此）。
- 与 `qed_learn_unit` 的关系：块序列 `QUIZ×3 / FLASH_CARDS×5` 模板（判定表 L4）是 M-2 编译器产物形态，
  本模块只交回 `question_id`，**不代 M-2 写 unit 行**；M-2 落地后由 `unit.payload` 存
  `{question_ids:[…]}` 引用（避免题面双写）。P-2 的「块序列模板消费端」因此是 M-2 的接线项。

## REST 契约（练习域，`/api/v1/learn/*`，8900 自有域）

| 端点 | 语义 | 错误 |
| --- | --- | --- |
| `GET /learn/question-books` | 题源书目：按课程列 `qt_books` 且 `roles` 含 `exercises/solutions/textbook` → `{books:[{book_id,title,roles,parse_status,page_count}]}`（形态随 R-10 批复：根侧透传 8901 过滤 or 全量拉回应用层过滤） | 404（课程无坐标行）；503（目录不可达） |
| `POST /learn/questions` | 人工确认后**批量入库** `{course_id, gen_batch?, questions:[{stem,kind,question_type,options,expected_answer,keywords,explanation,difficulty,kp_id?,source_kind,book_ref,source_ref,answer_source,kp_type?}]≥1}` → `{created,skipped_duplicates,questions}`；`stem_hash` 幂等跳重；`answer_source=none` 且 `kind=quiz` ⇒ 拒（⑨） | 422（stem 空、kind/question_type/source_kind/answer_source 非闭集、quiz 缺 expected_answer、choice 选项非 A-D、open 缺 keywords）；503 |
| `GET /learn/questions` | 题库浏览 `?course=&kp=&kind=&question_type=&source_kind=&book=&retired=&limit=50&offset=0` → `{questions,total}`；**投影剔除 `expected_answer`/`keywords`/`explanation`** | 422（闭集非法、limit 越界）；503 |
| `PATCH /learn/questions/{question_id}` | 人工面白名单 `{kind,question_type,stem,options,expected_answer,keywords,explanation,difficulty,kp_id,answer_source,retired}`（extra 422）→ 题行；**⑨ 的升级路径＝补 `expected_answer` + `answer_source=manual` + `kind=quiz`**；`gen_batch/model_ref` 不在白名单（产出事实不可改） | 404；422（quiz 无 expected_answer、kind 与 answer_source 冲突） |
| `POST /learn/attempts` | 提交作答 `{question_id,user_answer,origin,review_date?,self_result?}` → **同事务**：M-3 判分 + 作答行 + `score_trend/resolved` + `schedule_next` 回写 → `{attempt_id,is_correct,method,expected_answer,explanation,judge_note,review:{next_due_at,interval_index}}`（判分后才回传答案，缝 2） | 422（user_answer 空、origin 非闭集、flashcard 缺 `self_result`）；404（题不存在或已 retired）；409（kind 与 origin 不匹配） |
| `GET /learn/review/due` | 到期队列（纯函数调度器 + 持久态）`?course=&max_tasks=5` → `{tasks:[{target_kind,target_id,kp_type,due_at,priority,reason:wrong|type,overdue_days}]}` | 422（max_tasks 越界）；503 |
| `GET /learn/mistakes` | 错题本（派生，不建表）`?course=&kp=&resolved=false&bookmarked=&trend=&limit=50&offset=0` → `{items:[{题目投影 + 最近作答 + is_correct/resolved/score_trend/bookmarked + attempt_count + wrong_count}],total,stats:{total,wrong,unresolved,bookmarked,due_today}}` | 422（trend 非闭集）；503 |
| `PATCH /learn/attempts/{attempt_id}` | 错题本人工位白名单 `{bookmarked,resolved}`（extra 422）→ 作答行；**`is_correct/method/score_trend` 不在白名单**（判分结果不可手改） | 404；422 |
| `POST /learn/questions/generate` | **（v2，本轮不实施）** 202 发起两段式出题作业 `{course_id,kp_ids?,page_windows?,quota:{quiz,flashcard},types?,difficulties?}`；同参 running 作业幂等复用 | 422；409；实施时随 `qed_learn_job` 建表 |

- 错误码与包络沿用主链 M-1 口径：404=实体不存在、422=闭集越界/限长/结构非法、409=状态机非法转移、
  202=异步作业、503=存储未挂载；detail 中文纯文本；响应不含密钥。8903 只连 8900（ADR 0007）。
- v1 端点数＝**8**（generate 归 v2）。新端点挂 `api/learn.py`（该文件端点数与 `code-map.md` 映射行随实施批同步，本轮不动）。
- **契约测试先行**：端点与错误码清单进 `tests/contract`，逐端点用例进新建 `tests/test_learn_practice.py`
  （内存 store 同形，判例 `knowledge_memory.py`，不写运行库）。

## 间隔复习调度规格（P-3，纯函数 + MySQL 持久态）

**间隔序列表**（天，DeepTutor `learning/scheduler.py:13-98` 逐值直译；`LEARNING_DEBUG` 秒级开关不移植，
改由注入时钟在单测里造时间）：

| `kp_type` | 间隔序列（天） | 优先级（升序，小者先出队） |
| --- | --- | --- |
| memory | `[0, 1, 3, 7, 14, 30, 60]` | 2 |
| concept | `[3, 7, 14, 30]` | 3 |
| procedure | `[3, 7, 14]` | 4 |
| design | `[14, 28]` | 5 |

**升降档（`schedule_next(state, correct, now)` 纯函数，无 DB 无时钟）**

- 答对：`consecutive_wrong=0`；`consecutive_correct += 1`；若 `>= 2` 则 `interval_index += 2` 并清零计数，
  否则 `+= 1`。
- 答错：`consecutive_correct = 0`；`interval_index = max(0, index - 1)`；`consecutive_wrong += 1`；
  若 `>= 2` 清零。
- 档位钳位 `0 <= index <= len(sequence)-1`；`due_at = now + sequence[index]` 天。
- flashcard 自评映射：`self_result=correct` → 答对分支，`again` → 答错分支（同一函数，无第二套语义）。

**队列构建（`build_review_queue`）**

- 取 `due_at <= now` 且 `status=active`；
- 优先级 = **1**（该 target 关联题目存在 `is_correct=0 AND resolved=0` 的作答行）否则按上表 `kp_type`
  优先级；排序 `(priority ASC, due_at ASC)`，`max_tasks` 默认 5；
- 到期出题（S2）：`GET /learn/review/due` 返回任务后，作答走 `POST /learn/attempts`
  （`origin=review` + `review_date`），判分同事务回写调度态。
- **v1 不做后台定时器**（设计默认）：8900 不给 learn 域引入常驻轮询单元，复习靠打开界面时拉队列；
  常驻提醒若需另批（挂 M1/M4 UI 线）。

## M-3 判分接口缝（本壳连带定；规则正文归主链，不在此复制）

| 缝 | 口径 | 归属 |
| --- | --- | --- |
| **缝 1 判分函数** | `services/learn/grading.py`（M-3 建模块，M2 调用）`grade(question_row, user_answer) -> {is_correct, method, note}`；**纯函数、无 LLM、无 DB**；阈值定档（L2 直译）：choice=去空白小写全等且 expected∈A-D；short=全等否则 `SequenceMatcher.ratio()>=0.85` **且 `len(expected)<=30`**；open=按 `[,;，；。\n]+` 切 expected 取命中比 `>=0.6`；未知 `question_type` → **False（不猜）**；`expected_answer` 为空 → False 且记 `meta.issues` | 规则本体＝M-3；调用与数据表＝M2 |
| **缝 2 expected_answer 归属** | 只存 `qed_learn_question.expected_answer`（服务端），**任何题面下发响应投影剔除** `expected_answer/keywords/explanation`（`GET /learn/questions`、`/learn/review/due`、练习卡）；仅 `POST /learn/attempts` 判分完成后的响应回传（DeepTutor `sensitive=True` + `public_pending_question` 同款语义）；判分不进模型 ⇒ 本地弱模型下判分结果稳定。**v1 抽取式的 `expected_answer` 来源＝书内答案（`answer_source` 前三态）或人工录入，绝不由模型作答** | M2 表与投影；语义与 M-3 共同冻结 |
| **缝 3 主观题 LLM 批改** | open 题关键词判 False 时**可选**二次 LLM 判（`method='llm'`，判题**不喂 RAG**，判例 L2）；v1 默认关闭、只走关键词（R-7）；调用走同一 `gateway.call_text` + M3 开关，`judge_note` 存意见 | 批改 prompt 与阈值＝M-3 |
| **缝 4 掌握门数据源** | M-3 双门槛（量化门近因加权正确率 ≥0.9 / 质性门 Feynman+`mastery_assess`）的输入序列＝**本壳 `qed_learn_attempt`**：近因权重 `(0.5,0.7,0.85,0.95,1.0)` 取该 `kp_id` 最近 5 次作答；防蒙对置信上限 `{1 次:0.5, 2 次:0.8}`。故本表**全量保留逐次行**，不做「只留终态」合并；`qed_learn_unit_progress` 扩列只承载掌握态结论 | 门规则＝M-3；事实存储＝M2（本壳是依赖方声明） |
| **缝 5 回合语义不移植** | DeepTutor「出题即结束回合、下回合先判分再 seed 裁决」+ pending interaction（`registered/awaiting_input/answered/graded/abandoned`、单活跃偏唯一索引）**不引入**：练习面是 REST 同步「提交即判即回」，无 pending 态、无 session/turn 体系。若 M-3 后续做会话式练习，另立 pending 表，不影响本壳三表 | 本壳（R-B 已批复：不移植） |
| **缝 6 错题写入事务** | 本壳 S3 的「best-effort upsert」改判为**同事务**：`POST /learn/attempts` 内「作答行 insert + `score_trend/resolved` 计算 + `schedule_next` 回写」一个 MySQL 事务，任一步失败整体回滚 500，不留半状态；`bookmarked/retired` 等人工位不进判分事务 | 本壳（措辞改判已批复 R-A，2026-10-03） |
| **缝 7 推进不由本壳写** | 题目与作答**不写** `unit.covered`、不写掌握门结论、不改推进游标（主链「进度游标禁止手改」裁决）；复习完成也不结课 | 主链 M-3 |

## 8903 练习面与错题本落点（口径，不含实施）

- **落点＝M6 三栏工作台**（`#/learn/c/:courseId`，M6 裁决 ①）：
  - **中栏**章正文下方「练习」区＝题源选择（书 + 页范围）→ 抽取预览 → **确认面板**（drafts/未识别行/
    答案来源可改）→ 入库 → 题卡作答 → `POST /learn/attempts` 判分后展开 `explanation`；
  - **右栏**加 tab「本章练习」：候选（既有）/ 错题 / 到期复习三段，按 `parent_kp_id` 过滤；
  - 题干/选项/解析渲染复用 `MarkdownView.tsx` + KaTeX，**M1 UI-1 渲染基线判据同样适用**
    （公式回原样、`$$$` 双定界符防御 BUGFIX-011 维持）。
- **错题本**：原 M1 UI-4「错题本页面（独立页面壳）」与本落点冲突 ⇒ **R-9 已批复（2026-10-03）**：
  错题本**不独立成页**，作为工作台右栏一节；M1 UI-4 判据不改写，落点指针随前端批更新
  ⇒ **2026-10-07 前端批落点**：`#/learn/c/:courseId` 右栏 Tabs 第二页签「本章练习」内的
  「错题本」段（`components/practice/ChapterPractice.tsx`），**无独立路由、无独立页面壳**。
- **复习入口**：星图（`#/knowledge`）课程节点加「今日复习 N 条」（`GET /learn/review/due?course=` 聚合）
  ⇒ **2026-10-07 前端批落点**：条数写进**课程框悬停提示行**（0 条不写，画布不新增可点元素，
  与星图「信息面收窄」既有裁决对齐）；**可点入口**＝课程知识点页（`#/knowledge/c/:courseId`）
  页头「今日复习 N 条」按钮，>0 才渲染，点击进学习工作台。
- flashcard 面：卡片翻转 + 自评（记得/重来）→ `POST /learn/attempts`（`method=self`，无判分）。

## 待裁点清单（本轮出稿，请批复后再实施）

| # | 议题 | 我的推荐 | 代价 |
| --- | --- | --- | --- |
| R-4 | 题目质量位：软删 `retired`（出题即用，人工标坏题）vs 走 M5 式候选池（`confirmed` 才可用） | **`retired` 软删** | 候选池口径下练习面在人工核销前恒空；代价＝坏题被标记前可能被练到 |
| R-6 | `kp_type` 快照 vs 实时读主表 `type` | **快照**（入库时拷一次） | 主表改分类后历史题不随之一档（可接受：重算全队列需另批） |
| R-7 | open 题 LLM 批改是否在 v1 启用 | **关闭**（只关键词命中） | 弱模型判题不稳定；启用需 M-3 出 prompt 与阈值 |
| R-8 | DDL 与存储落点：新建 `services/learn/practice.py` + `practice_memory.py` vs 并入 `base.py` 的 `CREATE_TABLE_SQL` | **新模块**（三表已超 learn 三表基座职责边界） | `code-map.md` 需增 2 行，契约映射测试随之 |
| R-9 | 练习面 UI 落点（M6 中栏练习区 + 右栏 tab），错题本是否独立页 | **不独立**，随 M6 工作台 | 与 M1 UI-4 原口径需改判指针 |
| **R-10** | 题源书目获取形态：根侧新增 `GET /learn/question-books` 透传 8901 的 `GET /books?course_id=`（含 `roles` 过滤），还是沿用 M6 判例「前端全量拉回再过滤」 | **透传**（`roles` 过滤在服务端做，前端不重复一遍筛选逻辑，且 8901 已具备能力，根侧只加一层门面，不改子项目） | 根侧多一个端点；`GET /api/v1/books` 现有语义（读 `af_books`）与本端点（读 `qt_books`）不同族，需在 `api-contracts.md` 写清以免误用 |
| **R-11** | 关联题解书（`answer_source=sibling_book`）是否纳入 v1 答案配对 | **纳入**（`qt_knowledge.textbook_ref ↔ exercise_ref` 是现成配对数据，数分有 b11 吉米多维奇题解） | 对方口径矛盾需报备：`BookRole` 枚举里 `solutions` 已被 QED-034 退役，但代码白名单 `_ROLES_VALUES` 仍含 `solutions`（`application/knowledge_import.py:169`）⇒ v1 按**宽容读**（`roles` 数组含 `solutions` 即认），差异登记跨项目报备，不改对方码 |
| **R-A** | **台账行 S1 措辞改判**：「三向位 Explore/Plan/Verify loop」→「v1 抽取式题源（纯函数切题 + 人工确认）；v2 两段式·服务端装配 + 严格 JSON + 一次 repair」 | 改判（裁决 ②⑥ 的直接后果） | **已批复 2026-10-03**（成功标准冻结项改判，台账行随步） |
| **R-B** | **台账行 S3 措辞改判**：「best-effort upsert」→「判分同事务写」；并确认**缝 5 不移植 pending 回合语义** | 改判（裁决 ③ 的直接后果） | **已批复 2026-10-03**（同事务口径生效，best-effort 分支不实施） |

**已批复关闭**：R1（flashcard 同表 `kind`）、R2（输入面＝现成题库 + 知识点 point 行，不等 M-2）、
R3（取消 gen_job，通用 job 表面向 v2）、R5（双粒度调度）、以及原「answer_source 缺失处置」→ 现裁决 ⑨。
**2026-10-03 第二批批复**：R-4/R-6/R-7/R-8/R-9/R-10/R-11/R-A/R-B **全部按推荐采纳**，
并发令「现在开始执行」⇒ 实施批启动（判分接口缝与三表契约按本壳口径生效，不再另评）。

## 工作项（滚动登记表）

| 流 | 内容 | 状态 |
| --- | --- | --- |
| P-1 | **v1 抽取式题源管线**（裁决 ⑥）：`exerciseParse.ts` 纯函数 + 确认面板 + `POST /learn/questions` 批量入库；`answer_source` 六态判定与 ⑨ 的强制 flashcard 回落 | **已实施**（后端 2026-10-05 批：`POST /learn/questions` 幂等入库 + ⑨ 回落 + 不变量校验，42 例契约测试绿；前端 2026-10-07 批：`exerciseParse.ts` 纯函数规格与 `draftIssues` 镜像后端不变量 + `PracticePane`／`ExerciseConfirmPanel` 抽取预览与确认后批量入库，`exerciseParse.test.ts`＋组件用例绿） |
| P-1b | **v2 两段式生成管线**（裁决 ②，L6 移植）：assign→quiz + 严格 JSON + normalize/一次 repair；随通用 `qed_learn_job` 建表 | **设计稿已出、分期不实施**（前置＝M3 行 S4 真机冒烟 + `qed_learn_job` 触发条件成立） |
| P-2 | 题库表与 flashcard（块序列 QUIZ×3/FLASH_CARDS×5 模板消费端） | 设计稿已出；与 M-2 的关系＝`unit.payload` 存 `question_ids` 引用的接口口径（M-2 落地批接线） |
| P-3 | 间隔复习调度器（L3 移植）：间隔表/升降档/错题最高优先，MySQL 列化持久态、可注入时钟 | **已实施**（2026-10-05 批：`schedule_next` 升降档与钳位 + `qed_learn_review_task` 双粒度 + 到期队列端点；时钟经 `now=` 注入，含 parity 用例）；**前端随步**（2026-10-07 批：`QuestionCard` 三种 `origin` 一律取队列到期题、自评「记得/重来」走 `method=self`；复习条数按课程聚合进星图悬停行与课程知识点页页头按钮） |
| P-4 | 错题双写（改判同事务）+ 错题本查询端点 | **已实施**（2026-10-05 批：判分同事务 + 错题本读时派生查询与统计 + 人工位 `PATCH /learn/attempts`）；**前端随步**（2026-10-07 批：工作台右栏「本章练习」页签内错题本段——收藏/标记解决两个工位按钮按 `bookmarked`/`resolved` 即时 PATCH，统计「到期 N／错题 M 未解决（共 K）」） |
| P-5 | mimic 试卷仿题 | 待评估（后置，不变；实施时复用 `qed_learn_job`） |
| P-6 | M-3 判分接口缝定稿：判分函数签名、投影剔除、掌握门数据源声明 | **缝已定稿并落规则层**（2026-10-05 批：`services/learn/grading.py` 承载缝 1 三型阈值、缝 2 投影随 store）；**判分规则本体的归属仍归主链 M-3**——本模块只实现 v1 确定性规则，M-3 立门时直接复用不复制。前端随步（2026-10-07 批）：题面列表/队列不带判分依据（缝 2 剔除），`explanation`＋`score_trend` 只在 `POST /learn/attempts` 响应内展开回显 |
| P-7 | （新）题源书目可达性：`GET /learn/question-books` 透传（R-10）+ 真机核验习题集已下载/已解析（前置条件 5） | **已核（2026-10-07，经 8900 只读 HTTP，无需 SQL）**：25 本题源书里 7 本 `roles` 含 exercises/solutions，**全部无解析产物**（`active_job_id=None`、`pages_done=0`）；有产物的只有 mathanalysis-b05（317/317，textbook）与 linearalgebra-b01（3 页）⇒ 按预案**v1 题源退回教材课后习题单源**。同时暴露两处数据面事实并随手修端点：① `qt_books.course_id` 现网**全空**，透传过滤恒返空表 ⇒ 课程归属改在 8900 侧按 `af_books` 回退（回归锁用例已补）；② `af_books.parse_status` 恒 `pending`（解析侧不维护该列）⇒ 题源可用性判据改用新暴露的 `parsed_pages`，UI 只列 `parsed_pages>0` 的书。**解析侧数据前置仍未满足**：习题集解析（b07/b11/b15/b16/b17/linearalgebra-b06/ode-b05）属人工批准的数据窗口，不在本行判据内 |

## 过程与证据

- **2026-09-23**：学习设计轮重划建壳；切分裁决＝判分与掌握门归主链 M-3，本模块只调用其规则层、
  不复制语义。工作项 P-1~P-5 在本壳登记。
- **2026-09-30**：台账结构改判（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)）——
  验收判据正本移入 todo 行「成功标准」列，原行内「未启动／下一条件」叙述迁入本节。
- **2026-09-30**：现状＝未启动。前置＝主链 M-1 表契约 + M-3 判分规则层可用；真实出题调用依赖
  M3 本地模型开关；实施排期逐条经用户确认。
- **2026-10-03 距离完善度盘点（本轮起因）**：逐面对照「已整理好的学习面（M5/M6）与适配面（M3）」
  取证＝台账行 + 本壳（当时 71 行登记骨架、零设计实质）、`api-contracts.md` §⑥（24 个 `/learn/*`
  端点，练习域 0 行）、`database-design.md`（`qed_learn_*` 只有 course/unit/unit_progress/kp_detail）、
  `code-map.md`（练习域 0 行）、后端（`quiz/flashcard` 仅 `services/learn/base.py:51` 的块类型枚举值）、
  8903（练习卡与错题本 0 组件）。同时复核原前置①「M-1 含题目/题库/复习表契约」**落空**。
  DeepTutor 练习侧只读取证（`agents/question/pipeline.py` 三段与 Explore 工具回环、
  `learning/scheduler.py:13-98` 间隔表与升降档、`services/session/sqlite_store.py:323-350` 题库单表、
  `capabilities/mastery/tools.py:304-351` best-effort 双写、`learning/grading.py:13-49` 三类阈值、
  `learning/storage.py:377-461` pending interaction 与偏唯一索引）。
- **2026-10-03 用户裁决 ①~⑤**：三表挂 `qed_learn_*`（MySQL 元数据库）；出题采两段式·服务端装配
  （放弃工具回环，与 2026-09-29 M3「A-2 整块后置」一致）；本稿连带写 M-3 判分接口缝；
  本轮只出设计稿（文档先行）；输入面按 M5/M6 已交付现实。据此首版契约稿写入七节
  （三表 + gen_job + review_task，共五表 / REST 八端点 / 两段式协议 / 调度规格 / 七条缝 / UI 落点 / 待裁点）。
- **2026-10-03 用户裁决 ⑥~⑨（第二轮批复）与随之收敛**：
  ⑥ 题源改**现成题库**（教材课后习题 + 已下载习题集）⇒ v1 由生成式转**抽取式**（纯函数切题 +
  人工确认，不烧模型、同步返回），两段式生成降为 v2 分期保留；⑦ **表能少最好**⇒ 本壳补
  「判表判据 J1~J5」并逐张跑：`qed_learn_gen_job` **取消**（同步化 + `gen_batch` 整批核销），
  杂项统一收进 JSON 列与一张**预留的通用 `qed_learn_job`**（触发条件写死，v2 实施批才建）；
  ⑧ 复习调度**双粒度**⇒ `qed_learn_review_task` 保留，v1 三表成立；
  ⑨ `answer_source=none` 题**不阻塞入库**⇒ 强制转 flashcard 自评，人工补答案后经 `PATCH` 升级 quiz。
- **2026-10-03 题源事实取证（只读，子仓库代码为准、文档次之）**：
  ① 题源分类器＝`qt_books.roles` JSON 数组（`QED-Tracker/src/qed_tracker/db/models.py:212-215`，
  `textbook/exercises/solutions`），**`qt_books.kind` 闭集只有 `book`/`paper`**（同文件 :56-63，
  注释自证 `book=教材/习题集/题解等书本`）⇒ 用 `kind` 筛习题集是错的，且 JSON 列不能进唯一键与索引；
  另发现 UI 侧 `web-ui/src/stores/downloads.ts:107-114` 与 `docs/design/downloads-ui.md:162-164` 按
  `b.kind === 'textbook' / 'exercise'` 分组——该值不在 `BookKind` 闭集内（存量口径差异，**登记不改**）；
  ② `qt_knowledge` 有 `textbook_ref`/`exercise_ref`/`parallel_ref`（同文件 :150-162）＝现成的
  教材↔题解配对数据源（R-11）；③ 8900 侧 `GET /api/v1/books`（`api/axiom.py:138-141`）读 `af_books`
  且无 `course_id`/`roles` 参数，带过滤的 `GET /books?course_id=` 只在 8901（`api/main.py:1390`）未透传
  （R-10）；④ `BlockType` 10 值闭集无习题/答案块（`Axiom-Flow/src/axiom_flow/schemas.py:46-58`），
  页文本在盘不在库（`docs/design/parsing-flow.md:113-124`）⇒ 抽取必须是纯函数 + 人工确认；
  ⑤ 目录有 15 条 `roles:["exercises"]` 条目、课程 JSON `exercise_ref` 采纳 `mathanalysis-b07/b11/b15/b16`、
  `linearalgebra-b06`、`ode-b05`，但**无文档证据表明已下载并解析成功** ⇒ 前置条件 5 与 P-7。
- **2026-10-03 本批性质**：**纯文档**，无代码改动、无 DDL 执行、无端点新增、无子项目改动、
  无 git 写操作；`api-contracts.md`/`database-design.md`/`code-map.md`/`frontend-architecture.md`
  四处同步**有意不做**（裁决 ④：等待裁点批复与「开始执行」发令，不把未评审契约写进已确认文档）。
  台账行 S1/S3 措辞**未改**（成功标准冻结项，待 R-A/R-B；下条起为批复后随步）。
- **2026-10-03 第二批批复与发令**：R-4（`retired` 软删）/R-6（`kp_type` 快照）/R-7（open 题 LLM 批改
  v1 关闭）/R-8（新建 `practice.py` + `practice_memory.py`）/R-9（错题本不独立页，随 M6 工作台）/R-10
  （根侧透传 `GET /learn/question-books`）/R-11（纳入 `sibling_book` 配对并按宽容读）/R-A/R-B（台账行
  S1/S3 措辞改判）经用户「按照你的推荐确认，现在开始执行」**全批采纳并发令实施**。
- **2026-10-05 实施批（后端，Batch A）交付**：三表 DDL 与 `MySQLPracticeStore`
  （`services/learn/practice.py`）+ 同形 `InMemoryPracticeStore`（`practice_memory.py`，parity 用例守护）
  + 确定性判分规则层 `services/learn/grading.py` + 8900 八端点挂 `api/learn.py`（24→32 端点，练习表由
  首个练习请求懒挂载 `PRACTICE_MOUNT_RETRY_SECONDS=60s`）+ `TrackerClient.list_books()`（R-10 透传的
  8901 侧能力，只加读方法不改子项目）。测试＝`tests/test_learn_practice.py` 42 例（先写红再转绿），
  门禁取证：learn 定向 83 passed、`tests/contract` 82 passed、`ruff check backend/qed_engine tests` All checks passed、
  全量非契约 635 passed。生产库与开发库 DDL **未执行**（懒建表只在真实请求时发生；D 类转人工不变）。
- **2026-10-05 M-3 归属澄清（本批实现口径）**：判分**规则层**（三型阈值）随 M-3 缝 1 在本壳冻结并由
  `grading.py` 实现，M-3 立掌握门时复用同一函数、不复制阈值；`method=llm` 分支（缝 3）与双门槛计算
  （缝 4）**不在本批**，本模块只供 `qed_learn_attempt` 逐次行作为其输入事实源。
- **2026-10-05 实施期偏离登记（两处，均按「不改契约语义」处置）**：
  ① `PATCH /learn/questions/{id}` 白名单**增列 `answer_back`**——裁决 ⑨ 的「人工补答案后升级 quiz」路径
  需要改闪卡背面文本，壳的白名单原文漏列；② 错题本候选与状态列的取值收敛为**候选＝题下任一历史作答
  判错，`is_correct`/`resolved`/`score_trend` 取最近一次作答行，`bookmarked` 取任一收藏行**——壳的 REST
  表未逐字写明，按 J5 读时派生的最小一致口径实现，两份 store 同形并经测试守护。
- **2026-10-05 调度队列断言修正（设计忠实性取证）**：到期队列＝**仅 `due_at<=now`**（壳「间隔复习调度
  规格」节），优先级只在队列内排序 ⇒ 「错题立刻出现在队首」的判据必须以 **memory 型题**（首档 0 天）
  构造，concept 型首档 3 天不入队属设计而非缺陷；契约测试据此重写而非放宽实现。
- **2026-10-05 文档同步（裁决 ④ 的「实施完成后同步」条件成立）**：`api-contracts.md` §⑥（M2 引言 +
  8 端点登记与注册块 8 行）、`database-design.md`（三表 × 表清单/读写矩阵/表分工 + DDL 指针 + 端点数
  21→32）、`code-map.md`（`grading.py`/`practice.py`/`practice_memory.py` 三行 + 测试行 + `api/learn.py`
  端点数与描述）、`test_test_suite_governance.py` 白名单、`api/learn.py` 模块头随步。
  `frontend-architecture.md` **待前端批**（练习面路由与组件落点）。
- **2026-10-05 台账行随步**：S1/S3 按 R-A/R-B 新口径重写（原「三向位 loop」「best-effort upsert」措辞
  作废）；行状态 Accepted→**In Progress**（后端交付、前端与真机核验未收）。
- **2026-10-07 实施批（前端，Batch B）交付**：`web-ui/src/exerciseParse.ts`（抽取纯函数 +
  `draftIssues` 镜像后端 `_question_invariant_error`）+ `stores/practice.ts`（题源书/页范围/抽取/
  批量入库/本章题卡/人工位/复习条数聚合，一次抽页上限 40）+ 四组件
  `components/practice/{PracticePane,ExerciseConfirmPanel,QuestionCard,ChapterPractice}.tsx`，
  挂进 `pages/LearnWorkbench.tsx`（中栏正文下方「练习」区 + 右栏 Tabs「批注与候选」/「本章练习」）；
  复习入口挂 `pages/Knowledge.tsx`+`components/StarMapGraph.tsx`（悬停提示行）与
  `pages/CourseKnowledge.tsx`（页头按钮）。**入库纪律**：只提交零 issue 的 draft，回执文案
  「入库 N 题（跳重 M）」；判分依据不进题面（缝 2 前端侧一致）。
  门禁取证：`npx tsc -b` 干净、`npx vitest run --no-file-parallelism` **54 文件 / 589 用例全绿**
  （首跑并行曾出 fork worker 超时假红，串行复跑通过）、`npm run build` 成功。
  **落点窄化与偏离登记**（两处，均不改契约语义）：① 「本章练习」页签承载**到期复习 + 错题本**两段，
  候选清单留在「批注与候选」页签（壳原句把「候选」并列在同一段，实际按批注写产出的既有页签归属更连贯）；
  ② 复习条数**只进星图课程框悬停行、画布不新增可点元素**，可点入口移到课程知识点页页头按钮——
  星图「信息面收窄／一切操作归下钻页」的既有裁决优先，本条已同步写进「8903 练习面与错题本落点」节。
  `GET /learn/review/due` 无 `kp` 参数 ⇒ 本章过滤在前端按 `parent_kp_id` 做（条数口径以服务端
  `total_due` 为准，队列展示按章收窄）；聚合失败静默按 0 条，星图不因练习端点不可达而阻塞渲染。
- **2026-10-07 文档同步（前端批随步）**：`frontend-architecture.md` 信息架构三条路由行（Batch A 遗留的
  「待前端批」就此收口）；`design/learning-workbench-ui.md` 新增 §8 中栏练习区、§8.1 抽取纯函数规格、
  §9 作答/本章复习队列/错题本，原 §8/§9 顺延为 §10 状态与降级矩阵（+12 行练习场景）与 §11 已知约束，
  头部元数据四字段随步；`design/learning-star-map.md` §8 复习条数口径 + §9 页头按钮 + §10 降级行；
  `design/index.md` 两行内容描述与 `learning-workbench-ui` 实现状态 Implemented。
  真机核验同批进行，见下条。
- **2026-10-07 真机核验与题源可达性修正（P-7 收口）**：8903/8900/8901/8902 四服务在跑，星图页实测
  按课聚合发 12 枚 `GET /learn/review/due?course=&max_tasks=1`，全部 200 且只指 8900（`total_due=0`
  ⇒ 悬停行与课程知识点页按钮按 0 条口径不显示，降级正确）；控制台零报错。但
  `GET /learn/question-books?course=math_analysis` 返 **0 本**——根因＝`qt_books.course_id` 现网全空
  而端点把 `course` 透传给 8901 过滤（他课也一样空），题源选择面在真实数据上恒空、练习黄金路径走不通。
  修正（先补红再转绿）＝端点改为「拉全量后在 8900 侧过滤 + 课程归属 `qt_books.course_id → af_books.course_id`
  回退」，并暴露 `parsed_pages`（取 `pages_done`）作可抽取判据——`parse_status` 现网恒 `pending` 不可用。
  随步前端：`stores/practice.ts` 题源面只列 `roles` 非空 **且** `parsed_pages>0`，placeholder 改
  「本课暂无已解析的题源书」；`api/learn.ts` 类型加 `parsed_pages`；契约测试
  `tests/test_learn_practice.py`（夹具复刻现网空列并镜像 8901 过滤，新增「无 course 参数列全部角色书」一例）
  与前端三处夹具随步。门禁取证：后端 learn/api/contract **253 passed**、全量 **726 passed**、
  `ruff` All checks passed；前端本轮 10 枚文件 **88 passed**、`npm run build` 成功。
  **并行窗口红归因（非本轮改动，未触碰；残余移交见「遗留与移交」3）**：`npx tsc -b` 3 枚 TS6133/TS6196 全在
  `web-ui/src/components/learning/ChainPanes.tsx`（M1 链路模式在途 WIP）；全量 vitest 7 枚红集中在
  `web-ui/src/pages/LearnWorkbenchChain.test.tsx`（同轮在途：该文件单跑 3 红、全量轮 7 红＝顺序依赖，
  根因＝链路模式下右栏默认页签仍是 `annotation`，其断言直取「进度与推进」面板文本）。本轮只在该文件的
  Tabs 数组上与链路模式共存，未改其任何组件与用例。
  **端到端仍未跑通的原因不是代码**：现网唯一可抽的题源是 b05（教材），习题集解析属人工批准的数据窗口。
  8900 由用户重启后复验（只读 HTTP）：`GET /learn/question-books?course=math_analysis` 由 0 本→**10 本**，
  课程归属全部补齐、b05 `parsed_pages=317` 为唯一可抽题源（其余 9 本 `parsed_pages=0`，前端选择面按新门槛
  只列 b05）。浏览器端到端（抽取→确认入库→作答判分→进复习）**未跑**——用户裁决「先收文档和台账」，
  残余见「遗留与移交」第 6 条。

- **2026-10-09（S1~S3 真机收口 · 8903 端到端全链跑通 + 两处语义缺陷修复）**——用户指令
  「继续 8903 浏览器端到端…完成 ARCH-027-M2 任务」，把上一条的界面面残余清掉。

  **端到端黄金路径（真机逐节点取证，S1/S2/S3 的 UI 面）**：`#/learn/c/math_analysis` 选书 →
  章节「第 2 章 基础拓扑」→ 中栏题源书 b05 → 页范围 45–47 → 「抽取题目」得 **29 草稿** →
  人工确认面板改判（补背文/评分依据、答案来源＝人工录入）→ 「确认入库」提交合格草稿 **2 题**
  （不合格项按 `draftIssues` 过滤，不整批回滚）→ 作答判分：`POST /learn/attempts` 返判错、
  关键词命中 0/2，**评分依据与解析只在作答响应展开**（缝 2 投影在真机成立——题面与列表全程不出现
  `expected_answer`）→ 右栏「本章练习」到期 **3**／错题本 **1** → 队列内答对使错题 `resolved` →
  闪卡「翻开背文 → 重来/记得」自评两条 → 人工位收藏（`PATCH /learn/attempts/3`）→「重做本题」→
  复习入口闭环：`#/knowledge/c/math_analysis` 顶栏「今日复习 1 条」点击跳回 `#/learn/c/math_analysis`。

  **库面硬证据（S2/S3 的持久化与事务面，MySQL `qed_test` 直查）**：三表行数
  `qed_learn_question`=2 / `qed_learn_attempt`=5 / `qed_learn_review_task`=3（重启后仍在 ⇒ 进度不丢）。
  `attempt2`（origin=review）`score_trend=improved`、`resolved=1`，同题的 question 粒度任务
  `interval_index` 由 0→1、`due_at` 顺延至次日 ⇒ **判分 + 趋势 + 调度回写同事务**（缝 6）；
  `attempt3.bookmarked=1` 在判分响应之外单独 PATCH ⇒ 人工位不进事务；`method=self` 的自评行
  趋势取 new/improved/declined；question 与 kp **双粒度任务并存**（S2 双粒度口径）。

  **两处语义缺陷（本轮真机发现并修复，编号 DEFECT-012/DEFECT-013；沿用 M6 判例＝壳条目承载 + 回归锁用例，不另立 todo 行）**：
  **DEFECT-012** 闪卡自评结果沿用判分题文案「判对/判错」——自评是记忆口径不是对错口径
  （`components/practice/QuestionCard.tsx` 按 `question.kind === 'flashcard'` 改「已记住/未记住」）；
  **DEFECT-013** 右栏题卡随列表整体重取而卸载，刚做完一题的判分反馈在页面上消失，用户看不到结果
  （`components/practice/ChapterPractice.tsx` 顶行新增持久「最近判分：〈口径〉·趋势 〈trend〉」，
  口径由 `verdictOf()` 按 `method==='self'` 分自评/判分两套文案）。回归锁用例＝`QuestionCard.test.tsx`
  「闪卡自评结果用记忆口径（已记住／未记住），不写判对判错」与 `ChapterPractice.test.tsx`
  「最近判分行持久显示且按口径选文案」「自评结果的最近判分行走记忆口径」三枚（两枚文件合跑 13 passed）。
  新 bundle `npm run build` 后真机复验：Alert 文案「未记住 | 判分方式 self·趋势 declined | 自评记忆卡」、
  右栏顶行「最近判分：自评未记住·趋势 declined」两处均生效。

  **抽取质量观察（不判缺陷，人工确认面板承担兜底）**：教材「提示：」行被同页答案规则配成评分依据
  （题 2 置信 95% 但内容是无意义片段）。属 `exerciseParse` 启发式的既定义口径——置信度衡量
  「答案配对成功」而非「答案语义正确」，v1 设计上就依赖人工确认面板过滤；后续若把
  `answer_source=same_page` 的置信门槛收紧，归 v2 生成线或抽取线单独定级，不在本行判据内。

  **门禁取证（2026-10-09 端到端批）**：后端 learn/api/contract 定向 + 全量 **737 passed**、`ruff` All checks passed；
  前端本轮相关 5 枚文件 **30 passed**（含 DEFECT-012/013 三枚回归锁）、`npx tsc -b` 无错（上一条登记的
  M1 链路 WIP 三枚 TS6133/TS6196 已由其窗口清掉）；`npm run build` 成功。
  **并行轮 vitest 唯一红＝`src/components/parsing/BlockList.test.tsx`**：单跑 **20 passed** ⇒
  文件级并发下的 jsdom 顺序污染型 flake，与练习域无关，归 parsing 线处置（见「遗留与移交」7）。
  **收口批复跑（2026-10-09，壳归档移动落地前）**：`pytest backend tests`（除 `tests/contract`）
  **655 passed**、`ruff check .` All checks passed；`web-ui/` 内 `npx tsc -b` 零错、
  **全量 vitest 串行（`--no-file-parallelism`）58 文件 626 passed / 0 failed**——上面的 `BlockList`
  红在串行轮不复现，坐实为并发顺序污染而非用例缺陷；`npm run build` ✓ built。
  契约门禁当前红＝本壳尚未移入 `history/plans/`（`Active` 状态枚举与 todo 镜像两条）＋并行 M1 窗口
  在飞的三条（roadmap 引用 M1、REQ-102 死链、todo 文档锚），归档移动由用户执行后复跑。

  **收口批只读复验（2026-10-09，经 8900 门面，不打业务库）**：`GET /learn/question-books?course=math_analysis`
  ＝ 200／10 本、唯一可选题源 `mathanalysis-b05`（`parsed_pages=317`，与门槛登记一致）；
  `GET /learn/questions` ＝ 200／2 题（端到端入库的 `q-09ff42edc361`/`q-cfb731fa474e` 仍在）且响应
  **不含 `expected_answer` 列**（缝 2 投影在当前构建上仍成立）；`GET /learn/review/due` ＝ 200／`total_due=2`
  且 `kp` 与 `question` **双粒度并存**（S2）；`GET /learn/mistakes` ＝ 200／未解决错题 0、`stats.total=1`
  （端到端那条错题已因队列内答对转 `resolved`，读时派生口径与库面一致）。
  并行 M1 窗口的三条红已由其窗口自行消除，当前契约仅剩本壳归档移动相关的两条。
  **网络与控制台回归**：90 条请求，应用流量全部指向 **8900** 且全 **200**（含 `POST /learn/questions`、
  `POST /learn/attempts`、`PATCH /learn/attempts/3`）；无 8901/8902 直连（ADR 0007 守住），无应用侧报错。
  **实测边界声明（按 `qed-frontend-check` 要求如实登记）**：in-app browser viewport 为 0×0，
  `take_screenshot` 与真实指针点击不可用 ⇒ 交互全部经 `evaluate_script` 派发 DOM 事件
  （mousedown/mouseup/click + 受控 input 的原生 value setter）完成，未留存截图证据；
  页面可见性与断言以 DOM 快照与脚本返回值为准。

  **确认面板分支补测（2026-10-09 收口后追加，同一构建）**——黄金路径之外的四支交互在真机逐项取证：
  ① **改判题型**：题 3 由「闪卡自评」→「判分题」即时冒两枚红字
  （`判分题缺评分依据；答案来源为「无」`），顶行计数随之 `可入库 1 题`→`0 题`，卡头 Tag 同步
  「判分题·简答」⇒ 无答案题转闪卡后改判须人工补齐依据（抽取管线规格 裁决 ⑥ 的门槛在真机成立）。
  ② **补齐评分依据**：`题 3 评分依据` 输入「上确界存在；完备性」后红字实时收敛一条、仅剩
  `答案来源为「无」`（`draftIssues` 随每次 onChange 重算，非提交时才校验）。
  ③ **改答案来源**：`题 3 答案来源` 由「无答案」→「同页答案」，红字全清、`可入库` 回升 1、
  确认入库按钮由 disabled 解禁 ⇒ 「不合格草稿不进提交批次」只由 `draftIssues` 驱动，无旁路。
  ④ **提交幂等**：点「确认入库」后草稿池 `21→20`、右栏口径刷新为 `到期 2／错题 1 未解决（共 2）`；
  服务端 `GET /learn/questions` 仍 `total=2`——同题面 `stem_hash` 命中已入库的 `quiz/open/same_page`
  题 ⇒ **跳重不新增、也不回写既有题的 kind**（改判留在面板侧，符合幂等语义）；
  `GET /learn/mistakes` `stats={total:2, wrong:2, unresolved:1, bookmarked:1, due_today:1}`
  与右栏顶行**逐项吻合**；列表投影仍不含 `expected_answer`（缝 2 在当前构建上再次成立）。
  上节「未解决错题 0／`stats.total=1`」是该时点快照，本节数字为其后追加作答（闪卡自评「未记住」
  按口径计一次错）后的现值，不是回退。
  **未测分支与数据窗归因**：「去掉选项」按钮在本页数据下不渲染（整池 21 草稿 `options` 全为 null，
  b05 页 45–46 无选择题），该分支由 `exerciseParse.test.ts` + `ExerciseConfirmPanel` 用例覆盖；
  「题解配对书」答案来源选项同样不可测——7 本题源书全部未解析（现网唯一题源＝b05），属人工批准的
  数据窗口，留待题源书解析后复跑（与「遗留与移交」#1 同一口径）。
  **注入方式注记（供后续窗口复用）**：0×0 viewport 下 rc-select 须**分两次脚本**——第一次向
  `.ant-select-selector` 派发 `mousedown` 打开下拉，第二次在新弹出的 `.ant-select-dropdown` 内点
  `.ant-select-item-option`（同一脚本内先开后点读不到 popup，React 异步渲染）；键盘
  `ArrowDown/ArrowUp + Enter` 在有残留 popup 时会点到错位的选项（残留下拉不随 Escape 收，须 blur），
  故每次操作前用选项文本确认目标下拉。

## 验证与验收

- 抽取切题与调度器、段 1/段 2 的 normalize/校验/repair 均为**纯函数单测**
  （抽取用真实习题集页文本夹具走 vitest，判例 `tocParse`；调度器注入时钟；生成形态用假 transport），
  不依赖 LLM 与网络。
- 契约测试先行：`tests/contract` 端点与错误码清单 + `tests/test_learn_practice.py` 逐端点用例，
  **内存 store 同形**（判例 `knowledge_memory.py` / `InMemoryKnowledgeStore`），默认测试不写运行库。
- 真机核验需人工批准的操作（开发库 DDL、服务重启、业务库只读 SQL）按 M6 判例写入「遗留与移交」，
  不由 agent 擅自执行；生产 `qed` 库不做 ALTER（随 1.0 重建节奏）。
- 每流收口：8900 定向测试 + `tests/contract` + `ruff`；契约变化同步 `api-contracts.md` §⑥ 与
  `database-design.md` 三处；实施批随步 `code-map.md`（新模块 + 新测试行）与
  `frontend-architecture.md` 路由。
- S 判据的 UI 面验收：8903 真实浏览器实测（`qed-frontend-check`），题面公式回原样按 M1 UI-1 判据核；
  抽取预览与确认面板需在真实习题集页（或核销后的教材课后习题页）走通「抽取→改→入库→作答→判分→进复习」。

## 回滚

纯记录文档；代码改动按各自提交独立回滚。表侧按 M6 判例**可删除重建**（三表无历史数据依赖，
DROP 不波及 `qed_learn_unit` 与知识点两表）；`QED_LLM_LOCAL_ADAPT` 开关可整体旁路 v2 生成路径。

## 遗留与移交

1. **真机只读核验：已由 agent 经 8900 门面完成（2026-10-07），SQL 原文降为备查**——只读 HTTP
   （`GET /learn/question-books`、`GET /books`）即可取到同一事实，无需读业务库；结论＝7 本题源书
   全无解析产物，v1 退回教材课后习题单源。若要库面复核可跑：
   ```bash
   "D:/software/mysql/bin/mysql.exe" -h 127.0.0.1 -u root -p qed -e \
   "SELECT b.book_id,b.title,b.roles,b.file_path IS NOT NULL AS has_file,a.parse_status \
    FROM qt_books b LEFT JOIN af_books a ON a.book_id=b.book_id \
    WHERE b.course_id LIKE 'mathanalysis%' OR b.course_id LIKE 'linearalgebra%' OR b.course_id LIKE 'ode%' \
    ORDER BY b.book_id"
   ```
   **残余转人工（数据窗口，非代码任务）**：`mathanalysis-b07/b11/b15/b16/b17`、`linearalgebra-b06`、
   `ode-b05` 的下载与解析需人工批准排期；排期落定后练习面的题源选择面才会出现习题集选项
   （`parsed_pages>0` 门槛随动，无需改码）。
   **题源书目字段口径差异报备（同属对方治理面）**：8901 `qt_books.course_id` 现网全空、根侧
   `af_books.parse_status` 恒 `pending`（`last_parse_result/pages_done` 才是实际进度），本侧已按
   归属回退 + `parsed_pages` 判据绕过，不改对方码，登记报备。
2. **对方口径矛盾报备**（不改对方码，按跨项目协作规范由对方处置）：`BookRole` 枚举 `solutions`
   已被 QED-034 退役，但代码白名单 `_ROLES_VALUES` 仍含（`application/knowledge_import.py:169`）；
   根侧 8903 的 `downloads.ts:107-114` 按不存在的 `kind` 值分组（存量死分支）。本壳按 R-11 的宽容读处置。
3. **M1 链路模式在途 WIP 的红（不由本轮处置，归其窗口）**：`web-ui` 侧 `npx tsc -b` 3 枚未用声明
   （`components/learning/ChainPanes.tsx`）与全量 vitest 7 枚红（`pages/LearnWorkbenchChain.test.tsx`，
   单跑 3 红/全量 7 红＝顺序依赖）——根因＝链路模式下右栏默认页签仍 `annotation`，其用例直取
   「进度与推进」面板文本。本轮未改这两枚文件；两处共存点在 `pages/LearnWorkbench.tsx` 的 Tabs 数组，
   合并形态已复核无覆盖损失。
4. **8903 浏览器端到端：已完成（2026-10-09，见「过程与证据」同日子条目）**——S 判据的界面面收口
   已跑通（选书→章节→题源 b05→页范围 45–47→抽取 29→确认入库 2→作答判分→右栏到期/错题→
   复习入口回跳），并由此发现并修复 DEFECT-012/DEFECT-013 两处语义缺陷。截图证据因 viewport 0×0 不可留存，
   以 DOM 快照 + 库面 SQL 为凭。
5. M5 关闭时移交的「知识点内容写入候选池」中，**生成新叙述**归主链 M-2 编译线；
   本模块只**消费**已确认 `point` 行（v2 段 1 入参），不产候选。
6. 生产 `qed` 库 DDL（三表 + 未来 `qed_learn_job`）属 D 类转人工，随发布批次；根侧不留生产库操作项。
7. **全量 vitest 并发顺序 flake 归 parsing 线**（不由本壳处置）：`web-ui/src/components/parsing/BlockList.test.tsx`
   在文件级并发轮红、单跑 20 passed，且**串行轮（`--no-file-parallelism`）58 文件 626 全绿不复现**，
   根因＝跨文件 jsdom 状态污染；本轮未触该文件，若要在 CI 根治须由 parsing 线做用例隔离。
8. **v2 生成式出题（两段式·服务端装配）不在本行判据内**：设计口径已在本壳「契约设计」各节冻结，
   实施另立任务行；`QED_LLM_LOCAL_ADAPT` 开关旁路 v2 路径。

## 关闭与归档

**关闭裁决＝2026-10-09 用户指令「完成 ARCH-027-M2 任务」**：行内 S1~S3 全部达成并留证
（S1 抽取式出题管线——真机 29 草稿→入库 2 题 + `(course_id, stem_hash)` 幂等；S2 间隔复习 MySQL 化——
三表真机行数与重启后仍在、`interval_index` 0→1 升档；S3 错题写判分同事务 + 人工位事务外 +
错题本读时派生端点可用——`attempt2` 同事务趋势/解决位、`attempt3.bookmarked` 单独 PATCH）。
v2 生成形态按指针移交、不留待做项（见「遗留与移交」8）；判分规则本体（M-3）与界面渲染基线（M1）
自始不在本行判据内。

归档动作＝本壳 **Retain** 归档 `history/plans/<year-month>/`（**2026-10-09 经用户批准执行 `mv`**，
现落 `docs/history/plans/2026-10/2026-09-23-practice-review.md`；壳内出链按三级深度、七处入站引用与
两枚代码 docstring 同批重指向，`docs/plans/index.md` 补「已归档计划（2026-10）」行）；
todo 的 ARCH-027-M2 行移除并原 6 列搬入 `docs/trackers/completed.md`。
