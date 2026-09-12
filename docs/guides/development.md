# 开发指南

状态：Current
最后更新：2026-09-11
依据 ADR：[0001 契约测试](../history/adr/v0.1/0001-root-contract-tests.md)、
[0012 AI 开发守则](../adr/0012-ai-development-conduct.md)

本指南保存根仓库 QED-Engine **怎么开发**：流程、步骤与边界。事实分工如下——

| 内容 | 唯一维护位置 |
| --- | --- |
| 本机环境事实（conda 名/路径/版本、Node/npm、机器标识、端口） | [本地开发环境](../standards/local-dev.md) |
| 可复制命令（安装/测试/门禁/构建/启动） | 本指南「环境速查与命令矩阵」 |
| 服务启停与排障 | [操作指南](operations.md) |
| 工程治理规则（测试/文档/任务/ADR） | [规范索引](../standards/index.md) |
| Agent 入口与变更分级判据 | 根 [AGENTS.md](../../AGENTS.md) |

子项目开发命令以各自 `docs/guides/development.md` 为准（跨项目契约只链接不复制）。

## 定位与边界

- **本指南负责**：开发流程与步骤、门禁命令、代码-文档追溯的落地做法。
- **本指南不负责**：治理规则正文（在 `standards/`）、架构与设计契约（在 `architecture/`、
  `design/`）、服务运维（在 [operations.md](operations.md)）。
- **维护契约**：[文档治理规范](../standards/doc-governance.md) 规定 `guides/` 为人类文档、
  agent 不主动整理；唯一例外是本指南「开发流程」节——AI 开发守则由
  [ADR 0012](../adr/0012-ai-development-conduct.md) 授权 agent 维护，其余节默认由人类维护，
  agent 只提建议。

## 环境速查与命令矩阵

环境事实（conda 名、解释器路径、Python/Node 版本、机器 UUID、端口速查）以
[本地开发环境](../standards/local-dev.md) 为准，本节不复制。可复制命令统一在本节维护：

| 操作 | 命令 |
| --- | --- |
| 安装/更新依赖 | `conda run -n QED_env python -m pip install -e ".[dev]"` |
| 全量测试 | `conda run -n QED_env python -m pytest tests -q` |
| 契约门禁 | `conda run -n QED_env python -m pytest tests/contract -q` |
| 单文件测试 | `conda run -n QED_env python -m pytest tests/test_llm_gateway.py -q` |
| 代码质量 | `conda run -n QED_env python -m ruff check backend tests` |
| 手动起 8900 | backend/ 目录下 `conda run -n QED_env python -m uvicorn qed_engine.api.main:app --port 8900` |
| 前端门禁 | web-ui/ 下 `npm run build && npm test && npx tsc --noEmit` |

> 命令中的环境名以 [本地开发环境](../standards/local-dev.md) 为准（本机为 `QED_env`，注意大小写）。
> 服务启停与常见环境坑见 [本地开发环境](../standards/local-dev.md)「常见环境坑」与
> [操作指南](operations.md)。

## 开发流程（六步）

每项目独立走六步；变更边界判据见根 [AGENTS.md](../../AGENTS.md)「变更分级与边界」。技能只做
薄触发与指路，正文以本仓库 docs 为准。

| 步 | agent 动作 | 人类决策点 | 事实源 | 技能 |
| --- | --- | --- | --- | --- |
| 1 进场读必读 | 读状态快照、台账与相关标准 | 交付任务、定优先级 | [project-status](../trackers/project-status.md)、[todo](../trackers/todo.md)、[standards](../standards/index.md) | `qed-intake` |
| 2 定级 | 判变更对象与 A/B/C/D 分类，给出方案 | **拍板定级**（未定级不实施） | [AGENTS.md](../../AGENTS.md)、[task-lifecycle](../standards/task-lifecycle.md) | `qed-intake` |
| 3 立项 | 写 `plans/` 计划 + todo 登记（元数据/章节/关联 Tracker） | **评审计划** | [task-lifecycle](../standards/task-lifecycle.md)、[doc-governance](../standards/doc-governance.md) | `qed-plan` |
| 4 实现 | 用 code-map 定位模块，先测试后实现（TDD） | 抽查/评审 | [code-map](../architecture/code-map.md)、`design/`、[testing](../standards/testing.md) | `qed-implement` |
| 5 验证 | 跑完整门禁，整理证据（测试数字/提交 hash） | **验收** | [testing](../standards/testing.md)、[local-dev](../standards/local-dev.md) | `verification-before-completion` |
| 6 收尾 | 计划两态判定、todo 移 `completed.md`、同步设计/架构/索引 | **确认关闭** | [task-lifecycle](../standards/task-lifecycle.md)、[doc-governance](../standards/doc-governance.md) | `qed-closeout` |

- 大修改先建 todo + `plans/` 计划，评审后才动文档与代码；design 小修/bug 登记
  [设计类小修与 bug 修复台账](../plans/design-bugfix-log.md)；豁免级直接实施，以差异与验证
  记录承接。
- 遇到 bug/测试失败先用 `systematic-debugging` 定位根因，禁止猜测性修复。

## 门禁与证据

```powershell
# 全量测试（根）
conda run -n QED_env python -m pytest tests -q

# 契约治理测试（standards/ADR/计划/台账/文档结构/架构设计语义/代码映射）
conda run -n QED_env python -m pytest tests/contract -q

# 代码质量
conda run -n QED_env python -m ruff check backend tests
```

- 分层：单元/集成测试 `tests/`（根）+ 契约测试 `tests/contract/`；规则见
  [测试架构与门禁](../standards/testing.md)。
- 使用 `--strict-markers`，标记需在 `pyproject.toml` 注册；当前测试不使用 marker。
- 文档治理规则变更必须同步运行 `tests/contract/` 守护测试。
- 前端门禁（web-ui 改版后）：`cd web-ui && npm run build && npm test`（vitest）+ `tsc` 无错。
- 证据格式：提交 hash、测试结果数字、验收记录；关闭计划时写入 todo 证据列。

## 文档与映射同步

- 受管模块（`backend/qed_engine/` 与 `tests/`）文件头必须声明
  `设计关联（DesignRef）：docs/...<文档>.md` 与 `实现状态：Current`。
- 架构或设计契约变化同步 `docs/architecture/code-map.md` 后运行
  `tests/contract/test_code_document_mapping.py`；架构变更运行
  `tests/contract/test_architecture_documents.py`；设计变更运行
  `tests/contract/test_design_documents.py`。
- 文档体系规则（确认状态、版本机制、归档）见
  [文档治理规范](../standards/doc-governance.md)。

## 子项目开发速览

| 项目 | 现状 | 分支与门禁 |
| --- | --- | --- |
| Axiom-Flow | 8902（已迁移，8000 兼容保留） | 分支 `release`；本地门禁 + 契约测试；启动/验证命令见 `Axiom-Flow/docs/guides/` |
| QED-Tracker | 8901（已服务化，写操作后台任务 + 轮询） | 分支 `develop`→`release`→`main`；启动/验证命令见 `QED-Tracker/docs/guides/` |

跨项目协作规范（根仓库不得产生子项目代码改动）见
[跨项目协作规范](../standards/cross-project-collaboration.md)。
