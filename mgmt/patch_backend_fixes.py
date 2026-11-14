#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🔧 إصلاحات الباك (١٤ نوفمبر ٢٠٢٦) — كلها في كوميت واحد

1) /api/track — القائم المقبول: signup_start و pin_reset مرفوضين (400)
   ⇒ الواجهة بتبعثهم وبيترفضوا.
2) /api/alerts/watch — w_list جوّه اللوب ⇒ القائمة كلها بتترجع مع كل عنصر
   ⇒ ٦ أسهم = ٣٦ سطر.
3) /api/admin/monthly — session_min = (آخر ظهور − أول ظهور) ⇒ تضخيم
   «فتح وساب» (١١٢ ساعة لواحد قاعد ٦). نضيف active_min (سقف ٣٠ دقيقة).
"""
import io, sys

P = "/workspace/octa-prices/update_prices.py"
s = io.open(P, encoding="utf-8").read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    if n != 1:
        print(f"⛔ [{tag}] تطابق {n} (المطلوب 1)"); sys.exit(1)
    s = s.replace(old, new)
    print(f"  ✔ [{tag}]")

# ── ١) قائمة أحداث التتبع ──
rep("""    if event not in ("page_view", "action", "signup", "login"):
        return jsonify({"ok": False, "error": "event غير معروف"}), 400""",
"""    # ⭐ ١٤ نوفمبر ٢٠٢٦ — signup_start و pin_reset مبعوثين من الواجهة
    #    (octa-gate.js) كانوا بيت rejecting بـ400 ⇒ بياناتهم ضايعة.
    if event not in ("page_view", "action", "signup", "login",
                     "signup_start", "pin_reset"):
        return jsonify({"ok": False, "error": "event غير معروف"}), 400""",
    "track-القائمة")

# ── ٢) تكرار قائمة المنبهات ──
rep("""    watch = u.get("watch") or {}
    items = []
    for c, cfg in watch.items():
        item = next((s for s in LIVE_DATA.get("egx30", []) if s["code"] == c), None)
        if item:
            rows = w_add({"watch": dict(watch)}, c, cfg.get("hi"), cfg.get("lo"))
            items.extend(w_list({"watch": dict(watch)}))
    return jsonify({"ok": True, "items": items})""",
"""    watch = u.get("watch") or {}
    items = []
    for c, cfg in watch.items():
        item = next((s for s in LIVE_DATA.get("egx30", []) if s["code"] == c), None)
        if not item:
            continue
        rows = w_add({"watch": dict(watch)}, c, cfg.get("hi"), cfg.get("lo"))
        # ⭐ ١٤ نوفمبر ٢٠٢٦ — ⛔ w_list جوّه اللوب كان بيرجّع القائمة كلها
        #    مع كل عنصر ⇒ ٦ أسهم = ٣٦ سطر (تكرار). نجمّع مرة واحدة.
        if not items:
            items.extend(w_list({"watch": dict(watch)}))
    return jsonify({"ok": True, "items": items})""",
    "watch-التكرار")

# ── ٣) مقياس الوقت في الـmonthly ──
rep("""        u["session_min"] = round((last - first) / 60) if first and last else 0""",
"""        u["session_min"] = round((last - first) / 60) if first and last else 0
        # ⭐⭐ ١٤ نوفمبر ٢٠٢٦ — session_min = (آخر ظهور − أول ظهور) ⇒ تضخيم
        #    «فتح وساب»: مستخدم قاعد ٦ ساعات بيطلع ١١٢ ساعة.
        #    ⭐ active_min = الوقت الفعلي (فجوات محدودة بسقف ٣٠ دقيقة).
        _lg = [int(e.get("t") or 0) for e in (rec.get("login_log") or [])
               if isinstance(e, dict)]
        _pts = sorted(set([x for x in _lg if x] + ([last] if last else [])))
        _act = 0
        for _i in range(1, len(_pts)):
            _act += min(_pts[_i] - _pts[_i - 1], 1800)
        u["active_min"] = int(_act // 60)
        u["login_log_kept"] = len(_lg)""",
    "monthly-الوقت")

io.open(P, "w", encoding="utf-8").write(s)
print("\n✅ إصلاحات الباك اتعملت")
