# 三项目协同与对接契约（cross-project-contracts）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-10-24
确认状态：已确认
关联代码：子项目各自仓库（`Axiom-Flow/`、`QED-Tracker/`）、`backend/qed_engine/clients/tracker_client.py`（8901 客户端实现）
关联测试：`tests/test_api.py`、`tests/test_config.py`、`tests/test_tracker_client.py`、`tests/test_web.py`；子项目各自契约测试
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)、[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md)、[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)、[ADR 0017](../adr/0017-design-doc-structure-contract.md)

## 1. 定位与目标

本文件定义 QED-Engine、Axiom-Flow、QED-Tracker 三个项目的对接点与边界，并作为跨项目协作的
**总指引**：读者不进入子仓库即可回答四问——① 改动归属哪个仓库（判定表见
[四服务架构与边界](../architecture/four-service-architecture.md)「改动归属判定表」节）；
② 契约怎么改算合规（§10 契约演进规则）；③ 单个项目/合并运行各要什么才能跑起来
（§9 运行与验证矩阵，双态验收基准）；④ 下游出错/离线时上层什么表现（§11 错误、超时与离线透传）。

**分工铁律**（用户裁决 2026-09-24）：根仓库管总指引与全链路（本文件 +
[四服务架构与边界](../architecture/four-service-architecture.md)），子仓库管细节
（API 端点形状、表结构、内部设计）。本文件对 8901/8902 只登记**能力面与消费语义**，
不维护端点表（§5/§6，按 [ADR 0017](../adr/0017-design-doc-structure-contract.md)
事实源唯一铁律执行）。

**成功标准**：按 §9 矩阵，每个服务可独立启动跑通自身职责（单项目态），四个服务合并后
下载→交接→解析→前端消费主链端到端可验收（合并态）；本文件的规则陈述与 `clients/`、
`api/` 实际行为一致。

## 2. 范围与非目标

逐项边界（本文件**不**维护以下内容）：

- 四服务结构、职责、端口与独立性铁律 → [四服务架构与边界](../architecture/four-service-architecture.md)（唯一事实源）；
- 8900 面向前端的接口形状（含 8901/8902 适配后的透传端点与错误映射）→
  [api-contracts.md](../architecture/api-contracts.md)；
- 8901 端点/字段级契约 → QED-Tracker 仓库 `docs/architecture/api.md`（本文件 §5 只登记能力面）；
- 8902 端点/字段级契约 → Axiom-Flow 仓库 `docs/architecture/api.md`（本文件 §6 只登记能力面；
  全链路消费语义见 [parsing-flow.md](parsing-flow.md)）；
- 表结构 → [database-design.md](../architecture/database-design.md) 总纲 + 子项目各自数据库文档；
- dataset 布局与版本目录 → [dataset-conventions.md](dataset-conventions.md)；
- 配置与密钥 → [project-configuration.md](project-configuration.md)；
- 8903 前端界面契约 → [前端架构](../architecture/frontend-architecture.md)（本文件只记对接要点，§7）；
- 跨项目**流程**（发起/评审/执行/回执/诊断三必查）→
  [跨项目协作规范](../standards/cross-project-collaboration.md)（流程唯一事实源；本文件 §10
  只定接口契约的变更分级，流程按该标准走）。

## 3. 对接点

| 对接点 | 现状 | 目标 |
| --- | --- | --- |
| QED-Tracker → Axiom-Flow | HTTP handoff：`axiom push`（默认 `http://127.0.0.1:8902`，8000 兼容保留） | 冻结（`QED_AXIOM_URL` 配置注入） |
| QED-Tracker → dataset/raw | 已迁 `raw/<domain_id>/...`（QED-009 / ARCH-019）；探索产物与下载成品落 `raw/<domain_id>/<course_id>/` | 冻结（含 JSON 例外口径，REQ-078） |
| Axiom-Flow → dataset/parsed | 写入 `<QED_DATA_ROOT>/parsed/<domain_id>/<course_id>/<book_id>/`（版本布局见 [dataset-conventions.md](dataset-conventions.md)） | 冻结（[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)） |
| Axiom-Flow → 本地模型服务 | 解析经 8900 `/llm/vision` 网关（v0.1） | **直连本地模型服务**（引擎适配器，MinerU 5002 等）；8900 只负责模型生命周期与探针（[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)） |
| QED-Engine 统一 CLI → 子项目 | 已落地：`qed tracker` 直连 8901（运维工具，保持直连） | HTTP 调用 8901/8902；地址默认 localhost 端口，可配置 |
| 8903 前端 → 子项目 | **已重构（ADR 0007）**：前端只连 8900，数据域/服务域由 8900 适配 8901/8902 | 冻结（前端唯一入口 8900） |
| QED-Engine 配置中心 → 子项目 | 子项目直读根 `.env`（`load-env.ps1` 映射层已于 2026-08-17 退役） | 冻结（子项目直读 `QED_*` 变量） |
| 三个项目 → MySQL | 三服务同钉测试库 `qed_test`（用户裁决 2026-10-17：并库后单一工作库；业务库 `qed` 同期完成结构对齐与关键数据回灌，随时可承接，窗口证据见 [REQ-118 壳](../history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md)） | 冻结：统一 MySQL 8 `qed` 库，QED-Tracker `qt_*`、Axiom-Flow `af_*`、共享元数据 `qed_*`（只读），`QED_DB_*` 唯一事实源；测试库 `qed_test` 隔离真实数据（遗留库已收敛清零） |
| QED-Tracker → 资源登记 | 单资源 JSON `meta/resources/` + MySQL 知识层次五表登记（`qed_domain`/`qed_course` 共享 + `qt_knowledge`/`qt_books`/`qt_sources` 私有，QED-031；表结构见 QED-Tracker `docs/architecture/database-private-tables.md` 与 `database-shared-tables.md`） | **元数据默认存数据库**（meta/ JSON 退役，DB 为唯一事实源）；dataset/ 只管理数据资料文件 |

## 4. 统一数据库（MySQL 8，qed 库）

