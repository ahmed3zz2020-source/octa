#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🛡️ الجولة ١٩ (R18-A06 / SEC-024) — فحص XSS في **DOM حقيقي** (Chromium).

📌 المراجع المستقل طلب: «اختبار DOM فعلي، ليس مجرد جرد».
   ⇒ هنا بنحمّل دوال العرض **الحقيقية** من assets/js/octa-core.js جوّه صفحة
     Chromium، ونحقن payload ساذج، وبعدين بنفحص الـDOM **الفعل��**.

⛔ مافيش شبكة · مافيش نشر · payload ساذج (مش بيأذي).
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CORE = ROOT / "assets" / "js" / "octa-core.js"
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1
                   else "/workspace/output/OCTA-ROUND19-EVIDENCE/evidence/r19_xss_dom_check.json")

CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
PAYLOAD = "'; window.__xss=1; //"

HARNESS = r"""<!doctype html><html><head><meta charset="utf-8"></head><body>
<table><tbody id="engineStocksTableBody"></tbody></table>
<div id="engineBars"></div>
<div id="engineDecision"></div>
<input id="engineSearch" value="">
<script>
window.__xss = 0;
function octaEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
var currentEngineSort = 'change';
var ENGINE_TABLE_DATA = [__PAYLOAD_ROW__];
__FUNCTIONS__
renderEngineStocksTable();
renderEngineBars([], 80, {d:{decision: __PAYLOAD__, risk_level: __PAYLOAD__, confidence: 80}});
</script></body></html>
"""


def extract(src, start, end):
    i = src.index(start)
    j = src.index(end, i)
    return src[i:j]


def main():
    src = CORE.read_text(encoding="utf-8")
    fns = (extract(src, "function renderEngineStocksTable(", "function sortEngineStocks")
           + "\n"
           + extract(src, "function renderEngineBars(", "function injectEngineWidget"))
    row = json.dumps({
        "code": PAYLOAD, "name": PAYLOAD, "short": PAYLOAD,
        "percentage": "5%", "quantity": "1", "trades": "2", "value": "3",
        "volume": 10, "change": 1.5, "price": 12.5,
        "color": "red;}body{display:none",
    })
    html = (HARNESS.replace("__FUNCTIONS__", fns)
            .replace("__PAYLOAD_ROW__", row)
            .replace("__PAYLOAD__", json.dumps(PAYLOAD)))

    from playwright.sync_api import sync_playwright
    tmp = pathlib.Path("/workspace/.xss_dom_harness.html")
    tmp.write_text(html, encoding="utf-8")
    checks = {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME,
                              args=["--no-sandbox", "--disable-dev-shm-usage"])
        pg = b.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto("file://" + str(tmp))
        pg.wait_for_timeout(400)
        checks["xss_flag"] = pg.evaluate("window.__xss")
        checks["injected_tags"] = pg.evaluate(
            "document.querySelectorAll('img[onerror], script[src], [onclick]').length")
        checks["body_display_none"] = pg.evaluate(
            "getComputedStyle(document.body).display === 'none'")
        checks["row_count"] = pg.evaluate(
            "document.querySelectorAll('#engineStocksTableBody tr').length")
        checks["decision_text"] = pg.evaluate(
            "(document.getElementById('engineDecision')||{}).textContent || ''")
        checks["code_attr"] = pg.evaluate(
            "(document.querySelector('#engineStocksTableBody tr')||{}).getAttribute"
            "('data-code')")
        checks["page_errors"] = errors
        b.close()
    tmp.unlink(missing_ok=True)

    ok = (checks["xss_flag"] == 0
          and checks["injected_tags"] == 0
          and checks["body_display_none"] is False
          and checks["row_count"] == 1)
    res = {"ok": ok, "checks": checks,
           "note": "DOM حقيقي في Chromium — payload ساذج، مافيش تنفيذ كود فعلي."}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(res, ensure_ascii=False, indent=2))
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
