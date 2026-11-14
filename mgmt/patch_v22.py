#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🔧 ترقية تطبيق octa-mgmt → v2.2
1) إصلاح تبديل الجدول/البطاقات على الموبايل (الفلتر اللي مش شغال)
2) البحث يشتغل في عرض الجدول كمان
3) «آخر ظهور» = الأحدث بين سجل التتبع وآخر دخول (الرقم كان قديم ١٠ ساعات)
4) «الوقت الفعلي» (سقف ٣٠ دقيقة) بدل «فتح وساب»
5) متابعة الأسهم لكل مستخدم (Worker: /api/prefs)
6) تصدير Excel حقيقي (.xlsx) بدل CSV ملخبط
"""
import io, os, sys

ROOT = "/workspace/mgmt"
HTML = f"{ROOT}/public/index.html"
APPJ = f"{ROOT}/public/app.js"
WORK = f"{ROOT}/worker.js"

def patch(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    for old, new, tag in pairs:
        n = s.count(old)
        if n != 1:
            print(f"⛔ [{tag}] {path}:|match {n}| (المطلوب 1)"); sys.exit(1)
        s = s.replace(old, new)
        print(f"  ✔ [{tag}]")
    io.open(path, "w", encoding="utf-8").write(s)

# ═══════════════════════ index.html ═══════════════════════
H = []

H.append((
"""@media(max-width:820px){#cardsBox{display:flex}#tUsersWrap{display:none}}""",
"""@media(max-width:820px){
/* ⭐ ١٤ نوفمبر — التبديل بين الجدول والبطاقات كان مكسور على الموبايل:
   الـmedia query كان بيفرض عرض البطاقات ويخفي الجدول ⇒ ضغطة «جدول» ما كانش
  عمل حاجة. دلوقتي العرض بيتحكم فيه data-view (JavaScript) مش بالـCSS. */
body[data-view="cards"] #tUsersWrap{display:none!important}
body[data-view="table"] #cardsBox{display:none!important}
.tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
}""", "CSS-التبديل"))

H.append((
"""<script src="/app.js"></script>""",
"""<script src="/xlsx.js"></script>
<script src="/app.js"></script>""", "script-xlsx"))

H.append((
"""        <th data-s="sessions">الجلسات</th>
        <th data-s="dwell_last">آخر جلسة</th>
        <th data-s="dwell_total">إجمالي الوقت</th>
        <th data-s="span_days">المدى (يوم)</th>""",
"""        <th data-s="sessions">الجلسات</th>
        <th data-s="active_min">الوقت الفعلي</th>
        <th data-s="dwell_total">الوقت الكلي (تقديري)</th>
        <th data-s="span_days">المدى (يوم)</th>""", "thead-1"))

H.append((
"""        <th data-s="last_seen">آخر ظهور</th>
        <th data-s="pin">باسورد</th>""",
"""        <th data-s="last_seen">آخر ظهور</th>
        <th data-s="watch">متابعات أسهم</th>
        <th data-s="pin">باسورد</th>""", "thead-2"))

H.append((
"""    «آخر جلسة» = من لحظة الدخول لآخر نشاط مسجّل · «إجمالي الوقت» = مجموع الجلسات (الحدّ الأعلى تقريبيًا)""",
"""    ⭐ «الوقت الفعلي» = الوقت اللي المستخدم كان فيه فعلاً (الفترات الخاملة مستبعدة بسقف ٣٠ دقيقة) — ده اللي بيديك إجابة «قعد يتصفح قد إيه». «الوقت الكلي» = الحد الأعلى (شامل الفترات اللي المستخدم ساب فيها).""", "hint"))

H.append((
"""function renderUsers(){
  const rows = (sortUsers||D.users).slice();
  rows.sort((a,b)=>{""",
"""function renderUsers(){
  /* ⭐ ١٤ نوفمبر — البحث كان شغال في البطاقات بس؛ في الجدول الماكس ⛔ ما كانش
     بيفلتر خالص (المصدر: rows من sortUsers على طول). */
  const q = (DASH.ufilter||'').trim().toLowerCase();
  let rows = (sortUsers||D.users).slice();
  if (q) rows = rows.filter(u =>
    String(u.name||'').toLowerCase().indexOf(q) >= 0 ||
    String(u.email||'').toLowerCase().indexOf(q) >= 0);
  rows.sort((a,b)=>{""", "renderUsers-فلتر"))

