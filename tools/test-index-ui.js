/* 🧪 اختبار واجهة «ذكاء المؤشرات» — بيشتغل على المعاينة.
   ⛔ الغرض: نمنع رجوع نفس الأخطاء:
      ① ReferenceError في تفاعل الرسم (كان H is not defined)
      ② أي كلمة إنجليزية/غريبة في نص ظاهر للمستخدم
      ③ أي خطأ جافاسكربت أو 429
   📌 التشغيل: node tools/test-index-ui.js
*/
const { chromium } = require('/usr/local/lib/node_modules/playwright');
const fs = require('fs');

const URL = process.env.IX_URL || 'https://octa-preview.ahmed3zz2020.workers.dev/';
const TOK = process.env.IX_TOKEN || (fs.existsSync('/tmp/tok.txt') ? fs.readFileSync('/tmp/tok.txt', 'utf8').trim() : '');

/* 📌 كلمات مسموحة (أسماء مؤشر/شركات/مصادر) — أي كلمة تانية بالإنجليزي = تسريب */
const ALLOW = new Set([
  'EGX', 'EGX30', 'EGX70', 'EGX100', 'EGX33', 'EWI', 'Shariah', 'CASE30', 'EGX_SHARIAH',
  'OCTA', 'TradingView', 'MEED', 'AmCham', 'Cairo24', 'Wikipedia', 'TAMAYUZ', 'Tamayuz',
  'FAIT', 'FAITA', 'CODE', 'com', 'eg', 'en', 'index', 'indices', 'overview', 'market',
  'note', 'version', 'official', 'education', 'accent', 'id', 'null', 'constituents',
  'calculation', 'concentration', 'eligibility', 'revision', 'weight', 'beta', 'earnings',
  'Weighted', 'Equally', 'Minority', 'Central', 'Bank', 'September', 'Share',
]);

const fails = [];
function check(cond, msg) {
  if (!cond) { fails.push(msg); console.log('   ❌', msg); }
  else console.log('   ✅', msg);
}