三个项目共用同一 MySQL 8 `qed` 库实例（[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)，
表命名空间隔离，属独立性铁律的明确例外）。`qed_*` 共享前缀表族（`qed_domain`/`qed_course`
课程体系元数据，[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md)）所有权
QED-Tracker（建表维护），其他项目**只读不写**；共享表不复制 JSON。
表命名空间、表清单、关键字段、迁移与敏感字段规则见[数据库设计](../architecture/database-design.md)；
凭据与库名唯一事实源为根 `.env` 的 `QED_DB_*`（见
[project-configuration.md](project-configuration.md)），密码绝不下发到任何接口响应。

`qed_*` 共享表 **schema 变更顺序**：所有权方（QED-Tracker）迁移先行发布，同时按 §10 破坏性
变更流程经请求流通知消费方（Axiom-Flow / 8900 只读侧），消费方代码回归在同窗收口前完成；
消费方不得先于所有权方依赖未发布的列。

**根所属共享表的加列口径（2026-10-21 v1.0 定档；三列已于 2026-10-22 在工作库 `qed_test` 落地，生产 `qed` 属人工窗口）**：`qed_knowledge_point` 的所有权方是
根侧（结构由根定义、8900 是唯一写者），故加 `aliases`／`narrative_ref`／`angles` 三列按 R3 走
「先改根总纲与接口契约 → **通知**两项目消费方」即可，**不发跨项目请求函**——三列对 8901/8902 是
追加式变更且两者对本表只读、不消费这三列，零破坏。仅当对方 ORM 做全列映射而需随步时，才在通知里
附一个转告窗口。逐列形状与「为什么是列不是 `meta`」的论证正本在
[database-design.md](../architecture/database-design.md) 五章该表小节，规则级判据在
`docs/adr/0026-v1-root-table-family-freeze.md`。**与 §6 提升腿的衔接**：`narrative_ref` 存的是
数据根相对路径全串（非单段文件名），正是为了 8902 离线时 8900 仍能自行解析——若改存单段名，
根侧就得向对方问路径前缀，即破独立性铁律。

