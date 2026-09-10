# 2026-08 教材下载轮计划（textbook-download-round）

状态：Accepted
任务类型：B
最后更新：2026-09-01
关联 ADR：[ADR 0001](../../adr/v0.1/0001-root-contract-tests.md)、[ADR 0002](../../adr/v0.1/0002-frontend-and-port-centralization.md)
关联设计：[服务契约](../../../design/cross-project-contracts.md)、[dataset 目录约定](../../../design/dataset-conventions.md)、[统一配置与密钥规范](../../../design/project-configuration.md)、[配置中心 API 契约](../../../architecture/api-contracts.md)；QED-Tracker [服务接口设计（已归档基线）](../../../../QED-Tracker/docs/history/baselines/2026-08-tracker-service.md)（子仓库，ADR 0008 拆散退役）
关联 Tracker：`docs/trackers/todo.md`（ARCH-002 及 REQ-001~015；子项目 QED-Tracker QED-008~016、Axiom-Flow ALN-001~007）
归档判定：全链路联调验收通过后 Completed，Retain 归档至 `history/plans/2026-08/`

> **归档说明（2026-09-01）**：本计划概念（教材下载、LLM 筛选、三表模型方向、下载工作台）
> 已被 ARCH-019（课程下载轮）继承；数据模型已过时（qt_resources → qt_knowledge/qt_books/qt_sources）。
> 保留供历史参考。

## 目标与成功标准

在 2026-08 三项目同步对齐计划（ARCH-001）基础上，落地**教材下载轮**：把第一批高等数学学习
资料（教材 + 习题集）下载、登记并展示到 QED-Engine 前端。

1. **统一数据库落地**（2026-08-04 用户裁决）：MySQL 8 新建 `qed` 库，三个项目共用；根 `.env`
   `QED_DB_*` 为唯一事实源；配置中心提供 `/config/database` 状态接口（密码不下发）。
2. **QED-Tracker 服务化**：8901 API（`/api/v1`）+ 后台任务 + 轮询；CLI 转 HTTP 客户端；数据根
   迁 `dataset/qed-tracker/`（raw/meta/tmp 布局）；直读根 `.env` `QED_*` 变量，TOML 与
   `QED_TRACKER_*` 退役。
3. **MySQL 资源登记与状态机**：`qt_resources` 表记录下载来源、时间、书名、中英文、作者、路径、
   sha256 等；状态机 `candidate → confirmed → downloading → downloaded → approved / rejected`
   （+ `failed` 终态可重试；`backup` 备选态：candidate→backup→{confirmed,rejected}）；
   `llm_evaluation` 与 `catalog_ref` 字段、拒删留痕
   （reject_reason / rejected_at / rejected_by）；`meta/resources/` JSON 保留文件状态事实
   （双写，先落盘后登记，失败可重放）。
4. **书单与 LLM 筛选闭环**（2026-08-05 用户裁决，人机协同；2026-08-06 QED-017 增补人工评估
   三态）：以 `D:\coding\dataset\textbooks` 现有索引为蓝本（用户已筛选），整理 13 门课程书单
   （每课程两组：中文教材组 + 对应习题集组，优先中文版经典教材中译本，英文原版作补充）；qwen
   （`QED_MODEL`）辅助书目结构化与判断，**宁缺勿滥**；**按课程批量评估任务**（搜索源 Internet
   Archive / Open Library / Google Books → LLM 评估 → 候选落库），**前端人工三态评估后才下载**：
   确定=confirm / 备选=backup（不下载，可转正/放弃）/ 否定=reject（原因必填）；**中文候选确定
   优先，中文不可得时英文候选由人工决定**；已评估目标（backup/approved/rejected）评估任务
   跳过不重复推荐；下载到 `dataset/qed-tracker/raw/books/math-qe/<course>/`；下载后**人工预览
   验收**：验收通过转 `approved`（待解析），不通过则删除（文件硬删，DB 记录保留并记
   reject_reason 留痕）；中文书不可得时登记 `pending_manual`（可先转 backup 等待补书）。
