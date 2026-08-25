# 数据前置轮计划：数据库清理重置与统一数据根规范（ARCH-019 前置）

状态：In Progress
任务类型：B
最后更新：2026-08-23
关联 ADR：[ADR 0011](../../../adr/0011-pending-design-location.md)（本文档承载待评审设计）、
[ADR 0009](../../../adr/0009-shared-qed-tables.md)（共享表族所有权）、[ADR 0003](../../../adr/0003-shared-qed-database-independence.md)（独立性铁律例外）
关联设计：[dataset-conventions.md](../../../design/dataset-conventions.md)（现行约定，本计划确定后由其承接更新）、
[configuration-and-secrets.md](../../../design/configuration-and-secrets.md)（变量表届时补 QED_DATA_ROOT）
关联 Tracker：docs/trackers/todo.md（主线 ARCH-019；本计划行 PLAN-019；支线 REQ-051、REQ-052）
归档判定：Retain（记录已执行数据操作，关闭后进 `history/plans/2026-08/`）

> 用户评审通过后转 In Progress。工作项 2~4 属 D 类数据操作（备份/回滚、人工复核），不另立
> 计划，执行证据登记 todo REQ-051 证据列。

## 目标与成功标准

1. **数据库清理重置**：qed 库中 QED-Tracker 相关数据表全量备份后清空，支撑课程下载轮
   （ARCH-019）从零重走一轮。
2. **统一数据根**：三项目文件存储统一到同一物理目录（默认 `D:\coding\QED-Engine\dataset`，
   经 `.env` 的 `QED_DATA_ROOT` 可整体迁移），顶层按内容类型组织：
   `<raw|tmp|parsed>/<领域名>/<课程名>/`。
3. 成功标准：备份文件经校验可恢复；五表清空后服务正常启动（空态）；存量 PDF 全部位于新
   结构且 sha256 完好；三项目在 `QED_DATA_ROOT` 配置下读写同一目录树。

## 范围与非目标

- 范围：DB 备份/清理方案、dataset 新目录规范、`QED_DATA_ROOT` 变量设计、存量文件迁移映射、
  三项目改动清单。
- 非目标：探索端点与界面（见 [exploration-ui](../../../plans/2026-08-arch019-exploration-ui.md) /
  [exploration-api](../../../plans/2026-08-arch019-exploration-api.md) 两计划）；Axiom-Flow parsed 产物的
  内容格式（归 ALN-003/V2 后续轮）。

## 前置条件

- 用户已裁决：只清库、文件保留（2026-08-23）；存量迁移采用方案 A（移动至新结构）；
  MySQL 服务可达且 `QED_DB_*` 已配置。

## 设计正文（评审确定后迁入 dataset-conventions.md / configuration-and-secrets.md）

### 1. 数据库备份与清理

```powershell
# 1) 导出（仓库根新建 backups/db/，根 .gitignore 增加 backups/）
mysqldump -h127.0.0.1 -P3306 -uroot -p qed qed_domain qed_course qt_knowledge qt_books qt_sources `
  > backups/db/2026-08-23-arch019-pre-clean.sql
# 2) 校验：文件非空且含 5 处 CREATE TABLE、行数与 SELECT COUNT(*) 一致
# 3) 清理（外键依赖序）：
#    TRUNCATE qt_sources → qt_books → qt_knowledge → qed_course → qed_domain
```

- **不动**：`alembic_version`（迁移版本）、`qed_llm_calls`（LLM 调用记录，三项目共写）、
  `qt_sources_legacy`（0006 迁移遗留备份表）。
- 课程体系种子可重播：`migrations/data/math.json`（QED-Tracker 侧）可在清空后重建
  qed_domain/qed_course，或交由全局探索流程重建（任务 REQ-056）。

### 2. 统一目录规范

```text
<QED_DATA_ROOT>/                      # 默认 <workspace>/dataset（git 忽略）
├── raw/                              # 原始文件区（唯一被外部读取的 PDF/快照区；写入方 QED-Tracker）
│   └── <domain_id>/                  # 领域层：math（随体系扩展）
│       ├── <course_id>/              # 课程层：01_math_analysis …
│       │   └── <语义slug>_<sha256前8>.pdf
│       └── _general/                 # 领域级通用桶：无法归属课程的文件（含旧 inbox/papers 存量）
├── tmp/                              # 临时区（终态文件不保留，任务结束清理）
│   ├── qed-tracker/downloads/<task-id>.part
│   └── axiom-flow/<job-id>/
└── parsed/                           # 解析产物区（写入方 Axiom-Flow）
    └── <domain_id>/<course_id>/<document-id>/
