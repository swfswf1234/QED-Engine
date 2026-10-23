# 代码与设计映射表

设计状态：Accepted
实现状态：Implemented
最后更新：2026-09-23
确认状态：已确认
维护位置：`docs/architecture/code-map.md`
关联代码：受管模块清单
关联测试：`tests/contract/test_code_document_mapping.py`
关联 ADR：`../history/adr/v0.1/0001-root-contract-tests.md`

本表是代码与文档关系的唯一事实源。`__init__.py` 及无业务语义的极短文件豁免；子项目代码不进
入本表，以各自仓库 `docs/architecture/code-map.md` 为准。

## 映射表

### 核心配置

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `backend/qed_engine/config.py` | 统一配置读取 | Current | `docs/design/project-configuration.md` | `tests/test_config.py` | 根 `.env` 唯一事实源（四段式：全局 / API 调用 / 本地模型 / 元数据库），空 key 降级。 |
| `backend/qed_engine/cli.py` | 统一 CLI `qed` | Current | `docs/design/project-configuration.md` | `tests/test_cli.py` | config 子命令、tracker 客户端子命令、服务发现与最小配置尾注。 |

### API 层

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `backend/qed_engine/api/main.py` | 后端 API 入口（三域组装） | Current | `docs/architecture/api-contracts.md` | `tests/test_api.py` | 组装控制域与数据域路由，CORS 8900-8903，state 注入；配置五端点已拆至 control.py。 |
| `backend/qed_engine/api/control.py` | 控制域路由 | Current | `docs/architecture/api-contracts.md` | `tests/test_api.py`、`tests/test_log_viewer.py`、`tests/test_monitor.py`、`tests/test_self_restart.py`、`tests/test_llm_endpoints.py` | /services 端点族 + 配置五端点 + 监控诊断路由 + /models 槽位端点族（PLAN-046 v3：GET 五字段卡数据源 + select 写 source/runtime/active + 按槽位来源 409）+ /llm 网关端点。 |
| `backend/qed_engine/api/schemas.py` | API 请求与响应模型 | Current | `docs/architecture/api-contracts.md` | `tests/test_api.py` | 健康、模型路由、密钥布尔状态、数据库状态与 LLM 可达性；SlotStatus（v3 五字段卡：source/channel/description/availability + 三下拉）、ModelSelectRequest（source/runtime/model）。 |
| `backend/qed_engine/api/tracker.py` | 数据域·QED-Tracker 适配路由 | Current | `docs/architecture/api-contracts.md` | `tests/test_api.py` | catalogs/tasks/三表/论文面契约归 8900，内部经 tracker_client.py 适配 8901。 |
| `backend/qed_engine/api/explore.py` | 数据域·探索会话路由 | Current | `docs/design/downloads-flow.md` | `tests/test_explore_sessions.py` | /explore-sessions 五端点，取代旧 explore-runs 透传。 |
| `backend/qed_engine/api/domain_explore.py` | 数据域·领域探索五态门面路由 | Current | `docs/design/downloads-flow.md` | `tests/test_domain_explore.py` | 五端点委托 8901 原生任务链：task_id 登记、courses.json→课程行桥接、explore_pending 合成与离线降级（PLAN-034 已落地）。 |
| `backend/qed_engine/api/axiom.py` | 数据域·Axiom-Flow 适配路由 | Current | `docs/architecture/api-contracts.md` | `tests/test_api.py` | books/单本详情/PDF 流/pages/manifest/parse-jobs（含 `GET /parse-jobs` 列表透传，前端重开工作台恢复在飞任务）/parsing-tree 契约归 8900，内部经 axiom_client.py 适配 8902；`GET /books/{id}/file` 为 8900 本地端点（af_books.file_path 数据根相对路径 + 边界校验，见 [dataset 目录约定](../design/dataset-conventions.md)）；含 `POST /books/{id}/ingest` 透传 + 块编辑门面 `PUT …/blocks/{i}/edit`/`GET …/pages/{no}/edits`（/review 门面过渡保留）；剩余规划透传 PATCH/DELETE/versions/chunks 见 [api-contracts.md](api-contracts.md) §④ 规划契约。 |
| `backend/qed_engine/api/learn.py` | 学习域路由（8900 自有，非透传） | Current | `docs/architecture/api-contracts.md` | `tests/test_learn.py`、`tests/test_learn_knowledge.py`、`tests/test_learn_practice.py` | /api/v1/learn/* 27 端点（v1.0 三张化后的枚数，ADR 0026 D1~D3/D10）：课程引用式注册（kind 闭集/双通道限长；`learn_course_id` 即共享 `qed_course.course_id`，D4 无独立坐标）、知识点树读面（`GET …/knowledge-points` 的 `sequence` 替掉退役单元端点族）、派生进度只读与落笔（主链 M-1 契约骨架）。含 M5 知识点族与 M6 层级化端点（星图聚合、point 行直登记 `POST /knowledge-points`；outline 整树幂等替换 GET/PUT、point 归属移动 PATCH、`include_outline`/`parent` 过滤）。含 v1.0 长文读腿（`GET /knowledge-points/{kp_id}/narrative` 按 `narrative_ref` 读数据根 `parsed/**`，绝对路径与越根双闸拒）。含 M2 练习与复习端点（题源书目透传、批量入库幂等跳重、题面敏感列投影、作答同事务判分、到期队列、错题本派生查询与人工位）；练习两表由首个练习请求懒挂载。含 REQ-117 W9 注解按需生成端点（`POST …/annotations/generate` 服务端经网关文字槽；条级腿写主表 `angles` 数组追加，D10）与主链 M-3 门与判分 2 端点（`GET …/mastery`、`POST …/mastery/assess`）及 `progress` 门游标扩字段（`mastered`/`next_unit_id`/`provenance`）。门态由本路由把三源汇成：知识点投影行 × `qe_learning` kp 行 × `attempts_by_kp` 作答序列（到期计数由流水重放，四源变三源），规则本体归 `services/learn/mastery.py`；练习腿不可达按零作答派生、不 503（裁决 D-M3-4）。编译端点族／单元端点族／候选池族与点赞腿已随 ADR 0026 退役。 |
| `backend/qed_engine/clients/tracker_client.py` | QED-Tracker 服务客户端 | Current | `docs/design/cross-project-contracts.md` | `tests/test_tracker_client.py` | 8901 HTTP 客户端：资源/任务/三表，transport 可注入。 |
| `backend/qed_engine/clients/axiom_client.py` | Axiom-Flow 服务客户端 | Current | `docs/architecture/api-contracts.md` | `tests/test_api.py` | 8902 HTTP 客户端：books/单本详情(get_book)/ingest_book/pages/manifest/parse-jobs（含列表 list_parse_jobs）/sync/edit（engine/id/progress 对象按 8902 v2 契约；edit_block verdict 可选支持部分修正），transport 可注入；/review 门面内部转 /edit。 |

### 服务层·控制域

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `backend/qed_engine/services/service_manager.py` | 服务控制能力层 | Current | `docs/design/service-hosting.md` | `tests/test_api.py`、`tests/test_self_restart.py`、`tests/test_log_viewer.py` | 注册表/HTTP 探测/Popen 启动/优雅停止/自身重启；`unit_log_path` 解析单元日志实际写入点（脚本托管＝`<workdir>/logs/qed-<name>-serve.log`，ADR 0019）。 |
| `backend/qed_engine/services/log_viewer.py` | 服务日志查看能力 | Current | `docs/architecture/api-contracts.md` | `tests/test_log_viewer.py` | 白名单 tail/keyword；未知服务 LogError→404；路径经 `service_manager.unit_log_path`（不按命名猜测），文件缺失返回空行。 |
| `backend/qed_engine/services/monitor.py` | 组件监控探测 | Current | `docs/architecture/api-contracts.md` | `tests/test_monitor.py` | GPU + 槽位泛化探测（probe_slot：text 探 `QED_MODEL_URL` / vision 探 `QED_OCR_MODEL_URL`（5002）；qwen/mineru 旧函数保留别名）；尽力报告不抛 5xx。 |

### 服务层·数据域

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `backend/qed_engine/services/explore_sessions.py` | 探索会话管理 | Current | `docs/design/downloads-flow.md` | `tests/test_explore_sessions.py` | 内存会话 + 后台线程调 8901 dry-run；状态机 + TTL 2h；失败态落库两侧不对称（领域直写 `explore_pending`，课程只经 8901 在线写、不可达不落库）。 |
| `backend/qed_engine/services/shared_tables.py` | 共享表 exploration_stage 直读写层 | Current | `docs/design/downloads-flow.md` | `tests/test_explore_sessions.py` | 领域/课程 stage 状态流转（8901 在线优先、不可达时降级直写）；`_require_stage` 按表分档校验取值（领域 6 态／课程 5 态，越界抛 `ValueError`）；QED_DB_PASSWORD 未配置时静默跳过。 |
| `backend/qed_engine/services/learn/base.py` | 学习域存储基座（`qe_learning` 单表 DDL+异常+源指纹+MySQL 存储） | Current | `docs/architecture/database-design.md` | `tests/test_learn.py` | `qe_learning` 幂等建表 SQL（v1.0 三张化：单表继承，course 行承载选课与 `config.kp_path` 学习路径、kp 行承载终态与质性门；唯一键 `uq_learning_target (owner, target_kind, target_id)`）与 NotFound/Conflict 异常映射；`MySQLLearnStore`＝MySQL 实现，接口与内存实现同形（公开方法签名由 parity 测试守护），由首个 /learn 课程请求懒挂载（`LEARN_MOUNT_RETRY_SECONDS` 短窗重试，判例 DEFECT-009）。主链 M-3：质性判定四列随 `ensure_tables` 按 information_schema 幂等补列；`progress_rows`（门读入面）与 `assess_qualitative`（判定落笔）与 `set_progress` 各写各列互不覆盖。百分比、结课态、掌握分一律不落列（读时重算）；`qe_course_state`／`qe_unit`／`qe_unit_progress` 三表随 ADR 0026 D1/D2 退出。 |
| `backend/qed_engine/services/learn/memory.py` | 学习域存储内存实现 | Current | `docs/architecture/database-design.md` | `tests/test_learn.py` | InMemoryLearnStore：`qe_learning` 单表接口的进程内实现（契约测试注入 + 生产存储未接入期降级），线程锁保护后台读写。同形承载 M-3 判定面（`progress_rows`/`assess_qualitative`）：勾选只并写终态位，不抹质性判定列。 |
| `backend/qed_engine/services/learn/knowledge.py` | 学习域知识点主表存储（M5/M6 v2 层级化 + v1.0 三列） | Current | `docs/architecture/database-design.md` | `tests/test_learn_knowledge.py` | qed_knowledge_point（第四张共享表=已确认知识点主数据，M6 v2 加 `node_kind`/`parent_kp_id`/`depth`/`book_ref`/`source_ref`，v1.0 加 `aliases`/`narrative_ref`/`angles`（ADR 0026 D5），唯一键 `(course_id, book_ref, norm_key)`）幂等建表、norm_key 规范化去重、星图计数只数 point、`flatten_outline` 前序展开（两级、PDF 页序溯源）、`replace_outline` 同名复用 kp_id、`patch_point` 归属移动（MySQLKnowledgeStore）。候选池 `qe_kp_detail` 与其五枚端点已随 D1/D10 退出，point 行产面平移为 `POST /learn/knowledge-points` 直登记；条级注解落 `angles` 数组追加。 |
| `backend/qed_engine/services/learn/knowledge_memory.py` | 知识点主表存储内存实现 | Current | `docs/architecture/database-design.md` | `tests/test_learn_knowledge.py` | InMemoryKnowledgeStore：与 MySQL 存储层**同形接口**（含 M6 v2 outline/point 层级、`node_kind` 过滤与 v1.0 `aliases`/`narrative_ref`/`angles` 三列），供契约测试注入（隔离铁律不写运行库）。候选池方法与未归档池读面随 D1 退出。 |
| `backend/qed_engine/services/learn/annotations.py` | 学习面注解按需生成腿（取材 prompt＋成品清洗＋章级节流） | Current | `docs/design/llm-gateway.md` | `tests/test_learn.py` | REQ-117 W9／C18 的编排纯函数面：三种用途（章级总结／章级学习要点／条级注解）的 prompt 拼装与限长定档（取材截断、`max_tokens`、限页 12/12/6），`compose` 清洗（去 Markdown 围栏与行首编号、要点 6 条×160 字、总结 1000 字），`generate` 只经 `gateway.call_text(service=learn_annotation)` 一条通道且失败不抛异常（返回 ok/model_ref/reason 供端点转 502），`monotonic` 假钟接缝＋60s 章级节流键位（条级不去重）。不碰数据库、不发网络。 |
| `backend/qed_engine/services/learn/grading.py` | 练习域确定性判分纯函数 | Current | `docs/architecture/api-contracts.md` | `tests/test_learn_practice.py` | M-3 判分接口缝 1 的规则层：闭集三型定档（choice 全等且 expected∈A/B/C/D、short 全等或相似度 ≥0.85 且 expected ≤30 字、open 关键词命中比 ≥0.6），未知型与空 expected 一律判 False 不猜，残余问题记进 `question.meta.issues`；无 LLM 无数据库，`method=llm` 分支不在本文件（缝 3 v1 关闭）。 |
| `backend/qed_engine/services/learn/practice.py` | 练习域两表 MySQL 存储与调度纯函数 | Current | `docs/architecture/database-design.md` | `tests/test_learn_practice.py` | qe_question/qe_attempt 幂等建表 SQL 与 `MySQLPracticeStore`：批量入库 `(course_id,stem_hash)` 跳重、`SENSITIVE_COLUMNS` 投影（缝 2）、到期态由作答流水**读时重放**（`_replay`/`review_due`/`count_review_due`；调度表 `qe_review_task` 整表随 ADR 0026 D3 退出，DeepTutor 档位与升降档序列逐值直译保留为纯函数并按 `kp_type` 取序列表钳位）、`derive_trend`（C1：`score_trend` 读时派生不落列）、`resolve_trend` 不再写 `resolved`（C2：改判纯人工位）、错题本派生查询与统计、到期队列优先级即时派生（错题 1 先于类型档 2~5）；判分回写同事务（缝 6）。主链 M-3 门的两张读入面：`attempts_by_kp`（按知识点给全序作答序列，最近 5 次窗口与置信上限钳制归规则层）与 `due_counts_by_kp`（到期计数按知识点归集，源由调度表改为重放结果；`target_kind='kp'` 空转粒度随 W5 判定退出）。题库列面不加 `owner`（内容跨学习者共享），作答表 `owner` 前缀贯通四枚索引与幂等键 `uq_attempt_idem`。 |
| `backend/qed_engine/services/learn/mastery.py` | 知识点掌握门与推进游标规则层（M-3） | Current | `docs/architecture/api-contracts.md` | `tests/test_learn_mastery.py` | 主链 M-3 规则本体，一比一直译只读参照 DeepTutor（`learning/mastery.py:17,21,24-37`、`learning/policy.py:35-128,206-288`）：近因加权正确率取最近 5 次（权重 `0.5,0.7,0.85,0.95,1.0` 老→新）并按作答次数钳置信上限 `{1:0.5, 2:0.8}`（单次蒙对永不过 0.9 门）；门阈按知识点四分类分流，`memory`/`procedure`＝量化门 0.9、`concept`/`design`＝质性门（显示 1.0），类型缺失按 0.9 量化回落不猜；provenance 双通路 `system`（服务端判定过门）/`learner`（勾选或自评讲清，v1 质性门只有自评位 D-M3-2），`assessed_mastered` 与 `mastered` 分离使自评不得冒充系统判定；推进＝门即游标（到期复习 → 第一个未掌握 → 结课，D-M3-1），pending 态按 M2 壳缝 5 不移植。判分不在本文件（归 `grading.py`，只消费 `is_correct`），分数与结论一律读时派生不落列，无 LLM 无数据库无网络。 |
| `backend/qed_engine/services/learn/practice_memory.py` | 练习域两表内存实现 | Current | `docs/architecture/database-design.md` | `tests/test_learn_practice.py` | InMemoryPracticeStore：与 MySQL 存储层**同形接口**（parity 测试守护），整批构造后落＝原子入库、被拒绝的作答不留痕、时钟由 `now=` 注入（不移植 `time.time()` 直取）；供契约测试注入与存储未接入期降级。调度态同样读时重放（不再有第三份状态，ADR 0026 D3）。两张门读入面同形（`attempts_by_kp`/`due_counts_by_kp`），由 parity 测试守护。 |

### 服务层·LLM 网关

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `backend/qed_engine/services/llm/registry.py` | 模型身份注册表 | Current | `docs/design/llm-gateway.md` | `tests/test_llm_registry.py` | PLAN-046 v3：身份目录（身份→api/本地引用 + description）+ 槽位级来源/渠道运行态（manifest.source/runtime/active）+ 渠道/模型选项派生，gateway/model_manager 统一消费。ARCH-033：Identity.params 加载层参数（runtime→参数组，唯一事实源）+ binding_params 解析注入。A-6（M3）：文字槽位在生效 runtime 无本地引用时不判失败——model 留空 + notes 继承标注（`QED_LLM_LOCAL_ADAPT=false` 回退严格报错，图像槽位不适用）。 |
| `backend/qed_engine/services/llm/gateway.py` | LLM 网关 | Current | `docs/design/llm-gateway.md` | `tests/test_llm_gateway.py`、`tests/test_llm_local_adapt.py` | 文字/视觉/向量统一入口，经注册表解析按 QED_API_SELECT 路由 api/local（local 经单活仲裁拉起）。A-5：success 前过 `classify_reply` 截断/空正文判定，local 正文饥饿按 `reasoning_effort=none` 单次降档重试。A-6：local 文字继承兜底交接——`resolved.model` 空时由 `clients.qwen_chat` 发现式取单活 runtime 已加载模型。 |
| `backend/qed_engine/services/llm/clients.py` | LLM 供应商客户端 | Current | `docs/design/llm-gateway.md` | `tests/test_llm_clients.py` | qwen 文字/视觉、MinerU、provider_embeddings（向量）；httpx transport 可注入。文字调用返回 `ChatReply`（正文 str + `finish_reason`/`reasoning_content`，A-5 判定输入面）。 |
| `backend/qed_engine/services/llm/local_adapt.py` | 本地模型适配层（M3） | Current | `docs/design/llm-gateway.md` | `tests/test_llm_local_adapt.py` | 能力表（本地无工具 / JSON 模式三态）、response_format 注入判定与运行时拉黑、JSON 容错三件套 + 一次 repair、thinking 清洗、A-5 `classify_reply` 截断判定与饥饿口径；开关 `QED_LLM_LOCAL_ADAPT`。 |
| `backend/qed_engine/services/llm/model_manager.py` | 本地模型服务维护（启停与单活仲裁） | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | PLAN-046 v3：ensure_local_ready(slot) 单活仲裁（槽位渠道 manifest.runtime > 全局默认）；operate_model 槽位化 + qwen/mineru 旧名别名。ARCH-028 增强批：start/restart 派发经 note_starting_active 置启动宽限窗口（W7）；启动关键段进程级锁串行化（DEFECT-005，双槽位并发恢复不再绕过单活互斥）。 |
| `backend/qed_engine/services/llm/runtimes/base.py` | 本地 runtime 基座 | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | PLAN-046：LocalRuntime 协议（probe/start/stop，start 带 params 关键字）+ RuntimeResult + 脚本型基类（llamacpp/docker 复用 scripts/ 生命周期脚本；extra_start_args 钩子注入参数旗标）。 |
| `backend/qed_engine/services/llm/runtimes/lmstudio.py` | LM Studio 半托管 runtime | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | PLAN-046 + W7 实测：probe=REST v0 `state=loaded`；start=lms server start + `lms load`（ARCH-033：按身份 params 带 `-c/--gpu/--parallel/--ttl`，缺省 `--gpu max` 不变；先卸载其他已加载；5001 被 llama-server 占位时脚本 stop 反向清位，裁决 R3）；stop=`lms unload`（server 保留）；端点 `QED_MODEL_URL`；探活经 QED_LMSTUDIO_TOKEN 带认证。 |
| `backend/qed_engine/services/llm/runtimes/llamacpp.py` | llamacpp runtime | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | ARCH-033 真做：llama-server 生命周期复用 text-model 脚本（端点 `QED_MODEL_URL`，与 LM Studio 共用 5001）；身份表已挂 llamacpp GGUF 引用（~/.lmstudio/models 相对）+ 加载参数；启动前探测常驻 LM Studio server 占位 → 自动 `lms unload --all` + `lms server stop` 让位（裁决 R3；W7 真机修正：单独 stop 不释放 worker 显存）。 |
| `backend/qed_engine/services/llm/runtimes/docker.py` | docker runtime | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | PLAN-046：MinerU 容器生命周期复用 image-model 脚本（infra-*.ps1）；端点 `QED_OCR_MODEL_URL`（5002）；vision 槽位默认 runtime。 |
| `backend/qed_engine/services/llm/supervisor.py` | 本地模型服务维护·健康监督 | Current | `docs/design/local-model-management.md` | `tests/test_llm_supervisor.py` | ARCH-028 W2：T1（probe_slot）+T2（容器内 nvidia-smi，fail-closed）分级探测、ready/degraded/down 状态机 N=3 防抖、翻转事件日志，供 /models/{slot} health_* 字段与仪表盘状况卡消费；`QED_MODEL_SUPERVISOR` 默认开。W3 受控恢复：非就绪退避节拍（每 4 tick≈2min）派发 restart、≤3 次转纯告警、ready 翻转重置；在飞门双路（REQ-088 列表端点，旧码回退 active_job_id；8902 离线放行/查询失败保守在飞）；非就绪翻转采掉线诊断包（docker events+日志尾+GPU+inspect OOMKilled/ExitCode/RestartCount，W10 补强）。W7/W8 启动宽限与恢复闩锁：operate_model start/restart 派发后窗口内（QED_MODEL_START_GRACE_SECONDS 默认 180s）down/degraded 观测抑制、恢复 tick 冻结（不叠发第二发），翻回 ready 或期满解锁，期满转正常防抖；快照以 health_state=starting 呈现（仪表盘「启动中」）。只维护模型服务本身，不涉及 prompt。 |
| `backend/qed_engine/services/llm/call_log.py` | LLM 调用记录 | Current | `docs/design/llm-gateway.md` | `tests/test_llm_call_log.py` | qed_llm_calls 幂等建表/写入/分页检索；DB 不可达降级。 |

### 测试·根目录

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `tests/test_config.py` | 配置读取单元测试 | Current | `docs/design/project-configuration.md` | — | 默认值与空值降级。 |
| `tests/test_cli.py` | 统一 CLI 契约测试 | Current | `docs/design/project-configuration.md` | — | 子命令、服务地址与尾注提醒。 |
| `tests/test_tracker_client.py` | QED-Tracker 客户端契约测试 | Current | `docs/design/cross-project-contracts.md` | — | 方法/路径/请求体、错误响应与任务轮询。 |
| `tests/test_learn.py` | 学习域契约测试 | Current | `docs/architecture/api-contracts.md` | — | 53 例（27 端点）：v1.0 三表口径的选课行（D4 引用共享 `qed_course.course_id`、D7 `owner` 不出契约面）、kp 行终态位与质性门四列分居两通路（`pending` 撤销无判定痕迹即删行）、推进序列＝主表 point 行读时投影（派生键 `kp:{kp_id}`、零物化）、按需生成腿的章行覆写与条级 `angles` 追加（D10）、三域存储懒挂载窗口（判例 DEFECT-009）。主链 M-3 W3：门态清单与质性判定两端点契约、`progress` 门游标扩字段、练习腿不可达的零作答降级。编译族／单元树族／候选池族用例随 D1/D2 删除。 |
| `tests/test_learn_knowledge.py` | 学习域知识点（M5）契约测试 | Current | `docs/architecture/api-contracts.md` | — | 48 例（8 端点）：星图聚合形状与跨 track 边、norm_key 规范化去重、point 行直登记（候选池族退役后的唯一产面，D10）、归属移动与 outline 整树幂等替换、v1.0 三列（`aliases`/`narrative_ref`/`angles`）读写通路、长文指针的数据根越根与绝对路径双闸拒绝、存储未接入 503；`qe_kp_detail` 与其五枚端点退场的判退断言。 |
| `tests/test_learn_practice.py` | 学习域练习与复习（ADR 0026 后两表）契约测试 | Current | `docs/architecture/api-contracts.md` | — | 48 例（8 端点）：批量入库幂等与闭集/不变量 422、题面敏感列投影（缝 2）、人工面白名单、作答同事务判分（缝 6）、到期复习**由流水重放**（`schedule_next` 升降档/钳位 + `replay_due`；调度表 `qe_review_task` 与 `target_kind='kp'` 粒度退场，档位与到期队列逐档守护）、错题本派生查询与统计、题源书目 roles 过滤、`owner` 幂等键与索引前缀（D7）、`score_trend` 读时派生（D9-C1）与 `resolved` 纯人工位（D9-C2）、两实现同形与 503 降级。 |
| `tests/test_learn_mastery.py` | 主链 M-3 门与判分规则层单测 | Current | `docs/architecture/api-contracts.md` | — | 19 例纯函数契约：空序列 0.0／单次与两次置信上限／三次方可过门／最近 5 次窗口滑动／权重老→新递增，门阈按四分类分流与空型回落 0.9，质性门类型 refusal，门态行三态与 `system`/`learner` provenance 分离（勾选不冒充判定），门即游标的到期复习→第一个未掌握→结课优先级与三态计数。不依赖 LLM、网络与数据库。 |
| `tests/test_api.py` | 配置中心 API 契约测试 | Current | `docs/architecture/api-contracts.md` | — | 密钥值不泄露。 |
| `tests/test_web.py` | 8903 前端契约测试 | Current | `docs/architecture/frontend-architecture.md` | — | serve_web.py + web-ui/src 源码契约。 |
| `tests/test_log_viewer.py` | 日志查看契约测试 | Current | `docs/architecture/api-contracts.md` | — | 白名单/tail/keyword/越权/编码容错。 |
| `tests/test_monitor.py` | 组件监控契约测试 | Current | `docs/architecture/api-contracts.md` | — | GPU / 文字模型（QED_MODEL_URL）/ MinerU（5002）各分支。 |
| `tests/test_self_restart.py` | 自身重启契约测试 | Current | `docs/architecture/api-contracts.md` | — | 延迟 spawn/失败语义。 |
| `tests/test_explore_sessions.py` | 探索会话契约测试 | Current | `docs/design/downloads-flow.md` | — | 五端点/状态机/apply 双链路/TTL。 |
| `tests/test_domain_explore.py` | 领域探索五态门面契约测试 | Current | `docs/design/downloads-flow.md` | — | 五端点：原生任务提交/透传/桥接/降级/状态合成。 |
| `tests/test_qed_web_service.py` | 8903 前端生命周期脚本契约测试 | Current | `docs/design/service-hosting.md` | — | PID 文件/serve 命令/health 端口/停止三形（真停·未纳管端口在听退出码 3·停不住 1）与 restart 见非 0 中止。 |
| `tests/test_qed_engine_service.py` | 8900 后端生命周期脚本契约测试 | Current | `docs/design/llm-gateway.md` | — | PID/serve/health/--mode/子命令/停止三形（同 8903 脚本口径，DEFECT-020）。 |
| `tests/test_qed_qwen_service.py` | 本地文字模型脚本契约测试 | Current | `docs/design/llm-gateway.md` | — | lms CLI 启停/健康探测/子命令。 |
| `tests/test_qed_mineru_service.py` | 本地图像模型脚本契约测试 | Current | `docs/design/llm-gateway.md` | — | infra-*.ps1 编排/健康探测/子命令。 |
| `tests/test_llm_gateway.py` | LLM 网关契约测试 | Current | `docs/design/llm-gateway.md` | — | api/local 路由、调用记录字段。 |
| `tests/test_llm_local_adapt.py` | M3 适配层契约测试 | Current | `docs/design/llm-gateway.md` | — | 能力表、response_format 注入/拉黑/剥参数重试、JSON 三件套与修复回调、scratchpad 清洗、A-5 截断与空正文判失败 + 饥饿降档单次重试（假 client，不触网）。 |
| `tests/test_llm_clients.py` | LLM 供应商客户端契约测试 | Current | `docs/design/llm-gateway.md` | — | qwen 文字/视觉、Qwen、MinerU；`ChatReply` 截断判据抽取与 `reasoning_effort` 入请求体。 |
| `tests/test_llm_model_manager.py` | 本地模型资源互斥契约测试 | Current | `docs/design/local-model-management.md` | — | api 模式不启本地模型/互斥；operate_model 端点路径（start/stop/restart）。 |
| `tests/test_llm_registry.py` | 模型身份注册表契约测试 | Current | `docs/design/llm-gateway.md` | — | 身份目录覆盖、来源/渠道/身份三级运行态优先级、渠道与模型选项派生、api/local 解析与回退。 |
| `tests/test_llm_call_log.py` | LLM 调用记录契约测试 | Current | `docs/design/llm-gateway.md` | — | 建表 SQL、写入字段、分页检索。 |
| `tests/test_llm_endpoints.py` | LLM 网关端点契约测试 | Current | `docs/design/llm-gateway.md` | — | /llm/text、/llm/vision、/llm/test/* 端点。 |
| `tests/test_llm_supervisor.py` | 本地模型监督器契约测试 | Current | `docs/design/local-model-management.md` | — | 分级探测定态/防抖翻转事件/退避恢复≤3 在飞门双路/W12 期望状态（人工停止不复活、api 暂停清位）/诊断包异常不阻断。 |
| `tests/conftest.py` | 根测试基座（autouse 打桩） | Current | `docs/architecture/api-contracts.md` | — | probe_pdh/monitor.subprocess.run 打桩，隔离真实 PowerShell 调用与测试污染。 |

### 测试·契约

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `tests/contract/test_standard_governance.py` | 标准治理测试 | Current | `docs/standards/doc-governance.md` | — | 守护标准目录、元数据、索引与 AGENTS 路由。 |
| `tests/contract/test_adr_governance.py` | ADR 治理测试 | Current | `docs/standards/adr-governance.md` | — | 守护编号、登记表、元数据与取代关系。 |
| `tests/contract/test_plan_governance.py` | 计划治理测试 | Current | `docs/standards/task-lifecycle.md` | — | 守护计划命名、元数据与索引边界。 |
| `tests/contract/test_tracker_governance.py` | 台账治理测试 | Current | `docs/standards/task-lifecycle.md` | — | 守护任务 ID、计划镜像与路线图。 |
| `tests/contract/test_doc_test_id_alignment.py` | 文档-测试正则对齐测试 | Current | `docs/standards/task-lifecycle.md` | — | 守护 task-lifecycle.md 中 TASK_ID 正则与契约测试中的正则一致，防止 doc/test 漂移。 |
| `tests/contract/test_document_structure.py` | 文档结构测试 | Current | `docs/standards/doc-governance.md` | — | 守护目录入口与 Agent 协议。 |
| `tests/contract/test_markdown_links.py` | Markdown 链接测试 | Current | `docs/standards/doc-governance.md` | — | 本地相对链接可解析。 |
| `tests/contract/test_api_endpoint_inventory.py` | 端点清单一致性测试 | Current | `docs/standards/code-document-traceability.md` | — | 守护 api-contracts 端点清单与 api/ 路由文件双向一致（占位符归一、并集展开）。 |
| `tests/contract/test_architecture_documents.py` | 架构文档语义测试 | Current | `docs/standards/code-document-traceability.md` | — | 守护架构元数据与 Mermaid 视图。 |
| `tests/contract/test_design_documents.py` | 设计文档语义测试 | Current | `docs/standards/code-document-traceability.md` | — | 守护设计元数据与索引。 |
| `tests/contract/test_code_document_mapping.py` | 映射一致性测试 | Current | `docs/standards/code-document-traceability.md` | — | 守护本表和文件头。 |
| `tests/contract/test_test_suite_governance.py` | 测试套件治理测试 | Current | `docs/standards/testing.md` | — | 守护测试目录边界与分层。 |
| `tests/contract/test_cross_project_collaboration.py` | 跨项目协作治理测试 | Current | `docs/standards/cross-project-collaboration.md` | — | 守护根台账与子项目请求登记。 |
| `tests/contract/test_code_standards_governance.py` | 代码规范治理测试 | Current | `docs/standards/code-standards.md` | — | 守护代码规范与 ruff / tsconfig / AGENTS 强制约束一致。 |
| `tests/contract/test_storage_conventions_governance.py` | 存储规范治理测试 | Current | `docs/standards/storage-conventions.md` | — | 守护存储规范与 dataset 设计 / doc-governance / .gitignore 一致。 |
