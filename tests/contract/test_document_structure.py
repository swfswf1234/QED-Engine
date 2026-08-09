"""
模块职责：验证活跃文档入口、目录边界和 Agent 协议保持单一。
设计关联（DesignRef）：docs/standards/documentation.md
实现状态：Current
被测代码：README.md、AGENTS.md、docs、pyproject.toml
守护面：文档结构与导航
失效后果：文档目录边界、入口或 AGENTS 协议漂移，Agent 无法按约定导航
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
DOCUMENT_DIRECTORIES = (
    "architecture",
    "design",
    "adr",
    "standards",
    "guides",
    "plans",
    "trackers",
    "history",
    "learning",
)
ACTIVE_GUIDES = {"index.md", "development.md"}


def test_document_directories_use_explicit_index_entrypoints():
    assert (DOCS / "index.md").is_file()
    for directory in DOCUMENT_DIRECTORIES:
        assert (DOCS / directory / "index.md").is_file(), directory
    assert not (DOCS / "templates").exists()
    assert not list(DOCS.rglob("README.md"))


def test_root_agents_is_the_only_active_agent_protocol():
    assert (ROOT / "AGENTS.md").is_file()
    assert not (DOCS / "agents_read.md").exists()
    assert not list(DOCS.glob("agents*.md"))


def test_active_architecture_and_guides_use_stable_names():
    versioned = []
    for directory in (DOCS / "architecture", DOCS / "guides"):
        versioned.extend(path for path in directory.glob("*.md") if path.stem.startswith(("v0", "v1")))
    assert not versioned


def test_guides_are_human_handbooks_and_an_index():
    guide_names = {path.name for path in (DOCS / "guides").glob("*.md")}
    assert guide_names == ACTIVE_GUIDES

    index = (DOCS / "guides" / "index.md").read_text(encoding="utf-8")
    assert "development.md" in index


def test_docs_index_only_navigates_document_areas():
    content = (DOCS / "index.md").read_text(encoding="utf-8")
    for required in (
        "architecture/index.md",
        "design/index.md",
        "adr/index.md",
        "guides/index.md",
        "plans/index.md",
        "trackers/index.md",
        "standards/index.md",
        "history/index.md",
        "learning/index.md",
    ):
        assert required in content
    assert "```mermaid" not in content
    assert "```powershell" not in content
    assert " passed" not in content
    assert "GitHub Actions" not in content


def test_all_docs_indexes_contain_no_rule_body():
    for index in DOCS.rglob("index.md"):
        content = index.read_text(encoding="utf-8")
        assert "## 规则" not in content, index


def test_agents_routes_tasks_problems_and_completion():
    content = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for required in (
        "## 项目目标",
        "## 文档入口",
        "## 协作流程",
        "## 完成检查",
        "docs/index.md",
        "docs/trackers/todo.md",
        "docs/standards/task-lifecycle.md",
        "docs/architecture/code-map.md",
    ):
        assert required in content
