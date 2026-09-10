# 文档解析管理现状（Parsing）

状态：In Progress
任务类型：A
最后更新：2026-09-10
关联 ADR：`../history/adr/v0.1/0011-pending-design-location.md`（不确定文档暂居 plans/，设计确定后晋升 design/）、`../history/adr/v0.1/0012-ai-development-conduct.md`（REQ-070 重组轮置空依据）
关联设计：`../design/index.md`（design/ 文档体系：解析管理位暂置空）、`../standards/doc-governance.md`（晋升规则）、`../architecture/api-contracts.md`（8902 适配端点契约）
关联 Tracker：docs/trackers/todo.md（REQ-070-PARS 登记；现状承接 REQ-034、REQ-042）
归档判定：Retain（文档解析管理设计确定后按 ADR 0011 晋升 `design/`，本现状壳届时退役）

## 目标与成功标准

REQ-070 设计文档体系重组轮将 design/ 固定为五组语义名文档集合，**文档解析管理位暂置
空**：该功能的设计（界面信息架构定型、解析管线闭环口径、af_* 同步契约转正）尚未稳定，
不满足 design/「相对确定」门槛（ADR 0010/0011）。本文档承载其**当前实现现状**，作为：

1. 后续解析管理设计工作（第三轮主线 ARCH-020 联调后）的唯一现状基座；
2. 设计确定后晋升 `design/` 固定文档的事实来源。

成功标准：现状事实与代码一致（对拍 api/axiom.py、clients/axiom_client.py、web-ui Parsing
页）；REQ-034/REQ-042 进展变化时本文档同步更新；晋升时本文档正文可直接迁入设计文档。

## 范围与非目标

**范围**：8900 数据域·Axiom 适配层（api/axiom.py + clients/axiom_client.py）、8903
解析管理页（`#/admin/parsing`）、与 Axiom-Flow 8902 的对接契约现状（V2-007 冻结草案 +
af-books-sync REQ-042）。

**非目标**：不记录 Axiom-Flow 子项目内部实现（对方仓库事实源：docs/design/8902-integration-contract.md
与 docs/design/af-books-sync.md）；不预设未来设计结论；不修改行为代码。

## 前置条件

1. REQ-070 重组轮已完成 design/ 五组固定，解析管理位置空（2026-09-10）。
2. REQ-034（v2 适配端点）同步开发已实施；REQ-042（af_* 同步与块判定）根仓库侧已建成。
3. 8902 真实数据联调冒烟已通过（2026-08-16，01-rudin-trial）。

## 工作项（现状事实）

### 前端（8903 · `#/admin/parsing`）

- 左树右对照单视图：左树为书目列表 + 解析进度；右侧为原页图 + markdown 块级渲染 +
  块级判定交互（REQ-042 左树右对照重构，2026-08-20，vitest 89 passed）。
- 浏览器只连 8900：解析数据与图片均经 8900 代理（ADR 0007），页图走
  `GET /books/{id}/pages/{no}/image` 图片代理端点。

### 后端（8900 · 数据域·Axiom 适配层）

- 代码：`backend/qed_engine/api/axiom.py`（路由）+ `backend/qed_engine/clients/axiom_client.py`
  （HTTP 客户端，transport 可注入；非 2xx 与连接失败统一抛 AxiomError，8902 离线映射
  503——独立性铁律）。
- 对 8902 端点族（8900 侧透传/适配）：
  | 端点 | 用途 |
  | --- | --- |
  | GET /api/v1/books | 书目列表（含解析进度；REQ-042 后改读 af_books，空表回退文件系统） |
  | GET /api/v1/books/{id}/pages/{no} | 单页完整数据（原页图 URL + markdown + blocks） |
  | GET /api/v1/books/{id}/manifest | 产物清单（文件路径/大小/哈希） |
  | POST /api/v1/books/sync | 批量同步已验证书目（幂等 upsert af_books，REQ-042） |
  | PUT/GET /api/v1/books/{id}/pages/{no}/blocks/{index}/review | 块判定写入/查询（af_block_reviews，REQ-042） |
  | POST /api/v1/parse-jobs | 提交解析任务（book_id、pages、strategy） |
  | GET /api/v1/parse-jobs/{id} | 任务状态与进度（queued/running/completed/failed） |

### 联调现状与契约偏差适配（REQ-034，2026-08-16 冒烟通过）

8902 真实数据冒烟：01-rudin-trial 20 页 md + 页图 5.2MB 经 8900 代理加载成功。三点契约
偏差已适配（V2-007 契约冻结后按回执切换上游字段）：

1. image_url 为 8902 相对路径 → 8900 新增图片代理端点（浏览器只连 8900）；
2. BookMeta 无进度字段（实际 page_count/author/strategy）→ 前端由 manifest 推导页进度；
3. parse-jobs strategy 枚举 local/hybrid。

### 待定项（晋升 material）

- 解析管理信息架构定型（左树口径、对照单交互细节是否扩展）；
- af_* 表契约随 V2-013 回执转正（现为冻结草案）；
- 解析效果验收口径（ARCH-020 第三轮主线：local/api 双模式联调，至少一个教程解析至用户确认）。

## 验证与验收

- 契约测试：tests/test_api.py（axiom 适配用例 + sync/review 5 用例）保持全绿。
- 事实对拍：本文档端点表与 axiom_client.py docstring、api/axiom.py 路由一致。
- 每轮 REQ-034/REQ-042 状态变化（V2-007/V2-013 回执）后同步更新「待定项」与联调现状。

## 回滚

纯现状记录文档，不承载行为：删除本文件不影响代码与测试；design/ 解析管理位保持置空。

## 关闭与归档

关闭条件：解析管理设计确定并晋升 `design/` 固定文档（按 ADR 0011 晋升流程：状态标
Accepted、补 DesignRef、code-map 同步）。届时本现状壳按归档判定退役，正文迁移目标为
新设计文档「现状基座」节；plans/ 移除本文件并更新 plans/index.md（如涉及）。
