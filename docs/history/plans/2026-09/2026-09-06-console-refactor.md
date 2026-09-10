# 控制台重构与资源监控改造（console-refactor）

状态：In Progress
任务类型：D
最后更新：2026-09-06
关联 ADR：[ADR 0002](../../adr/v0.1/0002-frontend-and-port-centralization.md)、[ADR 0007](../../adr/v0.1/0007-qed-engine-backend-gateway.md)、[ADR 0008](../../adr/v0.1/0008-frontend-react-refactor.md)
关联设计：[service-control.md](../../../design/service-hosting.md)、[llm-gateway-and-model-management.md](../../../design/llm-gateway.md)、[frontend-architecture.md](../../../architecture/frontend-architecture.md)
关联 Tracker：docs/trackers/todo.md（本计划行 PLAN-032；PLAN-030 内容已被本计划承接，归档由用户在本轮结束裁定）
归档判定：用户确认后迁入 `design/`（console.md + model-service-management.md），计划壳归档 history/plans/2026-09/

> **实现说明**：本文档采用 TDD 逐任务执行（见 AGENTS.md 协作流程：brainstorm → design/writing-plans → executing-plans）。
> 门禁：后端 `conda run -n QED_env python -m pytest tests -q` + `ruff check backend tests scripts`；
> 前端 `cd web-ui && npm run build` + `npm test` + `npx tsc --noEmit`。
>
> **用户裁决（2026-09-06，本轮全部遵守）**：
> - 分区顺序：服务管理 → 基础设施 → 资源总览 → 本地模型
> - web 服务仅重启（无启动；前端不可达时启动无意义）；config 仅重启；tracker/axiom 启停重启
> - api 模式：文字/图像模型显示云端厂商、仅测试（无启停）；local 模式：启停/重启/测试
> - 模型端点路径用模型名：`/models/{qwen|mineru}`
> - 逐进程显存：PDH 计数器为主（分配口径，任务管理器同源）；指标行整卡用 nvidia-smi 物理驻留口径
> - 利用率：`\GPU Engine(*)\Utilization Percentage`（任务管理器同源），替代 WDDM 失真 nvidia-smi
> - 非模型任务：单项占比 ≤10% 聚合为「其他任务」；>10% 单独列示
> - 全部经 8900 聚合（ADR 0007）；未来组件（向量库/知识图谱）容器化轮再定

## 目标与成功标准

控制台重构为「服务管理 + 资源监控」两大职责：四服务管理、基础设施（MySQL）探测、
GPU/显存/系统内存资源总览（解决「占比未知」）、本地模型（LM Studio/MinerU）生命周期管理。

成功标准：
1. 控制台四区：服务管理（四服务）/ 基础设施（MySQL）/ 资源总览（GPU+内存）/ 本地模型（LM Studio/MinerU）
2. 逐进程显存真实值（任务管理器口径），不再出现「占比未知」
3. 模型区支持启停/重启 + 测试 + 显存摘要；api 模式仅测试
4. 全部操作经 8900 聚合（ADR 0007）
5. 门禁全绿：pytest + vitest + tsc + build + ruff + contract

## 范围与非目标

**范围**：①`/monitor/gpu` 改造（PDH 逐进程显存 + 利用率切换）；②模型端点族 `/models/{name}`；
③前端四区重构 + 模型卡;④`model/` 目录 + MinerU 外迁；⑤`design/console.md` + `design/model-service-management.md` 晋升；
⑥PLAN-030 归档。

**非目标**：服务注册表类型化改造（容器化轮再定）；MySQL 启停（本期仅探测+测试）；
向量库/知识图谱（roadmap 第四轮）。

## 前置条件

1. 生命周期脚本已验证：scripts/text-model/（qed_lmstudio_service.py）、scripts/image-model/（qed_mineru_service.py）
2. 控制台现状：web-ui/src/pages/Console.tsx、stores/runtime.ts、components/GpuOverview.tsx
3. 本机实测（2026-08-21）：nvidia-smi 在 WDDM 下逐进程显存为 [N/A]（无法取）；Windows 性能计数器
   `\GPU Process Memory(*)\Dedicated Usage` 可逐 pid 取显存（任务管理器同源）

## 工作项

> TDD 按以下顺序执行（每项含失败测试 → 最小实现 → 验证）。

### 1. monitor.py PDH 探测（逐进程显存 + 利用率）

