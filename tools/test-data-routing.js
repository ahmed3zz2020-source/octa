/* ══════════════════════════════════════════════════════════════
   🧪 اختبار Erm — تغطية التوجيه الجديد للبيانات
   شغّله:  node tools/test-data-routing.js
   مفيش dependencies — plain Node.
   ══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BACK = path.join(ROOT, '..', 'octa-prices', 'update_prices.py');
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ✅', name); pass++; }
  catch (e) { console.log('  ❌', name, '\n     →', e.message); fail++; }
}

/* ── 0) نبني رد /api/data_full الحقيقي بنفسنا (مش ملف /tmp) ── */
let NEW_API = null;
try {
  const py = [
    'import json',
    'from pathlib import Path',
    'src = open(' + JSON.stringify(BACK) + ', encoding="utf-8").read()',
    'ns = {"Path": Path, "__file__": ' + JSON.stringify(BACK) + '}',
    'exec(src[src.index(\'_DATA_FULL = {"mtime"\'):src.index(\'@app.route("/api/data_full")\')], ns)',
    'print(json.dumps(ns["_data_full_payload"]()))',
  ].join('\n');
  NEW_API = JSON.parse(execFileSync('python3', ['-c', py], { encoding: 'utf8' })
    .trim().split('\n').pop());
} catch (e) {
  console.log('  ⚠️  مقدرتش أبني رد الـAPI محلياً:', e.message);
}

/* ── 1) _isFullShape من octa-core.js ── */
const core = fs.readFileSync(path.join(ROOT, 'assets/js/octa-core.js'), 'utf8');
const shapeFn = core.slice(core.indexOf('function _isFullShape('),
                            core.indexOf('async function loadEgxFile('));
const _isFullShape = eval('(function(){' + shapeFn + '\nreturn _isFullShape;})()');

console.log('\n▸ شكل الرد (_isFullShape)');

const OLD_FILE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data_full.json'), 'utf8'));
assert.ok(NEW_API, 'رد الـAPI مطلوب — شغّل السكربت من جوه octa-prices');

t('الملف القديم (data_full.json) = full', () => {
  assert.strictEqual(_isFullShape(OLD_FILE), true);
});
t('الرد الجديد (/api/data_full) = full', () => {
  assert.strictEqual(_isFullShape(NEW_API), true);
});
t('/api/egx_full (الشكل القديم) = مش full', () => {
  const egx = { stocks: { COMI: { n: 'cib', en: 'CIB', s: 'بنوك', p: 120, score: 44, decision: 'x' } } };
  assert.strictEqual(_isFullShape(egx), false);
});
t('رد فاضي / 401 = مش full', () => {
  assert.strictEqual(_isFullShape(null), false);
  assert.strictEqual(_isFullShape({}), false);
  assert.strictEqual(_isFullShape({ ok:false, stocks:{}, _protected:true }), false);
});

/* ── 2) تكافؤ الداتا: الملف القديم ≡ الرد الجديد ── */
console.log('\n▸ تكافؤ الداتا (لاFeature lost)');

t('نفس عدد الأسهم: 285', () => {
  assert.strictEqual(Object.keys(NEW_API.stocks).length, 285);
  assert.strictEqual(Object.keys(OLD_FILE.stocks).length, 285);
});
t('نفس كودز الأسهم بالظبط', () => {
  assert.deepStrictEqual(Object.keys(NEW_API.stocks).sort(), Object.keys(OLD_FILE.stocks).sort());
});
t('صفر فرق في أي رقم / وزن / اسم', () => {
  const diffs = Object.keys(OLD_FILE.stocks)
    .filter(c => JSON.stringify(OLD_FILE.stocks[c]) !== JSON.stringify(NEW_API.stocks[c]));
  assert.deepStrictEqual(diffs, [], 'فرق في: ' + diffs.slice(0, 5).join(','));
});
t('نفس مجموعة الحقول لكل سهم (مش ناقص ولا زائد)', () => {
  const diffs = Object.keys(OLD_FILE.stocks)
    .filter(c => Object.keys(OLD_FILE.stocks[c]).sort().join() !==
                 Object.keys(NEW_API.stocks[c]).sort().join());
  assert.deepStrictEqual(diffs, [], 'اختلاف حقول في: ' + diffs.slice(0, 5).join(','));
});
t('مفيش سند حكومي (EGS) في الرد', () => {
  assert.deepStrictEqual(Object.keys(NEW_API.stocks).filter(c => c.startsWith('EGS')), []);
});
t('حقول الأذرع الخمسة موجودة (q·m·sf·lq·total)', () => {
  /* sf ناقصة عند 46 سهم — ده واقع الداتا القديمة نفسها، مش تغيير */
  const need = { q: 285, m: 285, lq: 285, total: 285, verdict: 285, conf: 285, sf: 239 };
  for (const k in need) {
    const n = Object.keys(NEW_API.stocks).filter(c => k in NEW_API.stocks[c]).length;
    assert.strictEqual(n, need[k], `${k}: ${n} بدل ${need[k]}`);
  }
});
t('حقول الفلاتر موجودة (de·cr·qr·roic·ps·av30·relvol)', () => {
  const need = ['de', 'cr', 'qr', 'roic', 'ps', 'evEbitda', 'av30', 'relvol', 'p', 'mc'];
  for (const c of Object.keys(NEW_API.stocks)) {
    for (const k of need) assert.ok(k in NEW_API.stocks[c], `${c}.${k} ناقصة`);
  }
});
t('حقول المخاطرة موجودة (vol1y·mdd·sharpe3y·cagr3y)', () => {
  const need = ['vol1y', 'vol3y', 'mdd', 'mdd1y', 'sharpe3y', 'sortino3y', 'cagr3y', 'frm52hi'];
  for (const c of Object.keys(NEW_API.stocks)) {
    for (const k of need) assert.ok(k in NEW_API.stocks[c], `${c}.${k} ناقصة`);
  }
});

