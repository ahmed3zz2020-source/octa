#!/usr/bin/env node
/* ⭐ اختبار المحرّك على شموع حقيقية من الـAPI (مفيش أرقام مفتعلة) */
const API = 'https://octa-prices-production-4ccb.up.railway.app';
global.window = {};
require('/workspace/octa/assets/js/octa-chartkit.js');
require('/workspace/octa/assets/js/octa-sr.js');
const SR = global.window.OCTASR;
const KIT = global.window.OCTAChartKit;

const CODES = process.argv[2] ? [process.argv[2]] : ['COMI', 'HRHO', 'ETEL', 'SWDY', 'EAST'];

/* ⭐ نفس المحوّل اللي بيستخدمه التطبيق فعلاً */
function rowsFrom(j, code) { return KIT.rowsFromHistory(j, code); }

(async () => {
  let fail = 0;
  for (const code of CODES) {
    const r = await fetch(`${API}/api/radar/history?list=${encodeURIComponent(code)}&n=240`);
    if (!r.ok) { console.log(`🔴 ${code}: HTTP ${r.status}`); fail++; continue; }
    const j = await r.json();
    const rows = rowsFrom(j, code);
    if (!rows.length) { console.log(`🔴 ${code}: مفيش شموع`); fail++; continue; }
    const an = SR.analyze(rows, {});
    const last = rows[rows.length - 1].close;
    const hi = Math.max(...rows.map(x => x.high)), lo = Math.min(...rows.map(x => x.low));

    /* ⭐ فحوص السلامة */
    const problems = [];
    if (!an.ok) problems.push('analyze رجّع ok=false');
    if (Math.abs(an.last - last) > 1e-9) problems.push('السعر الحالي غلط');
    if (an.atr == null || an.atr <= 0) problems.push('ATR غلط');
    if (an.atr > (hi - lo)) problems.push('ATR أكبر من المدى كله');
    for (const L of an.levels) {
      if (!(L.price > 0)) problems.push(`مستوى غير موجب: ${L.price}`);
      if (L.price > hi * 1.02 || L.price < lo * 0.98) problems.push(`مستوى خارج المدى: ${L.price}`);
      const d = ((L.price - last) / last) * 100;
      if (Math.abs(d - L.distancePct) > 0.01) problems.push(`البُعد غلط: ${L.price}`);
      if (L.touches < 1) problems.push('لمسات = 0');
      if (L.score < 0 || L.score > 100) problems.push('قوّة خارج المدى');
    }
    /* ⭐ التصنيف لازم يطابق الموقع من السعر */
    for (const L of an.levels) {
      if (L.kind === 'مقاومة' && L.price <= last) problems.push('مقاومة تحت السعر');
      if (L.kind === 'دعم' && L.price >= last) problems.push('دعم فوق السعر');
    }
    /* ⭐ الفيبوناتشي داخل المدى */
    if (an.fib) {
      for (const f of an.fib.levels) {
        if (f.price < lo * 0.99 || f.price > hi * 1.01) problems.push(`فيبوناتشي خارج المدى: ${f.price}`);
      }
    }
    const lines = SR.toLines(an, { fib: true });
    const table = SR.tableHTML(an, {});
    if (!/NaN|undefined|Infinity/.test(table)) { /* ✅ لازم مفيش */ }
    else { problems.push('الجدول فيه NaN/undefined'); }

    const tag = problems.length ? '🔴' : '✅';
    console.log(`${tag} ${code}: ${rows.length} شمعة · ATR ${an.atr?.toFixed(3)} · السعر ${last} · ${an.structure.short}`);
    console.log(`   مستويات: ${an.levels.length} (دعم ${an.supports.length} / مقاومة ${an.resistances.length}) · فيبوناتشي ${an.fib ? an.fib.label : '—'}`);
    for (const L of an.levels.slice(0, 6)) {
      console.log(`   ${L.kind.padEnd(9)} ${L.price.toFixed(3).padStart(10)} · قوّة ${String(L.score).padStart(3)} · لمسات ${L.touches} · ${L.distancePct >= 0 ? '+' : ''}${L.distancePct.toFixed(2)}%`);
    }
    if (problems.length) { fail++; problems.forEach(p => console.log('   ⛔ ' + p)); }
  }
  console.log(fail ? `\n🔴 فشل ${fail}` : '\n✅ كل الفحوص عدّت');
  process.exit(fail ? 1 : 0);
})();
