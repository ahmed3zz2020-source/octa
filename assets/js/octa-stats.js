/* ══════════════════════════════════════════════════════════════
  📊 لوحة الإحصائيات — بتاعتك انت بس
  ══════════════════════════════════════════════════════════════
  بتقولي:
  · كام زائر في 1 يوم / 7 أيام / 30 يوم
  · كام واحد سجّل
  · أكتر صفحة بيتفتح
  · أكتر سهم بيتشاور عليه
  · كام رجع تاني يوم
  ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function apiBase() {
  try { return (typeof OCTA_API !== 'undefined' && OCTA_API) || ''; }
  catch (e) { return ''; }
  }

  function token() {
  try { return localStorage.getItem('octa_token') || ''; } catch (e) { return ''; }
  }

  function fmt(n) {
  n = Number(n || 0);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
  }

  function esc(s) {
  return String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function bar(label, value, max) {
  var pct = max > 0 ? Math.round(value / max * 100) : 0;
  return '<div class="st-row">' +
  '<span class="st-k">' + esc(label) + '</span>' +
  '<span class="st-bar"><i style="width:' + pct + '%"></i></span>' +
  '<span class="st-v">' + fmt(value) + '</span>' +
  '</div>';
  }

  function block(title, data) {
  if (!data) return '';
  var maxP = (data.top_pages || []).reduce(function (m, x) { return Math.max(m, x[1]); }, 0);
  var maxS = (data.top_stocks || []).reduce(function (m, x) { return Math.max(m, x[1]); }, 0);

  var html = '<div class="st-card"><h3>' + esc(title) + '</h3><div class="st-kpis">' +
  '<div><b>' + fmt(data.visitors) + '</b><span>زائر</span></div>' +
  '<div><b>' + fmt(data.views) + '</b><span>فتح صفحة</span></div>' +
  '<div><b>' + fmt(data.actions) + '</b><span>تفاعل</span></div>' +
  '<div><b>' + fmt(data.signups) + '</b><span>تسجيل</span></div>' +
  '</div>';

  if (data.top_pages && data.top_pages.length) {
  html += '<div class="st-sub">📄 أكتر الصفحات</div>';
  data.top_pages.forEach(function (x) { html += bar(x[0], x[1], maxP); });
  }
  if (data.top_stocks && data.top_stocks.length) {
  html += '<div class="st-sub">📈 أكتر الأسهم</div>';
  data.top_stocks.forEach(function (x) { html += bar(x[0], x[1], maxS); });
  }
  return html + '</div>';
  }

  window.OCTAStats = {
  show: async function () {
  var host = document.getElementById('stHost');
  if (!host) { host = document.createElement('div'); host.id = 'stHost'; document.body.appendChild(host); }
  host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);' +
  'backdrop-filter:blur(6px);overflow:auto;padding:22px 14px';
  host.innerHTML = '<div style="max-width:940px;margin:0 auto;background:var(--card,#141821);' +
  'border:1px solid var(--line,#2a2f3a);border-radius:16px;padding:22px">' +
  '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
  '<h2 style="margin:0;font-size:1.15rem">📊 لوحة الإحصائيات</h2>' +
  '<button onclick="document.getElementById(\'stHost\').remove()" ' +
  'style="background:transparent;border:1px solid var(--line,#2a2f3a);color:inherit;' +
  'border-radius:8px;padding:6px 13px;cursor:pointer;font-size:.9rem">إغلاق ✕</button></div>' +
  '<div id="stBody" style="color:#888;font-size:.9rem">⏳ جاري التحميل…</div></div>';

  var t = token();
  if (!t) {
  document.getElementById('stBody').innerHTML =
  '<div style="padding:26px;text-align:center;line-height:2">' +
  '🔒 اللوحة دي محمية.<br>' +
  '<span style="opacity:.75;font-size:.85rem">سجّل دخول الأول عشان تقدر تفتحها.</span></div>';
  return;
  }

  try {
  var d = await fetch(apiBase() + '/api/stats', {
  headers: { 'Authorization': 'Bearer ' + t }
  }).then(function (r) { return r.json(); });

  if (!d.ok) {
  document.getElementById('stBody').innerHTML =
  '<div style="padding:26px;text-align:center;line-height:2">🔒 ' +
  esc(d.error || 'ممنوع') + '</div>';
  return;
  }

  var u = d.users || {};
  var html = '<div class="st-card"><h3>👥 الحسابات</h3><div class="st-kpis">' +
  '<div><b>' + fmt(u.total) + '</b><span>إجمالي</span></div>' +
  '<div><b>' + fmt(u.with_email) + '</b><span>بإيميل</span></div>' +
  '<div><b>' + fmt(u.returned_next_day) + '</b><span>رجع تاني يوم</span></div>' +
  '<div><b>' + fmt(d.total_events) + '</b><span>حدث</span></div>' +
  '</div></div>';

  html += block('📅 آخر 24 ساعة', d.days && d.days['1']);
  html += block('🗓️ آخر 7 أيام', d.days && d.days['7']);
  html += block('📆 آخر 30 يوم', d.days && d.days['30']);
  html += block('🗄️ آخر 90 يوم', d.days && d.days['90']);

  document.getElementById('stBody').innerHTML = html;
  } catch (e) {
  document.getElementById('stBody').innerHTML =
  '<div style="padding:26px;text-align:center">❌ ' + esc(e.message || 'خطأ') + '</div>';
  }
  }
  };
})();
