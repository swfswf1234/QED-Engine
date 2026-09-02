"""共享表直读写层（PLAN-022 B4，裁决 D2）：exploration_stage 状态流转。

写优先级（D1/D2）：8901 在线时优先走 8901 API（PATCH /domains 支持
exploration_stage）；离线或 8901 课程端点暂不支持该字段时（PATCH /courses
无 exploration_stage，REQ-064 ④ 承接中），8900 经 QED_DB_* 直写共享表——
该直写权限修订已登记 REQ-064 ④（对方 shared-tables.md 审阅中）。

QED_DB_PASSWORD 未配置（如测试环境）时直写静默跳过（返回 False，记日志），
不阻塞会话主流程；状态回退（未开始）同语义。

设计关联（DesignRef）：docs/plans/2026-08-27-exploration-download-flow.md
实现状态：Current
关联测试：tests/test_explore_sessions.py
"""

import logging

from qed_engine.config import Settings
from qed_engine.services.llm.call_log import _connect

logger = logging.getLogger("qed_engine.explore")

# exploration_stage 合法值（PLAN-022 核心状态机；QED-Tracker shared-tables.md 表语义）
STAGE_NOT_STARTED = "未开始"
STAGE_GENERATED = "已生成"
STAGE_RUNNING = "探索中"
STAGE_COMPLETED = "已完成"


def direct_write_stage(settings: Settings, table: str, row_id: str, stage: str) -> bool:
    """直写 qed_domain/qed_course 的 exploration_stage 列。

    返回 True=已写入；False=跳过（无密码配置）或失败（连接/SQL 异常，记日志不抛）。
    table 仅允许 qed_domain/qed_course（防注入白名单），row_id 经参数化查询。
    """
    if table not in ("qed_domain", "qed_course"):
        raise ValueError(f"非法共享表：{table}")
    if not settings.qed_db_password.get_secret_value():
        logger.debug("QED_DB_PASSWORD 未配置：跳过 %s.exploration_stage 直写（%s）", table, row_id)
        return False
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001 - 降级路径不抛
        logger.warning("exploration_stage 直写连接失败（%s.%s）：%s", table, row_id, exc)
        return False
    try:
        with conn.cursor() as cursor:
            affected = cursor.execute(
                f"UPDATE {table} SET exploration_stage = %s WHERE "
                f"{'domain_id' if table == 'qed_domain' else 'course_id'} = %s",
                (stage, row_id),
            )
        conn.commit()
        if affected == 0:
            logger.info("exploration_stage 直写未命中行（%s.%s → %s）", table, row_id, stage)
        return True
    except Exception as exc:  # noqa: BLE001 - 降级路径不抛
        logger.warning("exploration_stage 直写失败（%s.%s → %s）：%s", table, row_id, stage, exc)
        return False
    finally:
        conn.close()


def set_domain_stage(
    settings: Settings, tracker, domain_id: str, stage: str, *, online: bool
) -> bool:
    """领域 exploration_stage 写入：在线 PATCH /domains/{id}，失败/离线直写降级。"""
    if online:
        try:
            tracker.update_domain(domain_id, exploration_stage=stage)
            return True
        except Exception as exc:  # noqa: BLE001 - 降级直写
            logger.info("领域 stage 经 8901 写入失败（%s → %s），降级直写：%s", domain_id, stage, exc)
    return direct_write_stage(settings, "qed_domain", domain_id, stage)


def set_course_stage(
    settings: Settings, tracker, course_id: str, stage: str, *, online: bool
) -> bool:
    """课程 exploration_stage 写入。

    8901 PATCH /courses 暂不支持 exploration_stage（REQ-064 ④ 承接中），故当前
    一律直写 qed_course；对方端点补齐后可在此切换在线路径（保留 online 参数）。
    """
    del tracker  # 端点补齐前无在线写路径
    return direct_write_stage(settings, "qed_course", course_id, stage)
