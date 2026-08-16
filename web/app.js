"use strict";
/* QED-Engine 前端（8903 静态页）：主体学习界面 + 后台管理（hash 路由）。
 * 数据源：8900 QED 管理服务（横幅/健康/目录/资源/任务/统计 + 服务状态；ADR 0007
 * 前端唯一入口，8901/8902 由 8900 内部适配）。
 * 契约：docs/design/config-center-api.md（数据域/服务域）、docs/design/service-contracts.md；
 * 离线时各模块独立降级显示（独立性铁律）。
 * 三期（2026-08-06）：横幅粗粒度化、主界面三卡、仪表盘 SVG 图表、
 * 下载管理「知识点-领域-课程-书籍」树 + 事务面板、解析/对照空态。
 * 四期（2026-08-06）：卡片墙、严格三领域、树主评估窄 + 拖拽记忆、筛选栏、详情评估视角。
 * 五期（2026-08-06）：入口页零后台痕迹 + 使用手册、仪表大盘四阶段流水线 + 服务健康面板、
 * 知识点四级树 +（N本）计数、按钮弹层筛选器。
 * 六期（2026-08-06）：取消「模块总览」卡片墙与「追溯」，#/admin 直达仪表大盘。
 * 七期（2026-08-06）：修复管理视图互斥显示（.view 显隐规则）；界面改名
 * 仪表大盘 / 文档下载管理 / 文档解析进度（树根同步改名）。
 * 重构轮（2026-08-10）：前端唯一入口 8900（ADR 0007），健康面板改经 /services。
 * 十七期（2026-08-14，downloads-three-table）：文档下载管理主数据源切换三表——
 * 表1 qt_selections（套书/选课条目，树第三层叶子）、表2 qt_downloads（册级明细，
 * 套书卡内展开）、表3 qt_sources（渠道，详情弹窗）；旧 /resources 资源卡与
 * 「开始下载」自动任务废除（表2 先登记候选册 → 人工下载 → register 登记 → approve 验收）；
 * 步骤条四步语义：① 选择 → ② 评估 → ③ 下载 → ④ 审理（下载后绝对路径人工审理）。
 * 视觉规范：DeepSeek 蓝黑风格，样式见 style.css。 */

/* 唯一入口（ADR 0007）：8903 只连 8900。数据域（catalogs/selections/tasks）与
 * 服务域（/services）均为 8900 自有契约，内部适配 8901/8902；浏览器不再直连子服务。 */
const API_BASE = "http://127.0.0.1:8900/api/v1";
const CONFIG_BASE = API_BASE;
const TRACKER_BASE = API_BASE;

/* 端点引用表（tests/test_web.py 守护与契约一致性，勿随意改名）。
 * 十七期：selections/downloads/sources 三表端点；旧 /resources、旧自动下载任务与
 * AI 搜索评估任务端点（QED-030）已退役移除。 */
const ENDPOINTS = {
    health: "/api/v1/health",
    services: "/services",
    keys: "/config/keys",
    models: "/config/models",
    database: "/config/database",
    selections: "/selections",
    downloads: "/downloads",
    sources: "/sources",
    tasks: "/tasks",
    confirm: "/confirm",
    backup: "/backup",
    reject: "/reject",
    approve: "/approve",
    register: "/register",
};

/* 领域静态映射（ARCH-004 决策 D2）：catalog 尚无领域字段，前端映射兜底，
 * 严格三领域：分析 / 代数 / 概率论与数理统计（03 拓扑、10 考前综合并入分析，
 * 旧六领域标签已收敛为三领域）。 */
const DOMAIN_MAP = {
    "01_math_analysis": "分析",
    "03_topology": "分析",
    "04_real_analysis": "分析",
    "05_complex_analysis": "分析",
    "06_functional_analysis": "分析",
    "07_ode": "分析",
    "08_pde": "分析",
    "10_qe_prep": "分析",
    "02_linear_algebra": "代数",
    "09_abstract_algebra": "代数",
    "11_probability": "概率论与数理统计",
    "12_stochastic_processes": "概率论与数理统计",
    "13_high_dim_prob": "概率论与数理统计",
};

const DOMAIN_ORDER = ["分析", "代数", "概率论与数理统计"];

const STATUS_COLORS = {
    candidate: "#fbbf24",
    confirmed: "#60a5fa",
    downloading: "#a78bfa",
    downloaded: "#4d6bfe",
    approved: "#22c55e",
    rejected: "#ef4444",
    failed: "#ef4444",
    pending_manual: "#f97316",
    backup: "#facc15",
    not_found: "#9ca3af",
};

/* hash 路由表（tests/test_web.py 守护）。
 * URL 形式：#/（主体界面）、#/admin（直达仪表大盘）、#/admin/dashboard（仪表大盘）、
 * #/admin/downloads（知识点）、#/admin/parsing（文档解析进度）、#/admin/compare（原始文档对照） */
const ROUTES = {
    "/": { page: "home" },
    "/knowledge": { page: "knowledge" },
    "/admin": { page: "admin", view: "dashboard" },
    "/admin/dashboard": { page: "admin", view: "dashboard" },
    "/admin/downloads": { page: "admin", view: "downloads" },
    "/admin/parsing": { page: "admin", view: "parsing" },
    "/admin/compare": { page: "admin", view: "compare" },
};

const STATUS_LABEL = {
    candidate: "候选",
    confirmed: "已确认",
    downloading: "下载中",
    downloaded: "已下载",
    approved: "已验收",
    rejected: "已拒绝",
    failed: "失败",
    pending_manual: "待人工补充",
    not_found: "未找到",
    backup: "备选",
};

/* ---------- 按钮弹层筛选器（五期：替代原生 select，浅底深字） ---------- */

const state = {
    selections: [], // 表1 条目（套书/选课条目，含 downloads 册明细 + download_stats 聚合）
    tasks: [],
    catalog: [], // catalog targets（8900 /catalogs/math-qe，领域/课程结构与课程名）
    selection: null, // {kind: "domain"|"course"|"selection", id: string}
    filters: { domain: "", course: "", status: "" }, // 资源筛选（与树选择 AND 叠加）
    pollTimer: null,
    modalAction: null, // {type, id}
    coursePage: 0, // 十五期：领域视图课程分页页码
};

/* 筛选器选项定义（值 → 标签；空串 = 全部）。十七期：按表1 生命周期（候选/备选/已确认） */
const RESOURCE_STATUS_OPTIONS = [
    ["", "全部"], ["candidate", "候选"], ["backup", "备选"], ["confirmed", "已确认"],
];

/* 渲染弹层选项：按钮 + popover 菜单 */
function renderPopover(popKey, options, label) {
    const btn = $("btn-" + popKey);
    const menu = document.querySelector(`[data-menu="${popKey}"]`);
    if (!btn || !menu) return;
    const short = popKey.replace("filter-", "");
    const current = state.filters[short] ?? "";
    const curLabel = options.find(([v]) => v === current);
    btn.textContent = label + "：" + (curLabel ? curLabel[1] : "全部");
    menu.innerHTML = options.map(([value, text]) =>
        `<button type="button" class="popover-option${value === current ? " selected" : ""}" data-value="${esc(value)}">${esc(text)}</button>`
    ).join("");
}

function initPopovers() {
    const popKeys = ["filter-domain", "filter-course", "filter-status"];
    popKeys.forEach((key) => {
        const btn = $("btn-" + key);
        if (!btn) return;
        const wrap = btn.closest(".filter-popover");
        btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            document.querySelectorAll(".popover-menu").forEach((m) => m.classList.add("hidden"));
            const menu = document.querySelector(`[data-menu="${key}"]`);
            if (menu) menu.classList.toggle("hidden");
        });
        const menu = document.querySelector(`[data-menu="${key}"]`);
        if (menu) menu.addEventListener("click", (ev) => {
            const opt = ev.target.closest(".popover-option");
            if (!opt) return;
            state.filters[key.replace("filter-", "")] = opt.dataset.value;
            renderResourceFilters();
            renderPanel();
            menu.classList.add("hidden");
        });
    });
    document.addEventListener("click", () => {
        document.querySelectorAll(".popover-menu").forEach((m) => m.classList.add("hidden"));
    });
    // 十五期：领域视图分页控件（◀ 上一页 / 下一页 ▶）
    $("resource-list").addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-pager]");
        if (!btn || btn.disabled) return;
        const pages = Math.max(1, Math.ceil(coursesOfSelectedDomain().length / PAGE_SIZE));
        if (btn.dataset.pager === "prev" && state.coursePage > 0) state.coursePage -= 1;
        else if (btn.dataset.pager === "next" && state.coursePage < pages - 1) state.coursePage += 1;
        renderPanel();
    });
}

function renderResourceFilters() {
    renderPopover("filter-domain", domainOptions(), "领域");
    renderPopover("filter-course", courseOptions(), "课程");
    renderPopover("filter-status", RESOURCE_STATUS_OPTIONS, "状态");
}

/* ---------- 通用 ---------- */

/* 二十二期：请求 8s 超时（AbortController）——8901/8900 掉线时请求不得无限挂起
 * （曾导致树停在「加载中」转圈最长达 8900 代理 30s 超时）。 */
const FETCH_TIMEOUT_MS = 8000;

async function fetchJson(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...(options || {}), signal: controller.signal });
        if (!res.ok) {
            let detail = res.statusText;
            try {
                const body = await res.json();
                if (body.detail) detail = body.detail;
            } catch (_) { /* 非 JSON 响应 */ }
            throw new Error(res.status + " " + detail);
        }
        return res.json();
    } finally {
        clearTimeout(timer);
    }
}

function $(id) { return document.getElementById(id); }

function esc(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
}

/* ---------- 路由 ---------- */

