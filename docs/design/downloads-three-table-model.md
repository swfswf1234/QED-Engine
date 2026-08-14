# 文档下载管理三表模型设计（downloads-three-table-model）

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-14
实现说明：根仓库侧 8900 数据域三表适配 + 8903 前端三表切换已落地（2026-08-14）；QED-Tracker
侧 QED-028/029 已回执（三表 DDL/状态机/迁移/8901 端点实测完成），详情见 §8 维护规则。
关联代码：`web/app.js`、`web/index.html`、`web/style.css`（根仓库侧前端契约；8900 数据域适配
由 REQ-006 承接执行，实现时同步更新 [code-map.md](../architecture/code-map.md) 与本契约；子项目侧
`QED-Tracker src/qed_tracker/db/`、`src/qed_tracker/api/` 由其仓库承接）
关联测试：`tests/test_web.py`、`backend/tests/test_api.py`
关联 ADR：无（数据库归属沿用 REQ-026/027 裁决：各子项目确认维护，根仓库只做指引与规划）
关联文档：[course-acquisition-flow.md](course-acquisition-flow.md)（五阶段流程）、
[web-frontend.md](web-frontend.md)（8903 前端契约现状基座）、
[database-design.md](database-design.md)（数据库指引与规划）、
[service-contracts.md](service-contracts.md)（跨项目对接语义）

## 1. 背景与动机

当前 QED-Tracker 存在**双轨并存**的数据结构：

1. **qt_resources 资源状态机**（MySQL 索引 + `meta/resources/<sha256>.json` 事实源）：候选 →
   确认/备选/否定 → 下载 → 验收，10 态混装在一张表；无「一套书」概念，册数靠 target id 后缀
   表达（`01-fikhtengolts-v1/v2/v3`）。
2. **主链路 JSON**（`meta/main-line/<course_id>/<entry_id>.json`）：课程→教材条目→验收移交，
   五要素（课程/版本评价建议/渠道/状态），与资源体系统全解耦。

两者并存导致：同一门课的选书结果与下载过程分散两处、状态语义不一致、前端展示无法分层
（候选/确认/下载/否定历史全部混在一个资源列表）。用户裁决（2026-08-13）：**双轨统一为三张表**，
表结构由 QED-Tracker 确认维护（详细 DDL 见其仓库
[three-table-schema.md](../../QED-Tracker/docs/design/three-table-schema.md)，本文件定义
根仓库侧的模型视图、API 对齐与前端契约）。

## 2. 三表模型总览

关系：**表1 → 表2 → 表3 逐级一对多**。

```
qt_selections（选课表，条目=一套书）
  └── qt_downloads（下载明细，册级：一版教材的多册、单册一个文件）
        └── qt_sources（来源记录，渠道尝试：自动渠道或人工下载）
```

| 表 | 定位 | 粒度 | 展示语义 |
| --- | --- | --- | --- |
| `qt_selections` | **选课表/书单**：第一阶段选定的课程与对应书籍（最终选择哪些教程） | 一套书一条（含标题/作者/版本/roles/册列表/套标记/当前状态） | 后台默认展示；候选仅评估时出现；rejected/superseded 彻底隐藏 |
| `qt_downloads` | **下载明细**：各教材/习题集下载情况（含历史数据） | 册级（每册文件一条，一条目多条） | 挂在表1条目下展开；rejected/failed 默认隐藏 |
| `qt_sources` | **来源表**：人工下载或哪个渠道下载 | 渠道尝试级（每条下载记录多条） | 详情弹窗展示；失败尝试留痕不展示 |

### 2.1 表1 qt_selections（选课表，条目=一套书）

关键字段（详细 DDL 由 QED-Tracker 确认，见其 `three-table-schema.md`）：

