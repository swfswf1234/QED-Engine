"""
模块职责：守护 8903 QED-Engine 前端静态页：三文件就位、路由/入口文本与接口契约引用一致
（防契约漂移）。
设计关联（DesignRef）：docs/design/web-frontend.md
实现状态：Current
被测代码：web/
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

# 8901 资源状态机端点（service-contracts.md）：三态评估（确认/备选/否定）＋验收/预览/下载
# ADR 0007 后语义归 8900 数据域（路径沿革自 8901 资源契约，见 config-center-api.md）
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
# 六期：`#/admin` 直达仪表大盘（无卡片墙中间层），独立模块路由（仪表大盘/文档下载管理/文档解析/对照）
ROUTE_TOKENS = ("#/admin", "#/admin/dashboard", "#/admin/downloads", "#/admin/parsing", "#/admin/compare")

# 后台管理菜单（十五期：文档下载管理界面名回归，树头仍叫知识点）
ADMIN_MENU_TOKENS = ("仪表大盘", "文档下载管理", "文档解析进度", "原始文档对照")

# 主体学习界面入口（三期收敛为三项：知识点梳理/学习/刷题模式；五期 + 使用手册）
HOME_ENTRY_TOKENS = ("知识点梳理", "学习", "刷题模式", "管理后台", "使用手册")

# 文件下载管理重设计（三期）：领域树容器 + 事务面板（树节点由 app.js 渲染）
DOWNLOAD_LAYOUT_TOKENS = ("domain-tree", "download-panel")

# 五期（ARCH-005）：入口页零后台痕迹——服务状态卡移入仪表盘，入口只留学习入口 + 手册
REMOVED_HOME_TOKENS = ("service-status", "card-config", "card-tracker", "card-axiom")

# 五期：内置操作手册（纯前端弹窗，不依赖后台服务）
MANUAL_TOKENS = ("使用手册", "help-modal")

# 五期：仪表盘四阶段流水线（下载→确认→解析→知识整理，缺源标注未启用）
PIPELINE_TOKENS = ("pipeline", "发现下载", "评估确认", "知识整理")

# 五期/八期：服务健康分组面板（后台服务带核心任务备注 / LLM配置 模型路由 / 数据库配置 仅 MySQL）
HEALTH_TOKENS = ("health-panel", "后台服务", "LLM配置", "数据库配置")

# 八期：后台服务项核心任务备注（QED-Tracker 文档下载 / Axiom-Flow 文档解析 / QED 管理服务 后台管理）
SERVICE_ANNOTATION_TOKENS = (
    "QED-Tracker（文档下载服务）",
    "Axiom-Flow（文档解析服务）",
    "QED 管理服务（后台管理服务）",
)

# 八期/九期：LLM配置 只显示三个实际使用模型（主模型/视图模型/Embedding，来自 8900 /config/models）
LLM_MODEL_TOKENS = ("主模型", "视图模型", "Embedding")
# 切换档/占位档路由不得再进入 LLM配置 列表（models.glm / models.glm_ocr / models.deepseek 引用移除）
REMOVED_LLM_ROUTE_TOKENS = ("GLM-OCR", "models.glm", "models.deepseek")

# 八期：向量数据库未配置不展示（避免误会）；MySQL 为当前唯一数据库
REMOVED_VECTOR_TOKENS = ("向量数据库", "向量库")

# 十五期：界面名「文档下载管理」（菜单+标题），树侧栏头保留「知识点」；旧树副标题移除
KNOWLEDGE_TREE_TOKENS = ("知识点",)
REMOVED_TREE_TOKENS = ("领域 · 课程 · 书籍",)
TREE_COUNT_TOKENS = ("本）",)

# 十五期：进入文档下载管理默认选中「数学」领域（loadTree 完成后无选择时触发一次）
DEFAULT_DOMAIN_TOKENS = ('selectNode("domain", "数学")', "state.selection", "数学")

# 十五期：领域级按课程分页（每页 PAGE_SIZE=3）+ 配套对并排（同课程 book+exercise 同作者）
COURSE_PAGER_TOKENS = ("PAGE_SIZE", "coursePage", "renderPanelByCourses", "coursePagerHtml", "pairedCourseTargets")
PAIRED_ROW_TOKENS = ("paired-row", "course-row")

# 十一期：课程按学习深度排序（先学在前、依赖后续在后；未列入新课程排尾）
COURSE_ORDER_TOKENS = ("COURSE_ORDER", "01_math_analysis", "10_qe_prep")

# 十一期：书籍类型徽标（kind → 教材/习题集/资料）+ 课程完成徽标（教材+习题集均 approved）
BOOK_TYPE_TOKENS = ("教材", "习题集")
COURSE_DONE_TOKENS = ("courseCompletion", "approved", "已完成")

# 五期：按钮弹层筛选器（替代原生 select，浅底深字）
FILTER_POPOVER_TOKENS = ("filter-popover",)

# 空态数据容器（三期：解析进度/文档对照只展示事务，无数据置空；追溯已随六期移除）
EMPTY_VIEW_TOKENS = ("parsing-data", "compare-data")

# 横幅粗粒度化（三期）：只显示模块连接状态，不透露 provider 名单与主机细节
BANNER_MODULE_TOKENS = ("LLM评估模块连接", "MySQL数据库连接")

# 六期裁决：取消「模块总览」卡片墙与「追溯」界面；#/admin 直达仪表盘，无中间层
REMOVED_ADMIN_TOKENS = ("admin-card", "view-admin-home", "view-trace")

# 严格三领域（四期裁决）：分析 / 代数 / 概率论与数理统计；旧标签移除
DOMAIN_LABELS = ("分析", "代数", "概率论与数理统计")
REMOVED_DOMAIN_LABELS = ("几何与拓扑", "概率统计", "备考")

# 下载管理筛选栏（四期）：领域 + 课程（联动）+ 状态，与树选择独立叠加
FILTER_TOKENS = ("filter-domain", "filter-course")

# 评估任务筛选（四期）：任务状态 / 类型 / 课程，前端过滤
TASK_FILTER_TOKENS = ("filter-task-status", "filter-task-type", "filter-task-course")

# 十四期裁决：知识点界面尾部「评估任务」区块无意义，移除（任务列表 + 三个筛选器）
REMOVED_TASK_CENTER_TOKENS = ("task-list", "filter-task-status", "filter-task-type", "filter-task-course")
# 课程操作条步骤条保留（用户裁决：只去尾部列表，保留 搜索→确认→下载→验收）
CONSOLE_KEPT_TOKENS = ("course-console", "btn-course-search", "course-steps")

# 十四期：人工评审建议（review_note）落库——资源卡建议输入框随三态提交
REVIEW_NOTE_TOKENS = ("review-note", "评审建议", "review_note")

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
        assert token in content, f"app.js 缺少数据域端点引用：{token}"


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


def test_admin_dashboard_is_direct():
    """六期裁决：#/admin 直达仪表盘——卡片墙（view-admin-home/admin-card）与追溯（view-trace）已移除。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    for token in REMOVED_ADMIN_TOKENS:
        assert token not in html, f"index.html 不应再含已取消模块：{token}"


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


