# 2026-08 LLM 网关与模型管理实施轮（llm-gateway-and-model-management）

> ⚠ **执行后变更（2026-08-20 用户裁决）**：逐厂商 key（QWEN/DEEPSEEK/GLM_API_KEY）已正式取消，
> 改为单一 `API_KEY` + `QED_API_PROVIDER`（qwen|deepseek|glm，默认 qwen）；本文档中涉及旧变量的
> 实现细节以当前代码与 [configuration-and-secrets.md](../design/configuration-and-secrets.md) 为准。

状态：Accepted
任务类型：B
最后更新：2026-08-20
关联 ADR：[ADR 0007](../adr/0007-qed-engine-backend-gateway.md)、[ADR 0002](../adr/0002-frontend-and-port-centralization.md)
关联设计：[llm-gateway-and-model-management.md](../design/llm-gateway-and-model-management.md)（Accepted）、
[configuration-and-secrets.md](../design/configuration-and-secrets.md)（密钥分置修订）、
[../architecture/api-contracts.md](../architecture/api-contracts.md)（监控诊断域扩展）
关联 Tracker：`docs/trackers/todo.md`（ARCH-016 登记；REQ-043 / REQ-044 登记）
归档判定：P1/P2 代码门禁全绿（pytest + ruff + 契约 + 前端 tsc/vitest/build）+ 真实冒烟（api/local 两模式）
+ 子项目文档登记完成 → Completed，归档至 `history/plans/2026-08/`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或
> superpowers:executing-plans 执行本计划；任务步骤使用 `- [ ]` 跟踪。本仓库惯例不主动提交 git
> （用户统一提交），故任务不含 commit 步骤。

**Goal:** 为 QED-Engine 根仓库实现 LLM 网关（/llm/text、/llm/vision）、本地模型生命周期脚本
（text-model/ + image-model/）、资源互斥、qed_llm_calls 调用记录与前端控制台改造，并为
QED-Tracker / Axiom-Flow 登记文档级改造请求（REQ-043 / REQ-044）。

**Architecture:** 8900 控制域新增 `services/llm/` 模块（gateway 路由 / model_manager 互斥 /
call_log 记录 / clients 供应商客户端），挂 `api/control.py` 端点；`QED_API_SELECT` 决定
api（API key 直连供应商）或 local（LM Studio 文字 + MinerU 图像）路由；`scripts/text-model/` 与
`scripts/image-model/` 各自管理本地模型启停；前端控制台四服务卡后加 GPU 总览条与依赖组件三卡，
新增调用记录检索页。

**Tech Stack:** Python 3.12 / FastAPI / pydantic-settings / pymysql / httpx / PowerShell（MinerU
编排）/ React 19 + AntD + zustand（前端）。

---

## 前置条件

1. 设计已批准（llm-gateway-and-model-management.md Accepted，2026-08-20 用户确认）。
2. 本机 LM Studio 已启动 qwen 7b 量化模型，地址 `http://127.0.0.1:5001`（无 agent/mcp，可测试）。
3. MinerU 编排文件位于 Axiom-Flow 仓库 `scripts/`（只读源）：`compose.yaml`、`infra-up.ps1`、
   `infra-down.ps1`、`infra-status.ps1`、`docker/Dockerfile`。
4. 根 `.env` 已含 `QWEN_API_KEY`（本机真实可用 key）；`.env.example` 已按新约定修订（P0 完成）。

## 目标与成功标准

1. `backend/qed_engine/config.py` 支持 `API_KEY`（统一密钥，旧变量回退）+ `QED_API_SELECT`
   （api/local）+ 本地模型变量（`QED_LMSTUDIO_URL` 默认 5001、`QED_MINERU_URL`、
   `QED_RESOURCE_GUARD`、`QED_LLM_GATEWAY_URL`）。
2. 根仓库脚本：`scripts/qed_engine_service.py`（8900 生命周期，`--mode api|local`）、
   `scripts/text-model/qed_lmstudio_service.py`、`scripts/image-model/qed_mineru_service.py` +
   MinerU 编排迁入。
3. `services/llm/` 四模块 + 端点：`POST /llm/text`、`POST /llm/vision`、`POST /llm/test/text`、
   `POST /llm/test/vision`、`GET /llm/calls`、`POST /database/test`；`/monitor/gpu` 扩展系统内存。
4. `qed_llm_calls` 表（qed 库）：幂等建表 + 三项目可写（本计划先实现根仓库写入）+ 分页检索。
5. 前端控制台：四服务卡后 GPU 总览条；依赖组件三卡（MySQL/文字模型/图像模型，置灰 + 测试按钮）；
   「模型调用记录」检索页（新路由 `/admin/llm-calls`）。
6. QED-Tracker / Axiom-Flow 各登记文档级改造请求（设计文档 + todo 条目，根仓库只写文档）。

成功标准：`pytest tests -q` + `ruff check backend tests scripts` + `pytest tests/contract -q` 全绿；
前端 `npx tsc -b` + vitest + build 全绿；api 模式真实冒烟（文字调用成功、记录落库）。

## 范围与非目标

范围内：根仓库 P1 后端（config/脚本/llm 模块/端点/迁移）+ P2 前端（控制台/检索页）+ P3 子项目
文档登记；`.env`（本机文件）按新变量补全。

非目标：
- QED-Tracker / Axiom-Flow 代码改造（由对方仓库按 REQ-043 / REQ-044 执行，本计划只登记文档）。
- `/services` 注册表新增模型单元（本地模型走依赖卡 + `/monitor/*`，不占启停单元）。
- 备选模型线路（GLM/DeepSeek）启用；嵌入模型端点（预留不实现）。
- 不提交 git（项目惯例，用户统一提交）。

## 决策记录（用户裁决，2026-08-20）

| # | 问题 | 裁决 |
| --- | --- | --- |
| D1 | 密钥归属 | 三项目各自 .env 自持 key（`API_KEY` 统一变量，旧变量降级别名） |
| D2 | QED-Engine 模式调用形态 | 8900 LLM 网关端点，子项目 HTTP 调网关不接触密钥 |
| D3 | 调用记录 | qed_llm_calls 单表、按项目划分、三项目可写、local 模式也记录（调优用途） |
| D4 | MinerU 交接 | 脚本+编排迁入根仓库 scripts/image-model/，Axiom-Flow 仅经网关调用 |
| D5 | 本地文字模型 | LM Studio qwen 7b 量化 @ 5001（无 agent/mcp，先用于测试） |
| D6 | 资源互斥 | 单一开关 `QED_RESOURCE_GUARD`（默认开）+ 自动互斥；批处理方向不交叉 |
| D7 | 控制台形态 | 四服务卡 → GPU 总览条 → 依赖组件三卡 → 调用检索 |
| D8 | .env 变量 | `QED_API_SELECT` + `API_KEY` 两个核心变量即可，三项目同构 |

---

## 工作项

### P1 后端（根仓库，TDD）

### Task 1: config.py 扩展（统一密钥 + 模式 + 本地模型变量）

**Files:**
- Modify: `backend/qed_engine/config.py`
- Test: `tests/test_config.py`

- [ ] **Step 1: 先写失败测试**——在 `tests/test_config.py` 追加：

```python
def test_unified_api_key_env(monkeypatch):
    """API_KEY（统一变量）优先于旧 QWEN_API_KEY。"""
    monkeypatch.setenv("API_KEY", "sk-unified")
    monkeypatch.setenv("QWEN_API_KEY", "sk-legacy")
    settings = Settings(_env_file=None)
    assert settings.resolved_api_key() == "sk-unified"


def test_api_key_fallback_to_legacy(monkeypatch):
    """API_KEY 为空时回退旧变量 QWEN_API_KEY（向后兼容别名）。"""
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.setenv("QWEN_API_KEY", "sk-legacy")
    settings = Settings(_env_file=None)
    assert settings.resolved_api_key() == "sk-legacy"


def test_api_key_empty_when_none(monkeypatch):
    """无任何 key → resolved_api_key 为空字符串。"""
    for name in ("API_KEY", "QWEN_API_KEY", "DEEPSEEK_API_KEY", "GLM_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None)
    assert settings.resolved_api_key() == ""


def test_api_select_default_and_override(monkeypatch):
    """QED_API_SELECT：默认 api，可覆盖 local。"""
    monkeypatch.delenv("QED_API_SELECT", raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_api_select == "api"
    monkeypatch.setenv("QED_API_SELECT", "local")
    settings = Settings(_env_file=None)
    assert settings.qed_api_select == "local"


def test_local_model_vars(monkeypatch):
    """本地模型变量：QED_LMSTUDIO_URL 默认 5001/v1、QED_MINERU_URL、QED_RESOURCE_GUARD、
    QED_LLM_GATEWAY_URL 默认 8900。"""
    for name in ("QED_LMSTUDIO_URL", "QED_MINERU_URL", "QED_RESOURCE_GUARD", "QED_LLM_GATEWAY_URL"):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_lmstudio_url == "http://127.0.0.1:5001/v1"
    assert settings.qed_mineru_url == "http://127.0.0.1:8002"
    assert settings.qed_resource_guard is True
    assert settings.qed_llm_gateway_url == "http://127.0.0.1:8900"
    monkeypatch.setenv("QED_RESOURCE_GUARD", "false")
    settings = Settings(_env_file=None)
    assert settings.qed_resource_guard is False
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_config.py -q`
Expected: 新用例 FAIL（`AttributeError: Settings has no attribute 'resolved_api_key'` / 默认值断言失败）

- [ ] **Step 3: 实现**——`backend/qed_engine/config.py`：

```python
from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """读取根 .env 的统一配置。空 key 视为未配置，服务保持可用。

    2026-08-20（llm-gateway-and-model-management）：API_KEY 为统一密钥变量（单线路），
    旧变量（QWEN_API_KEY 等）降级为别名，读取顺序 API_KEY → QWEN_API_KEY。
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 统一密钥（API_KEY）；旧变量保留为别名（validator 回退）
    api_key: SecretStr = SecretStr("")
    deepseek_api_key: SecretStr = SecretStr("")
    qwen_api_key: SecretStr = SecretStr("")
    glm_api_key: SecretStr = SecretStr("")
    # 模型模式：api（默认，API key 调用）/ local（本地模型）
    qed_api_select: str = "api"
    # 服务地址（全局端口规划 8900/8901/8902/8903，可被 QED_*_URL 覆盖）
    qed_config_center_url: str = "http://127.0.0.1:8900"
    qed_tracker_url: str = "http://127.0.0.1:8901"
    qed_axiom_url: str = "http://127.0.0.1:8902"
    qed_web_url: str = "http://127.0.0.1:8903"
    # 本地 LLM（LM Studio，OpenAI 兼容）默认地址（QED_LMSTUDIO_URL 可覆盖；本机实测 5001）
    qed_lmstudio_url: str = "http://127.0.0.1:5001/v1"
    # 本地图像模型（MinerU 容器，WSL；编排见 scripts/image-model/）
    qed_mineru_url: str = "http://127.0.0.1:8002"
    # 资源互斥开关（默认开）：启动一方本地模型前先停另一方（4080 16GB 显存约束）
    qed_resource_guard: bool = True
    # LLM 网关地址（子项目 qed-engine 模式读取；api/local 模式忽略）
    qed_llm_gateway_url: str = "http://127.0.0.1:8900"
    # 模型选择（单线路策略：一次只启用一条线路，当前 qwen 三用途）
    qed_model: str = "qwen-plus"
    qed_ocr_model: str = "qwen-vl-plus"
    qed_embedding_model: str = "text-embedding-v4"
    # 统一数据库（MySQL 8 qed 库，ADR 0003；QED_DB_* 为三项目唯一事实源）
    qed_db_host: str = "127.0.0.1"
    qed_db_port: int = 3306
    qed_db_name: str = "qed"
    qed_db_user: str = "root"
    qed_db_password: SecretStr = SecretStr("")

    @model_validator(mode="after")
    def _resolve_api_key(self) -> "Settings":
        """API_KEY 为空时回退旧变量（QWEN_API_KEY → DEEPSEEK_API_KEY → GLM_API_KEY）。"""
        if not self.api_key.get_secret_value():
            for legacy in (self.qwen_api_key, self.deepseek_api_key, self.glm_api_key):
                if legacy.get_secret_value():
                    self.api_key = legacy
                    break
        return self

    def resolved_api_key(self) -> str:
        """统一密钥：API_KEY（含旧变量回退后的值），空字符串表示未配置。"""
        return self.api_key.get_secret_value()

    def has_configured(self, provider: str) -> bool:
        """指定供应商的 API key 是否已配置（空值视为未配置）。"""
        key = getattr(self, f"{provider}_api_key", None)
        if key is None:
            return False
        return key.get_secret_value() != ""
```

