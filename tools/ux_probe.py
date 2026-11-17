#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🐙 فاحص الواجهة الحقيقي — الجولة ١٨ · المرحلة ٥ (UX)
=====================================================
📌 الفكرة: «الصفحة موجودة» ≠ «المستخدم يلاقيها».
   ⇒ بنفتح **كل** مسار في `SPA_ROUTES` بمتصفح حقيقي (Playwright/Chromium)
     ونتأكد إن:
       ① الصفحة الصح اتفتحت (مش صفحة تانية)
       ② مافيش استثناء JS (pageerror)
       ③ مافيش تمدد أفقي على 360/390/768
       ④ مافيش أي اتصال خارج localhost (حماية الإنتاج)

⛔ **حماية الإنتاج**: أي طلب لغير 127.0.0.1/localhost بيتعمله abort
   ويتسجّل كـ«مخالفة» ⇒ الفحص **مايلمسش** الإنتاج ولا أي مورد خارجي.
⛔ مافيش شبكة: السيرفر الداخلي بيردّ 503 على /api/* (زي حالة «الـAPI واقف»
   بإجابة صريحة — fail-closed) ⇒ نقيس **تدهور الخدمة** مش الاتصال.

📌 التشغيل:
   python3 tools/ux_probe.py --out /tmp/ux.json
   python3 tools/ux_probe.py --base-url http://127.0.0.1:8099 --out /tmp/ux.json

📌 المخرجات: JSON (للآلة) + Markdown (للقرار).
"""

import argparse
import json
import os
import re
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    print("⛔ playwright مش مثبّت: pip install playwright", file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent

# ⛔ مسارات بتتخدم index.html (SPA) — نفس منطق worker.js
SPECIAL_PAGES = {"dashPage", "intelPage", "auditPage", "stockPage"}

ALLOWED_HOSTS = {"127.0.0.1", "localhost", "::1", "", "octa.local"}


# ══════════════════════════════════════════════════════════════
#  📖 قراءة التعاقدات من الكود (مصدر الحقيقة = الملفات)
# ══════════════════════════════════════════════════════════════
def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


def parse_spa_routes():
    """SPA_ROUTES من worker.js."""
    s = read("worker.js")
    m = re.search(r"const SPA_ROUTES\s*=\s*\[([^\]]+)\]", s)
    if not m:
        raise SystemExit("⛔ مالقيتش SPA_ROUTES في worker.js")
    return [x.strip().strip("'\"") for x in m.group(1).split(",") if x.strip().strip("'\"")]


def parse_tool_pages():
    s = read("assets/js/octa-core.js")
    m = re.search(r"const TOOL_PAGES\s*=\s*\[([^\]]+)\]", s)
    return [x.strip().strip("'\"") for x in m.group(1).split(",") if x.strip().strip("'\"")]


def parse_alias():
    s = read("assets/js/octa-core.js")
    m = re.search(r"const OCTA_PATH_ALIAS\s*=\s*\{([\s\S]*?)\n\};", s)
    if not m:
        return {}
    out = {}
    for mm in re.finditer(r"'([^']+)'\s*:\s*'([^']+)'", m.group(1)):
        out[mm.group(1)] = mm.group(2)
    return out


def container_of(page_id):
    if page_id == "dash":
        return "dashPage"
    return "page-" + page_id


# ══════════════════════════════════════════════════════════════
#  🖥️ سيرفر ملفات ثابت — يحاكي سلوك worker.js بدقة
# ══════════════════════════════════════════════════════════════
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    routes = set()
    mode = "preview"          # preview = fail-closed (زي المعاينة المنشورة)

    def log_message(self, *a):  # silence
        pass

    def _send(self, code, body=b"", ctype="text/plain; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        # ⛔ الـAPI واقف ⇒ 503 صريح (fail-closed) — مش 200 كدب
        if path.startswith("/api/"):
            return self._send(503, json.dumps(
                {"ok": False, "error": "api_unreachable",
                 "why": "ux_probe_offline"}).encode(), "application/json")
        if path == "/" or path == "/index.html":
            return self._file("index.html")
        if path in self.routes:
            return self._file("index.html")
        if path.endswith(".html"):
            return self._file(path.lstrip("/"))
        # ملفات ثابتة
        rel = path.lstrip("/")
        for cand in (rel, "assets/" + rel):
            fp = ROOT / cand
            if fp.is_file():
                ctype = ("text/html; charset=utf-8" if fp.suffix == ".html"
                         else "text/css; charset=utf-8" if fp.suffix == ".css"
                         else "application/javascript; charset=utf-8" if fp.suffix == ".js"
                         else "application/json" if fp.suffix == ".json"
                         else "image/png" if fp.suffix == ".png"
                         else "application/octet-stream")
                return self._send(200, fp.read_bytes(), ctype)
        return self._send(404, b"not found")

    def _file(self, rel):
        fp = ROOT / rel
        if not fp.is_file():
            return self._send(404, b"not found")
        body = fp.read_bytes()
        if fp.suffix == ".html":
            body = with_site_origin(body.decode("utf-8"), self.mode).encode("utf-8")
        return self._send(200, body, "text/html; charset=utf-8")


PROD_URL_RE = re.compile(r"https://octa-prices-production-4ccb\.up\.railway\.app")


def with_site_origin(html, mode):
    """⛔ نفس منطق `withSiteOrigin` في worker.js — بالظبط.

    mode=preview ⇒ المعاينة المنشورة: `OCTA_FAIL_CLOSED=on`
      · حقن `window.OCTA_FAIL_CLOSED=1`  ⇒ القائمة الفاضية (ممنوع الإنتاج)
      · استبدال رابط الإنتاج بـ `https://blocked.invalid` ⇒ fail-closed بالمضيف
    mode=source ⇒ من غير حقن (زي ما الـworker بيقدّمه من غير المتغيّر)
    """
    if mode != "preview":
        return html
    if "window.OCTA_FAIL_CLOSED=1" not in html:
        tag = "<script>window.OCTA_FAIL_CLOSED=1;</script>"
        html = html.replace("</head>", tag + "</head>") if "</head>" in html \
            else (tag + html)
    html = PROD_URL_RE.sub("https://blocked.invalid", html)
    return html


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


# ══════════════════════════════════════════════════════════════
#  🔬 الفحص
# ══════════════════════════════════════════════════════════════
JS_VISIBLE = """
() => {
  const out = [];
  const ids = __IDS__;
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const vis = cs.display !== 'none' && cs.visibility !== 'hidden'
                && parseFloat(cs.opacity || '1') > 0.01
                && (r.width > 0 || r.height > 0);
    if (vis) out.push(id);
  }
  return out;
}
"""

JS_OVERFLOW = """
() => {
  const de = document.documentElement;
  return {
    scrollW: de.scrollWidth, innerW: window.innerWidth,
    bodyScrollW: document.body ? document.body.scrollWidth : 0
  };
}
"""


# 🛡️ الجولة ٢٠ (R20 · المرحلة ٥) — تدقيق الوصولية + السرعة ⭐
JS_A11Y = r"""(() => {
  const out = { lang: false, title: '', imgsMissingAlt: 0, inputsNoLabel: 0,
                headingJumps: [], landmarks: [], namelessButtons: 0,
                focusVisible: false };
  try {
    out.lang = !!document.documentElement.getAttribute('lang');
    out.title = (document.title || '').trim();
    document.querySelectorAll('img').forEach((im) => {
      if (!im.hasAttribute('alt')) out.imgsMissingAlt++;
    });
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      const hasLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
        || (el.id && document.querySelector('label[for="' + el.id + '"]'))
        || el.closest('label');
      if (!hasLabel) out.inputsNoLabel++;
    });
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(h => h.offsetParent !== null || h.getClientRects().length);
    let prev = 0;
    hs.forEach(h => {
      const lvl = parseInt(h.tagName.slice(1), 10) || 0;
      if (prev && lvl > prev + 1) out.headingJumps.push(prev + '-' + lvl);
      prev = lvl;
    });
    out.landmarks = ['main','nav','header','footer','aside','[role="main"]','[role="navigation"]']
      .filter(s => document.querySelector(s));
    document.querySelectorAll('button, a[href]').forEach((b) => {
      const name = (b.innerText || '').trim() || b.getAttribute('aria-label')
        || b.getAttribute('title') || (b.querySelector('img') || {}).alt;
      if (!name) out.namelessButtons++;
    });
    let css = '';
    for (const ss of document.styleSheets) {
      let rules; try { rules = ss.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        if (r.selectorText && r.selectorText.indexOf(':focus-visible') > -1) css += r.cssText;
      }
    }
    out.focusVisible = css.length > 0;
  } catch (e) { out.error = String(e).slice(0, 120); }
  return out;
})()"""

JS_SPEED = r"""(() => {
  try {
    const t = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource') || [];
    return {
      dcl: Math.round(t.domContentLoadedEventEnd || 0),
      load: Math.round(t.loadEventEnd || 0),
      resources: res.length,
      bytes: res.reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0)
    };
  } catch (e) { return { error: String(e).slice(0, 120) }; }
})()"""


def find_wide_elements(limit=6):
    """أعرض العناصر اللي بتعدّي عرض الشاشة — سبب التمدد."""
    return """
() => {
  const w = window.innerWidth;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > w + 4) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') return;
      bad.push({tag: el.tagName.toLowerCase(),
                id: el.id || '',
                cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 60),
                right: Math.round(r.right), width: Math.round(r.width)});
    }
  });
  return bad.slice(0, __LIMIT__);
}
""".replace("__LIMIT__", str(limit))


def run_probe(base_url, routes, widths, out_json, headed=False):
    all_ids = sorted(set(
        [container_of(p) for p in parse_tool_pages()] +
        ["homeHidden", "gate", "armView", "stockPage", "intelPage", "auditPage",
         "dashPage", "decideModal", "modalOverlay"]))

    results = []
    egress = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get(
                "OCTA_CHROMIUM",
                "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"),
            args=["--no-sandbox", "--disable-dev-shm-usage",
                  "--host-resolver-rules=MAP octa.local 127.0.0.1"],
            headless=not headed)

        for width in widths:
            ctx = browser.new_context(
                viewport={"width": width, "height": 844},
                device_scale_factor=2, is_mobile=(width < 768),
                locale="ar-EG")
            # 🔑 دخول مُصطنع: التوكن في localStorage (البوابة بتقرأه)
            ctx.add_init_script(
                "try{localStorage.setItem('octa_token','ux-probe-local');"
                "localStorage.setItem('octa_user','{\"email\":\"probe@local.test\"}');}catch(e){}")

            # ⛔ حارس الخروج: مافيش طلب خارج localhost
            def guard(route, request):
                try:
                    host = request.url.split("//")[-1].split("/")[0].split(":")[0]
                except Exception:
                    host = "?"
                if host in ALLOWED_HOSTS or request.url.startswith("data:"):
                    route.continue_()
                else:
                    egress.append({"width": width, "url": request.url})
                    route.abort()
            ctx.route("**/*", guard)

            for route in routes:
                rec = {"route": route, "width": width, "errors": [], "api_offline": 0}
                page = ctx.new_page()
                page.on("pageerror", lambda e, r=rec: r["errors"].append(
                    {"kind": "pageerror", "msg": str(e)[:300]}))
                page.on("console", lambda m, r=rec: _console(m, r))
                try:
                    resp = page.goto(base_url + route, wait_until="domcontentloaded",
                                     timeout=30000)
                    rec["http"] = resp.status if resp else None
                    page.wait_for_timeout(1400)
                    vis = page.evaluate(JS_VISIBLE.replace("__IDS__", json.dumps(all_ids)))
                    rec["visible"] = vis
                    rec["overflow"] = page.evaluate(JS_OVERFLOW)
                    rec["wide"] = page.evaluate(find_wide_elements())
                    rec["text_len"] = len(page.inner_text("body") or "")
                    rec["title"] = page.title()
                    # 🛡️ الجولة ٢٠ — الوصولية + السرعة ⭐
                    try:
                        rec["a11y"] = page.evaluate(JS_A11Y)
                    except Exception as e:
                        rec["a11y"] = {"error": str(e)[:120]}
                    try:
                        rec["speed"] = page.evaluate(JS_SPEED)
                    except Exception as e:
                        rec["speed"] = {"error": str(e)[:120]}
                except Exception as e:
                    rec["errors"].append({"kind": "probe", "msg": str(e)[:300]})
                finally:
                    page.close()
                results.append(rec)

            # ── الصفحة العامة (زائر من غير توكن) ──
            ctx2 = browser.new_context(
                viewport={"width": width, "height": 844}, is_mobile=(width < 768),
                locale="ar-EG")
            ctx2.route("**/*", guard)
            pg = ctx2.new_page()
            pub = {"route": "/", "width": width, "kind": "public", "errors": []}
            pg.on("pageerror", lambda e, r=pub: r["errors"].append(
                {"kind": "pageerror", "msg": str(e)[:300]}))
            pg.on("console", lambda m, r=pub: _console(m, r))
            try:
                resp = pg.goto(base_url + "/", wait_until="domcontentloaded", timeout=30000)
                pub["http"] = resp.status if resp else None
                pg.wait_for_timeout(1200)
                pub["visible"] = pg.evaluate(JS_VISIBLE.replace("__IDS__", json.dumps(all_ids)))
                pub["overflow"] = pg.evaluate(JS_OVERFLOW)
                pub["text_len"] = len(pg.inner_text("body") or "")
                pub["title"] = pg.title()
            except Exception as e:
                pub["errors"].append({"kind": "probe", "msg": str(e)[:300]})
            pg.close()
            ctx2.close()
            results.append(pub)
            ctx.close()
        browser.close()

    payload = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "base_url": base_url,
        "widths": widths,
        "routes": routes,
        "results": results,
        "egress_violations": egress,
    }
    Path(out_json).write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                              encoding="utf-8")
    return payload


