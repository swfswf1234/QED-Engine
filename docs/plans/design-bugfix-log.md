# 设计类小修与 bug 修复台账（design-bugfix-log）

状态：Current（长期滚动台账）
最后更新：2026-10-18
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

### BUGFIX-008：注册表 api 回退链丢弃 `.env` 已配置云模型（W7-4 冒烟发现）

- **发现日期**：2026-09-21（PLAN-046 W7/W10 冒烟轮）
- **设计文档**：`../design/llm-gateway.md`（身份目录表、解析规则第 2 条）
- **问题与根因**：本机 dashscope key 实际开通的云端文字模型为 `deepseek-v4-flash-0731`
  （`.env` `QED_MODEL` 已配置、`/config/models` default 一致），但注册表身份目录只收录
  `qwen-plus`；text 槽位运行态身份为本地身份（无 api 引用）时，api 回退链「身份 → 厂商默认
  qwen-plus」**跳过了 `.env` 配置**，导致 text=api 冒烟实际调用 qwen-plus 返回 HTTP 403
  （key 无该模型权限）。机制全部正常（解析/透传/落日志），缺的是身份条目与回退链一段。
- **修复与验证**：2026-09-21 用户裁决「就是要用 deepseek 模型」。TDD 先行（3 红→实现→绿）：
  `registry.py` 身份表补 `deepseek-v4-flash-0731`（api=qwen@dashscope）；`_resolve_api` 回退链
  改为「身份 api 引用 > `.env` 已注册 api 身份 > 厂商默认」；llm-gateway.md 同步两处。
  冒烟复测：text select api → notes「回退 .env 配置 deepseek-v4-flash-0731」→ `POST /llm/text`
  真实返回（call_id 43）；vision 保持 local 在跑（混合场景成立）。门禁 500 passed + 契约 63 + ruff。
- **状态**：已修复（2026-09-21）

### BUGFIX-009：解析管理左树/顶栏书目名不带卷标识，同名多卷无法区分

- **发现日期**：2026-09-21（实测准备窗口用户反馈）
- **设计文档**：`../design/parsing-ui.md`（§5 书节点展示名、§6 顶栏书名）
- **问题与根因**：`af_books.part` 有卷信息（Vol.1/2/3、上册/下册，b12-16 两组同名）且
  8900 `/parsing/tree` 原样透传（实测），但前端两处消费点（BookTree 节点名、ParseToolbar
  标题）都写 `display_title || title`，而 `display_title` 因上游 qt_books 无此列恒为空串
  → 恒落到裸 title，同名多卷不可区分；api/axiom.ts 注释声明「展示名 = title + part」从未落地。
- **修复与验证**：前端最小改（零后端/契约改动）：BookTree.tsx 新增 `parsingBookLabel`
  （display_title 非空直用，否则 title+part 空格连接，口径同 Downloads bookDisplayName），
  BookTree/ParseToolbar 两点接入；axiom.ts 类型补 `part?: string`；Parsing.test.tsx 新增多卷
  用例（微积分学教程 Vol.1/Vol.2 区分）。vitest 9 passed + tsc 干净 + 浏览器实测见当次记录。
- **状态**：已修复（2026-09-21）

### BUGFIX-010：模型启停同步阻塞击穿前端超时（启停/开书/书页入库三连超时同源根因）