- [ ] **Step 4: 更新既有断言**——`tests/test_config.py` 中 `test_lmstudio_url_default_and_override`
  默认值改为 5001：

```python
def test_lmstudio_url_default_and_override(monkeypatch):
    """LM Studio 探测地址：默认 5001/v1（本机实际端口），QED_LMSTUDIO_URL 可覆盖。"""
    monkeypatch.delenv("QED_LMSTUDIO_URL", raising=False)
    settings = Settings(_env_file=None)
    assert settings.qed_lmstudio_url == "http://127.0.0.1:5001/v1"
    monkeypatch.setenv("QED_LMSTUDIO_URL", "http://127.0.0.1:9999/v1")
    settings = Settings(_env_file=None)
    assert settings.qed_lmstudio_url == "http://127.0.0.1:9999/v1"
```

- [ ] **Step 5: 跑测试确认通过**

Run: `python -m pytest tests/test_config.py -q`
Expected: 全部 PASS（含更新后的默认值用例）

### Task 2: scripts/qed_engine_service.py（8900 生命周期，--mode api|local）

**Files:**
- Create: `scripts/qed_engine_service.py`
- Test: `tests/test_qed_engine_service.py`

- [ ] **Step 1: 写契约测试**——`tests/test_qed_engine_service.py`（沿用 test_qed_web_service.py 的
  源码契约 + importlib 行为测试模式）：

```python
"""
模块职责：守护 scripts/qed_engine_service.py（8900 后端生命周期脚本）契约——
PID 文件路径、serve 命令、health 探测端口、--mode api|local 与子命令结构。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：scripts/qed_engine_service.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "qed_engine_service.py"


def test_engine_service_script_exists():
    """qed_engine_service.py 应存在。"""
    assert SCRIPT.is_file(), "scripts/qed_engine_service.py 不存在"


def test_engine_service_script_pid_file_and_serve_command():
    """PID 文件 = logs/qed-engine.pid；serve 命令 = python -m uvicorn qed_engine.api.main:app。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "qed-engine.pid" in src
    assert "qed_engine.api.main:app" in src


def test_engine_service_script_health_probe_port():
    """health 探测端口默认 8900，端点 /api/v1/health。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "8900" in src
    assert "/api/v1/health" in src


def test_engine_service_script_mode_support():
    """--mode api|local：QED_API_SELECT 环境变量注入子进程。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "--mode" in src and "api" in src and "local" in src
    assert "QED_API_SELECT" in src


def test_engine_service_script_subcommands():
    """子命令齐全：start / stop / restart / status。"""
    src = SCRIPT.read_text(encoding="utf-8")
    for cmd in ("start", "stop", "restart", "status"):
        assert cmd in src, f"脚本缺少子命令 {cmd}"


def test_mode_env_injected_into_child(monkeypatch, tmp_path):
    """start --mode local：子进程 env 含 QED_API_SELECT=local（local 模式启用）。"""
    import importlib.util
    import subprocess

    spec = importlib.util.spec_from_file_location("qed_engine_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    monkeypatch.setattr(mod, "PID_FILE", tmp_path / "qed-engine.pid")
    monkeypatch.setattr(mod, "SERVE_LOG", tmp_path / "serve.log")
    captured: dict = {}

    def fake_popen(cmd, **kwargs):
        captured.update(kwargs)
        return type("P", (), {"pid": 4242})()

    monkeypatch.setattr(subprocess, "Popen", fake_popen)
    assert mod._spawn(mode="local") == 0
    assert captured["env"]["QED_API_SELECT"] == "local"
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_qed_engine_service.py -q`
Expected: FAIL（文件不存在）

- [ ] **Step 3: 实现**——复制 `scripts/qed_web_service.py` 骨架，替换以下部分：

```python
"""QED-Engine 8900 后端服务生命周期管理：start / stop / restart / status。

子进程 = `python -m uvicorn qed_engine.api.main:app`（继承当前解释器，天然落在 QED_env）；
PID 文件 logs/qed-engine.pid，子进程 stdout/stderr 落 logs/qed-engine-serve.log。
--mode api|local：覆盖 QED_API_SELECT 环境变量注入子进程（默认读根 .env），重启可换模式；
api 模式走 API key 调用，local 模式启用本地模型（LM Studio / MinerU）。
健康探测端点：http://127.0.0.1:8900/api/v1/health。
契约见 docs/design/llm-gateway-and-model-management.md（2026-08-20）。

退出码：0 成功/幂等；1 运行失败（spawn 失败、health 超时）；2 参数错误（argparse）。
Windows 注意：os.kill(pid, 0) 会直接 TerminateProcess，进程存在性检测用 tasklist。
"""

from __future__ import annotations

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"
PID_FILE = LOG_DIR / "qed-engine.pid"
SERVE_LOG = LOG_DIR / "qed-engine-serve.log"

NEW_PROCESS_GROUP = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
CTRL_BREAK_EVENT = getattr(signal, "CTRL_BREAK_EVENT", signal.SIGTERM)

STOP_GRACE_SECONDS = 5.0
STOP_POLL_INTERVAL = 0.2
HEALTH_TIMEOUT_SECONDS = 30.0
HEALTH_INTERVAL_SECONDS = 0.5

# 以下函数与 qed_web_service.py 同构（_pid_is_alive / read_pid / _port_open / _health_ok /
# _wait_healthy / cmd_start / _kill_tree / cmd_stop / cmd_restart / cmd_status / build_parser），
# 差异仅在：default_port() 默认 8900（QED_CONFIG_CENTER_URL 解析）、serve_command(port, mode)。


def default_port() -> int:
    """health 探测端口：QED_CONFIG_CENTER_URL 端口解析，默认 8900。"""
    raw = os.getenv("QED_CONFIG_CENTER_URL", "")
    if raw:
        try:
            return int(raw.rstrip("/").rsplit(":", 1)[1])
        except (ValueError, IndexError):
            pass
    return 8900


def serve_command(port: int, mode: str | None = None) -> list[str]:
    """子进程命令：当前解释器 + uvicorn + 8900 API 应用。"""
    return [
        sys.executable, "-m", "uvicorn", "qed_engine.api.main:app",
        "--host", "127.0.0.1", "--port", str(port),
    ]


def _spawn(port: int, mode: str | None = None) -> int:
    """拉起服务进程并写 PID 文件；mode 非空时注入 QED_API_SELECT 环境变量。"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = open(SERVE_LOG, "ab")  # noqa: SIM115 - 子进程继承句柄，随其生命周期
    env = os.environ.copy()
    if mode:
        env["QED_API_SELECT"] = mode
    try:
        proc = subprocess.Popen(
            serve_command(port, mode),
            cwd=str(ROOT),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            creationflags=NEW_PROCESS_GROUP,
            env=env,
        )
    except Exception as exc:
        log_file.close()
        print(f"spawn failed: {exc}")
        return 1
    PID_FILE.write_text(str(proc.pid), encoding="utf-8")
    print(f"pid: {proc.pid}")
    print(f"log: {SERVE_LOG}")
    return 0
```

`build_parser` 增加 `--mode` 参数（`choices=["api", "local"]`，start/restart 均支持），
`cmd_start`/`cmd_restart` 调用 `_spawn(args.port, args.mode)`；其余逻辑照抄骨架。

- [ ] **Step 4: 跑测试确认通过**

Run: `python -m pytest tests/test_qed_engine_service.py tests/test_qed_web_service.py -q`
Expected: 全部 PASS

### Task 3: scripts/text-model/qed_lmstudio_service.py（LM Studio 生命周期）

**Files:**
- Create: `scripts/text-model/qed_lmstudio_service.py`
- Test: `tests/test_qed_lmstudio_service.py`

- [ ] **Step 1: 写契约测试**：

```python
"""
模块职责：守护 scripts/text-model/qed_lmstudio_service.py（本地文字模型生命周期）契约——
lms CLI 启停、健康探测（QED_LMSTUDIO_URL / 默认 5001/v1）、子命令结构。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：scripts/text-model/qed_lmstudio_service.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "text-model" / "qed_lmstudio_service.py"


def test_lmstudio_script_exists():
    assert SCRIPT.is_file(), "scripts/text-model/qed_lmstudio_service.py 不存在"


def test_lmstudio_script_contract():
    """lms CLI 命令 + 健康端点 + 子命令齐全。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "lms" in src, "应优先使用 LM Studio 官方 lms CLI"
    assert "/v1/models" in src, "健康探测应检查 /v1/models"
    assert "5001" in src, "默认端口应为 5001"
    for cmd in ("start", "stop", "restart", "status"):
        assert cmd in src, f"脚本缺少子命令 {cmd}"


def test_lmstudio_health_probe(monkeypatch):
    """_health_ok：/v1/models 200 即就绪；lms CLI 缺失时 start 返回明确错误提示。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_lmstudio_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    import urllib.request

    calls: dict = {}

    def fake_urlopen(url, timeout=1.0):
        calls["url"] = url
        return type("R", (), {"status": 200})()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    assert mod._health_ok(5001) is True
    assert "5001" in calls["url"] and "/v1/models" in calls["url"]
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_qed_lmstudio_service.py -q`
Expected: FAIL（文件不存在）

- [ ] **Step 3: 实现**——`scripts/text-model/qed_lmstudio_service.py`（骨架同 qed_web_service.py，
  核心差异如下）：

```python
"""本地文字模型（LM Studio）生命周期管理：start / stop / restart / status。

优先使用 LM Studio 官方 CLI（`lms server start|stop`，模型加载 `lms load <model>`）；
lms 不在 PATH 时 start 返回 1 并提示手动启动（LM Studio 为 GUI 应用，进程管理不稳定）。
健康探测：GET {QED_LMSTUDIO_URL}/models（默认 http://127.0.0.1:5001/v1，OpenAI 兼容）。
由 services/llm/model_manager.py 调用（资源互斥编排），也可手动执行。
退出码：0 成功/幂等；1 运行失败；2 参数错误（argparse）。
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # scripts/text-model/ → 仓库根
LOG_DIR = ROOT / "logs"


def default_base_url() -> str:
    """QED_LMSTUDIO_URL 环境变量，默认 http://127.0.0.1:5001/v1。"""
    return os.getenv("QED_LMSTUDIO_URL", "http://127.0.0.1:5001/v1").rstrip("/")


def _base_from_port(port: int) -> str:
    return f"http://127.0.0.1:{port}/v1"


def _health_ok(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/v1/models", timeout=1.0) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _lms() -> str | None:
    """lms CLI 路径；未安装返回 None。"""
    return shutil.which("lms")


def cmd_start(args: argparse.Namespace) -> int:
    port = args.port
    if _health_ok(port):
        print(f"already running (port {port})")
        return 0
    lms = _lms()
    if lms is None:
        print("lms CLI 未安装：请手动启动 LM Studio（加载 qwen 7b 模型，端口 5001）")
        return 1
    result = subprocess.run([lms, "server", "start"], capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f"lms server start failed: {result.stderr.strip()}")
        return 1
    if args.model:
        subprocess.run([lms, "load", args.model], capture_output=True, text=True, timeout=120)
    if args.wait and args.wait > 0:
        return _wait_healthy(port, args.wait)
    return 0


def cmd_stop(args: argparse.Namespace) -> int:
    lms = _lms()
    if lms is None:
        print("lms CLI 未安装：请在 LM Studio 界面手动停止服务")
        return 1
    subprocess.run([lms, "server", "stop"], capture_output=True, text=True, timeout=30)
    print("stopped")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    if _health_ok(args.port):
        print(f"running (port probe {args.port})")
        return 0
    print("stopped")
    return 0


def cmd_restart(args: argparse.Namespace) -> int:
    cmd_stop(args)
    return cmd_start(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="qed_lmstudio_service",
        description="本地文字模型（LM Studio）生命周期管理（start/stop/restart/status）。",
    )
    parser.add_argument("--port", type=int, default=5001, help="健康探测端口（默认 5001）")
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("start", help="启动 LM Studio 服务（lms CLI）")
    start.add_argument("--model", default=None, help="lms load 的模型 id（可选）")
    start.add_argument("--wait", nargs="?", const=30.0, type=float, default=0.0,
                       help="等待 /v1/models 就绪，默认 30s")
    start.set_defaults(func=cmd_start)

    stop = subparsers.add_parser("stop", help="停止服务（lms server stop）")
    stop.set_defaults(func=cmd_stop)

    restart = subparsers.add_parser("restart", help="重启服务")
    restart.add_argument("--model", default=None)
    restart.add_argument("--wait", nargs="?", const=30.0, type=float, default=0.0)
    restart.set_defaults(func=cmd_restart)

    status = subparsers.add_parser("status", help="查询服务状态")
    status.set_defaults(func=cmd_status)
    return parser
```

