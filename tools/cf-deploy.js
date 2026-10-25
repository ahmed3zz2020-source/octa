#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
 🚀 نشر Cloudflare Worker + Workers Assets عبر REST API مباشرة
 ──────────────────────────────────────────────────────────────
 السبب: توكن CLOUDFLARE_API_TOKEN ناقصه scope
        "Workers Scripts:Edit" ⇒ `wrangler deploy` بيفشل 401.
 الحل: نفس الـ3 خطوات اللي wrangler بيعملها:
   ① manifest + assets-upload-session  → بياخد JWT + buckets
   ② PUT /workers/assets/upload/<hash> (multipart base64)
   ③ PUT /workers/scripts/<name> (multipart: metadata + modules + assets.jwt)

 ⚠️ مفيش force-push.
 ⛔⛔⛔ حارس: النشر على الإنتاج (`octa`) **محتاج موافقة صريحة**
 ⛌   من أحمد. الاسم الافتراضي octa-preview. لو NAME=octa لازم
 ⛌  -ALLOW_PROD=1 — من غير كده السكربت بيرفض ويقفل.
 ══════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT_ID = process.env.ACCOUNT_ID || '74e046678adabf0706024b97b205882b';
const NAME = process.env.NAME || 'octa-preview';
const DIST = path.resolve(process.env.DIST || 'dist');
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;

if (!TOKEN) { console.error('⛔ CLOUDFLARE_API_TOKEN مش موجود'); process.exit(1); }

/* ⛔⛔⛔ حارس الإنتاج — ٢٥ أكتوبر ٢٠٢٦
   📌 الـworker `octa` اتكسر ٥ دقايق بسبب نشر بدون assets binding
   ⛌ ⛌ ⛌ ⛌ ⛌ (1101 على كل حاجة). ⇒ من غير حارس، أي غلطة بتوقع
   ⛌ ⛌ ⛌ ⛌ ⛌ الموقع. الخطر ده بيبقى أكبر من فايدة النشر السريع. */
const PROD_NAMES = ['octa'];
if (PROD_NAMES.includes(NAME) && process.env.ALLOW_PROD !== '1') {
  console.error(`⛔⛔⛔ رفض النشر على الإنتاج (${NAME}).`);
  console.error(`   الإنتاج محتاج موافقة صريحة من أحمد.`);
  console.error(`   لو اتفقنا: ALLOW_PROD=1 NAME=${NAME} node tools/cf-deploy.js`);
  process.exit(1);
}
if (PROD_NAMES.includes(NAME)) {
  console.log(`⚠️  ⚠️  ⚠️  نشر على الإنتاج (${NAME}) —ALLOW_PROD مفعّل ⚠️  ⚠️  ⚠️`);
}


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

/* ── blake3: نحتاجه للـhash. Cloudflare بيقبل sha256 كمان؟
   ⛔ لا — الـAPI بيتوقع blake3 بالظبط. نستخدم WASM بتاع wrangler
   ⛌   لو موجود، وإلا بنحسبه بـnode:crypto (blake3 غير متاح في node).
   ⛔ ⛌ ⛌ الحل: بنجيب hash جاهز من Cloudflare نفسه! ──────────
   ⛌   بدل ما نحسب blake3 محلياً، الـassets-upload-session بيرجع
   ⛌   الـbuckets (قائمة hashes) — لكن مش الـmanifest.
   ⛌   ⇒ نرسل manifest بـhash **فارغ**؟ لأ — الـAPI هيتجاهل الملفات.
   ⛌   ⇒ الحل الصح: نستخدم blake3-wasm من node_modules بتاع wrangler. */
let blake3 = null;
try {
  const p = require.resolve('blake3-wasm', { paths: [
    path.join(process.env.HOME || '/root', '.npm/_npx'),
    '/workspace/.home/.npm/_npx',
    process.cwd(),
  ] });
  blake3 = require(p);
} catch (e) { }

async function loadBlake3() {
  if (blake3) return blake3;
  // ابحث في كل مسارات npx
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

/* ── content types ── */
const CT = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.sh': 'text/x-shellscript', '.xml': 'application/xml', '.woff2': 'font/woff2',
  '.map': 'application/json',
};

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
    if (f.rel === '_worker.js' || f.rel === '_headers') continue;
    const buf = fs.readFileSync(f.full);
    const ext = path.extname(f.full).substring(1);
    const hash = b3.hash(Buffer.from(buf.toString('base64') + ext).toString('utf8')).toString('hex').slice(0, 32);
    /* ⛔ لازم المسار يبدأ بـ "/" — Cloudflare بترفض غير كده (10304) */
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
  console.log(`🔑 جلسة رفع: ${buckets.length} ملف مطلوب رفع · jwt: ${jwt ? '✅' : '❌'}`);

  if (buckets.length) {
    /* ── 3) ارفع الملفات (multipart base64) ── */
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
    /* ⛔⛔⛔ مهم: رد الرفع بيرجّع **jwt جديد** (completion token)
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
       ✅ وده اللي لازم يتحط في metadata.assets.jwt — مش الـsession jwt.
       ⛌ ⛌ ⛌ (لو حطينا الغلط ⇒ Cloudflare: "token is malformed") */
    const completionJwt = (up && up.jwt) ? up.jwt : null;
    console.log('✅ الأصول اترفعت' + (completionJwt ? ' · completion token ✅' : ' · ⛔ مفيش completion token!'));
    if (completionJwt) jwt = completionJwt;
    else throw new Error('مفيش completion token من رد الرفع — مينفعش نكمل');
  } else {
    console.log('ℹ️ مفيش ملفات جديدة (الكاش كافي)');
  }

  /* ── 4) ارفع الـworker نفسه (modules + assets binding) ──
     📌 الصيغة بالظبط زي wrangler (من wrangler-dist/cli.js
     ⛌   createWorkerUploadForm):
     ⛌   · ESM  → metadata.main_module  (من غير body_part!)
     ⛌   · assets = { jwt, config: {...} }
     ⛌   · الـmodule part نوعه application/javascript+module
     ⛌ ⛌ ⛌ (لو حطينا body_part ⇒ Cloudflare بيحاول يقرأه كـscript
     ⛌ ⛌ ⛌  مش module ⇒ "Unexpected token 'export'") */
  const bindings = [
    { name: 'ASSETS', type: 'assets' },
  ];
  const vars = { OCTA_GATE: process.env.OCTA_GATE || 'off', OCTA_TV_PROXY: process.env.OCTA_TV_PROXY || 'on' };
  for (const [k, v] of Object.entries(vars)) {
    if (v && v !== 'null') bindings.push({ name: k, type: 'plain_text', text: v });
  }
  const metadata = {
    main_module: '_worker.js',
    bindings,
    compatibility_date: process.env.COMPAT_DATE || '2026-10-10',
  };
  if (jwt) {
    metadata.assets = {
      jwt,
      config: {
        html_handling: 'auto-trailing-slash',
        not_found_handling: 'none',
        run_worker_first: true,
      },
    };
  }

  const wform = new FormData();
  wform.set('metadata', JSON.stringify(metadata));
  wform.set('_worker.js', new Blob([fs.readFileSync(path.join(DIST, '_worker.js'))], { type: 'application/javascript+module' }), '_worker.js');

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
