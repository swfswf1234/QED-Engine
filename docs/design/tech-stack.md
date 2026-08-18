# 技术栈选型

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-09
关联代码：`web-ui/`（React 重构版，已接管 8903；后端三服务代码见各自契约文档）
关联测试：`tests/contract/test_design_documents.py`
关联 ADR：`docs/adr/0002-frontend-and-port-centralization.md`、`docs/adr/0003-shared-qed-database-independence.md`、`docs/adr/0005-control-center-service-hosting.md`

> 评估过程与对比实验记 `learning/`（个人笔记）；本文档只保存选型结论与理由。新增/替换技术先更新本文档再实现。

## 技术栈总览

| 类别 | 技术选型 | 用途 | 状态 |
| --- | --- | --- | --- |
| 后端框架 | Python + FastAPI | 8900 配置中心、8901 QED-Tracker、8902 Axiom-Flow 三服务 | 已用 |
| CLI | Python（标准库脚本） | `scripts/` 密钥检查、env 映射；qed 统一 CLI 规划中 | 已用（统一 CLI 规划） |
| 前端 | React 19 + AntD 5 + zustand + Vite | `web-ui/` 学习中心 + 管理后台（8903），构建产物 dist/ 由 serve_web.py 托管（ADR 0008） | 已用 |
| 数据库 | MySQL 8 共享 `qed` 库 | 三项目共用实例与库，`qt_*`/`af_*` 表命名空间隔离（[ADR 0003](../adr/0003-shared-qed-database-independence.md)） | 已用 |
| 数据库迁移 | Alembic（各项目独立） | 各项目在 `qed` 库内独立初始化自己的表 | 子项目侧落地中 |
| LLM 模型（单线路） | 默认档 qwen（主对话/OCR/Embedding 三用途） | 一次只用一条线路，暂不用备用线路（策略与模型名见 [configuration-and-secrets.md](configuration-and-secrets.md) 模型选择表） | 已用 |
| 文档解析 | MinerU | 布局识别、公式还原（Axiom-Flow） | 规划/实验（见 learning） |
| 向量数据库 | 未选定 | 学习中心知识问答 RAG 检索（候选评估中） | 规划 |
| 多 Agent 编排 | 未选定（LangChain 学习中） | 知识问答多 Agent（工具链方向与细化项见 [learning-center.md](learning-center.md) §2） | 规划 |
| 容器化 | 只进规划不展示 | 依赖托管（[ADR 0005](../adr/0005-control-center-service-hosting.md)） | 规划 |

## 选型记录

- **FastAPI 三服务统一**：8900/8901/8902 均 FastAPI `/api/v1`，形态一致、契约测试模式统一；
  轻量原生，避免引入重型框架（对比 Flask/Django 的评估见 `learning/`）。
- **原生前端无构建**：学习中心与管理后台目前规模可控，静态 SPA 零构建零依赖，浏览器直连后端
  无代理；框架化（Vue/React）评估延后到学习中心正式建设时（[learning-center.md](learning-center.md)）。
- **MySQL 8 共享 qed 库**：三项目数据集中登记与查询，表命名空间隔离保证独立性；见
  [ADR 0003](../adr/0003-shared-qed-database-independence.md) 与
  [database-design.md](database-design.md)。
- **模型单线路**：一次只启用一条线路（当前 qwen 三用途：主对话/OCR/Embedding），备用线路
  （GLM 切换、deepseek 占位）变量已注释，需要时按启用流程恢复；模型名唯一事实源为根 `.env`
  （见 [configuration-and-secrets.md](configuration-and-secrets.md)）。
- **MinerU**：Axiom-Flow 解析管线主选（布局 + 公式还原），评估与实验见 Axiom-Flow 仓库与
  `learning/`；最终结论由 Axiom-Flow 侧登记。
- **向量库/编排未定**：待学习中心 RAG 与多 Agent 需求明确后单独评估并补记本文件；候选
  （Milvus、LangChain 等）只进规划不展示为已选。

## 变化流程

1. 新增/替换技术：先在本文件登记（总览行 + 选型记录含理由与替代方案），涉及长期约束的按
   [ADR 治理规范](../standards/adr-governance.md) 评估是否登记 ADR。
2. 涉及模型名、环境变量、API 契约的变更：同步更新
   [configuration-and-secrets.md](configuration-and-secrets.md)、
   [config-center-api.md](config-center-api.md) 与相关契约测试。
3. 运行 `pytest tests/contract/test_design_documents.py -q` 并人工复核。
