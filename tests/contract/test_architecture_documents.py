"""
模块职责：守护架构正文、Mermaid 视图和已知实现偏差保持同步。
设计关联（DesignRef）：docs/standards/code-document-traceability.md
实现状态：Current
被测代码：docs/architecture
守护面：架构与设计追溯
失效后果：架构正文、Mermaid 视图与实现偏差失去同步
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHITECTURE = ROOT / "docs" / "architecture"
MERMAID_BLOCK = re.compile(r"```mermaid\s*\n(?P<body>.*?)```", re.DOTALL)
# architecture/ 只放确定文档：总体架构 + 服务架构（前端/后端）+ 固定 API/数据库文档 + code-map
CURRENT_DOCUMENTS = {
    "four-service-architecture.md",
    "frontend-architecture.md",
    "backend-architecture.md",
    "api-contracts.md",
    "database-design.md",
    "code-map.md",
}
VALID_DESIGN_STATUSES = {"Draft", "Proposed", "Accepted", "Rejected", "Superseded", "Historical"}
VALID_IMPLEMENTATION_STATUSES = {
    "Not Started",
    "In Progress",
    "Implemented",
    "Verified",
    "Blocked",
    "Completed",
}
VALID_CONFIRM_STATUSES = {"暂定", "已确认"}


def _mermaid(document: str) -> list[str]:
    content = (ARCHITECTURE / document).read_text(encoding="utf-8")
    return [match.group("body") for match in MERMAID_BLOCK.finditer(content)]


def _field(content: str, name: str) -> str:
    matches = re.findall(rf"^{re.escape(name)}：(.*)$", content, re.MULTILINE)
    assert len(matches) == 1, f"{name} 必须恰好出现一次"
    return matches[0].strip()


def test_architecture_directory_has_one_index_and_current_documents():
    assert {path.name for path in ARCHITECTURE.glob("*.md")} == {
        "index.md",
        *CURRENT_DOCUMENTS,
    }
    index = (ARCHITECTURE / "index.md").read_text(encoding="utf-8")
    for document in CURRENT_DOCUMENTS:
        assert f"]({document})" in index


def test_every_architecture_document_declares_confirm_status():
    for document in CURRENT_DOCUMENTS:
        content = (ARCHITECTURE / document).read_text(encoding="utf-8")
        assert _field(content, "确认状态") in VALID_CONFIRM_STATUSES, document


def test_service_architecture_documents_declare_metadata():
    for document in ("frontend-architecture.md", "backend-architecture.md"):
        content = (ARCHITECTURE / document).read_text(encoding="utf-8")
        assert _field(content, "设计状态") in VALID_DESIGN_STATUSES
        assert _field(content, "实现状态") in VALID_IMPLEMENTATION_STATUSES
        for field in ("关联代码", "关联测试", "关联 ADR"):
            _field(content, field)


def test_fixed_api_and_database_documents_declare_metadata():
    for document in ("api-contracts.md", "database-design.md"):
        content = (ARCHITECTURE / document).read_text(encoding="utf-8")
        assert _field(content, "设计状态") in VALID_DESIGN_STATUSES
        assert _field(content, "实现状态") in VALID_IMPLEMENTATION_STATUSES
        for field in ("关联代码", "关联测试", "关联 ADR"):
            _field(content, field)
    api = (ARCHITECTURE / "api-contracts.md").read_text(encoding="utf-8")
    assert "前端无 API" in api


def test_database_design_keeps_er_diagram():
    """关系视图是总纲必备件（ADR 0025 决定 5：零建表语句断言由逐字对齐守护取代）。"""
    assert any("erDiagram" in body for body in _mermaid("database-design.md")), (
        "database-design 缺少 mermaid ER 关系视图"
    )


def test_four_service_architecture_declares_metadata_and_diagram():
    content = (ARCHITECTURE / "four-service-architecture.md").read_text(encoding="utf-8")
    assert _field(content, "设计状态") in VALID_DESIGN_STATUSES
    assert _field(content, "实现状态") in VALID_IMPLEMENTATION_STATUSES
    for field in ("关联代码", "关联测试", "关联 ADR"):
        _field(content, field)
    assert len(_mermaid("four-service-architecture.md")) >= 1
    # 四服务（ADR 0007 后：节点命名「QED-Engine 后端」承载配置/数据/服务三域）
    for label in ("QED-Engine 前端", "QED-Engine 后端", "Axiom-Flow", "QED-Tracker"):
        assert label in _mermaid("four-service-architecture.md")[0]


def test_code_map_declares_metadata_and_mapped_modules():
    content = (ARCHITECTURE / "code-map.md").read_text(encoding="utf-8")
    for field in ("设计状态", "实现状态", "关联代码", "关联测试", "关联 ADR"):
        _field(content, field)
    assert "| 代码路径 |" in content


ROOT_PRIVATE_TABLES = (
    "qe_learn_course",
    "qe_learn_unit",
    "qe_learn_unit_progress",
    "qe_learn_kp_detail",
    "qe_question",
    "qe_attempt",
    "qe_review_task",
)


def test_root_private_table_prefix_and_collation_match_database_design():
    """总纲第四段与代码 DDL 两侧同步（REQ-120）：前缀 qe_ 且排序规则取库默认。"""
    sources = list((ROOT / "backend").rglob("*.py"))
    code = {path.relative_to(ROOT).as_posix(): path.read_text(encoding="utf-8") for path in sources}
    stale = [name for name, text in code.items() if "qed_learn_" in text]
    assert not stale, f"旧前缀仍留在代码里：{stale}"
    joined = "\n".join(code.values())
    for table in ROOT_PRIVATE_TABLES:
        assert f"CREATE TABLE IF NOT EXISTS {table}" in joined, f"代码 DDL 缺 {table}"
        assert table in (ARCHITECTURE / "database-design.md").read_text(encoding="utf-8"), table
    unicode_ci = [name for name, text in code.items() if "utf8mb4_unicode_ci" in text]
    assert not unicode_ci, f"根侧 DDL 仍声明与共享族分裂的排序规则：{unicode_ci}"
    assert joined.count("COLLATE=utf8mb4_0900_ai_ci") >= 9, "九张根侧建表语句应显式声明库默认排序规则"


# REQ-122：database-design.md 是共享 qed_* 四表与根专业 qe_learn_* 七表的**设计正本**——
# 逐列定义表与建表语句都落在文档里（ADR 0025 决定 2）：九张根侧表的文档语句与代码渲染结果
# 逐字相等，受托两表按对方 ORM 派生为等价展示，两侧任一改动未随步即红。
DDL_BLOCK = re.compile(r"CREATE TABLE IF NOT EXISTS (?P<name>\w+) \((?P<body>.*?)\n\) ENGINE", re.DOTALL)
DDL_NON_COLUMN = {"KEY", "UNIQUE", "PRIMARY", "CONSTRAINT", "INDEX", "FOREIGN", "FULLTEXT"}
TRACKER_MODELS = ROOT / "QED-Tracker" / "src" / "qed_tracker" / "db" / "models.py"
MAPPED_COLUMN = re.compile(r"^    (?P<name>\w+): Mapped\[.*?] = mapped_column\(", re.MULTILINE)
# 逐列定义小节的固定写法：`### <表名>（<中文表义>）`，其下第一列为列名的 Markdown 表格。
DOC_TABLE_SECTION = "### {table}（"


def _code_columns() -> dict[str, list[str]]:
    """从根代码 DDL 抽取「表名 → 有序列名」，键序即代码内出现顺序。"""
    tables: dict[str, list[str]] = {}
    for path in sorted((ROOT / "backend").rglob("*.py")):
        for match in DDL_BLOCK.finditer(path.read_text(encoding="utf-8")):
            columns = []
            for line in match.group("body").splitlines():
                token = line.strip().split(" ", 1)[0].rstrip(",")
                if token and token.upper() not in DDL_NON_COLUMN:
                    columns.append(token)
            tables[match.group("name")] = columns
    return tables


def _doc_columns(content: str, table: str) -> list[str]:
    body = _doc_table_section(content, table)
    return [
        line.strip().strip("|").split("|")[0].strip().strip("`")
        for line in body.splitlines()
        if line.startswith("| `")
    ]


def _doc_table_section(content: str, table: str) -> str:
    heading = DOC_TABLE_SECTION.format(table=table)
    assert heading in content, f"database-design.md 缺 {table} 的逐列定义小节（写法＝{heading}…）"
    return content[content.index(heading):].split("\n## ", 1)[0].split("\n### ", 1)[0]


def _tracker_columns(class_name: str) -> list[str] | None:
    """共享两表由 QED-Tracker ORM 建表：同级仓库在位即比对，缺仓则跳过（不假红）。"""
    if not TRACKER_MODELS.is_file():
        return None
    text = TRACKER_MODELS.read_text(encoding="utf-8")
    block = re.search(rf"^class {class_name}\(Base\):\n(?P<body>.*?)(?=^class |\Z)", text, re.MULTILINE | re.DOTALL)
    assert block, f"QED-Tracker ORM 里找不到 {class_name}"
    return MAPPED_COLUMN.findall(block.group("body"))


def test_database_design_carries_column_definitions_for_tables_it_owns():
    """REQ-122：本文正本的 11 张表逐列定义齐备且与实现事实源同列同序。"""
    content = (ARCHITECTURE / "database-design.md").read_text(encoding="utf-8")
    code = _code_columns()
    assert set(code) == {"qed_knowledge_point", "qed_llm_calls", *ROOT_PRIVATE_TABLES}, sorted(code)

    drifted = []
    for table, columns in code.items():
        if _doc_columns(content, table) != columns:
            drifted.append(table)
    assert not drifted, (
        f"逐列定义与代码 DDL 不一致的表 {drifted}——文档是设计正本，两侧列名与列序必须逐一对应"
    )

    for table, class_name in (("qed_domain", "QedDomain"), ("qed_course", "QedCourse")):
        columns = _tracker_columns(class_name)
        if columns is None:
            continue
        assert _doc_columns(content, table) == columns, (
            f"{table} 的逐列定义与 QED-Tracker ORM 不一致（对方 QED-076 承接后须同批随步）"
        )


def test_database_design_does_not_define_other_projects_private_tables():
    """REQ-122 边界：`qt_*`/`af_*` 在本文只登记与路由，不得出现逐列定义小节。"""
    content = (ARCHITECTURE / "database-design.md").read_text(encoding="utf-8")
    offenders = re.findall(r"^### ((?:qt|af)_\w+)（", content, re.MULTILINE)
    assert not offenders, f"他项目私有表在总纲落了逐列定义：{offenders}（结构正本在其各自仓库）"


# --- ADR 0025 决定 5：建表语句进文档后的三枚随步守护 -------------------------------
# 代码侧 DDL 常量渲染规则：f-string 的 `{PROVIDER_COMMENT}`／`{META_COMMENT}` 取同文件常量值，
# 转义花括号 `{{task}}` 还原为单花括号——文档围栏必须与**渲染后**的运行结果逐字相等。
CREATE_TABLE_CONST = re.compile(r'CREATE_TABLE_SQL = (?P<f>f?)"""(?P<body>.*?)"""', re.DOTALL)
COMMENT_CONST = re.compile(
    r'^(?P<name>PROVIDER_COMMENT|META_COMMENT) = "(?P<value>.*)"$', re.MULTILINE
)
ESCAPED_BRACE = re.compile(r"\{\{(\w+)\}\}")
SQL_FENCE = re.compile(r"```sql\n(?P<body>.*?)```", re.DOTALL)
DDL_COLUMN_LINE = re.compile(
    r"^  (?P<name>\w+) (?P<type>[A-Z]+(?:\(\d+\))?)\s(?P<rest>[^\n]*)$", re.MULTILINE
)
ORM_COLUMN_HEAD = re.compile(
    r"^    (?P<name>\w+): Mapped\[.*?\] = mapped_column\(", re.MULTILINE
)
ORM_TYPE = re.compile(r"\s*(?P<py>\w+)\s*(?P<width>\(\s*\d+\s*\))?")
ORM_TYPE_MAP = {
    "String": "VARCHAR",
    "Text": "TEXT",
    "JSON": "JSON",
    "Integer": "INT",
    "BigInt": "BIGINT",
    "DateTime": "DATETIME",
}
# 本文正本的 11 张表（共享四 + 根私有七）；`qed_domain`/`qed_course` 为受托建表、等价展示。
MASTER_TABLES = ("qed_domain", "qed_course", "qed_knowledge_point", "qed_llm_calls", *ROOT_PRIVATE_TABLES)
DISPLAY_DDL_TABLES = (("qed_domain", "QedDomain"), ("qed_course", "QedCourse"))
FOUR_PARTS = ("**用途**", "**涉及模块**", "**字段明细**", "**建表语句**")
TABLE_NAME_RE = re.compile(r"^(?:qed|qe_|af_|qt_)\w+$")


def _rendered_sql_constants(module_text: str) -> list[str]:
    bodies = []
    for match in CREATE_TABLE_CONST.finditer(module_text):
        body = match.group("body")
        for const in COMMENT_CONST.finditer(module_text):
            body = body.replace("{" + const.group("name") + "}", const.group("value"))
        bodies.append(ESCAPED_BRACE.sub(r"{\1}", body))
    return bodies


def _code_ddl_statements() -> dict[str, str]:
    """根代码渲染后的建表语句：表名 → 语句原文（多语句常量按 `CREATE TABLE` 切分）。"""
    statements: dict[str, str] = {}
    for path in sorted((ROOT / "backend").rglob("*.py")):
        for body in _rendered_sql_constants(path.read_text(encoding="utf-8")):
            for stmt in re.split(r"\n(?=CREATE TABLE IF NOT EXISTS)", body.strip()):
                table = re.match(r"CREATE TABLE IF NOT EXISTS (\w+)", stmt.strip())
                if not table:
                    continue
                name = table.group(1)
                assert name not in statements, f"代码里 {name} 的建表语句重复出现"
                statements[name] = stmt.strip()
    return statements


def _doc_sql_fences(content: str) -> dict[str, str]:
    fences: dict[str, str] = {}
    for match in SQL_FENCE.finditer(content):
        body = match.group("body").strip()
        names = re.findall(r"CREATE TABLE IF NOT EXISTS (\w+)", body)
        if not names:
            continue
        assert len(names) == 1, f"一个 sql 围栏只能含一张表的建表语句：{names}"
        fences[names[0]] = body
    return fences


def _ddl_columns(statement: str) -> list[tuple[str, str, bool]]:
    """语句 → 有序 `(列名, 类型, 可空)`；索引与约束行不计入。"""
    columns = []
    for line in DDL_COLUMN_LINE.finditer(statement):
        token = line.group("name").upper()
        if token in DDL_NON_COLUMN:
            continue
        columns.append(
            (line.group("name"), line.group("type"), "NOT NULL" not in line.group("rest"))
        )
    return columns


def _balanced_args(text: str, open_index: int) -> str:
    """从 `mapped_column(` 的左括号起取到配对右括号，字符串字面量内的括号不计。"""
    depth = 0
    quote = ""
    for index in range(open_index, len(text)):
        char = text[index]
        if quote:
            if char == quote:
                quote = ""
        elif char in "\"'":
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return text[open_index + 1 : index]
    raise AssertionError("mapped_column( 括号未闭合")


def _orm_mapped_columns(class_name: str) -> list[tuple[str, str, bool]] | None:
    """对方 ORM 声明 → 有序 `(列名, 类型, 可空)`；同级仓库不在位则返回 None（不假红）。"""
    if not TRACKER_MODELS.is_file():
        return None
    text = TRACKER_MODELS.read_text(encoding="utf-8")
    block = re.search(
        rf"^class {class_name}\(Base\):\n(?P<body>.*?)(?=^class |\Z)", text, re.MULTILINE | re.DOTALL
    )
    assert block, f"QED-Tracker ORM 里找不到 {class_name}"
    columns = []
    for match in ORM_COLUMN_HEAD.finditer(block.group("body")):
        args = _balanced_args(block.group("body"), match.end() - 1)
        type_match = ORM_TYPE.match(args)
        py_type = type_match.group("py")
        assert py_type in ORM_TYPE_MAP, f"ORM 出现未登记的类型映射：{py_type}（{class_name}.{match.group('name')}）"
        nullable = "nullable=False" not in args and "primary_key=True" not in args
        columns.append(
            (
                match.group("name"),
                ORM_TYPE_MAP[py_type] + (type_match.group("width") or ""),
                nullable,
            )
        )
    return columns


def test_database_design_ddl_matches_code_verbatim():
    """本文九张根侧表的建表语句 ↔ 代码渲染结果逐字相等（ADR 0025 决定 2）。"""
    content = (ARCHITECTURE / "database-design.md").read_text(encoding="utf-8")
    statements = _code_ddl_statements()
    assert set(statements) == {"qed_knowledge_point", "qed_llm_calls", *ROOT_PRIVATE_TABLES}
    fences = _doc_sql_fences(content)
    assert set(fences) == {*statements, *(table for table, _ in DISPLAY_DDL_TABLES)}, (
        "文档 sql 围栏的表集合与正本 11 表不符"
    )
    drifted = sorted(table for table in statements if fences[table] != statements[table])
    assert not drifted, (
        f"文档建表语句与代码不一致的表 {drifted}——本文是可执行 DDL 的设计正本，须逐字相等"
    )


def test_database_design_display_ddl_matches_tracker_orm():
    """受托两表的等价展示 DDL ↔ 对方 ORM 的列名·列序·类型·可空性。"""
    content = (ARCHITECTURE / "database-design.md").read_text(encoding="utf-8")
    fences = _doc_sql_fences(content)
    for table, class_name in DISPLAY_DDL_TABLES:
        columns = _orm_mapped_columns(class_name)
        if columns is None:
            continue
        assert _ddl_columns(fences[table]) == columns, (
            f"{table} 的展示 DDL 与 QED-Tracker {class_name} 不一致（对方 schema 变更后须同批随步）"
        )


def test_database_design_table_sections_carry_four_parts():
    """正本 11 表每节四件套齐备：用途、涉及模块、字段明细、建表语句。"""
    content = (ARCHITECTURE / "database-design.md").read_text(encoding="utf-8")
    for table in MASTER_TABLES:
        section = _doc_table_section(content, table)
        missing = [part for part in FOUR_PARTS if part not in section]
        assert not missing, f"{table} 小节缺件：{missing}"
        assert "```sql" in section, f"{table} 小节缺建表语句围栏"


def _doc_section(content: str, heading_pattern: str) -> str:
    """按标题正则切出小节正文（到下一个 `##`/`###` 标题为止），使守护不依赖小节编号。"""
    match = re.search(heading_pattern, content, re.MULTILINE)
    assert match, f"database-design.md 未找到小节标题：{heading_pattern}"
    rest = content[match.end() :]
    nxt = re.search(r"^#{2,3} ", rest, re.MULTILINE)
    return rest[: nxt.start()] if nxt else rest


def _table_cell_names(section: str, cell: int) -> set[str]:
    """取小节内表格第 cell 列（1 起）里出现的库表名，非表格行与分隔行跳过。"""
    found: set[str] = set()
    for line in section.splitlines():
        cells = line.split("|")
        if len(cells) <= cell or not cells[1].strip() or cells[1].strip().startswith("---"):
            continue
        found.update(n for n in re.findall(r"`(\w+)`", cells[cell]) if TABLE_NAME_RE.match(n))
    return found


def test_database_design_inventory_matrix_and_roles_cover_same_tables():
    """总览、读写矩阵与角色分类覆盖同一表集合（合并行拆分或表族增删时三处同批随步）。"""
    content = (ARCHITECTURE / "database-design.md").read_text(encoding="utf-8")
    inventory = set(
        re.findall(r"^\| `(\w+)` \|", _doc_section(content, r"^## 三、全库总览$"), re.MULTILINE)
    )
    matrix = _table_cell_names(_doc_section(content, r"^### 4\.\d+ 读写矩阵$"), 2)
    roles = _table_cell_names(_doc_section(content, r"^### 4\.\d+ 表角色分类$"), 3)
    assert inventory == matrix == roles, (
        f"总览/矩阵/角色分类表集合不一致：仅总览 {sorted(inventory - matrix - roles)}，"
        f"仅矩阵 {sorted(matrix - inventory)}，仅角色 {sorted(roles - inventory)}"
    )
    assert len(inventory) == 21, f"全库总览应为 21 张表（共享 4 + 根私有 7 + af_ 5 + qt_ 5），现状 {len(inventory)}"
    assert {*MASTER_TABLES, "af_books", "qt_books"} <= inventory
