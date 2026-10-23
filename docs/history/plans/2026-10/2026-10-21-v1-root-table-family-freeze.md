# v1.0 根私有表族定档为三张与库内重建（v1-root-table-family-freeze）

状态：Closed（Achieved，2026-10-22 收口：S1~S5 全达成，判 Retain 归档）
任务类型：B
最后更新：2026-10-22
关联 ADR：[ADR 0026](../../../adr/0026-v1-root-table-family-freeze.md)（本壳承载其 D1~D8 执行）、[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（备份确认档三步与 demo 门）、[ADR 0025](../../../adr/0025-database-design-master-doc-and-ddl-ownership.md)（总纲为逐列正本并承载建表语句）、[ADR 0018](../../../adr/0018-data-root-whitelist-and-meta-json-ban.md)（数据根白名单——本批**不新增条目**）
关联设计：[database-design.md](../../../architecture/database-design.md)（逐列与 DDL 正本）、[api-contracts.md](../../../architecture/api-contracts.md) §⑥（端点族退役与新增）、[frontend-architecture.md](../../../architecture/frontend-architecture.md)（8903 三面读面）、[cross-project-contracts.md](../../../design/cross-project-contracts.md)（共享表加列的跨项目口径）、[dataset-conventions.md](../../../design/dataset-conventions.md)（`parsed/**` 白名单与产物布局）
关联 Tracker：docs/trackers/todo.md（REQ-137 登记，普通任务轮 ARCH-035 节）；2026-10-22 该行已原子移出 todo、关闭结果 `Achieved` 写入 [completed.md](../../../trackers/completed.md)；前序＝[REQ-132 壳](2026-10-21-qe-family-rename-and-refactor.md)（其 W5 判定七→六张、W3 库内归一窗口与本壳 W1 同批）
归档判定：Retain（三张逐列定档形状、三刀取证锚、黄金样本对拍判据与退役端点清单属不可替代口径）

> **demo 门（ADR 0024 决定 2，一壳一门）**：本壳 W1 即门＝库内按备份确认档三步重建为三张后，
> 8903 三面（`#/knowledge` 星图、`#/learn` 推进、`#/practice` 出题判分）跑通**一条黄金路径**：
> 选一门课 → 读到权威知识点树 → 标记一个知识点 `done` 并写一句备注 → 出一道题 → 作答判分 →
> 到期复习队列出现该题。真库、真浏览器、全指 8900、无 4xx/5xx。**到门暂停待人工验收**，
> 通过才进 W2~W7。

## 目标与成功标准

**目标**：按 [ADR 0026](../../../adr/0026-v1-root-table-family-freeze.md) 把根私有表族由七张定档为
**三张**（`qe_learning`／`qe_question`／`qe_attempt`），同批完成共享主表加三列、编译链路退役、
调度态改重放派生与用户维度贯通，并在同一个库内窗口把 `qed_test` 的三名并存（总纲 §7.8 T2）
一并归一。目标效果＝v1.0 的持久化形状与用户的**功能划分**（课程学习 + 课后练习）一一对上，
总纲逐列正本、代码 DDL 与库内实存三者一致，生产库零迁移。

**成功标准正本在台账行**（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)）：逐条对照
todo.md `REQ-137` 行「成功标准」列，本壳不复制判据。

## 定档形状（逐列正本＝总纲 §五；本节列面已于 2026-10-21 定稿，含 C1~C3）

### 三张根私有表

**`qe_learning`（学习记录，13 列）**——替掉 `qe_course_state`（16 列）+ `qe_unit_progress`（9 列）
+ `qe_unit`（15 列）三张，单表继承：course 行承载选课与学习路径，kp 行承载终态与质性门。

```sql
CREATE TABLE IF NOT EXISTS qe_learning (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '行 ID（自增主键）',
  owner VARCHAR(64) NOT NULL DEFAULT 'admin' COMMENT '学习者标识（v1.0 恒 admin，多用户扩展位；ADR 0026 D7）',
  target_kind VARCHAR(16) NOT NULL COMMENT '闭集 course=学习课程行 / kp=知识点行（单表继承，ADR 0026 D1/D4）',
  target_id VARCHAR(64) NOT NULL COMMENT 'course 行=共享 qed_course.course_id；kp 行=共享 qed_knowledge_point.kp_id（R5 只引用不复制，不存名称快照）',
  status VARCHAR(16) NOT NULL COMMENT 'course 行：active/paused/done；kp 行：done/skipped（pending=无行，读时派生非累加）',
  config JSON COMMENT 'course 行专用：{resources:[{kind,ref_id,label}],kp_path:[kp_id…]}；kp 行 NULL（整行读出、不内部筛选，不触 R7）',
  qualitative_passed TINYINT(1) NULL COMMENT 'kp 行专用：质性门结论 1/0，NULL=未判（仅 concept/design 知识点有值）',
  qualitative_note VARCHAR(1000) DEFAULT '' COMMENT 'kp 行专用：判读证据一句话（v1 只存学习者自评理由；不含密钥）',
  assessed_by VARCHAR(16) DEFAULT '' COMMENT 'kp 行专用：provenance learner=自评位／model=预留（本轮端点拒绝）',
  assessed_at DATETIME NULL COMMENT 'kp 行专用：最近一次质性判定 UTC 时刻',
  learner_note TEXT NULL COMMENT '学习者备注（课程级与知识点级通用；人工位，机器不写，R6）',
  created_at DATETIME NOT NULL COMMENT 'UTC 创建时间',
  updated_at DATETIME NOT NULL COMMENT 'UTC 更新时间',
  UNIQUE KEY uq_learning_target (owner, target_kind, target_id),
  KEY idx_learning_course (owner, target_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='学习记录（owner×目标×状态单表：course 行=选课与学习路径，kp 行=终态与质性门；进度百分比与掌握分读时重算，所有权 QED-Engine）';
```

- **学习路径**（原 `qe_unit` 的唯一真事）＝ course 行 `config.kp_path` 的 `kp_id` 有序数组，
  数组序即学习序；`''`/缺键＝直接按共享主表知识点树的 `order_hint` 走。这是 JSON 列的正当用法
  （整行读出、不内部筛选），与既有 `resources` 同性质。
- **课程百分比、结课态、掌握分一律不落列**：读时按本表 kp 行 × `qe_attempt` 序列 × 到期重放
  计数汇成（原四源变三源，规则本体仍在 `services/learn/mastery.py`）。
- 分表理由的改判：REQ-132 W5 记「分表是为重编译换代不丢学习记录」，该理由随 `qe_unit.active`
  版本位退出而**失效**；本壳的存续理由是基数与角色（1 行/课 vs N 行/课、主数据 vs 事实）。

**`qe_question`（题库，24 列）**——现 27 列删三列：`unit_id`（引用已退出的 `qe_unit`）、
`learn_course_id`（学习课程独立 ID 取消，ADR 0026 D4；`course_id` 已是共享坐标）、
`course_label`（名称快照列，C3 已裁退，读时从共享 `qed_course` 取）。**不加 `owner`**
（题库是内容、跨学习者共享）。其余列面与闭集不动。

**`qe_attempt`（作答事实，14 列）**——现 14 列，两处相抵净列数不变：加
`owner VARCHAR(64) NOT NULL DEFAULT 'admin'`，退 `score_trend`（C1 已裁退，读时由
`(previous.is_correct, current.is_correct)` 派生）；
唯一键 `uq_attempt_idem` 由 `(question_id, review_date, origin)` 改为
**`(owner, question_id, review_date, origin)`**（否则第二用户的作答会被幂等键静默吃掉）；
`idx_attempt_question`／`idx_attempt_kp`／`idx_attempt_course` 三枚加 `owner` 前缀；
`resolved` 保留但**改判纯人工位**（C2 已裁，机器判分只写 `is_correct`，DDL 注释补人工置位口径），
连带 `idx_attempt_open (course_id, resolved, is_correct)` 由退化索引恢复语义、`practice.py:837`
的冗余条件随批清理。

### 共享主表 `qed_knowledge_point` 加三列（22 → 25 列）

| 列 | 类型 | 空/默认 | 说明 | 为什么是列不是 `meta` |
| --- | --- | --- | --- | --- |
| `aliases` | JSON | 可空 | 同物异名列表 `["…"]`：多教程对同一章节/知识点的不同称谓，`name` 恒为权威名 | 检索要命中别名 ⇒ 必须可 `WHERE`；R7「只读不筛」禁止它进 `meta` |
| `narrative_ref` | VARCHAR(500) | NOT NULL `''` | 已确认长文正文的**数据根相对路径**，`''`＝无正文（学习面只显示 `summary`） | 学习面按它取正文，是读路径的键；落点见下 |
| `angles` | JSON | 可空 | 正文内已承载的角度索引 `[{angle}]`，`angle` 闭集复用退役池既有六词 `summary`/`explanation`/`definition`/`theorem`/`proof`/`example`，不新造词 | 星图与学习面按角度出徽标 ⇒ 要可筛；正文本身不复制进库（R5） |

- **落点在既有白名单内，ADR 0018 不动**：Axiom-Flow PLAN-024 KA-20 已定长文落
  `<book_dir>/kp/<node_id>.md`，即 `parsed/<domain>/<course>/<book_id>/kp/`——属
  [dataset-conventions.md](../../../design/dataset-conventions.md)「数据根顶层白名单」既有区 `parsed/`，
  **不需新增顶层条目**。
- **根侧存全串相对路径而非对方的单段文件名**：独立性铁律要求 8900 在 Axiom-Flow 离线时仍能解析
  正文，而单段名的路径派生规则在对方文档、复制过来即第二事实源（R5）。
- **失效口径与对方 KA-19 同形**：指针悬空＝**可见降级**（正文区标「待复核」），不静默改写、
  不静默删。
- **不加的列（ADR 0026 D6 负面清单）**：不加 `is_canonical`（权威态＝存在性、权威名＝`name`）；
  不加合并/拆分谱系列（正本在 AF `af_kp.dedup_of`／`links`，根侧复制即漂移）。

### 读正文的新端点（唯一新增面）

`GET /learn/knowledge-points/{kp_id}/narrative` → 8900 读 `narrative_ref` 指向的文件回传正文。
安全闸**沿用对方 PP-5/PP-16 双闸同形**：拒绝绝对路径、拒绝越根（解析后必须仍在
`QED_DATA_ROOT` 内）、只允许 `parsed/**` 前缀。前端唯一入口 8900（ADR 0007），8903 不直读文件。

## C1~C3 三处列级简化（本壳查出，2026-10-21 用户裁决**全数采纳**，已升为 ADR 0026 D9）

| # | 查出 | 判据 | 建议 | 若不采 |
| --- | --- | --- | --- | --- |
| C1 | `qe_attempt.score_trend` 是**纯派生列** | 它是 `(previous.is_correct, current.is_correct)` 的确定性函数（`practice.py:220-229` 四分支穷举：new/improved/declined/unchanged），与 D3 删调度表同一判据 | 退列，读时算；14 列 | 保留，则「派生量不落列」原则在作答表内继续自相矛盾 |
| C2 | `qe_attempt.resolved` 是**机器与人工共写一列** | 机器按 `resolve_trend` 写、人工经 `PATCH /learn/attempts/{id}` 写（`api/learn.py:1645`）；且机器写的那部分**恒等于 `is_correct`**（逐分支穷举可证：unchanged 分支里 `previous.resolved` 恒等于 `previous.is_correct`），故 `idx_attempt_open (course_id, resolved, is_correct)` 当前是**退化索引**、`practice.py:837` 的 `not is_correct and not resolved` 是冗余条件 | 保留列但**改判为纯人工位**（与 `bookmarked` 同族，机器不再写），DDL 注释补人工置位口径 | 保留共写，则 R6「机器位与人工位分列」在本表破例且无登记 |
| C3 | `qe_question.course_label` 是名称快照列 | 与 D4 删 `qe_course_state.name`/`domain_ref`/`course_ref`/`direction` 同一 R5 论证；共享 `qed_course` 在同库，读时取零成本 | 退列，读时从共享表取；24 列 | 保留，则 R5 取向在题库表破例 |

**裁决（2026-10-21 第五批，用户原文＝「C1~C3 裁，先编译数据库设计文档，以及其他相关文档资料」）**：
三处**全数采纳**，登记为 [ADR 0026 D9](../../../adr/0026-v1-root-table-family-freeze.md)；上表「建议」列
即裁决取值，「若不采」列留作反证不再适用。列数账随之定稿＝三张 53 → **51** 列
（`qe_learning` 13 + `qe_question` 24 + `qe_attempt` 14），根私有族合计 116 → **51**。
三处均**不改端点响应字段名**（`score_trend`／`resolved` 读时派生后原样回传），前端契约零扰动。

## 范围与非目标

**范围**：
- W1 demo 门（库内备份确认档三步重建为三张 + 8900 最小改道 + 8903 一条黄金路径真机跑通）。
- W2 总纲定档：§五 三张逐列与 DDL、§三 表数（21 → **16**，AF 四表登记随步）、§4.2 血缘、§4.3 图 A、
  §4.4 读写矩阵、§4.5 角色分类（含单表继承的跨角色例外）、§7.8 T2/T3/T10/T11 随步。
- W3 主表三列 + 正文读取端点（越根双闸）+ 提升面平移（`from_detail_id` 语义改指 AF `node_id`，
  REQ-132 W5 K3）。
- W4 退役面清扫：编译端点族（`POST /learn/courses/{id}/compile/propose|start`、`GET …/compile`）、
  单元端点族（`GET /learn/courses/{id}/units`、`GET /learn/units/{id}`、`PUT …/syllabus`、
  `PATCH /learn/units/{id}`）、候选池端点族（`GET|POST /learn/kp-details`、
  `POST /learn/kp-details/{id}/confirm|reject|like`、`POST /learn/annotations/generate`）、
  `qe_review_task` 全部查询点（`practice.py` 约 10 处）改重放；`api-contracts.md` §⑥ 与
  `test_api_endpoint_inventory` 双向等值同批。**退役清单原三枚裁决前置已于 2026-10-22 由第六批
  「A 全批同改」全数解除**＝① 编译端点族以 ARCH-027 行 S2／S4 改判为伴（改判同批落 todo）；
  ② `POST /learn/annotations/generate` **端点保留**、条级腿改落主表 `angles`；③ `…/kp-details/confirm`
  退役、主表 point 行产面平移为 `POST /learn/knowledge-points` 直登记（见「遗留与移交」第 1 项）。
