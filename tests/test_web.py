"""
模块职责：守护 8903 QED-Engine 前端静态页：三文件就位、路由/入口文本与接口契约引用一致
（防契约漂移）。
设计关联（DesignRef）：docs/design/service-contracts.md
实现状态：Current
被测代码：web/
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

# 8901 资源状态机端点（service-contracts.md）：三态评估（确认/备选/否定）＋验收/预览/下载
TRACKER_ENDPOINT_TOKENS = (
    "/resources",
    "/tasks",
    "/tasks/catalog/evaluate",
    "/confirm",
    "/backup",
    "/reject",
    "/approve",
    "/file",
    "/tasks/books/download",
)

# 人工评估三态（QED-017）：候选三态按钮、备选转正/放弃、确定后开始下载
EVAL_THREEWAY_TOKENS = ("备选", "转正", "开始下载")

# 按课程评估视图：中文候选优先展示（中文优先裁决）
EVAL_COURSE_VIEW_TOKENS = ("中文优先",)

# 8900 配置中心横幅数据源（config-center-api.md）
CONFIG_ENDPOINT_TOKENS = (
    "/api/v1/health",
    "/config/keys",
    "/config/database",
    "/config/llm-status",
)

# hash 路由（8903 单页应用，见 service-contracts.md「8903 QED-Engine 前端」）
# 四期：`#/admin` 卡片墙入口，模块各自独立路由（仪表盘 → dashboard）
ROUTE_TOKENS = ("#/admin", "#/admin/dashboard", "#/admin/downloads", "#/admin/parsing", "#/admin/compare", "#/admin/trace")

# 后台管理菜单（全模块入口，占位页待数据管线）
ADMIN_MENU_TOKENS = ("仪表盘", "文件下载管理", "解析进度", "原始文档对照", "追溯")

# 主体学习界面入口（三期收敛为三项：知识点梳理/学习/刷题模式）
HOME_ENTRY_TOKENS = ("知识点梳理", "学习", "刷题模式", "管理后台")

# 文件下载管理重设计（三期）：领域树容器 + 事务面板（树节点由 app.js 渲染）
DOWNLOAD_LAYOUT_TOKENS = ("domain-tree", "download-panel")

# 仪表盘图表（三期）：手写 SVG 图表（容器在 index.html，渲染目标由 app.js 引用）
DASHBOARD_CHART_TOKENS = ("dashboard-charts", "donut-chart", "course-bars")
DASHBOARD_JS_TOKENS = ("donut-chart", "course-bars", "tree-node")

# 空态数据容器（三期：解析进度/文档对照/追溯只展示事务，无数据置空）
EMPTY_VIEW_TOKENS = ("parsing-data", "compare-data", "trace-data")

# 横幅粗粒度化（三期）：只显示模块连接状态，不透露 provider 名单与主机细节
BANNER_MODULE_TOKENS = ("LLM评估模块连接", "MySQL数据库连接")

# 管理后台卡片墙（四期）：五张模块卡片（仪表盘/文件下载管理/解析进度/原始文档对照/追溯）
ADMIN_HOME_TOKENS = (
    "admin-card-dashboard",
    "admin-card-downloads",
    "admin-card-parsing",
    "admin-card-compare",
    "admin-card-trace",
)

# 严格三领域（四期裁决）：分析 / 代数 / 概率论与数理统计；旧标签移除
DOMAIN_LABELS = ("分析", "代数", "概率论与数理统计")
REMOVED_DOMAIN_LABELS = ("几何与拓扑", "概率统计", "备考")

# 下载管理筛选栏（四期）：领域 + 课程（联动）+ 状态，与树选择独立叠加
FILTER_TOKENS = ("filter-domain", "filter-course")

# 评估任务筛选（四期）：任务状态 / 类型 / 课程，前端过滤
TASK_FILTER_TOKENS = ("filter-task-status", "filter-task-type", "filter-task-course")

# 领域树可变边框（四期）：拖拽手柄 + localStorage 记忆宽度
TREE_RESIZE_TOKENS = ("tree-resizer", "qed-tree-w")

# 任务详情弹窗 = 书籍评估辅助视角（四期）：课程→书籍、类型/中英/来源、解析目标建议
DETAIL_EVAL_TOKENS = ("解析目标", "中英", "来源")


def test_web_files_present():
    """工作台三文件必须就位。"""
    for name in ("index.html", "app.js", "style.css"):
        assert (WEB / name).is_file(), f"缺失 web/{name}"


def test_index_references_app_and_style():
    content = (WEB / "index.html").read_text(encoding="utf-8")
    assert 'src="app.js"' in content
    assert 'href="style.css"' in content
    for token in DOWNLOAD_LAYOUT_TOKENS:
        assert token in content, f"index.html 缺少下载管理结构：{token}"


def test_app_js_references_config_center_endpoints():
    content = (WEB / "app.js").read_text(encoding="utf-8")
    for token in CONFIG_ENDPOINT_TOKENS:
        assert token in content, f"app.js 缺少配置中心端点引用：{token}"


def test_app_js_references_tracker_endpoints():
    content = (WEB / "app.js").read_text(encoding="utf-8")
    for token in TRACKER_ENDPOINT_TOKENS:
        assert token in content, f"app.js 缺少 8901 端点引用：{token}"


def test_app_js_implements_three_way_evaluation():
    """人工评估三态（QED-017）：备选按钮、备选转正/放弃、确定后开始下载、中文优先视图。"""
    content = (WEB / "app.js").read_text(encoding="utf-8")
    for token in EVAL_THREEWAY_TOKENS + EVAL_COURSE_VIEW_TOKENS:
        assert token in content, f"app.js 缺少三态评估 UI：{token}"
    assert "backup" in content, "app.js 缺少 backup 端点/状态处理"


def test_app_js_handles_offline_degradation():
    """离线降级：fetch 失败时显示离线而非空白（独立性铁律）。"""
    content = (WEB / "app.js").read_text(encoding="utf-8")
    for token in ("catch", "离线"):
        assert token in content, f"app.js 缺少离线降级处理：{token}"


def test_app_js_implements_hash_routes():
    """主体界面 → 后台管理 → 文件下载管理的 hash 路由必须存在。"""
    content = (WEB / "app.js").read_text(encoding="utf-8")
    for token in ROUTE_TOKENS:
        assert token in content, f"app.js 缺少路由：{token}"
    assert "hashchange" in content or "location.hash" in content


def test_index_has_home_and_admin_entry():
    """主体界面入口与后台管理菜单齐全。"""
    content = (WEB / "index.html").read_text(encoding="utf-8")
    for token in HOME_ENTRY_TOKENS + ADMIN_MENU_TOKENS:
        assert token in content, f"index.html 缺少入口/菜单：{token}"


def test_style_has_responsive_breakpoints():
    """自适应窗口：必须存在媒体查询断点。"""
    content = (WEB / "style.css").read_text(encoding="utf-8")
    media_queries = [line for line in content.splitlines() if line.strip().startswith("@media")]
    assert media_queries, "style.css 缺少 @media 断点（响应式要求）"


def test_detail_modal_present():
    """卡片详情弹窗：容器与详情按钮（任务/资源）必须就位。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    assert "detail-modal" in html
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "detail" in js
    assert "详情" in js