function currentRoute() {
    const path = (location.hash || "#/").replace(/^#/, "");
    return ROUTES[path] || ROUTES["/"];
}

function route() {
    const r = currentRoute();
    const isAdmin = r.page === "admin";
    const isKnowledge = r.page === "knowledge";
    $("page-home").classList.toggle("active", !isAdmin && !isKnowledge);
    $("page-knowledge").classList.toggle("active", isKnowledge);
    $("page-admin").classList.toggle("active", isAdmin);
    document.title = isAdmin ? "管理后台 · QED-Engine" : isKnowledge ? "知识点 · QED-Engine" : "QED-Engine";
    if (isAdmin) {
        const navHash = location.hash.replace(/^#/, "") || "/";
        // #/admin 为仪表大盘别名：高亮「仪表大盘」菜单
        const activeHash = navHash === "/admin" ? "/admin/dashboard" : navHash;
        document.querySelectorAll(".sidebar .nav-item").forEach((a) => {
            a.classList.toggle("active", a.getAttribute("href") === "#" + activeHash);
        });
        showAdminView(r.view || "dashboard");
    } else if (isKnowledge) {
        // 二十二期续：独立知识点界面（领域→课程→章节/知识点结构，数据等解析产物管线）
        renderKnowledgeCenter();
    }
}

function showAdminView(view) {
    document.querySelectorAll("#page-admin .view").forEach((v) => v.classList.remove("active"));
    const el = $("view-" + view);
    if (el) el.classList.add("active");
    if (view === "dashboard") loadDashboard();
    else if (view === "downloads") {
        loadTree();
        loadSelections();
        loadTasks();
        populateCourseSelects();
    }
}

/* ---------- 知识点独立界面（二十二期续：领域→课程→章节/知识点结构，数学试点） ----------
 * #/knowledge 独立路由页：左侧领域/课程列表（catalog 13 门，COURSE_ORDER 排序），
 * 右侧选中课程的章节/知识点结构区（空态，等解析产物管线）。**只显示结构，不显示课程资料书单**。
 * 章节/知识点数据接入点：learning-center.md §3（领域→课程→知识点 DAG + 前置依赖），
 * 待 Axiom-Flow 解析产物管线就绪后填充。 */

async function renderKnowledgeCenter() {
    if (!state.catalog.length) {
        try {
            const catalog = await fetchJson(TRACKER_BASE + "/catalogs/math-qe");
            state.catalog = Array.isArray(catalog.targets) ? catalog.targets : [];
        } catch (_) { /* 数据域离线：课程列表留空态 */ }
    }
    renderLearnCourseList();
}

function renderLearnCourseList() {
    const courses = new Map();
    for (const t of state.catalog) {
        if (t.course_id && !courses.has(t.course_id)) courses.set(t.course_id, t.course_name || t.course_id);
    }
    const ids = [...courses.keys()].sort(courseOrderCmp);
    const list = $("learn-course-list");
    if (!list) return;
    if (!ids.length) {
        list.innerHTML = '<div class="tree-empty">暂无课程目录（数据服务离线）</div>';
        renderLearnCourse(null);
        return;
    }
    list.innerHTML = ids.map((cid) => {
        const done = courseCompletion(cid);
        const badge = courseDoneBadge(done);
        return `<div class="learn-course-item" data-course="${esc(cid)}">
            <span class="learn-course-name">${esc(courses.get(cid))}</span>
            ${badge}
        </div>`;
    }).join("");
    // 默认选中第一门（数学分析，COURSE_ORDER 首位）
    const first = list.querySelector(".learn-course-item");
    if (first) selectLearnCourse(first.dataset.course);
    else renderLearnCourse(null);
}

function selectLearnCourse(courseId) {
    document.querySelectorAll(".learn-course-item").forEach((n) => {
        n.classList.toggle("selected", n.dataset.course === courseId);
    });
    renderLearnCourse(courseId);
}

function renderLearnCourse(courseId) {
    const courseName = courseId
        ? (state.catalog.find((t) => t.course_id === courseId) || {}).course_name || courseId
        : "选择左侧课程开始学习";
    $("learn-course-title").textContent = courseName;
    const done = courseId ? courseCompletion(courseId) : null;
    $("learn-course-badge").innerHTML = done ? courseDoneBadge(done) : "";
    // 章节/知识点区：只显示结构（空态，数据等解析产物管线，learning-center.md §3）——不渲染书单
    $("learn-chapters").innerHTML = courseId
        ? `<div class="empty-state">
            <div>📚 《${esc(courseName)}》章节数据待解析产物管线就绪后填充</div>
            <div class="section-note">知识结构梳理（定义/定理/证明/例题）与前置依赖关系将随 Axiom-Flow 解析产物接入</div>
        </div>`
        : `<div class="empty-state"><div>📚 选择左侧课程开始学习</div></div>`;
}

/* ---------- 配置横幅（8900）与仪表盘健康面板 ---------- */

/* 五期：横幅 = 粗粒度模块连接状态（QED 管理服务横幅，仪表盘顶部）；健康面板 = 分组明细。
 * 健康明细只在仪表盘渲染，入口页不展示任何服务状态（面向学习用户）。 */

function healthStatusMarkup() {
    const escH = esc;
    return {
        ok: (label, detail) => `<div class="health-item ok"><span class="h-dot"></span><span class="h-label">${escH(label)}</span>${detail ? `<span class="h-detail">${escH(detail)}</span>` : ""}</div>`,
        bad: (label, detail) => `<div class="health-item bad"><span class="h-dot"></span><span class="h-label">${escH(label)}</span><span class="h-detail">${escH(detail || "异常")}</span></div>`,
        dim: (label, detail) => `<div class="health-item dim"><span class="h-dot"></span><span class="h-label">${escH(label)}</span><span class="h-detail">${escH(detail || "—")}</span></div>`,
    };
}

async function refreshConfigBanner() {
    const banner = $("config-banner");
    if (!banner) return;
    try {
        const db = await fetchJson(CONFIG_BASE + ENDPOINTS.database);
        // 粗粒度横幅（ARCH-003 决策 D2/D3）：只显示模块连接状态，不透露主机细节。
        // ARCH-014：LLM 供应商可达性不再经端点探测（8900 启动自检写日志），横幅只保留 MySQL。
        const dbLabel = !db.configured ? "未配置" : db.reachable ? "OK" : "连接失败";
        const dbCls = !db.configured ? "dim" : db.reachable ? "hl" : "hl-off";
        banner.innerHTML = `MySQL数据库连接：<span class="${dbCls}">${dbLabel}</span>`;
        banner.classList.toggle("warn", !db.reachable);
    } catch (_) {
        banner.textContent = "QED 管理服务 8900 离线，横幅不可用";
        banner.classList.add("warn");
    }
}

/* ---------- 仪表大盘（五期：四阶段流水线 + 服务健康分组面板，8900 数据域离线降级） ---------- */

/* 十期：流水线按课程统计——总课程数 = catalog targets 去重 course_id（动态，不再硬编码）；
 * 发现下载（宽松）：课程下存在任一资源即算完成；
 * 评估确认（严格）：课程有资源且课程内无待评估资源（status ∉ candidate/pending_manual）才算完成。 */
const PIPELINE_STAGES = [
    { key: "discover", name: "发现下载", hint: "课程下已有候选/备选/确认资源（宽松口径）" },
    { key: "confirm", name: "评估确认", hint: "课程内候选全部评估完毕（严格口径）" },
    { key: "parse", name: "解析", hint: "文档解析进度（Axiom-Flow 管线）" },
    { key: "organize", name: "知识整理", hint: "知识结构整理（数据管线）" },
];

async function loadDashboard() {
    refreshConfigBanner();
    loadHealthPanel();
    const pipeline = $("pipeline");
    if (!pipeline) return;
    let totalCourses = null;
    let discoverDone = 0;
    let confirmDone = 0;
    try {
        const [catalog, selections] = await Promise.all([
            fetchJson(TRACKER_BASE + "/catalogs/math-qe"),
            fetchJson(TRACKER_BASE + ENDPOINTS.selections),
        ]);
        state.selections = selections;
        // 分母：catalog targets 去重 course_id
        const courseIds = new Set((catalog.targets || []).map((t) => t.course_id).filter(Boolean));
        totalCourses = courseIds.size;
        // 课程聚合：每门课的表1 条目状态集合（十七期：资源状态 → 三表条目状态）
        const byCourse = {};
        for (const item of selections) {
            const cid = item.course_id;
            (byCourse[cid] = byCourse[cid] || []).push(item.status);
        }
        for (const cid of courseIds) {
            const statuses = byCourse[cid] || [];
            if (statuses.length) discoverDone += 1; // 宽松：有任一表1 条目
            if (statuses.length && !statuses.some((s) => s === "candidate")) {
                confirmDone += 1; // 严格：无待评估（candidate）条目
            }
        }
    } catch (_) {
        // 8900 数据域离线：流水线整体离线提示
    }
    const stageData = [
        { name: "发现下载", done: discoverDone, note: totalCourses !== null ? "课程下已有候选/备选/确认资源" : "QED-Tracker 8901 离线" },
        { name: "评估确认", done: confirmDone, note: totalCourses !== null ? "课程内候选全部评估完毕" : "QED-Tracker 8901 离线" },
        { name: "解析", done: null, note: "未启用（Axiom-Flow 管线未就绪）" },
        { name: "知识整理", done: null, note: "未启用（数据管线未就绪）" },
    ];
    pipeline.innerHTML = stageData.map((s) => {
        const pct = s.done === null || totalCourses === null ? 0 : Math.round((s.done / totalCourses) * 100);
        const num = s.done === null ? "—" : `已完成 ${s.done} / ${totalCourses} 课程`;
        return `<div class="pipeline-stage">
            <div class="stage-name">${esc(s.name)}</div>
            <div class="stage-num">${esc(num)}</div>
            <div class="stage-bar"><div class="stage-fill" style="width:${s.done === null || totalCourses === null ? 0 : Math.min(100, pct)}%"></div></div>
            <div class="stage-note">${esc(s.note)}</div>
        </div>`;
    }).join("");
    if (totalCourses === null) pipeline.classList.add("offline");
    else pipeline.classList.remove("offline");
    // 仪表大盘同时预热课程下拉（与知识点共用）
    populateCourseSelects();
}

/* 服务健康分组面板：后台服务 / LLM配置 / 数据库配置，异常展开问题文案 */

/* 服务项界面文案兜底（label 以 8900 /services 返回为准，此处仅缺省回退） */
const SERVICE_LABELS = {
    config: "QED 管理服务（后台管理服务）",
    tracker: "QED-Tracker（文档下载服务）",
    axiom: "Axiom-Flow（文档解析服务）",
};

async function loadHealthPanel() {
    const panel = $("health-panel");
    const servicesBox = $("health-services");
    const llmBox = $("health-llm");
    const dbBox = $("health-db");
    const mk = healthStatusMarkup();
    if (!panel || !servicesBox || !llmBox || !dbBox) return;
    // 后台服务：经 8900 /services 快照获取三服务状态（前端唯一入口，不直连 8901/8902）
    // 十六期（service-control 前端契约）：每行按状态渲染操作按钮（online→停止/重启，offline→启动，
    // starting/stopping→禁用「操作中…」）；config（8900 自身）不经控制中心启停 → 无按钮。
    try {
        const data = await fetchJson(CONFIG_BASE + ENDPOINTS.services);
        servicesBox.innerHTML = data.services.map((s) => {
            const name = s.label || SERVICE_LABELS[s.name] || s.name;
            const rowCls = s.status === "online" ? "ok" : s.status === "offline" ? "bad" : "dim";
            const cause = s.status === "offline"
                ? "离线：" + (s.reason || "无法访问")
                : s.status === "online" ? "" : s.status + (s.reason ? "：" + s.reason : "");
            let acts = "";
            if (s.name !== "config") {
                if (s.status === "online") {
                    acts = `<button class="btn btn-sm" data-svc="${esc(s.name)}" data-service-act="restart">重启</button>`
                        + `<button class="btn btn-sm danger" data-svc="${esc(s.name)}" data-service-act="stop">停止</button>`;
                } else if (s.status === "offline") {
                    acts = `<button class="btn btn-sm primary" data-svc="${esc(s.name)}" data-service-act="start">启动</button>`;
                } else {
                    acts = `<span class="h-detail">操作中…</span>`;
                }
            }
            return `<div class="health-item ${rowCls}"><span class="h-dot"></span><span class="h-label">${esc(name)}</span>${cause ? `<span class="h-detail">${esc(cause)}</span>` : ""}<span class="service-acts">${acts}</span></div>`;
        }).join("");
    } catch (err) {
        servicesBox.innerHTML = mk.bad("QED 管理服务（后台管理服务）", "离线：" + (err.message || "无法访问"));
    }
    // LLM配置：8900 models 模型路由表——只显示三个实际使用模型（主模型/视图模型/Embedding）
    try {
        const models = await fetchJson(CONFIG_BASE + ENDPOINTS.models);
        const routes = [
            ["主模型", models.default],
            ["视图模型", models.ocr],
            ["Embedding", models.embedding],
        ].filter(([label, r]) => r && r.configured);
        if (!routes.length) llmBox.innerHTML = mk.dim("LLM", "未配置任何模型");
        else llmBox.innerHTML = routes.map(([label, r]) => mk.ok(label, r.model)).join("");
    } catch (err) {
        llmBox.innerHTML = mk.bad("LLM", "管理服务离线：" + (err.message || "无法访问"));
    }
    // 数据库配置：8900 database（当前仅 MySQL）
    try {
        const db = await fetchJson(CONFIG_BASE + ENDPOINTS.database);
        dbBox.innerHTML =
            (db.configured
                ? (db.reachable ? mk.ok("MySQL", "联通") : mk.bad("MySQL", "连接失败：" + (db.error || "认证/网络异常")))
                : mk.dim("MySQL", "未配置"));
    } catch (err) {
        dbBox.innerHTML = mk.bad("MySQL", "管理服务离线：" + (err.message || "无法访问"));
    }
}

/* ---------- 知识点（三层知识链路树 + 事务面板，十七期：数据源 = 表1 条目） ---------- */

function courseOf(item) {
    return item.course_id || "—";
}

function scopeMatches(item, selection) {
    if (!selection) return true;
    if (selection.kind === "domain") return courseDomain(item.course_id) === selection.id;
    if (selection.kind === "course") return courseOf(item) === selection.id;
    if (selection.kind === "selection") return item.selection_id === selection.id;
    return true;
}

async function loadSelections() {
    try {
        state.selections = await fetchJson(TRACKER_BASE + ENDPOINTS.selections);
    } catch (err) {
        $("resource-list").textContent = "QED-Tracker 8901 离线：" + err.message;
        return;
    }
    renderPanel();
}

/* 空态提示：该范围暂无表1 条目（待评估），提示人工评估 */
function emptyStateHtml() {
    return '<div class="empty-state"><div class="emoji">📭</div>（该范围暂无表1 条目：待评估，点击「② 评估书单」刷新或经 CLI/三表接口录入候选）</div>';
}

function renderPanel() {
    // 四期/五期（ARCH-004 D3 + ARCH-005 D7）：筛选器（领域/课程/状态）与树选择独立叠加（AND）
    const status = state.filters.status;
    const domain = state.filters.domain;
    const course = state.filters.course;
    const sel = state.selection;
    let items = state.selections.filter(
        (it) =>
            (!status || it.status === status) &&
            (!domain || courseDomain(it.course_id) === domain) &&
            (!course || courseOf(it) === course) &&
            scopeMatches(it, sel)
    );
    const ctx = $("panel-context");
    if (!sel) ctx.textContent = "全目录（未选择节点，展示全部表1 条目）";
    else if (sel.kind === "domain") ctx.textContent = "领域：" + sel.id;
    else if (sel.kind === "course") ctx.textContent = "课程：" + sel.id;
    else ctx.textContent = "套书：" + sel.id;
    // 十三期/十七期：控制台化——选中课程时显示课程操作条（② 评估书单 + 步骤进度）
    const consoleEl = $("course-console");
    if (consoleEl) {
        if (sel && sel.kind === "course") {
            consoleEl.classList.remove("hidden");
            $("course-steps").innerHTML = courseSteps(sel.id);
        } else {
            consoleEl.classList.add("hidden");
        }
    }
    // 十五期：领域级按课程分页视图；课程级/套书级按条目卡列表。
    // 二十二期（用户裁决）：课程级同样走按套分组视图（套行 + 册明细横排），不再平铺书卡。
    // 二十二期续（逐步重构，不许回退）：无选择（全目录）也走套行视图——右侧保持套行优化，
    // 不因「树暂不跳转」而回退到书卡平铺。
    if (!sel || sel.kind === "domain" || sel.kind === "course") {
        renderPanelByCourses(items);
        return;
    }
    if (!items.length) {
        $("resource-list").innerHTML = emptyStateHtml();
        return;
    }
    // 课程级/套书级/全目录：套书卡列表（按课程 + 套号排序）
    const list = [...items].sort((a, b) => {
        const ca = COURSE_ORDER.indexOf(a.course_id);
        const cb = COURSE_ORDER.indexOf(b.course_id);
        return ((ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb)) || setNoOf(a).localeCompare(setNoOf(b));
    });
    $("resource-list").innerHTML = `<div class="card-grid">${list.map(selectionCard).join("")}</div>`;
}

/* ---------- 十五期：领域级按课程分页视图（十七期：课程行内嵌表1 套书卡） ---------- */

/* 领域视图每页课程数（十五期 D3）：最多 3 门课程一页，防右侧面板过长 */
const PAGE_SIZE = 3;

/* 课程学习深度排序（十一期 COURSE_ORDER 的通用比较器） */
function courseOrderCmp(a, b) {
    const ia = COURSE_ORDER.indexOf(a);
    const ib = COURSE_ORDER.indexOf(b);
    return ((ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)) || a.localeCompare(b);
}

/* 分页控件（十五期 D3）：◀ 上一页 / 页码 / 下一页 ▶ */
function coursePagerHtml(page, pages) {
    if (pages <= 1) return "";
    return `<div class="course-pager">
        <button class="btn ghost" data-pager="prev" ${page <= 0 ? "disabled" : ""}>◀ 上一页</button>
        <span class="pager-page">${page + 1} / ${pages}</span>
        <button class="btn ghost" data-pager="next" ${page >= pages - 1 ? "disabled" : ""}>下一页 ▶</button>
    </div>`;
}

/* 当前选中领域的课程数（十五期分页用，十七期：按表1 条目所属课程推导）；未选领域返回空数组 */
function coursesOfSelectedDomain() {
    const sel = state.selection;
    if (!sel || sel.kind !== "domain") return [];
    return [...new Set(state.selections.filter((it) => courseDomain(it.course_id) === sel.id).map((it) => it.course_id))];
}

/* 领域级渲染（十五期 D3 + 十七期三表）：按课程分组（学习深度排序）→ 分页切片 →
 * 每门课程一行（course-row）：课程名 + 完成徽标 + 该课程表1 套书卡列表。 */
function renderPanelByCourses(items) {
    const byCourse = new Map();
    for (const it of items) {
        if (!byCourse.has(it.course_id)) byCourse.set(it.course_id, []);
        byCourse.get(it.course_id).push(it);
    }
    const courseIds = [...byCourse.keys()].sort(courseOrderCmp);
    const pages = Math.max(1, Math.ceil(courseIds.length / PAGE_SIZE));
    if (state.coursePage >= pages) state.coursePage = pages - 1;
    if (state.coursePage < 0) state.coursePage = 0;
    const pageCourseIds = courseIds.slice(state.coursePage * PAGE_SIZE, (state.coursePage + 1) * PAGE_SIZE);
    // 二十二期：领域视图顶部显示领域标题层（领域名 + 课程数），课程行在领域下
    const domainTitle = state.selection && state.selection.kind === "domain"
        ? `<div class="domain-title">${esc(state.selection.id)}<span class="domain-count">${courseIds.length} 门课程</span></div>`
        : "";
    let html = domainTitle;
    for (const cid of pageCourseIds) {
        const list = byCourse.get(cid);
        const courseName = (state.catalog.find((x) => x.course_id === cid) || {}).course_name || cid;
        const done = courseCompletion(cid);
        const badge = courseDoneBadge(done);
        html += `<div class="course-row">
            <div class="course-row-head"><span class="course-row-name">${esc(courseName)}</span> ${badge}</div>
            ${renderCourseSets(list)}
        </div>`;
    }
    html += coursePagerHtml(state.coursePage, pages);
    $("resource-list").innerHTML = html || emptyStateHtml();
}

/* 二十期（用户裁决）：右侧每套一行——套行 = 一行介绍（book-intro 书名合并，一套一名
 * 不写卷几）+ 册明细列表直接展示（该套全部册，volumeRow 带书名）；已确认无套号归
 * 「已确认 · 未编套」行；候选/备选归「待评估」行（保留书卡，含三态操作）。 */
function renderCourseSets(list) {
    const sets = new Map();
    const unreconciled = [];
    const pending = [];
    for (const it of list) {
        const sn = setNoOf(it);
        if (it.status === "confirmed") {
            if (sn) {
                if (!sets.has(sn)) sets.set(sn, []);
                sets.get(sn).push(it);
            } else {
                unreconciled.push(it);
            }
        } else {
            pending.push(it);
        }
    }
    const setKeys = [...sets.keys()].sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(b));
    let html = "";
    for (const k of setKeys) html += setRowHtml(`套${k}`, sets.get(k), false, k);
    if (unreconciled.length) html += setRowHtml("已确认 · 未编套", unreconciled, false, null);
    if (pending.length) html += setRowHtml("待评估", pending, true, null);
    return html;
}

function setRowHtml(label, items, isPending = false, setNo = null) {
    if (isPending) {
        // 待评估：书卡一排（三态操作仍在卡上）
        return `<div class="set-row pending">
            <div class="set-head">
                <span class="set-label">${esc(label)}</span>
                <span class="set-roles">候选中</span>
            </div>
            <div class="card-grid">${items.map(selectionCard).join("")}</div>
        </div>`;
    }
    // 已确认套：一行介绍（书名合并）+ 册明细列表（全部册，volumeRow 带书名）
    const intro = items.map(bookIntroHtml).join("");
    const vols = [];
    const createBtns = [];
    for (const s of items) {
        const ds = (s.downloads || []).filter((d) => d.status !== "rejected" && d.status !== "failed");
        for (const d of ds) vols.push(volumeRow(d, s.title));
        if (!ds.length) {
            createBtns.push(`<button class="btn primary" data-act="create-downloads" data-id="${esc(s.selection_id)}">${esc(shortSetTitle(s))} 新建候选册</button>`);
        }
    }
    const setKey = setNo !== null && setNo !== undefined ? `${(items[0] || {}).course_id || ""}::${setNo}` : "";
    return `<div class="set-row"${setKey ? ` data-set="${esc(setKey)}"` : ""}>
        <div class="set-head">
            <span class="set-label">${esc(label)}</span>
            <span class="set-roles">${intro}</span>
            ${createBtns.join("")}
        </div>
        ${vols.length ? `<ul class="volume-list set-volumes">${vols.join("")}</ul>` : '<div class="tree-empty">（该套暂无册明细）</div>'}
    </div>`;
}

/* 二十期+二十二期：套内书籍一行介绍——角色&角色：《书名》（多角色 & 连接，
 * 教材优先排序，角色后冒号再书名；一套一名称，卷几合并，不逐卷展开）。 */
function bookIntroHtml(s) {
    const roles = (s.roles && s.roles.length ? roleListHtml(s.roles) : "书目");
    return `<span class="book-intro">${esc(roles)}：《${esc(s.title)}》</span>`;
}

/* 跨览：selectionCard 内册明细折叠区按钮文案用（新建候选册按钮），书名截断避免按钮过宽 */
function shortSetTitle(s) {
    const t = s.title || "";
    return t.length > 12 ? t.slice(0, 12) + "…" : t;
}

/* ---------- 知识点树（十一期：三层知识链路 领域→课程→书籍，学习深度排序） ---------- */

/* 二十二期：8901 离线自动重试——定时器防重（hashchange/多次调用不叠加）。 */
let _treeRetryTimer = null;
const TREE_RETRY_MS = 10000;

async function loadTree() {
    clearTimeout(_treeRetryTimer);
    const tree = $("domain-tree");
    tree.textContent = "加载中…";
    try {
        const catalog = await fetchJson(TRACKER_BASE + "/catalogs/math-qe");
        state.catalog = Array.isArray(catalog.targets) ? catalog.targets : [];
        if (!state.selections.length) {
            try {
                state.selections = await fetchJson(TRACKER_BASE + ENDPOINTS.selections);
            } catch (_) { /* 数据域离线不影响树结构 */ }
        }
        renderTree();
        // 二十二期续（重构，逐步来）：暂不默认选中跳转（全展开先看全貌；selectNode 联动后续恢复）
        // if (!state.selection) selectNode("domain", "数学");
    } catch (err) {
        // 二十期+二十二期续：任何异常（含 renderTree/selectNode 抛错）都不允许树停在
        // 「加载中…」——离线横幅 + 骨架 + console.error 留痕（不再无限转圈/空白）
        console.error("loadTree 失败：", err);
        state.catalog = state.catalog || [];
        try {
            renderTree();
        } catch (err2) {
            console.error("loadTree 骨架渲染失败：", err2);
            tree.innerHTML = `<div class="empty-state">知识树加载失败，请点右上角刷新重试</div>`;
        }
        tree.insertAdjacentHTML("afterbegin",
            `<div class="offline-banner">知识树暂不可用：${esc(err.message)}`
            + ` <button class="btn ghost" data-act="retry-tree">重试</button></div>`);
        // 二十二期：8901 恢复后自动重渲染（无需手动刷新）
        _treeRetryTimer = setTimeout(loadTree, TREE_RETRY_MS);
        return;
    }
}

/* 领域自适应（五期 D6）：catalog 无领域字段，按 catalog_id 映射学科领域；
 * 未来 catalog 增加领域字段后优先取数据源，前端映射只作兜底。 */
const CATALOG_DOMAIN_MAP = { "math-qe": "数学" };

function domainOf(catalogId) {
    return CATALOG_DOMAIN_MAP[catalogId] || "其他";
}

/* 课程学习深度顺序（十一期）：先学的在前，后学（依赖前置知识）的在后；
 * 未列入的新课程排尾部（localeCompare 兜底）。 */
const COURSE_ORDER = [
    "01_math_analysis", "02_linear_algebra", "03_topology", "04_real_analysis",
    "05_complex_analysis", "06_functional_analysis", "07_ode", "08_pde",
    "09_abstract_algebra", "11_probability", "12_stochastic_processes",
    "13_high_dim_prob", "10_qe_prep",
];

/* ---------- 十六期/十七期（course-acquisition-flow 对齐契约 + 三表聚合）：套归属 + 版本徽标 + 两套完成判定 ---------- */

/* 苏版名单（十六期）：中译版 + 作者命中名单 → 苏版徽标（菲赫金哥尔茨/吉米多维奇/费定晖/阿诺德/卓里奇） */
const SOVIET_AUTHORS = ["菲赫金哥尔茨", "吉米多维奇", "费定晖", "阿诺德", "卓里奇"];

/* 套归属（十七期）：表1 条目 set_no 权威字段（"1"~"4" / "en" / 空） */
function setNoOf(sel) {
    const s = sel || {};
    return String(s.set_no || "").trim();
}

/* 套标记徽标（十七期）：表1 set_no → 「套N」/「英文对照」；无套号不渲染 */
function setBadgeHtml(sel) {
    const sn = setNoOf(sel);
    if (!sn) return "";
    const label = sn === "en" ? "英文对照" : "套" + sn;
    return `<span class="version-badge set-badge" title="套标记">${esc(label)}</span>`;
}

/* 角色徽标（十七期）：表1 roles（textbook/exercises/solutions/reference/supplement）→ 中文标签 */
function roleLabels(roles) {
    const map = { textbook: "教材", exercises: "习题集", solutions: "答案", reference: "参考", supplement: "配套资料" };
    return (roles || []).map((r) => map[r] || r).join(" / ");
}

/* 二十二期：角色展示排序（教材优先 → 习题集 → 答案 → 其他，贴合套行头部阅读习惯） */
const ROLE_ORDER = { textbook: 0, exercises: 1, solutions: 2, reference: 3, supplement: 4 };

function roleListHtml(roles) {
    const map = { textbook: "教材", exercises: "习题集", solutions: "答案", reference: "参考", supplement: "配套资料" };
    return (roles || [])
        .slice()
        .sort((a, b) => (ROLE_ORDER[a] ?? 9) - (ROLE_ORDER[b] ?? 9))
        .map((r) => map[r] || r)
        .join("&");
}

/* 版本徽标（十六期，course-acquisition-flow 对齐契约 2；十七期：字段来源兼容表1 version.language）：
 * language 中译（zh/chi）+ 作者命中苏版名单 → 苏版；中译 → 中译本；
 * 英文（en/eng）→ 英文版；其余 → 其他。target 与表1 条目均适用。 */
function versionBadge(target) {
    const t = target || {};
    const v = t.version || {};
    const lang = t.language || v.language || "";
    const zh = lang === "zh" || lang === "chi";
    const en = lang === "en" || lang === "eng";
    const authors = (t.authors || []).join("");
    const soviet = zh && SOVIET_AUTHORS.some((a) => authors.includes(a));
    const label = soviet ? "苏版" : zh ? "中译本" : en ? "英文版" : "其他";
    const cls = soviet ? "soviet" : zh ? "zh" : en ? "en" : "other";
    return `<span class="version-badge ${cls}" title="版本徽标（中译/英文/苏版判定）">${label}</span>`;
}

/* 课程完成判定（十六期 + 十七期三表聚合，course-acquisition-flow 对齐契约 1）：
 * 按表1 条目 set_no 聚合「套」——套完成 = 套内 ≥1 教材（roles 含 textbook 且表2 有 approved 册）
 * + ≥1 习题集（roles 含 exercises 且表2 有 approved 册）；
 * 完成标准：≥2 套 approved（固定两套底线）；三套及以上全部完成时 extra 提示 +N 余量；
 * 无套号条目（如英文对照）独立成组，计入 教材/习题集 进度但不计入套数。 */
function courseCompletion(courseId) {
    const sels = state.selections.filter((s) => s.course_id === courseId);
    // 套分组：按 setNoOf 聚合；无套号条目独立成组
    const groups = new Map();
    for (const s of sels) {
        if (s.status !== "confirmed") continue;
        const set = setNoOf(s);
        const key = set ? "套" + set : "独" + s.selection_id;
        if (!groups.has(key)) groups.set(key, { set: !!set, bookT: 0, exT: 0, bookA: 0, exA: 0 });
        const g = groups.get(key);
        const approved = (s.download_stats || {}).approved > 0;
        const roles = s.roles || [];
        if (roles.includes("textbook")) { g.bookT += 1; if (approved) g.bookA += 1; }
        // 二十期（用户裁决）：题解（solutions）与习题集（exercises）同池计入习题类——
        // 套3 陈纪修（教材+题解）→ 套数 3/3 · 习题集 3/3
        if (roles.includes("exercises") || roles.includes("solutions")) { g.exT += 1; if (approved) g.exA += 1; }
    }
    let setsApproved = 0, setTotal = 0, bookApproved = 0, bookTotal = 0, exApproved = 0, exTotal = 0;
    for (const g of groups.values()) {
        if (g.set) setTotal += 1;
        // 十八期：进度数字只算套内（无套号条目如独立英文原版/独立习题集不掺水）
        if (!g.set) continue;
        bookTotal += g.bookT; exTotal += g.exT;
        bookApproved += g.bookA; exApproved += g.exA;
        if (g.bookT > 0 && g.exT > 0 && g.bookA >= 1 && g.exA >= 1) setsApproved += 1;
    }
    const done = setsApproved >= 2;
    return { done, setsApproved, setTotal, bookApproved, bookTotal, exApproved, exTotal, extra: done && setsApproved > 2 ? setsApproved - 2 : 0 };
}

/* 二十期：课程徽标——三态颜色（已完成=绿 >=2 套完整 / 进行中=黄 / 未开始=无填充描边）
 * 保留，数字明细恢复：套数 x/y · 教材 a/b · 习题集 c/d（教材/习题集只算套内）。 */
function courseDoneBadge(done) {
    const tag = done.setTotal > 0
        ? `套数 ${done.setsApproved}/${done.setTotal} · 教材 ${done.bookApproved}/${done.bookTotal} · 习题集 ${done.exApproved}/${done.exTotal}`
        : "未开始";
    if (done.done) {
        return `<span class="course-done">${tag}</span>`;
    }
    if (done.setTotal > 0 || done.bookTotal > 0 || done.exTotal > 0) {
        return `<span class="course-progress">${tag}</span>`;
    }
    return `<span class="course-idle">${tag}</span>`;
}

/* 知识点树（十一期 + 十七期 + 二十期）：三层知识链路 领域 → 课程 → 套（表1 按 set_no 聚合），
 * 套内书行（教材/习题集合并书名，一套一名不写卷几）；候选/备选仍为独立 selection 叶子；
 * 册明细不进树（右侧套行内展示）。PyCharm 式交互：箭头=展开/折叠（不触发选中），名称=选中过滤面板。 */
function renderTree() {
    const tree = $("domain-tree");
    // 表1 条目按课程分组（树叶子数据源；拒绝/过时条目已由数据层过滤，前端无查看入口）
    const byCourseSel = new Map();
    for (const s of state.selections) {
        if (!byCourseSel.has(s.course_id)) byCourseSel.set(s.course_id, []);
        byCourseSel.get(s.course_id).push(s);
    }
    const courses = new Map();
    for (const t of state.catalog) {
        if (!courses.has(t.course_id)) courses.set(t.course_id, { id: t.course_id, name: t.course_name, catalogId: t.catalog_id || "math-qe", selections: [] });
        courses.get(t.course_id).selections = byCourseSel.get(t.course_id) || [];
    }
    // 表1 条目属于但 catalog 未列出的课程兜底补入
    for (const [cid, list] of byCourseSel) {
        if (!courses.has(cid)) courses.set(cid, { id: cid, name: cid, catalogId: "math-qe", selections: list });
    }
    const byDomain = new Map(); // 领域名 -> [课程]
    for (const course of courses.values()) {
        const domain = domainOf(course.catalogId);
        if (!byDomain.has(domain)) byDomain.set(domain, []);
        byDomain.get(domain).push(course);
    }
    // 二十二期（用户裁决）：所有领域常驻展示（CATALOG_DOMAIN_MAP 全量 + 数据推导兜底），
    // 无课程的领域也显示（空态）。二十二期续（文件列表式）：默认领域展开、课程/套折叠
    // （文件管理器默认态：根展开第一层，点击名称展开下一层）。
    const allDomains = [...new Set([...Object.values(CATALOG_DOMAIN_MAP), ...byDomain.keys()])];
    const domainsHtml = allDomains.map((domain) => {
        const courseList = byDomain.get(domain) || [];
        const coursesHtml = courseList
            // 十八期回归：courseOrderCmp 接收课程 id（直接传对象会 localeCompare 崩溃）
            .sort((a, b) => courseOrderCmp(a.id, b.id))
            .map((c) => {
                const done = courseCompletion(c.id);
                const badge = courseDoneBadge(done);
                const leavesHtml = courseSetNodesHtml(c.id, c.selections);
                return `
                    <div class="tree-node tree-course collapsed" data-kind="course" data-id="${esc(c.id)}" data-label="${esc(c.name)}">
                        <span class="tree-caret">▸</span><span class="tree-name">${esc(c.name)}</span>
                        ${badge}
                        <div class="tree-children" style="display:none">${leavesHtml || '<div class="tree-empty">（暂无表1 条目）</div>'}</div>
                    </div>`;
            }).join("");
        return `
            <div class="tree-node tree-domain" data-kind="domain" data-id="${esc(domain)}" data-label="${esc(domain)}">
                <span class="tree-caret">▾</span><span class="tree-name">${esc(domain)}</span>
                <span class="tree-count">${courseList.length ? courseList.length + " 门课程" : "暂无课程"}</span>
                <div class="tree-children">${coursesHtml || '<div class="tree-empty">（暂无课程）</div>'}</div>
            </div>`;
    }).join("");
    tree.innerHTML = domainsHtml || `<div class="empty-state">暂无课程目录</div>`;
    // 二十二期续（重构）：渲染自检——树区域 3s 内无任何渲染产物（节点/横幅/空态）时
    // 显示诊断条（任何环境异常不再静默空白，console.error 留痕）
    setTimeout(() => {
        const hasContent = tree.querySelector(".tree-node, .offline-banner, .empty-state, .tree-empty");
        if (!hasContent) {
            console.error("知识树渲染自检失败：树区域无渲染产物");
            tree.insertAdjacentHTML("afterbegin",
                `<div class="offline-banner">知识树渲染异常 <button class="btn ghost" data-act="retry-tree">重试</button></div>`);
        }
    }, 3000);
}

/* 二十期：课程树叶子按套聚合——confirmed 按 set_no 归入套节点（tree-set，套内书行 tree-book），
 * 无套号 confirmed 归「未编套」节点；候选/备选保持独立 selection 叶子（setBadgeHtml 原样）。 */
function courseSetNodesHtml(courseId, selections) {
    const sets = new Map();
    const unreconciled = [];
    const pending = [];
    for (const s of selections) {
        const sn = setNoOf(s);
        if (s.status === "confirmed") {
            if (sn) {
                if (!sets.has(sn)) sets.set(sn, []);
                sets.get(sn).push(s);
            } else {
                unreconciled.push(s);
            }
        } else {
            pending.push(s);
        }
    }
    const setKeys = [...sets.keys()].sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(b));
    let html = "";
    for (const k of setKeys) html += setTreeNodeHtml(`${courseId}::${k}`, `套${k}`, sets.get(k));
    if (unreconciled.length) html += setTreeNodeHtml(`${courseId}::none`, "已确认 · 未编套", unreconciled);
    for (const s of pending) {
        html += `
            <div class="tree-node tree-selection" data-kind="selection" data-id="${esc(s.selection_id)}" data-label="${esc(s.title)}">
                <span class="tree-name" title="${esc(s.title)}">${esc(s.title)}</span>
                ${setBadgeHtml(s)}
                <span class="tree-type">${esc(roleLabels(s.roles))}</span>
            </div>`;
    }
    return html;
}

