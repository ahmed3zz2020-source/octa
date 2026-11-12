/**
 * OCTA V2 — رسم الشارت (SVG خالص — بلا أي مكتبة خارجية)
 * س-series زمني: الأقدم يمين والأحدث يسار (اتجاه عربي).
 */

import { ar, arNum } from './v2-format.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  return node;
}

/**
 * يبني شارت خطي لسلسلة سعرية.
 * @param {number[]} series
 * @param {{width?:number,height?:number,label?:string}} opts
 */
export function buildLineChart(series, opts = {}) {
  const W = opts.width || 640;
  const H = opts.height || 260;
  const padT = 18, padB = 44, padR = 56, padL = 56;   // RTL: يمين = الأقدم
  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'v2-chart',
    role: 'img',
    'aria-label': opts.label || 'رسم بياني لسعر السهم'
  });

  const data = (series || []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (data.length < 2) {
    const t = svgEl('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'v2-chart-empty' });
    t.textContent = 'لا توجد نقاط كافية لعرض الشارت';
    svg.appendChild(t);
    return svg;
  }

  const max = Math.max.apply(null, data);
  const min = Math.min.apply(null, data);
  const span = (max - min) || 1;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // الأحدث يسار ⇒ x = padL + (n-1-i)/(n-1) * plotW
  const xAt = (i) => padL + ((data.length - 1 - i) / (data.length - 1)) * plotW;
  const yAt = (v) => padT + (1 - (v - min) / span) * plotH;

  // خطوط الشبكة + محور القيم
  for (let g = 0; g <= 3; g++) {
    const v = min + (span * g) / 3;
    const y = yAt(v);
    svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: 'v2-chart-grid' }));
    const lbl = svgEl('text', { x: W - padR + 8, y: y + 4, class: 'v2-chart-label' });
    lbl.textContent = arNum(v, 2) || '';
    svg.appendChild(lbl);
  }

  const pts = data.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);

  // تعبئة تحت الخط
  const areaPts = [`${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)}`]
    .concat(pts.map((p) => p))
    .concat([`${xAt(data.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)}`]);
  svg.appendChild(svgEl('polygon', { points: areaPts.join(' '), class: 'v2-chart-area' }));

  // الخط
  svg.appendChild(svgEl('polyline', { points: pts.join(' '), class: 'v2-chart-line' }));

  // آخر نقطة + قيمتها
  const lastX = xAt(data.length - 1);
  const lastY = yAt(data[data.length - 1]);
  svg.appendChild(svgEl('circle', { cx: lastX, cy: lastY, r: 5, class: 'v2-chart-dot' }));
  const labelAbove = lastY - 12 > padT + 8;
  const lastLbl = svgEl('text', {
    x: lastX - 6,
    y: labelAbove ? lastY - 12 : lastY + 18,
    'text-anchor': 'end',
    class: 'v2-chart-last'
  });
  lastLbl.textContent = arNum(data[data.length - 1], 2) || '';
  svg.appendChild(lastLbl);

  // طرفي المحور الزمني
  const newest = svgEl('text', { x: padL, y: H - 10, 'text-anchor': 'start', class: 'v2-chart-axis' });
  newest.textContent = 'الأحدث';
  const oldest = svgEl('text', { x: W - padR, y: H - 10, 'text-anchor': 'end', class: 'v2-chart-axis' });
  oldest.textContent = 'الأقدم';
  svg.appendChild(newest);
  svg.appendChild(oldest);

  return svg;
}
