# 模型注册表与三接口统一轮（llm-registry-unification）

状态：Accepted
（评审注记：三项关键裁决已由用户 2026-09-16 拍板，见「背景与用户裁决」节；本计划经用户评审通过后转 In Progress）
任务类型：B
（任务类型注记：B 确定性实现——设计与三项关键裁决已由用户 2026-09-16 确认，无 C 类实验内容）
最后更新：2026-09-16
关联 ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)（维持不推翻）、ADR 0011（待评审设计随本计划承载，确定后迁 design/）
关联设计：[llm-gateway.md](../design/llm-gateway.md)、[local-model-management.md](../design/local-model-management.md)、[admin-console.md](../design/admin-console.md)、[api-contracts.md](../architecture/api-contracts.md)、[project-configuration.md](../design/project-configuration.md)（评审通过后由本计划工作项修订）
关联 Tracker：PLAN-046（本计划）、ARCH-023（主线），镜像见 [docs/trackers/todo.md](../trackers/todo.md)
归档判定：Retain（设计事实并入上述两份 design/ 文档后，计划壳归档 history/plans/2026-09/）

## 背景与用户裁决（2026-09-16）

现状探索结论（同日完成）：三类模型管线中 text API ✅ / text 本地 ❌（llama-server 未装、槽位空）/
vision api ✅ local ✅（MinerU 已部署）/ embedding 全空白；API 注册表（`clients.PROVIDERS`）与
本地模型表（`model_manager.MODEL_SCRIPTS`）两分离，互斥为两两硬编码；LM Studio 已被 PLAN-042
移除命名但本机仍在用（Qwen3.5-9B、Qwen3.8-27B 均带 mmproj）。

用户裁决：

1. **槽位级 source**：text/vision/embedding 各自独立选 api|local；`QED_API_SELECT` 退化为批量默认。
2. **LM Studio 半托管**：探活 + REST API v0 加载/卸载模型（卸载释放显存）；server 未起尝试
   `lms server start`，CLI 不在则报明确原因。
3. **全量一轮**：注册表 + 三 runtime + 互斥泛化 + /llm/embedding + 端点泛化 + 前端适配一次收口。
4. 其余既定口径：api 文字先用 qwen 系；本地部署三形态（LM Studio / llama.cpp / docker）同化为
   统一「本地模型」语义（启停/服务/后续 AGENT、MCP 同方式配置）；资源互斥保证本地同时只有一个
   模型（最关键约束）；双 Qwen 同槽位单活；ADR 0014 解析直连维持，本轮只细化不推翻；文本链路
   优先保证完整可用。

**第二轮裁决（2026-09-16，计划评审反馈）**：

5. **.env 收敛**——取消槽位级 source 变量（QED_TEXT_SOURCE 等不入 .env）；全局只新增一个变量
   `QED_LOCAL_RUNTIME`（规划本地模型经 lmstudio / llamacpp / docker 何种方式加载）；模型参数
   每槽位保持一个变量、值统一为**模型身份**（不分 api/local 两套），身份 → 目标的映射归注册表。
6. **渠道粒度取全局模式**：api/local 仍由全局 `QED_API_SELECT` 决定，控制台三卡**展示**渠道与
   可用状态，不做槽位级切换（与 ADR 0014 兼容，实现最简）。
7. **控制台需求**：三卡备注显示渠道（api / lmstudio / llama.cpp / docker）与模型可用状态
   （是否可用）；local 模式下模型下拉可选（选择经 8900 写入运行态 `manifest.active`）。
8. **执行节奏**：用户已授权修订设计文档；代码层实施待用户对文档确认后执行。

## 目标与成功标准

**目标**：三项目经 8900 三个统一接口（/llm/text、/llm/vision、/llm/embedding）透明调用三类模型；
模型注册表统一 API 与本地事实源；本地三种部署形态同化为可启停、可探测的统一 runtime；本地单活互斥。

**成功标准**：

