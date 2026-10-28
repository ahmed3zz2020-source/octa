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
    chartLib: null
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
        kv('حجم السوق', ev.vol_ratio != null ? '×' + Number(ev.vol_ratio).toFixed(2) : '—');
    }
    drawMainChart(it);
  }

  function drawMainChart(it) {
    var box = $('suChartMain');
    if (!box) return;
    getJson('/api/radar/history?list=' + encodeURIComponent(it.code) + '&n=180', 60000)
      .then(function (res) {
        var j = res.json || {};
        var arr = j.candles || j.data || (j[it.code] || []);
        var rows = [];
        for (var i = 0; i < arr.length; i++) {
          var c = arr[i];
          var t = c.t || c.time || c.d;
          if (t == null) continue;
          rows.push({ time: typeof t === 'string' ? t : String(t),
                      open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v });
        }
        if (!rows.length) { box.innerHTML = '<div class="su-empty">مفيش شموع للعرض</div>'; return; }
        var st = it.setup || {};
        var lines = [];
        if (st.level != null) lines.push({ price: st.level, color: '#a855f7', title: 'مستوى الكسر' });
        if (st.entry_ref != null) lines.push({ price: st.entry_ref, color: '#d4af37', title: 'دخول' });
        if (st.stop != null) lines.push({ price: st.stop, color: '#ef4444', title: 'وقف' });
        if (st.target != null) lines.push({ price: st.target, color: '#22c55e', title: 'هدف' });
        var p = (window.OCTAChartKit)
          ? window.OCTAChartKit.mount(box, rows, { lines: lines, volume: true, height: 320 })
          : Promise.reject(new Error('no kit'));
        Promise.resolve(p).catch(function () {
          box.innerHTML = '<div class="su-empty">مكتبة الرسم مش متاحة</div>';
        });
      })
      .catch(function () {
        box.innerHTML = '<div class="su-empty">تعذّر جلب الشموع</div>';
      });
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
    var rows = S.filtered.map(function (it) {
      var ev = it.evidence || {};
      var st = it.setup || {};
      var dirCls = it.direction === 'up' ? 'up' : 'down';
      var dirTxt = it.direction === 'up' ? '▲ صعود' : '▼ هبوط';
      var lvl = (st.level != null) ? st.level : it.level;
      var ent = (st.entry_ref != null) ? st.entry_ref : it.entry;
      var stop = (st.stop != null) ? st.stop : it.stop;
      var tgt = (st.target != null) ? st.target : it.target;
      var rr = (st.rr != null) ? st.rr : it.rr;
      var badge = (it.measured_fit === false)
        ? '<span class="su-mini">مش مُقاس</span>' : '';
      return '<tr tabindex="0" data-code="' + esc(it.code) + '" data-i="' + S.items.indexOf(it) + '">' +
        '<td class="sticky-c"><b>' + esc(it.code) + '</b><span>' + esc(it.name || '') + '</span></td>' +
        '<td><span class="su-dir ' + dirCls + '">' + dirTxt + '</span>' + badge + '</td>' +
        '<td class="num"><b>' + fmtPrice(lvl) + '</b><span class="su-mini">المستوى</span></td>' +
        '<td class="num">' + fmtPrice(ent) + '</td>' +
        '<td class="num">' + fmtPrice(stop) + '</td>' +
        '<td class="num">' + fmtPrice(tgt) + '</td>' +
        '<td class="num"><b>' + num(rr, '—') + '</b></td>' +
        '<td class="num">' + (ev.atr_pct != null ? Number(ev.atr_pct).toFixed(1) + '%' : '—') +
          '<span class="su-mini">' + (ev.vol_ratio != null ? 'حجم ×' + Number(ev.vol_ratio).toFixed(2) : '') + '</span></td>' +
        '<td class="num">' + fmtDate(it.detected_at) + '</td>' +
        '</tr>';
    }).join('');

    var first = S.filtered[0];
    if (first && (!S.selected || S.filtered.indexOf(S.selected) < 0)) {
      selectItem(first);
    }
    box.innerHTML = '<div class="su-tablewrap"><table class="su-table"><thead><tr>' +
      '<th class="sticky-c">السهم</th><th>الاتجاه</th><th>المستوى</th>' +
      '<th>الدخول</th><th>الوقف</th><th>الهدف</th>' +
      '<th>ع/م</th><th>التذبذب</th><th>التاريخ</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      measuredNote() +
      '<div class="su-note">⛔ الأرقام دي من محرك OCTA على شموع يومية حقيقية. ' +
      'مفيش توصية شراء أو بيع — القرار قرارك.</div>';

    var trs = box.querySelectorAll('tbody tr');
    for (var i = 0; i < trs.length; i++) {
      (function (tr) {
        tr.addEventListener('click', function () {
          var code = tr.getAttribute('data-code');
          var it = null;
          for (var q = 0; q < S.filtered.length; q++) {
            if (S.filtered[q].code === code) { it = S.filtered[q]; break; }
          }
          if (it) selectItem(it);
        });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail(tr.getAttribute('data-code'));
          }
        });
      })(trs[i]);
    }
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
    getJson('/api/radar/history?list=' + encodeURIComponent(it.code) + '&n=180', 60000)
      .then(function (res) {
        var j = res.json || {};
        var arr = j.candles || j.data || (j[it.code] || []);
        var rows = [];
        for (var i = 0; i < arr.length; i++) {
          var c = arr[i];
          var t = c.t || c.time || c.d;
          if (t == null) continue;
          rows.push({
            time: typeof t === 'string' ? t : (typeof t === 'number' ? t : String(t)),
            open: num(c.o, 0), high: num(c.h, 0), low: num(c.l, 0), close: num(c.c, 0)
          });
        }
        if (!rows.length) {
          box.innerHTML = '<div class="su-empty">مفيش شموع للعرض</div>';
          return;
        }
        mount(box, rows, it);
      })
      .catch(function () {
        box.innerHTML = '<div class="su-empty">تعذّر جلب الشموع — الأرقام فوق كاملة</div>';
      });
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
      num: num
    }
  };
})();
