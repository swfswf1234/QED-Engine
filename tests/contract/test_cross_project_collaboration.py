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
    header = f"| {' | '.join(columns)} |"
    start = lines.index(header)
    rows = []
    for line in lines[start + 2:]:
        stripped = line.strip()
        # 分节标题（### 主线分组）、空行、重复表头与分隔行（每分节独立表格）不是任务行，跳过
        if not line.startswith("|"):
            if line.startswith("### ") or not stripped:
                continue
            break
        if stripped == header or stripped.startswith("| ---"):
            continue
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


def test_collaboration_standard_declares_execution_boundary():
    """执行边界条款守护：需求方 agent 在子项目工作区只能读文档与登记任务，不得写代码。

    2026-08-16 亡羊补牢（V2-003 越界事件）：该条款是根仓库侧 agent 执行纪律的事实源，
    缺失会导致跨项目代码越权。
    """
    content = STANDARD.read_text(encoding="utf-8")
    assert "执行边界" in content, "跨项目协作标准必须声明「执行边界」小节"
    assert "合法动作仅限" in content
    for marker in ("用户口头指令不豁免", "subagent 派发合规", "误产生的代码改动"):
        assert marker in content, f"执行边界小节缺少条款：{marker}"


def test_todo_request_rows_track_receipt_progress():
    """请求行的证据/下一条件列必须体现对方承接或回执（推动回执闭环，防请求悬空）。"""
    rows = _todo_rows()
    requests = [row for row in rows if row["类型"] == "请求"]
    assert requests
    for row in requests:
        evidence = row["证据/下一条件"]
        assert TARGET_RE.search(row["任务"]), f"{row['ID']} 任务列缺少「请求：<目标仓库>」标注"
        assert any(marker in evidence for marker in ("承接", "回执", "对方执行", "待开始")), (
            f"{row['ID']} 证据列未体现对方承接/回执状态"
        )
