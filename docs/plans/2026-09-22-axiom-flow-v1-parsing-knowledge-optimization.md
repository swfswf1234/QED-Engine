# Axiom-Flow（V1.0）解析与知识库优化滚动记录（axiom-flow-v1-parsing-knowledge-optimization）

状态：In Progress
任务类型：A
最后更新：2026-09-22
关联 ADR：无新增（治理沿用 [ADR 0011](../history/adr/v0.1/0011-pending-design-location.md) 不确定文档暂居 plans/；跨项目执行边界见 standards/cross-project-collaboration.md）
关联设计：[dataset-conventions.md](../design/dataset-conventions.md)（产物布局）、
[交互全链路](2026-09-14-parsing-management-axiom-flow-chain.md)（8902 契约 + af_* 四表事实源）
关联 Tracker：docs/trackers/todo.md（ARCH-025 任务行，一任务一行一壳，ADR 0016）
归档判定：Retain（滚动记录，关闭时按当时里程碑归档 history/plans/）

## 目标与成功标准

**目标**：承载 ARCH-025「Axiom-Flow（V1.0）优化轮（解析 + 知识库）」的**同步优化记录**——
解析优化与知识库面两线发现的每一个优化项/bug 在本壳登记（现象、定位、方案、责任侧、状态），
与 Axiom-Flow 侧台账同步；本壳是根侧唯一滚动记录，不为单项优化另立计划。

**启动门槛（2026-09-22 用户裁决）**：本线**待 Axiom-Flow 达到 V1.0 版本后启动**；在此之前
本壳只预承接 REQ-089 调研（DeepTutor Axiom-Flow 部分切片）与立项框架，不排实施。

**范围边界（2026-09-22 用户裁决）**：Axiom-Flow 只负责**把文档解析成大模型易消费的 JSON
产物 + 数据库知识面**（af_* 表、后续知识图谱/向量库）；**渲染归根仓库 8903 前端
（[学习设计轮 M1 壳](2026-09-23-learning-ui-rendering.md)，渲染基线为其 UI-1 线）**，不入本线。
**整合承接（2026-09-22 用户二次裁决）**：第四轮主线 ARCH-021 已过时并整合入本线——
「RAG 切片和检索 + 文档解析管线」的优化项目与未来规划见下文「REQ-089 第一批调研承接」节；
**知识图谱暂不做**（roadmap 预留，RAG 成熟后再裁）；对话问答/课程效果面归 ARCH-027。

**成功标准**：

1. 两线（解析 / 知识库面）各有登记表区，条目状态与实际一致；
2. 涉及子项目改造的条目已按跨项目协作规范向 Axiom-Flow 登记请求并跟踪回执；
3. 根侧可独立修复的条目（8900 门面消费、af_* 总纲文档）修复后门禁全绿并回填证据；
4. 上游关联项收口时同步回填：REQ-086/087 **已于 2026-09-23 收口**（用户裁决 A＝以对方 PLAN-007
   真机证据+回执关闭，见 completed.md）；其「W6 全本复测 + 老代基线 `$$$` 双包定界符产物的
   **数据侧**自愈核验」随之转**后续观察项**，挂 ARCH-028 稳定性轮首次真机演练顺带做（渲染侧
   核销归 ARCH-027-M1 UI-1，不变）。

## 范围与非目标

**范围**：两线优化项的登记、评估与根侧承接修复记录——产物 JSON 页级质量与结构对大模型的
易消费性（分块、空白页、块结构、版面判定，含老代基线 292 页 `$$$` 双包定界符产物的数据侧
自愈核验）、af_* 四表演进、页级失败清单与 jobs 端点的根侧消费（对方侧 REQ-088/其 PLAN-008）、
知识图谱/向量库对接预留。优化项逐条发现即在本壳登记，实施经用户确认排期。

