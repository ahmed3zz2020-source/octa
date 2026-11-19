/* ══════════════════════════════════════════════════════════════
  🔍 محرّك الفحص داخل المتصفح — R26 (UX · وصولية · أداء)
  ────────────────────────────────────────────────────────────
  📌 الكود ده بيتحقن في الصفحة من Playwright وبيقيس:
     ① التجاوز الأفقي (horizontal scroll)
     ② تداخل العناصر (عبر hit-test + تقاطع المستطيلات)
     ③ النص المقصوص (clip حقيقي بلا علامة القطع)
     ④ أهداف اللمس أقل من ٤٤ بكسل
     ⑤ نسبة تباين الألوان من CSS الفعلي (محتسبة حسابياً)
     ⑥ سمات ARIA + الأسماء المتاحة
  📌 مفيش أي اعتماد على مكتبة خارجية ⇒ كل الأرقام من المتصفح.
  ══════════════════════════════════════════════════════════════ */
'use strict';

/* نص الكود اللي بيتنفّذ جوّه المتصفح (نص حرفي) */
const AUDIT_SRC = String.raw`
(() => {
  const MAX_LIST = 150;

  /* ── أدوات ألوان ─────────────────────────────────────── */
  function parseColor(str) {
    if (!str) return null;
    const s = String(str).trim();
    if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    let m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p.length > 3 ? p[3] : 1 };
    }
    m = s.match(/^hsla?\(([^)]+)\)$/i);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean);
      const h = parseFloat(p[0]) || 0, sat = (parseFloat(p[1]) || 0) / 100;
      const li = (parseFloat(p[2]) || 0) / 100;
      const a = p.length > 3 ? parseFloat(p[3]) : 1;
      const c = (1 - Math.abs(2 * li - 1)) * sat;
      const hp = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs(hp % 2 - 1));
      let r = 0, g = 0, b = 0;
      if (hp < 1) { r = c; g = x; }
      else if (hp < 2) { r = x; g = c; }
      else if (hp < 3) { g = c; b = x; }
      else if (hp < 4) { g = x; b = c; }
      else if (hp < 5) { r = x; b = c; }
      else { r = c; b = x; }
      const mm = li - c / 2;
      return { r: Math.round((r + mm) * 255), g: Math.round((g + mm) * 255), b: Math.round((b + mm) * 255), a: a };
    }
    if (s.charAt(0) === '#') {
      const hex = s.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        const v = hex.split('').map(function (ch) { return parseInt(ch + ch, 16); });
        return { r: v[0], g: v[1], b: v[2], a: hex.length === 4 ? v[3] / 255 : 1 };
      }
      if (hex.length === 6 || hex.length === 8) {
        const v = [];
        for (let i = 0; i < hex.length; i += 2) v.push(parseInt(hex.slice(i, i + 2), 16));
        return { r: v[0], g: v[1], b: v[2], a: hex.length === 8 ? v[3] / 255 : 1 };
      }
    }
    return null;
  }
  function over(fg, bg) {
    const a = fg.a;
    return {
      r: Math.round(fg.r * a + bg.r * (1 - a)),
      g: Math.round(fg.g * a + bg.g * (1 - a)),
      b: Math.round(fg.b * a + bg.b * (1 - a)),
      a: 1
    };
  }
  function lum(c) {
    const f = [c.r, c.g, c.b].map(function (v) {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  }
  function ratio(a, b) {
    const la = lum(a), lb = lum(b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  }
  function hex(c) {
    function h(v) { const s = Math.max(0, Math.min(255, v)).toString(16); return s.length === 1 ? '0' + s : s; }
    return '#' + h(c.r) + h(c.g) + h(c.b);
  }
  /* ── ألوان التدرّج (نص متدرّج بـ background-clip: text) ────
     📌 لما النص بيتلوّن بتدرّج والـcolor شفاف ⇒ لازم نقيس
        لون التدرّج نفسه مش لون شفاف (وإلا النتيجة كاذبة).
        📌 بنقيس **أسوأ** لون في التدرّج (الأقل تبايناً) ⇒ أرقى قياس. */
  function gradientStops(bgImage) {
    if (!bgImage || bgImage.indexOf('gradient(') === -1) return [];
    const out = [];
    const re = /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/g;
    let m, i = 0;
    while ((m = re.exec(bgImage))) {
      const c = parseColor(m[0]);
      if (c) out.push({ color: c, pos: i });
      i++;
    }
    return out;
  }

  /* ── أدوات DOM ────────────────────────────────────────── */
  /* الشفافية الفعلية = حاصل ضرب شفافية كل الأجداد
     (عنصر جوّه أب opacity:0 ⇒ مش ظاهر رغم إن هو نفسه opacity:1) */
  function effectiveOpacity(el) {
    let node = el, acc = 1;
    while (node && node.nodeType === 1) {
      const st = window.getComputedStyle(node);
      const o = parseFloat(st.opacity || '1');
      if (!isFinite(o)) return 0;
      acc *= o;
      if (acc < 0.05) return acc;
      node = node.parentElement;
    }
    return acc;
  }
  function isVisible(el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    const st = window.getComputedStyle(el);
    if (!st || st.visibility === 'hidden' || st.display === 'none') return false;
    if (effectiveOpacity(el) < 0.05) return false;
    return true;
  }
  function directText(el) {
    let t = '';
    for (let i = 0; i < el.childNodes.length; i++) {
      const n = el.childNodes[i];
      if (n.nodeType === 3) t += n.nodeValue;
    }
    return t.replace(/\s+/g, ' ').trim();
  }
  function sel(el) {
    if (!el) return '';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    const t = directText(el) || (el.textContent || '').trim();
    return s + (t ? ' «' + t.slice(0, 24) + '»' : '');
  }
  function accessibleName(el) {
    const al = el.getAttribute('aria-label');
    if (al && al.trim()) return al.trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map(function (id) {
        const n = document.getElementById(id);
        return n ? (n.textContent || '').trim() : '';
      }).join(' ').trim();
      if (t) return t;
    }
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      if (el.labels && el.labels.length) {
        const t = Array.prototype.map.call(el.labels, function (l) { return (l.textContent || '').trim(); }).join(' ').trim();
        if (t) return t;
      }
      const ph = el.getAttribute('placeholder');
      if (ph && ph.trim()) return ph.trim();
      const tt = el.getAttribute('title');
      if (tt && tt.trim()) return tt.trim();
      const v = el.getAttribute('value');
      if (v && v.trim()) return v.trim();
      return '';
    }
    if (el.tagName === 'IMG') return (el.getAttribute('alt') || '').trim();
    const tt = el.getAttribute('title');
    const txt = visibleText(el);
    if (txt) return txt;
    if (tt && tt.trim()) return tt.trim();
    return '';
  }
  /* نص ظاهر بس (الـhidden nodes مش جزء من الاسم الحقيقي) */
  function visibleText(el) {
    let out = '';
    for (let i = 0; i < el.childNodes.length; i++) {
      const n = el.childNodes[i];
      if (n.nodeType === 3) { out += n.nodeValue; continue; }
      if (n.nodeType !== 1) continue;
      const st = window.getComputedStyle(n);
      if (!st || st.display === 'none' || st.visibility === 'hidden') continue;
      out += visibleText(n);
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], summary, [tabindex]';
  const FORM_INPUTS = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]), select, textarea';

  const out = {
    url: location.pathname,
    vw: window.innerWidth,
    vh: window.innerHeight,
    dpr: window.devicePixelRatio,
    hScroll: { scrollWidth: 0, clientWidth: 0, bodyScrollWidth: 0, overflow: false, offenders: [] },
    overlap: { count: 0, list: [] },
    clipped: { count: 0, list: [] },
    smallTargets: { count: 0, standalone: 0, inline: 0, list: [] },
    contrast: { count: 0, checked: 0, gradient: 0, unmeasured: 0, list: [] },
    aria: {
      buttonsNoName: [], linksNoName: [], inputsNoLabel: [], imgsNoAlt: [],
      tablesNoHeader: [], focusableAriaHidden: [], positiveTabindex: [], dupIds: [],
      roleOnNonButton: [], missingType: []
    },
    counts: { elements: 0, interactive: 0, textNodes: 0 },
  };

  const all = document.body ? document.body.querySelectorAll('*') : [];
  out.counts.elements = all.length;

  /* ── ① التجاوز الأفقي ─────────────────────────────────── */
  const de = document.documentElement;
  out.hScroll.scrollWidth = de.scrollWidth;
  out.hScroll.clientWidth = de.clientWidth;
  out.hScroll.bodyScrollWidth = document.body ? document.body.scrollWidth : 0;
  out.hScroll.overflow = de.scrollWidth > de.clientWidth + 1;
  if (out.hScroll.overflow) {
    for (let i = 0; i < all.length && out.hScroll.offenders.length < 12; i++) {
      const el = all[i];
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > de.clientWidth + 2 || r.left < -2) {
        const st = window.getComputedStyle(el);
        if (st.position === 'fixed') continue;
        out.hScroll.offenders.push({ el: sel(el), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
      }
    }
  }

  /* ── ② تداخل العناصر ──────────────────────────────────── */
  const inter = [];
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (!el.matches || !el.matches(INTERACTIVE)) continue;
    if (!isVisible(el)) continue;
    inter.push(el);
  }
  out.counts.interactive = inter.length;
  for (let i = 0; i < inter.length; i++) {
    const a = inter[i];
    const ra = a.getBoundingClientRect();
    if (ra.width === 0 || ra.height === 0) continue;
    /* hit-test في المركز */
    const cx = Math.round(ra.left + ra.width / 2);
    const cy = Math.round(ra.top + ra.height / 2);
    if (cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight) {
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== a && !a.contains(hit) && !hit.contains(a)) {
        out.overlap.count++;
        if (out.overlap.list.length < MAX_LIST) {
          out.overlap.list.push({ el: sel(a), blockedBy: sel(hit), x: cx, y: cy });
        }
      }
    }
    /* تقاطع مع إخوة */
    for (let j = i + 1; j < inter.length; j++) {
      const b = inter[j];
      if (a.parentNode !== b.parentNode) continue;
      const rb = b.getBoundingClientRect();
      if (rb.width === 0 || rb.height === 0) continue;
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 1 && h > 1) {
        const area = w * h;
        const small = Math.min(ra.width * ra.height, rb.width * rb.height);
        if (small > 0 && area / small > 0.25) {
          out.overlap.count++;
          if (out.overlap.list.length < MAX_LIST) {
            out.overlap.list.push({ el: sel(a), overlaps: sel(b), pct: Math.round(area / small * 100) });
          }
        }
      }
    }
  }

  /* ── ③ النص المقصوص ───────────────────────────────────── */
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const txt = directText(el);
    if (txt.length < 6) continue;
    if (!isVisible(el)) continue;
    const st = window.getComputedStyle(el);
    const hClip = el.scrollWidth > el.clientWidth + 1 && (st.overflowX === 'hidden' || st.overflowX === 'clip');
    const vClip = el.scrollHeight > el.clientHeight + 1 && (st.overflowY === 'hidden' || st.overflowY === 'clip');
    if (!hClip && !vClip) continue;
    const ellipsis = st.textOverflow === 'ellipsis';
    out.clipped.count++;
    if (out.clipped.list.length < MAX_LIST) {
      out.clipped.list.push({
        el: sel(el), axis: hClip ? 'x' : 'y', ellipsis: ellipsis,
        scrollW: el.scrollWidth, clientW: el.clientWidth,
        scrollH: el.scrollHeight, clientH: el.clientHeight,
        text: txt.slice(0, 40)
      });
    }
  }

  /* ── ④ أهداف اللمس ────────────────────────────────────── */
  for (let i = 0; i < inter.length; i++) {
    const el = inter[i];
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width >= 44 && r.height >= 44) continue;
    /* استثناء الروابط داخل النص (سطر مستقل) */
    let inline = false;
    const p = el.parentNode;
    if (p && p.nodeType === 1) {
      const sibText = Array.prototype.filter.call(p.childNodes, function (n) {
        return n.nodeType === 3 && n.nodeValue.trim().length > 2;
      }).length;
      const tag = el.tagName.toLowerCase();
      if ((tag === 'a' || tag === 'span' || tag === 'b') && sibText > 0) inline = true;
      if (tag === 'a' && p.tagName === 'P') inline = true;
    }
    if (inline) { out.smallTargets.inline++; continue; }
    out.smallTargets.standalone++;
    if (out.smallTargets.list.length < MAX_LIST) {
      out.smallTargets.list.push({
        el: sel(el), w: Math.round(r.width), h: Math.round(r.height),
        tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 40)
      });
    }
  }
  out.smallTargets.count = out.smallTargets.standalone;

  /* ── ⑤ تباين الألوان ──────────────────────────────────── */
  function effectiveBg(el) {
    let node = el;
    let stack = [];
    while (node && node.nodeType === 1) {
      const st = window.getComputedStyle(node);
      const c = parseColor(st.backgroundColor);
      if (c && c.a > 0) {
        stack.push(c);
        if (c.a >= 0.95) break;
      }
      node = node.parentElement;
    }
    if (!stack.length) stack.push({ r: 255, g: 255, b: 255, a: 1 });
    let acc = stack[stack.length - 1];
    for (let i = stack.length - 2; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  }
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const txt = directText(el);
    if (txt.length < 2) continue;
    if (!isVisible(el)) continue;
    const st = window.getComputedStyle(el);
    const bg = effectiveBg(el);
    const fs = parseFloat(st.fontSize) || 16;
    const fw = parseInt(st.fontWeight, 10) || 400;
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const need = large ? 3 : 4.5;
    let fg = parseColor(st.color);
    let f = null, r = null;
    if (fg && fg.a > 0) {
      f = over(fg, bg);
      r = ratio(f, bg);
    } else {
      /* نص شفاف ⇒ غالباً تدرّج مقصوص على النص ⇒ نقيس التدرّج */
      const stops = gradientStops(st.backgroundImage);
      if (stops.length) {
        let worst = null;
        for (const s of stops) {
          const c = over(s.color, bg);
          const rr = ratio(c, bg);
          if (!worst || rr < worst.ratio) worst = { color: c, ratio: rr };
        }
        f = worst.color; r = worst.ratio;
        out.contrast.gradient++;
      } else {
        out.contrast.unmeasured++;
        continue;
      }
    }
    out.contrast.checked++;
    if (r < need) {
      out.contrast.count++;
      if (out.contrast.list.length < MAX_LIST) {
        out.contrast.list.push({
          el: sel(el), fg: hex(f), bg: hex(bg), ratio: r, need: need,
          fontSize: fs, fontWeight: fw, large: large, text: txt.slice(0, 30)
        });
      }
    }
  }

  /* ── ⑥ ARIA ───────────────────────────────────────────── */
  const seenIds = Object.create(null);
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const tag = el.tagName.toLowerCase();
    if (el.id) {
      if (seenIds[el.id]) out.aria.dupIds.push(el.id);
      seenIds[el.id] = 1;
    }
    if (tag === 'button' && !accessibleName(el) && isVisible(el)) {
      out.aria.buttonsNoName.push({ el: sel(el), html: (el.outerHTML || '').slice(0, 120) });
    }
    if (tag === 'a' && el.getAttribute('href') && !accessibleName(el) && isVisible(el)) {
      out.aria.linksNoName.push({ el: sel(el), html: (el.outerHTML || '').slice(0, 120) });
    }
    if (el.matches(FORM_INPUTS)) {
      const hasLabel = !!(el.labels && el.labels.length)
        || !!(el.getAttribute('aria-label') || '').trim()
        || !!(el.getAttribute('aria-labelledby') || '').trim();
      if (!hasLabel && isVisible(el)) {
        out.aria.inputsNoLabel.push({
          el: sel(el), type: el.getAttribute('type') || tag,
          placeholder: (el.getAttribute('placeholder') || '').slice(0, 30),
          id: el.id || ''
        });
      }
    }
    if (tag === 'img' && !el.hasAttribute('alt') && isVisible(el)) {
      out.aria.imgsNoAlt.push({ el: sel(el), src: (el.getAttribute('src') || '').slice(0, 60) });
    }
    if (tag === 'table' && isVisible(el)) {
      const ths = el.querySelectorAll('th');
      if (!ths.length) out.aria.tablesNoHeader.push({ el: sel(el) });
    }
    const role = el.getAttribute('role');
    if (role && ['button', 'link', 'tab', 'menuitem', 'checkbox', 'switch'].indexOf(role) >= 0 && tag !== 'button' && tag !== 'a') {
      const ti = el.getAttribute('tabindex');
      if (ti === null || Number(ti) < 0) out.aria.roleOnNonButton.push({ el: sel(el), role: role });
    }
    if (el.getAttribute('aria-hidden') === 'true' && isVisible(el) && el.matches(INTERACTIVE)) {
      out.aria.focusableAriaHidden.push({ el: sel(el) });
    }
    const ti = el.getAttribute('tabindex');
    if (ti && Number(ti) > 0) out.aria.positiveTabindex.push({ el: sel(el), tabindex: ti });
  }

  /* ── مؤشرات الأداء ────────────────────────────────────── */
  const nav = performance.getEntriesByType('navigation')[0];
  const paints = performance.getEntriesByType('paint');
  const res = performance.getEntriesByType('resource');
  out.perf = {
    ttfb: nav ? Math.round(nav.responseStart) : null,
    domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    load: nav ? Math.round(nav.loadEventEnd) : null,
    domInteractive: nav ? Math.round(nav.domInteractive) : null,
    fcp: paints.length ? Math.round(paints[0].startTime) : null,
    transferBytes: nav ? nav.transferSize : 0,
    resourceCount: res.length,
    resourceBytes: res.reduce(function (s, r) { return s + (r.transferSize || 0); }, 0),
    lcp: window.__octaLCP || null,
    domNodes: document.getElementsByTagName('*').length,
    cssRules: 0,
  };
  try {
    const sheets = document.styleSheets;
    let n = 0;
    for (let i = 0; i < sheets.length; i++) {
      try { n += sheets[i].cssRules.length; } catch (e) { /* cross-origin */ }
    }
    out.perf.cssRules = n;
  } catch (e) { }

  return out;
})()
`;

