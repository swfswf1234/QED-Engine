# 测试架构与门禁

状态：Current
最后更新：2026-09-11
确认状态：已确认
治理对象：测试职责、分层、隔离、替身、门禁与覆盖率证据；治理契约测试的守护面清单、契约头、编写约定与新增流程
依据 ADR：`../history/adr/v0.1/0001-root-contract-tests.md`、`../history/adr/v0.1/0006-engineering-governance-contract.md`
关联测试：`tests/contract/test_test_suite_governance.py`

## 目的与边界

本标准定义根仓库 `tests/` 如何保护已经采纳的确定性契约（配置中心 API 与文档治理规则），并规定
「治理契约测试」的编写规范：把标准正文中的强制规则翻译为可执行断言，防止规则漂移。外部模型、
提示词或候选路线的质量由冻结评测回答，测试不能替代评测。可复制命令只在
[开发指南](../guides/development.md)维护。

边界：
- 本标准管「全部测试的架构与门禁」与「治理契约测试的守护面清单、契约头、编写约定与新增流程」，
  两者统一维护于此，不再拆分独立标准（原 governance-contract.md 已并入，见
  [历史索引](../history/index.md)）。
- 标准/ADR/计划等文档的元数据规则在其对应标准正文，本标准不重复（一个事实只设一个维护位置）。
- 守护面清单的唯一维护位置在本标准；`tests/contract/test_test_suite_governance.py` 从其提取清单
  常量源。

## 强制规则

### 测试分层

| 层级 | 职责 | 允许依赖 | 禁止事项 |
| --- | --- | --- | --- |
| `unit` | 配置解析、API 行为与错误处理 | 内存对象、确定性 fake | MySQL、进程、外部网络 |
| `contract` | 文档治理、DesignRef 与文档语义 | 仓库源码与文档 | 运行数据库、业务工作流 |

当前根仓库实现规模小：配置中心行为测试直接位于 `tests/` 根目录（不强制迁移到 `unit/`）；
文档治理测试位于 `tests/contract/`。后续新增集成层（MySQL、HTTP 适配器）或系统层时，再按
Axiom-Flow 分层模式建立 `integration/`、`system/`、`smoke/` 并登记 ADR。

### 隔离与替身

- 自动测试不得调用外部模型服务，不得要求 API key，不得写入 `dataset/` 或运行数据库。
- 契约测试只解析仓库内文档与源码，不发起网络请求、不加载生产应用。
- 测试不依赖工作目录之外的绝对路径；相对仓库根的路径通过 `Path(__file__)` 推导。

### 门禁与覆盖率

- 根仓库当前无 CI（CI 建立见任务台账）；提交前本地执行 `pytest tests -q` 与 `ruff check backend
  tests`，两者必须全绿。
- 文档治理类变更必须运行 `tests/contract/` 全部契约测试。
- 覆盖率作为盲区证据保存，不设置 `fail-under`；覆盖率不能替代关键状态转换、错误路径和回滚
  场景测试。

### 治理契约

#### 守护面清单

| 治理面 | 守护内容 | 契约测试 |
| --- | --- | --- |
| 文档结构与导航 | 文档目录边界、index 入口、命名稳定、AGENTS 协议单一、Markdown 链接有效 | `test_document_structure.py`、`test_markdown_links.py` |
| 标准治理 | standards/ 目录边界、标准统一元数据与章节、索引镜像、AGENTS 路由 | `test_standard_governance.py` |
| ADR 治理 | ADR 编号单调、元数据完整、索引登记、取代关系双向、章节顺序 | `test_adr_governance.py` |
| 计划与任务治理 | 计划命名/元数据/生命周期、任务 ID 稳定唯一、todo 镜像活跃计划、roadmap 无状态 | `test_plan_governance.py`、`test_tracker_governance.py` |
| 架构与设计追溯 | 架构/设计元数据、Mermaid 视图、代码-文档-测试双向映射（DesignRef）、8900 端点清单与 api-contracts 双向一致 | `test_architecture_documents.py`、`test_design_documents.py`、`test_code_document_mapping.py`、`test_api_endpoint_inventory.py` |
| 测试工程与门禁 | 测试目录边界与分层、pytest 配置、契约测试自身规范 | `test_test_suite_governance.py` |
| 跨项目协作 | 子项目独立 git、根仓库不越权、todo 请求标注目标仓库、模板字段 | `test_cross_project_collaboration.py` |
| 文档与测试一致性 | 文档中声明的规范格式（如正则）与契约测试中的实际实现保持一致，防止 doc/test 漂移 | `test_doc_test_id_alignment.py` |

