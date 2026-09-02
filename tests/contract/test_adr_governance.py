"""
模块职责：验证 ADR 编号、元数据、登记表和完整取代关系保持一致。
设计关联（DesignRef）：docs/standards/adr-governance.md
实现状态：Current
被测代码：docs/adr、docs/history/adr/<version>
守护面：ADR 治理
失效后果：ADR 编号、元数据或取代关系漂移，长期决策无法追溯
"""

import re
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ADR_DIR = ROOT / "docs" / "adr"
ADR_HISTORY_DIR = ROOT / "docs" / "history" / "adr"
ADR_INDEX = ADR_DIR / "index.md"
ADR_FILE = re.compile(r"(?P<id>\d{4})-(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)\.md")
ADR_LINK = re.compile(r"\[ADR (?P<id>\d{4})]\((?P<path>[^)]+)\)")
INDEX_ENTRY = re.compile(r"^\| \[`(?P<id>\d{4})`]\((?P<path>[^)]+\.md)\) \|", re.MULTILINE)
VALID_STATUSES = {"Proposed", "Accepted", "Rejected", "Superseded"}
VALID_DOMAINS = {"工程治理", "架构与边界"}
REQUIRED_SECTIONS = ("## 背景", "## 决定", "## 后果", "## 关联")


def _field(content: str, name: str) -> str:
    matches = re.findall(rf"^{re.escape(name)}：(.*)$", content, re.MULTILINE)
    assert len(matches) == 1, f"{name} 必须恰好出现一次"
    return matches[0].strip()


def _records() -> dict[str, dict[str, object]]:
    """收集所有 ADR（当前版本 + 历史版本），记录每个 ADR 的来源路径。"""
    records: dict[str, dict[str, object]] = {}
    # 当前版本
    for path in sorted(ADR_DIR.glob("[0-9][0-9][0-9][0-9]-*.md"), key=lambda p: p.name):
        match = ADR_FILE.fullmatch(path.name)
        assert match, path.name
        adr_id = match.group("id")
        assert adr_id not in records, f"重复 ADR 编号: {adr_id}"
        content = path.read_text(encoding="utf-8")
        records[adr_id] = {
            "path": path,
            "source": "current",
            "content": content,
            "status": _field(content, "状态"),
            "date": _field(content, "日期"),
            "domain": _field(content, "领域"),
            "stage": _field(content, "决策阶段"),
            "supersedes": _field(content, "取代"),
            "superseded_by": _field(content, "被取代"),
        }
    # 历史版本（按版本子目录组织）
    if ADR_HISTORY_DIR.is_dir():
        for version_dir in sorted(ADR_HISTORY_DIR.iterdir()):
            if not version_dir.is_dir():
                continue
            for path in sorted(version_dir.glob("[0-9][0-9][0-9][0-9]-*.md"), key=lambda p: p.name):
                match = ADR_FILE.fullmatch(path.name)
                assert match, path.name
                adr_id = match.group("id")
                assert adr_id not in records, f"重复 ADR 编号: {adr_id}"
                content = path.read_text(encoding="utf-8")
                records[adr_id] = {
                    "path": path,
                    "source": "history",
                    "version": version_dir.name,
                    "content": content,
                    "status": _field(content, "状态"),
                    "date": _field(content, "日期"),
                    "domain": _field(content, "领域"),
                    "stage": _field(content, "决策阶段"),
                    "supersedes": _field(content, "取代"),
                    "superseded_by": _field(content, "被取代"),
                }
    return records


def _current_records() -> dict[str, dict[str, object]]:
    """仅当前版本 ADR（docs/adr/ 中的文件）。"""
    return {k: v for k, v in _records().items() if v["source"] == "current"}


def _relation_ids(value: object) -> set[str]:
    text = str(value)
    if text == "—":
        return set()
    links = list(ADR_LINK.finditer(text))
    assert links, f"非法 ADR 关系：{text}"
    return {match.group("id") for match in links}


def test_adr_files_use_stable_global_ids_and_complete_metadata():
    """验证 ADR 全局编号唯一、元数据完整、路径符合版本化规则。"""
    assert not [path for path in ADR_DIR.iterdir() if path.is_dir()], \
        "docs/adr/ 不得包含子目录"
    records = _records()
    assert records

    for adr_id, record in records.items():
        record_path = Path(record["path"])
        content = str(record["content"])
        assert content.startswith(f"# ADR {adr_id}：")
        assert record["status"] in VALID_STATUSES
        date.fromisoformat(str(record["date"]))
        assert record["domain"] in VALID_DOMAINS
        assert re.fullmatch(r"v\d+\.\d+", str(record["stage"]))
        metadata_fields = ("状态", "日期", "领域", "决策阶段", "取代", "被取代")
        positions = [content.index(f"{name}：") for name in metadata_fields]
        assert positions == sorted(positions)
        for relation in (record["supersedes"], record["superseded_by"]):
            for match in ADR_LINK.finditer(str(relation)):
                target = records.get(match.group("id"))
                assert target is not None, \
                    f"ADR {adr_id} 引用了不存在的 ADR {match.group('id')}"
                relation_path = (record_path.parent / match.group("path")).resolve()
                assert relation_path == Path(target["path"]).resolve(), \
                    f"ADR {adr_id} 中的关系链接路径不正确"

        # 路径规则：当前版本在 docs/adr/，历史版本在 history/adr/<version>/
        if record["source"] == "current":
            assert record_path.parent == ADR_DIR, \
                f"当前版本 ADR {adr_id} 不在 docs/adr/ 中"
        else:
            assert record_path.parent.parent == ADR_HISTORY_DIR, \
                f"历史 ADR {adr_id} 不在 history/adr/<version>/ 中"
            assert record_path.parent.name.startswith("v"), \
                f"历史 ADR {adr_id} 的版本目录名不以 v 开头"


