"""
模块职责：本地模型资源管理（model_manager + runtimes）契约测试：api 模式不触碰本地、
单活仲裁（启动一方前停其他在跑槽位）、guard=false 跳过互斥、脚本型 runtime 复用、
LM Studio 半托管 probe/start/stop 语义。
设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
被测代码：backend/qed_engine/services/llm/model_manager.py、backend/qed_engine/services/llm/runtimes/
"""

import subprocess
import sys

import pytest
from qed_engine.config import Settings
from qed_engine.services.llm import model_manager, registry, runtimes
from qed_engine.services.llm.runtimes import base as rt_base
from qed_engine.services.llm.runtimes import llamacpp as lc_mod
from qed_engine.services.llm.runtimes import lmstudio as lm_mod
from qed_engine.services.llm.runtimes.base import RuntimeResult

# tests/conftest.py 的 autouse 桩把 subprocess.run 换成抛 FileNotFoundError 的假桩；
# 本模块的子进程用例需要真实执行，故在模块导入期（早于任何 fixture）留存原始函数。
_REAL_SUBPROCESS_RUN = subprocess.run

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
        lambda settings, model="", log=None, script_runner=None, params=None:
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
    """绑定缺失（如 docker 无 text 身份引用，ARCH-033 W3 后 llamacpp 已有）→ 仅记日志，不触碰 runtime、不抛异常。"""
    def _boom(name):
        raise AssertionError(f"绑定缺失不应取 runtime：{name}")

    monkeypatch.setattr(model_manager, "get_runtime", _boom)
    logs: list[str] = []
    # ARCH-033 W3 后 llamacpp 已有引用，绑定缺失样例改用 docker（text 仍无候选）
    model_manager.ensure_local_ready(_settings(qed_local_runtime="docker"), "text", log=logs.append)
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
        ["load", MODEL_27B, "--gpu", "max", "-y"],
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


# --- W12 operate_model 期望状态上报（ARCH-028 人工停止语义，用户裁决 2026-09-24） ---


def test_operate_model_notifies_supervisor_intent(monkeypatch):
    """start/restart 成功→running、stop 成功→stopped：经 note_desired_active 上报在跑期望。"""
    from qed_engine.services.llm import supervisor

    notes: list[tuple[str, str]] = []
    monkeypatch.setattr(supervisor, "note_desired_active",
                        lambda slot, desired: notes.append((slot, desired)))
    calls: list = []
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), True, "lmstudio", calls)
    model_manager.operate_model("text", "stop", settings=_settings())
    assert notes == [("text", "stopped")]
    model_manager.operate_model("text", "start", settings=_settings())
    assert notes == [("text", "stopped"), ("text", "running")]
    model_manager.operate_model("text", "restart", settings=_settings())
    assert notes == [("text", "stopped"), ("text", "running"), ("text", "running")]


def test_operate_model_failure_does_not_notify(monkeypatch):
    """操作抛错（如停止脚本失败）不上报期望，避免监督器误判人工意图。"""
    from qed_engine.services.llm import supervisor

    notes: list[tuple[str, str]] = []
    monkeypatch.setattr(supervisor, "note_desired_active",
                        lambda slot, desired: notes.append((slot, desired)))

    class Boom:
        def stop(self, *a, **k):
            raise RuntimeError("docker 不可达")

        def probe(self, *a, **k):
            return False

    monkeypatch.setattr(model_manager, "get_runtime", lambda name: Boom())
    with pytest.raises(RuntimeError):
        model_manager.operate_model("text", "stop", settings=_settings())
    assert notes == []


# ---------- 加载参数注入（ARCH-033 W2） ----------


def test_lmstudio_start_load_with_params(monkeypatch):
    """start(params=...)：lms load 带 -c <context> 与表内 gpu 值（裁决 R1/R5）。"""
    lms_calls: list[list[str]] = []
    monkeypatch.setattr(lm_mod, "_sleep", lambda _s: None)
    payloads = [
        {"data": [{"id": MODEL_27B, "state": "loaded"}]},  # _server_up
        {"data": []},                                      # 单活清单（无其他）
        {"data": [{"id": MODEL_27B, "state": "loaded"}]},  # 加载轮询
    ]
    monkeypatch.setattr(lm_mod, "_get_json", lambda url, timeout=2.0, token="": payloads.pop(0))
    monkeypatch.setattr(
        lm_mod, "_run_lms", lambda args, timeout=60.0: lms_calls.append(args) or 0,
    )
    result = lm_mod.LmStudioRuntime().start(
        _settings(), MODEL_27B, params={"context": 16384, "gpu": "max"})
    assert result.ok is True
    assert ["load", MODEL_27B, "--gpu", "max", "-c", "16384", "-y"] in lms_calls


