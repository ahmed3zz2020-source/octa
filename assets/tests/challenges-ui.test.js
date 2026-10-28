/* ══════════════════════════════════════════════════════════════
   🧪 اختبار واجهة «التحديات» — assets/tests/challenges-ui.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/repos/octa && node --test assets/tests/challenges-ui.test.js
   📌 مافيش متصفح ⇒ DOM مصغّر + تحميل الملف في بيئة معزولة (vm).
   ⛔ مافيش شبكة — كل الأرقام من mock مبني على شكل الـAPI الحقيقي:
        GET  /api/challenges/today
        POST /api/challenges/vote
        GET  /api/challenges/leaderboard
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

/* ═══════════ DOM مصغّر ═══════════ */
function makeEl(id) {
  const el = {
    id: id, innerHTML: '', textContent: '', value: '', checked: false,
    disabled: false, style: { display: '' }, _l: {}, children: [],
    classList: {
      _s: new Set(),
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) { this._s.add(c); } else { this._s.delete(c); } },
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, fn) { (el._l[t] = el._l[t] || []).push(fn); },
    removeEventListener() { }, remove() { },
    appendChild(c) { el.children.push(c); return c; },
    setAttribute() { }, getAttribute() { return null; }, focus() { },
    querySelector() { return makeEl('q'); }, querySelectorAll() { return []; },
    scrollIntoView() { }
  };
  return el;
}

function mkSandbox(fetchImpl) {
  const els = {};
  const doc = {
    createElement: (t) => makeEl('new-' + t),
    getElementById: (id) => (els[id] = els[id] || makeEl(id)),
    querySelectorAll: () => [],
    body: makeEl('body'),
    head: makeEl('head')
  };
  const win = {
    document: doc,
    OCTA_API: '',
    location: { protocol: 'https:', host: 'octashares.com', href: 'https://octashares.com/#challenges', hash: '#challenges' },
    addEventListener() { },
    setTimeout: (f) => { try { f(); } catch (e) { } },
    clearTimeout() { },
    fetch: fetchImpl || (() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })),
    /* octaFetch من octa-api.js — في الاختبار بيبعت على fetch مباشرة */
    octaFetch: function (u, o) { return win.fetch(u, o); },
    AbortController: function () { this.abort = () => { }; },
    localStorage: (function () {
      const st = {};
      return {
        getItem: (k) => (k in st ? st[k] : null),
        setItem: (k, v) => { st[k] = String(v); },
        removeItem: (k) => { delete st[k]; }
      };
    })(),
    console: console
  };
  win.window = win;
  win.self = win;
  const ctx = vm.createContext(win);
  return { ctx: ctx, win: win, els: els, doc: doc };
}

function loadUI(fetchImpl) {
  const sb = mkSandbox(fetchImpl);
  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-challenges.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-challenges.js' });
  return sb;
}

/* ═══════════ موك يطابق الـcontract الحقيقي ═══════════ */
function mkChallenge(o) {
  o = o || {};
  return {
    id: o.id || 'ch_20261028_COMI',
    date: o.date || '2026-10-28',
    code: o.code || 'COMI',
    name: o.name || 'البنك التجاري',
    sector: o.sector || 'بنوك',
    direction: o.direction || 'up',
    entry: o.entry === undefined ? 52.4 : o.entry,
    stop: o.stop === undefined ? 50.9 : o.stop,
    target: o.target === undefined ? 55.4 : o.target,
    rr: o.rr === undefined ? 2.0 : o.rr,
    question_ar: o.question_ar || 'هل السهم هيكسر المقاومة ويكمّل صعود لهدف 55.4؟',
    expires_at: o.expires_at || '2026-10-29',
    status: o.status || 'open',
    resolved: o.resolved === undefined ? null : o.resolved,
    my_vote: o.my_vote === undefined ? null : o.my_vote
  };
}

