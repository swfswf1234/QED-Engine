"""
模块职责：统一 CLI qed 契约测试：config 子命令、tracker 客户端子命令、服务发现地址与尾注提醒。
设计关联（DesignRef）：docs/design/configuration-and-secrets.md、docs/design/service-contracts.md
实现状态：Current
被测代码：src/qed_engine/cli.py、src/qed_engine/tracker_client.py
"""

import httpx
import pytest

from qed_engine.cli import main
from qed_engine.tracker_client import TrackerClient


def _clear_env(monkeypatch):
    for name in (
        "QWEN_API_KEY",
        "GLM_API_KEY",
        "DEEPSEEK_API_KEY",
        "QED_MODEL",
        "QED_OCR_MODEL",
        "QED_EMBEDDING_MODEL",
        "QED_CONFIG_CENTER_URL",
        "QED_TRACKER_URL",
        "QED_AXIOM_URL",
    ):
        monkeypatch.delenv(name, raising=False)


def test_no_args_shows_usage_and_service_urls(monkeypatch, capsys):
    """无参数运行：输出子命令列表与三服务默认地址（服务发现）。"""
    _clear_env(monkeypatch)
    main([])
    output = capsys.readouterr().out
    assert "config" in output
    assert "http://127.0.0.1:8900" in output
    assert "http://127.0.0.1:8901" in output
    assert "http://127.0.0.1:8902" in output


def test_config_shows_model_routes_and_keys_status(monkeypatch, capsys):
    """config 子命令：显示模型路由与密钥布尔状态，不泄露密钥值。"""
    _clear_env(monkeypatch)
    monkeypatch.setenv("QWEN_API_KEY", "sk-qwen-secret")
    main(["config"])
    output = capsys.readouterr().out
    assert "qwen-plus" in output
    assert "qwen" in output
    assert "sk-qwen-secret" not in output


def test_config_hides_secret_values_never_printed(monkeypatch, capsys):
    """任何场景下输出都不含密钥值。"""
    _clear_env(monkeypatch)
    monkeypatch.setenv("QWEN_API_KEY", "sk-super-secret-value")
    main(["config"])
    output = capsys.readouterr().out
    assert "sk-super-secret-value" not in output


def test_footer_reminder_when_no_keys_configured(monkeypatch, tmp_path, capsys):
    """全部 key 缺失（含 .env 缺失场景）：输出最小配置尾注提醒。"""
    _clear_env(monkeypatch)
    monkeypatch.chdir(tmp_path)  # 无 .env 的干净目录，Settings 按内置默认降级
    main(["config"])
    output = capsys.readouterr().out
    assert "QWEN_API_KEY" in output


def test_no_footer_reminder_when_configured(monkeypatch, tmp_path, capsys):
    """任一 key 已配置：不输出最小配置尾注。"""
    _clear_env(monkeypatch)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("QWEN_API_KEY", "sk-qwen-test")
    main(["config"])
    output = capsys.readouterr().out
    assert "QWEN_API_KEY=" not in output


def test_service_urls_env_override_in_config_output(monkeypatch, capsys):
    """QED_*_URL 覆盖后，config 输出显示覆盖值。"""
    _clear_env(monkeypatch)
    monkeypatch.setenv("QED_TRACKER_URL", "http://tracker.local:9101")
    monkeypatch.setenv("QED_AXIOM_URL", "http://axiom.local:9102")
    main(["config"])
    output = capsys.readouterr().out
    assert "http://tracker.local:9101" in output
    assert "http://axiom.local:9102" in output


# --- tracker 客户端子命令 ---


def _inject_tracker_client(monkeypatch, handler):
    """把 cli._build_client 替换为注入 MockTransport 的真实客户端。"""
    client = TrackerClient(base_url="http://tracker.test", transport=httpx.MockTransport(handler))
    monkeypatch.setattr("qed_engine.cli._build_client", lambda settings: client)


def test_tracker_books_list_shows_resources(monkeypatch, capsys):
    """books list：按过滤参数请求 8901 /resources，输出书名与状态。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/resources"
        assert request.url.params["status"] == "candidate"
        return httpx.Response(
            200,
            json=[
                {"resource_id": "sha256:abc", "title": "数学分析", "status": "candidate", "course_id": "01"}
            ],
        )

    _inject_tracker_client(monkeypatch, handler)
    main(["tracker", "books", "list", "--status", "candidate"])
    output = capsys.readouterr().out
    assert "数学分析" in output
    assert "candidate" in output


def test_tracker_books_list_json_output(monkeypatch, capsys):
    """books list --json：原样输出 8901 响应 JSON。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{"resource_id": "sha256:abc", "title": "数学分析"}])

    _inject_tracker_client(monkeypatch, handler)
    main(["tracker", "books", "list", "--json"])
    output = capsys.readouterr().out
    assert '"resource_id": "sha256:abc"' in output
    assert '"数学分析"' in output