H.append((
"""      <td class="num">${u.dwell_last?hm(u.dwell_last):'<span class="dim">—</span>'}</td>
      <td class="num">${u.dwell_total?hm(u.dwell_total):'<span class="dim">—</span>'}</td>""",
"""      <td class="num"><b>${u.active_min?hm(u.active_min):'<span class="dim">—</span>'}</b></td>
      <td class="num">${u.dwell_total?hm(u.dwell_total):'<span class="dim">—</span>'}</td>""", "renderUsers-وقت"))

H.append((
"""      <td class="mono dim">${esc(u.last_seen)}</td>
      <td>${u.pin?'<span class="pill g">✓</span>':'<span class="pill r">✕</span>'}</td>""",
"""      <td class="mono dim">${esc(u.last_seen)} ${u.ls_src?'<span class="pill n">'+esc(u.ls_src)+'</span>':''}</td>
      <td class="num">${u.watch?'<span class="pill y">'+u.watch+'</span>':'<span class="dim">0</span>'}</td>
      <td>${u.pin?'<span class="pill g">✓</span>':'<span class="pill r">✕</span>'}</td>""", "renderUsers-ظهور"))

H.append((
"""  if (v === 'cards'){
    if (c) c.classList.add('on'); if (t) t.classList.remove('on');
    if (cards) cards.style.display = 'flex';
    if (wrap) wrap.style.display = 'none';
  } else {
    if (c) c.classList.remove('on'); if (t) t.classList.add('on');
    if (cards) cards.style.display = '';
    if (wrap) wrap.style.display = '';
  }""",
"""  /* ⭐ data-view هي المصدر الحقيقي للعرض — الـCSS الموبايل كان بيفرض
     البطاقات ويخفي الجدول ⇒ ضغطة «جدول» ما كانتش بتعمل حاجة. */
  try { document.body.setAttribute('data-view', v); } catch(e) {}
  if (v === 'cards'){
    if (c) c.classList.add('on'); if (t) t.classList.remove('on');
    if (cards) cards.style.display = 'flex';
    if (wrap) wrap.style.display = 'none';
  } else {
    if (c) c.classList.remove('on'); if (t) t.classList.add('on');
    if (cards) cards.style.display = 'none';
    if (wrap) wrap.style.display = 'block';
  }""", "setView"))

H.append((
"""  try { var _v = localStorage.getItem('octa_mgmt_view'); if (_v) setView(_v); } catch (e) {}""",
"""  /* ⭐ الموبايل: البطاقات هي الافتراضية (الجدول ١٥ عمود على ٣٩٠px) */
  var _v = null;
  try { _v = localStorage.getItem('octa_mgmt_view'); } catch (e) {}
  if (!_v) _v = (window.matchMedia && window.matchMedia('(max-width:820px)').matches) ? 'cards' : 'table';
  setView(_v);""", "الافتراضي"))

# ── merge(): الوقت الفعلي + آخر ظهور صح + التفضيلات ──
H.append((
"""function merge(monthly, usersJ, loginsJ){
  const mu={}, uu={};""",
"""function merge(monthly, usersJ, loginsJ, prefsJ){
  const mu={}, uu={};
  /* ⭐ تفضيلات: الأسهم اللي كل مستخدم حط عليها تنبيه (من /api/prefs) */
  const pfByEmail={}, pfByName={};
  ((prefsJ&&prefsJ.users)||[]).forEach(p=>{
    if(p.email) pfByEmail[p.email.toLowerCase()]=p;
    if(p.name) pfByName[p.name]=p;
  });""", "merge-تفضيلات"))