def _console(m, rec):
    txt = (m.text or "")[:250]
    if m.type == "error":
        # ⛔ الـAPI واقف بإجابة 503 ⇒ ده متوقّع مش عيب
        if ("503" in txt or "Failed to load resource" in txt
                or "api_unreachable" in txt
                or "report-only Content Security Policy" in txt):
            rec["api_offline"] = rec.get("api_offline", 0) + 1
            return
        rec["errors"].append({"kind": "console", "msg": txt})
    elif m.type == "warning" and ("Uncaught" in txt or "TypeError" in txt):
        rec["errors"].append({"kind": "warn", "msg": txt})


# ══════════════════════════════════════════════════════════════
#  📊 التقرير
# ══════════════════════════════════════════════════════════════
# ⛔ تحويلات موثّقة في الكود نفسه (مش تخمين):
#   'best' ⇒ صفحة مستقلة بقت **تبويب** جوّه صفحة الفلاتر
#   (octa-filters.js · fzBestInit: «بنوديه للصفحة الصح والتبويب الصح»)
LEGACY_REDIRECT = {"best": "filter"}


def expected_container(route):
    p = route.strip("/")
    alias = parse_alias()
    pid = alias.get(p, p)
    pid = LEGACY_REDIRECT.get(pid, pid)
    return pid, container_of(pid)


