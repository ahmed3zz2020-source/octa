#!/usr/bin/env python3
"""يكمّل الأسماء العربية الناقصة للسوق السعودي من sahm.finance.

📌 البحث بيرجّع ٣٠ نتيجة كحد أقصى ⇒ بنجيب الاسم لو تقدر نلقاه
   بكلمة مميزة من الاسم الإنجليزي (TradingView) — والقبول **بس**
   لو الكود اللي رجع هو نفس الكود المطلوب (مفيش تخمين).
"""
import json, time, urllib.request, urllib.parse, sys

URL = "https://sahm.finance/ajax.php"

def search(q):
    data = urllib.parse.urlencode({"action": "sahm_search_companies", "nonce": "standalone", "q": q}).encode()
    req = urllib.request.Request(URL, data=data, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode("utf-8", "replace")).get("data") or []
    except Exception:
        return []

def queries_for(en):
    ws = [w for w in re.split(r"[^A-Za-z]+", en or "") if len(w) >= 3]
    out = []
    for i in range(len(ws)):
        out.append(ws[i])
        if i + 1 < len(ws):
            out.append(ws[i] + " " + ws[i + 1])
    for w in ws:
        if len(w) > 5:
            out.append(w[:5])
    seen, res = set(), []
    for q in out:
        if q and q.lower() not in seen:
            seen.add(q.lower())
            res.append(q)
    return res[:7]

import re
def main():
    known = json.load(open("/workspace/octa/data/sahm_names_ar.json", encoding="utf-8"))
    d = json.loads(open("/workspace/octa/data/data_markets.js", encoding="utf-8").read()
                    .split("window.OCTA_MK = ")[1].rstrip().rstrip(";"))
    todo = []
    for mk in ("saudi", "uae"):
        for r in d.get(mk) or []:
            code = str(r.get("code") or "").strip()
            if code and not (r.get("name") or "").strip() and code not in known:
                todo.append((mk, code, r.get("nameEn") or ""))
    print("ناقص:", len(todo))
    got, tried = {}, 0
    t0 = time.time()
    for mk, code, en in todo:
        for q in queries_for(en):
            tried += 1
            for c in search(q):
                if str(c.get("ticker") or "").strip() == code:
                    ar = (c.get("name_ar") or "").strip()
                    if ar and ar != code:
                        got[code] = ar
                    break
            if code in got:
                break
            time.sleep(0.15)
        if len(got) % 5 == 0 and got:
            print("\r   اتغطّى %d/%d · طلبات %d · %.0fث" % (len(got), len(todo), tried, time.time() - t0))
            sys.stdout.flush()
    print()
    known.update(got)
    json.dump(known, open("/workspace/octa/data/sahm_names_ar.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=0)
    print("✅ اتغطّى جديد: %d · الإجمالي: %d" % (len(got), len(known)))
    for mk in ("saudi", "uae"):
        rows = d.get(mk) or []
        miss = [r for r in rows if not (r.get("name") or "").strip()]
        have = [r for r in miss if str(r.get("code")) in known]
        print(f"   {mk}: ناقص {len(miss)} · متاح {len(have)} · باقى {len(miss)-len(have)}")

if __name__ == "__main__":
    main()
