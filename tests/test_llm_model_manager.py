"""
模块职责：本地模型资源管理（model_manager + runtimes）契约测试：api 模式不触碰本地、
单活仲裁（启动一方前停其他在跑槽位）、guard=false 跳过互斥、脚本型 runtime 复用、
LM Studio 半托管 probe/start/stop 语义。
设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
被测代码：backend/qed_engine/services/llm/model_manager.py、backend/qed_engine/services/llm/runtimes/
"""

import sys

import pytest
from qed_engine.config import Settings
from qed_engine.services.llm import model_manager, registry, runtimes
from qed_engine.services.llm.runtimes import base as rt_base
from qed_engine.services.llm.runtimes import lmstudio as lm_mod
from qed_engine.services.llm.runtimes.base import RuntimeResult

MODEL_27B = "qwen3.8-27b"
MODEL_MINERU = "mineru"


def _settings(**overrides) -> Settings:
    base = dict(qed_api_select="local", qed_local_runtime="lmstudio")
    base.update(overrides)
    return Settings(_env_file=None, **base)


@pytest.fixture(autouse=True)
def _isolate_manifest(tmp_path, monkeypatch):
    """隔离运行态 manifest：默认指向空临时目录。

    回归背景：真实 model/<槽位>/manifest.json 的 active 会被解析链回读（BUGFIX-003），
    导致断言依赖用户本机运行态；测试必须隔离到临时目录。
    """
    monkeypatch.setattr(registry, "MANIFEST_ROOT", tmp_path)
    return tmp_path


def _recorder_rt(monkeypatch, rt, probe: bool, name: str, calls: list):
    """给 runtime 实例打桩：probe 返回固定值，start/stop 记录调用。"""
    monkeypatch.setattr(rt, "probe", lambda settings, model="": probe)
    monkeypatch.setattr(
        rt, "start",
        lambda settings, model="", log=None, script_runner=None:
        calls.append(("start", name, model)) or RuntimeResult(True, "stub start"),
    )
    monkeypatch.setattr(
        rt, "stop",
        lambda settings, model="", log=None, script_runner=None:
        calls.append(("stop", name, model)) or RuntimeResult(True, "stub stop"),
    )


# ---------- api 模式放行 ----------


def test_api_mode_never_touches_local(monkeypatch):
    """api 模式：本地 runtime 完全不参与（不绑定、不探测、不启停）。"""
    def _boom(name):
        raise AssertionError(f"api 模式不应取 runtime：{name}")

    monkeypatch.setattr(model_manager, "get_runtime", _boom)
    logs: list[str] = []
    model_manager.ensure_local_ready(_settings(qed_api_select="api"), "text", log=logs.append)
    model_manager.ensure_local_ready(_settings(qed_api_select="api"), "vision", log=logs.append)
    assert logs == []


# ---------- 单活仲裁（默认 lmstudio runtime）----------


def test_local_text_ready_skips_start(monkeypatch):
    """local 文字：绑定模型已加载（probe True）→ 不停不启。"""
    calls: list = []
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), True, "lmstudio", calls)
    logs: list[str] = []
    model_manager.ensure_local_ready(_settings(), "text", log=logs.append)
    assert calls == []
    assert logs == []


def test_local_text_starts_and_stops_running_vision(monkeypatch):
    """local 文字：lmstudio 未加载目标 + mineru 在跑 → 先停 vision（全量释放）再 start text。"""
    calls: list = []
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), False, "lmstudio", calls)
    _recorder_rt(monkeypatch, runtimes.get_runtime("docker"), True, "docker", calls)
    logs: list[str] = []
    model_manager.ensure_local_ready(_settings(), "text", log=logs.append)
    assert calls == [
        ("stop", "docker", ""),  # 空模型 = 该 runtime 全量释放
        ("start", "lmstudio", MODEL_27B),
    ]
    assert "单活互斥" in logs[0]


def test_local_vision_starts_and_stops_running_text(monkeypatch):
    """local 图像：mineru 未就绪 + lmstudio 有模型在跑 → 先卸载 lmstudio 再 start docker。"""
    calls: list = []
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), True, "lmstudio", calls)
    _recorder_rt(monkeypatch, runtimes.get_runtime("docker"), False, "docker", calls)
    model_manager.ensure_local_ready(_settings(), "vision")
    assert calls == [
        ("stop", "lmstudio", ""),  # 全量卸载（含非绑定模型）
        ("start", "docker", MODEL_MINERU),
    ]


