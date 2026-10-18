/* ══════════════════════════════════════════════════════════════
   🐙 OCTA — نقطة الدخول للشارت (Phase 1 · T3)
   ──────────────────────────────────────────────────────────────
   📌 العقد:
      window.OCTAChart        → namespace (data · ind · core · draw · gest · storage)
      window.openOCTAChart(code, name) → يفتح الشارت
   ──────────────────────────────────────────────────────────────
   📌 مفيش CDN · كل الـJS محلي.
   📌 مافيش سعر مخترع — كل الأرقام من /api/candles.
   ⚠️ ما بيغلّطش ولا بيعدّلش الشارت القديم (octa-chart.js).
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';

  var api = factory(root);

  /* 🌐 المتصفح */
  root.OCTAChart = root.OCTAChart || {};
  root.OCTAChart.pro = api;
  if (typeof api.getInstance === 'function') { root.OCTAChart.getInstance = api.getInstance; }
  if (typeof api.saveChart === 'function') { root.OCTAChart.saveChart = api.saveChart; }
  if (typeof api.loadChart === 'function') { root.OCTAChart.loadChart = api.loadChart; }
  root.openOCTAChart = api.openOCTAChart;

  /* 🧪 Node */
  if (typeof module === 'object' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     🧩 تجميع الـnamespace
     ───────────────────────────────────────────────────────────
     data.js · indicators.js · core.js · gestures.js كل واحد فيهم
     بيحط نفسه في OCTAChart.<ns> — احنا بنأكد إنهم موجودين.
     draw.js و storage.js شغالين في مهمة تانية بالتوازي —
     لو موجودين وقت ما نخلص → بنربطهم، لو لأ → كمّل بدونهم.
     ═══════════════════════════════════════════════════════════ */
  function ns() { return root.OCTAChart || (root.OCTAChart = {}); }

  function has(name) {
    var o = ns();
    return !!(o[name] && typeof o[name] === 'object');
  }

  /* ═══════════════════════════════════════════════════════════
     🔧 أدوات
     ═══════════════════════════════════════════════════════════ */
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function fmtNum(x, d) {
    if (!isNum(x)) return '—';
    if (d == null) d = 2;
    var neg = x < 0;
    var s = Math.abs(x).toFixed(d);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + parts.join('.');
  }

  function fmtDay(t) {
    if (typeof t !== 'string') return '';
    var p = t.split('-');
    if (p.length !== 3) return t;
    return p[0] + '/' + p[1] + '/' + p[2];
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function el(id) {
    return (typeof document !== 'undefined') ? document.getElementById(id) : null;
  }

  function qsa(sel, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(sel));
  }

  function setMsg(kind, text) {
    var box = el('msg');
    if (!box) return;
    if (!text) { box.hidden = true; box.textContent = ''; return; }
    box.hidden = false;
    box.className = 'octa-msg' + (kind ? ' is-' + kind : '');
    box.textContent = text;
  }

  /* ═══════════════════════════════════════════════════════════
     🔗 رابط TradingView
     ═══════════════════════════════════════════════════════════ */
  function tvLink(code) {
    var c = String(code || '').trim().toUpperCase();
    if (!c) return 'https://www.tradingview.com/chart/';
    return 'https://www.tradingview.com/chart/?symbol=EGX:' + encodeURIComponent(c);
  }

  /* ═══════════════════════════════════════════════════════════
     📋 قائمة أسهم احتياطية (داتاليست) — شفيرات حقيقية
     ═══════════════════════════════════════════════════════════ */
  var FALLBACK_CODES = [
    'COMI', 'EAST', 'FWRY', 'HRHO', 'ETEL', 'SWDY', 'MFPC', 'ABUK',
    'ORWE', 'ESRS', 'TMGH', 'IEUC', 'ORAS', 'MISR', 'EFG', 'SUGR',
    'MFPC', 'EKPC', 'KABO', 'MSRS', 'SKPC', 'BTFH', 'HDBK', 'CIEB',
    'AUEB', 'UTWH', 'MPCI', 'BIOD', 'NPCR', 'ALCN', 'MICH', 'OABI'
  ];

  /* ═══════════════════════════════════════════════════════════
     🚀 openOCTAChart
     ───────────────────────────────────────────────────────────
     code = كود السهم (مثال: COMI) · name = الاسم العربي (اختياري)
     ═══════════════════════════════════════════════════════════ */
  var active = null;   /* الـcontroller الحالي */

  function openOCTAChart(code, name) {
    var container = el('chart');
    if (!container) return null;

    var O = ns();
    if (!O.core || typeof O.core.create !== 'function') {
      setMsg('error', 'محرك الشارت غير محمّل');
      return null;
    }
    if (!O.data || typeof O.data.fetchCandles !== 'function') {
      setMsg('error', 'طبقة البيانات غير محمّلة');
      return null;
    }

    var sym = String(code || 'COMI').trim().toUpperCase();
    var tf = '1D';
    var type = 'candles';

    /* لو فيه شارت قديم — نظّفه */
    if (active && active.instance) {
      try { active.instance.destroy(); } catch (e) { }
    }
    if (container) container.innerHTML = '';

    var instance = O.core.create(container, {
      symbol: sym,
      tf: tf,
      type: type,
      priceScaleSide: 'left'
    });

    /* 🔎 مرجع سريع للـinstance (للاختبارات والتكامل) */
    ns().instance = instance;

    var ctrl = {
      instance: instance,
      code: sym,
      name: name || '',
      tf: tf,
      type: type,
      daily: null,        /* الشموع اليومية المخزّنة */
      dailyCode: ''
    };
    active = ctrl;

    /* ── شريط الحالة ── */
    function paintStatus(candles) {
      var pEl = el('st-price'), cEl = el('st-chg'), uEl = el('st-upd');
      var list = (candles && candles.length) ? candles : [];
      if (!list.length) {
        if (pEl) pEl.textContent = '—';
        if (cEl) { cEl.textContent = '—'; cEl.className = 'octa-v octa-flat'; }
        if (uEl) uEl.textContent = '—';
        return;
      }
      var last = list[list.length - 1];
      var prev = (list.length > 1) ? list[list.length - 2] : null;

      if (pEl) pEl.textContent = fmtNum(last.c, 2);

      if (cEl) {
        var base = (prev && isNum(prev.c)) ? prev.c : last.o;
        if (isNum(base) && base !== 0 && isNum(last.c)) {
          var ch = ((last.c - base) / Math.abs(base)) * 100;
          cEl.textContent = (ch > 0 ? '+' : '') + fmtNum(ch, 2) + '%';
          cEl.className = 'octa-v ' + (ch >= 0 ? 'octa-up' : 'octa-down');
        } else {
          cEl.textContent = '—';
          cEl.className = 'octa-v octa-flat';
        }
      }

      if (uEl) uEl.textContent = fmtDay(last.t);
    }

    /* ── تحميل البيانات ── */
    function showFor(tf) {
      if (!ctrl.daily || ctrl.dailyCode !== sym) {
        setMsg('', '');
        paintStatus([]);
        instance.setCandles([], tf);
        return;
      }
      var list = ctrl.daily;
      if (O.data.resample && tf !== '1D') {
        try { list = O.data.resample(ctrl.daily, tf); } catch (e) { list = ctrl.daily; }
      }
      instance.setCandles(list, tf);
      paintStatus(list);
    }

    function load(codeToLoad) {
      var c = String(codeToLoad || sym).trim().toUpperCase();
      if (!c) { setMsg('error', 'اكتب كود السهم الأول'); return; }
      sym = c;
      ctrl.code = c;
      ctrl.dailyCode = '';

      var link = el('tv');
      if (link) link.href = tvLink(c);

      setMsg('', 'جاري تحميل الشموع…');

      O.data.fetchCandles(c, { n: 300, tf: '1D' }).then(function (candles) {
        var ok = !!(candles && candles.length);
        if (!ok) {
          ctrl.daily = null;
          instance.setCandles([], ctrl.tf);
          paintStatus([]);
          var why = (candles && candles.reason) ? candles.reason : 'no_data';
          setMsg('error', 'مفيش بيانات لسهم «' + c + '» (' + why + ')');
          return;
        }
        ctrl.daily = candles;
        ctrl.dailyCode = c;
        setMsg('', '');
        showFor(ctrl.tf);
      });
    }

    /* ── ربط أزرار الفريم ── */
    var tfBtns = qsa('[data-tf]');
    tfBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        ctrl.tf = b.getAttribute('data-tf') || '1D';
        tfBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        showFor(ctrl.tf);
      });
    });

    /* ── ربط أزرار النوع ── */
    var typeBtns = qsa('[data-type]');
    typeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        ctrl.type = b.getAttribute('data-type') || 'candles';
        typeBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        instance.setType(ctrl.type);
      });
    });

    /* ── إدخال السهم ── */
    var input = el('sym');
    if (input) {
      input.value = sym;
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); load(input.value); }
      });
    }
    var go = el('go');
    if (go) go.addEventListener('click', function () { load(input ? input.value : sym); });

    /* ── إيماءات اللمس ── */
    if (O.gest && typeof O.gest.attach === 'function') {
      try {
        ctrl.gest = O.gest.attach(instance, {
          onCrosshair: function (p) { /* الشارت بيرسم الـtooltip بنفسه */ },
          onLongPress: function () { /* ضغط مطوّل = crosshair باللمس */ }
        });
      } catch (e) { }
    }

    /* ── ربط draw.js لو موجود ── */
    if (O.draw && typeof O.draw.enable === 'function') {
      try { O.draw.enable(instance, 'cursor'); } catch (e) { }
    }

    /* ── شريط أدوات الرسم ── */
    var toolBtns = qsa('[data-tool]');
    var activeTool = 'cursor';
    function setTool(tool) {
      if (!O.draw || typeof O.draw.setTool !== 'function') return;
      activeTool = tool || 'cursor';
      try {
        if (typeof O.draw.enable === 'function') O.draw.enable(instance, activeTool);
        else O.draw.setTool(activeTool);
      } catch (e) { }
      toolBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-tool') === activeTool ? 'true' : 'false');
      });
    }
    toolBtns.forEach(function (b) {
      b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); });
    });

    /* ── أزرار الرسم (تراجع/إعادة/مسح/قفل/مغناطيس) ── */
    qsa('[data-draw]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!O.draw) return;
        var act = b.getAttribute('data-draw');
        try {
          if (act === 'undo') O.draw.undo();
          else if (act === 'redo') O.draw.redo();
          else if (act === 'clear') O.draw.clear();
          else if (act === 'lock') {
            var locked = !O.draw.isLocked();
            O.draw.setLocked(locked);
            b.setAttribute('aria-pressed', locked ? 'true' : 'false');
          } else if (act === 'magnet') {
            var on = !O.draw.isMagnet();
            O.draw.setMagnet(on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          }
        } catch (e) { }
      });
    });

    /* ── شريط المؤشرات ── */
    function activeIndicatorIds() {
      var ids = {};
      try {
        var list = instance.getIndicators() || [];
        for (var i = 0; i < list.length; i++) if (list[i] && list[i].id) ids[list[i].id] = true;
      } catch (e) { }
      return ids;
    }
    var indBtns = qsa('[data-ind]');
    function paintIndicatorButtons() {
      var on = activeIndicatorIds();
      indBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', on[b.getAttribute('data-ind')] ? 'true' : 'false');
      });
    }
    indBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-ind');
        if (!id) return;
        var on = activeIndicatorIds();
        try {
          if (on[id]) instance.removeIndicator(id);
          else instance.addIndicator(id, {});
        } catch (e) { setMsg('error', 'تعذّر إضافة المؤشر'); }
        paintIndicatorButtons();
      });
    });

    /* ── الحفظ والتحميل ── */
    var nameEl = el('ch-name'), noteEl = el('ch-note');
    var saveBtn = el('ch-save'), pngBtn = el('ch-png'), listEl = el('ch-list');

    function currentPayload() {
      var st = {};
      try { st = instance.getState() || {}; } catch (e) { st = {}; }
      return {
        name: (nameEl && nameEl.value) ? nameEl.value : '',
        note: (noteEl && noteEl.value) ? noteEl.value : '',
        symbol: st.symbol || sym,
        tf: st.tf || ctrl.tf,
        type: st.type || ctrl.type,
        indicators: st.indicators || [],
        drawings: (O.draw && typeof O.draw.getDrawings === 'function')
          ? (O.draw.getDrawings() || [])
          : (st.drawings || [])
      };
    }

    function paintSavedList(items) {
      if (!listEl) return;
      listEl.innerHTML = '';
      if (!items || !items.length) {
        var empty = document.createElement('div');
        empty.className = 'octa-chempty';
        empty.textContent = 'مفيش رسومات محفوظة لسه — سجّل دخولك عشان تحفظ على السيرفر';
        listEl.appendChild(empty);
        return;
      }
      items.forEach(function (it) {
        var row = document.createElement('div');
        row.className = 'octa-chrow';

        var nm = document.createElement('span');
        nm.className = 'octa-chname';
        nm.textContent = it.name || 'رسمة بدون اسم';
        row.appendChild(nm);

        var meta = document.createElement('span');
        meta.className = 'octa-chmeta';
        meta.textContent = [it.symbol, it.tf, it.type].filter(Boolean).join(' · ');
        row.appendChild(meta);

        var open = document.createElement('button');
        open.type = 'button';
        open.className = 'octa-chdel';
        open.style.color = 'var(--octa-accent)';
        open.textContent = 'فتح';
        open.addEventListener('click', function () {
          if (!O.storage) return;
          O.storage.load(it.id).then(function (c) {
            if (!c) { setMsg('error', 'الرسمة مش موجودة'); return; }
            try {
              instance.applyState(c);
              if (nameEl) nameEl.value = c.name || '';
              if (noteEl) noteEl.value = c.note || '';
              paintIndicatorButtons();
              setMsg('', 'اتحمّلت الرسمة «' + (c.name || '') + '»');
            } catch (e) { setMsg('error', 'تعذّر تحميل الرسمة'); }
          });
        });
        row.appendChild(open);

        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'octa-chdel';
        del.textContent = 'حذف';
        del.addEventListener('click', function () {
          if (!O.storage) return;
          O.storage.remove(it.id).then(function () { refreshSavedList(); });
        });
        row.appendChild(del);

        listEl.appendChild(row);
      });
    }

    function refreshSavedList() {
      if (!O.storage || typeof O.storage.list !== 'function') return;
      O.storage.list().then(function (items) {
        paintSavedList(items || []);
      }).catch(function () { paintSavedList([]); });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (!O.storage || typeof O.storage.save !== 'function') { setMsg('error', 'طبقة الحفظ غير محمّلة'); return; }
        var payload = currentPayload();
        if (!payload.name) { setMsg('error', 'اكتب اسم الكارت الأول'); return; }
        saveBtn.disabled = true;
        O.storage.save(payload).then(function (res) {
          saveBtn.disabled = false;
          if (res && res.ok) setMsg('', (res.local ? 'اتحفظ محلياً — ' : 'اتحفظ على السيرفر — ') + payload.name);
          else setMsg('error', 'الحفظ فشل');
          refreshSavedList();
        }).catch(function () {
          saveBtn.disabled = false;
          setMsg('error', 'الحفظ فشل');
        });
      });
    }

    if (pngBtn) {
      pngBtn.addEventListener('click', function () {
        var name = (nameEl && nameEl.value) ? nameEl.value : sym;
        try {
          if (O.storage && typeof O.storage.exportPNG === 'function') {
            O.storage.exportPNG(instance, name).then(function (r) {
              if (!r || !r.ok) setMsg('error', 'تعذّر تصدير الصورة');
            });
          } else if (typeof instance.exportPNG === 'function') {
            instance.exportPNG();
          }
        } catch (e) { setMsg('error', 'تعذّر تصدير الصورة'); }
      });
    }

    paintIndicatorButtons();
    refreshSavedList();

    /* ── الحالة الابتدائية ── */
    if (tfBtns.length) {
      tfBtns.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-tf') === tf ? 'true' : 'false'); });
    }
    if (typeBtns.length) {
      typeBtns.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-type') === type ? 'true' : 'false'); });
    }

    load(sym);
    return instance;
  }

  /* ═══════════════════════════════════════════════════════════
     🧩 داتاليست الأسهم (اختياري — من /api/stocks)
     ═══════════════════════════════════════════════════════════ */
  function fillStockList() {
    var dl = el('stock-list');
    if (!dl) return;
    var base = (typeof window !== 'undefined' && window.OCTA_API) ? String(window.OCTA_API).replace(/\/+$/, '') : '';
    if (!base) return;

    var add = function (codes) {
      var seen = {};
      dl.innerHTML = '';
      for (var i = 0; i < codes.length; i++) {
        var c = String(codes[i] || '').trim().toUpperCase();
        if (!c || seen[c]) continue;
        seen[c] = 1;
        var o = document.createElement('option');
        o.value = c;
        dl.appendChild(o);
      }
    };

    add(FALLBACK_CODES);

    try {
      if (typeof fetch !== 'function') return;
      fetch(base + '/api/stocks').then(function (r) {
        if (!r || !r.ok) return;
        return r.json();
      }).then(function (json) {
        if (!json) return;
        var list = Array.isArray(json) ? json : (json.stocks || json.data || json.items);
        if (!Array.isArray(list) || !list.length) return;
        var codes = [];
        for (var i = 0; i < list.length; i++) {
          var s = list[i];
          if (!s) continue;
          var code = s.code || s.ticker || s.symbol || s.s;
          if (code) codes.push(code);
        }
        if (codes.length) add(codes);
      }).catch(function () { /* مافيش بيانات → نسيب القائمة الافتراضية */ });
    } catch (e) { }
  }

  /* ═══════════════════════════════════════════════════════════
     🏁 تشغيل تلقائي
     ═══════════════════════════════════════════════════════════ */
  function boot() {
    if (typeof document === 'undefined') return;
    if (!el('chart')) return;

    var code = 'COMI';
    try {
      var m = /[?&]code=([^&#]+)/i.exec(String(location.search || ''));
      if (m && m[1]) code = decodeURIComponent(m[1]);
    } catch (e) { }

    fillStockList();
    openOCTAChart(code, '');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  /* ═══════════════════════════════════════════════════════════
     💾 حفظ / تحميل (storage.js — لو موجود)
     ═══════════════════════════════════════════════════════════ */
  function saveChart(name) {
    var O = ns();
    var inst = (typeof O.getInstance === 'function') ? O.getInstance() : null;
    if (!inst) return Promise.reject(new Error('مافيش شارت مفتوح'));
    if (!O.storage || typeof O.storage.save !== 'function') {
      return Promise.reject(new Error('التخزين غير متاح'));
    }
    var st = inst.getState();
    return O.storage.save({
      name: name || (st.symbol + ' — ' + st.tf),
      note: '',
      symbol: st.symbol,
      tf: st.tf,
      type: st.type,
      indicators: st.indicators,
      drawings: st.drawings
    });
  }

  function loadChart(id) {
    var O = ns();
    if (!O.storage || typeof O.storage.load !== 'function') {
      return Promise.reject(new Error('التخزين غير متاح'));
    }
    return O.storage.load(id).then(function (st) {
      var inst = (typeof O.getInstance === 'function') ? O.getInstance() : null;
      if (inst && st) inst.applyState(st);
      return st;
    });
  }

  /* ═══════════════════════════════════════════════════════════
     📦 التصدير
     ═══════════════════════════════════════════════════════════ */
  return {
    openOCTAChart: openOCTAChart,
    boot: boot,
    tvLink: tvLink,
    saveChart: saveChart,
    loadChart: loadChart,
    getInstance: function () { return ns().instance || null; },
    /*Namespace كامل (data · ind · core · draw · gest · storage) */
    get namespace() {
      var o = ns();
      return {
        data: o.data || null,
        ind: o.ind || null,
        core: o.core || null,
        draw: o.draw || null,
        gest: o.gest || null,
        storage: o.storage || null
      };
    },
    has: has
  };
});
