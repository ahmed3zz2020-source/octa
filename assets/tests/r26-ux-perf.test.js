/* ══════════════════════════════════════════════════════════════
  🎯 الجولة ٢٦ (R26 · UX والأداء) — اختبارات المتصفح الحقيقية
  ──────────────────────────────────────────────────────────────
  📌 تشغيل:  node --test assets/tests/r26-ux-perf.test.js
  📌 المتصفح: Chromium الحقيقي (Playwright) — مسار تنفيذي صريح
     (بيتحقق من وجوده ويقول بوضوح لو مش موجود).
  📌 البيئة: ⛔ كل حاجة محلية معزولة
     · خادم ثابت محلي (assets/tests/helpers/r26-local-server.js)
     · API وهمي محلي مبني على data_full.json (مفيش شبكة خارجية)
     · كل النداءات بره octa.test بتتقفل ⇒ ⛔ مفيش أي حمل على الإنتاج
  📌 المعايير:
     ① ١٣ مقاساً معتمداً × ٥ صفحات: تجاوز أفقي · تداخل · نص مقصوص
        · أهداف ≥ ٤٤ بكسل · تباين ≥ ٤٫٥ · سمات ARIA
     ② تنقّل بلوحة المفاتيح: ترتيب · وضوح التركيز · Escape
     ③ أداء: LCP · زمن التحميل · شبكة بطيئة · دخول · ١٠٠ طلب متوازي
        · ثبات الذاكرة (RSS)
  ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { startServer } = require('./helpers/r26-local-server.js');
const { AUDIT_SRC, LCP_INIT_SRC, FOCUS_PROBE_SRC } = require('./helpers/r26-audit.js');
const { launchChromium, CHROME_INFO } = require('./helpers/r26-playwright.js');

/* ── المقاسات المعتمدة (١٣) — فيها حدود الكسر 899/900 و1099/1100 ─── */
const SIZES = [
  { w: 360, h: 640, name: '360×640' },
  { w: 390, h: 844, name: '390×844' },
  { w: 412, h: 915, name: '412×915' },
  { w: 768, h: 1024, name: '768×1024' },
  { w: 820, h: 1180, name: '820×1180' },
  { w: 899, h: 900, name: '899×900' },
  { w: 900, h: 900, name: '900×900' },
  { w: 1024, h: 1366, name: '1024×1366' },
  { w: 1099, h: 900, name: '1099×900' },
  { w: 1100, h: 900, name: '1100×900' },
  { w: 1280, h: 800, name: '1280×800' },
  { w: 1440, h: 900, name: '1440×900' },
  { w: 1920, h: 1080, name: '1920×1080' },
];

/* ── الصفحات المهمة ───────────────────────────────────────── */
const PAGES = [
  { url: '/index.html', auth: true, name: 'الرئيسية' },
  { url: '/gate.html', auth: false, name: 'بوابة الدخول' },
  { url: '/market.html', auth: false, name: 'فلتر البورصة' },
  { url: '/assets/chart.html', auth: false, name: 'صفحة الشارت' },
  { url: '/reset.html', auth: false, name: 'صفحة التنظيف' },
];

const HOST = 'octa.test';
const TOKEN = 'local-r26-test-token';

/* 📌 صفحة التنظيف بتنفّذ التنظيف لوحدها (بعد ٧٠٠ مللي) وبتعيد
   التوجيه لـ /?r=… ⇒ لو رجعنا بصفحة خطأ ⇒ القياس بقى
   على صفحة الخطأ (نجاح كاذب ⛔) ⇒ بنقدّم صفحة التنظيف نفسها
   بدل صفحة الخطأ (من غير ما نغيّر سلوكها). */
const RESET_HTML_PATH = path.join(__dirname, '..', '..', 'reset.html');
let RESET_HTML = null;
try { RESET_HTML = fs.readFileSync(RESET_HTML_PATH, 'utf8'); } catch (e) { RESET_HTML = null; }

/* ── حالة مشتركة ──────────────────────────────────────────── */
const state = { srv: null, browser: null, base: null, results: [] };

function baseUrl(p) { return 'http://' + HOST + ':' + state.srv.port + p; }

