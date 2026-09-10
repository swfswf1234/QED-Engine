# 本地模型管理设计（local-model-management）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-10
确认状态：暂定
关联代码：`backend/qed_engine/services/llm/model_manager.py`、`scripts/text-model/`、`scripts/image-model/`、`model/`（根模型文件目录）、`web-ui/src/stores/runtime.ts`（operateModel。控制域路由注册与模型探针见 [api-contracts](../architecture/api-contracts.md)，不重复登记）
关联测试：`tests/test_llm_model_manager.py`、`tests/test_llm_endpoints.py`、`web-ui/src/pages/Console.test.tsx`
关联 ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0005](../history/adr/v0.1/0005-control-center-service-hosting.md)
关联设计：[llm-gateway.md](llm-gateway.md)（网关/调用记录/模式路由——分工见下）、[admin-console.md](admin-console.md)（控制台四区）、[dataset-conventions.md](dataset-conventions.md)（数据目录约定）
关联计划：[2026-09-06-console-refactor](../history/plans/2026-09/2026-09-06-console-refactor.md)（本设计晋升来源）

## 背景与定位

本地模型（文字：LM Studio / qwen；图像：MinerU）的生命周期管理，从「控制台依赖卡只读探针」
扩展为**可操作**：启动/停止/重启 + 测试 + 显存摘要。本设计定义操作入口、模型文件目录与
编排外迁；**模型调用网关、api/local 路由、调用记录不在本文件**（归 llm-gateway.md）。

分工边界：

- **网关/路由/调用记录/全局模式**：`llm-gateway.md`（/llm/text /llm/vision）。
- **生命周期操作/模型文件/编排**：本文件（/models/{name}、model/ 目录、MinerU 外迁）。
- **UI 四区与展示**：`admin-console.md`。

## 模型注册表

| name | 模型 | 本地服务 | 启停脚本 | 探针端点 | 测试端点 |
| --- | --- | --- | --- | --- | --- |
| `qwen` | 文字模型（qwen 7B 量化 GGUF） | LM Studio（127.0.0.1:5001） | `scripts/text-model/qed_lmstudio_service.py` | `GET /monitor/lmstudio` | `POST /llm/test/text` |
| `mineru` | 图像模型（MinerU） | MinerU 容器（127.0.0.1:8002） | `scripts/image-model/qed_mineru_service.py` | `GET /monitor/mineru` | `POST /llm/test/vision` |

`model_manager.MODEL_SCRIPTS` 为 name → 生命周期的唯一映射：
`{ qwen: TEXT_SCRIPT, mineru: IMAGE_SCRIPT }`。

## 统一操作入口：operate_model(name, op)

```python
MODEL_SCRIPTS = {"qwen": TEXT_SCRIPT, "mineru": IMAGE_SCRIPT}

def operate_model(name: str, op: str) -> dict:
    # start/restart：复用 ensure_text_ready / ensure_image_ready（资源互斥已含，QED_RESOURCE_GUARD）
    # stop：直调脚本 stop
    # 未知 name / op：抛 ValueError
```

规则：

- **start/restart 复用就绪函数**：互斥语义（文字/图像不同时进 GPU）由
  `ensure_*_ready` 生效，不重复实现。
- **stop 直调脚本**：不经过就绪检查。
- 返回值统一：`{ name, op, ok, ... }`（实际以 model_manager 实现为准，端点层再包一层 409/404 语义）。

## 端点契约：/models/{name}（8900 聚合）

| 端点 | 语义 | 非 200 分支 |
| --- | --- | --- |
| `POST /models/{name}/start` | 启动本地模型（local 模式） | api 模式 → 409；未知 name → 404 |
| `POST /models/{name}/stop` | 停止本地模型 | 同上 |
| `POST /models/{name}/restart` | 重启本地模型 | 同上 |

- **api 模式**（keys.mode=api）：本地模型不参与，仅云端厂商；启停端点返回 409（「api 模式下本地模型不可操作」），
  控制台 UI 此时不渲染启停按钮（只有测试）。
- **未知 name**（非 qwen/mineru）：404。
- 全部经 8900 聚合（ADR 0007）：前端不直连本地模型端口或脚本宿主。

## 模型文件目录：model/

根 `model/` 为**模型文件唯一事实库**（git 忽略，仅保留骨架）：

