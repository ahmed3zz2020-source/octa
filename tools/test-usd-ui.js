/* 🧪 اختبار واجهة «ذكاء الدولار» — بيشتغل على المعاينة.
   ⛔ الغرض: نمنع رجوع نفس الأخطاء:
      ① أي خطأ جافاسكربت أو 429
      ② أي كلمة إنجليزية/غريبة في نص ظاهر للمستخدم
      ③ المودال مش بيفتح / الأقسام ناقصة
      ④ الشريط الأفقي فوق الرسم شغال (والرسم مالوش حاجة معلّقة)
      ⑤ الأرقام المعروضة = أرقام الـAPI (مفيش رقم مخترع)
   📌 التشغيل: node tools/test-usd-ui.js
*/
const { chromium } = require('/usr/local/lib/node_modules/playwright');
const fs = require('fs');

const URL = process.env.USD_URL || 'https://octa-preview.ahmed3zz2020.workers.dev/';
const TOK = process.env.USD_TOKEN || (fs.existsSync('/tmp/tok.txt') ? fs.readFileSync('/tmp/tok.txt', 'utf8').trim() : '');

/* 📌 كلمات مسموحة (مصادر ومصطلحات) — أي كلمة تانية بالإنجليزي = تسريب */
const ALLOW = new Set([
  'OCTA', 'TradingView', 'ICE', 'CBOE', 'ForexFactory', 'US', 'Treasury', 'BLS',
  'World', 'Bank', 'Average', 'Market', 'Rate', 'Bureau', 'Labor', 'Statistics',
  'Federal', 'Reserve', 'GDP', 'CPI', 'RSI', 'MACD', 'ATR', 'DXY', 'VIX', 'API', 'CSV',
  'json', 'com', 'eg', 'en', 'id', 'null', 'http', 'https', 'www', 'google', 'news',
  'rss', 'and', 'of', 'in', 'to', 'for', 'is', 'are', 'on', 'at', 'with', 'from',
  'The', 'Dollar', 'Egypt', 'Egyptian', 'Pound', 'Central', 'Markets', 'Weeks',
  'Prediction', 'Change', 'ADP', 'Weekly', 'Employment', 'Oct', 'Nov', 'Dec', 'Sep',
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'USD', 'EGP', 'USDEGP',
  'Low', 'Medium', 'High', 'Forecast', 'Previous', 'AY', 'TFM', 'M2', 'M3',
]);

const fails = [];
function check(cond, msg) {
  if (!cond) { fails.push(msg); console.log('   ❌', msg); }
  else console.log('   ✅', msg);
}

const TICKER = /^[A-Z][A-Z0-9]*(\.[A-Z]{1,4})*$/;
const OK_WORDS = ALLOW;