1. `POST /llm/embedding` 可用（api text-embedding-v4），调用记录落 `qed_llm_calls`（endpoint=embedding）。
2. 文字本地链路真实冒烟：LM Studio 加载 Qwen3.8-27B → 经 `/llm/text` 调用成功（记录 provider=lmstudio）。
3. 全局渠道语义保持：`QED_API_SELECT=local` 时文字走本地 runtime、图像走 MinerU，启动一方自动停
   另一方（互斥泛化）；`=api` 时全部走 API、不占 GPU；LM Studio 模型在 api 模式不加载。
4. `/models/{slot}/{start|stop|restart|select}` 对 LM Studio 槽位可操作（半托管语义）；模型下拉
   选择写入 `manifest.active` 并生效；旧名 qwen/mineru 别名兼容不回归。
5. 未设 `QED_LOCAL_RUNTIME` 等新变量时行为与现状一致（向后兼容，env 缺省回退）。
6. 门禁全绿：pytest 全量 + ruff + 契约测试 + vitest + tsc + build。

## 范围与非目标

**范围内**：`services/llm/`（新增 registry.py + runtimes）、config/.env.example 新变量、
control.py/schemas.py 端点泛化、monitor.py 探针泛化、前端 Console 三卡与 operateModel 适配、
两份 design/ 文档修订、api-contracts/code-map/project-configuration/admin-console 文档同步。

**非目标**：

- 不推翻 ADR 0014（Axiom-Flow 解析直连 MinerU 不经网关，本轮不改）。
- 不实现 AGENT/MCP OpenAI 兼容反代面（roadmap 预留登记即可）。
- 不实现本地向量模型（embedding 槽位 local=None 预留）。
- 不迁移 LM Studio 模型文件（留在 `~/.lmstudio/`，注册表只引用）；不动 `model/` 槽位目录约定。
- 不改 `qed_llm_calls` 表结构（endpoint=embedding 已支持）。
- 不动子项目仓库（其 llm_client.py 网关模式调用形状不变，零改动）。

## 设计要点（待评审，确定后迁 design/）

### 1. 统一模型注册表（`services/llm/registry.py`，唯一事实源）

注册表 = **身份目录**（模型身份 → api 引用 / 本地引用 / 可用性 / 渠道标签）+ **槽位解析**（身份 ×
渠道 × runtime → 具体端点与模型名）。首版身份目录：

| 槽位 | 身份 | api 引用 | 本地引用（runtime: 标识） | 可用性 |
| --- | --- | --- | --- | --- |
| `text` | `qwen-plus` | qwen@dashscope | 无 | api 可用 |
| `text` | `qwen3.8-27b` | 无（回退 qwen-plus） | lmstudio: unsloth/Qwen3.8-27B-GGUF | 本机已下载 |
| `text` | `qwen3.5-9b` | 无（回退 qwen-plus） | lmstudio: lmstudio-community/Qwen3.5-9B-GGUF | 本机已下载 |
| `vision` | `qwen-vl-plus` | qwen@dashscope | 无 | api 可用 |
| `vision` | `mineru` | 无（回退 qwen-vl-plus） | docker: MinerU 容器（8002） | 本机已部署 |
| `embedding` | `text-embedding-v4` | qwen@dashscope | 无（预留） | api 可用 |

- 未来 llama.cpp 打包 docker 服务：新增 `llamacpp`/`docker` 本地引用即可，身份目录条目不变。
- 未来其他本地图像模型：vision 槽位加身份条目。
- 身份目录为代码内静态表（首版）；条目含 `available` 元数据（本地文件/镜像存在性）供控制台展示。

### 2. .env 收敛与模型身份解析（第二轮裁决后）

