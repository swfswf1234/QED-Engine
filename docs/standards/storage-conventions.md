# 临时目录与数据存储规范

状态：Current
最后更新：2026-09-29
确认状态：已确认
治理对象：统一数据根、顶层白名单、raw/tmp/parsed 三区规则、元数据 JSON 岛禁止、临时目录生命周期、原子落盘、测试隔离与 Agent 工作临时目录、仓库根运行时产物落点与备份面
依据 ADR：`docs/adr/0013-dev-standards-system.md`、
`docs/adr/0018-data-root-whitelist-and-meta-json-ban.md`、
`docs/adr/0019-runtime-artifact-placement-and-no-long-term-backups.md`
关联测试：`tests/contract/test_storage_conventions_governance.py`

## 目的与边界

本标准定义三项目共享数据根与临时目录的**规则**。目录结构与子域契约细节归
[dataset 目录约定](../design/dataset-conventions.md)，数据根变量定义归
[统一配置设计](../design/project-configuration.md)，数据库表设计归
[数据库总纲](../architecture/database-design.md)，测试分层与隔离归
[测试架构与门禁](testing.md)。本标准只写规则，不复制上述正文。

## 强制规则

### 数据根

- 三项目经 `QED_DATA_ROOT` 指向同一物理目录（默认 `<workspace>/dataset`，推荐
  `D:\coding\QED-Engine\dataset`）；解析优先级见[统一配置设计](../design/project-configuration.md)。
- **顶层白名单登记制**（ADR 0018）：数据根顶层只允许
  [dataset 目录约定](../design/dataset-conventions.md)「数据根顶层白名单」节登记的目录
  （`raw/`、`tmp/`、`parsed/`、`backups/` 例外区）；新增/移除条目先立 ADR。白名单外目录
  即野生区，发现即登记处置台账。
- 顶层按内容类型分区：`raw/`（原始数据，唯一被外部读取的 PDF / 快照区）、`tmp/`（临时区）、
  `parsed/`（整理后数据资料）；`backups/` 仅供 D 类数据操作备份留痕（命名与登记约束见
  dataset 目录约定）。
- 数据文件不入版本控制（根 `.gitignore` 忽略 `/dataset/*`，仅保留目录骨架）。

### 元数据 JSON 岛禁止（ADR 0018）

- dataset 内禁止落状态/登记/留痕类 JSON 元数据文件；元数据唯一事实源是 DB（MySQL `qed` 库）。
- 仅两类例外：① `parsed/**` 产物内部文件（book.json / manifest.json / blocks.json /
  chunks.json 等解析管线自身产物）；② 知识正本例外（`raw/**` 的 domains.json /
  tutorials.json，REQ-078，状态事实源仍在 DB）。
- 例外之外新出现的 JSON 元数据路径（含历史僵尸代码重建的目录）一律判为 JSON 岛，
  登记退役请求（跨项目走[跨项目协作规范](cross-project-collaboration.md)）。

### tmp 生命周期

- 终态文件不保留：任务结束时清理 `tmp/` 中间产物。
- 先写临时文件，校验通过后**原子落盘**（`tmp/<project>/…` → `raw/`）。
- 不跨项目读取：`tmp/<project>/` 只由写入方自用。
- **解析中间产物不入 tmp**：Axiom-Flow 瞬态文件为产物目录同目录隐藏临时文件与 ingest
  暂存子目录，用完即清（实况见 dataset 目录约定；`tmp/axiom-flow/` 系已删除的虚构约定）。
- **用户资产不进 tmp**：长期参考材料归 `raw/<domain>/_general/` 或数据根之外；唯一例外是
  `tmp/exploration/`（用户手工维护的探索发起文档，不参与自动清理）。

### 仓库根运行时产物与备份面（ADR 0019）

治理对象是**仓库根**的运行面（`logs/`、`tmp/`、`scripts/`、备份位），与上面数据根
`dataset/` 三区互不混用：日志不属共享数据面，因此**不并入数据根顶层白名单**。

- **落点唯一**：运行日志只写 `<仓库根>/logs/`；一次性与临时产物只写 `<仓库根>/tmp/`
  （整目录随时可清，不承诺保留）；状态文件（pid / mode）随其服务日志目录。其它位置
  （`scripts/`、`backend/`、仓库根散落）出现 `*.log`、`*.pid`、快照 dump 即判违规，
  发现即清并登记处置。