- **发现日期**：2026-09-21（实测准备窗口用户反馈：图像模型启动超时、解析管理开书超时、书页入库「请求超时（8000ms）」但服务端最终成功）
- **设计文档**：`../design/local-model-management.md`（端点契约）、`../architecture/api-contracts.md`（/models/{name}/*、/books/{id}/ingest）、`../design/parsing-ui.md`（接口表）
- **问题与根因**：三处超时同一分层缺陷——① `POST /models/{slot}/start` 契约本意「派发即返回
  starting，收敛由前端轮询 ready 判定」（api-contracts.md 早已如此规定），但实现同步调
  `operate_model`，lmstudio 加载等待循环（`_run_lms` timeout=600 + 轮询 sleep）把 HTTP 请求
  挂起分钟级 → 前端 8s 请求超时 + 15s 收敛窗口双重击穿；② 前端 `POLL_TIMEOUT_MS=15s` 由
  /services 与模型槽位共用，模型加载天然远超；③ 书页入库 8903（默认 8s）＜ 8900→8902
  （httpx 30s）＜ 8902 实际渲染（分钟级）三层错配，前端先报超时、服务端后台其实成功。
  「打开书目超时」为启停阻塞占用后端线程窗口期的连带症状（空载实测 9–75ms，非独立缺陷）。
- **修复与验证**：2026-09-21 用户批准 F1–F4。TDD 先行（Task 5 六用例改异步语义 + 新增
  派发即返回/同槽位 409/后台异常清 in-flight 三用例，7 红 → 实现 → 绿）：control.py
  `_dispatch_model_op` 槽位校验与 in-flight 登记同步完成（未知 404 语义保持），操作本体进
  守护线程，异常仅记日志；同槽位进行中 → 409。前端 runtime.ts 新增 `MODEL_POLL_TIMEOUT_MS`
  =300s 仅用于 operateModel 收敛（/services 保持 15s）；ingest 超时分层 8903=300s
  （axiom.ts `INGEST_TIMEOUT_MS`）/ 8900→8902 单请求 300s（axiom_client，客户端默认 30s 不变）。
  实测（8900 经 /self-restart 加载新码）：`POST /models/text/start` 4ms 返回 starting、
  进行中再发 restart → 409「操作进行中」、~18s 收敛 ready、收敛后 stop 200（in-flight 释放）；
  控制台 UI 图像模型「启动」点击 → 轮询收敛「可用」，网络全 200 全走 8900。书页入库 300s
  窗口未做分钟级实跑（仅分层放宽，判据低风险）。
- **状态**：已修复（2026-09-21）

### BUGFIX-011：老代公式产物定界符击穿 KaTeX 渲染（前端防御剥离）

- **发现日期**：2026-09-22（用户浏览器审核 b05 解析效果时发现公式呈原始文本 `$$ d (p, p ^ {\prime}) \leqslant … $$`）
- **设计文档**：`../design/parsing-ui.md`（§8 BlockList 块级渲染契约）
- **问题与根因**：**解析产物侧的历史缺陷在渲染面的显形**，非渲染引擎问题——MinerU 3.4.4 的
  `equation` 条目 `latex` 自带 `$$…$$` 定界符，Axiom-Flow 归一层（ARCH-018 修复前）原样入库；
  前端把整串含定界符文本直交 KaTeX，`$` 为数学模式非法字符，`throwOnError:false` 下整块回退
  原文显示。数据面归属对方（其 `2e803bf` 已修新解析、b05 生效版 `185a37d55985` 中 09-21 老代
  基线 292 页仍带定界符、随 PLAN-007 W6 全本复测自然自愈）；渲染面根侧做防御剥离止血。
- **修复与验证**：`blocks.ts` 新增 `unwrapMathDelimiters`（剥成对 `$$…$$`/`\[…\]`/`$…$`；
  剥后内部仍含同种定界符保留原文不误剥），`BlockList` formula 分支渲染前剥离、降级回退也用剥离后
  正文。TDD：`blocks.test.ts` 7 用例 + Parsing.test.tsx 块 4（老代形态 fixture）断言
  `.katex` 在位且正文零 `$`（先红后绿）。门禁：tsc 零错 · vitest 200 passed · build exit=0；
  浏览器实测 b05 p50（经 8900 门面确认线上仍是老代带界形态）：71 处 KaTeX、裸 `$$` 零残留、
  目标块渲染为「n⩾N′有d(pₙ,p′)<ε…」，无新增控制台报错（viewport 隐藏未做截图级验证，以
  DOM 结构断言 + 文本抽取代替）。
- **状态**：已修复（2026-09-22；数据侧根治随 Axiom-Flow PLAN-007 全本复测收口）

### BUGFIX-012：downloads 两文档职责交叉且流程抽象块缺图（可读性与边界梳理）

- **发现日期**：2026-09-23（用户发起 design/ 文档重新梳理轮）
- **设计文档**：`../design/downloads-flow.md`（§5、§6、§1 链路总图）、`../design/downloads-ui.md`（全篇）
- **问题与根因**：①职责交叉——downloads-flow §5「异常与降级（前端表现）」描述的是用户
  可见行为，而 downloads-ui 作为 UI 展示层唯一事实源却没有对应章节，两文档定位声明与
  内容边界不一致；②可读性——downloads-flow 仅 3 幅 Mermaid，链路时序、五阶段业务流程两块
  抽象过程纯文字承载，downloads-ui 131 行纯表格无图，不适合人类快速阅读。
  （引用普查：活跃文档对 flow §4.2/§4.4、§2/§2.3 与 ui §2.1/§2.2/§2.3 的交叉引用冻结对应
  编号，可安全重排的仅 flow §5/§6 与 ui §4/§5。）
- **修复与验证**：①flow §5 表格整体移入 downloads-ui 新 §4「异常与降级表现」（后端降级
  规则仍留 flow §4.4，`explore_pending.kind` 值域作为写点契约留在 flow §4.4 后），flow 原
  §6→§5、ui 原 §4/§5→§5/§6，跨文档 §N 引用同步（ui 两处 §6→§5、两文档定位声明互指）；
  ②链路总图重构为前端/8900/数据三分组布局，领域/课程状态机加终态与失败态着色，新增
  探索会话时序图（§4 引入处，不占 4.x 编号）与五阶段业务流程图（§5 段首）——图源均为正文
  Mermaid（遵守 doc-governance「不提交派生 PNG/SVG」），`tmp/` 渲染 PNG 仅供预览不入库
  （2026-09-23 用户裁决）。门禁：`test_design_documents` + `test_markdown_links` +
  `test_document_structure` 10 passed；`tests/contract` 整体 59 passed / 4 failed，
  4 个失败均归因工作区并行任务的未提交改动（`supervisor.py`/`test_llm_supervisor.py`
  未入 code-map 与根测试清单、`2026-09-23-local-model-stability-round.md` 缺章节且与
  todo 标题不一致），零涉及本轮四个文档，见当次会话归因记录。
- **状态**：已修复（2026-09-23）

### BUGFIX-013：project-configuration 统一数据库小节存量库陈述过时且库名误记（ARCH-020-F 执行时同步）

- **发现日期**：2026-09-23（ARCH-020-F 最后验证轮执行时）
- **设计文档**：`../design/project-configuration.md`（统一数据库小节）
- **问题与根因**：条文「存量库（Axiom-Flow `xqfm11`）不迁移、不改名」①与实际环境不符——
  MySQL 实况库名为 `xqfm`（另有 `axiom`），从未存在 `xqfm11`（ADR 0003 原文即误记，历史 ADR
  不改）；②该前瞻陈述随 ARCH-020-F 于 2026-09-23 执行完毕而过时，design/ 应只写设计态。
- **修复与验证**：条文改写为设计态（`qed` 由各项目 Alembic 独立初始化；MySQL 现仅 `qed` 与
  `qed_test`，遗留库收敛清零、记录指针在 trackers）；`architecture/database-design.md` 存量遗留库
  条同步改执行态。验证：`SHOW DATABASES`＝qed/qed_test、8900 `/config/database` configured+reachable、
  根全量 499 passed（当时 5 条契约失败均归 ARCH-028 并行线在飞项）。
- **状态**：已修复（2026-09-23）

### BUGFIX-014：解析本页/全本不防重复点击，重开工作台还可对服务端在飞任务重复建任务

- **发现日期**：2026-09-23（用户人工解析验证期间指出：书页入库有防重，解析按钮没有）
- **设计文档**：`../design/parsing-ui.md`（§4 任务轮询、§6 端点表）、`../architecture/api-contracts.md`（④ 透传组）
- **问题与根因**：①`createParseJob` 无提交在途闸门——`activeJob` 要等 POST 返回才置位，
  连点窗口内每次都发 `POST /parse-jobs`（书页入库有 `ingestBusy` 同型防护，解析按钮漏了）；
  ②更深缺口：`openWorkbench` 无条件 `activeJob: null`（parsing.ts），重开/切书后再点即对
  服务端**已在飞**的任务重复建任务，8902 `create_parse_job` 侧同样无在飞守卫——两个任务并行
  压本地模型即显存爆表风险；且 8900 未代理 8902 的 `GET /parse-jobs` 列表端点，前端无从恢复。
- **修复与验证**：①store 加 `jobSubmitting` 闸门 + 非终态 `activeJob` 拒绝再提交，
  `ParseToolbar` 两按钮 `disabled` 并入该闸门（先红：连点复现双 POST）；②8900 新增
  `GET /parse-jobs` 列表透传（`api/axiom.py`，`status` 用 `Query` 声明重复参数——
  `list[str]` 裸注解会被 FastAPI 当 body 致过滤失效，先红后绿），web-ui `listParseJobs` +
  `client.ts` params 支持数组重复参数；③`openWorkbench` 查该书 queued/running 任务，
  `active` 优先回填 `activeJob` 并续轮询，端点不可用（旧码 404/离线）保守降级为不回填。
  附：并行会话提交 ab85227 遗留 `Dashboard.test.tsx` `NodeJS.Timeout` 类型错（tsc -b 阻塞），
  本会话做了唯一一处类型级单行修正（`ReturnType<typeof setInterval>`），特此归因披露。
  门禁：`tests/test_api.py` 98 passed（含新代理先红后绿）· vitest 211 passed（新增连点防重 +
  重开恢复两用例）· `tsc -b && vite build` exit=0（dist 已重建）。
- **状态**：已修复（2026-09-23；浏览器实测：新 bundle 下列表请求
  `GET /parse-jobs?book_id=…&status=queued&status=running` 在旧服务上按 405 静默降级（无错误横幅、
  按钮态正确）；8900 由用户重启后同请求实测 200，重开恢复全链路生效，正路径另由 vitest 覆盖）

### BUGFIX-015：解析页无显存/模型中断提醒，服务被打挂用户无感知（用户加需，非缺陷起因）

- **发现日期**：2026-09-23（b05 全本解析被显存挤压打断——250/317 后模型容器掉线，
  用户在解析页全程无提醒；同日用户加需弹窗告警）
- **设计文档**：`../design/parsing-ui.md`（§2 组件树、§4 端点表、§9 状态与降级矩阵）
- **问题与根因**：显存水位与模型槽健康仅在仪表盘被动可见；解析作业时用户停留在解析页，
  模型服务被打挂（health_state=down）与显存 ≥95% 均无任何提醒，任务失败后才从错误条得知。
- **修复与验证**：新增无界面组件 `web-ui/src/components/parsing/ResourceWatch.tsx`，挂载于
  Parsing 页面容器：10s 轮询 `/monitor/gpu` + `/models/vision`——显存 ≥95% 弹常驻警告
  （<90% 迟滞撤下复位）、`health_state=down` 按 `last_flip` 每事故弹一次错误弹窗，
  notification key 去重、轮询失败静默。TDD：`ResourceWatch.test.tsx` 5 用例先行（jsdom 不触发
  animationend，destroy 后弹窗永久停在 fade-leave DOM，可见性断言须排除 leave 态——判例记录）。
  门禁：vitest 216 passed · `tsc -b && vite build` exit=0（dist 已重建）· 根 contracts 全量
  见当次会话输出；浏览器实测：8900 重启（用户执行）后列表代理 200、ResourceWatch 10s 心跳
  在飞、模型 21:25 恢复 ready 后无误弹（负路径实盘验证；正路径单测覆盖）。
- **状态**：已修复（2026-09-23）

### BUGFIX-016：解析管理文档族残留过程性记录与过时陈述（确定性梳理轮，随 ARCH-020 节清理）

- **发现日期**：2026-09-23（用户在测试环境完成联调验证后下令完整收尾）
- **设计文档**：`../design/parsing-ui.md`、`../design/parsing-flow.md`、
  `../architecture/api-contracts.md` §④、`../architecture/database-design.md`、
  `../architecture/backend-architecture.md`、`../architecture/code-map.md`、
  `../design/cross-project-contracts.md`、`../design/dataset-conventions.md`、
  `../design/project-configuration.md`
- **问题与根因**：PLAN-047 去过程化裁决后，解析族文档仍残留轮次标签（ARCH-020-B/C/D/F、
  PLAN-044 晋升注记、工单号引用）、时间线叙述（迁移序号链、收口日期串）与过时陈述
  （backend-architecture「ARCH-020 规划」所列已实现项仍写「将扩展」、cross-project-contracts
  parsed 现状列仍写过渡形态、database-design af_* 列清单停在旧版两表 PK 口径）；parsing-ui
  模型离线降级行未区分提交期 503 不建任务与受理后 failed。
- **修复与验证**：全部改写为设计态正文，过程事实由 git log / completed.md / history/plans
  追溯；todo.md「第三轮主线·解析联调轮（ARCH-020）」整节移除（节内遗留观察项——根侧全本实测
  与老代 `$$$` 产物自愈核验——落户 ARCH-028 行），REQ-046/047 证据列去时间线；
  roadmap 第三轮行标已完成；project-status 过时「下一步」指针与收口态标签修正；
  parsing-ui 实现状态 Implemented（design/index 同步）。门禁：根 `pytest tests -q`
  527 passed · 6 failed 全部归因并行 ARCH-028 线在飞项（supervisor 注册/DesignRef/
  滚动壳节/mirror 标题/monitor trust_env），本层文档契约（test_design_documents、
  test_architecture_documents、链接门禁）全绿。
- **状态**：已完成（2026-09-23）

### BUGFIX-017：admin-console §3.3 资源监控「进程列表」表述与三片饼图实现双向漂移，且占用不标模型身份

- **发现日期**：2026-09-24（用户接任务①排查定案）
- **设计文档**：`../design/admin-console.md` §3.3
- **问题与根因**：§3.3 开头仍写「展示…进程列表」并保留逐进程/「其他任务」聚合描述
  （OTHER_AGG_THRESHOLD 语义），而 2026-09-06 REQ-038 重构后实现为三片聚合饼图
  （模型占用/其他/空闲）+ 颜色图例、进程清单不渲染（`GpuOverview.test.tsx` 专门断言
  「无模型进程清单」）；同时用户反馈「模型占用没写是哪个模型」——设计本身也未要求
  标注身份，属需求缺口而非纯实现偏差。
- **修复与验证**：设计正文（**已完成 2026-09-24**，随 REQ-033 收口）：§3.3 更正为三片饼图现状口径 + 新增「当前在跑」
  身份行规格（slots 派生，零新请求；全 api 显示 API 模式）与饼图 tooltip 带身份名；
  容器显存在 Windows PDH 口径不可见的措辞按驻留口径说明。实现与验收随 REQ-033
  承载壳（admin-display-optimization）W1/W4 完成，浏览器实测「当前在跑」行真机可见
  （本地槽未就绪+API 槽就绪 →「（API 模式）」），证据见
  [REQ-033 壳归档](../history/plans/2026-09/2026-09-24-req033-admin-display-optimization.md)。
- **状态**：已修复（2026-09-24 登记，随 REQ-033 收口关闭）

### BUGFIX-018：监督器恢复策略缺「期望状态」维度——人工停止的模型被退避重启复活，api 来源槽位冻结旧「就绪」

- **发现日期**：2026-09-24（用户实报「停止文字+图像模型后仪表盘仍显示就绪」与「控制台 api 切回本地后模型被自动启动」）
- **设计文档**：`../design/local-model-management.md` 健康监督与受控恢复节
- **问题与根因**：恢复决策只看观测态（down/degraded）与在飞门，不看「用户是否期望该槽位在跑」——人工
  stop 后观测一旦翻 down，监督器把用户明确停止的模型按故障退避重启（09-24 日志实录恢复尝试）；api 来源
  槽位「跳过不探测」实现为保留旧快照的冻结态，local→api 切换后仪表盘持续显示过期「就绪·显存·翻转时刻」，
  切回 local 时又凭残留状态参与恢复链路。前端侧缺口：状况卡对「server 存活但模型未加载」形态
  （health_state=ready 且 ready=false，T1 口径与 availability 口径分裂）无就绪性说明（用户裁决：只加说明
  文案，不标降级）。
- **修复与验证**：设计节补**期望状态（desired）**条款与 api 暂停清位语义（running/stopped/未声明；观测
  ready 采纳 running；start/restart 上报 running、stop 上报 stopped；自动恢复限 desired=running、人工停止
  每 Episode 仅告警一次），supervisor 与 model_manager 实现同步。TDD：test_llm_supervisor 新增 6 例（人工
  停止不复活、api 暂停清位、ready 采纳后真崩仍恢复等）＋ test_llm_model_manager 上报挂点 2 例＋
  LocalModelStatus vitest 2 例；定向 97 passed、契约线红三枚（supervisor 注册/DesignRef 遗留）同批修绿。
  登记于 ARCH-028 壳监督器设计 §8 与 W12 行。
- **状态**：已修复（2026-09-24；真机生效需 8900 重启）


### BUGFIX-019：仪表盘/控制台双口径状态契约未落设计文档，仪表盘卡角标未自解释防抖滞后（审核轮）

- **发现日期**：2026-09-24（用户要求审核「仪表盘状态为何与控制台不一致」）
- **设计文档**：`../design/local-model-management.md`（新增「仪表盘与控制台双口径契约」节）
- **问题与根因**：两界面同读 `GET /models/{slot}` 但消费两组不同语义字段（控制台＝实时单发探针
  `availability`，仪表盘＝监督器防抖定态 `health_state`，翻转滞后 3×30s），该契约只在 W1 实现时
  以代码注释说明，设计正文仅声明 health_state 供给状况卡；卡片角标「数据源监督器探针」未交代
  滞后，用户误以为未同源。偏差本身属设计口径（S1/S2），非实现 bug。
- **修复与验证**：设计文档落双口径契约节（字段分工/允许偏差/不混用守则/前端保鲜说明）；仪表盘
  卡角标改写为「监督器防抖定态（滞后 ≤2min）· 实时状态与控制台操作详见 控制台」（TDD：
  LocalModelStatus vitest 新增 1 例先行红后绿，该文件 12 例 + Dashboard 9 例全绿）。
- **状态**：已完成（2026-09-24）


### BUGFIX-020：仪表盘徽章「就绪」被误读为「模型可用」——未加载态二轮裁决改中性徽章「未加载（服务存活）」

- **发现日期**：2026-09-24（用户质疑「本地模型都未启动，文字模型为何显示就绪」）
- **设计文档**：`../design/local-model-management.md`（「仪表盘与控制台双口径契约」节补未加载态呈现守则）
- **问题与根因**：监督器 T1「服务存活」口径与用户直觉「模型可用」口径的语义落差现场演示——LM Studio
  server 常驻应答 5001（无模型加载，实况 netstat/tasklist 实锤），health_state=ready 判定正确，
  但绿色「就绪」徽章＋次要小字（BUGFIX-018 一裁形态）自解释力度不足仍被误读为误报。徽章措辞问题，
  非探针错误、非双口径契约缺口（契约本身已落）。
- **修复与验证**：用户二轮裁决——`health_state=ready` 且 `ready=false` 时徽章改中性色
  「未加载（服务存活）」，服务与模型双就绪才显绿色「就绪」，仍不标降级；后端与 health_state 语义
  零改动（纯前端显示派生）。TDD：LocalModelStatus vitest 2 例改先行红后绿（该文件 12 例 +
  Dashboard 9 例全绿、build 重建）；浏览器实测 reload 后文字卡真实渲染「未加载（服务存活）」、
  控制台无报错。
- **状态**：已完成（2026-09-24）


### BUGFIX-021：状况卡「当前在跑」筛选误含 server 常驻未加载槽位——三轮裁决改口径 ready∪degraded

- **发现日期**：2026-09-24（用户质疑「当前在跑：图像·mineru，为何状况卡还并列挂着未加载的文字卡」）
- **设计文档**：壳「界面设计」显隐规则表（状况卡呈现规则事实源；admin-dashboard.md 明示本档不复制组件内部结构）
- **问题与根因**：`pickOccupied` 用 `health_state∈{ready,degraded}`（T1 服务存活口径）筛在跑，
  而 LM Studio server 为进程常驻——即使模型未加载 health_state 恒 ready，被误判「在跑」与真在跑的
  图像槽位并列呈现；蓝图「单活互斥保证正常 ≤1 个在跑」的前提被 server 常驻形态证伪。同仪表盘/控制台
  侧「当前在跑」身份行（ready 口径，`deriveRunningModels`）口径也不一致。
- **修复与验证**：三轮裁决——在跑筛选口径改 `ready=true ∪ health_state=degraded`，都没在跑时回退
  「最近翻转 > 默认文字」不变。TDD：LocalModelStatus vitest 新增实况复现例（text health=ready 未加载
  + vision 真在跑 → 只呈现图像）先行红后绿，该文件 13 例、全量 236 例全绿、build 重建；浏览器实测
  reload 后状况卡仅「图像模型 · 就绪 · Docker · 翻转于 12:35:52」一行，文字卡不再误挂。
- **状态**：已完成（2026-09-24）


### BUGFIX-022：解析页资源告警重进页即「重播」旧模型中断事故——无任务无新事故也弹窗（方向 A 用户裁决）

- **发现日期**：2026-09-26（用户报「没有点击、不需要 mineru，却弹窗『mineru docker 容器未启动（发生 11:17:05）』」）
- **设计文档**：`../design/parsing-ui.md`（§12「模型服务中断」行与「资源告警」段、§4 组件表行）
- **问题与根因**：BUGFIX-015 的「每事故只弹一次」去重键为组件内 ref，解析页路由重进/刷新即重挂载
  重播旧事故；且发界不区分「新发中断」与「槽位常驻 down」——vision 槽常驻 local 而容器未起时
  `health_state` 恒 down，空闲打开解析页必弹一次，背离该告警「进行中的任务会逐页失败」的保护语义
  （8900 `/models/vision` 实况与 `monitor.py` 探针判定均正确，属前端发界缺陷）。
- **修复（方向 A 裁决：发界=新事故∨任务在飞，事故记忆升会话级）**：
  ① 去重记忆改模块级 + sessionStorage（键=`槽位+last_flip`，同标签页内跨挂载存活）；
  ② 发界：`last_flip` 不早于本次挂载时刻（新近事故）**或**有进行中解析任务
  （`activeJob ∈ queued/running`，含刷新恢复在飞）才弹；③ 两者皆否不弹且**不记为已弹**——用户
  发起任务时保留首发提醒；常驻 not-running 仅由仪表盘/控制台中性徽章表达（承 BUGFIX-020/021 口径）；
  ④ 显存路行为不变。
- **修复与验证**：TDD 红先例三用例（存量 down 无任务→不弹／同 last_flip remount→不重播／任务转
  在飞→首发）先行红后绿；`ResourceWatch.tsx` 落地发界 `新近事故（flip ≥ 挂载时刻）∨ activeJob ∈
  queued/running`，事故记忆 sessionStorage 键 `qed.parsing.model-down-notified`（`槽位+last_flip`，
  留最近 20 条）+ 组件内 poppedFlip 双保险（隐私模式退化），恢复撤下逻辑不变，文件头注释同步。
  门禁：vitest 全量 **327 passed**（本文件 8 例）+ `tsc -b` 零错 + build 重建；**浏览器实盘**：reload
  解析页驻留 ≥30s（vision 槽真实存量 down + 无任务）零弹窗、记忆键仍为 null（未误消耗首发权）、
  两路轮询均指 8900（gpu 200/vision 探针在途）、控制台零报错；正路径（新事故/任务在飞首发）由
  vitest 覆盖，实盘不复演（避免真实建失败任务）。
- **状态**：已修复（2026-09-26）


### BUGFIX-023：控制台「启动」确认框正文回落「重启」文案——三元链缺 `start` 分支

- **发现日期**：2026-09-29（用户报「启动 QED-Tracker / Axiom-Flow 时出现重启提示，但确认过服务并未
  启动」；先按端口探测取证排除「真有进程在跑」与探测误报两条假设后，定位到确认框正文文案分支）
- **设计文档**：`../design/admin-console.md`（§3.1 新增「破坏性操作确认框」段，把四支文案互不复用
  写成契约）
- **问题与根因**：`web-ui/src/pages/Console.tsx` 受控确认框正文三元链只对 `op === 'stop'` 与
  `name === 'config'` 特判，`op === 'start'` 落入末支兜底文案「重启会中断当前运行中的任务。」——
  标题「确认启动…？」（取 `OP_LABELS`）与正文语义自相矛盾，且向离线服务描述了一个不存在的中断
  风险，误导用户以为服务已在跑。请求本体仍正确发往 `POST /services/{name}/start`，属纯展示层缺陷。
- **修复与验证**：正文补 `start` 专属分支「启动该服务，将拉起对应端口进程，就绪后状态自动转为
  在线。」；回归用例两枚（启动分支必须给启动语义且不得出现重启文案 / 重启分支保持原案）先红后绿。
  门禁：vitest 全量 356 passed + `tsc -b` 零错 + build 重建；浏览器实测（8903 dist）以 mock
  `/services` 将 tracker 置离线后点「启动」，弹窗正文实读为启动语义文案、无「重启」措辞。
- **状态**：已修复（2026-09-29，随普通任务轮 ARCH-035 W1 收口）

### BUGFIX-024：领域表单默认值与字段消费口径失真——预填套话入库即被覆盖、「学科知识」全程无人消费

- **发现日期**：2026-09-30（用户报「添加领域的描述默认文案与学科知识默认值设计不合理」；只读排查四字段
  全链路消费点后确认缺陷面大于文案本身）
- **设计文档**：`../design/downloads-ui.md`（§3.1 新增「领域维护表单（字段口径与默认值）」段 + §2
  跨项目协作指针；消费现状以「未接通面」显式声明）
- **问题与根因**：① `web-ui/src/components/DownloadsTree.tsx:751` 预填「这是一个新的学科领域，等待探索完善。」
  入库后既作为领域卡正文展示（`DomainCard.tsx:171-175`），又被 8901 探索结果无条件覆盖
  （`QED-Tracker/src/qed_tracker/api/main.py:296`），且与 domain 提示词「不使用空泛套话」要求
  （`prompt_lab/templates.py:225`）直接对撞；② 五字段只有 `name` 进提示词（`api/main.py:277` 只传
  `domain.name`，`scope_hint` 取模板内置默认 `pipeline.py:150`），`scope` 全仓无任何提示词消费点、UI 也不
  展示，`stages` 恒被 `STAGES` 常量覆盖（`pipeline.py:181`）——表单「可选」给人的「填了会引导探索」
  预期不成立；③ `level` 在两个维护表单标「探索范围」（`DownloadsTree.tsx:763`）、`scope` 在确认弹窗
  也标「探索范围（scope）」（`DomainConfirmModal.tsx:258`），与 DDL 注释（level=探索范围/scope=学科知识）
  和提示词（level=默认学习层级）四套口径互斥；④ 描述必填口径分裂：添加表单标「可选」、确认弹窗
  `required`（`DomainConfirmModal.tsx:252`）；⑤ 存量缺陷：`explore_courses_only` 的
  `domain_info.get("level", _DEFAULT_SCOPE)` 键存在即不兜底，`level` 空串时把空范围提示送进课程梳理
  （`pipeline.py:212`）。
- **修复与验证**：根侧（2026-09-30「开始执行」后已实施）——措辞正本集中到
  `web-ui/src/components/domainFormDefaults.ts`（`DOMAIN_LABELS` 五标签 + 两条默认句 + `level`/`stages`
  默认值），三处表单按 `downloads-ui.md` §3.1 统一顺序（领域名→领域描述→学科知识→探索范围→学习阶段）
  与标签：`DownloadsTree.tsx`（添加领域 + 右键编辑领域知识）、`DomainConfirmModal.tsx`（领域信息确认，
  提交体补 `level`）；`description` 默认句随领域名插值且**用户手改后不再被覆盖**（`addDescTouchedRef`）、
  三处统一非必填，`DomainCard.tsx` 空描述显示「（暂无描述，可点『探索领域知识』生成）」；`scope` 默认句
  写明「中文表述 + 参照美国主流高校本科—硕士通行方案」的边界，`level` 默认 `本科-硕士`、`stages` 默认
  四档；2026-08-24「领域表单去阶段」裁决按本轮讨论**改判**（阶段字段保留、默认值即四档常量），回归用例
  `DownloadsTree.explore.test.tsx` 的旧标签断言随之改为本口径断言；新增用例
  `DownloadsTree.domainForm.test.tsx`（5）与 `DomainCard.test.tsx`（2）、`DomainConfirmModal.test.tsx`
  追加 3 条口径用例；帮助文案 `help/sections.ts` 领域探索节同步（含「当前仅领域名进探索」的如实说明）。
  验证：`npx vitest run` 全量 42 files / 417 passed、`tsc -b` 零错、`npm run build` 成功；8903 浏览器实测
  （添加领域弹窗五字段顺序与默认值逐项核对、领域名「复分析」插值成功、手改描述后改名不被覆盖、
  右键编辑领域知识弹窗回填与占位一致、请求全部指向 8900、重新加载后控制台仅剩 REQ-102 未实装端点
  `GET /papers/books` 的 404，归因对方在途 WIP）。对方侧未变——四字段真读取、
  「用户写过的 description 不被覆盖」与空串兜底三项登记为 QED-Tracker 滚动缺陷台账 BUG-004，代码归其会话。
- **状态**：根侧已修复（前端 + 设计正文 + 帮助文案）；跨项目侧待对方承接回执，接通前表单默认值只决定
  入库初值与展示，不影响探索输出（`downloads-ui.md` §3.1「消费现状（未接通面）」）

### BUGFIX-025：local-model-management.md 控制台需求节残留「三卡（含向量）」旧口径——ARCH-039 收口时漏随步

- **发现日期**：2026-10-03（ARCH-040 设计落笔时逐节核对 `admin-console.md` §3.3 与本文的槽位卡口径，
  发现两文档互斥）
- **设计文档**：`../design/local-model-management.md`（「控制台需求（UI 细节归 admin-console.md）」节）
- **问题与根因**：ARCH-039（2026-10-03 收口）裁定控制台资源监控区不再渲染向量槽位卡，随步只改了
  `admin-console.md` §3.3 槽位卡表与 §7 文件映射行、`help/sections.ts` 控制台节，漏改本文的
  「三卡（文字/图像/向量）五字段」与「向量卡无本地候选（来源固定 api，仅验证）」两行，
  按本文读会以为控制台仍有三卡。
- **修复与验证**：两处按 ARCH-039 口径改写（渲染文字/图像两卡；向量卡不出版面、验证入口留 store 动作层），
  并在同节补 ARCH-040 受限启动口径与「单活仲裁」节的指针；纯文档修正，无代码与测试改动。
- **状态**：已修复（2026-10-03，随普通任务轮 ARCH-040 设计落档）

### BUGFIX-026：学习书架把书目（8902 透传）与课程／星图同批取数——解析侧离线时整面报「书架数据不可达」

- **发现日期**：2026-10-09（ARCH-027-M1 学习面真机走查时 8902 尚未起，书架零卡片）
- **设计文档**：`../architecture/frontend-architecture.md`（学习中心书架面）、
  `../design/parsing-flow.md`（8900 透传 8902 的书目面）；根纲「独立性铁律」
- **问题与根因**：`LearnShelf.tsx` 的 `reload()` 把 `listLearnCourses()` / `getStarMap()` /
  `listBooks()` 放进同一个 `Promise.all` 并在同一 `catch` 里 `setError`。书目是 8900→8902
  的透传面，8902 离线时 8900 返 503，于是**只该影响「选素材」下拉**的失败被升级成整面错误、
  课程卡一张不出，违根纲「Axiom-Flow 未启动时前端展示必须正常」。
- **修复与验证**：书目改独立 `try/catch`（新增 `bookError` 态）——课程与星图照常列出，
  注册弹窗素材下拉降级为「书目服务不可达（解析侧离线），暂不能选素材」；回归用例
  `web-ui/src/pages/LearnShelf.test.tsx`（该档 8 passed）断言 8902 返 503 时课程卡与
  进度徽章仍渲染且无整面错误；8903 真机复验（8902 启动窗口期整面报错→新包两门课正常列出）。
- **状态**：已修复（2026-10-09，随 ARCH-027-M1 学习面交付轮）


### BUGFIX-027：论文链路缺「采纳不自动取书、`verified` 属人工验收档」口径——设计只写「复用书本五层态链」

- **发现日期**：2026-10-09（REQ-102 W5 真机端到端取证：显式 `books fetch` 后自动链只到 `downloaded`，
  `verified` 由 8903 书目详情「验证通过」按钮置位）
- **设计文档**：`../design/downloads-flow.md` §7.1（论文链路分段与责任分界）
- **问题与根因**：§7.1「书本化」行只写「下载/验收复用 §6 书本五层态链」，两件事未写入口径＝
  ① adopt 之后**不自动取书**（2026-09-30 用户裁决 #5 只落在对方壳与 UI 侧）；
  ② 五层态里 `verified` 属**人工验收档**、自动化只到 `downloaded`。后果＝论文展示行的「已验收」档
  在设计上无归属来源，端到端联调时容易被读成「链路没跑完」，也会诱导实现侧自作聪明地补自动验收。
- **修复与验证**：§7.1 补一条 bullet（显式 `POST /books/{book_id}/fetch`；自动链止于 `downloaded`＝行内
  「待验证」；`verified`＝「已验收」只由人工验收置位，展示行/透传面/弹窗均不代做验收）。验证＝真机
  `mathadvanced-b19` 由「待验证」经书目详情按钮转 `verified`、行徽同步为「已完成」；根侧全量 pytest
  735 passed、文档契约守护无新增红。
- **状态**：已修复（2026-10-09，随 REQ-102 收口）

### BUGFIX-028：归档壳元数据里的反引号内联相对路径不随 mv 改深度，链接门禁查不到（全仓存量）

- **发现日期**：2026-10-15（REQ-104／110／113／114 收口批复audit：四壳 mv 进 `docs/history/plans/2026-10/`
  后自写审计脚本全仓扫反引号内联路径，命中 51 处不可解析；修完本轮链上 1 处后为 50 处，同日并行窗口
  迁 `docs/design/frontend/` 又新增同类，复跑为 64 处）
- **设计文档**：涉及 `docs/history/plans/2026-08/`（4 件）、`docs/history/plans/2026-09/`（7 件）、
  `docs/history/plans/2026-10/`（多件）各壳元数据行「关联 ADR／关联设计／关联架构」，以及已确认标准
  `docs/standards/code-document-traceability.md`:9（仍指 `docs/plans/2026-08-30-traceability-refactor.md`，
  实际该壳已在 `docs/history/plans/2026-08/`）
- **问题与根因**：历次壳归档 mv 只重写 **Markdown 链接**（`]` 加括号形式），未重写**反引号内联代码路径**
  （以 `../` 开头指向 docs/ 上层的那两层相对写法），文件下沉两级后这些路径整体少两级；守护
  `tests/contract/test_markdown_links.py` 只解析链接语法，对内联路径是盲区，故门禁全绿也带着死指针。
  根因是「归档即重写引用」的动作定义只覆盖了一半，不是某次手误。
- **修复与验证**：本轮只修知识点探索链上 1 处（`docs/history/plans/2026-10/2026-10-14-learn-ui-course-star-graph.md`:8
  的设计稿 A 指针改同目录直引），验证＝审计脚本该文件命中 0、契约 82 passed。余量批量修法（待另立轮次）＝
  遍历 `docs/**/*.md`，取反引号包裹且以 `../` 开头的 md 路径，逐条按 `os.path.normpath` 断言存在，
  不存在则按该文件当前所在目录重算深度后原地替换；复跑审计至 0 后，再评估把该断言并入
  `test_markdown_links.py`（属守护变更，按 AGENTS「standards/ 实质规则变更先立 ADR」路径评估）。
- **状态**：待修复（本轮链上 1 处已修，其余存量待批量轮）

### BUGFIX-029：手册改四页册后两处设计正文成死口径——「五阶段说明入手册」与「知识点探索节为第二节」

- **发现日期**：2026-10-15（REQ-031 改判裁决轮：用户裁决手册只写学习中心四页，后台六节与「常见问题」删除）
- **设计文档**：`docs/design/frontend/downloads-ui.md` §7 末条、`docs/design/frontend/knowledge-point-exploration-ui.md` 页头表「页头右」行与「图例与读图口径归使用手册」条
- **问题与根因**：两处正文都写死了旧手册形态——downloads-ui.md 要求「使用手册需包含课程收集五阶段说明」，exploration-ui.md 声明「手册弹窗（知识点探索节为第二节）」并按旧节文本罗列读图口径（含大知识点／小知识点字样）。手册形态在 `web-ui/src/help/sections.ts` 单点变更，两份 `design/` 文档无联动守护，实现一改文档即成死指针。
- **修复与验证**：downloads-ui.md 该条改「后台管理面不出使用手册（裁决），五阶段业务流程事实源仍在 downloads-flow.md §6」；exploration-ui.md 页头右行改「四页册，本页直落知识点探索册」、读图口径条改章节／知识点术语并注明裁决来源。验证＝web-ui vitest 63 files / 762 passed（串行）+ `tsc -b` 零错 + `npm run build` 成功 + 契约与全量 pytest 见本轮收口输出；8903 真机四页与工作台各直落本面册、控制台零报错、请求全指 8900。
- **守护补位（2026-10-16 二批改判轮）**：根因「手册形态单点变更、文档无联动守护」已补——节名收归 `web-ui/src/help/sections.ts` 的 `HELP_BLOCK_TITLES` 常量（弹层不再自带措辞），`web-ui/src/help/helpPages.test.ts` 断言四册节序恒为 功能概览／使用说明／状态与限制、usage 节只出步骤、正文禁现服务与运维词；形态再变更时实现与文档口径不同批即红。
- **状态**：已修复（2026-10-16，守护同批落地）


### BUGFIX-030：REQ-105 收口后总设计 §5 课程学习指针指向已归档壳，且「按已编排链路推进」措辞与 R7 冲突

- **发现日期**：2026-10-16（REQ-105 收口批：用户 2026-10-15 裁决 v1 设计本体留改不晋升，壳随收口 Retain 归档）
- **设计文档**：`docs/design/frontend/frontend-overview.md` §5 模块一览「课程学习」行（详设指针列＋边界列）
- **问题与根因**：指针列写死 `plans/2026-10-11-learn-ui-course-study.md`，该壳收口后移入 `history/plans/2026-10/`，
  指针成死链；同格边界列写「按已编排链路推进章节单元；**与课后练习联动**」，与 REQ-105 R7「链路退为后台准备、
  界面不出现『链路』字样」和 REQ-106 已落地裁决「面间零跳转、入口唯一＝首页卡」相互冲突（属口径冲突，非措辞笔误）。
- **修复与验证**：本条只改**指针**（壳移出 `plans/` 后全部入站链接随动改道，共四处）——总设计 §5 课程学习详设指针改指
  [REQ-117 重设计轮壳](../history/plans/2026-10/2026-10-15-learn-course-study-redesign.md) 并加 v1 归档落点；[frontend-architecture.md](../architecture/frontend-architecture.md) 信息架构行、[learning-practice-ui.md](../design/frontend/learning-practice-ui.md) 归属表行、REQ-117 壳「关联设计」行的指向由 `plans/2026-10-11-*` 改指 `history/plans/2026-10/2026-10-11-*`；`test_markdown_links` 死链扫描通过。
  **边界列措辞冲突不改**：改他轮设计正文属范围改判，已由用户 2026-10-15 裁决归 REQ-117 W2「三方边界对表与逐条裁决」
  承接（REQ-104 稿／REQ-106 稿／REQ-116 稿／总设计 §5 四组冲突一次对表）。
- **另发现（不改，移交 REQ-117 W7 ④）**：`frontend-architecture.md` 的 `#/learn/c/:courseId` 行仍描述「阅读／链路双模式（Segmented 受控切换）」与 `POST …/compile/propose`＋`compile/start` 链路通路，与工作树实态（单屏、自动目录 `PUT …/outline`＋`PATCH …/units/{id}`）不符；属架构文档描述陈旧，回写时机归 REQ-117 W6 晋升批。
- **状态**：已修复（四处指针全部改道，门禁绿；边界措辞与架构行描述陈旧分别待 REQ-117 W2、W7 ④）