def summarize(payload):
    alias = parse_alias()
    tool_pages = parse_tool_pages()
    routes = payload["routes"]
    widths = payload["widths"]
    by_key = {(r["route"], r["width"]): r for r in payload["results"]}

    rows = []
    defects = []
    for route in routes:
        pid, want = expected_container(route)
        for w in widths:
            r = by_key.get((route, w))
            if not r:
                continue
            vis = r.get("visible") or []
            ok_page = want in vis
            ov = r.get("overflow") or {}
            over = (ov.get("scrollW", 0) or 0) > (ov.get("innerW", 0) or 0) + 4
            errs = [e for e in r.get("errors", []) if e.get("kind") != "probe"]
            row = {"route": route, "width": w, "want": want, "got": vis,
                   "page_ok": ok_page, "overflow": over,
                   "overflow_px": (ov.get("scrollW", 0) or 0) - (ov.get("innerW", 0) or 0),
                   "errors": errs, "api_offline": r.get("api_offline", 0),
                   "text_len": r.get("text_len", 0),
                   "a11y": r.get("a11y") or {}, "speed": r.get("speed") or {}}
            rows.append(row)
            # 🛡️ الجولة ٢٠ — تدقيق الوصولية ⭐ (لكل صفحة/عرض) ⭐
            _a = row["a11y"]
            if _a:
                if not _a.get("lang"):
                    defects.append(("a11y-lang", route, w, "مفيش lang على <html>"))
                if not _a.get("title"):
                    defects.append(("a11y-title", route, w, "<title> فاضي"))
                if _a.get("imgsMissingAlt"):
                    defects.append(("a11y-alt", route, w,
                                    "%d صورة من غير alt" % _a["imgsMissingAlt"]))
                if _a.get("inputsNoLabel"):
                    defects.append(("a11y-label", route, w,
                                    "%d حقل من غير label" % _a["inputsNoLabel"]))
                if _a.get("headingJumps"):
                    defects.append(("a11y-heading", route, w,
                                    "قفز في العناوين: %s" % _a["headingJumps"][:3]))
                if not _a.get("landmarks"):
                    defects.append(("a11y-landmark", route, w, "مافيش landmark"))
                if _a.get("namelessButtons"):
                    defects.append(("a11y-name", route, w,
                                    "%d زر/رابط من غير اسم" % _a["namelessButtons"]))
                if not _a.get("focusVisible"):
                    defects.append(("a11y-focus", route, w,
                                    "مافيش :focus-visible في CSS"))
            if not ok_page:
                defects.append(("wrong-page", route, w, f"{want} مش ظاهرة (ظهر: {vis})"))
            if over:
                defects.append(("overflow", route, w,
                                f"تمدد {row['overflow_px']}px — {r.get('wide')[:3]}"))
            for e in errs:
                defects.append(("js-error", route, w, e.get("msg", "")[:200]))
    return rows, defects, alias, tool_pages


