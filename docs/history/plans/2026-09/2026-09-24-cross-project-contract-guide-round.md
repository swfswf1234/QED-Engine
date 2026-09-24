# 跨项目契约总指引轮滚动记录（运行矩阵·契约演进·错误透传·归属指引）（cross-project-contract-guide-round）

状态：Completed
任务类型：B
最后更新：2026-09-24
关联 ADR：无新增（登记方式沿用 [ADR 0016](../../../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳；文档骨架与事实源唯一铁律沿用 [ADR 0017](../../../adr/0017-design-doc-structure-contract.md)）
关联设计：[cross-project-contracts.md](../../../design/cross-project-contracts.md)（W1~W4 主改造对象）、
[四服务架构与边界](../../../architecture/four-service-architecture.md)（W5~W6 承接位）、
[api-contracts.md](../../../architecture/api-contracts.md)（错误码表指针）、
[跨项目协作规范](../../../standards/cross-project-collaboration.md)（契约级变更流程上游约定）
关联 Tracker：docs/trackers/todo.md（ARCH-030 任务行，一任务一行一壳）
归档判定：Retain（轮次收口时按当时里程碑归档 history/plans/<year-month>/）

> 本壳是跨项目契约总指引轮唯一滚动记录。纯根仓库文档轮：不动任何代码、不向子项目仓库发代码
> 请求；8901 端点详表保持现状（用户裁决 2026-09-24：不追求契约章节对称，收敛/搬迁另议后轮）。

## 目标与成功标准

**背景**（2026-09-24 梳理轮 + 用户裁决）：对照高星多服务项目实践（契约演进政策、错误包络、
消费方契约、"where does it go" 决策表）盘出两文档 9 项缺口；用户裁决方向：**契约对称性不做**，
根仓库两文档改承担「总指引」角色，验收基准 = **单项目独立可运行 + 合并联调可运行**；
改动范围（运行矩阵/契约演进/错误透传/安全假设/归属判定表）经多选问答批准立项。

**目标**：两文档补齐总指引层——读者不查子仓库即可回答「这个改动进哪个仓库、契约怎么改算合规、
单独/合并各要什么才能跑起来、下游挂了上面什么表现」。

**成功标准**：

| # | 标准 | 判据 |
| --- | --- | --- |
| S1 | cross-project-contracts.md 新增运行矩阵（双态）、契约演进规则、错误与离线透传、部署与安全假设内容，且正文按 ADR 0017 骨架统一阿拉伯编号（补缺+统一编号，设计本体不重排） | 文档 diff 审阅 + 骨架五要素齐备自查 |
| S2 | four-service-architecture.md 新增改动归属判定表与双态运行验收小节（细节指针指向 cross-project-contracts，不复制正文） | 文档 diff 审阅 |
| S3 | 新节陈述的都是消费语义与规则，不新增端点表/DDL/字段级契约复制（事实源唯一铁律）；运行矩阵与超时预算与 `clients/` 代码实况一致（30s/300s/120s） | 逐节自查 + grep 代码核对 |
| S4 | 根契约门禁全绿（并行会话红项按基线归因） | `tests/contract/` 全量 + QED_env 3.12 解释器输出 |

## 范围与非目标

- **范围**：`docs/design/cross-project-contracts.md`、`docs/architecture/four-service-architecture.md`
  两份文档 + 本壳 + todo 行 + plans/index.md 登记；超时分层新数值**不**在本轮定（挂 F1-F4 待批复，
  本轮只如实登记现状）。
- **非目标**：补 8902 对称契约节（~~原裁决 2026-09-24 上午~~ **已被 W8 修订裁决取代**：8902 能力面
  须同步登记）；任何代码改动；子项目仓库文档改动；新 ADR（本轮是既有人工裁决的成文，不改
  standards/ 强制规则——若收口时发现演进规则需升级为 standards/，另立任务）。
- ~~8901 详表收敛或删除（用户裁决保持现状）~~ → W8 裁决（2026-09-24 收口评审时）：端点详表收回
  QED-Tracker 仓库，本文件只留能力面。

## 前置条件

- 用户批准立项与范围（2026-09-24 多选问答「立项并实施」）；
- 9 项缺口梳理结论与 4 项裁决（对称不做 / 双态为基准 / 详表留现状 / 总指引定位）已在会话留痕。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | cross-project-contracts.md：新增「运行与验证矩阵（双态）」节——单跑依赖与降级四行表 + 合并运行主链验收清单（下载→push→解析→前端对照）+ 地址注入变量与就绪判据指针 | 已实施（W8 后为 §9 含 9.1/9.2） |
| W2 | 新增「契约演进规则」节——兼容/破坏二分、各自流程与双方同窗发布、旧端点 404 判例升格为惯例 | 已实施（W8 后为 §10） |
| W3 | 新增「错误、超时与离线透传」节——8900 数据域对下游非 2xx/离线/超时的映射语义（引用 api-contracts.md 错误码表）+ 超时预算现状登记（30s/300s/120s，标注 F1-F4 待批复）+ 8901 后台任务异步范式 vs 8902 长同步 ingest 的范式差异声明 | 已实施（W8 后为 §11，映射与预算逐条对照 `api/tracker.py` `_call`、`api/axiom.py` `_call`、`clients/`、`supervisor.py` 核实） |
| W4 | 新增「已知约束与维护规则」置尾节（并入原「执行与验证」）+ 部署与安全假设（localhost 回环、无认证、不得暴露公网）+ 统一数据库节内补 qed_* schema 变更顺序（所有权方迁移先行 + 请求流程通知消费方） | 已实施（W8 后为 §12 与 §4 末段） |
| W5 | cross-project-contracts.md 全篇骨架对齐 ADR 0017：节名映射 §1 定位与目标 / §2 范围与非目标 / §3..N 设计本体 / 状态与降级（运行矩阵承担）/ 已知约束置尾，阿拉伯编号 | 已实施（§1~§12，W8 重编号） |
| W6 | four-service-architecture.md：新增「改动归属判定表」节 + 「跨服务交互」末尾补双态运行验收小节（指针承载） | 已实施（归属表在「服务职责与端口」后；双态指针在跨服务交互末） |
| W7 | 门禁与台账：`tests/contract/` 全量（QED_env 3.12）、todo/plans-index 同步、project-status 与 code-map 若受影响则同步；qed-closeout 收口 | 已完成首轮（门禁输出见下；关闭动作被 W8 驳回中止） |
| W8 | **收口评审修订（用户 2026-09-24 驳回首轮收口）**：① §5 8901 端点详表收回 QED-Tracker 仓库，改能力组表 + 形状事实源指针（Tracker `api.md` / `api-contracts.md` §③）；② 新增 §6 8902 能力面契约（书目同步/入库解析/产物对照/人工编辑/预留面，指针 §④/parsing-flow）；③ 全文 §1~§12 重编号并同步 four-service 与设计索引引用；④ 「分工铁律」写入 §1（根仓管总指引全链路，子仓管细节）；⑤ §11 异步范式改「统一为任务+轮询，仅 ingest 同步例外」；⑥ four-service「服务职责与端口」以用户手改版为准不再动 | 已实施（门禁复跑见下） |

## 门禁输出（2026-09-24）

- `tests/contract`：**57 passed / 6 failed**——6 红逐条归因均为并行会话 WIP，非本轮：
  code-document_mapping ×2 与 suite_governance ×1（ARCH-028 `test_llm_supervisor.py` 未登记 code-map）、
  plan_governance ×2 与 tracker_governance mirror ×1（REQ-033 壳缺章节 / 索引直链 / 状态「进行中≠In Progress」）；
  本轮自有登记项（ARCH-030 行↔壳镜像、元数据、链接）全绿。
- 全量 pytest（除 tests/contract）：**432 passed**；`tests/test_monitor.py` 排除——并行 WIP
  语法错误（line 502 unterminated string），非本轮文件。
- ruff：22 错全部落并行 WIP 文件（test_monitor.py×20、axiom.py×1、diag_watch_b05.py×1），本轮纯文档零代码改动。
- **W8 复跑（同日晚）**：契约 57 passed / 6 failed——红项归因与首轮逐条一致（REQ-033×3、ARCH-028×3），
  无 W8 新引入失败；节引用 §3~§12 与标题序列 1~12 校验通过；全量 pytest 首轮 432 passed 覆盖本轮（纯文档改动）。
- S3 核对：超时预算表逐值对照 `clients/tracker_client.py`（30s/120s）、`clients/axiom_client.py`
  （300s ingest）、`services/llm/supervisor.py`（5s）；错误映射对照 `api/tracker.py:112-115`、
  `api/axiom.py:63-73`（4xx 透传、其余 503）。

## 验证与验收

- `D:/software/anaconda3/envs/QED_env/python.exe -m pytest tests/contract -q` 全量输出；
- S3 核对：`rg timeout backend/qed_engine/clients` 与文档现状表一致；
- 链接完整性由 `test_markdown_links.py` 守护（门禁内含）。

## 回滚

纯文档轮：`git revert` 本任务提交即可，无数据/代码副作用。

## 关闭与归档

- 关闭条件：W1~W7 完成 + S1~S4 判据证据入本壳；
- 归档判定：Retain（滚动记录）；收口时总指引轮如无后续滚动需求，按 doc-governance 归档规则处理。
- **2026-09-24 关闭中止**：收口审阅时用户驳回（§5 端点表应改指 API 文档、8902 契约缺失须补、四服务职责表已由用户手改），
  转 W8 修订轮，壳自 history 移回 plans 继续滚动。
- **2026-09-24 关闭完成**：W8 修订落地并经用户确认「按原有方案走」；S1~S4 全达成（首轮门禁 +
  W8 复跑无新红）；壳按归档判定 Retain 移 `history/plans/2026-09/`，ARCH-030 任务行移入 completed.md。