def test_admin_views_are_differentiated():
    """管理各模块差异化：解析进度/文档对照/追溯各有独立数据容器（无数据时置空，非宣传占位）。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    for element in EMPTY_VIEW_TOKENS:
        assert element in html, f"index.html 缺少数据容器：{element}"
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "detail-modal" in js


def test_dashboard_has_charts():
    """仪表盘：图表容器（状态分布环形图 + 课程分布条形图）必须就位，渲染逻辑存在。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in DASHBOARD_CHART_TOKENS:
        assert token in html, f"index.html 缺少图表容器：{token}"
    for token in DASHBOARD_JS_TOKENS:
        assert token in js, f"app.js 缺少图表/树渲染逻辑：{token}"


def test_banner_is_coarse_grained():
    """横幅粗粒度化：只显示模块连接状态，不透露 provider 名单与主机细节（三期裁决）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in BANNER_MODULE_TOKENS:
        assert token in js, f"app.js 缺少横幅模块文案：{token}"
    # 横幅不再拼接 provider 逐个状态与 host:port
    assert "db.host" not in js, "横幅不应再展示数据库主机细节"
    # index.html 静态结构中不得出现供应商名单（横幅文案由 app.js 聚合渲染）
    html = (WEB / "index.html").read_text(encoding="utf-8")
    for provider in ("qwen", "glm", "deepseek"):
        assert provider not in html, f"index.html 不应出现供应商名单：{provider}"


def test_admin_home_cards_present():
    """管理后台卡片墙（四期）：五张模块卡片必须就位（文件下载管理占双栏大卡）。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    for token in ADMIN_HOME_TOKENS:
        assert token in html, f"index.html 缺少管理后台模块卡片：{token}"


def test_domains_are_three():
    """严格三领域（四期裁决）：app.js 只含 分析/代数/概率论与数理统计，旧标签移除。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for label in DOMAIN_LABELS:
        assert label in js, f"app.js 缺少领域标签：{label}"
    for label in REMOVED_DOMAIN_LABELS:
        assert label not in js, f"app.js 不应再含旧领域标签：{label}"


def test_download_filters_present():
    """下载管理筛选栏（四期）：领域 + 课程联动筛选与树选择独立叠加。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in FILTER_TOKENS:
        assert token in html, f"index.html 缺少筛选下拉：{token}"
        assert token in js, f"app.js 缺少筛选逻辑：{token}"


def test_task_filters_present():
    """评估任务筛选（四期）：任务状态 / 类型 / 课程三组下拉，前端过滤。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in TASK_FILTER_TOKENS:
        assert token in html, f"index.html 缺少任务筛选下拉：{token}"
        assert token in js, f"app.js 缺少任务筛选逻辑：{token}"


def test_tree_resizable():
    """领域树可变边框（四期）：拖拽手柄就位，宽度经 localStorage 记忆（qed-tree-w）。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    assert "tree-resizer" in html, "index.html 缺少拖拽手柄 tree-resizer"
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "qed-tree-w" in js, "app.js 缺少宽度记忆键 qed-tree-w"
    css = (WEB / "style.css").read_text(encoding="utf-8")
    assert "qed-tree-w" in css, "style.css 缺少树宽 CSS 变量 qed-tree-w"


def test_detail_modal_eval_view():
    """详情弹窗 = 书籍评估辅助视角（四期）：标注课程→书籍、类型/中英/来源、解析目标建议。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in DETAIL_EVAL_TOKENS:
        assert token in js, f"app.js 缺少详情评估字段：{token}"


def test_download_layout_tree_major():
    """树主评估窄（四期）：领域树占主空间（默认更宽），评估面板为窄栏。"""
    css = (WEB / "style.css").read_text(encoding="utf-8")
    assert "download-layout" in css
    assert "tree-resizer" in css or "var(--tree-w" in css, "style.css 缺少树宽变量应用"
