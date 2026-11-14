/* ═══════════════════════════════════════════════════════════════
   ⭐ halan-feed — عامل البيانات (منفصل عن موقع OCTA)
   📌 ٩ نوفمبر ٢٠٢٦
   📌 السبب: لو الـfetch كان في نفس عامل الموقع، بيحجب الـisolate
     لمدة ٣٠-٦٠ ثانية ⇒ الطلبات بتقف ⇒ **شاشة بيضا**.
   ✅ الحل: عامل مستقل (isolate مستقل) بيملّي كاش KV،
     وعامل الموقع بيقرأ الكاش بس ⇒ صفر تأخير على الموقع.
   ⛔ التوكن في أسرار العامل + KV (متبدّل ⇒ بيتحفظ فوراً).
   ═══════════════════════════════════════════════════════════════ */

const HALAN_MCP_URL = 'https://api-redirect.halan.io/ai/brokerage-mcp';
const HALAN_LAST_REFRESH_KEY = 'halan_last_refresh_v1';
const HALAN_STATE_KEY = 'halan_state_v1';
const HALAN_EVENTS_KEY = 'halan_events_v1';
const HALAN_DEPTH_KEY = 'halan_depth_v1';
const EVENTS_TTL_MS = 6 * 3600 * 1000;
const PAGES = 8;
/* ⭐ أعلى ٤٠ سهم (لقطة ٩ نوفمبر ٢٠٢٦) — الـrank محمي فبنخزّنها هنا.
   📌 تتحدّث كل أسبوعين من /api/rank (جلسة إدارية) لو حبيت. */
const TOP_CODES = ["EGAL", "CPCI", "FAITA", "POUL", "VLMR", "HDBK", "SWDY", "LUTS", "MFPC", "KZPC", "ORAS", "EAST", "GTHE", "ALCN", "VLMRA", "BIDI", "AMOC", "MHOT", "ABUK", "GTEX", "PHGC", "ISMQ", "SCEM", "SNFC", "BQDC", "NAHO", "AIDC", "ETRS", "CCAP", "TALM", "ZMID", "ADRI", "IEEC", "AXPH", "PHTV", "HBCO", "KRDI", "SEIGA", "FWRY", "FAIT"];

async function kvGet(env, key) {
  try { if (!env || !env.HALAN_KV) return null; return await env.HALAN_KV.get(key, 'json'); }
  catch (e) { return null; }
}
async function kvPut(env, key, val) {
  try {
    if (!env || !env.HALAN_KV) return false;
    await env.HALAN_KV.put(key, JSON.stringify(val));
    return true;
  } catch (e) { return false; }
}

async function token(env) {
  const st = (await kvGet(env, HALAN_STATE_KEY)) || {};
  if (st.access && st.at && (Date.now() - st.at) < 10 * 60 * 1000) return st.access;
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: st.refresh || env.HALAN_MCP_REFRESH_TOKEN || '',
    client_id: env.HALAN_MCP_CLIENT_ID || '',
    code_verifier: env.HALAN_MCP_VERIFIER || '',
  });
  try {
    const r = await fetch(HALAN_MCP_URL + '/oauth/token', {
      method: 'POST', body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.access_token) return null;
    st.access = j.access_token;
    st.at = Date.now();
    /* ⭐⭐ التوكن بيتبدّل ⇒ لازم نحفظ الجديد فوراً */
    if (j.refresh_token) st.refresh = j.refresh_token;
    await kvPut(env, HALAN_STATE_KEY, st);
    return j.access_token;
  } catch (e) { return null; }
}

