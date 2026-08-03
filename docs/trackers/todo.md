# 任务台账

状态：Current
最后更新：2026-08-04

本文件登记根仓库未关闭任务。详细计划见 [计划索引](../plans/index.md)，已关闭任务见
completed.md（按需创建）。

## 未关闭任务

| 任务 | 类型 | 状态 | 计划 | 备注 |
| --- | --- | --- | --- | --- |
| 三份契约文档评审并转 Accepted | 评审 | 待开始 | — | service-contracts / dataset-conventions / configuration-and-secrets |
| Phase 1 后续：盘点 QED-Tracker / Axiom-Flow 接口细节 | D（设计） | 待开始 | 待写 | 细化接口契约、数据库与产物 schema |
| 子项目改造：数据目录指向根 dataset/，配置直读新变量 | 实现 | 待开始 | 待写 | 在各子项目仓库内进行，遵守其门禁 |
| QED-Engine 后端：统一配置中心（读取根 .env，提供配置接口） | 实现 | 待开始 | 待写 | 归属 QED-Engine 建设轮 |

## 已完成任务

| 任务 | 完成日期 | 提交 |
| --- | --- | --- |
| 文档治理体系：文档规范 + docs 骨架 + README + AGENTS.md 总纲 | 2026-08-04 | `ffd6362` |
| 第一轮交付：三份设计文档（Draft）+ .env.example + load-env.ps1（已脚本验证） | 2026-08-04 | 本轮提交 |

## 规则

- 任务按类型分类（设计/实现/验证/发布），状态只允许 `待开始 / 进行中 / 已完成 / 阻塞`。
- 阻塞必须声明证据、恢复条件和责任位置。