/* 二十期：套节点 + 套内书行（一套一名：教材/习题集合并书名，不逐卷展开） */
function setTreeNodeHtml(id, label, items) {
    const bookRows = items.map((s) => {
        // 二十二期：角色列表 & 连接（教材&习题集&答案，教材优先），与右侧 book-intro 一致
        const role = (s.roles && s.roles.length ? roleListHtml(s.roles) : "书目");
        const count = (s.downloads || []).length;
        return `
            <div class="tree-book">
                <span class="tree-book-label">${esc(role)}</span>
                <span class="tree-name">《${esc(s.title)}》${count ? `（${count} 册合并）` : ""}</span>
            </div>`;
    }).join("");
    return `
        <div class="tree-node tree-set collapsed" data-kind="set" data-id="${esc(id)}" data-label="${esc(label)}">
            <span class="tree-caret">▸</span><span class="tree-name">${esc(label)}</span>
            <span class="tree-type">${items.length} 项</span>
            <div class="tree-children" style="display:none">${bookRows}</div>
        </div>`;
}

/* 课程所属领域（十二期）：经课程任一 target 的 catalog_id → 领域映射 */
function courseDomain(courseId) {
    const t = state.catalog.find((x) => x.course_id === courseId);
    return t ? domainOf(t.catalog_id || "math-qe") : "";
}

