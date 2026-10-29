/* ══════════════════════════════════════════════════════════════════
   💰 تبويب «الادخار» — ذكاء الذهب (٢٧ أكتوبر ٢٠٢٦)
   ══════════════════════════════════════════════════════════════════
   📌 الهدف: يحوّل كارت «ذهب / جرام عيار ٢٤» لأداة ادخار حقيقية:
      الخلاصة · العائد الاسمي مقابل الحقيقي بعد التضخم · ٤ سيناريوهات
      بشروط قابلة للقياس · محرك العوامل · التفكيك · المستويات.

   ⛔⛔ قواعد المحتوى (من المواصفات):
      · مفيش احتمالات ولا نسب مختلقة — الشروط مرصودة.
      · مفيش توصية شراء/بيع ولا وعود.
      · كل رقم ليه مصدر، واللي ناقص مكتوب «غير متاح» + السبب.
      · مفيش أي اسم أداة ذكاء اصطناعي في النص.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ⛔⛔ الـAPI base لازم يتقرا **وقت الطلب** مش وقت تحميل الملف —
     octa-api.js بيكتب OCTA_API بعدين (وبيبدّله بالفailover). */
  function apiBase() { return (window.OCTA_API || ''); }
  var CACHE = { data: null, at: 0, hist: null, histAt: 0 };
  var TTL = 5 * 60 * 1000;

  /* ── أدوات ───────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v, d) {
    if (v == null || isNaN(v)) return '—';
    try {
      return Number(v).toLocaleString('en-US', {
        minimumFractionDigits: d == null ? 0 : d,
        maximumFractionDigits: d == null ? 0 : d
      });
    } catch (e) { return String(v); }
  }
  function sgn(v, d) {
    if (v == null || isNaN(v)) return '—';
    var x = Number(v);
    /* ⛔⛔ لازم dir="ltr" — من غيرها الإشارة بتتقلب في RTL
       («+402%» بتطلع «402%+») وبتبان غلط. */
    return '<span dir="ltr">' +
      (x > 0 ? '+' : x < 0 ? '−' : '') + num(Math.abs(x), d == null ? 1 : d) + '%</span>';
  }
  /* فرق بالجنيه (مش %) — نفس مشكلة الاتجاه */
  function sgnEgp(v) {
    if (v == null || isNaN(v)) return '—';
    var x = Number(v);
    return '<span dir="ltr">' +
      (x > 0 ? '+' : x < 0 ? '−' : '') + num(Math.abs(x), 0) + ' ج.م</span>';
  }
  function cls(v) {
    if (v == null || isNaN(v)) return 'gflat';
    return Number(v) > 0 ? 'gup' : Number(v) < 0 ? 'gdown' : 'gflat';
  }
  /* 📌 التواريخ من الباك جاية ISO (2026-09-17) ⇒ نحوّلها DD/MM/YYYY
     (النمط المصري) — النمط الأوروبي (17-09-2026) مش مألوف عند المستخدم. */
  function dtxt(s) {
    return String(s == null ? '' : s).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,
      function (m, y, mo, d) { return d + '/' + mo + '/' + y; });
  }
  function jfetch(path) {
    var f = (typeof window.octaFetch === 'function') ? window.octaFetch : window.fetch;
    return f(apiBase() + path, { credentials: 'include' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ── بطاقات ───────────────────────────────────────────── */
  function card(title, sub, body, tone) {
    return '<div class="gsc gsave-card' + (tone ? ' gsave-card--' + tone : '') + '">' +
      '<div class="gsave-card-h"><div class="gsave-card-t">' + title + '</div>' +
      (sub ? '<div class="gsave-card-s">' + sub + '</div>' : '') + '</div>' +
      '<div class="gsave-card-b">' + body + '</div></div>';
  }
  function kv(label, value, note, tone) {
    return '<div class="gsave-kv">' +
      '<span class="gsave-kv-l">' + label + '</span>' +
      '<span class="gsave-kv-v ' + (tone || '') + '">' + value + '</span>' +
      (note ? '<span class="gsave-kv-n">' + note + '</span>' : '') +
      '</div>';
  }
  function ul(items, cls2) {
    return '<ul class="gsave-ul ' + (cls2 || '') + '">' +
      (items || []).map(function (i) { return '<li>' + i + '</li>'; }).join('') +
      '</ul>';
  }

  /* ══════════════════════════════════════════════════════
     ① الخلاصة التحليلية
     ══════════════════════════════════════════════════════ */
  function secSummary(d) {
    var lines = d.summary || [];
    if (!lines.length) {
      return card('الخلاصة', '', '<div class="gmute">الخلاصة غير متاحة دلوقتي.</div>');
    }
    return card('🧭 الخلاصة التحليلية',
      'أسطر حتمية مبنية على الأرقام — مش نص إنشائي',
      '<div class="gsave-sum">' + lines.map(function (l) {
        return '<div class="gsave-sum-l"><span class="gsave-sum-d"></span>' + esc(l) + '</div>';
      }).join('') + '</div>');
  }

  /* ══════════════════════════════════════════════════════
     ② سعر الجرام
     ══════════════════════════════════════════════════════ */
  function secPrice(d) {
    var c = d.current || {};
    var hist = (d.sources || {}).history || {};
    var fx = (hist.fx || {});
    var body = '<div class="gsave-hero">' +
      '<div class="gsave-hero-p">' + num(c.gram, 0) + ' <span class="gsave-hero-u">ج.م / جرام عيار ٢٤</span></div>' +
      '<div class="gsave-hero-d">السلسلة النظرية — <span dir="ltr">' + dtxt(c.date || '') +
      (c.effective_date_cairo ? ' (إقفال ' + dtxt(c.effective_date_cairo) + ')' : '') + '</span></div>' +
      '</div>' +
      kv('سعر الدولار', num(c.egp_per_usd, 3) + ' جنيه/دولار',
        fx.symbol ? 'المصدر: ' + esc(fx.symbol) : '') +
      kv('نقاط السلسلة', num(hist.count, 0) + ' نقطة',
        hist.from ? 'من <span dir="ltr">' + dtxt(hist.from) + ' → ' + dtxt(hist.to) + '</span>' : '') +
      (hist.gaps && hist.gaps.count ?
        kv('فجوات', num(hist.gaps.count, 0) + ' يوم',
          'أيام مفيش فيها سعر صرف — الرسم بيقطع الخط عندها (مفيش داتا متخيّلة)') : '');
    return card('💰 سعر الجرام', 'المحسوب من الذهب العالمي × سعر الصرف الرسمي', body);
  }

  /* ══════════════════════════════════════════════════════
     ③ الادخار: اسمي مقابل حقيقي
     ══════════════════════════════════════════════════════ */
  function secSavings(d) {
    var sv = d.savings || {};
    if (!sv.ok) {
      return card('🏦 العائد على الادخار', '', '<div class="gmute">' +
        esc(sv.error || 'غير متاح') + '</div>');
    }
    var rows = (sv.rows || []).map(function (r) {
      var rl = r.real || {};
      var real = rl.real_pct == null
        ? '<span class="gflat">غير متاح</span>'
        : '<span class="' + cls(rl.real_pct) + '">' + sgn(rl.real_pct, 1) + '</span>';
      var infl = rl.inflation_pct == null
        ? '<span class="gflat">—</span>'
        : sgn(rl.inflation_pct, 1);
      return '<tr>' +
        '<td class="gsave-td">' + num(r.years, 0) + ' سنة</td>' +
        '<td class="gsave-td gsave-td--hl">' + sgn(r.nominal_pct, 1) +
        '<small>×' + num(r.times, 2) + '</small></td>' +
        '<td class="gsave-td">' + infl + '</td>' +
        '<td class="gsave-td">' + real +
        (rl.real_times ? '<small>×' + num(rl.real_times, 2) + '</small>' : '') + '</td>' +
        '</tr>';
    }).join('');
    var ex = (sv.rows || []).filter(function (r) { return r.years >= 9; })[0];
    var exBody = '';
    if (ex && ex.example && ex.example.value_now_egp != null) {
      var e = ex.example;
      exBody = '<div class="gsave-ex">' +
        '<div class="gsave-ex-t">مثال: ادّخرت ' + num(e.amount_egp, 0) + ' ج.م قبل ' +
        num(ex.years, 0) + ' سنة</div>' +
        '<div class="gsave-ex-r">الاسمية: <b>' + num(e.value_now_egp, 0) + ' ج.م</b>' +
        (e.value_now_real_egp != null
          ? ' · الحقيقية بعد التضخم: <b>' + num(e.value_now_real_egp, 0) + ' ج.م</b>' : '') +
        '</div>' +
        (e.note ? '<div class="gsave-ex-n">' + esc(e.note) + '</div>' : '') +
        '</div>';
    }
    var body = '<div class="gsave-tblwrap"><table class="gsave-tbl">' +
      '<thead><tr><th>المدة</th><th>العائد الاسمي</th><th>التضخم</th><th>العائد الحقيقي</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' + exBody +
      '<div class="gnote">' + esc(sv.caveat || '') + '</div>';
    return card('🏦 العائد على الادخار', 'الاسمي مقابل الحقيقي بعد التضخم المصري', body);
  }

  /* ══════════════════════════════════════════════════════
     ④ السيناريوهات
     ══════════════════════════════════════════════════════ */
  function secScenarios(d) {
    var scs = d.scenarios || [];
    if (!scs.length) return '';
    var body = scs.map(function (s) {
      if (s.key === 'currency') return scCurrency(s);
      var trig = s.trigger || {};
      var inv = s.invalidation || {};
      var tg = (s.targets || []).map(function (t) {
        return '<li>' + (t.level != null
          ? '<b>' + num(t.level, 0) + ' ج.م</b> — ' + esc(dtxt(t.basis || ''))
          : esc(t.basis || '') + (t.note ? ' (' + esc(t.note) + ')' : '')) + '</li>';
      }).join('');
      var tone = s.key === 'bull' ? 'up' : (s.key === 'bear' ? 'down' : '');
      return '<div class="gsave-sc gsave-sc--' + (tone || 'flat') + '">' +
        '<div class="gsave-sc-h">' + esc(s.name_ar) + '</div>' +
        '<div class="gsave-sc-state">' + esc(dtxt(s.state || '')) + '</div>' +
        '<div class="gsave-sc-row"><span class="gsave-sc-l">الشرط</span>' +
        '<span class="gsave-sc-v">' + esc(dtxt(trig.text || '—')) + '</span></div>' +
        (trig.evidence ? '<div class="gsave-sc-ev">الدليل: ' + esc(dtxt(trig.evidence)) + '</div>' : '') +
        (tg ? '<div class="gsave-sc-row"><span class="gsave-sc-l">الهدف</span>' +
          '<ul class="gsave-ul gsave-ul--tight">' + tg + '</ul></div>' : '') +
        '<div class="gsave-sc-row"><span class="gsave-sc-l">يُبطَل لو</span>' +
        '<span class="gsave-sc-v">' + esc(dtxt(inv.text || '—')) + '</span></div>' +
        (s.horizon ? '<div class="gsave-sc-row"><span class="gsave-sc-l">الأفق</span>' +
          '<span class="gsave-sc-v">' + esc(dtxt(s.horizon)) + '</span></div>' : '') +
        (s.what_to_watch && s.what_to_watch.length ?
          '<div class="gsave-sc-row"><span class="gsave-sc-l">تابع</span>' +
          ul(s.what_to_watch, 'gsave-ul--tight') + '</div>' : '') +
        (s.caveat ? '<div class="gsave-sc-c">' + esc(dtxt(s.caveat)) + '</div>' : '') +
        '</div>';
    }).join('');
    return card('🎯 السيناريوهات',
      'شروط قابلة للقياس — مفيش احتمالات ولا توقّعات', body);
  }
  function scCurrency(s) {
    var steps = (s.steps || []).filter(function (p) { return typeof p === 'object'; });
    var rows = steps.map(function (p) {
      return '<tr><td class="gsave-td"><span dir="ltr">' +
        (p.fx_move_pct > 0 ? '+' : p.fx_move_pct < 0 ? '−' : '') +
        num(Math.abs(p.fx_move_pct), 0) + '%</span></td>' +
        '<td class="gsave-td">' + num(p.fx_new, 2) + '</td>' +
        '<td class="gsave-td">' + num(p.gram_if_gold_flat, 0) + '</td>' +
        '<td class="gsave-td ' + cls(p.gram_delta_egp) + '">' +
        sgnEgp(p.gram_delta_egp) + '</td></tr>';
    }).join('');
    var lv = s.levels || {};
    var body = '<div class="gsave-sc-state">' + esc(dtxt(s.state || '')) + '</div>' +
      '<div class="gsave-tblwrap"><table class="gsave-tbl">' +
      '<thead><tr><th>الدولار</th><th>سعره الجديد</th><th>الجرام لو الذهب ثابت</th><th>الفرق</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      (lv.support_egp_per_usd ? kv('دعم الدولار', num(lv.support_egp_per_usd, 3) + ' جنيه/دولار', lv.support_note) : '') +
      (lv.resistance_egp_per_usd ? kv('مقاومة الدولار', num(lv.resistance_egp_per_usd, 3) + ' جنيه/دولار', lv.resistance_note) : '') +
      '<div class="gnote">' + esc(s.note || '') + '</div>';
    return '<div class="gsave-sc gsave-sc--flat">' +
      '<div class="gsave-sc-h">' + esc(s.name_ar) + '</div>' + body + '</div>';
  }

  /* ══════════════════════════════════════════════════════
     ⑤ محرك العوامل
     ══════════════════════════════════════════════════════ */
  function secFactors(d) {
    var f = (d.factors && d.factors.categories) ? d.factors.categories : null;
    if (!f) return '';
    var groups = f.map(function (c) {
      var items = (c.factors || []).map(function (x) {
        if (x.status === 'missing') {
          return '<li class="gsave-fx gsave-fx--miss"><span class="gsave-fx-n">' +
            esc(x.name_ar) + '</span><span class="gsave-fx-v">غير متاح</span>' +
            '<span class="gsave-fx-s">' + esc(dtxt(x.error || 'المصدر رجّع فاضي')) + '</span></li>';
        }
        var dir = x.direction === 'up' ? 'gup' : x.direction === 'down' ? 'gdown' : 'gflat';
        return '<li class="gsave-fx"><span class="gsave-fx-n">' + esc(x.name_ar) + '</span>' +
          '<span class="gsave-fx-v ' + dir + '">' + num(x.value, 2) +
          (x.unit ? ' ' + esc(x.unit) : '') + '</span>' +
          '<span class="gsave-fx-s">' + esc(x.date || '') + ' · ' + esc(x.source || '') + '</span></li>';
      }).join('');
      return '<div class="gsave-fg"><div class="gsave-fg-t">' + esc(c.category) + '</div>' +
        '<ul class="gsave-ul gsave-ul--fx">' + items + '</ul></div>';
    }).join('');
    var note = (d.factors.caveat) ? '<div class="gnote">' + esc(d.factors.caveat) + '</div>' : '';
    return card('🌍 محرك العوامل', 'حالة الماكرو — توصيف مش قياس', groups + note);
  }

  /* ══════════════════════════════════════════════════════
     ⑥ التفكيك + المستويات
     ══════════════════════════════════════════════════════ */
  function secAttribution(d) {
    var a = (d.attribution || {}).attribute;
    if (!a) return '';
    var body = kv('إجمالي التغير', (a.total_change_gram > 0 ? '+' : '−') +
      num(Math.abs(a.total_change_gram), 0) + ' ج.م/جرام', sgn(a.total_change_pct, 1)) +
      kv('من الذهب العالمي', sgn(a.gold_points, 0) + ' ج.م',
        'قوة المساهمة ' + num(a.gold_share_pct, 0) + '%') +
      kv('من سعر الدولار', sgn(a.fx_points, 0) + ' ج.م',
        'قوة المساهمة ' + num(a.currency_share_pct, 0) + '%') +
      kv('المحرك', esc(a.driver || '—'), 'الأقوى في الحركة') +
      '<div class="gnote">' + esc(a.caveat || '') + '</div>';
    return card('🧮 تفكيك الحركة (آخر سنة)',
      'المساهمة بالجنيه/جرام — مجموعها = التغير الحقيقي بالظبط', body);
  }
  function secTech(d) {
    var t = d.technical_gram || {};
    var tr = t.trend || {};
    var body = kv('الاتجاه', esc(tr.overall || '—'),
      'قصير ' + esc((tr.short || {}).label || '—') + ' · متوسط ' +
      esc((tr.medium || {}).label || '—') + ' · طويل ' + esc((tr.long || {}).label || '—')) +
      kv('مؤشر القوة النسبي', num(t.rsi14, 1), 'فوق ٧٠ / تحت ٣٠ مش إشارة شراء أو بيع لوحدها') +
      kv('التقلب السنوي', num(t.hist_vol_annual_pct, 1) + '%', 'من السلسلة نفسها') +
      kv('بنية السوق', esc(t.structure_label || '—'), 'قمم وقيعان المرصودة');
    return card('📐 الصورة الفنية', 'من محرك التحليل الفني', body);
  }

  /* ══════════════════════════════════════════════════════
     ⑦ الشارت (lightweight-charts — بيتحمّل عند الطلب)
     ══════════════════════════════════════════════════════ */
  var libP = null;
  function loadLib() {
    if (window.LightweightCharts) return Promise.resolve(window.LightweightCharts);
    if (libP) return libP;
    libP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'assets/js/vendor/lightweight-charts.standalone.production.js';
      s.onload = function () { res(window.LightweightCharts); };
      s.onerror = function () { rej(new Error('lib')); };
      document.head.appendChild(s);
    });
    return libP;
  }
  function drawGram(host, hist, levels) {
    if (!host) return;
    var rows = (hist.series || []).filter(function (r) { return r.gram != null; });
    if (rows.length < 30) { host.innerHTML = '<div class="gmute">مفيش شموع كفاية للرسم.</div>'; return; }
    rows = rows.slice(-500);
    loadLib().then(function (lib) {
      try {
        var chart = lib.createChart(host, {
          /* ⛔⛔⛔ locale عربي — من غيرها أسماء الشهور بتطلع إنجليزي
             («Aug») ⇒ بقايا إنجليزية في الواجهة ⛔ */
          localization: { locale: 'ar', priceFormatter: function (p) {
            return Number(p).toLocaleString('en-US', { maximumFractionDigits: 0 });
          } },
          layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b9eb0', fontSize: 10,
                    locale: 'ar' },
          grid: { vertLines: { color: 'rgba(255,255,255,.05)' }, horzLines: { color: 'rgba(255,255,255,.05)' } },
          rightPriceScale: { borderColor: 'rgba(255,255,255,.12)' },
          timeScale: { borderColor: 'rgba(255,255,255,.12)', timeVisible: false },
          height: Math.max(220, Math.min(340, Math.round(window.innerHeight * 0.34)))
        });
        /* ⛔⛔⛔ الفجوات: الخط لازم **يتقطع** عند الأيام الناقصة — من غير
           كده الرسم بيخترع حركة وهمية. ⇒ بنقسم السلسلة لمقاطع متصلة
           ولكل مقطع خط لوحده. */
        var segs = [], cur = [];
        rows.forEach(function (r, i) {
          if (i > 0) {
            var prev = rows[i - 1].d;
            var gap = (new Date(r.d) - new Date(prev)) / 86400000;
            if (gap > 5) { if (cur.length) segs.push(cur); cur = []; }
          }
          cur.push({ time: Math.floor(new Date(r.d + 'T00:00:00Z').getTime() / 1000), value: r.gram });
        });
        if (cur.length) segs.push(cur);
        segs = segs.filter(function (s2) { return s2.length > 1; });
        if (!segs.length) { chart.remove(); host.innerHTML = '<div class="gmute">مفيش مقاطع متصلة كفاية للرسم.</div>'; return; }
        var color = '#d4af37';
        var first = null;
        segs.forEach(function (sg) {
          var line = chart.addSeries(lib.LineSeries, { color: color, lineWidth: 2 });
          line.setData(sg);
          if (!first) first = line;
        });
        /* مستويات الدعم والمقاومة — خطوط سعر على أول مقطع */
        (levels || []).forEach(function (z) {
          if (z.level == null || !first) return;
          try {
            first.createPriceLine({
              price: Number(z.level),
              color: z.kind === 'support' ? '#22c55e' : '#ef4444',
              lineWidth: 1, lineStyle: 2,
              axisLabelVisible: true, title: z.kind === 'support' ? 'دعم' : 'مقاومة'
            });
          } catch (e) { }
        });
        chart.timeScale().fitContent();
        window.addEventListener('resize', function () {
          try { chart.applyOptions({ width: host.clientWidth }); } catch (e) { }
        });
      } catch (e) {
        host.innerHTML = '<div class="gmute">تعذّر رسم الشارت — الأرقام في الجداول فوق.</div>';
      }
    }).catch(function () {
      host.innerHTML = '<div class="gmute">مكتبة الرسم مش متاحة — الأرقام في الجداول فوق.</div>';
    });
  }

  /* ══════════════════════════════════════════════════════
     ⑧ الرسم العام
     ══════════════════════════════════════════════════════ */
  function render(container) {
    container.innerHTML = '<div class="gload">🔄 بنجيب ذكاء الادخار…</div>';
    var pS = jfetch('/api/gold/scenarios');
    var pH = jfetch('/api/gold/history');
    var pF = jfetch('/api/gold/factors');
    var pT = jfetch('/api/gold/technical?instrument=gram');
    Promise.all([pS, pH, pF, pT]).then(function (r) {
      var d = r[0], hist = r[1], fac = r[2], tech = r[3];
      if (fac && fac.ok) d.factors = fac;
      if (!d || !d.ok) throw new Error((d && d.error) || 'التقرير غير متاح');
      CACHE.data = d; CACHE.at = Date.now();
      CACHE.hist = hist; CACHE.histAt = Date.now();
      /* 📌 خطوط الدعم/المقاومة من محرك التحليل الفني (٥٠٠ شمعة) */
      var levels = [];
      try {
        var sr = (tech && tech.sr) || {};
        /* ⛔⛔ أقرب دعم + أقرب مقاومة بس — لو رسمنا كل المستويات
           (١٣ خط) الشارت بيبقى مزحوم ومش مقروء. */
        var ns = sr.nearest_support, nr = sr.nearest_resistance;
        if (ns && ns.center != null) {
          levels.push({ kind: 'support', level: ns.center, touches: ns.touches });
        }
        if (nr && nr.center != null) {
          levels.push({ kind: 'resistance', level: nr.center, touches: nr.touches });
        }
      } catch (e) { }

      var html = '<div class="gsave-chart"><div class="gsave-chart-h">📉 سعر الجرام — آخر ٥٠٠ جلسة</div>' +
        '<div class="gsave-chart-box" id="gsave-chart-box"></div>' +
        '<div class="gsave-chart-n">المصدر: TradingView (الذهب العالمي) × سعر الصرف الرسمي · ' +
        'الخط بيقطع عند الأيام الناقصة (مفيش داتا متخيّلة)</div></div>' +
        secSummary(d) + secPrice(d) + secSavings(d) + secScenarios(d) +
        secFactors(d) + secAttribution(d) + secTech(d) +
        '<div class="gnote gsave-src">' +
        'كل الأرقام من مصادر مرصودة (TradingView · الخزانة الأمريكية · بنك نيويورك · ' +
        'مكتب إحصاءات العمل الأمريكي · البنك الدولي · البنك المركزي المصري). ' +
        'السيناريوهات شروط مش توقّعات، والعائد الحقيقي بيحسب على نافذة بتتقابل ' +
        'مع نافذة التضخم المتاحة.' +
        '</div>';
      container.innerHTML = html;
      try { drawGram(document.getElementById('gsave-chart-box'), hist, levels); } catch (e) { }
    }).catch(function (err) {
      container.innerHTML = '<div class="gempty">تعذّر تحميل ذكاء الادخار: ' +
        esc(err.message || err) + '</div>';
    });
  }

  window.OCTA_GOLD_SAVINGS = { render: render, cache: CACHE };
})();
