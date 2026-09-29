# 设计类小修与 bug 修复台账（design-bugfix-log）

状态：Current（长期滚动台账）
最后更新：2026-09-29
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