function selectNode(kind, id) {
    state.selection = { kind, id };
    state.coursePage = 0; // 十五期：切换选择时重置领域分页页码
    document.querySelectorAll(".tree-node").forEach((n) => n.classList.remove("selected"));
    const node = document.querySelector(`.tree-node[data-kind="${kind}"][data-id="${CSS.escape(id)}"]`);
    if (node) node.classList.add("selected");
    // 十二期：树→筛选器单向联动——点领域/课程同步弹层筛选，套书级不改筛选
    if (kind === "domain") {
        state.filters.domain = id;
        state.filters.course = "";
    } else if (kind === "course") {
        state.filters.domain = courseDomain(id) || state.filters.domain;
        state.filters.course = id;
    } else if (kind === "set") {
        // 二十期：点套节点 → 筛选到所属课程，面板渲染后定位并高亮该套行
        const cid = String(id).split("::")[0];
        state.filters.domain = courseDomain(cid) || state.filters.domain;
        state.filters.course = cid;
        renderResourceFilters();
        renderPanel();
        const target = document.querySelector(`.set-row[data-set="${CSS.escape(id)}"]`);
        if (target) {
            target.classList.add("tree-linked");
            target.scrollIntoView({ block: "start", behavior: "smooth" });
            setTimeout(() => target.classList.remove("tree-linked"), 2000);
        }
        return;
    }
    renderResourceFilters();
    renderPanel();
}

