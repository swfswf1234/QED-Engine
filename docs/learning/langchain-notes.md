# LangChain 核心概念笔记

个人学习资料，不参与工程治理。

## 一句话定位

LangChain 是把"大模型调用"组装成"应用链路"的编排框架：它自己不提供模型，而是统一了
模型接口、记忆、工具、检索与任务链路的拼接方式。

## 核心组件

| 组件 | 作用 | 类比 |
| --- | --- | --- |
| Chat Models | 统一多供应商对话接口（OpenAI/DeepSeek/Qwen…） | 交换机 |
| Prompts / Templates | 把输入结构化为模型可消费的模板 | 表单 |
| Output Parsers | 把模型文本输出解析为结构化数据 | 解码器 |
| Chains / LCEL | 把各步骤串成可复用的管道 | 流水线 |
| Memory | 在多次调用间保留上下文 | 便签本 |
| Tools / Toolkits | 让模型调用外部函数（搜索、计算器） | 外挂技能 |
| Agents | 模型自主决定调用哪个工具、何时结束 | 自主执行者 |

## LCEL（LangChain Expression Language）

现代 LangChain 推荐的管道写法，用 `|` 组合组件：

```python
chain = prompt | model | parser
```

特点：惰性求值、支持并发、可流式、可观测、易于部署。

## 与 Agent 的关系

- Agent = 模型 + 工具列表 + 循环决策（ReAct 等）。
- 与"固定链"不同：链是静态流程，Agent 是动态决策。

## 与 QED 项目的关系

Axiom-Flow 未来做学习交互闭环（PRD-001）时，检索问答链路可参考 LCEL 组合方式；但模型调用
走 QED 配置中心的路由，不直接绑定 LangChain 的模型供应商逻辑。

## 参考资料

- LangChain 官方概念文档（agent/chain/memory 章节）
- 各供应商 Chat 模型接口差异对照
