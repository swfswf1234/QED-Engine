# 设计类小修与 bug 修复台账（design-bugfix-log）

状态：Current（长期滚动台账）
最后更新：2026-09-20
关联任务：REQ-069（见 [todo.md](../trackers/todo.md)）

> **定位声明**：本文档是**长期滚动台账**，不是一次性计划——**不随任务完成归档**
> （plans/ 归档规则的例外，本声明即依据，豁免清单见
> `tests/contract/test_plan_governance.py::STANDING_DOCS`）。承载 `design/` 文档的小修改
> 与 bug（行为与设计不符、错漏修正）：登记 → 修复 → 同步设计文档 → 关闭（ADR 0012）。
> 大修改不走本表，按根 `AGENTS.md`「变更分级与边界」建 todo + plans/ 计划。

## 记录格式

每条记录一个条目（`### BUGFIX-NNN：<一句话标题>`），字段：

| 字段 | 说明 |
| --- | --- |
| 发现日期 | 首次发现的日期（相对日期一律转绝对日期） |
| 设计文档 | 受影响的 `design/`（或 architecture/）文档路径 |
| 问题与根因 | 现象、与设计/预期的偏差、根因定位（文件：行号） |
| 修复与验证 | 修复方式、门禁证据（测试数字/构建结果） |
| 状态 | 待修复 / 已修复（附完成日期） |

条目关闭时同步检查对应设计文档是否需要补充措辞；设计文档本体随后更新，不在本表复制
设计正文。

## 台账

### BUGFIX-001：课程侧边栏误用 note 字段展示课程描述

- **发现日期**：2026-09-09
- **设计文档**：`../design/downloads-flow.md`（课程侧边栏展示）
- **问题与根因**：文档下载管理右侧栏课程条目展示 `course.note`（课程简介），而设计预期
  展示 `course.description`（课程描述），`CourseRecord` 两字段并存导致误用
  （`web-ui/src/pages/Downloads.tsx`）。
- **修复与验证**：右侧栏改用 `course.description`（`Downloads.tsx:267`、`Downloads.tsx:1092`）；
  vitest + tsc + build 通过（2026-09-09 会话）。
- **状态**：已修复（2026-09-09）

### BUGFIX-002：control.py 本地模型端点注释块沿用 v1 双单元语义

- **发现日期**：2026-09-16
- **设计文档**：`../design/local-model-management.md`、`../design/llm-gateway.md`（/models 端点契约）
- **问题与根因**：`backend/qed_engine/api/control.py` 的「本地模型端点族」注释块（原 ~L148）
  沿用 v1 表述（旧名 qwen/mineru 模型名路由、前端轮询 `/monitor/qwen` 收敛），而
  PLAN-046 W1-W3 已将实现槽位化（/models/{slot} 路径、ensure_local_ready 单活仲裁、
  manifest.active 运行态、GET /models/{slot} 就绪收敛），注释与实现不符。
- **修复与验证**：W4 随端点槽位化改造同步重写注释块为 v2 描述（槽位名路径 + 旧名别名
  deprecated、api 模式 409 / 未知槽位 404、GET /models/{slot} 三卡数据源、select 写运行态、
  单活仲裁指引 model_manager.py）；`pytest tests -q` 464 passed + ruff clean（2026-09-16）。
- **状态**：已修复（2026-09-16）

### BUGFIX-003：registry.resolve 注入的 manifest_root 未贯穿 local 渠道解析

- **发现日期**：2026-09-16（W7 真实冒烟暴露）
- **设计文档**：`../design/llm-gateway.md`（注册表解析规则）、`../design/local-model-management.md`（运行态覆盖）
- **问题与根因**：`backend/qed_engine/services/llm/registry.py` 的 `_resolve_local` 调用
  `local_binding(settings, slot)` 时未传 `manifest_root`，后者内部按 `manifest.active`
  **重算**生效身份——回读真实仓库 `model/qwen/manifest.json`，覆盖外层已解析身份，
  测试注入的临时 manifest 根失效。潜伏缺陷：此前真实 manifest.active 恰为空，测试
  侥幸通过；W7 冒烟经 /models/text/select 写入 active=qwen3.8-27b 后，
  `test_resolve_local_text_env_identity_no_runtime_state` 即失败。
- **修复与验证**：`_resolve_local` 增加 `manifest_root` 参数并贯穿到 `local_binding`，
  `resolve()` 透传；新增回归测试 `test_resolve_local_manifest_root_threaded_through`
  （manifest.active 优先于 .env 身份 × 注入根生效）；`pytest tests -q` 470 passed +
  ruff clean（2026-09-16）。
- **状态**：已修复（2026-09-16）

### BUGFIX-004：模型相关测试未隔离运行态 manifest，依赖用户本机状态

- **发现日期**：2026-09-16（PLAN-046 v3 代码轮）
- **设计文档**：`../design/local-model-management.md`（运行态 manifest）、`../design/llm-gateway.md`（解析优先级）
- **问题与根因**：`ensure_local_ready` / `resolve` / `probe_slot` 经 `registry.MANIFEST_ROOT`
  回读真实仓库 `model/<槽位>/manifest.json`；测试未注入临时根，本机 manifest.active
  （如 `qwen3.5-9b`、`qwen-vl-plus`）覆盖解析结果，导致 8 个用例（test_llm_model_manager /
  test_llm_gateway / test_llm_endpoints）随用户运行态时红时绿。