async function tool(env, name, args) {
  const tok = await token(env);
  if (!tok) return null;
  try {
    const r = await fetch(HALAN_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer ' + tok,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args || {} } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const raw = await r.text();
    for (const line of raw.split('\n')) {
      let s = line.trim();
      if (s.startsWith('data:')) s = s.slice(5).trim();
      if (!s.startsWith('{')) continue;
      try {
        const j = JSON.parse(s);
        if (j.error) return null;
        return (j.result && j.result.structuredContent) || null;
      } catch (e) { }
    }
  } catch (e) { }
  return null;
}

function classify(text) {
  const h = String(text || '').toLowerCase();
  const has = (a) => a.some(k => h.indexOf(k) >= 0);
  if (has(['دمج', 'استحواذ', 'إعادة هيكلة', 'إفلاس', 'تقييد', 'إيقاف', 'زيادة رأس المال', 'تخفيض'])) {
    return { kind: 'critical', kindAr: 'حدث حرج', mode: 'unknown' };
  }
  if (h.indexOf('توزيع') >= 0 && h.indexOf('نقد') >= 0) return { kind: 'cash_dividend', kindAr: 'نقدي', mode: 'cash' };
  if (has(['أسهم مجانية', 'توزيع أسهم', 'تجزئة', 'زيادة رأس مال'])) return { kind: 'stock_dividend', kindAr: 'أسهم', mode: 'stock' };
  if (has(['نتائج', 'أرباح', 'قوائم مالي', 'تقرير مالي'])) return { kind: 'earnings', kindAr: 'نتائج', mode: 'unknown' };
  if (has(['مجلس إدارة', 'جمعية عامة', 'لجنة القيد'])) return { kind: 'board', kindAr: 'إدارة', mode: 'unknown' };
  if (has(['اتفاق', 'شراكة', 'استثمار', 'توسع'])) return { kind: 'deal', kindAr: 'صفقة', mode: 'unknown' };
  return { kind: 'general', kindAr: 'إعلان الشركة', mode: 'unknown' };
}

function dateStr(ms) {
  try {
    const d = new Date(Number(ms));
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch (e) { return null; }
}

function statusOf(dateStrValue) {
  try {
    if (!dateStrValue) return 'past';
    const today = new Date().toISOString().slice(0, 10);
    if (dateStrValue >= today) return 'upcoming';
    const d = new Date(dateStrValue + 'T00:00:00Z');
    return ((Date.now() - d.getTime()) / 86400000) <= 30 ? 'recent' : 'past';
  } catch (e) { return 'past'; }
}

async function refreshDepth(env, isinOf, topCodes) {
  const depth = {};
  for (const code of topCodes) {
    let isin = isinOf[code];
    if (!isin) {
      /* ⭐ السهم مش في آخر الإعلانات ⇒ بحث مباشر (نداء واحد) */
      try {
        const sr = await tool(env, 'search_symbols', { query: code, pageSize: 8 });
        for (const it of ((sr && sr.items) || [])) {
          const reu = String(it.reuters || '').toUpperCase();
          if (it.isin && (reu === code + '.CA' || reu.split('.')[0] === code)) { isin = it.isin; isinOf[code] = isin; break; }
        }
      } catch (e) { }
    }
    if (!isin) continue;
    try {
      const bb = await tool(env, 'get_best_bid_ask', { isin });
      const q = await tool(env, 'get_stock_quote', { isin });
      if (!bb && !q) continue;
      const bid = bb && bb.bestBid, ask = bb && bb.bestAsk;
      let spread = null;
      if (bid && ask && bb.hasBid !== false && bb.hasAsk !== false) {
        const mid = (bid + ask) / 2;
        if (mid > 0) spread = Math.round(((ask - bid) / mid) * 1000) / 10;
      }
      let score = null;
      if (spread !== null) {
        score = 95 - Math.min(60, spread * 30);
        const vt = q && q.cumTradeValue;
        if (vt) score += Math.min(10, Math.max(0, (Math.log10(Math.max(vt, 1e6)) - 6) * 2.5));
        score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
      }
      depth[code] = {
        code, isin,
        bids: (bid && bb.hasBid !== false) ? [{ price: Number(bid), qty: 0, orders: 0 }] : [],
        asks: (ask && bb.hasAsk !== false) ? [{ price: Number(ask), qty: 0, orders: 0 }] : [],
        last: (q && q.lastTradePrice) || null,
        lastClose: (q && q.closePrice) || null,
        volume: (q && q.cumVolume) || null,
        value_today: (q && q.cumTradeValue) || null,
        spread_pct: spread, depth_score: score, source: 'halan', at: Date.now(),
      };
    } catch (e) { }
  }
  if (Object.keys(depth).length) await kvPut(env, HALAN_DEPTH_KEY, { at: Date.now(), depth });
  return Object.keys(depth).length;
}

async function refresh(env) {
  const events = [];
  const isinOf = {};
  const seen = {};
  for (const t of ['list_bulletins', 'list_news']) {
    for (let page = 1; page <= PAGES; page++) {
      const res = await tool(env, t, { pageNumber: page, pageSize: 100 });
      const items = (res && res.items) || [];
      if (!items.length) break;
      for (const it of items) {
        let code = null, head = '', isin = it.isin || null;
        if (t === 'list_bulletins') {
          head = String(it.contentEn || it.contentAr || '').replace(/<BR\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ');
          const m = head.match(/([A-Z][A-Z0-9]{1,7})\.CA/);
          if (!m) continue;
          code = m[1];
          if (isin) isinOf[code] = isin;
        } else {
          if (!isin || isin.indexOf('EGS') !== 0) continue;
          code = String(it.reutersCode || '').split('.')[0].toUpperCase();
          head = String(it.arbHeading || it.heading || '');
          if (!code || !head) continue;
          isinOf[code] = isin;
        }
        const key = code + '|' + head.slice(0, 60);
        if (seen[key]) continue;
        seen[key] = 1;
        const c = classify(head);
        const dt = dateStr(it.dateStamp);
        events.push({
          code, isin, kind: c.kind, kindAr: c.kindAr, mode: c.mode,
          /* ⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ٢٢٠ ⇒ ٤٠٠ حرف
             📌 السبب: الإعلان الرسمي شكله:
                «العنوان : الشركة (CODE.CA) - الحدث  اسم الشركة: … كود ر和义务…
                 مضمون الاعلان : <نص الخبر>»
             ⇒ بـ٢٢٠ حرف كان نص الخبر بيتقصّ ومحدش بيشوفه.
             📌 ٤٠٠ حرف بيوصل لنص الخبر (أول ٢٠٠+ حرف منه).
             📌 حجم الـKV بيزيد ~١٥٠ ك.ب (٣٢٠ ⇒ ~٤٧٠ ك.ب) — مقبول. */
          headline: head.replace(/\s+/g, ' ').trim().slice(0, 400),
          date: dt, status: statusOf(dt),
        });
      }
      if (items.length < 100) break;
    }
  }
  const out = { at: Date.now(), events, isinOf };
  const ok = await kvPut(env, HALAN_EVENTS_KEY, out);
  /* ⭐ خريطة الأرقام بتتكمّل مع كل دورة ⇒ بتغطي كل الأسهم */

  /* ⭐ عمق السوق لأفضل ٤٠ سهم (حسب التقييم المنشور في data_full.json) */
  const topCodes = TOP_CODES.slice();
  const nDepth = await refreshDepth(env, isinOf, topCodes);
  return { events: events.length, isins: Object.keys(isinOf).length, depth: nDepth, ok };
}

export default {
  /* ⭐ الكرون: يجدّد كاش الأحداث (كل ٣٠ دقيقة) في isolate مستقل */
  async scheduled(event, env, ctx) {
    /* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⭐ «عامل الإيقاظ» — أهم حاجة في الملف ده
    📌 السبب: Railway بينام بعد خمول ⇒ أول طلب = cold start (٦-١٢ ثا)
    📌   ⇒ البوابة كانت بتقعد ٣٥ ثانية ⛔.
    📌 📌 ليه العامل ده؟ لأن كرون Cloudflare **فيه اشتغل فعلاً**
    📌   (مقيس: كاش هالان اتجدّد) — عكس العامل بتاع الموقع.
    📌 ✅ السلوك: كل ٥ دقايق ⇒ ping لـ Railway + الـworkers (إيقاظ)
    📌   وكل ~٣٠ دقيقة ⇒ تجديد كاش هالان (عشان ما نحرقش توكن MCP). */
    const now = Date.now();
    const last = await kvGet(env, HALAN_LAST_REFRESH_KEY);
    const lastMs = (last && last.at) ? Number(last.at) : 0;
    const dueRefresh = (now - lastMs) > 28 * 60 * 1000;   // ~٣٠ دقيقة

    if (dueRefresh) {
      try {
        const r = await refresh(env);
        await kvPut(env, HALAN_LAST_REFRESH_KEY, { at: now, ok: !!r.ok, events: r.events, isins: r.isins });
        console.log('[FEED] refreshed events=' + r.events + ' isins=' + r.isins + ' kv=' + (r.ok ? 'ok' : 'FAIL'));
      } catch (e) {
        console.warn('[FEED] failed: ' + String(e && e.message || e));
      }
    } else {
      console.log('[FEED] skip refresh (باقي ' + Math.round((28 * 60 * 1000 - (now - lastMs)) / 60000) + ' دقيقة)');
    }

    /* 🔔 إيقاظ: Railway + عمّال OCTA (اللي بيناموا ⇒ cold start) */
    const PING = [
      'https://octa-prices-production-4ccb.up.railway.app/api/health',
      'https://octa-preview.ahmed3zz2020.workers.dev/api/health',
      'https://octashares.com/api/health'
    ];
    for (const u of PING) {
      try {
        const r = await fetch(u, { headers: { 'User-Agent': 'octa-keepalive/1.0' } });
        console.log('[PING]', u, r.status);
      } catch (e) { console.warn('[PING] fail', u, String(e && e.message || e)); }
    }
  },

  /* ⭐ نقطة فحص: تفتحها على الموبايل وتقولّي النتيجة */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/status') {
      const st = (await kvGet(env, HALAN_STATE_KEY)) || {};
      const ev = (await kvGet(env, HALAN_EVENTS_KEY)) || {};
      return new Response(JSON.stringify({
        ok: true,
        hasSecret: !!(env && env.HALAN_MCP_REFRESH_TOKEN),
        tokenCached: !!st.access,
        tokenAgeMin: st.at ? Math.round((Date.now() - st.at) / 60000) : null,
        events: (ev.events || []).length,
        isins: Object.keys(ev.isinOf || {}).length,
        eventsAgeMin: ev.at ? Math.round((Date.now() - ev.at) / 60000) : null,
        now: new Date().toISOString(),
      }, null, 1), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    /* ⭐ توليد فوري: يجيب الأحداث دلوقتي (للاختبار) */
    if (url.pathname === '/refresh') {
      const r = await refresh(env);
      return new Response(JSON.stringify(r), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('halan-feed', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  },
};
