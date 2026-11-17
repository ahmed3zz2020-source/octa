#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🔎 قياس دقيق للتمرير الأفقي — مقاسات العناصر."""
import os
import socket
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MGMT = os.path.dirname(HERE)
EXE = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
PORT = int(os.environ.get("MGMT_E2E_PORT", "8811"))
BASE = "http://127.0.0.1:%d" % PORT


def wait_port(port, timeout=30):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            s = socket.create_connection(("127.0.0.1", port), timeout=1)
            s.close()
            return True
        except OSError:
            time.sleep(0.2)
    return False


JS = """()=>{
  const de = document.documentElement;
  const nav = document.getElementById('nav');
  const inner = nav ? nav.querySelector('.inner') : null;
  const cs = nav ? getComputedStyle(nav) : null;
  const csi = inner ? getComputedStyle(inner) : null;
  const wide = [];
  document.querySelectorAll('*').forEach(el=>{
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      wide.push({tag: el.tagName, id: el.id||'', cls:(el.className||'').toString().slice(0,40),
                 sw: el.scrollWidth, cw: el.clientWidth});
    }
  });
  wide.sort((a,b)=>(b.sw-b.cw)-(a.sw-a.cw));
  return {
    docClientW: de.clientWidth, docScrollW: de.scrollWidth, bodyScrollW: document.body.scrollWidth,
    navW: nav ? nav.getBoundingClientRect().width : -1,
    navPos: cs ? cs.position : '', navLeft: cs ? cs.left : '', navRight: cs ? cs.right : '',
    innerCW: inner ? inner.clientWidth : -1, innerSW: inner ? inner.scrollWidth : -1,
    innerOverflowX: csi ? csi.overflowX : '',
    wide: wide.slice(0, 12)
  };
}"""


def main():
    env = dict(os.environ)
    srv = subprocess.Popen(["node", os.path.join(HERE, "harness", "server.js"), str(PORT)],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)
    if not wait_port(PORT):
        print("❌ السيرفر ما اشتغلش")
        return 2
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            b = pw.chromium.launch(executable_path=EXE, args=["--no-sandbox", "--disable-dev-shm-usage"])
            ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            p = ctx.new_page()
            p.goto(BASE + "/login.html", wait_until="domcontentloaded")
            p.fill("#pw", "e2e-password")
            p.click("button[type=submit]")
            p.wait_for_timeout(4000)
            out = p.evaluate(JS)
            for k, v in out.items():
                if k == "wide":
                    print("wide:")
                    for x in v:
                        print("   ⚠ %-6s id=%-10s cls=%-22s scrollW=%s clientW=%s" % (x["tag"], x["id"], x["cls"], x["sw"], x["cw"]))
                else:
                    print("%s = %s" % (k, v))
            b.close()
    finally:
        srv.terminate()
    return 0


if __name__ == "__main__":
    sys.exit(main())
