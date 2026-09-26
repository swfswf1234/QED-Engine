# 存储链路规范化轮（storage-chain-governance-round）

状态：Completed
任务类型：B
最后更新：2026-09-26
关联 ADR：`../adr/0018-data-root-whitelist-and-meta-json-ban.md`（数据根顶层白名单与元数据 JSON 岛禁止）
关联设计：`docs/design/dataset-conventions.md`（白名单节与 tmp 实况修订）、`docs/standards/storage-conventions.md`（规则升格正文落点）
关联 Tracker：docs/trackers/todo.md ARCH-032 行（支线 REQ-091~096 同节登记，doctor 行 09-24 改号 REQ-090→REQ-096 见其 todo 行）
归档判定：Retain（含 ADR 0018 立档、标准与设计规则变更、守护测试增量与全链路事实勘察证据）

## 目标与成功标准

对照高星项目惯例（paperless-ngx：DB 事实源 + 文件纯追加；HF Hub：目录骨架程序精确声明 +
指针快照；restic：盘↔库对账），把「探索→下载→解析→学习」存储链路收口为**骨架可枚举、
元数据不 spill、重复有机制、缺口有台账**的形态。勘察基线（2026-09-24 双 Explore + 磁盘
实证）：页图硬链接版本去重已实装（根视图+3 版本同 inode）；生效版切换 = `active_job_id`
指针 UPDATE 零磁盘写；产物图片/正文不进 DB；下载 sha256 内容级幂等——以上为**已有优点**，
本轮不重做。

- S1：dataset-conventions.md 与实况零虚构——`tmp/axiom-flow/<job-id>/` 虚构约定删除、
  「当前版视图」改 `active_job_id` 指针语义、顶层白名单节（哨兵区）建立；
- S2：ADR 0018 立档 + storage-conventions.md 三条规则升格（白名单登记制 / 元数据 JSON 岛
  禁止 / tmp 语义收口含用户资产禁令）；
- S3：`tests/contract/test_storage_conventions_governance.py` 新守护：白名单哨兵区与标准
  一致、虚构约定不复活、JSON 岛规则关键词在标准正文；
- S4：台账完备——REQ-096（对账 doctor，前瞻不进设计；原登 REQ-090 撞 learning/ 退役历史号，09-24 改号）、REQ-091（探索会话持久化）、
  REQ-092（账本保留期）、REQ-093（请求：QED-Tracker meta 岛退役等三项）、REQ-094
  （D 类清理候选三处）、REQ-095（请求：Axiom-Flow ADR 0018 承接确认包）登记齐；全量门禁绿（并行 WIP 红逐条归因豁免）。

## 范围与非目标

- 范围：`docs/design/dataset-conventions.md`、`docs/standards/storage-conventions.md`、
  `docs/adr/0018-*` 与 `docs/adr/index.md`、`tests/contract/test_storage_conventions_governance.py`、
  根 todo 台账、QED-Tracker 侧请求条目与讨论计划（仅文档，遵守跨项目工作区边界）。
- 非目标：不实现对账 doctor 工具与设计节（用户裁决：前瞻 REQ，本轮不进设计）；不改任何
  子项目代码（meta JSON 岛退役走 REQ-093 请求）；不动真实数据根任何文件（清理候选仅
  登记，D 类操作待用户发令）；不重做学习进度表设计（归学习设计轮）。

## 前置条件

- 全链路勘察证据（本壳「勘察证据」节，含代码 file:line 与磁盘实测）；
- ADR 0018 先行（standards 实质规则变更门槛）；
- 并行 WIP 基线：ARCH-031 未收口红项不归本轮。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | ADR 0018 立档 + adr/index 登记（白名单登记制 / JSON 岛禁止 / tmp 语义收口 / 虚构约定删除四点决定与替代方案排除） | 已实施 |
| W2 | dataset-conventions.md 实况修订：顶层白名单哨兵节（raw/tmp/parsed/backups，backups 例外区命名与台账规则）；tmp 树删虚构 `axiom-flow/<job-id>` 改瞬态实况描述；「当前版视图」改 `active_job_id` 指针选版语义；插图 `pages/images/` 地位注记（落盘契约有、服务端点与渲染消费链待定）；强制规则补白名单/JSON 岛/tmp 用户资产禁令 | 已实施 |
| W3 | storage-conventions.md 规则升格：数据根节补白名单登记制与 JSON 岛禁止（两类例外）；tmp 生命周期节补「解析中间产物不入 tmp」与用户资产例外唯一性；依据 ADR 补 0018；standards/index.md 镜像同步 | 已实施 |
| W4 | 守护测试增量（同文件）：白名单哨兵区解析与标准一致断言、`tmp/axiom-flow` 不复活断言、标准含白名单/JSON 岛规则关键词断言 | 已实施（7 passed，含新 3 守护） |
| W5 | 根 todo：本轮节（ARCH-032 + 支线 REQ-091~096）登记 | 已实施 |
| W6 | 跨项目请求承接面：QED-Tracker todo 请求条目（QED-071）+ `docs/plans/2026-09-24-storage-json-island-retirement-request.md` 讨论计划（接口/契约级登记格式，只写文档不碰代码与 git） | 已实施（09-24 补强：R1 增四处 Tracker 文档 JSON 岛口径证据 + `test_documentation.py` 白名单同步为承接第一步提示） |
| W7 | 门禁（tests/contract + 全量 pytest + ruff，并行红归因）+ 收口（qed-closeout） | 门禁绿；收口待用户审阅 |
| W8 | 两端同步（用户 09-24 令「按照规范同步给 QED-Tracker 端和 axiom-flow 端」）：Axiom-Flow 入站承接确认包（REQ-095：A1~A4 零代码确认 + A5 插图去重观察预留；该仓 PP-6「不写 tmp 即合规」早于根侧改判，为正确方）+ 该仓 todo REQ-095 行与讨论稿；根 todo 增 REQ-095 行、REQ-093 证据更新 | 已实施 |