```text
model/
├── lm-studio/   # LM Studio QQ 模型（GGUF），由 LM Studio 管理下载
└── mineru/      # MinerU 模型权重（modelscope / hf）
```

- `.gitignore`：`/model/*` 忽略全部内容（目录骨架经 `.gitkeep` 保留）。
- 下载脚本：`scripts/image-model/download-models.py`（MinerU 权重）。
  - `-s/--source`：modelscope（默认）/ hf
  - `-m/--model`：指定模型名，默认 all（全部）
  - `--target`：输出目录（默认 `model/mineru`）
  - PowerShell 示例：`python scripts/image-model/download-models.py -s modelscope`（QED_env）
- LM Studio 模型由 LM Studio 自行管理（其模型目录通常为 `~/.cache`），项目不干预。

## MinerU 容器外迁（2026-09-06）

原 `Dockerfile` 内固化模型下载（`mineru-models-download` RUN，镜像内嵌权重，重建反复下载）。
外迁方案：**模型文件不入镜，宿主卷挂载**。

- `scripts/image-model/docker/Dockerfile`：**移除模型下载 RUN**（镜像只含运行时依赖）。
- `scripts/image-model/compose.yaml`：
  - 新增卷挂载：`../../model/mineru:/root/mineru_models`
  - 新增环境变量：`MINERU_MODELS_DIR=/root/mineru_models`
- 首次准备：`download-models.py` 下载权重到 `model/mineru/`，再 `docker build` + `infra-up.ps1`；
  如需保持容器内路径不变，可用 MINERU_MODELS_DIR 指到挂载点。
- **镜像重建冒烟（WSL 演示环境）需用户在场执行**：`docker build` 成功 + `infra-up.ps1` 后
  MinerU 健康探测通过（`GET /monitor/mineru` reachable）。

## 资源互斥与模式

- 本地文字/图像不能同时进 GPU（4080 16GB）：互斥由 `QED_RESOURCE_GUARD` 保证，
  细节与全局模式（api/local）语义见 llm-gateway.md。
- `keys.mode=local` 时模型操作可用；`api` 模式模型卡显示云端厂商（仅测试）。

## 关键组件文件

| 文件 | 职责 |
| --- | --- |
| `backend/qed_engine/services/llm/model_manager.py` | MODEL_SCRIPTS + operate_model（互斥/启动/停止） |
| `backend/qed_engine/api/control.py` | /models/{name}/{start\|stop\|restart} 端点（409/404 语义） |
| `scripts/text-model/qed_lmstudio_service.py` | LM Studio 生命周期脚本（start/stop/restart + 健康探测） |
| `scripts/image-model/qed_mineru_service.py` | MinerU 生命周期脚本（infra-*.ps1 编排） |
| `scripts/image-model/download-models.py` | MinerU 权重下载（modelscope/hf） |
| `scripts/image-model/docker/Dockerfile`、`compose.yaml` | MinerU 镜像（去模型固化）+ 卷挂载配置 |
| `model/lm-studio/`、`model/mineru/` | 模型文件目录（git 忽略，骨架保留） |
| `web-ui/src/stores/runtime.ts` | operateModel action（收敛轮询，目标态=探针 reachable） |
| `web-ui/src/api/llm.ts` | operateModel API 封装 |

## 已知约束与约定

1. **全部经 8900**（ADR 0007）：模型操作不让前端直连脚本/容器端口。
2. **api 模式只读**：云端模式不渲染启停，仅测试按钮。
3. **模型文件不提交**：`model/` 内容 git 忽略；下载脚本与 README 提交。
4. **权重下载可重复**：download-models.py 幂等（已存在跳过），断点续传不保证（modelscope 下载器行为）。
5. **MinerU 容器路径稳定**：MINERU_MODELS_DIR 保持与镜像内惯例一致（/root/mineru_models），
   避免容器内模型路径变化导致行为漂移。

## 设计来源与演进

- 2026-08-20：llm-gateway.md 登记本地模型生命周期脚本与资源互斥。
- 2026-09-06：模型生命周期从「脚本层」上升为「API 可操作」——/models 端点族 + model/ 目录 +
  MinerU 外迁，见 [2026-09-06-console-refactor](../history/plans/2026-09/2026-09-06-console-refactor.md)。
