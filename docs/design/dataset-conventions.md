# dataset 目录约定

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-10
确认状态：暂定
关联代码：根 `.gitignore`（`/dataset/*` 忽略，仅保留 `.gitkeep` 骨架）、`.env.example`
（`QED_DATA_ROOT` 变量模板）
关联测试：无（子项目各自契约测试守护其数据根行为）
关联 ADR：[ADR 0002](../history/adr/v0.1/0002-frontend-and-port-centralization.md)、
[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)（元数据入 DB 与表命名空间）；
本规范由 [计划 2026-08-arch019-data-foundation](../history/plans/2026-08/2026-08-arch019-data-foundation.md)
设计正文经用户评审确定后迁入（2026-08-23，ADR 0011 流程）。

## 目的与边界

根 `dataset/` 是三个项目共享的**数据资料目录**（2026-08-16 用户裁决，ARCH-013 新模式）：

- **数据资料（文件）**：原始数据（下载的 PDF/快照）与**整理后的数据资料**（Axiom-Flow
  解析产物——知识探索、课程学习、课后练习的数据输入），全部不入版本控制。
- **元数据默认存数据库**（MySQL `qed` 库）：登记、状态、进度、评价、课程体系、任务记录等
  一律入 DB（表命名空间与所有权见 [../architecture/database-design.md](../architecture/database-design.md)），dataset 内
  不再维护 JSON 状态事实源（`meta/` 退役，存量迁移归档见 [REQ-032](../trackers/todo.md)）。

模型为**统一数据根 + 内容类型顶层**（2026-08-23 ARCH-019 用户评审确定）：三项目经
`QED_DATA_ROOT`（变量定义见 [project-configuration.md](project-configuration.md)）
指向同一物理目录，顶层按内容类型组织（`raw/` 原始区、`tmp/` 临时区、`parsed/` 整理后数据
资料），第二层为领域、第三层为课程。废弃早期"meta/ JSON 状态"、"资源登记双写"与
"项目子域"（`qed-tracker/`、`axiom-flow/` 子目录）方案。

## 目录结构

```text
<QED_DATA_ROOT>/                      # 默认 <workspace>/dataset（git 忽略）
├── raw/                              # 原始文件区（唯一被外部读取的 PDF/快照区；写入方 QED-Tracker）
│   └── <domain_id>/                  # 领域层：math（随体系扩展）
│       ├── <course_id>/              # 课程层：01_math_analysis …
│       │   └── <语义slug>_<sha256前8>.pdf
│       └── _general/                 # 领域级通用桶：无法归属课程的文件（含旧 inbox/papers 存量）
├── tmp/                              # 临时区（终态文件不保留，任务结束清理；按项目分桶）
│   ├── qed-tracker/downloads/<task-id>.part
│   ├── axiom-flow/<job-id>/
│   └── exploration/<对象名>探索.txt   # 探索发起文档（2026-08-23 ARCH-019 新增：用户手写
│                                     # 领域/课程探索参考，如「高等数学探索.txt」；可反复
│                                     # 使用，不参与自动清理）
└── parsed/                           # 解析产物区（写入方 Axiom-Flow）
    └── <domain_id>/<course_id>/<document-id>/
```

- **教程层的论文/相关资料类别由数据库表达**：教程（qt_knowledge）下的论文/延展资料是
  `qt_books` 行（kind=paper/blog/other）挂该 knowledge_id；界面按类别分组展示、无内容不显示
  该类别。文件系统不再按教程分层，也不设 books/exercises/papers 内容类型目录（元数据入 DB，
  ARCH-013 裁决；2026-08-23 ARCH-019 裁决收敛）。

## 契约

| 子域 | 写入方 | 读取方 | 内容 |
| --- | --- | --- | --- |
| `raw/<domain>/<course>/` | QED-Tracker | Axiom-Flow、QED-Engine 前端 | 原始数据（PDF/快照），保持来源完整性与校验信息；元数据（sha256/路径/状态）在 `qt_books` |
| `parsed/<domain>/<course>/<doc-id>/` | Axiom-Flow | QED-Engine 前端 | 整理后数据资料（页面事实、Markdown、manifest）；解析任务与质量元数据在 `af_*`（规划） |
| `tmp/<project>/…` | 各写入方自用 | — | 下载/解析中间产物，任务结束清理，不跨项目读取 |
| `tmp/exploration/` | 用户手工维护 | QED-Tracker（LLM 探索输入，经 ref_doc_path） | 探索发起文档（`<对象名>探索.txt`），用户资产不自动清理 |
| ~~`qed-tracker/meta/`~~ | — | — | **退役**（2026-08-16）：JSON 不再作为元数据事实源，存量迁移归档（REQ-032） |

## 强制规则

- 文件写入先写临时文件，校验通过后原子落盘（`tmp/qed-tracker/downloads/` → `raw/`）；`tmp/`
  不保留终态文件，任务结束时清理。
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
  元数据唯一事实源（统一数据库契约见 [../architecture/database-design.md](../architecture/database-design.md)）。

## 现状与差距

- **存量迁移已执行**（2026-08-23，方案 A 移动）：旧 `qed-tracker/raw/books/math-qe/<course>/`
  → `raw/math/<course>/`，旧 `books/inbox/`、`exercises/inbox/`、`papers/<year>/` 类无课程
  归属存量 → `raw/math/_general/`（清单与 sha256 比对留档 `backups/db/`，git 忽略）；旧
  `tmp/` 清空不迁移；DB 五表同批备份后清空重走一轮。
- QED-Tracker 落盘拼装改造为共享布局、`QED_DATA_ROOT` 映射接入属其侧请求（REQ-055 同批）；
  改造前其新下载仍写旧布局则视为缺陷。
- Axiom-Flow 产物当前为自身 `data/`（内容寻址目录），指向 `<root>/parsed/…` 属 Phase 3
  改造（ALN-003 合并扩展）。
