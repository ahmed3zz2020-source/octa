#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🐛 إصلاح السبب الجذري في واجهة OCTA (١٤ نوفمبر ٢٠٢٦)

⭐ المشكلة:
   window.OCTA_USER_ID كان بيتحدد مرة واحدة في setUser() وبيتمسح مع أي
   تحديث للصفحة ⇒ كل page_view بعد التحديث كان بيبعت uid فاضي ⇒
   (١) سجل التتبع ما كانش بيحدّث ⇒ «آخر ظهور» قديم بـ ١٠ ساعات
   (٢) ٢٣.٣٪ من الزيارات (١٨٩٩ من ٨١٦٥) غير منسوبة لمستخدم

✅ الإصلاح (واجهة فقط — من غير تغيير في الباك):
   (١) نحفظ الـuid في localStorage زي الـtoken والـuser
   (٢) octaTrack بيرجع_uid_ المحفوظ لو الـwindow متاع فاضي
   (٣) أحداث الفلاتر: fzGo بيبعت action ⇒ نعرف أنهي فلتر الناس بتحبه
   (٤) فتح السهم: analyzeStock بيبعت action + كود السهم
"""
import io, sys

ROOT = "/workspace/octa"
def patch(path, pairs):
    p = f"{ROOT}/{path}"
    s = io.open(p, encoding="utf-8").read()
    for old, new, tag in pairs:
        n = s.count(old)
        if n != 1:
            print(f"⛔ [{tag}] {path}: تطابق {n} (المطلوب 1)"); sys.exit(1)
        s = s.replace(old, new)
        print(f"  ✔ [{tag}]")
    io.open(p, "w", encoding="utf-8").write(s)

# ═══ ١) octa-auth.js — حفظ الـuid واسترجاعه ═══
patch("assets/js/octa-auth.js", [
("""  function setUser(token, user) {
  try {
  localStorage.setItem('octa_token', token);
  localStorage.setItem('octa_user', JSON.stringify(user || {}));
  window.OCTA_USER_ID = (user && user.id) || '';
  } catch (e) { }
  }""",
"""  function setUser(token, user) {
  try {
  localStorage.setItem('octa_token', token);
  localStorage.setItem('octa_user', JSON.stringify(user || {}));
  window.OCTA_USER_ID = (user && user.id) || '';
  /* ⭐⭐ ١٤ نوفمبر ٢٠٢٦ — السبب الجذري لـ«آخر ظهور» قديم و٢٣٪ زيارات
     غير منسوبة: الـuid كان في الذاكرة بس ⇒ أي تحديث للصفحة بيمسحه.
     دلوقتي بنحفظه مع الـtoken ⇒ كل page_view بعد التحديث ليها uid. */
  try { localStorage.setItem('octa_uid', window.OCTA_USER_ID || ''); } catch (e) { }
  } catch (e) { }
  }""", "auth-حفظ-uid"),
("""  function clearUser() {
  try {
  localStorage.removeItem('octa_token');
  localStorage.removeItem('octa_user');
  window.OCTA_USER_ID = '';
  } catch (e) { }""",
"""  function clearUser() {
  try {
  localStorage.removeItem('octa_token');
  localStorage.removeItem('octa_user');
  try { localStorage.removeItem('octa_uid'); } catch (e) { }
  window.OCTA_USER_ID = '';
  } catch (e) { }""", "auth-مسح-uid"),
("""  function getUser() {
  try { return JSON.parse(localStorage.getItem('octa_user') || 'null'); }
  catch (e) { return null; }
  }""",
"""  function getUser() {
  try { return JSON.parse(localStorage.getItem('octa_user') || 'null'); }
  catch (e) { return null; }
  }

  /* ⭐⭐ ١٤ نوفمبر ٢٠٢٦ — استرجاع الـuid من localStorage عند تحميل الصفحة.
     ⛔ لازم يبقى قبل أي page_view ( octaTrack بيرجع للـuid المحفوظ كمان). */
  try {
  if (!window.OCTA_USER_ID) {
  window.OCTA_USER_ID = localStorage.getItem('octa_uid') || '';
  if (!window.OCTA_USER_ID) {
  var _u = null;
  try { _u = JSON.parse(localStorage.getItem('octa_user') || 'null'); } catch (e) { }
  if (_u && _u.id) { window.OCTA_USER_ID = _u.id; localStorage.setItem('octa_uid', _u.id); }
  }
  }
  } catch (e) { }""", "auth-استرجاع-uid"),
])

# ═══ ٢) octa-core.js — octaTrack يرجع للـuid المحفوظ + تتبع فتح السهم ═══
patch("assets/js/octa-core.js", [
("""  var body = JSON.stringify({
  event: event || 'page_view',
  page: String(page || '').slice(0, 32),
  label: String(label || '').slice(0, 24),
  uid: (window.OCTA_USER_ID || '')
  });""",
"""  /* ⭐ ١٤ نوفمبر ٢٠٢٦ — الـuid بيرجع للـuid المحفوظ في localStorage
     (بعد التحديث الـwindow بيتصفّر) ⇒ كل حدث ليه uid ⇒ السجل بيتحدّث. */
  var _uid = window.OCTA_USER_ID || '';
  if (!_uid) { try { _uid = localStorage.getItem('octa_uid') || ''; } catch (e) { } }
  var body = JSON.stringify({
  event: event || 'page_view',
  page: String(page || '').slice(0, 32),
  label: String(label || '').slice(0, 24),
  uid: _uid
  });""", "core-uid"),
("""function analyzeStock(code) {
  console.log('🔍 analyzeStock:', code);""",
"""function analyzeStock(code) {
  console.log('🔍 analyzeStock:', code);
  /* ⭐ ١٤ نوفمبر ٢٠٢٦ — نسجّل السهم اللي المستخدم فتحه (التفضيل الحقيقي) */
  try { octaTrack('action', 'stock', String(code || '').slice(0, 24)); } catch (e) { }""", "core-سهم"),
])

# ═══ ٣) octa-filters.js — تتبّع الفلاتر ═══
patch("assets/js/octa-filters.js", [
("""function fzGo(id){
  const t = FZ_TABS.find(x=>x.id===id); if (!t) return;
  FZ_ACTIVE = id;""",
"""function fzGo(id){
  const t = FZ_TABS.find(x=>x.id===id); if (!t) return;
  FZ_ACTIVE = id;
  /* ⭐⭐ ١٤ نوفمبر ٢٠٢٦ — نسجّل الفلتر اللي المستخدم فتحه.
     ⛔ قبل كده مفيش ولا حدث action مبعوت ⇒ «actions = 0» ⇒
     مكنش في أي طريقة نعرف أنهي فلتر الناس بتحبه.
     ⭐ label = كود الفلتر (safety/income/moment/value/qual/liquid/growth/cash/best/five/triple) */
  try { octaTrack('action', 'filter', String(id).slice(0, 24)); } catch (e) { }""", "filters-تتبّع"),
])
print("\n✅ إصلاح الواجهة اتعمل")