function mkMe(o) {
  o = o || {};
  return {
    points: o.points !== undefined ? o.points : 120,
    correct: o.correct !== undefined ? o.correct : 8,
    wrong: o.wrong !== undefined ? o.wrong : 4,
    neutral: o.neutral !== undefined ? o.neutral : 1,
    accuracy: o.accuracy !== undefined ? o.accuracy : 0.667,
    streak: o.streak !== undefined ? o.streak : 3,
    rank: o.rank !== undefined ? o.rank : 4,
    days_played: o.days_played !== undefined ? o.days_played : 13
  };
}

/* 🎯 موك عام: يرد على المسارات الثلاثة ويسجّل كل طلب */
function mockApi(opts) {
  opts = opts || {};
  const calls = [];
  const todayPayload = opts.today !== undefined ? opts.today
    : { ok: true, challenge: mkChallenge(), me: mkMe() };
  const lbPayload = opts.leaderboard !== undefined ? opts.leaderboard
    : {
      ok: true,
      rows: [
        { rank: 1, alias: 'صقر', points: 210, correct: 14, accuracy: 0.78, streak: 5 },
        { rank: 2, alias: 'مبارح', points: 180, correct: 12, accuracy: 0.7, streak: 2 }
      ],
      me: { rank: 4, points: 120, accuracy: 0.667 },
      status: 'ok'
    };
  const todayStatus = opts.todayStatus || 200;
  const lbStatus = opts.lbStatus || 200;

  const fn = function (url, init) {
    const u = String(url);
    calls.push({ url: u, method: (init && init.method) || 'GET', body: init && init.body });
    if (u.indexOf('/api/challenges/today') >= 0) {
      return Promise.resolve({
        ok: todayStatus < 400, status: todayStatus,
        json: () => Promise.resolve(todayPayload)
      });
    }
    if (u.indexOf('/api/challenges/leaderboard') >= 0) {
      return Promise.resolve({
        ok: lbStatus < 400, status: lbStatus,
        json: () => Promise.resolve(lbPayload)
      });
    }
    if (u.indexOf('/api/challenges/vote') >= 0) {
      const body = init && init.body ? JSON.parse(init.body) : {};
      const out = { ok: true, challenge_id: 'ch_20261028_COMI', my_vote: body.vote };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(out) });
    }
    if (u.indexOf('/api/radar/history') >= 0) {
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({
          cached: true,
          codes: {
            COMI: {
              t: ['2026-10-01', '2026-10-15', '2026-10-28'],
              o: [50, 51, 52], h: [52, 53, 54], l: [49, 50, 51],
              c: [51, 52, 53], v: [10, 20, 30]
            }
          }
        })
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  };
  fn.calls = calls;
  return fn;
}

/* ⏳ tick — نستنى الـmicrotasks تخلص (التحميل الأوّلي بيخلص) */
function tick() { return new Promise((r) => setTimeout(r, 0)); }

/* 🧪 boot — بنحمّل الواجهة ونستنى التحميل الأوّلي يخلص،
   عشان ما يتعارضش مع تعديل الحالة في الاختبار. */
async function boot(payload) {
  const api = mockApi(payload || {});
  const sb = loadUI(api);
  await tick();
  return { sb: sb, api: api, S: sb.win.OCTAChallenges.state };
}

/* ⛔ مفيش اسم أداة ذكاء اصطناعي في أي نص ظاهر */
const AI_NAMES = /claude|chatgpt|gemini|copilot|gpt-|openai|anthropic|midjourney|dall-?e|deepseek|llama|perplexity/i;

/* ═══════════ 1) التحمّل ═══════════ */
test('الواجهة بتتحمّل من غير crash', () => {
  const sb = loadUI();
  assert.ok(sb.win.OCTAChallenges, 'الـAPI متاحة');
  assert.equal(typeof sb.win.OCTAChallenges._test.renderChallenge, 'function');
  assert.equal(typeof sb.win.OCTAChallenges._test.vote, 'function');
});