### BUGFIX-031：跨项目契约「三个项目 → MySQL」现状列仍写「均用 `qed` 库」——本机三服务实已同钉 `qed_test`

- **发现日期**：2026-10-17（并库与 `qed` 库 ALTER 窗口收尾时核文档）
- **设计文档**：`docs/design/cross-project-contracts.md` §3 表「三个项目 → MySQL」行现状列
- **问题与根因**：现状列写「QED-Tracker 与 Axiom-Flow 均用 `qed` 库」，自 2026-09-11 双 `.env`
  分库起即失真（8900 一直连 `qed_test`），2026-10-17 并库后三服务统一钉 `qed_test`
  （根 `.env:30`、`QED-Tracker/.env:19`、`Axiom-Flow/.env:12`）。该失真会把「写入落 `qed`」
  的预期传给并行会话，而两库分裂正是本轮 8903 两页空数据的根因面。
- **修复与验证**：只改现状列为同库事实并指回承载壳证据；`冻结` 列（统一 MySQL 8 `qed` 库、
  `QED_DB_*` 唯一事实源、测试库隔离真实数据）不动——契约未变，变的是本机联调落点。
  `tests/contract/test_markdown_links.py` + `test_plan_governance.py` 8 passed。
  **2026-10-17 收尾随步扩两处同因失真**：[project-configuration.md](../design/project-configuration.md) 变量表现状段补「本机联调落点」一条（三库同钉 `qed_test` + 托管不注入 `QED_DB_*` 的缺口指向 DEFECT-015）；[database-design.md](../architecture/database-design.md) 共享表行与「REQ-118 定档结论」两处的「库内落地待放行／生产 `qed` 随发布批次」改为两库已落地零差。
