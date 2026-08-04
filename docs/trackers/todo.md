# 任务台账

状态：Current
最后更新：2026-08-04

本文件登记根仓库未关闭任务，是活跃计划的镜像。详细计划见 [计划索引](../plans/index.md)；
已关闭任务按需在 `completed.md` 登记（当前无）。

## 未关闭任务

| ID | 类型 | 优先级 | 状态 | 任务 | 证据/下一条件 |
| --- | --- | --- | --- | --- | --- |
| ARCH-001 | Plan | 高 | Accepted | [2026-08 三项目同步对齐计划（sync-alignment）](../plans/2026-08-sync-alignment.md) | 计划状态 Accepted；Phase 0/1 完成后按归档判定关闭 |
| REQ-001 | 请求 | 高 | 待开始 | Axiom-Flow 端口 8000 → 8902 迁移（启动命令、README、指南、CORS）（请求：Axiom-Flow） | 已向 Axiom-Flow 登记 todo（跨项目），用户确认后由其仓库执行 |
| REQ-002 | 实现 | 中 | 进行中 | 文档治理持续演进：标准/ADR/计划/台账与契约测试随需求同步更新（ADR 0001 已落地） | 每次文档变更前运行 `tests/contract/` 门禁 |
| REQ-003 | 请求 | 高 | 待开始 | Axiom-Flow 数据目录指向根 dataset/axiom-flow/parsed、直读 QED_* 变量（请求：Axiom-Flow） | Axiom-Flow 仓库内执行，其 todo 承接后更新证据 |
| REQ-004 | 请求 | 高 | 待开始 | QED-Tracker 服务化 8901：API + 后台任务 + 轮询；数据根迁 dataset/qed-tracker/（请求：QED-Tracker） | QED-Tracker 仓库内执行，其 todo 承接后更新证据 |
| REQ-005 | 实现 | 高 | 待开始 | Axiom-Flow web/ 前端迁入根仓库 web/，子项目退役 web/ | 用户评审 ADR 0002 后启动前端迁移轮 |
| REQ-006 | 实现 | 中 | 待开始 | QED-Engine 前端（8903）：学习界面 + 管理界面 + 审阅工作台 | 待 REQ-005 迁移完成后开发 |
| REQ-007 | 实现 | 中 | 待开始 | 配置中心数据库选择：QED_DB_* 变量 + 配置接口 | 待写计划（B 类） |
| REQ-008 | 实现 | 中 | 待开始 | Axiom-Flow OCR 多后端：qwen-vl-plus → glm-ocr 适配（请求：Axiom-Flow） | Axiom-Flow 仓库内进行，其 todo 承接 |
| REQ-009 | 实现 | 低 | 待开始 | deepseek 接入：DEEPSEEK_API_KEY 配置后启用 deepseek-v4-flash 路由 | 用户账户可用后处理 |
| REQ-010 | 流程 | 中 | 进行中 | 跨项目协作流程演练：向 Axiom-Flow/QED-Tracker 登记改造请求 todo | 双方回执并关闭其 todo 后完成 |
| DES-001 | 实现 | 中 | 待开始 | 统一 CLI `qed`：config 子命令 + 服务发现（8901/8902 地址可配置） | 计划 Phase 1 工作项；CORS 允许 8901/8902/8903 一并落地 |

## 规则

- 任务 ID 使用稳定格式 `前缀-三位序号`；类型包括 Plan、请求、实现、评审、验证、流程。
- 状态只允许 `待开始 / 进行中 / In Progress / Blocked / 已完成`；阻塞必须声明证据、恢复条件
  和责任位置。
- 涉及子项目改造的请求在根仓库登记并标注目标仓库（`请求：<目标仓库>`），子项目在自己的 todo
  承接；根仓库不直接修改子项目文件（见
  [跨项目协作流程](../standards/cross-project-collaboration.md)）。
- Plan 行镜像 `docs/plans/` 活跃计划正文（标题、链接、状态、关联 Tracker）。
- 任务终态时从本表原子移除并写入 completed.md。
