/* 🧪 اختبار تدقيق الرادار — ٢٥ أكتوبر ٢٠٢٦
 * ═══════════════════════════════════════════════════════════════
 * شغّال مع:  node tools/test_radar_audit.js
 *
 * الهدف: كل رقم في docs/AUDIT-QUANT-2026-10-25.md §٥ يبقى قابل للتكرار.
 * ⛔ الملف ده بيختبر octa-radar.js بس — مش octa-radar-ui.js.
 */
'use strict';

const path = require('path');
const R = require(path.join(__dirname, '..', 'assets', 'js', 'octa-radar.js'));

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}
function sect(t) {
  console.log('\n' + '═'.repeat(62));
  console.log('  ' + t);
  console.log('═'.repeat(62));
}

const P = R.PROFILES.balanced;

/* ── مصنع نتيجة تحليل ────────────────────────────────────── */
function mk(o) {
  return Object.assign({
    dq: { usable: true, sessions: 120, stale: false },
    trend: { state: R.TREND.UP, score: 80 },
    momentum: { score: 80, dirState: 'POSITIVE' },
    volume: { score: 80, rvol: 1.5, liq: 'DEEP' },
    volatility: { atrPct: 3, score: 80 },
    plan: { status: R.PLAN.ZONE, rr: 3, entry: 10, stop: 9, target1: 16 },
    risk: { state: R.RISK.LOWER },
    score: { total: 80, insufficient: false }
  }, o);
}

/* ══════════════════════════════════════════════════════════════
 * ١) الدرجة المركّبة — المحور الناقص بيتشال وبيوزّع وزنه
 * ══════════════════════════════════════════════════════════════ */
sect('١) compositeScore — إعادة توزيع الأوزان');

const W = P.weights;                       // trend 35 · momentum 25 · volume 20 · risk 20
const all = { trend: 80, momentum: 70, volume: 60, risk: 50 };
const cFull = R.compositeScore(all, P, { total: 4 });
ok('كل المحاور متاحة ⇒ degree كاملة',
  cFull.total !== null && !cFull.insufficient, cFull.total);
/* ٣٥٪×٨٠ + ٢٥٪×٧٠ + ٢٠٪×٦٠ + ٢٠٪×٥٠ = ٢٨ + ١٧.٥ + ١٢ + ١٠ = ٦٧.٥ */
const expectedFull = 0.35 * 80 + 0.25 * 70 + 0.20 * 60 + 0.20 * 50;
ok('المجموع = المتوسط الموزون بالظبط',
  Math.abs(cFull.total - expectedFull) < 0.05,
  `${cFull.total} (متوقع ${expectedFull})`);

const cNoRisk = R.compositeScore(
  { trend: 80, momentum: 70, volume: 60, risk: null }, P, { total: 4 });
ok('محور ناقص ⇒ مش صفر (missing متسجّل)',
  cNoRisk.missing.includes('risk') && cNoRisk.total > 60, cNoRisk);
ok('الأوزان اتوزّعت (مجموع adjusted = 100)',
  Math.abs(Object.values(cNoRisk.adjusted).reduce((a, b) => a + b, 0) - 100) < 0.5,
  cNoRisk.adjusted);
ok('وزن risk اتشال من المعادلة', !('risk' in cNoRisk.adjusted), cNoRisk.adjusted);

const cFew = R.compositeScore({ trend: 80, momentum: 70, volume: null, risk: null }, P, { total: 4 });
ok('أقل من ٣ محاور ⇒ مفيش درجة (مش درجة ناقصة)',
  cFew.total === null && cFew.insufficient, cFew.reason);

const cNone = R.compositeScore({ trend: null, momentum: null, volume: null, risk: null }, P, { total: 4 });
ok('مفيش محاور ⇒ مفيش درجة', cNone.total === null && cNone.insufficient, cNone.reason);

ok('الأوزان الأساسية بتجمع 100% لكل بروفايل',
  Object.values(R.PROFILES).every(p =>
    Object.values(p.weights).reduce((a, b) => a + b, 0) === 100));

/* ══════════════════════════════════════════════════════════════
 * ٢) التصنيف — A / B / C / D / E
 * ══════════════════════════════════════════════════════════════ */
sect('٢) classify — شروط A/B/C/D/E');

ok('كله تمام ⇒ A', R.classify(mk({}), P).code === 'A',
  R.classify(mk({}), P).code);

