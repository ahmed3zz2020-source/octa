#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""📄 باني التقرير: HTML مطبوع (RTL) + PDF"""
import json, datetime, html, os

D = json.load(open("/workspace/output/octa-report-data.json", encoding="utf-8"))
K, U = D["kpi"], D["users"]
OUT_HTML = "/workspace/output/OCTA-VISITORS-REPORT-2026-11-14.html"

# 🛡️ الجولة ١٨ (P0) — ⛔ التقرير المطبوع فيه بيانات شخصية (أسماء/إيميلات/IP)
#   ⇒ لازم يفضل في مسار خاص — ممنوع يتكتب في مجلد public أو assets.
def _assert_private_output(path):
    p = os.path.abspath(path).replace(os.sep, "/")
    if "/public" in p or "/assets" in p or "/dist" in p:
        raise SystemExit(
            "❌ ⛔ التقرير المطبوع (فيه بيانات شخصية) مينفعش يتكتب في %s" % path)
    return p

_assert_private_output(OUT_HTML)

def e(s): return html.escape(str(s if s is not None else ""))
def hm(m):
    m = int(round(m or 0))
    if m <= 0: return "—"
    if m < 60: return f"{m} دقيقة"
    h, mm = divmod(m, 60)
    if h < 24: return f"{h} ساعة" + (f" و {mm} دقيقة" if mm else "")
    d, h = divmod(h, 24)
    return f"{d} يوم" + (f" و {h} ساعة" if h else "")
def hms(m):
    m = int(round(m or 0))
    if m <= 0: return "—"
    if m < 60: return f"{m} د"
    h, mm = divmod(m, 60)
    if h < 24: return f"{h} س" + (f" {mm} د" if mm else "")
    d, h = divmod(h, 24)
    return f"{d} ي" + (f" {h} س" if h else "")
def m2h(m):
    m = int(round(m or 0))
    return "—" if m <= 0 else f"{m/60:.1f}".rstrip("0").rstrip(".") + " س"

