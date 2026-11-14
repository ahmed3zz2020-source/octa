#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""📱 تطوير تطبيق تقرير الزوار — ملف المستخدم + بطاقات الموبايل + محرك التصفّح"""
from pathlib import Path

P = Path("/workspace/mgmt/public/index.html")
s = P.read_text(encoding="utf-8")
orig_len = len(s)

# ═══════════════ ١) CSS جديد ═══════════════
CSS = """
/* ═══ 🆕 بطاقات المستخدمين (موبايل) ═══ */
#cardsBox{display:none;flex-direction:column;gap:10px}
.ucard{background:linear-gradient(160deg,var(--card2),var(--card));border:1px solid var(--line);
  border-radius:16px;padding:14px;cursor:pointer;transition:.15s;position:relative;overflow:hidden}
.ucard:active{transform:scale(.985);border-color:var(--gold)}
.uc-top{display:flex;align-items:center;gap:11px;margin-bottom:12px}
.uc-av{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex-shrink:0;
  background:linear-gradient(135deg,var(--gold),#8a6d12);color:#081521;font-weight:900;font-size:18px}
.uc-id{flex:1;min-width:0}
.uc-nm{font-weight:900;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uc-em{color:var(--dim2);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:ltr;text-align:right}
.uc-badge{font-size:10.5px;font-weight:800;padding:4px 9px;border-radius:999px;border:1px solid var(--line2);color:var(--dim);flex-shrink:0}
.uc-badge.on{color:var(--teal);border-color:rgba(22,199,154,.45);background:rgba(22,199,154,.1)}
.uc-badge.gold{color:var(--gold2);border-color:rgba(212,175,55,.45);background:rgba(212,175,55,.1)}
.uc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:10px}
.uc-stats div{background:rgba(0,0,0,.22);border:1px solid rgba(29,58,88,.7);border-radius:11px;
  padding:8px 4px;text-align:center}
.uc-stats b{display:block;font-size:16px;font-weight:900;color:var(--gold2);line-height:1.25;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uc-stats span{font-size:10px;color:var(--dim2);font-weight:700}
.uc-last{font-size:11.5px;color:var(--dim);font-weight:700;display:flex;align-items:center;gap:6px}
.uc-pages{margin-top:9px;padding-top:9px;border-top:1px dashed rgba(29,58,88,.8);display:flex;gap:6px;flex-wrap:wrap}
.uc-pg{font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:7px;background:rgba(74,158,255,.12);
  color:#8cc4ff;border:1px solid rgba(74,158,255,.28)}
.uc-pg i{font-style:normal;color:var(--dim2);font-weight:700}
@media(max-width:820px){#cardsBox{display:flex}#tUsersWrap{display:none}}

/* ═══ 🆕 ورقة المستخدم (ملف كامل) ═══ */
#sheet{position:fixed;inset:0;z-index:180;background:rgba(3,10,18,.9);backdrop-filter:blur(8px);
  display:none;overflow-y:auto;padding:0}
#sheet.on{display:block}
.sheet-in{max-width:720px;margin:0 auto;min-height:100%;background:var(--bg2);
  border-left:1px solid var(--line2);border-right:1px solid var(--line2)}
@media(max-width:720px){.sheet-in{border:0;width:100%}}
.sheet-hd{position:sticky;top:0;z-index:2;background:linear-gradient(135deg,#0d2136,#123049);
  padding:18px 18px 16px;border-bottom:1px solid var(--line);display:flex;gap:13px;align-items:center}
.sheet-hd .av{width:50px;height:50px;border-radius:15px;display:grid;place-items:center;flex-shrink:0;
  background:linear-gradient(135deg,var(--gold),#8a6d12);color:#081521;font-weight:900;font-size:20px}
.sheet-hd .who{flex:1;min-width:0}
.sheet-hd .nm{font-size:17px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sheet-hd .em{font-size:12px;color:var(--dim2);direction:ltr;text-align:right;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sheet-body{padding:16px 18px 40px}
.sheet-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:9px;margin-bottom:18px}
.sheet-grid div{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:11px 12px}
.sheet-grid .k{font-size:10.5px;color:var(--dim2);font-weight:700;margin-bottom:2px}
.sheet-grid .v{font-size:17px;font-weight:900;color:var(--gold2);white-space:nowrap}
.sheet-grid .v.sm{font-size:13px;line-height:1.4;white-space:normal}
.sh-h{font-size:13px;font-weight:900;color:var(--gold2);margin:20px 0 9px;
  display:flex;align-items:center;gap:7px}
.sh-h::before{content:"";width:4px;height:15px;border-radius:2px;background:var(--gold)}
.sh-note{font-size:12px;color:var(--dim2);margin:-4px 0 10px}

/* ═══ 🆕 أشرطة مدة الصفحات ═══ */
.dwrow{display:flex;align-items:center;gap:9px;margin-bottom:7px}
.dwrow .nm{font-size:12px;font-weight:800;min-width:88px;max-width:118px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dwrow .tr{flex:1;height:20px;background:rgba(255,255,255,.05);border-radius:7px;overflow:hidden}
.dwrow .fl{height:100%;border-radius:7px;background:linear-gradient(90deg,#4a9eff,#8cc4ff)}
.dwrow .vv{font-size:11.5px;font-weight:800;color:var(--dim);min-width:52px;text-align:left}
.dwrow .vv b{color:var(--gold2)}

/* ═══ 🆕 خط النشاط ═══ */
.act{display:flex;gap:9px;align-items:flex-start;padding:9px 11px;background:var(--card);
  border:1px solid var(--line);border-radius:11px;margin-bottom:6px}
.act .t{font-family:ui-monospace,monospace;font-size:11px;color:var(--gold2);font-weight:800;min-width:96px;flex-shrink:0}
.act .p{font-size:12.5px;font-weight:800;min-width:74px}
.act .d{font-size:11.5px;color:var(--dim);font-weight:700}

/* ═══ 🆕 شريط البحث ═══ */
#uSearch{background:var(--card);border:1px solid var(--line);color:var(--txt);border-radius:10px;
  padding:9px 13px;font-family:inherit;font-size:13px;outline:none;min-width:170px;flex:1;max-width:280px}
#uSearch:focus{border-color:var(--gold)}
.viewtog{display:flex;gap:0;border:1px solid var(--line2);border-radius:10px;overflow:hidden}
.viewtog button{background:transparent;border:0;border-radius:0;padding:7px 13px;font-size:12px;
  font-weight:800;color:var(--dim);padding:7px 12px}
.viewtog button.on{background:var(--gold);color:#081521}
"""
s = s.replace("</style>", CSS + "</style>")