**非目标**：渲染与前端消费界面（归 [学习设计轮 M1 壳](2026-09-23-learning-ui-rendering.md)）；
QED-Tracker 下载面（归 [ARCH-024 滚动壳](2026-09-22-tracker-v1-continuous-optimization.md)）；
知识图谱/图引擎（**2026-09-22 裁决暂不做**，roadmap 预留）；学习中心问答与课程功能
（归 ARCH-027）；不代替 Axiom-Flow 子仓库自身计划（其侧实施在其仓库立项，如 PLAN-007/008）。

## 前置条件

1. ARCH-025 任务行已在 todo 登记（2026-09-22，ADR 0016 改单行单壳）。
2. REQ-086/087 复测三前置（对方提交+回执、Docker Desktop/MinerU 5002 起、8902 换起新码）
   为其后续项基线，不阻塞本壳建壳；**2026-09-23 更新**：①已达成（对方 `d8b09b3`+回执成文）、
   两行已收口，②③随 ARCH-028 真机演练窗口落地。
3. 实施排期前置：Axiom-Flow 侧达到 V1.0 版本（建壳与调研预承接不受此限）。

## 工作项（滚动登记表）

### 线 1：解析优化（产物 JSON 大模型易消费）

| 条目 | 现象/动机 | 方案要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| （待登记） | — | — | — | — |

### 线 2：知识库面（af_* / 知识图谱 / 向量库预留）

| 条目 | 现象/动机 | 方案要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| （待登记） | — | — | — | — |

## REQ-089 第一批调研承接：优化项目划分与未来规划（2026-09-22）

> 用户裁决（2026-09-22）：**知识图谱暂不做**，本轮只做**文档解析管线 + RAG 切片和检索**；
> 第四轮主线 ARCH-021 因已有成熟项目参考（DeepTutor，本地 `D:\coding\demo_program\DeepTutor`
> 只读参照）而过时，其 RAG/知识库内容整合入本节承接，对话问答/课程效果面归 ARCH-027。
> 调研三切片证据已对拍源码（`services/parsing/types.py`、`pipelines/lightrag/block_policy.py`、
> `sidecar.py self_ref`、`rag/index_versioning.py EmbeddingSignature`）。

### 未来规划：V1.0 目标形态（「后续变成什么样」）

```
PDF → 解析管线（MinerU 引擎，已有）
  → blocks 语义分诊（版式块过滤 + 公式/表/图/代码保留 + 未知类型审计 ledger）
  → 知识单元（块级切分为主体：数学感知边界，公式不腰斩；块序号锚点）
  → 向量化（EmbeddingSignature 版本增量：换模型写新版本行、旧版可读可回滚）
  → 检索服务（8902 端点：向量 + BM25 混合 → RRF 融合 → 可选 rerank，
     命中返回书/页/块三级 self_ref 溯源）
  → 消费面：8900 门面 → 8903 探索验证界面（v0 切分校验 → v1 BM25 简易召回 →
     v2 向量混合召回，承自 REQ-082 草案三阶段）+ ARCH-027 问答/课程链路
知识图谱/图引擎：**暂缓不设计**，roadmap 预留位，RAG 成熟后再裁。
```

### 优化项目划分（吸收 / 改造 / 拒绝）

**线 1 · 解析管线**（P 系列，实施多在 Axiom-Flow 侧，逐条转请求）：

| # | 优化项 | 判定 | 来源/证据（DeepTutor 相对路径） |
| --- | --- | --- | --- |
| P1 | `parser_signature` 重跑判定：只哈希影响输出的解析参数（mode/模型版本/公式/表格/OCR 开关），`(源哈希, 签名)` 内容寻址判「要不要重跑」，登记进 af_* 表 | 吸收 | `services/parsing/cache.py`、`types.py:40` |
| P2 | manifest-last 就绪标记 + 半写目录失败重清（比 job 状态字段抗崩溃；与 REQ-087 激活语义互补） | 吸收 | `services/parsing/cache.py`（reserve/cleanup_failed） |
| P3 | blocks 语义分诊策略：过滤页眉/页脚/页码，保留公式/表/图/代码，**未知类型宁收不丢 + 审计 ledger**，版本化策略表（v2 名称兼容） | 吸收（改造：落到 af_pages 块级标记） | `rag/pipelines/lightrag/block_policy.py` |
| P4 | 多解析引擎 bridge（Docling/markitdown/Tika…统一 IR） | 暂缓 | 我们单 MinerU 主线，多引擎属对方侧远期 |
| P5 | 双轨 IR（Markdown 保底 + blocks 富结构） | 已同构（维持） | `types.py:24` `ParsedDocument`，佐证我们四件套方向 |

