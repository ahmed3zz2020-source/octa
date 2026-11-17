#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
📊 باني تقرير الزوار الاحترافي — بيانات + Excel + HTML/PDF
⭐ المقياس الأساسي: «الوقت الفعلي» = فجوات محدودة (حد ٣٠ دقيقة)
   ⇒ المستخدم اللي فتح وساب مش بiscountش عليه.
"""
import json, os, ssl, urllib.request, datetime, collections, calendar

API = "https://octa-prices-production-4ccb.up.railway.app"
ADMIN = os.environ["OCTA_ADMIN_TOKEN"]
OUT = "/workspace/output"
GAP_CAP = 1800          # ٣٠ دقيقة: بعد كده بنحسب إن المستخدم ساب
SESSION_GAP = 2700      # ٤٥ دقيقة: فجوة أكتر ⇒ جلسة جديدة

# 🛡️ الجولة ١٨ (P0) — ⛔ التقرير ده فيه بيانات شخصية (إيميلات/IP/أسماء)
#   ⇒ لازم يفضل في مسار خاص (مش في مجلد public ولا في مجلد الـassets).
def _assert_private_output(path):
    p = os.path.abspath(path).replace(os.sep, "/")
    if "/public" in p or "/assets" in p or "/dist" in p:
        raise SystemExit(
            "❌ ⛔ مافيش report ينكتب في %s — بيانات المستخدمين هتتسرّب للموقع." % path)
    return p

_assert_private_output(OUT)

_ctx = ssl.create_default_context(); _ctx.check_hostname = False; _ctx.verify_mode = ssl.CERT_NONE

def call(path, method="GET", body=None, tok=None):
    h = {"X-OCTA-Admin": ADMIN}
    if tok: h = {"Authorization": "Bearer " + tok}
    data = None
    if body is not None:
        data = json.dumps(body).encode(); h["Content-Type"] = "application/json"
    r = urllib.request.Request(API + path, data=data, method=method, headers=h)
    with urllib.request.urlopen(r, context=_ctx, timeout=45) as f:
        return json.loads(f.read().decode() or "{}")

CAIRO = 7200
def T(x):
    try: return int(x)
    except: return 0

def dt(ts):
    return datetime.datetime.utcfromtimestamp(T(ts) + CAIRO)

def s(ts):  return dt(ts).strftime("%Y-%m-%d %H:%M")
def d(ts):  return dt(ts).strftime("%Y-%m-%d")
def hm(m):
    m = int(round(m or 0))
    if m <= 0: return "—"
    if m < 60: return f"{m} د"
    h, mm = divmod(m, 60)
    if h < 24: return f"{h} س {mm} د" if mm else f"{h} س"
    dd, hh = divmod(h, 24)
    return f"{dd} يوم {hh} س" if hh else f"{dd} يوم"

# ═══════════ ١) السحب ═══════════
print("⏳ سحب البيانات…")
monthly = call("/api/admin/monthly")
usersj  = call("/api/admin/users")
loginsj = call("/api/admin/logins")
an = monthly["analytics"]
mu = {m["id"]: m for m in monthly["users"]}
uu = {u["uid"]: u for u in usersj["users"]}

# ═══════════ ٢) متابعة كل مستخدم (الأسهم اللي بيتابعها) ═══════════
print("⏳ متابعة الأسهم لكل مستخدم…")
prefs = {}
for u in usersj["users"]:
    em = (u.get("email") or "").strip()
    if not em:
        prefs[u["uid"]] = {"watch": [], "n": 0}; continue
    try:
        m = call("/api/admin/mint_session", "POST", {"email": em})
        tok = m.get("token")
        if not tok: raise RuntimeError("no token")
        w = call("/api/alerts/watch", "GET", None, tok)
        items = w.get("items") or []
        # ⛔ الباك بيرجّع القائمة مكرّرة (w_list جوّه اللوب) ⇒ نخلي أول واحد بس
        seen, clean = set(), []
        for i in items:
            c = i.get("code")
            if not c or c in seen:
                continue
            seen.add(c)
            clean.append({"code": c, "hi": i.get("hi"), "lo": i.get("lo"), "at": i.get("at")})
        prefs[u["uid"]] = {"watch": clean, "n": len(clean)}
    except Exception as e:
        prefs[u["uid"]] = {"watch": [], "n": 0, "err": str(e)[:60]}
print(f"   ✅ {sum(1 for p in prefs.values() if p['n'])} مستخدم عندهم متابعة أسهم")

# ═══════════ ٣) حساب المستخدمين ═══════════
def active_minutes(points, cap=GAP_CAP):
    """الوقت الفعلي: مجموع الفجوات مع سقف (-caps idle time)."""
    pts = sorted(set(T(x) for x in points if T(x)))
    tot = 0
    for i in range(len(pts) - 1):
        gap = pts[i + 1] - pts[i]
        tot += min(gap, cap)
    return tot // 60

users = []
for lg in loginsj["users"]:
    uid = None
    for u in usersj["users"]:
        if u["uid"] in [x["uid"] for x in users]: continue
        if u["name"] == lg["name"] and (u.get("email") or "") == (lg.get("email") or ""):
            uid = u["uid"]; break
    if uid is None:
        for u in usersj["users"]:
            if u["uid"] in [x["uid"] for x in users]: continue
            if u["name"] == lg["name"] and not lg.get("email"):
                uid = u["uid"]; break
    m = mu.get(uid, {}); raw = uu.get(uid, {})
    logins = sorted(lg.get("logins") or [], key=lambda e: T(e.get("t")))

    # ── جلسات: فجوة > ٤٥ دقيقة = جلسة جديدة ──
    sess = []
    for e in logins:
        if sess and T(e["t"]) - T(sess[-1][-1]["t"]) <= SESSION_GAP:
            sess[-1].append(e)
        else:
            sess.append([e])

    ls_raw = 0
    if m.get("last_seen") and m["last_seen"] != "—":
        try:
            ls_raw = calendar.timegm(datetime.datetime.strptime(m["last_seen"], "%Y-%m-%d %H:%M").timetuple())
        except Exception: pass
    created_raw = 0
    if m.get("created_iso") and m["created_iso"] != "—":
        try:
            created_raw = calendar.timegm(datetime.datetime.strptime(m["created_iso"], "%Y-%m-%d %H:%M").timetuple())
        except Exception: pass

    srows = []
    for i, cl in enumerate(sess):
        start = T(cl[0]["t"])
        if i + 1 < len(sess):
            nxt = T(sess[i + 1][0]["t"]); bound = "تقديري"
        else:
            nxt = ls_raw if ls_raw > start else start; bound = "مقيس"
        # ⭐ الوقت الفعلي داخل الجلسة: الفجوات الداخلية بس، مع السقف
        inner = active_minutes([e["t"] for e in cl])
        tail = min(max(nxt - T(cl[-1]["t"]), 0), GAP_CAP) // 60
        srows.append({
            "start": s(start), "start_ts": start,
            "end": s(nxt) if nxt > start else s(start), "end_ts": nxt,
            "gross_min": round((nxt - start) / 60),
            "active_min": inner + tail,
            "bound": bound,
            "logins": len(cl),
            "vias": sorted({e.get("via") for e in cl if e.get("via")}),
            "devs": sorted({e.get("dev") for e in cl if e.get("dev")}),
            "ips": sorted({(e.get("ip") or "").split("|")[0] for e in cl if e.get("ip")}),
        })

    # ⭐ الوقت الفعلي الكلي: نقاط النشاط = الدخولات + آخر ظهور، مع سقف ٣٠ د
    pts = [e["t"] for e in logins] + ([ls_raw] if ls_raw else [])
    active_total = active_minutes(pts)
    gross_span = round((ls_raw - created_raw) / 86400, 1) if (ls_raw and created_raw) else 0

    devices = sorted({e.get("dev") for e in logins if e.get("dev")})
    ips = sorted({(e.get("ip") or "").split("|")[0] for e in logins if e.get("ip")})
    pf = prefs.get(uid, {"watch": [], "n": 0})

    users.append({
        "uid": uid, "name": lg["name"], "email": lg.get("email") or "",
        "created": m.get("created_iso") or "—",
        "last_seen": m.get("last_seen") or "—",
        "last_seen_ts": ls_raw,
        "first_seen": s(created_raw) if created_raw else "—",
        "hits": int(m.get("hits") or 0),
        "sessions": len(srows),
        "active_min": active_total,
        "gross_span_days": gross_span,
        "avg_active": round(active_total / len(srows)) if srows else 0,
        "srows": srows,
        "login_count": int(lg.get("login_count") or 0),
        "login_events": len(logins),
        "devices": devices, "n_dev": len(devices),
        "ips": ips, "n_ips": len(ips),
        "newdev": sum(1 for e in logins if e.get("newdev")),
        "pin": bool(m.get("pin_set")),
        "a7": bool(m.get("active_7d")), "a30": bool(m.get("active_30d")),
        "guest": not lg.get("email"),
        "watch": pf.get("watch", []), "n_watch": pf.get("n", 0),
        "alerts_count": int(raw.get("watch") or 0),
        "logins": [{"t": T(e.get("t")), "ts": s(e.get("t")), "via": e.get("via"),
                    "dev": e.get("dev"), "ip": (e.get("ip") or "").split("|")[0],
                    "newdev": bool(e.get("newdev"))} for e in logins],
    })

users.sort(key=lambda x: (-x["active_min"], -x["hits"]))

# ═══════════ ٤) الخط الزمني + الأجهزة + السلوك ═══════════
timeline = []
for u in users:
    for e in u["logins"]:
        timeline.append({**e, "name": u["name"], "email": u["email"], "guest": u["guest"]})
timeline.sort(key=lambda e: -e["t"])

devmap = collections.defaultdict(lambda: {"users": set(), "logins": 0, "ips": set(), "first": 9e18, "last": 0, "new": 0})
for e in timeline:
    v = devmap[e["dev"]]
    v["users"].add(e["name"]); v["logins"] += 1
    if e["ip"]: v["ips"].add(e["ip"])
    v["first"] = min(v["first"], e["t"]); v["last"] = max(v["last"], e["t"])
    if e["newdev"]: v["new"] += 1
devices = [{"dev": k, "users": sorted(v["users"]), "logins": v["logins"], "ips": sorted(v["ips"]),
            "first": s(v["first"]), "last": s(v["last"]), "new": v["new"]}
           for k, v in devmap.items()]
devices.sort(key=lambda x: -x["logins"])

ipmap = collections.defaultdict(lambda: {"users": set(), "logins": 0, "devs": set()})
for e in timeline:
    if not e["ip"]: continue
    ipmap[e["ip"]]["users"].add(e["name"]); ipmap[e["ip"]]["logins"] += 1; ipmap[e["ip"]]["devs"].add(e["dev"])
ips = [{"ip": k, "users": sorted(v["users"]), "logins": v["logins"], "devs": len(v["devs"])}
       for k, v in ipmap.items()]
ips.sort(key=lambda x: -x["logins"])

hourly = [0] * 24
for e in timeline: hourly[(e["t"] + CAIRO) % 86400 // 3600] += 1
daily = collections.Counter(d(e["t"]) for e in timeline)

# السلوك لكل مستخدم: خريطة ٧ أيام × ٢٤ ساعة
heat = {}
for u in users:
    g = {}
    for e in u["logins"]:
        w = dt(e["t"]); k = f"{w.strftime('%a')}_{w.hour}"
        g[k] = g.get(k, 0) + 1
    heat[u["uid"]] = g

DATA = {
    "generated": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    "generated_cairo": datetime.datetime.utcfromtimestamp(datetime.datetime.utcnow().timestamp() + CAIRO).strftime("%Y-%m-%d %H:%M"),
    "snapshot": monthly.get("snapshot_id"),
    "kpi": {
        "users": monthly["total"], "pin_users": monthly["pin_set_n"],
        "events": an["events_total"], "events7": an["events_7d"], "events30": an["events_30d"],
        "active7": an["active_7d"], "active30": an["active_30d"],
        "tracked_users": an["tracked_users"], "anon": an["anon_30d"],
        "login_events": len(timeline), "sessions": sum(u["sessions"] for u in users),
        "devices": len(devices), "ips": len(ips),
        "total_active_h": round(sum(u["active_min"] for u in users) / 60, 1),
        "avg_active_h": round(sum(u["active_min"] for u in users) / 60 / max(1, len(users)), 1),
        "watch_total": sum(u["n_watch"] for u in users),
        "pages": an["top_pages"], "by_event": an["by_event"],
        "growth": an["growth"], "actions": an["top_actions"],
    },
    "users": users, "timeline": timeline, "devices": devices, "ips": ips,
    "hourly": hourly, "daily": sorted(daily.items()), "heat": heat,
    "funnel": [
        {"step": "زيارات مسجّلة", "n": an["events_total"]},
        {"step": "زيارات منسوبة لمستخدم", "n": sum(u["hits"] for u in users)},
        {"step": "مستخدمين", "n": monthly["total"]},
        {"step": "حطوا باسورد", "n": monthly["pin_set_n"]},
        {"step": "عندهم دخول فعلي", "n": sum(1 for u in users if u["login_count"] > 0)},
        {"step": "نشط آخر ٧ أيام", "n": an["active_7d"]},
    ],
}
os.makedirs(OUT, exist_ok=True)
json.dump(DATA, open(f"{OUT}/octa-report-data.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"✅ {OUT}/octa-report-data.json")
print(f"   {len(users)} مستخدم · {len(timeline)} دخول · {sum(u['sessions'] for u in users)} جلسة · "
      f"{DATA['kpi']['total_active_h']} ساعة وقت فعلي · {len(devices)} جهاز · {len(ips)} IP")
print(f"   المتابعون للأسهم: {DATA['kpi']['watch_total']}")
