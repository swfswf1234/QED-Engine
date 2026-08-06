# 任务台账

状态：Current
最后更新：2026-08-06

本文件登记根仓库未关闭任务，是活跃计划的镜像。详细计划见 [计划索引](../plans/index.md)；
已关闭任务见 [completed.md](completed.md)。

## 未关闭任务

| ID | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-001 | Plan | 高 | Accepted | [2026-08 三项目同步对齐计划（sync-alignment）](../plans/2026-08-sync-alignment.md) | 计划状态 Accepted；Phase 0/1 完成后按归档判定关闭 |
| ARCH-002 | Plan | 高 | Accepted | [2026-08 教材下载轮计划（textbook-download-round）](../plans/2026-08-textbook-download-round.md) | 计划状态 Accepted；三线工作项由子项目 todo 承接（QED-008~016、ALN-001~007），联调验收后关闭 |
| ARCH-003 | Plan | 中 | Accepted | [2026-08 8903 前端三期改造计划（frontend-redesign-v3）](../plans/2026-08-8903-frontend-redesign.md) | 计划状态 Accepted；2026-08-06 用户确认，REQ-006 执行中（三期部分已由四期承接推进，见 REQ-006 证据） |
| ARCH-004 | Plan | 高 | Accepted | [2026-08 管理后台信息架构重设计（admin-redesign-v4）](../plans/2026-08-8903-admin-redesign.md) | 计划状态 Accepted；2026-08-06 用户确认（卡片墙/严格三领域/树主评估窄/详情评估视角）；**四期完成（119 passed + ruff clean + 8901 三态冒烟）**：卡片墙入口、三领域（拓扑/考前并入分析）、树拖拽记忆（qed-tree-w）、领域/课程/状态与任务筛选、详情评估视角；Phase 0（QED-017 提交 5f7c015 + 8901 重启 pid 6772）完成；待用户浏览器验收后归档 |
| REQ-013 | 请求 | 高 | 待开始 | QED-Tracker MySQL 资源登记与状态机：qt_resources 表（含 llm_evaluation/catalog_ref/留痕字段）+ confirm/reject/approve 同步端点 + /resources/{id}/file 预览（请求：QED-Tracker） | QED-Tracker todo QED-012/QED-016 承接；2026-08-04 用户裁决统一 qed 库；2026-08-05 人机协同闭环裁决（人工确认后下载、删除硬删+DB 留痕）；**2026-08-06 回执：QED-012/QED-015/QED-016 已实现、QED-017 三态（backup/转正/放弃）已提交 5f7c015 并重启 8901 实测**；剩余：8903/CLI 联调验收（QED-014 冒烟）随本项完成 |
| REQ-014 | 请求 | 高 | 待开始 | 基础书单 math-qe-v2 + LLM 筛选评估：按课程批量评估任务（搜索源+LLM 评估+候选落库），前端人工确认后才下载（请求：QED-Tracker） | QED-Tracker todo QED-013/QED-015 承接；每课程两组、宁缺勿滥、中文书 pending_manual；候选级拒绝可跳过；**2026-08-06 回执：QED-013 已实现（13 门课程书单 + evaluate 按课程批量落候选）**；剩余：QED-014 全链路联调验收 |
| REQ-015 | 请求 | 中 | 待开始 | Axiom-Flow 读取 dataset/qed-tracker/raw/ 的批量导入解析接口（Phase 2 前置；请求：Axiom-Flow） | Axiom-Flow todo ALN-006 承接；教材下载轮联调后确认，拆 B/D 类计划执行 |
| REQ-001 | 请求 | 高 | 待开始 | Axiom-Flow 端口 8000 → 8902 迁移（启动命令、README、指南、CORS）（请求：Axiom-Flow） | Axiom-Flow todo ALN-002 承接；用户已确认（2026-08-04），B 类计划 ALN-007 执行 |
| REQ-002 | 实现 | 中 | 进行中 | 文档治理持续演进：标准/ADR/计划/台账与契约测试随需求同步更新（ADR 0001 已落地） | 每次文档变更前运行 `tests/contract/` 门禁 |
| REQ-003 | 请求 | 高 | 待开始 | Axiom-Flow 数据目录指向根 dataset/axiom-flow/parsed、直读 QED_* 变量（含 QED_DB_*，qed 库）（请求：Axiom-Flow） | Axiom-Flow todo ALN-003 承接；用户已确认（2026-08-04），B 类计划 ALN-007 执行 |
| REQ-004 | 请求 | 高 | 待开始 | QED-Tracker 服务化 8901：API + 后台任务 + 轮询；数据根迁 dataset/qed-tracker/（请求：QED-Tracker） | QED-Tracker todo QED-008~010 承接；计划 2026-08-service-and-book-download 执行 |
| REQ-005 | 实现 | 高 | 待开始 | Axiom-Flow web/ 前端迁入根仓库 web/，子项目退役 web/ | 用户评审 ADR 0002 后启动前端迁移轮 |
| REQ-006 | 实现 | 中 | 进行中 | QED-Engine 前端（8903）：主体学习界面 + 后台管理（仪表盘/文件下载管理/解析进度/文档对照/追溯） | 三期完成（ARCH-003，111 passed）：横幅粗粒度化、主界面三卡、仪表盘 SVG 图表、下载管理领域树+事务面板、解析/对照/追溯空态；**四期完成（ARCH-004，119 passed + ruff clean）**：卡片墙入口、严格三领域、树主评估窄+拖拽记忆、筛选栏（领域/课程/状态 + 任务 状态/类型/课程）、详情弹窗评估视角（解析目标/中英/来源）；8900 重启实测 database reachable + llm-status OK；8903 token 实测通过；待用户浏览器验收（卡片墙/树完整/拖拽/筛选/详情/三态按钮回归）后归档 |
| REQ-008 | 实现 | 中 | 待开始 | Axiom-Flow OCR 多后端：qwen-vl-plus → glm-ocr 适配（请求：Axiom-Flow） | 已补登记 Axiom-Flow todo ALN-005（跨项目），用户确认后由其仓库执行 |
| REQ-009 | 实现 | 低 | 待开始 | deepseek 接入：DEEPSEEK_API_KEY 配置后启用 deepseek-v4-flash 路由 | 用户账户可用后处理 |
| REQ-010 | 流程 | 中 | 进行中 | 跨项目协作流程演练：向 Axiom-Flow/QED-Tracker 登记改造请求 todo | 双方回执并关闭其 todo 后完成 |
| REQ-016 | 实现 | 中 | 进行中 | LLM 可达性探测：8900 新增 `/config/llm-status`（真实探测 models 接口、5s 超时、60s 缓存、未配置不探测、密钥绝不下发），8903 横幅由 key 布尔改为可达性展示 | 2026-06 完成：端点+探测+缓存已实现（tests 105 passed、ruff 通过），8900 实测 qwen/glm 可达、deepseek 未配置；前端横幅已切换；契约见 docs/design/config-center-api.md；归档条件：用户浏览器验收 8903 横幅与详情弹窗 |
| REQ-017 | 请求 | 高 | 待开始 | QED-Tracker 服务化遗留三缺口（请求：QED-Tracker）：① 仓库内提供正式启动入口（当前用临时 serve_tracker.py，README 无记录）；② 评估任务进度上报（当前仅 30%/100% 两档，长任务无法观察中间状态）；③ 服务重启后 running 任务恢复（当前需人工干预） | 在 QED-Tracker 仓库建设计文档+todo 任务，用户评审确认后由对方执行 |

## 规则

- 任务 ID 使用稳定格式 `前缀-三位序号`；类型包括 Plan、请求、实现、评审、验证、流程。
- 状态只允许 `待开始 / 进行中 / In Progress / Blocked / 已完成`；阻塞必须声明证据、恢复条件
  和责任位置。
- 涉及子项目改造的请求在根仓库登记并标注目标仓库（`请求：<目标仓库>`），子项目在自己的 todo
  承接；根仓库不直接修改子项目文件（见
  [跨项目协作流程](../standards/cross-project-collaboration.md)）。
- Plan 行镜像 `docs/plans/` 活跃计划正文（标题、链接、状态、关联 Tracker）。
- 任务终态时从本表原子移除并写入 completed.md。
