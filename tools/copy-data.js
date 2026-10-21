/* ═══════════════════════════════════════════════════════════════
  📦 نسخ مجلد البيانات — مع مفتاح فصل الملف العام
  ───────────────────────────────────────────────────────────────
  ⛔⛔ ٢١ أكتوبر ٢٠٢٦ — `data/data_markets.js` (٣٫٤ ميجا) كان
  ملفاً **ع��امياً** على الـCDN: أي حد بينزّله وبياخد داتا
  ٢٬٢٨٩ سهم كاملة من غير أي توكن.

  ⛌ الحل: الداتا بقت جوه الـAPI المحمي (/api/markets) — والواجهة
  بتجيبها منه. الملف الثابت بقى **احتياطي** لحد ما الـAPI
  يتنشر على الإنتاج.

  📌 المفتاح:
     OCTA_STATIC_MARKETS=0  →  الملف **مش** بيننسخ في dist
                                (يبقى الـURL بيرجّع 404 ⇒ التسريب
                                 مقفول نهائياً)
     (افتراضي: 1 — الملف بيننسخ، والـfallback شغّال)

  📌 بعد ما الـAPI يتنشر على الإنتاج:
     cd octa && OCTA_STATIC_MARKETS=0 npm run build
  ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data');
const DST = path.join(ROOT, 'dist', 'data');

const DROP = ['data_markets.js'];
const keepStatic = process.env.OCTA_STATIC_MARKETS !== '0';

if (!fs.existsSync(SRC)) {
  console.log('  ℹ️  مفيش مجلد data — اتخطّى');
  process.exit(0);
}
fs.mkdirSync(DST, { recursive: true });

let n = 0, skipped = 0;
for (const f of fs.readdirSync(SRC)) {
  const drop = DROP.indexOf(f) !== -1;
  if (drop && !keepStatic) {
    console.log('  🔒 مش منسوخ (تسريب مقفول): ' + f);
    skipped++;
    continue;
  }
  fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
  n++;
}
console.log('  📦 data: ' + n + ' ملف' + (skipped ? ' · ' + skipped + ' متشال' : ''));
