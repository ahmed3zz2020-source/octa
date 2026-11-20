/* ═══════════════════════════════════════════════════════════════════════
   🛡️🛡️🛡️ الجولة ٢٥ (R25 · المرحلة ٤) — ⭐ **المعاينة المعزولة** ⭐
   (تنهي مشكلة Cloudflare 1016 ⭐ — من غير نفق مؤقت ⭐ ومن غير أي اتصال بالإنتاج ⭐)

   📌 القصة ⭐: ⛔ المعاينة كانت معتمدة على **نفق مؤقت** ⭐
      ⇒ ⛔ النفق بيموت ⭐ ⇒ ⛔ Cloudflare 1016 ⭐ ⇒ ⛔ 530 على /api/health ⭐
      ⇒ ⛔ ما ينفعشش يبقى وجهة دائمة ⭐ (والعقد نفسه بيمنع لواحق الأنفاق ⭐).

   📌 المطلوب ⭐:
      ① المعاينة تقدّم **فحص صحة من عندها** ⭐ (مش من الباك ⭐).
      ② ⭐ و ⛔ الإنتاج ما يتغيّرش ⭐ (الفحص يفضل من الـproxy ⭐).
      ③ ⭐ وجهة المعاينة في العقد = عامل workers.dev **ثابت** ⭐
         (مش نفق ⭐ ومش الإنتاج ⭐).
      ④ ⭐ متغيّر وضع المعاينة **مش** موجود في إعدادات الإنتاج ⭐.

   📌 التشغيل: node --test assets/tests/r25-preview-isolated.test.js
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

/* ⭐ تحميل العامل (نفس أسلوب r25-login-path ⭐) */
function loadWorker(srcText) {
  /* ⭐ العامل فيه \`import\` واحد (محرك الأخبار) → نشيله وندينا عنه بمحرك اختياري فارغ في الاختيار ماليص للفحص صحيح.
     ⭐ (R26) العامل بقى فيه اعتماد تاني ⭐ (preview-api.js ⭐ — المعاينة المعزولة ⭐)
     ⇒ لازم يتحمّل جوّه ⭐ وإلا المرجع يبقى مش معرّف ⭐ والرد 500 ⭐. */
  const previewSrc = fs.readFileSync(path.join(ROOT, 'preview-api.js'), 'utf8')
    .replace(/export\s+(function|const|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    .replace(/export\s+default\s+/g, '');
  /* ⭐ نطاق منفصل ⭐ (IIFE ⭐) ⇒ ⛔ مافيش تعارض أسماء مع العامل ⭐ (`sessionCookie` ⭐). */
  const previewMod = '(function(){\n' + previewSrc
    + '\nreturn { handlePreviewApi: handlePreviewApi };\n})()';
  const src = srcText
    .replace(/^import\s+\{[^}]*\}\s+from\s+'[^']*';?$/gm, '')
    .replace(/^export\s*\{[^}]*\};?$/gm, '')
    .replace('export default', 'module.exports =');
  const mod = { exports: {} };
  const stub = { newsEngine: {}, mergeEvents: () => [], eventsByCode: () => [], parseHalaText: () => [] };
  const fn = new Function('module', 'exports', 'Request', 'Response',
    'Headers', 'URL', 'crypto', 'newsEngine', 'mergeEvents', 'eventsByCode', 'parseHalaText',
    'const handlePreviewApi = ' + previewMod + '.handlePreviewApi;\n' + src);
  fn(mod, mod.exports, Request, Response, Headers, URL, crypto,
    stub.newsEngine, stub.mergeEvents, stub.eventsByCode, stub.parseHalaText);
  return mod.exports;
}

/* ⭐⭐ KV اصطناعي ⭐ للمعاينة المعزولة ⭐ (مش إنتاج ⭐ — مفيش اتصال ⭐) */
function fakePreviewKV() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      const keys = [];
      for (const k of store.keys()) if (k.indexOf(prefix) === 0) keys.push(k);
      return { keys, list_complete: true };
    },
  };
}

function workerSource() {
  return fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');
}

