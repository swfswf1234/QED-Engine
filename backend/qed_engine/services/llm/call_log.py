"""LLM 调用记录：qed_llm_calls 表（qed 库）幂等建表、写入与分页检索。

表归属 QED-Engine 根仓库（llm-gateway-and-model-management.md）；三项目均可写入
（QED-Tracker / Axiom-Flow 的 local 模式直写，约定 service 字段标识自身）。
数据库不可达时写入降级（记日志返回 None），不阻塞 LLM 调用主流程。

设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
关联测试：tests/test_llm_call_log.py
"""

import logging
from datetime import UTC, datetime

import pymysql

from qed_engine.config import Settings

logger = logging.getLogger("qed_engine.llm")

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS qed_llm_calls (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  service VARCHAR(32) NOT NULL,
  mode VARCHAR(16) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  model VARCHAR(64) NOT NULL,
  endpoint VARCHAR(16) NOT NULL,
  prompt_template VARCHAR(255),
  prompt MEDIUMTEXT,
  response MEDIUMTEXT,
  duration_ms INT,
  status VARCHAR(16) NOT NULL,
  error VARCHAR(500),
  created_at DATETIME NOT NULL,
  task VARCHAR(64),
  step VARCHAR(32),
  review_status VARCHAR(16) DEFAULT 'unreviewed',
  review_note VARCHAR(1000) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""

INSERT_SQL = """
INSERT INTO qed_llm_calls
  (service, mode, provider, model, endpoint, prompt_template, prompt, response,
   duration_ms, status, error, created_at, task, step, review_status, review_note)
VALUES
  (%(service)s, %(mode)s, %(provider)s, %(model)s, %(endpoint)s, %(prompt_template)s,
   %(prompt)s, %(response)s, %(duration_ms)s, %(status)s, %(error)s, %(created_at)s,
   %(task)s, %(step)s, %(review_status)s, %(review_note)s)
"""


def _connect(settings: Settings) -> pymysql.Connection:
    """打开 qed 库连接（QED_DB_*）。"""
    return pymysql.connect(
        host=settings.qed_db_host,
        port=settings.qed_db_port,
        user=settings.qed_db_user,
        password=settings.qed_db_password.get_secret_value(),
        database=settings.qed_db_name,
        charset="utf8mb4",
        connect_timeout=3,
    )


def ensure_table(settings: Settings) -> None:
    """幂等建表（qed_llm_calls）；失败抛异常由调用方决定降级。"""
    conn = _connect(settings)
    try:
        with conn.cursor() as cursor:
            cursor.execute(CREATE_TABLE_SQL)
        conn.commit()
    finally:
        conn.close()


# 已有表补列清单（2026-08-25 缺陷修复：CREATE TABLE IF NOT EXISTS 不迁移已有表，
# REQ-060 新增列在存量库上缺失导致 INSERT 全量失败 1054）。
_REQUIRED_COLUMNS: dict[str, str] = {
    "task": "VARCHAR(64)",
    "step": "VARCHAR(32)",
    "review_status": "VARCHAR(16) DEFAULT 'unreviewed'",
    "review_note": "VARCHAR(1000) DEFAULT ''",
}


def ensure_columns(settings: Settings) -> list[str]:
    """幂等补齐已有表缺失列（information_schema 对比）；返回本次新增的列名。"""
    conn = _connect(settings)
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'qed_llm_calls'",
                (settings.qed_db_name,),
            )
            existing = {row[0] for row in cursor.fetchall()}
            added: list[str] = []
            for col, ddl in _REQUIRED_COLUMNS.items():
                if col not in existing:
                    cursor.execute(f"ALTER TABLE qed_llm_calls ADD COLUMN {col} {ddl}")
                    added.append(col)
        conn.commit()
        return added
    finally:
        conn.close()


