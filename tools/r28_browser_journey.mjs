/* ══════════════════════════════════════════════════════════════════════
   🌐 R28 · رحلة المتصفح الحقيقي (Chromium) ⭐ — أداة دائمة في المستودع ⭐
   ───────────────────────────────────────────────────────────────────────
   📌 المطلوب (R28 · FINDING-04 ⭐): بند زي `AC-28-3` ⭐
      «يحتاج رحلة متصفح لأداة الذهب تشمل الفترات وملء الشاشة والتكبير
       والدعم والمقاومة والأحداث وفشل المصدر» ⭐
      ⇒ ⭐ ⇒ لازم **دليل متصفح حقيقي** ⭐ (مش محاكاة JS ⭐).

   📌 ما بتغطيه الأداة ⭐:
      ① أداة الذهب ⭐: التبويبات ⭐ · ملء الشاشة ⭐ · التكبير ⭐
         · الدعم والمقاومة ⭐ · الأحداث ⭐ · **فشل المصدر** ⭐.
      ② رحلة التنقل ⭐: الرئيسية ⭐ ⇒ الأسهم ⭐ ⇒ الذهب ⭐ ⇒ الفرص ⭐
         ⇒ المقارنة ⭐ ⇒ رجوع ⭐.
      ③ مصفوفة الاستجابة ⭐: ٩ عروض ⭐ (320 ⭐ … 1440 ⭐) ⭐:
         التمرير الأفقي ⭐ · التداخل ⭐ · القص ⭐ · أهداف اللمس ⭐.
      ④ لقطات ⭐ (screenshots ⭐) لكل حالة ⭐.

   📌 التشغيل ⭐:
      node tools/r28_browser_journey.mjs --base <رابط المعاينة> --out <مجلد>
   📌 المتطلبات ⭐: `playwright-core` ⭐ + Chromium ⭐
      (npm i --no-save playwright-core ⭐ + `npx playwright install chromium` ⭐).
   ⛔ مافيش سر ⭐ · ⛔ مافيش بيانات عملاء ⭐ (الحساب **صناعي** ⭐).
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
function argOf(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const BASE = argOf('base', 'https://octa-preview.ahmed3zz2020.workers.dev');
const OUT = argOf('out', '/tmp/r28-journey');
const EMAIL = argOf('email', '');
const PIN = argOf('pin', '');
const HEADED = args.includes('--headed');

fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = [320, 360, 390, 414, 768, 899, 900, 1024, 1280, 1440];
const results = [];
function rec(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail === undefined ? null : detail });
  console.log((ok ? '  [PASS] ' : '  [FAIL] ') + name +
    (detail !== undefined && detail !== null ? '  ' + JSON.stringify(detail).slice(0, 220) : ''));
  return ok;
}

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch (e) {
  console.error('⛔ playwright-core مش متاح ⭐ — npm i --no-save playwright-core');
  process.exit(2);
}

const EXEC = process.env.CHROMIUM_PATH ||
  ['/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
    '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome']
    .find((p) => fs.existsSync(p));

/* ⭐ قياس الاستجابة في المتصفح ⭐ */
const OVERFLOW_PROBE = `() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const out = { width: vw, scrollWidth: de.scrollWidth, overflow: 0, clipped: 0, smallTargets: 0, checked: 0 };
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (!el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    out.checked++;
    if (r.right > vw + 2 || r.left < -2) out.overflow++;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') {
      if (r.height > 0 && r.height < 40 && r.width > 0 && r.width < 40) out.smallTargets++;
    }
  }
  return out;
}`;