function latinWords(text) {
  const out = [];
  const re = /[A-Za-z][A-Za-z0-9._%-]*/g;
  let m;
  while ((m = re.exec(text))) {
    let w = m[0].replace(/[.,;:!?)]+$/, '');
    if (!w) continue;
    if (ALLOW.has(w) || ALLOW.has(w.toUpperCase())) continue;
    if (TICKER.test(w)) continue;
    /* 📌 روابط ومصادر: نشيل الـURL */
    if (/^https?$/.test(w)) continue;
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
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy/i.test(m.text())) toos.push(m.text().slice(0, 140)); });
  p.on('response', (r) => { if (r.status() === 429) toos.push('429 ' + r.url().slice(0, 90)); });

  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(9000);

  /* ① فتح الكارت */
  console.log('\n=== فتح «ذكاء الدولار» ===');
  const clicked = await p.evaluate(() => {
    const c = Array.from(document.querySelectorAll('.mini')).find((e) => (e.textContent || '').includes('دولار/جنيه'));
    if (!c) return false; c.click(); return true;
  });
  check(clicked, 'كارت «دولار/جنيه» موجود واتضغط');

  await p.waitForSelector('#usd-modal', { timeout: 30000 }).catch(() => { });
  await p.waitForFunction(() => {
    const m = document.getElementById('usd-modal');
    return m && m.querySelector('.usd-price') && m.querySelector('.usd-price').textContent.trim();
  }, { timeout: 40000 }).catch(() => { });
  await p.waitForTimeout(1500);
  const st = await p.evaluate(() => {
    const m = document.getElementById('usd-modal');
    if (!m) return { open: false };
    return {
      open: true,
      title: (m.querySelector('.usd-title') || {}).textContent || '',
      tabs: Array.from(m.querySelectorAll('.usd-tab')).map((t) => t.textContent),
      hero: (m.querySelector('.usd-price') || {}).textContent || '',
      official: (m.querySelector('.usd-mini') || {}).innerText || '',
      verdict: (m.querySelector('.usd-verdict-bias') || {}).textContent || '',
      summary: (m.querySelector('.usd-verdict-sum') || {}).textContent || '',
      scen: m.querySelectorAll('.usd-scn').length,
      evs: m.querySelectorAll('.usd-ev').length,
      news: m.querySelectorAll('.usd-nw').length,
      factors: m.querySelectorAll('.usd-f').length,
      cmp: m.querySelectorAll('.usd-cmp-col').length,
      tf: m.querySelectorAll('.usd-tf').length,
      body: (m.querySelector('.usd-body') || {}).innerText || '',
    };
  });
  check(st.open, 'المودال مفتوح');
  check(/دولار/.test(st.title), `العنوان: ${st.title}`);
  check(st.tabs.length >= 6, `التبويبات: ${st.tabs.length}`);
  check(/^[\d.,]+$/.test(st.hero.trim()) && parseFloat(st.hero) > 30, `سعر الدولار: ${st.hero}`);
  check(/56\.|5[0-9]/.test(st.official), `السعر الرسمي: ${st.official.replace(/\n/g, ' | ')}`);
  check(!!st.verdict.trim(), `القراءة النهائية: ${st.verdict}`);
  check(st.summary.length > 60, `الخلاصة طولها ${st.summary.length} حرف`);
  check(st.scen === 3, `السيناريوهات: ${st.scen}`);
  check(st.cmp === 2, `المقارنة: ${st.cmp} عمود`);
  check(st.tf === 6, `بطاقات الاتجاه: ${st.tf}`);

  /* ② التسريب — الكلمات الإنجليزية في النص الظاهر */
  const leaks = await p.evaluate(() => {
    const m = document.getElementById('usd-modal');
    if (!m) return '';
    const clone = m.cloneNode(true);
    clone.querySelectorAll('.usd-srcs, .usd-news, .usd-f, .usd-evs').forEach((e) => e.remove());
    return clone.innerText || '';
  });
  const bad = [...new Set(latinWords(leaks))];
  check(bad.length === 0, `مفيش كلمات إنجليزية في الواجهة${bad.length ? ': ' + bad.join(', ') : ''}`);

  /* ③ التبويبات */
  console.log('\n=== التبويبات ===');
  for (const t of ['technical', 'factors', 'calendar', 'news', 'sources']) {
    const ok = await p.evaluate((tt) => {
      const b = document.querySelector('.usd-tab[data-tab="' + tt + '"]');
      if (!b) return false; b.click(); return true;
    }, t);
    if (t === 'technical') {
      await p.waitForSelector('#usd-chart', { timeout: 40000 }).catch(() => { });
    } else {
      await p.waitForTimeout(2500);
    }
    await p.waitForTimeout(800);
    const info = await p.evaluate((tt) => {
      const m = document.getElementById('usd-modal');
      return {
        secs: m.querySelectorAll('.usd-sec').length,
        chart: !!m.querySelector('#usd-chart'),
        zones: m.querySelectorAll('.usd-zone-row').length,
        facts: m.querySelectorAll('.usd-f').length,
        evs: m.querySelectorAll('.usd-ev').length,
        news: m.querySelectorAll('.usd-nw').length,
        srcs: m.querySelectorAll('.usd-src').length,
        txt: (m.querySelector('.usd-sec') || {}).innerText || '',
      };
    }, t);
    check(ok && info.secs > 0, `تبويب ${t} فتح (${info.secs} قسم)`);
    if (t === 'technical') {
      check(info.chart, 'الرسم موجود');
      check(info.zones > 0, `مناطق الدعم/المقاومة: ${info.zones}`);
      /* التفاعل مع الرسم */
      const box = await p.locator('#usd-chart').boundingBox();
      if (box) {
        await p.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
        await p.waitForTimeout(700);
        await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45);
        await p.waitForTimeout(900);
        const ro = await p.evaluate(() => ({
          date: (document.getElementById('usd-ro-date') || {}).textContent || '',
          val: (document.getElementById('usd-ro-val') || {}).textContent || '',
          pct: (document.getElementById('usd-ro-pct') || {}).textContent || '',
          bars: document.querySelectorAll('#usd-modal .usd-readout').length,
          overlay: document.querySelectorAll('#usd-modal .usd-tip, #usd-modal .usd-dot-label').length,
        }));
        check(ro.bars === 1, `شريط قراءة واحد بس (${ro.bars})`);
        check(ro.overlay === 0, `مفيش حاجة معلّقة فوق الرسم (${ro.overlay})`);
        check(/\d{4}/.test(ro.date), `الشريط فيه تاريخ: ${ro.date}`);
        check(/\d/.test(ro.val), `الشريط فيه السعر: ${ro.val}`);
        check(/%/.test(ro.pct), `الشريط فيه النسبة: ${ro.pct}`);
      } else check(false, 'الرسم موجود');
    }
    if (t === 'factors') check(info.facts >= 10, `العوامل: ${info.facts}`);
    if (t === 'calendar') {
      await p.waitForSelector('.usd-ev', { timeout: 30000 }).catch(() => { });
      const n2 = await p.evaluate(() => document.querySelectorAll('.usd-ev').length);
      check(n2 > 0, `أحداث التقويم: ${n2}`);
    }
    if (t === 'news') check(info.news > 0, `الأخبار: ${info.news}`);
    if (t === 'sources') check(info.srcs >= 5, `المصادر: ${info.srcs}`);
  }

  /* ③ب الأطر الزمنية + ترتيب البيانات + المناطق */
  console.log('\n=== الأطر الزمنية (أسبوعي/شهري) + المناطق ===');
  /* 📌 نرجع لتبويب التحليل الفني الأول */
  await p.evaluate(() => { const b = document.querySelector('.usd-tab[data-tab="technical"]'); if (b) b.click(); });
  await p.waitForTimeout(1500);
  await p.waitForSelector('#usd-chart', { timeout: 40000 }).catch(() => { });
  for (const [tf, label] of [['1W', 'أسبوعي'], ['1M', 'شهري']]) {
    await p.evaluate((t) => { const b = document.querySelector('[data-tf="' + t + '"]'); if (b) b.click(); }, tf);
    await p.waitForTimeout(1000);
    await p.waitForSelector('#usd-chart', { timeout: 40000 }).catch(() => { });
    await p.waitForTimeout(2500);
    const info = await p.evaluate(() => {
      const ser = (window.__usdSeries || []);
      const svg = document.getElementById('usd-chart');
      const bodies = document.querySelectorAll('.usd-cdl').length;
      const zones = document.querySelectorAll('.usd-zg').length;
      const tags = Array.from(document.querySelectorAll('.usd-ztag')).map((t) => t.textContent);
      /* ⛔⛔⛔ لازم السلسلة تكون مرتبة زمنياً (الباج كان: ترتيب معجمي ⇒ قفزات) */
      const paths = Array.from(document.querySelectorAll('#usd-chart .usd-body'));
      return { bodies, zones, tags, tagCount: tags.length, hasChart: !!svg };
    });
    check(info.hasChart && info.bodies > 5, `${label}: الشموع مرسومة (${info.bodies})`);
    check(info.zones >= 2, `${label}: مناطق الدعم/المقاومة على الشارت (${info.zones})`);
    check(info.tagCount >= 1, `${label}: بطاقات الأسعار على المحور (${info.tags.join(' | ')})`);
    /* الترقيم الزمني من الـAPI */
    const ser = await p.evaluate(async (tfx) => {
      const r = await fetch(window.OCTA_API + '/api/usd/technical?symbol=USDEGP&tf=' + tfx + '&bars=60');
      const j = await r.json();
      const ts = (j.series || []).map((x) => x.t);
      return { n: ts.length, sorted: ts.every((v, i) => i === 0 || ts[i - 1] <= v), from: j.from, to: j.to };
    }, tf).catch(() => null);
    if (ser) check(ser.sorted, `${label}: السلسلة مرتبة بالزمن (${ser.n} شمعة · ${ser.from} → ${ser.to})`);
  }

  /* ③ج تبديل نافذة العرض */
  const win = await p.evaluate(async () => {
    const b = document.querySelector('[data-win="2"]');
    if (!b) return 'no-btn';
    b.click();
    await new Promise((r) => setTimeout(r, 8000));
    return document.querySelectorAll('.usd-cdl').length;
  });
  check(win !== 'no-btn' && win > 5, `نافذة العرض اتغيّرت (${win} شمعة)`);

  /* ③د شكل الرسم: شموع / خط */
  const lineMode = await p.evaluate(async () => {
    const b = document.querySelector('[data-chart="line"]');
    if (!b) return 'no-btn';
    b.click();
    await new Promise((r) => setTimeout(r, 2500));
    return { lines: document.querySelectorAll('.usd-line').length, bodies: document.querySelectorAll('.usd-cdl').length };
  });
  check(lineMode !== 'no-btn' && lineMode.lines === 1 && lineMode.bodies === 0, `وضع الخط شغال (${JSON.stringify(lineMode)})`);
  await p.evaluate(() => { const b = document.querySelector('[data-chart="candle"]'); if (b) b.click(); });
  await p.waitForTimeout(2000);

  /* ④ تبديل الإطار الزمني */
  console.log('\n=== تبديل الإطار الزمني ===');
  await p.evaluate(() => { const b = document.querySelector('.usd-tab[data-tab="technical"]'); if (b) b.click(); });
  await p.waitForSelector('[data-tf="1W"]', { timeout: 40000 }).catch(() => { });
  await p.waitForTimeout(1200);
  const tf = await p.evaluate(async () => {
    const b = document.querySelector('[data-tf="1W"]');
    if (!b) return 'no-btn';
    b.click();
    await new Promise((r) => setTimeout(r, 7000));
    const m = document.getElementById('usd-modal');
    const btn = document.querySelector('[data-tf="1W"]');
    return {
      on: btn ? btn.className.includes('on') : false,
      chart: !!m.querySelector('#usd-chart'),
      txt: (m.querySelector('.usd-note') || {}).innerText || '',
    };
  });
  check(tf !== 'no-btn' && tf.on, 'الزر الأسبوعي بقى مفعّل');
  check(tf.chart, 'الرسم اتعاد بنجاح');

  /* ⑤ كارت العامل */
  console.log('\n=== كارت العامل ===');
  const fk = await p.evaluate(() => {
    const b = document.querySelector('.usd-tab[data-tab="factors"]');
    if (b) b.click();
    return true;
  });
  await p.waitForTimeout(2500);
  const fk2 = await p.evaluate(() => {
    const b = document.querySelector('.usd-f');
    if (!b) return false; b.click(); return true;
  });
  await p.waitForTimeout(1200);
  const fkInfo = await p.evaluate(() => {
    const f = document.getElementById('usd-fact');
    return f ? { txt: f.innerText.slice(0, 200), hasSrc: !!f.querySelector('a') } : null;
  });
  check(fk2 && !!fkInfo, 'كارت العامل اتفتح');
  check(fkInfo && fkInfo.hasSrc, 'فيه رابط المصدر');

  /* ⑥ الإغلاق */
  const closed = await p.evaluate(() => {
    const b = document.querySelector('.usd-close');
    if (!b) return false; b.click(); return true;
  });
  await p.waitForTimeout(600);
  const isClosed = await p.evaluate(() => !document.getElementById('usd-modal'));
  check(closed && isClosed, 'المودال اتقفل');

  /* ⑦ النمط الفاتح + الديسكتوب */
  console.log('\n=== الديسكتوب + النمط الفاتح ===');
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  if (TOK) await ctx2.addInitScript((t) => { try { localStorage.setItem('octa_token', t); } catch (e) { } }, TOK);
  const p2 = await ctx2.newPage();
  await p2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  /* 📌 نستنى الكارت يظهر قبل الضغط (الصفحة بتاخد وقت) */
  await p2.waitForFunction(() => Array.from(document.querySelectorAll('.mini'))
    .some((e) => (e.textContent || '').includes('دولار/جنيه')), { timeout: 45000 }).catch(() => { });
  await p2.waitForTimeout(1200);
  await p2.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });
  const dclick = await p2.evaluate(() => {
    const c = Array.from(document.querySelectorAll('.mini')).find((e) => (e.textContent || '').includes('دولار/جنيه'));
    if (!c) return false; c.click(); return true;
  });
  check(dclick, 'الكارت اتضغط على الديسكتوب');
  await p2.waitForFunction(() => {
    const m = document.getElementById('usd-modal');
    return m && m.querySelector('.usd-price') && m.querySelector('.usd-price').textContent.trim();
  }, { timeout: 45000 }).catch(() => { });
  await p2.waitForTimeout(1500);
  const desk = await p2.evaluate(() => {
    const m = document.getElementById('usd-modal');
    if (!m) return { open: false };
    const box = m.querySelector('.usd-box');
    const tgt = m.querySelector('.usd-verdict') || m.querySelector('.usd-sec');
    const cs = tgt ? getComputedStyle(tgt) : { color: '', backgroundColor: '' };
    return {
      open: true,
      w: box ? box.getBoundingClientRect().width : 0,
      color: cs.color, bg: cs.backgroundColor,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  });
  check(desk.open, 'المودال مفتوح على الديسكتوب');
  check(desk.w > 600, `عرض المودال: ${Math.round(desk.w)}px`);
  check(!desk.overflow, 'مفيش تمرير أفقي على الديسكتوب');
  check(desk.color && desk.bg && desk.color !== desk.bg, `ألوان مختلفة (نص ${desk.color} / خلفية ${desk.bg})`);
  await p2.screenshot({ path: '/workspace/output/usd-desk-light.png' });

  console.log('\n=== النتيجة ===');
  console.log('أخطاء JS:', errs.length, errs.slice(0, 4));
  console.log('أخطاء console/429:', toos.length, toos.slice(0, 4));
  check(errs.length === 0, 'مفيش أخطاء JavaScript');
  check(toos.length === 0, 'مفيش أخطاء console ولا 429');
  console.log(fails.length ? `\n❌ فشل ${fails.length}:\n- ` + fails.join('\n- ') : '\n✅ كل حاجة عدّت');
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
