# ADR 0018：数据根顶层白名单与元数据 JSON 岛禁止

状态：Accepted
日期：2026-09-24
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

2026-09-24 存储链路全链路梳理（探索→下载→解析→学习，ARCH-032）发现数据根治理与实况
漂移三处：

1. **野生顶层区**：`dataset/` 实际顶层出现约定未登记目录——`backups/`（arch020f 两次 D 类
   数据操作的备份留痕），`parsed/` 内还有探针残留 `probe/<id>`；`tmp/参考书籍/` 把用户资产
   放进了「任务结束清理」区。约定只声明三区（raw/tmp/parsed），缺「此外还能有什么」的
   边界规则，agent 与守护测试无白名单可断言。
2. **元数据 JSON 岛僵尸代码**：QED-Tracker `src/qed_tracker/inventory.py:42-46` 仍会写并
   读取 `<data_root>/qed-tracker/meta/resources/<sha256>.json` 与 `meta/transfers/axiom/
   <sha256>.json`——该元数据岛已被 REQ-032 判死（meta/ 退役、DB 为元数据唯一事实源），
   磁盘存量已在 arch020f 备份后删除，但代码路径未退役，一旦 register 触发即重建，直接
   违反「dataset 内不维护 JSON 状态事实源」。
3. **虚构约定**：`dataset-conventions.md` 声明的解析中间产物区 `tmp/axiom-flow/<job-id>/`
   无任何代码写入、磁盘上不存在；实况是 Axiom-Flow 瞬态文件全部在产物目录同目录
   （隐藏临时文件 + ingest 暂存子目录，用完即清）。

高星开源项目惯例对照：paperless-ngx（DB 为事实源、文件区纯追加）、Hugging Face Hub 缓存
（blobs + 指针快照，目录由程序精确声明）共同点是**数据目录骨架可枚举、元数据不 spill 到
文件区、盘↔库可对账**。本项目前两者已有雏形（页图硬链接去重、`active_job_id` 指针切换），
缺的是声明边界与对账机制。

## 决定

1. **数据根顶层白名单登记制**：`<QED_DATA_ROOT>` 顶层只允许
   [dataset 目录约定](../design/dataset-conventions.md)「数据根顶层白名单」节登记的目录。
   当前白名单：`raw/`、`tmp/`、`parsed/`、`backups/`。其中 `backups/` 为**例外区**：仅供
   D 类数据操作的备份留痕，命名 `YYYY-MM-DD-<任务标识>`，对应操作必须在根 todo/收口记录
   登记；不承诺长期保留，删除属 D 类操作（用户确认）。新增/移除白名单条目 = 存储规则
   实质变更 → 先新增 ADR。
2. **元数据 JSON 岛禁止**：dataset 内除两类例外，禁止落「状态/登记/留痕」类 JSON 元数据
   文件：① `parsed/**` 产物内部文件（book.json / manifest.json / blocks.json / chunks.json
   等，解析管线自身产物）；② 知识正本例外（`raw/<domain>/domains.json`、
   `raw/<domain>/<course>/tutorials.json`，REQ-078 裁决，状态事实源仍在 DB）。
   QED-Tracker `qed-tracker/meta/**` 据此判为僵尸路径，须走跨项目请求退役（登记
   REQ-093，根仓库不改子项目代码）。
3. **tmp 区语义收口**：`tmp/` 合法内容限两类——写入方任务中间产物（任务结束必须清理）
   与 `tmp/exploration/` 用户探索发起文档（唯一用户资产例外）。用户参考资产不得放
   `tmp/`；存量 `tmp/参考书籍/` 登记为迁移候选（D 类数据操作，去向待用户裁决，不自动
   移动）。解析中间产物不入 tmp：Axiom-Flow 瞬态文件为产物目录同目录隐藏临时文件与
   ingest 暂存子目录，用完即清。
4. **虚构约定删除**：`tmp/axiom-flow/<job-id>/` 从目录约定中移除，改为上述实况描述；
   「当前版视图」表述同步修正为 `af_books.active_job_id` 指针选版语义（读取方经指针
   解析作用域，根视图仅承载 legacy 首版）。

考虑过的替代方案与排除原因：① 只把现状标注为「三区 + 野生区」不加白名单制——排除，
未声明目录让文档与实况永远追赶，守护测试无从断言骨架；② 根仓库直接修 Tracker 的 meta
JSON 岛代码——排除，违反跨项目协作规范（根仓库 agent 在子项目工作区只读 + 写文档），
退役须走请求流程；③ 立即把 `tmp/参考书籍/` 迁入 `raw/_general`——排除，动用户数据是
D 类操作须用户明确裁决去向；④ `backups/` 判违规删除——排除，它是 D 类操作合规留痕，
删留痕反而破坏可追溯性，正解是登记为受命名与台账约束的例外区。

## 后果

- **正面**：数据根骨架可机械核对（契约测试断言白名单节与标准一致）；JSON 岛退役有明确
  规则依据；tmp 语义无歧义（清理/例外边界清晰）；对账 doctor（REQ-096）有了白名单这个
  前置事实源。
- **负面/代价**：`backups/` 例外使顶层不再是纯三区，若备份操作不守登记纪律会成垃圾场
  （缓解：命名规则 + 台账登记 + 删除属 D 类）；JSON 岛退役依赖子项目排期，期间代码仍
  可能重建 `qed-tracker/meta/`（已登记请求跟踪）。
- **中性**：`parsed/probe/`、staging 残留等存量清理候选不改本 ADR 规则，走 REQ-094
  待用户发令；本 ADR 不实现对账工具本体。

## 关联

- [存储规范](../standards/storage-conventions.md)（规则正文落点：白名单登记制、JSON 岛
  禁止、tmp 语义收口）；[dataset 目录约定](../design/dataset-conventions.md)（白名单节、
  tmp 实况、指针选版语义）；
- [ARCH-032 计划壳](../history/plans/2026-09/2026-09-24-storage-chain-governance-round.md)（本轮执行记录）；
- 前序裁决：[ADR 0013](0013-dev-standards-system.md)（存储规范设立）、REQ-032（meta/ 退役）、
  REQ-078（知识正本例外）、[ADR 0014](0014-parsing-ownership-and-model-boundary.md)（解析管线归
  Axiom-Flow）；
- 守护：`tests/contract/test_storage_conventions_governance.py`（白名单哨兵区一致性与
  虚构约定不复活断言）；
- 验收：standards 与 design 两文档含本 ADR 引用；白名单节存在且与标准一致；
  `tmp/axiom-flow` 在 design 正文命中 = 0；REQ-091/092/093/094/096 台账登记齐（doctor 行原登 REQ-090 撞号已改，见 todo 行注记）。
