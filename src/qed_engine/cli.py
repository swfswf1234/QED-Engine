"""QED-Engine 统一命令行（qed）。

提供 config 子命令与服务发现：三服务地址来自根 .env 的 QED_*_URL（可覆盖），
无 .env / 缺 key 时输出最小配置尾注提醒。密钥值绝不打印。

设计关联（DesignRef）：docs/design/configuration-and-secrets.md
实现状态：Current
关联测试：tests/test_cli.py
"""

import argparse
import sys

from qed_engine.config import Settings

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SERVICES = (
    ("配置中心", "qed_config_center_url"),
    ("QED-Tracker", "qed_tracker_url"),
    ("Axiom-Flow", "qed_axiom_url"),
)

MODEL_ROUTES = (
    ("主对话", "qed_model", "qwen"),
    ("OCR/视觉", "qed_ocr_model", "qwen"),
    ("嵌入", "qed_embedding_model", "qwen"),
    ("GLM 对话（切换档）", "glm_model", "glm"),
    ("GLM 文档 OCR（切换档）", "glm_ocr_model", "glm"),
    ("deepseek（占位档）", "deepseek_model", "deepseek"),
)

MINIMAL_CONFIG_HINT = (
    "最小配置：在 QED-Engine 根目录创建 .env 并填写 QWEN_API_KEY=...；"
    "或设置环境变量 QWEN_API_KEY。"
)


def _reminder(settings: Settings) -> str | None:
    """全部供应商 key 未配置（无 .env 或缺 key）时返回尾注提醒，否则 None。"""
    if any(settings.has_configured(provider) for provider in ("qwen", "glm", "deepseek")):
        return None
    return MINIMAL_CONFIG_HINT


def _service_lines(settings: Settings) -> list[str]:
    return [
        f"  {name:>12}  {getattr(settings, field)}"
        for name, field in SERVICES
    ]


def _print_usage(settings: Settings) -> None:
    print("qed —— QED-Engine 统一命令行")
    print()
    print("子命令：")
    print("  config    查看配置状态（模型路由、密钥布尔状态、服务地址）")
    print()
    print("服务地址（QED_*_URL 可覆盖）：")
    print("\n".join(_service_lines(settings)))


def _print_config(settings: Settings) -> None:
    print("模型路由（来自根 .env，可在 .env 或环境变量覆盖）：")
    for label, field, provider in MODEL_ROUTES:
        state = "已配置" if settings.has_configured(provider) else "未配置"
        print(f"  {label:>16}  {getattr(settings, field):<24} {provider:<10} {state}")
    print()
    print("服务地址（服务发现）：")
    print("\n".join(_service_lines(settings)))
    reminder = _reminder(settings)
    if reminder:
        print()
        print(f"提示：未配置任何 API key（或根 .env 缺失），按未配置降级运行。{reminder}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="qed",
        description="QED-Engine 统一命令行：配置查看与服务发现。",
    )
    parser.add_argument(
        "subcommand",
        nargs="?",
        choices=("config",),
        help="子命令（无参数时输出服务地址与用法）",
    )
    args = parser.parse_args(argv)
    settings = Settings()
    if args.subcommand == "config":
        _print_config(settings)
    else:
        _print_usage(settings)


if __name__ == "__main__":
    main()
