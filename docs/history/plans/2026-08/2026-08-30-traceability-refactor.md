# 文档与代码双向追溯规范精简计划

状态：Accepted
最后更新：2026-08-30
任务类型：D
关联 ADR：`../history/adr/v0.1/0001-root-contract-tests.md`（追溯机制依据）
关联设计：`../standards/code-document-traceability.md`（精简目标）
关联 Tracker：docs/trackers/todo.md（PLAN-027）
归档判定：内容确定后移出的 ARCH-NNN/DES-NNN 规则归入 architecture/ 或 design/ 维护规则，
计划壳归档至 `../history/plans/2026-08/`

## 目标与成功标准

将 `code-document-traceability.md` 收窄为纯追溯机制文档，移出「架构同步」「设计同步」两节
（占 40% 篇幅）至本计划暂存，待评审后归入各自领域维护规则。

成功标准：
1. code-document-traceability.md 只保留：目的与边界、code-map 与文件头、执行与门禁、变更与取代。
2. 移出的 ARCH-NNN / DES-NNN 规则完整保存在本计划中，不丢失信息。
3. pytest tests/contract 全绿。

## 范围与非目标

范围：code-document-traceability.md 精简、standards/index.md 描述更新、PLAN-027 登记。
非目标：不建立 architecture/ 或 design/ 的独立维护标准文档（由后续评审决定）。

## 前置条件

- 用户确认精简方向（2026-08-30 已确认）。
- ARCH-018 主线关联。

## 工作项

1. 移出「架构同步」节内容，暂存于本计划。
2. 移出「设计同步」节内容，暂存于本计划。
3. 更新 standards/index.md 表格描述。
4. 更新 todo.md 登记 PLAN-027。
5. 验证 pytest 全绿。

## 验证与验收

- `pytest tests/contract -q` 全绿（51 passed）。
- code-document-traceability.md 精简后仍覆盖：code-map 唯一事实源、DesignRef 文件头、agent
  执行清单、变更边界。
- 移出内容完整保存在本计划中。

## 回滚

恢复 code-document-traceability.md 原始内容（从 Git 历史恢复）。

## 关闭与归档

移出的 ARCH-NNN / DES-NNN 规则归入 architecture/ 或 design/ 维护规则后，计划壳归档至
`../history/plans/2026-08/`。

---

## 附录：移出的架构同步规则

```markdown
### 架构同步

- 活跃架构声明关联代码、关联测试和关联 ADR；无实现时写"尚未实现"，不得指向无关代码。
- 服务边界、端口规划、独立性规则、能力归属或 DesignRef 变化时，同步正文、Mermaid、code-map
  和架构语义测试。
- Accepted 约束与当前实现有偏差时，使用稳定 `ARCH-NNN` 在架构符合度和 tracker 双向登记，
  文档实现状态不得写成完全实现。
```

## 附录：移出的设计同步规则

```markdown
### 设计同步

- Design 按可执行流程划分，描述输入输出、接口与数据、状态、失败语义和当前符合度；没有代码
  所有权的概念说明不得单独成为活跃设计。
- 接口字段、端口、跨服务契约或 DesignRef 变化时，同步正文、Mermaid、code-map 和设计语义测试。
- 已接受但未实现的能力使用稳定 `DES-NNN` 在设计符合度和 tracker 双向登记，文档不得标记为
  完全实现。
```
