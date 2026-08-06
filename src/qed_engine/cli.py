"""QED-Engine 统一命令行（qed）。

提供 config 子命令与服务发现：三服务地址来自根 .env 的 QED_*_URL（可覆盖），
无 .env / 缺 key 时输出最小配置尾注提醒。密钥值绝不打印。

tracker 子命令为 QED-Tracker 8901 服务的 HTTP 客户端（人机协同闭环）：
books list/download、resources confirm/reject/approve、tasks 轮询；
契约见 docs/design/service-contracts.md。

设计关联（DesignRef）：docs/design/configuration-and-secrets.md、docs/design/service-contracts.md
实现状态：Current
关联测试：tests/test_cli.py、tests/test_tracker_client.py
"""

import argparse
import json
import sys

from qed_engine.config import Settings
from qed_engine.tracker_client import TrackerClient, TrackerError

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

TRACKER_USAGE = """\
tracker 子命令（QED-Tracker 8901 服务客户端）：
  qed tracker books list [--status S] [--course C] [--kind K] [--language L] [--json]
  qed tracker books download <resource_id> [--no-wait] [--json]
  qed tracker resources confirm <resource_id> [--json]
  qed tracker resources reject <resource_id> --reason <原因> [--json]
  qed tracker resources approve <resource_id> [--json]
  qed tracker tasks [--id <task_id>] [--wait] [--json]
"""


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
    print("  tracker   QED-Tracker 8901 服务客户端（books/resources/tasks）")
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


def _build_client(settings: Settings) -> TrackerClient:
    """按服务发现地址构造 8901 客户端（测试可替换注入 MockTransport）。"""
    return TrackerClient(base_url=settings.qed_tracker_url)


def _emit(payload, as_json: bool) -> None:
    print(json.dumps(payload, ensure_ascii=False) if as_json else payload)


def _run_tracker(argv: list[str], settings: Settings) -> None:
    if not argv:
        print(TRACKER_USAGE)
        return
    client = _build_client(settings)
    try:
        _dispatch_tracker(argv, client)
    except TrackerError as exc:
        print(f"错误：{exc}")
        raise SystemExit(1) from exc
    finally:
        client.close()


def _dispatch_tracker(argv: list[str], client: TrackerClient) -> None:
    group = argv[0]
    args = argv[1:]

    if group == "books":
        parser = argparse.ArgumentParser(prog="qed tracker books")
        sub = parser.add_subparsers(dest="action", required=True)
        list_p = sub.add_parser("list")
        list_p.add_argument("--status")
        list_p.add_argument("--course", dest="course")
        list_p.add_argument("--kind")
        list_p.add_argument("--language")
        list_p.add_argument("--json", action="store_true")
        dl = sub.add_parser("download")
        dl.add_argument("resource_id")
        dl.add_argument("--no-wait", action="store_true")
        dl.add_argument("--json", action="store_true")
        parsed = parser.parse_args(args)
        if parsed.action == "list":
            resources = client.list_resources(
                status=parsed.status,
                course_id=parsed.course,
                kind=parsed.kind,
                language=parsed.language,
            )
            if parsed.json:
                _emit(resources, True)
            elif not resources:
                print("（无资源记录）")
            else:
                for item in resources:
                    course = item.get("course_id", "—")
                    title = item.get("title", item.get("resource_id", "?"))
                    status = item.get("status", "?")
                    print(f"  [{course}] {title}  [{status}]")
        elif parsed.action == "download":
            task = client.create_download(parsed.resource_id)
            if parsed.no_wait:
                _emit(f"task_id: {task['task_id']}", parsed.json)
            else:
                done = client.wait_task(task["task_id"])
                _emit(f"任务 {task['task_id']}：{done.get('status')} {done.get('result')}", parsed.json)
        return

    if group == "resources":
        parser = argparse.ArgumentParser(prog="qed tracker resources")
        sub = parser.add_subparsers(dest="action", required=True)
        for name in ("confirm", "approve"):
            p = sub.add_parser(name)
            p.add_argument("resource_id")
            p.add_argument("--json", action="store_true")
        reject_p = sub.add_parser("reject")
        reject_p.add_argument("resource_id")
        reject_p.add_argument("--reason", required=True)
        reject_p.add_argument("--json", action="store_true")
        parsed = parser.parse_args(args)
        if parsed.action == "confirm":
            resource = client.confirm_resource(parsed.resource_id)
            _emit(f"资源 {parsed.resource_id} 已确认，状态：{resource.get('status')}", parsed.json)
        elif parsed.action == "reject":
            resource = client.reject_resource(parsed.resource_id, reason=parsed.reason)
            _emit(f"资源 {parsed.resource_id} 已拒绝，状态：{resource.get('status')}", parsed.json)
        elif parsed.action == "approve":
            resource = client.approve_resource(parsed.resource_id)
            _emit(f"资源 {parsed.resource_id} 已验收，状态：{resource.get('status')}", parsed.json)
        return

    if group == "tasks":
        parser = argparse.ArgumentParser(prog="qed tracker tasks")
        parser.add_argument("--id", dest="task_id")
        parser.add_argument("--wait", action="store_true")
        parser.add_argument("--json", action="store_true")
        parsed = parser.parse_args(args)
        if parsed.task_id:
            task = client.wait_task(parsed.task_id) if parsed.wait else client.get_task(parsed.task_id)
            _emit(task, parsed.json)
        else:
            tasks = client.list_tasks()
            if parsed.json:
                _emit(tasks, True)
            elif not tasks:
                print("（无任务记录）")
            else:
                for task in tasks:
                    print(f"  {task.get('task_id', '?')}  {task.get('type', '?')}  {task.get('status', '?')}  {task.get('progress', '')}")
        return

    print(f"未知 tracker 子命令：{group}")
    print(TRACKER_USAGE)
    raise SystemExit(2)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="qed",
        description="QED-Engine 统一命令行：配置查看、服务发现与 QED-Tracker 客户端。",
    )
    parser.add_argument(
        "subcommand",
        nargs="?",
        help="子命令：config / tracker（无参数时输出服务地址与用法）",
    )
    args_list = argv if argv is not None else sys.argv[1:]
    args, _unknown = parser.parse_known_args(args_list)
    settings = Settings()
    if args.subcommand == "config":
        _print_config(settings)
    elif args.subcommand == "tracker":
        _run_tracker(args_list[1:], settings)
    elif args.subcommand is None:
        _print_usage(settings)
    else:
        print(f"未知子命令：{args.subcommand}")
        _print_usage(settings)
        raise SystemExit(2)


if __name__ == "__main__":
    main()

