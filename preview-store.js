/* ══════════════════════════════════════════════════════════════════════
   ⭐⭐⭐ (R28) ⭐ مخزن المعاينة — Durable Object ⭐⭐⭐
   ──────────────────────────────────────────────────────────────────────
   📌 ليه ⭐: ⛔ الـKV اتساقه **مؤجل** ⭐ (eventual consistency ⭐).
      📌 R26-I02 ⭐ ⇒ ⛔ إبطال جلسات المعاينة مبيتنتشرش فوراً ⭐ (الـKV ⭐).
      📌 R26-I04 ⭐ ⇒ ⛔ الكتابات المتزامنة للمحفظة والتنبيهات بتضيع ⭐
        (قراءة + تعديل + كتابة ⭐ بدون قفل ⭐).
   ✅ الحل ⭐: Durable Object ⭐ (نسخة واحدة ⭐ "preview_state" ⭐):
      · قراءة بعد كتابة ⭐ ⇒ ⭐ اتساق قوي ⭐ (إبطال فوري ⭐ بين كل النسخ ⭐).
      · كل الطلبات بتترتّب ⭐ ⇒ ⭐ مافيش سباق ⭐ ⇒ ⭐ مافيش ضياع ⭐.
      · عمليات ذرّية جاهزة ⭐ (التنبيهات ⭐ / المحفظة ⭐) ⭐.

   📌 ⛔fail-closed ⭐: لو الربط ناقص ⭐ ⇒ ⭐ ⛔ مافيش حالة ⭐ ⇒ ⭐ 503 ⭐.
   📌 التشغيل: جزء من عامل المعاينة ⭐ (التصدير من worker.js ⭐).
   ═══════════════════════════════════════════════════════════════════════ */

const DO_NAME = 'preview_state';

/* ⭐ الوقت بالثواني ⭐ (مصدر واحد ⭐) */
function nowSec() { return Math.floor(Date.now() / 1000); }