def test_lmstudio_start_parallel_ttl_params(monkeypatch):
    """params 含 parallel/ttl 时映射为 --parallel/--ttl（缺省项不出现）。"""
    lms_calls: list[list[str]] = []
    monkeypatch.setattr(lm_mod, "_sleep", lambda _s: None)
    payloads = [
        {"data": [{"id": MODEL_27B, "state": "loaded"}]},
        {"data": []},
        {"data": [{"id": MODEL_27B, "state": "loaded"}]},
    ]
    monkeypatch.setattr(lm_mod, "_get_json", lambda url, timeout=2.0, token="": payloads.pop(0))
    monkeypatch.setattr(
        lm_mod, "_run_lms", lambda args, timeout=60.0: lms_calls.append(args) or 0,
    )
    lm_mod.LmStudioRuntime().start(
        _settings(), MODEL_27B,
        params={"context": 8192, "gpu": "0.8", "parallel": 2, "ttl": 600})
    assert ["load", MODEL_27B, "--gpu", "0.8", "-c", "8192", "--parallel", "2", "--ttl", "600", "-y"] in lms_calls


def test_ensure_local_ready_passes_binding_params(monkeypatch):
    """model_manager 把 registry.binding_params（身份表）注入 runtime.start。"""
    seen: list[dict] = []
    rt = lm_mod.LmStudioRuntime()
    monkeypatch.setattr(model_manager, "get_runtime", lambda _name: rt)
    monkeypatch.setattr(rt, "probe", lambda settings, model="": True)  # 已就绪路径不走 start
    monkeypatch.setattr(rt, "probe", lambda settings, model="": False)
    monkeypatch.setattr(
        rt, "start",
        lambda settings, model="", log=None, script_runner=None, params=None:
        seen.append({"model": model, "params": params})
        or RuntimeResult(True, "stub"),
    )
    model_manager.ensure_local_ready(_settings(qed_api_select="local"), "text")
    assert seen == [{"model": MODEL_27B, "params": {"context": 8192, "gpu": "max"}}]


# ---------- llamacpp 真做与端口互斥（ARCH-033 W3/W4） ----------


def _fake_script_runner(cmds: list, rc: int = 0):
    def runner(cmd, **_kw):
        class R:
            returncode = rc

        cmds.append(cmd)
        return R()

    return runner


def test_llamacpp_start_maps_params_to_script_flags(monkeypatch):
    """params → 脚本旗标：--gguf 引用与 ctx/ngl/fa 进 argv（经 run_script 的 extra_args）。"""
    monkeypatch.setattr(lc_mod, "_lmstudio_server_running", lambda settings: False)
    cmds: list = []
    rt = runtimes.get_runtime("llamacpp")
    result = rt.start(_settings(), "unsloth/q.gguf", log=lambda _m: None,
                      script_runner=_fake_script_runner(cmds),
                      params={"ctx": 16384, "ngl": -1, "fa": True})
    assert result.ok is True
    assert cmds[0][2:] == ["start", "--gguf", "unsloth/q.gguf",
                           "--ctx", "16384", "--ngl", "-1", "--fa"]


def test_llamacpp_start_stops_lmstudio_server_first(monkeypatch):
    """端口被常驻 LM Studio 占用：先 lms server stop 让位（裁决 R3）再走脚本启动。"""
    state = {"running": True}

    def _running(_settings):
        prev = state["running"]
        state["running"] = False
        return prev

    monkeypatch.setattr(lc_mod, "_lmstudio_server_running", _running)
    lms_calls: list = []
    monkeypatch.setattr(
        lm_mod, "_run_lms", lambda args, timeout=60.0: lms_calls.append(args) or 0)
    cmds: list = []
    rt = runtimes.get_runtime("llamacpp")
    result = rt.start(_settings(), "unsloth/q.gguf", log=lambda _m: None,
                      script_runner=_fake_script_runner(cmds), params={"ctx": 8192})
    assert result.ok is True
    # W7 真机修正：server stop 单独不足（LM Studio 自带 worker 残驻占显存），先 unload 全量
    assert lms_calls == [["unload", "--all"], ["server", "stop"]]
    assert cmds[0][2:] == ["start", "--gguf", "unsloth/q.gguf", "--ctx", "8192"]