- 新增 `parse_pdh_process_memory`（按 pid 聚合，同 pid 多 luid/phys 取最大）、`parse_pdh_utilization`
  （取非零 sample 最大值）、`probe_pdh`（调用 PowerShell Get-Counter，runner 可注入，失败降级）
- 测试入口：`tests/test_monitor.py`（5 用例）；PDH 计数器在测试环境经 `tests/conftest.py` 打桩
  `monitor.subprocess.run` 避免真实调用

### 2. probe_gpu 集成 PDH（解决占比未知）

- `probe_gpu` 新增 `pdh_fn` 参数：processes[].memory_mb 用 PDH 按 pid 匹配（缺失回落 None）；
  利用率用 PDH 且响应带 `utilization_source`（"pdh"|"nvidia-smi"）
- 同步更新 `test_gpu_ok_parses_fields` 断言（增加 utilization_source）

### 3. 进程名补全（[Insufficient Permissions] → 真实名）

- 新增 `resolve_process_name(pid)`（tasklist CSV 按 pid 取真实名），`probe_gpu` 对 `[Insufficient Permissions]`
  行补全；`tasklist_fn` 可注入

### 4. model_manager.operate_model(name, op) 统一入口

- `MODEL_SCRIPTS = {qwen: TEXT_SCRIPT, mineru: IMAGE_SCRIPT}`；start/restart 复用
  `ensure_text_ready`/`ensure_image_ready`（互斥已含）；stop 直调脚本；未知 name/op 抛 ValueError
- 测试：`tests/test_llm_model_manager.py`（7 用例）

### 5. control.py 模型端点族 /models/{name}

- `POST /models/{name}/start|stop|restart`；api 模式 409；未知 name 404；经 `model_manager.operate_model`
- 测试：`tests/test_llm_endpoints.py`（5 用例：local 200 / api 409 / 未知 404）

### 6. 前端 store + API 封装（模型操作）

- `stores/index.ts`：`ModelName`/`ModelOp`/`ModelActionResponse` 类型
- `api/llm.ts`：`operateModel(name, op)` 封装
- `stores/runtime.ts`：`operateModel` action（复用 operate 收敛语义，目标态用探针 reachable）

### 7. 前端四区重构 + 模型卡 + 非模型聚合

- `GpuOverview.tsx`：`partitionOtherProcs`（≤10% 合并「其他任务」）+ 利用率 Tooltip 口径说明
- `Console.tsx`：四区（服务管理 → 基础设施 → 资源总览 → 本地模型）；ServiceCard web 仅重启；
  ModelCard（启停/重启 + 测试 + 显存摘要）
- 测试：`GpuOverview.test.tsx`（partitionOtherProcs 3 用例）、`Console.test.tsx`（同步四区/模型卡/聚合断言）

### 8. model/ 目录 + .gitignore + MinerU 外迁

- `.gitignore` 加 `/model/*`（保留骨架）；`model/lm-studio/`、`model/mineru/`（.gitkeep）
- `scripts/image-model/download-models.py`、`README.md`；Dockerfile 去固化模型；compose.yaml 加卷挂载
- 镜像重建冒烟（WSL `docker build` + `infra-up.ps1`）**需用户在场**

### 9. 文档晋升 + PLAN-030 归档

- 晋升 `design/console.md`、`design/model-service-management.md`（Accepted/暂定）
- 同步 code-map DesignRef；PLAN-030 归档 history/plans/2026-09/；todo/plans/index 更新

## 验证与验收

1. 后端：`pytest tests -q` 全绿（含 contract）+ `ruff check backend tests scripts` 干净
2. 前端：`npm run build` + `npm test` + `npx tsc --noEmit` 全绿
3. 契约：`pytest tests/contract -q` 全绿（API inventory 登记 /models 端点、code-map 同步、计划治理元数据）
4. 人工：8903 `#/admin` 四区渲染、模型启停反馈、显存摘要、api/local 模式切换

**已知阻塞**：`web-ui/src/pages/Downloads.test.tsx` 全量 vitest 挂起（>500s，pool=forks 无效）。
该文件为工作区既有未提交改动，与本次改造无关，需另议修复后解锁全量前端门禁。

## 回滚

代码经 git 回滚；model/ 外迁如破坏重建镜像流程，回退 Dockerfile 为固化模型模式并移除挂载。

## 关闭与归档

控制台布局与模型服务管理迁入 `design/`（暂定），计划壳归档 history/plans/2026-09/。
