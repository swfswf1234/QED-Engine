# 8903 前端契约（web-ui v2）

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-17
关联代码：`web-ui/src/`（React 重构版）、`scripts/serve_web.py`、`web-ui/.env.production`
关联测试：`tests/test_web.py`（守护 serve_web + web-ui 源码契约）
关联 ADR：`docs/adr/0002-frontend-and-port-centralization.md`、`docs/adr/0007-qed-engine-backend-gateway.md`、`docs/adr/0008-frontend-react-refactor.md`

## 目的与边界

本文件是 QED-Engine 前端（8903）的**当前实现契约（v2，React 重构版）**：信息架构、路由、
数据源与关键契约。跨项目对接语义见[三项目对接规范](service-contracts.md)；学习中心（`#/` 最终
形态）的探索设计见 [learning-center.md](learning-center.md)（Draft）。

> **v1 退役（2026-08-17）**：旧原生三文件版（`web/index.html`、`web/app.js`、`web/style.css`）
> 已随前端重构切换删除（git 历史保留）。重构目标态契约见
> [frontend-react-refactor.md](frontend-react-refactor.md)（本文件的实现依据）；v1 时代各期
> 语义（四阶段流水线、三表模型、课程分页等）已由 web-ui 界面继承或按需重述。

## 技术栈与部署

- React 19 + AntD 5 + zustand + react-router（hash 路由）+ echarts/core（按需引入）。
- 构建：`cd web-ui && npm run build` → 产物 `web-ui/dist/`；`serve_web.py` 静态托管
  （8903 + `Cache-Control: no-store`，改版后普通刷新即可生效）。
- **生产 API 基址**：`web-ui/.env.production` 设 `VITE_API_BASE=http://127.0.0.1:8900/api/v1`
  ——8903 静态服务无 vite proxy，必须显式指 8900（ADR 0007 唯一入口）；dev 模式（5173）
  经 vite proxy `/api` → 8900 同源。
- **浏览器只连 8900**：数据域/服务域/监控诊断全部经 8900 适配 8901/8902，无后端代理、
  不直连 8901/8902（`tests/test_web.py` 守护零直连）。

## 信息架构（hash 路由，App.tsx）

- `#/` 主界面（Home）：学习中心框架（领域→课程→章节/知识点浏览，数学试点）。
- `#/knowledge` 学习中心（Knowledge）：课程图 + 知识行浏览。
- `#/admin` 管理后台（AdminLayout 嵌套）：
  - `#/admin` 控制台（Console，index）：四服务卡（启停/重启 + message 成功失败提示）+
    依赖组件（MySQL）。
  - `#/admin/dashboard` 仪表盘（Dashboard）：服务在线 + 文档下载进度 + 文档解析进度。
  - `#/admin/downloads` 文档下载管理（Downloads）：知识树（领域→课程→教程）+ 书行卡片。
  - `#/admin/parsing` 文档解析进度（Parsing）：parse-jobs 数据源后置（离线占位）。
  - `#/admin/compare` 原始文档对照（Compare）：解析产物对照视图。

## 仪表盘关键语义（2026-08-17 用户裁决）

- **服务在线**：四服务状态点（`/services`；8903 后端离线时本地判定兜底 + 去重）。
- **文档下载进度**：
  - **课程下载完成度饼图**（两段式：已完成/未完成）：分母 = 已探索课程数
    （`/catalogs/math-qe` targets course_id 去重，如数学 13 门）；分子 = 完成下载课程数
    （该课程 ≥2 套教程完成验收——教程书行全部 verified——计为完成下载）；
  - **教程下载工作量饼图**：每教程一块扇区，值 = 已下载书行数（downloaded+verified）；
  - 统计行：教程数（kind=tutorial）/ 目标书目 / 已下载 / 已验收。
- 8901 不可达 → 下载卡离线降级；catalog 不可达 → 课程饼图降级提示，不阻塞其他卡。

## 控制台操作反馈（2026-08-17 用户裁决）

- 启停/重启（8901/8902/8903）：**只提示收敛结果**——请求成功 → 轮询 `/services` 收敛到
  操作目标态（start/restart→online、stop→offline）；成功 → `message.success`、
  失败/超时 → `message.warning`（统一 antd message，不叠 Modal）。
- 8900 重启经 `/self-restart`：确认后调 API，成功 message + 约 3s 自动刷新页面。

## 横幅

仅展示「MySQL数据库连接」启动快照（8900 `/config/database` 启动快照，ARCH-014）；
LLM 供应商可达性不展示（8900 启动自检写日志，`/config/llm-status` 已删除）。

## 契约引用（tests/test_web.py 守护）

- 唯一入口（ADR 0007）：`.env.production` VITE_API_BASE=8900；api/ 封装零 8901/8902 直连 URL。
- 8900 端点：配置域 `/config/database`；服务域 `/services`、`/self-restart`；数据域
  `/catalogs/`、`/knowledge`、`/books`、`/parse-jobs`（详见[配置中心 API 契约](config-center-api.md)）。
- 路由：`#/`、`#/knowledge`、`#/admin`（dashboard/downloads/parsing/compare 嵌套）。
- 关键语义 token：课程完成度（≥2 套教程 verified）、message 反馈（success/warning）。

## 独立性

8901/8902 离线时各视图显示离线提示/降级，不白屏不报错（铁律见
[四服务架构与边界](../architecture/four-service-architecture.md)）。

## 验证

- `tests/test_web.py` 全绿（serve_web 契约 + web-ui 源码 token 守护）。
- 前端门禁：`cd web-ui && npm run build && npm test`（vitest 全绿）。
- 人工验收：8903 打开各路由检查界面语义（控制台启停反馈、仪表盘饼图、下载树、空态、离线态）。
