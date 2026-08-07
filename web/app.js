"use strict";
/* QED-Engine 前端（8903 静态页）：主体学习界面 + 后台管理（hash 路由）。
 * 数据源：8900 QED 管理服务（横幅/健康）+ 8901 QED-Tracker（目录/资源/任务/统计）。
 * 契约：docs/design/service-contracts.md；离线时各模块独立降级显示（独立性铁律）。
 * 三期（2026-08-06）：横幅粗粒度化、主界面三卡、仪表盘 SVG 图表、
 * 下载管理「知识点-领域-课程-书籍」树 + 事务面板、解析/对照空态。
 * 四期（2026-08-06）：卡片墙、严格三领域、树主评估窄 + 拖拽记忆、筛选栏、详情评估视角。
 * 五期（2026-08-06）：入口页零后台痕迹 + 使用手册、仪表大盘四阶段流水线 + 服务健康面板、
 * 知识点四级树 +（N本）计数、按钮弹层筛选器。
 * 六期（2026-08-06）：取消「模块总览」卡片墙与「追溯」，#/admin 直达仪表大盘。
 * 七期（2026-08-06）：修复管理视图互斥显示（.view 显隐规则）；界面改名
 * 仪表大盘 / 文档下载管理 / 文档解析进度（树根同步改名）。
 * 视觉规范：DeepSeek 蓝黑风格，样式见 style.css。 */

const CONFIG_BASE = "http://127.0.0.1:8900/api/v1";
const TRACKER_BASE = "http://127.0.0.1:8901/api/v1";
const AXIOM_BASE = "http://127.0.0.1:8902/api/v1";

/* 端点引用表（tests/test_web.py 守护与契约一致性，勿随意改名） */
const ENDPOINTS = {
    health: "/api/v1/health",
    keys: "/config/keys",
    models: "/config/models",
    database: "/config/database",
    llmStatus: "/config/llm-status",
    resources: "/resources",
    tasks: "/tasks",
    evaluate: "/tasks/catalog/evaluate",
    confirm: "/confirm",
    backup: "/backup",
    reject: "/reject",
    approve: "/approve",
    file: "/file",
    download: "/tasks/books/download",
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
    resources: [],
    tasks: [],
    catalog: [], // catalog targets（8901 /catalogs/math-qe）
    selection: null, // {kind: "domain"|"course"|"target", id: string}
    filters: { domain: "", course: "", status: "" }, // 资源筛选（与树选择 AND 叠加）
    pollTimer: null,
    modalAction: null, // {type, id}
};

/* 筛选器选项定义（值 → 标签；空串 = 全部） */
const RESOURCE_STATUS_OPTIONS = [
    ["", "全部"], ["candidate", "候选"], ["backup", "备选"], ["confirmed", "已确认"],
    ["downloading", "下载中"], ["downloaded", "已下载"], ["approved", "已验收"],
    ["rejected", "已拒绝"], ["failed", "失败"], ["pending_manual", "待人工补充"],
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
}

function renderResourceFilters() {
    renderPopover("filter-domain", domainOptions(), "领域");
    renderPopover("filter-course", courseOptions(), "课程");
    renderPopover("filter-status", RESOURCE_STATUS_OPTIONS, "状态");
}

/* ---------- 通用 ---------- */

async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
        let detail = res.statusText;
        try {
            const body = await res.json();
            if (body.detail) detail = body.detail;
        } catch (_) { /* 非 JSON 响应 */ }
        throw new Error(res.status + " " + detail);
    }
    return res.json();
}

function $(id) { return document.getElementById(id); }

function esc(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
}

function courseOf(item) {
    const ref = item.catalog_ref;
    if (ref && ref.course_id) return ref.course_id;
    return item.course_id || "—";
}

/* ---------- 路由 ---------- */