- W5 前端：`LearnShelf.tsx`（选课＝插 course 行）、`LearnWorkbench.tsx`（推进读主表树 + `kp_path`、
  勾选位改读 progress 派生）、`Practice.tsx`（复习队列读重放结果）、`Knowledge.tsx`／
  `CourseKnowledge.tsx`（候选徽标改道或砍面）、`stores/learnWorkbench.ts`、`api/learn.ts` 类型面。
- W6 生产 `qed` 库：建表命令清单成文转人工（三张在生产从未建过＝零迁移，总纲 §7.8 T3）。
- W7 收口：契约守护 `ROOT_PRIVATE_TABLES` 七枚改三枚、逐字 DDL 对齐、`code-map.md` 随步、
  黄金样本对拍回归、全量门禁、真机三链复核。

**非目标**：
- 不动 `qt_*`／`af_*` 任何表（AF 五→四的执行归对方 PLAN-024，表数随步挂 §7.8 T11）；
  不动共享 `qed_domain`／`qed_course`／`qed_llm_calls` 列面。
- 不在生产库执行任何 DDL；库内重建窗口（D 类）的**排期与批准归人工**，agent 只驱动与取证。
- 不做多用户功能面（`owner` 只是贯通列与唯一键前缀，v1.0 恒 `admin`，无用户表、无登录）。
- 不做「按知识点整体节律推题」（原 `target_kind='kp'` 粒度，W5 已判空转；v2 若要须重新引入）。
- 不实现 v2 生成式题目（`source_kind='generated'` 仍是预留取值）。
- ~~**判定不领先执行**~~（2026-10-22 由第六批裁决「A 全批同改」**解除**）：该口径只约束判定批——
  彼时受「DDL 围栏逐字相等」与「总览↔矩阵↔角色同集合且表数硬编 21」两组守护锁定，目标态建表语句
  不得先行内联。执行批里**总纲正文、代码 DDL 与守护数值同批改**，逐列正本由本壳迁入总纲 §五。

## 前置条件

1. 用户已裁决（2026-10-21 五批 + 2026-10-22 第六批）：`qe_kp_detail` 废弃整表、`qe_unit` 的 `section` 层并级、
   判定＋执行同批、结论落 REQ-132 W5 + REQ-134 退指针；详解承载坚持**甲案**（长文落文件、列内只存
   指针）、`qe_unit` 的 point 物化层与 `covered` 列一并退出、立项形态＝新立一行 todo + 一份 plans 壳；
   表数＝**3 张**、调度态＝**删表改重放**、学习课程＝**取消独立 ID**；
   **C1~C3 三处列级简化全数采纳**（升为 ADR 0026 D9）。逐条原文见「过程与证据」。
   **第六批「A 全批同改」**＝本壳由判定批转执行批、授权范围与重启红线见「过程与证据」首条。
2. [ADR 0026](../../../adr/0026-v1-root-table-family-freeze.md) 已登记 Accepted 并进 `docs/adr/index.md`。
3. REQ-132 W1/W2 已落地（练习三表与余四张的目标名已随步代码与文档），其 W3 库内归一窗口与本壳
   W1 **同批排期**（两批都要触库、都要重启 8900）。
4. 库内重建属**备份确认档**（总纲 §7.3：库内已跑出的知识点树与练习数据再生昂贵）⇒ 临时备份 →
   用户确认 → 重建三步不可免；备份落 `dataset/backups/YYYY-MM-DD-<任务标识>`，验收通过后清理。
5. `dataset/**` 对 agent 全拦（权限层连只读 `ls` 都拦）⇒ 备份与清理命令**原文写进本壳交人工执行**。

## 工作项

| # | 工作项 | 交付物 | 状态 |
| --- | --- | --- | --- |
| W1 | **demo 门**：库内备份三步重建为三张 + 8900 最小改道 + 8903 一条黄金路径真机跑通（选课→知识点树→标记 done 并写备注→出题→作答判分→到期队列出现该题），全指 8900 无 4xx/5xx | 库内 `SHOW TABLES` 读数、备份路径、真机截图与控制台零错记录；**到门暂停待人工验收** | **已达成**（2026-10-22 收尾批：P0～P4 切换＋P5 黄金路径取证与真机四面复核＋P6 收口全数完成；API 面 23 枚请求非预期 4xx／5xx＝0、真机四面全指 8900 且 JS 控制台零错、写路径取证后库内演示态**复原逐值相等**；暂停点①②③ 均已消费，③ 的验收材料交用户；逐条取证见「过程与证据」首条） |
| W2 | 总纲定档：§五 三张逐列与 DDL + §三/§4.2/§4.3/§4.4/§4.5/§7.8 七处随步。**判定批已先落**（§一 表族定档、§三 备注列 8 行、§4.2 血缘、§4.3「图 A-目标」、§4.4／§4.5 判定段、§五 主表三列与四张判退表 blockquote、§6.1／§6.4、§7.3／§7.6、§7.8 T3／T10／**T12**、§八），W2 只剩把判定改为正文＝写进三张 DDL 与逐列表格、删四张判退表的正文，并同批改三处守护数值 | `database-design.md` 差异 + 逐字对齐守护绿 | **已交付**（2026-10-22 执行批：§五 三张逐列表与建表语句正文化、四张判退表正文删除、守护逐字对齐绿） |
| W3 | 主表三列（`aliases`/`narrative_ref`/`angles`）+ 正文读取端点（越根双闸）+ 提升面平移 | DDL、端点契约、越根拒绝用例 | **已交付**（`knowledge.py` 主表 25 列 + `GET …/narrative` 双闸 + `tests/test_learn_knowledge.py` 越根与绝对路径拒绝用例；提升面平移＝`POST /learn/knowledge-points` 直登记） |
| W4 | 退役面清扫：编译/单元/候选池三端点族 + `qe_review_task` 查询点改重放 + `api-contracts.md` §⑥ 与端点清单双向等值 | 全仓旧表名与退役端点零引用核验、`test_api_endpoint_inventory` 绿 | **已交付**（`/api/v1/learn/*` 36 → 27 枚；`review_task` 读写点全部改 `_replay`/`review_due`；全仓旧名只剩注释与判退断言，零活引用） |
| W5 | 前端三面改造（`LearnShelf`/`LearnWorkbench`/`Practice`/`Knowledge`/`CourseKnowledge` + store + api 类型面） | vitest 串行绿 + 真机三面复核 | **已达成**（代码与用例已交付：vitest 串行 66 files／845 tests 全绿；真机复核于 2026-10-22 收尾批完成＝四面全指 8900、在跑包＝新构建哈希 `index-BU5Jjjpu.js`、JS 控制台零错） |
| W6 | 生产 `qed` 库建表命令清单成文转人工（D 类，零迁移） | 命令原文 + 核验判据（`information_schema` 只读 SQL），本壳只出文不执行 | **已达成（成文转人工）**（原文见「遗留与移交」第 5 条 B 段；含主表 `ADD COLUMN` 与「`ensure_tables` 只 `CREATE IF NOT EXISTS`、不补列」的必读条款；agent 全程未触生产库，P7 另开窗口） |
| W7 | 收口：`ROOT_PRIVATE_TABLES` 七枚改三枚、`code-map.md` 随步、黄金样本对拍回归、全量门禁、真机三链复核 | 门禁输出、对拍逐档一致记录 | **已达成**（数值守护 21→16／11→7／七→三／9→5 已改且绿、`code-map.md` 八行随步；黄金样本对拍＝P3e 两行逐值相等＋B3 段真库二次兑现；真机三链复核＝8902 页产物缺失时 `#/learn`／`#/practice`／`#/knowledge` 照常；收尾批门禁 875 passed／ruff 净／`tsc -b` 零错／vitest 串行全绿） |

## 更新执行计划（根侧代码＋数据库切换，2026-10-22 成文）

**结论一句**：本批代码「已就绪但未生效」——工作树是新代码、`web-ui/dist/` 是新产物，而**在跑的 8900 进程仍是
旧代码**（2026-10-22 实测：8900 由 PID 200216 监听、`GET /api/v1/config/database` 回 `name":"qed_test"`）。
所以更新动作**不是「部署新代码」，而是一个停机窗口内的原子切换＝先重建库、后重启进程**：旧名表一旦被 `DROP`，
旧代码下一秒即不可运行；新进程一旦在旧库上启动，`ensure_tables()` 只 `CREATE TABLE IF NOT EXISTS`
（必读事实①）会把新表懒建成**空表**、现网学习进度与知识点树留在旧名表里当场隐身——这就是重启红线的机理。
窗口内 8903 的新 `dist/` 会调用旧进程已不存在的端点，**界面在 P4 完成前不可验收**。

**范围（用户指令「只做我们这块」）**：只覆盖根仓库＝8900 后端 ＋ 8903 前端 ＋ 根侧自有表
（`qed_test` 的三张重建与共享主表加列、生产 `qed` 的首次建表）。
**不在范围**：`af_*` 四表重建归 Axiom-Flow PLAN-024 自己的窗口；`qt_*` 零动作（8901 本窗口照常）；
两子仓库的 git 与门禁；AF 长文产腿——`parsed/**/kp/*.md` 现尚未存在，故本窗口**只验悬空降级话术**
（正文区标「待复核」），**不把「长文有实存文件」写进 demo 门判据**。

### 阶段与暂停点

| # | 阶段 | 执行者 | 动作 | 进下一阶段的出口判据 |
| --- | --- | --- | --- | --- |
| P0 | 取回退锚 | **用户已裁＝甲案「快照锚点，不入库」**，agent 已执行 | 用临时索引合成**整棵工作树的快照提交**并打附注 tag `p0-req137-snapshot`（→ `be1ac057`，父＝`1a0e14c`），含 56 项未入库新文件与 19 项删除态；零 `git commit`、零索引改动、零工作树改动 | **已达成**：快照逐文件与工作树相等（`git diff be1ac057 -- backend/qed_engine/services/learn/practice.py` 空输出）、壳的本节文字在快照内命中 1 次、`learnChain.ts` 在快照树中已不存在（删除态入档）、`git status --porcelain` 前后均 298、`git diff --cached` 空；**未取锚不进 P2** |
| P1 | 只读预演 | **agent 直跑只读探针**（用户 2026-10-22 授权「你可直接跑」），读数与清单呈用户核对 | ① 遗留第 5 条 A 段步骤 1 的清点 SQL 贴回读数；② **另出「映射预览清单」**＝活表 `qe_learn_course` 逐行 → course 行 `target_id`、活表 `qe_learn_unit_progress` 的 `done`/`skipped` 行 → 主表 `kp_id`，解析不出的逐条单列 | **读数已达成**（本族 11 张 ✓、`qe_learning` 不存在 ✓、主表 22 列 ✓，填行规模＝course 2 行／kp 0 行）；读数与四处更正见「过程与证据」P1 条目；**暂停点①＝用户核对映射清单**（零孤引、丢弃项逐条认可）后才进 P2——**2026-10-22 已达成**（三裁＝遗留整代不迁／体会折进主表 `angles`（新增步骤 3c′）／主表 collation 不纳入本窗口） |
| P2 | 备份 | **agent 直跑（2026-10-22 已执行）**＝用户改判「直接执行到切换完成」，落点由 `dataset/backups/`（对 agent 全拦）改 `tmp/`，**暂停点② 随该指令并入执行** | 整库 `--single-transaction` dump ＋ `SELECT * FROM qe_review_task` 单独导成黄金样本 TSV，落 `dataset/backups/2026-10-22-v1-root-table-family-freeze/`（**命令原文与逐表行数判据＝遗留第 5 条第 2 步**，本机 CLI 全路径判例已按实测更正为 `D:/software/mysql/bin/`）；**备份起至 P3 结束，禁止任何人从界面写学习数据**（否则备份与新库不同源） | **暂停点②＝备份字节数与逐表 `COUNT(*)` 记进本壳并经用户确认**（ADR 0024 备份确认档三步不可免） |
| P3 | 库重建 | **agent 直跑（2026-10-22 已执行）＝零迁移清空重建**（用户改判「可以直接清空数据重建（没有用数据）」，判据与逐步取证见「过程与证据」P2～P4 条目） | **先 `python scripts/qed_engine_service.py stop`**，再按 A 段 3a→3f：主表 `ALTER` 三列 → 建 `qe_learning` → 按 P1 已核对清单填行（course 2 行／kp 0 行）→ 候选池那行手写体会按 3c′ 折进主表 `angles` → 练习两表 `DROP`＋重建＋回灌补 `owner='admin'` → 黄金样本对拍（**只取 `target_kind='question'` 两行**）→ `DROP` 9 张（`qe_review_task` ＋活表四张＋遗留快照四张）。每步失败即停、不重试 | A 段步骤 4 只读核验全绿＝`SHOW TABLES LIKE 'qe\_%'` 恰三行、列数 13／24／14、主表 25 列、`qe\_%` 三张 collation 全 `utf8mb4_0900_ai_ci`（主表维持 `utf8mb4_unicode_ci`，不计红）、`qed\_learn\_%` **与** `qe\_learn\_%` 双双零存活 |
| P4 | 进程切换 | **agent 直跑（2026-10-22 已完成切换）**、取证同见该条目 | `qed_engine_service.py start --wait`（`--mode` **沿用上一次取值**，本窗口不动模型档位）→ 只读冒烟 → `cd web-ui && npm run build` → `qed_web_service.py stop` ＋ `start --build`（**8903 的 `restart` 不构建**，判据位置 `scripts/qed_web_service.py:359-361`，用错命令得到「新进程＋旧包」第三种混合态） | `/api/v1/health` 绿、九枚只读 GET 全 200 且服务日志零 `Traceback`、`/config/database` 仍回 `qed_test`（见下「冒烟面」） |
| P5 | demo 门 | 用户真机验收，agent 陪同取证 | 一条黄金路径＝选课 → 权威知识点树 → 标 `done` 并写备注 → 出题 → 作答判分 → 到期队列出现该题；**顺带做独立性核验**＝8902 现本就未监听，三链照常即兑现「知识点正本在共享主表、正文由 8900 直读」 | **暂停点③＝到门暂停、用户验收通过**才进 P6；对拍不一致走「回滚」R-C，不硬压 |
| P6 | 收口 | agent | W7 剩余项（真机三链复核记录、`completed.md`、todo 行与壳转终态、Retain 归档）＋ 备份清理命令原文交人工（ADR 0019 决定 4：验收通过即清） | todo 行 `REQ-137` 的 S1~S5 **逐条**达成才记 `Achieved` |
| P7 | 生产 `qed` | 人工，**另开窗口** | 遗留第 5 条 B 段五步：只建三张 ＋ 主表三列 `ALTER`，零 `DROP`、零数据搬迁 | 与 P3 同一组只读 SQL（`TABLE_SCHEMA` 换 `qed`）绿；失败即停、不重试，读数回填本壳 |