def test_task_center_removed():
    """评估任务区块移除（十四期）：知识点界面尾部任务列表与三个筛选器不再存在；
    课程操作条步骤条（搜索→确认→下载→验收）保留。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in REMOVED_TASK_CENTER_TOKENS:
        assert token not in html, f"index.html 不应再含评估任务区块：{token}"
    for token in CONSOLE_KEPT_TOKENS:
        assert token in html, f"index.html 应保留课程操作条：{token}"
    assert "courseSteps" in js, "app.js 应保留课程步骤进度逻辑"


def test_review_note_present():
    """人工评审建议（十四期）：资源卡三态按钮旁有建议输入框（选填），
    随确定/备选/否定一并提交落库；卡片与详情展示既有建议。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in REVIEW_NOTE_TOKENS:
        assert token in js, f"app.js 缺少评审建议逻辑：{token}"


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


def test_home_has_no_service_status():
    """入口页零后台痕迹（五期）：服务状态卡移入仪表盘，入口页不再展示。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    for token in REMOVED_HOME_TOKENS:
        assert token not in html, f"index.html 入口页不应再含服务状态卡：{token}"
    # 服务状态逻辑整体移入仪表盘：入口不再引用 hero-status
    assert "hero-status" not in html, "index.html 不应再有 hero-status 服务卡容器"


def test_manual_modal_present():
    """内置操作手册（五期）：入口页「使用手册」按钮 + 弹窗容器，内容纯前端内置。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in MANUAL_TOKENS:
        assert token in html, f"index.html 缺少手册入口/容器：{token}"
        assert token in js, f"app.js 缺少手册逻辑/文案：{token}"