function jsonOut(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export class PreviewStore {
  constructor(state, env) {
    this.state = state;
    this.env = env || {};
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/cmd') {
      return jsonOut({ ok: false, error: 'not_found' }, 404);
    }
    let cmd = {};
    try { cmd = await request.json(); } catch (e) { cmd = {}; }
    const op = String(cmd.op || '');
    const key = String(cmd.key || '');
    const st = this.state.storage;
    try {
      if (op === 'get') {
        const v = await st.get(key);
        /* ⭐ حذف السجلات المنتهية ⭐ — حماية من الاعتماد على TTL وحده ⭐
           📌 الـDO بيحذف المنتهي تلقائيًا ⭐ (expirationTtl ⭐)
              لكن أي سجل اتكتب بـttl=0 ⭐ وcarry حقل `exp` ⭐
              ⇒ لازم ينحذف أول ما يتقضى ⭐. */
        if (v && typeof v === 'object' && Number(v.exp || 0) > 0
            && Number(v.exp) <= nowSec()) {
          try { await st.delete(key); } catch (e) { }
          return jsonOut({ ok: true, value: null, expired: true });
        }
        return jsonOut({ ok: true, value: (v === undefined ? null : v) });
      }
      if (op === 'put') {
        const ttl = Number(cmd.ttl || 0);
        /* ⭐ حدّ أدنى للـTTL ⭐ (عقد Cloudflare ⭐: 60 ثانية ⭐)
           📌 TTL أقصر ⇒ الـDO بيرفضه ⇒ ⛔ خطأ صامت ⭐ ⇒
              ⭐ من هنا نفحصه صريحًا ⭐. */
        if (ttl > 0 && ttl < 60) {
          return jsonOut({ ok: false, error: 'ttl_too_short' }, 400);
        }
        const opts = ttl > 0 ? { expirationTtl: ttl } : undefined;
        await st.put(key, (cmd.value === undefined ? null : cmd.value), opts);
        return jsonOut({ ok: true });
      }
      if (op === 'del') {
        await st.delete(key);
        return jsonOut({ ok: true });
      }
      if (op === 'list') {
        /* ⭐⭐⭐ (R28 · FINDING-01) ⭐⭐⭐ عقد Durable Objects الحقيقي ⭐⭐⭐
           📌 `storage.list()` في Cloudflare بترجّع **Map** ⭐ (مفتاح ← قيمة) ⭐
              ⭐ مش `{keys, cursor}` ⭐ (ده شكل Workers KV ⭐ / العقد القديم ⭐).
           📌 الكود القديم ⭐ كان يقرأ `res.keys` ⭐ ⇒ ⛔ undefined ⭐
              ⇒ ⛔ الاستثناء كان بيبتلع ⇒ ⛔ 500 storage_failed ⭐
              ⇒ ⛔ ⇒ المسارات المعتمدة على العدّ كانت ميتة في الإنتاج ⭐.
           ✅ دلوقتي ⭐: الشكل الأساسي = Map ⭐ + تحمّل الشكل القديم ⭐
              (است compatiblity مع نشر مُزاح ⭐). */
        const prefix = String(cmd.prefix || '');
        const res = await st.list({ prefix: prefix });
        const out = [];
        if (res && typeof res.keys === 'function') {
          /* ⭐ عقد DO الحقيقي ⭐ */
          for (const k of res.keys()) out.push(String(k));
        } else if (res && Array.isArray(res.keys)) {
          /* ⭐ عقد قديم / Workers KV ⭐ (تحمّل ⭐) */
          for (const k of res.keys) out.push(String(k && k.name !== undefined ? k.name : k));
        } else if (res && typeof res.forEach === 'function') {
          for (const k of res.keys()) out.push(String(k));
        } else {
          return jsonOut({ ok: false, error: 'bad_list_shape' }, 500);
        }
        out.sort();
        return jsonOut({ ok: true, keys: out, count: out.length });
      }
      /* ⭐⭐⭐ (R28) ⭐ التنبيهات ⭐ — إضافة ذرّية ⭐ (R26-I04 ⭐) ⭐ */
      if (op === 'alerts_add') {
        const rec = (await st.get(key)) || { items: [] };
        const items = Array.isArray(rec.items) ? rec.items.slice() : [];
        const item = (cmd.item && typeof cmd.item === 'object') ? cmd.item : {};
        const id = String(item.id || '').trim();
        if (id && items.some(a => a && a.id === id)) {
          return jsonOut({ ok: true, created: false, dedup: true, items: items });
        }
        const entry = {
          id: id || ('al_' + Date.now() + '_' + items.length),
          symbol: String(item.symbol || '').trim().toUpperCase(),
          kind: String(item.kind || 'price'),
          created_at: Math.floor(Date.now() / 1000),
          active: true,
        };
        items.push(entry);
        await st.put(key, { items: items });
        return jsonOut({ ok: true, created: true, items: items });
      }
      /* ⭐⭐⭐ (R28) ⭐ المحفظة ⭐ — كتابة ذرّية ⭐ (R26-I04 ⭐) ⭐ */
      if (op === 'pf_set') {
        const cur = (await st.get(key)) || { cash: 0, positions: {} };
        const patch = (cmd.patch && typeof cmd.patch === 'object') ? cmd.patch : {};
        const cash = (patch.cash !== undefined && patch.cash !== null)
          ? Math.round(Number(patch.cash) * 100) / 100
          : (cur.cash || 0);
        const positions = (patch.positions && typeof patch.positions === 'object')
          ? patch.positions
          : (cur.positions || {});
        const next = { cash: cash, positions: positions, updated_at: Math.floor(Date.now() / 1000) };
        await st.put(key, next);
        return jsonOut({ ok: true, portfolio: next });
      }
      return jsonOut({ ok: false, error: 'bad_op' }, 400);
    } catch (e) {
      return jsonOut({ ok: false, error: 'storage_failed' }, 500);
    }
  }
}