5. **Axiom-Flow 对齐**：端口 8000→8902（CORS/README/指南）；产物写入 `dataset/axiom-flow/parsed/`；
   直读 `QED_*`（含 `QED_DB_*`），qed 库经 Alembic 初始化 `af_*` 表；存量 `xqfm11` 库不迁移。
6. **QED-Engine 展示**：下载工作台 `web/`（8903，原生静态页）：候选清单（课程分组/状态筛选/
   LLM 评分，行操作=确认下载/拒绝填原因）、任务中心（进度轮询）、验收台（PDF 预览 + 验收通过/
   删除填原因）、密钥/数据库配置横幅；`qed` CLI 增加 tracker 客户端子命令。

成功标准：`qed tracker catalog evaluate`（按课程评估任务）→ 候选落库 → 8903 前端三态评估
（确定/备选/否定）→ 确定者下载 → 验收通过/删除留痕 全链路可用（任务 → 下载 → MySQL 登记 →
8903 展示）；任一服务离线时其余服务与前端正常降级；至少一门课程的中文书以 `pending_manual`
状态在前端可见；拒删资源 DB 记录保留并携带原因（可追溯）。
**本轮追加（2026-08-06）：01 数学分析闭环门禁**——`01-chenjixiu`（中文教材）与对应中文
习题集真实落盘 `dataset/qed-tracker/raw/books/math-qe/01_math_analysis/` 且经 8903 人工预览
验收通过（approved）后才进入 02；中文下载链路可行性（archive 中文命中→resolve→下载）与
不可行链路结论写入 source-discovery.md 矩阵。

**2026-08-06 用户裁决（执行轮内）：** 人工评估三态（确定=confirm / 备选=backup / 否定=reject，
原因必填）+ 中文候选确定优先；13 门课程**清库重来**（MySQL `qt_resources` 全清 + 状态清空 +
已下载 PDF 删除），**逐课程**评估→人工三态→下载（不整体批量）；来源探索为持续目标
（QED-018，合规源清单与评估矩阵见 QED-Tracker `docs/design/source-discovery.md`，libgen 类
版权敏感源不纳入）。

**2026-08-06 用户裁决（执行轮内增补，下载成功优先）：** 本轮及后续首要目标是**验证「能准确
下载到指定教材/习题集」的链路并真实下载成功**，下载成功才是核心，其余（英文备选、来源
不可得标记）都往后放；**01 数学分析先完成闭环**——1 本中文教材 + 1 本对应中文习题集经
人工验收通过后才进入下一课程；显示以中文为主；不再整轮铺开制造不可得记录；**先更新文档
再执行**。配合 QED-Engine 更新：统一 `qed` CLI 与 `tracker_client.py`（补 `backup_resource`
方法对齐 QED-Tracker 三态端点）、ADR 0003 共享 `qed` 库（QED-Tracker 已对齐 QED_DB_* /
qt_* 表 / 无密码降级 / CORS 8903）。目录增补 `01-chenjixiu`（陈纪修《数学分析新讲》，
archive 合规可下载）作为 01 中文教材验证目标；`01-rudin-zh` 保留 pending_manual 等补书。

**2026-08-07 用户裁决（执行轮内增补，数学课程选书要求 + libgen 恢复）：** 每门数学课程目标
**2–4 套高质量教程**（一套 = 教材 + 高质量配对习题集；先探索两门经典，额外经典可加第三套；
优秀英文版同步下载作对照；**多余 PASS、贵精不贵多**）；**翻译版优先**（便于人工评审），
链路不可得就探索新链路或人工下载，不因困难降要求；**项目优先自动拉取，拉取不到提示人工
下载并给出下载方案**。据此：libgen（libgen.li）经用户明确裁决从退役恢复为「**书目发现 +
人工下载指引**」专用来源（LibgenProvider 只搜索与解析下载方案，`availability=metadata_only`，
永不自动写文件；人工下载文件经登记端点 `POST /resources/{id}/register` 入资源体系；
annas_archive/zlib 保持退役）；`ResourceKind` 增加 `supplement`（其他资料：配套习题答案等
同源文件不重复下载）。**01 数学分析定稿**：套一 Rudin 中译 + 吉米多维奇 + 费定晖解析
（本地已有，登记/验收）；套二 菲赫金哥尔茨《微积分学教程》3 卷 + 谢惠民《习题课讲义》
上下（libgen 发现 → 人工下载 → 登记 → 验收）；套三 陈纪修《数学分析》上下 + 习题答案
（supplement）（archive 自动下载）；英文对照 Rudin EN（已有）+ Pólya（archive 可选）。
设计文档（QED-Tracker source-discovery.md / acquisition-and-inventory.md / todo.md）已同步。

