# 2026-08 后端三域拆分轮（backend-domain-refactor）

状态：Accepted
任务类型：B
最后更新：2026-08-16
关联 ADR：[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)、
[ADR 0008](../adr/0008-frontend-react-refactor.md)
关联设计：[后端三域拆分设计](../design/backend-domain-split.md)（深化版）、
[配置中心 API 契约](../design/config-center-api.md)（监控与诊断域）、
[服务控制设计](../design/service-control.md)、[配置与密钥](../design/configuration-and-secrets.md)
关联 Tracker：`docs/trackers/todo.md`（ARCH-012 登记）
归档判定：三域迁移全绿（与迁移前一致）+ 监控诊断端点真实实测 + 文档同步 → Completed，
归档至 `history/plans/2026-08/`

> **验收延后（2026-08-16 用户裁决，ARCH-013 轮）**：Task 18 真实环境实测与 8903 前端回归
> 验收统一延后至前端重构完成后执行；实施轮（Task 1-17）已完成，门禁 261 passed + ruff clean。

## 前置条件

- 2026-08-16 用户裁决：后端改造**独立成轮**（ARCH-012），与前端重构轮（ARCH-011，只做
  前端）并行推进、独立验收；方向维持三域、迁移纯度取最小分层调整、迁移先行。
- 设计文档（backend-domain-split.md 深化版）与本计划经用户验收后开工。

## 目标与成功标准

1. 三域目标结构落地：`api/control.py`（控制域路由）、`api/tracker.py`（数据域·Tracker）、
   `clients/tracker_client.py`、`services/service_manager.py`（能力层，路由剥离）、
   `services/log_viewer.py`、`services/monitor.py`。
2. 控制域新端点落地并真实实测：`GET /logs/{service}`、`GET /monitor/gpu`、
   `GET /monitor/lmstudio`、`GET /monitor/mineru`、`POST /self-restart`。
3. **对外契约零变化**：全部 /api/v1 路径、响应形状与错误语义不变（前端零改动）。
4. 迁移安全阀：Phase A 完成后 `pytest tests -q` + ruff clean 与迁移前完全一致；
   新端点 mock 单测全绿。

成功标准：`pytest tests -q` + `ruff check backend tests` + `pytest tests/contract -q`
全绿；监控端点真实数据实测（nvidia-smi 4080 / LM Studio 未启动降级 / mineru 未启动降级 /
日志真实文件 / self-restart 冒烟）。

## 范围与非目标

范围内：
- 三域机械迁移（tracker_client → clients/、data.py → tracker.py、service_manager 分层、
  配置五端点 → control.py、main.py 瘦身、cli.py import 调整）。
- 控制域新能力：log_viewer、monitor（gpu/lmstudio/mineru）、self-restart（TDD）。
- 文档同步（configuration-and-secrets 变量、config-center-api、service-control、code-map、
  four-service-architecture、project-status、ARCH-011 修订）。

非目标：
- `api/axiom.py` 与 `clients/axiom_client.py`（随文档解析对照界面轮次）。
- 本地 LLM 调用接口（LLM 网关）/ LM Studio 模型加载管理（第二轮）。
- 测试文件大拆分（`tests/test_api.py` 只改 import；新端点测试按模块新增）。
- 不改动子项目任何文件；不修改 8901/8902 契约；不改前端（8903 只依赖对外契约，本轮
  后端内部重组后前端零感知）。

## 决策记录（用户裁决，2026-08-16）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 方向 | 维持三域（控制域 / 数据域·Tracker / 数据域·Axiom 预留），修正细节而非另起炉灶 |
| D2 | 迁移纯度 | 最小分层调整：service_manager 能力与路由剥离（能力层抛 ServiceError，路由层映射 HTTP），对外契约不变 |
| D3 | 顺序 | 迁移先行（Phase A），新端点 TDD 直接落在目标结构（Phase B） |
| D4 | 归属 | 独立成轮 ARCH-012，与前端重构轮（ARCH-011 只做前端）并行推进、独立验收 |
| D5 | 控制域定义 | 命名保持「控制域」，定义为 QED-Engine 自身域（配置 + 控制 + 监控诊断 + 未来问答） |

## 工作项