/* ── حقن مراقب LCP قبل أي سكربت في الصفحة ────────────────── */const LCP_INIT_SRC = String.raw`
(() => {
  window.__octaLCP = 0;
  window.__octaLCPFinal = 0;
  try {
    const po = new PerformanceObserver(function (list) {
      const es = list.getEntries();
      const last = es[es.length - 1];
      if (last) {
        window.__octaLCP = Math.round(last.startTime);
        window.__octaLCPFinal = Math.round(last.renderTime || last.startTime);
      }
    });
    po.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { }
})()
`;

/* ── فحص وضوح التركيز (focus-visible) ─────────────────────
   📌 بنقيس العنصر قبل وبعد التركيز ونشوف هل المؤشر اتغيّر
      (outline · box-shadow · لون · حدود) ⇒ لو ما اتغيّرش
      ⇒ المستخدم مش هيعرف إنه واقف على العنصر ده.
   ══════════════════════════════════════════════════════════════ */
const FOCUS_PROBE_SRC = String.raw`
(() => {
  const KEYS = ['outlineWidth', 'outlineStyle', 'outlineColor', 'outlineOffset',
    'boxShadow', 'backgroundColor', 'borderTopColor', 'borderTopWidth', 'color', 'transform', 'filter'];
  function snap(el) {
    const st = window.getComputedStyle(el);
    const o = {};
    for (let i = 0; i < KEYS.length; i++) o[KEYS[i]] = st[KEYS[i]];
    return o;
  }
  function isVisible(el) {
    if (!el.getClientRects || !el.getClientRects().length) return false;
    const st = window.getComputedStyle(el);
    if (!st || st.visibility === 'hidden' || st.display === 'none') return false;
    let node = el, acc = 1;
    while (node && node.nodeType === 1) {
      const o = parseFloat(window.getComputedStyle(node).opacity || '1');
      if (!isFinite(o)) return false;
      acc *= o;
      if (acc < 0.05) return false;
      node = node.parentElement;
    }
    return true;
  }
  const out = { checked: 0, noIndicator: [], withIndicator: 0 };
  const list = document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="link"], [tabindex]');
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    if (!isVisible(el)) continue;
    const before = snap(el);
    let focused = false;
    try { el.focus({ preventScroll: false }); focused = document.activeElement === el; } catch (e) { }
    if (!focused) { try { el.blur(); } catch (e) { } continue; }
    const after = snap(el);
    try { el.blur(); } catch (e) { }
    out.checked++;
    let changed = false;
    for (let k = 0; k < KEYS.length; k++) {
      if (String(before[KEYS[k]]) !== String(after[KEYS[k]])) { changed = true; break; }
    }
    const hasOutline = after.outlineStyle !== 'none' && parseFloat(after.outlineWidth) > 0;
    const hasShadow = after.boxShadow && after.boxShadow !== 'none';
    /* 📌 حلقة التركيز الافتراضية للمتصفح (outline: auto) ⇒ المؤشر
       بيترسم فعلاً ⇒ تُحسب مؤشر واضح ⭐ (مش «مفيش مؤشر» ⭐). */
    const uaRing = after.outlineStyle === 'auto' && parseFloat(after.outlineWidth) > 0;
    if ((changed && (hasOutline || hasShadow || after.filter !== 'none')) || uaRing) out.withIndicator++;
    else {
      out.noIndicator.push({
        el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
          (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22),
        outline: after.outlineStyle + ' ' + after.outlineWidth,
        boxShadow: after.boxShadow
      });
    }
  }
  return out;
})()
`;

module.exports = { AUDIT_SRC: AUDIT_SRC, LCP_INIT_SRC: LCP_INIT_SRC, FOCUS_PROBE_SRC: FOCUS_PROBE_SRC };