/* ⭐ بيئة بلا أي وصول خارجي ⭐ (لازم أي نداء خارجي يفشل ⭐) */
/* ⭐⭐⭐ (R28) ⭐ مخزن المعاينة (Durable Object ⭐) — الصنف الحقيقي ⭐ */
function fakePreviewDO() {
  const { PreviewStore } = require('../../preview-store.js');
  const map = new Map();
  const storage = {
    async get(k) { return map.has(k) ? map.get(k) : undefined; },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      const keys = [];
      for (const k of map.keys()) if (k.indexOf(prefix) === 0) keys.push({ name: k });
      return { keys: keys };
    },
  };
  const instance = new PreviewStore({ storage: storage }, {});
  return {
    map: map,
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => ({ async fetch(url, opts) { return instance.fetch(new Request(url, opts)); } }),
  };
}

function previewEnv() {
  return {
    OCTA_PREVIEW_SELF_API: 'on',
    OCTA_OPP_SNAPSHOT: 'on',
    OCTA_FAIL_CLOSED: 'on',
    /* ⭐ (R26) المعاينة المعزولة بقت عندها تخزينها الخاص وسر جلساتها ⭐
       ⛔ من غيرهم ⇒ 503 صريح ⭐ (مافيش نجاح وهمي ⭐)
       ⇒ ⭐ الاختبار هنا بيفحص المعاينة **المُهيّأة** ⭐
       ⭐ وحالة الإعداد الناقص متغطية في اختبار مستقل ⭐. */
    PREVIEW_KV: fakePreviewKV(),
    /* ⭐⭐⭐ (R28) ⭐ مخزن المعاينة القوي (Durable Object ⭐) ⭐
       📌 R26-I02 ⭐ ⇒ ⛔ إبطال الجلسات في الـKV مبيتنتشرش فوراً ⭐.
       📌 R26-I04 ⭐ ⇒ ⛔ الكتابات المتزامنة (المحفظة ⭐ / التنبيهات ⭐) بتضيع ⭐. */
    PREVIEW_STORE: fakePreviewDO(),
    PREVIEW_SESSION_SECRET: 'synthetic-preview-secret',
    PREVIEW_CONSOLE_KEY: 'synthetic-preview-console-key',
    ASSETS: {
      fetch: async () => {
        throw new Error('ASSETS fetch must not be needed for /api/health');
      },
    },
  };
}

function prodEnv() {
  return {
    OCTA_FAIL_CLOSED: 'on',
    ASSETS: {
      fetch: async () => {
        throw new Error('ASSETS fetch must not be needed for /api/health');
      },
    },
  };
}

test('R25-PV-01 · المعاينة المعزولة: /api/health محلي وبيقول مصدره بصراحة', async () => {
  const w = loadWorker(workerSource());
  const res = await w.fetch(new Request('https://octa-preview.ahmed3zz2020.workers.dev/api/health'),
    previewEnv(), { waitUntil() {}, passThroughOnException() {} });
  assert.equal(res.status, 200, 'local preview health must be 200');
  const j = await res.json();
  assert.equal(j.ok, true);
  assert.equal(j.source, 'preview-isolated',
    'the health must declare the isolated source (no pretending the backend is up)');
  assert.ok(!j.upstream, 'the preview health must not leak an internal upstream address');
});

test('R25-PV-02 · ⛔ الإنتاج ما يتغيّرش: من غير متغيّر الوضع ⇒ الفحص يفضل من الـproxy', async () => {
  const w = loadWorker(workerSource());
  const res = await w.fetch(new Request('https://octa-prices-production-4ccb.up.railway.app/api/health'),
    prodEnv(), { waitUntil() {}, passThroughOnException() {} });
  const txt = await res.text();
  assert.ok(txt.indexOf('"source":"preview-isolated"') === -1,
    'production must never answer with the isolated preview health');
});

test('R25-PV-03 · المسارات التانية مش بتتردّ بالفحص المحلي', async () => {
  const src = workerSource();
  const w = loadWorker(src);
  const res = await w.fetch(new Request('https://octa-preview.ahmed3zz2020.workers.dev/api/opp/strategies'),
    previewEnv(), { waitUntil() {}, passThroughOnException() {} });
  const txt = await res.text();
  assert.ok(txt.indexOf('"source":"preview-isolated"') === -1,
    'only /api/health may use the local isolated answer');
});

/* ⭐⭐ (R26) المعاينة من غير تخزينها الخاص ⭐ ⇒ 503 صريح ⭐ (fail-closed ⭐)
   📌 السبب ⭐: ⛔ المعاينة المعزولة صارت تقدّم الـAPI بنفسها ⭐
      ⇒ ⛔ من غير الـKV الخاص والسر الخاص ⭐ ⇒ ⛔ مافيش تشغيل ⭐
      ⇒ ⛔ ولازم يكون الرد واضح ⭐ (مش 200 وهمي ⭐). */
