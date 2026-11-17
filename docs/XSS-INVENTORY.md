# جرد مواضع innerHTML — واجهة OCTA (SEC-024 · الجولة ١٨)

> مولَّد بـ `node tools/xss-inventory.js --md docs/XSS-INVENTORY.md` — أداة قراءة بس (مافيش تعديل).

## الأرقام

- إجمالي مواضع إدراج HTML في `assets/js/*.js`: **422**
- مواضع فيها إدراج **غير مُرمَّز** (أي متغيّر): **103**
- مواضع فيها إدراج **غير مُرمَّز** لحقل من الـAPI: **20**
- مواضع اتصلّحت في الجولة ١٨: **9** (انظر جدول الإصلاح)

## المواضع اللي اتصلّحت — SEC-024

| # | الملف | الدالة | الحقول اللي اترمَّزت | الاختبار |
|---|---|---|---|---|
| 1 | `assets/js/octa-pages.js` | `armNews` | جدول الأحداث المعلنة (اسم الشركة/النوع/القيمة) | `SEC-024-①` |
| 2 | `assets/js/octa-pages.js` | `renderStrategies` | اسم الاستراتيجية + التركيز + ملاحظات الفلتر | `SEC-024-②` |
| 3 | `assets/js/octa-pages.js` | `renderIntel` | اسم السهم + الأسباب + أوصاف المخاطر | `SEC-024-③` |
| 4 | `assets/js/octa-pages.js` | `loadEarlyOpps` | بطاقات الفرص المبكرة | `SEC-024-④` |
| 5 | `assets/js/octa-pages.js` | `dvTabs` | أقرب استحقاق (رمز + اسم) | `SEC-024-⑤` |
| 6 | `assets/js/octa-pages.js` | `openTradingView` | مودال TradingView (رمز + اسم) | `SEC-024-⑥` |
| 7 | `assets/js/octa-core.js` | `searchStock` | نص البحث (reflected) + اسم السهم | `SEC-024-⑦` |
| 8 | `assets/js/octa-core.js` | `renderAiError` | رسالة الخطأ من الـAPI | `SEC-024-⑧` |
| 9 | `assets/js/octa-pages.js` | `renderStockPage` | صفحة السهم: الاسم + القطاع + التفسير + الإفصاحات | `SEC-024-⑨` |

## جدول المواضع (غير مُرمَّز + حقل من الـAPI) — مرتّبة بالخطورة

| # | الملف:السطر | الدالة | الحقل | مُرمَّز؟ | الخطورة |
|---|---|---|---|---|---|
| 1 | `assets/js/octa-pages.js:4557` | `renderStockPage` | `sector_peers` | ❌ | عالية |
| 2 | `assets/js/octa-pages.js:4560` | `renderStockPage` | `fair_value` | ❌ | عالية |
| 3 | `assets/js/octa-pages.js:4682` | `renderStockPage` | `status` | ❌ | عالية |
| 4 | `assets/js/octa-pages.js:5079` | `renderStockPage` | `title` | ❌ | عالية |
| 5 | `assets/js/octa-pages.js:5080` | `renderStockPage` | `desc` | ❌ | عالية |
| 6 | `assets/js/octa-pages.js:5437` | `renderStockPage` | `state` | ❌ | عالية |
| 7 | `assets/js/octa-pages.js:5444` | `renderStockPage` | `label` | ❌ | عالية |
| 8 | `assets/js/octa-pages.js:5327` | `renderStockPage` | `state` | ❌ | عالية |
| 9 | `assets/js/octa-pages.js:2709` | `initMarketTicker` | `why` | ❌ | عالية |
| 10 | `assets/js/octa-pages.js:2738` | `initMarketTicker` | `name` | ❌ | عالية |
| 11 | `assets/js/octa-pages.js:3194` | `initMarketTicker` | `valuation_status` | ❌ | عالية |
| 12 | `assets/js/octa-pages.js:3336` | `initMarketTicker` | `title` | ❌ | عالية |
| 13 | `assets/js/octa-pages.js:3501` | `initMarketTicker` | `SI_CODE` | ❌ | عالية |
| 14 | `assets/js/octa-pages.js:3705` | `initMarketTicker` | `label` | ❌ | عالية |
| 15 | `assets/js/octa-core.js:2480` | `updateTablePrices` | `desc` | ❌ | عالية |
| 16 | `assets/js/octa-core.js:3475` | `updateTablePrices` | `verdict` | ❌ | عالية |
| 17 | `assets/js/octa-core.js:3476` | `updateTablePrices` | `action` | ❌ | عالية |
| 18 | `assets/js/octa-core.js:3248` | `updateTablePrices` | `why` | ❌ | عالية |
| 19 | `assets/js/octa-app.js:2050` | `cmpRender` | `label` | ❌ | عالية |
| 20 | `assets/js/octa-app.js:2051` | `cmpRender` | `code` | ❌ | عالية |
| 21 | `assets/js/octa-pages.js:221` | `renderHomeDividends` | `value` | ❌ | عالية |
| 22 | `assets/js/octa-pages.js:224` | `renderHomeDividends` | `code` | ❌ | عالية |
| 23 | `assets/js/octa-app.js:417` | `renderTabs` | `name` | ❌ | عالية |
| 24 | `assets/js/octa-app.js:426` | `renderFilters` | `label` | ❌ | عالية |
| 25 | `assets/js/octa-app.js:1623` | `openStockModal` | `code` | ❌ | عالية |
| 26 | `assets/js/octa-app.js:2359` | `pickRenderList` | `code` | ❌ | عالية |
| 27 | `assets/js/octa-app.js:2476` | `pickRenderCards` | `code` | ❌ | عالية |
| 28 | `assets/js/octa-challenges.js:418` | `renderResult` | `verdict` | ❌ | عالية |
| 29 | `assets/js/octa-core.js:1871` | `renderAiLoading` | `code` | ❌ | عالية |
| 30 | `assets/js/octa-gate.js:2182` | `pinStep` | `hint` | ❌ | عالية |
| 31 | `assets/js/octa-money.js:606` | `loadDetail` | `why` | ❌ | عالية |
| 32 | `assets/js/octa-pages.js:749` | `loadOpportunities` | `code` | ❌ | عالية |
| 33 | `assets/js/octa-pages.js:1890` | `tvSearch` | `code` | ❌ | عالية |
| 34 | `assets/js/octa-pages.js:2311` | `vRenderCard` | `why` | ❌ | عالية |
| 35 | `assets/js/octa-pages.js:4362` | `dvRender` | `label` | ❌ | عالية |
| 36 | `assets/js/octa-radar-ui.js:775` | `renderList` | `body` | ❌ | عالية |
| 37 | `assets/js/octa-settings.js:828` | `render` | `body` | ❌ | عالية |

## كل المواضع (ملخّص بالملف)