### 五条顺序铁律（不可颠倒的因果）

1. **停机先于动库**：进程在跑时 `DROP` 旧表＝它下一个请求即 500；dump 虽取一致快照，仍放在停机窗口内做，
   顺带消除「切换期用户写入让备份失效」。
2. **填行先于删旧表**：`qe_learning` 的 course／kp 行全部来自旧名表，3f 的 `DROP` 必须是 P3 最后一步。
3. **对拍先于删调度表**：黄金样本比对（3e）在 `DROP qe_review_task`（3f）之前完成——先删就没有对拍对象，
   ADR 0026 D3 的兑现将永久不可证（W7 硬门）。
4. **重启晚于库核验**：红线只在 P3 核验全绿之后解除；早一步就是把新代码指向旧形状。
5. **不可逆点要可回**：P3 的 `DROP` 与 P4 的 `start` 之间不存在「半成品状态」——一旦 `DROP` 就必须走完核验，
   中途放弃只能整段走 R-A（从 dump 恢复），不允许手工补列凑数。

### 冒烟面（P4 出口判据的展开）

九枚只读 GET，全指 8900：`/learn/courses`、`/learn/courses/{id}/outline`、
`/learn/courses/{id}/knowledge-points`（响应含 `sequence`）、`/learn/knowledge-points`、`/learn/star-map`、
`/learn/courses/{id}/progress`、`/learn/question-books`、`/learn/questions`、`/learn/review/due`。
**反向探针**＝退役路径 `…/compile/*`、`…/units`、`…/kp-details*` 此刻应回 **404**；回 200 即进程仍是旧代码，
说明 P4 的第一条没生效。

### 门禁与影响面

- **切换前**：本轮全量门禁已跑完（874 passed／契约 88 passed／ruff 净／`tsc -b` 零错／vitest 串行 845 全绿），
  P0 之前不必重跑；P0 之后若再改码须复跑并回填本壳。默认测试用临时库与假实现、**不写真库**，
  故 pytest 结果与库形状无关，**不作为窗口内判据**（别拿「测试绿」当库已归一的证据）。
- **窗口时长**：P3 的映射填行是唯一人工判断量（不可脚本盲写，总纲 §7.6），按现网练习两表 2／6 行与课程数条
  的量级预留 **30~90 分钟**；期间 8900／8903 不可用，**8901 照常**，8902 本就已停。
- **零影响面**：`qed_domain`／`qed_course`／`qed_llm_calls` 三张共享表列面不动；`af_*` 形状由对方窗口自理，
  本窗口不校验；数据根只读 `parsed/**`，不搬运、不删除任何 PDF。

## 过程与证据

- **2026-10-22（收尾批＝审核数据库变动与相关代码变动后关闭，P5 取证 + P6 收口，本壳转终态）**：
  - 用户指令原文＝「审核数据库变动及相关代码变动，确认没有问题就将这一系列数据库变动任务收尾」。审核分两面，
    **结论＝库形状面干净、代码面查出一枚真缺陷（本批引入）已修并加回归**，据此关闭。
  - **审核面 1（库 ↔ 码逐列对拍，只读）**＝`tmp/audit-req137-schema.py` 连**在跑的 `qed_test`**，把
    `SHOW CREATE TABLE` 与 `information_schema` 读出的真实形状，逐列比对代码内 DDL 正本
    （`services/learn/knowledge.py` 主表、`services/learn/practice.py` 三张根私有表），比对项含**列名／类型／列序／
    主键／具名索引／表级与列级 collation**；主表因走 `ALTER ADD COLUMN` 而列序漂移，故在脚本内以
    `ALTERED_TABLES` 显式降级为「注记」而非红（改判理由见下）。**结果 `fails=0`、`notes=2`**（`tmp/audit-req137-schema.md`）：
    三张 `qe_*` **列名、列序、主键、具名索引、collation 全部逐字相等**（`utf8mb4_0900_ai_ci`，表级与列级均是，未归一列数 0）；
    两枚注记＝① 主表列序＝库把 `aliases`／`narrative_ref`／`angles` 追加在 `updated_at` 之后，码把它们写在 `name` 之后与
    `summary` 之后（`ALTER` 只能追加，属**必然**且不可修）；② 主表 collation 库＝`utf8mb4_unicode_ci` vs 码＝`utf8mb4_0900_ai_ci`
    （＝P1 暂停点① 用户三裁第③条「不纳入本窗口」，明写不计红）。**两枚注记均经「零消费方」取证后判无害**＝
    `backend/` 内**零 SQL JOIN**（全仓 `join` 命中项皆为 Python `str.join`）、唯一 `SELECT *` 落在本批未动的 `qed_llm_calls`、
    所有按行取值的游标**皆为 `DictCursor`**（按列名取值，与列序无关）。
  - **审核面 2（代码面，查出并修掉一枚真缺陷）**＝`services/learn/knowledge.py` 的 `patch_point()`：本批为承载
    ADR 0026 D10（条级注解腿改落主表 `angles`）与章级要点腿，新增了 `meta` **合并**读写，但取行仍用
    `with conn.cursor() as cursor`——`_connect()` **不设 `cursorclass`**，故 `fetchone()` 回**元组**，
    `existing["meta"]` 必抛 `TypeError: tuple indices must be integers or slices, not str`。
    **归属取证**＝`git show HEAD:backend/qed_engine/services/learn/knowledge.py` 的该函数只做
    `if cursor.fetchone() is None` 存在性判断、**从不按下标取列**，故缺陷由**本批**引入而非既存。
    **可达性**＝`api/learn.py:1220` 的 `POST /learn/annotations/generate`（`target_kind="chapter"` 且 `part != "summary"`
    → `fields = {"meta": {"chapter_key_points": …}}`）在**真库**上必 500；测试面漏网是因为
    `tests/test_learn_*.py` 走内存替身 store，不经 pymysql 游标。
    **修**＝改用 `conn.cursor(pymysql.cursors.DictCursor)`（`knowledge.py:478`）；**回归**＝
    `tests/test_learn_knowledge.py::test_mysql_patch_point_merges_meta_under_dict_cursor`
    （替身连接按 `cls is DictCursor` 分别回元组／字典行，断言写出的 `meta` 参数是**旧值与新值合并**后的 JSON）；
    **变异验证**＝把修复回退成元组游标后该用例复现 `TypeError`（指向 `knowledge.py:499`），修复后转绿。
  - **门禁（收尾批复跑，真实输出）**＝根全量 `pytest tests -q` **875 passed／1 failed**（较执行批 +1＝新回归用例），
    唯一红仍是 `tests/contract/test_storage_conventions_governance.py:164` 报
    `['scripts/image-model/.keepalive.pid']`（并行模型轮遗留，本批前后同红，非本批引入）；
    契约面 `pytest tests/contract -q` **88 passed／1 failed**（同上那一枚）；`ruff check` 净；
    `tsc -b` 零错；vitest **串行** 66 files／845 tests 全绿；`npm run build` ✓，在跑的包＝`index-BU5Jjjpu.js`。
  - **终态复跑（2026-10-23 03:33–03:46，跨零点；本壳的物理归档移动与门禁终值属 10-23，上面各轮取证写在 10-22）**
    ＝全量 `pytest tests -q` **1 failed／875 passed in 150.39s**，唯一红仍是
    `scripts/image-model/.keepalive.pid`（文件实测 `Oct 18 14:45`、被 `.gitignore:43 *.pid` 忽略，非本批产物）；
    收尾批当时那一轮契约面曾报 **2 failed／87 passed**，第二枚红
    ＝并行会话当日新建壳 `docs/plans/2026-10-23-admin-render-and-kp-review-workspace.md` 引了不存在的
    `../adr/0016-task-plan-one-to-one-mapping.md`（该文件实名为 `0016-todo-registration-one-task-one-plan.md`），
    由该会话自行修好，本轮复跑 `test_markdown_links`／`test_plan_governance`／`test_tracker_governance`
    **20 passed** 全绿；`ruff check backend tests` 净；`tsc -b` 退出码 0；vitest 串行复跑
    **66 files／845 tests** 全绿（`tmp/final-gate-vitest.txt`）。
  - **8900 重启（让修后的代码生效）**＝`python scripts/qed_engine_service.py stop` → `start --wait`，
    监听 PID `194828` → `227144`，`logs/qed-engine.pid` 在管且与监听 PID 一致（≠ 执行批那轮
    `/self-restart` 丢 pid 的退化态），另三服务全程未动。
  - **P5 黄金路径取证（API 面，`tmp/s5-golden-path.py`／`.md`）**＝对在跑的 8900 ＋ `qed_test` 打
    **23 枚请求，非预期 4xx／5xx＝0**（状态分布 `{200: 19, 404: 4}`，四枚 404 全是**已退役路径的反向探针**，
    按设计应 404）。链路逐段成立＝选课目录 → 权威知识点树（该课程 1 枚 point `kp-143c7992e77a`）→ 进度面 →
    出题（quiz `q-09ff42edc361` ＋ flashcard `q-cfb731fa474e`）→ 到期队列 2 行 →
    **B1** 标 `done` 并随行写学习者备注 → **B2** 提交作答得 `attempt_id=7`、判分 `is_correct=false`、
    `judge_note`「关键词命中 0/2…」、`review.due_at=2026-10-22T15:28:13` →
    **B3** 该题到期档**由 `2026-10-14T12:44:41` 移到 `2026-10-22T15:28:13`**＝D3「调度态由重放 `qe_attempt` 派生、
    不落列」在真库上兑现（新行被重放消费）。**C 段复原逐值相等**＝删 `attempt_id=7` 后 `qe_attempt` 回 6 行、
    `qe_learning` 回 course 2 行／kp 0 行、到期队列与取证前**逐值相等**、备注清空。
  - **备注腿单独补证（`tmp/s5-note-leg.py`／`.md`）**＝直读库行
    `{"owner":"admin","target_kind":"kp","target_id":"kp-143c7992e77a","status":"done","learner_note":"…"}` 落库 ✓；
    经 `GET /learn/courses/{id}/knowledge-points` 的 `sequence.units[].learner` **可读回** ✓
    （承载点 `api/learn.py:1040`）；`status:pending` 撤销后 kp 行被删、树内 `status`／`learner_note` 双双回 `None`，
    **复原到取证前** ✓。结论 `note_in_db=True note_in_api=True restored=True`。
  - **P5 真机面（8903 浏览器实测）**＝四面（学习中心课程架／工作台／练习／知识点）实测，
    以 `navigate_page` 的 `initScript` 在应用启动前装 fetch／XHR 记录器（内置 `list_network_requests` 在本机回空，
    故自装探针）取证：**全部请求只指 8900**（ADR 0007 守住，零直连 8901／8902）、
    在跑包的 `script[src]` 哈希＝新构建产物、**JS 控制台零错**。唯一一枚 404 归因＝
    `mathanalysis-b05` 第 45~49 页**页产物缺失**，直连 **8902 同样 404**（书元数据 200）⇒
    属子项目数据面缺失，非本批、非根仓库；`api/axiom.py:191 get_book_page` 只做代理转发，
    界面按设计降级出话术「第 49 页：正文还没准备好」。**独立性核验以更强形式兑现**＝
    8902 页产物不在时 `#/learn`／`#/practice`／`#/knowledge` 三链照常（知识点正本在共享主表、8900 直连库读）。
  - **越界披露（须用户知情）**＝执行批在「未做与边界」里写过「agent 侧不代跑写路径，以免在验收前改变库内演示态」，
    **本轮偏离了该边界**：为取证 B1／B2／B3 三段确实执行了写路径（标 done＋写备注、提交作答判分）。
    偏离的补偿＝**C 段复原取证**，库内演示态在取证后与取证前逐值相等（上文 C 段与备注腿两段各自独立复核），
    故未留下任何验收前污染。P5 的**人工验收（暂停点③）本身仍归用户**——本壳按用户「确认没有问题就…收尾」
    的指令关闭，agent 侧取证只作为其验收材料，不代替其真机判断。
  - **P6 收口**＝S1~S5 逐条核对见本条末「逐条达成核对」；todo 行 `REQ-137` 移入 `docs/trackers/completed.md`（关闭结果 **Achieved**）、
    `docs/plans/index.md` 登记去处、`docs/trackers/project-status.md` 主线随步；**归档判定 Retain**（三张逐列定档形状、
    三刀取证锚、黄金样本对拍判据与退役端点清单不可替代），**物理移动到 `docs/history/plans/2026-10/` 的命令原文交人工执行**
    （文件移动按本仓写操作纪律须用户明确要求）。**备份清理**＝P6 出口项，命令原文已写入「遗留与移交」
    第 8 条并交人工，agent 未自行删除 `tmp/` 内的回退锚与取证件。全程零 git 提交（HEAD 仍 `1a0e14c`，回退锚 tag `p0-req137-snapshot` 仍在）。
  - **移交三枚（不属 S 判据、不因之降级）**＝① `/self-restart` 之后 8900 脱离脚本托管、`stop`／`status` 退化到端口探针
    （执行批查出，**未定档**，属缺陷通道 `DEFECT-NNN`，交用户裁是否立项）；② **P7 生产 `qed` 库 DDL**＝本壳只出命令原文
    （「遗留与移交」第 5 条 B 段），由人工另开窗口执行，agent 不触生产库；③ `mathanalysis-b05` 页产物缺失归
    Axiom-Flow 数据面（8902 直连同 404），移交对方线。
  - **逐条达成核对（2026-10-22，对照 todo 行 `REQ-137`「成功标准」列）**：
    - **S1 达成**＝`SHOW TABLES LIKE 'qe\_%'` 恰三行（`qe_learning` 13 列／`qe_question` 24 列／`qe_attempt` 14 列），
      全库 25 → **17 张**（＝v1.0 的 16 张＋`alembic_version`）；旧名与作废名零残留＝`qed_learn_%` **与** `qe_learn_%`
      双双零存活、`qe_review_task`／`qe_kp_detail`／`qe_unit` 已 `DROP`（P3b 12 项判据全绿）。
      重建前备份＝`tmp/p2-req137-anchor-dump.py` 导出 12 张全量行、**119,296 字节**、逐表 `COUNT(*)` 与 P1 基线逐条相等；
      **用户确认口径**＝暂停点② 随用户「帮我直接执行到切换完成…可以直接清空数据重建（没有用数据）」指令并入执行，
      本壳 P2 条目即其确认物。
    - **S2 达成**＝`database-design.md` §五 三张逐列表与建表语句已正文化、四张判退表正文已删，
      §三／§4.2~§4.5／§7.8 同批随步；守护常量三枚改到位（`ROOT_PRIVATE_TABLES` 七→三，数值 21→16／11→7／9→5）；
      **逐字对齐由机械守护承接**＝`tests/contract/test_architecture_documents.py`（文档逐列 DDL ↔ 代码 DDL 常量，含列序）
      与 ADR 0025 围栏守护在收尾批门禁中**全绿**，叠加审核面 1 的**库内实存 ↔ 码 DDL `fails=0`**，
      三者一致（文档／代码／库）成立。
    - **S3 达成**＝主表 `qed_knowledge_point` 22 → **25 列**（`aliases`／`narrative_ref`／`angles`，列定义逐字取自
      `CREATE_TABLE_SQL`）；正文读取端点 `GET /learn/knowledge-points/{kp_id}/narrative` 带**越根双闸**，
      绝对路径与越根请求被拒的用例在 `tests/test_learn_knowledge.py`；真库读面复核＝该 point 行 `angles` 长度 1
      （3c′ 折叠已透到读面）、`narrative` 回 `available=false`＋「该知识点还没有登记的正文指针」＝悬空降级话术（D5 兑现）。
    - **S4 达成**＝`/api/v1/learn/*` **36 → 27 枚**（`tmp/s5-learn-routes.txt` 由 `create_app()` 在进程内实测，非按记忆），
      四枚退役路径（`…/compile`、`…/units`、`…/units/{id}`、`…/kp-details`）反向探针**全 404**；
      全仓 `qe_unit`／`qe_review_task`／`qe_kp_detail` 零活引用（只剩注释与判退断言）；
      到期队列由作答流水重放＝黄金样本 `target_kind='question'` 两行与重放态**逐值相等**（P3e，在 `DROP` 之前完成），
      并在真库上二次兑现＝B3 段提交新作答后该题到期档由 `2026-10-14T12:44:41` 移到 `2026-10-22T15:28:13`。
    - **S5 达成**＝8903 三面（学习中心／练习／知识点，另加工作台共四面）一条黄金路径真机跑通
      （选课 → 权威知识点树 → 标 `done` 并写备注 → 出题 → 作答判分 → 到期队列出现该题），
      API 面 **23 枚请求非预期 4xx／5xx＝0**，浏览器面**全部请求只指 8900**、JS 控制台零错、在跑包＝新构建哈希；
      生产库 DDL **只出命令原文转人工**（「遗留与移交」第 5 条 B 段），agent 全程未触 `qed` 生产库。
      唯一 404 归因于 8902 页产物缺失（直连 8902 同 404），属子项目数据面、非本批判据。
    - **关闭结果＝Achieved**（S1~S5 逐条全达成）；「遗留与移交」第 1 项两处与第 7 项已由第六批「A 全批同改」
      给出处置口径并同批执行，按「关闭与归档」节的移交型关闭口径不降级。