- **状态**：已修复（2026-10-17）

### BUGFIX-032：parsing-flow §9「8902 离线 → 数据域端点返回 503」对 `GET /parsing/tree` 不成立，且掩盖两种同形空态

- **发现日期**：2026-10-17（并库取证：排查 8903 文档解析管理页空数据时逐行核降级口径）
- **设计文档**：`docs/design/parsing-flow.md` §9 状态与降级矩阵
- **问题与根因**：矩阵只写「8902 离线 → 8900 数据域端点返回 503，前端降级显示」一行，但
  `GET /parsing/tree` 捕获上游错误后把书目置空、领域→课程照常聚合并返 **200**；另一侧共享表为空即返
  `[]`，与「共享表为空 ∧ 8902 离线」同形。该行因此掩盖两点：树端点的响应不能证明 8902 在位，前端也
  无法区分「数据未登记」与「服务离线」。本轮空数据归因正是先被该行带偏，最后靠读码 + 真机读数才定位到
  库名分叉（证据见 `docs/plans/2026-10-15-shared-tables-field-freeze.md` 过程与证据 2026-10-17 段）。
- **修复与验证**：只改文档——§9 该行补「唯一例外」子句，并新增「`GET /parsing/tree` 空态」一行，
  同形空态的可区分性改进指向台账 DEFECT-015 S3；`tests/contract/test_markdown_links.py` 与
  `test_plan_governance.py` 定向绿（全量门禁输出见本轮收尾汇报）。
