# 文档与代码双向追溯规范

状态：Current
最后更新：2026-08-30
确认状态：已确认
治理对象：code-map、模块 DesignRef 和语义同步门禁
依据 ADR：`../history/adr/v0.1/0001-root-contract-tests.md`
关联测试：`tests/contract/test_code_document_mapping.py`、`tests/contract/test_api_endpoint_inventory.py`
移出内容暂存：`../plans/2026-08-30-traceability-refactor.md`（ARCH-NNN/DES-NNN 规则待归入
architecture/ 或 design/ 维护规则）

## 目的与边界

本标准让人和 Agent 能从代码定位设计依据，也能从设计定位实际代码与测试。
`docs/architecture/code-map.md` 是代码、设计与测试映射的唯一事实源；文件头 DesignRef 只用于
阅读代码时反查，不是第二份映射表。文档分类查[文档治理规范](doc-governance.md)，决策准入查
[ADR 治理](adr-governance.md)。

架构/设计文档的内容质量标准（ARCH-NNN/DES-NNN 登记、关联代码与 ADR 等）已从本标准移出，
待评审后归入各自领域维护规则。

## 强制规则

### code-map 与文件头

- 所有受管且非豁免模块必须在 code-map 恰好登记一次；新增、移动、删除模块或改变 DesignRef
  时，同步更新 code-map、文件头和关联测试。
- 非豁免 Python 模块在首个 import 前使用中文模块 docstring，声明模块职责、
  `设计关联（DesignRef）` 和实现状态；测试模块还声明被测代码。
- `__init__.py`、纯常量和极短无业务语义文件可豁免，但不得承载业务规则。
- 外部工具存在编码约束的配置文件使用 ASCII `DesignRef:` 和 `Status:`；中文职责保留在
  code-map 与关联设计。

推荐 Python 文件头：

```python
"""
模块职责：说明本模块承担的业务或技术责任。
设计关联（DesignRef）：docs/design/example.md
实现状态：Current
"""
```

## 执行与门禁

1. 修改代码前：先在 code-map 定位模块职责、DesignRef、状态和定向测试。
2. 新增/移动/删除模块或改变职责时：同步更新 code-map、文件头和关联测试。
3. 职责或契约变化时：先完成适用 ADR/设计，再同步实现、文件头、code-map 和语义测试。
4. `tests/contract/test_code_document_mapping.py` 守护受管路径、文件头和双向引用。

## 变更与取代

改变 code-map 的事实源地位、受管范围、文件头必需字段、同步触发项或语义门禁时必须先新增 ADR。
模块清单和 DesignRef 的普通增删属于实现同步，不单独建立治理 ADR。旧映射由 Git 历史恢复，
Legacy 依据只进入 History，不在 standards 保存版本副本。