function scoreMarkup(evaluation) {
    if (!evaluation) {
        return `<div class="verdict">（无评估）</div>`;
    }
    const score = Number(evaluation.score) || 0;
    const verdict = evaluation.verdict || "—";
    const summary = evaluation.summary ? `<div class="verdict">${esc(evaluation.summary)}</div>` : "";
    return `<div class="score-row">
        <div class="score-track"><div class="score-fill" style="width:${Math.min(100, Math.max(0, score * 10))}%"></div></div>
        <span class="score-text">${score.toFixed(1)} · ${esc(verdict)}</span>
    </div>${summary}`;
}

/* 十七期：表1 套书卡——title/authors/版本徽标/套标记/roles 徽标/LLM 预填评价/评审建议/
 * 册完成度（download_stats）；confirmed 无册出「新建候选册」；有册内嵌表2 册明细。
 * 候选条目（candidate/backup）仅评估态出现（表1 三态操作：确定/备选/否定/转正）。 */
function selectionCard(sel) {
    const actions = [];
    const version = sel.version || {};
    const stats = sel.download_stats || {};
    const deleteAction = sel.status === "candidate" || sel.status === "backup"
        ? `<button class="btn danger" data-act="reject" data-id="${esc(sel.selection_id)}">${sel.status === "backup" ? "放弃" : "否定"}</button>`
        : "";
    if (sel.status === "candidate" || sel.status === "backup") {
        actions.push(`<button class="btn primary" data-act="confirm" data-id="${esc(sel.selection_id)}">${sel.status === "backup" ? "转正" : "确定"}</button>`);
        if (sel.status === "candidate") actions.push(`<button class="btn" data-act="backup" data-id="${esc(sel.selection_id)}">备选</button>`);
        actions.push(deleteAction);
    }
    // 十四期：人工评审建议（review_note）——三态按钮旁建议输入框，随三态一并提交（QED-020）
    const noteInput = sel.status === "candidate" || sel.status === "backup"
        ? `<input type="text" class="review-note" data-note-for="${esc(sel.selection_id)}" placeholder="填一句评审建议（可选）…" value="${esc(sel.review_note || sel.note || "")}">`
        : "";
    // 十八期（用户裁决）：不加载表2 放弃/失败册——rejected/failed 由数据层过滤，前端双保险
    const downloads = (sel.downloads || []).filter((d) => d.status !== "rejected" && d.status !== "failed");
    let volumes = "";
    if (sel.status === "confirmed" || downloads.length) {
        if (downloads.length) {
            // 十八期：册明细收敛为卡内折叠区（默认收起），不占卡片层级——右侧只见套书卡
            volumes = `<details class="volume-collapse"><summary>册明细（${downloads.length} 册）</summary>
                <ul class="volume-list">${downloads.map((d) => volumeRow(d, sel.title)).join("")}</ul></details>`;
        } else {
            actions.push(`<button class="btn primary" data-act="create-downloads" data-id="${esc(sel.selection_id)}">新建候选册</button>`);
        }
    }
    const evalHtml = scoreMarkup(sel.evaluation);
    const note = sel.note ? `<div class="reject-note">评审建议：${esc(sel.note)}</div>` : "";
    const sub = [langLabel(version.language || ""), (sel.authors || []).join("、") || "—"].join('<span class="sep">·</span>');
    const roleBadges = (sel.roles || []).map((r) => `<span class="tree-type">${esc(roleLabels([r]))}</span>`).join(" ");
    return `<div class="card selection-card">
        <div class="card-head">
            <div>
                <div class="card-title">${esc(sel.title)}</div>
                <div class="card-sub">${sub}</div>
            </div>
            <span class="card-head-badges">${versionBadge(sel)}${setBadgeHtml(sel)}${roleBadges}</span>
        </div>
        ${evalHtml}
        <div class="card-meta">册完成度：${stats.approved}/${stats.total} 已验收（表2 册级明细）</div>
        ${note}
        <div class="card-actions">
            <span class="status-badge status-${esc(sel.status || "unknown")}">${esc(STATUS_LABEL[sel.status] || sel.status)}</span>
            ${actions.join("")}
            <button class="btn ghost" data-act="detail" data-kind="selection" data-id="${esc(sel.selection_id)}">详情</button>
        </div>
        ${noteInput}
        ${volumes}
    </div>`;
}

