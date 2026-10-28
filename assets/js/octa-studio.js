/* ══════════════════════════════════════════════════════════════
   🎨 الاستوديو — ارسم مستوياته على أي سهم (٢٨ أكتوبر ٢٠٢٦)
   ──────────────────────────────────────────────────────────────
   📌 المستخدم يختار سهم ⇒ يشوف الشارت ⇒ يحفظ مستويات (منطقة/خط)
      مع ملاحظة ⇒ ترجع له في أي وقت. وممكن يشاركها علناً.
   ⛔ مافيش تخمين: الرسمة بتتخزن زي ما المستخدم كتبها بالظبط.
   ⛔ مافيش توصية شراء/بيع — أداة لتنظيم ملاحظاتك.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var S = {
    code: '',
    rows: [],
    mine: [],
    public: [],
    tab: 'mine',
    chartLib: null
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function apiGet(path) {
    var call = (typeof octaFetch === 'function') ? octaFetch(apiUrl(path)) : fetch(apiUrl(path));
    return call.then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }

  function apiPost(path, body) {
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    };
    var call = (typeof octaFetch === 'function') ? octaFetch(apiUrl(path), opts) : fetch(apiUrl(path), opts);
    return call.then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }

  function setStatus(txt, kind) {
    var el = $('stStatus');
    if (!el) return;
    el.innerHTML = '<span class="su-dot ' + (kind || '') + '"></span> ' + esc(txt);
  }

  function names() {
    try {
      if (window.OCTA_EGX_NAMES && window.OCTA_EGX_NAMES.names) return window.OCTA_EGX_NAMES.names;
      if (window.OCTA_RADAR_REF) {
        var out = {};
        for (var k in window.OCTA_RADAR_REF) {
          if (window.OCTA_RADAR_REF[k] && window.OCTA_RADAR_REF[k].n) out[k] = window.OCTA_RADAR_REF[k].n;
        }
        return out;
      }
    } catch (e) { }
    return {};
  }

  function nameOf(code) {
    var n = names();
    return n[code] || code;
  }

  /* ══════════ تحميل ══════════ */
  function loadCode(code) {
    if (!code) return;
    S.code = String(code).toUpperCase().trim();
    setStatus('بنجيب الشموع…', 'busy');
    var st = $('stTitle');
    if (st) st.textContent = S.code + ' · ' + nameOf(S.code);
    apiGet('/api/radar/history?list=' + encodeURIComponent(S.code) + '&n=240')
      .then(function (j) {
        /* ⛔ الباك بيرجّع الأعمدة (t/o/h/l/c/v) ⇒ التحويل في مكان واحد
           (octa-chartkit.rowsFromHistory) — كان هنا بيحاول j.candles ⇒ فاضي. */
        var rows = (window.OCTAChartKit && window.OCTAChartKit.rowsFromHistory)
          ? window.OCTAChartKit.rowsFromHistory(j, S.code)
          : [];
        S.rows = rows;
        if (!rows.length) {
          var box0 = $('stChart');
          if (box0) box0.innerHTML = '<div class="su-empty">مفيش شموع لهذا السهم</div>';
          setStatus('مفيش شموع', 'err');
          return;
        }
        draw();
        loadMine();
        setStatus('جاهز · ' + rows.length + ' شمعة', 'live');
      })
      .catch(function (e) {
        setStatus('تعذّر جلب الشموع', 'err');
      });
  }

  function draw() {
    var box = $('stChart');
    if (!box) return;
    var lines = S.mine.map(function (d) {
      return {
        price: d.price,
        color: d.visibility === 'public' ? '#22c55e' : '#d4af37',
        title: (d.kind === 'zone' ? 'منطقة ' : '') + fmtPrice(d.price)
      };
    });
    if (window.OCTAChartKit) {
      window.OCTAChartKit.mount(box, S.rows, { lines: lines, volume: true })
        .catch(function () {
          box.innerHTML = '<div class="su-empty">مكتبة الرسم مش متاحة</div>';
        });
    } else {
      box.innerHTML = '<div class="su-empty">مكتبة الرسم مش متاحة</div>';
    }
  }

  function loadMine() {
    apiGet('/api/studio/list?scope=mine&code=' + encodeURIComponent(S.code))
      .then(function (j) {
        S.mine = j.items || [];
        renderList();
        draw();
      })
      .catch(function (e) {
        if (e && e.status === 403) { lockPanel(); return; }
        renderList();
      });
  }

  function loadPublic() {
    apiGet('/api/studio/list?scope=public')
      .then(function (j) {
        S.public = j.items || [];
        renderList();
      })
      .catch(function (e) {
        if (e && e.status === 403) { lockPanel(); return; }
        S.public = []; renderList();
      });
  }

  /* ══════════ العرض ══════════ */
  function renderList() {
    var box = $('stList');
    if (!box) return;
    var items = (S.tab === 'public') ? S.public : S.mine;
    if (!items.length) {
      box.innerHTML = '<div class="su-empty">' +
        (S.tab === 'public' ? 'مفيش رسومات مشتركة لسه.' : 'مفيش رسومات لسه — ارسم أول مستوى فوق.') +
        '</div>';
      return;
    }
    var html = items.map(function (d) {
      var nm = nameOf(d.code);
      return '<div class="st-item" data-code="' + esc(d.code) + '">' +
        '<div class="st-ih"><b>' + esc(d.code) + '</b> <span>' + esc(nm) + '</span>' +
        (d.visibility === 'public' ? '<i class="st-pub">مشترك</i>' : '') +
        (S.tab === 'mine' ? '<button class="st-del" data-id="' + esc(d.id) + '" title="احذف">✕</button>' : '') +
        '</div>' +
        '<div class="st-ip">' + (d.kind === 'zone' ? 'منطقة ' : 'مستوى ') + fmtPrice(d.price) +
        (d.price2 ? ' — ' + fmtPrice(d.price2) : '') + '</div>' +
        (d.note ? '<div class="st-in">' + esc(d.note) + '</div>' : '') +
        '<div class="st-id">' + esc(d.created_at || '') + '</div>' +
        '</div>';
    }).join('');
    box.innerHTML = html;

    var dels = box.querySelectorAll('.st-del');
    for (var i = 0; i < dels.length; i++) {
      (function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = b.getAttribute('data-id');
          apiPost('/api/studio/delete', { id: id })
            .then(function () { loadMine(); })
            .catch(function () { });
        });
      })(dels[i]);
    }
    var its = box.querySelectorAll('.st-item');
    for (var j = 0; j < its.length; j++) {
      (function (it) {
        it.addEventListener('click', function () {
          loadCode(it.getAttribute('data-code'));
        });
      })(its[j]);
    }
  }

  /* ══════════ الحفظ ══════════ */
  function save() {
    if (!S.code) { setStatus('اختار سهم الأول', 'err'); return; }
    var price = parseFloat(($('stPrice') || {}).value);
    if (!isFinite(price) || price <= 0) { setStatus('اكتب سعر صحيح', 'err'); return; }
    var body = {
      code: S.code,
      name: nameOf(S.code),
      price: price,
      kind: ($('stKind') || {}).value || 'level',
      note: ($('stNote') || {}).value || '',
      visibility: ($('stPub') || {}).checked ? 'public' : 'private'
    };
    apiPost('/api/studio/save', body)
      .then(function () {
        var pn = $('stNote'); if (pn) pn.value = '';
        setStatus('اتحفظت ✓', 'live');
        loadMine();
      })
      .catch(function (e) {
        setStatus((e && e.message) ? e.message : 'مش قادر أحفظ', 'err');
      });
  }

  /* ══════════ الربط ══════════ */
  function bind() {
    var q = $('stSearch');
    if (q) {
      q.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var v = String(q.value || '').trim().toUpperCase();
        if (!v) return;
        /* ⛔ لو الاسم عربي ⇒ نحوّله للرمز */
        var n = names();
        for (var k in n) {
          if (String(n[k]).indexOf(String(q.value).trim()) >= 0) { v = k; break; }
        }
        loadCode(v);
      });
    }
    var b = $('stSave');
    if (b) b.addEventListener('click', save);
    var t1 = $('stTabMine'), t2 = $('stTabPublic');
    if (t1) t1.addEventListener('click', function () {
      S.tab = 'mine'; toggleTabs(); renderList();
    });
    if (t2) t2.addEventListener('click', function () {
      S.tab = 'public'; toggleTabs(); loadPublic();
    });
    var cl = $('stClear');
    if (cl) cl.addEventListener('click', function () {
      var box = $('stChart');
      if (box) box.innerHTML = '<div class="su-empty">اختار سهم من فوق</div>';
      S.code = ''; S.rows = []; S.mine = [];
      var t = $('stTitle'); if (t) t.textContent = 'اختار سهم';
      renderList();
    });
  }

  function toggleTabs() {
    var a = $('stTabMine'), b = $('stTabPublic');
    if (a) a.classList.toggle('on', S.tab === 'mine');
    if (b) b.classList.toggle('on', S.tab === 'public');
  }

  /* 🔒 الباقة مقفولة (403) ⇒ لوحة «مدفوعة» بدل الاستوديو */
  function lockPanel(msg) {
    var body = $('stList');
    if (body) {
      body.innerHTML = '<div class="su-lock">' +
        '<h3>🎨 الاستوديو — جزء من باقة «نماذجي»</h3>' +
        '<p>' + esc(msg || 'الاستوديو مدفوع (٣٥٠ جنيه/شهر) — جزء من باقة «نماذجي».') + '</p>' +
        '<p>الباقة غير مفعّلة على حسابك. كلّم الدعم وهي تتفعّل في ثواني.</p>' +
        '</div>';
    }
    var tools = $('stTools');
    if (tools) tools.style.display = 'none';
  }

  function init() {
    if (!$('stList')) return;
    bind();
    toggleTabs();
    loadPublic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.OCTAStudio = {
    loadCode: loadCode,
    state: S,
    _test: { renderList: renderList, nameOf: nameOf, fmtPrice: fmtPrice }
  };
})();
