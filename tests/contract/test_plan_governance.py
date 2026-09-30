"""
模块职责：验证活跃计划的命名、元数据、生命周期状态、达成即收及计划索引边界保持一致。
设计关联（DesignRef）：docs/standards/task-lifecycle.md
实现状态：Current
被测代码：docs/plans
守护面：计划与任务治理
失效后果：计划命名、元数据或生命周期漂移，工作项全部达成的壳长期挂在活跃状态无人关闭
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLANS = ROOT / "docs" / "plans"
PLAN_INDEX = PLANS / "index.md"
PLAN_FILE = re.compile(r"\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md")
# 长期滚动文档豁免（REQ-062，2026-08-26 用户裁决；REQ-069/ADR 0012，2026-09-10 增补）：
# 收件箱与设计类小修/bug 台账常驻 plans/ 但不是计划——不适用计划命名/元数据/todo 镜像治理，
# 也不随任务归档；定位声明与例外依据见各自头部。
STANDING_DOCS = {"ai-agent-knowledge-inbox.md", "design-bugfix-log.md"}
ACTIVE_STATUSES = {"Accepted", "In Progress", "Blocked"}
TASK_TYPES = {"A", "B", "C", "D"}
REQUIRED_FIELDS = (
    "状态",
    "任务类型",
    "最后更新",
    "关联 ADR",
    "关联设计",
    "关联 Tracker",
    "归档判定",
)
REQUIRED_SECTIONS = (
    "## 目标与成功标准",
    "## 范围与非目标",
    "## 前置条件",
    "## 工作项",
    "## 过程与证据",
    "## 验证与验收",
    "## 回滚",
    "## 关闭与归档",
)


def _field(content: str, name: str) -> str:
    matches = re.findall(rf"^{re.escape(name)}：(.*)$", content, re.MULTILINE)
    assert len(matches) == 1, f"{name} 必须恰好出现一次"
    return matches[0].strip()


def _active_plans() -> dict[str, dict[str, str]]:
    plans = {}
    for path in sorted(PLANS.glob("*.md")):
        if path.name == "index.md" or path.name in STANDING_DOCS:
            continue
        assert PLAN_FILE.fullmatch(path.name), path.name
        content = path.read_text(encoding="utf-8")
        plans[path.name] = {
            "title": content.splitlines()[0].removeprefix("# "),
            "status": _field(content, "状态"),
            "type": _field(content, "任务类型"),
            "content": content,
        }
    return plans


def test_active_plans_have_complete_metadata_and_sections():
    for filename, plan in _active_plans().items():
        content = plan["content"]
        for field in REQUIRED_FIELDS:
            _field(content, field)
        assert plan["status"] in ACTIVE_STATUSES, filename
        assert plan["type"] in TASK_TYPES, filename
        for section in REQUIRED_SECTIONS:
            assert section in content, f"{filename}: 缺少 {section}"


def test_blocked_plans_declare_evidence_and_recovery_contract():
    for filename, plan in _active_plans().items():
        content = plan["content"]
        if plan["status"] == "Blocked":
            assert "## 阻塞与恢复" in content, filename
            for required in ("阻塞证据：", "恢复条件：", "责任位置：", "复核触发点："):
                assert required in content, f"{filename}: 缺少 {required}"
        else:
            assert "## 阻塞与恢复" not in content, filename


def test_plan_index_is_navigation_only_and_routes_status_to_todo():
    index = PLAN_INDEX.read_text(encoding="utf-8")
    assert "../trackers/todo.md" in index
    assert "| 状态 |" not in index
    for filename in _active_plans():
        assert filename not in index


# ADR 0020「达成即收」：活跃壳的工作项全部达成而状态仍为进行中，即为应关闭未关闭。
# 长期滚动壳（无终态）以 LONGTERM_MARKER 声明豁免，且只允许 类别=长期 的任务行镜像
# （见 test_tracker_governance.test_longterm_rolling_shells_are_mirrored_only_by_longterm_rows）。
LONGTERM_MARKER = "长期滚动：无终态"
SETTLED_PATTERN = re.compile(r"已(?:收口|实施|修复|完成|关闭|落地|达成)|达成")
OPEN_PATTERN = re.compile(r"未(?:开始|实施|落地|收口|完成)|待|部分|后置|移交|阻塞|滚动|降级|—")


def _work_item_status_cells(content: str) -> list[str]:
    """取「## 工作项」节内各表格的状态列（末列），跳过表头、分隔行与非任务行。"""
    section = re.search(r"^## 工作项[^\n]*\n(.*?)(?=^## |\Z)", content, re.MULTILINE | re.DOTALL)
    if not section:
        return []
    cells: list[str] = []
    for line in section.group(1).splitlines():
        if not line.startswith("|"):
            continue
        row_cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(row_cells) < 2:
            continue
        if row_cells[-1] in {"状态", "状态与证据", "状态（含证据）"} or set(row_cells[-1]) <= {"-", ":", " "}:
            continue
        cells.append(row_cells[-1])
    return cells