```ini
# ============ 模型模式与密钥（现状保留）============
QED_API_SELECT=api|local          # 全局渠道：api（默认）/ local（唯一 source 语义，不加槽位变量）
QED_API_PROVIDER=qwen             # api 模式厂商
API_KEY=                          # 唯一密钥

# ============ 本地模型（唯一新增全局变量）============
QED_LOCAL_RUNTIME=lmstudio        # 本地模型加载方式：lmstudio（默认）/ llamacpp / docker
QED_LMSTUDIO_URL=http://127.0.0.1:1234/v1   # LM Studio OpenAI 兼容地址

# ============ 模型身份（每槽位一个变量，值不分 api/local）============
QED_MODEL=qwen3.8-27b             # 文字槽位身份
QED_OCR_MODEL=qwen-vl-plus        # 图像槽位身份
QED_EMBEDDING_MODEL=text-embedding-v4   # 向量槽位身份
```

**模型身份**（registry 目录条目）→ 目标解析规则：

- `api` 模式：身份的 **api 引用**（厂商 + 模型名）；身份无 api 引用时回退该槽位厂商默认模型并告警一次。
- `local` 模式：身份的**本地引用**（按 `QED_LOCAL_RUNTIME` 选择 runtime 与模型标识）；身份无本地
  引用时回退槽位默认本地身份并告警一次。
- **运行态覆盖**：控制台模型下拉选择经 `POST /models/{slot}/select` 写入
  `model/<槽位>/manifest.json` 的 `active` 字段（运行态事实源，重启保留）；`.env` 身份变量为
  未选择时的默认值。解析入口集中 `registry.resolve(settings)`，gateway / model_manager / 端点层统一消费。

### 3. runtime 同化（`services/llm/runtimes/`）

```python
class LocalRuntime(Protocol):
    def probe(settings) -> bool          # 就绪 =「模型可用」而非仅进程存活
    def start(settings) -> Result        # 幂等；失败返回明确中文原因
    def stop(settings) -> Result         # 释放显存/进程
```

- **lmstudio**（半托管）：probe = `GET /v1/models` 含目标模型；start = server 未起尝试
  `lms server start`（PATH 探测）+ REST API v0 加载模型；stop = REST API v0 卸载模型（server 进程保留）。
  REST v0 具体端点以本机 LM Studio 版本实测为准（冒烟时核对并登记进 design 文档）。
- **llamacpp**：现 `scripts/text-model/qed_qwen_service.py`（manifest → llama-server）平移，脚本保留 CLI。
- **docker**：现 `scripts/image-model/qed_mineru_service.py`（infra-*.ps1）平移，脚本保留 CLI。
- adapter 内部实现方式不限定（llamacpp/docker 可继续 subprocess 调生命周期脚本，lmstudio 走 HTTP/CLI）。

### 4. 资源互斥泛化（单活仲裁）

`ensure_local_ready(slot)`：目标已就绪 → 返回；`QED_RESOURCE_GUARD=true` → 遍历注册表**其他全部
本地候选槽位**，在跑的一律 stop（LM Studio 按模型已加载判定），再 start 目标。本地同时最多一个模型。

### 5. 端点契约（评审通过后登记 api-contracts.md）

| 端点 | 变化 |
| --- | --- |
| `POST /llm/embedding`（新增） | `{input: [str], }` → `{embeddings, model, call_id}`；prompt 记 JSON 输入，response 记维度摘要（不存向量本体） |
| `POST /llm/test/embedding`（新增） | 控制台测试按钮 |
| `POST /models/{slot}/{start\|stop\|restart}` | slot ∈ {text, vision}；旧名 qwen/mineru 别名过渡（deprecated） |
| `POST /models/{slot}/select`（新增） | `{model: <身份>}` 写入运行态 `manifest.active`；local 模式控制台模型下拉用 |
| `GET /models/{slot}`（新增） | 槽位状态：当前身份 / 渠道 / runtime / 可用性（控制台三卡数据源） |
| `GET /monitor/{slot}` | 泛化探针（text/vision；旧 qwen/mineru 别名） |
| `/llm/text`、`/llm/vision` | 请求/响应形状不变，内部按全局渠道 + 注册表解析路由 |

call_log provider 取值扩为 qwen/deepseek/glm/lmstudio/llamacpp/mineru/gateway。

