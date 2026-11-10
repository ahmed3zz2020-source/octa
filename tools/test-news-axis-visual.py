#!/usr/bin/env python3
"""فحص بصري + وظيفي لمحور الأخبار (هالان) في كارت القرار — ٩ نوفمبر ٢٠٢٦.

بيفتح المعاينة على موبايل 390px، يفتح كارت القرار لسهم معروف، ويتأكد:
  ① قسم «📰 الأخبار والمحفزات» موجود وم فيه رقم (مش 45 وهمية)
  ② رقم درجة الأخبار مطابق للـAPI الحيّ (مصدر واحد للحقيقة)
  ③ الأذرع (المحاور) بتعرض رقم الأخبار الحقيقي
  ④ لقطة شاشة للحفظ

الاستخدام: python3 tools/test-news-axis-visual.py [url]
"""
import sys
import os
import json
import time
import urllib.request

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "https://octa-preview.ahmed3zz2020.workers.dev"
API = "https://octa-prices-production-4ccb.up.railway.app"
CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
OUT_DIR = os.environ.get("OCTA_SHOTS", "/workspace/output")
# أسهم ليها أحداث هالان مؤكدة (لقيتاها بالقياس الحيّ)
CODES = ["ETEL", "EGAL", "ABUK"]

ok = True


def check(cond, label, extra=""):
    global ok
    print(("   ✅ " if cond else "   ❌ ") + label + ((" — " + str(extra)) if extra else ""))
    if not cond:
        ok = False


