# 开发指南

状态：Current
最后更新：2026-08-11
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
conda run -n QED_env python -m ruff check backend tests
```

## 启动后端（8900 三域）

```powershell
conda run -n QED_env python -m uvicorn qed_engine.api.main:app --port 8900
```

- 健康检查：`GET http://127.0.0.1:8900/api/v1/health`
- 模型路由：`GET http://127.0.0.1:8900/api/v1/config/models`
- 配置状态：`GET http://127.0.0.1:8900/api/v1/config/keys`（只返回供应商 key 是否设置的布尔，
  不返回密钥值）
- 启动自检（8900 启动时探测一次，ARCH-014）：LLM 供应商可达性写启动日志；
  `GET http://127.0.0.1:8900/api/v1/config/database`（读启动快照，不再按需探测；
  `/config/llm-status` 已删除）
- 数据域（8900 适配 8901）：`GET /catalogs/{course_id}`、`GET /selections`、`GET /tasks`、
  `POST /selections/{id}/confirm|backup|reject|supersede`、`GET /resources/{id}/downloads`、
  `POST /downloads/{id}/approve|reject|register`、`GET /downloads/{id}/sources`
  （旧 /resources 清单/状态机端点已随 QED-030 退役）
- 服务域：`GET /services`；`POST /services/{name}/start|stop|restart`（启停托管，过渡窗口
  15s，见 [服务控制设计](../design/service-control.md)）
- 三域契约与响应示例见[配置中心 API 契约](../design/config-center-api.md)
- 统一启停（控制中心）：8901/8902/8903 经 8900 服务域接口启停
  （`POST /services/{name}/start|stop|restart`）；8903 亦可用独立生命周期脚本
  `python scripts/qed_web_service.py start|stop|restart`（见[服务控制设计](../design/service-control.md)）

## 启动前端（8903）

```powershell
# 8903 独立启停脚本（PID + 优雅停止 + 强杀兜底，推荐）
python scripts/qed_web_service.py start
# 或直接静态服务（前台运行）
python scripts/serve_web.py
```

- `serve_web.py` 静态服务 `web-ui/dist/`（React 构建产物），监听 8903；响应统一
  `Cache-Control: no-store`（21 期根治：`python -m http.server` 无缓存头导致旧 app.js 被
  缓存，改版后硬刷新前不可见）
- 前端开发/改版后：`cd web-ui; npm run build; cd ..` 重建 dist（或 `npm run dev` 走
  Vite dev server 5173 代理 8900）
- 打开 `http://127.0.0.1:8903`；改版后普通刷新即可生效（无需 Ctrl+F5）

## 文档与映射同步

- 受管模块（`backend/qed_engine/` 与 `tests/`）文件头必须声明
  `设计关联（DesignRef）：docs/design/<文档>.md` 与 `实现状态：Current`。
- 架构或设计契约变化同步 `docs/architecture/code-map.md` 后运行
  `tests/contract/test_code_document_mapping.py`；架构变更运行
  `tests/contract/test_architecture_documents.py`；设计变更运行
  `tests/contract/test_design_documents.py`。

## 子项目开发速览

| 项目 | 现状 | 门禁与启动 |
| --- | --- | --- |
| Axiom-Flow | 8902（已迁移，2026-08-11 ALN-002；8000 兼容保留） | 分支 `release`，本地门禁 + 契约测试；启动/验证命令见 `Axiom-Flow/docs/guides/development.md` |
| QED-Tracker | 8901（已服务化，写操作后台任务 + 轮询） | 分支 `dev`→`release`→`main`；启动/验证命令见 `QED-Tracker/docs/guides/development.md` |

四服务启停托管（控制中心）已实装（2026-08-11，ADR 0007 轮；2026-08-17 扩为四单元含 web），
8900 服务域接口见[服务控制设计](../design/service-control.md)；脚本目录仅保留 8903 生命周期
脚本（`qed_web_service.py` + `serve_web.py`）。
