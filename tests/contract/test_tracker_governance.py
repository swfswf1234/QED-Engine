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
# ADR 0029（台账分层与轮节瘦身）：轮节三段式＝标题只写轮名 → 节下备注段 → 任务表；
# 含主线行的节二选一声明形态；任务描述列只写范围，取证与沿革落壳。
TODO_HEADER = f"| {' | '.join(TODO_COLUMNS)} |"
ROUND_HEADING_MAX_CHARS = 64
ROUND_HEADING_FORBIDDEN = ("——", "；")
TASK_DESC_MAX_CHARS = 500
# 声明的字面形态＝节下备注段里的粗体标记（`**分层轮**`／`**承载轮**`）；正文里提到「默认承载轮」
# 这类词不带粗体，不会被误判成声明。
MODULE_MASTER_MARKER = "总任务"
LAYERED_ROUND = "**分层轮**"
CARRIER_ROUND = "**承载轮**"
LAYERED_ROUND_ROW_BUDGET = 8


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


def _doc_tables(path: Path, columns: tuple[str, ...]) -> list[dict[str, str]]:
    """跨分节扫描同表头的全部表格行：分节标题、空行与**正文段落只作表格分隔**，不作终止。

    ADR 0029 L1 把轮次叙述从 `### ` 标题挪到标题与表头之间的备注段，`_table` 的「首个非表格行
    即终止」口径会从此截断后续分节，故 todo 的行集合改用本扫描器。
    """
    return _doc_tables_lines(path.read_text(encoding="utf-8").splitlines(), columns, strict=True)


def _todo_sections() -> list[tuple[str, str, list[dict[str, str]]]]:
    """按 `### ` 切节，返回 `(节标题, 节下备注段, 该节任务行)`；`#`／`##` 级标题不开节。

    备注段＝标题与任务表头之间的非空正文（分层声明与轮次叙述的落点，ADR 0029 L1／L2）。
    """
    sections: list[tuple[str, list[str]]] = []
    heading = ""
    bucket: list[str] = []
    for line in (TRACKERS / "todo.md").read_text(encoding="utf-8").splitlines():
        if line.startswith("### "):
            if heading:
                sections.append((heading, bucket))
            heading, bucket = line.removeprefix("### ").strip(), []
            continue
        if line.startswith("####"):
            # 块级子分组（ADR 0021「分节标题与承载」）只是节内导航，不切断本节的行集合
            bucket.append(line)
            continue
        if line.startswith("#"):
            if heading:
                sections.append((heading, bucket))
            heading, bucket = "", []
            continue
        if heading:
            bucket.append(line)
    if heading:
        sections.append((heading, bucket))
    out: list[tuple[str, str, list[dict[str, str]]]] = []
    for title, bucket in sections:
        headers = [index for index, line in enumerate(bucket) if line.strip() == TODO_HEADER]
        note = "\n".join(bucket[: headers[0]] if headers else bucket).strip()
        out.append((title, note, _doc_tables_lines(bucket, TODO_COLUMNS)))
    return out


def _doc_tables_lines(
    lines: list[str], columns: tuple[str, ...], *, strict: bool = False
) -> list[dict[str, str]]:
    header = f"| {' | '.join(columns)} |"
    rows: list[dict[str, str]] = []
    in_table = False
    for line in lines:
        stripped = line.strip()
        if stripped == header:
            in_table = True
            continue
        if stripped.startswith("| ---"):
            continue
        if stripped.startswith("#") or not stripped.startswith("|"):
            in_table = False
            continue
        if not in_table:
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) != len(columns):
            assert not strict, line
            continue
        rows.append(dict(zip(columns, cells, strict=True)))
    return rows


def _todo_rows() -> list[dict[str, str]]:
    return _doc_tables(TRACKERS / "todo.md", TODO_COLUMNS)


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


def test_todo_section_view_aggregates_exactly_the_flat_rows():
    """G8 探测器自证：分节视图既不丢行也不增行，且备注段不进任务行集合。

    挪节与 `####` 子分组改的是归属不是集合；`## 规则` 的指针表不是任务表，不得混入。
    """
    flat = [row["ID"] for row in _todo_rows()]
    sectioned = [row["ID"] for _, _, rows in _todo_sections() for row in rows]
    assert sectioned == flat
    assert len({title for title, _, _ in _todo_sections()}) >= 5
    assert all(rows for _, _, rows in _todo_sections()), "出现空任务节的标题"
    assert any(LAYERED_ROUND in note for _, note, _ in _todo_sections()), (
        f"全台账无一分节声明 {LAYERED_ROUND}——主线轮都退化成细则清单，"
        f"G8b 的行预算与 {MODULE_MASTER_MARKER} 标记、G8d 的壳锚都失去对象"
    )