# ═══════════════ ٢) المارك-آب ═══════════════
# ٢-أ) قسم المستخدمين: البحث + تبديل العرض + حاوية البطاقات
OLD_USERS = '''  <div class="tbl-wrap">
    <table id="tUsers">
      <thead><tr>'''
NEW_USERS = '''  <div class="toolbar no-print" style="margin-bottom:10px;gap:9px">
    <input type="text" id="uSearch" placeholder="🔍 ابحث باسم أو إيميل…">
    <div class="viewtog">
      <button id="vCards" onclick="setView('cards')">📱 بطاقات</button>
      <button id="vTable" class="on" onclick="setView('table')">📋 جدول</button>
    </div>
  </div>
  <div id="cardsBox"></div>
  <div id="tUsersWrap">
  <div class="tbl-wrap">
    <table id="tUsers">
      <thead><tr>'''
assert OLD_USERS in s
s = s.replace(OLD_USERS, NEW_USERS, 1)

# اقفل الـdiv الجديد بعد الجدول
OLD_AFTER = '''      <tbody></tbody>
    </table>
  </div>
  <div class="hint" style="margin-top:8px">'''
NEW_AFTER = '''      <tbody></tbody>
    </table>
  </div>
  </div>
  <div class="hint" style="margin-top:8px">'''
assert OLD_AFTER in s
s = s.replace(OLD_AFTER, NEW_AFTER, 1)

