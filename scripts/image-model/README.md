# 本地图像模型（MinerU）

MinerU 服务由 QED-Engine 管理（WSL Docker 容器，端口 8002）。本目录集中管理其生命周期与模型。

## model/ 目录（仓库根，git 忽略）

模型权重**不再固化在镜像内**（Task 8，2026-09-06 用户裁决），改由仓库 `model/mineru/` 挂载：

- `model/mineru/`：MinerU 模型权重（`download-models.py` 下载，容器经卷挂载读取）
- `model/qwen/`：Qwen GGUF 模型（文字模型目录，见 `scripts/text-model/`）

`.gitignore` 忽略 `/model/*`，仅保留骨架（.gitkeep）指向 `model/`。

## 生命周期

```bash
# 启动 / 停止 / 重启 / 状态（健康探测 http://127.0.0.1:8002/health）
python scripts/image-model/qed_mineru_service.py start
python scripts/image-model/qed_mineru_service.py stop
python scripts/image-model/qed_mineru_service.py restart
python scripts/image-model/qed_mineru_service.py status
```

完成镜像构建（模型外迁后，镜像内不再下载模型，启动时挂载 model/mineru）：

```bash
docker build -t mineru:latest -f scripts/image-model/docker/Dockerfile scripts/image-model/docker/
python scripts/image-model/download-models.py     # 首次：把模型拉到 model/mineru/
python scripts/image-model/infra-up.ps1             # WSL 启动容器（挂载 model/mineru）
```

> **模型路径机制（2026-09-14 校准）**：MinerU 在 `MINERU_MODEL_SOURCE=local` 时**不读**
> `MINERU_MODELS_DIR` 环境变量，而读镜像内 `/root/mineru.json` 的 `models-dir`。该文件由
> `docker/mineru.json` COPY 进镜像，声明 `pipeline` → `/root/mineru_models/PDF-Extract-Kit-1.0`、
> `vlm` → `/root/mineru_models/MinerU2.5-Pro-2605-1.2B`（即卷挂载点）。

## 编排

- `compose.yaml`：mineru-api 单体（内嵌 vLLM + hybrid-engine），`MINERU_MODEL_SOURCE=local`；
  卷挂载 `../../model/mineru` → `/root/mineru_models`
- `infra-up.ps1` / `infra-down.ps1` / `infra-status.ps1`：WSL 容器启停（含 keepalive 防挂起）
- 健康端点 `GET http://127.0.0.1:8002/health`（MinerU 实际路径）
- 资源互斥（QED_RESOURCE_GUARD）：启动 MinerU 前先停 Qwen（4080 16GB 显存约束，见
  model_manager.py）
- **GPU 掉线恢复**：容器内 `nvidia-smi` 报 `GPU access blocked by the operating system`
  时（多次启停/WSL 挂起后偶发），`wsl -e docker restart mineru-api` 或重跑 `infra-up.ps1`

## 权限与归口

- 容器/编排/模型均由根仓库管理（Axiom-Flow 不再直接操作 MinerU，qed-engine 模式经 8900 网关可达）。
- 详细设计见 `docs/design/local-model-management.md`（评审后晋升）。
