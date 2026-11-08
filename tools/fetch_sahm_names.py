#!/usr/bin/env python3
"""يجلب الأسماء العربية الرسمية من sahm.finance (التأدوول) بالبحث.

📌 البحث بيرجّع ٣٠ نتيجة كحد أقصى لكل طلب ⇒ بنعمل تعداد بحروف مفردة.
📌 النتيجة: ticker → name_ar (الاسم الرسمي من البورصة السعودية).
"""
import json, time, urllib.request, urllib.parse, sys, os

URL = "https://sahm.finance/ajax.php"
LETTERS = list("abcdefghijklmnopqrstuvwxyz") + list("ابتثجحخدذرزسشصضطظعغفقكلمنهوي"[:28]) + list("أإآءئ")

def search(q):
    data = urllib.parse.urlencode({"action": "sahm_search_companies", "nonce": "standalone", "q": q}).encode()
    req = urllib.request.Request(URL, data=data, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            j = json.loads(r.read().decode("utf-8", "replace"))
        return j.get("data") or []
    except Exception as e:
        return []

def main():
    found = {}
    n = 0
    for ch in LETTERS:
        rows = search(ch)
        n += 1
        for c in rows:
            t = str(c.get("ticker") or "").strip()
            ar = (c.get("name_ar") or "").strip()
            if t and ar and ar != t:
                found.setdefault(t, ar)
        sys.stdout.write("\r   %d/%d حرف · %d اسم عربي" % (n, len(LETTERS), len(found)))
        sys.stdout.flush()
        time.sleep(0.25)
    print()
    out = "/workspace/octa/data/sahm_names_ar.json"
    json.dump(found, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("✅", out, "·", len(found), "اسم")

    # التغطية
    d = json.loads(open("/workspace/octa/data/data_markets.js", encoding="utf-8").read()
                    .split("window.OCTA_MK = ")[1].rstrip().rstrip(";"))
    for mk in ("saudi", "uae"):
        rows = d.get(mk) or []
        miss = [r for r in rows if not (r.get("name") or "").strip()]
        got = [r for r in miss if str(r.get("code")) in found]
        print(f"   {mk}: ناقص {len(miss)} · اتغطّى {len(got)} · باقى {len(miss)-len(got)}")

if __name__ == "__main__":
    main()