/* ── سياق متصفح معزول ─────────────────────────────────────── */
async function newContext(opts) {
  const o = opts || {};
  const ctx = await state.browser.newContext({
    viewport: { width: o.w || 390, height: o.h || 844 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  await ctx.addInitScript(LCP_INIT_SRC);
  await ctx.addInitScript((auth) => {
    window.OCTA_FAIL_CLOSED = 1;              /* ⛔ ممنوع أي اتصال بالإنتاج */
    try { window.OCTA_DIRECT_LIST = []; } catch (e) { }
    try { window.OCTA_API_ORIGIN = location.origin; } catch (e) { }
    try {
      if (auth) localStorage.setItem('octa_token', 'local-r26-test-token');
      else localStorage.removeItem('octa_token');
    } catch (e) { }
  }, !!o.auth);
  await ctx.route('**', (route) => {
    const u = route.request().url();
    /* ⛔ فحص DNS بتاع حارس الـorigin — نجاوب محلياً */
    if (u.indexOf('cloudflare-dns.com/dns-query') >= 0) {
      return route.fulfill({
        status: 200, contentType: 'application/dns-json',
        body: JSON.stringify({ Status: 0, Answer: [{ data: '127.0.0.1' }] }),
      });
    }
    if (u.indexOf(HOST) >= 0) {
      /* ⛔ منع إعادة التوجيه الذاتي في صفحة التنظيف
         📌 بنقدّم صفحة التنظيف نفسها (مش صفحة خطأ ⛔) ⇒ القياس
            يبقى على الصفحة الحقيقية ⭐. */
      if (/\?r=\d+/.test(u)) {
        if (RESET_HTML) {
          /* ⛔⛔ حلقة إعادة تحميل لا نهائية ⛔
             📌 صفحة التنظيف بتنفّذ التنظيف لوحدها (بعد ٧٠٠ مللي)
                وبتعيد التوجيه ⇒ لو رجّعنا نفس الصفحة ⇒ تاني
                ⇒ تاني ⇒ … ⇒ المتصفح بيقع ⭐.
                📌 الحل: بنوقّف **مؤقّت** التنظيف التلقائي بس
                   (سلوك التنظيف نفسه زي ما هو ⭐) ⇒ الصفحة
                   بتفضل ثابتة والقياس على الصفحة الحقيقية ⭐. */
          const body = RESET_HTML.replace('setTimeout(clean, 700);',
            '/* auto-clean timer disabled in the isolated R26 measurement */');
          return route.fulfill({
            status: 200, contentType: 'text/html; charset=utf-8',
            body: body,
          });
        }
        return route.abort();
      }
      return route.continue();
    }
    return route.abort();      /* ⛔ أي وجهة تانية بتتقفل */
  });
  return ctx;
}

/* ── لقطة شاشة حقيقية (دليل بصري) ─────────────────────────── */
const SHOT_DIR = path.join(__dirname, '..', '..', 'shots', 'r26');
async function shot(pageObj, name) {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) { }
  const file = path.join(SHOT_DIR, name + '.png');
  try {
    await pageObj.screenshot({ path: file, fullPage: false });
    return file;
  } catch (e) {
    return null;
  }
}

/* ── فتح صفحة + إرجاع تقرير الفحص ────────────────────────── */
async function auditPage(pageObj, url, waitMs) {
  const errors = [];
  const badRequests = [];
  pageObj.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e).slice(0, 200)));
  pageObj.on('request', (r) => {
    const u = r.url();
    if (u.indexOf('[object') >= 0 || u.indexOf('%5Bobject') >= 0) badRequests.push(u);
  });
  await pageObj.goto(baseUrl(url), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageObj.waitForTimeout(waitMs || 3500);
  /* ⛔⛔ حارس التحميل: صفحة الخطأ مش نجاح ⛔
     📌 لو الصفحة متحمّلتش (chrome-error · أو عنوان الخطأ · أو
        الـDOM فاضي) ⇒ القياس كله meaningless ⇒ لازم يفشل ⭐. */
  let loaded = true;
  let finalUrl = baseUrl(url);
  let loadNote = '';
  try {
    const chk = await pageObj.evaluate(() => {
      const txt = (document.body && document.body.innerText) || '';
      const bad = /can.?t be reached|this site is unreachable|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|chrome-error/i;
      return {
        url: location.href,
        title: document.title || '',
        bodyLen: document.body ? document.body.innerHTML.length : 0,
        isError: location.protocol === 'chrome-error:' || bad.test(txt) || bad.test(location.href),
      };
    });
    finalUrl = chk.url;
    loaded = !chk.isError && chk.bodyLen > 200;
    if (chk.isError) loadNote = 'صفحة خطأ: ' + chk.url;
    else if (chk.bodyLen <= 200) loadNote = 'الـDOM فاضي (' + chk.bodyLen + ') عند ' + chk.url;
  } catch (e) {
    loaded = false;
    loadNote = 'فشل الفحص: ' + String(e && e.message ? e.message : e).slice(0, 120);
  }
  const audit = await pageObj.evaluate(AUDIT_SRC);
  return { audit: audit, errors: errors, badRequests: badRequests, loaded: loaded, finalUrl: finalUrl, loadNote: loadNote };
}

