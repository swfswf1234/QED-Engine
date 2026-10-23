# 管理台文档解析渲染与知识点梳理两屏核心流程核查与实施设计（admin-render-and-kp-review-workspace）

状态：In Progress
任务类型：B
最后更新：2026-10-23
关联 ADR：[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)（解析能力与 `af_*` 表族归 Axiom-Flow）、
[ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md)（一任务一行一壳）、
[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）、
[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（1.0 前重建档位、demo 门、范围锁死）、
[ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md)（前缀即所有权）、
[ADR 0026](../adr/0026-v1-root-table-family-freeze.md)（根私有三张；主表 `aliases`／`narrative_ref`／`angles`；D6 负面清单）
关联设计：[REQ-116 壳](2026-10-15-doc-analysis-processing.md)（「文档分析处理」四职责与 `#/admin/analysis` 定名在册正本）、
[REQ-131 集群总纲壳](2026-10-20-doc-knowledge-cluster-master-outline.md)（C-1／C-4／C-5／C-6 仍未裁、阶段一／二切分、候选池归 AF 的定档）、
[REQ-136 综合请求壳](2026-10-21-af-family-rebuild-consolidated-request.md)（发往 Axiom-Flow 的在册请求面）、
[REQ-134 壳](2026-10-21-af-table-architecture-design.md)（af_ 承载设计，已退为指针，其两表前提本轮待更正）、
[REQ-137 壳（已归档）](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md)（主表三列与两条腿的交付来源）、
Axiom-Flow [knowledge-analysis.md](../../Axiom-Flow/docs/design/knowledge-analysis.md)（`KA-1~KA-28`，Accepted／实现状态 Not Started）、
Axiom-Flow [database-design.md](../../Axiom-Flow/docs/architecture/database-design.md)（`af_kp` 逐列与不变式）、
本仓库 [parsing-ui.md](../design/frontend/parsing-ui.md)、[frontend-overview.md](../design/frontend/frontend-overview.md)、
[api-contracts.md](../architecture/api-contracts.md) §⑥、[code-map.md](../architecture/code-map.md)
关联 Tracker：docs/trackers/todo.md（REQ-138 任务行）
归档判定：Retain（两屏的核心流程核查证据、缺口归属判定与用户裁决过程属不可替代的过程记录；
实施结论晋升 `design/frontend/` 后本壳仍作缺口—裁决—落地三件事的对账凭据）

## 目标与成功标准

**目标**：把 8903 管理台的两件事一次界定清楚并核查到可执行——① 「文档解析管理」按用户口径重构为
**每页准确、完整、格式正确地渲染文字＋图片，解析结果按段落切分且人工可修正**（不涉语义、不梳理知识点），
它是后续课程学习与课后练习显示的唯一内容源；② 新增**知识点梳理**屏按用户四步走
（判章并用书内目录互验 → 由目录定知识点目录并剔前置／后置 → 生成章节总结与学习导读 → 梳理章下知识点、
人工调整确认后可总结），形态为左栏目录（可编辑）／中栏章节正文（去页框拼成）／右栏可折叠的信息面
（章节总结、学习导读、知识点划分与总结）；课程有两本以上教材分析完毕后，在该屏做跨书知识点合并。

验收判据的唯一正本在 [todo.md](../trackers/todo.md) REQ-138 行的「成功标准」列（S1~S5），本壳不复制条目。
本轮交付＝S1／S2／S3 的正文（核查、归属判定、待裁点成文），实施批次待用户裁决与放行后才开工。

## 范围与非目标

**范围（根侧）**：

1. 两屏的核心流程核查（逐步骤对在册条文与真实代码取证，列出缺口并给承载归属）。
2. 解析渲染侧的根侧缺口修复（前端接线、8900 透传补齐、批量取数）。
3. 梳理屏的工作区形态与读写面设计，并在 8902 梳理通路就绪前把**阶段一（不等对方）**的边界钉住。
4. 跨书知识点合并的承载判定（现有可用面＝共享主表 `aliases`／`name`／`from_detail_id`）。
5. 核查查出的三处文档事实漂移的更正提请（本壳「遗留与移交」节）。

**非目标（各归其主）**：

- `af_kp` 的列与键变更、梳理算法与提示词配方、`section_kind`／`confirm_state`／`op_kind='kp'` 的写者、
  8902 的 kp 端点与只读导出面 → **Axiom-Flow**（其 PLAN-024 W10 待立项；本壳只发请求不改对方代码）。
- 共享主表 DDL 与列面 → [database-design.md](../architecture/database-design.md) 总纲 ＋ [ADR 0026](../adr/0026-v1-root-table-family-freeze.md)。
- 模块定名与导航形态（合一 vs 并列）→ REQ-131 的 C-1，未裁即不改 REQ-116 在册定名。
- 学习面（`#/learn`、`#/practice`）的消费改造 → ARCH-027 主链与各消费面行。
- 检索与知识图谱线（ARCH-025）；习题关联与学习链路编排是否留在本模块由 Q2 裁，本壳不预设。
- 真机数据窗口与生产 `qed` 库 DDL → 人工（D 类）。

## 前置条件

1. 一册**有生效解析版本**的真书可用；无生效版本的书不得作为 demo 门取证样本（AF `KA-1` 受理门前置）。
   **2026-10-23 真机窗口后＝已满足**：用户当日开窗口，`mathanalysis-b05`（数学分析原理）全本解析完成＝
   job `4af1b233c252`（engine `mineru`）**completed 317/317、failed=0**、`af_pages` 恰 317 行全 `parsed`、
   `af_books.active_job_id=4af1b233c252`（版本已激活）、`GET …/pages/1` 由 404 转 200。逐条实测读数见「过程与证据」
   末行与「窗口前置读数与取证清单」节的 V1~V6 打勾。中间代际记两笔：本条曾于当日晨写「当前不满足」（对方整族重建后
   `af_pages` 为空、17 本全未入库），该状态已被本次窗口解除；更早的「现网唯一已验通路＝b05 全本已激活」属重建前代际，只作历史。
   同批入库但**未解析**的书＝`mathanalysis-b07`（数学分析习题集，439 页，`af_pages` 0 行、`versions/` 空）。
2. 8900／8902／8903 三服务同钉 `qed_test`（改码后须重启，8903 须 `npm run build` 才见新包）。
3. 梳理段的自动生成腿依赖 AF PLAN-024 **W10**；本轮不假设其存在，凡依赖它的条目一律标「阻塞于对方」。
4. 用户裁决 Q1~Q7（下一节）方可把 demo 门范围钉成实施判据；未答者保持待定，不按本壳推荐默认采纳。

## 核心流程核查（本轮交付）

### 你的四步 ↔ 在册承载

| 步 | 用户口径 | 在册正本承载 | 现状 | 缺口 |
| --- | --- | --- | --- | --- |
| 一 | 先判「章」，简单且正确的划分，书内目录与实际章节互验 | AF `KA-5` 目录阶段＋`KA-6` 两层＋`af_kp` outline 行 | 条文在、表在、通路零实现 | 「书面原目录 ↔ 实际章节互验」在 `KA-1~KA-28` **无条文** ⇒ 需 AF 新请求（Q7） |
| 二 | 由目录定知识点目录，剔前言／目录／致谢／附录 | `af_kp.section_kind` 列（即为前置／正文／后置分类而设）＋`KA-7` 未归档池 | **列建而无写者** | 剔除规则与 `section_kind` 写者皆无 ⇒ Q7 同批发对方 |
| 三 | 章节知识总结＋学习导读（是什么／起什么作用／怎么学好／怎么算学会） | `af_kp.summary`（≤1000）＋`narrative_ref` 长文（`KA-20` 落 `<book_dir>/kp/<node_id>.md`）；根侧主表 `narrative_ref`＋`angles` | 根侧读正文腿已在（`learn.py:1080`），写腿无 | 导读四要素落在 ADR 0026 D5 的 `angles` 六词闭集之外 ⇒ Q5；正文由谁写 ⇒ 乙面 W10（对方 PLAN-025），`narrative_ref` 路径口径两处相左 ⇒ 甲段 A4 归一请求 |
| 四 | 章下知识点梳理，人工可调、可确认，调整后总结 | `af_kp` point 行＋`KA-11/13/14` 人工位＋`KA-15` 导出面；根侧 `POST /learn/knowledge-points`（`learn.py:995`）＋`from_detail_id` 锚 | 根侧直登记腿在；8902 无 kp 端点；8903 无屏 | 「确认」按 `KA-11` 只有 AF 侧人工可写 ⇒ **已随 Q3 裁决收口**＝阶段一的编辑与确认落根侧 8900 自有写面（不打 8902），对方 `confirm` 端点就绪后阶段二再归一 |

### 缺口清单（P1~P9，按阻塞度排序）

| # | 现象 | 证据锚 | 后果 | 出口 |
| --- | --- | --- | --- | --- |
| P1 | 梳理段零对接面 | AF `main.py` 全 19 枚端点无 `kp`；`KA-23` 的 `qed_llm_calls` 本侧写入未实现；对方 todo PLAN-024 行「W10 为其实现批，待立项」 | 梳理屏若现在造生成腿＝在根侧重开第二候选池，违 C-2 定档与「前缀即所有权」 | 阶段一不等对方（Q3）；生成腿挂 AF W10 |
| P2 | 图片块渲染断链 | `web-ui/src/components/parsing/BlockList.tsx:90-94`（仅当 `pageImageUrl` 非空才出 `<ImageCrop>`）／`CompareView.tsx:155-169`（未传该 prop）／`bookPageImageUrl` 只被 `PageImagePane.tsx:235` 使用／8900 端点已在 `backend/qed_engine/api/axiom.py:214` | 「必要的文字和**图片**渲染出来」这条核心口径在解析管理右栏是断的，图块只出题注 | W2 前端接线（一行 props 级改动＋vitest 守护） |
| P3 | 段落级人工修正不落库 | AF `main.py:492` `PUT …/structure`（全量声明、缺席即撤销、幂等、几何锚落 `af_operations` 意图行）在 8900 透传清单（`axiom.py:138-348`）**无对应**；8900 只有 `:285` 逐块 edit | 前端并块／删块／加框只能本地预览，刷新即丢（REQ-099 R2 在册欠账） | W2 补透传＋UI 接线 |
| P4 | 中栏拼章无页区间承载 | `af_kp` 无 `page_start/page_end`；`KA-5` 目录阶段只读 heading＋`section_kind`＋页序；`KA-25` 的页区间只是批次入参不落列 | 「去掉书页拼成一章」的页集合没有判据位，章边界只能由展示侧临时发明 | **已裁（Q4＝甲案）**：由该节全部 point 行 `anchors[].page` 取 min/max 读时派生，零改表；派生不出时人工补起止页（丙案兜底），两枚失效形态须 W1 真机取证 |
| P5 | 拼章是 N 次 HTTP | AF 只有逐页 `main.py:434`；`GET …/pages` 清单（`:392`）在 8900 亦无透传 | 整章正文＝逐页请求，页多时首屏明显卡；也无法原子拿到「一章的页集」 | W2：8900 侧加聚合端点或批量透传（先判形状再动码） |
| P6 | 跨书合并零承载 | ADR 0026 D6 声称谱系列正本在 `af_kp.dedup_of`，**该列在 Axiom-Flow 全仓零命中**（Grep 证实）；候选池 `qe_kp_detail` 已退役 | 用户要的「别名／定主名／合并或增加」只剩 `aliases`＋`name`＋`from_detail_id`＋直登记腿；文档里承诺的承载不存在 | Q6 裁承载；P6 的文档事实错走「遗留与移交」第 3 项更正 |
| P7 | 在册名与用户叫法不一致 | 用户口称「ARCH-027-M4」，其在册行现为「学习设计轮 M4·知识探索（问答与召回消费面，后置）」`todo.md:21`；梳理段在册载体是 REQ-116「文档分析处理」`#/admin/analysis`（用户 2026-10-18 亲裁）；REQ-131 的 C-1 至今未裁 | 若默默按「知识点梳理」新建屏＝与在册定名并行两套，导航与 DesignRef 双写 | **命名已由用户裁定＝「知识点梳理」**（2026-10-23），路由与格数仍待裁；随步清单见「命名随步与路由待定」节，定档前不改 REQ-116 在册名 |
| P8 | 本会话早先产物的前提漂移 | REQ-134 壳仍写「净新增两枚窄表 `af_kp_nodes`／`af_kp_edges`」，实存已是 `af_kp` 单表＋`af_operations` 折叠；总纲 §7.8 T8 读数 `20260928_0001` 因对方迁移链重置为唯一 base `20261022_0001` 而失效 | 后续按旧壳形状施工即造第二事实源 | 「遗留与移交」第 1／2 项更正（本壳不代改他文档） |
| P9 | 台账编号与归档位变化 | REQ-137 行与壳已由并行会话收口归档（`docs/history/plans/2026-10/`），本行取 REQ-138 | 引用路径若按旧位写即死链 | 本壳所有指针已按归档位书写 |

## 待用户裁决点（Q1~Q7）

**状态＝Q3／Q4 已裁、Q1 只答命名半项、Q2／Q5~Q7 未答。** 本壳只把选项与代价写清，不代裁、不把推荐当默认；
未答者保持待定，按其裁决再回填。

| # | 待裁 | 选项与代价 |
| --- | --- | --- |
| Q1 | 模块定名与导航形态（＝REQ-131 的 C-1） | **命名半项已裁（2026-10-23 用户裁定）＝模块中文名「知识点梳理」**，不再沿用「文档分析处理」。导航半项仍未答＝路由是否从 `#/admin/analysis` 改为新段、以及与「文档解析管理」并列两格还是合一单屏；随步清单见「命名随步与路由待定」节，未定档前不改 REQ-116 壳标题与其镜像行（两者逐字耦合，半改必红镜像守护） |
| Q2 | REQ-116 四职责的③学习链路编排、④习题关联是否仍属本模块 | 保留＝本壳范围含两腿；摘出＝分别挂回主链／练习行。你的四步未提及二者，按 ADR 0024 范围锁死不自行扩缩 |
| Q3 | 阶段一是否不等 AF W10 | **已裁（2026-10-23 用户裁定，原文＝「Q3 阶段不等对方，先做好前端界面」）＝不等对方**。据此本轮边界＝demo 门（W1）只走根侧腿（逐页渲染＋图片裁切＋按章拼正文＋人工直登记＋经 8900 读回长文正文），梳理屏的**界面与人工面**（左／中／右三栏、目录编辑模式、知识点划分的编辑与确认落 8900 自有写面）先行做齐；LLM 生成腿（乙／丙两段＝对方 W10）后置，交付后再接。用户已接受过渡代价＝阶段一的知识点全靠人工敲 |
| Q4 | 章→页区间的判据位 | **已裁（2026-10-23 用户裁定，原文＝「选择甲・派生，继续后续的工作」）＝甲・派生**：拼章时由该节全部 point 行 `anchors[].page` 取 min/max（零改表、零迁移）。据此**乙案作废**（不向 Axiom-Flow 请求 `page_start`／`page_end` 两列，REQ-139 的条件项 X1 同批作废）；丙案降为**兜底**＝派生不出时（章内零 point 行）由人工在目录编辑模式补起止页落根侧 `meta`，本轮不为其开工。三案的具体含义与甲案的失效形态见下节「页区间三案」 |
| Q5 | 学习导读的落点 | 甲＝整篇走长文文件（`KA-20`）＋主表 `narrative_ref` 指针，「怎么学好／怎么算学会」写在正文里；乙＝拆成 `angles` 元素（须改 ADR 0026 D5 的六词闭集，新增取值即触该 ADR 改判）。推荐甲（闭集不动、无 ALTER） |
| Q6 | 跨书合并／别名判定的承载 | 甲＝根侧共享主表面做工作台（`aliases`＋`name`＋`from_detail_id`＋直登记），合并谱系留痕进 `meta`；乙＝向 AF 请求 `af_kp` 增谱系列列并明写 `dedup_of` 的正本归属。推荐甲起步（AF 明文说跨书合并归根侧），代价＝合并史只有一处可查 |
| Q7 | 「书内目录 ↔ 实际章节互验」与「前置／后置剔除」两条规则 | 甲＝并入 REQ-136 线发对方，作为 `KA-` 新条文与 `section_kind` 写者；乙＝阶段二一并移交。推荐甲（规则属分析算法，根侧实现即第二事实源）。**发函事实登记**＝两规则已随 W7 以甲段 A2／A3 进入 **REQ-139** 承接请求（2026-10-23 发函），本条待裁的是「若对方拒绝则由谁实现」，不是「是否发函」 |

### 页区间三案的具体含义（Q4 展开）

**问题本质**＝中栏要「去掉书页把一章拼成正文」，必须先回答「第 X 章由哪些页组成」；这个答案存在哪儿，
就是 Q4。现两侧都**没有页区间列**：`af_kp` 的 outline 行只有层级／标题／`summary`／`anchors`／`meta`
（`KA-25` 的「整本或单章」只是**批次入参**，不落列、事后不可查），根侧共享主表 `qed_knowledge_point` 的
列面同形（`anchors` JSON 带 `page`，`meta` 是扩展槽）。

| 案 | 具体怎么做 | 判据位是什么 | 代价与失效形态 | 是否改表 |
| --- | --- | --- | --- | --- |
| 甲・派生 | 拼章时取该节全部 point 行的 `anchors[].page`，`min`＝起页、`max`＝止页（两侧同形 JSON，`af_kp` 与根侧主表都适用），再按区间批量取页 | **读时算出的派生值**，库里没有「第 X 章＝第 a~b 页」这条事实 | 章内零 point 行（新判的节、抽取失败的节）派生不出＝中栏空白；边界完全被锚点质量决定，末章易越界进致谢／附录；须与 `KA-14` 的「锚点可回指」前置校验同读，否则拼出的是错页 | 零改表、零迁移 |
| 乙・加列 | 请 Axiom-Flow 给 `af_kp` 的 outline 行加 `page_start`／`page_end` 两列，判章时由机器写、人工在目录编辑模式可改 | 边界成为**库内事实**，一句 SQL 即得页集，且「拼章」与「剔前置／后置」共用同一判据位 | 触 ADR 0024 重建档位＝对方唯一 base 迁移 `20261022_0001` 之上要出新迁移＋`qed`／`qed_test` 两库 ALTER＋其 DDL 逐字守护与根侧总纲 §7.8 读数同批随步；跨仓排期依赖对方（本案不代改） | **改表**（属本函条件项） |
| 丙・人工指定 | 阶段一在目录编辑模式给每一节填起止页，写进**根侧**共享主表 outline 行的 `meta`（如 `meta.page_range`，扩展槽只读不筛，零 DDL；先例＝REQ-117 C20 的 `meta.chapter_key_points`） | 边界是**人工背书的事实**，且不必等对方任何通路即可用 | 要人工逐节填；阶段二对方通路就绪后须与 `section_kind`／（若裁乙）页区间列归一，同一事实两处存＝待消的双源，归一判据须届时写明以哪侧为准 | 零改 AF、零迁移 |

**裁决与后续关系（2026-10-23）**＝Q4 已裁**甲案**，故甲案是唯一判据位：页区间读时派生、库里不落
「第 X 章＝第 a~b 页」这条事实。三条连带约束据此生效——① 甲案的两枚失效形态（**章内零 point 行派生不出
＝中栏空白**、**末章边界易越界进致谢／附录**）必须在 demo 门（W1）真机取证，不许只在单测里造数据；
② 派生依赖锚点质量 ⇒ 与 `KA-14`「锚点可回指」前置校验同读，该校验属对方条文（已随 REQ-139 甲段发出）；
③ **甲案仍依赖对方的批量取页端点**（P5 的 N 次 HTTP 与派生无关，故 REQ-139 的 C7 不因 Q4 裁甲而撤）。
丙案只在派生不出时作人工兜底、本轮不单独开工；乙案作废，本函的条件项 X1 已按此改判删除请求面。

## Axiom-Flow 本轮承接清单与命名随步（梳理稿）

用户 2026-10-23 裁定本轮 Axiom-Flow 跟着改，先出梳理稿。**取证结论先说**：对方列面已为你的四步备齐大部分位置，
缺的全是**写者与条文**，因此本清单**全部零 ALTER、零新迁移**——唯一可能触列的页区间已由 Q4 裁为甲案（读时派生）。

### 关键新证据（推翻本壳初判的两条）

| 事实 | 锚 | 对流程的意义 |
| --- | --- | --- |
| `af_pages.section_kind` 闭集＝`cover`/`preface`/`ack`/`toc`/`chapter`/`appendix`/`back`/`other`，`''`＝未判，且明文「要能可筛可判；版本换代走页行继承机制不重判」 | Axiom-Flow [database-design.md:367](../../Axiom-Flow/docs/architecture/database-design.md) | **P4 与第二步同时有解**：`toc` 值给出「书内目录所在页」的定位（第一步互验的输入面），`cover`/`preface`/`ack`/`appendix`/`back` 给出「剔前言致谢附录」的判定域；初判说「剔除规则无承载」是错的，正确说法是**有值域、无写者、无条文** |
| `af_kp` 的 outline 行可写 `summary`（≤1000）与 `narrative_ref`（长文指针，`''`＝无） | 同上 `:401`／`:404` | 第三步「章节总结＋学习导读」= 章级 `summary` ＋章级长文文件，**根侧 `angles` 六词闭集不必扩**（Q5 的甲案有了对方列面背书） |
| `af_kp.book_id` 行原文＝「跨书合并归根侧主表」 | 同上 `:388` | 课程级合并的归属**对方已明文判归根侧**，Q6 走甲不需对方向；`dedup_of` 那条事实错仍待更正（「遗留与移交」第 3 项） |
| 8902 端点自陈：「`af_kp` 是分析模块（知识点梳理）的存储形状，**本轮没有任何公开端点读写其内容**……通路设计仍在承接计划内待评审」 | Axiom-Flow [api.md:166](../../Axiom-Flow/docs/architecture/api.md) | P1 定性＝对方明文空白而非我方臆断；且对方术语就是「知识点梳理」，与本次定名天然对齐 |
| 对方四文档与代码内 **无任何** `kp` 端点／梳理作业实现；`KpRepository` 只有读与删除面 | Axiom-Flow [todo.md](../../Axiom-Flow/docs/trackers/todo.md) PLAN-024 行自陈「W10 为其实现批，待立项」＋ 本轮 `main.py` 端点全集实测 | 乙／丙两段全部挂在 W10，属对方排期，我方只发请求 |

### 甲・条文面（改 `design/knowledge-analysis.md`）

| # | 请求 | 现状与判据 | 是否触列 |
| --- | --- | --- | --- |
| A1 | **改判 `KA-5` 的「一个批次内固定两阶段」**为多阶段，顺序判据不放宽：目录（含 `toc` 互验）→ 页域角色判定（前置／正文／后置剔除）→ 章级总结与学习导读 → 章下知识点抽取 → 收尾 | `KA-5` 现明文只写 outline 与 point 两段，用户四步里的「剔前置后置」与「章总结＋导读」两段无处安放；两阶段是「先目录后点」的次序约束，不是「只能有两段」 | 否 |
| A2 | 新增**目录互验条**：以 `section_kind='toc'` 页的 heading 块为「书内原目录」证据，与实际判出的 outline 逐条比对；不一致的节数在 `op_kind='kp'` 流水 `result` 里结构化计数，逐节复核标记走 `meta` | 用户第 1 步的「参照目录和实际章节进行验证」在 `KA-1~KA-28` 无条文；流水不是当前态判据（`KA-9`）这条不动 | 否 |
| A3 | 新增**页域角色写者与剔除条**：谁写 `section_kind`、机器判定与人工改判的写域分列（`KA-11` 三写者口径要扩到 `af_pages`）、被剔除域不进取证集（`KA-2` 的构造加一条域过滤） | 列已存在但本轮只建列；取证集现只按 `status='parsed'`（`KA-2`），没有「前置／后置不进批」的条文 | 否 |
| A4 | **更正 `narrative_ref` 口径二义**：DB 文档写「长文在数据根下的**相对路径**」，`KA-20` 写「只存**单段文件名**」，两处必归一 | 路径派生规则是一处事实源问题；我方按 [ADR 0026](../adr/0026-v1-root-table-family-freeze.md) D5 已在主表另存全路径，若对方判为单段名则根侧读文件腿（`learn.py:1080`）的拼接规则要同批改 | 否（但要归一） |
| A5 | 新增**确认后再总结条**：`confirmed=1` 之后的二次总结写哪一列（章级 `summary` 覆写 vs 新生成 point 行）、由谁触发（仍属人工发起，`KA-24`） | 用户第 4 步「调整完后可以进行总结」现无条文；覆写 `summary` 属机器写域还是人工写域要先裁（`KA-11`／`KA-12`） | 否 |
| A6 | 页确认门（对方 PLAN-018 W8）与梳理取证集的接线：`confirm_state` 写者与 `KA-3` 的关系成文 | `confirm_state` 现「本轮只建列」；`KA-3` 已预留「全书页确认门尚未启用」的分支，缺启用判据 | 否 |

### 乙・写者与通路面（＝对方 PLAN-024 **W10**，待立项）

1. `KpRepository` 三条写入口分别收口（机器来源域／人工背书域／系统归一与裁剪），`confirmed` 恒由人工置（`KA-11`）。
2. 四个**当前守护计数恒 0** 的对象交出插入腿：`section_kind`、`confirm_state`、`op_kind='kp'`、`op_kind='confirm'`——
   交出即其计数守护转红，须**同批**改断言（对方 database-design 明列这四条恒 0 判据）。
3. `finalize_batch`（`draft→candidate`）、启动期残留 `draft` 归一（`KA-9`）、同父同 `norm_key` 让位判 `rejected`（`KA-13`）、
   机器不猜父（`KA-26`）四条判据各配会红的用例。
4. 文本类引擎槽位接入（`KA-22`：未接入判 503，编排层不感知模型地址）＋ `qed_llm_calls` 本侧写入腿（`KA-23`，
   「梳理调用与调用账同批交付」）。

### 丙・端点面（8902 新增，形状归 `api.md`）

| 拟端点 | 承载判据 | 我方消费面 |
| --- | --- | --- |
| `POST /api/v1/books/{book_id}/kp-jobs` | 受理门：无生效版本 422、同书在飞 409（`KA-1`/`KA-4`）、整本或单章范围（`KA-25`） | 梳理屏「按书点梳理」按钮 |
| `GET /api/v1/books/{book_id}/kp-jobs/{job_id}` | 进度只读 `gen_status` 三态，流水不作当前态判据（`KA-9`/`KA-27`） | 进度条与失败节计数 |
| `GET /api/v1/books/{book_id}/kp-nodes` | 读面含未确认与 `rejected`，逐行带 `rev` 与锚点待复核标记（`KA-19`） | 左栏目录＋右栏知识点划分 |
| `PUT /api/v1/kp-nodes/{node_id}` | 人工背书域，`if_rev` 不匹配 409；不改 `gen_batch`/`model_ref`（`KA-12`） | 目录编辑模式与点的调整 |
| `POST /api/v1/kp-nodes/{node_id}/confirm` | 前置校验＝锚点可回指（`KA-14`），缺失项点名 422 | 「确认」按钮——**阶段一不打本端点**（Q3 已裁＝不等对方，屏上确认先打 8900 自有写面），本端点属阶段二对方通路就绪后的归一项 |
| `GET /api/v1/books/{book_id}/kp-export` | `confirmed=1` 全一册、outline 先于 point（`KA-15`）；提升腿在 8900 拉取（`KA-16`） | 阶段二提升通路 |
| 批量取页：`GET /api/v1/books/{book_id}/pages/{start}-{end}/blocks`（或 `POST /pages/batch`） | 单次多页、`parsed` 页集内（`KA-2` 已按批量口径写） | **P5 拼章与逐页渲染**：现只有逐页 `:434`，整章＝N 次 HTTP |
| （可选）`GET /api/v1/kp-nodes/{node_id}/narrative` | 长文正文读取 | **倾向不建**：两侧同一数据根，8900 已能按主表 `narrative_ref` 直读文件（`learn.py:1080`，悬空＝可见降级）；建端点即第二条正文通路 |

### 命名随步与路由待定

**已裁**＝模块中文名「知识点梳理」。**未裁**＝路由段（沿用 `#/admin/analysis` 还是换段）与导航格数（与「文档解析管理」合一单屏还是并列两格），
即 REQ-131 的 C-1 只答了命名半项。随步清单（待路由与格数一并定档后**同批**改，半改必红镜像守护）：

| 待改面 | 现值 | 改动 |
| --- | --- | --- |
| [REQ-116 壳](2026-10-15-doc-analysis-processing.md) H1 标题 ＋ [todo.md:52](../trackers/todo.md) 行链接文本 | 「文档分析处理模块设计稿（解析产物→目录/知识点/学习链路/习题讲解·待晋升·细节移交 Axiom-Flow）」 | 两者逐字耦合，改名须同批；其「前端展示」节的路由／中文名段同批 |
| [REQ-131 壳](2026-10-20-doc-knowledge-cluster-master-outline.md) 「六」节 C-1 行与状态句、W2 状态 | 「仍未答」 | 回填命名半项定档，导航半项保持待裁 |
| [frontend-overview.md](../design/frontend/frontend-overview.md) §4 ③ 清单与 §5 后台管理表 | 「文档分析处理」 | 改显示名；路由待定 |
| [design/index.md](../design/index.md) 待晋升段、[parsing-ui.md](../design/frontend/parsing-ui.md) 相邻模块指针 | 同上 | 同批改 |
| 晋升目标位 | `design/frontend/doc-analysis.md` | 定名后是否改文件名待 Q1 导航半项裁完再定（改名牵动链接门禁） |

## 交叠划清（与在册行的关系）

| 在册对象 | 它的正本范围 | 本壳的关系 | 不重复什么 |
| --- | --- | --- | --- |
| REQ-116 | 「文档分析处理」前端可见设计稿与晋升 `design/frontend/doc-analysis.md` | 本壳是其**实施前置**：先核流程、裁 Q1~Q7，再回 REQ-116 走 W3 移交／W4 晋升 | 不重述四职责正文，不代改其 S1~S4 |
| REQ-131 | 集群总纲与 C-1~C-6 裁决点 | Q1＝C-1 的原题、Q3 承接其阶段一／二切分 | 不重开已裁的 C-2／C-3 定档 |
| ARCH-027-M4 | 知识探索问答与召回消费面（后置） | 无交集（用户口径里的「M4」指梳理屏，在册名以 P7 登记） | 不挪该行归属（改归属须用户发令） |
| REQ-136 | 发往 AF 的 af_ 表族重构综合请求 | Q7 的投递面＝在该线追加一条窄请求或另发新函 | 不重述其 R1~R5 |
| REQ-137（已归档） | 主表 `aliases`／`narrative_ref`／`angles` 与两条腿的交付 | 本壳消费其成品；其 P5 真机验收与 P7 生产库窗口仍是人工档 | 不改判其已冻结判据 |
| ARCH-025 线 2 | 解析产物可信与知识库面 | P2／P3 的渲染与结构编辑修复不属其判据，走本壳 W2 | 不扩其判据 |

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | **demo 门（一壳一门，ADR 0024 决定 2）**：一册真书（b05）在 8903 走通最短黄金路径＝解析管理逐页准确渲染（文字＋公式＋**图片裁切**，W2 的 P2 接线是其前提）→ 新屏按章把该章页拼成正文（**页区间按 Q4 已裁的甲案**＝该节全部 point 行 `anchors[].page` 的 min/max 读时派生；派生不出时人工补起止页＝丙案兜底，须现场可见）→ 人工直登记一个知识点到共享主表并经 8900 读回其长文正文 → 左／中／右三栏骨架可见。真浏览器验证，到门暂停待人工验收 | 未开始（Q3／Q4 已裁＝不等对方、页区间按甲案派生，门内**不含**生成腿；余阻塞于 Q1 导航半项与用户放行动码。**前置条件 1 已于 2026-10-23 解除**＝b05 全本 317/317 生效版在位，逐页渲染腿当场可验；门内仍缺梳理屏骨架，故开工首件＝DEFECT-022 小修＋W3 界面腿。**门内须取证的甲案两枚失效形态**＝① 章内零 point 行派生不出→中栏空白要能被人工发现并补页；② 末章边界越界进致谢／附录→拼出错页。**甲案失效形态②的实测前提已取到**＝b05 末页 p313＝参考书目、p315＝封底广告（含 1 枚 table 块）、p317＝封底幻觉页，三页均无任何 `section_kind` 标记可依赖） |
| W2 | 解析渲染缺口修复批：P2 图片裁切接线（`pageImageUrl` 传入 `BlockList`＋vitest 守护）；P3 `PUT …/structure` 与页清单在 8900 补透传＋前端段落级修正落库；P5 拼章取数按一个聚合端点收口（**甲案派生出的页区间要一次批量取页，故 P5 与 Q4 裁决无关、仍须做**；对方侧对应的批量面已随 REQ-139 的 C7 发出）。逐条 TDD，先红后绿 | **部分实施**＝P2 接线已落地且**真机取证完成**（2026-10-23 窗口，b05 第 317 页三枚 image 块各出 `[data-testid=block-image-crop]`，其 `img` 的 `src` 字面＝`…/pages/317/image`；全量 vitest 847 passed、`tsc -b` 净）。**但取证实测同时暴露 P2 的呈现缺陷＝DEFECT-022**（裁切几何不出现，整页淡显占位常驻），见下条。P3／P5 未开始 |
| W2d / DEFECT-022 | 缺陷（由 2026-10-23 真机窗口暴露，属本壳 W2·P2 自引入的呈现回归）：`ImageCrop` 的裁切几何**完全依赖 `<img onLoad>` 量得的自然尺寸**，而页图带 `loading="lazy"`——图未进视口时浏览器不启动装载，`onLoad` 永不触发，组件永久停在 `{width:100%; opacity:0.35}` 回退分支＝**显示整页淡显图而不是 bbox 裁切块**。现象实测＝b05 第 317 页三枚裁切三者的 `img` 样式逐字相同（`width:100%; opacity:0.35`、`position:static`、`complete=false` 却有 `naturalWidth=1699`）；对照实验＝脚本把这三张图的 `loading` 翻成 `auto` 后 `onLoad` 立即触发、三枚各自算出互不相同的绝对定位（`width:1930.68%/1140.27%/2980.7%` 与负 `left/top`，与各 bbox 比例吻合）⇒ **换算逻辑无误，缺陷只在装载触发条件**。**修法（小改，不扩范围）**＝`ImageCrop` 接一个页尺寸初值——接口已给 `blocks.image_size=[1699,2399]` 且 `CompareView` 早已把它作为 `imageSize` prop 传进 `BlockList`（[BlockList.tsx:29](../../web-ui/src/components/parsing/BlockList.tsx)），把它透给 `ImageCrop` 作 `useState` 初值，`onLoad` 降为兜底；守护用例＝jsdom 下给 `imageSize` 即断言 `img` 样式为绝对定位裁切（而非 `opacity:0.35` 回退），先红后绿 | 待修复（本会话内小修；改码须 `npm run build` 后回窗口复验） |
| W3 | 梳理屏读写面接线：知识点划分与确认打到哪个端点按 Q3 裁决收口（阶段一＝8900 自有写面）；`confirmed` 与提升腿（8900 拉取式、`from_detail_id` 幂等锚）落地；撤认后主表行的可见降级按 `KA-17` 呈现 | 拆分执行（Q3 已裁）＝**界面与人工面腿先行**（三栏骨架、目录编辑模式、点的编辑与确认一律打 8900 自有写面）；**生成腿后置**待对方 W10 与 REQ-139 丙面端点 |
| W4 | 课程级跨书合并工作台：两本以上教材梳理完毕后按课程聚合，别名／主名／合并或增加的操作面与判据（形态参照 `#/knowledge` 已有面） | 待 Q6 |
| W5 | 文档随步与晋升：按 Q1 定名后写 `design/frontend/` 正本（或回填 REQ-116 壳）、`api-contracts.md` §⑥ 端点行、`code-map.md` 模块行、`frontend-overview.md` 全流程 ③ 段 | 未开始 |
| W6 | 遗留更正提请（本壳「遗留与移交」节三项）：REQ-134 壳两表前提、总纲 §7.8 T8 读数、ADR 0026 D6 的 `dedup_of` 事实错 | 待用户放行 |
| W7 | **Axiom-Flow 承接函出稿**：把本壳「Axiom-Flow 本轮承接清单」的甲／乙／丙三段变成对方在册请求（建议挂 ARCH-025 节新立一枚请求行，承载先例＝REQ-123／133／136），并写明「建值不建写者」的四条恒 0 守护须与插入腿同批改 | 发函已执行（2026-10-23，用户放行「W7 现在发函」）＝根侧新立 [REQ-139](2026-10-23-kp-review-af-request.md) 请求壳与 todo 行、对方台账以 `REQ-139` 支线行承接并挂其 PLAN-024 壳；回执与对方排期待跟 |

## 过程与证据

| 日期 | 事件 | 证据与结论 |
| --- | --- | --- |
| 2026-10-23 | 进场与三面盘点（qed-intake） | 读根 `AGENTS.md` 标准映射、[project-status.md](../trackers/project-status.md)、[task-lifecycle.md](../standards/task-lifecycle.md)「计划准入与分拆」「收口节拍、薄登记上限与承载归属」两节；判级＝B（多工作项实施轮，立独立壳，第一个工作项为 demo 门）。定级依据＝变更对象为 8903 两屏与 8900 透传（`architecture/` 与 `design/` 随步），非 `docs/` 结构改动，不触阻止项。 |
| 2026-10-23 | 8903 侧取证 | 路由清单实测＝[App.tsx:38-43](../../web-ui/src/App.tsx)（admin 子路由无 `analysis`）；图片断链三点取证＝`BlockList.tsx:90-94`（渲染条件）、`CompareView.tsx:155-169`（未传 props）、`PageImagePane.tsx:235`（唯一 `bookPageImageUrl` 使用者），8900 侧 `api/axiom.py:214` 端点在位 ⇒ P2 定性为**前端接线**而非缺能力。 |
| 2026-10-23 | 8902 侧取证 | 对方端点全集＝`Axiom-Flow/src/axiom_flow/api/main.py` 19 枚（`:269`~`:754`）＋`admin.py:264`，**无一枚含 `kp`**；`PUT …/structure` 语义亲读 `:492-519`（全量声明、缺席即撤销、幂等、几何锚落 `af_operations`、无生效版本判 404）；`af_kp`／`section_kind`／`op_kind='kp'` 的写者缺失按对方 todo PLAN-024 行自陈（W10 待立项、六个无写者 `op_kind` 值）与 `knowledge-analysis.md` 全文（实现状态 Not Started）⇒ P1／P3／P4 成文。 |
| 2026-10-23 | 根侧成品取证 | [learn.py:995](../../backend/qed_engine/api/learn.py) 直登记、`:1080` 长文读文件（指针悬空＝可见降级）、`:765` 与 [knowledge.py:61](../../backend/qed_engine/services/learn/knowledge.py) 的 `from_detail_id` 注释＝提升幂等锚语义在、拉取腿零实现；[ADR 0026](../adr/0026-v1-root-table-family-freeze.md) D5 六词闭集与 D6 「谱系列正本在 `af_kp.dedup_of`」逐条读原文，再在 Axiom-Flow 全仓 Grep `dedup_of` **零命中** ⇒ P6 的文档事实错定谳。 |
| 2026-10-23 | 在册裁决复核与漂移登记 | REQ-116 行（`todo.md:52`，In Progress，S1~S4 冻结）、ARCH-027-M4 行（`:21`，在册名＝知识探索）、REQ-131 壳 C-1~C-6 状态（C-2／C-3 已裁、余未答）、REQ-134 壳两表前提 vs 实存 `af_kp` 单表、总纲 §7.8 T8 读数 vs 对方 base `20261022_0001`；并行会话已收口 REQ-137（todo 行移出、壳入 `history/plans/2026-10/`）⇒ 本行取 REQ-138，指针按归档位书写，他轮文件一律**只归因不改**。 |
| 2026-10-23 | 本轮交付边界（核查批） | 纯文档：新增本壳 ＋ todo REQ-138 行；**零代码、零库内、零对方工作区写入**。Q1~Q7 全部按未答登记，不按本壳推荐默认采纳（用户既有守则）。 |
| 2026-10-23 | 用户裁命名＋授权本轮 Axiom-Flow 跟着改，出承接梳理稿 | **裁决原文＝「命名确定为『知识点梳理』；本轮 AXIOM-FLOW 也要跟着改，你可以先梳理」**。据用户指令本轮只出梳理（甲条文／乙写者／丙端点／丁随步四段成文），零发函、零对方工作区写入、零代码。取证四处新事实并**据此更正本壳初判**：① `af_pages.section_kind` 闭集含 `cover`/`preface`/`ack`/`toc`/`chapter`/`appendix`/`back`/`other`（对方 database-design:367），故初判「剔前置／后置与目录互验无承载」**更正为**「有值域、无写者、无条文」，P4 的页区间亦获 `toc`／`chapter` 域判据（Q4 甲案增强）；② outline 行本就可写 `summary`＋`narrative_ref`（`:401`／`:404`），故第三步不必扩根侧 `angles` 闭集，Q5 甲案获对方列面背书；③ `af_kp.book_id` 行原文「跨书合并归根侧主表」（`:388`），Q6 甲案属对方已判范围、无需再请求；④ 对方 api.md:166 明文「`af_kp`……本轮没有任何公开端点读写其内容」，P1 由我方推断升级为对方自陈。**新查对方口径二义**＝`narrative_ref` 在 database-design 写「数据根下的相对路径」、`KA-20` 写「只存单段文件名」，列为甲段 A4 请对方归一。**命名随步刻意未动**＝路由段与导航格数（C-1 的另半项）未答，REQ-116 壳标题与其镜像行逐字耦合，半改必红 `test_todo_plan_rows_exactly_mirror_active_plan_bodies`，故按「未答者保持待定」把随步面列成清单待同批。 |
| 2026-10-23 | 用户裁 Q3＋问 Q4＋放行 W7 | **裁决原文＝「W7 现在发函；Q3 阶段不等对方，先做好前端界面；Q4 页区间是怎么回事，派生还是加列具体指的什么」**。据此三件：① Q3 落裁＝不等对方，W1 门内删生成腿、W2 提为先行批、W3 拆为「界面与人工面腿先行（打 8900 自有写面）＋生成腿后置」，丙面 `confirm` 端点阶段一不打；② Q4 保持未答，把三案的具体含义补成本壳「页区间三案」小节（甲＝`anchors[].page` 的 min/max 读时派生、零改表、失效形态＝空 point 行派生不出与末章越界；乙＝请对方给 outline 行加 `page_start`／`page_end`，触 ADR 0024 重建档位＋其唯一 base 之上出新迁移＋两库 ALTER＋DDL 逐字守护同批；丙＝阶段一人工填起止页落根侧共享主表 outline 行的 `meta` 扩展槽，实测列面＝`anchors` JSON 带 `page`、`meta` 为扩展槽、先例 `meta.chapter_key_points`，零改 AF、零迁移），并按 Q3 补判「丙是唯一不依赖对方排期的来源＋甲作零人工兜底」；③ W7 由待放行转发函已执行，去向见下行。 |
| 2026-10-23 | W7 发函落地与对方撞车改判 | 四件写入＝根 todo 的 **REQ-139** 支线请求行（任务描述列标注「（请求：Axiom-Flow）」，成功标准五条含承接／核对／联调）＋新立请求壳 [2026-10-23-kp-review-af-request.md](2026-10-23-kp-review-af-request.md)（甲／乙／丙三面判据引本壳梳理稿，不另立事实源）＋`docs/design/cross-project-contracts.md` §4 在途登记追加＋**对方文档面代登**（其 todo 的 `REQ-139` 行、其主线聚合行 ARCH-021 任务列补列该 ID、其 PLAN-024 壳追加「承载 REQ-139」节）。承接落点不按直觉选：实读其 `tests/contract/test_tracker_governance.py` 得其镜像守护要求「每个 `docs/plans/*.md` 恰有一枚 `PLAN-` 行镜像」⇒ **代登请求不得新建对方 plans 壳**，且支线行的唯一承载指针所指壳必须登记本行 ⇒ 落 PLAN-024 壳。**发函当刻撞车**＝对方已自立 PLAN-025「知识点梳理消费通路实现批」（明文承接 PLAN-024 的 W10、自陈零新增判据），据此把乙面 B1~B4 与丙面 C1~C6 降为形状核对，本函净新增面收窄为甲・条文面 A1~A6 与 C7 批量取页；并查出**新的口径冲突**＝对方 PLAN-025 的 W6 自陈 `narrative_ref`「恒为单段文件名」，与根侧 ADR 0026 的「数据根相对路径全串」相左，已作为 A4 升级项请对方归一（根侧读腿拼接是否随改须用户裁）。门禁＝对方 `pytest tests/contract -q` 206 passed（改动前后均绿，其新行未破其并发上限与承载契约）；根侧读数见「验证与验收」节，两处红属并行会话产物（其 REQ-132 壳已写 `状态：Closed` 但壳未移、行未删；`scripts/image-model/.keepalive.pid` 落在 logs／tmp 之外），本会话只归因不代改。 |
| 2026-10-23 | 用户裁 Q4＝甲案，本壳与 REQ-139 同批改判 | **裁决原文＝「选择甲・派生，继续后续的工作」**。据裁回填六处＝① Q4 行改「已裁＝甲・派生」并记原文，写明**乙案作废**（不请求 `page_start`／`page_end`）、**丙案降为兜底**（本轮不为其开工）；② 「页区间三案」小节的结论段由「丙是唯一不依赖对方排期的来源＋甲作兜底」**改判为**「甲是唯一判据位，两枚失效形态须 W1 真机取证，且甲案仍依赖对方批量取页端点」；③ P4 与「流程四步对照」第三步／第四步的处置格收口（第三步原引用 Q4 属笔误，`narrative_ref` 归一走 A4、正文写者走乙面）；④ W1 状态格删去「Q4 择一」阻塞项并补两枚门内取证项；⑤ W2 写明 P5 与 Q4 无关、C7 不因裁甲而撤；⑥ 承接清单前言由「除一处外零 ALTER」改判为**全部零 ALTER、零新迁移**。连带随步＝REQ-139 请求壳的条件项 X1 作废（其状态格、覆盖映射表、前言「除一枚条件项外零改表」句同批改），根 todo REQ-139 行任务描述注记与本壳「Axiom-Flow 承接清单」的页区间行同步——**成功标准列 S5 按 ADR 0023 冻结不改写**，其原文「页区间未裁为加列前本行不请求对方任何新列」在裁甲后仍为真，无需改判。 |
| 2026-10-23 | W2·P2 图片裁切接线落地（TDD） | 改动两处＝[CompareView.tsx](../../web-ui/src/components/parsing/CompareView.tsx) 的 `PagePair` 右栏 `parsedPane` 向 `BlockList` 传 `pageImageUrl={bookPageImageUrl(book.book_id, pageNo)}`（并把 `bookPageImageUrl` 并入 import）；新守护 [CompareView.test.tsx](../../web-ui/src/components/parsing/CompareView.test.tsx)（流式与版式各一例，断言 `[data-testid=block-image-crop]` 出图且 `img` 的 `src` 字面等于 8900 页图端点）。**先红后绿实录**＝加 props 前两例均红（`expected null to be truthy`），补上后两例绿；jsdom 会把相对 `src` 解析成绝对 URL，故断言取 `getAttribute('src')` 而非 `img.src`。门禁＝`npx vitest run --no-file-parallelism` **67 files／847 passed**（按既有守则串行才可信）＋ `npx tsc -b` exit=0。P3／P5 未动。 |
| 2026-10-23 | 真机浏览器取证受阻＝现库无任何生效页产物（W1 demo 门的前置缺口） | 按 qed-frontend-check 走＝8900／8903 均 200；`npm run build` 后 8903 实际返回的包哈希与 `dist/index.html` 一致（`index-CbOR7_FC.js`）；新开页加 `?v=req138p2` 避旧包。进 `#/admin/parsing` 点选任一书（mathanalysis-b01）→ 中栏态分流走「尚未书页入库，直显原始 PDF」，`[data-testid^=pane-parsed-]` 计数 0、裁切计数 0 ⇒ **P2 这条改动在真机无法取证**。接口侧同因＝`GET /api/v1/books` 17 本全部 `ingest_status=none`／`page_count=null`，逐本探 `GET …/pages/1` **全 404**（404＝未解析属设计口径，非缺陷）。控制台仅两枚预期 404（`…/pages/1` 与 `…/pages/1/edits`），请求全指向 8900，无 8901／8902 直连、无 5xx。**归因**＝Axiom-Flow 整族重建后 `af_pages` 为空，其 PLAN-024 文档自陈「写入面（逐页落库、结构声明、块编辑）待对方后续真机解析窗口取证」⇒ W1 demo 门与 P2／P3／P5 的真机验收都排在「入库＋解析窗口」之后，而该窗口属人工排期（模型服务与数据根侧）。**本会话未触发入库或解析**（不代用户开真机窗口、不写数据根）。 |
| 2026-10-23 | 用户择「先排一次入库＋解析窗口」⇒ 出 runbook 并更正本会话初稿的槽位事实错 | 选项原文＝「先排一次入库＋解析窗口」。开窗前只读复测＝`/services` 四服务 `online`；`GET /api/v1/models/text` → `identity=qwen3.5-9b`／`health_state=down`／`ConnectError`（5001），`GET /api/v1/models/vision` → `identity=mineru`／`health_state=down`／容器未启动（5002）。**据此更正「窗口前置读数」小节初稿**：原写「视觉引擎两槽皆不在位」错——5001 是**文字槽**（LM Studio），解析链路不经它，本窗口唯一必需件＝`vision` 槽（MinerU 容器）；`text` 槽到知识点梳理生成腿那一轮才需要。第二条新事实＝**「书页入库」不需要任何模型服务**（`Axiom-Flow/src/axiom_flow/ingest/importer.py` 的 `ingest_book` 只用 `pymupdf` 本地渲染页图），故 V1 可在容器未起时先走。第三条＝控制域启停按**槽位名** `text`／`vision`（`openapi.json` 的 `Model Start` 描述明文「按槽位名，不是 qwen/mineru 这类名字」，实测别名 `mineru`／`qwen` 亦可解析），就绪判据用 `GET http://127.0.0.1:5002/health` 轮询到 200 而非前端 15s 轮询的显示结果；`QED_RESOURCE_GUARD` 启 MinerU 前先停 Qwen 属设计。门禁复跑＝`pytest tests/contract -q` **88 passed／1 failed**（唯一红＝并行会话产物 `scripts/image-model/.keepalive.pid`，只归因不代改）。 |
| 2026-10-23 | **真机窗口取证（用户开窗：b05 与 b07 入库、b05 全本解析）⇒ V1~V6 打勾、P2 呈现缺陷立案 DEFECT-022** | 用户指令原文＝「帮我监控一下，我现在将 数学分析原理 和 数学分析习题集 入库了，帮我看下 QED_DATA_ROOT 是否已经清理干净，并且文件确认都是保存在这个目录下，元数据在数据库表中。确认后看数学分析原理的全本解析是否正常，如果不正常说明原因」。取证面＝8900 只读探测＋`qed_test` 只读 SQL（`mysqldump` 同款全路径与 `MYSQL_PWD`，密码不回显）＋数据根只读清点＋8903 内置浏览器实测。**四服务 online、`vision` 槽 `ready`／`gpu_visible=true`／5002 `/health`=200**（`text` 槽仍 down，本轮不需要）。**入库与解析均正常**＝b05 `ingested`／317 页、job `4af1b233c252` `completed` 317/317、`failed=0`、`af_pages` 恰 317 行全 `parsed`、`last_parse_result=completed`、`active_job_id` 已置（激活成立），00:54:45→01:01:14 约 6.5 分钟；b07 `ingested`／439 页但未解析（`af_pages` 0 行、`versions/` 空）。**文件确认落根**＝`QED_DATA_ROOT=D:\coding\QED-Engine\dataset`（根 `.env` 与 AF `.env` 同值），`parsed/math_analysis/mathanalysis-b05/pages/p0001..p0317.png` 317 枚＋生效版 `versions/4af1b233c252/`（954 文件 118 MB，`manifest.json` 逐文件带 sha256，抽查 `p0002.md` 128 字节与声明一致），源 PDF `raw/math-advanced/math_analysis/数学分析原理_341544f3.pdf` 与 `af_books.sha256` 同源；读腿 `…/pages/317/image` 200 `image/png`、`…/file` 200 `application/pdf`、`…/manifest` 200。**元数据确认在表**＝`af_books`／`af_pages`／`af_operations`／`af_kp` 四张在册，`af_kp` 0 行（梳理未开工）。**数据根未清理干净**（明细入「遗留与移交」第 9 项：库里 `ingest_status=none` 的 b01／b11／b12 盘上仍留 654 MB 旧产物、b05 有三枚非生效孤儿 versions 约 352 MB、`dataset/tmp` 49 MB、`dataset/backups` 7.6 MB；删除属人工 D 类，本轮只出清单）。**新登记的缺陷＝DEFECT-022**（W2d 行）：浏览器实测三枚 `[data-testid=block-image-crop]` 的 `img` 样式逐字相同＝整页淡显占位未裁切；对照实验把 `loading` 由 `lazy` 翻 `auto` 后 `onLoad` 立即触发、三枚各算出互不相同的绝对定位（`width:1930.68%/1140.27%/2980.7%` 与各 bbox 吻合）⇒ **换算无误、缺陷在装载触发条件**，修法＝把接口已有的 `image_size`（`CompareView` 已在传的 `imageSize` prop）作 `ImageCrop` 初值、`onLoad` 降兜底，配 jsdom 守护用例。**内容质量两枚观察项**＝O1 p317 封底是 vLM 复读幻觉（「图书馆」二元组同页 57 次，全 317 页同判据扫描仅此一页越限；正文页 p33／p83／p313 干净）、O2 5 页 `blank_page:true`＋p1 封面全 `header` 含 `[Unreadable]`＝REQ-087 设计口径。**新查在册事实**＝`af_pages.section_kind` 317 行全空（P4 页级判据首次真机证据）、`af_operations` 全库仅 `op_kind=parse` 一行（入库不留账＝对方 `repositories.py` 自陈的设计）。控制台无报错、请求全指 8900。 |

## 验证与验收

- A/B 混合轮：本轮（核查＋登记）门禁＝`pytest tests/contract -q`（计划治理 G3/G7、台账镜像 G1/G2/G5、链接门禁）
  ＋ `pytest tests -q` ＋ `ruff check backend tests scripts`；解释器一律 `D:/software/anaconda3/envs/QED_env/python.exe`。
- 实施批次（W2 起）按其 S 条目逐条取证：前端改动必须走 `qed-frontend-check`（真浏览器、`npm run build` 后核对
  bundle 哈希），后端透传改动先写会红的契约测试。
- demo 门验收＝人工在真浏览器确认四件事：图片块出裁切图而非题注、段落修正刷新后仍在、拼章正文完整、
  登记后能读回正文；未通过不进 W3。

## 回滚

- 本轮＝纯文档新增：删本壳 ＋ 移除 todo REQ-138 行即可，零运行态影响，无数据回滚。
- 实施批次各自在 W2/W3 条目内声明回滚（前端 props 级改动直接还原组件；8900 透传新增只退端点不动数据；
  若触主表列面即属 ADR 0024 重建档位，另批走备份＋用户确认窗口，本壳不含该权限）。

## 遗留与移交

| # | 事项 | 归属与去向 | 本壳为何不做 |
| --- | --- | --- | --- |
| 1 | REQ-134 壳「净新增两枚窄表 `af_kp_nodes`／`af_kp_edges`」前提与其 S2「不超过两枚」的失真 | 该壳自身更正（其镜像行 REQ-134，`todo.md:56`） | 改判他轮正文需在其壳内留裁决记录，不属本壳范围；本壳只登记指针（P8） |
| 2 | 总纲 §7.8 T8 的 `alembic_version` 读数（现应指对方唯一 base `20261022_0001`） | [database-design.md](../architecture/database-design.md) §7.8 随步 | 总纲是固定架构文档，改数需与逐字 DDL 守护同批，宜单列小批执行 |
| 3 | ADR 0026 D6 引用的 `af_kp.dedup_of` 不存在（合并／拆分谱系承载缺位） | 提请用户裁决：改 D6 文字（谱系归根侧 `meta` 或 `links`）或向 AF 发新请求建列（＝Q6 的连带） | ADR 是已 Accepted 的决策记录，实质改判须用户发令并走 ADR 通道 |
| 4 | `af_kp` 写入路径、只读导出端点、`section_kind`／`confirm_state`／`op_kind='kp'` 写者、`qed_llm_calls` 本侧写入 | **对方已自立 PLAN-025「知识点梳理消费通路实现批」承接其 W10**（2026-10-23 实读其台账）⇒ 本函 REQ-139 对这两段降为形状核对；Q7 的两条新规则改由 REQ-139 甲・条文面投递 | 前缀即所有权（ADR 0025），根仓 agent 在对方工作区只读＋写文档 |
| 5 | REQ-131 的 C-1／C-4／C-5／C-6 与 REQ-116 的 W3／W4 | 各该行自身收口（本壳 Q1／Q3 与其同题，不代裁；Q3 已于 2026-10-23 落裁） | 成功标准列冻结，跨行改判须用户裁决 |
| 6 | `narrative_ref` 取值两处相左＝根侧 ADR 0026 与 `cross-project-contracts.md` §4 存「数据根相对路径**全串**」，对方 PLAN-025 的 W6 自陈「恒为**单段文件名**」 | 已随 REQ-139 的 A4 请对方归一并给出根侧无需询问即可自拼的派生规则；根侧改否须用户裁（改则 `learn.py` 读腿与总纲该列同批改） | 两处各有在册依据，根侧单方改拼接＝替对方定判据，违 ADR 0025 |
| 7 | 根侧 `cross-project-contracts.md` §4 的在途登记把 `af_kp` 写作「知识点单表 **21 列**」，与对方在册的 23 列（其 PLAN-024 壳标题与其档 B 实测读数）不符 | 该段属 REQ-136 的登记口径（并行会话产物），提请该行会话或用户放行后更正 | 只归因不代改他人的未提交登记 |
| 8 | **一次「书页入库＋解析」真机窗口**（demo 门与 W2 各条真机验收的唯一前置）**＝已开过（2026-10-23 08:54–09:01，用户开窗；b05 全本 `completed` 317/317 且生效版已激活，逐条读数见下小节「窗口实测结果」；b07 同日入库未解析）**。开窗前状态＝现库 17 本全部未入库、`af_pages` 空 ⇒ 8903 文档解析管理任一书都走「直显原始 PDF」分流，裁切／段落修正／拼章三条改动无真数据可验。入口＝`#/admin/parsing` 顶栏「书页入库」→「解析本页」/「全本解析」（**解析两条都要 `vision` 槽在位**，引擎默认 `mineru`；「书页入库」本身只需本地 PyMuPDF，不需模型服务。开窗与就绪判据见下小节） | 人工排期（用户开窗口；模型服务与数据根侧属机器面）；根侧会话只在窗口内驱动与取证，不代开窗口 | 数据根与模型服务不属 agent 可动面（`dataset/` 对 agent 全拦、真机批量窗口属 D 类人工任务）；且违「不写运行数据库/真实数据根」的隔离铁律 |
| 9 | **数据根残留清单（2026-10-23 窗口实测，`QED_DATA_ROOT=D:\coding\QED-Engine\dataset`）**＝① 三本书在库里 `ingest_status=none`／`page_count=null`、盘上却留有整代旧产物：`parsed/linear_algebra/linearalgebra-b01`（149 MB，mtime 09-23）、`parsed/math_analysis/mathanalysis-b11`（365 MB，10-18）、`parsed/math_analysis/mathanalysis-b12`（140 MB，10-17），合计约 654 MB；② `mathanalysis-b05` 盘上 4 枚 versions，生效版只有 `4af1b233c252`（118 MB），另三枚 `012d637df1eb`（09-23 老代全本）／`2caba2aa3ad4`／`84c09b0433a0`（09-23 partial）各约 117–118 MB 已成孤儿，合计约 352 MB；③ `dataset/tmp/qed-tracker`（49 MB）与 `dataset/backups/2026-09-20-arch020f`、`2026-09-23-arch020f`（7.6 MB）。整根体量＝`parsed` 约 1.05 GB／`raw` 562 MB（21 枚 PDF） | **人工排期（D 类数据操作）**：删除不可逆，须先备份再动；判据建议＝「库里 `ingest_status=none` 的书的整个 `parsed/<domain>/<book_id>/`」＋「非 `active_job_id` 且非最近一次的 versions」两类可清，孤儿 versions 是否算在册设计须先问对方（`_retire_replaced_version` 只删被替换的那一枚，故多版本残留本身不违其 ADR 0004 口径） | 数据根属机器面且 `dataset/` 对 agent 拦写删（本会话实测**目录列举与容量统计可读**，但删除属不可逆动作，仍只出清单不代删）；隔离铁律另含「不写运行数据库/真实数据根」 |
| 10 | **b05 第 317 页（封底广告页）是 MinerU vLM 复读型幻觉**：段落内「包括图书馆、图书馆、图书馆…」同页出现 57 次、「数学教学中，数学教学中，…」连排、并两次冒出「1. 2023年1月1日」；p1 封面 7 块全 `header` 且含 `[Unreadable]`。全 317 页同判据扫描只有 p317 越限，正文页（p33／p83／p313）干净 | 归属＝Axiom-Flow 侧解析质量面（引擎与归一化，其 `quality` 已给 `empty_block_ratio`/`dropped_*` 但**不含复读指标**）；根侧处置＝人工审阅时按 `confirm_state` 不确认并剔除该页，不为它改根侧任何渲染逻辑；是否向对方提「复读检测」新请求须用户发令（不擅自发函） | 引擎质量属对方判据与前缀所有权（ADR 0025），根仓 agent 在对方工作区只读＋写文档 |

### 窗口前置读数与取证清单（用户 2026-10-23 择「先排一次入库＋解析窗口」）

**开窗前必须先补的机器件（本会话 8900 控制域只读实测；含对本小节初稿的一处自我更正）**：

四服务全 `online`（8900／8901／8902／8903）。两槽读数＝`GET /api/v1/models/text` → `identity=qwen3.5-9b`、
`health_state=down`、`reason=ConnectError`（`http://127.0.0.1:5001/v1` 无服务）；
`GET /api/v1/models/vision` → `identity=mineru`、`health_state=down`、`reason=docker 容器未启动`（5002）。

- **更正**：初稿把这两槽写成「视觉引擎两槽皆不在位」是错的——`monitor/qwen`（5001）是**文字槽**（LM Studio 的
  qwen3.5-9b），解析链路不经它；本窗口的唯一必需件只有 **`vision` 槽＝MinerU 容器（5002）**，文字槽留给
  知识点梳理生成腿那一轮再开。
- **V1「书页入库」不需要任何模型服务**：写入面 `ingest_book` 只用 PyMuPDF 本地渲染页图
  （`Axiom-Flow/src/axiom_flow/ingest/importer.py` 的 `import pymupdf` 与 `def ingest_book`），
  容器没起也能先把页图与 `page_count` 落进去。
- 启动路径两条择一（正文见 `scripts/image-model/README.md` 与 AF `docs/guides/operations.md`）：
  `POST http://127.0.0.1:8900/api/v1/models/vision/start`（控制域按**槽位名** `text`／`vision`，`qwen`／`mineru` 系别名亦可解析），
  或脚本 `python scripts/image-model/qed_mineru_service.py start`。
- **就绪判据用 5002 自己**：`GET http://127.0.0.1:5002/health` 轮询到 200——权重加载是分钟级，
  8903 前端 `operateModel` 的 15s 轮询超时显示「失败」并不代表容器没起（AF 运维指南已成文的判据）。
- 资源互斥：`QED_RESOURCE_GUARD` 在启动 MinerU 前会先停 Qwen（4080 16GB 显存约束），窗口内看到文字槽被停属设计。

数据根侧 PDF 是否在位须人工核（`/books/{id}` 已给出登记路径，
如 `mathanalysis-b05` 的 `raw/math-advanced/math_analysis/数学分析原理_341544f3.pdf`；`dataset/` 对 agent 全拦）。

窗口内按序取证（每条都记实测读数，不凭推断）：

| # | 动作 | 通过判据（实测位） |
| --- | --- | --- |
| V1 | 选一本薄书点「书页入库」（建议先 `mathanalysis-b05` 以外的短书，单页成本低） | `GET /api/v1/books/{id}` 的 `ingest_status` 由 `none` 转 `ingested` 且 `page_count` 为正整数；`GET …/pages/1` 由 404 转 200 |
| V2 | 「解析本页」单页（引擎须先在位） | 该页 `blocks` 非空且含 `image` 型块的书页；8903 右栏出 `[data-testid=block-image-crop]`，其 `img` 的 `src` 字面指 `…/pages/{n}/image`（＝P2 的真机证据） |
| V3 | 逐页渲染抽查（文字／公式／表格三类各一处） | 文字不截断（版式重排流入纸面）；公式出 KaTeX 而非残留 `$$…$$`（老代产物观察项见「公式定界符」判例）；表格出 HTML 而非纯文本 |
| V4 | 段落级人工修正（P3 未实施，此项只作现状留证） | 并块／删块当前只在本地预览，刷新即丢＝REQ-099 R2 在册欠账，窗口内如实记录不发生落库 |
| V5 | 视需要再「全本解析」 | 任务终态 `completed`、`af_pages` 行数＝`page_count`、生效版本激活；partial 不激活属设计（parsing-flow §2） |
| V6 | 对方写入面顺带取证 | 逐页落库＋结构声明＋块编辑三条写入腿在新表族上真机可用＝Axiom-Flow PLAN-024 自陈「待后续真机解析窗口取证」的那笔，可作 REQ-139 乙／丙面形状核对的回证 |

**窗口实测结果（2026-10-23 08:54–09:01，用户开窗口；读数全部取自当次只读探测，无一条凭推断）**

- **V1 通过**＝`mathanalysis-b05` `ingest_status=ingested`／`page_count=317`、`GET …/pages/1` 由 404 转 200；同批 `mathanalysis-b07` 亦 `ingested`／439 页但**未解析**（`af_pages` 0 行、`versions/` 空）。
- **V2 接线通过、呈现有缺陷**＝b05 第 317 页（三枚 `image` 块）出三枚 `[data-testid=block-image-crop]`，`img` 的 `alt`＝「块图（页图裁切）」、`src` 字面＝`http://127.0.0.1:8900/api/v1/books/mathanalysis-b05/pages/317/image`（只连 8900 合规）；**但三者的 `img` 样式逐字相同**（`width:100%; opacity:0.35`、`position:static`）＝整页淡显占位而非按 bbox 裁切 ⇒ 立案 **DEFECT-022**（判据与修法见「工作项」W2d 行；对照实验已排除换算逻辑）。
- **V3 通过（含两枚观察项）**＝整本块种分布 `paragraph 4464 / formula 1916 / header 297 / page_number 290 / image 5 / table 3 / caption 2 / footer 1`；抽查 p33（可数集与定理 2.13／2.14）、p83（连续性 4.5~4.8）、p313（参考书目）＝中文正文完整不截断、公式在 `latex` 字段且 **markdown 零 `$$` 残留**（老代产物击穿 KaTeX 那一笔在新代不复现，见「公式定界符」判例的观察项可撤）；表格仅 3 枚（p6/p315 等），本书本就少表，不作缺陷。**观察项 O1＝p317 封底是 vLM 复读型幻觉**：段落含「包括图书馆、图书馆、图书馆…」（CJK 二元组「图书」在同页出现 57 次）与「数学教学中，数学教学中，…」、并两次冒出「1. 2023年1月1日」——正文页（p33/p83）无此症，全 317 页按同判据扫描仅 p317 越限（p33／p83 各 20 次属正常术语重复）。**观察项 O2＝5 页 `blank_page:true`**（p48／98／136／162／282，blocks 为 0）与 p1 封面（7 块全 `header`、含 `[Unreadable]`、markdown 仅 1 字符）＝空白页计入 `parsed` 并可激活，正是 REQ-087 收口的设计口径，非缺陷。
- **V4 未做**＝P3 未实施，段落级修正仍只在本地预览；本轮不取该项证据。
- **V5 通过**＝job `4af1b233c252`（engine `mineru`）终态 `completed`、`progress` 317/317、`failed=0`、`failed_pages=[]`、`af_pages` 恰 317 行全 `parsed`；`af_books`＝`pages_done=317`／`last_parse_result=completed`／`active_job_id=4af1b233c252` ⇒ **生效版本已激活**（AF ADR 0007 决定 1「completed 与激活同判据」实测成立）。耗时＝00:54:45 起、01:01:14 末页（naive UTC），全本约 6.5 分钟。注：`GET /books/{id}` 的 `parse_status` 终态回到 `pending` **不是回归**＝对方 ADR 0007 决定 3 的两值闭集（只表「有没有任务在跑」，结局走 `last_parse_result`、可读版走 `active_job_id`）。
- **V6 部分通过**＝逐页落库与产物清单腿真机可用（`…/manifest` 由 404 转 200，`book.json`／`chunks.json` 1.39 MB／逐页 `.blocks.json`＋`.md`＋`.png` 均带 sha256；`…/pages/{n}/image` 200 `image/png`；`…/file` 200 `application/pdf` 6.2 MB，与 `af_books.sha256=341544f3…` 同源）。**结构声明与块编辑两条写入腿本轮未被窗口触及**（无必要动作触发），仍待 P3 落地后取证。**新查到的在册事实**＝`af_pages.section_kind` 在 317 行**全为空串**（列存在、域值在册，无写者）⇒ 本壳 P4「按目录与章节互验定前置／后置」的页级判据首次拿到真机证据；`af_operations` 全库仅 1 行（`op_kind=parse`／`lifecycle=event`），入库动作不留账＝对方 `repositories.py` 自陈「本轮只有 `op_kind=parse` 的行有写者」，属设计不是缺陷。

**数据根读数（`QED_DATA_ROOT`＝根 `.env` 与 AF `.env` 一致值 `D:\coding\QED-Engine\dataset`）**：产物确实全落该根内＝`parsed/math_analysis/mathanalysis-b05/pages/p0001..p0317.png`（317 枚）＋生效版 `versions/4af1b233c252/`（954 文件 118 MB），源 PDF 在 `raw/math-advanced/math_analysis/数学分析原理_341544f3.pdf`。**但未清理干净**，明细与处置见「遗留与移交」第 9 项。

## 关闭与归档

- 关闭判据＝todo REQ-138 行 S1~S5 全达成（demo 门真机走通为核心门）且用户确认关闭后：todo 该行原子移出 →
  `completed.md`（关闭结果＋证据），本壳按 Retain 归档 `docs/history/plans/2026-10/`（跨月则按归档当月）。
- 阶段一交付但梳理生成腿待对方的情形，**不得**按达成即收草率关闭：残余出口只有两种——W3 状态列显式写
  「移交 Axiom-Flow PLAN-024 W10」，或按已确认的降级稳态（只人工登记面可用）收口；两者都要在「过程与证据」留裁决行。