```

- **教程层的论文/相关资料类别由数据库表达**：教程（qt_knowledge）下的论文/延展资料是
  `qt_books` 行（kind=paper/blog/other）挂该 knowledge_id；界面按类别分组展示、无内容不显示
  该类别。文件系统不再按教程分层（元数据入 DB，ARCH-013 裁决）。
- 延续既有强制规则：tmp 先写后原子落盘 raw、物理名/展示名分离、raw 内文件不可变、
  先落盘后登记（详见 dataset-conventions.md）。

### 3. QED_DATA_ROOT 变量设计

- **解析优先级**：真实环境变量 > 自身 `.env` > 向上走查父目录 `.env` > 内置默认。
- **内置默认**：`<进程工作目录>/dataset/`——工作区内启动即命中根仓库 dataset；子项目独立
  降级启动则为各自目录下 `dataset/`（结构相同，满足独立性铁律）。
- **统一方式**：三项目各持 `.env` 中配置相同绝对路径值即达成统一（推荐
  `D:\coding\QED-Engine\dataset`）。
- **派生路径表**：

| 项目 | 用途 | 派生路径 |
| --- | --- | --- |
| QED-Tracker | 原始区落盘 | `<root>/raw/<domain_id>/<course_id>/` |
| QED-Tracker | 下载临时区 | `<root>/tmp/qed-tracker/downloads/` |
| Axiom-Flow | 解析产物 | `<root>/parsed/<domain_id>/<course_id>/<document-id>/` |
| Axiom-Flow | 解析临时区 | `<root>/tmp/axiom-flow/<job-id>/` |

### 4. 存量文件迁移映射（方案 A：移动至新结构）

| 旧路径（dataset/ 下） | 新路径 |
| --- | --- |
| `qed-tracker/raw/books/math-qe/<course_id>/*` | `raw/math/<course_id>/` |
| `qed-tracker/raw/books/inbox/*` | `raw/math/_general/` |
| `qed-tracker/raw/exercises/inbox/*` | `raw/math/_general/` |
| `qed-tracker/raw/papers/<year>/*` | `raw/math/_general/papers/<year>/` |
| `qed-tracker/tmp/**` | 清空，不迁移 |

- 执行顺序：备份校验通过 → 移动文件（只移动不删除，失败原位保留）→ TRUNCATE 五表 →
  重走时经 register 链路按 `sha256` 幂等重新登记（relative_path/absolute_path 回填新路径）。

### 5. 三项目改动清单

| 项目 | 改动 | 执行方 |
| --- | --- | --- |
| 根仓库 | `.env.example` 补 `QED_DATA_ROOT`；`.gitignore` 补 `backups/`；backend 图片代理等涉路径处核查（当前消费 DB absolute_path，预期无硬编码） | 根仓库（REQ-052） |
| QED-Tracker | config.py `_ENV_MAP` 增加 `QED_DATA_ROOT→data_root` 映射；落盘拼装改为共享布局；register/迁移脚本路径回填适配 | 请求：QED-Tracker（并入 REQ-055 同批登记） |
| Axiom-Flow | `AXIOM_FLOW_DATA_DIR` 语义切换为派生自 `QED_DATA_ROOT` 的 parsed 路径；ingest 落盘增加领域/课程层级 | 请求：Axiom-Flow（ALN-003 合并扩展，另行登记） |
| 文档 | dataset-conventions.md 更新为本规范（确定后）；configuration-and-secrets.md 补变量 | 根仓库（REQ-052 一并） |

## 工作项

1. 根 `.gitignore` 补 `backups/`；创建 `backups/db/`。
2. 执行 mysqldump 五表导出并校验（D 类门禁：人工核对行数）。
3. 按 §4 映射移动存量文件（PowerShell 脚本一次性执行，输出移动清单留档）。
4. TRUNCATE 五表；验证 8901 启动空态正常。
5. 登记跨项目请求（REQ-055 附带数据根适配项；Axiom-Flow 侧另行登记）。
6. 本计划设计正文经用户确定后迁入 dataset-conventions.md / configuration-and-secrets.md。

## 验证与验收

- `pytest tests/contract -q` 全绿（文档治理）。
- 备份校验：dump 文件含 5 处 CREATE TABLE；抽样表行数与清理前一致。
- 清理后：`SELECT COUNT(*)` 五表均为 0；8901 `/api/v1/health` 200 且 courses 返回空域列表。
- 迁移后：新旧路径抽查文件 sha256 一致；`raw/math/_general/` 收纳全部无课程归属存量。

## 回滚

- 数据库：`mysql qed < backups/db/<日期>-arch019-pre-clean.sql` 整体恢复（清理前必须完成
  备份校验）。
- 文件：移动为纯 rename 操作，未删除任何文件；异常时按移动清单反向移回。

## 关闭与归档

- 关闭条件：工作项 1~4 完成、验证全绿、跨项目请求已登记。
- 数据操作证据（备份文件名、移动清单、TRUNCATE 时间）登记 todo REQ-051 证据列。
- 设计正文迁移完成后，本计划 Retain 进 `history/plans/2026-08/`。
