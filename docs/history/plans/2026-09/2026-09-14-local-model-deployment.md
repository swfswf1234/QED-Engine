# 本地模型部署轮（local-model-deployment）

状态：Accepted
任务类型：B
最后更新：2026-09-14
关联 ADR：[ADR 0014](../../../adr/0014-parsing-ownership-and-model-boundary.md)（解析能力归属与模型边界）、[ADR 0007](../../../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）
关联设计：[local-model-management.md](../../../design/local-model-management.md)、[llm-gateway.md](../../../design/llm-gateway.md)、[dataset-conventions.md](../../../design/dataset-conventions.md)
关联 Tracker：docs/trackers/todo.md（PLAN-045）
归档判定：Retain（部署与探针事实并入 local-model-management.md、scripts/image-model/README.md；计划壳归档 history/plans/2026-09/）

> 本计划承接[本地模型管理整理轮](../../../history/plans/2026-09/2026-09-14-local-model-management-reorg.md)明确
> 「另起」的部署部分：把本地图像模型 MinerU 从「脚本/manifest 契约就绪」推进到「容器真实可用」。
> 文字模型 Qwen（llama.cpp/GGUF）不在本轮范围（用户 2026-09-14 裁决）。

## 目标与成功标准

**目标**：在 Windows + WSL Ubuntu-24.04 + Docker Engine 环境完成 MinerU 图像模型服务的部署与
8900 集成，使「文档解析管理」具备可用的解析后端。

**成功标准**：

1. `mineru:latest` 镜像按去模型化 Dockerfile 重建成功（镜像内不含权重）；
2. `model/mineru/` 权重经卷挂载被容器读取（`MinerU2.5-Pro-2605-1.2B` + `PDF-Extract-Kit-1.0`）；
3. 容器启动后健康探测 200，`infra-status.ps1` 显示 running；
4. **探针路径校准**：全仓库 MinerU 健康端点引用统一为镜像真实端点（`/health` 与
   `/api/v1/health` 当前不一致）；
5. 8900 集成可用：`GET /monitor/mineru` reachable、`POST /models/mineru/{start|stop|restart}`
   正常、资源互斥（`QED_RESOURCE_GUARD`）生效；
6. 门禁全绿：`pytest tests -q` + `ruff check backend tests` + `pytest tests/contract -q`。

## 范围与非目标

**范围**：WSL/Docker 环境核查；`scripts/image-model/docker/Dockerfile` 镜像重建；
`model/mineru/` 权重校验；`infra-up/down/status.ps1` 编排；健康探针路径校准（代码 + 测试 +
文档）；8900 `/monitor/mineru`、`/models/mineru/*` 与资源互斥验证。

**非目标**：Qwen 文字模型（llama.cpp 安装 / GGUF 下载 / llama-server）部署；云端 qwen-vl
（api 档位）key 配置；PaddleOCR-VL 引擎接入；8902 Axiom-Flow 侧解析实现（ARCH-020-C）；
`axiom`/`xqfm` 库删除与 dataset 物理清理（ARCH-020-F）。

## 前置条件

1. 用户安装并启动 Docker Desktop（WSL 2 后端 + NVIDIA GPU 支持）；
2. WSL Ubuntu-24.04 可用，WSL 内 `nvidia-smi` 可见 GPU；
3. `model/mineru/` 权重已就位（当前已存在）；
4. 8900 后端可运行（探针验证）。

## 工作项

### W0 环境核查

- 启动 WSL，确认 Docker Engine 与 compose 可用、NVIDIA container runtime 生效；
- 盘点现有 `mineru:latest` 镜像、`mineru-api` 容器、卷与宿主缓存，确认镜像内无残留权重。

### W1 镜像重建（去模型化）

- `docker build -t mineru:latest -f scripts/image-model/docker/Dockerfile scripts/image-model/docker/`；
- 确认 Dockerfile 无模型下载 RUN（只含运行时依赖）。

### W2 权重校验

- 校验 `model/mineru/MinerU2.5-Pro-2605-1.2B/` 与
  `model/mineru/PDF-Extract-Kit-1.0/models/`（Layout/MFR/OCR/TabCls/TabRec）完整；
- 核对 `model/mineru/manifest.json` 的 `active` 与实际目录一致；
- 缺失时 `python scripts/image-model/download-models.py -s modelscope` 补全（幂等）。

### W3 容器启动

- `powershell -File scripts/image-model/infra-up.ps1`（卷挂载 `model/mineru` → `/root/mineru_models`）；
- `infra-status.ps1` 确认容器 Up 且健康探测通过。

### W4 探针路径校准（缺陷修正）

现场核对 MinerU 镜像真实健康端点，统一以下引用并同步测试：

- `scripts/image-model/qed_mineru_service.py`、`scripts/image-model/infra-status.ps1`、
  `scripts/image-model/compose.yaml`（healthcheck）、`scripts/image-model/README.md`；
- `backend/qed_engine/services/monitor.py`（`MINERU_HEALTH_PATH`）、
  `backend/qed_engine/services/llm/model_manager.py`（`_mineru_ready`）；
- `tests/test_qed_mineru_service.py`、`tests/test_monitor.py`。

### W5 8900 集成验证

- `GET /monitor/mineru` → `{reachable: true}`；
- `POST /models/mineru/{start|stop|restart}` → 200；
- 资源互斥：`QED_RESOURCE_GUARD=true` 时启动 MinerU 前先停 Qwen。

### W6 冒烟（可选）

- 直接用 MinerU API 解析一页 PDF，确认返回结构化结果（不依赖 8902）。

### W7 文档与台账

- 更新 `scripts/image-model/README.md`、`docs/guides/operations.md`、
  `docs/design/local-model-management.md`（实现状态）、`docs/trackers/project-status.md`；
- 推进 todo PLAN-045 状态。

## 验证与验收

- 健康：`Invoke-WebRequest http://127.0.0.1:8002/<真实端点>` → 200；
- 探针：`GET http://127.0.0.1:8900/monitor/mineru` → `reachable: true`；
- 模型操作：`POST /models/mineru/restart` 后探针恢复 reachable；
- 门禁：`pytest tests -q` + `ruff check backend tests` + `pytest tests/contract -q` 全绿；
- 人工：`infra-status.ps1` 输出 running；控制台依赖组件卡「图像模型」显示在线。

## 回滚

- 容器：`infra-down.ps1` 停止并删除容器；
- 镜像：`docker rmi mineru:latest`（重建可恢复）；
- 代码（W4 校准）：按 Git 锚点回退探针路径改动；
- `model/mineru/` 权重不动（git 忽略，可重复下载）。

## 关闭与归档

关闭条件：成功标准 1~6 达成。部署与探针路径事实并入 `local-model-management.md` 与
`scripts/image-model/README.md`；计划壳 Retain 归档 `history/plans/2026-09/`；todo 行移入
[completed.md](../../../trackers/completed.md)。
