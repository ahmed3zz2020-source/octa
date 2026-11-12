/**
 * OCTA V2 — المزوّد التجريبي (Mock provider)
 * ------------------------------------------
 * ⛔ التنفيذ الوحيد للبيانات في هذه الدفعة.
 * ⛔ لا يفتح أي اتصال شبكي — البيانات كلها داخل الحزمة.
 * ⛔ يعلن عن نفسه: isMock = true + source = بيانات تجريبية.
 */

import { V2Provider, V2DataError, validateMarketOverview, validateStock } from './v2-contract.js';
import { MOCK_STOCKS, MOCK_INDEX, MOCK_SOURCE_NAME, MOCK_ASOF_ISO, mockSeriesFor } from './v2-mock-data.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMockProvider(opts = {}) {
  const latencyMs = typeof opts.latencyMs === 'number' ? opts.latencyMs : 320;

  function buildStock(raw) {
    const stock = {
      symbol: raw.symbol,
      name: raw.name,
      price: raw.price,
      changePct: raw.changePct,
      open: raw.open,
      high: raw.high,
      low: raw.low,
      volume: raw.volume,
      series: mockSeriesFor(raw),
      asOf: MOCK_ASOF_ISO,
      source: MOCK_SOURCE_NAME,
      isMock: true
    };
    const check = validateStock(stock);
    if (!check.ok) throw new V2DataError('shape', 'بيانات السهم لا تطابق العقد: ' + check.errors.join(','), check.errors);
    return stock;
  }

  return new (class extends V2Provider {
    /** قائمة الرموز المتاحة في البيانات التجريبية (للقائمة فقط) */
    listSymbols() {
      return MOCK_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name }));
    }

    async getMarket() {
      await sleep(latencyMs);
      const market = {
        indexName: MOCK_INDEX.indexName,
        indexValue: MOCK_INDEX.indexValue,
        indexChangePct: MOCK_INDEX.indexChangePct,
        advancing: MOCK_INDEX.advancing,
        declining: MOCK_INDEX.declining,
        totalVolume: MOCK_INDEX.totalVolume,
        asOf: MOCK_ASOF_ISO,
        source: MOCK_SOURCE_NAME,
        isMock: true
      };
      const check = validateMarketOverview(market);
      if (!check.ok) throw new V2DataError('shape', 'بيانات السوق لا تطابق العقد: ' + check.errors.join(','), check.errors);
      return market;
    }

    async getStock(symbol) {
      await sleep(latencyMs);
      const raw = MOCK_STOCKS.find((s) => s.symbol === symbol);
      if (!raw) throw new V2DataError('not_found', 'السهم غير موجود في البيانات التجريبية: ' + symbol);
      if (raw.fail) throw new V2DataError('network', 'تعذّر جلب بيانات السهم (خطأ تجريبي مقصود)');
      return buildStock(raw);
    }

    async getComparison(symbols) {
      await sleep(latencyMs);
      const list = Array.isArray(symbols) ? symbols.slice(0, 3) : [];
      const out = [];
      for (const sym of list) {
        const raw = MOCK_STOCKS.find((s) => s.symbol === sym);
        if (!raw) continue;
        if (raw.fail) {
          out.push({ symbol: sym, error: true, message: 'تعذّر جلب بيانات السهم (خطأ تجريبي مقصود)' });
          continue;
        }
        out.push(buildStock(raw));
      }
      return out;
    }
  })();
}