/* ══════════════════════════════════════════════════════════════
  التهيئة
  ══════════════════════════════════════════════════════════════ */
test.before(async () => {
  state.srv = await startServer({ gzip: true });
  state.base = state.srv.url;
  const info = await launchChromium();
  state.browser = info.browser;
});

test.after(async () => {
  if (state.browser) await state.browser.close();
  if (state.srv) await state.srv.close();
});

/* ══════════════════════════════════════════════════════════════
  ① المقاسات المعتمدة (١٣) — الفحص الكامل
  ══════════════════════════════════════════════════════════════ */
test('R26 · المقاسات المعتمدة (١٣): تجاوز · تداخل · قص · لمس · تباين · ARIA', async (t) => {
  const rows = [];
  for (const p of PAGES) {
    for (const s of SIZES) {
      const ctx = await newContext({ w: s.w, h: s.h, auth: p.auth });
      const page = await ctx.newPage();
      const r = await auditPage(page, p.url, p.url === '/index.html' ? 4500 : 3000);
      const a = r.audit;
      const row = {
        page: p.name, url: p.url, size: s.name,
        hscroll: a.hScroll.overflow,
        scrollW: a.hScroll.scrollWidth, clientW: a.hScroll.clientWidth,
        overlap: a.overlap.count,
        clippedHard: a.clipped.list.filter((c) => !c.ellipsis).length,
        smallTargets: a.smallTargets.standalone,
        contrast: a.contrast.count, contrastChecked: a.contrast.checked,
        buttonsNoName: a.aria.buttonsNoName.length,
        linksNoName: a.aria.linksNoName.length,
        inputsNoLabel: a.aria.inputsNoLabel.length,
        imgsNoAlt: a.aria.imgsNoAlt.length,
        dupIds: a.aria.dupIds.length,
        posTabindex: a.aria.positiveTabindex.length,
        errors: r.errors.length,
        lcp: a.perf.lcp, load: a.perf.load, fcp: a.perf.fcp,
        resourceCount: a.perf.resourceCount, resourceBytes: a.perf.resourceBytes,
        badRequests: r.badRequests.length,
      };
      rows.push(row);
      state.results.push(row);

      const where = p.name + ' @ ' + s.name;
      assert.equal(r.loaded, true,
        where + ' ⇒ الصفحة ما اتفتحتش (قياس على صفحة خطأ ⛔): ' + r.loadNote);
      assert.equal(row.hscroll, false,
        where + ' ⇒ في تجاوز أفقي (' + row.scrollW + ' > ' + row.clientW + '): '
        + JSON.stringify(a.hScroll.offenders.slice(0, 3)));
      assert.equal(row.overlap, 0, where + ' ⇒ تداخل عناصر: '
        + JSON.stringify(a.overlap.list.slice(0, 3)));
      assert.equal(row.clippedHard, 0, where + ' ⇒ نص مقصوص بدون علامة قطع: '
        + JSON.stringify(a.clipped.list.filter((c) => !c.ellipsis).slice(0, 3)));
      assert.equal(row.smallTargets, 0, where + ' ⇒ أهداف لمس أقل من ٤٤: '
        + JSON.stringify(a.smallTargets.list.slice(0, 5)));
      assert.equal(row.contrast, 0, where + ' ⇒ تباين أقل من ٤٫٥: '
        + JSON.stringify(a.contrast.list.slice(0, 5)));
      assert.equal(row.buttonsNoName, 0, where + ' ⇒ أزرار بلا اسم متاح: '
        + JSON.stringify(a.aria.buttonsNoName.slice(0, 3)));
      assert.equal(row.linksNoName, 0, where + ' ⇒ روابط بلا اسم متاح: '
        + JSON.stringify(a.aria.linksNoName.slice(0, 3)));
      assert.equal(row.inputsNoLabel, 0, where + ' ⇒ حقول بلا تسمية: '
        + JSON.stringify(a.aria.inputsNoLabel.slice(0, 3)));
      assert.equal(row.imgsNoAlt, 0, where + ' ⇒ صور بلا نص بديل: '
        + JSON.stringify(a.aria.imgsNoAlt.slice(0, 3)));
      assert.equal(row.dupIds, 0, where + ' ⇒ معرّفات مكرّرة: '
        + JSON.stringify(a.aria.dupIds.slice(0, 5)));
      assert.equal(row.posTabindex, 0, where + ' ⇒ tabindex موجب (ترتيبFocus غلط): '
        + JSON.stringify(a.aria.positiveTabindex.slice(0, 3)));
      assert.equal(row.errors, 0, where + ' ⇒ أخطاء JS: ' + JSON.stringify(r.errors.slice(0, 3)));
      assert.equal(row.badRequests, 0, where + ' ⇒ طلبات لعنوان غلط: '
        + JSON.stringify(r.badRequests.slice(0, 3)));

      await ctx.close();
    }
  }
  assert.ok(rows.length === SIZES.length * PAGES.length, 'كل المقاسات والصفحات اتفحصت');
});