# ٢-ب) قسم جديد: «ملخص التصفّح لكل مستخدم»
NEW_SECTION = '''<!-- ═══ ٩. ملخص التصفّح لكل مستخدم ═══ -->
<section>
  <div class="sec-hd">
    <h2>٩. ملخص التصفّح — كل واحد فتح إيه وقعد قد إيه</h2>
    <span class="note" id="browseHead">…</span>
  </div>
  <div class="card" id="browseBox"></div>
</section>

<!-- ═══ ٨. السجل الخام ═══ -->'''
assert "<!-- ═══ ٨. السجل الخام ═══ -->" in s
s = s.replace("<!-- ═══ ٨. السجل الخام ═══ -->", NEW_SECTION, 1)

# ٢-ج) ورقة المستخدم
SHEET = '''
<!-- ═══ ورقة المستخدم (ملف كامل) ═══ -->
<div id="sheet" onclick="if(event.target===this)closeSheet()">
  <div class="sheet-in">
    <div class="sheet-hd">
      <div class="av" id="shAv">O</div>
      <div class="who">
        <div class="nm" id="shNm">—</div>
        <div class="em" id="shEm">—</div>
      </div>
      <button class="x" onclick="closeSheet()">×</button>
    </div>
    <div class="sheet-body" id="shBody"></div>
  </div>
</div>
'''
s = s.replace("<!-- نافذة التفاصيل -->", SHEET + "\n<!-- نافذة التفاصيل -->")

# ═══════════════ ٣) الجافاسكربت ═══════════════