H.append((
"""    const lsRaw = m.last_seen && m.last_seen!=='—' ? Math.floor(new Date(m.last_seen.replace(' ','T')+'Z').getTime()/1000) : 0;
    const ls = lsRaw + 7200;
    /* ⭐ أول ظهور = آخر ظهور − المدة الكلية (المقياس القديم في monthly) */
    const firstRaw = (lsRaw && m.session_min) ? (lsRaw - (m.session_min||0)*60) : 0;
    const firstIso = firstRaw ? new Date((firstRaw+7200)*1000).toISOString().slice(0,16).replace('T',' ') : '—';""",
"""    const lsRaw = m.last_seen && m.last_seen!=='—' ? Math.floor(new Date(m.last_seen.replace(' ','T')+'Z').getTime()/1000) : 0;
    /* ⭐⭐ ١٤ نوفمبر — «آخر ظهور» في monthly كان بيبقى قديم ساعات:
       سجل الت bluff بيتحدّث بس لو الـuid موجود في الحدث، والـuid بيمسح بعد
       الـrefresh ⇒ الـlast مبيتحدّثش. ⇒ ناخد الأحدث بين سجل التتبع وآخر دخول. */
    const lastLoginTs = logins.length ? logins[logins.length-1].t : 0;
    const trueLast = Math.max(lsRaw, lastLoginTs);
    const lsSrc = lastLoginTs > lsRaw ? 'دخول' : (lsRaw ? 'سجل' : '');
    const ls = trueLast + 7200;
    const lastIso = trueLast ? new Date((trueLast+7200)*1000).toISOString().slice(0,16).replace('T',' ') : '—';
    /* ⭐ أول ظهور = الأقدم بين (تاريخ إنشاء الحساب) و(أول دخول) */
    const createdTs = m.created_iso && m.created_iso!=='—' ? Math.floor(new Date(String(m.created_iso).replace(' ','T')+'Z').getTime()/1000) : 0;
    const firstLoginTs = logins.length ? logins[0].t : 0;
    const firstRaw = Math.min(...[createdTs, firstLoginTs].filter(x=>x>0).concat([0]));
    const firstIso = firstRaw ? new Date((firstRaw+7200)*1000).toISOString().slice(0,16).replace('T',' ') : '—';
    /* ⭐⭐ «الوقت الفعلي» = مجموع الفجوات مع سقف ٣٠ دقيقة ⇒ المستخدم اللي
       فتح وساب ما بيتحسبش قاعد. (الفجوة > ٣٠ د معناها ساب ورجع بعدين.) */
    const pts = logins.map(e=>e.t).concat(trueLast?[trueLast]:[]).sort((a,b)=>a-b);
    let activeSec = 0;
    for (let i=1;i<pts.length;i++) activeSec += Math.min(pts[i]-pts[i-1], 1800);
    const activeMin = Math.round(activeSec/60);""", "merge-الوقت"))

H.append((
"""      span_days: firstRaw && lsRaw ? Math.round((lsRaw-firstRaw)/86400*10)/10 : 0,""",
"""      span_days: firstRaw && trueLast ? Math.round((trueLast-firstRaw)/86400*10)/10 : 0,
      active_min: activeMin, ls_src: lsSrc,""", "merge-span"))

H.append((
"""      guest:!lg.email,watch:raw.watch||0,keys:(raw.keys||[]).length,""",
"""      guest:!lg.email,watch:(pfByEmail[(lg.email||'').toLowerCase()]||pfByName[lg.name]||{}).n || raw.watch||0,
      watch_items:((pfByEmail[(lg.email||'').toLowerCase()]||pfByName[lg.name]||{}).watch)||[],
      keys:(raw.keys||[]).length,""", "merge-watch"))

