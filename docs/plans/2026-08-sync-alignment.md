# 2026-08 三项目同步对齐计划（sync-alignment）

状态：Accepted
任务类型：B
最后更新：2026-08-04
关联 ADR：[ADR 0001](../adr/0001-root-contract-tests.md)、[ADR 0002](../adr/0002-frontend-and-port-centralization.md)
关联设计：[服务契约](../design/service-contracts.md)、[dataset 目录约定](../design/dataset-conventions.md)、[统一配置与密钥规范](../design/configuration-and-secrets.md)、[配置中心 API 契约](../design/config-center-api.md)
关联 Tracker：`docs/trackers/todo.md`（[任务台账](../trackers/todo.md)，含 ARCH-001、DES-001 及全部子项目请求）
归档判定：前端轮与 RAG 知识库轮交付后 Retain 归档至 `history/plans/`（跨轮次总计划），每轮子计划关闭按各自归档判定执行

## 目标与成功标准

让 QED-Engine、QED-Tracker、Axiom-Flow 三项目在**前端归属、服务端口、配置事实源、数据布局**上完成全局统一：

1. 前端统一：所有前端（学习、管理、审阅工作台）唯一维护在 QED-Engine 根仓库 `web/`，端口 8903。
2. 端口统一：8900 配置中心 / 8901 QED-Tracker / 8902 Axiom-Flow / 8903 前端。
3. 配置统一：根 `.env` 的 `QED_*` 变量是唯一事实源；子项目直读，`load-env.ps1` 映射层退役。
4. 数据统一：`dataset/qed-tracker/`（raw/meta/tmp）与 `dataset/axiom-flow/`（parsed）项目子域布局，路径语义化、可被前端展示。
5. 独立性铁律不回归：无配置/无密钥时降级运行 + 最小配置提醒。

成功标准：`qed` 统一 CLI 与前端可通过 8901/8902 调起下载与解析全链路；任一服务离线时其余服务与前端正常降级展示。

## 范围与非目标

范围内：
- 根仓库：统一 CLI `qed`、前端 `web/`（分轮）、契约测试 `tests/contract/`、`code-map.md`、设计契约转 Accepted。
- QED-Tracker：服务化（8901 API + 后台任务 + 轮询）、CLI 转 HTTP 客户端、直读 `QED_*` 变量、TOML 退役、数据根迁移到 `dataset/qed-tracker/`、文档体系对齐。
- Axiom-Flow：端口 8000 → 8902、`web/` 工作台迁出、直读 `QED_*` 变量（在其仓库内执行）。

非目标（不在本计划）：
- RAG/向量库/切分技术选型（Phase 4 学习轮，随推进产出 `docs/learning/` 笔记，不预排期）。
- 学习界面/管理界面的交互设计（前端轮内单独设计）。
- 存量数据自动迁移：用户现有数据根（如 `D:\coding\dataset\textbooks`）不移动、不改名；仅新下载使用新布局（显式迁移命令另议）。

## 前置条件

- 根 `.env` 存在且含 `QWEN_API_KEY` 等密钥（无则按最小配置降级验证）。
- Axiom-Flow 与 QED-Tracker 独立仓库可访问，遵守各自 AGENTS.md 门禁。
- 并行治理产物（ADR-0001/0002、5 份标准、跨项目协作流程）已就位；`tests/contract/` 契约测试实现为本计划 Phase 1 工作项。

## 工作项

### Phase 0：文档与治理（根仓库 + QED-Tracker，2026-08-04）

| 工作项 | 归属 | 交付 |
| --- | --- | --- |
| 四服务架构文档 | 根仓库 | `docs/architecture/four-service-architecture.md`（已建，In Progress） |
| 设计契约转 Accepted | 根仓库 | service-contracts / dataset-conventions / configuration-and-secrets 三份正文更新 |
| 总体计划 | 根仓库 | 本文件 + `docs/plans/index.md` 登记 |
| 任务台账 | 根仓库 | ARCH-001/DES 编号登记、子项目请求登记 |
| 数据骨架 | 根仓库 | `dataset/qed-tracker/.gitkeep`、`dataset/axiom-flow/.gitkeep` |
| QED-Tracker 文档对齐 | 子仓库 | standards/、adr/、roadmap 移入 trackers/、AGENTS.md 路由、todo 登记 |

