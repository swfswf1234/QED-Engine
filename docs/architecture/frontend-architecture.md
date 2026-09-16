# QED-Engine 前端架构（8903）

设计状态：Accepted
实现状态：Implemented
最后更新：2026-09-14
确认状态：暂定
关联代码：`web-ui/`（React 19 + TypeScript + Vite 构建，构建产物 `web-ui/dist/` 由
`scripts/serve_web.py` 静态托管 8903）、`web-ui/.env.production`（`VITE_API_BASE`）
关联测试：`tests/test_web.py`（守护 serve_web 契约与 web-ui 源码 token）
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)（全局端口）、
[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、
[ADR 0008](../history/adr/v0.1/0008-frontend-react-refactor.md)（React 全家桶重构）、
[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)（解析能力归属）

## 定位与边界

8903 是 QED-Engine 前端服务：**学习中心**（`#/` 最终形态）+ **管理后台**（控制台 / 仪表盘 /
文档下载管理 / 文档解析管理）。**浏览器只连 8900**（ADR 0007 唯一入口），数据域/服务域/
监控诊断全部经 8900 适配 8901/8902，无后端代理、不直连 8901/8902（`tests/test_web.py` 守护
零直连）。前端**自身不提供 API 接口**（见 [8900 API 接口文档](api-contracts.md)「前端无 API」），
对外只有静态页面 + 8900 交互。

8900 后端地址与端点契约见 [8900 API 接口文档](api-contracts.md)；三项目四服务总体拓扑见
[三项目四服务总体架构](four-service-architecture.md)；前后端交互唯一入口为 8900
（不与其他服务直接交互）。

## 技术栈与部署

- React 19 + AntD 5 + zustand + react-router（hash 路由）+ echarts/core（按需引入）。
- 构建：`cd web-ui && npm run build` → 产物 `web-ui/dist/`；`serve_web.py` 静态托管 8903
  （`Cache-Control: no-store`，改版后普通刷新生效）；dev 模式（5173）经 vite proxy → 8900。
- 生产 API 基址：`web-ui/.env.production` 设 `VITE_API_BASE=http://127.0.0.1:8900/api/v1`。

## 目录组织（界面解耦原则）

```
web-ui/
├── src/
│   ├── main.tsx / App.tsx   # 入口 + 全局布局 + React Router 路由
│   ├── theme.ts             # AntD 5 theme token（蓝白主色、高对比度）
│   ├── api/                 # 统一 API 客户端（API_BASE=8900，超时、离线降级）
│   ├── stores/              # Zustand：服务状态、筛选、树选择、控制台/解析快照
│   ├── components/          # 通用组件（状态点、卡片、筛选器、空态/离线态）
│   └── pages/               # 按界面分目录：Home / Console / Dashboard / Downloads / Parsing / LlmCalls
├── .env.production
└── dist/                    # 构建产物（serve_web.py 托管）
```

一界面一目录，界面间只通过路由与 store 交互；统一 API 客户端封装 fetch + 超时 + 离线降级。

## 主题与视觉规范

（2026-09-10 自已删除的 design/frontend-react-refactor.md 迁入——原全库唯一载体，REQ-070 重组轮）

- **配色**：蓝白主体；背景白色/浅灰蓝，主色 AntD 蓝色系（如 `#1677ff` 系），辅以浅蓝渐变卡面。
- **文字对比度门禁**：字体默认黑色；**无论何时何地字体与背景保持大区分**——正文深色底
  不配深字、浅底不配浅字；状态色文字必配同色系浅底。
- **缩放自适应**：整体布局随浏览器大小自适应（Grid/Flex + AntD 响应式栅格 + 断点）；
  不依赖固定像素布局。
- **一致性**：全部界面共用 `theme.ts` token 与通用组件，筛选/卡片/状态点风格统一；
  新增界面/组件不得绕过 theme token 自定配色。

## 信息架构（hash 路由）

- `#/` 主界面（Home）：学习中心框架（领域→课程→章节/知识点浏览，数学试点）+ 使用手册。
- `#/knowledge` 学习中心（Knowledge）：课程图 + 教程浏览。
- `#/admin` 管理后台（AdminLayout 嵌套）：
  - `#/admin` 控制台（Console）：四服务卡（启停/重启 + message 成功失败提示）+ GPU 总览条
    + 依赖组件三卡（MySQL/文字模型/图像模型）+ 模型调用记录检索页（`#/admin/llm-calls`）。
  - `#/admin/dashboard` 仪表盘（Dashboard）：服务在线 + 文档下载进度双饼图 + 文档解析进度。
  - `#/admin/downloads` 文档下载管理（Downloads）：知识树（领域→课程→教程）+ 书籍卡片 + 流程筛选。
  - `#/admin/parsing` 文档解析管理（Parsing）：左树（领域→课程→书目+解析进度）+ 右侧对比
    （原页图 + 语义 bbox 方框 + 块级渲染与编辑：判定/备注/文字修正/范围修改），工具栏单一
    「刷新」按钮（同步书目 + 重载）；设计见 [解析管理 UI 设计](../design/parsing-ui.md)。

## 与后端的交互

- 配置域：`/config/database`（启动快照横幅）、`/config/models`、`/config/keys`。
- 服务域：`/services`（四服务卡）、`/self-restart`（8900 重启）。
- 数据域：`/catalogs/`、`/knowledge`、`/books`、`/parse-jobs`（经 8900 透传 8901/8902）。
- LLM 网关：`/llm/text`、`/llm/vision`、`/llm/test/*`、`/llm/calls`、`/database/test`。
- 详细契约以 [8900 API 接口文档](api-contracts.md) 为准；契约 token 由 `tests/test_web.py` 守护。

## 独立性

8901/8902 离线时各视图显示离线提示/降级，不白屏不报错（铁律见
[三项目四服务总体架构](four-service-architecture.md)）；8900 离线时页面本地判定兜底 + 错误横幅。

## 验证

- 契约测试：`tests/test_web.py`（serve_web + web-ui 源码 token）。
- 前端门禁：`cd web-ui && npm run build && npm test`（vitest）+ `tsc` 无错。
- 人工验收：8903 打开各路由检查界面语义（控制台启停反馈、仪表盘饼图、下载树、空态、离线态）。
