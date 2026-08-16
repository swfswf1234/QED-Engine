# 2026-08 LLM 状态收敛与 DB 启动快照轮（llm-status-convergence）

状态：Accepted
任务类型：B
最后更新：2026-08-16
关联 ADR：[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)、[ADR 0008](../adr/0008-frontend-react-refactor.md)
关联设计：[config-center-api.md](../design/config-center-api.md)（五合一角色与契约）、
[backend-domain-split.md](../design/backend-domain-split.md)（三域）、
[frontend-react-refactor.md](../design/frontend-react-refactor.md)（控制台/界面结构）、
[service-control.md](../design/service-control.md)（控制台）
关联 Tracker：`docs/trackers/todo.md`（ARCH-014 登记）
归档判定：代码改动全绿（261 基线 → 改造后全量）+ 契约全绿 + 文档同步 → Completed，
归档至 `history/plans/2026-08/`

## 前置条件

- 2026-08-16 用户裁决（ARCH-013 验收时）：
  ① Axiom-Flow 端口已迁移 8902（排查确认，REQ-001 Achieved），four-service-architecture 等过时表述更新；
  ② 「文档解析进度 / 原始文档对照」为「文档解析管理」的包含子项（同步文档，前端轮实现）；
  ③ `/config/llm-status` 端点删除——LLM 供应商可达性改为 8900 启动时检查一次（写日志）；
  ④ `/config/database` 保留端点但语义改为**启动快照**（8900 启动时探测一次，端点只读快照），
  database 不再作为独立展示项（backend 服务状态的一部分）。

## 目标与成功标准

1. 删除 `/api/v1/config/llm-status` 端点与 schemas（LlmStatus/LlmStatusResponse）；8900 启动时
   对已配置供应商探测一次写日志（密钥不下发）。
2. `/api/v1/config/database` 只读启动快照（create_app 时探测一次，无 TTL 缓存/按需探测）；
   旧前端横幅移除「LLM评估模块连接」项（端点删除连带），MySQL 项保留（读快照）。
3. 前端轮设计同步：控制台/仪表盘移除独立 MySQL 卡（并入 8900 服务状态）；「文档解析管理」
   包含关系登记后续轮界面；管理后台表述更新。
4. Axiom-Flow 端口过时表述（four-service-architecture ×2、guides/development）更新为已迁移 8902。

成功标准：`pytest tests -q` + `ruff check backend tests` + `pytest tests/contract -q` 全绿；
8900 启动日志含 LLM/DB 检查；`/config/llm-status` 404；`/config/database` 返回启动快照。

## 范围与非目标

范围内：端点删除与启动检查（代码 TDD）、旧前端横幅适配（app.js + test_web）、上述文档同步、
计划/台账登记。

非目标：
- 8900 服务状态卡 UI 实装（前端轮 web-ui 实现，本轮只同步设计文档）。
- 旧前端界面组织改「文档解析管理」（十六期后退役，前端轮实现）。
- 不提交 git（项目惯例，用户统一提交）。

## 决策记录（用户裁决，2026-08-16）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | Axiom-Flow 端口 | 已迁移 8902（排查确认），文档过时表述更新 |
| D2 | 界面包含关系 | 「文档解析管理」含「解析进度 + 原始文档对照」——同步文档，前端轮实现 |
| D3 | /config/llm-status | 删除端点；8900 启动时检查一次（写日志） |
| D4 | /config/database | 保留端点，语义改启动快照；不单独列为界面展示项 |

## 工作项

### 1. Axiom 端口更新
- 1.1 `four-service-architecture.md`：服务表 8902（已迁移，ALN-002/REQ-001 关闭；8000 兼容保留）；
  符合度表「Axiom-Flow 端口 8902 | 符合」。
- 1.2 `docs/guides/development.md`：8902（迁移中，当前 8000）→ 8902（已迁移）。

### 2. 界面包含关系同步
- 2.1 `frontend-react-refactor.md`：后续轮界面登记「文档解析管理（含解析进度、原始文档对照）」；
  控制台/仪表盘独立 MySQL 卡移除（并入 8900 服务状态附启动快照信息）。
- 2.2 `web-frontend.md`：现状契约标注新认知（管理后台 = 仪表大盘 / 文档下载管理 / 文档解析管理）。
- 2.3 AGENTS.md / README / project-status：管理后台表述更新。

### 3. LLM 状态收敛（代码 TDD）
- 3.1 `control.py`：删 llm_status 端点、PROBE_URLS/PROBE_TIMEOUT_SECONDS/LLM_STATUS_TTL_SECONDS；
  `schemas.py`：删 LlmStatus/LlmStatusResponse。
- 3.2 `main.py`：create_app 启动检查——`_startup_llm_check(settings)`（已配置供应商探测一次，
  经 api_control._probe_llm 运行时引用，写 logging）；`_startup_db_check(settings)` →
  `app.state.db_status` 快照。
- 3.3 测试：删 6 个 llm-status 测试 + _probe_calls 辅助；新增启动检查测试（未配置跳过/
  已配置探测/端点 404）；autouse fixture mock _probe_llm 防真实网络；database 测试改快照语义
  （去 TTL 测试，增「启动只探测一次」）。

### 4. DB 启动快照（代码 TDD）
- 4.1 `control.py` database 端点：读 `request.app.state.db_status` 快照（host/port/name/user 仍取
  settings），删除按需探测与缓存逻辑。
- 4.2 测试：_probe_mysql_calls 辅助复用（启动时注入）；test_database_cached_within_ttl →
  「两次请求仅启动探测一次」。

### 5. 旧前端横幅适配
- 5.1 `web/app.js`：移除「LLM评估模块连接」横幅项（llm-status 端点删除连带）；`tests/test_web.py`
  守护 token 同步。

### 6. 文档同步
- 6.1 `config-center-api.md`：删 /config/llm-status 契约章节；/config/database 改启动快照语义；
  「五合一角色②状态探测中心」更新（LLM 可达性改启动检查）；「强制规则」五端点 → 四端点。
- 6.2 `backend-domain-split.md`：控制域职责「配置五端点」→「配置四端点 + 启动自检」。
- 6.3 `service-control.md`：控制台依赖组件行更新（MySQL 启动快照、LLM 联通取消）。
- 6.4 `design/index.md`：config-center-api 描述更新。
- 6.5 todo/plans 登记（ARCH-014）。

## 验证与验收

- 门禁：`pytest tests -q` + ruff + `pytest tests/contract -q` 全绿。
- 冒烟（前端完成后统一验收，含 ARCH-012 Task 18）：8900 启动日志含 LLM/DB 检查；
  `/config/llm-status` 404；`/config/database` 返回启动快照（reachable/reason）；
  旧前端横幅仅剩 MySQL 项。

## 回滚

- 端点删除为向后不兼容变更：回滚 = git 恢复 control/main/schemas/app.js 与测试；文档同步回滚。
- 启动检查失败不阻塞服务启动（LLM 写日志；DB 快照 reachable=false，前端降级显示）。

## 关闭与归档

- 归档判定见文档头；Closed 后归档至 `history/plans/2026-08/`，todo 移除 ARCH-014。
