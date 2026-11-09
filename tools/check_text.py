#!/usr/bin/env python3
"""فحص سلامة النص العربي/الملفات:
   - FFFD (محارف تالفة) · CJK · Cyrillic · تطويل غير مقصود
   الاستخدام: python3 tools/check_text.py <ملف> [ملف...]
"""
import sys, io, unicodedata

def scan(path):
    s = io.open(path, encoding="utf-8", errors="replace").read()
    bad = []
    for i, ch in enumerate(s):
        cp = ord(ch)
        if cp == 0xFFFD:
            bad.append((i, "FFFD تالف", s[max(0,i-25):i+25].replace("\n"," ")))
        elif 0x4E00 <= cp <= 0x9FFF or 0x3040 <= cp <= 0x30FF:
            bad.append((i, "CJK/ياباني", s[max(0,i-25):i+25].replace("\n"," ")))
        elif 0x0400 <= cp <= 0x04FF:
            bad.append((i, "Cyrillic", s[max(0,i-25):i+25].replace("\n"," ")))
        elif cp == 0x0640:
            # ⭐ «الـ»GFP-prefixed tatweel is the house style here -> allowed
            if not (i >= 2 and s[i-2] == '\u0627' and s[i-1] == '\u0644'):
                bad.append((i, "تطويل", s[max(0,i-25):i+25].replace("\n"," ")))
        elif cp in (0x202B, 0x202C, 0x202D, 0x202E, 0x200E, 0x200F):
            bad.append((i, "محرف اتجاه مخفي", s[max(0,i-25):i+25].replace("\n"," ")))
    # ⭐ تشكّل مقطوع في وسط الكلمة ( كلمة+'\u064B'+ كلمة )
    return bad

ok = True
for p in sys.argv[1:]:
    bad = scan(p)
    if bad:
        ok = False
        print(f"🔴 {p}: {len(bad)} مشكلة")
        for i, kind, ctx in bad[:12]:
            print(f"   [{i}] {kind}: …{ctx}…")
    else:
        print(f"✅ {p}: سليم")
sys.exit(0 if ok else 1)
