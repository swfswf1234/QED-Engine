# learning/ 类目退役改造计划（learning-retirement）

状态：Completed
任务类型：A
最后更新：2026-09-22
关联 ADR：[ADR 0015](../../../adr/0015-learning-category-retirement.md)（learning/ 个人学习资料类目退役）
关联设计：[tech-stack.md](../../../design/tech-stack.md)（选型结论承接位）、
[downloads-flow.md](../../../design/downloads-flow.md)（阶段 0 事实源改道）
关联 Tracker：docs/trackers/todo.md（REQ-090 任务行 + PLAN-052 镜像行）
归档判定：Retain（记录了已执行的删除操作——docs/learning/ 8 份文件整体删除，需留审计
证据；旧文件由 Git 历史找回）

> 定级说明（阻止项，ADR 0012）：docs/ 目录结构变化默认阻止，本壳即用户 2026-09-22
> 明确同意（「learning/ 部分可以删除，直接看正式稳定文档即可」+ 完整流程与 txt 一并删除
> 两问裁决）后按「人类同意 + todo + plans/ 改造计划」执行的承接。

## 目标与成功标准

learning/ 类目从 docs/ 治理结构中干净退役：

- 目录删除：`docs/learning/` 8 份文件（7 份技术学习笔记 + 《突破朗道位垒》.txt）整体删除，
  内容不迁移、不摘要；
- 引用零残留：现行文档（非 history/）不再指向 learning/ 文件；`test_markdown_links` 无
  因删除新增的失效链接；
- 治理同步：doc-governance.md 三处类目条款删除、契约目录清单同步、docs/index.md 行删除。

成功标准：契约测试与全量门禁全绿；grep `learning/` 在现行文档中仅剩「已退役/靠 Git 历史」
类说明性提及。

## 范围与非目标

- **范围**：ADR 0015 四步决定（退役/标准/契约/引用）+ 台账收口；纯文档与契约测试改动，
  不动业务代码。
- **非目标**：不迁移或摘要笔记内容（正式文档已承载结论，见 ADR 0015 背景）；不动
  history/ 历史正文（仅链接修复）；不重设计学习中心笔记形态（归 ARCH-022 / REQ-089
  第二批）。

## 前置条件

| 前置 | 状态 | 说明 |
| --- | --- | --- |
| 用户明确同意删除（含 txt 一并删除、走完整流程） | 2026-09-22 裁决达成 | AskUserQuestion 两问确认 |
| 笔记结论已有正式文档承接 | 已达成 | tech-stack.md / PLAN-050 壳 / REQ-070-LEARN 现状壳（ADR 0015 背景） |
| ARCH-021 整合关闭落账 | 已完成 | 2026-09-22 第四轮整合轮（completed.md） |

## 工作项

| 项 | 内容 | 完成证据 |
| --- | --- | --- |
| W1 | 立项三件套：ADR 0015 + 本壳 + todo REQ-090/PLAN-052 两行 | 本轮落盘 |
| W2 | 治理与契约同步：doc-governance.md 删类目表行/命名豁免/归档豁免三条；test_document_structure.py 目录清单与索引必备项去 learning | 契约全绿 |
| W3 | 删除 `docs/learning/` 全部 8 份文件（不迁移不摘要） | Git 历史可找回；plans/index 归档登记 |
| W4 | 现行引用改道：docs/index.md 行删除；tech-stack.md 三处；downloads-flow.md 阶段 0 事实源；REQ-070-LEARN 现状壳笔记指向（含知识图谱暂不做口径）；todo/roadmap「learning/ 学习探索」面措辞；归档壳 2026-08-18 两处断链修复 | test_markdown_links 全绿 |
| W5 | 收口：本壳转已关闭移 `history/plans/2026-09/`（内部链接调深度）、plans/index.md 归档登记、completed.md REQ-090/PLAN-052 两行、project-status.md 注记 | 门禁全绿 |

## 验证与验收

- `tests/contract` 全绿（含 test_document_structure / test_markdown_links /
  test_plan_governance / test_tracker_governance / test_adr_governance）+ 全量 pytest 全绿；
- 复核：仓库内 grep `learning/` 仅剩退役说明性提及与 history/ 历史正文。

## 回滚

- 删除的文件均可由 Git 历史找回（learning/ 全部为已跟踪文件，删除发生在未提交工作区时
  `git checkout -- docs/learning` 即可整体恢复）；
- 文档与契约改动为单轮提交粒度，revert 即回滚；ADR 0015 如被推翻则标 Superseded。

## 关闭与归档

关闭条件：W1~W5 全部完成、门禁全绿、用户确认。归档判定 Retain（有已执行删除操作）→
移 `history/plans/2026-09/`，plans/index.md 登记去处，todo REQ-090/PLAN-052 两行原子
移除并写入 completed.md。

**收口记录（2026-09-22）**：W1~W5 全部完成——ADR 0015 落盘、`docs/learning/` 8 份文件
删除（Git 历史可找回）、doc-governance 三条目删除、契约目录清单同步、现行引用全部改道、
本壳 Retain 归档至本目录。
