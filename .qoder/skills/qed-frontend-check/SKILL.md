---
name: qed-frontend-check
description: Use after changing web-ui (8903) frontend code — verifies the change in a real browser via browser-use MCP before claiming completion. Trigger on 前端验证, 浏览器验证, frontend check, UI 验收.
---

# QED 前端浏览器验证（8903）

AGENTS.md 完成门禁要求 UI 改动必须在浏览器中实际验证，本技能规定验证路径。

## 前置

1. 确认 8903 前端与 8900 后端在运行（未运行时先按「开发/联调门禁」指南 `docs/guides/development.md` 启动，不猜测命令）。
2. 前端唯一数据入口是 8900（ADR 0007）：验证时如发现页面直连 8901/8902 的请求，即为回归，立即记录。

## 验证步骤（browser-use MCP）

1. `navigate_page` 打开 `http://127.0.0.1:8903/`，`take_snapshot` 确认页面骨架渲染。
2. **黄金路径**：进入本次改动所在视图（学习中心 / 控制台 / 仪表盘 / 文档下载管理 / 文档解析管理），完成该功能的主流程一次。
3. `list_console_messages` 确认无新增报错；`list_network_requests` 确认请求全部指向 8900 且无 4xx/5xx。
4. 边界检查：空数据态、加载态各看一次；改动涉及的对照/进度类子视图抽查一页。
5. `take_screenshot` 留存最终状态，作为验证证据纳入收尾输出。

## 判定

- 任一步失败：转 `systematic-debugging` 定位根因，修复后整条路径重跑。
- 无法启动服务或浏览器不可用时：**明确声明"未做浏览器验证"**，不得声称 UI 完成——遵守 `verification-before-completion`，静态类型检查与测试通过不等于功能正确。
