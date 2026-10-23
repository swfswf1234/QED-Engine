# ADR 0019：仓库根运行时产物落点与备份不留长期

状态：Accepted
日期：2026-09-29
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

本决定**补充** [ADR 0018](0018-data-root-whitelist-and-meta-json-ban.md) 第 1 条的 `backups/`
例外区语义（何时清、仓库内还能不能设备份位），不取代其任何决定。

## 背景

2026-09-29 运行时产物梳理（用户发令：日志混乱、清理散落文件）盘出四类实况漂移：

1. **日志落点无声明边界**：`logs/` 24 个文件并存**四代命名**——现役三个运行日志
   （`config.log`、`qed-engine-serve.log`、`qed-web-serve.log`）加两个 pid 文件，其余 19 个是
   2026-08 遗留（`qed-engine-backend*`、`qed-engine-frontend*`、`qed-engine-8900*`、
   `qed-tracker*`、`serve_web*`、`tracker.log`、`axiom.log`、`web-ui-dev.log`）。标准正文
   （storage-conventions.md）只治理**数据根** `dataset/` 的 raw/tmp/parsed/backups，仓库根的
   `logs/`、`tmp/`、`scripts/`、`backups/` 无任何落点规则，agent 与守护测试无边界可断言。
2. **违规散落**：一次性诊断脚本把日志写进脚本目录（`scripts/diag_watch_b05.log` 与
   `.err.log`），脚本本体自标「可删」且全仓 docs/tests 零引用。
3. **日志视图与实况脱节（缺陷）**：8900 `log_viewer.py:30` 与 `service_status` 的 `log_path`
   按 `logs/<log_name>.log` 猜测命名，而 `tracker`/`axiom`/`web` 三单元的启停早已改走各自的
   生命周期脚本（2026-08-17 REQ-039 一代），实际写入 `qed-*-serve.log`（8903 在根 `logs/`、
   8901/8902 在**各自仓库** `logs/`）。结果控制台/仪表盘「查看日志」三格读到的是停更文件
   （`tracker.log` 2026-08-16、`axiom.log` 2026-08-12）或空（`web.log` 不存在）。
4. **备份位三处且无退役规则**：根 `backups/db`（ARCH-019 迁移前 SQL + QED-026 pre-reset +
   QED-053 快照，327K）、`backend/database/backups/`（qed_test 镜像前 dump，336K）、数据根
   `dataset/backups/`（arch020f 两次留痕，7.6M）。ADR 0018 已声明 `dataset/backups/` 是
   D 类操作例外区且「不承诺长期保留」，但**没有任何规则说明什么时候清、仓库内还能不能设
   备份位**，库已持续前滚的 dump 长期躺在盘上反而制造「能否回滚」的误判。

对照惯例：paperless-ngx 与 Hugging Face Hub 缓存的共同点是**运行时目录骨架可枚举、
瞬态与留痕不混居**；本项目缺的是仓库根这一层的声明。

## 决定

1. **落点唯一化（仓库根运行时产物）**：运行日志只允许写 `<仓库根>/logs/`；一次性/临时产物
   只允许写 `<仓库根>/tmp/`（**随时可整目录清空**，不承诺任何保留）；状态文件（pid / mode）
   随其服务日志目录。除此之外的位置（`scripts/`、`backend/`、仓库根散落）出现 `*.log`、
   `*.pid`、快照 dump 一律判为违规，发现即清并登记处置。
2. **长期日志清单（正向声明，白名单式）**：根 `logs/` 长期只保留
   - `logs/config.log`：8900 自身日志（uvicorn stderr 并入 + 监督器事件账 + 掉线诊断包，
     `/logs/config` 消费，事件账「走 8900 日志」口径不变）；
   - `logs/qed-engine-serve.log`：8900 生命周期脚本（`scripts/qed_engine_service.py`）stdout/stderr；
   - `logs/qed-web-serve.log`：8903 静态服务生命周期脚本（`scripts/qed_web_service.py`）产物；
   - `logs/qed-engine.pid`、`logs/qed-web.pid`：进程状态文件（非日志）。

   清单外的 `logs/` 文件视为遗留，可整批删除。子项目服务日志归**各自仓库** `logs/`
   （`QED-Tracker/logs/`、`Axiom-Flow/logs/`），根侧不复制、不镜像、不在根 `logs/` 留副本。
