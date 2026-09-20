"""本地模型资源管理器（PLAN-046 v2 单活仲裁）：ensure_local_ready(slot) + operate_model(slot, op)。

互斥泛化（2026-09-16）：QED_RESOURCE_GUARD=true 时启动任一本地槽位前，遍历注册表其他
本地候选槽位（text/vision），在跑的一律 stop——本地同时最多一个模型（4080 16GB 显存约束）。
runtime 细节（LM Studio 半托管 / llama.cpp / docker）归 services/llm/runtimes/；槽位绑定
（runtime + 模型标识）由 registry.local_binding 给出。api 模式不启动任何本地模型。

v1 兼容：ensure_text_ready / ensure_image_ready 保留为槽位包装；MODEL_SCRIPTS 与旧名
qwen/mineru 经 SLOT_ALIASES 过渡（deprecated，端点层同步提供别名）。

设计关联（DesignRef）：docs/design/local-model-management.md
实现状态：Current
关联测试：tests/test_llm_model_manager.py
"""

from collections.abc import Callable
from pathlib import Path

from qed_engine.config import Settings
from qed_engine.services.llm import registry
from qed_engine.services.llm.runtimes import get_runtime

ROOT = Path(__file__).resolve().parents[4]  # services/llm/ → 仓库根
TEXT_SCRIPT = ROOT / "scripts" / "text-model" / "qed_qwen_service.py"
IMAGE_SCRIPT = ROOT / "scripts" / "image-model" / "qed_mineru_service.py"

# 本地候选槽位（embedding 无本地候选，天然跳过仲裁）
SLOTS = ("text", "vision")
# 旧模型名 → 槽位（v1 过渡别名，deprecated）
SLOT_ALIASES = {"qwen": "text", "mineru": "vision"}
# v1 生命周期脚本映射（保留：脚本 CLI 直接使用与契约测试锚定）
MODEL_SCRIPTS = {
    "qwen": TEXT_SCRIPT,
    "mineru": IMAGE_SCRIPT,
}


def _noop_log(_message: str) -> None:
    return None


def slot_runtime_key(settings: Settings, slot: str) -> str:
    """槽位本地 runtime（v3：manifest.runtime > 槽位默认；vision 固定 docker，text 用全局默认）。"""
    return registry.slot_runtime(settings, slot)


def stop_other_local_slots(settings: Settings, target_slot: str,
                           script_runner: Callable | None = None,
                           log: Callable[[str], None] | None = None) -> None:
    """单活仲裁：停其他本地候选槽位中在跑的 runtime。

    在跑判定用 server 级 probe（不带模型）——LM Studio 挂着非绑定模型（如另一只 Qwen）
    时也必须释放；stop 传空模型 = 该 runtime 全量释放（lmstudio 卸载全部已加载，脚本停进程）。
    """
    log = log or _noop_log
    for slot in SLOTS:
        if slot == target_slot:
            continue
        binding = registry.local_binding(settings, slot)
        if binding is None:
            continue
        rt = get_runtime(binding[0])
        if rt.probe(settings):
            log(f"stop {slot}（{binding[0]}，单活互斥）")
            rt.stop(settings, "", log=log, script_runner=script_runner)


def ensure_local_ready(settings: Settings, slot: str, script_runner: Callable | None = None,
                       log: Callable[[str], None] | None = None) -> None:
    """确保槽位本地模型就绪（local 模式）：目标已就绪直接返回；否则单活仲裁后启动。

    api 模式直接放行；绑定缺失/启动失败经 log 上报不抛异常——调用链继续
    （gateway 走调用失败路径记录 qed_llm_calls）。
    """
    log = log or _noop_log
    if settings.qed_api_select != "local":
        return
    binding = registry.local_binding(settings, slot)
    if binding is None:
        log(f"槽位 {slot} 无可用本地模型（runtime {slot_runtime_key(settings, slot)}）")
        return
    rt_key, model = binding[0], binding[1]
    rt = get_runtime(rt_key)
    if rt.probe(settings, model):
        return
    if settings.qed_resource_guard:
        stop_other_local_slots(settings, slot, script_runner=script_runner, log=log)
    result = rt.start(settings, model, log=log, script_runner=script_runner)
    if not result.ok:
        log(f"start 槽位 {slot} 失败：{result.detail}")


# --- v1 兼容包装（gateway 现有调用点；W3 切槽位路由后可退场） ---


def ensure_text_ready(settings: Settings, script_runner: Callable | None = None,
                      log: Callable[[str], None] | None = None) -> None:
    """v1 兼容：文字槽位本地就绪（= ensure_local_ready("text")）。"""
    ensure_local_ready(settings, "text", script_runner=script_runner, log=log)


def ensure_image_ready(settings: Settings, script_runner: Callable | None = None,
                       log: Callable[[str], None] | None = None) -> None:
    """v1 兼容：图像槽位本地就绪（= ensure_local_ready("vision")）。"""
    ensure_local_ready(settings, "vision", script_runner=script_runner, log=log)


# --- operate_model 统一入口（v2 槽位化）---


def operate_model(name: str, op: str, settings: Settings,
                  script_runner: Callable | None = None,
                  log: Callable[[str], None] | None = None) -> None:
    """槽位统一操作入口：start / stop / restart（name∈{text,vision}；旧名 qwen/mineru 过渡）。

    start/restart 复用 ensure_local_ready（单活仲裁已含，api 模式放行）；stop 直停本槽位
    （不经 guard：stop 本身是互斥的手段，且 api 模式下也允许释放资源）。
    未知 name/op 抛 ValueError（路由层映射 404）。
    """
    log = log or _noop_log
    slot = SLOT_ALIASES.get(name, name)
    if slot not in SLOTS:
        raise ValueError(f"未知模型槽位：{name}（支持 text / vision，旧名 qwen / mineru 过渡期可用）")
    if op not in ("start", "stop", "restart"):
        raise ValueError(f"未知操作：{op}（仅支持 start / stop / restart）")

    binding = registry.local_binding(settings, slot)
    rt = get_runtime(slot_runtime_key(settings, slot))
    model = binding[1] if binding else ""

    if op == "start":
        ensure_local_ready(settings, slot, script_runner=script_runner, log=log)
        return
    if op == "stop":
        rt.stop(settings, model, log=log, script_runner=script_runner)
        return
    # restart：先停本槽位再走 ensure（单活仲裁）
    rt.stop(settings, model, log=log, script_runner=script_runner)
    ensure_local_ready(settings, slot, script_runner=script_runner, log=log)
