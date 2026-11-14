#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""📗 باني ملف Excel الاحترافي — تقرير زوار OCTA (RTL · عربي · منسّق)"""
import json, datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import DataBarRule, ColorScaleRule
from openpyxl.worksheet.table import Table, TableStyleInfo

D = json.load(open("/workspace/output/octa-report-data.json", encoding="utf-8"))
K, U = D["kpi"], D["users"]
OUT = "/workspace/output/OCTA-VISITORS-REPORT-2026-11-14.xlsx"

# ─────── ألوان الهوية ───────
GOLD = "D4AF37"; DARK = "0B1F33"; NAVY = "132C47"; INK = "1B2733"
MUTED = "5B6B7B"; LINE = "D6DEE8"; SOFT = "F4F7FA"; MINT = "0E7C66"; RED = "B3261E"
THIN = Side(style="thin", color=LINE)
BORD = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

F_TITLE = Font(name="Arial", size=20, bold=True, color="FFFFFF")
F_SUB   = Font(name="Arial", size=10, color="C9D6E4")
F_HEAD  = Font(name="Arial", size=10, bold=True, color="FFFFFF")
F_BODY  = Font(name="Arial", size=10, color=INK)
F_BOLD  = Font(name="Arial", size=10, bold=True, color=INK)
F_BIG   = Font(name="Arial", size=18, bold=True, color=DARK)
F_LBL   = Font(name="Arial", size=9, color=MUTED)
F_SEC   = Font(name="Arial", size=12, bold=True, color=DARK)

AL_R   = Alignment(horizontal="right", vertical="center", wrap_text=True)
AL_RT  = Alignment(horizontal="right", vertical="top", wrap_text=True)
AL_C   = Alignment(horizontal="center", vertical="center", wrap_text=True)
AL_L   = Alignment(horizontal="left", vertical="center", wrap_text=True)

def sheet(wb, name, title, subtitle, widths, tab=GOLD):
    ws = wb.create_sheet(name)
    ws.sheet_view.rightToLeft = True
    ws.sheet_properties.tabColor = tab
    n = len(widths)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=n)
    c = ws.cell(1, 1, title); c.font = F_TITLE; c.fill = PatternFill("solid", fgColor=DARK)
    c.alignment = Alignment(horizontal="right", vertical="center", indent=1)
    ws.row_dimensions[1].height = 38
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=n)
    c = ws.cell(2, 1, subtitle); c.font = F_SUB; c.fill = PatternFill("solid", fgColor=NAVY)
    c.alignment = Alignment(horizontal="right", vertical="center", indent=1)
    ws.row_dimensions[2].height = 22
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[3].height = 6
    return ws

def header(ws, row, labels, fill=NAVY, height=30):
    for i, t in enumerate(labels, 1):
        c = ws.cell(row, i, t); c.font = F_HEAD; c.fill = PatternFill("solid", fgColor=fill)
        c.alignment = AL_C; c.border = BORD
    ws.row_dimensions[row].height = height
    return row + 1

def putrow(ws, row, vals, aligns=None, fonts=None, fill=None, fmts=None, h=None):
    for i, v in enumerate(vals, 1):
        c = ws.cell(row, i, v)
        c.font = (fonts[i-1] if fonts and fonts[i-1] else F_BODY)
        c.alignment = (aligns[i-1] if aligns and aligns[i-1] else AL_R)
        c.border = BORD
        if fill: c.fill = PatternFill("solid", fgColor=fill)
        if fmts and fmts[i-1]: c.number_format = fmts[i-1]
    if h: ws.row_dimensions[row].height = h
    return row + 1

def sect(ws, row, text, ncol, color=SOFT):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncol)
    c = ws.cell(row, 1, text); c.font = F_SEC; c.fill = PatternFill("solid", fgColor=color)
    c.alignment = Alignment(horizontal="right", vertical="center", indent=1)
    ws.row_dimensions[row].height = 26
    return row + 1