def test_llamacpp_start_fails_when_lmstudio_refuses_to_yield(monkeypatch):
    """lms server stop 失败（rc≠0）：启动失败并给出明确中文原因，不动脚本。"""
    monkeypatch.setattr(lc_mod, "_lmstudio_server_running", lambda settings: True)
    monkeypatch.setattr(lm_mod, "_run_lms", lambda args, timeout=60.0: 1)
    cmds: list = []
    rt = runtimes.get_runtime("llamacpp")
    result = rt.start(_settings(), "unsloth/q.gguf", log=lambda _m: None,
                      script_runner=_fake_script_runner(cmds))
    assert result.ok is False
    assert "LM Studio" in result.detail
    assert cmds == []


def test_lmstudio_start_clears_llama_server_occupation(monkeypatch):
    """反向互斥（R3）：5001 响应 /v1/models 但非 LM Studio → 判定 llama-server 占位，
    先脚本 stop 清位再 lms server start。"""
    monkeypatch.setattr(lm_mod, "_sleep", lambda _s: None)
    payloads = [
        None,                                                       # _server_up：v0 无应答
        {"data": [{"id": MODEL_27B, "state": "loaded"}]},           # server start 后轮询
        {"data": [{"id": MODEL_27B, "state": "loaded"}]},           # 单活清单
        {"data": [{"id": MODEL_27B, "state": "loaded"}]},           # load 后轮询
    ]
    monkeypatch.setattr(
        lm_mod, "_get_json",
        lambda url, timeout=2.0, token="": payloads.pop(0) if payloads else None)
    monkeypatch.setattr(lm_mod, "probe_http", lambda url: True)
    lms_calls: list = []
    monkeypatch.setattr(
        lm_mod, "_run_lms",
        lambda args, timeout=60.0: lms_calls.append(args) or 0)
    cmds: list = []
    result = lm_mod.LmStudioRuntime().start(_settings(), MODEL_27B, log=lambda _m: None,
                                            script_runner=_fake_script_runner(cmds))
    assert result.ok is True
    assert "qed_qwen_service.py" in cmds[0][1] and cmds[0][2] == "stop"
    assert ["server", "start"] in lms_calls
    assert ["load", MODEL_27B, "--gpu", "max", "-y"] in lms_calls


# --- W7 operate_model 启动宽限上报（ARCH-028 增强批，壳监督器设计 §6） ---


def test_operate_model_start_dispatch_marks_grace(monkeypatch):
    """start/restart 派发即上报宽限窗口（防冷启动被防抖误判掉线）；stop 不报。"""
    from qed_engine.services.llm import supervisor

    marks: list[str] = []
    monkeypatch.setattr(supervisor, "note_starting_active", marks.append)
    calls: list = []
    _recorder_rt(monkeypatch, runtimes.get_runtime("lmstudio"), True, "lmstudio", calls)
    model_manager.operate_model("text", "stop", settings=_settings())
    assert marks == []
    model_manager.operate_model("text", "start", settings=_settings())
    assert marks == ["text"]
    model_manager.operate_model("vision", "restart", settings=_settings())
    assert marks == ["text", "vision"]


# --- DEFECT-005 监督器退避重启与单活仲裁竞态（进程级互斥串行化） ---


class _ConcurrentRt:
    """共享「在跑」事实源的假 runtime：记录关键段重叠与最终在跑集合。"""

    def __init__(self, name, world):
        self.name = name
        self.world = world

    def probe(self, settings, model=""):
        return self.name in self.world["running"]

    def start(self, settings, model="", log=None, script_runner=None, params=None):
        self._enter()
        self.world["running"].add(self.name)
        self._exit()
        return RuntimeResult(True, "stub")

    def stop(self, settings, model="", log=None, script_runner=None):
        self._enter()
        self.world["running"].discard(self.name)
        self._exit()
        return RuntimeResult(True, "stub")

    def _enter(self):
        self.world["active"] += 1
        if self.world["active"] > 1:
            self.world["overlaps"].append(self.name)
        import time as _t
        _t.sleep(0.02)  # 放大未串行化时的竞态窗口

    def _exit(self):
        self.world["active"] -= 1