def test_pipeline_present():
    """仪表盘四阶段流水线（五期）：容器与阶段名就位，缺源阶段显示未启用。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "pipeline" in html, "index.html 缺少流水线容器"
    for token in PIPELINE_TOKENS:
        assert token in js, f"app.js 缺少流水线阶段：{token}"
    assert "未启用" in js, "app.js 缺源阶段应有未启用标注"


def test_pipeline_course_based():
    """流水线按课程统计（十期）：总课程数来自 catalog targets 去重 course_id（动态），
    不再硬编码；阶段数字显示「已完成 X / N 课程」。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "const totalCourses = 13" not in js, "app.js 不应再硬编码课程总数 13"
    assert "course_id" in js, "app.js 流水线应按 course_id 聚合课程"
    assert "已完成" in js and "课程" in js, "app.js 阶段数字应为「已完成 X / N 课程」格式"
    assert "discoverDone" in js and "confirmDone" in js, "app.js 缺少课程口径阶段统计变量"


def test_health_panel_present():
    """服务健康分组面板（五期/八期）：后台服务/LLM配置/数据库配置三组。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in HEALTH_TOKENS:
        assert token in html, f"index.html 缺少健康面板结构：{token}"
        assert token in js, f"app.js 缺少健康面板逻辑：{token}"


def test_health_service_annotations():
    """后台服务项核心任务备注（八期）：QED-Tracker 文档下载 / Axiom-Flow 文档解析 / QED 管理服务 后台管理。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in SERVICE_ANNOTATION_TOKENS:
        assert token in js, f"app.js 缺少后台服务备注：{token}"


def test_llm_config_models():
    """LLM配置只显示三个实际使用模型（九期）：主模型/视图模型/Embedding，切换档不显示。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in LLM_MODEL_TOKENS:
        assert token in js, f"app.js 缺少 LLM配置模型标签：{token}"
    for token in REMOVED_LLM_ROUTE_TOKENS:
        assert token not in js, f"app.js 不应再引用切换档路由：{token}"


def test_health_online_no_detail():
    """后台服务在线不写原因（九期）：在线仅绿点+名称（mk.ok(name) 无 detail），离线附原因。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "mk.ok(name)" in js, "app.js 后台服务在线不应附带原因文案"
    assert "离线：" in js, "app.js 后台服务离线应附原因文案"


def test_no_vector_db_placeholder():
    """向量数据库未配置不展示（八期）：避免「未启用」占位造成误会；MySQL 为当前唯一数据库。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in REMOVED_VECTOR_TOKENS:
        assert token not in html, f"index.html 不应再含向量库占位：{token}"
        assert token not in js, f"app.js 不应再含向量库占位：{token}"


def test_knowledge_tree_naming():
    """十五期：界面名「文档下载管理」（菜单+标题），树侧栏头保留「知识点」；旧树副标题移除。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in KNOWLEDGE_TREE_TOKENS:
        assert token in html, f"index.html 缺少知识点命名：{token}"
        assert token in js, f"app.js 缺少知识点命名：{token}"
    for token in ADMIN_MENU_TOKENS:
        assert token in html, f"index.html 缺少管理菜单：{token}"
    assert "文档下载管理" in html, "index.html 界面名应为文档下载管理"
    assert html.count("文档下载管理") >= 2, "菜单与页面标题都应叫文档下载管理"
    for token in REMOVED_TREE_TOKENS:
        assert token not in html, f"index.html 不应再含旧树标题：{token}"


