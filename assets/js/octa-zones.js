/* ══════════════════════════════════════════════════════════════
   🗺️ «المناطق» — خريطة المستويات لكل سهم (٢٨ أكتوبر ٢٠٢٦)
   ──────────────────────────────────────────────────────────────
   📌 القيمة اليومية: المستخدم يشوف أقرب مستوى قدامه **قبل** الكسر
      يحصل — monitored levels، مش إنذار بعد الحدث.
   ⛔ كل الأرقام من /api/zones (محرك OCTA) — مافيش تخمين.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var S = {
    rows: [],
    allRows: [],
    filtered: [],
    code: '',
    q: '',
    kind: 'all',
    maxDist: 25,
    selected: null,
    loaded: false,
    locked: false
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
  function apiUrl(p) {
    var base = (typeof OCTA_API !== 'undefined' && OCTA_API) ? OCTA_API : '';
    return base + p;
  }
  function apiGet(path, ms) {
    var call = (typeof octaFetch === 'function')
      ? octaFetch(apiUrl(path)) : fetch(apiUrl(path));
    return call.then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }
  function setStatus(txt, kind) {
    var el = $('znStatus');
    if (el) el.innerHTML = '<span class="su-dot ' + (kind || '') + '"></span> ' + esc(txt);
  }

  function load() {
    setStatus('بنحسب خريطة المستويات…', 'busy');
    apiGet('/api/zones', 120000).then(function (j) {
      S.allRows = j.rows || [];
      S.egx30 = j.egx30 || [];
      S.loaded = true;
      S.locked = false;
      apply();
      setStatus('اتحمّل · ' + S.rows.length + ' مستوى' +
        (S.scope === 'egx30' ? ' (مؤشر EGX30)' : ''), 'live');
    }).catch(function (e) {
      if (e && e.status === 403) {
        S.locked = true; S.loaded = true;
        render();
        setStatus('الباقة مقفولة', 'err');
        return;
      }
      if (e && e.status === 401) {
        S.loaded = true; render();
        setStatus('لازم تسجّل دخول', 'err');
        return;
      }
      setStatus('تعذّر تحميل الخريطة', 'err');
    });
  }

  function apply() {
    /* ⭐ النطاق: مؤشر EGX30 (الافتراضي) أو كل الأسهم
       📌 نشتغل على allRows (الخام) ⇒ تبديل النطاق ما بيكسرش. */
    var src = S.allRows && S.allRows.length ? S.allRows : S.rows;
    if (S.scope === 'egx30' && S.egx30 && S.egx30.length) {
      var eg = {};
      for (var i = 0; i < S.egx30.length; i++) eg[S.egx30[i]] = 1;
      S.rows = src.filter(function (r) { return eg[r.code]; });
    } else {
      S.rows = src.slice();
    }
    var q = S.q.trim().toLowerCase();
    S.filtered = S.rows.filter(function (r) {
      if (S.kind !== 'all' && r.kind !== S.kind) return false;
      if (Math.abs(r.distance_pct || 0) > S.maxDist) return false;
      if (q) {
        var hay = ((r.code || '') + ' ' + (r.name || '') + ' ' + (r.sector || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    renderTable();
  }

  function render() {
    var body = $('znBody');
    if (!body) return;
    if (S.locked) {
      body.innerHTML = '<div class="su-lock"><h3>🗺️ خريطة المستويات — جزء من باقة «نماذجي»</h3>' +
        '<p>صفحة بتقولك <b>أقرب مستوى قدام كل سهم</b> قبل ما الكسر يحصل — ' +
        'مع قوة المنطقة وعدد لمساتها وآخر اختبار.</p>' +
        '<p>الباقة غير مفعّلة على حسابك — كلّم الدعم وتفعّل في ثواني (٣٥٠ جنيه/شهر).</p></div>';
      return;
    }
    if (!S.loaded) { body.innerHTML = '<div class="su-empty">بنحمّل…</div>'; return; }
    apply();
  }

  function renderTable() {
    var box = $('znTableBox');
    if (!box) return;
    if (!S.filtered.length) {
      box.innerHTML = '<div class="su-empty">⛔ مفيش مستويات مطابقة للفلاتر.</div>';
      return;
    }
    /* 🗂️ كروت بدل جدول — مفيش سحب أفقي على الموبايل */
    var cards = S.filtered.map(function (r) {
      var up = r.kind === 'resistance';
      var act = (S.selected && S.selected.code === r.code) ? ' sel' : '';
      return '<article class="su-card' + act + '" data-code="' + esc(r.code) + '" tabindex="0">' +
        '<div class="su-cardhead">' +
          '<div class="su-cardid"><b>' + esc(r.code) + '</b>' +
          '<span class="su-cardname">' + esc(r.name || '') + '</span></div>' +
          '<span class="su-dir ' + (up ? 'dn' : 'up') + '">' + (up ? '▼ مقاومة' : '▲ دعم') + '</span>' +
        '</div>' +
        '<div class="su-cardlevels">' +
          '<div><span>المستوى</span><b class="' + (up ? 'd' : 'u') + '">' + fmtPrice(r.level) + '</b></div>' +
          '<div><span>السعر</span><b>' + fmtPrice(r.price) + '</b></div>' +
          '<div><span>البُعد</span><b>' + (r.distance_pct > 0 ? '+' : '') + num(r.distance_pct, '—') + '%</b></div>' +
          '<div><span>بـATR</span><b>' + num(r.distance_atr, '—') + '</b></div>' +
        '</div>' +
        '<div class="su-cardmeta">' +
          '<span>لمسات <b>' + num(r.touches, '—') + '</b></span>' +
          '<span>آخر اختبار <b>' + esc(r.last_test || '—') + '</b></span>' +
          '<span>قوة المنطقة <b>' + num(r.score, '—') + '</b></span>' +
          '<span>تذبذب <b>' + (r.atr_pct != null ? num(r.atr_pct, '—') + '%' : '—') + '</b></span>' +
        '</div>' +
        '<div class="su-cardact">' +
          '<button class="su-chip" type="button" data-act="chart">📈 الشارت</button>' +
          '<a class="su-chip" target="_blank" rel="noopener noreferrer" href="' +
            esc((window.OCTAChartKit && window.OCTAChartKit.tvOpenUrl) ?
              window.OCTAChartKit.tvOpenUrl(r.code) :
              ('https://www.tradingview.com/chart/?symbol=EGX%3A' + encodeURIComponent(r.code))) +
            '">TradingView ↗</a>' +
        '</div>' +
      '</article>';
    }).join('');
    box.innerHTML = '<div class="su-cards">' + cards + '</div>' +
      '<div class="su-note">⛔ المستويات محسوبة من الشموع اليومية بمحرّك OCTA. ' +
      'مفيش توصية شراء أو بيع — أداة مراقبة.</div>';

    var nodes = box.querySelectorAll('.su-card');
    for (var i = 0; i < nodes.length; i++) {
      (function (card) {
        card.addEventListener('click', function () {
          select(card.getAttribute('data-code'));
        });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select(card.getAttribute('data-code'));
          }
        });
      })(nodes[i]);
    }
    if (!S.selected && S.filtered.length) select(S.filtered[0].code);
  }

  function select(code) {
    S.code = code;
    var row = null;
    for (var i = 0; i < S.filtered.length; i++) {
      if (S.filtered[i].code === code) { row = S.filtered[i]; break; }
    }
    if (!row) return;
    S.selected = row;
    var t = $('znTitle');
    if (t) t.textContent = code + ' · ' + (row.name || '');
    var sub = $('znSub');
    if (sub) {
      sub.innerHTML = 'السعر ' + fmtPrice(row.price) +
        ' · أقرب مستوى: <b>' + (row.label || '') + ' ' + fmtPrice(row.level) + '</b>' +
        ' (' + (row.distance_pct > 0 ? '+' : '') + num(row.distance_pct, '—') + '%)' +
        ' · قوة المنطقة ' + num(row.score, '—') + ' · لمسات ' + num(row.touches, '—');
    }
    drawChart(row);
  }

  function drawChart(row) {
    var box = $('znChart');
    if (!box) return;
    apiGet('/api/radar/history?list=' + encodeURIComponent(row.code) + '&n=180', 60000)
      .then(function (j) {
        var arr = j.candles || j.data || (j[row.code] || []);
        var rows = [];
        for (var i = 0; i < arr.length; i++) {
          var c = arr[i];
          var t = c.t || c.time || c.d;
          if (t == null) continue;
          rows.push({ time: typeof t === 'string' ? t : String(t),
                      open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v });
        }
        if (!rows.length) { box.innerHTML = '<div class="su-empty">مفيش شموع</div>'; return; }
        var lcolor = row.kind === 'resistance' ? '#ef4444' : '#22c55e';
        var lines = [{ price: row.level, color: lcolor, style: 2, width: 2, title: row.label || 'مستوى' }];
        var legend = [{ label: row.label || 'مستوى', price: (Math.round(row.level * 1000) / 1000),
                        color: lcolor, tag: row.kind === 'resistance' ? 'مقاومة' : 'دعم' }];
        if (window.OCTAChartKit) {
          Promise.resolve(window.OCTAChartKit.mount(box, rows, {
            lines: lines, volume: true, height: 300,
            legend: legend, legendBox: $('znLegend') }))
            .catch(function () { box.innerHTML = '<div class="su-empty">مكتبة الرسم مش متاحة</div>'; });
        } else {
          box.innerHTML = '<div class="su-empty">مكتبة الرسم مش متاحة</div>';
        }
      })
      .catch(function () { box.innerHTML = '<div class="su-empty">تعذّر جلب الشموع</div>'; });
  }

  function bind() {
    var q = $('znQ');
    if (q) q.addEventListener('input', function () { S.q = q.value; apply(); });
    var k = $('znKind');
    if (k) k.addEventListener('change', function () { S.kind = k.value; apply(); });
    var d = $('znDist');
    if (d) d.addEventListener('change', function () { S.maxDist = parseFloat(d.value) || 25; apply(); });
    var r = $('znRefresh');
    if (r) r.addEventListener('click', function () { load(); });
    var sc = $('znScope');
    if (sc) sc.addEventListener('click', function () {
      S.scope = (S.scope === 'egx30') ? 'all' : 'egx30';
      sc.textContent = (S.scope === 'egx30') ? '📊 مؤشر EGX30' : '🌐 كل الأسهم';
      S.selected = null;
      apply();
      renderTable();
    });
  }

  function init() {
    if (!$('znList')) return;
    bind();
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.OCTAZones = {
    load: load, state: S,
    _test: { renderTable: renderTable, apply: apply }
  };
})();
