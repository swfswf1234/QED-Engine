-- ============================================================
-- QED 统一数据库初始化脚本（qed 库）
-- 归属：QED-Engine 根仓库 backend/database/（建库与授权）
-- 环境：MySQL 8.0+，字符集 utf8mb4
-- 用法：mysql -u root -p < backend/database/init-qed.sql
-- 说明：表结构不在此创建——QED-Tracker（qt_* 表）与 Axiom-Flow（af_* 表）
--       各自通过 Alembic 迁移管理；本脚本只负责建库与授权。
-- ============================================================

CREATE DATABASE IF NOT EXISTS `qed`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 应用账号（可选）：默认使用 root 直连（见根 .env 的 QED_DB_*），如需专用账号，
-- 取消下方注释并替换密码，再将 QED_DB_USER / QED_DB_PASSWORD 指向该账号。
-- CREATE USER IF NOT EXISTS 'qed_app'@'%' IDENTIFIED BY 'change-me';
-- GRANT ALL PRIVILEGES ON `qed`.* TO 'qed_app'@'%';
-- FLUSH PRIVILEGES;