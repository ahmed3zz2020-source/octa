/* ═══════════════════════════════════════════════════════════
   🐙 OCTA — Worker entrypoint
   ───────────────────────────────────────────────────────────
   Proxy /api/* → octa-prices-production-4ccb.up.railway.app
   (يحايل CORS + cross-origin-resource-policy في الباك).
   باقي الطلبات → static assets في dist/.

   ⚠️ ليش فيه إعادة محاولة؟
   الاتصال من الـWorker للـRailway بيتقطّع أحياناً (TLS reset من
   الطرف التاني) — والطلب كان بيرجع 503 للمستخدم من غير سبب.
   فبنحاول ٣ مرات بتباعد قصير قبل ما نرجّع خطأ.

   ═══════════════════════════════════════════════════════════
   🚪 البوابة — ٢١ أكتوبر ٢٠٢٦
   ───────────────────────────────────────────────────────────
   ⛔⛔⛔ المشكلة: الـWorker كان بيقدّم التطبيق **كله** (١٫٨ ميجا)
   لأي زائر — حتى لو مش مسجّل. والبيانات كانت بتنزل من غير توكن.

   ⛌ الحل: الـWorker بيفحص **كوكي الجلسة**:
     · كوكي present  → التطبيق (زي ما كان)
     · مفيش كوكي    → صفحة بوابة صغيرة (gate.html) بدل التطبيق

   ⛌ ليه كوكي وليه مش localStorage؟
     الـWorker مش بيقدر يقرا localStorage — ده المتصفح بس.
     فالجلسة لازم تكون كوكي على دومين الموقع. الـكوكي HttpOnly
     (يعني السكربتات ماتقراهوش) + SameSite=Lax + Secure.

   ⛌⛔ مهم — البوابة **مش** بديل عن حماية الباك:
     الباك نفسه بقى يقفل كل مسار بيانات ورا توكن
     (api_gate في update_prices.py). البوابة دي طبقة أولى
     (بتوفّر ١٫٨ ميجا للزائر المجهول) — والباك هو الطبقة
     اللي بتمنع تنزيل الداتا فعلياً.
   ═══════════════════════════════════════════════════════════ */

const API = 'https://octa-prices-production-4ccb.up.railway.app';
const TRIES = 3;

/* ══════════════════════════════════════════════════════════════
   ⭐ جسر سكانر TradingView — للفلتر (Smart Money)
   ──────────────────────────────────────────────────────────────
   ⛔⛔ ليه؟
      الباك (Railway) ممكن يبقى واقع ساعات ⇒ الفلتر يبقى فاضي
      والصفحة كلها بتتقفل behind صفحة الصيانة. الجسر ده بيجيب
      داتا السوق من TradingView مباشرة من الـedge (من غير توكن
      و من غير CORS — لأن الطلب بيطلع من السيرفر مش من المتصفح).

   ⛌ مقفول على الإنتاج افتراضياً: شغّال بس لو
      env.OCTA_TV_PROXY === 'on' (اللي متحطّ في المعاينة بس).
      ⇒ الإنتاج ما يتأثرش خالص.

   📌 الداتا دي من TradingView نفسه — متاحة للكل. مش سر.
   📌 الكاش على الـedge ٥ دقايق (احترام المصدر + سرعة).
   ══════════════════════════════════════════════════════════════ */
const TV_SCAN = 'https://scanner.tradingview.com/egypt/scan';

/* الأعمدة اللي بنجيبها — نفس اللي الباك بيجيبها */
const TV_COLS = [
  'close', 'change', 'volume',
  'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.Y', 'Perf.YTD',
  'Volatility.D', 'relative_volume_10d_calc', 'average_volume_30d_calc',
  'market_cap_basic', 'beta_1_year', 'Recommend.All',
  'RSI', 'MACD.macd', 'MACD.signal',
  'EMA20', 'EMA50', 'EMA200', 'SMA50', 'SMA200',
  'ATR', 'ADX', 'ADX+DI', 'ADX-DI', 'Stoch.K', 'Stoch.D',
  'price_earnings_ttm', 'price_book_fq', 'return_on_equity',
  'earnings_per_share_diluted_ttm', 'total_revenue'
];

