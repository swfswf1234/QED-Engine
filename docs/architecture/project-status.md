# 项目状态快照

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-09
关联代码：无（状态快照，不映射具体模块）
关联测试：无
关联 ADR：无

## 用途

本文件是 QED-Engine 三项目开发状态的单一事实源入口：Agent 进场先读本表，
30 秒掌握「项目现在到哪了」。具体任务状态以[任务台账](../trackers/todo.md)为准，
未来方向以[能力路线图](../trackers/roadmap.md)为准；本表只保存「当前实现状态」快照。

## 四服务状态

| 服务 | 仓库 | 端口 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| QED-Engine 前端 | 根仓库 `web/` | 8903 | 已运行 | 学习界面（建设中占位卡）+ 管理后台四项（仪表大盘 / 文档下载管理 / 文档解析进度 / 原始文档对照）；前端已完成 15 期迭代 |
| QED-Engine 配置中心 | 根仓库 `src/qed_engine/` | 8900 | 已运行 | health / models / keys / database / llm-status 五端点，密钥不下发；服务管理端点（控制中心）规划中，Not Started |
| QED-Tracker | `QED-Tracker/` 子仓库 | 8901 | 已服务化 | 发现/下载/校验/登记 + 资源状态机 + 后台任务轮询；全链路联调冒烟（QED-014）待开始 |
| Axiom-Flow | `Axiom-Flow/` 子仓库 | 8000（迁移 8902 中） | 已实现 | PDF 解析 / OCR / 质量审阅 / 知识发布；端口与数据目录迁移未完成（ALN-002/003） |

## 三中心定位

- **学习中心**：前端主界面（`#/`）的最终形态——课程学习（按知识节点推进）+ 知识问答
  （多 Agent），规划中（[学习中心设计](../design/learning-center.md)，Draft）。
  覆盖数学与计算机科学（AI 方向）双核心领域，当前以高等数学起步；资料类型含教材、
  习题集、论文、博客与官方文档，后续随需求扩展。
- **管理中心**：后台内容管理——文档下载管理 / 文档解析进度 / 原始文档对照。
- **控制中心**：后台运行控制——三 Python 服务启停托管（[服务控制设计](../design/service-control.md)，
  Accepted / Not Started）；容器化依赖（MySQL / 向量库 / MinerU）只进规划不展示。

## 当前主线

- 进行中：**v0.1 版本目标对齐（roadmap 方向行）**——[文档与架构重构轮（ARCH-008）](../plans/2026-08-docs-refactor-round.md)：
  docs/ 子目录逐节梳理，adr/（W1）、standards/（W2）、architecture/（W3）与 design/（W4）小节已完成
  （W2：任务类型收编、文档规范占位/去重、7 处 index 规则节清理、「index 只导航」普适守护；
  W3：四服务架构回修到现状（8903 已运行/三中心/控制中心托管/8902 迁移态）+ 技术栈选型
  tech-stack.md + 数据库设计 database-design.md；W4：8903 前端契约独立 web-frontend.md、
  service-contracts 瘦身去重、dataset/configuration 过时修复，150 passed），下一节 guides/（W5）；
  全部小节完成后触发治理 ADR 重新治理（REQ-024）。
- 进行中：8903 前端十五期（文档下载管理课程分页，ARCH-007，待用户浏览器验收后归档）。
- 待开始：QED-014 全链路联调冒烟；REQ-017 服务化三缺口；REQ-018 人工评审优化；
  REQ-019 版本核对（跨项目）；REQ-020 榜单数据收集；REQ-022/023 治理契约范本对齐。
- 详情见[任务台账](../trackers/todo.md)。

## 维护规则

- 服务实现状态、端口或当前主线变化时，更新本表并刷新「最后更新」日期。
- 本表不保存任务细节与未来规划（分别见 todo.md / roadmap.md）；与四服务架构的静态
  描述不一致时，以本表当前状态为准并回修[四服务架构](four-service-architecture.md)。
