"use strict";
/* QED-Engine 前端（8903 静态页）：主体学习界面 + 后台管理（hash 路由）。
 * 数据源：8900 配置中心（横幅）+ 8901 QED-Tracker（目录/资源/任务/统计）。
 * 契约：docs/design/service-contracts.md；离线时各模块独立降级显示（独立性铁律）。
 * 三期（2026-08-06）：横幅粗粒度化、主界面三卡、仪表盘 SVG 图表、
 * 下载管理「领域-课程-书籍」树 + 事务面板、解析/对照/追溯空态。
 * 视觉规范：DeepSeek 蓝黑风格，样式见 style.css。 */

const CONFIG_BASE = "http://127.0.0.1:8900/api/v1";
const TRACKER_BASE = "http://127.0.0.1:8901/api/v1";
const AXIOM_BASE = "http://127.0.0.1:8902/api/v1";

/* 端点引用表（tests/test_web.py 守护与契约一致性，勿随意改名） */
const ENDPOINTS = {
    health: "/api/v1/health",
    keys: "/config/keys",
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
 * URL 形式：#/（主体界面）、#/admin（卡片墙）、#/admin/dashboard（仪表盘）、
 * #/admin/downloads（文件下载管理）、#/admin/parsing（解析进度）、
 * #/admin/compare（原始文档对照）、#/admin/trace（追溯） */
const ROUTES = {
    "/": { page: "home" },
    "/admin": { page: "admin", view: "admin" },
    "/admin/dashboard": { page: "admin", view: "dashboard" },
    "/admin/downloads": { page: "admin", view: "downloads" },
    "/admin/parsing": { page: "admin", view: "parsing" },
    "/admin/compare": { page: "admin", view: "compare" },
    "/admin/trace": { page: "admin", view: "trace" },
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

const state = {
    resources: [],
    tasks: [],
    catalog: [], // catalog targets（8901 /catalogs/math-qe）
    selection: null, // {kind: "domain"|"course"|"target", id: string}
    pollTimer: null,
    modalAction: null, // {type, id}
};

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
        document.querySelectorAll(".sidebar .nav-item").forEach((a) => {
            a.classList.toggle("active", a.getAttribute("href") === "#" + (location.hash.replace(/^#/, "") || "/"));
        });
        showAdminView(r.view || "dashboard");
    }
}

function showAdminView(view) {
    document.querySelectorAll("#page-admin .view").forEach((v) => v.classList.remove("active"));
    const el = $("view-" + view);
    if (el) el.classList.add("active");
    if (view === "admin") {
        // 卡片墙（四期 D1）：纯入口，不加载数据
    } else if (view === "dashboard") loadDashboard();
    else if (view === "downloads") {
        loadTree();
        loadResources();
        loadTasks();
        populateCourseSelects();
    }
}

/* ---------- 服务状态与配置横幅（8900） ---------- */

async function refreshServiceStatus() {
    const cards = [
        ["card-config", CONFIG_BASE + ENDPOINTS.health],
        ["card-tracker", TRACKER_BASE + ENDPOINTS.health],
        ["card-axiom", AXIOM_BASE + ENDPOINTS.health],
    ];
    for (const [id, url] of cards) {
        try {
            const body = await fetchJson(url);
            const name = body.service || id.replace("card-", "");
            $(id).innerHTML = `<span class="pulse"></span>${esc(name)}：在线`;
            $(id).classList.add("online");
            $(id).classList.remove("offline");
        } catch (_) {
            const name = id === "card-config" ? "配置中心" : id === "card-tracker" ? "QED-Tracker" : "Axiom-Flow";
            $(id).innerHTML = `<span class="pulse"></span>${name}：离线`;
            $(id).classList.remove("online");
            $(id).classList.add("offline");
        }
    }
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
        // LLM：任一已配置供应商可达即 OK；无配置→未配置；有配置全不可达→不可用。
        const providers = ["qwen", "glm", "deepseek"].map((p) => llm[p] || {});
        const configured = providers.some((s) => s.reason !== "未配置");
        const llmOk = configured && providers.some((s) => s.reachable);
        const llmLabel = !configured ? "未配置" : llmOk ? "OK" : "不可用";
        const llmCls = !configured ? "dim" : llmOk ? "hl" : "hl-off";
        // 数据库：reachable 为 8900 真实连接探测结果（pymysql 认证）。
        const dbLabel = !db.configured ? "未配置" : db.reachable ? "OK" : "连接失败";
        const dbCls = !db.configured ? "dim" : db.reachable ? "hl" : "hl-off";
        banner.innerHTML = `LLM评估模块连接：<span class="${llmCls}">${llmLabel}</span> / MySQL数据库连接：<span class="${dbCls}">${dbLabel}</span> / 向量数据库连接：<span class="dim">—</span>`;
        banner.classList.toggle("warn", !llmOk || !db.reachable);
    } catch (_) {
        banner.textContent = "配置中心 8900 离线，横幅不可用";
        banner.classList.add("warn");
    }
}

/* ---------- 仪表盘（总体数字 + SVG 图表，8901 离线降级） ---------- */

function donutMarkup(counts) {
    const statuses = ["candidate", "confirmed", "backup", "downloading", "downloaded", "approved", "rejected", "failed"];
    const segments = statuses
        .map((s) => ({ key: s, value: counts[s] || 0, color: STATUS_COLORS[s] }))
        .filter((s) => s.value > 0);
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (!total) return '<div class="empty-state"><div class="emoji">📊</div>暂无数据</div>';
    const R = 42, C = 2 * Math.PI * R;
    let offset = 0;
    const arcs = segments.map((s) => {
        const len = (s.value / total) * C;
        const arc = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${s.color}" stroke-width="14"
            stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;
        offset += len;
        return arc;
    }).join("");
    const legend = segments.map((s) =>
        `<span class="legend-item"><i style="background:${s.color}"></i>${STATUS_LABEL[s.key] || s.key} ${s.value}</span>`
    ).join("");
    return `<div class="donut-wrap">
        <svg viewBox="0 0 120 120" class="donut-svg">${arcs}<text x="60" y="64" text-anchor="middle" class="donut-total">${total}</text></svg>
        <div class="donut-legend">${legend}</div>
    </div>`;
}

function barsMarkup(items) {
    const rows = items.filter(([name, count]) => count > 0);
    if (!rows.length) return '<div class="empty-state"><div class="emoji">📊</div>暂无数据</div>';
    const max = Math.max(...rows.map(([, count]) => count));
    return `<div class="bars">${rows.map(([name, count]) => `
        <div class="bar-row" title="${esc(name)}">
            <span class="bar-label">${esc(name)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${max ? (count / max) * 100 : 0}%"></div></div>
            <span class="bar-num">${count}</span>
        </div>`).join("")}</div>`;
}

function courseCounts(resources) {
    const map = new Map();
    for (const item of resources) {
        const course = courseOf(item);
        if (course && course !== "—") map.set(course, (map.get(course) || 0) + 1);
    }
    const byDomain = new Map();
    for (const [course, count] of map) {
        const domain = DOMAIN_MAP[course] || "其他";
        const bucket = byDomain.get(domain) || [];
        bucket.push([course, count]);
        byDomain.set(domain, bucket);
    }
    const rows = [];
    for (const domain of DOMAIN_ORDER) {
        if (byDomain.has(domain)) rows.push([domain + "（合计）", byDomain.get(domain).reduce((s, [, c]) => s + c, 0)]);
    }
    for (const [domain, bucket] of byDomain) {
        if (!DOMAIN_ORDER.includes(domain)) rows.push([domain, bucket.reduce((s, [, c]) => s + c, 0)]);
    }
    return rows;
}

async function loadDashboard() {
    refreshConfigBanner();
    const stats = [
        ["candidate", "候选资源"],
        ["confirmed", "已确认下载"],
        ["downloaded", "已下载"],
        ["approved", "已验收"],
    ];
    const nums = {};
    let running = "—";
    let ok = true;
    try {
        const [resources, tasks] = await Promise.all([
            fetchJson(TRACKER_BASE + ENDPOINTS.resources),
            fetchJson(TRACKER_BASE + ENDPOINTS.tasks),
        ]);
        state.resources = resources;
        const counts = {};
        for (const item of resources) counts[item.status] = (counts[item.status] || 0) + 1;
        for (const [status] of stats) nums[status] = counts[status] || 0;
        running = tasks.filter((t) => t.status === "queued" || t.status === "running").length;
        $("donut-chart").innerHTML = donutMarkup(counts);
        $("course-bars").innerHTML = barsMarkup(courseCounts(resources));
        await populateCourseSelects();
    } catch (_) {
        ok = false;
        $("donut-chart").innerHTML = '<div class="empty-state"><div class="emoji">📊</div>8901 离线</div>';
        $("course-bars").innerHTML = '<div class="empty-state"><div class="emoji">📊</div>8901 离线</div>';
    }
    const cards = stats
        .map(([status, label]) => `<div class="stat-card"><div class="stat-num">${ok ? nums[status] : "—"}</div><div class="stat-label">${label}</div></div>`)
        .join("");
    const runningCard = `<div class="stat-card"><div class="stat-num">${running}</div><div class="stat-label">任务进行中</div></div>`;
    $("stat-grid").innerHTML = cards + runningCard;
}

/* ---------- 文件下载管理（领域树 + 事务面板） ---------- */

function scopeMatches(item, selection) {
    if (!selection) return true;
    if (selection.kind === "domain") return DOMAIN_MAP[courseOf(item)] === selection.id;
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
    // 四期（ARCH-004 D3）：筛选栏（领域/课程/状态）与树选择独立叠加（AND）
    const status = $("filter-status").value;
    const domain = $("filter-domain").value;
    const course = $("filter-course").value;
    const sel = state.selection;
    let items = state.resources.filter(
        (it) =>
            (!status || it.status === status) &&
            (!domain || DOMAIN_MAP[courseOf(it)] === domain) &&
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

/* ---------- 领域树（catalog targets + 资源状态计数） ---------- */

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

function countFor(courseId) {
    return state.resources.filter((r) => courseOf(r) === courseId).length;
}

function renderTree() {
    const tree = $("domain-tree");
    const byDomain = new Map();
    const courses = new Map();
    for (const t of state.catalog) {
        if (!courses.has(t.course_id)) courses.set(t.course_id, { id: t.course_id, name: t.course_name, targets: [] });
        courses.get(t.course_id).targets.push(t);
    }
    const order = [...courses.keys()].sort();
    for (const courseId of order) {
        const domain = DOMAIN_MAP[courseId] || "其他";
        if (!byDomain.has(domain)) byDomain.set(domain, []);
        byDomain.get(domain).push(courses.get(courseId));
    }
    const domainList = DOMAIN_ORDER.filter((d) => byDomain.has(d)).concat(["其他"].filter((d) => byDomain.has(d)));
    tree.innerHTML = domainList.map((domain) => {
        const domainCount = byDomain.get(domain).reduce((s, c) => s + countFor(c.id), 0);
        const coursesHtml = byDomain.get(domain).map((c) => {
            const cCount = countFor(c.id);
            const targetsHtml = c.targets.map((t) => `
                <div class="tree-node tree-target" data-kind="target" data-id="${esc(t.id)}" data-label="${esc(t.title)}">
                    <span class="tree-name">${esc(t.title)}</span>
                </div>`).join("");
            return `
                <div class="tree-node tree-course" data-kind="course" data-id="${esc(c.id)}" data-label="${esc(c.name)}">
                    <span class="tree-caret">▾</span><span class="tree-name">${esc(c.name)}</span>
                    <span class="tree-badge">${cCount ? cCount + " 资源" : ""}</span>
                    <div class="tree-children">${targetsHtml}</div>
                </div>`;
        }).join("");
        return `
            <div class="tree-node tree-domain" data-kind="domain" data-id="${esc(domain)}" data-label="${esc(domain)}">
                <span class="tree-caret">▾</span><span class="tree-name">${esc(domain)}</span>
                <span class="tree-badge">${domainCount ? domainCount + " 资源" : ""}</span>
                <div class="tree-children">${coursesHtml}</div>
            </div>`;
    }).join("");
    // 树节点点击：展开/折叠；双击或点击名称选中节点 → 面板过滤
    tree.querySelectorAll(".tree-node").forEach((node) => {
        node.addEventListener("click", (ev) => {
            const isCaret = ev.target.classList.contains("tree-caret");
            const children = node.querySelector(":scope > .tree-children");
            if (children && (isCaret || node.classList.contains("tree-course") || node.classList.contains("tree-domain"))) {
                const collapsed = node.classList.toggle("collapsed");
                if (children) children.style.display = collapsed ? "none" : "";
            } else if (node.classList.contains("tree-target") || !children) {
                selectNode(node.dataset.kind, node.dataset.id);
            }
        });
    });
}

function selectNode(kind, id) {
    state.selection = { kind, id };
    document.querySelectorAll(".tree-node").forEach((n) => n.classList.remove("selected"));
    const node = document.querySelector(`.tree-node[data-kind="${kind}"][data-id="${CSS.escape(id)}"]`);
    if (node) node.classList.add("selected");
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
        <div class="card-actions">
            <span class="status-badge status-${esc(it.status || "unknown")}">${esc(STATUS_LABEL[it.status] || it.status)}</span>
            ${actions.join("")}
            <button class="btn ghost" data-act="detail" data-kind="resource" data-id="${esc(it.resource_id)}">详情</button>
        </div>
    </div>`;
}

async function triggerEvaluate() {
    // 四期：评估范围跟随「课程」筛选下拉（未选 = 全目录）
    const courseId = $("filter-course").value || null;
    const btn = $("btn-evaluate");
    btn.disabled = true;
    btn.textContent = "任务创建中…";
    try {
        const task = await fetchJson(TRACKER_BASE + ENDPOINTS.evaluate, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(courseId ? { course_id: courseId } : {}),
        });
        alert("评估任务已创建：" + task.task_id);
        loadTasks();
    } catch (err) {
        alert("触发评估失败：" + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "触发评估";
    }
}

/* ---------- 任务中心（8901 /tasks，1s 轮询） ---------- */

function taskCard(t) {
    const progress = Number(t.progress) || 0;
    const result = JSON.stringify(t.result ?? t.error ?? "");
    return `<div class="card task-card">
        <div class="card-head">
            <div class="task-id">${esc(t.task_id)}</div>
            <span class="status-badge status-${esc((t.status || "unknown").toLowerCase())}">${esc(t.status ?? "—")}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.max(0, progress))}%"></div></div>
        <div class="task-meta">
            <span>类型：${esc(t.type ?? "—")}</span>
            <span>进度：${progress}%</span>
        </div>
        ${result !== '""' ? `<div class="verdict">${esc(result.length > 120 ? result.slice(0, 120) + "…" : result)}</div>` : ""}
        <div class="card-actions">
            <button class="btn ghost" data-act="detail" data-kind="task" data-id="${esc(t.task_id)}">详情</button>
        </div>
    </div>`;
}

function renderTasks() {
    // 四期（ARCH-004 D3）：任务按 状态 / 类型 / 课程 前端过滤
    const fStatus = $("filter-task-status").value;
    const fType = $("filter-task-type").value;
    const fCourse = $("filter-task-course").value;
    let items = state.tasks;
    if (fStatus) items = items.filter((t) => (t.status || "").toLowerCase() === fStatus);
    if (fType) items = items.filter((t) => (t.type || "") === fType);
    if (fCourse) items = items.filter((t) => (t.params && t.params.course_id) === fCourse);
    const box = $("task-list");
    if (!items.length) {
        box.innerHTML = '<div class="empty-state"><div class="emoji">🗂️</div>（无任务记录）</div>';
        return;
    }
    box.innerHTML = `<div class="card-grid">${items.map(taskCard).join("")}</div>`;
}

async function loadTasks() {
    const box = $("task-list");
    try {
        state.tasks = await fetchJson(TRACKER_BASE + ENDPOINTS.tasks);
    } catch (err) {
        box.textContent = "QED-Tracker 8901 离线：" + err.message;
        return;
    }
    renderTasks();
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
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.resources + "/" + encodeURIComponent(id) + ENDPOINTS.confirm, { method: "POST" });
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
        const res = await fetchJson(TRACKER_BASE + ENDPOINTS.resources + "/" + encodeURIComponent(id) + ENDPOINTS.backup, { method: "POST" });
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
        await fetchJson(TRACKER_BASE + ENDPOINTS.resources + "/" + encodeURIComponent(id) + ENDPOINTS.reject, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
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
    $("menu-toggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
    document.querySelectorAll(".sidebar .nav-item").forEach((a) => {
        a.addEventListener("click", () => $("sidebar").classList.remove("open"));
    });
    $("btn-evaluate").addEventListener("click", triggerEvaluate);
    $("btn-refresh").addEventListener("click", loadResources);
    $("btn-refresh-tree").addEventListener("click", loadTree);
    $("filter-status").addEventListener("change", renderPanel);
    $("filter-domain").addEventListener("change", renderPanel);
    $("filter-course").addEventListener("change", renderPanel);
    $("filter-task-status").addEventListener("change", renderTasks);
    $("filter-task-type").addEventListener("change", renderTasks);
    $("filter-task-course").addEventListener("change", renderTasks);
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

/* ---------- 领域树可变边框（四期 ARCH-004 D6） ----------
 * 拖拽手柄调整树宽，范围 240-560px，宽度记忆到 localStorage（键 qed-tree-w）。 */

function initTreeResizer() {
    const resizer = $("tree-resizer");
    const layout = $("download-layout");
    if (!resizer || !layout) return;
    const saved = Number(localStorage.getItem("qed-tree-w"));
    if (saved >= 240 && saved <= 560) layout.style.setProperty("--tree-w", saved + "px");
    resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const side = $("download-side");
        const startW = side ? side.offsetWidth : layout.offsetWidth * 0.62;
        const onMove = (ev) => {
            const w = Math.min(560, Math.max(240, startW + (ev.clientX - startX)));
            layout.style.setProperty("--tree-w", w + "px");
        };
        const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            const side2 = $("download-side");
            localStorage.setItem("qed-tree-w", String(side2 ? Math.round(side2.offsetWidth) : 300));
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
    return { title: t.title, courseId: t.course_id, courseName: t.course_name || t.course_id, domain: DOMAIN_MAP[t.course_id] || "其他" };
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

/* ---------- 筛选下拉（四期：领域 / 课程 / 任务课程，来自 catalog targets） ---------- */

async function populateCourseSelects() {
    const domainSel = $("filter-domain");
    const courseSel = $("filter-course");
    const taskCourseSel = $("filter-task-course");
    if (!domainSel || !courseSel || !taskCourseSel) return;
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
    // 领域下拉：严格三领域
    domainSel.innerHTML = '<option value="">全部领域</option>'
        + DOMAIN_ORDER.filter((d) => courseList.some(([id]) => DOMAIN_MAP[id] === d))
            .map((d) => `<option value="${esc(d)}">${esc(d)}</option>`)
            .join("");
    // 课程下拉：按领域分组
    courseSel.innerHTML = '<option value="">全部课程</option>'
        + DOMAIN_ORDER.map((d) => {
            const group = courseList.filter(([id]) => DOMAIN_MAP[id] === d);
            if (!group.length) return "";
            return `<optgroup label="${esc(d)}">${group.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("")}</optgroup>`;
        }).join("")
        + courseList.filter(([id]) => !DOMAIN_ORDER.some((d) => DOMAIN_MAP[id] === d))
            .map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("");
    // 任务课程筛选
    taskCourseSel.innerHTML = '<option value="">课程</option>'
        + courseList.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("");
}

/* ---------- 启动 ---------- */

async function init() {
    bindEvents();
    startTaskPolling();
    refreshServiceStatus();
    setInterval(refreshServiceStatus, 5000);
    route();
    // 主体界面兜底：即使 8901 离线也给出提示（已由各视图处理）
}

document.addEventListener("DOMContentLoaded", init);