def note(ws, row, text, ncol, color="FFF8E1"):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncol)
    c = ws.cell(row, 1, text); c.font = Font(name="Arial", size=9, color="7A5B00")
    c.fill = PatternFill("solid", fgColor=color); c.border = BORD
    c.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True, indent=1)
    ws.row_dimensions[row].height = 30
    return row + 1

def hm(m):
    m = int(round(m or 0))
    if m <= 0: return "—"
    if m < 60: return f"{m} دقيقة"
    h, mm = divmod(m, 60)
    if h < 24: return f"{h} ساعة" + (f" و {mm} دقيقة" if mm else "")
    d, h = divmod(h, 24)
    return f"{d} يوم" + (f" و {h} ساعة" if h else "")

def m2h(m):
    m = int(round(m or 0))
    if m <= 0: return "—"
    return f"{m/60:.1f}".rstrip("0").rstrip(".") + " س"

wb = Workbook(); wb.remove(wb.active)

# ═══════════════ شيت ١ — الملخص التنفيذي ═══════════════
ws = sheet(wb, "١. الملخص التنفيذي", "📊 تقرير زوّار OCTA — الملخص التنفيذي",
           f"تاريخ التقرير: {D['generated_cairo']} · لقطة البيانات: {D['snapshot']} · كل الأوقات بتوقيت القاهرة",
           [34, 22, 22, 22, 22, 22])
r = 4
r = sect(ws, r, "الأرقام الأساسية", 6)
cards = [
    ("إجمالي المستخدمين", K["users"], "حساب في النظام"),
    ("زيارات آخر ٧ أيام", K["events7"], "فتح صفحة"),
    ("زيارات آخر ٣٠ يوم", K["events30"], "فتح صفحة"),
    ("نسبة الزيارات المنسوبة", "76.7%", "لها uid معروف"),
    ("الوقت الفعلي الكلي", f'{K["total_active_h"]} س', "على كل المستخدمين"),
    ("متوسط الوقت لكل مستخدم", f'{K["avg_active_h"]} س', "بدون الفترات الخاملة"),
]
c0 = 1
for i, (lbl, val, sub) in enumerate(cards):
    col = c0 + (i % 3) * 2
    row = r + (i // 3) * 3
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+1)
    c = ws.cell(row, col, lbl); c.font = F_LBL; c.alignment = AL_R
    ws.merge_cells(start_row=row+1, start_column=col, end_row=row+1, end_column=col+1)
    c = ws.cell(row+1, col, val); c.font = F_BIG; c.alignment = AL_C
    c.fill = PatternFill("solid", fgColor=SOFT); c.border = BORD
    ws.merge_cells(start_row=row+2, start_column=col, end_row=row+2, end_column=col+1)
    c = ws.cell(row+2, col, sub); c.font = F_LBL; c.alignment = AL_C
    ws.row_dimensions[row+1].height = 30
r += 6

r = sect(ws, r, "حركة الاستخدام", 6)
r = header(ws, r, ["المؤشر", "القيمة", "المؤشر", "القيمة", "المؤشر", "القيمة"], fill=NAVY)
rows = [
    ("الجلسات (تواصل دخول)", K["sessions"], "دخولات مسجّلة", K["login_events"], "بصمات الأجهزة", K["devices"]),
    ("عناوين IP مختلفة", K["ips"], "مستخدمين عندهم باسورد", K["pin_users"], "نشط آخر ٧ أيام", K["active7"]),
    ("متابعات أسعار (أسهم)", K["watch_total"], "زيارات ٣٠ يوم", K["events30"], "زيارات ٧ يوم", K["events7"]),
]
for a, b, cc, dd, e, f in rows:
    r = putrow(ws, r, [a, b, cc, dd, e, f],
               aligns=[AL_R, AL_C, AL_R, AL_C, AL_R, AL_C], fonts=[F_BODY, F_BOLD, F_BODY, F_BOLD, F_BODY, F_BOLD])
