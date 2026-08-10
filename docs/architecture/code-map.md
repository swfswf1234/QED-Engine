# 代码与设计映射表

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-11
维护位置：`docs/architecture/code-map.md`
关联代码：受管模块清单
关联测试：`tests/contract/test_code_document_mapping.py`
关联 ADR：`docs/adr/0001-root-contract-tests.md`

本表是代码与文档关系的唯一事实源。`__init__.py` 及无业务语义的极短文件豁免；子项目代码不进
入本表，以各自仓库 `docs/architecture/code-map.md` 为准。

| 代码路径 | 层级/职责 | 状态 | 设计关联 | 关联测试 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `backend/qed_engine/config.py` | 统一配置读取 | Current | `docs/design/configuration-and-secrets.md` | `tests/test_config.py` | 根 `.env` 唯一事实源，空 key 降级。 |
| `backend/qed_engine/cli.py` | 统一 CLI `qed` | Current | `docs/design/configuration-and-secrets.md` | `tests/test_cli.py` | config 子命令、tracker 客户端子命令、服务发现与最小配置尾注。 |
| `backend/qed_engine/tracker_client.py` | QED-Tracker 服务客户端 | Current | `docs/design/service-contracts.md` | `tests/test_tracker_client.py` | 8901 HTTP 客户端：资源/任务/确认-拒绝-验收，transport 可注入。 |
| `backend/qed_engine/api/main.py` | QED-Engine 后端 API 入口 | Current | `docs/design/config-center-api.md` | `tests/test_api.py` | 配置域五接口（health/模型/密钥/数据库/llm-status），密钥不下发，CORS 允许 8900-8903；llm-status 真实探测 LLM 可达性（5s 超时、60s 缓存）；database 真实连接探测（pymysql 3s 超时、60s 缓存）；数据域路由（data.py）与服务域路由（service_manager.py）接入（ADR 0007）。 |
| `backend/qed_engine/api/schemas.py` | API 请求与响应模型 | Current | `docs/design/config-center-api.md` | `tests/test_api.py` | 健康、模型路由、密钥布尔状态、数据库状态（含可达性）与 LLM 可达性。 |
| `backend/qed_engine/api/data.py` | 数据域语义 API | Current | `docs/design/config-center-api.md` | `tests/test_api.py` | catalogs/resources/tasks 契约归 8900（ADR 0007），内部适配 8901；4xx 透传、其余 503；PDF 预览流转发。 |
| `backend/qed_engine/api/service_manager.py` | 服务控制（控制中心） | Current | `docs/design/service-control.md` | `tests/test_api.py` | /services 启停托管：注册表/HTTP 探测（3s）/Popen 启动/CTRL_BREAK 优雅停止+taskkill 强杀/15s 过渡窗口；config 单元不可自停。 |
| `tests/test_config.py` | 配置读取单元测试 | Current | `docs/design/configuration-and-secrets.md` | — | 默认值与空值降级。 |
| `tests/test_cli.py` | 统一 CLI 契约测试 | Current | `docs/design/configuration-and-secrets.md` | — | 子命令、服务地址与尾注提醒。 |
| `tests/test_tracker_client.py` | QED-Tracker 客户端契约测试 | Current | `docs/design/service-contracts.md` | — | 方法/路径/请求体、错误响应与任务轮询。 |
| `tests/test_web.py` | QED-Engine 前端静态页契约测试 | Current | `docs/design/web-frontend.md` | — | 守护 web/ 三文件、hash 路由（#/admin 等）、主界面/后台入口文本、端点引用与响应式断点。 |
| `tests/test_api.py` | 配置中心 API 契约测试 | Current | `docs/design/config-center-api.md` | — | 密钥值不泄露。 |
| `tests/contract/test_standard_governance.py` | 标准治理测试 | Current | `docs/standards/documentation.md` | — | 守护标准目录、元数据、索引与 AGENTS 路由。 |
| `tests/contract/test_adr_governance.py` | ADR 治理测试 | Current | `docs/standards/adr-governance.md` | — | 守护编号、登记表、元数据与取代关系。 |
| `tests/contract/test_plan_governance.py` | 计划治理测试 | Current | `docs/standards/task-lifecycle.md` | — | 守护计划命名、元数据与索引边界。 |
| `tests/contract/test_tracker_governance.py` | 台账治理测试 | Current | `docs/standards/task-lifecycle.md` | — | 守护任务 ID、计划镜像与路线图。 |
| `tests/contract/test_document_structure.py` | 文档结构测试 | Current | `docs/standards/documentation.md` | — | 守护目录入口与 Agent 协议。 |
| `tests/contract/test_markdown_links.py` | Markdown 链接测试 | Current | `docs/standards/documentation.md` | — | 本地相对链接可解析。 |
| `tests/contract/test_architecture_documents.py` | 架构文档语义测试 | Current | `docs/standards/code-document-traceability.md` | — | 守护架构元数据与 Mermaid 视图。 |
| `tests/contract/test_design_documents.py` | 设计文档语义测试 | Current | `docs/standards/code-document-traceability.md` | — | 守护设计元数据与索引。 |
| `tests/contract/test_code_document_mapping.py` | 映射一致性测试 | Current | `docs/standards/code-document-traceability.md` | — | 守护本表和文件头。 |
| `tests/contract/test_test_suite_governance.py` | 测试套件治理测试 | Current | `docs/standards/testing.md` | — | 守护测试目录边界与分层。 |
| `tests/contract/test_cross_project_collaboration.py` | 跨项目协作治理测试 | Current | `docs/standards/cross-project-collaboration.md` | — | 守护根台账与子项目请求登记。 |