/* ⛔ خريطة العمود → اسم الحقل اللي محرك OCTA بيفهمه */
const TV_MAP = {
  'close': 'price', 'change': 'change', 'volume': 'volume',
  'Perf.W': 'perf1w', 'Perf.1M': 'perf1m', 'Perf.3M': 'perf3m',
  'Perf.6M': 'perf6m', 'Perf.Y': 'perf1y', 'Perf.YTD': 'perfYtd',
  'Volatility.D': 'volD', 'relative_volume_10d_calc': 'relvol',
  'average_volume_30d_calc': 'av30', 'market_cap_basic': 'mkt_cap',
  'beta_1_year': 'beta', 'Recommend.All': 'tvRating',
  'RSI': 'rsi', 'MACD.macd': 'macd', 'MACD.signal': 'macdSig',
  'EMA20': 'ema20', 'EMA50': 'ema50', 'EMA200': 'ema200',
  'SMA50': 'ma50', 'SMA200': 'ma200',
  'ATR': 'atr', 'ADX': 'adx', 'ADX+DI': 'diPlus', 'ADX-DI': 'diMinus',
  'Stoch.K': 'stochK', 'Stoch.D': 'stochD',
  'price_earnings_ttm': 'pe', 'price_book_fq': 'pb',
  'return_on_equity': 'roe',
  'earnings_per_share_diluted_ttm': 'eps', 'total_revenue': 'revenue'
};

function tvRowsFromScan(data, cols) {
  const use = cols || TV_COLS;
  const out = [];
  const rows = (data && data.data) || [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const d = r.d || [];
    const code = String(r.s || '').split(':').pop();
    if (!code) continue;
    const o = { code: code };
    for (let c = 0; c < use.length; c++) {
      const f = TV_MAP[use[c]];
      const v = d[c];
      if (f && v !== null && v !== undefined && isFinite(v)) o[f] = v;
    }
    if (o.price) out.push(o);
  }
  return out;
}


/* ⛔ اسم كوكي الجلسة — لازم يبقى نفس اسم الباك (octa_token) */
const SESSION_COOKIE = 'octa_token';

/* 🚪 صفحات التطبيق — دي اللي بتتقفل بدون جلسة
   ⛌ الـassets (js/css/images) بتتنفع عادي — صفحة البوابة
      محتاجاها. */
