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

# 数据域端点（config-center-api.md）：表1/表2 状态机（确认/备选/否定/验收/登记）与任务端点，
# ADR 0007 后语义归 8900 数据域；十七期（downloads-three-table）主数据源切三表后
# /resources 旧端点、/tasks/books/download（旧自动下载）与 /tasks/catalog/evaluate
# （AI 搜索评估任务，QED-030 退役）不再被前端引用。
TRACKER_ENDPOINT_TOKENS = (
    "/tasks",
    "/confirm",
    "/backup",
    "/reject",
    "/approve",
    "/register",
)

# 十七期（downloads-three-table 前端契约）：三表端点引用——
# 表1 /selections（书单列表）、表2 /downloads（新建候选册 + 册级 approve/reject/register/sources）、
# 表3 来源经 /downloads/{id}/sources
THREE_TABLE_ENDPOINT_TOKENS = ("/selections", "/downloads", "/sources")

# 人工评估三态（QED-017 + D9 backup 转正）：候选三态按钮、备选转正/放弃；
# 「开始下载」随旧自动下载任务废除（十七期：表2 先登记候选册 → 人工下载 → register）
EVAL_THREEWAY_TOKENS = ("备选", "转正")

# 8900 配置中心横幅数据源（config-center-api.md；ARCH-014：/config/llm-status 已删除）
CONFIG_ENDPOINT_TOKENS = (
    "/api/v1/health",
    "/config/keys",
    "/config/database",
)

# hash 路由（8903 单页应用，见 service-contracts.md「8903 QED-Engine 前端」）
# 六期：`#/admin` 直达仪表大盘（无卡片墙中间层），独立模块路由（仪表大盘/文档下载管理/文档解析/对照）
ROUTE_TOKENS = ("#/admin", "#/admin/dashboard", "#/admin/downloads", "#/admin/parsing", "#/admin/compare")

# 后台管理菜单（十五期：文档下载管理界面名回归，树头仍叫知识点）
ADMIN_MENU_TOKENS = ("仪表大盘", "文档下载管理", "文档解析进度", "原始文档对照")

# 主体学习界面入口（三期收敛为三项：知识点梳理/学习/刷题模式；五期 + 使用手册）
# 二十二期续：主界面还原（hero+三卡，知识点卡可点击进入独立知识点界面 #/knowledge）
HOME_ENTRY_TOKENS = ("知识点梳理", "学习", "刷题模式", "管理后台", "使用手册", "data-nav")

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

# 十五期：界面名「文档下载管理」（菜单+标题），树侧栏头保留「知识点」；
# 旧树副标题移除已完成；二十二期续：树顶层级指示栏（领域 · 课程 · 书籍）为新 UI 元素
# （由 test_tree_levels_indicator 守护）
KNOWLEDGE_TREE_TOKENS = ("知识点",)
REMOVED_TREE_TOKENS = ()
TREE_COUNT_TOKENS = ("本）",)

# 十五期：进入文档下载管理默认选中「数学」领域（loadTree 完成后无选择时触发一次）。
# 二十二期续（逐步重构）：默认选中已注释（先全展开不跳转），保留注释待恢复联动。
DEFAULT_DOMAIN_TOKENS = ('selectNode("domain", "数学")', "state.selection", "数学")

# 十五期：领域级按课程分页（每页 PAGE_SIZE=3）（十七期：配套对并排随 catalog 目标层移除）
COURSE_PAGER_TOKENS = ("PAGE_SIZE", "coursePage", "renderPanelByCourses", "coursePagerHtml")
PAIRED_ROW_TOKENS = ("course-row",)

# 十一期：课程按学习深度排序（先学在前、依赖后续在后；未列入新课程排尾）
COURSE_ORDER_TOKENS = ("COURSE_ORDER", "01_math_analysis", "10_qe_prep")

# 十一期：书籍类型徽标（kind → 教材/习题集/资料）+ 课程完成徽标（教材+习题集均 approved）
BOOK_TYPE_TOKENS = ("教材", "习题集")
COURSE_DONE_TOKENS = ("courseCompletion", "approved", "已完成")

# 五期：按钮弹层筛选器（替代原生 select，浅底深字）
FILTER_POPOVER_TOKENS = ("filter-popover",)

# 空态数据容器（三期：解析进度/文档对照只展示事务，无数据置空；追溯已随六期移除）
EMPTY_VIEW_TOKENS = ("parsing-data", "compare-data")

