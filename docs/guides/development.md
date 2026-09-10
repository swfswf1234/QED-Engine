# 开发指南

状态：Current
最后更新：2026-09-10
依据 ADR：`docs/history/adr/v0.1/0001-root-contract-tests.md`

本指南保存根仓库 QED-Engine **怎么开发**：环境准备、门禁命令、开发工作流与代码-文档追溯。
服务启停等**操作步骤见 [operations.md](operations.md)**；架构与契约见
[架构索引](../architecture/index.md) 与 [设计索引](../design/index.md)。子项目的开发命令
以其自身 `docs/guides/development.md` 为准（Axiom-Flow 见 `Axiom-Flow/docs/guides/development.md`，
QED-Tracker 见 `QED-Tracker/docs/guides/development.md`；跨项目契约只链接不复制）。

## 环境准备（AI 开发速查）

> **长期任务 REQ-062 承接节**：凡 agent 反复探索过的环境/命令知识点，先写入
> [AI Agent 知识收件箱](../plans/ai-agent-knowledge-inbox.md)（审核三判据），经批量晋升
> 流程后落入本节等正式文档——不直接改正式文档。环境名以本节为准。

### 权威事实

- **conda 环境名：`QED_env`**（注意大小写，不是 `qed_env`；实测 `conda env list` 核实）。
  Anaconda 安装于 `D:\software\anaconda3`，解释器位于
  `D:\software\anaconda3\envs\QED_env\python.exe`。
- 该环境已安装项目依赖（fastapi、uvicorn、pydantic、httpx、ruff、pymysql 等）；
  依赖变动后重装：`conda run -n QED_env python -m pip install -e ".[dev]"`。
- 所有 Python 命令**必须带 `-n QED_env` 前缀**（shell 默认解释器不在该环境中）。

### 命令矩阵

| 操作 | 命令 |
| --- | --- |
| 安装/更新依赖 | `conda run -n QED_env python -m pip install -e ".[dev]"` |
| 全量测试 | `conda run -n QED_env python -m pytest tests -q` |
| 契约门禁 | `conda run -n QED_env python -m pytest tests/contract -q` |
| 单文件测试 | `conda run -n QED_env python -m pytest tests/test_llm_gateway.py -q` |
| 代码质量 | `conda run -n QED_env python -m ruff check backend tests` |
| 手动起 8900 | backend/ 目录下 `conda run -n QED_env python -m uvicorn qed_engine.api.main:app --port 8900`（见 operations.md） |
| 前端门禁 | web-ui/ 下 `npm run build && npm test && npx tsc --noEmit` |

### 已知坑清单

1. **`conda run` 不支持多行 `python -c`**（报 `AssertionError: newlines not implemented`）：
   需要多行脚本时先写入临时文件再执行：
   ```powershell
   conda run -n QED_env python C:\Users\86182\AppData\Local\Temp\opencode\check_names.py
   ```
2. **`ModuleNotFoundError: fastapi/uvicorn`**：忘加 `conda run -n QED_env` 前缀或未激活环境；
   排查表见 [operations.md](operations.md) 故障排查节。
3. **PowerShell 无 Unix 工具**（`tail`/`grep`/`head` 不存在）：管道截断用 PowerShell 原生
   方式或直接依赖工具自身输出控制。
4. **服务在线状态影响测试结果**：已修复的 DEFECT-001（`test_services_restart_externally_running_script_unit`）
   现已通过模块属性访问解决，无论服务在线/离线均可通过。若遇到其他测试因服务离线失败，先查
   [todo.md](../trackers/todo.md) 已登记缺陷再排查新问题。
5. **`conda run`（23.3.1）输出缓冲 + 崩溃报错**（2026-09-04 实测）：子进程全部 stdout/stderr
   被缓冲到退出才一次性吐出——长命令（如前端 `start --build`）期间控制台长时间无输出，
   像卡死；且子进程退出后 conda 自身可能崩溃打印 "An unexpected error has occurred" 错误报告
   （不影响已完成的子进程结果）。需要实时输出时改用 `conda run --no-capture-output` 或
   直接调用解释器全路径 `D:\software\anaconda3\envs\QED_env\python.exe`。

## 开发工作流

1. **进场先读**：[项目状态快照](../trackers/project-status.md)（30 秒掌握现状）→
   [任务台账](../trackers/todo.md)（未关闭任务）→ 对应 `plans/` 计划与设计文档。
2. **定位模块**：代码-设计-测试映射唯一事实源见 [code-map](../architecture/code-map.md)；
   架构见 [架构索引](../architecture/index.md)，契约见 [8900 API 接口文档](../architecture/api-contracts.md)。
