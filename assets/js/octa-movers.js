/* ════════════════════════════════════════════════════════════════════════
   🔥 لوحة المتحرّكين — أعلى ١٠ صعوداً وهبوطاً
   ────────────────────────────────────────────────────────────────────────
   📌 ١٤ نوفمبر ٢٠٢٦ — جديدة في صفحة السوق العامة (فلتر البورصة).

   📌 ⭐ المصدر: ماسح TradingView (نفس المصدر اللي الفلتر بيستخدمه
      للسعودية/الإمارات/أمريكا) ⭐ اتوسّع لمصر:
        · مصر  ⇒ ٢٥٥ سهم · سعر مطابق ١٠٠٪ لـ /api/quotes
        · الحقول: التغير + فترات (أسبوع/شهر/٣ش/٦ش/سنة) + حجم نسبي
          + أعلى/أدنى ٥٢ أسبوع + التوصية + التقييم.
      ⛔ مفيش أي رقم مخترع: أي حقل ناقص بيفضل فاضي (مش صفر).

   📌 ⭐ الفكرة (ليه المستخدم يتابعها):
      ١. كل سطر فيه **حكم** بلغة المستخدم: «اتجاه صاعد» ولا «ارتداد داخل
         اتجاه هابط» — محسوب من الفترات مش من الكلام.
      ٢. كل سطر فيه **شارة تدفّق**: «تداول ×٣.٤» (حركة عليها سيولة
         غير معتادة) — وده أقوى إشارة إن الحركة حقيقية.
      ٣. لمسة السهم ⇒ **شيت تفاصيل**: مدى ٥٢ أسبوع، التداول مقابل
         متوسط الشهر، أداء كل الفترات — «الحركة دي إيه بالظبط؟».
      ٤. شريط طول الحركة (مقياس بصري) + نجوم الثلاثة الأوائل.
      ٥. تحديث كل دقيقة (Millis) + وقفة لما التبويب مخفي.

   📌 ⛔ الصفحة عامة ⇒ مفيش جلسة ⇒ مفيش أرقام محمية (ولا قرار OCTA).
      كل رقم هنا عام من ماسح السوق.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── الأسواق ── */
  const MK = {
    egypt: { i: '🇪🇬', n: 'بورصة مصر', cur: 'ج.م' },
    saudi: { i: '🇸🇦', n: 'السعودية', cur: 'ر.س' },
    uae: { i: '🇦🇪', n: 'الإمارات', cur: 'د.إ' },
    us: { i: '🇺🇸', n: 'أمريكا', cur: '$' }
  };

  /* ── الفترات (كلها موجودة في مصدر البيانات) ── */
  const PERIODS = [
    { id: 'd', n: 'اليوم', f: 'change' },
    { id: 'w', n: 'الأسبوع', f: 'p1w' },
    { id: 'm', n: 'الشهر', f: 'p1m' },
    { id: '3m', n: '٣ شهور', f: 'p3m' },
    { id: '6m', n: '٦ شهور', f: 'p6m' },
    { id: 'y', n: 'السنة', f: 'p1y' }
  ];

  const S = {
    mk: 'egypt', per: 'd', rows: [], root: null, sheet: null,
    openCode: null, timer: null, loading: false, err: '',
    /* ⭐ وضع التطبيق (١٤ نوفمبر ٢٠٢٦):
       ⭐ جوه التطبيق ⇒ الزرار بيفتح تحليل السهم بدل ما يودّي البوابة. */
    app: false, onOpen: null
  };

  /* ── أدوات ── */
  const $ = (id) => document.getElementById(id);
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function isNum(v) { return v != null && !isNaN(v); }
  function n2(v) { return isNum(v) ? Number(v).toFixed(2) : '—'; }
  function n0(v) { return isNum(v) ? Math.round(Number(v)).toLocaleString('en-US') : '—'; }
  function pct(v, d) {
    if (!isNum(v)) return '—';
    var x = Number(v);
    return (x > 0 ? '+' : '') + x.toFixed(d == null ? 2 : d) + '%';
  }
  /* ⭐ الأرقام والإشارات LTR — من غير كده «+5.20%» بتتقلب «5.20%+» */
  function ltr(s) { return '<bdi dir="ltr">' + s + '</bdi>'; }

  function dir(v) { return !isNum(v) ? 'na' : (Number(v) > 0 ? 'up' : (Number(v) < 0 ? 'down' : 'na')); }
  function big(v) {
    if (!isNum(v)) return '—';
    var n = Number(v);
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' مليار';
    if (n >= 1e6) return (n / 1e6).toFixed(0) + ' مليون';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + ' ألف';
    return n0(n);
  }
  function hhmmss(d) {
    try {
      return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      var h = ('0' + d.getHours()).slice(-2), m = ('0' + d.getMinutes()).slice(-2);
      return h + ':' + m;
    }
  }
  /* ⭐ أيقونة السهم: TradingView بي recommendation بالنص (Buy/Hold/Sell) */
  function recLabel(v) {
    if (!isNum(v)) return null;
    var x = Number(v);
    if (x >= 0.5) return { t: 'شراء قوي', k: 'up' };
    if (x >= 0.1) return { t: 'شراء', k: 'up' };
    if (x > -0.1) return { t: 'حياد', k: 'na' };
    if (x > -0.5) return { t: 'بيع', k: 'down' };
    return { t: 'بيع قوي', k: 'down' };
  }

  /* ══════════════════════════════════════════════════════════════
     ⭐ الأحكام — «الحركة دي إيه؟»
     ──────────────────────────────────────────────────────────────
     📌 محسوبة من الفترات الحقيقية (اليوم/الأسبوع/الشهر).
     📌 ⛔ مفيش كلام من فراغ: كل حكم له شرط رقمي واضح.
     ══════════════════════════════════════════════════════════════ */
  function trendChip(r) {
    var d = r.chgDay, m = r.p1m, w = r.p1w;
    if (!isNum(d)) return null;
    if (d > 0 && isNum(m) && m > 0 && isNum(w) && w <= 0) return { k: 'up', t: 'بداية تحوّل صاعد' };
    if (d > 0 && isNum(m) && m > 0) return { k: 'up', t: 'اتجاه صاعد' };
    if (d > 0 && isNum(m) && m < 0) return { k: 'warn', t: 'ارتداد داخل اتجاه هابط' };
    if (d < 0 && isNum(m) && m < 0) return { k: 'down', t: 'اتجاه هابط' };
    if (d < 0 && isNum(m) && m > 0) return { k: 'ok', t: 'تصحيح داخل اتجاه صاعد' };
    return { k: 'na', t: 'حركة يوم واحد' };
  }
  function flowChip(r) {
    if (!isNum(r.relvol)) return null;
    var x = Number(r.relvol);
    if (x >= 2) return { k: 'hot', t: 'تداول ×' + x.toFixed(1) };
    if (x <= 0.5) return { k: 'cold', t: 'تداول ضعيف' };
    return null;
  }
  function hi52Chip(r) {
    if (!isNum(r.h52) || !isNum(r.price)) return null;
    if (Number(r.price) >= Number(r.h52) * 0.98) return { k: 'up', t: 'قرب أعلى سعر في ٥٢ أسبوع' };
    if (isNum(r.l52) && Number(r.price) <= Number(r.l52) * 1.02) return { k: 'down', t: 'قرب أدنى سعر في ٥٢ أسبوع' };
    return null;
  }

  /* ══════════════════════════════════════════════════════════════
     تجهيز البيانات
     ══════════════════════════════════════════════════════════════ */
  /* ⭐ القطاعات بالعربي — نفس خريطة الموقع (مصدر واحد) */
  function sectorAr(raw) {
    var r = String(raw || '');
    if (!r) return '';
    if (/[\u0600-\u06FF]/.test(r)) return r;      /* عربي أصلاً */
    var map = (typeof window !== 'undefined' && window.OCTA_SEC_AR) ? window.OCTA_SEC_AR : {};
    return map[r] || r;
  }

  function realCode(c) {
    /* ⛔ رموز EGX الداخلية (EGS…-EGP) = أدوات ومعاملات مش أسهم ⭐
       ⛔ بتطلع في الماسح ⇒ بنستبعدها من لوحة المتحرّكين. */
    return !!c && c.indexOf('-') < 0 && c.indexOf('EGS') !== 0;
  }
  function prep(rows) {
    var out = [];
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      if (!r || !realCode(r.code)) continue;
      if (!isNum(r.price)) continue;
      if (r.sector) r.sector = sectorAr(r.sector);
      if (r.industry) r.industry = sectorAr(r.industry);

      /* ══════════════════════════════════════════════════════════
         ⭐⭐ تصحيح نسبة اليوم (١٤ نوفمبر ٢٠٢٦)
         ───────────────────────────────────────────────────────────
         📌 المشكلة: حقل `change` بيرجع مقارنةً بمرجع قديم لو السهم
            عدّل سعره (توزيع/تقplit) ⇒ example بنك قناة السويس:
            +٥٣.٢٠٪ والرقم الصح +٢.١٤٪ (مطابق للإغلاق الرسمي).
            ⛔ حد البورصة المصرية اليومي ±٢٠٪ ⇒ +٥٣٪ مستحيل أصلاً.
         📌 القاعدة: لو الفرق بين `change` و`change_from_open` أكبر
            من ٣ نقاط ⇒ الـchange مرجع قديم ⇒ ناخد `change_from_open`
            (المطابق للإغلاق الحقيقي) ⭐
         ⛔ ولو اتساووا (السهم الطبيعي) ⇒ نسيب `change` زي ما هو.
         ══════════════════════════════════════════════════════════ */
      if (isNum(r.change) && isNum(r.chgOpen) && Math.abs(r.change - r.chgOpen) > 3) {
        r.chgRaw = r.change;
        r.chgDay = r.chgOpen;
        r.chgFixed = true;
      } else {
        r.chgRaw = r.change;
        r.chgDay = r.change;
        r.chgFixed = false;
      }

      /* ══════════════════════════════════════════════════════════
         ⭐ فلتر السيولة — السهم اللي اتداول فيه ٢ سهم مش «متحرك»
         📌 نسبته بتكون عشوائية (مثال:Whitespace سهم بـ٠٪ أو +٢٠٪
            بحجم ٢ سهم) ⇒ بيكون نجم اليوم بالغلط.
         📌 القاعدة: لازم التداول يكون ٣٠٪ على الأقل من متوسط ١٠ أيام.
         ══════════════════════════════════════════════════════════ */
      if (isNum(r.relvol) && r.relvol < 0.3) continue;

      out.push(r);
    }
    return out;
  }
  function byField(f) {
    var val = function (r) { return (f === 'change') ? r.chgDay : r[f]; };
    var v = S.rows.filter(function (r) { return isNum(val(r)); });
    v.sort(function (a, b) { return Number(val(b)) - Number(val(a)); });
    return v;
  }

  /* ══════════════════════════════════════════════════════════════
     الرسم
     ══════════════════════════════════════════════════════════════ */
  function periodHTML() {
    return PERIODS.map(function (p) {
      return '<button class="mv-per' + (p.id === S.per ? ' on' : '') + '" data-per="' + p.id + '" type="button">' +
        esc(p.n) + '</button>';
    }).join('');
  }

  function rankBadge(i, dirCls) {
    var cls = 'mv-rank' + (i < 3 ? ' m' + (i + 1) : '');
    return '<span class="' + cls + '">' + (i + 1) + '</span>';
  }

  function itemHTML(r, i, maxAbs, dirCls) {
    var f = (PERIODS.filter(function (p) { return p.id === S.per; })[0] || PERIODS[0]).f;
    /* ⭐ لو الفترة = اليوم ⇒ نعرض النسبة المصحّحة (chgDay) */
    var v = (f === 'change') ? r.chgDay : r[f];
    var abs = Math.abs(Number(v) || 0);
    var w = maxAbs > 0 ? Math.max(3, Math.round(abs / maxAbs * 100)) : 0;
    var chips = [trendChip(r), flowChip(r)].filter(Boolean);
    var name = r.name || r.nameEn || r.code;
    var m = MK[S.mk] || MK.egypt;
    return '<li class="mv-item ' + dirCls + '" data-code="' + esc(r.code) + '" role="button" tabindex="0">' +
      '<div class="mv-it-top">' +
      rankBadge(i, dirCls) +
      '<div class="mv-it-main">' +
      '<div class="mv-it-name">' + esc(name) + '</div>' +
      '<div class="mv-it-sub">' + esc(r.code) +
      (r.sector ? ' · ' + esc(r.sector) : '') + '</div>' +
      '</div>' +
      '<div class="mv-it-num">' +
      '<div class="mv-it-price">' + ltr(n2(r.price)) + ' <span class="mv-cur">' + esc(m.cur) + '</span></div>' +
      '<div class="mv-it-chg ' + dir(v) + '">' + ltr(pct(v)) + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="mv-bar ' + dirCls + '"><i style="width:' + w + '%"></i></div>' +
      (chips.length
        ? '<div class="mv-chips">' + chips.map(function (c) {
            return '<span class="mv-chip ' + c.k + '">' + esc(c.t) + '</span>';
          }).join('') + '</div>'
        : '') +
      '</li>';
  }

  function moodHTML(f) {
    var up = 0, dn = 0, fl = 0, sum = 0, n = 0;
    S.rows.forEach(function (r) {
      var val = (f === 'change') ? r.chgDay : r[f];
      if (!isNum(val)) return;
      var x = Number(val);
      n++; sum += x;
      if (x > 0) up++; else if (x < 0) dn++; else fl++;
    });
    var avg = n ? sum / n : null;
    return '<div class="mv-mood">' +
      '<span class="mv-mood-i up"><b>' + up + '</b> صاعد</span>' +
      '<span class="mv-mood-i down"><b>' + dn + '</b> هابط</span>' +
      (fl ? '<span class="mv-mood-i na"><b>' + fl + '</b> ثابت</span>' : '') +
      '<span class="mv-mood-i na">متوسط <b class="' + dir(avg) + '">' + ltr(pct(avg)) + '</b></span>' +
      '</div>';
  }

  function heroHTML(f) {
    var list = byField(f);
    if (!list.length) return '';
    /* ⭐ نجم الفترة: أكبر حركة مطلقة */
    var sv = function (r) { return (f === 'change') ? r.chgDay : r[f]; };
    var star = list[0], best = Math.abs(Number(sv(star)) || 0);
    for (var i = 1; i < list.length; i++) {
      var a = Math.abs(Number(sv(list[i])) || 0);
      if (a > best) { best = a; star = list[i]; }
    }
    if (!isNum(sv(star))) return '';
    var m = MK[S.mk] || MK.egypt;
    var chips = [trendChip(star), flowChip(star)].filter(Boolean);
    return '<div class="mv-hero ' + dir(star[f]) + '">' +
      '<div class="mv-hero-lbl">🔥 نجم ' + esc((PERIODS.filter(function (p) { return p.id === S.per; })[0] || PERIODS[0]).n) + '</div>' +
      '<div class="mv-hero-row">' +
      '<div class="mv-hero-name">' + esc(star.name || star.nameEn || star.code) +
      ' <span class="mv-hero-code">' + esc(star.code) + '</span></div>' +
      '<div class="mv-hero-chg ' + dir(sv(star)) + '">' + ltr(pct(sv(star))) + '</div>' +
      '</div>' +
      '<div class="mv-hero-sub">السعر ' + ltr(n2(star.price)) + ' ' + esc(m.cur) +
      (chips.length ? ' · ' + chips.map(function (c) { return esc(c.t); }).join(' · ') : '') +
      '</div>' +
      '</div>';
  }

  function render() {
    if (!S.root) return;
    var f = (PERIODS.filter(function (p) { return p.id === S.per; })[0] || PERIODS[0]).f;
    var m = MK[S.mk] || MK.egypt;
    var list = byField(f);
    var gainers = list.slice(0, 10);
    var losers = list.slice(-10).reverse();
    var maxAbs = 0;
    gainers.concat(losers).forEach(function (r) {
      var a = Math.abs(Number(r[f]) || 0);
      if (a > maxAbs) maxAbs = a;
    });

    if (S.err) {
      S.root.innerHTML =
        '<div class="mv-wrap"><div class="mv-head"><h2 class="mv-title">🔥 لوحة المتحرّكين</h2></div>' +
        '<div class="mv-note">⟳ ' + esc(S.err) + '</div></div>';
      return;
    }
    if (!S.rows.length) {
      S.root.innerHTML =
        '<div class="mv-wrap"><div class="mv-head"><h2 class="mv-title">🔥 لوحة المتحرّكين</h2></div>' +
        '<div class="mv-note">⏳ بنجيب حركة السوق…</div></div>';
      return;
    }

    S.root.innerHTML =
      '<div class="mv-wrap">' +

      /* ── الهيدر ── */
      '<div class="mv-head">' +
      '<div class="mv-head-l">' +
      '<h2 class="mv-title">🔥 لوحة المتحرّكين</h2>' +
      '<p class="mv-sub">أكثر ١٠ صعوداً وهبوطاً في ' + esc(m.n) + ' — والقصة ورا كل حركة</p>' +
      '</div>' +
      '<div class="mv-live" id="mvLive"><span class="mv-dot"></span><span id="mvWhen">' +
      esc(S.last ? hhmmss(S.last) : '—') + '</span></div>' +
      '</div>' +

      heroHTML(f) +

      /* ── الفترات ── */
      '<div class="mv-pers" id="mvPers">' + periodHTML() + '</div>' +

      moodHTML(f) +

      /* ── العمودين ── */
      '<div class="mv-cols">' +
      '<section class="mv-col up">' +
      '<h3 class="mv-col-t"><span class="mv-col-i">▲</span> أكثر ١٠ صعوداً</h3>' +
      '<ol class="mv-list">' + gainers.map(function (r, i) { return itemHTML(r, i, maxAbs, 'up'); }).join('') + '</ol>' +
      '</section>' +
      '<section class="mv-col down">' +
      '<h3 class="mv-col-t"><span class="mv-col-i">▼</span> أكثر ١٠ هبوطاً</h3>' +
      '<ol class="mv-list">' + losers.map(function (r, i) { return itemHTML(r, i, maxAbs, 'down'); }).join('') + '</ol>' +
      '</section>' +
      '</div>' +

      /* ── دعوة المتابعة (الصفحة العامة بس) ── */
      (S.app ? '' :
      '<div class="mv-cta">' +
      '<div class="mv-cta-t"><b>الحركة دي تستاهل المتابعة؟</b>' +
      '<span>ادخل واشوف تحليل OCTA الكامل (٨ محاور + قرار واضح) لكل سهم، وابدأ تتابع اللي يعجبك.</span></div>' +
      '<a class="mv-cta-b" href="/gate.html">ادخل وابدأ تتابع ↗</a>' +
      '</div>') +

      '<div class="mv-foot">الأسعار والحركة من ماسح السوق · آخر تحديث <span id="mvWhen2">' +
      esc(S.last ? hhmmss(S.last) : '—') + '</span> · بتتحدّث كل دقيقة</div>' +

      '</div>' +

      /* ── شيت التفاصيل ── */
      '<div class="mv-sheet" id="mvSheet" hidden><div class="mv-sheet-bd" id="mvSheetBd"></div></div>';

    /* ── الأحداث ── */
    var pers = $('mvPers');
    if (pers) {
      pers.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('button[data-per]') : null;
        if (!b) return;
        S.per = b.getAttribute('data-per');
        render();
      });
    }
    var items = S.root.querySelectorAll('.mv-item');
    for (var i = 0; i < items.length; i++) {
      (function (el) {
        el.addEventListener('click', function () { openSheet(el.getAttribute('data-code')); });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(el.getAttribute('data-code')); }
        });
      })(items[i]);
    }
    var sheet = $('mvSheet');
    if (sheet) {
      sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     شيت التفاصيل — «الحركة دي إيه بالظبط؟»
     ══════════════════════════════════════════════════════════════ */
  function rangeBar(r) {
    var lo = isNum(r.l52) ? Number(r.l52) : null;
    var hi = isNum(r.h52) ? Number(r.h52) : null;
    var px = isNum(r.price) ? Number(r.price) : null;
    if (lo == null || hi == null || px == null || hi <= lo) return '';
    var pos = Math.max(0, Math.min(100, (px - lo) / (hi - lo) * 100));
    return '<div class="mv-rng">' +
      '<div class="mv-rng-t"><span>أدنى ٥٢ أسبوع</span><b>' + n2(lo) + '</b>' +
      '<span>أعلى ٥٢ أسبوع</span><b>' + n2(hi) + '</b></div>' +
      '<div class="mv-rng-bar"><i style="left:' + pos.toFixed(1) + '%"></i></div>' +
      '<div class="mv-rng-n">السعر الحالي عند ' + pos.toFixed(0) + '% من المدى</div>' +
      '</div>';
  }

  function volBar(r) {
    var v = isNum(r.volume) ? Number(r.volume) : null;
    var av = isNum(r.av30) ? Number(r.av30) : null;
    if (v == null || av == null || av <= 0) return '';
    var ratio = v / av;
    var w = Math.max(4, Math.min(100, ratio / 3 * 100));
    return '<div class="mv-vol">' +
      '<div class="mv-kv"><span>حجم التداول اليوم</span><b>' + n0(v) + '</b></div>' +
      '<div class="mv-kv"><span>متوسط ٣٠ يوم</span><b>' + n0(av) + '</b></div>' +
      '<div class="mv-vol-bar"><i style="width:' + w.toFixed(0) + '%"></i></div>' +
      '<div class="mv-rng-n">يعني ' + ratio.toFixed(1) + '× متوسط الشهر (٣٠ يوم)' +
      (isNum(r.relvol) ? ' · مقارنة ١٠ أيام: ×' + Number(r.relvol).toFixed(1) : '') +
      (ratio >= 2 || (isNum(r.relvol) && Number(r.relvol) >= 2) ? ' — ⭐ حركة عليها سيولة غير معتادة' : '') +
      '</div>' +
      '</div>';
  }

  function perGrid(r) {
    var items = PERIODS.map(function (p) {
      /* ⭐ فترة «اليوم» ⇒ النسبة المصحّحة (مش المرجع القديم) */
      var v = (p.f === 'change') ? r.chgDay : r[p.f];
      return '<div class="mv-pg-i ' + dir(v) + '"><span>' + esc(p.n) + '</span><b>' + ltr(pct(v, 1)) + '</b></div>';
    }).join('');
    return '<div class="mv-pg">' + items + '</div>';
  }

  function openSheet(code) {
    var r = null;
    for (var i = 0; i < S.rows.length; i++) if (S.rows[i].code === code) { r = S.rows[i]; break; }
    if (!r) return;
    S.openCode = code;
    var m = MK[S.mk] || MK.egypt;
    var chips = [trendChip(r), flowChip(r), hi52Chip(r)].filter(Boolean);
    var rec = recLabel(r.tvRec);
    var facts = [];
    if (isNum(r.mc)) facts.push(['القيمة السوقية', big(r.mc) + ' ' + m.cur]);
    if (isNum(r.pe)) facts.push(['مضاعف الربحية', n2(r.pe)]);
    if (isNum(r.dy)) facts.push(['العائد', n2(r.dy) + '%']);
    if (r.sector) facts.push(['القطاع', r.sector]);
    /* ⛔ النشاط بالإنجليزي (Regional Banks) ⇒ مش بنعرضه
       ⭐ («النشاط» بيتكرر مع «القطاع» برضه) — نكتفي بالقطاع العربي. */
    if (r.industry && r.industry !== r.sector && /[\u0600-\u06FF]/.test(r.industry)) {
      facts.push(['النشاط', r.industry]);
    }
    if (rec) facts.push(['توصية المصدر', rec.t]);

    var bd = $('mvSheetBd');
    if (!bd) return;
    bd.innerHTML =
      '<div class="mv-sheet-grab"></div>' +
      '<div class="mv-sheet-head">' +
      '<div><div class="mv-sheet-name">' + esc(r.name || r.nameEn || r.code) + '</div>' +
      '<div class="mv-sheet-code">' + esc(r.code) + (r.sector ? ' · ' + esc(r.sector) : '') + '</div></div>' +
      '<button class="mv-x" id="mvX" type="button" aria-label="اقفل">✕</button>' +
      '</div>' +
      '<div class="mv-sheet-price">' +
      '<div class="mv-sp-n"><b>' + n2(r.price) + '</b> <span>' + esc(m.cur) + '</span></div>' +
      '<div class="mv-sp-c ' + dir(r.chgDay) + '">' + ltr(pct(r.chgDay)) + ' اليوم</div>' +
      '</div>' +
      (r.chgFixed
        ? '<div class="mv-note-fix">ⓘ الرقم اتصحّح: المصدر كان راجع لنسبة قديمة بعد تعديل سعر السهم · المرجع الصح: ' +
          ltr(pct(r.chgDay)) + ' (مطابق للإغلاق الرسمي)</div>'
        : '') +
      (chips.length ? '<div class="mv-chips big">' + chips.map(function (c) {
        return '<span class="mv-chip ' + c.k + '">' + esc(c.t) + '</span>';
      }).join('') + '</div>' : '') +
      '<div class="mv-sheet-sec"><b>أداء السهم</b>' + perGrid(r) + '</div>' +
      '<div class="mv-sheet-sec"><b>مكانه من مدى ٥٢ أسبوع</b>' + (rangeBar(r) || '<div class="mv-none">—</div>') + '</div>' +
      '<div class="mv-sheet-sec"><b>السيولة</b>' + (volBar(r) || '<div class="mv-none">—</div>') + '</div>' +
      (facts.length ? '<div class="mv-sheet-sec"><b>أرقام سريعة</b><div class="mv-facts">' + facts.map(function (f) {
        return '<div class="mv-fact"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>';
      }).join('') + '</div></div>' : '') +
      '<div class="mv-sheet-cta">' +
      (S.app
        ? '<button class="mv-cta-b" id="mvOpen" type="button">افتح تحليل السهم في OCTA ↗</button>' +
          '<span class="mv-cta-n">تحليل كامل ٨ محاور + قرار واضح</span>'
        : '<a class="mv-cta-b" href="/gate.html">ادخل واشوف تحليل OCTA لهذا السهم ↗</a>' +
          '<span class="mv-cta-n">التحليل الكامل والقرار بعد تسجيل الدخول</span>') +
      '</div>';
    var sheet = $('mvSheet');
    if (sheet) { sheet.hidden = false; requestAnimationFrame(function () { sheet.classList.add('on'); }); }
    try { document.body.classList.add('mv-lock'); } catch (e) { }
    var x = $('mvX');
    if (x) x.addEventListener('click', closeSheet);
    var ob = $('mvOpen');
    if (ob) ob.addEventListener('click', function () { closeSheet(); openStock(r.code); });
    document.addEventListener('keydown', escClose);
  }

  /* ⭐ فتح السهم: في التطبيق ⇒ تحليل السهم · في الصفحة العامة ⇒ البوابة */
  function openStock(code) {
    if (S.app && typeof S.onOpen === 'function') {
      try { S.onOpen(code); return; } catch (e) { }
    }
    try { window.location.href = '/gate.html'; } catch (e) { }
  }

  function escClose(e) { if (e.key === 'Escape') closeSheet(); }
  function closeSheet() {
    var sheet = $('mvSheet');
    if (sheet) { sheet.classList.remove('on'); setTimeout(function () { sheet.hidden = true; }, 220); }
    S.openCode = null;
    try { document.body.classList.remove('mv-lock'); } catch (e) { }
    document.removeEventListener('keydown', escClose);
  }

  /* ══════════════════════════════════════════════════════════════
     التحميل + التحديث
     ══════════════════════════════════════════════════════════════ */
  function load(force) {
    if (!window.OCTAMkScan || !window.OCTAMkScan.has(S.mk)) {
      S.err = 'الماسح مش متاح للسوق ده';
      render();
      return;
    }
    if (S.loading) return;
    S.loading = true;
    window.OCTAMkScan.scan(S.mk, function (rows) {
      S.loading = false;
      S.err = '';
      S.rows = prep(rows);
      S.last = new Date();
      render();
      /* ⭐ لو الشيت مفتوح ⇒ حدّثه بالبيانات الجديدة */
      if (S.openCode) openSheet(S.openCode);
    }, { maxAge: force ? 0 : 60000 });
  }

  function startTimer() {
    if (S.timer) return;
    S.timer = setInterval(function () {
      if (document.hidden) return;      /* ⛔ ما نعملش طلبات والتبويب مخفي */
      /* ⛔ الكارت مطوي أو الصفحة مش معروضة ⇒ ما نعملش طلبات */
      if (!S.root || !S.root.isConnected || S.root.offsetParent === null) return;
      load(true);
    }, 60000);
  }

  /* ══════════════════════════════════════════════════════════════
     الواجهة العامة
     ══════════════════════════════════════════════════════════════ */
  function mount(el, opts) {
    S.root = (typeof el === 'string') ? $(el) : el;
    if (!S.root) return;
    opts = opts || {};
    if (opts.mk) S.mk = opts.mk;
    if (opts.app != null) S.app = !!opts.app;
    if (opts.onOpen) S.onOpen = opts.onOpen;
    S.root.classList.add('mv-root');
    if (S.app) S.root.classList.add('mv-in-app');
    render();
    load(false);
    startTimer();
    /* ⭐ تغيير السوق (من تبويبات صفحة السوق) */
    window.addEventListener('pm:market', function (e) {
      var mk = (e && e.detail && e.detail.mk) || null;
      if (!mk || mk === S.mk) return;
      S.mk = mk;
      S.openCode = null;
      S.rows = [];
      render();
      load(false);
    });
  }

  /* ⭐ تركيب تلقائي — لو القسم موجود في الصفحة */
  function auto() {
    var el = $('mvSec');
    if (el && !S.root) mount(el, {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

  window.OCTAMovers = {
    mount: mount,
    setMarket: function (mk) {
      if (!mk || mk === S.mk) return;
      S.mk = mk; S.rows = []; S.openCode = null; render(); load(false);
    },
    refresh: function () { load(true); }
  };
})();
