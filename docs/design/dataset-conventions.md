# dataset 目录约定

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-30
确认状态：已确认
关联代码：根 `.gitignore`（`/dataset/*` 忽略，仅保留 `.gitkeep` 骨架）、`.env.example`
（`QED_DATA_ROOT` 变量模板）
关联测试：`tests/contract/test_storage_conventions_governance.py`（顶层白名单哨兵区与
标准一致性守护）
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、
[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)（元数据入 DB 与表命名空间）、
[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)（解析管线归 Axiom-Flow）、
[ADR 0018](../adr/0018-data-root-whitelist-and-meta-json-ban.md)（顶层白名单登记制与元数据 JSON 岛禁止）
关联计划：[arch019-data-foundation](../history/plans/2026-08/2026-08-arch019-data-foundation.md)（来源计划）；
目录约定演进经 git 历史与 `history/plans/` 各计划壳追溯

## 目的与边界

根 `dataset/` 是三个项目共享的**数据资料目录**：

- **数据资料（文件）**：原始数据（下载的 PDF/快照）与**整理后的数据资料**（Axiom-Flow
  解析产物——知识探索、课程学习、课后练习的数据输入），全部不入版本控制。
- **元数据默认存数据库**（MySQL `qed` 库）：登记、状态、进度、评价、课程体系、任务记录等
  一律入 DB（表命名空间与所有权见 [../architecture/database-design.md](../architecture/database-design.md)），dataset 内
  不再维护 JSON 状态事实源（`meta/` 退役，存量迁移归档见 [REQ-032](../trackers/completed.md)）。

> **探索产物 JSON 例外（REQ-078）**：QED-Tracker 探索管线的领域/课程知识 JSON
> （`raw/<domain_id>/domains.json`、`raw/<domain_id>/<course_id>/tutorials.json`；中间态
> `courses.json`）作为「已确认知识文档」与可重导入输入落 `raw/`，是上述「dataset 不维护
> JSON 状态事实源」的**例外**——状态事实源仍在 DB，JSON 只作知识正本与重导入输入。
> 跨项目口径经 REQ-078 确认后冻结。

模型为**统一数据根 + 内容类型顶层**：三项目经
`QED_DATA_ROOT`（变量定义见 [project-configuration.md](project-configuration.md)）
指向同一物理目录，顶层按内容类型组织（见下节白名单），第二层为领域、第三层为课程。

> **规则与结构的边界**：数据根边界、`tmp/` 生命周期、原子落盘、`raw/` 不可变与测试隔离等
> **规则**以[临时目录与数据存储规范](../standards/storage-conventions.md)为准；本文件只维护
> 目录结构与子域契约细节。

## 数据根顶层白名单（ADR 0018）

`<QED_DATA_ROOT>` 顶层**只允许**下列目录；新增/移除条目属存储规则实质变更，先立 ADR
（[docs/standards/storage-conventions.md](../standards/storage-conventions.md)「数据根」节）。

<!-- data-root-whitelist:start -->
- `raw/` — 原始数据区（唯一被外部读取的 PDF/快照区）
- `tmp/` — 临时区（任务中间产物 + exploration 例外）
- `parsed/` — 解析产物区
- `backups/` — D 类数据操作备份留痕例外区
<!-- data-root-whitelist:end -->

`backups/` 约束：仅供备份/回滚留痕（如清库、批量迁移），命名 `YYYY-MM-DD-<任务标识>`；
对应操作必须在根 todo/收口记录登记；**不留长期**——快照只服务当次 D 类操作的回滚窗口，验收
通过即清（其删除本身是 D 类操作：备份 + 用户确认），仓库内不设备份位（ADR 0019 第 4 条）。
白名单外的一律为野生区，发现即登记处置（数据修复/清理走 REQ 台账）。

## 目录结构

