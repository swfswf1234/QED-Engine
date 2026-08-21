# 开发指南

状态：Current
最后更新：2026-08-20
依据 ADR：`docs/adr/0001-root-contract-tests.md`

本指南保存根仓库 QED-Engine **怎么开发**：环境准备、门禁命令、开发工作流与代码-文档追溯。
服务启停等**操作步骤见 [operations.md](operations.md)**；架构与契约见
[架构索引](../architecture/index.md) 与 [设计索引](../design/index.md)。子项目的开发命令
以其自身 `docs/guides/development.md` 为准（Axiom-Flow 见 `Axiom-Flow/docs/guides/development.md`，
QED-Tracker 见 `QED-Tracker/docs/guides/development.md`；跨项目契约只链接不复制）。

## 环境准备

根仓库推荐在 conda 环境 `QED_env` 中开发（该环境已安装 fastapi、uvicorn、pydantic、httpx、
ruff 等依赖）：

```powershell
conda run -n QED_env python -m pip install -e ".[dev]"
```

注意：`conda run` 不支持多行 `python -c` 脚本（`AssertionError: newlines not implemented`），
需要临时脚本时先写入临时文件再执行：

```powershell
conda run -n QED_env python C:\Users\86182\AppData\Local\Temp\opencode\check_names.py
```

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
- 文档体系规则（确定/相对确定/实时状态、版本机制、归档）见[文档规范](../standards/documentation.md)。

## 子项目开发速览

| 项目 | 现状 | 门禁与启动 |
| --- | --- | --- |
| Axiom-Flow | 8902（已迁移，2026-08-11 ALN-002；8000 兼容保留） | 分支 `release`，本地门禁 + 契约测试；启动/验证命令见 `Axiom-Flow/docs/guides/` |
| QED-Tracker | 8901（已服务化，写操作后台任务 + 轮询） | 分支 `dev`→`release`→`main`；启动/验证命令见 `QED-Tracker/docs/guides/` |

跨项目协作流程（根仓库不得产生子项目代码改动）见
[跨项目协作流程](../standards/cross-project-collaboration.md)。