# ٣-أ) محرك التصفّح + العرض
ENGINE = '''
/* ══ 🆕 محرك «قعد على إيه» — من السجل الخام ══ */
var DASH = { browse:{}, ufilter:'', view:'table' };

function computeBrowse(){
  var out = {};
  var ev = (D.raw_events || []);
  var byUser = {};
  for (var i = 0; i < ev.length; i++){
    var e = ev[i];
    if (!e || !e.u) continue;
    (byUser[e.u] = byUser[e.u] || []).push(e);
  }
  for (var uid in byUser){
    var list = byUser[uid].slice().sort(function(a,b){ return a.ts - b.ts; });
    var pages = {}, total = 0, last = 0, first = 0;
    for (var j = 0; j < list.length; j++){
      var x = list[j];
      var nx = list[j+1];
      var sec = nx ? (nx.ts - x.ts) : 0;
      /* ⛔ فجوة > ٣٠ دقيقة = المستخدم ساب تاب مش مفتوح ⇒ مش وقت نشاط */
      if (sec > 1800) sec = 0;
      var key = x.p || '?';
      var pg = pages[key] || (pages[key] = {v:0, s:0});
      pg.v++; pg.s += sec; total += sec;
      if (!first) first = x.ts;
      last = x.ts;
    }
    out[uid] = { pages: pages, total: total, last: last, first: first,
                  views: list.length, events: list };
  }
  return out;
}

/* ══ 🆕 بطاقات الموبايل ══ */
function renderCards(){
  var box = document.getElementById('cardsBox');
  if (!box) return;
  var q = DASH.ufilter.trim().toLowerCase();
  var rows = (sortUsers || D.users).slice().sort(function(a,b){
    var x = a[sortKey], y = b[sortKey];
    if (typeof x === 'string') return sortDir * String(x||'').localeCompare(String(y||''), 'ar');
    return sortDir * ((x||0) - (y||0));
  });
  if (q) rows = rows.filter(function(u){
    return (u.name||'').toLowerCase().indexOf(q) >= 0 || (u.email||'').toLowerCase().indexOf(q) >= 0;
  });
  box.innerHTML = rows.length ? rows.map(function(u){
    var br = (DASH.browse || {})[u.uid];
    var pgs = '';
    if (br){
      var arr = Object.keys(br.pages).map(function(k){
        return { k:k, s:br.pages[k].s, v:br.pages[k].v };
      }).sort(function(a,b){ return b.s - a.s; }).slice(0, 4);
      pgs = '<div class="uc-pages">' + arr.map(function(p){
        return '<span class="uc-pg">' + esc(p.k) + ' <i>' + hm(p.s) + '</i></span>';
      }).join('') + '</div>';
    }
    var badge = u.a7 ? '<span class="uc-badge on">نشط آخر ٧ أيام</span>'
              : (u.a30 ? '<span class="uc-badge gold">نشط</span>' : '<span class="uc-badge">خامل</span>');
    return '<div class="ucard" onclick="openUser(\\'' + u.uid + '\\')">'
      + '<div class="uc-top"><div class="uc-av">' + esc((u.name || '?')[0]) + '</div>'
      + '<div class="uc-id"><div class="uc-nm">' + esc(u.name) + '</div>'
      + '<div class="uc-em">' + esc(u.email || 'زائر') + '</div></div>' + badge + '</div>'
      + '<div class="uc-stats">'
      + '<div><b>' + u.hits + '</b><span>صفحة</span></div>'
      + '<div><b>' + u.sessions + '</b><span>جلسة</span></div>'
      + '<div><b>' + (u.dwell_total ? hm(u.dwell_total) : '—') + '</b><span>وقت</span></div>'
      + '<div><b>' + u.n_dev + '</b><span>جهاز</span></div>'
      + '</div>'
      + '<div class="uc-last">🕒 آخر ظهور ' + esc(u.last_seen) + '</div>' + pgs + '</div>';
  }).join('') : '<p class="dim" style="text-align:center;padding:24px">مفيش نتايج</p>';
}

/* ══ 🆕 ملخص التصفّح لكل مستخدم ══ */
function renderBrowse(){
  var box = document.getElementById('browseBox');
  var head = document.getElementById('browseHead');
  if (!box) return;
  var br = DASH.browse || {};
  var keys = Object.keys(br);
  if (!keys.length){
    if (head) head.innerHTML = '<span class="pill y">لسه مش مفعّل</span>';
    box.innerHTML = '<p class="dim">المسار <code>/api/admin/events</code> لسه مش موجود على السيرفر، فمفيش تفصيل لكل صفحة. '
      + 'أول ما يتنفّذ، التطبيق هيعرض هنا: كل مستخدم · كل صفحة فتحها · قعد قد إيه عليها · وإمتى. '
      + 'التتابع جاهز في الكود — محتاج بس تصليح صلاحية التوكن للباك.</p>';
    return;
  }
  var rows = [];
  for (var uid in br){
    var b = br[uid];
    var u = null;
    for (var i = 0; i < D.users.length; i++) if (D.users[i].uid === uid) { u = D.users[i]; break; }
    var arr = Object.keys(b.pages).map(function(k){
      return { k:k, s:b.pages[k].s, v:b.pages[k].v };
    }).sort(function(x,y){ return y.s - x.s; });
    rows.push({ u:u, name:(u ? u.name : 'زائر مجهول'), b:b, arr:arr });
  }
  rows.sort(function(a,b){ return b.b.total - a.b.total; });
  var tot = 0, totPages = 0;
  rows.forEach(function(r){ tot += r.b.total; totPages += r.b.views; });
  if (head) head.innerHTML = '<span class="pill g">' + keys.length + ' مستخدم · ' + totPages + ' صفحة</span>';
  var html = '<div class="sheet-grid" style="margin-bottom:16px">'
    + '<div><div class="k">إجمالي الوقت على الموقع</div><div class="v">' + hm(tot) + '</div></div>'
    + '<div><div class="k">إجمالي الصفحات المفتوحة</div><div class="v">' + totPages + '</div></div>'
    + '<div><div class="k">متوسط الوقت لكل مستخدم</div><div class="v">' + hm(Math.round(tot / Math.max(1, rows.length))) + '</div></div>'
    + '</div>';
  html += rows.map(function(r){
    var mx = r.arr.length ? r.arr[0].s || 1 : 1;
    var bars = r.arr.slice(0, 8).map(function(p){
      return '<div class="dwrow"><span class="nm">' + esc(p.k) + '</span>'
        + '<span class="tr"><span class="fl" style="width:' + Math.max(3, (p.s / mx) * 100) + '%"></span></span>'
        + '<span class="vv"><b>' + hm(p.s) + '</b> · ' + p.v + '×</span></div>';
    }).join('');
    return '<div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px dashed rgba(29,58,88,.8)">'
      + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:9px;cursor:pointer" onclick="openUser(\\'' + (r.u ? r.u.uid : '') + '\\')">'
      + '<span class="uc-av" style="width:32px;height:32px;font-size:14px;border-radius:10px">' + esc((r.name || '?')[0]) + '</span>'
      + '<b style="font-size:14px">' + esc(r.name) + '</b>'
      + '<span class="pill g" style="margin-inline-start:auto">وقت نشط ' + hm(r.b.total) + '</span></div>'
      + bars + '</div>';
  }).join('');
  box.innerHTML = html;
}

/* ══ 🆕 ورقة المستخدم ══ */
function openUser(uid){
  var u = null;
  for (var i = 0; i < D.users.length; i++) if (D.users[i].uid === uid) { u = D.users[i]; break; }
  if (!u) return;
  var br = (DASH.browse || {})[uid];
  document.getElementById('shAv').innerText = (u.name || '?')[0];
  document.getElementById('shNm').innerText = u.name;
  document.getElementById('shEm').innerText = u.email || 'زائر';

  /* أول ظهور = آخر ظهور − المدة الكلية (المقياس القديم في monthly) */
  var first = u.first_seen || '—';
  var html = '<div class="sheet-grid">'
    + '<div><div class="k">آخر ظهور</div><div class="v sm">' + esc(u.last_seen) + '</div></div>'
    + '<div><div class="k">أول ظهور</div><div class="v sm">' + esc(first) + '</div></div>'
    + '<div><div class="k">إجمالي الوقت</div><div class="v">' + (u.dwell_total ? hm(u.dwell_total) : '—') + '</div></div>'
    + '<div><div class="k">الجلسات</div><div class="v">' + u.sessions + '</div></div>'
    + '<div><div class="k">صفحات فتح</div><div class="v">' + u.hits + '</div></div>'
    + '<div><div class="k">متوسط الجلسة</div><div class="v">' + (u.avg_dwell ? hm(u.avg_dwell) : '—') + '</div></div>'
    + '<div><div class="k">مدى النشاط</div><div class="v">' + (u.span_days || '—') + ' يوم</div></div>'
    + '<div><div class="k">الأجهزة / IPs</div><div class="v">' + u.n_dev + ' / ' + u.n_ips + '</div></div>'
    + '</div>';

  /* ── قعد على إيه ── */
  html += '<div class="sh-h">📚 قعد على إيه</div>';
  if (br){
    var mx = 1;
    var arr = Object.keys(br.pages).map(function(k){ return {k:k, s:br.pages[k].s, v:br.pages[k].v}; })
      .sort(function(a,b){ return b.s - a.s; });
    arr.forEach(function(p){ if (p.s > mx) mx = p.s; });
    html += '<div class="sh-note">الوقت محسوب من فجوة بين كل صفحة والتي بعدها · أكتر من ٣٠ دقيقة بتتحسب إن المستخدم ساب.</div>';
    html += arr.map(function(p){
      return '<div class="dwrow"><span class="nm">' + esc(p.k) + '</span>'
        + '<span class="tr"><span class="fl" style="width:' + Math.max(3, (p.s / mx) * 100) + '%"></span></span>'
        + '<span class="vv"><b>' + hm(p.s) + '</b> · ' + p.v + '×</span></div>';
    }).join('');
    html += '<div class="sh-note" style="margin-top:10px">إجمالي الوقت النشط: <b style="color:var(--gold2)">' + hm(br.total) + '</b>'
      + ' · ' + br.views + ' صفحة</div>';
  } else {
    html += '<div class="sh-note">التفصيل لكل صفحة محتاج مسار <code>/api/admin/events</code> على السيرفر. '
      + 'حالياً متاح: <b style="color:var(--gold2)">' + u.hits + '</b> صفحة فتحها، '
      + '<b style="color:var(--gold2)">' + u.sessions + '</b> جلسات، '
      + '<b style="color:var(--gold2)">' + (u.dwell_total ? hm(u.dwell_total) : '—') + '</b> وقت على الموقع.</div>';
  }

  /* ── الجلسات ── */
  if (u.srows && u.srows.length){
    html += '<div class="sh-h">⏱️ الجلسات (' + u.srows.length + ')</div>';
    html += u.srows.slice().reverse().map(function(sr){
      return '<div class="act"><span class="t">' + esc(sr.start) + '</span>'
        + '<span class="p">' + esc(sr.vias.join('/')) + '</span>'
        + '<span class="d">' + hm(sr.min) + ' · ' + sr.logins + ' دخول'
        + (sr.long ? ' · <span class="pill b">جلسة مستمرة</span>' : '') + '</span></div>';
    }).join('');
  }

  /* ── الأجهزة ── */
  if (u.devices && u.devices.length){
    html += '<div class="sh-h">📱 الأجهزة (' + u.n_dev + ')</div>';
    html += u.devices.map(function(d, i){
      var lg = null;
      for (var j = 0; j < u.logins.length; j++) if (u.logins[j].dev === d) { lg = u.logins[j]; break; }
      return '<div class="act"><span class="t mono">' + esc(d) + '</span>'
        + '<span class="d">' + (lg ? esc(lg.ip || '—') + ' · ' + esc(lg.ts) : '') + '</span></div>';
    }).join('');
  }

  /* ── آخر نشاط (من السجل الخام) ── */
  if (br && br.events && br.events.length){
    html += '<div class="sh-h">📋 آخر ٢٥ نشاط</div>';
    html += br.events.slice(-25).reverse().map(function(e){
      var d = new Date((e.ts || 0) * 1000);
      return '<div class="act"><span class="t">' + d.toLocaleString('ar-EG', {hour12:false}) + '</span>'
        + '<span class="p">' + esc(e.p || '?') + '</span>'
        + '<span class="d">' + esc(e.ev || '') + '</span></div>';
    }).join('');
  }

  document.getElementById('shBody').innerHTML = html;
  document.getElementById('sheet').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeSheet(){
  document.getElementById('sheet').classList.remove('on');
  document.body.style.overflow = '';
}

function setView(v){
  DASH.view = v;
  var c = document.getElementById('vCards'), t = document.getElementById('vTable');
  var wrap = document.getElementById('tUsersWrap'), cards = document.getElementById('cardsBox');
  if (v === 'cards'){
    if (c) c.classList.add('on'); if (t) t.classList.remove('on');
    if (cards) cards.style.display = 'flex';
    if (wrap) wrap.style.display = 'none';
  } else {
    if (c) c.classList.remove('on'); if (t) t.classList.add('on');
    if (cards) cards.style.display = '';
    if (wrap) wrap.style.display = '';
  }
  try { localStorage.setItem('octa_mgmt_view', v); } catch (e) {}
}
'''
s = s.replace("/* ══ تشغيل ══ */", ENGINE + "\n/* ══ تشغيل ══ */")

# ٣-ب) ربط renderAll
s = s.replace("renderFunnel(); renderGaps(); renderRaw(); }",
              "renderFunnel(); renderGaps(); renderRaw(); renderBrowse(); renderCards(); }")
s = s.replace("function renderAll(){ kpis(); renderUsers(); renderTL();",
              "function renderAll(){ DASH.browse = computeBrowse(); kpis(); renderUsers(); renderTL();")

# ٣-ج) البحث + تبديل العرض
s = s.replace("""  document.addEventListener('DOMContentLoaded', ()=>{""",
"""  document.addEventListener('DOMContentLoaded', ()=>{
    var us = document.getElementById('uSearch');
    if (us) us.addEventListener('input', function(){ DASH.ufilter = us.value; renderCards(); renderUsers(); });
    try { var v = localStorage.getItem('octa_mgmt_view'); if (v) setView(v); } catch (e) {}
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeSheet(); });""")

P.write_text(s, encoding="utf-8")
print("✅ اتطور من %d → %d بايت" % (orig_len, len(s)))
