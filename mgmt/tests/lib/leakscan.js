/* ══════════════════════════════════════════════════════════════════════
   🔍 ماسح التسرّب (مشترك بين الاختبارات) — أعداد فقط
   ──────────────────────────────────────────────────────────────────────
   ⛔ ما بنطبعش أي قيمة (اسم/إيميل/IP) — الأعداد فقط.
   ⛔ الهدف: قياس «كام بيانات شخصية» موجودة في الملف/الرد.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const IPV4_RE =
  /(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\w.])/g;

/* ⛔ عناوين_loopback/المحجوزة — مش بيانات مستخدمين */
const IPV4_ALLOW = new Set(['0.0.0.0', '127.0.0.1', '255.255.255.255', '1.1.1.1']);

/**
 * ⛔ يرجّع {emails, ips, hosts} أعداد فقط + المجموعات (للاستخدام الداخلي).
 */
function scan(text) {
  const emails = new Set((String(text).match(EMAIL_RE) || []));
  const ips = new Set(
    (String(text).match(IPV4_RE) || []).filter((ip) => !IPV4_ALLOW.has(ip))
  );
  const hosts = new Set(
    (String(text).match(/[A-Za-z0-9\-]+\.(?:up\.railway\.app|workers\.dev)/g) || [])
  );
  return {
    emails: emails.size,
    ips: ips.size,
    hosts: hosts.size,
    emailSet: emails,
    ipSet: ips,
    hostSet: hosts,
  };
}

module.exports = { scan, EMAIL_RE, IPV4_RE };