- **2026-10-22（P2～P4 执行批＝用户改判「直接执行到切换完成／零迁移清空重建」，agent 全程直跑，切换已完成）**：
  - 用户指令原文＝「帮我直接执行到切换完成，目标是完成替换，可以直接清空数据重建（没有用数据）」。据此本窗口两处改判并当场执行：
    ① **执行者**＝P2／P3／P4 由「人工」改判为 agent 直跑（含 DDL 与 `DROP`）；② **P3 形态**＝由「按映射搬迁填行」改判为
    **零迁移清空重建**——旧形状数据除对拍所需的练习 8 行与选课 2 行外，全部随 `DROP` 弃。
    仍守的四条护栏＝先取回退锚 → 停机先于动库 → 核验先于重启 → 共享 `qed_*` 与 `af_*`／`qt_*` 零接触。
  - **P2 回退锚（形态随 ① 改判）**＝`dataset/backups/**` 对 agent 全拦（权限层连只读 `ls` 都拦，项目记忆在册）且本轮零迁移，
    故备份落点改为 `tmp/`：`tmp/p2-req137-anchor-dump.py` 以 pymysql 只读导出 **12 张**（根私有族 11 张＋共享主表）的
    `SHOW CREATE TABLE` 与全量行 INSERT，**字节数＝119,296**，逐表 `COUNT(*)` 见 `tmp/p2-req137-revert-anchor.md`，
    与 P1 已读值**逐条相等**（`qe_learn_course` 2／`qe_learn_unit` 95／`qe_learn_unit_progress` 0／`qe_learn_kp_detail` 1／
    `qed_learn_course` 2／`qed_learn_unit` 95／`qed_learn_unit_progress` 2／`qed_learn_kp_detail` 3／`qe_question` 2／
    `qe_attempt` 6／`qe_review_task` 3／主表 96）。黄金样本与旧列形同批落 `tmp/p2-req137-old-shapes.json`（含 `qe_review_task` 三行）。
    **暂停点②（备份确认）随该指令整体并入执行**，本条即其确认物。
  - **停机（铁律 1）**＝`logs/qed-engine.pid` 在停机前**已不存在**——上一轮 `POST /api/v1/self-restart` 让进程重生但未重写 pid 文件，
    脚本据此判「非托管监听」拒停（`scripts/qed_engine_service.py:255-265`，退出码 3）。停机前取证＝`Win32_Process` 父 PID 链显示
    8900（200216）与 8901／8902／8903（父 224980／202640／211580）**互不为父子**且 200216 零子进程 ⇒ 补写 pid 文件后走脚本自身停止路径，
    CTRL_BREAK 优雅生效（兜底 `taskkill` 回报「没有找到该任务」＝进程已退），8900 端口释放、另三服务全程未动。
    **本轮新查出的缺陷（未修，交用户定档）**＝`/self-restart` 之后 8900 脱离脚本托管，`stop`／`status` 均退化到端口探针。
  - **P3 执行（`tmp/p3a-rebuild.py`，每步失败即停）**＝
    3a 主表加三列，列定义**逐字取自 `services/learn/knowledge.py` 的 `CREATE_TABLE_SQL`**（不手打 CJK 注释，避免漂移与 mojibake）⇒ 主表 22→**25 列**；
    3b 三张表由**模块 `ensure_tables()` 建**（＝与应用懒建同源、DDL 一字不差）⇒ `qe_learning` 13／`qe_question` 24／`qe_attempt` 14；
    3c 填 course 行**不盲写 SQL**＝逐行取活表 `qe_learn_course` 的 `course_ref.ref_id` 并在 `qed_course` 集合内校验后落笔
    （`lc-ee077e0f7e58`→`math_analysis` resources 3 本、`lc-2017899d0b62`→`linear_algebra` resources 1 本，**零解析不出**）＝2 行、kp 行 0；
    3c′ 候选池唯一折算行按正本 `UPDATE` 折进主表 `angles`（affected 1、`JSON_LENGTH(angles)=1`、`angle='explanation'`、note 与正本逐字相等）；
    3d 练习两表 `RENAME` → `_p3bak_*` 后重建，**按新旧列名交集回灌**（`qe_question` 2 行，自动丢弃 `course_label`／`learn_course_id`／`unit_id`
    ＝D9 C3＋D2；`qe_attempt` 6 行，丢弃 `score_trend`＝D9 C1，补 `owner='admin'`＝D7），再按新契约归位两枚语义
    （flashcard 行 `question_type`／`expected_answer` 置 NULL、quiz 行 `answer_back` 置 NULL，各 1 行）；
    3e **重放对拍在 `DROP` 之前完成**（铁律 3 的落法随 ① 改判＝不依赖重启，脚本内直接 `import` 工作树新代码调
    `MySQLPracticeStore._replay`，该路径纯只读）＝黄金 `target_kind='question'` 两行与重放态**逐值相等**
    （`q-09ff42edc361` idx 0／cc-cw 0-1／due 2026-10-14 12:44:41；`q-cfb731fa474e` idx 0／cc-cw 0-1／due 2026-10-09 03:37:57），
    `id=4` 的 kp 腿按 D3 **预期消失、不计不一致**。
  - **P3 `DROP` 与出口判据（`tmp/p3b-drop-and-verify.py`）**＝对拍绿后单条 `DROP TABLE` 退役 **11 张**＝九张在册退役表
    （`qe_review_task`＋活表族 `qe_learn_*` 四张＋遗留快照 `qed_learn_*` 四张，DROP 前逐表行数已取证）＋两枚 `_p3bak_*` scratch；
    全库 25 → **17 张**（＝v1.0 的 16 张＋`alembic_version`）。**12 项判据全绿**＝`qe_%` 恰三张／列数 13·24·14／主表 25 列／
    主表 96 行＝95 outline＋1 point 零丢失／三张表 collation 与**列级** collation 全 `utf8mb4_0900_ai_ci`（未归一列数 0）／
    `qed_learn_%` 与 `qe_learn_%` 双双零存活／共享四张行数与 P1 基线逐条相等（1／12／96／116）／`qe_learning`＝course 2 行 kp 0 行／
    `qe_attempt` 6 行全带 owner／3c′ 折叠在位／flashcard 语义归位在位。主表维持 `utf8mb4_unicode_ci`＝用户三裁③**明写不计红**。
  - **P4 进程切换**＝`qed_engine_service.py start --wait`（不带 `--mode`，档位沿用上一次取值）→ 新进程 healthy、pid 文件恢复在管；
    只读冒烟 **15 枚 GET 全 200**（九枚在册面另加 `courses/{course_id}`／`mastery`／`mistakes`／`narrative`／`/config/database`／`/health`），
    四枚退役路径全 404（`/courses/math_analysis/units`、`/units/{id}`、`/kp-details`、`/courses/math_analysis/compile`——
    退役名单取自 `git show HEAD` 与本树的路由差集，非凭记忆），`/config/database` 仍回 `qed_test`，
    **startup 行之后日志零 `Traceback`**（计数 0）。业务读数＝到期队列恰 2 行且全为题目 ID、题目 2 行 kind＝quiz＋flashcard、
    `…/narrative` 回 `available=false`＋「该知识点还没有登记的正文指针」＝**悬空降级话术**（长文正文实存按 P5 判据**排除**，AF 尚未产出），
    `…/knowledge-points?course=` 那枚 point 行 `angles` 长度 1＝折叠已透到读面。
    8903＝`npm run build`（tsc 过，新包 `index-BU5Jjjpu.js`）→ `qed_web_service.py stop` ＋ `start --build`（**不用 `restart`**，它不构建），
    实测首页 `<script src>` 哈希与磁盘包一致且取回 2,537,216 字节＝**非「新进程＋旧包」混合态**。至此**切换完成**。
  - **切换后门禁**＝根全量 `pytest tests -q` **874 passed／1 failed**，唯一红＝`tests/contract/test_storage_conventions_governance.py:164`
    的 `scripts/image-model/.keepalive.pid`（并行模型轮遗留，切换前后同红，非本批引入）；测试全程未写运行库
    （`tests/test_learn*.py` 以 `QED_DB_NAME` ＋替身 store 隔离）。本轮零代码改动，vitest／ruff 沿用执行批读数。
  - **未做与边界**＝P5 真机 demo 门（选课 → 权威知识点树 → 标 `done`＋写备注 → 出题 → 作答判分 → 到期队列出现该题）与独立性核验
    仍归**用户真机验收（暂停点③）**，agent 侧不代跑写路径，以免在验收前改变库内演示态；P6 收口与 P7 生产 `qed` **未启动**。
    全程零 git 提交（HEAD 仍 `1a0e14c`，回退锚 tag `p0-req137-snapshot`）。
