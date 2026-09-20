"""模块职责：模型身份注册表测试——身份目录、槽位解析（api/local）、运行态 manifest.active 覆盖、回退与错误路径。

设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
被测代码：backend/qed_engine/services/llm/registry.py
"""

import json

from qed_engine.config import Settings
from qed_engine.services.llm import registry


def _settings(**kw) -> Settings:
    """测试专用 Settings：隔离 .env，显式传参（init kwargs 优先于环境变量）。"""
    base = dict(
        qed_api_select="api",
        qed_model="",
        qed_ocr_model="",
        qed_embedding_model="",
        qed_local_runtime="lmstudio",
        qed_model_url="http://127.0.0.1:5001/v1",
        qed_ocr_model_url="http://127.0.0.1:5002",
    )
    base.update(kw)
    return Settings(_env_file=None, **base)


def _write_manifest(tmp_path, slot_dir: str, payload: dict) -> None:
    """向临时 manifest 根写入 model/<槽位目录>/manifest.json。"""
    dir_path = tmp_path / slot_dir
    dir_path.mkdir(parents=True)
    (dir_path / "manifest.json").write_text(json.dumps(payload), encoding="utf-8")


# ---------- 身份目录 ----------


def test_identity_catalog_covers_all_slots():
    """身份目录覆盖三槽位；向量槽位无本地候选；槽位默认身份均可解析。"""
    for slot, default in registry.SLOT_DEFAULTS.items():
        assert default in registry.IDENTITIES
        assert registry.IDENTITIES[default].slot == slot
    assert registry.slot_identities("text") and len(registry.slot_identities("text")) >= 3
    assert registry.slot_identities("vision")
    embedding_locals = [
        i for i in registry.slot_identities("embedding") if i.local
    ]
    assert embedding_locals == [], "embedding 槽位本地预留，不应有本地引用"


def test_slot_identities_carry_metadata():
    """身份条目含 api 引用或本地引用与一句话备注（控制台下拉/备注数据源）。"""
    qwen318 = registry.IDENTITIES["qwen3.8-27b"]
    assert qwen318.local == {"lmstudio": "qwen3.8-27b"}
    assert qwen318.api is None
    assert qwen318.description
    assert registry.IDENTITIES["qwen-plus"].api == ("qwen", "qwen-plus")


# ---------- manifest.active 运行态 ----------


def test_manifest_active_reads_active_field(tmp_path):
    """manifest.active 有值时返回；缺失目录/缺失文件返回空。"""
    _write_manifest(tmp_path, "qwen", {"active": "qwen3.5-9b"})
    assert registry.manifest_active("text", tmp_path) == "qwen3.5-9b"
    assert registry.manifest_active("text", tmp_path / "none") == ""
    assert registry.manifest_active("embedding", tmp_path) == ""  # 无 manifest 目录映射


def test_manifest_active_broken_json_returns_empty(tmp_path):
    """manifest.json 非法 JSON → 返回空（不抛异常）。"""
    dir_path = tmp_path / "qwen"
    dir_path.mkdir(parents=True)
    (dir_path / "manifest.json").write_text("{broken", encoding="utf-8")
    assert registry.manifest_active("text", tmp_path) == ""


# ---------- set_manifest_active（控制台 select 写运行态）----------


def test_set_manifest_active_writes_and_merges(tmp_path):
    """select 写 active 并保留 manifest 其他字段。"""
    _write_manifest(tmp_path, "qwen", {"model": "old", "active": "qwen-plus"})
    registry.set_manifest_active("text", "qwen3.5-9b", tmp_path)
    data = json.loads((tmp_path / "qwen" / "manifest.json").read_text(encoding="utf-8"))
    assert data == {"model": "old", "active": "qwen3.5-9b"}


def test_set_manifest_active_creates_file(tmp_path):
    """manifest 缺失时创建目录与文件。"""
    registry.set_manifest_active("vision", "mineru", tmp_path)
    data = json.loads((tmp_path / "mineru" / "manifest.json").read_text(encoding="utf-8"))
    assert data["active"] == "mineru"


def test_set_manifest_active_rejects_unknown(tmp_path):
    """未知身份/槽位不匹配/无 manifest 槽位 → ValueError（端点层 404）。"""
    import pytest

    with pytest.raises(ValueError, match="未知身份"):
        registry.set_manifest_active("text", "bogus", tmp_path)
    with pytest.raises(ValueError, match="无运行态 manifest"):
        registry.set_manifest_active("embedding", "text-embedding-v4", tmp_path)
    with pytest.raises(ValueError, match="未知身份"):
        registry.set_manifest_active("vision", "qwen3.5-9b", tmp_path)  # 身份属 text 槽位


