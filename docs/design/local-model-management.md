# 本地模型管理设计（local-model-management）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-16
确认状态：暂定
关联代码：`backend/qed_engine/services/llm/model_manager.py`、`scripts/text-model/`、`scripts/image-model/`、`model/`（根模型文件目录）、`web-ui/src/stores/runtime.ts`（operateModel。v2 计划新增的 services/llm/registry.py、services/llm/runtimes/ 待代码落地后补登记；控制域路由注册与模型探针见 [api-contracts](../architecture/api-contracts.md)，不重复登记）
关联测试：`tests/test_llm_model_manager.py`、`tests/test_llm_endpoints.py`、`web-ui/src/pages/Console.test.tsx`
关联 ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0005](../history/adr/v0.1/0005-control-center-service-hosting.md)、[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)
关联设计：[llm-gateway.md](llm-gateway.md)（网关/调用记录/全局模式/身份目录——分工见下）、[admin-console.md](admin-console.md)（控制台四区）、[dataset-conventions.md](dataset-conventions.md)（数据目录约定）
关联计划：[2026-09-16-llm-registry-unification](../plans/2026-09-16-llm-registry-unification.md)（PLAN-046，本轮 v2 修订来源）、[2026-09-06-console-refactor](../history/plans/2026-09/2026-09-06-console-refactor.md)（晋升来源）

> **v2 修订（2026-09-16，PLAN-046）**：本地部署形态泛化为 **runtime 同化**——LM Studio（半托管）/
> llama.cpp / docker 三种形态统一为「本地模型」语义（启停/探针/调用一致，为后续 AGENT、MCP
> 统一配置铺路）；`QED_LOCAL_RUNTIME` 唯一全局变量选择加载方式；资源互斥从「两两硬编码」泛化为
> **N 槽位单活仲裁**；`manifest.active` 升级为运行态事实源（控制台模型下拉写入）；/models、
> /monitor 端点从模型名泛化为槽位名（旧名别名过渡）。LM Studio 命名回归（PLAN-042 曾移除），
> 本次作为**runtime 之一**纳入并半托管。

## 背景与定位

本地模型（文字：Qwen；图像：MinerU）的生命周期管理，从「控制台依赖卡只读探针」
扩展为**可操作**：启动/停止/重启 + 测试 + 显存摘要 + **模型选择（v2）**。本设计定义操作入口、
模型文件目录与编排外迁；**模型调用网关、api/local 路由、调用记录、身份目录不在本文件**（归 llm-gateway.md）。

分工边界：

- **网关/路由/调用记录/全局模式/身份目录**：`llm-gateway.md`（/llm/text /llm/vision /llm/embedding）。
- **runtime 同化/生命周期操作/模型文件/编排**：本文件（/models/{slot}、model/ 目录、runtimes/）。
- **UI 四区与展示**：`admin-console.md`。

**用户既定口径（2026-09-16 裁决）**：无论经 LM Studio、llama.cpp 还是 docker 部署，都同化为
统一的「本地模型」进行启停与服务，后续 AGENT、MCP 等以同样方式配置；资源互斥保证文字/图像模型
中本地同时只有一个模型在跑（最关键约束）。

## 槽位与 runtime（v2）

| 槽位（slot） | 类别 | api 来源 | 本地 runtime（`QED_LOCAL_RUNTIME` 选择） | 探针 | 测试端点 |
| --- | --- | --- | --- | --- | --- |
| `text` | 文字 | qwen-plus | **lmstudio（默认，半托管）**；llamacpp（llama-server，预留）；docker（llama.cpp 打包，未来） | `GET /monitor/text`（旧 `/monitor/qwen` 别名） | `POST /llm/test/text` |
| `vision` | 图像 | qwen-vl-plus | **docker（MinerU 容器，现状保留）**；未来可探索其他本地图像模型 | `GET /monitor/vision`（旧 `/monitor/mineru` 别名） | `POST /llm/test/vision` |
| `embedding` | 向量 | text-embedding-v4 | 无（预留，后续按需接入） | — | `POST /llm/test/embedding`（新增） |

- **runtime 同化接口**（`services/llm/runtimes/`）：三种部署形态各实现同一接口，`model_manager`
  只面向接口，不感知部署细节：