- **修复与验证**：在相关测试模块加 autouse fixture，monkeypatch `registry.MANIFEST_ROOT`
  到 `tmp_path`；`pytest tests -q` 481 passed + ruff clean（2026-09-16）。
- **状态**：已修复（2026-09-16）

### BUGFIX-005：parsing-ui 设计契约 ParseJob 主键与 8902 v2 实况不符

- **发现日期**：2026-09-20（联调最小打通轮审核）
- **设计文档**：`../design/parsing-ui.md`（§5 数据契约）、`../architecture/api-contracts.md`（§④）
- **问题与根因**：parsing-ui.md §5 将 `ParseJob` 主键写为 `job_id`，而 8902 v2 实际 schema
  （Axiom-Flow `src/axiom_flow/schemas.py` ParseJob）主键为 `id`；同时 api-contracts.md §④
  仍按旧草案描述 `/review`、`strategy`、sync `relative_path`、`PageData.page_no` 等形状，
  与 8902 冻结实现（`/edit`+页级 `/edits`、`engine`、`file_path`、无 `page_no`）脱节。
- **修复与验证**：parsing-ui.md §5 主键改 `id` 并补 `/review` 门面过渡说明；api-contracts.md
  §④ 端点表按真实契约重写（sync BookSyncItem 形状、页数据 8900 补 `page_no` + image_url
  绝对地址重写、review→edit 门面、parse-jobs engine/`id`/progress 对象），规划契约表更新为
  「8902 已实现、8900 透传待实施」；8900 适配层与测试同步修改；
  `pytest tests -q` 487 passed + ruff clean + web-ui tsc/vitest 191 passed（2026-09-20）。
- **状态**：已修复（2026-09-20）

### BUGFIX-006：parsing-ui.md 正文落后于展示轮（ARCH-020-UI）已落地实况

- **发现日期**：2026-09-20（ARCH-020-C 收尾后两文档梳理轮）
- **设计文档**：`../design/parsing-ui.md`（§1/§2/§8/§10/§12）
- **问题与根因**：parsing-display-round（2026-09-20 用户四点裁决）W1~W5 已落地并经浏览器
  实测，但 parsing-ui.md 正文仍为其晋升时（2026-09-14）的形态：§2 写 `maxWidth 1600`、
  `Col lg=7/17`（实况 `Parsing.tsx:147/181/256` 为 2400、lg=5/19）；§8 态分流与 §10 降级矩阵
  写「未解析页显示解析入口」旧方向（实况已改为**原始文件优先**：`pageParsed` 才显示解析模块，
  未解析页隐藏解析模块、`ingest_status=ingested` 直构页图（`Parsing.tsx:293-298`）、未 ingest
  iframe 直显源 PDF（`Parsing.tsx:300-304`）、无 file_path 明确空态）；且全文无 A4 纸面
  （794×1123px @96dpi，`Parsing.tsx:13-14`）与横向滚动展示基准。
- **修复与验证**：裁决事实并入 parsing-ui.md——§1 演进补展示轮一行、§2 布局与 A4 展示基准
  更新、§8 态分流重写为「原始文件优先」三态、§10 矩阵两行修正、§12 差异表现状列刷新、
  实现状态 Not Started → In Progress（展示轮部分已落地，组件拆分/bbox/编辑闭环仍归
  ARCH-020-D）；`pytest tests/contract -q` 全绿。
- **状态**：已修复（2026-09-20）

### BUGFIX-007：parsing-ui.md 界面文案术语落后于 G 轮「全中文」裁决 + 刷新双按钮实现回归

- **发现日期**：2026-09-20（ARCH-020-G R4 用户复审）
- **设计文档**：`../design/parsing-ui.md`（§3 组件表、§5 openWorkbench、§8 态分流、§12 差异表、§13 验收项 7）
- **问题与根因**：①G 轮裁决「界面文案全中文」（「ingest」→「书页入库」）已并入 §7，但正文
  仍有 5 处以「ingest」指代**界面按钮/引导文案**（端点与 `ingest_status` 字段属契约命名，
  保留英文不算违规）；②复审同时发现**实现违反设计**：`Parsing.tsx` 顶部标题行并列
  「同步书目」+「刷新」两按钮，而设计 §1/§2/§5/§6/§13 五处均为「单一『刷新』（含同步书目）」
  ——R2 单屏重写时沿用旧双按钮形态，属实现缺口非设计缺漏。
- **修复与验证**：parsing-ui.md 5 处术语统一为「书页入库」；`Parsing.tsx` 删除「同步书目」
  按钮，仅留单一「刷新」（`fetchBooks(true)` 同步→重拉书目→`fetchTree()`，loading 合入
  `syncing`，tooltip 说明同步语义）；vitest 断言同步。tsc + vitest + build +
  `pytest tests/contract -q` 结果见当次门禁输出。
- **状态**：已修复（2026-09-20）
