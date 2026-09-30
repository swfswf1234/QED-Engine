# 本地模型稳定性轮滚动记录（仪表盘状况卡·监督器·掉线根因·批次水位）（local-model-stability-round）

状态：In Progress
任务类型：B
最后更新：2026-09-30
关联 ADR：登记方式沿用 [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳；2026-09-29 按 [ADR 0020](../adr/0020-task-closure-cadence-and-thin-registration.md) 收口节拍执行本壳整改（W6/S3 观察窗移交长期线 REQ-100）
关联设计：[local-model-management.md](../design/local-model-management.md)（槽位/runtime/单活互斥地基）、
[llm-gateway.md](../design/llm-gateway.md)（网关与调用记录分工；W11 请求侧熔断承接位）、
[api-contracts.md](../architecture/api-contracts.md)（W1/W2 端点扩展承接位）、
[frontend-architecture.md](../architecture/frontend-architecture.md)（W4 仪表盘界面）
关联 Tracker：docs/trackers/todo.md（ARCH-028 任务行，一任务一行一壳，支线 ARCH-033 启动参数配置壳 2026-09-24 裁定挂入本轮、不另立轮））
归档判定：Retain（滚动记录，轮次收口时按当时里程碑归档 history/plans/<year-month>/）

> 本壳是本地模型稳定性轮唯一滚动记录。排期范围＝根仓库（8900/8903）+ 根 `.env` 配置；
> 解析批次执行归 Axiom-Flow 既有分窗实现（ADR 0014 模型生命周期/解析调用分工），本轮不向子项目发代码请求。

## 目标与成功标准

**背景**（用户裁决 2026-09-23）：本地模型服务稳定性不足——① 图像模型（MinerU，5002 WSL 容器）
反馈「容易断」但根因未定谳（现有三类假设：WSL 挂起后容器内 GPU 不可见＝已知约束 7；容器被
外部/系统杀死＝09-21 docker events exec_die 循环实录；重负载 vLLM OOM）；② 大数量级解析易
OOM，需按批次控量；③ 现有探针全为按需单发，无持续监测、无自动恢复、无事件账；④ 仪表盘上看
不出本地模型死活（只有四服务徽章）。参照 DeepTutor 本地模型管理（`D:\coding\demo_program\DeepTutor`
只读调研，判例同 REQ-089）先行吸收，再定监督器细节取舍。

**目标**：本地模型「看得见（仪表盘）+ 管得住（监督器：检测→告警→受控恢复）+ 喂不饱不死（批次 ≤50 页/窗 + 显存水位门）+ 等不到快挂（网关请求侧熔断，W11）」；掉线根因取证定谳原为本壳目标之一，2026-09-29 按 ADR 0020 收口节拍整批移入 [REQ-100 长期线](2026-09-29-local-model-debug-optimization-longterm.md)（无期限观察窗不绑主线关闭）。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../trackers/todo.md)
`ARCH-028` 行的「成功标准」列（S1~S7 与本壳同号对应，S3 按 2026-09-29 裁决移交 REQ-100 不作
关闭前置），本壳不复制判据条目；各判据的验收手段见「验证与验收」节，逐批实施过程与证据见
「过程与证据」节。本壳其余章节（含「关闭与归档」）与工作项表出现的 S 编号即指行内同号判据。

## 界面设计：仪表盘「本地模型状况」卡（W4 蓝图，评审后晋升设计文档）

位置：`#/admin/dashboard`「服务在线情况」卡正下方，compact 单行卡；数据源复用
`GET /models/{slot}`（扩展后字段）+ `/monitor/gpu`，随页面可见性 30s 轮询（不上 WebSocket）。

显隐与单/多卡规则：