r += 1

r = sect(ws, r, "إزاي بنحسب الأرقام دي (مهم)", 6)
defs = [
    ("الوقت الفعلي", "مجموع الفترات بين أوقات الدخول المتتالية + آخر ظهور، مع سقف ٣٠ دقيقة لكل فترة. أي فترة أكبر من ٣٠ دقيقة معناها المستخدم ساب الموقع ورجع ⇒ بتتقصّ من ٣٠ دقيقة بس. ده اللي بيشيل تضخيم «فتح وساب»."),
    ("المدى", "من أول ظهور لآخر ظهور (كل الأيام اللي مرّت). رقم أكبر بكتير من الوقت الفعلي لأن فيه أيام المستخدم كان مش موجود فيها."),
    ("الجلسة", "فترة تواصل دخول: فاصل أكبر من ٤٥ دقيقة بين عمليتي دخول = جلسة جديدة."),
    ("آخر ظهور", "آخر مرة فتح فيها المستخدم أي صفحة (مش آخر تسجيل دخول) — وده أدق مقياس للحضور."),
    ("نسبة الزيارات المنسوبة", "من ٨١٦٥ زيارة، ٦٢٦٦ (٧٦.٧٪) ليها uid معروف ⇒ الباقي زوار غير مسجّلين."),
]
for k, v in defs:
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
    c = ws.cell(r, 1, k); c.font = F_BOLD; c.alignment = AL_R; c.border = BORD
    ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=6)
    c = ws.cell(r, 3, v); c.font = F_BODY; c.alignment = AL_RT; c.border = BORD
    ws.row_dimensions[r].height = 34
    r += 1
r += 1

r = sect(ws, r, "أعلى ٥ مستخدمين بالوقت الفعلي", 6)
r = header(ws, r, ["#", "المستخدم", "الوقت الفعلي", "الزيارات", "الجلسات", "آخر ظهور"], fill=NAVY)
for i, u in enumerate([x for x in U if x["active_min"] > 0][:5], 1):
    r = putrow(ws, r, [i, u["name"], hm(u["active_min"]), u["hits"], u["sessions"], u["last_seen"]],
               aligns=[AL_C, AL_R, AL_C, AL_C, AL_C, AL_C],
               fonts=[F_BODY, F_BOLD, F_BOLD, F_BODY, F_BODY, F_BODY], fill=(SOFT if i % 2 else None))
r += 1

r = sect(ws, r, "أكثر الصفحات استخداماً (لكل المستخدمين)", 6)
r = header(ws, r, ["#", "الصفحة", "الزيارات", "النسبة من ٣٠ يوم", "الترتيب في السجل", "ملاحظة"], fill=NAVY)
tot30 = K["events30"] or 1
for i, (p, n) in enumerate(K["pages"], 1):
    r = putrow(ws, r, [i, p, n, f"{n/tot30*100:.1f}%", "—", ""],
               aligns=[AL_C, AL_R, AL_C, AL_C, AL_C, AL_R],
               fill=(SOFT if i % 2 else None))
r += 1
r = note(ws, r, "⛔ الأرقام دي كل المستخدمين مجتمعين — التوزيع لكل مستخدم على حدة محتاج «مسار السجل الخام» على السيرفر (شغل جاهز · محتاج صلاحية GitHub). شوف شيت «الفجوات والحلول».", 6)

# ═══════════════ شيت ٢ — المستخدمون ═══════════════
W = [5, 22, 30, 17, 17, 13, 12, 11, 10, 12, 13, 10, 11, 11, 10, 12, 13, 10, 10, 12]
ws = sheet(wb, "٢. المستخدمون", "👥 المستخدمون — التفاصيل الكاملة",
           "مرتّبين بالوقت الفعلي · «الوقت الفعلي» =Browsing بلا فترات خاملة · «المدى» = من أول ظهور لآخر ظهور",
           W)
