# QED-Engine 前端架构（8903）

设计状态：Accepted
实现状态：Implemented
最后更新：2026-10-15
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

## 视觉与文案

视觉规范（蓝白黑 + 简洁、对比度门禁、缩放自适应、一致性、暗色星图唯一例外）与文案语言风格的**唯一正本**在 [frontend-overview.md §2/§3](../design/frontend/frontend-overview.md)（2026-10-15 REQ-115 自本文「主题与视觉规范」节迁出）；本文只保留技术架构，视觉/文案/流程口径一律以该总设计为准。

## 信息架构（hash 路由）

- `#/` 主界面（Home）：学习中心框架（领域→课程→章节/知识点浏览，数学试点）+ 使用手册。
- `#/knowledge` 学习中心 · 知识探索（Knowledge，单页两视图）：领域层＝星空背景层上的「层＝行 × 轨迹＝列」森林导航（领域下拉 + 轨迹列框 + 课程框 + 先修连线），课程卡悬停＝课程名称＋课程叙述（`GET /learn/star-map` 的 `description`），点击就地下钻；课程层＝该课**大知识点虚框＋框内小知识点条目**的层级星图（同页替换、深链 `#/knowledge?course={course_id}`、面包屑「知识探索 / {课程名}」回退且不含领域名、零知识点写面、无通往学习／练习的出口）。该面设计已于 2026-10-15 晋升 [knowledge-point-exploration-ui.md](../design/frontend/knowledge-point-exploration-ui.md)（暂定；REQ-104／110／113／114 四行合一份），原晋升稿正文归档 [learning-star-map.md](../history/plans/2026-10/learning-star-map.md)。
- `#/learn` 学习中心 · 课程学习·书架清单（LearnShelf）：**服务端同步结果的展示面**（`POST /learn/courses/sync`——教材在解析侧就绪即出现在书架，未就绪者服务端 PASS），**界面不新建、不删除学习课程**，页头「刷新」＝重新同步。形态＝标题行右侧领域下拉（进场默认第一个领域）→ 课程行（标题＝共享表**正式名称**，状态徽章词本身承载口径＝`已结课`／`学习进度 N%`／`知识点未就绪`／`未开始`）→ 课程下**教材横排小卡片**（书名＋面向对象档位＋该教材进度 `N/M 条`＋教程套简介，动作＝「进入学习」深链与「忽略」，忽略＝教材级 `dismissed` 写进 `resources` JSON、可在「已忽略」区按回来）；页头三枚＝使用手册／刷新／返回。解析侧不可达时只列既有课程、不白屏（独立性铁律）。该面设计已于 2026-10-18 随 REQ-117 晋升 [learning-course-ui.md](../design/frontend/learning-course-ui.md)（暂定）。
- `#/learn/c/:learnCourseId?book=` 学习中心 · 课程学习·单屏工作台（LearnWorkbench）：三栏同屏 + 断点三档（≥1400 三栏／1000~1400 目录＋正文／<1000 单栏，窄栏收「打开目录／打开学习交流」抽屉）。**左＝「章 → 知识点」两级目录**（节层不显形，栏内只列名称与自己的「已学」标记、零处理进度说明，行左缘两档 8px／22px）；**中＝一条知识点的连续正文流**（复用解析管理版式 parsing-ui §9.1，跨页合并、按 8 页/批滚动续取、界面无页码与「继续加载」，image 块按页图 `bbox` 内联裁切），**正文末尾三枚推进**＝上一条／下一条／已掌握并下一条（同条再点＝撤销）；**右＝「学习交流」三段**＝本章总结与学习要点 → 详解（直读知识点主表行 `angles`，**数组序即权威展示序**，
前端不重排、无点赞与块级过滤；`narrative_ref` 非空时另给「读这一条的正文」文件读腿；段末 LLM 提问占位零请求）
→ 备注（写学习记录 kp 行 `learner_note`，零新表零新列；该条尚无 kp 行时禁用保存并给下一步）。
数据通路＝知识点序列**读时投影、零物化**（派生键 `kp:{kp_id}`，`qe_unit` 整表已随 ADR 0026 D2 退出，
不再有单元行可写）＋ `POST …/progress`；按需生成＝一枚 8900 业务端点（`POST …/annotations/generate`，
章级写章行、条级写 `angles`；点赞腿与候选池五枚端点随 D1/D10 退役，形状正本
[api-contracts.md](api-contracts.md) §⑥）。原「阅读／链路双模式」与 `compile/propose`＋`compile/start` 链路通路、`PUT …/syllabus` 整树写入、右栏推进段**均已从学习面摘除**（生产与人工修正腿归后台管理·文档分析处理 REQ-116）；`TocConfirmPanel` 人工确认弹窗已删除，`tocParse.ts` 自动定位纯函数保留（进场目录生成仍消费）。该面设计已于 2026-10-18 晋升 [learning-course-ui.md](../design/frontend/learning-course-ui.md)（暂定，一次晋升含书架清单与工作台）；v1 稿（REQ-105）按用户裁决留改不晋升、归档 [2026-10-11-learn-ui-course-study.md](../history/plans/2026-10/2026-10-11-learn-ui-course-study.md)，重设计轮承载壳与全部裁决证据见 [REQ-117](../history/plans/2026-10/2026-10-15-learn-course-study-redesign.md)；练习独立面见 [learning-practice-ui.md](../design/frontend/learning-practice-ui.md)（REQ-106 已晋升，`#/practice`），原 v1 工作台晋升稿正文归档 [learning-workbench-ui.md](../history/plans/2026-10/learning-workbench-ui.md)。
- `#/practice` 学习中心 · 课后练习（Practice）：独立面，主界面「课后练习」卡为**唯一入口**、与
  其他学习面零跳转。同屏两段＝**今日面板**（到期计数＋复习队列＋错题本）与**题源工作区**（题源书
  ＋页范围 → 抽取预览 → 人工确认入库 → 本课题卡作答判分）；归属＝课级全量，判分依据只在作答
  响应回显。分区口径、抽取规格与降级矩阵见 [learning-practice-ui.md](../design/frontend/learning-practice-ui.md)（暂定）。
- `#/admin` 管理后台（AdminLayout 嵌套）：
  - `#/admin` 控制台（Console）：四服务卡（启停/重启 + message 成功失败提示）+ GPU 总览条
    + 依赖组件三卡（MySQL/文字模型/图像模型）+ 模型调用记录检索页（`#/admin/llm-calls`）。
  - `#/admin/dashboard` 仪表盘（Dashboard）：服务在线 + 文档下载进度双饼图 + 文档解析进度。
  - `#/admin/downloads` 文档下载管理（Downloads）：知识树（领域→课程→教程）+ 书籍卡片 + 流程筛选。
  - `#/admin/parsing` 文档解析管理（Parsing）：左树（领域→课程→书目+解析进度）+ 右侧对比
    （原页图 + 语义 bbox 方框 + 块级渲染与编辑：判定/备注/文字修正/范围修改），工具栏单一
    「刷新」按钮（同步书目 + 重载）；设计见 [解析管理 UI 设计](../design/frontend/parsing-ui.md)。

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