/* 十七期+二十二期：表2 册级明细行——册名（volumeDisplayName 按 file_hint 解析，
 * 不再全标 selection.title）+ 角色（volumeRoleOf 教材名单判定）+ 卷标 + 简介/路径/状态；
 * 操作：downloaded → 验收通过/否定（填原因）；candidate → 人工下载登记（填相对路径）。 */
function volumeRow(d, bookTitle) {
    const actions = [];
    if (d.status === "downloaded") {
        actions.push(`<button class="btn primary" data-act="approve" data-kind="download" data-id="${esc(d.download_id)}">验收通过</button>`);
        actions.push(`<button class="btn danger" data-act="reject" data-kind="download" data-id="${esc(d.download_id)}">否定（填原因）</button>`);
    }
    // 十七期（D7 先登记再下载）：candidate 册出登记表单（相对路径由服务端校验 PDF + SHA-256）
    const registerForm = d.status === "candidate"
        ? `<div class="register-row"><input type="text" class="register-path" data-register-for="${esc(d.download_id)}" placeholder="数据根内相对路径，如 raw/books/math-qe/01_math_analysis/x.pdf">`
            + `<button class="btn primary" data-act="register" data-kind="download" data-id="${esc(d.download_id)}">人工下载登记</button></div>`
        : "";
    const intro = d.intro ? `<div class="verdict">简介：${esc(d.intro)}</div>` : "";
    const pathTip = d.relative_path
        ? `<div class="reject-note">文件绝对路径：${esc(d.relative_path)}（请打开文件人工审理是否达到预期，审理通过后点「验收通过」）</div>`
        : "";
    // 二十二期（用户裁决）：册名/角色按文件名解析，不再标注所属 selection 书名
    const hint = d.file_hint ? fileHintName(d.file_hint) : "";
    const displayName = d.file_hint ? volumeDisplayName(d.file_hint) : (d.vol || "整册");
    const roleTag = d.file_hint ? `<span class="tree-type">${esc(volumeRoleOf(d.file_hint))}</span>` : "";
    return `<li class="volume-row">
        <div class="volume-head">
            <div class="volume-bookline">
                <span class="volume-book">${esc(displayName)}</span>
                ${roleTag}
            </div>
            <div class="volume-meta">
                <span class="volume-title">卷：${esc(d.vol || "整册")}${hint ? `（${esc(hint)}）` : ""}</span>
                <span class="status-badge status-${esc(d.status || "unknown")}">${esc(STATUS_LABEL[d.status] || d.status)}</span>
            </div>
        </div>
        ${intro}
        ${pathTip}
        <div class="volume-actions">
            ${actions.join("")}
            <button class="btn ghost" data-act="detail" data-kind="download" data-id="${esc(d.download_id)}">详情</button>
        </div>
        ${registerForm}
    </li>`;
}

/* 二十二期：卷标文件名简化——raw/books/.../01-xxx_书名_2010.pdf → 01-xxx_书名_2010 */
function fileHintName(hint) {
    const base = String(hint).split(/[\\/]/).pop();
    return base.replace(/\.[^.]+$/, "");
}

/* 二十二期（用户裁决）：册名解析——01-demidovich_吉米多维奇数学分析习题集_2010 →
 * 吉米多维奇数学分析习题集（去序号-代码_ 前缀、去尾部 _年份/_hash、_ 转空格）。 */
function volumeDisplayName(hint) {
    let name = fileHintName(hint);
    name = name.replace(/^\d+-[a-z0-9-]+_/, "");  // 去 序号-代码_ 前缀（代码段可含数字，如 chenjixiu-v1）
    name = name.replace(/_[a-z0-9]+$/, "");        // 去尾部 _年份/_hash（如 _2010、_730d8220）
    return name.replace(/_/g, " ");
}

/* 二十二期（用户裁决教材名单）：文件名命中以下特征 = 教材，其余 = 习题集：
 * 01-rudin-zh_数学分析原理第3版_鲁丁中译 / 微积分学教程（第X卷）…菲赫金哥尔茨 /
 * 01-chenjixiu-v1|v2_数学分析陈纪修_第三版_课本及答案 */
const TEXTBOOK_HINT_MARKERS = ["rudin-zh", "微积分学教程", "chenjixiu"];

function volumeRoleOf(hint) {
    const h = String(hint || "");
    return TEXTBOOK_HINT_MARKERS.some((m) => h.includes(m)) ? "教材" : "习题集";
}

/* 十四期：随三态一并提交的评审建议（QED-020，选填） */
function noteOf(resourceId) {
    const input = document.querySelector(`.review-note[data-note-for="${CSS.escape(resourceId)}"]`);
    return input ? input.value.trim() : "";
}

/* 十七期：控制台化——「② 评估书单」刷新当前课程表1 书单（AI 搜索评估任务已随
 * QED-030 退役；评估=人工对 candidate 做确认/备选/否定决策） */
async function triggerEvaluate() {
    const sel = state.selection;
    const courseId = sel && sel.kind === "course" ? sel.id : (state.filters.course || null);
    const btn = $("btn-course-search");
    if (!courseId) {
        alert("请先在左侧选择一门课程");
        return;
    }
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "刷新中…";
    try {
        await loadSelections();
        alert("书单已刷新（表1 共 " + state.selections.length + " 条）");
        loadTasks();
    } catch (err) {
        alert("刷新书单失败：" + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "② 评估书单";
    }
}

/* ---------- 任务中心（8900 /tasks，1s 轮询；十四期：尾部任务列表已移除，
 * 任务数据仅用于课程操作条步骤进度条） ---------- */

async function loadTasks() {
    try {
        state.tasks = await fetchJson(TRACKER_BASE + ENDPOINTS.tasks);
    } catch (err) {
        // 8900 数据域离线：步骤条保持 idle 即可，不中断其他模块（独立性铁律）
        state.tasks = [];
        return;
    }
    // 十三期：任务轮询后刷新课程操作条步骤进度（若课程选中）
    const sel = state.selection;
    const steps = $("course-steps");
    if (sel && sel.kind === "course" && steps) steps.innerHTML = courseSteps(sel.id);
}

/* 十三期控制台 + 十七期四步语义（downloads-three-table §4.2）：
 * ① 选择：进入课程展示表1 书单（confirmed 套书 / 表1 条目总数）
 * ② 评估：决定究竟要哪一份（无 candidate 且表1 有 confirmed = 完成）
 * ③ 下载：表2 册级（已下载+已验收册 / 应下载册总数）
 * ④ 审理：下载完毕展示绝对路径，人工审理后逐册 approve（已验收册 / 已下载册） */
function courseSteps(courseId) {
    const sels = state.selections.filter((s) => s.course_id === courseId);
    const confirmed = sels.filter((s) => s.status === "confirmed").length;
    const pending = sels.filter((s) => s.status === "candidate" || s.status === "backup").length;
    const allDownloads = [];
    for (const s of sels) allDownloads.push(...(s.downloads || []));
    const downloaded = allDownloads.filter((d) => d.status === "downloaded").length;
    const approved = allDownloads.filter((d) => d.status === "approved").length;
    const expected = allDownloads.length;
    const step = (label, st, detail) => `<span class="step-item ${st}">${esc(label)} ${esc(detail)}</span>`;
    const arrow = `<span class="step-arrow">→</span>`;
    return [
        step("① 选择", sels.length ? "run" : "idle", `${confirmed}/${sels.length}`),
        step("② 评估", pending === 0 && confirmed > 0 ? "done" : (sels.length ? "run" : "idle"), `${confirmed}/${confirmed + pending}`),
        step("③ 下载", downloaded + approved > 0 ? "done" : (expected > 0 ? "run" : "idle"), `${downloaded + approved}/${expected}`),
        step("④ 审理", approved > 0 ? "done" : (downloaded > 0 ? "run" : "idle"), `${approved}/${downloaded}`),
    ].join(arrow);
}

function startTaskPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => {
        if ($("page-admin").classList.contains("active") && $("view-downloads").classList.contains("active")) {
            loadTasks();
        }
    }, 1000);
}

/* ---------- 状态迁移与弹窗（十七期：表1 三态 / 表2 册级操作 / 新建候选册） ---------- */

function refreshAll() {
    loadSelections();
    loadTree();
    if (currentRoute().view === "dashboard") loadDashboard();
}

async function confirmSelection(id) {
    try {
        const note = noteOf(id);
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.selections + "/" + encodeURIComponent(id) + ENDPOINTS.confirm, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
        });
        alert("已确认入书单：" + res.status);
    } catch (err) {
        alert("确认失败：" + err.message);
    }
    refreshAll();
}

async function backupSelection(id) {
    try {
        const note = noteOf(id);
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.selections + "/" + encodeURIComponent(id) + ENDPOINTS.backup, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
        });
        alert("已标记备选（可转正或放弃）：" + res.status);
    } catch (err) {
        alert("标记备选失败：" + err.message);
    }
    refreshAll();
}

/* 十七期（D7 先登记再下载）：confirmed 无册条目 → 按表1 vols 生成全部候选册（POST /downloads） */
async function createDownloads(id) {
    try {
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.downloads, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selection_id: id }),
        });
        alert("候选册已创建：" + (res.length || res.some ? (res.length + " 册") : JSON.stringify(res)));
    } catch (err) {
        alert("新建候选册失败：" + err.message);
    }
    refreshAll();
}

/* 十七期：表2 人工下载登记——按下载方案人工下载后放入数据根，提交相对路径由服务端校验 PDF + SHA-256，
 * 登记为已下载（candidate → downloaded 直转）。 */
async function registerDownload(id) {
    const input = document.querySelector(`.register-path[data-register-for="${CSS.escape(id)}"]`);
    const relativePath = input ? input.value.trim() : "";
    if (!relativePath) {
        alert("请填写数据根内相对路径（relative_path）");
        return;
    }
    try {
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.downloads + "/" + encodeURIComponent(id) + ENDPOINTS.register, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ relative_path: relativePath }),
        });
        alert("人工下载已登记：" + res.status + "（sha256:" + (res.sha256 || "").slice(0, 8) + "）");
    } catch (err) {
        alert("人工登记失败：" + err.message);
    }
    refreshAll();
}

async function approveDownload(id) {
    try {
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.downloads + "/" + encodeURIComponent(id) + ENDPOINTS.approve, { method: "POST" });
        alert("已验收通过：" + res.status);
    } catch (err) {
        alert("验收失败：" + err.message);
    }
    refreshAll();
}

function openReasonModal(id, kind) {
    state.modalAction = { action: "reject", id, kind: kind || "selection" };
    $("modal-title").textContent = "删除/拒绝书目";
    $("modal-reason").value = "";
    $("modal-reason").style.display = "";
    $("modal-hint").textContent = "说明拒绝/删除原因，留痕可追溯：";
    $("modal").classList.remove("hidden");
    $("modal-reason").focus();
}

