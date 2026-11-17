#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔧 رقعة الجولة ١٨ على لوحة الإدارة (mgmt/public/index.html)

⛔ الهدف: شيل البيانات المدمجة من الملف اللي بيتقدّم للعموم
   (الصفحة بقى placeholder + الداتا بتيجي من /api/* بعد الجلسة).

⚠️ السكربت بيتطبّق مرة واحدة (idempotent): لو الرقعة اتطبّقت قبل كده
   مش هيعمل حاجة تانية.
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strip_embedded_data import strip  # noqa: E402

IDX = os.environ.get(
    "MGMT_INDEX",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "index.html"),
)
IDX = os.path.abspath(IDX)

with io.open(IDX, "r", encoding="utf-8") as f:
    src = f.read()

before = len(src)
new, rep = strip(src)

if rep["changed"]:
    with io.open(IDX, "w", encoding="utf-8") as f:
        f.write(new)

after = len(new)
print("✅ %s: %d ← %d بايت" % (os.path.relpath(IDX), before, after))
print("   بيانات مدمجة اتشالت: %s · pull() قديمة اتشالت: %s"
      % (rep["had_data"], rep["had_pull"]))
if not rep["changed"]:
    print("ℹ️  الرقعة اتطبّقت قبل كده — مافيش تغيير.")