- **状态**：已修复（2026-10-17 文档面；同轮 DEFECT-015 S3 已把可区分性落到响应与界面——`GET /parsing/tree` 改信封 `{nodes, sources}`，8903 左树按 `sources` 分话术，本条掩盖的同形空态自此消解）

### BUGFIX-033：project-configuration.md「Axiom-Flow `AXIOM_MYSQL_*` 存量别名」在活源码零命中

- **发现日期**：2026-10-17（DEFECT-015 S1 取证：判定「注入 `QED_DB_*` 能否钉住子服务库名」需实读对方解析链）
- **设计文档**：`docs/design/project-configuration.md` §四 元数据库配置 的「映射」条
- **问题与根因**：该条写「映射：Axiom-Flow `AXIOM_MYSQL_*`（存量别名，默认库名随之改为 `qed`，改造后别名退役）」，
  实读 `Axiom-Flow/src/axiom_flow/config.py:128-132,167-169,202` 与 `Axiom-Flow/.env.example`，`AXIOM_MYSQL`
  在其**活源码与模板零命中**，只余 `Axiom-Flow/docs/history/v1-20260814/**` 冻结叙述与一枚过期 `.pyc`；
  QED-Tracker 同样直读 `QED_DB_*`（`src/qed_tracker/config.py:85-89,117-140`）。该失真把子服务配置链写成
  「经别名映射」，会让人误判注入 `QED_DB_*` 未必生效（正是 S1 的判据前提）。
