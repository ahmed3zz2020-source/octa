/* ══════════════════════════════════════════════════════════════════════
  🐙 OCTA · octa-gold.js — كارت الذهب (XAU/USD)
  ══════════════════════════════════════════════════════════════════════
  📌 مهمة الملف:
     ① شارة مضيئة على كارت الأصول العالمية: 🟢 شراء / 🔴 بيع / 🔵 خامل
     ② دوس على الكارت → شاشة كاملة للتحليل
     ③ تحديث تلقائي كل ٩٠ ثانية

  ⛔ قاعدة المشروع: النتيجة رقم رياضي · الشرح جملة عربية.
     مفيش أي ذكاء اصطناعي بيختار اللون. اللون = درجة × بوابات.

  📡 المصدر: /api/gold/signal  (خفيف — بيتنادى كل ٩٠ ثانية)
     /api/gold/deep    (المفصّل — بيتنادى لما تفتح الشاشة بس)
  ══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var POLL = 90000;                 // ٩٠ ثانية
  var ID = 'gmv';                   // gold modal view
  var CACHE = { sig: null, deep: null, deepAt: 0 };
  var OPEN = false;

  /* ═══ مساعدات ═══ */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function apiBase() { return window.OCTA_API || ''; }
  function num(v, n) {
    /* ⛔ دالة العرض الرقمي: أي حاجة مش رقم بتطلع «—».
       ده الحاجز اللي بيمنع نص متسرّب من الـ API يتحوّل HTML. */
    if (v == null || v === '' || v === true || v === false) return '—';
    var x = Number(v);
    if (!isFinite(x)) return '—';
    var dp = (n == null ? 2 : n);
    return x.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function signed(v, n) {
    if (v == null || v === true || v === false) return '—';
    var x = Number(v);
    if (!isFinite(x)) return '—';
    return (x >= 0 ? '+' : '') + x.toFixed(n == null ? 2 : n);
  }

  var LABEL = {
    green: { t: 'فرصة شراء', short: 'شراء', c: 'g' },
    red:   { t: 'فرصة بيع',  short: 'بيع',  c: 'r' },
    blue:  { t: 'خامل — استنى', short: 'خامل', c: 'b' },
    /* ⛔ «مقفول» مش «خامل»: السوق مش شغال دلوقتي (جمعة/سبت/الليل)
       فمفيش تحليل خالص. الفرق مهم — «خامل» معناها حلّلنا وما لقيناش. */
    closed:{ t: 'السوق مقفول — مفيش تحليل دلوقتي', short: 'مقفول', c: 'z' }
  };

  /* ══════════════════════════════════════════════════════════════════
     ⛔ قواميس الترجمة — ياسر · ١٦ أكتوبر ٢٠٢٦
     ──────────────────────────────────────────────────────────────────
     المحرك بيبعت رموز إنجليزية (BOS · CHoCH · Equal Highs · High · rr)
     كأنها شوية رموز برمجية. ⛔ أي رمز منهم ما يوصلش على الشاشة.
     كل واحد بيتحوّل لجملة عربية مفهومة قبل ما يتكتب.
     ولو رمز جديد مالوش ترجمة → ما بنعرضوش غلط: بنكتب «حدث هيكلي».
     ══════════════════════════════════════════════════════════════════ */
  var AR_GATE = {
    price:     'السعر',
    fresh:     'حداثة البيانات',
    news:      'الأخبار',
    liquidity: 'السيولة',
    vol:       'التقلب',
    rr:        'العائد',
    learn:     'حالة المحرك'
  };
  var AR_EV = {
    BOS:   'كسر القمة أو القاع',
    CHoCH: 'تغيّر اتجاه الهيكل'
  };
  var AR_SWEEP = {
    'Equal Highs': 'قمم متساوية',
    'Equal Lows':  'قاعان متساويان',
    PDH: 'قمة اليوم اللي فات',
    PDL: 'قاع اليوم اللي فات'
  };
  var AR_IMP = { High: 'عالي', Medium: 'متوسط', Low: 'منخفض' };
  var AR_ZONE = { Range: 'نطاق سعر سابق', FVG: 'فراغ سعري' };

  /* ⛔ أسماء أحداث التقويم جاية من مصدر خارجي بالإنجليزي.
     نحوّل أشهر الأحداث اللي بتحرّك الذهب. لو الحدث مش في القاموس،
     بنكتب اسمه زي ما جه — ⛔ ما بنخمّنش ترجمة. */
  var AR_NEWS = [
    /* ⛔ الترتيب مهم: القاعدة أخص بتسبق أعم. لو العكس، «محضر الاجتماع»
       هيتقرا «بيان قرار الفائدة»، و«التضخم الأساسي» هيبقى «التضخم». */
    [/FOMC Meeting Minutes|Minutes/i, 'محضر اجتماع الفيدرالي'],
    [/Core CPI/i, 'التضخم الأساسي'],
    [/Beige Book/i, 'كتاب آراء الفيدرالي'],
    [/Fed Chair|Powell|Press Conference/i, 'مؤتمر رئيس الفيدرالي'],
    [/Fed Interest Rate|Decision Statement|FOMC Statement/i, 'بيان قرار الفائدة'],
    [/FOMC/i, 'اجتماع الفيدرالي'],
    [/Non-?Farm|Nonfarm|NFP|Payroll|Employment Change/i, 'التوظيف غير الزراعي'],
    [/Initial Jobless|Jobless Claims/i, 'طلبات إعانة العاطلين'],
    [/Unemployment Rate/i, 'معدل البطالة'],
    [/CPI|Consumer Price/i, 'التضخم — بيانات المستهلك'],
    [/PPI|Producer Price/i, 'أسعار المنتجين'],
    [/Retail Sales/i, 'مبيعات التجزئة'],
    [/GDP/i, 'الناتج المحلي'],
    [/ISM/i, 'مؤشر نشاط المصانع'],
    [/Durable Goods/i, 'السلع المعمّرة'],
    [/Consumer Confidence/i, 'ثقة المستهلك'],
    [/Housing|Home/i, 'العقارات'],
    [/Trade Balance/i, 'الميزان التجاري'],
    [/Crude Oil|API Oil|EIA/i, 'النفط الخام'],
    [/Fed Speak|Speech|Testify/i, 'كلام مسؤول في الفيدرالي']
  ];
  function newsAr(title) {
    if (!title) return '';
    for (var i = 0; i < AR_NEWS.length; i++) {
      if (AR_NEWS[i][0].test(title)) return AR_NEWS[i][1];
    }
    return title;      /* ⛔ مش معروف — نكتبه زي ما هو */
  }

  function ar(map, code, fallback) {
    if (code == null || code === '') return fallback || '—';
    return map[code] || fallback || 'حدث هيكلي';
  }
  /* ⛔ الفريم = طول الشمعة. الكود جاي من المحرك (M5 · H1 · D1)،
     والقارئ المبتدئ مش فاهم الأكواد — فنحوّلها لكلام.
     لو فريم جديد مالوش ترجمة: بنكتب طوله بالاسم العام، مش الكود. */
  var AR_TF = {
    M1: 'دقيقة', M3: '٣ دقايق', M5: 'خمس دقايق', M15: 'ربع ساعة',
    M30: 'نص ساعة', H1: 'ساعة', H2: 'ساعتين', H4: 'أربع ساعات',
    D1: 'يوم', D: 'يوم', W1: 'أسبوع'
  };
  function tfName(code) {
    if (code == null || code === '') return '';
    if (AR_TF[code]) return AR_TF[code];
    var m = /^M(\d+)$/.exec(code);
    if (m) return num(Number(m[1]), 0) + ' دقايق';
    m = /^H(\d+)$/.exec(code);
    if (m) return num(Number(m[1]), 0) + ' ساعة';
    return '';
  }

  /* ⛔ التحذير الثابت — لازم يبقى آخر سطر في أي كلام توجيهي.
     التقييم قياس ومقارنة، مش توصية شراء ولا بيع. */
  var NO_ADVICE = '⚠️ قياس ومقارنة — مش نصيحة استثمارية، ومفيش أي رقم هنا ضمان للربح.';

  /* ══════════════════════════════════════════════════════════════════
     ①  الشارة المضيئة — بتتدرج جوه كارت الأصول العالمية
     ══════════════════════════════════════════════════════════════════ */
  function buildBadge(sig) {
    var col = (sig && sig.closed) ? 'closed' : ((sig && sig.color) || 'blue');
    var lab = LABEL[col] || LABEL.blue;
    var st = (sig && sig.side) || 'HOLD';
    var sc = sig && sig.score != null ? sig.score : 0;
    var wr = el('span', 'gdot gdot--' + col);
    wr.setAttribute('role', 'img');
    wr.setAttribute('aria-label', lab.t);
    wr.title = lab.t + ' · درجة ' + sc;
    var tx = el('span', 'gtxt');
    tx.appendChild(wr);
    tx.appendChild(el('b', null, lab.short));
    tx.appendChild(el('i', 'gsc', String(Math.abs(sc))));
    if (sig && sig.news_blocked) {
      var w = el('em', 'gwarn', 'خبر');
      w.title = 'فيه خبر اقتصادي جاري — المحرك متوقف';
      tx.appendChild(w);
    }
    if (sig && sig.frozen) {
      var f = el('em', 'gfroze', 'مجمد');
      f.title = 'المحرك اتجمّد حفاظًا على مصداقيته';
      tx.appendChild(f);
    }
    return tx;
  }

  /* الحقن في الكارت: بنلاقي عنصر XAU/USD جوّه كارت glbCard */
  function injectIntoCard(sig) {
    var card = document.getElementById('glbCard');
    if (!card) return false;
    var old = card.querySelector('.gsig');
    if (old) old.remove();
    var mini = null;
    var minis = card.querySelectorAll('.mini');
    for (var i = 0; i < minis.length; i++) {
      var n = minis[i].querySelector('.mini-n');
      if (n && /XAU/.test(n.textContent || '')) { mini = minis[i]; break; }
    }
    if (!mini) return false;
    mini.classList.add('gmini');
    var host = el('div', 'gsig');
    host.appendChild(buildBadge(sig));
    /* ⛌⛌ زرار «التفاصيل» اتشال بالاتفاق.
       مكانه: الكارت كله بقى قابل للدوس وبيفتح شاشة التحليل.
       ⛔ أول مرة بس نسمّع الدوسة — الحقن بيتعاد كل ٩٠ ثانية
       ولولا الحارس ده كان كل مرة بنلمّد监听 جديد فوق القديم. */
    mini.style.cursor = 'pointer';
    mini.title = 'دوس تفتح تحليل الذهب الكامل';
    if (mini.getAttribute('data-gold-tap') !== '1') {
      mini.setAttribute('data-gold-tap', '1');
      mini.addEventListener('click', function (e) {
        e.stopPropagation();
        openGold();
      });
    }
    mini.appendChild(host);
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════
     ②  جلب البيانات
     ══════════════════════════════════════════════════════════════════ */
  function getSignal() {
    return fetch(apiBase() + '/api/gold/signal', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.error) throw new Error(j.error);
        CACHE.sig = j; return j;
      });
  }
  function getDeep(force) {
    if (CACHE.deep && !force && (Date.now() - CACHE.deepAt) < 120000) {
      return Promise.resolve(CACHE.deep);
    }
    return fetch(apiBase() + '/api/gold/deep', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { CACHE.deep = j; CACHE.deepAt = Date.now(); return j; });
  }

  /* ══════════════════════════════════════════════════════════════════
     ③  الشرح العربي — مكتوب من الأرقام، مش من ذكاء اصطناعي
     ══════════════════════════════════════════════════════════════════ */
  function verdictText(d) {
    var h = d.head || {};
    var col = h.color || 'blue';
    var f = d.f || {}, det = d.detail || {};
    var out = [];
    if (h.news_blocked) {
      return 'فيه خبر اقتصادي شغل دلوقتي — المحرك متوقف — استنى الخبر يخلص. ' +
             'مش معناه إن المبرر فشلت، معناه إن الظروف مش مناسبة للحكم.';
    }
    if (col === 'blue') {
      var blockers = (h.gates || []).filter(function (g) { return !g.ok; })
        .map(function (g) { return (ar(AR_GATE, g.g, 'شرط')) + ': ' + g.why; });
      if (blockers.length) {
        return 'مفيش إشارة دلوقتي. ' + blockers.join(' · ') +
               '. الأزرق معناه «مفيش قياس كافي» — مش «السوق واقف». ' + NO_ADVICE;
      }
      if (Math.abs(h.score || 0) < (h.turn || 34)) {
        return 'الدرجة ' + (h.score || 0) + ' والعتبة ' + (h.turn || 34) +
               '. يعني الاتجاه ضعيف — السوق مش ماشي في اتجاه واحد. ' + NO_ADVICE;
      }
      return 'الشروط مش مكتملة — استنى. ' + NO_ADVICE;
    }
    var dir = (h.side === 'BUY') ? 'شراء' : 'بيع';
    out.push('الميل ' + dir + ' بقوة ' + Math.abs(h.score) + ' من 100.');
    if (det.shift && det.shift.length) {
      var last = det.shift[det.shift.length - 1];
      out.push('آخر حدث هيكلي: ' + ar(AR_EV, last.k) + ' ' +
               (last.dir === 'UP' ? 'للفوق' : 'للتحت') +
               ' عند ' + num(last.lvl) + '$.');
    }
    if (det.sweep && det.sweep.sweeps && det.sweep.sweeps.length) {
      var sw = det.sweep.sweeps[det.sweep.sweeps.length - 1];
      out.push('فيه مسح سيولة عند ' + num(sw.lvl) + '$ (' + ar(AR_SWEEP, sw.kind) + ').');
    }
    if (h.levels && h.levels.sl) {
      out.push('الهدف الأول ' + num(h.levels.tp1) + ' مقابل وقف ' + num(h.levels.sl) +
               ' — عائد 1:' + num(h.levels.rr) + '.');
    }
    out.push('⛔ الدرجة مقارنة بين ٨ عوامل — مش ثمن ولا موعد، ومفيش ضمان للربح.');
    return out.join(' ');
  }

  /* العامل + قيمته + جملته بالعربي — كل القوائم بتستخدم نفس القاموس
     عشان ما يحصلش تناقض بين positives و negatives و conflictNote. */
  var FACT_AR = {
    htf_bias:  { up: 'اتجاه الفريمات العالية صاعد',   dn: 'اتجاه الفريمات العالية هابط',
                 w: 'اتجاه الفريمات العالية' },
    mtf_align: { up: 'الساعة والربع ساعة متوافقين',     dn: 'الساعة والربع ساعة متخالفين',
                 w: 'توافق الفريمات' },
    sweep:     { up: 'مسح سيولة تحت القاع — ضغط شرائي', dn: 'مسح سيولة فوق القمة — ضغط بيعي',
                 w: 'مسح السيولة' },
    shift:     { up: 'كسر هيكلي صاعد مؤكد',            dn: 'كسر هيكلي هابط مؤكد',
                 w: 'كسر الهيكل' },
    retest:    { up: 'السعر رجع لخصم',                 dn: 'السعر في كبريوم',
                 w: 'منطقة الخصم أو الكبريوم' },
    session:   { up: 'سيولة الجلسة عالية',              dn: 'سيولة الجلسة ضعيفة',
                 w: 'سيولة الجلسة' },
    macro:     { up: 'الدولار ضعيف والعوائد نازلة — ده ضد الذهب عادةً',
                 dn: 'الدولار قوي والعوائد طالعة — ده مع الذهب عادةً',
                 w: 'الدولار والعوائد' },
    volregime: { up: 'التقلب نشط — مناسب',             dn: 'التذبذب مش في مستوى مناسب',
                 w: 'نظام التقلب' }
  };

  function positives(d) {
    var p = [], f = d.f || {}, det = d.detail || {}, s = det.session || {}, v = det.vol || {};
    if ((f.htf_bias || 0) > 0.2) p.push(FACT_AR.htf_bias.up);
    if ((f.mtf_align || 0) > 0.3) p.push(FACT_AR.mtf_align.up);
    if ((f.sweep || 0) > 0.2) p.push(FACT_AR.sweep.up);
    if ((f.shift || 0) > 0.2) p.push(FACT_AR.shift.up);
    if ((f.retest || 0) > 0.2) {
      p.push('السعر داخل ' + ar(AR_ZONE, (det.retest || {}).kind) + ' في الجزء الأسفل — منطقة خصم');
    }
    if ((f.macro || 0) > 0.2) p.push(FACT_AR.macro.up);
    if ((f.volregime || 0) > 0.2) p.push('التقلب: ' + (v.regime || 'نشط — مناسب'));
    if ((s.liquidity || 0) >= 0.7) p.push('سيولة ' + (s.phase || '') + ' عالية');
    return p;
  }

  function negatives(d) {
    var n = [], f = d.f || {}, det = d.detail || {}, s = det.session || {}, v = det.vol || {};
    if ((f.htf_bias || 0) < -0.2) n.push(FACT_AR.htf_bias.dn);
    if ((f.sweep || 0) < -0.2) n.push(FACT_AR.sweep.dn);
    if ((f.shift || 0) < -0.2) n.push(FACT_AR.shift.dn);
    if ((f.retest || 0) < -0.2) {
      n.push('السعر داخل ' + ar(AR_ZONE, (det.retest || {}).kind) + ' في الجزء الأعلى — منطقة كبريوم');
    }
    if ((f.macro || 0) < -0.2) n.push(FACT_AR.macro.dn);
    if ((f.volregime || 0) < -0.2) n.push('التقلب: ' + (v.regime || FACT_AR.volregime.dn));
    if (s.phase === 'مغلق') n.push('السوق مغلق — عطلة. مفيش سيولة، فالمحرك بيقفل');
    else if ((f.session || 0) < -0.2) n.push('سيولة ' + (s.phase || '') + ' ضعيفة');
    if (d.news && d.news.blocked) n.push('خبر جاري: ' + newsAr(d.news.blocked.title));
    if (d.learn && d.learn.frozen) n.push('المحرك متجمّد — دقته نزلت تحت الحد');
    return n;
  }

  /* ⛔ التعارض بين قوى متعاكسة — لازم يبان في سطر، مش يتدفن في المتوسط.
     لو عامل داعم وقوي وعامل معاكس، المستخدم لازم يشوف الاتنين مع بعض. */
  function conflictNote(d) {
    var f = d.f || {};
    var bull = [], bear = [];
    if ((f.htf_bias || 0) > 0.2) bull.push(FACT_AR.htf_bias.w);
    if ((f.mtf_align || 0) > 0.3) bull.push(FACT_AR.mtf_align.w);
    if ((f.shift || 0) > 0.2) bull.push(FACT_AR.shift.w);
    if ((f.sweep || 0) > 0.2) bull.push(FACT_AR.sweep.w);
    if ((f.retest || 0) > 0.2) bull.push(FACT_AR.retest.w);
    if ((f.htf_bias || 0) < -0.2) bear.push(FACT_AR.htf_bias.w);
    if ((f.mtf_align || 0) < -0.3) bear.push(FACT_AR.mtf_align.w);
    if ((f.shift || 0) < -0.2) bear.push(FACT_AR.shift.w);
    if ((f.sweep || 0) < -0.2) bear.push(FACT_AR.sweep.w);
    if ((f.retest || 0) < -0.2) bear.push(FACT_AR.retest.w);
    if (!bull.length || !bear.length) return '';
    return '⚡ تعارض في الصورة: ' + bull.join(' + ') + ' ⟷ ' + bear.join(' و ') +
           '. المحرك بيرجّح الأقوى وزناً — وده تقدير قابل للخطأ. ' + NO_ADVICE;
  }

  /* ══════════════════════════════════════════════════════════════════
     ④  بناء الشاشة — الشكل = صفوف (مافيش كارت جوه كارت)
     ══════════════════════════════════════════════════════════════════ */

  /* خلية في صف — نفس شكل صف الفلتر: اسم فوق + رقم + سطر تفسير */
  function cell(label, value, cls, note) {
    return '<div class="gcell' + (cls ? ' ' + cls : '') + '">' +
      '<span class="gcell-l">' + label + '</span>' +
      '<b class="gcell-v' + (note ? '' : '') + '">' + value + '</b>' +
      (note ? '<span class="gcell-s">' + note + '</span>' : '') +
      '</div>';
  }
  function strip(mod, cells) {
    return '<div class="gstrip ' + mod + '">' + cells.join('') + '</div>';
  }
  function sec(icon, title, count, body) {
    return '<div class="gsec"><div class="gsec-h"><span class="gsec-i">' + icon + '</span>' +
      title + (count ? '<span class="gsec-n">' + count + '</span>' : '') + '</div>' + body + '</div>';
  }

  function tfCard(k, tf) {
    if (!tf) return '';
    var e50 = tf.ema50, e200 = tf.ema200, C = tf.C;
    var st = tf.trend === 1 ? 'صاعد' : (tf.trend === -1 ? 'هابط' : 'عرضي');
    return '<div class="gcard">' +
      '<div class="gcard-h"><b>' + tfName(k) + '</b><span class="gtag gt-' +
        (tf.trend === 1 ? 'g' : (tf.trend === -1 ? 'r' : 'b')) + '">' + st + '</span></div>' +
      '<div class="grow"><span>الإغلاق</span><b>' + num(C) + '</b></div>' +
      '<div class="grow"><span>متوسط ٥٠</span><b>' + num(e50) + '</b></div>' +
      '<div class="grow"><span>متوسط ٢٠٠</span><b>' + num(e200) + '</b></div>' +
      '<div class="grow"><span>مدى الحركة</span><b>' + num(tf.atr14) + '</b></div>' +
      '<div class="grow"><span>القوة النسبية</span><b>' + num(tf.rsi, 1) + '</b></div>' +
      '<div class="grow"><span>المدى</span><b>' + num(tf.lo) + ' – ' + num(tf.hi) + '</b></div>' +
      (tf.basis_mad != null
        ? '<div class="gnote">أرقام الفريم ده محسوبة من عقد الآجل ومترجَمة للسبوت، ' +
          'بدقة ±' + num(tf.basis_mad) + '$.</div>' : '') +
      '<div class="gnote">⛔ القوة النسبية هنا للعرض فقط — مش من العوامل الثمانية ' +
      'اللي بتحسب الدرجة.</div>' +
      '</div>';
  }

  function levelsBlock(L, d) {
    if (!L || !L.sl) {
      /* ⛔ الكارت الخامل (أزرق) مينفعش يبقى فاضي — وإلا المستخدم
         يفتح الشاشة يلاقي فراغ. بنديله مستويات المراقبة. */
      var w = referenceLevels(d);
      if (!w) return '<div class="gempty">مفيش مستويات دلوقتي — البوابات مش مكتملة.</div>';
      return strip('glevels', w.map(function (r) {
        return cell(esc(r[0]), num(r[1]));
      })) +
      '<div class="gnote">دي مستويات مراقبة مش توصية — لو السعر كسر واحد منهم فعلاً، ' +
      'المحرك بيرجّع يحسب من جديد.</div>';
    }
    return strip('glevels', [
      cell('🎯 الدخول', num(L.entry)),
      cell('🛑 وقف الخسارة', num(L.sl), 'gdown'),
      cell('🔼 الهدف ١', num(L.tp1), 'gup'),
      cell('🔼 الهدف ٢', num(L.tp2), 'gup'),
      cell('💰 المخاطرة', num(L.risk_usd) + '$'),
      cell('📐 العائد', '1:' + num(L.rr), L.rr >= 1.5 ? 'gup' : (L.rr >= 1 ? '' : 'gdown'))
    ]) + levelsCaveat(d);
  }

  /* ⛔ سطر واحد جنب المستويات نفسها — لأنها المكان اللي المستخدم
     بياخد منه القرار فعلاً. التحذير الطويل في «مصادر البيانات»
     في آخر الشاشة، وأغلب الناس مش بيوصلوا لحد there. */
  function levelsCaveat(d) {
    var b = d && d.basis;
    if (b && typeof b === 'object' && b.value != null) {
      return '<div class="gnote">المستويات دي من عقد الآجل مترجَم للسبوت ' +
        '(فرق الترجمة ' + num(b.value) + '$ ±' + num(b.mad) + '$) — مش سبوت مباشر.</div>';
    }
    return '<div class="gnote">⚠️ المستويات دي محسوبة من عقد الآجل ' +
      'مش سبوت مباشر، ومفيش فرق ترجمة متاح — خدها كتقديرية.</div>';
  }

  function referenceLevels(d) {
    var tf = d.tf || {}, m15 = tf.M15 || {}, sess = (m15.sessions || {});
    var out = [], C = m15.C, a = m15.atr14;
    if (C == null) return out;
    var hi = [], lo = [];
    (m15.pivots || []).forEach(function (p) {
      if (p.k === 'H' && p.p > C) hi.push(p.p);
      if (p.k === 'L' && p.p < C) lo.push(p.p);
    });
    if (hi.length) out.push(['أول مقاومة فوق', Math.min.apply(null, hi)]);
    if (lo.length) out.push(['أول دعم تحت', Math.max.apply(null, lo)]);
    var pv = (sess.prev || [])[0];
    if (pv) { out.push(['قمة أمبارا', pv.h]); out.push(['قاع أمبارا', pv.l]); }
    if (a) out.push(['مدى الحركة المعتاد (ATR)', C + a]);
    return out.slice(0, 6);
  }

  function newsBlock(n) {
    if (!n) return '<div class="gempty">مفيش تقويم متاح دلوقتي.</div>';
    var h = '';
    if (n.blocked) {
      h += '<div class="gnews gnews--block"><b>ممنوع دلوقتي</b> ' +
           esc(newsAr(n.blocked.title)) + ' · ' + esc(n.blocked.t) + '</div>';
    }
    if (n.prev_high) {
      h += '<div class="gnews gnews--done"><b>اتأثر خلاص</b> ' +
           esc(newsAr(n.prev_high.title)) + ' · ' + esc(n.prev_high.t) +
           ' — راجع رد فعل الذهب في التحليل الفني لتحت</div>';
    }
    var up = (n.upcoming || []).slice(0, 5);
    if (up.length) {
      h += '<div class="gtable-wrap"><table class="gtable"><thead><tr><th>الموعد</th><th>الحدث</th>' +
           '<th>التأثير</th><th>المتوقع</th><th>السابق</th></tr></thead><tbody>';
      for (var i = 0; i < up.length; i++) {
        var e = up[i];
        var cls = e.imp === 'High' ? 'gimp-h' : (e.imp === 'Medium' ? 'gimp-m' : 'gimp-l');
        h += '<tr><td class="gnum">' + esc(e.t) + '</td><td>' + esc(newsAr(e.title)) +
             (e.in_min != null ? ' <small>(بعد ' + num(e.in_min, 0) + ' د)</small>' : '') +
             '</td><td><span class="gimp ' + cls + '">' + esc(ar(AR_IMP, e.imp)) + '</span></td>' +
             '<td class="gnum">' + esc(e.f || '—') + '</td>' +
             '<td class="gnum">' + esc(e.p || '—') + '</td></tr>';
      }
      h += '</tbody></table></div>';
      h += '<div class="gnote">«المتوقع» و«السابق» أرقام المحللين على نفس الحدث. ' +
           'المفاضلة بينهم هي اللي بتحدد «مفاجأة» أو «على التوقع» — وده أول حاجة تبصّ عليها.</div>';
    }
    if (!h) h = '<div class="gempty">مفيش أحداث قريبة.</div>';
    return h;
  }

  /* ══════════════════════════════════════════════════════════════════
     سيناريوهات الفيدرالي · ياسر — ١٦ أكتوبر ٢٠٢٦
     ──────────────────────────────────────────────────────────────────
     ⛔ «اللي بيتقاس» مش «الذهب هيحصل إيه». مفيش توقّع.
     🗓️ الوقائع اللي تحت — كل رقم فيها متأكد من مصدر:
        • أبريل ٢٠١٣: الذهب نزل قرابة ٢٠٠ دولار في يومين، نحو ١٢٪،
          بعد كلام عن تقليل مشتريات الفيدرالي.
        • مارس ٢٠٢٠: الفيدرالي خفّض الفائدة لحد الصفر تقريباً، والذهب
          نزل قرابة ١٢٪ برضه — السبب كان طلب سيولة مش الفائدة.
        • أغسطس ٢٠٢٠: الذهب وصل ٢٠٧٥ دولار لأول مرة في تاريخه.
     ══════════════════════════════════════════════════════════════════ */
  var FED_RX = /FOMC|Fed |Federal Reserve|Powell|Beige Book|dot plot/i;

  function fedBlock(n) {
    var ev = (n && n.upcoming || []).filter(function (e) { return FED_RX.test(e.title || ''); });
    var blocked = n && n.blocked && FED_RX.test(n.blocked.title || '') ? n.blocked : null;
    var titles = (blocked ? [blocked.title] : []).concat(ev.map(function (e) { return e.title; }));

    return '<div class="gfed">' +
      '<div class="gfed-h">🗳️ اجتماع الاحتياطي الفيدرالي — إيه اللي بيتقاس، وإيه اللي لأ</div>' +
      '<div class="gfed-why">الفيدرالي هو البنك المركزي الأمريكي، وهو اللي بيحدد سعر الفائدة ' +
      'اللي البنوك الأمريكية بتدفعه. من هنا بيوصل الأثر لكل سوق في العالم، ومن هنا بيأثر على ' +
      'الذهب — عن طريق الدولار والعوائد، مش بشكل مباشر.</div>' +

      '<div class="gfed-t">' + (titles.length
        ? '<b class="gup">موجود دلوقتي أو قريب: </b>' +
          titles.map(function (x) { return esc(newsAr(x)); }).join(' · ')
        : '<span class="gmute">مفيش اجتماع في التقويم دلوقتي — الشكل ده تعليمي عشان تعرف تقراه '
          + 'لما يجي، مش توقّع.</span>') + '</div>' +

      '<div class="gstrip gfed-grid">' +
      '<div class="gcell gfed-c gfed-c--b"><b>١ · الكلام متشدد</b>' +
      '<span>يعني: فائدة أعلى من المتوقع، أو جمل زي «مش مستعجلين».</span>' +
      '<span>العلاقة المعتادة: العوائد والدولار بيقفزوا ← ضغط على الذهب في أول رد فعل.</span>' +
      '<span>⛔ مش قاعدة ثابتة: لو السوق كله متوقع الكلام ده، ممكن يبقى رد الفعل معاكس.</span></div>' +

      '<div class="gcell gfed-c gfed-c--g"><b>٢ · الكلام متساهل</b>' +
      '<span>يعني: تخفيض أقرب، أو جمل زي «محتاجين تخفيض».</span>' +
      '<span>العلاقة المعتادة: العوائد بتنزل ← دعم للذهب. وممكن يكمّل لو التوقعات عدّت.</span>' +
      '<span>⛔ ومضمون؟ لأ. مارس ٢٠٢٠: خفّضوا الفائدة لحد الصفر تقريباً، والذهب نزل ١٢٪. ' +
      'السبب كان طلب سيولة، مش الفائدة.</span></div>' +

      '<div class="gcell gfed-c gfed-c--n"><b>٣ · على التوقع</b>' +
      '<span>الرقم جه زي ما اتوقع، والكلام مفيش فيه مفاجأة.</span>' +
      '<span>أغلب الحركة بتخلص من غير اتجاه واضح، والتذبذب بيقل.</span>' +
      '<span>القياس: لو المدى بعد الخبر أضيق من قبله، يبقى سوق هادي — والإشارة بتتجمّد.</span></div>' +

      '<div class="gcell gfed-c gfed-c--x"><b>٤ · في مفاجأة</b>' +
      '<span>الفرق بين الفعلي والمتوقع أكبر من المعتاد.</span>' +
      '<span>أول خمس شموع ١٥ دقيقة — يعني ساعة ونص تقريباً — فوضى، والحركات فيها مش اتجاه.</span>' +
      '<span>المحرك بيقفل البوابة ٣٠ دقيقة قبل الخبر و١٥ دقيقة بعده. ده شرط في الكود، مش رأي.</span></div>' +
      '</div>' +

      '<div class="gnote"><b>تقرأها إزاي:</b> مش تسأل «الذهب هيطلع؟». اسأل: التوقع كان إيه، ' +
      'والفعلي إيه، والفرق بينهم كبير ولا لأ. المحرك بياخد التوقع والفعلي من التقويم ' +
      'وبيقيس ردة الفعل — ما بيخمّنش الجاية.</div>' +

      '<div class="gfed-t"><b>المواعيد الثابتة (مفيش تخمين):</b><br>' +
      'اجتماعات الفيدرالي ٨ مرات في السنة، كل ٦ أسابيع تقريباً، على يومين متتاليين.<br>' +
      'البيان بيطلع الساعة ٢:٠٠ ظهراً بتوقيت واشنطن، والمؤتمر ٢:٣٠ بعده.<br>' +
      'في ٤ اجتماعات من الـ٨ (مارس · يونيو · سبتمبر · ديسمبر) بيطلع كمان رسم التوقعات، ' +
      'وده بيوضح كل عضو في الفيدرالي متوقع كام للفائدة.<br>' +
      'محضر الاجتماع بيتنشر بعد ٣ أسابيع — ودوقتها الكلام اتفهّم، والسعر عدّى. ' +
      '⛔ الفرق بين توقيت واشنطن وتوقيت مصر بيتغيّر مع التوقيت الصيفي، فخلي بالك من التقويم.</div>' +

      '<div class="gnote"><b>🇪🇬 ودي النقطة اللي بتهمّك في مصر:</b><br>' +
      'سعر الذهب عند المحل = سعر الذهب بالدولار × سعر الدولار بالجنيه.<br>' +
      'يعني لو الذهب بالدولار واقف والجنيه ضعيف، السعر عندك في مصر بيطلع من غير ما الذهب ' +
      'يتحرك. وفي العكس: الذهب ممكن يثبت بالدولار، والسعر المحلي يثبت أو ينزل.<br>' +
      '⚠️ شاشاتنا بتعرض السعر العالمي <b>بالدولار</b> بس. سعر الدولار بالجنيه ' +
      '<b>غير متاح في بياناتنا</b> — مش مخفي، مصدره مش متاح عندنا. ' +
      'فلما تقارن بالفرع، ضيف فرق السعر بنفسك.</div>' +

      '<div class="gdisc">' + NO_ADVICE +
      ' ردّ فعل الفيدرالي بيغيّر الاحتمالات، مش بيضمن النتيجة.</div>' +
      '</div>';
  }

  function learnBlock(L) {
    if (!L) return '';
    var perf = L.perf || {}, w = L.w || {}, base = L.base || {};
    var names = {
      htf_bias: 'اتجاه الفريمات العالية', mtf_align: 'توافق الساعة مع ربع ساعة',
      sweep: 'مسح السيولة', shift: 'كسر الهيكل', retest: 'الرجوع لمنطقة الخصم',
      session: 'سيولة الجلسة', macro: 'الدولار والعوائد', volregime: 'نظام التقلب'
    };
    var rows = '';
    Object.keys(names).forEach(function (f) {
      var p = perf[f] || {};
      var cur = w[f], b = base[f];
      var ratio = (b && cur && isFinite(Number(b)) && isFinite(Number(cur)))
        ? (Number(cur) / Number(b)) : 1;
      var pct = isFinite(ratio) ? Math.round((ratio - 1) * 100) : 0;
      var pcls = pct > 2 ? 'gup' : (pct < -2 ? 'gdown' : '');
      var hit = (p.hit != null && isFinite(Number(p.hit)))
        ? Math.round(Number(p.hit) * 100) + '%' : '—';
      rows += '<tr><td>' + names[f] + '</td>' +
        '<td class="gnum">' + num(cur, 3) + '</td>' +
        '<td class="' + pcls + '">' + (pct >= 0 ? '+' : '') + pct + '%</td>' +
        '<td class="gnum">' + hit + '</td>' +
        '<td class="gnum">' + num(p.n, 0) + '</td></tr>';
    });
    return strip('glearn-st', [
      cell('النسخة', esc(num(L.version, 0))),
      cell('إشارات متحلّة', esc(num(L.n, 0))),
      cell('الدقة (آخر ٣٠)', (L.acc != null && isFinite(Number(L.acc)))
        ? Math.round(Number(L.acc) * 100) + '%' : '—'),
      cell('الحالة', L.frozen ? 'مجمّد' : 'شغال', L.frozen ? 'gdown' : 'gup')
    ]) +
      '<div class="gtable-wrap" style="margin-top:10px"><table class="gtable"><thead><tr><th>العامل</th>' +
      '<th>الوزن</th><th>التغيّر</th><th>نسبة الإصابة</th><th>عدد</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>' +
      '<div class="gnote">التعديل محدود: ٥٪ كحد أقصى لكل وزن في الدورة، والسقف ١.٥× والأرضية ٠.٥× '
      + 'من الوزن الأول. ولو متوسط الدقة نزل تحت ٣٨٪، المحرك بيتجمّد ويطلع أزرق — '
      + 'وده موجود عشان محدش يفتكر إن المحرك بيعرف أكتر من فعله.</div>'
      + '<div class="gnote">⛔ «نسبة الإصابة» معناها: من الإشارات المغلقة، كام واحدة وصل الهدف '
      + 'قبل ما وقف الخسارة. الرقم ده <b>مش ربح</b> ومش وعد — حجم كل صفقة وكميتها بيلعبوا '
      + 'دور بعد كده، ومحركنا بيقيس الإصابة بس. فما تقراش الرقم ده كأنه نتيجة مالية.</div>';
  }

  /* ══ الصف الأول: الأصول ══
     الذهب في الأول (هو الأصل) والباقي اللي بيحركه. كل خلية رقم واحد
     + التغيّر + تأثيره على الذهب — مافيش كارت جوه كارت. */
  function assetRow(h, m, pr) {
    m = m || {};
    pr = pr || {};
    var out = [];
    var rng = '';
    if (pr.min != null && pr.max != null) {
      rng = 'نطاق اليوم ' + num(pr.min) + ' — ' + num(pr.max);
    } else {
      rng = 'الدرجة ' + (h.score || 0) + ' من 100 · العتبة ' + (h.turn || 34);
    }
    out.push(cell('🥇 الذهب', num(h.price) + ' <i class="gcell-c gflat">$</i>',
      'gcell--hl', rng));

    function macroCell(ico, name, d, inverted) {
      if (!d || d.px == null) {
        return cell(ico + ' ' + name, '—', '', 'البيانات مش متاحة دلوقتي');
      }
      var ch = Number(d.chg || 0);
      var effect = inverted ? -ch : ch;       /* الدولار والعوائد عكس الذهب */
      var dir = effect > 0 ? 'gup' : (effect < 0 ? 'gdown' : 'gflat');
      var txt = effect > 0 ? 'يدفع الذهب لفوق' : (effect < 0 ? 'يضغط على الذهب' : 'مش مؤثر');
      return cell(ico + ' ' + name,
        num(d.px) + ' <i class="gcell-c ' + dir + '">' + signed(ch) + '%</i>',
        '', '↔ الذهب ' + txt);
    }
    out.push(macroCell('🥈', 'الفضة', m.Silver, false));
    out.push(macroCell('💵', 'الدولار', m.DXY, true));
    out.push(macroCell('📈', 'عائد ١٠ سنين', m.US10Y, true));
    out.push(macroCell('📉', 'عائد سنتين', m.US02Y, true));
    if (m.Futures && m.Futures.px != null) {
      var fp = Number(m.Futures.px), pv = Number(m.Futures.prev || fp);
      var fpct = pv ? ((fp - pv) / pv) * 100 : 0;
      out.push(cell('📄 عقود الآجلة', num(fp) + ' <i class="gcell-c ' +
        (fpct > 0 ? 'gup' : (fpct < 0 ? 'gdown' : 'gflat')) + '">' + signed(fpct) + '%</i>',
        '', 'الهيكل محسوب منه ومترجَم للسبوت'));
    }
    return strip('gstrip--a', out);
  }

  /* ══ الصف الثاني: المؤشرات ══
     فريم ١٥ دقيقة — لأنه الفريم اللي بتتحسب منه الإشارة كلها. */
  function indicatorRow(d) {
    var tf = (d.tf || {}).M15 || {};
    var vol = (d.detail || {}).vol || {};
    var out = [];
    var tr = tf.trend === 1 ? 'صاعد' : (tf.trend === -1 ? 'هابط' : 'عرضي');
    var trc = tf.trend === 1 ? 'gup' : (tf.trend === -1 ? 'gdown' : 'gflat');
    out.push(cell('📌 الاتجاه', '<span class="' + trc + '">' + tr + '</span>',
      '', 'الفريم الأعلى بيخلي الاتجاه أهدأ'));
    out.push(cell('💰 الإغلاق', num(tf.C), '', 'سعر آخر شمعة قفلت'));
    /* ⛔ القوة النسبية بتتبعت للمحرّك بتتحسب، بس مش من الـ٨ عوامل.
       لازم نقول كده قدام المستخدم — تاني، أو المستخدم هيفتكر إنها بتأثر. */
    out.push(cell('📉 القوة النسبية', num(tf.rsi, 1), '',
      '⛔ بتعرض بس — مش بتأثر على القرار'));
    out.push(cell('🌊 التذبذب المعتاد', num(tf.atr14),
      '', (vol.regime ? esc(vol.regime) + ' — مدى الحركة المعتاد' : 'مدى الحركة المعتاد')));
    out.push(cell('🟡 المتوسط المتحرك ٥٠', num(tf.ema50),
      '', 'متوسط آخر ٥٠ شمعة — مش دعم ولا مقاومة'));
    out.push(cell('🔹 المتوسط المتحرك ٢٠٠', num(tf.ema200),
      '', 'متوسط آخر ٢٠٠ شمعة — خط طويل المدى'));
    if (tf.lo != null || tf.hi != null) {
      out.push(cell('↕️ أعلى وأدنى', '<span class="gcell-v sm">' + num(tf.hi) + ' · ' +
        num(tf.lo) + '</span>', '', 'مدى الشهر كله'));
    }
    var ses = (d.detail || {}).session || {};
    if (ses.phase) {
      out.push(cell('🕐 الجلسة', '<span class="gcell-v sm">' + esc(ses.phase) + '</span>',
        '', 'السيولة ' + (isFinite(Number(ses.liquidity)) ? Math.round(Number(ses.liquidity) * 100) : 0) + '٪ — كل ما زادت، زاد ثقة السعر'));
    }
    return strip('gstrip--i', out);
  }

  /* ⛔ السعر في الـAPI بييجي رقم واحد. لو تفصيل اتبعت (spot) بنعرضه،
     ولو لأ بنقول الرقم وخلاص — مافيش أصفار وشرطات بتوهم بمصادر. */
  function spotOf(d) {
    var s = d && d.spot;
    if (s && typeof s === 'object' && s.consensus != null) return s;
    if (d && d.price && typeof d.price === 'object' && d.price.consensus != null) return d.price;
    return null;
  }

  /* ══════════════════════════════════════════════════════════════════
     ⑥  تنبيه مصدر الأرقام (basis)
     ──────────────────────────────────────────────────────────────────
     ⛔ الباج كان هنا:  d.basis ? '<br>الهيكل محسوب من…' : ''
     والحاجز ده غلط. الـ API بيبعت مفتاح basis في كل رد —
     حتى لو الترجمة فشلت بيرجع كائن فاضي:
         {"value": null, "mad": null, "n": 0, "src": "GC=F → سبوت"}
     والكائن الفاضي ده truthy في الجافاسكربت، فالسطر كان بيتنفّذ
     دايماً ويطبع «بفارق —$ (دقة ±—$)» على الموقع الحقيقي.
     الحاجز الصح مقارنة القيمة نفسها مش الكائن —
     نفس القاعدة المستخدمة في tfCard فوق:  tf.basis_mad != null

     ⛔ وكمان: المصدر عقد الذهب الآجل (GC=F) مش سبوت مباشر.
     فالترجمة رقم تقديري. الكارت ده بيقولها دايماً —
     مش بس لما الرقم موجود — عشان ميفتكرش إن ده سبوت ١٠٠٪.
     ══════════════════════════════════════════════════════════════════ */
  function basisNote(d) {
    var b = d && d.basis;
    var out = '<div class="gnote">';
    if (b && typeof b === 'object' && b.value != null) {
      out += 'مصدر الأرقام هنا عقد الذهب الآجل، مترجَم لأسعار السبوت. ' +
        'فرق الترجمة ' + num(b.value) + '$ بدقة ±' + num(b.mad) + '$' +
        (Number(b.n) > 0 ? ' عبر ' + num(b.n, 0) + ' قراءة' : '') + '.' +
        (b.src ? ' (' + esc(b.src) + ')' : '');
    } else {
      out += 'مفيش فرق ترجمة متاح دلوقتي بين عقد الذهب الآجل والسبوت.';
    }
    out += '<br>⚠️ مستويات الدخول والوقف والأهداف محسوبة من عقد الآجل ' +
      'مش سبوت مباشر — فتقديرية، والفرق الحقيقي مع السوق ممكن ' +
      'يوصل لبضعة دولارات.</div>';
    return out;
  }

  function renderDeep(d) {
    if (!d || d.error) {
      return '<div class="gempty">التقرير مش متاح دلوقتي: ' + esc((d && d.error) || '') + '</div>';
    }
    var h = d.head || {}, col = h.color || 'blue', lab = LABEL[col] || LABEL.blue;
    var gcls = 'gh-' + col;
    var h2 = '';

    /* ── الحالة ── */
    h2 += '<div class="ghero ' + gcls + '">' +
      '<div class="ghero-l"><div class="gsign">' + lab.t + '</div>' +
      '<div class="gscore">الدرجة <b>' + (h.score || 0) + '</b> <small>العتبة ' + (h.turn || 34) + '</small></div></div>' +
      '<div class="ghero-r"><div class="gprice">' + num(h.price) + '</div>' +
      '<div class="gstamp">' + esc(h.cairo || '') + '</div></div></div>';

    h2 += '<div class="gverdict">' + esc(verdictText(d)) + '</div>';

    /* ── الصف الأول: الأصول ── */
    h2 += sec('🌐', 'الأصول', 'الذهب واللي بيحركه', assetRow(h, d.macro, spotOf(d)));

    /* ── الصف الثاني: المؤشرات ── */
    h2 += sec('📈', 'المؤشرات', 'من فريم ١٥ دقيقة', indicatorRow(d));

    /* ── الشروط السبعة ── */
    h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">🚦</span>' +
      'الشروط السبعة<span class="gsec-n">لازم كلها خضرا عشان الإشارة تطلع</span></div>' +
      '<div class="gstrip ggates">';
    (h.gates || []).forEach(function (g) {
      h2 += '<div class="gcell ggate ' + (g.ok ? 'ok' : 'no') + '">' +
        '<span class="gcell-l"><i>' + (g.ok ? '✓' : '✕') + '</i><b>' +
        esc(ar(AR_GATE, g.g, 'شرط')) + '</b></span>' +
        '<span class="gcell-s">' + esc(g.why) + '</span></div>';
    });
    h2 += '</div><div class="gnote">مشروط واحد مقفول = كارت أزرق. ' +
      'المحرك مش بيخفي الشرط ده عنك، وعشان كمان مش بيخفي إنه متوقف — ' +
      'بيقولك السبب في سطر واحد فوق.</div></div>';

    /* ── داعم وضدّ + التعارض ── */
    var pos = positives(d), neg = negatives(d), cfl = conflictNote(d);
    h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">⚖️</span>' +
      'إيه داعم للذهب؟ وإيه بيميل ضدّه؟</div>' +
      (cfl ? '<div class="gnews gnews--block" style="margin-bottom:10px">' + esc(cfl) + '</div>' : '') +
      '<div class="gpn"><div class="gpn-c gpn-g"><h4>✔ عوامل داعمة للذهب</h4>' +
      (pos.length ? '<ul>' + pos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
                   : '<p class="gmute">مفيش عامل إيجابي دلوقتي</p>') +
      '</div><div class="gpn-c gpn-r"><h4>✖ ضدّ الذهب</h4>' +
      (neg.length ? '<ul>' + neg.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
                   : '<p class="gmute">مفيش عامل سلبي دلوقتي</p>') +
      '</div></div>' +
      '<div class="gnote">⛔ كل عامل هنا قياس محسوب، مش رأي. ' +
      'وقاعدة ثابتة في المحرك: لو فيهم واحد بس خضرا والباقي حمرا، ' +
      'الكارت أزرق — مش ملوّنة.</div></div>';

    /* ── المستويات ── */
    h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">🎯</span>' +
      'المستويات' + (h.levels && h.levels.sl ? '' : '<span class="gsec-n">مراقبة — مفيش خطة دلوقتي</span>') +
      '</div>' + levelsBlock(h.levels, d) + '</div>';

    /* ── الشارت ── */
    h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">📊</span>الشارت</div>' +
      '<div class="gtabs">' +
      ['5', '15', '60', 'D'].map(function (i) {
        return '<button class="gtab' + (i === '15' ? ' on' : '') +
          '" data-int="' + i + '">' + ({ '5': '5د', '15': '15د', '60': 'ساعة', 'D': 'يوم' })[i] + '</button>';
      }).join('') + '</div>' +
      '<div id="gmv-chart" class="gchart"></div>' +
      '<div class="gnote">الشارت من TradingView — نفس مصدر بيانات الموقع.</div></div>';

    /* ── الفريمات ── */
    h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">🔬</span>' +
      'التحليل الفني متعدد الفريمات</div><div class="gtfcards">' +
      ['H4', 'H1', 'M15', 'M5'].map(function (k) { return tfCard(k, (d.tf || {})[k]); }).join('') +
      '</div></div>';

    /* ── الهيكل ── */
    var st = (d.detail || {}).shift || [];
    if (st.length) {
      h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">🧱</span>' +
        'أحداث الهيكل</div><div class="gevs">' +
        st.map(function (e) {
          return '<div class="gev ' + (e.dir === 'UP' ? 'gup' : 'gdown') + '">' +
            '<b>' + esc(ar(AR_EV, e.k)) + '</b> · ' + tfName(e.tf) + ' · ' +
            (e.dir === 'UP' ? 'كسر صاعد' : 'كسر هابط') +
            ' عند <b>' + num(e.lvl) + '</b> <small>' + esc(e.t) + '</small></div>';
        }).join('') + '</div>' +
        '<div class="gnote">«كسر القمة أو القاع» = السعر عدّى مستوى ثابت والمتابعة ليه. ' +
        '«تغيّر اتجاه الهيكل» = كسر عكسي، وده أهم من الكسر العادي.</div></div>';
    }

    /* ── السيولة ── */
    var sw = ((d.detail || {}).sweep || {}).sweeps || [];
    if (sw.length) {
      h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">💧</span>' +
        'مسح السيولة</div><div class="gevs">' +
        sw.map(function (s) {
          return '<div class="gev ' + (s.dir === 'bullish_sweep' ? 'gup' : 'gdown') + '">' +
            '<b>' + esc(ar(AR_SWEEP, s.kind)) + '</b> عند ' + num(s.lvl) + '$' +
            (Number(s.eq) > 1 ? ' · اتكرّرت ' + num(s.eq, 0) + ' مرات' : '') + ' <small>' + esc(s.t) + '</small></div>';
        }).join('') + '</div>' +
        '<div class="gnote">المسح معناه إن السعر لمس مستوى متساوي أو حدّ قدام، ورجع. ' +
        'المحرك بيقيسه لأنه بيقول حاجة عن قوة العرض والطلب — ' +
        'بس حتى هو مش دليل على حركة جاية.</div></div>';
    }

    /* ── الجلسات ── */
    var ses = ((d.tf || {}).M15 || {}).sessions;
    if (ses && ses.today) {
      h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">🕐</span>' +
        'جلسات اليوم</div><div class="gstrip gsess">' +
        Object.keys(ses.today).map(function (k) {
          var s = ses.today[k];
          return '<div class="gcell gsess-c"><b>' + ({
            asia: 'آسيا', london: 'لندن', ny: 'نيويورك', day: 'اليوم كله'
          }[k] || k) + '</b><span class="gcell-v sm">' + num(s.l) + ' — ' + num(s.h) + '</span></div>';
        }).join('') + '</div></div>';
    }

    /* ── الأخبار ── */
    h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">📰</span>' +
      'الأخبار الاقتصادية</div>' + newsBlock(d.news) + '</div>';

    /* ── الفيدرالي ── */
    h2 += fedBlock(d.news);

    /* ── التعلّم ── */
    if (d.learn) {
      h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">🧠</span>' +
        'التعلّم<span class="gsec-n">أرقام جوه حدود — مفيش إعادة كتابة للكود</span></div>' +
        learnBlock(d.learn) + '</div>';
    }

    /* ── المصادر ──
       ⛔ الـAPI بيبعت السعر رقم واحد من غير تفصيل. فلو في الحالة دي
       «من ٠ مصادر» تبقى كلام فاضي — بنقول اللي معانا بس وبس. */
    var sp = spotOf(d);
    h2 += '<div class="gsec"><div class="gsec-h"><span class="gsec-i">🔐</span>' +
      'مصادر البيانات</div>' +
      '<div class="gsrc">' + (sp
        ? 'السعر الحالي: <b>' + num(sp.consensus) + '$</b> من ' + num(sp.n, 0) +
          ' مصادر مستقلة، أقصى فرق بينهم <b>' + num(sp.spread) + '$</b>' +
          (sp.verified ? ' — متفق ✓' : ' — ⚠ مش متأكد')
        : 'السعر الحالي: <b>' + num(h.price) + '$</b> · آخر تحديث ' + esc(h.cairo || '')) +
      '</div>' + basisNote(d) + '</div>';

    h2 += '<div class="gdisc">⚠️ تحليل آلي — مش نصيحة استثمارية.<br>' +
      'الدرجة قواعد رياضية ثابتة، والقرار قرارك أنت. ' +
      'المحرك بيقيس السوق، مش بيحكم عليه، ومفيش رقم هنا ضمان للربح أو ضد الخسارة.</div>';

    return h2;
  }

  /* ══════════════════════════════════════════════════════════════════
     ⑤  المودال + الشارت
     ══════════════════════════════════════════════════════════════════ */
  function openGold() {
    if (OPEN) return;
    OPEN = true;
    var old = document.getElementById(ID);
    if (old) old.remove();
    var w = el('div', 'gmodal');
    w.id = ID;
    w.innerHTML =
      '<div class="gback" data-close></div>' +
      '<div class="gpanel" role="dialog" aria-modal="true" aria-label="تحليل الذهب">' +
      '<div class="ghead"><div class="ghead-t">🥇 الذهب العالمي XAU/USD</div>' +
      '<button class="gclose" data-close aria-label="اقفل">✕</button></div>' +
      '<div class="gbody"><div class="gload">🔄 بنجيب التحليل…</div></div>' +
      '</div>';
    document.body.appendChild(w);
    document.body.style.overflow = 'hidden';

    w.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) closeGold();
      var tb = e.target.closest && e.target.closest('.gtab');
      if (tb) {
        w.querySelectorAll('.gtab').forEach(function (x) { x.classList.remove('on'); });
        tb.classList.add('on');
        drawChart(tb.getAttribute('data-int'));
      }
    });
    document.addEventListener('keydown', escClose);

    getDeep(true).then(function (d) {
      var b = w.querySelector('.gbody');
      if (!b) return;
      b.innerHTML = renderDeep(d);
      drawChart('15');
    }).catch(function (err) {
      var b = w.querySelector('.gbody');
      if (b) b.innerHTML = '<div class="gempty">فشل تحميل التقرير: ' + esc(err.message || err) + '</div>';
    });
  }
  function escClose(e) { if (e.key === 'Escape') closeGold(); }
  function closeGold() {
    var w = document.getElementById(ID);
    if (w) w.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escClose);
    killChart();
    OPEN = false;
  }

  var TV_S = null;
  function drawChart(interval) {
    var host = document.getElementById('gmv-chart');
    if (!host) return;
    killChart();
    host.innerHTML = '';
    try {
      var mk = { '5': 'OANDA:XAUUSD', '15': 'OANDA:XAUUSD',
                 '60': 'OANDA:XAUUSD', 'D': 'OANDA:XAUUSD' }[interval] || 'OANDA:XAUUSD';
      var iv = { '5': '5', '15': '15', '60': '60', 'D': 'D' }[interval] || '15';
      var box = el('div');
      box.id = 'gmv-tv';
      box.className = 'tradingview-widget-container';
      host.appendChild(box);
      var inner = el('div');
      inner.id = 'gmv-tv-inner';
      inner.className = 'tradingview-widget-container__widget';
      box.appendChild(inner);
      var s = document.createElement('script');
      s.src = 'https://s3.tradingview.com/tv.js';
      s.async = true;
      inner.appendChild(s);
      s.onload = function () {
        if (!window.TradingView) return;
        TV_S = new window.TradingView.widget({
          container_id: 'gmv-tv-inner',
          symbol: mk,
          interval: iv,
          autosize: true,
          timezone: 'Africa/Cairo',
          theme: 'dark',
          style: '1',
          locale: 'ar',
          hide_side_toolbar: false,
          allow_symbol_change: false,
          withdateranges: true,
          details: false,
          studies: ['MASimple@tv-basicstudies', 'RSI@tv-basicstudies']
        });
      };
    } catch (e) {
      host.innerHTML = '<div class="gempty">الشارت مش متاح دلوقتي.</div>';
    }
  }
  function killChart() {
    try { if (TV_S && TV_S.remove) TV_S.remove(); } catch (e) { }
    TV_S = null;
  }

  /* ══════════════════════════════════════════════════════════════════
     ⑥  التشغيل
     ══════════════════════════════════════════════════════════════════ */
  function tick() {
    if (document.hidden) return;
    getSignal().then(function (s) { injectIntoCard(s); })
      .catch(function () { /* ما نكسرش الصفحة لو السيرفر واقع */ });
  }

  function boot() {
    tick();
    setInterval(tick, POLL);
    /* ⛌ كارت الأصول العالمية (glbCard) بيتبنى بعد ما البيانات توصل،
       والـtick الأول بيحصل قبل كده بيكمل فاضي وال injections bet go out.
       بنجرّب كل ثانيتين أول ٣٠ ثانية لحد ما الكارت يظهر فعلاً. */
    var tries = 0;
    var warm = setInterval(function () {
      if (++tries > 15) { clearInterval(warm); return; }
      tick();
    }, 2000);
    window.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    window.openGoldIntel = openGold;
  }

  /* ══════════════════════════════════════════════════════════════════
     ⑦  نصوص الشرح — التلاتة تبويبات
     ──────────────────────────────────────────────────────────────────
     📌 الشكل المتفق عليه: الجدول ← تحته شريط المعايير ← تحته زر (؟).
        كل نص ٣ أو ٤ أسطر. آخر سطر دايماً تحذير.
        ⛔ مفيش اسم أداة ذكاء اصطناعي — الظاهر «محرك OCTA».
     ══════════════════════════════════════════════════════════════════ */
  window.OCTAGOLDCOPY = {

    TABDECIDE: {
      strip: 'الدرجة · العتبة · الشروط السبعة',
      txt:
        '🟢 الكارت الأخضر معناه: الشروط السبعة كلها خضرا، والدرجة عدّت العتبة، ' +
        'والاتجاه متفق معاه. مش معناه «اشتري».\n' +
        '🔵 الكارت الأزرق مش ضعف — ده أمانة. معناه «مفيش قياس كافي دلوقتي»، ' +
        'والسبب مكتوب تحته في سطر واحد.\n' +
        '📏 الدرجة بتتقسم على ٨ عوامل، ولكل عامل وزنه. الوزن بيتعلّم من النتائج، ' +
        'بس جوه حدود ثابتة: أقصى زيادة ١.٥× وأقل نقص ٠.٥× من الوزن الأول، ' +
        'وأقصى خطوة ٥٪ في الدورة.\n' +
        '⛔ الدرجة مقارنة بين الأرقام — مش توصية، ومفيش رقم بيضمن ربح.'
    },

    TABFED: {
      strip: 'الدولار · عائد ١٠ سنين · عائد سنتين · الفضة',
      txt:
        '🗳️ الفيدرالي هو البنك المركزي الأمريكي، وبيحدد سعر الفائدة ٨ مرات في السنة. ' +
        'من هنا بيأثر على الذهب — عن طريق الدولار والعوائد، مش بشكل مباشر.\n' +
        '📌 اقرأ أي بيان كده: التوقع كان إيه · الفعلي إيه · الفرق كبير ولا لأ. ' +
        'السعر بيتحرك على الفرق ده، مش على الكلام لوحده.\n' +
        '🇪🇬 في مصر: سعر المحل = سعر الذهب بالدولار × سعر الدولار بالجنيه. ' +
        'يعني الذهب ممكن يثبت بالدولار والسعر عندك يتحرك، أو العكس. ' +
        'سعر الدولار بالجنيه غير متاح في بياناتنا — فاقارن بالفرع وضيف الفرق بنفسك.\n' +
        '⛔ مفيش توقّع في الصفحة دي. كل اللي فوق قياس، والفيدرالي بيغيّر ' +
        'الاحتمالات مش بيضمن النتيجة.'
    },

    TABTECH: {
      strip: 'الاتجاه · المتوسط ٥٠ · المتوسط ٢٠٠ · التذبذب',
      txt:
        '🔬 الفريم هو طول الشمعة: خمس دقايق · ربع ساعة · ساعة · يوم. ' +
        'كل واحد بيقول حاجة مختلفة، والمحرك بيجمعهم مع بعض.\n' +
        '🧱 أهم ما بيتقاس: كسر القمة أو القاع (السعر عدّى مستوى وكمّل) · ' +
        'تغيّر اتجاه الهيكل (كسر عكس الاتجاه، ودي الأهم) · ' +
        'مسح السيولة (السعر لمس حدّ متساوي ورجع).\n' +
        '📉 القوة النسبية: فوق ٧٠ معناها تشبّع، وتحت ٣٠ معناها إنها تعبانة. ' +
        'دي بتعرض على الشاشة للمعلومة، ومش داخلة في الدرجة — فلا تبني عليها قرارك.\n' +
        '⛔ كل مؤشر هنا بيصف اللي حصل، مش بيقول الجاية. وده سبب إن الكارت ' +
        'بيطلع أزرق بدل ما يخمّن.'
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