```text
<QED_DATA_ROOT>/                      # 默认 <workspace>/dataset（git 忽略）
├── raw/                              # 原始文件区（写入方 QED-Tracker）
│   └── <domain_id>/                  # 领域层：math-advanced（随体系扩展）
│       ├── <course_id>/              # 课程层：math_analysis / linear_algebra …
│       │   ├── <语义slug>_<sha256前8>.pdf
│       │   └── tutorials.json        # 课程知识正本（REQ-078 例外）
│       ├── domains.json              # 领域知识正本（REQ-078 例外）
│       └── _general/                 # 领域级通用桶：无法归属课程的文件
│           └── papers/<year>/<arxiv_id>_<sha8>.pdf   # 发现论文物理落位（REQ-101/102）
├── tmp/                              # 临时区（终态不保留；用户资产仅 exploration 例外）
│   ├── qed-tracker/downloads/        # 下载暂存（.part/.download），任务结束必须清理
│   └── exploration/<对象名>探索.txt   # 探索发起文档（用户手写参考，不参与自动清理）
├── parsed/                           # 解析产物区（写入方 Axiom-Flow）
│   └── <domain_id>/<course_id>/<book_id>/   # book_id 同源 qt_books（如 mathanalysis-b05）
│       ├── pages/                    # 根视图唯一长期驻留（ingest 页图，版本硬链接来源）
│       └── versions/<job_id>/        # 解析版本（每次 job 完整产物）
└── backups/                          # D 类操作备份留痕（命名与登记约束见上节）
```

- **解析中间产物不入 `tmp/`**（ADR 0018）：Axiom-Flow 的瞬态文件是产物目录同目录的隐藏
  临时文件（原子写 `.<name>.tmp-*`，写完即 `os.replace`）与 ingest 暂存子目录
  （`.<book_id>.tmp-*`，`finally` 清理），生命周期闭合在单次落盘内，磁盘上无中间副本。
- **解析版本划分（实施方：Axiom-Flow）**：同一书目每次解析 job 的产物按版本独立落盘，
  互不覆盖——
  - 版本目录：`parsed/<domain>/<course>/<book_id>/versions/<job_id>/`，内含该版本完整产物
    （页图 `pages/`、blocks、markdown、book.json、manifest.json）；job 完成校验通过后原子写入。
  - **生效版本由指针选择**：`af_books.active_job_id` 是唯一事实源，读取方（8902 页/块/
    manifest 端点、8900 代理、前端）统一经指针解析作用目录；置位 = 单列 UPDATE，切换
    不发生任何磁盘写入。`active_job_id` 为 NULL 时回退**根视图**（存量旧布局直出的首版
    legacy 产物），重新 ingest 只交换根视图并重置指针，`versions/` 完整保留。
  - **页图跨版本硬链接去重**：版本目录的 `pages/` 以 `os.link` 接入根视图页图（非复制），
    多版本不重复占盘；硬链接不可用的文件系统回落复制并告警。整版重解析（seed）同样
    逐个硬链接基线，`manifest.json`/`chunks.json` 各版本独立生成。
  - **激活即清旧**：新版本激活（`active_job_id` 置位）后自动删除旧版本目录，磁盘同一本书
    只保留当前生效版本；删除动作记运行日志，历史版本不驻留。
  - domain 为空时省略层级（现状 `parsed/linear_algebra/…` 即此形态），版本化规则不受影响。
- **插图/引擎返回图片**：归一化落 `versions/<job_id>/pages/images/<name>`，blocks 与
  markdown 以书目目录相对路径引用（不内嵌字节）。当前 MinerU 适配器不请求图片返回
  （页图由 ingest 自产），插图消费链（服务端点与前端渲染）尚未建立——落盘契约先行，
  消费面另行立项；跨版本插图去重暂无机制（触发时再立规则）。
- **教程层的论文/相关资料类别由数据库表达**：教程（qt_knowledge）下的论文/延展资料是
  `qt_books` 行（kind=paper/blog/other）挂该 knowledge_id；界面按类别分组展示、无内容不显示
  该类别。文件系统不再按教程分层，也不设 books/exercises/papers 内容类型目录（元数据入 DB）。
