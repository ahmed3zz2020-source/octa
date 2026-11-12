/**
 * OCTA V2 — الشاشات (السوق · السهم · المقارنة)
 * كل حالة بيانات لها تمثيل صريح:
 *   تحميل (skeleton) · بيانات ناقصة («غير متاح») · خطأ (رسالة + إعادة محاولة)
 */

import { el, clear, ar, arNum, arPct, arVolume, arDateTime, arAgo, orNA, dir } from './v2-format.js';
import { buildLineChart } from './v2-chart.js';

export const MAX_COMPARE = 3;

function mockBanner(compact = false) {
  return el('div', { class: 'v2-banner' + (compact ? ' v2-banner--compact' : ''), 'data-testid': 'mock-banner' }, [
    el('span', { class: 'v2-banner__icon', text: '⚠️' }),
    el('span', { class: 'v2-banner__text', text: 'بيانات تجريبية — كل الأرقام وهمية، الغرض اختبار الواجهة فقط، وليست أسعارًا حقيقية.' })
  ]);
}

function sourceRow(label, value, testid) {
  return el('div', { class: 'v2-meta__row' }, [
    el('span', { class: 'v2-meta__label', text: label }),
    el('span', { class: 'v2-meta__value', 'data-testid': testid, text: value })
  ]);
}

function skeletonBlock(lines = 3) {
  const wrap = el('div', { class: 'v2-skeleton', 'data-testid': 'skeleton' });
  for (let i = 0; i < lines; i++) wrap.appendChild(el('div', { class: 'v2-skeleton__line' }));
  return wrap;
}

function errorCard(message, onRetry) {
  return el('div', { class: 'v2-card v2-card--error', 'data-testid': 'error-card' }, [
    el('div', { class: 'v2-card--error__title', text: '⚠️ تعذّر تحميل البيانات' }),
    el('p', { class: 'v2-card--error__msg', 'data-testid': 'error-message', text: message }),
    el('button', {
      class: 'v2-btn v2-btn--ghost', 'data-testid': 'retry-btn', text: 'إعادة المحاولة', onclick: onRetry
    })
  ]);
}

function changeBadge(pct) {
  const d = dir(pct);
  const text = arPct(pct);
  return el('span', {
    class: 'v2-badge v2-badge--' + d,
    'data-testid': 'change-badge',
    text: text === null ? 'غير متاح' : text
  });
}

/* ───────────── شاشة السوق ───────────── */
export function renderMarket(ctx) {
  const root = el('section', { class: 'v2-view', 'data-testid': 'market-view' });

  root.appendChild(el('header', { class: 'v2-head' }, [
    el('h1', { class: 'v2-head__title', text: 'شاشة السوق' }),
    el('span', { class: 'v2-pill', 'data-testid': 'mock-pill', text: 'تجريبي' })
  ]));
  root.appendChild(mockBanner());

  const body = el('div', { class: 'v2-view__body', 'data-testid': 'market-body' });
  root.appendChild(body);
  body.appendChild(skeletonBlock(4));

  ctx.provider.getMarket().then((market) => {
    clear(body);

    const kpis = el('div', { class: 'v2-kpis', 'data-testid': 'kpi-grid' });
    const cards = [
      { key: 'index', label: 'قيمة المؤشر', value: arNum(market.indexValue, 2), unit: 'نقطة' },
      { key: 'change', label: 'التغير اليومي', value: arPct(market.indexChangePct), unit: 'مقارنة بالإغلاق السابق', dir: dir(market.indexChangePct) },
      { key: 'breadth', label: 'الصاعدة مقابل الهابطة', value: ar(market.advancing) + ' / ' + ar(market.declining), unit: 'سهم صاعدة / هابطة' },
      { key: 'volume', label: 'إجمالي التداول', value: arVolume(market.totalVolume), unit: 'ج.م' }
    ];
    for (const c of cards) {
      kpis.appendChild(el('article', { class: 'v2-kpi' + (c.dir ? ' v2-kpi--' + c.dir : ''), 'data-testid': 'kpi-card', 'data-key': c.key }, [
        el('span', { class: 'v2-kpi__label', text: c.label }),
        el('strong', { class: 'v2-kpi__value', text: c.value === null ? 'غير متاح' : c.value }),
        el('span', { class: 'v2-kpi__unit', text: c.unit })
      ]));
    }
    body.appendChild(el('h2', { class: 'v2-sec__title', text: 'أربعة مؤشرات للسوق' }));
    body.appendChild(kpis);

    body.appendChild(el('h2', { class: 'v2-sec__title', text: 'الأسهم التجريبية' }));
    const list = el('div', { class: 'v2-list', 'data-testid': 'stock-list' });
    for (const s of ctx.provider.listSymbols()) {
      const selected = ctx.state.compare.includes(s.symbol);
      list.appendChild(el('article', { class: 'v2-row', 'data-testid': 'stock-row', 'data-symbol': s.symbol }, [
        el('div', { class: 'v2-row__main' }, [
          el('span', { class: 'v2-row__name', text: s.name }),
          el('span', { class: 'v2-row__code', text: s.symbol })
        ]),
        el('div', { class: 'v2-row__actions' }, [
          el('button', {
            class: 'v2-btn v2-btn--soft', 'data-testid': 'open-stock', text: 'تفاصيل',
            onclick: () => ctx.navigate('stock', s.symbol)
          }),
          el('button', {
            class: 'v2-btn' + (selected ? ' v2-btn--on' : ' v2-btn--soft'), 'data-testid': 'add-compare',
            'data-symbol': s.symbol, text: selected ? 'في المقارنة' : 'قارن',
            onclick: () => ctx.toggleCompare(s.symbol)
          })
        ])
      ]));
    }
    body.appendChild(list);

    body.appendChild(el('p', { class: 'v2-note', 'data-testid': 'test-cases-note', text: 'حالات الاختبار: MOCK5 يعيد خطأً · MOCK6 يعيد بيانات ناقصة («غير متاح»).' }));

    body.appendChild(el('div', { class: 'v2-meta v2-card', 'data-testid': 'market-meta' }, [
      sourceRow('مصدر البيانات', market.source, 'market-source'),
      sourceRow('توقيت البيانات', arDateTime(market.asOf) + ' · ' + arAgo(market.asOf), 'market-asof')
    ]));
  }).catch((err) => {
    clear(body);
    body.appendChild(errorCard(err && err.message ? err.message : 'خطأ غير معروف', () => ctx.navigate('market')));
  });

  return root;
}

