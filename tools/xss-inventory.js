/* ══════════════════════════════════════════════════════════════════════
   🛡️ جرد مواضع innerHTML في واجهة OCTA — SEC-024 (الجولة ١٨)
   ──────────────────────────────────────────────────────────────────────
   📌 الغرض: قائمة مرجعية بكل مواضع إدراج HTML في assets/js/*.js
      مع: السطر · الحقل/المتغيّر · هل هو مُرمَّز (escaped)؟ · الخطورة.
   📌 الأداة دي **قراءة بس** — مافيش تعديل على الملفات.
   📌 التشغيل:  node tools/xss-inventory.js            (ملخّص)
      node tools/xss-inventory.js --md docs/XSS-INVENTORY.md   (يكتب الجدول)
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'assets', 'js');

/* ⛔ دوال الترميز المعروفة في المشروع (وظيفياً) */
const ESCAPERS = [
  'esc', 'ssEsc', 'octaEsc', 'naEsc', 'escHtml', 'escapeHtml',
  'escAttr', 'sanitize', 'encodeURIComponent', 'escapeAttr'
];

/* ⛔ أسماء المتغيّرات اللي المفروض تكون أرقام/قيم ثابتة (مش بيانات مستخدم) */
const SAFE_NAMES = [
  'i', 'n', 'idx', 'index', 'len', 'length', 'cnt', 'count', 'num', 'total',
  'page', 'limit', 'offset', 'level', 'lv', 'col', 'row', 'w', 'h', 'x', 'y',
  'top', 'bottom', 'left', 'right', 'pad', 'gap', 'size', 'delay', 'ms', 'sec'
];

/* ⛔ أسماء الحقول اللي **بيانات مستخدم/الـAPI** (خطورة أعلى) */
const API_FIELDS = [
  'name', 'title', 'note', 'notes', 'text', 'label', 'desc', 'description',
  'comment', 'message', 'reason', 'why', 'error', 'hint', 'code', 'symbol',
  'sector', 'industry', 'company', 'summary', 'headline', 'body', 'content',
  'value', 'answer', 'question', 'username', 'email', 'user', 'author',
  'source', 'provider', 'analyst', 'rating', 'grade', 'status', 'state',
  'plan', 'package', 'tier', 'strategy', 'reason_ar', 'note_ar', 'tag',
  'tags', 'category', 'categories', 'action', 'advice', 'signal', 'verdict'
];

/* ──────────────────────────────────────────────────────────────────────
   استخراج نص التعبير بعد '=' حتى نهاية الجملة
   ────────────────────────────────────────────────────────────────────── */
function extractExpr(src, from) {
  let i = from;
  let depth = 0;
  let inStr = null;
  const tplStack = [];      /* عمق الأقواس جوّه كل قالب جمل */
  let prev = '';            /* آخر محرف غير مسافة (لتشخيص regex literal) */
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (tplStack.length) {
      /* جوّه قالب جمل: بنتابع الأقواس جوّه ${...} */
      if (c === '\\') { i++; continue; }
      if (c === '{') { tplStack[tplStack.length - 1]++; continue; }
      if (c === '}') {
        tplStack[tplStack.length - 1]--;
        if (tplStack[tplStack.length - 1] === 0) { tplStack.pop(); }
        continue;
      }
      if (c === '`') { tplStack.pop(); continue; }
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '`') { tplStack.push(0); continue; }
    /* ⛔ regex literal — لازم نتجاهله (فيه «»» و«/» و«;») */
    if (c === '/') {
      const p = prev;
      const isRegex = p === '' || '(,=:[!&|?{};+-*%~^<>'.indexOf(p) > -1;
      if (isRegex) {
        let j = i + 1, inClass = false;
        while (j < src.length) {
          const d = src[j];
          if (d === '\\') { j += 2; continue; }
          if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) break;
          else if (d === '\n') break;
          j++;
        }
        i = j;
        prev = '/';
        continue;
      }
    }
    if (c === '(' || c === '[' || c === '{') { depth++; prev = c; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; prev = c; continue; }
    if (c === ';' && depth === 0) break;
    if (!/\s/.test(c)) prev = c;
  }
  return { expr: src.slice(from, i), end: i };
}

