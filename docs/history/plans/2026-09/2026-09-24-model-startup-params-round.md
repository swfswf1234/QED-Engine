# 本地模型启动参数配置（ARCH-028 稳定性轮支线壳，model-startup-params）

状态：Completed
任务类型：B
最后更新：2026-09-24
关联 ADR：`../history/adr/v0.1/0016-…`（一任务一行一壳）、`0017-design-doc-structure-contract.md`（W6 设计节晋升遵守统一骨架）；无新增 ADR（不改 standards/ 规则）
关联设计：`docs/design/local-model-management.md`（W6 晋升目标：「本地模型启动参数契约」节）
关联 Tracker：docs/trackers/todo.md ARCH-028 轮节 ARCH-033 支线行（2026-09-24 用户裁定：单独任务不新开轮，本壳挂稳定性轮 ARCH-028 作支线，编号与壳保留）；分工——轮本体管启停/探测/水位/恢复，本支线管**加载参数的语义与生效链路**（恢复重启消费本支线参数，见 W5）
归档判定：Retain（registry 结构扩展 + 两 runtime 行为变更 + 真机验证记录）

## 目标与成功标准

把本地模型**加载层参数（尤其上下文长度）变成声明式、可控、全链路生效**的配置：
参数挂 registry 现有身份静态表（用户裁决 R1：不引入 per-身份 json 子系统、不做 UI 编辑），
lmstudio 加载带 `-c`，llamacpp 通道真做（R2），共用端口互斥自动让位（R3）。

- S1：lmstudio 渠道启动后，`/api/v0/models` 中目标模型 `state=loaded` 且实测生效上下文 = 参数表值
  （现状：`lms load` 硬编码仅 `--gpu max`，上下文由 LM Studio 默认值决定，不可控）；
- S2：text 槽切 llamacpp 渠道，8900 一键启动成功：常驻 LM Studio server 自动 `lms server stop`
  让位 → 自带 `llama-server.exe` 加载 `~/.lmstudio/models` 下 GGUF → `GET /v1/models` 200，
  `/props` 报告 ctx = 参数表值；
- S3：监督器受控恢复重启走同一条带参加载路径（单测覆盖命令构造，真机触发可选）；
- S4：全量门禁绿（并行 WIP 红逐条归因豁免）；
- S5：设计节晋升 `local-model-management.md`（验收通过后）。

## 范围与非目标

- 范围：`services/llm/registry.py`（Identity 扩展 `params`）、`runtimes/lmstudio.py`
  （load 带参）、`runtimes/llamacpp.py` + `scripts/text-model/qed_qwen_service.py`
  （路径回退解析 + 参数补全 + 端口互斥）、相关单测与契约、设计节晋升、台账。
- 非目标：**请求层采样默认**（temperature / max_tokens 默认值与 ctx 钳制）不做，留作后续支线
  （现状 max_tokens 透传已满足）；docker（vision）通道参数不动；不做配置 UI 与热更新；
  不改 .env/Settings 字段语义。

## 裁决账（用户 2026-09-24）

