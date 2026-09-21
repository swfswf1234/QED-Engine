# LLM 统一网关设计（llm-gateway）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-21
确认状态：暂定
关联代码：`backend/qed_engine/services/llm/gateway.py`、`backend/qed_engine/services/llm/registry.py`、`backend/qed_engine/services/llm/clients.py`、`backend/qed_engine/services/llm/call_log.py`、`scripts/qed_engine_service.py`、`scripts/text-model/`、`scripts/image-model/`、根 `.env.example`（v2 新增的 registry.py 与 runtimes/ 已随 PLAN-046 落地；`config.py`/`monitor.py`/`control.py` 的改动另归其主设计文档，`model_manager.py` 与本地模型生命周期操作归 [local-model-management.md](local-model-management.md)，本设计只在正文引用）
关联测试：`tests/test_llm_gateway.py`、`tests/test_llm_registry.py`、`tests/test_llm_clients.py`、`tests/test_llm_model_manager.py`、`tests/test_llm_call_log.py`、`tests/test_llm_endpoints.py`、`tests/test_qed_engine_service.py`、`tests/test_qed_qwen_service.py`、`tests/test_qed_mineru_service.py`
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0005](../history/adr/v0.1/0005-control-center-service-hosting.md)、[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)
关联计划：[2026-09-16-llm-registry-unification](../history/plans/2026-09/2026-09-16-llm-registry-unification.md)（PLAN-046，v2/v3 修订来源；2026-09-21 关闭归档）

> **解析路径变更（ARCH-020，2026-09-14，[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)）**：
> 文档解析管线归 Axiom-Flow 并经引擎适配器**直连本地模型服务**，不再经本网关；本网关的
> `/llm/vision` 降级为控制台测试与通用视觉用途。下文「Axiom-Flow 经网关调用」表述按此修订。

> **v2 修订（2026-09-16，PLAN-046）**：① 新增**模型身份注册表**（`registry.py`，唯一事实源）——
> 模型身份不分 api/local，.env 每槽位一个身份变量，注册表解析身份 → api 引用/本地引用；
> ② .env 收敛——全局只新增 `QED_LOCAL_RUNTIME`（本地加载方式），**取消槽位级 source 变量**，
> api/local 渠道保持全局 `QED_API_SELECT` 语义；③ 新增 `POST /llm/embedding`（第三接口，
> text-embedding-v4 先行）；④ 调用记录 provider 取值扩展（lmstudio/llamacpp）。runtime 同化与
> LM Studio 半托管语义归 [local-model-management.md](local-model-management.md)。
>
> **v3 修订（2026-09-16，PLAN-046，控制台模型卡优化）**：**反转 v2 第二轮裁决 #5/#6**——
> ① **来源（source）与本地渠道（runtime）改为槽位级可切换**（控制台每卡独立选择，写运行态
> `manifest.json`），全局 `QED_API_SELECT` / `QED_LOCAL_RUNTIME` 退化为**未选择时的默认值**；
> ② 身份目录增加 `description`（一句话备注）；③ 渠道选项按槽位从注册表
> **派生**（该 runtime 有身份引用 = 登记可用，否则待上线）；模型下拉按「来源 × 渠道」过滤；
> ④ 配置中心四段式（2026-09-16 用户裁决）：本地模型变量统一 `QED_LOCAL_RUNTIME` /
> `QED_MODEL_URL`（文字，合并 LM Studio 与 llama.cpp）/ `QED_OCR_MODEL_URL`（图像，端口
> 8002→5002）/ `QED_LMSTUDIO_TOKEN` / `QED_RESOURCE_GUARD`，**删除** `QED_LMSTUDIO_URL` /
> `QED_QWEN_URL` / `QED_MINERU_URL`；跨项目变量（`QED_API_SELECT` / `QED_API_PROVIDER` /
> `QED_MODEL` 等）保持不变。

## 背景与目的

QED-Engine 三项目当前模型调用形态：

