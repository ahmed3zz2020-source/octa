/* ══════════════════════════════════════════════════════════════
   💰 Smart Money — فلتر المحاور الأربعة + كروت المؤشرات + الشارت
   ──────────────────────────────────────────────────────────────
   📌 الصفحة بتعمل ٣ حاجات:
      ① فلتر — ترتيب كل أسهم البورصة حسب قوة الـSmart Money
      ② كروت — شرح كل مؤشر: بيقيس إيه · قيمته كام · إيجابي ولا سالب
      ③ شارت — TradingView بالمؤشرات (RSI · MACD)

   📌 مصدر البيانات (٣ مصادر، كل واحد بيكمل التاني):
      · /api/markets?market=egypt    → سعر · حجم · تقلب · سيولة
      · /api/market_tech?market=egypt → RSI · MACD · SMA200 · حجم نسبي
      · OS_DB (من /api/data_full)     → احتياطي: متوسطات · أداء · مخاطر

   ⛔ كل رقم في الشاشة ده بييجي من المحرك (octa-smartmoney.js) —
      مافيش رقم مخترع ولا شرح من عندي.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ⛔ الملف بيتحمّل مرتين في index.html (بلوك السكربتات مكرر)
     ⇒ guard عشان ماتفتحش البيانات مرتين ولا تتربطش الأحداث مرتين. */
  if (window.__octaMoneyLoaded) return;
  window.__octaMoneyLoaded = true;

  /* ══════════ الحالة ══════════ */
  const S = {
    rows: [],        /* كل الأسهم بعد الدمج */
    view: [],        /* بعد الفلترة والترتيب */
    q: '', sect: 'all',
    sort: 'score', dir: -1,
    min: 0, agreeOnly: false, showWeak: false,
    /* 🔘 فلاتر إضافية (٢٣ أكتوبر ٢٠٢٦ — طلب أحمد) */
    accum: false,      /* تجميع مؤسسي فقط */
    perf: 0,           /* أقل عائد شهري % */
    priceBand: 'all',  /* نطاق السعر */
    relvol: 0,         /* أقل حجم نسبي */
    volBand: 'all',    /* نطاق التذبذب */
    sel: null,       /* الكود المفتوح */
    detail: null,    /* نتيجة الشموع */
    loading: false,
    ts: null,
    err: ''
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));

  /* ══════════════════════════════════════════════════════════════
   🧭 محتوى كارت الاستراتيجية (آخر الصفحة)
   ──────────────────────────────────────────────────────────────
   📌 مكتوب بعناية عشان المستخدم يفهم الفلتر من غير مصطلحات.
   ⛔ ممنوع: أسماء أدوات ذكاء اصطناعي · ادعاءات مبالغ فيها ·
   ⛔   أي رقم مش مطابق للمحرك.
   ══════════════════════════════════════════════════════════════ */
  const SM_GUIDE_HTML = [
    '<h3 class="sm-guide-h">🧭 إزاي الفلتر ده بيشتغل؟</h3>',
    '<p class="sm-guide-p">الفلتر بيدوّر على كل أسهم البورصة المصرية (حوالي ٢٩٥ سهم)،',
    'وبيقيّم كل سهم على <strong>٤ محاور</strong>، وبيجمع نتايجها بأوزان واضحة،',
    'وبيضيف <strong>مكافأة توافق</strong> لما المحاور تتفق مع بعض.',
    ' <strong>مهم: دي أداة ترتيب ودراسة مش نصيحة استثمار.</strong></p>',

    '<div class="sm-guide-grid">',
    '  <div class="sm-guide-c">',
    '    <div class="sm-guide-t">📈 محور الاتجاه <em class="sm-guide-en">Trend</em><span class="sm-guide-w">الوزن ٣٠٪</span></div>',
    '    <p>السعر فوق/تحت <strong>متوسط ٢٠٠ يوم</strong> (٢٥٪ من المحور)،',
    '       وتقاطع متوسط ٥٠ فوق ٢٠٠ (٢٠٪)، والسعر فوق/تحت متوسط ٥٠ (١٥٪).</p>',
    '    <p>وكمان أداء الشهر (٢٠٪) وأداء ٣ شهور (٢٠٪).</p>',
    '    <p><em>السوق صاعد ولا هابط؟</em></p>',
    '  </div>',
    '  <div class="sm-guide-c">',
    '    <div class="sm-guide-t">🚀 محور الزخم <em class="sm-guide-en">Momentum</em><span class="sm-guide-w">الوزن ٢٥٪</span></div>',
    '    <p><strong>RSI</strong> (٤٥٪): ٣٠ ⇒ صفر، و٧٠ ⇒ ١٠٠ — وفوق ٨٠ عقوبة',
    '       (تشبع شرائي)، وتحت ٣٠ تشبع بيعي.</p>',
    '    <p><strong>MACD</strong> مقابل خط الإشارة (٣٠٪)، وفوق/تحت الصفر (١٠٪)،',
    '       وأداء الأسبوع (١٥٪).</p>',
    '    <p><em>السير ماشي فين وبقوة؟</em></p>',
    '  </div>',
    '  <div class="sm-guide-c">',
    '    <div class="sm-guide-t">💰 محور الحجم <em class="sm-guide-en">Volume</em><span class="sm-guide-w">الوزن ٢٥٪</span></div>',
    '    <p><strong>الحجم النسبي</strong> مقابل متوسط ٣٠ يوم (٣٥٪)،',
    '       و<strong>تدفق مع الشراء/البيع</strong> = التغير × الحجم النسبي (٣٥٪).</p>',
    '    <p>وكمان الدوران اليومي من القيمة السوقية (٢٠٪)، وحجم اليوم مقابل',
    '       متوسط ٣٠ يوم (١٠٪).</p>',
    '    <p><em>الفلوس بتدخل ولا بتخرج؟</em></p>',
    '  </div>',
    '  <div class="sm-guide-c">',
    '    <div class="sm-guide-t">🌊 محور التذبذب <em class="sm-guide-en">Volatility</em><span class="sm-guide-w">الوزن ٢٠٪</span></div>',
    '    <p><strong>التقلب اليومي</strong> (٦٠٪): أقل من ٠.٨٪ ضعيف،',
    '       و<em>١.٥٪ – ٤.٥٪ هو النطاق المريح = درجة كاملة</em>، وفوق ٨٪ خطر.</p>',
    '    <p>وحساسية السهم لحركة السوق (٢٥٪). وأكبر تراجع خلال النافذة بيتحسب',
    '       من الشموع ويظهر في <strong>كارت السهم</strong>.</p>',
    '    <p><em>مستقر ولا عنيف؟</em></p>',
    '  </div>',
    '</div>',

    '<div class="sm-guide-score">',
    '  <div class="sm-guide-score-t">🧮 الدرجة من ٠ إلى ١٠٠ بتتحسب إزاي؟</div>',
    '  <p style="margin:0 0 6px;font-size:.78rem;color:var(--muted);line-height:1.75">',
    '  ولو سهم ناقصه جزء من المحور ⇒ الدرجة بتتحسب على الموجود بس،',
    '  والـ<strong>تغطية</strong> بتقل ⇒ رقم أقل = ثقة أقل.</p>',
    '  <div class="sm-guide-score-f">',
    '    كل قياس بيتحوّل الأول لدرجة من <b>٠</b> إلى <b>١٠٠</b>:',
    '    تحت الحد الأدنى = ضعيف (٠–٤٠) · في النطاق المريح = <b>١٠٠</b> ·',
    '    فوق النطاق = خصم تدريجي.<br>',
    '    الدرجة النهائية = <b>(الاتجاه×٣٠٪ + الزخم×٢٥٪ + الحجم×٢٥٪ + التذبذب×٢٠٪)</b>',
    '    + <b>مكافأة توافق لحد ١٠ نقاط</b>.<br>',
    '    والتوافق = ١ − (الفرق بين أعلى محور وأقله ÷ ١٠٠) — يعني كل ما المحاور',
    '    قريبة من بعض، زادت المكافأة. <b>والأسهم اللي محورها ضعيف بتتراجع تحت الترتيب.</b>',
    '  </div>',
    '</div>',

    '<div class="sm-guide-c" style="margin-bottom:var(--s3)">',
    '  <div class="sm-guide-t">🏷️ الشارات ومعناها</div>',
    '  <ul class="sm-guide-list">',
    '    <li><strong>توافق ٤ محاور</strong> — أقل محور ٥٠ أو أكتر (أقوى إشارة في الفلتر).</li>',
    '    <li><strong>تقارب كويس</strong> — أقل محور بين ٤٥ و٤٩ (قريب من التوافق).</li>',
    '    <li><strong>تجميع مؤسسي</strong> — تدفق الشراء ٨٠٪ أو أكتر (فلوس بتدخل).</li>',
    '    <li><strong>تصريف مؤسسي</strong> — تدفق البيع ٢٠٪ أو أقل (فلوس بتخرج).</li>',
    '    <li><strong>تقاطع ذهبي</strong> — متوسط ٥٠ فوق متوسط ٢٠٠.</li>',
    '    <li><strong>تشبع بيعي / تشبع شرائي</strong> — RSI تحت ٣٠ أو فوق ٨٠.</li>',
    '    <li><strong>تحت متوسط ٢٠٠</strong> — السعر لسه تحت خط المدى الطويل.</li>',
    '    <li><strong>بيانات ناقصة</strong> — أقل من ٣ محاور عندها بيانات (بتراجع لتحت الترتيب).</li>',
    '  </ul>',
    '</div>',

    '<div class="sm-guide-c" style="margin-bottom:var(--s3)">',
    '  <div class="sm-guide-t">🃏 المؤشرات اللي في كارت السهم</div>',
    '  <p style="margin:0 0 6px;font-size:.78rem;color:var(--muted);line-height:1.75">',
    '    الكارت مبني على <strong>٣٢٠ شمعة يومية حقيقية</strong> من مصادر السوق الفعلية،',
    '    وكل مؤشر بيوضّح: <strong>بيقيس إيه · قيمته دلوقتي · ✅ أو ❌</strong>',
    '    (مفيش حالة «محايد»).</p>',
    '  <ul class="sm-guide-list">',
    '    <li><strong>جيميني</strong> — قوة الاتجاه ومدى التشبع.</li>',
    '    <li><strong>القفل</strong> — داخل نطاق تذبذب ولا خرج منه.</li>',
    '    <li><strong>MCDX</strong> — زخم مركّب بيجمع أكتر من قراءة.</li>',
    '    <li><strong>RSI</strong> — قوة الحركة ومدى التشبع.</li>',
    '    <li><strong>MACD</strong> — اتجاه الزخم وقوته.</li>',
    '    <li><strong>ATR</strong> — حجم التذبذب (بيحسب نقطة وقف الخسارة).</li>',
    '    <li><strong>نموذج رانيا (٣ شموع)</strong> — شمعة قوية · شمعة تصحيح · شمعة كسرت القمة أو القاع.</li>',
    '    <li><strong>Order Block</strong> — آخر شمعة معاكسة قبل اندفاع قوي: زون مشتري أو بائع، وهل لسه صالح.</li>',
    '    <li><strong>المتوسطات ٨/١٣/٢١/٣٤/٥٥</strong> — مستويات مرجعية للسعر وترتيبها بيقول الاتجاه.</li>',
    '    <li><strong>VWAP</strong> — السعر العادل مرجّح بالحجم (السعر فوقه ولا تحته).</li>',
    '    <li><strong>BOS</strong> — هل اتكسر آخر قمة أو قاع.</li>',
    '  </ul>',
    '</div>',

    '<div class="sm-guide-tips">',
    '  <div class="sm-guide-tips-t">💡 نصائح قبل ما تتعامل مع النتيجة</div>',
    '  <ul>',
    '    <li>✅ استخدم الترتيب ك<b>قائمة بداية للدراسة</b> — مش كإشارة شراء أو بيع.</li>',
    '    <li>✅ لو فيه درجتين متقاربتين، قارن <b>المحور الأضعف</b> و<b>شارة التوافق</b> قبل ما تختار.</li>',
    '    <li>✅ اقرأ <b>خريطة المستويات</b> في كارت السهم: تقاطع سند أو مقاومة هو أهم من الدرجة نفسها.</li>',
    '    <li>📌 استخدم الفلاتر (القطاع · الحد الأدنى · توافق ٤ محاور) عشان تضيّق النتائج على نطاق واضح.</li>',
    '    <li>📌 لو غيّرت فلتر، راجع الترتيب من جديد — كل المقارنات لازم تكون على نفس الشروط.</li>',
    '    <li>⚠️ السهم المعلّم <b>«بيانات ناقصة»</b> أقل موثوقية — سيبه للمراجعة قبل أي قرار.</li>',
    '    <li>⚠️ المؤشرات بتوصف حالة السعر الآن، <b>مش توقّع للمستقبل</b> ومفيش ضمان للربح.</li>',
    '  </ul>',
    '</div>',

    '<p class="sm-guide-foot">دوس على أي سهم في الجدول ⇒ تشوف الرسم البياني + شريط كل المؤشرات + كارت كل مؤشر + خريطة المستويات</p>'
  ].join('\n');

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
  const f1 = (v) => num(v) != null ? Number(v).toFixed(1) : '—';
  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const f2 = (v) => num(v) != null ? Number(v).toFixed(2) : '—';
  /* 🎯 سعر بدون ما نضيّع خانات — للأرقام الصغيرة (٠.٢٤٨) الـtoFixed(2)
     كان بيحوّلها لـ«٠.٢٥» والهدف لـ«٠.٢» ⇒ مستحيل يفهمها المستخدم. */
  const fp = (v) => {
    if (num(v) == null) return '—';
    const n = Number(v);
    const d = n >= 100 ? 1 : n >= 10 ? 2 : n >= 1 ? 3 : n >= 0.1 ? 4 : n >= 0.01 ? 5 : 6;
    return n.toFixed(d).replace(/\.?0+$/, '') || '0';
  };
  const pct = (v) => num(v) != null ? (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' : '—';
  const clr = (v) => num(v) == null ? 'var(--muted)' : (v > 0 ? 'var(--up)' : (v < 0 ? 'var(--dn)' : 'var(--muted)'));

  /* الأيقونات للـ٤ محاور */
  const AX = {
    trend: { i: '📈', n: 'الاتجاه' },
    momentum: { i: '⚡', n: 'الزخم' },
    volatility: { i: '🌊', n: 'التذبذب' },
    volume: { i: '💧', n: 'الحجم' }
  };
  const SORTS = [
    { id: 'score', n: 'النتيجة', get: (r) => r.score },
    { id: 'trend', n: 'الاتجاه', get: (r) => r.axes.trend.score },
    { id: 'momentum', n: 'الزخم', get: (r) => r.axes.momentum.score },
    { id: 'volatility', n: 'التذبذب', get: (r) => r.axes.volatility.score },
    { id: 'volume', n: 'الحجم', get: (r) => r.axes.volume.score },
    { id: 'change', n: 'التغير', get: (r) => r.change },
    { id: 'price', n: 'السعر', get: (r) => r.price }
  ];

  /* ══════════════════════════════════════════════════════════════
   📥 تحميل البيانات
   ══════════════════════════════════════════════════════════════ */
  async function jget(path) {
    try {
      const r = await fetch((window.OCTA_API || '') + path, { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  /* ⏱ مهلة — لو الباك واقع ما ننتظرش طويل */
  function withTimeout(p, ms) {
    return new Promise((res) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; res(null); } }, ms);
      Promise.resolve(p).then((v) => { if (!done) { done = true; clearTimeout(t); res(v); } },
        () => { if (!done) { done = true; clearTimeout(t); res(null); } });
    });
  }

  /* 🗺️ الأسماء العربية — من ملف الأسماء (٢٧١ سهم) */
  function arName(code, fallback) {
    try {
      const m = window.OCTA_EGX_NAMES;
      if (m && m.names && m.names[code]) return m.names[code];
    } catch (e) { }
    return fallback || code;
  }
  function arSector(code, fallback) {
    try {
      const m = window.OCTA_EGX_NAMES;
      if (m && m.sectors && m.sectors[code]) return m.sectors[code];
    } catch (e) { }
    return fallback || '';
  }

  /* ⭐ مصدر ٢ — جسر الـWorker (سكانر TradingView من الـedge)
     ⛌ ده بيشتغل من غير الباك خالص — يعني الفلتر بيفتح وقت الأعطال.
       ⛔ الإنتاج مقفول (OCTA_TV_PROXY) — فبيسقط تلقائياً وميبانش. */
  async function tvBridge() {
    const j = await jget('/api/tvscan');
    if (!j || !j.ok || !j.rows || !j.rows.length) return null;
    const rows = j.rows.map(r => {
      const code = r.code;
      return Object.assign({}, r, {
        name: arName(code, code),
        sector: arSector(code, ''),
        _src: 'tv'
      });
    });
    return { rows: rows, src: 'tv' };
  }

  /* ⭐ مصدر ١ — الباك (المرجع: أسماء عربية + كل الحقول) */
  async function backendData() {
    const [mk, tech] = await Promise.all([
      jget('/api/markets?market=egypt'),
      jget('/api/market_tech?market=egypt')
    ]);
    const mkRows = (mk && mk.egypt) ? mk.egypt : [];
    if (!mkRows.length) return null;
    const techMap = (tech && tech.markets && tech.markets.egypt) ? tech.markets.egypt : {};
    const rows = mkRows.map(r => Object.assign({}, r, {
      name: arName(r.code, r.name),
      sector: arSector(r.code, r.sector),
      _tech: techMap[r.code] || null,
      _src: 'api'
    }));
    return { rows: rows, src: 'api' };
  }

  async function loadData(force) {
    if (S.loading) return;
    if (S.rows.length && !force) { render(); return; }
    S.loading = true; S.err = ''; renderStatus();

    /* ① السجل الأساسي (محمي) — فيه المتوسطات والأداء */
    try { if (typeof octaLoadDB === 'function') await octaLoadDB(); } catch (e) { }

    /* ② الباك الأول (المرجع) · لو واقع ⇒ جسر TradingView
       ⛌⛌ ٢٢ أكتوبر ٢٠٢٦ — أول نداء بعد أي نشر **بارد** عند
       TradingView (١٠-٤٠ ثانية) ⇒ كان المستخدم واقف على
       «بنجيب بيانات السوق» نص دقيقة. الحل:
       ① مهلة ٤٥ ثانية على الجسر (أطول من البرد)
       ② رسالة واضحة بتقول إيه اللي بيحصل
       ③ إعادة محاولة تلقائية لو فشل
       ④ و«تحديث» بيشتغل فوراً في أي وقت */
    const backend = await withTimeout(backendData(), 6000);
    let src = backend;
    if (!src) {
      setStatus('⏳ أول تحميل — TradingView بيحسب الأرقام (ممكن ياخد ٤٠ ثانية)…');
      src = await withTimeout(tvBridge(), 45000);
    }
    if (!src) {
      /* إعادة محاولة واحدة قبل ما نقول «مقدرتش» */
      await new Promise(r => setTimeout(r, 4000));
      src = await withTimeout(tvBridge(), 45000);
    }
    if (!src) {
      S.err = 'مقدرتش أجيب بيانات السوق دلوقتي. دوس «تحديث» وحاول تاني.';
      S.loading = false; renderStatus(); renderList(); return;
    }
    S.src = src.src;

    const dbMap = {};
    const db = (typeof OS_DB !== 'undefined' && OS_DB) ? OS_DB : [];
    for (let i = 0; i < db.length; i++) if (db[i] && db[i].code) dbMap[db[i].code] = db[i];

    const SM = window.OCTA_SM;
    const merged = [];
    for (let i = 0; i < src.rows.length; i++) {
      const r = src.rows[i];
      /* ⛔ استبعاد السندات الحكومية (EGP) — مش أسهم.
         ⛌   ٣ سندات كانت داخلة في الفلتر (منها واحد سعره ٠.١٣). */
      if (/-EGP$/i.test(String(r.code || ''))) continue;
      const m = SM.merge(r, r._tech || null, dbMap[r.code] || null);
      m.code = r.code;
      m.name = r.name || m.name;
      m.sector = r.sector || m.sector;
      merged.push(m);
    }
    /* أسهم السجل اللي مش في مصدر السوق */
    Object.keys(dbMap).forEach(code => {
      if (merged.some(x => x.code === code)) return;
      const m = SM.merge({ code: code }, null, dbMap[code]);
      m.code = code; m.name = dbMap[code].name || code;
      merged.push(m);
    });

    S.rows = SM.rank(merged);
    S.ts = new Date();
    S.loading = false;
    buildSectors();
    apply();
  }

  /* ══════════════════════════════════════════════════════════════
   🔍 الفلترة والترتيب
   ══════════════════════════════════════════════════════════════ */
  function apply() {
    const q = S.q.trim().toLowerCase();
    let list = S.rows.filter(r => {
      if (!S.showWeak && r.weak) return false;
      if (S.sect !== 'all' && r.sector !== S.sect) return false;
      if (S.min > 0 && r.score < S.min) return false;
      if (S.agreeOnly && !r.badges.some(b => b.id === 'agree')) return false;
      /* 🔘 تجميع مؤسسي فقط — الشارة اللي بتقول إن الفلوس بتدخل */
      if (S.accum && !r.badges.some(b => b.id === 'accum')) return false;
      /* 📈 أقل عائد شهري */
      if (S.perf > 0) {
        const p1m = r.m && r.m.perf1m;
        if (p1m == null || p1m < S.perf) return false;
      }
      /* 💵 نطاق السعر */
      if (S.priceBand !== 'all') {
        const px = r.price;
        if (px == null) return false;
        if (S.priceBand === 'lt5' && px >= 5) return false;
        if (S.priceBand === '5_15' && (px < 5 || px > 15)) return false;
        if (S.priceBand === '15_50' && (px <= 15 || px > 50)) return false;
        if (S.priceBand === 'gt50' && px <= 50) return false;
      }
      /* ⚡ أقل حجم نسبي (مقارنة بمتوسط ٣٠ يوم) */
      if (S.relvol > 0) {
        const rv = r.m && r.m.relvol;
        if (rv == null || rv < S.relvol) return false;
      }
      /* 🌊 نطاق التذبذب اليومي */
      if (S.volBand !== 'all') {
        const vd = r.m && r.m.volD;
        if (vd == null) return false;
        if (S.volBand === 'calm' && vd >= 1.5) return false;
        if (S.volBand === 'ok' && (vd < 1.5 || vd > 4.5)) return false;
        if (S.volBand === 'wild' && vd <= 4.5) return false;
      }
      if (q) {
        const hay = (r.code + ' ' + r.name + ' ' + (r.sector || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    const s = SORTS.filter(x => x.id === S.sort)[0] || SORTS[0];
    list.sort((a, b) => {
      const av = s.get(a), bv = s.get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * S.dir;
    });
    S.view = list;
    render();
  }

  function buildSectors() {
    const sel = $('smSect');
    if (!sel) return;
    const secs = [];
    const seen = {};
    for (let i = 0; i < S.rows.length; i++) {
      const s = S.rows[i].sector;
      if (s && !seen[s]) { seen[s] = 1; secs.push(s); }
    }
    secs.sort((a, b) => a.localeCompare(b, 'ar'));
    sel.innerHTML = '<option value="all">كل القطاعات</option>' +
      secs.map(s => '<option value="' + esc(s) + '"' + (S.sect === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    sel.value = S.sect;
  }

  /* ══════════════════════════════════════════════════════════════
   🎨 الرسم
   ══════════════════════════════════════════════════════════════ */
  /* سطر حالة مخصص (قبل ما البيانات تيجي) */
  function setStatus(txt) {
    const st = $('smStatus');
    if (st) st.innerHTML = '<span class="sm-dot"></span> ' + esc(txt);
  }

  function renderStatus() {
    const st = $('smStatus');
    if (!st) return;
    if (S.loading) { st.innerHTML = '<span class="sm-dot"></span> بنجيب بيانات السوق…'; return; }
    if (S.err) { st.innerHTML = '<span class="sm-dot err"></span> ' + esc(S.err); return; }
    const ok = S.rows.filter(r => !r.weak).length;
    const agree = S.rows.filter(r => r.badges.some(b => b.id === 'agree')).length;
    const t = $('smTotal'); if (t) t.textContent = S.rows.length;
    const o = $('smOk'); if (o) o.textContent = ok;
    const a = $('smAgreeN'); if (a) a.textContent = agree;
    const u = $('smUpd');
    if (u) u.textContent = S.ts ? S.ts.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';
    /* ⛌ مصدر البيانات — لازم المستخدم يعرف الأرقام جاية منين */
    /* ⚠️⚠️ مش «بيانات حية»! فيد TradingView للمؤشرات متأخر ١٥ دقيقة
       (delayed_streaming_900) والسعر = إغلاق الجلسة السابقة.
       ⛌   الكلمة دي كانت بتوحي إن السعر لحظي ⇒ تصحيح. */
    const srcTxt = S.src === 'tv'
      ? 'بيانات TradingView — متأخرة ١٥ دقيقة (إقفال الجلسة السابقة)'
      : 'بيانات المحرك';
    st.innerHTML = '<span class="sm-dot ok"></span> البيانات جاهزة · ' + srcTxt;
  }

  function bar(v, color) {
    const x = Math.max(0, Math.min(100, num(v) == null ? 0 : v));
    return '<span class="sm-bar"><i style="width:' + x + '%;background:' + (color || 'var(--gold)') + '"></i></span>';
  }

  function axisCell(key, r) {
    const a = r.axes[key];
    const v = a.score;
    const col = v >= 60 ? 'var(--up)' : (v >= 45 ? 'var(--gold)' : 'var(--dn)');
    return '<span class="sm-ax" title="' + esc(a.label) + '">' + AX[key].i +
      '<b style="color:' + col + '">' + Math.round(v) + '</b></span>';
  }

  function badgeHtml(r) {
    return r.badges.map(b =>
      '<span class="sm-badge' + (b.ok ? ' ok' : ' no') + '">' + (b.ok ? '✅' : '❌') + ' ' + esc(b.t) + '</span>'
    ).join('');
  }

  function renderList() {
    const box = $('smList');
    if (!box) return;
    if (S.err) {
      box.innerHTML = '<div class="sm-empty">⚠️ ' + esc(S.err) + '</div>';
      return;
    }
    if (!S.rows.length) {
      box.innerHTML = '<div class="sm-empty">⏳ بنجيب بيانات السوق…'
        + '<br><small>أول مرة ممكن تاخد ٤٠ ثانية — بعد كده بتبقى فورية</small>'
        + '<br><small>لو وقفت — دوس «تحديث»</small></div>';
      return;
    }
    if (!S.view.length) {
      /* ⛔ العدّاد لازم يصفّر مع الجدول (كان فاضل بيقول ٢٦٤) */
      const cz = $('smCount'); if (cz) cz.textContent = '0';
      box.innerHTML = '<div class="sm-empty">🚫 مفيش أسهم مطابقة للفلتر. جرّب حد أدنى أقل أو شيل الفلاتر.</div>';
      return;
    }
    /* ⛔⛔ باج ٢٣ أكتوبر ٢٠٢٦ — «أظهر ناقص البيانات» مكانش بيشتغل:
       ⛌   الجدول كان بيعرض أول ١٢٠ صف بس، والأسهم الناقصة (٣٠ سهم)
       ⛌   مرتبة في الآخر ⇒ كانت بره الشاشة ⇒ الفلتر مابغيّرش حاجة.
       ⛌ ✅ دلوقتي: ٣٢٠ صف (كل أسهم EGX) + سطر «و X سهم تاني» لو زاد. */
    const MAX_ROWS = 320;
    const rows = S.view.slice(0, MAX_ROWS);
    box.innerHTML =
      '<div class="sm-list-head">' +
      '<span class="sm-c1">السهم</span>' +
      '<span class="sm-c2">السعر</span>' +
      '<span class="sm-c3">Smart Money</span>' +
      '<span class="sm-c4">المحاور</span>' +
      '<span class="sm-c5">الحالة</span>' +
      '</div>' +
      rows.map(r =>
        '<div class="sm-row' + (r.weak ? ' weak' : '') + (S.sel === r.code ? ' sel' : '') + '" data-code="' + esc(r.code) + '" role="button" tabindex="0">' +
        '<span class="sm-c1"><b>' + esc(r.code) + '</b><i>' + esc(r.name) + '</i>' +
        (r.sector ? '<em>' + esc(r.sector) + '</em>' : '') + '</span>' +
        '<span class="sm-c2"><b>' + f2(r.price) + '</b><i style="color:' + clr(r.change) + '">' + pct(r.change) + '</i></span>' +
        '<span class="sm-c3"><b class="sm-score" style="color:' + (r.score >= 60 ? 'var(--up)' : (r.score >= 45 ? 'var(--gold)' : 'var(--dn)')) + '">' + Math.round(r.score) + '</b>' +
        bar(r.score, r.score >= 60 ? 'var(--up)' : (r.score >= 45 ? 'var(--gold)' : 'var(--dn)')) + '</span>' +
        '<span class="sm-c4">' + axisCell('trend', r) + axisCell('momentum', r) + axisCell('volatility', r) + axisCell('volume', r) + '</span>' +
        '<span class="sm-c5">' + badgeHtml(r) + '</span>' +
        '</div>').join('') +
      (S.view.length > rows.length
        ? '<div class="sm-more">و ' + (S.view.length - rows.length) + ' سهم تاني — ضيّق الفلتر عشان تشوفهم</div>'
        : '');
    const c = $('smCount');
    if (c) c.textContent = S.view.length;
  }

  function render() {
    renderStatus();
    renderList();
  }

  /* ══════════════════════════════════════════════════════════════
   🃏 كارت السهم — الكروت + الشارت
   ══════════════════════════════════════════════════════════════ */
  function moneyOpen(code) {
    S.sel = code;
    const r = S.rows.filter(x => x.code === code)[0];
    const box = $('smDetail');
    if (!r || !box) { renderList(); return; }
    box.style.display = 'block';
    box.innerHTML =
      '<div class="sm-d-hd">' +
      '<div><div class="sm-d-code">' + esc(r.code) + '</div><div class="sm-d-name">' + esc(r.name) + '</div>' +
      '<div class="sm-d-meta">' + esc(r.sector || '') + (r.m.price != null ? ' · ' + f2(r.m.price) + ' ج.م' : '') +
      ' <span style="color:' + clr(r.change) + '">' + pct(r.change) + '</span></div></div>' +
      '<div class="sm-d-score"><b style="color:' + (r.score >= 60 ? 'var(--up)' : (r.score >= 45 ? 'var(--gold)' : 'var(--dn)')) + '">' + Math.round(r.score) + '</b><i>Smart Money</i></div>' +
      '<button class="sm-d-close" type="button" id="smDClose" title="اقفل">✕</button>' +
      '</div>' +
      '<div class="sm-d-chart" id="smChart"></div>' +
      '<div class="sm-d-badges">' + badgeHtml(r) + '</div>' +
      /* ⭐ شريط المؤشرات — كل اللي اتفقنا عليه في سطر واحد */
      '<div class="sm-strip" id="smStrip"></div>' +
      /* ⭐ خريطة المستويات — المؤشرات على مقياس السعر */
      '<div class="sm-map-wrap" id="smMapWrap" style="display:none"></div>' +
      '<div class="sm-cards" id="smCards">' +
      '<div class="sm-loading">⏳ بنجيب الشموع عشان المؤشرات الذكية…</div>' +
      '</div>';
    renderList();
    /* ⬆️ نوديه على الشارت — اللوحة فوق الجدول دلوقتي */
    try {
      if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (window.scrollTo) window.scrollTo(0, 0);
    } catch (e) { }
    /* زرار القفل (مش onclick inline — شيفرة CSP) */
    const cl = $('smDClose');
    if (cl) cl.addEventListener('click', moneyClose);
    /* الشارت */
    try {
      if (window.OCTA_TV) {
        window.OCTA_TV.mount($('smChart'), {
          symbol: 'EGX:' + r.code, interval: '1D',
          /* ⭐⭐ المؤشرات اللي **احنا شغالين بيه** في الأداة — كلهم
             ظاهرين جوّه شارت TradingView (اتأكدت بـChromium حقيقي):
             📈 EMA (متوسط متحرك)  · 📊 VWAP (السعر العادل بالحجم)
             🌊 ATR (مدى التذبذب الحقيقي — نفس رقم كارتنا)
             ⚡ RSI (نفس رقم كارتنا)  · 📉 MACD (نفس رقم كارتنا)
             ℹ️ ⚠️ ملاحظة: TradingView بيتجاهل الأطوال المخصصة في الـembed
             البسيط ⇒ EMA بيبقى 9 (قريب من EMA 8 بتاعنا) والباقي
             بإعداداته الافتراضية (RSI 14 · MACD 12/26/9 · ATR 14 = بتاعنا).
             📌 المؤشرات الحصرية بتاعتنا (جيميني · القفل · MCDX · Order Block
             · نموذج رانيا) نسخ OCTA من شموع حقيقية — TradingView مش
             بيعرفها من غير Pine script ⇒ قيمها في الكروت والشريط. */
          studies: [
            { id: 'STD;EMA' },
            { id: 'STD;VWAP' },
            { id: 'ATR@tv-basicstudies' },
            { id: 'STD;RSI' },
            { id: 'STD;MACD' }
          ],
          compactMobile: false,
          minHeight: 560
        });
      }
    } catch (e) { /* الشارت مش لازم للصفحة تشتغل */ }
    /* ⚡ شريط المؤشرات — RSI/MACD فوراً (من داتا السوق)
       والباقي بعد ما الشموع تيجي */
    renderStrip(r, null);
    renderMap(r, null);
    /* الشموع → المؤشرات الثلاثة */
    loadDetail(r);
  }

  function moneyClose() {
    S.sel = null; S.detail = null;
    const box = $('smDetail');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    renderList();
  }

  async function loadDetail(r) {
    const box = $('smCards');
    if (!box) return;
    /* ① الباك (المرجع) · ② جسر المعاينة (لما الباك يكون واقع) */
    let j = await jget('/api/candles/' + encodeURIComponent(r.code) + '?n=320');
    let via = 'api';
    if (!j || !j.ok || !j.candles || j.candles.length < 25) {
      j = await jget('/api/tvcandles?code=' + encodeURIComponent(r.code) + '&n=320');
      via = 'tv';
    }
    if (!j || !j.ok || !j.candles || j.candles.length < 25) {
      /* ⛔⛔ سبب واضح — مش كارت فاضي. (٢٦ من ١٢٠ سهم رجّعوا
         ⛌   candles-failed ⇒ المستخدم كان بيشوف فراغ بلا تفسير) */
      const why = (j && j.error === 'candles-failed')
        ? 'مفيش تاريخ شموع متاح لهذا السهم من المصدر — جرّب سهم تاني.'
        : 'مقدرتش أجيب شموع السهم — المؤشرات الذكية مش متاحة دلوقتي.';
      box.innerHTML = '<div class="sm-loading">⚠️ ' + why + '</div>';
      return;
    }
    const SM = window.OCTA_SM;
    /* ⛔ البيانات القديمة (مثال TOUR: آخر شمعة ٢٠١٧) ⇒ مفيش مؤشرات.
         بنقول للمستخدم السبب بدل ما نعرض أرقام من ٩ سنين. */
    const age = (typeof SM.candleAgeDays === 'function') ? SM.candleAgeDays(j.candles) : null;
    const maxAge = (typeof SM.MAX_CANDLE_AGE_DAYS === 'function') ? SM.MAX_CANDLE_AGE_DAYS : 10;
    if (age != null && age > maxAge) {
      const last = j.candles[j.candles.length - 1];
      box.innerHTML = '<div class="sm-loading">⚠️ بيانات السهم دي قديمة — آخر تحديث ' +
        esc(String(last && last.t || 'غير معروف')) + ' (' + age + ' يوم). ' +
        'المؤشرات مش محسوبة عشان ما تبقاش مضلّلة.</div>';
      renderStrip(r, null);
      renderMap(r, null);
      return;
    }
    const d = SM.fromCandles(j.candles, r.m);
    if (!d) {
      box.innerHTML = '<div class="sm-loading">⚠️ الشموع المتاحة مش كفاية لحساب المؤشرات (محتاجة ٢٥ شمعة على الأقل).</div>';
      renderStrip(r, null);
      renderMap(r, null);
      return;
    }
    S.detail = d;
    /* ⚠️⚠️ المصدر: الشموع من **startamarkets** (مش TradingView).
       ⛌   النص القديم كان بيقول «من TradingView» ⇒ جملة غلط.
       ⛌ ✅ دلوقتي: «شموع يومية حقيقية من startamarkets» + تاريخ آخر شمعة. */
    const lastT = (j.candles && j.candles.length) ? String(j.candles[j.candles.length - 1].t || '') : '';
    box.innerHTML = cardsHtml(r, d) +
      '<div class="sm-src">المؤشرات محسوبة من ' + (j.count || (j.candles ? j.candles.length : 0)) +
      ' شمعة يومية حقيقية من startamarkets' +
      (lastT ? ' · آخر إغلاق ' + esc(lastT) : '') + '</div>';
    renderStrip(r, d);
    renderMap(r, d);
  }

  /* ══════════════════════════════════════════════════════════════
   🗺️ خريطة المستويات — المؤشرات على مقياس السعر
   ──────────────────────────────────────────────────────────────
   📌 كل مستوى (متوسطات · VWAP · زون Order Block · دعم/مقاومة)
   بيتحسب موضعه من السعر الحالي ويترسم عند نسبته.
   ⛌ CSS بس (مفيش canvas) — والشارت نفسه TradingView.
   ══════════════════════════════════════════════════════════════ */
  function renderMap(r, d) {
    const wrap = $('smMapWrap');
    if (!wrap) return;
    const price = num(r.price);
    if (!price) { wrap.style.display = 'none'; return; }
    const L = [];
    if (d && d.fib) {
      L.push({ v: d.fib.e8, n: 'EMA 8', c: 'ema' });
      L.push({ v: d.fib.e13, n: 'EMA 13', c: 'ema' });
      L.push({ v: d.fib.e21, n: 'EMA 21', c: 'ema' });
      L.push({ v: d.fib.e34, n: 'EMA 34', c: 'ema' });
      L.push({ v: d.fib.e55, n: 'EMA 55', c: 'ema' });
      if (d.fib.vwap) L.push({ v: d.fib.vwap, n: 'VWAP', c: 'vwap' });
    }
    if (d && d.orderBlock) {
      L.push({ v: (d.orderBlock.lo + d.orderBlock.hi) / 2, n: 'Order Block', c: 'ob', zone: [d.orderBlock.lo, d.orderBlock.hi] });
    }
    if (d && d.structure) {
      if (d.structure.support) L.push({ v: d.structure.support, n: 'دعم', c: 'sr' });
      if (d.structure.resistance) L.push({ v: d.structure.resistance, n: 'مقاومة', c: 'sr' });
    }
    if (!L.length) { wrap.style.display = 'none'; return; }

    /* المدى: أكبر بُعد حول السعر (محدود ١٪..٨٪) */
    let far = 0;
    L.forEach(l => { far = Math.max(far, Math.abs(l.v - price) / price * 100); });
    far = clamp(far * 1.15, 1.2, 8);

    const pos = (v) => clamp(50 - ((v - price) / price * 100) / far * 50, 2, 98);

    let html = '<div class="sm-map-h">🗺️ خريطة المستويات — السعر <b>' + f2(price) + '</b></div>';
    html += '<div class="sm-map">';
    /* خط السعر */
    html += '<div class="sm-map-price" style="top:50%"><span>' + f2(price) + '</span></div>';
    /* زون الـOrder Block */
    const ob = L.filter(x => x.zone)[0];
    if (ob) {
      const t1 = pos(ob.zone[1]), t2 = pos(ob.zone[0]);
      html += '<div class="sm-map-zone' + (d.orderBlock.state === 'bull' ? ' bull' : ' bear') +
        '" style="top:' + Math.min(t1, t2) + '%;height:' + Math.max(1.5, Math.abs(t2 - t1)) + '%"></div>';
    }
    L.forEach(l => {
      const p = pos(l.v);
      const above = l.v >= price;
      html += '<div class="sm-map-l ' + l.c + (above ? ' up' : ' dn') + '" style="top:' + p + '%">' +
        '<span>' + esc(l.n) + '</span><b>' + f2(l.v) + '</b></div>';
    });
    html += '</div>';
    html += '<div class="sm-map-f">فوق السعر = مقاومة · تحت السعر = دعم · الإطار الملوّن = زون الـOrder Block</div>';
    wrap.innerHTML = html;
    wrap.style.display = 'block';
  }

  /* ══════════════════════════════════════════════════════════════
   ⭐ شريط المؤشرات — كل المؤشرات في سطر واحد (زي الـtradingView)
   ──────────────────────────────────────────────────────────────
   RSI · MACD · ATR (متاحين في شارت TradingView)
   جيميني · القفل · MCDX · BOS (بنحسبهم إحنا — مش في شارت TV)
   ══════════════════════════════════════════════════════════════ */
  function chip(label, value, ok, title) {
    return '<span class="sm-chip-i' + (ok === null ? '' : (ok ? ' ok' : ' no')) + '" title="' + esc(title || label) + '">' +
      '<i>' + esc(label) + '</i><b>' + esc(value) + '</b></span>';
  }

  function renderStrip(r, d) {
    const el = $('smStrip');
    if (!el) return;
    const m = r.m || {};
    const out = [];

    /* ⓘ RSI */
    if (m.rsi != null) {
      const v = Math.round(m.rsi);
      out.push(chip('RSI', String(v), v > 80 ? false : (v < 30 ? null : true), 'مؤشر القوة النسبية —TradingView'));
    }
    /* ⓘ MACD */
    if (m.macd != null && m.macdSig != null) {
      const bull = m.macd > m.macdSig;
      out.push(chip('MACD', (bull ? '▲ ' : '▼ ') + f1(m.macd), bull, 'الزخم — TradingView'));
    }
    /* ⓘ ATR */
    if (d && d.atrPct != null) {
      out.push(chip('ATR', f1(d.atrPct) + '%', d.atrPct <= 4.5, 'مدى التذبذب الحقيقي — منه الدخول والهدف'));
    }
    /* ⓘ جيميني */
    if (d && d.gemini) {
      const g = d.gemini;
      const ok = (g.state === 'bull' || g.state === 'oversold');
      out.push(chip('جيميني', f1(g.value), ok, 'Banker Fund Oscillator'));
    }
    /* ⓘ القفل */
    if (d && d.lock) {
      const l = d.lock;
      out.push(chip('القفل', l.state === 'in' ? 'دخول' : (l.state === 'out' ? 'خروج' : 'محايد'),
        l.state === 'in' ? true : (l.state === 'out' ? false : null), 'تدفق الحجم — مؤسسية داخل ولا خارج'));
    }
    /* ⓘ MCDX */
    if (d && d.mcdx) {
      const x = d.mcdx;
      out.push(chip('MCDX', f1(x.value), x.state === 'inst' ? true : (x.state === 'retail' ? false : null),
        'مين ماسك السوق — مؤسسات ولا أفراد'));
    }
    /* ⓘ نموذج رانيا (٣ شموع) */
    if (d && d.rana) {
      const rp = d.rana;
      out.push(chip('نموذج رانيا', rp.state === 'bull' ? 'صاعد' : (rp.state === 'bear' ? 'هابط' : 'مفيش'),
        rp.state === 'bull' ? true : (rp.state === 'bear' ? false : null), rp.label));
    }
    /* ⓘ Order Block */
    if (d && d.orderBlock) {
      const ob = d.orderBlock;
      out.push(chip('Order Block', ob.state === 'bull' ? 'شراء' : 'بيع',
        (!ob.broken && ob.state === 'bull'), ob.label));
    }
    /* ⓘ المتوسطات الأسّية (فيبوناتشي) */
    if (d && d.fib) {
      out.push(chip('EMA 8/13/21', d.fib.align === 'up' ? 'صاعد' : (d.fib.align === 'down' ? 'هابط' : 'عرض'),
        d.fib.align === 'up' ? true : (d.fib.align === 'down' ? false : null), d.fib.label));
    }
    /* ⓘ VWAP */
    if (d && d.fib && d.fib.vwap != null) {
      out.push(chip('VWAP', fp(d.fib.vwap), d.fib.vwapSide === 'above' ? true : false,
        'السعر العادل المرجّح بالحجم — فوقه ولا تحته'));
    }
    /* ⓘ البنية */
    if (d && d.structure) {
      const st = d.structure;
      out.push(chip('BOS', st.bos === 'up' ? 'صاعد' : (st.bos === 'down' ? 'هابط' : (st.choc ? 'تغيّر طابع' : 'عرض')),
        st.state === 'bull' ? true : (st.state === 'bear' ? false : null), st.label));
    }
    el.innerHTML = out.join('');
  }

  /* كارت واحد: الاسم · القيمة · بيقيس إيه · الحكم
     ⛔ الحكم لازم يكون ✅ أو ❌ دايماً — مافيش «محايد».
        المستخدم بيسأل «أعمل إيه؟» فالإجابة لازم تكون واضحة. */
  function card(title, icon, value, measures, ok, why, extra) {
    return '<div class="sm-card' + (ok ? ' good' : ' bad') + '">' +
      '<div class="sm-card-h"><span class="sm-card-i">' + icon + '</span><span class="sm-card-t">' + esc(title) + '</span>' +
      '<span class="sm-card-v">' + value + '</span></div>' +
      '<div class="sm-card-m">📎 ' + esc(measures) + '</div>' +
      '<div class="sm-card-w">' + (ok ? '✅' : '❌') + ' ' + esc(why) + '</div>' +
      (extra ? '<div class="sm-card-x">' + extra + '</div>' : '') +
      '</div>';
  }

  function cardsHtml(r, d) {
    const out = [];

    /* ── المحاور الأربعة (من بيانات السوق) ── */
    ['trend', 'momentum', 'volatility', 'volume'].forEach(k => {
      const a = r.axes[k];
      if (!a.has || a.score == null) {
        /* ⚠️ محور بلا بيانات ⇒ نقوله بصراحة بدل ما نعرض رقم */
        out.push(card(AX[k].n, AX[k].i, 'مفيش بيانات',
          AX_MEASURE[k], false, 'مفيش قراءات كافية لهذا المحور — مش بيتحسب',
          '<div class="sm-lv3-i"><span>التغطية</span><b>٠٪</b></div>'));
        return;
      }
      const v = Math.round(a.score);
      const ok = v >= 55;
      const why = (ok ? 'قوي — ' : 'ضعيف — ') + partsText(a);
      /* 📊 التغطية: كام مؤشر من المحور اتاح فعلاً (شفافية) */
      const cov = Math.round((a.coverage == null ? 1 : a.coverage) * 100);
      const extra = '<div class="sm-lv3-i"><span>التغطية</span><b>' + cov + '%</b>' +
        '<i>' + a.parts.length + ' مؤشر</i></div>';
      out.push(card(AX[k].n, AX[k].i, v + ' / 100', AX_MEASURE[k], ok, why,
        bar(a.score, ok ? 'var(--up)' : 'var(--dn)') + extra));
    });

    if (!d) return out.join('');

    /* ── ① جيميني ── */
    if (d.gemini) {
      const g = d.gemini;
      const st = g.state;
      /* تشبع بيعي = فرصة (ضغط البيع خلص) · تشبع شرائي = خطر */
      const ok = (st === 'bull' || st === 'oversold');
      const why = st === 'overbought' ? 'تشبع شرائي — الخطر بقى أكبر من الفرصة'
        : st === 'oversold' ? 'تشبع بيعي — ضغط البيع خلص (فرصة، مش ترند مكسور)'
          : (st === 'bull' ? 'الفلوس الصاعدة أقوى من الهابطة' : 'الفلوس الهابطة أقوى');
      out.push(card('جيميني — ذكاء الفلوس', '🧠', f1(g.value) + ' / 100',
        'تقاطع تدفق الفلوس بين قصير المدى ومتوسط المدى. فوق ٨٠ تشبع شرائي · تحت ٢٠ تشبع بيعي',
        ok, why, geminiBars(g)));
    }

    /* ── ② القفل ── */
    if (d.lock) {
      const l = d.lock;
      const ok = l.state === 'in' ? true : (l.state === 'out' ? false : null);
      const why = l.state === 'in' ? 'مؤسسات داخل — حجم مع الصعود'
        : (l.state === 'out' ? 'مؤسسات بتسحب — حجم مع الهبوط' : 'مفيش اتجاه واضح في الحجم');
      out.push(card('القفل — تدفق الحجم', '🔒', l.state === 'in' ? 'دخول' : (l.state === 'out' ? 'خروج' : 'محايد'),
        'أعمدة الحجم بتقول المؤسسات دخلت ولا خرجت. مفيش أعمدة = المؤسسات بتسحب',
        ok, why, lockBars(l)));
    }

    /* ── ③ MCDX ── */
    if (d.mcdx) {
      const x = d.mcdx;
      const ok = x.state === 'inst';
      /* ⚠️⚠️ التصحيح: بعد قياس ارتباط MCDX (+٠.٦٩ مع العائد ٢٠ يوم)
         ⛌   ⇒ هو **مؤشر زخم ٢٠ يوم** بالأساس، مش «مؤسسات ضد أفراد».
         ⛌   التسمية القديمة كانت بتوحي بحاجة مش موجودة ⇒ نصحّحها. */
      const why = x.state === 'inst' ? 'تدفق الشراء هو الغالب على التدفق البيعي'
        : (x.state === 'retail' ? 'الأفراد مسيطرين — مش هما اللي بيتحكموا' : 'مفيش هيمنة واضحة — مش مؤشر ذكي');
      const cross = x.cross === 'gc' ? ' · التقاطع الذهبي = إشارة دخول'
        : (x.cross === 'dc' ? ' · التقاطع المميت = المؤسسات بتسحب' : '');
      out.push(card('MCDX — زخم التدفق', '⚖️', f1(x.value) + ' / 100',
        'قوة تدفق الفلوس مقارنةً بحجم التداول على ٢٠ يوم. فوق ٥٠ الشراء هو الغالب · تحت ٥٠ البيع هو الغالب' + cross,
        ok, why, mcdxBar(x)));
    }

    /* ── البنية ── */
    if (d.structure) {
      const s = d.structure;
      const ok = s.state === 'bull';
      out.push(card('البنية — BOS و CHoC', '🏗️', s.bos === 'up' ? 'BOS صاعد' : (s.bos === 'down' ? 'BOS هابط' : (s.choc ? 'تغيّر الطابع' : 'سوق عرض')),
        'كسر السقف أو الأرض = البنية الجديدة. كسر عكس الاتجاه = تغيّر الطابع',
        ok, s.label,
        '<div class="sm-lv"><span>مقاومة <b>' + f2(s.resistance) + '</b></span><span>دعم <b>' + f2(s.support) + '</b></span></div>'));
    }

    /* ── نموذج رانيا (٣ شموع) ── */
    if (d && d.rana) {
      const rp = d.rana;
      const ok = rp.state === 'bull' ? true : (rp.state === 'bear' ? false : null);
      const why = rp.state === 'bull'
        ? 'نموذج صاعد مكتمل — قاع في الشراء'
        : (rp.state === 'bear' ? 'نموذج هابط مكتمل — قاع في البيع' : 'مفيش نموذج ٣ شموع مكتمل');
      out.push(card('نموذج رانيا — ٣ شموع', '🕯️', rp.state === 'bull' ? 'صاعد' : (rp.state === 'bear' ? 'هابط' : 'مفيش'),
        'شمعة قوية · شمعة تصحيح · شمعة كسرت القمة/القاع. أشهر نموذج في مصر', ok, why,
        rp.state !== 'none' ? '<div class="sm-lv"><span>القوة <b>' + rp.strength + '/100</b></span>' +
          '<span>الحجم مؤكد <b>' + (rp.volOk ? '✅' : '❌') + '</b></span>' +
          '<span>مع الاتجاه <b>' + (rp.trendOk ? '✅' : '❌') + '</b></span>' +
          '<span>عمره <b>' + rp.age + ' يوم</b></span></div>' : ''));
    }

    /* ── أقصى التراجع (من الشموع) — مكمل محور التذبذب ── */
    if (d.mdd != null) {
      const mdd = d.mdd;
      const ok = mdd <= 35;
      out.push(card('أكبر تراجع — آخر ٣٢٠ يوم', '📉', f1(mdd) + '%',
        'أقصى نزول من القمة للإرضي خلال النافذة — كل ما قلّ، السهم كان مستقر',
        ok, mdd <= 35 ? 'تراجع محدود — السهم محافظ على قيمته'
          : (mdd <= 55 ? 'تراجع متوسط — طبيعي في السوق المصري' : 'تراجع كبير — مخاطرة عالية'),
        bar(clamp01((70 - mdd) / 30), ok ? 'var(--up)' : 'var(--dn)')));
    }

    /* ── Order Block ── */
    if (d && d.orderBlock) {
      const ob = d.orderBlock;
      /* ✅ الزون صالح وقابل للاعتماد (لما يكون زون طلب) · ❌ اتكسر أو مقاومة */
      const ok = (!ob.broken && ob.state === 'bull');
      out.push(card('Order Block — زون مؤسسي', '🧱', ob.state === 'bull' ? 'دعم' : 'مقاومة',
        'آخر شمعة معاكسة قبل اندفاع قوي — المكان اللي المؤسسات بتجمع فيه الأوامر',
        ok, ob.label,
        '<div class="sm-lv"><span>الزون <b>' + f2(ob.lo) + ' — ' + f2(ob.hi) + '</b></span>' +
        '<span>عمره <b>' + ob.age + ' يوم</b></span></div>'));
    }

    /* ── المتوسطات الأسّية + VWAP ── */
    if (d && d.fib) {
      const fb = d.fib;
      out.push(card('المتوسطات الأسّية (فيبوناتشي)', '📐', fb.align === 'up' ? 'ترتيب صاعد' : (fb.align === 'down' ? 'ترتيب هابط' : 'متشابكة'),
        'المتوسطات ٨·١٣·٢١·٣٤·٥٥ — ترتيبها بيقول الاتجاه، والبُعد بيقول قوته',
        fb.align === 'up' ? true : (fb.align === 'down' ? false : null), fb.label,
        '<div class="sm-lv3">' +
        '<div class="sm-lv3-i"><span>EMA 8</span><b>' + fp(fb.e8) + '</b></div>' +
        '<div class="sm-lv3-i"><span>EMA 21</span><b>' + fp(fb.e21) + '</b></div>' +
        '<div class="sm-lv3-i"><span>EMA 55</span><b>' + fp(fb.e55) + '</b></div>' +
        '<div class="sm-lv3-i"><span>VWAP</span><b>' + fp(fb.vwap) + '</b><i>' + (fb.vwapSide === 'above' ? 'فوق السعر' : 'تحت السعر') + '</i></div>' +
        '</div>'));
    }

    /* ── مستويات الـATR ── */
    if (d.levels) {
      const L = d.levels;
      out.push('<div class="sm-card sm-card-wide">' +
        '<div class="sm-card-h"><span class="sm-card-i">🎯</span><span class="sm-card-t">الدخول ووقف الخسارة والهدف</span>' +
        '<span class="sm-card-v">ATR ' + fp(d.atr) + ' (' + f1(d.atrPct) + '% من السعر)</span></div>' +
        '<div class="sm-lv3">' +
        '<div class="sm-lv3-i"><span>دخول</span><b>' + fp(L.entry) + '</b></div>' +
        '<div class="sm-lv3-i stop"><span>وقف الخسارة (تحت)</span>' +
          '<b>' + fp(L.stop) + '</b><i>' + f1(Math.abs(L.stopPct)) + '%</i></div>' +
        '<div class="sm-lv3-i tgt"><span>هدف أول (فوق)</span>' +
          '<b>' + fp(L.target) + '</b><i>' + f1(Math.abs(L.targetPct)) + '%</i></div>' +
        '</div>' +
        '<div class="sm-card-m">📎 المسافة محسوبة من مدى التذبذب الحقيقي (ATR) — مش رقم مخترع.' +
        (L.dirLabel ? ' · <b>' + L.dirLabel + '</b>' : '') +
        (L.bearNote ? '<br>' + L.bearNote : '') + '</div>' +
        '</div>');
    }

    return out.join('');
  }

  const AX_MEASURE = {
    trend: 'السوق صاعد ولا هابط · السعر فوق المتوسطات المتحركة',
    momentum: 'قوة الحركة · RSI و MACD (مع عقوبة التشبع)',
    volatility: 'سرعة تغيّر السعر · مقاس بالنطاق المريح للسوق',
    volume: 'ضغط التدفق والسيولة · هل فيه فلوس بتدخل'
  };

  function partsText(a) {
    const bits = a.parts.map(p => p.txt).filter(Boolean);
    if (!bits.length) return 'مفيش بيانات كفاية';
    return bits.slice(0, 3).join(' · ');
  }

  function geminiBars(g) {
    const st = g.short, mt = g.mid;
    const w = (v) => Math.max(6, Math.min(100, Math.abs(v) * 220 + 12));
    return '<div class="sm-gem">' +
      '<span class="sm-gem-i' + (st >= mt ? ' up' : ' dn') + '">قصير المدى <i style="width:' + w(st) + '%"></i></span>' +
      '<span class="sm-gem-i' + (st >= mt ? ' up' : ' dn') + '">متوسط المدى <i style="width:' + w(mt) + '%"></i></span>' +
      '<span class="sm-gem-n">الفرق ' + f1(g.spread) + '%</span></div>';
  }

  function lockBars(l) {
    const max = Math.max.apply(null, l.bars.map(b => Math.abs(b)).concat([0.5]));
    return '<div class="sm-lock">' + l.bars.map(b =>
      '<i class="' + (b >= 0 ? 'up' : 'dn') + '" style="height:' + (Math.abs(b) / max * 100) + '%"></i>').join('') + '</div>';
  }

  function mcdxBar(x) {
    const p = Math.max(0, Math.min(100, x.value));
    return '<div class="sm-mcdx"><span class="sm-mcdx-retail">أفراد</span>' +
      '<span class="sm-mcdx-bar"><i style="width:' + p + '%"></i></span>' +
      '<span class="sm-mcdx-inst">مؤسسات</span>' +
      '<span class="sm-mcdx-gap">الفجوة ' + f1(x.gap) + '</span></div>';
  }

  /* ══════════════════════════════════════════════════════════════
   🔌 التهيئة + الأحداث
   ══════════════════════════════════════════════════════════════ */
  window.moneyInit = function () {
    renderGuide();
    if (!S.rows.length) loadData(); else render();
  };

  /* ══════════════════════════════════════════════════════════════
   🧭 كارت الاستراتيجية — آخر الصفحة
   ──────────────────────────────────────────────────────────────
   📌 المحتوى ثابت (مش متغيّر بالفلاتر) ⇒ يتكتب مرة واحدة.
   ══════════════════════════════════════════════════════════════ */
  function renderGuide() {
    const g = $('smGuide');
    if (!g) return;
    if (g.getAttribute && g.getAttribute('data-done') === '1') return;
    g.innerHTML = SM_GUIDE_HTML;
    if (g.setAttribute) g.setAttribute('data-done', '1');
  }
  window.moneyOpen = moneyOpen;
  window.moneyClose = moneyClose;
  window.moneyReload = function () { S.rows = []; loadData(true); };

  function bind() {
    const q = $('smQ');
    if (q) q.addEventListener('input', function () { S.q = q.value; apply(); });
    const sort = $('smSort');
    if (sort) sort.addEventListener('change', function () { S.sort = sort.value; apply(); });
    const sect = $('smSect');
    if (sect) sect.addEventListener('change', function () { S.sect = sect.value; apply(); });
    const min = $('smMin');
    if (min) min.addEventListener('input', function () {
      S.min = Number(min.value || 0);
      const v = $('smMinV'); if (v) v.textContent = S.min;
      apply();
    });
    const ag = $('smAgree');
    if (ag) ag.addEventListener('click', function () {
      S.agreeOnly = !S.agreeOnly;
      ag.classList.toggle('on', S.agreeOnly);
      apply();
    });
    const weak = $('smWeak');
    if (weak) weak.addEventListener('click', function () {
      S.showWeak = !S.showWeak;
      weak.classList.toggle('on', S.showWeak);
      apply();
    });
    /* 🔘 تجميع مؤسسي فقط */
    const acc = $('smAccum');
    if (acc) acc.addEventListener('click', function () {
      S.accum = !S.accum;
      acc.classList.toggle('on', S.accum);
      apply();
    });
    /* 📈 العائد الشهري الأدنى */
    const perf = $('smPerf');
    if (perf) perf.addEventListener('change', function () {
      S.perf = Number(perf.value || 0);
      apply();
    });
    /* 💵 نطاق السعر */
    const pb = $('smPrice');
    if (pb) pb.addEventListener('change', function () {
      S.priceBand = pb.value || 'all';
      apply();
    });
    /* ⚡ الحجم النسبي الأدنى */
    const rl = $('smRel');
    if (rl) rl.addEventListener('change', function () {
      S.relvol = Number(rl.value || 0);
      apply();
    });
    /* 🌊 نطاق التذبذب */
    const vb = $('smVol');
    if (vb) vb.addEventListener('change', function () {
      S.volBand = vb.value || 'all';
      apply();
    });
    /* ↺ تصفير كل الفلاتر */
    const rs = $('smReset');
    if (rs) rs.addEventListener('click', function () {
      S.q = ''; S.sect = 'all'; S.min = 0; S.agreeOnly = false; S.showWeak = false;
      S.accum = false; S.perf = 0; S.priceBand = 'all'; S.relvol = 0; S.volBand = 'all';
      const qi = $('smQ'); if (qi) qi.value = '';
      const so = $('smSort'); if (so) so.value = 'score';
      const se = $('smSect'); if (se) se.value = 'all';
      const mv = $('smMinV'); if (mv) mv.textContent = '0';
      const mp = $('smPerf'); if (mp) mp.value = '0';
      const mpb = $('smPrice'); if (mpb) mpb.value = 'all';
      const mr = $('smRel'); if (mr) mr.value = '0';
      const mv2 = $('smVol'); if (mv2) mv2.value = 'all';
      const mi = $('smMin'); if (mi) mi.value = '0';
      ['smAgree', 'smAccum', 'smWeak'].forEach(id => {
        const b = $(id); if (b) b.classList.remove('on');
      });
      S.sort = 'score'; S.dir = -1;
      const dr = $('smDir'); if (dr) dr.textContent = '\u2B06';
      apply();
    });
    const re = $('smReload');
    if (re) re.addEventListener('click', function () { window.moneyReload(); });
    const dir = $('smDir');
    if (dir) dir.addEventListener('click', function () {
      S.dir = -S.dir;
      dir.textContent = S.dir < 0 ? '\u2B07' : '\u2B06';
      apply();
    });
    /* 🖱 النقر على صف السهم — تفويض (مش onclick inline: سياسة الأمان) */
    const list = $('smList');
    if (list) {
      list.addEventListener('click', function (e) {
        const row = e.target && e.target.closest ? e.target.closest('.sm-row') : null;
        if (!row) return;
        const code = row.getAttribute('data-code');
        if (code) moneyOpen(code);
      });
      list.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const row = e.target && e.target.closest ? e.target.closest('.sm-row') : null;
        if (!row) return;
        e.preventDefault();
        const code = row.getAttribute('data-code');
        if (code) moneyOpen(code);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

})();
