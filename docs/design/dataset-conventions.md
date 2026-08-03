# dataset 目录约定

设计状态：Draft
实现状态：Not Started
最后更新：2026-08-04
关联代码：根 `.gitignore`（`/dataset/*` 忽略，仅保留 `.gitkeep`）
关联测试：无
关联 ADR：无

## 目的与边界

根 `dataset/` 是三个项目共享的数据目录：存放原始文档与解析产物。本文件定义其目录结构、
命名与读写契约。数据文件一律不入版本控制；子项目写入根 dataset 属后续改造，当前各自
数据仍写入自身 `data/`。

## 目录结构

```text
dataset/
├── raw/       # 原始 PDF：由 QED-Tracker 写入，Axiom-Flow 读取
│   ├── books/      # 教材/习题集
│   └── papers/     # 论文（按年份组织）
├── parsed/    # 解析产物：由 Axiom-Flow 写入，QED-Engine 读取
│   └── <document-id>/   # 按文档标识组织（后续细化）
└── meta/      # 清单与索引：由写入方维护
```

## 契约

| 目录 | 写入方 | 读取方 | 内容 |
| --- | --- | --- | --- |
| `raw/` | QED-Tracker | Axiom-Flow | 原始 PDF，保持来源完整性与校验信息 |
| `parsed/` | Axiom-Flow | QED-Engine | 解析产物（页面事实、Markdown、manifest） |
| `meta/` | 写入方 | 各项目 | 资源清单与索引（JSON） |

## 强制规则

- 文件写入先写临时文件，校验通过后原子落盘（与子项目现有做法一致）。
- `raw/` 内文件保持不可变，改名或删除必须登记到 `meta/`。
- 文档标识建议使用内容哈希（SHA-256 前缀），保证可校验与去重。
- dataset 内任何文件的增删改不影响三个项目的独立启动。
- 目录结构细化（parsed 内部布局、meta 索引 schema）在设计定稿后补充，变更需更新本文件。

## 现状与差距

- QED-Tracker 数据根当前为自身 `data/`（books/、papers/、.qed-tracker/），指向 `dataset/raw/`
  属后续改造。
- Axiom-Flow 产物当前为自身 `data/`（内容寻址目录），指向 `dataset/parsed/` 属后续改造。