def test_local_without_guard_skips_stop_other(monkeypatch):
    """guard=false：不做单活仲裁，直接启动目标（v1 兼容语义）。"""
    calls: list = []
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), False, "lmstudio", calls)
    _recorder_rt(monkeypatch, runtimes.get_runtime("docker"), True, "docker", calls)
    model_manager.ensure_local_ready(_settings(qed_resource_guard=False), "text")
    assert calls == [("start", "lmstudio", MODEL_27B)]


def test_local_binding_missing_logs_and_skips(monkeypatch):
    """绑定缺失（如 llamacpp 无身份引用）→ 仅记日志，不触碰 runtime、不抛异常。"""
    def _boom(name):
        raise AssertionError(f"绑定缺失不应取 runtime：{name}")

    monkeypatch.setattr(model_manager, "get_runtime", _boom)
    logs: list[str] = []
    model_manager.ensure_local_ready(_settings(qed_local_runtime="llamacpp"), "text", log=logs.append)
    assert logs and "无可用本地模型" in logs[0]


# ---------- 脚本型 runtime（ScriptRuntime 直接单测）----------


def test_script_runtime_probe_start_stop(monkeypatch):
    """ScriptRuntime：probe 走健康端点；start/stop 经 script_runner 调脚本并记日志。
    （llamacpp/docker 均为此形态；llamacpp 目录暂无身份引用，经 ensure 路径不可达，
    行为由本单测锚定，未来身份目录加 llamacpp 引用即接通。）"""
    calls: list[str] = []
    rt = runtimes.get_runtime("docker")
    monkeypatch.setattr(rt_base, "probe_http", lambda url, *a, **k: ":5002/health" in url)
    assert rt.probe(_settings()) is True
    assert rt.probe(_settings(qed_ocr_model_url="http://127.0.0.1:9999")) is False

    def fake_runner(cmd, **_kw):
        calls.append(cmd[2])

        class R:
            returncode = 0

        return R()

    logs: list[str] = []
    result = rt.start(_settings(), MODEL_MINERU, log=logs.append, script_runner=fake_runner)
    assert result.ok is True
    assert calls == ["start"]
    assert logs == ["start image-model/qed_mineru_service.py"]
    result = rt.stop(_settings(), MODEL_MINERU, log=logs.append, script_runner=fake_runner)
    assert result.ok is True
    assert calls == ["start", "stop"]
    assert "stop image-model/qed_mineru_service.py" in logs


def test_script_runtime_start_failure_reports_rc(monkeypatch):
    """脚本 rc!=0 → RuntimeResult(False) 带原因（ensure 链不抛异常）。"""

    def failing_runner(cmd, **_kw):
        class R:
            returncode = 1

        return R()

    rt = runtimes.get_runtime("docker")
    result = rt.start(_settings(), MODEL_MINERU, script_runner=failing_runner)
    assert result.ok is False
    assert "失败" in result.detail


def test_vision_start_runs_docker_script(monkeypatch):
    """local 图像启动走 docker 脚本（经 ensure_local_ready，script_runner 注入）。"""
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), False, "lmstudio", [])
    monkeypatch.setattr(rt_base, "probe_http", lambda url, *a, **k: False)  # docker 未就绪
    commands: list[list[str]] = []

    def fake_runner(cmd, **_kw):
        commands.append(cmd)

        class R:
            returncode = 0

        return R()

    model_manager.ensure_local_ready(_settings(), "vision", script_runner=fake_runner)
    assert commands == [[sys.executable, str(model_manager.IMAGE_SCRIPT), "start"]]


# ---------- operate_model（槽位化 + 旧名别名）----------


def test_operate_model_start_text_via_alias(monkeypatch):
    """operate_model('qwen','start')：旧名别名到 text 槽位，走 ensure（互斥已含）。"""
    calls: list = []
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), False, "lmstudio", calls)
    model_manager.operate_model("qwen", "start", settings=_settings())
    assert calls == [("start", "lmstudio", MODEL_27B)]


def test_operate_model_stop_text_unloads_lmstudio(monkeypatch):
    """operate_model('text','stop')：半托管语义 = 卸载绑定模型（server 保留），api 模式也允许。"""
    calls: list = []
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), True, "lmstudio", calls)
    model_manager.operate_model("text", "stop", settings=_settings(qed_api_select="api"))
    assert calls == [("stop", "lmstudio", MODEL_27B)]


