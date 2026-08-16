# dataset 目录约定

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-16
关联代码：根 `.gitignore`（`/dataset/*` 忽略，仅保留 `.gitkeep` 骨架）
关联测试：无（子项目各自契约测试守护其数据根行为）
关联 ADR：[ADR 0002](../adr/0002-frontend-and-port-centralization.md)、
[ADR 0003](../adr/0003-shared-qed-database-independence.md)（元数据入 DB 与表命名空间）

## 目的与边界

根 `dataset/` 是三个项目共享的**数据资料目录**（2026-08-16 用户裁决，ARCH-013 新模式）：

- **数据资料（文件）**：原始数据（下载的 PDF/快照）与**整理后的数据资料**（Axiom-Flow
  解析产物——知识探索、课程学习、课后练习的数据输入），全部不入版本控制。
- **元数据默认存数据库**（MySQL `qed` 库）：登记、状态、进度、评价、课程体系、任务记录等
  一律入 DB（表命名空间与所有权见 [database-design.md](database-design.md)），dataset 内
  不再维护 JSON 状态事实源（`meta/` 退役，存量迁移归档见 [REQ-032](../trackers/todo.md)）。

模型为**项目子域**：每个服务一个子域，域内使用统一职责词（`raw/` 原始数据、`tmp/` 中间
产物、`parsed/` 整理后数据资料）。废弃早期"meta/ JSON 状态"与"资源登记双写"方案。

## 目录结构

```text
dataset/                                # QED-Engine 根仓库（git 忽略，仅骨架）
├── qed-tracker/                        # QED-Tracker 数据根（默认 data_root）
│   ├── raw/                            # 原始数据区（唯一被外部读取的 PDF/快照区）
│   │   ├── books/
│   │   │   ├── inbox/                  # 通用搜索/URL 下载（无课程归属）
│   │   │   └── math-qe/<course-id>/    # 冻结目录：<catalog_id>/<course_id> 两层
│   │   ├── exercises/
│   │   │   └── inbox/                  # kind=exercise 的通用下载（与 books 分离）
│   │   └── papers/<year>/              # 论文按年份（YYYY；无年份归 unknown/）
│   └── tmp/
│       └── downloads/<task-id>.part    # 下载临时区：校验通过后原子落盘到 raw/
│   （meta/ 已退役：JSON 不再是事实源，存量由 QED-Tracker 迁移归档，REQ-032）
└── axiom-flow/                         # Axiom-Flow 数据根
    └── parsed/<document-id>/           # 整理后数据资料：解析产物（页面事实、Markdown、
                                        # manifest）——学习中心/知识探索的输入（Phase 3，ALN-003）
```

## 契约

| 子域 | 写入方 | 读取方 | 内容 |
| --- | --- | --- | --- |
| `qed-tracker/raw/` | QED-Tracker | Axiom-Flow、QED-Engine 前端 | 原始数据（PDF/快照），保持来源完整性与校验信息；元数据（sha256/路径/状态）在 `qt_books` |
| `axiom-flow/parsed/` | Axiom-Flow | QED-Engine 前端 | 整理后数据资料（页面事实、Markdown、manifest）；解析任务与质量元数据在 `af_*`（规划） |
| ~~`qed-tracker/meta/`~~ | — | — | **退役**（2026-08-16）：JSON 不再作为元数据事实源，存量迁移归档（REQ-032） |

## 强制规则

- 文件写入先写临时文件，校验通过后原子落盘（`tmp/downloads/` → `raw/`）；`tmp/` 不保留
  终态文件，任务结束时清理。
- 文件名规则：物理名 `display_title` 的 slug + sha256 前 8（`<语义标识>_<sha256前8>.pdf`——
  教材/习题为标题 slug，论文为 arXiv ID）；展示名与物理名分离（用户界面只见展示名，
  QED-031 裁决）；内容指纹保证同名同内容必然同路径，重复下载天然幂等。
- `raw/` 内文件不可变；改名或删除必须登记（DB `qt_books` 更新，不再依赖 meta/ JSON）。
- 文档标识使用内容哈希（SHA-256 前缀），保证可校验与去重。
- 存量数据不自动迁移：子项目改造只改默认值与新下载行为；用户已有数据根（如
  `D:\coding\dataset\textbooks`）保持不动。
- dataset 内任何文件的增删改不影响三个项目的独立启动。
- 服务化后写操作任务记录登记目标相对路径（DB `qt_books.relative_path`），前端可
  "任务 → 文件"跳转。
- **元数据入 DB**：登记顺序先落盘后登记（`raw/` → DB），失败可重放（幂等）；DB 为
  元数据唯一事实源（统一数据库契约见 [database-design.md](database-design.md)）。

## 现状与差距

- QED-Tracker 数据根已迁 `dataset/qed-tracker/`（QED-009 落地，books/、exercises/、papers/、
  tmp/ 按本契约组织）；`meta/` JSON 退役与存量归档在子项目侧承接（REQ-032，QED-031 迁移
  已含主链路 JSON 并入新表）。
- Axiom-Flow 产物当前为自身 `data/`（内容寻址目录），指向 `dataset/axiom-flow/parsed/` 属
  Phase 3 改造（ALN-003）。
