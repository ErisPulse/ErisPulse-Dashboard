"""开发用本地服务：带 no-cache 头，避免 Chromium 启发式缓存吞掉前端更新"""
import functools
import http.server
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    http.server.HTTPServer(
        ("127.0.0.1", 8127), functools.partial(NoCacheHandler, directory=".")
    ).serve_forever()
