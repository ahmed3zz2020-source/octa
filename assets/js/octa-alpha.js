/* ═══════════════════════════════════════════════════════════════
   OCTA Alpha — واجهة المحفظة الذكية (OPP-002C)
   ⛔ عرض بس — كل الأرقام من الـAPI (مفيش حساب في المتصفح).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API = (typeof window !== 'undefined' && window.OCTA_API) ? window.OCTA_API : '';
  var S = {
    data: null,          /* رد /api/alpha/portfolio */
    perf: null,          /* رد /api/alpha/performance */
    view: 'cards',       /* cards | table | map */
    open: {},            /* السهم المفتوح */
    critOpen: false,     /* كارت التفسير */
    labOpen: false,      /* لوحة المختبر */
    notifOpen: false,    /* مركز الإشعارات */
    perfOpen: false,     /* الأداء مقابل المؤشر (مقفول افتراضياً) */
    decOpen: false,      /* سجل القرارات (مقفول افتراضياً) */
    mapSel: null,       /* السهم المختار في الخريطة */
    lab: null,
    alerts: null,
    decisions: null,
    loading: false,
    error: ''
  };

  /* ─────────── أدوات ─────────── */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ar(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[0-9]+(?:\.[0-9]+)?/g, function (n) {
        var p = n.split('.'), o = p[0].replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(d); });
        if (p.length > 1) o += '٫' + p[1].replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(d); });
        return o;
      });
  }
  function num(v, dec) {
    if (v === null || v === undefined || v === '') return '—';
    var f = parseFloat(v);
    if (isNaN(f)) return '—';
    var d = (dec === undefined) ? 2 : dec;
    var s = f.toFixed(d).replace(/\.00$/, '');
    return ar(s);
  }
  function pct(v) { return (v === null || v === undefined) ? '—' : num(v, 1) + '٪'; }
  /* ⭐ نسبة بإشارة ⇒ داخل <bdi> عشان الـ«-» والـ«٪» ما يتقلبوش في العربي */
  function signedPct(v) {
    if (v === null || v === undefined) return '—';
    return (v >= 0 ? '+' : '') + num(v, 1) + '٪';
  }
  function money(v) {
    if (v === null || v === undefined) return '—';
    return ar(Math.round(parseFloat(v)).toLocaleString('en-US')) + ' ج.م';
  }
  function fmtDate(ts) {
    var m = String(ts || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '—';
    var MN = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو',
      'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return ar(m[3]) + ' ' + (MN[parseInt(m[2], 10) - 1] || m[2]) + ' ' + ar(m[1]);
  }
  function fetchJSON(url) {
    var p = (typeof octaFetch === 'function') ? octaFetch(url) : fetch(url);
    return p.then(function (r) {
      var st = (r && r.status) ? r.status : 0;
      if (st === 401 || st === 403) throw new Error('انتهت الجلسة — سجّل دخولك تاني');
      if (st === 404 || st === 405) throw new Error('محرّك Alpha غير متاح على السيرفر');
      if (st >= 400) throw new Error('الخادم رجّع خطأ ' + st);
      return r.json().catch(function () { throw new Error('رد غير مفهوم من الخادم'); });
    });
  }

  /* ─────────── التحميل ─────────── */
  function load() {
    S.loading = true; S.error = '';
    render();
    return Promise.all([
      fetchJSON(API + '/api/alpha/portfolio'),
      fetchJSON(API + '/api/alpha/performance').catch(function () { return null; }),
      fetchJSON(API + '/api/alpha/lab').catch(function () { return null; }),
      fetchJSON(API + '/api/alpha/alerts').catch(function () { return null; }),
      fetchJSON(API + '/api/alpha/decisions').catch(function () { return null; })
    ]).then(function (res) {
      S.data = (res[0] && res[0].portfolio) ? res[0].portfolio : res[0];
      S.perf = res[1];
      S.lab = res[2];
      S.alerts = res[3];
      S.decisions = res[4];
      S.loading = false;
      render();
    }).catch(function (e) {
      S.loading = false;
      S.error = (e && e.message) ? e.message : 'خطأ غير متوقع';
      render();
    });
  }

  /* ─────────── الرسم ─────────── */
  function render() {
    var box = document.getElementById('armBody');
    if (!box) return;
    if (S.loading) {
      box.innerHTML = '<div class="alpha-wrap"><div class="opps-loading">⏳ بنحسب المحفظة…</div></div>';
      return;
    }
    if (S.error) {
      box.innerHTML = '<div class="alpha-wrap"><div class="opps-error"><b>مش قادرين نجيب المحفظة دلوقتي</b>'
        + '<p>' + esc(S.error) + '</p>'
        + '<button class="opps-btn" onclick="window.__alphaReload()">إعادة المحاولة</button></div></div>';
      return;
    }
    if (!S.data) { box.innerHTML = '<div class="alpha-wrap"></div>'; return; }
    var d = S.data;
    var h = '<div class="alpha-wrap">';

    /* ── الترويسة ── */
    h += '<div class="alpha-hero"><span class="alpha-hero-ico">🐙</span><div>'
      + '<div class="alpha-hero-t">OCTA Alpha</div>'
      + '<div class="alpha-hero-s">' + esc(d.tagline_ar || '') + '</div></div></div>';

    /* ── لوحة الأداء ── */
    h += boardHTML(d, S.perf);

    /* ── التبويبات (٣ طرق عرض) ── */
    h += '<div class="alpha-views">'
      + viewBtn('cards', '🃏 الكروت') + viewBtn('table', '📋 جدول') + viewBtn('map', '🗺️ خريطة')
      + '</div>';

    /* ── المحتوى ── */
    if (S.view === 'table') h += tableHTML(d);
    else if (S.view === 'map') h += mapHTML(d);
    else h += cardsHTML(d);

    /* ── لوحة الأداء التفصيلية ── */
    h += perfHTML(S.perf);

    /* ── مركز الإشعارات ── */
    h += notifHTML(S.alerts);

    /* ── سجل القرارات ── */
    h += decisionsHTML(S.decisions);

    /* ── مختبر Alpha ── */
    h += labHTML(S.lab);

    /* ── كارت التفسير ── */
    h += explainHTML(d);

    h += '</div>';
    box.innerHTML = h;
  }

  function viewBtn(k, label) {
    return '<button class="alpha-view-btn' + (S.view === k ? ' on' : '') + '" '
      + 'onclick="window.__alphaView(\'' + k + '\')">' + label + '</button>';
  }

  /* ─────────── لوحة الأداء ─────────── */
  function boardHTML(d, perf) {
    var sum = d.summary || {};
    var risk = d.risk || {};
    var total = sum.total_value;
    var ret = sum.total_return_pct;
    var since = (perf && perf.performance && perf.performance.periods) ?
      (perf.performance.periods.since_inception || {}) : {};
    var bench = since.benchmark_return_pct;
    var active = since.active_return_pct;
    var created = d.ledger && d.ledger.created_at;
    var lastUpd = (perf && perf.performance && perf.performance.last_update) || null;

    var h = '<div class="alpha-board">';
    var nSec = Object.keys(d.sector_weights || {}).length;
    h += kpi('قيمة المحفظة', money(total), 'رأس المال ' + money(sum.capital), 'base');
    h += kpi('العائد الكلي', (ret === null || ret === undefined) ? '—' : (ret >= 0 ? '+' : '') + pct(ret),
      'من يوم بداية المحفظة', (ret >= 0 ? 'up' : 'down'));
    h += kpi('أداء مؤشر البورصة', bench === null || bench === undefined ? '—' : (bench >= 0 ? '+' : '') + pct(bench),
      'محتاج تاريخ أطول', '');
    h += kpi('فرق الأداء عن المؤشر', active === null || active === undefined ? '—' : (active >= 0 ? '+' : '') + pct(active),
      'هل المحفظة أحسن من البورصة؟', (active >= 0 ? 'up' : 'down'));
    h += kpi('عدد الأسهم', ar(d.n_positions) + ' من ' + ar(d.target_positions),
      'كاش ' + num(d.cash_pct, 2) + '٪', '');
    /* ⭐ «تركيز أعلى ٣» ⇒ phrasing واضح: نصيب أكبر ٣ أسهم
       (ومش رقم مؤشر تقني على السطح) */
    h += kpi('نصيب أكبر ٣ أسهم', pct(risk.top3_concentration_pct), 'من فلوس المحفظة', '');
    h += kpi('عدد القطاعات', ar(nSec) + ' قطاع', 'التوزيع مش متركّز', '');
    h += kpi('تذبذب المحفظة', pct(risk.portfolio_volatility_pct), 'سنوي (من الشموع اليومية)', '');
    h += kpi('تاريخ التأسيس', created ? fmtDate(created) : '—', 'آخر تحديث ' + (lastUpd ? fmtDate(lastUpd) : '—'), '');
    h += '</div>';

    /* ⭐ تحذير صريح: بيانات غير كافية */
    if (perf && perf.performance && perf.performance.notes_ar && perf.performance.notes_ar.length) {
      h += '<div class="opps-stale">⚠️ ' + esc(perf.performance.notes_ar.join(' · ')) + '</div>';
    }
    var p30 = (perf && perf.performance && perf.performance.periods) ? perf.performance.periods['30d'] : null;
    if (p30 && p30.ok === false) {
      h += '<div class="opps-stale">⏳ ' + esc(p30.note_ar || 'البيانات الفعلية غير كافية لهذه المدة.') + '</div>';
    }
    h += '<div class="alpha-note">محفظة **نموذجية افتراضية** — الأسعار المسجّلة هي أسعار مرجعية، '
      + 'ومفيش أي معاملة حقيقية اتنفّذت.</div>';
    return h;
  }

  function kpi(label, value, sub, cls) {
    /* ⭐ عزل ثنائي الاتجاه (bdi) ⇒ الـ«-» والـ«٪» في مكانهم الصح
       (من غير كده: «-١٫٤٪» بيتقلب لـ «%١٫٤-» في الشاشة العربية). */
    return '<div class="alpha-kpi ' + (cls || '') + '"><div class="alpha-kpi-l">' + esc(label)
      + '</div><div class="alpha-kpi-v"><bdi>' + value + '</bdi></div>'
      + '<div class="alpha-kpi-s">' + esc(sub || '') + '</div></div>';
  }

  /* ─────────── الكروت ─────────── */
  function cardsHTML(d) {
    var pos = d.positions || [];
    if (!pos.length) {
      return '<div class="opps-empty"><b>لا توجد مراكز مؤهلة دلوقتي</b>'
        + '<p>السيولة أو التغطية مش كافية لاختيار أسهم — والمحفظة محفوظة نقد.</p></div>';
    }
    var h = '<div class="alpha-cards">';
    pos.forEach(function (p) {
      h += cardHTML(p, d);
    });
    h += '</div>';
    return h;
  }

  function cardHTML(p, d) {
    var open = !!S.open[p.code];
    var sum = (d.summary && d.summary.positions) || [];
    var live = null;
    for (var i = 0; i < sum.length; i++) if (sum[i].code === p.code) live = sum[i];
    var pnl = live ? live.pnl_pct : null;
    var cls = pnl === null ? '' : (pnl >= 0 ? 'up' : 'down');
    var crit = p.criterion_scores || {};
    var role = p.role_ar || 'توازن في المحفظة';

    var h = '<div class="alpha-card' + (open ? ' open' : '') + '" data-code="' + esc(p.code) + '">';
    h += '<div class="alpha-card-hd" onclick="window.__alphaToggle(\'' + esc(p.code) + '\')">';
    h += '<div class="alpha-rank">' + ar(p.rank) + '</div>';
    h += '<div class="alpha-card-id"><b>' + esc(p.code) + '</b>'
      + '<span>' + esc(p.name || '') + '</span></div>';
    h += '<div class="alpha-card-sector">' + esc(p.sector || '') + '</div>';
    h += '<div class="alpha-card-w"><b>' + pct(p.weight) + '</b><span>الوزن</span></div>';
    h += '<div class="alpha-card-score ' + cls + '"><b>' + num(p.portfolio_score, 1) + '</b><span>تقييم</span></div>';
    h += '</div>';

    h += '<div class="alpha-card-bd">';
    h += '<div class="alpha-role">🎯 ' + esc(role) + '</div>';
    if (open) {
      var rows = [];
      rows.push(['الكمية', ar(live ? live.qty : p.qty) + ' سهم']);
      rows.push(['سعر الدخول', num(live ? live.entry_price : p.entry_price, 2) + ' ج.م']);
      rows.push(['السعر الحالي', num(live ? live.price : p.price, 2) + ' ج.م']);
      if (pnl !== null) rows.push(['الربح/الخسارة غير المحققة', signedPct(pnl)]);
      rows.push(['قيمة المركز', money(live ? live.value : p.value)]);
      rows.push(['درجة المخاطرة', pct(p.risk_score)]);
      rows.push(['متوسط الارتباط بالمحفظة', p.avg_correlation !== undefined && p.avg_correlation !== null ? num(p.avg_correlation, 2) : '—']);

      h += '<div class="alpha-kv">' + rows.map(function (r) {
        /* ⭐ <bdi> حوالين القيمة ⇒ الـ«-» والـ«٪» في مكانهم الصح */
        return '<div class="alpha-kv-r"><span>' + esc(r[0]) + '</span><b><bdi>'
          + esc(r[1]) + '</bdi></b></div>';
      }).join('') + '</div>';

      /* ⭐ معايير المحفظة */
      h += '<div class="alpha-crits">';
      (d.criteria || []).forEach(function (c) {
        var v = crit[c.key];
        var w = (v === null || v === undefined) ? 0 : Math.max(0, Math.min(100, v));
        h += '<div class="alpha-crit' + ((v === null || v === undefined) ? ' miss' : '') + '">'
          + '<div class="alpha-crit-k" title="' + esc(c.label_ar) + '">' + esc(c.label_ar) + '</div>'
          + '<div class="alpha-crit-bar"><i style="width:' + w.toFixed(0) + '%"></i></div>'
          + '<div class="alpha-crit-v">' + ((v === null || v === undefined) ? 'غير متاح' : num(v, 0) + '٪') + '</div>'
          + '</div>';
      });
      h += '</div>';

      /* ⭐ دور السهم في المحفظة */
      h += '<div class="alpha-why"><b>ما دور هذا السهم في OCTA Alpha؟</b>'
        + '<p>' + esc(role) + '</p>'
        + ((p.reasons && p.reasons.length)
          ? '<p class="alpha-why-why"><b>ليه دخل:</b> ' + esc(p.reasons.slice(0, 3).join(' · ')) + '</p>'
          : '')
        + (p.strategies && p.strategies.length
          ? '<p>مرشّح في: ' + p.strategies.map(function (s) {
            return esc(s.key) + ' (' + num(s.score, 1) + ')';
          }).join(' · ') + '</p>' : '')
        + '</div>';
    }
    h += '</div></div>';
    return h;
  }

  /* ─────────── الجدول ─────────── */
  function tableHTML(d) {
    var sum = d.summary && d.summary.positions || [];
    var byCode = {};
    sum.forEach(function (s) { byCode[s.code] = s; });
    var pos = d.positions || [];
    var h = '<div class="alpha-table-wrap"><table class="alpha-table"><thead><tr>'
      + '<th>#</th><th>الرمز</th><th>الشركة</th><th>القطاع</th><th>الوزن</th>'
      + '<th>الدخول</th><th>الحالي</th><th>الربح/الخسارة</th><th>القيمة</th>'
      + '<th>التقييم</th><th>المخاطرة</th></tr></thead><tbody>';
    pos.forEach(function (p) {
      var live = byCode[p.code] || {};
      var pnl = live.pnl_pct;
      var cls = pnl === null || pnl === undefined ? '' : (pnl >= 0 ? 'up' : 'down');
      h += '<tr onclick="window.__alphaToggle(\'' + esc(p.code) + '\')">'
        + '<td>' + ar(p.rank) + '</td>'
        + '<td><b>' + esc(p.code) + '</b></td>'
        + '<td>' + esc(p.name || '') + '</td>'
        + '<td>' + esc(p.sector || '') + '</td>'
        + '<td>' + pct(p.weight) + '</td>'
        + '<td>' + num(live.entry_price !== undefined ? live.entry_price : p.entry_price, 2) + '</td>'
        + '<td>' + num(live.price !== undefined ? live.price : p.price, 2) + '</td>'
        + '<td class="' + cls + '"><bdi>' + signedPct(pnl) + '</bdi></td>'
        + '<td>' + money(live.value !== undefined ? live.value : p.value) + '</td>'
        + '<td>' + num(p.portfolio_score, 1) + '</td>'
        + '<td>' + pct(p.risk_score) + '</td>'
        + '</tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  /* ─────────── الخريطة: Treemap حقيقي (مربّعات متناسبة مع الوزن) ─────────── */
  function mapHTML(d) {
    var pos = (d.positions || []).slice();
    if (!pos.length) {
      return '<div class="alpha-empty">مفيش مراكز لعرضها.</div>';
    }
    /* ⭐ الترتيب: الأكبر وزناً الأول (زي أي Treemap) */
    pos.sort(function (a, b) { return (b.weight || 0) - (a.weight || 0); });
    var W = 340, H = 232;
    var cells = squarify(pos, 0, 0, W, H);
    var h = '<div class="alpha-map">';
    h += '<svg class="alpha-map-svg" viewBox="0 0 ' + W + ' ' + H + '" '
      + 'preserveAspectRatio="xMidYMid meet" role="img" aria-label="خريطة أوزان المحفظة">';
    cells.forEach(function (c) {
      var p = c.item;
      var sc = p.portfolio_score || 0;
      var fill = sc >= 75 ? '#15803d' : (sc >= 60 ? '#6d28d9' : '#b45309');
      var sel = (S.mapSel === p.code) ? ' sel' : '';
      var big = (c.w >= 74 && c.h >= 44);
      var mid = (c.w >= 46 && c.h >= 30);
      h += '<g class="alpha-mcell' + sel + '" onclick="window.__alphaMapPick(\'' + esc(p.code) + '\')">';
      h += '<title>' + esc(p.code + ' — ' + (p.name || '') + ' — الوزن ' + pct(p.weight)
        + ' — التقييم ' + num(sc, 1)) + '</title>';
      h += '<rect x="' + c.x.toFixed(1) + '" y="' + c.y.toFixed(1) + '" width="' + c.w.toFixed(1)
        + '" height="' + c.h.toFixed(1) + '" fill="' + fill + '"/>';
      var cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      if (big) {
        h += '<text class="mc-code" x="' + cx.toFixed(1) + '" y="' + (cy - 12).toFixed(1) + '" text-anchor="middle">' + esc(p.code) + '</text>';
        h += '<text class="mc-w" x="' + cx.toFixed(1) + '" y="' + (cy + 4).toFixed(1) + '" text-anchor="middle">' + pct(p.weight) + '</text>';
        h += '<text class="mc-sc" x="' + cx.toFixed(1) + '" y="' + (cy + 18).toFixed(1) + '" text-anchor="middle">تقييم ' + num(sc, 0) + '</text>';
      } else if (mid) {
        h += '<text class="mc-code" x="' + cx.toFixed(1) + '" y="' + (cy - 2).toFixed(1) + '" text-anchor="middle">' + esc(p.code) + '</text>';
        h += '<text class="mc-w" x="' + cx.toFixed(1) + '" y="' + (cy + 12).toFixed(1) + '" text-anchor="middle">' + pct(p.weight) + '</text>';
      } else {
        h += '<text class="mc-code" x="' + cx.toFixed(1) + '" y="' + (cy + 3).toFixed(1) + '" text-anchor="middle">' + esc(p.code) + '</text>';
      }
      h += '</g>';
    });
    h += '</svg>';
    h += '<div class="alpha-map-legend">'
      + '<span>مساحة المربع = نصيب السهم من المحفظة</span>'
      + '<span class="alpha-legend-item"><i class="lg-hi"></i>تقييم ٧٥+</span>'
      + '<span class="alpha-legend-item"><i class="lg-mid"></i>٦٠-٧٥</span>'
      + '<span class="alpha-legend-item"><i class="lg-lo"></i>أقل من ٦٠</span>'
      + '</div></div>';
    /* ⭐ لوحة التفاصيل (بتظهر عند الضغط على مربع) */
    h += mapDetailHTML(d);
    return h;
  }

  /* ⭐ خوارزمية الـsquarified: مربّعات متناسبة مع الوزن (مش مجرد flex)
     المرجع: Bruls, Huizing & van Wijk (2000) */
  function squarify(items, x, y, w, h) {
    var out = [];
    var list = items.slice();
    var total = 0;
    list.forEach(function (p) { total += (p.weight || 0); });
    if (!total || !(w > 0) || !(h > 0)) return out;
    var scale = (w * h) / total;          /* المساحة لكل وحدة وزن */
    var rect = { x: x, y: y, w: w, h: h };
    var row = [], rowSum = 0;

    function worst(rowItems, rSum, side) {
      var minA = Infinity;
      for (var i = 0; i < rowItems.length; i++) {
        var a = (rowItems[i].weight || 0) * scale;
        if (a < minA) minA = a;
      }
      var sum = rSum * scale;
      var s1 = minA * side * side;
      var s2 = sum * sum;
      if (!(s1 > 0) || !(s2 > 0)) return Infinity;
      return Math.max(s2 / s1, s1 / s2);
    }

    function flushRow(vert) {
      if (!row.length) return;
      var sum = rowSum * scale;                       /* مساحة الصف */
      var stackLen = vert ? rect.h : rect.w;          /* اتجاه الرصف */
      var thick = stackLen > 0 ? sum / stackLen : 0;  /* سُمك الصف */
      var used = 0;
      for (var i = 0; i < row.length; i++) {
        var it = row[i];
        var area = (it.weight || 0) * scale;
        var len = thick > 0 ? area / thick : 0;       /* طول المربع */
        if (vert) {
          out.push({ item: it, x: rect.x, y: rect.y + used, w: thick, h: len });
        } else {
          out.push({ item: it, x: rect.x + used, y: rect.y, w: len, h: thick });
        }
        used += len;
      }
      if (vert) { rect.x += thick; rect.w -= thick; }
      else { rect.y += thick; rect.h -= thick; }
      row = []; rowSum = 0;
    }

    while (list.length) {
      var it = list.shift();
      var wgt = it.weight || 0;
      if (!row.length) { row = [it]; rowSum = wgt; continue; }
      var side = Math.min(rect.w, rect.h);
      var newSum = rowSum + wgt;
      if (worst(row.concat([it]), newSum, side) <= worst(row, rowSum, side)) {
        row.push(it); rowSum = newSum;
      } else {
        flushRow(rect.w >= rect.h);
        row = [it]; rowSum = wgt;
      }
    }
    if (row.length) flushRow(rect.w >= rect.h);
    return out;
  }

  /* ─────────── لوحة تفاصيل السهم (من الخريطة) ─────────── */
  function mapDetailHTML(d) {
    var code = S.mapSel;
    if (!code) return '';
    var p = null;
    (d.positions || []).forEach(function (x) { if (x.code === code) p = x; });
    if (!p) return '';
    var sum = (d.summary && d.summary.positions) || [];
    var live = null;
    sum.forEach(function (s) { if (s.code === code) live = s; });
    var pnl = live ? live.pnl_pct : null;
    var rows = [
      ['الكمية', ar(live ? live.qty : p.qty) + ' سهم'],
      ['سعر الدخول', num(live ? live.entry_price : p.entry_price, 2) + ' ج.م'],
      ['السعر الحالي', num(live ? live.price : p.price, 2) + ' ج.م'],
      ['الربح/الخسارة غير المحققة', signedPct(pnl)],
      ['الوزن في المحفظة', pct(p.weight)],
      ['القطاع', p.sector || '—'],
      ['درجة المخاطرة', pct(p.risk_score)],
      ['متوسط الارتباط بالمحفظة', (p.avg_correlation === null || p.avg_correlation === undefined) ? '—' : num(p.avg_correlation, 2)],
      ['دوره في المحفظة', p.role_ar || '—']
    ];
    var h = '<div class="alpha-mdetail">';
    h += '<div class="alpha-mdetail-h"><b>' + esc(p.code) + '</b>'
      + '<span>' + esc(p.name || '') + '</span>'
      + '<button class="alpha-mdetail-x" onclick="window.__alphaMapPick(null)">✕</button></div>';
    h += '<div class="alpha-kv">' + rows.map(function (r) {
      return '<div class="alpha-kv-r"><span>' + esc(r[0]) + '</span><b><bdi>'
        + esc(r[1]) + '</bdi></b></div>';
    }).join('') + '</div>';
    h += '<button class="alpha-mdetail-go" onclick="window.__alphaGoCard(\'' + esc(p.code) + '\')">'
      + 'افتح التحليل الكامل لهذا السهم ←</button>';
    h += '</div>';
    return h;
  }

  /* ─────────── لوحة الأداء التفصيلية (فترات + منحنى) ─────────── */
  function perfHTML(perf) {
    var h = '<div class="alpha-sec">';
    h += '<div class="alpha-sec-h" onclick="window.__alphaTogglePerf()">📈 الأداء مقابل المؤشر'
      + ' <span class="alpha-arrow">' + (S.perfOpen ? '▴' : '▾') + '</span></div>';
    if (!S.perfOpen) { h += '</div>'; return h; }
    if (!perf || !perf.performance) {
      h += '<div class="alpha-muted">بيانات الأداء غير متاحة دلوقتي.</div></div>';
      return h;
    }
    var p = perf.performance;
    var periods = p.periods || {};
    var order = [['30d', 'شهر'], ['90d', '٣ شهور'], ['183d', '٦ شهور'],
                 ['365d', 'سنة'], ['since_inception', 'من التأسيس']];
    h += '<div class="alpha-perf">';
    h += '<div class="alpha-perf-h"><span>الفترة</span><span>المحفظة</span><span>المؤشر</span><span>الفرق</span></div>';
    order.forEach(function (row) {
      var per = periods[row[0]] || {};
      var ok = per.ok === true;
      h += '<div class="alpha-perf-r' + (ok ? '' : ' na') + '">'
        + '<span>' + esc(row[1]) + '</span>'
        + '<span>' + (ok ? sign(per.portfolio_return_pct) : '—') + '</span>'
        + '<span>' + (ok ? sign(per.benchmark_return_pct) : '—') + '</span>'
        + '<span class="' + clsOf(per.active_return_pct) + '">' + (ok ? sign(per.active_return_pct) : '—') + '</span>'
        + '</div>';
    });
    h += '</div>';
    if (p.notes_ar && p.notes_ar.length) {
      h += '<div class="alpha-muted">ℹ️ ' + esc(p.notes_ar.join(' · ')) + '</div>';
    }
    /* ⭐ منحنى القيمة (SVG) — لو مفيش تاريخ حقيقي ⇒ نعلن */
    var curve = (perf.curve && perf.curve.points) ? perf.curve.points : null;
    if (curve && curve.length > 1) {
      h += curveSVG(curve);
    } else {
      h += '<div class="alpha-muted">📉 الرسم البياني لسه مش متاح — '
        + 'محتاج تاريخ تقييمات أكتر من نقطة واحدة (الحقيقة مش الاختراع).</div>';
    }
    /* ⭐ فصل واضح: فعلي ↔ افتراضي */
    h += '<div class="alpha-split"><div class="alpha-split-i real">'
      + '<b>فعلي</b><span>ما تم تسجيله فعلاً في دفتر التداول</span></div>'
      + '<div class="alpha-split-i sim"><b>افتراضي</b><span>محاكاة — مش معاملات حقيقية</span></div></div>';
    h += '</div>';
    return h;
  }

  function sign(v) {
    if (v === null || v === undefined) return '—';
    return '<bdi>' + (v >= 0 ? '+' : '') + num(v, 2) + '٪</bdi>';
  }
  function clsOf(v) {
    if (v === null || v === undefined) return '';
    return v >= 0 ? 'up' : 'down';
  }

  function curveSVG(points) {
    var W = 340, H = 110, pad = 6;
    var vals = points.map(function (p) { return p.value; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 1e-9) { max = min + 1; }
    var n = points.length;
    var d = '', dB = '';
    var bmin = null, bmax = null;
    points.forEach(function (p) {
      if (p.benchmark === null || p.benchmark === undefined) return;
      if (bmin === null || p.benchmark < bmin) bmin = p.benchmark;
      if (bmax === null || p.benchmark > bmax) bmax = p.benchmark;
    });
    if (bmax === null) { bmax = max; bmin = min; }
    points.forEach(function (p, i) {
      var x = pad + (i / Math.max(1, n - 1)) * (W - 2 * pad);
      var y = H - pad - ((p.value - min) / (max - min)) * (H - 2 * pad);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      if (p.benchmark !== null && p.benchmark !== undefined && (bmax - bmin) > 1e-9) {
        var yb = H - pad - ((p.benchmark - bmin) / (bmax - bmin)) * (H - 2 * pad);
        dB += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yb.toFixed(1) + ' ';
      }
    });
    return '<div class="alpha-curve"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
      + (dB ? '<path d="' + dB + '" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3"/>' : '')
      + '<path d="' + d + '" fill="none" stroke="#7c3aed" stroke-width="2"/>'
      + '</svg><div class="alpha-curve-l">'
      + '<span><i class="cv-p"></i>المحفظة</span>'
      + (dB ? '<span><i class="cv-b"></i>المؤشر</span>' : '')
      + '</div></div>';
  }

  /* ─────────── مركز الإشعارات ─────────── */
  function notifHTML(al) {
    var list = (al && al.alerts) ? al.alerts : [];
    var unread = (al && al.unread !== undefined) ? al.unread : 0;
    var tg = (al && al.telegram) ? al.telegram : {};
    var h = '<div class="alpha-sec">';
    h += '<div class="alpha-sec-h" onclick="window.__alphaToggleNotif()">'
      + '🔔 مركز الإشعارات <span class="alpha-badge' + (unread ? ' on' : '') + '">'
      + ar(unread) + '</span> <span class="alpha-arrow">' + (S.notifOpen ? '▴' : '▾') + '</span></div>';
    if (S.notifOpen) {
      if (!list.length) {
        h += '<div class="alpha-muted">مفيش إشعارات دلوقتي — بنراقب السعر والتركيز والحدود.</div>';
      } else {
        h += '<div class="alpha-notifs">' + list.slice(-10).reverse().map(function (e) {
          return '<div class="alpha-notif ' + (e.severity || 'info') + '">'
            + '<b>' + esc(e.rule_ar || '') + '</b>'
            + '<span>' + esc(e.text_ar || '') + '</span>'
            + '<small>' + fmtDate(e.date) + '</small></div>';
        }).join('') + '</div>';
      }
      var tgo = tg.enabled ? 'مفعّلة' : 'مقفولة';
      h += '<div class="alpha-muted">قناة تيليجرام: <b>' + tgo + '</b> — '
        + (tg.enabled ? 'بيتبعت إشعار لكل حدث مهم.'
          : 'مقفولة لحد ما يوافق المالك (مفيش أي إرسال دلوقتي).')
        + (tg.last_error ? ' آخر خطأ: ' + esc(tg.last_error) : '') + '</div>';
    }
    h += '</div>';
    return h;
  }

  /* ─────────── سجل القرارات ─────────── */
  function decisionsHTML(dec) {
    var list = (dec && dec.decisions) ? dec.decisions : [];
    var props = (dec && dec.proposals && dec.proposals.actions) ? dec.proposals.actions : [];
    var h = '<div class="alpha-sec">';
    h += '<div class="alpha-sec-h" onclick="window.__alphaToggleDec()">🧾 سجل القرارات'
      + ' <span class="alpha-arrow">' + (S.decOpen ? '▴' : '▾') + '</span></div>';
    if (!S.decOpen) { h += '</div>'; return h; }
    if (props.length) {
      h += '<div class="alpha-props">';
      props.slice(0, 5).forEach(function (p) {
        h += '<div class="alpha-prop ' + (p.kind || '') + '"><b>' + esc(p.kind_ar || p.kind || '') + '</b>'
          + '<span>' + esc(p.reason_ar || p.note_ar || '') + '</span></div>';
      });
      h += '</div><div class="alpha-muted">اقتراحات فقط — محتاجة موافقة قبل التنفيذ.</div>';
    }
    if (!list.length) {
      h += '<div class="alpha-muted">مفيش قرارات متسجّلة بعد.</div>';
    } else {
      h += '<div class="alpha-notifs">' + list.slice(-8).reverse().map(function (d) {
        return '<div class="alpha-notif info"><b>' + esc(d.action || '') + '</b>'
          + '<span>' + esc((d.name || d.code || '') + ' — ' + (d.reason_ar || d.reason || '')) + '</span>'
          + '<small>' + fmtDate(d.date) + '</small></div>';
      }).join('') + '</div>';
    }
    h += '</div>';
    return h;
  }

  /* ─────────── مختبر Alpha ─────────── */
  function labHTML(lab) {
    if (!lab) return '';
    var h = '<div class="alpha-sec alpha-lab">';
    h += '<div class="alpha-sec-h" onclick="window.__alphaToggleLab()">'
      + '🧪 مختبر Alpha <span class="alpha-arrow">' + (S.labOpen ? '▴' : '▾') + '</span></div>';
    if (S.labOpen) {
      var ch = lab.champion || {};
      var wf = lab.walk_forward || {};
      var errs = (lab.errors && lab.errors.summary) ? lab.errors.summary : [];
      h += '<div class="alpha-lab-hd">إصدار النموذج: <b>' + esc(lab.model_version || '—') + '</b></div>';
      h += '<div class="alpha-muted">' + esc(lab.data_sufficiency_ar || '') + '</div>';
      h += '<div class="alpha-lab-box"><b>النموذج المعتمد</b><span>' + esc(ch.version || '—') + '</span>'
        + '<small>' + esc(ch.status_ar || '') + '</small></div>';
      var chs = lab.challengers || [];
      if (chs.length) {
        chs.forEach(function (c) {
          h += '<div class="alpha-lab-box alt"><b>متحدّي</b><span>' + esc(c.version || '') + '</span>'
            + '<small>' + esc(c.status_ar || '') + '</small></div>';
        });
      } else {
        h += '<div class="alpha-muted">مفيش متحدّي شغّال دلوقتي.</div>';
      }
      if (errs.length) {
        h += '<div class="alpha-lab-sub">تصنيف الأخطاء</div><div class="alpha-errs">';
        errs.forEach(function (e) {
          h += '<div class="alpha-err"><b>' + ar(e.count) + '×</b><span>' + esc(e.label_ar || '')
            + '</span><small>' + pct(e.share_pct) + '</small></div>';
        });
        h += '</div>';
      } else {
        h += '<div class="alpha-muted">مفيش صفقات مغلقة نصنّفها بعد.</div>';
      }
      h += '<div class="alpha-lab-sub">الاختبار على فترات (Walk-forward)</div>';
      if (wf.ok) {
        h += '<div class="alpha-muted">'
          + ar(wf.n_folds) + ' جولة · ربح في ' + ar(wf.win_folds) + ' جولة · الإجمالي '
          + sign(wf.total_return_pct) + '</div>';
        h += '<div class="alpha-folds">' + (wf.folds || []).map(function (f) {
          return '<div class="alpha-fold ' + clsOf(f.test_return_pct) + '">'
            + '<b>جولة ' + ar(f.fold) + '</b><span>' + sign(f.test_return_pct) + '</span>'
            + '<small>' + ar(f.test_days) + ' يوم اختبار</small></div>';
        }).join('') + '</div>';
      } else {
        h += '<div class="alpha-muted">' + esc(wf.note_ar || 'البيانات غير كافية.') + '</div>';
      }
      h += '<div class="alpha-muted">⛔ ' + esc(lab.note_ar || '') + '</div>';
    }
    h += '</div>';
    return h;
  }

  /* ─────────── كارت التفسير ─────────── */
  function explainHTML(d) {
    var risk = d.risk || {};
    var groups = d.economic_group_weights || {};
    var nSec = Object.keys(d.sector_weights || {}).length;
    var h = '<div class="alpha-critcard' + (S.critOpen ? ' open' : '') + '">';
    h += '<button class="alpha-critcard-hd" onclick="window.__alphaToggleCrit()" aria-expanded="'
      + (S.critOpen ? 'true' : 'false') + '">'
      + '<span class="alpha-critcard-ico">📘</span>'
      + '<span class="alpha-critcard-t">لماذا اختارت OCTA هذه الأسهم العشرة؟</span>'
      + '<span class="alpha-critcard-arrow">' + (S.critOpen ? '▴' : '▾') + '</span></button>';
    if (S.critOpen) {
      h += '<div class="alpha-critcard-bd">';
      h += explainBlock('الهدف', 'محفظة نموذجية شفافة من الأسهم المصرية، قاعدة بمدير محفظة: اختيار + توازن + مخاطرة مضبوطة + سجل قرارات.');
      h += explainBlock('مدة الاستثمار', d.horizon_ar || 'من ٣ شهور إلى سنة');
      h += explainBlock('إزاي جابنا المرشحين', 'من التابات التسعة لمحرّك الفرص — ١٠ مرشحين لكل تاب، وإزالة التكرار، ثم تقييم موحّد بمعايير المحفظة (مش مقارنة درجات خام).');
      h += explainBlock('معايير التقييم', (d.criteria || []).map(function (c) {
        return c.label_ar + ' ' + num(c.weight, 0) + '٪';
      }).join(' · '));
      h += explainBlock('ليه الأسهم دي بالتحديد', 'لأنها بتجمّع أفضل نتيجة على معايير المحفظة السبعة '
        + '(جودة · تقييم · فني · سيولة · محفزات · عائد مقابل مخاطرة · تنويع)، '
        + 'وكمان بتنسجم مع باقي أسهم المحفظة من ناحية التنويع.');
      h += explainBlock('ليه مش أعلى تقييم', 'لأن الاختيار للمحفظة مش للسهم: سهم ممتاز لوحده ممكن يضيف تركيز قطاعي أو ارتباط عالي — فبيتقصّ.');
      h += explainBlock('إزاي اتحدد الوزن', 'الوزن = درجة المحفظة محوّلة خطياً (٥٪-١٥٪) مع تطبيع ⇒ المجموع ١٠٠٪ والكاش الباقي.');
      h += explainBlock('توزيع القطاعات', 'الحدّ الأقصى ' + pct((d.limits || {}).sector_cap) + ' لكل قطاع · والمجموعة الاقتصادية ' + pct((d.limits || {}).economic_group_cap) + '. التوزيع الحالي: '
        + Object.keys(d.sector_weights || {}).map(function (k) { return k + ' ' + pct(d.sector_weights[k]); }).join(' · '));
      h += explainBlock('نصيب أكبر ٣ أسهم', 'الثلاثة الكبار بياخدوا ' + pct(risk.top3_concentration_pct)
        + ' من فلوس المحفظة — يعني لو وزنهم كله كان في سهم واحد، المحفظة كانت أأمن. '
        + 'والباقي موزّع على ' + ar(nSec) + ' قطاعات مختلفة، ومفيش قطاع واحد بياخد أكتر من '
        + pct((d.limits || {}).sector_cap) + '.');
      h += explainBlock('الارتباط والمخاطرة', 'الارتباط من الشموع اليومية · تذبذب المحفظة ' + pct(risk.portfolio_volatility_pct)
        + ' · نصيب أكبر ٣: ' + pct(risk.top3_concentration_pct) + ' · مساهمة الخطر الأعلى: '
        + ((risk.margin_risk_contribution || [])[0] ? (risk.margin_risk_contribution[0].code + ' ' + pct(risk.margin_risk_contribution[0].risk_contribution_pct)) : '—'));
      h += explainBlock('السيولة النقدية', num(d.cash_pct, 2) + '٪ نقد · والسبب: ' + (d.n_positions < d.target_positions ? 'مفيش أسهم مؤهلة أكتر.' : 'الأوراق كلها مؤهلة — بس الكاش بيحمي من تعبئة المراكز.'));
      h += explainBlock('سياسة إعادة التوازن', 'مراجعة دورية + إعادة توازن لو الوزن خرج عن شريط ' + pct((d.limits || {}).min_weight ? 4 : 4) + ' — وبلا تغيير يومي.');
      h += explainBlock('جني الأرباح وإبطال الفرضية', 'جني جزئي عند ٢٥٪ · إنهاء المركز عند وقف الخسارة أو إبطال الفرضية · وحد أدنى لمدة الاحتفاظ قبل أي تغيير.');
      h += explainBlock('متى بنستبدل سهم', 'تحسّن لازم يتعدّى حد الأهمية + مفيش استبدال ثم رجوع فوري + حد للتداول في الربع.');
      h += explainBlock('مصادر البيانات', 'أسعار ومؤشرات السوق (محدّث) · قوائم مالية منشورة (تاريخي) · حساب داخل OCTA (محسوب). كل رقم معاه تاريخه.');
      h += explainBlock('إصدار النموذج', (d.model_version || '—'));
      h += explainBlock('حدود التحليل', 'محاكاة مش ضمان · ما فيش أوامر حقيقية · الأرقام الافتراضية تتأثر بتغيّر الأسعار · المؤشر مقارنة سعرية.');
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function explainBlock(title, body) {
    return '<div class="alpha-explain-sec"><b>' + esc(title) + '</b><p>' + esc(body) + '</p></div>';
  }

  /* ─────────── الأفعال ─────────── */
  window.__alphaReload = function () { S.error = ''; load(); };
  window.__alphaView = function (v) { S.view = v || 'cards'; render(); };
  window.__alphaToggle = function (code) {
    var was = !!S.open[code];
    S.open[code] = !was;
    render();
    if (!was) {
      try {
        var el = document.querySelector('.alpha-card[data-code="' + code + '"]');
        if (el && el.scrollIntoView) {
          var r = el.getBoundingClientRect();
          if (r.top < 8 || r.top > (window.innerHeight * 0.55)) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } catch (e) { }
    }
  };
  window.__alphaToggleCrit = function () { S.critOpen = !S.critOpen; render(); };
  window.__alphaToggleNotif = function () { S.notifOpen = !S.notifOpen; render(); };
  /* ⭐ الضغط على مربع في الخريطة ⇒ يفتح تفاصيل السهم تحته */
  window.__alphaMapPick = function (code) {
    S.mapSel = code || null;
    render();
    if (code) {
      try {
        var el = document.querySelector('.alpha-mdetail');
        if (el && el.scrollIntoView) {
          var r = el.getBoundingClientRect();
          if (r.top < 8 || r.top > (window.innerHeight * 0.6)) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } catch (e) { }
    }
  };
  /* ⭐ تحويل لعرض الكروت وفتح كارت السهم */
  window.__alphaGoCard = function (code) {
    S.view = 'cards';
    S.open[code] = true;
    render();
    try {
      var el = document.querySelector('.alpha-card[data-code="' + code + '"]');
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (e) { }
  };
  window.__alphaToggleLab = function () { S.labOpen = !S.labOpen; render(); };
  window.__alphaTogglePerf = function () { S.perfOpen = !S.perfOpen; render(); };
  window.__alphaToggleDec = function () { S.decOpen = !S.decOpen; render(); };

  window.renderAlphaArm = function (box) {
    if (box) box.innerHTML = '<div class="alpha-wrap"><div class="opps-loading">⏳ بنحسب المحفظة…</div></div>';
    if (typeof octaHasToken === 'function' && !octaHasToken()) {
      if (box) box.innerHTML = '<div class="alpha-wrap"><div class="opps-loading">سجّل دخولك عشان تشوف محفظتك</div></div>';
      return;
    }
    load();
  };

  if (typeof window !== 'undefined') window.__alphaState = S;
})();
