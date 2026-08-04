# dataset 目录约定

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-04
关联代码：根 `.gitignore`（`/dataset/*` 忽略，仅保留 `.gitkeep` 骨架）
关联测试：无（子项目各自契约测试守护其数据根行为）
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)

## 目的与边界

根 `dataset/` 是三个项目共享的数据目录。本文件定义其**项目子域**结构、命名与读写契约。
数据文件一律不入版本控制；子项目各自数据根指向本目录属后续改造（Phase 2/3）。

模型为**项目子域**：每个服务一个子域，域内使用统一职责词（`raw/` 成品、`meta/` 状态与索引、
`tmp/` 中间产物）。废弃早期"顶层共享 raw/parsed/meta 三层"草案——与"四服务独立部署"铁律一致。

## 目录结构

```text
dataset/                                # QED-Engine 根仓库（git 忽略，仅骨架）
├── qed-tracker/                        # QED-Tracker 数据根（默认 data_root，Phase 2 落地）
│   ├── raw/                            # 原始 PDF 成品区（唯一被外部读取的 PDF 区）
│   │   ├── books/
│   │   │   ├── inbox/                  # 通用搜索/URL 下载（无课程归属）
│   │   │   └── math-qe/<course-id>/    # 冻结目录：<catalog_id>/<course_id> 两层
│   │   ├── exercises/
│   │   │   └── inbox/                  # kind=exercise 的通用下载（与 books 分离）
│   │   └── papers/<year>/              # 论文按年份（YYYY；无年份归 unknown/）
│   ├── meta/                           # 全部 JSON 状态（替代现 .qed-tracker/）
│   │   ├── resources/<sha256>.json     # 单资源事实源（schema 不变）
│   │   ├── selections/<selection-id>.json   # 论文选择报告
│   │   ├── transfers/axiom/<sha256>.json    # Axiom 传输记录
│   │   └── tasks/<task-id>.json        # 后台任务状态（服务化轮新增）
│   └── tmp/
│       └── downloads/<task-id>.part    # 下载临时区：校验通过后原子落盘到 raw/
└── axiom-flow/                         # Axiom-Flow 数据根（Phase 3 落地）
    └── parsed/<document-id>/           # 解析产物（按文档标识组织，后续细化）
```

## 契约

| 子域 | 写入方 | 读取方 | 内容 |
| --- | --- | --- | --- |
| `qed-tracker/raw/` | QED-Tracker | Axiom-Flow、QED-Engine 前端 | 原始 PDF，保持来源完整性与校验信息 |
| `qed-tracker/meta/` | QED-Tracker | QED-Engine 前端 | 资源清单、选择报告、传输与任务记录 |
| `axiom-flow/parsed/` | Axiom-Flow | QED-Engine 前端 | 解析产物（页面事实、Markdown、manifest） |

## 强制规则

- 文件写入先写临时文件，校验通过后原子落盘（`tmp/downloads/` → `raw/`）；`tmp/` 不保留终态文件，任务结束时清理。
- 文件名规则：`<语义标识>_<sha256前8>.pdf`——教材/习题为标题 slug，论文为 arXiv ID；内容指纹保证同名同内容必然同路径，重复下载天然幂等。
- `raw/` 内文件不可变；改名或删除必须登记到 `meta/`。
- 文档标识使用内容哈希（SHA-256 前缀），保证可校验与去重。
- 存量数据不自动迁移：子项目改造只改默认值与新下载行为；用户已有数据根（如 `D:\coding\dataset\textbooks`）保持不动。
- dataset 内任何文件的增删改不影响三个项目的独立启动。
- 服务化后写操作任务记录登记目标相对路径（`meta/tasks/`），前端可"任务 → 文件"跳转。

## 现状与差距

- QED-Tracker 数据根当前为自身 `data/`（books/、papers/、.qed-tracker/），指向 `dataset/qed-tracker/` 属 Phase 2 改造；`.qed-tracker/` 状态目录届时语义化为 `meta/`。
- Axiom-Flow 产物当前为自身 `data/`（内容寻址目录），指向 `dataset/axiom-flow/parsed/` 属 Phase 3 改造。
