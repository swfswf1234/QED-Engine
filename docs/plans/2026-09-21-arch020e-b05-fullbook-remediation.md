# PLAN-048：b05 全本解析止血与根治轮（b05-fullbook-remediation）

状态：Blocked（W4 等用户裁决或 REQ-087 回执；W1/W2/W3/W3.1/W5/W5.1/W6 已 Done）
任务类型：支线实施/取证计划（挂 ARCH-020-E）
最后更新：2026-09-22
关联 ADR：[0014](../adr/0014-parsing-ownership-and-model-boundary.md)（模型生命周期归 8900、解析管线归 Axiom-Flow）
关联设计：[llm-gateway.md](../design/llm-gateway.md)、[local-model-management.md](../design/local-model-management.md)（约束 9/10）
关联 Tracker：todo `ARCH-020-E` / `REQ-086` / `REQ-087`；本轮同批收口 todo `REQ-036` / `REQ-057`（见 completed.md）
归档判定：Retain（验收达标后壳归档 `history/plans/2026-09/`，根因事实已在 REQ-086 行与 completed.md 留存）

## 目标与成功标准

b05（Rudin《数学分析原理》317 页）全本解析端到端达成：317 页产物齐备且版本激活
（`af_books.active_job_id` 指向全本版本目录），用户浏览器确认解析效果 ⇒ ARCH-020-E 收口。

## 范围与非目标

- 范围：根因取证、根侧止血（逐页路径 + 补跑续传）、台账收口、复测证据留存。
- 非目标：全本分块提交的**实现**（归 Axiom-Flow，REQ-086）；b11 卷（用户裁决本轮不含）；
  解析 UI 暂缓增强（见 todo E 行注记）。

## 前置条件

- 8902 在跑、MinerU（5002）单实例可用；ARCH-017 占用闸门保障同刻单解析（REQ-085 约定：
  解析在飞不重启 vision 槽位）。

## 根因结论（2026-09-21 取证收口）

`pages:null` 全本走 `parse_document` 整本**单任务**× 单一 deadline `AXIOM_OCR_TIMEOUT=600s`
（`engines/mineru.py:318-323`、`orchestrator/pipeline.py:389-390`），而 MinerU 内部按
`processing_window_size=64` 分批推理 ⇒ 凡 >~60 页书必超时（进度恒 0、抖动整本归零）。
早前「容器重启抖动是根因」「8902 未提交到 MinerU」两项判断均被修正——殊途同归撞同一堵墙。
证据：`_failed_0a543bc67ae7` 版本目录 + 容器日志（15:00:50 窗口 1/5 起跑、15:10:43 超时）。

## 工作项

| # | 工作项 | 状态 | 证据 |
| --- | --- | --- | --- |
| W1 | 根因定位（600s 墙）| Done | 上节；todo E 行已按实况改判 |
| W2 | 止血 A：b05 以 `pages:[1..317]` 逐页路径重跑 | Done（312/317）| job `7af72c68180e` completed，失败页 48/98/136/162/282（页级失败不杀 job，MinerU `failed_tasks=0`）；watcher `scripts/diag_watch_b05.py` → `scripts/diag_watch_b05.log` |
| W3 | 补跑续传：再提交 `pages:[1..317]`（预期跳过已成 312 页只补 5 页）⇒ 全本版本激活 | Done（结果证伪预期）| 09-22 job `550eeec91845`：提交前经用户逐字批准将 `af_books.active_job_id` 由悬空探针改指 `7af72c68180e`；实测**续跑未跳过**已成页（进度从 0 整本重解析），终态仍 312/317、**同 5 页失败**（确定性）；两发现均入 REQ-087 |
| W3.1 | 失败页根因取证 | Done | 5 页页图 17331B 完全同字节、目检纯白（PDF 空白页）；MinerU 同参直连复现 4 秒 `completed` + `content_list=[]`——空产物合法，但引擎 `mineru.py:170-173` 抛「无结构化产物」⇒ 页级失败 ⇒ 激活门槛（全页齐备）永不可达 |
| W4 | 用户浏览器验收解析效果 ⇒ ARCH-020-E 收口 | Blocked | 阻塞证据 = W3/W3.1；恢复条件 = 用户裁决「部分验收（312 页生效版已在位，缺 5 页为空白）」或「等 REQ-087 回执全本复测」；不得以接口 200 代称显示正常 |
| W5 | 根治 B：登记跨项目请求 REQ-086（分块提交 + deadline 按块计）| Done（进行中）| todo REQ-086 行；对方回执后根侧以 `pages:null` 全本复测关闭 |
| W5.1 | 登记跨项目请求 REQ-087（空白页合法化 + 跨版本续跑语义确认）| Done（进行中）| todo REQ-087 行（本轮取证即其证据）|
| W6 | 台账收口：REQ-036 / REQ-057 关闭 + project-status C 组快照更新 | Done | completed.md 两行（09-21）；本计划提交锚点 |

## 验证与验收

- W3 后核验：`GET /api/v1/parse-jobs/{id}` 终态 completed 且 progress 317/317、
  `versions/<job_id>/` 文件齐备、`active_job_id` 置位。
- 验收 = W4 用户浏览器确认（不得以接口 200 代称显示正常）。

## 回滚

版本目录机制天然可回滚：补跑 job 失败不污染既有根视图/旧版本（`seed_version_from`
copy-on-write）；`_failed_` 前缀隔离目录不删除，留作 REQ-086 取证。

## 关闭与归档

W3/W4 达成后本壳 Retain 归档 `history/plans/2026-09/`，todo E 行随验收移 completed.md；
REQ-086 独立留跟踪，其关闭不阻塞本计划。
