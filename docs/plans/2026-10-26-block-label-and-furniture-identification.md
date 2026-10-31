# 块类型人工标注通路、页域几何识别与 Axiom-Flow 取材回放（block-label-and-furniture-identification）

状态：In Progress
任务类型：B
最后更新：2026-10-26
关联 ADR：[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)（解析与产物归 Axiom-Flow、渲染与门面无，故页域判定归对方、消费归本仓）、
[ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md)（一任务一行一壳）、
[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）、
[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（demo 门与范围锁死）、
[ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md)（前缀即所有权：`af_operations` 归对方，本仓只经 HTTP 消费）
关联设计：[REQ-140 壳](2026-10-24-parsing-layout-geometry-replica.md)（R3 页眉页脚三条件合取判据的正本，本壳供其对的类型、不改其判据一字）、
[REQ-141 壳](2026-10-24-kp-review-screen-and-kp-passthrough.md)（梳理屏中栏与本壳渲染腿同源＝其 T2 已裁甲；批次 B 透传七条归其 W2）、
[REQ-138 壳](2026-10-23-admin-render-and-kp-review-workspace.md)（P3 段落级人工修正落库的核查缺口，本壳是其同一条 PUT 的类型维），
Axiom-Flow [api.md](../../Axiom-Flow/docs/architecture/api.md) ②（块编辑端点的参数与响应形状＝扩载荷的正本）、
Axiom-Flow [parsing-management.md](../../Axiom-Flow/docs/design/parsing-management.md)（`PM-*` 意图行跨版本存活与人工确认语义）、
本仓库 [api-contracts.md](../architecture/api-contracts.md)、[code-map.md](../architecture/code-map.md)、
[frontend/parsing-ui.md](../design/frontend/parsing-ui.md) §9.1（版式态与角色分派的现条文）
关联 Tracker：docs/trackers/todo.md（REQ-142 任务行登记在普通任务轮 ARCH-035 节，分线归属＝ARCH-025-L1（解析产物侧）；Axiom-Flow 侧的承接＝其 PLAN-026，与本壳互为对照，判据不双写）
归档判定：Retain（「人工修正不进取材视野」这一事实的取证、改判意图行的读回对账、以及页域判据的现场标定证据属不可替代的过程记录；
实施结论晋升 `design/frontend/parsing-ui.md` 与对方 `api.md` 后，本壳仍作「两侧同批改判」的互等对账凭据）

> **本轮的授权前提（必须先记）**：根 `AGENTS.md`「本仓库不包含子项目代码；在 Axiom-Flow / QED-Tracker 工作区
> 只读 + 写文档，不产生代码改动」这一条，由用户 2026-10-26 指令原文「**授权你动Axiom-Flow代码开始代码部分**」
> **逐次**解除，仅限本轮、仅限 Axiom-Flow。这不是标准变更，故**不立 ADR、不改 `standards/` 正文**；
> 对方工作区仍**零 git 操作**（提交归对方或人工）。
> 落笔时对方工作区不干净＝其 `develop`（HEAD `46f5f3f`）上有 PLAN-025 批的未提交代码：**已跟踪 21 文件 +2622/-185**
> （`api/main.py` +358、`db/repositories.py` +643、`schemas.py` +209、`engines/factory.py` +48、`engines/base.py` +70、
> `tests/contract/test_api_v1_contract.py` +593）**＋未跟踪新件 7 文件 +4831 行**（`orchestrator/knowledge.py` 1315、
> `db/llm_ledger.py` 136、四枚测试与 `tests/support/llm_ledger_schema.py`），与本壳改动同文件。用户据此裁**甲・直接叠加＋逐文件清单**：本壳在 AF 侧**只加不改其行**，
> 交付时给出「本会话改的文件」与「对方在途文件」两份分列，并在对方 PLAN-026 内写明出处，
> 以免其 `git add -A` 误并、`git checkout --` 误抹。

## 目标与成功标准

**目标**＝把「页眉页脚／章节名识别错误」从只能靠显示层掩盖，改成**源头可判、人工可改、改了有用**三件事同批成立：

1. 人工可改块类型（十枚闭集），且改判**进入 Axiom-Flow 自己的梳理取材视野**；
2. 页域识别补一枚 Axiom-Flow 独占视野才有的判据（整本跨页重复线），把误判成 `paragraph` 的页眉页脚从源头改判；
3. 根侧版式态出人工改标注入口，与 [REQ-140 壳](2026-10-24-parsing-layout-geometry-replica.md) R3 的三条件合取分层不重叠。

判据正文见 todo 的 REQ-142 行「成功标准」列（正本在行，本壳不复制条目）。

## 范围与非目标

**范围内**（六处，按批次排列）：

- **AF・扩载荷**＝`EDIT_PAYLOAD_KEYS`（`db/repositories.py:63`）加 `corrected_type`，其值受 `BlockType` 10 值闭集校验；
  `EditRecord`／`EditRequest`（`schemas.py:401-416`／`:435-441`）与 `api/main.py:552-580` 同批，其契约行归 `api.md` ②。
- **AF・取材回放**＝梳理取证腿（`orchestrator/knowledge.py:238-257` 读产物处）与页数据出口在有意图行时消费改判，
  使「目录抽取不吃页眉」成为构造事实而不是约定。
- **AF・页域判据**＝新增纯函数：整本视野下的**跨页重复线**探测（同文在多页出现 ⇒ header/footer/page_number 候选）。
  取读时计算，不写产物、不触发重解析（`parser_signature` 与 `orchestrator/signature.py:77` 的 `_TYPE_MAP` 快照不改写）。
- **AF・契约守护**＝其 `tests/contract/test_api_v1_contract.py` 的端点表与路由双向对账同批改判。
- **根侧・透传**＝`putBlockEdit`（`web-ui/src/api/axiom.ts:220`）加 `corrected_type` 一键；本仓不直写 `af_*`（ADR 0025）。
- **根侧・版式态 UI**＝每块类型下拉（10 枚全集），保存走上述 PUT，读回后回显当前生效类型。

**非目标**（六条，一律不做）：

- 不改 `BlockType` 闭集取值、不加第 11 种类型（加值会击穿 `af_operations` 的类型快照语义与其重解析签名）。
- 不请求任何 DDL：意图行载荷是 JSON 列，扩键零迁移。
- 不动 [REQ-140 壳](2026-10-24-parsing-layout-geometry-replica.md) 的 R1~R5 与其 Q1~Q4 待裁点：它的「类型 ∧ 页边带 ∧ 短文本」
  三条件是**渲染层合取过滤**，条件①等的就是本壳把类型供对，两判据不同源、不重复实现页边带。
- 不做批量自动写库回填（若将来要把自动判据固化成意图行，属 D 类数据窗口，须人工另发令，不在本壳）。
- 不在本轮做知识点合并梳理与确认三形（属 REQ-141 的门 B 与 W6）。
- 不向 Axiom-Flow 请求「只解析目录」的端点（现网解析端点不分目录与正文，属既有实况）。

## 前置条件

1. 用户「开始执行」放令（本轮四枚问答已裁全甲，但代码放令按项目「裁决先落文档」惯例单独等）。
2. 对方工作区状态：其 PLAN-025 批未提交码保持原样，本壳零 git、零 `git stash`、零回退他人在途文件。
3. 两侧门禁可跑：根侧 `tests/contract` 与 `web-ui` vitest 串行；对方 `pytest tests -q` + `ruff check src tests`。
4. 真机有一本生效版本的书可读页（现网 b05 317/317、b07 439/439 已全本生效）。

## 待裁点（立项轮不默认采纳）

- **T1 页域判据的两侧分工**＝甲・AF 只做跨页重复线、页边带留 REQ-140（**建议**，理由＝两判据不同源不重复，且整本视野只有 AF 有）；
  乙・AF 一次做完「重复线 ∧ 页边带」，REQ-140 R3 改判为纯消费（须改判他行判据，用户另裁）；丙・根侧自己做重复线（前端只拿单页，做不到，需批量取页腿）。
- **T2 自动判据的生效形态**＝甲・读时计算，零写库零重解析（**建议**）；乙・一次性回填成 `af_operations` 意图行（D 类窗口、须人工发令、b05＋b07 共 756 页量级）；
  丙・写进产物 `blocks.json`（破坏产物不可变性并触发签名变化 ⇒ 整本重解析，明确不取）。
- **T3 改标注入口的落面**＝甲・只在文档解析管理・版式态（**建议**，与该面既有块编辑能力同形）；乙・梳理屏中栏另加一处（两入口一份能力，且违背 v3「详情只留核心六件」的裁值）；丙・两处都进（同乙的代价）。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | **demo 门（一壳一门，ADR 0024 决定 2）**＝真机走通一条黄金路径：在 8903 文档解析管理・版式态把 b05 第 7 页一条误判成段落的页眉改成 `header` 并保存 → 8900 读回的该页块上人工改判可指认 → 版式态该行不再出现 → 且 Axiom-Flow 侧 `GET /api/v1/books/mathanalysis-b05/pages/7` 的取材输出带改判（**目录抽取不吃页眉**由此可断言）。到门暂停待人工验收 | 未执行（真机黄金路径含 PUT 保存点击，须人工发令；代码腿与用例侧已具备，读数随 W8 窗口出） |
| W2 | AF・扩载荷：`EDIT_PAYLOAD_KEYS` 加 `corrected_type` ＋ 闭集校验 ＋ `EditRecord`／`EditRequest`／`api/main.py` 三处同批；其契约测试与 `api.md` ② 行先红后绿 | 已实施（对方 PLAN-026 W2 承载：十枚闭集外 422、同名键落库、`EditRecord` 回显；零新列） |
| W3 | AF・取材回放：取证腿与页数据出口消费意图行；回归用例＝带 `corrected_type` 意图行时 `_heading_evidence` 不吃该块 | 已实施（对方 PLAN-026 W3 承载：两处消费面各一次仓储查询，正体新建 `normalize/intents.py`；含「换版不套用」「无改判行读数不变」两条反向断言） |
| W4 | AF・页域判据纯函数（跨页重复线，按 T1 取值）＋ 标定证据（b05／b07 真页读数）＋ 反例用例（正文反复出现的定理名不误伤） | 判据与反例半条已实施（`normalize/furniture.py` 三条件合取只供类型维、读时零写库，6 枚用例含两条反例）；b05／b07 真页标定读数未取（该函数本轮无消费方，随 W1 同窗口出） |
| W5 | 根侧・`putBlockEdit` 加键 ＋ `api-contracts.md` 对应行随步（先改契约再落码，与 REQ-141 批次 B 同口径） | 已实施（契约两行先行 + 8900 三处同批：`BlockEditBody` 闭集形状门、路由透传第五位参、`AxiomClient.edit_block` 加可选键） |
| W6 | 根侧・版式态类型下拉（10 枚全集）＋ 生效类型回显 ＋ `BlockList.test.tsx` 用例；与 REQ-140 W4 的人工通路对账不冲突 | 已实施（`BlockEditor` 十枚下拉＝`BlockType` 声明序；初值取生效类型；未改判不发键；保存成功后重取本页让两渲染模式按新类型重排；新建 `api/axiom.test.ts` 与 `BlockList.test.tsx`／`parsing.test.ts` 三处用例） |
| W7 | 文档随步：`design/frontend/parsing-ui.md` §9.1 的页眉页脚条文补「类型可人工改判」一句（小修通道，不单独立项）；对方 `parsing-management.md`／`api.md` 归其 PLAN-026 承载，本壳只指针不双写 | 已实施（§9 补「块类型改判」条与保存/回显两条随步、§9.1 页眉页脚条文补归属可人工改判一句；本仓不双写对方侧条文） |
| W8 | 三门禁＋真机读数交人工：`web-ui` vitest 串行、`tsc -b`、根侧 `pytest tests/contract`；对方 `pytest tests -q` + `ruff` | 两侧门禁已达成（读数见「过程与证据」）；真机读数未取（8903 需 build 后浏览器验收，保存点击须人工发令） |

## 过程与证据

| 日期 | 事件 | 证据与结论 |
| --- | --- | --- |
| 2026-10-26 | 用户三令与四裁 ⇒ 本壳与 REQ-143 壳成立 | 指令原文见 REQ-143 壳同日行。四枚问答取值全甲＝标注集・AF `BlockType` 10 值全集／改标注落 AF 侧扩载荷／两腿同轮（标注腿＋生成腿）／点级总结入 `summary`＋详解入 AF。另两枚基线问答取值甲＝AF 未提交基线上直接叠加＋逐文件清单／新行承载不动 REQ-139。 |
| 2026-10-26 | 实核出两条决定性事实（决定 W2／W3 必须成对） | ① 意图行**不在服务端合并**：`api/main.py:524-541` 返回原始 `blocks` ＋ 独立 `edits` 列表，`GET /pages/{no}` 的 docstring 写「已合并人工编辑」但代码未合并，合并发生在 8903 渲染层；② 梳理取证腿**零回放**：`orchestrator/knowledge.py:238-257` 直接 `BlocksPage.model_validate_json(blocks_path)` 与 `.md` 原文，不经 `OperationRepository.list_edits_for_page`。⇒ 结论＝只做 W2 不做 W3，则人工改标注对目录生成与 LLM 取材**零作用**，本壳目标第 1 条不成立。故 W2／W3 成对，且写进 S3 判据。 |
| 2026-10-26 | 人工改类型在现网确实无路（本壳的立项依据） | AF 载荷闭集 `EDIT_PAYLOAD_KEYS = ("block_type","verdict","corrected_text","corrected_bbox")`（`db/repositories.py:63`），其中 `block_type` 是原类型只读快照（`api/main.py:574`、`schemas.py:409`）；根侧封装只发四键（`web-ui/src/api/axiom.ts:220-233`）；全仓 `corrected_type` 零命中。 |
| 2026-10-26 | 页眉页脚「隐藏已在、识别不在」 | `assignRoles` 把 `header/footer/page_number` 恒判 furniture（`web-ui/src/components/parsing/typography.ts:123`）、`BlockList.tsx:246` 版式态默认不渲染，梳理屏中栏同腿 ⇒ 现网缺的是**类型正确性**：MinerU 出成 `text` 的页眉在 `_TYPE_MAP`（`normalize/blocks.py:17-38`）落 `paragraph`，两侧零几何与零跨页判据。REQ-140 R3 的条件①正依赖类型正确，本壳供其对的类型。 |
| 2026-10-26 | 对方侧承接已代登（其 PLAN-026） | 本壳 W2／W3／W4 的对方侧对应行与其工作项一一对应，登记在 Axiom-Flow [PLAN-026 壳](../../Axiom-Flow/docs/plans/2026-10-26-annotation-replay-and-kp-text-engine.md)（其 todo 新增 `PLAN-026` 主线行＋`REQ-142`／`REQ-143` 两枚支线行）；其「逐文件归属」节＝甲案要求的两份分列清单落点。对方侧四枚待裁＝AF-T1 `section_kind` 写手落点／AF-T2 槽位默认值／AF-T3 prompt 组装归谁／AF-T4 长文写腿的写列范围。**基线指纹修正**＝本壳「授权前提」原记「2185 行」不实，按 `git diff --stat`＋`wc -l` 实读改为**已跟踪 21 文件 +2622/-185 ＋ 未跟踪 7 文件 4831 行**（HEAD `46f5f3f`）。 |
| 2026-10-26 | 开工前对账结论：标注腿净集零冲突、放令生效 | 用户令「梳理下 axiom-flow 的任务（知识点梳理的），对齐 API 接口和数据库设计，然后准备开工前的准备，你判断梳理没恶意问题就开始执行」。三路对账（对方代码进度／对方契约正本／根侧消费面）后，**本壳 W2~W4 无一条撞在册条文**（扩载荷只动 `api.md` ③ 的 edit 载荷闭集与 `database-design.md:301` 的形状列举，两处随步同批改；零 ALTER、零新键）⇒ 按放令开工。受阻的三枚（R8 出站与记账／R9 长文端点与 `narrative_ref` 写者／R10 `section_kind` 写手）全在**生成腿**，与本壳判据无涉，已登在 REQ-143 壳 T6 与 PLAN-026 的 R8~R10。 |
| 2026-10-26 | 放令下按甲形实施 W2~W6，T1~T3 仍交审理（不默认采纳为裁决） | 用户令「…你判断梳理没恶意问题就开始执行」是开工放令，未逐条回答本壳 T1~T3。实施三条全部取**建议甲形**且都是不侵入他行的那一支：T1＝AF 只出跨页重复线、页边带原样留在 REQ-140 R3（未改它一字）；T2＝读时计算、零写库、零重解析（不碰 `parser_signature`）；T3＝改标注入口只进文档解析管理的块编辑弹层，梳理屏不加第二处（流式与版式共用同一弹层属该面既有形态，不是新增入口）。**若任一条改判乙／丙，对应工作项按新裁重做**，本壳不视甲形为既成裁决。 |
| 2026-10-26 | W5 契约先行与 8900 三处透传（定向用例先红后绿） | 先改 [api-contracts.md](../architecture/api-contracts.md) 两行：GET 行补「`blocks[].type` 是人工改判后的生效类型（8902 读时叠加，`markdown` 与产物文件不改写）」，PUT 行载荷改五键全可选并标明闭集正本在 8902。代码三处同批：`BlockEditBody` 加 `corrected_type`（`tests/test_api.py::test_axiom_edit_facade_rejects_block_type_outside_closed_set` 断言非法值 422 且 `seen == []` 即不打上游）、路由 `_call` 追加第五位参、`AxiomClient.edit_block` 加可选形参且 **仅在非 None 时**入载荷。先红读数＝两条新用例 2 failed（200 应为 422、`seen[0]` 为空）；落码后 `pytest tests/test_api.py -k "corrected_type or closed_set or edit_facade"` 4 passed。 |
| 2026-10-26 | W6 三条口径：闭集单点、生效值取改判、保存后重取本页 | `BlockEditor` 的十枚下拉取值常量 `BLOCK_TYPE_VALUES` 与 8902 `BlockType` 声明序逐字对齐，注释写明「加值须两侧同批改，本面不自行扩充」；初值＝`edit?.corrected_type ?? block.type`（同页未刷新也不跳回原类型），与生效类型相同则载荷**不带** `corrected_type` 键（零多余意图行）；`submitEdit` 成功后 `void fetchPage(bookId, pageNo)`——**生效类型唯一源在 8902 读侧**，8900 与 8903 都不自建类型合并腿，重取页让版式/流式两态按新生效类型重排，改判成 header/footer/page_number 的行随 furniture 默认隐藏而消失。角标＝`EditTags` 出「类型改判」橙标，弹层内以「原：X」注记保留产物原类型。 |
| 2026-10-26 | jsdom 断言两坑与三处变异复验（守护有效性证据） | 坑①`findByTitle('段落')` 报「Found multiple elements」——antd Select 的选中项与下拉选项都带 `title`，改用 `.ant-select-item-option-content` 十标签数组按序断言；坑②`getByRole('button', {name:'保存修正'})` 找不到钮，改 `(await screen.findByText('保存修正')).closest('button')`。变异复验各出一红后逐行还原（不 `git checkout`）：删 `axiom.ts` 的 `corrected_type` 键行 → `api/axiom.test.ts` 1 failed；删 `parsing.ts` 的重取页行 → `stores/parsing.test.ts` 1 failed；强制恒发 `corrected_type` → `BlockList.test.tsx` 1 failed。 |
| 2026-10-26 | 两侧三门禁读数（净集全绿） | 根侧：`web-ui` 内 `npx tsc -b` 退出码 0；`npx vitest run --no-file-parallelism` **70 文件 / 966 passed**（串行才可信）；仓根 `pytest tests -q` **880 passed**（含 `tests/contract`）；`ruff check backend tests` All checks passed。对方：`pytest tests/contract -q` 253 passed、`pytest tests -q` **953 passed／18 skipped**、`ruff check src tests` clean。 |
| 2026-10-26 | 已知未净半条（影响 S 判据的「取材」一侧，不静默吞掉） | AF 读侧回放只叠加**判别维**＝`corrected_type` 覆盖 `Block.type`，`text`/`latex`/`markdown` 与磁盘 `.md` 产物一字不改写。后果＝改判成页眉的行，其**标题取证**（`_heading_evidence` 按类型分派）已不吃它，但它作为**正文文本**仍会进 LLM 取材的 markdown 通道。⇒「目录抽取不吃页眉」在类型维成立，「正文去家具」不在本壳交付内：或走根侧渲染腿过滤，或由对方裁是否让回放覆盖 markdown（覆盖即破产物不可变并动签名）。此条同时登记在对方 PLAN-026「过程与证据」，交用户与对方据此定后续。 |

## 验证与验收

- 判据逐条对照 todo 的 REQ-142 行 S1~S5，关闭时写入 completed.md 证据列。
- 两侧同批改判必须同时绿：AF 端点契约测试与根侧 `tests/contract` 不得只有一边改判。
- 真机取证走 `qed-frontend-check` 口径（8903 跑构建产物，导航带 `?v=` 并比对 `script[src]` 哈希）。
- 人工验收位＝W1 demo 门；写库点击（PUT 保存）须人工发令后执行。

## 回滚

- 文档回滚＝本壳与 todo 行同批撤销（`git revert` 单提交，不 `reset`）。
- AF 侧代码回滚＝只撤本会话清单内的行/文件（叠加式改动，逐文件清单在「过程与证据」随步登记），不整树回退。
- 前端回滚＝类型下拉与 `putBlockEdit` 加键各自独立可撤，撤后现网行为回到本批前形态（版式态与梳理屏均不受影响）。
- 数据回滚＝意图行是新增事件明细，不删不改历史行；若改判有误，走同一条 PUT 以正确值覆写（读侧最后一条生效）。

## 关闭与归档

- 关闭前置＝W1 demo 门经人工验收、S1~S5 逐条有读数、两侧契约同步无漂移。
- 归档判定 `Retain`；关闭时按[文档治理规范](../standards/doc-governance.md)与 `qed-closeout` 顺序：文档写结论 → todo 行压缩关闭 → completed.md → plans/index.md → project-status 刷新 → 门禁全绿。