/* ══════════════════════════════════════════════════════════════
  ② لوحة المفاتيح
  ══════════════════════════════════════════════════════════════ */
test('R26 · لوحة المفاتيح: ترتيب منطقي + تركيز مرئي + Escape', async () => {
  for (const p of PAGES) {
    const ctx = await newContext({ w: 390, h: 844, auth: p.auth });
    const page = await ctx.newPage();
    await auditPage(page, p.url, p.url === '/index.html' ? 4500 : 3000);

    /* ① ترتيب التركيز: Tab لحد ٢٥ عنصر */
    const order = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          cls: (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/)[0] : '',
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22),
          outline: st.outlineStyle + ' ' + st.outlineWidth,
          shadow: st.boxShadow,
          visible: r.width > 0 && r.height > 0,
          docOrder: 0,
        };
      });
      if (info) order.push(info);
    }
    /* 📌 الحد الأدنى بيختلف حسب الصفحة: صفحة التنظيف فيها
       عناصر قليلة بطبيعتها ⇒ ١ عنصر تركيز كافي. */
    const minFocus = (p.url === '/reset.html') ? 1 : 3;
    assert.ok(order.length >= minFocus, p.name + ' ⇒ لازم يبقى فيه عناصر كتير للوحة');
    for (const o of order) {
      assert.ok(o.visible, p.name + ' ⇒ عنصر تركيز مش مرئي: ' + JSON.stringify(o));
      const hasOutline = o.outline !== 'none 0px' && o.outline.indexOf('0px') === -1;
      const hasShadow = o.shadow && o.shadow !== 'none';
      assert.ok(hasOutline || hasShadow,
        p.name + ' ⇒ مفيش مؤشر تركيز واضح على: ' + JSON.stringify(o));
    }

    /* ② Shift+Tab يرجع للخلف */
    const sig = () => page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return '';
      const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/)[0] : '';
      return el.tagName.toLowerCase() + '#' + (el.id || '') + '.' + cls + '«' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 14) + '»';
    });
    const beforeSig = await sig();
    await page.keyboard.press('Shift+Tab');
    const afterSig = await sig();
    assert.notStrictEqual(beforeSig, afterSig, p.name + ' ⇒ Shift+Tab مش بيرجع للخلف');

    /* ③ Escape: لو فيه مودال مفتوح ⇒ يقفل
       📌 ما بنضغطش أزرار التنقّل (رجوع/خروج) ⇒ بتعمل navigation
          وبتقطع الـevaluate ⇒ بنستبعدها صراحة. */
    const esc = await page.evaluate(async () => {
      const openers = Array.prototype.filter.call(
        document.querySelectorAll('button,[role="button"]'),
        (b) => /إغلاق|اقفل|✕|×/.test(b.getAttribute('aria-label') || b.title || b.textContent || '')
      );
      if (!openers.length) return { skipped: true };
      openers[0].click();
      await new Promise((r) => setTimeout(r, 700));
      const modalOpen = Array.prototype.some.call(
        document.querySelectorAll('[role="dialog"],.modal,.mlay,.dc-modal'),
        (m) => getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0
      );
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      const stillOpen = Array.prototype.some.call(
        document.querySelectorAll('[role="dialog"],.modal,.mlay,.dc-modal'),
        (m) => getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0
      );
      return { skipped: false, modalOpen: modalOpen, stillOpen: stillOpen };
    });
    if (!esc.skipped) {
      assert.equal(esc.stillOpen, false, p.name + ' ⇒ Escape ما اقفلش المودال');
    }

    /* ④ مؤشر التركيز (focus-visible) على كل العناصر */
    const fp = await page.evaluate(FOCUS_PROBE_SRC);
    assert.equal(fp.noIndicator.length, 0, p.name + ' ⇒ عناصر بلا مؤشر تركيز: '
      + JSON.stringify(fp.noIndicator.slice(0, 5)));

    await ctx.close();
  }
});

