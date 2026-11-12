/**
 * OCTA V2 — حارس الشبكة (Net guard)
 * ---------------------------------
 * ⛔ يمنع أي طلب شبكي خارجي من داخل الواجهة (fetch / XHR / WebSocket /
 *    EventSource / sendBeacon) ويسجّل كل محاولة في
 *    window.__V2_NETWORK_ATTEMPTS__ — وهو الدليل الذي يقرأه اختبار العزل.
 * ⛔ لا يمنع طلبات نفس الأصل (نفس الـorigin) — ولا يوجد أي منها في V2.
 */
(function () {
  const attempts = [];
  window.__V2_NETWORK_ATTEMPTS__ = attempts;
  window.__V2_NETGUARD__ = { blocked: true, attempts };

  function note(kind, url) {
    attempts.push({ kind, url: String(url), at: Date.now() });
    console.warn('[V2 netguard] blocked ' + kind + ' → ' + url);
  }

  const origFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : ((input && input.url) || String(input));
    note('fetch', url);
    return Promise.reject(new Error('V2: الطلب الشبكي محظور — هذه الواجهة معزولة'));
  };
  void origFetch;

  const RealXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    note('xhr', 'XMLHttpRequest');
    throw new Error('V2: الطلب الشبكي محظور — هذه الواجهة معزولة');
  };
  window.XMLHttpRequest.prototype = RealXHR ? RealXHR.prototype : {};

  const RealWS = window.WebSocket;
  if (RealWS) {
    window.WebSocket = function (url) {
      note('websocket', url);
      throw new Error('V2: الاتصال الشبكي محظور — هذه الواجهة معزولة');
    };
  }

  const RealES = window.EventSource;
  if (RealES) {
    window.EventSource = function (url) {
      note('eventsource', url);
      throw new Error('V2: الاتصال الشبكي محظور — هذه الواجهة معزولة');
    };
  }

  if (navigator.sendBeacon) {
    navigator.sendBeacon = function (url) {
      note('beacon', url);
      return false;
    };
  }
})();
