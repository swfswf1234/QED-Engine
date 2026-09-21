# 本地模型管理设计（local-model-management）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-21
确认状态：已确认
关联代码：`backend/qed_engine/services/llm/model_manager.py`、`scripts/text-model/`、`scripts/image-model/`、`model/`（根模型文件目录）、`web-ui/src/stores/runtime.ts`（operateModel/selectModel/fetchSlots）、`web-ui/src/api/llm.ts`（operateModel/selectModel/getSlotStatus。注册表 `services/llm/registry.py` 主登记见 [llm-gateway.md](llm-gateway.md)、runtimes/ 适配器见本设计「槽位与 runtime」节，均在「关键组件文件」表引用；控制域路由注册与模型探针见 [api-contracts](../architecture/api-contracts.md)，不重复登记）
关联测试：`tests/test_llm_model_manager.py`、`tests/test_llm_endpoints.py`、`web-ui/src/pages/Console.test.tsx`
关联 ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0005](../history/adr/v0.1/0005-control-center-service-hosting.md)、[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)
关联设计：[llm-gateway.md](llm-gateway.md)（网关/调用记录/全局模式/身份目录——分工见下）、[admin-console.md](admin-console.md)（控制台三区）、[dataset-conventions.md](dataset-conventions.md)（数据目录约定）
关联计划：[PLAN-046](../history/plans/2026-09/2026-09-16-llm-registry-unification.md)（定档来源）、[2026-09-06-console-refactor](../history/plans/2026-09/2026-09-06-console-refactor.md)（晋升来源）

## 背景与定位

本地模型（文字：Qwen / LM Studio / llama.cpp；图像：MinerU）的生命周期管理提供**可操作**入口：
启动/停止/重启 + 测试 + 显存摘要 + 来源/渠道/模型选择。本设计定义操作入口、模型文件目录与
容器编排；**模型调用网关、api/local 路由、调用记录、身份目录不在本文件**（归 llm-gateway.md）。

分工边界：

- **网关/路由/调用记录/来源渠道解析/身份目录**：`llm-gateway.md`（/llm/text /llm/vision /llm/embedding）。
- **runtime 同化/生命周期操作/模型文件/编排**：本文件（/models/{slot}、model/ 目录、runtimes/）。
- **UI 展示（三区 · 槽位卡五字段）**：`admin-console.md`。

核心原则：无论经 LM Studio、llama.cpp 还是 docker 部署，都同化为统一的
「本地模型」进行启停与服务，后续 AGENT、MCP 等以同样方式配置；资源互斥保证本地同时只有一个
模型在跑（最关键约束）。

## 槽位与 runtime（来源/渠道槽位级）

| 槽位（slot） | 类别 | api 身份 | 本地渠道选项（默认 → 可选） | 探针 | 测试端点 |
| --- | --- | --- | --- | --- | --- |
| `text` | 文字 | qwen-plus | 默认（=全局 `QED_LOCAL_RUNTIME`）；**LM Studio 登记可用**；Docker / llama.cpp 待上线 | `GET /monitor/text`（旧 `/monitor/qwen` 别名） | `POST /llm/test/text` |
| `vision` | 图像 | qwen-vl-plus | 默认（=docker）；**Docker（MinerU）登记可用**；LM Studio / llama.cpp 待上线 | `GET /monitor/vision`（旧 `/monitor/mineru` 别名） | `POST /llm/test/vision` |
| `embedding` | 向量 | text-embedding-v4 | 无本地候选（全待上线；**来源固定 api，全局 local 不影响**） | — | `POST /llm/test/embedding` |

- **来源（source）**：`api` | `local`，槽位级运行态（`manifest.source`）> 全局 `QED_API_SELECT` 默认。
- **渠道（runtime）**：仅 `local` 来源有意义，槽位级运行态（`manifest.runtime`）> 槽位默认
  runtime（`text` = `QED_LOCAL_RUNTIME`，`vision` = `docker`）。`api` 来源渠道显示「直连」。