# ── تصدير Excel حقيقي ──
H.append((
"""/* ══ CSV ══ */
function csv(name, head, rows){
  const q = v => '"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const txt = '\\ufeff'+[head.map(q).join(',')].concat(rows.map(r=>r.map(q).join(','))).join('\\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'}));
  a.download=name; a.click();
}
function dlUsers(){
  csv('octa-users.csv',['name','email','created','hits','sessions','dwell_last_min','dwell_total_min','span_days','login_count','devices','ips','newdev','last_seen','pin'],
    D.users.map(u=>[u.name,u.email,u.created,u.hits,u.sessions,u.dwell_last,u.dwell_total,u.span_days,u.login_count,u.n_dev,u.n_ips,u.newdev,u.last_seen,u.pin?'نعم':'لا']));
}
function dlTime(){
  csv('octa-timeline.csv',['time','name','email','method','device','ip','new_device'],
    D.timeline.map(e=>[e.ts,e.name,e.email,e.via,e.dev,e.ip,e.newdev?'نعم':'لا']));
}""",
"""/* ══ تصدير Excel حقيقي (.xlsx) ══
   ⭐ ١٤ نوفمبر — التصدير القديم كان CSV عربي مفصول بـ« , » ⇒ Excel العربي
   بيفتحه كملف عمود واحد (ملخبط) + أسماء أعمدة إنجليزية. دلوقتي .xlsx
   حقيقي: عربي · اتجاه RTL · ألوان · أعمدة · ٣ أوراق. */
function xlsxSave(blob, name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ try{URL.revokeObjectURL(a.href);}catch(e){} a.remove(); }, 2000);
}
function xlsxRows(head, data){
  const rows=[head.map(function(h){ return {v:h, s:1}; })];
  data.forEach(function(r,i){
    rows.push(r.map(function(v){
      var isNum = (typeof v === 'number' && isFinite(v));
      return { v: v, s: isNum ? (i%2 ? 5 : 3) : (i%2 ? 4 : 2) };
    }));
  });
  return rows;
}
function dlUsers(){
  if(!window.OCTA_XLSX){ setSt('مكتبة Excel مش موجودة','err'); return; }
  const hd=['#','الاسم','الإيميل','تاريخ التسجيل','آخر ظهور','أول ظهور','الوقت الفعلي','الوقت الكلي (تقديري)',
            'المدى (يوم)','الجلسات','متوسط الجلسة (د)','الزيارات','زيارات/دقيقة','الدخولات','الأجهزة',
            'IP','أجهزة جديدة','متابعات أسهم','باسورد','نشط ٧ أيام','نشط ٣٠ يوم'];
  const data=D.users.map(function(u,i){
    return [i+1,u.name,u.email||'—',u.created,u.last_seen,u.first_seen,
      u.active_min||0, u.dwell_total||0, u.span_days||0, u.sessions||0,
      u.active_min&&u.sessions?Math.round(u.active_min/u.sessions):0,
      u.hits||0, u.active_min?Math.round(u.hits/u.active_min*100)/100:0,
      u.login_count||0, u.n_dev||0, u.n_ips||0, u.newdev||0, u.watch||0,
      u.pin?'نعم':'لا', u.a7?'نعم':'لا', u.a30?'نعم':'لا'];
  });
  const s1={name:'المستخدمون', cols:hd.map(function(){return {w:14};}),
    rows:xlsxRows(hd,data), headerRow:0, freeze:{r:1,c:1},
    autoFilter:'A1:'+String.fromCharCode(64+Math.min(26,hd.length))+String(data.length+1)};
  /* ── ورقة الجلسات ── */
  const sh=['#','المستخدم','بداية الجلسة','نهاية الجلسة (الحد الأعلى)','المدة الكلية (د)','الوقت الفعلي (د)','دخولات','طريقة الدخول','بصمة الجهاز','عنوان IP'];
  const sd=[];
  let n=0;
  D.users.forEach(function(u){
    (u.srows||[]).forEach(function(s){
      n++;
      sd.push([n,u.name,s.start,s.end,s.min,
        (u.active_min&&u.sessions)?Math.round(u.active_min/u.sessions):0,
        s.logins,(s.vias||[]).join(' · '),(s.dev||[]).join(' · '),s.bound==='actual'?'مقيس':'تقديري']);
    });
  });
  const s2={name:'الجلسات', cols:sh.map(function(){return {w:16};}), rows:xlsxRows(sh,sd), headerRow:0, freeze:{r:1,c:1}};
  /* ── ورقة الخط الزمني ── */
  const th=['الوقت','المستخدم','الإيميل','طريقة الدخول','بصمة الجهاز','عنوان IP','جهاز جديد'];
  const td=D.timeline.map(function(e){ return [e.ts,e.name,e.email||'—',e.via||'—',e.dev||'—',e.ip||'—',e.newdev?'نعم':'لا']; });
  const s3={name:'الخط الزمني', cols:th.map(function(){return {w:18};}), rows:xlsxRows(th,td), headerRow:0, freeze:{r:1,c:1}};
  const blob=window.OCTA_XLSX.build([s1,s2,s3],['المستخدمون','الجلسات','الخط الزمني']);
  xlsxSave(blob,'OCTA-تقرير-الزوار-'+new Date().toISOString().slice(0,10)+'.xlsx');
  setSt('تم تصدير Excel','ok');
}
function dlTime(){
  if(!window.OCTA_XLSX){ setSt('مكتبة Excel مش موجودة','err'); return; }
  const th=['الوقت','المستخدم','الإيميل','طريقة الدخول','بصمة الجهاز','عنوان IP','جهاز جديد'];
  const td=D.timeline.map(function(e){ return [e.ts,e.name,e.email||'—',e.via||'—',e.dev||'—',e.ip||'—',e.newdev?'نعم':'لا']; });
  const s={name:'الخط الزمني', cols:th.map(function(){return {w:18};}), rows:xlsxRows(th,td), headerRow:0, freeze:{r:1,c:1}};
  xlsxSave(window.OCTA_XLSX.build([s],['الخط الزمني']),'OCTA-الخط-الزمني-'+new Date().toISOString().slice(0,10)+'.xlsx');
  setSt('تم تصدير Excel','ok');
}""", "تصدير-Excel"))

