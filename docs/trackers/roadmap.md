# 能力路线图

状态：Current
最后更新：2026-09-21

本文件只描述无执行状态的后续能力方向，不含任务排期。执行任务登记在[任务台账](todo.md)。
五轮主线（2026-08-20 用户设计，ARCH-018 已完成、ARCH-019~022 已登记 todo）：第一轮架构确定 →
第二轮课程下载 → 第三轮 Axiom-Flow 解析联调 → 第四轮 Axiom-Flow 探索（RAG/知识图谱/问答）→
第五轮学习中心（用户学完一个教程）。

| 方向 | 能力目标 | 关联任务 |
| --- | --- | --- |
| v0.1 版本目标 | 三项目完成初步目标：数学 13 门课程全链路（收集→解析→学习→问答）与 QED-Engine 各功能实现，重构为完整可交付版本，预留未来扩展能力（学科/资料类型扩展、容器化）；文档重构轮与 ADR 治理已完成（2026-08-10，见 completed.md） | REQ-006 |
| 第一轮主线：架构确定轮 | 文档规范调整（architecture/ 固定化：总体架构/服务架构/API/数据库/code-map；project-status 移入 trackers/；guides 操作+开发拆分；trackers 主线归并）+ ARCH-011~017 收尾 + API 接口开发与数据库设计长期任务第一阶段（**已完成，2026-08-21 ARCH-018 关闭**；版本更新文档体系梳理转长期任务 REQ-050） | REQ-046、REQ-047、REQ-050 |
| 第二轮主线：课程下载轮（**已完成 2026-09-11**） | 基于 ARCH-002 扩展：三门基础课（00/01/02）下载与 QED-Tracker 联动（QED-026 主链路），local+api 界面调试成功；探索按钮→检索最合适教程（教材+习题集）→结果界面用户选择/待选→下载流程（QED-Tracker 找渠道，找不到列举渠道用户自下）→审核流程（QED-Tracker 审核+人工确认）。ARCH-019/ARCH-002 已收尾（见 [completed.md](completed.md)） | ARCH-020-E、ARCH-020-F（主线收口存续，见 completed.md） |
| 第三轮主线：Axiom-Flow 解析联调轮 | 与 Axiom-Flow 联调：模型生命周期归 8900、解析管线归 Axiom-Flow（引擎可换），不断优化解析效果直至用户确认（至少完成一个教程的解析）；准备轮（前端设计已晋升 [design/parsing-ui.md](../design/parsing-ui.md) + MinerU 模型已部署） | ARCH-020-E、ARCH-020-F、PLAN-044（主线 2026-09-20 Partial 收口，见 completed.md） |
| 第四轮主线：Axiom-Flow 探索轮 | 与 Axiom-Flow 联调探索：RAG + 知识图谱 + chat 问答，确保课程效果，成熟后作为课程学习部分（完成一个教程）；learning/ 学习探索同步启动（QED-Engine 独有） | ARCH-021 |
| 第五轮主线：学习中心轮 | QED-Engine 同步学习：知识探索、课程学习和课后练习，直至用户学完一个教程 | ARCH-022 |
| QED-Engine 前端 | 学习界面（知识点解析、练习、温故知新）与管理界面（解析进度、原始文档对照、追溯）；学习中心同时是 **AI 技术学习实践场**（LangChain / 多 Agent 构建 / 向量库与 RAG（切片、BM25、rerank）/ 知识图谱） | REQ-006 |
| **探索（文档切分与召回）** | 替换原始文档对照的管理界面：块级切分校验 → 对话式召回验证（BM25 先行 → 向量库混合检索）→ 知识单元产出，为学习中心问答铺底座；方向设计见 [document-chunking-recall 草案](../plans/2026-08-18-document-chunking-recall.md)（2026-08-18 登记，第四轮主线启动；REQ-082 承载） | ARCH-021、PLAN-044 |
| Axiom-Flow 对齐 | 端口 8902、数据目录指向根 dataset/parsed、直读 QED_* 变量、af_* 四表定义确认（af_books/af_parse_jobs/af_pages/af_block_edits；**2026-09-20 已落地建表，REQ-027 关闭**） | PLAN-044、ARCH-020-E |
| QED-Tracker | 学习方向驱动的自主检索与课程收集深化（以其自身 roadmap 为准；服务化 8901 已完成，后续为 LLM 筛选评估与版本核对） | REQ-046 |
| 模型统一配置预留（AGENT / MCP 反代面） | 未来 AGENT、MCP 等统一配置以模型注册表（`services/llm/registry.py` 身份目录）为同一事实源；8900 反代各厂商/本地模型服务面为预留方向（2026-09-21 ARCH-023 收口时登记，本轮不实现，见 [llm-gateway.md](../design/llm-gateway.md)） | REQ-046 |
| 文档治理 | 标准/ADR/计划/台账与契约测试持续演进，三仓库文档体系对齐（以 QED-Engine 为范本，ADR 0010；**子项目对齐已完成**——REQ-048/049 → V2-015/QED-039 回执，REQ-022/023 治理契约对齐落地） | REQ-002、REQ-050 |

## 原则

- 路线图只记录方向与理由，不写排期与状态机。
- 方向进入执行时，迁移为任务台账条目并建立对应计划。
