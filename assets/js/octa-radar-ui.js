/* ══════════════════════════════════════════════════════════════
   🛰️ OCTA Smart Money Radar — صفحة المسح
   ──────────────────────────────────────────────────────────────
   📌 الصفحة: داشبورد المسح + لوحة تحليل السهم.

   📌 البنية:
      1) الترويسة + حالة البيانات + العدادات
      2) شريط التحكم (بروفايل · بحث · قطاع · ترتيب · فلاتر)
      3) لوحة التقدّم (شغّال وقت المسح)
      4) النتائج (جدول على الديسكوب · كروت على الموبايل)
      5) لوحة السهم (٤ كروت + دليل ذكي + خطة + مخاطرة + شارت)
      6) الدليل التعليمي + التنويه

   ⛔ ممنوع: أي اسم أداة ذكاء اصطناعي في الكود أو التعليقات.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const R = window.OCTA_RADAR;
  const X = window.OCTA_RADAR_EXPLAIN;
  if (!R || !X) { console.warn('[radar] المحرك مش موجود'); return; }

  /* ══════════ الحالة ══════════ */
  const S = {
    universe: [],        /* [{code,name,sector}] */
    tech: {},            /* code → market_tech */
    quotes: {},          /* code → quotes row */
    results: [],         /* نتائج التحليل */
    byCode: {},
    candles: {},         /* code → شموع (للتفاصيل) */
    profile: 'balanced',
    sort: 'score', dir: -1,
    q: '', sector: 'all', cls: 'all',
    minLiq: 'all', minRR: 0, maxAtr: 0, minRvol: 0,
    showAll: false,
    money: { capital: 100000, riskPct: 1, maxAllocPct: 20 },
    scan: { running: false, total: 0, done: 0, failed: 0, steps: {}, err: null, lastRun: null, log: [], dataTs: null, snapshot: null },
    selected: null,
    started: false
  };

  const CHUNK = 40;   /* ⛔ ٤٠ كود × ٦ حروف = ٢٤٠ حرف < سقف التنظيف ٣٠٠ */

  /* ══════════ أدوات ══════════ */
  const $ = (id) => document.getElementById(id);
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v, d) { return (v == null || !isFinite(v)) ? (d == null ? '—' : d) : v; }

  /* ⛔ تنسيق السعر حسب حجمه (زي محرك Smart Money) */
  function fmtPrice(v) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    const d = a >= 100 ? 2 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.1 ? 4 : 5;
    return Number(v).toFixed(d);
  }
  function fmtNum(v) {
    if (v == null || !isFinite(v)) return '—';
    return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function fmtPct(v) {
    if (v == null || !isFinite(v)) return '—';
    return (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%';
  }
  /* 📡 نداء شبكة — ⛔⛔ بيسجّل سبب أي فشل ويرجّعه (مش null).
     السبب: لو الطلب فشل بصمت، المستخدم بيبصّ على أصفار من غير ما يعرف
     فين المشكلة — والصفحة كانت واقفة «بنجيب بيانات السوق» للأبد. */
  async function jget(path, ms) {
    const lim = ms || 45000;
    const t0 = Date.now();
    /* ════════════════════════════════════════════════════════════════
   * 🗄️ CACHE_VERSION — ٢٥ أكتوبر ٢٠٢٦
   * ────────────────────────────────────────────────────────────────
   * 📌 المشكلة: الكاش المحلي (٢٤ ساعة) ما كانش فيه version.
   * 📌 ⇒ كاش من كود قديم + كود جديد = كراش («reading 'qty'»).
   * 📌 ⇒ والكاش القديم بيسرد أسماء أسهم مش موجودة في الـuniverse الحالي.
   * ✅ الحل: كل تغيير في بنية البيانات ⇒ نرقّي الـversion ⇒ الكاش القديم يتجاهل.
   * ⚠️ مهم: ده-protection مش بديل عن الـSchema Guard — الاتنين لازم.
   */
  const CACHE_VERSION = '20261025-sizing';

  /* 🧹 ⭐ ٢٥ أكتوبر ٢٠٢٦ — مسح أي كاش رادار قديم عند الإقلاع.
   * 📌 السبب: الكاش القديم (٢٤ ساعة) بيسرد أسماء أسهم مش موجودة + ناقص sizing.
   * 📌 ⛔ الكاش القديم سبب كراش «reading 'qty'» عند ضغط أي سهم.
   * ✅ المسح بيتم مرة واحدة (عند أول تحميل للصفحة) — مش كل مرة.
   * ⛔ ملاحظة: بنمسح كاش الرادار بس — ⛔ ⛔ ⛔ مش بنمسح أي حاجة تانية.
   */
  try {
    var _rk = 'octa_radar_cache_migrated_' + CACHE_VERSION;
    if (!localStorage.getItem(_rk)) {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('octa_radar_cache_') === 0) {
          try { localStorage.removeItem(k); } catch (e) { }
        }
      });
      localStorage.setItem(_rk, '1');
    }
  } catch (e) { }

  const base = window.OCTA_API || '';
    let r = await jgetOnce(base + path, lim);
    /* 🛟 شبكة أمان: لو فشل المسار الأساسي، جرّب السيرفر المباشر.
       ⛌ السبب: لو الـinterceptor عمل failover، الـOCTA_API بقى هو
       السيرفر المباشر — فإعادة المحاولة بنفس العنوان مش هتفرق.
       ولومستخدم على شبكة بطيئة، الطلب المباشر بيشتغل أسرع. */
    if (!r._ok && window.OCTA_DIRECT && window.OCTA_DIRECT !== base) {
      const r2 = await jgetOnce(window.OCTA_DIRECT + path, lim);
      if (r2._ok) { r2._via = 'مباشر'; return r2; }
      r2._via = 'الأساسي + المباشر فشلوا';
      r2._err = r._err + ' | ' + r2._err;
      return r2;
    }
    r._via = base ? 'مباشر' : 'نفس الموقع';
    return r;
  }

  async function jgetOnce(url, lim) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), lim);
    const t0 = Date.now();
    try {
      const r = await fetch(url, { cache: 'no-store', signal: ctl.signal });
      clearTimeout(t);
      const dt = Date.now() - t0;
      if (!r.ok) return { _err: 'HTTP ' + r.status + ' ' + (r.statusText || ''), _ms: dt };
      const j = await r.json();
      return { _ok: true, _ms: dt, j: j };
    } catch (e) {
      clearTimeout(t);
      const why = (e && e.name === 'AbortError') ? 'انتهت المهلة (' + lim + 'ms)'
                : (e && e.message) ? e.message : 'فشل شبكة';
      return { _err: why, _ms: Date.now() - t0 };
    }
  }

  /* 📝 سجل تشخيص — يظهر للمستخدم (زرار «تشخيص») */
  function note(msg) {
    try {
      S.scan.log.push(msg);
      if (S.scan.log.length > 60) S.scan.log.shift();
    } catch (e) { }
  }

  /* ══════════════════════════════════════════════════════════════
   📥 1) تحميل البيانات
   ══════════════════════════════════════════════════════════════ */

  /* 🌍 الكون — من /api/radar/universe (حيّ + عربي) */
  async function loadUniverse() {
    let r = await jget('/api/radar/universe', 30000);
    let u = r && r.j;
    if (r && r._err) note('✗ الكون فشل: ' + r._err + ' (' + r._ms + 'ms)');
    else note('✓ الكون: ' + (u && u.stocks ? u.stocks.length : 0) + ' سهماً (' + r._ms + 'ms · ' + (r._via || '') + ')');
    if (u && u.ok && u.stocks && u.stocks.length) {
      S.universe = u.stocks;
      S.scan.marketPhase = u.market_phase;
      S.scan.snapshot = u.snapshot_id;
      S.scan.dataTs = u.ts;
      return true;
    }
    /* ⛔ احتياطي: market_tech مفتوح + ملف المرجع المحلي
       ⛔⛔ كان لسه بيستخدم الشكل القديم بتاع jget (قبل ._ok/.j)
          ⇒ mt.markets undefined ⇒ الاحتياطي **ما كانش بيشتغل خالص**
          ⇒ لو الكون فشل، مفيش بيانات خالص (صفحة أصفار). */
    const rmt = await jget('/api/market_tech?market=egypt', 30000);
    const mt = rmt && rmt.j;
    if (rmt && rmt._err) note('✗ الاحتياطي فشل: ' + rmt._err);
    if (!mt || !mt.markets || !mt.markets.egypt) return false;
    const ref = window.OCTA_RADAR_REF || {};
    const nonEq = new Set(['EGS30AJ1C016-EGP', 'EGS65101C015', 'EGS65621C012', 'EGS65861C014', 'EGS72L31C011']);
    const isin = { 'EGS3I0S1C019': 'FCMD', 'EGS48271C018-EGP': 'ESAC', 'EGS370O1C013': 'NAPR', 'EGS3E071C013-EGP': 'ACRO', 'EGS659O1C015': 'IDSC' };
    S.universe = Object.keys(mt.markets.egypt)
      .filter(c => !nonEq.has(c))
      .map(c => {
        const code = isin[c] || c;
        const r = ref[code] || {};
        return { code: code, name: r.n || code, sector: r.s || 'غير مصنّف' };
      });
    S.scan.snapshot = mt.snapshot_id;
    S.scan.dataTs = mt.updated;
    return S.universe.length > 0;
  }

  /* 📊 المؤشرات الجماعية + الأسعار */
  /* ⛔⛔ fail-soft: المؤشرات الجماعية **مش أساسية** — المحرك بيحسب
     كل حاجة من الشموع. فلو فشل الطلب ده، المسح لازم يكمل. */
  async function loadBulk() {
    const r1 = await jget('/api/market_tech?market=egypt', 20000);
    if (r1 && r1.j && r1.j.markets && r1.j.markets.egypt) {
      S.tech = r1.j.markets.egypt;
      S.scan.dataTs = S.scan.dataTs || r1.j.updated;
      note('✓ المؤشرات: ' + Object.keys(S.tech).length + ' سهماً (' + r1._ms + 'ms)');
    } else {
      note('⚠ المؤشراتBulk تعذّرت: ' + ((r1 && r1._err) || 'رد فاضي') + ' — هنكمل من الشموع');
    }
    const r2 = await jget('/api/quotes', 20000);
    if (r2 && r2.j && r2.j.markets && r2.j.markets.egypt) {
      S.quotes = r2.j.markets.egypt;
      note('✓ الأسعار: ' + Object.keys(S.quotes).length + ' سهماً (' + r2._ms + 'ms)');
    } else {
      note('⚠ الأسعار تعذّرت: ' + ((r2 && r2._err) || 'رد فاضي') + ' — هنكمل');
    }
  }

  /* 📜 تاريخ مجموعة أكواد — دفعة واحدة من السيرفر */
  async function loadHistory(codes) {
    const list = codes.join(',');
    const r = await jget('/api/radar/history?list=' + encodeURIComponent(list) + '&n=240', 120000);
    if (!r || !r._ok) {
      note('✗ دفعة (' + codes.length + ' كود) فشلت: ' + ((r && r._err) || 'رد فاضي') + ' (' + ((r && r._ms) || 0) + 'ms)');
      return { got: {}, failed: codes.slice() };
    }
    const d = r.j;
    if (!d || !d.ok || !d.codes) {
      note('✗ دفعة ردّ ناقص: ' + JSON.stringify(d).slice(0, 80));
      return { got: {}, failed: codes.slice() };
    }
    /* 🔄 الأعمدة → صفوف (شكل الباك الجديد: أخف ~٣٥٪ على الشبكة) */
    const got = {};
    for (const code in d.codes) {
      const v = d.codes[code];
      if (v && v.t && v.t.length) {
        const rows = [];
        for (let i = 0; i < v.t.length; i++) {
          rows.push({ t: v.t[i], o: v.o[i], h: v.h[i], l: v.l[i], c: v.c[i], v: v.v[i] });
        }
        got[code] = rows;
      } else if (Array.isArray(v)) {
        got[code] = v;   /* الشكل القديم (سطر) — احتياط */
      }
    }
    if (Object.keys(got).length) {
      note('  دفعة ' + Object.keys(got).length + '/' + codes.length + ' (' + r._ms + 'ms)');
    }
    return { got: got, failed: d.failed || [] };
  }

  /* 🧮 تحليل مجموعة أكواد (بيتشال مستدعى لكل دفعة — عرض تدريجي) */
  function analyzeCodes(list, meta) {
    list.forEach(u => {
      if (S.byCode[u.code]) return;              /* ⛔ متكررش */
      const c = S.candles[u.code];
      const tech = S.tech[u.code] || {};
      const q = S.quotes[u.code] || {};
      let a = null;
      try {
        a = R.analyze(c || [], {
          code: u.code, name: u.name, sector: u.sector,
          price: q.close != null ? q.close : tech.p,
          change: q.change, marketCap: tech.mc,
          rec: q['Recommend.All'], profile: meta.profile, money: meta.money
        });
      } catch (e) {
        /* ⛔⭐ ٢٥ أكتوبر ٢٠٢٦ — الـcatch القديم كان بيعمل
           `R.analyze([], ...)` ⇒ لو هي رمت برضو ⇒ `a = undefined`
           ⇒ `byCode[code] = undefined` ⇒ ضغط السهم ⇒ كراش.
           ✅ دلوقتي: نحاول شوية، ولو فشل ⇒ نعمل نتيجة فارغة آمنة. */
        try {
          a = R.analyze([], {
            code: u.code, name: u.name, sector: u.sector,
            price: q.close != null ? q.close : tech.p,
            change: q.change, marketCap: tech.mc,
            rec: q['Recommend.All'], profile: meta.profile, money: meta.money
          });
        } catch (e2) {
          note('⛔ فشل تحليل ' + u.code + ': ' + (e2 && e2.message ? e2.message : 'خطأ'));
          a = null;
        }
      }
      /* ⛔⭐ مفيش نتيجة ⇒ مش بنحطهاش (عشان ما يحصلش كراش لاحقاً) */
      if (!a || typeof a !== 'object') {
        S.scan.failed += 1;
        return;
      }
      S.results.push(a);
      S.byCode[u.code] = a;
    });
  }

  /* ══════════════════════════════════════════════════════════════
   🔄 2) المسح
   ══════════════════════════════════════════════════════════════ */
  async function scan() {
    if (S.scan.running) return;
    S.scan.running = true; S.scan.done = 0; S.scan.failed = 0; S.scan.err = null;
    S.results = []; S.byCode = {}; S.candles = {};
    S.scan.steps = {};
    setStatus('busy', '⏳ بنجيب بيانات السوق…');
    renderProgress(true);

    try {
      if (!S.universe.length) {
        setStatus('busy', '⏳ بنجهّز الكون…');
        if (!await loadUniverse()) throw new Error('مفيش بيانات للسوق');
        renderStats();
      }
      S.scan.total = S.universe.length;
      renderProgress(true);

      /* المؤشرات الجماعية (سريعة) */
      setStatus('busy', '⏳ بنجيب المؤشرات الجماعية…');
      await loadBulk();
      S.scan.steps.bulk = 'ok';
      renderProgress(true);

      /* 📜 التاريخ — دفعات بـ ٢ بالتوازي (الباك semaphore = ٤ اتصالات)
         ⛌ كانت متتابعة ⇒ ٨ دورات × (٢-٦٠ ثانية) = المستخدم مستني دقايق.
         ⛌ والتوازي بيخلّي أول نتيجة تظهر بسرعة. */
      /* ⛔⛔ لازم ناخد **الكائنات** (code+name+sector) مش الأكواد بس:
         العرض التدريجي بيحلل كل دفعة فور وصولها — ولو بعنا الكود
         نص، التحليل بيبني نتيجة فاضية (code=undefined). */
      const list = S.universe.slice();
      const codes = list.map(u => u.code);
      const tHist = Date.now();
      const meta = { profile: S.profile, money: S.money };
      const PAR = 2;
      let idx = 0;
      async function worker() {
        while (idx < codes.length) {
          const i = idx; idx += CHUNK;
          const part = codes.slice(i, i + CHUNK);
          const objs = list.slice(i, i + CHUNK);
          const r = await loadHistory(part);
          for (const k in r.got) S.candles[k] = r.got[k];
          S.scan.done += part.length - (r.failed || []).length;
          S.scan.failed += (r.failed || []).length;
          /* 📈 تحليل + عرض **طول ما الدفعة جت** — المستخدم يشوف
             أرقام بعد ثانية واحدة مش بعد ما كل حاجة تخلص.
             (⛌ كان بيستنى آخر دفعة ⇒ الشاشة زي اللي شافه أحمد.) */
          analyzeCodes(objs, meta);
          renderProgress(true);
          renderStats();
          renderList();
        }
      }
      await Promise.all([worker(), worker()]);
      setStatus('busy', '⏳ بنجيب الشموع… ' + Math.min(S.scan.done + S.scan.failed, codes.length) + ' من ' + codes.length);
      note('✓ الشموع: ' + S.scan.done + ' جاب · ' + S.scan.failed + ' تعذّر (' + ((Date.now() - tHist) / 1000).toFixed(1) + 'ث)');
      S.scan.steps.history = 'ok';

      /* التحليل — خلص incrementally جوه الـworker (شوف فوق) */
      /* ⛔ احتياطي: لو حصل خطأ في التحليل الجزئي، نكمّل الباقي */
      const rest = S.universe.filter(u => !S.byCode[u.code]);
      if (rest.length) analyzeCodes(rest, meta);
      S.scan.steps.analyze = 'ok';
      S.scan.lastRun = new Date().toISOString();

      setStatus('live', '✅ تم المسح — ' + S.scan.done + ' سهم محلّل' +
        (S.scan.failed ? ' · ' + S.scan.failed + ' تعذّر' : ''));
      /* 💾 كاش محلي — إعادة فتح الصفحة تطلع فوراً (مهم على الموبايل) */
      try {
        localStorage.setItem('octa_radar_cache_' + meta.profile, JSON.stringify({
          v: CACHE_VERSION,
          ts: Date.now(), dataTs: S.scan.dataTs, snapshot: S.scan.snapshot,
          done: S.scan.done, failed: S.scan.failed,
          results: S.results.map(r => ({
            c: r.code, n: r.name, s: r.sector, sc: r.score, cl: r.classification,
            tr: r.trend, mo: r.momentum, vo: r.volume, va: r.volatility,
            pl: r.plan, rk: r.risk, sm: r.smart, dq: r.dq,
            /* ⛔⭐ ٢٥ أكتوبر ٢٠٢٦ — كان ناقص `sizing` ⇒ الكاش بيرجّع
               سهم من غير sizing ⇒ `sz.qty` كراش («reading 'qty'»).
               ✅ بنحفظه دلوقتي. */
            sz: r.sizing
          }))
        }));
        note('💾 اتحفظ كاش محلي');
      } catch (e) { }
      renderAll();
    } catch (e) {
      S.scan.err = String(e && e.message || e);
      note('⛔ ' + S.scan.err);
      setStatus('err', '⛔ ' + S.scan.err + ' — دوس «تشخيص» وشوف التفاصيل');
      showDiag();
    } finally {
      S.scan.running = false;
      renderProgress(false);
      renderStats();
    }
  }

  /* ══════════════════════════════════════════════════════════════
   🩺 التشخيص — المستخدم على موبايل مش هيفتح الـconsole
   ⇒ لازم الصفحة نفسها تقوله فين المشكلة.
   ══════════════════════════════════════════════════════════════ */
  function showDiag() {
    const box = $('rdDiag');
    if (!box) return;
    const L = (S.scan.log || []).slice(-40);
    const info = [
      'الحالة: ' + (S.scan.err ? 'خطأ — ' + S.scan.err : (S.scan.running ? 'شغّال…' : 'مكتمل')),
      'الكون: ' + S.universe.length + ' · جاب: ' + S.scan.done + ' · تعذّر: ' + S.scan.failed,
      'آخر تحديث البيانات: ' + (S.scan.dataTs || '—'),
      'عناوين الطلب: ' + (window.OCTA_API || '(نفس الموقع)'),
      'الملف: ' + (location.protocol + '//' + location.host)
    ];
    box.innerHTML = '<div class="rd-diag-box">' +
      '<div class="rd-diag-h">🩺 تشخيص</div>' +
      '<div class="rd-diag-info">' + info.map(esc).join('<br>') + '</div>' +
      '<pre class="rd-diag-log">' + esc(L.join('\n') || '(مفيش سجل)') + '</pre>' +
      '<button type="button" class="rd-chip" id="rdDiagClose">إغلاق</button>' +
      '<button type="button" class="rd-chip" id="rdDiagCopy">نسخ السجل</button>' +
      '</div>';
    const bg = $('rdDiagBg');
    if (bg) bg.style.display = 'flex';
    const c = $('rdDiagClose');
    if (c) c.onclick = () => { if (bg) bg.style.display = 'none'; };
    const cp = $('rdDiagCopy');
    if (cp) cp.onclick = function () {
      const txt = info.join('\n') + '\n---\n' + L.join('\n');
      try { navigator.clipboard.writeText(txt); cp.textContent = '✅ اتنسخ'; }
      catch (e) { cp.textContent = '❌ مقدرتش'; }
    };
  }

  /* 💾 كاش محلي — إعادة الفتح تطلع فوراً (مهم على الموبايل) */
  function loadCache() {
    try {
      const raw = localStorage.getItem('octa_radar_cache_' + S.profile);
      if (!raw) return false;
      const c = JSON.parse(raw);
      if (!c || !c.results || !c.results.length) return false;
      /* ⛔⭐ ٢٥ أكتوبر ٢٠٢٦ — الـversion لازم يطابق.
         ⛔ كاش من كود قديم = بنية مختلفة = كراش + أسماء أسهم وهمية. */
      if (c.v !== CACHE_VERSION) {
        note('⛔ كاش قديم (نسخة ' + (c.v || 'قديمة') + ') — تم تجاهله');
        try { localStorage.removeItem('octa_radar_cache_' + S.profile); } catch (e) { }
        return false;
      }
      /* ⛔ الكاش بيصالح يوم واحد — بعدها الداتا بتكون قديمة */
      if (Date.now() - (c.ts || 0) > 24 * 3600 * 1000) return false;
      S.results = c.results.map(x => ({
        code: x.c, name: x.n, sector: x.s, score: x.sc, classification: x.cl,
        trend: x.tr, momentum: x.mo, volume: x.vo, volatility: x.va,
        plan: x.pl, risk: x.rk, smart: x.sm, dq: x.dq,
        /* ⛔⭐ ٢٥ أكتوبر ٢٠٢٦ — `sizing` من الكاش. ⛔ لو الكاش قديم
           (من قبل الإصلاح) ⇒ مش موجود ⇒ بنحسبه fallback. */
        sizing: x.sz || null
      }));
      /* ⛔ كاش قديم (قبل ٢٥ أكتوبر) ⇒ `sizing` ناقص ⇒ نحسبه من `plan`.
         ⛔ بدون ده: `sz.qty` ⇒ TypeError. */
      S.results.forEach(r => {
        if (!r.sizing) {
          try {
            r.sizing = (typeof R !== 'undefined' && R.sizingEngine)
              ? R.sizingEngine(r.plan || {}, (S.money || {}))
              : { capital: null, riskPct: null, maxAllocPct: null, riskAmount: null,
                  qty: null, positionValue: null, allocationPct: null,
                  estLoss: null, estProfit: null, capped: false,
                  costsIncluded: false, costsNote: '' };
          } catch (e) {
            r.sizing = { capital: null, riskPct: null, maxAllocPct: null, riskAmount: null,
              qty: null, positionValue: null, allocationPct: null,
              estLoss: null, estProfit: null, capped: false,
              costsIncluded: false, costsNote: '' };
          }
        }
      });
      S.byCode = {};
      S.results.forEach(r => { S.byCode[r.code] = r; });
      S.scan.done = c.done || 0; S.scan.failed = c.failed || 0;
      S.scan.dataTs = c.dataTs || null; S.scan.snapshot = c.snapshot || null;
      S.scan.lastRun = new Date(c.ts).toISOString();
      setStatus('live', '✅ كاش محلي — ' + S.results.length + ' سهماً · آخر مسح ' +
        new Date(c.ts).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
      note('💾 كاش محلي: ' + S.results.length + ' سهماً');
      renderAll();
      return true;
    } catch (e) { return false; }
  }

  /* ══════════════════════════════════════════════════════════════
   🎨 3) العرض
   ══════════════════════════════════════════════════════════════ */
  function setStatus(kind, text) {
    const s = $('rdStatus');
    if (!s) return;
    s.innerHTML = '<span class="rd-dot ' + (kind || '') + '"></span> ' + esc(text);
  }

  function renderStats() {
    const res = S.results;
    const cnt = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    res.forEach(r => { cnt[r.classification.code] = (cnt[r.classification.code] || 0) + 1; });
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('rdTotal', S.universe.length || '—');
    set('rdAnalyzed', res.length || '—');
    set('rdA', cnt.A || 0);
    set('rdB', cnt.B || 0);
    set('rdC', cnt.C || 0);
    set('rdE', cnt.E || 0);
    set('rdUpd', S.scan.dataTs ? String(S.scan.dataTs).slice(0, 16).replace('T', ' ') : '—');
  }

  function renderProgress(show) {
    const p = $('rdProgress');
    if (!p) return;
    if (!show) { p.style.display = 'none'; return; }
    p.style.display = '';
    const total = S.scan.total || S.universe.length || 1;
    const pct = Math.round(Math.min(100, (S.scan.done / total) * 100));
    const st = S.scan.steps;
    const step = (n, label, key) => {
      const s = st[key] || '';
      return '<div class="rd-step ' + (s || '') + '"><i class="n">' + n + '</i>' + esc(label) + '</div>';
    };
    p.innerHTML =
      '<h4>⏳ جاري فحص السوق — ' + S.scan.done + ' من ' + total + ' سهمًا</h4>' +
      '<div class="rd-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="rd-steps">' +
      step(1, 'بيانات السوق', 'bulk') +
      step(2, 'الشموع اليومية', 'history') +
      step(3, 'التحليل', 'analyze') +
      step(4, 'التصنيف', 'analyze') +
      '</div>';
  }

  /* 🔎 الفلترة */
  /* ══════════════════════════════════════════════════════════════
   📊 أعمدة الجدول — مصدر واحد (العنوان · الترتيب · الفلترة)
   ──────────────────────────────────────────────────────────────
   📌 ٢٣ أكتوبر ٢٠٢٦: كل عمود في الجدول قابل للترتيب (بضغطة)
   + قابل للفلترة (سطر الترويسة الثاني).
   ⛔ كل عمود لازم يكون له sortBy (رقم أو نص) عشان الترتيب يشتغل.
   ══════════════════════════════════════════════════════════════ */
  const COLS = [
    { k: 'name', t: 'السهم', f: 'text', get: r => (r.name || '') + ' ' + (r.code || '') },
    { k: 'price', t: 'السعر', f: 'num', get: r => r.price },
    { k: 'change', t: 'التغير', f: 'num', get: r => r.change },
    /* ⛔ الأعمدة اللي بتعرض حالة: الترتيب بيكون بالـscore (رقم) مش بالحالة
       (نص) — الترتيب بالحالة مش مفيد. */
    { k: 'trend', t: 'الاتجاه', f: 'sel', vals: () => uniqStates('trend'), get: r => r.trend.state, sb: r => r.trend.score },
    { k: 'momentum', t: 'الزخم', f: 'sel', vals: () => uniqStates('momentum'), get: r => r.momentum.state, sb: r => r.momentum.score },
    { k: 'volume', t: 'الحجم', f: 'sel', vals: () => uniqStates('volume'), get: r => r.volume.state, sb: r => r.volume.score },
    { k: 'volatility', t: 'التذبذب', f: 'sel', vals: () => uniqStates('volatility'), get: r => r.volatility.state, sb: r => r.volatility.score },
    { k: 'liq', t: 'السيولة', f: 'sel', vals: () => uniqStates('liq'), get: r => r.volume.liq },
    { k: 'rr', t: 'R:R', f: 'num', get: r => r.plan.rr },
    { k: 'atr', t: 'التذبذب%', f: 'num', get: r => r.volatility.atrPct },
    { k: 'rvol', t: 'الحجم النسبي', f: 'num', get: r => r.volume.rvol },
    { k: 'risk', t: 'المخاطرة', f: 'sel', vals: () => uniqStates('risk'), get: r => r.risk.state, sb: r => r.risk.riskScore },
    { k: 'score', t: 'الدرجة', f: 'num', get: r => r.score.total },
    { k: 'cls', t: 'الحالة', f: 'sel', vals: () => ['A', 'B', 'C', 'D', 'E'], get: r => r.classification.code }
  ];

  /* كل القيم المتاحة في عمود (للفلاتر المنسدلة) */
  function uniqStates(which) {
    const set = {};
    S.results.forEach(r => {
      let v = null;
      if (which === 'trend') v = r.trend.state;
      else if (which === 'momentum') v = r.momentum.state;
      else if (which === 'volume') v = r.volume.state;
      else if (which === 'volatility') v = r.volatility.state;
      else if (which === 'liq') v = r.volume.liq;
      else if (which === 'risk') v = r.risk.state;
      if (v) set[v] = 1;
    });
    return Object.keys(set).sort();
  }

  /* ⛔ فلتر رقم: يقبل 5 أو >5 أو <5 أو >=5 أو <=5 أو =5 */
  function numFilterOk(val, expr) {
    if (expr == null) return true;
    const e = String(expr).trim();
    if (!e) return true;
    const m = e.match(/^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return true;
    const op = m[1] || '>=';
    const n = parseFloat(m[2]);
    if (val == null || !isFinite(val)) return false;
    if (op === '>=') return val >= n;
    if (op === '>') return val > n;
    if (op === '<=') return val <= n;
    if (op === '<') return val < n;
    return Math.abs(val - n) < 1e-9;
  }

  function filtered() {
    const liqRank = { DEEP: 5, LIQUID: 4, MODERATE: 3, THIN: 2, ILLIQUID: 1 };
    let out = S.results.slice();
    if (S.q) {
      const q = S.q.toUpperCase();
      out = out.filter(r => (r.code || '').toUpperCase().indexOf(q) >= 0 ||
        (r.name || '').indexOf(S.q) >= 0);
    }
    if (S.sector !== 'all') out = out.filter(r => r.sector === S.sector);
    if (S.cls !== 'all') out = out.filter(r => r.classification.code === S.cls);
    if (S.minLiq !== 'all') {
      out = out.filter(r => r.volume.liq && r.volume.liq !== 'NONE' &&
        (liqRank[r.volume.liq] || 0) >= (liqRank[S.minLiq] || 0));
    }
    if (S.minRR > 0) out = out.filter(r => r.plan.rr != null && r.plan.rr >= S.minRR);
    if (S.maxAtr > 0) out = out.filter(r => r.volatility.atrPct != null && r.volatility.atrPct <= S.maxAtr);
    if (S.minRvol > 0) out = out.filter(r => r.volume.rvol != null && r.volume.rvol >= S.minRvol);
    if (!S.showAll) out = out.filter(r => r.classification.code !== 'E');

    /* 🧮 فلاتر الأعمدة (من صف الترويسة) */
    const cf = S.col || {};
    COLS.forEach(c => {
      const ex = cf[c.k];
      if (ex == null || ex === '' || ex === 'all') return;
      if (c.f === 'text') {
        const q = String(ex).toLowerCase();
        out = out.filter(r => String(c.get(r) || '').toLowerCase().indexOf(q) >= 0);
      } else if (c.f === 'num') {
        out = out.filter(r => numFilterOk(c.get(r), ex));
      } else if (c.f === 'sel') {
        if (c.k === 'cls') out = out.filter(r => r.classification.code === ex);
        else out = out.filter(r => String(c.get(r) || '') === ex);
      }
    });

    /* 🔀 الترتيب — بالعمود المختار */
    const key = S.sort;
    const col = COLS.find(c => c.k === key);
    const LIQ_ORDER = { DEEP: 5, LIQUID: 4, MODERATE: 3, THIN: 2, ILLIQUID: 1 };
    out.sort((a, b) => {
      let x, y;
      if (col) {
        if (key === 'liq') { x = LIQ_ORDER[a.volume.liq] || 0; y = LIQ_ORDER[b.volume.liq] || 0; }
        else if (col.sb) { x = col.sb(a); y = col.sb(b); }
        else { x = col.get(a); y = col.get(b); }
      } else { x = a.price; y = b.price; }
      if (x == null) x = -Infinity;
      if (y == null) y = -Infinity;
      if (typeof x === 'string' || typeof y === 'string') {
        return String(x).localeCompare(String(y), 'ar') * S.dir;
      }
      return (x - y) * S.dir;
    });
    return out;
  }

  /* 🔄 زامن منسدلة الترتيب في كارت الفلاتر مع ترتيب الجدول */
  function syncSortUI() {
    const sel = $('rdSort');
    if (sel && sel.value !== S.sort) sel.value = S.sort;
    const dir = $('rdDir');
    if (dir) dir.textContent = S.dir > 0 ? '⬆' : '⬇';
  }

  function clsBadge(code) {
    const map = {
      A: ['a', 'مرشح قوي'], B: ['b', 'يحتاج تأكيد'], C: ['c', 'مخاطرة عالية'],
      D: ['d', 'مفيش إعداد'], E: ['e', 'بيانات ناقصة']
    };
    const m = map[code] || map.D;
    return '<span class="rd-badge ' + m[0] + '">' + m[1] + '</span>';
  }
  function stateCell(v) {
    if (v == null) return '<span class="rd-na">—</span>';
    const s = String(v);
    let c = '';
    if (/UPTREND|STRONG POSITIVE|POSITIVE MOMENTUM|HIGH VOLUME|DEEP|LIQUID|LOWER RELATIVE|POTENTIAL ENTRY/.test(s)) c = 'rd-up';
    else if (/DOWNTREND|STRONG NEGATIVE|NEGATIVE MOMENTUM|ILLIQUID|VERY HIGH|INVALIDATED/.test(s)) c = 'rd-dn';
    else if (/HIGH VOLATILITY|EXTREME|VERY HIGH RISK|THIN/.test(s)) c = 'rd-warn';
    else if (/INSUFFICIENT|NONE|UNAVAILABLE/.test(s)) c = 'rd-na';
    return '<span class="' + c + '">' + esc(X.tr('ar', s)) + '</span>';
  }

  function renderList() {
    const box = $('rdList');
    if (!box) return;
    const rows = filtered();
    $('rdCount') && ($('rdCount').textContent = rows.length);
    if (!rows.length) {
      box.innerHTML =
        '<div class="rd-empty"><h3>لم تظهر أسهم تطابق المعايير الحالية</h3>' +
        '<p>جرّب تخفيف فلتر أو تغيير البروفايل.</p>' +
        '<ul><li>وسّع الفلاتر (السيولة / التذبذب / نسبة العائد)</li>' +
        '<li>جرّب بروفايل «متوازن» بدل «محافظ»</li>' +
        '<li>اعمل «تحديث» للمسح من جديد</li></ul>' +
        '<button class="rd-chip" id="rdReset2" type="button">↺ تصفير الفلاتر</button></div>';
      const b = $('rdReset2');
      if (b) b.onclick = resetFilters;
      return;
    }
    /* ══════════════════════════════════════════════════════════════
     📊 الجدول — صف عناوين (ترتيب) + صف فلاتر (لكل عمود)
     ══════════════════════════════════════════════════════════════ */
    const cf = S.col || {};
    const isOn = (k) => S.sort === k;
    const arrow = (k) => isOn(k) ? (S.dir > 0 ? '<span class="ar">▲</span>' : '<span class="ar">▼</span>') : '';

    let head = '<tr>';
    COLS.forEach(c => {
      head += '<th' + (c.k === 'name' ? ' class="sticky-c"' : '') + '>' +
        '<button type="button" class="rd-th-sort' + (isOn(c.k) ? ' on' : '') + '" ' +
        'data-sort="' + esc(c.k) + '" aria-label="ترتيب حسب ' + esc(c.t) + '">' +
        esc(c.t) + arrow(c.k) + '</button></th>';
    });
    head += '</tr>';

    let frow = '<tr>';
    COLS.forEach(c => {
      const val = cf[c.k] == null ? '' : cf[c.k];
      let ctrl;
      if (c.f === 'text') {
        ctrl = '<input type="search" data-cf="' + esc(c.k) + '" value="' + esc(val) + '" placeholder="' + esc(c.t) + '" aria-label="فلتر ' + esc(c.t) + '">';
      } else if (c.f === 'num') {
        ctrl = '<input type="text" inputmode="decimal" data-cf="' + esc(c.k) + '" value="' + esc(val) + '" placeholder="' + esc(c.t) + '" aria-label="فلتر ' + esc(c.t) + '">';
      } else {
        const opts = ['<option value="all">الكل</option>'];
        const vals = c.k === 'cls' ? ['A', 'B', 'C', 'D', 'E'] : (c.vals ? c.vals() : []);
        vals.forEach(v => {
          const lb = c.k === 'cls' ? (({ A: 'قوي', B: 'تأكيد', C: 'مخاطرة', D: 'مفيش', E: 'ناقص' })[v] || v) : X.tr('ar', v);
          opts.push('<option value="' + esc(v) + '"' + (val === v ? ' selected' : '') + '>' + esc(lb) + '</option>');
        });
        ctrl = '<select data-cf="' + esc(c.k) + '" aria-label="فلتر ' + esc(c.t) + '">' + opts.join('') + '</select>';
      }
      frow += '<th' + (c.k === 'name' ? ' class="sticky-c"' : '') + ' class="rd-th-f-wrap"><td class="rd-th-f">' + ctrl + '</td></th>';
    });
    frow += '</tr>';

    let body = '';
    rows.forEach(r => {
      const tds = COLS.map(c => {
        if (c.k === 'name') {
          return '<td class="sticky-c"><div class="rd-nm"><b>' + esc(r.name) + '</b>' +
            '<span class="rd-code">' + esc(r.code) + (r.sector ? ' · ' + esc(r.sector) : '') + '</span></div></td>';
        }
        if (c.k === 'price') {
          return '<td class="num"><b>' + fmtPrice(r.price) + '</b>' +
            (r.change != null ? ' <span class="' + (r.change >= 0 ? 'rd-up' : 'rd-dn') + '">' + fmtPct(r.change) + '</span>' : '') + '</td>';
        }
        if (c.k === 'change') {
          return '<td class="num">' + (r.change == null ? '<span class="rd-na">—</span>' :
            '<b class="' + (r.change >= 0 ? 'rd-up' : 'rd-dn') + '">' + fmtPct(r.change) + '</b>') + '</td>';
        }
        if (c.k === 'score') {
          return '<td class="num"><b>' + (r.score.total == null ? '—' : r.score.total) + '</b></td>';
        }
        if (c.k === 'rr') {
          return '<td class="num">' + (r.plan.rr == null ? '<span class="rd-na">—</span>' : '<b>' + r.plan.rr + '</b>') + '</td>';
        }
        if (c.k === 'atr') {
          return '<td class="num">' + (r.volatility.atrPct == null ? '<span class="rd-na">—</span>' : r.volatility.atrPct + '%') + '</td>';
        }
        if (c.k === 'rvol') {
          return '<td class="num">' + (r.volume.rvol == null ? '<span class="rd-na">—</span>' : r.volume.rvol) + '</td>';
        }
        if (c.k === 'cls') {
          return '<td>' + clsBadge(r.classification.code) + '</td>';
        }
        return '<td>' + stateCell(c.get(r)) + '</td>';
      }).join('');
      body += '<tr data-code="' + esc(r.code) + '" tabindex="0" role="button" ' +
        'aria-label="' + esc(r.name + ' — ' + X.tr('ar', r.classification.state)) + '">' + tds + '</tr>';
    });

    box.innerHTML = '<div class="rd-tablewrap"><table class="rd-table">' +
      '<thead>' + head + frow + '</thead><tbody>' + body + '</tbody></table></div>';

    /* 🔀 زرار الترتيب */
    box.querySelectorAll('[data-sort]').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-sort');
        if (S.sort === k) S.dir = -S.dir;
        else { S.sort = k; S.dir = (k === 'name' || k === 'cls') ? 1 : -1; }
        syncSortUI();
        renderList();
      });
    });
    /* 🧮 فلاتر الأعمدة */
    box.querySelectorAll('[data-cf]').forEach(inp => {
      const k = inp.getAttribute('data-cf');
      const ev = (inp.tagName === 'SELECT') ? 'change' : 'input';
      let tm = null;
      inp.addEventListener(ev, () => {
        clearTimeout(tm);
        tm = setTimeout(() => {
          S.col = S.col || {};
          S.col[k] = inp.value;
          renderList();
          /* ⛔ بعد إعادة الرسم، نرجّع التركيز للحقل (إلا لو اتغيّر الـDOM) */
          const nx = $('rdList') && $('rdList').querySelector('[data-cf="' + k + '"]');
          if (nx && document.activeElement !== nx) { try { nx.focus(); } catch (e) { } }
        }, 220);
      });
    });
    /* 👆 فتح السهم */
    box.querySelectorAll('tbody [data-code]').forEach(n => {
      n.addEventListener('click', () => openStock(n.getAttribute('data-code')));
      n.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStock(n.getAttribute('data-code')); }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
   🔍 4) لوحة السهم
   ══════════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════════
   🔍 فتح السهم — في **صفحة مستقلة** (٢٣ أكتوبر ٢٠٢٦)
   ──────────────────────────────────────────────────────────────
   📌 طلب أحمد: «لما ندوس على سهم يفتح صفحة تانية بكل المعلومات
   — عشان التصفح ميبقاش طويل تحت كده».
   ⛔ مفيش أي محتوى اتشال — نفس الـdetailHTML بالظبط.
   ══════════════════════════════════════════════════════════════ */
  function openStock(code) {
    const a = S.byCode[code];
    /* ⛔⭐ ٢٥ أكتوبر ٢٠٢٦ — السهم موجود في الجدول بس مش في `byCode`
       (كاش قديم / فشل جزئي) ⇒ كنا بنعمل `return` صامت ⇒ المستخدم
       بيضغط السهم ومفيش حاجة بتحصل.
       ✅ دلوقتي: بنحسبه لوين ما كانش موجود. */
    if (!a) {
      const u = (S.universe || []).find(x => x && x.code === code);
      if (u) {
        try {
          const c = S.candles[code] || [];
          const tech = S.tech[code] || {};
          const q = S.quotes[code] || {};
          const built = R.analyze(c, {
            code: u.code, name: u.name, sector: u.sector,
            price: q.close != null ? q.close : tech.p,
            change: q.change, marketCap: tech.mc,
            rec: q['Recommend.All'], profile: S.profile, money: S.money
          });
          S.byCode[code] = built;
          if (!S.results.some(r => r && r.code === code)) S.results.push(built);
        } catch (e) {
          note('⛔ تعذّر تحليل ' + code + ': ' + (e && e.message ? e.message : 'خطأ'));
        }
      }
    }
    const a2 = S.byCode[code];
    if (!a2) {
      const body = $('rdStockBody');
      if (body) body.innerHTML = '<div class="rd-load">⛔ بيانات السهم غير متاحة — جرّب تعمل مسح تاني</div>';
      return;
    }
    S.selected = code;
    const body = $('rdStockBody');
    if (!body) return;
    body.innerHTML = detailHTML(a2);
    bindDetail(a2);
    bindBack();
    /* ⛔ لازم الصفحة تكون مسجّلة كـtool عشان الـhash يتبعها
       والرجوع يشتغل صح */
    if (typeof switchPage === 'function') {
      try { switchPage('radar-stock'); }
      catch (e) { window.scrollTo(0, 0); }
    } else {
      try { window.scrollTo(0, 0); } catch (e) { }
    }
  }

  /* ↩ رجوع لقائمة الرادار */
  function backToList() {
    if (typeof switchPage === 'function') {
      try { switchPage('radar'); return; } catch (e) { }
    }
    window.scrollTo(0, 0);
  }

  function tipBtn(key) {
    return '<button class="rd-tip" data-tip="' + esc(key) + '" type="button" ' +
      'aria-label="شرح المصطلح">؟</button>';
  }

  function detailHTML(a) {
    /* ════════════════════════════════════════════════════════════════
     * 🛡️ ٢٥ أكتوبر ٢٠٢٦ — حارس البنية (Schema Guard)
     * ────────────────────────────────────────────────────────────────
     * 📌 المشكلة: الكاش المحلي (٢٤ ساعة) كان بيرجّع بيانات **من قبل**
     * 📌 إضافة `sizing` ⇒ `a.sizing` = undefined ⇒ `sz.qty` ⇒
     * 📌 TypeError: Cannot read properties of undefined (reading 'qty')
     * 📌 ⛔ والكراش كان بيقفل الصفحة بالكامل.
     * ✅ الحل: نملأ أي جزء ناقص بالقيمة الآمنة (null) قبل الاستخدام.
     * 📌 ⛔ القاعدة: أي object من الكاش/الـAPI ⇒ يمرّ من هنا الأول.
     * ════════════════════════════════════════════════════════════════ */
    if (!a || typeof a !== 'object') return '<div class="rd-load">⛔ بيانات السهم غير متاحة</div>';

    /* القيم الناقصة الآمنة */
    const _sz = (a.sizing && typeof a.sizing === 'object') ? a.sizing : {
      capital: null, riskPct: null, maxAllocPct: null, riskAmount: null,
      qty: null, positionValue: null, allocationPct: null,
      estLoss: null, estProfit: null, capped: false,
      costsIncluded: false, costsNote: ''
    };
    const _plan = (a.plan && typeof a.plan === 'object') ? a.plan : {
      current: null, entry: null, stop: null, target1: null, target2: null,
      rr: null, status: null, confirm: null, notes: []
    };
    const _risk = (a.risk && typeof a.risk === 'object') ? a.risk : {
      state: null, warnings: [], flags: {}
    };
    const _smart = (a.smart && typeof a.smart === 'object') ? a.smart : {
      score: null, confidence: 0, components: []
    };
    const _trend = (a.trend && typeof a.trend === 'object') ? a.trend : { state: null, score: null, parts: [] };
    const _mom = (a.momentum && typeof a.momentum === 'object') ? a.momentum : { state: null, score: null, parts: [] };
    const _vol = (a.volume && typeof a.volume === 'object') ? a.volume : { state: null, score: null, parts: [], liq: null };
    const _va = (a.volatility && typeof a.volatility === 'object') ? a.volatility : { state: null, score: null, parts: [] };
    const _dq = (a.dq && typeof a.dq === 'object') ? a.dq : { lastDate: null };

    /* ⛔ نعمل نسخة آمنة — نعدّل النسخة دي بس (مش الأصل) */
    const a2 = Object.assign({}, a, {
      sizing: _sz, plan: _plan, risk: _risk, smart: _smart,
      trend: _trend, momentum: _mom, volume: _vol, volatility: _va, dq: _dq
    });
    /* ⛔ `risk.warnings` لازم array دايماً */
    if (!Array.isArray(a2.risk.warnings)) a2.risk = Object.assign({}, a2.risk, { warnings: [] });
    /* ⛔ `plan.notes` لازم array دايماً */
    if (!Array.isArray(a2.plan.notes)) a2.plan = Object.assign({}, a2.plan, { notes: [] });
    /* ⛔ `smart.components` لازم array دايماً */
    if (!Array.isArray(a2.smart.components)) a2.smart = Object.assign({}, a2.smart, { components: [] });

    const card = X.card(a2, 'ar');
    const se = X.scoreExplain(a2, 'ar');
    const steps = X.steps(a2, 'ar');
    const parts = (arr) => (arr || []).map(p =>
      '<div class="rd-part ' + (p.ok ? 'ok' : 'no') + '"><i>' + (p.ok ? '✓' : '✕') + '</i>' +
      '<span><b>' + esc(p.label) + '</b> — ' + esc(p.detail || '') +
      (p.v != null ? ' <b>' + fmtNum(p.v) + '</b>' : '') + '</span></div>').join('');

    /* ── كارت المؤشر ── */
    function indCard(title, key, st, score, kv, text, prt) {
      return '<div class="rd-indc"><h4>' + esc(title) + ' ' + tipBtn(key) + '</h4>' +
        '<div class="st">' + stateCell(st) + '</div>' +
        (score == null ? '<div class="sc">— <small>غير متاح</small></div>'
          : '<div class="sc">' + score + ' <small>/ 100</small></div>') +
        '<div class="rd-kv">' + (kv || '') + '</div>' +
        '<div class="rd-txt">' + esc(text || '') + '</div>' +
        (prt ? '<div class="rd-parts">' + parts(prt) + '</div>' : '') +
        '</div>';
    }

    const t = a2.trend, m = a2.momentum, v = a2.volume, va = a2.volatility, sm = a2.smart;
    const indicators =
      '<div class="rd-ind">' +
      indCard('الاتجاه', 'trend', t.state, t.score,
        (t.ema20 != null ? '<span>EMA20 <b>' + fmtNum(t.ema20) + '</b></span>' : '') +
        (t.ema50 != null ? '<span>EMA50 <b>' + fmtNum(t.ema50) + '</b></span>' : '') +
        (t.ema200 != null ? '<span>EMA200 <b>' + fmtNum(t.ema200) + '</b></span>' : '') +
        (t.adx != null ? '<span>ADX <b>' + fmtNum(t.adx) + '</b></span>' : ''),
        X.trendText(a2, 'ar'), t.parts) +
      indCard('الزخم', 'momentum', m.state, m.score,
        (m.rsi != null ? '<span>RSI <b>' + fmtNum(m.rsi) + '</b></span>' : '') +
        (m.macd != null ? '<span>MACD <b>' + fmtNum(m.macd) + '</b></span>' : '') +
        (m.signal != null ? '<span>الإشارة <b>' + fmtNum(m.signal) + '</b></span>' : ''),
        X.momentumText(a2, 'ar'), m.parts) +
      indCard('حجم التداول', 'rvol', v.state, v.score,
        (v.rvol != null ? '<span>الحجم النسبي <b>' + fmtNum(v.rvol) + '×</b></span>' : '') +
        (v.turnover != null ? '<span>الدوران <b>' + fmtNum(v.turnover) + '%</b></span>' : '') +
        '<span>السيولة <b>' + X.tr('ar', v.liq) + '</b></span>',
        X.volumeText(a2, 'ar'), v.parts) +
      indCard('التذبذب', 'atr', va.state, va.score,
        (va.atr != null ? '<span>ATR <b>' + fmtNum(va.atr) + '</b></span>' : '') +
        (va.atrPct != null ? '<span>ATR% <b>' + fmtNum(va.atrPct) + '</b></span>' : '') +
        (va.avgRange != null ? '<span>متوسط النطاق <b>' + fmtNum(va.avgRange) + '</b></span>' : ''),
        X.volatilityText(a2, 'ar'), va.parts) +
      '</div>';

    /* ── الدليل الذكي ── */
    const smRows = (sm.components || []).map(c =>
      '<div class="rd-part ' + (c.score >= 60 ? 'ok' : 'no') + '"><i>' + (c.score >= 60 ? '✓' : '·') + '</i>' +
      '<span><b>' + esc(c.label) + '</b> — ' + esc(c.detail) +
      ' <span style="opacity:.7">(' + esc(c.src) + ' · ثقة ' + fmtNum(c.conf * 100) + '%)</span></span></div>'
    ).join('');
    const smart =
      '<div class="rd-cardbox"><h3>🕵️ نشاط التداول ' + tipBtn('smartMoney') +
      '<span class="sp">الدرجة: ' + (sm.score == null ? 'غير متاحة' : sm.score + ' / 100') +
      ' · الثقة: ' + X.tr('ar', sm.confidence) + '</span></h3>' +
      '<div class="rd-txt" style="margin-bottom:8px">' + esc(X.smartText(a2, 'ar')) + '</div>' +
      '<div class="rd-parts">' + smRows + '</div>' +
      '<div class="rd-warn na">⛔ بيانات نشاط المؤسسات غير متاحة — ' +
      '«دليل النشاط الذكي» بيقيس الأدلة المتاحة من السعر والحجم وتوصية المحللين، ' +
      'مش بيوثّق إن المؤسسات هي اللي بتشتري.</div></div>';

    /* ── الخطة والمخاطرة ── */
    const p = a2.plan, sz = a2.sizing;
    const plan =
      '<div class="rd-cardbox"><h3>🎯 خطة الدخول وإدارة المخاطر ' + tipBtn('riskReward') +
      '<span class="sp">' + esc(X.tr('ar', p.status)) + '</span></h3>' +
      '<div class="rd-plan">' +
      '<div class="rd-pv"><span>السعر الحالي</span><b>' + fmtPrice(p.current) + '</b></div>' +
      '<div class="rd-pv entry"><span>الدخول</span><b>' + (p.entry == null ? '—' : fmtPrice(p.entry)) + '</b></div>' +
      '<div class="rd-pv stop"><span>الوقف</span><b>' + (p.stop == null ? '—' : fmtPrice(p.stop)) + '</b></div>' +
      '<div class="rd-pv tgt"><span>الهدف ١</span><b>' + (p.target1 == null ? '—' : fmtPrice(p.target1)) + '</b></div>' +
      '<div class="rd-pv tgt"><span>الهدف ٢</span><b>' + (p.target2 == null ? '—' : fmtPrice(p.target2)) + '</b></div>' +
      '<div class="rd-pv"><span>العائد/المخاطرة</span><b>' + (p.rr == null ? '—' : p.rr) + '</b></div>' +
      '<div class="rd-pv"><span>الكمية (افتراضي)</span><b>' + (sz.qty == null ? '—' : fmtNum(sz.qty)) + '</b></div>' +
      '<div class="rd-pv"><span>قيمة المركز</span><b>' + (sz.positionValue == null ? '—' : fmtNum(sz.positionValue)) + '</b></div>' +
      '</div>' +
      (p.confirm ? '<div class="rd-txt"><b>شرط التأكيد:</b> ' + esc(p.confirm) + '</div>' : '') +
      (p.notes && p.notes.length ? '<div class="rd-warns">' + p.notes.map(n =>
        '<div class="rd-warn">⚠️ ' + esc(n) + '</div>').join('') + '</div>' : '') +
      (a2.risk.warnings.length ? '<div class="rd-warns">' + a2.risk.warnings.map(w =>
        '<div class="rd-warn ' + (w.k === 'institutional_na' ? 'na' : '') + '">⚠️ ' + esc(w.msg) + '</div>').join('') + '</div>' : '') +
      '<div class="rd-txt" style="margin-top:9px">' + esc(X.planText(a2, 'ar')) + '</div>' +
      '<div class="rd-txt" style="margin-top:6px;opacity:.85">⛔ كل المستويات افتراضية — ' +
      'مش أوامر. ⛔ تكاليف المعاملة غير مشمولة. ⛔ الكمية محسوبة على إعداداتك: ' +
      'رأس مال ' + fmtNum(S.money.capital) + ' · مخاطرة ' + S.money.riskPct + '% · ' +
      'سقف تخصيص ' + S.money.maxAllocPct + '%.</div>' +
      '</div>';

    /* ── البطاقة النهائية ── */
    const scoreRows = se.rows.map(r =>
      '<div class="rd-part ok"><i>•</i><span><b>' + esc(r.label) + '</b> = ' + r.value +
      ' <span style="opacity:.7">(وزن ' + r.weight + '%' +
      (r.baseWeight != null && Math.abs(r.weight - r.baseWeight) > 0.05 ? ' · بعد إعادة التوزيع من ' + r.baseWeight + '%' : '') +
      ')</span></span></div>').join('');
    const final =
      '<div class="rd-cardbox"><h3>🏁 الخلاصة التحليلية ' + tipBtn('classification') + '</h3>' +
      '<div class="rd-final"><h3>' + esc(card.title) + '</h3>' +
      '<p>' + esc(card.reason) + '</p>' +
      '<div class="st"><b>' + esc(se.label) + ':</b> ' + (se.total == null ? 'غير متاحة' : se.total + ' / 100') +
      ' · تغطية ' + se.completeness + '%' +
      (se.note ? ' · ' + esc(se.note) : '') + '</div>' +
      '<div class="rd-parts" style="margin-top:8px">' + scoreRows + '</div>' +
      ((a2.classification && a2.classification.missing && a2.classification.missing.length) ?
        '<ul>' + a2.classification.missing.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '') +
      '</div></div>';

    /* ── الخطوات ── */
    const stepBox =
      '<div class="rd-cardbox"><h3>🔄 كيف الرادار بيحلل السهم؟</h3><div class="rd-steps">' +
      steps.map(s => '<div class="rd-step ' + s.status + '"><i class="n">' + s.n + '</i>' +
        '<span>' + esc(s.title) + ' — <b>' + esc(s.detail) + '</b></span></div>').join('') +
      '</div></div>';

    /* ── الشارت ── */
    const chart =
      '<div class="rd-cardbox"><h3>📈 أداء السهم' +
      '<span class="sp">' + (a.dataTimestamp ? 'آخر جلسة: ' + esc(a.dataTimestamp) : '') + '</span></h3>' +
      '<div id="rdChart" style="height:300px;direction:ltr"></div>' +
      '<div id="rdChartText" class="rd-txt" style="margin-top:8px"></div></div>';

    return '<div class="rd-cardbox"><h3>📊 ' + esc(a.name) + ' ' + tipBtn('trend') +
      '<span class="sp">' + esc(a.code) + (a.sector ? ' · ' + esc(a.sector) : '') +
      ' · ' + fmtPrice(a.price) + (a.change != null ? ' (' + fmtPct(a.change) + ')' : '') + '</span></h3>' +
      '<div class="rd-txt">💡 ' + esc(X.trendText(a, 'ar')) + ' · ' + esc(X.momentumText(a, 'ar')) +
      ' · ' + esc(X.volumeText(a, 'ar')) + '</div></div>' +
      indicators + smart + plan + final + chart + stepBox;
  }

  function bindDetail(a) {
    /* التلميحات */
    document.querySelectorAll('[data-tip]').forEach(b => {
      b.addEventListener('click', () => showTip(b.getAttribute('data-tip')));
    });
    /* الشارت */
    const c = S.candles[a.code];
    if (c && c.length) {
      const box = $('rdChart');
      const txt = $('rdChartText');
      if (txt) {
        txt.innerHTML = '📊 ' + c.length + ' شمعة يومية · آخر ' + esc(c[c.length - 1].t) +
          ' · الإغلاق ' + fmtPrice(c[c.length - 1].c) +
          ' · أعلى ' + fmtPrice(c[c.length - 1].h) + ' · أدنى ' + fmtPrice(c[c.length - 1].l) +
          ' · الحجم ' + fmtNum(c[c.length - 1].v);
      }
      mountChart(box, c, a);
    }
  }

  /* ══════════════════════════════════════════════════════════════
   📈 5) الشارت — lightweight-charts (بيتحمّل عند الطلب)
   ══════════════════════════════════════════════════════════════ */
  let chartLib = null;
  function loadChartLib() {
    if (chartLib) return Promise.resolve(chartLib);
    if (window.LightweightCharts) { chartLib = window.LightweightCharts; return Promise.resolve(chartLib); }
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'assets/js/vendor/lightweight-charts.standalone.production.js';
      s.onload = () => { chartLib = window.LightweightCharts; res(chartLib); };
      s.onerror = () => rej(new Error('chart lib failed'));
      document.head.appendChild(s);
    });
  }
  function mountChart(box, candles, a) {
    if (!box) return;
    loadChartLib().then(lib => {
      try {
        const chart = lib.createChart(box, {
          layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b9eb0', fontSize: 10 },
          grid: { vertLines: { color: 'rgba(255,255,255,.05)' }, horzLines: { color: 'rgba(255,255,255,.05)' } },
          rightPriceScale: { borderColor: 'rgba(255,255,255,.12)' },
          timeScale: { borderColor: 'rgba(255,255,255,.12)', timeVisible: false },
          height: 300
        });
        const cs = chart.addSeries(lib.CandlestickSeries, {
          upColor: '#22c55e', downColor: '#ef4444',
          borderUpColor: '#22c55e', borderDownColor: '#ef4444',
          wickUpColor: '#22c55e', wickDownColor: '#ef4444'
        });
        cs.setData(candles.map(c => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c })));
        /* المتوسطات المتحركة */
        const closes = candles.map(c => c.c);
        function emaLine(len, color) {
          /* ⛔⛔ الإزاحة بتاعت EMA لازم تكون مظبوطة — لو غلطت
             candles[off+i] بيرجع undefined والشارت بيقع بالكامل.
             ⇒ العقد معرّف ومختبر في المحرك (R.emaAligned). */
          const data = R.emaAligned(closes, candles.map(c => c.t), len);
          if (!data || !data.length) return;
          const line = chart.addSeries(lib.LineSeries, { color: color, lineWidth: 1 });
          line.setData(data.map(d => ({ time: d.t, value: d.value })));
        }
        emaLine(20, '#d4af37'); emaLine(50, '#3b82f6'); emaLine(200, '#a855f7');
        /* الحجم */
        const vs = chart.addSeries(lib.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' }, 1);
        vs.setData(candles.map(c => ({
          time: c.t, value: c.v,
          color: c.c >= c.o ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'
        })));
        /* المستويات */
        const p = a.plan;
        if (p.entry) cs.createPriceLine({ price: p.entry, color: '#d4af37', lineWidth: 1, lineStyle: 2, title: 'دخول' });
        if (p.stop) cs.createPriceLine({ price: p.stop, color: '#ef4444', lineWidth: 1, lineStyle: 2, title: 'وقف' });
        if (p.target1) cs.createPriceLine({ price: p.target1, color: '#22c55e', lineWidth: 1, lineStyle: 2, title: 'هدف' });
        chart.timeScale().fitContent();
        window.addEventListener('resize', () => { try { chart.applyOptions({ width: box.clientWidth }); } catch (e) { } });
      } catch (e) {
        box.innerHTML = '<div class="rd-txt">⛔ تعذّر رسم الشارت — البيانات في النص تحت.</div>';
      }
    }).catch(() => {
      box.innerHTML = '<div class="rd-txt">⛔ مكتبة الشارت مش متاحة — البيانات في النص تحت.</div>';
    });
  }

  /* ══════════════════════════════════════════════════════════════
   💬 6) التلميحات التعليمية
   ══════════════════════════════════════════════════════════════ */
  function showTip(key) {
    const t = X.term(key, 'ar');
    if (!t) return;
    const bg = el('div', 'rd-modal-bg');
    bg.innerHTML = '<div class="rd-modal" role="dialog" aria-modal="true" aria-label="شرح">' +
      '<button class="x" type="button" aria-label="إغلاق">✕</button>' +
      '<h3>' + esc(key) + '</h3>' +
      '<h5>ما الذي يقيسه</h5><p>' + esc(t.what) + '</p>' +
      '<h5>لماذا يهمّك</h5><p>' + esc(t.why) + '</p>' +
      '<h5>كيف يستخدمه OCTA</h5><p>' + esc(t.how) + '</p>' +
      '<h5>ما الذي لا يعنيه</h5><p>' + esc(t.not) + '</p></div>';
    function close() { if (bg.parentNode) bg.parentNode.removeChild(bg); document.removeEventListener('keydown', esc2); }
    function esc2(e) { if (e.key === 'Escape') close(); }
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    bg.querySelector('.x').addEventListener('click', close);
    document.addEventListener('keydown', esc2);
    document.body.appendChild(bg);
  }

  /* ══════════════════════════════════════════════════════════════
   🎛️ 7) التحكم
   ══════════════════════════════════════════════════════════════ */
  function resetFilters() {
    S.q = ''; S.sector = 'all'; S.cls = 'all';
    S.minLiq = 'all'; S.minRR = 0; S.maxAtr = 0; S.minRvol = 0; S.showAll = false;
    const q = $('rdQ'); if (q) q.value = '';
    ['rdSect', 'rdCls', 'rdLiq', 'rdRR', 'rdAtr', 'rdRvol'].forEach(id => {
      const e = $(id); if (e) e.value = e.tagName === 'SELECT' ? (id === 'rdSect' ? 'all' : id === 'rdCls' ? 'all' : id === 'rdLiq' ? 'all' : '0') : '0';
    });
    const sa = $('rdShowAll'); if (sa) sa.classList.remove('on');
    renderList();
  }

  function fillSectors() {
    const s = $('rdSect');
    if (!s) return;
    const set = {};
    S.universe.forEach(u => { if (u.sector) set[u.sector] = (set[u.sector] || 0) + 1; });
    const keys = Object.keys(set).sort();
    s.innerHTML = '<option value="all">كل القطاعات (' + S.universe.length + ')</option>' +
      keys.map(k => '<option value="' + esc(k) + '">' + esc(k) + ' (' + set[k] + ')</option>').join('');
  }

  function bindControls() {
    const q = $('rdQ');
    if (q) q.addEventListener('input', () => { S.q = q.value.trim(); renderList(); });
    const sect = $('rdSect');
    if (sect) sect.addEventListener('change', () => { S.sector = sect.value; renderList(); });
    const cls = $('rdCls');
    if (cls) cls.addEventListener('change', () => { S.cls = cls.value; renderList(); });
    const sort = $('rdSort');
    if (sort) sort.addEventListener('change', () => { S.sort = sort.value; syncSortUI(); renderList(); });
    const dir = $('rdDir');
    if (dir) dir.addEventListener('click', () => {
      S.dir = -S.dir; syncSortUI(); renderList();
    });
    const prof = $('rdProfile');
    if (prof) prof.addEventListener('change', () => {
      S.profile = prof.value;
      const p = R.getProfile(prof.value);
      setStatus('busy', '⏳ بنعيد التحليل ببروفايل «' + p.name + '»…');
      reclassify();
    });
    const liq = $('rdLiq');
    if (liq) liq.addEventListener('change', () => { S.minLiq = liq.value; renderList(); });
    const rr = $('rdRR');
    if (rr) rr.addEventListener('change', () => { S.minRR = Number(rr.value) || 0; renderList(); });
    const atr = $('rdAtr');
    if (atr) atr.addEventListener('change', () => { S.maxAtr = Number(atr.value) || 0; renderList(); });
    const rv = $('rdRvol');
    if (rv) rv.addEventListener('change', () => { S.minRvol = Number(rv.value) || 0; renderList(); });
    const showAll = $('rdShowAll');
    if (showAll) showAll.addEventListener('click', () => {
      S.showAll = !S.showAll; showAll.classList.toggle('on', S.showAll); renderList();
    });
    const reset = $('rdReset');
    if (reset) reset.addEventListener('click', resetFilters);
    const scanB = $('rdScan');
    if (scanB) scanB.addEventListener('click', () => scan());
    const closeB = $('rdClose');
    if (closeB) closeB.addEventListener('click', () => {
      /* ⛔ بقى في صفحة مستقلة — «الإغلاق» بقى رجوع للقائمة */
      S.selected = null;
      backToList();
    });
  }

  /* ♻️ إعادة التصنيف بعد تغيير البروفايل (من غير إعادة جلب البيانات) */
  function reclassify() {
    S.results.forEach(a => {
      a.profile = R.getProfile(S.profile);
      a.score = R.compositeScore({
        trend: a.trend.score, momentum: a.momentum.score,
        volume: a.volume.score, risk: a.volatility.score
      }, a.profile, { total: R.COMPONENTS.length });
      a.classification = R.classify(a, a.profile);
    });
    renderAll();
    setStatus('live', '✅ تم المسح — ' + S.scan.done + ' سهم محلّل (بروفايل ' +
      R.getProfile(S.profile).name + ')');
  }

  function renderAll() {
    renderStats();
    renderList();
    if (S.selected && S.byCode[S.selected]) {
      /* ⛔ صفحة السهم المستقلة */
      const d = $('rdStockBody');
      if (d) { d.innerHTML = detailHTML(S.byCode[S.selected]); bindDetail(S.byCode[S.selected]); }
    }
  }

  /* ══════════════════════════════════════════════════════════════
   🚀 8) نقطة الدخول
   ══════════════════════════════════════════════════════════════ */
  window.radarInit = function () {
    if (S.started) { if (S.results.length) { renderAll(); } return; }
    S.started = true;
    bindControls();
    fillSectors();
    mountDiagBtn();
    /* 💾 كاش محلي الأول — لو فيه نتيجة من امبارح نطلع بيها فوراً
       بدل ما المستخدم يستنى دقايق كل مرة يفتح الصفحة. */
    if (loadCache()) return;
    setStatus('busy', '⏳ بنجهّز بيانات السوق…');
    (async () => {
      const okU = await loadUniverse();
      if (!okU) {
        setStatus('err', '⛔ مفيش بيانات سوق — تأكد إن الاتصال شغال');
        const b = $('rdList');
        if (b) b.innerHTML = '<div class="rd-empty"><h3>⛔ مفيش بيانات السوق</h3>' +
          '<p>محتاجين الوصول لبيانات البورصة. جرّب «تحديث» أو ارجع بعد شوية.</p>' +
          '<button class="rd-chip" id="rdRetry" type="button">↻ إعادة المحاولة</button></div>';
        const rb = $('rdRetry');
        if (rb) rb.onclick = () => { S.started = false; radarInit(); };
        return;
      }
      fillSectors();
      renderStats();
      await scan();
    })();
  };

  /* 🩺 زرار تشخيص — يظهر للمستخدم في الترويسة */
  function mountDiagBtn() {
    const b = $('rdDiagBtn');
    if (b && !b._rdBound) {
      b._rdBound = 1;
      b.onclick = showDiag;
    }
  }

  /* ↩ زرار الرجوع — مرة واحدة */
  function bindBack() {
    const b = $('rdBack');
    if (b && !b._rdBound) { b._rdBound = 1; b.onclick = backToList; }
  }

  /* ⛔ إتاحة الدالة للاختبارات */
  window.OCTA_RADAR_UI = {
    state: S, scan: scan, renderList: renderList, renderStats: renderStats,
    detailHTML: detailHTML, filtered: filtered, resetFilters: resetFilters,
    showDiag: showDiag, loadCache: loadCache, note: note,
    openStock: openStock, backToList: backToList, COLS: COLS,
    numFilterOk: numFilterOk, uniqStates: uniqStates
  };
})();