## 范围与非目标

范围内：
- 根仓库：`/config/database` 接口、`qed` CLI tracker 子命令、下载工作台 `web/` 8903、契约测试与
  设计文档同步。
- QED-Tracker：服务化 8901、配置与数据布局迁移、MySQL 登记与状态机（qed 库 `qt_resources`）、
  书单 math-qe-v2 与 LLM 筛选评估、人工确认下载、下载后验收闭环、CLI 转 HTTP 客户端、冒烟与
  幂等验证（QED-008~016）。
- Axiom-Flow：端口 8902、dataset 目录、`QED_*` 直读、qed 库 `af_*` 表初始化（ALN-002/003）。

非目标（不在本计划）：
- RAG / 向量库 / 知识图谱选型（后续学习轮，产出 `docs/learning/` 笔记）。
- Axiom-Flow `web/` 工作台迁入根仓库（REQ-005，后续轮）。
- OCR 多后端 glm-ocr（REQ-008）、deepseek 接入（REQ-009）。
- 解析 `dataset/qed-tracker/raw/` 的批量导入接口（REQ-015/ALN-006，Phase 2 前置登记）。
- 存量数据与存量库自动迁移：`D:\coding\dataset\textbooks`、Axiom-Flow `xqfm11` 均不移动、不迁移。

## 前置条件

- 根 `.env` 存在且 `QWEN_API_KEY`、`GLM_API_KEY` 已配置（已确认）；`QED_DB_*` 待填写，本机
  MySQL 8 实例可连接并允许创建 `qed` 库。
- 用户裁决（2026-08-04）：统一 `qed` 库；书单按"课程规划 + 现有索引"双轨、每课程两组、qwen
  判断宁缺勿滥；资源登记 JSON + MySQL 双写。
- QED-Tracker ADR 0001（服务化）与 `tracker-service.md`（Draft）已就位；SQLAlchemy 旧禁令
  （`tests/test_documentation.py` LEGACY_PATTERNS 与 `tests/test_cli_architecture.py`）随实现轮
  同步移除。
- Axiom-Flow ALN-001 登记计划已完成，本计划为其确认后的执行入口。

## 工作项

### 线 A：QED-Tracker（子仓库，dev 分支；QED-008~016）

1. 服务化 8901（QED-008）：`src/qed_tracker/api/`，前缀 `/api/v1`；只读查询同步、写操作后台
   任务 + `GET /tasks/{id}` 轮询；并发上限 2；同 sha256 幂等复用；任务落盘 `meta/tasks/`。
2. 配置与数据迁移（QED-009）：直读根 `.env` 的 `QWEN_API_KEY`、`QED_MODEL`、`QED_AXIOM_URL`
   （默认 8902）、`QED_TRACKER_PORT`、`QED_DB_*`；数据根默认 `dataset/qed-tracker/`；TOML 与
   `QED_TRACKER_*` 退役；无 `.env` 时最小默认值 + 尾注提醒。
3. MySQL 资源登记与状态机（QED-012）：qed 库 `qt_resources` 表（source / retrieved_at / title /
   language(zh|en) / kind / authors / year / edition / identifiers / relative_path / sha256 /
   page_count / status(candidate|confirmed|downloading|downloaded|approved|rejected|failed|
   pending_manual|not_found) / llm_evaluation(JSON) / catalog_ref(JSON) / confirmed_at /
   downloaded_at / approved_at / rejected_at / reject_reason / rejected_by）；登记先落盘后写库，
   失败可重放；SQLAlchemy 旧禁令同步移除。