- **根 `.env`**：密钥唯一事实源（`API_KEY` 唯一密钥 + `QED_API_PROVIDER` 选厂商；逐厂商 key 已取消），子项目公共键自 2026-08-26（REQ-063）起经「向上查找父目录 `.env`」由根兜底、不再重复持有；QED-Tracker 自身 `.env` 仅存私有底线键（API_KEY/QED_DB_PASSWORD 等），Axiom-Flow 侧精简见 REQ-003 备注（待其承接）。
- **LLM 网关不存在**（文档记为第二轮规划）：8900 只有 `/monitor/qwen`、`/monitor/mineru` 探测端点，无真实调用能力。
- **本地模型**：Qwen（qwen 7b 量化，`http://127.0.0.1:5001`）已启动可用于测试；MinerU 容器编排脚本（`compose.yaml`/`infra-*.ps1`/`Dockerfile`）位于 Axiom-Flow 仓库 `scripts/`，由 Axiom-Flow 维护。
- **前端控制台**：仅四服务卡 + MySQL 依赖卡；GPU/显存、文字/图像模型状态与调用记录均无展示。
- **硬件约束**：本机 4080（16GB 显存），Qwen 文字模型与 MinerU 图像服务不能同时进 GPU。

本设计定义三项目统一的**模型调用网关**与**本地模型生命周期管理**：

1. 配置唯一事实源在仓库根 `.env`（见 [project-configuration.md](project-configuration.md)）：
   统一使用 `QED_API_SELECT`（api/local 模式选择）+ `API_KEY`（唯一密钥）+ `QED_API_PROVIDER`
   （厂商选择，api 模式）三个核心变量，公共键不重复持有，QED-Tracker 与 Axiom-Flow 参照执行。
2. 8900 提供 LLM 网关端点（文字/图像），负责 api/local 模型路由、资源互斥与调用记录；QED-Engine 模式下三项目统一经网关调用，local 模式下子项目用自身 `API_KEY` 直连供应商。
3. 本地文字模型（Qwen / llama-server）与图像模型（MinerU）的启停/重启脚本归入根仓库 `scripts/text-model/` 与 `scripts/image-model/` 两个文件夹；MinerU 编排由 Axiom-Flow 移交 QED-Engine。
4. 调用记录（prompt 模板/提问/回答/耗时/调用时间/成败）落 qed 库单表 `qed_llm_calls`，三项目均可写入（local 模式也记录，用于 prompt 与工具调用调优），8900 提供检索端点，前端控制台提供检索界面。
5. 前端控制台改造：四服务卡后新增 GPU 总览条；依赖组件三卡（MySQL/文字模型/图像模型，默认置灰 + 测试按钮）；模型调用记录检索页。

## 来源、渠道与调用拓扑

```mermaid
flowchart LR
    subgraph QEDEngine[QED-Engine 8900]
        GW[LLM 网关<br/>/llm/text /llm/vision]
        MM[模型管理器<br/>资源互斥 QED_RESOURCE_GUARD]
        CL[调用记录<br/>qed_llm_calls]
        MM --> GW
        GW --> CL
    end
    subgraph LocalText[本地文字 runtime（槽位渠道，默认 QED_LOCAL_RUNTIME）]
        LMS[LM Studio :5001（默认，半托管）<br/>llama-server :5001（预留）]
    end
    subgraph LocalImage[本地图像模型]
        MRU[MinerU 容器<br/>127.0.0.1:5002]
    end
    subgraph API[API 供应商]
        APIT[文字 qwen-plus]
        APII[图像 qwen-vl-ocr]
    end
    subgraph Tracker[QED-Tracker 8901]
        TR[llm_client 兼容层]
    end
    subgraph Axiom[Axiom-Flow 8902]
        AX[解析管线 + 引擎适配器]
    end
    subgraph FE[前端 8903]
        CON[控制台<br/>GPU 总览/依赖卡/调用检索]
    end
    GW -- api 模式 --> APIT
    GW -- api 模式 --> APII
    GW -- local 模式 --> LMS
    GW -- local 模式（测试） --> MRU
    TR -- local 直连 --> APIT
    AX -- 解析直连（ARCH-020） --> MRU
    AX -- api 档位 --> APII
    TR -- qed-engine 模式 --> GW
    GW --> CL
    TR -- local 模式 --> CL
    AX -- 自写调用记录 --> CL
    CON --> GW
    CON --> CL
```