- **修复与验证**：映射条改为「子项目直接读取本组 `QED_DB_*`，无 `AXIOM_MYSQL_*` 别名」并注明实核范围；
  与同文件「环境变量优先级」强制规则一致。验证＝`tests/test_api.py::test_start_via_script_injects_root_db_env[tracker|axiom]`
  （注入即钉库名的行为守护）+ `tests/contract/test_markdown_links.py`。
- **状态**：已修复（2026-10-17）

### BUGFIX-034：admin-console.md §3 三区结构行仍写「文字/图像/向量三槽位卡」，与同文 §3.3「向量不出卡」自相矛盾

- **发现日期**：2026-10-17（普通任务轮 ARCH-035 清理第③组：核 ARCH-039 S4「§3.3 槽位卡表随步」达成情况时实读全文）
- **设计文档**：`docs/design/frontend/admin-console.md` §3 三区结构 首行
- **问题与根因**：ARCH-039 落地时 §3.3 已写明「向量槽位（`embedding`）不出卡：界面只渲染文字/图像两卡」，
  但 §3 的三区顺序行仍保留迁移前叙述「资源监控（GPU 状态 + 文字/图像/向量三槽位卡）」，同一文档两处对
  控制台版面给出相反结论；按[文档治理规范](../standards/doc-governance.md)事实源唯一铁律，第二处正文即漂移。
  根因＝该轮改动只覆盖了槽位卡表，未同清扫 §3 概览行（判据锚点单一节名的后果）。