- **渠道选项**（控制台下拉，从注册表派生）：该 runtime 在槽位下有身份引用 = 登记可用，否则
  待上线（置灰不可选）。新增部署形态 = 注册表加身份本地引用，渠道选项自动出现。

- **runtime 同化接口**（`services/llm/runtimes/`）：三种部署形态各实现同一接口，`model_manager`
  只面向接口，不感知部署细节：

```python
class LocalRuntime(Protocol):
    def probe(self, settings, model: str = "") -> bool                 # 就绪 =「模型可用」而非仅进程存活
    def start(self, settings, model: str = "", ...) -> RuntimeResult   # 幂等；ok=False 时 detail 为明确中文原因
    def stop(self, settings, model: str = "", ...) -> RuntimeResult    # 释放显存/进程
```

- **lmstudio（半托管）**：probe = `GET /api/v0/models`（REST v0）且 `state == "loaded"` 的模型
  含当前身份（`/v1/models` 列**全量已下载**模型，不能当已加载判定）；start = server 未起时
  尝试 `lms server start`（PATH 探测，失败报明确原因）→ 先 `lms unload` 其他已加载模型
  （单活 + 显存释放）→ `lms load <模型key> --gpu max`（幂等）；stop = `lms unload`（全量释放用
  `lms unload --all`），server 进程本身由 LM Studio 自管，不杀。REST API v0 **无 load/unload
  端点**，生命周期一律走 `lms` CLI；LM Studio 开启 API token 认证时探活请求经
  `QED_LMSTUDIO_TOKEN` 带 Bearer（密钥只存 .env）。
- **llamacpp**：现 `scripts/text-model/qed_qwen_service.py`（manifest → llama-server 进程）平移，
  脚本保留 CLI 入口（start/stop/restart/status）。
- **docker**：现 `scripts/image-model/qed_mineru_service.py`（infra-*.ps1 + compose）平移，
  脚本保留 CLI 入口。未来 llama.cpp 打包 docker 服务复用本 runtime（新增一份 compose）。

> **OCR 引擎槽位（[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)）**：
> vision 槽位本地候选按引擎扩展——当前引擎为 `mineru`，PaddleOCR-VL 等接入时新增引擎身份条目
> （模型槽位 `model/<引擎>/`）；控制台依赖组件卡展示当前生效 OCR 引擎。**模型生命周期归 8900，
> 解析调用不归**——Axiom-Flow 解析管线经引擎适配器直连模型服务，8900 只负责启停、探针与资源互斥
> （换引擎不改 8900 调用链）。

## 统一操作入口：operate_model(slot, op)

```python
# 槽位 → runtime 适配器（槽位级，不硬编码部署单元）
SLOT_RUNTIMES = {"text": <槽位渠道解析：manifest.runtime > QED_LOCAL_RUNTIME>, "vision": docker_runtime, "embedding": None}

def operate_model(slot: str, op: str) -> dict:
    # start/restart：ensure_local_ready(slot)（单活互斥已含，QED_RESOURCE_GUARD）
    # stop：直调 runtime.stop（LM Studio=卸载模型；llamacpp=停进程；docker=compose down）
    # 未知 slot / op：抛 ValueError（端点层映射 404）
```

规则：

- **start/restart 复用 ensure_local_ready**：单活互斥语义（见下）由其生效，不重复实现。
- **stop 直调 runtime**：不经过就绪检查。
- **select**：独立端点 `POST /models/{slot}/select`（不走 operate_model）经
  `registry.set_manifest_active(slot, identity)` 写 `model/<slot>/manifest.json` 的 `active`
  字段（运行态事实源）。校验仅限「槽位支持运行态选择 + 身份属于该槽位」——未知槽位/身份、
  embedding → 404；**api/local 渠道均可写**（运行态在下次 local 调用/启动时生效），不校验本地
  引用归属（api-only 身份也可选，渠道解析按注册表回退规则兜底）。
- 返回值统一：`{ slot, op, ok, ... }`（实际以 model_manager 实现为准，端点层再包一层 409/404 语义）。

