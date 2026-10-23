# 运行时产物与备份面规范化（logs/tmp/scripts/backups 落点收口）（runtime-artifact-placement-round）

状态：Completed
关闭结果：Achieved
任务类型：B
最后更新：2026-10-17
关联 ADR：[ADR 0019](../../../adr/0019-runtime-artifact-placement-and-no-long-term-backups.md)（本轮立项依据，
补充 [ADR 0018](../../../adr/0018-data-root-whitelist-and-meta-json-ban.md) 第 1 条的 `backups/` 例外区语义）
关联设计：[service-hosting.md](../../../design/service-hosting.md)（托管单元日志落点与 `scripts/` 边界）、
[api-contracts.md](../../../architecture/api-contracts.md)（`/logs/{service}` 与 `/services` 的 `log_path`）、
[运维指南](../../../guides/operations.md)（日志表与快照去向）
关联 Tracker：docs/trackers/todo.md（ARCH-036 任务行，一任务一行一壳）
归档判定：Retain（治理批次留 ADR/标准/清理证据，收口时移 `history/plans/2026-09/`）

> 本壳是 ARCH-036 唯一执行记录。用户发令四点（日志混乱需定长期清单 / 日志只写 `logs/` 与
> `tmp/` / `scripts/` 只留必要面 / `backups/` 是否备份处、是则可清）经四项裁决定型：长期日志
> 口径＝**只留 8900 面 + 本轮一并修缺陷**，清理去向＝**全部直接删除**，备份面＝**三处全清**，
> 落档形态＝**标准补节 + ADR + 任务行/壳**。规则正文落 `standards/storage-conventions.md`
> 「仓库根运行时产物与备份面」节，本壳只承载执行与证据。

## 目标与成功标准

**背景**：`logs/` 四代命名并存 19 个遗留文件、一次性诊断脚本把日志写进 `scripts/`、控制台
「查看日志」读到停更文件、备份三处并存且无退役规则。仓库根运行面从来没有落点声明。

**目标**：仓库根运行时产物**落点可判定、长期清单正向声明、日志视图与实况一致、仓库内不设备份位**。

**成功标准**：正本在台账行 [todo.md](../../../trackers/todo.md)「普通任务轮（ARCH-035）」节的
ARCH-036 行 `成功标准` 列（S1 治理落档／S2 契约守护先红后绿／S3 日志读取按实际写入点／
S4 存量清理／S5 文档同步／S6 数据根快照与 8900 重启两项人工步骤），本壳不复制判据条目
（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)）。各判据的验收手段见
「验证与验收」节，执行过程与取证见「过程与证据」节。

## 范围与非目标

- 范围：根仓库运行面（`logs/`、`tmp/`、`scripts/`、根 `backups/`、`backend/database/`）+ 8900
  日志读取代码（`services/service_manager.py`、`services/log_viewer.py`）+ 相关 docs。
- 范围外：日志轮转与大小上限（`config.log` 2.2M / `qed-engine-serve.log` 1.5M 现状无上限）
  ——本壳只登记为待裁决项 W7，不实施；子项目仓库内日志治理归各自仓库（本轮只在根侧停止
  镜像与猜测路径）；数据根 `dataset/` 三区与白名单规则不变（ADR 0018）。
- 删除动作全部属用户已发令范围，仍逐批列出清单经确认后执行（写操作纪律）。

## 前置条件

- QED_env 解释器跑门禁（`D:/software/anaconda3/envs/QED_env/python.exe`）。
- 8900 服务不热重载：W2 代码改动后需经控制面重启才生效，浏览器/真机复核留待收口窗口。
- `dataset/backups/` 删除属数据根写操作（权限层拦截 `dataset/**`），需用户逐次批准。

## 工作项