/* ───────────── صفحة السهم ───────────── */
export function renderStock(ctx, symbol) {
  const root = el('section', { class: 'v2-view', 'data-testid': 'stock-view' });

  root.appendChild(el('button', {
    class: 'v2-btn v2-btn--ghost v2-back', 'data-testid': 'back-btn', text: '→ رجوع للسوق',
    onclick: () => ctx.navigate('market')
  }));
  root.appendChild(mockBanner(true));

  const body = el('div', { class: 'v2-view__body', 'data-testid': 'stock-body' });
  root.appendChild(body);
  body.appendChild(skeletonBlock(5));

  const load = () => {
    clear(body);
    body.appendChild(skeletonBlock(5));
    ctx.provider.getStock(symbol).then((stock) => {
      clear(body);
      const d = dir(stock.changePct);
      body.appendChild(el('div', { class: 'v2-price' }, [
        el('div', { class: 'v2-price__main' }, [
          el('span', { class: 'v2-price__name', text: stock.name }),
          el('span', { class: 'v2-price__code', text: stock.symbol }),
          el('span', { class: 'v2-pill', text: 'تجريبي' })
        ]),
        el('div', { class: 'v2-price__side' }, [
          el('strong', { class: 'v2-price__value' + (d !== 'na' ? ' v2-price__value--' + d : ''), 'data-testid': 'stock-price', text: arNum(stock.price, 2) + ' ج.م' }),
          changeBadge(stock.changePct)
        ])
      ]));

      const chartCard = el('div', { class: 'v2-card', 'data-testid': 'chart-card' }, [
        el('h3', { class: 'v2-card__title', text: 'شارت السعر (٣٠ يومًا تجريبي)' })
      ]);
      chartCard.appendChild(buildLineChart(stock.series, { label: 'شارت تجريبي لسعر ' + stock.symbol }));
      body.appendChild(chartCard);

      const stats = el('div', { class: 'v2-stats', 'data-testid': 'stats-grid' });
      const rows = [
        ['الافتتاح', stock.open === null ? null : arNum(stock.open, 2) + ' ج.م'],
        ['أعلى سعر', stock.high === null ? null : arNum(stock.high, 2) + ' ج.م'],
        ['أدنى سعر', stock.low === null ? null : arNum(stock.low, 2) + ' ج.م'],
        ['حجم التداول', stock.volume === null ? null : arVolume(stock.volume) + ' سهم']
      ];
      for (const [label, value] of rows) {
        const missing = value === null;
        stats.appendChild(el('div', { class: 'v2-stat' + (missing ? ' v2-stat--missing' : '') }, [
          el('span', { class: 'v2-stat__label', text: label }),
          el('span', { class: 'v2-stat__value', 'data-testid': missing ? 'missing-value' : 'stat-value', text: missing ? 'غير متاح' : value })
        ]));
      }
      body.appendChild(stats);
      if (stock.changePct === null) {
        body.appendChild(el('p', { class: 'v2-note v2-note--warn', 'data-testid': 'partial-note', text: '⛔ بعض الحقول غير متاحة في هذه البيانات التجريبية — لم يتم ملؤها بقيمة مفترضة.' }));
      }

      body.appendChild(el('div', { class: 'v2-meta v2-card', 'data-testid': 'stock-meta' }, [
        sourceRow('مصدر البيانات', stock.source, 'stock-source'),
        sourceRow('توقيت البيانات', arDateTime(stock.asOf) + ' · ' + arAgo(stock.asOf), 'stock-asof'),
        sourceRow('حالة البيانات', stock.isMock === true ? 'تجريبية (Mock)' : 'غير معروفة', 'stock-mock-flag')
      ]));
    }).catch((err) => {
      clear(body);
      body.appendChild(errorCard(err && err.message ? err.message : 'خطأ غير معروف', load));
    });
  };

  load();
  return root;
}