/* 🐞🛡️ المواضع اللي اتصلّحت في الجولة ١٨ (SEC-024) — ٨ مواضع */
const FIXED = [
  { file: 'assets/js/octa-pages.js', fn: 'armNews', what: 'جدول الأحداث المعلنة (اسم الشركة/النوع/القيمة)' },
  { file: 'assets/js/octa-pages.js', fn: 'renderStrategies', what: 'اسم الاستراتيجية + التركيز + ملاحظات الفلتر' },
  { file: 'assets/js/octa-pages.js', fn: 'renderIntel', what: 'اسم السهم + الأسباب + أوصاف المخاطر' },
  { file: 'assets/js/octa-pages.js', fn: 'loadEarlyOpps', what: 'بطاقات الفرص المبكرة' },
  { file: 'assets/js/octa-pages.js', fn: 'dvTabs', what: 'أقرب استحقاق (رمز + اسم)' },
  { file: 'assets/js/octa-pages.js', fn: 'openTradingView', what: 'مودال TradingView (رمز + اسم)' },
  { file: 'assets/js/octa-core.js', fn: 'searchStock', what: 'نص البحث (reflected) + اسم السهم' },
  { file: 'assets/js/octa-core.js', fn: 'renderAiError', what: 'رسالة الخطأ من الـAPI' },
  { file: 'assets/js/octa-pages.js', fn: 'renderStockPage', what: 'صفحة السهم: الاسم + القطاع + التفسير + الإفصاحات' }
];

/* ══════════════════════════════════════════════════════════════════════
   🛡️ الجولة ١٩ — تصنيف المواضع غير المُرمَّزة (مصدر البيانات + قابلية الاستغلال)
   ⛔ المراجع المستقل طلب: «تصنيف الـ١٤٩ موضعًا حسب مصدر البيانات وقابلية الاستغلال»
   ⛔ واللي يكشف إن الحقل بيانات API/مستخدم ولا نص ثابت ولا رقم.
   ══════════════════════════════════════════════════════════════════════ */

/* ⛔ أسماء المتغيّرات اللي مصدرها **مدخل مستخدم** (نص اللي المستخدم كتبه) */
const USER_INPUT_NAMES = [
  'search', 'query', 'q', 'typed', 'input', 'term', 'keyword', 'filter_text',
  'search_text', 'searchTerm', 'searchQ', 'userInput', 'typedText'
];

/* ⛔ أسماء المتغيّرات اللي مصدرها **رقمي/عددي** (مش نص) */
const NUMERIC_NAMES = [
  'price', 'qty', 'quantity', 'volume', 'vol', 'value', 'pct', 'pctchg', 'change',
  'score', 'final', 'total', 'sum', 'avg', 'cap', 'mcap', 'high', 'low', 'open',
  'close', 'last', 'bid', 'ask', 'eps', 'pe', 'roe', 'roi', 'yield', 'div',
  'sh', 'shares', 'n', 'num', 'count', 'len', 'size', 'rate', 'ratio', 'minutes'
];

function isUserInputName(name) {
  const n = String(name).toLowerCase();
  return USER_INPUT_NAMES.some((u) => n === u.toLowerCase() || n.indexOf(u.toLowerCase() + '_') === 0
    || n.indexOf(u.toLowerCase()) > -1 && n.length <= u.length + 8);
}

/**
 * 📌 سياق الإدراج: بنراجع النص **قبل** المتغيّر جوّه التعبير.
 * @returns {{ctx:string, detail:string}}
 */
