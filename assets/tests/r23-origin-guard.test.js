/* ═══════════════════════════════════════════════════════════════
 *  🧪 الجولة ٢٣ (R23) · حارس الوجهة — اختبارات الوحدة
 *  ───────────────────────────────────────────────────────────────
 *  📌 السبب: المعاينة كانت بتروّح على نفق trycloudflare ميت ⇒
 *     Cloudflare 1016 ⇒ 530 على /api/* ⇒ الواجهة فاكرة إن
 *     «الباسورد غلط» ⇒ المستخدم بيتّهم بإيمه.
 *  📌 المطلوب (مكتوب في تكليف المالك):
 *     ① المعاينة ما تناديش الإنتاج (مطلقاً).
 *     ② الإنتاج ما يستعملش وجهة المعاينة.
 *     ③ العقدة ناقصة ⇒ fail closed (مش ارتجاع للإنتاج).
 *     ④ NXDOMAIN / وجهة مش رادّة ⇒ حالة خطأ واضحة (مش صمت).
 *  📌 كل الاختبارات **محدّدة** (deterministic) — مفيش شبكة.
 *  📌 التشغيل: node --test assets/tests/r23-origin-guard.test.js
 *  ═══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const GUARD = require(path.join(ROOT, 'assets', 'js', 'octa-origin-guard.js'));
const API_JS = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-api.js'), 'utf8');
const GATE_JS = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-gate.js'), 'utf8');
const CONFIG_PATH = path.join(ROOT, 'assets', 'config', 'preview.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

/* 📌 عنوان إنتاج (حقيقي · معروف من المستودع) */
const PROD = 'https://octa-prices-production-4ccb.up.railway.app';
const PROD_HOST = 'octa-prices-production-4ccb.up.railway.app';
/* 📌 وجهة المعاينة المثبّتة في العقدة ⭐
   ⭐ العقدة هي المصدر ⭐ (ولا من المرجعة ⭐) ⇔ الختبار الحارس
   ⭐ والإفصاح يقول مخطط واحد ⭐. */
const PREVIEW = String(CONFIG.preview.apiBaseUrl || 'https://octa-preview-api.up.railway.app');