| 条目 | 类别 | 内容（根因一句话 + 落点） | 状态与证据 |
| --- | --- | --- | --- |
| W1 | 治理落档（ADR + standards + 契约守护） | 现象＝仓库根运行面无落点声明；根因＝storage-conventions 只治理数据根三区。落点＝新增 [ADR 0019](../../../adr/0019-runtime-artifact-placement-and-no-long-term-backups.md) + 标准「仓库根运行时产物与备份面」节（含 `long-term-runtime-artifacts` 哨兵区）+ `adr/index.md` 行 + `tests/contract/test_storage_conventions_governance.py` 四枚守护 | 已完成（2026-09-29）：**先红后绿取证**——红态样本为 `scripts/diag_watch_b05*.log` 散落 + 根 `backups/` 未退役（W3/W4 清理前）；另三枚治理红各自修正（ADR `取代` 字段内链被解析为取代关系、壳 `任务类型` 须裸字母、标准正文治理对象与 `standards/index.md` 单元格须等值）。现况 `tests/contract` **77 passed**、根全量 **624 passed**、`ruff check` 全绿 |
| W2 / DEFECT-007 | 缺陷（TDD） | 8900 按 `logs/<log_name>.log` 猜测日志路径（`log_viewer.py:30`、`service_manager.py:204`），而 tracker/axiom/web 三单元启停早已改走生命周期脚本（REQ-039）实写 `qed-*-serve.log`（8903 在根 `logs/`、8901/8902 在**各自仓库** `logs/`），致控制台/仪表盘「查看日志」读到停更文件（`tracker.log` 2026-08-16、`axiom.log` 2026-08-12）或不存在文件（`web.log`） | 已完成（2026-09-29）：先写红用例（断言四单元路径＝实际写入点）后实现 `service_manager.unit_log_path(spec)`（脚本托管→`<workdir>/logs/qed-<name>-serve.log`，否则 `LOG_DIR/<log_name>.log`），`log_viewer._log_path` 与 `service_status().log_path` 与非脚本 spawn writer 三处调用点统一改经该函数。真机取证（`configure()` 后逐单元）：`config`→`logs/config.log`、`tracker`→`QED-Tracker/logs/qed-tracker-serve.log`、`axiom`→`Axiom-Flow/logs/qed-axiom-serve.log`、`web`→`logs/qed-web-serve.log`，四路径 `exists=True`。**生效需重启 8900**（不热重载），留收口窗口。**2026-10-17 真机复核通过**（DEFECT-007 S4 随本批关闭）：`GET /api/v1/services` 四单元 `log_path` 全部指向真实存在文件且 `status=online`（`config`→根 `logs/config.log`、`tracker`→`QED-Tracker/logs/qed-tracker-serve.log`、`axiom`→`Axiom-Flow/logs/qed-axiom-serve.log`、`web`→根 `logs/qed-web-serve.log`），`GET /api/v1/logs/{tracker, axiom, web, config}` 四路均 200 且返回对应 `qed-*-serve.log` 尾部内容（20.9K/17.4K/16.6K/18.0K 字符） |
| W3 | `scripts/` 必要面核验与一次性面清理 | `scripts/diag_probe_5p.py`、`scripts/diag_watch_b05.py` 自标可删且全仓 docs/tests 零引用；`scripts/diag_watch_b05.log`/`.err.log` 违反落点唯一；`scripts/**/__pycache__` 非项目资产 | 已完成（2026-09-29，用户裁决＝全部直接删除）：`git status` 取证 ` D scripts/diag_probe_5p.py`、` D scripts/diag_watch_b05.py`（两枚原被跟踪），`diag_watch_b05*.log` 随删（git 忽略，不入状态）；`scripts/{,__pycache__ 三处}` 编译缓存清理。必要面逐一核验保留：`qed_engine_service.py`/`qed_web_service.py`/`serve_web.py`/`text-model/qed_qwen_service.py`/`image-model/*`（含 `compose.yaml`、`infra-*.ps1`、`download-models.py`）均被 docs/tests/code-map 引用。残余 `diag_*` 名只出现在历史归档与本轮 ADR/壳的证据文字中 |
| W4 | 备份面三处全清 + `.gitignore` 退役 | 根 `backups/db`（ARCH-019 迁移前 SQL、QED-026 pre-reset、QED-053 快照，327K）、`backend/database/backups/`（qed_test 镜像前 dump，336K）、`dataset/backups/`（arch020f 两次留痕，7.6M）；库已持续前滚，dump 不再构成可用回滚路径 | 已完成两处（2026-09-29）：根 `backups/` 与 `backend/database/backups/` 已物理删除（`ls backups` → No such file；`git status` 取证 ` D backend/database/backups/.gitkeep`），`.gitignore` 的 `/backups/` 与 `/backend/database/backups/*`+`.gitkeep` 条目移除、注释改为退役说明；`backup-qed.ps1` 改指向数据根快照落点（`-TaskId` → `dataset/backups/YYYY-MM-DD-<TaskId>/`）并在 [operations.md](../../../guides/operations.md) 登记。**第三处 `dataset/backups/`（7.6M）属数据根写操作、权限层拦截 agent 执行，转人工 D 类步骤**（命令见「遗留与移交」）；`tmp/qed026-reset-tools/` 两枚一次性脚本按用户裁决保留于 `tmp/` |
| W5 | `logs/` 遗留批删 | 19 个 2026-08 四代命名遗留（`qed-engine-backend*`、`qed-engine-frontend*`、`qed-engine-8900*`、`qed-tracker*`、`serve_web*`、`tracker.log`、`axiom.log`、`web-ui-dev.log`）在长期清单之外 | 已完成（2026-09-29）：批删后 `ls logs` 只剩长期哨兵区五文件（`config.log`、`qed-engine-serve.log`、`qed-web-serve.log`、`qed-engine.pid`、`qed-web.pid`）；契约守护 `test_runtime_artifacts_only_under_logs_and_tmp` 全仓遍历（排除 `.git`/`dataset`/子仓库/`node_modules`/`dist`/`__pycache__`）确认 `*.log`/`*.pid` 无 `logs/`+`tmp/` 之外散落。**2026-10-17 二批清理**（用户裁决＝零引用件全删、被认领证据件保留作例外并登记名单）：`logs/` 非哨兵件 68 枚按全仓文本语料（`docs/`＋`backend/`＋`tests/`＋`web-ui/src/`＋`.qoder/`＋`scripts/`＋根 `*.md`＋`.gitignore`，442 档）扫描分两处置——**61 枚零引用件物理删除**（203,299 字节，含一枚零引用 dump `knowledge-v1-ddl-backup-qed_test.sql`，清单见「过程与证据」2026-10-17 行）；**7 枚被 `completed.md`／`docs/history/plans/2026-10/` 壳正文点名认领者保留**（名单见「关闭与归档」节）。清理后 `logs/` 实存 12 件＝长期哨兵区 5 ＋登记例外 7 |
| W6 | 文档同步 | 日志与备份口径散落在多处且部分陈旧（operations.md 仍写 `qed-engine-8900.log`；service-hosting.md「`scripts/` 仅留 qed_web_service.py + serve_web.py」与实况不符） | 已完成（2026-09-29）：`service-hosting.md`（日志按实际写入点解析 + 三处 `log_path` 示例 + `scripts/` 边界改引 ADR 0019 第 5 条）、`api-contracts.md`（`/logs/{service}` 与 `/services` `log_path` 语义、缺文件空态）、`code-map.md`（`service_manager`/`log_viewer` 行补 `unit_log_path` 与定向测试）、`operations.md`（服务表 8901/8902 日志与 PID 落子仓库 + 新增「数据库快照（回滚窗口，非长期备份）」节）、`dataset-conventions.md`（`backups/` 例外区补「不留长期」）、`standards/storage-conventions.md` + `standards/index.md`（新节与治理对象同步） |
| W7 | 待裁决登记（不实施） | 日志轮转/大小上限缺失：`config.log` 2.2M、`qed-engine-serve.log` 1.5M 无上限，长驻 8900 无界增长 | 2026-09-29 登记为本轮范围外待裁决项；需要时另立任务（判据＝保留窗口 + 单文件上限 + 是否按服务分文件） |