3. **先写测试再实现**（TDD）：涉及契约/状态机/迁移的改动先落测试；遵循
   [测试架构与门禁](..\standards\testing.md) 分层。
4. **文档同步**：契约变化同步 `api-contracts.md` 或对应设计文档；受管模块 header
   `设计关联（DesignRef）` 与 code-map 保持一致（见下节）。
5. **门禁全绿后提交**：完整门禁见下节；提交信息符合仓库风格。

## AI 开发工作流程（守则细则）

边界与变更分级判据见根 [AGENTS.md](../../AGENTS.md)「变更分级与边界」；本节是其执行细则
（六步模式，ADR 0012 授权本节承载 AI 开发流程正文）。接到任务按序执行：

1. **读必读文档**：[项目状态快照](../trackers/project-status.md)（30 秒现状）→
   [本地开发环境](../standards/local-dev.md)（环境与必做命令）→
   [文档治理规范](../standards/doc-governance.md)（文档链路）→
   [任务生命周期](../standards/task-lifecycle.md)（任务分类与计划准入）；
   涉及契约再读 [8900 API 接口文档](../architecture/api-contracts.md) 与
   [数据库总纲](../architecture/database-design.md)。
2. **确定边界（变更分级）**：按 AGENTS.md 分级表定级——architecture/ 改动与 design/ 大变更为
   大修改；docs/ 目录结构变化为阻止项（默认不做，除非人类同意）；design/ 小修/bug 走长期
   台账；一般小改豁免。**未定级不实施**，先询问用户。
3. **建 plans/ 与 todo（如需）**：大修改先 todo 登记 + `plans/` 计划（元数据与章节按
   任务生命周期）；design/ 小修或 bug 登记[设计类小修与 bug 修复台账](../plans/design-bugfix-log.md)
   并补充设计文档；豁免级直接实施，以差异与验证记录承接。
4. **按 code-map 定位并实现**：[code-map](../architecture/code-map.md) 找到模块与关联设计
   （DesignRef）→ 先写测试再实现（TDD），遵循下节测试分层。
5. **测试总结**：运行门禁（见下节「测试与门禁」，前端另按 local-dev.md 必做命令构建），
   总结改动范围与验证证据（提交 hash、测试数字）。
6. **收尾清理**：plan 关闭两态判定（Retain → `history/plans/` 归档 / Delete）、todo 移入
   completed.md、design-bugfix-log 与受影响 design/architecture 文档同步、契约测试全绿；
   主线任务另按[文档治理规范](../standards/doc-governance.md)做文档一致性梳理。

## 测试与门禁

```powershell
# 全量测试（根）
conda run -n QED_env python -m pytest tests -q

# 契约治理测试（standards/ADR/计划/台账/文档结构/架构设计语义/代码映射）
conda run -n QED_env python -m pytest tests/contract -q

# 代码质量
conda run -n QED_env python -m ruff check backend tests
```

- 分层：单元/集成测试 `tests/`（根）+ 契约测试 `tests/contract/`。
- 使用 `--strict-markers`，标记需在 `pyproject.toml` 注册；当前测试不使用 marker。
- 文档治理规则变更必须同步运行 `tests/contract/` 守护测试。
- 前端门禁（web-ui 改版后）：`cd web-ui && npm run build && npm test`（vitest）+ `tsc` 无错。

## 文档与映射同步

- 受管模块（`backend/qed_engine/` 与 `tests/`）文件头必须声明
  `设计关联（DesignRef）：docs/...<文档>.md` 与 `实现状态：Current`。
- 架构或设计契约变化同步 `docs/architecture/code-map.md` 后运行
  `tests/contract/test_code_document_mapping.py`；架构变更运行
  `tests/contract/test_architecture_documents.py`；设计变更运行
  `tests/contract/test_design_documents.py`。
- 文档体系规则（确定/相对确定/实时状态、版本机制、归档）见[文档治理规范](../standards/doc-governance.md)。

## 子项目开发速览

| 项目 | 现状 | 门禁与启动 |
| --- | --- | --- |
| Axiom-Flow | 8902（已迁移，2026-08-11 ALN-002；8000 兼容保留） | 分支 `release`，本地门禁 + 契约测试；启动/验证命令见 `Axiom-Flow/docs/guides/` |
| QED-Tracker | 8901（已服务化，写操作后台任务 + 轮询） | 分支 `dev`→`release`→`main`；启动/验证命令见 `QED-Tracker/docs/guides/` |

跨项目协作规范（根仓库不得产生子项目代码改动）见
[跨项目协作规范](../standards/cross-project-collaboration.md)。