test('R25-PV-08 · ⭐ المعاينة من غير تخزينها الخاص ⇒ 503 صريح (مافيش نجاح وهمي)', async () => {
  const w = loadWorker(workerSource());
  const env = previewEnv();
  delete env.PREVIEW_KV;
  const res = await w.fetch(new Request('https://octa-preview.ahmed3zz2020.workers.dev/api/health'),
    env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(res.status, 503, 'لازم 503 (مش 200 وهمي): ' + res.status);
  const j = await res.json();
  assert.equal(j.ok, false);
  assert.equal(j.error, 'preview_backend_misconfigured');
});

test('R25-PV-04 · ⭐ عقد المعاينة: وجهة ثابتة ⭐ مش نفق ⭐ ومش الإنتاج', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/config/preview.json'), 'utf8'));
  const pv = cfg.preview;
  assert.ok(pv.apiBaseUrl && pv.apiBaseUrl.length > 0, 'the preview origin must be configured');
  assert.ok(pv.apiBaseUrl.indexOf('workers.dev') > 0,
    'the preview origin must be a stable workers.dev host');
  const forbidden = (cfg.forbidden.hosts || []).concat(cfg.forbidden.hostSuffixes || []);
  const host = pv.apiBaseUrl.replace(/^https?:\/\//, '');
  forbidden.forEach((f) => {
    const hit = f.indexOf('*') >= 0
      ? host.endsWith(f.replace('*', ''))
      : host === f || host.indexOf(f) === 0;
    assert.ok(!hit, 'the preview origin must not match the forbidden entry: ' + f);
  });
  (cfg.production.hosts || []).forEach((h) => {
    assert.ok(host !== h, 'the preview origin must differ from the production host: ' + h);
  });
});

test('R25-PV-05 · متغيّر وضع المعاينة موجود في إعدادات المعاينة ومش في الإنتاج', () => {
  const pv = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
  const prod = fs.readFileSync(path.join(ROOT, 'wrangler-prod.jsonc'), 'utf8');
  assert.ok(pv.indexOf('"OCTA_PREVIEW_SELF_API"') > 0,
    'the preview config must enable the isolated mode');
  assert.ok(prod.indexOf('"OCTA_PREVIEW_SELF_API"') === -1,
    'the production config must NOT enable the isolated mode');
});

test('R25-PV-06 · ⭐⭐ البرهان السالب ⭐: شيل الكتبة ⇔ الرد المحلي يختفي', async () => {
  /* ⭐ برهان mutation مستقل من الكود لعيّر الإصلاح ⭐ */
  const src = workerSource();
  const marker = 'OCTA_PREVIEW_SELF_API';
  assert.ok(src.indexOf(marker) > 0, 'the patched worker must contain the isolated mode');
  /* ⭐⭐ mutation بتوفيق واحد: بطول الكتبة لصفر ⇒ الفحص يرجع للباك ⇔ لا تطبيق الوجهة المحلية ⭐ */
  const cut = src.split("OCTA_PREVIEW_SELF_API === 'on'").join("OCTA_PREVIEW_SELF_API === 'off'");
  const w = loadWorker(cut);
  let body = '';
  try {
    const res = await w.fetch(new Request('https://octa-preview.ahmed3zz2020.workers.dev/api/health'),
      previewEnv(), { waitUntil() {}, passThroughOnException() {} });
    body = await res.text();
  } catch (e) {
    body = 'threw:' + String(e && e.message);
  }
  assert.ok(body.indexOf('"source":"preview-isolated"') === -1,
    'without the isolated block the health must NOT be the local isolated answer');
});

test('R25-PV-07 · ⭐⭐ البرهان السالب ⭐: الأساس (الرج قبل المرحلة ⭐) مفيش المود المحلي', () => {
  let before = '';
  try {
    before = execFileSync('git', ['show', '2f7338df9f63721fd7179d9fa406f82d7c2eb0fa:worker.js'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return; /* ⭐ مفيش تاريخ ⭐ (مفيش فشل ⭐) */
  }
  assert.ok(before.indexOf('OCTA_PREVIEW_SELF_API') === -1,
    'the pre-R25-phase4 baseline must not contain the isolated preview mode');
});