### Phase A：三域迁移（安全阀：每步 pytest + ruff 全绿，全量与迁移前一致）

- A1 `tracker_client.py → clients/tracker_client.py`（git mv + 头注 + import 调整：
  api/data.py、cli.py）。
- A2 `api/data.py → api/tracker.py`（git mv + 改名 + 头注 + import 调整）。
- A3 `api/service_manager.py` 分层：能力层 → `services/service_manager.py`（新增
  `ServiceError(status_code)`、`get_specs()`，路由与 HTTPException 剥离）；路由层
  `/services` 端点族 → `api/control.py`（catch ServiceError → HTTPException 映射）。
- A4 配置五端点与 `_probe_mysql`/`_probe_llm` → `api/control.py`（缓存仍走
  `app.state.*_cache`，逻辑零变化）。
- A5 `api/main.py` 瘦身（组装 + include routers + state 注入）；全链路 import 校对
  （含 cli.py、tests 内 import）。
- A6 全量门禁 + 契约测试；迁移前后对比确认零差异（新增测试除外）。

### Phase B：控制域新能力（TDD，路由挂 control.py，能力在 services/）

- B1 `services/log_viewer.py` + `GET /api/v1/logs/{service}`：白名单（get_specs() 的
  log_name）、tail 默认 200/上限 1000（超限截断）、keyword 子串过滤、文件不存在空行、
  UTF-8 容错、未知服务 404。测试 `tests/test_log_viewer.py`。
- B2 `services/monitor.py` + `GET /monitor/gpu`：nvidia-smi 两查询解析（注入 subprocess.run），
  available=false 各分支中文原因。测试 `tests/test_monitor.py`。
- B3 `services/monitor.py` + `GET /monitor/lmstudio`：`{qed_lmstudio_url}/models` 探测
  （5s 超时，transport 注入），reachable + models。测试并入 test_monitor.py。
- B4 `services/monitor.py` + `GET /monitor/mineru`：8002 健康探测（实施期按 mineru 实际
  端点校准），reachable=false + 中文原因。测试并入 test_monitor.py。
- B5 `services/service_manager.py` 新增 `restart_self()` + `POST /api/v1/self-restart`：
  spawn 新进程 → 健康轮询（10s 窗口）→ `os._exit(0)`；失败 500 + 中文提示不自动回滚。
  测试 `tests/test_self_restart.py`。
- B6 真实环境实测（人工）：nvidia-smi 4080 真实数据、LM Studio 未启动降级、mineru 未
  启动降级、日志真实文件、self-restart 冒烟（新进程健康、旧进程退出）。

### Phase C：文档同步

- C1 `configuration-and-secrets.md` 登记 `QED_LMSTUDIO_URL`（默认 1234/v1）；
  `config.py` 新增 `qed_lmstudio_url`。
- C2 code-map 登记六个目标模块、注销 `api/data.py` 与顶层 `tracker_client.py`；
  config-center-api / service-control 实现注记更新；four-service-architecture 符合度表、
  project-status 当前主线同步。
- C3 ARCH-011 计划修订（Phase 3/7 移除，指向本设计 + 本计划；todo 已更新）。

## 验证与验收

- 门禁：`pytest tests -q` + `ruff check backend tests` + `pytest tests/contract -q` 全绿。
- Phase A 安全阀：迁移前后全量测试结果一致（新增测试除外），证明零行为变化。
- 人工验收：监控端点真实数据（nvidia-smi 本机 4080、LM Studio 未启动 reachable=false、
  mineru 未启动中文原因）、日志查看真实文件、self-restart 冒烟；8903 旧前端全路由回归
  （对外契约零变化，前端零改动即验证）。
- 独立性铁律：8901/8902 离线时配置域五端点与监控端点正常返回。

## 回滚

- 全程 git 历史可回；对外契约零变化意味着回滚即恢复旧结构文件，前端无感知。
- self-restart 端点失败不做自动降级（返回明确错误，人工重启），不动既有 /services 语义。

## 关闭与归档

- 归档判定见文档头；Closed 后归档至 `history/plans/2026-08/`，todo 移除 ARCH-012。
- 设计文档（backend-domain-split.md）随实现推进更新实现状态位（Not Started →
  In Progress → Implemented/Verified）。