# ── نافذة التفاصيل ──
H.append((
"""      <div><div class="k">إجمالي الوقت</div><div class="v">${hm(u.dwell_total)}</div></div>""",
"""      <div><div class="k">الوقت الفعلي</div><div class="v">${u.active_min?hm(u.active_min):'—'}</div></div>
      <div><div class="k">الوقت الكلي</div><div class="v">${hm(u.dwell_total)}</div></div>""", "sheet-وقت"))

H.append((
"""    <p class="hint" style="margin-top:10px">التسجيل: ${esc(u.created)} · أول ظهور: ${esc(u.first_seen)} · آخر ظهور: ${esc(u.last_seen)} · باسورد: ${u.pin?'نعم':'لا'} · مفاتيح متابعة: ${u.keys} · متابعة أسعار: ${u.watch}</p>`;""",
"""    ${(u.watch_items&&u.watch_items.length)?('<h3 style="font-size:14px;font-weight:800;margin:16px 0 8px;color:var(--gold2)">الأسهم اللي بيتابعها (تفضيلاته)</h3>'+
      '<div class="tbl-wrap"><table><thead><tr><th>الكود</th><th>السعر الأعلى</th><th>السعر الأدنى</th><th>وقت الإضافة</th></tr></thead><tbody>'+
      u.watch_items.map(function(w){ return '<tr><td><b>'+esc(w.code)+'</b></td><td class="num">'+esc(w.hi||'—')+'</td><td class="num">'+esc(w.lo||'—')+'</td><td class="mono dim">'+esc(w.at?new Date((w.at+7200)*1000).toISOString().slice(0,16).replace('T',' '):'—')+'</td></tr>'; }).join('')+
      '</tbody></table></div>'):''}
    <p class="hint" style="margin-top:10px">التسجيل: ${esc(u.created)} · أول ظهور: ${esc(u.first_seen)} · آخر ظهور: ${esc(u.last_seen)} ${u.ls_src?'('+esc(u.ls_src)+')':''} · باسورد: ${u.pin?'نعم':'لا'} · متابعة أسعار: ${u.watch}</p>`;""", "sheet-تفضيلات"))

# ── البطاقات ──
H.append((
"""      + '<div><b>' + (u.dwell_total ? hm(u.dwell_total) : '—') + '</b><span>وقت</span></div>'""",
"""      + '<div><b>' + (u.active_min ? hm(u.active_min) : '—') + '</b><span>وقت فعلي</span></div>'""", "cards-وقت"))

# ── KPI: وقت فعلي كلي ──
H.append((
"""    {k:'حطوا باسورد', v:k.pin_users, s:'من '+k.users, c:''},""",
"""    {k:'حطوا باسورد', v:k.pin_users, s:'من '+k.users, c:''},
    {k:'الوقت الفعلي الكلي', v:(function(){ var t=(D.users||[]).reduce(function(a,u){return a+(u.active_min||0);},0); return hm(t); })(), s:'بدون الفترات الخاملة', c:'violet'},""", "KPI-وقت"))