- **来源（`QED_API_SELECT`，跨项目默认值；v3 槽位级覆盖）**：
  - `api`（默认）：走 API key 调用供应商（文字/向量按身份解析，当前 qwen 系），不启动本地模型。
  - `local`：文字走槽位渠道所选本地 runtime、图像走 MinerU（5002）。
  - 控制台每卡可独立选「来源」并写运行态 `manifest.source`；`.env` 值仅为该槽位未选择时的默认。
- **本地渠道（`QED_LOCAL_RUNTIME`，默认值；v3 槽位级覆盖）**：`lmstudio`（默认，半托管）/
  `llamacpp`（llama-server）/ `docker`（MinerU / 未来 llama.cpp 打包服务复用）。runtime 同化语义见
  [local-model-management.md](local-model-management.md)。**v3 反转 v2 裁决**：来源与渠道改为
  槽位级运行态选择（写 `manifest.json`），三项目经网关的调用透明性由注册表解析保证。
- **QED-Engine 模式（子项目视角）**：QED-Tracker / Axiom-Flow 的 `QED_API_SELECT=qed-engine` 时，LLM 调用一律 HTTP 走 8900 网关，不接触密钥；网关按 QED-Engine 自身模式（api/local）路由。
- **local 模式（子项目视角）**：子项目用自身 `.env` 的 `API_KEY` 直连供应商；此时**不依赖 8900 在线**（独立性铁律）。
- **Axiom-Flow 与 MinerU（ARCH-020 修订）**：MinerU 编排与模型文件归 QED-Engine 管理；**文档解析
  不再经本网关**——Axiom-Flow 解析管线经引擎适配器直连本地模型服务（MinerU 5002 等），
  模型选择在 Axiom-Flow 配置（`AXIOM_OCR_ENGINE`），换模型不改调用链
  （[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)）。本网关的 `/llm/vision`
  保留为控制台测试与通用视觉用途。
- 子项目各自维护一个**兼容 LLM 客户端文件**（`llm_client.py`）：对外提供统一调用接口，内部按模式切换 `direct`（local 直连）/ `gateway`（HTTP 调 8900），业务调用方代码不变。

## .env 变量与网关约定（唯一事实源见 project-configuration.md）

### 通用变量（三项目 `.env` 均含）

```ini
# ============ 模型模式与密钥 ============
# 默认来源（v3：槽位未选择时生效；控制台槽位级选择写 manifest.source）
# api（默认，API key 调用）| local（本地模型）| qed-engine（仅子项目，经 8900 网关）
QED_API_SELECT=api
# 唯一供应商 key（逐厂商 key 已取消）
API_KEY=
# 厂商选择（api 模式）：qwen（默认）/ deepseek / glm（注册表预留）
QED_API_PROVIDER=qwen
# qed-engine 模式读取；local/api 模式忽略
QED_LLM_GATEWAY_URL=http://127.0.0.1:8900
```

- **密钥收敛（2026-08-20 用户裁决）**：逐厂商 key（`QWEN_API_KEY` / `DEEPSEEK_API_KEY` /
  `GLM_API_KEY`）已正式取消，`API_KEY` 唯一 + `QED_API_PROVIDER` 选厂商，**不再有旧变量别名回退**。
  子项目侧存量别名（`AXIOM_API_KEY` / `DASHSCOPE_API_KEY`）由其执行侧按自身门禁决定退役，本设计
  不要求一次性删光旧变量。
- 三项目各自的非密钥私有配置（端口、数据目录、模型名、`QED_DB_*` 等）继续由各自 `.env` 承载。

### 根 `.env`（QED-Engine）额外变量

```ini
# ============ 本地模型与资源互斥 ============
QED_LOCAL_RUNTIME=lmstudio                  # 本地渠道默认值：lmstudio（默认）/ llamacpp / docker
QED_MODEL_URL=http://127.0.0.1:5001/v1      # 文字模型地址（lmstudio / llamacpp 共用）
QED_OCR_MODEL_URL=http://127.0.0.1:5002    # 图像模型地址（MinerU 容器，健康端点 /health）
QED_LMSTUDIO_TOKEN=                         # 仅 lmstudio 渠道需鉴权（密钥类）
QED_RESOURCE_GUARD=true                     # 单活仲裁开关：启动一方前先停其他在跑本地模型
```

