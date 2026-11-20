/* ══════════════════════════════════════════════════════════════════════
   ⭐⭐⭐ (R29) ⭐⭐⭐ مخزن المعاينة — Durable Object ⭐⭐⭐
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

   ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ آلية انتهاء الصلاحية والتنظيف ⭐⭐⭐
   📌 السبب ⭐: ⛔ الاعتماد على `expirationTtl` ⭐ لوحده ⭐ ⇒ ⛔ أي سجل اتكتب
      بـttl=0 ⭐ وحمل حقل `exp` ⭐ ⇒ ⛔ بيفضل في المخزن ⭐ ⇒ ⛔ مايتنضفش ⭐
      إلا لما يتقرا ⭐ (والمسارات اللي مش بتقرا ⭐ ⇒ ⛔Spaces بتتراكم ⭐).
   ✅ الحل ⭐ (آلية **مدعومة** ⭐):
      ① `expirationTtl` ⭐ (الآلية الأصلية ⭐) بتظل ⭐.
      ② ⭐ `alarm()` ⭐ — المؤقّت الرسمي للـDO ⭐ ⇒ ⭐ تنظيف دوري ⭐
         لكل السجلات المنتهية ⭐ ⇒ ⭐ حتى لو ما اتقرتش ⭐.
      ③ ⭐ عملية `cleanup` ⭐ (تُستدعى من العامل ⭐) ⇒ ⭐ تنظيف فوري ⭐
         ⇒ ⭐ والدليل بيتحقق منها ⭐.
   ⭐⭐⭐ (R29 · FINDING-11/12) ⭐⭐⭐ عمليات ذرّية ⭐⭐⭐
      · `take` ⭐ ⇒ ⛔ استهلاك توكن الفتح ⭐ بقراءة + حذف **في عملية واحدة** ⭐
        ⇒ ⛔ التوكن ما بيتUsedش مرتين ⭐ (حتى مع طلبين متزامنين ⭐).
      · `chal_make` ⭐ ⇒ ⛔ كتابة كود التأكيد + صندوق البريد ⭐ في عملية واحدة ⭐
        ⇒ ⛔ مايبقاش كود من غير صندوق ⭐.
      · `acct_create` ⭐ ⇒ ⛔ إنشاء الحساب **بس لو مش موجود** ⭐ (مايكتبش فوق حساب ⭐).
      · `acct_set_pin` ⭐ ⇒ ⛔ تحديث الباسورد + رفع النسخة ⭐ في عملية واحدة ⭐.
      · `session_rotate` ⭐ ⇒ ⛔ إبطال القديم + إصدار البديل **في عملية واحدة** ⭐
        ⇒ ⛔ مافيش جلسة بديلة لو الإبطال فشل ⭐ ⭐ ولا أكتر من بديل واحد ⭐.
   ═══════════════════════════════════════════════════════════════════════ */

const DO_NAME = 'preview_state';

/* ⭐ الوقت بالثواني ⭐ (مصدر واحد ⭐) */
function nowSec() { return Math.floor(Date.now() / 1000); }

/* ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ مهلة التنظيف الدوري ⭐⭐⭐
   📌 ساعتين ⭐ ⇒ كل السجلات المنتهية بتتنضف حتى لو ما اتقرتش ⭐. */