def mint():
    req = urllib.request.Request(
        API + "/api/admin/mint_session",
        data=json.dumps({"email": "ahmed3zz2020@gmail.com", "ttl": 1800}).encode(),
        headers={"X-OCTA-Admin": os.environ.get("OCTA_ADMIN_TOKEN", ""),
                 "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["token"]


def api_news(code):
    """درجة الأخبار من الـBFD الخام (بدون هالان) — ده مرجع المقارنة."""
    req = urllib.request.Request(
        API + "/api/news/" + code,
        headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode())
    n = d.get("news") or {}
    return n.get("score"), n.get("events_count"), n.get("materiality")


def preview_news(code):
    """درجة الأخبار من المعاينة (اللي الـWorker عماله: BFD + هالان)."""
    req = urllib.request.Request(
        URL + "/api/news/" + code,
        headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode())
    n = d.get("news") or {}
    return n.get("score"), n.get("events_count"), d.get("newsSource")


TOKEN = mint()
print("   ▸ جلسة اختبار اتعملت")

with sync_playwright() as p:
    br = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"], executable_path=CHROME)
    ctx = br.new_context(viewport={"width": 390, "height": 844},
                         device_scale_factor=2)
    dom = URL.split("//", 1)[1].split("/", 1)[0]
    ctx.add_cookies([{"name": "octa_token", "value": TOKEN, "domain": dom, "path": "/"}])
    ctx.add_init_script(
        "try { localStorage.setItem('octa_token', %s); } catch (e) {}" % json.dumps(TOKEN))
    pg = ctx.new_page()
    errs = []
    BENIGN = ("401", "Content Security Policy", "favicon", "Failed to load resource")
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text)
          if (m.type == "error" and not any(b in m.text for b in BENIGN)) else None)

    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)

    gate = pg.evaluate(
        "() => { var g = document.getElementById('gate'); return g ? getComputedStyle(g).display : 'none-el'; }")
    check(gate in ("none", "none-el"), "البوابة مقفولة (الجلسة شغالة)")

    for code in CODES:
        print(f"\n   ▸ السهم {code}")
        api_score, api_events, api_mat = api_news(code)
        pv_score, pv_events, pv_src = preview_news(code)
        # ⭐ الباك الخام مفيش عنده أحداث هالان ⇒ 45 متوقّع
        check(pv_score != 45, f"{code}: المعاينة رجّعت رقم حقيقي (مش 45)", pv_score)
        check(pv_events >= api_events,
              f"{code}: المعاينة فيها كل أحداث الباك + أكتر",
              f"preview={pv_events} backend={api_events}")
        check(pv_src == "halan" or pv_events == api_events,
              f"{code}: مصدر الرقم", pv_src)

        # ⭐ openCard هو اللي بيفتح «كارت القرار» الكامل:
        #    فيه قسم «📰 الأخبار والمحفزات» + الأذرع (المحاور السبعة).
        pg.evaluate("(c) => { try { openCard(c, null, 'egx'); } catch (e) { } }", code)
        # نستنى لحد ما نص «الأخبار والمحفزات» يظهر
        found = False
        for _ in range(30):
            time.sleep(1)
            txt = pg.evaluate(
                "() => { var b = document.getElementById('mBody'); return b ? b.innerText : ''; }")
            if "الأخبار والمحفزات" in txt:
                found = True
                break
        check(found, f"{code}: قسم الأخبار والمحفزات ظهر في الكارت")
        if not found:
            continue

        # 📌 نمرّر ل قسم الأخبار جوّه المودال (mlay = position:fixed)
        #    ⇒ اللقطة تكوّن القسم نفسه مش الصفحة اللي تحته
        try:
            pg.evaluate("""() => {
                var l = document.getElementById('mlay');
                if (!l) return;
                var secs = l.querySelectorAll('.mcard');
                for (var i = 0; i < secs.length; i++) {
                    if ((secs[i].innerText || '').indexOf('الأخبار والمحفزات') >= 0) {
                        l.scrollTop = secs[i].offsetTop - 12;
                        return;
                    }
                }
                l.scrollTop = 0;
            }""")
            time.sleep(1.2)
        except Exception:
            pass

        txt = pg.evaluate(
            "() => { var b = document.getElementById('mBody'); return b ? b.innerText : ''; }")
        # سطر «درجة الأخبار: X/100»
        import re
        m = re.search(r"درجة الأخبار:\s*(\d+)\s*/\s*100", txt)
        shown = int(m.group(1)) if m else None
        check(shown is not None, f"{code}: رقم درجة الأخبار ظاهر في الواجهة", shown)
        check(shown == pv_score, f"{code}: الرقم في الواجهة = رقم الـAPI",
              f"ui={shown} api={pv_score}")
        check(shown != 45, f"{code}: الرقم مش 45 الوهمية", shown)

        # الأذرع: رقم محور «أخبار»
        arm = pg.evaluate("""() => {
            var out = null;
            var labels = document.querySelectorAll('#mBody .marm .nm2, #mBody .dc-axis .da-n');
            for (var i = 0; i < labels.length; i++) {
                if ((labels[i].innerText || '').indexOf('أخبار') >= 0) {
                    var row = labels[i].closest('.marm') || labels[i].closest('.dc-axis') || labels[i].parentElement;
                    var v = row ? row.querySelector('.nv2, .da-v') : null;
                    out = v ? (v.innerText || '').trim() : null;
                }
            }
            return out;
        }""")
        if arm:
            try:
                arm_v = int(re.sub(r'[^0-9]', '', arm) or 0)
            except Exception:
                arm_v = None
            check(arm_v == pv_score, f"{code}: محور «أخبار» في الأذرع = الدرجة",
                  f"arm={arm_v} api={pv_score}")
        else:
            print("   ⚠️  مقدرتش أقرا محور «أخبار» من الأذرع (اختياري)")

        shot = os.path.join(OUT_DIR, f"news-axis-{code}-390.png")
        try:
            # 📦 لقطة لقسم الأخبار نفسه (داخل المودال) — أوضح بكتير
            el = pg.query_selector("#mBody .mcard")
            found_el = False
            for h in pg.query_selector_all("#mBody .mcard"):
                try:
                    if "الأخبار والمحفزات" in (h.inner_text() or ""):
                        el = h
                        found_el = True
                        break
                except Exception:
                    continue
            if el is None:
                pg.screenshot(path=shot, full_page=False)
            else:
                el.screenshot(path=shot)
            print("   📸 " + shot + (" (قسم الأخبار)" if found_el else " (الكارت)"))
        except Exception as e:
            print("   ⚠️  اللقطة فشل: %s" % e)

    real_errs = [e for e in errs if "halan" not in e.lower()]
    check(not real_errs, "مفيش أخطاء JS في الصفحة", real_errs[:3])

print("")
if ok:
    print("✅ محور الأخبار شغال في الواجهة بأرقام حقيقية.")
    sys.exit(0)
print("❌ في مشاكل — شوف فوق.")
sys.exit(1)