def test_adr_index_registers_current_version_files_only():
    """ADR index 只登记当前版本（docs/adr/）的 ADR，不包含历史版本。"""
    current = _current_records()
    content = ADR_INDEX.read_text(encoding="utf-8")
    entries = [(match.group("id"), match.group("path")) for match in INDEX_ENTRY.finditer(content)]

    if current:
        # index 中的 ADR 必须全部在当前版本中
        index_ids = [adr_id for adr_id, _ in entries]
        assert Counter(index_ids) == Counter(current.keys()), \
            "index 登记的 ADR 与 docs/adr/ 中的文件不一致"
        assert index_ids == sorted(current), \
            "index 登记顺序与编号排序不一致"

        for adr_id, relative_path in entries:
            index_path = (ADR_INDEX.parent / relative_path).resolve()
            assert index_path == Path(current[adr_id]["path"]).resolve(), \
                f"index 中 ADR {adr_id} 的链接路径不正确"

        for line in content.splitlines():
            match = INDEX_ENTRY.match(line)
            if not match:
                continue
            adr_id = match.group("id")
            record = current[adr_id]
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            assert len(cells) == 6
            title = str(record["content"]).splitlines()[0].split("：", 1)[1]
            assert cells[1:5] == [title, record["domain"], record["stage"], record["status"]]
            supersedes = sorted(_relation_ids(record["supersedes"]))
            superseded_by = sorted(_relation_ids(record["superseded_by"]))
            expected_relation = "—"
            if supersedes:
                expected_relation = f"取代 {', '.join(supersedes)}"
            elif superseded_by:
                expected_relation = f"被 {', '.join(superseded_by)} 取代"
            assert cells[5] == expected_relation

        next_id = f"{max(map(int, current)) + 1:04d}"
        assert f"下一个可用编号：{next_id}" in content
    else:
        # 当前版本无 ADR（新版本起始），index 应声明下一个可用编号 0001
        assert "下一个可用编号：0001" in content, \
            "当前版本无 ADR 时，index 应声明下一个可用编号为 0001"


def test_complete_supersession_is_bidirectional():
    """完整取代关系必须双向登记（包括跨版本取代）。"""
    records = _records()
    for adr_id, record in records.items():
        supersedes = _relation_ids(record["supersedes"])
        superseded_by = _relation_ids(record["superseded_by"])
        assert adr_id not in supersedes | superseded_by

        if supersedes:
            assert record["status"] == "Accepted"
        for old_id in supersedes:
            assert records[old_id]["status"] == "Superseded", \
                f"ADR {adr_id} 取代了 {old_id}，但 {old_id} 状态不是 Superseded"
            assert adr_id in _relation_ids(records[old_id]["superseded_by"]), \
                f"ADR {old_id} 缺少对 {adr_id} 的反向被取代登记"

        if record["status"] == "Superseded":
            # Superseded ADR 应有被取代登记，但版本归档清理（全部同时变为 Superseded）除外
            pass
        else:
            assert not superseded_by, \
                f"ADR {adr_id} 状态为 {record['status']} 但有被取代登记"
        for new_id in superseded_by:
            assert records[new_id]["status"] == "Accepted", \
                f"ADR {new_id} 取代了 {adr_id}，但状态不是 Accepted"
            assert adr_id in _relation_ids(records[new_id]["supersedes"]), \
                f"ADR {new_id} 缺少对 {adr_id} 的反向取代登记"


def test_all_adrs_have_required_sections_in_order():
    """所有 ADR 必须包含规定章节且顺序正确。"""
    for adr_id, record in _records().items():
        content = str(record["content"])
        positions = [content.index(section) for section in REQUIRED_SECTIONS]
        assert positions == sorted(positions), \
            f"ADR {adr_id} 的章节顺序不正确"


def test_adr_index_contains_no_rule_body():
    """ADR index 只导航，不保存正文事实。"""
    content = ADR_INDEX.read_text(encoding="utf-8")
    assert "## 规则" not in content, "ADR index 只导航，不保存正文事实（见 doc-governance.md）"