ok('مخاطرة عالية جداً + كل الـcore ⇒ C',
  R.classify(mk({ risk: { state: R.RISK.VERY_HIGH } }), P).code === 'C',
  R.classify(mk({ risk: { state: R.RISK.VERY_HIGH } }), P).code);

/* ⛔⛔⛔ الباج اللي اتصلّح —VERY HIGH RISK + core ناقص
   قبل الإصلاح: B (مرشح) — وده أخطأ من C (مخاطرة عالية) */
const rBug = R.classify(mk({
  risk: { state: R.RISK.VERY_HIGH },
  momentum: { score: 10, dirState: 'NEGATIVE' }
}), P);
ok('⛔ مخاطرة عالية + زخم ضعيف ⇒ C (مش B)',
  rBug.code === 'C', rBug.code + ' — ' + rBug.state);
ok('مفيش تصنيف B لسهم عالي الخطر',
  rBug.code !== 'B', 'code=' + rBug.code);

const rHigh = R.classify(mk({
  risk: { state: R.RISK.HIGH },
  momentum: { score: 10, dirState: 'NEGATIVE' }
}), P);
ok('مخاطرة HIGH + core ناقص ⇒ C',
  rHigh.code === 'C', rHigh.code);

const rB = R.classify(mk({ volume: { score: 80, rvol: 0.5, liq: 'DEEP' } }), P);
ok('مخاطرة معتدلة + تأكيد ناقص ⇒ B',
  rB.code === 'B', rB.code + ' — failed: ' + rB.failed);

ok('بيانات ناقصة ⇒ E',
  R.classify(mk({ dq: { usable: false, sessions: 5, stale: false } }), P).code === 'E');
ok('درجة مركّبة ناقصة ⇒ E',
  R.classify(mk({ score: { total: null, insufficient: true, reason: 'x' } }), P).code === 'E');
ok('مفيش setup ⇒ D',
  R.classify(mk({
    momentum: { score: 10, dirState: 'NEGATIVE' },
    volume: { score: 10, rvol: 0.2, liq: 'ILLIQUID' },
    plan: { status: R.PLAN.NONE, rr: null }
  }), P).code === 'D');

/* ══════════════════════════════════════════════════════════════
 * ٣) planEngine — الوقف تحت الدخول دايماً
 * ══════════════════════════════════════════════════════════════ */
sect('٣) planEngine — الدخول والوقف');

const closes = [], highs = [], lows = [], vols = [];
const pat = [100,102,104,103,101,103,105,107,106,104,106,108,110,109,107,109,111,113,
             112,110,112,114,116,115,113,115,117,119,118,116,118,120,122,121,119,121,
             123,125,124,122,124,126,128,127,125,127,129,131,130,128,130,132,134,133,
             131,133,135,137,136,134,136,138,140];
pat.forEach(c => { closes.push(c); highs.push(c + 0.6); lows.push(c - 0.6); vols.push(1000000); });
const cands = closes.map((c, i) => ({ c, h: highs[i], l: lows[i], v: vols[i], t: i }));

const atr = R.atr(cands, 14);
const vola = { atr: atr, atrPct: atr / 140 * 100 };
const vol = { rvol: 1.3, liq: 'LIQUID', score: 75 };
const plan = R.planEngine(cands, { state: R.TREND.UP, score: 80 }, vol, vola, {});

ok('الخطة اتبنت', plan.status !== R.PLAN.NONE, plan.status);
ok('الوقف تحت الدخول دايماً',
  plan.stop !== null && plan.entry !== null && plan.stop < plan.entry,
  `entry=${plan.entry} stop=${plan.stop}`);
ok('riskPerShare > 0', plan.riskPerShare > 0, plan.riskPerShare);
ok('نسبة العائد محسوبة', plan.rr !== null, plan.rr);
ok('الهدف أعلى من الدخول', plan.target1 === null || plan.target1 > plan.entry,
  plan.target1);

const planDown = R.planEngine(cands, { state: R.TREND.DOWN, score: 20 }, vol, vola, {});
ok('اتجاه هابط ⇒ الخطة ملغاة (INVALID)',
  planDown.status === R.PLAN.INVALID, planDown.status);

const planShort = R.planEngine(cands.slice(0, 10), { state: R.TREND.UP }, vol, vola, {});
ok('شموع قليلة ⇒ مفيش خطة', planShort.status === R.PLAN.NONE, planShort.status);

const planNoAtr = R.planEngine(cands, { state: R.TREND.UP }, vol, { atr: 0, atrPct: 0 }, {});
ok('مافيش ATR ⇒ مفيش خطة', planNoAtr.status === R.PLAN.NONE, planNoAtr.reason);