function currentRoute() {
    const path = (location.hash || "#/").replace(/^#/, "");
    return ROUTES[path] || ROUTES["/"];
}

function route() {
    const r = currentRoute();
    const isAdmin = r.page === "admin";
    $("page-home").classList.toggle("active", !isAdmin);
    $("page-admin").classList.toggle("active", isAdmin);
    document.title = isAdmin ? "管理后台 · QED-Engine" : "QED-Engine";
    if (isAdmin) {
        const navHash = location.hash.replace(/^#/, "") || "/";
        // #/admin 为仪表大盘别名：高亮「仪表大盘」菜单
        const activeHash = navHash === "/admin" ? "/admin/dashboard" : navHash;
        document.querySelectorAll(".sidebar .nav-item").forEach((a) => {
            a.classList.toggle("active", a.getAttribute("href") === "#" + activeHash);
        });
        showAdminView(r.view || "dashboard");
    }
}

function showAdminView(view) {
    document.querySelectorAll("#page-admin .view").forEach((v) => v.classList.remove("active"));
    const el = $("view-" + view);
    if (el) el.classList.add("active");
    if (view === "dashboard") loadDashboard();
    else if (view === "downloads") {
        loadTree();
        loadResources();
        loadTasks();
        populateCourseSelects();
    }
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
        const [db, llm] = await Promise.all([
            fetchJson(CONFIG_BASE + ENDPOINTS.database),
            fetchJson(CONFIG_BASE + ENDPOINTS.llmStatus),
        ]);
        // 粗粒度横幅（ARCH-003 决策 D2/D3）：只显示模块连接状态，不透露 provider 名单与主机细节。
        const providers = ["qwen", "glm", "deepseek"].map((p) => llm[p] || {});
        const configured = providers.some((s) => s.reason !== "未配置");
        const llmOk = configured && providers.some((s) => s.reachable);
        const llmLabel = !configured ? "未配置" : llmOk ? "OK" : "不可用";
        const llmCls = !configured ? "dim" : llmOk ? "hl" : "hl-off";
        const dbLabel = !db.configured ? "未配置" : db.reachable ? "OK" : "连接失败";
        const dbCls = !db.configured ? "dim" : db.reachable ? "hl" : "hl-off";
        banner.innerHTML = `LLM评估模块连接：<span class="${llmCls}">${llmLabel}</span> / MySQL数据库连接：<span class="${dbCls}">${dbLabel}</span>`;
        banner.classList.toggle("warn", !llmOk || !db.reachable);
    } catch (_) {
        banner.textContent = "QED 管理服务 8900 离线，横幅不可用";
        banner.classList.add("warn");
    }
}

/* ---------- 仪表大盘（五期：四阶段流水线 + 服务健康分组面板，8901/8900 离线降级） ---------- */

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
        const [catalog, resources] = await Promise.all([
            fetchJson(TRACKER_BASE + "/catalogs/math-qe"),
            fetchJson(TRACKER_BASE + ENDPOINTS.resources),
        ]);
        state.resources = resources;
        // 分母：catalog targets 去重 course_id
        const courseIds = new Set((catalog.targets || []).map((t) => t.course_id).filter(Boolean));
        totalCourses = courseIds.size;
        // 课程聚合：每门课的资源状态集合
        const byCourse = {};
        for (const item of resources) {
            const cid = courseOf(item);
            (byCourse[cid] = byCourse[cid] || []).push(item.status);
        }
        for (const cid of courseIds) {
            const statuses = byCourse[cid] || [];
            if (statuses.length) discoverDone += 1; // 宽松：有任一资源
            if (statuses.length && !statuses.some((s) => s === "candidate" || s === "pending_manual")) {
                confirmDone += 1; // 严格：无待评估资源
            }
        }
    } catch (_) {
        // 8901 离线：流水线整体离线提示
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

async function loadHealthPanel() {
    const panel = $("health-panel");
    const servicesBox = $("health-services");
    const llmBox = $("health-llm");
    const dbBox = $("health-db");
    const mk = healthStatusMarkup();
    if (!panel || !servicesBox || !llmBox || !dbBox) return;
    // 后台服务：探测 8901/8902/8900 健康端点（名称带核心任务备注；正常不写原因，仅绿点+名称）
    const probes = [
        ["QED-Tracker（文档下载服务）", TRACKER_BASE + ENDPOINTS.health],
        ["Axiom-Flow（文档解析服务）", AXIOM_BASE + ENDPOINTS.health],
        ["QED 管理服务（后台管理服务）", CONFIG_BASE + ENDPOINTS.health],
    ];
    const results = await Promise.all(probes.map(async ([name, url]) => {
        try {
            await fetchJson(url);
            return mk.ok(name);
        } catch (err) {
            return mk.bad(name, "离线：" + (err.message || "无法访问"));
        }
    }));
    servicesBox.innerHTML = results.join("");
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

/* ---------- 知识点（三层知识链路树 + 事务面板） ---------- */

/* 五期：资源所属学科领域（与树领域层一致：catalog_id → 学科名） */
function itemDomain(item) {
    const ref = item.catalog_ref || {};
    return domainOf(ref.catalog_id || "math-qe");
}

function scopeMatches(item, selection) {
    if (!selection) return true;
    if (selection.kind === "domain") return itemDomain(item) === selection.id;
    if (selection.kind === "course") return courseOf(item) === selection.id;
    if (selection.kind === "target") {
        const ref = item.catalog_ref || {};
        if (ref.target_id) return ref.target_id === selection.id;
        return false; // target 级只匹配带 catalog_ref 的评估资源
    }
    return true;
}

async function loadResources() {
    try {
        state.resources = await fetchJson(TRACKER_BASE + ENDPOINTS.resources);
    } catch (err) {
        $("resource-list").textContent = "QED-Tracker 8901 离线：" + err.message;
        return;
    }
    renderPanel();
}

function renderPanel() {
    // 四期/五期（ARCH-004 D3 + ARCH-005 D7）：筛选器（领域/课程/状态）与树选择独立叠加（AND）
    const status = state.filters.status;
    const domain = state.filters.domain;
    const course = state.filters.course;
    const sel = state.selection;
    let items = state.resources.filter(
        (it) =>
            (!status || it.status === status) &&
            (!domain || itemDomain(it) === domain) &&
            (!course || courseOf(it) === course) &&
            scopeMatches(it, sel)
    );
    // 按课程评估视图（QED-017 中文优先裁决）：中文候选排前，组内按 target 分组、评分降序
    if (sel && sel.kind === "course") {
        items = [...items].sort((a, b) => {
            const zhA = a.language === "zh" ? 0 : 1;
            const zhB = b.language === "zh" ? 0 : 1;
            if (zhA !== zhB) return zhA - zhB;
            const targetA = (a.catalog_ref && a.catalog_ref.target_id) || "";
            const targetB = (b.catalog_ref && b.catalog_ref.target_id) || "";
            if (targetA !== targetB) return targetA.localeCompare(targetB);
            return (Number(b.llm_evaluation && b.llm_evaluation.score) || 0) - (Number(a.llm_evaluation && a.llm_evaluation.score) || 0);
        });
    }
    const ctx = $("panel-context");
    if (!sel) ctx.textContent = "全目录（未选择节点，展示全部资源）";
    else if (sel.kind === "domain") ctx.textContent = "领域：" + sel.id;
    else if (sel.kind === "course") ctx.textContent = "课程：" + sel.id + "（评估视图：中文优先）";
    else ctx.textContent = "书籍目标：" + sel.id;
    // 十三期：控制台化——选中课程时显示课程操作条（① 搜索书籍 + 步骤进度）
    const consoleEl = $("course-console");
    if (consoleEl) {
        if (sel && sel.kind === "course") {
            consoleEl.classList.remove("hidden");
            $("course-steps").innerHTML = courseSteps(sel.id);
        } else {
            consoleEl.classList.add("hidden");
        }
    }
    // 十二期：有选中范围时展示该范围全部书籍（未生成资源的显示「待评估」占位）
    const rangeTargets = rangeTargetsOf(sel);
    if (rangeTargets) {
        renderPanelByTargets(items, rangeTargets);
        return;
    }
    if (!items.length) {
        $("resource-list").innerHTML = '<div class="empty-state"><div class="emoji">📭</div>（该范围暂无资源记录）</div>';
        return;
    }
    // 按 target 分组成段，组内卡片网格
    const groups = new Map();
    for (const it of items) {
        const key = (it.catalog_ref && it.catalog_ref.target_id) || "";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(it);
    }
    let html = "";
    for (const [key, list] of groups) {
        if (key) html += `<div class="eval-group-title">${esc(key)}</div>`;
        html += `<div class="card-grid">${list.map(resourceCard).join("")}</div>`;
    }
    $("resource-list").innerHTML = html;
}

/* 选中范围的全部书籍目标（十二期）：领域→其下所有课程书籍；课程→全部书籍；书籍→单本；
 * 无选中（全目录）返回 null（保持只列资源）。按学习深度顺序排序。 */
function rangeTargetsOf(sel) {
    if (!sel || !state.catalog.length) return null;
    let targets = [];
    if (sel.kind === "domain") {
        targets = state.catalog.filter((t) => domainOf(t.catalog_id || "math-qe") === sel.id);
    } else if (sel.kind === "course") {
        targets = state.catalog.filter((t) => t.course_id === sel.id);
    } else if (sel.kind === "target") {
        targets = state.catalog.filter((t) => t.id === sel.id);
    } else {
        return null;
    }
    return targets.sort((a, b) => {
        const ca = COURSE_ORDER.indexOf(a.course_id);
        const cb = COURSE_ORDER.indexOf(b.course_id);
        return ((ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb)) || a.id.localeCompare(b.id);
    });
}

/* 按范围全部书籍渲染：每组一本目标，有资源出卡片、无资源出「待评估」占位卡 */
function renderPanelByTargets(items, targets) {
    const byTarget = new Map();
    for (const it of items) {
        const tid = (it.catalog_ref && it.catalog_ref.target_id) || "";
        if (!byTarget.has(tid)) byTarget.set(tid, []);
        byTarget.get(tid).push(it);
    }
    let html = "";
    for (const t of targets) {
        const list = byTarget.get(t.id) || [];
        const title = `${esc(t.title)}（${esc((t.authors || []).join("、") || "佚名")}）【${esc(bookTypeLabel(t.kind))}】`;
        html += `<div class="eval-group-title">${title}</div>`;
        if (list.length) {
            html += `<div class="card-grid">${list.map(resourceCard).join("")}</div>`;
        } else {
            html += `<div class="card-grid"><div class="card card-pending">
                <div class="card-head">
                    <div><div class="card-title">${esc(t.title)}</div>
                    <div class="card-sub">${esc((t.authors || []).join("、") || "作者未知")}</div></div>
                    <span class="tree-type">${esc(bookTypeLabel(t.kind))}</span>
                </div>
                <div class="verdict">待评估：尚未生成候选资源，点击「① 搜索书籍」后由 AI 检索候选。</div>
            </div></div>`;
        }
    }
    $("resource-list").innerHTML = html || '<div class="empty-state"><div class="emoji">📭</div>（该范围暂无书籍）</div>';
}

/* ---------- 知识点树（十一期：三层知识链路 领域→课程→书籍，学习深度排序） ---------- */

async function loadTree() {
    const tree = $("domain-tree");
    tree.textContent = "加载中…";
    try {
        const catalog = await fetchJson(TRACKER_BASE + "/catalogs/math-qe");
        state.catalog = Array.isArray(catalog.targets) ? catalog.targets : [];
        if (!state.resources.length) {
            try {
                state.resources = await fetchJson(TRACKER_BASE + ENDPOINTS.resources);
            } catch (_) { /* 资源离线不影响树结构 */ }
        }
    } catch (err) {
        tree.innerHTML = `<div class="empty-state">QED-Tracker 8901 离线：${esc(err.message)}</div>`;
        return;
    }
    renderTree();
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

/* 书籍类型徽标（十一期）：kind → 显示名（book 教材 / exercise 习题集 / 其他 资料） */
function bookTypeLabel(kind) {
    if (kind === "book") return "教材";
    if (kind === "exercise") return "习题集";
    return "资料";
}

/* 课程完成判定（十一期）：≥1 本教材 + ≥1 本习题集均人工验证（approved 验收通过）才算完成 */
function courseCompletion(courseId) {
    const targets = state.catalog.filter((t) => t.course_id === courseId);
    const approvedTargets = new Set();
    for (const r of state.resources) {
        const tid = (r.catalog_ref || {}).target_id;
        if (r.status === "approved" && tid) approvedTargets.add(tid);
    }
    let bookApproved = 0, bookTotal = 0, exApproved = 0, exTotal = 0;
    for (const t of targets) {
        if (t.kind === "book") { bookTotal += 1; if (approvedTargets.has(t.id)) bookApproved += 1; }
        else if (t.kind === "exercise") { exTotal += 1; if (approvedTargets.has(t.id)) exApproved += 1; }
    }
    return { done: bookTotal > 0 && exTotal > 0 && bookApproved >= 1 && exApproved >= 1, bookApproved, bookTotal, exApproved, exTotal };
}

/* 知识点树（十一期）：三层知识链路 领域 → 课程 → 书籍，
 * PyCharm 式交互：箭头=展开/折叠（不触发选中），名称=选中过滤面板。 */
function renderTree() {
    const tree = $("domain-tree");
    const courses = new Map();
    for (const t of state.catalog) {
        if (!courses.has(t.course_id)) courses.set(t.course_id, { id: t.course_id, name: t.course_name, targets: [] });
        courses.get(t.course_id).targets.push(t);
    }
    const byDomain = new Map(); // 领域名 -> [课程]
    for (const course of courses.values()) {
        const catalogId = course.targets[0].catalog_id || "math-qe";
        const domain = domainOf(catalogId);
        if (!byDomain.has(domain)) byDomain.set(domain, []);
        byDomain.get(domain).push(course);
    }
    const domainsHtml = [...byDomain.entries()].map(([domain, courseList]) => {
        const coursesHtml = courseList
            .sort((a, b) => {
                const ia = COURSE_ORDER.indexOf(a.id);
                const ib = COURSE_ORDER.indexOf(b.id);
                return ((ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)) || a.id.localeCompare(b.id);
            })
            .map((c) => {
                const done = courseCompletion(c.id);
                const badge = done.done
                    ? `<span class="course-done">✅ 已完成</span>`
                    : `<span class="course-progress">教材 ${done.bookApproved}/${done.bookTotal} · 习题集 ${done.exApproved}/${done.exTotal}</span>`;
                const targetsHtml = c.targets.map((t) => `
                    <div class="tree-node tree-target" data-kind="target" data-id="${esc(t.id)}" data-label="${esc(t.title)}">
                        <span class="tree-name" title="${esc(t.title)}">${esc(t.title)}</span>
                        <span class="tree-author">${esc((t.authors || []).join("、"))}</span>
                        <span class="tree-type">${esc(bookTypeLabel(t.kind))}</span>
                    </div>`).join("");
                return `
                    <div class="tree-node tree-course collapsed" data-kind="course" data-id="${esc(c.id)}" data-label="${esc(c.name)}">
                        <span class="tree-caret">▸</span><span class="tree-name">${esc(c.name)}</span>
                        ${badge}
                        <div class="tree-children" style="display:none">${targetsHtml}</div>
                    </div>`;
            }).join("");
        return `
            <div class="tree-node tree-domain" data-kind="domain" data-id="${esc(domain)}" data-label="${esc(domain)}">
                <span class="tree-caret">▾</span><span class="tree-name">${esc(domain)}</span>
                <span class="tree-count">${courseList.length} 门课程</span>
                <div class="tree-children">${coursesHtml}</div>
            </div>`;
    }).join("");
    tree.innerHTML = domainsHtml || `<div class="empty-state">暂无课程目录</div>`;
    // PyCharm 式交互：箭头=展开/折叠；名称=选中（领域/课程/书籍均可选）
    tree.querySelectorAll(".tree-node").forEach((node) => {
        const children = node.querySelector(":scope > .tree-children");
        const caret = node.querySelector(":scope > .tree-caret");
        if (caret) {
            caret.addEventListener("click", (ev) => {
                ev.stopPropagation();
                if (!children) return;
                const collapsed = node.classList.toggle("collapsed");
                children.style.display = collapsed ? "none" : "";
            });
        }
        node.addEventListener("click", (ev) => {
            if (ev.target === caret) return; // 已由箭头处理
            ev.stopPropagation(); // 十三期修复：阻止冒泡到父级行（点课程不再覆盖成领域）
            selectNode(node.dataset.kind, node.dataset.id);
        });
    });
}

/* 课程所属领域（十二期）：经课程任一 target 的 catalog_id → 领域映射 */
function courseDomain(courseId) {
    const t = state.catalog.find((x) => x.course_id === courseId);
    return t ? domainOf(t.catalog_id || "math-qe") : "";
}

function selectNode(kind, id) {
    state.selection = { kind, id };
    document.querySelectorAll(".tree-node").forEach((n) => n.classList.remove("selected"));
    const node = document.querySelector(`.tree-node[data-kind="${kind}"][data-id="${CSS.escape(id)}"]`);
    if (node) node.classList.add("selected");
    // 十二期：树→筛选器单向联动——点领域/课程同步弹层筛选，书籍级不改筛选
    if (kind === "domain") {
        state.filters.domain = id;
        state.filters.course = "";
    } else if (kind === "course") {
        state.filters.domain = courseDomain(id) || state.filters.domain;
        state.filters.course = id;
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

function resourceCard(it) {
    const source = it.source || {};
    const link = source.page_url
        ? `<a href="${esc(source.page_url)}" target="_blank" rel="noopener">来源页 ↗</a>`
        : (source.provider || "来源：—");
    const actions = [];
    if (it.status === "candidate") {
        // 人工评估三态（QED-017）：确定 / 备选 / 否定
        actions.push(`<button class="btn primary" data-act="confirm" data-id="${esc(it.resource_id)}">确定</button>`);
        actions.push(`<button class="btn" data-act="backup" data-id="${esc(it.resource_id)}">备选</button>`);
        actions.push(`<button class="btn danger" data-act="reject" data-id="${esc(it.resource_id)}">否定</button>`);
    } else if (it.status === "backup") {
        // 备选：可转正下载，或放弃（填原因）
        actions.push(`<button class="btn primary" data-act="confirm" data-id="${esc(it.resource_id)}">转正</button>`);
        actions.push(`<button class="btn danger" data-act="reject" data-id="${esc(it.resource_id)}">放弃</button>`);
    } else if (it.status === "confirmed") {
        actions.push(`<button class="btn primary" data-act="download" data-id="${esc(it.resource_id)}">开始下载</button>`);
    } else if (it.status === "downloaded") {
        actions.push(`<button class="btn primary" data-act="approve" data-id="${esc(it.resource_id)}">验收通过</button>`);
        actions.push(`<button class="btn danger" data-act="reject" data-id="${esc(it.resource_id)}">删除（填原因）</button>`);
    }
    const reason = it.reject_reason ? `<div class="reject-note">拒因：${esc(it.reject_reason)}</div>` : "";
    const review = it.review_note ? `<div class="reject-note review-note">评审建议：${esc(it.review_note)}</div>` : "";
    // 十四期：人工评审建议（review_note）——三态按钮旁建议输入框，随三态一并提交（QED-020）
    const noteInput = it.status === "candidate" || it.status === "backup"
        ? `<input type="text" class="review-note" data-note-for="${esc(it.resource_id)}" placeholder="填一句评审建议（可选）…" value="${esc(it.review_note || "")}">`
        : "";
    const sub = [it.language || "—", (it.authors || []).join("、") || "—", link].join('<span class="sep">·</span>');
    return `<div class="card">
        <div class="card-head">
            <div>
                <div class="card-title">${esc(it.title ?? it.resource_id)}</div>
                <div class="card-sub">${sub}</div>
            </div>
            <span class="badge course">${esc(courseOf(it))}</span>
        </div>
        ${scoreMarkup(it.llm_evaluation)}
        ${reason}
        ${review}
        <div class="card-actions">
            <span class="status-badge status-${esc(it.status || "unknown")}">${esc(STATUS_LABEL[it.status] || it.status)}</span>
            ${actions.join("")}
            <button class="btn ghost" data-act="detail" data-kind="resource" data-id="${esc(it.resource_id)}">详情</button>
        </div>
        ${noteInput}
    </div>`;
}

/* 十四期：随三态一并提交的评审建议（QED-020，选填） */
function noteOf(resourceId) {
    const input = document.querySelector(`.review-note[data-note-for="${CSS.escape(resourceId)}"]`);
    return input ? input.value.trim() : "";
}

/* 十三期：控制台化——「① 搜索书籍」按当前选中课程发起 AI 搜索评估（控制台以课程为单位操作） */
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
    btn.textContent = "任务创建中…";
    try {
        const task = await fetchJson(TRACKER_BASE + ENDPOINTS.evaluate, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ course_id: courseId }),
        });
        alert("搜索评估任务已创建：" + task.task_id);
        loadTasks();
    } catch (err) {
        alert("触发搜索评估失败：" + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "① 搜索书籍";
    }
}

/* ---------- 任务中心（8901 /tasks，1s 轮询；十四期：尾部任务列表已移除，
 * 任务数据仅用于课程操作条步骤进度条） ---------- */

async function loadTasks() {
    try {
        state.tasks = await fetchJson(TRACKER_BASE + ENDPOINTS.tasks);
    } catch (err) {
        // 8901 离线：步骤条保持 idle 即可，不中断其他模块（独立性铁律）
        state.tasks = [];
        return;
    }
    // 十三期：任务轮询后刷新课程操作条步骤进度（若课程选中）
    const sel = state.selection;
    const steps = $("course-steps");
    if (sel && sel.kind === "course" && steps) steps.innerHTML = courseSteps(sel.id);
}

/* 十三期控制台：课程步骤进度（搜索 → 确认 → 下载 → 验收）
 * - 搜索：该课程最近 evaluate 任务状态（无任务=未开始）
 * - 确认：已确认 / 候选+待评估（无待评估=完成）
 * - 下载：已下载+已验收 / 已确认+下载中
 * - 验收：已验收 / 已下载 */
function courseSteps(courseId) {
    const res = state.resources.filter((r) => courseOf(r) === courseId);
    const pending = res.filter((r) => r.status === "candidate" || r.status === "pending_manual").length;
    const confirmed = res.filter((r) => r.status === "confirmed").length;
    const downloading = res.filter((r) => r.status === "downloading").length;
    const downloaded = res.filter((r) => r.status === "downloaded").length;
    const approved = res.filter((r) => r.status === "approved").length;
    const evalTasks = (state.tasks || []).filter(
        (t) => t.type === "catalog/evaluate" && (t.params || {}).course_id === courseId
    );
    const lastTask = evalTasks.length ? evalTasks[evalTasks.length - 1] : null;
    const searchState = !lastTask ? "idle" : (lastTask.status === "succeeded" ? "done" : "run");
    const step = (label, st, detail) => `<span class="step-item ${st}">${esc(label)} ${esc(detail)}</span>`;
    const arrow = `<span class="step-arrow">→</span>`;
    return [
        step("搜索", searchState, !lastTask ? "未开始" : (lastTask.status === "succeeded" ? "✓" : "进行中")),
        step("确认", pending === 0 && res.length ? "done" : (res.length ? "run" : "idle"), `${confirmed}/${confirmed + pending}`),
        step("下载", downloaded + approved > 0 ? "done" : (confirmed + downloading > 0 ? "run" : "idle"), `${downloaded + approved}/${confirmed + downloading}`),
        step("验收", approved > 0 ? "done" : (downloaded > 0 ? "run" : "idle"), `${approved}/${downloaded}`),
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

/* ---------- 状态迁移与弹窗 ---------- */

async function confirmResource(id) {
    try {
        const note = noteOf(id);
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.resources + "/" + encodeURIComponent(id) + ENDPOINTS.confirm, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
        });
        alert("已确认下载：" + res.status);
    } catch (err) {
        alert("确认失败：" + err.message);
    }
    loadResources();
    loadTree();
    if (currentRoute().view === "dashboard") loadDashboard();
}

async function backupResource(id) {
    try {
        const note = noteOf(id);
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.resources + "/" + encodeURIComponent(id) + ENDPOINTS.backup, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
        });
        alert("已标记备选（可转正或放弃）：" + res.status);
    } catch (err) {
        alert("标记备选失败：" + err.message);
    }
    loadResources();
    loadTree();
    if (currentRoute().view === "dashboard") loadDashboard();
}

