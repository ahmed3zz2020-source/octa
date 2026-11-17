/* ══════════════════════════════════════════════════════════════════════
   🧪 سيرفر اختبار محلي للوحة الإدارة (mgmt/tests/harness/server.js)
   ──────────────────────────────────────────────────────────────────────
   🎯 يشغّل منطق الـWorker الحقيقي (worker.js) فوق ملفات public/، وبي replying
      ببيانات اختبارية (fixtures) بدل الإنتاج.
   ⛔ مافيش أي اتصال بالإنترنت — كل الـupstream مزيف.
   ⛔ التشغيل: node mgmt/tests/harness/server.js [port]
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const fixtures = require('./fixtures.js');

const MGMT = path.join(__dirname, '..', '..');
const PUBLIC = process.env.MGMT_PUBLIC || path.join(MGMT, 'public');
const SECRET = 'e2e-session-secret';
const PASSWORD = 'e2e-password';
const ADMIN = 'e2e-admin-token';
const PORT = Number(process.argv[2] || 8791);

/* ⛔ كل طلبات الـbackend بتروح للـfixtures — مافيش شبكة */
const realFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const u = String(input);
  if (u.indexOf(fixtures.ORIGIN) === 0) return fixtures.upstream(u, init);
  return realFetch(input, init);
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
};

async function loadWorker() {
  const src = fs.readFileSync(process.env.MGMT_WORKER || path.join(MGMT, 'worker.js'), 'utf8');
  const url = 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
  const mod = await import(url);
  return mod.default;
}

/* ⛔ سيرفر ملفات ثابت (يحاكي env.ASSETS) */
const env = {
  SESSION_SECRET: SECRET,
  APP_PASSWORD: PASSWORD,
  OCTA_ADMIN_TOKEN: ADMIN,
  ASSETS: {
    async fetch(req) {
      const u = new URL(req.url);
      let rel = decodeURIComponent(u.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const file = path.join(PUBLIC, rel.replace(/^\/+/, ''));
      if (!file.startsWith(PUBLIC)) return new Response('forbidden', { status: 403 });
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        return new Response('not found', { status: 404 });
      }
      const body = fs.readFileSync(file);
      const ext = path.extname(file).toLowerCase();
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
      });
    },
  },
};

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

(async function main() {
  const worker = await loadWorker();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1:' + PORT);
      const buf = await readBody(req);
      const headers = {};
      Object.keys(req.headers).forEach((k) => { headers[k] = req.headers[k]; });
      const request = new Request(url.toString(), {
        method: req.method,
        headers: headers,
        body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : buf,
      });
      const out = await worker.fetch(request, env);
      const h = {};
      out.headers.forEach((v, k) => { h[k] = v; });
      res.writeHead(out.status, h);
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('harness error: ' + e.message);
    }
  });
  server.listen(PORT, '127.0.0.1', () => {
    process.stdout.write('HARNESS_READY ' + PORT + '\n');
  });
})();
