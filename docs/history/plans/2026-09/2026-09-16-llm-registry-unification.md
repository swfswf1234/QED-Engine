# 模型注册表与三接口统一轮（llm-registry-unification）

状态：Closed（2026-09-21 关闭归档）
（2026-09-16 用户确认设计 v2 并授权开工；工作区遗留已提交 10fe43b，W1 起实施；
同日**用户确认设计 v3（控制台模型卡优化）并授权文档先行**——反转 v2 第二轮裁决 #5/#6）
任务类型：B
（任务类型注记：B 确定性实现——设计与三轮关键裁决已由用户 2026-09-16 确认，无 C 类实验内容）
最后更新：2026-09-21
关联 ADR：[ADR 0007](../../adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、[ADR 0014](../../../adr/0014-parsing-ownership-and-model-boundary.md)（维持不推翻）、ADR 0011（待评审设计随本计划承载，确定后迁 design/）
关联设计：[llm-gateway.md](../../../design/llm-gateway.md)、[local-model-management.md](../../../design/local-model-management.md)、[admin-console.md](../../../design/admin-console.md)、[api-contracts.md](../../../architecture/api-contracts.md)、[project-configuration.md](../../../design/project-configuration.md)（评审通过后由本计划工作项修订）
关联 Tracker：PLAN-046（本计划）、ARCH-023（主线），镜像见 [docs/trackers/todo.md](../../../trackers/todo.md)
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

**第三轮裁决（2026-09-16，控制台模型卡优化，设计 v3）**：

9. **反转第二轮裁决 #5/#6**：**来源（本地部署 / API 调用）与本地渠道改为槽位级可切换**
   （控制台每卡独立选择，写运行态 `manifest.json`），全局 `QED_API_SELECT` / `QED_LOCAL_RUNTIME`
   退化为**未选择时的默认值**（回到首轮裁决 #1 的槽位级语义）。
10. **渠道四项**：`默认`（=全局默认）/ `LM Studio` / `Docker`（可选）+ `llama.cpp`（待上线置灰）；
    渠道选项按槽位从注册表派生（该 runtime 有身份引用 = 登记可用，否则待上线）。
11. **可用性**：选中本地模型即探针自动判定（可用/不可用/未就绪），右侧「验证」按钮走真实小调用
    （`POST /llm/test/{slot}`）。
12. **持久化**：`model/<槽位>/manifest.json` 扩展 `source` / `runtime`（`active` 已有）。
13. **配置中心四段式命名（第四轮裁决，取代本条 v3 初稿的 `QED_LLM_*` 方案）**：`.env` 按
    **① 全局配置 / ② API 调用配置 / ③ 本地模型配置 / ④ 元数据库配置** 组织；本地模型变量统一
    `QED_LOCAL_RUNTIME` / `QED_MODEL_URL`（文字，合并 LM Studio 与 llama.cpp，默认 5001）/
    `QED_OCR_MODEL_URL`（图像，端口 8002 → 5002）/ `QED_LMSTUDIO_TOKEN` / `QED_RESOURCE_GUARD`；
    **删除** `QED_LMSTUDIO_URL` / `QED_QWEN_URL` / `QED_MINERU_URL`。跨项目变量（`QED_API_SELECT` /
    `QED_API_PROVIDER` / `API_KEY` / `QED_LLM_GATEWAY_URL` / `QED_MODEL` 等）保持不变。
14. **MinerU 端口迁移 8002 → 5002**：compose / 脚本 / 探针 / 文档同步；Axiom-Flow 直连经跨项目
    请求同步（其读键 `QED_MINERU_URL` → `QED_OCR_MODEL_URL`），**不保留别名**（其对齐前直连失效，
    风险已声明）。
15. **执行节奏（v3）**：文档先行（`.env.example` + 五份设计/架构文档 + 本计划 + todo 镜像），
    用户检验通过后再进入代码轮；提交延后到本段完成之后。

## 目标与成功标准

**目标**：三项目经 8900 三个统一接口（/llm/text、/llm/vision、/llm/embedding）透明调用三类模型；
模型注册表统一 API 与本地事实源；本地三种部署形态同化为可启停、可探测的统一 runtime；本地单活互斥。

**成功标准**：

1. `POST /llm/embedding` 可用（api text-embedding-v4），调用记录落 `qed_llm_calls`（endpoint=embedding）。
2. 文字本地链路真实冒烟：LM Studio 加载 Qwen3.8-27B → 经 `/llm/text` 调用成功（记录 provider=lmstudio）。
3. 槽位来源/渠道语义：控制台每卡可选「本地部署 / API 调用」与本地渠道；来源 = local 时文字走所选
   runtime、图像走 MinerU，启动一方自动停另一方（互斥泛化）；来源 = api 时不占 GPU；LM Studio 模型
   在 api 来源不加载。`.env` 全局值仅作默认（`QED_API_SELECT` / `QED_LOCAL_RUNTIME`）。
4. `/models/{slot}/{start|stop|restart|select}` 对 LM Studio 槽位可操作（半托管语义）；`select`
   写入 `manifest.source` / `runtime` / `active` 并生效；旧名 qwen/mineru 别名兼容不回归。
5. 未设 `QED_LOCAL_RUNTIME` / `QED_MODEL_URL` 等新变量时行为与现状一致（向后兼容，env 缺省回退）。
6. **控制台五字段卡（v3）**：来源 / 模型（按来源 × 渠道过滤 + 备注）/ 渠道（登记可用可选、
   待上线置灰）/ 可用（探针 + 验证按钮）/ 备注；选择写运行态并即时刷新。
7. **配置中心四段式（v3）**：`.env` 四段组织，本地模型变量统一命名，`.env.example` 精简；
   跨项目变量不变（MinerU 直连的 Axiom-Flow 除外，经请求同步）。
8. 门禁全绿：pytest 全量 + ruff + 契约测试 + vitest + tsc + build。

## 范围与非目标

**范围内**：`services/llm/`（新增 registry.py + runtimes）、config/.env.example 新变量、
control.py/schemas.py 端点泛化、monitor.py 探针泛化、前端 Console 三卡与 operateModel 适配、
两份 design/ 文档修订、api-contracts/code-map/project-configuration/admin-console 文档同步。
**v3 增量**：槽位级来源/渠道选择（manifest source/runtime）、注册表 `description` 与渠道选项派生、
SlotCard 五字段（来源/模型/渠道/可用/备注）、`.env(.example)` 四段式命名（`QED_LOCAL_RUNTIME` /
`QED_MODEL_URL` / `QED_OCR_MODEL_URL` 等）、
`config.py` 变量重命名、api-contracts/admin-console/local-model-management/llm-gateway 文档 v3 修订。

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
| `vision` | `mineru` | 无（回退 qwen-vl-plus） | docker: MinerU 容器（5002） | 本机已部署 |
| `embedding` | `text-embedding-v4` | qwen@dashscope | 无（预留） | api 可用 |

- 未来 llama.cpp 打包 docker 服务：新增 `llamacpp`/`docker` 本地引用即可，身份目录条目不变。
- 未来其他本地图像模型：vision 槽位加身份条目。
- 身份目录为代码内静态表（首版）；条目含 `available` 元数据（本地文件/镜像存在性）供控制台展示。

### 2. .env 四段式与模型身份解析（v3 第四轮裁决）

```ini
# ============ 一、全局配置 ============
QED_API_SELECT=api                # 默认来源：api | local（槽位 manifest.source 优先）
QED_LLM_GATEWAY_URL=http://127.0.0.1:8900
QED_LLM_TIMEOUT=300
QED_DATA_ROOT=D:\coding\QED-Engine\dataset
QED_PROXY=http://127.0.0.1:7890

# ============ 二、API 调用配置 ============
QED_API_PROVIDER=qwen             # 厂商：qwen | deepseek | glm
API_KEY=                          # 唯一密钥
QED_MODEL=qwen-plus               # 文字槽位身份
QED_OCR_MODEL=qwen-vl-plus        # 图像槽位身份
QED_EMBEDDING_MODEL=text-embedding-v4   # 向量槽位身份

# ============ 三、本地模型配置（根仓库私有）============
QED_LOCAL_RUNTIME=lmstudio        # 槽位渠道默认值：lmstudio（默认）/ llamacpp / docker
QED_MODEL_URL=http://127.0.0.1:5001/v1    # 文字模型地址（lmstudio / llamacpp 共用）
QED_OCR_MODEL_URL=http://127.0.0.1:5002   # 图像模型地址（MinerU，端口 8002→5002）
QED_LMSTUDIO_TOKEN=               # 仅 lmstudio 渠道需鉴权
QED_RESOURCE_GUARD=true           # 单活仲裁开关

# ============ 四、元数据库配置 ============
QED_DB_HOST=127.0.0.1
QED_DB_PORT=3306
QED_DB_NAME=qed
QED_DB_USER=root
QED_DB_PASSWORD=
```

**模型身份**（registry 目录条目）→ 目标解析规则（v3）：

- `api` 来源：身份的 **api 引用**（厂商 + 模型名）；身份无 api 引用时回退该槽位厂商默认模型并告警一次。
- `local` 来源：身份的**本地引用**（按槽位生效 runtime 选择）；身份无该 runtime 引用时回退槽位
  默认本地身份并告警一次。
- **来源/渠道运行态覆盖**：控制台选择经 `POST /models/{slot}/select` 写入
  `model/<槽位>/manifest.json` 的 `source` / `runtime` / `active` 字段（运行态事实源，重启保留）；
  `.env` 值（`QED_API_SELECT` / `QED_LOCAL_RUNTIME` / 身份变量）为未选择时的默认。
  解析入口集中 `registry.resolve(settings)`，gateway / model_manager / 端点层统一消费。

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

### 6. 控制台模型卡与槽位级来源/渠道（v3，第三轮裁决）

**SlotCard 五字段**（数据源 `GET /models/{slot}`）：

| 字段 | 内容 | 交互 |
| --- | --- | --- |
| 来源 | 本地部署 / API 调用（Select） | `POST /models/{slot}/select {source}` |
| 模型 | 按来源 × 渠道过滤的身份（Select，带备注） | `POST /models/{slot}/select {model}` → `manifest.active` |
| 渠道 | 本地：默认 / LM Studio / Docker / llama.cpp（待上线置灰）；API：直连 | `POST /models/{slot}/select {runtime}` |
| 可用 | 探针自动判定 + 右侧「验证」按钮 | `POST /llm/test/{slot}` 真实调用 |
| 备注 | 当前身份 `description` | — |

- **注册表**：`Identity` 增加 `description`；渠道选项按槽位派生（该 runtime 有身份引用 = available，
  否则 pending）；模型选项按来源 × 渠道过滤。
- **manifest.json 扩展**：`source` / `runtime` / `active`（v3 语义见 local-model-management.md）。
- **端点**：`POST /models/{slot}/select` body 扩展 `{source?, runtime?, model?}`（至少一项，向后兼容）；
  `GET /models/{slot}` 增加 `source` / `channel` / `description` / `availability` /
  `source_options` / `channel_options`；`options` 升级为 `[{value,label,description}]`。
- **启停判定**：按槽位生效来源（`manifest.source` > `QED_API_SELECT`）——api → 409，local → 允许。
- **env**：根私有变量四段式统一命名（`QED_LOCAL_RUNTIME` / `QED_MODEL_URL` / `QED_OCR_MODEL_URL`）；跨项目变量不变。

**控制台需求（admin-console.md 同步）**：见上表；向量卡无本地候选（来源固定 api，仅验证）。

## 前置条件

1. **develop 工作区未提交改动处理**（PLAN-042/045 收尾产物大量未提交）——需用户先提交或明确
   处理方式，避免与本轮改动混叠（阻塞项，责任位置：用户）。
2. LM Studio 本机可用：server 可启动、两个 Qwen 模型已下载（探索已确认存在）。
3. MinerU 容器现状可用（PLAN-045 已验证）。

## 工作项

| # | 工作项 | 产出 |
| --- | --- | --- |
| W1 | 后端注册表与配置 | `registry.py`（身份目录 + 槽位解析 + 运行态 manifest.active 消费）、`config.py` 新变量（v2 旧名，v3 四段式见 W9）、`.env.example` 修订（TDD：test_llm_registry.py、test_config.py） |
| W2 | runtime 同化 | `runtimes/`（lmstudio 半托管 / llamacpp / docker）+ model_manager 单活互斥泛化（TDD：test_llm_model_manager.py 扩展 N 槽位互斥） |
| W3 | 网关与客户端 | gateway 全局渠道路由 + 身份解析消费、`clients.embeddings` 新增（TDD：test_llm_gateway.py、test_llm_clients.py） |
| W4 | 端点层 | /llm/embedding、/llm/test/embedding、/models 槽位泛化（start/stop/restart/select/GET 状态）+ 别名、/monitor 泛化、schemas.py（TDD：test_llm_endpoints.py） |
| W5 | 前端 | Console 三卡（渠道与可用状态备注 + local 模式模型下拉 + 向量卡测试按钮）、runtime.ts、llm.ts（vitest + tsc + build） |
| W6 | 文档同步 | 两份 design/ 修订（设计要点迁入）、api-contracts.md、project-configuration.md、admin-console.md、code-map.md；control.py:148 过期注释随 W4 修复并登记 design-bugfix-log.md |
| W7 | 门禁与真实冒烟 | 全量门禁；冒烟脚本：LM Studio 文字链路（Qwen3.8-27B）、互斥（text↔vision）、embedding API、text=api+vision=local 混合 |
| W8（v3） | **文档轮（先行，本段）** | `.env.example` 四段式重写（`QED_LOCAL_RUNTIME` / `QED_MODEL_URL` / `QED_OCR_MODEL_URL` / `QED_LMSTUDIO_TOKEN` / `QED_RESOURCE_GUARD`）；llm-gateway / local-model-management / admin-console / project-configuration / api-contracts 五份文档 v3 修订；MinerU 端口 8002→5002 文档同步；本计划 v3 + todo 镜像（含 Axiom-Flow 跨项目请求）。**用户检验后再进入 W9** |
| W9（v3） | **代码轮（v3 增量）** | `registry.py`（Identity.description + 渠道选项派生 + manifest source/runtime 读写 + options 过滤）、`schemas.py`（SlotStatus/ModelSelectRequest 扩展）、`control.py`（GET/select 扩展 + 启停按槽位来源）、`config.py`（四段式变量：`qed_model_url`/`qed_ocr_model_url` 等）、`scripts/text-model`（`QED_MODEL_URL`）、`scripts/image-model`（`QED_OCR_MODEL_URL` + compose 端口 5002）、`monitor.py`、前端 `stores`/`api`/`Console.tsx`（五字段卡）、测试更新 |
| W10（v3） | **门禁与冒烟（v3）** | 全量门禁 + 五字段卡交互冒烟（来源/渠道切换、模型过滤、探针可用性、验证按钮） |

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

## W7/W10 冒烟与收口（2026-09-21，本计划终局）

- **W10 五字段卡（浏览器实测，8903 dist 9-20 22:15）**：来源/渠道/模型三下拉齐全；
  渠道四项（默认/LM Studio 可用、Docker/llama.cpp「待上线」置灰）；模型下拉按来源×渠道过滤
  （local 仅 qwen3.8-27b/qwen3.5-9b）；验证按钮正负路径均真（LM Studio 未起→「不可用」，
  向量卡→「验证通过」）；请求全部仅指向 8900。视口隐藏无法截图，交互证据为 a11y 快照 + DOM 读取。
- **W7-1 文字链路**：`/models/text/start` 半托管拉起 server + 加载 qwen3.5-9b → 首测 401，
  根因 8900 启动快照早于 `.env` 修改（既有已知坑），`/self-restart` 后探针可用，
  `/llm/text` 真实生成「2」（call_id 40）。附注：思考型模型 `max_tokens=80` 会被推理 token
  吃满返回空 reply（机制正常，属模型行为），400 预算下正常。
- **W7-2 单活互斥**：双向验证——text restart 时守卫先停 vision（MinerU 停），vision start
  时 text 被卸载（ready false）；`QED_RESOURCE_GUARD` 语义与 §互斥 设计一致。
- **W7-3 embedding**：向量卡「验证」→ 通义 text-embedding-v4 真实调用通过。
- **W7-4 混合**：首轮发现 qwen-plus 403（key 未开通）→ 用户裁决「就是要用 deepseek 模型」→
  [BUGFIX-008](../../../plans/design-bugfix-log.md)：身份表补 `deepseek-v4-flash-0731` + api 回退链插入
  `.env` 已注册身份一段（TDD 3 红→绿）；复测 text=api 走 DashScope 托管 deepseek 成功
  （call_id 43），vision 同时保持 local 在跑——混合场景成立。
- **终态**：text source=local（LM Studio server 保留、模型已卸载，互斥下由 vision 占卡）、
  vision docker 在跑（5002 healthy）、embedding api 可用。
- **门禁**：`pytest tests -q` **500 passed**；`tests/contract` 63 passed；`ruff` 全绿；
  本轮无前端改动（tsc/vitest/build 沿用 2026-09-20 收口结果：192 passed + 构建通过）。
- **关闭**：成功标准全达成（W1–W10），2026-09-21 用户授权收口，计划壳归档
  `../history/plans/2026-09/`。