**跨项目请求登记**（本节只登记编号与去处，判据正本在台账行与其承载壳）：`REQ-119` →
QED-Tracker，`qed_domain`／`qed_course` 两表形状定档承接（R1~R6）于 **2026-10-23 以 `Partial` 收口**，
承载壳见
[2026-10-16-shared-tables-tracker-request.md](../history/plans/2026-10/2026-10-16-shared-tables-tracker-request.md)（**契约面仍有效的两件事实**：
① R1 `meta` 扩展槽／R2 主键与外键宽度收 `varchar(64)`／R3「主键值不可改」条文／R4 `level`／`scope` 注释语义／R6 对方文档快照改指根总纲五条
已在对方树内成型（2026-10-23 实读其 `models.py`／`schema.py`／`database-design.md` 取证）；② **R5 未执行**——`qed_domain.path_results` 与
`qed_course.related_targets` 两列**在册且仍可写**，故本节消费语义照旧、两列的摘除**必须双仓同批**（根侧
[shared_tables.py](../../backend/qed_engine/services/shared_tables.py) 的 `qed_domain` INSERT 列清单同样点名 `path_results`，先删一侧即断 8900
离线降级写），逐列改面清单见归档壳「遗留与移交」节；**对方逐条回执（本请求 S2）与其 `QED-080` 行的收敛仍归对方会话**，根侧不代出回执）；
`REQ-122` → QED-Tracker 与 Axiom-Flow，根文档升为三项目数据库总正本后的**正本声明改镜像**请求
（R1 对方 `database-shared-tables.md` 的「设计唯一事实源」改为镜像并指回根总纲、R2 `qt_*` 列变更先经根侧登记
且 `qt_sources.book_id` 宽度不匹配交其裁决、R3 `related_targets`／`path_results` 两列删否（**2026-10-18 用户复裁＝都删**，执行随 REQ-119 R5）、R4 `af_*` 列级晋升为后续批次、
R5 其文档自陈 Alembic 位置与生产库实存不符请更正），承载壳与请求稿见
[2026-10-16-database-design-core-registry.md](../history/plans/2026-10/2026-10-16-database-design-core-registry.md)；
`REQ-123`／`REQ-129`／`REQ-133`／`REQ-135` → Axiom-Flow 四枚在册请求已于 **2026-10-21 经用户裁决合并为单枚综合请求 `REQ-136`**
（挂 ARCH-025 轮线 2，一次谈定 `af_*` 专用表族重构）：R1 两库现状读数与迁移链自陈更正、R2 档 B 整族重建采否与四件必答、
R3 逐列形状与净新增两枚知识点表准入（并入原 `REQ-133` R2／R3／R5／R6、`REQ-135` R3／R4）、R4 书级三列自洽与两库分叉归一
（原 `REQ-123` R1／R2）、R5 `af_parse_jobs` 保留窗与生效指针不可裁剪不变量（原 `REQ-129`）；承载壳见
[2026-10-21-af-family-rebuild-consolidated-request.md](../history/plans/2026-10/2026-10-21-af-family-rebuild-consolidated-request.md)
（**登记口径 2026-10-21 复核**：对方台账已自成承接——其 `docs/trackers/todo.md` 的 PLAN-024 行自陈「**请求接收（QED-Engine 根仓库 REQ-136，并入 REQ-123／REQ-129）**」，其 `todo.md:33` 的 `REQ-123` 与 `todo.md:45` 的 `REQ-129` 两枚入站行已改指 `REQ-136`，故本段原「待发函、对方台账尚无承接行」与下句「待发函窗改指」两处口径**已被对方台账现状超越**；本会话只登记这一观察，`REQ-136` 的关闭判据仍以其逐条回执为准，其 R1~R5 状态列一字未改，改判归该行会话；**2026-10-24 该枚综合请求以 `Achieved` 收口**＝对方 2026-10-23 自关其 PLAN-024（采**档 B 整族重建并已执行**，2026-10-22 落库，`af_*` 定档四张、head `20261022_0001`、旧三表两库零存活），R3 净新增形状**经对方改判**为 `af_operations`＋`af_kp`（非本案原提的两枚窄表）、R4 的「ingest 复位归零」经其裁决⑳ **裁撤不跟踪**，根侧六处总纲随步＋两库只读探针复算，S1「六项对接信息」经用户裁为**等价达成**，逐条对照见归档壳「关闭与归档」节与 [completed.md](../trackers/completed.md) 的 REQ-136 行），**逐列形状正本已移交对方** [AF PLAN-024](../../Axiom-Flow/docs/history/plans/2026-10/2026-10-21-af-table-family-rebuild.md)（`af_*` 四张：`af_books` 零改列／`af_operations` 事件明细／`af_pages` 结果索引／`af_kp` 知识点单表 23 列（**原记 21 列＝事实错**，2026-10-24 两库只读探针复算更正，归 [REQ-138 壳](../plans/2026-10-23-admin-render-and-kp-review-workspace.md) 第 7 条在案观察），其上游设计稿 [REQ-134](../history/plans/2026-10/2026-10-21-af-table-architecture-design.md) 于 **2026-10-21 退为指针**（R-1~R-7 七枚裁决点全部有答案，根侧承接面＝只读导出端点 + 共享主表提升腿）；
`REQ-123`／`REQ-133`／`REQ-135` 三枚原请求稿壳按 ADR 0021 第 5 条**归并不删壳**移
[`history/plans/2026-10/`](../history/plans/2026-10/2026-10-17-af-books-parse-status-request.md) 并置 `状态：Superseded`
（`REQ-129` 原无独立壳，承载在 [普通任务轮壳 W5](../plans/2026-09-29-ordinary-tasks-round.md)），逐条映射写在
[completed.md](../trackers/completed.md) 四行；对方台账的两枚入站承接行（其 `todo.md:33` 的 `REQ-123`、其 `todo.md:45` 的
`REQ-129`）**已改指 `REQ-136`**（2026-10-21 实读其行文，见上条登记口径）；`REQ-121` → QED-Tracker，`qt_books` 书级两列（`intro`／`audience`，或按其 meta 守则改判为 `qt_books.meta` 键位）＋ 8901 `GET /books` 透传＋存量回填口径（R1~R5；**行数更正**＝原写「17 行」系 2026-10-16 立项读数，2026-10-23 只读探针复算 `qed_test`＝`qt_books` **26 行**，其中 17 本已进 `af_books`（17/17 命中 10 枚教程套）、9 本尚未进解析侧），承载壳见 [2026-10-16-book-intro-audience-tracker-request.md](../history/plans/2026-10/2026-10-16-book-intro-audience-tracker-request.md)；**2026-10-23 发函**（用户授权原文＝「我确认授权根侧代登对方文档面；与REQ-119 并成一枚发函」）＝与上条 `REQ-119` 残余并成**一枚三事**落对方同一承接窗口（其 todo `QED-082` 行＋其 `docs/plans/2026-09-24-v1-task-chain.md`「承载根仓库 REQ-121」节，只改其两份既有文档、零新建 md），携带＝本请求 R1~R5 ＋ `REQ-119` 两未做项（R5 双仓同批改面清单、逐条回执催办）＋ `REQ-128` 取消告知（其 `QED-078` 行失去需求方）；并函只并**发函与承接窗口**、不并根侧台账行（`REQ-119` 已收口且四项达成，另立综合 ID 会作废既有证据并要对方重新承接，与 `REQ-136` 四枚未承接请求的并法不同）；根侧消费动因随步＝教材卡两列现由套级派生，`kt-mathanalysis-3`（4 本）与 `kt-mathanalysis-4`（5 本）两枚套吃掉 9 本共用两句简介，判定已由「已知妥协」升级为**现网误陈述**，而书级事实源在对方、根侧不可自行修正；「R1 是否收窄为只要 `intro`、`audience` 推后」在同批裁决中用户未答曾**保持待定**，**2026-10-23 用户复裁＝收窄落地**（原文＝「确认只要只要 intro，audience 推后，继续执行，可用授权你最小化改动qed-tracker并进行两方的收尾」）⇒ R1 终态＝`qt_books.meta.intro` 单键（**零 ALTER**，走对方 meta 守则的键位替代），`audience` 推后、面向对象继续读套级 `position`；R2 取证＝对方 `to_dict()` 全列天然透传 `meta`，**现网零改码即成立**（原请求稿的 `GET /books/{id}` 单数端点在对方不存在，读位＝`GET /books`）；R3 口径回执＝**判退套级派生批量回填**（复制同一句套话零信息增量、会把误陈述固化入库），逐本登记走本批新增写面 `PATCH /api/v1/books/{id}`（按键合并），现网 26 行 `meta` 全 NULL ⇒ 卡面文案当前不变；根侧消费面随步＝`api/learn.py` 的 `books[].intro` 改**书级优先**、套级降兜底（`api-contracts.md` §⑥ 同批改定），两枚定向用例守护「书级命中」「书库腿离线回落」；**本行已于 2026-10-23 以 `Achieved` 收口**（S1~S5 逐条对照见归档壳「关闭与归档」），执行身份披露＝对方侧代码与回执由根侧 agent 依上述授权**代执行代出**、非对方会话独立出具，对方复核后可改判（表结构零改动、撤回路径逐条在归档壳「遗留与移交」）；对方门禁随步＝其 `tests/test_documentation.py` 代登前 **1 failed／8 passed**（唯一红＝其 `QED-080` 行仍指 `REQ-119` 请求稿的归档前路径，系 2026-10-23 收口批移动文件未随步入站链接，本批顺带修红）→ 代登后 **9 passed**；`REQ-128` → QED-Tracker 的两张作业表**保留期口径自定**请求于 **2026-10-21 取消**（**Not Applicable**，需求失效依据两条：
① 根侧总纲 §7.9 的裁剪边界与「四类行不可裁剪」已成文，根侧既不代设数值也不代执行，向对方发函无新增约束；② 代码查证推翻
原 S2 的立论前提——`qt_selections` 不是流水表而是**数据源表**，`QED-Tracker/src/qed_tracker/db/selection_repository.py:183-190`
以全表 `payload.downloads` 派生论文去重集，按行裁剪即误删去重记忆）；同批的 `REQ-129`（`af_parse_jobs` 保留期）**不随取消**，
已并入上条 `REQ-136` R5；落点见 [普通任务轮壳 W5](../plans/2026-09-29-ordinary-tasks-round.md)；
`REQ-139` → Axiom-Flow 的**知识点梳理模块三面承接请求**（甲・条文面 A1~A6／乙・写者与通路面 B1~B4＝其 PLAN-024 的 W10
实现批、**2026-10-23 起由对方自立的 PLAN-025〔其 [2026-10-23-kp-curation-implementation.md](../../Axiom-Flow/docs/plans/2026-10-23-kp-curation-implementation.md)〕承接其 W10**／丙・端点面 C1~C8 含批量取页）于 **2026-10-23 发函**，承载壳见
[2026-10-23-kp-review-af-request.md](../plans/2026-10-23-kp-review-af-request.md)，判据正本＝其上游核查轮
[REQ-138 壳](../plans/2026-10-23-admin-render-and-kp-review-workspace.md) 的梳理稿三段与本函工作项表；三面**全部零 ALTER、
零新迁移**——发函时曾按条件项 X1 登记「章→页区间加列」，根侧 Q4 已裁为**甲案**（由该节全部 point 行
`anchors[].page` 取 min/max 读时派生，派生不出时人工补起止页落根侧 `meta` 作兜底）⇒ X1 作废，本函对 `af_*` 列面
零请求；对方列面已为四步备齐位置，缺的全是写者与条文。
对方文档面已按根侧合法动作代登承接（其 `docs/trackers/todo.md` 的 `REQ-139` 行＋其 PLAN-025 壳「承载 REQ-139」节，
未新建其任何 md 文件）；代码面、排期与逐条回执归对方会话，根侧本函零代码零 DDL。
**2026-10-24 形状核对后的净新增三面**（同函登记、不另发新函，正文在 REQ-139 壳）＝`N1` 文本引擎适配器接入（其
`engines/factory.py` 槽位登记表空 ⇒ 梳理提交恒 503）、`N2` 梳理面在网生效（现网 `openapi.json` 零枚 kp 路由）、
`N3` 人工直登记知识点的创建端点（其 `kp` 路由无创建入口，阶段一暂走根侧 `POST /learn/knowledge-points`；计数不落字面＝2026-10-26 对方 PLAN-026 W7 已把长文两条腿加至九条，本枚「无创建入口」的判定不变）；
另 `C7` 批量取页仍未在册。**根侧消费口径**＝梳理屏的实施与透传已由 [REQ-141 壳](../plans/2026-10-24-kp-review-screen-and-kp-passthrough.md)
承载，N1／N2 到位与否**不阻塞根侧屏的交付**（空态与拒绝态可见即算合法形态）；
**2026-10-25 批次 B 出函的两句随步增项**（正文在 REQ-141 壳的 T11，本处只挂指针不重述守则）＝① 梳理产物形状口径改判＝
「章级目录＋挂章知识点行，第二级不是目录」；② 请其解析腿核对目录页条目的换行可靠性（黏行与跨行题名两形，取证见同壳
DEFECT-025 与其同日「过程与证据」行）——我方抽取与迁移腿独立设清洗防线，**不以其回执为前置**；
`DEFECT-024`（乙案）→ QED-Tracker，**2026-10-25 发函**：请其 `src/qed_tracker/api/main.py` 的
`_domain_view()` 在领域层载荷补 `scope` 一键，使 `GET /courses`（含 `GET /courses/{id}`）与其早已
含该键的 `GET /domains` 两读面同形——现网 `GET /courses` 的领域层结构性不返 `scope`，8903「编辑领域
知识」弹窗初值因此落空串，保存即以空串经 8900 透传覆写库中用户正文（真库取证：数据未丢，
`qed_test.qed_domain` 的 `math-advanced` `scope` 长 185 字符，属**读面不全**非数据丢失）。**零 ALTER、
零迁移、零数据改动**（该键在对方 `_domain_view_flat()` 已成型，属补齐既有承诺而非新增形状）。
根侧甲腿（前端由 `GET /domains` 补齐缺键行 + `undefined` 不进提交体）**已先行落地**，故本函不阻塞
现网；对方落地后补齐腿自动让位、根侧零改码。判据正本＝根侧 todo `DEFECT-024` 行与其承载
[普通任务轮壳 W31](../plans/2026-09-29-ordinary-tasks-round.md)；承接位＝对方 todo `QED-083` 行＋
其 `docs/plans/2026-09-24-v1-task-chain.md`「承载根仓库 DEFECT-024」节（只改其两份既有文档、零新建 md，
避其文档白名单门禁）；执行与逐条回执归对方会话，根侧代登范围止于其文档面。
`REQ-143`（第三令增项）→ Axiom-Flow 的**梳理输入面四枚请求**（本处只挂指针，正文在其 PLAN-026 壳的「需求方第三令承接」节
与根侧 REQ-143 壳的 T7~T11）＝`AF-T5` 重新解析的**人工评审备注**载体（其 `KpJobCreate` 现三键且 `extra="forbid"`，
范围半条由在册 `page_start`／`page_end` 承载、零对方变更）；`AF-T6` 页眉页脚页数的**剔除作用层**（其
`furniture_hints` 判据已在册但零消费方，且喂模型的整页 `markdown` 现含家具行）；`AF-T7` 块编辑意图闭集扩
「隐藏」「强调」两枚键（其 `EDIT_PAYLOAD_KEYS` 五枚内无此二形，只隐不删、零 DDL）；`AF-T8` **导读的成文位**
（其 `af_kp` 无导读列、读投影 `_kp_node_out` 不发 `meta`）。四面均**零 ALTER**；四枚裁点已于 2026-10-26 同日出裁
（`AF-T5`／`AF-T7`／`AF-T8` 甲，`AF-T6` 甲＋乙合取＝剔除只作用梳理取材层并叠加页数据读投影的一记家具标记，产物文件不改），
动码等需求方一句「开始执行」；
梳理屏三部分的形态与第三行四件归 [REQ-143 壳](../plans/2026-10-26-kp-generation-leg-and-one-click-summary.md)，
其「接口与库变更全归 Axiom-Flow」的硬取向与 ADR 0026、`af_kp` 唯一事实源同向。
`REQ-143` 的**根侧透传半边已于 2026-10-26 落地**＝8900 §④ 梳理透传面七条扩为**九条**（新增长文两条腿
`PUT`／`GET /kp/nodes/{node_id}/narrative`，一比一镜像对方 PLAN-026 W7 的同名端点；正文长度上限、判定序与是否落盘
全判在 8902，本层不预检、不改写、只把连接失败合成 503）。`N2`「在网生效」的两半自此分明＝根侧半条（8900 透传）已兑现，
对方半条（改动提交与 8902 重启）仍归对方会话。
`REQ-143` 的 `AF-T5` 备注通道半边已由对方 PLAN-026 **W11 落地**（2026-10-26）＝其 `KpJobCreate` 加可选 `review_note`
（≤2000 字符，超限 422 不截断）、批次流水 `payload` 由三键扩为**四键**、进度面 `ledger.review_note` 恒发、该轮两阶段
prompt 追加「人工评审意见」上下文段（判据晋升其 `KA-31`）。⇒ 上面「`KpJobCreate` 现三键」是**发函时的状态**，
现已是四键。根侧承接＝**零改码**：§④ 的 `POST /kp-jobs` 拿 `payload: dict` 整份转体（`api/axiom.py:385`＋
`clients/axiom_client.py:196` 的 `json=body`），新键自动随体走，本层不解释备注也不校验它——用例
`tests/test_api.py`（九条镜像那枚）已把带备注的请求体逐键钉住，转发面若漏键即转红。
`DEFECT-026`（2026-10-27 真机第一轮发现，请求：Axiom-Flow）＝梳理网关 `_drafts`（其 `engines/kp_gateway.py:243-258`）
只有代码围栏与前后杂讯两条容错，**模型回复含非法 JSON 转义即抛 `EngineError`**，`extract_points` 按节跳过 ⇒
批次 `status=ok` 而 `failed_sections=1`，整节知识点静默丢失（原证＝其 `qed_llm_calls` id 130 `status=success`、
`GET /api/v1/logs/axiom?keyword=抽取失败` 回「节抽取失败，跳过该节：mathanalysis-b07 的第 33..34 页」）。
数学教材正文里的单反斜杠是常态，整本跑时必高频复发。判据正本＝根侧 todo `DEFECT-026` 行与 [REQ-143 壳](../plans/2026-10-26-kp-generation-leg-and-one-click-summary.md)
同日「真机第一轮」行；**根侧零改码可解**，执行与回执归对方会话。
**⇒ 本案已按需求方 2026-10-27 裁「甲・容错腿＋可指认披露同批」由对方落地**（其 PLAN-026 W10 后半条的收口批）＝
`engines/kp_gateway.py` 的 `_drafts`（其 :290-315）在解析失败后先过一条 `_repair_json_escapes`（其 :58，只加倍 JSON 串内
**不合法**的那枚反斜杠，合法转义与 `\uXXXX` 逐字节不动，补完仍不可解析才归一 `EngineError` 并说出「补过」）；
`orchestrator/knowledge.py` 的按节失败披露同批改判——失败节的 `{title, page_start, page_end, reason}` 随 `failed_sections`
**同序等长**进批次流水 `result.failed_section_details`（其 `KP_RESULT_KEYS` 由十四键扩为**十五键**，零失败节出空数组不出缺键），
判据晋升其 `KA-32`、`api.md` ④ 进度面示例与 `code-map.md` 两行随步；对方门禁读数＝`pytest tests -q` **1036 passed／18 skipped**、
`ruff check src tests scripts` All checks passed（六枚新用例先红后绿，两枚变异校验各自点名「过修」与「账面不点名」）。
根侧承接＝**零改码**：§④ 的进度腿整份转 `result` 字典，新键自动随体走；屏上把失败节呈现成人话属 REQ-143 的在途前端项，不在本函范围。
`AF-T9`（同日发函）＝**`KA-5` 目录阶段取材改判**：现网两本教材整本零 `heading` 块（章名与节名一律落 `paragraph`），
目录阶段因此零输入，而其 `_OUTLINE_PROMPT` 早已要求模型认「书自身目录页的条目」——规则在册、取材不给输入。
改判稿四案与三枚随批子问题（含「条目拆分与印刷页码偏移标定」判据的**正本归属**：根侧 `web-ui/src/tocParse.ts` 已持该套清洗与
`estimateTocOffset`）正文在其 PLAN-026 壳新增的 **R11** 节。**2026-10-27 需求方出裁＝甲-B・名称回定位**（模型只给「名称＋层级」，
页号锚由引擎拿名称在正文页做规范化匹配、命中最早正文页即为锚，等于把丙案那五枚手工改判自动化）；**同日四问四答把三枚随批子问题一并出齐**
＝子一・匹配不到的目录行去向＝**保留为目录行＋账面点名**（窗口外的命中不认成锚，条目仍成行、锚落回目录页、条目名原文进
`result.unlocated_outline_entries`）；子二・条目拆分与印刷页码偏移标定的正本＝**归 Axiom-Flow**（⇒ 根侧 `tocParse.ts` 自此降为
**显示层清洗**，其 `estimateTocOffset` 不再作为第二处取材事实源，两侧各写一份必漂移的隐患就此消除）；子三・整本成本与是否分批＝
以 `AF-T10` 那枚只目录入参承载（不把页区间划窄——目录页在最前，划窄只会把正文切没）。
**判据已成文、码未开始**＝其侧五处文档已落（`KA-5` 改判正文＋新条 `KA-33` 条目腿与 `KA-34` 只目录＋`KA-27` 键数随步＋
`KA-31`／`KA-32` 落点格的键数改写为「以 `KA-27` 为准」以消除同一形状的两处声明；其文档门 40 passed），实现批＝其 PLAN-026 **W14**，
本函的根侧透传腿与屏**一字未动**（等其落码后由 `AF-T10` 那半条承接）。
`AF-T10`（2026-10-27 发函，随需求方第五令）＝**梳理批次加一枚只目录入参**：`KpJobCreate.stage ∈ {full, outline}`、缺省 `full`、
`outline` 时知识点阶段整条不发起（零点行、收尾与批次流水照跑、调用账只有 `step=outline` 一笔），判据正本＝其 `KA-34`。
为什么必须新增这一枚而不是让界面把 `page_start`／`page_end` 划窄＝真机成本读数（批次 `afkp-215187d641e2`）显示一枚 outline 调用 149.5 秒、
每节 points 137~205 秒，整本按 80~120 节估＝一轮数小时；「先只把目录跑出来给人看」这一诉求若靠划页区间实现，区间窄到目录页就没有正文可梳理、
区间宽则两阶段照跑 ⇒ 载体只能是「跑哪几个阶段」这一枚入参。**零新端点、零 ALTER**（与在册的 `page_start`／`page_end` 同类的请求体键）；
根侧承接＝**透传零改码**（§④ 提交腿整份转体，新键自动随体走，本层不校验值域），净缺只剩屏侧提交腿带上 `stage:'outline'`（落根侧 REQ-143 壳 W15）。