CSS = """
@page { size: A4; margin: 12mm 11mm 14mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print { html,body { background:#fff !important; } .page{box-shadow:none !important;} }
body { font-family:'Cairo','Tajawal','Noto Sans Arabic',system-ui,sans-serif; direction:rtl;
  color:#16222F; margin:0; background:#EEF2F7; font-size:11px; line-height:1.65; }
.page { max-width:1000px; margin:0 auto; background:#fff; padding:0; }
.cover { background:linear-gradient(135deg,#0B1F33 0%,#132C47 55%,#1B3E63 100%); color:#fff;
  padding:44px 38px 34px; border-radius:0; }
.cover h1 { margin:0 0 6px; font-size:30px; font-weight:700; letter-spacing:-.3px; }
.cover h2 { margin:0 0 18px; font-size:14px; font-weight:400; color:#A9BDD2; }
.cover .meta { display:flex; gap:26px; flex-wrap:wrap; font-size:11px; color:#C9D6E4;
  border-top:1px solid rgba(255,255,255,.16); padding-top:14px; }
.cover .meta b { color:#fff; }
.wrap { padding:26px 38px 40px; }
.sec { margin-bottom:26px; }
.sec.keep { break-inside:avoid-page; }
table { break-inside:auto; }
tr { break-inside:avoid; }
.sec > h2 { font-size:17px; margin:0 0 4px; color:#0B1F33; display:flex; align-items:center; gap:9px; }
.sec > h2::before { content:''; width:5px; height:19px; background:#D4AF37; border-radius:3px; }
.sec > .sub { color:#5B6B7B; font-size:11px; margin:0 0 13px; }
.kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:11px; }
.kpi { background:#F4F7FA; border:1px solid #E2E9F1; border-radius:11px; padding:13px 15px; }
.kpi .k { font-size:10px; color:#5B6B7B; }
.kpi .v { font-size:25px; font-weight:700; color:#0B1F33; line-height:1.25; }
.kpi .s { font-size:9.5px; color:#8A99A8; }
.kpi.gold { background:#FFF8E7; border-color:#F0DFA8; }
.kpi.teal { background:#E9F7F3; border-color:#BFE6DA; }
table { width:100%; border-collapse:collapse; font-size:10px; }
th { background:#132C47; color:#fff; padding:8px 7px; text-align:center; font-weight:600; font-size:9.5px;
  border:1px solid #1E3E63; }
td { padding:6px 7px; border:1px solid #E2E9F1; text-align:center; }
tr:nth-child(even) td { background:#F7FAFC; }
td.r, th.r { text-align:right; }
td.ltr { direction:ltr; text-align:center; font-family:ui-monospace,Menlo,monospace; font-size:9px; }
td.nw, th.nw { white-space:nowrap; }
td.hi { white-space:nowrap; }
td.name { text-align:right; font-weight:600; color:#0B1F33; }
td.hi { font-weight:700; color:#0E7C66; }
tr.top td { background:#FFF8E7 !important; }
.note { background:#FFF8E1; border:1px solid #F0DFA8; border-radius:9px; padding:10px 13px;
  font-size:10px; color:#7A5B00; margin-top:11px; }
.note.bad { background:#FDECEA; border-color:#F5C6C2; color:#8C1D18; }
.note.ok { background:#E9F7F3; border-color:#BFE6DA; color:#0B5D4C; }
.defs { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.def { background:#F7FAFC; border:1px solid #E2E9F1; border-radius:9px; padding:8px 10px; font-size:9.5px; line-height:1.55; }
.def b { color:#0B1F33; }
.def span { color:#5B6B7B; font-size:10px; }
.bars { display:flex; align-items:flex-end; gap:4px; height:110px; padding:8px 4px 0; }
.bars i { flex:1; background:#132C47; border-radius:4px 4px 0 0; position:relative; min-height:2px; }
.bars i.hi { background:#D4AF37; }
.axis { display:flex; gap:4px; padding:5px 4px 0; font-size:8px; color:#8A99A8; }
.axis span { flex:1; text-align:center; }
.funnel { display:flex; flex-direction:column; gap:6px; }
.fstep { display:flex; align-items:center; gap:11px; }
.fstep .lbl { width:190px; font-size:10px; text-align:right; }
.fstep .bar { flex:1; height:23px; background:#E2E9F1; border-radius:6px; overflow:hidden; }
.fstep .bar i { display:block; height:100%; background:linear-gradient(90deg,#132C47,#2E5C8A); }
.fstep .n { width:78px; font-weight:700; font-size:12px; color:#0B1F33; }
.gap { border:1px solid #E2E9F1; border-radius:9px; padding:11px 13px; margin-bottom:8px; break-inside:avoid; }
.gap h4 { margin:0 0 5px; font-size:12px; color:#B3261E; }
.gap p { margin:3px 0; font-size:10px; color:#41525F; }
.gap .st { display:inline-block; margin-top:6px; font-size:9.5px; padding:2px 9px; border-radius:20px; }
.st.done { background:#E9F7F3; color:#0B5D4C; }
.st.wait { background:#FFF8E1; color:#7A5B00; }
.foot { break-inside:avoid; border-top:2px solid #0B1F33; margin-top:26px; padding-top:11px; color:#5B6B7B; font-size:9.5px;
  display:flex; justify-content:space-between; }
.chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:5px; }
.chip { background:#FFF8E7; border:1px solid #F0DFA8; color:#7A5B00; border-radius:20px;
  padding:2px 10px; font-size:10px; font-weight:600; }
"""

P = []
A = P.append

# ═══ الغلاف ═══
A('<div class="page"><div class="cover">')
A('<h1>تقرير زوّار موقع OCTA</h1>')
A(f'<h2>من اتصفّح إيه · قعد قد إيه · آخر ظهور · تفضيلات كل مستخدم</h2>')
A('<div class="meta">')
A(f'<div>تاريخ التقرير<br><b>{e(D["generated_cairo"])}</b></div>')
A(f'<div>لقطة البيانات<br><b>{e(D["snapshot"])}</b></div>')
A(f'<div>المستخدمون<br><b>{K["users"]}</b></div>')
A(f'<div>الزيارات (٣٠ يوم)<br><b>{K["events30"]}</b></div>')
A(f'<div>الوقت الفعلي الكلي<br><b>{K["total_active_h"]} س</b></div>')
A('</div></div>')

A('<div class="wrap">')