| الملف | عدد المواضع | غير مُرمَّز | غير مُرمَّز + حقل API |
|---|---|---|---|
| `assets/js/octa-pages.js` | 57 | 21 | 7 |
| `assets/js/octa-challenges.js` | 37 | 4 | 1 |
| `assets/js/octa-app.js` | 35 | 11 | 6 |
| `assets/js/octa-gold-egy.js` | 33 | 6 | 0 |
| `assets/js/octa-filters.js` | 24 | 1 | 0 |
| `assets/js/octa-gate.js` | 23 | 8 | 1 |
| `assets/js/octa-money.js` | 18 | 6 | 1 |
| `assets/js/octa-setups.js` | 18 | 6 | 0 |
| `assets/js/octa-radar-ui.js` | 15 | 5 | 1 |
| `assets/js/octa-index-intel.js` | 14 | 4 | 0 |
| `assets/js/octa-techfilter.js` | 14 | 3 | 0 |
| `assets/js/octa-core.js` | 13 | 6 | 2 |
| `assets/js/octa-studio.js` | 11 | 0 | 0 |
| `assets/js/octa-zones.js` | 10 | 2 | 0 |
| `assets/js/tv-shim.js` | 9 | 1 | 0 |
| `assets/js/octa-gold.js` | 8 | 0 | 0 |
| `assets/js/octa-screener.js` | 8 | 3 | 0 |
| `assets/js/octa-alpha.js` | 7 | 0 | 0 |
| `assets/js/octa-gold-savings.js` | 7 | 0 | 0 |
| `assets/js/octa-opps.js` | 7 | 0 | 0 |
| `assets/js/na-axis.js` | 6 | 3 | 0 |
| `assets/js/octa-usd-intel.js` | 6 | 1 | 0 |
| `assets/js/octa-armsfilter.js` | 5 | 0 | 0 |
| `assets/js/octa-stats.js` | 5 | 0 | 0 |
| `assets/js/octa-auth.js` | 4 | 1 | 0 |
| `assets/js/octa-chartkit.js` | 4 | 1 | 0 |
| `assets/js/octa-decide.js` | 4 | 0 | 0 |
| `assets/js/octa-movers.js` | 4 | 2 | 0 |
| `assets/js/octa-public-market.js` | 4 | 2 | 0 |
| `assets/js/octa-us-arms.js` | 3 | 0 | 0 |
| `assets/js/octa-settings.js` | 2 | 2 | 1 |
| `assets/js/octa-update.js` | 2 | 0 | 0 |
| `assets/js/octa-us-intel.js` | 2 | 1 | 0 |
| `assets/js/octa-copy.js` | 1 | 1 | 0 |
| `assets/js/octa-sidebar.js` | 1 | 1 | 0 |
| `assets/js/octa-watch.js` | 1 | 1 | 0 |

## كل المواضع (تفصيلي)

