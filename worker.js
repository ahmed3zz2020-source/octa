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

/* ══════════════════════════════════════════════════════════════
   ⭐⭐⭐ خريطة رموز TradingView → Yahoo Finance
   ──────────────────────────────────────────────────────────────
   📌 ٢٥ أكتوبر ٢٠٢٦ — جسر الأسعار (أذهب · دولار ·.normalize
   ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
   ⛌ ⛌ ⛌ ⛌ ⛌ tradingview-widget.com بيقاوم على داتاسنتر (403 bot)
   ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ Yahoo chart API هو المصدر البديل
   ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
   📌 Yahoo symbol: GC=F (ذهب) · EGP=X (دولار) · ^EGX30 (مؤشر مصر)
   ⛌ ⛌ ⛌ ⛌ ⛌ CL=F (نفط WTI) · BZ=F (برنت)
   ══════════════════════════════════════════════════════════════ */
const TV_TO_YAHOO = {
  'OANDA:XAUUSD': 'GC=F',
  'OANDA:XAGUSD': 'SI=F',
  'EGP=X': 'EGP=X',
  'EGX:EGX30': '^EGX30',
  'EGX:EGX20': '^EGX20',
  'EGX:EGX100': '^EGX100',
  'TVC:USOIL': 'CL=F',
  'TVC:UKOIL': 'BZ=F',
  'NYMEX:CL1!': 'CL=F',
  'TVC:GOLD': 'GC=F',
  'TVC:UKOIL.C': 'BZ=F',
  'CAPITALCOM:GOLD': 'GC=F',
  'PEPPERSTONE:GOLD': 'GC=F',
  'OANDA:WTICOUSD': 'CL=F',
  'OANDA:BCOUSD': 'BZ=F',
  'FOREXCOM:XAUUSD': 'GC=F',
  'TVC:DXY': 'DX-Y.NYB',
  'INDEX:EGX30': '^EGX30',
  'EGX:EGX30P': '^EGX30'
};

