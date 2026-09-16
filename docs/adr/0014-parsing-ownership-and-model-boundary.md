# ADR 0014：解析能力归属与模型边界

状态：Accepted
日期：2026-09-14
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

## 背景

v0.1 的模型调用形态由 [ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口
8900）与 [llm-gateway.md](../design/llm-gateway.md) 确立：`qed-engine` 模式下三项目统一经 8900
`/llm/*` 网关调用，且「MinerU 仅经 8900 网关可达」（Axiom-Flow
`docs/design/model-mode-config.md`，REQ-044 执行）。

「文档解析管理」联调（第三轮主线 ARCH-020）暴露出该形态的三处不匹配：

1. **结构化信息丢失**：8900 `/llm/vision` 对 MinerU 只回传 markdown 字符串，丢弃
   `content_list`/`middle.json` 的块级坐标（bbox），无法支撑原页对照与块级编辑；
2. **调试割裂**：模型调用、预处理、后处理分散在 8900 与 Axiom-Flow 两侧，解析效果调试需
   跨两个仓库与两次部署，无法一端闭环；
3. **模型耦合**：Axiom-Flow 的 `llm_client` 双模式把「local 直连 qwen-vl / qed-engine 经网关」
   写进业务侧，换模型（MinerU / PaddleOCR-VL）需改动 Axiom-Flow 调用链。

2026-09-14 用户裁决：**模型运行时与生命周期归 8900；完整解析管线归 Axiom-Flow，保证一端可
完整调试**；模型选择/预处理/后处理在 Axiom-Flow 侧统一，Axiom-Flow 不感知具体模型。

## 决定

1. **模型生命周期归 8900**：OCR 模型（MinerU 先落地，PaddleOCR-VL-1.6 预留，云端 qwen-vl
   档位保留）的模型文件槽位、`/models/{name}` 启停/重启、健康探针与资源互斥由 QED-Engine
   后端统一管理，控制台呈现依赖组件状态。
2. **解析管线归 Axiom-Flow**：PDF ingest（渲染页图）、引擎适配器（调用模型服务）、后处理
   归一化（统一 blocks schema）、解析编排（任务/页状态/重试/质量信号）、产物落盘（`parsed/`
   区）、对照数据供给与人工编辑落库全部在 Axiom-Flow 实现，作为解析能力的唯一调试与实现位置。
3. **解析调用不经 8900 网关**：Axiom-Flow 经引擎适配器直连模型服务（如 MinerU 8002），
   模型服务地址可配置（部署形态需要时可指向 8900 提供的代理地址，契约不变）；8900
   `/llm/vision` 降级为控制台测试与通用视觉用途，不再承载解析流量。
4. **模型无感知**：Axiom-Flow 对模型的选择与输出格式无感知——引擎差异在适配层消化，统一
   契约（页级 blocks+bbox+markdown）为 Axiom-Flow 内部事实源；换模型只改配置与适配器。
5. **独立性**：解析不再要求 8900 在线；模型服务可经根仓库脚本手动启停，8900 离线时仍可解析。
   [ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）不变——
   前端仍只连 8900，8900 继续适配透传 8902。
6. **部分修订** v0.1「MinerU 仅经 8900 网关可达」的解析路径；该表述随本 ADR 修订
   （[llm-gateway.md](../design/llm-gateway.md)、
   [local-model-management.md](../design/local-model-management.md)），不构成对既有 Accepted ADR
   的完整取代。

## 后果

- 解析能力有了唯一实现与调试位置（Axiom-Flow）；新增引擎或换模型只动适配层与配置，业务链稳定。
- 8900 保留模型运维面（启停/探针/控制台），不再承担解析流量，职责收敛为「模型生命周期 +
  数据域适配 + 共享表读取」。
- Axiom-Flow `llm_client.py` 的双模式视觉调用退役，改由引擎适配器承接；`qed_llm_calls` 调用
  记录由 Axiom-Flow 在直连成功路径自写（`service=axiom_flow`）。
- 解析产物格式、`af_*` 表结构与 8902 契约需按新形态重新定义（详见两份设计文档：
  [解析管理 UI 设计](../design/parsing-ui.md)、
  [与 Axiom-Flow 交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md)）。
- 部分推翻 REQ-044 / V2-014 的「MinerU 仅经网关可达」实现约定；相关设计文档同步修订。

## 关联

- ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900，不变）、
  [ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)（端口规划）、
  [ADR 0005](../history/adr/v0.1/0005-control-center-service-hosting.md)（服务托管）
- 设计：[llm-gateway.md](../design/llm-gateway.md)、
  [local-model-management.md](../design/local-model-management.md)、
  [cross-project-contracts.md](../design/cross-project-contracts.md)、
  [dataset-conventions.md](../design/dataset-conventions.md)
- 架构：[four-service-architecture.md](../architecture/four-service-architecture.md)、
  [api-contracts.md](../architecture/api-contracts.md)、
  [database-design.md](../architecture/database-design.md)
- 计划：[与 Axiom-Flow 交互全链路](../plans/2026-09-14-parsing-management-axiom-flow-chain.md)、
  [解析管理 UI 设计](../design/parsing-ui.md)
- 任务：ARCH-020（[任务台账](../trackers/todo.md)）
- 子项目：Axiom-Flow `docs/adr/0004-model-boundary-and-pipeline-ownership.md`（同轮对齐）
