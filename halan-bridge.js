/* ═══════════════════════════════════════════════════════════════
   ⭐ halan-bridge.js — جسر بيانات بورصة هالان (Halan Borsa)
   📌 ٩ نوفمبر ٢٠٢٦
   📌 بيقرأ من MCP بتاع هالان (OAuth · scope: brokerage:read) وبيقدّم:
      ① عمق السوق الحقيقي (أفضل عرض/شراء + عمق الدفتر)
      ② إعلانات الشركة + أخبارها (مدموجة مع المصدر الحالي)
   ⛔ التوكن كله في أسرار الـWorker (secret) + KV — مش في الكود ولا في المتصفح.
   ⛔ مفيش أي مسار بياخد بيانات الحساب (محفظة/أوامر/كاش) — بيانات سوق فقط.
   ═══════════════════════════════════════════════════════════════ */

const HALAN_MCP_URL = 'https://api-redirect.halan.io/ai/brokerage-mcp';
const HALAN_STATE_KEY = 'halan_state_v1';
const HALAN_EVENTS_KEY = 'halan_events_v1';
const EVENTS_TTL_MS = 6 * 3600 * 1000;

/* ─────────── KV ─────────── */
async function kvGet(env, key) {
  try { if (!env || !env.HALAN_KV) return null; return await env.HALAN_KV.get(key, 'json'); }
  catch (e) { return null; }
}
async function kvPut(env, key, val) {
  try {
    if (!env || !env.HALAN_KV) { console.warn('[HALAN] no KV binding'); return false; }
    await env.HALAN_KV.put(key, JSON.stringify(val));
    return true;
  } catch (e) { console.warn('[HALAN] kvPut failed: ' + String(e && e.message || e)); return false; }
}

/* ─────────── OAuth (تجديد + حفظ التوكن المتبدّل) ─────────── */
async function halanToken(env) {
  if (!env || !env.HALAN_MCP_REFRESH_TOKEN) return null;
  const st = await kvGet(env, HALAN_STATE_KEY);
  const now = Date.now();
  if (st && st.access && st.at && (now - st.at) < 10 * 60 * 1000) return st.access;
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: (st && st.refresh) || env.HALAN_MCP_REFRESH_TOKEN,
    client_id: env.HALAN_MCP_CLIENT_ID || '',
    code_verifier: env.HALAN_MCP_VERIFIER || '',
  });
  try {
    const r = await fetch(HALAN_MCP_URL + '/oauth/token', {
      method: 'POST', body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.access_token) return null;
    /* ⭐⭐ هالان بتبدّل الـrefresh_token في كل تجديد ⇒ لازم نحفظ الجديد */
    await kvPut(env, HALAN_STATE_KEY, {
      access: j.access_token,
      at: now,
      refresh: j.refresh_token || (st && st.refresh) || env.HALAN_MCP_REFRESH_TOKEN,
    });
    return j.access_token;
  } catch (e) { return null; }
}

