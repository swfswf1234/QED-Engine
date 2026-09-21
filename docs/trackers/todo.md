# 任务台账

状态：Current
最后更新：2026-09-21

本文件登记根仓库未关闭任务，是活跃计划的镜像。详细计划见 [计划索引](../plans/index.md)；
已关闭任务见 [completed.md](completed.md)。

## 未关闭任务

### 第三轮主线·解析联调轮（ARCH-020）

推进顺序：准备（前端设计定稿已完成，晋升 design/parsing-ui.md；MinerU 模型已部署）→ 实现（ARCH-020-B/C/D）→ 验收（ARCH-020-E）→ 数据操作（ARCH-020-F）。
**2026-09-20 主线收口（Partial，用户裁决）**：实现面 B/C/D 与四轮界面迭代（UI/WB/G）全部
关闭归档；本区仅存续项独立跟踪——E（Rudin 端到端验收，阻塞于 REQ-075/080/081 回执）、
F（axiom/xqfm 库删除剩余）、PLAN-044（剩余端点与联调承载）。

#### 准备（第一步）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| PLAN-044 | 支线 | 高 | In Progress | [文档解析管理·与 Axiom-Flow 交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md) | 8902 契约冻结 + 端到端验收；定稿后与 design/parsing-ui.md 合并评估归属（parsing-flow 位） |

#### 实现

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| REQ-080 | 支线 | 高 | 待开始 | **请求：Axiom-Flow**——解析产物按版本划分实施：每次解析 job 产物原子独立落 `parsed/<domain>/<course>/<book_id>/versions/<job_id>/`（页图/blocks/markdown/manifest 全套），book_id 根目录保持「当前生效版本」视图（读取方与端点契约不变），`af_parse_jobs` 记录生效版本指向；约定正文见 [dataset 目录约定](../design/dataset-conventions.md) | 2026-09-20 用户裁决登记（现状为重复解析覆盖落盘，无版本留痕）；对方确认约定并实施回执后关闭 |
| REQ-081 | 支线 | 高 | 待开始 | **请求：Axiom-Flow**——MinerU 解析块 bbox 坐标失真（前端对照框与原页文字不对齐）：`GET /books/linearalgebra-b01/pages/7` 实测 `image_size=[1241,1755]`（与 PNG 实际像素一致，展示侧 1:1 换算无缩放），但 7 块中：全部段落块 `x1` 恒等于 1241（图像右边缘精确值）、块 4/5/6 `y1` 恒等于 1755（底边），块 4 高仅 3px（长段落）、页码块 1×1、块 0「序」为贴右缘 1px 细条——典型「坐标越界后被夹取」特征，缺陷在解析落库前的坐标换算/来源空间判定环节（嫌疑路径：`src/axiom_flow/normalize/blocks.py:56-70` `scale_bbox` 夹取、`src/axiom_flow/engines/mineru.py:114-123,165` `page_size` 提取与按页配对、`orchestrator/pipeline.py:85` 几何基准）；请贵方对 b01 p7 复现并判定 content_list bbox 实际坐标空间 vs `pdf_info.page_size` 是否错配 | 2026-09-20 用户浏览器对照发现选框不齐，根仓库按「诊断三必查」取证：①页数据 JSON 实测（上述值）；②PNG IHDR 实测 1241×1755 与声明一致；③前端 PageImagePane 仅按自然尺寸百分比定位、无二次缩放。b01 当前仅 2 页产物（p7 实证、其余页 pending），样本有限，请对方补全诊断；对方修复回执后根仓库以 §13 验收复测 |