3. **日志读取按实际写入点解析（缺陷定性为规则）**：8900 `/logs/{service}` 与 `/services` 响应
   的 `log_path` **必须**解析到该单元实际写入的文件，不得按 `logs/<log_name>.log` 猜测命名；
   托管单元日志落点由 spec 声明（workdir 派生），跨仓库读取沿用 `service_manager.py:316`
   读子项目 pid 文件的既有判例（同一 workdir 下的 `logs/`）。
4. **备份不留长期**：备份只为**一次 D 类数据操作的回滚窗口**存在——操作验收通过即清；
   快照落点唯一＝数据根 `dataset/backups/YYYY-MM-DD-<任务标识>`（ADR 0018 例外区的命名与
   台账约束不变）。**仓库内不设备份位**：根 `backups/` 与 `backend/database/backups/` 退役
   （内容清理、`.gitignore` 对应条目移除）。长期可追溯性由台账承载（completed.md 与计划壳
   的收口记录），不靠物理 dump。`backend/database/backup-qed.ps1` 保留为「生成回滚快照」的
   工具，须在[运维指南](../guides/operations.md)登记其用途与快照去向。
5. **`scripts/` 只留必要面**：`scripts/` 只允许存放被 docs / tests / code-map 引用的必要脚本；
   一次性诊断脚本与其输出落 `tmp/`（用后即清），不进 `scripts/`；构建缓存（`__pycache__/`）
   不属项目资产，随时可清。

考虑过的替代方案与排除原因：

- ① **根侧统一镜像子项目日志**（8900 把 8901/8902 日志拷进根 `logs/`）——排除：需要常驻
  复制器、磁盘双份，且违反「子项目可独立开发独立部署」（子项目单独运行时根本没有根）；
  跨仓库**读**（按需取文件尾）已足够支撑控制台。
- ② **让子项目脚本改写根 `logs/`**——排除：比现状更糟，等于让子项目写另一个仓库的目录，
  破坏独立性铁律。
- ③ **备份长期保留（维持现状三处并存）**——排除：库持续前滚后 dump 已不可用作回滚路径，
  留着只占空间并诱发误判；正解是「回滚窗口内保留、收口即清 + 台账留痕」。
- ④ **把 `logs/` 并入数据根顶层白名单治理**——排除：日志属仓库运行面而非共享数据面；混入
  数据根会让「测试不得读写真实数据根」的隔离铁律反过来禁掉诊断面。

## 后果

- **正面**：散落文件可判定（三条白名单 + 一句「其余即违规」），清盘可机械执行；控制台
  「查看日志」与实况一致，陈旧路径缺陷有规则依据可回归测试；备份不再沉积，`backups` 语义
  一处（数据根例外区）而非三处。
- **负面/代价**：8900 跨仓库读子项目日志＝根侧继续持有子仓库目录路径知识（缓解：路径由
  spec 的 workdir 派生，不写死；子项目未启动时读不到文件按空态处理，不报错）；不留长期
  备份意味着操作收口后失去 dump 回滚能力（缓解：清理时机绑定「验收通过」，且操作过程记录
  进 completed.md/壳，必要时可重建快照而非依赖旧快照）。
- **中性**：本 ADR 只定规则与清单，不引入日志轮转/大小上限实现（现状 `config.log` 2.2M、
  `qed-engine-serve.log` 1.5M 未设上限，轮转策略另待裁决，见任务壳）；存量清理属 D 类动作，
  逐次经用户批准后执行，不在 ADR 内自动生效。

## 关联

- 规则正文落点：[存储规范](../standards/storage-conventions.md)「仓库根运行时产物与备份面」节；
  [运维指南](../guides/operations.md)（日志表与快照用途）、
  [服务托管设计](../design/service-hosting.md)（单元日志路径口径）、
  [api-contracts.md](../architecture/api-contracts.md)（`/logs/{service}` 与 `/services` 的 `log_path`）。
- 本决定执行载体：任务壳
  [运行时产物与备份面规范化](../history/plans/2026-09/2026-09-29-runtime-artifact-placement-round.md)
  （含 `/logs` 陈旧读路径 DEFECT 行与清理执行记录）。
- 前序裁决：[ADR 0018](0018-data-root-whitelist-and-meta-json-ban.md)（数据根顶层白名单与
  `backups/` 例外区）、[ADR 0013](0013-dev-standards-system.md)（存储规范设立）、
  REQ-039（三单元启停改生命周期脚本，日志落点漂移的起点）。
- 守护：`tests/contract/test_storage_conventions_governance.py`（长期日志清单与落点规则、
  备份不留长期条款）；`tests/test_log_viewer.py`、`tests/test_api.py`（读取路径回归）。