- **修复与验证**：§3 顺序行改为「资源监控（GPU 状态 + 文字/图像两槽位卡；向量槽位不出卡，口径见 §3.3）」，
  与 §3.3 单一口径一致；版面事实由 `web-ui/src/pages/Console.test.tsx`「向量卡不出」用例守护，
  链接与结构由 `tests/contract/test_markdown_links.py` 守护。
- **状态**：已修复（2026-10-17）
### BUGFIX-035：tech-stack.md 选型记录仍写「原生前端无构建／框架化评估延后」，与同文总览行「React 19 + Vite 已用」自相矛盾

- **发现日期**：2026-10-18（REQ-070-LEARN 收口批「遗留①」点名该两行；本轮按用户令把确定性内容写进稳定文档时实读全文复核）
- **设计文档**：`docs/design/tech-stack.md` 选型记录「原生前端无构建」条（与「技术栈总览」表前端行相对）
- **问题与根因**：总览行已写「React 19 + AntD 5 + zustand + Vite｜`web-ui/` 学习中心 + 管理后台（8903），构建产物 dist/ 由 serve_web.py 托管｜已用」，
  选型记录条却仍写「静态 SPA 零构建零依赖……框架化（Vue/React）评估延后到学习中心正式建设时」，同一文档对前端形态给出相反结论；实态由
  `web-ui/package.json`、`scripts/qed_web_service.py` 托管 `web-ui/dist/` 与 ADR 0008 坐实。根因＝该轮只改总览行未清选型记录，与 BUGFIX-034 同形
  （改动覆盖面止于一节，违反[文档治理规范](../standards/doc-governance.md)事实源唯一铁律）。
