"""
模块职责：守护 8900 端点清单——api-contracts.md 与 api/ 路由文件双向一致。
设计关联（DesignRef）：docs/standards/code-document-traceability.md
实现状态：Current
被测代码：docs/architecture/api-contracts.md、backend/qed_engine/api
守护面：架构与设计追溯
失效后果：端点契约漏写或遗漏登记，前端按文档联调时出现 404 或文档漂移
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "backend" / "qed_engine" / "api"
API_DOC = ROOT / "docs" / "architecture" / "api-contracts.md"

ROUTE = re.compile(r'@router\.(get|post|put|patch|delete)\(\s*"([^"]+)"')
PREFIX = re.compile(r'APIRouter\(prefix="([^"]+)"')
HEADING = re.compile(r"^#{2,4}\s+(GET|POST|PUT|PATCH|DELETE)\s+(\S+)")
TABLE_CELL = re.compile(r"^\|\s+(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s+\|")
PLACEHOLDER = re.compile(r"\{[^}]*\}")


def _normalize(path: str) -> str:
    """占位符参数名不参与比较（{book_id} 与 {id} 视为同一）。"""
    return PLACEHOLDER.sub("{}", re.sub(r"\s+", "", path))


def _expand_union(path: str) -> list[str]:
    """展开路径段并集写法（如 services/{name}/start|stop|restart 展开为三条）。"""
    if "|" not in path:
        return [path]
    base, _, rest = path.partition("|")
    prefix = base.rsplit("/", 1)[0] + "/"
    segments = (base.rsplit("/", 1)[1] + "|" + rest).split("|")
    return [prefix + segment for segment in segments]


def _code_endpoints() -> set[tuple[str, str]]:
    endpoints = set()
    for path in sorted(API_DIR.glob("*.py")):
        source = path.read_text(encoding="utf-8")
        prefix_match = PREFIX.search(source)
        prefix = prefix_match.group(1) if prefix_match else ""
        for method, route_path in ROUTE.findall(source):
            endpoints.add((method.upper(), _normalize(prefix + route_path)))
    return endpoints


def _doc_endpoints() -> set[tuple[str, str]]:
    endpoints = set()
    content = API_DOC.read_text(encoding="utf-8")
    for raw_line in content.splitlines():
        line = raw_line.replace("`", "")
        match = HEADING.match(line)
        if match:
            method, path = match.group(1), match.group(2)
            for variant in _expand_union(path):
                endpoints.add((method, _normalize(variant)))
            continue
        match = TABLE_CELL.match(line)
        if match:
            method, path = match.group(1), match.group(2)
            if not path.startswith("/api/v1"):
                path = "/api/v1" + path  # 表格行省略前缀
            for variant in _expand_union(path):
                endpoints.add((method, _normalize(variant)))
    return endpoints


def test_documented_endpoints_match_implemented_endpoints():
    documented = _doc_endpoints()
    implemented = _code_endpoints()

    missing_in_doc = sorted(implemented - documented)
    ghost_in_doc = sorted(documented - implemented)
    assert not missing_in_doc, (
        f"以下端点已实现但 api-contracts.md 未登记（新增端点须同步文档）：\n{missing_in_doc}"
    )
    assert not ghost_in_doc, (
        f"以下端点在 api-contracts.md 已登记但代码不存在（删端点须同步文档）：\n{ghost_in_doc}"
    )
    assert documented, "api-contracts.md 未解析到任何端点"
    assert implemented, "backend/qed_engine/api 未解析到任何路由"
