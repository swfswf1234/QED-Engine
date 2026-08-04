"""
模块职责：守护测试目录边界、根测试文件与文档治理测试的分层一致。
设计关联（DesignRef）：docs/standards/testing.md
实现状态：Current
被测代码：tests、pyproject.toml
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TESTS = ROOT / "tests"


def test_test_directories_are_limited_to_contract_layer():
    directories = {path.name for path in TESTS.iterdir() if path.is_dir() and path.name != "__pycache__"}
    assert directories == {"contract"}
    assert not list((TESTS / "contract" / "support").glob("*.py"))


def test_root_test_files_are_the_config_center_suite():
    root_tests = {path.name for path in TESTS.glob("test_*.py")}
    assert root_tests == {"test_api.py", "test_config.py"}


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