| 条件 | 呈现 |
| --- | --- |
| 所有槽位来源均 api（全局 `QED_API_SELECT=api` 且无 manifest.source=local 覆写） | 整卡隐藏 |
| `QED_RESOURCE_GUARD=true` | 呈现「当前在跑的模型」：在跑（**口径＝ready∪degraded**，三轮裁决 09-24：server 常驻但模型未加载不算在跑，降级＝活着但 GPU blocked 仍属占显存的病态在跑）的本地槽位全部呈现——单活互斥保证正常 ≤1 个；若实况多个在跑（如 LM Studio 手动加载绕过 8900 仲裁）则并列呈现不隐藏；都没在跑 → 最近翻转活跃 > 默认文字槽位 |
| `QED_RESOURCE_GUARD=false` | text / vision 双卡并列（共存由用户负责） |

单卡字段（一行排开）：槽位（文字/图像）· 渠道（LM Studio/Docker/llama.cpp）· 状态徽章
（未就绪 / 启动中 / 就绪 / **降级**＝HTTP 绿但 GPU 不可见 / 失败：原因 tooltip）· 显存
（已用/总量）· 最后翻转时刻（supervisor 内存态）。最小增量原则：不加图表、不新增页面。

## 监督器设计（W2/W3 蓝图）

落点：`backend/qed_engine/services/llm/` 内新增 `supervisor.py`（与 model_manager 同包，不另起
服务；模块名若扩至 embedding 再议升包）。后台守护线程周期任务：

1. **分级探测**：T1 HTTP 存活（复用 `probe_slot`）→ T2 GPU 可见性（vision：`docker exec mineru-api nvidia-smi -L`；text：LM Studio/llama-server 侧显存加载态）→ T3 功能性小调用仅手动「验证」按钮，不进轮询。
2. **状态机防抖**：ready/degraded/down 连续 N 次（暂定 3）同向探测才翻转；翻转写结构化日志（事件账 v1 用 8900 日志，不建新表），仪表盘取最后翻转时刻与原因。
3. **受控恢复**（用户裁决 2026-09-23；W8 闩锁细化见第 6 条）：翻转至 down/degraded 且**非在飞**时自动 `operate_model(slot, 'restart')`，带退避、连续 3 次救不活降级为纯告警；**在飞只告警不碰**——在飞判据＝8902 有 queued/running 任务（实施定稿 2026-09-23：8902 离线＝不可能在飞→放行；其余查询失败保守按在飞；与已知约束 9 运维约定并行）；GPU blocked 恢复手段＝`docker restart mineru-api`（已知约束 7 实证）。
4. **水位门**（W9 设计定稿 2026-09-24）：落点 `model_manager.operate_model` 启动路径单一入口，`monitor.probe_gpu` 查空闲显存 < 阈值（默认 12GB，`.env` `QED_GPU_START_WATERMARK_GB` 可配）→ 拒绝启动并记事件（防「挤着起→秒死」循环）；探针失败一律按不达标处理（fail-closed，DeepTutor 权重门同语义），拒绝原因进事件账与仪表盘状况卡。参照 Ollama 加载前所需显存预检。
5. **掉线诊断包**：翻转至 down 时自动采集 docker events（近 10min）+ mineru 日志尾 + WSL `dmesg` OOM 痕迹，落运行日志目录供 S3 定谳；W10 补强（2026-09-24）：增采 `docker inspect` 的 `State.OOMKilled` / `ExitCode` / `RestartCount`——「被外部杀」与「vLLM OOM」两假设现场直接定谳，不等复现。
6. **启动宽限期与恢复闩锁**（W7/W8，2026-09-24 增强轮；演练证据：09-23 18:57:27 启动窗口 health 拒连×3 被防抖定态 down，白耗恢复预算并触发诊断包）：`operate_model` 派发 start/restart 后槽位置 `starting`（宽限默认 180s 可配），窗口内拒连观测不推进 down 防抖、不消耗恢复预算、不触发诊断包，仪表盘徽章按现状卡字段「启动中」呈现；宽限期满仍未就绪才按正常防抖翻 down。恢复派发加闩锁单发：闩住期间不再派发第二发（防慢冷启动被叠加拉起），翻回 ready 或宽限超时解锁；清理 supervisor.py:202 死赋值遗留。参照 k8s startupProbe 语义、llama-swap 重启锁与启动失败计数。
7. **网关请求侧熔断**（W11，用户裁决 2026-09-24：归属 ARCH-027-M3 之说先记录、实施在本项目根仓库；M3 调用协议容错（降 effort/JSON repair）滚动时以本交付为地基）：网关按槽位连续失败（连接失败/5xx）计数，3 次开熔断（60s 内快挂返回稳定 reason），窗口过放 1 次 half-open 试探（成功闭合、失败重开）；open 事件供监督器消费为 down 观测源加速防抖（不替代主动探测）。参照 DeepTutor 熔断 5 次/60s half-open 阈值形态改造。
8. **期望状态（desired）**（W12，用户裁决 2026-09-24）：槽位记 running/stopped/未声明——观测到 ready 即采纳 running（人工停止优先，不被观测覆盖）；`operate_model` start/restart 上报 running、stop 上报 stopped；api 来源暂停观测时清空快照与期望（消「冻结旧就绪」与切回 local 即拉起两案，切换不残留意图）。**自动恢复只对 desired=running 的 Episode 生效**：人工停止＝合法终态，永不自动复活直到下次手动 start，每 Episode 仅一次告警。同裁决入状况卡文案：「server 存活但模型未加载」（health_state=ready 且 ready=false）只加「模型未就绪（服务存活）」次要说明，不标降级。**二轮裁决（同日，用户质疑「模型未启动为何显示就绪」现场实锤 LM Studio server 常驻未加载）**：小字自解释力度不足，未加载态改中性徽章「未加载（服务存活）」，服务+模型双就绪才显绿色「就绪」，仍不标降级；后端与 health_state 语义零改动（前端显示派生，登记 BUGFIX-020，vitest TDD + 浏览器实测）。