hdr = ["#", "الاسم", "الإيميل", "آخر ظهور", "أول ظهور", "الوقت الفعلي", "بالساعة", "المدى (يوم)",
       "الجلسات", "متوسط الجلسة", "الزيارات", "زيارات/دقيقة", "دخولات", "أجهزة", "IP", "أجهزة جديدة",
       "متابعات أسهم", "باسورد", "نشط ٧د", "نشط ٣٠د"]
r = 4
r = header(ws, r, hdr)
first = r
for i, u in enumerate(U, 1):
    dens = (u["hits"] / u["active_min"]) if u["active_min"] else 0
    avg = hm(u["avg_active"])
    r = putrow(ws, r, [
        i, u["name"], u["email"] or "— زائر —", u["last_seen"], u["first_seen"],
        hm(u["active_min"]), m2h(u["active_min"]), u["gross_span_days"],
        u["sessions"], avg, u["hits"], round(dens, 2), u["login_events"],
        u["n_dev"], u["n_ips"], u["newdev"],
        u["n_watch"], "نعم" if u["pin"] else "لا",
        "نشط" if u["a7"] else "—", "نشط" if u["a30"] else "—",
    ], aligns=[AL_C, AL_R, AL_R, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C, AL_C],
       fonts=[F_BODY, F_BOLD, F_BODY, F_BOLD, F_BODY, F_BOLD, F_BOLD, F_BODY, F_BODY, F_BODY, F_BOLD, F_BODY, F_BODY, F_BODY, F_BODY, F_BODY, F_BODY, F_BODY, F_BODY, F_BODY],
       fill=(SOFT if i % 2 else None), h=20)
last = r - 1
ws.auto_filter.ref = f"A{first-1}:{get_column_letter(len(W))}{last}"
ws.freeze_panes = f"D{first}"
ws.conditional_formatting.add(f"F{first}:F{last}",
    DataBarRule(start_type="num", start_value=0, end_type="max", color=GOLD))
ws.conditional_formatting.add(f"K{first}:K{last}",
    DataBarRule(start_type="num", start_value=0, end_type="max", color="6FA8DC"))
r += 1
r = note(ws, r, "⭐ عمود «الوقت الفعلي» هو اللي بيديك الإجابة على «قعد يتصفح قد إيه» — بيتجاهل الفترات اللي المستخدم ساب فيها الموقع. عمود «المدى» رقم أكبر لأن فيه أيام كاملة مرّت من غير نشاط.", len(W))
r = note(ws, r, "⭐ عمود «زيارات/دقيقة» = كثافة التصفح (صفحة كل X دقيقة). رقم صغير مع زيارات كبيرة = المستخدم بيرجع بسرعة على نفس الصفحات.", len(W), color="E8F5F2")

# ═══════════════ شيت ٣ — الجلسات ═══════════════
ws = sheet(wb, "٣. الجلسات", "⏱ كل جلسة على حدة — مين قعد إمتى قد إيه",
           "«نهاية الجلسة» = الحد الأقصى (بداية الجلسة اللي بعدها) · «الوقت الفعلي» = بعد استبعاد الفترات الخاملة (سقف ٣٠ دقيقة)",
           [5, 22, 18, 20, 13, 13, 11, 16, 18, 20, 26])
r = 4
r = header(ws, r, ["#", "المستخدم", "بداية الجلسة", "نهاية الجلسة (الحد الأقصى)", "المدة الكلية (د)",
                   "الوقت الفعلي (د)", "دخولات", "طريقة الدخول", "بصمة الجهاز", "عنوان IP", "ملاحظة"])
sess_rows = []
for u in U:
    for s in u["srows"]:
        sess_rows.append((u["name"], s))
