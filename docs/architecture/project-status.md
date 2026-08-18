# 项目状态快照

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-17
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
| QED-Engine 前端 | 根仓库 `web-ui/`（构建产物 dist/ 由 serve_web.py 托管） | 8903 | 已运行 | 学习界面（建设中）+ 管理后台（控制台 / 仪表盘 / 文档下载管理 / 文档解析管理——含解析进度、原始文档对照两个子视图）；**React 重构主轮（ARCH-011）四界面已完成并切换**（2026-08-17 旧 web/ 退役，直接经 8903 调试）；**只连 8900**（ADR 0007） |
| QED-Engine 后端 | 根仓库 `backend/qed_engine/` | 8900 | 已运行 | **三域组织（ARCH-012，2026-08-16 实施完成）**：控制域（配置五端点 + /services 启停托管 + /logs、/monitor/gpu、lmstudio、mineru、/self-restart 监控诊断）+ 数据域·QED-Tracker（catalogs/三表/tasks 适配 8901）+ 数据域·Axiom-Flow（预留）；密钥不下发。**2026-08-17：服务注册表扩为四单元（新增 web/8903）、tracker/web/axiom 三单元均走生命周期脚本（axiom 由 Popen 切换，REQ-039）、脚本单元停止/重启语义修复、serve_web.py 切 web-ui/dist** |
| QED-Tracker | `QED-Tracker/` 子仓库 | 8901 | 已服务化 | 发现/下载/校验/登记 + 资源状态机 + 后台任务轮询；全链路联调冒烟（QED-014）待开始 |
| Axiom-Flow | `Axiom-Flow/` 子仓库 | 8902 | 已实现 | PDF 解析 / OCR / 质量审阅 / 知识发布；端口迁移已完成（2026-08-11，ALN-002），数据目录迁移未完成（ALN-003） |

## 三中心定位

- **学习中心**：前端主界面（`#/`）的最终形态——课程学习（按知识节点推进）+ 知识问答
  （多 Agent），规划中（[学习中心设计](../design/learning-center.md)，Draft）。
  覆盖数学与计算机科学（AI 方向）双核心领域，当前以高等数学起步；资料类型含教材、
  习题集、论文、博客与官方文档，后续随需求扩展。