function tvToYahoo(sym) {
  const s = String(sym || '').trim();
  if (!s) return null;
  if (TV_TO_YAHOO[s]) return TV_TO_YAHOO[s];
  const up = s.toUpperCase();
  if (TV_TO_YAHOO[up]) return TV_TO_YAHOO[up];
  /* سهم مصري عادي (COMI.CA) → Yahoo ticker */
  if (/^[A-Z0-9]+\.CA$/i.test(s)) return s.toUpperCase();
  /* أي symbol تاني بـ : → نجرب الجزء التاني */
  const parts = s.split(':');
  if (parts.length === 2) {
    const p2 = parts[1].toUpperCase();
    if (/^[A-Z0-9]+\.CA$/i.test(p2)) return p2;
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
   ⭐⭐⭐ محلّل RSS بسيط (regex) — شكل rss2json
   ──────────────────────────────────────────────────────────────
   📌 بنرجّع {status, items:[{title,link,pubDate,description,categories}]}
   ⛌ ⛌ ⛌ ⛌ ⛌ بالظبط زي rss2json ⇒ الـJS مش محتاج يتغير.
   ══════════════════════════════════════════════════════════════ */
function xmlUnescape(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
function xmlTag(xml, tag, block) {
  const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  const m = block.match(re);
  return m ? xmlUnescape(m[1]).trim() : '';
}
function parseRssItems(xml) {
  const out = [];
  const s = String(xml || '');
  const blocks = s.match(/<item[\s>][\s\S]*?<\/item>/gi) || s.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (let i = 0; i < blocks.length && out.length < 30; i++) {
    const b = blocks[i];
    let link = xmlTag(b, 'link');
    if (!link) {
      const m = b.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (m) link = xmlUnescape(m[1]);
    }
    const title = xmlTag(b, 'title');
    if (!title) continue;
    out.push({
      title: title,
      link: link,
      pubDate: xmlTag(b, 'pubDate') || xmlTag(b, 'published') || xmlTag(b, 'updated') || '',
      description: xmlTag(b, 'description') || xmlTag(b, 'summary') || '',
      categories: []
    });
  }
  return out;
}

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

/* ⛔⛔ ٢٧ أكتوبر ٢٠٢٦ — مهلة البروبكاي (كانت ٨ ثواني × ٣ = ٢٤ ثانية!)
   📌 الغرض: لو الـRailway بطيء/ واقع، الطلب يرجع بسرعة والواجهة
   📌   تعيد المحاولة بنفسها ⇒ المستخدم بيشوف «بنحاول تاني» بدل صفحة ميتة. */
const PROXY_TIMEOUT_MS = 6000;
/* ⛔ ٢٩ أكتوبر ٢٠٢٦ — ٣ محاولات بدل ٢.
   📌 السبب: أول طلب بعد فترة سكون ⇒ الـAPI بيعمل cold start
   📌   (≈١٢ ثانية) ⇒ المحاولة الأولى بتـtimeout ⇒ 502 والمستخدم
   📌   واقف قدام شاشة تحميل.
   ✅ الحل: ٣ محاولات × ٦ ثواني ⇒ المحاولة التانية بتلاقي السيرفر
   ✅   دافي وبترد في ثانية ⇒ البيانات بتوصل بدل ما تفشل. */
const PROXY_TRIES = 3;

/* 🔁 جلب من الـAPI مع إعادة محاولة — الخطأ البسيط بيتراجع لوحده */
async function fetchApi(target, init) {
  let lastErr = null;
  for (let i = 0; i < PROXY_TRIES; i++) {
    try {
      /* ⛔⛔ ٢٢ أكتوبر ٢٠٢٦ — مهلة ٨ ثواني لكل محاولة.
      ⛌ الباك (Railway) واقع ⇒ الطلب كان بيقعد دقيقة لحد ما
      ⛌   يرد 502 ⇒ المستخدم واقف قدام شاشة تحميل.
      ⛌ دلوقتي بنقطعه بسرعة ونرجّع 502 — الواجهة بتعرف تتعامل. */
      const o = Object.assign({}, init || {});
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
        /* ⛔⛔ ٢٧ أكتوبر ٢٠٢٦ — ٨ ثواني × ٣ محاولات = ٢٤ ثانية!
           📌 الطلب كان بيقعد نص دقيقة والواجهة كانت بتقطع بعد ٨ ثواني
           ⇒ المستخدم بيشوف «السيرفر بطيء» وصفحة فاضية.
           📌 ✅ الحل: ٦ ثواني × محاولتين = ~١٢ ثانية كحد أقصى.
           📌 (المسارات الكبيرة زي /api/gold/history بترد في أقل من ثانيتين
           📌  من السيرفر — فالمهلة دي أمان مش حدّ للصفحات الكبيرة). */
        o.signal = AbortSignal.timeout(PROXY_TIMEOUT_MS);
      }
      const r = await fetch(target, o);
      if (r.status >= 500 && i < PROXY_TRIES - 1) {
        lastErr = new Error('upstream ' + r.status);
        await sleep(180 * (i + 1));
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (i < PROXY_TRIES - 1) await sleep(180 * (i + 1));
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


/* ════════════════════════════════════════════════════════════════
 🔄 ⭐ ٢٥ أكتوبر ٢٠٢٦ — fetch من الـAssets بدون كاش
 ────────────────────────────────────────────────────────────────
 📌 السبب: Cloudflare Assets بيعمل cache للـHTML/JS (cf-cache-status: HIT)
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⇒ المستخدم بيفتح نسخة قديمة (bootstrap مفقود · إصلاحات مفقودة)
 📌 ✅ الحل: header `Cache-Control: no-cache` في الطلب ⇒ الـedge يعمل bypass
 ════════════════════════════════════════════════════════════════ */
async function assetsFresh(env, request) {
  const r = new Request(request.url, request);
  const _url = new URL(request.url);
  const h = new Headers(r.headers);
  h.set('Cache-Control', 'no-cache');
  h.set('Pragma', 'no-cache');
  /* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐ bypass كامل للـedge cache
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ⛌ ⛌.cf.cacheEverything=false + cacheTtl=0 ⇒ المتصفح/الـedge
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ✅ + نضيف cache-bust في الـURL (عشان نضمن التفرّد)
  📌 ✅ + Cache-Control: no-cache في الـresponse (عشان المتصفح مبيكاشش)
  */
  /* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐ الـAssets بتخدم النسخة المعبّأة صح.
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ⛌ ⛌ (الـcf-cache-status: HIT ده كاش داخلي للـAssets — طبيعي،
  📌 ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
  📌 ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
  📌 ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
  📌 ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
  📌 ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
  📌 ⛌ ⛌ ⛌⇒ والـbust بالـquery بيدّي 404 (الـAssets مش بتقبله)).
  📌 ✅ الحل: bust بسيط بالـtimestamp — ونتعامل مع 404 بالfallback.
  */
  /* ⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐ '/' مش asset ⇒ 404. نحوّله index.html
  📌 (والـgate.html بيتخدم من المسار التاني في الـworker — شوف فوق) */
  let bust = _url.pathname;
  if (bust === '/' || bust === '') bust = '/index.html';
  bust = bust + (_url.search || '');
  try {
  /* ════════════════════════════════════════════════════════════════
  ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ عنوان مطلق (مش نسبي) — إصلاح 404 فاضي
  ────────────────────────────────────────────────────────────────
  📌 السبب: `new Request('/index.html')` في رَن-times الـWorker
  📌 ⛌⛌⛔ بيرمي استثناء (عنوان نسبي من غير base) ⇒ الـcatch
  📌 ⛌⛌⛔ بيرجّع الطلب الأصلي ⇒ '/' بيرجّع 404 فاضي (0 بايت)
  📌 ⛌⛌⛔ ⇒ المعاينة (البوابة مقفولة هناك) مش بتفتح خالص!
  📌 ✅ الحل: نحَلّ المسار مقابل عنوان الطلب قبل الـfetch.
  📌 (الإنتاج ما تأثّرش: '/' بيروح لصفحة البوابة قبل النقطة دي)
  ════════════════════════════════════════════════════════════════ */
  const bustUrl = new URL(bust, request.url);
  return await env.ASSETS.fetch(new Request(bustUrl.toString(), { method: 'GET', headers: h }));
  } catch (e) {
  return env.ASSETS.fetch(new Request(r, { headers: h }));
  }
}

export default {
  /* ══════════════════════════════════════════════════════════════
   🛡️ ⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ هيدرات الأمان على كل رد
   ────────────────────────────────────────────────────────────────
   📌 المشكلة: مافيش ولا هيدر أمان واحد كان بيتقدّم من Cloudflare.
   📌 ⛔⛔⛔ ⇒ ولا X-Content-Type-Options (نوع المحتوى بيتخمن)
   📌 ⛔⛔⛔ ⇒ ولا X-Frame-Options (الصفحة تتحط في iframe)
   📌 ⛔⛔⛔ ⇒ ولا Referrer-Policy (الـReferer بيسرّب روابط)
   📌 ⛔⛔⛔ ⇒ ولا Permissions-Policy (الكاميرا/المايك/GPS)
   📌 ⛔⛔⛔ ⇒ ولا HSTS.
   📌 📌 السبب إن `_headers` مالوش تأثير مع `run_worker_first: true`
   📌 📌 ⛌⛌⛌ (الـworker بيرد الأول ⇒ هو اللي بيمسك الرد).
   📌 ✅ الحل: غلاف واحد على كل رد — مفيش استثناء ممكن ينسى.
   ══════════════════════════════════════════════════════════════ */
  async fetch(request, env, ctx) {
    let res;
    try {
      res = await handle(request, env, ctx);
    } catch (e) {
      res = new Response(JSON.stringify({ ok: false, error: 'worker-failed' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      const h = new Headers(res.headers);
      h.set('X-Content-Type-Options', 'nosniff');
      h.set('X-Frame-Options', 'DENY');
      h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      h.set('Permissions-Policy',
        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), ' +
        'magnetometer=(), accelerometer=(), gyroscope=()');
      h.set('Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload');
      h.set('Cross-Origin-Opener-Policy', 'same-origin');
      h.set('Cross-Origin-Resource-Policy', 'same-origin');
      /* ⛌⛌⛌ CORP على ردود الـAPI: الباك بيرد
         ⛌⛌⛌ cross-origin-resource-policy: same-site والـworker
         ⛌⛌⛌ بيربط الأصول ⇒ ما نكسرش الـfetch من workers.dev. */
      try {
        const p = new URL(request.url).pathname;
        if (p.indexOf('/api/') === 0
          && h.get('Content-Type')
          && h.get('Content-Type').indexOf('application/json') === 0) {
          h.set('Cross-Origin-Resource-Policy', 'same-site');
        }
      } catch (e) { }
      /* 🧹 رابط التنظيف (?clean=1) — ٢٩ أكتوبر ٢٠٢٦
         📌 كاشف شامل: كوكيز + كاش + localStorage + service workers.
         📌 ⛔ كروم بيتجاهل الهيدر في الأجزاء الفرعية ⇒ لازم navigation.
         📌 بنحطه على أي رد HTML (بوابة · رئيسية · SPA). */
      try {
        const cu = new URL(request.url);
        if (cu.searchParams.get('clean') === '1') {
          const ct = h.get('Content-Type') || '';
          if (ct.indexOf('text/html') !== -1) h.set('Clear-Site-Data', '"*"');
        }
      } catch (e) { }
      return new Response(res.body, { status: res.status, headers: h });
    } catch (e) {
      return res;
    }
  }
};

async function handle(request, env, ctx) {
  const url = new URL(request.url);

  /* ══════════════════════════════════════════════════════════════
  🧹 ٢٩ أكتوبر ٢٠٢٦ — رابط التنظيف: /?clean=1
  ────────────────────────────────────────────────────────────────
  📌 المشكلة: كروم (في المتصفح نفسه) بقى بيفتح شاشة بيضا بعد ما
  📌   المستخدم يعمل «تثبيت» ⇒ كروم سجّل service worker خاص بالتطبيق
  📌   (WebAPK) وبيحبسك على نسخة قديمة/فاضية من الصفحة.
  📌   ⇒ المتصفح التاني شغّال (سجل الـSW منفصل) — وده اللي فاضلنا
  📌   عليه في العزل.
  📌 ✅ الحل: رابط التنظيف بيرجّع الصفحة مع هيدر
  📌   Clear-Site-Data: "*" ⇒ كروم يمسح كل حاجة للموقع:
  📌   الكوكيز · الكاش · localStorage · ⛔ و(service worker) كلهم.
  📌   ⇒ الـSW القديم بيتمسح وبعدها الـSW الجديد (network-first)
  📌   بيسجّل نفسه من أول تحميل.
  ⛔ لازم يكون navigation (فتح صفحة) — كروم بيتجاهل الهيدر في
  ⛔   الأجزاء الفرعية (صور/سكربتات).
  ══════════════════════════════════════════════════════════════ */
  const DO_CLEAN = url.searchParams.get('clean') === '1';

    /* ══════════════════════════════════════════════════════════════
    🛡️ ⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ منع بيانات الإدارة من الوصول العام
    ────────────────────────────────────────────────────────────────
    📌 المشكلة (ثغرة حرجة): مجلد `admin/` كان **منشور بالكامل**
    📌 ⛔⛔⛔ على الإنتاج. و `admin/users.json` فيه:
    📌 ⛔⛔⛔   · إيميلات مستخدمين حقيقية (gmail + octashares)
    📌 ⛔⛔⛔   · أسماء حقيقية
    📌 ⛔⛔⛔   · uid لكل مستخدم
    📌 ⛔⛔⛔ ⇒ https://octashares.com/admin/users.json → HTTP 200
    📌 ⛔⛔⛔ ⇒ أي حد على الإنترنت يقدر ينزّل قاعدة بيانات المستخدمين.
    📌 ✅ الحل (٤ طبقات):
    📌   ① الملف اتشال من git + من البناء (tools/check-dist.js).
    📌   ② الـworker بيرجّع 404 لكل **ملف بيانات** في /admin/.
    📌   ③ الـ_assets نفسها مالهاش الأصل (الملف مش موجود) ⇒ 404 طبيعي.
    📌   ④ الـ_headers بتعمل no-store على /admin/*.
    📌 ⛌⛌⛌ ⭐ قرار المشرف: **صفحات الـHTML تفضل متاحة** (لوحة
    📌 ⛌⛌⛌ الإدارة لازم تفتح) — بس **ملفات البيانات JSON ممنوعة**.
    📌 ⛌⛌⛌ ⇒ نشيل /admin من القائمة السوداء، ونمنع JSON بس.
    ══════════════════════════════════════════════════════════════ */
    if (url.pathname === '/admin' || url.pathname.indexOf('/admin/') === 0) {
      /* ⛔⛔⛔ ملفات البيانات — ممنوعة تماماً (دي اللي فيها PII) */
      const ADMIN_DATA = /\.(json|csv|tsv)$/i;
      if (ADMIN_DATA.test(url.pathname)) {
        return new Response(JSON.stringify({
          ok: false, error: 'المسار ده مش متاح'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
          }
        });
      }
      /* ⛌⛌⛌ صفحات الـHTML — تفضل متاحة (اللوحة لازم تفتح) */
      /* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐ '/admin' ⇒ '/admin/index.html'
      📌 السبب: الأصول بتشتغل بـhtml_handling="none" ⇒ مفيش "/admin"
      📌 ⛌⛌⛔ ⇒ 404 فاضي ⇒ لوحة الإدارة مش بتفتح (كانت ٢٠٠ قبل).
      📌 ✅ الحل: نوجّه '/admin' لـ'/admin/index.html' قبل الـfetch. */
      const adminTarget = (url.pathname === '/admin')
        ? new URL('/admin/index.html', url).toString()
        : url.toString();
      const h2 = new Headers();
      h2.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      h2.set('X-Robots-Tag', 'noindex, nofollow');
      h2.set('Content-Type', 'text/html; charset=utf-8');
      return env.ASSETS.fetch(new Request(adminTarget, request)).then(
        (r) => {
          try {
            const hh = new Headers(r.headers);
            hh.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            hh.set('X-Robots-Tag', 'noindex, nofollow');
            return new Response(r.body, { status: r.status, headers: hh });
          } catch (e) { return r; }
        }
      );
    }

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
      /* ⛔⛔⛔⛔⛔⛔⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
       📌 ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ التنضيف كان **بيمسح** `.CA`!
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ الكود القديم كان:
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌   .replace(/[^A-Z0-9]/g, '')
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ "COMI.CA" بقى "COMICA" ❌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ وبعدين startamarkets ملقاش الرمز ⇒ [] ⇒ 502
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ والبديل "COMI" (من غير CA) كان **بيشتغل**!
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ✅ الحل: نحتفظ بالرمز زي ما هو (حروف + أرقام + نقطة)،
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ونشيل `.CA` قبل طلب startamarkets. */
      const rawCode = (url.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
      const code = rawCode.replace(/\.CA$/, '');
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
        /* 📌 startamarkets.com عايز الرمز **من غير** `.CA` (شِّلناها فوق) */
        const saCode = code;
         const up = await fetch('https://startamarkets.com/api/v1/egx/history/' + saCode, {
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

    /* 1.65) ⭐⭐⭐ /api/bench — مقارنة المصداقية (٢٥ أكتوبر ٢٠٢٦)
       ──────────────────────────────────────────────────────────
       📌 المشكلة اللي اتحلّت: مقارنة «أفضل ٢٠ عندنا» بالمؤشر كانت
       📌 متبنية على حقول جاهزة (Perf.*) من TradingView. وفي حالة
       📌 **المؤشر** المرجع بتاعها مزحزح (شهر ⇒ مرجع 3 شهور ورا)،
       📌 وكمان الصفوف الناقصة (0.00%) كانت بتدخل كعوائد حقيقية.
       📌 ⇒ متوسطغلط في الاتجاهين.

       ✅ الحل: نقارن الطرفبن على **نفس الإغلاقات** و**نفس تواريخ
       📌 المرجع** بالظبط. الواجهة بتحسب تواريخ المرجع من سلسلة
       📌 المؤشر الرسمية، وبتطلب هنا إغلاق كل سهم عند نفس التاريخ.

       📌 المدخل:  ?codes=LUTS,PHTV,…&d1=2026-09-24&d2=2026-04-23&d3=2025-10-23
       📌 المخرج:  {ok, rows:[{code, now, m1:{date,close}, m6:{..}, y1:{..}}]}
       📌 ملاحظة: لو السهم مافتrawlش في تاريخ المرجع ⇒ بناخد آخر
       📌   إغلاق **قبله** (مش صفر!) ⇒ وده الرقم الحقيقي.

       📌 الكاش: نفس مفتاح شموع الأسهم ⇒ الجسور بيشارك الكاش. */
    if (url.pathname === '/api/bench' && env && (env.OCTA_TV_PROXY === 'on' || env.OCTA_BENCH === 'on')) {
      const codes = (url.searchParams.get('codes') || '')
        .toUpperCase().split(',').map(s => s.trim().replace(/[^A-Z0-9]/g, ''))
        .filter(Boolean).slice(0, 30);
      const dates = ['d1', 'd2', 'd3'].map(k => (url.searchParams.get(k) || '').trim());
      if (!codes.length) {
        return new Response(JSON.stringify({ ok: false, error: 'no codes' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const cache = caches && caches.default;
      const N = 400;
      try {
        const rows = await Promise.all(codes.map(async (code) => {
          const ck = new Request('https://octa.internal/v2/tvcandles/' + code + '/' + N, { method: 'GET' });
          let candles = null;
          if (cache) {
            const hit = await cache.match(ck);
            if (hit) { try { const j = await hit.json(); candles = j.candles || null; } catch (e) { } }
          }
          if (!candles) {
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
            if (!Array.isArray(raw) || raw.length < 25) throw new Error('no data');
            candles = [];
            for (let i = Math.max(0, raw.length - N); i < raw.length; i++) {
              const c = raw[i];
              try {
                const close = (c.adj_close != null && isFinite(Number(c.adj_close)))
                  ? Number(c.adj_close) : Number(c.close);
                candles.push({ t: c.date, c: +close.toFixed(4) });
              } catch (e) { }
            }
            if (cache) {
              try {
                const fake = new Response(JSON.stringify({ ok: true, code: code, candles: candles }), {
                  headers: { 'Content-Type': 'application/json' }
                });
                await cache.put(ck, fake);
              } catch (e) { }
            }
          }
          /* آخر إغلاق ≤ كل تاريخ مرجعي */
          const at = (iso) => {
            if (!iso) return null;
            let pick = null;
            for (const c of candles) {
              if (String(c.t) <= iso && (!pick || String(c.t) > String(pick.t))) pick = c;
            }
            return pick ? { date: String(pick.t), close: pick.c } : null;
          };
          const last = candles.length ? candles[candles.length - 1] : null;
          return {
            code: code,
            now: last ? { date: String(last.t), close: last.c } : null,
            m1: at(dates[0]), m6: at(dates[1]), y1: at(dates[2])
          };
        }));
        return new Response(JSON.stringify({ ok: true, rows: rows, dates: dates }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=1800',
              'Access-Control-Allow-Origin': '*'
            }
          });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'bench-failed', msg: String(e && e.message || e) }),
          { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
    }

    /* 1.7) ⭐⭐⭐ جسور CORS لأطراف تالتة — ٢٥ أكتوبر ٢٠٢٦
       ──────────────────────────────────────────────────────────
       📌 المشكلة: المتصفح كان بيطلب:
         · https://www.tradingview-widget.com/api/v1/quote?symbol=…
         · https://api.rss2json.com/v1/api.json?rss_url=…
       ⛌ مباشرة من الـJS ⇒ الـserverين مش بيقبلوا CORS من
       ⛌ دوميننا ⇒ المتصفح بيمنع الرد ⇒ "blocked by CORS".
       ⛌ (وكمان الـocta-api.js كان بيعيد توجيههم للـRailway ⇒ 405)

       ✅ الحل: نجيبهم من الـedge (نفس-origin) ⇒ مفيش CORS خالص.
       ⛌ الكاش على الـedge: ٦٠ ثانية للأسعار · ٣٠٠ ثانية للأخبار.

       📌 ملاحظة مهمة: المسارات دي **مش** من الباك — هي جسر
       ⛌   للـedge بس. ولوWorker واقع، الـJS بيرجع لطلب-party
       ⛌   مباشر (وهو هيفشل CORS برضه ⇒ الأرقام تفضل «---»).
       ⛌   ⇒ مفيش ضرر أمني: البيانات دي عامة ومفتوحة أصلاً. */
    if (url.pathname === '/api/tvquote') {
      const sym = (url.searchParams.get('symbol') || '').trim();
      if (!sym) {
        return new Response(JSON.stringify({ ok: false, error: 'no symbol' }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      const ck = new Request('https://octa.internal/v2/tvquote/' + encodeURIComponent(sym), { method: 'GET' });
      const cache = caches && caches.default;
      if (cache) {
        const hit = await cache.match(ck);
        if (hit) return hit;
      }
      try {
        /* ⛔⛔⛔⛔⛔⛔⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
         📌 ٢٥ أكتوبر ٢٠٢٦ — tradingview-widget.com **مش** بيقبل
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ الطلب من داتاسنتر (403 Cloudflare bot
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ protection) ⇒ جسر الـworker مش هينفع.
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         ✅ البديل: **Yahoo Finance chart API** — شغّال ٢٠٠ من الـedge
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         ⛌ ⛌ ⛌ ⛌ ⛌ (بي conversion map من TradingView symbol لـ Yahoo).
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         📌 وبنرجّع **بنفس الشكل** اللي الـJS متوقعه
         ⛌ ⛌ ⛌ ⛌ ⛌ (data.v.lp / data.v.ch) ⇒ مفيش تعديل في الـJS. */
        const ySym = tvToYahoo(sym);
        if (!ySym) throw new Error('unmapped symbol: ' + sym);
        const up = await fetch(
          'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ySym) + '?range=5d&interval=1d',
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120', 'Accept': 'application/json' } }
        );
        if (!up.ok) throw new Error('yahoo ' + up.status);
        const raw = await up.json();
        const meta = raw && raw.chart && raw.chart.result && raw.chart.result[0] && raw.chart.result[0].meta;
        if (!meta) throw new Error('no meta');
        const price = Number(meta.regularMarketPrice);
        const prev = Number(meta.chartPreviousClose != null ? meta.chartPreviousClose : meta.previousClose);
        if (!isFinite(price) || price <= 0) throw new Error('bad price');
        const chg = isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : 0;
        const body = {
          ok: true, source: 'yahoo', symbol: sym, yahoo: ySym,
          v: { lp: price, ch: +chg.toFixed(4), chp: +chg.toFixed(4), volume: meta.regularMarketVolume || 0 }
        };
        const res = new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
            'Access-Control-Allow-Origin': '*'
          }
        });
        if (cache) { try { await cache.put(ck, res.clone()); } catch (e) { } }
        return res;
      } catch (e) {
        /* ⛔⛔⛔⛔⛔⛔⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
         📌 Yahoo مش عنده مؤشرات EGX (EGX30 · EGX20 · EGX100) ⇒ 404.
         ✅ Fallback: **سكانر TradingView** (شغّال ٢٠٠ من الـedge) — جسر
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         📌 بيبعت ticker صريح للـscanner (EGX:EGX30) وبيرجّع السعر. */
        try {
          const tv = await fetch('https://scanner.tradingview.com/global/scan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              symbols: { tickers: [sym] },
              columns: ['close', 'change', 'volume', 'name']
            })
          });
          if (tv.ok) {
            const t = await tv.json();
            const d = t && t.data && t.data[0];
            if (d && d.d && d.d.length >= 2 && isFinite(Number(d.d[0]))) {
              const p2 = Number(d.d[0]);
              const c2 = Number(d.d[1]);
              const body2 = {
                ok: true, source: 'tradingview', symbol: sym,
                v: { lp: p2, ch: c2, chp: c2, volume: d.d[2] || 0 }
              };
              const res2 = new Response(JSON.stringify(body2), {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'public, max-age=60',
                  'Access-Control-Allow-Origin': '*'
                }
              });
              if (cache) { try { await cache.put(ck, res2.clone()); } catch (e2) { } }
              return res2;
            }
          }
        } catch (e2) { }
        return new Response(JSON.stringify({ ok: false, error: 'tvquote-failed', msg: String(e && e.message || e) }),
          { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    if (url.pathname === '/api/rss') {
      const rss = (url.searchParams.get('url') || '').trim();
      if (!rss) {
        return new Response(JSON.stringify({ ok: false, error: 'no url' }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      /* ⛔⛔⛔ حماية SSRF — مينفعش نخلي الـworker يجيب أي URL.
         ⛌   بنسمح بس بنطاقات RSS معروفة ( Yahoo · Google News ). */
      let allowed = false;
      try {
        const h = new URL(rss).hostname;
        allowed = /(^|\.)(yahoo\.com|finance\.yahoo\.com|feeds\.finance\.yahoo\.com|news\.google\.com|google\.com)$/i.test(h);
      } catch (e) { }
      if (!allowed) {
        return new Response(JSON.stringify({ ok: false, error: 'rss host not allowed' }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      const ck = new Request('https://octa.internal/v2/rss/' + encodeURIComponent(rss), { method: 'GET' });
      const cache = caches && caches.default;
      if (cache) {
        const hit = await cache.match(ck);
        if (hit) return hit;
      }
      try {
        /* ⛔⛔⛔⛔⛔⛔⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
         📌 ٢٥ أكتوبر ٢٠٢٦ — rss2json.com **مش** بيقبل الطلب من
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ داتاسنتر (403 Cloudflare bot protection)
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ جسر الـworker مش هينفع كده.
         ✅ البديل: نجيب الـRSS **مباشرة** (news.google.com بيقبل ٢٠٠
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ من الـedge) ونحلّله **هنا** بـregex
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ ونرجّع **بنفس الشكل** اللي
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ rss2json كان بيرجّعه
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ({status, items:[{title,link,pubDate,description}]})
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ مفيش أي تعديل في الـJS. */
        const up = await fetch(rss, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
            'Accept': 'application/rss+xml,application/xml,text/xml,*/*'
          }
        });
        if (!up.ok) throw new Error('feed ' + up.status);
        const xml = await up.text();
        const items = parseRssItems(xml);
        if (!items.length) throw new Error('feed empty');
        const body = { status: 'ok', items: items };
        const res = new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
            'Access-Control-Allow-Origin': '*'
          }
        });
        if (cache) { try { await cache.put(ck, res.clone()); } catch (e) { } }
        return res;
      } catch (e) {
        /* ⛔⛔⛔⛔⛔⛔⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
         📌 ٢٥ أكتوبر ٢٠٢٦ — news.google.com بيرجّع **503** للـedge
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ (بيحجب نطاقات Cloudflare) ⇒ يا إما نجرّب
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ مصدر تاني، يا إما نرجّع **فاضي**
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ (degrade) بدل ما نكسر الصفحة.
         ✅ Fallback: rss2json.com (شغال أحياناً) ⇒ لو هيك ⇒ نرجّع فاضي
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ بأمان (٢٠٠ مش ٥٠٢) — الـJS بيتعامل
         ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ مع items=[] فاضي بهدوء. */
        try {
          const alt = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rss), {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
              'Accept': 'application/json,text/plain,*/*'
            }
          });
          if (alt.ok) {
            const txt = await alt.text();
            const res = new Response(txt, {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300',
                'Access-Control-Allow-Origin': '*'
              }
            });
            if (cache) { try { await cache.put(ck, res.clone()); } catch (e2) { } }
            return res;
          }
        } catch (e2) { }
        /* ⛔ آخر حاجة: فاضي بأمان (٢٠٠) — الـJS مش هيعمل error */
        return new Response(JSON.stringify({ status: 'error', items: [], ok: false, msg: String(e && e.message || e) }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
            'Access-Control-Allow-Origin': '*'
          }
        });
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
        if (sc) {
          /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐⭐ الـSet-Cookie كان
           📌 بيتحفظ على دومين Railway (octa-prices-production-4ccb
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ .up.railway.app) — والمتصفح
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ⇒ ⛔⛔⛌ المتصفح **بيرفضها** (دومين غلط) ⇒ مفيش كوكي
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ⇒ ⛔⛔⛌ ⇒ /api/auth/me رجّع 401 ⇒ البوابة بعد كل
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ✅ الحل: نشيل الـDomain attribute ⇒ الكوكي يتحفظ على
           📌 ✅ دومين الموقع (octashares.com) — زي ما المتصفح بيعمل
           📌 ✅ للـhost-only cookies.
           📌 ✅ ونضيف SameSite=None + Secure عشان يتبعت دايماً.
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
           📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
          let sc2 = sc.replace(/;\s*Domain=[^;]*/gi, '');
          if (!/SameSite/i.test(sc2)) sc2 += '; SameSite=None';
          if (!/Secure/i.test(sc2)) sc2 += '; Secure';
          out.set('Set-Cookie', sc2);
        }
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
        /* ════════════════════════════════════════════════════════════════
        ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ إيقاف الضغط المزدوج (gzip×٢) — قاتل!
        ────────────────────────────────────────────────────────────────
        📌 المشكلة: الـworker كان بيضغط الردود الكبيرة بـgzip،
        📌 والـCloudflare edge بيضغط كمان ⇒ gzip×٢.
        📌 ⇒ المتصفح بيفكّ مرة واحدة ⇒ يفضل gzip خام ⇒ res.json() بيفشل
        📌 ⇒ OS_DB فاضي ⇒ **كل الأدوات والفلاتر بتقول «جاري التحميل»!**
        📌 ✅ الحل: مافيش ضغط في الـworker — Cloudflare بيضغط صح لوحده
        📌 (وكمان بيسرّع التحميل — مفيش CPU ضاغطة على الرادار).
        ════════════════════════════════════════════════════════════════ */
        out.delete('Content-Encoding');
        out.delete('Content-Length');
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
          if (DO_CLEAN) h.set('Clear-Site-Data', '"*"');
          return new Response(gate.body, { status: 200, headers: h });
        }
      } catch (e) { }
    }

    /* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ '/' ⇒ '/index.html' (مباشر)
    📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
    📌 ⛌ ⛌ السبب: env.ASSETS.fetch('/') بيرجّع 404 (مافيش asset اسمه '/')
    📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
    📌 ⛌ ⛌ ⇒ والمستخدم المسجّل بياخد 404 على '/' ⇒ الموقع مش بيفتح!
    📌 ✅ الحل: نعمل fetch لـ'/index.html' مباشرة.
    */
    if (url.pathname === '/' && hasSession(request)) {
      try {
        const idxUrl = new URL('/index.html', url);
        const idx = await env.ASSETS.fetch(new Request(idxUrl.toString(), request));
        if (idx && idx.status < 400) {
          const ih = new Headers(idx.headers);
          ih.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
          ih.set('Pragma', 'no-cache');
          ih.set('Expires', '0');
          /* ════════════════════════════════════════════════════════════
          ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ مسح كاش المتصفح (مرة واحدة)
          ────────────────────────────────────────────────────────────
          📌 السبب: المستخدم كان شايف نسخة قديمة من الـJS (كاش
          📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
          📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
          📌 ⛌ ⛌ رغم إن السيرفر فيه النسخة الجديدة.
          📌 ✅ الحل: Clear-Site-Data: "cache" — يمسح الكاش بس
          📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
          📌 ⛌ ⛌ (مش الـcookies — الجلسة تفضل شغالة).
          📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
          📌 ⚠️ بنحطه بس لو الإصدار مختلف ⇒ مرة واحدة وبعدها يختفي.
          ════════════════════════════════════════════════════════════ */
          /* ════════════════════════════════════════════════════════════
          ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ مسح كاش المتصفح (مرة واحدة بس)
          ────────────────────────────────────────────────────────────
          📌 المشكلة: المتصفح كاش نسخة قديمة من الـJS رغم إن
          📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
          📌 ⛌ ⛌ السيرفر فيه النسخة الجديدة (متأكد بالـmd5).
          📌 ✅ الحل: Clear-Site-Data: "cache" — مسح الكاش بس
          📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
          📌 ⛌ ⛌ (مش الـcookies — الجلسة تفضل شغالة).
          📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
          📌 ⚠️ بنحطه مرة واحدة بس — لحد ما كل المستخدمين يحدّثوا.
          ════════════════════════════════════════════════════════════ */
          const WANT_CLEAR = '202610250945';
          if (!request.headers.get('X-OCTA-Cleared-' + WANT_CLEAR)) {
          ih.set('Clear-Site-Data', '"cache"');
          }
          ih.set('ETag', '"' + Date.now() + '"');
          return new Response(idx.body, { status: 200, headers: ih });
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
    /* ⛔⛔⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ الـHTML كمان — no-store صريح
    📌 السبب: Cloudflare Assets كان بيعمل cache للـindex.html
    📌 ⛌ ⛌ ⛌ (cf-cache-status: HIT) ⇒ المستخدم بيفتح نسخة قديمة
    📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
    📌 ⛌ ⛌ ⛌ ⛌ ⇒ التحديثات الجديدة ما بتوصلش (bootstrap مفقود).
    📌 ✅ الحل: نفس الـJS — fetch + no-store.
    */
    /* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — روابط مباشرة للصفحات
    📌 السبب: `/markets` و `/stocks` بيرجعوا 404 (مفيش ملفات HTML منفصلة —
    📌 كل الصفحات SPA جوه index.html). ⛔ المستخدم طلب يقدر يفتح
    📌 «لوحة الأسواق» من غير ما يرجع بالزر.
    ✅ الحل: أي مسار صفحة معروف ⇒ نخدّم index.html (نفس الـSPA).
    */
    /* ⭐ كل المسارات دي بتقابل TOOL_PAGES في octa-core.js */
    const SPA_ROUTES = ['/markets', '/stocks', '/tools', '/engine', '/arms', '/filters',
      '/filter', '/best', '/screener', '/dividends', '/octasearch', '/verdict', '/pick',
      '/compare', '/radar', '/smartmoney', '/money', '/news', '/academy', '/watchlist',
      '/search', '/calc', '/bestpick', '/radar-stock'];
    if (SPA_ROUTES.indexOf(url.pathname) !== -1) {
      const res = await assetsFresh(env, new Request(new URL('/index.html', url), request));
      const h = new Headers(res.headers);
      h.delete('Cache-Control'); h.delete('Pragma'); h.delete('Expires');
      h.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      h.set('Pragma', 'no-cache'); h.set('Expires', '0');
      h.set('ETag', '"' + Date.now() + '"');
      return new Response(res.body, { status: 200, headers: h });
    }
    if (/\.(html?)$/.test(url.pathname) || url.pathname === '/' || url.pathname === '/index.html') {
      const res = await assetsFresh(env, request);
      const h = new Headers(res.headers);
      h.delete('Cache-Control');
      h.delete('Pragma');
      h.delete('Expires');
      h.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      h.set('Pragma', 'no-cache');
      h.set('Expires', '0');
      h.set('ETag', '"' + Date.now() + '"');
      /* ⭐ مسح كاش المتصفح — مرة واحدة (لحد ما كل المستخدمين يحدّثوا) */
      try {
      const WANT = '202610250945';
      if (!request.headers.get('X-OCTA-Cleared-' + WANT)) h.set('Clear-Site-Data', '"cache"');
      } catch (e) { }
      /* 🧹 رابط التنظيف (?clean=1) ⇒ مسح كل حاجة للموقع */
      if (DO_CLEAN) h.set('Clear-Site-Data', '"*"');
      return new Response(res.body, { status: res.status, headers: h });
    }
    if (/\.(js|mjs|css)$/.test(url.pathname)) {
      const res = await assetsFresh(env, request);
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

    /* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ خريطة الصفحات (لازم!)
       ──────────────────────────────────────────────────────────
       📌 الأصول بتشتغل بـhtml_handling="none" (عشان الـworker
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ يعني مفيش تحويل تلقائي:
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ / ⇐ index.html   (وإلا 404 فاضي)
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ /chart ⇐ chart.html (وكمان)
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ✅ الحل: نعمل الخريطة هنا — بالظبط زي ما Cloudflare كان
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
    const PAGE_MAP = {
      '/': '/index.html',
      '/chart': '/chart.html',
      '/gate': '/gate.html',
      /* ⛔ '/admin' — ٢٥ أكتوبر ٢٠٢٦: الصفحة نفسها تفضل متاحة
         ⛌ (قرار المشرف — لوحة الإدارة لازم تفتح)، بس ملفات
         ⛌ البيانات (JSON/CSV) مرفوضة من فوق (404). */
      '/admin': '/admin/index.html'
    };
    if (PAGE_MAP[url.pathname]) {
      try {
        const target = new URL(PAGE_MAP[url.pathname], url);
        const res = await env.ASSETS.fetch(new Request(target.toString(), request));
        if (res && res.status < 400) {
          const h = new Headers(res.headers);
          h.delete('Cache-Control');
          h.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
          return new Response(res.body, { status: 200, headers: h });
        }
      } catch (e) { }
    }

    return env.ASSETS.fetch(request);
}