4. 书单与 LLM 筛选评估（QED-013）：整理 `catalogs/math-qe-v2.json`（13 门课程，每课程教材组 +
   习题集组，含书名/作者/语言/kind/中译名可选项）；**按课程批量评估任务**
   `POST /tasks/catalog/evaluate {course_id?}`（搜索源 → qwen 评估 → 候选落库，输出可审阅报告，
   不写资源事实；已评估目标 backup/approved/rejected 跳过不重复推荐）；候选级拒绝
   `POST /resources/{id}/reject {reason}`；中文书登记 `pending_manual`（可先转 backup 等待
   补书）；人工补书 = 放入目录后 `scan` 登记。
5. 下载与预览（QED-015）：`POST /tasks/books/download {resource_id}` 仅 `confirmed` 可触发，
   下载后回填 sha256/relative_path/page_count；`GET /resources/{id}/file` PDF 预览流
   （downloaded/approved 可访问）。
6. 验收闭环（QED-016/QED-017 增补）：`POST /resources/{id}/confirm`（candidate/backup→
   confirmed）、`POST /resources/{id}/backup`（candidate/pending_manual→backup，人工评估
   「备选」）、`POST /resources/{id}/approve`（downloaded→approved）、
   `POST /resources/{id}/reject`（candidate/backup 或 downloaded→rejected，后者同步硬删文件，
   DB 记录保留 + reject_reason 留痕）；CLI 闭环命令（catalog evaluate / resources
   list|show|confirm|backup|reject|approve / books download）。
7. CLI 转 HTTP 客户端（QED-010）：默认等待，`--no-wait` 输出 task_id。
8. 来源探索（QED-018）：候选源实测（连通性/中文覆盖/候选质量/下载成功率）→ 评估矩阵更新
   （QED-Tracker `docs/design/source-discovery.md`）；合适的新源实现 provider（TDD）并注册
   `PROVIDER_TYPES`；不合适的记录结论不落地；libgen 类版权敏感源不纳入。
9. 验证（QED-011/QED-014）：真实 8901 冒烟 + 重复下载幂等验证 + 联调回执 + 13 门课程逐轮
   （评估→人工三态→下载）。

### 线 B：Axiom-Flow（子仓库，release 分支；ALN-002/003，计划见 ALN-007）

1. 端口 8000→8902：CORS 白名单、README、`docs/guides/development.md`、`operations.md`、启动
   命令与冒烟脚本同步。
2. 数据与配置对齐：产物默认写入 `dataset/axiom-flow/parsed/`；直读 `QED_*`
   （`QWEN_API_KEY`→`AXIOM_API_KEY`、`QED_OCR_MODEL`→`AXIOM_VISION_MODEL`、`QED_MODEL`→
   `AXIOM_KNOWLEDGE_MODEL`、`QED_DB_*`→`AXIOM_MYSQL_*`），旧变量保留别名；load-env.ps1 映射
   依赖退役（映射层已随 2026-08-17 scripts/ 整理删除）。
3. qed 库初始化：`alembic upgrade head` 建立 `af_*` 表；存量 `xqfm11` 不迁移、不改名。

### 线 C：QED-Engine 根仓库（REQ-007、REQ-011、REQ-012）

1. 配置中心 `/config/database` 接口（REQ-007）：`QED_DB_*` 读取与布尔状态，密码不下发；
   契约与测试同步。
2. `qed` CLI tracker 子命令（REQ-012）：`qed tracker books list|download`、`qed tracker resources
   confirm|reject|approve`、`qed tracker tasks`（等待/轮询模式），服务地址来自 `QED_TRACKER_URL`。
3. 下载工作台 `web/` 8903（REQ-011）：原生 HTML/JS 静态页——服务状态卡（8900/8901/8902
   health）、候选清单（课程分组/状态筛选/LLM 评分，经 8901 `/resources`；行操作=三态评估：
   确定/备选/否定填原因；backup 卡片可转正/放弃；confirmed 可触发下载）、任务中心（进度
   轮询）、验收台（iframe 内嵌 8901 `/resources/{id}/file` PDF 预览 + 验收通过/删除填原因）、
   密钥与数据库配置横幅；**按课程评估视图**（选课程 → 中文候选优先展示 → 触发该课程评估）；
   与 Axiom-Flow `web/` 迁移解耦。