**线 2 · RAG 切片与检索**（R 系列，知识库面核心）：

| # | 优化项 | 判定 | 来源/证据 |
| --- | --- | --- | --- |
| R1 | EmbeddingSignature → 版本行增量语义（binding/模型/维度/base_url 哈希；变更写新版本、旧版可读可回滚；同签名只追加不重建）——**MySQL 化：af_* 或新表签名列 + 版本行** | 吸收（改造为 DB 承载） | `rag/index_versioning.py`、`llamaindex/pipeline.py:303-346` |
| R2 | 块级知识单元 + `self_ref="blocks.json#/{index}"` 页+块序号锚点（与我们 af_pages 天然同构，溯源必须保留） | 吸收 | `lightrag/sidecar.py:243,276-288` |
| R3 | 检索配方：vector 与 BM25 各取 2×top_k → RRF 融合 → 可选 CrossEncoder rerank（加载失败静默降级=关闭）；BM25 索引持久化 + top_k 按语料量 clamp | 吸收（轻量可抄） | `llamaindex/retrievers.py:138-150`、`rerank.py` |
| R4 | 数学感知切分：以 blocks 为切分单元（REQ-082 草案既有方向），公式/定理块原子性；**DeepTutor 无此答案**（其主链路 SentenceSplitter 512/50 裸切），此为我方自研点 | 自研（草案承接） | 反例证据：`llamaindex/config.py` chunk_geometry |
| R5 | 查询改写：LLM ≤3 变体并行检索再聚合 | 后置 | `smart_retriever.py`；问答面归 ARCH-027 |
| R6 | 8 引擎 provider 抽象 / 纯文件无 DB 存储 / GraphRAG 拍平 txt 丢块结构 | 拒绝 | `rag/factory.py`、`graphrag/ingestion.py`（反例） |

**验证界面承接**：REQ-082 草案三阶段（v0 切分校验 → v1 BM25 简易召回 → v2 向量召回 +
溯源点击跳回原页原块）整体有效，实施时挂 8903 管理中心「探索」位（界面归 ARCH-027-M4/M1，
检索端点归 Axiom-Flow 侧请求）。

### 落地路径

1. **前置消化**：REQ-086/087 收口 + W6 全本复测（解析产物质量基线）；
2. **启动门槛**：Axiom-Flow 达 V1.0 后本线开排——P1~P3 转对 Axiom-Flow 的请求逐条登记，
   R1~R4 涉及 8902 知识库面的在其侧立项、根侧出契约需求；
   **2026-09-22 用户裁决（下沉登记已执行）**：P1~P3、R1~R4 优化项已直接登记进 Axiom-Flow
   仓库登记为其 1.0 任务（该仓库 todo 聚合行 ARCH-021 + 支线行 ARCH-022/023，承载壳为其
   PLAN-009 `docs/plans/2026-09-22-v1-parsing-knowledge-optimization.md`，只立项不排期）；
   根侧本壳转**消费/联调验证跟踪**，条目判据以对方 PLAN-009 壳为事实源，本表 P/R 台账留档；
3. 每一实施项在本壳「工作项」登记表开条目跟踪，不另立计划。

## 验证与验收

- 每条目修复/优化收口时：根侧改动跑对应定向测试与 `tests/contract`；子项目侧以对方回执为据。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯记录文档：删除本文件不影响代码与测试；登记表条目对应的代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件：两线连续一个版本周期无新增条目且遗留条目全部移交/关闭，由用户裁决收口；
关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-025 任务行。
