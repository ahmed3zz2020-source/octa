/**
 * OCTA V2 — أدوات التنسيق والعرض (مشتركة)
 * أرقام عربية-هندية · وقت نسبي · بناء عناصر DOM بدون innerHTML من بيانات.
 */

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** يحوّل الأرقام إلى أرقام عربية-هندية */
export function ar(value) {
  return String(value).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

/** عزل ثنائي الاتجاه: يضمن ظهور الأرقام والإشارات بترتيب يسار-يمين */
export function ltr(s) {
  return '⁦' + s + '⁩';
}

/** رقم بفواصل الآلاف */
export function arNum(value, decimals = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const fixed = value.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return ltr(ar(grouped + (dec ? '.' + dec : '')));
}

/** نسبة مئوية بإشارة — أو null (= غير متاح) */
export function arPct(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return ltr(ar(sign + Math.abs(value).toFixed(2) + '٪'));
}

/** حجم التداول: مليون/مليار */
export function arVolume(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value >= 1e9) return ltr(ar((value / 1e9).toFixed(2)) + ' مليار');
  if (value >= 1e6) return ltr(ar((value / 1e6).toFixed(1)) + ' مليون');
  if (value >= 1e3) return ltr(ar((value / 1e3).toFixed(1)) + ' ألف');
  return ltr(ar(value));
}

/** اتجاه السعر: up / down / flat */
export function dir(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'na';
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function pad2(n) { return n < 10 ? '0' + n : String(n); }

/** وقت مطلق: ١٢ نوفمبر ٢٠٢٦ · ٠٤:٥٨ */
export function arDateTime(iso) {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return null;
  const date = ar(d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear());
  const time = ar(pad2(d.getHours()) + ':' + pad2(d.getMinutes()));
  return date + ' · ' + time;
}

/** توقيت نسبي: «قبل ١٢ دقيقة» */
export function arAgo(iso, now = Date.now()) {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return null;
  const mins = Math.max(0, Math.round((now - d.getTime()) / 60000));
  if (mins < 1) return 'الآن';
  if (mins < 60) return 'قبل ' + ar(mins) + ' دقيقة';
  const hours = Math.round(mins / 60);
  if (hours < 24) return 'قبل ' + ar(hours) + ' ساعة';
  return 'قبل ' + ar(Math.round(hours / 24)) + ' يوم';
}

/** يحوّل القيمة إلى نص أو «غير متاح» */
export function orNA(value) {
  return value === null || value === undefined ? 'غير متاح' : value;
}

/** عنصر DOM مختصر */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