# ═══ ١. الأرقام ═══
A('<div class="sec"><h2>١. الأرقام الأساسية</h2>')
A('<p class="sub">كل الأرقام بتوقيت القاهرة. «الوقت الفعلي» هو الوقت اللي المستخدم كان فيه فعلاً — الفترات اللي ساب فيها الموقع مستبعدة.</p>')
A('<div class="kpis">')
cards = [
    ("إجمالي المستخدمين", K["users"], "حساب في النظام", ""),
    ("زيارات آخر ٧ أيام", f'{K["events7"]:,}', "فتح صفحة", ""),
    ("زيارات آخر ٣٠ يوم", f'{K["events30"]:,}', "فتح صفحة", ""),
    ("نسبة الزيارات المنسوبة", "76.7%", "٦٢٦٦ من ٨١٦٥", "gold"),
    ("الوقت الفعلي الكلي", f'{K["total_active_h"]} س', "على كل المستخدمين", "teal"),
    ("متوسط الوقت لكل مستخدم", f'{K["avg_active_h"]} س', "بدون الفترات الخاملة", "teal"),
    ("الجلسات", K["sessions"], "فاصل > ٤٥ د = جلسة جديدة", ""),
    ("نشط آخر ٧ أيام", K["active7"], f'من {K["active30"]} نشط ٣٠ يوم', ""),
    ("دخولات مسجّلة", K["login_events"], "محفوظة في السجل", ""),
    ("بصمات الأجهزة", K["devices"], f'{K["ips"]} عنوان IP', ""),
    ("متابعات أسعار", K["watch_total"], "أسهم ب عليها تنبيه", "gold"),
    ("حطوا باسورد", K["pin_users"], f'من {K["users"]}', ""),
]
for k, v, s, c in cards:
    A(f'<div class="kpi {c}"><div class="k">{e(k)}</div><div class="v">{e(v)}</div><div class="s">{e(s)}</div></div>')
A('</div>')

A('<div class="note ok"><b>⭐ اقرأ الأرقام صح:</b> '
  '«الوقت الكلي» (المدى) رقم أكبر بكتير من «الوقت الفعلي» — لأن المدى بيحسب الأيام كلها '
  'من أول زيارة لآخر زيارة، حتى الأيام اللي المستخدم كان مش موجود فيها. '
  'لما حد ساب الموقع ورجع بعد يومين، المدى بيحسب يومين كأنهم قاعدين. '
  '«الوقت الفعلي» بيقصّ كل فترة خاملة على ٣٠ دقيقة بالكتير — وده الرقم الصح.</div>')
A('</div>')

# ═══ ٢. التعريفات ═══
A('<div class="sec"><h2>٢. إزاي بنحسب الأرقام</h2>')
A('<p class="sub">عشان مفيش رقم في التقرير بلا معنى.</p>')
A('<div class="defs">')
defs = [
    ("الوقت الفعلي", "مجموع الفترات بين أوقات الدخول المتتالية + آخر ظهور، مع سقف ٣٠ دقيقة لكل فترة. أي فترة أكبر من ٣٠ دقيقة معناها المستخدم ساب الموقع ورجع ⇒ بتتقصّ."),
    ("المدى", "من أول ظهور لآخر ظهور. رقم أكبر بكتير لأن فيه أيام كاملة مرّت من غير نشاط."),
    ("الجلسة", "فترة تواصل دخول: فاصل أكبر من ٤٥ دقيقة بين عمليتي دخول = جلسة جديدة."),
    ("آخر ظهور", "آخر مرة فتح فيها المستخدم أي صفحة. ⭐ محسوب من الأحدث بين سجل التتبع وآخر دخول — لأن سجل التتبع لوحده بيتأخر ساعات."),
    ("الجلسات (الحد الأعلى)", "المدة الكلية للجلسة = من أول دخول فيها لبداية الجلسة اللي بعدها. ده حد أعلى مش مدة فعلية."),
    ("نسبة الزيارات المنسوبة", "من ٨١٦٥ زيارة، ٦٢٦٦ (٧٦.٧٪) ليها uid معروف ⇒ الباقي زوار غير مسجّلين."),
    ("زيارات/دقيقة", "كثافة التصفح: صفحة كل X دقيقة. رقم صغير مع زيارات كبيرة = المستخدم بيرجع بسرعة على نفس الصفحات."),
    ("متابعات أسهم", "الأسهم اللي المستخدم حط عليها تنبيه سعر. ده أصدق إشارة تفضيل متاحة لكل مستخدم."),
]
for k, v in defs:
    A(f'<div class="def"><b>{e(k)}</b><br><span>{e(v)}</span></div>')
