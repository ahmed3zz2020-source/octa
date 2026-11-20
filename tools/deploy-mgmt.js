#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 🚀 نشر لوحة الإدارة (octa-mgmt) عبر Cloudflare REST API مباشرة
 ──────────────────────────────────────────────────────────────────────
 السبب: `wrangler deploy` بيفشل مع التوكن الحالي ⭐ (نقص صلاحية ⭐).

 📌 نفس آلية tools/cf-deploy.js ⭐ (المجرّبة ⭐) ⭐:
   ① manifest + assets-upload-session  → JWT + buckets ⭐
   ② POST /workers/assets/upload      → رفع الملفات ⭐
   ③ PUT /workers/scripts/<name>       → الـworker ⭐

 ⭐⭐⭐ القاعدة الأهم ⭐⭐⭐: ⛔ **ما بنكتبش أي سرّ في الميتاداتا** ⭐
   ⛔ الـsecrets (APP_PASSWORD · SESSION_SECRET · OCTA_ADMIN_TOKEN) ⭐
   ⛔ قيمهم **مش مقروءة** ⭐ (Cloudflare write-only ⭐) ⭐
   ⇒ ⛔ لو كنا نكتبهم ⇒ ⛔ نخسرهم ⭐ ⇒ ⛔ اللوحة تتكسر ⭐ ⇒ ⛔ لا رجعة ⭐.
   ✅ الحل ⭐: `keep_bindings: ["secret_text"]` ⭐
      ⇒ ⭐ Cloudflare بيحافظ على كل الأسرار الحالية ⭐
      (مُثبَت ⭐: خطأ 10021 ⭐ بتقول إن `keep_bindings` بتاخد **أنواع** ⭐
       ⭐ مش أسماء ⭐ ⇒ ⭐ `["secret_text"]` ⭐ هي الصيغة الصح ⭐).

 ⛔ حارس ⭐: النشر على `octa` (الإنتاج ⭐) ممنوع ⭐ — حماية ⭐.
 ⛔ حارس ⭐: `octa-mgmt` مسموح ⭐ (لوحة الإدارة ⭐) ⭐.

 الاستعمال:
   NAME=octa-mgmt MGMT_DIR=mgmt node tools/deploy-mgmt.js
 ══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = process.env.ACCOUNT_ID || '74e046678adabf0706024b97b205882b';
const NAME = process.env.NAME || 'octa-mgmt';
const MGMT_DIR = path.resolve(process.env.MGMT_DIR || 'mgmt');
const DIST = path.join(MGMT_DIR, 'public');
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;

if (!TOKEN) { console.error('⛔ CLOUDFLARE_API_TOKEN مش موجود'); process.exit(1); }

/* ⛔⛔⛔ حارس الإنتاج ⭐ — ما ننشرش على `octa` ⭐ */
if (NAME === 'octa') {
  console.error('⛔⛔⛔ رفض النشر على `octa` (الإنتاج ⭐). لوحة الإدارة بس ⭐.');
  process.exit(1);
}

/* ⭐ معرّفات الربط ⭐ — لازم تكون مطابقة للحي ⭐ */
const REVOKE_KV_ID = process.env.REVOKE_KV_ID || 'bbbbeb98fd604c07980da23e99848209';
const REVOKE_DO_ID = process.env.REVOKE_DO_ID || '2dcd0133aceb41eabc44c399924da06d';
const DO_CLASS = process.env.DO_CLASS || 'RevokeDO';

const CT = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.sh': 'text/x-shellscript', '.xml': 'application/xml', '.woff2': 'font/woff2',
  '.map': 'application/json',
};

async function api(pathname, opts = {}) {
  const res = await fetch(BASE + pathname, {
    ...opts,
    headers: { 'Authorization': `Bearer ${TOKEN}`, ...(opts.headers || {}) },
  });
  const text = await res.text();
  let j = null; try { j = JSON.parse(text); } catch (e) {}
  if (!res.ok || (j && j.success === false)) {
    const msg = j && j.errors ? JSON.stringify(j.errors) : text.slice(0, 500);
    throw new Error(`${opts.method || 'GET'} ${pathname} → ${res.status} ${msg}`);
  }
  return j ? (j.result !== undefined ? j.result : j) : text;
}

/* ── blake3 (WASM) ── */
let blake3 = null;
async function loadBlake3() {
  if (blake3) return blake3;
  /* ⭐ R28 ⭐: مجلد node_modules المحلي ⭐ أولًا ⭐
     📌 السبب ⭐: ذاكرة npm المؤقتة (_npx) مش موجودة في كل بيئة ⭐
       ⇒ أداة النشر كانت بتطيح رغم إن الحزمة متاحة محليًا ⭐. */
  const local = path.join(__dirname, '..', 'node_modules', 'blake3-wasm');
  if (fs.existsSync(local)) {
    try { blake3 = require(local); return blake3; } catch (e) { blake3 = null; }
  }
  const roots = ['/workspace/.home/.npm/_npx', path.join(process.env.HOME || '/root', '.npm/_npx')];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r)) {
      const c = path.join(r, d, 'node_modules/blake3-wasm');
      if (fs.existsSync(c)) { blake3 = require(c); return blake3; }
    }
  }
  throw new Error('blake3-wasm مش موجود');
}