def test_operate_model_stop_vision_runs_script():
    """operate_model('vision','stop')：docker runtime 停止脚本。"""
    commands: list[list[str]] = []

    def fake_runner(cmd, **_kw):
        commands.append(cmd)

        class R:
            returncode = 0

        return R()

    model_manager.operate_model("mineru", "stop", settings=_settings(), script_runner=fake_runner)
    assert commands == [[sys.executable, str(model_manager.IMAGE_SCRIPT), "stop"]]


def test_operate_model_restart_vision_stops_then_starts(monkeypatch):
    """operate_model('vision','restart')：先停本槽位再走 ensure（互斥已含）。"""
    calls: list = []
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), False, "lmstudio", calls)
    _recorder_rt(monkeypatch, runtimes.get_runtime("docker"), False, "docker", calls)
    model_manager.operate_model("mineru", "restart", settings=_settings())
    assert calls == [("stop", "docker", MODEL_MINERU), ("start", "docker", MODEL_MINERU)]


def test_operate_model_unknown_name_raises():
    """未知槽位名 → ValueError（路由层 404）。"""
    with pytest.raises(ValueError, match="未知模型槽位"):
        model_manager.operate_model("unknown", "start", settings=_settings())


def test_operate_model_unknown_op_raises():
    """未知操作 → ValueError。"""
    with pytest.raises(ValueError, match="未知操作"):
        model_manager.operate_model("text", "explode", settings=_settings())


# ---------- LmStudioRuntime 单元（REST v0 语义）----------


def test_lmstudio_probe_states(monkeypatch):
    """probe：server 不可达 False；可达但目标未加载 False；已加载 True；不带模型仅查 server。"""
    monkeypatch.setattr(lm_mod, "_get_json", lambda url, timeout=2.0, token="": None)
    rt = lm_mod.LmStudioRuntime()
    assert rt.probe(_settings(), MODEL_27B) is False

    payload = {"data": [{"id": MODEL_27B}]}
    monkeypatch.setattr(lm_mod, "_get_json", lambda url, timeout=2.0, token="": payload)
    assert rt.probe(_settings(), MODEL_27B) is True
    assert rt.probe(_settings(), MODEL_27B.upper()) is True  # 大小写不敏感
    assert rt.probe(_settings(), "qwen/qwen3.5-9b") is False
    assert rt.probe(_settings()) is True  # 不带模型 = server 级在跑判定


def test_lmstudio_start_server_down_and_lms_missing(monkeypatch):
    """server 未起且 lms CLI 不在 PATH → 明确失败原因（不抛异常）。"""
    monkeypatch.setattr(lm_mod, "_get_json", lambda url, timeout=2.0, token="": None)
    monkeypatch.setattr(lm_mod, "_run_lms", lambda args, timeout=60.0: 127)
    result = lm_mod.LmStudioRuntime().start(_settings(), MODEL_27B)
    assert result.ok is False
    assert "lms" in result.detail


def test_lmstudio_start_unloads_others_then_loads(monkeypatch):
    """start 单活语义（W7 实测：REST v0 无 load/unload，经 lms CLI）：先卸载其他再加载目标。"""
    lms_calls: list[list[str]] = []
    monkeypatch.setattr(lm_mod, "_sleep", lambda _s: None)
    # _get_json 调用序列：① server 存活检查 ② 卸载清单 ③ 加载后轮询（目标已加载）
    payloads = [
        {"data": [{"id": "other-model", "state": "loaded"}]},
        {"data": [{"id": "other-model", "state": "loaded"}]},
        {"data": [{"id": MODEL_27B, "state": "loaded"}]},
    ]
    monkeypatch.setattr(
        lm_mod, "_get_json", lambda url, timeout=2.0, token="": payloads.pop(0)
    )
    monkeypatch.setattr(
        lm_mod, "_run_lms", lambda args, timeout=60.0: lms_calls.append(args) or 0,
    )
    result = lm_mod.LmStudioRuntime().start(_settings(), MODEL_27B)
    assert result.ok is True
    assert lms_calls == [
        ["unload", "other-model"],
        ["load", MODEL_27B, "--gpu", "max"],
    ]


def test_lmstudio_start_load_failure_reports_rc(monkeypatch):
    """lms load 失败（rc≠0）→ 失败并带模型标识（W7 实测回填锚点）。"""
    monkeypatch.setattr(lm_mod, "_sleep", lambda _s: None)
    monkeypatch.setattr(
        lm_mod, "_get_json", lambda url, timeout=2.0, token="": {"data": [{"id": MODEL_27B, "state": "not-loaded"}]}
    )
    monkeypatch.setattr(lm_mod, "_run_lms", lambda args, timeout=60.0: 1)
    result = lm_mod.LmStudioRuntime().start(_settings(), MODEL_27B)
    assert result.ok is False
    assert MODEL_27B in result.detail


