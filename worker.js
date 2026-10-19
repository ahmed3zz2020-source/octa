/* ═══════════════════════════════════════════════════════════
   🐙 OCTA Preview — Worker entrypoint
   ───────────────────────────────────────────────────────────
   Proxy /api/* → octa-prices-production-4ccb.up.railway.app
   (يحايل CORS + cross-origin-resource-policy في الباك).
   باقي الطلبات → static assets في dist/.
   ═══════════════════════════════════════════════════════════ */

const API = 'https://octa-prices-production-4ccb.up.railway.app';

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
        const upstream = await fetch(target, init);
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
        return new Response(JSON.stringify({ error: 'api-proxy-failed', message: e.message }), {
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
