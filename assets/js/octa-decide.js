/* ══════════════════════════════════════════════════════════════
   🎯 قرار اليوم — Decision Engine
   ------------------------------------------------------------
   يحوّل 296 سهما إلى 3 قرارات واضحة:
     • مين أشتري
     • بكام (نسبة رأس المال)
     • امتى أبيع
     • إيه اللي يخلّيني أغيّر رأيي

   المبدأ: ما نختارش بالترتيب المجرد — نختار بالأساسيات،
   لأن الترتيب الأول (INEG 100 نقطة) هو زخم بلا أساسيات.
   ══════════════════════════════════════════════════════════════ */

(function () {

  /* ═══ قارئ مرن للحقول — OS_DB فيها أسماء مختلفة ═══ */
  function gv(s, keys, dflt) {
    for (let i = 0; i < keys.length; i++) {
      const v = s[keys[i]];
      if (v != null && v !=='' && v !== 0 - 1e12) return v;
    }
    return dflt;
  }
  const F_ = {
    price:  ['price','p','last'],
    total:  ['total','score','octa','final_score'],
    conf:   ['conf','scoreConf','confidence'],
    verdict:['verdict','decision','v'],
    why:    ['why','whyNote'],
    roe:    ['roe','roeAvg'],
    pe:     ['pe','peSrc'],
    pb:     ['pb','pbSrc'],
    dy:     ['dy','yield','divYield'],
    de:     ['de','deRatio','debtToEquity'],
    cr:     ['cr','curRatio','currentRatio'],
    qr:     ['qr','quickRatio'],
    roic:   ['roic','roicQ'],
    roa:    ['roa','roaQ','roaV'],
    fcf:    ['fcf','fcfV','fcfQ'],
    eps:    ['eps','epsV'],
    ebitda: ['ebitda','ebitdaV','ebitdaQ'],
    mdd1y:  ['mdd1y'],
    mdd:    ['mdd'],
    vol1y:  ['vol1y','volatility','vol'],
    frm52hi:['frm52hi','from52hi'],
    rsi:    ['rsi'],
    av30:   ['av30','avgVol30','volume','av'],
    mc:     ['mc','mcap'],
    sector: ['sectorAr','sector','sectorEn'],
    gm:     ['gm','grossMargin'],
    om:     ['om','opMargin','netMargin','nm'],
    rev:    ['rev','revenue','revV']
  };
  function gq(s, key, dflt) { return gv(s, F_[key] || [key], dflt); }

  /* ── ① بوابة الجودة: نرفض الأسهم بلا أساسيات ── */
  function hasFundamentals(s) {
    let f = 0;
    if (gq(s,'roe') != null && gq(s,'roe') > 8) f++;
    if (gq(s,'pe') != null && gq(s,'pe') > 0 && gq(s,'pe') < 30) f++;
    if (gq(s,'pb') != null && gq(s,'pb') > 0 && gq(s,'pb') < 4) f++;
    if (gq(s,'de') != null && gq(s,'de') < 100) f++;
    if (gq(s,'cr') != null && gq(s,'cr') > 1) f++;
    if (gq(s,'dy') != null && gq(s,'dy') > 2) f++;
    return f;                              /* 0..6 */
  }

  function liquidityOk(s) {
    const av = gq(s,'av30') || 0;
    const mc = gq(s,'mc') || 0;
    if (av <= 0) return false;
    /* نقدر نبيع 50k في 3 أيام → سيولة كافية */
    const days = (50000) / (av * 0.15);
    return days <= 3 && mc > 2e8;
  }

  /* ── ② لماذا هذا السهم (ملفات صريحة) ── */
  function reasons(s) {
    const out = [];
    if (gq(s,'roe') != null && gq(s,'roe') > 15) out.push({ i:'📈', t:' ROE' + gq(s,'roe').toFixed(0) +'% — الشركة بتكسب من فلوسها' });
    if (gq(s,'roe') != null && gq(s,'roe') > 8 && gq(s,'roe') <= 15) out.push({ i:'📈', t:' ROE' + gq(s,'roe').toFixed(0) +'% — ربحية كويسة' });
    if (gq(s,'dy') != null && gq(s,'dy') > 3) out.push({ i:'💰', t:' توزيع' + gq(s,'dy').toFixed(1) +'% — كاش بيرجعلك' });
    if (gq(s,'pe') != null && gq(s,'pe') > 0 && gq(s,'pe') < 12) out.push({ i:'💎', t:' P/E' + gq(s,'pe').toFixed(1) +' — رخيص مقارنة بالسوق' });
    if (gq(s,'de') != null && gq(s,'de') < 50) out.push({ i:'🛡️', t:' دين' + gq(s,'de').toFixed(0) +'% — ممتولش' });
    if (gq(s,'cr') != null && gq(s,'cr') > 2) out.push({ i:'💵', t:' سيولة' + gq(s,'cr').toFixed(1) +' — وفاء مريح' });
    if (gq(s,'qr') != null && gq(s,'qr') > 1) out.push({ i:'⚡', t:' سيولة سريعة' + gq(s,'qr').toFixed(1) });
    if (gq(s,'roic') != null && gq(s,'roic') > 12) out.push({ i:'🏭', t:' ROIC' + gq(s,'roic').toFixed(0) +'% — استثمار ذكي' });
    if (gq(s,'fcf') != null && gq(s,'fcf') > 0) out.push({ i:'🏦', t:' كاش موجب — الشركة بتولّد فلوس' });
    if (gq(s,'eps') != null && gq(s,'eps') > 0) out.push({ i:'📊', t:' ربح السهم موجب' });
    return out.slice(0, 4);
  }

  /* ── ③ مخاطر — نفس منطق النظام بس مشبّط ── */
  function risks(s) {
    const out = [];
    if (gq(s,'mdd1y') != null && gq(s,'mdd1y') >= 25) out.push({ i:'⚠️', t:' نزل' + gq(s,'mdd1y').toFixed(0) +'% في سنة — متوقع' });
    if (gq(s,'vol1y') != null && gq(s,'vol1y') >= 55) out.push({ i:'🌊', t:' متذبذب' + gq(s,'vol1y').toFixed(0) +'% — ييجي ويغيب' });
    if (gq(s,'de') != null && gq(s,'de') > 80) out.push({ i:'⛓️', t:' دين عالي' + gq(s,'de').toFixed(0) +'%' });
    if (gq(s,'frm52hi') != null && gq(s,'frm52hi') < -40) out.push({ i:'📉', t:' بعيد' + Math.abs(gq(s,'frm52hi')).toFixed(0) +'% عن أعلى 52 أسبوع' });
    if (gq(s,'rsi') != null && gq(s,'rsi') > 72) out.push({ i:'🔥', t:' RSI' + gq(s,'rsi').toFixed(0) +' — شرائي، متستناش أعلى' });
    if (gq(s,'cr') != null && gq(s,'qr') != null) {
      if (gq(s,'qr') < 0.35) out.push({ i:'🚨', t:' سيولة سريعة ضعيفة — صعب يبيع بسرعة' });
    } else if (gq(s,'cr') != null && gq(s,'cr') < 0.5) {
      out.push({ i:'🚨', t:' سيولة ضعيفة — قدرته على الوفاء ضعيفة' });
    }
    return out.slice(0, 3);
  }

  /* ── ④ نقطة القرار (مش ترتيب OCTA الخام) ── */
  function decisionScore(s) {
    const F = hasFundamentals(s);
    if (F < 3) return -1;                  /* مفيش أساسيات = نستبعد */
    if (!liquidityOk(s)) return -1;        /* مش قابل للشراء/البيع */

    let sc = 0;
    sc += F * 8;                           /* 24..48 من الأساسيات */
    sc += (gq(s,'total') || 0) * 0.22;           /* OCTA score */
    if (gq(s,'roe')) sc += Math.min(gq(s,'roe'), 30) * 0.5;
    if (gq(s,'pe') > 0) sc += Math.max(0, 20 - gq(s,'pe')) * 0.7;
    if (gq(s,'dy')) sc += Math.min(gq(s,'dy'), 8) * 1.2;
    if (gq(s,'de') != null) sc += Math.max(0, 70 - gq(s,'de')) * 0.25;
    if (gq(s,'roic')) sc += Math.min(gq(s,'roic'), 20) * 0.5;
    if (gq(s,'fcf') > 0) sc += 8;
    if (gq(s,'cr') > 2) sc += 5;
    sc -= (gq(s,'mdd1y') || 0) * 0.35;           /* عقوبة المخاطرة */
    sc -= (gq(s,'vol1y') || 0) * 0.15;
    if (gq(s,'rsi') > 75) sc -= 10;
    if (gq(s,'rsi') < 30) sc += 6;               /* تشبع بيعي = فرصة */
    return sc;
  }

  /* ── ⑤ الأهداف: سعر الدخول / الهدف / وقف الخسارة ── */
  function plan(s, alloc) {
    const px = gq(s,'price',0);
    const vol = gq(s,'vol1y') || 40;

    /* هدف: نتوقع +18% لو مستقر، +28% لو momentum، -12% لو عالي التذبذب */
    let up = 0.18 + (gq(s,'rsi') < 35 ? 0.10 : 0) + (gq(s,'roe') > 18 ? 0.05 : 0) - (vol - 40) * 0.0022;
    up = Math.max(0.10, Math.min(0.30, up));

    /* وقف الخسارة: تحت الدعم — مش أكبر من 15% أبداً */
    const stop = Math.max(0.08, Math.min(0.15, vol * 0.0055));

    /* الربح المتوقع للفرد */
    const expRet = up * 100;
    const risk = stop * 100;

    return {
      entry: px,
      target: +(px * (1 + up)).toFixed(2),
      stop: +(px * (1 - stop)).toFixed(2),
      up: +(up * 100).toFixed(1),
      stopPct: +(stop * 100).toFixed(1),
      expRet: +expRet.toFixed(1),
      rr: +(up / stop).toFixed(1),           /* نسبة العائد/المخاطرة */
      alloc: alloc,
      lots: Math.max(1, Math.floor(alloc / (px * 100)))      /* لوتات مصرفية */
    };
  }

  /* ── ⑥ شروط تغيير الرأي — القاعدة الذهبية ── */
  function thesis(s) {
    const px = gq(s,'price',0);
    const t = plan(s, 0);
    return [
      { i: '✅', ok: 'يبدأ', t: 'ابدأ متابعته — لو وصل ' + t.target.toFixed(1) + ' أو لسه فوق ' + (px * 0.97).toFixed(1) },
      { i: '🚨', ok: 'اخرج', t: 'السعر نزل تحت ' + t.stop.toFixed(1) + ' — خط أحمر، الفرضية الأساسية اتكسرت' },
      { i: '📉', ok: 'راجع', t: 'لو ROE نزل تحت ' + Math.max(5, ((gq(s, 'roe') || 10) * 0.55).toFixed(0)) + '% أو التوزيع اتلغى' },
      { i: '⚡', ok: 'زوّد', t: 'لو وصل ' + (px * 1.03).toFixed(1) + ' والتقييم لسه قايم — زوّد 25%' }
    ];
  }

  /* ── ⑦ بناء القرار الكامل ── */
  function buildDecision() {
    const db = (typeof OS_DB !=='undefined' ? OS_DB : []);
    const scored = [];

    db.forEach(function (s) {
      const sc = decisionScore(s);
      if (sc > 0) scored.push({ s: s, ds: sc, F: hasFundamentals(s) });
    });

    scored.sort(function (a, b) { return b.ds - a.ds; });

    /* 3 فرص — مع تنويع: ما ناخدش كلهم نفس القطاع */
    const picks = [];
    const sectors = {};
    scored.forEach(function (r) {
      if (picks.length >= 3) return;
      const sec = gq(r.s,'sector','—');
      if (sectors[sec] >= 2) return;
      sectors[sec] = (sectors[sec] || 0) + 1;
      picks.push(r);
    });
    if (picks.length < 3) {
      scored.forEach(function (r) {
        if (picks.length >= 3) return;
        if (picks.indexOf(r) === -1) picks.push(r);
      });
    }

    /* توزيع رأس المال: الأقوى أكبر — 45/35/20 */
    const weights = [45, 33, 22];

    const cards = picks.map(function (r, i) {
      const pl = plan(r.s, weights[i]);
      return {
        code: r.s.code,
        name: r.s.name,
        nameEn: r.s.nameEn,
        sector: gq(r.s,'sector'),
        price: r.s.p,
        ds: +r.ds.toFixed(1),
        F: r.F,
        octa: gq(r.s,'total',0),
        conf: gq(r.s,'conf',0),
        why: gq(r.s,'why',''),
        reasons: reasons(r.s),
        risks: risks(r.s),
        plan: pl,
        thesis: thesis(r.s)
      };
    });

    /* الـmarket context */
    const all = db.filter(x => x.price > 0);
    const avgConf = all.length
      ? (all.reduce(function (a, x) { return a + (x.conf || 0); }, 0) / all.length) : 0;
    const dist = {};
    db.forEach(function (x) { dist[x.verdict ||'—'] = (dist[x.verdict ||'—'] || 0) + 1; });

    return {
      cards: cards,
      pool: scored.length,
      rejected: db.length - scored.length,
      market: {
        total: db.length,
        avgConf: +avgConf.toFixed(0),
        dist: dist,
        date: (typeof OS_TS !=='undefined' ? OS_TS :'')
      }
    };
  }

  /* ── ⑧ رندر الصفحة ── */
  function render() {
    const out = document.getElementById('decideBody');
    if (!out) return;

    const D = buildDecision();

    if (!D.cards.length) {
      var db = (typeof OS_DB !=='undefined' ? OS_DB : []);
      out.innerHTML ='<div class="dc-loading">⏳ بنحسب من' + (db.length ||'?') +
       ' سهم... لو فضلت كده 5 ثواني اعمل تحديث للصفحة</div>';
      return;
    }

    /* ── Market bar ── */
    let h ='<div class="dc-mkt">' +
     '<div class="dc-mkt-t">📊 حالة السوق النهاردة</div>' +
     '<div class="dc-mkt-g">' +
       '<div class="dc-mk"><b>' + D.market.total +'</b><span>سهم مدروس</span></div>' +
       '<div class="dc-mk ok"><b>' + D.pool +'</b><span>اجتاز البوابة</span></div>' +
       '<div class="dc-mk no"><b>' + D.rejected +'</b><span>مستبعد</span></div>' +
       '<div class="dc-mk"><b>' + D.market.avgConf +'%</b><span>متوسط الثقة</span></div>' +
     '</div>' +
     '<div class="dc-dist">' + Object.keys(D.market.dist).map(function (k) {
        const n = D.market.dist[k];
        const w = (n / D.market.total * 100).toFixed(0);
        return'<span class="dc-dt' + (k ==='تجميع' ?'good' : k ==='بيع' ?'bad' :'') +'">' +
          esc(k) +' <b>' + n +'</b> <i>' + w +'%</i></span>';
      }).join('') +'</div>' +
   '</div>';

    /* ── Hero: خلاصة في سطرين ── */
    h +='<div class="dc-hero">' +
     '<div class="dc-hero-k">🎯 قرار اليوم</div>' +
     '<div class="dc-hero-t">اشترِ <b>' + D.cards.length +'</b>، وشوف الباقي</div>' +
     '<div class="dc-hero-s">' +
       'من' + D.pool +' سهم اجتاز الجودة والسيولة، دي فرص اليوم —' +
       'كل واحد وراه سبب مكتوب، ووراه خطة بيع، ووراه شرط واضح إنك تخرج.' +
     '</div>' +
   '</div>';

    /* ── الكروت ── */
    D.cards.forEach(function (c, i) {
      const pl = c.plan;

      /* الأسباب */
      const rs = c.reasons.map(function (r) {
        return'<li><span>' + r.i +'</span>' + esc(r.t) +'</li>';
      }).join('') ||'<li class="muted">⛔ مفيش سبب واضح بعد</li>';

      /* المخاطر */
      const ks = c.risks.map(function (r) {
        return'<li><span>' + r.i +'</span>' + esc(r.t) +'</li>';
      }).join('') ||'<li class="muted">✅ ما فيش مخاطر بارزة</li>';

      /* الخطة */
      const plHtml =
       '<div class="dc-plan">' +
         '<div class="dcp-row">' +
           '<div class="dcp-i"><span>💵 تدفع</span><b>' + c.price.toFixed(2) +' ج</b></div>' +
           '<div class="dcp-i tgt"><span>🎯 لو وصل</span><b>' + pl.target.toFixed(2) +' ج</b></div>' +
           '<div class="dcp-i stop"><span>🚨 لو نزل</span><b>' + pl.stop.toFixed(2) +' ج</b></div>' +
         '</div>' +
         '<div class="dcp-row2">' +
           '<span>📊 ربح متوقع <b class="g">+' + pl.up +'%</b></span>' +
           '<span>🛡️ خسارة لو خطأ <b class="r">-' + pl.stopPct +'%</b></span>' +
           '<span>⚖️ عائد/خطر <b>' + pl.rr +':1</b></span>' +
         '</div>' +
         '<div class="dcp-alloc">' +
           '<span>💼 خد من راس المال</span>' +
           '<div class="dcp-bar"><i style="width:' + pl.alloc +'%"></i></div>' +
           '<b>' + pl.alloc +'%</b>' +
         '</div>' +
       '</div>';

      /* شروط تغيير الرأي */
      const th = c.thesis.map(function (t) {
        return'<div class="dc-th' + (t.ok ==='اخرج' ?'bad' : t.ok ==='زوّد' ?'good' :'') +'">' +
         '<span>' + t.i +'</span><b>' + esc(t.ok) +'</b>' +
         '<em>' + esc(t.t) +'</em></div>';
      }).join('');

      h +='<div class="dc-card" style="--d:' + (i + 1) +'">' +
       '<div class="dc-head">' +
         '<div class="dc-rank">' + (i + 1) +'</div>' +
         '<div class="dc-id">' +
           '<div class="dc-name" onclick="openStock(\'' + c.code +'\')">' + esc(c.name) +'</div>' +
           '<div class="dc-meta">' + esc(c.code) +
              (c.sector && c.sector !=='—' ?' ·' + esc(c.sector) :'') +
             ' · ثقة' + c.conf +'%' +
           '</div>' +
         '</div>' +
         '<div class="dc-alloc2"><b>' + pl.alloc +'%</b><span>من راس المال</span></div>' +
       '</div>' +

       '<div class="dc-grid">' +
         '<div class="dc-box dc-why"><div class="dc-bh">✅ ليه ده؟</div><ul>' + rs +'</ul></div>' +
         '<div class="dc-box dc-risk"><div class="dc-bh">⚠️ احذر</div><ul>' + ks +'</ul></div>' +
       '</div>' +

        plHtml +

       '<div class="dc-bh2">🧭 متى تبيع ومتى تغيّر رأيك</div>' +
       '<div class="dc-thesis">' + th +'</div>' +

       '<div class="dc-foot">' +
         '<span>تقييم OCTA: <b>' + c.octa.toFixed(0) +'</b>/100</span>' +
         '<span>أساسيات: <b>' + c.F +'/6</b></span>' +
          (c.conf < 50 ?'<span class="warn">⚠️ البيانات ناقصة — راجع قبل الشراء</span>' :'') +
         '<button class="dc-bell" onclick="watchEdit(\'' + c.code +'\')">🔔 منبه سعر</button>' +
       '</div>' +
     '</div>';
    });

    /* ── ليه الباقي اترفض ── */
    h +='<div class="dc-rest">' +
     '<div class="dc-bh2">🚫 ليه الباقي مش النهاردة</div>' +
     '<ul>' +
       '<li><span>🚫</span>' + D.rejected +' سهم اترفضوا — إما بيانات ناقصة، وإما سيولة ضعيفة</li>' +
       '<li><span>⚖️</span>الاختيار محسوب مش عشوائي: أساسيات + سيولة + مخاطرة + تقييم</li>' +
       '<li><span>🔄</span>الصفحة بتتحدث مع كل تحديث للأسعار — القرار ممكن يتغيّر</li>' +
     '</ul>' +
   '</div>';

    out.innerHTML = h;

    /* ارسم الأجراس */
    setTimeout(function () {
      D.cards.forEach(function (c) { try { renderBell(c.code); } catch (e) { } });
    }, 100);
  }

  /* esc — محلي عشان الـwatch ملف تاني */
  function esc(v) {
    return String(v == null ? '—' : v)
      /* شيل أي حرف غريب: صيني / كوري / سيريلي / تالف */
      .replace(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u4e00-\u9fff\u0400-\u04FF\ufffd]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.buildDecision = buildDecision;

  /* ملاحظة: switchPage بياخد النداء من octa-core.js مباشرة
     عشان مفيش تعارض بين الملفين */

  function boot() {
    /* لو النافذة مفتوحة، ننتظر الـDB */
    var tries = 0;
    (function wait(){
      var n = (typeof OS_DB !=='undefined') ? OS_DB.length : 0;
      if (n > 0 || tries > 20) { render(); return; }
      tries++;
      setTimeout(wait, 350);
    })();
  }
  if (document.readyState ==='loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }


  /* ══════════════════════════════════════════════════════════════
     🪟 الواجهة العامة — نافذة منبثقة
     ══════════════════════════════════════════════════════════════ */

  window.renderDecision = render;
  window.buildDecision = buildDecision;

  /* إنشاء النافذة لو مش موجودة (adenance الـDOM) */
  function ensureModal() {
    var m = document.getElementById('decideModal');
    if (m) return m;
    var d = document.createElement('div');
    d.id ='decideModal';
    d.className ='dc-modal';
    d.onclick = function (e) { if (e.target === this) window.closeDecide(); };
    d.innerHTML =
     '<div class="dc-modal-box">' +
       '<div class="dc-mhead">' +
         '<div><div class="dc-mtitle">🎯 قرار اليوم</div>' +
         '<div class="dc-msub">3 فرص محسوبة — سبب، خطة، وشرط خروج لكل واحدة</div></div>' +
         '<button class="dc-mclose" onclick="closeDecide()" title="اقفل (Esc)">✕</button>' +
       '</div>' +
       '<div id="decideBody"><div class="dc-loading">⏳ بنحمّل بيانات 296 سهم...<br><small>ثانيتين بس</small></div></div>' +
     '</div>';
    document.body.appendChild(d);
    return d;
  }

  window.openDecide = function () {
    var m = ensureModal();
    m.style.display ='flex';
    document.body.style.overflow ='hidden';

    var tries = 0;
    (function wait(){
      var n = (typeof OS_DB !=='undefined') ? OS_DB.length : 0;
      if (n > 0) { render(); return; }
      var body = document.getElementById('decideBody');
      if (body && !body.dataset.loaded) {
        body.innerHTML ='<div class="dc-loading">⏳ بنحمّل بيانات' +
          (n || 296) +' سهم...<br><small>ثانيتين بس</small></div>';
      }
      if (tries === 1 && typeof octaLoadDB ==='function') { try { octaLoadDB(); } catch(e){} }
      if (tries > 22) { render(); return; }
      tries++;
      setTimeout(wait, 380);
    })();
  };

  window.closeDecide = function () {
    var m = document.getElementById('decideModal');
    if (m) m.style.display ='none';
    document.body.style.overflow ='';
  };

  document.addEventListener('keydown', function (e) {
    if (e.key ==='Escape' && window.closeDecide) window.closeDecide();
  });

})();