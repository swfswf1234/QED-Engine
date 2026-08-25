# REQ-060 模型调用记录扩展与审核 UI

状态：已完成
任务类型：B
最后更新：2026-08-24
关联 ADR：无
关联设计：[llm-gateway-and-model-management.md](../../../design/llm-gateway-and-model-management.md)
关联 Tracker：docs/trackers/todo.md（REQ-060、PLAN-022）
归档判定：完成后并入 llm-gateway-and-model-management.md，计划壳归档

## 目标与成功标准

扩展 `qed_llm_calls` 共享表与模型调用记录页，支撑 prompt 优化模块的人工审核闭环：

1. 表扩展 4 列（task/step/review_status/review_note），写入与检索同步
2. GET /llm/calls 增加 task/step/prompt_template/review_status 过滤
3. 新增 PATCH /llm/calls/{id}/review 审核标注端点
4. 前端：筛选栏扩展 + 模板行分组 + 展开行内联审核 UI

成功标准：后端 pytest 全量通过（含新增审核/过滤用例）；前端 vitest/tsc/build 通过；
live 冒烟：GET /llm/calls 含新字段、PATCH /review 成功+不存在 404。

## 范围与非目标

- 范围：call_log.py schema/API、control.py 端点、LlmCalls.tsx UI、文档同步
- 非目标：prompt 模板构建逻辑（QED-Tracker 承接）；LLM 调用主流程改动；token 统计

## 前置条件

QED-Tracker Phase 0 完成（5 call sites 携带 template ID，318 passed）；
qed_llm_calls 表已存在（12 列），根仓库有权改 DDL。

## 工作项

### 后端 Schema 扩展

call_log.py：CREATE TABLE +4 列、INSERT +4 字段、record_call() +4 参数。
schemas.py：CallLogItem +4 字段。

### search_calls 扩展

4 新 WHERE 子句：task（精确）、step（精确）、prompt_template（LIKE）、review_status（精确）。
参数格式：位置参数列表（%s）。

### PATCH /review 端点

call_log.py：review_call() UPDATE review_status/review_note。
control.py：PATCH /llm/calls/{call_id}/review → 404 if not found。
schemas.py：ReviewCallRequest + ReviewCallResponse。

### 前端类型与 API

index.ts：LlmCallItem +4、LlmCallsQuery +4。
llm.ts：reviewCall() 函数。
llmCalls.ts：filters 扩展 + reviewItem action。

### 前端 UI

LlmCalls.tsx：筛选栏 +4 控件、模板行分组（虚拟组头行）、展开行审核区。

### 文档

database-design.md：qed_llm_calls 表 +4 行。
llm-gateway-and-model-management.md：表字段 + API 端点。

## 验证与验收

- pytest tests/test_llm_call_log.py tests/test_llm_endpoints.py 全绿
- pytest tests/contract 通过（plan/tracker governance）
- vitest 全量通过 + tsc 零错 + build 成功
- self-restart 8900 + live 冒烟：GET /llm/calls 含 task/step/review_status；PATCH /review 成功+404

## 回滚

新增列为可空，DROP COLUMN 即可回滚 schema；新增端点删除路由即可；
前端回退 LlmCalls.tsx 到旧版本。无破坏性变更。

## 关闭与归档

后端+前端+文档全部完成后，回执 QED-Tracker（提交号+测试输出），
todo REQ-060 标记已完成，计划归档至 history/plans/2026-08/。
