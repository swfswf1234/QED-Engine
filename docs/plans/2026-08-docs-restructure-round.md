# 2026-08 文档规范与架构确定轮（docs-restructure-round）

状态：In Progress
任务类型：B
最后更新：2026-08-20
关联 ADR：[ADR 0010](../adr/0010-documentation-versioning.md)（文档体系分层与版本治理）
关联设计：[架构索引](../architecture/index.md)、[设计索引](../design/index.md)、
[文档规范](../standards/documentation.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-018 第一轮主线；支线 ARCH-011~017 归并）
归档判定：文档体系落地、契约门禁全绿、用户确认文档规范后关闭，计划正文归档
`docs/history/plans/` 或按事实同步后删除

## 目标与成功标准

第一轮主线（架构确定轮）：按 [ADR 0010](../adr/0010-documentation-versioning.md) 重构 QED-Engine
文档体系为「确定文档 / 相对确定 / 实时状态」三层，并以 QED-Engine 为范本向 Axiom-Flow、
QED-Tracker 发起文档体系调整请求。

- 成功标准：
  - `architecture/` 只含确定文档：总体架构 + 前端/后端服务架构 + api-contracts + database-design
    + code-map；`project-status.md` 移入 `trackers/`。
  - `guides/` 拆分操作文档（operations.md）与开发文档（development.md）。
  - `trackers/` 建立第一轮主线 ARCH-018，ARCH-011~017 归并为支线；登记长期任务 REQ-046
    （API 接口开发）与 REQ-047（数据库设计）；roadmap 登记五轮主线。
  - `plans/` 新建本轮计划；`design/` 完成三态梳理（config-center-api/database-design 迁入
    architecture/，frontend-react-refactor/backend-domain-split 标 Superseded）。
  - 契约测试 + 全量门禁全绿（pytest + ruff + markdown 链接）。
  - 子项目范本调整：根仓库在对方仓库建设计文档 + todo 登记（对方执行后回执）。

## 范围与非目标

- 范围内：QED-Engine 文档体系重构、契约测试同步、源码/测试 header DesignRef 注释同步
  （纯注释字符串，无功能代码改动）、子项目调整请求登记（只写文档）。
- 非目标：本轮不改动任何功能代码；不迁移/不删除子项目文件；不提交 git；ARCH-011~017
  的浏览器验收在主线收尾统一进行；后续主线（2~5 轮）仅登记方向，不启动实施。

## 前置条件

- 用户已裁决：project-status 移入 trackers/、architecture/ 扁平文件、当前版本 v0.1、
  子项目登记请求对方执行、ARCH-011~014 作为第一轮主线支线。

## 工作项

- [ ] **1. ADR 与标准**：新增 ADR 0010；ADR 0008 决策阶段 v0.2→v0.1；adr/index.md 声明当前
      版本 v0.1；documentation.md / adr-governance.md / task-lifecycle.md 同步版本机制与主线归并。
- [ ] **2. 契约测试（红→绿）**：test_document_structure（ACTIVE_GUIDES + operations）、
      test_architecture_documents（固定六文档）、test_design_documents（移除迁出文档）、
      test_tracker_governance（允许 project-status）。
- [ ] **3. 架构固定化**：config-center-api → architecture/api-contracts（+ 前端无 API 声明）、
      database-design → architecture/database-design（总纲，qt_*/af_* 置空指向子项目）、
      新建 frontend-architecture / backend-architecture、four-service-architecture 精简为总体架构、
      project-status 移入 trackers/、code-map 引用更新。
- [ ] **4. guides 拆分**：新建 operations.md；development.md 收敛为开发文档。
- [ ] **5. design 梳理**：design/index 更新；frontend-react-refactor / backend-domain-split 标
      Superseded；其余保持随任务关闭梳理。
- [ ] **6. trackers 归并**：todo 建 ARCH-018 + REQ-046/047、ARCH-011~017 标注归属；roadmap
      登记五轮主线；completed 检查；**API/数据库文档梳理 + todo 主线分节排序（2026-08-20 追加）**。
- [ ] **6a. API 文档重构**：api-contracts.md 按五类组织（服务管理 / 配置语义 / 数据透传·
      QED-Tracker / 数据透传·Axiom-Flow / 监控诊断与 LLM 网关），保留前端无 API 声明。
- [ ] **6b. 数据库总纲梳理**：database-design.md 补登记 qed_llm_calls（ARCH-016）、表清单
      总览表（qed_*/qt_*/af_*/学习表族），qt_*/af_* 保持置空指向子项目文档。
- [ ] **6c. todo 主线排序**：todo.md 按五轮主线分节（第一~五轮 + 长期任务）、行格式规范化、
      REQ-041/043 关闭移入 completed.md；契约测试 _table 解析支持分节/空行。
- [ ] **7. 索引与路由**：docs/index、trackers/index、guides/index、AGENTS、README 链接更新；
      失效链接修复（含 history/plans）。
- [ ] **8. 门禁验证**：pytest tests/contract + pytest tests -q + ruff check backend tests；
      输出展示。
- [ ] **9. 子项目调整请求**：Axiom-Flow / QED-Tracker 各建设计文档（docs-restructure-template）
      + todo 登记，用户评审后对方执行。

## 验证与验收

- `pytest tests/contract -q` 全绿（文档结构/ADR/计划/台账/链接/架构/设计/映射）。
- `pytest tests -q` 全量通过 + `ruff check backend tests` 无错误。
- 用户验收：文档体系结构（architecture/ 六份固定文档、trackers/ project-status、guides/ 两份）、
  主线与长期任务登记、子项目调整请求单。

## 回滚

- 文档重构为纯文档变更：如用户不满意结构，可 git 回退到重构前基线（本次不提交，
  由用户或后续评审决定提交时机）。源码仅 header 注释改动，无功能影响。

## 关闭与归档

- 关闭结果：Achieved（用户确认文档规范 + 门禁全绿）。
- 归档：本轮计划进入 `docs/history/plans/2026-08/`；本 ADR 0010 的决策保持；
  ARCH-011~017 随第一轮主线收尾浏览器验收后关闭进 completed.md。