/* ═══════════ 2) كارت التحدي ═══════════ */
test('الكارت بيعرض الرمز والاسم والقطاع والمستويات', async () => {
  const { sb, S } = await boot({});
  S.challenge = mkChallenge({});
  S.me = mkMe({});
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();

  const head = sb.els['chCardHead'].innerHTML;
  assert.ok(head.indexOf('COMI') >= 0, 'الرمز ظاهر');
  assert.ok(head.indexOf('البنك التجاري') >= 0, 'الاسم ظاهر');
  assert.ok(head.indexOf('بنوك') >= 0, 'القطاع ظاهر');
  assert.ok(head.indexOf('▲') >= 0, 'اتجاه الصعود ظاهر');

  const lv = sb.els['chCardLevels'].innerHTML;
  assert.ok(lv.indexOf('الدخول') >= 0, 'الدخول');
  assert.ok(lv.indexOf('الوقف') >= 0, 'الوقف');
  assert.ok(lv.indexOf('الهدف') >= 0, 'الهدف');
  assert.ok(lv.indexOf('52.4') >= 0, 'سعر الدخول');
  assert.ok(lv.indexOf('50.9') >= 0, 'سعر الوقف');
  assert.ok(lv.indexOf('55.4') >= 0, 'سعر الهدف');
  assert.ok(lv.indexOf('ع/م') >= 0, 'العائد/المخاطرة');

  const q = sb.els['chQuestion'].innerHTML;
  assert.ok(q.indexOf('سؤال') >= 0, 'عنوان السؤال');
  assert.ok(q.indexOf('هل السهم') >= 0, 'نص السؤال بالعربي');
});

test('الاتجاه الهبوطي بيتعرض بعلامة ▼', async () => {
  const { sb, S } = await boot({});
  S.challenge = mkChallenge({ direction: 'down' });
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  const head = sb.els['chCardHead'].innerHTML;
  assert.ok(head.indexOf('▼') >= 0, 'اتجاه الهبوط');
  assert.ok(head.indexOf('down') >= 0, 'كلاس الهبوط');
});

/* ═══════════ 3) ⛔ مفيش undefined ولا NaN ═══════════ */
test('⛔ مفيش undefined ولا NaN في أي جزء من الصفحة', async () => {
  const { sb, S } = await boot({});
  S.challenge = mkChallenge({});
  S.me = mkMe({});
  S.loaded = true;
  S.rows = [{ rank: 1, alias: 'مبارح', points: 10, correct: 2, accuracy: 0.5, streak: 1 }];
  S.lbStatus = 'ok';
  S.lbMe = { rank: 2, points: 5, accuracy: 0.25 };
  sb.win.OCTAChallenges._test.render();
  sb.win.OCTAChallenges._test.renderLeaderboard();
  sb.win.OCTAChallenges._test.renderStats();

  ['chCardHead', 'chCardLevels', 'chQuestion', 'chVoteState', 'chDaysLeft',
    'chResult', 'chLeaderboard'].forEach(function (id) {
    const html = sb.els[id].innerHTML;
    assert.ok(html.indexOf('undefined') < 0, 'مفيش undefined في ' + id + ' → ' + html.slice(0, 120));
    assert.ok(html.indexOf('NaN') < 0, 'مفيش NaN في ' + id + ' → ' + html.slice(0, 120));
  });
  ['chPoints', 'chCorrect', 'chWrong', 'chAccuracy', 'chStreak', 'chRank'].forEach(function (id) {
    const t = sb.els[id].textContent;
    assert.ok(String(t).indexOf('undefined') < 0, 'مفيش undefined في ' + id);
    assert.ok(String(t).indexOf('NaN') < 0, 'مفيش NaN في ' + id);
  });
});

test('⛔ بيانات ناقصة (من غير أسعار) ⇒ مفيش undefined/NaN', async () => {
  const { sb, S } = await boot({});
  S.challenge = mkChallenge({ entry: null, stop: null, target: null, rr: null, sector: '' });
  S.me = {};
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  const html = sb.els['chCardLevels'].innerHTML;
  assert.ok(html.indexOf('undefined') < 0, 'مفيش undefined');
  assert.ok(html.indexOf('NaN') < 0, 'مفيش NaN');
  assert.ok(html.indexOf('—') >= 0, 'الفراغ اتعرض كشرطة');
});