- **命名（2026-09-16 四段式）**：根仓库私有变量统一为 `QED_LOCAL_RUNTIME` / `QED_MODEL_URL` /
  `QED_OCR_MODEL_URL` / `QED_LMSTUDIO_TOKEN` / `QED_RESOURCE_GUARD`；`QED_MODEL_URL` 合并
  LM Studio 与 llama.cpp 地址，`QED_OCR_MODEL_URL` 取代 `QED_MINERU_URL`（端口 8002 → 5002）；
  **删除** `QED_LMSTUDIO_URL` / `QED_QWEN_URL` / `QED_MINERU_URL`。跨项目变量
  （`QED_API_SELECT` / `QED_API_PROVIDER` / `API_KEY` / `QED_LLM_GATEWAY_URL` / `QED_MODEL` 等）
  保持原名，子项目零改动（MinerU 直连的 Axiom-Flow 除外，见 [project-configuration.md](project-configuration.md)）。
- `QED_LOCAL_RUNTIME`：**槽位未在控制台选择渠道时的默认值**；
  槽位级选择写运行态 `manifest.runtime`（见 [local-model-management.md](local-model-management.md)）。
- **资源互斥语义（v2：单活仲裁）**（`QED_RESOURCE_GUARD=true` 时，由模型管理器执行）：

  - 启动/调用任一本地模型前：遍历注册表其他全部本地候选槽位，在跑的一律停止（LM Studio 卸载
    模型释放显存；llamacpp/docker 停进程/容器）——本地同时最多一个模型进 GPU（4080 16GB）。
  - 批处理方向：文字批处理期间图像模型保持停止，图像批处理期间文字模型保持停止，不在同一批内交叉；互斥在模型服务启动时自动完成，批任务天然分阶段。
  - `QED_RESOURCE_GUARD=false` 时跳过自动互斥，模型共存由用户自行负责。

### 模型身份变量（v3：每槽位一个，值不分 api/local）

```ini
# ============ 模型身份（值 = 注册表身份名，解析规则见下节）============
QED_MODEL=qwen-plus               # 文字槽位身份（运行态 manifest.active 优先）
QED_OCR_MODEL=qwen-vl-plus        # 图像槽位身份
QED_EMBEDDING_MODEL=text-embedding-v4   # 向量槽位身份
```

- 身份变量值统一为**模型身份**（2026-09-16 用户裁决：模型参数不区分 API 还是本地两套）；
  身份 → api 引用 / 本地引用的映射归注册表，运行态覆盖经 `manifest.active`（见
  [local-model-management.md](local-model-management.md)）。

## 模型身份注册表（v3，`services/llm/registry.py`，唯一事实源）

注册表 = **身份目录**（模型身份 → api 引用 / 本地引用 / 备注）+ **槽位解析**（来源 × 渠道 ×
身份 → 具体端点与模型名）。替代 v1 的双表分离（api 厂商注册表 `clients.PROVIDERS` 与本地
`MODEL_SCRIPTS` 各自为政）——PROVIDERS 降级为注册表 api 引用的地址解析层，`MODEL_SCRIPTS`
由 runtime 适配器取代（见 local-model-management.md）。

**首版身份目录**：

| 槽位 | 身份 | 备注（description，控制台一句话） | api 引用 | 本地引用（runtime: 标识） |
| --- | --- | --- | --- | --- |
| `text` | `qwen-plus` | 通义千问 Plus，云端通用文本模型 | qwen@dashscope | 无 |
| `text` | `deepseek-v4-flash-0731` | DeepSeek V4 Flash（0731），DashScope 兼容模式托管 | qwen@dashscope | 无 |
| `text` | `qwen3.8-27b` | Qwen3.8 27B，本机 LM Studio 已下载 | 无 | lmstudio: qwen3.8-27b |
| `text` | `qwen3.5-9b` | Qwen3.5 9B，轻量本地模型 | 无 | lmstudio: qwen/qwen3.5-9b |
| `vision` | `qwen-vl-plus` | 通义千问 VL Plus，云端视觉模型 | qwen@dashscope | 无 |
| `vision` | `mineru` | MinerU 文档解析模型，本机 Docker 已部署 | 无 | docker: mineru |
| `embedding` | `text-embedding-v4` | 通义文本向量模型 v4 | qwen@dashscope | 无（预留） |

