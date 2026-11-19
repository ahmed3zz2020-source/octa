/* ══════════════════════════════════════════════════════════════
  🧪 خادم محلي معزول لاختبارات R26 (واجهة + API وهمي)
  ────────────────────────────────────────────────────────────
  📌 ليش؟ قواعد الجولة ٢٦ بتقول: ممنوع أي حمل على الإنتاج
     ⇒ كل قياس (LCP · الشبكة · ١٠٠ طلب متوازي) لازم يتعمل
       على خادم محلي ثابت مش على أي سيرفر بعيد.
  📌 الخادم بيرقدّم:
     ① ملفات ثابتة من جذر الريبو (index.html · assets/ · data/)
     ② مسارات /api من mock محلي مبني على data_full.json الموجود
        في الريبو ⇒ مفيش أي اتصال خارجي إطلاقاً.
  📌 الإحصائيات (requests · bytes · per-path) بتتجمّع عشان
     نقيس الحمل وصحة الردود.
  ══════════════════════════════════════════════════════════════ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..', '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json',
};

/* ── بيانات محلية للـmock ─────────────────────────────────── */
let CACHE = null;
function loadData() {
  if (CACHE) return CACHE;
  let full = { stocks: {} };
  let egx = { stocks: {} };
  try {
    full = JSON.parse(fs.readFileSync(path.join(ROOT, 'data_full.json'), 'utf8'));
  } catch (e) { /* ملف غير موجود ⇒ نكمّل بفارغ */ }
  try {
    egx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data_egx.json'), 'utf8'));
  } catch (e) { /* اختياري */ }
  const stocks = (full && full.stocks) || {};
  const codes = Object.keys(stocks);
  const rows = codes.map(function (code) {
    const s = stocks[code] || {};
    const score = typeof s.total === 'number' ? s.total
      : (typeof s.final_score === 'number' ? s.final_score : 50);
    return {
      code: code,
      name: s.name || code,
      nameEn: s.nameEn || code,
      sector: s.sectorAr || s.sector || 'عام',
      price: typeof s.p === 'number' ? s.p : null,
      change: typeof s.chg === 'number' ? s.chg : null,
      volume: typeof s.v === 'number' ? s.v : null,
      total: score,
      final_score: score,
      score: score,
      verdict: score >= 65 ? 'تجميع' : (score >= 50 ? 'احتفظ' : 'متابعة'),
      conf: score >= 65 ? 'عالية' : 'متوسطة',
      rsi: typeof s.rsi === 'number' ? s.rsi : null,
      pe: typeof s.pe === 'number' ? s.pe : null,
    };
  });
  CACHE = { full: full, egx: egx, rows: rows, codes: codes };
  return CACHE;
}

const LOCAL_USER = {
  id: 'local-test-user',
  name: 'مستخدم اختبار محلي',
  email: 'local.test@example.test',
  role: 'user',
  plan: 'test',
};
const LOCAL_TOKEN = 'local-r26-test-token';

/* ── ردود الـmock ─────────────────────────────────────────── */
function json(res, code, obj, extraHeaders) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const h = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store',
  };
  if (extraHeaders) Object.keys(extraHeaders).forEach(function (k) { h[k] = extraHeaders[k]; });
  res.writeHead(code, h);
  res.end(body);
}