（`_wait_healthy`/`main` 照抄骨架；文件头补 `import os`、`import urllib.error`。）

- [ ] **Step 4: 跑测试确认通过**

Run: `python -m pytest tests/test_qed_lmstudio_service.py -q`
Expected: PASS

### Task 4: scripts/image-model/（MinerU 编排迁入 + qed_mineru_service.py）

**Files:**
- Create: `scripts/image-model/compose.yaml`、`infra-up.ps1`、`infra-down.ps1`、`infra-status.ps1`、`docker/Dockerfile`（自 Axiom-Flow 只读复制）
- Create: `scripts/image-model/qed_mineru_service.py`
- Test: `tests/test_qed_mineru_service.py`

- [ ] **Step 1: 迁移编排文件**（只读 Axiom-Flow，写入根仓库；对方移除由 REQ-044 执行）：

```powershell
New-Item -ItemType Directory -Force -Path "scripts\image-model\docker" | Out-Null
Copy-Item "Axiom-Flow\scripts\compose.yaml" "scripts\image-model\compose.yaml"
Copy-Item "Axiom-Flow\scripts\infra-up.ps1" "scripts\image-model\infra-up.ps1"
Copy-Item "Axiom-Flow\scripts\infra-down.ps1" "scripts\image-model\infra-down.ps1"
Copy-Item "Axiom-Flow\scripts\infra-status.ps1" "scripts\image-model\infra-status.ps1"
Copy-Item "Axiom-Flow\scripts\docker\Dockerfile" "scripts\image-model\docker\Dockerfile"
```

Expected: `Get-ChildItem scripts\image-model -Recurse -File | Select-Object FullName` 列出 6 个文件

- [ ] **Step 2: 写契约测试**——`tests/test_qed_mineru_service.py`：

```python
"""
模块职责：守护 scripts/image-model/qed_mineru_service.py（本地图像模型 MinerU 生命周期）契约——
infra-*.ps1 编排调用、健康探测（8002 /api/v1/health）、子命令结构。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：scripts/image-model/qed_mineru_service.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "image-model" / "qed_mineru_service.py"


def test_mineru_script_exists():
    assert SCRIPT.is_file(), "scripts/image-model/qed_mineru_service.py 不存在"


def test_mineru_script_contract():
    """infra 编排脚本引用 + 健康端点 + 子命令齐全。"""
    src = SCRIPT.read_text(encoding="utf-8")
    assert "infra-up.ps1" in src and "infra-down.ps1" in src and "infra-status.ps1" in src
    assert "8002" in src and "/api/v1/health" in src
    for cmd in ("start", "stop", "restart", "status"):
        assert cmd in src, f"脚本缺少子命令 {cmd}"


def test_mineru_health_probe(monkeypatch):
    """_health_ok：8002 /api/v1/health 200 即就绪。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("qed_mineru_service_mod", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    import urllib.request

    calls: dict = {}

    def fake_urlopen(url, timeout=1.0):
        calls["url"] = url
        return type("R", (), {"status": 200})()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    assert mod._health_ok(8002) is True
    assert "/api/v1/health" in calls["url"]
```

- [ ] **Step 3: 跑测试确认失败**

Run: `python -m pytest tests/test_qed_mineru_service.py -q`
Expected: FAIL（文件不存在）

- [ ] **Step 4: 实现**——`scripts/image-model/qed_mineru_service.py`（骨架同 qed_web_service.py，
  核心差异如下）：

```python
"""本地图像模型（MinerU 容器，WSL）生命周期管理：start / stop / restart / status。

经 PowerShell 编排脚本（scripts/image-model/infra-*.ps1，WSL Docker Compose，端口 8002）
执行启停；健康探测：GET http://127.0.0.1:8002/api/v1/health。
由 services/llm/model_manager.py 调用（资源互斥编排），也可手动执行。
退出码：0 成功/幂等；1 运行失败；2 参数错误（argparse）。
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # scripts/image-model/ → 仓库根
IMAGE_MODEL_DIR = ROOT / "scripts" / "image-model"


def default_port() -> int:
    """健康探测端口：QED_MINERU_URL 端口解析，默认 8002。"""
    raw = os.getenv("QED_MINERU_URL", "")
    if raw:
        try:
            return int(raw.rstrip("/").rsplit(":", 1)[1])
        except (ValueError, IndexError):
            pass
    return 8002


def _health_ok(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/v1/health", timeout=1.0) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _run_infra(script: str) -> int:
    """执行编排脚本：powershell -ExecutionPolicy Bypass -File <script>。"""
    result = subprocess.run(
        ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(IMAGE_MODEL_DIR / script)],
        cwd=str(ROOT),
        timeout=600,
        check=False,
    )
    return result.returncode


def cmd_start(args: argparse.Namespace) -> int:
    port = args.port
    if _health_ok(port):
        print(f"already running (port {port})")
        return 0
    if _run_infra("infra-up.ps1") != 0:
        print("infra-up.ps1 失败（WSL/容器不可达？）")
        return 1
    if args.wait and args.wait > 0:
        return _wait_healthy(port, args.wait)
    return 0


def cmd_stop(args: argparse.Namespace) -> int:
    if _run_infra("infra-down.ps1") != 0:
        print("infra-down.ps1 失败")
        return 1
    print("stopped")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    _run_infra("infra-status.ps1")
    if _health_ok(args.port):
        print(f"running (port probe {args.port})")
        return 0
    print("stopped")
    return 0


def cmd_restart(args: argparse.Namespace) -> int:
    cmd_stop(args)
    return cmd_start(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="qed_mineru_service",
        description="本地图像模型（MinerU 容器）生命周期管理（start/stop/restart/status）。",
    )
    parser.add_argument("--port", type=int, default=None,
                        help="健康探测端口（默认 QED_MINERU_URL 解析或 8002）")
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("start", help="启动 MinerU 容器（infra-up.ps1）")
    start.add_argument("--wait", nargs="?", const=120.0, type=float, default=0.0,
                       help="等待 /api/v1/health 就绪，默认 120s")
    start.set_defaults(func=cmd_start)

    stop = subparsers.add_parser("stop", help="停止容器（infra-down.ps1）")
    stop.set_defaults(func=cmd_stop)

    restart = subparsers.add_parser("restart", help="重启服务")
    restart.add_argument("--wait", nargs="?", const=120.0, type=float, default=0.0)
    restart.set_defaults(func=cmd_restart)

    status = subparsers.add_parser("status", help="查询服务状态")
    status.set_defaults(func=cmd_status)
    return parser
```

（`_wait_healthy`/`main` 照抄骨架，`main` 中 `args.port = default_port()` 兜底。）

- [ ] **Step 5: 跑测试确认通过**

Run: `python -m pytest tests/test_qed_mineru_service.py -q`
Expected: PASS

### Task 5: monitor.py 系统内存扩展（/monitor/gpu 附带 sys_memory）

**Files:**
- Modify: `backend/qed_engine/services/monitor.py`
- Modify: `backend/qed_engine/api/schemas.py`（GpuStatus 加字段）
- Test: `tests/test_monitor.py`

- [ ] **Step 1: 写失败测试**——`tests/test_monitor.py` 追加：

```python
def test_probe_memory_windows_ok(monkeypatch):
    """系统内存探测（Windows GlobalMemoryStatusEx）：字段齐全。"""
    import ctypes
    import sys

    monkeypatch.setattr(sys, "platform", "win32")

    class FakeStat:
        dwLength = 64
        dwMemoryLoad = 45
        ullTotalPhys = 32 * 1024**3
        ullAvailPhys = 17 * 1024**3
        ullTotalPageFile = 0
        ullAvailPageFile = 0
        ullTotalVirtual = 0
        ullAvailVirtual = 0
        ullAvailExtendedVirtual = 0

    fake = FakeStat()

    def fake_global_memory_status_ex(ptr):
        ptr.contents.dwMemoryLoad = fake.dwMemoryLoad
        ptr.contents.ullTotalPhys = fake.ullTotalPhys
        ptr.contents.ullAvailPhys = fake.ullAvailPhys
        return True

    monkeypatch.setattr(ctypes.windll.kernel32, "GlobalMemoryStatusEx", fake_global_memory_status_ex)
    result = monitor.probe_memory()
    assert result["available"] is True
    assert result["total_mb"] == 32768
    assert result["used_mb"] == 15360
    assert result["percent"] == 45


def test_probe_memory_non_windows_reports_reason(monkeypatch):
    """非 Windows 平台：available=false + 中文原因（不抛异常）。"""
    import sys

    monkeypatch.setattr(sys, "platform", "linux")
    result = monitor.probe_memory()
    assert result["available"] is False


def test_probe_gpu_attaches_memory_when_provided():
    """probe_gpu(memory_fn=...) 时响应附带 sys_memory_* 字段（端点注入）。"""
    runner = _fake_smi("NVIDIA GeForce RTX 4080, 16376, 4096, 65")
    result = monitor.probe_gpu(runner=runner, memory_fn=lambda: {"available": True, "total_mb": 32768, "used_mb": 15360, "percent": 45})
    assert result["sys_memory_total_mb"] == 32768
    assert result["sys_memory_used_mb"] == 15360
    assert result["sys_memory_percent"] == 45
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_monitor.py -q`
Expected: 新用例 FAIL（`AttributeError: module 'qed_engine.services.monitor' has no attribute 'probe_memory'`）

- [ ] **Step 3: 实现**——`monitor.py` 追加：

```python
def probe_memory() -> dict:
    """系统内存（Windows GlobalMemoryStatusEx；非 Windows 尽力报告失败原因）。"""
    if sys.platform != "win32":
        return {"available": False, "reason": "系统内存探测仅支持 Windows（本机部署平台）"}
    try:
        import ctypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
            return {"available": False, "reason": "GlobalMemoryStatusEx 失败"}
        total_mb = stat.ullTotalPhys // (1024 * 1024)
        used_mb = (stat.ullTotalPhys - stat.ullAvailPhys) // (1024 * 1024)
        return {"available": True, "total_mb": total_mb, "used_mb": used_mb, "percent": stat.dwMemoryLoad}
    except Exception as exc:
        return {"available": False, "reason": f"内存探测失败：{type(exc).__name__}"}
```

`probe_gpu` 签名改为 `def probe_gpu(runner: Runner | None = None, memory_fn: Callable[[], dict] | None = None)`，
返回 dict 在 `memory_fn` 非空时附加：

```python
    result = {
        "available": True,
        "name": name,
        "memory_total_mb": total_mb,
        "memory_used_mb": used_mb,
        "utilization_percent": utilization,
        "processes": processes,
    }
    if memory_fn is not None:
        mem = memory_fn()
        result.update(
            sys_memory_total_mb=mem.get("total_mb", 0),
            sys_memory_used_mb=mem.get("used_mb", 0),
            sys_memory_percent=mem.get("percent", 0),
        )
    return result
```