**控制台需求（admin-console.md W6 同步）**：三卡备注显示渠道（api / lmstudio / llama.cpp / docker）
与模型可用状态（注册表 available + 探针结果）；local 模式下文字/图像卡显示模型下拉（可选身份列表 +
当前 active），选择即调 `/models/{slot}/select`；启停/测试按钮保留。

## 前置条件

1. **develop 工作区未提交改动处理**（PLAN-042/045 收尾产物大量未提交）——需用户先提交或明确
   处理方式，避免与本轮改动混叠（阻塞项，责任位置：用户）。
2. LM Studio 本机可用：server 可启动、两个 Qwen 模型已下载（探索已确认存在）。
3. MinerU 容器现状可用（PLAN-045 已验证）。

## 工作项

| # | 工作项 | 产出 |
| --- | --- | --- |
| W1 | 后端注册表与配置 | `registry.py`（身份目录 + 槽位解析 + 运行态 manifest.active 消费）、`config.py` 新变量（QED_LOCAL_RUNTIME / QED_LMSTUDIO_URL）、`.env.example` 修订（TDD：test_llm_registry.py、test_config.py） |
| W2 | runtime 同化 | `runtimes/`（lmstudio 半托管 / llamacpp / docker）+ model_manager 单活互斥泛化（TDD：test_llm_model_manager.py 扩展 N 槽位互斥） |
| W3 | 网关与客户端 | gateway 全局渠道路由 + 身份解析消费、`clients.embeddings` 新增（TDD：test_llm_gateway.py、test_llm_clients.py） |
| W4 | 端点层 | /llm/embedding、/llm/test/embedding、/models 槽位泛化（start/stop/restart/select/GET 状态）+ 别名、/monitor 泛化、schemas.py（TDD：test_llm_endpoints.py） |
| W5 | 前端 | Console 三卡（渠道与可用状态备注 + local 模式模型下拉 + 向量卡测试按钮）、runtime.ts、llm.ts（vitest + tsc + build） |
| W6 | 文档同步 | 两份 design/ 修订（设计要点迁入）、api-contracts.md、project-configuration.md、admin-console.md、code-map.md；control.py:148 过期注释随 W4 修复并登记 design-bugfix-log.md |
| W7 | 门禁与真实冒烟 | 全量门禁；冒烟脚本：LM Studio 文字链路（Qwen3.8-27B）、互斥（text↔vision）、embedding API、text=api+vision=local 混合 |

## 验证与验收

- **定向测试**：test_llm_registry.py（新）、test_llm_model_manager.py、test_llm_gateway.py、
  test_llm_clients.py、test_llm_endpoints.py、test_config.py、web-ui Console.test.tsx。
- **回归**：`pytest tests -q` + `ruff check backend tests scripts` + `tests/contract/` +
  `npx tsc -b` + vitest + build（development.md 完整门禁）。
- **不能自动化的人工验收**：真实冒烟四场景（W7）由用户在控制台/浏览器确认，责任位置：用户。
- **外部依赖**：LM Studio REST v0 端点实测以本机版本为准；若与预期不符，以实际行为修订设计文档并记录证据。

## 回滚

- 纯代码 + 文档变更，git revert 即可；无数据库迁移、无数据操作。
- `.env` 新变量全部有缺省值（`QED_LOCAL_RUNTIME` 缺省 lmstudio；身份变量缺省沿用现状默认模型），
  回滚后旧语义自动恢复。
- 前端与端点别名保证过渡期新旧名并存，回滚不破坏子项目调用（子项目本就不受影响）。

## 关闭与归档

- 关闭条件：成功标准 6 条全达成 + 用户冒烟验收确认。
- 收尾：设计事实并入 llm-gateway.md / local-model-management.md（两份文档刷新「最后更新」与状态），
  completed.md 登记，计划壳按 Retain 归档 history/plans/2026-09/，roadmap 补 AGENT/MCP 反代预留方向。
