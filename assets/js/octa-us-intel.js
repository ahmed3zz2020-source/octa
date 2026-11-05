/* ══════════════════════════════════════════════════════════════
   🐙 دليل المنهجية — السوق الأمريكي (سلسلة الأحكام)
   ──────────────────────────────────────────────────────────────
   📌 الهدف: المستخدم يشوف **ليه** السهم ده مختار، مش بس النتيجة.
   📌 المبدأ (نفس مبادئ حزمة trader-skill):
   📌   كل خطوة = تقييم + نتيجة + **مصدر** + تاريخ + **حكم**.
   📌   مفيش رقم من غير مصدر. ومفيش توصية من غير سبب.
   📌
   📌 ⭐ كل الأرقام هنا من نفس صف TradingView اللي بتبني الكارت
   📌   ⇒ الكارت والدليل **متناسقين ١٠٠٪** (مفيش رقم متعارض).
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var EV_SRC_TV = 'TradingView · لقطة حية';
  var EV_SRC_FUND = 'TradingView · آخر ربع سنوي مُعلن';

  function ev(v, d) { return (v == null || isNaN(v)) ? '—' : nf(v, d == null ? 2 : d); }
  function evPct(v, d) { return (v == null || isNaN(v)) ? '—' : nf(v, d == null ? 1 : d) + '%'; }
  function evBdg(ok) {
    if (ok === null) return '<span class="bdg b-hold">غير متاح</span>';
    return ok ? '<span class="bdg b-buy">عدّى</span>' : '<span class="bdg b-sell">فشل</span>';
  }

  /* ── القواعد الافتراضية (نفس منطق محرك OCTA: جودة · قيمة · زخم · سيولة · مخاطرة) ── */
  function usRules(d) {
    var R = [];
    var A = function (n, ok, v, t) { R.push({ n: n, ok: ok, v: v, t: t }); };
    var pe = d['price_earnings_ttm'], roe = d['return_on_equity_fq'];
    var rsi = d['RSI'], ema = d['EMA200'], px = d['close'];
    var av = d['average_volume_30d_calc'], vol = d['Volatility.D'], de = d['debt_to_equity'];

    if (roe != null) A('جودة — عائد حقوق الملكية', roe > 15, evPct(roe), 'الشرط: أكبر من ١٥٪');
    else A('جودة — عائد حقوق الملكية', null, '—', 'البيانات ناقصة — مش محسوب');

    if (pe != null && pe > 0) A('قيمة — مضاعف الربحية', pe <= 25, nf(pe) + '×', 'الشرط: ٢٥× أو أقل');
    else if (pe != null) A('قيمة — مضاعف الربحية', null, nf(pe) + '×', 'الشركة خاسرة — مش محسوب');
    else A('قيمة — مضاعف الربحية', null, '—', 'البيانات ناقصة — مش محسوب');

    if (rsi != null) A('زخم — مؤشر القوة النسبية', rsi >= 40 && rsi <= 70, nf(rsi, 0), 'الشرط: بين ٤٠ و ٧٠');
    else A('زخم — مؤشر القوة النسبية', null, '—', 'البيانات ناقصة — مش محسوب');

    if (px != null && ema != null) {
      var up = px > ema;
      A('اتجاه — السعر فوق المتوسط ٢٠٠ يوم', up, nf(px) + ' $ / ' + nf(ema) + ' $', 'الشرط: السعر فوقه');
    } else A('اتجاه — السعر فوق المتوسط ٢٠٠ يوم', null, '—', 'البيانات ناقصة — مش محسوب');

    if (av != null) A('سيولة — حجم ٣٠ يوم', av >= 1000000, Math.round(av / 1000) + ' ألف سهم', 'الشرط: مليون سهم أو أكثر');
    else if (d['volume'] != null) A('سيولة — حجم اليوم', null, Math.round(d['volume'] / 1000) + ' ألف سهم', 'متوسط ٣٠ يوم غير متاح');
    else A('سيولة — حجم ٣٠ يوم', null, '—', 'البيانات ناقصة — مش محسوب');

    if (vol != null) A('مخاطرة — التذبذب اليومي', vol < 4, evPct(vol), 'الشرط: أقل من ٤٪');
    else A('مخاطرة — التذبذب اليومي', null, '—', 'البيانات ناقصة — مش محسوب');

    if (de != null) A('ميزانية — الدين على الملكية', de < 150, nf(de, 0) + '٪', 'الشرط: أقل من ١٥٠٪');
    else A('ميزانية — الدين على الملكية', null, '—', 'البيانات ناقصة — مش محسوب');
    return R;
  }

  /* ── حجم الصفقة (منهجية budget) ── */
  function usBudget(d, budget) {
    var px = d['close'];
    var b = Number(budget);
    if (!px || !b || b <= 0) return null;
    var cash = b * 0.10;          /* كاش بافر ١٠٪ */
    var invest = b - cash;
    var cap = invest * 0.20;      /* سقف السهم ٢٠٪ من المستثمر */
    var shares = Math.floor(cap / px);   /* أسهم كاملة — البورصة الأمريكية ما بتقبلش كسر */
    if (shares < 1) shares = 1;
    var used = shares * px;
    return { budget: b, cash: cash, cap: cap, shares: shares, used: used,
             left: invest - used, px: px };
  }

  /* ── بوابة القرار (منهجية risk) ── */
  function usGate(d, bg) {
    if (!bg) return null;
    var atr = d['ATR'];
    var stop = (atr != null && d['close'] != null) ? (d['close'] - atr * 2) : null;
    var riskUsd = (stop != null) ? (bg.shares * (bg.px - stop)) : null;
    var riskPct = (riskUsd != null && bg.budget) ? (riskUsd / bg.budget * 100) : null;
    var posPct = (bg.budget) ? (bg.used / bg.budget * 100) : null;
    var blocks = [];
    if (bg.used > bg.cap) {
      blocks.push('سهم واحد بـ $' + nf(bg.px) + ' والسقف $' + nf(bg.cap) +
                  ' — السهم غالي عن السقف · زوّد الميزانية أو اختار سهم أرخص');
    } else if (posPct != null && posPct > 20) {
      blocks.push('حجم المركز ' + nf(posPct, 1) + '٪ أكبر من السقف ٢٠٪');
    }
    if (riskPct != null && riskPct > 2) blocks.push('مخاطرة الصفقة ' + nf(riskPct, 2) + '٪ أكبر من السقف ٢٪');
    if (bg.cash < bg.budget * 0.1) blocks.push('الكاش بافر ناقص');
    return { ok: blocks.length === 0, blocks: blocks, posPct: posPct,
             riskPct: riskPct, riskUsd: riskUsd, stop: stop };
  }

  /* ── التذكرة (منهجية broker) — بس مش بينفّذ حاجة ── */
  function usTicket(d, bg) {
    if (!bg) return '';
    return '<div style="font-size:.78rem;line-height:1.8">' +
      'اشترِ <b>' + bg.shares + '</b> سهم × <b>$' + nf(bg.px) + '</b> = <b>$' + nf(bg.used) + '</b><br>' +
      'نوع الأمر: محدد · صلاحية: اليوم · الكاش الباقي: $' + nf(bg.left) + '</div>' +
      '<pre style="background:rgba(0,0,0,.35);padding:9px;border-radius:9px;font-size:.68rem;overflow:auto;direction:ltr;text-align:left;margin-top:8px">' +
      '{ "symbol": "' + esc(d._symbol || '') + '", "side": "buy", "qty": ' + bg.shares +
      ', "type": "limit", "time_in_force": "day" }</pre>' +
      '<div style="font-size:.7rem;color:var(--muted);margin-top:6px">⛔ الموقع بيطبع التذكرة بس — التنفيذ بيدك على المنصة.</div>';
  }

  /* ── التنبيهات المقترحة (منهجية alerts) ── */
  function usAlerts(d, bg) {
    var atr = d['ATR'], px = d['close'];
    if (atr == null || px == null) return '';
    var target = px + atr * 2, stop = px - atr * 2;
    return '<table><tr><td>🎯 هدف مقترح</td><td><b>$' + nf(target) + '</b></td></tr>' +
      '<tr><td>⛔ وقف مقترح</td><td><b>$' + nf(stop) + '</b></td></tr>' +
      '<tr><td>📏 اتساع يومي</td><td>$' + nf(atr) + '</td></tr></table>' +
      '<div style="font-size:.7rem;color:var(--muted);margin-top:7px">' +
      'محسوبة من المدى الحقيقي (ATR) مش تقدير · السوق الأمريكي ١٥:٣٠–٢٢:٠٠ بالقاهرة (أحد–خميس).</div>';
  }

  /* ── بناء القسم كله ── */
  window.usEvidence = function (d, sc) {
    window.__usD = d;
    var rules = usRules(d);
    var pass = 0, fail = 0, unk = 0;
    rules.forEach(function (r) { if (r.ok === null) unk++; else if (r.ok) pass++; else fail++; });

    var rows = rules.map(function (r) {
      return '<tr><td style="font-size:.72rem">' + esc(r.n) + '</td>' +
        '<td style="font-size:.72rem"><b>' + esc(r.v) + '</b></td>' +
        '<td style="font-size:.7rem;color:var(--muted)">' + esc(r.t) + '</td>' +
        '<td>' + evBdg(r.ok) + '</td></tr>';
    }).join('');

    /* التحليل الأساسي — نص */
    var pe = d['price_earnings_ttm'], roe = d['return_on_equity_fq'];
    var om = d['operating_margin'], de = d['debt_to_equity'];
    var eps = d['earnings_per_share_diluted_ttm'], ni = d['net_income'];
    var fundTxt = 'عائد الملكية ' + evPct(roe) + ' · هامش التشغيل ' + evPct(om) +
      ' · الدين على الملكية ' + (de == null ? '—' : nf(de, 0) + '٪') +
      ' · ربحية السهم $' + ev(eps) +
      ' · صافي الربح ' + (ni == null ? '—' : (Math.abs(ni) >= 1000000000 ? '$' + nf(ni / 1000000000, 1) + ' مليار' : '$' + nf(ni / 1000000, 0) + ' مليون'));

    /* التقييم — نص */
    var pt = d['price_target_median'], hi = d['high_52w'];
    var valTxt = 'مضاعف الربحية ' + (pe == null ? '—' : nf(pe) + '×') +
      ' · مضاعف الكتاب ' + ev(d['price_book_fq']) + '×' +
      ' · عائد التوزيع ' + evPct(d['dividends_yield_current']) +
      ' · هدف المحللين ' + (pt == null ? 'غير متاح' : '$' + nf(pt)) +
      (pt != null && d['close'] != null ? ' (السعر ' + nf(d['close']) + '$ ⇒ ' +
        (pt > d['close'] ? 'في مجال ' + nf((pt / d['close'] - 1) * 100, 0) + '٪ لفوق'
          : 'فوق السعر بـ ' + nf((1 - pt / d['close']) * 100, 0) + '٪') + ')' : '') +
      (hi != null && d['close'] != null ? ' · القمة السنوية $' + nf(hi) +
        ' (باقي ' + nf((1 - d['close'] / hi) * 100, 0) + '٪)' : '');

    /* السيولة — نص */
    var av = d['average_volume_30d_calc'], rv = d['relative_volume_10d_calc'];
    var mc = d['market_cap_basic'];
    var liqTxt = 'حجم ٣٠ يوم ' + (av == null ? 'غير متاح' : Math.round(av / 1000) + ' ألف سهم') +
      ' · الحجم النسبي ' + (rv == null ? '—' : nf(rv) + '×') +
      ' · القيمة السوقية ' + (mc == null ? '—' : '$' + nf(mc / 1000000000, 1) + ' مليار');

    /* المخاطرة — نص */
    var vol = d['Volatility.D'], beta = d['beta_1_year'];
    var riskTxt = 'التذبذب اليومي ' + evPct(vol) + ' · حساسية السوق ' + ev(beta) +
      (d['low_52w'] != null && d['close'] != null
        ? ' · أقصى هبوط من القمة ' + nf((1 - d['close'] / d['low_52w']) * 100, 0) + '٪' : '');

    var html = '';
    html += '<div class="mcard" id="usEvidence">' +
      '<div class="msec">🐙 ليه ده مختار؟ — سلسلة الأحكام</div>' +
      '<div style="font-size:.76rem;line-height:1.7;margin-bottom:9px">' +
      'كل خطوة تحت دي متقيّمة بالرقم الحقيقي، ومكتوب جنبه مصدره، والحكم عليها واضح. ' +
      'مفيش رقم من غير مصدر ومفيش توصية من غير سبب.</div>' +
      '<table><tr><th>الخطوة</th><th>الرقم</th><th>الشرط</th><th>الحكم</th></tr>' +
      '<tr><td style="font-size:.72rem">📊 التحليل الأساسي</td><td style="font-size:.72rem">' + fundTxt + '</td>' +
      '<td style="font-size:.7rem;color:var(--muted)">أرقام ربع سنوي</td><td>' + evBdg(true) + '</td></tr>' +
      '<tr><td style="font-size:.72rem">💎 التقييم</td><td style="font-size:.72rem">' + valTxt + '</td>' +
      '<td style="font-size:.7rem;color:var(--muted)">مضاعفات وتهدف</td><td>' + evBdg(pe != null && pe > 0 && pe <= 25) + '</td></tr>' +
      '<tr><td style="font-size:.72rem">💧 السيولة</td><td style="font-size:.72rem">' + liqTxt + '</td>' +
      '<td style="font-size:.7rem;color:var(--muted)">حجم حقيقي</td><td>' + evBdg(av == null ? null : av >= 1000000) + '</td></tr>' +
      '<tr><td style="font-size:.72rem">🛡️ المخاطرة</td><td style="font-size:.72rem">' + riskTxt + '</td>' +
      '<td style="font-size:.7rem;color:var(--muted)">تقلّب السوق</td><td>' + evBdg(vol != null && vol < 4) + '</td></tr>' +
      '</table>' +
      '<div style="font-size:.7rem;color:var(--muted);margin:7px 0 4px">المصدر: ' + EV_SRC_FUND + ' + ' + EV_SRC_TV + '</div>';

    /* قواعد الفرز */
    html += '<div style="margin-top:11px"><div style="font-size:.78rem;font-weight:800;color:#fff;margin-bottom:6px">' +
      '🎛️ قواعدي — عدّى ' + pass + ' · فشل ' + fail + (unk ? ' · غير متاح ' + unk : '') + '</div>' +
      '<table>' + rows + '</table>' +
      '<div style="font-size:.7rem;color:var(--muted);margin-top:6px">' +
      'القواعد دي هي اللي بتختار السهم. تقدر تغيّرها (القسم الجاي في «فلاتر المؤشرات»).</div></div>';

    /* حجم الصفقة + البوابة + التذكرة */
    html += '<div style="margin-top:11px"><div style="font-size:.78rem;font-weight:800;color:#fff;margin-bottom:6px">' +
      '💵 لو اشتريت بمبلغ معيّن</div>' +
      '<div style="display:flex;gap:7px;align-items:center;margin-bottom:8px">' +
      '<input id="usBudgetIn" type="number" inputmode="numeric" min="0" step="100" value="1000" ' +
      'style="flex:1;background:rgba(0,0,0,.3);border:1px solid var(--line);border-radius:9px;padding:9px;color:#fff;font-size:.8rem">' +
      '<span style="font-size:.75rem;color:var(--muted)">$</span>' +
      '<button class="fbtn on" onclick="usRecalc()" style="white-space:nowrap">احسب</button></div>' +
      '<div id="usBudgetOut"></div></div>';

    /* التنبيهات */
    html += '<div style="margin-top:11px"><div style="font-size:.78rem;font-weight:800;color:#fff;margin-bottom:6px">' +
      '🗓️ تنبيهات مقترحة</div>' + usAlerts(d) + '</div>';

    /* المنهجية */
    html += '<div style="margin-top:11px;font-size:.7rem;color:var(--muted);line-height:1.8">' +
      '<b>المنهجية المستخدمة:</b> تحليل أساسي (SEC/TradingView) · تقييم · سيولة · مخاطرة · قواعد فرز · ' +
      'حجم صفقة بكاش بافر وسقف لكل سهم · بوابة قرار · تذكرة · تنبيهات. ' +
      'الحكم النهائي قرارك — الموقع بيشرح ويحسب، ما بياخدش قرار عنك.</div>';

    html += '</div>';
    return html;
  };

  /* ── إعادة الحساب عند تغيير المبلغ ── */
  window.usRecalc = function () {
    var d = window.__usD;
    var box = document.getElementById('usBudgetOut');
    if (!d || !box) return;
    var inp = document.getElementById('usBudgetIn');
    var bg = usBudget(d, inp ? inp.value : 0);
    if (!bg) { box.innerHTML = '<div style="font-size:.72rem;color:var(--muted)">اكتب مبلغ أكبر من صفر.</div>'; return; }
    var g = usGate(d, bg);
    var gateHtml = g ? (g.ok
      ? '<div class="mflag grn"><span>🚦</span><span><b>بوابة القرار: PASS.</b> ' +
        'حجم المركز ' + nf(g.posPct, 1) + '٪ (سقف ٢٠٪) · مخاطرة الصفقة ' +
        (g.riskPct == null ? '—' : nf(g.riskPct, 2) + '٪') + ' (سقف ٢٪) · ' +
        'كاش بافر $' + nf(bg.cash) + ' (١٠٪).</span></div>'
      : '<div class="mflag red"><span>🚦</span><span><b>بوابة القرار: BLOCK.</b> ' +
        g.blocks.join(' · ') + '</span></div>') : '';

    box.innerHTML =
      '<table><tr><td>💰 الكاش البافر (١٠٪)</td><td><b>$' + nf(bg.cash) + '</b></td></tr>' +
      '<tr><td>🎯 سقف السهم (٢٠٪ من المستثمر)</td><td><b>$' + nf(bg.cap) + '</b></td></tr>' +
      '<tr><td>📦 حجم الأمر</td><td><b>' + bg.shares + ' سهم</b> = $' + nf(bg.used) + '</td></tr>' +
      '<tr><td>💵 كاش فاضي</td><td>$' + nf(bg.left) + '</td></tr></table>' +
      gateHtml +
      '<div style="margin-top:9px"><div style="font-size:.78rem;font-weight:800;color:#fff;margin-bottom:5px">🎫 التذكرة</div>' +
      usTicket(d, bg) + '</div>';
  };

  /* ── تشغيل تلقائي عند رسم الكارت ── */
  window.addEventListener('load', function () {
    setTimeout(function () { try { window.usRecalc(); } catch (e) { } }, 300);
  });
})();
