---
name: qed-frontend-check
description: Use after changing web-ui (8903) frontend code — verifies the change in a real browser before claiming completion. Trigger on 前端验证, 浏览器验证, frontend check, UI 验收.
---

# QED 前端浏览器验证（8903）

AGENTS.md 完成门禁要求 UI 改动必须在浏览器中实际验证，本技能规定验证路径。

## 前置

1. 确认 8903 前端与 8900 后端在运行（未运行时先按「开发/联调门禁」指南 `docs/guides/development.md` 启动，不猜测命令）。
2. 前端唯一数据入口是 8900（ADR 0007）：验证时如发现页面直连 8901/8902 的请求，即为回归，立即记录。
3. **改动先编译再验证**：8903 托管的是 `web-ui/dist/` 构建产物，改过源码必须在 `web-ui/` 内 `npm run build`，
   并比对 8903 实际返回的 `assets/index-*.js` 哈希与 `web-ui/dist/index.html` 一致——不一致即在看旧包。
   SPA hash 路由切换不重载 JS，旧标签页会一直跑旧产物：验证一律新开页面或加 `?v=<批次>` 强刷。
4. **接口新腿先核 8900 是否已重载**：8900/8902 不热重载。本轮新增端点若 `openapi.json` 查不到，页面会走兜底
   话术看起来「点了没反应」——先 `curl http://127.0.0.1:8900/openapi.json` 确认端点在，再判前端。

## 验证步骤（真实浏览器实测）

下文工具名是**本端浏览器自动化实现名**（概念动作依次为：导航 / 取快照 / 读控制台 / 读网络 / 执行脚本 / 截屏）；
换端时按概念动作替换，验证判据不变。

1. `navigate_page` 打开 `http://127.0.0.1:8903/`，`take_snapshot` 确认页面骨架渲染。
2. **黄金路径**：进入本次改动所在视图（学习中心 / 控制台 / 仪表盘 / 文档下载管理 / 文档解析管理），完成该功能的主流程一次。
3. `list_console_messages` 确认无新增报错；`list_network_requests` 确认请求全部指向 8900 且无 4xx/5xx。
4. 边界检查：空数据态、加载态各看一次；改动涉及的对照/进度类子视图抽查一页。
5. **版式/形态类改动必须三档宽度实测**：内置浏览器视口为 0×0（`take_screenshot`、指针点击不可用），只能用
   `evaluate_script`；切宽度用 `Object.defineProperty(window, 'innerWidth', { writable: true, value: W })`
   + `dispatchEvent(new Event('resize'))`，**1600 / 1200 / 860 各测一次**。对齐类结论要用
   `Range.selectNodeContents(node)` 量**文本左缘像素**并记录实测值（antd 把子节点包成 SPAN，
   `firstChild.nodeType===3` 取不到文本）。禁止只看窄屏侧滑形态就判绿——REQ-117 W9 的目录未左对齐
   （DEFECT-016）正是只验形态未量左缘漏掉的。
6. `take_screenshot` 留存最终状态（视口可用时），作为验证证据纳入收尾输出；不可用时以 `evaluate_script`
   的实测读数（按钮名单 / 文本左缘像素 / 禁现词命中）替代并如实注明。

## 判定

- 任一步失败：转 `systematic-debugging` 定位根因，修复后整条路径重跑。
- 无法启动服务或浏览器不可用时：**明确声明"未做浏览器验证"**，不得声称 UI 完成——遵守 `verification-before-completion`，静态类型检查与测试通过不等于功能正确。