## ADR 编号撞车处置（2026-09-29，已消解）

- 本轮与 [普通任务轮壳](../../../plans/2026-09-29-ordinary-tasks-round.md) W2 行同日各自取号 ADR 0019；经用户裁决
  **保留本轮 0019**（运行时产物落点与备份不留长期），对方窗口把「任务收口节拍与薄登记」改号为
  **0020**（`docs/adr/index.md` 现况：0019 本轮 / 0020 对方 / 下一个可用 0021）。
- 本轮不代改对方 WIP；撞号消解后由对方窗口自行同步其 shell 与契约常量。

## 遗留与移交（人工执行的 D 类步骤）

- **`dataset/backups/` 清空**（用户裁决「三处全清」的第三处）：数据根写操作被权限层拦截，
  agent 不执行；由用户在仓库根 PowerShell 运行：
  `Remove-Item -Recurse -Force dataset\backups\2026-09-20-arch020f, dataset\backups\2026-09-23-arch020f`
  （约 7.6M；两目录均为 ARCH-020F 一次性留痕，非当前回滚路径）。执行后 `dataset/backups/`
  保留空目录骨架即可，无需回报 agent。
- **8900 重启生效**：W2 改动在服务重启后才反映到控制台/仪表盘日志视图（8900 不热重载）；
  重启经 8900 控制面，属用户操作窗口。重启后判据＝`GET /api/v1/services` 四单元 `log_path`
  指向上述真实存在文件，且 `GET /api/v1/logs/{tracker|axiom|web}` 返回对应 `qed-*-serve.log` 内容。