function mockApi(pathname, method, req, res, stats) {
  const d = loadData();
  const p = pathname;
  const cookie = 'octa_session=local-r26-session; Path=/; HttpOnly; SameSite=Lax';

  if (p === '/api/health') {
    return json(res, 200, {
      status: 'ok', ok: true, market_phase: 'open',
      cairo_time: new Date().toISOString(), source: 'local-mock',
    });
  }
  if (p === '/api/auth/me') {
    /* ⛔ بدون جلسة ⇒ 401 (زي الباك الحقيقي)
       📌 مهم: الاختبار مش بيعتبر «نجاح» على 401 — بيتأكد من
          محتوى الرد (شكل JSON + حالة) مش الكود لوحده. */
    const auth = req.headers.authorization || req.headers.cookie;
    if (!auth) return json(res, 401, { ok: false, error: 'unauthorized' });
    /* ⛔ لازم التوكن كمان: البوابة بتقفل بس لو الرد فيه token + user */
    return json(res, 200, { ok: true, token: LOCAL_TOKEN, user: LOCAL_USER });
  }
  if (p === '/api/auth/refresh') {
    return json(res, 200, { ok: true, token: LOCAL_TOKEN, expires_in: 7200 }, { 'Set-Cookie': cookie });
  }
  if (p === '/api/auth/logout') {
    return json(res, 200, { ok: true });
  }
  if (p === '/api/auth/pin/challenge/send') {
    return json(res, 200, { ok: true, sent: true, expires_in: 600 });
  }
  if (p === '/api/auth/pin/challenge/verify') {
    return json(res, 200, { ok: true, unlock: 'local-unlock', expires_in: 600 });
  }
  if (p === '/api/auth/pin/login') {
    return json(res, 200, { ok: true, token: LOCAL_TOKEN, user: LOCAL_USER }, { 'Set-Cookie': cookie });
  }
  if (p === '/api/auth/pin/fingerprint') {
    return json(res, 200, { ok: true, enabled: false });
  }
  if (p === '/api/auth/signup/start') {
    return json(res, 200, { ok: true, sent: true });
  }
  if (p === '/api/auth/signup/verify') {
    return json(res, 200, { ok: true, unlock: 'local-unlock' });
  }
  if (p === '/api/data_full') {
    return json(res, 200, d.full);
  }
  if (p === '/api/egx_full') {
    return json(res, 200, d.egx);
  }
  if (p === '/api/rank' || p === '/api/ranking') {
    let limit = 400;
    const m = /[?&]limit=(\d+)/.exec(p + (req.url || ''));
    if (m) limit = Math.min(Number(m[1]), d.rows.length);
    return json(res, 200, { results: d.rows.slice(0, limit), count: limit, ok: true });
  }
  if (p === '/api/stocks') {
    return json(res, 200, { stocks: d.full.stocks || {}, count: d.codes.length, ok: true });
  }
  if (p === '/api/markets') {
    return json(res, 200, {
      ok: true,
      markets: [
        { key: 'egypt', name: 'مصر', nameAr: 'مصر', count: 285 },
        { key: 'us', name: 'أمريكا', nameAr: 'أمريكا', count: 900 },
        { key: 'saudi', name: 'السعودية', nameAr: 'السعودية', count: 250 },
        { key: 'uae', name: 'الإمارات', nameAr: 'الإمارات', count: 180 },
      ],
    });
  }
  if (p === '/api/quotes' || p === '/api/prices') {
    const quotes = {};
    d.codes.slice(0, 40).forEach(function (c, i) {
      quotes[c] = { price: 100 + i, change: (i % 5) - 2, volume: 1000 + i };
    });
    return json(res, 200, { quotes: quotes, prices: quotes, ok: true });
  }
  if (p === '/api/engine-weights') {
    return json(res, 200, {
      ok: true,
      weights: { technical: 20, fundamental: 20, liquidity: 15, news: 15, sentiment: 10, risk: 10, portfolio: 10 },
    });
  }
  if (p === '/api/dashboard' || p === '/api/stats' || p === '/api/sector-stats') {
    return json(res, 200, { ok: true, status: 'ok', data: [], results: [], count: 0 });
  }
  /* أي مسار تاني ⇒ رد صحيح الشكل (مش 404) عشان الواجهة ما تكسرش */
  return json(res, 200, {
    ok: true, status: 'ok', source: 'local-mock', path: p,
    data: [], results: [], items: [], stocks: {}, count: 0,
  });
}

