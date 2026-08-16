"""QED-Engine 后端 API 入口：三域组装（控制域 control / 数据域·Tracker tracker）。

对外契约见 docs/design/config-center-api.md（配置/数据域/服务域/监控诊断）与
docs/design/service-control.md（/services）；三域组织见 docs/design/backend-domain-split.md。
LLM 供应商可达性与 MySQL 连接为启动自检（ARCH-014：/config/llm-status 端点已删除，
database 端点只读启动快照）。

设计关联（DesignRef）：docs/design/config-center-api.md
实现状态：Current
关联测试：tests/test_api.py
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from qed_engine import __version__
from qed_engine.api import control as api_control
from qed_engine.api.axiom import router as axiom_router
from qed_engine.api.control import router as control_router
from qed_engine.api.tracker import router as tracker_router
from qed_engine.clients.axiom_client import AxiomClient
from qed_engine.clients.tracker_client import TrackerClient
from qed_engine.config import Settings
from qed_engine.services.service_manager import configure as configure_services

logger = logging.getLogger("qed_engine")


def _startup_db_check(settings: Settings) -> dict:
    """启动自检：真实连接 qed 库一次（3s 超时），结果为 /config/database 的启动快照。

    未配置密码不探测（reachable=false, reason=未配置）；密码绝不下发。
    """
    configured = settings.qed_db_password.get_secret_value() != ""
    reachable, reason = (False, "未配置") if not configured else api_control._probe_mysql(settings)
    return {"configured": configured, "reachable": reachable, "reason": reason}


def _startup_llm_check(settings: Settings) -> None:
    """启动自检：对已配置供应商探测一次（免费 models 接口，5s 超时），结果写日志。

    密钥只出现在探测请求头，绝不进入日志（ARCH-014：按需探测端点已删除）。
    """
    for provider in ("qwen", "glm", "deepseek"):
        api_key = getattr(settings, f"{provider}_api_key").get_secret_value()
        if not api_key:
            continue
        reachable, reason = api_control._probe_llm(provider, api_key, api_control.PROBE_URLS[provider])
        logger.info("启动自检：%s LLM 可达=%s（%s）", provider, reachable, reason)


def create_app(
    settings: Settings | None = None,
    tracker_client: TrackerClient | None = None,
    axiom_client: AxiomClient | None = None,
) -> FastAPI:
    """组装 API；测试可注入确定性 Settings 与 8901/8902 客户端（MockTransport）。"""
    resolved = settings or Settings()

    app = FastAPI(title="QED-Engine Backend", version=__version__)
    app.state.settings = resolved
    app.state.db_status = _startup_db_check(resolved)
    _startup_llm_check(resolved)
    app.state.tracker_client = tracker_client or TrackerClient(base_url=resolved.qed_tracker_url)
    app.state.axiom_client = axiom_client or AxiomClient(base_url=resolved.qed_axiom_url)
    configure_services(resolved)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            # 全局端口规划（ADR 0002）：8900 配置中心 / 8901 QED-Tracker /
            # 8902 Axiom-Flow / 8903 前端；8000 为 Axiom-Flow 迁移前兼容
            "http://127.0.0.1:8000",
            "http://localhost:8000",
            "http://127.0.0.1:8900",
            "http://localhost:8900",
            "http://127.0.0.1:8901",
            "http://localhost:8901",
            "http://127.0.0.1:8902",
            "http://localhost:8902",
            "http://127.0.0.1:8903",
            "http://localhost:8903",
        ],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(control_router)
    app.include_router(tracker_router)
    app.include_router(axiom_router)
    return app


app = create_app()