/* ═══════════════════════════════════════════════════════════════
 *  ①  وضع التشغيل
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G1 · وضع المعاينة: أي دومين غير الإنتاج = معاينة', () => {
  assert.equal(GUARD.detectMode({ hostname: 'octa-preview.ahmed3zz2020.workers.dev' }), 'preview');
  assert.equal(GUARD.detectMode({ hostname: 'octa.local' }), 'preview');
  assert.equal(GUARD.detectMode({ hostname: '127.0.0.1' }), 'preview');
  assert.equal(GUARD.detectMode({ hostname: '' }), 'preview');
});

test('R23-G1 · وضع الإنتاج: دومين OCTA الحقيقي', () => {
  assert.equal(GUARD.detectMode({ hostname: 'octashares.com' }), 'production');
  assert.equal(GUARD.detectMode({ hostname: 'www.octashares.com' }), 'production');
});

test('R23-G1 · الوضع الصريح بيتقدّم على الكشف من الدومين', () => {
  assert.equal(GUARD.detectMode({ hostname: 'octashares.com', mode: 'preview' }), 'preview');
  assert.equal(GUARD.detectMode({ hostname: 'octa.local', mode: 'production' }), 'production');
});

/* ═══════════════════════════════════════════════════════════════
 *  ②  ⛔ المعاينة ⇒ ممنوعة من الإنتاج
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G2 · ⛔ المعاينة + وجهة إنتاج ⇒ مرفوض (مش ارتجاع صامت)', () => {
  const v = GUARD.evaluateOrigin({
    mode: 'preview', config: CONFIG, runtimeOrigin: PROD
  });
  assert.equal(v.ok, false, 'لازم يترفض');
  assert.equal(v.code, GUARD.CODES.PRODUCTION_IN_PREVIEW);
  assert.ok(v.message && v.message.length > 10, 'لازم يكون فيه رسالة');
});

test('R23-G2 · ⛔ المعاينة + وجهة الإنتاج المدسوسة في العقدة ⇒ مرفوض', () => {
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.preview.apiBaseUrl = PROD;
  const v = GUARD.evaluateOrigin({ mode: 'preview', config: cfg, runtimeOrigin: PROD });
  assert.equal(v.ok, false);
  assert.equal(v.code, GUARD.CODES.PRODUCTION_IN_PREVIEW);
});

test('R23-G2 · ⛔ المعاينة + subrange من الإنتاج ⇒ مرفوض برضه', () => {
  const v = GUARD.evaluateOrigin({
    mode: 'preview', config: CONFIG,
    runtimeOrigin: 'https://sub.' + PROD_HOST
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, GUARD.CODES.PRODUCTION_IN_PREVIEW);
});

test('R23-G2 · المعاينة + وجهة منفصلة ⇒ مسموحة', () => {
  const v = GUARD.evaluateOrigin({
    mode: 'preview', config: CONFIG, runtimeOrigin: PREVIEW
  });
  assert.equal(v.ok, true, 'لازم يمر: ' + v.code);
  assert.equal(v.code, GUARD.CODES.OK);
});

/* ═══════════════════════════════════════════════════════════════
 *  ③  ⛔ الإنتاج ⇒ ممنوع من وجهة المعاينة
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G3 · ⛔ الإنتاج + وجهة المعاينة ⇒ مرفوض', () => {
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.preview.apiBaseUrl = PREVIEW;
  const v = GUARD.evaluateOrigin({
    mode: 'production', config: cfg, runtimeOrigin: PREVIEW
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, GUARD.CODES.PREVIEW_IN_PRODUCTION);
});

test('R23-G3 · الإنتاج + نفس الأصل (الـworker) ⇒ مسموح', () => {
  const v = GUARD.evaluateOrigin({
    mode: 'production', config: CONFIG, runtimeOrigin: ''
  });
  assert.equal(v.ok, true, 'الإنتاج بيتكلم مع نفس الأصل — لازم يمر');
});

test('R23-G3 · الإنتاج + وجهة الإنتاج ⇒ مسموحة', () => {
  const v = GUARD.evaluateOrigin({
    mode: 'production', config: CONFIG, runtimeOrigin: PROD
  });
  assert.equal(v.ok, true, 'لازم يمر');
});

/* ═══════════════════════════════════════════════════════════════
 *  ④  ⛔ fail closed — العقدة ناقصة / الوجهة ناقصة / تعارض
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G4 · ⛔ المعاينة من غير عقدة ⇒ fail closed', () => {
  const v = GUARD.evaluateOrigin({ mode: 'preview', config: null, runtimeOrigin: PREVIEW });
  assert.equal(v.ok, false);
  assert.equal(v.code, GUARD.CODES.CONFIG_MISSING);
});

test('R23-G4 · ⭐ المعاينة من غير وجهة ⇒ نفس الأصل (مش ارتجاع للإنتاج)', () => {
  /* (R26) المعاينة المعزولة بقت تقدّم الـAPI بنفسها ⇒ نفس الأصل.
     ⛔⇒ مافيش وجهة خارجية ⇒ ⛔ مافيش خطر ⇒ مسموح ⭐ (مش مقفول ⭐).
     📌 المعيار الحقيقي ⭐: ⛔ النتيجة ما تكونش أي وجهة خارجية ⭐
        (خصوصاً ⛔ إنتاج ⭐ ولا ⛔ نفق ⭐) — والوجهة تفضل **نسبية** ⭐. */
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.preview.apiBaseUrl = '';
  const v = GUARD.evaluateOrigin({ mode: 'preview', config: cfg, runtimeOrigin: '' });
  assert.equal(v.ok, true, 'نفس الأصل لازم يمر: ' + v.code);
  assert.equal(v.code, GUARD.CODES.OK);
  assert.equal(String(v.origin || ''), '', 'الوجهة لازم تفضل نسبية (مافيش ارتجاع)');
  assert.equal(GUARD.isProductionHost(GUARD.hostOf(v.origin || ''), cfg), false,
    'ممنوع ترجع لوجهة إنتاج');
  assert.equal(GUARD.isTunnelHost(GUARD.hostOf(v.origin || ''), cfg), false,
    'ممنوع ترجع لنفق مؤقت');
});