/* ───────────── المقارنة ───────────── */
export function renderCompare(ctx) {
  const root = el('section', { class: 'v2-view', 'data-testid': 'compare-view' });
  root.appendChild(el('header', { class: 'v2-head' }, [
    el('h1', { class: 'v2-head__title', text: 'مقارنة الأسهم' }),
    el('span', { class: 'v2-pill', text: 'حتى ٣ أسهم' })
  ]));
  root.appendChild(mockBanner(true));

  const body = el('div', { class: 'v2-view__body', 'data-testid': 'compare-body' });
  root.appendChild(body);

  const symbols = ctx.state.compare.slice(0, MAX_COMPARE);
  if (symbols.length === 0) {
    body.appendChild(el('div', { class: 'v2-card v2-empty', 'data-testid': 'compare-empty' }, [
      el('p', { text: 'مفيش أسهم مختارة للمقارنة.' }),
      el('button', { class: 'v2-btn', text: 'اختار أسهم من شاشة السوق', onclick: () => ctx.navigate('market') })
    ]));
    return root;
  }

  body.appendChild(skeletonBlock(3));
  ctx.provider.getComparison(symbols).then((rows) => {
    clear(body);
    const grid = el('div', { class: 'v2-compare', 'data-testid': 'compare-grid' });
    for (const row of rows) {
      if (row.error) {
        grid.appendChild(el('article', { class: 'v2-card v2-card--error', 'data-testid': 'compare-error', 'data-symbol': row.symbol }, [
          el('div', { class: 'v2-card--error__title', text: '⚠️ ' + row.symbol }),
          el('p', { class: 'v2-card--error__msg', text: row.message })
        ]));
        continue;
      }
      const card = el('article', { class: 'v2-card v2-compare__card', 'data-testid': 'compare-slot', 'data-symbol': row.symbol }, [
        el('div', { class: 'v2-compare__head' }, [
          el('span', { class: 'v2-compare__name', text: row.name }),
          el('button', {
            class: 'v2-btn v2-btn--ghost v2-btn--tiny', 'data-testid': 'remove-compare', text: '✕',
            onclick: () => ctx.toggleCompare(row.symbol)
          })
        ]),
        el('strong', { class: 'v2-compare__price', 'data-testid': 'compare-price', text: arNum(row.price, 2) + ' ج.م' }),
        changeBadge(row.changePct),
        el('div', { class: 'v2-compare__chart', 'data-testid': 'compare-chart' }),
        el('dl', { class: 'v2-compare__stats' }, [
          el('dt', { text: 'الافتتاح' }), el('dd', { 'data-testid': 'compare-stat', text: row.open === null ? 'غير متاح' : arNum(row.open, 2) }),
          el('dt', { text: 'الأعلى' }), el('dd', { 'data-testid': 'compare-stat', text: row.high === null ? 'غير متاح' : arNum(row.high, 2) }),
          el('dt', { text: 'الأدنى' }), el('dd', { 'data-testid': 'compare-stat', text: row.low === null ? 'غير متاح' : arNum(row.low, 2) }),
          el('dt', { text: 'التغير' }), el('dd', { 'data-testid': 'compare-stat', text: orNA(arPct(row.changePct)) })
        ])
      ]);
      card.querySelector('[data-testid="compare-chart"]').appendChild(
        buildLineChart(row.series, { width: 320, height: 150, label: 'شارت تجريبي ' + row.symbol })
      );
      grid.appendChild(card);
    }
    body.appendChild(grid);
    body.appendChild(el('p', { class: 'v2-note', text: 'الترتيب يتبع ترتيب الاختيار · كل الأرقام تجريبية.' }));
  }).catch((err) => {
    clear(body);
    body.appendChild(errorCard(err && err.message ? err.message : 'خطأ غير معروف', () => ctx.navigate('compare')));
  });

  return root;
}
