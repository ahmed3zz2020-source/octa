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
    tab: 'chart'
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
    getJson('/api/setups', 120000).then(function (res) {
      var j = res.json || {};
      S.items = j.items || [];
      S.measured = j.measured || null;
      S.loaded = true;
      S.locked = false;
      render();
      loadSubscription();
      setStatus('live', 'اتحمّل · ' + (j.items || []).length + ' نمط' +
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
    if (lvl != null) lines.push({ price: lvl, color: '#a855f7', style: 2, width: 1, title: 'مستوى الكسر' });
    if (ent != null) lines.push({ price: ent, color: '#d4af37', style: 2, width: 2, title: 'الدخول' });
    if (stop != null) lines.push({ price: stop, color: '#ef4444', style: 0, width: 2, title: 'الوقف' });
    if (tgt != null) lines.push({ price: tgt, color: '#22c55e', style: 0, width: 2, title: 'الهدف' });
    return lines;
  }

  /* 📌 جلب الشموع + الرسم الاحترافي */
  function drawPattern(it, box, height) {
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
    var cbox = $('suChartMain'), tbox = $('suTvBox');
    var tabs = document.querySelectorAll ? document.querySelectorAll('.su-tab') : [];
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === S.tab;
      tabs[i].classList.toggle('on', on);
    }
    if (cbox) cbox.style.display = (S.tab === 'chart') ? '' : 'none';
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
    drawPattern(it, box, 320);
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
      box.innerHTML = '<div class="su-empty">' +
        (S.items.length
          ? '⛔ مفيش نمط مطابق للفلاتر — جرّب وسّعها.'
          : '⛔ مفيش أنماط دلوقتي. المسح بيحصل مرة في اليوم بعد قفل السوق — جرّب بكرة.') +
        '</div>';
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
          var b = e.target && e.target.getAttribute ? e.target.getAttribute('data-act') : null;
          if (b === 'detail') { e.stopPropagation(); openDetail(code); return; }
          if (b === 'chart') { e.stopPropagation(); var it = pick(); if (it) focusPanel(); return; }
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
      lockHTML: lockHTML,
      fmtPrice: fmtPrice,
      num: num,
      tvBoxHtml: tvBoxHtml,
      priceLines: priceLines,
      patternOf: patternOf,
      showTab: showTab
    }
  };
})();
