# 已关闭任务

状态：Current
最后更新：2026-08-07

本文件登记已从 [todo.md](todo.md) 原子移除并达到终态的任务，关闭结果与证据可追溯。

| ID | 类型 | 任务 | 关闭结果 | 证据 |
| --- | --- | --- | --- | --- |
| ARCH-005 | Plan | [2026-08 前端展示重构（display-redesign-v5）](../history/plans/2026-08/2026-08-8903-display-redesign.md) | Achieved | 五期~十三期全部完成并提交（a5ce8c1，140 passed + ruff clean + JS OK）：入口零后台+手册+流水线+健康面板+四级树+弹层筛选；取消卡片墙与追溯；view 互斥+改名；健康面板语义收敛；LLM配置三模型；流水线按课程统计；知识点三层树；书籍全景+筛选联动；控制台化+冒泡修复；用户浏览器验收通过，2026-08-07 归档 |
| REQ-007 | 实现 | 配置中心数据库选择：QED_DB_* 变量 + /config/database 状态接口（密码不下发） | Achieved | 8900 实测返回 configured=true 且无密码泄露；契约与测试同步于 config-center-api.md；门禁 95 通过 |
| REQ-012 | 实现 | qed CLI tracker 客户端子命令：books list/download、tasks 轮询（等待模式）、resources confirm/reject/approve | Achieved | tracker_client.py 与 cli.py 落地，test_tracker_client.py 14 项 + test_cli.py tracker 子命令 10 项通过；QED-Tracker 8901 服务化（QED-008）就绪后联调验证（外部待办） |
| REQ-011 | 实现 | 下载工作台 web/ 8903（原生静态页）：候选清单/任务中心/验收台/服务状态与配置横幅，DeepSeek 深色风格重设计 | Achieved | 初版 test_web.py 5 项守护、门禁 95 通过；四期（ARCH-004）守护扩至 20 项、门禁 120 通过；8903 实测深色渲染与离线降级正常；8901 闭环端点（QED-012/015/016）就绪后联调（外部待办，随 REQ-013 验收） |