## 5. QED-Tracker 服务接口契约（8901）

端点/字段级形状事实源：QED-Tracker 仓库 `docs/architecture/api.md`；8900 对前端的适配面与
错误映射事实源：[api-contracts.md §③](../architecture/api-contracts.md)。本节只登记能力面
与消费语义（2026-09-24 用户裁决：端点详表收回子仓库，原「对接快照」例外关闭）。

- **基本面对接**：前缀 `/api/v1`；`GET /api/v1/health` 存活检查（8900 托管探测，§9.2）；
  只读查询同步返回；8903 浏览器不直连（ADR 0007，一律经 8900 数据域访问）；
  8900→8901 服务端到服务端调用不受 CORS 限制。
- **能力组一览**（语义要点 → 形状事实源指针）：

  | 能力组 | 消费语义要点 | 形状事实源 |
  | --- | --- | --- |
  | 领域/课程体系 | `qed_*` 共享表只读 + 领域维护与探索状态迁移（确认/重探/导入为异步语义） | Tracker `api.md`；`api-contracts.md` §③「领域与课程体系」「领域探索五态门面」 |
  | 教程与书库 | 教程两态 `draft→confirmed`（QED-031）；书籍五层语义＝选用态/持有态/下载生命周期（QED-050-D/060，非法迁移 409）；渠道 sources 一次尝试一条、`ok` 表成败 | Tracker `api.md`；`api-contracts.md` §③「教程」「书籍」 |
  | 搜索与目录 | 教材候选搜索（非主线）；内置 JSON 课程目录 catalogs | Tracker `api.md`；`api-contracts.md` §③「目录与任务」 |
  | 论文发现（领域 scope） | 探索**仅由领域发起**（recommend，recipe `frontier`\|`core`，202 任务）；selections 报告评审 → 显式 pick **落位可选领域或该领域下课程** → 书本化 `qt_books` kind=paper（标识=arXiv ID，复用书籍五层态）；物理落位维持 `_general/papers/`、课程=逻辑分组；**论文无默认桶**——落位 `domain_id` 必填且须为 `qed_domain` 已登记领域，缺失/不存在由 8901 拒绝、8900 原样透传（8900 不补默认值）；链路事实源 [downloads-flow §7](downloads-flow.md) | Tracker `api.md`；`api-contracts.md` §③「规划契约·论文面」 |
  | 后台任务 | 提交立即返回 `task_id`，轮询取状态与结果 | Tracker `api.md`；本节「写操作=后台任务」 |
  | 探索评估 | prompt-explores dry-run 同步、不落库 | Tracker `api.md` |