`monitor.py` 文件头补 `import sys`。

- [ ] **Step 4: schemas.py 扩展 GpuStatus**：

```python
class GpuStatus(BaseModel):
    available: bool
    name: str = ""
    memory_total_mb: int = 0
    memory_used_mb: int = 0
    utilization_percent: int = 0
    processes: list[dict] = []
    sys_memory_total_mb: int = 0
    sys_memory_used_mb: int = 0
    sys_memory_percent: int = 0
    reason: str = ""
```

- [ ] **Step 5: 端点注入内存**——`api/control.py` 的 `monitor_gpu` 改为：

```python
@router.get("/monitor/gpu", response_model=GpuStatus)
def monitor_gpu() -> GpuStatus:
    """GPU 状态（nvidia-smi 解析）+ 系统内存（GlobalMemoryStatusEx）；不可用也 200 + reason。"""
    return GpuStatus(**probe_gpu(memory_fn=probe_memory))
```

并更新 `api/control.py` 导入：`from qed_engine.services.monitor import probe_gpu, probe_lmstudio, probe_mineru, probe_memory`。

- [ ] **Step 6: 更新端点测试**——`tests/test_monitor.py` 中 `test_monitor_gpu_endpoint` 的
  monkeypatch 返回体补 `sys_memory_*` 字段（monkeypatch 直接替换 probe_gpu 时不带内存字段，
  断言仍通过——但为契约完整，改为断言 `sys_memory_percent` 在响应中存在）。

- [ ] **Step 7: 跑测试确认通过**

Run: `python -m pytest tests/test_monitor.py -q`
Expected: 全部 PASS

### Task 6: services/llm/call_log.py（qed_llm_calls 表 + 写入/检索）

**Files:**
- Create: `backend/qed_engine/services/llm/__init__.py`
- Create: `backend/qed_engine/services/llm/call_log.py`
- Test: `tests/test_llm_call_log.py`

- [ ] **Step 1: 写失败测试**——`tests/test_llm_call_log.py`（fake connection 模式，不依赖真实 MySQL）：

```python
"""
模块职责：LLM 调用记录（qed_llm_calls）契约测试：建表 SQL、写入字段、分页检索、降级。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：backend/qed_engine/services/llm/call_log.py
"""

import pytest
from qed_engine.config import Settings
from qed_engine.services.llm import call_log


class FakeCursor:
    def __init__(self):
        self.executed = []
        self.fetchone_result = None
        self.fetchall_result = []

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.fetchone_result

    def fetchall(self):
        return self.fetchall_result


class FakeConn:
    def __init__(self, cursor: FakeCursor):
        self.cursor = cursor

    def cursor(self):
        return self.cursor

    def commit(self):
        pass

    def close(self):
        pass


def _settings() -> Settings:
    return Settings(_env_file=None, qed_db_password="sk-test")


def test_ensure_table_creates_if_not_exists(monkeypatch):
    """建表 SQL：CREATE TABLE IF NOT EXISTS qed_llm_calls（幂等）。"""
    cursor = FakeCursor()
    conn = FakeConn(cursor)
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    call_log.ensure_table(_settings())
    sql = cursor.executed[0][0]
    assert "CREATE TABLE IF NOT EXISTS" in sql and "qed_llm_calls" in sql
    assert "prompt_template" in sql and "duration_ms" in sql and "created_at" in sql


def test_record_call_inserts_fields(monkeypatch):
    """写入：INSERT 含 service/mode/provider/model/endpoint/prompt/response/duration/status。"""
    cursor = FakeCursor()
    conn = FakeConn(cursor)
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    call_id = call_log.record_call(
        _settings(),
        service="qed_engine", mode="api", provider="qwen", model="qwen-plus",
        endpoint="text", prompt="你好", response="你好！",
        duration_ms=123, status="success", error="", prompt_template="greeting",
    )
    assert call_id is not None
    sql, params = cursor.executed[1]
    assert "INSERT INTO qed_llm_calls" in sql
    assert params["service"] == "qed_engine" and params["prompt"] == "你好"


def test_record_call_degrades_when_db_down(monkeypatch, caplog):
    """数据库不可达：降级返回 None，不抛异常（记日志）。"""
    import logging

    def boom(settings):
        raise RuntimeError("connect refused")

    monkeypatch.setattr(call_log, "_connect", boom)
    with caplog.at_level(logging.WARNING, logger="qed_engine.llm"):
        assert call_log.record_call(_settings(), service="qed_engine", mode="api",
                                    provider="qwen", model="m", endpoint="text",
                                    prompt="p", response="r", duration_ms=1,
                                    status="success", error="") is None


def test_search_calls_filters_and_paginates(monkeypatch):
    """检索：WHERE 过滤（service/status/时间）+ ORDER BY id DESC + LIMIT/OFFSET + COUNT。"""
    cursor = FakeCursor()
    cursor.fetchone_result = (3,)
    cursor.fetchall_result = [{"id": 9, "service": "qed_engine"}]
    conn = FakeConn(cursor)
    monkeypatch.setattr(call_log, "_connect", lambda settings: conn)
    result = call_log.search_calls(
        _settings(), service="qed_tracker", status="success",
        start="2026-08-01", end="2026-08-20", page=1, size=10,
    )
    assert result["total"] == 3
    assert result["items"][0]["id"] == 9
    sqls = [s for s, _ in cursor.executed]
    assert any("COUNT(*)" in s for s in sqls)
    where_sql = sqls[-1]
    assert "qed_tracker" in where_sql and "LIMIT" in where_sql and "OFFSET" in where_sql
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_llm_call_log.py -q`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**——`backend/qed_engine/services/llm/__init__.py`（空文件）与
  `backend/qed_engine/services/llm/call_log.py`：

```python
"""LLM 调用记录：qed_llm_calls 表（qed 库）幂等建表、写入与分页检索。

表归属 QED-Engine 根仓库（llm-gateway-and-model-management.md）；三项目均可写入
（QED-Tracker / Axiom-Flow 的 local 模式直写，约定 service 字段标识自身）。
数据库不可达时写入降级（记日志返回 None），不阻塞 LLM 调用主流程。

设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
关联测试：tests/test_llm_call_log.py
"""

import logging
import time
from datetime import UTC, datetime, timedelta

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
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""

INSERT_SQL = """
INSERT INTO qed_llm_calls
  (service, mode, provider, model, endpoint, prompt_template, prompt, response,
   duration_ms, status, error, created_at)
VALUES
  (%(service)s, %(mode)s, %(provider)s, %(model)s, %(endpoint)s, %(prompt_template)s,
   %(prompt)s, %(response)s, %(duration_ms)s, %(status)s, %(error)s, %(created_at)s)
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
            })
        conn.commit()
        return int(conn.cursor().lastrowid or 0) or None
    except Exception as exc:
        logger.warning("qed_llm_calls 写入失败：%s", type(exc).__name__)
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
    page: int = 1,
    size: int = 20,
) -> dict:
    """分页检索调用记录（倒序）；过滤条件可空；数据库不可达降级返回空结果。"""
    where, params = [], {}
    if service:
        where.append("service = %(service)s"); params["service"] = service
    if mode:
        where.append("mode = %(mode)s"); params["mode"] = mode
    if model:
        where.append("model LIKE %(model)s"); params["model"] = f"%{model}%"
    if status:
        where.append("status = %(status)s"); params["status"] = status
    if start:
        where.append("created_at >= %(start)s")
        params["start"] = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=None)
    if end:
        where.append("created_at <= %(end)s")
        params["end"] = datetime.strptime(end, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=None,
        )
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    offset = max(page - 1, 0) * size
    try:
        conn = _connect(settings)
    except Exception as exc:
        logger.warning("qed_llm_calls 检索降级（数据库不可达）：%s", type(exc).__name__)
        return {"items": [], "total": 0, "page": page, "size": size}
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(f"SELECT COUNT(*) AS n FROM qed_llm_calls {clause}", params)
            total = cursor.fetchone()["n"]
            cursor.execute(
                f"SELECT * FROM qed_llm_calls {clause} ORDER BY id DESC LIMIT %(limit)s OFFSET %(offset)s",
                {**params, "limit": size, "offset": offset},
            )
            items = cursor.fetchall()
        return {"items": items, "total": total, "page": page, "size": size}
    except Exception as exc:
        logger.warning("qed_llm_calls 检索失败：%s", type(exc).__name__)
        return {"items": [], "total": 0, "page": page, "size": size}
    finally:
        conn.close()
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python -m pytest tests/test_llm_call_log.py -q`
Expected: PASS

### Task 7: services/llm/clients.py（供应商客户端）

**Files:**
- Create: `backend/qed_engine/services/llm/clients.py`
- Test: `tests/test_llm_clients.py`

- [ ] **Step 1: 写失败测试**——`tests/test_llm_clients.py`（httpx MockTransport）：

```python
"""
模块职责：LLM 供应商客户端契约测试：qwen 文字/视觉（OpenAI 兼容）、LM Studio、MinerU。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：backend/qed_engine/services/llm/clients.py
"""

import httpx
import pytest
from qed_engine.services.llm import clients


def _mock_client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_qwen_text_chat_ok():
    """qwen 文字：POST /chat/completions，返回 choices[0].message.content。"""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/chat/completions")
        assert request.headers["Authorization"] == "Bearer sk-test"
        return httpx.Response(200, json={
            "choices": [{"message": {"content": "回答内容"}}],
        })

    with _mock_client(handler) as client:
        reply = clients.qwen_text_chat(
            api_key="sk-test", model="qwen-plus", messages=[{"role": "user", "content": "你好"}],
            client=client,
        )
    assert reply == "回答内容"


def test_qwen_text_chat_http_error():
    """qwen 文字：非 200 抛 RuntimeError（含状态码）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={})

    with _mock_client(handler) as client:
        with pytest.raises(RuntimeError, match="429"):
            clients.qwen_text_chat(api_key="sk", model="m", messages=[], client=client)


def test_lmstudio_chat_uses_first_loaded_model(monkeypatch):
    """LM Studio：model 为空时探测 /v1/models 取第一个已加载模型。"""

    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path.endswith("/models"):
            return httpx.Response(200, json={"data": [{"id": "qwen3-8b"}]})
        return httpx.Response(200, json={"choices": [{"message": {"content": "本地回答"}}]})

    with _mock_client(handler) as client:
        reply = clients.lmstudio_chat(
            base_url="http://127.0.0.1:5001/v1", messages=[{"role": "user", "content": "hi"}],
            client=client,
        )
    assert reply == "本地回答"
    assert "/models" in calls[0]


def test_qwen_vision_chat_sends_image():
    """qwen 视觉：请求体含 image_url data URI（base64 图片）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.read().decode("utf-8")
        assert "data:image/png;base64," in body
        return httpx.Response(200, json={"choices": [{"message": {"content": "OCR 结果"}}]})

    with _mock_client(handler) as client:
        reply = clients.qwen_vision_chat(
            api_key="sk-test", model="qwen-vl-plus",
            image_base64="aGVsbG8=", prompt="识别内容", client=client,
        )
    assert reply == "OCR 结果"


def test_mineru_parse_polls_result():
    """MinerU：POST /file_parse 提交 → GET /get_task_results 轮询 → markdown。"""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/file_parse"):
            return httpx.Response(200, json={"task_id": "t-1"})
        return httpx.Response(200, json={
            "code": 200,
            "data": {"state": "done", "full_zip_url": "", "markdown": "## 标题\n正文"},
        })

    with _mock_client(handler) as client:
        reply = clients.mineru_parse(
            base_url="http://127.0.0.1:8002",
            file_bytes=b"pdf-bytes", filename="a.pdf", client=client,
            poll_interval=0.01, max_wait=1.0,
        )
    assert "标题" in reply
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_llm_clients.py -q`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**——`backend/qed_engine/services/llm/clients.py`：