def record_call(
    settings: Settings,
    *,
    service: str,
    mode: str,
    provider: str,
    model: str,
    endpoint: str,
    prompt: str,
    response: str,
    duration_ms: int,
    status: str,
    error: str = "",
    prompt_template: str | None = None,
    task: str | None = None,
    step: str | None = None,
    review_status: str = "unreviewed",
    review_note: str = "",
) -> int | None:
    """写入一条调用记录；数据库不可达降级返回 None（记日志），不抛异常。"""
    try:
        conn = _connect(settings)
    except Exception as exc:
        logger.warning("qed_llm_calls 写入降级（数据库不可达）：%s", type(exc).__name__)
        return None
    try:
        with conn.cursor() as cursor:
            cursor.execute(CREATE_TABLE_SQL)
            cursor.execute(INSERT_SQL, {
                "service": service, "mode": mode, "provider": provider, "model": model,
                "endpoint": endpoint, "prompt_template": prompt_template, "prompt": prompt,
                "response": response, "duration_ms": duration_ms, "status": status,
                "error": error[:500], "created_at": datetime.now(UTC).replace(tzinfo=None),
                "task": task, "step": step,
                "review_status": review_status, "review_note": review_note,
            })
            lastrowid = cursor.lastrowid
        conn.commit()
        return int(lastrowid or 0) or None
    except Exception as exc:
        # 1054 Unknown column（存量表缺新列）：自愈迁移后重试一次（2026-08-25 缺陷修复）
        if isinstance(exc, pymysql.err.OperationalError) and exc.args and exc.args[0] == 1054:
            try:
                added = ensure_columns(settings)
                if added:
                    logger.warning("qed_llm_calls 补列自愈：%s", ",".join(added))
                    return record_call(
                        settings, service=service, mode=mode, provider=provider, model=model,
                        endpoint=endpoint, prompt=prompt, response=response,
                        duration_ms=duration_ms, status=status, error=error,
                        prompt_template=prompt_template, task=task, step=step,
                        review_status=review_status, review_note=review_note,
                    )
            except Exception as mig_exc:
                logger.warning("qed_llm_calls 补列失败：%s", mig_exc)
        logger.warning("qed_llm_calls 写入失败：%s", exc)
        return None
    finally:
        conn.close()


def search_calls(
    settings: Settings,
    *,
    service: str | None = None,
    mode: str | None = None,
    model: str | None = None,
    status: str | None = None,
    start: str | None = None,
    end: str | None = None,
    task: str | None = None,
    step: str | None = None,
    prompt_template: str | None = None,
    review_status: str | None = None,
    page: int = 1,
    size: int = 20,
) -> dict:
    """分页检索调用记录（倒序）；过滤条件可空；数据库不可达或参数非法降级返回空结果。"""
    page = max(page or 1, 1)
    size = max(1, min(size or 20, 200))
    where, params = [], []
    if service:
        where.append("service = %s")
        params.append(service)
    if mode:
        where.append("mode = %s")
        params.append(mode)
    if model:
        where.append("model LIKE %s")
        params.append(f"%{model}%")
    if status:
        where.append("status = %s")
        params.append(status)
    if task:
        where.append("task = %s")
        params.append(task)
    if step:
        where.append("step = %s")
        params.append(step)
    if prompt_template:
        where.append("prompt_template LIKE %s")
        params.append(f"%{prompt_template}%")
    if review_status:
        where.append("review_status = %s")
        params.append(review_status)
    try:
        if start:
            where.append("created_at >= %s")
            params.append(datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=None))
        if end:
            where.append("created_at <= %s")
            params.append(datetime.strptime(end, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, tzinfo=None,
            ))
        clause = ("WHERE " + " AND ".join(where)) if where else ""
        offset = max(page - 1, 0) * size
        conn = _connect(settings)
    except Exception as exc:
        logger.warning("qed_llm_calls 检索降级（参数非法或数据库不可达）：%s", type(exc).__name__)
        return {"items": [], "total": 0, "page": page, "size": size}
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(f"SELECT COUNT(*) AS n FROM qed_llm_calls {clause}", params)
            total = cursor.fetchone()["n"]
            cursor.execute(
                f"SELECT * FROM qed_llm_calls {clause} ORDER BY id DESC LIMIT %s OFFSET %s",
                [*params, size, offset],
            )
            items = cursor.fetchall()
        return {"items": items, "total": total, "page": page, "size": size}
    except Exception as exc:
        logger.warning("qed_llm_calls 检索失败：%s", type(exc).__name__)
        return {"items": [], "total": 0, "page": page, "size": size}
    finally:
        conn.close()


REVIEW_CALL_SQL = """
UPDATE qed_llm_calls
SET review_status = %(review_status)s, review_note = %(review_note)s
WHERE id = %(id)s
"""


def review_call(
    settings: Settings,
    *,
    call_id: int,
    review_status: str,
    review_note: str = "",
) -> bool:
    """审核标注：UPDATE review_status/review_note；不存在返回 False。"""
    try:
        conn = _connect(settings)
    except Exception as exc:
        logger.warning("qed_llm_calls 审核降级（数据库不可达）：%s", type(exc).__name__)
        return False
    try:
        with conn.cursor() as cursor:
            cursor.execute(REVIEW_CALL_SQL, {
                "id": call_id,
                "review_status": review_status,
                "review_note": review_note[:1000],
            })
            affected = cursor.rowcount
        conn.commit()
        return affected > 0
    except Exception as exc:
        logger.warning("qed_llm_calls 审核失败：%s", type(exc).__name__)
        return False
    finally:
        conn.close()