## 端点契约：/models/{slot}（8900 聚合）

| 端点 | 语义 | 非 200 分支 |
| --- | --- | --- |
| `POST /models/{slot}/start` | 启动本地模型（槽位来源 = local） | 槽位来源 api → 409；未知 slot → 404 |
| `POST /models/{slot}/stop` | 停止本地模型 | 同上 |
| `POST /models/{slot}/restart` | 重启本地模型 | 同上 |
| `POST /models/{slot}/select` | 写运行态 `manifest`：`{source?, runtime?, model?}`（至少一项；`{model}` 向后兼容） | 未知槽位/身份/runtime、embedding 写运行态 → 404 |
| `GET /models/{slot}` | 槽位状态：来源 / 渠道 / 身份 / 模型 / 可用性 / 备注 / 选项 | 未知 slot → 404 |

- **来源判定按槽位生效值**：槽位来源（`manifest.source` > 全局 `QED_API_SELECT`）为 `api`
  时启停端点返回 409（「该槽位为 api 来源，本地模型仅支持测试」）；为 `local` 时允许启停。
  控制台据此渲染启停按钮（来源为 local 才显示）。
- **select 不受来源限制**（运行态选择两来源均可写）：写 `manifest.source` / `manifest.runtime` /
  `manifest.active`；`embedding` 无运行态 manifest → 404。
- **未知 slot**：start/stop/restart 仅 `text`/`vision`；GET 支持 `text`/`vision`/`embedding`。
- **旧名别名**：`qwen` → text、`mineru` → vision（deprecated，过渡期保留，响应注记提示新名）。
- 全部经 8900 聚合（ADR 0007）：前端不直连本地模型端口或脚本宿主。

## 控制台需求（UI 细节归 admin-console.md）

三卡（文字/图像/向量）五字段，数据源 `GET /models/{slot}`（`GET /config/models` 保留为路由表）：

1. **来源**：Select「本地部署 / API 调用」，选择即 `POST /models/{slot}/select {source}` 写运行态。
2. **模型**：Select 按「来源 × 渠道」过滤的注册表身份，选项带一句话备注；选择即写 `manifest.active`。
3. **渠道**：来源 = 本地时 Select「默认 / LM Studio / Docker / llama.cpp(待上线置灰)」（登记可用
   可选、待上线置灰）；来源 = API 时显示「直连」。
4. **可用**：探针自动判定（选中后刷新即显示 可用 / 不可用 / 未就绪）；右侧「验证」按钮 →
   `POST /llm/test/{slot}` 真实小调用，反馈成功/失败 + 原因。
5. **备注**：当前身份 `description`（一句话介绍）。

- 启停/重启按钮保留（来源 = local 才渲染，单活仲裁）；向量卡无本地候选（来源固定 api，仅验证）。

## 模型文件目录与 manifest 约定

根 `model/` 为**模型文件唯一事实库**（git 忽略，仅保留骨架）；**LM Studio 模型不迁移**，留在
`~/.lmstudio/models/` 由注册表本地引用（runtime 标识）。

```text
model/
├── qwen/                  # 文字槽位模型文件（llama.cpp/docker runtime 用）
│   ├── manifest.json      # active = 运行态身份 + serve 参数
│   └── <模型目录>/         # 具体 GGUF（llama-server 加载）
└── mineru/                # 图像槽位模型文件（docker runtime 用）
    ├── manifest.json      # active = 登记性（MinerU 运行时以 compose 挂载为准）
    └── <模型目录>/         # 具体权重（modelscope / hf）
```

**manifest.json 约定**：

```json
{
  "active": "<身份名>",
  "source": "local",
  "runtime": "lmstudio",
  "serve": {
    "port": 5001,
    "ctx": 8192,
    "n_gpu_layers": -1
  }
}
```

- `active`：**运行态事实源**——当前生效的模型身份（注册表身份名；lmstudio 身份无需本地目录；
  空字符串 = 未选择，回退 `.env` 身份变量默认值）。控制台模型下拉经 `/models/{slot}/select`
  写入；生命周期与网关解析（registry）消费。
