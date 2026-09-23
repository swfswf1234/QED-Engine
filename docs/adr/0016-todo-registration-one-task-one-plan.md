# ADR 0016：todo 登记方式修订（一任务一行一壳，细节由计划承载）

状态：Accepted
日期：2026-09-22
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

既往主线/轮次登记为**双行双壳**：ARCH-xxx 主线行在 todo 内承载长文描述（范围、边界、裁决、
进度全部塞进行内），另设 PLAN-xxx 镜像行链接计划壳（如 ARCH-024 + PLAN-049、ARCH-025 +
PLAN-050）。该形态暴露两类问题：① todo 行成为计划壳内容的第二副本，漂移与维护成本高；
② 一个任务被拆成两个 ID，与用户的任务-计划一一对应预期不符。

2026-09-22 用户裁决：自 **ARCH-024（含）** 起按新登记方式执行——todo 任务行的重点是写明
「该任务是做什么的、目标/效果是怎么样的」，具体进度、边界、详细内容应在 plans/ 文档中；
任务不再拆成 ARCH + PLAN 两行，原则上一个任务对应一个 plans/ 文档。后续新增轮次（新主线）
须先向用户确认，新的小任务原则上放入已有轮次。

## 决定

1. **一任务一行一壳**：需要计划的任务在 todo 中只占**一个任务行**，该行「任务」列直接链接
   `docs/plans/` 计划壳（链接形式仍受镜像规则守护），取消独立「PLAN 镜像行」；链接后可用
   「——」追加一句话任务定义 + 目标/效果（描述不含嵌套链接与竖线）。
2. **todo 薄登记**：todo 行只写任务定义与目标/效果、关闭条件或下一条件指针；范围边界、
   工作项细节、进度与状态更新一律由计划壳承载（壳内工作项/登记表回填）。计划正文仍是
   状态事实源，todo 行状态镜像壳状态（不变）。
3. **轮次创建与归属**：新增轮次/主线须用户确认后登记；新的小任务原则上并入已有轮次
   （在对应轮次壳开条目或在 todo 挂支线行），不随意另立新轮次。
4. **ID 纪律**：一个任务只占一个 ID，不再为一个任务发两个号；`PLAN` 前缀不再新发用于
   任务行（存量 PLAN 行保留至自身关闭，不改号不重编）。
5. **同步义务**：修订 [task-lifecycle.md](../standards/task-lifecycle.md)（任务层级·主线轮次、
   任务台账结构·任务列、状态导航·事实源、todo 规则节）与
   [doc-governance.md](../standards/doc-governance.md)（任务与文档绑定、镜像行措辞两处）；
   契约测试 `tests/contract/test_tracker_governance.py` 允许任务列「链接 + 一句话描述」；
   项目技能 `qed-intake` / `qed-plan` / `qed-closeout` 同步。

## 后果

- 存量改造（2026-09-22 同轮执行）：ARCH-024/PLAN-049 与 ARCH-025/PLAN-050 两对合并为
  单行，PLAN-049/050 两 ID 退役（壳文件名不变，全库「PLAN-049/050 壳」指称改为对应
  ARCH 行承载壳）；ARCH-026/PLAN-051 经用户裁决维持旧双行形态（该轮将删除重做，本轮不动）。
- todo.md 行数减少、单行变短；接手任务须先读计划壳获取进度与边界（todo 行只给指针与目标）。
- 不取代任何现行 ADR：本决策是 [ADR 0012](0012-ai-development-conduct.md) 变更分级框架下的
  tracker 事实边界修订。

## 关联

- 标准：[task-lifecycle.md](../standards/task-lifecycle.md)、[doc-governance.md](../standards/doc-governance.md)
- 测试：`tests/contract/test_tracker_governance.py`（任务列镜像规则）
- 任务：ARCH-024、ARCH-025（改造后单行，见 [任务台账](../trackers/todo.md)）
- 壳：[QED-Tracker V1.0 持续优化滚动记录](../plans/2026-09-22-tracker-v1-continuous-optimization.md)、
  [Axiom-Flow（V1.0）解析与知识库优化滚动记录](../plans/2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md)