sess_rows.sort(key=lambda x: -x[1]["start_ts"])
first = r
for i, (nm, s) in enumerate(sess_rows, 1):
    bnd = "مقيس (آخر ظهور)" if s["bound"] == "مقيس" else "تقديري (الحد الأقصى)"
    r = putrow(ws, r, [
        i, nm, s["start"], s["end"], s["gross_min"], s["active_min"], s["logins"],
        " · ".join(s["vias"]) or "—", " · ".join(s["devs"]) or "—", " · ".join(s["ips"]) or "—", bnd,
    ], aligns=[AL_C, AL_R, AL_C, AL_C, AL_C, AL_C, AL_C, AL_R, AL_R, AL_R, AL_R],
       fonts=[F_BODY, F_BOLD, F_BODY, F_BODY, F_BODY, F_BOLD, F_BODY, F_BODY, F_BODY, F_BODY, F_BODY],
       fill=(SOFT if i % 2 else None), h=20)
last = r - 1
ws.auto_filter.ref = f"A{first-1}:{get_column_letter(11)}{last}"
ws.freeze_panes = f"C{first}"
ws.conditional_formatting.add(f"F{first}:F{last}",
    DataBarRule(start_type="num", start_value=0, end_type="max", color=MINT))
r += 1
r = note(ws, r, "⭐ «الوقت الفعلي» لكل جلسة = الوقت اللي المستخدم كان فيه فعلاً (الفجوات الداخلية + آخر ٣٠ دقيقة كحد أقصى). «المدة الكلية» هي الحد الزمني الأوسع وهتكون أكبر بكتير.", 11)

# ═══════════════ شيت ٤ — متابعة الأسهم (المفضّلة) ═══════════════
ws = sheet(wb, "٤. متابعة الأسهم", "⭐ تفضيلات كل مستخدم — الأسهم اللي بيتابعها",
           "المصدر: تنبيهات الأسعار في حساب كل مستخدم (مُسجَّلة بإيميل المستخدم) · اتقرأ بإصدار جلسة إدارية مؤقتة",
           [22, 30, 14, 14, 14, 16, 18, 40])
r = 4
r = header(ws, r, ["المستخدم", "الإيميل", "كود السهم", "السعر الأعلى", "السعر الأدنى",
                   "وقت الإضافة", "عدد متابعاته", "ملاحظة"])
any_w = False
for u in U:
    if not u["watch"]: continue
    any_w = True
    for i, w in enumerate(u["watch"], 1):
        ts = ""
        if w.get("at"):
            ts = datetime.datetime.utcfromtimestamp(int(w["at"]) + 7200).strftime("%Y-%m-%d %H:%M")
        r = putrow(ws, r, [u["name"], u["email"] or "—", w["code"], w.get("hi") or "—",
                           w.get("lo") or "—", ts or "—", u["n_watch"],
                           f"النطاق {w.get('lo')} ← {w.get('hi')}" if w.get("hi") else ""],
                   aligns=[AL_R, AL_R, AL_C, AL_C, AL_C, AL_C, AL_C, AL_R],
                   fonts=[F_BOLD, F_BODY, F_BOLD, F_BODY, F_BODY, F_BODY, F_BODY, F_BODY],
                   fill=(SOFT if i % 2 else None))
if not any_w:
    r = putrow(ws, r, ["—", "—", "—", "—", "—", "—", 0, "مفيش متابعات"], aligns=[AL_R]*8)
r += 1
r = note(ws, r, "⭐ دي إشارة التفضيل الحقيقية المتاحة لكل مستخدم: الأسهم اللي حط عليها تنبيه سعر. ١١ من ١٣ مستخدم مفيش عندهم متابعة.", 8)
r = note(ws, r, "⛔ «الفلتر اللي المستخدم بيحبه» بالظبط (الفلتر الفني بفلتراته) لسه مش متاح — لأن الواجهة مبعتهش أحداث الفلاتر أصلاً (actions = 0). الحل جاهز: إضافة سطرين في الواجهة + نشر مسار السجل الخام.", 8, color="FDECEA")

