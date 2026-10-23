#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔧 جلب تاريخ OHLCV لكل أسهم الـRadar من الـAPI — باحترام حد ١٥/دقيقة
⏱️ بالتقدّم: ~٢٢ دقيقة لـ٢٨٩ سهم. يشتغل في الخلفية.
📌 الهدف: dataset حقيقي لاختبار المحرك (مش بيانات مصنوعة).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = "https://octa-prices-production-4ccb.up.railway.app"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools/_candles")
PER_MIN = 13          # ⛔ تحت الـ15/دقيقة
N = 320

NON_EQUITY = {"EGS30AJ1C016-EGP", "EGS65101C015", "EGS65621C012",
              "EGS65861C014", "EGS72L31C011"}
ISIN_MAP = {"EGS3I0S1C019": "FCMD", "EGS48271C018-EGP": "ESAC",
            "EGS370O1C013": "NAPR", "EGS3E071C013-EGP": "ACRO",
            "EGS659O1C015": "IDSC"}


def universe():
    p = os.path.join(ROOT, "tools/_live_mt_egypt.json")
    mt = json.load(open(p, encoding="utf-8"))["markets"]["egypt"]
    return sorted(ISIN_MAP.get(c, c) for c in mt if c not in NON_EQUITY)


def fetch(code, tries=4):
    url = f"{BASE}/api/candles/{code}?n={N}"
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "octa-radar-dev"})
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.loads(r.read().decode("utf-8"))
            if d.get("ok") and d.get("candles"):
                return d["candles"]
            return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                ra = int(e.headers.get("Retry-After", "20") or 20)
                time.sleep(min(ra, 65) + 1)
                continue
            return None
        except Exception:
            time.sleep(2 + i * 2)
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    codes = universe()
    # نكمّل من فين وقفنا
    todo = [c for c in codes if not os.path.exists(os.path.join(OUT, f"{c}.json"))]
    print(f"🌍 الكون: {len(codes)} · ناقص: {len(todo)}", flush=True)
    done = fail = 0
    t0 = time.time()
    for idx, c in enumerate(todo):
        path = os.path.join(OUT, f"{c}.json")
        data = fetch(c)
        if data:
            json.dump(data, open(path, "w", encoding="utf-8"))
            done += 1
        else:
            fail += 1
        if (idx + 1) % PER_MIN == 0:
            el = time.time() - t0
            print(f"   …{idx+1}/{len(todo)} · نجح {done} · فشل {fail} · "
                  f"{el/60:.1f} دقيقة", flush=True)
            time.sleep(max(0, 62 - (time.time() - t0) % 60))
    print(f"✅ خلص: نجح {done} · فشل {fail} · {len(todo)} طلب", flush=True)


if __name__ == "__main__":
    sys.exit(main())