**来源与渠道（v3：槽位级）**：

- **来源（source）**：`api` | `local`。取值优先级 `manifest.source`（运行态，控制台选择）
  > 全局 `QED_API_SELECT`（默认）> 槽位默认 `api`。
- **渠道（runtime，仅 local）**：`lmstudio` | `llamacpp` | `docker`。取值优先级
  `manifest.runtime`（运行态）> 槽位默认 runtime（`text` = `QED_LOCAL_RUNTIME`，`vision` = `docker`，
  `embedding` 无）。`api` 来源下渠道恒为「直连」（`direct`）。
- **渠道选项**（控制台下拉，按槽位从注册表派生）：某 runtime 在槽位下有至少一个身份引用 =
  `available`（登记可用）；否则 `pending`（待上线）。text：lmstudio 可用 / llamacpp·docker 待上线；
  vision：docker 可用 / lmstudio·llamacpp 待上线；embedding：无本地候选（全待上线）。
- **模型选项**（控制台下拉，按「来源 × 渠道」过滤）：`api` → 有 api 引用的身份；`local` →
  有该 runtime 本地引用的身份。

**解析规则**（`registry.resolve(settings)`，gateway / model_manager / 端点层统一消费）：

1. 身份取值优先级：`manifest.active`（运行态，控制台选择）> `.env` 身份变量 > 槽位默认身份。
2. `api` 来源：身份的 api 引用；无 api 引用 → 回退 `.env` 身份变量对应的已注册 api 身份
   （2026-09-21 冒烟裁决：本机 key 开通 `deepseek-v4-flash-0731`，回退链须尊重 `.env` 配置）>
   槽位厂商默认模型（告警一次，不阻断）。
3. `local` 来源：身份的本地引用（按生效 runtime 匹配）；身份无该 runtime 引用 → 回退槽位默认
   本地身份（告警一次，不阻断）；**槽位无本地候选（embedding）→ 来源固定 `api`**，不随全局
   `QED_API_SELECT=local` 切换（解析恒成功，避免必失败槽位）。
4. `description` 供控制台「备注」行展示；`ready`（探针/配置）供「可用」行展示，不阻断解析。

- **插拔约定**：新增本地模型 = 注册表加身份条目（+ 对应 runtime 引用），不改 gateway/clients
  调用链；新增厂商 = api 引用加条目；未来 AGENT/MCP 统一配置以同一注册表为准（反代面为
  roadmap 预留，本轮不实现）。

## 脚本布局

### 根仓库 `scripts/`

根仓库脚本目录布局与生命周期脚本范式（含 `text-model/`、`image-model/` 编排）由
[project-configuration.md](project-configuration.md)「脚本目录管理」节统一管理，
本设计不再重复登记。本地模型与网关相关的脚本事实：

- `qed_engine_service.py` 的 `--mode api|local` 写入运行状态，重启可换模式；模型管理器经
  生命周期脚本执行本地模型启停，脚本调用失败返回明确原因。
- 前端脚本不需要 .env（8903 纯静态文件服务，构建期配置在 `web-ui/.env.production`）。

### QED-Tracker（请求方：QED-Tracker 仓库，REQ-043）

- 新建自身 `.env`：`QED_API_SELECT=local`（默认）、`API_KEY`、`QED_LLM_GATEWAY_URL`、`QED_MODEL`、`QED_DB_*`、`QED_TRACKER_PORT` 等。
- `scripts/qed_tracker_service.py` 增加 `--mode local|qed-engine`：start/restart 可传，持久化（logs/ 状态文件），默认读自身 `.env` 的 `QED_API_SELECT`；重启可更改模式。
- 新增 `src/qed_tracker/llm_client.py` 兼容层：`direct`（用自身 `API_KEY` 直连 dashscope 文字模型）/ `gateway`（HTTP 调 8900 `/llm/text`）。
- `config.py` 改读自身 `.env`（原直读根 `.env` 的 `QED_*` 逻辑保留为兜底）；local 模式调用记录写 `qed_llm_calls` 表（`service=qed_tracker`）。

