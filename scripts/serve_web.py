"""QED-Engine 前端静态服务（8903）：python -m http.server 的 no-cache 版。

背景：python -m http.server 不发送 Cache-Control/ETag，浏览器对 app.js/style.css
做启发式缓存（freshness ≈ 距 Last-Modified 的 10%），改版后硬刷新前仍加载旧文件，
多次造成「改版不可见」。本脚本在响应上强制 Cache-Control: no-store。

用法（start-all.ps1 前端启动等价命令）：
    python scripts/serve_web.py

设计关联（DesignRef）：docs/design/web-frontend.md
实现状态：Current
"""

import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8903
WEB_DIR = str(Path(__file__).resolve().parent.parent / "web")


class NoStoreHandler(SimpleHTTPRequestHandler):
    """覆盖 end_headers：所有响应（含 304/错误页）统一追加 Cache-Control: no-store。"""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    handler = functools.partial(NoStoreHandler, directory=WEB_DIR)
    with ThreadingHTTPServer(("0.0.0.0", PORT), handler) as server:
        print(f"QED-Engine frontend on http://127.0.0.1:{PORT} (dir: {WEB_DIR}, no-store)")
        server.serve_forever()


if __name__ == "__main__":
    main()
