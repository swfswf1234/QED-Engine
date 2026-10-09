# backend/database/ 目录说明

设计状态：Accepted
实现状态：Implemented
最后更新：2026-09-29
维护位置：`backend/database/README.md`
关联代码：根 `.env`（QED_DB_*）
关联测试：—
关联 ADR：`docs/adr/0007-qed-engine-backend-gateway.md`

本目录承载 qed 库的**建库与运维**，不承载表结构：

| 文件 | 职责 | 说明 |
| --- | --- | --- |
| `init-qed.sql` | 建库与授权 | 创建 `qed` 库（utf8mb4）；表结构由各子项目 Alembic 迁移管理 |
| `backup-qed.ps1` | 回滚快照生成 | mysqldump 导出到**数据根** `<QED_DATA_ROOT>/backups/<YYYY-MM-DD>-<TaskId>/`（仓库内不设备份位，ADR 0019 第 4 条） |

> 快照只为**一次 D 类数据操作的回滚窗口**存在，操作验收通过即清；长期可追溯由台账
> （`docs/trackers/completed.md` 与计划壳收口记录）承载，不靠物理 dump。本目录原
> `backups/` 备份位已 2026-09-29 退役（ARCH-036）。

> 2026-08-16：目录由根 `database/` 迁入 `backend/database/`（归属 QED-Engine 后端，
> ARCH-013/014 收尾）；qed 库仍为三项目共享基础设施（QED-Tracker/Axiom-Flow 同用）。

## 上下文

- 三个项目共用同一 MySQL 8 实例与 `qed` 库：QED-Tracker 用 `qt_*` 表、Axiom-Flow 用
  `af_*` 表（见 `docs/architecture/../architecture/database-design.md`）。
- 连接参数唯一事实源为根 `.env` 的 `QED_DB_HOST / QED_DB_PORT / QED_DB_NAME /
  QED_DB_USER / QED_DB_PASSWORD`（见 `.env.example`）。
- 数据库不可达时各服务降级运行（独立性铁律），不阻塞启动。

## 用法

初始化：

```powershell
mysql -u root -p < backend/database/init-qed.sql
```

快照（回滚窗口用）：

```powershell
# 密码从 -Password 或环境变量 QED_DB_PASSWORD 读取；快照落 <QED_DATA_ROOT>/backups/<日期>-<TaskId>/
.\backend\database\backup-qed.ps1 -TaskId arch036
# 指定参数
.\backend\database\backup-qed.ps1 -Host 127.0.0.1 -Port 3306 -User root -Password "***" -TaskId arch036
```