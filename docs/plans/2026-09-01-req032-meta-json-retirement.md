# REQ-032 meta/ JSON 退役计划

状态：In Progress
最后更新：2026-09-01
任务类型：B
关联 ADR：[ADR 0011](../history/adr/v0.1/0011-pending-design-location.md)
关联设计：`../design/dataset-conventions.md`、`../architecture/database-schema.md`
关联 Tracker：docs/trackers/todo.md（REQ-032）
归档判定：Phase 1+2 完成后阶段归档；Phase 3（Inventory→qt_books）暂缓

## 目标与成功标准

Phase 1+2 已完成（2026-09-01）：TaskStore→qt_tasks + SelectionStore→qt_selections，迁移 0016/0017，测试通过，tasks/selections 已归档。
Phase 3（Inventory→qt_books）暂缓（用户确认 qt 系列表非当前范围）。

## 范围与非目标

**范围**：退役 meta/ 下四类 JSON 文件（resources / selections / transfers / tasks），迁移至 qt_* 表。
**非目标**：Inventory→qt_books（Phase 3，暂缓）。

## 前置条件

ARCH-013 D3 裁决（2026-08-16）：元数据默认存数据库。

## 工作项

Phase 1（TaskStore→qt_tasks）：已完成。
Phase 2（SelectionStore→qt_selections）：已完成。
Phase 3（Inventory→qt_books）：暂缓。

## 验证与验收

1. QED-Tracker 测试通过（test_api.py、test_profiles_and_selections.py、test_paper_application.py、test_db_models.py）
2. meta/tasks/selections 已归档

## 回滚

从 qt_tasks/qt_selections 恢复数据至 meta/ JSON 文件。

## 关闭与归档

Phase 1+2 完成后阶段归档至 history/plans/。

## 背景

ARCH-013 D3 裁决（2026-08-16）：**元数据默认存数据库**，`dataset/qed-tracker/meta/` 不再作为元数据事实源。
`meta/` 下四类 JSON 文件（resources / selections / transfers / tasks）由 QED-Tracker 迁移归档后退役。

## 已完成（Phase 1+2，2026-09-01）

### Phase 1：TaskStore → qt_tasks

- **ORM 模型**：`QED-Tracker/src/qed_tracker/db/models.py` 新增 `QtTask` 类
- **迁移脚本**：`0016_qt_tasks.py`（alembic）
- **读写层重构**：`api/tasks.py` — `TaskStore` 从 JSON 文件读写改为 SQLAlchemy 读写 `qt_tasks` 表
- **应用层适配**：`api/main.py` — `Application.__init__` 重构，session_factory 提前建立；TaskStore 使用数据库连接；无 MySQL 时 SQLite in-memory fallback（兼容测试）
- **config.py**：`degradation_notice()` 更新 MySQL 为必选
- **测试更新**：`test_api.py` — 任务持久化测试改为检查 API 状态（非 JSON 文件）

### Phase 2：SelectionStore → qt_selections

- **ORM 模型**：`db/models.py` 新增 `QtSelection` 类（15 列，含 error 字段）
- **迁移脚本**：`0017_qt_selections.py`（alembic）
- **读写层重构**：`selection_store.py` — `SelectionStore` 从 JSON 文件读写改为 SQLAlchemy 读写 `qt_selections` 表
- **应用层适配**：`application/papers.py` — `PaperService` 新增 `session_factory` 参数；无 MySQL 时 SQLite fallback
- **测试更新**：`test_profiles_and_selections.py`、`test_paper_application.py` — 使用 SQLite session_factory

### 数据归档

- `dataset/qed-tracker/meta/tasks/`（5 个历史 JSON 文件）→ `meta/archive/2026-09-01-req032/`
- `dataset/qed-tracker/meta/selections/` 已移除（空目录）

### 测试验证

QED-Tracker 全量测试通过（仅 1 个 pre-existing 文档链接失败，与本次改动无关）。

## 暂缓（Phase 3：Inventory → qt_books）

### 为何暂缓

Inventory（`meta/resources/`）与 `qt_books` 语义不同：
- **Inventory**：通用文件清单，按 SHA-256 哈希索引 PDF 文件，记录 `relative_path`、`sha256`、`size_bytes`、`page_count`，支持 `register`/`verify`/`scan` 等文件系统操作
- **qt_books**：知识层级中的教程关联表（`knowledge_id` 外键、`status` 状态机），语义不同

Inventory 深度集成（~47 个使用点，10+ 文件），强制迁移风险高。用户确认：**qt 系列表不是当前项目范围**，Phase 3 暂缓。

### 恢复条件

当需要统一资源元数据到数据库时，方案为：
1. **新建 `qt_resources` 表**（1:1 映射 Inventory JSON 结构）
2. Inventory 类作为 API 层保留，内部读写从 JSON 改为 SQLAlchemy
3. `meta/resources/` 目录可归档

### Inventory 当前字段（供未来参考）

```json
{
  "resource_id": "sha256:...",
  "kind": "book",
  "title": "...",
  "authors": ["..."],
  "language": "zh",
  "year": "2024",
  "identifiers": {"arxiv": "...", "isbn": "..."},
  "source": {"provider": "...", "provider_id": "...", "download_url": "..."},
  "file": {"relative_path": "...", "sha256": "...", "size_bytes": 12345, "page_count": 100},
  "catalog_ref": {"catalog_id": "math-qe", "target_id": "...", "course_id": "..."}
}
```

## 涉及文件清单

| 文件 | 改动类型 |
|------|----------|
| `QED-Tracker/src/qed_tracker/db/models.py` | 修改（+QtTask, +QtSelection） |
| `QED-Tracker/src/qed_tracker/api/tasks.py` | 重写（JSON → SQLAlchemy） |
| `QED-Tracker/src/qed_tracker/selection_store.py` | 重写（JSON → SQLAlchemy） |
| `QED-Tracker/src/qed_tracker/api/main.py` | 修改（session_factory 提前、TaskStore/PaperService 适配） |
| `QED-Tracker/src/qed_tracker/application/papers.py` | 修改（+session_factory 参数） |
| `QED-Tracker/src/qed_tracker/config.py` | 修改（degradation_notice） |
| `QED-Tracker/src/qed_tracker/migrations/versions/0016_qt_tasks.py` | 新增 |
| `QED-Tracker/src/qed_tracker/migrations/versions/0017_qt_selections.py` | 新增 |
| `QED-Tracker/tests/test_api.py` | 修改 |
| `QED-Tracker/tests/test_profiles_and_selections.py` | 修改 |
| `QED-Tracker/tests/test_paper_application.py` | 修改 |
| `QED-Tracker/tests/test_db_models.py` | 修改 |
| `docs/trackers/todo.md` | 修改（REQ-032 证据更新） |