## 过程与证据（滚动）

> 本节是本壳执行与取证的正本（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)
> 决定 5）；台账行只承载任务描述与固定成功标准，进展不写回 todo。

| 日期 | 条目 | 过程与证据 |
| --- | --- | --- |
| 2026-09-29 | W1 | ADR 0019 立档 + `storage-conventions.md`「仓库根运行时产物与备份面」节（含长期哨兵区）+ `adr/index.md` 行 + 契约四枚守护；先红样本＝`scripts/diag_watch_b05*.log` 散落与根 `backups/` 未退役；当批现况 契约 77 passed / 根全量 624 passed / ruff 全绿。 |
| 2026-09-29 | W2 / DEFECT-007 | 红用例（断言四单元路径＝实际写入点）→ 实现 `service_manager.unit_log_path(spec)` → `log_viewer._log_path` / `service_status().log_path` / 非脚本 spawn writer 三处调用点统一；`configure()` 后逐单元真机取证四路径 `exists=True`（详见登记表 W2 行）。生效需重启 8900（不热重载），属人工步骤。 |
| 2026-09-29 | W3~W5 | 用户裁决「全部直接删除」逐批清单确认执行：`scripts/` 两枚一次性诊断脚本与散落日志删除、必要面逐一按 docs/tests/code-map 引用核验保留；根 `backups/` 与 `backend/database/backups/` 物理删除 + `.gitignore` 退役条目移除 + `backup-qed.ps1` 改指数据根快照落点；`logs/` 批删 19 个四代命名遗留后只剩长期哨兵区五文件，全仓遍历守护确认 `*.log`/`*.pid` 无散落。 |
| 2026-09-29 | W6 | 文档同步六处（`service-hosting.md` / `api-contracts.md` / `code-map.md` / `operations.md` / `dataset-conventions.md` / `storage-conventions.md` + `standards/index.md`）。 |
| 2026-09-29 | W7 | 日志轮转与大小上限登记为本轮范围外待裁决项，不实施。 |
| 2026-09-30 | 行形态迁移（ADR 0023 批次） | 本壳「目标与成功标准」判据表改指针（判据正文移入 ARCH-036 台账行 `成功标准` 列，含 S6 人工两步）；按新计划契约补本节。纯文档改动，无代码与数据操作。 |
| 2026-10-17 | W5 二批清理（用户裁决记录） | 裁决＝「61 枚零引用件全删（含一枚零引用 .sql dump）」＋「7 枚被文档认领的证据件保留作例外，名单登记进壳」。删除清单（按名序）：afcols.txt、axiomlog.txt、b05-toc-raw.txt、bookids.txt、books.json、books.txt、bookslist.txt、config_api.json、config_db.txt、course_create.json、course_create.txt、dbcfg.json、dbcols.txt、dbprobe.txt、designcheck.txt、evidcheck.txt、gate_backend.txt、gate_backend2.txt、gate_build.txt、gate_contract.txt、gate_contract2.txt、gate_ruff.txt、gate_tsc.txt、gate_vitest.txt、health.json、health.txt、knowledge-v1-ddl-backup-qed_test.sql、kp_state.txt、learn503.json、learnlog.txt、learnmount.txt、leftover.txt、lg.txt、m6_cells.txt、m6_neg.txt、m6_outline_live.txt、m6_probe.txt、m6_roundtrip.txt、m6_roundtrip2.txt、m6_roundtrip3.txt、m6_row.txt、m6_row2.txt、m6_s4.txt、mysqlproc.txt、outline_progress.txt、probe8902.txt、probe8902b.txt、servetail.txt、services.json、shellcheck.txt、shellcheck2.txt、shellhead.txt、toc-recover.txt、todo_rows.txt、vitest_single.txt、w6-contract.txt、w6-contract2.txt、w6-pytest.txt、w6-ruff.txt、w6row.txt、warn.txt。执行前逐名断言存在、执行后 `logs/` 余 12 件（哨兵 5 ＋例外 7），全部为 git 忽略件不入 `git status`。 |
| 2026-10-17 | W2 / DEFECT-007 S4 真机复核 | 经用户授权跑只读 HTTP 探针（禁代理 opener，直连 127.0.0.1:8900）：`GET /api/v1/services` 返 200、四单元 `status=online` 且 `log_path` 四个路径 `exists=True`；`GET /api/v1/logs/{tracker,axiom,web,config}` 四路 200 且内容取自各自 `qed-*-serve.log`／`config.log`。零写操作。DEFECT-007 行 S1~S4 全部达成，与本行同批关闭。 |
| 2026-10-17 | 收口 | S1~S6 逐条对照见 completed.md ARCH-036 行；本壳按「归档判定：Retain」移 `docs/history/plans/2026-09/`，入档后相对链接深度由 `../` 改 `../../../`，三处反向链接（ADR 0019、ADR 0021、普通任务轮壳 W9）与 `plans/index.md` 随步改指归档路径。 |