- 写操作（下载、论文推荐、扫描、Axiom 推送）一律创建**后台任务**：
  - `POST /tasks/...` 立即返回 `task_id`；`GET /tasks/{id}` 轮询状态与结果；
  - 状态机 `queued → running → succeeded / failed`；进度字段 0–100；
  - 任务记录落盘 `qt_tasks` 表（REQ-032，迁移 0016 建，替代 `meta/tasks/` JSON 文件）；
  - 同 sha256 已登记时直接 `succeeded` 并复用既有记录（幂等）。
- **退役判例**（惯例已升格为 §10 规则）：旧八态书籍端点随 QED-060 删除（`start/fail/verify/
  cancel` 以新下载生命周期语义保留）；`/selections`、`/downloads`、`/resources` 等三表端点随
  QED-030/031 退役（404 即已退役）；契约原文可自 Git 历史查阅（REQ-030/031 时期提交）。
- 该接口同时供统一 CLI（等待模式，直连 8901）与 8900 数据域适配层调用；8903 前端只经 8900 访问。

## 6. Axiom-Flow 服务接口契约（8902）

端点/字段级形状事实源：Axiom-Flow 仓库 `docs/architecture/api.md`；8900 对前端的适配面与
错误映射事实源：[api-contracts.md §④](../architecture/api-contracts.md)（含「规划契约」
即 8902 已实现而 8900 透传未排期的端点）；全链路设计与消费语义见
[parsing-flow.md](parsing-flow.md)。本节与 §5 同口径，只登记能力面与消费语义。