| الملف:السطر | الدالة | الحقول المُدرجة | مُرمَّز؟ | الخطورة |
|---|---|---|---|---|
| `assets/js/na-axis.js:70` | `naLoad` | `naEsc` ❌ | ✅ | منخفضة |
| `assets/js/na-axis.js:88` | `naRender` | `all` ❌ · `fake` ❌ · `upd` ❌ | ❌ | متوسطة |
| `assets/js/na-axis.js:122` | `naRender` | `naEsc` ❌ · `flab` ❌ · `rows` ❌ | ❌ | متوسطة |
| `assets/js/na-axis.js:129` | `naRender` | — | ✅ | منخفضة |
| `assets/js/na-axis.js:133` | `naRender` | `naEsc` ❌ · `m` ❌ · `t` ❌ | ❌ | متوسطة |
| `assets/js/na-axis.js:159` | `naRender` | — | ✅ | منخفضة |
| `assets/js/octa-alpha.js:126` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-alpha.js:132` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-alpha.js:137` | `render` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-alpha.js:142` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-alpha.js:180` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-alpha.js:807` | `explainBlock` | — | ✅ | منخفضة |
| `assets/js/octa-alpha.js:809` | `explainBlock` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:414` | `renderTabs` | `k` ❌ · `m` ❌ · `flag` ❌ · `name` ❌ | ❌ | عالية |
| `assets/js/octa-app.js:423` | `renderFilters` | `f` ❌ · `id` ❌ · `label` ❌ | ❌ | عالية |
| `assets/js/octa-app.js:432` | `renderMktBar` | `m` ❌ · `flag` ❌ · `name` ✅ · `esc` ❌ · `v` ❌ · `c` ❌ · `cl` ❌ · `lb` ❌ | ❌ | متوسطة |
| `assets/js/octa-app.js:470` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:506` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:516` | `render` | `rows` ❌ · `r` ✅ · `code` ✅ · `MK` ❌ · `esc` ❌ · `nf` ❌ · `cls` ❌ · `vc` ❌ · `vt` ❌ · `big` ❌ · `sf` ❌ · `more` ❌ | ❌ | متوسطة |
| `assets/js/octa-app.js:545` | `load` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:558` | `load` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-app.js:572` | `setMK` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:574` | `setMK` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-app.js:623` | `openCard` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:629` | `openCard` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:634` | `openCard` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:643` | `openCard` | `esc` ❌ · `octaJsArg` ❌ | ❌ | متوسطة |
| `assets/js/octa-app.js:1376` | `chartNameFor` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:1465` | `loadChartSymbol` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:1479` | `loadChartSymbol` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:1544` | `update` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:1589` | `openStockModal` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:1621` | `openStockModal` | `code` ❌ · `chg` ❌ · `S` ❌ · `decCol` ❌ · `dec` ❌ · `axHtml` ❌ · `f` ❌ · `pos` ❌ · `tp` ❌ · `neg` ❌ · `tn` ❌ · `ex` ❌ | ❌ | عالية |
| `assets/js/octa-app.js:1644` | `openStockModal` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:1654` | `ensurePanel` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:1858` | `cmpRenderPicker` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:1991` | `cmpRender` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:2048` | `cmpRender` | `V` ❌ · `label` ❌ · `code` ❌ · `pct` ❌ · `wins` ❌ · `bars` ❌ · `cmpRadar` ❌ · `list` ❌ · `cmpColor` ❌ · `s` ❌ · `wg` ❌ · `tbl` ❌ · `cards` ❌ | ❌ | عالية |
| `assets/js/octa-app.js:2069` | `cmpInit` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:2353` | `pickRenderList` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:2355` | `pickRenderList` | `s` ❌ · `code` ❌ · `escPick` ❌ | ❌ | عالية |
| `assets/js/octa-app.js:2384` | `pickRender` | `PICK_MAX` ❌ | ❌ | متوسطة |
| `assets/js/octa-app.js:2429` | `pickRenderAbout` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:2430` | `pickRenderAbout` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:2467` | `pickRenderCards` | `PICK_MAX` ❌ | ❌ | متوسطة |
| `assets/js/octa-app.js:2473` | `pickRenderCards` | `ptRenderFilters` ❌ · `ptRenderTable` ❌ · `S` ❌ · `code` ❌ · `escPick` ❌ · `Object` ❌ · `pickColor` ❌ · `k` ❌ · `a2` ❌ · `share` ❌ | ❌ | عالية |
| `assets/js/octa-app.js:2844` | `pickHints` | — | ✅ | منخفضة |
| `assets/js/octa-app.js:2881` | `pickHints` | — | ✅ | منخفضة |
| `assets/js/octa-armsfilter.js:287` | `renderPage` | — | ✅ | منخفضة |
| `assets/js/octa-armsfilter.js:339` | `renderPage` | — | ✅ | منخفضة |
| `assets/js/octa-armsfilter.js:449` | `renderDetail` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-armsfilter.js:500` | `renderDetail` | — | ✅ | منخفضة |
| `assets/js/octa-armsfilter.js:544` | `renderDetail` | — | ✅ | منخفضة |
| `assets/js/octa-auth.js:121` | `modal` | `html` ❌ | ❌ | متوسطة |
| `assets/js/octa-auth.js:209` | `mktBtn` | — | ✅ | منخفضة |
| `assets/js/octa-auth.js:226` | `userCard` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-auth.js:241` | `guestCard` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:101` | `setStatus` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-challenges.js:164` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:170` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:175` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:181` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:197` | `renderStats` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:203` | `renderStats` | `fmtPct` ❌ | ❌ | متوسطة |
| `assets/js/octa-challenges.js:221` | `renderChallenge` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:222` | `renderChallenge` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:223` | `renderChallenge` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:225` | `renderChallenge` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:232` | `renderChallenge` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:241` | `renderChallenge` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:243` | `renderChallenge` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:244` | `renderChallenge` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:245` | `renderChallenge` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-challenges.js:309` | `renderVoteState` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:312` | `renderVoteState` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:315` | `renderVoteState` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:318` | `renderVoteState` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:325` | `renderVoteState` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:327` | `renderVoteState` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:329` | `renderVoteState` | `d` ❌ · `daysWord` ❌ | ❌ | متوسطة |
| `assets/js/octa-challenges.js:346` | `hideVote` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:348` | `hideVote` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:386` | `renderResult` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:406` | `renderResult` | `outCls` ❌ · `outTxt` ❌ · `fmtDate` ❌ · `esc` ❌ · `verdict` ❌ | ❌ | عالية |
| `assets/js/octa-challenges.js:428` | `renderLeaderboard` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:434` | `renderLeaderboard` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:439` | `renderLeaderboard` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:443` | `renderLeaderboard` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:447` | `renderLeaderboard` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:468` | `renderLeaderboard` | `meRow` ❌ · `rows` ❌ | ❌ | متوسطة |
| `assets/js/octa-challenges.js:545` | `drawChart` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:546` | `drawChart` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:550` | `drawChart` | — | ✅ | منخفضة |
| `assets/js/octa-challenges.js:563` | `drawChart` | — | ✅ | منخفضة |
| `assets/js/octa-chartkit.js:141` | `mount` | — | ✅ | منخفضة |
| `assets/js/octa-chartkit.js:416` | `draw` | `html` ❌ | ❌ | متوسطة |
| `assets/js/octa-chartkit.js:423` | `draw` | — | ✅ | منخفضة |
| `assets/js/octa-chartkit.js:429` | `draw` | — | ✅ | منخفضة |
| `assets/js/octa-copy.js:163` | `—` | `LABELS` ❌ · `TITLES` ❌ · `html` ❌ · `tries` ❌ | ❌ | متوسطة |
| `assets/js/octa-core.js:286` | `fetchAllNews` | — | ✅ | منخفضة |
| `assets/js/octa-core.js:308` | `fetchAllNews` | `new` ❌ · `Date` ❌ · `toLocaleTimeString` ❌ · `ar` ❌ · `EG` ❌ | ❌ | متوسطة |
| `assets/js/octa-core.js:979` | `buildToolbar` | `t` ❌ · `id` ❌ · `L` ❌ · `d` ❌ · `OS_DB` ❌ · `Object` ❌ · `keys` ❌ · `live` ❌ · `EGX_META` ❌ · `ord` ❌ · `t` ❌ · `d` ❌ · `id` ❌ · `hid` ❌ · `new` ❌ · `Scanner` ❌ · `OCTA_API` ❌ · `path` ❌ · `v` ❌ · `parts` ❌ · `sumTxt` ❌ | ❌ | متوسطة |
| `assets/js/octa-core.js:1696` | `octaInit` | `c` ❌ · `OS_DB` ❌ · `live` ❌ · `OS_META` ❌ | ❌ | متوسطة |
| `assets/js/octa-core.js:1711` | `octaInit` | — | ✅ | منخفضة |
| `assets/js/octa-core.js:1719` | `octaSectors` | `OS_SECT` ❌ · `all` ❌ · `on` ❌ · `OS_DB` ❌ · `secs` ❌ · `octaFmtCap` ❌ · `OS_DB` ❌ · `OS_SECT` ❌ · `list` ❌ · `s` ✅ · `code` ✅ · `octaEsc` ❌ · `dc` ❌ · `dbg` ❌ · `fundLine` ❌ | ❌ | متوسطة |
| `assets/js/octa-core.js:1790` | `octaQ` | `octaEsc` ❌ | ✅ | منخفضة |
| `assets/js/octa-core.js:1794` | `octaQ` | `s` ✅ · `code` ✅ · `octaEsc` ❌ | ✅ | منخفضة |
| `assets/js/octa-core.js:1849` | `octaPick` | — | ✅ | منخفضة |
| `assets/js/octa-core.js:1868` | `renderAiLoading` | `code` ❌ · `OCTA_API` ❌ | ❌ | عالية |
| `assets/js/octa-core.js:1916` | `renderAiError` | — | ✅ | منخفضة |
| `assets/js/octa-core.js:1982` | `renderEnginePicker` | — | ✅ | منخفضة |
| `assets/js/octa-core.js:2060` | `updateTablePrices` | `live` ❌ · `change` ❌ · `sign` ❌ · `toFixed` ❌ · `arrow` ❌ · `s` ✅ · `code` ✅ · `percentage` ✅ · `startsWith` ❌ · `var` ❌ · `red2` ❌ · `parseInt` ❌ · `muted` ❌ · `pct` ❌ · `safeId` ❌ · `substring` ❌ · `name` ✅ · `price` ❌ · `up` ❌ · `down` ❌ · `sector` ✅ · `Math` ❌ · `abs` ❌ · `vol` ❌ · `pe` ❌ · `div` ❌ · `yield` ❌ · `P` ❌ · `E` ❌ · `r` ✅ · `label` ✅ · `get` ❌ · `winner` ❌ · `cheaper` ❌ · `perf` ❌ · `stock` ✅ · `c` ❌ · `title` ✅ · `f` ❌ · `id` ❌ · `ph` ❌ · `type` ❌ · `lbl` ❌ · `Number` ✅ · `a` ❌ · `desc` ❌ · `subtitle` ❌ · `what` ❌ · `example` ❌ · `inv` ❌ · `bio` ❌ · `quote` ❌ · `famous` ❌ · `octaSafeUrl` ❌ · `link` ❌ · `stockLogo` ❌ · `alpha` ❌ · `sizeClass` ❌ · `bg` ❌ · `gold2` ❌ · `symbol` ✅ · `item` ❌ · `now` ❌ · `getHours` ❌ · `toString` ❌ · `padStart` ❌ · `getMinutes` ❌ · `displayName` ✅ · `bestPickSymbol` ❌ · `active` ❌ · `value` ✅ · `c79a` ❌ · `dabf7` ❌ · `f4d03f` ❌ · `d4af37` ❌ · `f97316` ❌ · `verdict` ❌ · `action` ❌ · `finalScore` ❌ · `d` ✅ · `confidence` ❌ · `decMeta` ❌ · `cls` ❌ · `icon` ❌ · `extra` ❌ · `reasons` ❌ · `model` ❌ · `octa` ❌ · `cached` ❌ · `OCTA_API` ❌ · `s` ✅ · `attribute` ❌ · `$` ❌ · `octaEsc` ❌ · `table` ❌ · `COMPARE` ❌ · `stock` ✅ · `f` ❌ · `new` ❌ · `data` ❌ · `intensity` ❌ · `item` ❌ · `Screener` ❌ · `Search` ❌ · `scriptFile` ❌ · `symbol` ✅ · `tvSymbol` ✅ · `CORS` ❌ · `intelligence` ❌ · `code` ✅ · `d` ✅ · `why` ❌ · `label` ✅ · `val` ❌ · `cell` ❌ · `ch` ❌ · `confidence` ❌ · `t` ❌ · `v` ❌ · `indRow` ❌ · `ax` ❌ · `pos` ❌ · `med_escape` ❌ · `ENGINE` ❌ · `score` ❌ · `baseScore` ❌ | ❌ | عالية |
| `assets/js/octa-decide.js:262` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-decide.js:377` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-decide.js:429` | `ensureModal` | — | ✅ | منخفضة |
| `assets/js/octa-decide.js:453` | `ensureModal` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:263` | `fltRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:293` | `fltRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:511` | `fltIncRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:539` | `fltIncRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:779` | `fltMomRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:813` | `fltMomRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:944` | `fzRenderTabs` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:947` | `fzRenderTabs` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:1273` | `fzValRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:1309` | `fzValRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:1576` | `fzQualRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:1614` | `fzQualRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:1851` | `fzLiqRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:1884` | `fzLiqRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:2113` | `fzGrowRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:2148` | `fzGrowRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:2385` | `fzCfwRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:2422` | `fzCfwRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:2978` | `fzTripleRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:3000` | `fzFiveRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:3070` | `fzIdealRender` | `f` ❌ · `minPass` ❌ | ❌ | متوسطة |
| `assets/js/octa-filters.js:3122` | `fzIdealRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:3314` | `fzHeroRender` | — | ✅ | منخفضة |
| `assets/js/octa-filters.js:3714` | `fzTechRender` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:199` | `mount` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:389` | `pending` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:853` | `locked` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:876` | `lockedOld` | `mm` ❌ | ❌ | متوسطة |
| `assets/js/octa-gate.js:893` | `lockedOld` | `mm` ❌ | ❌ | متوسطة |
| `assets/js/octa-gate.js:912` | `down` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-gate.js:959` | `welcome` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:980` | `signup` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:1204` | `bioScreen` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:1250` | `done` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-gate.js:1333` | `bioLogin` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:1526` | `login` | `padHtml` ❌ | ❌ | متوسطة |
| `assets/js/octa-gate.js:1685` | `forgot` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:1748` | `askCode` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:1849` | `sayRate` | `mm` ❌ | ❌ | متوسطة |
| `assets/js/octa-gate.js:1857` | `sayRate` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:1864` | `sayRate` | `mm` ❌ | ❌ | متوسطة |
| `assets/js/octa-gate.js:1872` | `sayRate` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:1904` | `codeEntry` | `codeHtml` ❌ · `mm` ❌ | ❌ | متوسطة |
| `assets/js/octa-gate.js:2050` | `newPin` | `padHtml` ❌ | ❌ | متوسطة |
| `assets/js/octa-gate.js:2156` | `help` | — | ✅ | منخفضة |
| `assets/js/octa-gate.js:2181` | `pinStep` | `hint` ❌ · `padHtml` ❌ | ❌ | عالية |
| `assets/js/octa-gate.js:2508` | `idleCheck` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:500` | `drawGoldChart` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:506` | `drawGoldChart` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:603` | `zone` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:606` | `zone` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:677` | `drawCompareChart` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:680` | `drawCompareChart` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:705` | `drawCompareChart` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:708` | `drawCompareChart` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:727` | `drawMiniCharts` | `defs` ❌ · `sgn` ❌ · `sgnCls` ❌ · `d` ✅ · `icon` ❌ · `esc` ❌ · `badge` ❌ · `key` ❌ · `sub` ❌ | ❌ | متوسطة |
| `assets/js/octa-gold-egy.js:752` | `drawMiniCharts` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:773` | `drawMiniCharts` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1115` | `openEgy` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1179` | `showTab` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1214` | `setView` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1219` | `setView` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1223` | `setView` | `sgnCls` ❌ · `sgn` ❌ | ❌ | متوسطة |
| `assets/js/octa-gold-egy.js:1231` | `setView` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1239` | `renderAnalysis` | `periods` ❌ · `p` ✅ · `key` ❌ · `esc` ❌ | ❌ | متوسطة |
| `assets/js/octa-gold-egy.js:1259` | `renderAnalysis` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1260` | `renderAnalysis` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1261` | `renderAnalysis` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1262` | `renderAnalysis` | `D` ✅ · `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1280` | `paint` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1302` | `renderCompare` | `periods` ❌ · `p` ✅ · `key` ❌ · `esc` ❌ | ❌ | متوسطة |
| `assets/js/octa-gold-egy.js:1319` | `renderCompare` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1320` | `renderCompare` | `Economic` ❌ · `dtxt` ❌ | ❌ | متوسطة |
| `assets/js/octa-gold-egy.js:1334` | `paint` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1335` | `paint` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1336` | `paint` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1337` | `paint` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1343` | `paint` | `s` ✅ · `color` ❌ · `esc` ❌ · `sgnCls` ❌ · `sgn` ❌ | ❌ | متوسطة |
| `assets/js/octa-gold-egy.js:1439` | `paintTileNow` | — | ✅ | منخفضة |
| `assets/js/octa-gold-egy.js:1442` | `paintTileNow` | — | ✅ | منخفضة |
| `assets/js/octa-gold-savings.js:309` | `drawGram` | — | ✅ | منخفضة |
| `assets/js/octa-gold-savings.js:340` | `drawGram` | — | ✅ | منخفضة |
| `assets/js/octa-gold-savings.js:365` | `drawGram` | — | ✅ | منخفضة |
| `assets/js/octa-gold-savings.js:368` | `drawGram` | — | ✅ | منخفضة |
| `assets/js/octa-gold-savings.js:376` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-gold-savings.js:414` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-gold-savings.js:417` | `render` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-gold.js:988` | `openGold` | — | ✅ | منخفضة |
| `assets/js/octa-gold.js:1044` | `openGold` | — | ✅ | منخفضة |
| `assets/js/octa-gold.js:1078` | `showTab` | — | ✅ | منخفضة |
| `assets/js/octa-gold.js:1084` | `showTab` | — | ✅ | منخفضة |
| `assets/js/octa-gold.js:1087` | `showTab` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-gold.js:1106` | `showTab` | — | ✅ | منخفضة |
| `assets/js/octa-gold.js:1110` | `showTab` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-gold.js:1175` | `killChart` | — | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:177` | `openIndexIntel` | — | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:203` | `openIndexIntel` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:211` | `openIndexIntel` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:483` | `renderIndexIntel` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:747` | `renderIndexIntel` | `hero` ❌ · `dataStatus` ❌ · `perBtns` ❌ · `modeBtns` ❌ · `readoutHtml` ❌ · `chart` ❌ · `esc` ❌ · `stats` ❌ · `regHtml` ❌ · `eduHtml` ❌ · `offHtml` ❌ · `phasesHtml` ❌ · `evHtml` ❌ · `persHtml` ❌ · `consHtml` ❌ · `lessonHtml` ❌ · `srcHtml` ❌ | ❌ | متوسطة |
| `assets/js/octa-index-intel.js:841` | `renderConsTable` | — | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:955` | `showEventCard` | `esc` ❌ · `drange` ❌ · `signClass` ❌ · `pct` ❌ | ❌ | متوسطة |
| `assets/js/octa-index-intel.js:1054` | `bindIndexActions` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:1110` | `openIndexCompare` | — | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:1122` | `load` | — | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:1127` | `load` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:1130` | `load` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-index-intel.js:1169` | `renderCmp` | `ctl` ❌ · `chart` ❌ · `table` ❌ | ❌ | متوسطة |
| `assets/js/octa-index-intel.js:1222` | `drawCmp` | `paths` ❌ | ❌ | متوسطة |
| `assets/js/octa-money.js:402` | `buildSectors` | `secs` ❌ · `esc` ❌ | ❌ | متوسطة |
| `assets/js/octa-money.js:413` | `setStatus` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-money.js:419` | `renderStatus` | — | ✅ | منخفضة |
| `assets/js/octa-money.js:420` | `renderStatus` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-money.js:435` | `renderStatus` | `srcTxt` ❌ | ❌ | متوسطة |
| `assets/js/octa-money.js:461` | `renderList` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-money.js:465` | `renderList` | — | ✅ | منخفضة |
| `assets/js/octa-money.js:473` | `renderList` | — | ✅ | منخفضة |
| `assets/js/octa-money.js:482` | `renderList` | `rows` ❌ · `esc` ❌ · `f2` ❌ · `clr` ❌ · `pct` ❌ · `bar` ❌ · `axisCell` ❌ · `badgeHtml` ❌ | ❌ | متوسطة |
| `assets/js/octa-money.js:521` | `moneyOpen` | `esc` ❌ · `f2` ❌ · `clr` ❌ · `pct` ❌ · `badgeHtml` ❌ | ❌ | متوسطة |
| `assets/js/octa-money.js:586` | `moneyClose` | — | ✅ | منخفضة |
| `assets/js/octa-money.js:606` | `loadDetail` | `why` ❌ | ❌ | عالية |
| `assets/js/octa-money.js:616` | `loadDetail` | `esc` ❌ · `age` ❌ | ❌ | متوسطة |
| `assets/js/octa-money.js:625` | `loadDetail` | — | ✅ | منخفضة |
| `assets/js/octa-money.js:635` | `loadDetail` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-money.js:699` | `renderMap` | — | ✅ | منخفضة |
| `assets/js/octa-money.js:780` | `renderStrip` | — | ✅ | منخفضة |
| `assets/js/octa-money.js:1000` | `renderGuide` | — | ✅ | منخفضة |
| `assets/js/octa-movers.js:301` | `render` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-movers.js:307` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-movers.js:313` | `render` | `esc` ❌ · `heroHTML` ❌ · `periodHTML` ❌ · `moodHTML` ❌ · `gainers` ❌ · `losers` ❌ | ❌ | متوسطة |
| `assets/js/octa-movers.js:451` | `openSheet` | `esc` ❌ · `n2` ❌ · `dir` ❌ · `ltr` ❌ · `chips` ❌ · `c` ✅ · `k` ❌ · `perGrid` ❌ · `facts` ❌ | ❌ | متوسطة |
| `assets/js/octa-opps.js:756` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-opps.js:764` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-opps.js:769` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-opps.js:772` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-opps.js:788` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-opps.js:824` | `renderResultsOnly` | — | ✅ | منخفضة |
| `assets/js/octa-opps.js:859` | `renderOppsArm` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:81` | `openTradingView` | `ssEsc` ❌ | ✅ | منخفضة |
| `assets/js/octa-pages.js:111` | `openTradingView` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:120` | `openTradingView` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:218` | `renderHomeDividends` | `Number` ❌ · `a` ❌ · `value` ❌ · `toFixed` ❌ · `stockLogo` ❌ · `code` ❌ · `typeBadge` ❌ · `d` ❌ · `null` ❌ · `v` ❌ · `$` ❌ · `d` ❌ | ❌ | عالية |
| `assets/js/octa-pages.js:352` | `openIntel` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:463` | `loadIntelRule` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:476` | `loadIntelRule` | `INTEL_COPY` ❌ · `ruleTitle` ❌ · `ruleUnavailable` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:485` | `loadIntelRule` | `INTEL_COPY` ❌ · `ruleTitle` ❌ · `age` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:493` | `loadIntelRule` | `INTEL_COPY` ❌ · `ruleTitle` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:540` | `loadIntelRule` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:609` | `listHTML` | `ssEsc` ❌ · `decClass` ❌ · `riskCls` ❌ · `fvHtml` ❌ · `axisHtml` ❌ · `listHTML` ❌ · `f` ✅ · `rows` ❌ · `k` ❌ · `v` ❌ · `rk` ✅ · `risk_adjusted_opportunity` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:738` | `loadOpportunities` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:743` | `loadOpportunities` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:744` | `loadOpportunities` | `octaJsArg` ❌ · `s` ❌ · `code` ❌ · `dec` ❌ · `decision` ❌ · `up` ❌ · `risk` ❌ | ❌ | عالية |
| `assets/js/octa-pages.js:764` | `loadOpportunities` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:798` | `loadEarlyOpps` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:801` | `loadEarlyOpps` | `ssEsc` ❌ · `OCTA_API` ❌ · `code` ✅ · `CUR_STRAT` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:854` | `renderStrategies` | `tabs` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:866` | `renderStrategies` | `tabs` ❌ · `ssEsc` ❌ · `vc` ❌ · `s` ✅ · `abars` ❌ · `OCTA_API` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:911` | `loadDashboard` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1074` | `dist` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1286` | `avgAt` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1410` | `showArmView` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1426` | `showArmView` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1438` | `loadArmContent` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1589` | `loadPeriodData` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1595` | `loadPeriodData` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1596` | `loadPeriodData` | `up` ❌ · `dn` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:1599` | `loadPeriodData` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1631` | `openShariahIndex` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1648` | `openShariahIndex` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1717` | `renderShariah` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1856` | `renderTvSearchBox` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1874` | `tvSearch` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1883` | `tvSearch` | `ssEsc` ❌ | ✅ | منخفضة |
| `assets/js/octa-pages.js:1886` | `tvSearch` | `s` ❌ · `code` ❌ · `c` ❌ | ❌ | عالية |
| `assets/js/octa-pages.js:1976` | `showSector` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1978` | `showSector` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1982` | `showSector` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:1983` | `showSector` | `list` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:1986` | `showSector` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:2288` | `vRenderCard` | `fresh` ❌ · `vEsc` ❌ · `conf` ❌ · `d` ❌ · `data_confidence` ❌ · `vNf` ❌ · `chgCls` ❌ · `vRing` ❌ · `v` ❌ · `c` ❌ · `t` ❌ · `safety_score` ❌ · `arms` ❌ · `why` ❌ · `techHtml` ❌ · `riskHtml` ❌ · `entry` ❌ · `f` ❌ · `upside_pct` ❌ · `ab` ❌ · `invalHtml` ❌ | ❌ | عالية |
| `assets/js/octa-pages.js:2342` | `vLoadCard` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:2356` | `vLoadCard` | `vEsc` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:2363` | `initVerdictCard` | `c` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:2506` | `_armMarketRun` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:2584` | `initMarketTicker` | `t` ❌ · `c` ✅ · `id` ❌ · `heatColor` ❌ · `change` ❌ · `m` ❌ · `g` ❌ · `Number` ❌ · `toFixed` ❌ · `gold` ❌ · `b` ❌ · `style` ❌ · `color` ❌ · `var` ❌ · `red2` ❌ · `usd` ❌ · `egx30` ❌ · `spx` ❌ · `r` ❌ · `v` ❌ · `same` ❌ · `up` ❌ · `inv` ❌ · `down` ❌ · `a` ❌ · `why` ❌ · `s` ❌ · `avg` ❌ · `name` ❌ · `setups` ❌ · `cheap` ❌ · `undervalued` ❌ · `withDiv` ❌ · `all` ❌ · `thin` ❌ · `secList` ❌ · `k` ❌ · `median_pe` ❌ · `e` ✅ · `nameAr` ✅ · `code` ✅ · `safety` ❌ · `cls` ❌ · `avg_after` ❌ · `version` ❌ · `pf` ❌ · `shares` ❌ · `cost` ❌ · `diversification` ❌ · `rows` ❌ · `stage` ❌ · `slice` ❌ · `sc` ❌ · `null` ❌ · `small` ❌ · `score` ❌ · `TICKER_WANT` ❌ · `OCTA_API` ❌ · `chg` ❌ · `gold` ❌ · `html` ❌ · `sum` ❌ · `ic` ❌ · `secList` ❌ · `stockTable` ❌ · `Object` ❌ · `early` ❌ · `s` ❌ · `age` ❌ · `ssEsc` ❌ · `chart` ❌ · `path` ❌ · `r` ❌ · `code` ✅ · `f` ❌ · `valuation_status` ❌ · `query` ❌ · `enc` ❌ · `m` ❌ · `c` ✅ · `link` ❌ · `title` ❌ · `bidVol` ❌ · `txt` ✅ · `a` ❌ · `cls` ❌ · `ico` ❌ · `obFmt` ❌ · `tabs` ❌ · `t` ❌ · `side` ❌ · `akW` ❌ · `bkW` ❌ · `SI_CODE` ❌ · `cb` ❌ · `ca` ❌ · `msg` ❌ · `obSaveKey` ❌ · `regex` ❌ · `id` ❌ · `label` ❌ · `mk` ❌ · `OS_DB` ❌ · `secs` ❌ · `spFmtNum` ❌ · `spFmtPct` ❌ · `spFmtCap` ❌ · `mets` ❌ · `scCol` ❌ · `d` ❌ · `bg` ❌ · `p` ❌ · `$` ❌ · `dvNameAr` ❌ · `k` ❌ · `l` ❌ · `dvDate` ❌ · `dvDays` ❌ · `mkS` ❌ · `up` ❌ · `A` ❌ · `totVal` ❌ | ❌ | عالية |
| `assets/js/octa-pages.js:4021` | `dvNext` | `up` ❌ · `rows` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:4110` | `dvBook` | `tbl` ❌ · `SRC` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:4213` | `ipoRender` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:4215` | `ipoRender` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:4262` | `ipoRender` | `last` ❌ · `IPO_DATA` ❌ · `ipoNewPanel` ❌ · `tabs` ❌ · `rows` ❌ · `ipoTeaser` ❌ · `ipoAskPanel` ❌ | ❌ | متوسطة |
| `assets/js/octa-pages.js:4362` | `dvRender` | `label` ❌ · `rows` ❌ | ❌ | عالية |
| `assets/js/octa-pages.js:4364` | `dvRender` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:4368` | `dvRender` | `ssEsc` ❌ | ✅ | منخفضة |
| `assets/js/octa-pages.js:4396` | `dvLoad` | — | ✅ | منخفضة |
| `assets/js/octa-pages.js:4490` | `renderStockPage` | `intel` ✅ · `liquidity` ❌ · `score` ❌ · `toFixed` ❌ · `rk` ❌ · `safety_score` ❌ · `chg2` ❌ · `pos` ❌ · `neg` ❌ · `Number` ❌ · `price` ❌ · `SI_SCORE` ❌ · `confidence` ❌ · `decCls` ❌ · `fvHtml` ❌ · `stockNews` ❌ · `src` ❌ · `var` ❌ · `red2` ❌ · `fundamental` ❌ · `sector_peers` ❌ · `metrics` ❌ · `e9` ❌ · `technical` ❌ · `atr_pct` ❌ · `f` ✅ · `fair_value` ❌ · `axesHtml` ❌ · `P` ❌ · `E` ❌ · `intelScoreGuide` ❌ · `dec` ✅ · `intelConflictNote` ❌ · `ax` ❌ · `exRaw` ❌ · `formula` ❌ · `base_score` ❌ · `null` ❌ · `adjustment_total` ❌ · `Math` ❌ · `abs` ❌ · `final_score` ❌ · `div` ❌ · `class` ❌ · `si` ❌ · `fact` ❌ · `neu` ❌ · `span` ❌ · `fi` ❌ · `chg` ❌ · `inv` ❌ · `missing` ❌ · `a` ✅ · `status` ❌ · `upcoming` ❌ · `yieldPct` ❌ · `code` ✅ · `distributionDate` ✅ · `date` ✅ · `nameAr` ❌ · `slice` ✅ · `value` ✅ · `risk_level` ❌ · `risks` ❌ · `k` ✅ · `v` ❌ · `ff9800` ❌ · `gold` ❌ · `name` ✅ · `sym` ✅ · `chgCls` ❌ · `chgSign` ❌ · `tradingViewUrl` ❌ · `s` ✅ · `stocks` ❌ · `score_spread` ❌ · `median_score` ❌ · `stocks_in_median_band` ❌ · `decision_dominance_pct` ❌ · `dominant_decision` ❌ · `r` ✅ · `severity` ❌ · `item` ❌ · `high` ❌ · `medium` ❌ · `l` ❌ · `fix` ❌ · `min` ❌ · `p` ❌ · `b` ✅ · `diff` ❌ · `cr` ✅ · `bands_with_20plus` ❌ · `worst_band` ❌ · `worst_band_count` ❌ · `q` ✅ · `SS_ALL` ❌ · `c` ✅ · `badge` ❌ · `ic` ❌ · `icon` ❌ · `title` ❌ · `desc` ❌ · `stats` ❌ · `stat` ❌ · `more` ❌ · `state` ❌ · `bull` ❌ · `bear` ❌ · `dim` ❌ · `gauge` ❌ · `label` ❌ · `sub` ❌ · `markerPos` ❌ · `stockNews` ❌ · `confidence` ❌ · `contrib` ❌ · `t` ✅ · `ssEsc` ❌ · `name` ✅ · `code` ✅ · `OCTA_API` ❌ · `SS_ALL` ❌ · `SS_SEL` ❌ · `badge` ❌ · `stats` ❌ · `list` ❌ · `KEEP` ❌ · `id` ❌ · `insertBefore` ❌ · `GA_WANT` ❌ · `a` ✅ · `B` ❌ · `judged` ❌ · `esc` ❌ · `c` ✅ · `pct` ❌ · `r` ✅ · `gauge` ❌ · `cur` ❌ · `state` ❌ · `stName` ❌ · `stSub` ❌ · `compsHtml` ❌ · `decHtml` ❌ · `nIns` ❌ · `bandHtml` ❌ · `nPos` ❌ · `nNeu` ❌ · `nNeg` ❌ · `sentSum` ❌ · `f3` ❌ · `f1` ❌ · `f2` ❌ · `pricePart` ❌ · `safetyPart` ❌ · `composite` ❌ · `attribute` ❌ | ❌ | عالية |
| `assets/js/octa-public-market.js:173` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-public-market.js:184` | `render` | `secs` ❌ · `esc` ❌ · `secSet` ❌ | ❌ | متوسطة |
| `assets/js/octa-public-market.js:202` | `setMk` | — | ✅ | منخفضة |
| `assets/js/octa-public-market.js:219` | `boot` | `m` ✅ · `id` ❌ · `esc` ❌ | ❌ | متوسطة |
| `assets/js/octa-radar-ui.js:67` | `el` | — | ✅ | منخفضة |
| `assets/js/octa-radar-ui.js:420` | `showDiag` | `info` ❌ · `esc` ❌ | ❌ | متوسطة |
| `assets/js/octa-radar-ui.js:501` | `setStatus` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-radar-ui.js:530` | `renderProgress` | `S` ❌ · `done` ❌ · `pct` ❌ · `step` ❌ | ❌ | متوسطة |
| `assets/js/octa-radar-ui.js:690` | `renderList` | — | ✅ | منخفضة |
| `assets/js/octa-radar-ui.js:774` | `renderList` | `head` ❌ · `frow` ❌ · `body` ❌ | ❌ | عالية |
| `assets/js/octa-radar-ui.js:852` | `openStock` | — | ✅ | منخفضة |
| `assets/js/octa-radar-ui.js:858` | `openStock` | — | ✅ | منخفضة |
| `assets/js/octa-radar-ui.js:1072` | `bindDetail` | `c` ✅ · `esc` ❌ · `fmtPrice` ❌ · `fmtNum` ❌ | ❌ | متوسطة |
| `assets/js/octa-radar-ui.js:1139` | `emaLine` | — | ✅ | منخفضة |
| `assets/js/octa-radar-ui.js:1142` | `emaLine` | — | ✅ | منخفضة |
| `assets/js/octa-radar-ui.js:1153` | `showTip` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-radar-ui.js:1188` | `fillSectors` | `S` ❌ · `keys` ❌ · `esc` ❌ · `set` ❌ | ❌ | متوسطة |
| `assets/js/octa-radar-ui.js:1257` | `renderAll` | — | ✅ | منخفضة |
| `assets/js/octa-radar-ui.js:1279` | `renderAll` | — | ✅ | منخفضة |
| `assets/js/octa-screener.js:547` | `renderMktNote` | — | ✅ | منخفضة |
| `assets/js/octa-screener.js:550` | `renderMktNote` | — | ✅ | منخفضة |
| `assets/js/octa-screener.js:552` | `renderMktNote` | `st` ❌ · `nextAt` ❌ | ❌ | متوسطة |
| `assets/js/octa-screener.js:596` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-screener.js:599` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-screener.js:601` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-screener.js:602` | `render` | `aboutBox` ❌ | ❌ | متوسطة |
| `assets/js/octa-screener.js:605` | `render` | `ar` ❌ · `aboutBox` ❌ | ❌ | متوسطة |
| `assets/js/octa-settings.js:813` | `render` | `SECS` ❌ · `s` ❌ · `id` ❌ · `ic` ❌ · `t` ❌ · `body` ❌ | ❌ | عالية |
| `assets/js/octa-settings.js:989` | `onSlide` | `ltr` ❌ · `tot` ❌ | ❌ | متوسطة |
| `assets/js/octa-setups.js:84` | `setStatus` | `dot` ❌ · `esc` ❌ | ❌ | متوسطة |
| `assets/js/octa-setups.js:194` | `selectItem` | `fmtDate` ❌ · `it` ✅ · `days_ago` ❌ · `esc` ❌ | ❌ | متوسطة |
| `assets/js/octa-setups.js:201` | `selectItem` | `kv` ❌ | ❌ | متوسطة |
| `assets/js/octa-setups.js:216` | `selectItem` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:294` | `drawPattern` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:299` | `drawPattern` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:318` | `drawPattern` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:364` | `showTab` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:372` | `drawMainChart` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:381` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:385` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:456` | `renderTable` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:532` | `renderTable` | `cards` ❌ · `measuredNote` ❌ | ❌ | متوسطة |
| `assets/js/octa-setups.js:869` | `openAnalysis` | `esc` ❌ · `fmtDate` ❌ · `codeBoxHTML` ❌ · `analysisHTML` ❌ | ❌ | متوسطة |
| `assets/js/octa-setups.js:957` | `openAnalysis` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-setups.js:986` | `openDetail` | `esc` ❌ · `fmtDate` ❌ · `it` ✅ · `days_ago` ❌ · `kv` ❌ | ❌ | متوسطة |
| `assets/js/octa-setups.js:1100` | `drawChart` | — | ✅ | منخفضة |
| `assets/js/octa-setups.js:1113` | `mount` | — | ✅ | منخفضة |
| `assets/js/octa-sidebar.js:112` | `build` | `html` ❌ | ❌ | متوسطة |
| `assets/js/octa-stats.js:74` | `block` | — | ✅ | منخفضة |
| `assets/js/octa-stats.js:85` | `block` | — | ✅ | منخفضة |
| `assets/js/octa-stats.js:98` | `block` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-stats.js:117` | `block` | — | ✅ | منخفضة |
| `assets/js/octa-stats.js:119` | `block` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-studio.js:64` | `setStatus` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-studio.js:103` | `loadCode` | — | ✅ | منخفضة |
| `assets/js/octa-studio.js:167` | `draw` | — | ✅ | منخفضة |
| `assets/js/octa-studio.js:170` | `draw` | — | ✅ | منخفضة |
| `assets/js/octa-studio.js:179` | `renderSR` | — | ✅ | منخفضة |
| `assets/js/octa-studio.js:180` | `renderSR` | — | ✅ | منخفضة |
| `assets/js/octa-studio.js:214` | `renderList` | — | ✅ | منخفضة |
| `assets/js/octa-studio.js:232` | `renderList` | — | ✅ | منخفضة |
| `assets/js/octa-studio.js:308` | `bind` | — | ✅ | منخفضة |
| `assets/js/octa-studio.js:311` | `bind` | — | ✅ | منخفضة |
| `assets/js/octa-studio.js:338` | `lockPanel` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:595` | `renderPanel` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:602` | `renderPanel` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:624` | `modalEl` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:654` | `techOpenModal` | `tEsc` ❌ | ❌ | متوسطة |
| `assets/js/octa-techfilter.js:656` | `techOpenModal` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:680` | `loadDetail` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:686` | `loadDetail` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:687` | `loadDetail` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:745` | `loadDetail` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:747` | `loadDetail` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:750` | `loadDetail` | `tEsc` ❌ | ❌ | متوسطة |
| `assets/js/octa-techfilter.js:751` | `loadDetail` | `tNum` ❌ · `tEsc` ❌ | ❌ | متوسطة |
| `assets/js/octa-techfilter.js:757` | `loadDetail` | — | ✅ | منخفضة |
| `assets/js/octa-techfilter.js:758` | `loadDetail` | — | ✅ | منخفضة |
| `assets/js/octa-update.js:45` | `showBar` | — | ✅ | منخفضة |
| `assets/js/octa-update.js:88` | `showBar` | — | ✅ | منخفضة |
| `assets/js/octa-us-arms.js:286` | `usOpenArm` | — | ✅ | منخفضة |
| `assets/js/octa-us-arms.js:290` | `usOpenArm` | — | ✅ | منخفضة |
| `assets/js/octa-us-arms.js:292` | `usOpenArm` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-us-intel.js:224` | `usAlerts` | — | ✅ | منخفضة |
| `assets/js/octa-us-intel.js:234` | `usAlerts` | `nf` ❌ · `bg` ❌ · `shares` ❌ · `gateHtml` ❌ · `usTicket` ❌ | ❌ | متوسطة |
| `assets/js/octa-usd-intel.js:76` | `openUSDIntel` | — | ✅ | منخفضة |
| `assets/js/octa-usd-intel.js:102` | `loadAll` | — | ✅ | منخفضة |
| `assets/js/octa-usd-intel.js:108` | `loadAll` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-usd-intel.js:118` | `loadAll` | — | ✅ | منخفضة |
| `assets/js/octa-usd-intel.js:716` | `render` | `tabs` ❌ | ❌ | متوسطة |
| `assets/js/octa-usd-intel.js:767` | `openFactor` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-watch.js:87` | `nmOf` | `esc` ❌ · `dHi` ❌ · `dLo` ❌ | ❌ | متوسطة |
| `assets/js/octa-zones.js:53` | `setStatus` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/octa-zones.js:110` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-zones.js:116` | `render` | — | ✅ | منخفضة |
| `assets/js/octa-zones.js:124` | `renderTable` | — | ✅ | منخفضة |
| `assets/js/octa-zones.js:159` | `renderTable` | `cards` ❌ | ❌ | متوسطة |
| `assets/js/octa-zones.js:192` | `select` | `fmtPrice` ❌ | ❌ | متوسطة |
| `assets/js/octa-zones.js:214` | `drawChart` | — | ✅ | منخفضة |
| `assets/js/octa-zones.js:223` | `drawChart` | — | ✅ | منخفضة |
| `assets/js/octa-zones.js:225` | `drawChart` | — | ✅ | منخفضة |
| `assets/js/octa-zones.js:228` | `drawChart` | — | ✅ | منخفضة |
| `assets/js/tv-shim.js:257` | `mount` | — | ✅ | منخفضة |
| `assets/js/tv-shim.js:264` | `mount` | `sym` ❌ | ❌ | متوسطة |
| `assets/js/tv-shim.js:272` | `mount` | — | ✅ | منخفضة |
| `assets/js/tv-shim.js:311` | `mount` | — | ✅ | منخفضة |
| `assets/js/tv-shim.js:355` | `mount` | — | ✅ | منخفضة |
| `assets/js/tv-shim.js:617` | `paint` | — | ✅ | منخفضة |
| `assets/js/tv-shim.js:624` | `paint` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/tv-shim.js:632` | `paint` | `esc` ❌ | ✅ | منخفضة |
| `assets/js/tv-shim.js:714` | `makeShotBtn` | — | ✅ | منخفضة |