/* ═══════════ 4) التصويت ═══════════ */
test('زرار «صعود» بيبعت POST بالـbody الصح', async () => {
  const { sb, S, api } = await boot({});
  S.challenge = mkChallenge({});
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();

  const btn = sb.els['chVoteUp'];
  assert.equal(btn.disabled, false, 'الزرار مفتوح قبل التصويت');
  assert.ok(btn._l.click && btn._l.click.length, 'الزرار مربوط');

  await btn._l.click[0]();
  await tick();

  const post = api.calls.filter((c) => c.method === 'POST' && c.url.indexOf('/api/challenges/vote') >= 0);
  assert.equal(post.length, 1, 'طلب واحد POST');
  assert.ok(post[0].url.indexOf('/api/challenges/vote') >= 0, 'المسار');
  const body = JSON.parse(post[0].body);
  assert.equal(body.code, 'COMI', 'الرمز');
  assert.equal(body.vote, 'up', 'التصويت');
  assert.equal(S.challenge.my_vote, 'up', 'صوتك اتسجّل');
  assert.equal(sb.els['chVoteUp'].disabled, true, 'الزرار اتقفل بعد التصويت');
  assert.ok(sb.els['chVoteState'].innerHTML.indexOf('صوتك') >= 0, 'حالة الصوت ظهرت');
});

test('زرار «هبوط» بيبعت vote=down', async () => {
  const { sb, S, api } = await boot({});
  S.challenge = mkChallenge({});
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();

  await sb.els['chVoteDown']._l.click[0]();
  await tick();

  const post = api.calls.filter((c) => c.method === 'POST')[0];
  assert.ok(post, 'فيه POST');
  const body = JSON.parse(post.body);
  assert.equal(body.vote, 'down', 'التصويت هبوط');
  assert.equal(body.code, 'COMI', 'الرمز');
  assert.equal(S.challenge.my_vote, 'down', 'صوتك اتسجّل');
});

test('مفيش تصويت تاني بعد أول صوت (الزرار مقفول)', async () => {
  const { sb, S, api } = await boot({});
  S.challenge = mkChallenge({ my_vote: 'up' });
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  assert.equal(sb.els['chVoteUp'].disabled, true, 'الزرار مقفول');
  assert.equal(sb.els['chVoteDown'].disabled, true, 'الزرار مقفول');
  await sb.els['chVoteDown']._l.click[0]();
  await tick();
  assert.equal(api.calls.filter((c) => c.method === 'POST').length, 0, 'مفيش POST');
});

test('التحدي المتحل ⇒ الزرارين مقفولين', async () => {
  const { sb, S } = await boot({});
  S.challenge = mkChallenge({
    resolved: { outcome: 'up', reason: 'كسر المقاومة 52.0 ووقف فوق 50.9', resolved_at: '2026-10-29' }
  });
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  assert.equal(sb.els['chVoteUp'].disabled, true, 'الزرار مقفول');
  assert.equal(sb.els['chVoteDown'].disabled, true, 'الزرار مقفول');
});

/* ═══════════ 5) النتيجة بعد الحل ═══════════ */
test('النتيجة بتعرض النتيجة والسبب والتصحيح', async () => {
  const { sb, S } = await boot({});
  S.challenge = mkChallenge({
    my_vote: 'up',
    resolved: {
      outcome: 'up',
      reason: 'كسر المقاومة 52.0 بإغلاقين فوقها',
      resolved_at: '2026-10-29',
      target_at: '2026-10-29',
      stop_at: null
    }
  });
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  const html = sb.els['chResult'].innerHTML;
  assert.ok(html.indexOf('صعود') >= 0, 'النتيجة');
  assert.ok(html.indexOf('كسر المقاومة') >= 0, 'السبب');
  assert.ok(html.indexOf('التصحيح') >= 0, 'التصحيح');
  assert.ok(html.indexOf('تاريخ الهدف') >= 0, 'تاريخ الهدف');
  assert.ok(html.indexOf('تاريخ الوقف') >= 0, 'تاريخ الوقف');
  assert.ok(html.indexOf('2026-10-29') >= 0, 'تاريخ الحل');
});