- `selection_id`（PK，候选期 `cand_<md5>`，确认后稳定）
- `course_id`（所属课程）、`title`、`authors`(JSON)、`roles`(JSON 多值：textbook/exercises/
  solutions/reference——**一套书可同时是教材与习题集**）、`version`(JSON：edition/publisher/year/
  language/detail)、`vols`(JSON 册列表：如 `["v1","v2","answers"]`——**一版教材几册在此表达**）、
  `set_no`（套标记 "1"~"4" / "en" / 空）
- `evaluation`(JSON：LLM 预填 来源/文本/权威性/套候选)、`note`（评审建议）
- `status`：`candidate → confirmed / backup / rejected`；`confirmed → superseded`（被新版本
  替代时标记，见 §2.4）
- 时间戳与留痕：`created_at / confirmed_at / superseded_at / reject_reason / review_note`

### 2.2 表2 qt_downloads（下载明细，册级）

- `download_id`（PK）、`selection_id`（FK→表1）、`vol`（册标识，单册条目为空串）
- `sha256`、`relative_path`、`page_count`、`file_hint`（如「第三版 上」「习题答案」）
- `status`：`candidate → downloading → downloaded → approved / rejected`；`failed`（可重试）。
  **candidate 态**为下载预登记：下载任务发起时先落 candidate（表1 confirmed 条目下按 vols
  创建或显式预登记），任务启动转 downloading，完成转 downloaded（2026-08-13 用户裁决：
  表2 需 candidate 态，先登记再下载）
- **验收发生在表2层**（每条册级明细独立 approve/reject，reject 必填原因，硬删 + 留痕）
- 时间戳与留痕：`downloaded_at / approved_at / rejected_at / reject_reason / review_note`

### 2.3 表3 qt_sources（来源表，渠道尝试）

- `source_id`（PK）、`download_id`（FK→表2）
- `channel`：`manual`（人工下载）/ `internet_archive` / `open_library` / `google_books` /
  `libgen_li`
- `provider_id`、`page_url`、`download_url`、`file_keywords`、`attempted_at`、`ok`、`note`

### 2.4 生命周期与 superseded

- 候选=表1生命周期：AI 搜索评估（catalog/evaluate 任务）直接生成表1候选条目；
  人工三态（确定 confirm / 备选 backup / 否定 reject）决定其进入书单或退出；
  **backup ⇄ confirmed 可逆**（转正，与旧 qt_resources 三态语义一致，2026-08-13 用户确认）。
- **superseded（过时）**：一版教材被新版本替代时，旧条目从 `confirmed` 标记 `superseded`
  （保留记录留痕），前端**不展示**；新条目以新版本独立成条。判定动作由人工在评估/评审时
  执行（选中新版本入书单时，若有旧版本条目则标记 superseded，规则详见 §5 迁移与后续维护）。
- **验收在表2**：每条册级明细独立 approve/reject；表1条目的「完成度」由表2 全部册验收
  结果聚合（如一套 = 同套 ≥1 教材且 ≥1 习题集册均 approved）。

## 3. API 契约（跨项目对齐）

### 3.1 QED-Tracker 8901 新端点（QED-Tracker 承接）

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `GET /selections?course_id=&status=` | 同步 | 表1 列表；**默认过滤**不返回 rejected/superseded（彻底隐藏语义在数据层实现）；含聚合（每条目下载统计） |
| `GET /selections/{id}` | 同步 | 表1 详情（含该条目表2 册明细列表） |
| `POST /selections/{id}/confirm` | 同步轻写 | 候选→确认入书单（可选 `{note}`） |
| `POST /selections/{id}/backup` | 同步轻写 | 候选→备选（可选 `{note}`） |
| `POST /selections/{id}/reject` | 同步轻写 | 候选/确认→否定（`{reason}` 必填 + 可选 `{note}`） |
| `POST /selections/{id}/supersede` | 同步轻写 | confirmed→superseded（被新版本替代，`{reason}` 必填） |
| `GET /resources/{id}/downloads` | 同步 | 表2 册明细列表（按 selection_id 过滤）；**默认过滤** rejected/failed |
| `POST /downloads/{id}/approve` | 同步轻写 | 册级验收通过（表2） |
| `POST /downloads/{id}/reject` | 同步轻写 | 册级否定（`{reason}` 必填，硬删 + 留痕） |
| `POST /downloads/{id}/register` | 同步轻写 | 人工下载登记（`{relative_path}`，映射到表2 册级；QED-021 既有） |
| `POST /downloads` | 同步轻写 | **新建表2 候选册**（`{selection_id, vol, file_hint}` → candidate；若下载任务自动创建，则本端点可选） |
| `GET /downloads/{id}/sources` | 同步 | 表3 渠道尝试列表（详情弹窗用） |

> 退役说明（QED-030，2026-08-14 落地）：`POST /tasks/catalog/evaluate`（AI 搜索评估）与
> `POST /tasks/books/download`（自动下载任务）**已删除**——教材下载改走目录运行/CLI
> （`BookService.download` → 三表登记）；`GET /resources` 等旧 qt_resources 端点随
> 0005 迁移 drop 一并移除。表1 候选由 CLI/人工录入生成。

### 3.2 根仓库 8900 data.py 适配（根仓库侧，REQ-006 承接）

数据域网关增加三表语义代理（沿用现有 `tracker_client.py` + `data.py` 模式，错误映射不变：
8901 4xx 透传 detail、其余 503）：

- `GET /selections` → 适配 8901 `/selections`
- `GET /selections/{id}` → 适配 8901 `/selections/{id}`（含下载明细）
- `POST /selections/{id}/confirm|backup|reject|supersede` → 工厂端点（同现有 confirm/backup/
  reject 模式，接受 JSON body 含 note/reason）
- `POST /downloads/{id}/approve|reject` → 工厂端点
- `GET /resources/{id}/downloads`、`GET /downloads/{id}/sources` → 透传

## 4. 前端对齐契约（8903 文档下载管理）

### 4.1 布局（沿用左树 + 面板，内容改为三表）

- 树：领域 → 课程 → **套书（表1 条目）**（方案 B：树到套书，册明细不进树）。
  树头保留「知识点」；书籍层显示表1 条目（书名 + 版本摘要 + roles 徽标）。
- 面板默认展示选中范围的**表1 书单**（套书卡：title/authors/版本/册数完成度 x/y、
  角色徽标、套标记）；**rejected/superseded 条目数据层已过滤，前端无查看入口**（彻底隐藏）。
- 点套书卡 → 展开该条目**表2 册级明细**（每册一卡：vol/文件信息/状态；下载、验收按钮；
  表3 来源在详情弹窗展示）。
- 候选条目（candidate）仅在**评估态**出现（继续沿用「待评估」占位卡语义——未生成表1 候选
  的课程行显示「待评估」占位，已评估显示候选卡可三态操作）。

### 4.2 步骤条（保留四步，语义映射三表）

按课程区分，进入课程时展示表1 选定的书籍（每个教程已确定对应的一份教材/习题集，做好
对应关系），评估阶段选定究竟要哪一份，下载完成后指示用户**绝对路径**去审理是否达到预期。

| 步骤 | 语义 | 计数口径（三表） | 状态 |
| --- | --- | --- | --- |
| ① 选择 | 进入课程展示表1 书单（教材↔习题集对应关系就位） | 表1 confirmed 套书数 / 目标套数 | 有 confirmed 条目即进行中 |
| ② 评估 | 决定究竟要哪一份（候选→三态确认入书单） | 无 candidate 且表1 有 confirmed = 完成 | 候选三态操作 |
| ③ 下载 | 表2 册级下载（confirmed 条目下各册） | 已下载册 / 应下载册 | 下载按钮 + 任务轮询 |
| ④ 审理 | 下载完毕展示**文件绝对路径**，人工打开审理是否达预期 → 表2 逐册 approve/reject | approved 册 / downloaded 册 | 验收台 iframe + 绝对路径提示 |

- 完成判定维持两套标准：课程完成 = 表1 下 **≥2 套**（每套 = 同套 ≥1 教材且 ≥1 习题集
  的册均 approved）→ 课程行「✅ 已完成」；未完成显示进度（沿用 courseCompletion 逻辑，
  数据源从 resources 聚合改为表1/表2 聚合）。
- 版本徽标（versionBadge / 苏版名单）等既有展示逻辑保留，数据字段来源迁移到表1 `version`。

### 4.3 详情弹窗

- 套书详情：课程/领域/标题/作者/版本/roles/套标记/LLM 预填评价/评审建议/册列表（表2）。
- 册详情：vol/文件信息（sha256、relative_path、页数）/**绝对路径**/验收时间戳/
  表3 来源（channel 分词、page_url、attempted_at、ok）。

## 5. 一次性迁移（存量合并，QED-Tracker 承接）

现有存量按映射导入三表，迁移完成后旧存储退役（qt_resources 不再写入、主链路 JSON 不再
产生新数据）：

| 存量 | 映射目标 |
| --- | --- |
| qt_resources `approved` 资源 | 表1 `confirmed` 条目（版本身份取 edition/language） + 表2 对应册 `approved`（sha256/relative_path/page_count） |
| qt_resources `confirmed` 资源 | 表1 `confirmed` + 表2 册 `downloaded`（或按实际状态） |
| qt_resources `backup` | 表1 `backup` |
| qt_resources `rejected/not_found` | 按留痕写入表1 `rejected`（保留 reject_reason/rejected_by），**不展示** |
| qt_resources `source`(JSON) | 表3 渠道记录（provider→channel，page_url/download_url 填入） |
| 主链路 JSON 条目 | 表1 条目（version/evaluation/advice→note；status reviewed+→confirmed、
  downloading→confirmed+表2 downloading、downloaded→confirmed+表2 downloaded、
  approved→confirmed+表2 approved、rejected→表1 rejected 留痕） |
| 主链路 `channels[]` | 表3 渠道尝试（channel/attempted_at/ok/note） |
| 主链路 `final_path` | 表2 `relative_path` |

迁移脚本由 QED-Tracker 在其仓库实现（一次性、可重放、幂等）；**主链路 JSON 迁移并备份
快照确认后物理删除**（2026-08-13 用户裁决）；qt_resources 表与 `meta/resources/` JSON 保留
只读（退役标注）。根仓库不直接改其文件。

## 6. 跨项目分工

| 请求 | ID（根仓库 todo） | 承接（QED-Tracker todo） | 内容 |
| --- | --- | --- | --- |
| 数据库重构 | REQ-029 | QED-028 | 三表 DDL（qt_selections/qt_downloads/qt_sources）+ 状态机 + 一次性迁移 |
| API 改造 | REQ-030 | QED-029 | 8901 三表端点 + 既有端点适配 + 8900 data.py 契约对齐回执 |

根仓库侧由 REQ-006（8900 data.py 适配 + 前端三表展示）承接执行，待 QED-Tracker 回执后
联调验收。

## 7. 验证

- 根仓库：`pytest tests -q` 全绿、`ruff check src tests` 无错误、`node --check web/app.js`；
  新增前端守护（三表端点引用、套书树 token、步骤条四步语义 token、绝对路径审理提示）。
- QED-Tracker：其门禁（三表 DDL 迁移测试、状态机合法性、API 契约测试、全量 pytest + ruff）。
- 人工验收：8903 打开文档下载管理 → 默认展示表1 书单 → 点套书展开表2 明细 →
  下载后显示绝对路径 → 审理后验收；rejected/superseded 数据任何界面不可见。

## 8. 维护规则

- 表结构的最终确认与维护在 QED-Tracker（其 `docs/design/three-table-schema.md` 为 DDL
  事实源）；根仓库本文件保存模型视图与前端/API 对齐契约，变更时保持同步并运行契约门禁。
- 2026-08-13 用户审阅两仓库设计文档与计划并裁决三项补充（表2 candidate 态、主链路 JSON
  迁移后删除、backup 转正语义），本设计转 Accepted；QED-Tracker 侧任务由其仓库自行执行
  （QED-028/029），根仓库侧（REQ-006 8900 适配 + 前端三表）待其回执后执行。
- 2026-08-14 落地记录：8900 data.py 三表端点（§3.2 全部就位）、8903 前端三表切换（§4 对齐
  契约全量实现：树到套书、面板书单 + 册明细展开、详情弹窗表3 来源、步骤条四步语义、
  绝对路径审理提示、完成判定表1/表2 聚合、彻底隐藏无查看入口）；`tests/test_web.py` 守护
  同步（三表端点 token、tree-selection、四步步骤条、supersede 无入口）；QED-Tracker 侧
  回执完成（教程归并 + 数据修复 + LLM 简介 + Alembic 0004）。