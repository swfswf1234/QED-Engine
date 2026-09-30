"""
模块职责：验证任务 ID、活跃计划镜像、收口纪律（状态枚举·成功标准列·文档锚·节归属）和关闭证据、无状态路线图保持一致。
设计关联（DesignRef）：docs/standards/task-lifecycle.md
实现状态：Current
被测代码：docs/trackers、docs/plans
守护面：计划与任务治理
失效后果：任务 ID、计划镜像或 roadmap 漂移，终态行滞留 todo、执行进展混进成功标准列、无锚行与已关闭轮次残留节无人发现，任务状态失真
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRACKERS = ROOT / "docs" / "trackers"
PLANS = ROOT / "docs" / "plans"
TASK_ID = re.compile(r"[A-Z][A-Z0-9]*-[A-Z0-9]{3}(?:-[A-Z][A-Z0-9]*)?")
# 任务描述列计划链接（ADR 0016 一任务一行一壳）：链接后允许「——」追加一句话任务定义/
# 目标效果（不得含方括号与竖线），链接与描述均不改变标题/状态镜像校验口径。
PLAN_LINK = re.compile(
    r"^\[(?P<title>[^]]+)]\(\.\./plans/(?P<path>[^)]+\.md)\)(?:\s*——\s*(?P<note>[^|\[\]]*))?$"
)
ACTIVE_STATUSES = {"Accepted", "In Progress", "Blocked"}
# ADR 0020（部分补充 ADR 0016）：todo 状态列只允许**进行中态**枚举——终态（已关闭/已完成/
# 已实施/已达成/Completed 等）表示任务已终止，必须原子移出 todo 写入 completed.md。
# 中文简化视图（待开始/进行中/待验收）与计划状态机英文值（Accepted/In Progress/Blocked）并存，
# 带 plans 链接的行仍由镜像规则约束为 ACTIVE_STATUSES。
TODO_OPEN_STATUSES = {"待开始", "进行中", "待验收", "Accepted", "In Progress", "Blocked"}
# ADR 0023：台账行只承载「任务描述 + 成功标准」两样关键事实，证据与逐日进展落 plans/ 壳。
# 成功标准列是**固定验收判据**——立项时写定、S 编号条目化、不随执行改写，故禁止出现日期戳与
# 进展词（那些属于壳的过程记录）。长期行的 S 条目是滚动复核判据，不触发关闭。
TODO_COLUMNS = ("ID", "类别", "优先级", "状态", "任务描述", "成功标准")
SUCCESS_CRITERIA_MAX_CHARS = 400
SUCCESS_CRITERIA_FIRST_ITEM = re.compile(r"S1(?![0-9])")
PROCESS_NARRATIVE = re.compile(
    r"已(?:收口|实施|修复|完成|关闭|落地|达成)|\d{4}-\d{2}-\d{2}|待提交"
)
# 长期滚动壳的无终态声明（ADR 0020）：只有 类别=长期 的任务行镜像的壳可以声明。
LONGTERM_MARKER = "长期滚动：无终态"
# 文档锚（ADR 0021）：任务描述列必须链接承载该行的仓库内文档（plans/ 壳或其他 docs 文档）。
# 镜像测试只认「整格＝plans 链接」的唯一镜像行，其余行用行内链接取锚不受镜像约束。
DOC_LINK = re.compile(r"\]\(([^)\s]+\.md)\)")


def _table(path: Path, columns: tuple[str, ...]) -> list[dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    header = f"| {' | '.join(columns)} |"
    start = lines.index(header)
    rows = []
    for line in lines[start + 2 :]:
        stripped = line.strip()
        # 分节标题（### 主线分组 / #### 块级子分组）、空行、重复表头与分隔行（每分节独立
        # 表格）不是任务行，跳过；startswith("###") 同时覆盖 ### 与 #### 两级分节
        if not line.startswith("|"):
            if line.startswith("###") or not stripped:
                continue
            break
        if stripped == header or stripped.startswith("| ---"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        assert len(cells) == len(columns), line
        rows.append(dict(zip(columns, cells, strict=True)))
    return rows


def _field(content: str, name: str) -> str:
    matches = re.findall(rf"^{re.escape(name)}：(.*)$", content, re.MULTILINE)
    assert len(matches) == 1, f"{name} 必须恰好出现一次"
    return matches[0].strip()


def _todo_rows() -> list[dict[str, str]]:
    return _table(TRACKERS / "todo.md", TODO_COLUMNS)


def test_tracker_directory_has_exact_governed_files_and_index_links():
    # completed.md 为按需创建的关闭台账（见 task-lifecycle 终态规则）；project-status.md
    # 为实时状态快照（ADR 0010 移入，见 doc-governance.md），其余文件必须齐全
    names = {path.name for path in TRACKERS.glob("*.md")}
    assert names <= {"index.md", "roadmap.md", "todo.md", "completed.md", "project-status.md"}
    assert {"index.md", "roadmap.md", "todo.md"} <= names
    index = (TRACKERS / "index.md").read_text(encoding="utf-8")
    for filename in ("roadmap.md", "todo.md", "project-status.md"):
        assert f"]({filename})" in index


def test_completed_log_rows_reference_closed_tasks():
    completed = TRACKERS / "completed.md"
    if not completed.exists():
        return
    rows = _table(completed, ("ID", "类型", "任务", "关闭结果", "证据"))
    assert rows
    ids = [row["ID"] for row in rows]
    assert all(TASK_ID.fullmatch(task_id) for task_id in ids)
    assert len(ids) == len(set(ids))
    assert all(row["关闭结果"] in {"Achieved", "Rejected", "Partial", "Not Applicable"} for row in rows)
    assert all(all(row.values()) for row in rows)


def test_task_ids_are_stable_unique_and_rows_are_complete():
    todo = _todo_rows()
    ids = [row["ID"] for row in todo]

    assert ids
    assert all(TASK_ID.fullmatch(task_id) for task_id in ids)
    assert len(ids) == len(set(ids))
    assert all(all(row.values()) for row in todo)


def test_task_categories_follow_hierarchy_enum():
    """类别列只允许 主线/支线/长期，且主线/长期必须存在（大类与持续任务不缺位）。"""
    rows = _todo_rows()
    categories = {row["类别"] for row in rows}
    assert categories <= {"主线", "支线", "长期"}
    assert "主线" in categories
    assert "长期" in categories


def test_todo_plan_rows_exactly_mirror_active_plan_bodies():
    plan_rows = {}
    for row in _todo_rows():
        link = PLAN_LINK.fullmatch(row["任务描述"])
        if not link:
            continue
        assert link.group("path") not in plan_rows
        plan_rows[link.group("path")] = (row, link.group("title"))

    # 长期滚动收件箱（REQ-062）与设计类小修/bug 台账（REQ-069/ADR 0012）不属计划，
    # 不参与 todo Plan 行镜像（豁免清单与理由见 test_plan_governance.STANDING_DOCS）
    standing = {"ai-agent-knowledge-inbox.md", "design-bugfix-log.md"}
    plan_files = {
        path.name: path
        for path in PLANS.glob("*.md")
        if path.name != "index.md" and path.name not in standing
    }
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


def test_todo_status_column_uses_open_status_enum_only():
    """G1（ADR 0020）：状态列只允许进行中态；终态词必须移出 todo 写入 completed.md。"""
    for row in _todo_rows():
        assert row["状态"] in TODO_OPEN_STATUSES, (
            f"{row['ID']} 状态列 {row['状态']!r} 不在进行中态枚举 "
            f"{sorted(TODO_OPEN_STATUSES)}——已达终态请写 completed.md 并从 todo 移除该行"
        )


def test_todo_success_criteria_column_is_fixed_and_bounded():
    """G2（ADR 0020 上限 + ADR 0023 验收判据列）：成功标准列必须 S 编号条目化、不承载执行进展、
    长度受限——固定判据写在行里，逐日证据与下一条件写进 plans/ 壳的「过程与证据」节。"""
    rows = _todo_rows()
    unnumbered = [row["ID"] for row in rows
                  if not SUCCESS_CRITERIA_FIRST_ITEM.search(row["成功标准"])]
    narrated = [row["ID"] for row in rows if PROCESS_NARRATIVE.search(row["成功标准"])]
    oversized = [(row["ID"], len(row["成功标准"])) for row in rows
                 if len(row["成功标准"]) > SUCCESS_CRITERIA_MAX_CHARS]
    assert not unnumbered, (
        f"成功标准列未以 S1 起始编号条目化的行 {unnumbered}——验收判据须逐条可对照（ADR 0023）"
    )
    assert not narrated, (
        f"成功标准列写进了执行进展或日期戳的行 {narrated}——进展与证据落 plans/ 壳"
        "「过程与证据」节，行内判据立项后不改写（ADR 0023）"
    )
    assert not oversized, (
        f"成功标准列超过 {SUCCESS_CRITERIA_MAX_CHARS} 字符的行 {oversized}——"
        "判据写不短说明范围没定清，拆行或落壳"
    )


def test_success_criteria_progress_detector_flags_narrative_not_criteria():
    """探测器自证：验收判据文本放行，把进展或日期写进判据列的文本必红。"""
    assert not PROCESS_NARRATIVE.search("S1 重启后按 session_id 取回会话；S2 契约全绿")
    for narrative in ("S1 已实施（2026-09-30）", "S1 待提交后补登 hash", "S1 已收口"):
        assert PROCESS_NARRATIVE.search(narrative), narrative
    assert SUCCESS_CRITERIA_FIRST_ITEM.search("S1 首条判据")
    assert not SUCCESS_CRITERIA_FIRST_ITEM.search("S10 第十条判据")
    assert not SUCCESS_CRITERIA_FIRST_ITEM.search("见壳 S2 起的判据清单")


def test_longterm_rolling_shells_are_mirrored_only_by_longterm_rows():
    """无终态声明（LONGTERM_MARKER）只允许 类别=长期 的任务行镜像的壳使用（ADR 0020）。"""
    for row in _todo_rows():
        link = PLAN_LINK.fullmatch(row["任务描述"])
        if not link:
            continue
        path = PLANS / f"{link.group('path')}.md"
        if not path.exists():
            continue
        if LONGTERM_MARKER in path.read_text(encoding="utf-8"):
            assert row["类别"] == "长期", (
                f"{row['ID']} 镜像的壳声明「{LONGTERM_MARKER}」但类别为 {row['类别']}"
            )


def test_todo_task_rows_carry_a_document_anchor():
    """G5（ADR 0021）：每行任务描述列必须链接一个仓库内文档（活跃壳或其他 docs 文档）——
    过程、边界与细节留在被链文档，todo 不承载叙述。链接文件必须存在。"""
    offenders = []
    dead_links = []
    for row in _todo_rows():
        hrefs = DOC_LINK.findall(row["任务描述"])
        if not hrefs:
            offenders.append(row["ID"])
        for href in hrefs:
            target = (TRACKERS / href).resolve()
            if not target.exists():
                dead_links.append((row["ID"], href))
    assert not offenders, (
        f"任务描述列无任何文档锚的行 {offenders}——按 ADR 0021 每行须链接承载它的"
        " plans/ 壳或其他事实源文档（缺陷/待开始条目可链承载轮壳的登记表条目）"
    )
    assert not dead_links, f"文档锚指向不存在文件的行 {dead_links}"


def test_todo_section_headings_point_at_live_rounds_or_generic_sections():
    """G6（ADR 0021）：分节标题出现的任务 ID 必须是台账活跃行——轮次已关闭而其节残留
    （或残留支线仍挂在已归档轮名下）即红，须把该节条目并入承载轮或长期任务节。"""
    registered = {row["ID"] for row in _todo_rows()}
    lines = (TRACKERS / "todo.md").read_text(encoding="utf-8").splitlines()
    stale = []
    for line in lines:
        if not line.startswith("### "):
            continue
        for task_id in TASK_ID.findall(line):
            if task_id not in registered:
                stale.append((line.removeprefix("### ").strip(), task_id))
    assert not stale, (
        f"分节标题引用了非活跃任务 ID 的节 {stale}——已关闭轮次不留节，"
        "其残留支线按 ADR 0021 并入普通任务轮或长期任务节"
    )
