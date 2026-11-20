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
  const out = { width: vw, scrollWidth: de.scrollWidth, overflow: 0, clipped: 0,
    smallTargets: 0, checked: 0, overflowList: [], smallList: [] };
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (!el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    out.checked++;
    /* ⭐⭐⭐ تعريف التمرير ⭐⭐⭐
       ⛔ عنصر **بره** الشاشة بالكامل (left >= vw ⭐) ⭐ = شريط جانبي مخفي ⭐
          (لوحة الشاشات الجانبية ⭐) ⭐ ⇒ ⛔ مش تمرير ⭐.
       ✅ التمرير = عنصر **متداخل مع الشاشة** ⭐ وبيبرز منها ⭐
          (r.left < vw && r.right > vw ⭐) ⭐ أو بيزاي على الشمال ⭐. */
    /* ⭐ عنصر جوّه حاوية بتتمرير أفقي ⭐ ⇒ ⛔ مش تمرير ⭐ */
    let inScroller = false;
    try {
      let pn = el.parentElement;
      for (let k = 0; k < 6 && pn; k++, pn = pn.parentElement) {
        const ov = getComputedStyle(pn).overflowX;
        if (ov === 'auto' || ov === 'scroll') { inScroller = true; break; }
      }
    } catch (e) { }
    const sticksOut = !inScroller && ((r.left < vw && r.right > vw + 2) || r.left < -2);
    if (sticksOut) {
      out.overflow++;
      if (out.overflowList.length < 8) {
        out.overflowList.push({
          tag: el.tagName, id: el.id || '',
          cls: String(el.className || '').slice(0, 40),
          w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right),
        });
      }
    }
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') {
      if (r.height > 0 && r.height < 40 && r.width > 0 && r.width < 40) {
        out.smallTargets++;
        if (out.smallList.length < 8) {
          out.smallList.push({
            tag: el.tagName, id: el.id || '',
            cls: String(el.className || '').slice(0, 40),
            w: Math.round(r.width), h: Math.round(r.height),
            text: String(el.textContent || '').trim().slice(0, 24),
          });
        }
      }
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
  /* ⭐ سجل ردود الـAPI ⭐ (دليل ⭐ — بيكشف أي طلب رجّع 401/503 ⭐) */
  const apiLog = [];
  page.on('response', async (r) => {
    if (r.url().indexOf('/api/') < 0) return;
    let body = '';
    try { body = (await r.text()).slice(0, 200); } catch (e) { body = ''; }
    apiLog.push({ status: r.status(), path: r.url().replace(BASE, ''), body: body });
  });

  console.log('═'.repeat(74));
  console.log('🌐 R28 · رحلة المتصفح الحقيقي — ' + BASE);
  console.log('═'.repeat(74));

  /* ── ① الدخول (لو اتعطى حساب صناعي) ─────────────────────────────── */
  /* 📌 البوابة **مش** نموذج إيميل/باسورد ⭐
     ⇒ الشاشة الأولى: «عندك حساب؟ ادخل» ⭐
     ⇒ بعدها: **لوحة أرقام** (٤ أرقام) ⭐ ⇒ بتتبعت كـ{pin, device} ⭐
     ⇒ ولو الجهاز جديد ⭐ ⇒ يطلب كود ⭐ ⇒ بعد الكود ⇒ «اختار ٤ أرقام» ⭐.
     ⛔ أي أداة بتتوقّع input نصي ⭐ ⇒ بتسجّل دخولها **غلط** ⭐. */
  const PREVIEW_KEY = process.env.PREVIEW_CONSOLE_KEY || '';
  async function mailboxCode(mail) {
    if (!PREVIEW_KEY) return '';
    try {
      const r = await fetch(BASE + '/api/preview/mailbox?email=' +
        encodeURIComponent(mail), { headers: { 'X-Preview-Key': PREVIEW_KEY } });
      if (!r.ok) return '';
      const j = await r.json();
      return String(j.code || '');
    } catch (e) { return ''; }
  }
  /* ⭐ ضغط أرقام لوحة البوابة ⭐ */
  async function typePad(digits) {
    /* ⭐ اللوحة بتعيد الرسم ⭐ وأزرارها بتتقفل أثناء الطلب ⭐
       ⇒ ⛔ ضغطة واحدة ممكن تفشل ⭐ ⇒ نعيد المحاولة ⭐ */
    for (const d of String(digits).split('')) {
      let hit = false;
      for (let t = 0; t < 12 && !hit; t++) {
        const k = await page.$(`.gt-key[data-k="${d}"]`);
        if (k) {
          try { await k.click({ timeout: 1200 }); hit = true; }
          catch (e) { await page.waitForTimeout(250); }
        } else {
          await page.waitForTimeout(250);
        }
      }
      await page.waitForTimeout(160);
    }
    return true;
  }
  /* ⭐ انتظار محدِّد ⭐ —/poll ⭐ (الانتظار الثابت بيسبّ أحياناً ⭐) */
  async function waitFor(sel, ms) {
    const limit = ms || 15000;
    const step = 250;
    for (let waited = 0; waited < limit; waited += step) {
      const el = await page.$(sel);
      if (el) return true;
      await page.waitForTimeout(step);
    }
    return false;
  }
  /* ⭐ البوابة بتعمل تحويل ⭐ ⇒ ننتظر الـURL يخرج من gate.html ⭐ */
  async function waitLeaveGate(ms) {
    const limit = ms || 20000;
    for (let waited = 0; waited < limit; waited += 300) {
      if (page.url().indexOf('gate') === -1) return true;
      await page.waitForTimeout(300);
    }
    return false;
  }

  const gate = { pad: false, codeAsked: false, codeFilled: false, newpin: false, done: false };
  const REGISTER = args.includes('--register');
  if (EMAIL && PIN) {
    await page.goto(BASE + '/gate.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1400);
    /* ⭐⭐⭐ آلة حالات ⭐⭐⭐ — البوابة فيها شاشات بتتبدّل ⭐
       (تسجيل ⭐ ⇒ كود ⭐ ⇒ أرقام ⭐ ⇒ تم ⭐ ⇒ دخول ⭐ ⇒ التطبيق ⭐)
       ⇒ ⛔ الانتظار الثابت بيفوّت ⭐ ⇒ نبص على الشاشة الحالية ⭐. */
    /* ⭐ ضغطة آمنة ⭐ — البوابة بتعيد رسم الشاشة ⭐ ⇒ العنصر ممكن يdetach ⭐ */
    const safeClick = async (sel) => {
      try { await page.click(sel, { timeout: 3000 }); return true; }
      catch (e) { return false; }
    };
    const safeFill = async (sel, val) => {
      try { await page.fill(sel, val, { timeout: 3000 }); return true; }
      catch (e) { return false; }
    };
    /* ⭐ البوابة بتعمل تحويل ⭐ ⇒ سياق التنفيذ ممكن يتمار ⭐ ⇒ ن catching ⭐ */
    const has = async (sel) => {
      try { return !!(await page.$(sel)); } catch (e) { return false; }
    };
    const screen = async () => ({
      reg: await has('#gtReg'),
      code: await has('#gtCodeIn'),
      npin: await has('#gtNpBack'),
      now: await has('#gtNow'),
      pad: await has('#gtPad'),
    });
    const deadline = Date.now() + 90000;
    let typed = 0;
    let codeValue = '';
    let gateUrl0 = '';
    while (Date.now() < deadline) {
      if (page.url().indexOf('gate') === -1) { gate.done = true; break; }
      const s = await screen();
      if (s.now) { await safeClick('#gtNow'); await page.waitForTimeout(700); continue; }
      if (s.code) {
        gate.codeAsked = true;
        if (!gate.codeFilled) {
          const code = await mailboxCode(EMAIL);
          if (code) {
            codeValue = code;
            await safeFill('#gtCodeIn', code);
            gate.codeFilled = true;
          }
        }
        /* ⭐⭐⭐ لو الحقل ما اشتغلش ⭐ ⇒ نكتب الكود على اللوحة ⭐
           ⛔ مهم ⭐: لازم نتأكد إننا **لسه على شاشة الكود** ⭐
              ⇒ غير كده ⭐ نكتب الأرقام على **لوحة الباسورد** ⭐
              ⇒ ⛔ والباسورد بيطلع غلط ⭐. */
        if (gate.codeFilled && typed === 0) {
          typed = 1;
          await page.waitForTimeout(1500);
          if (await has('#gtCodeIn')) { await typePad(codeValue); }
        }
        await page.waitForTimeout(500);
        continue;
      }
      if (s.npin) {
        gate.newpin = true;
        if (typed !== 2) { typed = 2; gate.pad = await typePad(PIN); }
        await page.waitForTimeout(700);
        continue;
      }
      if (s.pad) {
        /* ⭐ شاشة الدخول ⭐ (pad ⭐ من غير شاشة الكود ⭐)
           ⛔ لازم نضغط ⭐ — حتى لو ضغطنا قبل ⭐ (شاشة الباسورد ⭐) ⭐
              ⇒ ⛔ short-circuit ⭐ كان بيمنع ضغطة الدخول ⭐. */
        if (typed !== 3) { typed = 3; await typePad(PIN); gate.pad = true; }
        await page.waitForTimeout(800);
        continue;
      }
      if (s.reg && REGISTER) {
        /* ⭐ الشاشة الأولى ⭐ ⇒ «إعمل حساب جديد» ⭐ */
        await safeClick('#gtReg');
        await page.waitForTimeout(700);
        if (await has('#gtMail')) {
          await safeFill('#gtName', 'رحلة R28');
          await safeFill('#gtMail', EMAIL);
          await safeClick('#gtDo');
        }
        await page.waitForTimeout(1200);
        continue;
      }
      if (s.reg && !REGISTER) {
        await safeClick('#gtLogin');
        await page.waitForTimeout(800);
        continue;
      }
      await page.waitForTimeout(500);
    }
    /* ⭐⛔ التحويل ممكن يتأخر ⭐ ⇒ ننتظره قبل الحكم ⭐ */
    if (gateUrl0.indexOf('gate') !== -1) await waitLeaveGate(15000);
    const gateUrl = page.url().replace(BASE, '');
    gate.done = gateUrl.indexOf('gate') === -1;
    rec('gate · الدخول (لوحة الأرقام ⭐ ثم التطبيق ⭐)',
      (REGISTER ? (gate.codeFilled && gate.pad) : gate.pad) && gate.done,
      { url: gateUrl, registered: REGISTER, codeAsked: gate.codeAsked,
        codeFilled: gate.codeFilled, newpinAsked: gate.newpin });
  }

  /* ── ② أداة الذهب ───────────────────────────────────────────────── */
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  const gold = await page.evaluate(async () => {
    const out = { open: false, tabs: [], fullscreenBtn: false, picker: false,
      shotBtn: false, chart: false, supportResistance: false, events: false,
      errorShown: false, body: '' };
    try {
      /* ⭐ اسم الدخول ⭐: openGoldIntel ⭐ (السرد ⭐) · openGoldSavings ⭐ (الادخار ⭐) */
      var _gold = window.openGoldIntel || window.openGold;
      if (typeof _gold === 'function') { _gold(); out.open = true; }
    } catch (e) { out.openErr = String(e).slice(0, 120); }
    await new Promise((r) => setTimeout(r, 6000));
    const modal = document.getElementById('octa-gold-modal')
      || document.querySelector('.gmodal');
    if (!modal) return out;
    /* ⭐ الشارت/البيانات بتيجي بعدين ⭐ ⇒ ننتظرها ⭐ */
    for (let w = 0; w < 12; w++) {
      if (modal.querySelector('iframe, .gchart, #gmv-chart')) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
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
    try {
      var _g2 = window.openGoldIntel || window.openGold;
      if (typeof _g2 === 'function') _g2();
    } catch (e) { /* */ }
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

  /* ⭐ الرجوع للرئيسية ⭐ (آخر خطوة في رحلة المستخدم ⭐) */
  const home = await page.evaluate(async () => {
    const out = { ok: false, hash: location.hash };
    try {
      if (typeof window.switchPage === 'function') window.switchPage('home');
      else if (typeof OS_NAV !== 'undefined' && OS_NAV.back) OS_NAV.back();
      else return out;
      await new Promise((r) => setTimeout(r, 2000));
      out.ok = true;
      out.hash = location.hash;
      out.homeVisible = !!document.querySelector('#home, #page-home, .home, [data-page=home]');
    } catch (e) { out.err = String(e).slice(0, 80); }
    return out;
  });
  rec('nav · الرجوع للرئيسية', home.ok, home);
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
    gate: gate,
    gold: gold,
    nav: nav,
    matrix: matrix,
    console_errors: consoleErrors.slice(0, 20),
    api_log: apiLog.slice(0, 40),
    results: results,
    passed: results.filter((r) => r.ok).length,
    total: results.length,
  };
  fs.writeFileSync(path.join(OUT, 'browser-journey.json'),
    JSON.stringify(payload, null, 2), 'utf8');
  console.log('─'.repeat(74));
  console.log(`النتيجة: ${payload.passed}/${payload.total}`);
  console.log('📄 ' + path.join(OUT, 'browser-journey.json'));
  await browser.close();
})().catch((e) => {
  console.error('⛔ فشل:', e && e.message ? e.message : e);
  process.exit(1);
});
