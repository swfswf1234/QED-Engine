# 解析产物存储单一事实源优化（parsing-storage-single-truth）

状态：Completed
任务类型：B
最后更新：2026-09-26
关联 ADR：ADR 0017（事实源唯一铁律）、ADR 0018（数据根顶层白名单与元数据 JSON 岛禁令）
关联设计：docs/design/parsing-flow.md §5、docs/standards/dataset-conventions.md
关联 Tracker：docs/trackers/todo.md（REQ-097 支线行）
归档判定：Retain（跨项目请求承接与关闭过程需留痕，回执后归档 history/plans）

## 目标与成功标准

承接 ARCH-032 存储链路规范化轮勘察结论：解析侧（Axiom-Flow）存在三个差距——根视图冗余文件、
旧版本不清理、文档布局过时。本壳承载 REQ-097 全链路优化，落地用户 2026-09-26 设计裁决：

- 根视图只保留 `pages/*.png`（ingest 产物，版本目录硬链接来源）
- 所有其他文件只在 `versions/<active_job_id>/`（版本目录为唯一正本）
- 激活新版本时自动删除旧版本目录（只保留一个活跃版本）
- `af_books.active_job_id` 设置 = 正式确认语义，无需额外步骤

**背景（差距来源）**：

1. **根视图冗余文件**：`book.json` 和 `manifest.json` 同时写在根视图
   (`<book_id>/book.json`) 和版本目录 (`<book_id>/versions/<job_id>/book.json`)，
   两份副本造成「哪一份是正本」的歧义，与单一事实源原则冲突。
2. **旧版本目录不清理**：PP-14 现为「文件保留在 versions/ 下供排查、不自动删除」，与
   「最终解析数据只放一份」的用户设计约束冲突；磁盘长期累积历史版本。
3. **文档布局表述过时**：`parsing-flow.md §5` 仍显示无版本的旧产物布局（blocks.json/md 在
   根 pages/），与 REQ-080 版本化后的实际布局不符，误导消费方。

**目标状态（REQ-097 完成后）**：

```text
parsed/<domain_id>/<course_id>/<book_id>/
├── pages/
│   └── p*.png                   ← ingest 产物，唯一根视图文件（版本硬链接来源）
└── versions/
    └── <active_job_id>/          ← 唯一版本目录（旧版本激活时删除）
        ├── book.json             ← 从 af_books DB 生成（不再从根视图文件复制）
        ├── manifest.json         ← 版本内产物清单（路径相对版本目录）
        ├── chunks.json           ← 知识块（派生，可重建，不入库）
        └── pages/
            ├── p*.png            ← 硬链接自根视图 pages/（零额外磁盘）
            ├── p*.blocks.json    ← 唯一 parse 产物落点
            ├── p*.md             ← 唯一 parse 产物落点
            └── images/           ← 引擎抽取图像
```

DB 侧（af_books）：存储全量书籍元数据（含 ingest 时写入的 sha256/ingested_at）；
`active_job_id` 非 NULL = 正式确认语义（读取方唯一事实源）。

**成功标准**：

| ID | 标准 |
| --- | --- |
| S1 | 新 ingest 后根视图只有 `pages/p*.png`（无 book.json / manifest.json） |
| S2 | 新版本激活后旧版本目录被删除，同一本书磁盘只有一个版本目录 |
| S3 | parsing-flow.md §5 与 parsing-pipeline.md 产物布局图一致且与实现一致 |
| S4 | af_books 包含所有 book.json 字段（含 ingest_sha256 / ingested_at），根侧对账 doctor（REQ-096）能通过 af_books 自证 |
| S5 | Axiom-Flow 门禁（pytest + ruff）全绿，现有契约测试（产物三件套 + manifest 完整性 + 数据根不变式）全部通过 |
| S6 | 8900 适配层通过 8902 API 正常读取解析产物，消费面无感知版本存储变化 |

## 范围与非目标