### Phase 1：根仓库实现（契约测试 + 统一 CLI）

1. `tests/contract/` 契约测试实现（ADR 0001 落地）：文档结构、链接、标准一致性、ADR 治理、计划/ tracker 治理、code-map/DesignRef、架构/设计语义、测试套件治理。
2. `docs/architecture/code-map.md` 建立并登记全部受管模块。
3. 统一 CLI `qed`（`src/qed_engine/cli.py`）：config 子命令 + 服务发现（8901/8902 地址可配置）；尾注提醒（无 `.env`/缺 key 时输出最小配置提示）。
4. 配置中心 CORS 允许 8901/8902/8903 来源（管理界面展示前置）。

### Phase 2：QED-Tracker 服务化（子仓库内执行，遵守其门禁）

1. `config.py`：直读根 `.env` 的 `QED_*` 变量，TOML 与 `QED_TRACKER_*` 退役，内置最小默认值。
2. 数据布局：`data_root` 默认 `dataset/qed-tracker/`；`raw/`（books/inbox、books/math-qe/<course>、exercises/inbox、papers/<year>）、`meta/`（resources/selections/transfers/tasks）、`tmp/downloads/`；文件名规则 `<slug>_<sha256前8>.pdf`、论文 `<arxiv-id>_<sha256前8>.pdf`。
3. 服务 `src/qed_tracker/api/`（8901，前缀 `/api/v1`）：只读查询同步；写操作（下载/推荐/目录批处理/扫描/Axiom 推送）全部为后台任务 + `GET /tasks/{id}` 轮询；任务落盘 `meta/tasks/`；并发上限 2；同 sha256 幂等复用。
4. `cli.py` 转 HTTP 客户端（默认等待，`--no-wait` 输出 task_id）；`qed-tracker` 脚本退役（统一 CLI 承接）。
5. 冒烟测试：基于真实 8901 服务的启动 → 建任务 → 轮询 → 校验文件落位链路。
6. Axiom 客户端默认地址改为 8902。

### Phase 3：Axiom-Flow 对齐（子仓库内执行）

1. 端口 8000 → 8902（启动命令、README、指南、CORS）。
2. `web/` 工作台代码迁入根仓库 `web/`（随 Phase 4 前端轮）——先登记、后迁移。
3. 直读 `QED_*` 变量；数据产物指向 `dataset/axiom-flow/parsed/`。

### Phase 4：前端轮 + RAG 学习轮（根仓库）

1. `web/` 学习界面/管理界面/审阅工作台；管理界面消费 8901 任务接口与 8903 资源查询。
2. RAG 知识栈随推进学习：向量化（`QED_EMBEDDING_MODEL=text-embedding-v4`）、切分、向量库选型、检索评估；产出 `docs/learning/` 主题笔记。

## 验证与验收

- 每轮按其归属仓库门禁执行（QED-Tracker：`pytest tests -q` + ruff + 文档契约测试；根仓库：`pytest tests -q` + `ruff check src tests` + `tests/contract/`）。
- Phase 2 冒烟：真实启动 8901，`qed tracker books get <query> --pick N` 全链路，验证 PDF 落在 `dataset/qed-tracker/raw/books/inbox/` 且资源登记、任务记录完整。
- 重复下载链路：同一资源二次下载返回既有记录（sha256 幂等），不产生重复文件——与用户约定于 Phase 2 冒烟后验证。
- 独立性验收：停掉任一服务后其余服务与前端正常降级。

## 回滚

- 配置/端口变更在子项目仓库内各自提交，回滚 = 子项目仓库 git revert + 恢复旧默认值。
- 数据布局迁移不自动执行（存量不迁移），新布局回滚仅影响新下载文件；`meta/tasks/` 任务记录保留可追溯。
- 前端 `web/` 迁入完成前，Axiom-Flow `web/` 继续可用（ADR 0002 约定）。

## 关闭与归档

- 每轮完成且门禁通过后，该轮子计划关闭（Completed + 关闭结果），从 todo 移除并追加 completed 台账。
- 本总计划在 Phase 4 交付后关闭：关闭结果 Achieved，归档至 `history/plans/2026-08/`，保留本文件副本作为跨轮次审计证据。