def test_tree_three_levels():
    """知识点树三层结构（十一期）：领域 → 课程 → 书籍，无总根节点。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "tree-root" not in js, "app.js 不应再有总根节点渲染"
    for token in ("tree-domain", "tree-course", "tree-target"):
        assert token in js, f"app.js 缺少树层级：{token}"


def test_course_learning_order():
    """课程按学习深度排序（十一期）：COURSE_ORDER 表存在，数学分析在前、考前综合在最后。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in COURSE_ORDER_TOKENS:
        assert token in js, f"app.js 缺少课程顺序表：{token}"
    assert js.index("01_math_analysis") < js.index("10_qe_prep"), "数学分析应排在考前综合之前"


def test_book_type_and_course_done():
    """书籍类型徽标 + 课程完成徽标（十一期）：kind → 教材/习题集；教材+习题集均 approved 才完成。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in BOOK_TYPE_TOKENS + COURSE_DONE_TOKENS:
        assert token in js, f"app.js 缺少类型/完成徽标逻辑：{token}"


def test_panel_shows_all_books():
    """面板展示范围全部书籍（十二期）：选中范围按目标渲染，未生成候选显示「待评估」占位。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "rangeTargetsOf" in js, "app.js 缺少范围书籍收集逻辑"
    assert "待评估" in js, "app.js 缺少待评估占位文案"


def test_tree_filter_linkage():
    """树→筛选器单向联动（十二期）：点领域/课程同步弹层筛选；课程选项随领域收窄。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "courseDomain" in js, "app.js 缺少课程→领域映射"
    assert "state.filters.course = id" in js, "app.js 缺少树选中联动筛选逻辑"
    assert "filterData.courseOptions.filter" in js, "app.js 课程选项应随领域收窄"


def test_tree_click_no_bubble():
    """树行点击防冒泡（十三期回归守护）：点课程不应冒泡覆盖成领域选中。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "stopPropagation" in js, "app.js 树行点击应阻止冒泡"
    assert "阻止冒泡" in js, "app.js 树行点击缺少防冒泡逻辑"


def test_course_console():
    """课程操作条（十三期控制台）：选中课程显示操作条（① 搜索书籍 + 步骤进度），
    工具栏全局「触发评估」移除。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in ("course-console", "btn-course-search"):
        assert token in html, f"index.html 缺少课程操作条：{token}"
    assert "btn-evaluate" not in html, "index.html 不应再有全局触发评估按钮"
    assert "courseSteps" in js, "app.js 缺少课程步骤进度逻辑"
    assert "① 搜索书籍" in js, "app.js 缺少搜索书籍按钮文案"


def test_admin_views_are_exclusive():
    """管理视图互斥（七期回归守护）：showAdminView 切换 .active，仅当前视图显示。

    六期曾因缺失 .view 显隐规则导致四个界面同时叠加显示；此测试防止复发。
    """
    css = (WEB / "style.css").read_text(encoding="utf-8")
    # 默认隐藏 + active 显示（.view / .view.active 两条规则都必须存在）
    assert re.search(r"\.view\s*\{[^}]*display\s*:\s*none", css), "style.css 缺少 .view 默认隐藏规则"
    assert re.search(r"\.view\.active\s*\{[^}]*display\s*:\s*block", css), "style.css 缺少 .view.active 显示规则"


def test_tree_count_format():
    """树计数标注栏（五期）：计数渲染为「名称（N本）」格式。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in TREE_COUNT_TOKENS:
        assert token in js, f"app.js 缺少计数格式：{token}"