/* ── 3) تبديل التوكن في octa-api.js ── */
console.log('\n▸ توكن المسارات المحمية');

const api = fs.readFileSync(path.join(ROOT, 'assets/js/octa-api.js'), 'utf8');
/* ⛔⛔ ٢١ أكتوبر ٢٠٢٦ — الموديل اتغيّر:
   التون�� مبعت مع **كل** نداء /api/* (مش ٨ مسارات بس)، لأن
   الباك بقى يقفل كل مسار بيانات ورا توكن. */
const authBlock = api.slice(api.indexOf('const OPEN_PATHS'),
                            api.indexOf('/* 🩺 لو الـWorker وقع'));
const fake = eval('(function(){ const localStorage={getItem:()=>"TOK-123"};' +
  ' const Headers=function(h){this.h=h||{};this.get=function(k){return this.h[k]||null};' +
  'this.set=function(k,v){this.h[k]=v}};' + authBlock +
  ' return {_pathOf, _isOpen, _withToken, OPEN_PATHS, OPEN_PREFIXES};})()');

t('/api/data_full في المسارات المفتوحة؟ لأ — لازم محمي', () => {
  assert.ok(fake.OPEN_PATHS.indexOf('/api/data_full') === -1);
});
t('المسارات المفتوحة: health · track · logos', () => {
  ['/api/health', '/api/track', '/api/logos'].forEach(p => {
    assert.ok(fake.OPEN_PATHS.indexOf(p) !== -1, p + ' مش مفتوح');
  });
});
t('الـauth كله مفتوح (تسجيل · دخول)', () => {
  assert.ok(fake.OPEN_PREFIXES.indexOf('/api/auth/') !== -1);
});
const U = 'https://octa-prices-production-4ccb.up.railway.app';
[['egx_full'], ['data_full'], ['ranking'], ['portfolio'], ['stats'],
 ['alerts/watch'], ['alerts/diag'], ['auth/me'], ['prices'], ['rank'],
 ['markets'], ['chat'], ['analyze'], ['candles/COMI']].forEach(([p]) => {
  t(`التوكن بيتلزق على /api/${p}`, () => {
    const o = fake._withToken(U + '/api/' + p + '?_=1');
    assert.ok(o && o.headers && o.headers.get('Authorization') === 'Bearer TOK-123');
    assert.strictEqual(o.credentials, 'same-origin');
  });
});
t('التوكن مش على رابط مش API', () => {
  assert.strictEqual(fake._withToken('data_ipo.json?_=1'), undefined);
  assert.strictEqual(fake._withToken('assets/js/octa-core.js'), undefined);
});
t('⛔ مفيش سر ولا توكن مكتوب في أي ملف واجهة', () => {
  const bad = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/js'))) {
    const full = path.join(ROOT, 'assets/js', f);
    if (!fs.statSync(full).isFile()) continue;   /* ⛔ مجلدات (vendor) */
    const s = fs.readFileSync(full, 'utf8');
    if (/OCTAD_TOKEN_SECRET|Bearer [A-Za-z0-9._-]{20,}/.test(s)) bad.push(f);
  }
  assert.deepStrictEqual(bad, []);
});

/* ── 4) البناء ── */
console.log('\n▸ حزمة النشر');
['data_full.json', 'data_egx.json', 'data_risk.json'].forEach(f => {
  t(`dist/${f} مش موجود`, () => assert.ok(!fs.existsSync(path.join(ROOT, 'dist', f))));
});
t('dist/index.html موجود', () => assert.ok(fs.existsSync(path.join(ROOT, 'dist/index.html'))));
t('dist/assets موجود', () => assert.ok(fs.existsSync(path.join(ROOT, 'dist/assets/js/octa-core.js'))));
t('مفيش أي .json جذر الـdist غير المسموح', () => {
  const j = fs.readdirSync(path.join(ROOT, 'dist')).filter(x => x.endsWith('.json'));
  assert.deepStrictEqual(j, ['data_ipo.json']);
});

console.log(`\n${fail ? '❌' : '✅'} ${pass} نجح · ${fail} فشل\n`);
process.exit(fail ? 1 : 0);
