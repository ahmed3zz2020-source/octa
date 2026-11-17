/* ══════════════════════════════════════════════════════════════════════
   🧪 بيانات اختبارية للوحة الإدارة (synthetic — مش بيانات حقيقية)
   ──────────────────────────────────────────────────────────────────────
   ⛔ كل الإيميلات على example.invalid وكل الـIPs من نطاق الاختبار
      203.0.113.0/24 (RFC 5737) ⇒ مفيش أي بيانات مستخدمين حقيقية.
   ⛔ الهدف: تشغيل لوحة الإدارة كاملة (٨ أقسام) بدون ما نلمس الإنتاج.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const ORIGIN = 'https://octa-prices-production-4ccb.up.railway.app';

const MONTHLY = {
  ok: true,
  total: 3,
  pin_set_n: 2,
  snapshot_id: '20260101-120000-test',
  analytics: {
    events_total: 120, events_7d: 30, events_30d: 120,
    active_7d: 2, active_30d: 3, tracked_users: 3, anon_30d: 1,
    top_pages: [['stocks', 40], ['screener', 30]],
    by_event: [['page_view', 110], ['signup', 3]],
    top_actions: [], growth: [['2026-01', 3]],
  },
  users: [
    { id: 'uidA1', name: 'مستخدم أول', email: 'first@example.invalid', created_iso: '2026-01-01 09:00', hits: 80, last_seen: '2026-01-01 11:30', session_min: 120, pin_set: true, active_7d: true, active_30d: true },
    { id: 'uidB2', name: 'مستخدم تاني', email: 'second@example.invalid', created_iso: '2026-01-01 09:10', hits: 20, last_seen: '2026-01-01 10:00', session_min: 40, pin_set: true, active_7d: true, active_30d: true },
    { id: 'uidC3', name: 'زائر', email: '', created_iso: '2026-01-01 09:20', hits: 0, last_seen: '2026-01-01 09:20', session_min: 0, pin_set: false, active_7d: false, active_30d: true },
  ],
};

const USERS = {
  ok: true,
  n: 3,
  users: [
    { uid: 'uidA1', name: 'مستخدم أول', email: 'first@example.invalid', pin_set: true, devices: 2, login_count: 12, last_login: 1767260000, watch: 2, keys: ['a', 'b'] },
    { uid: 'uidB2', name: 'مستخدم تاني', email: 'second@example.invalid', pin_set: true, devices: 1, login_count: 3, last_login: 1767250000, watch: 1, keys: ['a'] },
    { uid: 'uidC3', name: 'زائر', email: '', pin_set: false, devices: 0, login_count: 0, last_login: 0, watch: 0, keys: [] },
  ],
};

const LOGINS = {
  ok: true,
  users: [
    {
      name: 'مستخدم أول', email: 'first@example.invalid', login_count: 12,
      logins: [
        { t: 1767250000, via: 'pin', dev: 'dev0000000001', ip: '203.0.113.10', newdev: true },
        { t: 1767253600, via: 'challenge', dev: 'dev0000000001', ip: '203.0.113.10', newdev: false },
        { t: 1767257200, via: 'pin', dev: 'dev0000000002', ip: '203.0.113.11', newdev: false },
      ],
    },
    {
      name: 'مستخدم تاني', email: 'second@example.invalid', login_count: 3,
      logins: [
        { t: 1767240000, via: 'signup', dev: 'dev0000000003', ip: '203.0.113.12', newdev: true },
        { t: 1767243600, via: 'pin', dev: 'dev0000000003', ip: '203.0.113.12', newdev: false },
      ],
    },
  ],
};

const EVENTS = {
  ok: true,
  n: 2,
  events: [
    { ts: 1767250000, u: 'uidA1', ev: 'page_view', p: 'stocks', l: 'أولى' },
    { ts: 1767251000, u: 'uidB2', ev: 'signup', p: 'gate', l: 'تسجيل' },
  ],
};

const SUBS = {
  ok: true,
  count: 2,
  items: [
    { uid: 'uidA1', email: 'first@example.invalid', plan: 'pro', days: 30, price: 350, method: 'admin', note: 'test', at: 1767200000, at_date: '2026-01-01 10:00' },
    { uid: 'uidB2', email: 'second@example.invalid', plan: 'pro', days: 365, price: 3500, method: 'admin', note: 'test', at: 1767100000, at_date: '2025-12-30 10:00' },
  ],
};

const TICKER = {
  snapshot_id: '20260101-120000-test',
  ticker: [
    { id: 'tk-egx', label: 'EGX30', value: 30000.5, change: 0.8, trend: 'up', unit: '' },
    { id: 'tk-egx70', label: 'EGX70', value: 9000.25, change: -0.4, trend: 'down', unit: '' },
  ],
};

const PRICES = {
  lastUpdate: '2026-01-01T12:00:00Z',
  snapshot_id: '20260101-120000-test',
  egx30: [
    { code: 'TEST', name: 'سهم اختباري', price: 100.5, change: 1.2 },
    { code: 'OTHER', name: 'سهم اختباري تاني', price: 50.25, change: -0.5 },
  ],
};

const WATCH = {
  ok: true,
  items: [
    { code: 'TEST', hi: 90, lo: null, at: 1767200000 },
    { code: 'OTHER', hi: null, lo: 60, at: 1767100000 },
  ],
};

function j(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/* ⛔ ردّ الواجهة الخلفية المزيفة */
function upstream(url) {
  const path = String(url).replace(ORIGIN, '').split('?')[0];
  if (path === '/api/admin/monthly') return j(MONTHLY);
  if (path === '/api/admin/users') return j(USERS);
  if (path === '/api/admin/logins') return j(LOGINS);
  if (path === '/api/admin/events') return j(EVENTS);
  if (path === '/api/subscriptions/log') return j(SUBS);
  if (path === '/api/subscriptions/activate') return j({ ok: true, subscription: { plan: 'pro' } });
  if (path === '/api/ticker') return j(TICKER);
  if (path === '/api/prices') return j(PRICES);
  if (path === '/api/alerts/watch') return j(WATCH);
  if (path === '/api/admin/mint_session') return j({ ok: true, token: 'e2e-user-token' });
  if (path === '/api/admin/reset_chal') return j({ ok: true, reset: 'x' });
  if (path.startsWith('/api/admin/user/')) return j({ ok: true, deleted: true });
  return j({ ok: false, error: 'المسار ده محمي' }, 401);
}

module.exports = {
  ORIGIN, MONTHLY, USERS, LOGINS, EVENTS, SUBS, TICKER, PRICES, WATCH, upstream,
};