## الباقي — ترشيح للجولة الجاية (أعلى ١٠ مواضع متبقية)

| # | الملف:السطر | الدالة | الحقول غير المُرمَّزة |
|---|---|---|---|
| 1 | `assets/js/octa-pages.js:2584` | `initMarketTicker` | `why` · `name` · `valuation_status` · `title` · `SI_CODE` · `label` |
| 2 | `assets/js/octa-core.js:2060` | `updateTablePrices` | `desc` · `verdict` · `action` · `why` |
| 3 | `assets/js/octa-app.js:2048` | `cmpRender` | `label` · `code` |
| 4 | `assets/js/octa-pages.js:218` | `renderHomeDividends` | `value` · `code` |
| 5 | `assets/js/octa-pages.js:2288` | `vRenderCard` | `why` |
| 6 | `assets/js/octa-app.js:1621` | `openStockModal` | `code` |
| 7 | `assets/js/octa-app.js:2473` | `pickRenderCards` | `code` |
| 8 | `assets/js/octa-pages.js:744` | `loadOpportunities` | `code` |
| 9 | `assets/js/octa-settings.js:813` | `render` | `body` |
| 10 | `assets/js/octa-app.js:414` | `renderTabs` | `name` |

> ملاحظة: أدوات الفحص بتعتبر «غير مُرمَّز» أي إدراج نصّي بحقل متغيّر.
> بعض المواضع أرقام/قيم ثابتة (اِختبار يدوي مطلوب قبل أي تعديل).