def test_todo_round_headings_carry_no_narrative():
    """G8a（ADR 0029 L1）：`### ` 轮节标题只写轮名——长度受限、不含破折号与分号。

    轮次定位、批次沿革、收口顺序与裁决出处写节下备注段（标题与表头之间的正文）。
    """
    offenders = [
        (title[:24], len(title))
        for title, _, _ in _todo_sections()
        if len(title) > ROUND_HEADING_MAX_CHARS
        or any(token in title for token in ROUND_HEADING_FORBIDDEN)
    ]
    assert not offenders, (
        f"轮节标题超长或承载叙述的节 {offenders}——标题只写轮名（≤{ROUND_HEADING_MAX_CHARS} 字符、"
        f"不出现 {'、'.join(ROUND_HEADING_FORBIDDEN)}），叙述下移到节下备注段"
    )


def test_round_sections_declare_layered_or_carrier_form():
    """G8b（ADR 0029 L2）：含主线行的节必须在节下备注以字面标记二选一声明 `**分层轮**`／`**承载轮**`。

    分层轮只留主线行与模块总任务行（任务描述含「总任务」）且总行数受限；`承载轮` 全台账至多一节
    （默认承载轮＝普通任务轮），细则行一律落它。
    """
    carriers = []
    for title, note, rows in _todo_sections():
        if not any(row["类别"] == "主线" for row in rows):
            continue
        layered = LAYERED_ROUND in note
        carrier = CARRIER_ROUND in note
        assert layered != carrier, (
            f"节「{title[:24]}」含主线行但节下备注未二选一声明 {LAYERED_ROUND}／{CARRIER_ROUND}"
            "——主线轮要么只列模块总任务，要么是指定的默认承载轮"
        )
        if carrier:
            carriers.append(title)
            continue
        unmarked = [
            row["ID"]
            for row in rows
            if row["类别"] != "主线" and MODULE_MASTER_MARKER not in row["任务描述"]
        ]
        assert len(rows) <= LAYERED_ROUND_ROW_BUDGET, (
            f"分层轮节「{title[:24]}」有 {len(rows)} 行，超预算 {LAYERED_ROUND_ROW_BUDGET}"
            f"——细则行挪进默认承载轮（该节行号 {[row['ID'] for row in rows]}）"
        )
        assert not unmarked, (
            f"分层轮节「{title[:24]}」里不是模块总任务的行 {unmarked}——把细则行挪进默认承载轮，"
            f"或把该行改写为该模块的总任务行（任务描述含「{MODULE_MASTER_MARKER}」）"
        )
    assert len(carriers) <= 1, f"声明 {CARRIER_ROUND} 的节多于一节 {carriers}"


def test_todo_task_description_column_is_within_scope_cap():
    """G8c（ADR 0029 L4）：任务描述列只写「做什么＋目标/效果＋锚」，长度受限。

    现网取证数字、文件行号、令文与裁值沿革、代价登记、工作项拆解与逐批门禁输出都不属于行。
    """
    offenders = [
        (row["ID"], len(row["任务描述"]))
        for row in _todo_rows()
        if len(row["任务描述"]) > TASK_DESC_MAX_CHARS
    ]
    assert not offenders, (
        f"任务描述列超 {TASK_DESC_MAX_CHARS} 字符的行 {offenders}——先逐行核对承载壳是否已有该正文，"
        "缺失先回填壳（带日期戳）再瘦身，不得直接删（ADR 0029 L5）"
    )


def test_layered_round_master_rows_anchor_a_plan_shell():
    """G8d（ADR 0029 L3）：分层轮的模块总任务行必须锚一枚 `plans/` 壳。

    原则上整格镜像自己的一枚壳（ADR 0016 一任务一行一壳）；同一滚动壳分线承载多枚总任务时行内链
    该壳并在壳的分线登记表各留条目。细节与过程只有壳这一个落点。
    """
    offenders = [
        (title[:24], row["ID"])
        for title, note, rows in _todo_sections()
        if LAYERED_ROUND in note
        for row in rows
        if row["类别"] != "主线" and "../plans/" not in row["任务描述"]
    ]
    assert not offenders, (
        f"分层轮里无 plans/ 壳锚的总任务行 {offenders}——每枚任务都要对应一枚壳，"
        "细节与过程写进壳（用户 2026-11-03 令 3）"
    )


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