/* ---------- 十六期（service-control 前端契约）：服务控制区操作（经 8900 /services/{name}/{action}） ---------- */

const SERVICE_ACTIONS = { start: "启动", stop: "停止", restart: "重启" };

/* 破坏性操作（停止/重启）复用 reason modal 作为确认框（无需填原因） */
function openServiceConfirm(svc, act) {
    state.modalAction = { action: "service", svc, act };
    $("modal-title").textContent = SERVICE_ACTIONS[act] + "服务确认";
    $("modal-reason").style.display = "none";
    const stopNote = act === "stop" ? "停止后该服务不可用，可随时在控制中心重新启动。" : "重启期间服务短暂不可用。";
    $("modal-hint").textContent = `确定${SERVICE_ACTIONS[act]}「${svc}」吗？${stopNote}`;
    $("modal").classList.remove("hidden");
}

async function serviceAct(svc, act) {
    try {
        const res = await fetchJson(CONFIG_BASE + "/services/" + encodeURIComponent(svc) + "/" + encodeURIComponent(act), { method: "POST" });
        alert(`${SERVICE_ACTIONS[act] || act}请求已受理` + (res.status ? "：" + res.status : ""));
    } catch (err) {
        alert(`${SERVICE_ACTIONS[act] || act}失败：${err.message}`);
    }
    loadHealthPanel(); // 操作后立即刷新（starting/stopping 流转由轮询兜底）
}

async function submitReason() {
    const { id, action, svc, act } = state.modalAction || {};
    // 服务控制确认：无需填原因，直接执行操作
    if (action === "service") {
        $("modal").classList.add("hidden");
        await serviceAct(svc, act);
        return;
    }
    const reason = $("modal-reason").value.trim();
    if (!reason) {
        alert("原因必填（留痕可追溯）");
        return;
    }
    $("modal").classList.add("hidden");
    const { kind } = state.modalAction || {};
    try {
        const note = noteOf(id);
        const url = kind === "download"
            ? TRACKER_BASE + ENDPOINTS.downloads + "/" + encodeURIComponent(id) + ENDPOINTS.reject
            : TRACKER_BASE + ENDPOINTS.selections + "/" + encodeURIComponent(id) + ENDPOINTS.reject;
        await fetchJson(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason, note }),
        });
        alert("已记录拒绝并留痕");
    } catch (err) {
        alert("拒绝失败：" + err.message);
    }
    refreshAll();
}

/* ---------- 事件绑定 ---------- */

function bindEvents() {
    $("btn-admin").addEventListener("click", () => { location.hash = "#/admin"; });
    $("btn-help").addEventListener("click", () => openHelpModal());
    $("help-close").addEventListener("click", () => $("help-modal").classList.add("hidden"));
    $("menu-toggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
    document.querySelectorAll(".sidebar .nav-item").forEach((a) => {
        a.addEventListener("click", () => $("sidebar").classList.remove("open"));
    });
    $("btn-course-search").addEventListener("click", triggerEvaluate);
    $("btn-refresh").addEventListener("click", loadSelections);
    $("btn-refresh-tree").addEventListener("click", loadTree);
    // 二十二期续：知识点独立界面——课程列表点击 + 刷新 + home 入口卡跳转
    const learnList = $("learn-course-list");
    if (learnList) {
        learnList.addEventListener("click", (ev) => {
            const item = ev.target.closest(".learn-course-item");
            if (item) selectLearnCourse(item.dataset.course);
        });
    }
    const btnLearnRefresh = $("btn-refresh-learn");
    if (btnLearnRefresh) btnLearnRefresh.addEventListener("click", renderKnowledgeCenter);
    initPopovers();
    $("modal-cancel").addEventListener("click", () => $("modal").classList.add("hidden"));
    $("modal-ok").addEventListener("click", submitReason);
    $("detail-close").addEventListener("click", () => $("detail-modal").classList.add("hidden"));
    document.addEventListener("click", (ev) => {
        // 二十二期续（文件列表式）：名称点击 = 只展开（折叠时展开，已展开不收起——不吞文字）
        // + 右侧联动（selectNode）；箭头点击 = 只收起（不负责展开）
        const treeNode = ev.target.closest("#domain-tree .tree-node");
        if (treeNode) {
            ev.stopPropagation(); // 十三期：阻止冒泡到父级行（点课程不再覆盖成领域）
            const caret = ev.target.closest("#domain-tree .tree-caret");
            const children = Array.from(treeNode.children).find((el) => el.classList.contains("tree-children"));
            if (children) {
                if (caret) {
                    // 箭头 = 只收起（已折叠则无动作）
                    if (!treeNode.classList.contains("collapsed")) {
                        treeNode.classList.add("collapsed");
                        children.style.display = "none";
                    }
                    return;
                }
                // 名称 = 只展开（已展开则无动作，不收起/不吞）
                if (treeNode.classList.contains("collapsed")) {
                    treeNode.classList.remove("collapsed");
                    children.style.display = "";
                }
            }
            selectNode(treeNode.dataset.kind, treeNode.dataset.id);
            return;
        }
        const nav = ev.target.closest("[data-nav]");
        if (nav) { location.hash = nav.dataset.nav; return; }
        // 十六期（service-control 前端契约）：服务控制区按钮（启动/停止/重启）优先处理
        const svcBtn = ev.target.closest("button[data-service-act]");
        if (svcBtn) {
            openServiceConfirm(svcBtn.dataset.svc, svcBtn.dataset.serviceAct);
            return;
        }
        const btn = ev.target.closest("button[data-act]");
        if (!btn) return;
        const { act, id, kind } = btn.dataset;
        if (act === "retry-tree") { clearTimeout(_treeRetryTimer); loadTree(); }
        else if (act === "confirm") confirmSelection(id);
        else if (act === "backup") backupSelection(id);
        else if (act === "create-downloads") createDownloads(id);
        else if (act === "register") registerDownload(id);
        else if (act === "approve") approveDownload(id);
        else if (act === "reject") openReasonModal(id, kind);
        else if (act === "detail") openDetailModal(kind, id);
    });
    window.addEventListener("hashchange", route);
    initTreeResizer();
}

/* ---------- 知识点树宽可调（四期 ARCH-004 D6，十一期：默认 400px、范围 280-640px） ----------
 * 拖拽手柄调整树宽，宽度记忆到 localStorage（键 qed-tree-w）。 */

function initTreeResizer() {
    const resizer = $("tree-resizer");
    const layout = $("download-layout");
    if (!resizer || !layout) return;
    const saved = Number(localStorage.getItem("qed-tree-w"));
    if (saved >= 280 && saved <= 640) layout.style.setProperty("--tree-w", saved + "px");
    resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const side = $("download-side");
        const startW = side ? side.offsetWidth : 400;
        const onMove = (ev) => {
            const w = Math.min(640, Math.max(280, startW + (ev.clientX - startX)));
            layout.style.setProperty("--tree-w", w + "px");
        };
        const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            const side2 = $("download-side");
            localStorage.setItem("qed-tree-w", String(side2 ? Math.round(side2.offsetWidth) : 400));
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    });
}

/* ---------- 卡片详情弹窗（任务/资源，成功与失败均可查看） ---------- */

/* 四期（ARCH-004 D4）：catalog target → 课程/领域/目标标题，供详情弹窗标注解析目标 */
function targetInfo(targetId) {
    if (!targetId) return null;
    const t = state.catalog.find((x) => x.id === targetId);
    if (!t) return null;
    return { title: t.title, courseId: t.course_id, courseName: t.course_name || t.course_id, domain: domainOf(t.catalog_id || "math-qe") };
}

/* 四期：语言 → 中/英 标签（详情「中英」字段） */
function langLabel(lang) {
    if (lang === "zh" || lang === "chi") return "中文";
    if (lang === "eng" || lang === "en") return "英文";
    return lang || "—";
}

