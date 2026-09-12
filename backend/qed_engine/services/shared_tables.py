"""共享表直读写层（PLAN-022 B4，裁决 D2）：exploration_stage 状态流转 + 完整 CRUD。

写优先级（D1/D2）：8901 在线时优先走 8901 API（PATCH /domains 支持
exploration_stage）；离线或 8901 课程端点暂不支持该字段时（PATCH /courses
无 exploration_stage，REQ-064 ④ 承接中），8900 经 QED_DB_* 直写共享表——
该直写权限修订已登记 REQ-064 ④（对方 shared-tables.md 审阅中）。

QED_DB_PASSWORD 未配置（如测试环境）时直写静默跳过（返回 False，记日志），
不阻塞会话主流程；状态回退（未开始）同语义。

设计关联（DesignRef）：docs/design/downloads-flow.md
实现状态：Current
关联测试：tests/test_explore_sessions.py
"""

import json
import logging
from datetime import UTC, datetime
from typing import Any

import pymysql

from qed_engine.config import Settings
from qed_engine.services.llm.call_log import _connect

logger = logging.getLogger("qed_engine.explore")

# exploration_stage 合法值（PLAN-022 核心状态机；QED-Tracker shared-tables.md 表语义）
STAGE_NOT_STARTED = "未开始"
STAGE_GENERATED = "已生成"
STAGE_RUNNING = "探索中"
STAGE_COMPLETED = "已完成"
STAGE_FAILED = "失败"
STAGE_PENDING = "待确认"

# 默认 stages（学习阶段）
DEFAULT_STAGES = ["基础", "主干", "分支", "前沿"]


def _dict_from_row(cursor: pymysql.cursors.Cursor, row: tuple) -> dict[str, Any]:
    """将数据库行转换为字典。"""
    if row is None:
        return {}
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row, strict=False))


def _dict_list_from_rows(cursor: pymysql.cursors.Cursor, rows: list[tuple]) -> list[dict[str, Any]]:
    """将多行数据库结果转换为字典列表。"""
    if not rows:
        return []
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row, strict=False)) for row in rows]


def _parse_json_field(value: Any) -> Any:
    """解析JSON字段，如果已经是Python对象则直接返回。"""
    if value is None:
        return None
    if isinstance(value, (str,)):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    return value


# --- 领域查询函数 ---

def list_domains(settings: Settings) -> list[dict[str, Any]]:
    """查询所有领域（qed_domain 表）。"""
    if not settings.qed_db_password.get_secret_value():
        logger.debug("QED_DB_PASSWORD 未配置：跳过领域查询")
        return []
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域查询连接失败：%s", exc)
        return []
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT domain_id, name, description, level, scope, 
                       exploration_stage, classic_tracks, stages, path_results,
                       explore_pending, created_by, updated_by, created_at, updated_at
                FROM qed_domain 
                ORDER BY domain_id
            """)
            rows = cursor.fetchall()
            domains = _dict_list_from_rows(cursor, rows)
            # 解析JSON字段
            for domain in domains:
                domain["classic_tracks"] = _parse_json_field(domain.get("classic_tracks")) or []
                domain["stages"] = _parse_json_field(domain.get("stages")) or []
                domain["path_results"] = _parse_json_field(domain.get("path_results"))
                domain["explore_pending"] = _parse_json_field(domain.get("explore_pending"))
            return domains
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域查询失败：%s", exc)
        return []
    finally:
        conn.close()


def get_domain(settings: Settings, domain_id: str) -> dict[str, Any] | None:
    """查询单个领域。"""
    if not settings.qed_db_password.get_secret_value():
        return None
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域查询连接失败：%s", exc)
        return None
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT domain_id, name, description, level, scope, 
                       exploration_stage, classic_tracks, stages, path_results,
                       explore_pending, created_by, updated_by, created_at, updated_at
                FROM qed_domain 
                WHERE domain_id = %s
            """, (domain_id,))
            row = cursor.fetchone()
            if row is None:
                return None
            domain = _dict_from_row(cursor, row)
            # 解析JSON字段
            domain["classic_tracks"] = _parse_json_field(domain.get("classic_tracks")) or []
            domain["stages"] = _parse_json_field(domain.get("stages")) or []
            domain["path_results"] = _parse_json_field(domain.get("path_results"))
            domain["explore_pending"] = _parse_json_field(domain.get("explore_pending"))
            return domain
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域查询失败：%s", exc)
        return None
    finally:
        conn.close()