## 门禁输出（2026-09-24）

- `tests/contract`：**68 passed**（含本轮新增 3 守护：白名单哨兵一致 / ADR 0018 规则在标准 /
  虚构约定不复活）。
- 全量 pytest（除 contract）：**483 passed / 0 failed**——上一基线唯一红
  `test_web.py::test_dashboard_course_completion_semantics`（并行 REQ-033）已被其会话修复转绿。
- ruff：本轮触碰测试文件单独全过；全仓 3 红全部归并行 WIP
  （`api/axiom.py` B008、`services/llm/supervisor.py` F722 归 ARCH-028；
  `scripts/diag_watch_b05.py` F401 为并行诊断脚本遗留），非本轮文件。
- 治理对象镜像：`standards/index.md` 行与标准头字段同步（`test_standard_governance` 绿）。
- 边界自证：QED-Tracker 工作区仅新增/修改 2 个文档（todo 行 + 讨论稿），零代码改动、零 git；
  真实数据根零写入（勘察全程只读）。

## 勘察证据（2026-09-24，代码 file:line）

- 页图硬链接去重：`Axiom-Flow/src/axiom_flow/ingest/artifacts.py:72-117`（link_pages_into /
  seed_version_from，失败回落 copy2 有 warning）；磁盘实测 `parsed/linear_algebra/
  linearalgebra-b01/` 根视图与 3 版本 p0001.png 同 inode nlink=4；
- 指针选版：`Axiom-Flow/src/axiom_flow/db/repositories.py:195-203`（set_active_job 单列
  UPDATE）、`api/main.py:194-212`（_read_scope）；`af_parse_jobs` 刻意不存布尔生效列；
- 内容不入 DB：af_* 迁移零 BLOB/大 TEXT（`migrations/versions/20260917_0001` 等）；8902
  页图 FileResponse 直读盘（`api/main.py:442-449`）；8900 代理内存中转不落库
  （`clients/axiom_client.py:75-91`）；
- 下载幂等：`QED-Tracker/src/qed_tracker/application/resources.py:104-117`（sha256 命中
  复用 + staging os.replace 移动）；
- JSON 岛僵尸：`QED-Tracker/src/qed_tracker/inventory.py:42-46,123-128,209-214`；磁盘现无
  `qed-tracker/meta/`（arch020f 备份后删），register 触发即重建；
- 虚构约定：全仓无 `tmp/axiom-flow` 写入代码，磁盘无该目录；
- 野生区与残留（磁盘实证）：顶层 `backups/2026-09-{20,23}-arch020f`；`parsed/probe/
  d3-20260922`；`tmp/qed-tracker/downloads/*.download` staging 残留 1 个；`tmp/参考书籍/`；
- **全链路复扫新发现（09-24 第二遍，用户裁决 A1 落地）**：PDF 内容哈希事实断层——
  `qt_books` 无 sha256/size 列（`QED-Tracker/docs/architecture/database-private-tables.md:434`
  无哈希列自证），完整性校验 `inventory.verify`（`inventory.py:182-196`）读岛侧 meta JSON ⇒
  REQ-093 R1 补「先迁列、后拆岛」时序约束（①迁移补内容身份列 ②双源回填对账 ③读写切 DB
  ④删 meta 写入），讨论稿 R1、对方 QED-071 行、根 todo REQ-093 行三处已同步；
  `af_parse_jobs.source_sha256` 为哈希列先例；af_* 失败版本目录保留不删（无清理代码，
  与账本保留期一并候补裁决）。
- DB 缺口：探索会话纯内存（`backend/qed_engine/services/explore_sessions.py:40`，课程失败
  error 无列落库不对称 `shared_tables.py:306-309`）；`qt_books` 无下载错误列/起止时间戳
  （`fail_download` 只置状态）；`qed_llm_calls`/`qt_tasks`/`qt_selections`/`af_parse_jobs`
  只增不删无保留期；
- file_path 三处双写：`qt_books.file_path` / `af_books.file_path` / `book.json.source_file`
  （sha256 自证缓解，无对账机制 → REQ-096）。

## 验证与验收

- S1/S2：白名单哨兵区存在、`rg tmp/axiom-flow docs/design` 命中 = 0、两文档含 ADR 0018
  引用（由 W4 守护测试绿自证）；
- S3：`test_storage_conventions_governance.py` 全绿；
- S4：todo 新增 6 行经镜像/治理契约校验绿；Tracker 侧仅文档改动（todo + plans 讨论稿），
  其仓库门禁由对方承接时执行（本轮只跑根仓库门禁并声明边界）。

## 回滚

纯文档 + 测试轮：`git revert` 本任务提交即可；ADR 0018 可被后续 ADR 取代或按用户裁决
回退；REQ-091~096 台账行随壳关闭一并处置；无数据副作用（真实数据根零写入）。

## 关闭与归档

- 关闭条件：W1~W7 完成 + S1~S4 证据入本壳；
- 归档判定：Retain（收口时移 `history/plans/2026-09/`）。