```python
"""LLM 供应商客户端：qwen（阿里百炼 OpenAI 兼容）、LM Studio（OpenAI 兼容）、MinerU。

全部函数接受可注入 httpx.Client（测试用 MockTransport）；网络/HTTP 异常映射为
RuntimeError（中文原因 + 状态码），由 gateway 层捕获并记录。

设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
关联测试：tests/test_llm_clients.py
"""

import time
from pathlib import Path

import httpx

DEFAULT_TIMEOUT = 60.0


def _post_json(client: httpx.Client, url: str, headers: dict, payload: dict) -> dict:
    try:
        response = client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise RuntimeError(f"模型调用失败：{type(exc).__name__}") from exc
    if response.status_code != 200:
        raise RuntimeError(f"模型调用失败：HTTP {response.status_code}")
    return response.json()


def _extract_content(data: dict) -> str:
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("模型响应格式异常（缺 choices[0].message.content）") from exc


def qwen_text_chat(
    api_key: str,
    model: str,
    messages: list[dict],
    client: httpx.Client | None = None,
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1",
    timeout: float = DEFAULT_TIMEOUT,
) -> str:
    """qwen 文字对话（OpenAI 兼容 chat/completions）。"""
    own = client is None
    http = client or httpx.Client(timeout=timeout)
    try:
        data = _post_json(
            http,
            f"{base_url.rstrip('/')}/chat/completions",
            {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            {"model": model, "messages": messages},
        )
        return _extract_content(data)
    finally:
        if own:
            http.close()


def lmstudio_chat(
    base_url: str,
    messages: list[dict],
    client: httpx.Client | None = None,
    model: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> str:
    """LM Studio 本地文字（OpenAI 兼容）；model 为空时取 /v1/models 第一个已加载模型。"""
    own = client is None
    http = client or httpx.Client(timeout=timeout)
    try:
        if not model:
            response = http.get(f"{base_url.rstrip('/')}/models")
            if response.status_code != 200:
                raise RuntimeError(f"LM Studio 模型列表获取失败：HTTP {response.status_code}")
            models = [item.get("id", "") for item in response.json().get("data", []) if isinstance(item, dict)]
            if not models:
                raise RuntimeError("LM Studio 未加载任何模型（请先在 LM Studio 加载 qwen 模型）")
            model = models[0]
        data = _post_json(
            http,
            f"{base_url.rstrip('/')}/chat/completions",
            {"Content-Type": "application/json"},
            {"model": model, "messages": messages},
        )
        return _extract_content(data)
    finally:
        if own:
            http.close()


def qwen_vision_chat(
    api_key: str,
    model: str,
    image_base64: str,
    prompt: str,
    client: httpx.Client | None = None,
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1",
    timeout: float = DEFAULT_TIMEOUT,
) -> str:
    """qwen 视觉（OCR）：图片 base64 以 data URI 形式随对话发送。"""
    own = client is None
    http = client or httpx.Client(timeout=timeout)
    try:
        data = _post_json(
            http,
            f"{base_url.rstrip('/')}/chat/completions",
            {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            {
                "model": model,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
                        {"type": "text", "text": prompt},
                    ],
                }],
            },
        )
        return _extract_content(data)
    finally:
        if own:
            http.close()


def mineru_parse(
    base_url: str,
    file_bytes: bytes,
    filename: str,
    client: httpx.Client | None = None,
    poll_interval: float = 5.0,
    max_wait: float = 300.0,
) -> str:
    """MinerU 文档解析：POST /file_parse（multipart）→ 轮询 /get_task_results → markdown。

    轮询超时抛 RuntimeError；解析失败（state=fail）抛 RuntimeError（附原因）。
    """
    own = client is None
    http = client or httpx.Client(timeout=30.0)
    try:
        files = {"files": (filename, file_bytes, "application/pdf")}
        response = http.post(f"{base_url.rstrip('/')}/file_parse", files=files)
        if response.status_code != 200:
            raise RuntimeError(f"MinerU 提交失败：HTTP {response.status_code}")
        task_id = response.json().get("task_id")
        if not task_id:
            raise RuntimeError("MinerU 提交失败：响应缺 task_id")

        deadline = time.monotonic() + max_wait
        while time.monotonic() < deadline:
            result = http.get(f"{base_url.rstrip('/')}/get_task_results/{task_id}")
            if result.status_code != 200:
                raise RuntimeError(f"MinerU 结果查询失败：HTTP {result.status_code}")
            data = result.json().get("data", {})
            state = data.get("state")
            if state == "done":
                markdown = data.get("markdown") or ""
                if not markdown:
                    raise RuntimeError("MinerU 解析完成但无 markdown 产物")
                return markdown
            if state in ("fail", "error"):
                raise RuntimeError(f"MinerU 解析失败：{data.get('err_msg', state)}")
            time.sleep(poll_interval)
        raise RuntimeError(f"MinerU 解析超时（>{max_wait:g}s）")
    finally:
        if own:
            http.close()
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python -m pytest tests/test_llm_clients.py -q`
Expected: PASS

### Task 8: services/llm/model_manager.py（资源互斥）

**Files:**
- Create: `backend/qed_engine/services/llm/model_manager.py`
- Test: `tests/test_llm_model_manager.py`

- [ ] **Step 1: 写失败测试**——`tests/test_llm_model_manager.py`：

```python
"""
模块职责：本地模型资源互斥（model_manager）契约测试：api 模式不启动本地、
local 模式启动前先停对方、guard=false 跳过互斥、已就绪不重复启动。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：backend/qed_engine/services/llm/model_manager.py
"""

import pytest
from qed_engine.config import Settings
from qed_engine.services.llm import model_manager


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


def _noop_runner():
    class P:
        def __init__(self, *a, **k):
            self.returncode = 0

    return P


def test_api_mode_never_starts_local():
    """api 模式：本地模型完全不参与（不探测、不启动）。"""
    calls = []
    runner = _noop_runner()
    model_manager.ensure_text_ready(_settings(qed_api_select="api"), script_runner=runner, log=calls.append)
    model_manager.ensure_image_ready(_settings(qed_api_select="api"), script_runner=runner, log=calls.append)
    assert calls == []


def test_local_text_stops_mineru_before_start(monkeypatch):
    """local 文字：LM Studio 未就绪 → guard=true 先停 mineru 再启动 text-model。"""
    settings = _settings(qed_api_select="local")
    commands = []
    runner = _noop_runner()

    def fake_probe(port, url_path=""):
        return False  # 均未就绪

    monkeypatch.setattr(model_manager, "_probe_http", fake_probe)
    model_manager.ensure_text_ready(settings, script_runner=runner, log=commands.append)
    assert commands == ["stop image-model/qed_mineru_service.py", "start text-model/qed_lmstudio_service.py"]


def test_local_text_without_guard_skips_stop(monkeypatch):
    """guard=false：启动文字模型前不自动停 mineru。"""
    settings = _settings(qed_api_select="local", qed_resource_guard=False)
    commands = []
    runner = _noop_runner()

    def fake_probe(port, url_path=""):
        return False

    monkeypatch.setattr(model_manager, "_probe_http", fake_probe)
    model_manager.ensure_text_ready(settings, script_runner=runner, log=commands.append)
    assert commands == ["start text-model/qed_lmstudio_service.py"]


def test_local_text_ready_skips_start(monkeypatch):
    """local 文字：LM Studio 已就绪 → 不重复启动。"""
    settings = _settings(qed_api_select="local")
    commands = []
    runner = _noop_runner()
    monkeypatch.setattr(model_manager, "_probe_http", lambda port, url_path="": True)
    model_manager.ensure_text_ready(settings, script_runner=runner, log=commands.append)
    assert commands == []
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_llm_model_manager.py -q`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**——`backend/qed_engine/services/llm/model_manager.py`：

```python
"""本地模型资源管理器：按 QED_API_SELECT 判定是否需要本地模型，启动前执行资源互斥。

互斥规则（QED_RESOURCE_GUARD=true）：启动/调用本地文字模型前，若 MinerU 运行中先停止；
启动/调用本地图像模型前，若 LM Studio 运行中先停止。批处理方向：文字批处理期间图像模型
保持停止，反之亦然——互斥在模型服务启动时自动完成。
api 模式（默认）不启动任何本地模型，本模块直接放行。

设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
关联测试：tests/test_llm_model_manager.py
"""

import socket
import subprocess
import sys
import urllib.request
from pathlib import Path

from qed_engine.config import Settings

ROOT = Path(__file__).resolve().parents[4]  # services/llm/ → 仓库根
TEXT_SCRIPT = ROOT / "scripts" / "text-model" / "qed_lmstudio_service.py"
IMAGE_SCRIPT = ROOT / "scripts" / "image-model" / "qed_mineru_service.py"


def _probe_http(url: str) -> bool:
    """HTTP 健康探测：200 即就绪；异常 False。"""
    try:
        with urllib.request.urlopen(url, timeout=1.0) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _lmstudio_ready(settings: Settings) -> bool:
    return _probe_http(settings.qed_lmstudio_url.rstrip("/") + "/models")


def _mineru_ready(settings: Settings) -> bool:
    return _probe_http(settings.qed_mineru_url.rstrip("/") + "/api/v1/health")


def _run_script(script: Path, command: str, script_runner=None) -> int:
    """执行本地模型生命周期脚本（start/stop）；script_runner 可注入（测试）。"""
    runner = script_runner or subprocess.run
    try:
        result = runner(
            [sys.executable, str(script), command],
            capture_output=True,
            text=True,
            timeout=600,
        )
        return result.returncode if hasattr(result, "returncode") else 0
    except (OSError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        return 1


def ensure_text_ready(settings: Settings, script_runner=None, log: list | None = None) -> None:
    """确保本地文字模型就绪（local 模式）：未就绪时先停 MinerU（guard）再启动 LM Studio。

    api 模式直接放行；失败仅记录（log 追加描述），不抛异常——调用链继续走 API 或报调用错误。
    """
    log = log if log is not None else []
    if settings.qed_api_select != "local":
        return
    if _lmstudio_ready(settings):
        return
    if settings.qed_resource_guard:
        log.append("stop image-model/qed_mineru_service.py")
        _run_script(IMAGE_SCRIPT, "stop", script_runner)
    log.append("start text-model/qed_lmstudio_service.py")
    _run_script(TEXT_SCRIPT, "start", script_runner)


def ensure_image_ready(settings: Settings, script_runner=None, log: list | None = None) -> None:
    """确保本地图像模型（MinerU）就绪（local 模式）：未就绪时先停 LM Studio（guard）再启动。

    api 模式直接放行。
    """
    log = log if log is not None else []
    if settings.qed_api_select != "local":
        return
    if _mineru_ready(settings):
        return
    if settings.qed_resource_guard:
        log.append("stop text-model/qed_lmstudio_service.py")
        _run_script(TEXT_SCRIPT, "stop", script_runner)
    log.append("start image-model/qed_mineru_service.py")
    _run_script(IMAGE_SCRIPT, "start", script_runner)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python -m pytest tests/test_llm_model_manager.py -q`
Expected: PASS

### Task 9: services/llm/gateway.py（路由 + 记录）

**Files:**
- Create: `backend/qed_engine/services/llm/gateway.py`
- Test: `tests/test_llm_gateway.py`

- [ ] **Step 1: 写失败测试**——`tests/test_llm_gateway.py`：

