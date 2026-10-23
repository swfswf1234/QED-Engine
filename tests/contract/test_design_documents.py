"""
模块职责：守护设计文档的元数据与索引边界保持一致。
设计关联（DesignRef）：docs/standards/code-document-traceability.md
实现状态：Current
被测代码：docs/design
守护面：架构与设计追溯
失效后果：设计文档元数据或索引漂移，契约事实源失真
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "docs" / "design"
CURRENT_DOCUMENTS = {
    "project-configuration.md",
    "llm-gateway.md",
    "local-model-management.md",
    "cross-project-contracts.md",
    "service-hosting.md",
    "dataset-conventions.md",
    "tech-stack.md",
    "downloads-flow.md",
    "parsing-flow.md",
    # design/frontend/ 子目录（REQ-115 前端设计整合轮迁入，递归守护下仍受元数据/索引校验）
    "frontend/frontend-overview.md",
    "frontend/admin-console.md",
    "frontend/admin-dashboard.md",
    "frontend/downloads-ui.md",
    "frontend/parsing-ui.md",
    "frontend/learning-practice-ui.md",
    "frontend/learning-course-ui.md",
    "frontend/knowledge-point-exploration-ui.md",
}
VALID_DESIGN_STATUSES = {"Draft", "Proposed", "Accepted", "Rejected", "Superseded", "Historical"}
VALID_IMPLEMENTATION_STATUSES = {
    "Not Started",
    "In Progress",
    "Implemented",
    "Verified",
    "Blocked",
    "Completed",
}
VALID_CONFIRM_STATUSES = {"暂定", "已确认"}
PATH_REFERENCE = re.compile(r"`((?:src|tests|scripts)/[^`]+)`")


def _field(content: str, name: str) -> str:
    matches = re.findall(rf"^{re.escape(name)}：(.*)$", content, re.MULTILINE)
    assert len(matches) == 1, f"{name} 必须恰好出现一次"
    return matches[0].strip()


def test_design_directory_has_one_index_and_current_contracts():
    assert {str(p.relative_to(DESIGN)).replace("\\", "/") for p in DESIGN.rglob("*.md")} == {"index.md", *CURRENT_DOCUMENTS}
    index = (DESIGN / "index.md").read_text(encoding="utf-8")
    for document in CURRENT_DOCUMENTS:
        assert f"]({document})" in index


def test_every_current_design_declares_complete_metadata():
    for document in CURRENT_DOCUMENTS:
        content = (DESIGN / document).read_text(encoding="utf-8")
        assert _field(content, "设计状态") in VALID_DESIGN_STATUSES, document
        assert _field(content, "实现状态") in VALID_IMPLEMENTATION_STATUSES, document
        assert _field(content, "确认状态") in VALID_CONFIRM_STATUSES, document
        _field(content, "最后更新")
        _field(content, "关联代码")
        _field(content, "关联测试")
        _field(content, "关联 ADR")
        for reference in PATH_REFERENCE.findall(_field(content, "关联代码")):
            assert (ROOT / reference).exists(), f"{document}: {reference}"
