/* ══════════════════════════════════════════════════════════════
   💾 طبقة حفظ الرسومات — assets/js/chart/storage.js
   ──────────────────────────────────────────────────────────────
   🎯 الـAPI:
        POST   {OCTA_API}/api/charts
        GET    {OCTA_API}/api/charts
        GET    {OCTA_API}/api/charts/list
        GET    {OCTA_API}/api/charts/<id>
        DELETE {OCTA_API}/api/charts/<id>
   🔐 التوكن: Bearer <localStorage.octa_token> — إحنا اللي بنبعته
      بنفسنا (⛔ مافيش تعديل على assets/js/octa-api.js).
   🛟 مافيش توكن → رسالة «سجّل دخول الأول» + حفظ محلي (fallback)
      — ما بتكسرش.
   🛡️ تنظيف name/note من أي HTML قبل العرض (XSS).
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';

  var api = factory();

  /* 🌐 المتصفح: window.OCTAChart.storage */
  root.OCTAChart = root.OCTAChart || {};
  root.OCTAChart.storage = api;

  /* 🧪 Node: للاختبارات — require('.../chart/storage.js') */
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var LOCAL_KEY = 'octa_charts_local_v1';
  var TOKEN_KEY = 'octa_token';
  var NO_LOGIN = 'سجّل دخول الأول';

  var msgHandler = null;   /* اختياري: دالة تعرض الرسالة */
  var api = null;          /* المرجع المُصدَّر (بنتكلم معاه من جوّه) */

  /* ═══════════════════════════════════════════════════════════
     🛡 التنظيف (XSS)
     ───────────────────────────────────────────────────────────
     ⛔ الـname والـnote بيتقبلوا من المستخدم — لازم أي HTML
        يتشال قبل ما يتعرض (حتى لو بعدين حد عمل innerHTML).
     ═══════════════════════════════════════════════════════════ */
  function escapeHtml(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* نص نقي: نشيل الوسوم + محارف التحكم + الأقواس المكسورة */
  function sanitizeText(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    /* بلوكات كاملة (script/style/iframe) — المحتوى بتاعها كمان يتشال */
    s = s.replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    /* وسوم HTML */
    s = s.replace(/<[^>]*>/g, '');
    /* بقايا أقواس */
    s = s.replace(/[<>"'`]/g, '');
    /* محارف تحكّم */
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    return s.trim();
  }

  function cleanName(v) { return sanitizeText(v).slice(0, 120); }
  function cleanNote(v) { return sanitizeText(v).slice(0, 2000); }

  function clone(o) {
    if (o === null || o === undefined) return o;
    return JSON.parse(JSON.stringify(o));
  }

  /* ═══════════════════════════════════════════════════════════
     🌐 الـAPI — base + توكن
     ═══════════════════════════════════════════════════════════ */
  function apiBase() {
    var g = (typeof window !== 'undefined') ? window : globalThis;
    var b = (g && g.OCTA_API) || (typeof globalThis !== 'undefined' ? globalThis.OCTA_API : '') || '';
    return String(b).replace(/\/+$/, '');
  }

  function getToken() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return '';
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) { return ''; }
  }

  function setToken(t) {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return false;
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
      return true;
    } catch (e) { return false; }
  }

  /* ═══════════════════════════════════════════════════════════
     📨 بناء الطلب —Bearer + base صح
     ═══════════════════════════════════════════════════════════ */
  function buildRequest(path, options) {
    var o = options || {};
    var base = (o.base !== undefined && o.base !== null) ? String(o.base) : apiBase();
    base = base.replace(/\/+$/, '');
    var url = base + (path.charAt(0) === '/' ? path : ('/' + path));
    var method = (o.method || 'GET').toUpperCase();
    var token = (o.token !== undefined && o.token !== null) ? String(o.token) : getToken();

    var headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var body = null;
    if (o.payload !== undefined && o.payload !== null) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(o.payload);
    }

    return { url: url, method: method, headers: headers, body: body };
  }

  function doFetch(req) {
    var f = null;
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      f = window.fetch.bind(window);
    } else if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
      f = globalThis.fetch.bind(globalThis);
    }
    if (!f) return Promise.reject(new Error('fetch غير متاح'));

    var init = { method: req.method, headers: req.headers };
    if (req.body) init.body = req.body;
    return Promise.resolve(f(req.url, init));
  }

  /* ═══════════════════════════════════════════════════════════
     📦 الـpayload
     ───────────────────────────────────────────────────────────
     الحقول: name · note · symbol · tf · type · indicators · drawings
     (+ id اختياري للتعديل)
     ═══════════════════════════════════════════════════════════ */
  function cleanSymbol(v) {
    if (v === null || v === undefined) return '';
    var s = String(v).trim();
    if (!s) return '';
    if (/^[A-Za-z0-9:._\-]+$/.test(s)) return s.toUpperCase();
    return s;
  }

  function buildPayload(input) {
    var i = input || {};
    var p = {};
    if (i.id) p.id = String(i.id);
    p.name = cleanName(i.name);
    p.note = cleanNote(i.note);
    p.symbol = cleanSymbol(i.symbol);
    p.tf = (i.tf === null || i.tf === undefined) ? '' : String(i.tf).trim();
    p.type = (i.type === null || i.type === undefined) ? '' : String(i.type).trim();
    p.indicators = Array.isArray(i.indicators) ? clone(i.indicators) : [];
    p.drawings = Array.isArray(i.drawings) ? clone(i.drawings) : [];
    return p;
  }

  /* ═══════════════════════════════════════════════════════════
     💬 الرسالة
     ═══════════════════════════════════════════════════════════ */
  function setMessageHandler(fn) {
    msgHandler = (typeof fn === 'function') ? fn : null;
    return api;
  }
  function message(text, kind) {
    var t = String(text || '');
    if (msgHandler) {
      try { msgHandler(t, kind || 'info'); } catch (e) { }
    }
    if (typeof window !== 'undefined') {
      if (typeof window.OCTAMsg === 'function') {
        try { window.OCTAMsg(t, kind || 'info'); } catch (e) { }
      }
      toast(t, kind);
    } else if (typeof console !== 'undefined' && console.warn) {
      console.warn('[OCTA] ' + t);
    }
  }

  /* توست بسيط — inline styles عشان ما نلمسش styles.css بتاع حد تاني */
  function toast(text, kind) {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      var el = document.createElement('div');
      el.className = 'octa-storage-toast';
      el.setAttribute('role', 'status');
      el.textContent = text;                       /* ⛔ textContent مش HTML */
      el.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
        'z-index:9999', 'background:#ffffff', 'color:#131722',
        'border:1px solid #e0e3eb', 'border-radius:10px',
        'padding:12px 18px', 'font:500 14px system-ui, Tahoma, Arial, sans-serif',
        'box-shadow:0 6px 24px rgba(19,23,34,.14)', 'max-width:90vw',
        'direction:rtl', 'text-align:center',
        kind === 'error' ? 'border-color:#f23645' : 'border-color:#2962ff'
      ].join(';');
      document.body.appendChild(el);
      setTimeout(function () {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 4000);
    } catch (e) { }
  }

  /* ═══════════════════════════════════════════════════════════
     🗂 الحفظ المحلي (fallback)
     ═══════════════════════════════════════════════════════════ */
  function localAll() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return {};
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }

  function localPut(o) {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return false;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(o));
      return true;
    } catch (e) { return false; }
  }

  function localId() {
    return 'local_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 8);
  }

  function localSave(payload) {
    var all = localAll();
    var id = payload.id || localId();
    var now = new Date().toISOString();
    all[id] = {
      id: id, name: payload.name, note: payload.note,
      symbol: payload.symbol, tf: payload.tf, type: payload.type,
      indicators: payload.indicators, drawings: payload.drawings,
      created: all[id] ? (all[id].created || now) : now,
      updated: now, local: true
    };
    localPut(all);
    return { ok: true, id: id, local: true, reason: 'local' };
  }

  function localList() {
    var all = localAll();
    var out = [];
    for (var k in all) {
      if (!Object.prototype.hasOwnProperty.call(all, k)) continue;
      var c = all[k] || {};
      out.push({
        id: c.id || k, name: cleanName(c.name), note: cleanNote(c.note),
        symbol: cleanSymbol(c.symbol), tf: c.tf || '',
        type: c.type || '', updated: c.updated || '', local: true
      });
    }
    out.sort(function (a, b) { return String(b.updated).localeCompare(String(a.updated)); });
    return out;
  }

  function localLoad(id) {
    var all = localAll();
    var c = all[id];
    if (!c) return null;
    return {
      id: c.id || id, name: cleanName(c.name), note: cleanNote(c.note),
      symbol: cleanSymbol(c.symbol), tf: c.tf || '', type: c.type || '',
      indicators: Array.isArray(c.indicators) ? c.indicators : [],
      drawings: Array.isArray(c.drawings) ? c.drawings : [],
      created: c.created || '', updated: c.updated || '', local: true
    };
  }

  function localRemove(id) {
    var all = localAll();
    if (!Object.prototype.hasOwnProperty.call(all, id)) return { ok: false, deleted: false };
    delete all[id];
    localPut(all);
    return { ok: true, deleted: true, local: true };
  }

  /* ═══════════════════════════════════════════════════════════
     💾 الحفظ / القراءة / الحذف
     ═══════════════════════════════════════════════════════════ */
  function save(input) {
    var payload = buildPayload(input);
    if (!payload.name) payload.name = 'رسمة بدون اسم';

    var token = getToken();
    if (!token) {
      message(NO_LOGIN, 'warn');
      return Promise.resolve(localSave(payload));
    }

    var req = buildRequest('/api/charts', { method: 'POST', payload: payload, token: token });
    return doFetch(req).then(function (res) {
      if (!res) throw new Error('لا يوجد رد');
      if (res.status === 401) {
        message(NO_LOGIN, 'warn');
        return localSave(payload);
      }
      if (!res.ok) {
        message('تعذّر الحفظ على السيرفر — تم الحفظ محلياً', 'error');
        return localSave(payload);
      }
      return res.json().then(function (j) {
        var id = (j && j.id) ? String(j.id) : (payload.id || '');
        if (!id) {                       /* السيرفر رجّع رد غريب */
          message('رد غير متوقع من السيرفر — تم الحفظ محلياً', 'error');
          return localSave(payload);
        }
        return { ok: true, id: id, local: false, chart: j && j.chart ? j.chart : null };
      }, function () {
        message('تعذّر الحفظ على السيرفر — تم الحفظ محلياً', 'error');
        return localSave(payload);
      });
    }).catch(function () {
      message('تعذّر الاتصال بالسيرفر — تم الحفظ محلياً', 'error');
      return localSave(payload);
    });
  }

  function sanitizeList(list) {
    var arr = Array.isArray(list) ? list : [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i] || {};
      out.push({
        id: c.id ? String(c.id) : '',
        name: cleanName(c.name),
        note: cleanNote(c.note),
        symbol: cleanSymbol(c.symbol),
        tf: c.tf || '',
        type: c.type || '',
        updated: c.updated || ''
      });
    }
    return out;
  }

  function listFrom(path) {
    var token = getToken();
    if (!token) {
      message(NO_LOGIN, 'warn');
      return Promise.resolve(localList());
    }
    var req = buildRequest(path, { method: 'GET', token: token });
    return doFetch(req).then(function (res) {
      if (!res) throw new Error('لا يوجد رد');
      if (res.status === 401) {
        message(NO_LOGIN, 'warn');
        return localList();
      }
      if (res.status === 404) throw { notFound: true };
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json().then(function (j) {
        var arr = (j && Array.isArray(j.charts)) ? j.charts
          : (j && Array.isArray(j)) ? j
            : (j && j.chart) ? [j.chart] : [];
        return sanitizeList(arr);
      });
    }).catch(function (e) {
      if (e && e.notFound) return listFrom('/api/charts');
      return localList();
    });
  }

  function list() {
    return listFrom('/api/charts/list');
  }

  function load(id) {
    var key = String(id || '').trim();
    if (!key) return Promise.resolve(null);
    var token = getToken();
    if (!token) {
      message(NO_LOGIN, 'warn');
      return Promise.resolve(localLoad(key));
    }
    var req = buildRequest('/api/charts/' + encodeURIComponent(key), { method: 'GET', token: token });
    return doFetch(req).then(function (res) {
      if (!res) throw new Error('لا يوجد رد');
      if (res.status === 401) {
        message(NO_LOGIN, 'warn');
        return localLoad(key);
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json().then(function (j) {
        var c = (j && j.chart) ? j.chart : (j && j.id ? j : null);
        if (!c) return null;
        return {
          id: String(c.id || key),
          name: cleanName(c.name), note: cleanNote(c.note),
          symbol: cleanSymbol(c.symbol), tf: c.tf || '', type: c.type || '',
          indicators: Array.isArray(c.indicators) ? c.indicators : [],
          drawings: Array.isArray(c.drawings) ? c.drawings : [],
          created: c.created || '', updated: c.updated || ''
        };
      });
    }).catch(function () {
      return localLoad(key);
    });
  }

  function remove(id) {
    var key = String(id || '').trim();
    if (!key) return Promise.resolve({ ok: false, deleted: false, reason: 'bad_id' });
    var token = getToken();
    if (!token) {
      message(NO_LOGIN, 'warn');
      return Promise.resolve(localRemove(key));
    }
    var req = buildRequest('/api/charts/' + encodeURIComponent(key), { method: 'DELETE', token: token });
    return doFetch(req).then(function (res) {
      if (!res) throw new Error('لا يوجد رد');
      if (res.status === 401) {
        message(NO_LOGIN, 'warn');
        return localRemove(key);
      }
      if (res.status === 404) return { ok: true, deleted: true, local: false };
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json().then(function (j) {
        return { ok: true, deleted: !!(j && j.deleted), local: false };
      }, function () { return { ok: true, deleted: true, local: false }; });
    }).catch(function () {
      return localRemove(key);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     🖼 تصدير PNG
     ───────────────────────────────────────────────────────────
     📌 الاسم لازم يكون فيه رمز السهم.
     ═══════════════════════════════════════════════════════════ */
  function safeFilePart(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[\\/:*?"<>|]+/g, '-')      /* محارف ممنوعة في أسماء الملفات */
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 60);
  }

  function buildFilename(symbol, name, stamp) {
    var sym = safeFilePart(symbol || 'OCTA');
    var base = safeFilePart(name || '');
    var ts = stamp || (new Date().toISOString().slice(0, 10));
    var out = sym;
    if (base) out += '-' + base;
    out += '-' + ts + '.png';
    return out;
  }

  function symbolOf(instance) {
    if (!instance) return '';
    try {
      if (typeof instance.getState === 'function') {
        var s = instance.getState();
        if (s && s.symbol) return String(s.symbol);
      }
    } catch (e) { }
    if (instance.symbol) return String(instance.symbol);
    return '';
  }

  function download(blob, filename) {
    if (typeof document === 'undefined' || !document.createElement) return false;
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a && a.parentNode) a.parentNode.removeChild(a);
        try { URL.revokeObjectURL(url); } catch (e) { }
      }, 500);
      return true;
    } catch (e) { return false; }
  }

  function drawLayer(ctx, W, H) {
    try {
      var d = root.OCTAChart && root.OCTAChart.draw;
      if (d && typeof d.renderTo === 'function') d.renderTo(ctx, W, H);
    } catch (e) { }
  }

  function exportPNG(instance, filename) {
    var sym = symbolOf(instance);
    var name = buildFilename(sym, filename);

    if (typeof document === 'undefined' || !document.createElement) {
      return Promise.resolve({ ok: false, filename: name, reason: 'no_dom' });
    }

    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    var base = null;

    try {
      if (instance && typeof instance.exportPNG === 'function') base = instance.exportPNG();
    } catch (e) { base = null; }

    var pane = null;
    try {
      var draw = root.OCTAChart && root.OCTAChart.draw;
      if (draw && typeof draw.getPaneCanvas === 'function') pane = draw.getPaneCanvas();
    } catch (e) { pane = null; }

    var W = (pane && pane.clientWidth) ? pane.clientWidth : (pane ? pane.width : 0);
    var H = (pane && pane.clientHeight) ? pane.clientHeight : (pane ? pane.height : 0);
    if (!W || !H) return Promise.resolve({ ok: false, filename: name, reason: 'no_canvas' });

    var canvas = document.createElement('canvas');
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    var ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve({ ok: false, filename: name, reason: 'no_ctx' });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var drawBase = function (src) {
      if (!src) return Promise.resolve(false);
      if (typeof src === 'string') {
        return new Promise(function (res) {
          var img = new Image();
          img.onload = function () {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            res(true);
          };
          img.onerror = function () { res(false); };
          img.src = src;
        });
      }
      if (typeof createImageBitmap === 'function' && typeof src.arrayBuffer === 'function') {
        return src.arrayBuffer().then(function (buf) {
          return createImageBitmap(new Blob([buf], { type: src.type || 'image/png' }));
        }).then(function (bmp) {
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
          return true;
        }).catch(function () { return false; });
      }
      return Promise.resolve(false);
    };

    var basePromise = (base && typeof base.then === 'function')
      ? base.then(drawBase)
      : (pane ? drawBase(pane) : Promise.resolve(false));

    return basePromise.then(function () {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawLayer(ctx, W, H);
      ctx.restore();
      return new Promise(function (res) {
        if (typeof canvas.toBlob !== 'function') {
          res({ ok: false, filename: name, reason: 'no_toBlob' });
          return;
        }
        canvas.toBlob(function (blob) {
          if (!blob) { res({ ok: false, filename: name, reason: 'no_blob' }); return; }
          var ok = download(blob, name);
          res({ ok: ok, filename: name, size: blob.size });
        }, 'image/png');
      });
    }).catch(function (e) {
      return { ok: false, filename: name, reason: (e && e.message) ? e.message : 'error' };
    });
  }

  /* ═══════════════════════════════════════════════════════════
     📦 التصدير
     ═══════════════════════════════════════════════════════════ */
  api = {
    LOCAL_KEY: LOCAL_KEY,
    TOKEN_KEY: TOKEN_KEY,
    NO_LOGIN: NO_LOGIN,

    save: save,
    list: list,
    load: load,
    remove: remove,
    exportPNG: exportPNG,

    buildPayload: buildPayload,
    buildRequest: buildRequest,
    buildFilename: buildFilename,
    sanitizeText: sanitizeText,
    escapeHtml: escapeHtml,
    cleanName: cleanName,
    cleanNote: cleanNote,
    getToken: getToken,
    setToken: setToken,
    setMessageHandler: setMessageHandler,
    message: message,

    localList: localList,
    localLoad: localLoad,
    localSave: localSave,
    localRemove: localRemove
  };

  return api;
});
