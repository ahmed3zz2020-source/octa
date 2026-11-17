# تصنيف مواضع إدراج HTML غير المُرمَّزة — الجولة ١٩ (SEC-024)

> مولَّد بـ `node tools/xss-inventory.js --triage docs/XSS-TRIAGE-R19.md` — أداة قراءة بس (مافيش تعديل على الكود).
> ⛔ التصنيف **تقريبي** (نمطي): «مصدر غير مؤكد» = محتاج مراجعة يدوية — مش معناه ثغنة.

## الأرقام

- إجمالي مواضع إدراج HTML: **422**
- مواضع فيها إدراج غير مُرمَّز (موضع/سطر): **103**
- عدد الحقول غير المُرمَّزة جوهها: **701**

### حسب مصدر البيانات

| المصدر | العدد |
|---|---|
| غير محدد | 635 |
| API | 37 |
| رقم | 25 |
| مستخدم | 4 |

### حسب سياق الإدراج

| السياق | العدد |
|---|---|
| نص | 613 |
| خاصية | 47 |
| حدث داخل | 17 |
| ستايل | 15 |
| مقارنة | 6 |
| رابط/مصدر | 3 |

### حسب قابلية الاستغلال

| القابلية | العدد |
|---|---|
| منخفضة (مصدر غير مؤكد) | 627 |
| متوسطة | 38 |
| منخفضة | 24 |
| منخفضة (ملاحظة يدوية — راجع السبب) | 6 |
| منخفضة (مقارنة — مش حقن) | 6 |

## الجدول الكامل (كل موضع غير مُرمَّز)

