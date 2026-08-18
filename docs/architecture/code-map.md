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
| `backend/qed_engine/clients/tracker_client.py` | QED-Tracker 服务客户端（数据域适配） | Current | `docs/design/service-contracts.md` | `tests/test_tracker_client.py` | 8901 HTTP 客户端：资源/任务/三表，transport 可注入。 |
| `backend/qed_engine/clients/axiom_client.py` | Axiom-Flow 服务客户端（数据域适配） | Current | `docs/design/config-center-api.md` | `tests/test_api.py` | 8902 HTTP 客户端：books/pages/manifest/parse-jobs 五端点，transport 可注入；错误映射 4xx 透传、连接失败 AxiomError。8902 契约草案事实源在 Axiom-Flow 子仓库 `docs/design/8902-integration-contract.md`。 |
| `backend/qed_engine/api/main.py` | QED-Engine 后端 API 入口（三域组装） | Current | `docs/design/config-center-api.md` | `tests/test_api.py` | 组装控制域（control.py）与数据域（tracker.py / axiom.py）路由，CORS 允许 8900-8903，state 注入 settings/tracker_client/axiom_client/缓存；配置五端点已拆至 control.py（ARCH-012 轮）。 |
| `backend/qed_engine/api/control.py` | 控制域路由 | Current | `docs/design/config-center-api.md` | `tests/test_api.py`、`tests/test_log_viewer.py`、`tests/test_monitor.py`、`tests/test_self_restart.py` | /services 端点族 + 配置五端点 + 监控诊断路由；ServiceError → HTTP 映射，缓存走 app.state。 |
| `backend/qed_engine/api/schemas.py` | API 请求与响应模型 | Current | `docs/design/config-center-api.md` | `tests/test_api.py` | 健康、模型路由、密钥布尔状态、数据库状态（含可达性）与 LLM 可达性。 |
| `backend/qed_engine/api/tracker.py` | 数据域·QED-Tracker 适配路由 | Current | `docs/design/config-center-api.md` | `tests/test_api.py` | catalogs/tasks/三表语义契约归 8900（ADR 0007），内部经 clients/tracker_client.py 适配 8901；4xx 透传、其余 503。 |
| `backend/qed_engine/api/axiom.py` | 数据域·Axiom-Flow 适配路由 | Current | `docs/design/config-center-api.md` | `tests/test_api.py` | books/pages/manifest/parse-jobs 契约归 8900（ADR 0007），内部经 clients/axiom_client.py 适配 8902；4xx 透传、连接失败 503（独立性铁律）。8902 契约草案事实源在 Axiom-Flow 子仓库 `docs/design/8902-integration-contract.md`。 |
| `backend/qed_engine/services/service_manager.py` | 服务控制能力层（控制域） | Current | `docs/design/service-control.md` | `tests/test_api.py`、`tests/test_self_restart.py` | 注册表（config/tracker/axiom/web，后三者经生命周期脚本）/HTTP 探测（3s）/Popen 启动（仅 config 自身重启用）/CTRL_BREAK 优雅停止+taskkill 强杀/15s 过渡窗口/自身重启（延迟 spawn）；无路由，抛 ServiceError。 |
| `backend/qed_engine/services/log_viewer.py` | 服务日志查看能力（控制域） | Current | `docs/design/config-center-api.md` | `tests/test_log_viewer.py` | 白名单（注册表 log_name）tail/keyword；未知服务 LogError→404；UTF-8 容错。 |
| `backend/qed_engine/services/monitor.py` | 组件监控探测（控制域） | Current | `docs/design/config-center-api.md` | `tests/test_monitor.py` | GPU（nvidia-smi 解析）/LM Studio（/v1/models）/mineru（8002 健康）；尽力报告不抛 5xx。 |
| `tests/test_log_viewer.py` | 日志查看契约测试 | Current | `docs/design/config-center-api.md` | — | 白名单/tail 上限/keyword/越权/编码容错 + /logs 路由。 |
| `tests/test_monitor.py` | 组件监控契约测试 | Current | `docs/design/config-center-api.md` | — | GPU/LM Studio/mineru 各分支与路由。 |
| `tests/test_self_restart.py` | 自身重启契约测试 | Current | `docs/design/config-center-api.md` | — | 延迟 spawn/失败语义//services 语义不变。 |
| `tests/test_config.py` | 配置读取单元测试 | Current | `docs/design/configuration-and-secrets.md` | — | 默认值与空值降级。 |
| `tests/test_cli.py` | 统一 CLI 契约测试 | Current | `docs/design/configuration-and-secrets.md` | — | 子命令、服务地址与尾注提醒。 |
| `tests/test_tracker_client.py` | QED-Tracker 客户端契约测试 | Current | `docs/design/service-contracts.md` | — | 方法/路径/请求体、错误响应与任务轮询。 |
| `tests/test_web.py` | 8903 前端契约测试（web-ui React 版 + serve_web） | Current | `docs/design/web-frontend.md` | — | 守护 serve_web.py（no-store/端口/目录 dist/threaded/health）、web-ui/src 源码（.env.production VITE_API_BASE=8900、零 8901/8902 直连、hash 路由清单、关键契约端点与语义 token）；旧 web/ 三文件版已退役（2026-08-17）。 |
| `tests/test_api.py` | 配置中心 API 契约测试 | Current | `docs/design/config-center-api.md` | — | 密钥值不泄露。 |
| `tests/test_qed_web_service.py` | 8903 前端生命周期脚本契约测试 | Current | `docs/design/service-control.md` | — | 守护 scripts/qed_web_service.py（PID 文件/serve 命令/health 端口/子命令/退出码），防与注册表契约漂移。 |
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