A('</div></div>')

# ═══ ٣. المستخدمون ═══
A('<div class="sec"><h2>٣. المستخدمون — التفاصيل الكاملة</h2>')
A('<p class="sub">مرتّبين بالوقت الفعلي. اضغط على عمود «الوقت الفعلي» في ملف Excel عشان ترتّب.</p>')
A('<table><thead><tr>'
  '<th class="r">#</th><th class="r">الاسم</th><th class="r">الإيميل</th><th>آخر ظهور</th><th>أول ظهور</th>'
  '<th>الوقت الفعلي</th><th>المدى (يوم)</th><th>الجلسات</th><th>متوسط الجلسة</th>'
  '<th>الزيارات</th><th>زيارات/دقيقة</th><th>الدخولات</th><th>الأجهزة</th><th>IP</th>'
  '<th>متابعات</th><th>باسورد</th><th>نشط ٧د</th></tr></thead><tbody>')
for i, u in enumerate(U, 1):
    dens = round(u["hits"] / u["active_min"], 2) if u["active_min"] else 0
    top = " class=\"top\"" if i <= 3 and u["active_min"] else ""
    A(f'<tr{top}><td>{i}</td><td class="name">{e(u["name"])}</td>'
      f'<td class="r ltr">{e(u["email"] or "— زائر —")}</td>'
      f'<td class="nw">{e(u["last_seen"])}</td><td class="nw">{e(u["first_seen"])}</td>'
      f'<td class="hi">{e(hms(u["active_min"]))}</td>'
      f'<td>{u["gross_span_days"]}</td><td>{u["sessions"]}</td>'
      f'<td class="nw">{e(hms(u["avg_active"]))}</td><td>{u["hits"]}</td><td>{dens}</td>'
      f'<td>{u["login_events"]}</td><td>{u["n_dev"]}</td><td>{u["n_ips"]}</td>'
      f'<td>{u["n_watch"] or "—"}</td><td>{"نعم" if u["pin"] else "لا"}</td>'
      f'<td>{"نشط" if u["a7"] else "—"}</td></tr>')
A('</tbody></table>')
A('<div class="note"><b>الزائر:</b> السطرين «زائر» دول زيارات سجّلها السجل من غير uid — '
  'يعني حد فتح الموقع من غير ما يسجّل دخول (زائر أو تصفح قبل البوابة).</div>')
A('</div>')

# ═══ ٤. الجلسات ═══
A('<div class="sec"><h2>٤. كل جلسة على حدة — قعد إمتى قد إيه</h2>')
A('<p class="sub">«نهاية الجلسة» الحد الأعلى · «الوقت الفعلي» بعد استبعاد الفترات الخاملة.</p>')
A('<table><thead><tr><th class="r">#</th><th class="r">المستخدم</th><th>بداية الجلسة</th>'
  '<th>نهاية الجلسة (الحد الأعلى)</th><th>المدة الكلية (د)</th><th>الوقت الفعلي (د)</th>'
  '<th>دخولات</th><th class="r">طريقة الدخول</th><th class="r">الجهاز</th><th class="r">عنوان IP</th>'
  '<th class="r">الحد</th></tr></thead><tbody>')
rows = []
for u in U:
    for s in u["srows"]:
        rows.append((u["name"], s))
rows.sort(key=lambda x: -x[1]["start_ts"])
for i, (nm, s) in enumerate(rows, 1):
    bnd = "مقيس" if s["bound"] == "مقيس" else "تقديري"
    A(f'<tr><td>{i}</td><td class="name">{e(nm)}</td><td>{e(s["start"])}</td><td>{e(s["end"])}</td>'
      f'<td>{s["gross_min"]}</td><td class="hi">{s["active_min"]}</td><td>{s["logins"]}</td>'
      f'<td class="r">{" · ".join(s["vias"]) or "—"}</td>'
      f'<td class="r ltr">{" · ".join(s["devs"]) or "—"}</td>'
      f'<td class="r ltr">{" · ".join(s["ips"]) or "—"}</td><td class="r">{bnd}</td></tr>')
A('</tbody></table></div>')