## 批次口径（W5）

Axiom-Flow PLAN-007 已实现全本分窗（默认 56 页/窗、`AXIOM_PARSE_WINDOW_SIZE` 可配、窗级
deadline、窗间探活）——根仓库 `.env` 配 `AXIOM_PARSE_WINDOW_SIZE=50` 落实「50 页/批」（用户
裁决 2026-09-23，不改对方代码、不另发 REQ）；配置随对方提交 + 8902 换码生效，验证并入
REQ-086/087 收口复测（同场观察 S4）。

## 范围与非目标

**范围**：8900（探针扩展 + supervisor + 水位门 + 诊断包 + 启动宽限/恢复闩锁/网关熔断）、8903 仪表盘状况卡、根 `.env` 配置、
DeepTutor 本地模型管理只读调研。

**非目标**：解析调用链改造（归 Axiom-Flow，ADR 0014）、Axiom-Flow/QED-Tracker 代码请求与
git 操作、8902 侧在飞硬互斥（2026-09-21 既有裁决不变）、建新事件表/接入外部监控、
embedding 本地化、Docker 层兜底（容器 healthcheck + `--restart` 自动拉起——用户裁决 2026-09-24 **不做**：保 W6 RestartCount 取证口径干净、恢复动作不绕过 8900 记账）、空闲驱逐/keep_alive TTL（观察项，W6 定谳后再议）。

## 前置条件

1. 本壳 + ARCH-028 任务行登记（2026-09-23 完成）。
2. W2/W3 真机演练与 S3 取证需 MinerU 容器可起（Docker Desktop 当前未运行，用户侧）；
   逻辑层（状态机/恢复决策/水位门）用假 runtime 注入先行单测，不受阻塞。
3. W5 生效前置＝对方 PLAN-007 提交 + 8902 换码（即 REQ-086/087 收口链），`.env` 先行配置无副作用。
4. W4 依赖 W1 字段扩展；各流实施排期逐条经用户确认（本壳只立项登记）。

## 工作项（滚动登记表）

