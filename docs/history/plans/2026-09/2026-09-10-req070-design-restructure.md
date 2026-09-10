# design/ 文档体系固定化重构计划（REQ-070）

状态：Completed
关闭结果：Achieved（2026-09-10 关闭：成功标准 1-6 全达成，契约 52 passed + 全量 401 passed + ruff clean）
最后更新：2026-09-10
任务类型：A
关联 ADR：`../../../adr/0012-ai-development-conduct.md`（变更分级：design/ 大变更须 todo + plans）
关联设计：`../../../design/index.md`（重组对象）、`../../../standards/doc-governance.md`（三态梳理与
DesignRef 同步规则，L38/L219/L228）
关联 Tracker：docs/trackers/todo.md（REQ-070，已移入 completed.md；REQ-070-PARS / REQ-070-LEARN
现状文档行留存 todo）
归档判定：Retain（文档体系固定化为治理里程碑证据）——已归档至本目录（history/plans/2026-09/）

## 目标与成功标准

design/ 现存 20 份文档系敏捷开发期自然生长：职责重叠、新旧裁决并存、部分事实已被
architecture/ 承接。本轮按用户确定的六类结构**固定 design/ 文档集合与职责**（全部语义化
命名），使后续 plans/ 计划有明确的晋升/合并/修补去向。

**成功标准**：
1. design/ 固定为 12 份语义名文档 + index.md，分五组（项目配置 / 模型管理 / 项目协同 /
   后台管理 / 探索），每份职责边界明确、无新旧裁决并存。
2. 解析管理、学习功能两类在 design/ 置空，现状由 plans/ 两份现状文档承载
   （parsing-management-current-state、learning-center-current-state），确定后按 ADR 0011 晋升。
3. 6 份过时文档删除（web-frontend、frontend-react-refactor、backend-domain-split、
   integration-matrix、course-acquisition-flow、downloads-three-table-model），独有事实先行迁入
   承接文档（视觉规范→frontend-architecture.md，联调节奏→cross-project-contracts.md，
   五阶段规则→downloads-flow.md）。
4. code-map「设计文档」列与全部源码头部 DesignRef 指向新路径；活跃区旧名/删除名引用清零。
5. admin-console.md 补齐 LlmCalls 页设计（原实现无设计缺位）；downloads-ui/downloads-flow
   口径统一。
6. tests/contract 全绿（含 test_design_documents.py 清单同步）、全量 pytest 与 ruff 不回归。

## 范围与非目标

**范围**：docs/design/ 全部 20 份（改 10 名、改造 6、删 6、移 1、保留 2）、docs/design/index.md
重写、docs/architecture/（frontend-architecture 视觉规范迁入、api-contracts 三表注记、
four-service-architecture/database-design 引用更新）、tests/contract/test_design_documents.py
清单同步、docs/plans/ 两份现状文档 + 本计划、trackers 镜像同步。

**非目标**：不修改子项目文件（QED-Tracker/Axiom-Flow 活跃文档中的断裂链接收尾列清单交用户
裁决）；不改 backend/web-ui 行为代码（仅源码头 DesignRef 行与注释）；不改 guides/standards
正文规则（doc-governance:139 晋升示例文件名泛化除外）。

## 前置条件

1. 用户已批准目标集合与四项裁决（2026-09-10）：LlmCalls 并入 admin-console；Superseded 文档
   删除靠 git 恢复；integration-matrix 并入后删除；downloads-manage-redesign 改名 downloads-ui；
   全部改名采用语义名（用户明确要求名称更明确更符合定义）。
2. 引用关系图已完成（2026-09-10 探索轮）：7 份文档有 code-map/DesignRef 强引用，删除链中
   web-frontend 的强引用（code-map L70、tests/test_web.py:6、scripts/serve_web.py:13）必须先改指。
3. 契约基线：2026-09-10 REQ-069 收尾时 52 passed 全绿。

## 工作项