#### 验收与数据

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-020-E | 支线 | 高 | 待开始 | 联调验收：Rudin 教程（mathanalysis-b05 + b11）端到端解析 | 用户确认解析效果；**前置阻塞**：REQ-075（8902 解析产物缺失，页数据/块判定 E2E 暂无法跑通；2026-09-20 已验证 202 受理/id/progress 对象/终态 failed 语义与 4xx 透传正常） |
| ARCH-020-F | 支线 | 中 | 进行中 | 数据操作（D 类）：qed 统一 + axiom/xqfm 库删除 + dataset 物理清理（axiom-flow/qed-tracker/math.rar/参考书籍） | 备份 + 演练 + 用户确认；**2026-09-20 dataset 清理已执行（用户裁决范围＝仅退役目录+meta 死数据）**：`dataset/axiom-flow/`、`dataset/qed-tracker/`（meta 11 JSON+marker）备份至 `dataset/backups/2026-09-20-arch020f/` 逐字节校验后删除，两 `.gitkeep` git rm 暂存（未提交）；math.rar（666MB）、tmp/参考书籍（1.2GB，用户自整理）、tmp 残留 `.download` 均保留不动；**剩余**：axiom/xqfm 库删除与 qed 统一待后续；**2026-09-20 移交登记**：QED-Tracker `config.py` `state_dir`（指向 `qed-tracker/meta/`）全仓库零消费者属死代码，请其随清理轮删除（Grep 证据见 [展示优化轮计划](../history/plans/2026-09/2026-09-20-parsing-display-round.md) W4） |
| REQ-057 | 支线 | 中 | 进行中 | **请求：QED-Tracker / Axiom-Flow**——ADR 0011 规则同步回执（2026-08-23 用户指令同步，根仓库 agent 直接执行文档改动）：QED-Tracker 已完成（已建 `docs/adr/0003-pending-design-location.md` + adr/index 登记 + documentation.md design/plans 两行修订 + tests/test_documentation.py 白名单补 1 行，验证通过）；Axiom-Flow 已建文档但未审阅（已建 `docs/adr/0002-pending-design-location.md` + adr/index + documentation.md 两行修订，验证通过但未审阅） | Axiom-Flow 需完成文档审阅后回执关闭 |
| REQ-036 | 支线 | 高 | 待开始 | v2 服务建设与 V2-003 移交审阅（请求：Axiom-Flow，C 组联调前置）：① V2-003 ingest 代码已由根仓库侧误建在对方工作区（未提交，81 passed + ruff clean，含单元测试与文档同步）——请审阅后自行提交或调整；② V2-004/005/007（orchestrator / MinerU 接入 / API v1）按对方 todo 推进，8902 API 服务建立后回执根仓库（C 组第一阶段联调与 REQ-034 前置解除） | 2026-08-16 登记（亡羊补牢：误产生的代码改动登记移交，对方审阅后自行提交；V2 联调前置已在对方 todo 标注）；**对方承接回执后关闭** |

### 模型注册表与三接口统一轮（ARCH-023，2026-09-21 主线关闭，Achieved）

#### 存续连带项（证据见 [completed.md](completed.md) 与 history/plans/2026-09/ 计划壳）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| REQ-075 | 支线 | 高 | 进行中 | **请求：Axiom-Flow**——MinerU 直连配置同步（根仓库 2026-09-16 变更：端口 8002→5002、变量 `QED_MINERU_URL`→`QED_OCR_MODEL_URL`）：引擎适配器改读新键与新端口（其 `AXIOM_MINERU_URL` 兜底映射同步），并更新其 operations/development/model-integration 文档与 smoke 脚本；**2026-09-20 联调扩充**：其 `engines/mineru.py` 轮询 `GET /get_task_results/{task_id}` 在 MinerU 3.4.4 容器 404（该版本仅提供 `/file_parse`、`/tasks`、`/tasks/{task_id}`、`/tasks/{task_id}/result`、`/health`），需按新版异步 API 对齐端点路径 | 根 .env **不保留旧键别名**；其对齐前 Axiom-Flow 解析直连失效（风险已声明）；**2026-09-20 E2E 实证**：5002 /health 正常、任务受理 queued→running→failed（error=「MinerU 结果查询失败：HTTP 404」，af_pages p3 failed 同因）；**2026-09-21 根仓库侧复核**：5002 容器经 `/models/vision/start` 可拉起、`/health` 200，新键新端口链路就绪；对方回执后关闭 |

### 第四轮主线·探索轮（ARCH-021）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-021 | 主线 | 高 | 待开始 | 第四轮主线：与 Axiom-Flow 联调探索——RAG + 知识图谱 + chat 问答，确保课程效果，成熟后作为课程学习部分（完成一个教程）；learning/ 学习探索同步启动（QED-Engine 独有） | 前置：第三轮主线（ARCH-020）解析效果确认；探索设计见 [design/document-chunking-recall.md](../design/document-chunking-recall.md) |

### 第五轮主线·学习中心轮（ARCH-022）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-022 | 主线 | 高 | 待开始 | 第五轮主线：学习中心轮——用户同步学习，开始知识探索、课程学习和课后练习，直至学完一个教程（学习功能现状文档 2026-09-10-learning-center-current-state.md 启动） | 前置：第四轮主线（ARCH-021）课程内容成熟 |
| REQ-006 | 主线 | 中 | 进行中 | QED-Engine 前端（8903）：主体学习界面 + 后台管理（仪表盘/知识体系/解析进度/文档对照/追溯） | 期次里程碑：三期（ARCH-003，111 passed）→ 四期（ARCH-004，119）→ 五期~十三期（ARCH-005，127→140，a5ce8c1 已验收）→ 十四期（ARCH-006，141，人工评审优化）→ 十五期（ARCH-007，150，文档下载课程分页）；逐期界面细节见 project-status 前端行与 history/plans/；管理后台已随 web-ui React 重构落地（ARCH-011 已实施）；学习中心部分归第五轮主线（ARCH-022）收尾 |
| REQ-031 | 支线 | 低 | 待开始 | 使用手册完善（前端 web-ui）：当前手册（HELP_SECTIONS 迁移六节）内容粗略，待学习中心各功能稳定后逐界面细化（操作截图/分步图文/FAQ 扩充/五阶段流程配图） | 2026-08-16 用户标注：使用手册还不完善，**低优先级**，等后续完善；暂不阻塞前端重构主轮 |
| REQ-033 | 支线 | 低 | 待开始 | 仪表盘整体优化（前端 web-ui）：当前为过渡形态（四服务摘要 + 下载/解析上下大盘），待整个后台服务正常后梳理优化（布局细化、数据源扩充、图表增强，如解析大盘接 parse-jobs 真数据） | 2026-08-16 用户标注：仪表盘具体梳理等整个后台服务正常后再优化，**低优先级**；本轮仅完成四服务摘要/上下布局/去副标题 |

