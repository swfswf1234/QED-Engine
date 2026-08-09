"""
模块职责：守护架构正文、Mermaid 视图和已知实现偏差保持同步。
设计关联（DesignRef）：docs/standards/code-document-traceability.md
实现状态：Current
被测代码：docs/architecture
守护面：架构与设计追溯
失效后果：架构正文、Mermaid 视图与实现偏差失去同步
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHITECTURE = ROOT / "docs" / "architecture"
MERMAID_BLOCK = re.compile(r"```mermaid\s*\n(?P<body>.*?)```", re.DOTALL)
CURRENT_DOCUMENTS = {"four-service-architecture.md", "project-status.md"}
VALID_DESIGN_STATUSES = {"Draft", "Proposed", "Accepted", "Rejected", "Superseded", "Historical"}
VALID_IMPLEMENTATION_STATUSES = {
    "Not Started",
    "In Progress",
    "Implemented",
    "Verified",
    "Blocked",
    "Completed",
}


def _mermaid(document: str) -> list[str]:
    content = (ARCHITECTURE / document).read_text(encoding="utf-8")
    return [match.group("body") for match in MERMAID_BLOCK.finditer(content)]


def _field(content: str, name: str) -> str:
    matches = re.findall(rf"^{re.escape(name)}：(.*)$", content, re.MULTILINE)
    assert len(matches) == 1, f"{name} 必须恰好出现一次"
    return matches[0].strip()


def test_architecture_directory_has_one_index_and_current_documents():
    assert {path.name for path in ARCHITECTURE.glob("*.md")} == {
        "index.md",
        "four-service-architecture.md",
        "code-map.md",
        "project-status.md",
    }
    index = (ARCHITECTURE / "index.md").read_text(encoding="utf-8")
    for document in CURRENT_DOCUMENTS:
        assert f"]({document})" in index


def test_four_service_architecture_declares_metadata_and_diagram():
    content = (ARCHITECTURE / "four-service-architecture.md").read_text(encoding="utf-8")
    assert _field(content, "设计状态") in VALID_DESIGN_STATUSES
    assert _field(content, "实现状态") in VALID_IMPLEMENTATION_STATUSES
    for field in ("关联代码", "关联测试", "关联 ADR"):
        _field(content, field)
    assert len(_mermaid("four-service-architecture.md")) >= 1
    for label in ("QED-Engine 前端", "配置中心", "Axiom-Flow", "QED-Tracker"):
        assert label in _mermaid("four-service-architecture.md")[0]


def test_code_map_declares_metadata_and_mapped_modules():
    content = (ARCHITECTURE / "code-map.md").read_text(encoding="utf-8")
    for field in ("设计状态", "实现状态", "关联代码", "关联测试", "关联 ADR"):
        _field(content, field)
    assert "| 代码路径 |" in content
