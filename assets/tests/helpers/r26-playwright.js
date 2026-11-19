/* ══════════════════════════════════════════════════════════════
  🔎 محرّك تشغيل Chromium الحقيقي لاختبارات R26
  ──────────────────────────────────────────────────────────────
  📌 Playwright ممكن يكون:
     ① مثبّت في الريبو (node_modules)
     ② مثبّت عالمياً (/usr/local/lib/node_modules)
     ③ محدد بمتغيّر بيئة (PLAYWRIGHT_PATH)
  📌 والمتصفح نفسه ممكن يكون:
     ① في الكاش الافتراضي لـPlaywright
     ② في مسار محدد (CHROMIUM_PATH)
     ③ في /root/.cache/ms-playwright/chromium-<رقم>
  📌 ⛔ لو المتصفح مش موجود ⇒ بنقول بوضوح (مش ادعاء إننا قِسنا).
  ══════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function findPlaywright() {
  const tries = [];
  if (process.env.PLAYWRIGHT_PATH) tries.push(process.env.PLAYWRIGHT_PATH);
  tries.push('playwright');
  tries.push('/usr/local/lib/node_modules/playwright');
  tries.push('/usr/lib/node_modules/playwright');
  try {
    const home = os.homedir();
    tries.push(path.join(home, '.npm-global', 'lib', 'node_modules', 'playwright'));
  } catch (e) { }
  for (const t of tries) {
    try {
      const mod = require(t);
      if (mod && mod.chromium) return mod;
    } catch (e) { /* نكمّل */ }
  }
  return null;
}

function findChromium() {
  const tries = [];
  if (process.env.CHROMIUM_PATH) tries.push(process.env.CHROMIUM_PATH);
  const roots = [];
  try { roots.push(path.join(os.homedir(), '.cache', 'ms-playwright')); } catch (e) { }
  try { roots.push('/root/.cache/ms-playwright'); } catch (e) { }
  try { roots.push(path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')); } catch (e) { }
  for (const root of roots) {
    let names = [];
    try { names = fs.readdirSync(root); } catch (e) { names = []; }
    for (const n of names.filter((x) => x.indexOf('chromium') === 0).sort().reverse()) {
      const p = path.join(root, n, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) { tries.push(p); }
      const mac = path.join(root, n, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
      if (fs.existsSync(mac)) { tries.push(mac); }
    }
  }
  for (const t of tries) {
    try { if (fs.existsSync(t)) return t; } catch (e) { }
  }
  return null;
}

let cachedPath = null;

/** بيشغّل Chromium الحقيقي. بيرمي خطأ واضح لو مش متاح. */
async function launchChromium(opts) {
  const pw = findPlaywright();
  if (!pw) {
    throw new Error('Playwright مش متاح — ثبّته (npm i -D playwright) أو حدّد PLAYWRIGHT_PATH');
  }
  const exe = findChromium();
  if (!exe) {
    /* نحاول المسار الافتراضي لـPlaywright قبل ما نفشل */
    let def = null;
    try { def = pw.chromium.executablePath(); } catch (e) { def = null; }
    if (!def || !fs.existsSync(def)) {
      throw new Error('Chromium غير متاح — حدّد CHROMIUM_PATH أو نزّل المتصفح');
    }
  }
  cachedPath = exe || def;
  const browser = await pw.chromium.launch({
    executablePath: cachedPath,
    /* ⛔ التوجيه: octa.test ⇒ 127.0.0.1 (من غير DNS خارجي خالص)
       📌 السبب: البوابة بتقفل نفسها على localhost (وضع التطوير)
          ⇒ بنستخدم اسم مضيف محلي resolved محلياً. */
    args: (opts && opts.args) || [
      '--no-sandbox', '--disable-dev-shm-usage',
      '--host-resolver-rules=MAP octa.test 127.0.0.1',
    ],
  });
  return { browser: browser, executablePath: cachedPath, playwright: pw };
}

function CHROME_INFO() {
  return {
    executablePath: cachedPath,
    node: process.version,
    platform: os.platform(),
  };
}

module.exports = { launchChromium: launchChromium, CHROME_INFO: CHROME_INFO, findChromium: findChromium, findPlaywright: findPlaywright };