# --- 课程查询函数 ---

def list_courses(settings: Settings, domain_id: str | None = None) -> list[dict[str, Any]]:
    """查询课程（qed_course 表），可按领域过滤。"""
    if not settings.qed_db_password.get_secret_value():
        return []
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程查询连接失败：%s", exc)
        return []
    try:
        with conn.cursor() as cursor:
            if domain_id:
                cursor.execute("""
                    SELECT course_id, domain_id, sort_order, name, aliases, track, stage,
                           prerequisites, related_targets, description, exploration_stage,
                           explore_pending, created_by, updated_by, created_at, updated_at
                    FROM qed_course 
                    WHERE domain_id = %s
                    ORDER BY sort_order, course_id
                """, (domain_id,))
            else:
                cursor.execute("""
                    SELECT course_id, domain_id, sort_order, name, aliases, track, stage,
                           prerequisites, related_targets, description, exploration_stage,
                           explore_pending, created_by, updated_by, created_at, updated_at
                    FROM qed_course 
                    ORDER BY domain_id, sort_order, course_id
                """)
            rows = cursor.fetchall()
            courses = _dict_list_from_rows(cursor, rows)
            # 解析JSON字段
            for course in courses:
                course["aliases"] = _parse_json_field(course.get("aliases")) or []
                course["prerequisites"] = _parse_json_field(course.get("prerequisites")) or []
                course["related_targets"] = _parse_json_field(course.get("related_targets")) or []
                course["explore_pending"] = _parse_json_field(course.get("explore_pending"))
            return courses
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程查询失败：%s", exc)
        return []
    finally:
        conn.close()