def _all_work_items_settled(content: str) -> bool:
    cells = _work_item_status_cells(content)
    if not cells:
        return False
    return all(
        SETTLED_PATTERN.search(cell) and not OPEN_PATTERN.search(cell) for cell in cells
    )


def test_active_plans_close_once_every_work_item_is_settled():
    """G3（ADR 0020 达成即收）：工作项全部达成的活跃壳必须转为终态，不得长期 In Progress。"""
    for filename, plan in _active_plans().items():
        content = plan["content"]
        if LONGTERM_MARKER in content:
            continue
        if not _all_work_items_settled(content):
            continue
        raise AssertionError(
            f"{filename}: 「## 工作项」全部条目已达成，状态仍为 {plan['status']}"
            "——按 ADR 0020 达成即收：关闭计划（终态 + 关闭结果）并同步 todo/completed.md"
        )


def test_settled_work_item_detector_flags_settled_and_open_shells():
    """守护有效性自证：探测器必须在「全达成」样本上判真、在混合/占位/未收口样本上判假。"""
    settled = "## 工作项\n\n| 条目 | 内容 | 状态 |\n| --- | --- | --- |\n| W1 | a | **已实施 2026-09-29** |\n| W2 | b | 已完成（门禁绿） |\n\n## 回滚\n"
    assert _all_work_items_settled(settled)

    mixed = settled.replace("已完成（门禁绿）", "未开始（待排期）")
    assert not _all_work_items_settled(mixed)

    placeholder = "## 工作项\n\n| 条目 | 内容 | 状态 |\n| --- | --- | --- |\n| （待登记） | — | — |\n\n## 回滚\n"
    assert not _all_work_items_settled(placeholder)

    residual = settled.replace("已完成（门禁绿）", "移交支线行（待对方回执）")
    assert not _all_work_items_settled(residual)


# ADR 0023 过程落壳：执行进展、取证细节与裁决记录一律追加在壳的「## 过程与证据」节，
# todo 行只留固定验收判据，因此该节必须真实承载带日期戳的记录而不是空壳。
PROCESS_SECTION = re.compile(
    r"^## 过程与证据[^\n]*\n(.*?)(?=^## |\Z)", re.MULTILINE | re.DOTALL
)
DATE_STAMP = re.compile(r"\d{4}-\d{2}-\d{2}")


def test_active_plans_carry_a_dated_process_log_section():
    """G7（ADR 0023）：活跃壳的「## 过程与证据」节必须存在且至少有一条日期戳记录。"""
    offenders = []
    for filename, plan in _active_plans().items():
        section = PROCESS_SECTION.search(plan["content"])
        if section is None:
            offenders.append((filename, "缺节"))
        elif not DATE_STAMP.search(section.group(1)):
            offenders.append((filename, "空节"))
    assert not offenders, (
        f"过程与证据节缺失或无日期戳记录的壳 {offenders}——按 ADR 0023 进展只在壳追加，"
        "台账行的成功标准列不承载过程，无处落笔的过程就会散布多点"
    )


def test_process_log_detector_flags_dated_and_empty_sections():
    """守护有效性自证：带日期戳的记录放行，空节与无日期节判假。"""
    assert DATE_STAMP.search(PROCESS_SECTION.search(
        "## 过程与证据\n\n- **2026-09-30**：门禁 79 passed。\n\n## 回滚\n"
    ).group(1))
    assert not PROCESS_SECTION.search("## 工作项\n\n| W1 | a | b |\n")
    assert not DATE_STAMP.search(PROCESS_SECTION.search(
        "## 过程与证据\n\n（尚无记录）\n\n## 回滚\n"
    ).group(1))
