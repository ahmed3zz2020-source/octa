/**
 * OCTA V2 — عقد البيانات (V2 Data Contract)
 * ------------------------------------------
 * مستقل تمامًا عن واجهات الإنتاج: لا يستورد أي ملف من
 * assets/js/octa-*.js ولا يتصل بأي /api/* خارجي.
 *
 * العقد يحدد ثلاثة كائنات:
 *   MarketOverview · Stock · Comparison
 * وكل حقل له نوع + قاعدة. أي بيانات لا تطابق العقد
 * تُرفض ولا تُعرض.
 */

export const V2_CONTRACT_VERSION = 'v2.1';

/** أسماء الحقول المسموح بها لكل كائن ( Anything else = rejected ) */
export const MARKET_FIELDS = [
  'indexName', 'indexValue', 'indexChangePct', 'advancing', 'declining',
  'totalVolume', 'asOf', 'source', 'isMock'
];

export const STOCK_FIELDS = [
  'symbol', 'name', 'price', 'changePct', 'open', 'high', 'low', 'volume',
  'series', 'asOf', 'source', 'isMock'
];

/** القواعد: null مسموح (= «غير متاح») · undefined ممنوع (حقل ناقص) */
export const REQUIRED_STOCK_FIELDS = ['symbol', 'name', 'price', 'asOf', 'source', 'isMock'];

export const STOCK_MEASURE_FIELDS = ['price', 'changePct', 'open', 'high', 'low', 'volume'];

export class V2DataError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'V2DataError';
    this.code = code;            // 'network' | 'shape' | 'not_found' | 'unknown'
    this.cause = cause || null;
  }
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** يتحقق من كائن السوق يرجّع { ok, errors } */
export function validateMarketOverview(o) {
  const errors = [];
  if (!o || typeof o !== 'object') return { ok: false, errors: ['market:not-object'] };
  for (const f of MARKET_FIELDS) {
    if (!(f in o)) errors.push('market:missing:' + f);
  }
  if (!isNum(o.indexValue)) errors.push('market:bad:indexValue');
  if (o.indexChangePct !== null && !isNum(o.indexChangePct)) errors.push('market:bad:indexChangePct');
  if (!isNum(o.advancing) || !isNum(o.declining)) errors.push('market:bad:counts');
  if (!isNum(o.totalVolume)) errors.push('market:bad:totalVolume');
  if (!o.asOf) errors.push('market:bad:asOf');
  if (o.isMock !== true) errors.push('market:not-mock');
  return { ok: errors.length === 0, errors };
}

/** يتحقق من كائن السهم يرجّع { ok, errors } */
export function validateStock(o) {
  const errors = [];
  if (!o || typeof o !== 'object') return { ok: false, errors: ['stock:not-object'] };
  for (const f of REQUIRED_STOCK_FIELDS) {
    if (!(f in o)) errors.push('stock:missing:' + f);
  }
  if (!isNum(o.price)) errors.push('stock:bad:price');
  for (const f of ['changePct', 'open', 'high', 'low', 'volume']) {
    const v = o[f];
    if (v === null) continue;                       // «غير متاح» — مقبول
    if (!isNum(v)) errors.push('stock:bad:' + f);
  }
  if (!Array.isArray(o.series)) errors.push('stock:bad:series');
  if (o.isMock !== true) errors.push('stock:not-mock');
  return { ok: errors.length === 0, errors };
}

/**
 * واجهة المزوّد — أي مصدر بيانات في V2 لازم يطبّقها.
 * المزوّد التجريبي (mock) هو التنفيذ الوحيد في هذه الدفعة.
 */
export class V2Provider {
  /** @returns {Promise<object>} MarketOverview */
  async getMarket() { throw new V2DataError('unknown', 'getMarket غير منفّذ'); }
  /** @returns {Promise<object>} Stock */
  async getStock(symbol) { throw new V2DataError('unknown', 'getStock غير منفّذ'); }
  /** @returns {Promise<object[]>} Stock[] */
  async getComparison(symbols) { throw new V2DataError('unknown', 'getComparison غير منفّذ'); }
}