def test_concurrent_ensure_serialized_never_two_running(monkeypatch):
    """双槽位并发 ensure（监督器退避重启实况）：启动关键段串行化，
    后启动者的单活仲裁必见先启动者在跑 → 最终在跑 ≤1，关键段零重叠。"""
    import threading

    world = {"running": set(), "active": 0, "overlaps": []}
    rts = {"lmstudio": _ConcurrentRt("lmstudio", world), "docker": _ConcurrentRt("docker", world)}
    monkeypatch.setattr(model_manager, "get_runtime", lambda name: rts[name])

    threads = [threading.Thread(target=model_manager.ensure_local_ready,
                                args=(_settings(), slot))
               for slot in ("text", "vision")]
    for t in threads:
        t.start()
    for t in threads:
        t.join(10)
    assert not any(t.is_alive() for t in threads), "串行化不得死锁"
    assert world["overlaps"] == [], "启动关键段（复核+仲裁+start）进程级互斥"
    assert len(world["running"]) <= 1, "DEFECT-005 回归：双槽位并发恢复不再绕过单活互斥"


# ---------- DEFECT-008 ①⑤：runtime 探针与子进程输出 ----------


def test_runtime_probe_bypasses_env_proxy(loopback_ok_server, honored_env_proxy):
    """① probe_http 不经环境代理：代理端口不可用时 127.0.0.1 健康端点仍判可达。"""
    assert rt_base.probe_http(loopback_ok_server + "/health") is True


def test_lmstudio_get_json_bypasses_env_proxy(loopback_ok_server, honored_env_proxy):
    """① LM Studio REST v0 读回不经环境代理（urllib 无 loopback 自动 bypass，长驻进程曾误判不可达）。"""
    payload = lm_mod._get_json(loopback_ok_server + "/api/v0/models", token="t")
    assert payload["data"][0]["state"] == "loaded"


def test_run_script_decodes_utf8_child_output(tmp_path, monkeypatch):
    """⑤ 生命周期脚本的 UTF-8 中文输出不得让 reader 线程解码崩溃（历史 config.log 同签名）。"""
    monkeypatch.setattr(rt_base.subprocess, "run", _REAL_SUBPROCESS_RUN)
    script = tmp_path / "cjk_service.py"
    script.write_text(
        "import sys\nsys.stdout.buffer.write('启动中：显存不足·UTF8'.encode('utf-8'))\n",
        encoding="utf-8",
    )
    assert rt_base.run_script(script, "start") == 0


def test_run_script_forces_utf8_child_decoding(tmp_path, monkeypatch):
    """⑤ run_script 显式 UTF-8 + errors=replace：真实子进程里 reader 线程曾抛 UnicodeDecodeError。"""
    seen = {}

    def fake_run(cmd, **kwargs):
        seen.update(kwargs)
        return subprocess.CompletedProcess(cmd, 0)

    monkeypatch.setattr(rt_base.subprocess, "run", fake_run)
    assert rt_base.run_script(tmp_path / "cjk_service.py", "start") == 0
    assert seen.get("encoding") == "utf-8", "子进程输出按本地编码（Windows GBK）解码即 DEFECT-008 ⑤"
    assert seen.get("errors") == "replace", "非法字节须替换而非抛错"


def test_run_lms_decodes_child_output_as_utf8(monkeypatch):
    """⑤ lms CLI 子进程显式按 UTF-8 解码（errors=replace），不跟随 Windows 本地编码。"""
    import subprocess

    seen = {}

    def fake_run(cmd, **kwargs):
        seen.update(kwargs)
        return subprocess.CompletedProcess(cmd, 0)

    monkeypatch.setattr(lm_mod.shutil, "which", lambda _name: "C:/lms")
    monkeypatch.setattr(lm_mod.subprocess, "run", fake_run)
    assert lm_mod._run_lms(["load", "qwen/qwen3.5-9b"]) == 0
    assert seen.get("encoding") == "utf-8"
    assert seen.get("errors") == "replace"


@pytest.fixture
def loopback_ok_server():
    """本机回环 HTTP 服务（任何 GET 返回 200 JSON），只监听 127.0.0.1 临时端口。"""
    import http.server
    import json
    import threading

    class _Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            body = json.dumps({"data": [{"id": "qwen/qwen3.5-9b", "state": "loaded"}]}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            return

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    server.server_close()


@pytest.fixture
def honored_env_proxy(monkeypatch):
    """实况复现：环境代理指向已关闭端口，且 urllib 默认 opener 按环境配置走代理。"""
    import socket
    import urllib.request

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        dead_port = probe.getsockname()[1]
    proxy = f"http://127.0.0.1:{dead_port}"
    monkeypatch.setenv("HTTP_PROXY", proxy)
    monkeypatch.setenv("HTTPS_PROXY", proxy)
    previous = urllib.request._opener
    urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler()))
    try:
        yield proxy
    finally:
        urllib.request.install_opener(previous)