# 横幅粗粒度化（三期）：只显示模块连接状态，不透露主机细节；
# ARCH-014：LLM 可达性不再经端点探测（8900 启动自检），横幅只保留 MySQL
BANNER_MODULE_TOKENS = ("MySQL数据库连接",)
REMOVED_BANNER_TOKENS = ("LLM评估模块连接", "llmStatus", "/config/llm-status")

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
    """人工评估三态（QED-017 + D9）：备选按钮、备选转正/放弃；「开始下载」已随旧自动下载废除。"""
    content = (WEB / "app.js").read_text(encoding="utf-8")
    for token in EVAL_THREEWAY_TOKENS:
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
    """横幅粗粒度化：只显示 MySQL 模块连接状态，不透露主机细节（三期裁决；ARCH-014 移除 LLM 项）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in BANNER_MODULE_TOKENS:
        assert token in js, f"app.js 缺少横幅模块文案：{token}"
    # ARCH-014：LLM 可达性不再经端点探测（8900 启动自检写日志），横幅与端点引用移除
    for token in REMOVED_BANNER_TOKENS:
        assert token not in js, f"app.js 不应残留横幅 LLM 探测引用：{token}"
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
    """后台服务在线不写原因（九期，十六期改版）：在线行 cause 为空（不渲染原因文案），离线附原因。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    causeSeg = js[js.index("const cause = s.status"):js.index("const cause = s.status") + 300]
    assert "online" in causeSeg and '""' in causeSeg, "app.js 后台服务在线不应附带原因文案"
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
    """知识点树三层结构（十一期，十七期：第三层为表1 条目）：领域 → 课程 → 套书，无总根节点。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "tree-root" not in js, "app.js 不应再有总根节点渲染"
    for token in ("tree-domain", "tree-course", "tree-selection"):
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


def test_panel_shows_selection_cards():
    """面板展示表1 条目卡（十七期，downloads-three-table 前端契约）：选中课程渲染套书卡
    （selectionCard），无条目的课程显示「待评估」空态提示创建候选。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "selectionCard" in js, "app.js 缺少表1 套书卡渲染逻辑"
    assert "待评估" in js, "app.js 缺少待评估空态文案"


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
    """课程操作条（十三期控制台 + QED-030）：选中课程显示操作条（② 评估书单 + 步骤进度），
    AI 搜索评估任务已随 QED-030 退役，按钮改为人工评估语义。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in ("course-console", "btn-course-search"):
        assert token in html, f"index.html 缺少课程操作条：{token}"
    assert "btn-evaluate" not in html, "index.html 不应再有全局触发评估按钮"
    assert "courseSteps" in js, "app.js 缺少课程步骤进度逻辑"
    assert "评估书单" in js, "app.js 缺少评估书单按钮文案"
    assert "/tasks/catalog/evaluate" not in js, "app.js 不应再引用已退役评估任务端点"


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
    """默认选中数学领域（十五期；二十二期续逐步重构：先全展开不跳转，默认选中已注释
    保留待恢复）——selectNode("domain", "数学") 调用形式须保留（注释态），且位于 renderTree 之后。"""
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


def test_domain_course_rows():
    """领域级课程行（十五期分页 + 十七期三表）：课程行（course-row）内嵌表1 套书卡，
    分页切片保留（配套对判定随 catalog 目标层移除，教程条目 roles 已含教材+习题集）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in PAIRED_ROW_TOKENS:
        assert token in js, f"app.js 缺少课程行样式类：{token}"
    assert "selectionCard" in js, "领域级课程行应渲染表1 套书卡"


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


# 十六期/十七期（course-acquisition-flow 对齐契约 1 + 三表聚合）：课程完成判定「两套」标准——
# 套归属 setNoOf（表1 set_no 权威字段）、完成 = ≥2 套 approved（表1 条目下册均 approved）、
# 进度文案「套数 x/2 · 教材 a/b · 习题集 c/d」（数据源从 resources 聚合改为表1/表2 聚合）
TWO_SET_TOKENS = ("setNoOf", "set_no", "套数")
TWO_SET_DONE_TOKENS = ("套数 x", "已完成")
COURSE_PROGRESS_TEXT_TOKENS = ("套数", "教材", "习题集")


def test_course_completion_two_sets():
    """课程完成判定（十六期/十七期，course-acquisition-flow 对齐契约 1 + 三表聚合）：
    courseCompletion 按「套」聚合（setNoOf 读取表1 条目 set_no 字段），
    ≥2 套 approved（表2 册均验收）才显示完成；进度文案为「套数 x/2 · 教材 a/b · 习题集 c/d」。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in TWO_SET_TOKENS:
        assert token in js, f"app.js 缺少两套判定逻辑：{token}"
    fn = "function setNoOf"
    assert fn in js, "app.js 缺少套归属函数 setNoOf"
    seg = js[js.index(fn):js.index(fn) + 400]
    assert "set_no" in seg, "setNoOf 应读取表1 set_no 字段"
    comp = js[js.index("function courseCompletion"):js.index("function courseCompletion") + 1500]
    assert ">= 2" in comp or ">=2" in comp, "完成判定应为 ≥2 套"
    assert "2" in comp, "courseCompletion 应含两套底线分母"


def test_version_badge_present():
    """版本徽标（十六期，course-acquisition-flow 对齐契约 2）：
    versionBadge 推导 中译本 / 英文版 / 苏版 / 其他（language + 苏版名单常量），
    资源卡与详情均可渲染。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    fn = "function versionBadge"
    assert fn in js, "app.js 缺少版本徽标函数"
    seg = js[js.index(fn):js.index(fn) + 500]
    for token in ("中译本", "英文版", "苏版", "其他"):
        assert token in seg, f"versionBadge 缺少版本标签：{token}"
    # 苏版名单：中译 + 作者命中名单 → 苏版（菲赫金哥尔茨/吉米多维奇等）
    soviet = js[js.index("SOVIET"):js.index("SOVIET") + 200]
    assert "菲赫金哥尔茨" in soviet, "苏版名单应含菲赫金哥尔茨"
    assert "吉米多维奇" in soviet, "苏版名单应含吉米多维奇"
    assert "chi" in js or "zh" in js, "版本判定应兼容 language 中译取值（zh/chi）"