async function downloadResource(id) {
    try {
        const task = await fetchJson(TRACKER_BASE + ENDPOINTS.download, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource_id: id }),
        });
        alert("下载任务已创建：" + task.task_id);
        loadTasks();
    } catch (err) {
        alert("下载任务创建失败：" + err.message);
    }
}

async function approveResource(id) {
    try {
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.resources + "/" + encodeURIComponent(id) + ENDPOINTS.approve, { method: "POST" });
        alert("已验收通过：" + res.status);
    } catch (err) {
        alert("验收失败：" + err.message);
    }
    loadResources();
    loadTree();
}

function openReasonModal(id) {
    state.modalAction = { action: "reject-candidate", id };
    $("modal-title").textContent = "删除/拒绝书目";
    $("modal-reason").value = "";
    $("modal").classList.remove("hidden");
    $("modal-reason").focus();
}

async function submitReason() {
    const { id } = state.modalAction || {};
    const reason = $("modal-reason").value.trim();
    if (!reason) {
        alert("原因必填（留痕可追溯）");
        return;
    }
    $("modal").classList.add("hidden");
    try {
        const note = noteOf(id);
        await fetchJson(TRACKER_BASE + ENDPOINTS.resources + "/" + encodeURIComponent(id) + ENDPOINTS.reject, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason, note }),
        });
        alert("已记录拒绝并留痕");
    } catch (err) {
        alert("拒绝失败：" + err.message);
    }
    loadResources();
    loadTree();
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
    $("btn-refresh").addEventListener("click", loadResources);
    $("btn-refresh-tree").addEventListener("click", loadTree);
    initPopovers();
    $("modal-cancel").addEventListener("click", () => $("modal").classList.add("hidden"));
    $("modal-ok").addEventListener("click", submitReason);
    $("detail-close").addEventListener("click", () => $("detail-modal").classList.add("hidden"));
    document.addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-act]");
        if (!btn) return;
        const { act, id, kind } = btn.dataset;
        if (act === "confirm") confirmResource(id);
        else if (act === "backup") backupResource(id);
        else if (act === "download") downloadResource(id);
        else if (act === "approve") approveResource(id);
        else if (act === "reject") openReasonModal(id);
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

