"""
模块职责：验证任务 ID、活跃计划镜像、关闭证据和无状态路线图保持一致。
设计关联（DesignRef）：docs/standards/task-lifecycle.md
实现状态：Current
被测代码：docs/trackers、docs/plans
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRACKERS = ROOT / "docs" / "trackers"
PLANS = ROOT / "docs" / "plans"
TASK_ID = re.compile(r"[A-Z][A-Z0-9]*-\d{3}")
PLAN_LINK = re.compile(r"^\[(?P<title>[^]]+)]\(\.\./plans/(?P<path>[^)]+\.md)\)$")
ACTIVE_STATUSES = {"Accepted", "In Progress", "Blocked"}


def _table(path: Path, columns: tuple[str, ...]) -> list[dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    header = f"| {' | '.join(columns)} |"
    start = lines.index(header)
    rows = []
    for line in lines[start + 2 :]:
        if not line.startswith("|"):
            break
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        assert len(cells) == len(columns), line
        rows.append(dict(zip(columns, cells, strict=True)))
    return rows


def _field(content: str, name: str) -> str:
    matches = re.findall(rf"^{re.escape(name)}：(.*)$", content, re.MULTILINE)
    assert len(matches) == 1, f"{name} 必须恰好出现一次"
    return matches[0].strip()


def _todo_rows() -> list[dict[str, str]]:
    return _table(
        TRACKERS / "todo.md",
        ("ID", "类型", "优先级", "状态", "任务", "证据/下一条件"),
    )


def test_tracker_directory_has_exact_governed_files_and_index_links():
    assert {path.name for path in TRACKERS.glob("*.md")} == {
        "index.md",
        "roadmap.md",
        "todo.md",
    }
    index = (TRACKERS / "index.md").read_text(encoding="utf-8")
    for filename in ("roadmap.md", "todo.md"):
        assert f"]({filename})" in index


def test_task_ids_are_stable_unique_and_rows_are_complete():
    todo = _todo_rows()
    ids = [row["ID"] for row in todo]

    assert ids
    assert all(TASK_ID.fullmatch(task_id) for task_id in ids)
    assert len(ids) == len(set(ids))
    assert all(all(row.values()) for row in todo)


def test_todo_plan_rows_exactly_mirror_active_plan_bodies():
    plan_rows = {}
    for row in _todo_rows():
        if row["类型"] != "Plan":
            continue
        link = PLAN_LINK.fullmatch(row["任务"])
        assert link, row["ID"]
        assert link.group("path") not in plan_rows
        plan_rows[link.group("path")] = (row, link.group("title"))

    plan_files = {path.name: path for path in PLANS.glob("*.md") if path.name != "index.md"}
    assert set(plan_rows) == set(plan_files)
    for filename, path in plan_files.items():
        content = path.read_text(encoding="utf-8")
        row, linked_title = plan_rows[filename]
        assert linked_title == content.splitlines()[0].removeprefix("# ")
        assert row["状态"] == _field(content, "状态")
        assert row["状态"] in ACTIVE_STATUSES
        tracker = _field(content, "关联 Tracker")
        assert "docs/trackers/todo.md" in tracker
        assert row["ID"] in tracker


def test_roadmap_is_status_free_and_references_registered_tasks():
    roadmap = TRACKERS / "roadmap.md"
    columns = ("方向", "能力目标", "关联任务")
    rows = _table(roadmap, columns)
    registered = {row["ID"] for row in _todo_rows()}

    assert rows
    assert "| 状态 |" not in roadmap.read_text(encoding="utf-8")
    for row in rows:
        task_ids = TASK_ID.findall(row["关联任务"])
        assert task_ids, row["方向"]
        assert set(task_ids) <= registered