**范围**：根侧文档修正（W1）+ 跨项目请求发出与承接登记（W2）+ 回执核查关闭（W4）。
Axiom-Flow 侧代码实现（W3/R1~R5）由对方会话执行，本仓库只落文档面。

**差距清单**：

| 项目 | 当前状态 | 目标状态 |
| --- | --- | --- |
| 根视图 book.json | ingest 写入，versions/ 继承复制一份 | 删除根视图写入；ingest 元数据全量落 af_books |
| 根视图 manifest.json | ingest 写入根视图清单 | 删除根视图写入（仅 pages/*.png，无清单需要） |
| 旧版本目录 | 激活后保留，无清理规则（PP-14 显式说明） | 新版本激活时删除旧版本目录 |
| versions/book.json 来源 | 从根视图 book.json 文件复制（PP-15「播种」） | 从 af_books DB 生成 |
| API book.json 回落 | 空 af_books 时回落文件系统 book.json | 改为直读 af_books（书不存在则 404） |
| parsing-flow.md §5 | 显示无版本旧布局（blocks.json 在根 pages/） | 更新为带版本的正确布局 + REQ-097 目标注 |
| parsing-pipeline.md PP-2/PP-14/PP-15/PP-16 | PP-2 写 book.json 到根、PP-16 描述根 manifest | 与目标状态同步 |
| af_books 列 | 缺 ingest_sha256 / ingested_at（当前在 book.json 中） | 按需补列（Alembic 迁移） |

**边界与非目标**：

- **版本目录清单**：版本 `manifest.json` 内容格式（路径相对版本目录，PP-16 语义）不变
- **REQ-096 对账 doctor**：S4 只要求 af_books 字段完整；doctor 实现另立设计，不在本轮
- **硬链接机制**：根视图 `pages/*.png` 是版本目录 `pages/*.png` 的硬链接来源，不变（PP-15）
- **QED-071 B 轮**（qt_books sha256 迁移）：与本轮无依赖，各自独立执行

## 前置条件

- Axiom-Flow 侧承接已登记（2026-09-26，用户授权根侧代登文档面）：其 todo REQ-097/PLAN-017
  两行 + 实施壳 `Axiom-Flow/docs/plans/2026-09-26-parsing-root-view-cleanup-request.md`，
  对方契约 180 绿
- R1（af_books Alembic 补列）是 W3 各项的代码前置，由对方会话执行
- W3 中「激活时删除旧版本目录」属 D 类数据操作，须对方会话内逐条经用户窗口批准
- ARCH-034（Axiom-Flow 在途轮次）边界已在 PLAN-017 壳内声明，互不阻塞

## 工作项

### W1（根仓库，已完成）：文档修正

- **parsing-flow.md §5**：产物布局图从旧无版本布局更新为当前实际布局（pages/*.png 在根，
  blocks.json/md/chunks.json 只在 versions/），补 REQ-097 目标注
- **dataset-conventions.md**：存储链路单一事实源原则表拆分「解析产物」条目，明确
  入库页图（根视图唯一）与 parse 产物（版本目录唯一正本）各自的落点与 REQ-097 目标
- **2026-09-26 晋升（用户裁决，本会话执行）**：目标状态晋升为设计契约正文——
  parsing-flow.md §4/§5 改为设计态布局（实现状态转 In Progress、关联 ADR 补 0018、删过程标注）、
  dataset-conventions.md 版本划分与单一事实源表随动、cross-project-contracts.md 与
  api-contracts.md 的 ingest 描述同步「渲染页图 + 元数据落 af_books」口径；design/architecture
  文档不再携带 REQ-097 过程标注（去过程化裁决）

### W2（根仓库，已完成）：发出跨项目请求（REQ-097）

- 在 `Axiom-Flow/docs/plans/` 创建请求文档（R1~R5 五项变更）
- 在根仓库 `docs/trackers/todo.md` 登记 REQ-097
- **2026-09-26 补**：对方承接登记完成（用户授权根侧代登文档面）——其 todo REQ-097/PLAN-017
  行 + 请求文档正规化为其契约合规的实施壳，对方契约 180 绿

### W3（Axiom-Flow，已完成并回执 2026-09-26）：实现代码变更（对应其 PLAN-017 壳 W1~W5）

- **R1**：验证 af_books 字段完整性，补 `ingest_sha256`/`ingested_at` 列（Alembic），
  然后 `ingest/importer.py` 停止写 root `book.json` 到文件系统
- **R2**：`ingest/artifacts.py` 停止写 root `manifest.json`（ingest 完成时根视图仅有 pages/*.png）
- **R3**：版本播种（`seed_version_from`）从 af_books DB 生成 `book.json`，不再从根视图文件复制
- **R4**：`orchestrator/pipeline.py` 激活新版本时删除旧版本目录（`af_books.active_job_id` 更新后执行）
- **R5**：更新 `parsing-pipeline.md`（PP-2/PP-14/PP-15/PP-16 + 产物布局图）+ 更新 API 回落
  逻辑（删文件系统回落，改为直读 af_books）


- **收口记录（2026-09-26）**：对方 PLAN-017 W1~W6 全实施并六步收口（锚点 f2fd689 代码批／6cab58f 文档批；
  其门禁 548 passed + ruff 全绿 + QED_TEST_MYSQL 集成 8 passed），S1~S5 逐条达成；读取面改纯 DB 驱动
  （无 book.json 回落）；偏差 D1＝复用 af_books 既有 sha256 列、D2＝Alembic 20260926_0001 纯加列不回填
  （存量书 ingest_sha256/ingested_at 为空——**S6 回归重点核验存量书元数据读取不失明**）；真机磁盘证据
  移交其 ARCH-011 窗口。本行以下 R1~R5 为原承接清单，保留备查。
### W4（根仓库）：收到 Axiom-Flow 回执后关闭

- 核查 S1~S5 回执证据 + S6 根侧回归（8900 消费面经 8902 API 读取正常）
- 更新 REQ-097 状态 → Achieved，移到 completed.md；本壳 Retain 归档

## 验证与验收

- 根侧：`tests/contract` 全绿（本壳合规、todo 镜像一致）
- W3 验收以对方 PLAN-017 壳 S1~S5 判据为准（对方门禁 pytest + ruff + 契约）
- S6 根侧回归在收到回执后由本仓库执行：8900 适配层读取一个已激活版本的 book.json 与
  pages 产物，确认消费面无感知

## 回滚

- W1/W2 为文档变更，git  revert 对应提交即可
- W3 代码回滚由对方会话负责：其壳「回滚」节声明——af_books 补列为 NULL 兼容列不回滚
  schema，行为回退靠恢复根视图双写与保留旧版本目录的提交
- 已按新布局产出的数据不反向迁移；旧版本目录一旦删除不可恢复（执行前 D 类批准保护）

## 关闭与归档

- 触发条件：对方 W6 回执（S1~S5 达成）+ 本仓库 S6 回归通过
- 关闭动作：todo REQ-097 行移除 → completed.md（关闭结果 Achieved）；本壳归档判定 Retain
  → 移入 `docs/history/plans/2026-09/` 并在 `plans/index.md` 登记去处

- **收口记录（2026-09-26）**：对方 PLAN-017 W1~W6 已实施并回执收口（锚点 f2fd689／6cab58f）；
  本仓库 S6 真机实测通过——8900/8902 双服务在线，经 8900 单入口核验书目列表、b05（317 页全本）
  元数据（含 sha256）／页 1 blocks／页图 200（534KB）、b01 经 `active_job_id=ab91e2d19bf4` 指针
  读取，消费面无感知。存量根视图文件与 b01 多版本残留属「存量数据不自动迁移」设计，旧版本随
  各自下次激活清退。W1~W4 齐备，按 Retain 归档 `history/plans/2026-09/`；REQ-097 行移
  completed.md（Achieved）。