const CLEANUP_ALARM_SEC = 2 * 3600;

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
    /* ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ أول جدولة ⭐⭐⭐
       📌 بتتشغّل مع أول نسخة من الـDO ⭐ ⇒ ⭐ التنظيف الدوري مضمون ⭐. */
    this.scheduleSweep();
  }

  /* ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ المؤقّت الرسمي للـDO ⭐⭐⭐
     📌 `alarm()` ⭐ هي الآلية المدعومة ⭐ لتنظيف دوري ⭐ بلا أيVotes ⭐.
     📌 لازم نعيد جدولة المؤقّت ⭐ ⇒ ⭐ التنظيف بيتكرر ⭐. */
  async alarm() {
    await this.sweepExpired();
    try { await this.state.storage.setAlarm(Date.now() + CLEANUP_ALARM_SEC * 1000); }
    catch (e) { }
  }

  /* ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ التنظيف ⭐⭐⭐
     📌 يمسح كل سجل منتهي ⭐ (حقل `exp` ⭐ في الماضي ⭐)
        ⇒ ⛔ حتى لو السجل **ما اتقراش** ⭐ ⇒ ⛔ بيشتغل بالجدولة ⭐. */
  async sweepExpired() {
    const st = this.state.storage;
    const now = nowSec();
    let removed = 0;
    let scanned = 0;
    try {
      const res = await st.list({});
      const keys = [];
      if (res && typeof res.keys === 'function') {
        for (const k of res.keys()) keys.push(String(k));
      } else if (res && Array.isArray(res.keys)) {
        for (const k of res.keys) keys.push(String(k && k.name !== undefined ? k.name : k));
      }
      for (const key of keys) {
        scanned += 1;
        const v = await st.get(key);
        if (v && typeof v === 'object' && Number(v.exp || 0) > 0
            && Number(v.exp) <= now) {
          await st.delete(key);
          removed += 1;
        }
      }
    } catch (e) {
      return { ok: false, error: 'sweep_failed' };
    }
    return { ok: true, removed: removed, scanned: scanned };
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
        /* ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ جدولة التنظيف ⭐⭐⭐
           📌 كل كتابة ⭐ بتجدوّل المؤقّت ⭐ ⇒ ⭐ السجلات المنتهية
              بتتنضف **حتى لو ما اتقرتش** ⭐. */
        this.scheduleSweep();
        return jsonOut({ ok: true });
      }
      if (op === 'del') {
        await st.delete(key);
        return jsonOut({ ok: true });
      }
      /* ⭐⭐⭐ (R29 · FINDING-11) ⭐⭐⭐ استهلاك ذرّ ⭐⭐⭐
         📌 قراءة + حذف **في عملية واحدة** ⭐ ⇒ ⛔ التوكن ما بيتUsedش مرتين ⭐.
         📌 (الطلبان المتزامنان ⭐ ⇒ ⭐ واحد بس ياخده ⭐ ⇒ ⭐ التاني يفشل ⭐.) */
      if (op === 'take') {
        const v = await st.get(key);
        if (v === undefined || v === null) {
          return jsonOut({ ok: true, value: null, consumed: false });
        }
        await st.delete(key);
        if (v && typeof v === 'object' && Number(v.exp || 0) > 0
            && Number(v.exp) <= nowSec()) {
          return jsonOut({ ok: true, value: null, consumed: true, expired: true });
        }
        return jsonOut({ ok: true, value: v, consumed: true });
      }
      /* ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ التنظيف الفوري ⭐⭐⭐ */
      if (op === 'cleanup') {
        const r = await this.sweepExpired();
        return jsonOut(r.ok ? { ok: true, removed: r.removed, scanned: r.scanned }
          : { ok: false, error: r.error }, r.ok ? 200 : 500);
      }
      /* ⭐⭐⭐ (R29 · FINDING-11) ⭐⭐⭐ كتابة كود التأكيد + صندوق البريد ⭐⭐⭐
         📌 عملية واحدة ⭐ ⇒ ⛔ مايبقاش كود من غير صندوق (ولا العكس ⭐). */
      if (op === 'chal_make') {
        const chal = (cmd.chal && typeof cmd.chal === 'object') ? cmd.chal : null;
        const mail = (cmd.mail && typeof cmd.mail === 'object') ? cmd.mail : null;
        if (!chal || !mail) return jsonOut({ ok: false, error: 'bad_payload' }, 400);
        const ttl = Number(cmd.ttl || 0);
        if (ttl > 0 && ttl < 60) return jsonOut({ ok: false, error: 'ttl_too_short' }, 400);
        const opts = ttl > 0 ? { expirationTtl: ttl } : undefined;
        await st.put(key, chal, opts);
        await st.put(String(cmd.mailKey || ''), mail, opts);
        this.scheduleSweep();
        return jsonOut({ ok: true });
      }
      /* ⭐⭐⭐ (R29 · FINDING-11) ⭐⭐⭐ إنشاء حساب **بس لو مش موجود** ⭐⭐⭐
         📌 ⛔ مايكتبش فوق حساب موجود ⭐ (الاستحواذ ممنوع ⭐). */
      if (op === 'acct_create') {
        const cur = await st.get(key);
        if (cur !== undefined && cur !== null) {
          return jsonOut({ ok: false, error: 'account_exists' }, 409);
        }
        await st.put(key, (cmd.value === undefined ? null : cmd.value),
          cmd.ttl > 0 ? { expirationTtl: Number(cmd.ttl) } : undefined);
        this.scheduleSweep();
        return jsonOut({ ok: true, created: true });
      }
      /* ⭐⭐⭐ (R29 · FINDING-11) ⭐⭐⭐ تحديث الباسورد + رفع النسخة ⭐⭐⭐
         📌 قراءة + تعديل + كتابة **في عملية واحدة** ⭐ ⇒ ⛔ مافيش سباق ⭐. */
      if (op === 'acct_set_pin') {
        const cur = await st.get(key);
        if (!cur) return jsonOut({ ok: false, error: 'no_account' }, 404);
        const patch = (cmd.patch && typeof cmd.patch === 'object') ? cmd.patch : {};
        const next = Object.assign({}, cur, patch);
        next.epoch = (Number(cur.epoch || 1) || 1) + 1;   /* ⛔ إبطال كل الجلسات ⭐ */
        await st.put(key, next);
        this.scheduleSweep();
        return jsonOut({ ok: true, value: next });
      }
      /* ⭐⭐⭐ (R29 · FINDING-12) ⭐⭐⭐ تدوير الجلسة ⭐⭐⭐
         📌 إبطال القديم + إصدار البديل **في عملية واحدة** ⭐ ⇒
            ⛔ لو الإبطال فشل ⭐ ⇒ ⛔ مافيش جلسة بديلة ⭐
            ⛔ و ⛔ بديل واحد بس ⭐ (مفيش إصدارات متعددة ⭐). */
      if (op === 'session_rotate') {
        const oldKey = String(cmd.oldKey || '');
        const newKey = String(cmd.newKey || '');
        if (!oldKey || !newKey) return jsonOut({ ok: false, error: 'bad_payload' }, 400);
        const old = await st.get(oldKey);
        if (!old) return jsonOut({ ok: false, error: 'old_session_missing' }, 409);
        const ttl = Number(cmd.ttl || 0);
        await st.delete(oldKey);
        await st.put(newKey, (cmd.value === undefined ? null : cmd.value),
          ttl > 0 ? { expirationTtl: ttl } : undefined);
        this.scheduleSweep();
        return jsonOut({ ok: true, rotated: true });
      }
      if (op === 'list') {
        /* ⭐⭐⭐ (R28 · FINDING-01) ⭐⭐⭐ عقد Durable Objects الحقيقي ⭐⭐⭐
           📌 `storage.list()` في Cloudflare بترجّع **Map** ⭐ (مفتاح ← قيمة) ⭐
              ⭐ مش `{keys, cursor}` ⭐ (ده شكل Workers KV ⭐ / العقد القديم ⭐).
           📌 الكود القديم ⭐ كان يقرأ `res.keys` ⭐ ⇒ ⛔ undefined ⭐
              ⇒ ⛔ الاستثناء كان بيبتلع ⭐ ⇒ ⛔ 500 storage_failed ⭐
              ⇒ ⛔ ⇒ المسارات المعتمدة على العدّ كانت ميتة في الإنتاج ⭐.
           ✅ دلوقتي ⭐: الشكل الأساسي = Map ⭐ + تحمّل الشكل القديم ⭐
              (است compatibility مع نشر مُزاح ⭐).
           ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ التنضيف أثناء العدّ ⭐⭐⭐
              ⇒ ⭐ السجلات المنتهية بتنضف **وهي بتعدّ** ⭐ (مش بتستنى قراءة ⭐). */
        const prefix = String(cmd.prefix || '');
        const res = await st.list({ prefix: prefix });
        const out = [];
        const expired = [];
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
        /* ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ ⛔ السجلات المنتهية بتتنضف ⭐⭐⭐ */
        const now = nowSec();
        const alive = [];
        for (const k of out) {
          const v = await st.get(k);
          if (v && typeof v === 'object' && Number(v.exp || 0) > 0
              && Number(v.exp) <= now) {
            try { await st.delete(k); } catch (e) { }
            expired.push(k);
            continue;
          }
          alive.push(k);
        }
        alive.sort();
        return jsonOut({ ok: true, keys: alive, count: alive.length, expired: expired.length });
      }
      /* ⭐⭐⭐ (R28) ⭐⭐ التنبيهات ⭐ — إضافة ذرّية ⭐ (R26-I04 ⭐) ⭐ */
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
      /* ⭐⭐⭐ (R28) ⭐⭐ المحفظة ⭐ — كتابة ذرّية ⭐ (R26-I04 ⭐) ⭐ */
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

  /* ⭐⭐⭐ (R29 · FINDING-19) ⭐⭐⭐ جدولة التنظيف ⭐⭐⭐
     📌 `getAlarm()` ⭐ بيرجّع **Promise** ⭐ ⇒ ⛔ لازم `await` ⭐
        ⇒ ⛔ من غيرها ⭐ الـPromise دايماً truthy ⭐ ⇒ ⛔ الجدولة ما بتgettingش ⭐. */
  async scheduleSweep() {
    try {
      const cur = await this.state.storage.getAlarm();
      if (!cur || cur <= Date.now()) {
        await this.state.storage.setAlarm(Date.now() + CLEANUP_ALARM_SEC * 1000);
      }
    } catch (e) { }
  }
}