def render_markdown(payload):
    rows, defects, alias, tool_pages = summarize(payload)
    L = []
    L.append("# 🐙 تقرير المرحلة ٥ (UX) — الجولة ١٨")
    L.append("")
    L.append(f"> التوليد: {payload['generated_at']} · القاعدة: `{payload['base_url']}`")
    L.append(f"> المقاسات: {', '.join(str(w) for w in payload['widths'])} · المسارات: {len(payload['routes'])}")
    L.append("")
    ev = payload.get("egress_violations") or []
    L.append(f"## ⛔ حماية الإنتاج: {len(ev)} طلب خارج localhost")
    if ev:
        for e in ev[:10]:
            L.append(f"- `{e['url']}`")
    else:
        L.append("- **صفر** — الفحص ما لمسش أي مورد خارجي.")
    L.append("")

    L.append("## 📋 جدول المسارات")
    L.append("")
    L.append("| المسار | الصفحة المطلوبة | ٣٦٠ | ٣٩٠ | ٧٦٨ | أخطاء JS | تمدد |")
    L.append("|---|---|---|---|---|---|---|")
    widths = payload["widths"]
    for route in payload["routes"]:
        cells = []
        nerr = 0
        ovmax = 0
        for w in widths:
            r = next((x for x in rows if x["route"] == route and x["width"] == w), None)
            if not r:
                cells.append("—")
                continue
            cells.append("✅" if r["page_ok"] else "❌")
            nerr += len(r["errors"])
            ovmax = max(ovmax, r["overflow_px"] if r["overflow"] else 0)
        L.append(f"| `{route}` | `{expected_container(route)[1]}` | " +
                 " | ".join(cells) + f" | {nerr} | {ovmax}px |")
    L.append("")

    L.append("## 🐞 العيوب")
    L.append("")
    if not defects:
        L.append("- مافيش عيوب.")
    else:
        seen = set()
        for kind, route, w, msg in defects:
            key = (kind, route, msg[:80])
            if key in seen:
                continue
            seen.add(key)
            L.append(f"- **[{kind}]** `{route}` @ {w}px — {msg}")
    L.append("")

    L.append("## 🔓 الصفحة العامة (زائر)")
    L.append("")
    for r in payload["results"]:
        if r.get("kind") == "public":
            L.append(f"- `{r['route']}` @ {r['width']}px — http={r.get('http')} "
                     f"· عناصر ظاهرة: {r.get('visible')} · نص={r.get('text_len')} حرف "
                     f"· أخطاء={len(r.get('errors', []))}")
    L.append("")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default=None)
    ap.add_argument("--out", default="/tmp/ux_probe.json")
    ap.add_argument("--md", default=None)
    ap.add_argument("--widths", default="360,390,768")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--mode", default="preview", choices=["preview", "source"],
                    help="preview = fail-closed (زي المعاينة المنشورة)")
    a = ap.parse_args()

    routes = parse_spa_routes()
    widths = [int(x) for x in a.widths.split(",") if x.strip()]

    srv = None
    base = a.base_url
    if not base:
        Handler.routes = set(routes)
        Handler.mode = a.mode
        port = free_port()
        srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        # ⛔ اسم المضيف = octa.local (مش localhost) ⇒ البوابة تفتح فعلاً
        #   (octa-gate.js: «localhost ميفتحش البوابة — للتطوير»)
        base = f"http://octa.local:{port}"
        time.sleep(0.3)

    try:
        payload = run_probe(base, routes, widths, a.out, headed=a.headed)
    finally:
        if srv:
            srv.shutdown()

    md = render_markdown(payload)
    md_path = a.md or (os.path.splitext(a.out)[0] + ".md")
    Path(md_path).write_text(md, encoding="utf-8")

    rows, defects, _, _ = summarize(payload)
    ok = sum(1 for r in rows if r["page_ok"])
    print(f"📊 {ok}/{len(rows)} مسار×مقاس اتفتحوا بالصفحة الصح")
    print(f"🐞 عيوب: {len(defects)}")
    print(f"⛔ خروج خارج localhost: {len(payload.get('egress_violations') or [])}")
    print(f"📄 JSON: {a.out}\n📄 MD: {md_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
