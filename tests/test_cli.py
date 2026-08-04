"""
模块职责：统一 CLI qed 契约测试：config 子命令、服务发现地址与最小配置尾注提醒。
设计关联（DesignRef）：docs/design/configuration-and-secrets.md
实现状态：Current
被测代码：src/qed_engine/cli.py
"""

from qed_engine.cli import main


def _clear_env(monkeypatch):
    for name in (
        "QWEN_API_KEY",
        "GLM_API_KEY",
        "DEEPSEEK_API_KEY",
        "QED_MODEL",
        "QED_OCR_MODEL",
        "QED_EMBEDDING_MODEL",
        "GLM_MODEL",
        "GLM_OCR_MODEL",
        "DEEPSEEK_MODEL",
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