- **修复与验证**：选型记录条改写为设计态正文（React 19 + AntD 5 + zustand + Vite 构建、`web-ui/dist/` 由 `serve_web.py` 静态托管、页面只连 8900），
  并显式声明早期「零构建／评估延后」结论作废，指针指向 [前端总设计](../design/frontend/frontend-overview.md)；元数据「最后更新」随步。
  验证＝`tests/contract/test_design_documents.py`（design 元数据与清单）＋ `tests/contract/test_markdown_links.py`（新增指针可解析）。
- **状态**：已修复（2026-10-18）

### BUGFIX-036：前端总则缺载跨面页头动作组与 flex 左缘对齐规范，四面共同口径只写在单面详设

- **发现日期**：2026-10-18（REQ-117／DEFECT-016 收口后按用户令把裁决出的规范沉淀进稳定文档）
- **设计文档**：`docs/design/frontend/frontend-overview.md` §2 视觉总则
- **问题与根因**：① 页头三枚（使用手册／刷新／返回，返回末位）经用户 C22→C29 两轮改判后已是四面共同口径，但只落在
  [learning-course-ui.md](../design/frontend/learning-course-ui.md) 的页头表与 [frontend-architecture.md](../architecture/frontend-architecture.md)
  的 `#/learn` 行，跨面规则无正本，其余三面靠抄该表维持一致；② DEFECT-016 的通用根因（antd v5 `Button` 内容容器
  `display:inline-flex; justify-content:center` ⇒ 单写 `textAlign:'left'` 对 flex 主轴无效、左缘随文本长度漂移）与「左缘由常量函数单源给出」
  的防复发判据只写在单面详设 §V2.4，其它面的列表行同样会踩而无条文可依。
- **修复与验证**：§2 增两条总则＝跨面页头动作组（四面同位同顺序、返回末位、刷新不触发生产；面内出口留详设以免双写）与
  对齐实现规范（形态常量化 ＋ 对齐断言落 `justify-content` ＋ 版式类改动按 `qed-frontend-check` 三档 `innerWidth` 实测记左缘读数）。
  守护不动代码：`web-ui/src/pages/LearnWorkbench.test.tsx`（`justify-content: flex-start` 与同档左缘相等）、
  `web-ui/src/pages/learnPlaneCopy.test.tsx`（目录处理进度话术禁现）、`tests/test_web.py`（设计档互指）。
- **状态**：已修复（2026-10-18）

### BUGFIX-037：跨项目契约 §4 在途请求登记仍把 `af_*` 面四枚请求与 REQ-128 各自记为在册，与 2026-10-21 合并／取消裁决不符

- **发现日期**：2026-10-21（REQ-136 合并落地轮的文档面清扫中实读 §4 发现）
- **设计文档**：`docs/design/cross-project-contracts.md` §4 在途跨项目请求登记
- **问题与根因**：§4 仍逐条在册 `REQ-123`／`REQ-129`／`REQ-133`／`REQ-135` 四枚出站请求（其中 `REQ-133` 标「待用户评审放行移交」、
  `REQ-135` 标「待用户放行代登」）与 `REQ-128`（作业表保留期出站请求），而用户 2026-10-21 裁决已把前四枚合并为单枚综合请求
  `REQ-136`（挂 ARCH-025 轮线 2，一次谈定 `af_*` 专用表族重构）并**取消** `REQ-128`。根因＝该轮口径随步落在台账（todo／completed／
  `plans/index.md`）、两枚滚动壳与总纲 §7.9，出站请求登记这处 `design/` 正本未随步，与 BUGFIX-034／035 同形（改动止于一节，
  违反[文档治理规范](../standards/doc-governance.md)事实源唯一铁律）。
- **修复与验证**：§4 四枚合并为 `REQ-136` 单条，写清 R1~R5 与原逐条映射、承载壳与逐列形状正本（`REQ-134` 设计稿）指针、三枚原请求稿壳
  `Superseded` 归档去处（`REQ-129` 无独立壳，原承载普通任务轮壳 W5）、对方两枚入站承接行（其 `todo.md:33`／`:44`）待发函窗改指口径；
  `REQ-128` 改写为取消并写明**需求失效依据**两条＝根侧总纲 §7.9 裁剪边界与「四类行不可裁剪」已成文（出站发函无新增约束）、
  代码查证推翻原 S2 立论前提（`QED-Tracker/src/qed_tracker/db/selection_repository.py:183-190` 以全表 `payload.downloads` 派生论文
  去重集，按行裁剪即误删去重记忆）；同批的 `REQ-129` 显式声明不随取消、随 `REQ-136` R5 走。
  验证＝`tests/contract/test_markdown_links.py`（新增与改写指针可解析）＋ `tests/contract/test_design_documents.py`（design 元数据与骨架）。
- **同日第二批随步（2026-10-21，同节再改，归本条不另立 BUGFIX）**：本条修复后的 §4 在途登记仍含两处被同日事实超越的口径＝
  ① 「**待发函**、对方台账尚无承接行」——对方已自登 `REQ-136` 承接行（其 `todo.md:33`／`:45` 两枚入站行已改指），故改写为「登记口径复核」；
  ② 「逐列形状正本＝`REQ-134` 设计稿」——对方同日自立 PLAN-024 承载同一形状并定档，正本移交该稿、`REQ-134` 退为指针
  （根侧 `REQ-136` 壳关联设计行／目标段／过程与证据条，与 [项目状态快照](../trackers/project-status.md) 当前主线同批随步）。
  `REQ-136` 行 `成功标准` 列与 R1~R5 状态列一字未改（ADR 0023；改判归该行会话）。
- **状态**：已修复（2026-10-21）