(async () => {
  const browser = await chromium.launch({
    executablePath: EXEC || undefined,
    headless: !HEADED,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(String(m.text()).slice(0, 160)); });

  console.log('═'.repeat(74));
  console.log('🌐 R28 · رحلة المتصفح الحقيقي — ' + BASE);
  console.log('═'.repeat(74));

  /* ── ① الدخول (لو اتعطى حساب صناعي) ─────────────────────────────── */
  if (EMAIL && PIN) {
    await page.goto(BASE + '/gate.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    const emailSel = '#gtEmail, input[name=email], input[type=email]';
    const pinSel = '#gtPin, input[name=pin], input[inputmode=numeric]';
    const hasEmail = await page.$(emailSel);
    if (hasEmail) {
      await page.fill(emailSel, EMAIL);
      await page.fill(pinSel, PIN);
      const btn = await page.$('button[type=submit], #gtLogin, .gt-login');
      if (btn) await btn.click();
      await page.waitForTimeout(3500);
    }
    rec('gate · تسجيل الدخول بالحساب الصناعي', page.url().indexOf('gate') === -1,
      { url: page.url().replace(BASE, '') });
  }

  /* ── ② أداة الذهب ───────────────────────────────────────────────── */
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  const gold = await page.evaluate(async () => {
    const out = { open: false, tabs: [], fullscreenBtn: false, picker: false,
      shotBtn: false, chart: false, supportResistance: false, events: false,
      errorShown: false, body: '' };
    try {
      if (typeof window.openGold === 'function') { window.openGold(); out.open = true; }
    } catch (e) { out.openErr = String(e).slice(0, 120); }
    await new Promise((r) => setTimeout(r, 2500));
    const modal = document.getElementById('octa-gold-modal')
      || document.querySelector('.gmodal');
    if (!modal) return out;
    out.tabs = Array.from(modal.querySelectorAll('#gtabs .gtab')).map((b) => b.textContent.trim());
    out.fullscreenBtn = !!modal.querySelector('#gfs-btn');
    out.picker = !!modal.querySelector('#gpick');
    out.shotBtn = !!modal.querySelector('#gshot button, #gshot');
    out.chart = !!modal.querySelector('iframe, .gchart, #gmv-chart');
    const txt = modal.innerText || '';
    out.body = txt.slice(0, 900);
    out.supportResistance = /دعم|مقاومة|support|resistance/i.test(txt);
    out.events = /أحداث|حدث|events/i.test(txt);
    out.errorShown = /تعذر|خطأ|مش متاح|فشل|error/i.test(txt);
    return out;
  });
  rec('gold · المودال اتفتح', gold.open, { tabs: gold.tabs });
  rec('gold · التبويبات (السرد/الادخار)', (gold.tabs || []).length >= 2, { tabs: gold.tabs });
  rec('gold · زر ملء الشاشة موجود', gold.fullscreenBtn);
  rec('gold · أداة الاختيار (التكبير/الرمز) موجودة', gold.picker);
  rec('gold · زر اللقطة موجود', gold.shotBtn);
  rec('gold · الشارت موجود', gold.chart);
  rec('gold · الدعم والمقاومة ظاهرين', gold.supportResistance);
  rec('gold · الأحداث ظاهرة', gold.events);
  await page.screenshot({ path: path.join(OUT, 'gold-deep.png'), fullPage: false });

  /* ⭐ التبويب الثاني (الادخار) ⭐ */
  const tab2 = await page.evaluate(async () => {
    const modal = document.querySelector('.gmodal');
    if (!modal) return { ok: false };
    const btn = Array.from(modal.querySelectorAll('#gtabs .gtab'))
      .find((b) => /ادخار/i.test(b.textContent));
    if (!btn) return { ok: false };
    btn.click();
    await new Promise((r) => setTimeout(r, 2500));
    const body = modal.querySelector('.gbody');
    return { ok: true, text: (body ? body.innerText : '').slice(0, 400) };
  });
  rec('gold · تبويب الادخار اشتغل', tab2.ok && String(tab2.text || '').length > 20);
  await page.screenshot({ path: path.join(OUT, 'gold-savings.png'), fullPage: false });

  /* ⭐ فشل المصدر (فصل الـAPI) ⭐ */
  const failure = await page.evaluate(async () => {
    const modal = document.querySelector('.gmodal');
    if (modal) { const c = modal.querySelector('[data-close]'); if (c) c.click(); }
    await new Promise((r) => setTimeout(r, 400));
    return true;
  });
  void failure;
  await page.route('**/api/gold/**', (route) => route.abort('failed'));
  await page.route('**/api/gold*', (route) => route.abort('failed'));
  const failCase = await page.evaluate(async () => {
    try { if (typeof window.openGold === 'function') window.openGold(); } catch (e) { /* */ }
    await new Promise((r) => setTimeout(r, 3500));
    const modal = document.querySelector('.gmodal');
    if (!modal) return { shown: false, text: '' };
    const txt = modal.innerText || '';
    return { shown: true, hasError: /تعذر|خطأ|مش متاح|فشل|error|retry|إعادة/i.test(txt),
      text: txt.slice(0, 400) };
  });
  rec('gold · فشل المصدر ⇒ رسالة خطأ واضحة (مش نجاح وهمي)',
    failCase.shown && failCase.hasError, { hasError: failCase.hasError });
  await page.screenshot({ path: path.join(OUT, 'gold-source-failure.png'), fullPage: false });
  await page.unroute('**/api/gold/**');
  await page.unroute('**/api/gold*');

  /* ── ③ رحلة التنقل ──────────────────────────────────────────────── */
  const nav = await page.evaluate(async () => {
    const out = { steps: [], ok: true };
    const targets = [
      { key: 'الأسهم', re: /أسهم|الأسهم/ },
      { key: 'الفرص', re: /فرص|الفرص/ },
      { key: 'المقارنة', re: /مقارن|المقارن/ },
    ];
    for (const t of targets) {
      const el = Array.from(document.querySelectorAll('a,button,[role=tab],[data-nav]'))
        .find((e) => t.re.test((e.textContent || '').trim()));
      if (!el) { out.steps.push({ step: t.key, found: false }); out.ok = false; continue; }
      try { el.click(); } catch (e) { /* */ }
      await new Promise((r) => setTimeout(r, 1800));
      out.steps.push({ step: t.key, found: true, hash: location.hash || location.pathname,
        title: (document.title || '').slice(0, 60) });
    }
    return out;
  });
  rec('nav · رحلة التنقل (أسهم ⭐ فرص ⭐ مقارنة ⭐)',
    nav.ok && nav.steps.every((s) => s.found), { steps: nav.steps });
  await page.screenshot({ path: path.join(OUT, 'nav-end.png'), fullPage: false });

  /* ── ④ مصفوفة الاستجابة ─────────────────────────────────────────── */
  const matrix = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(700);
    const m = await page.evaluate(new Function('return ' + OVERFLOW_PROBE)());
    matrix.push(Object.assign({ width: w }, m));
    if ([360, 390, 900, 1280].indexOf(w) >= 0) {
      await page.screenshot({ path: path.join(OUT, 'w' + w + '.png'), fullPage: false });
    }
  }
  const overflowing = matrix.filter((m) => m.overflow > 0);
  rec('responsive · مافيش تمرير أفقي مقصود في ١٠ عروض',
    overflowing.length === 0, { overflowing: overflowing.map((m) => m.width) });
  rec('responsive · مافيش قص أفقي',
    matrix.every((m) => m.scrollWidth <= m.width + 2),
    { widths: matrix.map((m) => ({ w: m.width, sw: m.scrollWidth })) });
  const small = matrix.filter((m) => m.smallTargets > 0);
  rec('responsive · أهداف اللمس (≥40px) سليمة في كل عرض',
    small.length === 0, { offenders: small.map((m) => ({ w: m.width, n: m.smallTargets })) });

  const payload = {
    base: BASE,
    at: new Date().toISOString(),
    gold: gold,
    nav: nav,
    matrix: matrix,
    console_errors: consoleErrors.slice(0, 20),
    results: results,
    passed: results.filter((r) => r.ok).length,
    total: results.length,
  };
  fs.writeFileSync(path.join(OUT, 'browser-journey.json'),
    JSON.stringify(payload, null, 2), 'utf8');
  console.log('─'.repeat(74));
  console.log('النتيجة: %d/%d' % (payload.passed, payload.total));
  console.log('📄 ' + path.join(OUT, 'browser-journey.json'));
  await browser.close();
})().catch((e) => {
  console.error('⛔ فشل:', e && e.message ? e.message : e);
  process.exit(1);
});
