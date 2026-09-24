# 临时目录与数据存储规范

状态：Current
最后更新：2026-09-24
确认状态：已确认
治理对象：统一数据根、顶层白名单、raw/tmp/parsed 三区规则、元数据 JSON 岛禁止、临时目录生命周期、原子落盘、测试隔离与 Agent 工作临时目录
依据 ADR：`docs/adr/0013-dev-standards-system.md`、
`docs/adr/0018-data-root-whitelist-and-meta-json-ban.md`
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

## 变更与取代

改变数据根变量、三区语义、顶层白名单、JSON 岛例外清单、tmp 生命周期、原子落盘、测试隔离
或 Agent 临时目录约定时，先按 [ADR 治理规范](adr-governance.md)新增 ADR；措辞与链接勘误
可直接修改。
