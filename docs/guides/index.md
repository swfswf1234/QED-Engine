# 指南索引

状态：Current
最后更新：2026-09-11

本目录保存 QED-Engine 人类可读指南（ADR 0010）：**操作文档**（启停服务等各类操作）与
**开发文档**（介绍项目怎么开发）。每次主线 TODO 任务完成后梳理是否更新。文档分类与元数据
规则见[文档治理规范](../standards/doc-governance.md)。

## 定位与维护契约

- 指南只保存**当前可重复执行的步骤**；稳定系统约束属于 `architecture/` 或 `design/`，
  治理规则属于 `standards/`（正文不在此复制）。
- 事实分工：环境事实与机器标识归 `standards/local-dev.md`；可复制命令的唯一维护位置是
  [development.md](development.md) 的命令矩阵；服务启停步骤在 [operations.md](operations.md)。
- 维护：`guides/` 默认由人类维护、agent 不主动整理（见[文档治理规范](../standards/doc-governance.md)）；
  例外是 [development.md](development.md)「开发流程」节（AI 开发守则，ADR 0012 授权 agent 维护）。

## 当前指南

| 文档 | 状态 | 内容 |
| --- | --- | --- |
| [operations.md](operations.md) | Current | 操作文档：四服务启停（8900/8903/8901/8902）、`--mode api/local`、日志与监控、健康检查冒烟、故障排查清单 |
| [development.md](development.md) | Current | 开发文档：事实分工与边界、环境速查与命令矩阵、开发流程（单一六步，标注人类/agent 分工）、门禁与证据、文档-代码映射同步、子项目开发速览 |