- `source`：**槽位来源运行态**——`api` | `local`；空 = 未选择，回退全局 `QED_API_SELECT`。
- `runtime`：**槽位本地渠道运行态**——`lmstudio` | `llamacpp` | `docker`；空 = 未选择，
  回退槽位默认 runtime（`text` = `QED_LOCAL_RUNTIME`，`vision` = `docker`）。
- `serve`：服务启动参数（llamacpp runtime 的 llama-server 读取；docker runtime 以 compose 为准）。
- **换模型/来源/渠道只改 manifest（控制台）或身份目录（代码）**：不动 env、不动 gateway/clients 调用链。
- **参数解耦**：env 只存端点与全局默认（`QED_LOCAL_RUNTIME` / `QED_MODEL_URL` /
  `QED_OCR_MODEL_URL`），模型身份变量（`QED_MODEL` 等）值不分 api/local，由注册表解析。
- **MinerU manifest 为登记性**：MinerU 容器实际模型路径由 compose 卷挂载 + 镜像内
  `/root/mineru.json` 决定（见下节），`manifest.active` 不参与容器运行时，不强行统一。

**当前 manifest 骨架**：
- `model/qwen/manifest.json`：`{ "active": "", "serve": { "port": 5001, "ctx": 8192, "n_gpu_layers": -1 } }`
- `model/mineru/manifest.json`：`{ "active": "", "serve": { "port": 5002, "model_source": "local" } }`

**模型文件结构**：
- `.gitignore`：`/model/*` 忽略全部内容（目录骨架经 `.gitkeep` 保留）。
- 下载脚本：`scripts/image-model/download-models.py`（MinerU 权重）。
  - `-s/--source`：modelscope（默认）/ hf
  - `-m/--model`：指定模型名，默认 all（全部）
  - `--target`：输出目录（默认 `model/mineru`）
  - PowerShell 示例：`python scripts/image-model/download-models.py -s modelscope`（QED_env）
- llama.cpp 路径：llama-server 从 `model/qwen/<模型目录>/` 加载（OpenAI 兼容端口 5001）。
- LM Studio 路径：模型在 `~/.lmstudio/models/<发布者>/<模型名>-GGUF/`，注册表按身份记录
  runtime 标识（lms CLI 的模型 key，如 `qwen3.8-27b`、`qwen/qwen3.5-9b`——**不是**磁盘目录的
  `发布者/xxx-GGUF` 路径），不做文件搬运。

## MinerU 容器部署

**模型文件不入镜像，宿主卷挂载**（避免重建反复下载）：

- `scripts/image-model/docker/Dockerfile`：只含运行时依赖，不含模型下载步骤。
- `scripts/image-model/docker/mineru.json`：**COPY 进镜像 `/root/mineru.json`**——MinerU 在
  `MINERU_MODEL_SOURCE=local` 时读该配置的 `models-dir`（`pipeline`/`vlm`），**不读**
  `MINERU_MODELS_DIR` 环境变量；指向挂载点下的 `PDF-Extract-Kit-1.0` / `MinerU2.5-Pro-2605-1.2B`。
- `scripts/image-model/compose.yaml`：卷挂载 `../../model/mineru:/root/mineru_models`，
  宿主端口映射 **5002**。
- 首次准备：`download-models.py` 下载权重到 `model/mineru/`，再 `docker build` + `infra-up.ps1`。
- **健康端点**：`GET http://127.0.0.1:5002/health`（**不是** `/api/v1/health`）。
- Axiom-Flow 直连地址读根 `.env` 的 `QED_OCR_MODEL_URL`
  （见 [llm-gateway.md](llm-gateway.md) 与 [project-configuration.md](project-configuration.md)）。

## 资源互斥与模式（单活仲裁）

- **本地单活（最关键约束）**：`QED_RESOURCE_GUARD=true`（默认开）时，启动任何本地模型前，**目标
  已就绪则直接返回**；否则遍历注册表**其他全部本地候选槽位**，在跑的一律 stop（LM Studio 按
  模型已加载判定，卸载即释放显存；llamacpp/docker 按探针/进程判定），再启动目标——本地同时
  最多一个模型进 GPU（4080 16GB）。