test('R23-G4 · ⛔ عقدة بلا وجهة مثبّتة ⇔ وجهة من العامل مقبولة', () => {
  /* ⭐ العقدة بلا وجهة مشبّتة ⭐ (مفتح الوجهة مصناعة ⭐)
     ⭐ ولا العامل بعد وجهة خارجة ⭐ ⇔ ماموس ⭐ (الحارس مغلق ⭐). */
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.preview.apiBaseUrl = '';
  const v = GUARD.evaluateOrigin({ mode: 'preview', config: cfg, runtimeOrigin: PREVIEW });
  assert.equal(v.ok, true, 'لازم يمر: ' + v.code);
  assert.equal(v.code, GUARD.CODES.OK);
});

test('R23-G4 · ⛔ تعارض بين العامل والعقدة ⇒ fail closed', () => {
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.preview.apiBaseUrl = 'https://octa-preview-api.up.railway.app';
  const v = GUARD.evaluateOrigin({
    mode: 'preview', config: cfg, runtimeOrigin: 'https://other-preview.up.railway.app'
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, GUARD.CODES.ORIGIN_MISMATCH);
});

test('R23-G4 · ⛔ نفق مؤقت ⇒ مرفوض (النفق ده السبب الحقيقي للـ530)', () => {
  const v = GUARD.evaluateOrigin({
    mode: 'preview', config: CONFIG,
    runtimeOrigin: 'https://grande-referred-carlo-mere.trycloudflare.com'
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, GUARD.CODES.TUNNEL_ORIGIN);
});

test('R23-G4 · نفق مؤقت مرفوض في الإنتاج برضه', () => {
  const v = GUARD.evaluateOrigin({
    mode: 'production', config: CONFIG,
    runtimeOrigin: 'https://grande-referred-carlo-mere.trycloudflare.com'
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, GUARD.CODES.TUNNEL_ORIGIN);
});

/* ═══════════════════════════════════════════════════════════════
 *  ⑤  🩺 كاشف النفق الميت — NXDOMAIN ووجهة مش رادّة
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G5 · 🩺 DNS مش موجود (NXDOMAIN) ⇒ «خطأ DNS» مش 530 عام', async () => {
  const p = await GUARD.probeOrigin('https://dead-tunnel.trycloudflare.com', {
    resolve: () => Promise.resolve({ code: 'nxdomain' }),
    health: () => Promise.resolve({ ok: true, status: 200 })
  });
  assert.equal(p.ok, false);
  assert.equal(p.code, GUARD.CODES.ORIGIN_DNS_ERROR);
  assert.ok(p.message.indexOf('DNS') > -1, 'الرسالة لازم تذكر DNS: ' + p.message);
});

test('R23-G5 · 🩺 /api/health مش رادٍ ⇒ «الوجهة مش موصولة»', async () => {
  const p = await GUARD.probeOrigin('https://origin.example.test', {
    resolve: () => Promise.resolve({ code: 'ok', addresses: ['1.2.3.4'] }),
    health: () => Promise.resolve({ ok: false, status: 0 })
  });
  assert.equal(p.ok, false);
  assert.equal(p.code, GUARD.CODES.ORIGIN_UNREACHABLE);
});

test('R23-G5 · 🩺 الوجهة سليمة ⇒ ok', async () => {
  const p = await GUARD.probeOrigin('https://origin.example.test', {
    resolve: () => Promise.resolve({ code: 'ok', addresses: ['1.2.3.4'] }),
    health: () => Promise.resolve({ ok: true, status: 200 })
  });
  assert.equal(p.ok, true);
  assert.equal(p.code, GUARD.CODES.OK);
});

test('R23-G5 · 🩺 مفيش وجهة ⇒ origin_missing (مش صمت)', async () => {
  const p = await GUARD.probeOrigin('', {
    resolve: () => Promise.resolve({ code: 'ok' }),
    health: () => Promise.resolve({ ok: true })
  });
  assert.equal(p.ok, false);
  assert.equal(p.code, GUARD.CODES.ORIGIN_MISSING);
});

/* ═══════════════════════════════════════════════════════════════
 *  ⑥  الحارس نفسه — check() يمنع كل نداء API
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G6 · الحارس: في المعاينة ⇒ أي نداء لوجهة إنتاج مرفوض', () => {
  const g = GUARD.createGuard({
    mode: 'preview', config: CONFIG, runtimeOrigin: PREVIEW
  });
  const v = g.check('https://' + PROD_HOST + '/api/prices');
  assert.equal(v.ok, false);
  assert.equal(v.code, GUARD.CODES.PRODUCTION_IN_PREVIEW);
});

test('R23-G6 · الحارس: في المعاينة ⇒ نداءات نفس الأصل مسموحة', () => {
  const g = GUARD.createGuard({
    mode: 'preview', config: CONFIG, runtimeOrigin: PREVIEW
  });
  assert.equal(g.check('/api/auth/me').ok, true);
  assert.equal(g.check('/api/prices').ok, true);
});

test('R23-G6 · الحارس: المعاينة المقفولة ⇒ كل نداء API مرفوض', () => {
  const g = GUARD.createGuard({
    mode: 'preview', config: CONFIG, runtimeOrigin: PROD
  });
  assert.equal(g.check('/api/auth/me').ok, false);
  assert.equal(g.check('/api/auth/me').code, GUARD.CODES.PRODUCTION_IN_PREVIEW);
});

test('R23-G6 · الحارس: في الإنتاج ⇒ نداء وجهة المعاينة مرفوض', () => {
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.preview.apiBaseUrl = PREVIEW;
  const g = GUARD.createGuard({
    mode: 'production', config: cfg, runtimeOrigin: PROD
  });
  const v = g.check(PREVIEW + '/api/prices');
  assert.equal(v.ok, false);
  assert.equal(v.code, GUARD.CODES.PREVIEW_IN_PRODUCTION);
});

/* ═══════════════════════════════════════════════════════════════
 *  ⑦  تصنيف فشل الشبكة (عشان الرسالة تبقى محدّدة)
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G7 · فشل عادي ⇒ «شبكة» (مش خطأ وجهة)', () => {
  assert.equal(GUARD.classifyFailure(new Error('boom'), {}), GUARD.CODES.NETWORK);
});

test('R23-G7 · رفض الحارس ⇒ كود الحارس نفسه', () => {
  const e = new Error('x');
  e.octaGuard = { code: GUARD.CODES.BLOCKED, message: 'x' };
  assert.equal(GUARD.classifyFailure(e, {}), GUARD.CODES.BLOCKED);
});

test('R23-G7 · فحص فاشل ⇒ كود الفحص (DNS/مش رادّة) مش «شبكة»', () => {
  const st = { probe: { ok: false, code: GUARD.CODES.ORIGIN_DNS_ERROR } };
  assert.equal(GUARD.classifyFailure(new Error('x'), st), GUARD.CODES.ORIGIN_DNS_ERROR);
});

test('R23-G7 · فحص سليم + فشل شبكة ⇒ «شبكة» (مش خطأ وجهة)', () => {
  const st = { probe: { ok: true, code: GUARD.CODES.OK } };
  assert.equal(GUARD.classifyFailure(new Error('x'), st), GUARD.CODES.NETWORK);
});

/* ═══════════════════════════════════════════════════════════════
 *  ⑧  العقدة نفسها (ملف المستودع)
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G8 · العقدة موجودة وصحيحة', () => {
  assert.ok(fs.existsSync(CONFIG_PATH), 'ملف العقدة مفقود');
  assert.equal(CONFIG.contract, 'octa-origin/v1');
  assert.ok(CONFIG.production && CONFIG.production.apiBaseUrl, 'وجهة الإنتاج لازم تكون مكتوبة');
  assert.ok(CONFIG.preview && Object.prototype.hasOwnProperty.call(CONFIG.preview, 'apiBaseUrl'),
    'وجهة المعاينة لازم تكون في العقدة (حتى لو فاضية)');
  assert.equal(CONFIG.preview.mustBeSeparateFromProduction, true,
    'العقدة لازم تعلن إن المعاينة لازم تكون منفصلة');
});

test('R23-G8 · ⛔ وجهة المعاينة في العقدة ما ينفعش تكون إنتاج ولا نفق', () => {
  const u = String(CONFIG.preview.apiBaseUrl || '');
  if (!u) return;   /* لسه ما اتضبطش — ده وضع مقبول (بس لازم يفشل مقفول) */
  const host = GUARD.hostOf(u);
  assert.equal(GUARD.isProductionHost(host, CONFIG), false,
    'وجهة المعاينة في العقدة بتشير للإنتاج');
  assert.equal(GUARD.isTunnelHost(host, CONFIG), false,
    'وجهة المعاينة في العقدة نفق مؤقت');
});

test('R23-G8 · ⛔ كل مضيفات الإنتاج متسجّلة في العقدة وفي الحارس', () => {
  for (const h of CONFIG.forbidden.hosts) {
    assert.equal(GUARD.isProductionHost(h, CONFIG), true, 'مضيف إنتاج مش متسجّل: ' + h);
  }
  assert.ok(CONFIG.production.hosts.indexOf(PROD_HOST) > -1,
    'مضيف الإنتاج الحقيقي لازم يكون في العقدة');
});

/* ═══════════════════════════════════════════════════════════════
 *  ⑨  مفيش انحراف بين قائمة الحارس وقائمة octa-api.js
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G9 · ⛔ قائمة مضيفات الإنتاج في octa-api.js = قائمة الحارس', () => {
  const m = API_JS.match(/const OCTA_PROD_HOSTS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(m, 'مألقاش OCTA_PROD_HOSTS في octa-api.js');
  const found = [];
  const re = /'([^']+)'/g;
  let mm;
  while ((mm = re.exec(m[1])) !== null) found.push(mm[1]);
  assert.deepEqual(found.slice().sort(), GUARD.PRODUCTION_HOSTS.slice().sort(),
    'القائمتين لازم يبقوا متطابقين (عشان مفيش انحراف بصمت)');
});

/* ═══════════════════════════════════════════════════════════════
 *  ⑩  قواميس الأكواد: الحارس + البوابة (نفس الأكواد ⇒ نفس المعنى)
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-G10 · قواميس البوابة = قواميس الحارس (نفس الأكواد)', () => {
  const m = GATE_JS.match(/var ORIGIN_FAULTS\s*=\s*\{([\s\S]*?)\n \};/);
  assert.ok(m, 'مألقاش ORIGIN_FAULTS في البوابة');
  const found = [];
  const re = /([a-z_]+)\s*:/g;
  let mm;
  while ((mm = re.exec(m[1])) !== null) found.push(mm[1]);
  const guardKeys = Object.keys(GUARD.MESSAGES)
    .filter((k) => k !== 'ok' && k !== 'network');
  assert.deepEqual(found.slice().sort(), guardKeys.slice().sort(),
    'أكواد البوابة لازم تطابق أكواد الحارس');
});

test('R23-G10 · ⛔ مفيش «...» نصّي في ملفات الرحلة (قاعدة نظافة المستودع)', () => {
  const DOTS = String.fromCharCode(46).repeat(3);
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  /* 📌 الملفات الجديدة/المعدّلة في الرحلة — لازم تكون نضيفة */
  const clean = [
    ['assets/js/octa-origin-guard.js', fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-origin-guard.js'), 'utf8')],
    ['assets/js/octa-api.js', API_JS],
    ['assets/js/octa-auth.js', fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-auth.js'), 'utf8')]
  ];
  for (const f of clean) {
    assert.equal(strip(f[1]).indexOf(DOTS), -1, f[0] + ': فيه نقاط ثلاث نصّية');
  }
  /* 📌 البوابة: فيها ٢ قبل الرحلة (شاشة البصمة + الإيميل) — مالناوش.
     ⛔ المهم إن الرحلة ما زادتش حاجة. */
  const gateDots = strip(GATE_JS).split(DOTS).length - 1;
  assert.ok(gateDots <= 2, 'البوابة زادت نقاط ثلاث نصّية: ' + gateDots);
});