- **发现论文书本化（REQ-101/102）**：领域级探索、pick 落位的前沿/核心论文，元数据唯一落点
  是 `qt_books` 行（kind=paper，标识=arXiv ID，refs 承载落位——domain_id **或** course_id）；
  物理落位维持 `raw/<domain>/_general/papers/`，课程归属为**逻辑分组**，磁盘不设课程级
  papers 目录；**论文无默认桶**——落位 `domain_id` 必填且须为已登记领域（2026-10-01 裁定）；
  查重=书库命中（arXiv ID/标题）。与上一条教程附属论文同 kind 值域、以 refs 区分。
- `parsed/<domain>/<course>/<book_id>/` 内部产物格式（页图/Markdown/blocks.json/manifest）
  见 [文档解析管理·全链路设计](parsing-flow.md)。

## 契约

| 子域 | 写入方 | 读取方 | 内容 |
| --- | --- | --- | --- |
| `raw/<domain>/<course>/`（PDF/快照） | QED-Tracker | Axiom-Flow、QED-Engine 前端 | 原始数据（PDF/快照），保持来源完整性与校验信息；元数据（sha256/路径/状态）在 `qt_books` |
| `raw/{domain_id}/domains.json`、`raw/{domain_id}/courses.json`（中间态） | QED-Tracker（探索管线） | QED-Tracker（重导入） | 领域知识正本（REQ-078 例外）；`courses.json` 为中间态（领域完成时反写 domains.json 后删除）；状态事实源在 DB |
| `raw/<domain>/_general/papers/<year>/` | QED-Tracker（论文 recommend/adopt 书本化链） | Axiom-Flow（解析输入）、根侧书目消费面 | 发现论文 PDF 落位；元数据在 `qt_books` kind=paper（refs=落位 domain/course，逻辑分组见上节） |
| `raw/{domain_id}/{course_id}/tutorials.json` | QED-Tracker（探索管线） | QED-Tracker（重导入） | 课程知识正本（REQ-078 例外）；状态事实源在 DB |
| `parsed/<domain>/<course>/<book_id>/` | Axiom-Flow | QED-Engine 前端 | 整理后数据资料（页图、Markdown、blocks.json、manifest）；解析任务与页状态在 `af_*` 四表；产物布局见下表 |
| `tmp/qed-tracker/downloads/` | QED-Tracker 自用 | — | 下载中间产物，任务结束清理 |
| `tmp/exploration/` | 用户手工维护 | QED-Tracker（LLM 探索输入，经 ref_doc_path） | 探索发起文档（`<对象名>探索.txt`），用户资产不自动清理 |
| `backups/<日期>-<任务>` | 发起操作的 agent/用户 | 回滚时 | D 类数据操作备份留痕；不入任何服务读取路径 |

## 存储链路单一事实源原则（ARCH-032）

全链路「探索→下载→解析」对每类数据只维护一份落点，多写即 JSON 岛：