test('النتيجة المتعادلة بتتقال «متعادل»', async () => {
  const { sb, S } = await boot({});
  S.challenge = mkChallenge({
    my_vote: 'up',
    resolved: { outcome: 'neutral', reason: 'السهم قعد في النطاق', resolved_at: '2026-10-30' }
  });
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  const html = sb.els['chResult'].innerHTML;
  assert.ok(html.indexOf('متعادل') >= 0, 'متعادل');
});

/* ═══════════ 6) ⛔ 403 ⇒ شاشة الباقة ═══════════ */
test('⛔ 403 ⇒ شاشة «باقة مدفوعة» مش جدول فاضي', async () => {
  const { sb, S } = await boot({ todayStatus: 403, today: { ok: false } });
  S.locked = true;
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  const html = sb.els['chLockBox'].innerHTML;
  assert.ok(html.indexOf('باقة') >= 0, 'لوحة الباقة');
  assert.ok(html.indexOf('التحديات') >= 0, 'اسم الصفحة');
  assert.ok(html.indexOf('مش توصية') >= 0, 'تنويه عدم نصيحة');
  assert.ok(html.indexOf('<table') < 0, 'مفيش جدول فاضي');
});

test('⛔ 401 ⇒ «لازم تسجّل دخول»', async () => {
  const { sb, S } = await boot({ todayStatus: 401, today: { ok: false } });
  S.auth = true;
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  const html = sb.els['chLockBox'].innerHTML;
  assert.ok(html.indexOf('لازم تسجّل دخول') >= 0, 'رسالة تسجيل الدخول');
  assert.ok(html.indexOf('<table') < 0, 'مفيش جدول فاضي');
});

/* ═══════════ 7) ⛔ مفيش تحدي ═══════════ */
test('⛔ challenge = null ⇒ رسالة واضحة (مش شاشة فاضية)', async () => {
  const { sb, S } = await boot({ today: { ok: true, challenge: null, me: mkMe({}) } });
  S.challenge = null;
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  const html = sb.els['chNoMsg'].innerHTML;
  assert.ok(html.indexOf('مفيش تحدي دلوقتي') >= 0, 'رسالة «مفيش تحدي دلوقتي»');
  assert.ok(html.indexOf('قفل السوق') >= 0, 'تلميح قفل السوق');
  assert.ok(html.indexOf('<table') < 0, 'مفيش جدول فاضي');
});

test('⛔ status=no_challenge ⇒ نفس الرسالة', async () => {
  const { sb, S } = await boot({
    today: { ok: true, challenge: mkChallenge({ status: 'no_challenge' }), me: mkMe({}) }
  });
  S.challenge = mkChallenge({ status: 'no_challenge' });
  S.loaded = true;
  sb.win.OCTAChallenges._test.render();
  const html = sb.els['chNoMsg'].innerHTML;
  assert.ok(html.indexOf('مفيش تحدي دلوقتي') >= 0, 'رسالة واضحة');
});

/* ═══════════ 8) ⛔ لوحة المتصدرين مخفية ═══════════ */
test('⛔ status=hidden ⇒ «لوحة المتصدرين هتفتح بعد ٣ مصوّتين»', async () => {
  const { sb, S } = await boot({
    leaderboard: { ok: true, rows: [], me: null, status: 'hidden' }
  });
  S.lbStatus = 'hidden';
  sb.win.OCTAChallenges._test.renderLeaderboard();
  const html = sb.els['chLeaderboard'].innerHTML;
  assert.ok(html.indexOf('هتفتح بعد ٣ مصوّتين') >= 0, 'رسالة اللوحة المخفية');
  assert.ok(html.indexOf('<table') < 0, 'مفيش لوح فاشلة');
});