| 流 | 内容 | 归属 | 状态 |
| --- | --- | --- | --- |
| W0 | DeepTutor 本地模型管理只读调研：其监督/恢复/事件细节 → 吸收/拒绝判定表回写本壳 | 只读 `D:\coding\demo_program\DeepTutor` | **已收口 2026-09-23**：其不管理本地模型进程（只发现/探活/诊断）；判定见下「W0 调研判定」 |
| W1 | `GET /models/{slot}` 扩展：`gpu_visible` / `degraded` 归并、`last_flip`（supervisor 内存态；无 supervisor 时回退探针态）（TDD） | 根 8900 | **已实施 2026-09-23**：新增 health_state/health_reason/gpu_visible/last_flip 四字段（availability 语义不变，控制台零影响），定向 11 + 相邻 181 全绿；真机生效需 8900 重启加载（并入 W4 浏览器实测） |
| W2 | supervisor 骨架：分级探测 T1+T2、状态机防抖、事件日志（假 runtime 注入单测） | 根 8900 `services/llm/supervisor.py` | **逻辑层已实施 2026-09-23**（T1 复用 probe_slot / T2 `wsl -e docker exec nvidia-smi -L` fail-closed；防抖 N=3；翻转事件日志；`QED_MODEL_SUPERVISOR` 开关默认开）；真机观测演练随 W3；维护职责声明（本模块只维护模型服务本身、不含 prompt）已落 code-map 与 local-model-management 分工边界节（2026-09-23） |
| W3 | 受控恢复：非在飞自动重启 + 退避（≤3 次）+ 在飞只告警 + 掉线诊断包采集；真机杀容器演练 | 根 8900 | **逻辑层已实施 2026-09-23**：退避节拍＝非就绪每 4 tick（≈2min）评估一次、上限 3 次后放弃转纯告警、翻回 ready 重置预算；在飞门双路（REQ-088 列表端点——对方未提交码则 404/405 回退书目级 active_job_id；8902 离线放行、其余查询失败保守在飞）；诊断包＝非就绪翻转采 docker events（10min）+日志尾 2000+nvidia-smi。假 runtime 注入单测：test_llm_supervisor 25 例全绿、非契约全量 466 例全绿。**真机首观测 2026-09-23（用户重启机器+控制台起图像模型即演练）**：仪表盘 18:54 down（重启后容器未起的合法初观测定态）→18:55:50 ready→18:57:27 down（启动窗口 health 拒连×3）→19:00:42 ready；容器侧 docker events 实录 18:59:20 create+start（退避重启落点，RestartCount=0，无 die/kill/OOM——三类根因假设本轮未复现，S3 证据仍待真崩）；容器实际在 Ubuntu-24.04 自带 dockerd（Docker Desktop 引擎为空，观测口径已纠正）。本演练同时暴露并直修事件账缺口：qed_engine INFO 日志无 handler 被静默丢弃（用户裁决直修不立 BUGFIX 号，e0288b1 挂 stderr INFO handler），修后重启实测 ∅->ready 事件行落 logs/config.log |
| W4 | 仪表盘「本地模型状况」卡（本壳界面设计落地，含 local/api 两态显隐实测） | 根 8903 | **已实施 2026-09-23**：LocalModelStatus 卡 + Dashboard 30s 轮询（隐藏页暂停）；tsc/vitest 26 文件 209 例/build 全绿；浏览器实测（8900 已重启加载 W1 字段）local 态单卡真实渲染「图像模型 掉线 · Docker · 显存 5.9/16 GiB · 翻转于 17:42:20」，请求全指 8900 无新报错；api 态显隐与轮询 hidden 跳过由单测覆盖（隐身视口不能观察活轮询、截图不可得）。**2026-09-24 双口径审核（BUGFIX-019）**：控制台 availability（实时单发探针）与仪表盘 health_state（防抖定态、翻转 ≤2min 滞后）的偏差判定属设计非 bug；契约落 local-model-management.md「仪表盘与控制台双口径契约」节，卡角标改写为自解释措辞（vitest TDD） |
| W5 | 批次与水位：根 `.env` `AXIOM_PARSE_WINDOW_SIZE=50`（已配置，生效随对方换码）+ 启动前显存水位门（阈值暂定 12GB，W0 后可调） | 根 8900 + `.env` | 部分进行（.env 已配；水位门设计定稿见监督器设计 §4、实现转 W9 专项） |
| W6 | 掉线根因定谳：实采 ≥1 次掉线诊断包 → 三类假设裁决 → 处置回写 local-model-management.md 已知约束节 | 根（证据） | **移交 [REQ-100 长期线](2026-09-29-local-model-debug-optimization-longterm.md)（L1）**（2026-09-29 用户裁决 + ADR 0020 收口节拍）：采集代码随 W3 就绪、W10 docker inspect 补强已上线，09-23 重启演练属合法掉线无崩溃事件可采；定谳需真崩或注入杀容器，属无期限观察窗，故移出主线关闭前置、随长期线滚动 |
| W7 | 启动宽限期：start/restart 派发后槽位置 starting（宽限默认 180s 可配），窗口内拒连观测不推进 down 防抖/不耗恢复预算/不触发诊断包；徽章「启动中」（细则见监督器设计 §6） | 根 8900 `supervisor.py`+`model_manager.py` | **已实施 2026-09-26（增强批）**：`QED_MODEL_START_GRACE_SECONDS`（默认 180，≤0 关闭）；operate_model start/restart 派发即 `note_starting_active` 置窗；窗口内 down/degraded 观测全抑制（ready 走正常防抖、翻回 ready 即解锁）、恢复 tick 冻结、诊断包不触发、期满转正常防抖；快照 `health_state="starting"`（api-contracts GET /models/{name} 字段行本次补齐）＋仪表盘徽章第四态「启动中」（vitest TDD）。S5 单测形态达成（假 runtime 注入 8 例，含 18:57:27 案例回归）；真机重启演练留待演练窗口 |
| W8 | 恢复闩锁：restart 单发闩锁、翻回 ready 或宽限超时解锁，闩住期间不叠加派发；清理 supervisor.py:202 死赋值 | 根 8900 `supervisor.py` | **已实施 2026-09-26（与 W7 同提交）**：闩锁＝宽限窗口内恢复派发与 tick 全冻结（每窗口单发），期满/翻 ready 解锁（test_w8_recovery_latch_single_dispatch_per_grace_window 断言旧行为「每拍连发」不再现）；`s.cooldown` 死赋值已删并有守护用例（_SlotState 无该字段、实例不落未声明属性） |
| W9 | 显存水位门实施（W5 收口）：operate_model 启动前 probe_gpu 查空闲显存、低于阈值拒起并记事件（fail-closed；默认 12GB `.env` 可配） | 根 8900 `model_manager.py`+`monitor.py` | 未开始（S6 判据；底座 probe_gpu 已有） |
| W10 | 诊断包取证补强：down 翻转时增采 docker inspect（State.OOMKilled/ExitCode/RestartCount） | 根 8900 `supervisor.py` | 未开始（S3「外部杀/OOM」两假设现场直接定谳项）。**顺带必修已直修（2026-09-24，用户裁决不另立任务）**：W12 真机实录 docker events 采集失效——`{{.Status}}` 字段不存在（rc=64）且 `--until now` 不能解析为时间（rc=1），events 段实际采空；修正为 epoch 整数 since/until + `{{.Action}} {{.Type}} {{.Actor.Attributes.name}}`（真机实测 rc=0），单测断言命令构造（test_default_diagnostics_events_cmd…，定向 98 passed）。本行剩余范围＝增采 docker inspect：**已实施 2026-09-26（增强批）**——诊断包 captures 增 `docker inspect mineru-api --format {{.State.OOMKilled}} {{.State.ExitCode}} {{.RestartCount}}`，单测断言命令构造与三字段齐备；W10 至此全量收口（S3 现场定谳采集能力就绪，定谳本身仍待真崩/注入杀容器＝W6） |
| W11 | 网关请求侧熔断：槽位级连续失败开闸（3 次/开 60s/half-open 单试探/快挂稳定 reason），open 事件供监督器消费为观测源（细则见监督器设计 §7） | 根 8900 `gateway.py`+`supervisor.py` | 未开始（用户裁决 2026-09-24：实施在本项目，归属 M3 之说先记录） |
| W12 | 期望状态（desired）语义：人工停止永不自动复活（仅告警一次）+ api 来源观测暂停清位 + 状况卡就绪性说明文案 | 根 8900 `supervisor.py`+`model_manager.py` + 8903 状况卡 | **已实施 2026-09-24**（用户两案实报直修：停模型后仪表盘仍「就绪」＝api 暂停冻结快照＋监督器把人工停止当故障复活；api→local 切换自动起模型＝意图残留。裁决：人工停止＝合法终态、未加载仅说明文案不标降级；细则见监督器设计 §8 与 BUGFIX-018。TDD 新增 supervisor 6 例＋model_manager 挂点 2 例＋状况卡 vitest 2 例，定向 97 passed；真机生效需 8900 重启加载。**真机验证 2026-09-24（用户重启 8900，浏览器实测）**：① 人工停止链路四行落账——期望状态 desired=stopped → ready→down 定态 → 每 Episode 仅一条「不自动恢复，仅告警」，跨恢复节拍 0 次恢复尝试、WSL 容器保持未起；② 来源切 api：`down->∅ 观察暂停（api 来源）` 清位、状况卡图像行消失（旧 down/就绪快照不残留）；③ 切回 local：∅→down 首观测定态、恢复尝试 0、仅一条「期望=未声明」告警，不自动拉起；④ 正向对照：手动启动上报 desired=running 后撞上已知约束 7 实录（容器内 NVML GPU blocked）→ 卡片实时「降级」黄标 → 恢复第 1 次 restart → degraded→ready 收敛（desired=running 才恢复的活体证明）；⑤ 文字槽位「服务存活未加载」渲染「模型未就绪（服务存活）」次要文案（health_state 保持就绪不标降级，用户裁决形态）；页面请求 24 条全指 8900 全 200、console 零报错；环境已复位双就绪 |

