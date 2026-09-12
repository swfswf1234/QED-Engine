# 代码规范

状态：Current
最后更新：2026-09-11
确认状态：已确认
治理对象：代码风格、命名、类型与错误处理、日志、依赖声明、前后端分层与允许/禁止清单
依据 ADR：`docs/adr/0013-dev-standards-system.md`
关联测试：`tests/contract/test_code_standards_governance.py`

## 目的与边界

本标准定义根仓库 QED-Engine 前后端代码的书写与组织规则，作为 agent 与开发者实现任务的单一
判据。可复制命令归[开发指南](../guides/development.md)；文件头 DesignRef 字段定义归
[文档与代码双向追溯规范](code-document-traceability.md)；测试分层与隔离归
[测试架构与门禁](testing.md)；数据根与临时目录归[临时目录与数据存储规范](storage-conventions.md)。
本标准只写规则，不复制上述正文。

## 强制规则

### 通用

- 中文交流与注释；标识符、API 字段与外部协议名保留英文。
- 文件编码 UTF-8、行尾 LF；Python 模块文件名 `snake_case.py`，前端组件文件名 `PascalCase.tsx`。
- 单一职责：一个模块承担一类责任；跨域逻辑经服务层，不跨层直连。

### 后端（Python 3.12）

- 语言基线：`pyproject.toml` 的 `requires-python = ">=3.12"`；解释器为 conda 环境 `QED_env`。
- 格式与静态检查（ruff，`pyproject.toml` `[tool.ruff]`）：`target-version = "py312"`、
  `line-length = 120`、`lint.select = ["E", "F", "I", "B", "UP"]`、`ignore = ["E501"]`。
  门禁 `ruff check backend tests` 必须 clean。
- 模块头：首个 import 前使用中文 docstring，声明模块职责、`设计关联（DesignRef）` 与实现状态
  （字段定义见[文档与代码双向追溯规范](code-document-traceability.md)）。
- 命名：模块 / 函数 / 变量 `snake_case`，类 `PascalCase`，常量 `UPPER_SNAKE`；内部符号前缀 `_`。
- 类型：公开函数与 FastAPI 路由使用类型标注；请求体经 Pydantic v2 模型校验。
- 异常与错误：领域错误经既有异常（如 `TrackerError`）映射为 HTTP 状态（4xx 透传、其余 503），
  不吞异常；错误信息不得包含密钥。
- 日志：可定位（模块 + 关键参数），不打印密钥或完整 payload；运行日志写入仓库 `logs/`。
- 依赖：新增依赖写入 `pyproject.toml`（`dependencies` 或 `[project.optional-dependencies].dev`），
  不隐式 import 未声明包。

### 前端（React 19 + TypeScript）

- 语言基线：TypeScript strict。`web-ui/tsconfig.app.json` 必须保持 `strict`、`noUnusedLocals`、
  `noUnusedParameters`、`noFallthroughCasesInSwitch`、`noUncheckedSideEffectImports` 为 `true`。
- 技术栈：React 19 + AntD 5 + Zustand + React Router + ECharts（以 `web-ui/package.json` 为准）。
- 组件：函数组件 + Hooks；页面在 `src/pages/`，通用组件在 `src/components/`，状态在 `src/stores/`。
- 状态：服务端事实以 `fetchAll()` 拉取为准，禁止乐观更新（见文档下载管理交互规范 §3.1）。
- 构建门禁：改动后必须 `cd web-ui && npm run build`（`tsc -b && vite build`），否则 8903 不生效；
  `npm test`（vitest）必须全绿。
- 唯一入口：前端只连 8900（ADR 0007），不直连 8901 / 8902。

### 分层与边界

- 后端三域：`backend/qed_engine/api/`（路由）、`clients/`（上游客户端）、`services/`（领域服务）；
  路由只做参数校验与错误映射，业务逻辑在服务层。
- 来源适配器：只搜索与解析下载地址；文件写入、重试、校验、哈希与去重必须经通用服务。
- 密钥：只存 `.env`，不下发、不进入日志 / 异常 / 响应。
- TLS 校验默认开启，仅用户显式配置可关闭。

### 依赖管理

- 后端依赖唯一事实源为 `pyproject.toml`；前端为 `web-ui/package.json` 与 `package-lock.json`。
- 版本变更同步锁文件，不手工编辑 lock。

### 允许与禁止清单

| 允许 | 禁止 |
| --- | --- |
| 在 `backend/qed_engine/`、`web-ui/src/` 内按分层新增模块 | 隐式扫描、移动或删除数据根内 PDF |
| 经既有服务与客户端调用上游 | 绕过 TLS 校验、把密钥写入日志 / 响应 |
| 在测试中使用临时目录与 fake | 测试读写真实数据根 / 运行数据库 / 公网 / 外部模型 |

## 执行与门禁

- 后端：`ruff check backend tests` 与 `pytest tests -q` 全绿。
- 前端：`npm run build`、`npm test`（vitest）与 `tsc` 无错。
- 受管模块变更同步 `docs/architecture/code-map.md` 与文件头 DesignRef（见
  [文档与代码双向追溯规范](code-document-traceability.md)）。
- `tests/contract/test_code_standards_governance.py` 守护本标准与 `pyproject.toml`、
  `web-ui/tsconfig.app.json`、根 `AGENTS.md` 强制约束的一致性。

## 变更与取代

改变语言基线、静态检查配置、分层边界或允许 / 禁止清单等实质规则时，先按
[ADR 治理规范](adr-governance.md)新增 ADR；措辞、链接与示例勘误可直接修改。