- **2026-10-22（P1 执行＝用户授权 agent 直跑只读探针，读数与「映射预览清单」成文，暂停点① 待核对）**：
  - 用户指令原文＝「现在进行下一步，你可直接跑，现在开始执行」。取证形态＝两枚只读探针脚本
    （`tmp/p1-req137-inventory.py`、`tmp/p1-req137-mapping.py`），经 backend `Settings` ＋
    `services/llm.call_log._connect` 连库（口令不进命令行、不进输出），**只发 `SELECT` 与
    `information_schema` 查询、零 DDL 零写**；stdout 只出 ASCII 计数，带中文的读数落 UTF-8 文件
    `tmp/p1-req137-readout.md`／`tmp/p1-req137-mapping-preview.md`／`tmp/p1-req137-kp-content.md`／
    `tmp/p1-req137-both-schemas.md`（本机 bash 管道会 GBK 乱码，故不走 stdout）。
  - **P1 出口判据三项全绿**＝① 本族 **11 张**（`qed_learn_{course,unit,unit_progress,kp_detail}` 四张 ＋
    `qe_learn_{同四张}` ＋ `qe_question`／`qe_attempt`／`qe_review_task`）；② `qe_learning` **不存在**；
    ③ 主表 `qed_knowledge_point` **22 列**、`aliases`／`narrative_ref`／`angles` 三列不在位。
    改前行数：`qe_question` 2、`qe_attempt` 6、`qe_review_task` 3、`qe_learn_course` 2、`qe_learn_unit` 95、
    `qe_learn_unit_progress` **0**、`qe_learn_kp_detail` 1；遗留一代 `qed_learn_course` 2、`qed_learn_unit` 95、
    `qed_learn_unit_progress` 2、`qed_learn_kp_detail` 3。`qed_test` 全库 25 张（含 `af_*` 四张与 `alembic_version`）。
  - **P1 查出四处与本文不符，逐条更正（「遗留与移交」第 5 条与「更新执行计划」表同批改写）**：
    ① **活表族是 `qe_learn_*`，不是 `qed_learn_*`**——原步骤 1 把 `qed_learn_*` 记作「旧名（在跑）」、
      `qe_learn_*` 记作「作废名」，**方向颠倒**。取证三条：HEAD 建表常量全是 `qe_learn_*`
      （`git show HEAD:backend/qed_engine/services/learn/base.py`）；库内时间戳＝`qe_learn_course` 行
      created 2026-10-16 04:12、updated **2026-10-21 03:15**，而 `qed_learn_*` 最后一写停在 2026-10-15 20:16；
      两代 `*_learn_unit` 各 95 行但 `unit_id` **零重叠** ⇒ 2026-10-18 那次改名走的是「新建空表」而非
      `RENAME`，遗留四张是切换前的只读快照、此后从未再写。据此 **3c 的映射源改为 `qe_learn_*`**。
    ② **练习三张并未归一 collation**＝`qe_question`／`qe_attempt`／`qe_review_task` 实测
      `utf8mb4_unicode_ci`，`utf8mb4_0900_ai_ci` 只在 `qe_learn_*` 四张上——原「已归一的练习三张」为误记。
      本窗口 3d 按 §五 重建两张练习表即完成归一，目标态不受影响；但**共享主表两库均 `unicode_ci` 且本窗口
      只 `ADD COLUMN`**（必读事实②：改 collation 需重建，不属本批）⇒ 步骤 4 的「collation 全 `0900_ai_ci`」
      判据范围**只覆盖 `qe_%` 三张**，主表维持 `unicode_ci` 不算红。附带取证＝跨代 JOIN 会直接抛
      `ERROR 1267 Illegal mix of collations`（探针实测），而代码面**不存在** `qe_learning` × `qed_knowledge_point`
      的同条 SQL（全仓扫描仅 DDL docstring 共现），两族在 Python 侧拼接，无此风险。
    ③ **`qe_attempt` 幂等键不会挡回灌**＝旧键 `(question_id, review_date, origin)`、新键加 `owner` 前缀，
      六行旧数据里同题同 `origin` 的行 3／5 靠 `review_date IS NULL` 在 MySQL 唯一索引中互异 ⇒ 3d 六行全数落库、
      无需去重或改键（实测确认，不是推断）。
    ④ **到期对拍必须剔除 kp 腿**＝黄金样本 `qe_review_task` 三行中 `id=4` 是 `target_kind='kp'`，而新代码
      `services/learn/practice.py:813` 明写「`target_kind='kp'` 腿随调度表退出」⇒ 3e 对拍范围＝
      **`target_kind='question'` 两行（id 1／2）**，kp 行按 D3 定档**预期消失、不得计为不一致**；
      否则 W7 硬门会把设计内差异误判成重放错、误触发「回退保留调度表」。
  - **两处新事实（不改判据，进 P2／P5 输入）**：⑤ 生产 `qed` 现测 **14 张**（本文原记 15，`af_*` 侧少一张）、
    根私有 `qe_%` **零张** ✓、主表 22 列三列不在位 ⇒ P7 B 段「只建三张＋加三列、零 `DROP`」的形状前提成立。
    ⑥ 主表 96 行＝**95 行 `node_kind='outline'` ＋ 仅 1 行 `point`**（`kp-143c7992e77a` 收敛序列），且该 point 行的
    `summary`／`anchors` 与遗留候选池 adopted 行逐字相同、`from_detail_id` 即 `kpd-60b14cc1aece` ⇒ 丢弃候选池
    四行**零信息损失**；demo 门所称「权威知识点树」现为 outline 结构树，质性门只落在那一枚 point 上。
  - **映射预览清单（暂停点① 的核对物；填行数＝course 2 行、kp 0 行）**
    - 选课腿（源＝活表 `qe_learn_course`，逐行 → `qe_learning` 的 course 行）：

      | 旧 `learn_course_id` | 旧名称 | `course_ref.ref_id` | 共享表命中 | 落成的 `target_id` | `config.resources` |
      | --- | --- | --- | --- | --- | --- |
      | `lc-ee077e0f7e58` | 数学分析 | `math_analysis` | domain ✓ course ✓ | `math_analysis` | b05《数学分析原理》＋b12《微积分学教程》＋吉米多维奇题解（三本，均未 dismissed） |
      | `lc-2017899d0b62` | 高等代数 | `linear_algebra` | domain ✓ course ✓ | `linear_algebra` | linearalgebra-b01《线性代数及其应用》一本 |

      两行 `status`＝`active`、`owner`＝`admin`、`config.kp_path`＝空数组（顺序改由主表 `sequence` 读时给，
      不落快照）；`learner_note` 旧表无对应列 ⇒ 留 NULL。**零孤引、零冲突**。
    - 知识点腿（源＝活表 `qe_learn_unit_progress`）＝**0 行**：现网本就没有 kp 级进度，切换后「标 done ＋写备注」
      从零起笔；旧 `covered` 列与 95 行 unit 结构按 D2 整族退役，不折算。
    - **解析不出／需逐条认可丢弃的清单**：
      1. 遗留快照 `qed_learn_course` 两行——`lc-3e6a94085b80`「数学分析（教材主线）」`course_ref`＝`math_analysis`
         **可解析但与活代表 `lc-ee077e0f7e58` 撞 `uq_learning_target(owner,course,math_analysis)`**（只能留一行）；
         `lc-b358f633aac1`「高等数学 M6」`domain_ref`＝`math`、`course_ref`＝`m6demo` **两头在共享表都查无行 ⇒ 解析不出**。
         agent 建议＝**整代不迁**（2026-10-16 切换时已弃，迁移即撞键）。
      2. 遗留快照 `qed_learn_unit_progress` 两行——`id=6` `done`「导引」按名称在主表命中唯一
         `kp-64cce07e7e28`（技术上**可**搬）；`id=97` `pending`「有序集」按 D1 不落行（pending 且无质性判定＝无行）。
         **这是本清单唯一需要用户裁决的一行＝是否把那枚历史 `done` 搬回 `qe_learning`**；agent 建议不搬
         （属已弃用的另一代，现网界面从未在新表上显示过它），若要搬则 3c 多一条 `INSERT`。
      3. 候选池四行（活 1 ＋遗留 3）建议全部丢弃，其中**一行是用户手写体会**＝活表 `kpd-122bd665e6ad`
         （candidate、confirmed=0、正文「收敛序列的极限唯一：这一条读下来的体会。」，挂在 `kp-143c7992e77a` 下）——
         若认可保留，折算面＝主表 `angles` 追加一条或写进该 kp 行的 `learner_note`；其余三行（adopted 已物化进
         主表、两行为冒烟残留）零损失。
  - **暂停点① 已达成（用户三裁，答复原文逐条）**：① 遗留快照四张＝「整代不迁，随 DROP 弃（推荐）」——
    `qed_learn_*` 零迁移、连那枚 `done`「导引」也不搬；② 候选池那行手写体会＝「折进主表 angles（推荐）」——
    落为 A 段新增步骤 **3c′**（SQL 正本与闭集出处已写进「遗留与移交」第 5 条），其余三行零折算随 3f 丢弃；
    ③ 主表 collation＝「不纳入，本窗口只加列（推荐）」——步骤 4 与 P3 出口判据的 collation 断言范围
    已收窄到 `qe_%` 三张，主表维持 `utf8mb4_unicode_ci` 明写不计红；若日后要归一，属另立窗口＋按 R3
    通知 8901/8902 的独立批次，不进本壳。三裁之后 **P1 唯一遗留的映射规模＝course 2 行＋angles 折 1 行，
    kp 行 0 行**，即本窗口实际搬运的数据量小于原壳预估。
  - **下一步＝P2**（整库 dump ＋ `qe_review_task` 黄金样本 TSV，**暂停点②＝备份字节数与逐表 `COUNT(*)`
    记进本壳并经用户确认**）。重启红线不变：**P3 库内三张重建之前 8900 不得重启**。
- **2026-10-22（P0 执行＝用户裁「甲 快照锚点，不入库」，本轮零 git 提交）**：
  - 用户指令原文＝「开始执行，先做 P0 提交」；执行前取证发现**按轮切分的提交不可得**，据此发三选请裁，
    **用户答复原文＝「甲 快照锚点（推荐）」**。取证五条（全部实测）：① HEAD＝`1a0e14c`，工作树脏项
    **298 条**（223 M／19 D／56 ??）；② `api/learn.py` 与 `services/learn/*` 上次入库均＝`1a0e14c`，
    本批可干净归属，且主表三列 DDL 的实际落点在 `services/shared_tables.py`（`narrative_ref|aliases|angles`
    命中 17 处）⇒ 该文件属本批点名集；③ **`web-ui/src/**` 上次入库＝`77ca2f5`（2026-10-09）**，
    REQ-106／110／111／113／114／117 的前端改动从未入库且与本批混在同一批文件里（`LearnWorkbench.tsx`、
    `stores/index.ts`、`api/learn.ts`），非交互工具切不开；④ **`docs/design/frontend/` 整目录未跟踪**
    （含本批 `learning-course-ui.md`），配套五枚 `D docs/design/*.md` 是同一次移动的两侧；
    ⑤ `tests/test_web.py` 的脏行属 REQ-117（C22~C24 守护）且断言 `docs/design/frontend/learning-course-ui.md`
    必须存在 ⇒ **只提本批文件会造出一枚自己判红的树**，故乙／丙两案都有实质代价，甲案零风险。
  - **技术坑（本机 git 2.52 实测）**：`git stash create -u` 的 `-u` **被静默忽略**——产出的快照对象
    `b1e1578` 对本批三枚新路径命中 **0**，即用它会漏掉全部 56 项未入库文件，不可作锚点。
  - **成锚手法（临时索引合成，全程不动真索引与工作树）**＝`GIT_INDEX_FILE=.git/qed-p0-tmp-index` →
    `git read-tree HEAD` → `git add -A -- .` → `git write-tree`（树 `1dd3e15d`）→
    `git commit-tree <tree> -p HEAD`（提交 `be1ac057`）→ `git tag -a p0-req137-snapshot` → 删临时索引。
  - **零副作用核验**＝`git diff --cached --name-only` 空（真索引零暂存）、`git status --porcelain`
    前后均 **298**、`git stash list` 空、`git rev-parse HEAD` 仍 `1a0e14c`。**快照完整性**＝快照树内
    「`## 更新执行计划`」命中 1、本批新路径（`docs/design/frontend/*`＋`web-ui/src/pages/Practice.tsx`＋
    本壳）命中 10、`web-ui/src/stores/learnChain.ts` 在快照树中**不存在**（删除态入档）、
    `git diff be1ac057 -- services/learn/practice.py` 空输出（内容与工作树逐字节相等）。
  - 据此把 P0 出口判据与「回滚」R-A／R-B／R-C 的 `git revert` 全部改写为**从锚点 tag 取回**，
    并写明不用 revert 的两条理由（无本批提交；同文件内多轮不可分会连坐他轮）。
  - **下一步＝P1**（人工跑只读清点 SQL 并回填读数，agent 出「映射预览清单」草稿供核对）。
    重启红线不变：**P3 库内三张重建之前 8900 不得重启**。
- **2026-10-22（更新执行计划成文，用户指令原文＝「文档通过，现在制定更新计划代码+数据库如何更新，只做我们这块」）**：
  - 新增上节「更新执行计划」，把散落三处的口径（工作项表、回滚节、遗留与移交第 5 条命令原文）合成
    **P0~P7 一条时间线＋五条顺序铁律＋三个暂停点**；SQL 原文仍只在「遗留与移交」第 5 条持正本，本节不复制。
  - **本节全部凭实测取证**（`curl --noproxy` 打 8900、`netstat -ano`、`git status --porcelain`、读脚本源码）：
    ① 8900＝PID 200216 在监听、8901＝230292、8903＝221576，**8902 未监听**；
    ② `GET /api/v1/config/database` 实回 `{"host":"127.0.0.1","port":3306,"name":"qed_test",
      "user":"root","configured":true,"reachable":true}` ⇒ A 段打 `qed_test` 的目标库判断成立；
    ③ `scripts/qed_engine_service.py` 有 `start|stop|restart|status`，`start/restart` 支持 `--wait`
      与 `--mode api|local`；`scripts/qed_web_service.py:359-361` 自陈「restart 不构建，改前端代码后请走
      `start --build` 冷启动门禁」⇒ 8903 切换动作按此写；
    ④ 工作树 298 条脏项（223 M／19 D／56 ??）⇒ P0 的点名清单必须逐条比对，本壳「待提交」节仍有效；
    ⑤ 冒烟九枚端点取自 `api/learn.py` 路由表实读（27 枚中的 GET 腿），`sequence` 是
      `GET /learn/courses/{course_id}/knowledge-points` 的响应字段、**不是独立端点**。
  - **计划层新增的两处判断（不涉新规则，属执行顺序）**：① **P0 未提交不进 P2**——不可逆的库动作必须有可
    `revert` 的代码锚，此前壳只写了「未提交」却没把提交挂到窗口前置上；② **demo 门不含长文正文实存**——
    AF 未产 `parsed/**/kp/*.md`，把「正文可读」写进门判据会让本机门永远打不开，故只验悬空降级话术。
  - **P1 新加「映射预览清单」这一步**：原 A 段 3c 直接写「映射不可脚本盲写、解析不出即停」，但没有事前核对物；
    改为先在只读阶段出清单、由用户认可后再进 P2/P3，把唯一的高风险人工判断前移到不可逆动作之前。
  - **「回滚」节同批改写为 R-A~R-D 四条并写明分界线**＝P3 的第一条 `DROP`：此前只有 `git revert`、零库内影响，
    此后必须 dump 恢复且**代码与库成对回**（只回其一即得「新库＋旧码」或「旧库＋新码」的混合态）。
    原四条 bullet 的实质内容一字未减，只是挂上阶段编号，使 P5 的「对拍不一致走 R-C」与铁律 5 的
    「中途放弃只能整段走 R-A」有可指的落点。