## W0 调研判定（2026-09-23，DeepTutor 只读调研收口）

DeepTutor **不管理本地模型进程**（Ollama/LM Studio/vLLM 视为用户自管外部服务，只做发现/探活/诊断）；
最接近 supervisor 的是其 `opencode serve` 子进程池管理。逐机制判定：

| 机制（其证据） | 判定 | 落点 |
| --- | --- | --- |
| 分级 severity + 稳定 reason code（`services/config/readiness.py:35-53`） | 吸收 | 事件账文案稳定化已按此形态实现（W2）；reason code 若 i18n 需要再补 |
| 熔断 5 次/60s half-open（`utils/network/circuit_breaker.py:18`） | 改造吸收 | 防抖/退避阈值取小（N=3），配 16GB 冷启动代价（W2 已按此实现） |
| 探测预算 2-3s、配置提交前探针 25s/0 重试（`readiness.py:783-799`） | 吸收 | T1 5s（复用 probe_slot）/T2 15s（`GPU_PROBE_TIMEOUT`）；T3 手动验证即其语义级探针形态 |
| cursor 行日志 2000 行/0.3s 节流（`services/parsing/engines/mineru/models.py:36-37,146-154`） | 吸收 | W6 诊断包采集形态（内存有界） |
| fail-closed 权重门（`mineru/readiness.py:34-50`） | 吸收推广 | T2 探测异常按不可见处理（已实现）；W5 显存水位门同语义 |
| 请求级 retry (1,2,4)/上限 120s（`services/llm/factory.py:65-77`） | 拒绝 | 网络重试≠进程重启，混用会绕过在飞保护（W3 恢复只走 operate_model） |
| 懒启动/就绪轮询/死亡透明重启 + 全局锁（`services/subagent/opencode_server.py:39-43,136-168`） | 改造 | 其无退避计数会无限重生——W3 自动重启必须带 ≤3 次退避上限 |
| GPU/显存检查 | 其无参考实现，自研 | W2 T2（docker exec nvidia-smi）+ W5 水位门（monitor.probe_gpu 已有底座） |

