# 计划 2026-08-v03：QED-Engine 文档体系对齐与子项目协作规划

状态：In Progress
任务类型：A
最后更新：2026-08-04
关联 ADR：`docs/adr/0001-root-contract-tests.md`、`docs/adr/0002-frontend-and-port-centralization.md`
关联设计：`docs/architecture/four-service-architecture.md`
关联 Tracker：`docs/trackers/todo.md`（REQ-001）
归档判定：完成后 2026-08 计划目录进入 `docs/history/plans/2026-08/` 或按文档规范删除

## 目标与成功标准

1. 根仓库建立与 Axiom-Flow 对齐的文档治理体系：五份标准、ADR 登记、计划与台账、契约测试。
2. 确立四服务架构视图与统一端口规划（8900 配置中心 / 8901 前端 / 8902 Axiom-Flow / QED-Tracker
   CLI 无端口），前端统一归根仓库所有。
3. 对 Axiom-Flow 发起改造请求（端口迁移、数据目录、环境变量、前端迁移），由用户评审后在
   Axiom-Flow 执行。
4. 建立 docs/learning/ 学习笔记体系。
5. 全部契约测试与回归测试通过，完成检查清单逐项满足。

## 范围与非目标

范围：根仓库文档治理（标准、ADR、契约测试）、四服务架构文档、开发指南、计划与台账、学习笔记；
Axiom-Flow 侧仅登记请求与轻量文档表述更新（前端归属、端口规划）。

非目标：
- 不修改 Axiom-Flow / QED-Tracker 行为代码；不在本仓库实现任何新功能。
- 不执行端口迁移、不退役 load-env.ps1、不迁移 web/。
- 不创建 GitHub Release 或标签；不修改 main 分支历史。
- 不评审三份 Draft 设计文档（service-contracts / dataset-conventions / configuration-and-secrets
  保持 Draft，作为 REQ-001 待评审）。

## 前置条件

- 用户确认方案 A（分层完整对齐）与端口 8902 选择。
- 主项目与 Axiom-Flow 工作树干净（基线 f1fbbc3 / 95fc758）。
- QED_env 环境已安装本项目 dev 依赖（fastapi、pytest、ruff、httpx）。

## 工作项

1. 根仓库契约测试（tests/contract/）：standard / adr / plan / tracker / document-structure /
   markdown-links / architecture-documents / design-documents / code-document-mapping /
   test-suite-governance 十个文件，守护本文档体系。✅ 已完成
2. ADR 0001（根仓库契约测试）、ADR 0002（前端统一与端口规划）并登记索引。✅ 已完成
3. 五份标准 + standards/index.md + documentation.md 更新。✅ 已完成
4. 架构文档：four-service-architecture.md、code-map.md、architecture/index.md。✅ 已完成
5. 设计文档关联代码更新（config-center-api / configuration-and-secrets）与受管文件头同步
   （schemas.py、test_api.py、test_config.py）。✅ 已完成
6. AGENTS.md 更新：标准引用、todo/code-map 入口、跨项目协作规则定位。✅ 已完成
7. 开发指南 development.md 与 guides/index.md 更新。✅ 已完成
8. 本计划文件与 plans/index.md 更新。
9. todo.md 重写（ID 表 + 请求登记）、roadmap.md 表格式重写。
10. docs/learning/ 四篇笔记（langchain、切分、向量库、RAG）+ learning/index.md 更新。
11. Axiom-Flow 协作：plans/2026-08-qed-engine-alignment.md、todo 请求行
    （PORT/CONF/DATA/FRONT）、overview/runtime-architecture 前端归属轻量更新。
12. 验证：主项目 pytest 全量 + ruff；受影响契约测试通过；Axiom-Flow 侧契约测试回归。

## 验证与验收

- `conda run -n QED_env python -m pytest tests -q` 全绿。
- `conda run -n QED_env python -m ruff check src tests` 无错误。
- 定向契约测试：test_standard_governance、test_plan_governance、test_tracker_governance、
  test_document_structure、test_markdown_links、test_architecture_documents、
  test_design_documents、test_code_document_mapping、test_test_suite_governance、test_adr_governance。
- Axiom-Flow 侧：pytest 受影响契约测试（标准/文档/ADR/计划/台账）通过。
- 人工验收：用户核对 ADR 0002 端口表、Axiom-Flow 请求行与前端迁移路线。

## 回滚

- 文档与契约测试均为可逆变更；契约测试失败即修改测试或对应文档直至一致，不保留破坏性操作。
- 未提交任何 git 变更前，可用 `git checkout -- .` 恢复干净基线。
- 不涉及数据操作、标签或发布，无独立回滚计划。

## 关闭与归档

- 全部门禁通过后，按文档规范执行 `Retain`（保留本计划至 2026-08 计划目录）或 `Delete` 由
  用户决定；todo 中对应 Plan 行原子移除并写入 completed。
- 本计划不引入新 ADR；ADR 0001/0002 已覆盖决策。
