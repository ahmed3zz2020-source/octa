/* ══════════════════════════════════════════════════════════════════════
   🛡️ OCTA-MGMT — Service Worker
   ──────────────────────────────────────────────────────────────────────
   🎯 الهدف: التطبيق يبقى «زي الأپلكيشن» —
      يفتح فوراً حتى من غير نت، ويحدّث نفسه لوحده لما ينزل نسخة جديدة.

   🛡️ الجولة ١٨ (P0):
   ⛔ ١) صفحة الـshell (index.html) **مش بتتخزّن** — لأنها محمية بجلسة،
         وتخزينها معناه إن نسخة قديمة بتتعرض.
   ⛔ ٢) طلبات الـAPI دايماً من الشبكة (⛔ مافيش تخزين لبيانات شخصية).
   ⛔ ٣) التثبيت ما بيفشلش لو بعض الملفات محمية (بالجلسة) ⇒ كل ملف لوحده.
   ══════════════════════════════════════════════════════════════════════ */

const VERSION = 'octa-mgmt-v2.2.0';
/* ⛔ ملاحظة: '/' و '/index.html' مش في الكاش وقت التثبيت (محميين بجلسة،
   والتثبيت من غير جلسة كان بيفشل) — بس بيتخزّنوا بعد أول تحميل ناجح. */
const SHELL = [
  '/app.js',
  '/panel.js',
  '/panel.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/favicon.png'
];
/* ⛔ بيتخزّن بعد نجاح الطلب: الصفحة + الأصول (عشان وضع الأوفلاين يشتغل) */
const CACHEABLE = SHELL.concat(['/', '/index.html']);

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      /* ⛔ كل ملف لوحده: ملف واحد محمي ما يوقّفش التثبيت كله */
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ⛔ لما المستخدم يضغط «تحديث دلوقتي» */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ⛔ سلوك الشبكة:
   - ملفات التطبيق (shell): network-first مع fallback للـcache
     ⇒ نسخة جديدة بتتحدث، بس التطبيق بيفتح حتى من غير نت.
   - طلبات الـAPI: دايماً من الشبكة (البيانات لازم تبقى طازجة)
     والـcache بس احتياطي عند انقطاع النت. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  /* ⛔ الـAPI والـproxy: دايماً شبكة (مش بنخزّن بيانات حسّاسة) */
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).catch(() => new Response(
        JSON.stringify({ ok: false, error: 'مفيش اتصال — البيانات المعروضة محفوظة من قبل' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  /* ⛔ أي أصل تاني (Railway مثلاً) — من غير تدخل */
  if (!sameOrigin) return;

  /* ⛔ ملفات التطبيق: الشبكة الأول، فالـcache */
  e.respondWith(
    fetch(req)
      .then((res) => {
        /* ⛔ الجولة ١٨: بنخزّن الصفحة والأصول بعد نجاح الطلب فقط —
           (⛔ مافيش تخزين لطلبات الـAPI — البيانات دايماً من الشبكة). */
        if (res && res.ok && CACHEABLE.includes(url.pathname)) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => { });
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