/* 📌 أي رمز سهم في البورصة المصرية (حروف كبيرة) — مسموح */
const TICKER = /^[A-Z][A-Z0-9]*(\.[A-Z]{1,4})*$/;
/* 📌 أشهر السنة بالإنجليزي (بتظهر في أسماء المصادر) */
const MONTHS = new Set(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Sep', 'Oct', 'Nov', 'Dec']);
/* 📌 مصطلحات ومصادر إنجليزية مقصودة */
const OK_WORDS = new Set(['RSI', 'OCTA', 'EWI', 'Shariah', 'TradingView', 'websocket', 'MEED',
  'AmCham', 'Cairo24', 'Wikipedia', 'The', 'Stock', 'Market', 'Egyptian', 'Exchange', 'Egypt',
  'rallies', 'after', 'disastrous', 'beginning', 'to', 'of', 'in', 'and', 'on', 'for', 'is', 'are',
  'Central', 'Bank', 'Minority', 'concentration', 'Weighted', 'Equally', 'September', 'earnings',
  'TAMAYUZ', 'Tamayuz', 'All', 'Share', 'EGX', 'EGX30', 'EGX70', 'EGX100', 'EGX33', 'FAIT', 'FAITA']);

/* 📌 يستخرج أي كلمة لاتينية من نص ظاهر (يستثني الرموز والمصادر) */
function latinWords(text) {
  const out = [];
  const re = /[A-Za-z][A-Za-z0-9._%-]*/g;
  let m;
  while ((m = re.exec(text))) {
    const w = m[0].replace(/[.,;:!?)]+$/, '');   /* 📌 نشيل علامات الوقف */
    if (!w) continue;
    if (ALLOW.has(w) || ALLOW.has(w.toUpperCase())) continue;
    if (OK_WORDS.has(w) || OK_WORDS.has(w.toUpperCase())) continue;
    if (MONTHS.has(w)) continue;
    if (TICKER.test(w)) continue;
    out.push(w);
  }
  return out;
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  if (TOK) await ctx.addInitScript((t) => { try { localStorage.setItem('octa_token', t); } catch (e) { } }, TOK);
  const p = await ctx.newPage();
  const errs = [], toos = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 180)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy/i.test(m.text())) toos.push(m.text().slice(0, 120)); });
  p.on('response', (r) => { if (r.status() === 429) toos.push('429 ' + r.url().slice(0, 80)); });

  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(8000);

  const INDICES = ['EGX30', 'EGX70', 'EGX100', 'EGX33'];
  for (const key of INDICES) {
    console.log(`\n=== ${key} ===`);
    const clicked = await p.evaluate((k) => {
      const label = k === 'EGX33' ? 'الشريعة' : k;
      const c = Array.from(document.querySelectorAll('.mini')).find((e) => (e.textContent || '').includes(label));
      if (!c) return false; c.click(); return true;
    }, key);
    check(clicked, `الكارت ${key} اتفتح`);

    await p.waitForTimeout(5000);
    const st = await p.evaluate(() => {
      const m = document.getElementById('ix-modal');
      if (!m) return { open: false };
      return {
        open: true,
        title: (m.querySelector('.ix-title') || {}).textContent || '',
        secs: m.querySelectorAll('.ix-sec').length,
        stats: m.querySelectorAll('.ix-stat').length,
        phases: m.querySelectorAll('.ix-phase').length,
        lessons: m.querySelectorAll('.ix-lesson').length,
        hasCons: !!m.querySelector('.ix-cons-q'),
        hasHelp: !!m.querySelector('.ix-mode-help'),
        axes: Array.from(m.querySelectorAll('#ix-chart .ix-axis')).map((t) => t.textContent),
      };
    });
    check(st.open, 'المودال مفتوح');
    check(st.secs >= 10, `الأقسام: ${st.secs}`);
    check(st.stats >= 8, `بطاقات الإحصاء: ${st.stats}`);
    check(st.hasHelp, 'فيه شرح لوضع العرض');
    check(st.hasCons, 'فيه بحث في المكونات');
    check(st.axes.some((a) => /\d{4}/.test(a)), `محور التاريخ فيه سنة: ${st.axes.slice(0, 2).join(' | ')}`);

    /* ① تفاعل الرسم — الحس (اللي كان بيطلع ReferenceError) */
    const box = await p.locator('#ix-chart').boundingBox();
    if (box) {
      await p.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
      await p.waitForTimeout(600);
      await p.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.4);
      await p.waitForTimeout(900);
      const tip = await p.evaluate(() => {
        const t = document.getElementById('ix-tip');
        const lbl = document.getElementById('ix-dot-label');
        return {
          tip: t ? t.textContent.replace(/\s+/g, ' ').trim() : '',
          tipOn: t ? getComputedStyle(t).opacity : '0',
          label: lbl ? (lbl.textContent || '').trim() : '',
          labelOn: lbl ? getComputedStyle(lbl).opacity : '0',
        };
      });
      check(/من بداية الفترة/.test(tip.tip), `التoltip فيه نسبة الفترة: ${tip.tip.slice(0, 70)}`);
      check(tip.tipOn !== '0', 'التoltip ظاهر');
      check(/%/.test(tip.label) && tip.labelOn !== '0', `النسبة مكتوبة على الرسم: ${tip.label}`);
    } else { check(false, 'الرسم موجود'); }

    /* ② كلمات غريبة في النص الظاهر */
    /* 📌 نفحص النصوص اللي إحنا اللي كتبناها بس
       ⇒ نستثني جدول المكونات (رموز أسهم) وروابط المصادر (أسماء صحف أجنبية) */
    const leaks = await p.evaluate(() => {
      const m = document.getElementById('ix-modal');
      if (!m) return '';
      const clone = m.cloneNode(true);
      clone.querySelectorAll('.ix-table, .ix-srcs, .ix-event-s, .ix-list, .ix-edu-src').forEach((e) => e.remove());
      return clone.innerText || '';
    });
    const bad = [...new Set(latinWords(leaks))];
    check(bad.length === 0, `مفيش كلمات إنجليزية في الواجهة${bad.length ? ': ' + bad.join(', ') : ''}`);

    /* ③ تبديل الأوضاع والفترة */
    await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.ix-mode')).find((x) => x.textContent.includes('نسبة البداية')); b && b.click(); });
    await p.waitForTimeout(2500);
    const modeOk = await p.evaluate(() => {
      const t = document.getElementById('ix-tip');
      return !!document.querySelector('.ix-mode.on');
    });
    check(modeOk, 'تبديل وضع العرض اشتغل');

    await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.ix-per')).find((x) => x.textContent.trim() === 'سنة'); b && b.click(); });
    await p.waitForTimeout(4500);
    const perOk = await p.evaluate(() => !!document.querySelector('.ix-per.on'));
    check(perOk, 'تبديل الفترة اشتغل');

    /* ④ البحث في المكونات (رسم الجدول بس + المؤشر مايقفزش) */
    await p.evaluate(() => { const q = document.getElementById('ix-cons-q'); if (q) { q.focus(); q.setSelectionRange(1, 1); } });
    await p.evaluate(() => { const q = document.getElementById('ix-cons-q'); if (q) { q.value = 'بنك'; q.dispatchEvent(new Event('input', { bubbles: true })); } });
    await p.waitForTimeout(900);
    const search = await p.evaluate(() => {
      const q = document.getElementById('ix-cons-q');
      const rows = document.querySelectorAll('#ix-modal .ix-table tbody tr').length;
      return { rows: rows, active: document.activeElement === q, val: q ? q.value : '' };
    });
    check(search.rows > 0, `البحث رجّع ${search.rows} سطر`);
    check(search.active, 'التركيز فضل في مربع البحث (مايقفزش)');

    /* ⑤ فلتر النتيجة — «الكل» لازم يتعلّم */
    const filt = await p.evaluate(() => {
      const all = document.querySelector('[data-cmin="all"]');
      const f50 = document.querySelector('[data-cmin="50"]');
      if (!all || !f50) return null;
      const before = all.classList.contains('on');
      f50.click();
      const mid = document.querySelector('[data-cmin="50"]').classList.contains('on');
      all.click();
      const after = document.querySelector('[data-cmin="all"]').classList.contains('on');
      return { before: before, mid: mid, after: after };
    });
    check(filt && filt.before && filt.mid && filt.after, 'فلتر «الكل» بيتعلّم ويتغيّر صح');

    /* ⑥ تغيير فترة مرتين بسرعة (سباق) + إغلاق أثناء التحميل (P0) */
    await p.evaluate(() => {
      const bs = Array.from(document.querySelectorAll('.ix-per'));
      const y = bs.find((x) => x.textContent.trim() === 'سنة');
      const m = bs.find((x) => x.textContent.trim() === 'شهر');
      if (y) y.click();
      setTimeout(() => { if (m) m.click(); }, 120);
    });
    await p.waitForTimeout(6000);
    const race = await p.evaluate(() => ({
      on: (document.querySelector('.ix-per.on') || {}).textContent,
      spin: !!document.getElementById('ix-spin'),
      empty: !!document.querySelector('.ix-chartsec .ix-empty'),
    }));
    check(!race.spin, 'مفيش سبينر معلّق');
    check(!race.empty, 'مفيش رسالة خطأ في الرسم');

    /* ⑦ إغلاق المودال أثناء التحميل (P0-1) */
    await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.ix-per')).find((x) => x.textContent.trim() === 'سنة'); if (b) b.click(); });
    await p.waitForTimeout(80);
    await p.evaluate(() => closeIndexIntel());
    await p.waitForTimeout(3500);
    const closed = await p.evaluate(() => ({ modal: !!document.getElementById('ix-modal') }));
    check(!closed.modal, 'المودال اتقفل');
    check(errs.length === 0, 'مفيش كراش بعد الإغلاق أثناء التحميل');

    await p.evaluate(() => closeIndexIntel());
    await p.waitForTimeout(700);
  }

  console.log('\n=== أخطاء الصفحة ===');
  check(errs.length === 0, `أخطاء JS: ${errs.length}${errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''}`);
  check(toos.length === 0, `أخطاء كونسول/429: ${toos.length}${toos.length ? ' → ' + toos.slice(0, 3).join(' | ') : ''}`);

  await b.close();
  console.log('\n' + (fails.length ? `❌ ${fails.length} فشل` : '✅ كل الاختبارات نجحت'));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