# ═══ ٥. التفضيلات ═══
A('<div class="sec"><h2>٥. تفضيلات كل مستخدم — الأسهم اللي بيتابعها</h2>')
A('<p class="sub">المصدر: تنبيهات الأسعار في حساب كل مستخدم (مُسجَّلة بإيميل المستخدم).</p>')
any_w = False
A('<table><thead><tr><th class="r">المستخدم</th><th class="r">الإيميل</th><th>الكود</th>'
  '<th>السعر الأعلى</th><th>السعر الأدنى</th><th>وقت الإضافة</th><th>عدد متابعاته</th></tr></thead><tbody>')
for u in U:
    if not u["watch"]: continue
    any_w = True
    for w in u["watch"]:
        ts = ""
        if w.get("at"):
            ts = datetime.datetime.utcfromtimestamp(int(w["at"]) + 7200).strftime("%Y-%m-%d %H:%M")
        A(f'<tr><td class="name">{e(u["name"])}</td><td class="r ltr">{e(u["email"])}</td>'
          f'<td><b>{e(w["code"])}</b></td><td>{e(w.get("hi") or "—")}</td><td>{e(w.get("lo") or "—")}</td>'
          f'<td>{e(ts or "—")}</td><td>{u["n_watch"]}</td></tr>')
A('</tbody></table>')
A(f'<div class="note">⭐ <b>المتابعة:</b> {sum(1 for u in U if u["n_watch"])} من {len(U)} مستخدم بس عندهم متابعة أسهم. '
  'الباقي مفيش عندهم أي مؤشر تفضيل — لأن الواجهة مبعتهش أحداث الفلاتر (actions = 0 خلال ٩٠ يوم).</div>')
A('<div class="note bad"><b>⛔ اللي مش متاح لسه:</b> «الفلتر اللي المستخدم بيحبه» بالظبط '
  '(الفلتر الفني بفلتراته) — لأن (١) أحداث الفلاتر مبعوتش من الواجهة أصلاً، '
  '(٢) مسار السجل الخام <code>/api/admin/events</code> لسه مش منشور على السيرفر (المسار مكتوب ومختبر). '
  'أول ما الاتنين يتقفلوا، التقرير هيعرف: كل مستخدم فتح أنهي صفحة قد إيه، وأهي الفلتر اللي بيستخدمه.</div>')
A('</div>')

# ═══ ٦. الخط الزمني ═══
A('<div class="sec"><h2>٦. الخط الزمني للدخول</h2>')
A('<p class="sub">كل عمليات الدخول مرتّبة من الأحدث.</p>')
A('<table><thead><tr><th>الوقت</th><th class="r">المستخدم</th><th class="r">الإيميل</th>'
  '<th>طريقة الدخول</th><th class="r">بصمة الجهاز</th><th class="r">عنوان IP</th>'
  '<th>جهاز جديد</th><th>النوع</th></tr></thead><tbody>')
for i, ev in enumerate(D["timeline"], 1):
    A(f'<tr><td class="nw">{e(ev["ts"])}</td><td class="name">{e(ev["name"])}</td>'
      f'<td class="r ltr">{e(ev["email"] or "— زائر —")}</td><td>{e(ev["via"] or "—")}</td>'
      f'<td class="r ltr">{e(ev["dev"] or "—")}</td><td class="r ltr">{e(ev["ip"] or "—")}</td>'
      f'<td>{"نعم" if ev["newdev"] else "لا"}</td><td>{"زائر" if ev["guest"] else "مسجّل"}</td></tr>')
A('</tbody></table></div>')

# ═══ ٧. الأجهزة والـIPs ═══
A('<div class="sec"><h2>٧. الأجهزة وعناوين الدخول</h2>')
A('<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">')
A('<div><h3 style="font-size:13px;margin:0 0 8px">بصمات الأجهزة</h3><table><thead><tr>'
  '<th class="r">البصمة</th><th>مستخدمين</th><th>دخولات</th><th>أول ظهور</th><th>آخر ظهور</th></tr></thead><tbody>')
for d in D["devices"]:
    A(f'<tr><td class="r ltr">{e(d["dev"])}</td><td>{len(d["users"])}</td><td>{d["logins"]}</td>'
      f'<td class="nw">{e(d["first"])}</td><td class="nw">{e(d["last"])}</td></tr>')
