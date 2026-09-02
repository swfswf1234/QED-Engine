# ADR 0008：前端框架与工程化选型：React 全家桶重构 8903

状态：Superseded
日期：2026-08-16
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

## 背景

8903 前端自三期起为原生静态单页应用（`web/` 三文件：index.html + app.js + style.css），
app.js 已膨胀至约 1684 行、91KB，承载 17 期迭代的全部逻辑（三表下载管理、服务控制、
仪表盘流水线、知识树等）。持续迭代暴露三个问题：

1. **问题定位困难**：单文件承载全部逻辑与渲染，交互与数据耦合，样式与结构靠类名约定
   维系，改一处影响他处后难以定位根因。
2. **界面解耦诉求**：规划中的九大界面（主界面 / 知识探索 / 课程学习 / 刷题 / 控制台 /
   仪表盘 / 下载管理 / 文档解析对照 / 知识点检索调试）需要稳定可独立演进的组件边界。
3. **复杂交互需求**：知识图谱（有向图点击展开）、仪表盘大图、聊天答疑、块级标注、
   RAG/Agent 调试面板——原生手写维护成本高，成熟组件与可视化生态可显著降低实现风险。

同时后端规划为三域解耦（配置/控制、QED-Tracker 适配、Axiom-Flow 适配，见
[backend-domain-split.md](../../../design/backend-domain-split.md)），前端独立演进与之配套，
为后续「前端独立 + 后端各域独立」的并行推进做准备（2026-08-16 用户方向裁决）。

## 决定

1. **前端框架与工程化**：React 19 + TypeScript + Vite 构建；React Router 路由；
   Zustand 状态管理；Ant Design 5 组件库；AntV G6（知识图谱有向图）；ECharts（仪表盘大图）；
   Vitest + Testing Library 组件测试。
2. **界面解耦**：按页面分目录（`web-ui/src/pages/<界面>/`），通用组件与状态独立
   （`components/`、`stores/`），修改一界面不影响其他界面；统一主题 token（蓝白主色、
   黑字、字体与背景高对比）与统一 API 客户端（唯一入口 8900，见 ADR 0007）。
3. **迁移策略**：地基先行、分批替换——过渡期 8903 保持旧前端运行（`web/`），新前端
   （`web-ui/`）在 Vite dev Server 开发；每完成一批界面即验证，全部完成后 8903 切换
   构建产物（`serve_web.py` 指向 `web-ui/dist/`），旧 `app.js` 退役。
4. **本轮范围**：核心四界面（主界面 / 控制台 / 仪表盘 / 下载管理）；知识探索（G6 图谱）、
   课程学习、刷题、文档解析对照、知识点检索调试为后续轮。
5. **纯前端改造（2026-08-16 用户裁决修订）**：本轮只做前端部分；控制台只用既有端点
   （/services、/config/database、/config/llm-status）。GPU 监控 / LM Studio 探测 /
   mineru 健康 / 服务日志查看 / 8900 自身重启等监控与诊断端点不再本轮实现，契约登记于
   [../architecture/api-contracts.md](../../../architecture/api-contracts.md) 后续轮（后端三域拆分轮）落地。

> 修订记录：2026-08-16 原文「控制台配套：8900 后端新增监控与诊断能力（GPU nvidia-smi
> 监控、LM Studio 探测、mineru 健康探测、服务日志查看、8900 自身重启）」经用户裁决
> 改为纯前端范围，监控端点整体后置。
>
> 勘误：2026-08-20 用户裁决当前项目版本为 v0.1（跑通完整服务），本 ADR 决策阶段原标记
> v0.2 更正为 v0.1。

## 后果

- 引入构建步骤与 npm 依赖（web-ui/ 独立于 web/），8903 由直接托管静态三文件改为
  托管构建产物（静态文件仍无后端依赖，独立性铁律不变）。
- 旧 `web/` 在切换后退役（git 历史保留）；`tests/test_web.py` 的 token 守护迁移至
  `web-ui/src/` 源码（守护 API_BASE=8900、零 8901/8902 直连、路由清单与关键契约）。
- 过渡期维护成本：旧前端与新前端并存一段时间的双守护；切换后单前端。
- 存量功能（三表状态机、服务控制、仪表盘流水线、知识树）在四界面重构中重写，语义
  不降级；既有 196+ 后端测试作为迁移安全阀。
- 后端三域拆分与监控诊断端点（随后续轮）不随本轮落地；backend-domain-split.md 保留为
  后续轮参考文档。

## 关联

- 关联 ADR：[ADR 0002](0002-frontend-and-port-centralization.md)（全局端口规划）、
  [ADR 0007](0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）
- 关联设计：`docs/design/frontend-react-refactor.md`、`docs/design/backend-domain-split.md`、
  `docs/architecture/api-contracts.md`、`docs/design/service-control.md`
- 关联架构：`docs/architecture/four-service-architecture.md`