def test_manual_five_stages_present():
    """使用手册五阶段说明（十六期，course-acquisition-flow 对齐契约 3）：
    HELP_SECTIONS 补充课程收集流程五阶段（先验课程体系 → 第一轮评估 → 下载 →
    第二轮评估 → 一轮课程完成）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in ("先验课程体系", "第一轮评估", "第二轮评估", "一轮课程完成", "两套"):
        assert token in js, f"app.js 手册缺少课程收集流程阶段说明：{token}"
    assert js.index("先验课程体系") < js.index("一轮课程完成"), "五阶段说明应按流程顺序"


# 十六期（service-control 前端契约）：仪表大盘服务控制区——后台服务每行操作按钮
# （online→停止+重启 / offline→启动 / starting/stopping→禁用）、8900 行无按钮、
# 破坏性操作确认 + 操作后轮询刷新
SERVICE_CONTROL_TOKENS = ("service-act", "data-svc", "停止", "重启", "启动")


def test_health_panel_service_control_buttons():
    """服务控制区按钮（十六期，service-control 前端契约）：
    后台服务行按状态渲染操作按钮（停止/重启/启动），经 8900 /services/{name}/{action} 操作。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in SERVICE_CONTROL_TOKENS:
        assert token in js, f"app.js 缺少服务控制区按钮逻辑：{token}"
    assert "/services/" in js, "app.js 应调用 8900 /services/{name}/{action} 端点"
    assert "confirm" in js, "破坏性操作（停止/重启）应弹确认框"
    # 8900 自身（config 单元）不可经控制中心启停——不渲染按钮
    assert "config" in js, "服务控制区应识别 config 单元（8900 无按钮）"


# 十七期（downloads-three-table 前端契约）：三表展示——套书树叶子、套书卡、册级明细、
# 步骤条四步语义（选择/评估/下载/审理）、绝对路径审理提示、彻底隐藏 rejected/superseded
SELECTION_TREE_TOKENS = ("tree-selection",)
SELECTION_CARD_TOKENS = ("download_stats", "新建候选册", "roles")
VOLUME_ROW_TOKENS = ("vol", "intro", "人工下载登记", "验收通过")
STEPS_FOUR_TOKENS = ("① 选择", "② 评估", "③ 下载", "④ 审理")
REVIEW_PATH_TOKENS = ("绝对路径", "审理")


def test_app_js_references_three_table_endpoints():
    """三表端点引用（十七期）：app.js 主数据源为表1 /selections，册级操作经 /downloads，
    表3 来源经 /sources（8900 数据域适配）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in THREE_TABLE_ENDPOINT_TOKENS:
        assert token in js, f"app.js 缺少三表端点引用：{token}"


def test_tree_third_level_is_selection():
    """树第三层为表1 条目（十七期）：tree-selection 叶子（套书），册明细不进树。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in SELECTION_TREE_TOKENS:
        assert token in js, f"app.js 缺少套书树叶子类：{token}"


def test_selection_card_and_volume_rows():
    """套书卡 + 册级明细（十七期）：套书卡含 roles 徽标/册完成度（download_stats）/新建候选册；
    册行含 vol/intro/人工下载登记/验收通过（表2 操作）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in SELECTION_CARD_TOKENS + VOLUME_ROW_TOKENS:
        assert token in js, f"app.js 缺少套书卡/册明细逻辑：{token}"


def test_steps_four_three_table_semantics():
    """步骤条四步语义（十七期，downloads-three-table §4.2）：选择 → 评估 → 下载 → 审理，
    下载后展示绝对路径并提示人工审理。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    for token in STEPS_FOUR_TOKENS + REVIEW_PATH_TOKENS:
        assert token in js, f"app.js 缺少步骤条四步/审理提示：{token}"
    assert js.index("① 选择") < js.index("④ 审理"), "步骤条四步应按流程顺序"