4. 契约测试与文档同步：设计文档实现状态更新、`tests/contract/` 守护新契约。
5. **tracker_client 对齐（2026-08-06 配合增补）**：`src/qed_engine/tracker_client.py` 补
   `backup_resource` 方法（对齐 QED-Tracker `POST /resources/{id}/backup` 三态端点），
   `tests/test_tracker_client.py` 同步；契约一致性复核（service-contracts ↔ tracker_client ↔
   8901 实现）。

## 验证与验收

- 每项目门禁：根仓库 `pytest tests -q` + `ruff check src tests` + `tests/contract/`；QED-Tracker
  `pytest tests -q` + ruff + 文档契约测试；Axiom-Flow 全量门禁 + `node --check web/app.js`。
- 全链路冒烟：真实启动 8901 → `catalog evaluate`（按课程）→ 候选落库 → 8903/CLI 三态评估
  （确定/备选/否定）→ 确定者下载任务 → PDF 落位 `dataset/qed-tracker/raw/books/math-qe/<course>/`
  → `qt_resources` 有记录 → 8903 验收台预览 → 验收通过（approved）或删除（文件移除 + DB 留痕）。
- 双写一致性：登记失败可重放；JSON 与 MySQL 记录字段一致（sha256 幂等）。
- 独立性验收：停 8901/8902 任一服务，前端降级显示离线；无根 `.env` 时子项目最小默认值启动 +
  尾注提醒。
- 书单验收：math-qe-v2 覆盖 13 门课程、每课程教材与习题集两组；中文书不可得时登记
  `pending_manual` 且前端可见（可先转 backup）；已拒删资源 DB 记录保留（reject_reason 非空），
  已评估目标（backup/approved/rejected）不再重复推荐。
- 三轮执行验收（2026-08-06 用户裁决）：13 门课程清库重来后**逐课程**完成一轮评估→三态→下载，
  中文候选优先确定；每门课程结论（确认下载/备选等待/否定/来源不可得）记录在案。
- **01 闭环验收（2026-08-06 用户裁决增补，本轮门禁）**：先更新文档（source-discovery 链路
  评估、本计划、todo）再执行；01 数学分析完成「1 本中文教材（01-chenjixiu）+ 1 本对应中文
  习题集」真实下载 + 8903 人工预览验收通过后才进入 02；下载链路可行性实测结论（archive
  中文命中→resolve→下载；google_books 429 绕过；open_library 中文不可用）回填
  source-discovery 矩阵；02/06 已产生的评估记录保留，后续逐课程处理。
- **01 闭环验收（2026-08-07 修订，数学课程选书要求）**：01 定稿两套核心 + 补充套 + 英文
  对照（见「2026-08-07 用户裁决」段）：套一本地已有（Rudin 中译 + 吉米多维奇 + 费定晖
  解析）登记验收；套二（菲赫金哥尔茨 3 卷 + 谢惠民上下）libgen 发现 → **人工下载 → 登记
  端点入资源体系** → 验收；套三（陈纪修上下 + 习题答案 supplement）archive 自动下载验收；
  英文对照（Rudin EN 已有 + Pólya archive 可选）。**至少 2 套教材+习题集人工验收通过后
  才进入 02**；libgen.li 链路结论已回填 source-discovery 矩阵（发现可行、下载需人工）。

## 回滚

- 配置/端口/代码变更在各项目仓库内提交，回滚 = 各自仓库 git revert + 恢复旧默认值。
- `qed` 库为新建库，回滚不触存量；`xqfm11` 与 `D:\coding\dataset\textbooks` 不迁移不动。
- 数据布局迁移不自动执行（存量不迁移），新布局回滚仅影响新下载文件；`meta/tasks/` 任务记录
  保留可追溯。
- 下载工作台为新增静态页，删除即回滚；Axiom-Flow `web/` 在迁移前继续可用（ADR 0002 约定）。

## 关闭与归档

- 各线完成后子项目计划关闭（Completed + 关闭结果），todo 行原子移除并写 completed。
- 本总计划在全链路联调验收通过后关闭（关闭结果 Achieved），Retain 归档至
  `history/plans/2026-08/`，保留副本作为跨仓库审计证据。