```python
"""
模块职责：LLM 网关（gateway）契约测试：api/local 路由、调用记录字段、失败记录。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：backend/qed_engine/services/llm/gateway.py
"""

import pytest
from qed_engine.config import Settings
from qed_engine.services.llm import gateway


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_call_text_api_mode(monkeypatch):
    """api 模式：文字走 qwen_text_chat（dashscope），记录 api/qwen。"""
    captured = {}

    def fake_chat(api_key, model, messages, **kw):
        captured["api_key"] = api_key
        captured["model"] = model
        return "API 回答"

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 1

    monkeypatch.setattr(gateway.clients, "qwen_text_chat", fake_chat)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_text(
        _settings(qed_api_select="api", api_key="sk-x"),
        prompt="你好", prompt_template="t1",
    )
    assert result["reply"] == "API 回答"
    assert result["call_id"] == 1
    assert captured["record"]["mode"] == "api"
    assert captured["record"]["provider"] == "qwen"
    assert captured["record"]["endpoint"] == "text"


def test_call_text_local_mode(monkeypatch):
    """local 模式：先 ensure_text_ready 再走 LM Studio；记录 local/lmstudio。"""
    captured = {}

    def fake_ensure(settings, script_runner=None, log=None):
        captured["ensure"] = True

    def fake_lmstudio(base_url, messages, **kw):
        return "本地回答"

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return 2

    monkeypatch.setattr(gateway.model_manager, "ensure_text_ready", fake_ensure)
    monkeypatch.setattr(gateway.clients, "lmstudio_chat", fake_lmstudio)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_text(_settings(qed_api_select="local"), prompt="hi")
    assert result["reply"] == "本地回答"
    assert captured["ensure"] is True
    assert captured["record"]["mode"] == "local"
    assert captured["record"]["provider"] == "lmstudio"


def test_call_text_failure_recorded(monkeypatch):
    """调用失败：仍记录 status=error + error 原因，返回 reply=""。"""
    captured = {}

    def fake_chat(api_key, model, messages, **kw):
        raise RuntimeError("HTTP 429")

    def fake_record(settings, **kwargs):
        captured["record"] = kwargs
        return None

    monkeypatch.setattr(gateway.clients, "qwen_text_chat", fake_chat)
    monkeypatch.setattr(gateway.call_log, "record_call", fake_record)
    result = gateway.call_text(_settings(qed_api_select="api", api_key="sk-x"), prompt="p")
    assert result["reply"] == ""
    assert result["success"] is False
    assert captured["record"]["status"] == "error"
    assert "HTTP 429" in captured["record"]["error"]
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_llm_gateway.py -q`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**——`backend/qed_engine/services/llm/gateway.py`：

```python
"""LLM 网关：统一文字/视觉调用入口，按 QED_API_SELECT 路由 api/local，落 qed_llm_calls。

- api 模式：文字 qwen（dashscope）、视觉 qwen-vl（dashscope）。
- local 模式：文字 LM Studio（经 model_manager 资源互斥）、视觉 MinerU（同上）。
调用成功/失败均记录（record_call 降级不抛）；失败返回 reply="" + success=false + error。

设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
关联测试：tests/test_llm_gateway.py
"""

import time

from qed_engine.config import Settings
from qed_engine.services.llm import call_log, clients, model_manager


def _duration_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def call_text(
    settings: Settings,
    *,
    prompt: str,
    system: str | None = None,
    prompt_template: str | None = None,
    max_tokens: int | None = None,
    service: str = "qed_engine",
) -> dict:
    """文字模型调用：api → qwen；local → LM Studio（资源互斥）。返回 {reply, call_id, success, error}。"""
    started = time.monotonic()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    mode = settings.qed_api_select
    try:
        if mode == "local":
            model_manager.ensure_text_ready(settings)
            reply = clients.lmstudio_chat(
                base_url=settings.qed_lmstudio_url,
                messages=messages,
                timeout=max_tokens and 0 or None,  # 占位保持签名兼容，实际超时走默认
            )
            provider, model = "lmstudio", "local"
        else:
            reply = clients.qwen_text_chat(
                api_key=settings.resolved_api_key(),
                model=settings.qed_model,
                messages=messages,
            )
            provider, model = "qwen", settings.qed_model
        call_id = call_log.record_call(
            settings, service=service, mode=mode, provider=provider, model=model,
            endpoint="text", prompt=prompt, response=reply,
            duration_ms=_duration_ms(started), status="success", prompt_template=prompt_template,
        )
        return {"reply": reply, "call_id": call_id, "success": True, "error": ""}
    except Exception as exc:
        error = str(exc)
        call_log.record_call(
            settings, service=service, mode=mode, provider="gateway", model="",
            endpoint="text", prompt=prompt, response="", duration_ms=_duration_ms(started),
            status="error", error=error[:500], prompt_template=prompt_template,
        )
        return {"reply": "", "call_id": None, "success": False, "error": error}


def call_vision(
    settings: Settings,
    *,
    image_base64: str | None = None,
    pdf_bytes: bytes | None = None,
    pdf_filename: str = "input.pdf",
    prompt: str = "识别并输出图片内容",
    prompt_template: str | None = None,
    service: str = "qed_engine",
) -> dict:
    """视觉模型调用：api → qwen-vl（图片 base64）；local → MinerU（PDF 解析）。

    local 模式仅支持 PDF（MinerU 语义）；传图片 base64 时返回明确错误。
    返回 {reply, call_id, success, error}。
    """
    started = time.monotonic()
    mode = settings.qed_api_select
    try:
        if mode == "local":
            if not pdf_bytes:
                raise RuntimeError("local 模式图像模型为 MinerU（PDF 解析），请提供 PDF（pdf_bytes）")
            model_manager.ensure_image_ready(settings)
            reply = clients.mineru_parse(
                base_url=settings.qed_mineru_url,
                file_bytes=pdf_bytes,
                filename=pdf_filename,
            )
            provider, model = "mineru", "mineru"
        else:
            if not image_base64:
                raise RuntimeError("api 模式视觉调用需提供 image_base64")
            reply = clients.qwen_vision_chat(
                api_key=settings.resolved_api_key(),
                model=settings.qed_ocr_model,
                image_base64=image_base64,
                prompt=prompt,
            )
            provider, model = "qwen", settings.qed_ocr_model
        call_id = call_log.record_call(
            settings, service=service, mode=mode, provider=provider, model=model,
            endpoint="vision", prompt=prompt, response=reply,
            duration_ms=_duration_ms(started), status="success", prompt_template=prompt_template,
        )
        return {"reply": reply, "call_id": call_id, "success": True, "error": ""}
    except Exception as exc:
        error = str(exc)
        call_log.record_call(
            settings, service=service, mode=mode, provider="gateway", model="",
            endpoint="vision", prompt=prompt, response="", duration_ms=_duration_ms(started),
            status="error", error=error[:500], prompt_template=prompt_template,
        )
        return {"reply": "", "call_id": None, "success": False, "error": error}
```

（注意：`lmstudio_chat` 的 `timeout=max_tokens and 0 or None` 一行不合理——改为不传 timeout，
直接 `clients.lmstudio_chat(base_url=..., messages=messages)`；`max_tokens` 保留为接口预留字段。）

- [ ] **Step 4: 跑测试确认通过**

Run: `python -m pytest tests/test_llm_gateway.py -q`
Expected: PASS

### Task 10: 端点接线（/llm/*、/llm/test/*、/llm/calls、/database/test）+ schemas + 启动建表

**Files:**
- Modify: `backend/qed_engine/api/control.py`
- Modify: `backend/qed_engine/api/schemas.py`
- Modify: `backend/qed_engine/api/main.py`（启动时幂等建表，降级日志）
- Test: `tests/test_llm_endpoints.py`（新建）

- [ ] **Step 1: 写失败测试**——`tests/test_llm_endpoints.py`：

```python
"""
模块职责：LLM 网关端点契约测试：/llm/text、/llm/vision、/llm/test/*、/llm/calls、/database/test。
设计关联（DesignRef）：docs/design/llm-gateway-and-model-management.md
实现状态：In Progress
被测代码：backend/qed_engine/api/control.py
"""

from fastapi.testclient import TestClient
from qed_engine.api.main import create_app


def _client(monkeypatch):
    return TestClient(create_app())


def test_llm_text_endpoint(monkeypatch):
    """POST /llm/text：返回 reply/call_id/success；网关调用被真实接线。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control, "gateway_call_text",
        lambda settings, **kw: {"reply": "你好！", "call_id": 7, "success": True, "error": ""},
    )
    client = _client(monkeypatch)
    response = client.post("/api/v1/llm/text", json={"prompt": "你好", "prompt_template": "greeting"})
    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "你好！" and body["call_id"] == 7 and body["success"] is True


def test_llm_vision_endpoint_requires_input(monkeypatch):
    """POST /llm/vision：无任何输入 → 422（校验错误）。"""
    client = _client(monkeypatch)
    response = client.post("/api/v1/llm/vision", json={})
    assert response.status_code == 422


def test_llm_calls_endpoint(monkeypatch):
    """GET /llm/calls：检索结果透传。"""
    from qed_engine.api import control

    monkeypatch.setattr(
        control, "gateway_search_calls",
        lambda settings, **kw: {"items": [], "total": 0, "page": 1, "size": 20},
    )
    client = _client(monkeypatch)
    response = client.get("/api/v1/llm/calls?service=qed_tracker&page=1&size=20")
    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_database_test_endpoint(monkeypatch):
    """POST /database/test：即时连接探测（成功/失败均 200）。"""
    from qed_engine.api import control

    monkeypatch.setattr(control, "_probe_mysql", lambda settings: (True, ""))
    client = _client(monkeypatch)
    response = client.post("/api/v1/database/test")
    assert response.status_code == 200
    body = response.json()
    assert body["reachable"] is True and body["reason"] == ""
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_llm_endpoints.py -q`
Expected: FAIL（端点 404）

- [ ] **Step 3: schemas.py 追加**：

```python
class LlmTextRequest(BaseModel):
    prompt: str
    system: str | None = None
    prompt_template: str | None = None
    max_tokens: int | None = None


class LlmVisionRequest(BaseModel):
    image_base64: str | None = None
    pdf_base64: str | None = None
    pdf_filename: str = "input.pdf"
    prompt: str = "识别并输出图片内容"
    prompt_template: str | None = None


class LlmCallResponse(BaseModel):
    reply: str
    call_id: int | None = None
    success: bool
    error: str = ""


class LlmTestResponse(BaseModel):
    ok: bool
    detail: str = ""
    call_id: int | None = None


class CallLogItem(BaseModel):
    id: int
    service: str
    mode: str
    provider: str
    model: str
    endpoint: str
    prompt_template: str | None = None
    prompt: str
    response: str
    duration_ms: int | None = None
    status: str
    error: str | None = None
    created_at: str


class CallsResponse(BaseModel):
    items: list[CallLogItem]
    total: int
    page: int
    size: int
```

- [ ] **Step 4: control.py 接线**——文件头导入补：

```python
import base64
from qed_engine.services.llm import call_log as llm_call_log
from qed_engine.services.llm import gateway as llm_gateway
from qed_engine.api.schemas import (
    CallsResponse, CallLogItem, DatabaseResponse, GpuStatus, HealthResponse, KeysResponse,
    LlmCallResponse, LlmTestResponse, LlmTextRequest, LlmVisionRequest, LogsResponse,
    LmStudioStatus, MineruStatus, ModelRoute, ModelsResponse,
)
```

路由函数追加（`gateway_call_text` 等为模块级别名，便于测试 monkeypatch）：