def test_filter_popover_present():
    """按钮弹层筛选器（五期）：弹层容器就位，样式浅底深字可读。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    css = (WEB / "style.css").read_text(encoding="utf-8")
    for token in FILTER_POPOVER_TOKENS:
        assert token in html, f"index.html 缺少弹层筛选容器：{token}"
        assert token in js, f"app.js 缺少弹层筛选逻辑：{token}"
        assert token in css, f"style.css 缺少弹层筛选样式：{token}"


def test_dashboard_charts_removed():
    """旧图表移除（五期）：环形图/条形图不再存在（信息由流水线与健康面板覆盖）。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in ("donut-chart", "course-bars"):
        assert token not in html, f"index.html 不应再含旧图表容器：{token}"
        assert token not in js, f"app.js 不应再含旧图表逻辑：{token}"


def test_default_select_math_domain():
    """进入文档下载管理默认选中数学领域（十五期）：loadTree 完成后若无既有选择则选中「数学」。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in DEFAULT_DOMAIN_TOKENS:
        assert token in js, f"app.js 缺少默认选中数学领域逻辑：{token}"
    # 默认选中必须发生在 renderTree 之后（树节点已就绪），且仅当尚无选择
    assert js.index("renderTree()") < js.index('selectNode("domain", "数学")'), "默认选中应在树渲染后"


def test_domain_course_pager():
    """领域级课程分页（十五期）：renderPanelByCourses 按课程分组、每页 PAGE_SIZE=3 门、带翻页控件。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in COURSE_PAGER_TOKENS:
        assert token in js, f"app.js 缺少课程分页逻辑：{token}"
    assert "PAGE_SIZE = 3" in js, "PAGE_SIZE 应为 3"
    assert "slice(" in js, "分页应切片课程列表"


def test_paired_course_targets():
    """配套对判定（十五期）：同课程 book+exercise 作者集相同（排序后 join、非空）才算配套。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    fn = "function pairedCourseTargets"
    assert fn in js, "app.js 缺少配套对判定函数"
    seg = js[js.index(fn):js.index(fn) + 600]
    assert "sort()" in seg and "join" in seg, "配套判定应基于作者集排序后 join"
    assert '"book"' in seg and '"exercise"' in seg, "配套判定应区分 book/exercise"
    for token in PAIRED_ROW_TOKENS:
        assert token in js, f"app.js 缺少配套并排行样式类：{token}"


# 十六期（QED-021）：配套资料分类 + 人工下载登记——libgen 等发现专用来源无直链，
# 前端展示下载方案（links）并提供相对路径登记入口（register 端点）
SUPPLEMENT_TOKENS = ("配套资料", "supplement")
REGISTER_TOKENS = ("/register", "relative_path", "人工下载登记", "下载方案")


def test_supplement_kind_label_present():
    """配套资料（supplement）类型徽标（QED-021）：book 教材 / exercise 习题集 / supplement 配套资料。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in SUPPLEMENT_TOKENS:
        assert token in js, f"app.js 缺少 supplement 类型徽标逻辑：{token}"


def test_manual_register_and_links_present():
    """人工下载登记（QED-021）：pending_manual 卡片提供相对路径登记入口（/register），
    发现专用来源（libgen_li）的下载方案（links）在卡片/详情中展示。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in REGISTER_TOKENS:
        assert token in js, f"app.js 缺少人工登记/下载方案逻辑：{token}"


def test_app_js_single_entry_8900():
    """前端唯一入口（ADR 0007）：app.js 不得直连 8901/8902（数据域/服务域均经 8900）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert ":8901" not in js and ":8902" not in js, "app.js 不应直连 8901/8902（唯一入口 8900）"
    assert 'const API_BASE = "http://127.0.0.1:8900/api/v1"' in js, "app.js 应以 API_BASE 统一 8900"
    assert "/services" in js, "app.js 服务健康应经 8900 /services 获取"