## 过程与证据

- **2026-09-23 立项**：本地模型稳定性轮建立本壳；工作项 W0~W12 拆解、状况卡界面蓝图与
  监督器设计蓝图分别见本壳「界面设计」「监督器设计」两节。
- **2026-09-23 ~ 09-26 逐批实施**：W0~W4、W7、W8、W10、W12 落地，逐批门禁与浏览器/真机实测
  证据登记在工作项表各行。
- **2026-09-24 裁决**：空闲驱逐 / keep_alive TTL 列为观察项、不入主线关闭条件（转
  [REQ-100 长期线](2026-09-29-local-model-debug-optimization-longterm.md) L3）。
- **2026-09-29 用户裁决（[ADR 0020](../adr/0020-task-closure-cadence-and-thin-registration.md)
  收口节拍）**：W6/S3 掉线根因定谳观察窗整批移交长期线 REQ-100，主线关闭不再依赖「等一次真崩」；
  同支线 DEFECT-005 按节拍关闭（见 completed.md 对应行）。
- **2026-09-30 台账结构改判（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)）**：
  S1~S7 判据正本移入 todo 行「成功标准」列，本壳保留目标、蓝图与登记表；原行内
  「剩余＝W9/W11 + 真机演练场」叙述迁入本节。
- **2026-09-30 现状与下一条件**：剩余＝W9 显存水位门 + W11 网关请求侧熔断（代码）+
  真机演练场 S1/S2/S4/S5/S6/S7；关闭条件见「关闭与归档」节，由用户裁决收口。