/* ══════════════════════════════════════════════════════════════
 * ٤) sizingEngine — الكمية والسقف
 * ══════════════════════════════════════════════════════════════ */
sect('٤) sizingEngine — الكمية');

const S = R.sizingEngine;

const s1 = S({ entry: 10, stop: 12, target1: 15 }, { capital: 100000, riskPct: 1, maxAllocPct: 20 });
ok('stop > entry ⇒ مفيش كمية (null)', s1.qty === null, 'qty=' + s1.qty);
ok('stop > entry ⇒ مفيش خسارة متوقعة', s1.estLoss === null);

const s2 = S({ entry: 10, stop: 10, target1: 15 }, { capital: 100000, riskPct: 1, maxAllocPct: 20 });
ok('stop == entry ⇒ مفيش كمية', s2.qty === null, 'qty=' + s2.qty);

const s3 = S({ entry: 1000, stop: 900, target1: 1300 }, { capital: 1000, riskPct: 0.1, maxAllocPct: 50 });
ok('الكمية < ١ ⇒ qty = 0', s3.qty === 0, 'qty=' + s3.qty);

const s4 = S({ entry: 10, stop: 9.9, target1: 15 }, { capital: 100000, riskPct: 2, maxAllocPct: 5 });
ok('سقف التخصيص بيتطبّق', s4.capped === true && s4.allocationPct <= 5.01,
  `qty=${s4.qty} alloc=${s4.allocationPct}%`);
ok('الخسارة المتوقعة ≤ المبلغ المخاطرة',
  s4.estLoss <= s4.riskAmount + 0.01, `${s4.estLoss} ≤ ${s4.riskAmount}`);

const s5 = S({ entry: 10, stop: 9, target1: 15 }, { capital: 100000, riskPct: 1, maxAllocPct: 0 });
ok('maxAllocPct = 0 ⇒ مفيش سقف (سلوك موجود)',
  s5.capped === false, 'capped=' + s5.capped);

const s6 = S({ entry: 1000, stop: 999, target1: 1500 }, { capital: 1000, riskPct: 5, maxAllocPct: 0.5 });
ok('السقف بيصغّر الكمية لـ ٠ ⇒ qty = 0',
  s6.qty === 0 && s6.capped === true, `qty=${s6.qty}`);

const s7 = S({ entry: 10, stop: 9, target1: 15 }, { capital: 0, riskPct: 1, maxAllocPct: 10 });
ok('رأس مال صفر ⇒ مفيش كمية', s7.qty === null, 'qty=' + s7.qty);

const s8 = S({ entry: 10, stop: 9, target1: 15 }, { capital: 100000, riskPct: 1, maxAllocPct: 10 });
ok('المعادلة: qty = (رأس المال × نسبة المخاطرة) ÷ (دخول − وقف)',
  s8.qty === Math.floor((100000 * 1 / 100) / (10 - 9)),
  `qty=${s8.qty} expected=${Math.floor(1000 / 1)}`);

const s9 = S({ entry: 10, stop: 9, target1: 15 }, { capital: 100000, riskPct: 1, maxAllocPct: 10 });
ok('مفيش تكلفة معاملة متكسوبة (فرق صريح)',
  s9.costsIncluded === false, s9.costsNote);

/* ══════════════════════════════════════════════════════════════
 * ٥) الدليل الذكي — مش جزء من الدرجة المركّبة
 * ══════════════════════════════════════════════════════════════ */
sect('٥) الأدلة الذكية — طبقة تأكيد مش تضخيم');

ok('COMPONENTS = ٤ محاور',
  R.COMPONENTS.length === 4, R.COMPONENTS.join(','));
ok('الدليل الذكي مش في COMPONENTS',
  !R.COMPONENTS.includes('smart'));
ok('recToScore بيحوّل -1..+1 ⇒ 0..100',
  R.recToScore(-1) === 0 && R.recToScore(0) === 50 && R.recToScore(1) === 100);

/* ── النتيجة ──────────────────────────────────────────────── */
console.log('\n' + '═'.repeat(62));
console.log(`  ✅ نجح: ${pass}`);
console.log(`  ${fail ? '❌ فشل: ' + fail : '✅ فشل: 0'}`);
if (fail) { console.log('\n🎉❌ في اختبارات فاشلة'); process.exit(1); }
console.log('\n🎉 كل اختبارات تدقيق الرادار ناجحة.');