```python
def gateway_call_text(settings, **kwargs):
    return llm_gateway.call_text(settings, **kwargs)


def gateway_call_vision(settings, **kwargs):
    return llm_gateway.call_vision(settings, **kwargs)


def gateway_search_calls(settings, **kwargs):
    return llm_call_log.search_calls(settings, **kwargs)


@router.post("/llm/text", response_model=LlmCallResponse)
def llm_text(request: Request, payload: LlmTextRequest) -> LlmCallResponse:
    """文字模型调用（api/local 路由由网关处理，调用记录落 qed_llm_calls）。"""
    resolved: Settings = request.app.state.settings
    return LlmCallResponse(**gateway_call_text(
        resolved, prompt=payload.prompt, system=payload.system,
        prompt_template=payload.prompt_template, max_tokens=payload.max_tokens,
    ))


@router.post("/llm/vision", response_model=LlmCallResponse)
def llm_vision(request: Request, payload: LlmVisionRequest) -> LlmCallResponse:
    """视觉模型调用：api 模式收 image_base64；local 模式收 pdf_base64（MinerU）。"""
    resolved: Settings = request.app.state.settings
    pdf_bytes = base64.b64decode(payload.pdf_base64) if payload.pdf_base64 else None
    return LlmCallResponse(**gateway_call_vision(
        resolved, image_base64=payload.image_base64, pdf_bytes=pdf_bytes,
        pdf_filename=payload.pdf_filename, prompt=payload.prompt,
        prompt_template=payload.prompt_template,
    ))


@router.post("/llm/test/text", response_model=LlmTestResponse)
def llm_test_text(request: Request) -> LlmTestResponse:
    """文字模型测试（控制台测试按钮）：小 prompt 真实调用，成功/失败 + 原因。"""
    resolved: Settings = request.app.state.settings
    result = gateway_call_text(resolved, prompt="请回复「OK」两个字。", prompt_template="test")
    return LlmTestResponse(ok=result["success"], detail=result["error"] or result["reply"][:200],
                           call_id=result["call_id"])


@router.post("/llm/test/vision", response_model=LlmTestResponse)
def llm_test_vision(request: Request) -> LlmTestResponse:
    """图像模型测试：api 模式用小图调 qwen-vl；local 模式做 MinerU 健康探测。"""
    resolved: Settings = request.app.state.settings
    if resolved.qed_api_select == "local":
        from qed_engine.services.monitor import probe_mineru
        status = probe_mineru()
        return LlmTestResponse(ok=status["reachable"], detail=status["reason"] or "MinerU 可达")
    # api 模式：1x1 像素透明 PNG
    tiny_png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    )
    import io
    result = gateway_call_vision(resolved, image_base64=base64.b64encode(tiny_png).decode(), prompt="识别图片")
    return LlmTestResponse(ok=result["success"], detail=result["error"] or result["reply"][:200],
                           call_id=result["call_id"])


@router.get("/llm/calls", response_model=CallsResponse)
def llm_calls(
    request: Request,
    service: str | None = None,
    mode: str | None = None,
    model: str | None = None,
    status: str | None = None,
    start: str | None = None,
    end: str | None = None,
    page: int = 1,
    size: int = 20,
) -> CallsResponse:
    """调用记录检索（qed_llm_calls，按 service/mode/model/status/时间过滤，倒序分页）。"""
    resolved: Settings = request.app.state.settings
    result = gateway_search_calls(
        resolved, service=service, mode=mode, model=model, status=status,
        start=start, end=end, page=page, size=size,
    )
    return CallsResponse(
        items=[CallLogItem(
            id=item["id"], service=item["service"], mode=item["mode"], provider=item["provider"],
            model=item["model"], endpoint=item["endpoint"], prompt_template=item.get("prompt_template"),
            prompt=item["prompt"], response=item["response"], duration_ms=item.get("duration_ms"),
            status=item["status"], error=item.get("error"),
            created_at=str(item["created_at"]),
        ) for item in result["items"]],
        total=result["total"], page=result["page"], size=result["size"],
    )


@router.post("/database/test", response_model=DatabaseResponse)
def database_test(request: Request) -> DatabaseResponse:
    """MySQL 即时连接探测（控制台测试按钮；/config/database 仍为启动快照）。"""
    resolved: Settings = request.app.state.settings
    reachable, reason = _probe_mysql(resolved)
    return DatabaseResponse(
        host=resolved.qed_db_host, port=resolved.qed_db_port, name=resolved.qed_db_name,
        user=resolved.qed_db_user, configured=resolved.qed_db_password.get_secret_value() != "",
        reachable=reachable, reason=reason,
    )
```

- [ ] **Step 5: main.py 启动建表**——`create_app` 内追加（`configure_services(resolved)` 之后）：

```python
    try:
        llm_call_log.ensure_table(resolved)
    except Exception as exc:  # 数据库不可达：降级日志，不阻塞启动
        logger.warning("qed_llm_calls 建表跳过（数据库不可达）：%s", type(exc).__name__)
```

- [ ] **Step 6: 跑测试确认通过**

Run: `python -m pytest tests/test_llm_endpoints.py tests/test_api.py tests/test_self_restart.py -q`
Expected: 全部 PASS

- [ ] **Step 7: 全量后端门禁**

Run: `python -m pytest tests -q; if ($?) { ruff check backend tests scripts }`
Expected: 全量 PASS + ruff 无错误

### P2 前端（根仓库，TDD）

### Task 11: api 层与类型（llm.ts + monitorGpu + stores 类型）

**Files:**
- Create: `web-ui/src/api/llm.ts`
- Modify: `web-ui/src/api/services.ts`（monitorGpu）
- Modify: `web-ui/src/stores/index.ts`（类型）

- [ ] **Step 1: 写类型**——`web-ui/src/stores/index.ts` 追加（先读该文件确认现有类型组织方式再插入）：

```ts
/** /monitor/gpu：GPU + 系统内存（sys_memory_*） */
export interface GpuStatus {
  available: boolean;
  name?: string;
  memory_total_mb?: number;
  memory_used_mb?: number;
  utilization_percent?: number;
  processes?: Array<{ pid: number; name: string; memory_mb: number }>;
  sys_memory_total_mb?: number;
  sys_memory_used_mb?: number;
  sys_memory_percent?: number;
  reason?: string;
}

/** /llm/test/* 测试结果 */
export interface LlmTestResult {
  ok: boolean;
  detail?: string;
  call_id?: number | null;
}

/** /llm/calls 单条记录 */
export interface LlmCallItem {
  id: number;
  service: string;
  mode: string;
  provider: string;
  model: string;
  endpoint: string;
  prompt_template?: string | null;
  prompt: string;
  response: string;
  duration_ms?: number | null;
  status: string;
  error?: string | null;
  created_at: string;
}

export interface CallsResponse {
  items: LlmCallItem[];
  total: number;
  page: number;
  size: number;
}

export interface LlmCallsQuery {
  service?: string;
  mode?: string;
  model?: string;
  status?: string;
  start?: string;
  end?: string;
  page?: number;
  size?: number;
}
```

- [ ] **Step 2: 实现 api 层**——`web-ui/src/api/services.ts` 追加：

```ts
/** GET /api/v1/monitor/gpu：GPU + 系统内存总览（控制台总览条） */
export async function monitorGpu(opts?: ApiRequestOptions): Promise<GpuStatus> {
  return api.get<GpuStatus>('/monitor/gpu', opts);
}
```

新建 `web-ui/src/api/llm.ts`：

```ts
/**
 * LLM 网关端点封装（8900）
 * 契约来源：backend/qed_engine/api/control.py（llm-gateway-and-model-management）
 */
import { api, type ApiRequestOptions } from './client';
import type { CallsResponse, LlmCallsQuery, LlmTestResult } from '../stores';

/** POST /api/v1/llm/test/text：文字模型测试（控制台测试按钮） */
export async function llmTestText(opts?: ApiRequestOptions): Promise<LlmTestResult> {
  return api.post<LlmTestResult>('/llm/test/text', undefined, opts);
}

/** POST /api/v1/llm/test/vision：图像模型测试（控制台测试按钮） */
export async function llmTestVision(opts?: ApiRequestOptions): Promise<LlmTestResult> {
  return api.post<LlmTestResult>('/llm/test/vision', undefined, opts);
}

/** POST /api/v1/database/test：MySQL 即时连接探测（控制台测试按钮） */
export async function databaseTest(opts?: ApiRequestOptions): Promise<{
  reachable: boolean; reason?: string;
}> {
  return api.post('/database/test', undefined, opts);
}

/** GET /api/v1/llm/calls：调用记录检索（分页+过滤） */
export async function llmCalls(query: LlmCallsQuery, opts?: ApiRequestOptions): Promise<CallsResponse> {
  const params = new URLSearchParams();
  (Object.entries(query) as Array<[string, string | number | undefined]>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return api.get<CallsResponse>(`/llm/calls${qs ? `?${qs}` : ''}`, opts);
}
```

（先读 `web-ui/src/api/client.ts` 确认 `api.get/post` 签名与 `ApiRequestOptions` 导出，若 `post`
第三参为 body 则 `undefined` 传法按实际签名调整。）

- [ ] **Step 3: 验证**

Run: `npx tsc -b`
Expected: 无类型错误

### Task 12: 控制台 store 扩展（gpu + 依赖卡测试动作）

**Files:**
- Modify: `web-ui/src/stores/console.ts`

- [ ] **Step 1: 扩展接口与实现**——`console.ts` 追加（保持既有字段不动）：

```ts
import { databaseTest, llmTestText, llmTestVision, monitorGpu } from '../api/services'; // 或 llm.ts 按 Task 11 归属
import type { DatabaseStatus, GpuStatus, ServiceStatus } from './index';

export interface LlmTestOutcome {
  ok: boolean;
  detail: string;
}

export interface ConsoleStore {
  // ...既有字段...
  gpu: GpuStatus | null;
  gpuError: string | null;
  /** 测试按钮执行中标记（'db' | 'text' | 'vision' | null） */
  testing: 'db' | 'text' | 'vision' | null;
  testDatabase: () => Promise<LlmTestOutcome>;
  testText: () => Promise<LlmTestOutcome>;
  testVision: () => Promise<LlmTestOutcome>;
}

export const GPU_TIMEOUT_MS = 8000;
export const TEST_TIMEOUT_MS = 15000;
```

`fetchAll` 内并行拉取 `monitorGpu`（失败仅置 gpuError，不拖累整体）；新增三个测试动作
（置 testing 标记 → 调端点 → 返回 outcome，失败 catch 为 {ok:false, detail}）。
实现代码在既有 store 工厂内追加（与 fetchAll 同风格 try/catch）。

- [ ] **Step 2: 跑既有测试确认无回归**

Run: `npx vitest run`
Expected: 全部 PASS（Console 页面测试可能因新字段需补 mock，见 Task 13）

### Task 13: Console.tsx——GPU 总览条 + 依赖组件三卡

**Files:**
- Modify: `web-ui/src/pages/Console.tsx`
- Test: `web-ui/src/pages/Console.test.tsx`

- [ ] **Step 1: 先写/更新失败测试**——`Console.test.tsx` 追加（先读现有测试的 mock 模式）：

```tsx
// 依赖：renderConsole 辅助（mock useConsoleStore 提供 gpu/testing/testXxx 等）
it('GPU 总览条在四服务卡之后渲染（显卡型号/显存/利用率/系统内存）', () => {
  // mock store：gpu = { available: true, name: 'RTX 4080', memory_total_mb: 16376,
  //   memory_used_mb: 4096, utilization_percent: 65, sys_memory_percent: 45 }
  // 断言：总览条包含 'RTX 4080'、'4096 / 16376'、'65%'、'45%'，且出现在服务卡区块之后
});

it('依赖组件三卡含 MySQL/文字模型/图像模型，测试按钮触发对应动作并展示结果', () => {
  // mock store：testDatabase → { ok: true, detail: '' }，testText/testVision 同理
  // 点击各卡「测试」按钮 → 断言提示/状态文案出现
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/pages/Console.test.tsx`
Expected: FAIL（新 UI 未实现）

- [ ] **Step 3: 实现**——`Console.tsx`：
  - 四服务卡 `Row` 之后插入 **GPU 总览条**（`/monitor/gpu`：显卡型号、显存 used/total、
    利用率、模型进程（名称+显存）、系统内存 percent；`available=false` 降级显示 reason）。
  - 「依赖组件」区改为**三张卡**：MySQL（qed 库）卡（dbStatus + 「测试」按钮 →
    `testDatabase()`，结果 message 反馈）；文字模型卡（`/monitor/lmstudio` 状态 + 「测试」按钮 →
    `testText()`）；图像模型卡（`/monitor/mineru` 状态 + 「测试」按钮 → `testVision()`）。
    默认置灰（探测中/离线显示「未验证」），测试后按结果点亮。
  - store 需再补 `lmstudio`/`mineru` 探测状态字段（fetchAll 并行拉 `/monitor/lmstudio`、
    `/monitor/mineru`），类型见 stores/index.ts（`LmStudioStatus`/`MineruStatus` 前端类型）。