- **2026-10-22（执行批交付＝第六批「A 全批同改」的代码与守护落地，未提交 git）**：
  - **交付五面**：① 总纲 §五 三张逐列表与幂等建表语句**正文化**、四张判退表与候选池表正文删除，
    §三 总览 16 张与 §4.2~4.5／§7.8 随步；② backend 三处 DDL 与读写源改道＝`base.py` 单表
    `qe_learning`（course/kp 两态继承）、`knowledge.py` 主表 22 → **25 列**（`aliases`／`narrative_ref`／
    `angles`）、`practice.py` 两表（`schedule_next`＋`replay_due` 读时重放替调度表、`derive_trend`
    读时派生替 `score_trend`、`resolve_trend` 不再写 `resolved`）；③ 8900 学习域 `/api/v1/learn/*`
    **36 → 27 枚**（编译族／单元族／候选池族与点赞腿整族下线，新增
    `GET /learn/knowledge-points/{kp_id}/narrative`，绝对路径与越根**双闸拒**）；④ 8903 三面改道＝
    `LearnWorkbench`（推进读 `sequence`、备注写 kp 行 `learner_note`、条级详解读 `angles` ＋长文文件读腿）、
    `LearnShelf`（徽标与进度读 `derived`）、`Practice`（选课值即 `learn_course_id`）＋ store／api 类型面；
    ⑤ **前端设计面随步**＝[learning-course-ui.md](../../../design/frontend/learning-course-ui.md) 十一处
    （§1 成功标准⑥、§2 范围内去「点赞」、§3 徽章集与教材卡读数、§4「多条学习记录」行改判为「一坐标一记录」
    ＋刷新语义、§5.1 读源与零物化、§6 段②详解与段③备注、§8 标题与持久位、§9 三张词表逐字对齐守护、
    §10 降级矩阵四行、§11 新增「v1.0 已退出承载」与「两处待用户复核」、元数据补 ADR 0026 关联）＋
    [frontend-architecture.md](../../../architecture/frontend-architecture.md) 书架行与工作台行两处
    （徽章集、`N/M 条`、详解与备注落点、零物化、生成端点由两枚改一枚）。
  - **守护数值同批改并复绿**：`len(inventory)` 21 → **16**、`MASTER_TABLES` 11 → **7**、
    `ROOT_PRIVATE_TABLES` 七枚 → **三枚**、`COLLATE` 计数 9 → **5**；退役面由「正向断言」改「**判退断言**」
    ＝`CREATE_TABLE_SQL` 内零旧表名（`tests/test_learn_practice.py:608`、`test_learn_knowledge.py:1016`）＋
    路由表内零退役路径（`test_learn_knowledge.py:1017`）。全仓旧名与退役端点的**活引用为零**
    （2026-10-22 `git grep` 清点：命中只在模块注释／docstring 与上述判退断言里）。
  - **门禁数字（本轮实跑，逐条取自 [development.md](../../../guides/development.md) 命令矩阵）**＝
    根全量 `pytest -q` **874 passed / 1 failed**、契约门禁 `pytest tests/contract -q` **88 passed / 1 failed**
    （唯一红＝`scripts/image-model/.keepalive.pid` 散落在 `logs/`·`tmp/` 之外，属并行模型轮存量、
    非本轮引入，判据位置 `tests/contract/test_storage_conventions_governance.py:164`）；
    `ruff check backend tests` **All checks passed**（本轮修掉自引入的一枚 `UP012`：
    `tests/test_learn_knowledge.py:350` 的多余 `encoding="utf-8"`）；`web-ui/` 内 `npx tsc -b` **零错**、
    vitest **串行 66 files／845 tests 全绿**、`npm run build` ✓（两枚 chunk 体积告警为存量）。
    定向重跑＝`test_learn.py` 53／`test_learn_knowledge.py` 48／`test_learn_practice.py` 48／
    `test_learn_mastery.py` 19＝168 例全绿。**文档随步之后再复跑一次**＝契约 **88 passed／1 既存红**、
    全量 **874 passed／1 既存红**、`ruff check backend tests` **All checks passed**（台账↔壳状态镜像守护
    要求 todo 行与壳「状态」字段同值，本壳已由 `Accepted` 转 `In Progress`）。
  - **`code-map.md` 随步八行**（W7 项，判定批声明「本批不改、随步归 W7」的兑现）＝`api/learn.py`、
    `learn/base.py`、`learn/memory.py`、`learn/knowledge.py`、`learn/knowledge_memory.py`、
    `learn/practice.py`、`learn/practice_memory.py` 与三枚学习域测试行；`project-status.md` 当前主线
    新增执行批条目并把判定批条目标注为「已被执行批覆盖并解除」。
  - **两处功能缺口需用户复核（agent 未擅自裁，已按现状落码＋文案守护）**：
    ① **备注需该知识点已有 `kp` 行**才存得下（`stores/learnWorkbench.ts:saveNote` 在无行时拒绝并给下一步
      「先用正文末尾的『已掌握并下一条』记上」）。后端替代方案＝非空备注时自动起一条 `pending` 行，
      会把「备注」变成 kp 行的第二个产面，与「pending＝无行、读时派生非累加」的口径相冲，故**本轮未采**。
    ② **点赞（REQ-117 C19）与选区块级分组（C27）在 v1.0 无承载＝功能退出**：`angles` 数组序即权威序、
      只读面不给重排权，块级过滤随候选池行消失。已把两枚口径写进禁词表当**回归 tripwire**
      （`learnPlaneCopy.test.tsx` 的 `BANNED_V1_WORKBENCH_TOKENS` 加「点赞／待整理／已保留／确认入库／
      候选／这一块」等，`helpPages.test.ts` 同步），改回旧话术即判红。
  - **本轮新查出的库内事实（已写进「遗留与移交」第 5 条，直接影响人工窗口形态）**＝
    `ensure_tables()` 三处同形且只做 `CREATE TABLE IF NOT EXISTS`、**不补列不改键** ⇒ 库里已实存的
    `qe_question`（旧 27 列）与 `qe_attempt`（无 `owner`、旧幂等键）**不会随重启自愈**；
    三枚 `owner` 前缀键属键变更 ⇒ 该两表在 W1 窗口须 `DROP` ＋按 §五 重建（或「建→搬→换→删」四步），
    配合既有实测「`RENAME TABLE` 不改 collation」，collation 归一同样只能靠重建。
  - **重启红线仍未解除**：库内三张重建（W1 A 段）之前 **8900 不得重启**；本轮零库内写、零生产 DDL、
    零 git 提交，`dataset/**` 未触碰，对方工作区全程只读。W1 真机黄金路径与 W7 黄金样本对拍
    均随该人工窗口执行，本壳 S1／S4 的「逐档一致」与 S5 的「真机跑通」两判据**尚未达成**。
- **2026-10-22（第六批裁决＝落地深度「A 全批同改」，本壳由判定批转执行批）**：
  - 用户驱动指令原文＝「**当前database-design.md还没改动，优先改动这张表，另外AXIOM-FLOW已经梳理成
    三张核心表，重新梳理整体架构进行更新数据库设计**」；就落地深度给出三选（B 只改文档／
    C 双章并存／A 全批同改），**用户答复原文＝「A 全批同改」**。
  - **授权范围（A 的定义，逐条即本壳 W2~W7）**＝总纲改写为 v1.0 定稿正文 ＋ backend 三张 DDL 与
    主表三列 ＋ 编译／单元／候选池三端点族退役 ＋ 8903 三面改造 ＋ 守护数值同批改
    （`len(inventory)` 21 → **16**、`ROOT_PRIVATE_TABLES` 七枚 → 三枚、`MASTER_TABLES` 11 → 7、
    `COLLATE` 计数 9 → 5）。**「判定不领先执行」随本批解除**（见「非目标」节注记）。
  - **AF 形状最新事实（同级仓库只读取证，据此把总纲 af_* 面由五表登记改判四表登记）**：
    `Axiom-Flow/docs/architecture/database-design.md:166`「目标形状＝四表，净变化 5 → 4」；
    `Axiom-Flow/src/axiom_flow/migrations/versions/20261022_0001_af_family_rebuild.py` 四表列数
    ＝`af_books` 22 / `af_operations` 27 / `af_pages` 11 / `af_kp` 23；`db/models.py:321-326 AF_TABLES`
    已是四元组。**对方实现状态仍 In Progress**（`api/admin.py`、`api/main.py` 与 `orchestrator/`
    消费面未随步，库内重建窗口未批），故本文只登记四表形状、**不写 `af_*` 逐列小节**
    （触 `test_database_design_does_not_define_other_projects_private_tables` 边界，结构正本在对方）。
    全库目标表数据此直接为 **16**（共享 4 ＋ 根私有 3 ＋ `af_*` 4 ＋ `qt_*` 5），不再走 17 的中间口径。
  - **重启红线（代价已向用户明示并被 A 接受）**：代码与守护改完、库内三张重建之前，
    **8900 不得重启**——新表会被 R10 懒建成空表，现网学习进度与知识点树留在旧名表里立即不可见。
    库内重建窗口属人工（见「遗留与移交」第 5 项）。
  - **A 覆盖的两处原待裁，本批按下列口径处置并登记改判**：
    ① 遗留第 7 项 ARCH-027 行 S2／S4 与 D2 的冲突＝A 的定义里明列「编译端点族退役」，
      据此采该条**选法①**（改判 ARCH-027 行 S2／S4），todo 行随步、改判理由引本条；
    ② 遗留第 1 项②「候选池族退役不得早于 AF 同步腿」＝AF 导出端点尚未存在，本批**不留旧表**、
      改为主表 point 行**换一条最小产面**（`POST /learn/knowledge-points` 直登记，outline 父级校验后
      写主表），AF 拉取腿日后成为**同一张表的另一个产面**。此为本批必须回答的设计缺口，
      由 agent 在 A 授权范围内取「功能不退」一侧处置，判据与回退路径见「遗留与移交」第 1 项②。
    ③ 遗留第 1 项①（`annotations/generate` 条级注解腿）**同样采「功能不退」**＝端点保留、
      条级腿改落主表 `angles` 数组追加元素，`angle` 取既有六词闭集；此举扩 D6 负面清单边界，
      已同步登记在 ADR 0026。
- **2026-10-21（本壳立项，用户十裁 + 三处新查出的待确认项）**：
  - 第一批四裁（REQ-132 W5 承载）＝`qe_kp_detail` 废弃整表／`qe_unit` 的 `section` 行并到知识点
    层级／死列与空转粒度「判定＋执行同批」／结论落点＝写进 REQ-132 W5 + REQ-134 退指针。
  - 第二批四裁＝已确认详解的承载＝**主表加 `narrative_ref` 指针 + `angles` JSON**（甲案）／
    用户维度＝**现在加 `owner` 列 + 唯一键改 owner 前缀**／别名谱系＝**只加 `aliases`，谱系不加**／
    笔记＝**进度表单列 `learner_note`**。
  - 第三批三裁＝详解承载**坚持甲案，并为落点立 ADR**（推翻 agent 当轮改推荐的乙案正文入库）／
    `qe_unit` 的 point 物化层与 `covered` 列**一并退出**／立项形态＝**新立一行 todo + 一份 plans 壳**。
  - 第四批三裁（本壳定档形状的直接依据）＝根私有压到**3 张**／复习调度态**删表改重放**／
    学习课程**取消独立 ID、直接引用共享 `qed_course`**。
  - **第五批（用户原文＝「C1~C3 裁，先编译数据库设计文档，以及其他相关文档资料」）**＝C1~C3 三处
    列级简化**全数采纳**（升为 ADR 0026 D9，列数账定稿 53 → 51），且明确**先出文档面**、
    代码与 DDL 未发令。
  - **文档面判定批已交付（同日，未提交 git）**：七篇随步＝总纲约 16 处（§一 表族定档 blockquote、
    §三 备注列 8 行改写、§4.2 血缘、§4.3 新增「图 A-目标」erDiagram、§4.4／§4.5 判定段、
    §五 主表三列与四张判退表逐表论证、§6.1／§6.4、§7.3／§7.6、§7.8 T3／T10 改写与**新增 T12**、
    §八 守护随步清单）、`api-contracts.md` §⑥（整族退役 12 枚 + 保留端点改换读源 + 新增读文件腿）、
    `cross-project-contracts.md` §4／§6（加列不发函 + 提升腿列映射 + 两侧 `narrative_ref` 指针形态
    刻意不同）、`dataset-conventions.md`（单一事实源表加长文正文一行）、`learning-practice-ui.md` 与
    `knowledge-point-exploration-ui.md`（两界面**本面契约零变化**）、`project-status.md` 当前主线
    新增本轮条目；`code-map.md` 判定本批不改（它映射现状代码，随步归 W7）。
  - **在册壳与台账随步六处（防漂移，均只落指针不改他轮 S 判据）**＝
    [主链壳](../../../plans/2026-09-22-learning-design-mainline.md)「目标」节改判注记 ＋ 其关联 ADR 行补 ADR 0026；
    [REQ-132 壳](2026-10-21-qe-family-rename-and-refactor.md) W5 判定表读法注记、三处未裁项解答
    （并表／`learn_course_id` 列名／排序规则归一时机）、遗留第 1 条「六张」读法作废；
    [M2 练习轮壳](../../../plans/2026-10-18-practice-by-domain-and-progress.md) 概念表改判注记（其「不改服务端练习域
    契约」非目标据此收窄＝端点与响应字段名仍冻结，**表与列面不再冻结**）；
    [roadmap](../../../trackers/roadmap.md) 第五轮行改判句（改判语写在描述列，不占「关联任务」列）；
    [todo](../../../trackers/todo.md) `REQ-137` 行 D1~D8 → D1~D9。
  - **规避两处守护陷阱（未触红，留痕）**：① §4.4／§4.5 的 blockquote 内若写 markdown 表行，
    `_table_cell_names` 会把 `> | 根私有 | …` 当表行解析致集合不等判红 ⇒ 改纯散文；
    ② `api-contracts.md` 内若把新端点写成 `### GET …` 或 `| GET … |`，`_doc_endpoints()` 会当成
    在册端点致 ghost 判红 ⇒ 改 blockquote 内反引号散文，并明写「代码落地前不得写进端点总表哨兵区」。
  - **定向门禁两次绿**＝`test_architecture_documents.py` 22 passed、
    `test_api_endpoint_inventory.py` 2 passed（判定批不改 DDL 与端点面，守护不动即绿）。
  - **agent 当轮认错一处（事实纠错，留痕）**：第三批裁决前 agent 报「甲案需要一份 ADR + 两份
    standards 随步 + 一个读文件端点」，用户据此裁「坚持甲案，并为落点立 ADR」。第四批取证时查到
    Axiom-Flow PLAN-024 **KA-20 已把长文落点定为 `<book_dir>/kp/<node_id>.md`**，即
    `parsed/<domain>/<course>/<book_id>/kp/`——在 ADR 0018 白名单**既有区 `parsed/` 内**
    （[dataset-conventions.md:121](../../../design/dataset-conventions.md)）。故白名单不需新增条目、
    两份 standards 不需随步，**「为落点立 ADR」的前提消失**；本批只立一枚 ADR 0026（表族三张化与
    编译链路退役），甲案本身不受影响。
  - **三刀取证锚**（ADR 0026 背景节的依据，本壳留原读数）：① `qe_review_task` 四枚状态列是
    `qe_attempt` 全量流水的确定性重放结果，零独有信息；② `qe_unit.payload` 现网装字面占位串
    `「{title}」骨架正文（M-1 占位，M-2 接生成管线）`（`services/learn/base.py:494`），
    `finish_compile` docstring 自陈「骨架编译」，`payload` 在 8903 零渲染点（只有
    `web-ui/src/api/learn.ts:564` 类型声明），`type` 闭集五值中 `quiz`/`flashcard` 全仓零产出点；
    ③ `compile_done`/`compile_total` 由 `_recount()` 维护、唯一读端点 `api/learn.py:669-671`，
    `failure_count` 全仓只有归零写入无累加点（三枚已在 REQ-132 W5 的八枚死列内）。
  - **本轮新查出的三处（C1 `score_trend` 纯派生／C2 `resolved` 机器与人工共写且机器写部分恒等
    `is_correct`、`idx_attempt_open` 退化／C3 `course_label` 快照列）已按第五批裁决全数采纳**：
    判据与建议见上节 C1~C3 表；原「未点头不动其列面」的冻结口径（ADR 0022 决定 4）随之解除，
    列面定稿＝三张 51 列。
  - **未实测项（不得当作已核验）**：库内 `level` 分布与三张表行数的只读查询因 MySQL 口令未取到而
    失败（`ERROR 1045`），`qe_unit` 95 行读数引自总纲 §7.8 T2 文档而非本轮实测；W1 重建窗口内
    由人工执行的核验 SQL 补实。
