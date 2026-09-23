# ADR 0015：learning/ 个人学习资料类目退役

状态：Accepted
日期：2026-09-22
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

`docs/learning/` 自 2026-08 建立，定位为「QED-Engine 独有的个人学习资料，不参与工程治理，
内容自由组织」（类目条款见 `standards/doc-governance.md` 三处；历史依据见已归档
[ADR 0010](../history/adr/v0.1/0010-documentation-versioning.md)），作为第四轮主线学习探索
的产出流，沉淀 LangChain/切分/向量库/RAG/BM25-rerank/知识图谱笔记与个人资料文本共 8 份。

2026-09-22 第四轮整合关闭（ARCH-021 整合退役，见 completed.md）时用户裁决：学习笔记的结论
已由正式稳定文档承载——选型结论在 [tech-stack.md](../design/tech-stack.md)、切分与召回规划
并入 PLAN-050 壳「REQ-089 第一批调研承接」节、工具链状态表在 REQ-070-LEARN 现状壳；学习
探索面归 ARCH-022（REQ-089 第二批）重设计，个人笔记目录不再单独维护。

## 决定

1. **类目退役**：`docs/learning/` 从 docs/ 治理结构退役，目录整体删除（8 份文件一并删除，
   含《突破朗道位垒》.txt）；内容不迁移、不摘要，旧文件由 Git 历史找回。
2. **标准同步**：`standards/doc-governance.md` 删除 learning/ 全部类目条款（类目表行、
   命名与索引豁免条、归档豁免条）；个人学习资料如未来再有需求，另立轮次重新设类目。
3. **契约同步**：`tests/contract/test_document_structure.py` 文档目录清单与 docs/index.md
   必备项移除 learning/。
4. **引用改道**：现行文档（docs/index.md、design/tech-stack.md、design/downloads-flow.md、
   REQ-070-LEARN 现状壳）中的 learning/ 指向改为正式稳定文档或 Git 历史说明；history/
   历史正文按「历史正文保持当时结论」不动，仅做链接修复。

## 后果

- docs/ 治理类目收敛为 architecture / design / adr / standards / guides / plans /
  trackers / history 八项，契约目录清单同步。
- 阶段 0 课程体系（downloads-flow.md）事实源改指前端 `COURSE_ORDER`，《突破朗道位垒》
  旧文本靠 Git 历史找回。
- 技术学习线（T1~T4）不再有笔记沉淀义务，学习中心面笔记形态随 ARCH-022 重设计另行裁决。
- 不取代任何现行 ADR：ADR 0010 已归档（Superseded），其 learning/ 类目条款随本次
  doc-governance 修订失效。

## 关联

- ADR：[ADR 0010](../history/adr/v0.1/0010-documentation-versioning.md)（learning/ 类目历史出处，
  Superseded）、[ADR 0012](0012-ai-development-conduct.md)（变更分级：docs/ 目录结构为阻止项，
  本决策即用户明确同意 + todo + 计划壳执行）
- 标准：[doc-governance.md](../standards/doc-governance.md)（类目条款删除）
- 设计：[tech-stack.md](../design/tech-stack.md)、[downloads-flow.md](../design/downloads-flow.md)
- 计划：[learning/ 类目退役改造计划（learning-retirement）](../history/plans/2026-09/2026-09-22-learning-retirement.md)（PLAN-052，收口后归档路径）
- 任务：REQ-090（[任务台账](../trackers/todo.md)）