A('</tbody></table></div>')
A('<div><h3 style="font-size:13px;margin:0 0 8px">عناوين IP</h3><table><thead><tr>'
  '<th class="r">العنوان</th><th>مستخدمين</th><th>دخولات</th><th>أجهزة</th></tr></thead><tbody>')
for x in D["ips"]:
    A(f'<tr><td class="r ltr">{e(x["ip"])}</td><td>{len(x["users"])}</td><td>{x["logins"]}</td><td>{x["devs"]}</td></tr>')
A('</tbody></table></div></div>')
A('<div class="note">⭐ <b>٦ عناوين IP من ١١ مستخدم</b> — ده IP الـCloudflare الموحّد لحد كبير '
  '(٧٩.١٢٧.١٧٨.٨١ و ٨٢ هما عناوين Cloudflare مش عناوين المستخدم الحقيقية). '
  '⇒ متابعة الجهاز (بصمة المتصفح) أدق من الـIP في تحديد هوية المستخدم.</div>')
A('</div>')

# ═══ ٨. الصفحات ═══
A('<div class="sec"><h2>٨. الصفحات الأكثر استخداماً</h2>')
A('<p class="sub">من ٨٠١٨ زيارة في آخر ٣٠ يوم (لكل المستخدمين).</p>')
tot = K["events30"] or 1
mx = max(n for _, n in K["pages"])
PG = {"stocks": "صفحة الأسهم الرئيسية", "filter": "الفلتر الفني", "arms": "فلتر الأذرع",
      "screener": "الشاشة (بحث متقدم)", "dash": "لوحة التحكم", "radar": "الرادار الذكي",
      "engine": "محرك التقييم", "markets": "عمق السوق", "money": "محفظة المال",
      "setups": "الإعدادات والخطط", "octasearch": "البحث في الأسهم", "dividends": "التوزيعات والأرباح",
      "newsaxis": "محور الأخبار", "studio": "الاستوديو", "zones": "مناطق السوق", "challenges": "التحديات"}
A('<table><thead><tr><th>الترتيب</th><th class="r">الصفحة</th><th class="r">الوظيفة</th>'
  '<th>الزيارات</th><th>النسبة</th><th class="r">المقارنة</th></tr></thead><tbody>')
for i, (p, n) in enumerate(K["pages"], 1):
    w = int(n / mx * 100)
    A(f'<tr><td>{i}</td><td class="name">{e(p)}</td><td class="r">{e(PG.get(p, ""))}</td>'
      f'<td><b>{n}</b></td><td>{n/tot*100:.1f}%</td>'
      f'<td class="r"><div style="background:#132C47;height:9px;width:{w}%;border-radius:4px"></div></td></tr>')
A('</tbody></table>')
A('<div class="note bad">⛔ <b>التوزيع لكل مستخدم على حدة مش متاح لسه</b> — '
  'محتاج مسار السجل الخام على السيرفر. المتاح دلوقتي: الترتيب العام لكل المستخدمين.</div>')
A('</div>')

# ═══ ٩. السلوك ═══
A('<div class="sec"><h2>٩. متى الناس بتيجي</h2>')
A('<p class="sub">عدد عمليات الدخول في كل ساعة (بتوقيت القاهرة).</p>')
mxh = max(D["hourly"]) or 1
A('<div class="bars">')
for i, v in enumerate(D["hourly"]):
    A(f'<i class="{"hi" if v == mxh else ""}" style="height:{max(2, int(v/mxh*100))}%" title="{i}:00 → {v}"></i>')
A('</div>')
A('<div class="axis">' + "".join(f'<span>{i}</span>' for i in range(24)) + '</div>')
A(f'<div class="note"><b>أعلى ساعة دخول: {D["hourly"].index(mxh):02d}:00</b> '
  f'(عدد {mxh}) · أهدأ ساعة: {D["hourly"].index(min(D["hourly"])):02d}:00. '
  'نسبة كبيرة من الدخولات بتيجي بالليل — وده معناه إن الاستخدام بيحصل وقت فراغ.</div>')
A('</div>')

# ═══ ١٠. القمع ═══
A('<div class="sec"><h2>١٠. رحلة المستخدم — من الزيارة لحد الاستخدام</h2>')
A('<p class="sub">فين الناس بتضيع.</p>')
A('<div class="funnel">')
mxn = max(f["n"] for f in D["funnel"]) or 1
NOTES = ["كل فتحات الصفحات المسجّلة", "زيارات ليها uid معروف", "حسابات في النظام",
         "حسابات عملت باسورد (PIN)", "حسابات عندها دخول مسجّل", "نشطين آخر ٧ أيام"]
