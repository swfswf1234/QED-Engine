"""
模块职责：守护跨项目协作流程的登记格式与边界：子项目独立 git、根仓库不越权修改、
todo 请求行标注目标仓库、设计文档模板字段齐全。
设计关联（DesignRef）：docs/standards/cross-project-collaboration.md
实现状态：Current
被测代码：docs/trackers/todo.md、.gitignore、docs/standards/cross-project-collaboration.md
守护面：跨项目协作
失效后果：跨项目协作登记或边界失控，根仓库越权修改风险
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TODO = ROOT / "docs" / "trackers" / "todo.md"
GITIGNORE = ROOT / ".gitignore"
STANDARD = ROOT / "docs" / "standards" / "cross-project-collaboration.md"
SUB_PROJECTS = ("Axiom-Flow", "QED-Tracker")
TARGET_RE = re.compile(r"请求：\s*([A-Za-z-]+)")
TEMPLATE_FIELDS = ("需求方", "目标项目", "接口面", "评审方", "执行方", "验收标准")


def _todo_rows() -> list[dict[str, str]]:
    columns = ("ID", "类别", "类型", "优先级", "状态", "任务", "证据/下一条件")
    lines = TODO.read_text(encoding="utf-8").splitlines()
    start = lines.index(f"| {' | '.join(columns)} |") + 2
    rows = []
    for line in lines[start:]:
        if not line.startswith("|"):
            break
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        assert len(cells) == len(columns), line
        rows.append(dict(zip(columns, cells, strict=True)))
    return rows


def test_sub_projects_are_isolated_git_repositories():
    for name in SUB_PROJECTS:
        assert (ROOT / name / ".git").exists(), f"{name} 应为独立 git 仓库"


def test_gitignore_keeps_sub_projects_out_of_root_index():
    ignored = GITIGNORE.read_text(encoding="utf-8")
    for name in SUB_PROJECTS:
        assert f"/{name}/" in ignored


def test_todo_request_rows_annotate_target_project():
    rows = _todo_rows()
    requests = [row for row in rows if row["类型"] == "请求"]
    assert requests
    for row in requests:
        match = TARGET_RE.search(row["任务"])
        assert match, f"{row['ID']} 任务列缺少「请求：<目标仓库>」标注"
        assert match.group(1) in SUB_PROJECTS, row["ID"]


def test_collaboration_standard_declares_template_fields():
    content = STANDARD.read_text(encoding="utf-8")
    for step in ("发起", "评审", "执行", "验收回执"):
        assert f"{step}" in content
    for field in TEMPLATE_FIELDS:
        assert field in content, f"设计文档模板缺少字段：{field}"
