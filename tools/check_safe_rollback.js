/* ═══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ٢٤ (R24 · المرحلة الأولى) — فحص نسخة التراجع الآمنة
   ───────────────────────────────────────────────────────────────────────
   📌 الهدف: إثبات رقمي ⭐ (مش كلام ⭐) إن حزمة التراجع:
      ① بتسدّ **١٨ صيغة** من صيغ تسريب اللقطات ⭐ (كل واحدة ٤٠٤ ⭐).
      ② وتسيب **٦ مسارات** لازم تفضل شغالة ⭐ (كل واحد ٢٠٠ ⭐).
      ③ وإن «الحارس» نفسه ⭐ (مش مجرد النتيجة ⭐) بيكشف كل صيغة ⭐.

   📌 التشغيل:
      node tools/check_safe_rollback.js [worker-file] [--json out.json]
      الافتراضي: rollback/worker.v235-safe.js

   📌 المخرجات: أرقام ⭐ (LEAK_VARIANTS / BLOCKED / KEEP_ALIVE …) ⭐
      ورمز خروج ٠ = مسدود ⭐ · ١ = فيه تسريب ⭐ · ٢ = مسار سليم اتقفل ⭐.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/* ⭐ الأصول اللي فيها الملفان المقاسون ⭐ (سيناريو «النسخة الأقدم» ⭐) */
const OLD_BUNDLE = {
  'index.html': '<html><head></head><body>ok</body></html>',
  'market.html': '<html><body>market</body></html>',
  'data/opp_snapshot.json': JSON.stringify({
    ok: true, generated_at: '2026-11-10T03:22:36Z', model_version: 'leak',
    strategies: [], lists: { swing: { summary: {}, items: [{ code: 'LEAK' }] } }
  }),
  'data/alpha_snapshot.json': JSON.stringify({ ok: true, model_version: 'leak' }),
  'data/egx30_history.json': JSON.stringify({ ok: true, rows: [] }),
  'data/market_names.js': 'var OCTA_MARKET_NAMES = {};',
  'data/sahm_names_ar.json': JSON.stringify({ ok: true, names: [] })
};

/* ⭐ تطبيع سيرفر الأصول الحقيقي ⭐ (يحلّ ./ و.. و// ⭐) */
function resolveAssetKey(pathname) {
  const parts = [];
  for (const seg of String(pathname).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.join('/');
}

function makeAssets(files) {
  return {
    async fetch(request) {
      const u = new URL(request.url);
      /* ⭐ السيرفر الحقيقي بيفكّ ترميز المسار قبل ما يبحث ⭐
         ⇒ `%6f` ⇒ `o` ⭐ ⇒ لازم المحاكي يعمل كده ⭐
         ⇒ وإلا الاختبار هيخفي العيب ⭐ (هيعدّي من غير سبب ⭐). */
      let p = u.pathname;
      try { p = decodeURIComponent(p); } catch (e) { /* مسار مش مطبوع ⭐ */ }
      const name = resolveAssetKey(p.replace(/^\//, '')) || 'index.html';
      const body = files[name];
      if (body === undefined) return new Response('not found', { status: 404 });
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': name.endsWith('.json')
            ? 'application/json' : 'text/html; charset=utf-8'
        }
      });
    }
  };
}