1. 登记：todo REQ-070 行、本计划。
2. 内容改造（旧名下）：configuration-and-secrets 收口密钥矛盾 + 移入脚本管理节；
   llm-gateway-and-model-management 收窄调用面；service-contracts 吸收「联调编排约定」节；
   service-control 删旧前端两节；tech-stack 勘误；console 扩展 LlmCalls 区（素材：
   REQ-060 completed 行 + web-ui/src/pages/LlmCalls.tsx 反提）。
3. 下载管理两份重组（旧名下）：downloads-manage-redesign 收口 domain-explore §3 UI +
   统一六态/四态口径；domain-explore 瘦身为全链路并吸收 course-acquisition-flow 五阶段规则
   （对齐 QED-050-D）。
4. architecture/ 迁入：frontend-react-refactor 视觉规范 + web-frontend 独有事实 →
   frontend-architecture.md；api-contracts:513 三表引用注记化。
5. git mv 改名 10 份：configuration-and-secrets→project-configuration、
   llm-gateway-and-model-management→llm-gateway、model-service-management→local-model-management、
   service-contracts→cross-project-contracts、service-control→service-hosting、
   console→admin-console、dashboard→admin-dashboard、domain-explore→downloads-flow、
   exploration→document-chunking-recall、downloads-manage-redesign→downloads-ui。
6. 机械替换：按引用图 A 表批量替换 10 个旧名（code-map、DesignRef 头、design 互引、trackers、
   plans、README、.env.example、scripts/image-model/README、docs/learning/）。
7. 删除链（B 表）：先改指承接文档 → 验证 → 删 6 份。
8. plans/ 侧：learning-center.md 移入改造为现状文档；新建 parsing-management-current-state.md。
9. index.md 重写（五组语义名登记）+ test_design_documents.py:15-35 EXPECTED 清单与链接断言同步。
10. 门禁与收尾：旧名残留 rg 清零 → tests/contract + 全量 pytest + ruff 全绿 → REQ-070 关闭
    归档、plans/index.md 登记、todo 移 completed、跨项目断裂引用报告用户。

## 验证与验收

**关闭实测（2026-09-10）**：契约 52 passed（test_design_documents 12 份新名元数据与 index
链接一致、test_markdown_links 全树链接可解析含 history 42 处归档链接修复、
test_tracker_governance REQ-070/070-PARS/070-LEARN 三行镜像合规）；全量 pytest 401 passed；
ruff clean。活跃区旧名残留清零（剩余命中均为 ADR 文件名、来源注记与历史台账允许项）。

- `conda run -n QED_env python -m pytest tests/contract -q` 全绿：test_design_documents.py
  （12 份新名元数据 + index 链接一致）、test_document_structure.py、test_markdown_links.py、
  test_plan_governance.py / test_tracker_governance.py（REQ-070 镜像合规）。
- 旧名残留清零：`rg "configuration-and-secrets|llm-gateway-and-model-management|
  model-service-management|service-contracts|service-control|domain-explore|
  downloads-manage-redesign|integration-matrix|course-acquisition-flow|web-frontend|
  backend-domain-split|three-table-model|frontend-react-refactor" docs backend tests scripts`
  活跃区仅剩 history/ 归档路径与本计划允许命中。
- 全量 `pytest tests -q` 与 `ruff check backend tests` 不回归。
- 人工复核：index 五组与文件一一对应；admin-console LlmCalls 区与实现对拍；下载管理两份
  无内容丢失（对照删除前清单）；12 份新名与职责定义对齐。

## 回滚

全部为文档与测试清单改动，无行为代码：git mv 改名与机械替换可 `git checkout` 整体还原；
删除的 6 份文档按用户裁决靠 git 历史恢复（不建 baselines 目录）；plans/ 新建两份现状文档
可直接删除；architecture/ 迁入内容回退即删除对应节。

## 关闭与归档

关闭条件：成功标准 1-6 全部达成且门禁全绿。关闭结果记 Achieved；本计划按归档判定 Retain
移入 `../history/plans/2026-09/`，todo 移除 REQ-070 行并写入 completed.md，plans/index.md
登记去处；跨项目断裂引用清单（QED-Tracker course-acquisition-flow 3 处活跃、
service-management.md 引用旧名等）写入关闭报告交用户裁决。