# ---------- configured_identity 优先级 ----------


def test_configured_identity_manifest_beats_env(tmp_path):
    """优先级：manifest.active（运行态）> .env 身份变量。"""
    _write_manifest(tmp_path, "qwen", {"active": "qwen3.5-9b"})
    settings = _settings(qed_model="qwen3.8-27b")
    assert registry.configured_identity(settings, "text", tmp_path) == "qwen3.5-9b"


def test_configured_identity_env_beats_default(tmp_path):
    """无运行态时 .env 身份变量生效。"""
    settings = _settings(qed_model="qwen3.8-27b")
    assert registry.configured_identity(settings, "text", tmp_path) == "qwen3.8-27b"


def test_configured_identity_unknown_falls_back_to_default(tmp_path):
    """manifest.active / env 值为未知身份（如历史 deepseek-v4-flash-0731）→ 回退槽位默认。"""
    _write_manifest(tmp_path, "qwen", {"active": "not-a-known-identity"})
    settings = _settings(qed_model="deepseek-v4-flash-0731")
    assert registry.configured_identity(settings, "text", tmp_path) == "qwen-plus"


# ---------- resolve：api 渠道 ----------


def test_resolve_api_text_default(tmp_path):
    """api 模式默认：文字槽位 → qwen 厂商 qwen-plus，dashscope 端点。"""
    results = registry.resolve(_settings(), tmp_path)
    text = results["text"]
    assert (text.channel, text.identity, text.provider, text.model) == (
        "api", "qwen-plus", "qwen", "qwen-plus")
    assert text.base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert text.error == ""


def test_resolve_api_local_identity_falls_back_with_note(tmp_path):
    """api 来源选本地身份（qwen3.8-27b 无 api 引用）→ 回退厂商默认模型并告警；
    identity 同步回退到 api 身份 qwen-plus（控制台下拉选中值与 options 一致）。"""
    results = registry.resolve(_settings(qed_model="qwen3.8-27b"), tmp_path)
    text = results["text"]
    assert (text.identity, text.provider, text.model) == ("qwen-plus", "qwen", "qwen-plus")
    assert text.notes and "回退" in text.notes[0]


def test_resolve_api_provider_fallback_uses_global_provider(tmp_path):
    """身份无 api 引用且 QED_API_PROVIDER=deepseek → 回退 deepseek 默认模型与端点。"""
    results = registry.resolve(
        _settings(qed_model="qwen3.8-27b", qed_api_provider="deepseek"), tmp_path)
    text = results["text"]
    assert (text.provider, text.model) == ("deepseek", "deepseek-chat")
    assert text.base_url == "https://api.deepseek.com/v1"


def test_resolve_api_vision_and_embedding(tmp_path):
    """api 模式：图像槽位 → qwen-vl-plus；向量槽位 → text-embedding-v4。"""
    results = registry.resolve(_settings(), tmp_path)
    assert results["vision"].model == "qwen-vl-plus"
    assert results["vision"].channel == "api"
    assert results["embedding"].model == "text-embedding-v4"
    assert results["embedding"].channel == "api"


# ---------- resolve：local 渠道 ----------


def test_resolve_local_text_lmstudio(tmp_path):
    """local 模式 + lmstudio runtime + 运行态选 qwen3.8-27b → provider=lmstudio，
    模型标识为 LM Studio 实际模型 id（REST v0/JIT 加载键），端点为 QED_MODEL_URL。"""
    _write_manifest(tmp_path, "qwen", {"active": "qwen3.8-27b"})
    results = registry.resolve(_settings(qed_api_select="local"), tmp_path)
    text = results["text"]
    assert (text.channel, text.identity, text.provider) == ("local", "qwen3.8-27b", "lmstudio")
    assert text.model == "qwen3.8-27b"
    assert text.base_url == "http://127.0.0.1:5001/v1"
    assert text.error == ""


