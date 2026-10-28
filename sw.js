/* ══════════════════════════════════════════════════════════════════════
   🛡️ OCTA — Service Worker (٢٩ أكتوبر ٢٠٢٦)
   ──────────────────────────────────────────────────────────────────────
   📌 المشكلة: لما أحمد يعمل «تثبيت» من كروم، كروم بيعمل WebAPK
   📌   (تطبيق مستقل). التطبيق ده بيفتح صفحة مita (start_url) وبيمسك
   📌   نسخة منها في كاشه — ومش بيعمل fetch جديد كل مرة.
   📌 ⛔ النتيجة: لو أول فتح حصل وقت كانت الصفحة فاضية/قديمة
   📌   ⇒ التطبيق بيتقفل على النسخة الميتة ⇒ شاشة بيضا للأبد،
   📌   والعالم في المتصفح شغّال تمام.
   ✅ الحل: Service Worker يعمل «network-first» ⇒ كل فتح يطلب الصفحة
   ✅   من الشبكة الأول، ويستخدم الكاش بس لو النت مش شغّال (أوفلاين).
   ⛔ قواعد أمان:
   ⛔   ① الـAPI (/api/*) ما نتدخّلش فيه خالص (الـworker بيوكّل).
   ⛔   ② أي طلب لبرّه الـorigin (TradingView مثلاً) ⇒ نسيبه.
   ⛔   ③ بنخزّن نسخة من كل حاجة نجيبها بنجاح (للأوفلاين).
   ⛔   ④ version الكاش بيتبدّل مع كل نشر ⇒ بنمسح القديم.
   ══════════════════════════════════════════════════════════════════════ */

const CACHE = 'octa-sw-v3';

/* 📌 هيكل التطبيق — لو النت واقع ⇒ دي اللي بتشتغل */
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/reset.html',
  '/assets/octa.css',
  '/assets/octa-tokens.css',
  '/assets/octa-logo.png',
  '/assets/icon-192.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* ⛔ allSettled: لو أصل واحد فشل (مفيش نت) ⇒ الباقي يتحمّل */
      return Promise.allSettled(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' }));
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k === CACHE) return null;
        return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* ⛔ برّه الـorigin (TradingView / سكربتات خارجية) ⇒ ما نتدخّلش */
  if (url.origin !== self.location.origin) return;

  /* ⛔ الـAPI ⇒ الـworker هو اللي بيوكّلها (مع الكوكيز والجلسة) */
  if (url.pathname.indexOf('/api/') === 0) return;

  /* ⛔⛔⛔ رابط التنظيف (?clean=1) — ٢٩ أكتوبر ٢٠٢٦
     📌 كروم **بيتجاهل** هيدر Clear-Site-Data لو الرد جاي من SW
     📌   ⇒ لازم الطلب يوصل للشبكة مباشرة.
     📌 ✅ الحل: متتدخّلش فيه خالص ⇒ يروح للشبكة ⇒ الهيدر يشتغل. */
  if (url.searchParams.get('clean') === '1') return;

  /* 📌 network-first: الشبكة الأول ⇒ نسخة جديدة دايماً */
  e.respondWith(
    fetch(req).then(function (res) {
      /* ⛔⛔⛔ ما نخزّنش رد فيه Clear-Site-Data!
         📌 لو خزّنناه وخدمناه من الكاش ⇒ كروم هيمسح بيانات
         📌   المستخدم في وقت عشوائي ⇒ logout مفاجئ. */
      var hasClear = false;
      try { hasClear = !!(res && res.headers && res.headers.get('clear-site-data')); } catch (e) { }
      if (res && res.status === 200 && res.type === 'basic' && !hasClear) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) {
          c.put(req, copy).catch(function () { });
        });
      }
      return res;
    }).catch(function () {
      /* ⛔ النت مش شغّال ⇒ الكاش */
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        /* 📌 تنقّل (فتح صفحة) ⇒ نرجع للصفحة الرئيسية من الكاش */
        if (req.mode === 'navigate') {
          return caches.match('/index.html').then(function (idx) {
            if (idx) return idx;
            return caches.match('/').then(function (root) {
              if (root) return root;
              return new Response(
                '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">' +
                '<body style="background:#0a1929;color:#fff;font:700 16px system-ui;padding:40px;text-align:center">' +
                '<p>التطبيق مش شغّال دلوقتي.</p>' +
                '<p style="font-weight:400;opacity:.8">اقفل التطبيق وافتحه تاني.</p></body></html>',
                { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              );
            });
          });
        }
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