- **长期日志清单**（白名单式，清单外视为遗留可整批删）：

  <!-- long-term-runtime-artifacts:start -->
  - `logs/config.log` —— 8900 自身日志（uvicorn stderr 并入 + 监督器事件账 + 掉线诊断包）
  - `logs/qed-engine-serve.log` —— 8900 生命周期脚本产物
  - `logs/qed-web-serve.log` —— 8903 静态服务生命周期脚本产物
  - `logs/qed-engine.pid` —— 8900 状态文件（随其服务日志目录，非日志）
  - `logs/qed-web.pid` —— 8903 状态文件（随其服务日志目录，非日志）
  <!-- long-term-runtime-artifacts:end -->

  子项目服务日志归各自仓库 `logs/`（`QED-Tracker/logs/`、`Axiom-Flow/logs/`），根侧不复制、
  不镜像、不在根 `logs/` 留副本。
- **读取按实际写入点**：8900 的 `/logs/{service}` 与 `/services` 响应 `log_path` 必须解析到
  该单元**实际写入**的文件（生命周期脚本落点，由 spec 的 workdir 派生），不得按
  `logs/<log_name>.log` 猜测命名；服务未启动而文件缺失时按空态返回，不报错。
- **备份不留长期**：备份只为一次 D 类数据操作的回滚窗口存在，操作验收通过即清；快照落点
  唯一＝数据根 `dataset/backups/YYYY-MM-DD-<任务标识>`（ADR 0018 例外区，命名与台账约束不变）。
  **仓库内不设备份位**（根 `backups/` 与 `backend/database/backups/` 已退役）；长期可追溯由
  台账（completed.md 与计划壳收口记录）承载，不靠物理 dump。
- **`scripts/` 只留必要面**：仅存放被 docs / tests / code-map 引用的必要脚本；一次性诊断脚本
  与其输出落 `tmp/` 用后即清；构建缓存（`__pycache__/`）不属项目资产，随时可清。

### raw 与元数据

- `raw/` 内文件不可变；改名或删除必须登记（DB `qt_books` 更新）。
- 物理名规则 `<语义标识>_<sha256前8>`（内容哈希前缀），展示名与物理名分离。
- 元数据默认存数据库（MySQL `qed` 库），dataset 内不维护 JSON 状态事实源。
- 登记顺序先落盘后登记（`raw/` → DB），失败可重放（幂等）。

### 测试隔离

- 自动测试不得读写真实数据根，只使用临时目录（与[测试架构与门禁](testing.md)一致）。
- 默认测试不写运行数据库、不访问公网、不调用外部模型。

### Agent 工作临时目录

- agent 跨任务临时文件统一放 `C:\Users\86182\AppData\Local\Temp\opencode`（机器绑定事实，
  见[本地开发环境](local-dev.md)）。
- 不把临时文件写入仓库工作区或数据根。

## 执行与门禁

- 数据根落盘行为由子项目各自契约测试守护；本标准与 `dataset/` 目录约定、`.gitignore`、
  `doc-governance.md` 引用的一致性（含顶层白名单哨兵区、虚构约定不复活）由
  `tests/contract/test_storage_conventions_governance.py` 守护。
- 目录结构变更同步[dataset 目录约定](../design/dataset-conventions.md)。
- 测试隔离由[测试架构与门禁](testing.md)与各仓库测试守护。
- 仓库根运行时产物（ADR 0019）的守护：标准正文承载长期日志清单、备份面退役与 `scripts/`
  必要面规则，且全仓 `*.log` / `*.pid` / 快照 dump 只允许出现在 `logs/`、`tmp/` 与数据根
  白名单区内，由 `tests/contract/test_storage_conventions_governance.py` 断言；8900 日志
  读取按实际写入点解析由 `tests/test_log_viewer.py`、`tests/test_api.py` 守护。

## 变更与取代

改变数据根变量、三区语义、顶层白名单、JSON 岛例外清单、tmp 生命周期、原子落盘、测试隔离
或 Agent 临时目录约定时，先按 [ADR 治理规范](adr-governance.md)新增 ADR；措辞与链接勘误
可直接修改。

改变仓库根运行时产物落点、长期日志清单、8900 日志读取口径、备份面（是否保留备份、快照
落点）或 `scripts/` 必要面判据时，同样先新增 ADR（ADR 0019 为其现行决定）。