## 验证与验收

- 契约守护先红后绿：W1 两枚红态在清理动作完成后转绿，红态样本已写入本壳 W1 行。
- W2 按 TDD：新增用例先失败（断言旧猜测路径），实现后通过；`GET /services` 与 `GET /logs/{service}`
  手工核对返回 `log_path` 存在性或空态语义。
- 门禁（QED_env 解释器，串行）：`tests/contract/` 全量 + `tests/test_log_viewer.py`
  `tests/test_api.py` `tests/test_qed_engine_service.py` `tests/test_qed_web_service.py` 定向 +
  根全量 pytest + `ruff check`。
- 清理类动作：每批删除前展示文件清单，执行后 `ls` 与 `git status` 取证写入本壳。

## 回滚

- 文档与代码改动按文件还原（W1/W2/W6），代码回滚即恢复猜测路径实现与其用例。
- 删除动作不可逆（用户裁决「全部直接删除」）：执行前逐批清单确认；`logs/` 遗留与备份 dump
  均为停更或非回滚依赖物，业务事实源在 DB 与台账，不参与运行时行为。
- `dataset/backups/` 删除后无法重建原始 dump（可经 `backup-qed.ps1` 生成新快照）。

## 关闭与归档

- 2026-10-17 收口：S1~S6 逐条达成（对照证据见 `completed.md` ARCH-036 行），本壳状态改 Completed /
  关闭结果 Achieved，按 `归档判定：Retain` 移入 `docs/history/plans/2026-09/`。
- **`logs/` 保留例外名单**（用户裁决 2026-10-17＝被文档认领的证据件不删，作为 S4「只剩长期清单」的
  登记例外）：`req105-smoke-residue-real-analysis.json`（59K，REQ-105 冒烟残留清退前备份，
  `completed.md` 与归档壳点名）、`kp-v1-ddl-backup-20261003.sql`（4.8K，M5 v1 DDL 备份）、
  `kp_backup.json`（4.4K）、`after.txt`（872B）、`kp_after.txt`（563B）、`dbafter.txt`（923B）、
  `kp_rebuild.txt`（467B）——七枚均为已关闭任务的取证留痕，长期只读、无运行时依赖；
  哨兵区五件（`config.log`／`qed-engine-serve.log`／`qed-web-serve.log`／`qed-engine.pid`／`qed-web.pid`）
  按 `standards/storage-conventions.md` 长期清单保留。
- W7（日志轮转与大小上限）属本轮**范围外**登记项，不构成本轮 S 条目，也不随关闭转新行：
  需要时按 ADR 0021「先找承载」在普通任务轮或长期线另立，判据见本壳 W7 行。
