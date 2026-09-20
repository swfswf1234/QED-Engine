"""模型身份注册表：身份目录（身份 → api 引用 / 本地引用 / 备注）+ 槽位解析（PLAN-046 唯一事实源）。

2026-09-16（PLAN-046 v3）：模型身份不分 api/local（用户裁决）——.env 每槽位一个身份变量
（QED_MODEL / QED_OCR_MODEL / QED_EMBEDDING_MODEL），身份经本表解析为 api 引用（厂商+模型名）
或本地引用（runtime: 模型标识）；**来源（source）与本地渠道（runtime）为槽位级运行态**
（控制台 /models/{slot}/select 写入 model/<槽位>/manifest.json 的 source / runtime 字段），
全局 QED_API_SELECT / QED_LOCAL_RUNTIME 仅为槽位未选择时的默认值。解析入口 resolve(settings)：
gateway / model_manager / 端点层统一消费，不抛异常（槽位失败写 Resolved.error）。

解析优先级：来源 = manifest.source > QED_API_SELECT；渠道 = manifest.runtime > 槽位默认
（text = QED_LOCAL_RUNTIME，vision = docker）；身份 = manifest.active > .env 身份变量 > 槽位默认。

设计关联（DesignRef）：docs/design/llm-gateway.md
实现状态：Current
关联测试：tests/test_llm_registry.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from qed_engine.config import Settings
from qed_engine.services.llm import clients

# 仓库根（backend/qed_engine/services/llm/registry.py → parents[4]），与 model_manager 一致
ROOT = Path(__file__).resolve().parents[4]
# 运行态 manifest 根（model/<槽位目录>/manifest.json）；测试经参数注入临时目录
MANIFEST_ROOT = ROOT / "model"

SLOTS = ("text", "vision", "embedding")
LOCAL_RUNTIMES = ("lmstudio", "llamacpp", "docker")
SOURCES = ("api", "local")

# 渠道选项展示顺序（控制台下拉）：默认 / LM Studio / Docker / llama.cpp
CHANNEL_CHOICES = (
    ("lmstudio", "LM Studio"),
    ("docker", "Docker"),
    ("llamacpp", "llama.cpp"),
)
# 槽位 → 默认本地渠道（text 用 settings.qed_local_runtime；vision 固定 docker）
SLOT_FIXED_RUNTIME = {"vision": "docker"}

# 槽位 → manifest 目录名（沿用 v1 model/ 目录约定）
SLOT_MANIFEST_DIRS = {"text": "qwen", "vision": "mineru"}
# 槽位 → .env 身份变量（Settings 字段名）
SLOT_ENV_FIELDS = {
    "text": "qed_model",
    "vision": "qed_ocr_model",
    "embedding": "qed_embedding_model",
}


@dataclass(frozen=True)
class Identity:
    """模型身份：一个可被用户指名选择的模型（不分 api/local）。"""

    name: str
    slot: str
    description: str = ""  # 一句话备注（控制台「备注」行）
    api: tuple[str, str] | None = None  # api 引用（provider, model）
    local: dict[str, str] | None = None  # 本地引用（runtime → 模型标识）


# 身份目录（首版静态表；新增部署形态=补 local 引用，新增模型=补条目）
IDENTITIES: dict[str, Identity] = {
    i.name: i
    for i in (
        Identity("qwen-plus", "text", "通义千问 Plus，云端通用文本模型", api=("qwen", "qwen-plus")),
        Identity(
            "qwen3.8-27b",
            "text",
            "Qwen3.8 27B，本机 LM Studio 已下载",
            local={"lmstudio": "qwen3.8-27b"},
        ),
        Identity(
            "qwen3.5-9b",
            "text",
            "Qwen3.5 9B，轻量本地模型",
            local={"lmstudio": "qwen/qwen3.5-9b"},
        ),
        Identity(
            "qwen-vl-plus", "vision", "通义千问 VL Plus，云端视觉模型", api=("qwen", "qwen-vl-plus")
        ),
        Identity("mineru", "vision", "MinerU 文档解析模型，本机 Docker 已部署", local={"docker": "mineru"}),
        Identity(
            "text-embedding-v4",
            "embedding",
            "通义文本向量模型 v4",
            api=("qwen", "text-embedding-v4"),
        ),
    )
}

# 槽位默认身份（.env 未配置且无运行态时的兜底）
SLOT_DEFAULTS = {"text": "qwen-plus", "vision": "qwen-vl-plus", "embedding": "text-embedding-v4"}
# 身份缺本地引用时的槽位回退身份（解析时告警一次；api 缺引用回退 QED_API_PROVIDER 厂商默认）
SLOT_LOCAL_FALLBACKS = {"text": "qwen3.8-27b", "vision": "mineru"}


@dataclass
class Resolved:
    """槽位解析结果（call_log 与端点层统一消费；error 非空 = 该槽位不可用）。"""

    slot: str
    channel: str  # api | local
    identity: str  # 生效身份（回退后为实际生效者）
    provider: str  # api: 厂商；local: runtime（call_log.provider 取值）
    model: str  # api: 实际模型名；local: runtime 模型标识
    base_url: str = ""  # 调用端点
    error: str = ""  # 非空 = 解析失败原因（中文）
    notes: list[str] = field(default_factory=list)  # 回退/告警说明


# --- manifest 运行态（source / runtime / active）---


def _manifest_path(slot: str, manifest_root: Path | None = None) -> Path | None:
    dir_name = SLOT_MANIFEST_DIRS.get(slot)
    if not dir_name:
        return None
    return (manifest_root or MANIFEST_ROOT) / dir_name / "manifest.json"


def manifest_data(slot: str, manifest_root: Path | None = None) -> dict:
    """读 model/<槽位目录>/manifest.json；缺失/解析失败返回 {}（不抛异常）。"""
    path = _manifest_path(slot, manifest_root)
    if path is None or not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def manifest_active(slot: str, manifest_root: Path | None = None) -> str:
    """读 manifest.active；缺失/空/解析失败返回 ""。"""
    return str(manifest_data(slot, manifest_root).get("active", "") or "")


def manifest_source(slot: str, manifest_root: Path | None = None) -> str:
    """读 manifest.source（槽位来源运行态）；非法/缺失返回 ""。"""
    value = str(manifest_data(slot, manifest_root).get("source", "") or "")
    return value if value in SOURCES else ""


def manifest_runtime(slot: str, manifest_root: Path | None = None) -> str:
    """读 manifest.runtime（槽位本地渠道运行态）；非法/缺失返回 ""。"""
    value = str(manifest_data(slot, manifest_root).get("runtime", "") or "")
    return value if value in LOCAL_RUNTIMES else ""


def configured_identity(settings: Settings, slot: str, manifest_root: Path | None = None) -> str:
    """生效身份：manifest.active（运行态）> .env 身份变量 > 槽位默认；未知身份回退槽位默认。"""
    active = manifest_active(slot, manifest_root)
    if active in IDENTITIES and IDENTITIES[active].slot == slot:
        return active
    env_value = str(getattr(settings, SLOT_ENV_FIELDS[slot], "") or "")
    if env_value in IDENTITIES and IDENTITIES[env_value].slot == slot:
        return env_value
    return SLOT_DEFAULTS[slot]


def configured_source(settings: Settings, slot: str, manifest_root: Path | None = None) -> str:
    """生效来源：manifest.source（运行态）> 全局 QED_API_SELECT 默认（非 local 视为 api）。

    槽位无本地候选（embedding）时固定 api——全局默认 local 不适用该槽位（否则解析必失败）。
    """
    source = manifest_source(slot, manifest_root)
    if not source:
        source = "local" if settings.qed_api_select == "local" else "api"
    if source == "local" and slot not in SLOT_MANIFEST_DIRS:
        return "api"
    return source


def slot_runtime(settings: Settings, slot: str, manifest_root: Path | None = None) -> str:
    """生效本地渠道：manifest.runtime > 槽位默认（vision 固定 docker；text 用全局默认）。"""
    if slot not in SLOT_MANIFEST_DIRS:
        return ""
    runtime = manifest_runtime(slot, manifest_root)
    if runtime:
        return runtime
    return SLOT_FIXED_RUNTIME.get(slot) or settings.qed_local_runtime


def _write_manifest(slot: str, data: dict, manifest_root: Path | None = None) -> None:
    path = _manifest_path(slot, manifest_root)
    if path is None:
        raise ValueError(f"槽位 {slot} 无运行态 manifest（仅 text / vision 支持）")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def set_manifest_state(slot: str, manifest_root: Path | None = None, *,
                       source: str | None = None, runtime: str | None = None,
                       active: str | None = None) -> None:
    """写槽位运行态（控制台 /models/{slot}/select）：合并已有字段，非法取值抛 ValueError。

    - source：`api` | `local`；runtime：`lmstudio` | `llamacpp` | `docker` | `default`
      （`default` = 清空，回退全局默认）；active：注册表身份名。
    - 无 manifest 目录映射的槽位（embedding）→ ValueError（端点层 404）。
    """
    if slot not in SLOT_MANIFEST_DIRS:
        raise ValueError(f"槽位 {slot} 无运行态 manifest（仅 text / vision 支持）")
    data = manifest_data(slot, manifest_root)
    if source is not None:
        if source not in SOURCES:
            raise ValueError(f"未知来源：{source}（仅支持 {' / '.join(SOURCES)}）")
        data["source"] = source
    if runtime is not None:
        if runtime == "default":
            data.pop("runtime", None)
        elif runtime in LOCAL_RUNTIMES:
            data["runtime"] = runtime
        else:
            raise ValueError(f"未知本地渠道：{runtime}（仅支持 {' / '.join(LOCAL_RUNTIMES)} / default）")
    if active is not None:
        if active not in IDENTITIES or IDENTITIES[active].slot != slot:
            raise ValueError(f"未知身份：{active}（槽位 {slot}）")
        data["active"] = active
    _write_manifest(slot, data, manifest_root)


def set_manifest_active(slot: str, identity: str, manifest_root: Path | None = None) -> None:
    """写运行态 manifest.active（v2 兼容包装，等价 set_manifest_state(active=identity)）。"""
    set_manifest_state(slot, manifest_root, active=identity)


def slot_identities(slot: str) -> list[Identity]:
    """槽位全部身份（目录顺序）。"""
    return [i for i in IDENTITIES.values() if i.slot == slot]


def slot_source_options(slot: str) -> list[dict]:
    """槽位来源下拉选项：本地部署（无本地候选的槽位 = 待上线置灰）/ API 调用。"""
    has_local = slot in SLOT_MANIFEST_DIRS
    return [
        {"value": "local", "label": "本地部署", "status": "available" if has_local else "pending"},
        {"value": "api", "label": "API 调用", "status": "available"},
    ]


def slot_channel_options(slot: str) -> list[dict]:
    """槽位渠道下拉选项（从注册表派生）：该 runtime 有身份引用 = available，否则 pending。"""
    if slot not in SLOT_MANIFEST_DIRS:
        return []
    identities = slot_identities(slot)
    has_local = any(i.local for i in identities)
    options = [{"value": "default", "label": "默认", "status": "available" if has_local else "pending"}]
    for value, label in CHANNEL_CHOICES:
        available = any((i.local or {}).get(value) for i in identities)
        options.append({"value": value, "label": label, "status": "available" if available else "pending"})
    return options


def slot_model_options(slot: str, source: str, runtime: str = "") -> list[Identity]:
    """槽位模型下拉选项（按来源 × 渠道过滤）：api → 有 api 引用的身份；local → 有该 runtime 引用的身份。"""
    if source == "api":
        return [i for i in slot_identities(slot) if i.api]
    if not runtime:
        return []
    return [i for i in slot_identities(slot) if (i.local or {}).get(runtime)]


def _api_base_url(provider: str, slot: str) -> str | None:
    """api 引用端点：vision 走厂商视觉端点（deepseek 无视觉返回 None）。"""
    spec = clients.PROVIDERS[provider]
    return spec.get("vision_base_url" if slot == "vision" else "text_base_url")


def _resolve_api(slot: str, ident: Identity, settings: Settings) -> Resolved:
    """api 渠道解析：身份 api 引用（厂商+模型）优先；缺引用回退 QED_API_PROVIDER 厂商默认模型。

    回退时 identity 同步回退到「该厂商默认模型的 api 身份」（若目录中存在），使控制台模型下拉
    选中值与 options 一致、备注与生效模型一致（如 qwen3.5-9b → qwen-plus）。
    """
    if ident.api is None:
        provider = settings.qed_api_provider
        spec = clients.PROVIDERS[provider]
        base_url = spec.get("vision_base_url") if slot == "vision" else spec.get("text_base_url")
        if base_url is None:
            return Resolved(slot, "api", ident.name, provider, "",
                            error=f"厂商 {provider} 无该槽位（{slot}）api 端点")
        model = spec.get("vision_default_model" if slot == "vision" else "text_default_model") or ""
        fallback = next((i for i in slot_identities(slot) if i.api == (provider, model)), ident)
        return Resolved(slot, "api", fallback.name, provider, model, base_url,
                        notes=[f"身份 {ident.name} 无 api 引用，回退厂商默认 {model}"])
    provider, model = ident.api
    base_url = _api_base_url(provider, slot)
    if base_url is None:
        return Resolved(slot, "api", ident.name, provider, model,
                        error=f"厂商 {provider} 无该槽位（{slot}）api 端点")
    return Resolved(slot, "api", ident.name, provider, model, base_url)


def _local_base_url(settings: Settings, slot: str, runtime: str) -> str:
    """本地端点：vision 走 MinerU（QED_OCR_MODEL_URL）；text 走文字模型（QED_MODEL_URL，两种 runtime 共用）。"""
    if slot == "vision":
        return settings.qed_ocr_model_url
    return settings.qed_model_url


def local_binding(settings: Settings, slot: str,
                  manifest_root: Path | None = None) -> tuple[str, str, str, list[str]] | None:
    """槽位本地绑定（runtime, 模型标识, 生效身份, notes）；无可用本地引用返回 None。

    与渠道无关：启停与探测（model_manager/runtimes）也消费本函数——api 来源下 stop
    仍需知道本地绑定才能释放显存。runtime 选择：manifest.runtime > 槽位默认
    （text 用 QED_LOCAL_RUNTIME，vision 固定 docker）；embedding 无本地候选恒 None。
    """
    if slot not in SLOT_MANIFEST_DIRS:
        return None
    runtime = slot_runtime(settings, slot, manifest_root)
    ident_name = configured_identity(settings, slot, manifest_root)
    notes: list[str] = []
    local_ref = (IDENTITIES[ident_name].local or {}).get(runtime)
    if local_ref is None:
        fb = SLOT_LOCAL_FALLBACKS.get(slot)
        local_ref = (IDENTITIES[fb].local or {}).get(runtime) if fb else None
        if local_ref is None:
            return None
        notes.append(f"身份 {ident_name} 在 runtime {runtime} 无本地引用，回退槽位默认 {fb}")
        ident_name = fb
    return runtime, local_ref, ident_name, notes


def _resolve_local(slot: str, ident_name: str, settings: Settings,
                   manifest_root: Path | None = None) -> Resolved:
    """local 渠道解析：身份本地引用 → runtime + 模型标识 + 端点（复用 local_binding）。

    manifest_root 必须贯穿（BUGFIX-003）：local_binding 内部会按 manifest.active
    重算生效身份，丢失注入根会回读真实仓库运行态、覆盖外层解析结果。
    """
    if slot == "embedding":
        return Resolved(slot, "local", ident_name, "", "",
                        error="向量槽位暂无本地候选（embedding 仅 api，本地预留）")
    binding = local_binding(settings, slot, manifest_root)
    if binding is None:
        runtime = slot_runtime(settings, slot, manifest_root)
        return Resolved(slot, "local", ident_name, "", "",
                        error=f"runtime {runtime} 无可用本地身份（槽位 {slot}）")
    rt, model_ref, eff_ident, notes = binding
    base_url = _local_base_url(settings, slot, rt)
    provider = "mineru" if slot == "vision" else rt
    return Resolved(slot, "local", eff_ident, provider, model_ref, base_url, notes=notes)


def resolve(settings: Settings, manifest_root: Path | None = None) -> dict[str, Resolved]:
    """三槽位统一解析（不抛异常；失败槽位写 Resolved.error，调用方记录失败调用）。"""
    results: dict[str, Resolved] = {}
    for slot in SLOTS:
        ident_name = configured_identity(settings, slot, manifest_root)
        if configured_source(settings, slot, manifest_root) == "api":
            results[slot] = _resolve_api(slot, IDENTITIES[ident_name], settings)
        else:
            results[slot] = _resolve_local(slot, ident_name, settings, manifest_root)
    return results