/* ─────────── نداء أداة MCP ─────────── */
async function halanTool(env, name, args) {
  const tok = await halanToken(env);
  if (!tok) return null;
  try {
    const r = await fetch(HALAN_MCP_URL, {
      method: 'POST',
      signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(9000) : undefined,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer ' + tok,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args || {} } }),
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

/* ─────────── تصنيف الحدث بالعربي (نفس منطق محرك OCTA) ─────────── */
function halanClassify(text) {
  const h = String(text || '').toLowerCase();
  const has = (arr) => arr.some(k => h.indexOf(k) >= 0);
  if (has(['دمج', 'استحواذ', 'إعادة هيكلة', 'إفلاس', 'تقييد', 'إيقاف', 'زيادة رأس المال', 'تخفيض'])) {
    return { kind: 'critical', kindAr: 'حدث حرج', mode: 'unknown' };
  }
  if (h.indexOf('توزيع') >= 0 && (h.indexOf('نقد') >= 0 || h.indexOf('نقدي') >= 0)) {
    return { kind: 'cash_dividend', kindAr: 'نقدي', mode: 'cash' };
  }
  if (has(['أسهم مجانية', 'توزيع أسهم', 'تجزئة', 'زيادة رأس مال'])) {
    return { kind: 'stock_dividend', kindAr: 'أسهم', mode: 'stock' };
  }
  if (has(['نتائج', 'أرباح', 'قوائم مالي', 'تقرير مالي'])) {
    return { kind: 'earnings', kindAr: 'نتائج', mode: 'unknown' };
  }
  if (has(['مجلس إدارة', 'جمعية عامة', 'لجنة القيد'])) {
    return { kind: 'board', kindAr: 'إدارة', mode: 'unknown' };
  }
  if (has(['اتفاق', 'شراكة', 'استثمار', 'توسع'])) {
    return { kind: 'deal', kindAr: 'صفقة', mode: 'unknown' };
  }
  return { kind: 'general', kindAr: 'إعلان الشركة', mode: 'unknown' };
}

function halanDate(ms) {
  try {
    const d = new Date(Number(ms));
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch (e) { return null; }
}

function halanStatus(dateStr) {
  try {
    if (!dateStr) return 'past';
    const today = new Date().toISOString().slice(0, 10);
    if (dateStr >= today) return 'upcoming';
    const d = new Date(dateStr + 'T00:00:00Z');
    const delta = (Date.now() - d.getTime()) / 86400000;
    return delta <= 30 ? 'recent' : 'past';
  } catch (e) { return 'past'; }
}

/* ─────────── الأحداث (إعلانات + أخبار) + خريطة الأرقام ─────────── */
async function halanEvents(env, opts) {
  const force = !!(opts && opts.force);
  const cached = await kvGet(env, HALAN_EVENTS_KEY);
  if (!force && cached && cached.at && (Date.now() - cached.at) < EVENTS_TTL_MS) return cached;
  const events = [];
  const isinOf = {};
  const seen = {};
  for (const tool of ['list_bulletins', 'list_news']) {
    for (let page = 1; page <= 8; page++) {
      /* ⭐ كل صفحة لوحدها: لو واحدة فشلت نكمل الباقي (مش نخسر كله) */
      let res = null;
      try { res = await halanTool(env, tool, { pageNumber: page, pageSize: 100 }); }
      catch (e) { console.warn('[HALAN] ' + tool + ' p' + page + ' failed: ' + String(e && e.message || e)); continue; }
      const items = (res && res.items) || [];
      if (!items.length) break;
      for (const it of items) {
        let code = null, head = '', isin = it.isin || null;
        if (tool === 'list_bulletins') {
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
        const c = halanClassify(head);
        const date = halanDate(it.dateStamp);
        events.push({
          code, isin, kind: c.kind, kindAr: c.kindAr, mode: c.mode,
          headline: head.replace(/\s+/g, ' ').trim().slice(0, 220),
          date, status: halanStatus(date),
        });
      }
      if (items.length < 100) break;
    }
  }
  const out = { at: Date.now(), events, isinOf };
  console.log('[HALAN] fetched events=' + events.length + ' isins=' + Object.keys(isinOf).length);
  const okPut = await kvPut(env, HALAN_EVENTS_KEY, out);
  console.log('[HALAN] kv put -> ' + (okPut === false ? 'FAILED' : 'ok'));
  return out;
}

/* ─────────── عمق السوق ─────────── */
function halanLevels(raw) {
  const out = [];
  for (const l of (raw || [])) {
    if (!l || typeof l !== 'object') continue;
    let price = l.price;
    if (price == null) price = l.lastPrice || l.bestBid || l.bestAsk;
    let qty = l.qty;
    if (qty == null) qty = l.quantity;
    if (qty == null) qty = l.volume;
    const p = Number(price), q = Number(qty);
    if (!isFinite(p) || p <= 0) continue;
    out.push({ price: p, qty: isFinite(q) ? q : 0, orders: Number(l.orders) || 0 });
  }
  return out;
}

async function halanIsinFor(env, sym) {
  /* ⭐ رقم السهم: من كاش الأحداث لو موجود، وإلا بحث مباشر (نداء واحد · سريع).
     ⛔ ما بنجيبش كل الأحداث هنا — ده بياخد دقيقة وبيجمّد الصفحة. */
  const cached = await kvGet(env, HALAN_EVENTS_KEY);
  const fromMap = cached && cached.isinOf && cached.isinOf[sym];
  if (fromMap) return fromMap;
  try {
    const sr = await halanTool(env, 'search_symbols', { query: sym, pageSize: 8 });
    for (const it of ((sr && sr.items) || [])) {
      const reu = String(it.reuters || '').toUpperCase();
      if (it.isin && (reu === sym + '.CA' || reu.split('.')[0] === sym)) {
        try {
          if (cached && cached.isinOf) { cached.isinOf[sym] = it.isin; await kvPut(env, HALAN_EVENTS_KEY, cached); }
        } catch (e) { }
        return it.isin;
      }
    }
  } catch (e) { }
  return null;
}

async function halanDepth(env, code) {
  if (!env || !env.HALAN_MCP_REFRESH_TOKEN) return null;
  const sym = String(code || '').toUpperCase();
  if (!/^[A-Z0-9.]{1,12}$/.test(sym)) return null;
  const isin = await halanIsinFor(env, sym);
  if (!isin) return null;
  const bb = await halanTool(env, 'get_best_bid_ask', { isin });
  const q = await halanTool(env, 'get_stock_quote', { isin });
  if (!bb && !q) return null;
  let bids = halanLevels(bb && (bb.bids || bb.bid));
  let asks = halanLevels(bb && (bb.asks || bb.ask));
  let last = (bb && (bb.last || bb.lastPrice)) || (q && q.lastTradePrice) || null;
  if (!bids.length && !asks.length) {
    const b = bb && bb.bestBid, a = bb && bb.bestAsk;
    if (b && bb.hasBid !== false) bids = [{ price: Number(b), qty: 0, orders: 0 }];
    if (a && bb.hasAsk !== false) asks = [{ price: Number(a), qty: 0, orders: 0 }];
  }
  if (!bids.length && !asks.length) return null;
  let spread_pct = null;
  if (bids.length && asks.length) {
    const mid = (bids[0].price + asks[0].price) / 2;
    if (mid > 0) spread_pct = Math.round(((asks[0].price - bids[0].price) / mid) * 1000) / 10;
  }
  return {
    bids, asks, last, spread_pct,
    lastClose: (q && q.closePrice) || null,
    volume: (q && q.cumVolume) || null,
    value_today: (q && q.cumTradeValue) || null,
    source: 'halan',
  };
}

/* ─────────── دمج الإعلانات مع المصدر الحالي ─────────── */
export async function halanMergeDividends(env, upstream, ctx) {
  let data = {};
  try { data = upstream && typeof upstream === 'object' ? upstream : JSON.parse(upstream); } catch (e) { data = {}; }
  const acts = Array.isArray(data.actions) ? data.actions.slice() : [];
  if (!env || !env.HALAN_MCP_REFRESH_TOKEN) return data;
  /* ⭐⭐⭐ الكاش بارد ⇒ نرجّع الأصلي **فوراً** ونحدّث في الخلفية.
     ⛔ قبل كده الطلب كان بيستنى ١٢ صفحة MCP (≈٩٠ ثانية) ⇒ الشاشة كانت بتجمّد ⇒ أبيض. */
  const cached = await kvGet(env, HALAN_EVENTS_KEY);
  const fresh = cached && cached.at && (Date.now() - cached.at) < EVENTS_TTL_MS && (cached.events || []).length;
  if (!fresh) {
    const warm = (async () => { try { await halanEvents(env); } catch (e) { } })();
    if (ctx && typeof ctx.waitUntil === 'function') { try { ctx.waitUntil(warm); } catch (e) { } }
    else warm.catch(() => { });
    return data;
  }
  let ev;
  try { ev = cached; } catch (e) { return data; }
  const seen = {};
  for (const a of acts) {
    const k = (a.code || '') + '|' + (a.kind || '') + '|' + (a.date || '');
    seen[k] = 1;
    const k2 = (a.code || '') + '|' + (a.date || '');
    seen[k2] = 1;
  }
  let added = 0;
  for (const e of (ev.events || [])) {
    const k1 = e.code + '|' + e.kind + '|' + e.date;
    const k2 = e.code + '|' + e.date;
    if (seen[k1] || seen[k2]) continue;
    seen[k1] = 1; seen[k2] = 1;
    acts.push({
      code: e.code,
      id: e.code + '|' + e.kind + '|' + (e.date || ''),
      kind: e.kind,
      kindAr: e.kindAr,
      mode: e.mode,
      date: e.date,
      distributionDate: e.date,
      recordDate: e.date,
      headline: e.headline,
      value: null,
      ratio: null,
      currency: null,
      yieldPct: null,
      lastClose: null,
      nameAr: null,
      nameEn: null,
      sector: null,
      status: e.status,
      source: 'halan',
    });
    added++;
  }
  if (added) {
    acts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    data.actions = acts;
    if (data.stats && typeof data.stats === 'object') {
      data.stats.total = acts.length;
      data.stats.halanAdded = added;
    }
    data.halanEvents = added;
  }
  return data;
}

export { halanDepth, halanEvents, halanTool, halanToken };