# ═══════════════ شيت ٥ — الخط الزمني للدخول ═══════════════
ws = sheet(wb, "٥. الخط الزمني للدخول", "📜 كل عمليات الدخول — بالترتيب الزمني",
           "المصدر: سجل الدخول في الخادم (آخر ٥٠ دخول لكل مستخدم) · مفيد لازم know امتى المستخدم بيجي",
           [20, 22, 30, 16, 18, 18, 13, 14])
r = 4
r = header(ws, r, ["الوقت", "المستخدم", "الإيميل", "طريقة الدخول", "بصمة الجهاز", "عنوان IP", "جهاز جديد", "نوع الحساب"])
first = r
for i, e in enumerate(D["timeline"], 1):
    r = putrow(ws, r, [e["ts"], e["name"], e["email"] or "— زائر —", e["via"] or "—",
                       e["dev"] or "—", e["ip"] or "—", "نعم" if e["newdev"] else "لا",
                       "زائر" if e["guest"] else "مسجّل"],
               aligns=[AL_C, AL_R, AL_R, AL_C, AL_R, AL_R, AL_C, AL_C],
               fonts=[F_BODY, F_BOLD, F_BODY, F_BODY, F_BODY, F_BODY, F_BODY, F_BODY],
               fill=(SOFT if i % 2 else None), h=19)
last = r - 1
ws.auto_filter.ref = f"A{first-1}:{get_column_letter(8)}{last}"
ws.freeze_panes = f"A{first}"
r += 1
r = note(ws, r, "⭐ «جهاز جديد» = device مش مسجّل مسبقاً ⇒ اتطلب كود إيميل. «طريقة الدخول» = pin (باسورد) أو signup (تسجيل جديد).", 8)

# ═══════════════ شيت ٦ — الأجهزة ═══════════════
ws = sheet(wb, "٦. الأجهزة", "📱 بصمات الأجهزة — مين استخدم أنهي جهاز",
           "بصمة الجهاز = أول ١٢ حرف من هاش المتصفح + الجهاز",
           [20, 14, 40, 13, 34, 18, 18, 13])
r = 4
r = header(ws, r, ["بصمة الجهاز", "عدد المستخدمين", "المستخدمون", "عدد الدخولات", "عناوين IP",
                   "أول ظهور", "آخر ظهور", "أجهزة جديدة"])
for i, d in enumerate(D["devices"], 1):
    r = putrow(ws, r, [d["dev"], len(d["users"]), " · ".join(d["users"]) or "—", d["logins"],
                       " · ".join(d["ips"]) or "—", d["first"], d["last"], d["new"]],
               aligns=[AL_R, AL_C, AL_R, AL_C, AL_R, AL_C, AL_C, AL_C],
               fonts=[F_BODY, F_BOLD, F_BODY, F_BODY, F_BODY, F_BODY, F_BOLD, F_BODY],
               fill=(SOFT if i % 2 else None), h=20)

# ═══════════════ شيت ٧ — عناوين IP ═══════════════
ws = sheet(wb, "٧. عناوين IP", "🌐 عناوين الدخول من IPs",
           "كل العناوين مصرية · ١٢ مستخدم برومotr واحد", [20, 14, 44, 14, 12])
r = 4
r = header(ws, r, ["عنوان IP", "عدد المستخدمين", "المستخدمون", "عدد الدخولات", "عدد الأجهزة"])
for i, x in enumerate(D["ips"], 1):
    r = putrow(ws, r, [x["ip"], len(x["users"]), " · ".join(x["users"]), x["logins"], x["devs"]],
               aligns=[AL_R, AL_C, AL_R, AL_C, AL_C],
               fonts=[F_BODY, F_BOLD, F_BODY, F_BODY, F_BODY], fill=(SOFT if i % 2 else None))

# ═══════════════ شيت ٨ — الصفحات ═══════════════
ws = sheet(wb, "٨. الصفحات", "📄 ترتيب الصفحات — أنهي صفحة الناس بتستخدمها أكتر",
           "من ٨٠١٨ زيارة في آخر ٣٠ يوم", [8, 26, 14, 16, 14, 46])