def test_lmstudio_stop_unloads_target_or_all(monkeypatch):
    """stop：带模型卸载该模型；不带模型全量卸载（lms unload --all）；server 不可达视为无需卸载。"""
    lms_calls: list[list[str]] = []
    monkeypatch.setattr(
        lm_mod, "_run_lms", lambda args, timeout=60.0: lms_calls.append(args) or 0,
    )
    payload = {"data": [{"id": MODEL_27B, "state": "loaded"}, {"id": "other-model", "state": "loaded"}]}
    monkeypatch.setattr(lm_mod, "_get_json", lambda url, timeout=2.0, token="": payload)
    rt = lm_mod.LmStudioRuntime()
    rt.stop(_settings(), MODEL_27B)
    assert lms_calls == [["unload", MODEL_27B]]
    lms_calls.clear()
    rt.stop(_settings())
    assert lms_calls == [["unload", "--all"]]
    lms_calls.clear()
    monkeypatch.setattr(lm_mod, "_get_json", lambda url, timeout=2.0, token="": None)
    result = rt.stop(_settings())
    assert result.ok is True


# ---------- W7 实测锚定：REST v0 状态语义 + API 认证 ----------


def test_lmstudio_loaded_ids_uses_v0_state_filter(monkeypatch):
    """W7 实测：/api/v0/models 列出全量已下载模型（state 字段），仅 state=loaded 计入已加载。"""
    seen_urls: list[str] = []
    payload = {"data": [
        {"id": MODEL_27B, "state": "not-loaded"},
        {"id": "qwen/qwen3.5-9b", "state": "loaded"},
    ]}

    def fake_get(url, timeout=2.0, token=""):
        seen_urls.append(url)
        return payload

    monkeypatch.setattr(lm_mod, "_get_json", fake_get)
    assert lm_mod._loaded_ids(_settings()) == ["qwen/qwen3.5-9b"]
    base = _settings().qed_model_url.removesuffix("/v1")
    assert seen_urls == [f"{base}/api/v0/models"]
    # 无 state 字段（旧版本响应）退化为全量 id 列表（不误判全部未加载）
    monkeypatch.setattr(
        lm_mod, "_get_json", lambda url, timeout=2.0, token="": {"data": [{"id": "a"}]}
    )
    assert lm_mod._loaded_ids(_settings()) == ["a"]


def test_lmstudio_token_threaded_to_requests(monkeypatch):
    """LM Studio API 认证（W7 实测）：配置 token 时请求带 token，空 token 不带头。"""
    seen: list[str] = []
    monkeypatch.setattr(
        lm_mod, "_get_json",
        lambda url, timeout=2.0, token="": seen.append(token) or {"data": [{"id": MODEL_27B}]},
    )
    rt = lm_mod.LmStudioRuntime()
    assert rt.probe(_settings(qed_lmstudio_token="lm-secret"), MODEL_27B) is True
    assert seen == ["lm-secret"]
    seen.clear()
    assert rt.probe(_settings(), MODEL_27B) is True
    assert seen == [""]


# ---------- 契约锚定 ----------


def test_text_and_image_script_paths_exist():
    """DEFECT-003 回归扩展：生命周期脚本必须实际存在（runtime subprocess 调用前提）。"""
    assert model_manager.TEXT_SCRIPT.is_file(), f"TEXT_SCRIPT 缺失：{model_manager.TEXT_SCRIPT}"
    assert model_manager.IMAGE_SCRIPT.is_file(), f"IMAGE_SCRIPT 缺失：{model_manager.IMAGE_SCRIPT}"


def test_runtime_registry_covers_configured_runtimes():
    """runtime 注册表覆盖 QED_LOCAL_RUNTIME 全部合法取值；未知名报错。"""
    assert set(runtimes.RUNTIMES) == {"lmstudio", "llamacpp", "docker"}
    with pytest.raises(ValueError, match="未知本地 runtime"):
        runtimes.get_runtime("bogus")


def test_local_binding_precedence_matches_registry():
    """model_manager 消费的槽位绑定与注册表一致（单活仲裁数据源唯一）。"""
    settings = _settings()
    binding = registry.local_binding(settings, "text")
    assert binding is not None
    runtime_key, model, identity, _notes = binding
    assert (runtime_key, model, identity) == ("lmstudio", MODEL_27B, "qwen3.8-27b")
