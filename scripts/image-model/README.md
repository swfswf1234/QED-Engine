# 本地图像模型（MinerU）

MinerU 服务由 QED-Engine 管理（WSL Docker 容器，端口 8002）。本目录集中管理其生命周期与模型。

## model/ 目录（仓库根，git 忽略）

模型权重**不再固化在镜像内**（Task 8，2026-09-06 用户裁决），改由仓库 `model/mineru/` 挂载：

- `model/mineru/`：MinerU 模型权重（`download-models.py` 下载，容器经卷挂载读取）
- `model/lm-studio/`：LM Studio GGUF 模型（文字模型目录，见 `scripts/text-model/`）

`.gitignore` 忽略 `/model/*`，仅保留骨架（.gitkeep）指向 `model/`。

## 生命周期

```bash
# 启动 / 停止 / 重启 / 状态（健康探测 http://127.0.0.1:8002/api/v1/health）
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

## 编排

- `compose.yaml`：mineru-api 单体（内嵌 vLLM + hybrid-engine），`MINERU_MODEL_SOURCE=local`
- `infra-up.ps1` / `infra-down.ps1` / `infra-status.ps1`：WSL 容器启停（含 keepalive 防挂起）
- 资源互斥（QED_RESOURCE_GUARD）：启动 MinerU 前先停 LM Studio（4080 16GB 显存约束，见
  model_manager.py）

## 权限与归口

- 容器/编排/模型均由根仓库管理（Axiom-Flow 不再直接操作 MinerU，qed-engine 模式经 8900 网关可达）。
- 详细设计见 `docs/design/local-model-management.md`（评审后晋升）。