### Axiom-Flow（请求方：Axiom-Flow 仓库，REQ-044）

- 调整自身 `.env`：`QED_API_SELECT=local`（默认）、`API_KEY`（`AXIOM_API_KEY` 降为别名）、`QED_LLM_GATEWAY_URL`、`QED_DB_*`（调用记录落库）、保留 `AXIOM_VISION_MODEL` 等私有变量。
- `scripts/axiom_flow_service.py` 增加 `--mode local|qed-engine`，语义同 QED-Tracker。
- 新增 `src/axiom_flow/llm_client.py` 兼容层：`direct`（自身 `API_KEY` 直连 qwen-vl-ocr）/ `gateway`（HTTP 调 8900 `/llm/vision`；MinerU 仅经网关可达）。
- **移除 MinerU 编排**（`compose.yaml`、`infra-*.ps1`、`docker/Dockerfile` 迁出，本地 mineru 直连调用删除）：编排与容器管理移交 QED-Engine 根仓库（根仓库侧先行落位后再移除，过渡期双份存在可接受）。
- local 模式调用记录写 `qed_llm_calls` 表（`service=axiom_flow`）。

## 后端新增能力（8900，根仓库实现）

### 模块布局（主流程内独立文件夹）

```
backend/qed_engine/services/llm/
├── __init__.py
├── gateway.py          # 网关路由：/llm/text、/llm/vision、/llm/embedding（v2 转正）
├── registry.py         # v2 新增：身份目录 + 槽位解析（唯一事实源，见上节）
├── runtimes/           # v2 新增：runtime 同化适配器（lmstudio/llamacpp/docker，见 local-model-management.md）
├── model_manager.py    # 槽位生命周期编排 + 单活互斥（QED_RESOURCE_GUARD）
├── call_log.py         # qed_llm_calls 写入与查询
└── clients.py          # api 引用地址解析（原厂商注册表 PROVIDERS）+ qwen(OpenAI 兼容) / mineru / embeddings HTTP 客户端
```

### 端点契约（挂 `api/control.py`，前缀 /api/v1）

| 端点 | 语义 |
| --- | --- |
| `POST /llm/text` | 文字模型调用：`{prompt, system?, prompt_template?, max_tokens?}` → 按**槽位来源**路由（api：注册表解析身份 api 引用，按 `QED_API_PROVIDER` 选厂商；local：槽位渠道所选 runtime）；记录调用；`{reply, call_id}`。`max_tokens` 非 None 时透传上游写入请求体（REQ-061：原「预留字段」已转正，不再静默丢弃） |
| `POST /llm/vision` | 图像模型调用：`{image_url 或 base64, prompt?, prompt_template?, max_tokens?}` → 按**槽位来源**路由（api：注册表解析身份 api 引用，qwen-vl / glm-vl；local：MinerU PDF 解析，deepseek 无视觉）；记录调用；`{reply, call_id}`。`max_tokens` 语义同 text（REQ-061 一并纳入） |
| `POST /llm/embedding`（v2 新增） | 向量调用：`{input: [str], }` → 按模式路由（api：text-embedding-v4；local：槽位无本地候选报明确错误）；记录调用（response 记维度摘要，不存向量本体）；`{embeddings, model, call_id}` |
| `POST /llm/test/text` | 文字模型测试（控制台测试按钮）：小 prompt 真实调用，成功/失败 + 原因 |
| `POST /llm/test/vision` | 图像模型测试：健康探测 + 最小识别调用，成功/失败 + 原因 |
| `POST /llm/test/embedding`（v2 新增） | 向量模型测试：最小 embedding 调用，成功/失败 + 原因 |
| `GET /llm/calls` | 调用记录检索：`service / mode / model / status / start / end / task / step / prompt_template / review_status / page / size`，分页返回（REQ-060 新增后 4 过滤） |
| `PATCH /llm/calls/{id}/review` | 审核标注（REQ-060）：`{review_status, review_note?}` → `{ok, call_id}`；不存在 404 |
| `POST /database/test` | MySQL 即时连接探测（控制台测试按钮，替代启动快照只读） |
| `GET /monitor/gpu` | 扩展：原 nvidia-smi 字段 + 系统内存（psutil，兜底 wmic） |
| `GET /monitor/{slot}`（v2） | 槽位化探测：text 按槽位渠道探对应端点、vision 探 MinerU `/health`、embedding 无本地 runtime（报明确状态）；旧名 `/monitor/qwen`、`/monitor/mineru` 为别名（deprecated，过渡期保留） |

