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
   ═══════════════════════════════════════════════════════════ */

const API = 'https://octa-prices-production-4ccb.up.railway.app';
const TRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 🔁 جلب من الـAPI مع إعادة محاولة — الخطأ البسيط بيتراجع لوحده */
async function fetchApi(target, init) {
  let lastErr = null;
  for (let i = 0; i < TRIES; i++) {
    try {
      const r = await fetch(target, init);
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    /* 1) proxy للـAPI (نفس origin عشان نتفادى CORP same-site) */
    if (url.pathname.startsWith('/api/')) {
      const target = API + url.pathname + url.search;
      const init = {
        method: request.method,
        headers: { 'Accept': 'application/json' }
      };
      try {
        const upstream = await fetchApi(target, init);
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: {
            'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
            'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
            'Cache-Control': 'no-store'
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'api-proxy-failed', message: String(e && e.message || e) }), {
          status: 502,
          headers: { 'Content-Type': 'application/json',
                     'Access-Control-Allow-Origin': request.headers.get('Origin') || '*' }
        });
      }
    }
    /* 2) static assets (الصور/HTML/CSS/JS) */
    return env.ASSETS.fetch(request);
  }
};
