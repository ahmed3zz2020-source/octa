/* ══════════════════════════════════════════════════════════════
   🎯 OCTA «التحديات» — تحدي اليوم + لوحة المتصدرين
   ──────────────────────────────────────────────────────────────
   📌 بتقرأ /api/challenges/today · /api/challenges/leaderboard
      وبتصوّت على /api/challenges/vote — كلها محمية (octaFetch).
   📌 challenge null أو status=no_challenge ⇒ رسالة واضحة
      (مش شاشة فاضية).
   📌 403 ⇒ شاشة «باقة مدفوعة» · 401 ⇒ «لازم تسجّل دخول».
   📌 leaderboard status=hidden ⇒ «هتفتح بعد ٣ مصوّتين».
   ⛔ مافيش معالجات جوّه الـHTML (سياسة الأمان) — كله addEventListener.
   ⛔ مافيش تخمين: كل رقم جاي من الـAPI كما هو.
   📌 تعليمي بحت — مش توصية شراء/بيع.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var S = {
    challenge: null,
    me: null,
    rows: [],
    lbStatus: 'ok',   /* ok | hidden | locked | auth | error */
    lbMe: null,
    loaded: false,
    locked: false,    /* 403 على تحدي اليوم */
    auth: false,      /* 401 */
    voting: false,
    chartCode: ''     /* آخر رمز اترسم شارت له (منع رسم مزدوج) */
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function num(v, d) {
    if (v == null || v === '' || !isFinite(v)) return (d == null ? '—' : d);
    return v;
  }
  /* 📌 الأسعار: ٣ خانات للسعر الصغيرة، ٢ للكبيرة (زي «نماذجي») */
  function fmtPrice(v) {
    if (v == null || v === '' || !isFinite(v)) return '—';
    var n = Math.abs(v) >= 100 ? 2 : (Math.abs(v) >= 1 ? 3 : 4);
    return Number(v).toFixed(n).replace(/\.?0+$/, '');
  }
  /* 📌 النسبة: الـAPI بيرجّعها كرقم بين ٠ و ١ (زي hit_rate) —
     ولو رجّعها كرقم ٠..١٠٠ بنستخدمها زي ما هي. */
  function fmtPct(v) {
    if (v == null || v === '' || !isFinite(v)) return '—';
    var x = Number(v);
    var p = (x > 0 && x <= 1) ? x * 100 : x;
    return (Math.round(p * 10) / 10) + '%';
  }
  function fmtDate(d) {
    if (!d) return '—';
    return String(d).slice(0, 10);
  }
  /* 📌 الأيام المتبقية على انتهاء التصويت */
  function daysLeft(expiresAt) {
    if (!expiresAt) return null;
    var raw = String(expiresAt);
    var iso = raw.slice(0, 10);
    var t = Date.parse(iso + 'T00:00:00Z');
    if (!isFinite(t)) return null;
    var d = Math.ceil((t - Date.now()) / 86400000);
    return d > 0 ? d : 0;
  }

  function apiUrl(p) {
    var base = (typeof OCTA_API !== 'undefined' && OCTA_API) ? OCTA_API : '';
    return base + p;
  }
  /* ⛔ كل طلبات الـAPI بتعدّي على octaFetch (Bearer + credentials) */
  function apiGet(path) {
    var call = (typeof octaFetch === 'function')
      ? octaFetch(apiUrl(path))
      : fetch(apiUrl(path));
    return call.then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }
  function apiPost(path, body) {
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    };
    var call = (typeof octaFetch === 'function')
      ? octaFetch(apiUrl(path), opts)
      : fetch(apiUrl(path), opts);
    return call.then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }

  function setStatus(text, kind) {
    var el = $('chStatus');
    if (!el) return;
    el.innerHTML = '<span class="ch-dot ' + (kind || '') + '"></span> ' + esc(text);
  }

  /* ══════════ التحميل ══════════ */
  function load() {
    setStatus('بنجيب تحدي اليوم…', 'busy');
    apiGet('/api/challenges/today').then(function (j) {
      S.challenge = (j && j.challenge) ? j.challenge : null;
      S.me = (j && j.me) ? j.me : null;
      S.loaded = true;
      S.locked = false;
      S.auth = false;
      S.chartCode = '';
      render();
      loadLeaderboard();
      if (!S.challenge || S.challenge.status === 'no_challenge') {
        setStatus('مفيش تحدي دلوقتي — جرّب بعد قفل السوق', 'err');
      } else {
        setStatus('تحدي ' + fmtDate(S.challenge.date) + ' · جاهز للتصويت', 'live');
      }
    }).catch(function (err) {
      var st = err && err.status;
      if (st === 403) {
        S.locked = true; S.loaded = true; S.chartCode = '';
        render();
        setStatus('الباقة مقفولة', 'err');
        return;
      }
      if (st === 401) {
        S.auth = true; S.loaded = true; S.chartCode = '';
        render();
        setStatus('لازم تسجّل دخول', 'err');
        return;
      }
      setStatus('تعذّر تحميل التحدي — جرّب تاني', 'err');
    });
  }

  /* ══════════ لوحة المتصدرين ══════════ */
  function loadLeaderboard() {
    apiGet('/api/challenges/leaderboard').then(function (j) {
      S.rows = (j && j.rows) ? j.rows : [];
      S.lbStatus = (j && j.status) ? j.status : 'ok';
      S.lbMe = (j && j.me) ? j.me : null;
      renderLeaderboard();
    }).catch(function (err) {
      var st = err && err.status;
      if (st === 403) { S.lbStatus = 'locked'; }
      else if (st === 401) { S.lbStatus = 'auth'; }
      else { S.lbStatus = 'error'; }
      renderLeaderboard();
    });
  }

  /* ══════════ الرسم العام ══════════ */
  function render() {
    renderStats();
    var body = $('chBody');
    var lockBox = $('chLockBox');
    if (!body) return;
    /* ⛔ شاشة الباقة/الدخول بتطلع في صندوق لوحدها — عشان الكارت
       ما يتكسرش لما يرجع الباقة تتفعّل (مش بنمسح الـDOM). */
    if (S.locked) {
      if (lockBox) lockBox.innerHTML = lockHTML();
      body.style.display = 'none';
      lockVote();
      return;
    }
    if (S.auth) {
      if (lockBox) lockBox.innerHTML = authHTML();
      body.style.display = 'none';
      lockVote();
      return;
    }
    if (lockBox) lockBox.innerHTML = '';
    body.style.display = '';
    if (!S.loaded) {
      var loading = $('chNoMsg');
      if (loading) {
        loading.style.display = '';
        loading.innerHTML = '<div class="ch-empty">بنحمّل…</div>';
      }
      return;
    }
    renderChallenge();
    renderResult();
  }
  /* 📊 سجلّك — نقاط · صح · غلط · دقة · سلسلة · رتبة
     📌 مافيش أصفار مضللة: قبل أول تصويت بنعرض دعوة، مش ٦ أصفار. */
  function renderStats() {
    var box = $('chStats');
    var me = S.me || {};
    var votes = me.votes || 0;
    if (!box) return;
    if (!votes) {
      box.className = 'ch-stats empty';
      box.innerHTML = '<div class="ch-statinvite">🗓️ <b>سجلّك لسه فاضي</b><br>' +
        'صوّت على تحدي النهاردة، وكل تحدي بيتحل بعد ١٠ جلسات — فتشوف إنت ماشي صح ولا غلط، ' +
        'وتتبني نقاطك يوم بيوم.</div>';
      return;
    }
    box.className = 'ch-stats';
    box.innerHTML =
      '<div class="ch-stat a"><span>نقاط</span><b dir="ltr">' + num(me.points, '—') + '</b></div>' +
      '<div class="ch-stat"><span>صح</span><b dir="ltr">' + num(me.correct, '—') + '</b></div>' +
      '<div class="ch-stat c"><span>غلط</span><b dir="ltr">' + num(me.wrong, '—') + '</b></div>' +
      '<div class="ch-stat b"><span>الدقة</span><b dir="ltr">' + fmtPct(me.accuracy) + '</b></div>' +
      '<div class="ch-stat"><span>سلسلة</span><b dir="ltr">' + num(me.streak, '—') + '</b></div>' +
      '<div class="ch-stat"><span>ترتيبك</span><b dir="ltr">' + (me.rank != null ? ('#' + num(me.rank, '—')) : '—') + '</b></div>';
  }

  /* ══════════ كارت التحدي ══════════ */
  function renderChallenge() {
    var ch = S.challenge;
    var head = $('chCardHead');
    var levels = $('chCardLevels');
    var q = $('chQuestion');
    var chartBox = $('chChart');

    if (!ch || ch.status === 'no_challenge') {
      if (head) head.innerHTML = '';
      if (levels) levels.innerHTML = '';
      if (q) q.innerHTML = '';
      hideVote();
      if (chartBox) chartBox.innerHTML = '';
      var card = $('chCard');
      if (card) {
        card.classList.add('ch-card-empty');
        var msg = $('chNoMsg');
        if (msg) {
          msg.style.display = '';
          msg.innerHTML = '<div class="ch-empty">⛔ مفيش تحدي دلوقتي — جرّب بعد قفل السوق</div>';
        }
      }
      return;
    }

    var card = $('chCard');
    if (card) card.classList.remove('ch-card-empty');
    var msg = $('chNoMsg');
    if (msg) { msg.style.display = 'none'; msg.innerHTML = ''; }

    if (head) head.innerHTML = cardHeadHTML(ch);
    if (levels) levels.innerHTML = levelsHTML(ch);
    if (q) q.innerHTML = '<span class="ch-qlabel">سؤال اليوم</span>' +
      '<p class="ch-qtext">' + esc(ch.question_ar || 'صوّت: هل السهم هيعمل كسر صعودي ولا هيكسر للدولار؟') + '</p>';

    renderVoteState();
    drawChart(ch);
  }

  /* 🧠 رأس الكارت: الرمز + الاسم + القطاع + الاتجاه */
  function cardHeadHTML(ch) {
    var dir = ch.direction === 'down' ? 'down' : 'up';
    var dirTxt = dir === 'up' ? '▲ صعود' : '▼ هبوط';
    return '<div class="ch-id">' +
        '<b>' + esc(ch.code || '') + '</b>' +
        '<span class="ch-name">' + esc(ch.name || '') + '</span>' +
        (ch.sector ? '<span class="ch-sector">' + esc(ch.sector) + '</span>' : '') +
      '</div>' +
      '<span class="ch-dir ' + dir + '">' + dirTxt + '</span>';
  }

  /* 📐 شبكة المستويات: دخول · وقف · هدف */
  function levelsHTML(ch) {
    /* 📌 «الهدف = دعم» و«الوقف = مقاومة» ⇒ السؤال يبقى واضح من أول نظرة */
    var tKind = (ch.zone_kind === 'support') ? 'دعم' : (ch.zone_kind === 'resistance' ? 'مقاومة' : '');
    var sKind = (ch.other_kind === 'resistance') ? 'مقاومة' : (ch.other_kind === 'support' ? 'دعم' : '');
    var tSub = tKind ? ('<i>' + tKind + '</i>') : '';
    var sSub = sKind ? ('<i>' + sKind + '</i>') : '';
    return '<div class="ch-levels">' +
      '<div><span>السعر دلوقتي</span><b class="e" dir="ltr">' + fmtPrice(ch.entry) + '</b></div>' +
      '<div><span>الهدف ' + tSub + '</span><b class="u" dir="ltr">' + fmtPrice(ch.target) + '</b></div>' +
      '<div><span>الوقف ' + sSub + '</span><b class="d" dir="ltr">' + fmtPrice(ch.stop) + '</b></div>' +
    '</div>' +
    '<div class="ch-meta">' +
      '<span>ع/م <b dir="ltr">' + num(ch.rr, '—') + '</b></span>' +
      '<span>تاريخ التحدي <b dir="ltr">' + fmtDate(ch.date) + '</b></span>' +
      '<span>الأفق <b dir="ltr">١٠ جلسات</b></span>' +
    '</div>';
  }

  /* ══════════ التصويت ══════════ */
  function renderVoteState() {
    var ch = S.challenge;
    var up = $('chVoteUp'), down = $('chVoteDown');
    var state = $('chVoteState');
    var days = $('chDaysLeft');
    var voteBox = $('chVoteBox');
    if (!ch) { hideVote(); return; }

    var resolved = !!ch.resolved;
    var voted = !!ch.my_vote;
    var locked = voted || resolved || S.voting;

    if (voteBox) voteBox.style.display = '';
    if (up) {
      up.disabled = locked;
      up.classList.toggle('picked', ch.my_vote === 'up');
    }
    if (down) {
      down.disabled = locked;
      down.classList.toggle('picked', ch.my_vote === 'down');
    }

    if (state) {
      if (resolved) {
        state.className = 'ch-votestate done';
        state.innerHTML = '🔒 التحدي اتحل — التصحيح تحت.';
      } else if (voted) {
        state.className = 'ch-votestate ok';
        state.innerHTML = '✅ صوتك: <b>' + (ch.my_vote === 'up' ? 'صعود' : 'هبوط') + '</b> — مستني النتيجة.';
      } else if (S.voting) {
        state.className = 'ch-votestate';
        state.innerHTML = '⏳ بنسجّل صوتك…';
      } else {
        state.className = 'ch-votestate';
        state.innerHTML = '👇 صوّت دلوقتي — صوت واحد بس لكل تحدي.';
      }
    }

    if (days) {
      var d = daysLeft(ch.expires_at);
      if (d == null) {
        days.innerHTML = '';
      } else if (d === 0) {
        days.innerHTML = '⏰ وقت التصويت خلص.';
      } else {
        days.innerHTML = '⏳ متبقي <b dir="ltr">' + d + '</b> ' + daysWord(d) + ' على انتهاء التصويت.';
      }
    }
  }

  /* 📌 صيغة الأيام بالعربي (يوم · يومين · ٥ أيام · ١٥ يوم) */
  function daysWord(d) {
    if (d === 1) return 'يوم';
    if (d === 2) return 'يومين';
    if (d >= 3 && d <= 10) return 'أيام';
    return 'يوم';
  }

  function hideVote() {
    var voteBox = $('chVoteBox');
    if (voteBox) voteBox.style.display = 'none';
    var state = $('chVoteState');
    if (state) state.innerHTML = '';
    var days = $('chDaysLeft');
    if (days) days.innerHTML = '';
  }

  /* ⛔ الباقة مقفولة أو مش مسجّل ⇒ الزرارين مقفولين */
  function lockVote() {
    var up = $('chVoteUp'), down = $('chVoteDown');
    if (up) up.disabled = true;
    if (down) down.disabled = true;
  }

  function vote(dir) {
    var ch = S.challenge;
    if (!ch || S.voting) return;
    if (ch.my_vote) return;   /* صوت واحد بس */
    if (ch.resolved) return;  /* اتحل — voting مقفول */
    if (dir !== 'up' && dir !== 'down') return;
    S.voting = true;
    renderVoteState();
    apiPost('/api/challenges/vote', { code: ch.code, vote: dir }).then(function (j) {
      S.voting = false;
      ch.my_vote = (j && j.my_vote) ? j.my_vote : dir;
      renderVoteState();
      setStatus('تم تسجيل صوتك ✅', 'live');
    }).catch(function (err) {
      S.voting = false;
      var st = err && err.status;
      if (st === 401) setStatus('لازم تسجّل دخول', 'err');
      else if (st === 403) setStatus('الباقة مقفولة', 'err');
      else setStatus('تعذّر تسجيل الصوت — جرّب تاني', 'err');
      renderVoteState();
    });
  }

  /* ══════════ النتيجة (بعد الحل) ══════════ */
  function renderResult() {
    var box = $('chResult');
    if (!box) return;
    var ch = S.challenge;
    if (!ch || !ch.resolved) { box.innerHTML = ''; return; }
    var r = ch.resolved || {};
    var outcome = (r.outcome === 'up' || r.outcome === 'down') ? r.outcome : 'neutral';
    var outTxt = outcome === 'up' ? 'صعود' : (outcome === 'down' ? 'هبوط' : 'متعادل');
    var outCls = outcome === 'up' ? 'up' : (outcome === 'down' ? 'down' : 'flat');
    /* 📌 تاريخ الهدف/الوقف — لو الـAPI بعتهم بنعرضهم، وإلا بنستنتجهم
       من تاريخ الحل (الهدف لو صعود · الوقف لو هبوط). */
    var tgtAt = r.target_at || (outcome === 'up' ? r.resolved_at : null);
    var stpAt = r.stop_at || (outcome === 'down' ? r.resolved_at : null);
    var mine = ch.my_vote;
    var verdict = '';
    if (mine) {
      if (outcome === 'neutral') {
        verdict = '🟡 مفيش تصحيح — صوتك محسوب متعادل.';
      } else if (mine === outcome) {
        verdict = '✅ صوتك صح.';
      } else {
        verdict = '❌ صوتك غلط.';
      }
    }
    box.innerHTML = '<div class="ch-result">' +
      '<div class="ch-reshead">' +
        '<span class="ch-resbadge ' + outCls + '">النتيجة: ' + outTxt + '</span>' +
        '<span class="ch-reswhen" dir="ltr">' + fmtDate(r.resolved_at) + '</span>' +
      '</div>' +
      (r.reason ? '<p class="ch-reason">' + esc(r.reason) + '</p>' : '') +
      '<div class="ch-resgrid">' +
        '<div><span>التصحيح</span><b>' + outTxt + '</b></div>' +
        '<div><span>صوتك</span><b>' + (mine ? (mine === 'up' ? 'صعود' : 'هبوط') : 'ما صوتتش') + '</b></div>' +
        '<div><span>تاريخ الهدف</span><b dir="ltr">' + fmtDate(tgtAt) + '</b></div>' +
        '<div><span>تاريخ الوقف</span><b dir="ltr">' + fmtDate(stpAt) + '</b></div>' +
      '</div>' +
      (verdict ? '<p class="ch-verdict">' + verdict + '</p>' : '') +
      '<p class="ch-resnote">⛔ التصحيح بيتحسب من محرك OCTA على شموع يومية حقيقية — مش توصية شراء أو بيع.</p>' +
    '</div>';
  }

  /* ══════════ لوحة المتصدرين ══════════ */
  function renderLeaderboard() {
    var box = $('chLeaderboard');
    if (!box) return;
    if (S.lbStatus === 'hidden') {
      box.innerHTML = '<div class="ch-empty invite">🏆 <b>المتصدرون لسه مافتحوش</b><br>' +
        'لوحة المتصدرين هتفتح بعد ٣ مصوّتين — كن التالت وابدأ السباق.<br>' +
        '<span class="su-mini">وكل ما ال��لوحة تفتح، هتشوف رتبتك فيها.</span></div>';
      return;
    }
    if (S.lbStatus === 'locked') {
      box.innerHTML = '<div class="ch-lock"><h3>🏆 لوحة المتصدرين — جزء من الباقة المدفوعة</h3>' +
        '<p>الباقة غير مفعّلة على حسابك — كلّم الدعم وتفعّل في ثواني.</p></div>';
      return;
    }
    if (S.lbStatus === 'auth') {
      box.innerHTML = '<div class="ch-empty">🔑 لازم تسجّل دخول عشان تشوف لوحة المتصدرين</div>';
      return;
    }
    if (S.lbStatus === 'error') {
      box.innerHTML = '<div class="ch-empty">تعذّر تحميل لوحة المتصدرين — جرّب تحديث الصفحة.</div>';
      return;
    }
    if (!S.rows.length) {
      box.innerHTML = '<div class="ch-empty">مفيش نقاط متسجّلة لحد دلوقتي — صوّت وكن أول المتصدرين.</div>';
      return;
    }

    var me = S.lbMe || {};
    var meRow = '<div class="ch-me">' +
      '<span class="ch-melabel">ترتيبك</span>' +
      '<span>الرتبة <b dir="ltr">' + (me.rank != null ? ('#' + num(me.rank, '—')) : '—') + '</b></span>' +
      '<span>النقاط <b dir="ltr">' + num(me.points, '—') + '</b></span>' +
      '<span>الدقة <b dir="ltr">' + fmtPct(me.accuracy) + '</b></span>' +
    '</div>';

    var rows = S.rows.map(function (r) {
      return '<tr>' +
        '<td class="rank" dir="ltr">' + num(r.rank, '—') + '</td>' +
        '<td class="alias">' + esc(r.alias || '—') + '</td>' +
        '<td class="num" dir="ltr">' + num(r.points, '—') + '</td>' +
        '<td class="num" dir="ltr">' + fmtPct(r.accuracy) + '</td>' +
      '</tr>';
    }).join('');

    box.innerHTML = meRow +
      '<table class="ch-table"><thead><tr>' +
        '<th class="rank">الرتبة</th><th>الاسم</th><th>النقاط</th><th>الدقة</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="ch-note">⛔ الأسماء المستعارة — من غير بياناتك الكاملة. ' +
      'والمحرك بيحسب النقاط من نتائج صوتك على تحديات محرك OCTA.</div>';
  }

  /* ══════════ شاشة الباقة (403) ══════════ */
  function lockHTML() {
    return '<div class="su-lock ch-lock">' +
      '<h3>🎯 التحديات — جزء من الباقة المدفوعة</h3>' +
      '<p>صفحة <b>التحديات</b> بتديك تحدي واحد كل يوم من محرك OCTA: سهم من البورصة المصرية ' +
      'بمستويات دخول ووقف وهدف، بتصوّت صعود ولا هبوط، وبتتعلم من النتيجة.</p>' +
      '<div class="ch-locklist">' +
      '• <b>تحدي يومي</b> — تصويت واحد كل يوم + تصحيح بعد الحل<br>' +
      '• <b>لوحة المتصدرين</b> — رتبتك ونقاطك قدام الباقي<br>' +
      '• <b>إحصاءاتك</b> — نقاط ودقة وسلسلة إجابات<br>' +
      '• <b>مش توصية</b> — المعلومة أداة، والقرار قرارك' +
      '</div>' +
      '<p style="margin-top:10px">الباقة غير مفعّلة على حسابك دلوقتي — كلّم الدعم وهي تتفعّل في ثواني.</p>' +
    '</div>';
  }

  /* ══════════ شاشة لازم تسجيل الدخول (401) ══════════ */
  function authHTML() {
    return '<div class="su-lock ch-lock">' +
      '<h3>🔑 لازم تسجّل دخول</h3>' +
      '<p>صفحة <b>التحديات</b> محتاجة حساب — عشان نحفظ صوتك ونحسب نقاطك وترتيبك ' +
      'قدام باقي المستخدمين.</p>' +
      '<p style="margin-top:10px">سجّل دخول من زرار الدخول فوق، وارجع للصفحة.</p>' +
    '</div>';
  }

  /* ══════════ الشارت ══════════ */
  /* 📌 خطوط السعر: الدخول والوقف والهدف (نفس أسلوب «نماذجي») */
  function priceLines(ch) {
    var lines = [];
    if (!ch) return lines;
    if (ch.entry != null) lines.push({ price: ch.entry, color: '#d4af37', style: 2, width: 2, title: 'الدخول' });
    if (ch.stop != null) lines.push({ price: ch.stop, color: '#ef4444', style: 0, width: 2, title: 'الوقف' });
    if (ch.target != null) lines.push({ price: ch.target, color: '#22c55e', style: 0, width: 2, title: 'الهدف' });
    return lines;
  }
  /* 📌 معطيات الرسم الاحترافي — النمط = مستويات التحدي */
  function patternOf(ch) {
    if (!ch) return { zone_low: null, zone_high: null, detect_at: null, age_days: 0, entry: null, stop: null, target: null };
    return {
      zone_low: null,
      zone_high: null,
      detect_at: ch.date || null,
      age_days: 0,
      entry: (ch.entry != null) ? ch.entry : null,
      stop: (ch.stop != null) ? ch.stop : null,
      target: (ch.target != null) ? ch.target : null
    };
  }
  function drawChart(ch) {
    var box = $('chChart');
    if (!box || !ch || !ch.code) return;
    if (S.chartCode === ch.code) return;   /* مرسوم — ما نرسمش تاني */
    S.chartCode = ch.code;
    var kit = window.OCTAChartKit;
    if (!kit) { box.innerHTML = '<div class="ch-empty">مكتبة الرسم مش متاحة</div>'; return; }
    box.innerHTML = '<div class="ch-empty">بنجيب الشموع…</div>';
    apiGet('/api/radar/history?list=' + encodeURIComponent(ch.code) + '&n=320').then(function (j) {
      var rows = kit.rowsFromHistory(j, ch.code);
      if (!rows.length) {
        box.innerHTML = '<div class="ch-empty">مفيش شموع للعرض — الأرقام تحت كاملة</div>';
        return;
      }
      return kit.mountPattern(box, rows, {
        lines: priceLines(ch),
        volume: true,
        height: 300,
        focusBars: 60,
        pattern: patternOf(ch)
      });
    }).catch(function () {
      box.innerHTML = '<div class="ch-empty">تعذّر جلب الشموع — الأرقام تحت كاملة</div>';
    });
  }

  /* ══════════ الربط ══════════ */
  function bind() {
    var up = $('chVoteUp');
    if (up) up.addEventListener('click', function () { vote('up'); });
    var down = $('chVoteDown');
    if (down) down.addEventListener('click', function () { vote('down'); });
    var refresh = $('chRefresh');
    if (refresh) refresh.addEventListener('click', function () { load(); });
  }

  function init() {
    if (!$('chBody')) return;
    bind();
    if (!S.loaded) load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.OCTAChallenges = {
    load: load,
    state: S,
    /* 🧪 خطّافات للاختبار (assets/tests/challenges-ui.test.js) */
    _test: {
      render: render,
      renderChallenge: renderChallenge,
      renderResult: renderResult,
      renderLeaderboard: renderLeaderboard,
      renderStats: renderStats,
      renderVoteState: renderVoteState,
      vote: vote,
      lockHTML: lockHTML,
      authHTML: authHTML,
      cardHeadHTML: cardHeadHTML,
      levelsHTML: levelsHTML,
      priceLines: priceLines,
      patternOf: patternOf,
      fmtPrice: fmtPrice,
      fmtPct: fmtPct,
      fmtDate: fmtDate,
      num: num,
      daysLeft: daysLeft
    }
  };
})();