(async () => {
  const b3 = await loadBlake3();

  /* ── 1) manifest ── */
  const files = [];
  (function walk(dir, base) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = base ? base + '/' + e.name : e.name;
      if (e.isDirectory()) walk(p, rel);
      else files.push({ rel, full: p });
    }
  })(DIST, '');

  const manifest = {};
  for (const f of files) {
    const buf = fs.readFileSync(f.full);
    const ext = path.extname(f.full).substring(1);
    const hash = b3.hash(Buffer.from(buf.toString('base64') + ext).toString('utf8')).toString('hex').slice(0, 32);
    manifest['/' + f.rel] = { hash, size: buf.length };
  }
  console.log(`📦 manifest: ${Object.keys(manifest).length} ملف`);

  /* ── 2) upload session ── */
  const sess = await api(`/workers/scripts/${NAME}/assets-upload-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest }),
  });
  let jwt = sess.jwt;
  const buckets = (sess.buckets || []).flat();
  console.log(`🔑 جلسة رفع: ${buckets.length} ملف مطلوب رفع`);

  if (buckets.length) {
    const byHash = {};
    for (const [rel, info] of Object.entries(manifest)) byHash[info.hash] = { rel: rel.replace(/^\//, ''), info };
    const form = new FormData();
    for (const h of buckets) {
      const e = byHash[h];
      if (!e) { console.warn(`  ⚠️ hash مش معروف: ${h}`); continue; }
      const buf = fs.readFileSync(path.join(DIST, e.rel));
      const ext = path.extname(e.rel);
      form.append(h, new Blob([buf.toString('base64')], { type: CT[ext] || 'application/octet-stream' }), h);
    }
    console.log(`📤 بنرفع ${buckets.length} ملف ...`);
    const up = await api('/workers/assets/upload?base64=true', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    const completionJwt = (up && up.jwt) ? up.jwt : null;
    console.log('✅ الأصول اترفعت' + (completionJwt ? ' · completion token ✅' : ' · ⛔ مفيش completion token!'));
    if (!completionJwt) throw new Error('مفيش completion token من رد الرفع');
    jwt = completionJwt;
  } else {
    console.log('ℹ️ مفيش ملفات جديدة (الكاش كافي)');
  }

  /* ── 3) الـworker نفسه ──
     ⭐⭐⭐ `keep_bindings: ["secret_text"]` ⭐⭐⭐ ⇒ ⭐ الأسرار محفوظة ⭐ */
  const metadata = {
    main_module: 'worker.js',
    compatibility_date: '2026-11-01',
    compatibility_flags: ['nodejs_compat'],
    usage_model: 'standard',
    /* ⭐⭐⭐ الأهم ⭐⭐⭐ — ⭐ تحافظ على APP_PASSWORD ⭐ + SESSION_SECRET ⭐ + OCTA_ADMIN_TOKEN ⭐ */
    keep_bindings: ['secret_text'],
    bindings: [
      { name: 'APP_ENV', type: 'plain_text', text: 'production' },
      { name: 'ASSETS', type: 'assets' },
      { name: 'REVOKE_KV', type: 'kv_namespace', namespace_id: REVOKE_KV_ID },
      { name: 'REVOKE_DO', type: 'durable_object_namespace', namespace_id: REVOKE_DO_ID, class_name: DO_CLASS },
    ],
    /* ⭐⭐⭐ الـmigration ⭐⭐⭐
       📌 ⛔ العامل الحي ⭐ عنده class بالفعل ⭐ (وسم v1 ⭐ موجود ⭐).
       📌 ⛔ لو صرّحنا بالـmigration ⭐ ⇒ ⭐ Cloudflare يقارن ⭐
          «got tag '' when expected tag is 'v1'» ⭐ ⇒ ⭐ يرفض ⭐.
       ✅ الحل ⭐: ⭐ ما نصرّحش ⭐ ⭐ (الـclass موجود ⭐ ⇒ الـnamespace مربوط ⭐
          ⇒ ⭐ ما فيش migration جديد ⭐ ⇒ ⭐ ما فيش تعارض ⭐). */
    assets: {
      jwt,
      config: {
        base_path: '/',
        html_handling: 'none',
        not_found_handling: 'none',
        run_worker_first: true,
      },
    },
  };

  const wform = new FormData();
  wform.set('metadata', JSON.stringify(metadata));
  wform.set('worker.js', new Blob([fs.readFileSync(path.join(MGMT_DIR, 'worker.js'))],
    { type: 'application/javascript+module' }), 'worker.js');

  console.log('📤 بنرفع الـworker ...');
  const res = await api(`/workers/scripts/${NAME}?include_subdomain_availability=true`, {
    method: 'PUT',
    body: wform,
  });
  console.log('✅ اتنشر بنجاح:', NAME);
  console.log('   ', JSON.stringify(res).slice(0, 300));
})().catch(e => {
  console.error('⛔ فشل:', e.message);
  process.exit(1);
});