```python
class LocalRuntime(Protocol):
    def probe(settings) -> bool      # 就绪 =「模型可用」而非仅进程存活
    def start(settings) -> Result    # 幂等；失败返回明确中文原因
    def stop(settings) -> Result     # 释放显存/进程
```

- **lmstudio（半托管）**：probe = `GET {QED_LMSTUDIO_URL}/models` 且已加载模型含当前身份；
  start = server 未起时尝试 `lms server start`（PATH 探测，失败报明确原因）+ LM Studio REST API v0
  加载当前身份模型（幂等）；stop = REST API v0 **卸载模型释放显存**（server 进程本身由 LM Studio
  自管，不杀）。REST v0 具体端点以本机 LM Studio 版本实测为准（冒烟时核对并回填本表）。
- **llamacpp**：现 `scripts/text-model/qed_qwen_service.py`（manifest → llama-server 进程）平移，
  脚本保留 CLI 入口（start/stop/restart/status）。
- **docker**：现 `scripts/image-model/qed_mineru_service.py`（infra-*.ps1 + compose）平移，
  脚本保留 CLI 入口。未来 llama.cpp 打包 docker 服务复用本 runtime（新增一份 compose）。

> **OCR 引擎槽位（ARCH-020，[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)）**：
> vision 槽位本地候选按引擎扩展——`mineru` 先落地，PaddleOCR-VL 等接入时新增引擎身份条目
> （模型槽位 `model/<引擎>/`）；控制台依赖组件卡展示当前生效 OCR 引擎。**模型生命周期归 8900，
> 解析调用不归**——Axiom-Flow 解析管线经引擎适配器直连模型服务，8900 只负责启停、探针与资源互斥
> （换引擎不改 8900 调用链）。

## 统一操作入口：operate_model(slot, op)

```python
# v2：槽位 → runtime 适配器（替代原 MODEL_SCRIPTS 两单元硬编码）
SLOT_RUNTIMES = {"text": <由 QED_LOCAL_RUNTIME 解析>, "vision": docker_runtime, "embedding": None}

def operate_model(slot: str, op: str) -> dict:
    # start/restart：ensure_local_ready(slot)（单活互斥已含，QED_RESOURCE_GUARD）
    # stop：直调 runtime.stop（LM Studio=卸载模型；llamacpp=停进程；docker=compose down）
    # 未知 slot / op：抛 ValueError（端点层映射 404）
```

规则：

- **start/restart 复用 ensure_local_ready**：单活互斥语义（见下）由其生效，不重复实现。
- **stop 直调 runtime**：不经过就绪检查。
- **select（新增）**：`operate_model(slot, "select", model=<身份>)` 校验身份属于该槽位且有本地
  引用后写入 `model/<slot>/manifest.json` 的 `active` 字段（运行态事实源），下一次 start 生效；
  当前已在跑时提示需重启槽位。
- 返回值统一：`{ slot, op, ok, ... }`（实际以 model_manager 实现为准，端点层再包一层 409/404 语义）。

## 端点契约：/models/{slot}（8900 聚合）

| 端点 | 语义 | 非 200 分支 |
| --- | --- | --- |
| `POST /models/{slot}/start` | 启动本地模型（local 模式） | api 模式 → 409；未知 slot → 404 |
| `POST /models/{slot}/stop` | 停止本地模型 | 同上 |
| `POST /models/{slot}/restart` | 重启本地模型 | 同上 |
| `POST /models/{slot}/select`（新增） | 切换当前身份（写 manifest.active） | api 模式 → 409；身份不属于槽位/无本地引用 → 404 |
| `GET /models/{slot}`（新增） | 槽位状态：当前身份 / 渠道 / runtime / 可用性 | 未知 slot → 404 |

- **api 模式**（keys.mode=api）：本地模型不参与，仅云端厂商；启停/select 端点返回 409（「api 模式下
  本地模型不可操作」），控制台 UI 此时不渲染启停与下拉（只有测试）。
- **未知 slot**（非 text/vision；embedding 无本地语义同 404）：404。
- **旧名别名**：`qwen` → text、`mineru` → vision（deprecated，过渡期保留，响应注记提示新名）。
- 全部经 8900 聚合（ADR 0007）：前端不直连本地模型端口或脚本宿主。

## 控制台需求（v2，UI 细节归 admin-console.md）