- **基本面对接**：前缀 `/api/v1`（端口 8902，8000 兼容见 §3）；`GET /api/v1/health` 存活检查
  （8900 托管探测 + 模型监督器均以探针判活，§9.2/§11）。
- **能力组一览**：

  | 能力组 | 消费语义要点 | 形状事实源 |
  | --- | --- | --- |
  | 书目登记与同步 | `af_books` 书目列表/详情（`file_path` 为数据根相对路径 + ingest/解析进度）；书目自 8901 verified 同步（book_id 同源 qt_books、幂等 upsert，由 8900 聚合驱动） | Axiom-Flow `api.md`；`api-contracts.md` §④ |
  | 入库与解析 | ingest＝渲染页图（元数据落 af_books，不调模型），**分钟级同步长请求**（超时分层见 §11）；解析任务 202 提交 + 轮询（`queued/running/completed/failed`，progress `{parsed,total,error}`）——解析本身已是后台任务范式 | Axiom-Flow `api.md`；`api-contracts.md` §④；parsing-flow.md §4 |
  | 产物与对照 | 页级 blocks/markdown/原页图读取；manifest 产物清单（路径/大小/哈希）；源 PDF 由 8900 本地端点从数据根取（不经 8902） | `api-contracts.md` §④；parsing-flow.md §5/§7 |
  | 人工编辑落库 | 块级编辑记录（EditRecord）与判定写入；8900 `/review` 门面为过渡兼容，新消费面一律走 edit 契约 | `api-contracts.md` §④ |
  | 知识点梳理工作区（**2026-10-21 定档，尚未落地**） | 梳理段正本整体归 8902：工作区与候选池＝单表 `af_kp`（层级 `parent_id`、关系 `links` JSON、机器位 `gen_status`／人工位 `confirmed` 分列、批次 `gen_batch`、长文只留 `narrative_ref` 指针）。根侧消费面**只有两件事**＝经 8900 透传读其**只读导出端点**（命名与形状归对方）＋把 `confirmed=1` 的行单向提升进共享 `qed_knowledge_point`（幂等锚＝主表标量列 `from_detail_id` 存 `node_id`）；**提升时的列映射（2026-10-21 v1.0 定档）**＝对方别名列表 → 主表 `aliases`、对方多角度叙述 → 主表 `angles`（`angle` 闭集复用根侧既有六词 `summary`／`explanation`／`definition`／`theorem`／`proof`／`example`，对方若给闭集外词即拒收并记偏差，不静默改写）、对方长文指针 → 主表 `narrative_ref`；**两侧指针形态刻意不同**＝对方存 `<book_dir>/kp/<node_id>.md` 的**单段文件名**（其 KA-20），根侧存**数据根相对路径全串**，提升腿负责补前缀，理由是 8900 须在 8902 离线时自行解析该指针（独立性铁律）；8902 **不直写共享表**、**不回写提升结果**，根侧**不直写 `af_*`**；AF 离线时学习与练习三链照常（独立性铁律，只梳理屏不可用） | Axiom-Flow [PLAN-024](../../Axiom-Flow/docs/history/plans/2026-10/2026-10-21-af-table-family-rebuild.md)（逐列与提升通路正本）；根侧承接面 [REQ-134](../history/plans/2026-10/2026-10-21-af-table-architecture-design.md)（已退指针）与 [REQ-132 壳 W5](../history/plans/2026-10/2026-10-21-qe-family-rename-and-refactor.md) |
  | 预留面 | 版本列表/回滚、chunks（RAG 切片预留）、书目 PATCH/DELETE——8902 侧已实现，8900 透传与前端消费未排期 | `api-contracts.md` §④「规划契约」 |

