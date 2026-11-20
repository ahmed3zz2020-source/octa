/* ══════════════════════════════════════════════════════════════════════
   🧪 Durable Object وهمي — للاختبارات ⭐
   ──────────────────────────────────────────────────────────────────────
   📌 why ⭐: العامل ⭐ في الإنتاج ⭐ (fail-closed ⭐) ⛔ بيفحص الإبطال ⭐
      في الـDO ⭐ ⇒ ⛔ من غير DO ⭐ ⇒ ⛔ كل جلسة مرفوضة ⭐ (503 ⭐).
   📌 فالمock لازم يبقى **محايد** ⭐ (مش production ⭐) ⭐ + ⭐ يحاكي المسارات ⭐:
      /revoke · /check · /clear · /pwd · /attempts ⭐.
   📌 ⭐ مافيش أسرار ⭐ — كل القيم وهمية ⭐.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const crypto = require('node:crypto');

/* ⭐ مخزن لكل instance ⭐ (الـDO الحقيقي: كل instance ليها storage خاص ⭐) */
function makeDO() {
  const instances = new Map();

  function inst(name) {
    if (!instances.has(name)) instances.set(name, new Map());
    return instances.get(name);
  }

  return {
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => {
      const name = String(id && id.name);
      const store = inst(name);
      return {
        async fetch(url, init) {
          const u = String(url);
          const p = u.replace(/^https:\/\/[^/]+/, '');
          const method = String((init && init.method) || 'GET').toUpperCase();
          let body = {};
          try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) { body = {}; }
          const json = (o, s) => new Response(JSON.stringify(o), {
            status: s || 200, headers: { 'Content-Type': 'application/json' },
          });

          /* ⭐ حالة كلمة المرور ⭐ */
          if (p === '/pwd' && method === 'GET') {
            return json({ ok: true, pwd: store.get('pwd') || null });
          }
          if (p === '/pwd' && method === 'POST') {
            const salt = String(body.salt || '');
            const hash = String(body.hash || '');
            const ver = String(body.ver || '');
            if (!salt || !hash || !ver) return json({ ok: false, error: 'bad-request' }, 400);
            store.set('pwd', { salt, hash, ver });
            return json({ ok: true });
          }

          /* ⭐ عدّاد المحاولات ⭐ */
          if (p === '/attempts' && method === 'POST') {
            const action = String(body.action || 'fail');
            if (action === 'ok') {
              store.delete('att');
              return json({ ok: true, n: 0, locked: false });
            }
            const rec = store.get('att') || { n: 0, t: Date.now() };
            const now = Date.now();
            if (!rec.t || (now - rec.t) > 15 * 60 * 1000) { rec.n = 0; rec.t = now; }
            rec.n = Number(rec.n || 0) + 1;
            rec.t = now;
            store.set('att', rec);
            return json({ ok: true, n: rec.n, locked: rec.n >= 8 });
          }

          /* ⭐ الإبطال ⭐ */
          if (p === '/revoke' && method === 'POST') {
            store.set('revoked', true);
            return json({ ok: true, revoked: true });
          }
          if (p === '/check' && method === 'GET') {
            return json({ revoked: store.get('revoked') === true });
          }
          if (p === '/clear' && method === 'POST') {
            store.delete('revoked');
            return json({ ok: true, revoked: false });
          }

          return json({ ok: false, error: 'not-found' }, 404);
        },
      };
    },
    /* ⭐ للاختبار ⭐ */
    __instances: instances,
  };
}

/* ⭐ بصمة الاعتماد ⭐ — مطابقة لـcredentialTag في العامل ⭐
   📌 ver ⭐ = النسخة ⭐ (0 ⭐ لو مافيش حالة ⭐). */
function credentialTag(pw, ver) {
  const v = ver === undefined || ver === null ? '0' : String(ver);
  return crypto.createHash('sha256').update(String(pw) + '|' + v).digest('hex').slice(0, 16);
}

/* ⭐ كوكي جلسة ⭐ — مطابق لتوقيع العامل ⭐
   📌 ⭐ لازم يحسب البصمة ⭐ (وإلا ⇒ ⛔ كل الجلسات مرفوضة ⭐). */
function sessionCookie(secret, pw, nowMs, ver) {
  const exp = String(nowMs + 3600 * 1000);
  const tag = credentialTag(pw, ver);
  const sig = crypto.createHmac('sha256', secret).update(exp + '.' + tag).digest('hex');
  return 'octa_mgmt_sess=' + encodeURIComponent(exp + '.' + sig);
}

module.exports = { makeDO, credentialTag, sessionCookie };