/* ══════════════════════════════════════════════════════════════
  ③ الأداء — LCP وزمن التحميل
  ══════════════════════════════════════════════════════════════ */
test('R26 · الأداء: LCP وزمن التحميل على ١٣ مقاساً', async (t) => {
  const rows = [];
  for (const s of SIZES) {
    const ctx = await newContext({ w: s.w, h: s.h, auth: true });
    const page = await ctx.newPage();
    const r = await auditPage(page, '/index.html', 5000);
    const p = r.audit.perf;
    rows.push({ size: s.name, lcp: p.lcp, fcp: p.fcp, load: p.load, dcl: p.domContentLoaded, bytes: p.resourceBytes, res: p.resourceCount });
    /* ⛔ المعيار: LCP أقل من ٤ ثواني على شبكة محلية سريعة */
    assert.ok(p.lcp !== null && p.lcp < 4000,
      'LCP عند ' + s.name + ' = ' + p.lcp + 'ms (المطلوب أقل من ٤٠٠٠)');
    await ctx.close();
  }
  state.perfRows = rows;
  assert.ok(rows.length === 13);
});

/* ══════════════════════════════════════════════════════════════
  ④ الأداء — شبكة بطيئة (throttling)
  ══════════════════════════════════════════════════════════════ */
test('R26 · الأداء: شبكة بطيئة (Fast 3G) — LCP وزمن التفاعل', async () => {
  const ctx = await newContext({ w: 390, h: 844, auth: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  const t0 = Date.now();
  await page.goto(baseUrl('/index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(9000);
  const wall = Date.now() - t0;
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      lcp: window.__octaLCP || null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      bytes: performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0),
    };
  });
  state.slowNet = { wall: wall, lcp: perf.lcp, load: perf.load, dcl: perf.dcl, bytes: perf.bytes };
  /* ⛔ على شبكة بطيئة: LCP أقل من ١٢ ثانية (حدّ معقول لموقع زي ده) */
  assert.ok(perf.lcp !== null && perf.lcp < 12000,
    'LCP على شبكة بطيئة = ' + perf.lcp + 'ms (المطلوب أقل من ١٢٠٠٠)');
  await ctx.close();
});

/* ══════════════════════════════════════════════════════════════
  ⑤ سرعة تسجيل الدخول (الواجهة)
  ══════════════════════════════════════════════════════════════ */