r = 4
r = header(ws, r, ["الترتيب", "الصفحة", "عدد الزيارات", "النسبة", "مستخدمو مختلفين", "الوظيفة"])
PG = {
 "stocks": "صفحة الأسهم الرئيسية", "filter": "الفلتر الفني ⭐ أكتر أداة استخداماً بعد الأسهم",
 "arms": "فلتر الأذرع", "screener": "الشاشة (بحث متقدم)", "dash": "لوحة التحكم",
 "radar": "الرادار الذكي (Smart Money)", "engine": "محرك التقييم", "markets": "عمق السوق",
 "money": "محفظة المال", "setups": "الإعدادات والخطط", "octasearch": "البحث في الأسهم",
 "dividends": "التوزيعات والأرباح", "newsaxis": "محور الأخبار", "studio": "الاستوديو",
 "zones": "مناطق السوق", "challenges": "التحديات", "home": "الرئيسية", "gold": "الذهب",
}
for i, (p, n) in enumerate(K["pages"], 1):
    r = putrow(ws, r, [i, p, n, f"{n/tot30*100:.1f}%", "—", PG.get(p, "")],
               aligns=[AL_C, AL_R, AL_C, AL_C, AL_C, AL_R],
               fonts=[F_BODY, F_BOLD, F_BOLD, F_BODY, F_BODY, F_BODY], fill=(SOFT if i % 2 else None))
r += 1
r = note(ws, r, "⛔ «مستخدمو مختلفين» فاضي — لأن توزيع الصفحات لكل مستخدم محتاج السجل الخام (مسار /api/admin/events على السيرفر). التوزيع العام متاح دلوقتي.", 6, color="FDECEA")

# ═══════════════ شيت ٩ — السلوك ═══════════════
ws = sheet(wb, "٩. السلوك", "⏰ متى الناس بتيجي — التوزيع الساعي واليومي",
           "متى بتفتح الموقع (بتوقيت القاهرة) · بيساعد في قرار الرد على الرسائل",
           [16, 14, 14, 16, 14, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16])
r = 4
r = sect(ws, r, "التوزيع الساعي (عدد الدخولات في كل ساعة)", 25)
hr = ["الساعة"] + [f"{h:02d}" for h in range(24)]
r = header(ws, r, hr, height=22)
r = putrow(ws, r, ["عدد الدخولات"] + D["hourly"],
           aligns=[AL_R] + [AL_C]*24, fonts=[F_BOLD] + [F_BODY]*24, fill=SOFT)
r += 1
peak = max(D["hourly"])
r = note(ws, r, f"⭐ أعلى ساعة دخول: {D['hourly'].index(peak):02d}:00 (عدد {peak}) · أهدأ ساعة: {D['hourly'].index(min(D['hourly'])):02d}:00", 25)
r += 1
r = sect(ws, r, "التوزيع اليومي", 25)
r = header(ws, r, ["اليوم", "عدد الدخولات"], fill=NAVY)
for d, n in D["daily"]:
    r = putrow(ws, r, [d, n], aligns=[AL_R, AL_C], fonts=[F_BODY, F_BOLD])

# ═══════════════ شيت ١٠ — القمع ═══════════════
ws = sheet(wb, "١٠. القمع", "🔻 رحلة المستخدم — من الزيارة لحد الاستخدام النشط",
           "كل خطوة و نسبتها من اللي قبلها · بتبيّن فين الناس بتضيع", [30, 16, 16, 40])
r = 4
r = header(ws, r, ["الخطوة", "العدد", "النسبة من اللي قبلها", "الملاحظة"])
prev = None
NOTES = ["كل فتحات الصفحات المسجّلة في السجل", "زيارات ليها uid معروف", "حسابات في النظام",
         "حسابات عملت باسورد (PIN)", "حسابات عندها دخول مسجّل", "نشطين آخر ٧ أيام"]
