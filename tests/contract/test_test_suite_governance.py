"""
模块职责：守护测试目录边界、根测试文件与文档治理测试的分层一致。
设计关联（DesignRef）：docs/standards/testing.md
实现状态：Current
被测代码：tests、pyproject.toml、docs/standards/testing.md
守护面：测试工程与门禁
失效后果：测试分层、目录或门禁配置漂移，门禁失效
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TESTS = ROOT / "tests"


def _governance_areas() -> set[str]:
    """从测试架构标准正文提取守护面清单（表格第一列），保持单一事实源。

    「守护面清单」表格固定 3 列（治理面 / 守护内容 / 契约测试），首行为表头；
    提取时校验格式，防止表格结构漂移导致清单静默失效。
    """
    standard = (ROOT / "docs" / "standards" / "testing.md").read_text(encoding="utf-8")
    areas = {}
    for line in standard.splitlines():
        if not line.startswith("| "):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 3:
            continue
        if cells[0] == "治理面":
            assert cells == ["治理面", "守护内容", "契约测试"], "守护面清单表头漂移"
            continue
        if cells[0].startswith("---"):
            continue
        assert cells[0] and cells[1] and cells[2], f"守护面清单行不完整：{cells}"
        assert cells[0] not in areas, f"守护面清单出现重复治理面：{cells[0]}"
        areas[cells[0]] = cells
    assert areas, "未从测试架构标准提取到任何守护面"
    return set(areas)


def test_test_directories_are_limited_to_contract_layer():
    directories = {path.name for path in TESTS.iterdir() if path.is_dir() and path.name != "__pycache__"}
    assert directories == {"contract"}
    assert not list((TESTS / "contract" / "support").glob("*.py"))


def test_root_test_files_are_the_config_center_suite():
    root_tests = {path.name for path in TESTS.glob("test_*.py")}
    assert root_tests == {
        "test_api.py",
        "test_config.py",
        "test_cli.py",
        "test_domain_explore.py",
        "test_explore_sessions.py",
        "test_llm_call_log.py",
        "test_llm_clients.py",
        "test_llm_endpoints.py",
        "test_llm_gateway.py",
        "test_llm_model_manager.py",
        "test_log_viewer.py",
        "test_monitor.py",
        "test_qed_engine_service.py",
        "test_qed_lmstudio_service.py",
        "test_qed_mineru_service.py",
        "test_qed_web_service.py",
        "test_self_restart.py",
        "test_tracker_client.py",
        "test_web.py",
    }


def test_pytest_uses_strict_markers_and_importlib():
    content = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert 'addopts = "--strict-markers --import-mode=importlib"' in content


def test_contract_tests_reference_a_governing_standard():
    standards_dir = ROOT / "docs" / "standards"
    for path in TESTS.rglob("test_*.py"):
        if path.parent.name != "contract":
            continue
        content = path.read_text(encoding="utf-8")
        assert "设计关联（DesignRef）：docs/standards/" in content
        reference = content.split("设计关联（DesignRef）：", 1)[1].splitlines()[0].strip()
        assert (standards_dir / reference.removeprefix("docs/standards/")).is_file()


def test_contract_tests_declare_complete_contract_headers():
    areas = _governance_areas()
    assert areas
    for path in TESTS.rglob("test_*.py"):
        if path.parent.name != "contract":
            continue
        content = path.read_text(encoding="utf-8")
        assert "模块职责：" in content, path.name
        assert "设计关联（DesignRef）：docs/standards/" in content, path.name
        assert "实现状态：Current" in content, path.name
        assert "被测代码：" in content, path.name
        match = re.search(r"^守护面：(.+)$", content, re.MULTILINE)
        assert match and match.group(1).strip() in areas, path.name
        assert re.search(r"^失效后果：.+$", content, re.MULTILINE), path.name
