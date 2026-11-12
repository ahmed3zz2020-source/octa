/**
 * OCTA V2 — مجموعة البيانات التجريبية (Mock dataset)
 * -----------------------------------------------
 * ⛔ كل الأرقام هنا وهمية بالكامل — الغرض اختبار الواجهة فقط.
 * ⛔ لا علاقة لها بأسعار حقيقية ولا بخدمة الأسعار الإنتاجية.
 * ⛔ الرمز MOCK5 = سهم خطأ (للاختبار) · MOCK6 = سهم بيانات ناقصة.
 */

export const MOCK_SOURCE_NAME = 'بيانات تجريبية داخلية (Mock v2)';
export const MOCK_ASOF_ISO = '2026-11-12T04:58:00Z';

/** مولّد سلسلة سعرية حتمي (نفس المدخل ⇒ نفس الناتج) — بلا Math.random */
function seriesFrom(seed, base, points = 30) {
  let x = seed;
  const rnd = () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
  const out = [];
  let v = base;
  for (let i = 0; i < points; i++) {
    const drift = (rnd() - 0.45) * base * 0.022;
    v = Math.max(0.5, v + drift);
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

export const MOCK_STOCKS = [
  {
    symbol: 'MOCK1',
    name: 'النور للتأمين (تجريبي)',
    price: 48.35,
    changePct: 2.4,
    open: 47.2,
    high: 48.9,
    low: 46.95,
    volume: 184500,
    seed: 11
  },
  {
    symbol: 'MOCK2',
    name: 'الشروق للمقاولات (تجريبي)',
    price: 12.8,
    changePct: -1.1,
    open: 13.05,
    high: 13.2,
    low: 12.65,
    volume: 96200,
    seed: 23
  },
  {
    symbol: 'MOCK3',
    name: 'المدى للأغذية (تجريبي)',
    price: 26.15,
    changePct: 0.63,
    open: 26.0,
    high: 26.4,
    low: 25.88,
    volume: 143700,
    seed: 37
  },
  {
    symbol: 'MOCK4',
    name: 'الأمواج للنسج (تجريبي)',
    price: 7.92,
    changePct: -2.81,
    open: 8.15,
    high: 8.22,
    low: 7.81,
    volume: 219300,
    seed: 51
  },
  {
    symbol: 'MOCK5',
    name: 'أطلس للتأمين (تجريبي)',
    price: 33.4,
    changePct: 1.02,
    open: 33.0,
    high: 33.6,
    low: 32.9,
    volume: 54300,
    seed: 67,
    fail: true            // ⛔ يقذف خطأ — لاختبار حالة الخطأ
  },
  {
    symbol: 'MOCK6',
    name: 'الواحة للمبيدات (تجريبي)',
    price: 19.45,
    changePct: null,      // ⛔ غير متاح
    open: null,           // ⛔ غير متاح
    high: null,           // ⛔ غير متاح
    low: null,            // ⛔ غير متاح
    volume: null,         // ⛔ غير متاح
    seed: 89,
    partial: true
  }
];

export const MOCK_INDEX = {
  indexName: 'مؤشر تجريبي ٣٠',
  indexValue: 28450.12,
  indexChangePct: 1.84,
  advancing: 18,
  declining: 11,
  totalVolume: 1240000000
};

export function mockSeriesFor(stock) {
  return seriesFrom(stock.seed, stock.price);
}
