/* ══════════════════════════════════════════════════════════════════════
   ⭐ halan-news.js — محرك محور الأخبار (هالان) داخل عامل Cloudflare
   ──────────────────────────────────────────────────────────────────────
   📌 المشكلة (٩ نوفمبر ٢٠٢٦):
      الباك (octa-prices) بيرجّع «45» ثابت لكل سهم مفيش عندو أحداث
      في مصدره (foudalens). ⇒ 220 من 287 سهم محور الأخبار بتاعهم وهمي.
      ⛔ و«45» دي مش رقم مخترع — هي قاعدة الباك نفسها
         (update_prices.py: news_engine → "مفيش أخبار ⇒ 45").

   📌 الحل:
      نحسب محور الأخبار **بنفس معادلة الباك بالظبط** (نسخة مطابقة 1:1)
      ونمدجه مع أحداث هالان (من KV) ⇒ الرقم يبقى حقيقي ومتسق مع الباك.

   ⚠️⛔ قاعدة: أي تغيير هنا لازم يتتطابق مع
      update_prices.py :: news_engine  (octa-prices)
      لو اتغيّر أحدهم ⇒ لازم يتغير التاني في نفس الوقت.
      اختبار التطابق: tools/test-halan-news.js

   📌 ليه بنحسبه هنا مش في الباك؟
      ⛔ نشر الباك محتاج صلاحية كتابة على ريبو octa-prices
         (التوكن الحالي مقيّد على ريبو octa بس).
      ⇒ الباك هيشوف نفس النتيجة لما الـpatch يتنشر.
   ══════════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────────
   📌 MATERIAL_KEYWORDS — نسخة مطابقة من
      update_prices.py (سطر ~7078). نفس القوائم بالحرف.
   ────────────────────────────────────────────────────────────────────── */
const MATERIAL_KEYWORDS = {
  critical: ['دمج', 'استحواذ', 'إعادة هيكلة', 'إفلاس', 'تقييد', 'إيقاف',
    'تعديل.system', 'زيادة رأس المال', 'تخفيض', 'Merger', 'Acquisition',
    'Bankruptcy', 'Delisting', 'Suspend'],
  high: ['توزيعات', 'أرباح', 'نتائج', 'ارتفاع', 'انخفاض', 'توسع', 'دخول سوق',
    'Earnings', 'Dividend', 'Profit', 'Revenue', 'Expansion'],
  medium: ['اتفاق', 'شراكة', 'استثمار', 'تحديث', 'ت',
    'Agreement', 'Partnership', 'Investment', 'Update'],
};

/* ──────────────────────────────────────────────────────────────────────
   📌 newsEngine — نسخة مطابقة 1:1 من
      update_prices.py :: news_engine (سطر ~7089)
      المدخل: events = [{kind, kindAr, headline, date, value, ...}]
      المخرج: نفس الشكل اللي الباك بيرجّعه في /api/news/<code>
   ────────────────────────────────────────────────────────────────────── */