- 三卡（文字/图像/向量）**备注显示渠道**：api / lmstudio / llama.cpp / docker（经 `GET /models/{slot}`
  与 `GET /config/models` 取得），以及**模型可用状态**（注册表 `available` 元数据 + 探针结果，
  如「本机已下载」「未部署」「不可达」）。
- **local 模式可选择模型**：文字卡显示身份下拉（注册表内该槽位可选身份，首版 qwen3.8-27b /
  qwen3.5-9b），选择即调 `POST /models/text/select`；图像/向量卡同理（可选身份少时下拉置灰）。
- 启停/重启/测试按钮保留（api 模式仅测试）。

## 模型文件目录与 manifest 约定（2026-09-14 立约定 / 2026-09-16 v2 升级）

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

**manifest.json 约定（v2 语义）**：

```json
{
  "active": "<身份名>",
  "serve": {
    "port": 5001,
    "ctx": 8192,
    "n_gpu_layers": -1
  }
}
```

- `active`：**运行态事实源**——当前生效的模型身份（空字符串 = 未选择，回退 `.env` 身份变量默认值）。
  控制台模型下拉经 `/models/{slot}/select` 写入；生命周期与网关解析（registry）消费。
  v1 的「active = 模型目录名」升级为「active = 注册表身份名」（lmstudio 身份无需本地目录）。
- `serve`：服务启动参数（llamacpp runtime 的 llama-server 读取；docker runtime 以 compose 为准）。
- **换模型只改 active（控制台）或身份目录（代码）**：不动 env、不动 gateway/clients 调用链。
- **参数解耦**：env 只存端点与全局开关（`QED_LOCAL_RUNTIME` / `QED_LMSTUDIO_URL` / `QED_QWEN_URL` /
  `QED_MINERU_URL`），模型身份变量（`QED_MODEL` 等）值不分 api/local，由注册表解析。
- **MinerU manifest 为登记性**：MinerU 容器实际模型路径由 compose 卷挂载 + 镜像内
  `/root/mineru.json` 决定（见下节），manifest.active 不参与容器运行时——此为 v1 已知偏差的
  如实登记，v2 不强行统一。

**当前 manifest 骨架**：
- `model/qwen/manifest.json`：`{ "active": "", "serve": { "port": 5001, "ctx": 8192, "n_gpu_layers": -1 } }`
- `model/mineru/manifest.json`：`{ "active": "", "serve": { "port": 8002, "model_source": "local" } }`

**模型文件结构**：
- `.gitignore`：`/model/*` 忽略全部内容（目录骨架经 `.gitkeep` 保留）。
- 下载脚本：`scripts/image-model/download-models.py`（MinerU 权重）。
  - `-s/--source`：modelscope（默认）/ hf
  - `-m/--model`：指定模型名，默认 all（全部）
  - `--target`：输出目录（默认 `model/mineru`）
  - PowerShell 示例：`python scripts/image-model/download-models.py -s modelscope`（QED_env）
- llama.cpp 路径：llama-server 从 `model/qwen/<模型目录>/` 加载（OpenAI 兼容端口 5001）。
- LM Studio 路径：模型在 `~/.lmstudio/models/<发布者>/<模型名>-GGUF/`，注册表按身份记录
  runtime 标识（如 `unsloth/Qwen3.8-27B-GGUF`），不做文件搬运。

## MinerU 容器外迁与部署（2026-09-06 外迁 / 2026-09-14 落地）

原 `Dockerfile` 内固化模型下载（`mineru-models-download` RUN，镜像内嵌权重，重建反复下载）。
外迁方案：**模型文件不入镜，宿主卷挂载**。

- `scripts/image-model/docker/Dockerfile`：**移除模型下载 RUN**（镜像只含运行时依赖）。
- `scripts/image-model/docker/mineru.json`：**COPY 进镜像 `/root/mineru.json`**——MinerU 在
  `MINERU_MODEL_SOURCE=local` 时读该配置的 `models-dir`（`pipeline`/`vlm`），**不读**
  `MINERU_MODELS_DIR` 环境变量；指向挂载点下的 `PDF-Extract-Kit-1.0` / `MinerU2.5-Pro-2605-1.2B`。
