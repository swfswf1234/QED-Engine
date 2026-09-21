# 项目状态快照

设计状态：Accepted
实现状态：Implemented
最后更新：2026-09-21
关联代码：无（状态快照，不映射具体模块）
关联测试：无
关联 ADR：无

## 用途

本文件是 QED-Engine 三项目开发状态的单一事实源入口：Agent 进场先读本表，
30 秒掌握「项目现在到哪了」。具体任务状态以[任务台账](todo.md)为准，
未来方向以[能力路线图](roadmap.md)为准；本表只保存「当前实现状态」快照。

## 四服务状态

| 服务 | 仓库 | 端口 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| QED-Engine 前端 | 根仓库 `web-ui/`（构建产物 dist/ 由 serve_web.py 托管） | 8903 | 已运行 | 学习界面（建设中）+ 管理后台（控制台 / 仪表盘 / 文档下载管理 / 文档解析管理——**单屏「左书目树（纯选择）+ 右对照工作台」**：原页图 vs 解析还原对照、bbox 双向联动、块编辑+判定、单页/全本解析+进度、连续滚动、URL 恢复（2026-09-20 ARCH-020-G 定档，取代历轮左树进度/两级列表形态）；**React 重构主轮（ARCH-011）四界面已完成并切换**（2026-08-17 旧 web/ 退役，直接经 8903 调试）；**只连 8900**（ADR 0007）；**控制台 LLM 改造（ARCH-016，2026-08-20）**：四服务卡后 GPU 总览条 + 依赖组件三卡（MySQL/文字模型/图像模型，置灰 + 测试按钮）+ 「模型调用记录」检索页（`#/admin/llm-calls`） |
| QED-Engine 后端 | 根仓库 `backend/qed_engine/` | 8900 | 已运行 | **三域组织（ARCH-012，2026-08-16 实施完成）**：控制域（配置五端点 + /services 启停托管 + /logs、/monitor/gpu、qwen、mineru、/self-restart 监控诊断）+ 数据域·QED-Tracker（catalogs/三表/tasks 适配 8901）+ 数据域·Axiom-Flow（预留）；密钥不下发。**2026-08-17：服务注册表扩为四单元（新增 web/8903）、tracker/web/axiom 三单元均走生命周期脚本（axiom 由 Popen 切换，REQ-039）、脚本单元停止/重启语义修复、serve_web.py 切 web-ui/dist**。**LLM 网关与模型管理（ARCH-016，2026-08-20 实施完成）**：三项目密钥约定（各 `.env` 自持 `API_KEY`，旧变量降级别名，`QED_API_SELECT` 选模式）+ 8900 LLM 网关端点（/llm/text、/llm/vision、/llm/test/*、/llm/calls、/database/test）+ 本地模型生命周期脚本（scripts/text-model/ + scripts/image-model/）+ 资源互斥（QED_RESOURCE_GUARD）+ qed_llm_calls 调用记录（单表三项目可写）；`--mode（api 或 local）` 启停。**密钥收敛（2026-08-20
  用户裁决）**：逐厂商 key（QWEN/DEEPSEEK/GLM_API_KEY）已取消，单一 `API_KEY` + `QED_API_PROVIDER`
  （qwen/deepseek/glm，默认 qwen）选厂商，`/config/keys` 改返回 `{provider, configured}` |
| QED-Tracker | `QED-Tracker/` 子仓库 | 8901 | 已服务化 | 发现/下载/校验/登记 + 资源状态机 + 后台任务轮询；全链路联调冒烟（QED-014）待开始 |
| Axiom-Flow | `Axiom-Flow/` 子仓库 | 8902 | 已实现 | 完整解析管线（PDF ingest / 引擎适配器 / 归一化 / 编排 / 产物落盘）+ 对照数据供给 + 人工编辑落库；**模型生命周期归 8900、解析直连模型服务**（ARCH-020，[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)）；文档重构进行中（[交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md)） |

## 三中心定位

- **学习中心**：前端主界面（`#/`）的最终形态——课程学习（按知识节点推进）+ 知识问答
  （多 Agent），规划中（[学习功能现状](../plans/2026-09-10-learning-center-current-state.md)）。
  覆盖数学与计算机科学（AI 方向）双核心领域，当前以高等数学起步；资料类型含教材、
  习题集、论文、博客与官方文档，后续随需求扩展。
- **管理中心**：后台内容管理——文档下载管理 / 文档解析管理（单屏左书树纯选择 + 右对照
  工作台：原页 bbox 联动 + 块级编辑：判定/备注/文字/范围，设计见 [parsing-ui.md](../design/parsing-ui.md)；探索方向见
  [document-chunking-recall 草案](../plans/2026-08-18-document-chunking-recall.md)）。
- **控制中心**：后台运行控制——**8900 服务域 /services 启停托管已实装（2026-08-11，ADR 0007 轮）**
  （[服务控制设计](../design/service-hosting.md)，Accepted / Implemented）；注册表含 config/
  tracker/axiom/**web** 四单元，8900 重启经 /self-restart、8903 前端启停经
  `scripts/qed_web_service.py`（2026-08-17）；**本地模型可操作**——控制台槽位卡五字段
  （来源/渠道/模型/备注/可用）启停/观测/验证，注册表统一身份与 runtime 路由
  （2026-09-21 ARCH-023 收口，见 [llm-gateway.md](../design/llm-gateway.md)）；向量库只进规划不展示。

## 当前主线

- 已完成：**design/ 文档整合轮（PLAN-047，2026-09-21）**——design/ 13 份去过程化：修订
  blockquote / 演进节 / 轮次标签 / 冒烟证据全部剥离（文末一行「关联计划」溯源），重点四份
  （parsing-ui / admin-console / llm-gateway / local-model-management）设计态重写，
  document-chunking-recall 草案按 ADR 0011 移回 plans/ 壳承载（REQ-082，Blocked），
  design/index 三处状态矛盾修正；契约 63 + 全量 500 + ruff 全绿；用户终验裁决
  design/ 全部 12 份「确认状态」晋升「已确认」（2026-09-21）。
- 已完成：**模型注册表与三接口统一轮（ARCH-023 / PLAN-046，2026-09-21 冒烟收口关闭）**——
  `services/llm/registry.py` 身份目录（text/vision/embedding 三槽位，含 2026-09-21 用户裁决
  新增云端身份 `deepseek-v4-flash-0731`）+ `runtimes/` 本地形态统一（LM Studio 半托管 /
  Docker / llama.cpp 待上线）+ 四段式 env（`QED_LOCAL_RUNTIME`/`QED_MODEL_URL`/
  `QED_OCR_MODEL_URL`/`QED_LMSTUDIO_TOKEN`/`QED_RESOURCE_GUARD`）+ 槽位级来源/渠道运行态
  （manifest `source`/`runtime`）+ 控制台五字段卡；`/models`、`/monitor` 端点槽位化。
  W7 真实冒烟四项全绿（LM Studio 文字链路、单活互斥双向、embedding api、text=api 混合，
  api 回退链尊重 `.env` 收 BUGFIX-008）+ W10 浏览器交互实测；设计事实并入
  [llm-gateway.md](../design/llm-gateway.md) 与 [local-model-management.md](../design/local-model-management.md)，
  壳归档 history/plans/2026-09/。未来 AGENT/MCP 统一配置以同一注册表为准（roadmap 预留）。
- 已完成：**本地模型部署轮（PLAN-045，2026-09-14）**——MinerU 去模型化镜像重建 +
  `model/mineru/` 卷挂载 + `/root/mineru.json` 路径校准（`MINERU_MODELS_DIR` 无效）+
  健康探针端点校准（`/health`，非 `/api/v1/health`）+ 8900 集成（`/monitor/mineru`、
  `/models/mineru/{start|stop|restart}`，local 模式）+ 真实 PNG 解析冒烟通过。
  Qwen 文字模型不在本轮范围。
- 已完成：**本地模型管理整理轮（PLAN-042，2026-09-14）**——修硬伤（TEXT_SCRIPT 指向
  已删除脚本）、Qwen 运行时切 llama-server、槽位目录 + manifest 约定、全量去 LM Studio
  命名、MinerU 清理核查。门禁全绿（413 pytest + ruff + 188 vitest + tsc + build）。
  部署另起 **PLAN-045 本地模型部署轮**（MinerU 先行；Qwen 文字模型按 2026-09-14 用户裁决
  不在该轮范围）。
- 已完成：**第二轮主线·课程下载轮（ARCH-019，2026-09-11 关闭）**——同轮立 ADR 0011
  （待评审设计先入 plans/，确定后落 design/）并同步两子仓库；用户裁决清库重走（原
  QED-026/QED-014 前置被取代）。**数据前置轮已关闭**（2026-08-23）：五表备份+恢复演练、
  存量 PDF 迁移新结构（12 文件 sha256 全比对一致）、五表清空、8901 空态正常、
  `QED_DATA_ROOT` 落地根仓库侧；常驻快照库 `qed_snapshot_20260823` 留存清理前数据；
  PLAN-019 归档 history/plans/2026-08/，REQ-051/052 入 completed.md。
  **前端改造完成（2026-09-08）**：REQ-067 §A/§B 与共享表优化全量落地（PLAN-025/028/033/034
  关闭归档），设计事实晋升 [downloads-flow.md](../design/downloads-flow.md)。
  **2026-09-11 收尾**：三门课下载闭环 + 浏览器验收通过；PLAN-022/037/038/039/040/041 与
  REQ-068-PLAN 全部关闭归档（[completed.md](completed.md)）；领域探索阶段 2 缺陷修正
  （`已生成` 可探索、离线添加领域 `未开始`、导入 409）；跨项目请求 REQ-075~079 用户确认完成。
  下一步：**第三轮主线·解析联调轮（ARCH-020）**——与 Axiom-Flow 联调 local/api 模式。
- 已完成：**第一轮主线·文档规范与架构确定轮（ARCH-018，ADR 0010，2026-08-21 关闭）**——
  文档体系重构为「确定文档 / 相对确定 / 实时状态」三层：architecture/ 只放确定文档（总体架构
  four-service-architecture + 服务架构 frontend/backend-architecture + 固定 API 文档
  api-contracts + 数据库总纲 database-design + code-map，project-status 移入 trackers/）；
  guides 拆分 operations（操作）+ development（开发）；trackers 归并——ARCH-011~017 归为
  第一轮主线支线、登记长期任务 REQ-046（API 接口开发）/REQ-047（数据库设计）、roadmap 登记
  五轮主线（ARCH-018~022）；**API 文档按五类重构**（服务管理/配置语义/数据透传·Tracker/
  数据透传·Axiom/监控诊断与 LLM 网关，REQ-046）；**数据库总纲补登记 qed_llm_calls**（ARCH-016）
  并加表清单总览；**todo 按五轮主线分节排序**、REQ-041/043 关闭归档 completed.md；
  **门禁全绿（契约 50 + 全量 296 + ruff clean）**；子项目范本调整经请求由对方执行
  （REQ-048/049 → V2-015/QED-027）。**同轮收尾关闭**：ARCH-012（后端三域拆分轮，三域迁移 +
  监控诊断端点全绿，Task 18 真实环境验收随前端控制台真实消费覆盖）、ARCH-013（文档与数据边界
  整理轮，三域文档梳理 + todo 清理合并 + dataset/dataset 边界新模式）、ARCH-014（LLM 状态收敛
  与 DB 启动快照轮，端点删除 + 快照实施 + 冒烟通过）、ARCH-017（密钥收敛与厂商选择，文档 +
  门禁 + QED-Tracker 回执）；**「每次版本更新重新梳理文档体系」登记长期任务 REQ-050**。
  计划归档至 history/plans/2026-08/。
- 已完成：**LLM 网关与模型管理轮（ARCH-016，2026-08-23 关闭）**——三项目密钥约定
  （各 `.env` 自持 `API_KEY` 统一变量，旧变量降级别名；`QED_API_SELECT` 选 api/local 模式）、
  8900 LLM 网关端点（/llm/text、/llm/vision、/llm/test/*、/llm/calls、/database/test）、
  qed_llm_calls 调用记录（单表三项目可写，DB 不可达降级）、本地模型生命周期脚本
  （scripts/text-model/ + scripts/image-model/，MinerU 编排迁入）、资源互斥（QED_RESOURCE_GUARD）、
  控制台 GPU 总览条 / 依赖组件三卡 / 模型调用记录检索页；Task 17 门禁收口（后端 282 + ruff +
  契约 48、前端 vitest 100 + tsc + build、api 模式真实冒烟 qed_llm_calls 落库）；**子项目回执
  齐备**：REQ-043（QED-Tracker QED-037）+ REQ-044（Axiom-Flow V2-014，fcb9eb9..9573fb0，
  T6 网关冒烟 call_id=17）；local 模式根仓库侧冒烟经用户裁决由日常使用自然覆盖。
  计划归档至 history/plans/2026-08/。**同日关闭跨项目支线**：REQ-039（Axiom-Flow 服务化脚本，
  V2-011 f5d9355 + 根仓库 axiom 单元黑盒接入）、REQ-044（V2-014）、REQ-040（生命周期脚本
  `_pid_is_alive` 编码修复三方落地：根仓库 web + QED-Tracker QED-035 + Axiom-Flow V2-012 729d208）。
- 已完成：**前端重构主轮（ARCH-011，2026-08-21 关闭）**——React 19 + AntD 全家桶
  重建 8903（web-ui/），核心四界面（主界面/控制台/仪表盘/下载管理）Phase 0~5 全部通过
  浏览器验证；serve_web.py 指向 dist、旧 web/ 退役、test_web.py 守护迁移至 web-ui/src 源码；
  门禁全绿（build + vitest 100 + tsc 零错 + pytest 296）；ADR 0008 + frontend-architecture.md
  已落盘。计划归档至 history/plans/2026-08/。
- 已完成：**下载管理界面重构轮（ARCH-015，2026-08-21 关闭）**——左树四层（高等数学→
  分类→课程→教程叶子+进度）、右侧流程筛选（搜索/确认/下载/验收+保留三下拉）、书籍卡去
  kind、书籍排序；REQ-041 回执已收到（QED-Tracker QED-036）；浏览器验证通过。
- 已完成：**v0.1 版本目标对齐——[文档与架构重构轮（ARCH-008）](../history/plans/2026-08/2026-08-docs-refactor-round.md)**
  （2026-08-10 归档，Achieved）：docs/ 九节逐节梳理完成（W1 adr/ 至 W9 ADR 清理 + REQ-024），
  **文档基线定格**——ADR 六份（领域枚举收敛为工程治理/架构与边界）、标准/设计/计划/台账
  与契约测试一致，151 passed + ruff clean；跨项目设计级请求（REQ-022/023/026/027）已在
  两个子仓库建设计文档与承接登记（ALN-008/009、QED-022/023），待用户评审。
  **架构轮（ARCH-009，ADR 0007，2026-08-11 冒烟闭环）**：前端唯一入口 8900——目录重整（backend/
  database/tmp/scripts）、数据域语义 API（data.py）、服务域 /services 实装（service_manager.py）、
  前端唯一入口切换（app.js），P0-P5 完成，**真实冒烟闭环（8900/8901 联调：数据域真实数据 + /services 启停托管 start/stop/restart + 409 窗口 + 优雅停止），181 passed + ruff clean**，修复 ROOT 路径错位（parents 层级）与 Popen 失败句柄泄漏，归档待用户验收。
- 进行中：**联调矩阵与契约冻结编排（2026-08-16 立档，[cross-project-contracts.md](../design/cross-project-contracts.md)）**——
  三组并行联调：A 前端↔8900（并行推进中）/ B 8900↔8901（**QED-031 迁移 0006 已冻结**——
  2026-08-17 QED-Tracker 回执：alembic=0006、五表落库（4 知识/12 书籍/16 渠道）、真实冒烟
  通过，REQ-035 前置解除）/ C 8900↔8902（根仓库侧托管/监控已具备；**执行方 = Axiom-Flow v2
  （V2-003~007，V2-003 误建产物已登记移交 REQ-036，2026-08-16 亡羊补牢——根仓库侧不再
  写子项目代码）**，服务建立后即可 C 组第一阶段联调，第二阶段待 v2 契约冻结 REQ-034 承接）；
  各服务独立开发阶段，验收窗口见矩阵文档。
- 已完成（Partial 收口，2026-09-20）：**第三轮主线·解析联调轮（ARCH-020，2026-09-14 重构）**——「文档解析管理」初版
  模块设计定型：[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md) 确立**模型生命周期归
  8900、解析管线归 Axiom-Flow（引擎适配器直连模型服务）**；设计正文两份
  [解析管理 UI 设计](../design/parsing-ui.md)（左树进度 + 原页 bbox 对比 +
  块级编辑：判定/备注/文字/范围；PLAN-043 已晋升）与
  [与 Axiom-Flow 交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md)（af_* 四表 +
  8902 契约 + 产物布局）。  **本轮为文档重构**（Phase A 根仓库 / Phase B Axiom-Flow）；
  实现按「准备 → 实现 → 验收」推进：准备 = [解析管理 UI 设计](../design/parsing-ui.md)（PLAN-043 已晋升）
  + MinerU 模型已部署（PLAN-045 已关闭）；
  实现拆 ARCH-020-B/C/D（8900/8902/8903），验收 ARCH-020-E，数据操作
  （qed 统一 + axiom/xqfm 删除 + dataset 清理）为 ARCH-020-F。
  旧形态（REQ-034/042、af_block_reviews、`dataset/axiom-flow/`）随重构取代。
  **2026-09-20 联调最小打通轮完成**：8900 单向追 8902 v2 契约（/review 门面转 /edit、sync
  file_path、parse-jobs engine/`id`/progress 对象、page_no 与 image_url 补写、树 domain 空
  课程回退），qed 库 af_* 四表已迁移（alembic 20260917_0001）；E2E 实证 sync（4 本
  file_path 非空）→ ingest（486 页）→ 页图代理 → 树/前端渲染全通；**剩余阻塞**：REQ-075
  扩充——8902 MinerU 引擎轮询 `/get_task_results` 对容器 3.4.4（实际 `/tasks/{id}/result`）
  404，解析产物待其对齐后 ARCH-020-E 方可验收。**2026-09-20 ARCH-020-C 收尾**：af_* 四表已落地
  （迁移 20260917_0001），根仓库 [数据库总纲](../architecture/database-design.md) af_* 转正
  （规划→已落地），REQ-027 关闭（以迁移落地为回执）；当前聚焦两份设计文档
  （[parsing-ui](../design/parsing-ui.md) / [交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md)）
  随联调与实现持续优化至初版（发现偏差续登 [design-bugfix-log](../plans/design-bugfix-log.md)）。
  **2026-09-20 解析界面四轮收口（UI 展示轮 → WB 重设计 → D 实现 → G 单屏回调，全部关闭归档）**：
  最终形态定档**单屏「左书目树（纯选择）+ 右对照工作台」**——bbox 双向联动、块编辑+判定、
  单页/全本解析+进度、连续滚动、URL `?book&page` 恢复全保留；界面全中文（「ingest」→
  「书页入库」、顶部单一「刷新」含同步书目）；两级列表态（BookList/BookTable）退役删除。
  四份计划壳并入 [parsing-ui.md](../design/parsing-ui.md) 后归档 `history/plans/2026-09/`。
  **遗留**：REQ-080（产物版本划分）与 REQ-081（bbox 坐标钳位缺陷）待 Axiom-Flow 回执，
  回执后按 §13 复测对照对齐；ARCH-020-E 端到端验收仍阻塞于 REQ-075（Rudin b05/b11 尚未入库）。
  **2026-09-20 主线收口（用户裁决 Partial）**：B/C/D 与界面四轮全部关闭归档（见
  [completed.md](completed.md)），E/F/REQ-075/080/081/PLAN-044 留 todo 独立跟踪。
- 进行中：8903 前端十五期（文档下载管理课程分页，ARCH-007，待用户浏览器验收后归档）；
  文档基线之上的主线推进为**课程收集主线（ARCH-002）**——QED-Tracker QED-019（01 数学分析
  闭环）与 QED-014 全链路联调冒烟待执行，回执后在 8903 展示验收；前端后续十六期与
  **学习中心（双目标：知识学习 + AI 技术学习实践场）** 按 roadmap 排队。
- 2026-08-14（二十二期续）：主界面**学习中心框架**已搭——领域→课程→章节/知识点浏览
  （数学试点，章节空态等解析产物管线，学习功能现状文档更新 Partially Implemented）；
  管理后台树加载加固（loadTree 全函数 try/catch + 离线横幅 + 自动重试，杜绝无限转圈/空白）。
- 待开始：REQ-018 人工评审优化（QED-020 已实现待 8901 重启回执）。（原「REQ-022/023 治理契约
  对齐」「REQ-026/027 数据库设计确认」均已关闭，见 [completed.md](completed.md)。）
- 详情见[任务台账](todo.md)。

## 维护规则

- 服务实现状态、端口或当前主线变化时，更新本表并刷新「最后更新」日期。
- 本表不保存任务细节与未来规划（分别见 todo.md / roadmap.md）；与四服务架构的静态
  描述不一致时，以本表当前状态为准并回修[四服务架构](../architecture/four-service-architecture.md)。
