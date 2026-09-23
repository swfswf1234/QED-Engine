# 本地模型稳定性轮滚动记录（仪表盘状况卡·监督器·掉线根因·批次水位）（local-model-stability-round）

状态：In Progress
任务类型：B
最后更新：2026-09-23
关联 ADR：无新增（登记方式沿用 [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳）
关联设计：[local-model-management.md](../design/local-model-management.md)（槽位/runtime/单活互斥地基）、
[llm-gateway.md](../design/llm-gateway.md)（网关与调用记录分工）、
[api-contracts.md](../architecture/api-contracts.md)（W1/W2 端点扩展承接位）、
[frontend-architecture.md](../architecture/frontend-architecture.md)（W4 仪表盘界面）
关联 Tracker：docs/trackers/todo.md（ARCH-028 任务行，一任务一行一壳）
归档判定：Retain（滚动记录，轮次收口时按当时里程碑归档 history/plans/<year-month>/）

> 本壳是本地模型稳定性轮唯一滚动记录。排期范围＝根仓库（8900/8903）+ 根 `.env` 配置；
> 解析批次执行归 Axiom-Flow 既有分窗实现（ADR 0014 模型生命周期/解析调用分工），本轮不向子项目发代码请求。

## 背景与目标

**背景**（用户裁决 2026-09-23）：本地模型服务稳定性不足——① 图像模型（MinerU，5002 WSL 容器）
反馈「容易断」但根因未定谳（现有三类假设：WSL 挂起后容器内 GPU 不可见＝已知约束 7；容器被
外部/系统杀死＝09-21 docker events exec_die 循环实录；重负载 vLLM OOM）；② 大数量级解析易
OOM，需按批次控量；③ 现有探针全为按需单发，无持续监测、无自动恢复、无事件账；④ 仪表盘上看
不出本地模型死活（只有四服务徽章）。参照 DeepTutor 本地模型管理（`D:\coding\demo_program\DeepTutor`
只读调研，判例同 REQ-089）先行吸收，再定监督器细节取舍。

**目标**：本地模型「看得见（仪表盘）+ 管得住（监督器：检测→告警→受控恢复）+ 喂不饱不死
（批次 ≤50 页/窗 + 显存水位门）」，掉线根因取证定谳。

**成功标准**：

| # | 标准 | 判据 |
| --- | --- | --- |
| S1 | 仪表盘「本地模型状况」卡按显隐/单卡规则实时反映状态（含降级态与失败原因），API 模式整卡隐藏 | web 门禁 + qed-frontend-check 浏览器实测（local/api 两态） |
| S2 | 监督器闭环：探针翻转防抖 + 事件账 + 非在飞自动重启（退避≤3 次）+ 在飞只告警，注入杀容器可观测恢复 | 8900 定向测试（假 runtime 注入）+ 真机杀容器演练 |
| S3 | 图像模型掉线三类假设定谳（GPU blocked / 外部杀 / OOM），结论与处置写入本壳并回写设计文档 | 诊断包（docker events + mineru 日志尾 + WSL dmesg）实采 ≥1 次掉线 |
| S4 | 全本解析按 ≤50 页/窗执行且 OOM 不再现 | 随 REQ-086/087 收口复测（b05 全本 317 页）观察窗行为 |

## 界面设计：仪表盘「本地模型状况」卡（W4 蓝图，评审后晋升设计文档）

位置：`#/admin/dashboard`「服务在线情况」卡正下方，compact 单行卡；数据源复用
`GET /models/{slot}`（扩展后字段）+ `/monitor/gpu`，随页面可见性 30s 轮询（不上 WebSocket）。

显隐与单/多卡规则：

| 条件 | 呈现 |
| --- | --- |
| 所有槽位来源均 api（全局 `QED_API_SELECT=api` 且无 manifest.source=local 覆写） | 整卡隐藏 |
| `QED_RESOURCE_GUARD=true` | 恒单卡「当前占位模型」：就绪/在飞 > 最近活跃 > 默认文字槽位——文字在跑监控文字，图像一启动即切换并持续监控图像 |
| `QED_RESOURCE_GUARD=false` | text / vision 双卡并列（共存由用户负责） |

单卡字段（一行排开）：槽位（文字/图像）· 渠道（LM Studio/Docker/llama.cpp）· 状态徽章
（未就绪 / 启动中 / 就绪 / **降级**＝HTTP 绿但 GPU 不可见 / 失败：原因 tooltip）· 显存
（已用/总量）· 最后翻转时刻（supervisor 内存态）。最小增量原则：不加图表、不新增页面。

## 监督器设计（W2/W3 蓝图）

落点：`backend/qed_engine/services/llm/` 内新增 `supervisor.py`（与 model_manager 同包，不另起
服务；模块名若扩至 embedding 再议升包）。后台守护线程周期任务：

1. **分级探测**：T1 HTTP 存活（复用 `probe_slot`）→ T2 GPU 可见性（vision：`docker exec mineru-api nvidia-smi -L`；text：LM Studio/llama-server 侧显存加载态）→ T3 功能性小调用仅手动「验证」按钮，不进轮询。
2. **状态机防抖**：ready/degraded/down 连续 N 次（暂定 3）同向探测才翻转；翻转写结构化日志（事件账 v1 用 8900 日志，不建新表），仪表盘取最后翻转时刻与原因。
3. **受控恢复**（用户裁决 2026-09-23）：翻转至 down/degraded 且**非在飞**时自动 `operate_model(slot, 'restart')`，带退避、连续 3 次救不活降级为纯告警；**在飞只告警不碰**——在飞判据＝8902 有 queued/running 任务（查询失败/离线按保守「非在飞」放行，与已知约束 9 运维约定并行）；GPU blocked 恢复手段＝`docker restart mineru-api`（已知约束 7 实证）。
4. **水位门**：启动本地模型前查空闲显存 < 阈值（暂定 12GB）→ 拒绝启动并记事件（防「挤着起→秒死」循环）。
5. **掉线诊断包**：翻转至 down 时自动采集 docker events（近 10min）+ mineru 日志尾 + WSL `dmesg` OOM 痕迹，落运行日志目录供 S3 定谳。

## 批次口径（W5）

Axiom-Flow PLAN-007 已实现全本分窗（默认 56 页/窗、`AXIOM_PARSE_WINDOW_SIZE` 可配、窗级
deadline、窗间探活）——根仓库 `.env` 配 `AXIOM_PARSE_WINDOW_SIZE=50` 落实「50 页/批」（用户
裁决 2026-09-23，不改对方代码、不另发 REQ）；配置随对方提交 + 8902 换码生效，验证并入
REQ-086/087 收口复测（同场观察 S4）。

## 范围与非目标

**范围**：8900（探针扩展 + supervisor + 水位门 + 诊断包）、8903 仪表盘状况卡、根 `.env` 配置、
DeepTutor 本地模型管理只读调研。

**非目标**：解析调用链改造（归 Axiom-Flow，ADR 0014）、Axiom-Flow/QED-Tracker 代码请求与
git 操作、8902 侧在飞硬互斥（2026-09-21 既有裁决不变）、建新事件表/接入外部监控、
embedding 本地化。

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
| W2 | supervisor 骨架：分级探测 T1+T2、状态机防抖、事件日志（假 runtime 注入单测） | 根 8900 `services/llm/supervisor.py` | **逻辑层已实施 2026-09-23**（T1 复用 probe_slot / T2 `wsl -e docker exec nvidia-smi -L` fail-closed；防抖 N=3；翻转事件日志；`QED_MODEL_SUPERVISOR` 开关默认开）；真机观测演练随 W3 |
| W3 | 受控恢复：非在飞自动重启 + 退避（≤3 次）+ 在飞只告警 + 掉线诊断包采集；真机杀容器演练 | 根 8900 | 待开始（前置 W2 + 容器可起） |
| W4 | 仪表盘「本地模型状况」卡（本壳界面设计落地，含 local/api 两态显隐实测） | 根 8903 | **已实施 2026-09-23**：LocalModelStatus 卡 + Dashboard 30s 轮询（隐藏页暂停）；tsc/vitest 26 文件 209 例/build 全绿；浏览器实测（8900 已重启加载 W1 字段）local 态单卡真实渲染「图像模型 掉线 · Docker · 显存 5.9/16 GiB · 翻转于 17:42:20」，请求全指 8900 无新报错；api 态显隐与轮询 hidden 跳过由单测覆盖（隐身视口不能观察活轮询、截图不可得） |
| W5 | 批次与水位：根 `.env` `AXIOM_PARSE_WINDOW_SIZE=50`（已配置，生效随对方换码）+ 启动前显存水位门（阈值暂定 12GB，W0 后可调） | 根 8900 + `.env` | 部分进行（.env 已配；水位门待开始） |
| W6 | 掉线根因定谳：实采 ≥1 次掉线诊断包 → 三类假设裁决 → 处置回写 local-model-management.md 已知约束节 | 根（证据） | 待开始（前置 W3） |

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

## 验证与验收

- 每流收口：8900 定向测试 + `tests/contract`（经用户批准）；8903 侧 web 门禁（tsc·vitest·build）
  + qed-frontend-check 真实浏览器实测（S1 需 local/api 两态各验一次）。
- S2 真机演练：控制台起 vision → `docker kill mineru-api` → 观察仪表盘翻转、事件日志、非在飞
  自动重启与退避计数。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯记录文档：删除本文件不影响代码与测试；`.env` 增行删除即回退；登记表条目对应代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件＝W0~W6 收口且 S1~S4 验收通过，由用户裁决收口；关闭时本壳 Retain 归档
`history/plans/<year-month>/`，todo 移除 ARCH-028 任务行；界面与监督器设计定稿晋升
`local-model-management.md`（状况卡细则视情入 admin-console.md/dashboard 相关设计）。
