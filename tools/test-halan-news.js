/* ══════════════════════════════════════════════════════════════════════
   🧪 test-halan-news.js — إثبات تطابق محرك الأخبار في الـWorker مع الباك
   ──────────────────────────────────────────────────────────────────────
   📌 القاعدة: لو الـWorker حسب محور الأخبار بطريقة مختلفة عن الباك
      ⇒ رقمين مختلفين في نفس المشروع ⇒ جريمة مصدر-حقيقة-مزدوج.
      ⇒ الاختبار ده بيقارن ناتج JS بناتج Python **على نفس البيانات**.
   📌 التشغيل:
      node tools/test-halan-news.js          (يقارن مع ملفات في /tmp)
      أو: node tools/test-halan-news.js --cases cases.json
   ══════════════════════════════════════════════════════════════════════ */

import { newsEngine, mergeEvents } from '../halan-news.js';
import fs from 'fs';

const CASES_FILE = process.argv.includes('--cases')
  ? process.argv[process.argv.indexOf('--cases') + 1]
  : '/tmp/halan-news-cases.json';

if (!fs.existsSync(CASES_FILE)) {
  console.error('⛔ ملف الحالات مش موجود: ' + CASES_FILE);
  console.error('   شغّل سكربت التوليد من الباك أول (generator في /tmp).');
  process.exit(1);
}

const cases = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
let pass = 0, fail = 0;
const failures = [];

for (const c of cases) {
  /* الحالة: أحداث الـBFD + أحداث هالان ⇒ نفس المصدر اللي الباك بيستخدمه */
  const merged = mergeEvents(c.backend_events || [], c.halan_events || []);
  const mine = newsEngine(merged);

  /* نقارن الحقول الرقمية/textual الحقيقية فقط */
  const checks = [
    ['score', mine.score, c.expected.score],
    ['has_news', mine.has_news, c.expected.has_news],
    ['materiality', mine.materiality, c.expected.materiality],
    ['confidence', mine.confidence, c.expected.confidence],
    ['events_count', mine.events_count, c.expected.events_count],
  ];
  let ok = true;
  const diffs = [];
  for (const [k, got, want] of checks) {
    const same = (typeof want === 'number' && typeof got === 'number')
      ? Math.abs(got - want) < 0.051
      : got === want;
    if (!same) { ok = false; diffs.push(`${k}: جا=${got} المتوقع=${want}`); }
  }
  /* عدد الأحداث اللي اتحللت */
  if (mine.events.length !== (c.expected.events || []).length) {
    ok = false;
    diffs.push(`events length: جا=${mine.events.length} المتوقع=${(c.expected.events || []).length}`);
  }
  /* الـpositives/negatives */
  if (JSON.stringify(mine.positives) !== JSON.stringify(c.expected.positives || [])) {
    ok = false;
    diffs.push(`positives: جا=${JSON.stringify(mine.positives)} المتوقع=${JSON.stringify(c.expected.positives || [])}`);
  }
  if (JSON.stringify(mine.negatives) !== JSON.stringify(c.expected.negatives || [])) {
    ok = false;
    diffs.push(`negatives: جا=${JSON.stringify(mine.negatives)} المتوقع=${JSON.stringify(c.expected.negatives || [])}`);
  }

  if (ok) { pass++; console.log(`  ✓ ${c.code} (score=${mine.score})`); }
  else {
    fail++;
    failures.push({ code: c.code, diffs });
    console.log(`  ✗ ${c.code} ⇒ ${diffs.join(' | ')}`);
  }
}

console.log('');
console.log(`النتيجة: ${pass} نجح · ${fail} فشل (من ${cases.length})`);
if (fail) {
  console.log('');
  console.log('❌ الاختلافات:');
  for (const f of failures) console.log('  ' + f.code + ': ' + f.diffs.join(' | '));
  process.exit(1);
}
console.log('✅ محرك الأخبار في الـWorker = الباك بالحرف.');
