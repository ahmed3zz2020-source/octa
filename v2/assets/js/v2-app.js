/**
 * OCTA V2 — هيكل التطبيق (Router + State + Shell)
 * ⛔ الحالة في الذاكرة فقط — لا localStorage ولا sessionStorage ولا cookies.
 */

import { createMockProvider } from './v2-mock-provider.js';
import { renderMarket, renderStock, renderCompare, MAX_COMPARE } from './v2-views.js';
import { el, clear, ar } from './v2-format.js';

// ⛔ ?slow=1 ⇒ تأخير مصطنع (١٢٠٠ms) لاختبار حالة التحميل بشكل حتمي
const PARAMS = new URLSearchParams(location.search);
const LATENCY_MS = PARAMS.get('slow') === '1' ? 1200 : 320;
const provider = createMockProvider({ latencyMs: LATENCY_MS });

const state = {
  compare: [],                 // ⛔ ذاكرة فقط
  route: { name: 'market', arg: null }
};

const app = document.getElementById('v2-app');
const navCount = document.getElementById('v2-compare-count');
const alertBox = document.getElementById('v2-alert');

let alertTimer = null;
function notifyLimit() {
  if (!alertBox) return;
  alertBox.textContent = '⛔ المقارنة بحد أقصى ٣ أسهم — شيل سهم واحد الأول.';
  alertBox.hidden = false;
  if (alertTimer) clearTimeout(alertTimer);
  alertTimer = setTimeout(() => { alertBox.hidden = true; }, 6000);
}

function toggleCompare(symbol) {
  const i = state.compare.indexOf(symbol);
  if (i >= 0) {
    state.compare.splice(i, 1);
  } else {
    if (state.compare.length >= MAX_COMPARE) { notifyLimit(); return; }
    state.compare.push(symbol);
  }
  if (navCount) navCount.textContent = ar(state.compare.length) + '/' + ar(MAX_COMPARE);
  const active = document.querySelector('[data-testid="add-compare"][data-symbol="' + symbol + '"]');
  void active;
  route(true);
}

const ctx = {
  provider,
  state,
  navigate(name, arg) {
    const hash = '#/' + name + (arg ? '/' + arg : '');
    if (location.hash === hash) { route(); return; }
    location.hash = hash;
  },
  toggleCompare,
  notifyLimit
};

function parseHash() {
  const raw = (location.hash || '#/market').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  const name = parts[0] || 'market';
  if (name === 'stock' && parts[1]) return { name: 'stock', arg: decodeURIComponent(parts[1]) };
  if (name === 'compare') return { name: 'compare', arg: null };
  return { name: 'market', arg: null };
}

function route(repaint = false) {
  const r = parseHash();
  state.route = r;
  if (!app) return;
  clear(app);
  let view;
  if (r.name === 'stock') view = renderStock(ctx, r.arg);
  else if (r.name === 'compare') view = renderCompare(ctx);
  else view = renderMarket(ctx);
  app.appendChild(view);
  if (navCount) navCount.textContent = ar(state.compare.length) + '/' + ar(MAX_COMPARE);
  document.querySelectorAll('[data-nav]').forEach((n) => {
    n.classList.toggle('is-active', n.getAttribute('data-nav') === r.name);
  });
  if (!repaint) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => route());
document.addEventListener('DOMContentLoaded', () => {
  const mockTag = document.getElementById('v2-build-tag');
  if (mockTag) mockTag.textContent = 'نسخة تجريبية محلية — لا تتصل بأي خدمة إنتاج';
  route();
});

window.__V2_STATE__ = state;
window.__V2_READY__ = true;
