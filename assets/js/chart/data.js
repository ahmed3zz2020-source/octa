/* ══════════════════════════════════════════════════════════════
   📊 طبقة بيانات الشارت — جلب الشموع + التجميع (يومي/أسبوعي/شهري)
   ──────────────────────────────────────────────────────────────
   🎯 المصدر الوحيد: GET {OCTA_API}/api/candles/<CODE>?n=300
        → { ok, code, candles:[ {t:'YYYY-MM-DD', o, h, l, c, v} ] }
   ⛔ مافيش رقم مخترع: لو الـfetch فشل → مصفوفة فاضية + reason
   ⛔ الفريمات: 1D · 1W · 1M بس (مصدرنا يومي — مافيش intraday)
   ⛔ مافيش hardcode للـbase URL — بنقرأه من window.OCTA_API
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';

  var api = factory();

  /* 🌐 المتصفح: window.OCTAChart.data */
  root.OCTAChart = root.OCTAChart || {};
  root.OCTAChart.data = api;

  /* 🧪 Node: للاختبارات — require('.../chart/data.js') */
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     🎯 الفريمات المتاحة
     ───────────────────────────────────────────────────────────
     ⛔ مافيش intraday (1د/5د/15د/ساعة/4س) — المصدر عندنا يومي
        بس. لو اتعمل مزوّد intraday بعدين → وسّع الـTIMEFRAMES
        ده من غير ما نغيّر أي كود تاني.
     ═══════════════════════════════════════════════════════════ */
  var TIMEFRAMES = {
    '1D': { label: 'يومي',   bar: 'day',   ms: 864e5,  days: 1 },
    '1W': { label: 'أسبوعي', bar: 'week',  ms: 6048e5, days: 7 },
    '1M': { label: 'شهري',   bar: 'month', ms: 2592e6, days: 30 }
  };

  var DEFAULT_N = 300;      /* عدد الشموع اليومية المطلوبة */
  var MAX_N = 1200;         /* سقف الـAPI (نفس سقف الباك) */
  var TIMEOUT_MS = 45000;   /* مهلة الطلب (الباك نفسه بيستنى 30 ثانية) */
  var DAY_MS = 86400000;
  var RE_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

  /* آخر خطا (للواجهة) — null بعد نجاح */
  var lastError = null;

  /* ═══════════════════════════════════════════════════════════
     🔧 أدوات مساعدة
     ═══════════════════════════════════════════════════════════ */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* تاريخ 'YYYY-MM-DD' → ميلي ثانية UTC (منتصف الليل) — null لو التاريخ غلط */
  function parseDay(t) {
    if (typeof t !== 'string') return null;
    var m = RE_DAY.exec(t);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var ms = Date.UTC(y, mo - 1, d);
    var dt = new Date(ms);
    /* رفض التواريخ المستحيلة (2026-02-30 مثلاً) */
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return ms;
  }

  function fmtDay(ms) {
    var dt = new Date(ms);
    return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
  }

  /* رقم صالح ولا null (مافيش 0 افتراضي — null يعني «مفيش بيانات») */
  function num(x) {
    if (typeof x === 'number') return isFinite(x) ? x : null;
    if (typeof x === 'string' && x.trim() !== '') {
      var v = Number(x);
      return isFinite(v) ? v : null;
    }
    return null;
  }

  function isTimeframe(tf) {
    return Object.prototype.hasOwnProperty.call(TIMEFRAMES, tf);
  }

  /* ═══════════════════════════════════════════════════════════
     🧹 تنظيف + ترتيب الشموع
     ───────────────────────────────────────────────────────────
     • شمعة من غير تاريخ صالح أو من غير أسعار → بتتشال (مش بنخمّن)
     • الحجم لو مش رقم → 0 (الباك بيبعته رقم دايماً)
     • ترتيب تصاعدي بالتاريخ + التاريخ المكرر → الأحدث بيفوز
     • مافيش أي قيمة بتتولّد من عندنا
     ═══════════════════════════════════════════════════════════ */
  function normalize(candles) {
    var out = [];
    if (!Array.isArray(candles)) return out;

    for (var i = 0; i < candles.length; i++) {
      var c = candles[i];
      if (!c || typeof c !== 'object') continue;

      var ms = parseDay(c.t);
      if (ms === null) continue;

      var o = num(c.o), h = num(c.h), l = num(c.l), cl = num(c.c);
      if (o === null || h === null || l === null || cl === null) continue;

      var v = num(c.v);

      out.push({
        src: c,               /* الشمعة الأصلية (من غير تعديل) */
        t: c.t,
        ms: ms,
        o: o, h: h, l: l, c: cl,
        v: (v === null ? 0 : v)
      });
    }

    /* ترتيب تصاعدي بالتاريخ (الترتيب مستقر في V8) */
    out.sort(function (a, b) { return a.ms - b.ms; });

    /* نفس اليوم مرتين → الأحدث (اللي في الـpayload بعده) بيفوز */
    var dedup = [];
    for (var j = 0; j < out.length; j++) {
      if (dedup.length && dedup[dedup.length - 1].ms === out[j].ms) dedup[dedup.length - 1] = out[j];
      else dedup.push(out[j]);
    }

    return dedup;
  }

  /* ═══════════════════════════════════════════════════════════
     🗓 مفاتيح التجميع
     ───────────────────────────────────────────────────────────
     📌 الأسبوع — البورصة المصرية بتتداول الأحد→الخميس
        فالأسبوع بيبدأ يوم الأحد.
        التنفيذ: بناخد الأحد الأقرب (أو نفس اليوم) لكل تاريخ
        = نفس «الأسبوع التقويمي (Mon–Sun)» بتاع تاريخ (التاريخ + يوم)
        لأن الأحد بتاع أي أسبوع بيدخل في الأسبوع اللي بعده.
        🐾 مثال: 11/2026 (أحد) → 15/2026 (خميس) = أسبوع واحد.
     📌 الشهر — تقويم ميلادي (2026-10 و 2026-11 مثلاً)
     ═══════════════════════════════════════════════════════════ */
  function weekKey(r) {
    var dow = new Date(r.ms).getUTCDay();       /* 0 = الأحد */
    return r.ms - dow * DAY_MS;                 /* بداية الأسبوع = الأحد */
  }

  function monthKey(r) {
    var dt = new Date(r.ms);
    return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1);
  }

  /* ═══════════════════════════════════════════════════════════
     📦 التجميع — شمعة واحدة لكل فترة
     ───────────────────────────────────────────────────────────
     o = أول فتح · h = أعلى high · l = أقل low · c = آخر إغلاق
     v = مجموع الأحجام · t = أول يوم تداول في الفترة
        (مش تاريخ تقويمي متخيّل — تاع أول يوم تداول حقيقي)
     ═══════════════════════════════════════════════════════════ */
  function aggregate(records, keyOf) {
    var groups = [];
    var cur = null;

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var key = keyOf(r);

      if (!cur || cur.key !== key) {
        cur = { key: key, t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v };
        groups.push(cur);
      } else {
        if (r.h > cur.h) cur.h = r.h;
        if (r.l < cur.l) cur.l = r.l;
        cur.c = r.c;          /* آخر إغلاق */
        cur.v += r.v;         /* مجموع الأحجام */
      }
    }

    var out = [];
    for (var g = 0; g < groups.length; g++) {
      out.push({ t: groups[g].t, o: groups[g].o, h: groups[g].h, l: groups[g].l, c: groups[g].c, v: groups[g].v });
    }
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
     🔄 resample — تجميع الشموع اليومية لأي فريم
     ───────────────────────────────────────────────────────────
     resample(candles, tf) → Candle[]
     • tf = '1D' → نفس الشموع مرتبة تصاعدياً
     • tf = '1W' → شمعة لكل أسبوع (يبدأ بالأحد)
     • tf = '1M' → شمعة لكل شهر ميلادي
     • tf مش معروف → نفس المصفوفة زي ما هي (fallback آمن)
     ═══════════════════════════════════════════════════════════ */
  function resample(candles, tf) {
    if (!Array.isArray(candles)) return [];
    if (!isTimeframe(tf)) return candles;      /* fallback: نفس المصفوفة */

    var records = normalize(candles);
    if (!records.length) return [];

    var spec = TIMEFRAMES[tf];
    if (spec.bar === 'week') return aggregate(records, weekKey);
    if (spec.bar === 'month') return aggregate(records, monthKey);

    /* '1D' — نرجّع العناصر الأصلية (من غير ما نلمسها) */
    var daily = [];
    for (var i = 0; i < records.length; i++) daily.push(records[i].src);
    return daily;
  }

  /* ═══════════════════════════════════════════════════════════
     📐 toSeries — تحويل لصيغة lightweight-charts v5
     ───────────────────────────────────────────────────────────
     { time:'YYYY-MM-DD', open, high, low, close, volume }
     ⛔ الـtime كـنص 'YYYY-MM-DD' هو بالظبط الشكل اللي
        lightweight-charts v5.2.1 بيفهمه (business day string).
     ═══════════════════════════════════════════════════════════ */
  function toSeries(candles) {
    var out = [];
    if (!Array.isArray(candles)) return out;

    for (var i = 0; i < candles.length; i++) {
      var c = candles[i];
      if (!c || typeof c !== 'object') continue;
      if (parseDay(c.t) === null) continue;

      var o = num(c.o), h = num(c.h), l = num(c.l), cl = num(c.c);
      if (o === null || h === null || l === null || cl === null) continue;

      var v = num(c.v);
      out.push({
        time: c.t,
        open: o,
        high: h,
        low: l,
        close: cl,
        volume: (v === null ? 0 : v)
      });
    }

    out.sort(function (a, b) { return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0); });
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
     🌐 جلب الشموع من الـAPI
     ───────────────────────────────────────────────────────────
     fetchCandles(code, {n=300, tf='1D'}) → Promise<Candle[]>
     ⛔ الفشل = مصفوفة فاضية + reason (مافيش throw بيتفجّر)
     ⛔ مافيش قيم افتراضية ولا شموع وهمية
     ═══════════════════════════════════════════════════════════ */
  function apiBase() {
    var g = (typeof window !== 'undefined') ? window : globalThis;
    var b = (g && g.OCTA_API) || (typeof globalThis !== 'undefined' ? globalThis.OCTA_API : '');
    if (!b) return '';
    return String(b).replace(/\/+$/, '');      /* شيل الـslash الأخير */
  }

  function clampN(n) {
    var v = (typeof n === 'number') ? n : Number(n);
    if (!isFinite(v) || v <= 0) return DEFAULT_N;
    v = Math.floor(v);
    if (v > MAX_N) v = MAX_N;                  /* الباك بيقصّ عند 1200 */
    return v < 1 ? 1 : v;
  }

  /* النتيجة + metadata (reason/detail/status/ok) — الـmetadata
     غير قابلة للتعداد عشان deepEqual يشتغل على المصفوفة نفسها */
  function pack(candles, reason, detail, status, okFlag) {
    var arr = candles || [];
    Object.defineProperty(arr, 'reason', { value: reason || '', enumerable: false, configurable: true, writable: true });
    Object.defineProperty(arr, 'detail', { value: detail || '', enumerable: false, configurable: true, writable: true });
    Object.defineProperty(arr, 'status', { value: status == null ? 0 : status, enumerable: false, configurable: true, writable: true });
    Object.defineProperty(arr, 'ok', { value: !!okFlag, enumerable: false, configurable: true, writable: true });
    return arr;
  }

  function fail(reason, detail, status) {
    lastError = { reason: reason || 'error', detail: detail || '', status: status || 0, at: Date.now() };
    return pack([], reason, detail, status, false);
  }

  function succeed(candles) {
    lastError = null;
    return pack(candles, '', '', 200, true);
  }

  function fetchImpl(url) {
    var f = null;
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') f = window.fetch;
    else if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') f = globalThis.fetch;
    if (!f) return Promise.reject(new Error('fetch غير متاح'));

    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = null;
    if (ctrl) {
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) { } }, TIMEOUT_MS);
    }

    return Promise.resolve(f(url, ctrl ? { signal: ctrl.signal } : undefined))
      .then(function (r) {
        if (timer) clearTimeout(timer);
        return r;
      }, function (e) {
        if (timer) clearTimeout(timer);
        throw e;
      });
  }

  function fetchCandles(code, opts) {
    var o = opts || {};
    var tf = (o.tf == null || o.tf === '') ? '1D' : o.tf;
    var n = clampN(o.n == null ? DEFAULT_N : o.n);

    var cd = (typeof code === 'string') ? code.trim().toUpperCase() : (code == null ? '' : String(code).trim());
    if (!cd) return Promise.resolve(fail('invalid_code', 'كود السهم فاضي'));

    var base = apiBase();
    if (!base) return Promise.resolve(fail('no_api_base', 'window.OCTA_API مش مضبوط'));

    var url = base + '/api/candles/' + encodeURIComponent(cd) + '?n=' + n;

    return fetchImpl(url).then(function (res) {
      if (!res) return fail('network_error', 'مفيش رد من السيرفر', 0);

      var status = res.status || 0;

      return Promise.resolve()
        .then(function () { return res.json(); })
        .then(function (json) {
          /* ⛔ الـAPI رجّع ok:false → مصفوفة فاضية + reason */
          if (!json || json.ok === false) {
            var err = (json && json.error) ? String(json.error) : 'api_error';
            return fail(err, 'الـAPI رفض الطلب: ' + err, status);
          }
          if (!Array.isArray(json.candles)) {
            return fail('bad_response', 'رد غير متوقع من الـAPI', status);
          }

          var daily = normalize(json.candles);
          if (!daily.length) return fail('no_data', 'مفيش شموع', status);

          /* نحترم n: ناخد آخر n شمعة (الباك بيرجع min 60) */
          if (daily.length > n) daily = daily.slice(daily.length - n);

          return succeed(resample(daily.map(function (r) { return r.src; }), tf));
        }, function () {
          /* الرد مش JSON */
          return fail('http_' + (status || 0), 'رد غير مفهوم من الـAPI', status);
        });
    }, function (e) {
      var aborted = e && (e.name === 'AbortError' || e.code === 20);
      return fail(aborted ? 'timeout' : 'network_error',
        (e && e.message) ? e.message : 'فشل الاتصال', 0);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     📦 التصدير
     ═══════════════════════════════════════════════════════════ */
  return {
    TIMEFRAMES: TIMEFRAMES,
    fetchCandles: fetchCandles,
    resample: resample,
    toSeries: toSeries,
    isTimeframe: isTimeframe,
    /* آخر خطا (reason/detail/status) — null بعد نجاح */
    get lastError() { return lastError; }
  };
});