for i, f in enumerate(D["funnel"]):
    w = int(f["n"] / mxn * 100)
    A(f'<div class="fstep"><div class="lbl">{e(f["step"])}</div>'
      f'<div class="bar"><i style="width:{w}%"></i></div>'
      f'<div class="n">{f["n"]:,}</div><div class="lbl" style="width:190px;font-size:9px;color:#8A99A8">{e(NOTES[i])}</div></div>')
A('</div>')
A('<div class="note">⭐ <b>نقطة التسريب الأساسية:</b> ١٨٩٩ من ٨١٦٥ زيارة (٢٣.٣٪) مالهاش uid. '
  'السبب: <code>window.OCTA_USER_ID</code> بيتحدد مرة واحدة بعد الدخول وبيتمسح مع أي تحديث للصفحة. '
  'الحل جاهز سطرين في الواجهة ⇒ التسبة تروح ~١٠٠٪.</div>')
A('</div>')

# ═══ ١١. الفجوات ═══
A('<div class="sec"><h2>١١. الفجوات المعروفة — إيه اللي ناقص وإزاي يتقفل</h2>')
GAPS = [
    ("«آخر ظهور» كان بيتأخر ساعات", "سجل التتبع بيتحدّث بس لو الـuid موجود في الحدث، والـuid بيمسح بعد الـrefresh",
     "التقرير بيقول إن المستخدم ظهر ١٠ ساعات قبل ما يفعّل فعلاً",
     "الأولوية: (١) تثبيت الـuid في localStorage في الواجهة (سطرين) — (٢) تصحيح سطر ١٤٠٨٤ في الباك",
     "wait", "تم إصلاح الحساب في التقرير؛ التصحيح في الواجهة جاهز للنشر"),
    ("الزيارات مش منسوبة لمستخدم (٢٣.٣٪)", "١٨٩٩ من ٨١٦٥ زيارة بدون uid",
     "مش بنعرف مين فتح إيه", "تثبيت الـuid في localStorage (سطرين في octa-auth.js)",
     "wait", "جاهز — محتاج نشر على الدومين"),
    ("السجل الخام للأحداث مش موجود", "/api/admin/events ⇒ 405 على السيرفر",
     "مش بنعرف قعد على أنهي صفحة قد إيه", "المسار مكتوب ومختبر (٥ اختبارات) — محتاج push على octa-prices",
     "wait", "جاهز — محتاج صلاحية GitHub"),
    ("أحداث الفلاتر مش مبعوتة أصلاً", "actions = 0 خلال ٩٠ يوم",
     "مش بنعرف أنهي فلتر المستخدم بيحبه", "octaTrack('action', ...) مع كل فلتر في الواجهة",
     "wait", "جاهز — محتاج نشر على الدومين"),
    ("مقياس الوقت في السيرفر غلط", "session_min = آخر ظهور − أول ظهور ⇒ ١١٢ ساعة لأحمد",
     "المستخدم يبان قاعد ١١٢ ساعة وهو قاعد ٦",
     "المقياس اتصلّح في هذا التقرير (سقف ٣٠ دقيقة) + تصحيح السطر ١٤٠٨٤ في الباك",
     "done", "اتصلّح في التقرير"),
    ("قائمة منبهات الأسعار بتتكرر", "update_prices.py:12583 — w_list جوّه اللوب ⇒ ٦ أسهم = ٣٦ سطر",
     "التقرير كان هيعرض تكرار",
     "اتمنع التكرار في طبقة التطبيق (Worker) + التوثيق هنا",
     "done", "اتصلّح في التطبيق"),
    ("زوار غير مسجّلين", "١٧٠٠ زائر فريد في ٩٠ يوم",
     "زيارات بتضيع من التحليل", "بوابة الدخول عندها + ربط الـuid بالكوكي",
     "done", "البوابة شغالة على الدومين"),
    ("عناوين IP مش مقفولة", "٦ عناوين من ١١ مستخدم (وده IP Cloudflare)",
     "ممكن حد يشارك حسابه", "قفل الأجهزة + مراجعة على أساس البصمة",
     "wait", "قرار مطلوب من المالك"),
    ("اختبار الـCI كان سطحي", "ast.parse بس — باگين اتنين عدّوا",
     "باگ production اتكسر مرتين", "tools/live-test.py داخل الـCI (٥٧ ⇒ ٦٨ assertion)",
     "done", "اتصلّح"),
]
for title, ev, impact, fix, st, stt in GAPS:
    A(f'<div class="gap"><h4>{e(title)}</h4>'
      f'<p><b>الدليل:</b> {e(ev)}</p><p><b>الأثر:</b> {e(impact)}</p>'
      f'<p><b>الحل:</b> {e(fix)}</p>'
      f'<span class="st {st}">{e(stt)}</span></div>')
