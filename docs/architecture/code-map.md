# 代码与设计映射表

设计状态：Accepted
实现状态：Implemented
最后更新：2026-09-14
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
| `backend/qed_engine/api/tracker.py` | 数据域·QED-Tracker 适配路由 | Current | `docs/architecture/api-contracts.md` | `tests/test_api.py` | catalogs/tasks/三表契约归 8900，内部经 tracker_client.py 适配 8901。 |
| `backend/qed_engine/api/explore.py` | 数据域·探索会话路由 | Current | `docs/design/downloads-flow.md` | `tests/test_explore_sessions.py` | /explore-sessions 五端点，取代旧 explore-runs 透传。 |
| `backend/qed_engine/api/domain_explore.py` | 数据域·领域探索五态门面路由 | Current | `docs/design/downloads-flow.md` | `tests/test_domain_explore.py` | 五端点委托 8901 原生任务链：task_id 登记、courses.json→课程行桥接、explore_pending 合成与离线降级（PLAN-034 已落地）。 |
| `backend/qed_engine/api/axiom.py` | 数据域·Axiom-Flow 适配路由 | Current | `docs/architecture/api-contracts.md` | `tests/test_api.py` | books/单本详情/PDF 流/pages/manifest/parse-jobs/parsing-tree 契约归 8900，内部经 axiom_client.py 适配 8902；`GET /books/{id}/file` 为 8900 本地端点（af_books.file_path 数据根相对路径 + 边界校验，见 [dataset 目录约定](../design/dataset-conventions.md)）；ARCH-020-D 已实施 `POST /books/{id}/ingest` 透传 + 块编辑门面 `PUT …/blocks/{i}/edit`/`GET …/pages/{no}/edits`（/review 门面过渡保留）；剩余 PATCH/DELETE/chunks 见 [交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md）。 |
| `backend/qed_engine/clients/tracker_client.py` | QED-Tracker 服务客户端 | Current | `docs/design/cross-project-contracts.md` | `tests/test_tracker_client.py` | 8901 HTTP 客户端：资源/任务/三表，transport 可注入。 |
| `backend/qed_engine/clients/axiom_client.py` | Axiom-Flow 服务客户端 | Current | `docs/architecture/api-contracts.md` | `tests/test_api.py` | 8902 HTTP 客户端：books/单本详情(get_book)/ingest_book/pages/manifest/parse-jobs/sync/edit（engine/id/progress 对象按 8902 v2 契约；edit_block verdict 可选支持部分修正），transport 可注入；/review 门面内部转 /edit，ARCH-020-D 前端已直连 /edit。 |

### 服务层·控制域

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `backend/qed_engine/services/service_manager.py` | 服务控制能力层 | Current | `docs/design/service-hosting.md` | `tests/test_api.py`、`tests/test_self_restart.py` | 注册表/HTTP 探测/Popen 启动/优雅停止/自身重启。 |
| `backend/qed_engine/services/log_viewer.py` | 服务日志查看能力 | Current | `docs/architecture/api-contracts.md` | `tests/test_log_viewer.py` | 白名单 tail/keyword；未知服务 LogError→404。 |
| `backend/qed_engine/services/monitor.py` | 组件监控探测 | Current | `docs/architecture/api-contracts.md` | `tests/test_monitor.py` | GPU + 槽位泛化探测（probe_slot：text 探 `QED_MODEL_URL` / vision 探 `QED_OCR_MODEL_URL`（5002）；qwen/mineru 旧函数保留别名）；尽力报告不抛 5xx。 |

### 服务层·数据域

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `backend/qed_engine/services/explore_sessions.py` | 探索会话管理 | Current | `docs/design/downloads-flow.md` | `tests/test_explore_sessions.py` | 内存会话 + 后台线程调 8901 dry-run；状态机 + TTL 2h。 |
| `backend/qed_engine/services/shared_tables.py` | 共享表 exploration_stage 直读写层 | Current | `docs/design/downloads-flow.md` | `tests/test_explore_sessions.py` | 领域/课程 stage 状态流转；QED_DB_PASSWORD 未配置时静默跳过。 |

### 服务层·LLM 网关

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `backend/qed_engine/services/llm/registry.py` | 模型身份注册表 | Current | `docs/design/llm-gateway.md` | `tests/test_llm_registry.py` | PLAN-046 v3：身份目录（身份→api/本地引用 + description）+ 槽位级来源/渠道运行态（manifest.source/runtime/active）+ 渠道/模型选项派生，gateway/model_manager 统一消费。 |
| `backend/qed_engine/services/llm/gateway.py` | LLM 网关 | Current | `docs/design/llm-gateway.md` | `tests/test_llm_gateway.py` | 文字/视觉/向量统一入口，经注册表解析按 QED_API_SELECT 路由 api/local（local 经单活仲裁拉起）。 |
| `backend/qed_engine/services/llm/clients.py` | LLM 供应商客户端 | Current | `docs/design/llm-gateway.md` | `tests/test_llm_clients.py` | qwen 文字/视觉、MinerU、provider_embeddings（向量）；httpx transport 可注入。 |
| `backend/qed_engine/services/llm/model_manager.py` | 本地模型资源管理（单活仲裁） | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | PLAN-046 v3：ensure_local_ready(slot) 单活仲裁（槽位渠道 manifest.runtime > 全局默认）；operate_model 槽位化 + qwen/mineru 旧名别名。 |
| `backend/qed_engine/services/llm/runtimes/base.py` | 本地 runtime 基座 | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | PLAN-046：LocalRuntime 协议（probe/start/stop）+ RuntimeResult + 脚本型基类（llamacpp/docker 复用 scripts/ 生命周期脚本）。 |
| `backend/qed_engine/services/llm/runtimes/lmstudio.py` | LM Studio 半托管 runtime | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | PLAN-046 + W7 实测：probe=REST v0 `state=loaded`；start=lms server start + `lms load --gpu max`（先卸载其他已加载）；stop=`lms unload`（server 保留）；端点 `QED_MODEL_URL`；探活经 QED_LMSTUDIO_TOKEN 带认证。 |
| `backend/qed_engine/services/llm/runtimes/llamacpp.py` | llamacpp runtime | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | PLAN-046：llama-server 生命周期复用 text-model 脚本（端点 `QED_MODEL_URL`）；身份目录暂无 llamacpp 引用（预留，加引用即接通）。 |
| `backend/qed_engine/services/llm/runtimes/docker.py` | docker runtime | Current | `docs/design/local-model-management.md` | `tests/test_llm_model_manager.py` | PLAN-046：MinerU 容器生命周期复用 image-model 脚本（infra-*.ps1）；端点 `QED_OCR_MODEL_URL`（5002）；vision 槽位默认 runtime。 |
| `backend/qed_engine/services/llm/call_log.py` | LLM 调用记录 | Current | `docs/design/llm-gateway.md` | `tests/test_llm_call_log.py` | qed_llm_calls 幂等建表/写入/分页检索；DB 不可达降级。 |

### 测试·根目录

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `tests/test_config.py` | 配置读取单元测试 | Current | `docs/design/project-configuration.md` | — | 默认值与空值降级。 |
| `tests/test_cli.py` | 统一 CLI 契约测试 | Current | `docs/design/project-configuration.md` | — | 子命令、服务地址与尾注提醒。 |
| `tests/test_tracker_client.py` | QED-Tracker 客户端契约测试 | Current | `docs/design/cross-project-contracts.md` | — | 方法/路径/请求体、错误响应与任务轮询。 |
| `tests/test_api.py` | 配置中心 API 契约测试 | Current | `docs/architecture/api-contracts.md` | — | 密钥值不泄露。 |
| `tests/test_web.py` | 8903 前端契约测试 | Current | `docs/architecture/frontend-architecture.md` | — | serve_web.py + web-ui/src 源码契约。 |
| `tests/test_log_viewer.py` | 日志查看契约测试 | Current | `docs/architecture/api-contracts.md` | — | 白名单/tail/keyword/越权/编码容错。 |
| `tests/test_monitor.py` | 组件监控契约测试 | Current | `docs/architecture/api-contracts.md` | — | GPU / 文字模型（QED_MODEL_URL）/ MinerU（5002）各分支。 |
| `tests/test_self_restart.py` | 自身重启契约测试 | Current | `docs/architecture/api-contracts.md` | — | 延迟 spawn/失败语义。 |
| `tests/test_explore_sessions.py` | 探索会话契约测试 | Current | `docs/design/downloads-flow.md` | — | 五端点/状态机/apply 双链路/TTL。 |
| `tests/test_domain_explore.py` | 领域探索五态门面契约测试 | Current | `docs/design/downloads-flow.md` | — | 五端点：原生任务提交/透传/桥接/降级/状态合成。 |
| `tests/test_qed_web_service.py` | 8903 前端生命周期脚本契约测试 | Current | `docs/design/service-hosting.md` | — | PID 文件/serve 命令/health 端口。 |
| `tests/test_qed_engine_service.py` | 8900 后端生命周期脚本契约测试 | Current | `docs/design/llm-gateway.md` | — | PID/serve/health/--mode/子命令。 |
| `tests/test_qed_qwen_service.py` | 本地文字模型脚本契约测试 | Current | `docs/design/llm-gateway.md` | — | lms CLI 启停/健康探测/子命令。 |
| `tests/test_qed_mineru_service.py` | 本地图像模型脚本契约测试 | Current | `docs/design/llm-gateway.md` | — | infra-*.ps1 编排/健康探测/子命令。 |
| `tests/test_llm_gateway.py` | LLM 网关契约测试 | Current | `docs/design/llm-gateway.md` | — | api/local 路由、调用记录字段。 |
| `tests/test_llm_clients.py` | LLM 供应商客户端契约测试 | Current | `docs/design/llm-gateway.md` | — | qwen 文字/视觉、Qwen、MinerU。 |
| `tests/test_llm_model_manager.py` | 本地模型资源互斥契约测试 | Current | `docs/design/local-model-management.md` | — | api 模式不启本地模型/互斥；operate_model 端点路径（start/stop/restart）。 |
| `tests/test_llm_registry.py` | 模型身份注册表契约测试 | Current | `docs/design/llm-gateway.md` | — | 身份目录覆盖、来源/渠道/身份三级运行态优先级、渠道与模型选项派生、api/local 解析与回退。 |
| `tests/test_llm_call_log.py` | LLM 调用记录契约测试 | Current | `docs/design/llm-gateway.md` | — | 建表 SQL、写入字段、分页检索。 |
| `tests/test_llm_endpoints.py` | LLM 网关端点契约测试 | Current | `docs/design/llm-gateway.md` | — | /llm/text、/llm/vision、/llm/test/* 端点。 |
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
