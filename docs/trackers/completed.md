# 已关闭任务台账

状态：Current
最后更新：2026-08-12

本文件登记已关闭任务（终态时从[任务台账](todo.md)原子移除并移入本表）。关闭结果枚举：
Achieved（达成）/ Rejected（未采纳）/ Partial（部分达成）/ Not Applicable（不适用）。

| ID | 类型 | 任务 | 关闭结果 | 证据 |
| --- | --- | --- | --- | --- |
| ARCH-001 | Plan | [2026-08 三项目同步对齐计划（sync-alignment：前端/端口/配置/数据/CLI 五线统一）](../history/plans/2026-08/2026-08-sync-alignment.md) | Partial | 2026-08-09 归档（ARCH-008 W7 盘点）：五线统一已被 REQ-001~027 与子计划逐条承接消化（前端统一 8903 ✅、端口规划 ADR 0002 ✅、根 .env 配置 ✅、dataset 布局 ✅、qed 统一 CLI ✅）；Axiom 侧迁移（REQ-001/003/005/015）由各请求继续承接；计划正文 Retain 归档，待办缺口以 REQ 行继续跟踪 |
| ARCH-003 | Plan | [2026-08 8903 前端三期改造计划（frontend-redesign-v3）](../history/plans/2026-08/2026-08-8903-frontend-redesign.md) | Achieved | 三期五项目标全部实现（111 passed + ruff clean）；后续范围由 ARCH-004（四期）+ REQ-006 承接推进（见 REQ-006 证据列）；2026-08-09 归档（ARCH-008 W7 盘点）至 `docs/history/plans/2026-08/` |
| ARCH-005 | Plan | [2026-08 8903 前端五期~十三期（display-redesign：零后台痕迹 / 仪表盘四阶段 / 知识链路树 / 控制台化）](../history/plans/2026-08/2026-08-8903-display-redesign.md) | Achieved | 计划正文归档至 `docs/history/plans/2026-08/2026-08-8903-display-redesign.md`（7b53c4b 移除活跃 plans/）；五期~十三期已提交 a5ce8c1 并验收，记录于 REQ-006 证据列 |
| ARCH-008 | Plan | [2026-08 文档与架构重构轮（docs-refactor-round）](../history/plans/2026-08/2026-08-docs-refactor-round.md) | Achieved | 2026-08-10 归档（W1-W9 全部完成 + REQ-024 完成 + 151 passed + ruff clean + 用户确认）：docs/ 九节逐节梳理完成（V1 基线确立）——adr/（ADR 0004-0006 登记）、standards/（类型收编/占位清理/规则节清理）、architecture/（四服务回修 + tech-stack + database-design）、design/（web-frontend 契约独立 + 瘦身 + 单模型线路）、guides/（接口冒烟回修）、trackers/（completed 台账创建 + roadmap 对齐）、plans/（ARCH-001/003 归档 + todo 类别列）、learning/+history/（归档登记补全）、ADR 清理（REQ-024）；v0.1 文档基线定格，后续执行轮各自建计划 |
| REQ-024 | 流程 | 治理 ADR 重新治理（随 ARCH-008 W9 执行）：审查既有 ADR 与治理规范（贵精不贵多/边界区分/合理性/优化留痕） | Achieved | 2026-08-10 完成：六份 ADR 逐审（0001/0003/0004/0005/0006 有效、0002 链接修复 + 8901/8903 现状勘误留痕）；领域枚举裁剪 5→2（工程治理/架构与边界，adr-governance.md + 契约测试同步，151 passed）；adr-governance.md 新增「审查与优化留痕」节（勘误格式/语义变更须新 ADR）；单模型线路/数据库归属裁决按用户意见不升格 ADR（tech-stack/database-design 正文记录） |
| REQ-001 | 请求 | Axiom-Flow 端口 8000 → 8902 迁移（启动命令、README、指南、CORS）（请求：Axiom-Flow） | Achieved | Axiom-Flow 提交 29b6524（2026-08-11）落地：API/Worker 端口 8000→8902，README、开发/运维指南、启动命令与 CORS 白名单同步（保留 8000 兼容，ADR 0002），契约测试同步；Axiom-Flow 侧 ALN-002 同步关闭 |
| REQ-008 | 实现 | Axiom-Flow OCR 多后端：qwen-vl-plus → glm-ocr 适配（请求：Axiom-Flow） | Rejected | 2026-08-12 用户裁决取消：glm 实际不通、无可行性；Axiom-Flow 侧 ALN-005 同步取消，GLM 模型暂注释于 .env.example 维持现状 |
| REQ-009 | 实现 | deepseek 接入：DEEPSEEK_API_KEY 配置后启用 deepseek-v4-flash 路由 | Rejected | 2026-08-12 用户裁决取消：暂时不做 |
| REQ-016 | 实现 | LLM 可达性探测：8900 新增 `/config/llm-status`（真实探测 models 接口、5s 超时、60s 缓存、未配置不探测、密钥绝不下发），8903 横幅由 key 布尔改为可达性展示 | Achieved | 2026-08 完成并验收：端点+探测+缓存已实现（backend/qed_engine/api/main.py、tests 105 passed、ruff 通过），8900 实测 qwen/glm 可达、deepseek 未配置；前端横幅已切换（web/app.js）；契约见 docs/design/config-center-api.md；2026-08-12 用户确认验收后关闭 |