/* ── السيرفر ──────────────────────────────────────────────── */
function startServer(opts) {
  const o = opts || {};
  const root = o.root || ROOT;
  const stats = {
    requests: 0, apiRequests: 0, staticRequests: 0,
    bytes: 0, byPath: Object.create(null), errors: 0,
    startedAt: Date.now(),
  };

  /* ⛔⛔ عقدة وجهة الـAPI (حارس R23) — نسخة محلية
     📌 السبب: حارس الـorigin قفل «fail closed» إلا لو وجهة
        الـAPI تطابق العقدة المثبّتة في assets/config/preview.json.
        ⇒ على localhost كانت كل نداءات /api/ للبوابة بتتقفل.
     📌 ✅ الحل: السيرفر المحلي يقدّم عقدة بمقصد محلي (نفس
        الـHost بتاع الطلب) ⇒ الحارس بيفتح على السيرفر المحلي
        بس وبفضل مقفول على أي وجهة تانية (الإنتاج ما بتتلمسش). */
  function localContract(host) {
    let cfg = {};
    try {
      cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'config', 'preview.json'), 'utf8'));
    } catch (e) { cfg = {}; }
    const origin = 'http://' + (host || '127.0.0.1');
    cfg.preview = cfg.preview || {};
    cfg.preview.apiBaseUrl = origin;
    cfg.preview.hosts = [host || '127.0.0.1'];
    cfg.preview.note_ar = 'عقدة محلية للاختبار المعزول (R26) — مفيش أي اتصال بالإنتاج.';
    return JSON.stringify(cfg);
  }

  /* ⛔ الضغط: الإنتاج (Cloudflare) بيخدم الضغط gzip/br
     📌 ⇒ السيرفر المحلي لازم يضغط برضو، وإلا القياس هيكون
        مضلّل (أكبر بكتير من اللي المستخدم بياخده). */
  const useGzip = o.gzip !== false;

  /* ⛔ كاش الضغط: السيرفر الحقيقي بيضغط مرة واحدة ويخزّن
     📌 (الضغط المتزامن لكل طلب بيعمل حجب للـevent loop
     📌  وبي measurementMeasurements قياس غلط).
     📌 ✅ الحل: نضغط كل ملف مرة واحدة ونخزّنه. */
  const gzCache = new Map();

  function sendFile(req, res, file, ext) {
    fs.readFile(file, function (err, buf) {
      if (err) {
        stats.errors++;
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('not found');
        return;
      }
      const type = MIME[ext] || 'application/octet-stream';
      const accept = String(req.headers['accept-encoding'] || '');
      if (useGzip && /gzip/.test(accept) && buf.length > 512) {
        let gz = gzCache.get(file);
        if (!gz) {
          gz = zlib.gzipSync(buf, { level: 6 });
          gzCache.set(file, gz);
        }
        stats.bytes += gz.length;
        stats.gzipBytes = (stats.gzipBytes || 0) + gz.length;
        res.writeHead(200, {
          'Content-Type': type,
          'Content-Length': String(gz.length),
          'Content-Encoding': 'gzip',
          'Cache-Control': 'no-cache',
          'Vary': 'Accept-Encoding',
        });
        res.end(gz);
        return;
      }
      stats.bytes += buf.length;
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-cache',
      });
      res.end(buf);
    });
  }

  const server = http.createServer(function (req, res) {
    stats.requests++;
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    } catch (e) {
      pathname = req.url;
    }
    stats.byPath[pathname] = (stats.byPath[pathname] || 0) + 1;

    if (pathname === '/assets/config/preview.json') {
      const body = Buffer.from(localContract(req.headers.host), 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': String(body.length),
        'Cache-Control': 'no-store',
      });
      res.end(body);
      return;
    }

    if (pathname.indexOf('/api/') === 0) {
      stats.apiRequests++;
      try {
        mockApi(pathname, req.method, req, res, stats);
      } catch (e) {
        stats.errors++;
        json(res, 500, { ok: false, error: 'mock-failure' });
      }
      return;
    }

    stats.staticRequests++;
    let rel = pathname === '/' ? '/index.html' : pathname;
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, path.normalize(rel).replace(/^([/\\])+/, ''));
    if (!file.startsWith(root)) {
      stats.errors++;
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('forbidden');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    sendFile(req, res, file, ext);
  });

  return new Promise(function (resolve, reject) {
    server.on('error', reject);
    server.listen(o.port || 0, '127.0.0.1', function () {
      const addr = server.address();
      resolve({
        url: 'http://127.0.0.1:' + addr.port,
        port: addr.port,
        pid: process.pid,
        stats: stats,
        server: server,
        close: function () { return new Promise(function (r) { server.close(function () { r(); }); }); },
      });
    });
  });
}

module.exports = { startServer: startServer, ROOT: ROOT, LOCAL_TOKEN: LOCAL_TOKEN };