| # | 裁决 | 要点与理由 |
| --- | --- | --- |
| R1 | 不搞新配置机制 | 模型就几个，参数直接扩展 registry `IDENTITIES` 静态表的 `Identity`（新增 `params: dict[runtime, dict]`）；改参数 = 改表 + 重启 8900。参考 ollama Modelfile 的「配置跟模型走」思想，但落在我们已有的身份表上，不建 json 子系统 |
| R2 | llamacpp 真做 | 二进制与模型都复用 LM Studio 目录（本机零安装，实证见前置条件）；`_find_llama_server` 解析链 = PATH 优先 → `~/.lmstudio/extensions/backends/` 最新版（CUDA 变体优先）；模型 = 身份表引用直指 `~/.lmstudio/models/**.gguf` |
| R3 | 端口互斥自动化 | text 槽两渠道共用 5001 且 LM Studio server 常驻——llamacpp 启动前探测 5001 被 LM Studio 占用 → 自动 `lms unload --all` + `lms server stop` 再启动（W7 真机修正 09-24：`lms server stop` 单独不足以让位——LM Studio 自带 llama-server worker 进程残驻端口 6944 占 ~13.7GB 显存，unload 才终止 worker）；反向（lmstudio 启动前 llama-server 占端口）→ 复用脚本 stop 清位。事件账全程记日志 |
| R5 | context 默认值 | 两本地 text 身份先填 **16384**（用户 2026-09-24 令「先填16384，开始实施」）；显存装不下回落 8192 档（W2 真机 `--estimate-only` 预估核验）；09-24 预估实测：27B@16384 gpu-max = 16.10 GiB（4080 16GB 临界，真机加载失败即按 R5 回落 8192）、9B@16384 = 11.93 GiB 可容纳；**09-24 用户改判**：27B 按 8192 档配置并真机试一轮（两 runtime 同步 8192），9B 维持 16384 |
| R4 | 新立壳 | 独立任务壳；编号顺延（ARCH-030 已用于跨项目契约指南轮、031/032 并行占用 → 取 **ARCH-033**）。**2026-09-24 用户裁定更正：单独任务不新开轮，改挂 ARCH-028 稳定性轮作支线，编号与本任务壳保留** |

## 前置条件（真机实证 2026-09-24）

- `lms load --help`：支持 `-c/--context-length`、`--gpu <off|0~1|max>`、`--parallel`、`--ttl`、
  `--estimate-only`；本机 lms 版本**无** `set-context` 子命令（旧文档口径作废）。
- llama-server 不在 PATH；LM Studio 自带
  `~/.lmstudio/extensions/backends/llama.cpp-win-x86_64-nvidia-cuda12-avx2-2.44.0/llama-server.exe`
  实测 `--version` 可运行（0.4.1-dev，CUDA12 变体）。
- GGUF 实存：`~/.lmstudio/models/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF/`（IQ3_S + mmproj）、
  `unsloth/Qwen3.8-27B-GGUF/`（UD-Q3_K_XL + mmproj）、`lmstudio-community/Qwen3.5-9B-GGUF/`
  （Q8_0 + mmproj）——llamacpp 通道可带 `--mmproj`（本任务参数表预留字段，启用与否 W3 内定）。
- 现有参数位：`model/qwen/manifest.json` `serve.ctx=8192 / n_gpu_layers=-1`（llamacpp 脚本只认
  这两键）；lmstudio.py:150 `lms load <model> --gpu max` 无 `-c`。
- `lms load qwen3.8-27b` 有歧义告警（下载目录中 2 个模型匹配该 key，加载第一个）；W7 真机验证时确认加载的是目标 GGUF，必要时改用更精确标识。
- 生效前提：8900 无热重载，runtime/config 改动需重启 8900（真机验证时执行）。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | registry：`Identity` 增 `params` 字段（runtime → 加载参数），text 本地两身份填默认档案（context=16384，裁决 R5）；解析入口暴露生效参数（供 runtime 消费）；`tests/test_llm_registry.py` 增量（+6 测） | 已实施（binding_params 暴露；identity 键含 context/ctx/ngl/fa） |
| W2 | lmstudio：`start()` 的 `lms load` 按身份参数带 `-c/--gpu/--parallel/--ttl`（缺省项保持现行为）；命令构造纯函数化便于单测 | 已实施（缺省时 argv 与旧行为逐字节一致，单测断言 `--gpu max -c 16384` 等） |
| W3 | llamacpp：脚本 `qed_qwen_service.py` 参数补全（flash-attn/batch/parallel 按参数表映射，mmproj 预留）+ `_find_llama_server` PATH→LM Studio backends 最新版回退 + 模型路径支持 `~/.lmstudio/models` 绝对引用；manifest `serve` 字段退役为兼容读取（参数事实源移身份表） | 已实施（cli 优先于 manifest serve；mmproj 同名兄弟自动挂） |
| W4 | 端口互斥（R3）：llamacpp 启动前占位检测与 `lms server stop` 让位；lmstudio 启动前 llama-server 占位清位；失败路径明确中文原因入事件账 | 已实施（双向互斥单测覆盖；让位失败/超时中文 detail；W7 真机修正：让位序列增 `lms unload --all` 前置，见 R3 行补记） |
| W5 | 监督器联动验证：恢复重启（ARCH-028 W8 路径）消费带参命令——核对 `supervisor` 重启入口是否直连 `runtime.start(settings, model)`，是则单测覆盖命令断言即可 | 已核对（supervisor.py:267 restart→operate_model→ensure_local_ready 即带参注入点；`ensure_local_ready 传参` 单测覆盖） |
| W6 | 设计节晋升：`local-model-management.md` 新增「本地模型启动参数契约」节（三层参数模型：进程层留 .env/manifest、加载层挂身份表、请求层现状声明；通道支持子集与忽略+告警规则），遵守 ADR 0017 骨架 | 已实施（2026-09-24 用户令晋升；同轮同步槽位表 llamacpp 已上线口径、lmstudio/llamacpp bullet、已知约束 8） |
| W7 | 真机验证（S1/S2 端到端：两渠道各启一次，`/api/v0/models` 与 `/props` 读回生效 ctx）+ 全量门禁 + 台账收口（qed-closeout） | 已实施（见「真机验证结果」节） |

