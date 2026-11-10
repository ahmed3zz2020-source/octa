/* ═══════════════════════════════════════════════════════════════
   🎯 OPP-001 — فلتر الفرص (الذراع الثامنة)
   ٩ تابات استراتيجيات · كارت سهم · كارت «كيف اختار OCTA»
   📌 العرض فقط — كل الحساب في الباك (محرّك الفرص).
   ⛔ ممنوع أي اسم أداة ذكاء اصطناعي في النصوص الظاهرة.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API = (typeof OCTA_API !== 'undefined') ? OCTA_API : '';
  var TAB_KEY = 'octa_opps_tab_v1';
  var DEFAULT_SHOWN = 3;
  var MAX_SHOWN = 10;

  var S = {
    key: 'swing',
    strategies: [],
    data: null,
    loading: false,
    error: '',
    sort: 'score',
    q: '',
    sector: '',
    risk: '',
    shown: DEFAULT_SHOWN,
    open: {},
    lastKey: ''
  };

  /* ─────────── أدوات ─────────── */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v, d) {
    if (v === null || v === undefined || isNaN(v)) return (d === undefined ? '—' : d);
    return Number(v).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
  }
  function pct(v) { return (v === null || v === undefined || isNaN(v)) ? '—' : num(v) + '٪'; }
  function has(obj, k) { return obj && obj[k] !== null && obj[k] !== undefined && obj[k] !== ''; }

  function copyFor(key) {
    var C = (typeof window !== 'undefined' && window.OPS_COPY) ? window.OPS_COPY : null;
    return (C && C[key]) ? C[key] : {};
  }

  function fetchJSON(url) {
    var p = (typeof octaFetch === 'function') ? octaFetch(url) : fetch(url);
    return p.then(function (r) {
      var st = (r && r.status) ? r.status : 0;
      if (st === 401 || st === 403) {
        throw new Error('انتهت الجلسة — سجّل دخولك تاني');
      }
      if (st >= 400) {
        throw new Error('الخادم رجّع خطأ ' + st + ' — أعد المحاولة بعد قليل');
      }
      return r.json().catch(function () {
        throw new Error('رد غير مفهوم من الخادم — أعد المحاولة بعد قليل');
      });
    });
  }

  function strategyByKey(key) {
    for (var i = 0; i < S.strategies.length; i++) {
      if (S.strategies[i].key === key) return S.strategies[i];
    }
    return null;
  }

  /* ─────────── الفرز ─────────── */
  function sortedItems(items) {
    var arr = (items || []).slice();
    var by = S.sort;
    arr.sort(function (a, b) {
      if (by === 'liquidity') {
        return (b.data_completeness && b.data_completeness.liquidity || 0)
          - (a.data_completeness && a.data_completeness.liquidity || 0);
      }
      if (by === 'risk') {
        return (a.risk_score === null ? 999 : a.risk_score)
          - (b.risk_score === null ? 999 : b.risk_score);
      }
      if (by === 'change') {
        return (b.change === null ? -999 : b.change) - (a.change === null ? -999 : a.change);
      }
      return (b.score || 0) - (a.score || 0);
    });
    return arr;
  }

  function filteredItems() {
    var items = sortedItems(S.data && S.data.items);
    var q = S.q.trim();
    if (q) {
      var lq = q.toLowerCase();
      items = items.filter(function (it) {
        return (it.code || '').toLowerCase().indexOf(lq) >= 0
          || (it.name || '').indexOf(q) >= 0;
      });
    }
    if (S.sector) items = items.filter(function (it) { return it.sector === S.sector; });
    if (S.risk) items = items.filter(function (it) { return (it.risk_level_ar || '') === S.risk; });
    return items;
  }

  /* ─────────── كارت السهم ─────────── */
  function badge(cls, text) {
    if (!text) return '';
    return '<span class="opps-badge opps-badge--' + cls + '">' + esc(text) + '</span>';
  }

  function scoreClass(score) {
    if (score === null || score === undefined) return 'na';
    if (score >= 75) return 'hi';
    if (score >= 60) return 'mid';
    return 'lo';
  }

  function cardHTML(it, idx) {
    var open = !!S.open[it.code];
    var reasons = (it.reasons || []).slice(0, 3);
    var missing = it.missing || [];
    var h = '';
    h += '<div class="opps-card' + (open ? ' open' : '') + '" data-code="' + esc(it.code) + '">';
    h += '<div class="opps-card-hd">';
    h += '<div class="opps-card-code"><b>' + esc(it.code) + '</b>'
      + '<span class="opps-card-name">' + esc(it.name || '') + '</span>'
      + (it.sector ? '<span class="opps-card-sector">' + esc(it.sector) + '</span>' : '')
      + '</div>';
    h += '<div class="opps-score opps-score--' + scoreClass(it.score) + '">'
      + '<span class="opps-score-v">' + num(it.score) + '</span>'
      + '<span class="opps-score-l">مطابقة</span></div>';
    h += '</div>';

    h += '<div class="opps-badge-row">';
    h += badge('state', it.state ? stateAr(it.state) : '');
    h += badge('risk', it.risk_level_ar || '');
    h += badge('horizon', it.hold_days ? ('المدى: ' + it.hold_days) : '');
    h += badge('data', it.coverage !== undefined && it.coverage !== null
      ? ('بيانات ' + num(it.coverage) + '٪') : '');
    if (missing.length) h += badge('flag', 'ناقص: ' + missing.length);
    h += '</div>';

    if (reasons.length) {
      h += '<ul class="opps-reasons">';
      reasons.forEach(function (r) { h += '<li class="opps-reason">' + esc(r) + '</li>'; });
      h += '</ul>';
    }

    h += '<div class="opps-card-foot">';
    h += '<span class="opps-price">' + num(it.price) + ' ج.م</span>';
    if (it.change !== null && it.change !== undefined) {
      h += '<span class="opps-chg ' + (it.change >= 0 ? 'up' : 'down') + '">'
        + (it.change >= 0 ? '+' : '') + num(it.change) + '٪</span>';
    }
    h += '<button class="opps-toggle" onclick="window.__oppsToggle(\'' + esc(it.code) + '\')">'
      + (open ? 'إخفاء التحليل' : 'عرض التحليل') + ' ▾</button>';
    h += '</div>';

    if (open) h += '<div class="opps-detail">' + detailHTML(it) + '</div>';
    h += '</div>';
    return h;
  }

  function stateAr(s) {
    var M = {
      watch: 'مراقبة', ready: 'جاهزة بشروط', active: 'مفعلة',
      finished: 'انتهت', cancelled: 'ألغيت'
    };
    return M[s] || s;
  }

  function detailHTML(it) {
    var h = '';
    var plan = it.plan || {};
    var risks = it.risks || [];
    var crit = it.criteria || [];
    var refs = it.refs || [];
    /* لقطة البيانات: كل قيمة ومعاها مصدرها وتاريخها */
    var snap = it.snapshot || it;
    function sv(k) {
      var v = snap[k];
      if (v === null || v === undefined) return null;
      if (typeof v === 'object' && v !== null && 'value' in v) return v.value;
      return v;
    }
    function sref(k) {
      var v = snap[k];
      if (v && typeof v === 'object' && v.source) {
        return { source: v.source, as_of: v.as_of || '', status: '' };
      }
      return null;
    }

    /* أ — لماذا اخترنا السهم */
    h += sec('لماذا ترشّح هذا السهم؟', (it.reasons || []).map(function (r) {
      return '<li>' + esc(r) + '</li>';
    }).join(''));

    /* ب — التحليل الفني */
    var tech = [];
    if (sv('rsi') !== null) tech.push(kv('القوة النسبية (RSI)', num(sv('rsi'))));
    if (sv('atr') !== null) tech.push(kv('مدى التذبذب اليومي (ATR)', num(sv('atr'))));
    if (sv('ema20') !== null) tech.push(kv('المتوسط المتحرك ٢٠ يوم', num(sv('ema20'))));
    if (sv('ema50') !== null) tech.push(kv('المتوسط المتحرك ٥٠ يوم', num(sv('ema50'))));
    if (sv('ema200') !== null) tech.push(kv('المتوسط المتحرك ٢٠٠ يوم', num(sv('ema200'))));
    if (sv('pivot_s1') !== null) tech.push(kv('أقرب دعم', num(sv('pivot_s1'))));
    if (sv('pivot_r1') !== null) tech.push(kv('أقرب مقاومة', num(sv('pivot_r1'))));
    if (sv('bb_upper') !== null) tech.push(kv('حد بولنجر العلوي', num(sv('bb_upper'))));
    if (sv('bb_lower') !== null) tech.push(kv('حد بولنجر السفلي', num(sv('bb_lower'))));
    if (sv('rel_volume') !== null) tech.push(kv('الحجم النسبي', num(sv('rel_volume')) + '×'));
    if (sv('volatility') !== null) tech.push(kv('التقلب اليومي', pct(sv('volatility'))));
    if (sv('beta') !== null) tech.push(kv('معامل المخاطرة (Beta)', num(sv('beta'))));
    if (sv('mdd_90') !== null) tech.push(kv('أقصى تراجع في الفترة', pct(sv('mdd_90'))));
    if (tech.length) h += sec('التحليل الفني', grid(tech));

    /* ج — التحليل الأساسي */
    var fund = [];
    if (sv('pe') !== null) fund.push(kv('مضاعف الربحية (P/E)', num(sv('pe'))));
    if (sv('pb') !== null) fund.push(kv('مضاعف القيمة الدفترية (P/B)', num(sv('pb'))));
    if (sv('roe') !== null) fund.push(kv('العائد على حقوق الملكية', pct(sv('roe'))));
    if (sv('roic') !== null) fund.push(kv('العائد على رأس المال المستثمر', pct(sv('roic'))));
    if (sv('net_margin') !== null) fund.push(kv('هامش الربح الصافي', pct(sv('net_margin'))));
    if (sv('op_margin') !== null) fund.push(kv('هامش التشغيل', pct(sv('op_margin'))));
    if (sv('de_ratio') !== null) fund.push(kv('نسبة الدين للملكية', num(sv('de_ratio'))));
    if (sv('revenue_yoy') !== null) fund.push(kv('نمو الإيرادات', pct(sv('revenue_yoy'))));
    if (sv('eps_yoy') !== null) fund.push(kv('نمو ربحية السهم', pct(sv('eps_yoy'))));
    if (sv('cagr3y') !== null) fund.push(kv('النمو السنوي المركّب ٣ سنوات', pct(sv('cagr3y'))));
    if (sv('fcf_margin') !== null) fund.push(kv('هامش التدفق النقدي الحر', pct(sv('fcf_margin'))));
    if (sv('ev_ebitda') !== null) fund.push(kv('مضاعف المنشأة للأرباح التشغيلية', num(sv('ev_ebitda'))));
    if (sv('div_yield') !== null) fund.push(kv('عائد التوزيع', pct(sv('div_yield'))));
    if (sv('upside') !== null) fund.push(kv('المساحة للقيمة المقدَّرة', pct(sv('upside'))));
    if (sv('valuation')) fund.push(kv('حالة التقييم', sv('valuation')));
    if (fund.length) h += sec('التحليل الأساسي', grid(fund));

    /* د — خطة التعامل */
    if (plan && Object.keys(plan).length) {
      var cells = [];
      if (has(plan, 'entry_zone')) {
        cells.push(kv('منطقة الدخول', num(plan.entry_zone[0]) + ' – ' + num(plan.entry_zone[1])));
      }
      if (has(plan, 'entry_label')) cells.push(kv('قاعدة الدخول', plan.entry_label));
      if (has(plan, 'stop')) cells.push(kv('وقف الخسارة', num(plan.stop)));
      if (has(plan, 'target1')) cells.push(kv('هدف قريب', num(plan.target1)));
      if (has(plan, 'target2')) cells.push(kv('هدف بعيد', num(plan.target2)));
      if (has(plan, 'rr1')) cells.push(kv('العائد/المخاطرة للهدف القريب', num(plan.rr1) + ':١'));
      if (has(plan, 'rr2')) cells.push(kv('العائد/المخاطرة للهدف البعيد', num(plan.rr2) + ':١'));
      if (has(plan, 'horizon')) cells.push(kv('المدة المستهدفة', plan.horizon));
      if (has(plan, 'target_note')) cells.push(kv('ملاحظة الهدف', plan.target_note));
      if (has(plan, 'invalidation')) {
        cells.push(kv('إبطال الفرضية', (plan.invalidation || []).join(' · ')));
      }
      if (has(plan, 'risk_limit')) cells.push(kv('حد المخاطرة', plan.risk_limit));
      h += sec('خطة التعامل', grid(cells));
    }

    /* هـ — المخاطر */
    if (risks.length) {
      h += sec('أهم المخاطر', '<ul class="opps-list-plain">'
        + risks.slice(0, 3).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('')
        + '</ul>');
    }

    /* و — تفسير الدرجة */
    if (crit.length) {
      var rows = crit.map(function (c) {
        var w = c.weight || c.points_max || 0;
        var ratio = (c.ratio === null || c.ratio === undefined) ? null : c.ratio;
        var pctFill = ratio === null ? 0 : Math.round(ratio * 100);
        var h2 = '<div class="opps-crit' + (ratio === null ? ' is-missing' : '') + '">';
        h2 += '<div class="opps-crit-k">' + esc(c.label_ar || c.key) + '</div>';
        h2 += '<div class="opps-crit-bar"><i style="width:' + pctFill + '%"></i></div>';
        if (ratio === null) {
          h2 += '<div class="opps-crit-v opps-crit-empty">غير متاح</div>';
        } else {
          h2 += '<div class="opps-crit-v">' + num(c.points) + ' من ' + num(c.points_max)
            + ' <span class="opps-crit-w">(' + num(w) + '٪)</span></div>';
        }
        if (c.note_ar) h2 += '<div class="opps-crit-note">' + esc(c.note_ar) + '</div>';
        h2 += '</div>';
        return h2;
      }).join('');
      h += sec('تفسير الدرجة', rows);
    }

    /* ز — البيانات والمراجع */
    if (refs.length) {
      var src = refs.map(function (r) {
        return '<div class="opps-src-item"><b>' + esc(r.source || '—') + '</b>'
          + '<span>' + esc(r.as_of || '—') + '</span>'
          + (r.status ? '<span class="opps-src-st">' + esc(r.status) + '</span>' : '')
          + '</div>';
      }).join('');
      h += sec('البيانات والمراجع', src);
    }

    /* البيانات الناقصة */
    var miss = it.missing || [];
    if (miss.length) {
      h += sec('معايير بدون بيانات كافية',
        '<p class="opps-missing-note">الدرجة محسوبة من ' + num(it.available_weight)
        + '٪ من المعايير فقط — والباقي مستبعد ومعلن — مش متخيَّل.</p>');
    }
    return h;
  }

  function sec(title, body) {
    if (!body) return '';
    return '<div class="opps-detail-sec"><div class="opps-detail-h">' + esc(title) + '</div>'
      + '<div class="opps-detail-b">' + body + '</div></div>';
  }
  function kv(k, v) {
    return '<div class="opps-plan-cell"><div class="opps-plan-k">' + esc(k)
      + '</div><div class="opps-plan-v">' + esc(v) + '</div></div>';
  }
  function grid(cells) {
    return '<div class="opps-plan-grid">' + cells.join('') + '</div>';
  }

  /* ─────────── كارت المعايير ─────────── */
  function criteriaCardHTML(st) {
    var cp = copyFor(st.key);
    var c = (window.OPS_COPY || {});
    var limits = cp.limits_ar || [];
    var h = '';
    h += '<div class="opps-critcard' + (S.open['__crit'] ? ' open' : '') + '" id="oppsCritCard">';
    h += '<button class="opps-critcard-hd" onclick="window.__oppsToggleCrit()" '
      + 'aria-expanded="' + (S.open['__crit'] ? 'true' : 'false') + '" '
      + 'aria-controls="oppsCritBody">';
    h += '<span class="opps-critcard-ico">📘</span>';
    h += '<span class="opps-critcard-t">كيف اختار OCTA فرص «' + esc(st.name_ar) + '»؟</span>';
    h += '<span class="opps-critcard-arrow">▾</span>';
    h += '</button>';
    h += '<div class="opps-critcard-bd" id="oppsCritBody">';

    h += '<div class="opps-critcard-sec"><b>تعريف الاستراتيجية</b><p>' + esc(st.definition_ar || '') + '</p></div>';
    h += '<div class="opps-critcard-sec"><b>مدة الاستثمار المناسبة</b><p>' + esc(st.horizon_ar || '') + '</p></div>';
    h += '<div class="opps-critcard-sec"><b>نوع الأسهم التي يبحث عنها OCTA</b><p>' + esc(st.looks_for_ar || '') + '</p></div>';

    h += '<div class="opps-critcard-sec"><b>معايير الاختيار وأوزانها</b>';
    h += '<table class="opps-critcard-tbl"><thead><tr><th>المعيار</th><th>الوزن</th><th>الحد الأقصى</th></tr></thead><tbody>';
    (st.criteria || []).forEach(function (cr) {
      h += '<tr><td>' + esc(cr.label_ar) + '<div class="opps-critcard-hint">' + esc(cr.hint_ar || '') + '</div></td>'
        + '<td>' + num(cr.weight) + '٪</td><td>' + num(cr.points_max) + '</td></tr>';
    });
    h += '</tbody></table></div>';

    h += '<div class="opps-critcard-sec"><b>كيفية حساب الدرجة النهائية</b>'
      + '<p>كل معيار بيتقيّم من صفر لحد أقصى نقاطه، والدرجة النهائية = مجموع نقاط المعايير '
      + 'المتاحة ÷ مجموع أوزانها المتاحة × ١٠٠. المعيار اللي مدخلاته ناقصة '
      + '<b>بينستبعد ويتعلن</b> — مش بيتحسب نص درجة.</p></div>';

    h += '<div class="opps-critcard-sec"><b>شروط قبول الأسهم</b><ul class="opps-list-plain">'
      + (st.accept_ar || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="opps-critcard-sec"><b>أسباب استبعاد الأسهم</b><ul class="opps-list-plain">'
      + (st.reject_ar || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';

    h += '<div class="opps-critcard-sec"><b>الحد الأدنى لجودة البيانات</b>'
      + '<p>لازم تتوافر معايير بوزن لا يقل عن ' + num(st.min_coverage)
      + '٪ من إجمالي الأوزان، وإلا السهم مابيترشّحش للتاب ده.</p></div>';

    h += '<div class="opps-critcard-sec"><b>أهم مخاطر هذه الاستراتيجية</b><ul class="opps-list-plain">'
      + (st.risk_ar || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';

    h += '<div class="opps-critcard-sec"><b>مصادر البيانات وتواريخ التحديث</b>'
      + '<div class="opps-src">' + (S.data && S.data.summary && S.data.summary.sources
        ? S.data.summary.sources.map(function (x) {
          return '<div class="opps-src-item"><b>' + esc(x.source || '') + '</b><span>'
            + esc(x.as_of || '') + '</span></div>';
        }).join('') : '') + '</div></div>';

    h += '<div class="opps-critcard-sec"><b>رقم إصدار نموذج التقييم</b>'
      + '<p>OPP-' + esc((S.data && S.data.model_version) || '—') + '</p></div>';

    h += '<div class="opps-critcard-sec opps-limits"><b>حدود التحليل</b><ul class="opps-list-plain">'
      + limits.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';

    h += '</div></div>';
    return h;
  }

  /* ─────────── شريط الملخص ─────────── */
  function summaryHTML(sum) {
    sum = sum || {};
    var h = '<div class="opps-summary">';
    h += sumItem('فُحص', num(sum.scanned));
    h += sumItem('مؤهَّل', num(sum.eligible !== undefined ? sum.eligible : sum.total_eligible));
    h += sumItem('معروض', num(sum.shown));
    h += sumItem('آخر تحديث', sum.last_update ? fmtTime(sum.last_update) : '—');
    h += sumItem('نطاق البيانات', sum.data_from ? ('من ' + sum.data_from) : '—');
    h += '</div>';
    return h;
  }
  function sumItem(k, v) {
    return '<div class="opps-sum-item"><span class="opps-sum-k">' + esc(k)
      + '</span><span class="opps-sum-v">' + esc(v) + '</span></div>';
  }
  function fmtTime(ts) {
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts).slice(0, 16).replace('T', ' ');
      return d.toISOString().slice(0, 16).replace('T', ' ');
    } catch (e) { return '—'; }
  }

  /* ─────────── التبويبات ─────────── */
  function tabsHTML() {
    var h = '<div class="opps-tabs" role="tablist">';
    var lastGroup = '';
    S.strategies.forEach(function (st) {
      if (lastGroup && st.group !== lastGroup) h += '<span class="opps-tabs-sep"></span>';
      lastGroup = st.group;
      h += '<button class="opps-tab' + (st.key === S.key ? ' on' : '') + '" role="tab" '
        + 'aria-selected="' + (st.key === S.key ? 'true' : 'false') + '" '
        + 'onclick="window.__oppsTab(\'' + st.key + '\')">'
        + '<span class="opps-tab-i">' + (st.icon || '') + '</span>'
        + '<span class="opps-tab-n">' + esc(st.name_ar) + '</span></button>';
    });
    h += '</div>';
    return h;
  }

  /* ─────────── شريط الأدوات ─────────── */
  function toolbarHTML() {
    var sectors = {};
    ((S.data && S.data.items) || []).forEach(function (it) {
      if (it.sector) sectors[it.sector] = 1;
    });
    var risks = {};
    ((S.data && S.data.items) || []).forEach(function (it) {
      if (it.risk_level_ar) risks[it.risk_level_ar] = 1;
    });
    var h = '<div class="opps-toolbar">';
    h += '<input class="opps-search" id="oppsSearch" type="search" placeholder="ابحث بالاسم أو الرمز" '
      + 'value="' + esc(S.q) + '" oninput="window.__oppsSearch(this.value)">';
    h += '<select class="opps-sort" onchange="window.__oppsSort(this.value)">';
    [['score', 'حسب الدرجة'], ['liquidity', 'حسب السيولة'], ['risk', 'حسب المخاطرة'], ['change', 'حسب التغير']]
      .forEach(function (o) {
        h += '<option value="' + o[0] + '"' + (S.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      });
    h += '</select>';
    h += '</div>';

    h += '<div class="opps-filters">';
    h += '<button class="opps-chip' + (S.sector ? '' : ' on') + '" onclick="window.__oppsSector(\'\')">كل القطاعات</button>';
    Object.keys(sectors).forEach(function (secName) {
      h += '<button class="opps-chip' + (S.sector === secName ? ' on' : '') + '" onclick="window.__oppsSector(\''
        + esc(secName) + '\')">' + esc(secName) + '</button>';
    });
    h += '<span class="opps-filters-sep"></span>';
    h += '<button class="opps-chip' + (S.risk ? '' : ' on') + '" onclick="window.__oppsRisk(\'\')">كل المستويات</button>';
    Object.keys(risks).forEach(function (r) {
      h += '<button class="opps-chip' + (S.risk === r ? ' on' : '') + '" onclick="window.__oppsRisk(\''
        + esc(r) + '\')">' + esc(r) + '</button>';
    });
    h += '</div>';
    return h;
  }

  /* ─────────── الرسم ─────────── */
  function errorHTML() {
    return '<div class="opps-error"><b>مش قادرين نجيب الفرص دلوقتي</b><p>' + esc(S.error || 'خطأ غير متوقع') + '</p>'
      + '<button class="opps-btn" onclick="window.__oppsReload()">إعادة المحاولة</button></div>';
  }

  function render(box) {
    if (!box) return;
    var h = '<div class="opps-wrap">';
    h += '<div class="opps-hero"><span class="opps-hero-ico">🎯</span>'
      + '<div><div class="opps-hero-t">محرّك الفرص</div>'
      + '<div class="opps-hero-s">٩ استراتيجيات · كل سهم ليه سبب قابل للفحص</div></div></div>';

    /* ⛔⛔ لازم الخطأ يتشال قبل التحميل — لو حصل خطأ في تحميل
       الاستراتيجيات نفسه، «بنحمّل» كانت هتفضل شغالة للأبد
       والمستخدم مش هيعرف إن في مشكلة. */
    if (!S.strategies.length) {
      h += S.error ? errorHTML() : '<div class="opps-loading">⏳ بنحمّل الاستراتيجيات…</div>';
      box.innerHTML = h;
      return;
    }

    h += tabsHTML();

    if (S.loading) {
      h += '<div class="opps-loading">⏳ بنحسب الفرص…</div>';
      box.innerHTML = h;
      return;
    }
    if (S.error) {
      h += errorHTML();
      box.innerHTML = h;
      return;
    }
    if (!S.data) { box.innerHTML = h; return; }

    var sum = S.data.summary || {};
    if (sum.source_status && sum.source_status !== 'ok') {
      h += '<div class="opps-stale">⚠️ ' + esc(sum.note_ar || 'البيانات ممكن تكون متأخرة') + '</div>';
    }

    h += summaryHTML(sum);
    h += toolbarHTML();

    var items = filteredItems();
    var shown = Math.min(items.length, Math.min(S.shown, MAX_SHOWN));
    if (!items.length) {
      h += '<div class="opps-empty"><b>لا توجد حاليًا فرص تستوفي جميع شروط هذه الاستراتيجية</b>';
      if (S.q || S.sector || S.risk) {
        h += '<p>جرّب تشيل الفلتر أو تبحث بكلمة تانية.</p>';
      } else if (sum.note_ar) {
        h += '<p>' + esc(sum.note_ar) + '</p>';
      }
      h += '</div>';
    } else {
      h += '<div class="opps-list">';
      for (var i = 0; i < shown; i++) h += cardHTML(items[i], i);
      h += '</div>';
      if (items.length > shown) {
        h += '<button class="opps-btn opps-more" onclick="window.__oppsMore()">عرض المزيد ('
          + num(items.length - shown) + ' إضافية)</button>';
      }
    }

    var st = strategyByKey(S.key);
    if (st) h += criteriaCardHTML(st);

    h += '</div>';
    box.innerHTML = h;
  }

  /* ─────────── التحميل ─────────── */
  function loadStrategies() {
    return fetchJSON(API + '/api/opp/strategies').then(function (d) {
      if (!d || !d.ok || !d.strategies) throw new Error((d && d.error) || 'رد غير متوقع');
      S.strategies = d.strategies;
      var saved = '';
      try { saved = localStorage.getItem(TAB_KEY) || ''; } catch (e) { }
      if (saved && strategyByKey(saved)) S.key = saved;
      else if (!strategyByKey(S.key)) S.key = S.strategies[0].key;
    });
  }

  function loadList() {
    S.loading = true; S.error = '';
    render(document.getElementById('armBody') || null);
    return fetchJSON(API + '/api/opp/list/' + encodeURIComponent(S.key)).then(function (d) {
      if (!d || !d.ok) throw new Error((d && d.error) || 'خطأ في الخادم');
      S.data = d;
      S.loading = false;
      S.shown = DEFAULT_SHOWN;
      render(document.getElementById('armBody') || null);
    }).catch(function (e) {
      S.loading = false;
      S.error = (e && e.message) ? e.message : 'خطأ غير متوقع';
      render(document.getElementById('armBody') || null);
    });
  }

  /* ─────────── نقطة الدخول ─────────── */
  function renderOppsArm(box) {
    if (typeof octaHasToken === 'function' && !octaHasToken()) {
      box.innerHTML = '<div class="opps-loading">سجّل دخولك عشان تشوف الفرص</div>';
      return;
    }
    S.lastKey = S.key;
    render(box);
    loadStrategies().then(function () {
      render(box);
      return loadList();
    }).catch(function (e) {
      S.error = (e && e.message) ? e.message : 'خطأ غير متوقع';
      S.loading = false;
      render(box);
    });
  }

  /* ─────────── أزرار عامة ─────────── */
  window.__oppsTab = function (key) {
    if (S.key === key) return;
    S.key = key;
    S.open = {};
    try { localStorage.setItem(TAB_KEY, key); } catch (e) { }
    render(document.getElementById('armBody') || null);
    loadList();
  };
  window.__oppsToggle = function (code) {
    S.open[code] = !S.open[code];
    render(document.getElementById('armBody') || null);
  };
  window.__oppsToggleCrit = function () {
    S.open['__crit'] = !S.open['__crit'];
    render(document.getElementById('armBody') || null);
  };
  window.__oppsMore = function () {
    S.shown = Math.min(MAX_SHOWN, S.shown + 3);
    render(document.getElementById('armBody') || null);
  };
  window.__oppsSearch = function (v) {
    S.q = v || '';
    render(document.getElementById('armBody') || null);
    var el = document.getElementById('oppsSearch');
    if (el && document.activeElement !== el) { try { el.focus(); } catch (e) { } }
  };
  window.__oppsSort = function (v) { S.sort = v || 'score'; render(document.getElementById('armBody') || null); };
  window.__oppsSector = function (v) { S.sector = v || ''; render(document.getElementById('armBody') || null); };
  window.__oppsRisk = function (v) { S.risk = v || ''; render(document.getElementById('armBody') || null); };
  window.__oppsReload = function () {
    S.error = ''; S.loading = false;
    var box = document.getElementById('armBody');
    /* لو الاستراتيجيات نفسها لم تُحمَّل ⇒ إعادة تحميل كاملة */
    if (!S.strategies.length) { renderOppsArm(box); return; }
    loadList();
  };

  window.renderOppsArm = renderOppsArm;
})();
