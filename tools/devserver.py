#!/usr/bin/env python3
"""سيرفر تطوير محلي — يقدّم ملفات المشروع ويمرّر /api/* لباك Railway.
   السبب: CORS عند Railway مقصور على octashares.com، فالنموذج المحلي
   من غير proxy بيرجع 401/بلا CORS والشارت بيفضل فاضي.
   التشغيل:  python3 tools/devserver.py [port]
"""
import http.server, socketserver, urllib.request, urllib.error, sys, os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://octa-prices-production-4ccb.up.railway.app"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8811

MIME = {
    ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
    ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2", ".map": "application/json",
}


class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _proxy(self):
        path = self.path
        if os.environ.get("DEVLOG"):
            print(f"[proxy] {self.command} {path}", flush=True)
        url = API + path
        try:
            req = urllib.request.Request(url, method=self.command)
            for h in ("X-OCTA-Client", "Authorization", "X-Requested-With", "Content-Type"):
                v = self.headers.get(h)
                if v:
                    req.add_header(h, v)
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
                self.send_response(r.status)
                ct = r.headers.get("Content-Type", "application/json")
                self.send_header("Content-Type", ct)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(body)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", e.headers.get("Content-Type", "application/json"))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            body = json.dumps({"error": str(e)[:200]}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        p = self.path.split("?")[0]
        if p in ("/", "/index.html"):
            p = "/index.html"
        if p.endswith("/"):
            p += "index.html"
        fp = os.path.normpath(os.path.join(ROOT, p.lstrip("/")))
        if not fp.startswith(ROOT) or not os.path.isfile(fp):
            # امتداد-less زي /assets/chart
            alt = fp + ".html"
            if os.path.isfile(alt):
                fp = alt
            else:
                self.send_response(404)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                body = b"404"
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        data = open(fp, "rb").read()
        ext = os.path.splitext(fp)[1].lower()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    do_HEAD = do_GET
    do_POST = do_GET


class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    print(f"dev server on http://127.0.0.1:{PORT}  (root={ROOT})")
    S(("127.0.0.1", PORT), H).serve_forever()