- `scripts/image-model/compose.yaml`：卷挂载 `../../model/mineru:/root/mineru_models`。
- 首次准备：`download-models.py` 下载权重到 `model/mineru/`，再 `docker build` + `infra-up.ps1`。
- **落地验证（2026-09-14）**：`mineru:latest` 重建成功（去模型化）；容器 healthy、`/health` 200、
  GPU 穿透正常；真实 PNG 经 `POST /file_parse` 解析成功（`md_content` 正确）；
  8900 `/monitor/mineru` reachable、`/models/mineru/{start|stop|restart}` 正常（local 模式）。
- **健康端点**：`GET http://127.0.0.1:8002/health`（**不是** `/api/v1/health`）。

## 资源互斥与模式（v2：单活仲裁）

- **本地单活（最关键约束）**：`QED_RESOURCE_GUARD=true`（默认开）时，启动任何本地模型前，遍历
  注册表**其他全部本地候选槽位**，在跑的一律 stop（LM Studio 按模型已加载判定，卸载即释放显存；
  llamacpp/docker 按探针/进程判定），再启动目标——本地同时最多一个模型进 GPU（4080 16GB）。
- 判定与执行收敛在 `model_manager.ensure_local_ready(slot)`，runtime 细节不外泄。
- `QED_RESOURCE_GUARD=false` 时跳过自动互斥，模型共存由用户自行负责。
- 全局模式（api/local）语义与调用拓扑见 [llm-gateway.md](llm-gateway.md)：`api` 模式不启动任何
  本地模型；`local` 模式文字走 `QED_LOCAL_RUNTIME` 所选 runtime、图像走 MinerU。

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
2. **api 模式只读**：云端模式不渲染启停与模型下拉，仅测试按钮；LM Studio 模型在 api 模式不加载。
3. **模型文件不提交**：`model/` 内容 git 忽略；下载脚本与 README 提交；LM Studio 模型留在
   `~/.lmstudio/` 不迁移、不提交。
4. **权重下载可重复**：download-models.py 幂等（已存在跳过），断点续传不保证（modelscope 下载器行为）。
5. **MinerU 挂载路径稳定**：卷挂载点 `/root/mineru_models` 与镜像内 `/root/mineru.json` 的
   `models-dir` 一致，避免容器内模型路径变化导致行为漂移。
6. **MinerU 健康端点**：`/health`（非 `/api/v1/health`）；探针与脚本统一该路径。
7. **GPU 掉线偶发**：多次启停 / WSL VM 挂起后容器内 GPU 可能不可见（`nvidia-smi` 报
   `GPU access blocked by the operating system`），`docker restart mineru-api` 或重跑
   `infra-up.ps1` 恢复；解析前建议先确认容器内 GPU 可见。
8. **LM Studio REST v0 端点待实测**（v2 新增）：加载/卸载端点以本机 LM Studio 版本为准，
   PLAN-046 冒烟时核对并回填「槽位与 runtime」节；`lms` CLI 不在 PATH 时 start 报明确原因
   （半托管降级为探活 + 调用）。

## 设计来源与演进

- 2026-08-20：llm-gateway.md 登记本地模型生命周期脚本与资源互斥。
- 2026-09-06：模型生命周期从「脚本层」上升为「API 可操作」——/models 端点族 + model/ 目录 +
  MinerU 外迁，见 [2026-09-06-console-refactor](../history/plans/2026-09/2026-09-06-console-refactor.md)。
- 2026-09-14：本地模型管理整理轮（PLAN-042）——槽位目录 + manifest 约定、Qwen 运行时切
  llama-server、全量去 LM Studio 命名、MinerU 清理核查，见
  [2026-09-14-local-model-management-reorg](../history/plans/2026-09/2026-09-14-local-model-management-reorg.md)。
- 2026-09-14：本地模型部署轮（PLAN-045）——MinerU 去模型化镜像重建 + 卷挂载 + `mineru.json`
  路径校准 + 探针端点校准（`/health`）+ 8900 集成与真实解析冒烟，见
  [2026-09-14-local-model-deployment](../history/plans/2026-09/2026-09-14-local-model-deployment.md)。
- 2026-09-16：**模型注册表与三接口统一轮（PLAN-046，v2）**——runtime 同化（LM Studio 半托管 /
  llama.cpp / docker 统一语义）、`QED_LOCAL_RUNTIME` 唯一全局变量、单活互斥泛化、
  manifest.active 升级运行态事实源（控制台模型下拉）、端点槽位化 + 旧名别名，
  见 [2026-09-16-llm-registry-unification](../plans/2026-09-16-llm-registry-unification.md)。