### 设计文档体系重组轮（2026-09-10）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| REQ-070-LEARN | 支线 | 高 | In Progress | [学习功能现状（知识探索/课程学习/课后练习）](../plans/2026-09-10-learning-center-current-state.md) | REQ-070 重组轮 learning-center.md 移入改造的现状承载（知识探索已固定 + 课程学习探索 + 课后练习无设计声明）；设计确定后按 ADR 0011 晋升 design/，本现状壳退役 |

### Agent 开发文档体系轮（2026-09-11）

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| REQ-073 | 支线 | 中 | 待开始 | Agent 标准体系对齐（请求：QED-Tracker）：对齐根仓库 REQ-071 新增的代码规范/存储规范与 AGENTS.md 统一骨架，按本仓库范本适配 standards/ 与标准映射 | QED-Tracker 侧 QED-058 承接；对方回执后关闭 |
| REQ-074 | 支线 | 中 | 待开始 | Agent 标准体系对齐（请求：Axiom-Flow）：同 REQ-073 口径，对齐根仓库标准体系与 AGENTS.md 统一骨架 | Axiom-Flow 侧随 ARCH-020 文档重构同轮对齐；对方回执后关闭 |

### 长期任务

| ID | 类别 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| REQ-062 | 长期 | 中 | 进行中 | **AI 开发指引优化（2026-08-26 登记，同日用户裁决改收件箱机制）**：四段式——① **捕获**：大任务完成后把 agent 利用经验写入 [ai-agent-knowledge-inbox.md](../plans/ai-agent-knowledge-inbox.md)（长期滚动收件箱，不随任务归档；可手动要求补充）；② **审核**：三判据（复用价值/非瞬时状态/未被正式文档覆盖）逐条过，任一不满足不入池；③ **批量晋升触发**：待评审 ≥10 条或单主题聚集 ≥3 条或每月例行（先到为准）；④ **体系优化**：分析轮聚类产出结构性结论，修订正式文档乃至开发流程。首批内容已落 development.md「环境准备（AI 开发速查）」节 | 收件箱已建立 + 首批 1 条待评审（8900 改码后须重启）；持续进行无单一终态；每次入池/晋升后运行 tests/contract 门禁；**2026-09-10 体系优化轮执行**：REQ-069 AI 开发守则整合轮（AGENTS.md 变更分级边界 + development.md 六步流程 + design-bugfix-log 台账，ADR 0012） |
| REQ-002 | 长期 | 中 | 进行中 | 文档治理与同步（**吸收 REQ-021/025，2026-08-16 ARCH-013 合并**）：标准/ADR/计划/台账与契约测试随需求同步更新（ADR 0012 已落地）；README/AGENTS 大变动同步（原 REQ-021）；四类设计文档（架构/API 契约/数据库/技术栈）先文档后实现同步（原 REQ-025） | 每次文档变更前运行 `tests/contract/` 门禁；大变动评审时同步 README/AGENTS |
| REQ-010 | 长期 | 中 | 进行中 | 跨项目协作规范演练：向 Axiom-Flow/QED-Tracker 登记改造请求 todo | 双方回执并关闭其 todo 后完成 |
| REQ-046 | 长期 | 高 | 进行中 | API 接口开发：先确定接口类型，按类型写 API 文档落入各自项目——① QED-Engine 前端无 API（静态页面只连 8900，声明于 [api-contracts](../architecture/api-contracts.md)）；② QED-Engine 后端三类（控制域启停/重启/健康、QED-Tracker 透传及相关处理、Axiom-Flow 透传及相关处理）；③ QED-Tracker 三类（自身生命周期+健康、数据库知识查询传递、LLM 检索课程教程/选书业务）；④ Axiom-Flow 四类（生命周期+健康、数据查询、解析结果与 PDF 对照、未来 RAG/知识图谱预留）；检查是否有遗漏；关联 ARCH-012（全流程跑通 + Axiom-Flow 完成前端验收 + 流程完整走完为止） | 第一步（接口类型确认 + QED-Engine 文档落位）随 ARCH-018 完成（architecture/api-contracts.md 已落位、前端无 API 已声明）；子项目 API 文档经请求由对方执行（Axiom-Flow / QED-Tracker todo 承接）；**2026-08-31 范本化重排**：api-contracts.md 按 QED-Tracker api.md 结构重排（概述分类表 + 逐端点请求/返回/错误 + 统一错误码表），补齐 REQ-067 `/domains/import`、`/domains/{id}/explore`、`/domains/{id}/confirm-name`，删过时注记、修正 8902 契约事实源引用，转正已确认；**2026-09-14 ARCH-020 重构**：Axiom 数据透传组随新契约修订（规划端点见 [交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md)） |
| REQ-047 | 长期 | 高 | 进行中 | 数据库设计：QED-Engine [database-design](../architecture/database-design.md) 为总纲（qed_* 共享表族完整；qt_*/af_* 部分置空，提示先查子项目数据库文档）；QED-Tracker 定义自身完整数据库定义（docs/architecture/database-private-tables.md（qt_*）与 database-shared-tables.md（qed_*）唯一事实源，REQ-026 已回执）；Axiom-Flow 定义 af_* 完整数据库定义（REQ-027 已关闭，2026-09-20），通过文档 + 单独数据库管理体系管理 | QED-Engine 总纲随 ARCH-018 落位（2026-08-20，ADR 0010 版本机制）；子项目数据库文档由各自仓库维护（各项目 Alembic 独立初始化自己的表，qed_* 共享表所有权 QED-Tracker）；**2026-08-31 范本化 + af_* 补登记**：database-design.md 对齐范本骨架（需求方/唯一事实源声明/决策记录），af_* 行刷新为由 Axiom-Flow database-design.md 登记（V2-013 规划契约），关联代码补 qed_llm_calls 建表方，转正已确认；**2026-09-14 ARCH-020 重构**：af_* 重定义为四表（af_books/af_parse_jobs/af_pages/af_block_edits），总纲登记 |
| REQ-050 | 长期 | 中 | 进行中 | 版本更新文档体系重新梳理（2026-08-21 ARCH-018 收尾登记，ADR 0010 版本机制）：每次版本更新（用户确认升版本时）按 ADR 0010 重新梳理三项目文档体系——architecture/ 固定化维护（总体/服务架构/API/数据库/code-map）、guides 操作与开发文档、trackers 主线归并（完成→completed.md）、design 三态梳理、plans 归档、子项目范本对齐跟进（REQ-048/049 同源） | 随 ARCH-018 关闭登记；每次版本末期触发，不单独设排期；子项目对齐经请求由对方执行 |
| OPS-001 | 长期 | 低 | 待开始 | 服务域 stop 对外部实例失效（2026-08-26 两次复现：REQ-061 验证轮 + Phase A 清库轮）：外部启动的 8901 被 POST /services/tracker/stop 时记录 pid=null，杀不到真进程（stop 返回 stopping 但端口仍监听）；需直杀监听 PID 后服务域 start 重新纳管 | 复现条件：8901 非经服务域启动（如手动 python -m uvicorn 或脚本单元启停语义缺陷导致的孤儿进程）；修复方向：stop 前先做端口探测补全 pid 记录（属 8900 控制域代码改动，需排期） |

## 规则

- 任务 ID 使用稳定格式 `前缀-三位序号[-后缀]`（后缀可选，用于子项分组，如 `REQ-070-PARS`）；前缀自然表达任务类型（ARCH=主线实现、REQ=请求、PLAN=计划、DEFECT=缺陷）。
- **类别**只允许 `主线 / 支线 / 长期`：主线 = 大类目标（由活跃计划/大任务承载，聚合多条支线）；
  支线 = 主线任务的细则，可独立完成；长期 = 持续存在、无单一终态的任务。定义与归属原则见
  [任务生命周期](../standards/task-lifecycle.md)。
- 状态只允许 `待开始 / 进行中 / In Progress / Blocked / 已完成`；阻塞必须声明证据、恢复条件
  和责任位置。
- 优先级只允许 `高 / 中 / 低`。
- 涉及子项目改造的请求在根仓库登记并标注目标仓库（`请求：<目标仓库>`），子项目在自己的 todo
  承接；根仓库不直接修改子项目文件（见
  [跨项目协作规范](../standards/cross-project-collaboration.md)）。
- Plan 行镜像 `docs/plans/` 活跃计划正文（标题、链接、状态、关联 Tracker）。
- 任务终态时从本表原子移除并写入 completed.md。
