#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R26 — تغذية لقطة الأسعار في مساحة المعاينة ⭐ (PREVIEW_KV).

📌 المعاينة المعزولة مافيشش فيها وصول للإنتاج ⭐ ⇒ لازم تشتغل من لقطة ⭐.
📌 اللقطة بتتبني من استعلام **حيّ** على السيرفر المحلي ⭐ (بيانات سوق
   حقيقية ⭐) ⇒ مش بيانات مصطنعة ⭐.
📌 التشغيل:
   python3 tools/r26_seed_preview_snapshot.py <ملف-الرد-الحيّ> <مساحة-KV>
"""
import io
import json
import os
import sys
import urllib.request

ACCOUNT = "74e046678adabf0706024b97b205882b"


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/quotes_snapshot_raw.json"
    ns = sys.argv[2] if len(sys.argv) > 2 else "68e1d82a57f94344a051bcfd9dfd81ed"
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    if not token:
        raise SystemExit("CLOUDFLARE_API_TOKEN مفقود")

    raw = json.load(io.open(src, encoding="utf-8"))
    markets = raw.get("markets") or {}
    if not markets.get("egypt"):
        raise SystemExit("اللقطة الحية مافيش فيها السوق المصري")

    snap = {
        "updated": int(raw.get("updated") or raw.get("ts") or 0),
        "ttl": int(raw.get("ttl") or 120),
        "egx": raw.get("egx") or {},
        "markets": markets,
        "source": "لقطة حيّة من السيرفر المحلي (بيانات سوق حقيقية)",
    }
    body = json.dumps(snap, ensure_ascii=False).encode("utf-8")
    url = ("https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/"
           "namespaces/%s/values/snap:quotes" % (ACCOUNT, ns))
    req = urllib.request.Request(url, data=body, method="PUT", headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json; charset=utf-8",
    })
    res = json.loads(urllib.request.urlopen(req, timeout=40).read().decode("utf-8"))
    print("seed success:", res.get("success"),
          "| symbols:", len(markets.get("egypt") or {}),
          "| bytes:", len(body))
    if not res.get("success"):
        raise SystemExit("فشل التغذية: %s" % res.get("errors"))


if __name__ == "__main__":
    main()
