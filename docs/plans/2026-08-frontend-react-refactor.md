# 2026-08 前端重构主轮（frontend-react-refactor）

状态：Accepted
任务类型：B
最后更新：2026-08-16
关联 ADR：[ADR 0008](../adr/0008-frontend-react-refactor.md)（框架与工程化选型）、
[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)、[ADR 0002](../adr/0002-frontend-and-port-centralization.md)
关联设计：[前端重构设计](../design/frontend-react-refactor.md)、
[配置中心 API 契约](../design/config-center-api.md)（监控与诊断域登记，实施后置）、[服务控制设计](../design/service-control.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-011 登记；REQ-021 大变动同步承接文档）
归档判定：各 Phase 逐阶段用户验证通过 → 8903 切换完成 + 旧前端退役 + 测试迁移全绿 →
文档同步后 Completed，归档至 `history/plans/2026-08/`

## 前置条件

- 2026-08-16 用户方向裁决：前端重构为当前最高优先级，**本轮只做前端部分改造**；后端
  三域拆分（[backend-domain-split.md](../design/backend-domain-split.md)）与监控诊断端点
  不在本轮，保留文档作为后续轮参考；框架选型 React + AntD 全家桶（ADR 0008）。
- 设计文档已落盘并通过用户验收（2026-08-16）：frontend-react-refactor.md、
  config-center-api.md（监控域登记）、service-control.md（控制台增强）、ADR 0008、
  本计划（修订版：纯前端 + 阶段门禁）。
- **执行流程约定**：每个 Phase 完成后暂停，用户浏览器验证通过才进入下一 Phase
  （阶段门禁）；文档基线在 Phase 0 前提交 git（安全回退点）。

## 目标与成功标准

1. 8903 前端整体切换为 React 19 + TS + AntD 5 实现（web-ui/），核心四界面
   （主界面 / 控制台 / 仪表盘 / 下载管理）可用，视觉蓝白主题、黑字高对比、自适应缩放。
2. 控制台只用既有端点（/services、/config/database、/config/llm-status），无新增后端端点。
3. 8903 切换构建产物（serve_web.py 指 web-ui/dist），旧 web/ 退役；tests/test_web.py
   守护迁移至 web-ui/src/ 源码。
4. 文档同步：web-frontend.md v2 重写、code-map、四服务架构符合度、project-status、
   README/AGENTS（REQ-021）。

成功标准：`pytest tests -q` 全绿 + ruff clean + `npm run build` + vitest 全绿；
四界面逐阶段浏览器验收（含离线降级与对比度检查）；8903 全路由冒烟。

## 范围与非目标

范围内：
- `web-ui/` 新 React 项目（src/pages 四界面、api、stores、components、theme）；
  Vitest 测试；Vite dev proxy（/api → 8900，避免 CORS 面扩散）。
- `scripts/serve_web.py` 调整（指向 dist，保持 8903 + no-store）。
- 测试与文档同步（上节）。

非目标（本轮不做，后续轮参考文档保留）：
- 后端三域拆分（[backend-domain-split.md](../design/backend-domain-split.md)）。
- 监控与诊断端点（/logs、/monitor/*、/self-restart，config-center-api.md 登记保留）。
- 控制台 GPU/LM Studio/mineru/日志查看展示。
- Axiom-Flow 适配层、本地 LLM 调用接口（LLM 网关 / prompt 调试，第二轮）。
- 知识探索 / 课程学习 / 刷题 / 文档解析对照 / 知识点检索调试五界面（后续轮）。
- 不改动子项目任何文件；不修改 8901/8902 契约；不改动 8900 后端代码。

## 决策记录（用户裁决，2026-08-16）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 后端组织 | 三域解耦为后续并行推进做准备，但**本轮只做前端**，后端拆分/配套后置 |
| D2 | 框架 | React 19 + Vite + TS + AntD 5 + AntV G6（后续图谱）+ ECharts + Zustand + React Router |
| D3 | 迁移 | 地基先行、分批替换；过渡期 8903 保持旧前端，新前端 Vite dev 开发，完成后切换 |
| D4 | 本轮界面 | 核心四界面：主界面 / 控制台 / 仪表盘 / 下载管理 |
| D5 | 控制台数据源 | 只用既有端点（/services、/config/database、/config/llm-status）；监控端点（GPU/LM Studio/mineru/日志/self-restart）后置 |
| D6 | 执行流程 | **每个阶段经用户验证后才进入下一阶段**（阶段门禁） |
| D7 | 基线提交 | 文档基线在 Phase 0 开工前提交 git |

## 工作项（阶段门禁：每 Phase 完成后暂停，用户验证通过才继续）

### Phase 0：前端地基（web-ui/ 脚手架）

- Vite + React 19 + TS 初始化（`web-ui/`）；AntD 5 主题（theme.ts：蓝白主色、黑字、
  高对比 token）；React Router 路由骨架（#/、#/admin、#/admin/dashboard、
  #/admin/downloads）；Zustand stores 骨架；api/ 统一客户端（API_BASE=/api/v1 走 Vite
  proxy → 8900；AbortController 超时；离线降级）；四路由占位页。
- 验证：`npm run build` + vitest 冒烟 + dev server 与 8900 联通冒烟。
- **门禁**：用户打开 dev server 验证框架/主题/路由/联通。

### Phase 1：主界面（Home）

- Hero 欢迎区 + QED 简介 + 三大入口卡（知识探索/课程学习/刷题，占位）+ 右上
  使用手册按钮（迁移现有 HELP_SECTIONS 五阶段内容）+ 后台管理按钮。
- 验证：组件测试 + 视觉自查；**门禁**：用户验证视觉/文案/手册弹窗。

### Phase 2：控制台（Console）

- 顶部刷新按钮；四服务卡（8900 状态 / 8901·8902 启停重启 / 8903 重新加载提示；
  离线附原因；破坏性操作确认框；操作后轮询 /services 收敛）；
  MySQL 卡（/config/database）+ LLM 联通卡（/config/llm-status）。
- 验证：组件测试 + 真实服务冒烟；**门禁**：用户验证真实启停/离线提示/刷新。

### Phase 3：仪表盘（Dashboard）

- ECharts 大图（自适应）：文档下载状况（三表聚合：套/册状态分布 + 课程完成进度，
  数据源 /selections、/downloads）+ 解析状况离线占位 + 服务健康摘要。
- 验证：组件测试 + 响应式检查；**门禁**：用户验证大图/缩放/数据。

### Phase 4：下载管理（Downloads，攻坚，拆 4 个验证子阶段）

- 4a 布局与树：左树（领域→课程→教程；教程=教材+习题集**合并一个名称**；领域常驻
  展开、课程/教程点名称折叠；树宽拖拽 min/max）；右侧面板骨架 + 筛选栏（领域/课程/
  状态统一逻辑，与树选择单向联动）。
- 4b 书目卡区：课程简介 + 教程行横排书目卡（书名/类型徽标/状态/简介：课程/作者/译者/
  版本/难度/评价 + LLM 评估意见 + 人工 review_note）；行最小宽度、超宽横向滚动。
- 4c 详情弹窗 + 册明细：详情弹窗（套信息 + 表2 册明细 + 表3 来源）+ 卡内明细折叠区。
- 4d 三表操作闭环：表1 confirm/backup/reject（含 note）、表2 新建候选册/register/
  approve/reject、表3 sources；409/422 语义提示；rejected/superseded 由数据层过滤。
- 验证：功能点 TDD + 浏览器全链路；**门禁**：4a→4b→4c→4d 各子阶段用户验证通过。

### Phase 5：8903 切换 + 测试迁移

- 四界面全部验收后：`serve_web.py` 指向 `web-ui/dist/`（8903 + no-store 不变）；
  旧 `web/` 退役（git 保留）;`tests/test_web.py` 守护迁移至 `web-ui/src/` 源码
  （API_BASE=8900 唯一入口、零 8901/8902 直连、路由清单、三表语义 token），旧守护删除。
- 验证：全量 pytest + vitest + build；**门禁**：用户 8903 新界面全路由验收。

### Phase 6：文档同步与归档

- web-frontend.md 重写 v2（以新实现为准）；code-map 登记 web-ui 相关模块；
  四服务架构符合度表更新；project-status 更新；README/AGENTS 同步（REQ-021）。
- 验证：`pytest tests/contract -q` 全绿 + 全量门禁；用户最终验收后归档。

## 验证与验收

- 门禁：`pytest tests -q` + `ruff check backend tests` + `npm run build` + `npx vitest run`
  全绿。
- 人工验收：每 Phase 用户浏览器验证（阶段门禁）；控制台真实服务启停；下载管理
  三表全链路真实操作。
- 独立性铁律：8901/8902 离线时前端展示正常（离线提示不白屏）。

## 回滚

- 切换前：8903 保持旧前端（git 基线可回），web-ui/ 独立目录不影响旧部署。
- 切换后如发现阻断问题：`serve_web.py` 改回指向 `web/` 即回退（旧资源在 git 历史，
  必要时从历史恢复三文件）；契约测试同步回切。
- 单 Phase 失败：回退该 Phase 改动重做，不跨 Phase 带病推进。

## 关闭与归档

- 归档判定见文档头；Closed 后归档至 `history/plans/2026-08/`，todo 移除 ARCH-011。
- 本轮产出的新文档（ADR 0008、frontend-react-refactor.md）随实现推进更新实现状态位；
  backend-domain-split.md 标注「后续轮」，不在本轮更新。