| 数据类别 | 唯一落点 | 备注 |
| --- | --- | --- |
| LLM 调用（prompt/response/token） | `qed_llm_calls`（DB 共享表） | 全链路统一审计；不另落 JSON 文件 |
| 探索状态与进度 | `qed_domain`/`qed_course`（DB） | exploration_stage/explore_pending；唯一事实源 |
| 探索知识正本 | `raw/{domain_id}/`（QED_DATA_ROOT） | REQ-078 例外：domains.json / tutorials.json 为知识正本与重导入输入；状态事实源仍在 DB |
| 下载书籍/论文 PDF | `raw/<domain_id>/<course_id>/`（QED_DATA_ROOT） | 成品唯一落点；staging（`tmp/qed-tracker/downloads/`）为过渡，任务结束清理 |
| 书籍元数据（路径/状态/选用） | `qt_books` + `qt_sources`（DB） | 内容身份（sha256/size）目标落 `qt_books` 三列（QED-071 B 轮）；当前临时在 `meta/resources/` JSON 岛 |
| 入库页图（ingest 阶段） | `parsed/<domain>/<course>/<book_id>/pages/p*.png`（QED_DATA_ROOT） | 根视图唯一长期文件；版本目录硬链接来源；入库即不移动 |
| 书籍 ingest 元数据（含内容身份 sha256/ingested_at） | `af_books`（DB） | 唯一正本；根视图不写 book.json/manifest.json，版本内 `book.json` 从 `af_books` 生成 |
| parse 产物（blocks/Markdown/图像/chunks） | `parsed/<domain>/<course>/<book_id>/versions/<active_job_id>/`（QED_DATA_ROOT） | 唯一正本；版本指针：`af_books.active_job_id`（DB）；激活即删除旧版本目录，磁盘只存当前生效版本 |
| 解析任务与页状态 | `af_*` 四表（DB） | 唯一事实源；`active_job_id` 设置 = 版本激活确认语义 |
| 知识点长文正文（详解／多角度叙述） | `parsed/<domain>/<course>/<book_id>/kp/<node_id>.md`（QED_DATA_ROOT） | **2026-10-21 v1.0 定档；根侧读腿 2026-10-22 已在 `qed_test` 落地**（主表 `narrative_ref` 列 ＋ `GET /learn/knowledge-points/{kp_id}/narrative`，越根双闸），**盘上正文文件尚未产出**＝写入方 Axiom-Flow（其 PLAN-024 KA-20）未交付，故现网读回 `available=false` 与悬空降级话术；读取方 8900 经主表 `qed_knowledge_point.narrative_ref` 指针取文；**正文不入列**（不落 `MEDIUMTEXT`）、**不入 `meta`**，DB 只存指针；落点在顶层白名单既有区 `parsed/` 内，**白名单不新增条目**（ADR 0018 不动）；根侧存相对路径全串、对方存单段文件名，补前缀由提升腿负责（理由是 8902 离线时 8900 仍须能自行解析，独立性铁律）；指针悬空＝可见降级，不静默改写 |

> **野生区警示（ADR 0018）**：`<QED_DATA_ROOT>/qed-tracker/`（含 `meta/resources/<sha256>.json`）不在顶层
> 白名单，属野生区；该 JSON 岛当前仍在写（书侧内容身份临时载体），随 QED-071 B 轮迁入 DB 后消失——
> B 轮完成前不得误判为合规落点。

## 强制规则

- 文件写入先写临时文件，校验通过后原子落盘（staging → `raw/`）；`tmp/` 不保留终态文件，
  任务结束时清理。
- 文件名规则：物理名 `display_title` 的 slug + sha256 前 8（`<语义标识>_<sha256前8>.pdf`——
  教材/习题为标题 slug，论文为 arXiv ID）；展示名与物理名分离（用户界面只见展示名，
  QED-031 裁决）；内容指纹保证同名同内容必然同路径，重复下载天然幂等。
- `raw/` 内文件不可变；改名或删除必须登记（DB `qt_books` 更新，不再依赖 meta/ JSON）。
- 文档标识使用内容哈希（SHA-256 前缀），保证可校验与去重。
- **元数据 JSON 岛禁止**（ADR 0018）：dataset 内除本节声明的两类例外（`parsed/**` 产物
  内部文件、`raw/**` 知识正本 REQ-078 例外）外，不得落状态/登记/留痕类 JSON 元数据
  文件；元数据唯一事实源是 DB。
- **用户资产不进 tmp**（ADR 0018）：`tmp/` 仅承载任务中间产物与 `tmp/exploration/` 例外；
  长期参考材料归 `raw/<domain>/_general/` 或数据根之外。
- 存量数据不自动迁移：子项目改造只改默认值与新下载行为；用户已有数据根保持不动。
- dataset 内任何文件的增删改不影响三个项目的独立启动。
- 服务化后写操作任务记录登记目标相对路径（DB `qt_books.relative_path`），前端可
  "任务 → 文件"跳转。
- **元数据入 DB**：登记顺序先落盘后登记（`raw/` → DB），失败可重放（幂等）；DB 为
  元数据唯一事实源（统一数据库契约见 [../architecture/database-design.md](../architecture/database-design.md)）。
