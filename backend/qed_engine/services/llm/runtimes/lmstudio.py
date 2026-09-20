"""LM Studio 半托管 runtime：探活（REST v0）+ 生命周期（lms CLI），server 进程保留。

2026-09-16（PLAN-046）：半托管语义——start = server 未起先尝试 `lms server start`
（PATH 探测，CLI 不在则报明确原因），随后经 `lms load <model-key> --gpu max` 加载
目标模型（加载前先 `lms unload <id>` 卸载其他已加载模型：双 Qwen 同槽位单活 + 显存释放）；
stop = `lms unload`（不带模型名时 `--all` 全量卸载），server 进程保留。
W7 本机实测（2026-09-16）：**REST API v0 无 load/unload 端点**（POST /api/v0/load 返回
「Unexpected endpoint」伪 200），生命周期一律走 lms CLI；探活用 GET /api/v0/models 的
state=loaded（/v1/models 列全量已下载模型，不能当已加载判定）；本机开启 API token 认证，
探活请求经 QED_LMSTUDIO_TOKEN 带 Bearer（空 token 不带头）。

设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_llm_model_manager.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from collections.abc import Callable

from qed_engine.config import Settings
from qed_engine.services.llm.runtimes.base import RuntimeResult

# REST API v0 探活端点（W7 本机实测：仅 models 可用；load/unload 不存在于本机版本）
MODELS_PATH = "/api/v0/models"

# 等待参数（server 启动 / 模型加载轮询）
SERVER_START_TIMEOUT_S = 30.0
LOAD_TIMEOUT_S = 120.0
POLL_INTERVAL_S = 1.0

# 测试注入点（monkeypatch 目标）
_sleep = time.sleep


def _api_base(settings: Settings) -> str:
    """REST v0 基址：文字模型地址去掉 /v1 后缀（同端口同进程）。"""
    base = settings.qed_model_url.rstrip("/")
    return base[: -len("/v1")] if base.endswith("/v1") else base


def _v0_models_url(settings: Settings) -> str:
    """REST v0 模型目录端点：全量已下载模型 + state（loaded/not-loaded/loading）。"""
    return _api_base(settings) + MODELS_PATH


def _auth_headers(token: str = "") -> dict:
    """LM Studio API 认证（W7 实测：本机开启 token 认证）；空 token 不带头。"""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _get_json(url: str, timeout: float = 2.0, token: str = "") -> dict | None:
    """GET JSON；任何异常返回 None（调用方视为服务不可达）。"""
    req = urllib.request.Request(url, headers=_auth_headers(token))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (OSError, ValueError, urllib.error.URLError):
        return None


def _run_lms(args: list[str], timeout: float = 600.0) -> int:
    """执行 lms CLI 子命令；CLI 不在 PATH 返回 127。

    默认超时 600s：`lms load` 大模型（27B Q3_K_XL ≈15GB）加载耗时以分钟计。
    """
    if shutil.which("lms") is None:
        return 127
    try:
        result = subprocess.run(
            ["lms", *args], capture_output=True, text=True, timeout=timeout,
        )
        return result.returncode
    except (OSError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        return 1


def _loaded_ids(settings: Settings) -> list[str] | None:
    """已加载模型 id 列表；server 不可达返回 None。

    W7 实测：/api/v0/models 列出**全量已下载**模型（state: loaded/not-loaded/loading），
    仅 state=loaded 计入已加载；响应无 state 字段（旧版本）时退化为全量 id（不误判全部未加载）。
    """
    payload = _get_json(_v0_models_url(settings), token=settings.resolved_lmstudio_token())
    if payload is None:
        return None
    data = payload.get("data", [])
    if data and isinstance(data[0], dict) and "state" in data[0]:
        return [str(item.get("id", "")) for item in data if item.get("state") == "loaded"]
    return [str(item.get("id", "")) for item in data]


def _contains_id(ids: list[str], model: str) -> bool:
    """模型 id 匹配（大小写不敏感；LM Studio 对目录型 key 的大小写报告因版本而异）。"""
    target = model.lower()
    return any(i.lower() == target for i in ids)


def _server_up(settings: Settings) -> bool:
    """server 进程就绪（不校验具体模型）。"""
    return _loaded_ids(settings) is not None


class LmStudioRuntime:
    """LM Studio 半托管 runtime（probe/start/stop 三操作，server 常驻、模型按需加载）。"""

    label = "lmstudio"

    def probe(self, settings: Settings, model: str = "") -> bool:
        """就绪 = server 可达且（指定模型时）目标模型已加载。"""
        ids = _loaded_ids(settings)
        if ids is None:
            return False
        if not model:
            return True
        return _contains_id(ids, model)

    def start(self, settings: Settings, model: str = "", log: Callable[[str], None] | None = None,
              script_runner: Callable | None = None) -> RuntimeResult:
        log = log or (lambda _m: None)
        if not model:
            return RuntimeResult(False, "未指定 LM Studio 模型标识（注册表本地引用缺失）")
        if not _server_up(settings):
            log("LM Studio server 未启动，尝试 lms server start")
            if _run_lms(["server", "start"]) != 0:
                return RuntimeResult(False, "lms CLI 启动失败（不在 PATH 或 server 启动报错）")
            deadline = time.monotonic() + SERVER_START_TIMEOUT_S
            while time.monotonic() < deadline:
                if _server_up(settings):
                    break
                _sleep(POLL_INTERVAL_S)
            else:
                return RuntimeResult(False, "LM Studio server 启动超时")
        # 单活：卸载其他已加载模型（双 Qwen 同槽位单活 + 显存释放；W7 实测：经 lms CLI）
        for loaded in _loaded_ids(settings) or []:
            if not _contains_id([loaded], model):
                log(f"unload {loaded}（单活互斥）")
                if _run_lms(["unload", loaded]) != 0:
                    return RuntimeResult(False, f"卸载已加载模型失败：{loaded}（lms unload rc≠0）")
        # 加载目标（--gpu max：单活语义下独占 4080 16GB 显存；幂等，已加载时 CLI 返回 0）
        if _run_lms(["load", model, "--gpu", "max"]) != 0:
            return RuntimeResult(False, f"LM Studio 加载模型失败：{model}（lms load rc≠0）")
        deadline = time.monotonic() + LOAD_TIMEOUT_S
        while time.monotonic() < deadline:
            ids = _loaded_ids(settings)
            if ids is not None and _contains_id(ids, model):
                return RuntimeResult(True, f"LM Studio 已加载 {model}")
            _sleep(POLL_INTERVAL_S)
        return RuntimeResult(False, f"LM Studio 模型加载超时（{model}，{LOAD_TIMEOUT_S:.0f}s）")

    def stop(self, settings: Settings, model: str = "", log: Callable[[str], None] | None = None,
             script_runner: Callable | None = None) -> RuntimeResult:
        """卸载模型释放显存；model 为空时全量卸载（--all）；server 进程保留。"""
        log = log or (lambda _m: None)
        ids = _loaded_ids(settings)
        if ids is None:
            return RuntimeResult(True, "LM Studio server 未运行，无需卸载")
        if not model:
            if ids:
                log("unload --all（LM Studio 半托管停止）")
                if _run_lms(["unload", "--all"]) != 0:
                    return RuntimeResult(False, "LM Studio 全量卸载失败（lms unload --all rc≠0）")
            return RuntimeResult(True, "LM Studio 模型已卸载（server 保留）")
        if _contains_id(ids, model):
            log(f"unload {model}（LM Studio 半托管停止）")
            if _run_lms(["unload", model]) != 0:
                return RuntimeResult(False, f"LM Studio 卸载模型失败：{model}（lms unload rc≠0）")
        return RuntimeResult(True, "LM Studio 模型已卸载（server 保留）")
