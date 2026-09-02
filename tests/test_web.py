"""
模块职责：守护 8903 QED-Engine 前端（web-ui React 重构版）与静态服务：
- serve_web.py 静态服务契约（存在/缓存头/端口与目录/并发/health 端点）
- web-ui 源码契约（API 基址 8900、零 8901/8902 直连、hash 路由清单、关键端点 token）
- 旧原生三文件版 web/ 已于 2026-08-17 退役（前端重构切换，frontend-react-refactor.md）。
设计关联（DesignRef）：docs/design/web-frontend.md
实现状态：Current
被测代码：web-ui/src/、scripts/serve_web.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "web-ui" / "src"
SERVE_WEB = ROOT / "scripts" / "serve_web.py"
ENV_PROD = ROOT / "web-ui" / ".env.production"


# --- serve_web.py 静态服务契约（二十一期缓存治理 + 重构切换） ---


def test_serve_web_exists():
    """serve_web.py 应存在（qed_web_service.py 生命周期脚本调用的实际服务进程）。"""
    assert SERVE_WEB.is_file(), "scripts/serve_web.py 不存在（8903 前端服务依赖它）"


def test_serve_web_no_store_cache_header():
    """前端静态服务必须发送 Cache-Control: no-store：http.server 默认无缓存头，
    浏览器启发式缓存会导致改版后仍加载旧产物（本仓库历史踩坑）。"""
    src = SERVE_WEB.read_text(encoding="utf-8")
    assert "no-store" in src, "serve_web.py 必须输出 Cache-Control: no-store"


def test_serve_web_port_and_directory():
    """端口固定 8903，目录解析到仓库 web-ui/dist（相对脚本位置 parent.parent / web-ui / dist）。

    2026-08-17 前端重构切换：serve_web.py 由旧 web/ 切到 web-ui/dist/（React 构建产物）。
    """
    src = SERVE_WEB.read_text(encoding="utf-8")
    assert "8903" in src, "serve_web.py 应监听 8903"
    assert '"web-ui"' in src or "'web-ui'" in src, "serve_web.py 应指向仓库 web-ui/dist 目录"
    assert '"dist"' in src or "'dist'" in src, "serve_web.py 应指向构建产物 dist/"


def test_serve_web_threaded():
    """ThreadingHTTPServer：并发请求（多标签/多资源同时加载）不阻塞。"""
    src = SERVE_WEB.read_text(encoding="utf-8")
    assert "ThreadingHTTPServer" in src, "serve_web.py 应使用 ThreadingHTTPServer"


def test_serve_web_health_endpoint():
    """serve_web.py 内置 /api/v1/health 健康探测（8900 服务注册表 `web` 单元端口探测目标）。

    修复：web 单元注册后 _probe_http(8903) 若无该端点将恒 404 判离线，控制台无法识别在线态。
    """
    src = SERVE_WEB.read_text(encoding="utf-8")
    assert '"status": "ok"' in src, "serve_web.py 健康端点应返回 status ok"
    assert "do_GET" in src, "serve_web.py 应重写 do_GET 路由健康端点"
    assert "/api/v1/health" in src, "serve_web.py 应处理 /api/v1/health"


# --- 生产构建 API 基址（8903 静态服务直连 8900，ADR 0007 唯一入口） ---


def test_production_env_points_to_8900():
    """生产构建必须显式设置 VITE_API_BASE=http://127.0.0.1:8900/api/v1：
    dev 模式经 vite proxy（/api → 8900）同源可用；生产无代理，若用相对 /api/v1
    会打到 8903 自身导致全部 404（2026-08-17 前端切换缺口修复）。
    """
    assert ENV_PROD.is_file(), "web-ui/.env.production 缺失（生产构建 API 基址）"
    content = ENV_PROD.read_text(encoding="utf-8")
    assert "VITE_API_BASE" in content, ".env.production 应声明 VITE_API_BASE"
    assert "127.0.0.1:8900" in content, "VITE_API_BASE 应指向 8900（ADR 0007 唯一入口）"


def test_client_api_base_uses_env():
    """api/client.ts 的 API_BASE 必须来自 VITE_API_BASE（生产注入）或 /api/v1（dev proxy）。"""
    src = (SRC / "api" / "client.ts").read_text(encoding="utf-8")
    assert "VITE_API_BASE" in src, "client.ts 应从 VITE_API_BASE 读取 API_BASE"
    assert "API_BASE" in src, "client.ts 应导出 API_BASE 常量"


# --- 零 8901/8902 直连（ADR 0007 前端唯一入口 8900） ---


def test_api_modules_no_direct_subproject_ports():
    """web-ui 的 api 封装不得直连 8901/8902（浏览器只连 8900，内部由 8900 适配）。

    守护：api/ 目录下不得出现 `http://...:8901/8902` 形式的直连 URL（注释中的
    「8902 离线 → 503」等契约说明文字不算直连）。
    """
    forbidden = ("http://127.0.0.1:8901", "http://localhost:8901", "http://127.0.0.1:8902", "http://localhost:8902")
    for path in (SRC / "api").glob("*.ts"):
        content = path.read_text(encoding="utf-8")
        for url in forbidden:
            assert url not in content, f"{path.name} 不应出现直连 URL：{url}（ADR 0007）"


# --- hash 路由清单（frontend-react-refactor 四界面 + 学习中心） ---


def test_hash_routes_declared():
    """App.tsx 应声明 hash 路由：主界面 / 学习中心 / 管理台嵌套（控制台/仪表盘/下载/文档解析管理）。

    2026-08-18：原始文档对照(compare)路由删除，能力并入文档解析管理（D7 裁决）。
    """
    src = (SRC / "App.tsx").read_text(encoding="utf-8")
    for route in (
        'path="/"',
        'path="/knowledge"',
        'path="/admin"',
        'path="dashboard"',
        'path="downloads"',
        'path="parsing"',
    ):
        assert route in src, f"App.tsx 缺少路由：{route}"
    assert 'path="compare"' not in src, "App.tsx 不应再声明 compare 路由（已并入文档解析管理）"
    assert "HashRouter" in src, "App.tsx 应使用 HashRouter（8903 静态服务无服务端路由）"


def test_admin_menu_renamed_parsing():
    """管理台左侧导航：解析进度改名「文档解析管理」，原始文档对照菜单删除。"""
    src = (SRC / "components" / "AdminLayout.tsx").read_text(encoding="utf-8")
    assert "label: '文档解析管理'" in src, "AdminLayout 应展示「文档解析管理」菜单"
    assert "label: '解析进度'" not in src, "AdminLayout 不应残留旧菜单名「解析进度」"
    assert "label: '原始文档对照'" not in src, "AdminLayout 不应残留「原始文档对照」菜单"
    assert "/admin/compare" not in src, "AdminLayout 不应残留 compare 菜单项"


# --- 关键契约端点 token（防契约漂移） ---


def test_api_endpoint_tokens_present():
    """web-ui api 封装应覆盖关键契约端点（8900 数据域/服务域/监控诊断）。

    契约来源：docs/architecture/api-contracts.md、service-control.md。
    """
    endpoint_tokens = {
        "services.ts": ("/services", "/self-restart", "/config/database"),
        "tracker.ts": ("/catalogs/", "/knowledge", "/books"),
        "axiom.ts": ("/books", "/parse-jobs", "/books/sync", "/blocks/", "/review"),
    }
    for filename, tokens in endpoint_tokens.items():
        path = SRC / "api" / filename
        assert path.is_file(), f"api/{filename} 缺失"
        content = path.read_text(encoding="utf-8")
        for token in tokens:
            assert token in content, f"api/{filename} 缺少契约端点：{token}"


def test_dashboard_course_completion_semantics():
    """仪表盘课程完成度口径（用户裁决 2026-08-17）：≥2 套教程完成验收（书籍全部 verified）
    计为课程完成下载；分母 = catalog targets 课程数。"""
    src = (SRC / "stores" / "dashboard.ts").read_text(encoding="utf-8")
    assert "buildCourseCompletion" in src, "dashboard store 应实现 buildCourseCompletion"
    assert ">= 2" in src or ">=2" in src, "课程完成判定应含 ≥2 套教程"
    assert "verified" in src, "完成验收判定应基于书籍 verified"


def test_console_message_feedback():
    """控制台启停/重启操作统一 message 提示（用户裁决 2026-08-17：只提示收敛结果，
    失败统一用 message）。"""
    src = (SRC / "pages" / "Console.tsx").read_text(encoding="utf-8")
    assert "App.useApp()" in src, "Console 应使用 App.useApp().message（主题上下文）"
    assert "message.success" in src, "成功提示用 message.success"
    assert "message.warning" in src, "失败/未生效提示用 message.warning"
