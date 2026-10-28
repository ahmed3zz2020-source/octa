/* ══════════════════════════════════════════════════════════════
   🧩 OCTA «نماذجي» — صفحة أنماط الكسر المُقاسة
   ──────────────────────────────────────────────────────────────
   📌 بتقرأ /api/setups (محمية) — فيها الأنماط اللي عدّها محرك OCTA.
   📌 ⛔ لو الباقة مقفولة (403) ⇒ لوحة «باقة مدفوعة» بدل جدول فاضي.
   📌 ⛔ مفيش تخمين: كل رقم في الجدول جاي من الـAPI كما هو.
   📌 تعليمي بحت — مش توصية شراء/بيع.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var S = {
    items: [],
    filtered: [],
    q: '',
    dir: 'all',
    rr: 0,
    volOnly: false,
    loaded: false,
    locked: false,
    measured: null,
    selected: null,
    subscription: null,
    chartLib: null,
    tab: 'chart',
    scope: 'egx30',
    scopeInfo: null
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function num(v, d) {
    if (v == null || v === '' || !isFinite(v)) return (d == null ? '—' : d);
    return v;
  }
  function fmtPrice(v) {
    if (v == null || !isFinite(v)) return '—';
    var n = Math.abs(v) >= 100 ? 2 : (Math.abs(v) >= 1 ? 3 : 4);
    return Number(v).toFixed(n).replace(/\.?0+$/, '');
  }
  function fmtPct(v, d) {
    if (v == null || !isFinite(v)) return (d == null ? '—' : d);
    return (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%';
  }
  function fmtDate(d) {
    if (!d) return '—';
    return String(d).slice(0, 10);
  }

  function apiUrl(p) {
    var base = (typeof OCTA_API !== 'undefined' && OCTA_API) ? OCTA_API : '';
    return base + p;
  }

  function getJson(path, ms) {
    var lim = ms || 30000;
    var t0 = Date.now();
    /* ⛔ octaFetch بييجي من octa-api.js — لو الملف مفشل نرجع للـfetch
       العادي (بدون توكن) بدل ما نرمي exception وتموت الصفحة. */
    var call = (typeof octaFetch === 'function')
      ? octaFetch(apiUrl(path))
      : fetch(apiUrl(path));
    return call
      .then(function (r) {
        if (!r.ok) {
          var e = new Error('HTTP ' + r.status);
          e.status = r.status;
          throw e;
        }
        return r.json();
      })
      .then(function (j) { return { json: j, ms: Date.now() - t0 }; })
      .catch(function (err) { err.ms = Date.now() - t0; throw err; });
  }

  function setStatus(kind, text) {
    var el = $('suStatus');
    if (!el) return;
    var dot = '<span class="su-dot ' + (kind || '') + '"></span>';
    el.innerHTML = dot + ' ' + esc(text);
  }

  function note(msg, kind) {
    setStatus(kind || 'err', msg);
  }

  /* ══════════ تحميل ══════════ */
  function load() {
    setStatus('busy', 'بنجيب الأنماط…');
    /* ⛔ أول طلب بعد النشر ممكن يبني المسح من الصفر ⇒ مهلة طويلة */
    getJson('/api/setups?scope=' + encodeURIComponent(S.scope), 120000).then(function (res) {
      var j = res.json || {};
      S.items = j.items || [];
      S.measured = j.measured || null;
      S.scopeInfo = j;
      S.loaded = true;
      S.locked = false;
      render();
      loadSubscription();
      setStatus('live', 'اتحمّل · ' + (j.items || []).length + ' نمط' +
        (j.scope_label ? (' · ' + j.scope_label) : '') +
        (j.stale ? ' · بنحدّث في الخلفية' : ''));
    }).catch(function (err) {
      var st = err && err.status;
      if (st === 403) {
        S.locked = true;
        S.loaded = true;
        render();
        loadMeta();
        loadSubscription();
        note('الباقة مقفولة — كلّم الدعم للتفعيل', 'err');
      } else if (st === 401) {
        S.loaded = true;
        render();
        note('لازم تسجّل دخول — الباقة «نماذجي» محتاجة حساب', 'err');
      } else {
        note('تعذّر تحميل الأنماط — جرّب تاني', 'err');
      }
    });
  }

  /* 💳 كارت الباقة: الحالة + تاريخ الانتهاء */
  function renderSub() {
    var el = $('suSub'), stat = $('suSubStat');
    if (!el) return;
    var sub = S.subscription;
    if (!sub) { el.textContent = '—'; return; }
    if (sub.plan === 'pro') {
      el.textContent = 'مفعّلة';
      el.style.color = 'var(--up)';
      if (stat) stat.classList.remove('e');
      if (sub.days_left != null) {
        el.textContent = 'مفعّلة · ' + sub.days_left + ' يوم';
      }
    } else {
      el.textContent = 'غير مفعّلة';
      el.style.color = 'var(--dn)';
      if (stat) stat.classList.add('e');
    }
  }

  function loadSubscription() {
    getJson('/api/subscriptions/me', 15000).then(function (res) {
      S.subscription = (res.json || {}).subscription || null;
      renderSub();
      if (S.locked) render();
    }).catch(function () { });
  }

  /* ══════════ البيانات الوصفية (متاحة لكل مسجّل) ══════════ */
  function loadMeta() {
    getJson('/api/setups/meta', 20000).then(function (res) {
      var j = res.json || {};
      if (j.measured) {
        S.measured = j.measured;
        if (S.locked) render();
      }
    }).catch(function () { });
  }

  /* ══════════ الفلترة ══════════ */
  function applyFilters() {
    var q = S.q.trim().toLowerCase();
    S.filtered = S.items.filter(function (it) {
      if (S.dir !== 'all' && (it.direction || '') !== S.dir) return false;
      if (S.rr > 0 && !(num(it.rr, 0) >= S.rr)) return false;
      if (S.volOnly && !it.volume_confirmed) return false;
      if (q) {
        var hay = ((it.code || '') + ' ' + (it.name || '') + ' ' + (it.sector || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    renderTable();
  }

  /* ══════════ الرسم ══════════ */
  /* ⭐ لوحة النمط المختار: شارت + المستويات */
  function selectItem(it) {
    S.selected = it;
    var panel = $('suPanel');
    if (!panel) return;
    if (!it) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    var st = it.setup || {};
    var ev = it.evidence || {};
    var title = $('suPTitle'), sub = $('suPSub'), kvBox = $('suPKv');
    if (title) title.textContent = (it.code || '') + ' · ' + (it.name || '');
    if (sub) {
      sub.innerHTML = (it.direction === 'up' ? '▲ كسر صعودي' : '▼ كسر هبوطي') +
        ' · ' + fmtDate(it.detected_at) +
        (it.days_ago ? (' · من ' + it.days_ago + ' يوم') : '') +
        (it.measured_fit === false ? ' · <b>مش مُقاس بالشرط العام</b>' : ' · <b>مُقاس</b>') +
        ' · ' + esc(it.why || '');
    }
    if (kvBox) {
      kvBox.innerHTML =
        kv('مستوى الكسر', fmtPrice(st.level != null ? st.level : it.level)) +
        kv('الدخول', fmtPrice(st.entry_ref != null ? st.entry_ref : it.entry)) +
        kv('الوقف', fmtPrice(st.stop != null ? st.stop : it.stop)) +
        kv('الهدف', fmtPrice(st.target != null ? st.target : it.target)) +
        kv('عائد/مخاطرة', num(st.rr != null ? st.rr : it.rr, '—')) +
        kv('نسبة التذبذب', ev.atr_pct != null ? Number(ev.atr_pct).toFixed(2) + '%' : '—') +
        kv('تأكيد الحجم', it.volume_confirmed ? 'نعم' : 'لا') +
        kv('حجم السوق', ev.vol_ratio != null ? '×' + Number(ev.vol_ratio).toFixed(2) : '—') +
        kv('يوم الكسر', fmtDate(it.detected_at)) +
        kv('آخر اختبار للمنطقة', fmtDate(ev.last_test));
    }
    drawMainChart(it);
    /* 📌 الـTradingView بيتحدّث مع السهم المختار */
    var tbox = $('suTvBox');
    if (tbox) { tbox.setAttribute('data-loaded', ''); tbox.innerHTML = ''; }
    if (S.tab === 'tv') showTab('tv');
  }

  /* 📌 معلومات النمط اللي بنرسمها (كلها من الـAPI) */
  function patternOf(it) {
    var ev = (it && it.evidence) || {};
    var st = (it && it.setup) || {};
    return {
      zone_low: (it && it.zone_low != null) ? it.zone_low : null,
      zone_high: (it && it.zone_high != null) ? it.zone_high : null,
      detect_at: (it && it.detected_at) || null,
      age_days: (ev.age_days != null) ? ev.age_days : null,
      last_test: ev.last_test || null,
      entry: (st.entry_ref != null) ? st.entry_ref : (it ? it.entry : null),
      stop: (st.stop != null) ? st.stop : (it ? it.stop : null),
      target: (st.target != null) ? st.target : (it ? it.target : null)
    };
  }

  /* 📌 خطوط السعر (التسميات العربية من الـlibrary ⇒ RTL صحيح) */
  function priceLines(it) {
    var st = (it && it.setup) || {};
    var lines = [];
    var lvl = (st.level != null) ? st.level : (it ? it.level : null);
    var ent = (st.entry_ref != null) ? st.entry_ref : (it ? it.entry : null);
    var stop = (st.stop != null) ? st.stop : (it ? it.stop : null);
    var tgt = (st.target != null) ? st.target : (it ? it.target : null);
    /* ⭐ الإعداد المُقاس (٥٨٪ / +0.43R) — بخطوط عريضة */
    if (lvl != null) lines.push({ price: lvl, color: '#a855f7', style: 2, width: 1, title: 'مستوى الكسر' });
    if (ent != null) lines.push({ price: ent, color: '#d4af37', style: 2, width: 2, title: 'الدخول' });
    if (stop != null) lines.push({ price: stop, color: '#ef4444', style: 0, width: 2, title: 'الوقف' });
    if (tgt != null) lines.push({ price: tgt, color: '#22c55e', style: 0, width: 2, title: 'الهدف' });
    /* 📌 إدارة الصفقة (مش جزء من القياس — لازم الواجهة توضّح) */
    if (st.entry_deep != null && st.entry_deep !== ent) {
      lines.push({ price: st.entry_deep, color: '#fbbf24', style: 2, width: 1, soft: true, title: 'دخول أعمق' });
    }
    if (st.target_partial != null && st.target_partial !== tgt) {
      lines.push({ price: st.target_partial, color: '#4ade80', style: 2, width: 1, soft: true, title: 'هدف أول' });
    }
    return lines;
  }

  /* ⭐ legend الشارت: قائمة المستويات بألوانها (زي الرسومات الاحترافية) */
  function legendOf(it) {
    var st = (it && it.setup) || {};
    var ev = (it && it.evidence) || {};
    var out = [];
    var add = function (label, price, color, tag, soft) {
      if (price == null) return;
      /* ⛔ السعر ممكن يكون رقم (يُنسّق) أو نص جاهز (مثل نطاق "أ ← ب") */
      var txt = (typeof price === 'number') ? fmtPrice(price) : String(price);
      if (!txt || txt === 'NaN' || txt === 'undefined') return;
      out.push({ label: label, price: txt, color: color, tag: tag || '', soft: !!soft });
    };
    if (it && it.zone_low != null && it.zone_high != null) {
      /* ⛔ لو النطاق نقطة واحدة ⇒ نكتب السعر مرة واحدة (مش مكرر) */
      var ztxt = (Math.abs(it.zone_low - it.zone_high) < 1e-9)
        ? fmtPrice(it.zone_high)
        : (fmtPrice(it.zone_low) + ' ← ' + fmtPrice(it.zone_high));
      add('نطاق الكسر', ztxt, '#a855f7', '', true);
    }
    add('مستوى الكسر', st.level != null ? st.level : (it ? it.level : null), '#a855f7', '', true);
    add('الدخول', st.entry_ref != null ? st.entry_ref : (it ? it.entry : null), '#d4af37', 'مُقاس');
    add('دخول أعمق', st.entry_deep, '#fbbf24', 'إدارة', true);
    add('هدف أول', st.target_partial, '#4ade80', 'إدارة', true);
    add('الهدف', st.target != null ? st.target : (it ? it.target : null), '#22c55e', 'مُقاس');
    add('الوقف', st.stop != null ? st.stop : (it ? it.stop : null), '#ef4444', 'مُقاس');
    if (ev.atr_pct != null) {
      out.push({ label: 'ATR', price: Number(ev.atr_pct).toFixed(2) + '%', color: '#64748b', tag: 'تذبذب', soft: true });
    }
    return out;
  }

  /* 📌 جلب الشموع + الرسم الاحترافي */
  function drawPattern(it, box, height, legendBox) {
    if (!box || !it) return;
    var kit = window.OCTAChartKit;
    if (!kit) { box.innerHTML = '<div class="su-empty">مكتبة الرسم مش متاحة</div>'; return; }
    getJson('/api/radar/history?list=' + encodeURIComponent(it.code) + '&n=320', 60000)
      .then(function (res) {
        var rows = kit.rowsFromHistory(res.json, it.code);
        if (!rows.length) {
          box.innerHTML = '<div class="su-empty">مفيش شموع للعرض — الأرقام تحت كاملة</div>';
          return;
        }
        return kit.mountPattern(box, rows, {
          lines: priceLines(it),
          volume: true,
          height: height || 320,
          focusBars: 90,
          legend: legendOf(it),
          legendBox: legendBox || null,
          /* ⭐ المتوسطات المتحركة = السياق الفني (20/50) */
          emas: [
            { period: 20, color: '#38bdf8', title: 'EMA 20' },
            { period: 50, color: '#a78bfa', title: 'EMA 50' }
          ],
          pattern: patternOf(it)
        });
      })
      .catch(function () {
        box.innerHTML = '<div class="su-empty">تعذّر جلب الشموع — الأرقام تحت كاملة</div>';
      });
  }

  /* ══════════ تبويب الشارت: رسم النمط / TradingView ══════════
     📌 شارت TradingView الرسمي (widget) بجوار شارت النمط:
        الأول للتداول والمراجعة، والتاني للرسم الاحترافي
        للمنطقة والوقف والهدف (الأرقام الحقيقية من محرك OCTA). */
  function tvBoxHtml(code) {
    var kit = window.OCTAChartKit;
    var sym = encodeURIComponent('EGX:' + String(code || ''));
    /* ⛔ fallback محلي: لو مكتبة الرسم مش محمّلة ⇒ التبويب يفضل شغال */
    var url = (kit && kit.tvWidgetUrl) ? kit.tvWidgetUrl(code) :
      ('https://s.tradingview.com/widgetembed/?frameElementId=octa-tv-' +
        encodeURIComponent(String(code || 'x')) +
        '&symbol=' + sym +
        '&interval=1D&range=180&timezone=Africa%2FCairo' +
        '&theme=dark&style=1&locale=ar&hide_side_toolbar=0&allow_symbol_change=1' +
        '&save_image=0&calendar=0&support_host=1');
    var openUrl = (kit && kit.tvOpenUrl) ? kit.tvOpenUrl(code) :
      ('https://www.tradingview.com/chart/?symbol=' + sym);
    return '<div class="su-tvframe">' +
      '<iframe src="' + esc(url) + '" title="TradingView ' + esc(code) + '" ' +
      'allowtransparency="true" scrolling="no" frameborder="0" ' +
      'style="width:100%;height:100%;border:0"></iframe>' +
      '</div>' +
      '<div class="su-tvfoot">' +
      '<a class="su-chip" target="_blank" rel="noopener noreferrer" href="' + esc(openUrl) + '">افتح على TradingView ↗</a>' +
      '<span class="su-mini">شارت TradingView الرسمي · اليومي</span>' +
      '</div>';
  }

  function showTab(which) {
    S.tab = which === 'tv' ? 'tv' : 'chart';
    var cbox = $('suChartMain'), tbox = $('suTvBox'), lbox = $('suLegendMain');
    var tabs = document.querySelectorAll ? document.querySelectorAll('.su-tab') : [];
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === S.tab;
      tabs[i].classList.toggle('on', on);
    }
    if (cbox) cbox.style.display = (S.tab === 'chart') ? '' : 'none';
    if (lbox) lbox.style.display = (S.tab === 'chart') ? '' : 'none';
    if (tbox) {
      tbox.style.display = (S.tab === 'tv') ? '' : 'none';
      if (S.tab === 'tv' && S.selected && !tbox.getAttribute('data-loaded')) {
        tbox.setAttribute('data-loaded', '1');
        tbox.innerHTML = tvBoxHtml(S.selected.code);
      }
    }
  }

  function drawMainChart(it) {
    var box = $('suChartMain');
    if (!box) return;
    box.innerHTML = '<div class="su-empty">بنجيب الشموع…</div>';
    drawPattern(it, box, 320, $('suLegendMain'));
  }

  function render() {
    renderStats();
    var wrap = $('suBody');
    if (!wrap) return;
    if (S.locked) {
      wrap.innerHTML = lockHTML();
      return;
    }
    if (!S.loaded) {
      wrap.innerHTML = '<div class="su-empty">بنحمّل…</div>';
      return;
    }
    applyFilters();
  }

  function lockHTML() {
    var m = S.measured;
    var stats = '';
    if (m) {
      var pct = function (v) { return (v == null) ? '—' : (Math.round(v * 1000) / 10) + '%'; };
      var ci = (m.ci95 && m.ci95.length === 2)
        ? (m.ci95[0] > 0 ? '+' : '') + m.ci95[0] + ' .. ' + (m.ci95[1] > 0 ? '+' : '') + m.ci95[1] : '—';
      stats = '<div class="su-mgrid">' +
        '<div><span>إشارات مُقاسة</span><b>' + num(m.signals, '—') + '</b></div>' +
        '<div><span>نسبة النجاح</span><b>' + pct(m.hit_rate) + '</b></div>' +
        '<div><span>R لكل صفقة</span><b>' + (m.r_per_trade > 0 ? '+' : '') + num(m.r_per_trade, '—') + '</b></div>' +
        '<div><span>٩٥٪ ثقة</span><b>' + ci + '</b></div>' +
        '</div>';
    }
    return '<div class="su-lock">' +
      '<h3>🧩 باقة «نماذجي» — ٣٥٠ جنيه/شهر</h3>' +
      '<p>النماذج دي <b>مقيسة على ٦ سنين</b> من البورصة المصرية (٣١٥٣ إشارة · ١٨٦ سهم) ' +
      'بـ<b>محرك OCTA</b> نفسه — مش تحليل مكتوب بإيد. والنتيجة متقاسة ' +
      'بـ<b>ضوابط</b>: مستوى عشوائي = −٠.٠٧R · كسر أعلى ٢٠ شمعة = +٠.١٦R ⇒ محرّكنا أحسن.</p>' +
      '<div class="su-locklist">' +
      '• <b>نماذجي:</b> قائمة يومية بالأنماط + مدخل/وقف/هدف + إحصاء تاريخي شفاف<br>' +
      '• <b>الاستوديو:</b> ارسم مستوياتك واحفظ ملاحظاتك على أي سهم<br>' +
      '• <b>إنذار تيليجرام</b> كل يوم بعد القفل<br>' +
      '• <b>مش توصية</b> — المعلومة أداة، والقرار قرارك' +
      '</div>' +
      '<p style="margin-top:10px"><b>وده اللي هتاخده بالأرقام المقاسة (مش وعود):</b></p>' +
      '</div>' + stats +
      '<p style="margin-top:12px">' + (S.subscription && S.subscription.expired
        ? ('باقتك خلصت يوم ' + (S.subscription.until_date || '—') + ' — جددها وارجع كمل.')
        : 'الباقة غير مفعّلة على حسابك دلوقتي.') +
      ' كلّم الدعم وهي تتفعّل في ثواني — ' +
      '<b>٣٥٠ جنيه/شهر</b> (أو باقة سنوية ' + num(3500, '٣٥٠٠') + ' جنيه).</p>' +
      '</div>';
  }

  function renderStats() {
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    if (S.locked) {
      set('suTotal', '—'); set('suUp', '—'); set('suRR', '—'); set('suWhen', '—');
      return;
    }
    var ups = S.items.filter(function (i) { return i.direction === 'up'; }).length;
    var best = 0;
    S.items.forEach(function (i) { var r = num(i.rr, 0); if (r > best) best = r; });
    set('suTotal', S.items.length);
    set('suUp', ups);
    set('suRR', best ? best.toFixed(1) : '—');
    set('suWhen', S.items.length ? fmtDate(S.items[0].detected_at) : '—');
  }

  /* ══════════ كروت الأسهم (بدل الجدول) ══════════
     📌 السبب: الجدول كان بيحتاج سحب أفقي على الموبايل.
     📌 الكارت بياخد كل المعلومات: المستوى/الدخول/الوقف/الهدف
        والعائد/المخاطرة والتذبذب والحجم وتاريخ الكسر والسبب. */
  function renderTable() {
    var box = $('suTableBox');
    if (!box) return;
    if (!S.filtered.length) {
      var scopeNote = '';
      if (S.scope === 'egx30' && S.scopeInfo && S.scopeInfo.scope_total) {
        scopeNote = '<div class="su-empty">' +
          '⛔ مفيش نمط النهاردة داخل **مؤشر EGX30** (' + num(S.scopeInfo.scope_total, '—') +
          ' نمط في كل الأسهم).' +
          '<br><button class="su-chip primary" type="button" id="suScopeAll">🌐 شوف كل الأسهم</button></div>';
      }
      box.innerHTML = scopeNote || '<div class="su-empty">' +
        (S.items.length
          ? '⛔ مفيش نمط مطابق للفلاتر — جرّب وسّعها.'
          : '⛔ مفيش أنماط دلوقتي. المسح بيحصل مرة في اليوم بعد قفل السوق — جرّب بكرة.') +
        '</div>';
      var all = box.querySelector('#suScopeAll');
      if (all) all.addEventListener('click', function () {
        S.scope = 'all';
        var sc2 = $('suScope');
        if (sc2) sc2.textContent = '🌐 كل الأسهم';
        load();
      });
      return;
    }

    var cards = S.filtered.map(function (it, idx) {
      var ev = it.evidence || {};
      var st = it.setup || {};
      var dirCls = it.direction === 'up' ? 'up' : 'down';
      var dirTxt = it.direction === 'up' ? '▲ كسر صعودي' : '▼ كسر هبوطي';
      var lvl = (st.level != null) ? st.level : it.level;
      var ent = (st.entry_ref != null) ? st.entry_ref : it.entry;
      var stop = (st.stop != null) ? st.stop : it.stop;
      var tgt = (st.target != null) ? st.target : it.target;
      var rr = (st.rr != null) ? st.rr : it.rr;
      var badge = (it.measured_fit === false)
        ? '<span class="su-tag soft">مش مُقاس</span>'
        : '<span class="su-tag ok">مُقاس</span>';
      var volTag = it.volume_confirmed
        ? '<span class="su-tag ok">حجم مؤكد</span>'
        : '<span class="su-tag soft">بدون تأكيد حجم</span>';
      var act = (S.selected && S.selected.code === it.code) ? ' sel' : '';
      return '<article class="su-card' + act + '" data-code="' + esc(it.code) + '" tabindex="0">' +
        '<div class="su-cardhead">' +
          '<div class="su-cardid">' +
            '<b>' + esc(it.code) + '</b>' +
            '<span class="su-cardname">' + esc(it.name || '') + '</span>' +
            (it.sector ? '<span class="su-cardsector">' + esc(it.sector) + '</span>' : '') +
          '</div>' +
          '<span class="su-dir ' + dirCls + '">' + dirTxt + '</span>' +
        '</div>' +
        '<div class="su-cardlevels">' +
          '<div><span>المستوى</span><b>' + fmtPrice(lvl) + '</b></div>' +
          '<div><span>الدخول</span><b class="e">' + fmtPrice(ent) + '</b></div>' +
          '<div><span>الوقف</span><b class="d">' + fmtPrice(stop) + '</b></div>' +
          '<div><span>الهدف</span><b class="u">' + fmtPrice(tgt) + '</b></div>' +
        '</div>' +
        '<div class="su-cardmeta">' +
          '<span>ع/م <b>' + num(rr, '—') + '</b></span>' +
          '<span>تذبذب <b>' + (ev.atr_pct != null ? Number(ev.atr_pct).toFixed(1) + '%' : '—') + '</b></span>' +
          '<span>حجم <b>' + (ev.vol_ratio != null ? '×' + Number(ev.vol_ratio).toFixed(2) : '—') + '</b></span>' +
          '<span>لمسات <b>' + num(ev.touches, '—') + '</b></span>' +
          '<span>يوم الكسر <b>' + fmtDate(it.detected_at) + '</b></span>' +
          (it.days_ago ? '<span>من <b>' + it.days_ago + '</b> يوم</span>' : '') +
        '</div>' +
        '<div class="su-cardtags">' + badge + volTag +
          '<span class="su-tag">' + esc(it.kind || 'BREAKOUT') + '</span>' +
        '</div>' +
        '<p class="su-cardwhy">' + esc(it.why || '') + '</p>' +
        '<div class="su-cardact">' +
          '<button class="su-chip primary" type="button" data-act="analysis">📐 التحليل الكامل</button>' +
          '<button class="su-chip" type="button" data-act="chart">📈 الشارت</button>' +
          '<button class="su-chip" type="button" data-act="detail">التفاصيل الكاملة</button>' +
          '<a class="su-chip" target="_blank" rel="noopener noreferrer" href="' +
            esc((window.OCTAChartKit && window.OCTAChartKit.tvOpenUrl) ?
              window.OCTAChartKit.tvOpenUrl(it.code) :
              ('https://www.tradingview.com/chart/?symbol=EGX%3A' + encodeURIComponent(it.code))) +
            '">TradingView ↗</a>' +
        '</div>' +
      '</article>';
    }).join('');

    var first = S.filtered[0];
    if (first && (!S.selected || S.filtered.indexOf(S.selected) < 0)) {
      selectItem(first);
    }
    box.innerHTML = '<div class="su-cards">' + cards + '</div>' +
      measuredNote() +
      '<div class="su-note">⛔ الأرقام دي من محرك OCTA على شموع يومية حقيقية. ' +
      'مفيش توصية شراء أو بيع — القرار قرارك.</div>';

    var nodes = box.querySelectorAll('.su-card');
    for (var i = 0; i < nodes.length; i++) {
      (function (card) {
        var code = card.getAttribute('data-code');
        var pick = function () {
          var it = null;
          for (var q = 0; q < S.filtered.length; q++) {
            if (S.filtered[q].code === code) { it = S.filtered[q]; break; }
          }
          if (it) selectItem(it);
          return it;
        };
        card.addEventListener('click', function (e) {
          /* ⛔ closest(): لو ضغط المستخدم على أي جوه الزر (إيموجي/نص)
             ⇒ لازم الزر هو اللي يتقرا، مش العنصر الداخلي. */
          var act = (e.target && e.target.closest) ? e.target.closest('[data-act]') : null;
          var b = act ? act.getAttribute('data-act')
            : (e.target && e.target.getAttribute ? e.target.getAttribute('data-act') : null);
          if (b === 'detail') { e.stopPropagation(); openDetail(code); return; }
          if (b === 'chart') { e.stopPropagation(); var it = pick(); if (it) focusPanel(); return; }
          if (b === 'analysis') { e.stopPropagation(); var ia = pick(); if (ia) openAnalysis(ia); return; }
          pick();
        });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(code); }
        });
      })(nodes[i]);
    }
  }

  /* 📌_scroll للوحة الشارت (الكارت اتضغط) */
  function focusPanel() {
    try {
      var p = $('suPanel');
      if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { }
  }

  /* ══════════════════════════════════════════════════════════════
     📐 التحليل الفني الكامل — «الصورة كاملة» قدام المستخدم
     ══════════════════════════════════════════════════════════════
     📌 كل رقم هنا من الـAPI (evidence/setup) — مافيش رقم مخترع.
     📌 الأرقام اللي مش جزء من الإعداد المُقاس لازم تتعلّم بوضوح.
     */
  function analysisHTML(it) {
    var ev = (it && it.evidence) || {};
    var st = (it && it.setup) || {};
    var lvl = (st.level != null) ? st.level : (it ? it.level : null);
    var ent = (st.entry_ref != null) ? st.entry_ref : (it ? it.entry : null);
    var stop = (st.stop != null) ? st.stop : (it ? it.stop : null);
    var tgt = (st.target != null) ? st.target : (it ? it.target : null);
    var rr = (st.rr != null) ? st.rr : (it ? it.rr : null);
    var rows = [];
    var push = function (k, v, hint) {
      rows.push('<div class="an-row"><span>' + esc(k) + '</span><b dir="ltr">' + esc(v) + '</b>' +
        (hint ? '<i>' + esc(hint) + '</i>' : '') + '</div>');
    };

    /* 📐 البنية */
    push('البنية', ev.structure_label || '—', 'نطاق عرضي قبل الكسر');
    if (it && it.zone_low != null && it.zone_high != null) {
      push('النطاق', fmtPrice(it.zone_low) + ' ← ' + fmtPrice(it.zone_high),
        'الحد اللي كسره السعر');
    }
    push('لمسات النطاق', num(ev.touches, '—') + ' · ردود ' + num(ev.reactions, '—'),
      'قوة المنطقة');
    push('آخر اختبار', fmtDate(ev.last_test),
      'من ' + num(ev.age_days, '—') + ' يوم');
    push('قوة النطاق', num(ev.zone_score, '—'), 'مجموع الدرجات');

    /* 📊 الحركة */
    if (it && it.confirmed) {
      push('التأكيد', '٣ إغلاقات فوق ' + fmtPrice(lvl),
        '+' + num(ev.close_beyond_pct, '—') + '% فوق النطاق');
    }
    push('من يوم الكسر', num(it.bars_since, '—') + ' شمعة',
      'بتاريخ ' + fmtDate(it.detected_at));
    push('الحركة المقاسة', num(ev.measured_move, '—') + ' ATR',
      'المسافة المتوقعة بعد الكسر');

    /* 💧 الحجم */
    push('الحجم', (ev.vol_ratio != null ? '×' + Number(ev.vol_ratio).toFixed(2) : '—') + ' من متوسط ٢٠',
      it && it.volume_confirmed ? 'مؤكد ✓' : 'غير مؤكد');

    /* 📈 التذبذب */
    push('التذبذب (ATR)', num(ev.atr_pct, '—') + '% من السعر',
      'مدى الحركة اليومية');

    /* 📏 الاتجاه والسوق */
    if (it && it.trend) {
      var tr = it.trend === 'up' ? 'صاعد' : (it.trend === 'down' ? 'هابط' : 'عرضي');
      push('اتجاه السهم', tr, 'على الشموع اليومية');
    }
    if (it && it.market_above_ema200 !== undefined && it.market_above_ema200 !== null) {
      push('سوق EGX30', it.market_above_ema200 ? 'فوق EMA200 ✓' : 'تحت EMA200 ✗',
        'شرط مُقاس في الفلتر');
    }

    /* ⚖️ المخاطرة/العائد */
    push('عائد/مخاطرة', num(rr, '—') + 'R', 'الهدف ÷ المسافة للوقف');
    if (it && it.entry && stop) {
      var riskPct = Math.abs((it.entry - stop) / it.entry) * 100;
      push('المخاطرة', num(riskPct, '—') + '% من السعر', 'المسافة للوقف');
    }

    var head = '<div class="an-block"><h4>📐 التحليل الفني</h4><div class="an-grid">' +
      rows.join('') + '</div></div>';

    /* 📊 المستويات: المُقاس vs إدارة الصفقة */
    var lv = '<div class="an-block"><h4>🎯 المستويات على الشارت</h4>' +
      '<div class="an-levels">' +
      '<div class="an-lv measured"><span>الدخول</span><b dir="ltr">' + fmtPrice(ent) + '</b><i>مُقاس</i></div>' +
      '<div class="an-lv measured"><span>الهدف</span><b dir="ltr">' + fmtPrice(tgt) + '</b><i>مُقاس · ' + num(st.target_atr, '—') + ' ATR</i></div>' +
      '<div class="an-lv measured"><span>الوقف</span><b dir="ltr">' + fmtPrice(stop) + '</b><i>مُقاس · ' + num(st.stop_atr, '—') + ' ATR</i></div>' +
      (st.entry_deep != null ? '<div class="an-lv"><span>دخول أعمق</span><b dir="ltr">' + fmtPrice(st.entry_deep) + '</b><i>إدارة — مش مقاس</i></div>' : '') +
      (st.target_partial != null ? '<div class="an-lv"><span>هدف أول</span><b dir="ltr">' + fmtPrice(st.target_partial) + '</b><i>إدارة — مش مقاس</i></div>' : '') +
      '<div class="an-lv measured"><span>مستوى الكسر</span><b dir="ltr">' + fmtPrice(lvl) + '</b><i>حافة النطاق</i></div>' +
      '</div>' +
      '<p class="an-note">🟡 «مُقاس» = الإعداد اللي اتقاس على ٣١٥٣ إشارة من ١٨٦ سهم (نجاح ٥٨٫٢٪ · +٠٫٤٣R). ' +
      '«إدارة» = مستويات مساعدة بتقسيم الصفقة — مش جزء من القياس.</p></div>';

    /* 🧪 المصداقية: الأرقام المقاسة */
    var m = S.measured;
    var cred = '';
    if (m) {
      var pct = function (v) { return (v == null) ? '—' : (Math.round(v * 1000) / 10) + '%'; };
      cred = '<div class="an-block"><h4>🧪 ليه الإعداد ده مُقاس</h4>' +
        '<div class="an-grid">' +
        '<div class="an-row"><span>إشارات مُقاسة</span><b dir="ltr">' + num(m.signals, '—') + '</b><i>من ' + num(m.stocks, '—') + ' سهم</i></div>' +
        '<div class="an-row"><span>نسبة النجاح</span><b dir="ltr">' + pct(m.hit_rate) + '</b><i>بعد التكلفة</i></div>' +
        '<div class="an-row"><span>R لكل صفقة</span><b dir="ltr">' + num(m.r_per_trade, '—') + '</b><i>صافي</i></div>' +
        '<div class="an-row"><span>ضابط عشوائي</span><b dir="ltr">' + num(m.control_random_level_r, '—') + '</b><i>مستوى عشوائي بنفس التوقيت</i></div>' +
        '</div></div>';
    }

    return head + lv + cred;
  }

  /* ══════════════════════════════════════════════════════════════
     📋 نقل مستويات الصفقة لـTradingView (٢٨ أكتوبر ٢٠٢٦)
     ──────────────────────────────────────────────────────────────
     📌 ليه سكربت Pine مش «تصدير layout JSON»:
     📌   TradingView ما بيقبلش استيراد layout JSON للمستخدم العادي
     📌   (قائمة «Manage layouts» مفيهاش Import — بس تصدير CSV بيانات).
     📌   ⇒ البديل الوحيد اللي يشتغل فعلاً: سكربت Pine يلصقه المستخدم
     📌   في Pine Editor → Add to chart ⇒ مستوياته تترسم على شartه.
     📌   وكمان بنحطّله شروط إنذار جاهزة (وصل الهدف / اتكسر الوقف).
     ⛔ المستويات وقت التصدير — السعر الحي من TradingView نفسه.
     ⛔ أداة تحليل — مش توصية شراء أو بيع.
     ══════════════════════════════════════════════════════════════ */

  /* رقم نظيف للسكربت (من غير فواصل) */
  function pineNum(v) {
    if (v == null || !isFinite(v)) return null;
    var n = Math.abs(v) >= 100 ? 2 : (Math.abs(v) >= 1 ? 3 : 4);
    return Number(v).toFixed(n);
  }

  function levelSet(it) {
    var st = (it && it.setup) || {};
    var entry = (st.entry_ref != null ? st.entry_ref : it.entry);
    var stop = (st.stop != null ? st.stop : it.stop);
    var target = (st.target != null ? st.target : it.target);
    var brk = (st.level != null ? st.level : it.level);
    return {
      entry: pineNum(entry),
      stop: pineNum(stop),
      target: pineNum(target),
      brk: pineNum(brk),
      deep: pineNum(st.entry_deep),
      part: pineNum(st.target_partial)
    };
  }

  /* 🐍 سكربت Pine — يرسم المستويات + شروط الإنذار
     ⛔ السكربت كله ASCII (إنجليزي) عن قصد:
     📌   النص العربي جوّه نص لاتيني (dir=ltr) بيتلخبط بترتيب الـbidi،
     📌   وبيظهر مربعات على كانفاس TradingView لو فيه محارف اتجاه مخفية.
     📌   ⇒ أسماء المستويات بالإنجليزي، والعربي موجود في الواجهة فوق.
     📌   (التعليق في الكود بيبقى إنجليزي عادي — مفهوم لكل traders) */
  function pineFor(it) {
    var code = String((it && it.code) || '').replace(/["\n\r]/g, '');
    var up = (it && it.direction) === 'up';
    var L = levelSet(it);
    var A = [];

    A.push('//@version=6');
    A.push('indicator("OCTA - Setup levels ' + code + '", overlay=true, max_lines_count=500, max_labels_count=500)');
    A.push('');
    A.push('// ' + code + ' - ' + (up ? 'breakout UP' : 'breakout DOWN') +
      ' - detected ' + fmtDate(it && it.detected_at));
    A.push('// Use on the same symbol (EGX:' + code + ') and timeframe (1D).');
    A.push('// Levels are as of export time - live price comes from TradingView.');
    A.push('// Analysis tool - not a buy/sell recommendation. Your decision.');
    A.push('');
    A.push('// Levels - you can edit them from the indicator settings');
    if (L.entry != null) A.push('iEntry  = input.float(' + L.entry + ', "Entry", group="Levels")');
    if (L.stop != null) A.push('iStop   = input.float(' + L.stop + ', "Stop", group="Levels")');
    if (L.target != null) A.push('iTarget = input.float(' + L.target + ', "Target", group="Levels")');
    if (L.brk != null) A.push('iBreak  = input.float(' + L.brk + ', "Break level", group="Levels")');
    if (L.deep != null) A.push('iDeep   = input.float(' + L.deep + ', "Deeper entry (management)", group="Trade management")');
    if (L.part != null) A.push('iPart   = input.float(' + L.part + ', "First target (management)", group="Trade management")');
    A.push('showAdmin = input.bool(true, "Show management levels", group="Trade management")');
    A.push('');
    A.push('if barstate.islast');
    A.push('    x0 = math.max(0, bar_index - 400)');

    var draw = function (v, txt, color, tc, width, dotted, ind) {
      var p = ind || '    ';
      A.push(p + 'line.new(x1=x0, y1=' + v + ', x2=bar_index, y2=' + v +
        ', extend=extend.right, color=' + color + ', width=' + width +
        (dotted ? ', style=line.style_dotted' : '') + ')');
      A.push(p + 'label.new(x=bar_index, y=' + v + ', text="' + txt + ' " + str.tostring(' + v +
        ', format.mintick), style=label.style_label_left, color=' + color + ', textcolor=' + tc + ')');
    };

    if (L.entry != null) draw('iEntry', 'Entry', 'color.teal', 'color.white', '2', false);
    if (L.stop != null) draw('iStop', 'Stop', 'color.red', 'color.white', '2', false);
    if (L.target != null) draw('iTarget', 'Target', 'color.lime', 'color.black', '2', false);
    if (L.brk != null) draw('iBreak', 'Break', 'color.orange', 'color.black', '2', false);
    if (L.deep != null || L.part != null) {
      A.push('    if showAdmin');
      if (L.deep != null) draw('iDeep', 'Deeper entry', 'color.new(color.gray, 55)', 'color.white', '1', true, '        ');
      if (L.part != null) draw('iPart', 'First target', 'color.new(color.gray, 55)', 'color.white', '1', true, '        ');
    }

    A.push('');
    A.push('// Alert conditions - in TradingView: Alert -> Condition -> pick the name');
    if (L.target != null) {
      A.push(up
        ? 'alertcondition(close >= iTarget, title="OCTA: Target reached", message="Target reached (' + code + ')")'
        : 'alertcondition(close <= iTarget, title="OCTA: Target reached", message="Target reached (' + code + ')")');
    }
    if (L.stop != null) {
      A.push(up
        ? 'alertcondition(close <= iStop, title="OCTA: Stop broken", message="Stop was broken (' + code + ')")'
        : 'alertcondition(close >= iStop, title="OCTA: Stop broken", message="Stop was broken (' + code + ')")');
    }
    if (L.brk != null) {
      A.push(up
        ? 'alertcondition(close <= iBreak, title="OCTA: Back inside the zone", message="Price went back inside the zone (' + code + ')")'
        : 'alertcondition(close >= iBreak, title="OCTA: Back inside the zone", message="Price went back inside the zone (' + code + ')")');
    }
    return A.join('\n');
  }

  /* 📝 الأرقام ك نص عادي (لو المستخدم مش عايز Pine) */
  function levelsFor(it) {
    var st = (it && it.setup) || {};
    var L = levelSet(it);
    var up = (it && it.direction) === 'up';
    var A = [];
    A.push(String((it && it.name) || '') + ' (' + ((it && it.code) || '') + ') · ' +
      (up ? 'كسر صعودي' : 'كسر هبوطي') + ' · ' + fmtDate(it && it.detected_at));
    A.push('TradingView: EGX:' + ((it && it.code) || ''));
    if (L.entry != null) A.push('الدخول: ' + L.entry);
    if (L.stop != null) A.push('الوقف: ' + L.stop);
    if (L.target != null) A.push('الهدف: ' + L.target);
    if (L.brk != null) A.push('مستوى الكسر: ' + L.brk);
    if (L.deep != null) A.push('دخول أعمق (إدارة): ' + L.deep);
    if (L.part != null) A.push('هدف أول (إدارة): ' + L.part);
    var rr = (st.rr != null ? st.rr : (it && it.rr));
    if (rr != null && isFinite(rr)) A.push('العائد/المخاطرة: ' + Number(rr).toFixed(2) + 'R');
    A.push('⛔ أداة تحليل — مش توصية شراء أو بيع. القرار قرارك.');
    return A.join('\n');
  }

  /* 📋 نسخ نص — مع بديل للـclipboard (iOS Safari) */
  function copyText(txt, btn) {
    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = txt;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, txt.length);
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        done(ok);
      } catch (e) { done(false); }
    };
    var done = function (ok) {
      if (!btn) return;
      if (!btn.getAttribute('data-lbl')) btn.setAttribute('data-lbl', btn.textContent);
      btn.textContent = ok ? '✅ اتنسخ' : '❌ مقدرتش';
      setTimeout(function () {
        btn.textContent = btn.getAttribute('data-lbl') || '📋 انسخ';
      }, 1900);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { fallback(); });
        return;
      }
    } catch (e) { }
    fallback();
  }

  /* 📦 بلوك «نقل لـTradingView» */
  function codeBoxHTML(it) {
    var code = esc((it && it.code) || '');
    return '<div class="su-steps">' +
      '<b>①</b> افتح TradingView على السهم <code>EGX:' + code + '</code> — الإطار اليومي (1D).' +
      '<br><b>②</b> افتح <b>Pine Editor</b> (أيقونة Pine على يمين الشارت — من على الكمبيوتر أضمن) والصق الكود ده.' +
      '<br><b>③</b> اضغط <b>Add to chart</b> — مستوياته هتترسم على شartك فوق مؤشراك.' +
      '</div>' +
      '<div class="su-copyrow">' +
      '<button class="su-btn primary" type="button" id="suCopyPine">📋 انسخ سكربت TradingView</button>' +
      '<button class="su-btn" type="button" id="suCopyLv">📋 انسخ الأرقام</button>' +
      '</div>' +
      '<pre class="su-code" id="suPineBox">' + esc(pineFor(it)) + '</pre>' +
      '<p class="su-note">🏷️ أسماء المستويات على شart TradingView بالإنجليزي: ' +
      '<b dir="ltr">Entry</b> = الدخول · <b dir="ltr">Stop</b> = الوقف · ' +
      '<b dir="ltr">Target</b> = الهدف · <b dir="ltr">Break</b> = مستوى الكسر · ' +
      '<b dir="ltr">Deeper entry</b> = دخول أعمق · <b dir="ltr">First target</b> = هدف أول. ' +
      '(الإنجليزي عادي في كود TradingView عشان ميتلخبطش الترتيب ولا تظهر مربعات على الشارت.)</p>' +
      '<p class="su-note">🔔 الإنذار (من على الكمبيوتر): افتح إعدادات الـAlert في TradingView → Condition → ' +
      'اختار «OCTA: Target reached» أو «OCTA: Stop broken» — والحكم على السعر الحي بتاع TradingView، مش على سعرك في الموقع.</p>' +
      '<p class="su-note">⛔ المستويات دي وقت تصدير السكربت (' + fmtDate(it && it.detected_at) +
      ') — والسعر بيتحرك مع السوق. أداة تحليل — مش توصية شراء أو بيع. القرار قرارك.</p>';
  }

  /* ══════════ نافذة «التحليل الكامل» ══════════ */
  function openAnalysis(it) {
    if (!it) return;
    var ov = document.createElement('div');
    ov.className = 'su-modal su-analysis';
    ov.id = 'suAnalysis';
    ov.innerHTML =
      '<div class="su-modalbox" role="dialog" aria-modal="true">' +
      '<div class="su-mhead">' +
      '<div><h3>' + esc(it.name || it.code) + ' · ' + esc(it.code || '') + '</h3>' +
      '<div class="su-mcode">تحليل النمط على الشارت · ' +
      (it.direction === 'up' ? 'كسر صعودي' : 'كسر هبوطي') +
      ' · ' + fmtDate(it.detected_at) +
      (it.measured_fit === false ? ' · <b>مش مُقاس بالشرط العام</b>' : ' · <b>مُقاس</b>') +
      '</div></div>' +
      '<button class="su-mclose" type="button" aria-label="اقفل">✕</button>' +
      '</div>' +
      '<div class="su-tabs">' +
      '<button class="su-tab on" type="button" data-atab="chart">📈 شارت التحليل</button>' +
      '<button class="su-tab" type="button" data-atab="tv">TradingView</button>' +
      '<button class="su-tab" type="button" data-atab="code">📋 نقل لـTradingView</button>' +
      '</div>' +
      '<div class="su-chart" id="suAnChart"></div>' +
      '<div class="su-legend" id="suAnLegend"></div>' +
      '<div class="su-tvbox" id="suAnTv" style="display:none;"></div>' +
      '<div class="su-codebox" id="suAnCode" style="display:none;">' + codeBoxHTML(it) + '</div>' +
      analysisHTML(it) +
      '<div class="su-mact">' +
      '<button class="su-btn primary" type="button" id="suAnStock">افتح صفحة السهم</button>' +
      '<button class="su-btn" type="button" id="suAnCalc">⚖️ احسب حجم مركزك</button>' +
      '<a class="su-btn" target="_blank" rel="noopener noreferrer" href="https://www.tradingview.com/chart/?symbol=EGX%3A' + encodeURIComponent(it.code) + '">افتح على TradingView ↗</a>' +
      '<button class="su-btn" type="button" id="suAnClose">اقفل</button>' +
      '</div>' +
      '<p class="su-note">⛔ أداة تعليمية — مش توصية شراء أو بيع. القرار قرارك.</p>' +
      '</div>';
    document.body.appendChild(ov);

    var close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.su-mclose').addEventListener('click', close);
    var c2 = ov.querySelector('#suAnClose'); if (c2) c2.addEventListener('click', close);
    var cb = ov.querySelector('#suAnCalc');
    if (cb) cb.addEventListener('click', function () {
      close();
      try {
        window.OCTA_CALC_PREFILL = {
          type: 'position',
          values: { entry: it.entry, stop: it.stop, capital: 100000, risk: 2 }
        };
        if (typeof switchPage === 'function') switchPage('calc');
        if (typeof renderCalc === 'function') renderCalc('position');
      } catch (e) { }
    });
    var ob = ov.querySelector('#suAnStock');
    if (ob) ob.addEventListener('click', function () {
      close();
      try { if (typeof openStock === 'function') openStock(it.code); }
      catch (e) { window.location.hash = '#stock/' + it.code; }
    });

    /* 📋 نسخ: سكربت TradingView + الأرقام */
    var cpPine = ov.querySelector('#suCopyPine');
    if (cpPine) cpPine.addEventListener('click', function () {
      copyText(pineFor(it), cpPine);
    });
    var cpLv = ov.querySelector('#suCopyLv');
    if (cpLv) cpLv.addEventListener('click', function () {
      copyText(levelsFor(it), cpLv);
    });

    /* 📌 التبويبات: شارت التحليل / TradingView */
    var tabs = ov.querySelectorAll('.su-tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (tb) {
        tb.addEventListener('click', function () {
          var which = tb.getAttribute('data-atab');
          for (var k = 0; k < tabs.length; k++) tabs[k].classList.toggle('on', tabs[k] === tb);
          var cbox = ov.querySelector('#suAnChart');
          var tbox = ov.querySelector('#suAnTv');
          var lbox = ov.querySelector('#suAnLegend');
          var kbox = ov.querySelector('#suAnCode');
          if (!cbox || !tbox) return;
          cbox.style.display = (which === 'chart') ? '' : 'none';
          if (lbox) lbox.style.display = (which === 'chart') ? '' : 'none';
          tbox.style.display = (which === 'tv') ? '' : 'none';
          if (kbox) kbox.style.display = (which === 'code') ? '' : 'none';
          if (which === 'tv' && !tbox.getAttribute('data-loaded')) {
            tbox.setAttribute('data-loaded', '1');
            var kit = window.OCTAChartKit;
            var url = (kit && kit.tvWidgetUrl) ? kit.tvWidgetUrl(it.code) :
              ('https://s.tradingview.com/widgetembed/?frameElementId=octa-tv-an-' +
                encodeURIComponent(String(it.code || 'x')) +
                '&symbol=' + encodeURIComponent('EGX:' + String(it.code || '')) +
                '&interval=1D&range=180&timezone=Africa%2FCairo&theme=dark&style=1&locale=ar');
            tbox.innerHTML = '<div class="su-tvframe"><iframe src="' + esc(url) +
              '" title="TradingView ' + esc(it.code || '') +
              '" allowtransparency="true" scrolling="no" frameborder="0" ' +
              'style="width:100%;height:100%;border:0"></iframe></div>' +
              '<div class="su-tvfoot"><span class="su-mini">شارت TradingView الرسمي · اليومي</span></div>';
          }
        });
      })(tabs[i]);
    }

    drawPattern(it, ov.querySelector('#suAnChart'), 340, ov.querySelector('#suAnLegend'));
  }

  /* ══════════ تفاصيل النمط ══════════ */
  function findItem(code) {
    for (var i = 0; i < S.items.length; i++) {
      if (S.items[i].code === code) return S.items[i];
    }
    return null;
  }

  function openDetail(code) {
    var it = findItem(code);
    if (!it) return;
    var ev = it.evidence || {};
    var st = it.setup || {};
    var ov = document.createElement('div');
    ov.className = 'su-modal';
    ov.id = 'suModal';
    ov.innerHTML =
      '<div class="su-modalbox" role="dialog" aria-modal="true">' +
      '<div class="su-mhead">' +
      '<div><h3>' + esc(it.name || it.code) + ' · ' + esc(it.code) + '</h3>' +
      '<div class="su-mcode">' + esc(it.kind || '') + ' · ' +
      (it.direction === 'up' ? 'كسر صعودي' : 'كسر هبوطي') +
      ' · بتاريخ ' + fmtDate(it.detected_at) +
      (it.days_ago ? (' · من ' + it.days_ago + ' يوم') : '') +
      (it.measured_fit === false ? ' · <b>مش مُقاس بالشرط العام</b>' : '') +
      '</div></div>' +
      '<button class="su-mclose" type="button" aria-label="اقفل">✕</button>' +
      '</div>' +
      '<div class="su-chart" id="suChart"></div>' +
      '<div class="su-legend" id="suLegend"></div>' +
      '<div class="su-why">' + esc(it.why || '') + '</div>' +
      '<div class="su-kv">' +
      kv('مستوى الكسر', fmtPrice((st && st.level) != null ? st.level : it.level)) +
      kv('الدخول', fmtPrice((st && st.entry_ref) != null ? st.entry_ref : it.entry)) +
      kv('الوقف', fmtPrice((st && st.stop) != null ? st.stop : it.stop)) +
      kv('الهدف', fmtPrice((st && st.target) != null ? st.target : it.target)) +
      kv('عائد/مخاطرة', num((st && st.rr) != null ? st.rr : it.rr, '—')) +
      kv('نسبة التذبذب', ev.atr_pct != null ? Number(ev.atr_pct).toFixed(2) + '%' : '—') +
      kv('لمسات النطاق', num(ev.touches, '—')) +
      kv('تأكيد الحجم', it.volume_confirmed ? 'نعم' : 'لا') +
      '</div>' +
      '<div class="su-mact">' +
      '<button class="su-btn primary" type="button" id="suOpenStock">افتح صفحة السهم</button>' +
      '<button class="su-btn" type="button" id="suCalc">⚖️ احسب حجم مركزك</button>' +
      '<button class="su-btn" type="button" id="suCopyLv2">📋 انسخ المستويات</button>' +
      '<a class="su-btn" target="_blank" rel="noopener noreferrer" href="https://www.tradingview.com/chart/?symbol=EGX%3A' + encodeURIComponent(it.code) + '">افتح على TradingView</a>' +
      '<button class="su-btn" type="button" id="suClose2">اقفل</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(ov);

    var close = function () {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    };
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.su-mclose').addEventListener('click', close);
    var c2 = $('suClose2'); if (c2) c2.addEventListener('click', close);
    var cb = $('suCalc');
    if (cb) cb.addEventListener('click', function () {
      close();
      try {
        window.OCTA_CALC_PREFILL = {
          type: 'position',
          values: { entry: it.entry, stop: it.stop, capital: 100000, risk: 2 }
        };
        if (typeof switchPage === 'function') switchPage('calc');
        if (typeof renderCalc === 'function') renderCalc('position');
      } catch (e) { }
    });
    var ob = $('suOpenStock');
    if (ob) ob.addEventListener('click', function () {
      close();
      try { if (typeof openStock === 'function') openStock(it.code); }
      catch (e) { window.location.hash = '#stock/' + it.code; }
    });
    var cpLv2 = $('suCopyLv2');
    if (cpLv2) cpLv2.addEventListener('click', function () {
      copyText(levelsFor(it), cpLv2);
    });

    drawChart(it, $('suChart'));
  }

  /* 📊 بلوك «الأداء المُقاس» — طبقة المصداقية (منيحة مع كل رقم) */
  function measuredNote() {
    var m = S.measured;
    if (!m) return '';
    var pct = function (v) { return (v == null) ? '—' : (Math.round(v * 1000) / 10) + '%'; };
    var ci = (m.ci95 && m.ci95.length === 2)
      ? (m.ci95[0] > 0 ? '+' : '') + m.ci95[0] + ' .. ' + (m.ci95[1] > 0 ? '+' : '') + m.ci95[1]
      : '—';
    return '<div class="su-measured">' +
      '<h4>📊 الأداء المُقاس — ' + esc(m.window || '') + '</h4>' +
      '<div class="su-mgrid">' +
      '<div><span>إشارات مُقاسة</span><b>' + num(m.signals, '—') + '</b></div>' +
      '<div><span>نسبة النجاح</span><b>' + pct(m.hit_rate) + '</b></div>' +
      '<div><span>R لكل صفقة</span><b>' + (m.r_per_trade > 0 ? '+' : '') + num(m.r_per_trade, '—') + '</b></div>' +
      '<div><span>٩٥٪ ثقة</span><b>' + ci + '</b></div>' +
      '<div><span>سهم</span><b>' + num(m.stocks, '—') + '</b></div>' +
      '<div><span>ضابط عشوائي</span><b>' + (m.control_random_level_r > 0 ? '+' : '') + num(m.control_random_level_r, '—') + '</b></div>' +
      '</div>' +
      '<p><b>الإعداد:</b> ' + esc(m.entry || '') + ' · وقف ' + esc(m.stop || '') +
      ' · هدف ' + esc(m.target || '') + ' · أفق ' + num(m.horizon, '—') + ' شمعة · بعد التكلفة ' + num(m.cost_pct, '—') + '٪.</p>' +
      '<p><b>الطريقة:</b> ' + esc(m.note || '') + '</p>' +
      '<p><b>ضابط المقارنة:</b> كسر «فوق أعلى ٢٠ شمعة» (بدون محرك OCTA) = ' +
      (m.control_benchmark_r > 0 ? '+' : '') + num(m.control_benchmark_r, '—') + 'R ⇒ محرّكنا أحسن.</p>' +
      (S.scopeInfo && S.scopeInfo.scope_label
        ? '<p class="su-disclaimer">📊 الأرقام دي محسوبة على **كل الأسهم** (' +
          num(m.stocks, '—') + ' سهم) — والقائمة المعروضة دلوقتي: **' +
          esc(S.scopeInfo.scope_label) + '**.</p>'
        : '') +
      '<p class="su-disclaimer">⛔ كل الأرقام دي محسوبة على صفقات مُنفّذة فعلياً بتكلفة عمولة — ' +
      'مش تقدير. ودي أداة تحليل — مش توصية شراء أو بيع. القرار قرارك.</p>' +
      '</div>';
  }

  function kv(k, v) {
    return '<div><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
  }

  /* ══════════ الرسم البياني (مشترك مع الاستوديو) ══════════ */
  function loadChartLib() {
    if (window.OCTAChartKit) return window.OCTAChartKit.load();
    if (S.chartLib) return Promise.resolve(S.chartLib);
    if (window.LightweightCharts) { S.chartLib = window.LightweightCharts; return Promise.resolve(S.chartLib); }
    return Promise.reject(new Error('chart kit غير متاح'));
  }

  function drawChart(it, box) {
    if (!box) return;
    box.innerHTML = '<div class="su-empty">بنجيب الشموع…</div>';
    drawPattern(it, box, 300);
  }

  function mount(box, rows, it) {
    var lines = [];
    if (it.entry) lines.push({ price: it.entry, color: '#d4af37', title: 'دخول' });
    if (it.stop) lines.push({ price: it.stop, color: '#ef4444', title: 'وقف' });
    if (it.target) lines.push({ price: it.target, color: '#22c55e', title: 'هدف' });
    var p = (window.OCTAChartKit)
      ? window.OCTAChartKit.mount(box, rows, { lines: lines })
      : loadChartLib().then(function (lib) { return null; });
    Promise.resolve(p).catch(function () {
      box.innerHTML = '<div class="su-empty">مكتبة الرسم مش متاحة</div>';
    });
  }

  /* ══════════ الربط ══════════ */
  function bind() {
    var q = $('suQ');
    if (q) q.addEventListener('input', function () { S.q = q.value; applyFilters(); });
    var d = $('suDir');
    if (d) d.addEventListener('change', function () { S.dir = d.value; applyFilters(); });
    var rr = $('suRRMin');
    if (rr) rr.addEventListener('change', function () { S.rr = parseFloat(rr.value) || 0; applyFilters(); });
    var v = $('suVol');
    if (v) v.addEventListener('click', function () {
      S.volOnly = !S.volOnly;
      v.classList.toggle('on', S.volOnly);
      applyFilters();
    });
    var b = $('suRefresh');
    if (b) b.addEventListener('click', function () { load(); });
    var sc = $('suScope');
    if (sc) sc.addEventListener('click', function () {
      S.scope = (S.scope === 'egx30') ? 'all' : 'egx30';
      sc.textContent = (S.scope === 'egx30') ? '📊 مؤشر EGX30' : '🌐 كل الأسهم';
      S.selected = null;
      load();
    });
    var d = $('suDetails');
    if (d) d.addEventListener('click', function () {
      if (S.selected) openDetail(S.selected.code);
    });
    var tabs = document.querySelectorAll ? document.querySelectorAll('.su-tab') : [];
    for (var i = 0; i < tabs.length; i++) {
      (function (tb) {
        tb.addEventListener('click', function () {
          showTab(tb.getAttribute('data-tab'));
        });
      })(tabs[i]);
    }
  }

  function init() {
    if (!$('suBody')) return;
    bind();
    if (!S.loaded) load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.OCTASetups = {
    load: load,
    state: S,
    /* 🧪 خطّافات للاختبار (assets/tests/setups-ui.test.js) */
    _test: {
      render: render,
      renderTable: renderTable,
      applyFilters: applyFilters,
      openDetail: openDetail,
      openAnalysis: openAnalysis,
      analysisHTML: analysisHTML,
      legendOf: legendOf,
      lockHTML: lockHTML,
      fmtPrice: fmtPrice,
      num: num,
      tvBoxHtml: tvBoxHtml,
      priceLines: priceLines,
      patternOf: patternOf,
      showTab: showTab,
      pineFor: pineFor,
      levelsFor: levelsFor,
      codeBoxHTML: codeBoxHTML
    }
  };
})();
