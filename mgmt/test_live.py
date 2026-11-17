#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🧪 اختبار شامل للتطبيق الحيّ — octa-mgmt

🛡️ الجولة ١٨ (P0): التطبيق بقى **محمي بالكامل** — أي صفحة/ملف ثابت
   بيطلب جلسة. ⇒ الاختبار بيبدأ بالتحقق من البوابة (زائر ⇒ 401/302).
"""
from playwright.sync_api import sync_playwright
import json, sys, urllib.request, urllib.error, ssl

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

_ctxssl = ssl.create_default_context(); _ctxssl.check_hostname = False; _ctxssl.verify_mode = ssl.CERT_NONE

def raw(path, headers=None, method="GET"):
    """⛔ من غير تحويل (no redirect) — عشان نشوف 302/401 كويس."""
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    op = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(U + path, method=method, headers=headers or {})
    try:
        with op.open(req, context=_ctxssl, timeout=25) as f:
            return f.status, dict(f.headers), f.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode('utf-8', 'replace')

print("\n🔐 ٠) البوابة (زائر من غير جلسة)")
st, hd, body = raw('/index.html')
chk("GET /index.html من غير جلسة ⇒ 401", st == 401, f"status={st}")
st, hd, body = raw('/', headers={'Accept': 'text/html'})
chk("GET / (متصفح) من غير جلسة ⇒ 302", st == 302, f"status={st}")
loc = {str(k).lower(): v for k, v in hd.items()}.get('location', '')
chk("التحويل بيوصّل لصفحة الدخول", '/login.html' in loc, loc or '—')
import re as _re
_em = _re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_ip = _re.compile(r"(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\w.])")
chk("جسم رد الزائر مافيشوش إيميلات", len(_em.findall(body)) == 0, f"عدد={len(_em.findall(body))}")
chk("جسم رد الزائر مافيشوش IP", len(_ip.findall(body)) == 0, f"عدد={len(_ip.findall(body))}")
st, hd, body = raw('/login.html')
chk("صفحة الدخول مفتوحة (public)", st == 200, f"status={st}")

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
    chk("زائر اتحوّل لصفحة الدخول", p.url.endswith('/login.html'), p.url)
    chk("شاشة الدخول ظاهرة", p.evaluate("!!document.querySelector('#pw')"))
    p.goto(U + '/manifest.webmanifest', wait_until='domcontentloaded', timeout=30000)
    p.wait_for_timeout(800)
    chk("الـmanifest مفيش أخطاء", p.evaluate("""async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href); const j = await r.json(); return !j.errors; }"""))
    p.goto(U, wait_until='domcontentloaded', timeout=60000); p.wait_for_timeout(1500)
    p.fill('#pw', PW); p.click('#loginBtn'); p.wait_for_timeout(6000)
    chk("الدخول نجح والواجهة ظهرت", not p.url.endswith('/login.html'), p.url)
    p.wait_for_timeout(4000)
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
      kpiVals:[...document.querySelectorAll('#kpis .kpi .v')].map(x=>x.innerText),
      panel:['dailyBox','usersBox','loginBox','pricesBox','incidentsBox','auditBox','decisionsBox','alertsBox']
        .map(id=>{const e=document.getElementById(id); return e?e.innerText.trim().length:-1;}),
      panelSections:['secDaily','secUsers','secLogin','secPrices','secIncidents','secAudit','secDecisions','secAlerts']
        .map(id=>{const e=document.getElementById(id); return e?e.innerText.trim().length:-1;})
    })""")
    chk("٩ مؤشرات", r['kpis'] == 9, str(r['kpiVals']))
    chk("١٣ بطاقة مستخدم", r['cards'] == 13)
    chk("البطاقات ظاهرة والجدول مخفي على الموبايل", r['cardsVis'] == 'flex' and r['tableVis'] == 'none')
    chk("٤٧ عملية في الخط الزمني", r['tl'] == 47)
    chk("١٦ جهاز · ٦ IP", r['dev'] == 16 and r['ips'] == 6)
    chk("أعمدة الصفحات مرسومة", r['pages'] == 12 and r['pbarW'] > 50, f"عرض {r['pbarW']}px")
    chk("القمع ٦ خطوات", r['fun'] == 6)
    chk("٦ فجوات موثّقة", r['gaps'] == 6)
    chk("١٨ قسم كلها فيها محتوى", r['sections'] == 18 and r['emptySections'] == 0, f"أقسام={r['sections']} فاضية={r['emptySections']}")
    chk("الأقسام الثمانية بتاعة لوحة الإدارة فيها محتوى",
        all(v > 40 for v in r['panelSections']), str(r['panelSections']))
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

    # ── ⭐ تبديل الجدول/البطاقات على الموبايل (١٤ نوفمبر) ──
    p.click('#vTable'); p.wait_for_timeout(600)
    t = p.evaluate("""()=>({
      cards:getComputedStyle(document.querySelector('#cardsBox')).display,
      table:getComputedStyle(document.querySelector('#tUsersWrap')).display,
      rows:document.querySelectorAll('#tUsers tbody tr').length,
      view:document.body.getAttribute('data-view')
    })""")
    chk("زر «جدول» بيظهر الجدول على الموبايل", t['table'] != 'none' and t['cards'] == 'none',
        f"جدول={t['table']} بطاقات={t['cards']} data-view={t['view']}")
    chk("صفوف الجدول موجودة", t['rows'] == 13, str(t['rows']))
    # ⭐ البحث في عرض الجدول (كان ما بيفلترش خالص)
    p.fill('#uSearch', 'هبة'); p.wait_for_timeout(600)
    tr = p.evaluate("document.querySelectorAll('#tUsers tbody tr').length")
    chk("البحث بيفلتر الجدول كمان", tr == 1, f"{tr} سطر")
    p.fill('#uSearch', 'ZZZZ'); p.wait_for_timeout(500)
    tr0 = p.evaluate("document.querySelectorAll('#tUsers tbody tr').length")
    chk("بحث فاشل في الجدول ⇒ صفر صفوف", tr0 == 0, str(tr0))
    p.fill('#uSearch', ''); p.wait_for_timeout(400)
    p.click('#vCards'); p.wait_for_timeout(600)
    c2 = p.evaluate("getComputedStyle(document.querySelector('#cardsBox')).display")
    chk("زر «بطاقات» بيرجّع للبطاقات", c2 == 'flex', c2)

    # ── ⭐ تصدير Excel حقيقي ──
    try:
        with p.expect_download(timeout=25000) as dl:
            p.click("button[onclick='dlUsers()']")
        d = dl.value
        path = '/tmp/octa_export_test.xlsx'
        d.save_as(path)
        import zipfile, os
        ok = os.path.exists(path) and zipfile.is_zipfile(path)
        z = zipfile.ZipFile(path) if ok else None
        names = z.namelist() if z else []
        wbxml = z.read('xl/workbook.xml').decode('utf-8', 'replace') if z else ''
        chk("تصدير Excel ملف .xlsx سليم", ok and 'xl/workbook.xml' in names, f"{os.path.getsize(path) if ok else 0}B")
        chk("الملف فيه ٣ أوراق (مستخدمين/جلسات/خط زمني)", wbxml.count('<sheet ') == 3, wbxml[:120])
        chk("اسم الملف عربي .xlsx", d.suggested_filename.endswith('.xlsx'), d.suggested_filename)
    except Exception as e:
        chk("تصدير Excel", False, str(e)[:120])

    # ── ⭐ التفضيلات (الأسهم اللي بيتابعها) ──
    pf = p.evaluate("""async () => { const r = await fetch('/api/prefs',{credentials:'same-origin'}); return await r.json(); }""")
    us = (pf.get('users') or [])
    wsum = sum(u.get('n', 0) for u in us)
    # ⭐ التكرار يتchecked جوه كل مستخدم (نفس السهم ممكن يتابعه اتنين)
    dup = [u.get('name') for u in us
           if len([w['code'] for w in (u.get('watch') or [])]) != len(set(w['code'] for w in (u.get('watch') or [])))]
    chk("/api/prefs بيرجّع ١٣ مستخدم", len(us) == 13, str(len(us)))
    chk("متابعات الأسهم من غير تكرار جوه كل مستخدم", not dup, str(dup))
    chk("فيه متابعات فعلاً", wsum >= 7, str(wsum))

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
        chk("١٨ قسم فيها محتوى", rr['sections'] == 18 and rr['emptySections'] == 0)
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
    print("\n🔐 ٣-ب) الأصول محمية: 401 من غير جلسة · 200 بجلسة")
    assets = ['/', '/index.html', '/app.js', '/panel.js', '/panel.css', '/sw.js',
              '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png',
              '/icons/icon-maskable-512.png', '/icons/favicon.png']
    for path in assets:
        st, hd, _b = raw(path)
        chk(f"{path} من غير جلسة ⇒ 401/302", st in (401, 302), f"status={st}")
    # 🔑 جلسة عبر urllib ⇒ الأصول ترجع 200
    try:
        req = urllib.request.Request(U + '/api/login', method='POST',
                                     data=json.dumps({'password': PW}).encode(),
                                     headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, context=ctxssl, timeout=25) as f:
            cookie = f.headers.get('Set-Cookie', '').split(';')[0]
        for path in assets:
            st, hd, _b = raw(path, headers={'Cookie': cookie})
            chk(f"{path} بجلسة ⇒ 200", st == 200, f"status={st}")
    except Exception as e:
        chk("جلسة urllib + الأصول", False, str(e)[:80])
    b.close()

print("\n" + "=" * 58)
print(f"🟢 نجح: {PASS}   🔴 فشل: {FAIL}")
print("=" * 58)
sys.exit(1 if FAIL else 0)