def get_course(settings: Settings, course_id: str) -> dict[str, Any] | None:
    """查询单个课程。"""
    if not settings.qed_db_password.get_secret_value():
        return None
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程查询连接失败：%s", exc)
        return None
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT course_id, domain_id, sort_order, name, aliases, track, stage,
                       prerequisites, related_targets, description, exploration_stage,
                       explore_pending, created_by, updated_by, created_at, updated_at
                FROM qed_course 
                WHERE course_id = %s
            """, (course_id,))
            row = cursor.fetchone()
            if row is None:
                return None
            course = _dict_from_row(cursor, row)
            # 解析JSON字段
            course["aliases"] = _parse_json_field(course.get("aliases")) or []
            course["prerequisites"] = _parse_json_field(course.get("prerequisites")) or []
            course["related_targets"] = _parse_json_field(course.get("related_targets")) or []
            course["explore_pending"] = _parse_json_field(course.get("explore_pending"))
            return course
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程查询失败：%s", exc)
        return None
    finally:
        conn.close()


def list_domains_with_courses(settings: Settings) -> list[dict[str, Any]]:
    """查询领域课程体系（GET /courses 格式）：领域含嵌套课程。"""
    domains = list_domains(settings)
    if not domains:
        return []
    
    # 查询所有课程
    courses = list_courses(settings)
    
    # 按domain_id分组
    courses_by_domain: dict[str, list[dict[str, Any]]] = {}
    for course in courses:
        domain_id = course.get("domain_id", "")
        if domain_id not in courses_by_domain:
            courses_by_domain[domain_id] = []
        courses_by_domain[domain_id].append(course)
    
    # 构建返回格式（与8901 /api/v1/courses一致）
    result = []
    for domain in domains:
        domain_id = domain.get("domain_id", "")
        domain_courses = courses_by_domain.get(domain_id, [])
        
        # 构建领域对象
        domain_obj = {
            "domain_id": domain_id,
            "name": domain.get("name", ""),
            "description": domain.get("description", ""),
            "level": domain.get("level", ""),
            "scope": domain.get("scope", ""),
            "classic_tracks": domain.get("classic_tracks", []),
            "exploration_stage": domain.get("exploration_stage", STAGE_NOT_STARTED),
            "explore_pending": domain.get("explore_pending"),
            "path_results": domain.get("path_results"),
            "stages": domain.get("stages", DEFAULT_STAGES),
            "courses": []
        }
        
        # 构建课程列表
        for course in domain_courses:
            course_obj = {
                "course_id": course.get("course_id", ""),
                "name": course.get("name", ""),
                "aliases": course.get("aliases", []),
                "track": course.get("track", ""),
                "stage": course.get("stage", ""),
                "prerequisites": course.get("prerequisites", []),
                "related_targets": course.get("related_targets", []),
                "description": course.get("description", ""),
                "exploration_stage": course.get("exploration_stage", STAGE_NOT_STARTED),
            }
            domain_obj["courses"].append(course_obj)
        
        result.append(domain_obj)
    
    return result


# --- 领域写入函数 ---

def create_domain(
    settings: Settings,
    name: str,
    description: str = "",
    level: str = "本科",
    stages: list[str] | None = None,
    classic_tracks: list[dict] | None = None,
    scope: str = "",
    exploration_stage: str = STAGE_NOT_STARTED,
) -> dict[str, Any] | None:
    """创建领域（qed_domain 表）。返回创建的领域或None。"""
    if stages is None:
        stages = DEFAULT_STAGES
    if classic_tracks is None:
        classic_tracks = []
    
    # 生成domain_id（slug规则）
    import re
    slug = re.sub(r'[^a-z0-9\u4e00-\u9fff]', '_', name.lower()).strip('_')
    if not slug:
        slug = f"d_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    
    if not settings.qed_db_password.get_secret_value():
        logger.debug("QED_DB_PASSWORD 未配置：跳过领域创建")
        return None
    
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域创建连接失败：%s", exc)
        return None
    
    try:
        with conn.cursor() as cursor:
            now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
                INSERT INTO qed_domain 
                (domain_id, name, description, level, scope, exploration_stage, 
                 classic_tracks, stages, path_results, explore_pending,
                 created_by, updated_by, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                slug, name, description, level, scope, exploration_stage,
                json.dumps(classic_tracks, ensure_ascii=False),
                json.dumps(stages, ensure_ascii=False),
                None, None,
                "qed_engine", "qed_engine", now, now
            ))
        conn.commit()
        logger.info("领域已创建：%s (%s)", name, slug)
        return get_domain(settings, slug)
    except pymysql.IntegrityError as exc:
        logger.warning("领域创建失败（可能重名）：%s", exc)
        conn.rollback()
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域创建失败：%s", exc)
        conn.rollback()
        return None
    finally:
        conn.close()


def update_domain(
    settings: Settings,
    domain_id: str,
    name: str | None = None,
    description: str | None = None,
    level: str | None = None,
    stages: list[str] | None = None,
    classic_tracks: list[dict] | None = None,
    scope: str | None = None,
    exploration_stage: str | None = None,
    explore_pending: dict | str | None = None,
) -> dict[str, Any] | None:
    """更新领域（qed_domain 表）。返回更新后的领域或None。"""
    if not settings.qed_db_password.get_secret_value():
        return None
    
    # 构建动态更新语句
    updates = []
    params = []
    
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if description is not None:
        updates.append("description = %s")
        params.append(description)
    if level is not None:
        updates.append("level = %s")
        params.append(level)
    if stages is not None:
        updates.append("stages = %s")
        params.append(json.dumps(stages, ensure_ascii=False))
    if classic_tracks is not None:
        updates.append("classic_tracks = %s")
        params.append(json.dumps(classic_tracks, ensure_ascii=False))
    if scope is not None:
        updates.append("scope = %s")
        params.append(scope)
    if exploration_stage is not None:
        updates.append("exploration_stage = %s")
        params.append(exploration_stage)
    if explore_pending is not None:
        updates.append("explore_pending = %s")
        if explore_pending == "__CLEAR__":
            params.append(None)
        elif isinstance(explore_pending, dict):
            params.append(json.dumps(explore_pending, ensure_ascii=False))
        else:
            params.append(explore_pending)
    
    if not updates:
        return get_domain(settings, domain_id)
    
    updates.append("updated_at = %s")
    params.append(datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"))
    params.append(domain_id)
    
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域更新连接失败：%s", exc)
        return None
    
    try:
        with conn.cursor() as cursor:
            sql = f"UPDATE qed_domain SET {', '.join(updates)} WHERE domain_id = %s"
            cursor.execute(sql, tuple(params))
        conn.commit()
        return get_domain(settings, domain_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域更新失败：%s", exc)
        conn.rollback()
        return None
    finally:
        conn.close()


def delete_domain(settings: Settings, domain_id: str) -> bool:
    """删除领域（qed_domain 表）。返回是否成功。"""
    if not settings.qed_db_password.get_secret_value():
        return False
    
    # 检查是否有课程
    courses = list_courses(settings, domain_id)
    if courses:
        logger.warning("删除领域失败：领域下还有 %d 门课程", len(courses))
        return False
    
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域删除连接失败：%s", exc)
        return False
    
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM qed_domain WHERE domain_id = %s", (domain_id,))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as exc:  # noqa: BLE001
        logger.warning("领域删除失败：%s", exc)
        conn.rollback()
        return False
    finally:
        conn.close()


# --- 课程写入函数 ---

def create_course(
    settings: Settings,
    domain_id: str,
    name: str,
    description: str = "",
    stage: str = "",
    track: str = "",
    sort_order: int = 0,
    aliases: list[str] | None = None,
    prerequisites: list[str] | None = None,
) -> dict[str, Any] | None:
    """创建课程（qed_course 表）。返回创建的课程或None。"""
    if aliases is None:
        aliases = []
    if prerequisites is None:
        prerequisites = []
    
    # 生成course_id（slug规则）
    import re
    slug = re.sub(r'[^a-z0-9\u4e00-\u9fff]', '_', name.lower()).strip('_')
    if not slug:
        slug = f"c_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    
    if not settings.qed_db_password.get_secret_value():
        return None
    
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程创建连接失败：%s", exc)
        return None
    
    try:
        with conn.cursor() as cursor:
            now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
                INSERT INTO qed_course 
                (course_id, domain_id, sort_order, name, aliases, track, stage,
                 prerequisites, related_targets, description, exploration_stage,
                 explore_pending, created_by, updated_by, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                slug, domain_id, sort_order, name,
                json.dumps(aliases, ensure_ascii=False),
                track, stage,
                json.dumps(prerequisites, ensure_ascii=False),
                json.dumps([], ensure_ascii=False),
                description, STAGE_NOT_STARTED,
                None,
                "qed_engine", "qed_engine", now, now
            ))
        conn.commit()
        logger.info("课程已创建：%s (%s)", name, slug)
        return get_course(settings, slug)
    except pymysql.IntegrityError as exc:
        logger.warning("课程创建失败（可能重名）：%s", exc)
        conn.rollback()
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程创建失败：%s", exc)
        conn.rollback()
        return None
    finally:
        conn.close()


def update_course(
    settings: Settings,
    course_id: str,
    description: str | None = None,
    stage: str | None = None,
    track: str | None = None,
    sort_order: int | None = None,
    aliases: list[str] | None = None,
    prerequisites: list[str] | None = None,
    exploration_stage: str | None = None,
) -> dict[str, Any] | None:
    """更新课程（qed_course 表）。返回更新后的课程或None。"""
    if not settings.qed_db_password.get_secret_value():
        return None
    
    # 构建动态更新语句
    updates = []
    params = []
    
    if description is not None:
        updates.append("description = %s")
        params.append(description)
    if stage is not None:
        updates.append("stage = %s")
        params.append(stage)
    if track is not None:
        updates.append("track = %s")
        params.append(track)
    if sort_order is not None:
        updates.append("sort_order = %s")
        params.append(sort_order)
    if aliases is not None:
        updates.append("aliases = %s")
        params.append(json.dumps(aliases, ensure_ascii=False))
    if prerequisites is not None:
        updates.append("prerequisites = %s")
        params.append(json.dumps(prerequisites, ensure_ascii=False))
    if exploration_stage is not None:
        updates.append("exploration_stage = %s")
        params.append(exploration_stage)
    
    if not updates:
        return get_course(settings, course_id)
    
    updates.append("updated_at = %s")
    params.append(datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"))
    params.append(course_id)
    
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程更新连接失败：%s", exc)
        return None
    
    try:
        with conn.cursor() as cursor:
            sql = f"UPDATE qed_course SET {', '.join(updates)} WHERE course_id = %s"
            cursor.execute(sql, tuple(params))
        conn.commit()
        return get_course(settings, course_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程更新失败：%s", exc)
        conn.rollback()
        return None
    finally:
        conn.close()


def delete_course(settings: Settings, course_id: str) -> bool:
    """删除课程（qed_course 表）。返回是否成功。"""
    if not settings.qed_db_password.get_secret_value():
        return False
    
    # 注意：这里不检查是否有教程（教程在qt_knowledge表，8901负责检查）
    # 降级模式下，我们只检查课程是否存在
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程删除连接失败：%s", exc)
        return False
    
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM qed_course WHERE course_id = %s", (course_id,))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as exc:  # noqa: BLE001
        logger.warning("课程删除失败：%s", exc)
        conn.rollback()
        return False
    finally:
        conn.close()


# --- 原有函数（保持兼容） ---

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


def import_domain_manual(settings: Settings, data: dict, *, target_domain_id: str | None = None) -> dict[str, Any] | None:
    """manual@v1 导入降级（REQ-067 B3；PLAN-028 2026-09-02 用户指令）。

    8901 离线时 8900 直写共享表：以 target_domain_id（用户在 UI 选择的领域）为主键查找并更新；
    如果 JSON 中的 domain slug 与 target_domain_id 不同，同步更新 domain_id 主键。
    课程暂存 explore_pending（kind=import_courses），等用户确认后再写 qed_course。

    返回 {domain_id, courses_created: 0, courses_updated: 0}；
    必需字段缺失抛 ValueError（调用方转 400）；领域不存在抛 ValueError；
    共享库不可写/写入失败返回 None（503）。
    """
    json_slug = data.get("domain")
    name = data.get("name")
    description = data.get("description")
    stages = data.get("stages")
    courses = data.get("courses")
    if not json_slug or not isinstance(json_slug, str):
        raise ValueError('缺少 domain 字段（slug，如 "computer-science"）')
    if not name or not isinstance(name, str):
        raise ValueError("缺少 name 字段（领域名称）")
    if not isinstance(description, str) or not description:
        raise ValueError("缺少 description 字段（领域描述）")
    if not isinstance(stages, list) or not stages:
        raise ValueError("缺少 stages 字段（学习阶段数组）")
    if not isinstance(courses, list) or not courses:
        raise ValueError("缺少 courses 数组（需至少一门课程）")
    for course in courses:
        if not isinstance(course, dict) or not course.get("name"):
            raise ValueError("courses 内每门课程必须包含 name 字段")

    if not settings.qed_db_password.get_secret_value():
        logger.warning("QED_DB_PASSWORD 未配置：导入降级跳过")
        return None

    level = data.get("level") or "本科"
    scope = data.get("scope") or ""
    classic_tracks = data.get("classic_tracks") or []

    # ① 以用户选择的领域为主键查找（优先 target_domain_id，其次 JSON slug）
    lookup_id = target_domain_id or json_slug
    existing_domain = get_domain(settings, lookup_id)
    if existing_domain is None:
        raise ValueError(f"领域 {lookup_id} 不存在，导入只能修改已有领域")

    current_id = existing_domain["domain_id"]
    need_rename_id = json_slug != current_id  # JSON slug 与当前 domain_id 不同，需更新主键

    # ② 检查名称是否变更
    name_changed = existing_domain.get("name") != name

    # ③ 课程数据暂存 explore_pending（不写 qed_course）
    #    summary → description 映射（导入 JSON 用 summary，数据库用 description）
    import_courses = []
    for course in courses:
        import_courses.append({
            "name": course["name"],
            "description": course.get("description") or course.get("summary") or "",
            "stage": course.get("stage") or "",
            "track": course.get("track") or "",
            "sort_order": course.get("sort_order") or 0,
            "aliases": course.get("aliases") or [],
            "prerequisites": course.get("prerequisites") or [],
        })
    explore_pending = json.dumps({
        "kind": "import_courses",
        "courses": import_courses,
        "name_changed": name_changed,
        "imported_name": name,
    }, ensure_ascii=False)

    # ④ 领域 UPDATE（含可选 domain_id 主键更新）
    now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
    try:
        conn = _connect(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("导入降级连接失败：%s", exc)
        return None
    try:
        with conn.cursor() as cursor:
            if need_rename_id:
                # 先更新 domain_id 主键，再更新其他字段
                cursor.execute(
                    "UPDATE qed_domain SET domain_id = %s WHERE domain_id = %s",
                    (json_slug, current_id),
                )
                logger.info("导入降级：domain_id 主键更新 %s → %s", current_id, json_slug)
            cursor.execute(
                """
                UPDATE qed_domain
                SET name = %s, description = %s, level = %s, scope = %s,
                    classic_tracks = %s, stages = %s,
                    exploration_stage = %s, explore_pending = %s,
                    updated_by = %s, updated_at = %s
                WHERE domain_id = %s
                """,
                (
                    name, description, level, scope,
                    json.dumps(classic_tracks, ensure_ascii=False),
                    json.dumps(stages, ensure_ascii=False),
                    STAGE_GENERATED, explore_pending,
                    "qed_engine", now, json_slug if need_rename_id else current_id,
                ),
            )
        conn.commit()
        if cursor.rowcount == 0:
            logger.warning("导入降级：领域 UPDATE 未命中行（%s）", current_id)
            return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("导入降级领域 UPDATE 失败（%s）：%s", type(exc).__name__, exc)
        conn.rollback()
        return None
    finally:
        conn.close()

    final_id = json_slug if need_rename_id else current_id
    logger.info("导入降级完成：%s（课程暂存 explore_pending，名称变更=%s，主键更新=%s）",
                final_id, name_changed, need_rename_id)
    return {"domain_id": final_id, "courses_created": 0, "courses_updated": 0}


def commit_import_courses(settings: Settings, domain_id: str) -> dict[str, Any] | None:
    """确认导入课程：将 explore_pending.import_courses 写入 qed_course，清空 explore_pending。

    成功返回 {"committed": N}；领域不存在或无待确认课程返回 None。
    """
    if not settings.qed_db_password.get_secret_value():
        logger.warning("QED_DB_PASSWORD 未配置：确认导入跳过")
        return None

    domain = get_domain(settings, domain_id)
    if domain is None:
        return None

    pending_raw = domain.get("explore_pending")
    if not pending_raw:
        return None
    try:
        pending = json.loads(pending_raw) if isinstance(pending_raw, str) else pending_raw
    except (json.JSONDecodeError, TypeError):
        return None

    if pending.get("kind") != "import_courses":
        return None

    courses = pending.get("courses", [])
    if not courses:
        return None

    # 导入时可能修改了领域名称
    imported_name = pending.get("imported_name")
    if imported_name and imported_name != domain.get("name"):
        try:
            conn = _connect(settings)
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE qed_domain SET name = %s, updated_by = %s, updated_at = %s WHERE domain_id = %s",
                    (imported_name, "qed_engine",
                     datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"), domain_id),
                )
            conn.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("确认导入修改领域名称失败（%s）：%s", type(exc).__name__, exc)
        finally:
            conn.close()

    # 课程写入
    try:
        existing = {c["name"]: c for c in (list_courses(settings, domain_id) or [])}
    except Exception:
        existing = {}

    created = 0
    for course in courses:
        cname = course.get("name", "")
        if not cname:
            continue
        if cname in existing:
            continue
        result = create_course(
            settings, domain_id, cname,
            description=course.get("description") or "",
            stage=course.get("stage") or "",
            track=course.get("track") or "",
            sort_order=course.get("sort_order") or 0,
            aliases=course.get("aliases") or [],
            prerequisites=course.get("prerequisites") or [],
        )
        if result is not None:
            created += 1

    # 清空 explore_pending，终态=已完成（PLAN-034 §3 写点矩阵：确认课程即收口）
    try:
        conn = _connect(settings)
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE qed_domain SET explore_pending = NULL, exploration_stage = %s, updated_by = %s, updated_at = %s WHERE domain_id = %s",
                (STAGE_COMPLETED, "qed_engine",
                 datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"), domain_id),
            )
        conn.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("确认导入清空 explore_pending 失败（%s）：%s", type(exc).__name__, exc)
    finally:
        conn.close()

    logger.info("确认导入完成：%s（写入 %d 门课程）", domain_id, created)
    return {"committed": created}