def test_tracker_books_download_wait_mode(monkeypatch, capsys):
    """books download：默认等待任务终态并输出结果。"""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/tasks/books/download"):
            return httpx.Response(200, json={"task_id": "t-1"})
        return httpx.Response(
            200,
            json={"task_id": "t-1", "status": "succeeded", "result": {"relative_path": "raw/books/math-qe/01/a.pdf"}},
        )

    _inject_tracker_client(monkeypatch, handler)
    main(["tracker", "books", "download", "sha256:abc"])
    output = capsys.readouterr().out
    assert "t-1" in output
    assert "succeeded" in output


def test_tracker_books_download_no_wait(monkeypatch, capsys):
    """books download --no-wait：仅输出 task_id。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"task_id": "t-1"})

    _inject_tracker_client(monkeypatch, handler)
    main(["tracker", "books", "download", "sha256:abc", "--no-wait"])
    output = capsys.readouterr().out
    assert "t-1" in output


def test_tracker_resources_confirm(monkeypatch, capsys):
    """resources confirm：输出更新后的状态。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/resources/sha256:abc/confirm"
        return httpx.Response(200, json={"resource_id": "sha256:abc", "status": "confirmed"})

    _inject_tracker_client(monkeypatch, handler)
    main(["tracker", "resources", "confirm", "sha256:abc"])
    output = capsys.readouterr().out
    assert "confirmed" in output


def test_tracker_resources_reject_requires_reason(monkeypatch, capsys):
    """resources reject 缺 --reason：参数错误（argparse SystemExit 2），不发请求。"""
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("不应发起请求")

    _inject_tracker_client(monkeypatch, handler)
    with pytest.raises(SystemExit):
        main(["tracker", "resources", "reject", "sha256:abc"])


def test_tracker_resources_reject_with_reason(monkeypatch, capsys):
    """resources reject --reason：携带原因请求。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/resources/sha256:abc/reject"
        assert '"reason"' in request.content.decode("utf-8")
        return httpx.Response(200, json={"resource_id": "sha256:abc", "status": "rejected"})

    _inject_tracker_client(monkeypatch, handler)
    main(["tracker", "resources", "reject", "sha256:abc", "--reason", "版本不对"])
    output = capsys.readouterr().out
    assert "rejected" in output


def test_tracker_resources_approve(monkeypatch, capsys):
    """resources approve：输出更新后的状态。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/resources/sha256:abc/approve"
        return httpx.Response(200, json={"resource_id": "sha256:abc", "status": "approved"})

    _inject_tracker_client(monkeypatch, handler)
    main(["tracker", "resources", "approve", "sha256:abc"])
    output = capsys.readouterr().out
    assert "approved" in output


def test_tracker_tasks_list(monkeypatch, capsys):
    """tasks：输出任务列表。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/tasks"
        return httpx.Response(200, json=[{"task_id": "t-1", "type": "download", "status": "succeeded"}])

    _inject_tracker_client(monkeypatch, handler)
    main(["tracker", "tasks"])
    output = capsys.readouterr().out
    assert "t-1" in output
    assert "succeeded" in output


def test_tracker_tasks_show_single(monkeypatch, capsys):
    """tasks --id：输出单任务状态。"""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/tasks/t-1"
        return httpx.Response(200, json={"task_id": "t-1", "status": "succeeded", "progress": 100})

    _inject_tracker_client(monkeypatch, handler)
    main(["tracker", "tasks", "--id", "t-1"])
    output = capsys.readouterr().out
    assert "succeeded" in output
    assert "100" in output


def test_tracker_error_prints_and_exits_nonzero(monkeypatch, capsys):
    """8901 返回错误：打印错误信息并以退出码 1 退出。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "非法状态迁移"})

    _inject_tracker_client(monkeypatch, handler)
    with pytest.raises(SystemExit) as exc_info:
        main(["tracker", "resources", "confirm", "sha256:abc"])
    assert exc_info.value.code == 1
    assert "非法状态迁移" in capsys.readouterr().out
