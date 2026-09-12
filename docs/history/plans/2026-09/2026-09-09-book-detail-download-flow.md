# 书目详情界面"确认下载"链路重构 Implementation Plan

状态：In Progress
最后更新：2026-09-10
任务类型：B
关联 ADR：无（UI 交互优化，非架构决策）
关联设计：`../design/downloads-flow.md`、`../design/downloads-ui.md`
关联 Tracker：docs/trackers/todo.md（PLAN-036，ARCH-019 补登记）
归档判定：实现完成并经用户浏览器验收后随主线归档至 `../history/plans/2026-09/`

> 2026-09-10 迁正说明：本计划原为 2026-09-09 会话产物（原存放于违规目录
> `docs/superpowers/`，该目录已经用户确认删除），由 REQ-069 治理轮迁正至 `docs/plans/`
> 并补齐治理元数据。实现已落地，待用户浏览器验收后关闭。

## 目标与成功标准

重构书目详情弹窗（BookDetailModal）的下载确认流程：移除冗余底部按钮，支持渠道验证/拒绝
操作，失效渠道显示原因，无渠道时支持手动导入本地 PDF。

**成功标准**：
1. 底部「关闭」「确认下载」按钮移除，仅保留右上角 X 关闭；
2. 渠道列表下方显示「验证完毕」（仅 downloaded 状态）与「否定」按钮；
3. 「验证完毕」调用 `verifyBook`（downloaded → verified）；「否定」弹出原因弹窗（必填），
   确认后调用 `rejectBook`（→ rejected，原因/备注入 note）；
4. 失败渠道以红色显示失效原因（note 字段，如 404/403）；
5. 「渠道尝试」标题旁提供「添加」按钮：文件选择器选取本地 PDF，经 `importBookPdf` 导入；
6. Downloads 相关 vitest 全部通过，`npm run build` 成功。

## 范围与非目标

**范围**：仅 `web-ui/src/pages/Downloads.tsx`（BookDetailModal）与 `Downloads.test.tsx`；
API 层复用既有函数（`api/tracker.ts` 的 `verifyBook`、`rejectBook`、`importBookPdf`）。

**非目标**：不新增/修改后端端点（`POST /books/{book_id}/verify|reject|import` 已存在）；
不改渠道选择下载主流程之外的其他界面。

## 前置条件

1. 8900 后端与 8901 QED-Tracker 可启动（verify/reject/import 契约已就绪）；
2. `web-ui` 依赖已安装。

## 工作项

- **Task 1 移除底部按钮**：Modal `footer` 置 null；清理不再使用的 `selectedChannel`、
  `downloading` 状态与 `handleDownload`。
- **Task 2 验证/否定按钮**：新增 `rejectingBook/rejectReason/rejectNote/operatingSource`
  状态；否定原因弹窗（原因必填、备注可选）；`handleVerifyBook`（verifyBook → verified）与
  `handleRejectBook`（rejectBook → rejected）；渠道项渲染加成功/失败 Tag 与失败原因
  （note）红色展示；渠道列表下方按状态渲染「验证完毕」（downloaded 时）与「否定」。
- **Task 3 手动导入**：新增 `importing` 状态与隐藏 `<input type="file" accept=".pdf">`；
  `handleFileSelect` 取文件绝对路径（Electron `file.path`）调 `importBookPdf` 后刷新渠道；
  「渠道尝试」标题旁加「刷新」「添加」按钮。
- **Task 4 更新测试**：移除「确认下载」按钮断言，补「验证完毕/否定/添加」交互用例。
- **Task 5 构建验证**：`npm run build` 无类型错误，dist 产物正常。

## 验证与验收

- 自动化：`cd web-ui && npm test`（vitest 全绿）+ `npm run build`（tsc + vite 成功）。
- 人工验收：用户浏览器走查书目详情——验证完毕/否定/添加三条链路真实数据操作。

## 回滚

单个任务回滚：撤销对应 Task 的代码改动；整体回滚：回退 `Downloads.tsx` 至重构前版本。

## 关闭与归档

实现落地（2026-09-09 会话已完成，见 Downloads.tsx 验证完毕/否定/添加链路）；关闭条件为
用户浏览器验收通过；关闭后按归档判定随主线归档。
