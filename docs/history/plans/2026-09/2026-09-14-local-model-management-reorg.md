# 本地模型管理整理轮（local-model-management-reorg）

状态：Accepted
任务类型：B
最后更新：2026-09-14
关联 ADR：ADR 0007（前端唯一入口 8900）、ADR 0011（待评审设计先入 plans/）
关联设计：[local-model-management.md](../../../design/local-model-management.md)、[llm-gateway.md](../../../design/llm-gateway.md)、[api-contracts.md](../../../architecture/api-contracts.md)、[project-configuration.md](../../../design/project-configuration.md)、[admin-console.md](../../../design/admin-console.md)、[code-map.md](../../../architecture/code-map.md)
关联 Tracker：docs/trackers/todo.md（PLAN-042、DEFECT-003、ARCH-020）
归档判定：Merge（设计事实并入 local-model-management.md 等；计划壳 Retain 归档 `history/plans/2026-09/`）

> 本轮整理本地模型管理：修硬伤（TEXT_SCRIPT 指向已删除脚本）、Qwen 运行时切 llama.cpp、
> 定义槽位目录 + manifest 约定（换模型不动参数）、全量去 lm-studio、MinerU 清理核查。
> 部署（llama.cpp 安装/MinerU 容器重建）另起。

## 目标与成功标准

1. **修硬伤**：model_manager 指向的 TEXT_SCRIPT 恢复为存在的脚本，local 模式文字链路可启停。
2. **Qwen 运行时切 llama.cpp**：qed_qwen_service.py 用 llama-server 从 model/qwen/ 加载 GGUF，
   固定端口 5001（OpenAI 兼容），健康探测读 QED_QWEN_URL；缺 llama-server 时明确报错返回 1。
3. **槽位目录 + manifest**：model/<slot>/ 放具体模型，model/<slot>/manifest.json 声明启用模型与
   serve 参数；换模型只改目录/manifest，不动 env、不动 gateway/clients 调用链。
4. **全量去 lm-studio**：代码/测试/前端/非 history 文档不再残留 LM Studio 命名（GPU 进程白名单
   lm studio/lmstudio 保留并注明为兼容）。
5. **MinerU 清理核查**：确认权重只存在于 model/mineru/；文档写明镜像去模型化后的重建与部署路径。
6. 门禁全绿：后端 pytest + ruff、前端 vitest + tsc + build、tests/contract。

## 范围与非目标

- **范围**：model_manager.py、qed_qwen_service.py、test_qed_qwen_service.py、
  test_llm_model_manager.py、schemas.py、monitor.py、clients.py/gateway.py 注释、
  qed_engine_service.py 注释；前端 stores/index.ts、runtime.ts、api/services.ts、Console.tsx
  及测试；.env.example、.gitignore、AGENTS.md；docs/architecture 与 docs/design 相关段。
- **非目标**：llama.cpp 与 MinerU 容器的实际安装/部署/启停（另起）；history/ 文档；
  api 云端 QED_MODEL/QED_OCR_MODEL 语义；gateway/clients 的调用契约。

## 前置条件

- model/qwen/ 具体 GGUF 模型尚未放入（部署轮补入）；本次以脚本/manifest 契约与占位骨架交付。
- WSL 可用（MinerU 残留核查）。

## 工作项

### W0 硬伤修复（先红后绿）

- `model_manager.py:23`：TEXT_SCRIPT → `qed_qwen_service.py`。
- 补一条真实路径存在性断言测试（守护脚本存在），避免同类漂移。
- 登记 DEFECT-003。

### W1 Qwen 生命周期脚本重写（llama.cpp/llama-server）

- 重写 `qed_qwen_service.py`：
  - 读 `model/qwen/manifest.json` 定位模型目录与 serve 参数。
  - 启停 `llama-server`（固定端口 5001，OpenAI 兼容 `/v1`）。
  - 健康探测读 `QED_QWEN_URL`（修正当前读 `QED_LMSTUDIO_URL` 的 bug）。
  - `prog="qed_qwen_service"`，docstring 去 LM Studio。
  - 保留 start/stop/restart/status 子命令与退出码约定。
- 由于 llama.cpp 未安装，脚本对缺失 `llama-server` 给出明确提示并返回 1（与旧 lms 缺失语义一致）。
- 更新 `tests/test_qed_qwen_service.py`：断言 manifest/llama-server/健康探测，去掉 lms 断言。

### W2 槽位目录 + manifest 约定

- `model/qwen/<具体模型>/`（GGUF）+ `model/qwen/manifest.json`（声明 active、serve 参数）。
- MinerU 侧：`model/mineru/` 已含具体模型；补 `model/mineru/manifest.json`（声明 active 与容器挂载布局）——本次仅补骨架（部署另起）。
- 约定写入 local-model-management.md。
- 参数解耦：env 只存端点（QED_QWEN_URL/QED_MINERU_URL），换模型只改目录/manifest，不动 env、不动 gateway/clients 调用链；QED_MODEL/QED_OCR_MODEL 仅 api 云端。

### W3 全量改名（非 history）

- 代码：schemas.py LmStudioStatus→QwenStatus；control.py 导入/响应模型；monitor.py 注释；clients.py/gateway.py/model_manager.py 注释；qed_engine_service.py 注释。
- 前端：stores/index.ts、runtime.ts、api/services.ts、Console.tsx（标签「Qwen（LM Studio）」→「Qwen」）、相关测试。
- GPU 进程名白名单：保留 lm studio/lmstudio（历史进程仍可能占用显存，分类正确），但在注释注明为兼容保留。
- 配置：.env.example:5、.gitignore:13 注释。
- AGENTS.md:44 监控端点列表 lmstudio→qwen。
- docs：api-contracts.md（含 :673 QED_LMSTUDIO_URL→QED_QWEN_URL）、code-map.md、llm-gateway.md、project-configuration.md:52、operations.md:230、admin-console.md:74、document-chunking-recall.md:78、local-model-management.md。
- history/ 文档不动。

### W4 MinerU 清理核查（只清理+文档）

- WSL 侧核查：docker images | grep mineru、docker ps -a、卷、宿主缓存，确保权重只在 model/mineru/。
- 更新 scripts/image-model/README.md 与 local-model-management.md，明确：镜像去模型化后需重建（docker build），部署与启停另起。
- 不动 compose.yaml 的 image: mineru:latest（重建后可用）。

### W5 测试与门禁

- 后端：conda run -n QED_env python -m pytest tests -q + ruff check backend tests
- 前端：cd web-ui && npm test + npx tsc --noEmit + npm run build
- 契约：pytest tests/contract -q

### W6 文档与台账

- 新增 plan；todo 新增节（放在 ARCH-020 之前）；project-status、roadmap、plans/index 同步。
- design 晋升：local-model-management.md 更新为槽位+manifest+llama.cpp。

## 验证与验收

- 后端：`conda run -n QED_env python -m pytest tests -q` 全绿 + `ruff check backend tests` 干净。
- 前端：`cd web-ui && npm test` + `npx tsc --noEmit` + `npm run build` 全绿。
- 契约：`pytest tests/contract -q` 全绿。
- 人工：local 模式下 qed_qwen_service status 能对 llama-server 正确判定（部署轮复验）。

## 回滚

- 代码改动可独立 revert；文档改动由 Git 锚点恢复；model/ 内容 git 忽略，无数据风险。

## 关闭与归档

- 关闭条件：成功标准 1~6 达成、门禁全绿。
- 归档动作：设计事实并入 local-model-management.md；计划壳 Retain 归档 `history/plans/2026-09/`；
  todo 行移除并在 plans/index.md 登记去处。
