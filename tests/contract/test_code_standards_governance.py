"""
模块职责：守护代码规范与工具配置（ruff / tsconfig）及 AGENTS 强制约束保持一致。
设计关联（DesignRef）：docs/standards/code-standards.md
实现状态：Current
被测代码：docs/standards/code-standards.md、pyproject.toml、web-ui/tsconfig.app.json、AGENTS.md
守护面：标准治理
失效后果：代码规范与工具配置漂移，agent 按标准实现却过不了门禁
"""

import json
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STANDARD = ROOT / "docs" / "standards" / "code-standards.md"
PYPROJECT = ROOT / "pyproject.toml"
TSCONFIG = ROOT / "web-ui" / "tsconfig.app.json"
AGENTS = ROOT / "AGENTS.md"

RUFF_SELECT = {"E", "F", "I", "B", "UP"}
TSCONFIG_OPTIONS = (
    "strict",
    "noUnusedLocals",
    "noUnusedParameters",
    "noFallthroughCasesInSwitch",
    "noUncheckedSideEffectImports",
)
BOUNDARY_KEYWORDS = ("来源适配器", "TLS", "密钥", "数据根", "唯一入口")


def _standard() -> str:
    return STANDARD.read_text(encoding="utf-8")


def test_ruff_config_matches_standard():
    ruff = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))["tool"]["ruff"]
    assert ruff["target-version"] == "py312"
    assert ruff["line-length"] == 120
    assert set(ruff["lint"]["select"]) == RUFF_SELECT
    content = _standard()
    assert 'target-version = "py312"' in content
    assert "line-length = 120" in content
    for rule in sorted(RUFF_SELECT):
        assert f'"{rule}"' in content, rule


def test_tsconfig_strict_options_match_standard():
    options = json.loads(TSCONFIG.read_text(encoding="utf-8"))["compilerOptions"]
    content = _standard()
    for option in TSCONFIG_OPTIONS:
        assert options.get(option) is True, option
        assert option in content, option


def test_standard_states_boundaries_and_single_source_links():
    content = _standard()
    for keyword in BOUNDARY_KEYWORDS:
        assert keyword in content, keyword
    for reference in (
        "code-document-traceability.md",
        "testing.md",
        "storage-conventions.md",
        "../guides/development.md",
    ):
        assert reference in content, reference


def test_agents_forced_constraints_cover_standard_boundaries():
    content = AGENTS.read_text(encoding="utf-8")
    assert "## 强制约束" in content
    for keyword in BOUNDARY_KEYWORDS:
        assert keyword in content, keyword