## 验证与验收

- 定向测试：`tests/test_llm_registry.py`、`tests/test_llm_model_manager.py`、
  `tests/test_qed_qwen_service.py`、`tests/test_llm_supervisor.py`（TDD 先红后绿）。
- 真机：按 qed-frontend-check 走 8903 控制台切渠道启停（含浏览器无回归检查；本任务无 UI 改动，
  仅验证操作链路）；S1/S2 读回生效上下文数值为硬证据。
- 全量门禁：pytest 全量 + ruff + tests/contract（解释器 QED_env 3.12）。

## 真机验证结果（2026-09-24，8900 重启后 QED_env）

| 项 | 判据 | 读数 | 结论 |
| --- | --- | --- | --- |
| S1 lmstudio 带参 | `/api/v0/models` 目标模型 `state=loaded` 且 `loaded_context_length` = 表值 | qwen/qwen3.5-9b：`loaded_context_length: 16384`（max 262144） | 达成 |
| S2 llamacpp 一键 | 脚本加载 `~/.lmstudio/models` GGUF → `/v1/models` 200 + ctx 读回 | `/slots n_ctx=16384`、`/props model_path=.../Qwen3.5-9B-Q8_0.gguf`；命令行实锤 `--ctx-size 16384 --flash-attn on --port 5001`；chat 推理 200「1+1=2」 | 达成 |
| S2 让位（R3 真机） | server 常驻 + 模型已加载态下切 llamacpp → 自动让位后本渠道就绪 | `lms status` Server OFF、6944 无监听、显存无残驻（15.6GB→单模型）；90s 内 ready | 达成（触发 R3 修正，见下） |
| S1b 27B@8192（R5 改判轮） | 27B 身份参数改 8192 后真机加载并读回 | `qwen3.8-27b`（publisher=unsloth）`loaded_context_length: 8192`，显存 15.1/16GB，~60s 就绪；首轮挂死于歧义 key 交互提示（处置 3 起因），加 `-y` 后通 | 达成 |
| S3 监督器带参恢复 | 恢复重启经带参加载路径 | 单测覆盖（supervisor restart→operate_model→ensure_local_ready 注入 params）；真机触发可选未做 | 达成（单测） |
| 前端无回归 | 8903 控制台渠道显示 + 无报错 + 请求全指向 8900 | 文字渠道回显「LM Studio」、恢复态未就绪符合预期；console 无消息、8 请求全 200 | 达成 |