for i, fd in enumerate(D["funnel"]):
    f, n = fd["step"], fd["n"]
    pct = "—" if prev in (None, 0) else f"{n/prev*100:.1f}%"
    r = putrow(ws, r, [f, n, pct, NOTES[i] if i < len(NOTES) else ""],
               aligns=[AL_R, AL_C, AL_C, AL_R], fonts=[F_BOLD, F_BOLD, F_BODY, F_BODY],
               fill=(SOFT if i % 2 else None))
    prev = n

# ═══════════════ شيت ١١ — الفجوات والحلول ═══════════════
ws = sheet(wb, "١١. الفجوات والحلول", "🔧 الفجوات المعروفة — إيه اللي ناقص وإزاي يتقفل",
           "كل سطر: المشكلة · الدليل · الأثر · الحل · الحالة",
           [30, 44, 34, 52, 16])
r = 4
r = header(ws, r, ["الفجوة", "الدليل (رقم)", "الأثر", "الحل", "الحالة"])
GAPS = [
 ("قاعدة مقياس الوقت غلط في السيرفر", "session_min = آخر ظهور − أول ظهور ⇒ ١١٢ ساعة ل ahmed",
  "التضخيم بيخلّي المستخدم يبان قاعد فيه أكتر بكتير",
  "المقياس اتصلّح في هذا التقرير (سقف ٣٠ دقيقة) + تعديل السطر ١٤٠٨٤ في الباك", "✅ اتعمل في التقرير"),
 ("الزيارات مش منسوبة لمستخدم", "١٨٩٩ من ٨١٦٥ زيارة (٢٣.٣٪) بدون uid",
  "مش بنعرف مين فتح إيه", "٢ سطرين في /api/track: جيب الـuid من الكوكي لما الـbody فاضي", "⏳ جاهز — محتاج نشر"),
 ("السجل الخام للأحداث مش موجود", "/api/admin/events ⇒ 405 على السيرفر",
  "مش بنعرف قعد على أنهي صفحة قد إيه", "المسار مكتوب ومختبر (٥ اختبارات) — محتاج push على octa-prices", "⏳ جاهز — محتاج صلاحية"),
 ("أحداث الفلاتر مش مبعوتة أصلاً", "actions = 0 خلال ٩٠ يوم",
  "مش بنعرف أنهي فلتر Users بيحبه", "octaTrack('action', ...) مع كل فلتر في الواجهة + مسار السجل", "⏳ جاهز — محتاج نشر"),
 ("زوار غير مسجّلين (٢٣٪)", "١٧٠٠ زائر فريد في ٩٠ يوم",
  "زيارات بتضيع من التحليل", "بوابة الدخول عندها + ربط uid بالكوكي", "⏳ جزئي — البوابة شغالة"),
 ("عناوين IP مش مقفولة", "٦ عناوين IP من ١١ مستخدم",
  "ممكن حد يشارك حسابه", "قفل الأجهزة + مراجعة على أساس البصمة", "🔵 قرار مطلوب"),
 ("last_seen بيقلب بسبب كاش", "النسخة المتأخرة بترجع قديمة",
  "أرقام مغلوطة في التقارير", "الكاش بستّر صحيح (bust) + مقارنة data_version", "✅ اتعمل"),
 ("اختبار الـCI كان سطحي", "ast.parse بس — باگين اتنين عدّوا",
  "باگ production اتكسر", "tools/live-test.py داخل الـCI", "✅ اتعمل"),
]
for i, g in enumerate(GAPS, 1):
    r = putrow(ws, r, list(g), aligns=[AL_R]*5,
               fonts=[F_BOLD, F_BODY, F_BODY, F_BODY, F_BOLD],
               fill=(SOFT if i % 2 else None), h=42)

wb.save(OUT)
print("✅", OUT)