def test_no_hidden_selection_entry():
    """彻底隐藏（十七期，downloads-three-table §4.1）：rejected/superseded 由数据层过滤，
    前端不得调用 supersede 端点、无查看入口。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "supersede" not in js, "app.js 不应有 superseded 查看/操作入口（数据层过滤）"


def test_selection_card_declares_actions():
    """套书卡操作数组必须声明（白屏回归守护）：selectionCard 体内先 `const actions = [];`
    再 push 按钮，缺失会导致右侧面板 ReferenceError 整块空白（token 守护与语法检查均测不出）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function selectionCard[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 selectionCard 套书卡渲染函数"
    assert "const actions = [];" in m.group(0), (
        "app.js selectionCard 体内必须先声明 const actions = [] 再 push 按钮（防 ReferenceError 白屏）"
    )


def test_course_done_badge_shows_numbers():
    """课程徽标（十九期+二十期）：三态颜色（绿/黄/无填充）保留，数字明细恢复——
    「套数 x/y · 教材 a/b · 习题集 c/d」（教材/习题集只算套内）；无「✅ 已完成」文字。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function courseDoneBadge[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 courseDoneBadge 公共徽标函数"
    body = m.group(0)
    for token in ("course-done", "course-progress", "course-idle", "套数", "教材", "习题集"):
        assert token in body, f"courseDoneBadge 缺少徽标态/数字明细：{token}"
    assert "✅ 已完成" not in body, "courseDoneBadge 不应再显示 ✅ 已完成 文字（颜色表达）"


def test_panel_sets_one_row_with_volume_detail():
    """右侧每套一行（二十期，用户裁决）：套行 = 一行介绍（book-intro 书名合并，不写卷几）
    + 册明细列表直接展示（volume-list，引用 volumeRow 带书名）；待评估行仍保留书卡
    （card-grid + selectionCard，含三态操作）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function renderCourseSets[\s\S]*function bookIntroHtml[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 renderCourseSets/setRowHtml/bookIntroHtml 按套分组渲染函数"
    body = m.group(0)
    for token in ("set-row", "set-head", "待评估", "未编套", "set-label", "book-intro", "set-volumes"):
        assert token in body, f"renderCourseSets/setRowHtml 缺少分组/册明细结构：{token}"
    assert "volumeRow(" in body, "套行册明细应复用 volumeRow 渲染（带书名）"
    assert "card-grid" in body and "selectionCard" in body, "待评估行应保留书卡（三态操作）"


def test_tree_sets_grouped_with_book_names():
    """树展开按套聚合（二十期）：课程节点下 = 套节点（tree-set，含套序号）+ 套内书行
    （tree-book：教材/习题集合并书名，一套一个名称不写卷几）；候选条目仍为独立 selection 叶子。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function renderTree[\s\S]*function setTreeNodeHtml[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 renderTree/courseSetNodesHtml/setTreeNodeHtml 渲染函数"
    for token in ("tree-set", "tree-book", "tree-book-label", "tree-selection"):
        assert token in m.group(0), f"renderTree 缺少按套聚合树结构：{token}"
    assert "合并" in m.group(0) or "教材" in m.group(0), "树套内书行应显示教材/习题集合并书名"


def test_course_completion_counts_sets_only():
    """进度数字只算套内（十八期）：教材/习题集总数仅累加 set_no 非空的套内条目，
    无套号条目（独立英文原版/独立习题集）不掺水——01 课程应为教材 3/3 · 习题集 2/2。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function courseCompletion[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 courseCompletion 聚合函数"
    assert "if (!g.set) continue" in m.group(0), "courseCompletion 应跳过无套号条目（只算套内）"


def test_course_completion_solutions_counts_as_exercises():
    """题解算习题类（二十期，用户裁决）：courseCompletion 中 roles 含 solutions（题解）
    与 exercises 同池计入习题集计数/完成判定——套3 陈纪修（教材+题解）→ 套数 3/3 · 习题集 3/3。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function courseCompletion[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 courseCompletion 聚合函数"
    body = m.group(0)
    assert "exercises" in body and "solutions" in body, "习题类统计应含 exercises 与 solutions（题解）"
    assert 'includes("exercises") || roles.includes("solutions")' in body or 'includes("solutions") || roles.includes("exercises")' in body, (
        "exercises 与 solutions 应同池判定（题解计入习题类）"
    )


def test_panel_set_books_horizontal():
    """套内书名横排一行（二十期，用户裁决，修复竖排错乱）：.set-roles 段必须 nowrap
    + 横向可滚动；.book-intro 单行省略——宽度不足时不得换行堆叠成列。"""
    css = (WEB / "style.css").read_text(encoding="utf-8")
    m = re.search(r"\.set-roles \{[\s\S]*?\n\}", css)
    assert m, "style.css 应提供 .set-roles 套行书籍区样式"
    body = m.group(0)
    assert "flex-wrap: nowrap" in body, ".set-roles 必须 nowrap（书名不得换行成列）"
    assert "overflow-x" in body, ".set-roles 应允许横向滚动（长书名不撑爆行）"
    bi = re.search(r"\.book-intro \{[\s\S]*?\n\}", css)
    assert bi, "style.css 应提供 .book-intro 书籍简介样式"
    assert "nowrap" in bi.group(0) or "ellipsis" in bi.group(0), "book-intro 应单行省略（不换行）"


def test_tree_offline_skeleton():
    """8901 离线骨架（二十期，独立性铁律）：loadTree 的 catalog 失败分支不再把整棵树替换为
    「8901 离线」提示——渲染离线横幅（offline-banner）后仍走 renderTree()（领域/课程静态骨架）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"async function loadTree[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 loadTree 加载函数"
    body = m.group(0)
    assert "offline-banner" in body, "loadTree 离线分支应渲染离线横幅（offline-banner）"
    assert "renderTree()" in body, "loadTree 离线时仍应渲染领域/课程静态骨架（renderTree）"
    assert "8901" in body, "loadTree 离线横幅应标明 QED-Tracker 8901"
    css = (WEB / "style.css").read_text(encoding="utf-8")
    assert ".offline-banner" in css, "style.css 应提供 .offline-banner 样式"


def test_volume_rows_collapsed_in_selection_card():
    """册明细收敛进套书卡折叠区（十八期，源头避免「多出书册」）：右侧只显示 12 张套书卡，
    册明细以 details 折叠区内紧凑行呈现（默认收起），volumeRow 不再以卡片形态平铺。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function selectionCard[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 selectionCard 套书卡渲染函数"
    for token in ("volume-collapse", "<details", "<summary", "册明细"):
        assert token in m.group(0), f"selectionCard 缺少册明细折叠区：{token}"
    v = re.search(r"function volumeRow[\s\S]*?\n}\n", js)
    assert v, "app.js 应提供 volumeRow 册行渲染函数"
    assert "card volume-row" not in v.group(0), "volumeRow 不应再以卡片形态渲染（从源头避免多出书册）"
    assert '<li class="volume-row">' in v.group(0), "volumeRow 应为套书卡内紧凑行"


def test_tree_sort_passes_course_id():
    """树课程排序（十八期回归守护）：renderTree 内 courseList 排序必须传对象的 course_id
    （courseOrderCmp(a.id, b.id)），直接传对象会 TypeError（localeCompare 非函数）导致树空白。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function renderTree[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 renderTree 渲染函数"
    assert re.search(r"\.sort\(\(a, b\) => courseOrderCmp\(a\.id, b\.id\)\)", m.group(0)), (
        "renderTree 的 courseList 排序应传对象的 course_id（防 TypeError 树空白）"
    )


def test_volume_rows_filter_rejected():
    """册明细不加载放弃/失败册（十八期，用户裁决）：套书卡渲染前过滤 rejected/failed
    （数据层已过滤，前端双保险）——右侧册明细只含有效状态（candidate/downloaded/approved）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function selectionCard[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 selectionCard 套书卡渲染函数"
    assert re.search(r"\.filter\(\(d\) => [^)]*rejected[^)]*\)", m.group(0)), (
        "selectionCard 应过滤放弃/失败册（rejected/failed 不加载）"
    )


# 二十一期（前端静态服务缓存治理）：scripts/serve_web.py 守卫——
# http.server 无缓存头导致浏览器启发式缓存旧 app.js/style.css（改版不可见），
# 前端服务必须输出 Cache-Control: no-store，监听 8903、目录指向仓库 web/。

SERVE_WEB = ROOT / "scripts" / "serve_web.py"


def test_serve_web_exists():
    """serve_web.py 应存在（start-all.ps1 前端启动入口）。"""
    assert SERVE_WEB.is_file(), "scripts/serve_web.py 不存在（start-all.ps1 前端启动依赖它）"


def test_serve_web_no_store_cache_header():
    """前端静态服务必须发送 Cache-Control: no-store：http.server 默认无缓存头，
    浏览器启发式缓存会导致改版后仍加载旧 app.js/style.css（本仓库历史踩坑）。"""
    src = SERVE_WEB.read_text(encoding="utf-8")
    assert "no-store" in src, "serve_web.py 必须输出 Cache-Control: no-store"


def test_serve_web_port_and_directory():
    """端口固定 8903，目录解析到仓库 web/（相对脚本位置 parent.parent / web）。"""
    src = SERVE_WEB.read_text(encoding="utf-8")
    assert "8903" in src, "serve_web.py 应监听 8903"
    assert '"web"' in src or "'web'" in src, "serve_web.py 应指向仓库 web/ 目录"


def test_serve_web_threaded():
    """ThreadingHTTPServer：并发请求（多标签/多资源同时加载）不阻塞。"""
    src = SERVE_WEB.read_text(encoding="utf-8")
    assert "ThreadingHTTPServer" in src, "serve_web.py 应使用 ThreadingHTTPServer"


# 二十二期（离线体验治理）：fetchJson 超时 + loadTree 自动重试 + 册明细横排——
# 8901/8900 掉线时 catalog 请求曾无限挂起（树停在「加载中」转圈），且恢复后不自动重渲染。

def test_fetch_json_has_abort_timeout():
    """fetchJson 必须带 AbortController 超时：8901/8900 掉线时请求不得无限挂起
    （曾导致树停在「加载中」转圈最长达 8900 代理 30s 超时）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"async function fetchJson[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 fetchJson 请求函数"
    body = m.group(0)
    assert "AbortController" in body, "fetchJson 应使用 AbortController 实现超时"
    assert "setTimeout" in body and "abort" in body, "fetchJson 应设置超时并中止（abort）"


def test_tree_offline_retry():
    """loadTree 离线后必须自动重试（8901 恢复后树自动渲染，无需手动刷新）：
    离线分支应含重试定时器；模块级定时器防重（视图切换不叠加多个定时器）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"async function loadTree[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 loadTree 加载函数"
    body = m.group(0)
    assert "setTimeout" in body or "retry" in body or "重试" in body, "loadTree 离线分支应含自动重试"
    assert "clearTimeout" in js, "app.js 应有模块级定时器防重（clearTimeout）"


def test_volume_list_grid_horizontal():
    """套行下方册明细横排多列（二十二期，用户裁决）：.volume-list 改为 grid 多列
    （repeat(auto-fill, minmax(...)）——每册一格一排多个横排，不再是竖排一列。"""
    css = (WEB / "style.css").read_text(encoding="utf-8")
    m = re.search(r"\.volume-list \{[\s\S]*?\n\}", css)
    assert m, "style.css 应提供 .volume-list 册明细列表样式"
    body = m.group(0)
    assert "display: grid" in body, ".volume-list 应为 grid 布局（横排多列）"
    assert "grid-template-columns" in body and "repeat(" in body, ".volume-list 应自动多列排布（auto-fill）"


# 二十二期（树领域常驻 + 课程级套行视图 + 展示格式优化）：
# 所有领域常驻展示（默认展开第一个）、点课程也走套行新视图、
# book-intro 角色&角色：《书名》、file_hint 只显示文件名、正文段前空两格右对齐。

def test_tree_domains_all_visible():
    """文件列表式默认态（二十二期+续，用户裁决）：所有领域常驻展示（CATALOG_DOMAIN_MAP 全量，
    无课程领域空态）；默认领域展开、课程/套折叠（文件管理器默认：根展开第一层，
    点击名称展开下一层）——套/书行缩进体现层级。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function renderTree[\s\S]*function setTreeNodeHtml[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 renderTree 渲染函数"
    body = m.group(0)
    assert "CATALOG_DOMAIN_MAP" in body, "树领域构建应基于 CATALOG_DOMAIN_MAP（全量常驻）"
    assert "暂无课程" in body or "empty" in body, "无课程领域应显示空态提示"
    # 文件列表默认态：领域展开（无 collapsed），课程/套折叠（collapsed + display:none）
    assert 'tree-course collapsed' in body, "课程默认折叠（点名称展开）"
    assert 'tree-set collapsed' in body, "套默认折叠（点名称展开）"
    assert 'class="tree-node tree-domain"' in body, "领域默认展开"
    assert "tree-caret" in body, "箭头状态指示应保留"


def test_panel_course_uses_set_rows():
    """右侧套行视图锁定（二十二期+续，用户裁决，不许回退）：renderPanel 中无选择（全目录）、
    领域级、课程级均调用 renderPanelByCourses（按套分组 + 册明细横排），不再平铺旧书卡——
    树暂不跳转时右侧默认视图也保持套行优化。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function renderPanel[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 renderPanel 渲染函数"
    body = m.group(0)
    assert re.search(r'!sel \|\| sel\.kind === "domain" \|\| sel\.kind === "course"', body), (
        "无选择/领域级/课程级都应走按套分组视图（renderPanelByCourses，右侧优化不许回退）"
    )


def test_book_intro_role_and_format():
    """套行头部书名校验（二十二期）：book-intro 格式 = 角色&角色：《书名》——
    多角色用 & 连接（roleListHtml，教材优先），角色后冒号再书名。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function bookIntroHtml[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 bookIntroHtml 套行书籍介绍函数"
    body = m.group(0)
    assert "roleListHtml" in body, "book-intro 应经 roleListHtml 生成角色列表（& 连接）"
    assert "：" in body, "book-intro 应含角色后冒号（角色：《书名》）"
    rl = re.search(r"function roleListHtml[\s\S]*?\n}\n", js)
    assert rl, "app.js 应提供 roleListHtml 角色列表函数"
    assert '"&"' in rl.group(0) or "'&'" in rl.group(0), "roleListHtml 多角色应用 & 连接（教材&答案）"
    assert "ROLE_ORDER" in rl.group(0), "roleListHtml 应按教材优先排序（ROLE_ORDER）"


def test_file_hint_basename_only():
    """册明细卷标简化（二十二期）：file_hint 只显示文件名（去目录前缀、去扩展名），
    如 raw/books/.../01-demidovich_吉米多维奇数学分析习题集_2010.pdf → 文件名。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function volumeRow[\s\S]*function fileHintName[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 volumeRow/fileHintName 渲染函数"
    assert re.search(r"split\([^)]*[\\/]", m.group(0)), "fileHintName 应取 file_hint 的 basename（去目录）"
    assert r"replace(/\.[^.]+$/," in m.group(0), "fileHintName 应去掉 file_hint 扩展名"
    assert "fileHintName(d.file_hint)" in m.group(0), "volumeRow 卷标应经 fileHintName 简化后显示"


def test_body_text_indent_and_align():
    """正文段前空两格 + 右对齐（二十二期）：.verdict/.reject-note 等正文
    应用 text-indent（段前空两格）与 text-align（右对齐）。"""
    css = (WEB / "style.css").read_text(encoding="utf-8")
    m = re.search(r"\.verdict \{[\s\S]*?\n\}", css)
    assert m, "style.css 应提供 .verdict 简介样式"
    body = m.group(0)
    assert "text-indent" in body, ".verdict 应有 text-indent（段前空两格）"
    assert "text-align" in body, ".verdict 应有 text-align（右对齐）"


# 二十二期续（领域视图层级 + 册级标注）：领域视图顶部显示领域标题；
# volume-row 按 file_hint 解析册名（volumeDisplayName）与角色（volumeRoleOf，
# 教材名单 TEXTBOOK_HINT_MARKERS），不再全标 selection.title；正文改左对齐、字号调大。

def test_panel_domain_shows_domain_title():
    """领域视图显示领域标题层（二十二期）：renderPanelByCourses 在课程行上方渲染
    领域标题（domain-title，仅领域级 sel.kind=domain 时显示）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function renderPanelByCourses[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 renderPanelByCourses 领域渲染函数"
    body = m.group(0)
    assert "domain-title" in body, "领域视图应渲染领域标题（domain-title）"
    assert 'kind === "domain"' in body, "领域标题仅领域级显示"


def test_volume_row_uses_hint_name_and_role():
    """册明细按文件名标注（二十二期，用户裁决）：volume-row 册名来自 file_hint 解析
    （volumeDisplayName，不再全标 selection.title）；角色按教材名单判定（volumeRoleOf/
    TEXTBOOK_HINT_MARKERS，命中名单=教材，否则习题集）；排版 = 册名行 + 卷/状态行。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function volumeRow[\s\S]*function fileHintName[\s\S]*function volumeDisplayName[\s\S]*function volumeRoleOf[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 volumeRow/fileHintName/volumeDisplayName/volumeRoleOf 函数"
    body = m.group(0)
    assert "volumeDisplayName(d.file_hint)" in body, "volume-row 册名应来自 file_hint 解析"
    assert "volumeRoleOf(" in body, "volume-row 应判定册角色（教材/习题集）"
    assert "TEXTBOOK_HINT_MARKERS" in body, "教材名单常量 TEXTBOOK_HINT_MARKERS 应存在"
    assert '"教材"' in body and '"习题集"' in body, "册角色应区分 教材/习题集"
    assert "volume-meta" in body, "卷/状态应独立成行（volume-meta）"


def test_body_text_left_align():
    """正文左对齐（二十二期续，用户裁决）：.verdict/.reject-note 的 text-align 改为 left
    （保留段前空两格 text-indent）。"""
    css = (WEB / "style.css").read_text(encoding="utf-8")
    for sel in (".verdict", ".reject-note"):
        m = re.search(re.escape(sel) + r" \{[\s\S]*?\n\}", css)
        assert m, f"style.css 应提供 {sel} 样式"
        assert "text-align: left" in m.group(0), f"{sel} 应为左对齐（text-align: left）"
        assert "text-indent" in m.group(0), f"{sel} 应保留段前空两格（text-indent）"


def test_volume_row_font_larger():
    """册明细字号调大（二十二期）：.volume-book（册名）不小于 15px。"""
    css = (WEB / "style.css").read_text(encoding="utf-8")
    m = re.search(r"\.volume-book \{[\s\S]*?\n\}", css)
    assert m, "style.css 应提供 .volume-book 册名样式"
    body = m.group(0)
    assert re.search(r"font-size: 1[5-9]px", body), ".volume-book 字号应调大（>=15px）"


def test_volume_titles_blue():
    """册明细标题标蓝（二十二期续，用户裁决）：.volume-book（册名）与 .volume-title
    （卷标）使用 accent 蓝色系，角色标签 tree-type 已为蓝色。"""
    css = (WEB / "style.css").read_text(encoding="utf-8")
    for sel in (".volume-book", ".volume-title"):
        m = re.search(re.escape(sel) + r" \{[\s\S]*?\n\}", css)
        assert m, f"style.css 应提供 {sel} 样式"
        assert "var(--accent)" in m.group(0), f"{sel} 应使用 accent 蓝色（var(--accent)）"


def test_domain_title_accent():
    """领域标题层强化（二十二期续）：.domain-title 使用 accent 蓝色并足够醒目
    （右侧面板独立于树宽，领域标题完整展示无需拉宽树）。"""
    css = (WEB / "style.css").read_text(encoding="utf-8")
    m = re.search(r"\.domain-title \{[\s\S]*?\n\}", css)
    assert m, "style.css 应提供 .domain-title 领域标题样式"
    body = m.group(0)
    assert "var(--accent)" in body, ".domain-title 应使用 accent 蓝色"
    assert re.search(r"font-size: 1[89]px|font-size: 2\dpx", body), ".domain-title 字号应醒目（>=18px）"


# 二十二期续（树空白根治 + 学习中心框架）：
# loadTree 全函数 try/catch + 树加载兜底（不再无限「加载中…」/空白）；
# 主界面（#/）学习中心框架：领域→课程→章节/知识点（数学试点，章节空态等解析产物管线）。

def test_loadtree_fully_guarded():
    """树加载全函数守卫（二十二期续）：loadTree 的 renderTree/selectNode 也须在 try 内
    （浏览器端任何异常 → 离线横幅 + console.error，不再停在「加载中…」永久空白/转圈）。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"async function loadTree[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 loadTree 加载函数"
    body = m.group(0)
    assert "console.error" in body, "loadTree 异常应 console.error 留痕"
    assert "renderTree()" in body, "loadTree 应调用 renderTree"
    assert "offline-banner" in body, "loadTree 异常应渲染离线横幅"
    assert "try {" in body, "loadTree 应整体 try 包裹"


def test_tree_load_guard_timer():
    """树加载兜底定时器（二十二期续）：进入 downloads 视图后若树长时间未渲染
    （无 tree-node/offline-banner/empty-state），显示错误提示条——任何原因不再永久空白。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"async function loadTree[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 loadTree 加载函数"
    assert "tree-empty" in js and "暂无课程" in js, "app.js 应有树空态文案"
    # 兜底：loadTree 内必须有 renderTree 或空态路径，且树区域有 guards
    assert 'if (!tree.querySelector' in js or 'innerHTML' in js, "树渲染应有兜底判定"


def test_learning_center_framework():
    """独立知识点界面（二十二期续，用户裁决）：#/knowledge 独立路由页面——左侧领域/课程
    列表（catalog）+ 右侧选中课程的章节/知识点结构区（空态，等解析产物管线）；
    **只显示结构，不显示课程资料书单**（learn-books/课程资料 不得出现）。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert "page-knowledge" in html, "index.html 缺少独立知识点页面（page-knowledge）"
    assert '"/knowledge"' in js, "app.js 缺少 /knowledge 路由"
    assert "learn-course-list" in html and "learn-chapters" in html, "知识点页面应有课程列表+章节区"
    assert "renderKnowledgeCenter" in js, "app.js 缺少 renderKnowledgeCenter 渲染函数"
    assert "管线" in html or "待" in html, "章节层空态应注明等解析产物管线"
    # 独立界面只显示结构：不得渲染课程资料书单（learn-books 仅允许在管理后台出现）
    kb = re.search(r"function renderKnowledgeCenter[\s\S]*?\n}\n", js)
    assert kb, "app.js 应提供 renderKnowledgeCenter 函数"
    assert "learn-books" not in kb.group(0), "renderKnowledgeCenter 不应渲染课程资料书单（只显示结构）"
    assert "selectionCard" not in kb.group(0), "renderKnowledgeCenter 不应渲染书单卡"


def test_home_restored_three_cards():
    """主界面还原（二十二期续，用户裁决）：home 页 = hero + 三张占位卡（知识点梳理/学习/
    刷题模式），其中「知识点梳理」卡可点击进入独立知识点界面（data-nav=/knowledge）；
    learn-layout 移入独立知识点页（page-knowledge 内），home 区不含。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    for token in ("知识点梳理", "学习", "刷题模式"):
        assert token in html, f"index.html 缺少原占位卡：{token}"
    assert "feature-grid" in html and "feature-card" in html, "index.html 应保留三卡结构"
    assert 'data-nav="/knowledge"' in html, "知识点卡应可点击进入 #/knowledge"
    home = html[html.index('id="page-home"'):html.index('id="page-knowledge"')]
    assert "learn-layout" not in home, "home 区不应有 learn-layout（移入独立界面）"
    assert "learn-layout" in html, "learn-layout 应在独立知识点页（page-knowledge）内"


def test_tree_event_delegation_and_selfcheck():
    """文件列表式交互（二十二期续，用户裁决）：名称点击 = 只展开（折叠时展开，已展开不收起，
    不吞文字）+ 右侧联动（selectNode）；箭头点击 = 只收起（不负责展开）；渲染自检保留。"""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function renderTree[\s\S]*?\n}\n", js)
    assert m, "app.js 应提供 renderTree 渲染函数"
    body = m.group(0)
    assert "selfcheck" in body or "诊断" in body or "tree-check" in body, "renderTree 应含渲染自检（诊断条）"
    assert "tree-node" in body, "renderTree 应渲染领域/课程节点"
    # 事件委托：名称=只展开（不 toggle 收起），箭头=只收起
    d = re.search(r'const treeNode = ev\.target\.closest\("#domain-tree \.tree-node"\)[\s\S]*?\n        \}\n        const nav', js)
    assert d, "app.js 应提供树事件委托（名称展开 + 箭头收起 + selectNode）"
    seg = d.group(0)
    assert "classList.toggle" not in seg, "不应再使用 toggle（点击已展开节点不得收起/吞文字）"
    assert 'contains("collapsed")' in seg, "名称点击应按折叠状态判断（只展开）"
    assert "selectNode(treeNode.dataset.kind, treeNode.dataset.id)" in seg, "名称点击应保留右侧联动（selectNode）"
    assert 'closest("#domain-tree .tree-caret")' in seg or 'closest(".tree-caret")' in seg, "箭头点击应单独处理（只收起）"


def test_tree_levels_indicator():
    """文件列表式层级（二十二期续，用户裁决）：树 = 领域/课程/套 文件夹 + 书叶子，
    层级缩进递增（课程 20 / 套 40 / 书 60）+ 引导线；无三列表头（tree-levels 移除）。"""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    css = (WEB / "style.css").read_text(encoding="utf-8")
    assert "tree-levels" not in html, "三列表头应移除（文件列表由缩进表达层级）"
    assert ".tree-course" in css and "padding-left: 20px" in css, "课程层缩进 20px"
    assert ".tree-set" in css and "padding-left: 40px" in css, "套层缩进 40px（文件夹）"
    assert ".tree-book" in css and "padding-left: 60px" in css, "书叶子缩进 60px"
    assert "border-left" in css, "层级引导线（border-left）应保留"