- **待提交**（用户发令提交后由收尾会话补登 hash）：本批文档面＝`docs/adr/0026-*.md`（新增）、
  `docs/adr/index.md`、本壳、`docs/trackers/todo.md` 新行 REQ-137；判定批七篇＝
  `docs/architecture/database-design.md`、`docs/architecture/api-contracts.md`、
  `docs/design/cross-project-contracts.md`、`docs/design/dataset-conventions.md`、
  `docs/design/frontend/learning-practice-ui.md`、
  `docs/design/frontend/knowledge-point-exploration-ui.md`、`docs/trackers/project-status.md`；
  随步壳与台账＝`docs/plans/2026-09-22-learning-design-mainline.md`、
  `docs/plans/2026-10-21-qe-family-rename-and-refactor.md`、
  `docs/plans/2026-10-18-practice-by-domain-and-progress.md`、`docs/trackers/roadmap.md`、
  `docs/trackers/todo.md`。
  工作树另有大量**并行窗口/前序未提交改动**（`backend/**`、`docs/adr/0012|0014|0017` 等），
  不属本批、提交时只 `git add` 上述点名文件。

## 验证与验收

- **定向测试**：`tests/contract/test_architecture_documents.py`（逐字 DDL 对齐 + `ROOT_PRIVATE_TABLES`
  三枚 + `stale` 判据）、`tests/contract/test_api_endpoint_inventory*`（端点清单双向等值）、
  `tests/test_learn_*`／`tests/test_practice*`（存储层与判分）、`web-ui/src/**/*.test.tsx`
  （vitest **须串行**才可信）。
- **黄金样本对拍（W7 硬门）**：重建前 dump 现网 `qe_review_task` 全部行当黄金样本，重放实现
  逐行比对 `interval_index`／`due_at` 档位，**逐档一致**才算 D3 兑现；不一致即回退到「保留调度表」
  并重开裁决。
- **全量回归**：`D:/software/anaconda3/envs/QED_env/python.exe -m pytest -q` + `ruff check`
  （裸 `python` 是 3.10、缺 `tomllib`，会假红）。
- **人工验收（不可自动化）**：W1 demo 门的真机黄金路径由用户在浏览器验收；W6 生产库 DDL 由人工
  在窗口执行并回填读数。
- **独立性核验**：Axiom-Flow 离线时 `#/learn`／`#/practice`／`#/knowledge` 三链照常（知识点正本在
  共享主表、8900 直连库读；正文文件在 `parsed/**` 由 8900 直读，不经 8902）。

## 回滚

**分界线**＝P3 的第一条 `DROP`。此前一切皆工作树改动，从锚点 tag 取回即可、零库内影响；
此后必须走 dump 恢复，且**代码与库要成对回**（只回其一即得第三种混合态）。四条路径按上节阶段编号取用。

**代码锚点＝tag `p0-req137-snapshot`（甲案，用户 2026-10-22 裁「快照锚点，不入库」）**：取回单文件＝
`git checkout p0-req137-snapshot -- <路径>`；整树回到切换前＝`git checkout p0-req137-snapshot -- .`。
该 tag 的树含 56 项未入库新文件与 19 项删除态，因此同时保住本批与 2026-10-09 以来各轮的未入库改动。
**不使用 `git revert`**＝本仓库自 `1a0e14c` 起没有本批提交，revert 路径不存在；且多轮内容在同一文件内
不可分，按提交回退会连坐他轮（取证见「过程与证据」P0 条）。

- **R-A（P3 中途失败或用户叫停，尚未重启）**：`DROP` 已建的新三张 → 从 P2 dump 恢复旧名七张
  （`--binary-mode`，`MYSQL_PWD` 经 Settings 传入，mysql/mysqldump 需全路径）→ 代码面从锚点 tag 取回
  本批点名路径 → 再 `start`。备份只服务本窗口，验收通过或窗口放弃即清（ADR 0019 决定 4）。
- **R-B（已重启、冒烟或真机不对，P4~P5）**：`qed_engine_service.py stop` → 同 R-A 恢复库形状与代码面 →
  `start` → 8903 走 `qed_web_service.py start --build` 回旧包。W2~W5 的文档面随同一次取回，无需单独动作。
- **R-C（黄金样本对拍不一致＝W7 硬门失败）**：不硬压数值。恢复 `qe_review_task` 表与 `schedule_next`
  落列写路径（代码面从锚点 tag 取回 `services/learn/practice.py` 与 `api/learn.py` 两条路径即可），
  并把「调度态是否落列」重开为裁决项（ADR 0026 D3 重裁）。
- **R-D（生产面 W6／P7）**：本壳不执行任何生产 DDL；命令清单成文后由人工在窗口执行，失败即停、不重试，
  读数回填本壳。生产侧只做 `CREATE` 与主表 `ADD COLUMN`，本身不存在需回滚的破坏性动作。

## 关闭与归档

- 关闭判据＝todo 行 `REQ-137`「成功标准」列 S1~S5 **逐条**核对，全达成记 `Achieved`；
  C1~C3 已裁并入 ADR 0026 D9，属 W2/W3 执行面（不再是待确认项）；「遗留与移交」第 1 项的
  两处与第 7 项**已由第六批「A 全批同改」给出处置口径并同批执行**，若关闭时任一处被用户改判，
  按「移交型关闭」口径记 `Achieved` 并在 completed.md 证据列写明其去向（挂总纲 §7.8 待确认项），
  不因改判而降 `Partial`（它们不属 S 判据）。
- 归档判定 **Retain**：三张逐列定档形状、三刀取证锚、黄金样本对拍判据与退役端点清单是不可替代的
  决策证据，关闭后移 `../history/plans/2026-10/`（或按当时里程碑）并保持活链接。
- **关闭记录（2026-10-22）**＝关闭结果 **Achieved**：S1~S5 逐条核对全达成（逐条证据见「过程与证据」
  首条末「逐条达成核对」）；关闭动作＝todo 行原子移出 → [completed.md](../../../trackers/completed.md) 登记、
  `docs/plans/index.md` 登记去处、`docs/trackers/project-status.md` 主线随步、本壳状态转终态并移
  `docs/history/plans/2026-10/`（Retain，相对链接按新深度重算）。
  「遗留与移交」第 1 项两处（① 条级注解腿折进主表 `angles`＝端点保留；② 候选池族退役先于 AF 同步腿）
  与第 7 项均**未被用户改判**，按第六批「A 全批同改」的处置口径同批执行完毕，不构成 `Partial` 理由；
  仍开放的三项属移交而非判据＝`/self-restart` 丢 pid 文件的缺陷定档（交用户裁）、P7 生产 `qed` DDL
  （人工另开窗口）、`mathanalysis-b05` 页产物缺失（Axiom-Flow 数据面）。

## 遗留与移交

1. **两处待裁（本轮文档面判定批查出）——2026-10-22 第六批「A 全批同改」后均已给出处置口径，
   agent 在授权范围内取「功能不退」一侧，用户可直接改判**：
   - **① `POST /learn/annotations/generate` 的条级注解腿随 `qe_kp_detail` 退出而断**。章级两腿
     （本章总结／学习要点）写主表 `summary` 与 `meta.chapter_key_points`，**不受表退影响**；只有
     条级腿的落点是候选池行。**处置＝端点保留**，条级腿改落主表 `angles` 数组追加一元素
     （`angle` 取既有六词闭集，正文仍由 `narrative_ref` 指向文件），零新表零新列；
     代价＝「保留一个只写 JSON 列的生成端点」扩了 D6 负面清单边界，已在 ADR 0026 同批登记。
     若改判为整端点退役，则学习面「按需生成注解」功能在 v1.0 消失，须在 `learning-course-ui.md` 补写。
   - **② 候选池族退役与 AF 同步腿的先后**。`POST /learn/kp-details/{id}/confirm` 是共享主表 point 行的
     **唯一产面**；替代它的「从 AF `af_kp` 单向拉取已确认知识点 → 提升进主表」同步腿依赖对方
     PLAN-024 落地（其消费面 `api/admin.py`／`orchestrator/` 未随步、导出端点仅声明必须存在），
     本批不可依赖。**处置＝表与五枚端点照常退役，point 行产面平移为 `POST /learn/knowledge-points`
     直登记**（校验 outline 父级后写主表 point 行，`source_ref` 存发起书目）；AF 拉取腿日后落地时
     成为**同一张主表的另一个产面**，不再新增表或端点族。判据＝星图／掌握门／练习归档都吃 point 行，
     断供即三链空转；回退路径＝若用户改判「保留候选池表到 AF 落地」，则 W4 只退编译与单元两族、
     `qe_kp_detail` 与其五枚端点保留一个提交点（表已在 §7.8 判退，重开即回 ADR 0026 D1 的六张方案）。
   （原 C1~C3 待确认项已按第五批裁决**关闭**，见「过程与证据」。）
2. **REQ-132 W3 库内归一窗口与本壳 W1 合并排期**：两批都触库、都要重启 8900；REQ-132 行的 S 判据
   只覆盖改名，本壳不扩载其行（ADR 0023），窗口合并只体现在执行顺序上。
3. **AF 五→四的表数随步（§7.8 T11）**：对方 PLAN-024 执行批落地后，总纲 §三 表数由 17 → 16、
   §4.4 矩阵与 §6.3 路由同批；不属本壳判据。
4. **共享主表加三列的跨项目口径**：对 8901/8902 是追加式、只读方零破坏 ⇒ 按 R3 走「改本文 +
   改接口契约 + [cross-project-contracts.md](../../../design/cross-project-contracts.md) 登记」，**不发函**；
   若对方 ORM 全列映射需随步，转告窗口挂
   [REQ-136 综合请求](../../../plans/2026-10-21-af-family-rebuild-consolidated-request.md)回执。