- **梳理批次的 `stage` 三值与读面派生区间（2026-10-29，8902 已实现、8900 零改码转发）**：`stage∈{full, outline, content}`
  三值闭集归 8902（其 `KA-34`）；`content`＝拿在册目录只补知识点（不重跑目录腿）、同批为被处理节写目录行
  `summary`，**该书零在册目录行时 422 点名「先解析目录」**，页区间按「在册目录行的起点页落在区间内」筛选，
  锚仍在目录页的行整节跳过并进 `result.unlocated_outline_entries`（其 `KA-43`）；整册工作区与导出面逐行带
  派生 `page_start`／`page_end`（其 `KA-42`，目录行＝到下一枚目录行起点前 −1 页）。根侧消费＝梳理屏直接吃两键
  与三值，8900 只搬字节；两侧零 DDL、零新端点。
- **基本版本的四值类型与树序区间（2026-10-30 需求方第十令及其二次令文，8902 实现、8900 零改码）**：① 读面新增
  一枚派生键 `node_type∈{chapter, point, exercise, other}`（只读派生、零 DDL，判序＝`toc_kind='exercise'` 或祖先为
  习题 ⇒ `exercise`；`toc_role='reference'` 其余 ⇒ `other`；`knowledge` 且 `depth=1` ⇒ `chapter`；`depth≥2` ⇒ `point`），
  屏侧详情标签自此读它而不再按 `node_kind` 一律写「章节」；② 派生 `page_start`／`page_end` 的推法由「下一条行起点 −1」
  改为**树序判**（本行止于下一条**同级或更浅**行的起点 −1，无则到全书末页），`toc_role='reference'` 的行不参与拼接
  （只发起点＝终点，不精确处披露）——现网章行只切单页（b05「第1章」曾给 9-9，应为 9-28）、reference 行拼出
  5-310 一类巨区间，均属该推法的缺陷；③ `stage='content'` 的产出形状按基本版本收窄＝只写节级 `summary`、**不再建
  `node_kind='point'` 行**（存量点行已由需求方签认删除 213 条，备份留根仓 `tmp/kp-run/`），章级总结改为「章基本介绍＋
  其下各节总结」一次调用并同时产出章导读，写腿仍走既有 `summary` 列与 `narrative` 写腿。两侧零新端点、零 DDL。


- **上下游**：上游 8901 `axiom push` 交接（§3 对接点）；解析经引擎适配器**直连本地模型服务**，
  不经 8900 网关（[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)）；
  8900 只管模型生命周期与探针。
- 消费方提示：8902 离线时 8900 数据域按 §11 返回上游不可用语义，解析树降级为领域→课程
  （parsing-flow.md §9）。

## 7. 8903 前端对接

8903 前端（`web-ui/`）的组成、信息架构、交互、视觉与响应式契约见[前端架构](../architecture/frontend-architecture.md)；
本文件只记录其对接要点：**前端只连 8900**（ADR 0007，QED-Engine 后端网关化）——配置域
（横幅/健康）、数据域（目录/资源/任务）、服务域（/services 服务状态）全部经 8900 获取，
浏览器不直连 8901/8902；子项目 CORS 收窄为可选后续。8900 的接口族与角色
见[配置中心 API 契约](../architecture/api-contracts.md)。

## 8. 独立性约定

独立性铁律见[四服务架构与边界](../architecture/four-service-architecture.md)（唯一事实源）。
契约特有补充：QED-Engine 后端离线时，Axiom-Flow 与 QED-Tracker 用本地默认配置降级运行；
无根 `.env` 时使用内置最小默认值并输出提醒。跨项目传递只通过：HTTP 接口、共享 dataset 目录、
环境变量与表隔离的共享 qed 库（见[统一配置与密钥规范](project-configuration.md)）。
铁律的**双态验收语言**（单项目独立可运行 + 合并联调可运行）见 §9 运行与验证矩阵。

## 9. 运行与验证矩阵（双态验收基准）

用户裁决（2026-09-24）：契约文档以两条基准验收——**每个项目单独能跑起来；合并运行也能
跑起来**。本节即两条基准的可执行判据。

### 9.1 单项目独立运行态

| 服务 | 必需依赖 | 其余项目缺席时的可用性 |
| --- | --- | --- |
| 8901 QED-Tracker | MySQL（`QED_DB_*`）+ 根 `.env` | 发现/下载/校验/登记与后台任务全功能独立可用；`axiom push` 对端离线按任务失败记录，不影响登记 |
| 8902 Axiom-Flow | MySQL + 本地模型服务（MinerU 等，引擎适配器直连） | 接收 push 与 ingest 独立可用；不依赖 8900/8901 进程 |
| 8900 后端 | MySQL | 控制域（配置/托管/监控/LLM 网关）正常；数据域按 §11 返回上游不可用语义；8903 对话/展示正常 |
| 8903 前端 | 静态托管（serve_web.py）+ 8900 | 8900 离线时页面仍可加载，请求按 offline 类错误降级展示（不白屏）；8901/8902 全离线时管理页照常可用 |

