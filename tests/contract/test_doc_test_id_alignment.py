"""
模块职责：验证 task-lifecycle.md 中文档化的 TASK_ID 正则与契约测试中实际执行的正则一致，防止 doc/test 漂移。
设计关联（DesignRef）：docs/standards/task-lifecycle.md
实现状态：Current
被测代码：docs/standards/task-lifecycle.md（正则声明）
守护面：文档与测试一致性
失效后果：文档正则与测试正则再次漂移，导致新 ID 格式在一边通过、另一边拒绝
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TASK_LIFECYCLE = ROOT / "docs" / "standards" / "task-lifecycle.md"

# 与 test_tracker_governance.py TASK_ID 保持一致的期望值
EXPECTED_TASK_ID = r"[A-Z][A-Z0-9]*-[A-Z0-9]{3}(?:-[A-Z][A-Z0-9]*)?"

# 从 task-lifecycle.md 提取正则的模式
_DOC_REGEX = re.compile(r"正则 `([^`]+)`")


def _extract_doc_regex() -> str | None:
    """从 task-lifecycle.md 的 ID 行提取 TASK_ID 正则。"""
    text = TASK_LIFECYCLE.read_text(encoding="utf-8")
    m = _DOC_REGEX.search(text)
    return m.group(1) if m else None


def test_task_id_regex_doc_matches_test():
    """task-lifecycle.md 中文档化的正则必须与契约测试中的正则一致。"""
    doc_regex = _extract_doc_regex()
    assert doc_regex is not None, (
        "task-lifecycle.md 中未找到 TASK_ID 正则（格式：正则 `...`）"
    )
    assert doc_regex == EXPECTED_TASK_ID, (
        f"doc/test TASK_ID 正则不一致：\n"
        f"  文档: {doc_regex}\n"
        f"  测试: {EXPECTED_TASK_ID}\n"
        f"请同步 task-lifecycle.md 或 test_tracker_governance.py"
    )


def test_task_id_regex_validates_known_ids():
    """提取的正则必须能匹配已知的多字母后缀 ID（防止正则退化为单字母）。"""
    doc_regex = _extract_doc_regex()
    assert doc_regex is not None
    compiled = re.compile(doc_regex)
    known_multi_suffix = [
        "REQ-067-B10",
        "REQ-067-B12",
        "REQ-068-PLAN",
        "REQ-070-PARS",
        "REQ-070-LEARN",
    ]
    for task_id in known_multi_suffix:
        assert compiled.fullmatch(task_id), (
            f"正则未能匹配已知多字母后缀 ID: {task_id}"
        )


def test_task_id_regex_rejects_invalid_ids():
    """提取的正则必须拒绝明显不合法的 ID。"""
    doc_regex = _extract_doc_regex()
    assert doc_regex is not None
    compiled = re.compile(doc_regex)
    invalid = [
        "req-067-a",      # 小写前缀
        "REQ-67-A",       # 序号不足三位
        "REQ-0670-A",     # 序号超过三位
        "REQ-067-a1",     # 后缀含小写
        "-067-A",         # 无前缀
    ]
    for task_id in invalid:
        assert not compiled.fullmatch(task_id), (
            f"正则错误地接受了无效 ID: {task_id}"
        )