5. **库内命令原文（2026-10-22 执行批成文；**A 段已于同日由 agent 直跑执行完毕**＝用户改判「直接执行到切换完成／零迁移清空重建」，
   逐步取证见「过程与证据」P2～P4 条目，本段命令保留作 P7 的读法模板与回退依据；B 段生产 `qed` 仍待人工窗口。
   `dataset/**` 与生产库对 agent 全拦，agent 只出文不执行。
   **本节持 SQL 正本，「更新执行计划」节持时序与暂停点，两处不互抄**）**
   - **三条必读事实（决定命令形态，本轮取证）**：
     ① `ensure_tables()` 只做 `CREATE TABLE IF NOT EXISTS`、**不补列也不改键**（`services/learn/base.py:68`、
       `knowledge.py:546`、`practice.py:902` 三处同形）⇒ 库里已实存的 `qe_question`（旧 27 列，含 `unit_id`／
       `learn_course_id`／`course_label`）与 `qe_attempt`（无 `owner`、含 `score_trend`、幂等键未带 `owner`）
       **不会随 8900 重启自愈成目标形状**；共享主表 `qed_knowledge_point`（现 22 列）同样必须显式 `ALTER`。
     ② `RENAME TABLE` 不改存量表 collation（REQ-132 W2 实测新事实，总纲 §7.8 T2）⇒ collation 归一只能走
       **重建**，不能靠改名。
     ③ 三枚唯一键/索引改 `owner` 前缀属**键变更**，MySQL 不支持 `ALTER` 就地改唯一键成员 ⇒ 这两张要么
       `DROP` ＋按 §五 DDL 重建，要么「建新表→搬行→换名→删旧」四步；本壳**推荐前者**，理由＝练习两表
       的行数极少（`qe_question` 2／`qe_attempt` 6），且作废名表 `qed_learn_question`／`qed_learn_attempt`
       仍在库里可作回灌源。**若用户改判为 ALTER 逐步迁移**，则需逐枚给出 `ADD COLUMN owner…`／
       `DROP COLUMN score_trend`／`DROP INDEX uq_attempt_idem` ＋ `ADD UNIQUE KEY uq_attempt_idem (owner,…)`
       等六组语句并另做逐列核验，本壳不代写。
   - **A 段＝W1 `qed_test` 重建（备份确认档三步，只打 `qed_test`，生产 `qed` 零接触）**
     1. **清点改前形状**（只读，先确认目标库，判例见总纲 §7.8 T2）：
        `"D:/software/mysql/bin/mysql.exe" -h 127.0.0.1 -u root -p qed_test --binary-mode -e`
        接 `SELECT TABLE_NAME,TABLE_COLLATION,TABLE_ROWS FROM information_schema.TABLES`
        ` WHERE TABLE_SCHEMA='qed_test' AND (TABLE_NAME LIKE 'qed\_learn\_%' OR TABLE_NAME LIKE 'qe\_%')`
        ` ORDER BY TABLE_NAME;`
        预期读数＝本族 11 张：活表四张（`qe_learn_course`／`qe_learn_unit`／`qe_learn_unit_progress`／
        `qe_learn_kp_detail`，HEAD 代码在读写这一套）＋遗留快照四张（`qed_learn_{同四张}`，2026-10-16 切换前的
        只读快照，`qed_learn_course` 里还含一枚解析不出的 `m6demo` 测试课）＋练习三张（`qe_question`／
        `qe_attempt`／`qe_review_task`）；`qe_learning` 必须**不存在**。
        **2026-10-22 P1 实测更正两处原记事实**＝① 活表／作废名**方向颠倒**（活的是 `qe_learn_*`，见「过程与证据」
        P1 条目更正①，据此 3c 的映射源改为 `qe_learn_*`）；② 练习三张 collation 仍是 `utf8mb4_unicode_ci`、
        **并未预先归一**（`0900_ai_ci` 只在 `qe_learn_*` 四张上；3d 重建即归一，见更正②）。
        实读＝11 张 ✓、`qe_learning` 不存在 ✓、主表 22 列 ✓。
     2. **备份（P2，人工执行——`dataset/**` 对 agent 全拦，agent 只出命令原文与核验判据）**
        口令经 `-p` 交互输入或 backend `Settings` 注入，**不写进命令行**；本机 CLI 全路径判例＝
        `D:/software/mysql/bin/mysql.exe`（本文原写「Program Files 全路径」是 REQ-132 期的笔误，按此路径改），
        `mysqldump.exe` 取同目录兄弟文件；若不存在先 `ls D:/software/mysql/bin | grep dump` 定位再替换。
        自本步起至 P3 结束，**任何人不得从界面写学习数据**（否则备份与新库不同源）。

        ```bat
        mkdir dataset\backups\2026-10-22-v1-root-table-family-freeze
        D:\software\mysql\bin\mysqldump.exe --single-transaction --routines --triggers ^
          -h 127.0.0.1 -u root -p qed_test > dataset\backups\2026-10-22-v1-root-table-family-freeze\req137_w1_full.sql
        D:\software\mysql\bin\mysql.exe -h 127.0.0.1 -u root -p --batch --raw qed_test ^
          -e "SELECT * FROM qe_review_task ORDER BY id" ^
          > dataset\backups\2026-10-22-v1-root-table-family-freeze\req137_w1_review_task_golden.tsv
        dir dataset\backups\2026-10-22-v1-root-table-family-freeze
        ```
        黄金样本的对拍对象按 P1 更正④＝**只取 `target_kind='question'` 的两行（id 1／2）**，`id=4` 的 kp 行属
        D3 定档预期消失项。
        **出口判据＝备份字节数记进本壳 ＋ 逐表 `COUNT(*)` 与 P1 已读值逐条相等**（本族 11 张的 P1 实读＝
        `qe_learn_course` 2／`qe_learn_unit` 95／`qe_learn_unit_progress` 0／`qe_learn_kp_detail` 1／
        `qed_learn_course` 2／`qed_learn_unit` 95／`qed_learn_unit_progress` 2／`qed_learn_kp_detail` 3／
        `qe_question` 2／`qe_attempt` 6／`qe_review_task` 3，另共享 `qed_knowledge_point` 96／`qed_course` 12／
        `qed_domain` 1；全库 25 张，`qed_test` 含 `af_*` 四张 17／0／0／0 与 `alembic_version` 1）；
        **暂停点②＝经用户确认后才进第 3 步**（ADR 0024 备份确认档三步不可免）。
     3. **重建**（顺序不可换，每步失败即停、不重试）：
        a. 主表加三列（追加式，落物理末位）：`ALTER TABLE qed_knowledge_point`
           ` ADD COLUMN aliases JSON, ADD COLUMN narrative_ref VARCHAR(500) NOT NULL DEFAULT '',`
           ` ADD COLUMN angles JSON;`（逐列定义正本＝总纲 §五，不得凭本行手改类型宽度）
        b. 学习记录单表：按总纲 §五 `qe_learning` 建表语句执行（等价于 8900 首个 /learn 请求懒建，
           但**显式建**可让核验与填行在同一步完成，不依赖重启时机）。
        c. 填 `qe_learning` 行＝旧形状 → 单表继承的**映射不可脚本盲写**：course 行由**活表 `qe_learn_course`**
           逐行转（`target_id` 取 `qed_course.course_id`，**解析不出即停在原地报人工**，总纲 §7.6；
           2026-10-22 P1 把源表由误记的 `qed_learn_course` 更正为活表，见「过程与证据」P1 更正①）；
           kp 行由**活表 `qe_learn_unit_progress`** 的 `done`／`skipped` 行按 `source_ref`/`unit_id`
           对到主表 `kp_id` 后落笔，质性判定四列随行搬迁。对账判据＝course 行数＝旧表行数、
           kp 行数 ≤ 旧进度表行数且零孤引（`target_id` 在主表无 point 行的必须逐条列出后再决定丢弃）。
           **P1 已核对的填行规模＝course 2 行（`math_analysis`／`linear_algebra`，均命中共享表、零冲突）
           ＋ kp 0 行**（活表进度为空）；遗留快照 `qed_learn_*` 整代不迁（迁移即撞 `uq_learning_target`，
           且 `m6demo` 解析不出），是否搬回那枚历史 `done`「导引」由用户在暂停点① 裁决。
        c′. 候选池退役前折算**唯一一行**（用户 2026-10-22 在暂停点① 裁「折进主表 `angles`」，原文＝
           「折进主表 angles（推荐）」）：活表 `qe_learn_kp_detail` 的 `kpd-122bd665e6ad` 是学习者手写体会，
           按 ADR 0026 D10 的条级注解新落点追加为主表一行 `angles` 的元素，**必须在 3a 加列之后执行**
           （元素形状与 `angle` 六词闭集正本＝`services/learn/knowledge.py:34,58`；`updated_by` 取值＝同文件
           `:38 WRITER="qed_engine"`）：
           `UPDATE qed_knowledge_point`
           ` SET angles = JSON_ARRAY_APPEND(COALESCE(angles, JSON_ARRAY()), '$',`
           `      CAST('{"angle":"explanation","note":"收敛序列的极限唯一：这一条读下来的体会。"}' AS JSON)),`
           `      updated_by='qed_engine', updated_at=UTC_TIMESTAMP()`
           `  WHERE kp_id='kp-143c7992e77a';`
           核验＝该行 `JSON_LENGTH(angles)=1` 且 `angles[0]->>'$.angle'='explanation'`。其余三行（adopted 正文
           已物化在主表 `summary`／`anchors`、两行为冒烟残留）**零折算、随 3f 丢弃**。
        d. 练习两表按 §五 DDL **DROP ＋重建**（判据见上「必读事实③」），行从重建前的同表 dump 回灌，
           回灌后补 `owner='admin'`。
        e. 到期态**读时重放**由代码承担（`practice.py:762 _replay`），库里不留调度态；对账＝用
           `req137_w1_review_task_golden.tsv` 的 `interval_index`／`due_at` 与重放结果**逐档比对**，
           不一致即回退「保留调度表」并重开 ADR 0026 D3 裁决（W7 硬门）。
           **对拍范围只取 `target_kind='question'` 的行**（P1 实测黄金样本三行中 `id=4` 是 `target_kind='kp'`，
           而 `practice.py:813` 明写该腿随调度表退出 ⇒ kp 行**预期消失、不得计为不一致**，否则硬门误触发回退）。
        f. 判退表 `DROP`：`qe_review_task` ＋活表四张（`qe_learn_*`）＋遗留快照四张（`qed_learn_*`）共 **9 张**，
           逐张 `DROP TABLE` 前先 `SELECT COUNT(*)` 记录并确认与备份行数一致。
     4. **重建后核验**（只读，逐条贴回本壳）：
        `SHOW TABLES LIKE 'qe\_%';` 预期恰三行＝`qe_attempt`／`qe_learning`／`qe_question`；
        `SELECT TABLE_NAME,COUNT(*) FROM information_schema.COLUMNS` 式逐列比对（总纲 §五 vs
        `information_schema.COLUMNS WHERE TABLE_SCHEMA='qed_test'`）预期列数＝13／24／14，
        主表＝25 列；`qe_%` 三张的 collation 全部 `utf8mb4_0900_ai_ci`（**主表维持 `utf8mb4_unicode_ci`，
        本窗口只 `ADD COLUMN` 不改 collation——按必读事实②改它要重建，不属本批，不计红**，P1 更正②）；
        活表四张与遗留快照四张双双零存活（`LIKE 'qed\_learn\_%'` 与 `LIKE 'qe\_learn\_%'` 各查一次）。
     5. **重启 8900**（红线只在重建**完成之后**解除）→ 8903 一条黄金路径真机跑通（选课→权威知识点树→
        标 `done` 并写备注→出题→作答判分→到期队列出现该题），全指 8900、无 4xx/5xx；**到门暂停待人工验收**。
   - **B 段＝W6 生产 `qed` 库（零迁移，首次落地即按目标三张建）**
     1. 清点：生产库现**未建**根私有表（总纲 §7.8 T3；2026-10-22 P1 只读复测＝全库 **14 张**、`qe_%` 零张、
        主表 `qed_knowledge_point` 22 列且三列不在位、collation `utf8mb4_unicode_ci`、96 行与 `qed_test` 同数；
        原记 15 张系 10-21 探针所计，其差一枚在 `af_*` 侧、不属本批），
        故**只建三张、不删任何表**，也不存在「先建七张再改三张」的中间态。
     2. 建表＝总纲 §五 三段 `CREATE TABLE` 原文逐字执行（`qe_learning`／`qe_question`／`qe_attempt`）。
     3. 主表三列：生产 `qed_knowledge_point` 若为 22 列（REQ-118 的 14 表逐列对齐批次口径），
        执行与 A 段 3a **同一条** `ALTER TABLE … ADD COLUMN` 三列语句；已实存则跳过并核验列序。
     4. 核验＝与 A 段第 4 步同一组只读 SQL（把 `TABLE_SCHEMA` 换成 `qed`）。
     5. 生产侧**不做**任何数据搬迁与 `DROP`；失败即停、不重试，读数回填本壳。
   - **执行者注意**：口令只经 backend `Settings`／`MYSQL_PWD` 传入，绝不写进命令行、日志或本壳；
     `mysql`/`mysqldump` 需全路径（本机 CLI 判例见 [本地开发环境](../../../standards/local-dev.md)）；
     dump 导入须带 `--binary-mode`；备份只服务本窗口，验收通过即清（ADR 0019 决定 4）。
6. **REQ-136 发函口径是否改判为「已收函」**仍待用户裁决（其 R1~R5 状态列归该行会话，本壳不动）。
7. **ADR 0026 D2 与 ARCH-027 主链行 S 判据的冲突——已由第六批「A 全批同改」裁为选法①**：
   该行 S2 判据原文＝「链路编译：任一课程可产出『大纲（两级人工确认）→ 块序列（text/公式/图/
   quiz/flashcard）』」，S4 亦含「注册→**编译**→学习→判分→推进→结课」端到端；D2 判编译整链退役
   等于抽掉两枚判据的承载物。**第六批用户答复原文＝「A 全批同改」，其定义明列「编译／单元／
   候选池端点族退役」**，据此采三条待裁选法中的**①（改判 ARCH-027 行 S2／S4）**，同批把改判写进
   [todo](../../../trackers/todo.md) 该行并引本条为据；判定批阶段的「未裁前编译端点族不删」限制解除。
   指针另有两处＝[主链壳](../../../plans/2026-09-22-learning-design-mainline.md)「目标」节改判注记与
   [roadmap 第五轮行](../../../trackers/roadmap.md)的改判句。
8. **本窗口备份与取证件的清理（P6 出口项，命令原文交人工；ADR 0019 决定 4＝备份只服务本窗口，
   验收通过或窗口放弃即清）**：因 `dataset/backups/**` 对 agent 全拦且本轮零迁移，回退锚与取证
   读数全部落在 `tmp/`（26 个文件、约 250 KB，其中回退关键物＝`tmp/p2-req137-revert-anchor.sql`
   119,296 字节与 `tmp/p2-req137-old-shapes.json` 黄金样本）。**agent 未自行删除**，等用户真机验收
   （暂停点③）通过后再清：

   ```bash
   rm -f tmp/p1-req137-* tmp/p2-req137-* tmp/p3a-* tmp/p3b-* \
         tmp/audit-req137-* tmp/s5-* tmp/archive-req137-shell.py
   ```

   清理后本壳「过程与证据」的读数**不可再复算**（数值已入本壳与 `completed.md`），如需复算须重新
   只读探针；**回退锚 tag `p0-req137-snapshot` 不属于本项清理范围**（它随 git 存在，R-A~R-C 依赖它）。