function classifyContext(expr, off) {
  const before = expr.slice(Math.max(0, off - 60), off);
  const after = expr.slice(off, off + 80);
  /* ⛔ مقارنة (مثال: `a.status === 'upcoming'`) ⇒ القيمة **مش بتتدخّل** في الـHTML */
  if (/^\s*(?:[\w$]+(?:\.[\w$]+|\[[^\]]*\])?\s*)*(===|==|!==|!=)/.test(after))
    return { ctx: 'مقارنة', detail: 'قيمة مقارنة — مش حقن' };
  /* ⛔ حدث داخل (onclick=... etc.) — الأخطر
     ⛔ لازم نعرف إن الـattribute لسه مفتوح عند موضع المتغيّر:
        آخر `on*=` قبل المتغيّر + مافيش علامة إغلاق بعده. */
  const onIdx = before.toLowerCase().lastIndexOf('on');
  if (onIdx > -1 && /on[a-z]+\s*=/.test(before.slice(onIdx))) {
    const tail = before.slice(onIdx);
    const m = tail.match(/on[a-z]+\s*=\s*(["'])/);
    if (m) {
      const afterOpen = tail.slice(tail.indexOf(m[1]) + 1);
      const closes = afterOpen.indexOf(m[1]);
      if (closes === -1) return { ctx: 'حدث داخل', detail: 'inline event handler' };
    } else if (!/["']\s*[,)]/.test(tail.slice(tail.indexOf('=') + 1))) {
      return { ctx: 'حدث داخل', detail: 'inline event handler' };
    }
  }
  /* ⛔ رابط (href/src/action) — javascript: ممكن */
  if (/\b(href|src|action|formaction|data|poster)\s*=\s*["']?[^"']*$/i.test(before))
    return { ctx: 'رابط/مصدر', detail: 'URL context (javascript: ممكن)' };
  /* ⛔ ستايل (style=...) — CSS injection */
  if (/\bstyle\s*=\s*["']?[^"']*$/i.test(before)) return { ctx: 'ستايل', detail: 'style attribute' };
  /* ⛔ قيمة خاصية عامة */
  if (/=\s*["'][^"']*$/i.test(before) || /=\s*[^"'\s>]*$/.test(before))
    return { ctx: 'خاصية', detail: 'HTML attribute' };
  /* ⛔ نص عادي */
  return { ctx: 'نص', detail: 'HTML text node' };
}

/* 🛡️ ملاحظات يدوية على مواضع **إنذار كاذب** (سبب كل واحدة موثّق) */
const MANUAL_NOTES = {
  'assets/js/octa-pages.js:3247': '⚠️ إنذار كاذب: النص ده **مش إدراج HTML** — بناء رابط RSS، والـURL كامل بيتشفّر بـencodeURIComponent قبل الطلب ⇒ مافيش حقن.',
  'assets/js/octa-pages.js:4752': '⚠️ إنذار كاذب: `tradingViewUrl` بيتحقّق بـoctaSafeUrl قبل الإدراج (نفس الأصل بس) ⇒ مافيش javascript: .',
  'assets/js/octa-core.js:2528': '⚠️ إنذار كاذب: الرابط بيعدّي بـoctaSafeUrl (نفس الأصل بس) ⇒ مافيش javascript: .',
  'assets/js/octa-core.js:3425': '✅ مُعالَج: القيمة بقت Number(...) (تحويل رقمي) ⇒ مافيش نص من الـAPI.',
  'assets/js/octa-pages.js:5437': '⚠️ إنذار كاذب: القيمة **مقارنة** (`state===\'bull\' ? \'bull\' : ...`) ⇒ اللي بيتحقن literals معروفة مش بيانات ⇒ مافيش حقن.',
};

/**
 * 📌 مصدر البيانات: api / مستخدم / رقم / ثابت / غير معروف
 */
function classifySource(name, api) {
  if (api) return { src: 'API', srcNote: 'قيمة من رد الـAPI' };
  if (isUserInputName(name)) return { src: 'مستخدم', srcNote: 'مدخل مستخدم' };
  if (NUMERIC_NAMES.indexOf(String(name).toLowerCase()) > -1) return { src: 'رقم', srcNote: 'قيمة رقمية' };
  return { src: 'غير محدد', srcNote: 'مصدر غير مؤكد (محتاج مراجعة)' };
}

/**
 * 📌 قابلية الاستغلال: عالية / متوسطة / منخفضة
 */
function exploitability(source, ctx) {
  if ((source === 'API' || source === 'مستخدم') &&
      (ctx === 'حدث داخل' || ctx === 'رابط/مصدر' || ctx === 'خاصية' || ctx === 'ستايل'))
    return 'عالية';
  if (source === 'API' || source === 'مستخدم') return 'متوسطة';
  if (source === 'رقم') return 'منخفضة';
  return 'منخفضة (مصدر غير مؤكد)';
}

/* ──────────────────────────────────────────────────────────────────────
   استخراج المتغيّرات المُدرجة (من قوالب `${}` أو دمج `+`)
   ────────────────────────────────────────────────────────────────────── */
function extractVars(expr) {
  const out = [];
  const seen = new Set();
  const push = (name, kind, off) => {
    if (!name || seen.has(name + '|' + kind)) return;
    seen.add(name + '|' + kind);
    out.push({ name: name, kind: kind, off: off === undefined ? -1 : off });
  };

  /* ① قوالب الجمل: ${...} */
  const tpl = /\$\{([^{}]*)\}/g;
  let m;
  while ((m = tpl.exec(expr)) !== null) {
    const inner = m[1].trim();
    const esc = ESCAPERS.find((e) => new RegExp('(^|[^A-Za-z0-9_$])' + e + '\\s*\\(').test(inner));
    if (esc) continue;                 /* مُرمَّز ✔ */
    const idRe = /([A-Za-z_$][A-Za-z0-9_$]*)/g;
    let im;
    while ((im = idRe.exec(inner)) !== null) {
      push(im[1], 'template', m.index + im.index);
    }
  }

  /* ② دمج نصوص: ' + var  أو  var + ' */
  const conc = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\+|\+\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((m = conc.exec(expr)) !== null) {
    const name = m[1] || m[2];
    if (!name) continue;
    if (['Boolean', 'Number', 'String', 'parseFloat', 'parseInt', 'Math',
      'JSON', 'Date', 'encodeURIComponent', 'length'].indexOf(name) > -1) continue;
    push(name, 'concat', m.index);
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────
   هل المتغيّر مُرمَّز؟
   ────────────────────────────────────────────────────────────────────── */
function isEscaped(name, expr) {
  /* متغيّر بين قوسين دالة ترميز */
  const callRe = new RegExp('(^|[^A-Za-z0-9_$])' + name + '\\s*\\)');
  for (const e of ESCAPERS) {
    const re = new RegExp('(^|[^A-Za-z0-9_$])' + e + '\\s*\\([^()]{0,80}\\b' + name + '\\b');
    if (re.test(expr)) return e;
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────────
   هل المتغيّر بيانات من الـAPI؟
   ────────────────────────────────────────────────────────────────────── */
function isApiField(name) {
  const n = String(name).toLowerCase();
  for (const f of API_FIELDS) {
    if (n === f.toLowerCase()) return f;
    if (n.indexOf('.' + f.toLowerCase()) > -1) return f;
    if (n.indexOf('_' + f.toLowerCase()) > -1) return f;
    if (n.indexOf(f.toLowerCase() + '_') > -1) return f;
  }
  return null;
}

function isSafeName(name) {
  return SAFE_NAMES.indexOf(name) > -1;
}

/* ──────────────────────────────────────────────────────────────────────
   الفحص
   ────────────────────────────────────────────────────────────────────── */
function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const relFile = path.relative(ROOT, file);
  const rows = [];
  const re = /\.innerHTML\s*(\+?=)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const op = m[1];
    const start = m.index + m[0].length;
    const { expr, end } = extractExpr(src, start);
    const lineNo = src.slice(0, m.index).split('\n').length;
    /* 📌 الدالة الحاوية — لازم تكون **بداية سطر** (وإلا كلمة
       «function» جوّه نص أو كومنت بتضلّل) */
    let fnName = '';
    const before = src.slice(0, m.index);
    const fnRe = /^[ \t]*(?:async[ \t]+)?function[ \t]+([A-Za-z0-9_]+)/gm;
    let fm;
    while ((fm = fnRe.exec(before)) !== null) fnName = fm[1];
    const vars = extractVars(expr);
    const fields = [];
    let encodedAll = true;
    for (const v of vars) {
      if (isSafeName(v.name)) continue;
      const esc = isEscaped(v.name, expr);
      const api = isApiField(v.name);
      if (!esc) encodedAll = false;
      /* 📌 سطر الحقل نفسه (داخل التعبير) */
      let fLine = lineNo;
      if (v.off >= 0) {
        fLine = src.slice(0, m.index + m[0].length + v.off).split('\n').length;
      }
      fields.push({
        name: v.name,
        escaped: !!esc,
        escaper: esc || '',
        api: api || '',
        kind: v.kind,
        line: fLine,
        off: v.off
      });
    }
    const risky = fields.filter((f) => !f.escaped)
      /* ⛔ دوال الترميز نفسها (مثل `naEsc` في `arr.map(naEsc)`) مش حقن */
      .filter((f) => ESCAPERS.indexOf(f.name) === -1);
    const apiRisky = risky.filter((f) => f.api);
    /* 🛡️ الجولة ١٩ — تصنيف كل موضع غير مُرمَّز (مصدر + سياق + قابلية) */
    for (const f of risky) {
      const c = classifyContext(expr, f.off >= 0 ? f.off : 0);
      const s = classifySource(f.name, f.api);
      f.ctx = c.ctx;
      f.ctxDetail = c.detail;
      f.source = s.src;
      f.sourceNote = s.srcNote;
      f.exploit = exploitability(s.src, c.ctx);
      /* ⛔ مقارنة ⇒ مافيش حقن (الأسوأ انذار كاذب) */
      if (c.ctx === 'مقارنة') f.exploit = 'منخفضة (مقارنة — مش حقن)';
      /* 🛡️ ملاحظة يدوية موثّقة */
      const note = MANUAL_NOTES[relFile + ':' + f.line];
      if (note) { f.manualNote = note; f.exploit = 'منخفضة (ملاحظة يدوية — راجع السبب)'; }
    }
    const fixed = FIXED.find((x) => x.file === relFile && x.fn === fnName);
    rows.push({
      file: relFile,
      line: lineNo,
      fn: fnName,
      op: op,
      expr: expr.replace(/\s+/g, ' ').slice(0, 220),
      fields: fields,
      risky: risky,
      apiRisky: apiRisky,
      severity: apiRisky.length ? 'عالية'
        : (risky.length ? 'متوسطة' : 'منخفضة'),
      encoded: risky.length === 0,
      fixed: fixed || null
    });
    re.lastIndex = end;
  }
  return rows;
}

function main() {
  const files = fs.readdirSync(JS_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'vendor')
    .map((f) => path.join(JS_DIR, f));
  let all = [];
  for (const f of files) all = all.concat(scanFile(f));

  const apiRows = all.filter((r) => r.apiRisky.length > 0)
    .sort((a, b) => (b.apiRisky.length - a.apiRisky.length) || (a.file < b.file ? -1 : 1));
  const anyRisky = all.filter((r) => r.risky.length > 0);

  if (process.argv.indexOf('--md') > -1) {
    const outPath = path.join(ROOT, process.argv[process.argv.indexOf('--md') + 1]);
    const md = [];
    md.push('# جرد مواضع innerHTML — واجهة OCTA (SEC-024 · الجولة ١٨)');
    md.push('');
    md.push('> مولَّد بـ `node tools/xss-inventory.js --md docs/XSS-INVENTORY.md` — أداة قراءة بس (مافيش تعديل).');
    md.push('');
    md.push('## الأرقام');
    md.push('');
    md.push('- إجمالي مواضع إدراج HTML في `assets/js/*.js`: **' + all.length + '**');
    md.push('- مواضع فيها إدراج **غير مُرمَّز** (أي متغيّر): **' + anyRisky.length + '**');
    md.push('- مواضع فيها إدراج **غير مُرمَّز** لحقل من الـAPI: **' + apiRows.length + '**');
    md.push('- مواضع اتصلّحت في الجولة ١٨: **' + FIXED.length + '** (انظر جدول الإصلاح)');
    md.push('');
    md.push('## المواضع اللي اتصلّحت — SEC-024');
    md.push('');
    md.push('| # | الملف | الدالة | الحقول اللي اترمَّزت | الاختبار |');
    md.push('|---|---|---|---|---|');
    const TEST_FOR = {
      armNews: 'SEC-024-①', renderStrategies: 'SEC-024-②',
      renderIntel: 'SEC-024-③', loadEarlyOpps: 'SEC-024-④',
      dvTabs: 'SEC-024-⑤', openTradingView: 'SEC-024-⑥',
      searchStock: 'SEC-024-⑦', renderAiError: 'SEC-024-⑧',
      renderStockPage: 'SEC-024-⑨'
    };
    FIXED.forEach((x, i) => {
      md.push('| ' + (i + 1) + ' | `' + x.file + '` | `' + x.fn + '` | ' + x.what +
        ' | `' + (TEST_FOR[x.fn] || '') + '` |');
    });
    md.push('');
    md.push('## جدول المواضع (غير مُرمَّز + حقل من الـAPI) — مرتّبة بالخطورة');
    md.push('');
    md.push('| # | الملف:السطر | الدالة | الحقل | مُرمَّز؟ | الخطورة |');
    md.push('|---|---|---|---|---|---|');
    let i = 0;
    for (const r of apiRows) {
      for (const f of r.apiRisky) {
        i++;
        md.push('| ' + i + ' | `' + r.file + ':' + f.line + '` | `' + (r.fn || '—') + '` | `' + f.name +
          '` | ❌ | ' + r.severity + ' |');
      }
    }
    md.push('');
    md.push('## كل المواضع (ملخّص بالملف)');
    md.push('');
    md.push('| الملف | عدد المواضع | غير مُرمَّز | غير مُرمَّز + حقل API |');
    md.push('|---|---|---|---|');
    const byFile = {};
    for (const r of all) {
      const k = r.file;
      if (!byFile[k]) byFile[k] = { t: 0, r: 0, a: 0 };
      byFile[k].t++;
      if (r.risky.length) byFile[k].r++;
      if (r.apiRisky.length) byFile[k].a++;
    }
    for (const k of Object.keys(byFile).sort((x, y) => byFile[y].t - byFile[x].t)) {
      md.push('| `' + k + '` | ' + byFile[k].t + ' | ' + byFile[k].r + ' | ' + byFile[k].a + ' |');
    }
    md.push('');
    md.push('## كل المواضع (تفصيلي)');
    md.push('');
    md.push('| الملف:السطر | الدالة | الحقول المُدرجة | مُرمَّز؟ | الخطورة |');
    md.push('|---|---|---|---|---|');
    for (const r of all.sort((a, b) => (a.file < b.file ? -1 : (a.file > b.file ? 1 : a.line - b.line)))) {
      const fs2 = r.fields.map((f) => '`' + f.name + '`' + (f.escaped ? ' ✅' : ' ❌')).join(' · ') || '—';
      md.push('| `' + r.file + ':' + r.line + '` | `' + (r.fn || '—') + '` | ' + fs2 + ' | ' +
        (r.encoded ? '✅' : '❌') + ' | ' + r.severity + ' |');
    }
    md.push('');
    md.push('## الباقي — ترشيح للجولة الجاية (أعلى ١٠ مواضع متبقية)');
    md.push('');
    md.push('| # | الملف:السطر | الدالة | الحقول غير المُرمَّزة |');
    md.push('|---|---|---|---|');
    let k = 0;
    for (const r of all.filter((x) => x.risky.length > 0 && !x.fixed)
      .sort((a, b) => (b.apiRisky.length - a.apiRisky.length) || (b.risky.length - a.risky.length))) {
      k++;
      if (k > 10) break;
      const names = (r.apiRisky.length ? r.apiRisky : r.risky).slice(0, 8)
        .map((f) => '`' + f.name + '`').join(' · ');
      md.push('| ' + k + ' | `' + r.file + ':' + r.line + '` | `' + (r.fn || '—') + '` | ' +
        names + (r.apiRisky.length ? '' : ' (أرقام/ثوابت — اِختبار يدوي)') + ' |');
    }
    md.push('');
    md.push('> ملاحظة: أدوات الفحص بتعتبر «غير مُرمَّز» أي إدراج نصّي بحقل متغيّر.');
    md.push('> بعض المواضع أرقام/قيم ثابتة (اِختبار يدوي مطلوب قبل أي تعديل).');
    md.push('');
    fs.writeFileSync(outPath, md.join('\n') + '\n', 'utf8');
    console.log('📝 كُتب: ' + path.relative(ROOT, outPath));
    console.log('   المواضع: ' + all.length + ' · غير مُرمَّز: ' + anyRisky.length +
      ' · غير مُرمَّز+API: ' + apiRows.length);
    return;
  }

  /* 🛡️ الجولة ١٩ — إخراج JSON (للإصلاح الآلي المقطوع) */
  if (process.argv.indexOf('--json') > -1) {
    const outPath = path.join(ROOT, process.argv[process.argv.indexOf('--json') + 1]);
    const flat = [];
    for (const r of all) {
      for (const f of r.risky) {
        flat.push({
          file: r.file, line: f.line, name: f.name, source: f.source,
          ctx: f.ctx, exploit: f.exploit, off: f.off,
          expr: r.expr.slice(0, 300),
        });
      }
    }
    fs.writeFileSync(outPath, JSON.stringify(flat, null, 1), 'utf8');
    console.log('📝 كُتب: ' + path.relative(ROOT, outPath) + ' · ' + flat.length + ' حقل');
    return;
  }

  /* 🛡️ الجولة ١٩ — تصنيف كامل (مصدر البيانات + سياق + قابلية الاستغلال) */
  if (process.argv.indexOf('--triage') > -1) {
    const outPath = path.join(ROOT, process.argv[process.argv.indexOf('--triage') + 1]);
    const flat = [];
    for (const r of all) {
      for (const f of r.risky) {
        flat.push({ r, f });
      }
    }
    const bySource = {}, byCtx = {}, byExploit = {};
    for (const x of flat) {
      bySource[x.f.source] = (bySource[x.f.source] || 0) + 1;
      byCtx[x.f.ctx] = (byCtx[x.f.ctx] || 0) + 1;
      byExploit[x.f.exploit] = (byExploit[x.f.exploit] || 0) + 1;
    }
    const ORDER = { 'عالية': 0, 'متوسطة': 1, 'منخفضة': 2 };
    flat.sort((a, b) => (ORDER[a.f.exploit] - ORDER[b.f.exploit]) ||
      (a.r.file < b.r.file ? -1 : a.r.file > b.r.file ? 1 : a.r.line - b.r.line));
    const md = [];
    md.push('# تصنيف مواضع إدراج HTML غير المُرمَّزة — الجولة ١٩ (SEC-024)');
    md.push('');
    md.push('> مولَّد بـ `node tools/xss-inventory.js --triage docs/XSS-TRIAGE-R19.md` — أداة قراءة بس (مافيش تعديل على الكود).');
    md.push('> ⛔ التصنيف **تقريبي** (نمطي): «مصدر غير مؤكد» = محتاج مراجعة يدوية — مش معناه ثغنة.');
    md.push('');
    md.push('## الأرقام');
    md.push('');
    md.push('- إجمالي مواضع إدراج HTML: **' + all.length + '**');
    md.push('- مواضع فيها إدراج غير مُرمَّز (موضع/سطر): **' + anyRisky.length + '**');
    md.push('- عدد الحقول غير المُرمَّزة جوهها: **' + flat.length + '**');
    md.push('');
    md.push('### حسب مصدر البيانات');
    md.push('');
    md.push('| المصدر | العدد |');
    md.push('|---|---|');
    for (const k of Object.keys(bySource).sort((x, y) => bySource[y] - bySource[x]))
      md.push('| ' + k + ' | ' + bySource[k] + ' |');
    md.push('');
    md.push('### حسب سياق الإدراج');
    md.push('');
    md.push('| السياق | العدد |');
    md.push('|---|---|');
    for (const k of Object.keys(byCtx).sort((x, y) => byCtx[y] - byCtx[x]))
      md.push('| ' + k + ' | ' + byCtx[k] + ' |');
    md.push('');
    md.push('### حسب قابلية الاستغلال');
    md.push('');
    md.push('| القابلية | العدد |');
    md.push('|---|---|');
    for (const k of Object.keys(byExploit).sort((x, y) => ORDER[x] - ORDER[y]))
      md.push('| ' + k + ' | ' + byExploit[k] + ' |');
    md.push('');
    md.push('## الجدول الكامل (كل موضع غير مُرمَّز)');
    md.push('');
    md.push('| # | الملف:السطر | الدالة | الحقل | المصدر | السياق | القابلية |');
    md.push('|---|---|---|---|---|---|---|');
    let i = 0;
    for (const x of flat) {
      i++;
      md.push('| ' + i + ' | `' + x.r.file + ':' + x.f.line + '` | `' + (x.r.fn || '—') + '` | `' +
        x.f.name + '` | ' + x.f.source + ' | ' + x.f.ctx + ' | ' + x.f.exploit + ' |');
    }
    md.push('');
    md.push('## قاعدة التصنيف');
    md.push('');
    md.push('- **المصدر**: `API` = اسم حقل من رد الـAPI · `مستخدم` = اسم متغيّر مشتق من مدخل المستخدم · `رقم` = قيمة رقمية · `غير محدد` = محتاج مراجعة يدوية.');
    md.push('- **السياق**: `حدث داخل` = جوّه `onclick=` (الأخطر) · `رابط/مصدر` = `href/src` (ممكن `javascript:`) · `خاصية` = جوّه قيمة خاصية · `ستايل` = جوّه `style` · `نص` = نص عادي.');
    md.push('- **القابلية**: عالية = (API أو مستخدم) في سياق إدراج (حدث/رابط/خاصية/ستايل) · متوسطة = (API أو مستخدم) كنص عادي · منخفضة = رقم أو ثابت.');
    md.push('');
    fs.writeFileSync(outPath, md.join('\n') + '\n', 'utf8');
    console.log('📝 كُتب: ' + path.relative(ROOT, outPath));
    console.log('   غير مُرمَّز: ' + flat.length + ' · عالية: ' + (byExploit['عالية'] || 0) +
      ' · متوسطة: ' + (byExploit['متوسطة'] || 0));
    return;
  }

  console.log('📊 إجمالي المواضع: ' + all.length);
  console.log('📊 غير مُرمَّز (أي متغيّر): ' + anyRisky.length);
  console.log('📊 غير مُرمَّز + حقل API: ' + apiRows.length);
  for (const r of apiRows.slice(0, 40)) {
    console.log('  · ' + r.file + ':' + r.line + ' → ' +
      r.apiRisky.map((f) => f.name).join(', '));
  }
}

main();