### 9.2 合并运行态

- **配置注入**：8900 → 子项目地址由根 `.env` 的 `QED_TRACKER_URL` / `QED_AXIOM_URL`
  注入（默认 `http://127.0.0.1:8901` / `:8902`，事实源 `backend/qed_engine/config.py`）；
  子项目直读同一 `.env`（§3 冻结口径）。
- **就绪判据**：各服务 `GET /api/v1/health`；8900 `/services` 与仪表盘徽章判活为
  socket 预检 + HTTP 200 双重探测（实现 `services/service_manager.py`，设计
  [service-hosting.md](service-hosting.md)）。
- **启动顺序建议**：MySQL → 8901 / 8902（无序）→ 8900 → 8903。
- **主链端到端验收清单**（每步判据通过即合并态成立）：

  | # | 链路 | 判据 |
  | --- | --- | --- |
  | 1 | 发现与下载（8901） | 取书任务 `succeeded`，PDF 落 `dataset/raw/<domain_id>/…` 且 qt_books 登记 |
  | 2 | 交接与同步（8901→8902→8900） | `axiom push` 被 8902 接受；8900 书目同步落 `af_books`（book_id 同源） |
  | 3 | 入库与解析（8902） | ingest 完成 + 解析任务 `completed`，产物落 `parsed/<domain_id>/<course_id>/<book_id>/`（版本布局见 [dataset-conventions.md](dataset-conventions.md)） |
  | 4 | 消费（8903→8900→8902） | 解析管理视图可见产物块与原始 PDF 对照，块级判定可提交 |
  | 5 | 降级回归 | 关停 8901/8902：8903 徽章离线、管理页可用；数据域请求返回 §11 映射语义 |

  链路语义细节分别见 [downloads-flow.md](downloads-flow.md) 与 [parsing-flow.md](parsing-flow.md)。

## 10. 契约演进规则

跨项目接口的改动按**兼容性二分**定级（升级自散点判例：QED-060 旧八态端点删除、
QED-030/031 三表端点退役）：

| 变更类型 | 判据 | 流程 |
| --- | --- | --- |
| 兼容变更 | 新增可选字段；新增只读端点；新增带默认行为的查询参数；错误信息文案变化 | 提供方仓库自行发布；需求方在根仓库 todo 记一笔；§5/§6 能力面与本文件消费语义描述、消费方测试随下一轮对齐，不同窗发布 |
| 破坏性变更 | 删除/改名端点或字段；改变字段语义或状态机；端口、路径前缀、`.env` 变量语义变化；dataset 布局变化；`qed_*` 共享表 schema 变化 | **先 ADR** + [跨项目协作规范](../standards/cross-project-collaboration.md)请求流程（双仓 todo + 对方 plans/ 讨论文档）+ **双方同窗发布**（消费方适配未就绪前不声明收口）；共享表 schema 另按 §4 所有权方迁移先行 |

- **退役处置惯例**：旧端点确认后**直接删除**，消费方收到透传 404 即视为已退役；不设
  410 / sunset 头 / 双写过渡期——如未来需要过渡机制，立 ADR 改变本惯例。
- **版本前缀**：`/api/v1` 为三项目唯一在用版本；升 `/v2` 需 ADR，在此之前破坏性变更
  只走上表流程。
- **对齐责任**：消费方契约测试与 §5/§6 能力面更新归需求落地同轮（根侧即
  `tests/test_tracker_client.py`、`tests/test_api.py`）；对接点级变化（协议、地址、字段、
  端口）另按 §12 维护规则先更新四服务架构文档与本文件。

## 11. 错误、超时与离线透传

- **8900 数据域映射规则**（实现事实源 `backend/qed_engine/api/tracker.py`、`api/axiom.py`；
  契约登记见 `api-contracts.md` §③/§④ 错误映射节）：
  - 下游返回 4xx → 状态码与 detail 原样透传（前端可区分 404/409/422 语义）；
  - 下游 5xx、连接失败、超时 → 统一 **503**（上游不可达提示文案区分服务名）；
  - 8901 未实现路由（404/405 带默认特征文案）走本地降级分支处理；
  - 8900 自身统一错误码表见 [api-contracts.md](../architecture/api-contracts.md)（唯一事实源，本处不复制）。
- **前端表现**：`web-ui/src/api/client.ts` 将错误分 timeout / offline / http 三类，
  503/409 明确提示，离线降级不白屏（ADR 0007 独立性的界面承接）。
- **超时预算现状**（消费语义登记；分层新数值属启停异步化/超时分层裁决线，本轮不定）：

  | 调用面 | 预算 | 出处 |
  | --- | --- | --- |
  | 8900→8901/8902 常规请求 | 30s | `clients/` 默认 |
  | 8903→8900 与 8900→8902 ingest | 300s（分钟级书页图渲染） | `api-contracts.md` §④、`clients/axiom_client.py` |
  | CLI/8900 等待 8901 后台任务 | 120s 上限 + 1s 轮询 | `tracker_client.wait_task` |
  | 8900 监督器探测 8902 | 5s | `services/llm/supervisor.py` |

- **异步范式统一声明**：两子项目写操作**均以异步任务 + 轮询为主范式**——8901 全部写操作
  走后台任务（§5）；8902 解析走 ParseJob 提交 + 轮询（§6）。唯一例外是 8902 ingest 为分钟级
  同步长请求（渲染页图，300s 预算），是否收敛为后台任务属后轮候选，本轮不预设。

## 12. 已知约束与维护规则

- **部署与安全假设**：全部服务仅监听 `127.0.0.1` 回环，服务间无认证；**不得暴露公网**。
  子项目直读根 `.env` 的信任边界是同机用户（凭据规则见
  [project-configuration.md](project-configuration.md)）。若未来需跨机/远程部署，先立
  ADR（认证与传输安全），本假设随之废止。
- 对接点变更（协议、地址、字段、端口）必须先更新
  [四服务架构与边界](../architecture/four-service-architecture.md) 与本文件，并登记 ADR
  （操作细则见 §10）。
- 验证子项目对接时，以各自 README 与测试门禁为准。
