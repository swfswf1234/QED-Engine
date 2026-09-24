"""
模块职责：守护存储规范与 dataset 设计、doc-governance 引用及 .gitignore 边界保持一致；
守护 ADR 0018 数据根顶层白名单哨兵区与「元数据 JSON 岛禁止 / 虚构约定不复活」规则。
设计关联（DesignRef）：docs/standards/storage-conventions.md
实现状态：Current
被测代码：docs/standards/storage-conventions.md、docs/design/dataset-conventions.md、docs/standards/doc-governance.md、.gitignore
守护面：标准治理
失效后果：存储规则与目录约定漂移，agent 误读写真实数据根
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STANDARD = ROOT / "docs" / "standards" / "storage-conventions.md"
DATASET_DESIGN = ROOT / "docs" / "design" / "dataset-conventions.md"
DOC_GOVERNANCE = ROOT / "docs" / "standards" / "doc-governance.md"
GITIGNORE = ROOT / ".gitignore"
ADR_0018 = ROOT / "docs" / "adr" / "0018-data-root-whitelist-and-meta-json-ban.md"

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

WHITELIST_SENTINEL = re.compile(
    r"<!-- data-root-whitelist:start -->\n(.*?)<!-- data-root-whitelist:end -->",
    re.DOTALL,
)
WHITELIST_ENTRY = re.compile(r"^- `([a-z_]+)/`")

# 数据根顶层白名单（ADR 0018 决定的机器镜像；扩缩条目须先立 ADR 再改此常量）
DATA_ROOT_WHITELIST = {"raw", "tmp", "parsed", "backups"}


def _standard() -> str:
    return STANDARD.read_text(encoding="utf-8")


def _dataset_design() -> str:
    return DATASET_DESIGN.read_text(encoding="utf-8")


def test_standard_covers_core_storage_rules():
    content = _standard()
    for keyword in CORE_RULES:
        assert keyword in content, keyword


def test_dataset_design_references_standard():
    assert "storage-conventions.md" in _dataset_design()


def test_doc_governance_references_standard():
    content = DOC_GOVERNANCE.read_text(encoding="utf-8")
    assert "storage-conventions.md" in content


def test_gitignore_ignores_dataset_data_files():
    content = GITIGNORE.read_text(encoding="utf-8")
    assert "/dataset/*" in content


def test_data_root_whitelist_sentinel_matches_adr_0018():
    """dataset 设计白名单哨兵区必须与 ADR 0018 决定的顶层目录集合双向一致。"""
    match = WHITELIST_SENTINEL.search(_dataset_design())
    assert match, "dataset-conventions.md 缺少 data-root-whitelist 哨兵区"
    declared = set()
    for line in match.group(1).splitlines():
        entry = WHITELIST_ENTRY.match(line.strip())
        if entry:
            declared.add(entry.group(1))
        elif line.strip():
            raise AssertionError(f"白名单条目格式不合规：{line!r}")
    assert declared == DATA_ROOT_WHITELIST, declared ^ DATA_ROOT_WHITELIST


def test_standard_declares_adr_0018_rules():
    """标准正文必须承载白名单登记制与元数据 JSON 岛禁止两条规则。"""
    content = _standard()
    assert "顶层白名单登记制" in content
    assert "元数据 JSON 岛禁止" in content
    assert "用户资产不进 tmp" in content
    assert "0018" in content, "标准须引用 ADR 0018"
    assert ADR_0018.exists()


def test_design_has_no_phantom_tmp_axiom_flow_bucket():
    """虚构约定不复活：dataset 设计正文不得再出现 tmp/axiom-flow 声明。"""
    assert "tmp/axiom-flow" not in _dataset_design()