| # | الملف:السطر | الدالة | الحقل | المصدر | السياق | القابلية |
|---|---|---|---|---|---|---|
| 1 | `assets/js/na-axis.js:89` | `naRender` | `all` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 2 | `assets/js/na-axis.js:91` | `naRender` | `fake` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 3 | `assets/js/na-axis.js:93` | `naRender` | `upd` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 4 | `assets/js/na-axis.js:122` | `naRender` | `flab` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 5 | `assets/js/na-axis.js:123` | `naRender` | `rows` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 6 | `assets/js/na-axis.js:151` | `naRender` | `m` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 7 | `assets/js/na-axis.js:151` | `naRender` | `t` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 8 | `assets/js/octa-app.js:416` | `renderTabs` | `k` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 9 | `assets/js/octa-app.js:417` | `renderTabs` | `m` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 10 | `assets/js/octa-app.js:417` | `renderTabs` | `flag` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 11 | `assets/js/octa-app.js:417` | `renderTabs` | `name` | API | نص | متوسطة |
| 12 | `assets/js/octa-app.js:426` | `renderFilters` | `f` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 13 | `assets/js/octa-app.js:426` | `renderFilters` | `id` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 14 | `assets/js/octa-app.js:426` | `renderFilters` | `label` | API | نص | متوسطة |
| 15 | `assets/js/octa-app.js:437` | `renderMktBar` | `m` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 16 | `assets/js/octa-app.js:437` | `renderMktBar` | `flag` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 17 | `assets/js/octa-app.js:438` | `renderMktBar` | `v` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 18 | `assets/js/octa-app.js:439` | `renderMktBar` | `c` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 19 | `assets/js/octa-app.js:440` | `renderMktBar` | `cl` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 20 | `assets/js/octa-app.js:440` | `renderMktBar` | `lb` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 21 | `assets/js/octa-app.js:516` | `render` | `rows` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 22 | `assets/js/octa-app.js:522` | `render` | `MK` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 23 | `assets/js/octa-app.js:527` | `render` | `nf` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 24 | `assets/js/octa-app.js:529` | `render` | `cls` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 25 | `assets/js/octa-app.js:531` | `render` | `vc` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 26 | `assets/js/octa-app.js:531` | `render` | `vt` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 27 | `assets/js/octa-app.js:534` | `render` | `big` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 28 | `assets/js/octa-app.js:535` | `render` | `sf` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 29 | `assets/js/octa-app.js:539` | `render` | `more` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 30 | `assets/js/octa-app.js:644` | `openCard` | `octaJsArg` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 31 | `assets/js/octa-app.js:1623` | `openStockModal` | `code` | API | نص | متوسطة |
| 32 | `assets/js/octa-app.js:1626` | `openStockModal` | `chg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 33 | `assets/js/octa-app.js:1628` | `openStockModal` | `S` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 34 | `assets/js/octa-app.js:1630` | `openStockModal` | `decCol` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 35 | `assets/js/octa-app.js:1630` | `openStockModal` | `dec` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 36 | `assets/js/octa-app.js:1633` | `openStockModal` | `axHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 37 | `assets/js/octa-app.js:1635` | `openStockModal` | `f` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 38 | `assets/js/octa-app.js:1637` | `openStockModal` | `pos` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 39 | `assets/js/octa-app.js:1637` | `openStockModal` | `tp` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 40 | `assets/js/octa-app.js:1637` | `openStockModal` | `neg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 41 | `assets/js/octa-app.js:1637` | `openStockModal` | `tn` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 42 | `assets/js/octa-app.js:1638` | `openStockModal` | `ex` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 43 | `assets/js/octa-app.js:2050` | `cmpRender` | `V` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 44 | `assets/js/octa-app.js:2050` | `cmpRender` | `label` | API | نص | متوسطة |
| 45 | `assets/js/octa-app.js:2051` | `cmpRender` | `code` | API | نص | متوسطة |
| 46 | `assets/js/octa-app.js:2051` | `cmpRender` | `pct` | رقم | نص | منخفضة |
| 47 | `assets/js/octa-app.js:2051` | `cmpRender` | `wins` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 48 | `assets/js/octa-app.js:2055` | `cmpRender` | `bars` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 49 | `assets/js/octa-app.js:2057` | `cmpRender` | `cmpRadar` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 50 | `assets/js/octa-app.js:2057` | `cmpRender` | `list` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 51 | `assets/js/octa-app.js:2058` | `cmpRender` | `cmpColor` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 52 | `assets/js/octa-app.js:2058` | `cmpRender` | `s` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 53 | `assets/js/octa-app.js:2060` | `cmpRender` | `wg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 54 | `assets/js/octa-app.js:2061` | `cmpRender` | `tbl` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 55 | `assets/js/octa-app.js:2062` | `cmpRender` | `cards` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 56 | `assets/js/octa-app.js:2359` | `pickRenderList` | `s` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 57 | `assets/js/octa-app.js:2359` | `pickRenderList` | `code` | API | نص | متوسطة |
| 58 | `assets/js/octa-app.js:2359` | `pickRenderList` | `escPick` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 59 | `assets/js/octa-app.js:2392` | `pickRender` | `PICK_MAX` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 60 | `assets/js/octa-app.js:2468` | `pickRenderCards` | `PICK_MAX` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 61 | `assets/js/octa-app.js:2473` | `pickRenderCards` | `ptRenderFilters` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 62 | `assets/js/octa-app.js:2473` | `pickRenderCards` | `ptRenderTable` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 63 | `assets/js/octa-app.js:2476` | `pickRenderCards` | `S` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 64 | `assets/js/octa-app.js:2476` | `pickRenderCards` | `code` | API | نص | متوسطة |
| 65 | `assets/js/octa-app.js:2476` | `pickRenderCards` | `escPick` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 66 | `assets/js/octa-app.js:2480` | `pickRenderCards` | `Object` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 67 | `assets/js/octa-app.js:2482` | `pickRenderCards` | `pickColor` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 68 | `assets/js/octa-app.js:2482` | `pickRenderCards` | `k` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 69 | `assets/js/octa-app.js:2482` | `pickRenderCards` | `a2` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 70 | `assets/js/octa-app.js:2482` | `pickRenderCards` | `share` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 71 | `assets/js/octa-auth.js:121` | `modal` | `html` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 72 | `assets/js/octa-challenges.js:207` | `renderStats` | `fmtPct` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 73 | `assets/js/octa-challenges.js:329` | `renderVoteState` | `d` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 74 | `assets/js/octa-challenges.js:329` | `renderVoteState` | `daysWord` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 75 | `assets/js/octa-challenges.js:408` | `renderResult` | `outCls` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 76 | `assets/js/octa-challenges.js:408` | `renderResult` | `outTxt` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 77 | `assets/js/octa-challenges.js:409` | `renderResult` | `fmtDate` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 78 | `assets/js/octa-challenges.js:418` | `renderResult` | `verdict` | API | نص | متوسطة |
| 79 | `assets/js/octa-challenges.js:468` | `renderLeaderboard` | `meRow` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 80 | `assets/js/octa-challenges.js:471` | `renderLeaderboard` | `rows` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 81 | `assets/js/octa-chartkit.js:416` | `draw` | `html` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 82 | `assets/js/octa-copy.js:285` | `—` | `LABELS` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 83 | `assets/js/octa-copy.js:286` | `—` | `TITLES` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 84 | `assets/js/octa-copy.js:288` | `—` | `html` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 85 | `assets/js/octa-copy.js:322` | `—` | `tries` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 86 | `assets/js/octa-core.js:308` | `fetchAllNews` | `new` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 87 | `assets/js/octa-core.js:308` | `fetchAllNews` | `Date` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 88 | `assets/js/octa-core.js:308` | `fetchAllNews` | `toLocaleTimeString` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 89 | `assets/js/octa-core.js:308` | `fetchAllNews` | `ar` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 90 | `assets/js/octa-core.js:308` | `fetchAllNews` | `EG` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 91 | `assets/js/octa-core.js:981` | `buildToolbar` | `t` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 92 | `assets/js/octa-core.js:981` | `buildToolbar` | `id` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 93 | `assets/js/octa-core.js:981` | `buildToolbar` | `L` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 94 | `assets/js/octa-core.js:981` | `buildToolbar` | `d` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 95 | `assets/js/octa-core.js:1647` | `buildToolbar` | `OS_DB` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 96 | `assets/js/octa-core.js:1647` | `buildToolbar` | `Object` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 97 | `assets/js/octa-core.js:1647` | `buildToolbar` | `keys` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 98 | `assets/js/octa-core.js:1647` | `buildToolbar` | `live` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 99 | `assets/js/octa-core.js:1647` | `buildToolbar` | `EGX_META` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 100 | `assets/js/octa-core.js:1053` | `buildToolbar` | `ord` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 101 | `assets/js/octa-core.js:1058` | `buildToolbar` | `t` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 102 | `assets/js/octa-core.js:1059` | `buildToolbar` | `d` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 103 | `assets/js/octa-core.js:1064` | `buildToolbar` | `id` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 104 | `assets/js/octa-core.js:1071` | `buildToolbar` | `hid` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 105 | `assets/js/octa-core.js:1126` | `buildToolbar` | `new` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 106 | `assets/js/octa-core.js:1199` | `buildToolbar` | `Scanner` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 107 | `assets/js/octa-core.js:1261` | `buildToolbar` | `OCTA_API` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 108 | `assets/js/octa-core.js:1261` | `buildToolbar` | `path` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 109 | `assets/js/octa-core.js:1533` | `buildToolbar` | `v` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 110 | `assets/js/octa-core.js:1538` | `buildToolbar` | `parts` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 111 | `assets/js/octa-core.js:1538` | `buildToolbar` | `sumTxt` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 112 | `assets/js/octa-core.js:1696` | `octaInit` | `c` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 113 | `assets/js/octa-core.js:1702` | `octaInit` | `OS_DB` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 114 | `assets/js/octa-core.js:1702` | `octaInit` | `live` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 115 | `assets/js/octa-core.js:1704` | `octaInit` | `OS_META` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 116 | `assets/js/octa-core.js:1722` | `octaSectors` | `OS_SECT` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 117 | `assets/js/octa-core.js:1722` | `octaSectors` | `all` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 118 | `assets/js/octa-core.js:1722` | `octaSectors` | `on` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 119 | `assets/js/octa-core.js:1722` | `octaSectors` | `OS_DB` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 120 | `assets/js/octa-core.js:1722` | `octaSectors` | `secs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 121 | `assets/js/octa-core.js:1741` | `octaSectors` | `octaFmtCap` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 122 | `assets/js/octa-core.js:1756` | `octaSectors` | `OS_DB` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 123 | `assets/js/octa-core.js:1756` | `octaSectors` | `OS_SECT` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 124 | `assets/js/octa-core.js:1756` | `octaSectors` | `list` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 125 | `assets/js/octa-core.js:1768` | `octaSectors` | `dc` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 126 | `assets/js/octa-core.js:1768` | `octaSectors` | `dbg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 127 | `assets/js/octa-core.js:1769` | `octaSectors` | `fundLine` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 128 | `assets/js/octa-core.js:1871` | `renderAiLoading` | `code` | API | نص | متوسطة |
| 129 | `assets/js/octa-core.js:1884` | `renderAiLoading` | `OCTA_API` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 130 | `assets/js/octa-core.js:2060` | `updateTablePrices` | `live` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 131 | `assets/js/octa-core.js:2060` | `updateTablePrices` | `change` | رقم | نص | منخفضة |
| 132 | `assets/js/octa-core.js:2060` | `updateTablePrices` | `sign` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 133 | `assets/js/octa-core.js:2060` | `updateTablePrices` | `toFixed` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 134 | `assets/js/octa-core.js:2116` | `updateTablePrices` | `arrow` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 135 | `assets/js/octa-core.js:2191` | `updateTablePrices` | `startsWith` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 136 | `assets/js/octa-core.js:2191` | `updateTablePrices` | `var` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 137 | `assets/js/octa-core.js:2191` | `updateTablePrices` | `red2` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 138 | `assets/js/octa-core.js:2191` | `updateTablePrices` | `parseInt` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 139 | `assets/js/octa-core.js:2191` | `updateTablePrices` | `muted` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 140 | `assets/js/octa-core.js:2191` | `updateTablePrices` | `pct` | رقم | نص | منخفضة |
| 141 | `assets/js/octa-core.js:2197` | `updateTablePrices` | `safeId` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 142 | `assets/js/octa-core.js:2266` | `updateTablePrices` | `substring` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 143 | `assets/js/octa-core.js:2281` | `updateTablePrices` | `price` | رقم | نص | منخفضة |
| 144 | `assets/js/octa-core.js:2282` | `updateTablePrices` | `up` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 145 | `assets/js/octa-core.js:2282` | `updateTablePrices` | `down` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 146 | `assets/js/octa-core.js:2317` | `updateTablePrices` | `Math` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 147 | `assets/js/octa-core.js:2317` | `updateTablePrices` | `abs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 148 | `assets/js/octa-core.js:2322` | `updateTablePrices` | `vol` | رقم | نص | منخفضة |
| 149 | `assets/js/octa-core.js:2323` | `updateTablePrices` | `pe` | رقم | نص | منخفضة |
| 150 | `assets/js/octa-core.js:2324` | `updateTablePrices` | `div` | رقم | نص | منخفضة |
| 151 | `assets/js/octa-core.js:2324` | `updateTablePrices` | `yield` | رقم | نص | منخفضة |
| 152 | `assets/js/octa-core.js:2331` | `updateTablePrices` | `P` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 153 | `assets/js/octa-core.js:2331` | `updateTablePrices` | `E` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 154 | `assets/js/octa-core.js:2373` | `updateTablePrices` | `get` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 155 | `assets/js/octa-core.js:2381` | `updateTablePrices` | `winner` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 156 | `assets/js/octa-core.js:2382` | `updateTablePrices` | `cheaper` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 157 | `assets/js/octa-core.js:2383` | `updateTablePrices` | `perf` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 158 | `assets/js/octa-core.js:2438` | `updateTablePrices` | `c` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 159 | `assets/js/octa-core.js:2440` | `updateTablePrices` | `f` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 160 | `assets/js/octa-core.js:2440` | `updateTablePrices` | `id` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 161 | `assets/js/octa-core.js:2440` | `updateTablePrices` | `ph` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 162 | `assets/js/octa-core.js:2441` | `updateTablePrices` | `type` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 163 | `assets/js/octa-core.js:2471` | `updateTablePrices` | `lbl` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 164 | `assets/js/octa-core.js:2476` | `updateTablePrices` | `a` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 165 | `assets/js/octa-core.js:2480` | `updateTablePrices` | `desc` | API | نص | متوسطة |
| 166 | `assets/js/octa-core.js:2493` | `updateTablePrices` | `subtitle` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 167 | `assets/js/octa-core.js:2494` | `updateTablePrices` | `what` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 168 | `assets/js/octa-core.js:2498` | `updateTablePrices` | `example` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 169 | `assets/js/octa-core.js:2507` | `updateTablePrices` | `inv` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 170 | `assets/js/octa-core.js:2509` | `updateTablePrices` | `bio` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 171 | `assets/js/octa-core.js:2513` | `updateTablePrices` | `quote` | مستخدم | نص | متوسطة |
| 172 | `assets/js/octa-core.js:2515` | `updateTablePrices` | `famous` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 173 | `assets/js/octa-core.js:2563` | `updateTablePrices` | `octaSafeUrl` | غير محدد | رابط/مصدر | منخفضة (مصدر غير مؤكد) |
| 174 | `assets/js/octa-core.js:2563` | `updateTablePrices` | `link` | غير محدد | رابط/مصدر | منخفضة (مصدر غير مؤكد) |
| 175 | `assets/js/octa-core.js:2662` | `updateTablePrices` | `stockLogo` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 176 | `assets/js/octa-core.js:2748` | `updateTablePrices` | `alpha` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 177 | `assets/js/octa-core.js:2757` | `updateTablePrices` | `sizeClass` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 178 | `assets/js/octa-core.js:2757` | `updateTablePrices` | `bg` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 179 | `assets/js/octa-core.js:2773` | `updateTablePrices` | `gold2` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 180 | `assets/js/octa-core.js:2868` | `updateTablePrices` | `item` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 181 | `assets/js/octa-core.js:2960` | `updateTablePrices` | `now` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 182 | `assets/js/octa-core.js:2960` | `updateTablePrices` | `getHours` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 183 | `assets/js/octa-core.js:2960` | `updateTablePrices` | `toString` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 184 | `assets/js/octa-core.js:2960` | `updateTablePrices` | `padStart` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 185 | `assets/js/octa-core.js:2960` | `updateTablePrices` | `getMinutes` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 186 | `assets/js/octa-core.js:3175` | `updateTablePrices` | `bestPickSymbol` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 187 | `assets/js/octa-core.js:3175` | `updateTablePrices` | `active` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 188 | `assets/js/octa-core.js:3460` | `updateTablePrices` | `c79a` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 189 | `assets/js/octa-core.js:3460` | `updateTablePrices` | `dabf7` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 190 | `assets/js/octa-core.js:3460` | `updateTablePrices` | `f4d03f` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 191 | `assets/js/octa-core.js:3460` | `updateTablePrices` | `d4af37` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 192 | `assets/js/octa-core.js:3460` | `updateTablePrices` | `f97316` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 193 | `assets/js/octa-core.js:3475` | `updateTablePrices` | `verdict` | API | نص | متوسطة |
| 194 | `assets/js/octa-core.js:3476` | `updateTablePrices` | `action` | API | نص | متوسطة |
| 195 | `assets/js/octa-core.js:3477` | `updateTablePrices` | `finalScore` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 196 | `assets/js/octa-core.js:3513` | `updateTablePrices` | `confidence` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 197 | `assets/js/octa-core.js:3515` | `updateTablePrices` | `decMeta` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 198 | `assets/js/octa-core.js:3515` | `updateTablePrices` | `cls` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 199 | `assets/js/octa-core.js:3515` | `updateTablePrices` | `icon` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 200 | `assets/js/octa-core.js:3516` | `updateTablePrices` | `extra` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 201 | `assets/js/octa-core.js:3538` | `updateTablePrices` | `reasons` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 202 | `assets/js/octa-core.js:3542` | `updateTablePrices` | `model` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 203 | `assets/js/octa-core.js:3542` | `updateTablePrices` | `octa` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 204 | `assets/js/octa-core.js:3542` | `updateTablePrices` | `cached` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 205 | `assets/js/octa-core.js:2098` | `updateTablePrices` | `OCTA_API` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 206 | `assets/js/octa-core.js:2176` | `updateTablePrices` | `attribute` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 207 | `assets/js/octa-core.js:2197` | `updateTablePrices` | `$` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 208 | `assets/js/octa-core.js:2359` | `updateTablePrices` | `table` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 209 | `assets/js/octa-core.js:2388` | `updateTablePrices` | `COMPARE` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 210 | `assets/js/octa-core.js:2452` | `updateTablePrices` | `f` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 211 | `assets/js/octa-core.js:2710` | `updateTablePrices` | `new` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 212 | `assets/js/octa-core.js:2744` | `updateTablePrices` | `data` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 213 | `assets/js/octa-core.js:2746` | `updateTablePrices` | `intensity` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 214 | `assets/js/octa-core.js:2863` | `updateTablePrices` | `item` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 215 | `assets/js/octa-core.js:2974` | `updateTablePrices` | `Screener` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 216 | `assets/js/octa-core.js:2974` | `updateTablePrices` | `Search` | مستخدم | نص | متوسطة |
| 217 | `assets/js/octa-core.js:3057` | `updateTablePrices` | `scriptFile` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 218 | `assets/js/octa-core.js:3197` | `updateTablePrices` | `CORS` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 219 | `assets/js/octa-core.js:3199` | `updateTablePrices` | `intelligence` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 220 | `assets/js/octa-core.js:3248` | `updateTablePrices` | `why` | API | نص | متوسطة |
| 221 | `assets/js/octa-core.js:3256` | `updateTablePrices` | `val` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 222 | `assets/js/octa-core.js:3257` | `updateTablePrices` | `cell` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 223 | `assets/js/octa-core.js:3259` | `updateTablePrices` | `ch` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 224 | `assets/js/octa-core.js:3262` | `updateTablePrices` | `confidence` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 225 | `assets/js/octa-core.js:3272` | `updateTablePrices` | `t` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 226 | `assets/js/octa-core.js:3282` | `updateTablePrices` | `v` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 227 | `assets/js/octa-core.js:3289` | `updateTablePrices` | `indRow` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 228 | `assets/js/octa-core.js:3300` | `updateTablePrices` | `ax` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 229 | `assets/js/octa-core.js:3305` | `updateTablePrices` | `pos` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 230 | `assets/js/octa-core.js:3306` | `updateTablePrices` | `med_escape` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 231 | `assets/js/octa-core.js:3334` | `updateTablePrices` | `ENGINE` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 232 | `assets/js/octa-core.js:3425` | `updateTablePrices` | `score` | رقم | نص | منخفضة (ملاحظة يدوية — راجع السبب) |
| 233 | `assets/js/octa-core.js:3432` | `updateTablePrices` | `baseScore` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 234 | `assets/js/octa-filters.js:3070` | `fzIdealRender` | `f` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 235 | `assets/js/octa-filters.js:3070` | `fzIdealRender` | `minPass` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 236 | `assets/js/octa-gate.js:877` | `lockedOld` | `mm` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 237 | `assets/js/octa-gate.js:894` | `lockedOld` | `mm` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 238 | `assets/js/octa-gate.js:1528` | `login` | `padHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 239 | `assets/js/octa-gate.js:1850` | `sayRate` | `mm` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 240 | `assets/js/octa-gate.js:1865` | `sayRate` | `mm` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 241 | `assets/js/octa-gate.js:1907` | `codeEntry` | `codeHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 242 | `assets/js/octa-gate.js:1909` | `codeEntry` | `mm` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 243 | `assets/js/octa-gate.js:2055` | `newPin` | `padHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 244 | `assets/js/octa-gate.js:2182` | `pinStep` | `hint` | API | نص | متوسطة |
| 245 | `assets/js/octa-gate.js:2182` | `pinStep` | `padHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 246 | `assets/js/octa-gold-egy.js:727` | `drawMiniCharts` | `defs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 247 | `assets/js/octa-gold-egy.js:736` | `drawMiniCharts` | `sgn` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 248 | `assets/js/octa-gold-egy.js:741` | `drawMiniCharts` | `sgnCls` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 249 | `assets/js/octa-gold-egy.js:743` | `drawMiniCharts` | `icon` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 250 | `assets/js/octa-gold-egy.js:743` | `drawMiniCharts` | `badge` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 251 | `assets/js/octa-gold-egy.js:744` | `drawMiniCharts` | `key` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 252 | `assets/js/octa-gold-egy.js:744` | `drawMiniCharts` | `sub` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 253 | `assets/js/octa-gold-egy.js:1224` | `setView` | `sgnCls` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 254 | `assets/js/octa-gold-egy.js:1224` | `setView` | `sgn` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 255 | `assets/js/octa-gold-egy.js:1242` | `renderAnalysis` | `periods` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 256 | `assets/js/octa-gold-egy.js:1243` | `renderAnalysis` | `key` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 257 | `assets/js/octa-gold-egy.js:1304` | `renderCompare` | `periods` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 258 | `assets/js/octa-gold-egy.js:1305` | `renderCompare` | `key` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 259 | `assets/js/octa-gold-egy.js:1324` | `renderCompare` | `Economic` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 260 | `assets/js/octa-gold-egy.js:1326` | `renderCompare` | `dtxt` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 261 | `assets/js/octa-gold-egy.js:1346` | `paint` | `color` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 262 | `assets/js/octa-gold-egy.js:1347` | `paint` | `sgnCls` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 263 | `assets/js/octa-gold-egy.js:1347` | `paint` | `sgn` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 264 | `assets/js/octa-index-intel.js:748` | `renderIndexIntel` | `hero` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 265 | `assets/js/octa-index-intel.js:748` | `renderIndexIntel` | `dataStatus` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 266 | `assets/js/octa-index-intel.js:749` | `renderIndexIntel` | `perBtns` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 267 | `assets/js/octa-index-intel.js:750` | `renderIndexIntel` | `modeBtns` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 268 | `assets/js/octa-index-intel.js:750` | `renderIndexIntel` | `readoutHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 269 | `assets/js/octa-index-intel.js:750` | `renderIndexIntel` | `chart` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 270 | `assets/js/octa-index-intel.js:755` | `renderIndexIntel` | `stats` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 271 | `assets/js/octa-index-intel.js:756` | `renderIndexIntel` | `regHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 272 | `assets/js/octa-index-intel.js:756` | `renderIndexIntel` | `eduHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 273 | `assets/js/octa-index-intel.js:757` | `renderIndexIntel` | `offHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 274 | `assets/js/octa-index-intel.js:757` | `renderIndexIntel` | `phasesHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 275 | `assets/js/octa-index-intel.js:757` | `renderIndexIntel` | `evHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 276 | `assets/js/octa-index-intel.js:757` | `renderIndexIntel` | `persHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 277 | `assets/js/octa-index-intel.js:757` | `renderIndexIntel` | `consHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 278 | `assets/js/octa-index-intel.js:757` | `renderIndexIntel` | `lessonHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 279 | `assets/js/octa-index-intel.js:757` | `renderIndexIntel` | `srcHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 280 | `assets/js/octa-index-intel.js:957` | `showEventCard` | `drange` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 281 | `assets/js/octa-index-intel.js:958` | `showEventCard` | `signClass` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 282 | `assets/js/octa-index-intel.js:958` | `showEventCard` | `pct` | رقم | نص | منخفضة |
| 283 | `assets/js/octa-index-intel.js:1169` | `renderCmp` | `ctl` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 284 | `assets/js/octa-index-intel.js:1169` | `renderCmp` | `chart` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 285 | `assets/js/octa-index-intel.js:1169` | `renderCmp` | `table` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 286 | `assets/js/octa-index-intel.js:1222` | `drawCmp` | `paths` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 287 | `assets/js/octa-money.js:402` | `buildSectors` | `secs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 288 | `assets/js/octa-money.js:435` | `renderStatus` | `srcTxt` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 289 | `assets/js/octa-money.js:489` | `renderList` | `rows` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 290 | `assets/js/octa-money.js:494` | `renderList` | `f2` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 291 | `assets/js/octa-money.js:494` | `renderList` | `clr` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 292 | `assets/js/octa-money.js:494` | `renderList` | `pct` | رقم | نص | منخفضة |
| 293 | `assets/js/octa-money.js:495` | `renderList` | `bar` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 294 | `assets/js/octa-money.js:497` | `renderList` | `axisCell` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 295 | `assets/js/octa-money.js:498` | `renderList` | `badgeHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 296 | `assets/js/octa-money.js:524` | `moneyOpen` | `f2` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 297 | `assets/js/octa-money.js:525` | `moneyOpen` | `clr` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 298 | `assets/js/octa-money.js:525` | `moneyOpen` | `pct` | رقم | نص | منخفضة |
| 299 | `assets/js/octa-money.js:530` | `moneyOpen` | `badgeHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 300 | `assets/js/octa-money.js:606` | `loadDetail` | `why` | API | نص | متوسطة |
| 301 | `assets/js/octa-money.js:617` | `loadDetail` | `age` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 302 | `assets/js/octa-movers.js:324` | `render` | `heroHTML` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 303 | `assets/js/octa-movers.js:329` | `render` | `periodHTML` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 304 | `assets/js/octa-movers.js:329` | `render` | `moodHTML` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 305 | `assets/js/octa-movers.js:337` | `render` | `gainers` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 306 | `assets/js/octa-movers.js:341` | `render` | `losers` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 307 | `assets/js/octa-movers.js:459` | `openSheet` | `n2` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 308 | `assets/js/octa-movers.js:460` | `openSheet` | `dir` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 309 | `assets/js/octa-movers.js:460` | `openSheet` | `ltr` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 310 | `assets/js/octa-movers.js:466` | `openSheet` | `chips` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 311 | `assets/js/octa-movers.js:467` | `openSheet` | `k` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 312 | `assets/js/octa-movers.js:469` | `openSheet` | `perGrid` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 313 | `assets/js/octa-movers.js:472` | `openSheet` | `facts` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 314 | `assets/js/octa-pages.js:221` | `renderHomeDividends` | `Number` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 315 | `assets/js/octa-pages.js:221` | `renderHomeDividends` | `a` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 316 | `assets/js/octa-pages.js:221` | `renderHomeDividends` | `value` | API | نص | متوسطة |
| 317 | `assets/js/octa-pages.js:221` | `renderHomeDividends` | `toFixed` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 318 | `assets/js/octa-pages.js:224` | `renderHomeDividends` | `stockLogo` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 319 | `assets/js/octa-pages.js:224` | `renderHomeDividends` | `code` | API | نص | متوسطة |
| 320 | `assets/js/octa-pages.js:224` | `renderHomeDividends` | `typeBadge` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 321 | `assets/js/octa-pages.js:225` | `renderHomeDividends` | `d` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 322 | `assets/js/octa-pages.js:225` | `renderHomeDividends` | `null` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 323 | `assets/js/octa-pages.js:226` | `renderHomeDividends` | `v` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 324 | `assets/js/octa-pages.js:222` | `renderHomeDividends` | `$` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 325 | `assets/js/octa-pages.js:225` | `renderHomeDividends` | `d` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 326 | `assets/js/octa-pages.js:477` | `loadIntelRule` | `INTEL_COPY` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 327 | `assets/js/octa-pages.js:477` | `loadIntelRule` | `ruleTitle` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 328 | `assets/js/octa-pages.js:478` | `loadIntelRule` | `ruleUnavailable` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 329 | `assets/js/octa-pages.js:486` | `loadIntelRule` | `INTEL_COPY` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 330 | `assets/js/octa-pages.js:486` | `loadIntelRule` | `ruleTitle` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 331 | `assets/js/octa-pages.js:487` | `loadIntelRule` | `age` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 332 | `assets/js/octa-pages.js:494` | `loadIntelRule` | `INTEL_COPY` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 333 | `assets/js/octa-pages.js:494` | `loadIntelRule` | `ruleTitle` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 334 | `assets/js/octa-pages.js:624` | `listHTML` | `decClass` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 335 | `assets/js/octa-pages.js:626` | `listHTML` | `riskCls` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 336 | `assets/js/octa-pages.js:633` | `listHTML` | `fvHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 337 | `assets/js/octa-pages.js:638` | `listHTML` | `axisHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 338 | `assets/js/octa-pages.js:646` | `listHTML` | `listHTML` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 339 | `assets/js/octa-pages.js:683` | `listHTML` | `rows` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 340 | `assets/js/octa-pages.js:684` | `listHTML` | `k` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 341 | `assets/js/octa-pages.js:685` | `listHTML` | `v` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 342 | `assets/js/octa-pages.js:694` | `listHTML` | `risk_adjusted_opportunity` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 343 | `assets/js/octa-pages.js:747` | `loadOpportunities` | `octaJsArg` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 344 | `assets/js/octa-pages.js:749` | `loadOpportunities` | `s` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 345 | `assets/js/octa-pages.js:749` | `loadOpportunities` | `code` | API | نص | متوسطة |
| 346 | `assets/js/octa-pages.js:757` | `loadOpportunities` | `dec` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 347 | `assets/js/octa-pages.js:757` | `loadOpportunities` | `decision` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 348 | `assets/js/octa-pages.js:758` | `loadOpportunities` | `up` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 349 | `assets/js/octa-pages.js:758` | `loadOpportunities` | `risk` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 350 | `assets/js/octa-pages.js:830` | `loadEarlyOpps` | `OCTA_API` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 351 | `assets/js/octa-pages.js:845` | `loadEarlyOpps` | `CUR_STRAT` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 352 | `assets/js/octa-pages.js:854` | `renderStrategies` | `tabs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 353 | `assets/js/octa-pages.js:866` | `renderStrategies` | `tabs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 354 | `assets/js/octa-pages.js:874` | `renderStrategies` | `vc` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 355 | `assets/js/octa-pages.js:884` | `renderStrategies` | `abars` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 356 | `assets/js/octa-pages.js:904` | `renderStrategies` | `OCTA_API` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 357 | `assets/js/octa-pages.js:1597` | `loadPeriodData` | `up` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 358 | `assets/js/octa-pages.js:1598` | `loadPeriodData` | `dn` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 359 | `assets/js/octa-pages.js:1890` | `tvSearch` | `s` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 360 | `assets/js/octa-pages.js:1890` | `tvSearch` | `code` | API | نص | متوسطة |
| 361 | `assets/js/octa-pages.js:1893` | `tvSearch` | `c` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 362 | `assets/js/octa-pages.js:1983` | `showSector` | `list` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 363 | `assets/js/octa-pages.js:2289` | `vRenderCard` | `fresh` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 364 | `assets/js/octa-pages.js:2291` | `vRenderCard` | `vEsc` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 365 | `assets/js/octa-pages.js:2294` | `vRenderCard` | `conf` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 366 | `assets/js/octa-pages.js:2295` | `vRenderCard` | `d` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 367 | `assets/js/octa-pages.js:2295` | `vRenderCard` | `data_confidence` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 368 | `assets/js/octa-pages.js:2296` | `vRenderCard` | `vNf` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 369 | `assets/js/octa-pages.js:2297` | `vRenderCard` | `chgCls` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 370 | `assets/js/octa-pages.js:2298` | `vRenderCard` | `vRing` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 371 | `assets/js/octa-pages.js:2301` | `vRenderCard` | `v` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 372 | `assets/js/octa-pages.js:2301` | `vRenderCard` | `c` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 373 | `assets/js/octa-pages.js:2301` | `vRenderCard` | `t` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 374 | `assets/js/octa-pages.js:2303` | `vRenderCard` | `safety_score` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 375 | `assets/js/octa-pages.js:2309` | `vRenderCard` | `arms` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 376 | `assets/js/octa-pages.js:2311` | `vRenderCard` | `why` | API | نص | متوسطة |
| 377 | `assets/js/octa-pages.js:2312` | `vRenderCard` | `techHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 378 | `assets/js/octa-pages.js:2313` | `vRenderCard` | `riskHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 379 | `assets/js/octa-pages.js:2314` | `vRenderCard` | `entry` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 380 | `assets/js/octa-pages.js:2317` | `vRenderCard` | `f` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 381 | `assets/js/octa-pages.js:2317` | `vRenderCard` | `upside_pct` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 382 | `assets/js/octa-pages.js:2318` | `vRenderCard` | `ab` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 383 | `assets/js/octa-pages.js:2320` | `vRenderCard` | `invalHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 384 | `assets/js/octa-pages.js:2356` | `vLoadCard` | `vEsc` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 385 | `assets/js/octa-pages.js:2363` | `initVerdictCard` | `c` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 386 | `assets/js/octa-pages.js:2585` | `initMarketTicker` | `t` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 387 | `assets/js/octa-pages.js:2587` | `initMarketTicker` | `id` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 388 | `assets/js/octa-pages.js:2642` | `initMarketTicker` | `heatColor` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 389 | `assets/js/octa-pages.js:2642` | `initMarketTicker` | `change` | رقم | ستايل | منخفضة |
| 390 | `assets/js/octa-pages.js:2643` | `initMarketTicker` | `m` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 391 | `assets/js/octa-pages.js:2643` | `initMarketTicker` | `g` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 392 | `assets/js/octa-pages.js:2647` | `initMarketTicker` | `Number` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 393 | `assets/js/octa-pages.js:2647` | `initMarketTicker` | `toFixed` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 394 | `assets/js/octa-pages.js:2680` | `initMarketTicker` | `gold` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 395 | `assets/js/octa-pages.js:2680` | `initMarketTicker` | `b` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 396 | `assets/js/octa-pages.js:2680` | `initMarketTicker` | `style` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 397 | `assets/js/octa-pages.js:2680` | `initMarketTicker` | `color` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 398 | `assets/js/octa-pages.js:2680` | `initMarketTicker` | `var` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 399 | `assets/js/octa-pages.js:2680` | `initMarketTicker` | `red2` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 400 | `assets/js/octa-pages.js:2681` | `initMarketTicker` | `usd` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 401 | `assets/js/octa-pages.js:2685` | `initMarketTicker` | `egx30` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 402 | `assets/js/octa-pages.js:2686` | `initMarketTicker` | `spx` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 403 | `assets/js/octa-pages.js:2707` | `initMarketTicker` | `r` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 404 | `assets/js/octa-pages.js:2707` | `initMarketTicker` | `v` | غير محدد | مقارنة | منخفضة (مقارنة — مش حقن) |
| 405 | `assets/js/octa-pages.js:2707` | `initMarketTicker` | `same` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 406 | `assets/js/octa-pages.js:2707` | `initMarketTicker` | `up` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 407 | `assets/js/octa-pages.js:2707` | `initMarketTicker` | `inv` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 408 | `assets/js/octa-pages.js:2707` | `initMarketTicker` | `down` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 409 | `assets/js/octa-pages.js:2708` | `initMarketTicker` | `a` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 410 | `assets/js/octa-pages.js:2709` | `initMarketTicker` | `why` | API | نص | متوسطة |
| 411 | `assets/js/octa-pages.js:2737` | `initMarketTicker` | `s` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 412 | `assets/js/octa-pages.js:2738` | `initMarketTicker` | `name` | API | نص | متوسطة |
| 413 | `assets/js/octa-pages.js:2737` | `initMarketTicker` | `avg` | رقم | ستايل | منخفضة |
| 414 | `assets/js/octa-pages.js:2780` | `initMarketTicker` | `setups` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 415 | `assets/js/octa-pages.js:2796` | `initMarketTicker` | `cheap` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 416 | `assets/js/octa-pages.js:2800` | `initMarketTicker` | `undervalued` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 417 | `assets/js/octa-pages.js:2804` | `initMarketTicker` | `withDiv` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 418 | `assets/js/octa-pages.js:2808` | `initMarketTicker` | `all` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 419 | `assets/js/octa-pages.js:2829` | `initMarketTicker` | `thin` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 420 | `assets/js/octa-pages.js:2831` | `initMarketTicker` | `secList` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 421 | `assets/js/octa-pages.js:2833` | `initMarketTicker` | `k` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 422 | `assets/js/octa-pages.js:2834` | `initMarketTicker` | `median_pe` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 423 | `assets/js/octa-pages.js:2881` | `initMarketTicker` | `safety` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 424 | `assets/js/octa-pages.js:2891` | `initMarketTicker` | `cls` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 425 | `assets/js/octa-pages.js:2891` | `initMarketTicker` | `avg_after` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 426 | `assets/js/octa-pages.js:2895` | `initMarketTicker` | `version` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 427 | `assets/js/octa-pages.js:2931` | `initMarketTicker` | `pf` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 428 | `assets/js/octa-pages.js:2935` | `initMarketTicker` | `shares` | رقم | نص | منخفضة |
| 429 | `assets/js/octa-pages.js:2935` | `initMarketTicker` | `cost` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 430 | `assets/js/octa-pages.js:2948` | `initMarketTicker` | `diversification` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 431 | `assets/js/octa-pages.js:2956` | `initMarketTicker` | `rows` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 432 | `assets/js/octa-pages.js:3018` | `initMarketTicker` | `stage` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 433 | `assets/js/octa-pages.js:3020` | `initMarketTicker` | `slice` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 434 | `assets/js/octa-pages.js:3021` | `initMarketTicker` | `sc` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 435 | `assets/js/octa-pages.js:3021` | `initMarketTicker` | `null` | غير محدد | مقارنة | منخفضة (مقارنة — مش حقن) |
| 436 | `assets/js/octa-pages.js:3021` | `initMarketTicker` | `small` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 437 | `assets/js/octa-pages.js:3031` | `initMarketTicker` | `score` | رقم | نص | منخفضة |
| 438 | `assets/js/octa-pages.js:2584` | `initMarketTicker` | `TICKER_WANT` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 439 | `assets/js/octa-pages.js:2592` | `initMarketTicker` | `OCTA_API` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 440 | `assets/js/octa-pages.js:2607` | `initMarketTicker` | `chg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 441 | `assets/js/octa-pages.js:2680` | `initMarketTicker` | `gold` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 442 | `assets/js/octa-pages.js:2705` | `initMarketTicker` | `html` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 443 | `assets/js/octa-pages.js:2730` | `initMarketTicker` | `sum` | رقم | نص | منخفضة |
| 444 | `assets/js/octa-pages.js:2778` | `initMarketTicker` | `ic` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 445 | `assets/js/octa-pages.js:2832` | `initMarketTicker` | `secList` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 446 | `assets/js/octa-pages.js:2877` | `initMarketTicker` | `stockTable` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 447 | `assets/js/octa-pages.js:2888` | `initMarketTicker` | `Object` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 448 | `assets/js/octa-pages.js:3015` | `initMarketTicker` | `early` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 449 | `assets/js/octa-pages.js:3033` | `initMarketTicker` | `s` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 450 | `assets/js/octa-pages.js:3081` | `initMarketTicker` | `age` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 451 | `assets/js/octa-pages.js:3100` | `initMarketTicker` | `chart` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 452 | `assets/js/octa-pages.js:3137` | `initMarketTicker` | `path` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 453 | `assets/js/octa-pages.js:3137` | `initMarketTicker` | `r` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 454 | `assets/js/octa-pages.js:3194` | `initMarketTicker` | `f` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 455 | `assets/js/octa-pages.js:3194` | `initMarketTicker` | `valuation_status` | API | نص | متوسطة |
| 456 | `assets/js/octa-pages.js:3247` | `initMarketTicker` | `query` | مستخدم | خاصية | منخفضة (ملاحظة يدوية — راجع السبب) |
| 457 | `assets/js/octa-pages.js:3255` | `initMarketTicker` | `enc` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 458 | `assets/js/octa-pages.js:3286` | `initMarketTicker` | `m` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 459 | `assets/js/octa-pages.js:3335` | `initMarketTicker` | `link` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 460 | `assets/js/octa-pages.js:3336` | `initMarketTicker` | `title` | API | نص | متوسطة |
| 461 | `assets/js/octa-pages.js:3392` | `initMarketTicker` | `bidVol` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 462 | `assets/js/octa-pages.js:3426` | `initMarketTicker` | `a` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 463 | `assets/js/octa-pages.js:3426` | `initMarketTicker` | `cls` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 464 | `assets/js/octa-pages.js:3427` | `initMarketTicker` | `ico` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 465 | `assets/js/octa-pages.js:3429` | `initMarketTicker` | `obFmt` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 466 | `assets/js/octa-pages.js:3451` | `initMarketTicker` | `tabs` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 467 | `assets/js/octa-pages.js:3456` | `initMarketTicker` | `t` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 468 | `assets/js/octa-pages.js:3456` | `initMarketTicker` | `side` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 469 | `assets/js/octa-pages.js:3480` | `initMarketTicker` | `akW` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 470 | `assets/js/octa-pages.js:3481` | `initMarketTicker` | `bkW` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 471 | `assets/js/octa-pages.js:3501` | `initMarketTicker` | `SI_CODE` | API | نص | متوسطة |
| 472 | `assets/js/octa-pages.js:3513` | `initMarketTicker` | `cb` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 473 | `assets/js/octa-pages.js:3514` | `initMarketTicker` | `ca` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 474 | `assets/js/octa-pages.js:3530` | `initMarketTicker` | `msg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 475 | `assets/js/octa-pages.js:3552` | `initMarketTicker` | `obSaveKey` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 476 | `assets/js/octa-pages.js:3613` | `initMarketTicker` | `regex` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 477 | `assets/js/octa-pages.js:3705` | `initMarketTicker` | `id` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 478 | `assets/js/octa-pages.js:3705` | `initMarketTicker` | `label` | API | نص | متوسطة |
| 479 | `assets/js/octa-pages.js:3708` | `initMarketTicker` | `mk` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 480 | `assets/js/octa-pages.js:3729` | `initMarketTicker` | `OS_DB` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 481 | `assets/js/octa-pages.js:3729` | `initMarketTicker` | `secs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 482 | `assets/js/octa-pages.js:3782` | `initMarketTicker` | `spFmtNum` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 483 | `assets/js/octa-pages.js:3783` | `initMarketTicker` | `spFmtPct` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 484 | `assets/js/octa-pages.js:3784` | `initMarketTicker` | `spFmtCap` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 485 | `assets/js/octa-pages.js:3802` | `initMarketTicker` | `mets` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 486 | `assets/js/octa-pages.js:3804` | `initMarketTicker` | `scCol` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 487 | `assets/js/octa-pages.js:3805` | `initMarketTicker` | `d` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 488 | `assets/js/octa-pages.js:3805` | `initMarketTicker` | `bg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 489 | `assets/js/octa-pages.js:3847` | `initMarketTicker` | `p` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 490 | `assets/js/octa-pages.js:3854` | `initMarketTicker` | `$` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 491 | `assets/js/octa-pages.js:3892` | `initMarketTicker` | `dvNameAr` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 492 | `assets/js/octa-pages.js:3920` | `initMarketTicker` | `k` | غير محدد | حدث داخل | منخفضة (مصدر غير مؤكد) |
| 493 | `assets/js/octa-pages.js:3920` | `initMarketTicker` | `l` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 494 | `assets/js/octa-pages.js:3929` | `initMarketTicker` | `dvDate` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 495 | `assets/js/octa-pages.js:3929` | `initMarketTicker` | `dvDays` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 496 | `assets/js/octa-pages.js:3944` | `initMarketTicker` | `mkS` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 497 | `assets/js/octa-pages.js:3980` | `initMarketTicker` | `up` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 498 | `assets/js/octa-pages.js:3981` | `initMarketTicker` | `A` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 499 | `assets/js/octa-pages.js:3986` | `initMarketTicker` | `totVal` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 500 | `assets/js/octa-pages.js:4025` | `dvNext` | `up` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 501 | `assets/js/octa-pages.js:4028` | `dvNext` | `rows` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 502 | `assets/js/octa-pages.js:4110` | `dvBook` | `tbl` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 503 | `assets/js/octa-pages.js:4110` | `dvBook` | `SRC` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 504 | `assets/js/octa-pages.js:4265` | `ipoRender` | `last` | رقم | نص | منخفضة |
| 505 | `assets/js/octa-pages.js:4265` | `ipoRender` | `IPO_DATA` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 506 | `assets/js/octa-pages.js:4267` | `ipoRender` | `ipoNewPanel` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 507 | `assets/js/octa-pages.js:4268` | `ipoRender` | `tabs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 508 | `assets/js/octa-pages.js:4269` | `ipoRender` | `rows` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 509 | `assets/js/octa-pages.js:4270` | `ipoRender` | `ipoTeaser` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 510 | `assets/js/octa-pages.js:4271` | `ipoRender` | `ipoAskPanel` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 511 | `assets/js/octa-pages.js:4362` | `dvRender` | `label` | API | نص | متوسطة |
| 512 | `assets/js/octa-pages.js:4362` | `dvRender` | `rows` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 513 | `assets/js/octa-pages.js:4501` | `renderStockPage` | `liquidity` | مستخدم | نص | متوسطة |
| 514 | `assets/js/octa-pages.js:4501` | `renderStockPage` | `score` | رقم | نص | منخفضة |
| 515 | `assets/js/octa-pages.js:4501` | `renderStockPage` | `toFixed` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 516 | `assets/js/octa-pages.js:4502` | `renderStockPage` | `rk` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 517 | `assets/js/octa-pages.js:4502` | `renderStockPage` | `safety_score` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 518 | `assets/js/octa-pages.js:4508` | `renderStockPage` | `chg2` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 519 | `assets/js/octa-pages.js:4508` | `renderStockPage` | `pos` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 520 | `assets/js/octa-pages.js:4508` | `renderStockPage` | `neg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 521 | `assets/js/octa-pages.js:4508` | `renderStockPage` | `Number` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 522 | `assets/js/octa-pages.js:4508` | `renderStockPage` | `price` | رقم | نص | منخفضة |
| 523 | `assets/js/octa-pages.js:4515` | `renderStockPage` | `SI_SCORE` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 524 | `assets/js/octa-pages.js:4519` | `renderStockPage` | `confidence` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 525 | `assets/js/octa-pages.js:4522` | `renderStockPage` | `decCls` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 526 | `assets/js/octa-pages.js:4526` | `renderStockPage` | `fvHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 527 | `assets/js/octa-pages.js:4540` | `renderStockPage` | `stockNews` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 528 | `assets/js/octa-pages.js:4548` | `renderStockPage` | `src` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 529 | `assets/js/octa-pages.js:4556` | `renderStockPage` | `var` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 530 | `assets/js/octa-pages.js:4556` | `renderStockPage` | `red2` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 531 | `assets/js/octa-pages.js:4557` | `renderStockPage` | `fundamental` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 532 | `assets/js/octa-pages.js:4557` | `renderStockPage` | `sector_peers` | API | نص | متوسطة |
| 533 | `assets/js/octa-pages.js:4557` | `renderStockPage` | `metrics` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 534 | `assets/js/octa-pages.js:4557` | `renderStockPage` | `e9` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 535 | `assets/js/octa-pages.js:4558` | `renderStockPage` | `technical` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 536 | `assets/js/octa-pages.js:4558` | `renderStockPage` | `atr_pct` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 537 | `assets/js/octa-pages.js:4560` | `renderStockPage` | `fair_value` | API | نص | متوسطة |
| 538 | `assets/js/octa-pages.js:4569` | `renderStockPage` | `axesHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 539 | `assets/js/octa-pages.js:4575` | `renderStockPage` | `P` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 540 | `assets/js/octa-pages.js:4575` | `renderStockPage` | `E` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 541 | `assets/js/octa-pages.js:4589` | `renderStockPage` | `intelScoreGuide` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 542 | `assets/js/octa-pages.js:4590` | `renderStockPage` | `intelConflictNote` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 543 | `assets/js/octa-pages.js:4590` | `renderStockPage` | `ax` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 544 | `assets/js/octa-pages.js:4594` | `renderStockPage` | `exRaw` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 545 | `assets/js/octa-pages.js:4594` | `renderStockPage` | `formula` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 546 | `assets/js/octa-pages.js:4596` | `renderStockPage` | `base_score` | غير محدد | مقارنة | منخفضة (مقارنة — مش حقن) |
| 547 | `assets/js/octa-pages.js:4596` | `renderStockPage` | `null` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 548 | `assets/js/octa-pages.js:4597` | `renderStockPage` | `adjustment_total` | غير محدد | مقارنة | منخفضة (مقارنة — مش حقن) |
| 549 | `assets/js/octa-pages.js:4597` | `renderStockPage` | `Math` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 550 | `assets/js/octa-pages.js:4597` | `renderStockPage` | `abs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 551 | `assets/js/octa-pages.js:4598` | `renderStockPage` | `final_score` | غير محدد | مقارنة | منخفضة (مقارنة — مش حقن) |
| 552 | `assets/js/octa-pages.js:4661` | `renderStockPage` | `div` | رقم | نص | منخفضة |
| 553 | `assets/js/octa-pages.js:4661` | `renderStockPage` | `class` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 554 | `assets/js/octa-pages.js:4661` | `renderStockPage` | `si` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 555 | `assets/js/octa-pages.js:4661` | `renderStockPage` | `fact` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 556 | `assets/js/octa-pages.js:4661` | `renderStockPage` | `neu` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 557 | `assets/js/octa-pages.js:4661` | `renderStockPage` | `span` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 558 | `assets/js/octa-pages.js:4661` | `renderStockPage` | `fi` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 559 | `assets/js/octa-pages.js:4668` | `renderStockPage` | `chg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 560 | `assets/js/octa-pages.js:4668` | `renderStockPage` | `inv` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 561 | `assets/js/octa-pages.js:4670` | `renderStockPage` | `missing` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 562 | `assets/js/octa-pages.js:4682` | `renderStockPage` | `status` | API | مقارنة | منخفضة (مقارنة — مش حقن) |
| 563 | `assets/js/octa-pages.js:4682` | `renderStockPage` | `upcoming` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 564 | `assets/js/octa-pages.js:4688` | `renderStockPage` | `yieldPct` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 565 | `assets/js/octa-pages.js:4698` | `renderStockPage` | `nameAr` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 566 | `assets/js/octa-pages.js:4714` | `renderStockPage` | `risk_level` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 567 | `assets/js/octa-pages.js:4715` | `renderStockPage` | `risks` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 568 | `assets/js/octa-pages.js:4721` | `renderStockPage` | `v` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 569 | `assets/js/octa-pages.js:4721` | `renderStockPage` | `ff9800` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 570 | `assets/js/octa-pages.js:4721` | `renderStockPage` | `gold` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 571 | `assets/js/octa-pages.js:4763` | `renderStockPage` | `chgCls` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 572 | `assets/js/octa-pages.js:4763` | `renderStockPage` | `chgSign` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 573 | `assets/js/octa-pages.js:4767` | `renderStockPage` | `tradingViewUrl` | غير محدد | رابط/مصدر | منخفضة (مصدر غير مؤكد) |
| 574 | `assets/js/octa-pages.js:4837` | `renderStockPage` | `stocks` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 575 | `assets/js/octa-pages.js:4838` | `renderStockPage` | `score_spread` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 576 | `assets/js/octa-pages.js:4839` | `renderStockPage` | `median_score` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 577 | `assets/js/octa-pages.js:4840` | `renderStockPage` | `stocks_in_median_band` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 578 | `assets/js/octa-pages.js:4841` | `renderStockPage` | `decision_dominance_pct` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 579 | `assets/js/octa-pages.js:4841` | `renderStockPage` | `dominant_decision` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 580 | `assets/js/octa-pages.js:4848` | `renderStockPage` | `severity` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 581 | `assets/js/octa-pages.js:4849` | `renderStockPage` | `item` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 582 | `assets/js/octa-pages.js:4850` | `renderStockPage` | `high` | رقم | خاصية | منخفضة |
| 583 | `assets/js/octa-pages.js:4850` | `renderStockPage` | `medium` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 584 | `assets/js/octa-pages.js:4853` | `renderStockPage` | `l` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 585 | `assets/js/octa-pages.js:4854` | `renderStockPage` | `fix` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 586 | `assets/js/octa-pages.js:4863` | `renderStockPage` | `min` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 587 | `assets/js/octa-pages.js:4868` | `renderStockPage` | `p` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 588 | `assets/js/octa-pages.js:4868` | `renderStockPage` | `diff` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 589 | `assets/js/octa-pages.js:4875` | `renderStockPage` | `bands_with_20plus` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 590 | `assets/js/octa-pages.js:4876` | `renderStockPage` | `worst_band` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 591 | `assets/js/octa-pages.js:4877` | `renderStockPage` | `worst_band_count` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 592 | `assets/js/octa-pages.js:4993` | `renderStockPage` | `SS_ALL` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 593 | `assets/js/octa-pages.js:5077` | `renderStockPage` | `badge` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 594 | `assets/js/octa-pages.js:5077` | `renderStockPage` | `ic` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 595 | `assets/js/octa-pages.js:5078` | `renderStockPage` | `icon` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 596 | `assets/js/octa-pages.js:5079` | `renderStockPage` | `title` | API | نص | متوسطة |
| 597 | `assets/js/octa-pages.js:5080` | `renderStockPage` | `desc` | API | نص | متوسطة |
| 598 | `assets/js/octa-pages.js:5081` | `renderStockPage` | `stats` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 599 | `assets/js/octa-pages.js:5081` | `renderStockPage` | `stat` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 600 | `assets/js/octa-pages.js:5082` | `renderStockPage` | `more` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 601 | `assets/js/octa-pages.js:5437` | `renderStockPage` | `state` | API | خاصية | منخفضة (ملاحظة يدوية — راجع السبب) |
| 602 | `assets/js/octa-pages.js:5437` | `renderStockPage` | `bull` | غير محدد | خاصية | منخفضة (ملاحظة يدوية — راجع السبب) |
| 603 | `assets/js/octa-pages.js:5437` | `renderStockPage` | `bear` | غير محدد | خاصية | منخفضة (ملاحظة يدوية — راجع السبب) |
| 604 | `assets/js/octa-pages.js:5437` | `renderStockPage` | `dim` | غير محدد | نص | منخفضة (ملاحظة يدوية — راجع السبب) |
| 605 | `assets/js/octa-pages.js:5442` | `renderStockPage` | `gauge` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 606 | `assets/js/octa-pages.js:5444` | `renderStockPage` | `label` | API | نص | متوسطة |
| 607 | `assets/js/octa-pages.js:5445` | `renderStockPage` | `sub` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 608 | `assets/js/octa-pages.js:5446` | `renderStockPage` | `markerPos` | غير محدد | ستايل | منخفضة (مصدر غير مؤكد) |
| 609 | `assets/js/octa-pages.js:4540` | `renderStockPage` | `stockNews` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 610 | `assets/js/octa-pages.js:4599` | `renderStockPage` | `confidence` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 611 | `assets/js/octa-pages.js:4616` | `renderStockPage` | `contrib` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 612 | `assets/js/octa-pages.js:4823` | `renderStockPage` | `OCTA_API` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 613 | `assets/js/octa-pages.js:4930` | `renderStockPage` | `SS_ALL` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 614 | `assets/js/octa-pages.js:5025` | `renderStockPage` | `SS_SEL` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 615 | `assets/js/octa-pages.js:5077` | `renderStockPage` | `badge` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 616 | `assets/js/octa-pages.js:5081` | `renderStockPage` | `stats` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 617 | `assets/js/octa-pages.js:5095` | `renderStockPage` | `list` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 618 | `assets/js/octa-pages.js:5140` | `renderStockPage` | `KEEP` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 619 | `assets/js/octa-pages.js:5144` | `renderStockPage` | `id` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 620 | `assets/js/octa-pages.js:5171` | `renderStockPage` | `insertBefore` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 621 | `assets/js/octa-pages.js:5221` | `renderStockPage` | `GA_WANT` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 622 | `assets/js/octa-pages.js:5273` | `renderStockPage` | `B` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 623 | `assets/js/octa-pages.js:5273` | `renderStockPage` | `judged` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 624 | `assets/js/octa-pages.js:5284` | `renderStockPage` | `pct` | رقم | نص | منخفضة |
| 625 | `assets/js/octa-pages.js:5307` | `renderStockPage` | `gauge` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 626 | `assets/js/octa-pages.js:5316` | `renderStockPage` | `cur` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 627 | `assets/js/octa-pages.js:5327` | `renderStockPage` | `state` | API | نص | متوسطة |
| 628 | `assets/js/octa-pages.js:5328` | `renderStockPage` | `stName` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 629 | `assets/js/octa-pages.js:5329` | `renderStockPage` | `stSub` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 630 | `assets/js/octa-pages.js:5333` | `renderStockPage` | `compsHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 631 | `assets/js/octa-pages.js:5338` | `renderStockPage` | `decHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 632 | `assets/js/octa-pages.js:5339` | `renderStockPage` | `nIns` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 633 | `assets/js/octa-pages.js:5341` | `renderStockPage` | `bandHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 634 | `assets/js/octa-pages.js:5347` | `renderStockPage` | `nPos` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 635 | `assets/js/octa-pages.js:5347` | `renderStockPage` | `nNeu` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 636 | `assets/js/octa-pages.js:5347` | `renderStockPage` | `nNeg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 637 | `assets/js/octa-pages.js:5348` | `renderStockPage` | `sentSum` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 638 | `assets/js/octa-pages.js:5348` | `renderStockPage` | `f3` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 639 | `assets/js/octa-pages.js:5353` | `renderStockPage` | `f1` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 640 | `assets/js/octa-pages.js:5366` | `renderStockPage` | `f2` | غير محدد | خاصية | منخفضة (مصدر غير مؤكد) |
| 641 | `assets/js/octa-pages.js:5419` | `renderStockPage` | `pricePart` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 642 | `assets/js/octa-pages.js:5419` | `renderStockPage` | `safetyPart` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 643 | `assets/js/octa-pages.js:5420` | `renderStockPage` | `composite` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 644 | `assets/js/octa-pages.js:5435` | `renderStockPage` | `attribute` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 645 | `assets/js/octa-public-market.js:184` | `render` | `secs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 646 | `assets/js/octa-public-market.js:185` | `render` | `secSet` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 647 | `assets/js/octa-public-market.js:220` | `boot` | `id` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 648 | `assets/js/octa-radar-ui.js:422` | `showDiag` | `info` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 649 | `assets/js/octa-radar-ui.js:531` | `renderProgress` | `S` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 650 | `assets/js/octa-radar-ui.js:531` | `renderProgress` | `done` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 651 | `assets/js/octa-radar-ui.js:532` | `renderProgress` | `pct` | رقم | نص | منخفضة |
| 652 | `assets/js/octa-radar-ui.js:533` | `renderProgress` | `step` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 653 | `assets/js/octa-radar-ui.js:775` | `renderList` | `head` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 654 | `assets/js/octa-radar-ui.js:775` | `renderList` | `frow` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 655 | `assets/js/octa-radar-ui.js:775` | `renderList` | `body` | API | نص | متوسطة |
| 656 | `assets/js/octa-radar-ui.js:1073` | `bindDetail` | `fmtPrice` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 657 | `assets/js/octa-radar-ui.js:1075` | `bindDetail` | `fmtNum` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 658 | `assets/js/octa-radar-ui.js:1188` | `fillSectors` | `S` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 659 | `assets/js/octa-radar-ui.js:1188` | `fillSectors` | `keys` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 660 | `assets/js/octa-radar-ui.js:1189` | `fillSectors` | `set` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 661 | `assets/js/octa-screener.js:554` | `renderMktNote` | `st` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 662 | `assets/js/octa-screener.js:554` | `renderMktNote` | `nextAt` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 663 | `assets/js/octa-screener.js:602` | `render` | `aboutBox` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 664 | `assets/js/octa-screener.js:607` | `render` | `ar` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 665 | `assets/js/octa-screener.js:608` | `render` | `aboutBox` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 666 | `assets/js/octa-settings.js:820` | `render` | `SECS` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 667 | `assets/js/octa-settings.js:823` | `render` | `s` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 668 | `assets/js/octa-settings.js:823` | `render` | `id` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 669 | `assets/js/octa-settings.js:824` | `render` | `ic` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 670 | `assets/js/octa-settings.js:824` | `render` | `t` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 671 | `assets/js/octa-settings.js:828` | `render` | `body` | API | نص | متوسطة |
| 672 | `assets/js/octa-settings.js:989` | `onSlide` | `ltr` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 673 | `assets/js/octa-settings.js:989` | `onSlide` | `tot` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 674 | `assets/js/octa-setups.js:84` | `setStatus` | `dot` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 675 | `assets/js/octa-setups.js:195` | `selectItem` | `fmtDate` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 676 | `assets/js/octa-setups.js:196` | `selectItem` | `days_ago` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 677 | `assets/js/octa-setups.js:202` | `selectItem` | `kv` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 678 | `assets/js/octa-setups.js:532` | `renderTable` | `cards` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 679 | `assets/js/octa-setups.js:532` | `renderTable` | `measuredNote` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 680 | `assets/js/octa-setups.js:875` | `openAnalysis` | `fmtDate` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 681 | `assets/js/octa-setups.js:888` | `openAnalysis` | `codeBoxHTML` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 682 | `assets/js/octa-setups.js:888` | `openAnalysis` | `analysisHTML` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 683 | `assets/js/octa-setups.js:992` | `openDetail` | `fmtDate` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 684 | `assets/js/octa-setups.js:993` | `openDetail` | `days_ago` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 685 | `assets/js/octa-setups.js:1001` | `openDetail` | `kv` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 686 | `assets/js/octa-sidebar.js:126` | `build` | `html` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 687 | `assets/js/octa-techfilter.js:654` | `techOpenModal` | `tEsc` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 688 | `assets/js/octa-techfilter.js:750` | `loadDetail` | `tEsc` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 689 | `assets/js/octa-techfilter.js:751` | `loadDetail` | `tNum` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 690 | `assets/js/octa-techfilter.js:751` | `loadDetail` | `tEsc` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 691 | `assets/js/octa-us-intel.js:235` | `usAlerts` | `nf` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 692 | `assets/js/octa-us-intel.js:237` | `usAlerts` | `bg` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 693 | `assets/js/octa-us-intel.js:237` | `usAlerts` | `shares` | رقم | نص | منخفضة |
| 694 | `assets/js/octa-us-intel.js:238` | `usAlerts` | `gateHtml` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 695 | `assets/js/octa-us-intel.js:240` | `usAlerts` | `usTicket` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 696 | `assets/js/octa-usd-intel.js:716` | `render` | `tabs` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 697 | `assets/js/octa-watch.js:100` | `nmOf` | `dHi` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 698 | `assets/js/octa-watch.js:107` | `nmOf` | `dLo` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 699 | `assets/js/octa-zones.js:159` | `renderTable` | `cards` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 700 | `assets/js/octa-zones.js:192` | `select` | `fmtPrice` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |
| 701 | `assets/js/tv-shim.js:266` | `mount` | `sym` | غير محدد | نص | منخفضة (مصدر غير مؤكد) |

## قاعدة التصنيف

- **المصدر**: `API` = اسم حقل من رد الـAPI · `مستخدم` = اسم متغيّر مشتق من مدخل المستخدم · `رقم` = قيمة رقمية · `غير محدد` = محتاج مراجعة يدوية.
- **السياق**: `حدث داخل` = جوّه `onclick=` (الأخطر) · `رابط/مصدر` = `href/src` (ممكن `javascript:`) · `خاصية` = جوّه قيمة خاصية · `ستايل` = جوّه `style` · `نص` = نص عادي.
- **القابلية**: عالية = (API أو مستخدم) في سياق إدراج (حدث/رابط/خاصية/ستايل) · متوسطة = (API أو مستخدم) كنص عادي · منخفضة = رقم أو ثابت.

