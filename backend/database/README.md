# backend/database/ 目录说明

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-16
维护位置：`backend/database/README.md`
关联代码：根 `.env`（QED_DB_*）
关联测试：—
关联 ADR：`docs/adr/0007-qed-engine-backend-gateway.md`

本目录承载 qed 库的**建库与运维**，不承载表结构：

| 文件 | 职责 | 说明 |
| --- | --- | --- |
| `init-qed.sql` | 建库与授权 | 创建 `qed` 库（utf8mb4）；表结构由各子项目 Alembic 迁移管理 |
| `backup-qed.ps1` | 备份 | mysqldump 导出到 `backups/`（git 忽略） |
| `backups/` | 备份产物 | 不入版本控制（见根 .gitignore） |

> 2026-08-16：目录由根 `database/` 迁入 `backend/database/`（归属 QED-Engine 后端，
> ARCH-013/014 收尾）；qed 库仍为三项目共享基础设施（QED-Tracker/Axiom-Flow 同用）。

## 上下文

- 三个项目共用同一 MySQL 8 实例与 `qed` 库：QED-Tracker 用 `qt_*` 表、Axiom-Flow 用
  `af_*` 表（见 `docs/design/database-design.md`）。
- 连接参数唯一事实源为根 `.env` 的 `QED_DB_HOST / QED_DB_PORT / QED_DB_NAME /
  QED_DB_USER / QED_DB_PASSWORD`（见 `.env.example`）。
- 数据库不可达时各服务降级运行（独立性铁律），不阻塞启动。

## 用法

初始化：

```powershell
mysql -u root -p < backend/database/init-qed.sql
```

备份：

```powershell
# 密码从 -Password 或环境变量 QED_DB_PASSWORD 读取
.\backend\database\backup-qed.ps1
# 指定参数
.\backend\database\backup-qed.ps1 -Host 127.0.0.1 -Port 3306 -User root -Password "***"
```