function renderResourceDetail(r) {
    const ev = r.llm_evaluation || {};
    const src = r.source || {};
    const link = src.page_url ? `<a href="${esc(src.page_url)}" target="_blank" rel="noopener">${esc(src.page_url)}</a>` : (src.provider || "—");
    // 四期（ARCH-004 D4）：解析目标建议（catalog target → 课程/领域/目标标题 + 评分徽标）
    const target = r.catalog_ref ? targetInfo(r.catalog_ref.target_id) : null;
    const parseGoal = target ? `
        <div class="detail-section">
            <h3>解析目标</h3>
            <div class="goal-line">
                <span class="badge course">${esc(target.domain)}</span>
                <span class="goal-text">${esc(target.courseName)} → ${esc(target.title)}</span>
                ${ev.verdict ? `<span class="badge verdict-${esc(ev.verdict)}">${esc(ev.verdict)} ${ev.score ? "· " + Number(ev.score).toFixed(1) : ""}</span>` : ""}
            </div>
        </div>` : "";
    // 下载详情（已下载后展示文件信息，供追溯/解析对接）
    const downloadInfo = r.status === "downloaded" || r.relative_path ? `
        <div class="detail-section"><h3>下载详情</h3>
            ${kvTable({ status: r.status, relative_path: r.relative_path, page_count: r.page_count, sha256: r.sha256 })}
        </div>` : "";
    const evaluation = ev.overall_score !== undefined ? `
        <div class="detail-section">
            <h3>LLM 评估（${esc(ev.model || "—")}，${esc(ev.evaluated_at || "—")}）</h3>
            ${kvTable({ score: ev.overall_score, verdict: ev.verdict })}
            ${ev.summary ? `<p class="section-note">${esc(ev.summary)}</p>` : ""}
        </div>` : "";
    const catalog = r.catalog_ref ? `<div class="detail-section"><h3>目录匹配</h3>${jsonPre(r.catalog_ref)}</div>` : "";
    const reject = r.reject_reason ? `<div class="detail-section error-box"><h3>拒绝/删除记录</h3><p class="section-note">${esc(r.reject_reason)}</p></div>` : "";
    // 十四期：人工评审建议展示（QED-020 review_note）
    const review = r.review_note ? `<div class="detail-section"><h3>评审建议</h3><p class="section-note">${esc(r.review_note)}</p></div>` : "";
    return `
        ${kvTable({
            resource_id: r.resource_id, title: r.title, status: r.status,
            course: courseOf(r), 中英: langLabel(r.language),
            authors: r.authors, year: r.year, edition: r.edition, kind: r.kind,
            created_at: r.created_at, updated_at: r.updated_at,
        })}
        ${parseGoal}
        <div class="detail-section"><h3>来源</h3>
            <table class="detail-table"><tr><th>来源</th><td>${src.provider || "—"}（${src.provider_id || "—"}）</td></tr>
            <tr><th>页面</th><td>${link}</td></tr></table>
        </div>
        ${evaluation}
        ${review}
        ${downloadInfo}
        ${catalog}
        ${reject}`;
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
        } else {
            payload = state.resources.find((r) => r.resource_id === id)
                || await fetchJson(TRACKER_BASE + "/resources/" + encodeURIComponent(id));
            $("detail-title").textContent = "书目资源详情";
            body.innerHTML = renderResourceDetail(payload);
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
        for (const item of state.resources) {
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
            "左侧为知识点树，三层知识链路：领域（如数学）→ 课程（按学习深度排序，先学的在前）→ 具体书籍（书名 + 作者 + 类型徽标【教材/习题集/资料】），点击节点展开/折叠；课程行显示完成徽标：教材 + 习题集均验收通过（approved）才算课程完成。",
            "筛选栏：领域 / 课程 / 状态三个按钮，点击弹出选项（与树选择叠加过滤）；选择「全部」恢复。",
            "资源卡片三态评估：确定（候选→已确认）、备选（候选→备选，可转正或放弃）、否定（填原因留痕）；已确认后可「开始下载」，下载完成可「验收通过」。",
            "「① 搜索书籍」按钮（选中课程后出现在面板顶部操作条）：按该课程发起 AI 搜索评估任务（生成候选资源），进度在步骤条（搜索→确认→下载→验收）自动刷新；未生成候选的书籍在面板显示「待评估」占位。",
            "三态评审时可填一句建议（评审建议输入框，选填），随确定/备选/否定一并提交，落库供后续参考。",
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
