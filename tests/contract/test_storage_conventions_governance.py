"""
模块职责：守护存储规范与 dataset 设计、doc-governance 引用及 .gitignore 边界保持一致；
守护 ADR 0018 数据根顶层白名单哨兵区与「元数据 JSON 岛禁止 / 虚构约定不复活」规则；
守护 ADR 0019 长期运行时产物哨兵区、仓库根产物落点与备份位退役。
设计关联（DesignRef）：docs/standards/storage-conventions.md
实现状态：Current
被测代码：docs/standards/storage-conventions.md、docs/design/dataset-conventions.md、docs/standards/doc-governance.md、.gitignore、仓库根运行时目录（logs/、tmp/、backups/）
守护面：标准治理
失效后果：存储规则与目录约定漂移，agent 误读写真实数据根；日志与备份散落仓库各处
"""

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STANDARD = ROOT / "docs" / "standards" / "storage-conventions.md"
DATASET_DESIGN = ROOT / "docs" / "design" / "dataset-conventions.md"
DOC_GOVERNANCE = ROOT / "docs" / "standards" / "doc-governance.md"
GITIGNORE = ROOT / ".gitignore"
ADR_0018 = ROOT / "docs" / "adr" / "0018-data-root-whitelist-and-meta-json-ban.md"
ADR_0019 = ROOT / "docs" / "adr" / "0019-runtime-artifact-placement-and-no-long-term-backups.md"

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

ARTIFACT_SENTINEL = re.compile(
    r"<!-- long-term-runtime-artifacts:start -->\n(.*?)<!-- long-term-runtime-artifacts:end -->",
    re.DOTALL,
)
ARTIFACT_ENTRY = re.compile(r"^- `([^`]+)`")

# 仓库根长期运行时产物清单（ADR 0019 决定的机器镜像；扩缩条目须先立 ADR 再改此常量）
LONG_TERM_RUNTIME_ARTIFACTS = {
    "logs/config.log",
    "logs/qed-engine-serve.log",
    "logs/qed-web-serve.log",
    "logs/qed-engine.pid",
    "logs/qed-web.pid",
}

# 运行时产物落点目录（相对仓库根）
RUNTIME_ARTIFACT_DIRS = {"logs", "tmp"}
RUNTIME_ARTIFACT_SUFFIXES = {".log", ".pid"}
# 本守护不越界：子项目仓库、数据根与构建/缓存产物各有各自规则
PRUNED_DIRS = {".git", "dataset", "Axiom-Flow", "QED-Tracker", "node_modules", "__pycache__", "dist"}

# 仓库内已退役的备份位（ADR 0019 第 4 条：快照唯一落点＝数据根 dataset/backups/）
RETIRED_BACKUP_PATHS = ("backups", "backend/database/backups")


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


def test_standard_declares_adr_0019_rules():
    """标准正文必须承载 ADR 0019 五条规则：落点唯一 / 长期清单 / 按实际写入点读取 /
    备份不留长期 / scripts 只留必要面。"""
    content = _standard()
    assert "**落点唯一**" in content
    assert "长期日志清单" in content
    assert "读取按实际写入点" in content
    assert "备份不留长期" in content
    assert "`scripts/` 只留必要面" in content
    assert "0019" in content, "标准须引用 ADR 0019"
    assert ADR_0019.exists()


def test_long_term_runtime_artifact_sentinel_matches_adr_0019():
    """标准长期产物哨兵区必须与 ADR 0019 决定的清单双向一致。"""
    match = ARTIFACT_SENTINEL.search(_standard())
    assert match, "storage-conventions.md 缺少 long-term-runtime-artifacts 哨兵区"
    declared = set()
    for line in match.group(1).splitlines():
        entry = ARTIFACT_ENTRY.match(line.strip())
        if entry:
            declared.add(entry.group(1))
        elif line.strip():
            raise AssertionError(f"长期产物条目格式不合规：{line!r}")
    assert declared == LONG_TERM_RUNTIME_ARTIFACTS, declared ^ LONG_TERM_RUNTIME_ARTIFACTS


def test_runtime_artifacts_only_under_logs_and_tmp():
    """仓库根 `*.log` / `*.pid` 只允许落在 logs/ 或 tmp/（ADR 0019 第 1 条）。"""
    strays: list[str] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in PRUNED_DIRS]
        rel_dir = Path(dirpath).relative_to(ROOT)
        if rel_dir.parts and rel_dir.parts[0] in RUNTIME_ARTIFACT_DIRS:
            continue
        for name in filenames:
            if Path(name).suffix.lower() in RUNTIME_ARTIFACT_SUFFIXES:
                strays.append(str((rel_dir / name).as_posix()))
    assert not strays, f"运行时产物散落在 logs/ 与 tmp/ 之外：{sorted(strays)}"


def _gitignore_rule_paths(content: str) -> set[str]:
    """.gitignore 的**规则行**（注释与空行不计）归一化为相对仓库根的路径集合。"""
    paths: set[str] = set()
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("!"):
            continue
        paths.add(line.strip("/").lstrip("/"))
    return paths


def test_repo_backup_positions_retired():
    """仓库内备份位退役不复活：目录不存在且 .gitignore 不再为其保留规则条目。"""
    content = GITIGNORE.read_text(encoding="utf-8")
    rule_paths = _gitignore_rule_paths(content)
    for rel in RETIRED_BACKUP_PATHS:
        assert not (ROOT / rel).exists(), f"仓库内备份位应已退役：{rel}/"
        assert rel not in rule_paths, f".gitignore 仍为已退役备份位保留条目：{rel}"
