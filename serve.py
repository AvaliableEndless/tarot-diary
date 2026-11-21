#!/usr/bin/env python3
"""本地预览服务器：强制不缓存，改代码后刷新即生效。"""
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

class NoCacheHandler(SimpleHTTPRequestHandler):
    # 补齐图片 MIME，否则浏览器不认 webp
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.webp': 'image/webp',
        '.jpg':  'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png':  'image/png',
        '.svg':  'image/svg+xml',
        '.woff2':'font/woff2',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_head(self):
        # 去掉 Last-Modified / ETag，避免 304
        path = super().send_head()
        return path

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

if __name__ == '__main__':
    print(f"serving on http://0.0.0.0:{PORT}  (no-cache)")
    ThreadingHTTPServer(('0.0.0.0', PORT), NoCacheHandler).serve_forever()