def test_resolve_local_text_env_identity_no_runtime_state(tmp_path):
    """local 模式无运行态：.env 身份 qwen3.5-9b 生效。"""
    results = registry.resolve(_settings(qed_api_select="local", qed_model="qwen3.5-9b"), tmp_path)
    text = results["text"]
    assert (text.identity, text.provider) == ("qwen3.5-9b", "lmstudio")
    assert text.model == "qwen/qwen3.5-9b"


def test_resolve_local_manifest_root_threaded_through(tmp_path):
    """BUGFIX-003 回归：resolve 注入的 manifest_root 必须贯穿到 _resolve_local/local_binding，
    运行态 active 优先于 .env 身份（W7 冒烟发现：原实现回读真实仓库 manifest 覆盖解析结果）。"""
    _write_manifest(tmp_path, "qwen", {"active": "qwen3.8-27b"})
    results = registry.resolve(_settings(qed_api_select="local", qed_model="qwen3.5-9b"), tmp_path)
    text = results["text"]
    assert (text.identity, text.model) == ("qwen3.8-27b", "qwen3.8-27b")


def test_resolve_local_llamacpp_runtime_error(tmp_path):
    """local 模式 + llamacpp runtime：身份目录暂无 llamacpp 引用 → 明确错误（不抛异常）。"""
    results = registry.resolve(
        _settings(qed_api_select="local", qed_local_runtime="llamacpp"), tmp_path)
    text = results["text"]
    assert text.error != ""
    assert "llamacpp" in text.error


def test_resolve_local_text_docker_runtime_error(tmp_path):
    """local 模式 + docker runtime：身份目录暂无文字 docker 引用 → 明确错误（不抛异常）。"""
    results = registry.resolve(
        _settings(qed_api_select="local", qed_local_runtime="docker"), tmp_path)
    text = results["text"]
    assert text.error != ""
    assert "docker" in text.error


def test_resolve_local_vision_mineru(tmp_path):
    """local 模式：图像槽位 → mineru（docker），端点 QED_OCR_MODEL_URL（5002）。"""
    results = registry.resolve(_settings(qed_api_select="local"), tmp_path)
    vision = results["vision"]
    assert (vision.channel, vision.identity, vision.provider) == ("local", "mineru", "mineru")
    assert vision.model == "mineru"
    assert vision.base_url == "http://127.0.0.1:5002"


def test_resolve_local_vision_api_identity_falls_back(tmp_path):
    """local 模式选 api 身份（qwen-vl-plus 无本地引用）→ 回退 mineru 并告警。"""
    results = registry.resolve(_settings(qed_api_select="local", qed_ocr_model="qwen-vl-plus"),
                               tmp_path)
    vision = results["vision"]
    assert vision.identity == "mineru"
    assert vision.notes and "回退" in vision.notes[0]


def test_resolve_local_vision_runtime_fixed_docker(tmp_path):
    """图像槽位默认固定 docker（MinerU），不受全局 QED_LOCAL_RUNTIME 影响（local 即走 MinerU）。"""
    for runtime in ("lmstudio", "llamacpp", "docker"):
        results = registry.resolve(
            _settings(qed_api_select="local", qed_local_runtime=runtime), tmp_path)
        vision = results["vision"]
        assert (vision.identity, vision.provider) == ("mineru", "mineru")
        assert vision.base_url == "http://127.0.0.1:5002"
        assert vision.error == ""


def test_resolve_embedding_stays_api_in_local_mode(tmp_path):
    """全局 local 时向量槽位仍走 api（无本地候选，来源固定 api，不报错）。"""
    results = registry.resolve(_settings(qed_api_select="local"), tmp_path)
    embedding = results["embedding"]
    assert embedding.channel == "api"
    assert embedding.error == ""
    assert embedding.model == "text-embedding-v4"


# ---------- v3：槽位级来源 / 渠道运行态 ----------


def test_configured_source_manifest_beats_env(tmp_path):
    """来源优先级：manifest.source（运行态）> 全局 QED_API_SELECT 默认。"""
    _write_manifest(tmp_path, "qwen", {"source": "local"})
    assert registry.configured_source(_settings(qed_api_select="api"), "text", tmp_path) == "local"
    assert registry.configured_source(_settings(qed_api_select="api"), "vision", tmp_path) == "api"


def test_configured_source_non_local_global_is_api(tmp_path):
    """全局非 local（api / qed-engine）→ 槽位默认 api。"""
    assert registry.configured_source(_settings(qed_api_select="qed-engine"), "text", tmp_path) == "api"