patch(HTML, H)

# ═══════════════════════ app.js ═══════════════════════
patch(APPJ, [(
"""    var jobs = [
      pullRemote('/api/admin/monthly'),
      pullRemote('/api/admin/users'),
      pullRemote('/api/admin/logins')
    ];""",
"""    var jobs = [
      pullRemote('/api/admin/monthly'),
      pullRemote('/api/admin/users'),
      pullRemote('/api/admin/logins')
    ];
    /* ⭐ تفضيلات كل مستخدم (الأسهم اللي بيتابعها) — اختياري: لو فشل ما بيأثرش */
    jobs.push(pullRemote('/api/prefs').catch(function () { return null; }));""", "appjs-prefs-job"),
(
"""      if (typeof window.merge === 'function') {
        window.D = window.merge(r[0], r[1], r[2]);
      }""",
"""      if (typeof window.merge === 'function') {
        window.D = window.merge(r[0], r[1], r[2], r[3]);
      }""", "appjs-merge-prefs")])

# ═══════════════════════ worker.js ═══════════════════════
patch(WORK, [(
"""      /* ── التمرير ── */""",
"""      /* ── ⭐ تفضيلات المستخدمين: الأسهم اللي بيتابعها كل واحد ──
         ⛔ الـadmin token مش بيوصلش للمتصفح ⇒mint_session + alerts/watch
         كلهم من السيرفر. الكاش ٣٠ دقيقة (البيانات مش بتتغير كل ثانية). */
      if (path === "/api/prefs") {
        const authed = await validSession(request, env.SESSION_SECRET);
        if (!authed) return json({ ok: false, error: "لازم تسجيل دخول" }, 401);
        if (!env.OCTA_ADMIN_TOKEN) return json({ ok: false, error: "التوكن غير مهيّأ" }, 500);
        const now = Date.now();
        if (PREFS_CACHE && (now - PREFS_CACHE.ts) < 1800000) {
          return json({ ok: true, cached: 1, users: PREFS_CACHE.users }, 200);
        }
        try {
          const up = await proxyToRailway("/api/admin/users", env.OCTA_ADMIN_TOKEN);
          if (!up.ok) return json({ ok: false, error: "تعذّر جلب المستخدمين" }, 502);
          const uj = await up.json();
          const items = await Promise.all((uj.users || []).map(async (u) => {
            const email = String(u.email || "").trim();
            const base = { uid: u.uid, name: u.name, email: email, watch: [], n: 0 };
            if (!email) return base;
            try {
              const mr = await fetch(ORIGIN + "/api/admin/mint_session", {
                method: "POST",
                headers: { "X-OCTA-Admin": env.OCTA_ADMIN_TOKEN, "Content-Type": "application/json" },
                body: JSON.stringify({ email: email }),
              });
              if (!mr.ok) return base;
              const mj = await mr.json();
              if (!mj.token) return base;
              const wr = await fetch(ORIGIN + "/api/alerts/watch", {
                headers: { Authorization: "Bearer " + mj.token },
              });
              if (!wr.ok) return base;
              const wj = await wr.json();
              const list = (wj.items || []).map((i) => ({ code: i.code, hi: i.hi, lo: i.lo, at: i.at }));
              return { uid: u.uid, name: u.name, email: email, watch: list, n: list.length };
            } catch (e) {
              return base;
            }
          }));
          PREFS_CACHE = { ts: now, users: items };
          return json({ ok: true, cached: 0, users: items }, 200);
        } catch (e) {
          return json({ ok: false, error: String((e && e.message) || e) }, 502);
        }
      }

      /* ── التمرير ── */""", "worker-prefs"),
(
"""const ORIGIN = "https://octa-prices-production-4ccb.up.railway.app";""",
"""const ORIGIN = "https://octa-prices-production-4ccb.up.railway.app";
/* ⭐ كاش التفضيلات (في الذاكرة) — ٣٠ دقيقة */
let PREFS_CACHE = null;""", "worker-cache")])

print("\\n✅ كل التعديلات اتطبقت")