A('</div>')

# ═══ ١٢. الخلاصة ═══
A('<div class="sec"><h2>١٢. الخلاصة</h2>')
A('<div class="note ok">'
  '<b>١.</b> الموقع بيستخدمه ناس حقيقية: ١١ من ١٣ حساب نشطين آخر ٣٠ يوم، '
  'وأحمد لوحده ٥٤٨٢ زيارة (٦٧٪ من كل زيارات الموقع).<br><br>'
  '<b>٢.</b> الوقت الفعلي الكلي ≈ ١١ ساعة موزّعة على ٢٣ جلسة — وده الرقم الصادق '
  '(بدل ١١٢ ساعة لواحد لوحده اللي كان المقياس القديم بيطلّعها).<br><br>'
  '<b>٣.</b> أكتر الصفحات استخداماً: الأسهم (٩٢٠) ثم الفلتر الفني (٥٨٣) ثم فلتر الأذرع (٥٤٦). '
  'يعني الفلتر هو الأداة اللي الناس بترجع ليها تاني — يستاهل أولوية التطوير.<br><br>'
  '<b>٤.</b> فيه ٤ مستخدمين حطوا باسورد وما رجعوشش (تسجيل بدون تفعيل). '
  'والدخول بيحصل بالليل (٠٠:٠٠–٠٤:٥٩) أكتر من أي وقت تاني.<br><br>'
  '<b>٥.</b> أكتر خطوة مطلوبة دلوقتي: نشر إصلاح الـuid في الواجهة (سطرين) '
  '⇒ «آخر ظهور» يبقى لحظي و٢٣٪ من الزيارات ترجع منسوبة لمستخدمين.'
  '</div>')
A('</div>')

# ⛔ فوتر HTML اتشال — فوتر Chromium (لكل صفحة + رقم الصفحة) بيعمل نفس الحاجة
A('</div></div>')

html_out = (f'<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>تقرير زوّار OCTA — {e(D["generated_cairo"])}</title>'
            f'<link rel="preconnect" href="https://fonts.googleapis.com">'
            f'<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">'
            f'<style>{CSS}</style></head><body>' + "\n".join(P) + '</body></html>')

open(OUT_HTML, "w", encoding="utf-8").write(html_out)
print("✅", OUT_HTML, f"({len(html_out)//1024} ك.ب)")

# ═══ PDF ═══
from playwright.sync_api import sync_playwright
OUT_PDF = "/workspace/output/OCTA-VISITORS-REPORT-2026-11-14.pdf"
with sync_playwright() as pw:
    EXE = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
    b = pw.chromium.launch(executable_path=EXE, args=["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"])
    pg = b.new_page()
    pg.goto("file://" + OUT_HTML, wait_until="networkidle", timeout=90000)
    pg.wait_for_timeout(2500)
    FOOT = ('<div style="width:100%;font-family:Cairo,sans-serif;font-size:8px;color:#5B6B7B;'
            'padding:0 9mm;display:flex;justify-content:space-between;">'
            '<span>تقرير زوّار OCTA · لقطة ' + e(D["snapshot"]) + '</span>'
            '<span>صفحة <span class=pageNumber></span> من <span class=totalPages></span></span></div>')
    pg.pdf(path=OUT_PDF, format="A4", print_background=True, display_header_footer=True,
           header_template="<div></div>", footer_template=FOOT,
           margin={"top": "9mm", "bottom": "14mm", "left": "9mm", "right": "9mm"})
    b.close()
print("✅", OUT_PDF, f"({os.path.getsize(OUT_PDF)//1024} ك.ب)")
