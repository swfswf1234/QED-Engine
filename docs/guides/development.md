# 开发指南

状态：Current
最后更新：2026-08-09
依据 ADR：`docs/adr/0001-root-contract-tests.md`

本指南只保存根仓库可重复执行的开发与验证命令。子项目的开发/运维命令以其自身
`docs/guides/` 为准（Axiom-Flow 见 `Axiom-Flow/docs/guides/development.md`，
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

## 测试

```powershell
conda run -n QED_env python -m pytest tests -q
```

- 契约治理测试在 `tests/contract/`，守护 standards、ADR、计划、台账、文档结构、架构/设计
  文档语义与代码映射；改动治理规则必须同步运行。
- 分层：单元测试 `tests/`（根），契约测试 `tests/contract/`。
- 使用 `--strict-markers`，标记需在 `pyproject.toml` 注册；当前测试不使用 marker。

## 代码质量

```powershell
conda run -n QED_env python -m ruff check src tests
```

## 启动配置中心

```powershell
conda run -n QED_env python -m uvicorn qed_engine.api.main:app --port 8900
```

- 健康检查：`GET http://127.0.0.1:8900/api/v1/health`
- 模型路由：`GET http://127.0.0.1:8900/api/v1/config/models`
- 配置状态：`GET http://127.0.0.1:8900/api/v1/config/keys`（只返回供应商 key 是否设置的布尔，
  不返回密钥值）
- 可达性探测：`GET http://127.0.0.1:8900/api/v1/config/llm-status`（真实探测）、
  `GET http://127.0.0.1:8900/api/v1/config/database`（真实连接探测，首次 3-5s）
- 五接口契约与响应示例见[配置中心 API 契约](../design/config-center-api.md)
- 密钥检查脚本：`python scripts/check_api_keys.py`（需要 `scripts/load-env.ps1` 加载 `.env` 后
  运行；未加载或 `.env` 为空时预期输出 `ALL_SET=0`，属正常降级）

## 文档与映射同步

- 受管模块（`src/qed_engine/` 与 `tests/`）文件头必须声明
  `设计关联（DesignRef）：docs/design/<文档>.md` 与 `实现状态：Current`。
- 架构或设计契约变化同步 `docs/architecture/code-map.md` 后运行
  `tests/contract/test_code_document_mapping.py`；架构变更运行
  `tests/contract/test_architecture_documents.py`；设计变更运行
  `tests/contract/test_design_documents.py`。

## 子项目开发速览

| 项目 | 现状 | 门禁与启动 |
| --- | --- | --- |
| Axiom-Flow | 8902（迁移中，当前 8000） | 分支 `release`，本地门禁 + 契约测试；启动/验证命令见 `Axiom-Flow/docs/guides/development.md` |
| QED-Tracker | 8901（已服务化，写操作后台任务 + 轮询） | 分支 `dev`→`release`→`main`；启动/验证命令见 `QED-Tracker/docs/guides/development.md` |

四服务启停托管（控制中心）规划中，见[服务控制设计](../design/service-control.md)。