- **管理中心**：后台内容管理——文档下载管理 / 文档解析进度 / 原始文档对照。
- **控制中心**：后台运行控制——**8900 服务域 /services 启停托管已实装（2026-08-11，ADR 0007 轮）**
  （[服务控制设计](../design/service-control.md)，Accepted / Implemented）；注册表含 config/
  tracker/axiom/**web** 四单元，8900 重启经 /self-restart、8903 前端启停经
  `scripts/qed_web_service.py`（2026-08-17）；容器化依赖（MySQL / 向量库 / MinerU）
  只进规划不展示。

## 当前主线

- 已完成：**v0.1 版本目标对齐——[文档与架构重构轮（ARCH-008）](../history/plans/2026-08/2026-08-docs-refactor-round.md)**
  （2026-08-10 归档，Achieved）：docs/ 九节逐节梳理完成（W1 adr/ 至 W9 ADR 清理 + REQ-024），
  **文档基线定格**——ADR 六份（领域枚举收敛为工程治理/架构与边界）、标准/设计/计划/台账
  与契约测试一致，151 passed + ruff clean；跨项目设计级请求（REQ-022/023/026/027）已在
  两个子仓库建设计文档与承接登记（ALN-008/009、QED-022/023），待用户评审。
  **架构轮（ARCH-009，ADR 0007，2026-08-11 冒烟闭环）**：前端唯一入口 8900——目录重整（backend/
  database/tmp/scripts）、数据域语义 API（data.py）、服务域 /services 实装（service_manager.py）、
  前端唯一入口切换（app.js），P0-P5 完成，**真实冒烟闭环（8900/8901 联调：数据域真实数据 + /services 启停托管 start/stop/restart + 409 窗口 + 优雅停止），181 passed + ruff clean**，修复 ROOT 路径错位（parents 层级）与 Popen 失败句柄泄漏，归档待用户验收。
- 进行中：**前端重构主轮（ARCH-011，ADR 0008，2026-08-16 立档）**——用户裁决前端重构为
  当前最高优先级且**本轮只做前端**：React 19 + AntD 全家桶重建 8903（web-ui/），核心四界面
  （主界面/控制台/仪表盘/下载管理），控制台只用既有端点（/services、/config/database 启动
  快照）；**每阶段用户验证门禁**；后端三域拆分与监控诊断端点由 ARCH-012
  并行承接。**四界面已实现并切换（2026-08-17）**：serve_web.py 指向 web-ui/dist、旧 web/
  退役、`.env.production` VITE_API_BASE=8900、test_web.py 重写守护 web-ui 源码；控制台
  启停 message 反馈 + 仪表盘课程完成度（≥2 套教程验收）已落地。LLM 网关与本地 LLM
  （LM Studio）接入为第二轮。
- 进行中：**后端三域拆分轮（ARCH-012，2026-08-16 立档，与 ARCH-011 并行）**——三域迁移完成
  （clients/、services/ 能力层、api/control.py 控制域路由、api/tracker.py 数据域），控制域
  新能力落地（/logs、/monitor/gpu、/monitor/lmstudio、/monitor/mineru、/self-restart）；
  **门禁全绿（261 passed + ruff clean + 契约测试）**；**Task 18 真实环境实测与 8903 前端
  回归验收延后至前端完成后统一验收**（2026-08-16 用户裁决）。
- 进行中：**文档与数据边界整理轮（ARCH-013，2026-08-16 立档）**——后端文档按三域新模式
  梳理、todo 清理合并（旧前端/三表轮次关闭归档）、database/dataset 边界按「dataset=数据
  资料、元数据默认入 DB」重梳（meta/ 退役 REQ-032、QED-031 根仓库同步登记、学习表族规划）。
- 进行中：**LLM 状态收敛与 DB 启动快照轮（ARCH-014，2026-08-16 立档）**——/config/llm-status
  端点已删除（8900 启动时 LLM 供应商探测一次写日志）；/config/database 改启动快照（启动时
  MySQL 探测一次，端点只读）；旧前端横幅移除 LLM 项；Axiom-Flow 端口 8902 已迁移表述更新；
  「文档解析管理」包含关系登记前端轮。**实施完成（261 passed + ruff clean + 冒烟）**，
  与 ARCH-012/011 一并待前端完成后统一验收。
- 进行中：**联调矩阵与契约冻结编排（2026-08-16 立档，[integration-matrix.md](../design/integration-matrix.md)）**——
  三组并行联调：A 前端↔8900（并行推进中）/ B 8900↔8901（**QED-031 迁移 0006 已冻结**——
  2026-08-17 QED-Tracker 回执：alembic=0006、五表落库（4 知识/12 书行/16 渠道）、真实冒烟
  通过，REQ-035 前置解除）/ C 8900↔8902（根仓库侧托管/监控已具备；**执行方 = Axiom-Flow v2
  （V2-003~007，V2-003 误建产物已登记移交 REQ-036，2026-08-16 亡羊补牢——根仓库侧不再
  写子项目代码）**，服务建立后即可 C 组第一阶段联调，第二阶段待 v2 契约冻结 REQ-034 承接）；
  各服务独立开发阶段，验收窗口见矩阵文档。
- 进行中：8903 前端十五期（文档下载管理课程分页，ARCH-007，待用户浏览器验收后归档）；
  文档基线之上的主线推进为**课程收集主线（ARCH-002）**——QED-Tracker QED-019（01 数学分析
  闭环）与 QED-014 全链路联调冒烟待执行，回执后在 8903 展示验收；前端后续十六期与
  **学习中心（双目标：知识学习 + AI 技术学习实践场）** 按 roadmap 排队。
- 2026-08-14（二十二期续）：主界面**学习中心框架**已搭——领域→课程→章节/知识点浏览
  （数学试点，章节空态等解析产物管线，learning-center.md 更新 Partially Implemented）；
  管理后台树加载加固（loadTree 全函数 try/catch + 离线横幅 + 自动重试，杜绝无限转圈/空白）。
- 待开始：REQ-017 服务化三缺口；REQ-018 人工评审优化（QED-020 已实现待 8901 重启回执）；
  REQ-019 版本核对（跨项目）；REQ-020 榜单数据收集；REQ-022/023 治理契约对齐；
  REQ-026/027 数据库设计确认（设计文档已建，待子项目评审执行）。
- 详情见[任务台账](../trackers/todo.md)。

## 维护规则

- 服务实现状态、端口或当前主线变化时，更新本表并刷新「最后更新」日期。
- 本表不保存任务细节与未来规划（分别见 todo.md / roadmap.md）；与四服务架构的静态
  描述不一致时，以本表当前状态为准并回修[四服务架构](four-service-architecture.md)。