test('لوحة المتصدرين بتعرض الجدول + «ترتيبك» في الأول', async () => {
  const { sb, S } = await boot({});
  S.lbStatus = 'ok';
  S.rows = [
    { rank: 1, alias: 'صقر', points: 210, correct: 14, accuracy: 0.78, streak: 5 },
    { rank: 2, alias: 'مبارح', points: 180, correct: 12, accuracy: 0.7, streak: 2 }
  ];
  S.lbMe = { rank: 4, points: 120, accuracy: 0.667 };
  sb.win.OCTAChallenges._test.renderLeaderboard();
  const html = sb.els['chLeaderboard'].innerHTML;
  assert.ok(html.indexOf('ترتيبك') >= 0, '«ترتيبك»');
  assert.ok(html.indexOf('<table') >= 0, 'الجدول');
  assert.ok(html.indexOf('صقر') >= 0, 'الاسم المستعار');
  assert.ok(html.indexOf('210') >= 0, 'النقاط');
  assert.ok(html.indexOf('78%') >= 0, 'الدقة');
  assert.ok(html.indexOf('الرتبة') >= 0, 'عمود الرتبة');
  assert.ok(html.indexOf('النقاط') >= 0, 'عمود النقاط');
  assert.ok(html.indexOf('الدقة') >= 0, 'عمود الدقة');
});

test('⛔ مفيش سحب أفقي في لوحة المتصدرين (مفيش wrapper سحب)', async () => {
  const { sb, S } = await boot({});
  S.lbStatus = 'ok';
  S.rows = [{ rank: 1, alias: 'صقر', points: 210, correct: 14, accuracy: 0.78, streak: 5 }];
  S.lbMe = { rank: 1, points: 210, accuracy: 0.78 };
  sb.win.OCTAChallenges._test.renderLeaderboard();
  assert.ok(sb.els['chLeaderboard'].innerHTML.indexOf('tablewrap') < 0, 'مفيش wrapper سحب أفقي');
});

/* ═══════════ 9) ⛔ مفيش اسم أداة ذكاء اصطناعي ═══════════ */
test('⛔ مفيش اسم أداة ذكاء اصطناعي في نصوص الصفحة', async () => {
  const { sb, S } = await boot({});
  S.challenge = mkChallenge({});
  S.me = mkMe({});
  S.loaded = true;
  S.lbStatus = 'ok';
  S.rows = [{ rank: 1, alias: 'صقر', points: 210, correct: 14, accuracy: 0.78, streak: 5 }];
  S.lbMe = { rank: 1, points: 210, accuracy: 0.78 };
  sb.win.OCTAChallenges._test.render();
  sb.win.OCTAChallenges._test.renderLeaderboard();
  sb.win.OCTAChallenges._test.renderResult();
  const ids = ['chCardHead', 'chCardLevels', 'chQuestion', 'chVoteState', 'chDaysLeft',
    'chResult', 'chLeaderboard', 'chLockBox'];
  ids.forEach(function (id) {
    assert.ok(!AI_NAMES.test(sb.els[id].innerHTML), 'اسم أداة ذكاء اصطناعي في ' + id);
  });
  /* 📌 والملف نفسه (الكود + التعليقات) */
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/octa-challenges.js'), 'utf8');
  assert.ok(!AI_NAMES.test(src), 'اسم أداة ذكاء اصطناعي في الملف');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = html.indexOf('id="page-challenges"');
  const j = html.indexOf('id="decideModal"', i);
  const seg = html.slice(i, j > i ? j : i + 6000);
  assert.ok(!AI_NAMES.test(seg), 'اسم أداة ذكاء اصطناعي في صفحة الـHTML');
});

/* ═══════════ 10) ⛔ مفيش معالجات جوّه الكود ═══════════ */
test('⛔ مفيش معالجات inline في ملف الصفحة', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/octa-challenges.js'), 'utf8');
  assert.ok(!/\son[a-z]+\s*=/.test(src), 'في معالج inline في الكود');
  assert.ok(src.indexOf('onclick') < 0, 'في onclick في الكود');
});

test('⛔ مفيش معالجات inline في صفحة التحديات بالـHTML', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = html.indexOf('id="page-challenges"');
  assert.ok(i > 0, 'الصفحة موجودة');
  const j = html.indexOf('id="decideModal"', i);
  const seg = html.slice(i, j > i ? j : i + 6000);
  assert.ok(seg.indexOf('onclick') < 0, 'في onclick في الصفحة');
  assert.ok(seg.indexOf('onchange=') < 0, 'في onchange في الصفحة');
});