function kvTable(obj) {
    const rows = Object.entries(obj)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${Array.isArray(v) ? v.map(esc).join("、") : esc(String(v))}</td></tr>`);
    return `<table class="detail-table">${rows.join("")}</table>`;
}

function jsonPre(obj) {
    return `<pre class="detail-pre">${esc(JSON.stringify(obj, null, 2))}</pre>`;
}

function reportSection(title, items, field) {
    const list = (items || []).map((it) => {
        const row = field ? it[field] : (it.title ?? it.resource_id ?? it.target_id);
        const note = it.reason ? `<div class="section-note">${esc(it.reason)}</div>` : "";
        return `<li>${esc(row ?? JSON.stringify(it))}${note}</li>`;
    }).join("");
    if (!list) return "";
    return `<div class="detail-section"><h3>${esc(title)}（${(items || []).length}）</h3><ul class="section-list">${list}</ul></div>`;
}

function renderTaskDetail(t) {
    const status = esc(t.status ?? "—");
    // 四期（D4）：任务详情标注课程（params.course_id → 课程名 + 领域）
    const courseParam = t.params && t.params.course_id;
    const courseRef = courseParam ? targetInfo(courseParam) : null;
    const result = t.result && typeof t.result === "object"
        ? reportSection("候选", t.result.candidates, "title")
            + reportSection("待人工确认", t.result.pending_manual, "target_id")
            + reportSection("未找到（来源不可得）", t.result.not_found, "target_id")
            + reportSection("跳过", t.result.skipped, "target_id")
            + reportSection("错误", t.result.errors, "message")
            + (t.result.summary ? `<div class="detail-section"><h3>汇总</h3><p class="section-note">${esc(t.result.summary)}</p></div>` : "")
        : "";
    const error = t.error ? `<div class="detail-section error-box"><h3>错误</h3><pre class="detail-pre">${esc(t.error)}</pre></div>` : "";
    return `
        ${kvTable({
            task_id: t.task_id, type: t.type, status,
            course: courseRef ? `${courseRef.courseName}（${courseRef.domain}）` : (courseParam || "—"),
            progress: (Number(t.progress) || 0) + "%",
            created_at: t.created_at, updated_at: t.updated_at,
            message: t.message,
        })}
        ${t.params ? `<div class="detail-section"><h3>参数</h3>${jsonPre(t.params)}</div>` : ""}
        ${result}
        ${error}`;
}

/* ---------- 十七期：套书详情（表1 全字段） + 册详情（表2 + 表3 来源） ---------- */

function renderSelectionDetail(sel) {
    const v = sel.version || {};
    const target = state.catalog.find((t) => t.course_id === sel.course_id);
    const parseGoal = target ? `
        <div class="detail-section">
            <h3>解析目标</h3>
            <div class="goal-line">
                <span class="badge course">${esc(domainOf(target.catalog_id || "math-qe"))}</span>
                <span class="goal-text">${esc(target.course_name || sel.course_id)} → ${esc(sel.title)}</span>
            </div>
        </div>` : "";
    const vols = (sel.downloads || []).map((d) =>
        `<li>${esc(d.vol || "整册")}【${esc(STATUS_LABEL[d.status] || d.status)}】${d.relative_path ? " · " + esc(d.relative_path) : ""}</li>`).join("");
    return `
        ${kvTable({
            selection_id: sel.selection_id, title: sel.title, status: sel.status, course: courseOf(sel),
            中英: langLabel(v.language || ""), authors: sel.authors, roles: roleLabels(sel.roles),
            version: [v.edition, v.publisher, v.year].filter(Boolean).join(" / ") || "—",
            set_no: setNoOf(sel) || "—", vols: (sel.vols || []).join("、") || "—",
            created_at: sel.created_at, confirmed_at: sel.confirmed_at,
        })}
        <p class="section-note">版本徽标：${versionBadge(sel)}（中译/英文/苏版判定，苏版 = 中译 + 作者命中苏版名单）</p>
        ${parseGoal}
        ${sel.evaluation ? `<div class="detail-section"><h3>LLM 预填评价</h3>${jsonPre(sel.evaluation)}</div>` : ""}
        ${sel.note ? `<div class="detail-section"><h3>评审建议</h3><p class="section-note">${esc(sel.note)}</p></div>` : ""}
        ${sel.reject_reason ? `<div class="detail-section error-box"><h3>拒绝记录</h3><p class="section-note">${esc(sel.reject_reason)}</p></div>` : ""}
        <div class="detail-section"><h3>册明细（表2）</h3><ul class="section-list">${vols || "<li>（暂无册明细，可先「新建候选册」）</li>"}</ul></div>
    `;
}

async function renderDownloadDetail(d) {
    // 表3 来源（渠道尝试：manual / internet_archive / open_library / google_books / libgen_li）
    let sources = [];
    try {
        sources = await fetchJson(TRACKER_BASE + ENDPOINTS.downloads + "/" + encodeURIComponent(d.download_id) + ENDPOINTS.sources);
    } catch (_) { /* 8900 离线：来源不可用不阻断详情（独立性铁律） */ }
    const srcRows = sources.map((s) =>
        `<li>${esc(s.channel)}（${esc(s.provider_id || "—")}）${s.page_url ? ` → <a href="${esc(s.page_url)}" target="_blank" rel="noopener">${esc(s.page_url)}</a>` : ""}${s.ok ? " ✓" : ""}</li>`).join("");
    return `
        ${kvTable({
            download_id: d.download_id, selection_id: d.selection_id, vol: d.vol || "整册",
            status: d.status, file_hint: d.file_hint, roles: roleLabels(d.roles),
            relative_path: d.relative_path, page_count: d.page_count, sha256: d.sha256,
            created_at: d.created_at, downloaded_at: d.downloaded_at, approved_at: d.approved_at,
        })}
        ${d.intro ? `<div class="detail-section"><h3>简介</h3><p class="section-note">${esc(d.intro)}</p></div>` : ""}
        ${d.review_note ? `<div class="detail-section"><h3>评审建议</h3><p class="section-note">${esc(d.review_note)}</p></div>` : ""}
        ${d.reject_reason ? `<div class="detail-section error-box"><h3>拒绝记录</h3><p class="section-note">${esc(d.reject_reason)}</p></div>` : ""}
        <div class="detail-section"><h3>来源与下载方案（表3 渠道）</h3><ul class="section-list">${srcRows || "<li>（暂无渠道记录）</li>"}</ul></div>
    `;
}

async function openDetailModal(kind, id) {
    const modal = $("detail-modal");
    const body = $("detail-body");
    modal.classList.remove("hidden");
    body.innerHTML = "加载中…";
    try {
        let payload;
        if (kind === "task") {
            payload = state.tasks.find((t) => t.task_id === id)
                || await fetchJson(TRACKER_BASE + "/tasks/" + encodeURIComponent(id));
            $("detail-title").textContent = "任务详情";
            body.innerHTML = renderTaskDetail(payload);
        } else if (kind === "selection") {
            payload = state.selections.find((s) => s.selection_id === id)
                || await fetchJson(TRACKER_BASE + ENDPOINTS.selections + "/" + encodeURIComponent(id));
            $("detail-title").textContent = "套书详情（表1）";
            body.innerHTML = renderSelectionDetail(payload);
        } else {
            // 表2 册详情：从表1 条目下册明细中查找（rejected/failed 已由数据层过滤隐藏）
            payload = null;
            for (const s of state.selections) {
                const d = (s.downloads || []).find((x) => x.download_id === id);
                if (d) { payload = d; break; }
            }
            if (!payload) throw new Error("册明细不存在（可能已被拒绝/失败隐藏）");
            $("detail-title").textContent = "册详情（表2）";
            body.innerHTML = await renderDownloadDetail(payload);
        }
    } catch (err) {
        body.innerHTML = `<div class="detail-section error-box"><h3>加载失败</h3><p class="section-note">${esc(err.message)}</p></div>`;
    }
}

/* ---------- 筛选选项数据（五期：来自 catalog targets，供按钮弹层渲染） ---------- */

const filterData = { domainOptions: [], courseOptions: [] };

async function populateCourseSelects() {
    if (!state.catalog.length) {
        try {
            const catalog = await fetchJson(TRACKER_BASE + "/catalogs/math-qe");
            state.catalog = Array.isArray(catalog.targets) ? catalog.targets : [];
        } catch (_) { /* 8901 离线：降级为空 */ }
    }
    const courses = new Map();
    for (const t of state.catalog) {
        if (t.course_id && !courses.has(t.course_id)) courses.set(t.course_id, t.course_name || t.course_id);
    }
    if (!courses.size) {
        for (const item of state.selections) {
            const id = courseOf(item);
            if (id && !courses.has(id)) courses.set(id, id);
        }
    }
    const courseList = [...courses.entries()].sort(([a], [b]) => a.localeCompare(b));
    filterData.courseOptions = courseList.map(([id, name]) => [id, name]);
    // 领域选项：自适应（按 catalog_id 推导学科领域；当前 math-qe → 数学）
    const domains = [...new Set(state.catalog.map((t) => domainOf(t.catalog_id || "math-qe")))].sort();
    filterData.domainOptions = domains.map((d) => [d, d]);
    renderResourceFilters();
    renderTaskFilters();
}

function domainOptions() {
    return [["", "全部"]].concat(filterData.domainOptions);
}

function courseOptions() {
    // 十二期：课程选项随领域收窄——领域已选时只列该领域课程
    const d = state.filters.domain;
    if (d) {
        const narrowed = filterData.courseOptions.filter(([id]) => courseDomain(id) === d);
        return [["", "全部"]].concat(narrowed.length ? narrowed : [["", "（该领域暂无课程）"]]);
    }
    return [["", "全部"]].concat(filterData.courseOptions);
}

/* ---------- 内置操作手册（五期：纯前端内容） ---------- */

const HELP_SECTIONS = [
    {
        title: "学习界面",
        steps: [
            "首页提供三项学习功能：知识点梳理 / 学习 / 刷题模式（建设中，随数据管线逐步开放）。",
            "右上角「管理后台」进入管理功能；「使用手册」随时打开本说明。",
        ],
    },
    {
        title: "仪表大盘",
        steps: [
            "流程进度：四阶段流水线（发现下载 → 评估确认 → 解析 → 知识整理），未就绪的阶段显示「未启用」，不会伪造数据。",
            "服务健康：分组查看后台服务（QED-Tracker 文档下载服务 / Axiom-Flow 文档解析服务 / QED 管理服务）、LLM配置（当前配置模型）与数据库配置（MySQL）状态；异常项直接显示问题文案（如「离线：无法访问」）。",
            "所有服务离线不影响页面展示，数据为空的模块显示离线提示。",
        ],
    },
    {
        title: "知识点",
        steps: [
            "左侧为知识点树，三层知识链路：领域（如数学）→ 课程（按学习深度排序，先学的在前）→ 套书（表1 条目，书名 + 套标记 + 角色徽标【教材/习题集/答案/参考】），点击节点展开/折叠；课程行显示完成徽标：教材 + 习题集均验收通过（approved）才算课程完成。",
            "筛选栏：领域 / 课程 / 状态三个按钮，点击弹出选项（与树选择叠加过滤）；选择「全部」恢复。",
            "套书卡三态评估：确定（候选→已确认）、备选（候选→备选，可转正或放弃）、否定（填原因留痕）；已确认且无册的套书点「新建候选册」生成册级明细。",
            "册级明细（表2）：每册一卡，候选册按「人工下载登记」填数据根相对路径完成登记；已下载册展示文件绝对路径，打开文件人工审理是否达到预期，审理通过点「验收通过」，不达预期「否定」填原因。",
            "「② 评估书单」按钮（选中课程后出现在面板顶部操作条）：刷新该课程表1 书单（AI 搜索评估任务已随 QED-030 退役，评估=人工对候选做三态决策），进度在步骤条（① 选择→② 评估→③ 下载→④ 审理）展示。",
            "三态评审时可填一句建议（评审建议输入框，选填），随确定/备选/否定一并提交，落库供后续参考。",
        ],
    },
    {
        title: "课程收集流程（五阶段）",
        steps: [
            "阶段 0｜先验课程体系：选定课程范围与参考书目（catalog 章程登记套一/套二/套三底线：每套 ≥1 本教材 + ≥1 本习题集，两套全部验收通过即课程完成）。",
            "阶段 1｜第一轮评估：刷新书单（「② 评估书单」）后候选条目人工三态确认（确定/备选/否定），候选确认入书单（表1）。",
            "阶段 2｜下载与登记：确认后的套书点「新建候选册」生成表2 册级候选；按下载方案人工下载后填相对路径「人工下载登记」（服务端校验 PDF + SHA-256）。",
            "阶段 3｜审理与验收：下载完毕展示文件绝对路径，人工打开审理是否达到预期 → 逐册「验收通过」（approved）或「否定」；验收通过的册卡与详情展示版本徽标（中译本/英文版/苏版）。",
            "阶段 4｜第二轮评估、一轮课程完成：验收通过资源进入解析管线（Axiom-Flow）与质量审阅，为知识整理供料；课程内 ≥2 套（每套教材 + 习题集均 approved）即显示「已完成」，套数 3+ 全部完成时徽标显示 +N 余量。",
        ],
    },
    {
        title: "常见问题",
        steps: [
            "离线提示含义：对应服务未启动（如 QED-Tracker 未运行）时相关模块显示离线，不影响其他模块。",
            "下拉筛选文字看不清？已改为按钮弹层样式（浅底深字），不会再出现白色文字问题。",
        ],
    },
];

function openHelpModal() {
    const modal = $("help-modal");
    const body = $("help-body");
    if (!modal || !body) return;
    body.innerHTML = HELP_SECTIONS.map((s) => `
        <div class="detail-section"><h3>${esc(s.title)}</h3>
            <ol class="help-steps">${s.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>
        </div>`).join("");
    modal.classList.remove("hidden");
}

/* ---------- 启动 ---------- */

async function init() {
    bindEvents();
    startTaskPolling();
    route();
    // 主体界面兜底：即使 8901 离线也给出提示（已由各视图处理）
}

document.addEventListener("DOMContentLoaded", init);