def test_configured_source_embedding_stays_api(tmp_path):
    """embedding 无本地候选：全局 local 也固定 api（否则解析必失败）。"""
    assert registry.configured_source(_settings(qed_api_select="local"), "embedding", tmp_path) == "api"


def test_slot_runtime_manifest_beats_default(tmp_path):
    """渠道优先级：manifest.runtime > 槽位默认（text 用全局；vision 固定 docker）。"""
    _write_manifest(tmp_path, "qwen", {"runtime": "docker"})
    empty = tmp_path / "empty"
    assert registry.slot_runtime(_settings(qed_local_runtime="lmstudio"), "text", tmp_path) == "docker"
    assert registry.slot_runtime(_settings(qed_local_runtime="llamacpp"), "text", empty) == "llamacpp"
    assert registry.slot_runtime(_settings(qed_local_runtime="llamacpp"), "vision", empty) == "docker"
    assert registry.slot_runtime(_settings(), "embedding", empty) == ""


def test_set_manifest_state_writes_and_merges(tmp_path):
    """select 写 source / runtime / active 并保留其他字段。"""
    _write_manifest(tmp_path, "qwen", {"serve": {"port": 5001}, "active": "qwen-plus"})
    registry.set_manifest_state("text", tmp_path, source="local", runtime="lmstudio",
                                active="qwen3.8-27b")
    data = json.loads((tmp_path / "qwen" / "manifest.json").read_text(encoding="utf-8"))
    assert data == {
        "serve": {"port": 5001},
        "active": "qwen3.8-27b",
        "source": "local",
        "runtime": "lmstudio",
    }


def test_set_manifest_state_default_runtime_clears(tmp_path):
    """runtime=default → 清空 manifest.runtime（回退全局默认）。"""
    _write_manifest(tmp_path, "qwen", {"runtime": "docker"})
    registry.set_manifest_state("text", tmp_path, runtime="default")
    data = json.loads((tmp_path / "qwen" / "manifest.json").read_text(encoding="utf-8"))
    assert "runtime" not in data


def test_set_manifest_state_rejects_invalid(tmp_path):
    """非法来源/渠道/身份/无 manifest 槽位 → ValueError（端点层 422/404）。"""
    import pytest

    with pytest.raises(ValueError, match="未知来源"):
        registry.set_manifest_state("text", tmp_path, source="bogus")
    with pytest.raises(ValueError, match="未知本地渠道"):
        registry.set_manifest_state("text", tmp_path, runtime="bogus")
    with pytest.raises(ValueError, match="未知身份"):
        registry.set_manifest_state("text", tmp_path, active="mineru")
    with pytest.raises(ValueError, match="无运行态 manifest"):
        registry.set_manifest_state("embedding", tmp_path, source="local")


def test_slot_source_options_local_pending_for_embedding():
    """来源选项：text/vision 本地可用；embedding 无本地候选 → 本地部署待上线。"""
    text = {o["value"]: o["status"] for o in registry.slot_source_options("text")}
    assert text == {"local": "available", "api": "available"}
    embedding = {o["value"]: o["status"] for o in registry.slot_source_options("embedding")}
    assert embedding == {"local": "pending", "api": "available"}


def test_slot_channel_options_derived_from_registry():
    """渠道选项：text → lmstudio 可用、docker/llamacpp 待上线；vision → docker 可用；embedding 空。"""
    text = {o["value"]: o["status"] for o in registry.slot_channel_options("text")}
    assert text["lmstudio"] == "available"
    assert text["docker"] == "pending" and text["llamacpp"] == "pending"
    assert text["default"] == "available"
    vision = {o["value"]: o["status"] for o in registry.slot_channel_options("vision")}
    assert vision["docker"] == "available" and vision["lmstudio"] == "pending"
    assert registry.slot_channel_options("embedding") == []


def test_slot_model_options_filtered_by_source_and_runtime():
    """模型下拉按来源 × 渠道过滤：api → api 身份；local → 该 runtime 本地身份。"""
    api_names = [i.name for i in registry.slot_model_options("text", "api")]
    assert api_names == ["qwen-plus"]
    local_names = [i.name for i in registry.slot_model_options("text", "local", "lmstudio")]
    assert set(local_names) == {"qwen3.8-27b", "qwen3.5-9b"}
    assert registry.slot_model_options("text", "local", "docker") == []
    assert [i.name for i in registry.slot_model_options("vision", "local", "docker")] == ["mineru"]