- 表格固定 3 列（治理面 / 守护内容 / 契约测试），首行为表头。
- 新增治理面或既有治理面新增守护对象时，更新本清单与对应契约测试。

#### 契约头

每个契约测试文件以 docstring 声明完整契约头（六字段）：

```
"""
模块职责：<验证什么保持一致>
设计关联（DesignRef）：docs/standards/<对应标准>.md
实现状态：Current
被测代码：<守护对象路径，多个用顿号分隔>
守护面：<守护面清单中的治理面>
失效后果：<测试失败说明哪条治理规则被违反>
"""
```

- DesignRef 指向守护的核心标准；同一文件被多个标准关联时，可声明多行 DesignRef（第一行为
  核心标准）。
- 「实现状态」必须为 Current；历史守护场景进入 `history/` 后不再守护。

#### 编写约定（自包含与零依赖）

- 只使用 Python 标准库（`pathlib`、`re`），不引入额外依赖。
- 文件自包含：不依赖 `tests/contract/` 内共享 helper 或 support 目录；辅助函数（如 `_field`、
  `_records`）允许在各文件内重复编写。
- 仓库相对路径一律通过 `ROOT = Path(__file__).resolve().parents[2]` 推导，不依赖工作目录。
- 只解析仓库内文档与源码，不发网络请求、不加载生产应用（与「隔离与替身」规则一致）。
- 断言失败消息指明违规对象与路径，便于定位。

#### 新增/修改契约测试的流程

1. 治理规则变化：按 [ADR 治理规范](adr-governance.md) 判断是否需新增 ADR，修改对应标准正文。
2. 确定守护对象：明确新规则守护哪个治理面、哪个文档/代码对象（先列清单，再写断言）。
3. 编写契约测试（契约头 + 断言新规则），运行该文件确认红（规则尚未生效或对象未满足）。
4. 修改标准正文或文档，运行契约测试确认绿（先红后绿）。
5. 运行 `pytest tests/contract/` 全量，确认新旧守护全绿。
6. 同步登记：标准索引（index.md）的「自动门禁」列、AGENTS.md 文档入口（如需）、相关标准的
   「关联测试」字段。
7. 涉及新治理面时更新守护面清单。

#### 三项目复用（范本）

本规范为三项目可复用范本：子项目按其文档体系复制适配——

1. 复制本规范，调整 `ROOT` 推导深度与目录名；
2. DesignRef 指向子项目自己的标准；
3. ADR 编号按子项目独立编号；
4. 守护面清单按子项目实际文档目录裁剪；
5. 契约头六字段与编写约定原样保留（不降级）。

子项目对齐请求以根仓库 todo 登记（见[跨项目协作规范](cross-project-collaboration.md)），
在其仓库内实现并遵守其门禁。

## 执行与门禁

1. 新测试先选择唯一层级，再在 code-map 和被测模块文件头登记稳定路径。
2. 契约测试只使用 Python 标准库（`pathlib`、`re`），不引入额外依赖。
3. 可复现缺陷先补入相应层级的回归测试；外部质量失败进入评测或 tracker，不写成不稳定测试。
4. 新增或修改文档治理规则时，同步更新对应契约测试并运行 `tests/contract/` 全量。
5. 契约测试属于 `tests/` 门禁范围：`pytest tests -q` 与 `ruff check backend tests` 必须全绿。

## 变更与取代

- 改变分层职责、契约测试范围、外部网络禁令或门禁必需阶段时必须先新增 ADR。
- 改变守护面清单结构（列数/列名）、契约头字段、编写约定禁令或新增流程的实质规则时必须先
  新增 ADR。
- 目录内普通测试增删、命令勘误、措辞勘误与链接修复属于实现同步，可直接修改。