**上游调用超时（REQ-061，2026-08-26）**：网关向所有文字/视觉上游客户端透传
`Settings.qed_llm_timeout`（env `QED_LLM_TIMEOUT`，默认 **300 秒**）。原实现 `DEFAULT_TIMEOUT=60.0`
硬编码且网关未透传，长生成（4000+ 字符 JSON）必现 ReadTimeout——该缺陷已修复，
`clients.DEFAULT_TIMEOUT` 仅保留为直连 client 函数时的兜底默认。

- 网关内部按**槽位来源**路由（运行态 `manifest.source` > 全局 `QED_API_SELECT` 默认）；密钥只在请求头，绝不下发、不入响应体。
- local 渠道调用前经 `model_manager.ensure_local_ready(slot)` 单活仲裁（先停其他在跑本地槽位再拉起当前身份，见 [local-model-management.md](local-model-management.md)）；文字经 OpenAI 兼容接口（模型名发现式取已加载模型），vision 走 MinerU PDF 解析（需 `pdf_bytes`）；向量槽位无本地候选，local 渠道报明确错误（仅 api）。
- 模型管理器经生命周期脚本（`scripts/text-model/`、`scripts/image-model/`）执行启停；脚本调用失败返回明确原因。
- 服务注册表（`/services`）四单元不变；本地模型属依赖组件，经 `/monitor/*` + 测试端点呈现，不占启停单元。

### 调用记录表 `qed_llm_calls`（qed 库，QED-Engine 拥有，三项目可写）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT PK AUTO_INCREMENT | — |
| `service` | VARCHAR(32) | 调用方：`qed_engine` / `qed_tracker` / `axiom_flow` |
| `mode` | VARCHAR(16) | `api` / `local` |
| `provider` | VARCHAR(32) | `qwen` / `deepseek` / `glm` / `lmstudio` / `llamacpp` / `mineru` / `gateway`（api 模式按 `QED_API_PROVIDER` 记录实际厂商；local 模式按实际 runtime 记录，v2 扩展） |
| `model` | VARCHAR(64) | 实际模型名 |
| `endpoint` | VARCHAR(16) | `text` / `vision` / `embedding` |
| `prompt_template` | VARCHAR(255) | 模板名/标识，可空 |
| `prompt` | MEDIUMTEXT | 实际提问 |
| `response` | MEDIUMTEXT | 实际回答 |
| `duration_ms` | INT | 耗时 |
| `status` | VARCHAR(16) | `success` / `error` |
| `error` | VARCHAR(500) | 失败原因，可空 |
| `created_at` | DATETIME | 调用时间 |
| `task` | VARCHAR(64) | 任务标识（如 paper-plan、book-eval），可空（REQ-060） |
| `step` | VARCHAR(32) | 步骤标识（如 plan、assess、propose），可空（REQ-060） |
| `review_status` | VARCHAR(16) | 审核状态：`unreviewed` / `passed` / `rejected`（REQ-060） |
| `review_note` | VARCHAR(1000) | 审核备注，可空（REQ-060） |

- 表结构以根仓库 Alembic 迁移落地（qed 库）；三项目各自持有 `QED_DB_*` 写权限。
- 写入方约定：网关统一写（QED-Engine 模式天然覆盖三项目）；子项目 local 直连时由各自 `llm_client.py` 自写（`service` 标识自身）。
- **prompt/response 调优用途**：记录完整提问与回答（响应体过大的可截断，策略实现时定），支撑后续 prompt 模板与工具调用调优。