（Console.test.tsx 既有用例的 store mock 需补新字段默认值，避免类型报错。）

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/pages/Console.test.tsx; if ($?) { npx tsc -b }`
Expected: PASS + 无类型错误

### Task 14: 模型调用记录检索页（/admin/llm-calls）

**Files:**
- Create: `web-ui/src/stores/llmCalls.ts`
- Create: `web-ui/src/stores/llmCalls.test.ts`
- Create: `web-ui/src/pages/LlmCalls.tsx`
- Create: `web-ui/src/pages/LlmCalls.test.tsx`
- Modify: `web-ui/src/App.tsx`（路由）
- Modify: `web-ui/src/components/AdminLayout.tsx`（菜单）

- [ ] **Step 1: 先写 store 失败测试**——`stores/llmCalls.test.ts`（仿 downloads.test.ts 模式）：

```ts
import { useLlmCallsStore } from './llmCalls';
import { llmCalls as apiLlmCalls } from '../api/llm';

vi.mock('../api/llm', () => ({ llmCalls: vi.fn() }));

describe('llmCalls store', () => {
  beforeEach(() => {
    useLlmCallsStore.setState({ items: [], total: 0, page: 1, size: 10, filters: {}, loading: false });
    vi.clearAllMocks();
  });

  it('fetch 携带过滤器并落 items/total', async () => {
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [{ id: 1, service: 'qed_engine', mode: 'api', provider: 'qwen', model: 'qwen-plus',
        endpoint: 'text', prompt: 'p', response: 'r', duration_ms: 100, status: 'success',
        created_at: '2026-08-20 10:00:00' }],
      total: 1, page: 1, size: 10,
    });
    useLlmCallsStore.getState().setFilters({ service: 'qed_engine' });
    await useLlmCallsStore.getState().fetch();
    const s = useLlmCallsStore.getState();
    expect(s.total).toBe(1);
    expect(s.items[0].service).toBe('qed_engine');
  });

  it('翻页：setPage 后 fetch 携带 page', async () => {
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [], total: 0, page: 2, size: 10,
    });
    useLlmCallsStore.getState().setPage(2);
    await useLlmCallsStore.getState().fetch();
    expect(apiLlmCalls).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/stores/llmCalls.test.ts`
Expected: FAIL（store 不存在）

- [ ] **Step 3: 实现 store**——`web-ui/src/stores/llmCalls.ts`：

```ts
/**
 * 模型调用记录检索 store（/admin/llm-calls）
 * 数据源：GET /api/v1/llm/calls（qed_llm_calls 表，分页+过滤）
 */
import { create } from 'zustand';
import { llmCalls as apiLlmCalls } from '../api/llm';
import type { LlmCallItem, LlmCallsQuery } from './index';

export const LLM_CALLS_PAGE_SIZE = 10;

export interface LlmCallsFilters {
  service?: string;
  mode?: string;
  model?: string;
  status?: string;
  start?: string;
  end?: string;
}

export interface LlmCallsStore {
  items: LlmCallItem[];
  total: number;
  page: number;
  size: number;
  filters: LlmCallsFilters;
  loading: boolean;
  error: string | null;
  setFilters: (filters: LlmCallsFilters) => void;
  setPage: (page: number) => void;
  fetch: () => Promise<void>;
}

export const useLlmCallsStore = create<LlmCallsStore>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  size: LLM_CALLS_PAGE_SIZE,
  filters: {},
  loading: false,
  error: null,

  setFilters: (filters) => set({ filters, page: 1 }),
  setPage: (page) => set({ page }),

  fetch: async () => {
    const { filters, page, size } = get();
    set({ loading: true });
    try {
      const query: LlmCallsQuery = { ...filters, page, size };
      const data = await apiLlmCalls(query);
      set({ items: data.items, total: data.total, page: data.page, size: data.size, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },
}));
```

- [ ] **Step 4: 跑 store 测试确认通过**

Run: `npx vitest run src/stores/llmCalls.test.ts`
Expected: PASS

- [ ] **Step 5: 实现页面**——`web-ui/src/pages/LlmCalls.tsx`（AntD Table + Select + Input +
  Pagination；列：ID/时间/service/mode/模型/耗时/状态/摘要（prompt、response 截断 80 字，
  展开详情显示全文）；筛选：service（qed_engine/qed_tracker/axiom_flow）、mode（api/local）、
  status（success/error）、model 关键字、start/end 日期（input type=date）；「查询」按钮触发
  fetch，「重置」清空）。同时写 `LlmCalls.test.tsx`（渲染筛选栏与表格、mock store）。

- [ ] **Step 6: 路由与菜单**——`App.tsx` 加 `<Route path="llm-calls" element={<LlmCalls />} />`；
  `AdminLayout.tsx` MENU_ITEMS 加 `{ key: '/admin/llm-calls', icon: <HistoryOutlined />, label: '模型调用记录' }`，
  selectedKey 分支补 `llm-calls`。

- [ ] **Step 7: 跑测试确认通过**

Run: `npx vitest run; if ($?) { npx tsc -b }; if ($?) { npx vite build }`
Expected: 全部 PASS + 无类型错误 + build 成功

### P3 子项目文档登记（根仓库只写文档）

### Task 15: QED-Tracker 文档登记（REQ-043）

**Files:**
- Create: `QED-Tracker/docs/design/model-mode-config.md`
- Modify: `QED-Tracker/docs/trackers/todo.md`

- [ ] **Step 1: 建设计文档**——`QED-Tracker/docs/design/model-mode-config.md`（按 QED-Tracker
  文档规范头部：设计状态/实现状态/最后更新/需求方/关联代码/关联测试），正文含：
  自身 `.env` 变量表（`QED_API_SELECT=local` 默认、`API_KEY`（`QWEN_API_KEY`/`DASHSCOPE_API_KEY`
  别名）、`QED_LLM_GATEWAY_URL`、`QED_MODEL`、`QED_DB_*`、`QED_TRACKER_PORT`）、
  `config.py` 改读自身 `.env`（根 `.env` 兜底）、`llm_client.py` 兼容层（direct/gateway）、
  `qed_tracker_service.py --mode local|qed-engine`（重启换模式，状态持久化 logs/）、
  local 模式调用记录写 qed_llm_calls（`service=qed_tracker`，表契约引用根仓库设计文档链接）。

- [ ] **Step 2: 登记 todo**——`QED-Tracker/docs/trackers/todo.md` 追加条目（ID 沿用其序号：
  `QED-0xx`，标题「模型模式与密钥分置（REQ-043）」），证据栏标注根仓库 REQ-043、设计文档
  model-mode-config.md、用户评审后执行。

- [ ] **Step 3: 验证**——重读两个文件确认格式与既有条目一致（无门禁测试运行）。

### Task 16: Axiom-Flow 文档登记（REQ-044）

**Files:**
- Create: `Axiom-Flow/docs/design/model-mode-config.md`
- Modify: `Axiom-Flow/docs/trackers/todo.md`

- [ ] **Step 1: 建设计文档**——`Axiom-Flow/docs/design/model-mode-config.md`（按 Axiom-Flow
  文档规范头部），正文含：`.env` 调整（`QED_API_SELECT=local` 默认、`API_KEY`（`AXIOM_API_KEY`
  别名）、`QED_LLM_GATEWAY_URL`、`QED_DB_*`）、`llm_client.py` 兼容层（direct qwen-vl /
  gateway `/llm/vision`，**MinerU 仅经网关可达**）、`axiom_flow_service.py --mode local|qed-engine`、
  **MinerU 编排移交**（`compose.yaml`/`infra-*.ps1`/`docker/Dockerfile` 已迁根仓库
  `scripts/image-model/`，本地 mineru 直连调用删除，过渡期双份存在可接受）、
  local 模式调用记录写 qed_llm_calls（`service=axiom_flow`）。

- [ ] **Step 2: 登记 todo**——`Axiom-Flow/docs/trackers/todo.md` 追加条目（ID 沿用其序号：
  `V2-0xx`，标题「模型模式与 MinerU 移交（REQ-044）」），证据栏标注根仓库 REQ-044、设计文档
  model-mode-config.md、用户评审后执行。

- [ ] **Step 3: 验证**——重读两个文件确认格式与既有条目一致。

### P4 全量验证

### Task 17: 门禁与真实冒烟

- [ ] **Step 1: 后端全量门禁**

Run: `python -m pytest tests -q`
Expected: 全量 PASS（含新增 test_llm_* 系列）

Run: `ruff check backend tests scripts`
Expected: 无错误

Run: `python -m pytest tests/contract -q`
Expected: 契约测试 PASS（文档结构/链接/标准治理；如新文档触发契约失败，按契约要求修正）

- [ ] **Step 2: 前端全量门禁**

Run: `npx vitest run; if ($?) { npx tsc -b }; if ($?) { npx vite build }`
Expected: 全部 PASS + build 成功

- [ ] **Step 3: 更新项目状态快照与文档**——`docs/trackers/../trackers/project-status.md`（本轮主线登记）、
  `docs/design/index.md`（如新文档未登记则补）、`docs/trackers/todo.md`（本轮主任务行登记，
  若按轮次惯例则建 ARCH-0xx 行）。

- [ ] **Step 4: 真实冒烟（人工，api 模式）**：
  1. 启动 8900（`python scripts/qed_engine_service.py start --wait 30`，默认 api 模式）；
  2. `curl -X POST http://127.0.0.1:8900/api/v1/llm/test/text` → ok=true；
  3. 查库 `SELECT * FROM qed_llm_calls ORDER BY id DESC LIMIT 1;` → 记录存在（service=qed_engine,
     mode=api, status=success）；
  4. 浏览器 8903 控制台：GPU 总览条显示、三卡测试按钮可用、调用记录页可检索；
  5. local 模式冒烟（可选，MinerU/LM Studio 就绪时）：重启 `--mode local` 后
     `/llm/test/text` ok=true；MinerU 场景待 REQ-044 回执后联调。
- [ ] **Step 5: 归档判定**——全部门禁 + 冒烟通过后按「归档判定」执行；REQ-043/044 关闭条件为
  子项目回执（不回执不关闭）。

---

## 验证与验收

1. `config.py`：`API_KEY` 统一 + 旧变量回退；`QED_API_SELECT`/`QED_LMSTUDIO_URL(5001)`/
   `QED_MINERU_URL`/`QED_RESOURCE_GUARD`/`QED_LLM_GATEWAY_URL` 生效（test_config.py 覆盖）。
2. 三个生命周期脚本（qed_engine_service / text-model / image-model）契约测试通过；
   MinerU 编排文件已迁入 `scripts/image-model/`。
3. `/monitor/gpu` 返回 sys_memory_*；`/llm/text`、`/llm/vision`、`/llm/test/*`、`/llm/calls`、
   `/database/test` 端点可用（test_llm_endpoints.py 覆盖）。
4. `qed_llm_calls` 表幂等建表、写入、检索（test_llm_call_log.py 覆盖）；启动降级不阻塞。
5. 前端：GPU 总览条、依赖组件三卡（置灰 + 测试按钮）、模型调用记录页（vitest 覆盖）。
6. REQ-043 / REQ-044 在对应子仓库完成文档登记（设计文档 + todo）。
7. 全量门禁（后端 pytest + ruff + 契约；前端 vitest + tsc + build）全绿。

## 回滚

- 新增端点/模块为向后兼容增量，回滚 = git 恢复 `backend/qed_engine/services/llm/`、
  `scripts/qed_engine_service.py`、`scripts/text-model/`、`scripts/image-model/`、
  `web-ui/src/pages/LlmCalls.*`、`web-ui/src/stores/llmCalls.*` 与对应测试；文档同步回滚。
- `qed_llm_calls` 表为新表，回滚不动既有表；DB 不可达时写入降级（记日志不抛），不影响其它功能。
- local 模式依赖本机 LM Studio / MinerU 就绪；未就绪时 `QED_API_SELECT=api` 默认直连供应商。

## 关闭与归档

- 归档判定见文档头；Task 17 门禁 + api 模式冒烟通过后，由用户在 todo 移除 ARCH-016 并归档至
  `history/plans/2026-08/`；REQ-043 / REQ-044 关闭条件为子项目回执（不回执不关闭），不随本轮归档。