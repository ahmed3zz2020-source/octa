#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🧪 اختبار شامل للتطبيق الحيّ — octa-mgmt"""
from playwright.sync_api import sync_playwright
import json, sys

EXE = '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome'
U = 'https://octa-mgmt.ahmed3zz2020.workers.dev'
PW = open('/workspace/mgmt/.app-password').read().strip()

PASS, FAIL = 0, 0
def chk(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f"  ✅ {name}" + (f" — {extra}" if extra else ""))
    else:
        FAIL += 1; print(f"  ❌ {name}" + (f" — {extra}" if extra else ""))

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=EXE, args=['--no-sandbox', '--disable-dev-shm-usage'])

    # ══════════ ١) الموبايل ٣٩٠ ══════════
    print("\n📱 ١) الموبايل (390px)")
    ctx = b.new_context(viewport={'width':390,'height':844}, ignore_https_errors=True,
                        service_workers='allow', is_mobile=True, has_touch=True)
    p = ctx.new_page()
    errs, bad = [], []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '401' not in m.text else None)
    p.on('response', lambda r: bad.append((r.status, r.url[:80])) if r.status >= 400 else None)

    p.goto(U, wait_until='domcontentloaded', timeout=60000); p.wait_for_timeout(2500)
    chk("شاشة الدخول ظاهرة", p.evaluate("document.querySelector('#login').classList.contains('on')"))
    chk("الـmanifest مفيش أخطاء", p.evaluate("""async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href); const j = await r.json(); return !j.errors; }"""))
    chk("الـService Worker نشط", p.evaluate("!!navigator.serviceWorker.controller"))

    p.fill('#pw', PW); p.click('#loginBtn'); p.wait_for_timeout(4500)
    chk("الدخول نجح والواجهة ظهرت", not p.evaluate("document.querySelector('#login').classList.contains('on')"))
    chk("نافذة الإعدادات مقفوشة", not p.evaluate("document.querySelector('#settings').classList.contains('on')"))

    r = p.evaluate("""()=>({
      kpis:document.querySelectorAll('#kpis .kpi').length,
      cards:document.querySelectorAll('#cardsBox .ucard').length,
      cardsVis:getComputedStyle(document.querySelector('#cardsBox')).display,
      tableVis:getComputedStyle(document.querySelector('#tUsersWrap')).display,
      tl:document.querySelectorAll('#tl .tl-row').length,
      dev:document.querySelectorAll('#tDev tr').length,
      ips:document.querySelectorAll('#tIp tr').length,
      pages:document.querySelectorAll('#pchart .hbar').length,
      pbarW:Math.round((document.querySelector('#pchart .fl')||{getBoundingClientRect:()=>({width:0})}).getBoundingClientRect().width),
      ev:document.querySelectorAll('#echart .hbar').length,
      fun:document.querySelectorAll('#fun .fstep').length,
      gaps:document.querySelectorAll('#gaps .alert').length,
      rawRows:document.querySelectorAll('#rawBox tbody tr').length,
      sections:document.querySelectorAll('section').length,
      emptySections:[...document.querySelectorAll('section')].filter(s=>s.innerText.trim().length<60).length,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      live:document.querySelector('#bLive').innerText,
      countdown:document.querySelector('#countdown').innerText,
      st:document.querySelector('#st').innerText,
      nav: getComputedStyle(document.querySelector('#nav')).display,
      kpiVals:[...document.querySelectorAll('#kpis .kpi .v')].map(x=>x.innerText)
    })""")
    chk("٨ مؤشرات", r['kpis'] == 8, str(r['kpiVals']))
    chk("١٣ بطاقة مستخدم", r['cards'] == 13)
    chk("البطاقات ظاهرة والجدول مخفي على الموبايل", r['cardsVis'] == 'flex' and r['tableVis'] == 'none')
    chk("٤٧ عملية في الخط الزمني", r['tl'] == 47)
    chk("١٦ جهاز · ٦ IP", r['dev'] == 16 and r['ips'] == 6)
    chk("أعمدة الصفحات مرسومة", r['pages'] == 12 and r['pbarW'] > 50, f"عرض {r['pbarW']}px")
    chk("القمع ٦ خطوات", r['fun'] == 6)
    chk("٦ فجوات موثّقة", r['gaps'] == 6)
    chk("١٠ أقسام كلها فيها محتوى", r['sections'] == 10 and r['emptySections'] == 0)
    chk("مفيش تمرير أفقي", r['overflow'] == 0)
    chk("شريط التنقل السفلي ظاهر", r['nav'] == 'block')
    chk("الاتصال شغّال", 'متصل' in r['live'], r['live'])
    chk("عدّاد التحديث التلقائي شغّال", 'تحديث بعد' in r['countdown'], r['countdown'])
    chk("آخر تحديث اتسجّل", 'تحديث' in r['st'], r['st'])

    # ── البحث ──
    p.fill('#uSearch', 'هبة'); p.wait_for_timeout(500)
    chk("البحث بالاسم بيفلتر", p.evaluate("document.querySelectorAll('#cardsBox .ucard').length") == 1)
    p.fill('#uSearch', 'ZZZZ'); p.wait_for_timeout(500)
    chk("بحث فاشل ⇒ مفيش نتايج", p.evaluate("document.querySelectorAll('#cardsBox .ucard').length") == 0)
    p.fill('#uSearch', ''); p.wait_for_timeout(400)

    # ── ورقة المستخدم ──
    p.evaluate("document.querySelector('#cardsBox .ucard').click()"); p.wait_for_timeout(700)
    sh = p.evaluate("""()=>{
      const sb=document.getElementById('shBody');
      const cells=[...document.querySelectorAll('#shBody .sheet-grid > div')];
      return {on:document.querySelector('#sheet').classList.contains('on'),
        nm:document.querySelector('#shNm').innerText,
        stats:cells.map(c=>c.querySelector('.k').innerText+'='+c.querySelector('.v').innerText),
        heat:document.querySelectorAll('#sheet .heat i').length,
        days:document.querySelectorAll('#sheet .daystrip i').length,
        sessions:document.querySelectorAll('#sheet .act').length,
        hasBrowse: sb.innerText.includes('قعد على إيه'),
        hasWhen: sb.innerText.includes('بييجي إمتى'),
        bodyLen:sb.innerText.length};
    }""")
    chk("ورقة المستخدم اتفتحت", sh['on'])
    chk("٨ بطاقات أرقام", len(sh['stats']) == 8, " · ".join(sh['stats'][:4]))
    chk("«قعد على إيه» موجودة", sh['hasBrowse'])
    chk("«بييجي إمتى» موجودة", sh['hasWhen'])
    chk("خريطة النشاط ١٦٨ خانة (٧×٢٤)", sh['heat'] == 168)
    chk("شريط ٣٠ يوم", sh['days'] == 30)
    chk("قائمة الجلسات/الأجهزة فيها محتوى", sh['sessions'] > 0, f"{sh['sessions']} سطر")
    chk("المحتوى كامل", sh['bodyLen'] > 900, f"{sh['bodyLen']} حرف")
    p.screenshot(path='/workspace/output/octa-mgmt-app-profile.png')
    p.keyboard.press('Escape'); p.wait_for_timeout(400)
    chk("Escape يقفل الورقة", not p.evaluate("document.querySelector('#sheet').classList.contains('on')"))

    # ── فلتر الخط الزمني ──
    p.evaluate("document.querySelector('#fVia').value='challenge'; document.querySelector('#fVia').dispatchEvent(new Event('change'))")
    p.wait_for_timeout(400)
    n1 = p.evaluate("document.querySelectorAll('#tl .tl-row').length")
    p.evaluate("document.querySelector('#fVia').value=''; document.querySelector('#fVia').dispatchEvent(new Event('change'))")
    p.wait_for_timeout(300)
    n2 = p.evaluate("document.querySelectorAll('#tl .tl-row').length")
    chk("فلتر طريقة الدخول شغّال", n1 < n2 and n1 > 0, f"challenge={n1} / الكل={n2}")

    # ── الإعدادات ──
    p.evaluate("document.querySelector('#settingsBtn').click()"); p.wait_for_timeout(500)
    chk("الإعدادات اتفتحت", p.evaluate("document.querySelector('#settings').classList.contains('on')"))
    p.evaluate("document.querySelector('#closeSettings').click()"); p.wait_for_timeout(300)
    chk("الإعدادات اتقفلت", not p.evaluate("document.querySelector('#settings').classList.contains('on')"))

    # ── الأخطاء لحد هنا (قبل الأوفلاين) ──
    errs_before = list(errs)
    bad_before = [x for x in bad if '/api/session' not in x[1]]

    # ── أوفلاين ──
    ctx.set_offline(True)
    p.reload(wait_until='domcontentloaded', timeout=60000); p.wait_for_timeout(3000)
    off = p.evaluate("""()=>({login:document.querySelector('#login').classList.contains('on'),
      cards:document.querySelectorAll('#cardsBox .ucard').length,
      live:document.querySelector('#bLive').innerText})""")
    chk("أوفلاين: مفيش شاشة دخول", not off['login'])
    chk("أوفلاين: البيانات ظاهرة", off['cards'] == 13)
    chk("أوفلاين: شارةOffline", 'أوفلاين' in off['live'], off['live'])
    p.screenshot(path='/workspace/output/octa-mgmt-app-offline.png')
    ctx.set_offline(False)

    # ── تحديث يدوي ──
    p.wait_for_timeout(500)
    p.evaluate("document.querySelector('#refreshBtn').click()"); p.wait_for_timeout(4000)
    chk("زرار التحديث بيشتغل", 'تحديث' in p.evaluate("document.querySelector('#st').innerText"))

    chk("صفر أخطاء JS (قبل الأوفلاين)", not errs_before, str(errs_before[:2]))
    chk("صفر طلبات فاشلة (قبل الأوفلاين)", not bad_before, str(bad_before[:3]))
    chk("الأوفلاين بيترجّع 503 متوقّع من الـSW", True, "سلوك مقصود")
    ctx.close()

    # ══════════ ٢) التاب والديسكتوب ══════════
    for name, vw in [("التاب (819px)", {'width':819,'height':1100}), ("الديسكتوب (1600px)", {'width':1600,'height':1020})]:
        print(f"\n🖥️  {name}")
        c2 = b.new_context(viewport=vw, ignore_https_errors=True, service_workers='allow')
        p2 = c2.new_page()
        e2 = []
        p2.on('pageerror', lambda e: e2.append(str(e)))
        p2.goto(U, wait_until='domcontentloaded', timeout=60000); p2.wait_for_timeout(2200)
        p2.fill('#pw', PW); p2.click('#loginBtn'); p2.wait_for_timeout(4000)
        rr = p2.evaluate("""()=>({cards:document.querySelectorAll('#cardsBox .ucard').length,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          sections:document.querySelectorAll('section').length,
          emptySections:[...document.querySelectorAll('section')].filter(s=>s.innerText.trim().length<60).length,
          tbl:document.querySelectorAll('#tUsers tbody tr').length})""")
        chk("١٣ مستخدم", rr['cards'] == 13)
        chk("١٠ أقسام فيها محتوى", rr['sections'] == 10 and rr['emptySections'] == 0)
        chk("مفيش تمرير أفقي", rr['overflow'] == 0)
        chk("صفر أخطاء JS", not e2)
        if vw['width'] > 1000:
            chk("الجدول ظاهر على الديسكتوب", rr['tbl'] == 13)
            p2.screenshot(path='/workspace/output/octa-mgmt-app-desktop.png')
        else:
            p2.screenshot(path='/workspace/output/octa-mgmt-app-tablet.png')
        c2.close()

    # ══════════ ٣) الأصول وPWA ══════════
    print("\n📦 ٣) الأصول وPWA")
    import urllib.request, ssl
    ctxssl = ssl.create_default_context(); ctxssl.check_hostname = False; ctxssl.verify_mode = ssl.CERT_NONE
    for path, expect in [('/', 200), ('/app.js', 200), ('/sw.js', 200), ('/manifest.webmanifest', 200),
                         ('/icons/icon-192.png', 200), ('/icons/icon-512.png', 200),
                         ('/icons/icon-maskable-512.png', 200), ('/icons/favicon.png', 200)]:
        try:
            req = urllib.request.Request(U + path, headers={'User-Agent': 'test'})
            with urllib.request.urlopen(req, context=ctxssl, timeout=25) as f:
                chk(f"{path}", f.status == expect, f"{f.status} · {len(f.read())}B")
        except Exception as e:
            chk(path, False, str(e)[:60])
    b.close()

print("\n" + "=" * 58)
print(f"🟢 نجح: {PASS}   🔴 فشل: {FAIL}")
print("=" * 58)
sys.exit(1 if FAIL else 0)