/* ⭐ mock للـAPI (فحص الصحة ⭐) — مافيش شبكة ⭐ */
function apiMock(url) {
  const u = String(url);
  if (u.indexOf('/api/health') !== -1) {
    return Promise.resolve(new Response(
      JSON.stringify({ ok: true, status: 'ok' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  return Promise.resolve(new Response('{"ok":false}', {
    status: 503, headers: { 'Content-Type': 'application/json' }
  }));
}

function loadWorker(srcPath, withInternals) {
  const halan = fs.readFileSync(path.join(ROOT, 'halan-news.js'), 'utf8')
    .replace(/export\s+(function|const|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    .replace(/export\s+default\s+/g, '');
  let body = fs.readFileSync(srcPath, 'utf8')
    .replace(/^\s*import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/m, '')
    .replace(/export default/, 'module.exports =');
  if (withInternals) {
    /* ⭐ فتح الدوال الداخلية ⭐ (isSnapshotPath ⭐ normalizeAssetPath ⭐) */
    body += '\ntry { module.exports.__isSnapshotPath = isSnapshotPath; } catch (e) {}\n'
      + 'try { module.exports.__normalizeAssetPath = normalizeAssetPath; } catch (e) {}\n';
  }
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'Request', 'Response', 'Headers',
    'URL', 'fetch', 'setTimeout', 'crypto', 'atob', 'btoa',
    halan + '\n' + body);
  fn(mod, mod.exports, Request, Response, Headers, URL, apiMock,
    globalThis.setTimeout, globalThis.crypto, globalThis.atob, globalThis.btoa);
  return mod.exports;
}

/* ⭐⭐ ١٨ صيغة تسريب ⭐⭐
   ① ٧ صيغ للقطعة الفرص (مباشر ⭐ ./ ⭐ // ⭐ %6f ⭐ x/../ ⭐ %2e ⭐ %64ata ⭐)
   ② ٧ صيغ للقطعة ألفا (نفس السبعة ⭐)
   ③ ٤ صيغ ألفا إضافية (ترميز كامل ⭐ %64%61%74%61 ⭐ %2f ⭐ %2e ⭐) */
const LEAK_VARIANTS = [
  /* ① ٧ صيغ — لقطة الفرص */
  '/data/opp_snapshot.json',
  '/data/./opp_snapshot.json',
  '/data//opp_snapshot.json',
  '/data/%6fpp_snapshot.json',
  '/data/x/../opp_snapshot.json',
  '/data/opp_snapshot%2ejson',
  '/%64ata/opp_snapshot.json',
  /* ② ٧ صيغ — لقطة ألفا */
  '/data/alpha_snapshot.json',
  '/data/./alpha_snapshot.json',
  '/data//alpha_snapshot.json',
  '/data/%61lpha_snapshot.json',
  '/data/x/../alpha_snapshot.json',
  '/data/alpha_snapshot%2ejson',
  '/%64ata/alpha_snapshot.json',
  /* ③ ٤ صيغ — لقطة ألفا بترميز كامل */
  '/%64%61%74%61/alpha_snapshot.json',
  '/data%2falpha_snapshot.json',
  '/data/alpha%5fsnapshot.json',
  '/data/alpha_snapshot%2ejson'
];

/* ⭐ المسارات اللي لازم تفضل ٢٠٠ ⭐ */
const KEEP_PATHS = [
  '/index.html',
  '/market.html',
  '/data/egx30_history.json',
  '/data/market_names.js',
  '/data/sahm_names_ar.json',
  '/api/health'
];

function env() {
  return {
    OCTA_API_URL: 'https://staging.example.test',
    OCTA_OPP_SNAPSHOT: 'on',
    OCTA_ALPHA_SNAPSHOT: 'on',
    OCTA_GATE: 'on',
    ASSETS: makeAssets(OLD_BUNDLE)
  };
}

function req(p) {
  const h = new Headers();
  h.set('Cookie', 'octa_token=test-session-token');
  return new Request('https://preview.example.test' + p, { method: 'GET', headers: h });
}

(async () => {
  const args = process.argv.slice(2);
  let src = path.join(ROOT, 'rollback/worker.v235-safe.js');
  let jsonOut = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json' && args[i + 1]) { jsonOut = args[i + 1]; i++; }
    else if (!args[i].startsWith('--')) src = path.resolve(ROOT, args[i]);
  }

  const rel = path.relative(ROOT, src);
  if (!fs.existsSync(src)) {
    console.error('FILE_MISSING: ' + rel);
    process.exit(3);
  }

  const worker = loadWorker(src, false);
  const internals = loadWorker(src, true);

  const leakResults = [];
  let blocked = 0;
  for (const p of LEAK_VARIANTS) {
    const res = await worker.fetch(req(p), env(), {});
    const ok = res.status === 404;
    if (ok) blocked++;
    leakResults.push({ path: p, status: res.status, blocked: ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' LEAK ' + p + ' -> ' + res.status);
  }

  const keepResults = [];
  let alive = 0;
  for (const p of KEEP_PATHS) {
    const res = await worker.fetch(req(p), env(), {});
    const ok = res.status === 200;
    if (ok) alive++;
    keepResults.push({ path: p, status: res.status, alive: ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' KEEP ' + p + ' -> ' + res.status);
  }

  /* ⭐ فحص الحارس نفسه ⭐ (على المسار الخام ⭐ مش على الناتج ⭐) */
  let guardDetected = 0;
  const guardResults = [];
  const isSnap = internals.__isSnapshotPath;
  if (typeof isSnap === 'function') {
    for (const p of LEAK_VARIANTS) {
      const hit = !!isSnap(p);
      if (hit) guardDetected++;
      guardResults.push({ path: p, detected: hit });
    }
  }

  const summary = {
    file: rel,
    sha256: require('node:crypto').createHash('sha256')
      .update(fs.readFileSync(src)).digest('hex'),
    leak_variants: LEAK_VARIANTS.length,
    leak_blocked_404: blocked,
    leak_reachable: LEAK_VARIANTS.length - blocked,
    keep_paths: KEEP_PATHS.length,
    keep_alive_200: alive,
    keep_broken: KEEP_PATHS.length - alive,
    guard_direct_hits: guardDetected,
    guard_direct_total: LEAK_VARIANTS.length,
    guard_function_exposed: typeof isSnap === 'function',
    leak_results: leakResults,
    keep_results: keepResults,
    guard_results: guardResults
  };

  const pass = (summary.leak_reachable === 0) && (summary.keep_broken === 0) &&
    (summary.guard_function_exposed ? summary.guard_direct_hits ===
      LEAK_VARIANTS.length : true);

  summary.result = pass ? 'PASS' : 'FAIL';
  summary.exit_code = pass ? 0 : (summary.leak_reachable > 0 ? 1 : 2);

  console.log('');
  console.log('FILE: ' + rel);
  console.log('LEAK_VARIANTS: ' + summary.leak_variants);
  console.log('LEAK_BLOCKED_404: ' + summary.leak_blocked_404);
  console.log('LEAK_REACHABLE: ' + summary.leak_reachable);
  console.log('KEEP_PATHS: ' + summary.keep_paths);
  console.log('KEEP_ALIVE_200: ' + summary.keep_alive_200);
  console.log('KEEP_BROKEN: ' + summary.keep_broken);
  console.log('GUARD_DIRECT_HITS: ' + summary.guard_direct_hits + '/' +
    summary.guard_direct_total);
  console.log('RESULT: ' + summary.result);

  if (jsonOut) {
    const abs = path.resolve(ROOT, jsonOut);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(summary, null, 2) + '\n', 'utf8');
    console.log('JSON_WRITTEN: ' + path.relative(ROOT, abs));
  }

  process.exit(summary.exit_code);
})();