**真机发现与处置（1~3 为本轮代码缺陷，已 TDD 回归修复；4 为观察项）**：
1. `_build_server_cmd` 裸 `--flash-attn` 吞后续 `--mmproj` 参数致 llama-server 解析退出（rc=1）——改 `--flash-attn on`；`test_build_server_cmd_cli_params_beat_manifest` + `test_cmd_start_uses_gguf_ref_and_param_flags` 先红后绿。
2. `lms server stop` 单独不足——LM Studio 自带 `llama-server.exe` worker 残驻端口 6944 占 ~13.7GB 显存——让位序列前置 `lms unload --all`；`test_llamacpp_start_stops_lmstudio_server_first` 断言 `[["unload","--all"],["server","stop"]]` 先红后绿；R3/W4 已补记。
3. **27B@8192 轮新发现**：歧义 key（`qwen3.8-27b` 前缀匹配 unsloth 与 ISTA 两模型）使 `lms load` 进入交互式选择提示——8900 后台线程无 TTY 即挂死（180s 未就绪、无失败事件）。修复：load 命令统一追加 `-y`（LM Studio 官方脚本化旗标，歧义时取第一匹配＝本机 unsloth 目标；lms CLI 无路径式精确 key 语法，实测 `unsloth/Qwen3.8-27B-GGUF/....gguf` 与 `publisher/key` 均不识别）。**局限成文**：若日后新增更靠前缀匹配的同名模型可能选错，消歧唯一手段是保持本地 key 唯一。`test_lmstudio_start_load_with_params` 等 4 测先红后绿。
4. 异步 start 后台线程的 log 回调未接事件账（本次挂死在 `logs/config.log` 无失败行，只能直跑同款命令取证）——登记为后续观察，不在本轮修（属 ARCH-028 事件账链路）。

**恢复**：两轮验证毕 text 槽 select `runtime=default` + `model=qwen3.5-9b`（manifest 回到无 runtime 键、active 原样）、LM Studio server 重启为 ON、未加载模型（初始态）；`.env` 未改。

**门禁**：全量 pytest 569 passed + ruff（触及文件全绿）；契约 tests/contract 绿；全仓 ruff 剩 1 红 `api/axiom.py:319` B008（并行会话未提交 WIP，非本轮，只归因不代修）。

## 回滚

- 代码未提交前逐文件回退即可；参数表字段为纯增量，回退不损坏 manifest/registry 既有解析。
- 真机异常：控制台渠道切回 lmstudio（manifest runtime=default）即回现状行为。
- `lms server stop` 让位属可逆操作（LM Studio 渠道 start 会重新拉起 server）。

## 关闭与归档

- 关闭条件：S1~S5 全达成；Retain（含真机读数记录入证据列）。
- W6 设计节经用户验收后晋升；未做项（请求层默认）如需跟踪在 todo 另开支线行，不扩本任务范围。

## 关闭记录（2026-09-24）

- 用户发令「27B按照8192真机试一轮，完成之后W6设计节晋升+整轮收口转 Completed——现在执行」；
  S1~S5 全达成（真机读数与处置清单见「真机验证结果」节）。
- W6 已晋升：[local-model-management.md](../../../design/local-model-management.md)
  「本地模型启动参数契约（加载层）」节 + 同步过时口径（槽位表 llamacpp 登记可用、
  lmstudio/llamacpp bullet、已知约束 8）。
- 收口复跑门禁：全量 pytest **569 passed** + 契约 **68 passed** + ruff 触面全绿；
  全仓 ruff 剩 1 错 `api/axiom.py:319` B008 归并行会话未提交 WIP（只归因不代修）。
- 未做项承接：请求层采样默认 = 本轮非目标（范围节成文）；异步 start 线程 log 未接事件账 =
  真机验证结果节处置 4（ARCH-028 事件账链路后续观察）；均不另立 todo 行。
- 本壳转 Completed 后 Retain 归档 `docs/history/plans/2026-09/`；todo ARCH-033 行移除、
  completed.md 登 Achieved、plans/index.md 登记去处。代码未提交 git（待用户令）。
