# 解析界面展示优化轮（parsing-display-round）

状态：Closed（2026-09-20 关闭归档）
任务类型：B
（任务类型注记：B 确定性实现——用户 2026-09-20 界面优化四点裁决明确，无实验决策内容；
dataset 物理清理属 D 类，另归 ARCH-020-F 承载不在本计划执行）
最后更新：2026-09-20
关联 ADR：[ADR 0007](../../../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、[ADR 0014](../../../adr/0014-parsing-ownership-and-model-boundary.md)（解析管线归 Axiom-Flow，版本化落盘实施方为其）
关联设计：[design/dataset-conventions.md](../../../design/dataset-conventions.md)（解析版本划分约定，本计划登记）、[design/parsing-ui.md](../../../design/parsing-ui.md)（对照视图设计，本轮按「原始文件优先」方向增量）、[architecture/api-contracts.md](../../../architecture/api-contracts.md) §④
关联 Tracker：ARCH-020-UI（本计划镜像行）、REQ-080（请求：Axiom-Flow）、ARCH-020-F（dataset 清理承接），镜像见 [docs/trackers/todo.md](../../../trackers/todo.md)
归档判定：Retain（有效裁决并入 design/parsing-ui.md 与 dataset-conventions.md 后计划壳归档）

## 背景与用户裁决（2026-09-20）

用户 28 寸屏使用场景；《线性代数及其应用》（linearalgebra-b01）已 ingest（486 页图落盘）
但旧界面「暂无页图」——根因：原页图仅在页数据请求 200 时才渲染（解析未完成 → 404 → 无图）。

用户裁决四点：

1. **扩大展示界面**，优先展示原始文件，标准为正常 Word 100% 页面大小（A4@96dpi ≈ 794×1123px）；
   已下载完成即可直接展示 PDF（解析未完成时不展示解析模块）。
2. **解析产物存储位置约定 + 按每次解析版本划分**（实施方 Axiom-Flow → REQ-080）。
3. **对比界面加横向滚动**看完全页；解析结果纸面同为 Word 100% 尺寸。
4. **整理 `dataset/axiom-flow/` 与 `dataset/qed-tracker/` 遗留目录**，按设计清理
   （属 ARCH-020-F，D 类：清单 + 备份 + 用户确认后执行）。

## 目标与成功标准

对照界面「原始文件优先」可用：任何已同步书目进入即见原始内容（PDF 或页图），已解析页
左右 A4 纸面同宽对照、可横滚看全页；未解析页不出现解析模块与误导性错误横幅。解析版本
划分成为登记在案的跨项目约定（REQ-080 承接实施）。成功标准即「验证与验收」V1~V5 全绿。

## 范围与非目标

- 范围：8900 两个新端点（books 详情透传 + 源 PDF 流）、8903 解析页展示重构、
  dataset-conventions/api-contracts/code-map/todo 登记、清理清单与方案产出。
- 非目标：块编辑与内容修改功能（parsing-ui 后续轮）、8902 版本化落盘实现（REQ-080
  对方执行）、MinerU 端点对齐（REQ-075）、dataset 物理删除执行（ARCH-020-F 用户确认后）。

## 前置条件

- linearalgebra-b01 已 ingest（af_books.file_path + parsed 页图在位）——2026-09-20 已实证。
- 8900/8902/8901 联调链路已最小打通（2026-09-20 联调最小打通轮完成）。
- 无 API key / 公网 / 真实数据根依赖（测试全部 MockTransport + tmp_path）。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | 8900：`GET /books/{id}` 透传 + `GET /books/{id}/file` 源 PDF inline 流（数据根包含性校验防穿越；404/400/503 语义） | 完成（TDD 先红后绿，test_api 92 passed + ruff） |
| W2 | 8903：解析页重构——maxWidth 2400、树列 5/对照列 19；已解析页 A4 纸面左右对照（页图 URL 直构不依赖页数据成功）+ overflowX 横滚；未解析（页数据 404）隐藏解析模块、iframe 直显源 PDF | 完成（vitest 192/192 + tsc；浏览器验收 V5） |
| W3 | 约定与登记：dataset-conventions.md 解析版本划分（versions/<job_id>/ + 当前版视图）；REQ-080 请求 Axiom-Flow 实施；api-contracts.md §④ 两端点登记；code-map 同步 | 完成 |
| W4 | dataset 清理清单与方案（axiom-flow/ 空壳、qed-tracker/meta 死数据、raw/math.rar、tmp/参考书籍；QED-Tracker state_dir 死代码移交已登记 ARCH-020-F） | 完成（2026-09-20 用户裁决执行范围＝仅退役目录+meta 死数据：`dataset/axiom-flow/`、`dataset/qed-tracker/`（含 meta 11 JSON+marker）备份至 `dataset/backups/2026-09-20-arch020f/` 逐字节校验后删除，两 `.gitkeep` git rm 暂存未提交；math.rar/参考书籍/.download 保留不动） |
| W5 | 门禁全量 + dist 重建重启 8903 + 浏览器实测 | 完成（全量 pytest 494、契约 63、vitest 193、ruff 干净；browser-use 实测未 ingest PDF 直显与已 ingest 原页图两分支，截图留存） |

## 验证与验收

- V1 `conda run -n QED_env python -m pytest tests -q` 全绿（含 test_api 新增 6 用例）。
- V2 `ruff check backend tests` 干净。
- V3 `tests/contract` 全绿（api-contracts/code-map/计划治理/todo 镜像）。
- V4 web-ui `tsc --noEmit` + `vitest run`（含新用例「页未解析 404 → PDF 直显 + 解析模块隐藏」）
  + `npm run build` 绿。
- V5 浏览器实测（browser-use，8903 重建 dist 后）：《线性代数及其应用》未解析页见 PDF、
  无错误横幅；已解析书（如有）A4 纸面左右对照 + 横滚；无 file_path 书目显示空态。

## 回滚

- 代码改动均未提交前 `git diff` 可逐文件还原；已获用户指令方可 commit。
- 新端点为纯增量（无旧端点语义变化），回滚=还原 api/axiom.py、axiom_client.py 与测试新增段。
- 前端回滚=还原 Parsing.tsx / parsing.ts / axiom.ts / Parsing.test.tsx；dist 重建覆盖。
- dataset 真实数据：本计划代码/文档改动不写数据根；W4 清理仅按 2026-09-20 用户裁决范围
  执行（备份于 `dataset/backups/2026-09-20-arch020f/`，可回滚）。

## 关闭与归档

- W1~W5 完成 + V1~V5 证据展示 + 用户浏览器验收确认后关闭：todo 移除 ARCH-020-UI/REQ-080
  （REQ-080 待对方回执，不随本计划关闭），写入 completed.md。
- 裁决事实并入 design/parsing-ui.md（展示基准）与 dataset-conventions.md（版本划分，已落）；
  计划壳按归档判定 Retain 迁入 history/plans/2026-09/。