## 验证与验收

- 各判据的验收手段（判据正文见 todo 行 `ARCH-028` 的「成功标准」列）：S1＝web 门禁 +
  qed-frontend-check 浏览器实测（local/api 两态）；S2＝8900 定向测试（假 runtime 注入）+
  真机杀容器演练；S4＝随 REQ-086/087 收口复测（b05 全本 317 页）观察窗行为；S5＝
  `test_llm_supervisor` 假 runtime 注入单测 + 真机重启演练（对照 09-23 18:57:27 误判案例回归）；
  S6＝注入探针单测 + 真机调高阈值演练；S7＝`test_llm_gateway` 熔断单测（假客户端）+
  真机杀容器在飞观察。S3 的取证手段（诊断包 = docker events + mineru 日志尾 + WSL dmesg）
  随移交项由 REQ-100 壳承载。
- 每流收口：8900 定向测试 + `tests/contract`（经用户批准）；8903 侧 web 门禁（tsc·vitest·build）
  + qed-frontend-check 真实浏览器实测（S1 需 local/api 两态各验一次）。
- S2 真机演练：控制台起 vision → `docker kill mineru-api` → 观察仪表盘翻转、事件日志、非在飞
  自动重启与退避计数。
- W7~W11 验收判据见成功标准 S5~S7；真机演练并入 S2 同场：重启至就绪窗口内无 down 误翻转（对照 09-23 18:57:27 案例）、杀容器时在飞调用熔断快挂与 half-open 自愈可观测、水位门演练用调高阈值触发。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯记录文档：删除本文件不影响代码与测试；`.env` 增行删除即回退；登记表条目对应代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件（2026-09-29 按 ADR 0020 收口节拍修订）＝**W9 显存水位门 + W11 网关请求侧熔断收口，且 S1/S2/S4/S5/S6/S7 验收通过**，由用户裁决收口；W0~W4/W7/W8/W10/W12 已实施，S3/W6 掉线根因定谳观察窗已移交 [REQ-100 长期线](2026-09-29-local-model-debug-optimization-longterm.md)，**不再作为本壳关闭前置**（主线不为「等一次真崩」长期挂 In Progress）。关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-028 任务行；界面与监督器设计定稿晋升 `local-model-management.md`（状况卡细则视情入 admin-console.md/dashboard 相关设计）。