export function newsEngine(events) {
  const list = Array.isArray(events) ? events : [];
  const pos = [], neg = [], neu = [];
  const analyzed = [];
  let totalImpact = 0;
  let hasNews = false;

  /* 📌 نفس منطق الباك: أول 10 أحداث بس */
  for (const e of list.slice(0, 10)) {
    const kind = String(e.kind || '').toLowerCase();
    const headline = String(e.headline || e.kindAr || kind || '').trim();
    let materiality = 'low';
    let weight = 0.5;

    const hl = headline.toLowerCase();
    if (MATERIAL_KEYWORDS.critical.some(k => hl.indexOf(k) >= 0) || kind === 'increase capital') {
      materiality = 'critical'; weight = 3.0;
      neg.push('حدث حرج: ' + headline);
    } else if (MATERIAL_KEYWORDS.high.some(k => hl.indexOf(k) >= 0)
               || kind === 'cash_dividend' || kind === 'stock_dividend') {
      materiality = 'high'; weight = 2.0;
      if (kind === 'cash_dividend' || kind === 'stock_dividend') {
        /* 📌 الباك بيطبع None (مش —) لما القيمة مش موجودة:
             f"{e.get('kindAr','توزيعات')} بقيمة {e.get('value','—')} ج.م"
           ⇒ لو المفتاح موجود بس قيمته None ⇒ بيطبع None.
           ⇒ لازم نفس السلوك بالحرف (مش '—' ومش null) عشان النصوص متطابقة. */
        const v = (e && Object.prototype.hasOwnProperty.call(e, 'value'))
          ? (e.value === null ? 'None' : e.value) : '—';
        pos.push(`${e.kindAr || 'توزيعات'} بقيمة ${v} ج.م`);
      } else {
        neu.push('حدث: ' + headline);
      }
    } else {
      materiality = 'medium'; weight = 1.0;
      neu.push(headline);
    }

    totalImpact += weight;
    hasNews = true;
    analyzed.push({
      headline: headline,
      kind: kind,
      kindAr: e.kindAr || null,
      date: e.distributionDate || e.date || null,
      value: e.value != null ? e.value : null,
      materiality: materiality,
      weight: weight,
    });
  }

  /* 📌 مفيش أخبار ⇒ 45 (نفس قاعدة الباك: صراحة مش تخمين) */
  if (!hasNews) {
    return {
      score: 45.0,
      has_news: false,
      headline: 'لا توجد أحداث معلنة حالياً',
      materiality: 'none',
      confidence: 60,
      note: 'لا توجد أخبار أو أحداث معلنة — المحور محايد، مش إيجابي ولا سلبي',
      events: [],
      events_count: 0,
      positives: [],
      negatives: [],
      neutral: ['لا توجد أحداث معلنة عن هذا السهم'],
    };
  }

  /* 📌 العتبات — نفس أرقام الباك بالظبط */
  let score;
  if (totalImpact >= 10) score = 82;
  else if (totalImpact >= 6) score = 72;
  else if (totalImpact >= 3) score = 62;
  else score = 52;

  const hasCritical = analyzed.some(a => a.materiality === 'critical');
  if (hasCritical) {
    score -= 18;
    neg.push('⚠️ يوجد حدث حرج ممكن يأثر على السعر');
  }

  const conf = Math.min(95, 45 + analyzed.length * 10);
  const first = analyzed[0];

  return {
    score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
    has_news: true,
    headline: first.headline,
    materiality: first.materiality,
    confidence: conf,
    note: `${analyzed.length} أحداث معلنة | أكثرها materiality: ${first.materiality}`,
    events: analyzed.slice(0, 5),
    events_count: analyzed.length,
    positives: pos.slice(0, 5),
    negatives: neg.slice(0, 5),
    neutral: neu.slice(0, 5),
  };
}

/* ──────────────────────────────────────────────────────────────────────
   📌 mergeEvents — يدمج أحداث الباك (foudalens) مع أحداث هالان
      📌 نفس منطق الباك **بالترتيب**:
         ① أحداث BFD أولاً (بنفس ترتيبها)
         ② بعدين أحداث هالان (بنفس ترتيبها)
         ③ منع التكرار بـ (kind + date)
      ⛔⚠️ ترتيب الأحداث **مهم**: الباك بياخد أول ١٠ أحداث
         وبيحسب الـmateriality من **أول** حدث في القايمة.
         ⇒ لو رتّبنا بالتاريخ ⇒ الرقم هيتغيّر ⇒ لازم نفس الترتيب بالظبط.
      📌 (الترتيب بالتاريخ بيحصل في /api/dividends للعرض فقط — مش هنا.)
   ────────────────────────────────────────────────────────────────────── */
export function mergeEvents(backendEvents, halanEvents) {
  const out = [];
  const seen = {};
  const key = (e) => `${e.kind || ''}|${(e.date || '').slice(0, 10)}`;

  for (const e of (backendEvents || [])) {
    const k = key(e);
    if (seen[k]) continue;
    seen[k] = 1;
    out.push(e);
  }
  for (const e of (halanEvents || [])) {
    const k = key(e);
    if (seen[k]) continue;
    seen[k] = 1;
    out.push(e);
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────
   📌 eventsByCode — يحوّل أحداث KV (شكل هالان) لشكل أحداث الباك
      📌 نفس اسم الحقول اللي news_engine بيقراها:
         kind · kindAr · headline · date · value
   ────────────────────────────────────────────────────────────────────── */
export function eventsByCode(kvEvents) {
  const byCode = {};
  const evs = (kvEvents && kvEvents.events) || [];
  for (const e of evs) {
    const code = String(e.code || '').toUpperCase();
    if (!code) continue;
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push({
      kind: e.kind || 'general',
      kindAr: e.kindAr || null,
      headline: e.headline || '',
      date: e.date || null,
      value: null,
      source: 'halan',
    });
  }
  return byCode;
}

export { MATERIAL_KEYWORDS };