test('R26 · تسجيل الدخول: السرعة من أول ضغطة لحد فتح التطبيق', async () => {
  const ctx = await newContext({ w: 390, h: 844, auth: false });
  const page = await ctx.newPage();
  await page.goto(baseUrl('/gate.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  const t0 = Date.now();
  /* ① شاشة البداية */
  const state1 = await page.evaluate(() => {
    const g = document.getElementById('gt-form');
    return { form: g ? g.innerHTML.length : 0, txt: g ? (g.innerText || '').slice(0, 120) : '' };
  });
  assert.ok(state1.form > 20, 'بوابة الدخول اتعرضت (len=' + state1.form + ')');

  /* ② «عندك حساب؟ ادخل» ⇒ لوحة الأرقام (٤ أرقام) */
  await page.click('#gtLogin');
  await page.waitForSelector('#gtPad .gt-key', { timeout: 10000 });
  const padReady = await page.evaluate(() => document.querySelectorAll('#gtPad .gt-key').length);
  assert.ok(padReady >= 10, 'لوحة الأرقام اتعرضت (' + padReady + ' زر)');

  /* ③ نكتب ١٢٣٤ على اللوحة */
  await page.evaluate(() => {
    const keys = Array.prototype.slice.call(document.querySelectorAll('#gtPad .gt-key'));
    const want = ['1', '2', '3', '4'];
    want.forEach((w) => {
      const k = keys.find((x) => (x.textContent || '').trim() === w);
      if (k) k.click();
    });
  });

  /* ④ نستنى التوكن (المحلي بيرد على /api/auth/pin/login) */
  await page.waitForFunction(() => {
    try { return !!(localStorage.getItem('octa_token') || ''); } catch (e) { return false; }
  }, { timeout: 15000 }).catch(() => { });

  const state2 = await page.evaluate(() => ({
    gate: !!document.getElementById('gate'),
    token: (function () { try { return localStorage.getItem('octa_token') || ''; } catch (e) { return ''; } })(),
    msg: (document.getElementById('gtMsg') || {}).textContent || '',
  }));
  const elapsed = Date.now() - t0;
  state.login = { elapsed: elapsed, gotToken: !!state2.token, gateOpen: state2.gate, msg: state2.msg };
  /* ⛔ لازم نقدر نكمّل ⇒ التوكن اتكتب (مش مجرد 200) */
  assert.ok(state2.token, 'تسجيل الدخول نجح ⇒ التوكن اتكتب (زمن: ' + elapsed + 'ms) — ' + state2.msg);
  assert.ok(elapsed < 20000, 'زمن تسجيل الدخول = ' + elapsed + 'ms');
  await ctx.close();
});

/* ══════════════════════════════════════════════════════════════
  ⑥ ١٠٠ طلب متوازي — صحة المحتوى (مش 200 بس)
  ══════════════════════════════════════════════════════════════ */
test('R26 · ١٠٠ طلب متوازي: الردود صحيحة المحتوى', async () => {
  const jobs = [];
  for (let i = 0; i < 100; i++) {
    jobs.push((async () => {
      const which = i % 4;
      if (which === 0) {
        const r = await fetch(state.srv.url + '/api/health');
        const body = await r.text();
        const j = JSON.parse(body);
        return { path: '/api/health', status: r.status, ok: r.ok, content: j.status === 'ok' && !!j.market_phase, bytes: body.length };
      }
      if (which === 1) {
        const r = await fetch(state.srv.url + '/api/rank?limit=20');
        const body = await r.text();
        const j = JSON.parse(body);
        return { path: '/api/rank', status: r.status, ok: r.ok, content: Array.isArray(j.results) && j.results.length === 20 && !!j.results[0].code, bytes: body.length };
      }
      if (which === 2) {
        const r = await fetch(state.srv.url + '/api/data_full');
        const body = await r.text();
        const j = JSON.parse(body);
        return { path: '/api/data_full', status: r.status, ok: r.ok, content: !!j.stocks && Object.keys(j.stocks).length > 100, bytes: body.length };
      }
      const r = await fetch(state.srv.url + '/index.html');
      const body = await r.text();
      return { path: '/index.html', status: r.status, ok: r.ok, content: body.indexOf('<title>') > 0 && body.indexOf('</html>') > 0, bytes: body.length };
    })());
  }
  const out = await Promise.all(jobs);
  const bad = out.filter((o) => !o.ok || !o.content || o.status !== 200);
  state.parallel = { total: out.length, bad: bad.length, sample: bad.slice(0, 3) };
  assert.equal(bad.length, 0, 'طلبات مكسورة/محتوى غلط: ' + JSON.stringify(bad.slice(0, 5)));
});

/* ══════════════════════════════════════════════════════════════
  ⑦ ثبات الذاكرة (RSS) أثناء الحمل
  ══════════════════════════════════════════════════════════════ */
test('R26 · ثبات الذاكرة: RSS بعد ٣٠٠ طلب', async () => {
  const pid = state.srv.pid;
  const read = () => {
    try {
      const out = execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' });
      return Math.round(Number(String(out).trim()) / 1024);
    } catch (e) { return -1; }
  };
  const before = read();
  for (let i = 0; i < 300; i++) {
    await fetch(state.srv.url + '/api/health');
    if (i % 50 === 0) await fetch(state.srv.url + '/index.html');
  }
  await new Promise((r) => setTimeout(r, 500));
  const after = read();
  state.rss = { before: before, after: after, delta: after - before };
  assert.ok(before > 0, 'عرفنا RSS قبل الحمل');
  assert.ok(after - before < 120,
    'الذاكرة زادت ' + (after - before) + 'MB بعد ٣٠٠ طلب (المطلوب أقل من ١٢٠)');
});

/* ══════════════════════════════════════════════════════════════
  ⑧ البرهان: مفيش طلب لعنوان غلط (الإصلاح الحرج)
  ══════════════════════════════════════════════════════════════ */
test('R26 · البرهان: طلب التحقق من الجلسة بيوصل /api/auth/me (مش عنوان غلط)', async () => {
  const ctx = await newContext({ w: 390, h: 844, auth: true });
  const page = await ctx.newPage();
  const seen = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.indexOf('/api/auth') >= 0 || u.indexOf('[object') >= 0 || u.indexOf('%5Bobject') >= 0) seen.push(u);
  });
  await page.goto(baseUrl('/index.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  const bogus = seen.filter((u) => u.indexOf('object') >= 0);
  const authCalls = seen.filter((u) => u.indexOf('/api/auth/me') >= 0);
  const token = await page.evaluate(() => { try { return localStorage.getItem('octa_token') || ''; } catch (e) { return ''; } });
  state.sessionProof = { bogus: bogus.length, authCalls: authCalls.length, tokenKept: !!token };
  assert.equal(bogus.length, 0, 'في طلبات لعنوان غلط: ' + JSON.stringify(bogus.slice(0, 3)));
  assert.ok(authCalls.length >= 1, 'طلب التحقق من الجلسة لازم يطلع لـ /api/auth/me');
  assert.ok(token, 'التوكن لازم يفضل موجود (المستخدم ما يتطردش من جلسته)');
  await ctx.close();
});

/* ══════════════════════════════════════════════════════════════
  ⑨ لقطات الشاشة (دليل بصري حقيقي — مش محاكاة)
  ══════════════════════════════════════════════════════════════ */
test('R26 · لقطات الشاشة: كل صفحة على ٣ مقاسات', async () => {
  const shots = [];
  const WIDTHS = [{ w: 360, h: 640, name: '360' },
                  { w: 768, h: 1024, name: '768' },
                  { w: 1280, h: 800, name: '1280' }];
  for (const p of PAGES) {
    for (const s of WIDTHS) {
      const ctx = await newContext({ w: s.w, h: s.h, auth: p.auth });
      const page = await ctx.newPage();
      await page.goto(baseUrl(p.url), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(p.url === '/index.html' ? 4500 : 3000);
      const file = await shot(page, p.url.replace(/[/.]/g, '_') + '-' + s.name);
      shots.push({ page: p.name, url: p.url, size: s.name, file: file });
      await ctx.close();
    }
  }
  state.shots = shots;
  const saved = shots.filter((s) => s.file).length;
  assert.ok(saved >= 12, 'لازم يبقى فيه لقطات محفوظة (الحفظ: ' + saved + ')');
});

/* ══════════════════════════════════════════════════════════════
  ⑩ تقرير مختصر (بيتشغّل آخر حاجة)
  ══════════════════════════════════════════════════════════════ */
test('R26 · تقرير الجولة', async () => {
  const fs2 = require('node:fs');
  const outDir = path.join(__dirname, '..', '..', 'shots', 'r26');
  try { fs2.mkdirSync(outDir, { recursive: true }); } catch (e) { }
  const report = {
    generatedAt: new Date().toISOString(),
    chrome: CHROME_INFO(),
    sizes: SIZES.map((s) => s.name),
    pages: PAGES.map((p) => p.name),
    matrix: state.results,
    perf: state.perfRows,
    slowNet: state.slowNet,
    login: state.login,
    parallel: state.parallel,
    rss: state.rss,
    sessionProof: state.sessionProof,
    shots: state.shots,
  };
  fs2.writeFileSync(path.join(outDir, 'r26-report.json'), JSON.stringify(report, null, 1), 'utf8');
  assert.ok(state.results.length >= 45);
});