/* ═══════════ 11) كل الـfetch بتعدّي على octaFetch ═══════════ */
test('⛔ كل طلبات الـAPI بتعدّي على octaFetch', async () => {
  const seen = [];
  const sb = loadUI();
  sb.win.octaFetch = function (u, o) {
    seen.push(String(u));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, rows: [], status: 'ok' }) });
  };
  sb.win.OCTAChallenges.load();
  await tick();
  assert.ok(seen.length >= 1, 'فيه نداء');
  assert.ok(seen[0].indexOf('/api/challenges/today') >= 0, 'المسار: ' + seen[0]);
});

/* ═══════════ 12) الأرقام ═══════════ */
test('تنسيق الأرقام: الأسعار والنسب والتواريخ', () => {
  const sb = loadUI();
  const T = sb.win.OCTAChallenges._test;
  assert.equal(T.fmtPrice(52.4), '52.4');
  assert.equal(T.fmtPrice(120), '120');
  assert.equal(T.fmtPrice(null), '—');
  assert.equal(T.num(null, '—'), '—');
  assert.equal(T.num(undefined, '—'), '—');
  assert.equal(T.num(0, '—'), 0, '⛔ الصفر رقم مش naN');
  assert.equal(T.fmtPct(0.667), '66.7%');
  assert.equal(T.fmtPct(66.7), '66.7%');
  assert.equal(T.fmtPct(null), '—');
  assert.equal(T.fmtDate('2026-10-28T10:00:00Z'), '2026-10-28');
  assert.equal(T.fmtDate(null), '—');
});

test('خطوط السعر: الدخول والوقف والهدف', () => {
  const sb = loadUI();
  const lines = sb.win.OCTAChallenges._test.priceLines(mkChallenge({}));
  const titles = lines.map((l) => l.title).join('|');
  assert.ok(titles.indexOf('الدخول') >= 0, 'الدخول');
  assert.ok(titles.indexOf('الوقف') >= 0, 'الوقف');
  assert.ok(titles.indexOf('الهدف') >= 0, 'الهدف');
  assert.equal(lines.length, 3, '٣ خطوط');
});

test('معطيات الرسم: تاريخ التحدي + المستويات', () => {
  const sb = loadUI();
  const p = sb.win.OCTAChallenges._test.patternOf(mkChallenge({}));
  assert.equal(p.detect_at, '2026-10-28', 'تاريخ التحدي');
  assert.equal(p.entry, 52.4, 'الدخول');
  assert.equal(p.stop, 50.9, 'الوقف');
  assert.equal(p.target, 55.4, 'الهدف');
});

/* ═══════════ 13) ⛔ الحماية (الحارس) ═══════════ */
test('⛔ الصفحة مسجّلة في الخمسة أماكن (element + TOOL_PAGES + KEEP + TOOLS + hook)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.indexOf('id="page-challenges"') >= 0, 'العنصر في الـHTML');
  assert.ok(html.indexOf('assets/js/octa-challenges.js') >= 0, 'السكربت');
  assert.ok(html.indexOf('assets/css-challenges.css') >= 0, 'الـCSS');

  const core = fs.readFileSync(path.join(ROOT, 'assets/js/octa-core.js'), 'utf8');
  const m = core.match(/const TOOL_PAGES = \[([^\]]+)\]/);
  assert.ok(m && m[1].indexOf("'challenges'") >= 0, '⛔ challenges مش في TOOL_PAGES');
  assert.ok(core.indexOf("id:'challenges'") >= 0, '⛔ challenges مش في TOOLS');
  assert.ok(core.indexOf("id === 'challenges'") >= 0, '⛔ مفيش hook في octaPageInit');

  const pages = fs.readFileSync(path.join(ROOT, 'assets/js/octa-pages.js'), 'utf8');
  const m2 = pages.match(/const KEEP = \[([^\]]+)\]/);
  assert.ok(m2 && m2[1].indexOf("'challenges'") >= 0, '⛔ challenges مش في KEEP');
});
