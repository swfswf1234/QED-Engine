"""QED-Engine 前端静态服务（8903）：python -m http.server 的 no-cache 版。

背景：python -m http.server 不发送 Cache-Control/ETag，浏览器对 app.js/style.css
做启发式缓存（freshness ≈ 距 Last-Modified 的 10%），改版后硬刷新前仍加载旧文件，
多次造成「改版不可见」。本脚本在响应上强制 Cache-Control: no-store。

额外提供 /api/v1/health 健康探测端点（8900 服务注册表 `web` 单元端口探测目标，
service-hosting.md）：静态目录不存在的路径统一回退 GET 处理前先命中 health。

用法（qed_web_service.py 生命周期脚本调用的实际服务进程）：
    python scripts/serve_web.py

设计关联（DesignRef）：docs/architecture/frontend-architecture.md
实现状态：Current
"""

import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8903
WEB_DIR = str(Path(__file__).resolve().parent.parent / "web-ui" / "dist")


class NoStoreHandler(SimpleHTTPRequestHandler):
    """覆盖 end_headers：所有响应（含 304/错误页）统一追加 Cache-Control: no-store。"""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        """健康探测端点：/api/v1/health 返回 200 JSON（8900 `web` 单元探测目标）。"""
        if self.path == "/api/v1/health":
            body = json.dumps({"status": "ok", "service": "qed-engine-web"}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def main() -> None:
    handler = functools.partial(NoStoreHandler, directory=WEB_DIR)
    with ThreadingHTTPServer(("0.0.0.0", PORT), handler) as server:
        print(f"QED-Engine frontend on http://127.0.0.1:{PORT} (dir: {WEB_DIR}, no-store)")
        server.serve_forever()


if __name__ == "__main__":
    main()