- 判定与执行收敛在 `model_manager.ensure_local_ready(slot)`，runtime 细节不外泄。
- `QED_RESOURCE_GUARD=false` 时跳过自动互斥，模型共存由用户自行负责。
- 来源/渠道（api/local）语义与调用拓扑见 [llm-gateway.md](llm-gateway.md)：`api` 来源不启动任何
  本地模型；`local` 来源文字走槽位渠道所选 runtime、图像走 MinerU。

## 关键组件文件

| 文件 | 职责 |
| --- | --- |
| `backend/qed_engine/services/llm/registry.py` | 身份目录 + 槽位解析（主登记见 llm-gateway.md） |
| `backend/qed_engine/services/llm/runtimes/` | runtime 同化适配器：lmstudio（半托管）/ llamacpp / docker |
| `backend/qed_engine/services/llm/model_manager.py` | operate_model(slot, op) + ensure_local_ready（单活互斥） |
| `backend/qed_engine/api/control.py` | /models/{slot}/{start\|stop\|restart\|select}、GET /models/{slot} 端点（409/404 语义） |
| `scripts/text-model/qed_qwen_service.py` | llamacpp runtime 生命周期脚本（start/stop/restart/status + 健康探测） |
| `scripts/image-model/qed_mineru_service.py` | docker runtime（MinerU）生命周期脚本（infra-*.ps1 编排） |
| `scripts/image-model/download-models.py` | MinerU 权重下载（modelscope/hf） |
| `scripts/image-model/docker/Dockerfile`、`compose.yaml` | MinerU 镜像（去模型固化）+ 卷挂载配置 |
| `model/qwen/`、`model/mineru/` | 模型文件目录 + manifest（git 忽略，骨架保留） |
| `web-ui/src/stores/runtime.ts` | operateModel action + 模型选择（收敛轮询） |
| `web-ui/src/api/llm.ts` | operateModel / selectModel API 封装 |

## 已知约束与约定

1. **全部经 8900**（ADR 0007）：模型操作不让前端直连脚本/容器端口。
2. **来源 = api 时只读**：云端来源不渲染启停按钮（仅「验证」）；LM Studio 模型在 api 来源不加载。
   来源 = local 时渲染启停与模型下拉。
3. **模型文件不提交**：`model/` 内容 git 忽略；下载脚本与 README 提交；LM Studio 模型留在
   `~/.lmstudio/` 不迁移、不提交。
4. **权重下载可重复**：download-models.py 幂等（已存在跳过），断点续传不保证（modelscope 下载器行为）。
5. **MinerU 挂载路径稳定**：卷挂载点 `/root/mineru_models` 与镜像内 `/root/mineru.json` 的
   `models-dir` 一致，避免容器内模型路径变化导致行为漂移。
6. **MinerU 健康端点**：`/health`（非 `/api/v1/health`）；探针与脚本统一该路径。
7. **GPU 掉线偶发**：多次启停 / WSL VM 挂起后容器内 GPU 可能不可见（`nvidia-smi` 报
   `GPU access blocked by the operating system`），`docker restart mineru-api` 或重跑
   `infra-up.ps1` 恢复；解析前建议先确认容器内 GPU 可见。
8. **LM Studio 生命周期经 `lms` CLI**：REST API v0 无 load/unload 端点，加载/卸载一律经
   `lms load <key> --gpu max` / `lms unload`；探活用 `GET /api/v0/models` 的 `state == "loaded"`
   （`/v1/models` 列全量已下载模型）。端口以本机实际配置为准（`lms server status` 查看，默认
   1234，本机为 5001，经 `QED_MODEL_URL` 配置）；本机开启 API token 认证，经
   `QED_LMSTUDIO_TOKEN` 带 Bearer。`lms` CLI 不在 PATH 时 start 报明确原因（半托管降级为
   探活 + 调用）。
