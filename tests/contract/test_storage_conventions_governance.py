"""
模块职责：守护存储规范与 dataset 设计、doc-governance 引用及 .gitignore 边界保持一致。
设计关联（DesignRef）：docs/standards/storage-conventions.md
实现状态：Current
被测代码：docs/standards/storage-conventions.md、docs/design/dataset-conventions.md、docs/standards/doc-governance.md、.gitignore
守护面：标准治理
失效后果：存储规则与目录约定漂移，agent 误读写真实数据根
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STANDARD = ROOT / "docs" / "standards" / "storage-conventions.md"
DATASET_DESIGN = ROOT / "docs" / "design" / "dataset-conventions.md"
DOC_GOVERNANCE = ROOT / "docs" / "standards" / "doc-governance.md"
GITIGNORE = ROOT / ".gitignore"

CORE_RULES = (
    "QED_DATA_ROOT",
    "raw/",
    "tmp/",
    "parsed/",
    "原子落盘",
    "不可变",
    "测试",
    "临时目录",
)


def _standard() -> str:
    return STANDARD.read_text(encoding="utf-8")


def test_standard_covers_core_storage_rules():
    content = _standard()
    for keyword in CORE_RULES:
        assert keyword in content, keyword


def test_dataset_design_references_standard():
    content = DATASET_DESIGN.read_text(encoding="utf-8")
    assert "storage-conventions.md" in content


def test_doc_governance_references_standard():
    content = DOC_GOVERNANCE.read_text(encoding="utf-8")
    assert "storage-conventions.md" in content


def test_gitignore_ignores_dataset_data_files():
    content = GITIGNORE.read_text(encoding="utf-8")
    assert "/dataset/*" in content