const GATE_PAGES = ['/', '/index.html', '/chart', '/chart.html'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 🔁 جلب من الـAPI مع إعادة محاولة — الخطأ البسيط بيتراجع لوحده */
async function fetchApi(target, init) {
  let lastErr = null;
  for (let i = 0; i < TRIES; i++) {
    try {
      /* ⛔⛔ ٢٢ أكتوبر ٢٠٢٦ — مهلة ٨ ثواني لكل محاولة.
      ⛌ الباك (Railway) واقع ⇒ الطلب كان بيقعد دقيقة لحد ما
      ⛌   يرد 502 ⇒ المستخدم واقف قدام شاشة تحميل.
      ⛌ دلوقتي بنقطعه بسرعة ونرجّع 502 — الواجهة بتعرف تتعامل. */
      const o = Object.assign({}, init || {});
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
        o.signal = AbortSignal.timeout(8000);
      }
      const r = await fetch(target, o);
      if (r.status >= 500 && i < TRIES - 1) {
        lastErr = new Error('upstream ' + r.status);
        await sleep(180 * (i + 1));
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (i < TRIES - 1) await sleep(180 * (i + 1));
    }
  }
  throw lastErr || new Error('api-proxy-failed');
}

/* ═══════════════════════════════════════════════════════════
   🔐 هيدرات الطلب اللي بتتبعت للـAPI
   ───────────────────────────────────────────────────────────
   ⛔⛔ ٢١ أكتوبر ٢٠٢٦ — الـworker كان بيبعت Accept بس
   ⛌ وبيرمي Authorization و Cookie و جسم الطلب!
   ⛌ النتيجة: أي مسار محمي كان بيرجّع 401 دايماً لما يمر
   ⛌ من الـworker.
   ═══════════════════════════════════════════════════════════ */
function buildHeaders(request) {
  const h = new Headers();
  h.set('Accept', 'application/json');
  /* ⛔ التوكن —Authorization (الباك بيقراه) */
  const auth = request.headers.get('Authorization');
  if (auth) h.set('Authorization', auth);
  /* ⛔ الكوكي — عشان الباك يقرأ الجلسة من الكوكي كمان */
  const ck = request.headers.get('Cookie');
  if (ck) h.set('Cookie', ck);
  /* ⛔ نوع المحتوى — لازم يوصل زي ما هو */
  const ct = request.headers.get('Content-Type');
  if (ct) h.set('Content-Type', ct);
  /* ⛌⛔⛔ identity — عشان مفيش gzip من الـAPI
     ⛌ (الـruntime بيضغط الردود لوحده قبل ما تطلع للعميل) */
  h.set('Accept-Encoding', 'identity');
  /* ⛌ الـIP — الباك بيقراه للrate limit */
  const cf = request.headers.get('CF-Connecting-IP');
  if (cf) h.set('X-Forwarded-For', cf);
  return h;
}

/* ═══════════════════════════════════════════════════════════
   🍪 فيه جلسة ولا لأ؟
   ───────────────────────────────────────────────────────────
   ⛌ بنفحص **وجود** الكوكي بس — مش صحته.
   ⛌ الـworker مش بيقدر يفكّ التوقيع (السر عند الباك).
   ⛌ ⇒ لو الكوكي forged ⇒ الـworker هيقدّم التطبيق… والباك
   ⛌   هيرفض كل طلب بيانات (401). يعني: مفيش تسريب.
   ═══════════════════════════════════════════════════════════ */
function hasSession(request) {
  try {
    const c = request.headers.get('Cookie') || '';
    if (!c) return false;
    const parts = c.split(';');
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (p.indexOf(SESSION_COOKIE + '=') === 0) {
        const v = p.slice(SESSION_COOKIE.length + 1);
        if (v) return true;
      }
    }
  } catch (e) { }
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* 1.5) ⭐ جسر سكانر TradingView — الفلتر يشتغل من غير الباك
       ⛌ مقفول على الإنتاج: شغّال بس لو OCTA_TV_PROXY === 'on'
          (اللي في إعدادات المعاينة بس).
       📌 stale-while-revalidate: أول طلب بعد انتهاء الكاش بيرجّع
          النسخة القديمة فوراً ويحدّث في الخلفية — عشان المستخدم
          ما يستناش ٢٠ ثانية كل مرة. */
    if (url.pathname === '/api/tvscan' && env && env.OCTA_TV_PROXY === 'on') {
      const c = url.searchParams.get('c') || 'egx';
      const limit = Math.max(1, Math.min(400, Number(url.searchParams.get('limit') || 400)));
      const cols = url.searchParams.get('cols') === 'min'
        ? ['close', 'change', 'volume', 'RSI', 'MACD.macd', 'MACD.signal', 'SMA50', 'SMA200']
        : TV_COLS;
      /* 📌 v2 في المفتاح — عشان الكاش القديم (بصيغة تانية) ما يتخدمش
         بعد أي تعديل على شكل البيانات. */
      const key = 'https://octa.internal/v2/tvscan/' + c + '/' + limit + '/' + cols.length;
      const cacheKey = new Request(key, { method: 'GET' });
      const cache = caches && caches.default;

      const doFetch = async () => {
        const body = {
          symbols: { query: { types: [] }, tickers: [] },
          filter: [
            { left: 'exchange', operation: 'in_range', right: ['EGX'] },
            { left: 'type', operation: 'equal', right: 'stock' }
          ],
          options: { lang: 'en' },
          columns: cols,
          range: [0, limit],
          sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' }
        };
        const up = await fetch(TV_SCAN, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
            'Accept': 'application/json'
          },
          body: JSON.stringify(body)
        });
        if (!up.ok) throw new Error('tv-' + up.status);
        const j = await up.json();
        const rows = tvRowsFromScan(j, cols);
        const res = new Response(JSON.stringify({ ok: true, n: rows.length, ts: Date.now(), rows: rows }), {
          headers: {
            'Content-Type': 'application/json',
            /* ⛔ TTL طويل (يوم) — التحديث بيتم في الخلفية مش عند الطلب */
            /* ⚠️ TTL كان يوم كامل ⇒ لو فشل التحديث في الخلفية، المستخدم
               ياخد بيانات من يوم كامل وهي معروضة «حيّة». ⇒ ١٠ دقايق. */
            'Cache-Control': 'public, max-age=600',
            'Access-Control-Allow-Origin': '*',
            'x-octa-ts': String(Date.now())
          }
        });
        if (cache) { try { await cache.put(cacheKey, res.clone()); } catch (e) { } }
        return res;
      };

      if (cache) {
        const hit = await cache.match(cacheKey);
        if (hit) {
          const ts = Number(hit.headers.get('x-octa-ts') || 0);
          const age = Date.now() - ts;
          const h = new Headers(hit.headers);
          h.set('x-octa-cache', age < 300000 ? 'fresh' : 'stale');
          h.set('x-octa-age', String(age));
          if (age < 300000) return new Response(hit.body, { headers: h });   /* لسه طازة */
          if (ctx && ctx.waitUntil) {               /* قديمة → نحدّث في الخلفية */
            try { ctx.waitUntil(doFetch().catch(() => { })); } catch (e) { }
          }
          return new Response(hit.body, { headers: h });                    /* نرجّع القديمة فوراً */
        }
      }
      try {
        return await doFetch();
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'tv-failed', msg: String(e && e.message || e) }),
          { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
    }

    /* 1.6) ⭐ شموع السوق — للمؤشرات الذكية (جيميني · القفل · MCDX)
       ⛌ نفس بوابة المعاينة (OCTA_TV_PROXY) — الإنتاج مقفول.
       📌 المصدر: startamarkets (نفس مصدر الباك) — شموع يومية حقيقية. */
    if (url.pathname === '/api/tvcandles' && env && env.OCTA_TV_PROXY === 'on') {
      const code = (url.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const n = Math.max(60, Math.min(400, Number(url.searchParams.get('n') || 320)));
      if (!code) {
        return new Response(JSON.stringify({ ok: false, error: 'bad code' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const ck = new Request('https://octa.internal/v2/tvcandles/' + code + '/' + n, { method: 'GET' });
      const cache = caches && caches.default;
      if (cache) {
        const hit = await cache.match(ck);
        if (hit) return hit;
      }
      try {
        const up = await fetch('https://startamarkets.com/api/v1/egx/history/' + code, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
            'Accept': 'application/json,text/plain,*/*',
            'Origin': 'https://startamarkets.com',
            'Referer': 'https://startamarkets.com/egx'
          }
        });
        if (!up.ok) throw new Error('sa-' + up.status);
        const raw = await up.json();
        /* ⛔ الحد الأدنى ٢٥ (مش ٢٠) — نفس حدّ المحرك. بالحد القديم
           ⛌   IRAX (٢٠ شمعة) كان يعدّي من الـworker ويرجّع null بعدين
           ⛌   ⇒ كارت فاضي من غير سبب. */
        if (!Array.isArray(raw) || raw.length < 25) throw new Error('no data');
        const out = [];
        for (let i = Math.max(0, raw.length - n); i < raw.length; i++) {
          const c = raw[i];
          try {
            /* ⚠️ الإغلاق **المعدّل** (adj_close) لما يتوفّر — التوزيعات
               والتجزئة بتخلي الإغلاق الخام غلط. (لو مفيش adj_close ⇒ خام) */
            const close = (c.adj_close != null && isFinite(Number(c.adj_close)))
              ? Number(c.adj_close) : Number(c.close);
            out.push({
              t: c.date, o: +Number(c.open).toFixed(4), h: +Number(c.high).toFixed(4),
              l: +Number(c.low).toFixed(4), c: +close.toFixed(4), v: Math.round(c.volume || 0)
            });
          } catch (e) { }
        }
        /* ⛔⛔ حارس البيانات القديمة (حرجة): مثال TOUR آخر شمعة ٢٠١٧-٠٤-٠٢
           ⇒ الكارت بيحسب مستويات على بيانات ٩ سنين والسعر الظاهر ١٠.٠٠.
           ⇒ هنا بنرتّب ونعلّم العمر، والواجهة بتعرض سبب واضح. */
        const lastDate = out.length ? String(out[out.length - 1].t) : '';
        const lastMs = lastDate ? Date.parse(lastDate) : NaN;
        const ageDays = isFinite(lastMs) ? Math.floor((Date.now() - lastMs) / 86400000) : null;
        const res = new Response(JSON.stringify({
          ok: true, code: code, count: out.length, candles: out,
          ageDays: ageDays, stale: !!(ageDays != null && ageDays > 10)
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=600',
            'Access-Control-Allow-Origin': '*'
          }
        });
        if (cache) { try { await cache.put(ck, res.clone()); } catch (e) { } }
        return res;
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'candles-failed', msg: String(e && e.message || e) }),
          { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
    }

    /* 1) proxy للـAPI (نفس origin عشان نتفادى CORP same-site) */
    if (url.pathname.startsWith('/api/')) {
      /* ⛔⛔ الجسور بتاعت المعاينة (tvscan/tvcandles) **ما بتروحلش**
         ⛌   للـAPI الميت — لو حصل خطأ جواها (أو نشر جديد لسه
         ⛌   بيتملّد) كانت بيروحوا للباك (Railway) ⇒ 405/503 HTML
         ⛌   والصفحة بتكسر. ⛌ هنا بنرجّع JSON نضيف. */
      if ((url.pathname === '/api/tvscan' || url.pathname === '/api/tvcandles') &&
        !(env && env.OCTA_TV_PROXY === 'on')) {
        return new Response(JSON.stringify({ ok: false, error: 'bridge-off', msg: 'الجسر مش شغال' }),
          { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      const target = API + url.pathname + url.search;
      const init = {
        method: request.method,
        headers: buildHeaders(request)
      };
      /* ⛔⛔ جسم الطلب — كان بيضيع خالص!
         ⛌ يعني كل POST (chat · analyze · charts · auth) كان
         ⛌ بيوصل للباك من غير body. */
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          const buf = await request.arrayBuffer();
          if (buf && buf.byteLength) init.body = buf;
        } catch (e) { }
      }
      try {
        const upstream = await fetchApi(target, init);
        const body = await upstream.text();
        const out = new Headers();
        out.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
        /* ⛔⛔⛔ Set-Cookie — كان بيضيع!
           ⛌ ده كوكي الجلسة HttpOnly — من غير ما يوصل للصفحة
           ⛌ مفيش جلسة أصلاً والبوابة هتفضل قايمة للأبد. */
        const sc = upstream.headers.get('Set-Cookie');
        if (sc) out.set('Set-Cookie', sc);
        out.set('Cache-Control', 'no-store');
        /* ⛔⛔⛔ ضغط الردود الكبيرة (gzip) — ٢٣ أكتوبر ٢٠٢٦
           📌 المشكلة: ردود الـAPI كانت **من غير أي ضغط** (ولا
             Content-Encoding) ⇒ الرادار ٤٩٢ ك.ب لكل دفعة × ٨
             دفعات = ~٤ ميجا على موبايل ⇒ «البيانات بتتأخر».
           📌 الحل: نضغط هنا بـCompressionStream (مضغوط natively
             ⇒ رخيص جداً في CPU) والمتصفح بيفكّ الضغط لوحده.
           ⛌ بنضغط بس الردود الكبيرة (فوق ٢٠ ك.ب) — الردود الصغيرة
             بتاخد CPU من غير فايدة.
           ⛌ ومفيش Content-Length (الرد بيطلع chunked) — صح. */
        try {
          const acceptEnc = String(request.headers.get('Accept-Encoding') || '');
          if (body.length > 20000 && acceptEnc.indexOf('gzip') >= 0) {
            const cs = new CompressionStream('gzip');
            const stream = new Blob([body]).stream().pipeThrough(cs);
            out.set('Content-Encoding', 'gzip');
            out.delete('Content-Length');
            return new Response(stream, { status: upstream.status, headers: out });
          }
        } catch (e) {
          /* ⛔ الضغط فاشل ⇒ نرجع للرد العادي (مفيش كسر) */
        }
        return new Response(body, { status: upstream.status, headers: out });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'api-proxy-failed', message: String(e && e.message || e) }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    /* 2) 🚪 البوابة — صفحة التطبيق من غير جلسة = صفحة البوابة
       ⛔⛔ مفتاح التحويل: env.OCTA_GATE = 'off' ⇐ البوابة مقفولة.
       ⛌ دلوقتي (قبل ما الـAPI الجديد يتنشر) البوابة مقفولة في
       ⛌   المعاينة: لأن الـAPI القديم مش بيرجّع كوكي الجلسة
       ⛌   (NameError في _json_auth) ⇒ أي حد هيفضل في البوابة
       ⛌   للأبد. ⇒ المعاينة بتاخد التطبيق زي ما كان، والبوابة
       ⛌   بتتفتح مع الـAPI الجديد.
       ⛌ صفحة البوابة نفسها متاحة دايماً على /gate.html. */
    const GATE_ON = !(env && env.OCTA_GATE === 'off');
    const isGatePage = GATE_ON && GATE_PAGES.indexOf(url.pathname) !== -1;
    if (isGatePage && !hasSession(request)) {
      try {
        const gateUrl = new URL('/gate.html', url);
        const gate = await env.ASSETS.fetch(new Request(gateUrl.toString(), request));
        if (gate && gate.status < 400) {
          const h = new Headers(gate.headers);
          h.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
          return new Response(gate.body, { status: 200, headers: h });
        }
      } catch (e) { }
    }

    /* 3) static assets (الصور/HTML/CSS/JS) */
    /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ الـJS: no-store صريح
     📌 السبب: Cloudflare Assets كان بيعمل cache للـJS
     📌 ⛌ ⛌ ⛌ ⛌ (cf-cache-status: HIT) ⇒ المتصفح بيشغّل نسخة
     📌 ⛌ ⛌ ⛌ ⛌ قديمة من octa-gate.js ⇒ المستخدم بيفضل يشوف
     📌 ⛌ ⛌ ⛌ ⛌ نفس المشكلة («طلبت ٣ أكواد» + البوابة القديمة).
     📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
     📌 ✅ الحل: نعمل fetch للـJS ونضيف cache-control صريح.
     📌 ✅ (نفس الشغل في الـworker — أكتر موثوق من _headers)
     */
    if (/\.(js|mjs|css)$/.test(url.pathname)) {
      const res = await env.ASSETS.fetch(request);
      const h = new Headers(res.headers);
      /* ⛌⛌⛌ لازم نمسح كل الـcache-control القديم ونحط واحد
       📌 ⛌ ⛌ ⛌ (لأن الـ_headers بيحط ٣ قواعد متلاصقة)
       📌 ⛌ ⛌ ⛌ ⛌ ⇒ لازم نعمل delete قبل set
       📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
       h.delete('Cache-Control');
       h.delete('Pragma');
       h.delete('Expires');
       h.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
       h.set('Pragma', 'no-cache');
       h.set('Expires', '0');
       h.set('ETag', '"' + Date.now() + '"');
       return new Response(res.body, { status: res.status, headers: h });
    }
    return env.ASSETS.fetch(request);
  }
};