## 前端控制台改造（8903，根仓库实现）

布局（自上而下）：

1. **四服务卡**：现状保留（8900 仅重启）。
2. **GPU 总览条**（在四服务卡之后）：`/monitor/gpu` → 显卡型号 / 显存使用（used/total）/ 利用率 / 模型进程占用（进程名+显存）/ 系统内存使用；不可用降级显示原因。
3. **资源监控三槽位卡**（v2：文字/图像/向量，默认置灰，经 `GET /models/{slot}` 取状态 + 测试按钮即时验证）：
   - MySQL（qed 库）：测试按钮 → `POST /database/test` 即时连接探测，反馈成功/失败+原因。
   - 文字/图像/向量三卡（v3 五字段）：**来源**（本地部署 / API 调用，下拉）→ **模型**（按来源 ×
     渠道过滤的身份下拉，带一句话备注）→ **渠道**（本地时可选 默认 / LM Studio / Docker，
     llama.cpp 待上线置灰；API 时显示「直连」）→ **可用**（探针判定 + 右侧「验证」按钮走
     `POST /llm/test/{slot}` 真实调用）→ **备注**（当前模型一句话介绍）。
   - 选择（来源/渠道/模型）经 `POST /models/{slot}/select` 写运行态 manifest；local 卡另有启停
     按钮（`POST /models/{slot}/{start|stop|restart}`，单活仲裁）；向量卡无本地候选（来源固定 api）。
4. **模型调用记录检索页**（`#/admin/llm-calls`）：读 `GET /llm/calls` 检索展示与审核标注
   （REQ-060 已实现）；页面 UI 设计见 [admin-console.md](admin-console.md)「模型调用记录页」节。

## 跨项目分工与节奏

| 阶段 | 执行方 | 内容 |
| --- | --- | --- |
| P0 设计落地 | 根仓库 | 本设计文档 + `project-configuration.md` 修订 + `.env.example` 修订；todo 登记 REQ-043（QED-Tracker）/ REQ-044（Axiom-Flow） |
| P1 根仓库后端 | 根仓库 | 根 `.env` + `qed_engine_service.py` + text-model/ + image-model/（MinerU 迁入）+ services/llm/ 网关/互斥/记录 + `qed_llm_calls` 迁移 + monitor 扩展 + 端点（TDD） |
| P2 前端控制台 | 根仓库 | GPU 总览条 + 依赖组件三卡 + 调用记录检索（TDD：vitest + tsc + build） |
| P3 QED-Tracker | QED-Tracker 仓库 | 自身 `.env`、`config.py` 改读、`llm_client.py`、script `--mode`、local 记录（按其门禁，REQ-043 回执） |
| P4 Axiom-Flow | Axiom-Flow 仓库 | MinerU 编排迁出移除、`.env` 调整、`llm_client.py`、script `--mode`、local 记录（按其门禁，REQ-044 回执） |
| P5 联调验收 | 根仓库牵头 | api/local 两模式下三项目链路 + 控制台回归（编入 [cross-project-contracts.md](cross-project-contracts.md)） |

## 验证

- 根仓库门禁：`pytest tests -q` + `ruff check backend tests scripts` + 契约测试；新增用例覆盖：网关路由（槽位来源 + 注册表身份解析，v3）、runtime 单活互斥（mock 适配器，N 槽位，v2）、`/llm/embedding` 与维度摘要记录（v2）、`/models/{slot}/select` 与 manifest source/runtime/active 运行态（v3）、`qed_llm_calls` 写入/检索、monitor 内存扩展、测试端点、`qed_engine_service.py` 生命周期。
- 前端门禁：`npx tsc -b` + vitest + build。
- 真实冒烟（人工）：api 模式下三项目经网关调用成功（调用记录落库）；local 模式下 Qwen 调用成功（MinerU 自动停止）；MinerU 调用成功（Qwen 自动停止）；控制台三卡测试按钮与调用检索展示。
- 子项目门禁按各自仓库 `docs/guides/development.md` 执行，回执后联调。